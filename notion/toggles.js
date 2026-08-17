function bindNotionToggles(root = document) {
    root.querySelectorAll(".block-toggle").forEach(wrapper => {
        if (wrapper.dataset.toggleBound === "true") return;

        const row = wrapper.querySelector(":scope > .toggle-row");
        const children = wrapper.querySelector(":scope > .notion-children");
        if (!row || !children) return;

        const marker = row.firstElementChild;
        if (!marker) return;

        wrapper.dataset.toggleBound = "true";
        marker.classList.add("toggle-marker");
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

bindNotionToggles();

const notionContent = document.getElementById("notionContent");
if (notionContent) {
    const observer = new MutationObserver(() => bindNotionToggles(notionContent));
    observer.observe(notionContent, { childList: true, subtree: true });
}
