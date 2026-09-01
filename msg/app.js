const BIN_ID = "69a23a35d0ea881f40e076a1";
const API_KEY = "$2a$10$pb.AtTxlxRYS6pkVFag6xeON96aqdCGaUhdoyXLKA..Cpwp6WgWMa";

const APP_PASSWORD = API_KEY.slice(-3);
const ACCESS_KEY = "ANKI_APP_ACCESS_UNTIL";
const FIELD_IDS = ["msg1", "msg2", "msg3", "msg4", "msg5"];
const AUTOSAVE_DELAY = 500;

let autosaveTimer = null;
let saveInFlight = false;
let saveQueued = false;

function hasValidAccess(){
    const until = Number(localStorage.getItem(ACCESS_KEY) || "0");
    return Date.now() < until;
}

function grantAccessFor1Day(){
    localStorage.setItem(ACCESS_KEY, String(Date.now() + 24 * 60 * 60 * 1000));
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

function escapeHtml(value){
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
    }[char]));
}

function toast(title, message){
    const el = document.getElementById("toast");
    el.innerHTML = `<strong>${escapeHtml(title)}</strong><div class="muted">${escapeHtml(message)}</div>`;
    el.style.display = "block";
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => el.style.display = "none", 3200);
}

function setConnected(connected){
    const badge = document.getElementById("statusBadge");
    badge.textContent = connected ? "Connected" : "Not connected";
    badge.style.color = connected ? "var(--ok)" : "var(--muted)";
}

function setSaveStatus(text){
    document.getElementById("saveStatus").textContent = text;
}

async function jsonbinFetch(method, path = "", body){
    const response = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}${path}`, {
        method,
        headers: {
            "Content-Type": "application/json",
            "X-Master-Key": API_KEY
        },
        body: body === undefined ? undefined : JSON.stringify(body)
    });

    if(!response.ok){
        const text = await response.text().catch(() => "");
        throw new Error(`JSONBin error ${response.status}: ${text.slice(0, 200)}`);
    }
    return response.json();
}

async function loadLatestRecord(){
    const data = await jsonbinFetch("GET", "/latest");
    return data?.record && typeof data.record === "object" ? data.record : {};
}

function normalizeFields(msg){
    if(Array.isArray(msg)) return FIELD_IDS.map((_, i) => String(msg[i] ?? ""));
    if(msg && Array.isArray(msg.fields)) return FIELD_IDS.map((_, i) => String(msg.fields[i] ?? ""));
    if(typeof msg === "string") return [msg, "", "", "", ""];
    return ["", "", "", "", ""];
}

function readFields(){
    return FIELD_IDS.map(id => document.getElementById(id).value);
}

function writeFields(values){
    FIELD_IDS.forEach((id, index) => {
        document.getElementById(id).value = values[index] ?? "";
    });
}

async function load(){
    try{
        const record = await loadLatestRecord();
        writeFields(normalizeFields(record.msg));
        setConnected(true);
        setSaveStatus("Saved");
    }catch(error){
        setConnected(false);
        toast("Connection failed", error.message || String(error));
    }
}

function scheduleAutoSave(){
    clearTimeout(autosaveTimer);
    setSaveStatus("Unsaved");
    autosaveTimer = setTimeout(() => save(false), AUTOSAVE_DELAY);
}

async function save(showSuccessToast = true){
    clearTimeout(autosaveTimer);
    autosaveTimer = null;

    if(saveInFlight){
        saveQueued = true;
        return;
    }

    const topButton = document.getElementById("saveBtn");
    const bottomButton = document.getElementById("saveBtnBottom");
    saveInFlight = true;
    topButton.disabled = true;
    bottomButton.disabled = true;
    setSaveStatus("Saving...");

    try{
        const latest = await loadLatestRecord();
        latest.msg = {
            fields: readFields(),
            updatedAt: new Date().toISOString()
        };
        await jsonbinFetch("PUT", "", latest);
        setConnected(true);
        setSaveStatus("Saved");
        if(showSuccessToast){
            toast("Saved", "All five fields were saved to JSONBin.");
        }
    }catch(error){
        setConnected(false);
        setSaveStatus("Save failed");
        toast("Save failed", error.message || String(error));
    }finally{
        saveInFlight = false;
        topButton.disabled = false;
        bottomButton.disabled = false;

        if(saveQueued){
            saveQueued = false;
            save(false);
        }
    }
}

FIELD_IDS.forEach(id => {
    document.getElementById(id).addEventListener("input", scheduleAutoSave);
});

document.querySelectorAll(".copy-btn").forEach(button => {
    button.addEventListener("click", async () => {
        const field = document.getElementById(button.dataset.target);
        await navigator.clipboard.writeText(field.value);
        const icon = button.querySelector("i");
        icon.className = "fa-solid fa-check";
        setTimeout(() => icon.className = "fa-regular fa-copy", 900);
    });
});

document.getElementById("saveBtn").addEventListener("click", () => save(true));
document.getElementById("saveBtnBottom").addEventListener("click", () => save(true));
document.addEventListener("keydown", event => {
    if((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s"){
        event.preventDefault();
        save(true);
    }
});

if(requireAppPassword()){
    load();
}else{
    setConnected(false);
    document.querySelectorAll("textarea, button").forEach(el => el.disabled = true);
}
