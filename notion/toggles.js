const deletedNotionBlockIds = new Set();
let selectedNotionImageWrapper = null;

function directChildByClass(wrapper, className) {
    return Array.from(wrapper.children).find(child => child.classList?.contains(className)) || null;
}

function bindNotionToggles(root = document) {
    root.querySelectorAll(".block-toggle, .block-heading_1, .block-heading_2, .block-heading_3, .block-heading_4").forEach(wrapper => {
        if (wrapper.dataset.toggleBound === "true") return;

        const children = directChildByClass(wrapper, "notion-children");
        if (!children) return;

        let row = directChildByClass(wrapper, "toggle-row");
        if (!row) {
            const heading = Array.from(wrapper.children).find(child => child.classList?.contains("notion-heading"));
            if (!heading) return;
            row = document.createElement("div");
            row.className = "toggle-row";
            wrapper.insertBefore(row, heading);
            row.appendChild(heading);
        }

        let marker = row.querySelector(".toggle-marker");
        if (!marker) {
            marker = document.createElement("span");
            marker.className = "toggle-marker";
            row.insertBefore(marker, row.firstChild);
        }

        wrapper.dataset.toggleBound = "true";
        marker.setAttribute("role", "button");
        marker.setAttribute("tabindex", "0");
        marker.setAttribute("aria-expanded", "false");
        marker.setAttribute("aria-label", "Expand toggle");
        marker.textContent = "▸";
        children.hidden = true;

        const toggle = () => {
            const open = children.hidden;
            children.hidden = !open;
            marker.textContent = open ? "▾" : "▸";
            marker.setAttribute("aria-expanded", String(open));
            marker.setAttribute("aria-label", open ? "Collapse toggle" : "Expand toggle");
        };

        marker.addEventListener("click", event => {
            event.preventDefault();
            event.stopPropagation();
            toggle();
        });

        marker.addEventListener("keydown", event => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                toggle();
            }
        });
    });
}

function clearSelectedNotionImage() {
    if (!selectedNotionImageWrapper) return;
    const image = selectedNotionImageWrapper.querySelector(".notion-image");
    if (image) {
        image.style.outline = "";
        image.style.outlineOffset = "";
    }
    selectedNotionImageWrapper.removeAttribute("data-image-selected");
    selectedNotionImageWrapper = null;
}

function selectNotionImage(wrapper) {
    if (selectedNotionImageWrapper === wrapper) return;
    clearSelectedNotionImage();
    selectedNotionImageWrapper = wrapper;
    wrapper.dataset.imageSelected = "true";
    wrapper.tabIndex = -1;
    const image = wrapper.querySelector(".notion-image");
    if (image) {
        image.style.outline = "2px solid var(--accent)";
        image.style.outlineOffset = "3px";
    }
    wrapper.focus({ preventScroll: true });
}

function bindNotionImages(root = document) {
    root.querySelectorAll(".block-image").forEach(wrapper => {
        if (wrapper.dataset.imageDeleteBound === "true") return;
        const image = wrapper.querySelector(".notion-image");
        if (!image) return;

        wrapper.dataset.imageDeleteBound = "true";
        image.style.cursor = "pointer";
        image.addEventListener("click", event => {
            event.preventDefault();
            event.stopPropagation();
            selectNotionImage(wrapper);
        });
    });
}

function focusNearestEditable(wrapper) {
    const editables = Array.from(document.querySelectorAll('[data-editable="true"]'));
    const index = editables.findIndex(element => element.closest(".notion-block") === wrapper);
    const next = editables[index - 1] || editables[index + 1];
    if (!next) return;

    next.focus();
    const selection = window.getSelection();
    if (!selection) return;
    const range = document.createRange();
    range.selectNodeContents(next);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
}

function markBlockDeleted(wrapper, blockId) {
    if (!wrapper || !blockId) return false;
    deletedNotionBlockIds.add(blockId);
    wrapper.remove();
    markDirty();
    return true;
}

document.addEventListener("click", event => {
    if (selectedNotionImageWrapper && !selectedNotionImageWrapper.contains(event.target)) {
        clearSelectedNotionImage();
    }
});

document.addEventListener("keydown", event => {
    if ((event.key === "Backspace" || event.key === "Delete") && selectedNotionImageWrapper) {
        const wrapper = selectedNotionImageWrapper;
        const blockId = wrapper.dataset.blockId;
        event.preventDefault();
        clearSelectedNotionImage();
        markBlockDeleted(wrapper, blockId);
        return;
    }

    if (event.key !== "Backspace") return;

    const editable = event.target.closest?.('[data-editable="true"]');
    if (!editable) return;
    if (editable.innerText.replace(/[\r\n]/g, "") !== "") return;

    const wrapper = editable.closest(".notion-block");
    const blockId = editable.dataset.id;
    if (!wrapper || !blockId) return;

    event.preventDefault();
    focusNearestEditable(wrapper);
    markBlockDeleted(wrapper, blockId);
});

const originalCollectChanges = collectChanges;
collectChanges = function() {
    const payload = originalCollectChanges();
    payload.deletes = Array.from(deletedNotionBlockIds);
    return payload;
};

const originalAcceptSavedState = acceptSavedState;
acceptSavedState = function() {
    originalAcceptSavedState();
    deletedNotionBlockIds.clear();
};

save = async function() {
    if (saveInFlight) return;
    const payload = collectChanges();
    if (!payload.changes.length && !payload.title && !payload.deletes.length) {
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
};

bindNotionToggles();
bindNotionImages();

const notionContent = document.getElementById("notionContent");
if (notionContent) {
    const observer = new MutationObserver(() => {
        bindNotionToggles(notionContent);
        bindNotionImages(notionContent);
    });
    observer.observe(notionContent, { childList: true, subtree: true });
}
