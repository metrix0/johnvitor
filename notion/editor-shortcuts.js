(() => {
    const editor = document.getElementById("notionContent");
    if (!editor) return;

    function isEditingInsideEditor() {
        const selection = window.getSelection();
        return editor.contains(document.activeElement) || Boolean(selection?.anchorNode && editor.contains(selection.anchorNode));
    }

    document.addEventListener("keydown", event => {
        if (!isEditingInsideEditor()) return;

        const modifier = event.ctrlKey || event.metaKey;
        const key = event.key.toLowerCase();

        if (event.key === "Tab" && !modifier && !event.altKey) {
            event.preventDefault();
            document.execCommand("insertText", false, "\t");
            return;
        }

        if (modifier && key === "z") {
            event.preventDefault();
            document.execCommand(event.shiftKey ? "redo" : "undo", false, null);
        }
    });
})();
