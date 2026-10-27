(() => {
  const section=document.createElement("section");
  section.className="project env-panel";
  section.setAttribute("aria-labelledby","env-title");
  section.innerHTML='<h2 id="env-title">iMenu environments</h2><form id="env-unlock"><label>Environment password<input id="env-password" type="password" autocomplete="current-password" required></label><button>Unlock environments</button></form><div id="env-content" hidden><div class="env-toolbar"><label>Scope<select id="env-scope"><option value="staging">Staging · runtime</option><option value="staging-build">Staging · build</option><option value="production">Production · runtime</option><option value="production-build">Production · build</option></select></label><button type="button" id="env-refresh">Refresh</button><button type="button" id="env-lock">Lock</button></div><p class="empty">Values stay hidden. Changes apply on the next deployment; no service is restarted.</p><ul id="env-keys"></ul><form id="env-edit"><label>Variable name<input id="env-key" pattern="[A-Za-z_][A-Za-z0-9_]*" required autocomplete="off"></label><label>New value<input id="env-value" type="password" autocomplete="new-password" required></label><button>Add / replace variable</button></form></div><p id="env-status" role="status" aria-live="polite"></p>';
  document.querySelector("main").append(section);
  let password="",busy=false;
  const $=id=>section.querySelector("#env-"+id);
  const status=text=>{$("status").textContent=text;};
  const scope=()=>$("scope").value;
  function lock(){ password="";$("password").value="";$("value").value="";$("keys").replaceChildren();$("content").hidden=true;$("unlock").hidden=false;status(""); }
  async function api(action,extra={}){
    const response=await fetch("/.netlify/functions/imenu-env",{method:"POST",headers:{"Content-Type":"application/json"},cache:"no-store",body:JSON.stringify({password,scope:scope(),action,...extra}),signal:AbortSignal.timeout(15000)});
    const data=await response.json();
    if(!response.ok){if(response.status===401)lock();throw new Error(data.error||"Request failed.");}
    return data;
  }
  async function refresh(){
    const data=await api("list");
    $("keys").replaceChildren();
    for(const key of data.keys){
      const li=document.createElement("li"),name=document.createElement("code"),edit=document.createElement("button"),del=document.createElement("button");
      name.textContent=key;edit.textContent="Replace";del.textContent="Delete";edit.type=del.type="button";
      edit.onclick=()=>{$("key").value=key;$("value").focus();};
      del.onclick=()=>run(async()=>{if(!confirm("Delete "+key+" from "+scope()+"?"))return;await api("delete",{key,confirm:true});await refresh();status("Variable deleted. Applies on next deployment.");});
      li.append(name,edit,del);$("keys").append(li);
    }
  }
  async function run(fn){if(busy)return;busy=true;section.querySelectorAll("button,input,select").forEach(e=>e.disabled=true);status("Working…");try{await fn();}catch(e){status(e.message);}finally{busy=false;section.querySelectorAll("button,input,select").forEach(e=>e.disabled=false);}}
  $("unlock").onsubmit=e=>{e.preventDefault();run(async()=>{password=$("password").value;await refresh();$("password").value="";$("unlock").hidden=true;$("content").hidden=false;status("");});};
  $("scope").onchange=()=>run(async()=>{$("keys").replaceChildren();$("key").value="";$("value").value="";await refresh();status("");});
  $("refresh").onclick=()=>run(async()=>{await refresh();status("");});
  $("lock").onclick=lock;
  $("edit").onsubmit=e=>{e.preventDefault();run(async()=>{const key=$("key").value;if(!confirm("Add or replace "+key+" in "+scope()+"?"))return;await api("set",{key,value:$("value").value,confirm:true});$("value").value="";await refresh();status("Variable saved. Applies on next deployment.");});};
  window.addEventListener("pagehide",lock);
})();
