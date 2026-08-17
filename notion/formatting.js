const formattingDirtyBlockIds = new Set();
let formattingRange = null;
let formattingEditables = [];

const formattingToolbar = document.createElement("div");
formattingToolbar.className = "notion-format-toolbar";
formattingToolbar.hidden = true;
formattingToolbar.innerHTML = `
    <button type="button" data-format="bold" aria-label="Bold"><strong>B</strong></button>
    <button type="button" data-format="italic" aria-label="Italic"><em>I</em></button>
    <button type="button" data-format="underline" aria-label="Underline"><u>U</u></button>
    <button type="button" data-format="strikeThrough" aria-label="Strikethrough"><s>S</s></button>
    <button type="button" data-format="code" aria-label="Code"><code>&lt;/&gt;</code></button>
`;
document.body.appendChild(formattingToolbar);

function closestEditableForNode(node) {
    if (!node) return null;
    const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    return element?.closest?.('[data-editable="true"]') || null;
}

function selectedEditablesForRange(range) {
    if (!range || range.collapsed) return [];
    return Array.from(document.querySelectorAll('[data-editable="true"]')).filter(editable => {
        try {
            return range.intersectsNode(editable);
        } catch {
            return false;
        }
    });
}

function currentFormattingSelection() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;

    const range = selection.getRangeAt(0);
    const startEditable = closestEditableForNode(range.startContainer);
    const endEditable = closestEditableForNode(range.endContainer);
    if (!startEditable || !endEditable) return null;

    const editables = selectedEditablesForRange(range);
    if (!editables.length) return null;
    return { range, editables };
}

function subRangeForEditable(fullRange, editable) {
    if (!fullRange || !editable) return null;
    try {
        const range = document.createRange();
        range.selectNodeContents(editable);

        if (editable.contains(fullRange.startContainer)) {
            range.setStart(fullRange.startContainer, fullRange.startOffset);
        }
        if (editable.contains(fullRange.endContainer)) {
            range.setEnd(fullRange.endContainer, fullRange.endOffset);
        }

        return range.collapsed ? null : range;
    } catch {
        return null;
    }
}

function setDocumentSelection(range) {
    if (!range) return;
    const selection = window.getSelection();
    if (!selection) return;
    selection.removeAllRanges();
    selection.addRange(range);
}

function updateFormattingToolbar() {
    const current = currentFormattingSelection();
    if (!current) {
        formattingToolbar.hidden = true;
        formattingRange = null;
        formattingEditables = [];
        return;
    }

    formattingRange = current.range.cloneRange();
    formattingEditables = current.editables;

    const rects = Array.from(formattingRange.getClientRects());
    const rect = rects[0] || formattingRange.getBoundingClientRect();
    if (!rect || (!rect.width && !rect.height)) {
        formattingToolbar.hidden = true;
        return;
    }

    formattingToolbar.hidden = false;
    const toolbarRect = formattingToolbar.getBoundingClientRect();
    const left = Math.max(8, Math.min(
        window.innerWidth - toolbarRect.width - 8,
        rect.left + rect.width / 2 - toolbarRect.width / 2
    ));
    const top = Math.max(8, rect.top - toolbarRect.height - 8);

    formattingToolbar.style.left = `${left}px`;
    formattingToolbar.style.top = `${top}px`;
}

function markFormattingDirty(editable) {
    const blockId = editable?.dataset?.id;
    if (blockId) formattingDirtyBlockIds.add(blockId);
    markDirty();
}

