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
 const pickup=run.pickups.find(k=>!k.taken&&k.type!=='smoke'&&distance(p,k)<2.4);
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
 const e={id:++run.serial,type,x,z,hp,maxHp:hp,speed,damage,cadence,range,dir:0,cool:rng(.3,1.6),path:[],pathTimer:0,stun:0,flinch:0,alert:false,patrolX:x+rng(-4,4),patrolZ:z+rng(-4,4)};
 run.enemies.push(e);return e;
}
export function makeRun(n=0,count=1,loadouts=[]){
 const mission=MISSIONS[n],start=pos(mission.spawn);
 const run={mission:n,runId:Math.random().toString(36).slice(2),phase:'brief',time:0,alarm:0,grid:makeGrid(mission),serial:0,players:[],enemies:[],objectives:[],pickups:[],projectiles:[],tracers:[],toast:'',toastUntil:0,exit:pos(mission.exit),reinforce:mission.reinforce,lockdown:false,kills:0,shots:0,hitShots:0,earned:0,loot:[],secured:0,dropoff:pos(mission.dropoff||mission.exit),escapeAt:0,nextWave:0,escapeReady:false,camerasOff:false,cameraAlert:0,chapter:1,optionalBonus:0};
 for(let i=0;i<count;i++){
  const kit=loadouts[i]||{},wid=WEAPONS[kit.weapon]?kit.weapon:'pistol',gid=GADGETS[kit.gadget]?kit.gadget:null,w=WEAPONS[wid];
  const maxHp=100+25*clamp(kit.upgrades?.armor||0,0,3),mag=Math.round(w.mag*(1+clamp(kit.upgrades?.mag||0,0,3)*.2));
  run.players.push({bagId:null,id:i,name:String(kit.name||'CREW '+(i+1)).slice(0,24),x:start.x,z:start.z+(i?1.2:0),yaw:-Math.PI/2,pitch:0,hp:maxHp,maxHp,stamina:100,weapon:wid,gadget:gid,mag,ammo:mag,reserve:w.reserve,reload:0,cool:0,gadgets:gid?GADGETS[gid].charges:0,gadCool:0,damageTier:clamp(kit.upgrades?.damage||0,0,3),invuln:0,interact:0,interactId:'',bleed:0,down:false,stats:{kills:0,shots:0,hits:0},recoil:0});
 }
 run.objectives=mission.objectives.map(o=>({...o,x:o.at[0]*CELL,z:o.at[1]*CELL,requires:o.requires||[],done:false}));
 if(n===0){run.objectives.find(o=>o.id==='bags-secured').name=(count===1?'3':'4')+' loot bags secured';run.bagGoal=count===1?3:4;}
 for(const [x,z,type] of mission.enemies)spawnEnemy(run,type,[x,z]);
 return run;
}
function announce(run,msg){run.toast=msg;run.toastUntil=run.time+3.3;}
function damagePlayer(run,p,dmg){
 if(p.hp<=0||p.invuln>0)return;
 p.hp=Math.max(0,p.hp-dmg);p.invuln=.28;p.recoil=Math.min(1,p.recoil+.18);
 if(p.hp===0){p.down=true;p.bleed=28;if(p.bagId!==null){const bag=run.loot.find(x=>x.id===p.bagId);if(bag){bag.carrier=null;bag.x=p.x;bag.z=p.z;}p.bagId=null;}announce(run,p.name+' IS DOWN — REVIVE THEM');}
}
function damageEnemy(run,e,amount,player){
 e.hp=Math.max(0,e.hp-amount);e.flinch=.15;e.alert=true;
 if(e.hp>0)return;
 run.kills++;player.stats.kills++;run.alarm=clamp(run.alarm+2,0,100);
 if(Math.random()<.28)run.pickups.push({id:++run.serial,x:e.x,z:e.z,type:Math.random()<.4?'med':'ammo',taken:false});
}
function shoot(run,p){
 const w=WEAPONS[p.weapon];if(p.cool>0||p.reload>0||p.hp<=0)return;
 if(p.ammo<=0){if(p.reserve>0)p.reload=w.reload;return;}
 p.ammo--;p.cool=w.rate;p.recoil=Math.min(1,p.recoil+.22);p.stats.shots++;run.shots++;run.alarm=clamp(run.alarm+2.3,0,100);
 const pellets=w.pellets,range=w.range;
 for(let i=0;i<pellets;i++){
  const yaw=p.yaw+rng(-w.spread,w.spread),pitch=p.pitch+rng(-w.spread*.7,w.spread*.7);
  const dx=-Math.sin(yaw)*Math.cos(pitch),dz=-Math.cos(yaw)*Math.cos(pitch),dy=Math.sin(pitch);
  let hit=null,minT=range,end={x:p.x+dx*range,z:p.z+dz*range};
  // March against the mission's collision grid so bullets cannot pass through walls.
  for(let t=.45;t<range;t+=.3)if(isBlocked(run,p.x+dx*t,p.z+dz*t,.02)){minT=t;break;}
  for(const e of run.enemies){
   if(e.hp<=0)continue;
   const vx=e.x-p.x,vz=e.z-p.z,vy=(e.type==='drone'?1.95:1.3)-1.58;
   const t=vx*dx+vz*dz+vy*dy;if(t<=0||t>=minT)continue;
   const error=Math.hypot(vx-dx*t,vz-dz*t,vy-dy*t);
   if(error<(e.type==='heavy'?.85:.66)){minT=t;hit=e;}
  }
  end={x:p.x+dx*minT,z:p.z+dz*minT};
  run.tracers.push({id:++run.serial,x:p.x,z:p.z,tx:end.x,tz:end.z,owner:p.id,ttl:.16,hit:!!hit});
  if(hit){const base=w.damage*(1+p.damageTier*.13);damageEnemy(run,hit,Math.round(base),p);p.stats.hits++;run.hitShots++;}
 }
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
 p.recoil=Math.max(0,p.recoil-dt*2.5);
 if(p.reload>0){p.reload=Math.max(0,p.reload-dt);if(p.reload===0){const needed=p.mag-p.ammo,add=Math.min(needed,p.reserve);p.ammo+=add;p.reserve-=add;}}
 if(p.hp<=0){p.bleed-=dt;return;}
 p.yaw=Number.isFinite(input?.yaw)?clamp(input.yaw,-2000,2000):p.yaw;
 p.pitch=Number.isFinite(input?.pitch)?clamp(input.pitch,-1.35,1.35):p.pitch;
 const f=Number(!!input?.forward)-Number(!!input?.back),s=Number(!!input?.right)-Number(!!input?.left),norm=Math.hypot(f,s)||1;
 const carrying=p.bagId!==null,wantsRun=!!input?.sprint&&f>0&&p.stamina>3,spd=(wantsRun?8:5.1)*(carrying?.62:1);
 const dx=(-Math.sin(p.yaw)*f+Math.cos(p.yaw)*s)*spd*dt/norm;
 const dz=(-Math.cos(p.yaw)*f-Math.sin(p.yaw)*s)*spd*dt/norm;
 move(run,p,dx,dz,.36);
 p.stamina=clamp(p.stamina+(wantsRun?-27:21)*dt,0,100);
 if(input?.reload&&p.reload===0&&p.ammo<p.mag&&p.reserve>0)p.reload=WEAPONS[p.weapon].reload;
 if(input?.fire&&p.reload===0)shoot(run,p);
 if(input?.gadget&&p.gadgets>0&&p.gadCool===0){
  p.gadgets--;p.gadCool=1;
  if(p.gadget==='med'){p.hp=Math.min(p.maxHp,p.hp+65);announce(run,'FIELD MEDICINE APPLIED');}
  else if(p.gadget==='smoke'){run.pickups.push({id:++run.serial,type:'smoke',x:p.x,z:p.z,ttl:8,taken:false});announce(run,'SMOKE DEPLOYED');}
  else if(p.gadget==='emp'){for(const e of run.enemies)if(e.type==='drone'&&distance(e,p)<14)e.stun=6;run.empUntil=run.time+6;announce(run,'EMP DISCHARGE');}
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
    if(run.secured>=run.bagGoal&&!progress.done){progress.done=true;announce(run,'ALL BAGS SECURED · SIGNAL THE DRIVER');}
    else announce(run,'BAG SECURED · '+run.secured+' / '+run.bagGoal);
   }
   if(task.kind==='objective'){
    task.target.done=true;
    if(task.target.id==='cctv'){run.camerasOff=true;run.alarm=Math.max(0,run.alarm-26);}
    else if(task.target.optional){run.optionalBonus+=130;}
    else if(run.mission===0){run.chapter=Math.max(run.chapter,(task.target.chapter||1)+1);}
    run.alarm=clamp(run.alarm+(task.target.optional?0:task.target.kind==='safe'?28:task.target.kind==='radio'?38:7),0,100);
    if(task.target.id==='safe'){
     for(let j=0;j<run.bagGoal;j++){const dx=(j%2)*2.1-.9,dz=Math.floor(j/2)*1.9-.8;
      run.loot.push({id:++run.serial,x:task.target.x+dx,z:task.target.z+dz,carrier:null,secured:false});}
     announce(run,'SAFE BREACHED · CASH BAGS READY');
    }else if(task.target.id==='radio'){
     run.escapeAt=run.time+32;run.nextWave=run.time+2;run.alarm=Math.max(68,run.alarm);
     announce(run,'DRIVER INBOUND · DEFEND THE EXTRACTION ZONE');
    }else announce(run,'SECURED: '+task.target.name.toUpperCase());
   }
   if(task.kind==='extract'){
    if(run.players.every(m=>m.hp>0&&distance(m,run.exit)<3.5)){run.phase='won';run.earned=MISSIONS[run.mission].payout+Math.round(run.kills*14)+Math.max(0,Math.floor((100-run.alarm)*2))+run.optionalBonus+(run.mission===0&&run.alarm<35?350:0);}
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
 if(sight&&!smoked)e.alert=true;
 const target=e.alert&&!smoked?p:{x:e.patrolX,z:e.patrolZ};
 const range=e.type==='sniper'?16:e.type==='heavy'?9:e.type==='rusher'?1.3:e.type==='drone'?9:7;
 if(e.alert&&!smoked&&sight&&d<e.range&&e.cool===0){
  if(e.type==='rusher'&&d<1.7){damagePlayer(run,p,e.damage);e.cool=1.2;}
  else enemyFire(run,e,p);
 }
 const pursue=e.type==='rusher'?d>1.5:d>range;
 if((e.alert&&pursue)||(!e.alert&&distance(e,target)>1.5)){
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
 b.x+=b.dx*b.speed*dt;b.z+=b.dz*b.speed*dt;b.life-=dt;
 if(isBlocked(run,b.x,b.z,.14)){b.life=0;return;}
 for(const p of run.players)if(p.hp>0&&distance(b,p)<.66){damagePlayer(run,p,b.damage);b.life=0;break;}
}
export function stepRun(run,inputs,dt){
 if(!run||run.phase!=='play')return;
 dt=clamp(dt,0,.05);run.time+=dt;
 const m=MISSIONS[run.mission];
 run.alarm=clamp(run.alarm+dt*m.alarmRate,0,100);
 run.tracers.forEach(t=>t.ttl-=dt);run.tracers=run.tracers.filter(t=>t.ttl>0);
 run.pickups.forEach(p=>{if(p.ttl!==undefined)p.ttl-=dt;});
 run.pickups=run.pickups.filter(p=>!p.taken&&(p.ttl===undefined||p.ttl>0));
 for(let i=0;i<run.players.length;i++)tickPlayer(run,run.players[i],inputs[i]||{},dt);
 if(run.phase!=='play')return;
 if(run.mission===0){
  // The security network spots exposed intruders. Sabotage CCTV to shut this down.
  if(!run.camerasOff){
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
 if(run.alarm>32){
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
 if(run.players.every(p=>p.hp<=0)||run.players.some(p=>p.hp<=0&&p.bleed<=0)){run.phase='lost';announce(run,'CREW ELIMINATED');}
}
