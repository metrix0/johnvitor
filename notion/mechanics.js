/* Block operations are transactions. The browser only edits inline content;
 * it never gets to delete/reparent the wrappers that identify Notion blocks. */
(() => {
    const root = content;
    const selector = '.notion-block[data-block-id]';
    const supported = new Set([...editableTypes].filter(type => type !== 'heading_4').concat([
        'divider', 'table', 'table_row', 'image', 'bookmark', 'embed', 'video', 'pdf', 'file', 'audio', 'equation'
    ]));
    const selections = new Set();
    let anchor = null, focusBlock = null, drag = null, restoring = false, composing = false;
    let history = [], historyIndex = -1, lastInput = 0, inputGroup = '';
    let menu = null, menuTarget = null, menuQuery = '', menuIndex = 0, menuOptions = [];
    let slashRange = null, colorRange = null;
    const colors = ['default','gray','brown','orange','yellow','green','blue','purple','pink','red'];
    const blockTypes = [
        ['Text', 'paragraph', 'text plain'], ['Heading 1', 'heading_1', 'h1 #'],
        ['Heading 2', 'heading_2', 'h2 ##'], ['Heading 3', 'heading_3', 'h3 ###'],
        ['Bulleted list', 'bulleted_list_item', 'bullet unordered'],
        ['Numbered list', 'numbered_list_item', 'num ordered'], ['To-do list', 'to_do', 'todo checkbox'],
        ['Toggle list', 'toggle', 'toggle'], ['Quote', 'quote', 'quote'],
        ['Callout', 'callout', 'callout'], ['Code', 'code', 'code'], ['Divider', 'divider', 'div line'],
        ['Table', 'table', 'table'], ['Image', 'image', 'image'], ['Bookmark', 'bookmark', 'book link'],
        ['Embed', 'embed', 'embed'], ['Equation', 'equation', 'math latex']
    ];

    function block(node) { return (node?.nodeType === 1 ? node : node?.parentElement)?.closest(selector); }
    function editable(node) { return closestEditableForNode(node); }
    function current() {
        const selection = getSelection();
        return editable(selection?.focusNode) || editable(document.activeElement);
    }
    function visibleBlocks() {
        return Array.from(root.querySelectorAll(selector)).filter(w => !w.closest('[hidden]') && w.dataset.blockType !== 'table_row');
    }
    function selectedRoots() {
        return Array.from(root.querySelectorAll(selector)).filter(w => selections.has(w.dataset.blockId) &&
            !w.parentElement.closest('.block-selected'));
    }
    function textLength(el) { return serializeEditableRichText(el).reduce((n, r) => n + (r.text?.content || r.plain_text || r.equation?.expression || '').length, 0); }
    function clearSelection() {
        selections.clear();
        root.querySelectorAll('.block-selected').forEach(w => w.classList.remove('block-selected'));
        focusBlock = null;
    }
    function select(w, extend = false, toggle = false) {
        if (!w) return;
        if (!extend && !toggle) clearSelection();
        const list = visibleBlocks();
        if (extend && anchor && list.includes(anchor)) {
            const a = list.indexOf(anchor), b = list.indexOf(w);
            selections.clear();
            list.slice(Math.min(a, b), Math.max(a, b) + 1).forEach(x => selections.add(x.dataset.blockId));
        } else if (toggle && selections.has(w.dataset.blockId)) selections.delete(w.dataset.blockId);
        else selections.add(w.dataset.blockId);
        if (!extend) anchor = w;
        focusBlock = w;
        root.querySelectorAll(selector).forEach(x => x.classList.toggle('block-selected', selections.has(x.dataset.blockId)));
        getSelection()?.removeAllRanges();
        root.focus({ preventScroll: true });
        hideFormattingToolbar();
    }
    function pathTo(node) {
        const path = [];
        while (node && node !== root) {
            path.unshift(Array.prototype.indexOf.call(node.parentNode.childNodes, node));
            node = node.parentNode;
        }
        return node === root ? path : null;
    }
    function nodeAt(path) { return path?.reduce((n, i) => n?.childNodes[i], root); }
    function capture() {
        const s = getSelection();
        const copy = root.cloneNode(true);
        root.querySelectorAll('input[type="checkbox"]').forEach((checkbox, index) => {
            copy.querySelectorAll('input[type="checkbox"]')[index].toggleAttribute('checked', checkbox.checked);
        });
        return { html: copy.innerHTML, selected: [...selections],
            caret: s?.rangeCount ? { a: pathTo(s.anchorNode), ao: s.anchorOffset, f: pathTo(s.focusNode), fo: s.focusOffset } : null };
    }
    function record(group = '') {
        if (restoring) return;
        const snap = capture();
        if (history[historyIndex]?.html === snap.html) {
            history[historyIndex] = snap;
            return;
        }
        const grouped = group && group === inputGroup && Date.now() - lastInput < 650 && historyIndex > 0;
        history.splice(historyIndex + 1);
        if (grouped) history[historyIndex] = snap;
        else { history.push(snap); historyIndex++; }
        if (history.length > 150) { history.shift(); historyIndex--; }
        inputGroup = group;
        lastInput = Date.now();
    }
    function restore(snap) {
        restoring = true;
        root.innerHTML = snap.html;
        clearSelection();
        // A block deleted in an earlier successful save must be recreated when undone.
        for (const w of root.querySelectorAll(selector)) {
            if (!isTempId(w.dataset.blockId) && !state.originalIds.has(w.dataset.blockId)) remapTree(w);
        }
        hydrate();
        root.focus({ preventScroll: true });
        const s = getSelection(), c = snap.caret;
        if (c) {
            const a = nodeAt(c.a), f = nodeAt(c.f);
            if (a && f) {
                root.focus({ preventScroll: true });
                try { s.setBaseAndExtent(a, c.ao, f, c.fo); } catch { /* fallback below */ }
            }
        }
        for (const id of snap.selected) {
            const w = root.querySelector(`[data-block-id="${CSS.escape(id)}"]`);
            if (w) select(w, false, true);
        }
        restoring = false;
        markDirty();
    }
    function undo(redo = false) {
        const next = historyIndex + (redo ? 1 : -1);
        if (next < 0 || next >= history.length) return;
        historyIndex = next;
        restore(history[next]);
        inputGroup = '';
    }
    function transact(fn) {
        if (state.saveInFlight || composing) return;
        record();
        inputGroup = '';
        fn();
        ensureBlock();
        hydrate();
        markDirty();
        record();
        inputGroup = '';
    }
    function writable(w) {
        return [w, ...w.querySelectorAll(selector)].every(x => {
            if (!supported.has(x.dataset.blockType)) return false;
            const v = valueForWrapper(x);
            // Notion-hosted files cannot be recreated as external URLs: those URLs expire.
            return v.type !== 'file' && v.type !== 'file_upload' && (!v.icon || ['emoji','external'].includes(v.icon.type));
        });
    }
    function remapTree(w) {
        const items = [w, ...w.querySelectorAll(selector)], ids = new Map();
        items.forEach(x => ids.set(x.dataset.blockId, makeTempId()));
        items.forEach(x => {
            const old = x.dataset.blockId, id = ids.get(old);
            x.dataset.blockId = id;
            x.dataset.newBlock = 'true';
            if (ids.has(x.dataset.parentId)) x.dataset.parentId = ids.get(x.dataset.parentId);
            for (const e of x.querySelectorAll('[data-id]')) if (e.dataset.id === old) e.dataset.id = id;
            for (const e of x.querySelectorAll('[data-todo-id]')) if (e.dataset.todoId === old) e.dataset.todoId = id;
            for (const e of x.querySelectorAll('[data-children-of]')) if (e.dataset.childrenOf === old) e.dataset.childrenOf = id;
            if (selections.delete(old)) selections.add(id);
        });
    }
    function prepareMove(w) {
        if (!writable(w)) {
            toast('Cannot move this block', 'Notion’s API cannot recreate this block without losing its data.');
            return false;
        }
        remapTree(w);
        return true;
    }
    function newBlock(type = 'paragraph', value = {}, parentId = '') {
        const id = makeTempId();
        return renderBlock({ id, type, [type]: { rich_text: [], ...value }, children: [] }, parentId);
    }
    function ensureBlock() {
        if (!root.querySelector(selector)) root.appendChild(newBlock());
    }
    function childrenContainer(w) {
        let c = directChildByClass(w, 'notion-children');
        if (!c) {
            c = document.createElement('div'); c.className = 'notion-children';
            c.dataset.childrenOf = w.dataset.blockId; w.appendChild(c);
        }
        c.hidden = false;
        return c;
    }
    function canNest(w) {
        return ['paragraph', 'bulleted_list_item', 'numbered_list_item', 'to_do', 'toggle', 'quote', 'callout'].includes(w?.dataset.blockType) ||
            /^heading_[123]$/.test(w?.dataset.blockType || '') && JSON.parse(w.dataset.blockValue || '{}').is_toggleable;
    }
    function nest(w, out = false) {
        if (!w || w.dataset.blockType === 'table_row') return;
        const parent = w.parentElement.closest(selector), previous = w.previousElementSibling;
        if (out) {
            if (!parent || !w.parentElement.classList.contains('notion-children') || !prepareMove(w)) return;
            parent.after(w); w.dataset.parentId = parent.dataset.parentId || '';
        } else {
            if (!previous?.matches(selector) || !canNest(previous) || !prepareMove(w)) return;
            childrenContainer(previous).appendChild(w); w.dataset.parentId = previous.dataset.blockId;
        }
    }
    function convert(w, type, value = {}) {
        if (!w || w.dataset.blockType === 'table_row') return;
        const oldType = w.dataset.blockType;
        const c = directChildByClass(w, 'notion-children');
        const rich_text = ownEditable(w) ? serializeEditableRichText(ownEditable(w)) : [];
        if (c?.querySelector(selector) && !canNest({ dataset: { blockType: type, blockValue: JSON.stringify(value) } })) {
            toast('Keep nested blocks', 'Move the nested blocks out before changing to this block type.'); return;
        }
        if (!writable(w)) { toast('Cannot convert this block', 'This block must be changed in Notion.'); return; }
        const replacement = newBlock(type, { rich_text, ...value }, w.dataset.parentId);
        if (type === 'divider') replacement.dataset.blockValue = '{}';
        if (c?.children.length) {
            const target = childrenContainer(replacement);
            while (c.firstChild) target.appendChild(c.firstChild);
            // Recreate the complete subtree before deleting the old parent.
            remapTree(replacement);
            Array.from(target.children).forEach(x => x.dataset.parentId = replacement.dataset.blockId);
        }
        if (selections.delete(w.dataset.blockId)) selections.add(replacement.dataset.blockId);
        w.replaceWith(replacement);
        hydrate();
        if (ownEditable(replacement)) placeCaret(ownEditable(replacement), true);
        else select(replacement);
        return replacement;
    }
    function split(e) {
        const w = block(e), s = getSelection();
        if (!w || !s.rangeCount) return;
        deleteTextSelection();
        const type = w.dataset.blockType;
        if (!textLength(e) && ['bulleted_list_item', 'numbered_list_item', 'to_do', 'quote'].includes(type)) {
            if (w.parentElement.classList.contains('notion-children')) {
                nest(w, true); placeCaret(e, false);
            } else convert(w, 'paragraph');
            return;
        }
        const range = s.getRangeAt(0), tail = document.createRange();
        tail.selectNodeContents(e); tail.setStart(range.startContainer, range.startOffset);
        const fragment = tail.extractContents();
        const nextType = newBlockTypeAfter(type);
        const next = newBlock(nextType, {}, w.dataset.parentId);
        const nextE = ownEditable(next); nextE.appendChild(fragment);
        if (type === 'toggle' && !directChildByClass(w, 'notion-children')?.hidden) {
            childrenContainer(w).prepend(next); next.dataset.parentId = w.dataset.blockId;
        } else w.after(next);
        placeCaret(nextE, false);
    }
    function softBreak(e) {
        deleteTextSelection();
        // Use the browser's inline line-break operation: it positions the caret
        // on the new visual line, including an otherwise empty final line.
        document.execCommand('insertLineBreak', false, null);
        const tail = e.lastChild;
        if (tail?.nodeName === 'BR' && tail.previousSibling?.nodeName === 'BR') tail.dataset.softBreakTail = 'true';
    }
    function rangeEditables() {
        const s = getSelection();
        if (!s?.rangeCount) return [];
        const r = s.getRangeAt(0);
        return Array.from(root.querySelectorAll('[data-editable="true"], [data-page-title="true"]')).filter(e => {
            if (e.closest('[hidden]')) return false;
            try { return r.intersectsNode(e); } catch { return false; }
        });
    }
    function deleteTextSelection() {
        const s = getSelection();
        if (!s?.rangeCount || s.isCollapsed) return false;
        const r = s.getRangeAt(0);
        if (!root.contains(r.startContainer) || !root.contains(r.endContainer)) return false;
        const first = editable(r.startContainer) || (r.startContainer.nodeType === 1 ? r.startContainer : r.startContainer.parentElement)?.closest('[data-page-title]');
        const last = editable(r.endContainer) || (r.endContainer.nodeType === 1 ? r.endContainer : r.endContainer.parentElement)?.closest('[data-page-title]');
        if (!first || !last) return false;
        if (first === last) { r.deleteContents(); return true; }
        // Table cell selection clears each cell; it must not delete the table DOM.
        const pieces = rangeEditables();
        if (pieces.some(e => e.dataset.type === 'table_row') || pieces.some(e => e.dataset.pageTitle)) {
            pieces.forEach(e => subRangeForEditable(r, e)?.deleteContents());
            placeCaret(first, true); return true;
        }
        const firstW = block(first), lastW = block(last);
        if (!firstW || !lastW) return false;
        const nonText = Array.from(root.querySelectorAll(selector)).filter(w => {
            if (w === firstW || w.contains(firstW) || ownEditable(w)) return false;
            try { return r.intersectsNode(w); } catch { return false; }
        });
        const boundary = document.createRange(); boundary.selectNodeContents(first); boundary.setEnd(r.startContainer, r.startOffset);
        const prefix = boundary.cloneContents();
        const rest = document.createRange(); rest.selectNodeContents(last); rest.setStart(r.endContainer, r.endOffset);
        const suffix = rest.cloneContents();
        const holder = document.createElement('div'); holder.appendChild(prefix.cloneNode(true));
        const offset = textLength(holder);
        // Preserve children outside the selection before removing their selected parent.
        for (const e of pieces.slice(1)) {
            const w = block(e), c = directChildByClass(w, 'notion-children');
            if (c) {
                const keep = Array.from(c.children).filter(child => !pieces.some(p => block(p) === child));
                for (const child of keep.reverse()) {
                    if (!writable(child)) { toast('Selection includes a protected block', 'Change this selection in Notion to preserve its content.'); return false; }
                }
            }
        }
        for (const e of pieces.slice(1)) {
            const w = block(e), c = directChildByClass(w, 'notion-children');
            if (c) for (const child of Array.from(c.children).reverse()) {
                if (!pieces.some(p => block(p) === child)) {
                    remapTree(child); w.after(child); child.dataset.parentId = w.dataset.parentId || '';
                }
            }
            if (w !== firstW) w.remove();
        }
        // Include selected non-text blocks (dividers/media) between endpoints.
        nonText.forEach(w => w.remove());
        first.replaceChildren(prefix, suffix); placeCaret(first, false, offset);
        return true;
    }
    function merge(e, forward = false) {
        const w = block(e), list = visibleBlocks(), i = list.indexOf(w);
        const other = list[i + (forward ? 1 : -1)];
        if (!other) return;
        const otherE = ownEditable(other);
        if (!otherE || other.dataset.blockType === 'table') { select(other); return; }
        if (!forward && w.parentElement.classList.contains('notion-children')) { nest(w, true); placeCaret(e, false); return; }
        if (!forward && !['paragraph', 'code'].includes(w.dataset.blockType)) { convert(w, 'paragraph'); return; }
        const from = forward ? other : w, target = forward ? w : other;
        const fromE = forward ? otherE : e, targetE = forward ? e : otherE;
        if (from.contains(target) || target.contains(from)) { select(other); return; }
        const c = directChildByClass(from, 'notion-children');
        if (c?.children.length && (!canNest(target) || !Array.from(c.children).every(writable))) { select(other); return; }
        const offset = textLength(targetE);
        targetE.querySelectorAll('[data-soft-break-tail]').forEach(x => x.remove());
        while (fromE.firstChild) targetE.appendChild(fromE.firstChild);
        if (c?.children.length) {
            const dest = childrenContainer(target);
            for (const child of Array.from(c.children)) { remapTree(child); child.dataset.parentId = target.dataset.blockId; dest.appendChild(child); }
        }
        from.remove(); placeCaret(targetE, false, offset);
    }
    function deleteBlocks() {
        const items = selectedRoots(), first = items[0];
        if (!first) return;
        const list = visibleBlocks(), index = list.indexOf(first);
        const next = list.slice(index).find(w => !items.some(x => x === w || x.contains(w))) ||
            list.slice(0, index).reverse().find(w => !items.some(x => x === w || x.contains(w)));
        items.forEach(w => w.remove()); clearSelection(); ensureBlock();
        const target = next && root.contains(next) ? next : root.querySelector(selector);
        if (ownEditable(target)) placeCaret(ownEditable(target), false); else select(target);
    }
    function duplicate(items = selectedRoots()) {
        if (!items.length) items = [block(current())].filter(Boolean);
        if (!items.every(writable)) { toast('Cannot duplicate this block', 'This block must be duplicated in Notion.'); return; }
        clearSelection();
        items.forEach(w => { const copy = w.cloneNode(true); remapTree(copy); w.after(copy); select(copy, false, true); });
    }
    function move(items, target, position = 'before', copy = false) {
        if (!items.length || items.some(w => w === target || w.contains(target))) return;
        if (position === 'inside' && !canNest(target)) return;
        if (!items.every(writable)) { toast('Cannot move this block', 'This block must be moved in Notion.'); return; }
        let after = target;
        items.forEach(item => {
            const w = copy ? item.cloneNode(true) : item; remapTree(w);
            if (position === 'inside') { childrenContainer(target).appendChild(w); w.dataset.parentId = target.dataset.blockId; }
            else { if (position === 'before') target.before(w); else { after.after(w); after = w; } w.dataset.parentId = target.dataset.parentId || ''; }
        });
        clearSelection();
        if (!copy) items.forEach(w => select(w, false, true));
    }

    function hydrate() {
        ensureBlock();
        // UI controls are outside the editable surface. All actions use delegation,
        // so undo/redo can restore a tree without losing event handlers.
        root.tabIndex = 0;
        root.querySelectorAll(selector).forEach(w => {
            w.classList.remove('drop-before', 'drop-after', 'drop-inside');
            if (w.dataset.blockType === 'table_row') return;
            let tools = directChildByClass(w, 'block-tools');
            if (!tools) {
                tools = document.createElement('div'); tools.className = 'block-tools'; tools.contentEditable = 'false';
                tools.innerHTML = '<button type="button" data-block-action="add" aria-label="Add block" title="Add block">+</button><button type="button" data-block-action="menu" aria-label="Block actions" title="Drag to move · click for actions" draggable="true">⠿</button>';
                w.prepend(tools);
            }
            const v = JSON.parse(w.dataset.blockValue || '{}');
            if (v.color) w.dataset.notionColor = v.color;
            if (w.dataset.blockType === 'toggle' || v.is_toggleable) {
                const c = directChildByClass(w, 'notion-children') || childrenContainer(w);
                const row = directChildByClass(w, 'toggle-row');
                if (row && !row.querySelector('.toggle-marker')) {
                    const marker = document.createElement('button'); marker.type = 'button'; marker.className = 'toggle-marker'; marker.contentEditable = 'false'; row.prepend(marker);
                }
                const marker = row?.querySelector('.toggle-marker');
                if (marker) { marker.textContent = c.hidden ? '▸' : '▾'; marker.setAttribute('aria-expanded', String(!c.hidden)); marker.setAttribute('aria-label', c.hidden ? 'Expand toggle' : 'Collapse toggle'); }
            }
        });
        function numberList(container) {
            let number = 0;
            Array.from(container.children).forEach(w => {
                if (!w.matches(selector)) return;
                if (w.dataset.blockType === 'numbered_list_item') {
                    number++; w.querySelector('.list-marker').textContent = `${number}.`;
                } else number = 0;
                const c = directChildByClass(w, 'notion-children'); if (c) numberList(c);
            });
        }
        numberList(root);
        root.querySelectorAll('.block-table').forEach(w => {
            w.contentEditable = 'false';
            w.querySelectorAll('td').forEach(td => td.contentEditable = String(!state.saveInFlight));
            if (!w.querySelector('.table-tools')) {
                const tools = document.createElement('div'); tools.className = 'table-tools'; tools.contentEditable = 'false';
                tools.innerHTML = '<button type="button" data-table-action="row">+ Row</button><button type="button" data-table-action="column">+ Column</button>';
                w.appendChild(tools);
            }
        });
    }

    function closeMenu() {
        if (menu) menu.remove(); menu = null; menuTarget = null; slashRange = null; colorRange = null;
    }
    function openMenu(w, query = '', slash = null) {
        closeMenu(); menuTarget = w; menuQuery = query; menuIndex = 0; slashRange = slash;
        menu = document.createElement('div'); menu.className = 'notion-command-menu'; menu.contentEditable = 'false';
        menu.setAttribute('role', 'listbox'); menu.setAttribute('aria-label', 'Block commands');
        menu.addEventListener('mousedown', e => e.preventDefault());
        menu.addEventListener('click', e => { const b = e.target.closest('[data-command]'); if (b) executeCommand(Number(b.dataset.command)); });
        document.body.appendChild(menu); drawMenu();
    }
    function drawMenu() {
        if (!menu || !menuTarget?.isConnected) return closeMenu();
        const q = menuQuery.toLowerCase().replace(/^turn\s*/, '');
        const matches = text => !q || text.toLowerCase().startsWith(q) || text.toLowerCase().includes(` ${q}`);
        menuOptions = blockTypes.filter(([label, type, aliases]) => matches(`${label} ${aliases}`)).map(([label, type]) => ({ label, type }));
        for (const color of colors) {
            const label = color === 'default' ? 'Default color' : `${color[0].toUpperCase()}${color.slice(1)} text`;
            if (`${label} color`.toLowerCase().includes(q)) menuOptions.push({ label, action: 'color', color });
            if (color !== 'default') {
                const label = `${color[0].toUpperCase()}${color.slice(1)} background`;
                if (`${label} color highlight`.toLowerCase().includes(q)) menuOptions.push({ label, action: 'color', color: `${color}_background` });
            }
        }
        for (const [label, action] of [['Duplicate', 'duplicate'], ['Delete', 'delete']]) if (label.toLowerCase().includes(q)) menuOptions.push({ label, action });
        if (menuTarget.dataset.blockType === 'heading_1' || menuTarget.dataset.blockType === 'heading_2' || menuTarget.dataset.blockType === 'heading_3') {
            if ('toggle heading'.includes(q)) menuOptions.push({ label: 'Toggle heading', action: 'toggle-heading' });
        }
        menuIndex = Math.max(0, Math.min(menuIndex, menuOptions.length - 1));
        menu.innerHTML = '<div class="command-heading">' + (q ? 'Turn into' : 'Blocks') + '</div>' + menuOptions.map((o, i) =>
            `<button type="button" role="option" aria-selected="${i === menuIndex}" data-command="${i}">${escapeHtml(o.label)}</button>`).join('');
        const rect = menuTarget.getBoundingClientRect();
        menu.style.left = `${Math.max(8, Math.min(innerWidth - 248, rect.left))}px`;
        menu.style.top = `${Math.max(8, Math.min(innerHeight - Math.min(menu.scrollHeight, 340) - 8, rect.bottom))}px`;
        menu.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
    }
    function executeCommand(index) {
        const option = menuOptions[index], target = menuTarget, r = slashRange, selectedColorRange = colorRange;
        if (!option || !target) return closeMenu();
        let value = {};
        if (['image', 'bookmark', 'embed'].includes(option.type)) {
            const url = prompt('Paste an https:// URL:');
            if (!url) return;
            if (!/^https?:\/\//i.test(url)) { toast('Invalid URL', 'Use an http:// or https:// URL.'); return; }
            value = option.type === 'image' ? { type: 'external', external: { url }, caption: [] } : { url, caption: [] };
        }
        if (option.type === 'equation') { const expression = prompt('LaTeX expression:'); if (expression === null) return; value = { expression }; }
        closeMenu();
        transact(() => {
            if (r && root.contains(r.startContainer)) r.deleteContents();
            if (option.action === 'color') {
                if (selectedColorRange) {
                    setDocumentSelection(selectedColorRange);
                    const pieces = rangeEditables().map(e => ({ e, range: subRangeForEditable(selectedColorRange, e) })).filter(x => x.range);
                    for (const { range } of pieces) {
                        const span = document.createElement('span'); span.dataset.notionColor = option.color;
                        span.appendChild(range.extractContents()); range.insertNode(span);
                    }
                    try { setDocumentSelection(selectedColorRange); } catch { /* rewritten selection */ }
                } else {
                    (selections.size ? selectedRoots() : [target]).forEach(w => {
                        const value = JSON.parse(w.dataset.blockValue || '{}'); value.color = option.color;
                        w.dataset.blockValue = JSON.stringify(value); w.dataset.notionColor = option.color;
                    });
                    if (ownEditable(target)) placeCaret(ownEditable(target), true);
                }
            } else if (option.action === 'duplicate') duplicate(selections.size ? selectedRoots() : [target]);
            else if (option.action === 'delete') { if (!selections.size) select(target); deleteBlocks(); }
            else if (option.action === 'toggle-heading') convert(target, target.dataset.blockType, { is_toggleable: true });
            else if (option.type === 'table') {
                if (directChildByClass(target, 'notion-children')?.children.length) return;
                const table = newBlock('table', { table_width: 2, has_column_header: false, has_row_header: false }, target.dataset.parentId);
                const id = table.dataset.blockId;
                const data = { id, type: 'table', table: { table_width: 2 }, children: [0, 1].map(() => ({ id: makeTempId(), type: 'table_row', table_row: { cells: [[], []] } })) };
                const actual = renderBlock(data, target.dataset.parentId); target.replaceWith(actual); hydrate(); placeCaret(actual.querySelector('td'), false);
            } else {
                const targets = selections.size ? selectedRoots() : [target];
                targets.forEach(w => convert(w, option.type, value)); clearSelection();
            }
        });
    }
    function updateSlash() {
        const e = current(), s = getSelection();
        if (!e || !s.isCollapsed || e.dataset.type === 'code' || e.dataset.type === 'table_row') return;
        const range = s.getRangeAt(0), before = document.createRange(); before.selectNodeContents(e); before.setEnd(range.endContainer, range.endOffset);
        const txt = before.toString(), match = txt.match(/(?:^|\s)\/([^\/\n]*)$/);
        if (!match) { if (slashRange) closeMenu(); return; }
        // Use text-node coordinates, never rewrite the whole rich-text block.
        const query = match[1], offset = txt.length - query.length - 1;
        const point = pointAt(e, offset), slash = range.cloneRange(); slash.setStart(point.node, point.offset);
        if (menuTarget === block(e) && slashRange) { menuQuery = query; slashRange = slash; drawMenu(); }
        else openMenu(block(e), query, slash);
    }
    function pointAt(e, offset) {
        const walker = document.createTreeWalker(e, NodeFilter.SHOW_TEXT); let n, last = null;
        while ((n = walker.nextNode())) { last = n; if (offset <= n.length) return { node: n, offset }; offset -= n.length; }
        return last ? { node: last, offset: last.length } : { node: e, offset: 0 };
    }
    function markdown(e) {
        if (!e || e.dataset.type !== 'paragraph' || !getSelection().isCollapsed) return;
        const text = e.textContent;
        const maps = { '- ': 'bulleted_list_item', '* ': 'bulleted_list_item', '+ ': 'bulleted_list_item', '[] ': 'to_do', '[ ] ': 'to_do',
            '1. ': 'numbered_list_item', 'a. ': 'numbered_list_item', 'i. ': 'numbered_list_item', '# ': 'heading_1', '## ': 'heading_2', '### ': 'heading_3', '> ': 'toggle', '" ': 'quote', '```': 'code', '---': 'divider' };
        if (maps[text]) { e.replaceChildren(); convert(block(e), maps[text]); hydrate(); }
    }
    function inlineMarkdown(e) {
        if (!e || e.dataset.type === 'code') return;
        const s = getSelection(); if (!s?.isCollapsed || s.focusNode?.nodeType !== Node.TEXT_NODE) return;
        const node = s.focusNode, text = node.nodeValue.slice(0, s.focusOffset);
        const match = text.match(/(?:^|\s)(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`|~([^~]+)~)$/);
        if (!match) return;
        const tag = match[2] ? 'strong' : match[3] ? 'em' : match[4] ? 'code' : 's';
        const start = text.length - match[1].length, r = document.createRange(); r.setStart(node, start); r.setEnd(node, s.focusOffset);
        const element = document.createElement(tag); element.textContent = match[2] || match[3] || match[4] || match[5];
        r.deleteContents(); r.insertNode(element); r.setStartAfter(element); r.collapse(true); s.removeAllRanges(); s.addRange(r);
    }
    function format(action, url = null) {
        const s = getSelection(); if (!s.rangeCount || s.isCollapsed) return;
        const original = s.getRangeAt(0).cloneRange();
        const pieces = rangeEditables().map(e => ({ e, r: subRangeForEditable(original, e) })).filter(x => x.r);
        for (const { e, r } of pieces) {
            setDocumentSelection(r);
            if (action === 'code') toggleInlineCode(r, e);
            else if (action === 'link') {
                if (url) document.execCommand('createLink', false, url);
                else document.execCommand('unlink', false, null);
            } else document.execCommand(action, false, null);
        }
        try { setDocumentSelection(original); } catch { /* selection ends in reformatted nodes */ }
        hideFormattingToolbar();
    }
    // Toolbar buttons and keyboard shortcuts share the same transaction/history.
    document.addEventListener('click', event => {
        const button = event.target.closest('.notion-format-toolbar [data-format]');
        if (!button) return;
        event.preventDefault(); event.stopImmediatePropagation();
        const range = state.formattingRange?.cloneRange();
        if (!range) return;
        setDocumentSelection(range);
        if (button.dataset.format === 'link') link();
        else if (button.dataset.format === 'color') { openMenu(block(editable(range.startContainer)), 'color'); colorRange = range; }
        else transact(() => format(button.dataset.format));
    }, true);
    function link() {
        const s = getSelection(); if (!s.rangeCount || s.isCollapsed) return;
        const r = s.getRangeAt(0).cloneRange();
        const url = prompt('Link URL (leave empty to remove):', editable(r.startContainer)?.querySelector('a')?.href || '');
        if (url === null) return;
        if (url && !/^(https?:|mailto:|tel:|\/|#)/i.test(url)) { toast('Invalid link', 'Use https://, mailto:, or a relative URL.'); return; }
        setDocumentSelection(r); transact(() => format('link', url));
    }

    function tableAction(w, action) {
        const value = JSON.parse(w.dataset.blockValue || '{}'), tbody = w.querySelector('tbody');
        if (action === 'row') {
            const row = document.createElement('tr'); row.className = 'notion-block block-table_row';
            row.dataset.blockId = makeTempId(); row.dataset.parentId = w.dataset.blockId; row.dataset.blockType = 'table_row'; row.dataset.blockValue = JSON.stringify({ cells: [] });
            for (let i = 0; i < value.table_width; i++) {
                const td = document.createElement('td'); td.dataset.editable = 'true'; td.dataset.id = row.dataset.blockId; td.dataset.type = 'table_row'; td.dataset.cell = i; td.contentEditable = 'true'; row.appendChild(td);
            }
            tbody.appendChild(row); placeCaret(row.firstChild, false);
        } else {
            if (!prepareMove(w)) return;
            value.table_width++; w.dataset.blockValue = JSON.stringify(value);
            tbody.querySelectorAll('tr').forEach(row => {
                const td = document.createElement('td'); td.dataset.editable = 'true'; td.dataset.id = row.dataset.blockId; td.dataset.type = 'table_row'; td.dataset.cell = value.table_width - 1; td.contentEditable = 'true'; row.appendChild(td);
            });
        }
    }

    root.addEventListener('beforeinput', event => {
        if (state.saveInFlight) { event.preventDefault(); return; }
        if (event.isComposing || composing) return;
        if (event.inputType === 'historyUndo' || event.inputType === 'historyRedo') { event.preventDefault(); undo(event.inputType === 'historyRedo'); return; }
        const e = current(), s = getSelection();
        if (!e && !event.target.closest('[data-page-title]')) { event.preventDefault(); return; }
        record();
        if (event.inputType === 'insertParagraph' || event.inputType === 'insertLineBreak') {
            event.preventDefault(); if (!e) return;
            transact(() => {
                if (event.inputType === 'insertLineBreak' || ['code', 'table_row'].includes(e.dataset.type)) softBreak(e); else split(e);
            }); return;
        }
        if (!s.isCollapsed && event.inputType.startsWith('delete')) {
            event.preventDefault(); transact(deleteTextSelection); return;
        }
        if (!s.isCollapsed && event.inputType.startsWith('insert') && event.inputType !== 'insertFromPaste') {
            event.preventDefault(); transact(() => { if (deleteTextSelection() && event.data) document.execCommand('insertText', false, event.data); }); return;
        }
        if (e && s.isCollapsed && event.inputType === 'deleteContentBackward' && isCaretAtStart(e) && e.dataset.type !== 'table_row') {
            event.preventDefault(); transact(() => merge(e)); return;
        }
        if (e && s.isCollapsed && event.inputType === 'deleteContentForward' && isCaretAtEnd(e) && e.dataset.type !== 'table_row') {
            event.preventDefault(); transact(() => merge(e, true)); return;
        }
    });
    root.addEventListener('input', () => {
        if (state.saveInFlight || composing) return;
        const e = current();
        // Once text is typed after a trailing soft break, the visual sentinel is obsolete.
        if (e) e.querySelectorAll('[data-soft-break-tail]').forEach(tail => { if (tail.nextSibling) tail.remove(); });
        markdown(e); inlineMarkdown(e); hydrate(); markDirty(); record(`text:${e?.dataset.id || 'title'}`); updateSlash();
    });
    root.addEventListener('compositionstart', () => { record(); composing = true; });
    root.addEventListener('compositionend', () => { composing = false; markDirty(); record(); });

    root.addEventListener('click', event => {
        if (state.saveInFlight) return;
        const w = block(event.target), action = event.target.closest('[data-block-action]')?.dataset.blockAction;
        if (action) {
            event.preventDefault();
            if (action === 'add') transact(() => { const next = newBlock('paragraph', {}, w.dataset.parentId); w.after(next); placeCaret(ownEditable(next), false); openMenu(next); });
            else { select(w, event.shiftKey); openMenu(w); }
            return;
        }
        const table = event.target.closest('[data-table-action]');
        if (table) { event.preventDefault(); transact(() => tableAction(w, table.dataset.tableAction)); return; }
        if (event.target.closest('.toggle-marker')) return; // capture handler below owns it
        if (w && (event.shiftKey && selections.size || event.altKey && event.shiftKey || event.metaKey && event.shiftKey)) {
            event.preventDefault(); select(w, event.shiftKey && !event.altKey && !event.metaKey, event.altKey || event.metaKey); return;
        }
        if (event.target.closest('input[type="checkbox"]')) { markDirty(); record(); return; }
        if (event.target.closest('a')) {
            if (!(event.ctrlKey || event.metaKey)) event.preventDefault();
            return;
        }
        if (w && !editable(event.target) && !w.querySelector('td')) { select(w); return; }
        clearSelection();
        if (event.target === root) {
            const blocks = visibleBlocks(), last = blocks[blocks.length - 1];
            if (!last || event.clientY > last.getBoundingClientRect().bottom) {
                if (last && ownEditable(last) && !textLength(ownEditable(last))) placeCaret(ownEditable(last), false);
                else transact(() => { const next = newBlock(); root.appendChild(next); placeCaret(ownEditable(next), false); });
            }
        }
    });
    // Replace per-node listeners with delegation, including trees restored by undo.
    root.addEventListener('click', event => {
        const marker = event.target.closest('.toggle-marker');
        if (marker) {
            event.preventDefault(); event.stopImmediatePropagation(); if (state.saveInFlight) return;
            const c = directChildByClass(block(marker), 'notion-children'); c.hidden = !c.hidden; hydrate(); return;
        }
        const image = event.target.closest('.notion-image');
        if (image) { event.preventDefault(); event.stopImmediatePropagation(); select(block(image), event.shiftKey, event.altKey || event.metaKey); }
    }, true);
    root.addEventListener('mousedown', event => {
        if (event.target.closest('[data-block-action="add"], .toggle-marker')) event.preventDefault();
        if (event.target.closest('input[type="checkbox"]')) record();
        if (editable(event.target) && !event.shiftKey) clearSelection();
    });
    document.addEventListener('mousedown', event => {
        if (menu && !menu.contains(event.target) && !event.target.closest('.block-tools')) closeMenu();
    });

    document.addEventListener('keydown', event => {
        if (state.saveInFlight && root.contains(event.target)) { event.preventDefault(); event.stopImmediatePropagation(); return; }
        if (event.isComposing || composing) return;
        const s = getSelection(), inEditor = root.contains(event.target) || root.contains(s?.anchorNode);
        if (!inEditor) return;
        const mod = event.ctrlKey || event.metaKey, key = event.key.toLowerCase(), e = current();
        const handled = () => { event.preventDefault(); event.stopImmediatePropagation(); };
        if (menu) {
            if (event.key === 'Escape') { handled(); closeMenu(); return; }
            if (['ArrowDown', 'ArrowUp'].includes(event.key)) { handled(); menuIndex = (menuIndex + (event.key === 'ArrowDown' ? 1 : -1) + menuOptions.length) % Math.max(menuOptions.length, 1); drawMenu(); return; }
            if (event.key === 'Enter') { handled(); executeCommand(menuIndex); return; }
            if (!slashRange && !mod && key.length === 1) { handled(); menuQuery += event.key; drawMenu(); return; }
            if (!slashRange && event.key === 'Backspace') { handled(); menuQuery = menuQuery.slice(0, -1); drawMenu(); return; }
        }
        if (mod && key === 'z' || mod && key === 'y') { handled(); undo(event.shiftKey || key === 'y'); return; }
        if (mod && key === 's' && !event.shiftKey) { handled(); record(); closeMenu(); save(); return; }
        if (mod && key === 'd') { handled(); transact(() => duplicate()); return; }
        if (mod && key === '/') { handled(); openMenu(selectedRoots()[0] || block(e)); return; }
        const formats = { b: 'bold', i: 'italic', u: 'underline', e: 'code' };
        if (mod && (formats[key] || key === 's' && event.shiftKey)) { handled(); transact(() => format(formats[key] || 'strikeThrough')); return; }
        if (mod && key === 'k') { handled(); link(); return; }
        if (mod && key === 'a') {
            handled();
            const all = () => { clearSelection(); visibleBlocks().forEach(w => select(w, false, true)); };
            if (selections.size) all();
            else if (e) {
                const r = document.createRange(); r.selectNodeContents(e);
                if (s.rangeCount && s.getRangeAt(0).toString() === r.toString() && !s.isCollapsed) all();
                else setDocumentSelection(r);
            } else all();
            return;
        }
        if (mod && event.altKey && key === 't') {
            handled(); const cs = Array.from(root.querySelectorAll('.block-toggle > .notion-children, [data-block-value] > .notion-children')).filter(c => c.previousElementSibling?.classList.contains('toggle-row'));
            const open = cs.some(c => c.hidden); cs.forEach(c => c.hidden = !open); hydrate(); return;
        }
        const digit = event.code?.match(/^Digit([0-8])$/)?.[1];
        if (mod && (event.shiftKey || event.altKey) && digit) {
            handled(); const types = ['paragraph', 'heading_1', 'heading_2', 'heading_3', 'to_do', 'bulleted_list_item', 'numbered_list_item', 'toggle', 'code'];
            transact(() => (selections.size ? selectedRoots() : [block(e)]).filter(Boolean).forEach(w => convert(w, types[Number(digit)]))); return;
        }
        if (mod && event.key === 'Enter') {
            handled(); const w = selectedRoots()[0] || block(e);
            const checkbox = w?.querySelector('input[type="checkbox"]'), toggle = w?.querySelector('.toggle-marker');
            if (checkbox) transact(() => checkbox.checked = !checkbox.checked);
            else toggle?.click(); return;
        }
        if (event.key === 'Escape') { handled(); closeMenu(); if (selections.size) clearSelection(); else if (e) select(block(e)); return; }
        if (event.key === 'Tab' && !mod) {
            handled();
            if (e?.dataset.type === 'table_row') {
                const cells = Array.from(e.closest('table').querySelectorAll('td')), index = cells.indexOf(e), next = cells[index + (event.shiftKey ? -1 : 1)];
                if (next) placeCaret(next, false); else if (!event.shiftKey) transact(() => tableAction(e.closest('.block-table'), 'row'));
            } else {
                const items = selections.size ? selectedRoots() : [block(e)].filter(Boolean);
                const originalOffset = e ? selectionOffsetWithin(e) : null;
                transact(() => {
                    if (event.shiftKey) items.slice().reverse().forEach(w => nest(w, true));
                    else if (items.length > 1) {
                        const prev = items[0].previousElementSibling;
                        if (prev?.matches(selector) && canNest(prev) && items.every(writable)) items.forEach(w => { remapTree(w); childrenContainer(prev).appendChild(w); w.dataset.parentId = prev.dataset.blockId; });
                    } else items.forEach(w => nest(w));
                    if (e) placeCaret(e, false, originalOffset);
                });
            }
            return;
        }
        if (selections.size) {
            const list = visibleBlocks(), w = focusBlock || selectedRoots()[0], i = list.indexOf(w);
            if (['Backspace', 'Delete'].includes(event.key)) { handled(); transact(deleteBlocks); return; }
            if (event.key === 'Enter') { handled(); clearSelection(); if (ownEditable(w)) placeCaret(ownEditable(w), true); else transact(() => { const next = newBlock('paragraph', {}, w.dataset.parentId); w.after(next); placeCaret(ownEditable(next), false); }); return; }
            if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                handled(); const next = list[i + (event.key === 'ArrowDown' ? 1 : -1)];
                if (!next) return;
                if (mod && event.shiftKey) transact(() => move(selectedRoots(), next, event.key === 'ArrowUp' ? 'before' : 'after'));
                else select(next, event.shiftKey); return;
            }
            if (!mod && !event.altKey && event.key.length === 1) { handled(); transact(() => { const first = selectedRoots()[0], next = newBlock('paragraph', {}, first?.dataset.parentId); first?.before(next); deleteBlocks(); clearSelection(); placeCaret(ownEditable(next), false); document.execCommand('insertText', false, event.key); }); return; }
        }
        const title = event.target.closest('[data-page-title]') || (s.anchorNode?.parentElement)?.closest('[data-page-title]');
        if (title && event.key === 'Enter') { handled(); const first = root.querySelector('[data-editable="true"]'); if (first) placeCaret(first, false); return; }
        if (e && event.key === 'Enter') { handled(); transact(() => { if (event.shiftKey || ['code', 'table_row'].includes(e.dataset.type)) softBreak(e); else split(e); }); return; }
        // Native character/word navigation is retained; prevent it from crossing into controls.
        if (e && s.isCollapsed && !mod && !event.shiftKey) {
            if (event.key === 'ArrowLeft' && isCaretAtStart(e) || event.key === 'ArrowRight' && isCaretAtEnd(e)) {
                const list = Array.from(root.querySelectorAll('[data-editable="true"]')).filter(x => !x.closest('[hidden]'));
                const next = list[list.indexOf(e) + (event.key === 'ArrowLeft' ? -1 : 1)];
                if (next) { handled(); placeCaret(next, event.key === 'ArrowLeft'); }
            }
        }
    }, true);

    function clipboardBlocks(items) {
        return items.map(w => ({ type: w.dataset.blockType, value: valueForWrapper(w), children: Array.from(directChildByClass(w, 'notion-children')?.children ||
            (w.dataset.blockType === 'table' ? w.querySelector('tbody')?.children || [] : [])).filter(x => x.matches(selector)).map(x => clipboardBlocks([x])[0]) }));
    }
    function fromClipboard(data, parentId = '') {
        if (!supported.has(data.type)) throw new Error('Unsupported clipboard block.');
        const id = makeTempId(), children = (data.children || []).map(c => fromClipboardData(c));
        return renderBlock({ id, type: data.type, [data.type]: data.value || {}, children }, parentId);
    }
    function fromClipboardData(data) {
        if (!supported.has(data.type)) throw new Error('Unsupported clipboard block.');
        return { id: makeTempId(), type: data.type, [data.type]: data.value || {}, children: (data.children || []).map(fromClipboardData) };
    }
    function sanitizeHtml(html) {
        const template = document.createElement('template'); template.innerHTML = html;
        const allowed = new Set(['B','STRONG','I','EM','U','S','STRIKE','DEL','CODE','A','BR','SPAN','DIV','P','LI','UL','OL','H1','H2','H3','BLOCKQUOTE','PRE']);
        function clean(node) {
            if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.nodeValue);
            const frag = document.createDocumentFragment();
            if (node.nodeType !== Node.ELEMENT_NODE || ['SCRIPT','STYLE','IFRAME','OBJECT'].includes(node.tagName)) return frag;
            const el = allowed.has(node.tagName) ? document.createElement(node.tagName.toLowerCase()) : frag;
            if (node.tagName === 'A' && /^(https?:|mailto:|tel:|\/|#)/i.test(node.getAttribute('href') || '')) el.setAttribute('href', node.getAttribute('href'));
            if (node.tagName === 'SPAN' && /^(default|gray|brown|orange|yellow|green|blue|purple|pink|red)(_background)?$/.test(node.dataset.notionColor || '')) el.dataset.notionColor = node.dataset.notionColor;
            for (const c of node.childNodes) el.appendChild(clean(c));
            return el;
        }
        const frag = document.createDocumentFragment(); for (const n of template.content.childNodes) frag.appendChild(clean(n)); return frag;
    }
    root.addEventListener('copy', event => {
        if (!selections.size) return;
        event.preventDefault(); const items = selectedRoots();
        if (items.every(writable)) event.clipboardData.setData('application/x-johnvitor-notion-blocks', JSON.stringify(clipboardBlocks(items)));
        event.clipboardData.setData('text/plain', items.map(w => w.innerText.replace(/\+\s*⠿/g, '').trim()).join('\n'));
        event.clipboardData.setData('text/html', items.map(w => { const copy = w.cloneNode(true); copy.querySelectorAll('.block-tools,.table-tools').forEach(x => x.remove()); return copy.outerHTML; }).join(''));
    });
    root.addEventListener('cut', event => {
        if (selections.size) { root.dispatchEvent(new ClipboardEvent('copy', { clipboardData: event.clipboardData })); event.preventDefault(); transact(deleteBlocks); }
        else if (!getSelection().isCollapsed) {
            event.preventDefault(); const r = getSelection().getRangeAt(0), div = document.createElement('div'); div.appendChild(r.cloneContents());
            div.querySelectorAll('.block-tools,.table-tools').forEach(x => x.remove());
            event.clipboardData.setData('text/plain', getSelection().toString()); event.clipboardData.setData('text/html', div.innerHTML); transact(deleteTextSelection);
        }
    });
    root.addEventListener('paste', event => {
        if (state.saveInFlight) { event.preventDefault(); return; }
        event.preventDefault();
        const data = event.clipboardData, text = data.getData('text/plain'), html = data.getData('text/html');
        const custom = data.getData('application/x-johnvitor-notion-blocks');
        const e = current(), s = getSelection();
        if (/^https?:\/\/\S+$/.test(text) && !s.isCollapsed && !selections.size) { transact(() => format('link', text)); return; }
        let blocks = null;
        if (custom) { try { blocks = JSON.parse(custom); if (!Array.isArray(blocks)) return; } catch { return; } }
        transact(() => {
            if (selections.size) {
                const first = selectedRoots()[0], next = newBlock('paragraph', {}, first.dataset.parentId);
                first.before(next); deleteBlocks(); clearSelection(); placeCaret(ownEditable(next), false);
            } else if (!s.isCollapsed && !deleteTextSelection()) return;
            const target = current() || e;
            if (!target) return;
            const w = block(target);
            if (['code', 'table_row'].includes(target.dataset.type)) { document.execCommand('insertText', false, text); return; }
            if (blocks) {
                if (!w) return;
                let after = w;
                for (const b of blocks) { const next = fromClipboard(b, w.dataset.parentId); after.after(next); after = next; }
                if (!textLength(target) && !directChildByClass(w, 'notion-children')?.children.length) w.remove();
                hydrate(); if (ownEditable(after)) placeCaret(ownEditable(after), true); else select(after); return;
            }
            const fragment = html ? sanitizeHtml(html) : null;
            const blockNodes = fragment ? Array.from(fragment.childNodes) : [];
            const hasBlocks = blockNodes.some(n => n.nodeType === 1 && /^(P|DIV|H[123]|UL|OL|LI|BLOCKQUOTE|PRE)$/.test(n.tagName));
            if (!text.includes('\n') && !hasBlocks) {
                if (fragment) { const r = s.getRangeAt(0); const last = fragment.lastChild; r.insertNode(fragment); if (last) { r.setStartAfter(last); r.collapse(true); setDocumentSelection(r); } }
                else document.execCommand('insertText', false, text); return;
            }
            const lines = [];
            function pushNode(n) {
                if (n.nodeType === 1 && ['UL', 'OL'].includes(n.tagName)) {
                    Array.from(n.children).forEach(li => lines.push({ type: n.tagName === 'UL' ? 'bulleted_list_item' : 'numbered_list_item', html: li.innerHTML }));
                } else if (n.nodeType === 1) lines.push({ type: ({ H1:'heading_1', H2:'heading_2', H3:'heading_3', BLOCKQUOTE:'quote', PRE:'code', LI:'bulleted_list_item' })[n.tagName] || 'paragraph', html: n.innerHTML });
                else if (n.textContent.trim()) lines.push({ type:'paragraph', html: escapeHtml(n.textContent) });
            }
            if (hasBlocks) blockNodes.forEach(pushNode); else text.replace(/\r\n?/g, '\n').split('\n').forEach(line => lines.push({ type:'paragraph', html: escapeHtml(line) }));
            if (!lines.length) return;
            const r = s.getRangeAt(0), tail = document.createRange(); tail.selectNodeContents(target); tail.setStart(r.startContainer, r.startOffset);
            const suffix = tail.extractContents();
            const insert = document.createElement('template'); insert.innerHTML = lines[0].html; target.appendChild(insert.content);
            let after = w, lastE = target;
            for (const line of lines.slice(1)) { const next = newBlock(line.type, {}, w.dataset.parentId); lastE = ownEditable(next); lastE.innerHTML = line.html; after.after(next); after = next; }
            const offset = textLength(lastE); lastE.appendChild(suffix); placeCaret(lastE, false, offset);
        });
    });

    root.addEventListener('dragstart', event => {
        if (state.saveInFlight || !event.target.closest('[draggable="true"]')) return;
        const w = block(event.target); if (!selections.has(w.dataset.blockId)) select(w);
        drag = selectedRoots(); event.dataTransfer.effectAllowed = 'copyMove'; event.dataTransfer.setData('text/plain', '');
    });
    root.addEventListener('dragover', event => {
        if (!drag) return; const w = block(event.target); if (!w || drag.some(x => x === w || x.contains(w))) return;
        event.preventDefault(); root.querySelectorAll('.drop-before,.drop-after,.drop-inside').forEach(x => x.classList.remove('drop-before','drop-after','drop-inside'));
        const rect = w.getBoundingClientRect(), inside = event.clientX > rect.left + 40 && canNest(w);
        w.classList.add(inside ? 'drop-inside' : event.clientY < rect.top + rect.height / 2 ? 'drop-before' : 'drop-after');
    });
    root.addEventListener('drop', event => {
        if (!drag) return; event.preventDefault(); const w = block(event.target), items = drag; drag = null;
        if (!w) return;
        const position = w.classList.contains('drop-inside') ? 'inside' : w.classList.contains('drop-before') ? 'before' : 'after';
        transact(() => move(items, w, position, event.altKey));
    });
    root.addEventListener('dragend', () => { drag = null; hydrate(); });
    let marquee = null, selectionBox = null, suppressClick = false;
    document.addEventListener('pointerdown', event => {
        const rect = root.getBoundingClientRect();
        if (event.clientX < rect.left - 30 || event.clientX > rect.right + 30 || event.clientY < rect.top || event.clientY > rect.bottom) return;
        if (event.button !== 0 || event.pointerType === 'touch' || state.saveInFlight ||
            editable(event.target) || event.target.closest('button,input,a,table,img,[data-page-title]')) return;
        marquee = { x: event.clientX, y: event.clientY, started: false };
    });
    document.addEventListener('pointermove', event => {
        if (!marquee || !(event.buttons & 1)) return;
        if (!marquee.started && Math.hypot(event.clientX - marquee.x, event.clientY - marquee.y) < 5) return;
        marquee.started = true; event.preventDefault();
        const top = Math.min(event.clientY, marquee.y), bottom = Math.max(event.clientY, marquee.y);
        clearSelection();
        for (const w of visibleBlocks()) {
            const rect = w.getBoundingClientRect();
            if (rect.bottom >= top && rect.top <= bottom && !w.parentElement.closest('.block-selected')) select(w, false, true);
        }
        if (!selectionBox) { selectionBox = document.createElement('div'); selectionBox.className = 'notion-selection-box'; document.body.appendChild(selectionBox); }
        Object.assign(selectionBox.style, { left: `${Math.min(event.clientX, marquee.x)}px`, top: `${top}px`, width: `${Math.abs(event.clientX - marquee.x)}px`, height: `${bottom-top}px` });
    });
    document.addEventListener('pointerup', () => {
        suppressClick = Boolean(marquee?.started); marquee = null; selectionBox?.remove(); selectionBox = null;
        setTimeout(() => { suppressClick = false; }, 0);
    });
    root.addEventListener('click', event => {
        if (suppressClick) { event.preventDefault(); event.stopImmediatePropagation(); }
    }, true);
    document.addEventListener('notion:render', () => { hydrate(); history = []; historyIndex = -1; clearSelection(); record(); });
    document.addEventListener('notion:saved', event => {
        // Remap every historic DOM snapshot to the new Notion IDs; undo remains
        // usable after saving and resurrects saved deletions as new blocks.
        for (const snap of history) {
            const template = document.createElement('template'); template.innerHTML = snap.html;
            for (const [temp, actual] of Object.entries(event.detail)) {
                template.content.querySelectorAll('[data-block-id], [data-id], [data-parent-id], [data-children-of], [data-todo-id]').forEach(el => {
                    for (const key of ['blockId','id','parentId','childrenOf','todoId']) if (el.dataset[key] === temp) el.dataset[key] = actual;
                });
                snap.selected = snap.selected.map(id => id === temp ? actual : id);
            }
            snap.html = template.innerHTML;
        }
        clearSelection(); hydrate(); record();
    });
})();
