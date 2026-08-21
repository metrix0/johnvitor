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

    marker.addEventListener("mousedown", event => event.preventDefault());
    marker.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        const open = children.hidden;
        children.hidden = !open;
        marker.textContent = open ? "▾" : "▸";
        marker.setAttribute("aria-expanded", String(open));
        marker.setAttribute("aria-label", open ? "Collapse toggle" : "Expand toggle");
    });
    return marker;
}

function renderTable(block, wrapper) {
    const table = document.createElement("table");
    table.className = "notion-table";
    table.contentEditable = "false";
    const tbody = document.createElement("tbody");
    for (const row of block.children || []) {
        if (row.type !== "table_row") continue;
        const tr = document.createElement("tr");
        for (const cell of row.table_row?.cells || []) {
            const td = document.createElement("td");
            td.innerHTML = richTextHtml(cell);
            tr.appendChild(td);
        }
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

    if (block.children?.length && block.type !== "table") {
        const children = document.createElement("div");
        children.className = "notion-children";
        children.dataset.childrenOf = block.id;
        for (const child of block.children) children.appendChild(renderBlock(child, block.id));

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
    state.currentTitle = data.title || { property: "", text: PAGE_LABEL };

    content.contentEditable = "true";
    content.spellcheck = true;
    content.setAttribute("role", "textbox");
    content.setAttribute("aria-multiline", "true");

    if (state.currentTitle.property) {
        const title = document.createElement("h1");
        title.className = "page-title";
        title.dataset.pageTitle = "true";
        title.textContent = state.currentTitle.text || PAGE_LABEL;
        content.appendChild(title);
    }

    collectOriginalStructure(data.blocks || []);
    for (const block of data.blocks || []) content.appendChild(renderBlock(block));

    refreshSnapshots();
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

function previousEditable(wrapper) {
    if (!wrapper) return null;
    const editables = visibleEditables();
    const current = wrapper.querySelector('[data-editable="true"]');
    const index = editables.indexOf(current);
    return index > 0 ? editables[index - 1] : null;
}

function nextEditable(wrapper) {
    if (!wrapper) return null;
    const editables = visibleEditables();
    const current = wrapper.querySelector('[data-editable="true"]');
    const index = editables.indexOf(current);
    return index >= 0 && index + 1 < editables.length ? editables[index + 1] : null;
}

function placeCaret(element, atEnd = false, offset = null) {
    if (!element) return;
    content.focus({ preventScroll: true });
    const selection = window.getSelection();
    if (!selection) return;
    const range = document.createRange();

    if (offset !== null) {
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        let remaining = offset;
        let node;
        while ((node = walker.nextNode())) {
            if (remaining <= node.nodeValue.length) {
                range.setStart(node, remaining);
                range.collapse(true);
                selection.removeAllRanges();
                selection.addRange(range);
                return;
            }
            remaining -= node.nodeValue.length;
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
    return before.toString().length;
}

function isCaretAtStart(editable) {
    return selectionOffsetWithin(editable) === 0;
}

function isCaretAtEnd(editable) {
    return selectionOffsetWithin(editable) >= editable.innerText.length;
}

function newBlockTypeAfter(type) {
    if (["bulleted_list_item", "numbered_list_item", "to_do"].includes(type)) return type;
    return "paragraph";
}

function insertLocalBlockAfter(wrapper, type, fragment = null) {
    const id = makeTempId();
    const parentId = wrapper?.dataset.parentId || "";
    const faux = {
        id,
        type,
        [type]: {
            rich_text: [],
            ...(type === "to_do" ? { checked: false } : {})
        },
        children: []
    };
    const newWrapper = renderBlock(faux, parentId);
    newWrapper.dataset.newBlock = "true";
    wrapper.insertAdjacentElement("afterend", newWrapper);
    const editable = newWrapper.querySelector('[data-editable="true"]');
    if (fragment && editable) editable.appendChild(fragment);
    markDirty();
    placeCaret(editable, false);
    return newWrapper;
}

function insertLineBreakAtSelection() {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    range.deleteContents();
    const br = document.createElement("br");
    range.insertNode(br);
    range.setStartAfter(br);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    markDirty();
}

function splitBlockAtSelection(editable) {
    const wrapper = currentWrapperForEditable(editable);
    const selection = window.getSelection();
    if (!wrapper || !selection || !selection.rangeCount) return;

    const range = selection.getRangeAt(0);
    if (!range.collapsed) range.deleteContents();

    const after = document.createRange();
    after.selectNodeContents(editable);
    try {
        after.setStart(range.startContainer, range.startOffset);
    } catch {
        after.setStart(editable, editable.childNodes.length);
    }
    const fragment = after.extractContents();
    editable.normalize();

    const type = newBlockTypeAfter(editable.dataset.type);
    insertLocalBlockAfter(wrapper, type, fragment);
    markDirty();
}

function mergeWithPrevious(editable) {
    const wrapper = currentWrapperForEditable(editable);
    const previous = previousEditable(wrapper);
    if (!wrapper || !previous) return false;

    const boundary = previous.innerText.length;
    while (editable.firstChild) previous.appendChild(editable.firstChild);
    wrapper.remove();
    previous.normalize();
    markDirty();
    placeCaret(previous, false, boundary);
    return true;
}

function mergeWithNext(editable) {
    const wrapper = currentWrapperForEditable(editable);
    const next = nextEditable(wrapper);
    if (!wrapper || !next) return false;

    const nextWrapper = currentWrapperForEditable(next);
    const boundary = editable.innerText.length;
    while (next.firstChild) editable.appendChild(next.firstChild);
    nextWrapper?.remove();
    editable.normalize();
    markDirty();
    placeCaret(editable, false, boundary);
    return true;
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
    image.addEventListener("mousedown", event => event.preventDefault());
    image.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        clearImageSelection();
        state.selectedImage = wrapper;
        wrapper.classList.add("image-selected");
        wrapper.tabIndex = -1;
        wrapper.focus({ preventScroll: true });
    });
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

content.addEventListener("beforeinput", event => {
    if (state.saveInFlight) {
        event.preventDefault();
        return;
    }

    const editable = editableAtCaret();
    if (event.inputType === "insertParagraph" && editable) {
        event.preventDefault();
        if (editable.dataset.type === "code") insertLineBreakAtSelection();
        else splitBlockAtSelection(editable);
        return;
    }

    if (event.inputType === "deleteContentBackward" && editable && window.getSelection()?.isCollapsed && isCaretAtStart(editable)) {
        if (mergeWithPrevious(editable)) {
            event.preventDefault();
            return;
        }
        if (!editable.innerText && currentWrapperForEditable(editable)) {
            const wrapper = currentWrapperForEditable(editable);
            const next = nextEditable(wrapper);
            if (next) {
                event.preventDefault();
                wrapper.remove();
                markDirty();
                placeCaret(next, false);
            }
        }
        return;
    }

    if (event.inputType === "deleteContentForward" && editable && window.getSelection()?.isCollapsed && isCaretAtEnd(editable)) {
        if (mergeWithNext(editable)) event.preventDefault();
    }
});

function ownEditable(wrapper) {
    return Array.from(wrapper.querySelectorAll('[data-editable="true"]'))
        .find(editable => editable.closest(".notion-block") === wrapper) || null;
}

function normalizeEditorStructure() {
    content.querySelectorAll(".notion-block[data-block-type]").forEach(wrapper => {
        const type = wrapper.dataset.blockType;
        if (!editableTypes.has(type)) return;
        if (!ownEditable(wrapper)) wrapper.remove();
    });
}

content.addEventListener("input", () => {
    if (state.saveInFlight) return;
    normalizeEditorStructure();
    markDirty();
});

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
            if (previous && previous.text.content.length + chunk.length <= 2000 &&
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

        const tag = node.tagName.toLowerCase();
        if (tag === "br") {
            pushText("\n", annotations, href);
            return;
        }

        const next = { ...annotations };
        if (tag === "strong" || tag === "b") next.bold = true;
        if (tag === "em" || tag === "i") next.italic = true;
        if (tag === "u") next.underline = true;
        if (tag === "s" || tag === "strike" || tag === "del") next.strikethrough = true;
        if (tag === "code") next.code = true;
        const nextHref = tag === "a" ? (node.getAttribute("href") || href) : href;

        Array.from(node.childNodes).forEach(child => walk(child, next, nextHref));
    }

    Array.from(root.childNodes).forEach(child => walk(child, base));
    return segments;
}

function richSignature(items) {
    return JSON.stringify((items || []).map(item => ({
        content: item.text?.content || "",
        link: item.text?.link?.url || null,
        annotations: item.annotations || {}
    })));
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

function collectPayload() {
    const changes = [];
    const creates = [];
    const deletes = minimalDeletedIds();
    const deletedSet = new Set(deletes);

    content.querySelectorAll('.notion-block[data-block-id]').forEach(wrapper => {
        const id = wrapper.dataset.blockId;
        const editable = ownEditable(wrapper);
        if (!editable || deletedSet.has(id)) return;

        const type = editable.dataset.type;
        const rich_text = serializeEditableRichText(editable);
        const text = editable.innerText.replace(/\r\n/g, "\n");
        let checked;
        if (type === "to_do") checked = Boolean(wrapper.querySelector('input[type="checkbox"]')?.checked);

        if (isTempId(id)) {
            creates.push({
                tempId: id,
                parentId: wrapper.dataset.parentId || "",
                afterId: previousSiblingBlockId(wrapper),
                type,
                text,
                rich_text,
                ...(type === "to_do" ? { checked } : {})
            });
            return;
        }

        const previous = state.snapshots.get(id);
        const currentSignature = richSignature(rich_text);
        if (!previous || previous.text !== text || previous.richSignature !== currentSignature ||
            (type === "to_do" && previous.checked !== checked)) {
            changes.push({ id, type, text, rich_text, ...(type === "to_do" ? { checked } : {}) });
        }
    });

    const titleElement = content.querySelector('[data-page-title="true"]');
    let title = null;
    if (titleElement && state.currentTitle?.property) {
        const text = titleElement.innerText.replace(/\r\n/g, "\n");
        if (text !== state.snapshots.get("__title__")?.text) title = { property: state.currentTitle.property, text };
    }

    return { changes, creates, deletes, title };
}

function applyCreatedMappings(created) {
    if (!created || typeof created !== "object") return;
    for (const [tempId, actualId] of Object.entries(created)) {
        if (!tempId || !actualId) continue;
        const wrapper = content.querySelector(`.notion-block[data-block-id="${CSS.escape(tempId)}"]`);
        if (!wrapper) continue;

        wrapper.dataset.blockId = actualId;
        wrapper.removeAttribute("data-new-block");
        const editable = ownEditable(wrapper);
        if (editable) editable.dataset.id = actualId;
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

    try {
        const result = await api("PUT", payload);
        applyCreatedMappings(result.created);
        refreshBaselineAfterSave();
        state.dirty = false;
        setConnected(true);
        setSaveStatus("Saved");
        toast("Saved", `${PAGE_LABEL} was updated in Notion.`);
    } catch (error) {
        applyCreatedMappings(error.data?.created);
        state.dirty = true;
        setSaveStatus("Save failed");
        toast("Save failed", error.message || String(error));
    } finally {
        state.saveInFlight = false;
        setEditingEnabled(true);
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
    `;
    toolbar.addEventListener("mousedown", event => {
        if (event.target.closest("button[data-format]")) event.preventDefault();
    });
    toolbar.addEventListener("click", event => {
        const button = event.target.closest("button[data-format]");
        if (button) applyFormatting(button.dataset.format);
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

function applyFormatting(format) {
    if (!state.formattingRange || !state.formattingEditables.length) return;
    const pieces = state.formattingEditables
        .map(editable => ({ editable, range: subRangeForEditable(state.formattingRange, editable) }))
        .filter(piece => piece.range);

    for (const { editable, range } of pieces) {
        setDocumentSelection(range);
        if (format === "code") toggleInlineCode(range, editable);
        else document.execCommand(format, false, null);
        editable.normalize();
    }
    markDirty();
    hideFormattingToolbar();
    content.focus({ preventScroll: true });
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
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
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
