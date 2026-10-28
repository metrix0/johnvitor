import test from 'node:test';
import assert from 'node:assert/strict';
import {MISSIONS,WEAPONS,GADGETS,CELL,makeGrid,normalizeProfile,profileDefaults} from './data.js';
import {purchaseGear,settleGear,equippedKit,canEquipWeapon,canEquipGadget,chooseGearSnapshot} from './armory.js';
import {makeRun,stepRun,isBlocked,nearbyTask,lineClear,objectiveReady} from './simulation.js';
const idle={yaw:-Math.PI/2,pitch:0};
function advance(run,inputs,time){for(let i=0;i<Math.ceil(time/.05)&&run.phase==='play';i++)stepRun(run,inputs,.05);}
function reachable(run,start,end){
 const grid=run.grid,from=[Math.round(start.x/CELL),Math.round(start.z/CELL)],dest=[Math.round(end.x/CELL),Math.round(end.z/CELL)];
 const queue=[from],seen=new Set([from.join(',')]);
 for(let i=0;i<queue.length;i++){const [x,z]=queue[i];if(x===dest[0]&&z===dest[1])return true;
  for(const [nx,nz] of [[x+1,z],[x-1,z],[x,z+1],[x,z-1]])if(grid[nz]?.[nx]==='.'&&!seen.has(nx+','+nz)){seen.add(nx+','+nz);queue.push([nx,nz]);}}
 return false;
}
test('each of the five authored maps contains reachable objectives and extraction',()=>{
 for(let n=0;n<MISSIONS.length;n++){
  const run=makeRun(n,1);
  assert.equal(isBlocked(run,run.players[0].x,run.players[0].z),false,'spawn solid '+n);
  for(const o of run.objectives){assert.equal(isBlocked(run,o.x,o.z),false,'objective embedded in wall: '+n+' '+o.id);assert.ok(reachable(run,run.players[0],o),'objective disconnected '+n+' '+o.id);}
  assert.ok(reachable(run,run.players[0],run.exit),'extraction disconnected '+n);
 }
});
test('all five jobs can progress through dependencies, interactions and extraction',()=>{
 for(let n=1;n<5;n++){
  const run=makeRun(n,1);run.enemies=[];run.phase='play';const p=run.players[0];
  for(const o of run.objectives){assert.ok(objectiveReady(run,o),'unexpected locked task '+o.id);
   p.x=o.x;p.z=o.z;advance(run,[{...idle,interact:true}],o.duration+.3);
   assert.equal(o.done,true,'interaction failed: '+n+' / '+o.id);
  }
  p.x=run.exit.x;p.z=run.exit.z;advance(run,[{...idle,interact:true}],1.8);
  assert.equal(run.phase,'won','extraction failed: '+n);
  assert.ok(run.earned>=MISSIONS[n].payout);
 }
});
test('co-op player can revive a downed friend',()=>{
 const run=makeRun(1,2);run.enemies=[];run.phase='play';run.players[1].hp=0;run.players[1].down=true;run.players[1].bleed=20;run.players[1].x=run.players[0].x+.3;
 advance(run,[{...idle,interact:true},idle],3.25);
 assert.ok(run.players[1].hp>0);
 assert.equal(run.players[1].down,false);
});
test('armor and magazine upgrades change actual starting combat stats',()=>{
 const run=makeRun(2,1,[{weapon:'shotgun',gadget:'med',upgrades:{armor:2,mag:3,damage:1}}]);
 const p=run.players[0];
 assert.equal(p.maxHp,150);assert.equal(p.mag,Math.round(WEAPONS.shotgun.mag*1.6));assert.equal(p.gadgets,2);
});
test('profile loading tolerates invalid and older profile shapes',()=>{
 const p=normalizeProfile({name:'bad',unlocked:99,earned:-45,spent:100,upgrades:{armor:900},cleared:['bank','garbage']},'Crew');
 assert.equal(p.name,'Crew');assert.equal(p.unlocked,4);assert.equal(p.earned,0);assert.equal(p.spent,0);assert.equal(p.upgrades.armor,3);assert.deepEqual(p.cleared,['bank']);
});
test('walls block both players and line of sight',()=>{
 const run=makeRun(1,1);run.enemies=[];run.phase='play';const p=run.players[0];p.x=CELL*5;p.z=CELL*3;
 advance(run,[{...idle,forward:true}],2);
 assert.ok(p.x<CELL*6-CELL/2-.3,'walked through office wall at x 6');
 assert.equal(lineClear(run,{x:CELL*5,z:CELL*3},{x:CELL*7,z:CELL*3}),false);
});

