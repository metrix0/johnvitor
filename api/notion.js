const NOTION_VERSION = "2026-03-11";

function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-store"
        }
    });
}

function pageIdFor(name) {
    if (name === "engravida") return process.env.NOTION_ENGRAVIDA_PAGE_ID || "";
    if (name === "imenu") return process.env.NOTION_IMENU_PAGE_ID || "";
    return "";
}

async function notionFetch(path, options = {}) {
    const token = process.env.NOTION_TOKEN || "";
    if (!token) throw new Error("NOTION_TOKEN is not configured.");

    const response = await fetch(`https://api.notion.com/v1${path}`, {
        ...options,
        headers: {
            "Authorization": `Bearer ${token}`,
            "Notion-Version": NOTION_VERSION,
            "Content-Type": "application/json",
            ...(options.headers || {})
        }
    });

    if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(`Notion ${response.status}: ${body.slice(0, 500)}`);
    }

    return response.json();
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
        parts.push({
            type: "text",
            text: { content: text.slice(start, start + 2000) }
        });
    }
    return parts;
}

const EDITABLE_TYPES = new Set([
    "paragraph",
    "heading_1",
    "heading_2",
    "heading_3",
    "heading_4",
    "bulleted_list_item",
    "numbered_list_item",
    "quote",
    "to_do",
    "toggle",
    "callout",
    "code"
]);

async function saveChanges(pageId, payload) {
    const changes = Array.isArray(payload.changes) ? payload.changes : [];

    for (const change of changes) {
        if (!change || !change.id || !EDITABLE_TYPES.has(change.type)) continue;

        const blockValue = { rich_text: richTextFromPlainText(change.text) };
        if (change.type === "to_do" && typeof change.checked === "boolean") {
            blockValue.checked = change.checked;
        }

        await notionFetch(`/blocks/${encodeURIComponent(change.id)}`, {
            method: "PATCH",
            body: JSON.stringify({ [change.type]: blockValue })
        });
    }

    if (payload.title && payload.title.property) {
        await notionFetch(`/pages/${encodeURIComponent(pageId)}`, {
            method: "PATCH",
            body: JSON.stringify({
                properties: {
                    [payload.title.property]: {
                        title: richTextFromPlainText(payload.title.text)
                    }
                }
            })
        });
    }
}

export default {
    async fetch(request) {
        try {
            const url = new URL(request.url);
            const pageName = url.searchParams.get("page") || "";
            const pageId = pageIdFor(pageName);
            if (!pageId) return json({ error: "Page is not configured." }, 404);

            if (request.method === "GET") {
                const [page, blocks] = await Promise.all([
                    notionFetch(`/pages/${encodeURIComponent(pageId)}`),
                    getAllChildren(pageId)
                ]);
                return json({ page: pageName, title: pageTitleInfo(page), blocks });
            }

            if (request.method === "PUT") {
                const body = await request.json().catch(() => ({}));
                await saveChanges(pageId, body);
                return json({ ok: true });
            }

            return json({ error: "Method not allowed." }, 405);
        } catch (error) {
            return json({ error: error?.message || String(error) }, 500);
        }
    }
};
