const BIN_ID = "69a23a35d0ea881f40e076a1";
const API_KEY = "$2a$10$pb.AtTxlxRYS6pkVFag6xeON96aqdCGaUhdoyXLKA..Cpwp6WgWMa";

const APP_PASSWORD = API_KEY.slice(-3);
const ACCESS_KEY = "ANKI_APP_ACCESS_UNTIL";
const LS_LAST_DECK = "ANKI_LAST_DECK_ID";

function getBinId(){ return BIN_ID; }
function getApiKey(){ return API_KEY; }

function hasValidAccess(){
    const until = Number(localStorage.getItem(ACCESS_KEY) || "0");
    return Date.now() < until;
}

function grantAccessFor1Day(){
    const oneDay = 24 * 60 * 60 * 1000;
    localStorage.setItem(ACCESS_KEY, String(Date.now() + oneDay));
}

function requireAppPassword(){
    if(hasValidAccess()) return true;

    const typed = prompt("Enter password:");
    if(typed === null) return false;

    if(typed.trim() === APP_PASSWORD){
        grantAccessFor1Day();
        return true;
    }

    alert("Wrong password.");
    return false;
}

function escapeHtml(s){
    return String(s ?? "").replace(/[&<>"']/g, m => ({
        "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
    }[m]));
}

function toast(title, msg){
    const el = document.getElementById("toast");
    if(!el) return;
    el.innerHTML = `<strong>${escapeHtml(title)}</strong><div class="muted">${escapeHtml(msg)}</div>`;
    el.style.display = "block";
    clearTimeout(toast._t);
    toast._t = setTimeout(()=> el.style.display="none", 3200);
}

async function jsonbinFetch(method, path, body){
    const binId = getBinId();
    const key = getApiKey();
    if(!binId || !key) throw new Error("Missing JSONBin settings");

    const url = `https://api.jsonbin.io/v3/b/${binId}${path || ""}`;
    const res = await fetch(url, {
        method,
        headers: {
            "Content-Type":"application/json",
            "X-Master-Key": key
        },
        body: body ? JSON.stringify(body) : undefined
    });

    if(!res.ok){
        const txt = await res.text().catch(()=> "");
        throw new Error(`JSONBin error ${res.status}: ${txt.slice(0,200)}`);
    }
    return res.json();
}

async function loadDb(){
    const data = await jsonbinFetch("GET", "/latest");
    const record = data?.record;
    if(!record || typeof record !== "object"){
        return { decks: [], notes: { categories: [] } };
    }
    if(!Array.isArray(record.decks)) record.decks = [];
    if(!record.notes || typeof record.notes !== "object") record.notes = { categories: [] };
    if(!Array.isArray(record.notes.categories)) record.notes.categories = [];
    return record;
}

async function saveDb(db){
    await jsonbinFetch("PUT", "", db);
}

function setStatusConnected(ok){
    const badge = document.getElementById("statusBadge");
    if(!badge) return;
    if(ok){
        badge.textContent = "Connected";
        badge.style.color = "var(--ok)";
    }else{
        badge.textContent = "Not connected";
        badge.style.color = "var(--muted)";
    }
}

function uid(){
    return Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);
}

/* ---------------------------
 * Editor page
 * -------------------------- */