test('empty magazines start reload, but cannot reload without reserve ammunition',()=>{
 const run=makeRun(0,1);run.phase='play';run.enemies=[];const p=run.players[0];p.ammo=0;p.reserve=0;
 advance(run,[{...idle,fire:true}],.5);assert.equal(p.reload,0);
 p.reserve=15;advance(run,[{...idle,fire:true}],.1);assert.ok(p.reload>0);
 advance(run,[idle],2);assert.ok(p.ammo>0);
});

test('level one is a full city block, substantially larger than the original store',()=>{
 const run=makeRun(0,1),old=makeRun(1,1);
 assert.ok(run.grid.length>=55&&run.grid[0].length>=70);
 assert.ok(run.grid.length*run.grid[0].length>old.grid.length*old.grid[0].length*7);
 assert.ok(run.objectives.filter(o=>!o.optional).length>=7);
 assert.ok(run.enemies.length>=10);
 assert.ok(run.objectives.some(o=>o.optional));
});
test('level one progresses through recon, infiltration, safe breach, hauling and van defence',()=>{
 const run=makeRun(0,1);run.enemies=[];run.reinforce=Infinity;run.phase='play';const p=run.players[0];
 for(const id of ['recon','manifest','badge','breaker','safe']){
  const obj=run.objectives.find(x=>x.id===id);
  assert.ok(objectiveReady(run,obj),'phase inaccessible: '+id);
  p.x=obj.x;p.z=obj.z;
  advance(run,[{...idle,interact:true}],obj.duration+.25);
  assert.equal(obj.done,true,'phase did not complete: '+id);
 }
 assert.equal(run.loot.length,3);
 for(const bag of run.loot){
  p.x=bag.x;p.z=bag.z;
  advance(run,[{...idle,interact:true}],.9);
  assert.equal(p.bagId,bag.id,'loot not picked up');
  p.x=run.dropoff.x;p.z=run.dropoff.z;
  advance(run,[{...idle,interact:true}],1.45);
  assert.equal(bag.secured,true,'loot not deposited');
 }
 assert.equal(run.secured,3);
 assert.equal(run.objectives.find(o=>o.id==='bags-secured').done,true);
 const radio=run.objectives.find(o=>o.id==='radio');
 p.x=radio.x;p.z=radio.z;
 assert.ok(objectiveReady(run,radio));
 advance(run,[{...idle,interact:true}],radio.duration+.25);
 assert.ok(run.escapeAt>run.time);
 run.nextWave=Infinity;run.reinforce=Infinity;
 advance(run,[idle],34);
 assert.equal(run.escapeReady,true);
 p.x=run.exit.x;p.z=run.exit.z;
 advance(run,[{...idle,interact:true}],2);
 assert.equal(run.phase,'won','getaway should complete');
 assert.ok(run.earned>=800);
});
test('level one side jobs are optional and guard routes reach every room',()=>{
 const run=makeRun(0,1);
 const src=run.players[0];
 for(const o of run.objectives){
  assert.ok(reachable(run,src,o),'inaccessible mission objective '+o.id);
 }
 for(const [i,e] of run.enemies.entries()){
  assert.ok(reachable(run,src,e),'unreachable guard '+i);
 }
});

test('the long first mission offers restock caches and one solo checkpoint retry',()=>{
 const run=makeRun(0,1);run.enemies=[];run.phase='play';
 assert.ok(run.pickups.filter(p=>p.type==='ammo').length>=4);
 assert.ok(run.pickups.filter(p=>p.type==='med').length>=2);
 const p=run.players[0];assert.equal(p.hp,125);
 p.hp=0;p.down=true;p.bleed=15;
 stepRun(run,[idle],.05);
 assert.equal(run.phase,'play');assert.equal(run.continues,0);
 assert.ok(p.hp>0);assert.ok(run.usedContinue);
 p.hp=0;p.down=true;p.bleed=0;
 stepRun(run,[idle],.05);
 assert.equal(run.phase,'lost');
});