function toggleInlineCode(range, editable) {
    const common = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
        ? range.commonAncestorContainer
        : range.commonAncestorContainer.parentElement;
    const existingCode = common?.closest?.("code");

    if (existingCode && editable.contains(existingCode)) {
        const parent = existingCode.parentNode;
        while (existingCode.firstChild) parent.insertBefore(existingCode.firstChild, existingCode);
        existingCode.remove();
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

function applyFormattingAcrossSelection(format) {
    if (!formattingRange || !formattingEditables.length) return;

    const pieces = formattingEditables
        .map(editable => ({ editable, range: subRangeForEditable(formattingRange, editable) }))
        .filter(piece => piece.range);

    for (const { editable, range } of pieces) {
        setDocumentSelection(range);
        if (format === "code") {
            toggleInlineCode(range, editable);
        } else {
            document.execCommand(format, false, null);
        }
        editable.normalize();
        markFormattingDirty(editable);
    }

    formattingToolbar.hidden = true;
    formattingRange = null;
    formattingEditables = [];
}

formattingToolbar.addEventListener("mousedown", event => {
    if (event.target.closest("button[data-format]")) event.preventDefault();
});

formattingToolbar.addEventListener("click", event => {
    const button = event.target.closest("button[data-format]");
    if (!button) return;
    applyFormattingAcrossSelection(button.dataset.format);
});

function sameAnnotations(a, b) {
    return a.bold === b.bold &&
        a.italic === b.italic &&
        a.strikethrough === b.strikethrough &&
        a.underline === b.underline &&
        a.code === b.code &&
        a.color === b.color;
}

function serializeEditableRichText(root) {
    const segments = [];
    const base = {
        bold: false,
        italic: false,
        strikethrough: false,
        underline: false,
        code: false,
        color: "default"
    };

    function pushText(text, annotations, href = null) {
        if (!text) return;
        let value = text.replace(/\u00a0/g, " ");
        while (value.length) {
            const chunk = value.slice(0, 2000);
            value = value.slice(2000);
            const previous = segments[segments.length - 1];
            if (
                previous &&
                previous.text.content.length + chunk.length <= 2000 &&
                previous.text.link?.url === (href || undefined) &&
                sameAnnotations(previous.annotations, annotations)
            ) {
                previous.text.content += chunk;
            } else {
                segments.push({
                    type: "text",
                    text: {
                        content: chunk,
                        ...(href ? { link: { url: href } } : {})
                    },
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
        const isBlock = node !== root && (tag === "div" || tag === "p");
        if (isBlock && segments.length) {
            const last = segments[segments.length - 1];
            if (!last.text.content.endsWith("\n")) pushText("\n", annotations, href);
        }

        Array.from(node.childNodes).forEach(child => walk(child, next, nextHref));
    }

    Array.from(root.childNodes).forEach(child => walk(child, base));
    return segments;
}

const collectChangesBeforeFormatting = collectChanges;
collectChanges = function() {
    const payload = collectChangesBeforeFormatting();
    const byId = new Map((payload.changes || []).map(change => [change.id, change]));

    document.querySelectorAll('[data-editable="true"]').forEach(editable => {
        const id = editable.dataset.id;
        if (!id) return;

        const existing = byId.get(id);
        if (!existing && !formattingDirtyBlockIds.has(id)) return;

        const type = editable.dataset.type;
        let checked;
        if (type === "to_do") {
            const checkbox = document.querySelector(`[data-todo-id="${CSS.escape(id)}"]`);
            checked = Boolean(checkbox?.checked);
        }

        byId.set(id, {
            ...(existing || {}),
            id,
            type,
            text: editable.innerText.replace(/\r\n/g, "\n"),
            rich_text: serializeEditableRichText(editable),
            ...(type === "to_do" ? { checked } : {})
        });
    });

    payload.changes = Array.from(byId.values());
    return payload;
};

const acceptSavedStateBeforeFormatting = acceptSavedState;
acceptSavedState = function() {
    acceptSavedStateBeforeFormatting();
    formattingDirtyBlockIds.clear();
};

document.addEventListener("selectionchange", () => {
    requestAnimationFrame(updateFormattingToolbar);
});

window.addEventListener("scroll", () => {
    if (!formattingToolbar.hidden) updateFormattingToolbar();
}, true);

window.addEventListener("resize", () => {
    if (!formattingToolbar.hidden) updateFormattingToolbar();
});
