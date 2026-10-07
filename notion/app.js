const PAGE = document.body.dataset.page;
const PAGE_LABEL = document.body.dataset.title || PAGE;
const ACCESS_KEY = "ANKI_APP_ACCESS_UNTIL";
const TEMP_PREFIX = "local-";

const content = document.getElementById("notionContent");
const statusBadge = document.getElementById("statusBadge");
const saveStatus = document.getElementById("saveStatus");
const toastEl = document.getElementById("toast");

const state = {
    currentTitle: null,
    saveInFlight: false,
    dirty: false,
    originalIds: new Set(),
    originalParentById: new Map(),
    snapshots: new Map(),
    blockSnapshots: new Map(),
    pendingTables: [],
    selectedImage: null,
    formattingRange: null,
    formattingEditables: [],
    toolbar: null
};

const editableTypes = new Set([
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

function hasValidAccess() {
    return Date.now() < Number(localStorage.getItem(ACCESS_KEY) || "0");
}

function grantAccessFor1Day() {
    localStorage.setItem(ACCESS_KEY, String(Date.now() + 24 * 60 * 60 * 1000));
}

async function requireExistingPassword() {
    if (hasValidAccess()) return true;

    const response = await fetch("/msg/app.js", { cache: "no-store" });
    if (!response.ok) throw new Error("Could not load the existing password configuration.");

    const source = await response.text();
    const match = source.match(/const API_KEY = "([^"]+)"/);
    const expected = match?.[1]?.slice(-3);
    if (!expected) throw new Error("Could not read the existing password configuration.");

    const typed = prompt("Enter password:");
    if (typed === null) return false;
    if (typed.trim() !== expected) {
        alert("Wrong password.");
        return false;
    }

    grantAccessFor1Day();
    return true;
}

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    }[char]));
}

function toast(title, message) {
    toastEl.innerHTML = `<strong>${escapeHtml(title)}</strong><div class="muted">${escapeHtml(message)}</div>`;
    toastEl.style.display = "block";
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => { toastEl.style.display = "none"; }, 2800);
}

function setConnected(connected) {
    statusBadge.textContent = connected ? "Connected" : "Not connected";
    statusBadge.style.color = connected ? "var(--ok)" : "var(--muted)";
}

function setSaveStatus(text) {
    saveStatus.textContent = text;
}

function markDirty() {
    state.dirty = true;
    if (!state.saveInFlight) setSaveStatus("Unsaved");
}

async function api(method, body) {
    const response = await fetch(`/api/notion?page=${encodeURIComponent(PAGE)}`, {
        method,
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body)
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(data.error || `Request failed (${response.status})`);
        error.status = response.status;
        error.data = data;
        throw error;
    }
    return data;
}

function richTextHtml(items) {
    return (items || []).map(item => {
        let html = escapeHtml(item.plain_text ?? item.text?.content ?? "");
        const annotations = item.annotations || {};
        if (annotations.code) html = `<code>${html}</code>`;
        if (annotations.bold) html = `<strong>${html}</strong>`;
        if (annotations.italic) html = `<em>${html}</em>`;
        if (annotations.underline) html = `<u>${html}</u>`;
        if (annotations.strikethrough) html = `<s>${html}</s>`;
        if (item.type === "mention" || item.type === "equation") {
            html = `<span data-notion-rich="${escapeHtml(JSON.stringify(item))}" contenteditable="false">${html}</span>`;
        }
        if (annotations.color && annotations.color !== "default") html = `<span data-notion-color="${escapeHtml(annotations.color)}">${html}</span>`;
        const href = item.href || item.text?.link?.url;
        if (href) html = `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${html}</a>`;
        return html;
    }).join("");
}

function fileUrl(value) {
    if (!value) return "";
    if (value.type === "file") return value.file?.url || "";
    if (value.type === "external") return value.external?.url || "";
    return "";
}

