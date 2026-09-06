(() => {
    const editor = document.getElementById("notionContent");
    if (!editor) return;

    const recreatableTypes = new Set([
        "paragraph",
        "bulleted_list_item",
        "numbered_list_item",
        "to_do"
    ]);

    const nestableParentTypes = new Set([
        "paragraph",
        "bulleted_list_item",
        "numbered_list_item",
        "to_do",
        "toggle",
        "quote",
        "callout"
    ]);

    function isEditingInsideEditor() {
        const selection = window.getSelection();
        return editor.contains(document.activeElement) || Boolean(selection?.anchorNode && editor.contains(selection.anchorNode));
    }

    function editableAtSelection() {
        const selection = window.getSelection();
        if (!selection?.anchorNode) return null;
        const element = selection.anchorNode.nodeType === Node.ELEMENT_NODE
            ? selection.anchorNode
            : selection.anchorNode.parentElement;
        return element?.closest?.('[data-editable="true"]') || null;
    }

    function ownEditable(wrapper) {
        return Array.from(wrapper.querySelectorAll('[data-editable="true"]'))
            .find(editable => editable.closest(".notion-block") === wrapper) || null;
    }

    function directChildrenContainer(wrapper) {
        return Array.from(wrapper.children)
            .find(child => child.classList?.contains("notion-children")) || null;
    }

    function previousSiblingBlock(wrapper) {
        let sibling = wrapper.previousElementSibling;
        while (sibling) {
            if (sibling.matches?.(".notion-block[data-block-id]")) return sibling;
            sibling = sibling.previousElementSibling;
        }
        return null;
    }

    function canNestUnder(wrapper) {
        const type = wrapper?.dataset.blockType || "";
        if (nestableParentTypes.has(type)) return true;
        if (type.startsWith("heading_")) {
            return Boolean(directChildrenContainer(wrapper) || wrapper.querySelector(":scope > .toggle-row > .toggle-marker"));
        }
        return false;
    }

    function prepareExistingBlockForMove(wrapper) {
        const id = wrapper?.dataset.blockId || "";
        if (!id || id.startsWith("local-")) return true;

        const children = directChildrenContainer(wrapper);
        if (children?.querySelector(":scope > .notion-block[data-block-id]")) return false;
        if (!recreatableTypes.has(wrapper.dataset.blockType || "")) return false;

        const editable = ownEditable(wrapper);
        if (!editable) return false;

        const tempId = typeof makeTempId === "function"
            ? makeTempId()
            : `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;

        wrapper.dataset.originalBlockId = id;
        wrapper.dataset.originalParentId = wrapper.dataset.parentId || "";
        wrapper.dataset.blockId = tempId;
        wrapper.dataset.newBlock = "true";
        editable.dataset.id = tempId;

        const checkbox = wrapper.querySelector('[data-todo-id]');
        if (checkbox) checkbox.dataset.todoId = tempId;
        return true;
    }

    function restoreOriginalIdIfReturned(wrapper) {
        const originalId = wrapper.dataset.originalBlockId;
        if (!originalId || (wrapper.dataset.parentId || "") !== (wrapper.dataset.originalParentId || "")) return;

        wrapper.dataset.blockId = originalId;
        wrapper.removeAttribute("data-new-block");
        wrapper.removeAttribute("data-original-block-id");
        wrapper.removeAttribute("data-original-parent-id");

        const editable = ownEditable(wrapper);
        if (editable) editable.dataset.id = originalId;
        const checkbox = wrapper.querySelector('[data-todo-id]');
        if (checkbox) checkbox.dataset.todoId = originalId;
    }

    function ensureChildrenContainer(parentWrapper) {
        let children = directChildrenContainer(parentWrapper);
        if (!children) {
            children = document.createElement("div");
            children.className = "notion-children";
            children.dataset.childrenOf = parentWrapper.dataset.blockId || "";
            parentWrapper.appendChild(children);

            if (parentWrapper.dataset.blockType === "toggle" && typeof makeToggleMarker === "function") {
                const row = Array.from(parentWrapper.children)
                    .find(child => child.classList?.contains("toggle-row"));
                if (row && !row.querySelector(":scope > .toggle-marker")) {
                    row.insertBefore(makeToggleMarker(children), row.firstChild);
                }
            }
        }

        children.hidden = false;
        const marker = parentWrapper.querySelector(":scope > .toggle-row > .toggle-marker");
        if (marker) {
            marker.textContent = "▾";
            marker.setAttribute("aria-expanded", "true");
            marker.setAttribute("aria-label", "Collapse toggle");
        }
        return children;
    }

    function cleanupEmptyChildren(parentWrapper, children) {
        if (children.querySelector(":scope > .notion-block[data-block-id]")) return;
        children.remove();
        parentWrapper.querySelector(":scope > .toggle-row > .toggle-marker")?.remove();
    }

    function indentBlock(editable) {
        const wrapper = editable?.closest?.(".notion-block[data-block-id]");
        if (!wrapper) return false;

        const previous = previousSiblingBlock(wrapper);
        if (!previous || !canNestUnder(previous) || !prepareExistingBlockForMove(wrapper)) return false;

        const offset = typeof selectionOffsetWithin === "function" ? selectionOffsetWithin(editable) : null;
        const children = ensureChildrenContainer(previous);
        children.appendChild(wrapper);
        wrapper.dataset.parentId = previous.dataset.blockId || "";
        restoreOriginalIdIfReturned(wrapper);

        if (typeof markDirty === "function") markDirty();
        if (typeof placeCaret === "function") placeCaret(editable, false, offset);
        return true;
    }

    function outdentBlock(editable) {
        const wrapper = editable?.closest?.(".notion-block[data-block-id]");
        const children = wrapper?.parentElement;
        if (!wrapper || !children?.classList?.contains("notion-children")) return false;

        const parentWrapper = children.closest(".notion-block[data-block-id]");
        if (!parentWrapper || !prepareExistingBlockForMove(wrapper)) return false;

        const offset = typeof selectionOffsetWithin === "function" ? selectionOffsetWithin(editable) : null;
        parentWrapper.insertAdjacentElement("afterend", wrapper);
        wrapper.dataset.parentId = parentWrapper.dataset.parentId || "";
        cleanupEmptyChildren(parentWrapper, children);
        restoreOriginalIdIfReturned(wrapper);

        if (typeof markDirty === "function") markDirty();
        if (typeof placeCaret === "function") placeCaret(editable, false, offset);
        return true;
    }

    document.addEventListener("keydown", event => {
        if (!isEditingInsideEditor()) return;

        const modifier = event.ctrlKey || event.metaKey;
        const key = event.key.toLowerCase();

        if (event.key === "Tab" && !modifier && !event.altKey) {
            const editable = editableAtSelection();
            if (!editable) return;
            event.preventDefault();
            if (event.shiftKey) outdentBlock(editable);
            else indentBlock(editable);
            return;
        }

        if (modifier && key === "z") {
            event.preventDefault();
            document.execCommand(event.shiftKey ? "redo" : "undo", false, null);
        }
    });
})();
