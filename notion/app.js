const PAGE = document.body.dataset.page;
const PAGE_LABEL = document.body.dataset.title || PAGE;
const ACCESS_KEY = "ANKI_APP_ACCESS_UNTIL";

const content = document.getElementById("notionContent");
const statusBadge = document.getElementById("statusBadge");
const saveStatus = document.getElementById("saveStatus");
const toastEl = document.getElementById("toast");

let currentTitle = null;
let saveInFlight = false;

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
    const until = Number(localStorage.getItem(ACCESS_KEY) || "0");
    return Date.now() < until;
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

    if (typed.trim() === expected) {
        grantAccessFor1Day();
        return true;
    }

    alert("Wrong password.");
    return false;
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
    toast._timer = setTimeout(() => toastEl.style.display = "none", 3200);
}

function setConnected(connected) {
    statusBadge.textContent = connected ? "Connected" : "Not connected";
    statusBadge.style.color = connected ? "var(--ok)" : "var(--muted)";
}

function setSaveStatus(text) {
    saveStatus.textContent = text;
}

function markDirty() {
    setSaveStatus("Unsaved");
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
        throw error;
    }
    return data;
}

function richTextHtml(items) {
    return (items || []).map(item => {
        let html = escapeHtml(item.plain_text || "");
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

function plainText(block) {
    const value = block?.[block.type];
    return (value?.rich_text || []).map(item => item.plain_text || "").join("");
}

function editableTextElement(block, tagName = "div", className = "") {
    const element = document.createElement(tagName);
    element.className = `editable-text ${className}`.trim();
    element.contentEditable = "true";
    element.spellcheck = true;
    element.dataset.editable = "true";
    element.dataset.id = block.id;
    element.dataset.type = block.type;
    element.dataset.originalText = plainText(block);
    element.innerHTML = richTextHtml(block?.[block.type]?.rich_text);
    element.addEventListener("input", markDirty);
    return element;
}

function fileUrl(value) {
    if (!value) return "";
    if (value.type === "file") return value.file?.url || "";
    if (value.type === "external") return value.external?.url || "";
    return "";
}

function renderTable(block, wrapper) {
    const table = document.createElement("table");
    table.className = "notion-table";
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
    if (block.type === "divider") {
        wrapper.appendChild(document.createElement("hr"));
        return;
    }
    if (block.type === "image") {
        const url = fileUrl(value);
        if (url) {
            const img = document.createElement("img");
            img.className = "notion-image";
            img.src = url;
            img.alt = (value.caption || []).map(item => item.plain_text || "").join("");
            wrapper.appendChild(img);
        }
        return;
    }
    if (block.type === "table") {
        renderTable(block, wrapper);
        return;
    }
    if (["bookmark", "embed", "video", "pdf", "file", "audio"].includes(block.type)) {
        const url = value.url || fileUrl(value);
        if (url) {
            const a = document.createElement("a");
            a.href = url;
            a.target = "_blank";
            a.rel = "noopener noreferrer";
            a.textContent = (value.caption || []).map(item => item.plain_text || "").join("") || url;
            wrapper.appendChild(a);
        }
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

function renderBlock(block, depth = 0) {
    const wrapper = document.createElement("div");
    wrapper.className = `notion-block block-${block.type}`;
    wrapper.dataset.blockId = block.id;
    if (editableTypes.has(block.type)) {
        if (block.type.startsWith("heading_")) {
            const level = Math.min(Number(block.type.split("_")[1]) || 2, 4);
            wrapper.appendChild(editableTextElement(block, `h${level}`, `notion-heading notion-heading-${level}`));
        } else if (block.type === "bulleted_list_item" || block.type === "numbered_list_item") {
            const row = document.createElement("div");
            row.className = "list-row";
            const marker = document.createElement("span");
            marker.className = "list-marker";
            marker.textContent = block.type === "bulleted_list_item" ? "•" : "1.";
            row.append(marker, editableTextElement(block, "div", "list-text"));
            wrapper.appendChild(row);
        } else if (block.type === "to_do") {
            const row = document.createElement("label");
            row.className = "todo-row";
            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.checked = Boolean(block.to_do?.checked);
            checkbox.dataset.todoId = block.id;
            checkbox.dataset.originalChecked = String(checkbox.checked);
            checkbox.addEventListener("change", markDirty);
            row.append(checkbox, editableTextElement(block, "div", "todo-text"));
            wrapper.appendChild(row);
        } else if (block.type === "quote") {
            wrapper.appendChild(editableTextElement(block, "blockquote", "notion-quote"));
        } else if (block.type === "code") {
            wrapper.appendChild(editableTextElement(block, "pre", "notion-code"));
        } else if (block.type === "callout") {
            const row = document.createElement("div");
            row.className = "notion-callout";
            const icon = document.createElement("span");
            icon.textContent = block.callout?.icon?.emoji || "💡";
            row.append(icon, editableTextElement(block, "div", "callout-text"));
            wrapper.appendChild(row);
        } else if (block.type === "toggle") {
            const row = document.createElement("div");
            row.className = "toggle-row";
            const marker = document.createElement("span");
            marker.textContent = "▸";
            row.append(marker, editableTextElement(block, "div", "toggle-text"));
            wrapper.appendChild(row);
        } else {
            wrapper.appendChild(editableTextElement(block, "div", "notion-paragraph"));
        }
    } else {
        renderReadOnly(block, wrapper);
    }
    if (block.children?.length && block.type !== "table") {
        const children = document.createElement("div");
        children.className = "notion-children";
        for (const child of block.children) children.appendChild(renderBlock(child, depth + 1));
        wrapper.appendChild(children);
    }
    return wrapper;
}

function render(data) {
    content.innerHTML = "";
    currentTitle = data.title || { property: "", text: PAGE_LABEL };
    if (currentTitle.property) {
        const title = document.createElement("h1");
        title.className = "page-title";
        title.contentEditable = "true";
        title.spellcheck = true;
        title.dataset.pageTitle = "true";
        title.dataset.originalText = currentTitle.text || "";
        title.textContent = currentTitle.text || PAGE_LABEL;
        title.addEventListener("input", markDirty);
        content.appendChild(title);
    }
    for (const block of data.blocks || []) content.appendChild(renderBlock(block));
    setSaveStatus("Saved");
    content.setAttribute("aria-busy", "false");
}

function collectChanges() {
    const changes = [];
    document.querySelectorAll('[data-editable="true"]').forEach(element => {
        const text = element.innerText.replace(/\r\n/g, "\n");
        const originalText = element.dataset.originalText || "";
        const type = element.dataset.type;
        const id = element.dataset.id;
        let checked;
        if (type === "to_do") {
            const checkbox = document.querySelector(`[data-todo-id="${CSS.escape(id)}"]`);
            checked = Boolean(checkbox?.checked);
            const originalChecked = checkbox?.dataset.originalChecked === "true";
            if (text === originalText && checked === originalChecked) return;
        } else if (text === originalText) {
            return;
        }
        changes.push({ id, type, text, ...(type === "to_do" ? { checked } : {}) });
    });
    const titleElement = document.querySelector("[data-page-title='true']");
    let title = null;
    if (titleElement && currentTitle?.property) {
        const text = titleElement.innerText.replace(/\r\n/g, "\n");
        if (text !== (titleElement.dataset.originalText || "")) title = { property: currentTitle.property, text };
    }
    return { changes, title };
}

function acceptSavedState() {
    document.querySelectorAll('[data-editable="true"]').forEach(element => {
        element.dataset.originalText = element.innerText.replace(/\r\n/g, "\n");
    });
    document.querySelectorAll("[data-todo-id]").forEach(checkbox => {
        checkbox.dataset.originalChecked = String(checkbox.checked);
    });
    const titleElement = document.querySelector("[data-page-title='true']");
    if (titleElement) titleElement.dataset.originalText = titleElement.innerText.replace(/\r\n/g, "\n");
}

async function save() {
    if (saveInFlight) return;
    const payload = collectChanges();
    if (!payload.changes.length && !payload.title) {
        setSaveStatus("Saved");
        toast("Saved", "No changes to write.");
        return;
    }
    saveInFlight = true;
    setSaveStatus("Saving...");
    try {
        await api("PUT", payload);
        acceptSavedState();
        setConnected(true);
        setSaveStatus("Saved");
        toast("Saved", `${PAGE_LABEL} was updated in Notion.`);
    } catch (error) {
        setSaveStatus("Save failed");
        toast("Save failed", error.message || String(error));
    } finally {
        saveInFlight = false;
    }
}

async function load() {
    content.setAttribute("aria-busy", "true");
    setSaveStatus("Loading...");
    try {
        const allowed = await requireExistingPassword();
        if (!allowed) {
            setConnected(false);
            setSaveStatus("");
            content.innerHTML = '<div class="empty">Locked.</div>';
            return;
        }
        const data = await api("GET");
        render(data);
        setConnected(true);
    } catch (error) {
        setConnected(false);
        setSaveStatus("Load failed");
        content.innerHTML = '<div class="empty">Could not load this Notion page.</div>';
        toast("Load failed", error.message || String(error));
    }
}

document.addEventListener("keydown", event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        save();
    }
});

load();