test('running is default, Shift walking is quiet and no stamina drain',()=>{
 const run=makeRun(1,1);run.enemies=[];run.reinforce=Infinity;run.phase='play';const p=run.players[0],start=p.x;
 advance(run,[{...idle,forward:true}],.7);const fast=p.x-start,noise=p.noise;
 p.x=start;p.z=MISSIONS[1].spawn[1]*CELL;advance(run,[{...idle,forward:true,walk:true}],.7);
 assert.ok(fast>(p.x-start)*1.7);assert.ok(noise>p.noise*4);assert.equal(p.stamina,100);
});
test('precise 3D ADS shots resolve bodyshots, headshots and misses',()=>{
 const setup=()=>{const run=makeRun(1,1,[{weapon:'dmr'}]);run.phase='play';run.enemies=[];run.reinforce=Infinity;
 const p=run.players[0];p.x=4;p.z=18;
 const e={id:999,x:14,z:18,type:'heavy',hp:245,maxHp:245,stun:5,flinch:0,cool:0};run.enemies.push(e);return {run,p,e};};
 const body=setup();stepRun(body.run,[{yaw:-Math.PI/2,pitch:0,aim:true,fire:true}],.05);
 const head=setup();stepRun(head.run,[{yaw:-Math.PI/2,pitch:.048,aim:true,fire:true}],.05);
 assert.ok(245-body.e.hp>=70);assert.ok(245-head.e.hp>(245-body.e.hp)*1.4);assert.equal(head.p.stats.headshots,1);
 const miss=setup();stepRun(miss.run,[{yaw:-Math.PI/2,pitch:.4,aim:true,fire:true}],.05);assert.equal(miss.e.hp,245);
});
test('fast projectiles cannot tunnel through a player between simulation frames',()=>{
 const run=makeRun(1,1);run.phase='play';run.enemies=[];run.reinforce=Infinity;const p=run.players[0],hp=p.hp;
 run.projectiles.push({id:1000,x:p.x-1.1,z:p.z,dx:1,dz:0,speed:30,damage:22,life:1});
 stepRun(run,[idle],.05);assert.ok(p.hp<hp);assert.equal(run.projectiles.length,0);
});
test('enemies hear running farther than Shift silent walking',()=>{
 const setup=walk=>{const run=makeRun(1,1);run.phase='play';run.reinforce=Infinity;run.enemies=[];const p=run.players[0];p.x=4;p.z=18;
 const e={id:101,x:4,z:11,type:'guard',hp:80,maxHp:80,speed:0,damage:0,range:0,cadence:3,dir:Math.PI,cool:4,path:[],pathTimer:999,stun:0,flinch:0,alert:false,alertUntil:0,lastKnown:null,patrolX:4,patrolZ:11};
 run.enemies.push(e);stepRun(run,[{...idle,forward:true,walk}],.05);return e.alert;};
 assert.equal(setup(false),true);assert.equal(setup(true),false);
});