function initEditorPage(){
    let DB = { decks: [], notes: { categories: [] } };
    let currentDeckId = null;

    function autoResizeTextarea(el){
        el.style.height = "44px";
        el.style.height = el.scrollHeight + "px";
    }

    function getDeckById(id){
        return DB.decks.find(d => d.id === id) || null;
    }

    function ensureOneEmptyRow(){
        const deck = getDeckById(currentDeckId);
        if(!deck) return;
        if(deck.cards.length === 0) deck.cards.push({front:"", back:""});
    }

    function renderDeckSelect(){
        const sel = document.getElementById("deckSelect");
        sel.innerHTML = "";

        const opt0 = document.createElement("option");
        opt0.value = "";
        opt0.textContent = DB.decks.length ? "Select a deck…" : "No decks yet — create one";
        sel.appendChild(opt0);

        DB.decks
            .slice()
            .sort((a,b)=> (a.name||"").localeCompare(b.name||""))
            .forEach(d=>{
                const opt = document.createElement("option");
                opt.value = d.id;
                opt.textContent = d.name || "(Untitled)";
                sel.appendChild(opt);
            });

        sel.value = currentDeckId || "";
    }

    function focusCell(rowIndex, field){
        const el = document.querySelector(`[data-row="${rowIndex}"][data-field="${field}"]`);
        if(el) el.focus();
    }

    function renderRows(){
        const rowsEl = document.getElementById("rows");
        rowsEl.innerHTML = "";
        const deck = getDeckById(currentDeckId);
        if(!deck){
            rowsEl.innerHTML = `<div style="padding:16px;color:var(--muted)">Select or create a deck to start.</div>`;
            return;
        }

        ensureOneEmptyRow();

        deck.cards.forEach((card, idx)=>{
            const row = document.createElement("div");
            row.className = "row";
            row.dataset.index = String(idx);

            const c1 = document.createElement("div");
            c1.className = "cell";
            const in1 = document.createElement("textarea");
            in1.rows = 1;
            in1.placeholder = "Front…";
            in1.value = card.front;
            in1.dataset.row = String(idx);
            in1.dataset.field = "front";
            in1.addEventListener("input", (e)=>{
                deck.cards[idx].front = e.target.value.replace(/\\n/g,"\n");
                autoResizeTextarea(e.target);
            });

            const c2 = document.createElement("div");
            c2.className = "cell";
            const in2 = document.createElement("textarea");
            in2.rows = 1;
            in2.placeholder = "Back…";
            in2.value = card.back;
            in2.dataset.row = String(idx);
            in2.dataset.field = "back";
            in2.addEventListener("input", (e)=>{
                deck.cards[idx].back = e.target.value.replace(/\\n/g,"\n");
                autoResizeTextarea(e.target);
            });

            const trash = document.createElement("div");
            trash.className = "trash";
            trash.title = "Delete row";
            trash.innerHTML = `<i class="fa-solid fa-trash"></i>`;
            trash.addEventListener("click", ()=>{
                deleteRow(idx);
            });

            c1.appendChild(in1);
            c2.appendChild(in2);
            row.appendChild(c1);
            row.appendChild(c2);
            row.appendChild(trash);

            rowsEl.appendChild(row);
            autoResizeTextarea(in1);
            autoResizeTextarea(in2);
        });
    }

    function addRow(afterIndex){
        const deck = getDeckById(currentDeckId);
        if(!deck) return;

        const insertAt = (typeof afterIndex === "number") ? afterIndex + 1 : deck.cards.length;
        deck.cards.splice(insertAt, 0, { front:"", back:"" });
        renderRows();
        focusCell(insertAt, "front");
    }

    function deleteRow(index){
        const deck = getDeckById(currentDeckId);
        if(!deck) return;

        if(deck.cards.length === 1){
            deck.cards[0] = {front:"", back:""};
            renderRows();
            focusCell(0, "front");
            return;
        }

        deck.cards.splice(index, 1);
        renderRows();
        const next = Math.min(index, deck.cards.length-1);
        focusCell(next, "front");
    }

    function clearEmptyRows(){
        const deck = getDeckById(currentDeckId);
        if(!deck) return;

        deck.cards = deck.cards.filter(c => (c.front||"").trim() || (c.back||"").trim());
        if(deck.cards.length === 0) deck.cards = [{front:"", back:""}];
        renderRows();
        toast("Cleaned", "Removed empty rows.");
    }

    function readQuery(){
        const p = new URLSearchParams(location.search);
        return { deckId: p.get("deckId") || "" };
    }

    function selectDeck(id){
        currentDeckId = id || null;
        if(currentDeckId) localStorage.setItem(LS_LAST_DECK, currentDeckId);
        renderDeckSelect();
        renderRows();
    }

    document.getElementById("deckSelect").addEventListener("change", (e)=>{
        selectDeck(e.target.value);
    });

    document.getElementById("createDeckBtn").addEventListener("click", ()=>{
        const name = document.getElementById("newDeckName").value.trim();
        if(!name){
            toast("Name required", "Type a deck name to create it.");
            return;
        }
        const deck = {
            id: uid(),
            name,
            createdAt: new Date().toISOString(),
            cards: [{front:"", back:""}],
            completedReviews: []
        };
        DB.decks.push(deck);
        document.getElementById("newDeckName").value = "";
        selectDeck(deck.id);
        toast("Deck created", `"${name}" created.`);
    });

    document.getElementById("saveBtn").addEventListener("click", async ()=>{
        const deck = getDeckById(currentDeckId);
        if(!deck){
            toast("No deck", "Select a deck first.");
            return;
        }

        deck.cards = deck.cards
            .map(c => ({front:(c.front||""), back:(c.back||"")}))
            .filter(c => c.front.trim() || c.back.trim());

        if(deck.cards.length === 0) deck.cards = [{front:"", back:""}];

        try{
            await saveDb(DB);
            toast("Saved", "Deck saved to JSONBin.");
        }catch(err){
            toast("Save failed", err.message || String(err));
        }
    });

    document.getElementById("clearBtn").addEventListener("click", clearEmptyRows);

    document.addEventListener("keydown", (e)=>{
        const active = document.activeElement;
        const isInput = active && active.tagName === "TEXTAREA" && active.dataset && active.dataset.row != null;

        if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s"){
            e.preventDefault();
            document.getElementById("saveBtn").click();
            return;
        }

        // Shift+Enter = new card row
        if(isInput && e.key === "Enter" && e.shiftKey){
            e.preventDefault();
            const rowIndex = Number(active.dataset.row);
            addRow(rowIndex);
            return;
        }

        // Ctrl/Cmd + Shift + Backspace = delete row
        if(isInput && (e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "Backspace"){
            e.preventDefault();
            const rowIndex = Number(active.dataset.row);
            deleteRow(rowIndex);
        }
    });

    async function boot(showToastOnConnect=false){
        const has = !!getBinId() && !!getApiKey();
        setStatusConnected(has);

        if(!has){
            DB = { decks: [], notes: { categories: [] } };
            currentDeckId = null;
            renderDeckSelect();
            renderRows();
            if(showToastOnConnect) toast("Not connected", "Missing BIN_ID / API_KEY.");
            return;
        }

        try{
            DB = await loadDb();

            if(!DB || typeof DB !== "object" || !Array.isArray(DB.decks)){
                DB = { decks: [], notes: { categories: [] } };
                await saveDb(DB);
            }

            setStatusConnected(true);
            if(showToastOnConnect) toast("Connected", "Loaded JSONBin successfully.");

            const q = readQuery();
            const fromQuery = q.deckId && DB.decks.some(d=>d.id===q.deckId) ? q.deckId : "";
            const fromLast = localStorage.getItem(LS_LAST_DECK) || "";
            const pick = fromQuery || (fromLast && DB.decks.some(d=>d.id===fromLast) ? fromLast : "") || (DB.decks[0]?.id || "");
            selectDeck(pick);

        }catch(err){
            setStatusConnected(false);
            DB = { decks: [], notes: { categories: [] } };
            currentDeckId = null;
            renderDeckSelect();
            renderRows();
            toast("Connection failed", err.message || String(err));
        }
    }

    boot();
}

