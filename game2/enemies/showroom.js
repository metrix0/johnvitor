import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';
import {View} from '../render.js?v=6';
import {ENEMY_ARCHETYPES,ENEMY_PROJECTILE_SPEED} from '../simulation.js?v=8';

const $=id=>document.getElementById(id);
const definitions=[
 {type:'guard',name:'SECURITY GUARD',role:'PATROL INFANTRY',color:'#e4a58b',detail:'Balanced patrol rifleman; accurate mid-range bursts.'},
 {type:'rusher',name:'RUSHER',role:'MELEE ASSAULT',color:'#f0bc70',detail:'Fast close-quarters attacker with a rushing blade strike.'},
 {type:'sniper',name:'SNIPER',role:'LONG-RANGE PRECISION',color:'#ac9cf5',detail:'Long-range marksman with a deliberate, heavy shot.'},
 {type:'heavy',name:'ARMORED GUARD',role:'SUPPRESSIVE SUPPORT',color:'#df8386',detail:'Thick armor and rapid heavy automatic fire.'},
 {type:'drone',name:'SECURITY DRONE',role:'AERIAL INTERDICTION',color:'#8de9ef',detail:'Hovering security platform with bright pulse fire.'}
];
const stage=$('stage'),roster=$('roster');
let view=null,selected=-1,automatic=false,totalShots=0,dragX=0,dragging=false,moved=false;
let cameraAngle=0,zoom=1,last=0,labelUntil=0,status='',disposed=false;
const shots=[],units=[],tmp=new THREE.Vector3(),look=new THREE.Vector3(),desired=new THREE.Vector3();
const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
const clamp=(x,min,max)=>Math.max(min,Math.min(max,x));
const escapeText=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
try{
 view=new View(stage);
 view.gun.visible=false;view.visuals.flashlight.intensity=0;
 view.renderer.toneMappingExposure=1.24;
 view.scene.background=new THREE.Color(0x0d1a23);
 view.scene.fog=new THREE.FogExp2(0x0d1a23,.019);
 view.camera.position.set(0,3.5,18.7);tmp.set(0,1.28,0);view.camera.lookAt(tmp);
 view.ambient.intensity=1.46;view.sun.intensity=1.65;view.sun.position.set(-8,14,11);
 const W=view.world;
 view.box(W,0,-.40,0,29,.45,19,view.visuals.surface('concrete',0x334650,29,19));
 view.box(W,0,3.1,-5.2,29,6.2,.32,view.visuals.surface('metal',0x344651,29,6));
 for(const x of [-10,-5,0,5,10]){
  view.box(W,x,2.5,-5.0,.09,5,.13,0x658489,.55);
  view.box(W,x,4.8,-4.95,1.5,.08,.21,0x96cfb8,.3);
 }
 for(let i=0;i<definitions.length;i++){
  const d=definitions[i],spec=ENEMY_ARCHETYPES[d.type],x=(i-2)*4.15;
  const model=view.enemyMesh({type:d.type,id:i+1,fireSeq:0});
  model.position.set(x,.01,0);
  model.rotation.y=Math.PI;
  model.userData.enemyType=d.type;
  W.add(model);
  const color=new THREE.Color(d.color).getHex();
  const platform=view.box(W,x,-.19,0,3.55,.22,3.45,0x24363c,.28);
  view.box(W,x,-.045,1.68,3.25,.06,.10,color,.3);
  view.visuals.pool(x,0,3.2,color,.17,.015);
  view.sign(d.type.toUpperCase(),x,.63,2.08,0,d.color,2.8);
  const specCopy={...spec,maxHp:spec.hp,id:i+1,type:d.type,fireSeq:0,flinch:0};
  units.push({definition:d,spec:specCopy,mesh:model,elapsed:.2+i*.18,x});
  const btn=document.createElement('button');btn.type='button';btn.className='rosterItem';
  btn.innerHTML='<span class="rosterNum">'+String(i+1).padStart(2,'0')+'</span>'+
   '<span class="rosterDetails"><strong>'+escapeText(d.name)+'</strong><small>'+escapeText(d.role)+'</small></span>'+
   '<span class="unitDot" style="color:'+d.color+'"></span>';
  btn.addEventListener('click',()=>select(i));
  btn.setAttribute('aria-label','Inspect '+d.name);
  roster.append(btn);
  units[i].button=btn;
 }
 view.visuals.lamp(-7,4,4,0xc8e5ff,3,18);
 view.visuals.lamp(7,4,4,0xffe0b7,3,18);
}catch(error){
 if(view){view.dispose();view=null;}
 $('fallback').hidden=false;$('fallback').textContent='Could not initialize enemy models: '+error.message;
 document.querySelectorAll('.controls button').forEach(x=>x.disabled=true);
}
function select(index){
 selected=index;cameraAngle=0;zoom=1;
 units.forEach((u,i)=>u.button.classList.toggle('selected',i===selected));
 $('viewMode').textContent=index<0?'ALL UNITS / WIDE VIEW':definitions[index].name+' / DETAIL VIEW';
 const d=definitions[index],stats=index<0?null:ENEMY_ARCHETYPES[d.type],live=index<0?null:units[index].spec;
 $('selectedName').textContent=d?.name||'ALL HOSTILES';
 $('selectedSubtitle').textContent=d?.role||'FIVE TYPES · COMPARATIVE VIEW';
 $('health').textContent=stats?Math.ceil(live.hp)+' / '+stats.hp:'—';
 $('damage').textContent=stats?stats.damage+' HP':'—';
 $('cadence').textContent=stats?stats.cadence.toFixed(2)+'s':'—';
 $('range').textContent=stats?stats.range+'m':'—';
 $('instructions').textContent=d?.detail||'All five models are visible. Fire a volley or enable automatic attacks to compare their animation cadence.';
}
function show(message,seconds=1.3){
 status=message;labelUntil=performance.now()/1000+seconds;$('shotLabel').textContent=message;
}
function targets(){return selected<0?units:units.slice(selected,selected+1);}
function fire(){
 if(!view)return;
 const firing=targets().filter(u=>u.spec.hp>0);
 if(!firing.length){show('NO ACTIVE TARGETS · RESET HEALTH');return;}
 for(const unit of firing){
  const {spec,definition,x}=unit;
  spec.fireSeq++;totalShots++;
  if(spec.type!=='rusher'){
   const bullet=new THREE.Mesh(new THREE.BoxGeometry(spec.type==='heavy'?.065:.038,.045,spec.type==='sniper'?1.05:.72),
    new THREE.MeshBasicMaterial({color:spec.type==='drone'?0x80eaff:spec.type==='sniper'?0xffb8a3:0xffd08c,transparent:true,opacity:.95,depthWrite:false}));
   bullet.position.set(x+(spec.type==='heavy'?.09:0),spec.type==='drone'?2.02:1.34,1.2);
   view.world.add(bullet);
   shots.push({mesh:bullet,speed:ENEMY_PROJECTILE_SPEED[spec.type]||42,life:spec.type==='sniper'?.25:.35});
  }
 }
 $('shots').textContent=String(totalShots).padStart(3,'0');
 show(firing.length===1?(firing[0].spec.type==='rusher'?'BLADE STRIKE':'LIVE FIRE · '+firing[0].definition.name):'FULL SQUAD VOLLEY');
}
function hit(){
 const victims=targets().filter(u=>u.spec.hp>0);
 if(!victims.length){show('TARGET DOWN · RESET HEALTH');return;}
 for(const u of victims){
  u.spec.hp=Math.max(0,u.spec.hp-25);u.spec.flinch=.34;
  u.mesh.userData.hpFill.material.color.setHex(u.spec.hp/u.spec.maxHp<.35?0xff9179:0x8affbd);
  u.button.classList.toggle('down',u.spec.hp===0);
 }
 $('downs').textContent=String(units.filter(u=>!u.spec.hp).length).padStart(2,'0')+' / 05';
 select(selected);
 show(victims.length===1?(victims[0].spec.hp?'HIT CONFIRMED · −25 HP':'TARGET NEUTRALIZED'):'SQUAD HIT · −25 HP EACH');
}
function reset(){
 totalShots=0;$('shots').textContent='000';$('downs').textContent='00 / 05';
 for(const u of units){
  u.spec.hp=u.spec.maxHp;u.spec.flinch=0;u.spec.fireSeq++;
  u.mesh.userData.fireTime=0;u.mesh.userData.lastFireSeq=u.spec.fireSeq;
  u.mesh.rotation.z=0;u.mesh.visible=true;u.mesh.position.y=0;
  u.button.classList.remove('down');u.elapsed=.25;
  u.mesh.userData.hpFill.material.color.setHex(0x8affbd);
 }
 for(const b of shots){view.world.remove(b.mesh);b.mesh.geometry.dispose();b.mesh.material.dispose();}
 shots.length=0;select(selected);show('RANGE RESET · ALL UNITS OPERATIONAL');
}
function setAuto(force){
 automatic=force;$('auto').setAttribute('aria-pressed',String(force));
 $('auto').classList.toggle('active',force);
 $('auto').textContent=force?'■ AUTO FIRE: ON':'▶ AUTO FIRE: OFF';
 for(const u of units)u.elapsed=.2;
 if(force)show('AUTOMATIC ATTACK CYCLE ENGAGED');
}
$('all').addEventListener('click',()=>select(-1));
$('fire').addEventListener('click',fire);
$('auto').addEventListener('click',()=>setAuto(!automatic));
$('hit').addEventListener('click',hit);
$('reset').addEventListener('click',reset);
document.addEventListener('keydown',e=>{
 if(e.altKey||e.ctrlKey||e.metaKey||e.repeat)return;
 if(/^[1-5]$/.test(e.key)){select(Number(e.key)-1);return;}
 if(e.key==='0'||e.key==='Escape'){select(-1);return;}
 if(e.key.toLowerCase()==='f'||e.code==='Space'){e.preventDefault();fire();}
 if(e.key.toLowerCase()==='h')hit();
 if(e.key.toLowerCase()==='r')reset();
});
stage.addEventListener('pointerdown',e=>{
 dragging=true;moved=false;dragX=e.clientX;
 stage.setPointerCapture(e.pointerId);
});
stage.addEventListener('pointermove',e=>{
 if(!dragging)return;
 const delta=e.clientX-dragX;dragX=e.clientX;
 if(Math.abs(delta)>1){moved=true;cameraAngle=clamp(cameraAngle+delta*.005,-.82,.82);}
});
stage.addEventListener('pointerup',e=>{
 if(!dragging)return;dragging=false;
 if(moved||!view)return;
 const rect=view.canvas.getBoundingClientRect();
 pointer.set(((e.clientX-rect.left)/rect.width)*2-1,-((e.clientY-rect.top)/rect.height)*2+1);
 raycaster.setFromCamera(pointer,view.camera);
 const hitObjects=raycaster.intersectObjects(units.map(u=>u.mesh),true);
 if(!hitObjects.length)return;
 let parent=hitObjects[0].object;
 while(parent&&!parent.userData.enemyType)parent=parent.parent;
 const i=units.findIndex(u=>u.definition.type===parent?.userData.enemyType);
 if(i>=0){select(i);hit();}
});
stage.addEventListener('pointercancel',()=>{dragging=false;});
stage.addEventListener('wheel',e=>{e.preventDefault();zoom=clamp(zoom+Math.sign(e.deltaY)*.10,.65,1.8);},{passive:false});
select(-1);
if(view){
 const animate=now=>{
  if(disposed||!view)return;
  requestAnimationFrame(animate);
  const seconds=now/1000,dt=clamp(last?(seconds-last):.016,0,.05);last=seconds;view.clock+=dt;
  const focus=selected>=0?units[selected]:null;
  const center=focus?focus.x:0;
  const distance=(focus?7.5:18.7)*zoom,alt=focus?2.8:3.5;
  desired.set(center+Math.sin(cameraAngle)*distance*.45,alt*zoom,Math.cos(cameraAngle)*distance);
  look.set(center,focus?1.30:1.28,0);
  view.camera.position.lerp(desired,Math.min(1,dt*5.5));
  tmp.lerp(look,Math.min(1,dt*6));
  view.camera.lookAt(tmp);
  for(const u of units){
   if(automatic&&u.spec.hp>0&&(selected<0||selected===units.indexOf(u))){
    u.elapsed+=dt;
    if(u.elapsed>=u.spec.cadence){u.elapsed=0;u.spec.fireSeq++;totalShots++;
     $('shots').textContent=String(totalShots).padStart(3,'0');
     if(u.spec.type!=='rusher'){
      const bullet=new THREE.Mesh(new THREE.BoxGeometry(.05,.045,.68),new THREE.MeshBasicMaterial({color:u.spec.type==='drone'?0x84edff:0xffcd91}));
      bullet.position.set(u.x,u.spec.type==='drone'?2.02:1.34,1.2);
      view.world.add(bullet);shots.push({mesh:bullet,speed:ENEMY_PROJECTILE_SPEED[u.spec.type]||42,life:u.spec.type==='sniper'?.25:.35});
     }
    }
   }
   u.spec.flinch=Math.max(0,u.spec.flinch-dt);
   view.animateEnemy(u.mesh,u.spec,dt);
   if(u.spec.hp<=0){u.mesh.rotation.z=-.95;u.mesh.position.y=u.spec.type==='drone'?-1.25:.23;}
   else if(u.spec.type!=='drone')u.mesh.position.y=.01;
   const ratio=u.spec.hp/u.spec.maxHp;
   u.mesh.userData.hpFill.scale.x=ratio;
   u.mesh.userData.hpFill.position.x=-(1-ratio)*.49;
  }
  for(let i=shots.length-1;i>=0;i--){
   const b=shots[i];b.life-=dt;b.mesh.position.z+=b.speed*dt;
   if(b.life<=0){view.world.remove(b.mesh);b.mesh.geometry.dispose();b.mesh.material.dispose();shots.splice(i,1);}
  }
  if(status&&seconds>labelUntil){$('shotLabel').textContent='';status='';}
  view.renderer.render(view.scene,view.camera);
 };
 requestAnimationFrame(animate);
}
window.addEventListener('pagehide',()=>{
 disposed=true;
 if(view){for(const b of shots){b.mesh.geometry.dispose();b.mesh.material.dispose();}view.dispose();}
});
