const NOTION_VERSION = "2026-03-11";
const MAX_OPERATIONS = 300;

function response(data, statusCode = 200) {
    return {
        statusCode,
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-store"
        },
        body: JSON.stringify(data)
    };
}

function pageIdFor(name) {
    if (name === "engravida") return process.env.NOTION_ENGRAVIDA_PAGE_ID || "";
    if (name === "imenu") return process.env.NOTION_IMENU_PAGE_ID || "";
    return "";
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function notionFetch(path, options = {}, attempt = 0) {
    const token = process.env.NOTION_TOKEN || "";
    if (!token) throw new Error("NOTION_TOKEN is not configured.");

    const res = await fetch(`https://api.notion.com/v1${path}`, {
        ...options,
        headers: {
            "Authorization": `Bearer ${token}`,
            "Notion-Version": NOTION_VERSION,
            "Content-Type": "application/json",
            ...(options.headers || {})
        }
    });

    if (!res.ok) {
        const retryable = [409, 429, 502, 503, 504].includes(res.status) && attempt < 3;
        if (retryable) {
            const retryAfter = Number(res.headers.get("retry-after"));
            const delay = Number.isFinite(retryAfter) && retryAfter > 0
                ? retryAfter * 1000
                : 250 * (2 ** attempt);
            await sleep(Math.min(delay, 4000));
            return notionFetch(path, options, attempt + 1);
        }

        const body = await res.text().catch(() => "");
        const error = new Error(`Notion ${res.status}: ${body.slice(0, 500)}`);
        error.status = res.status;
        throw error;
    }

    if (res.status === 204) return null;
    return res.json();
}

async function getAllChildren(blockId) {
    const blocks = [];
    let cursor = "";
    do {
        const query = new URLSearchParams({ page_size: "100" });
        if (cursor) query.set("start_cursor", cursor);
        const data = await notionFetch(`/blocks/${encodeURIComponent(blockId)}/children?${query}`);
        for (const block of data.results || []) {
            if (block.has_children) block.children = await getAllChildren(block.id);
            blocks.push(block);
        }
        cursor = data.has_more ? data.next_cursor || "" : "";
    } while (cursor);
    return blocks;
}

function pageTitleInfo(page) {
    for (const [name, property] of Object.entries(page.properties || {})) {
        if (property?.type === "title") {
            return {
                property: name,
                text: (property.title || []).map(item => item.plain_text || "").join("")
            };
        }
    }
    return { property: "", text: "" };
}

function richTextFromPlainText(value) {
    const text = String(value ?? "");
    if (!text) return [];
    const parts = [];
    for (let start = 0; start < text.length; start += 2000) {
        parts.push({ type: "text", text: { content: text.slice(start, start + 2000) } });
    }
    return parts;
}

function sanitizeRichText(items, fallbackText) {
    if (!Array.isArray(items)) return richTextFromPlainText(fallbackText);
    const output = [];
    for (const item of items) {
        if (!item || item.type !== "text") continue;
        const content = String(item.text?.content ?? "");
        if (!content) continue;
        const href = typeof item.text?.link?.url === "string" ? item.text.link.url : null;
        const annotations = item.annotations || {};

        for (let start = 0; start < content.length; start += 2000) {
            output.push({
                type: "text",
                text: {
                    content: content.slice(start, start + 2000),
                    ...(href ? { link: { url: href } } : {})
                },
                annotations: {
                    bold: Boolean(annotations.bold),
                    italic: Boolean(annotations.italic),
                    strikethrough: Boolean(annotations.strikethrough),
                    underline: Boolean(annotations.underline),
                    code: Boolean(annotations.code),
                    color: "default"
                }
            });
        }
    }
    return output;
}

const EDITABLE_TYPES = new Set([
    "paragraph", "heading_1", "heading_2", "heading_3", "heading_4",
    "bulleted_list_item", "numbered_list_item", "quote", "to_do", "toggle", "callout", "code"
]);

const CREATABLE_TYPES = new Set(["paragraph", "bulleted_list_item", "numbered_list_item", "to_do"]);

function blockValueFor(type, item) {
    const value = { rich_text: sanitizeRichText(item.rich_text, item.text) };
    if (type === "to_do") value.checked = Boolean(item.checked);
    return value;
}

function createBlockPayload(item) {
    if (!CREATABLE_TYPES.has(item.type)) throw new Error(`Cannot create block type: ${item.type}`);
    return { object: "block", type: item.type, [item.type]: blockValueFor(item.type, item) };
}

function validatePayload(payload) {
    const changes = Array.isArray(payload.changes) ? payload.changes : [];
    const creates = Array.isArray(payload.creates) ? payload.creates : [];
    const deletes = Array.isArray(payload.deletes) ? payload.deletes : [];
    if (changes.length + creates.length + deletes.length > MAX_OPERATIONS) {
        throw new Error("Too many changes in one save.");
    }
    return { changes, creates, deletes };
}

async function createBlocks(pageId, creates) {
    const created = {};
    try {
        for (const item of creates) {
            if (!item || typeof item.tempId !== "string" || !item.tempId.startsWith("local-")) continue;
            const parentId = item.parentId ? (created[item.parentId] || item.parentId) : pageId;
            const afterId = item.afterId ? (created[item.afterId] || item.afterId) : "";
            const body = { children: [createBlockPayload(item)] };
            body.position = afterId
                ? { type: "after_block", after_block: { id: afterId } }
                : { type: "start" };

            const result = await notionFetch(`/blocks/${encodeURIComponent(parentId)}/children`, {
                method: "PATCH",
                body: JSON.stringify(body)
            });
            const actualId = result?.results?.[0]?.id;
            if (!actualId) throw new Error("Notion did not return the created block id.");
            created[item.tempId] = actualId;
        }
        return created;
    } catch (error) {
        error.created = created;
        throw error;
    }
}

async function updateExistingBlocks(changes, created) {
    for (const change of changes) {
        if (!change || !change.id || !EDITABLE_TYPES.has(change.type)) continue;
        const id = created[change.id] || change.id;
        await notionFetch(`/blocks/${encodeURIComponent(id)}`, {
            method: "PATCH",
            body: JSON.stringify({ [change.type]: blockValueFor(change.type, change) })
        });
    }
}

async function trashBlocks(deletes, created) {
    for (const rawId of deletes) {
        if (!rawId || typeof rawId !== "string") continue;
        const id = created[rawId] || rawId;
        try {
            await notionFetch(`/blocks/${encodeURIComponent(id)}`, {
                method: "PATCH",
                body: JSON.stringify({ in_trash: true })
            });
        } catch (error) {
            if (error.status !== 404) throw error;
        }
    }
}

async function saveChanges(pageId, payload) {
    const { changes, creates, deletes } = validatePayload(payload);
    const created = await createBlocks(pageId, creates);
    try {
        await updateExistingBlocks(changes, created);
        await trashBlocks(deletes, created);

        if (payload.title && payload.title.property) {
            await notionFetch(`/pages/${encodeURIComponent(pageId)}`, {
                method: "PATCH",
                body: JSON.stringify({
                    properties: {
                        [payload.title.property]: { title: richTextFromPlainText(payload.title.text) }
                    }
                })
            });
        }
        return created;
    } catch (error) {
        error.created = created;
        throw error;
    }
}

exports.handler = async function(event) {
    try {
        const pageName = event.queryStringParameters?.page || "";
        const pageId = pageIdFor(pageName);
        if (!pageId) return response({ error: "Page is not configured." }, 404);

        if (event.httpMethod === "GET") {
            const [page, blocks] = await Promise.all([
                notionFetch(`/pages/${encodeURIComponent(pageId)}`),
                getAllChildren(pageId)
            ]);
            return response({ page: pageName, title: pageTitleInfo(page), blocks });
        }

        if (event.httpMethod === "PUT") {
            const body = JSON.parse(event.body || "{}");
            try {
                const created = await saveChanges(pageId, body);
                return response({ ok: true, created });
            } catch (error) {
                return response({ error: error?.message || String(error), created: error?.created || {} }, 500);
            }
        }

        return response({ error: "Method not allowed." }, 405);
    } catch (error) {
        return response({ error: error?.message || String(error) }, 500);
    }
};