/* ---------------------------
 * Notes page
 * -------------------------- */
function initNotesPage(){
    let DB = { decks: [], notes: { categories: [] } };
    let activeCatId = null;
    let autosaveTimer = null;
    let dirty = false;

    const catListEl = document.getElementById("catList");
    const newCatNameEl = document.getElementById("newCatName");
    const catTitleEl = document.getElementById("catTitle");
    const notesEditorEl = document.getElementById("notesEditor");
    const updatedLabelEl = document.getElementById("updatedLabel");

    function getCategory(id){
        return (DB.notes.categories || []).find(c => c.id === id) || null;
    }

    function ensureOneCategory(){
        if((DB.notes.categories || []).length === 0){
            const c = {
                id: uid(),
                name: "General",
                content: "",
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            DB.notes.categories.push(c);
            activeCatId = c.id;
        } else if(!activeCatId || !getCategory(activeCatId)){
            activeCatId = DB.notes.categories[0].id;
        }
    }

    function fmtLocalDateTime(iso){
        try{
            const d = new Date(iso);
            const dd = String(d.getDate()).padStart(2,"0");
            const mm = String(d.getMonth()+1).padStart(2,"0");
            const yy = d.getFullYear();
            const hh = String(d.getHours()).padStart(2,"0");
            const mi = String(d.getMinutes()).padStart(2,"0");
            return `${dd}/${mm}/${yy} ${hh}:${mi}`;
        }catch{ return "—"; }
    }

    function setSaveState(state){
        const el = document.getElementById("saveState");
        el.textContent = state;
        if(state === "Saved") el.style.color = "var(--ok)";
        else if(state === "Saving…") el.style.color = "#ded7ff";
        else el.style.color = "var(--muted)";
    }

    function renderCategories(){
        const cats = (DB.notes.categories || []).slice().sort((a,b)=> (a.name||"").localeCompare(b.name||""));
        if(cats.length === 0){
            catListEl.innerHTML = `<div class="empty">No categories yet.</div>`;
            return;
        }

        catListEl.innerHTML = cats.map(c=>{
            const isActive = c.id === activeCatId;
            const updated = c.updatedAt ? fmtLocalDateTime(c.updatedAt) : "—";
            return `
                <div class="catItem ${isActive ? "active" : ""}" data-id="${escapeHtml(c.id)}">
                    <div style="min-width:0">
                        <div class="catName">${escapeHtml(c.name || "(Untitled)")}</div>
                        <div class="catMeta">Updated: ${escapeHtml(updated)}</div>
                    </div>
                    <div class="catBtns" onclick="event.stopPropagation()">
                        <button class="btn-ghost iconBtn" title="Rename" data-action="rename" data-id="${escapeHtml(c.id)}">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                        <button class="btn-danger iconBtn" title="Delete" data-action="delete" data-id="${escapeHtml(c.id)}">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join("");

        document.querySelectorAll(".catItem").forEach(item=>{
            item.addEventListener("click", ()=>{
                const id = item.getAttribute("data-id");
                switchCategory(id);
            });
        });

        document.querySelectorAll("[data-action='rename']").forEach(btn=>{
            btn.addEventListener("click", async ()=>{
                const id = btn.getAttribute("data-id");
                const cat = getCategory(id);
                if(!cat) return;
                const name = prompt("Rename category:", cat.name || "");
                if(name === null) return;
                const trimmed = name.trim();
                if(!trimmed) return toast("Name required", "Category name can't be empty.");
                cat.name = trimmed;
                cat.updatedAt = new Date().toISOString();
                await persist("Saved", true);
                renderCategories();
                if(activeCatId === id) syncEditorFromActive();
            });
        });

        document.querySelectorAll("[data-action='delete']").forEach(btn=>{
            btn.addEventListener("click", async ()=>{
                const id = btn.getAttribute("data-id");
                const cat = getCategory(id);
                if(!cat) return;
                const ok = confirm(`Delete category "${cat.name || "(Untitled)"}"?\n\nThis cannot be undone.`);
                if(!ok) return;

                DB.notes.categories = (DB.notes.categories || []).filter(c => c.id !== id);
                if(activeCatId === id) activeCatId = (DB.notes.categories[0]?.id || null);

                ensureOneCategory();
                syncEditorFromActive();
                renderCategories();
                await persist("Deleted", true);
            });
        });
    }

    function syncEditorFromActive(){
        const cat = getCategory(activeCatId);
        if(!cat){
            catTitleEl.value = "";
            notesEditorEl.value = "";
            updatedLabelEl.textContent = "—";
            return;
        }
        catTitleEl.value = cat.name || "";
        notesEditorEl.value = cat.content || "";
        updatedLabelEl.textContent = cat.updatedAt ? `Updated: ${fmtLocalDateTime(cat.updatedAt)}` : "—";
        dirty = false;
        setSaveState("Idle");
    }

    function switchCategory(id){
        if(id === activeCatId) return;
        if(dirty){
            const ok = confirm("You have unsaved changes. Switch category anyway?");
            if(!ok) return;
        }
        activeCatId = id;
        syncEditorFromActive();
        renderCategories();
    }

    async function persist(okLabel="Saved", silent=false){
        setSaveState("Saving…");
        try{
            await saveDb(DB);
            setSaveState("Saved");
            dirty = false;
            if(!silent) toast(okLabel, "Changes saved to JSONBin.");
            const cat = getCategory(activeCatId);
            if(cat) updatedLabelEl.textContent = `Updated: ${fmtLocalDateTime(cat.updatedAt)}`;
        }catch(err){
            setSaveState("Idle");
            toast("Save failed", err.message || String(err));
        }
    }

    function scheduleAutosave(){
        clearTimeout(autosaveTimer);
        autosaveTimer = setTimeout(async ()=>{
            if(!dirty) return;
            const cat = getCategory(activeCatId);
            if(!cat) return;
            cat.updatedAt = new Date().toISOString();
            await persist("Saved", true);
        }, 800);
    }

    document.getElementById("addCatBtn").addEventListener("click", async ()=>{
        const name = newCatNameEl.value.trim();
        if(!name) return toast("Name required", "Type a category name.");
        const c = {
            id: uid(),
            name,
            content: "",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        DB.notes.categories.push(c);
        newCatNameEl.value = "";
        activeCatId = c.id;
        renderCategories();
        syncEditorFromActive();
        await persist("Created", true);
        toast("Category created", `"${name}" created.`);
    });

    newCatNameEl.addEventListener("keydown", (e)=>{
        if(e.key === "Enter"){
            e.preventDefault();
            document.getElementById("addCatBtn").click();
        }
    });

    catTitleEl.addEventListener("input", ()=>{
        const cat = getCategory(activeCatId);
        if(!cat) return;
        cat.name = catTitleEl.value;
        cat.updatedAt = new Date().toISOString();
        dirty = true;
        setSaveState("Unsaved");
        renderCategories();
        scheduleAutosave();
    });

    notesEditorEl.addEventListener("input", ()=>{
        const cat = getCategory(activeCatId);
        if(!cat) return;
        cat.content = notesEditorEl.value;
        cat.updatedAt = new Date().toISOString();
        dirty = true;
        setSaveState("Unsaved");
        scheduleAutosave();
    });

    document.getElementById("saveBtn").addEventListener("click", async ()=>{
        const cat = getCategory(activeCatId);
        if(!cat) return;
        cat.updatedAt = new Date().toISOString();
        await persist("Saved", false);
    });

    document.getElementById("refreshBtn").addEventListener("click", ()=> boot(true));

    window.addEventListener("beforeunload", (e)=>{
        if(!dirty) return;
        e.preventDefault();
        e.returnValue = "";
    });

    async function boot(showToast=false){
        const has = !!getBinId() && !!getApiKey();
        setStatusConnected(has);

        if(!has){
            DB = { decks: [], notes: { categories: [] } };
            catListEl.innerHTML = `<div class="empty">Missing BIN_ID / API_KEY.</div>`;
            return;
        }

        try{
            DB = await loadDb();
            if(!DB.notes || typeof DB.notes !== "object") DB.notes = { categories: [] };
            if(!Array.isArray(DB.notes.categories)) DB.notes.categories = [];

            ensureOneCategory();
            renderCategories();
            syncEditorFromActive();

            setStatusConnected(true);
            if(showToast) toast("Loaded", "Notes loaded from JSONBin.");
        }catch(err){
            setStatusConnected(false);
            toast("Connection failed", err.message || String(err));
        }
    }

    boot();
}

/* ---------------------------
 * Dashboard page
 * -------------------------- */
function initDashboardPage(){
    let DB = { decks: [], notes: { categories: [] } };

    const INTERVALS = [1,3,7,14,28];

    function dueInfo(deck){
        const created = new Date(deck.createdAt);
        const today = startOfLocalDay(new Date());
        const completed = new Set(deck.completedReviews || []);
        for(const n of INTERVALS){
            const dueDate = startOfLocalDay(addDays(created, n));
            if(today >= dueDate && !completed.has(n)){
                return { due:true, reviewNumber:n, dueDate };
            }
        }
        return { due:false, reviewNumber:null, dueDate:null };
    }

    function isFullyReviewed(deck){
        const completed = new Set(deck.completedReviews || []);
        return INTERVALS.every(n => completed.has(n));
    }

    function startOfLocalDay(d){
        return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    }

    function addDays(date, days){
        const d = new Date(date);
        d.setDate(d.getDate() + days);
        return d;
    }

    function fmtLocalDate(iso){
        try{
            const d = new Date(iso);
            const dd = String(d.getDate()).padStart(2,"0");
            const mm = String(d.getMonth()+1).padStart(2,"0");
            const yy = d.getFullYear();
            return `${dd}/${mm}/${yy}`;
        }catch{ return iso; }
    }

    function deckCardHtml(deck){
        const info = dueInfo(deck);
        const cardCount = Array.isArray(deck.cards) ? deck.cards.filter(c => (c.front||"").trim() || (c.back||"").trim()).length : 0;

        const pill = info.due
            ? `<span class="pill due">Review #${info.reviewNumber} • due ${fmtLocalDate(info.dueDate.toISOString())}</span>`
            : `<span class="pill ${isFullyReviewed(deck) ? "done" : ""}">${isFullyReviewed(deck) ? "All reviews done" : "Not due yet"}</span>`;

        return `
            <div class="deck">
                <div class="meta">
                    <div class="name">${escapeHtml(deck.name || "(Untitled)")}</div>
                    <div class="sub">
                        Created: ${escapeHtml(fmtLocalDate(deck.createdAt))} • Cards: ${cardCount}
                    </div>
                    ${pill}
                </div>
<div class="actions">
  ${info.due ? `<button class="btn-ok" data-action="review" data-id="${escapeHtml(deck.id)}"><i class="fa-solid fa-play"></i> Review</button>` : ``}

  <button class="btn-ghost" data-action="edit" data-id="${escapeHtml(deck.id)}">
    <i class="fa-solid fa-pen"></i>
  </button>

  <button class="btn-ghost" data-action="rename" data-id="${escapeHtml(deck.id)}">
    <i class="fa-solid fa-font"></i>
  </button>

  <button class="btn-ghost" data-action="date" data-id="${escapeHtml(deck.id)}">
    <i class="fa-solid fa-calendar"></i>
  </button>

  <button class="btn-danger" data-action="delete" data-id="${escapeHtml(deck.id)}">
    <i class="fa-solid fa-trash"></i>
  </button>
</div>
            </div>
        `;
    }

    function renderLists(){
        const toEl = document.getElementById("toReviewList");
        const doneEl = document.getElementById("reviewedList");

        const decks = (DB.decks || []).slice().sort((a,b)=> (a.name||"").localeCompare(b.name||""));

        const toReview = [];
        const reviewed = [];

        for(const d of decks){
            const info = dueInfo(d);
            if(info.due) toReview.push(d);
            else reviewed.push(d);
        }

        if(toReview.length === 0){
            toEl.innerHTML = `<div class="empty">Nothing due today.</div>`;
        }else{
            toReview.sort((a,b)=> dueInfo(a).reviewNumber - dueInfo(b).reviewNumber);
            toEl.innerHTML = toReview.map(d=>deckCardHtml(d)).join("");
        }

        if(reviewed.length === 0){
            doneEl.innerHTML = `<div class="empty">No decks here yet.</div>`;
        }else{
            doneEl.innerHTML = reviewed.map(d=>deckCardHtml(d)).join("");
        }

        document.querySelectorAll("[data-action='edit']").forEach(btn=>{
            btn.addEventListener("click", ()=>{
                const id = btn.getAttribute("data-id");
                window.location.href = `../index.html?deckId=${encodeURIComponent(id)}`;
            });
        });

        document.querySelectorAll("[data-action='review']").forEach(btn=>{
            btn.addEventListener("click", ()=>{
                const id = btn.getAttribute("data-id");
                startReview(id);
            });
        });

        document.querySelectorAll("[data-action='delete']").forEach(btn=>{
            btn.addEventListener("click", async ()=>{
                const id = btn.getAttribute("data-id");
                const deck = getDeck(id);
                if(!deck) return toast("Not found", "Deck not found.");

                const ok = confirm(`Delete deck "${deck.name || "(Untitled)"}"?\n\nThis cannot be undone.`);
                if(!ok) return;

                if (overlay.style.display === "flex" && review.deckId === id) {
                    closeOverlay();
                }

                DB.decks = (DB.decks || []).filter(d => d.id !== id);

                try{
                    await saveDb(DB);
                    toast("Deleted", "Deck removed.");
                    renderLists();
                }catch(err){
                    toast("Delete failed", err.message || String(err));
                }
            });
        });
        document.querySelectorAll("[data-action='rename']").forEach(btn=>{
            btn.addEventListener("click", async ()=>{
                const id = btn.getAttribute("data-id");
                const deck = getDeck(id);
                if(!deck) return;

                const name = prompt("New deck name:", deck.name || "");
                if(name === null) return;

                const trimmed = name.trim();
                if(!trimmed) return;

                deck.name = trimmed;

                try{
                    await saveDb(DB);
                    toast("Saved", "Deck renamed.");
                    renderLists();
                }catch(err){
                    toast("Error", err.message || String(err));
                }
            });
        });

        document.querySelectorAll("[data-action='date']").forEach(btn=>{
            btn.addEventListener("click", async ()=>{
                const id = btn.getAttribute("data-id");
                const deck = getDeck(id);
                if(!deck) return;

                const current = deck.createdAt ? deck.createdAt.slice(0,10) : "";

                const date = prompt("Deck creation date (YYYY-MM-DD):", current);
                if(date === null) return;

                const parsed = new Date(date);
                if(isNaN(parsed)) {
                    alert("Invalid date.");
                    return;
                }

                deck.createdAt = parsed.toISOString();

                try{
                    await saveDb(DB);
                    toast("Saved", "Deck date updated.");
                    renderLists();
                }catch(err){
                    toast("Error", err.message || String(err));
                }
            });
        });
    }

    const overlay = document.getElementById("reviewOverlay");
    const cardFace = document.getElementById("cardFace");
    const reviewDeckTitle = document.getElementById("reviewDeckTitle");
    const reviewProgress = document.getElementById("reviewProgress");
    const reviewPill = document.getElementById("reviewPill");

    let review = {
        deckId:null,
        deck:null,
        reviewNumber:null,
        queue:[],
        againPile:[],
        i:0,
        showingBack:false
    };

    function openOverlay(){
        overlay.style.display = "flex";
        overlay.setAttribute("aria-hidden","false");
    }
    function closeOverlay(){
        overlay.style.display = "none";
        overlay.setAttribute("aria-hidden","true");
    }

    function shuffle(arr){
        for(let i=arr.length-1;i>0;i--){
            const j = Math.floor(Math.random()*(i+1));
            [arr[i],arr[j]] = [arr[j],arr[i]];
        }
        return arr;
    }

    function getDeck(id){
        return (DB.decks || []).find(d=>d.id===id) || null;
    }

    function cleanCards(cards){
        return (cards || [])
            .map(c=>({front:String(c?.front||""), back:String(c?.back||"")}))
            .filter(c => c.front.trim() || c.back.trim());
    }

    function setFace(){
        const total = review.queue.length + review.againPile.length;
        const done = review.i;
        reviewProgress.textContent = `${Math.min(done+1, total)}/${Math.max(total,1)} • Space to flip`;

        const current = review.queue[review.i] || null;
        if(!current){
            cardFace.textContent = "Done!";
            reviewProgress.textContent = "Finished";
            return;
        }

        const text = review.showingBack ? (current.back || "(empty)") : (current.front || "(empty)");
        cardFace.textContent = text;
    }

    function nextCard(){
        review.showingBack = false;

        if(review.i >= review.queue.length){
            if(review.againPile.length){
                review.queue = shuffle(review.againPile);
                review.againPile = [];
                review.i = 0;
                setFace();
                return;
            }
            finishDeckReview();
            return;
        }

        setFace();
    }

    function startReview(deckId){
        const deck = getDeck(deckId);
        if(!deck){
            toast("Missing deck", "Deck not found.");
            return;
        }
        const info = dueInfo(deck);
        if(!info.due){
            toast("Not due", "This deck is not due today.");
            return;
        }

        const cards = cleanCards(deck.cards);
        if(cards.length === 0){
            toast("No cards", "This deck has no cards to review.");
            return;
        }

        review.deckId = deckId;
        review.deck = deck;
        review.reviewNumber = info.reviewNumber;
        review.queue = shuffle(cards.slice());
        review.againPile = [];
        review.i = 0;
        review.showingBack = false;

        reviewDeckTitle.textContent = deck.name || "(Untitled)";
        reviewPill.textContent = `Review #${info.reviewNumber}`;
        setFace();
        openOverlay();
    }

    function finishDeckReview(){
        const deck = getDeck(review.deckId);
        if(!deck){
            toast("Error", "Deck disappeared.");
            closeOverlay();
            return;
        }

        const n = review.reviewNumber;
        deck.completedReviews = Array.isArray(deck.completedReviews) ? deck.completedReviews : [];
        if(!deck.completedReviews.includes(n)) deck.completedReviews.push(n);
        deck.completedReviews.sort((a,b)=>a-b);

        saveDb(DB)
            .then(()=>{
                toast("Saved", `Completed review #${n} for "${deck.name}".`);
                closeOverlay();
                renderLists();
            })
            .catch(err=>{
                toast("Save failed", err.message || String(err));
                closeOverlay();
                renderLists();
            });
    }

    document.getElementById("exitReviewBtn").addEventListener("click", ()=>{
        closeOverlay();
    });

    document.getElementById("goodBtn").addEventListener("click", ()=>{
        review.i++;
        nextCard();
    });

    document.getElementById("againBtn").addEventListener("click", ()=>{
        const current = review.queue[review.i];
        if(current) review.againPile.push(current);
        review.i++;
        nextCard();
    });

    cardFace.addEventListener("click", ()=>{
        review.showingBack = !review.showingBack;
        setFace();
    });

    document.addEventListener("keydown", (e)=>{
        if(overlay.style.display !== "flex") return;

        if(e.key === "Escape"){
            closeOverlay();
            return;
        }
        if(e.key === " "){
            e.preventDefault();
            review.showingBack = !review.showingBack;
            setFace();
            return;
        }
        if(e.key === "ArrowRight" || e.key === "2"){
            e.preventDefault();
            document.getElementById("goodBtn").click();
            return;
        }
        if(e.key === "ArrowLeft" || e.key === "1"){
            e.preventDefault();
            document.getElementById("againBtn").click();
        }
    });

    document.getElementById("refreshBtn").addEventListener("click", ()=> boot(true));

    async function boot(showToast=false){
        const has = !!getBinId() && !!getApiKey();
        setStatusConnected(has);

        if(!has){
            DB = { decks: [], notes: { categories: [] } };
            renderLists();
            if(showToast) toast("Not connected", "Missing BIN_ID / API_KEY.");
            return;
        }

        try{
            DB = await loadDb();
            if(!DB || typeof DB !== "object" || !Array.isArray(DB.decks)){
                DB = { decks: [], notes: { categories: [] } };
                await saveDb(DB);
            }
            setStatusConnected(true);
            renderLists();
            if(showToast) toast("Loaded", "Decks loaded from JSONBin.");
        }catch(err){
            setStatusConnected(false);
            DB = { decks: [], notes: { categories: [] } };
            renderLists();
            toast("Connection failed", err.message || String(err));
        }
    }

    boot();
}

/* ---------------------------
 * Init
 * -------------------------- */
document.addEventListener("DOMContentLoaded", ()=>{
    if(!requireAppPassword()){
        document.body.innerHTML = "";
        return;
    }

    const page = document.body.dataset.page;
    if(page === "editor") initEditorPage();
    if(page === "notes") initNotesPage();
    if(page === "dashboard") initDashboardPage();
});