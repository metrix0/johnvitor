const nativeEditorRoot = document.getElementById("notionContent");

function syncNativeEditor() {
    if (!nativeEditorRoot) return;

    const editableParts = nativeEditorRoot.querySelectorAll('[data-editable="true"], [data-page-title="true"]');
    if (!editableParts.length) return;

    // One editing host for the entire Notion page. This is the key difference
    // between Enter-separated Notion blocks and separate contenteditable islands:
    // native browser selection can now cross from one block into the next.
    nativeEditorRoot.setAttribute("contenteditable", "true");
    nativeEditorRoot.setAttribute("spellcheck", "true");

    editableParts.forEach(element => {
        element.removeAttribute("contenteditable");
    });

    // UI/read-only pieces stay outside the editing model while text around them
    // remains part of the same selection surface.
    nativeEditorRoot.querySelectorAll([
        ".list-marker",
        ".toggle-marker",
        ".notion-image",
        ".notion-table",
        ".block-divider hr",
        "input[type='checkbox']"
    ].join(",")).forEach(element => {
        element.setAttribute("contenteditable", "false");
    });
}

if (nativeEditorRoot) {
    nativeEditorRoot.addEventListener("input", markDirty);

    const nativeEditorObserver = new MutationObserver(() => syncNativeEditor());
    nativeEditorObserver.observe(nativeEditorRoot, { childList: true, subtree: true });
    syncNativeEditor();
}
