import {CELL,WIDTH,HEIGHT,MISSIONS,WEAPONS,GADGETS,makeGrid,clamp,pos} from './data.js';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const unit=(x,z)=>{const d=Math.hypot(x,z)||1;return {x:x/d,z:z/d};};
const T=(p)=>({x:Math.round(p.x/CELL),z:Math.round(p.z/CELL)});
const rng=(a,b)=>a+Math.random()*(b-a);
export function solid(run,x,z,r=.32){return isBlocked(run,x,z,r);}
export function isBlocked(run,x,z,r=.32){
 const points=[[x-r,z-r],[x+r,z-r],[x-r,z+r],[x+r,z+r]];
 return points.some(([a,b])=>{const tx=Math.round(a/CELL),tz=Math.round(b/CELL);return !run.grid[tz]||run.grid[tz][tx]==='#'||run.grid[tz][tx]===undefined;});
}
function move(run,o,dx,dz,r=.35){
 if(!isBlocked(run,o.x+dx,o.z,r))o.x+=dx;
 if(!isBlocked(run,o.x,o.z+dz,r))o.z+=dz;
}
export function lineClear(run,a,b){
 const d=distance(a,b),steps=Math.ceil(d/.35);
 for(let i=1;i<steps;i++){const t=i/steps;if(isBlocked(run,a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t,.08))return false;}
 return true;
}
function path(run,src,target){
 const a=T(src),b=T(target);if(a.x===b.x&&a.z===b.z)return [];
 const queue=[[a.x,a.z]],visited=new Set([a.x+','+a.z]),parents=new Map();
 let found=false;
 for(let cursor=0;cursor<queue.length&&cursor<run.grid.length*run.grid[0].length;cursor++){
  const [x,z]=queue[cursor];
  if(x===b.x&&z===b.z){found=true;break;}
  for(const [nx,nz] of [[x+1,z],[x-1,z],[x,z+1],[x,z-1]]){
   const key=nx+','+nz;
   if(run.grid[nz]?.[nx]!=='.'||visited.has(key))continue;
   visited.add(key);parents.set(key,x+','+z);queue.push([nx,nz]);
  }
 }
 if(!found)return [];
 let key=b.x+','+b.z;const route=[];
 while(key!==a.x+','+a.z&&route.length<run.grid.length*run.grid[0].length){const [x,z]=key.split(',').map(Number);route.push({x:x*CELL,z:z*CELL});key=parents.get(key);if(!key)break;}
 return route.reverse();
}
export function objectiveReady(run,o){return !o.done&&!o.synthetic&&o.requires.every(id=>run.objectives.find(x=>x.id===id)?.done);}
export function allRequiredDone(run){return run.objectives.every(o=>o.done||o.optional);}
export function nearbyTask(run,p){
 if(!p)return null;
 for(const mate of run.players){if(mate!==p&&mate.hp<=0&&distance(p,mate)<2.6)return {kind:'revive',target:mate,label:'REVIVE PARTNER',duration:3};}
 const pickup=run.pickups.find(k=>!k.taken&&(k.type==='med'||k.type==='ammo')&&distance(p,k)<2.4);
 if(pickup)return {kind:'pickup',target:pickup,label:pickup.type==='med'?'TAKE FIELD MEDICINE':'TAKE AMMO',duration:.4};
 if(run.mission===0&&run.objectives.find(o=>o.id==='safe')?.done){
  if(p.bagId!==null&&p.bagId!==undefined&&distance(p,run.dropoff)<3.6)
   return {kind:'deposit',target:run.dropoff,label:'LOAD CASH BAG INTO GETAWAY VAN',duration:1.2};
  if(p.bagId===null||p.bagId===undefined){
   const bag=run.loot.find(o=>!o.secured&&o.carrier===null&&distance(p,o)<2.8);
   if(bag)return {kind:'takeBag',target:bag,label:'PICK UP CASH BAG',duration:.6};
  }
 }
 const o=run.objectives.filter(x=>objectiveReady(run,x)&&distance(p,x)<3.25).sort((a,b)=>distance(p,a)-distance(p,b))[0];
 if(o)return {kind:'objective',target:o,label:o.name.toUpperCase(),duration:o.duration};
 if(allRequiredDone(run)&&distance(p,run.exit)<3.5){
  if(run.mission===0&&run.time<run.escapeAt)return {kind:'wait',target:run.exit,label:'DEFEND THE VAN · '+Math.ceil(run.escapeAt-run.time)+'S',duration:0};
  return {kind:'extract',target:run.exit,label:'BOARD THE GETAWAY VAN',duration:1.6};
 }
 return null;
}
export function spawnEnemy(run,type,at){
 const stats={guard:[80,3.2,22,1.25,12],rusher:[65,5.3,13,1.0,2],sniper:[58,2.35,33,2.4,25],heavy:[245,1.9,26,.65,14],drone:[68,3.7,17,1.12,20]};
 const [hp,speed,damage,cadence,range]=stats[type]||stats.guard;
 const p=pos(at);let x=p.x,z=p.z;
 if(isBlocked(run,x,z,.35)){const q=run.players[0];x=q.x+4;z=q.z+4;}
 const e={id:++run.serial,type,x,z,hp,maxHp:hp,speed,damage,cadence,range,dir:0,cool:rng(.3,1.6),path:[],pathTimer:0,stun:0,flinch:0,alert:false,patrolX:x+rng(-4,4),patrolZ:z+rng(-4,4),alertUntil:0,lastKnown:null};
 run.enemies.push(e);return e;
}
export function makeRun(n=0,count=1,loadouts=[]){
 const mission=MISSIONS[n],start=pos(mission.spawn);
 const run={mission:n,runId:Math.random().toString(36).slice(2),phase:'brief',time:0,alarm:0,grid:makeGrid(mission),serial:0,players:[],enemies:[],objectives:[],pickups:[],projectiles:[],tracers:[],toast:'',toastUntil:0,exit:pos(mission.exit),reinforce:mission.reinforce,lockdown:false,kills:0,shots:0,hitShots:0,earned:0,loot:[],secured:0,dropoff:pos(mission.dropoff||mission.exit),checkpoint:pos(mission.spawn),continues:n===0&&count===1?1:0,usedContinue:false,jamUntil:0,empUntil:0,escapeAt:0,nextWave:0,escapeReady:false,camerasOff:false,cameraAlert:0,chapter:1,optionalBonus:0};
 for(let i=0;i<count;i++){
  const kit=loadouts[i]||{},wid=WEAPONS[kit.weapon]?kit.weapon:'pistol',gid=GADGETS[kit.gadget]?kit.gadget:null,w=WEAPONS[wid];
  const maxHp=(n===0?125:100)+25*clamp(kit.upgrades?.armor||0,0,3),mag=Math.round(w.mag*(1+clamp(kit.upgrades?.mag||0,0,3)*.2));
  const gadgetStart=gid?clamp(Number.isFinite(kit.charges)?kit.charges:GADGETS[gid].charges,0,GADGETS[gid].charges):0;
  run.players.push({bagId:null,id:i,name:String(kit.name||'CREW '+(i+1)).slice(0,24),x:start.x,z:start.z+(i?1.2:0),yaw:-Math.PI/2,pitch:0,hp:maxHp,maxHp,stamina:100,noise:0,noiseUntil:0,bloom:0,weapon:wid,gadget:gid,mag,ammo:mag,reserve:w.reserve,reload:0,cool:0,gadgets:gadgetStart,gadgetStart,gadCool:0,shieldUntil:0,damageTier:clamp(kit.upgrades?.damage||0,0,3),invuln:0,interact:0,interactId:'',bleed:0,down:false,stats:{kills:0,shots:0,hits:0},recoil:0});
 }
 run.objectives=mission.objectives.map(o=>({...o,x:o.at[0]*CELL,z:o.at[1]*CELL,requires:o.requires||[],done:false}));
 if(n===0){
  run.objectives.find(o=>o.id==='bags-secured').name=(count===1?'3':'4')+' loot bags secured';
  run.bagGoal=count===1?3:4;
  for(const [x,z,type] of [[9,32,'ammo'],[35,29,'med'],[48,24,'ammo'],[55,36,'med'],[12,45,'ammo'],[65,42,'ammo']]){
   const location=pos([x,z]);run.pickups.push({id:++run.serial,x:location.x,z:location.z,type,taken:false});
  }
 }
 for(const [x,z,type] of mission.enemies)spawnEnemy(run,type,[x,z]);
 return run;
}
function announce(run,msg){run.toast=msg;run.toastUntil=run.time+3.3;}
function damagePlayer(run,p,dmg){
 if(p.hp<=0||p.invuln>0)return;
 p.hp=Math.max(0,p.hp-Math.max(1,Math.round(dmg*(p.shieldUntil>run.time?.35:1))));p.invuln=.28;p.recoil=Math.min(1,p.recoil+.18);
 if(p.hp===0){p.down=true;p.bleed=28;if(p.bagId!==null){const bag=run.loot.find(x=>x.id===p.bagId);if(bag){bag.carrier=null;bag.x=p.x;bag.z=p.z;}p.bagId=null;}announce(run,p.name+' IS DOWN — REVIVE THEM');}
}
function damageEnemy(run,e,amount,player){
 e.hp=Math.max(0,e.hp-amount);e.flinch=.15;e.alert=true;
 if(e.hp>0)return;
 run.kills++;player.stats.kills++;run.alarm=clamp(run.alarm+2,0,100);
 if(Math.random()<.28)run.pickups.push({id:++run.serial,x:e.x,z:e.z,type:Math.random()<.4?'med':'ammo',taken:false});
}
function beginReload(p){
 const w=WEAPONS[p.weapon];
 if(p.hp<=0||p.reload>0||p.ammo>=p.mag||p.reserve<=0)return false;
 p.reload=w.reload;return true;
}
function shoot(run,p){
 const w=WEAPONS[p.weapon];if(p.cool>0||p.reload>0||p.hp<=0)return;
 if(p.ammo<=0){beginReload(p);return;}
 const rounds=Math.min(w.burst||1,p.ammo);
 p.ammo-=rounds;p.cool=w.rate;p.recoil=Math.min(1,p.recoil+.25);p.stats.shots+=rounds;run.shots+=rounds;
 p.noiseUntil=run.time+1.1;p.noiseGun=w.noise?3:30;p.noise=p.noiseGun;run.alarm=clamp(run.alarm+(w.noise??2.3),0,100);
 const precision=(p.aiming?.34:1)*(p.walking?.68:p.moving?1.3:.78);
 const spread=w.spread*(.65+p.bloom)*precision;
 p.bloom=Math.min(1.6,p.bloom+(w.pellets>1?.31:.20));
 for(let i=0;i<w.pellets*rounds;i++){
  const yaw=p.yaw+rng(-spread,spread),pitch=p.pitch+rng(-spread*.8,spread*.8);
  const dx=-Math.sin(yaw)*Math.cos(pitch),dz=-Math.cos(yaw)*Math.cos(pitch),dy=Math.sin(pitch);
  const planar=dx*dx+dz*dz;
  let hit=null,headshot=false,minT=w.range;
  // True eye-height 3D hitscan, occluded by solid walls.
  for(let t=.12;t<minT;t+=.2)if(isBlocked(run,p.x+dx*t,p.z+dz*t,.015)){minT=t;break;}
  for(const e of run.enemies){
   if(e.hp<=0)continue;
   const vx=e.x-p.x,vz=e.z-p.z,t=(vx*dx+vz*dz)/planar;
   if(t<=0||t>=minT)continue;
   const horizontal=Math.hypot(vx-dx*t,vz-dz*t),y=1.67+dy*t;
   const radius=e.type==='heavy'?.83:e.type==='drone'?.68:.58;
   const low=e.type==='drone'?1.72:.25,high=e.type==='drone'?2.60:e.type==='heavy'?2.85:2.38;
   if(horizontal>radius||y<low||y>high)continue;
   hit=e;minT=t;headshot=e.type!=='drone'&&horizontal<.36&&y>=1.86&&y<=high;
  }
  run.tracers.push({id:++run.serial,x:p.x,y:1.64,z:p.z,tx:p.x+dx*minT,ty:1.67+dy*minT,tz:p.z+dz*minT,owner:p.id,ttl:.13,hit:!!hit});
  if(hit){
   const armorScale=hit.type==='heavy'?.70+(w.armorPen||0)*.30:1;
   damageEnemy(run,hit,Math.round(w.damage*(1+p.damageTier*.13)*armorScale*(headshot?1.65:1)),p);
   p.stats.hits++;run.hitShots++;
   if(headshot)p.stats.headshots=(p.stats.headshots||0)+1;
  }
 }
 // The final shot (including the last burst round) begins reload immediately.
 if(p.ammo===0)beginReload(p);
}
function throwPoint(run,p,range){
 const dx=-Math.sin(p.yaw),dz=-Math.cos(p.yaw);
 let point={x:p.x,z:p.z};
 for(let t=.5;t<=range;t+=.45){
  const x=p.x+dx*t,z=p.z+dz*t;
  if(isBlocked(run,x,z,.12))break;
  point={x,z};
 }
 return point;
}
function blast(run,point,player,damage,radius){
 run.pickups.push({id:++run.serial,type:'blast',x:point.x,z:point.z,ttl:.35,taken:false});
 for(const e of run.enemies){
  if(e.hp<=0)continue;
  const d=distance(point,e);
  if(d<radius&&lineClear(run,point,e)){damageEnemy(run,e,Math.round(damage*(1-.65*d/radius)),player);e.stun=Math.max(e.stun,.9);}
 }
 run.alarm=clamp(run.alarm+12,0,100);
}
function enemyFire(run,e,target){
 if(e.type==='rusher')return;
 const d=unit(target.x-e.x,target.z-e.z),miss=rng(-.09,.09)*(e.type==='sniper'?.4:1);
 const v=unit(d.x+miss,d.z+miss);
 run.projectiles.push({id:++run.serial,x:e.x,z:e.z,y:e.type==='drone'?2.15:1.3,dx:v.x,dz:v.z,damage:e.damage,speed:e.type==='sniper'?23:17,life:2.7,type:e.type});
 e.cool=e.cadence;
 if(e.type==='heavy')e.cool*=.75;
}
function tickPlayer(run,p,input,dt){
 p.cool=Math.max(0,p.cool-dt);p.invuln=Math.max(0,p.invuln-dt);p.gadCool=Math.max(0,p.gadCool-dt);
 p.recoil=Math.max(0,p.recoil-dt*3.2);p.bloom=Math.max(0,(p.bloom||0)-dt*1.5);
 if(p.reload>0){p.reload=Math.max(0,p.reload-dt);if(p.reload===0){const needed=p.mag-p.ammo,add=Math.min(needed,p.reserve);p.ammo+=add;p.reserve-=add;}}
 if(p.hp<=0){p.bleed-=dt;return;}
 p.yaw=Number.isFinite(input?.yaw)?clamp(input.yaw,-2000,2000):p.yaw;
 p.pitch=Number.isFinite(input?.pitch)?clamp(input.pitch,-1.35,1.35):p.pitch;
 const f=Number(!!input?.forward)-Number(!!input?.back),s=Number(!!input?.right)-Number(!!input?.left),norm=Math.hypot(f,s)||1;
 // Run by default in any direction. Shift is the slower, quieter walk.
 const carrying=p.bagId!==null,walking=!!input?.walk,aiming=!!input?.aim,moving=f!==0||s!==0;
 // Aim-down-sights movement is deliberately slower, including while silent-walking.
 const spd=(walking?3.2:7.4)*(aiming?.54:1)*(carrying?.72:1);
 const dx=(-Math.sin(p.yaw)*f+Math.cos(p.yaw)*s)*spd*dt/norm;
 const dz=(-Math.cos(p.yaw)*f-Math.sin(p.yaw)*s)*spd*dt/norm;
 move(run,p,dx,dz,.36);
 p.walking=walking;p.moving=moving;p.aiming=aiming;
 p.stamina=100;p.noise=Math.max(moving?(walking?1.5:aiming?5.5:11):0,run.time<(p.noiseUntil||0)?(p.noiseGun||30):0);
 if(input?.reload||p.ammo===0)beginReload(p);
 if(input?.fire&&p.reload===0)shoot(run,p);
 if(input?.gadget&&p.gadgets>0&&p.gadCool===0){
  p.gadgets--;p.gadCool=1;
  const target=throwPoint(run,p,8);
  if(p.gadget==='med'){
   const ally=run.players.filter(a=>a.hp>0&&distance(a,p)<4).sort((a,b)=>(a.hp/a.maxHp)-(b.hp/b.maxHp))[0]||p;
   const patient=ally.hp/ally.maxHp<p.hp/p.maxHp?ally:p;
   patient.hp=Math.min(patient.maxHp,patient.hp+65);announce(run,'TRAUMA KIT · '+patient.name.toUpperCase()+' HEALED');
  }else if(p.gadget==='smoke'){
   run.pickups.push({id:++run.serial,type:'smoke',x:target.x,z:target.z,ttl:8,taken:false});announce(run,'SMOKE DEPLOYED');
  }else if(p.gadget==='flash'){
   let stunned=0;
   for(const e of run.enemies)if(e.hp>0&&distance(e,target)<9&&lineClear(run,target,e)){e.stun=Math.max(e.stun,4.2);e.alert=true;stunned++;}
   run.pickups.push({id:++run.serial,type:'flash',x:target.x,z:target.z,ttl:.35,taken:false});
   announce(run,'FLASHBANG · '+stunned+' HOSTILES BLINDED');
  }else if(p.gadget==='frag'){
   blast(run,target,p,125,7);announce(run,'FRAG DETONATED');
  }else if(p.gadget==='ammo'){
   for(const ally of run.players)if(ally.hp>0&&distance(ally,p)<7){
    const cap=WEAPONS[ally.weapon].reserve;
    ally.reserve=Math.min(cap,ally.reserve+Math.round(WEAPONS[ally.weapon].mag*2));
   }
   announce(run,'AMMUNITION RESTOCKED');
  }else if(p.gadget==='emp'){
   for(const e of run.enemies)if(e.type==='drone'&&e.hp>0&&distance(e,p)<17)e.stun=Math.max(e.stun,6);
   run.empUntil=Math.max(run.empUntil||0,run.time+6);run.cameraAlert=0;announce(run,'EMP · DRONES AND CAMERAS DISABLED');
  }else if(p.gadget==='jammer'){
   run.jamUntil=Math.max(run.jamUntil||0,run.time+12);run.cameraAlert=0;announce(run,'JAMMER · SECURITY NETWORK SUPPRESSED');
  }else if(p.gadget==='shield'){
   p.shieldUntil=run.time+8;announce(run,'ARMOR PLATE · 65% DAMAGE REDUCTION');
  }else if(p.gadget==='decoy'){
   run.pickups.push({id:++run.serial,type:'decoy',x:target.x,z:target.z,ttl:11,taken:false});announce(run,'SOUND DECOY ACTIVE');
  }else if(p.gadget==='mine'){
   run.pickups.push({id:++run.serial,type:'mine',x:target.x,z:target.z,ttl:90,taken:false,owner:p.id});announce(run,'TRIP MINE ARMED');
  }
 }
 const task=nearbyTask(run,p);
 if(task&&input?.interact&&task.kind!=='wait'){
  const id=task.kind+':'+(task.target.id||'exit');
  if(p.interactId!==id){p.interactId=id;p.interact=0;}
  p.interact+=dt;
  if(p.interact>=task.duration){
   if(task.kind==='revive'){task.target.hp=Math.round(task.target.maxHp*.4);task.target.down=false;task.target.bleed=0;task.target.invuln=2;announce(run,task.target.name+' REVIVED');}
   if(task.kind==='pickup'){task.target.taken=true;if(task.target.type==='med')p.hp=Math.min(p.maxHp,p.hp+35);else p.reserve+=Math.round(WEAPONS[p.weapon].mag*1.5);announce(run,'SUPPLIES RESTOCKED');}
   if(task.kind==='takeBag'){task.target.carrier=p.id;p.bagId=task.target.id;announce(run,'CASH BAG ACQUIRED · RETURN TO GETAWAY VAN');}
   if(task.kind==='deposit'){
    const bag=run.loot.find(x=>x.id===p.bagId);if(bag){bag.carrier=null;bag.secured=true;bag.x=run.dropoff.x;bag.z=run.dropoff.z;run.secured++;p.bagId=null;}
    const progress=run.objectives.find(x=>x.id==='bags-secured');
    if(run.secured>=run.bagGoal&&!progress.done){progress.done=true;run.checkpoint={...run.dropoff};announce(run,'ALL BAGS SECURED · SIGNAL THE DRIVER');}
    else announce(run,'BAG SECURED · '+run.secured+' / '+run.bagGoal);
   }
   if(task.kind==='objective'){
    task.target.done=true;
    if(task.target.id==='cctv'){run.camerasOff=true;run.alarm=Math.max(0,run.alarm-26);}
    else if(task.target.optional){run.optionalBonus+=130;}
    else if(run.mission===0){run.chapter=Math.max(run.chapter,(task.target.chapter||1)+1);}
    run.alarm=clamp(run.alarm+(task.target.optional?0:task.target.kind==='safe'?28:task.target.kind==='radio'?38:7),0,100);
    if(task.target.id==='safe'){
     run.checkpoint={x:task.target.x-5,z:task.target.z-4};
     for(let j=0;j<run.bagGoal;j++){const dx=(j%2)*2.1-.9,dz=Math.floor(j/2)*1.9-.8;
      run.loot.push({id:++run.serial,x:task.target.x+dx,z:task.target.z+dz,carrier:null,secured:false});}
     announce(run,'SAFE BREACHED · CASH BAGS READY');
    }else if(task.target.id==='radio'){
     run.escapeAt=run.time+32;run.nextWave=run.time+2;run.alarm=Math.max(68,run.alarm);
     announce(run,'DRIVER INBOUND · DEFEND THE EXTRACTION ZONE');
    }else announce(run,'SECURED: '+task.target.name.toUpperCase());
   }
   if(task.kind==='extract'){
    if(run.players.every(m=>m.hp>0&&distance(m,run.exit)<3.5)){run.phase='won';run.earned=MISSIONS[run.mission].payout+Math.round(run.kills*14)+Math.max(0,Math.floor((100-run.alarm)*2))+run.optionalBonus+(run.mission===0&&run.alarm<35?350:0)-(run.usedContinue?175:0);}
    else announce(run,'ALL CREW MEMBERS MUST REACH EXTRACTION');
   }
   p.interact=0;p.interactId='';
  }
 }else{p.interact=0;p.interactId='';}
}
function tickEnemy(run,e,dt){
 if(e.hp<=0)return;
 e.flinch=Math.max(0,e.flinch-dt);e.cool=Math.max(0,e.cool-dt);e.stun=Math.max(0,e.stun-dt);
 if(e.stun>0)return;
 const live=run.players.filter(p=>p.hp>0);
 if(!live.length)return;
 const p=live.reduce((a,b)=>distance(e,a)<distance(e,b)?a:b);
 const d=distance(e,p),sight=d<e.range+12&&lineClear(run,e,p);
 const smoked=run.pickups.some(s=>s.type==='smoke'&&s.ttl>0&&(distance(s,p)<4.6||distance(s,e)<4.6));
 const facing=unit(p.x-e.x,p.z-e.z),front=Math.sin(e.dir)*facing.x+Math.cos(e.dir)*facing.z;
 const seen=sight&&!smoked&&(d<3.2||front>.24||e.alert);
 const heard=!smoked&&d<(p.noise||0);
 if(seen||heard){e.alert=true;e.alertUntil=run.time+13;e.lastKnown={x:p.x,z:p.z};}
 else if(e.alertUntil>0&&run.time>e.alertUntil)e.alert=false;
 const decoy=run.pickups.find(s=>s.type==='decoy'&&s.ttl>0&&distance(s,e)<19);
 const target=decoy?decoy:e.alert&&!smoked?(sight?p:e.lastKnown||p):{x:e.patrolX,z:e.patrolZ};
 const range=e.type==='sniper'?16:e.type==='heavy'?9:e.type==='rusher'?1.3:e.type==='drone'?9:7;
 if(!decoy&&e.alert&&!smoked&&seen&&d<e.range&&e.cool===0){
  if(e.type==='rusher'&&d<1.7){damagePlayer(run,p,e.damage);e.cool=1.2;}
  else enemyFire(run,e,p);
 }
 const pursue=e.type==='rusher'?d>1.5:d>range;
 if((decoy&&distance(e,decoy)>1.4)||(e.alert&&pursue)||(!e.alert&&distance(e,target)>1.5)){
  e.pathTimer-=dt;
  if(e.pathTimer<=0){e.path=path(run,e,target);e.pathTimer=.7+rng(0,.25);}
  let goal=e.path?.[0]||target;
  if(distance(e,goal)<.48&&e.path?.length>1){e.path.shift();goal=e.path[0];}
  const vector=unit(goal.x-e.x,goal.z-e.z);
  const speed=e.speed*(e.flinch>0?.35:1);
  move(run,e,vector.x*speed*dt,vector.z*speed*dt,e.type==='heavy'?.62:.33);
  e.dir=Math.atan2(vector.x,vector.z);
 }else if(e.alert){e.dir=Math.atan2(p.x-e.x,p.z-e.z);}
 else if(distance(e,target)<1.6){e.patrolX=e.x+rng(-8,8);e.patrolZ=e.z+rng(-8,8);if(isBlocked(run,e.patrolX,e.patrolZ,.4)){e.patrolX=e.x;e.patrolZ=e.z;}}
 if(e.type==='drone'&&run.empUntil>run.time)e.stun=1;
}
function tickProjectile(run,b,dt){
 // Substep projectile travel to catch targets crossed between frames.
 const steps=Math.max(1,Math.ceil(b.speed*dt/.18)),slice=dt/steps;
 for(let i=0;i<steps;i++){
  const nx=b.x+b.dx*b.speed*slice,nz=b.z+b.dz*b.speed*slice;
  if(isBlocked(run,nx,nz,.14)){b.life=0;return;}
  const vx=nx-b.x,vz=nz-b.z,denom=vx*vx+vz*vz;
  for(const p of run.players){
   if(p.hp<=0)continue;
   const t=clamp(((p.x-b.x)*vx+(p.z-b.z)*vz)/(denom||1),0,1);
   if(Math.hypot(b.x+vx*t-p.x,b.z+vz*t-p.z)<.62){
    damagePlayer(run,p,b.damage);b.life=0;return;
   }
  }
  b.x=nx;b.z=nz;
 }
 b.life-=dt;
}
export function stepRun(run,inputs,dt){
 if(!run||run.phase!=='play')return;
 dt=clamp(dt,0,.05);run.time+=dt;
 const m=MISSIONS[run.mission];
 if(run.time>run.jamUntil)run.alarm=clamp(run.alarm+dt*m.alarmRate,0,100);
 run.tracers.forEach(t=>t.ttl-=dt);run.tracers=run.tracers.filter(t=>t.ttl>0);
 run.pickups.forEach(p=>{if(p.ttl!==undefined)p.ttl-=dt;});
 run.pickups=run.pickups.filter(p=>!p.taken&&(p.ttl===undefined||p.ttl>0));
 for(let i=0;i<run.players.length;i++)tickPlayer(run,run.players[i],inputs[i]||{},dt);
 for(const mine of run.pickups){
  if(mine.type!=='mine'||mine.taken)continue;
  const enemy=run.enemies.find(e=>e.hp>0&&distance(mine,e)<2.7);
  if(enemy){mine.taken=true;const owner=run.players.find(p=>p.id===mine.owner)||run.players[0];blast(run,mine,owner,175,6);}
 }
 if(run.phase!=='play')return;
 if(run.mission===0){
  // The security network spots exposed intruders. Sabotage CCTV to shut this down.
  if(!run.camerasOff&&run.time>run.empUntil&&run.time>run.jamUntil){
   const cameras=[[39,16],[55,19],[47,36]].map(at=>pos(at));
   for(const cam of cameras)for(const p of run.players){
    if(p.hp>0&&distance(cam,p)<14&&lineClear(run,cam,p)){run.cameraAlert+=dt;break;}
   }
   if(run.cameraAlert>4){run.alarm=clamp(run.alarm+dt*1.8,0,100);}
  }
  for(const bag of run.loot)if(bag.carrier!==null&&!bag.secured){
   const carrier=run.players.find(p=>p.id===bag.carrier);
   if(carrier){bag.x=carrier.x;bag.z=carrier.z;}
  }
  if(run.escapeAt>0&&run.time>=run.nextWave&&run.time<run.escapeAt+1){
   const incoming=run.enemies.filter(e=>e.hp>0).length;
   if(incoming<14){
    const seeds=MISSIONS[0].waveSpawns;
    const n=run.players.length===1?2:3;
    for(let i=0;i<n;i++){const spot=seeds[(Math.floor(run.time/7)+i)%seeds.length];
     const e=spawnEnemy(run,i===0&&run.time>22?'heavy':i%2?'rusher':'guard',spot);e.alert=true;}
    announce(run,'POLICE ASSAULT WAVE INBOUND');
   }
   run.nextWave=run.time+10;
  }
  if(run.escapeAt>0&&run.time>=run.escapeAt&&!run.escapeReady){
   run.escapeReady=true;announce(run,'GETAWAY VAN ARRIVED · BOARD NOW');
  }
 }
 run.enemies.forEach(e=>tickEnemy(run,e,dt));
 run.projectiles.forEach(b=>tickProjectile(run,b,dt));run.projectiles=run.projectiles.filter(b=>b.life>0);
 if(run.alarm>62&&!run.lockdown){run.lockdown=true;announce(run,'LOCKDOWN — SECURITY REINFORCEMENTS INBOUND');}
 if(run.alarm>32&&run.time>run.jamUntil){
  run.reinforce-=dt;
  if(run.reinforce<=0){
   const alive=run.enemies.filter(e=>e.hp>0).length;
   if(alive<11){
    const spots=[[24,2],[24,16],[2,2],[2,16],[13,9]];
    const types=run.mission>2?['guard','heavy','rusher','drone']:['guard','rusher','sniper'];
    const at=spots[Math.floor(Math.random()*spots.length)];
    const e=spawnEnemy(run,types[Math.floor(Math.random()*types.length)],at);e.alert=true;
    announce(run,'NEW HOSTILES ENTERING THE BUILDING');
   }
   run.reinforce=m.reinforce;
  }
 }
 if(run.players.every(p=>p.hp<=0)&&run.continues>0){
  run.continues--;run.usedContinue=true;
  for(const p of run.players){p.hp=Math.round(p.maxHp*.67);p.down=false;p.bleed=0;p.invuln=6;p.x=run.checkpoint.x;p.z=run.checkpoint.z;p.stamina=100;}
  run.alarm=clamp(run.alarm+20,0,100);
  announce(run,'SECOND CHANCE · REDEPLOYED AT YOUR LAST SAFE POSITION');
  return;
 }
 if(run.players.every(p=>p.hp<=0)||run.players.some(p=>p.hp<=0&&p.bleed<=0)){run.phase='lost';announce(run,'CREW ELIMINATED');}
}
