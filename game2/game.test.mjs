import test from 'node:test';
import assert from 'node:assert/strict';
import {MISSIONS,WEAPONS,CELL,makeGrid,normalizeProfile} from './data.js';
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
 for(let n=0;n<5;n++){
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
 const run=makeRun(0,1);run.enemies=[];run.phase='play';const p=run.players[0];p.x=CELL*6;p.z=CELL*3;
 const start=p.x;advance(run,[{...idle,forward:true}],2);
 assert.ok(p.x<CELL*7-CELL/2-.3,'walked through wall at x 7');
 assert.equal(lineClear(run,{x:CELL*6,z:CELL*3},{x:CELL*8,z:CELL*3}),false);
});

test('empty magazines start reload, but cannot reload without reserve ammunition',()=>{
 const run=makeRun(0,1);run.phase='play';run.enemies=[];const p=run.players[0];p.ammo=0;p.reserve=0;
 advance(run,[{...idle,fire:true}],.5);assert.equal(p.reload,0);
 p.reserve=15;advance(run,[{...idle,fire:true}],.1);assert.ok(p.reload>0);
 advance(run,[idle],2);assert.ok(p.ammo>0);
});
