let safeSelectionAnchor = null;
let safeSelectionStartEditable = null;
let safeCrossBlockSelection = false;
let safeContentEditableState = [];

function saveContentEditableState() {
    safeContentEditableState = Array.from(document.querySelectorAll('[data-editable="true"]')).map(element => ({
        element,
        value: element.getAttribute("contenteditable")
    }));
}

function setEditablesTemporarilyReadOnly() {
    saveContentEditableState();
    safeContentEditableState.forEach(({ element }) => element.setAttribute("contenteditable", "false"));
}

function restoreContentEditableState() {
    safeContentEditableState.forEach(({ element, value }) => {
        if (!element.isConnected) return;
        if (value === null) element.removeAttribute("contenteditable");
        else element.setAttribute("contenteditable", value);
    });
    safeContentEditableState = [];
}

function resetSafeSelection() {
    safeSelectionAnchor = null;
    safeSelectionStartEditable = null;
    safeCrossBlockSelection = false;
}

document.addEventListener("mousedown", event => {
    if (event.button !== 0 || event.target.closest(".notion-format-toolbar")) return;

    const point = caretPointFromClient(event.clientX, event.clientY);
    const editable = pointInsideEditable(point);
    if (!editable) {
        resetSafeSelection();
        return;
    }

    safeSelectionAnchor = point;
    safeSelectionStartEditable = editable;
    safeCrossBlockSelection = false;

    // Let the browser handle ordinary selection/focus, but prevent the older
    // cross-block mouse handler from also trying to control this gesture.
    event.stopImmediatePropagation();
});

document.addEventListener("mousemove", event => {
    if (!safeSelectionAnchor || !(event.buttons & 1)) return;

    const point = caretPointFromClient(event.clientX, event.clientY);
    const editable = pointInsideEditable(point);
    if (!editable) {
        event.stopImmediatePropagation();
        return;
    }

    // Inside the starting block, leave selection entirely to the browser.
    if (!safeCrossBlockSelection && editable === safeSelectionStartEditable) {
        event.stopImmediatePropagation();
        return;
    }

    if (!safeCrossBlockSelection) {
        safeCrossBlockSelection = true;
        setEditablesTemporarilyReadOnly();
    }

    const range = rangeFromPoints(safeSelectionAnchor, point);
    if (!range) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    setDocumentSelection(range);
    requestAnimationFrame(updateFormattingToolbar);
});

document.addEventListener("mouseup", event => {
    if (!safeSelectionAnchor) return;

    const preserved = safeCrossBlockSelection && window.getSelection()?.rangeCount
        ? window.getSelection().getRangeAt(0).cloneRange()
        : null;

    if (safeCrossBlockSelection) restoreContentEditableState();
    resetSafeSelection();
    event.stopImmediatePropagation();

    requestAnimationFrame(() => {
        if (preserved) setDocumentSelection(preserved);
        updateFormattingToolbar();
    });
});
