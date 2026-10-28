import {MISSIONS,WEAPONS,GADGETS,UPGRADES,profileDefaults,normalizeProfile,availableWeapons,availableGadgets,clamp,CELL,makeGrid} from './data.js?v=4';
import {makeRun,stepRun,nearbyTask,objectiveReady} from './simulation.js?v=9';
import {View} from './render.js?v=8';
import {Safehouse,SAFEHOUSE_STATIONS} from './safehouse.js?v=6';
import {canEquipWeapon,canEquipGadget,equippedKit,purchaseGear,settleGear,chooseGearSnapshot} from './armory.js';
const $=id=>document.getElementById(id);
const key=name=>'getaway-v3-'+name.toLowerCase();
const operatorCookie='getaway-operator';
function rememberOperator(name){
 if(!/^[a-zA-Z0-9_-]{3,24}$/.test(name))return;
 document.cookie=operatorCookie+'='+encodeURIComponent(name)+'; Max-Age=31536000; Path=/game2; SameSite=Lax'+(location.protocol==='https:'?'; Secure':'');
}
function rememberedOperator(){
 const entry=document.cookie.split(';').map(part=>part.trim()).find(part=>part.startsWith(operatorCookie+'='));
 let name='';
 try{if(entry)name=decodeURIComponent(entry.slice(operatorCookie.length+1));}catch{}
 if(/^[a-zA-Z0-9_-]{3,24}$/.test(name))return name;
 // Automatically migrate operators remembered by earlier versions of the game.
 try{name=localStorage.getItem('getaway-last-operator')||localStorage.getItem('getaway-profile-name')||'';}catch{}
 return /^[a-zA-Z0-9_-]{3,24}$/.test(name)?name:'';
}
// Isolated one-click level-one run, without touching real operator saves.
const quickTest=/^\/game2\/test\/?$/.test(location.pathname);
let profile=profileDefaults('OPERATOR'),loadedName='',cloudAvailable=false;
let mode='menu',host=true,peer=null,conn=null,room='',remoteKit=null,remoteInput={};
let view=null,run=null,softPaused=false,activeOverlay='',lastPhase='',lastRunId='',credited=new Set(),gearSettled=new Set();
let safehouse=null,activeStation='',lastSafehousePrompt=0,lastStation='missions';
let selectedMission=0,selectedWeapon='pistol',selectedGadget='',last=0,lastNetwork=0,lastHud=0,lastFoot=0,lastShots=0,lastHits=0,lastHeadshots=0,lastHp=100,lastToast='',lastToastUntil=0,hitMarkerTimer=null,damageIndicatorTimer=null;
const controls={forward:false,back:false,left:false,right:false,walk:false,fire:false,reload:false,interact:false,gadget:false,aim:false,yaw:-Math.PI/2,pitch:0};
let audio=null,muted=localStorage.getItem('getaway-muted')==='true';
const coins=n=>'₵ '+Math.max(0,Math.floor(n||0)).toLocaleString('en-US');
function status(message){$('connectStatus').textContent=message;}
function profileStatus(message){$('profileStatus').textContent=message;}
function profileWallet(){return Math.max(0,(profile.earned||0)-(profile.spent||0));}
function saveLocal(){if(!loadedName)return;try{localStorage.setItem(key(loadedName),JSON.stringify(profile));localStorage.setItem('getaway-last-operator',loadedName);}catch{}rememberOperator(loadedName);}
function mergeProfiles(local,remote,name){
 const a=normalizeProfile(local,name),b=normalizeProfile(remote,name);
 const merged=profileDefaults(name);
 merged.unlocked=Math.max(a.unlocked,b.unlocked);
 merged.completed=a.completed||b.completed;
 merged.earned=Math.max(a.earned,b.earned);merged.spent=Math.max(a.spent,b.spent);
 for(const k of Object.keys(UPGRADES))merged.upgrades[k]=Math.max(a.upgrades[k],b.upgrades[k]);
 merged.cleared=[...new Set([...a.cleared,...b.cleared])];
 merged.best={...b.best,...a.best};
 const gear=chooseGearSnapshot(a,b);
 merged.weapons=[...gear.weapons];merged.gadgetStock={...gear.gadgetStock};
 merged.gearRev=gear.gearRev;merged.gearUpdatedAt=gear.gearUpdatedAt;
 return merged;
}
async function getCloud(name){
 const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),3800);
 try{const response=await fetch('/.netlify/functions/getaway-profile-v2?name='+encodeURIComponent(name),{cache:'no-store',signal:ctl.signal});if(!response.ok)throw Error('cloud unavailable');return await response.json();}
 finally{clearTimeout(timer);}
}
let cloudTimer=0;
async function syncCloud(){
 if(!loadedName)return;
 try{const response=await fetch('/.netlify/functions/getaway-profile-v2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(profile)});if(!response.ok)throw Error('cloud offline');cloudAvailable=true;profileStatus('SAVED LOCALLY + CLOUD SYNCED');}
 catch{cloudAvailable=false;profileStatus('SAVED ON THIS DEVICE · CLOUD UNAVAILABLE');}
}
function scheduleSave(){saveLocal();clearTimeout(cloudTimer);cloudTimer=setTimeout(()=>void syncCloud(),800);}
async function ensureProfile(force=false){
 const name=$('playerName').value.trim();
 if(!/^[a-zA-Z0-9_-]{3,24}$/.test(name)){profileStatus('USE 3–24 LETTERS, NUMBERS, _ OR -');return false;}
 if(!force&&loadedName===name.toLowerCase())return true;
 profileStatus('LOADING OPERATOR DOSSIER…');
 let local=null;try{local=JSON.parse(localStorage.getItem(key(name))||'null')}catch{}
 // Older versions stored unlocked jobs under this key.
 try{const previous=JSON.parse(localStorage.getItem('getaway-profile-'+name.toLowerCase())||'null');if(previous)local=mergeProfiles(local,previous,name);}catch{}
 if(local){
  // Returning operators start instantly even when cloud storage is unreachable.
  profile=normalizeProfile(local,name);loadedName=name.toLowerCase();saveLocal();
  const cachedKit=readLoadout();selectedWeapon=cachedKit.weapon;selectedGadget=cachedKit.gadget;
  selectedMission=Math.min(selectedMission,profile.unlocked);refreshMenu();
  profileStatus('OPERATOR LOADED · LOCAL SAVE READY');
  void getCloud(name).then(remote=>{
   if(loadedName!==name.toLowerCase())return;
   cloudAvailable=true;profile=mergeProfiles(profile,remote,name);saveLocal();refreshMenu();
   profileStatus('OPERATOR LOADED · CLOUD SYNC ACTIVE');
   if(profile.earned>(remote.earned||0)||profile.unlocked>(remote.unlocked||0))scheduleSave();
  }).catch(()=>{if(loadedName===name.toLowerCase()){cloudAvailable=false;profileStatus('SAVED LOCALLY · CLOUD CURRENTLY OFFLINE');}});
  return true;
 }
 let remote=null;try{remote=await getCloud(name);cloudAvailable=true;}catch{cloudAvailable=false;}
 profile=mergeProfiles(local,remote,name);loadedName=name.toLowerCase();saveLocal();
 const kit=readLoadout();
 selectedWeapon=kit.weapon;selectedGadget=kit.gadget;
 selectedMission=Math.min(selectedMission,profile.unlocked);
 refreshMenu();
 profileStatus(cloudAvailable?'OPERATOR LOADED · CLOUD SYNC ACTIVE':'OPERATOR LOADED · SAVING LOCALLY');
 if(cloudAvailable&&local&&(!remote||local.unlocked>(remote.unlocked||0)||local.earned>(remote.earned||0)))scheduleSave();
 return true;
}
function readLoadout(){
 try{return JSON.parse(localStorage.getItem('getaway-kit-'+loadedName)||'null')||{weapon:'pistol',gadget:''};}catch{return {weapon:'pistol',gadget:''};}
}
function persistLoadout(){if(loadedName)try{localStorage.setItem('getaway-kit-'+loadedName,JSON.stringify({weapon:selectedWeapon,gadget:selectedGadget}));}catch{}}
function kit(){return {name:profile.name,...equippedKit(profile,selectedWeapon,selectedGadget),upgrades:profile.upgrades};}
function renderArmoryShop(){
 const weaponMount=$('station-weapons')||$('weapon')?.closest('.loadoutWrap');
 const gadgetMount=$('station-gadgets')||weaponMount;
 if(!weaponMount)return;
 const mountShop=(mount,id)=>{
  let root=$(id);if(!root){root=document.createElement('div');root.id=id;root.className='armoryShop';mount.append(root);}
  return root;
 };
 const weaponShop=mountShop(weaponMount,'armoryWeapons');
 const gadgetShop=mountShop(gadgetMount,'armoryGadgets');
 const catalog=(kind,items)=>Object.entries(items).map(([id,item])=>{
  const unlocked=item.unlock<=profile.unlocked;
  const owned=kind==='weapon'?canEquipWeapon(profile,id):(profile.gadgetStock[id]||0)>0;
  const qty=kind==='gadget'?' · '+(profile.gadgetStock[id]||0)+' CHARGES':'';
  const stocked=kind==='gadget'&&(profile.gadgetStock[id]||0)+item.charges>30;
  const affordable=loadedName&&unlocked&&item.cost>0&&profileWallet()>=item.cost&&!stocked&&!(kind==='weapon'&&owned);
  const action=!unlocked?'JOB '+(item.unlock+1)+' REQUIRED':kind==='weapon'&&owned?'IN INVENTORY':stocked?'STOCK FULL':item.cost===0?'FREE ISSUE':'BUY '+coins(item.cost);
  return `<article data-display-kind="${kind}" data-display-id="${id}" class="shopCard ${unlocked?'':'shopLocked'}"><div class="shopMeta">${item.class||'TACTICAL GEAR'} · ${unlocked?'AVAILABLE':'LOCKED'}${qty}</div><h3>${item.name}</h3><p>${item.description}</p><div class="shopFoot"><b>${item.cost?coins(item.cost):'FREE'}</b><button data-buy-kind="${kind}" data-buy-id="${id}" ${affordable?'':'disabled'}>${action}</button></div></article>`;
 }).join('');
 weaponShop.innerHTML=`<div class="shopHeading">PURCHASED WEAPONS <small>OWNED GUNS SURVIVE SUCCESS · DEPLOYED GUNS ARE LOST ON FAILURE</small></div><div class="shopCards">${catalog('weapon',WEAPONS)}</div>`;
 gadgetShop.innerHTML=`<div class="shopHeading">TACTICAL SUPPLIES <small>BUY CHARGE PACKS · USED CHARGES ARE SPENT · DEPLOYED STOCK IS LOST ON FAILURE</small></div><div class="shopCards">${catalog('gadget',GADGETS)}</div>`;
 for(const root of [weaponShop,gadgetShop])root.querySelectorAll('[data-buy-id]').forEach(button=>button.onclick=()=>{
  const kind=button.dataset.buyKind,id=button.dataset.buyId;
  if(!purchaseGear(profile,kind,id))return;
  if(kind==='weapon')selectedWeapon=id;else selectedGadget=id;
  persistLoadout();scheduleSave();refreshMenu();beep('purchase');
 });
}
function settleDeployedGear(completedRun){
 if(!loadedName||gearSettled.has(completedRun.runId))return;
 gearSettled.add(completedRun.runId);
 const p=completedRun.players[host?0:1]||completedRun.players[0];
 if(settleGear(profile,p,completedRun.phase==='lost')){
  if(!canEquipWeapon(profile,selectedWeapon))selectedWeapon='pistol';
  if(!canEquipGadget(profile,selectedGadget))selectedGadget='';
  persistLoadout();scheduleSave();refreshMenu();
 }
 if(!host)send({type:'kit-update',kit:kit()});
}
function refreshMenu(){
 $('wallet').textContent=coins(profileWallet());$('cleared').textContent=String(profile.cleared.length).padStart(2,'0')+' / 05';$('operator').textContent=loadedName?profile.name.toUpperCase():'GUEST';
 $('progressText').textContent=profile.cleared.length+' / 5 JOBS';$('progressBar').style.width=(profile.cleared.length*20)+'%';
 const select=$('missionSelect');select.replaceChildren();
 for(let i=0;i<MISSIONS.length;i++){
  const m=MISSIONS[i],o=document.createElement('option');o.value=i;o.textContent=m.number+' / '+m.name+' — '+m.site+(i>profile.unlocked?' [LOCKED]':'');o.disabled=i>profile.unlocked;select.append(o);
 }
 selectedMission=Math.min(selectedMission,profile.unlocked);select.value=selectedMission;$('missionNumber').textContent=String(selectedMission+1).padStart(2,'0')+' / 05';
 $('jobBoard').innerHTML=MISSIONS.map((m,i)=>`<button class="jobCard ${i>profile.unlocked?'locked':''} ${selectedMission===i?'selected':''}" data-job="${i}" ${i>profile.unlocked?'disabled':''}><div class="jobState">${i>profile.unlocked?'▣ CLASSIFIED':profile.cleared.includes(m.id)?'✓ CLEARED':'◈ AVAILABLE'}</div><div class="jobIndex">${m.number}</div><h3>${m.name}</h3><p>${m.site} / ${m.type}</p><div class="jobReward">${coins(m.payout)} + COMBAT BONUS</div></button>`).join('');
 $('jobBoard').querySelectorAll('[data-job]').forEach(button=>button.onclick=()=>{selectedMission=Number(button.dataset.job);refreshMenu();});
 const available=availableWeapons(profile).filter(([id])=>canEquipWeapon(profile,id)),weap=$('weapon');weap.replaceChildren();
 for(const [id,w] of available){const o=document.createElement('option');o.value=id;o.textContent=w.name+' / '+w.class;weap.append(o);}
 if(!available.some(([id])=>id===selectedWeapon))selectedWeapon='pistol';weap.value=selectedWeapon;
 const gd=$('gadget');gd.replaceChildren();const zero=document.createElement('option');zero.value='';zero.textContent='NO GADGET';gd.append(zero);
 for(const [id,g] of availableGadgets(profile).filter(([id])=>canEquipGadget(profile,id))){const o=document.createElement('option');o.value=id;o.textContent=g.name+' / '+g.charges+' CHARGES';gd.append(o);}
 if(!canEquipGadget(profile,selectedGadget))selectedGadget='';gd.value=selectedGadget;
 const w=WEAPONS[selectedWeapon];$('weaponStats').textContent=w.damage+' BASE DAMAGE · '+w.mag+' ROUNDS · '+Math.round(1/w.rate*60)+' RPM';
 $('gadgetStats').textContent=selectedGadget?GADGETS[selectedGadget].description+' · '+profile.gadgetStock[selectedGadget]+' CHARGES OWNED':'Purchase a gadget below to prepare for your next mission.';
 $('upgrades').innerHTML=Object.entries(UPGRADES).map(([id,u])=>{
  const tier=profile.upgrades[id],cost=u.cost[tier],can=loadedName&&tier<3&&profileWallet()>=cost;
  return `<div class="upgrade"><div><b>${u.icon} ${u.name} <span style="color:#9eeabe">LVL ${tier}/3</span></b><small>${u.desc}</small></div><button data-upgrade="${id}" ${can?'':'disabled'}>${tier>=3?'MAXED':cost?coins(cost):'—'}</button></div>`;
 }).join('');
 $('upgrades').querySelectorAll('[data-upgrade]').forEach(b=>b.onclick=()=>buyUpgrade(b.dataset.upgrade));
 renderArmoryShop();
 updateSafehouseHud();
 $('shDeployMission').textContent=MISSIONS[selectedMission].name+' / '+MISSIONS[selectedMission].site;
 $('shDeployKit').textContent=WEAPONS[selectedWeapon].name+' · '+(selectedGadget?GADGETS[selectedGadget].name:'NO GADGET')+' · '+coins(profileWallet())+' AVAILABLE';
}
function buyUpgrade(id){
 if(!loadedName||!UPGRADES[id])return;
 const tier=profile.upgrades[id],cost=UPGRADES[id].cost[tier];if(tier>=3||profileWallet()<cost)return;
 profile.upgrades[id]++;profile.spent+=cost;scheduleSave();refreshMenu();beep('purchase');
}
function sound(type){
 if(muted)return;
 try{
  audio=audio||new (window.AudioContext||window.webkitAudioContext)();
  if(audio.state==='suspended')audio.resume();
  const t=audio.currentTime,o=audio.createOscillator(),gain=audio.createGain(),filter=audio.createBiquadFilter();
  const presets={shoot:[115,50,.11,.055,'sawtooth'],hit:[790,220,.10,.08,'square'],hurt:[90,45,.18,.08,'sawtooth'],pickup:[440,880,.16,.05,'sine'],purchase:[600,950,.22,.07,'sine'],alarm:[400,220,.36,.04,'square'],reload:[330,230,.1,.015,'triangle']};
  const [start,end,duration,volume,wave]=presets[type]||presets.pickup;
  o.type=wave;o.frequency.setValueAtTime(start,t);o.frequency.exponentialRampToValueAtTime(end,t+duration);
  filter.type='lowpass';filter.frequency.value=1800;
  gain.gain.setValueAtTime(volume,t);gain.gain.exponentialRampToValueAtTime(.0001,t+duration);
  o.connect(filter);filter.connect(gain);gain.connect(audio.destination);o.start(t);o.stop(t+duration+.01);
 }catch{}
}
const beep=sound;
function initView(){
 if(view)return true;
 try{view=new View($('stage'));view.canvas.tabIndex=0;
  view.canvas.addEventListener('mousedown',e=>{
   if(e.button===0){if(run?.phase==='play'&&!activeOverlay)controls.fire=true;if(document.pointerLockElement!==view.canvas)void requestLock();}
   if(e.button===2){controls.aim=true;e.preventDefault();}
  });
  view.canvas.addEventListener('contextmenu',e=>e.preventDefault());
  view.canvas.addEventListener('mouseup',e=>{if(e.button===0)controls.fire=false;if(e.button===2)controls.aim=false;});
  window.addEventListener('mouseup',e=>{if(e.button===0)controls.fire=false;if(e.button===2)controls.aim=false;});
  document.addEventListener('pointerlockchange',()=>{
   if(!view)return;
   if(document.pointerLockElement!==view.canvas&&run?.phase==='play'&&!activeOverlay){showPause();}
   if(document.pointerLockElement===view.canvas&&activeOverlay==='pause'){closeGameMenu();softPaused=false;}
  });
  return true;
 }catch(e){$('fatalText').textContent='3D graphics could not initialize: '+e.message;$('fatal').classList.remove('hidden');return false;}
}
function requestLock(){if(!view||run?.phase!=='play')return;try{const promise=view.canvas.requestPointerLock();if(promise?.catch)promise.catch(()=>status('CLICK THE GAME TO ENABLE MOUSE LOOK'));}catch{}}
function safehouseIsVisible(){return !$('safehouse').classList.contains('hidden');}
function openStation(id){
 if(!SAFEHOUSE_STATIONS.some(s=>s.id===id)||!safehouseIsVisible())return;
 activeStation=id;lastStation=id;safehouse?.setActive(false);
 if(document.pointerLockElement===safehouse?.canvas)document.exitPointerLock();
 $('safehousePanelTitle').textContent=SAFEHOUSE_STATIONS.find(s=>s.id===id).name;
 $('safehousePanel').classList.remove('hidden');
 for(const button of document.querySelectorAll('.shTabs [data-station]'))button.classList.toggle('selected',button.dataset.station===id);
 for(const section of document.querySelectorAll('.shStation'))section.classList.toggle('hidden',section.id!=='station-'+id);
 $('safehousePrompt').classList.add('hidden');$('shHoverCard').classList.add('hidden');
 $('shMenuToggle').setAttribute('aria-expanded','true');
 refreshMenu();
}
function closeStation(){
 activeStation='';$('safehousePanel').classList.add('hidden');$('safehousePrompt').classList.add('hidden');
 $('shMenuToggle').setAttribute('aria-expanded','false');
 safehouse?.setActive(true);
 try{const promise=safehouse?.canvas.requestPointerLock();promise?.catch?.(()=>{});}catch{}
}
function cabinItemState(target){
 const {kind,id}=target,item=(kind==='weapon'?WEAPONS:kind==='upgrade'?UPGRADES:GADGETS)[id];
 if(!item)return null;
 if(kind==='upgrade'){
  const tier=profile.upgrades[id]||0,finished=tier>=item.cost.length,cost=finished?0:item.cost[tier];
  const note=finished?'MAX LEVEL · E TO OPEN':profileWallet()<cost?'LEVEL '+tier+'/3 · NEED '+coins(cost-profileWallet())+' MORE':'LEVEL '+tier+'/3 · E TO OPEN';
  return {item,price:finished?'MAXED':coins(cost),note,tier,owned:false};
 }
 const unlock=item.unlock<=profile.unlocked,owned=kind==='weapon'?canEquipWeapon(profile,id):canEquipGadget(profile,id);
 const equipped=kind==='weapon'?selectedWeapon===id:selectedGadget===id;
 const stock=kind==='gadget'?(profile.gadgetStock[id]||0):0;
 const full=kind==='gadget'&&stock+item.charges>30;
 const price=item.cost===0?'FREE':coins(item.cost);
 const note=equipped?'EQUIPPED · E TO INSPECT':owned?'OWNED · E TO EQUIP':!unlock?'UNLOCK AFTER JOB '+item.unlock:full?'INVENTORY FULL':profileWallet()<item.cost?'NEED '+coins(item.cost-profileWallet())+' MORE':'E TO INSPECT / BUY';
 return {item,price,note,owned,unlock,equipped,stock};
}
function showCabinFocus(target){
 const hover=$('shHoverCard'),prompt=$('safehousePrompt');
 if(!target){hover.classList.add('hidden');prompt.classList.add('hidden');return;}
 if(target.type==='station'){
  hover.classList.add('hidden');
  const station=SAFEHOUSE_STATIONS.find(s=>s.id===target.station);
  $('shInteractionLabel').textContent=station.name+' · '+station.hint;
  prompt.classList.remove('hidden');
  return;
 }
 const state=cabinItemState(target);
 if(!state){hover.classList.add('hidden');prompt.classList.add('hidden');return;}
 hover.classList.remove('hidden');
 $('shHoverName').textContent=state.item.name;
 $('shHoverType').textContent=(target.kind==='weapon'?state.item.class:'TACTICAL GADGET')+(target.kind==='gadget'?' · '+state.stock+' CHARGES OWNED':'');
 $('shHoverPrice').textContent=state.price;
 $('shHoverState').textContent=state.note;
 $('shInteractionLabel').textContent=(state.owned?'EQUIP / VIEW':'INSPECT')+' '+state.item.name;
 prompt.classList.remove('hidden');
}
function inspectCabin(target){
 if(!target)return;
 if(target.type==='station'){openStation(target.station);return;}
 const state=cabinItemState(target);if(!state)return;
 if(target.kind==='upgrade'){
  openStation('upgrades');
  const button=$('upgrades')?.querySelector('[data-upgrade="'+target.id+'"]');
  button?.scrollIntoView({block:'center',behavior:'auto'});
  button?.focus({preventScroll:true});
  return;
 }
 if(state.owned&&!state.equipped){
  if(target.kind==='weapon')selectedWeapon=target.id;else selectedGadget=target.id;
  persistLoadout();refreshMenu();beep('purchase');return;
 }
 openStation(target.kind==='weapon'?'weapons':'gadgets');
 const card=[...document.querySelectorAll('.shopCard')].find(el=>el.dataset.displayKind===target.kind&&el.dataset.displayId===target.id);
 if(card){
  card.scrollIntoView({block:'center',behavior:'auto'});
  card.classList.add('shFocusedItem');
  card.querySelector('button[data-buy-id]')?.focus({preventScroll:true});
 }
}
// The same combat HUD components are displayed while preparing equipment at the safehouse.
function updateSafehouseHud(){
 const w=WEAPONS[selectedWeapon]||WEAPONS.pistol;
 const hp=125+25*(profile.upgrades?.armor||0);
 const mag=Math.round(w.mag*(1+(profile.upgrades?.mag||0)*.2));
 $('shCrew').innerHTML=`<div class="crewCard"><div class="crewName">${escapeText((loadedName?profile.name:'OPERATOR').toUpperCase())} / YOU</div><div class="crewHp">${hp} / ${hp} HP</div><div class="crewMiniBar"><div style="width:100%"></div></div></div>`;
 $('shWalletAmount').textContent=coins(profileWallet());
 $('shHpLabel').textContent=hp+' / '+hp;
 $('shHpFill').style.width='100%';
 $('shGunName').textContent=w.name;
 $('shAmmoValue').innerHTML=mag+' <em>/ '+w.reserve+'</em>';
 $('shGadgetValue').textContent=selectedGadget?(GADGETS[selectedGadget].name+' × '+(profile.gadgetStock[selectedGadget]||0)):'NO GADGET';
}
function drawSafehouseMinimap(){
 if(!safehouse)return;
 const canvas=$('shMinimap'),ctx=canvas.getContext('2d');
 if(!ctx)return;
 const W=canvas.width,H=canvas.height;
 ctx.clearRect(0,0,W,H);
 const cx=W/2,cz=H/2,scale=Math.min((W-26)/15.4,(H-20)/15.4);
 ctx.fillStyle='#24363c';ctx.fillRect(cx-7.7*scale,cz-7.7*scale,15.4*scale,15.4*scale);
 ctx.strokeStyle='#7a9591';ctx.lineWidth=2;ctx.strokeRect(cx-7.7*scale,cz-7.7*scale,15.4*scale,15.4*scale);
 ctx.fillStyle='#42565b';ctx.fillRect(cx-1.7*scale,cz-.05*scale,3.4*scale,2.1*scale);
 for(const station of SAFEHOUSE_STATIONS){
  const x=cx+station.x*scale,z=cz+station.z*scale;
  ctx.fillStyle='#edc388';ctx.fillRect(x-3.1,z-3.1,6.2,6.2);
 }
 const x=cx+safehouse.pos.x*scale,z=cz+safehouse.pos.z*scale;
 const walking=safehouse.move.shift,moving=safehouse.move.w||safehouse.move.a||safehouse.move.s||safehouse.move.d;
 if(moving){
  const radius=(walking?1.5:11)*scale;
  ctx.fillStyle=walking?'#b7f7d40c':'#ff927917';
  ctx.strokeStyle=walking?'#9be6bc':'#ff9279';ctx.lineWidth=1.25;
  ctx.beginPath();ctx.arc(x,z,radius,0,Math.PI*2);ctx.fill();ctx.stroke();
 }
 ctx.save();ctx.translate(x,z);ctx.rotate(-safehouse.yaw);
 ctx.fillStyle='#b7ffd8';ctx.strokeStyle='#09231d';ctx.lineWidth=1.3;
 ctx.beginPath();ctx.moveTo(0,-7);ctx.lineTo(4.7,5);ctx.lineTo(0,2.5);ctx.lineTo(-4.7,5);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
}
function enterSafehouse(){
 $('menu').classList.add('hidden');$('gameScreen').classList.add('hidden');$('safehouse').classList.remove('hidden');$('shHoverCard').classList.add('hidden');
 if(!safehouse){
  try{safehouse=new Safehouse($('safehouseStage'),id=>openStation(id));safehouse.pos.z=-3.15;}
  catch(e){$('fatalText').textContent='Could not load the 3D safehouse: '+e.message;$('fatal').classList.remove('hidden');return false;}
 }
 safehouse.setActive(true);safehouse.resize();if(mode!=='coop')mode='safehouse';
 $('safehousePanel').classList.add('hidden');$('safehousePrompt').classList.add('hidden');activeStation='';
 $('shMenuToggle').setAttribute('aria-expanded','false');
 refreshMenu();if(invite&&!room)openStation('crew');return true;
}
function enterScreen(){
 if(document.pointerLockElement===safehouse?.canvas)document.exitPointerLock();
 safehouse?.setActive(false);
 $('menu').classList.add('hidden');$('safehouse').classList.add('hidden');$('shHoverCard').classList.add('hidden');$('gameScreen').classList.remove('hidden');
 closeGameMenu();$('roomDisplay').textContent=mode==='solo'?'SOLO / OFFLINE':room;
 $('networkDisplay').textContent=mode==='solo'?'LOCAL':'CONNECTED';
 $('invite').classList.toggle('hidden',mode==='solo');
 if(!initView())return false;view.resize();return true;
}
function returnMenu(){
 if(quickTest){location.assign('/game2/');return;}
 if(document.pointerLockElement)document.exitPointerLock();
 conn?.close();peer?.destroy();peer=null;conn=null;room='';mode='safehouse';host=true;run=null;softPaused=false;activeOverlay='';
 closeGameMenu();$('gameScreen').classList.add('hidden');$('centerOverlay').classList.add('hidden');history.replaceState(null,'',location.pathname);
 if(view){view.dispose();view.canvas.remove();view=null;}
 for(const k of ['forward','back','left','right','walk','fire','reload','interact','gadget','aim'])controls[k]=false;status('');$('shRoomInvite').classList.add('hidden');
 enterSafehouse();
}
function changeOperator(){
 if(document.pointerLockElement)document.exitPointerLock();
 conn?.close();peer?.destroy();peer=null;conn=null;room='';run=null;mode='menu';loadedName='';activeStation='';
 safehouse?.setActive(false);$('safehouse').classList.add('hidden');$('safehousePanel').classList.add('hidden');$('menu').classList.remove('hidden');
 history.replaceState(null,'',location.pathname);$('playerName').focus();profileStatus('ENTER AN OPERATOR CALLSIGN');
}
function showOverlay(tag,title,description,actionText,handler,stats=[]){
 closeGameMenu();activeOverlay=tag;$('overlayTag').textContent=tag;$('overlayTitle').textContent=title;$('overlayText').textContent=description;
 $('overlayAction').textContent=actionText||'';$('overlayAction').classList.toggle('hidden',!actionText);
 $('overlayAction').onclick=handler||(()=>{});
 $('overlayDetails').innerHTML=stats.map(([k,v])=>`<div class="detail"><span>${escapeText(k)}</span><b>${escapeText(v)}</b></div>`).join('');
 $('centerOverlay').classList.remove('hidden');
}
function escapeText(s){return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');}
function hideOverlay(){activeOverlay='';$('centerOverlay').classList.add('hidden');}
function showBrief(){
 if(!run)return;const m=MISSIONS[run.mission];
 showOverlay('CASE FILE / '+m.number,m.name,m.description,host?'BEGIN OPERATION ↗':'WAITING FOR THE HOST',host?()=>{run.phase='play';lastPhase='';hideOverlay();softPaused=false;sendState();requestLock();}:null,[['TARGET',m.site],['THREAT LEVEL',String(run.mission+1)+' / 5'],['EST. PAYOUT',coins(m.payout)]]);
 if(!host)$('overlayAction').classList.add('hidden');
}
function closeGameMenu(){
 $('gameMenuPanel').classList.add('hidden');
 $('gameMenuToggle').setAttribute('aria-expanded','false');
 if(activeOverlay==='pause')activeOverlay='';
}
function resumeGame(){closeGameMenu();softPaused=false;requestLock();}
function showPause(){
 if(!run||run.phase!=='play')return;
 softPaused=mode==='solo';
 for(const k of ['forward','back','left','right','walk','fire','reload','interact','gadget','aim'])controls[k]=false;
 activeOverlay='pause';
 $('gameMenuPanel').classList.remove('hidden');
 $('gameMenuToggle').setAttribute('aria-expanded','true');
}
function showOutcome(){
 if(!run)return;const m=MISSIONS[run.mission],won=run.phase==='won';
 showOverlay(won?'CLEAN GETAWAY':'OPERATION FAILED',won?(run.mission===4?'LEGENDS NEVER RETIRE':'JOB COMPLETE'):'THE JOB WENT SIDEWAYS',
  won?m.completion+' You earned '+coins(run.earned)+' on this run. Purchased weapons survive extraction; used gadget charges do not.':'The crew was eliminated. Deployed purchased weapons and gadget stock were lost. Return to the safehouse to rearm.',
  host?(quickTest?'RESTART LEVEL 1 ↗':won&&run.mission<4?'NEXT OPERATION ↗':'RETRY OPERATION ↗'):null,
  host?()=>startBrief(quickTest?0:won&&run.mission<4?run.mission+1:run.mission):null,
  [['CREW ELIMINATIONS',run.kills],['TIME',formatTime(run.time)],['PAYOUT',won?coins(run.earned):coins(0)]]);
}
function formatTime(seconds){const t=Math.floor(seconds||0);return Math.floor(t/60)+':'+String(t%60).padStart(2,'0');}
function onRunChange(){
 if(!run)return;
 if(run.runId!==lastRunId){lastRunId=run.runId;lastPhase='';lastShots=0;lastHits=0;lastHeadshots=0;lastHp=100;controls.yaw=-Math.PI/2;controls.pitch=0;view?.applyGun(run.players[host?0:1]?.weapon||'pistol');}
 if(run.phase===lastPhase)return;
 lastPhase=run.phase;
 if(run.phase==='brief')showBrief();
 else if(run.phase==='play'){hideOverlay();softPaused=false;}
 else if(run.phase==='won'||run.phase==='lost'){if(run.phase==='won')awardMission(run);settleDeployedGear(run);showOutcome();if(document.pointerLockElement)document.exitPointerLock();}
}
function awardMission(completedRun){
 if(!loadedName||credited.has(completedRun.runId))return;
 credited.add(completedRun.runId);const m=MISSIONS[completedRun.mission];
 const first=!profile.cleared.includes(m.id);
 const payout=first?completedRun.earned:Math.round(completedRun.earned*.42);
 profile.earned=clamp(profile.earned+payout,0,9999999);
 profile.unlocked=Math.max(profile.unlocked,Math.min(4,completedRun.mission+1));
 profile.cleared=[...new Set([...profile.cleared,m.id])];if(completedRun.mission===4)profile.completed=true;
 // Clearing a job unlocks catalog entries; it does not give away purchased gear.
 // The guest sends the finalized kit after used charges have been settled.
 const current=profile.best[m.id];
 if(!current||completedRun.time<current)profile.best[m.id]=Math.round(completedRun.time);
 selectedMission=Math.min(profile.unlocked,completedRun.mission+1);
 scheduleSave();refreshMenu();beep('purchase');
}
function startBrief(n){
 if(!host)return;
 if($('gameScreen').classList.contains('hidden')&&!enterScreen())return;
 const local=quickTest?{name:'TEST OPERATOR',weapon:'pistol',gadget:null,upgrades:{}}:kit();
 const guest=remoteKit||{name:'PARTNER',weapon:'pistol',gadget:null,upgrades:{}};
 run=makeRun(quickTest?0:n,mode==='solo'?1:2,[local,guest]);
 if(quickTest){
  run.phase='play';
  run.toast='TEST MODE · CLICK THE GAME TO ENABLE MOUSE LOOK';
  run.toastUntil=8;
 }
 onRunChange();sendState();
}
function launchQuickTest(){
 // No cloud fetch, localStorage writes, purchases, or progression rewards.
 profile=profileDefaults('TEST OPERATOR');loadedName='';
 selectedMission=0;selectedWeapon='pistol';selectedGadget='';
 mode='solo';host=true;room='';startBrief(0);
}
async function startSolo(){
 if(!await ensureProfile())return;
 conn?.close();peer?.destroy();peer=null;conn=null;
 mode='solo';host=true;room='';if(!enterScreen())return;
 startBrief(selectedMission);
}
function randomCode(){
 const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',buf=new Uint8Array(6);crypto.getRandomValues(buf);return Array.from(buf,b=>chars[b%chars.length]).join('');
}
function send(packet){if(conn?.open)try{conn.send(packet);}catch{}}
function sendState(){if(host&&run)send({type:'state',run:{...run,grid:undefined}});}
function connectionLost(){
 if(mode!=='coop')return;
 if(!run){peer?.destroy();peer=null;conn=null;mode='safehouse';room='';$('shRoomInvite').classList.add('hidden');status('CONNECTION LOST · TRY JOINING OR CREATING A ROOM AGAIN');return;}
 $('networkDisplay').textContent='OFFLINE';
 if(host&&run){
  if(run.players.length===2)run.players.splice(1,1);
  mode='solo';room='';$('roomDisplay').textContent='SOLO / PARTNER LEFT';$('invite').classList.add('hidden');sendState();
  if(run.phase==='brief')showBrief();
  else if(run.phase==='play')showOverlay('CONNECTION LOST','YOUR PARTNER LEFT','You can finish the mission solo. The operation has not been reset.','CONTINUE SOLO',()=>{hideOverlay();requestLock();});
 }else showOverlay('CONNECTION LOST','CREW SEPARATED','The host disconnected. Your local profile is safe. Return to the safehouse and make a new room.',null,null);
}
function sanitizedInput(raw){
 const safe={};for(const k of ['forward','back','left','right','walk','fire','reload','interact','gadget','aim'])safe[k]=raw?.[k]===true;
 safe.yaw=Number.isFinite(raw?.yaw)?clamp(raw.yaw,-2000,2000):-Math.PI/2;
 safe.pitch=Number.isFinite(raw?.pitch)?clamp(raw.pitch,-1.35,1.35):0;return safe;
}
function setupConnection(c){
 if(conn?.open){c.close();return;}
 conn=c;
 c.on('open',()=>{
  $('networkDisplay').textContent='CONNECTED';
  if(!host)send({type:'hello',kit:kit()});
  else status('PARTNER CONNECTED');
 });
 c.on('data',packet=>{
  if(!packet||typeof packet!=='object')return;
  if(host){
   if(packet.type==='hello'&&!run){
    const k=packet.kit||{},w=WEAPONS[k.weapon]?k.weapon:'pistol',g=GADGETS[k.gadget]?k.gadget:null;
    remoteKit={name:String(k.name||'PARTNER').slice(0,24),weapon:w,gadget:g,charges:g?clamp(Number(k.charges)||0,0,GADGETS[g].charges):0,upgrades:{armor:clamp(Number(k.upgrades?.armor)||0,0,3),damage:clamp(Number(k.upgrades?.damage)||0,0,3),mag:clamp(Number(k.upgrades?.mag)||0,0,3)}};
    startBrief(selectedMission);
   }
   if(packet.type==='input')remoteInput=sanitizedInput(packet.input);
   if(packet.type==='kit-update'&&packet.kit){const k=packet.kit;remoteKit={name:String(k.name||'PARTNER').slice(0,24),weapon:WEAPONS[k.weapon]?k.weapon:'pistol',gadget:GADGETS[k.gadget]?k.gadget:null,charges:GADGETS[k.gadget]?clamp(Number(k.charges)||0,0,GADGETS[k.gadget].charges):0,upgrades:{armor:clamp(Number(k.upgrades?.armor)||0,0,3),damage:clamp(Number(k.upgrades?.damage)||0,0,3),mag:clamp(Number(k.upgrades?.mag)||0,0,3)}};}
  }else if(packet.type==='state'&&packet.run){
   if($('gameScreen').classList.contains('hidden')&&!enterScreen())return;
   const previous=run?.runId;run=packet.run;run.grid=makeGrid(MISSIONS[run.mission]);onRunChange();if(previous!==run.runId)view?.build(run);
  }
 });
 c.on('close',connectionLost);c.on('error',connectionLost);
}
async function startCoop(isHost,code){
 if(!await ensureProfile())return;
 if(typeof window.Peer!=='function'){openStation('crew');status('REAL-TIME SERVICE DID NOT LOAD. CHECK YOUR CONNECTION.');return;}
 conn?.close();peer?.destroy();conn=null;peer=null;
 mode='coop';host=isHost;room=code;remoteKit=null;remoteInput={};run=null;
 openStation('crew');$('shRoomInvite').classList.toggle('hidden',!isHost);$('shRoomCode').textContent=code;
 status(isHost?'OPENING PRIVATE ROOM '+code+'…':'CONNECTING TO ROOM '+code+'…');
 const id='getaway-club-v4-'+room;
 peer=isHost?new window.Peer(id,{debug:0}):new window.Peer(undefined,{debug:0});
 const timeout=setTimeout(()=>{if(mode==='coop'&&!conn?.open)status('COULD NOT CONNECT. CHECK THE CODE AND TRY AGAIN.');},18000);
 peer.on('open',()=>{
  if(isHost){history.replaceState(null,'',location.pathname+'?room='+room);status('ROOM '+room+' READY · SHARE YOUR INVITE LINK · WAITING FOR PARTNER');}
  else{status('CONTACTING CREW LEADER…');setupConnection(peer.connect(id,{reliable:true,serialization:'json'}));}
 });
 peer.on('connection',c=>{if(!host){c.close();return;}setupConnection(c);});
 peer.on('error',e=>{
  clearTimeout(timeout);
  status(e.type==='peer-unavailable'?'ROOM NOT FOUND. ASK YOUR PARTNER TO CREATE IT.':e.type==='unavailable-id'?'ROOM CODE IN USE. TRY ANOTHER.':'REALTIME SERVICE UNAVAILABLE. CHECK YOUR INTERNET.');
  mode='safehouse';$('shRoomInvite').classList.add('hidden');
 });
}
function updateHud(){
 if(!run)return;
 const mission=MISSIONS[run.mission],p=run.players[host?0:1]||run.players[0];if(!p)return;
 $('hudMission').textContent=mission.name;$('hudSite').textContent=mission.site+' / '+mission.number;
 const required=run.objectives.filter(o=>!o.optional),done=required.filter(o=>o.done).length,total=required.length;
 let next=required.find(o=>objectiveReady(run,o)),heading=next?next.name.toUpperCase():'GET TO EXTRACTION';
 if(run.mission===0){
  if(run.players[host?0:1]?.bagId!==null&&run.players[host?0:1]?.bagId!==undefined)heading='DELIVER THE BAG TO THE VAN';
  else if(run.loot.length&&run.secured<run.bagGoal)heading='TRANSPORT THE CASH · '+run.secured+'/'+run.bagGoal+' BAGS';
  else if(run.escapeAt>0)heading=run.escapeAt>run.time?'PROTECT THE VAN · '+Math.ceil(run.escapeAt-run.time)+'S':'BOARD THE GETAWAY VAN';
 }
 $('hudObjective').textContent=heading;
 $('objectiveProgress').textContent=(run.mission===0?'CHAPTER '+Math.min(4,run.chapter||1)+' / 4 · ':'')+done+' / '+total+' PHASES · '+formatTime(run.time);
 $('crew').innerHTML=run.players.map((player,i)=>`<div class="crewCard ${player.hp<=0?'downed':''}" style="border-color:${i===0?'#b7f7d4':'#8bd8ff'}"><div class="crewName">${escapeText(player.name.toUpperCase())}${i===(host?0:1)?' / YOU':''}</div><div class="crewHp">${player.hp>0?Math.ceil(player.hp)+' / '+player.maxHp+' HP':'DOWN — NEEDS REVIVE'}</div><div class="crewMiniBar"><div style="width:${Math.max(0,player.hp/player.maxHp*100)}%"></div></div></div>`).join('');
 $('tasks').innerHTML=run.objectives.map(o=>`<div class="task ${o.done?'done':objectiveReady(run,o)?'':'locked'}"><span class="taskIcon">${o.done?'✓':objectiveReady(run,o)?'◇':o.optional?'✧':'⊠'}</span><span>${escapeText(o.name)}${o.optional?' · BONUS':''}</span></div>`).join('');
 $('hpLabel').textContent=Math.ceil(p.hp)+' / '+p.maxHp;$('hpFill').style.width=(p.hp/p.maxHp*100)+'%';$('hpFill').style.background=p.hp/p.maxHp<.3?'#ff786c':'#b8f8d0';
 $('damage').style.opacity=p.hp>0?Math.max(0,(.33-p.hp/p.maxHp))*1.7:.8;
 $('gunName').textContent=WEAPONS[p.weapon].name+ (p.reload>0?' · RELOADING':'');
 $('ammoValue').innerHTML=p.ammo+' <em>/ '+p.reserve+'</em>';$('gadgetValue').textContent=p.gadget?(GADGETS[p.gadget].name+' × '+p.gadgets):'NO GADGET';
 $('alarmFill').style.width=run.alarm+'%';$('alertName').textContent=run.alarm<32?'QUIET':run.alarm<65?'SUSPICIOUS':'LOCKDOWN';
 $('alertName').style.color=run.alarm>=65?'#ff8b7c':run.alarm>=32?'#ffc77c':'#b7f7d4';
 $('enemyCount').textContent=run.enemies.filter(e=>e.hp>0).length+' HOSTILES';
 const task=nearbyTask(run,p),valid=task&&run.phase==='play'&&p.hp>0;
 $('interaction').classList.toggle('hidden',!valid);
 if(valid){$('interactionLabel').textContent=task.label+' · HOLD';$('interactionFill').style.width=clamp(p.interact/task.duration*100,0,100)+'%';}
 if(run.toast&&run.toastUntil>run.time){$('toast').textContent=run.toast;$('toast').classList.remove('hidden');}
 else $('toast').classList.add('hidden');
 if(p.stats.shots!==lastShots){if(p.stats.shots>lastShots)beep('shoot');lastShots=p.stats.shots;}
 if(p.stats.hits!==lastHits){
  const marker=$('hitMarker'),headshot=(p.stats.headshots||0)>lastHeadshots;
  marker.style.color=headshot?'#ffbe82':'#e9fff4';
  marker.classList.toggle('headshot',headshot);
  marker.style.opacity='1';
  lastHits=p.stats.hits;lastHeadshots=p.stats.headshots||0;
  clearTimeout(hitMarkerTimer);
  hitMarkerTimer=setTimeout(()=>{marker.style.opacity='0';marker.classList.remove('headshot');},headshot?280:145);
 }
 if(p.hp<lastHp){
  beep('hurt');
  const ring=$('damageIndicator'),source=p.lastDamageFrom;
  if(source){
   const dx=source.x-p.x,dz=source.z-p.z;
   const ahead=-Math.sin(controls.yaw)*dx-Math.cos(controls.yaw)*dz;
   const right=Math.cos(controls.yaw)*dx-Math.sin(controls.yaw)*dz;
   if(Math.hypot(dx,dz)>.01)ring.style.setProperty('--damage-angle',Math.atan2(right,ahead)+'rad');
  }
  ring.classList.remove('active');void ring.offsetWidth;ring.classList.add('active');
  clearTimeout(damageIndicatorTimer);
  damageIndicatorTimer=setTimeout(()=>ring.classList.remove('active'),430);
 }
 lastHp=p.hp;
 const aiming=controls.aim&&p.reload<=0&&p.hp>0;
 const scale=(controls.walk?.84:(controls.forward||controls.back||controls.left||controls.right)?1.18:1)+Math.min(.35,(p.bloom||0)*.22);
 const crosshair=$('crosshair');
 crosshair.classList.toggle('aiming',aiming);
 // The ADS dot stays pixel-sharp at the exact screen center, even while the gun animates.
 crosshair.style.transform=aiming?'translate(-50%,-50%)':'translate(-50%,-50%) scale('+scale+')';
 drawMinimap(p);
}
function mapGoal(player){
 if(run.mission===0){
  if(player.bagId!==null&&player.bagId!==undefined)return {at:run.dropoff,label:'VAN'};
  if(run.loot.length&&run.secured<run.bagGoal){
   const bag=run.loot.find(b=>!b.secured&&b.carrier===null);
   return bag?{at:bag,label:'BAG'}:{at:run.dropoff,label:'VAN'};
  }
  if(run.escapeAt>0)return {at:run.exit,label:run.escapeReady?'EXIT':'VAN'};
 }
 const goal=run.objectives.find(o=>!o.optional&&objectiveReady(run,o))||run.objectives.find(o=>objectiveReady(run,o));
 return goal?{at:goal,label:'GOAL'}:{at:run.exit,label:'EXIT'};
}
function drawMinimap(player){
 const c=$('minimap'),ctx=c.getContext('2d'),W=c.width,H=c.height;ctx.clearRect(0,0,W,H);
 if(!run)return;const grid=run.grid,sx=W/grid[0].length,sz=H/grid.length;
 for(let z=0;z<grid.length;z++)for(let x=0;x<grid[z].length;x++){ctx.fillStyle=grid[z][x]==='#'?'#53616b':'#142832';ctx.fillRect(x*sx,z*sz,sx-.4,sz-.4);}
 for(const o of run.objectives)if(!o.done){ctx.fillStyle=objectiveReady(run,o)?'#ffce7a':'#576568';ctx.fillRect(o.x/CELL*sx-2,o.z/CELL*sz-2,4,4);}
 ctx.fillStyle=run.objectives.every(o=>o.done||o.optional)?'#91ffb3':'#36664f';ctx.fillRect(run.exit.x/CELL*sx-3,run.exit.z/CELL*sz-3,6,6);
 if(run.mission===0){
  for(const bag of run.loot){
   if(bag.secured)continue;
   ctx.fillStyle=bag.carrier===null?'#ffd07d':'#fff4ba';
   ctx.fillRect(bag.x/CELL*sx-2.4,bag.z/CELL*sz-2.4,5,5);
  }
  ctx.fillStyle=run.escapeAt>0&&run.time>=run.escapeAt?'#a4ffc6':'#64eab0';
  ctx.beginPath();ctx.arc(run.dropoff.x/CELL*sx,run.dropoff.z/CELL*sz,3,0,Math.PI*2);ctx.fill();
 }
 for(const e of run.enemies)if(e.hp>0){ctx.fillStyle='#ff817d';ctx.beginPath();ctx.arc(e.x/CELL*sx,e.z/CELL*sz,1.6,0,Math.PI*2);ctx.fill();}
 // World-scaled noise ring around this operator; footsteps stay on the map, not in the health bar.
 const px=player.x/CELL*sx,py=player.z/CELL*sz,noise=Math.max(0,player.noise||0);
 if(noise>.1){
  ctx.fillStyle=noise>16?'#ff857414':noise>5?'#ffca7611':'#b7f7d40c';
  ctx.strokeStyle=noise>16?'#ff9279':noise>5?'#ffd38c':'#9be6bc';
  ctx.lineWidth=1.25;ctx.beginPath();
  ctx.ellipse(px,py,Math.max(3.5,noise/CELL*sx),Math.max(3.5,noise/CELL*sz),0,0,Math.PI*2);
  ctx.fill();ctx.stroke();
 }
 const goal=mapGoal(player),gx=goal.at.x/CELL*sx,gy=goal.at.z/CELL*sz;
 ctx.strokeStyle='#ffda83';ctx.lineWidth=2;ctx.beginPath();ctx.arc(gx,gy,7+Math.sin(run.time*5)*1.4,0,Math.PI*2);ctx.stroke();
 ctx.fillStyle='#ffda83';ctx.fillRect(gx-2,gy-2,4,4);
 ctx.font='800 10px DM Sans,sans-serif';ctx.textAlign='left';ctx.textBaseline='middle';
 const lx=Math.max(3,Math.min(W-44,gx+10)),ly=Math.max(10,Math.min(H-9,gy-10));
 ctx.fillStyle='#07151b';ctx.fillRect(lx-2,ly-7,39,14);
 ctx.fillStyle='#ffe9ad';ctx.fillText(goal.label,lx,ly);
 run.players.forEach((p,i)=>{
  const x=p.x/CELL*sx,y=p.z/CELL*sz;
  if(p===player){
   ctx.save();ctx.translate(x,y);ctx.rotate(-p.yaw);ctx.fillStyle='#b7ffd8';ctx.strokeStyle='#09231d';ctx.lineWidth=1.2;
   ctx.beginPath();ctx.moveTo(0,-7);ctx.lineTo(4.7,5);ctx.lineTo(0,2.5);ctx.lineTo(-4.7,5);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
  }else{ctx.fillStyle='#8bd8ff';ctx.beginPath();ctx.arc(x,y,4,0,Math.PI*2);ctx.fill();}
 });
}
function frame(time){
 requestAnimationFrame(frame);
 const dt=Math.min(.05,Math.max(0,(time-last)/1000||0));last=time;
 if(safehouse&&safehouseIsVisible()){
  safehouse.update(dt);
  if(time-lastSafehousePrompt>100){
   if(!activeStation){drawSafehouseMinimap();showCabinFocus(safehouse.focus());}
   lastSafehousePrompt=time;
  }
  return;
 }
 if(mode==='menu'||!view||!run)return;
 if(host&&run.phase==='play'&&!softPaused){
  stepRun(run,[controls,remoteInput],dt);
  if(run.phase!==lastPhase)onRunChange();
 }
 if(!host&&run.phase!==lastPhase)onRunChange();
 if(mode!=='solo'&&time-lastNetwork>85){
  if(host)sendState();else send({type:'input',input:controls});lastNetwork=time;
 }
 view.update(run,host?0:1,controls,dt,controls);
 if(time-lastHud>85){updateHud();lastHud=time;}
}
window.addEventListener('keydown',e=>{
 if(mode==='menu')return;
 const k=e.key.toLowerCase();
 if(safehouseIsVisible()){
  if(k==='tab'){e.preventDefault();if(!e.repeat){if(activeStation)closeStation();else openStation(lastStation);}return;}
  if(k==='escape'&&activeStation){closeStation();e.preventDefault();return;}
  if(activeStation||e.target instanceof HTMLInputElement||e.target instanceof HTMLSelectElement)return;
  if(k==='e'&&!e.repeat){e.preventDefault();inspectCabin(safehouse?.focus());return;}
  safehouse?.key(k,true);
  if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright','shift'].includes(k))e.preventDefault();
  return;
 }
 const keys={'w':'forward','arrowup':'forward','s':'back','arrowdown':'back','a':'left','arrowleft':'left','d':'right','arrowright':'right','shift':'walk','r':'reload','e':'interact','q':'gadget',' ':'fire'};
 if(keys[k]){controls[keys[k]]=true;e.preventDefault();}
 if(k==='escape'&&run?.phase==='play'&&!activeOverlay)showPause();
 if(k==='m'&&!e.repeat){muted=!muted;localStorage.setItem('getaway-muted',String(muted));updateSoundLabel();}
});
window.addEventListener('keyup',e=>{
 safehouse?.key(e.key.toLowerCase(),false);
 const keys={'w':'forward','arrowup':'forward','s':'back','arrowdown':'back','a':'left','arrowleft':'left','d':'right','arrowright':'right','shift':'walk','r':'reload','e':'interact','q':'gadget',' ':'fire'};const key=keys[e.key.toLowerCase()];if(key)controls[key]=false;
});
window.addEventListener('mousemove',e=>{
 if(safehouse&&document.pointerLockElement===safehouse.canvas){safehouse.look(e.movementX,e.movementY);return;}
 if(!view||document.pointerLockElement!==view.canvas)return;
 const sensitivity=controls.aim?.45:1;controls.yaw-=e.movementX*.0021*sensitivity;controls.pitch=clamp(controls.pitch-e.movementY*.0018*sensitivity,-1.22,1.22);
});
window.addEventListener('blur',()=>{safehouse?.resetKeys();for(const k of ['forward','back','left','right','walk','fire','reload','interact','gadget','aim'])controls[k]=false;});
$('loadProfile').onclick=async()=>{if(await ensureProfile(true))enterSafehouse();};
$('playerName').oninput=()=>{if($('playerName').value.trim().toLowerCase()!==loadedName){profileStatus('PRESS LOAD TO ACCESS THIS OPERATOR');}};
$('playerName').onkeydown=e=>{if(e.key==='Enter')$('loadProfile').click();};
$('missionSelect').onchange=e=>{selectedMission=Number(e.target.value);refreshMenu();};
$('weapon').onchange=e=>{selectedWeapon=e.target.value;persistLoadout();refreshMenu();};
$('gadget').onchange=e=>{selectedGadget=e.target.value;persistLoadout();refreshMenu();};
$('solo').onclick=()=>void startSolo();
$('create').onclick=()=>void startCoop(true,randomCode());
$('join').onclick=()=>{const code=$('roomCode').value.trim().toUpperCase();if(!/^[A-HJ-NP-Z2-9]{6}$/.test(code)){status('ENTER A VALID 6-CHARACTER CODE');return;}void startCoop(false,code);};
$('roomCode').onkeydown=e=>{if(e.key==='Enter')$('join').click();};
$('overlayLeave').onclick=returnMenu;
$('closeSafehouse').onclick=closeStation;
$('changeOperator').onclick=changeOperator;
$('shMenuToggle').onclick=()=>{if(activeStation)closeStation();else openStation(lastStation);};
document.querySelectorAll('.shTabs [data-station], [data-jump]').forEach(button=>button.onclick=()=>openStation(button.dataset.station||button.dataset.jump));
$('copyRoomInvite').onclick=async()=>{const url=location.origin+location.pathname+'?room='+room;try{await navigator.clipboard.writeText(url);status('INVITE LINK COPIED');}catch{window.prompt('Copy invite:',url);}};
$('invite').onclick=async()=>{try{await navigator.clipboard.writeText(location.origin+location.pathname+'?room='+room);$('invite').textContent='✓';setTimeout(()=>$('invite').textContent='↗',1500);}catch{window.prompt('Copy invitation URL:',location.origin+location.pathname+'?room='+room);}};
function updateSoundLabel(){$('sound').textContent=muted?'SOUND OFF':'SOUND ON';}
$('sound').onclick=()=>{muted=!muted;localStorage.setItem('getaway-muted',String(muted));updateSoundLabel();beep('pickup');};
$('pause').onclick=resumeGame;
$('leaveOperation').onclick=returnMenu;
$('gameMenuToggle').onclick=()=>{
 if($('gameMenuPanel').classList.contains('hidden')){
  if(document.pointerLockElement===view?.canvas)document.exitPointerLock();
  showPause();
 }else resumeGame();
};
updateSoundLabel();
const invite=new URLSearchParams(location.search).get('room');
if(invite&&/^[A-HJ-NP-Z2-9]{6}$/i.test(invite)){$('roomCode').value=invite.toUpperCase();profileStatus('INVITE DETECTED · ENTER YOUR CALLSIGN TO ACCESS THE SAFEHOUSE');}
const remembered=rememberedOperator();
if(remembered)$('playerName').value=remembered;
refreshMenu();
window.addEventListener('beforeunload',()=>{peer?.destroy();});
window.getawayReady=true;
$('fatal').classList.add('hidden');
if(quickTest)launchQuickTest();
else if(remembered){
 // Returning operators enter immediately; existing local saves load without a network wait.
 void ensureProfile().then(loaded=>{
  if(loaded&&mode==='menu'&&$('playerName').value.trim().toLowerCase()===remembered.toLowerCase())enterSafehouse();
 }).catch(()=>profileStatus('COULD NOT RESTORE OPERATOR · ENTER YOUR CALLSIGN'));
}
requestAnimationFrame(frame);
