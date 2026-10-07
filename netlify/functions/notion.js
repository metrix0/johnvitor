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
        if (!item) continue;
        if (item.type === "mention" && item.mention) {
            const mention = item.mention;
            const type = mention.type;
            if (["page", "database", "user"].includes(type) && mention[type]?.id) output.push({ type: "mention", mention: { type, [type]: { id: mention[type].id } }, annotations: item.annotations });
            else if (type === "date" && mention.date?.start) output.push({ type: "mention", mention: { type, date: mention.date }, annotations: item.annotations });
            else throw new Error(`This ${type || "unknown"} mention must be edited in Notion to preserve its data.`);
            continue;
        }
        if (item.type === "equation" && item.equation?.expression) {
            output.push({ type: "equation", equation: { expression: String(item.equation.expression) }, annotations: item.annotations });
            continue;
        }
        if (item.type !== "text") continue;
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
                    color: validColor(annotations.color)
                }
            });
        }
    }
    return output;
}

const CREATABLE_TYPES = new Set([
    "paragraph", "heading_1", "heading_2", "heading_3", "bulleted_list_item", "numbered_list_item",
    "to_do", "quote", "toggle", "callout", "code", "divider", "table", "table_row",
    "image", "bookmark", "embed", "video", "pdf", "file", "audio", "equation"
]);

function validColor(color) {
    return /^(default|gray|brown|orange|yellow|green|blue|purple|pink|red)(_background)?$/.test(color || "") ? color : "default";
}

function blockValueFor(type, item) {
    const source = item.value || item;
    if (type === "divider") return {};
    if (type === "table") return { ...(item.tempId ? { table_width: source.table_width } : {}), has_column_header: Boolean(source.has_column_header), has_row_header: Boolean(source.has_row_header) };
    if (type === "table_row") {
        if (!Array.isArray(source.cells) || !source.cells.length) throw new Error("Table rows need cells.");
        return { cells: source.cells.map(cell => sanitizeRichText(cell, "")) };
    }
    if (type === "equation") return { expression: String(source.expression || "") };
    if (["bookmark", "embed"].includes(type)) {
        if (!/^https?:\/\//i.test(source.url || "")) throw new Error("Invalid media URL.");
        return { url: source.url, caption: sanitizeRichText(source.caption || [], "") };
    }
    if (["image", "video", "pdf", "file", "audio"].includes(type)) {
        if (source.type !== "external" || !/^https?:\/\//i.test(source.external?.url || "")) throw new Error("Notion-hosted files must be managed in Notion.");
        return { type: "external", external: { url: source.external.url }, caption: sanitizeRichText(source.caption || [], "") };
    }
    const value = { rich_text: sanitizeRichText(source.rich_text, source.text), color: validColor(source.color) };
    if (type === "to_do") value.checked = Boolean(source.checked);
    if (/^heading_[123]$/.test(type)) value.is_toggleable = Boolean(source.is_toggleable);
    if (type === "callout") {
        if (source.icon?.type === "emoji") value.icon = { type: "emoji", emoji: source.icon.emoji };
        else if (source.icon?.type === "external") value.icon = { type: "external", external: { url: source.icon.external.url } };
        else if (!source.icon) value.icon = { type: "emoji", emoji: "💡" };
        else if (item.tempId) throw new Error("This callout icon must be managed in Notion.");
    }
    if (type === "code") { delete value.color; value.language = source.language || "plain text"; value.caption = sanitizeRichText(source.caption || [], ""); }
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
    const seen = new Set();
    for (const item of creates) {
        if (!item || typeof item.tempId !== "string" || !item.tempId.startsWith("local-") || seen.has(item.tempId)) throw new Error("Invalid new block identifier.");
        seen.add(item.tempId);
        if (item.parentId?.startsWith("local-") && !seen.has(item.parentId)) throw new Error("New parent must precede its children.");
        if (item.afterId?.startsWith("local-") && !seen.has(item.afterId)) throw new Error("New sibling must precede the next block.");
        const payload = createBlockPayload(item);
        if (item.type === "table") {
            const rows = creates.filter(row => row.parentId === item.tempId && row.type === "table_row");
            if (!rows.length || rows.length > 100) throw new Error("Tables need between 1 and 100 rows per save.");
            if (rows.some(row => row.value?.cells?.length !== payload.table.table_width)) throw new Error("Table cells must match its width.");
        }
    }
    for (const item of changes) {
        if (!item?.id || !CREATABLE_TYPES.has(item.type)) throw new Error("Invalid block update.");
        blockValueFor(item.type, item);
    }
    for (const id of deletes) if (typeof id !== "string" || !id || id.startsWith("local-")) throw new Error("Invalid deletion identifier.");
    return { changes, creates, deletes };
}

async function createBlocks(pageId, creates, initialCreated = {}) {
    const created = { ...initialCreated };
    try {
        for (const item of creates) {
            if (!item || typeof item.tempId !== "string" || !item.tempId.startsWith("local-")) continue;
            if (created[item.tempId]) continue;
            const parentId = item.parentId ? (created[item.parentId] || item.parentId) : pageId;
            const afterId = item.afterId ? (created[item.afterId] || item.afterId) : "";
            const payload = createBlockPayload(item);
            const tableRows = item.type === "table" ? creates.filter(row => row.parentId === item.tempId && row.type === "table_row") : [];
            if (item.type === "table") {
                if (!tableRows.length || tableRows.length > 100) throw new Error("Tables need between 1 and 100 rows per save.");
                payload.table.children = tableRows.map(createBlockPayload);
            }
            const body = { children: [payload] };
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
            if (tableRows.length) {
                try {
                    const rows = await getAllChildren(actualId);
                    if (rows.length !== tableRows.length) throw new Error("Could not map all saved table rows.");
                    tableRows.forEach((row, index) => created[row.tempId] = rows[index].id);
                } catch (error) {
                    error.pendingTables = [{ id: actualId, rowTempIds: tableRows.map(row => row.tempId) }];
                    throw error;
                }
            }
        }
        return created;
    } catch (error) {
        error.created = created;
        throw error;
    }
}

async function updateExistingBlocks(changes, created) {
    for (const change of changes) {
        if (!change || !change.id || !CREATABLE_TYPES.has(change.type)) continue;
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
    const recovered = {};
    const pending = Array.isArray(payload.pendingTables) ? payload.pendingTables : [];
    if (pending.length > MAX_OPERATIONS) throw new Error("Too many table recoveries.");
    try {
        for (const table of pending) {
            if (!table.id || !Array.isArray(table.rowTempIds) || table.rowTempIds.length > 100) throw new Error("Invalid table recovery.");
            const rows = await getAllChildren(table.id);
            if (rows.length !== table.rowTempIds.length) throw new Error("Saved table rows changed; reload before saving again.");
            table.rowTempIds.forEach((tempId, index) => { recovered[tempId] = rows[index].id; });
        }
    } catch (error) { error.pendingTables = pending; throw error; }
    const created = await createBlocks(pageId, creates, recovered);
    try {
        const recoveredChanges = creates.filter(item => recovered[item.tempId]).map(item => ({ ...item, id: recovered[item.tempId] }));
        await updateExistingBlocks([...changes, ...recoveredChanges], created);
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
                return response({ error: error?.message || String(error), created: error?.created || {}, pendingTables: error?.pendingTables || [] }, 500);
            }
        }

        return response({ error: "Method not allowed." }, 405);
    } catch (error) {
        return response({ error: error?.message || String(error) }, 500);
    }
};