test('purchased weapons persist on extraction and are forfeited when the mission fails',()=>{
 const profile=profileDefaults('Buyer');profile.earned=1500;
 assert.equal(purchaseGear(profile,'weapon','revolver'),true);
 const paid=profile.spent;
 assert.equal(purchaseGear(profile,'weapon','revolver'),false,'cannot buy duplicate guns');
 assert.equal(profile.spent,paid);
 const kit=equippedKit(profile,'revolver','');
 assert.equal(kit.weapon,'revolver');
 const success=makeRun(0,1,[kit]);
 assert.equal(settleGear(profile,success.players[0],false),false);
 assert.equal(canEquipWeapon(profile,'revolver'),true);
 const failed=makeRun(0,1,[kit]);
 assert.equal(settleGear(profile,failed.players[0],true),true);
 assert.equal(canEquipWeapon(profile,'revolver'),false);
 assert.equal(profile.spent,paid,'losing gear does not refund credits');
 assert.equal(equippedKit(profile,'revolver','').weapon,'pistol','starter sidearm prevents softlocks');
 assert.equal(purchaseGear(profile,'weapon','revolver'),true,'lost gun may be repurchased');
});
test('gadget packs are paid, spent charges persist across missions, and failure loses deployed stock',()=>{
 const profile=profileDefaults('Tester');profile.earned=1600;
 assert.equal(purchaseGear(profile,'gadget','flash'),true);
 assert.equal(profile.gadgetStock.flash,GADGETS.flash.charges);
 let run=makeRun(1,1,[equippedKit(profile,'pistol','flash')]);
 assert.equal(run.players[0].gadgetStart,2);
 run.players[0].gadgets=1;
 assert.equal(settleGear(profile,run.players[0],false),true);
 assert.equal(profile.gadgetStock.flash,1);
 assert.equal(purchaseGear(profile,'gadget','flash'),true);
 assert.equal(profile.gadgetStock.flash,3);
 run=makeRun(1,1,[equippedKit(profile,'pistol','flash')]);
 assert.equal(run.players[0].gadgetStart,2,'mission carries limited charges, not entire stash');
 settleGear(profile,run.players[0],true);
 assert.equal(canEquipGadget(profile,'flash'),false);
 assert.equal(equippedKit(profile,'pistol','flash').gadget,null);
});
test('catalog purchase eligibility, old saves and gear revisions stay consistent',()=>{
 const p=normalizeProfile({unlocked:1,earned:280,spent:0,gearRev:4,weapons:['pistol','revolver','fake'],gadgetStock:{smoke:3,absent:90}},'Op');
 assert.deepEqual(p.weapons,['pistol','revolver']);assert.equal(p.gadgetStock.smoke,3);
 assert.equal(p.gadgetStock.absent,undefined);
 assert.equal(purchaseGear(p,'weapon','sniper'),false,'future weapon locked');
 assert.equal(purchaseGear(p,'gadget','mine'),false,'future gadget locked');
 assert.equal(purchaseGear(p,'weapon','compact'),true);
 assert.equal(purchaseGear(p,'weapon','smg'),false,'unaffordable gear rejected');
 const older=normalizeProfile({...p,gearRev:3,weapons:['pistol','sniper']},'Op');
 assert.equal(chooseGearSnapshot(p,older),p,'an obsolete cloud snapshot cannot resurrect lost gear');
 assert.equal(normalizeProfile(JSON.parse(JSON.stringify(p)),'Op').gearRev,p.gearRev);
});
test('flash, frag, mines, signal jammers and armor plates have simulation effects',()=>{
 const flash=makeRun(1,1,[{weapon:'pistol',gadget:'flash'}]);flash.enemies=[flash.enemies[0]];flash.phase='play';
 let p=flash.players[0],e=flash.enemies[0];e.x=p.x+7;e.z=p.z;e.hp=80;
 stepRun(flash,[{...idle,gadget:true}],.05);
 assert.ok(e.stun>=4,'flash should disable a nearby guard');assert.equal(p.gadgets,1);
 const frag=makeRun(1,1,[{gadget:'frag'}]);frag.phase='play';frag.enemies=[frag.enemies[0]];
 p=frag.players[0];e=frag.enemies[0];e.x=p.x+7;e.z=p.z;
 const old=e.hp;stepRun(frag,[{...idle,gadget:true}],.05);
 assert.ok(e.hp<old,'frag must cause real enemy damage');
 const mine=makeRun(1,1,[{gadget:'mine'}]);mine.phase='play';mine.enemies=[mine.enemies[0]];
 p=mine.players[0];e=mine.enemies[0];e.x=p.x+7;e.z=p.z;
 stepRun(mine,[{...idle,gadget:true}],.05);
 assert.ok(e.hp<e.maxHp,'proximity mine should trigger on enemy');
 const jam=makeRun(1,1,[{gadget:'jammer'}]);jam.phase='play';jam.enemies=[];
 advance(jam,[{...idle,gadget:true}],1);
 assert.ok(jam.jamUntil>jam.time,'jammer activates');
 assert.ok(jam.alarm<.03,'jammer suppresses security alert growth');
 const shield=makeRun(1,1,[{gadget:'shield'}]);shield.phase='play';shield.enemies=[];
 p=shield.players[0];stepRun(shield,[{...idle,gadget:true}],.05);
 const initial=p.hp;
 shield.projectiles.push({id:42,x:p.x,z:p.z,y:1.3,dx:0,dz:0,damage:60,speed:0,life:1,type:'guard'});
 stepRun(shield,[idle],.05);
 assert.ok(initial-p.hp<=22,'armor plate reduces actual damage');
});
test('purchased guns differ in their actual combat behavior against heavy armor',()=>{
 function damageWith(weapon){
  const run=makeRun(1,1,[{weapon}]);run.phase='play';run.enemies=[run.enemies[0]];
  const p=run.players[0],e=run.enemies[0];e.type='heavy';e.hp=245;e.maxHp=245;
  e.x=p.x+6;e.z=p.z;
  stepRun(run,[{...idle,fire:true}],.05);
  return e.maxHp-e.hp;
 }
 assert.ok(damageWith('revolver')>damageWith('pistol'),'armor penetration must be effective');
 assert.ok(damageWith('sniper')>damageWith('revolver'),'sniper must deal more damage');
});