function makeTempId() {
    if (globalThis.crypto?.randomUUID) return `${TEMP_PREFIX}${crypto.randomUUID()}`;
    return `${TEMP_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function isTempId(id) {
    return typeof id === "string" && id.startsWith(TEMP_PREFIX);
}

function directChildByClass(wrapper, className) {
    return Array.from(wrapper.children).find(child => child.classList?.contains(className)) || null;
}

function makeEditable(block, tagName = "div", className = "") {
    const element = document.createElement(tagName);
    element.className = `editable-text ${className}`.trim();
    element.dataset.editable = "true";
    element.dataset.id = block.id;
    element.dataset.type = block.type;
    element.contentEditable = 'true';
    element.dataset.placeholder = "Type / for commands";
    element.spellcheck = true;
    element.innerHTML = richTextHtml(block?.[block.type]?.rich_text);
    return element;
}

function makeToggleMarker(children) {
    const marker = document.createElement("button");
    marker.type = "button";
    marker.className = "toggle-marker";
    marker.contentEditable = "false";
    marker.setAttribute("aria-expanded", "false");
    marker.setAttribute("aria-label", "Expand toggle");
    marker.textContent = "▸";
    children.hidden = true;

    return marker;
}

function renderTable(block, wrapper) {
    const table = document.createElement("table");
    table.className = "notion-table";
    const tbody = document.createElement("tbody");
    for (const row of block.children || []) {
        if (row.type !== "table_row") continue;
        const tr = document.createElement("tr");
        tr.className = "notion-block block-table_row";
        tr.dataset.blockId = row.id;
        tr.dataset.blockType = "table_row";
        tr.dataset.parentId = block.id;
        tr.dataset.blockValue = JSON.stringify(row.table_row);
        (row.table_row?.cells || []).forEach((cell, index) => {
            const td = document.createElement("td");
            td.dataset.editable = "true";
            td.dataset.id = row.id;
            td.dataset.type = "table_row";
            td.dataset.cell = index;
            td.contentEditable = "true";
            td.innerHTML = richTextHtml(cell);
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    wrapper.appendChild(table);
}

function renderReadOnly(block, wrapper) {
    const value = block?.[block.type] || {};
    wrapper.contentEditable = "false";

    if (block.type === "divider") {
        wrapper.appendChild(document.createElement("hr"));
        return;
    }
    if (block.type === "image") {
        const url = fileUrl(value);
        if (!url) return;
        const img = document.createElement("img");
        img.className = "notion-image";
        img.src = url;
        img.alt = (value.caption || []).map(item => item.plain_text || "").join("");
        img.draggable = false;
        wrapper.appendChild(img);
        bindImage(wrapper, img);
        return;
    }
    if (block.type === "table") {
        renderTable(block, wrapper);
        return;
    }
    if (["bookmark", "embed", "video", "pdf", "file", "audio"].includes(block.type)) {
        const url = value.url || fileUrl(value);
        if (!url) return;
        const a = document.createElement("a");
        a.href = url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent = (value.caption || []).map(item => item.plain_text || "").join("") || url;
        wrapper.appendChild(a);
        return;
    }
    if (block.type === "child_page") {
        const label = document.createElement("div");
        label.className = "read-only-block";
        label.textContent = value.title || "Subpage";
        wrapper.appendChild(label);
        return;
    }
    if (block.type === "equation") {
        const pre = document.createElement("pre");
        pre.className = "notion-code";
        pre.textContent = value.expression || "";
        wrapper.appendChild(pre);
        return;
    }
    if (!block.children?.length) {
        const label = document.createElement("div");
        label.className = "read-only-block muted";
        label.textContent = `[${block.type}]`;
        wrapper.appendChild(label);
    }
}

function renderBlock(block, parentId = "") {
    const wrapper = document.createElement("div");
    wrapper.className = `notion-block block-${block.type}`;
    wrapper.dataset.blockId = block.id;
    wrapper.dataset.blockType = block.type;
    wrapper.dataset.parentId = parentId || "";
    const blockValue = { ...(block[block.type] || {}) };
    delete blockValue.children;
    wrapper.dataset.blockValue = JSON.stringify(blockValue);
    if (isTempId(block.id)) wrapper.dataset.newBlock = "true";

    if (editableTypes.has(block.type)) {
        const value = block?.[block.type] || {};
        if (block.type.startsWith("heading_")) {
            const level = Math.min(Number(block.type.split("_")[1]) || 2, 4);
            const heading = makeEditable(block, `h${level}`, `notion-heading notion-heading-${level}`);
            if (block.children?.length && value.is_toggleable !== false) {
                const row = document.createElement("div");
                row.className = "toggle-row";
                row.appendChild(heading);
                wrapper.appendChild(row);
            } else {
                wrapper.appendChild(heading);
            }
        } else if (block.type === "bulleted_list_item" || block.type === "numbered_list_item") {
            const row = document.createElement("div");
            row.className = "list-row";
            const marker = document.createElement("span");
            marker.className = "list-marker";
            marker.contentEditable = "false";
            marker.textContent = block.type === "bulleted_list_item" ? "•" : "1.";
            row.append(marker, makeEditable(block, "div", "list-text"));
            wrapper.appendChild(row);
        } else if (block.type === "to_do") {
            const row = document.createElement("div");
            row.className = "todo-row";
            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.contentEditable = "false";
            checkbox.checked = Boolean(value.checked);
            checkbox.dataset.todoId = block.id;
            checkbox.addEventListener("change", markDirty);
            row.append(checkbox, makeEditable(block, "div", "todo-text"));
            wrapper.appendChild(row);
        } else if (block.type === "quote") {
            wrapper.appendChild(makeEditable(block, "blockquote", "notion-quote"));
        } else if (block.type === "code") {
            wrapper.appendChild(makeEditable(block, "pre", "notion-code"));
        } else if (block.type === "callout") {
            const row = document.createElement("div");
            row.className = "notion-callout";
            const icon = document.createElement("span");
            icon.contentEditable = "false";
            icon.textContent = value.icon?.emoji || "💡";
            row.append(icon, makeEditable(block, "div", "callout-text"));
            wrapper.appendChild(row);
        } else if (block.type === "toggle") {
            const row = document.createElement("div");
            row.className = "toggle-row";
            row.appendChild(makeEditable(block, "div", "toggle-text"));
            wrapper.appendChild(row);
        } else {
            wrapper.appendChild(makeEditable(block, "div", "notion-paragraph"));
        }
    } else {
        renderReadOnly(block, wrapper);
    }

    if ((block.children?.length || block.type === "toggle" || block[block.type]?.is_toggleable) && block.type !== "table") {
        const children = document.createElement("div");
        children.className = "notion-children";
        children.dataset.childrenOf = block.id;
        for (const child of block.children || []) children.appendChild(renderBlock(child, block.id));

        const row = directChildByClass(wrapper, "toggle-row");
        const value = block?.[block.type] || {};
        if (row && (block.type === "toggle" || (block.type.startsWith("heading_") && value.is_toggleable !== false))) {
            row.insertBefore(makeToggleMarker(children), row.firstChild);
        }
        wrapper.appendChild(children);
    }

    return wrapper;
}

function collectOriginalStructure(blocks, parentId = "") {
    for (const block of blocks || []) {
        state.originalIds.add(block.id);
        state.originalParentById.set(block.id, parentId || "");
        collectOriginalStructure(block.children, block.id);
    }
}

function render(data) {
    content.innerHTML = "";
    state.originalIds.clear();
    state.originalParentById.clear();
    state.snapshots.clear();
    state.selectedImage = null;
    state.pendingTables = [];
    state.currentTitle = data.title || { property: "", text: PAGE_LABEL };

    content.contentEditable = "true";
    content.spellcheck = true;
    content.setAttribute("role", "textbox");
    content.setAttribute("aria-multiline", "true");

    if (state.currentTitle.property) {
        const title = document.createElement("h1");
        title.className = "page-title";
        title.dataset.pageTitle = "true";
        title.contentEditable = 'true';
        title.textContent = state.currentTitle.text || PAGE_LABEL;
        content.appendChild(title);
    }

    collectOriginalStructure(data.blocks || []);
    for (const block of data.blocks || []) content.appendChild(renderBlock(block));

    refreshSnapshots();
    document.dispatchEvent(new Event("notion:render"));
    state.dirty = false;
    setSaveStatus("Saved");
    content.setAttribute("aria-busy", "false");
}

function closestEditableForNode(node) {
    if (!node) return null;
    const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    return element?.closest?.('[data-editable="true"]') || null;
}

function editableAtCaret() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !selection.isCollapsed) return null;
    return closestEditableForNode(selection.focusNode || selection.anchorNode);
}

function currentWrapperForEditable(editable) {
    return editable?.closest?.(".notion-block") || null;
}

function visibleEditables() {
    return Array.from(content.querySelectorAll('[data-editable="true"]')).filter(editable => {
        const hiddenParent = editable.closest("[hidden]");
        return !hiddenParent;
    });
}

function placeCaret(element, atEnd = false, offset = null) {
    if (!element) return;
    content.focus({ preventScroll: true });
    const selection = window.getSelection();
    if (!selection) return;
    const range = document.createRange();

    if (offset !== null) {
        let remaining = offset, point = null;
        function visit(node) {
            if (point || node.dataset?.softBreakTail) return;
            if (node.nodeType === Node.TEXT_NODE) {
                if (remaining <= node.length) point = [node, remaining];
                else remaining -= node.length;
            } else if (node.nodeName === 'BR') {
                remaining--;
                if (remaining <= 0) point = [node.parentNode, Array.from(node.parentNode.childNodes).indexOf(node) + 1];
            } else if (node.dataset?.notionRich) {
                const value = JSON.parse(node.dataset.notionRich);
                remaining -= (value.plain_text || value.equation?.expression || '').length;
                if (remaining <= 0) point = [node.parentNode, Array.from(node.parentNode.childNodes).indexOf(node) + 1];
            } else Array.from(node.childNodes).forEach(visit);
        }
        Array.from(element.childNodes).forEach(visit);
        if (point) {
            range.setStart(...point); range.collapse(true);
            selection.removeAllRanges(); selection.addRange(range); return;
        }
    }

    range.selectNodeContents(element);
    range.collapse(!atEnd);
    selection.removeAllRanges();
    selection.addRange(range);
}

function selectionOffsetWithin(editable) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return 0;
    const range = selection.getRangeAt(0);
    const before = document.createRange();
    before.selectNodeContents(editable);
    try {
        before.setEnd(range.startContainer, range.startOffset);
    } catch {
        return 0;
    }
    const holder = document.createElement('div');
    holder.appendChild(before.cloneContents());
    return serializeEditableRichText(holder).reduce((length, item) => length + (item.text?.content || item.plain_text || item.equation?.expression || '').length, 0);
}

function isCaretAtStart(editable) {
    return selectionOffsetWithin(editable) === 0;
}

function isCaretAtEnd(editable) {
    const length = serializeEditableRichText(editable).reduce((n, item) => n + (item.text?.content || item.plain_text || item.equation?.expression || '').length, 0);
    return selectionOffsetWithin(editable) >= length;
}

function newBlockTypeAfter(type) {
    if (["bulleted_list_item", "numbered_list_item", "to_do"].includes(type)) return type;
    return "paragraph";
}

function clearImageSelection() {
    if (!state.selectedImage) return;
    state.selectedImage.classList.remove("image-selected");
    state.selectedImage = null;
}

function bindImage(wrapper, image) {
    wrapper.contentEditable = "false";
    image.contentEditable = "false";
    image.style.cursor = "pointer";

}

function removeSelectedImage() {
    if (!state.selectedImage) return false;
    const wrapper = state.selectedImage;
    clearImageSelection();
    wrapper.remove();
    markDirty();
    content.focus({ preventScroll: true });
    return true;
}

content.addEventListener("click", event => {
    if (state.selectedImage && !state.selectedImage.contains(event.target)) clearImageSelection();
});

function ownEditable(wrapper) {
    return Array.from(wrapper.querySelectorAll('[data-editable="true"]'))
        .find(editable => editable.closest(".notion-block") === wrapper) || null;
}

function sameAnnotations(a, b) {
    return a.bold === b.bold && a.italic === b.italic && a.strikethrough === b.strikethrough &&
        a.underline === b.underline && a.code === b.code && a.color === b.color;
}

function serializeEditableRichText(root) {
    const segments = [];
    const base = { bold: false, italic: false, strikethrough: false, underline: false, code: false, color: "default" };

    function pushText(text, annotations, href = null) {
        if (!text) return;
        let value = text.replace(/\u00a0/g, " ");
        while (value.length) {
            const chunk = value.slice(0, 2000);
            value = value.slice(2000);
            const previous = segments[segments.length - 1];
            if (previous?.type === 'text' && previous.text.content.length + chunk.length <= 2000 &&
                (previous.text.link?.url || null) === href && sameAnnotations(previous.annotations, annotations)) {
                previous.text.content += chunk;
            } else {
                segments.push({
                    type: "text",
                    text: { content: chunk, ...(href ? { link: { url: href } } : {}) },
                    annotations: { ...annotations }
                });
            }
        }
    }

    function walk(node, annotations, href = null) {
        if (node.nodeType === Node.TEXT_NODE) {
            pushText(node.nodeValue || "", annotations, href);
            return;
        }
        if (node.nodeType !== Node.ELEMENT_NODE) return;

        if (node.dataset.notionRich) {
            const original = JSON.parse(node.dataset.notionRich);
            segments.push(original);
            return;
        }
        if (node.dataset.softBreakTail) return;
        const tag = node.tagName.toLowerCase();
        if (tag === "br") {
            pushText("\n", annotations, href);
            return;
        }

        const next = { ...annotations };
        if (node.dataset.notionColor) next.color = node.dataset.notionColor;
        if (tag === "strong" || tag === "b") next.bold = true;
        if (tag === "em" || tag === "i") next.italic = true;
        if (tag === "u") next.underline = true;
        if (tag === "s" || tag === "strike" || tag === "del") next.strikethrough = true;
        if (tag === "code") next.code = true;
        const nextHref = tag === "a" ? (node.getAttribute("href") || href) : href;

        if ((tag === "div" || tag === "p") && node.previousSibling) pushText("\n", annotations, href);
        Array.from(node.childNodes).forEach(child => walk(child, next, nextHref));
    }

    Array.from(root.childNodes).forEach(child => walk(child, base));
    return segments;
}

function richSignature(items) {
    return JSON.stringify(items || []);
}

function snapshotForEditable(editable) {
    const id = editable.dataset.id;
    const type = editable.dataset.type;
    let checked;
    if (type === "to_do") {
        checked = Boolean(content.querySelector(`[data-todo-id="${CSS.escape(id)}"]`)?.checked);
    }
    const rich = serializeEditableRichText(editable);
    return { type, text: editable.innerText.replace(/\r\n/g, "\n"), richSignature: richSignature(rich), checked };
}

function refreshSnapshots() {
    state.snapshots.clear();
    state.blockSnapshots.clear();
    content.querySelectorAll(".notion-block[data-block-id]").forEach(wrapper => {
        if (!isTempId(wrapper.dataset.blockId)) state.blockSnapshots.set(wrapper.dataset.blockId, JSON.stringify(valueForWrapper(wrapper)));
    });
    content.querySelectorAll('[data-editable="true"]').forEach(editable => {
        if (!isTempId(editable.dataset.id)) state.snapshots.set(editable.dataset.id, snapshotForEditable(editable));
    });
    const title = content.querySelector('[data-page-title="true"]');
    if (title) state.snapshots.set("__title__", { text: title.innerText.replace(/\r\n/g, "\n") });
}

function minimalDeletedIds() {
    const present = new Set(Array.from(content.querySelectorAll(".notion-block[data-block-id]"))
        .map(wrapper => wrapper.dataset.blockId)
        .filter(id => id && !isTempId(id)));
    const missing = new Set(Array.from(state.originalIds).filter(id => !present.has(id)));
    const deletes = [];

    for (const id of missing) {
        let parent = state.originalParentById.get(id) || "";
        let coveredByMissingAncestor = false;
        while (parent) {
            if (missing.has(parent)) {
                coveredByMissingAncestor = true;
                break;
            }
            parent = state.originalParentById.get(parent) || "";
        }
        if (!coveredByMissingAncestor) deletes.push(id);
    }
    return deletes;
}

function previousSiblingBlockId(wrapper) {
    let sibling = wrapper.previousElementSibling;
    while (sibling) {
        if (sibling.matches?.(".notion-block[data-block-id]")) return sibling.dataset.blockId || "";
        sibling = sibling.previousElementSibling;
    }
    return "";
}

function valueForWrapper(wrapper) {
    const type = wrapper.dataset.blockType;
    const value = JSON.parse(wrapper.dataset.blockValue || "{}");
    const editable = ownEditable(wrapper);
    if (editable && type !== "table_row") value.rich_text = serializeEditableRichText(editable);
    if (type === "to_do") value.checked = Boolean(wrapper.querySelector('input[type="checkbox"]')?.checked);
    if (type === "table_row") value.cells = Array.from(wrapper.querySelectorAll("td")).map(serializeEditableRichText);
    return value;
}

function collectPayload() {
    const changes = [], creates = [];
    const deletes = minimalDeletedIds();
    content.querySelectorAll('.notion-block[data-block-id]').forEach(wrapper => {
        const id = wrapper.dataset.blockId;
        const type = wrapper.dataset.blockType;
        const value = valueForWrapper(wrapper);
        if (isTempId(id)) {
            creates.push({ tempId: id, parentId: wrapper.dataset.parentId || "", afterId: previousSiblingBlockId(wrapper), type, value });
        } else if (state.blockSnapshots.get(id) !== JSON.stringify(value)) {
            changes.push({ id, type, value });
        }
    });
    const titleElement = content.querySelector('[data-page-title="true"]');
    let title = null;
    if (titleElement && state.currentTitle?.property) {
        const text = titleElement.innerText.replace(/\r\n/g, "\n");
        if (text !== state.snapshots.get("__title__")?.text) title = { property: state.currentTitle.property, text };
    }
    return { changes, creates, deletes, title, pendingTables: state.pendingTables };
}

function applyCreatedMappings(created) {
    if (!created || typeof created !== "object") return;
    for (const [tempId, actualId] of Object.entries(created)) {
        if (!tempId || !actualId) continue;
        const wrapper = content.querySelector(`.notion-block[data-block-id="${CSS.escape(tempId)}"]`);
        if (!wrapper) continue;

        wrapper.dataset.blockId = actualId;
        wrapper.removeAttribute("data-new-block");
        wrapper.querySelectorAll('[data-id]').forEach(editable => {
            if (editable.dataset.id === tempId) editable.dataset.id = actualId;
        });
        const checkbox = wrapper.querySelector('[data-todo-id]');
        if (checkbox) checkbox.dataset.todoId = actualId;

        content.querySelectorAll(`[data-parent-id="${CSS.escape(tempId)}"]`).forEach(child => {
            child.dataset.parentId = actualId;
        });
        const childContainer = content.querySelector(`[data-children-of="${CSS.escape(tempId)}"]`);
        if (childContainer) childContainer.dataset.childrenOf = actualId;
    }
}

function refreshBaselineAfterSave() {
    state.originalIds = new Set(Array.from(content.querySelectorAll(".notion-block[data-block-id]"))
        .map(wrapper => wrapper.dataset.blockId)
        .filter(id => id && !isTempId(id)));
    state.originalParentById.clear();
    content.querySelectorAll(".notion-block[data-block-id]").forEach(wrapper => {
        const id = wrapper.dataset.blockId;
        if (!id || isTempId(id)) return;
        state.originalParentById.set(id, wrapper.dataset.parentId || "");
    });
    refreshSnapshots();
}

function setEditingEnabled(enabled) {
    content.querySelectorAll('input, button').forEach(control => { control.disabled = !enabled; });
    content.querySelectorAll('td[data-editable]').forEach(cell => { cell.contentEditable = String(enabled); });
    content.querySelectorAll('[data-editable], [data-page-title]').forEach(editable => { editable.contentEditable = String(enabled); });
    if (enabled) {
        content.contentEditable = "true";
        content.removeAttribute("aria-disabled");
    } else {
        content.contentEditable = "false";
        content.setAttribute("aria-disabled", "true");
    }
}

async function save() {
    if (state.saveInFlight) return;
    const payload = collectPayload();
    if (!payload.changes.length && !payload.creates.length && !payload.deletes.length && !payload.title) {
        state.dirty = false;
        setSaveStatus("Saved");
        toast("Saved", "No changes to write.");
        return;
    }

    state.saveInFlight = true;
    setSaveStatus("Saving...");
    hideFormattingToolbar();
    clearImageSelection();
    setEditingEnabled(false);
    let savedMappings = null;

    try {
        const result = await api("PUT", payload);
        applyCreatedMappings(result.created);
        refreshBaselineAfterSave();
        state.pendingTables = [];
        state.dirty = false;
        savedMappings = result.created || {};
        setConnected(true);
        setSaveStatus("Saved");
        toast("Saved", `${PAGE_LABEL} was updated in Notion.`);
    } catch (error) {
        applyCreatedMappings(error.data?.created);
        state.pendingTables = error.data?.pendingTables || state.pendingTables;
        state.dirty = true;
        setSaveStatus("Save failed");
        toast("Save failed", error.message || String(error));
    } finally {
        state.saveInFlight = false;
        setEditingEnabled(true);
        if (savedMappings) document.dispatchEvent(new CustomEvent("notion:saved", { detail: savedMappings }));
    }
}

function selectedEditablesForRange(range) {
    if (!range || range.collapsed) return [];
    return Array.from(content.querySelectorAll('[data-editable="true"]')).filter(editable => {
        try { return range.intersectsNode(editable); } catch { return false; }
    });
}

function subRangeForEditable(fullRange, editable) {
    if (!fullRange || !editable) return null;
    try {
        const range = document.createRange();
        range.selectNodeContents(editable);
        if (editable.contains(fullRange.startContainer)) range.setStart(fullRange.startContainer, fullRange.startOffset);
        if (editable.contains(fullRange.endContainer)) range.setEnd(fullRange.endContainer, fullRange.endOffset);
        return range.collapsed ? null : range;
    } catch {
        return null;
    }
}

function ensureFormattingToolbar() {
    if (state.toolbar) return state.toolbar;
    const toolbar = document.createElement("div");
    toolbar.className = "notion-format-toolbar";
    toolbar.hidden = true;
    toolbar.contentEditable = "false";
    toolbar.innerHTML = `
        <button type="button" data-format="bold" aria-label="Bold"><strong>B</strong></button>
        <button type="button" data-format="italic" aria-label="Italic"><em>I</em></button>
        <button type="button" data-format="underline" aria-label="Underline"><u>U</u></button>
        <button type="button" data-format="strikeThrough" aria-label="Strikethrough"><s>S</s></button>
        <button type="button" data-format="code" aria-label="Code"><code>&lt;/&gt;</code></button>
        <button type="button" data-format="link" aria-label="Link" title="Add link">↗</button>
        <button type="button" data-format="color" aria-label="Text color" title="Text color">A</button>
    `;
    toolbar.addEventListener("mousedown", event => {
        if (event.target.closest("button[data-format]")) event.preventDefault();
    });
    document.body.appendChild(toolbar);
    state.toolbar = toolbar;
    return toolbar;
}

function hideFormattingToolbar() {
    if (state.toolbar) state.toolbar.hidden = true;
    state.formattingRange = null;
    state.formattingEditables = [];
}

function updateFormattingToolbar() {
    if (state.saveInFlight) return hideFormattingToolbar();
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount || selection.isCollapsed) return hideFormattingToolbar();
    const range = selection.getRangeAt(0);
    if (!content.contains(range.commonAncestorContainer)) return hideFormattingToolbar();

    const editables = selectedEditablesForRange(range);
    if (!editables.length) return hideFormattingToolbar();

    const toolbar = ensureFormattingToolbar();
    state.formattingRange = range.cloneRange();
    state.formattingEditables = editables;
    const rects = Array.from(range.getClientRects());
    const rect = rects[0] || range.getBoundingClientRect();
    if (!rect || (!rect.width && !rect.height)) return hideFormattingToolbar();

    toolbar.hidden = false;
    const box = toolbar.getBoundingClientRect();
    toolbar.style.left = `${Math.max(8, Math.min(window.innerWidth - box.width - 8, rect.left + rect.width / 2 - box.width / 2))}px`;
    toolbar.style.top = `${Math.max(8, rect.top - box.height - 8)}px`;
}

function setDocumentSelection(range) {
    const selection = window.getSelection();
    if (!selection || !range) return;
    selection.removeAllRanges();
    selection.addRange(range);
}

function toggleInlineCode(range, editable) {
    const common = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
        ? range.commonAncestorContainer : range.commonAncestorContainer.parentElement;
    const existing = common?.closest?.("code");
    if (existing && editable.contains(existing)) {
        const parent = existing.parentNode;
        while (existing.firstChild) parent.insertBefore(existing.firstChild, existing);
        existing.remove();
        return;
    }
    const code = document.createElement("code");
    try {
        range.surroundContents(code);
    } catch {
        const fragment = range.extractContents();
        code.appendChild(fragment);
        range.insertNode(code);
    }
}

document.addEventListener("selectionchange", () => requestAnimationFrame(updateFormattingToolbar));
window.addEventListener("scroll", () => { if (state.toolbar && !state.toolbar.hidden) updateFormattingToolbar(); }, true);
window.addEventListener("resize", () => { if (state.toolbar && !state.toolbar.hidden) updateFormattingToolbar(); });

function deleteSelectionIfImage(event) {
    if (!state.selectedImage) return false;
    if (event.key !== "Backspace" && event.key !== "Delete") return false;
    event.preventDefault();
    return removeSelectedImage();
}

document.addEventListener("keydown", event => {
    if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === "s") {
        event.preventDefault();
        save();
        return;
    }
    if (event.key === "Escape") {
        clearImageSelection();
        hideFormattingToolbar();
        return;
    }
    deleteSelectionIfImage(event);
});

window.addEventListener("beforeunload", event => {
    if (!state.dirty) return;
    event.preventDefault();
    event.returnValue = "";
});

async function load() {
    content.setAttribute("aria-busy", "true");
    setSaveStatus("Loading...");
    try {
        const allowed = await requireExistingPassword();
        if (!allowed) {
            setConnected(false);
            setSaveStatus("");
            content.contentEditable = "false";
            content.innerHTML = '<div class="empty">Locked.</div>';
            return;
        }
        const data = await api("GET");
        render(data);
        setConnected(true);
    } catch (error) {
        setConnected(false);
        setSaveStatus("Load failed");
        content.contentEditable = "false";
        content.innerHTML = '<div class="empty">Could not load this Notion page.</div>';
        toast("Load failed", error.message || String(error));
    }
}

load();
