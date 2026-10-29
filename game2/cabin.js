import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';
import {WEAPONS,GADGETS,UPGRADES} from './data.js?v=9';

const standard=(hex,metalness=0,roughness=.76)=>new THREE.MeshStandardMaterial({color:hex,metalness,roughness});
const plank=standard(0x64432c),darkWood=standard(0x39291f),trimWood=standard(0x80583b);
const iron=standard(0x292c2b,.7),steel=standard(0x66706a,.76),leather=standard(0x65412c),paper=standard(0xd6c4a0),brass=standard(0x9d824a,.65);
const canvasTan=standard(0x958164),sage=standard(0x4b6758),cloth=standard(0x6d4e3f);
function box(parent,x,y,z,w,h,d,mat){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);parent.add(m);return m;}
function cylinder(parent,x,y,z,r,h,mat,segments=12){const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,segments),mat);m.position.set(x,y,z);parent.add(m);return m;}
function tube(parent,x,y,z,length,r,mat){const m=cylinder(parent,x,y,z,r,length,mat,10);m.rotation.z=Math.PI/2;return m;}
function lantern(parent,x,y,z){
 const g=new THREE.Group();g.position.set(x,y,z);parent.add(g);
 box(g,0,.25,0,.2,.55,.2,iron);box(g,0,.24,.12,.14,.34,.015,standard(0xf4bb66,0,.34));
 box(g,0,.24,-.12,.14,.34,.015,standard(0xf4bb66,0,.34));
 for(const i of [-1,1])for(const j of [-1,1])box(g,i*.12,.24,j*.12,.035,.46,.035,iron);
 cylinder(g,0,.56,0,.15,.06,iron);return g;
}
// Weapon shapes are individual models driven by the real equipment catalogue.
function weaponModel(id,item){
 const g=new THREE.Group();const c=standard(item.color||0x879084,.6,.42);
 const hand=id==='pistol'||id==='compact'||id==='revolver';
 const shot=id.includes('shotgun')||id==='shotgun';
 const long=id==='dmr'||id==='sniper';
 const support=id==='lmg';
 const len=hand?.43:long?.85:support?.78:.7;
 box(g,-.05,0,0,len*.84,.19,.16,c);
 tube(g,.11+len*.45,.035,0,len*.55,.052,steel);
 box(g,-.19,-.17,.015,.12,.29,.14,leather).rotation.z=.22;
 box(g,.02,-.19,.02,.14,.23,.115,iron).rotation.z=-.16;
 box(g,-.12,.155,0,len*.36,.065,.1,iron);
 if(!hand){box(g,-len*.72,-.035,0,.37,.14,.135,id==='sniper'?trimWood:leather);
  box(g,.12,-.2,0,.18,support?.39:.29,.12,steel).rotation.z=-.12;}
 if(id==='revolver'){cylinder(g,.16,.02,0,.115,.22,steel).rotation.x=Math.PI/2;}
 if(shot){tube(g,len*.52,.09,.065,.34,.031,iron);box(g,-.31,-.04,0,.34,.13,.14,trimWood);}
 if(id==='silenced'){tube(g,len*.7,.035,0,.32,.081,iron);}
 if(long){box(g,.01,.24,0,.38,.075,.11,iron);tube(g,.02,.3,0,.24,.067,steel);}
 if(support){box(g,.14,-.23,.02,.32,.28,.22,iron);}
 g.rotation.y=-.09;return g;
}
function gadgetModel(id){
 const g=new THREE.Group();
 const color=standard(id==='med'?0xa49076:id==='shield'?0x637f7b:0x52655b,.36);
 if(id==='med'||id==='ammo'||id==='jammer'||id==='emp'){
  box(g,0,0,0,.37,.3,.24,color);box(g,0,.19,0,.22,.065,.07,iron);
  if(id==='med'){box(g,0,0,.128,.045,.2,.024,paper);box(g,0,0,.13,.17,.045,.024,paper);}
  if(id==='ammo')for(const x of [-.11,0,.11])cylinder(g,x,.08,.15,.029,.13,brass);
  if(id==='jammer'||id==='emp'){tube(g,.08,.13,.05,.19,.025,steel);box(g,-.05,.07,.15,.13,.1,.022,brass);}
 }else if(id==='shield'){box(g,0,0,0,.36,.41,.11,color);box(g,0,.02,.064,.23,.28,.035,steel);}
 else if(id==='mine'||id==='decoy'){cylinder(g,0,0,0,.24,.14,iron);box(g,0,.09,0,.15,.06,.14,brass);}
 else {cylinder(g,0,0,0,.115,.38,id==='flash'?steel:sage);
  cylinder(g,0,.23,0,.14,.065,iron);box(g,.08,.28,.02,.18,.035,.05,steel);
  if(id==='frag')box(g,0,0,.11,.11,.18,.03,iron);
 }
 return g;
}
// Physical models for permanent equipment upgrades; each has its own focus target.
function upgradeModel(id){
 const g=new THREE.Group();
 if(id==='armor'){
  // Reinforced ballistic vest with shoulders, front plate, side straps and buckles.
  box(g,0,.04,0,.8,.89,.28,canvasTan);
  box(g,0,.08,.16,.57,.57,.08,iron);
  box(g,0,.08,.215,.35,.39,.023,steel);
  for(const x of [-.37,.37]){
   box(g,x,.41,.015,.17,.33,.24,leather);
   box(g,x,-.24,.015,.1,.5,.32,iron);
  }
  for(const y of [-.22,.05,.3])box(g,0,y,.23,.53,.045,.04,brass);
 }else if(id==='damage'){
  // Ammunition case, exposed armor-piercing rounds and reinforced cartridge box.
  box(g,0,-.16,0,.93,.45,.49,iron);
  box(g,0,.075,0,.99,.07,.53,steel);
  box(g,0,-.22,.26,.52,.14,.03,brass);
  for(const x of [-.31,-.1,.11,.32]){
   cylinder(g,x,.27,.04,.078,.32,brass);
   cylinder(g,x,.47,.04,.066,.09,steel);
  }
 }else if(id==='mag'){
  // Extended curved magazines, follower plates and visible cartridge tips.
  for(const x of [-.32,.32]){
   const mag=box(g,x,-.04,0,.29,.88,.31,iron);mag.rotation.z=x<0?-.15:.15;
   box(g,x,.42,0,.35,.10,.37,steel);
   for(const z of [-.075,.075])cylinder(g,x,.49,z,.05,.1,brass,10);
   box(g,x,-.44,.01,.29,.09,.33,leather);
  }
 }else if(id==='safeKit'){
  box(g,0,-.22,0,.85,.28,.46,iron);
  for(const x of [-.25,0,.25]){cylinder(g,x,.13,0,.07,.46,brass);box(g,x,.32,0,.13,.08,.15,steel);}
  box(g,0,-.36,.27,.7,.09,.04,steel);
 }else if(id==='cyberdeck'){
  box(g,0,0,0,.94,.67,.15,iron);
  box(g,0,.04,.09,.75,.48,.03,standard(0x255d65,.1,.1));
  for(let i=0;i<5;i++)box(g,-.28+i*.14,-.09,.125,.08,.04,.018,sage);
 }else if(id==='handling'){
  for(const x of [-.26,.26]){box(g,x,-.15,0,.29,.47,.25,canvasTan);box(g,x,.15,0,.32,.22,.25,leather);}
  box(g,0,-.46,.1,.68,.1,.22,brass);
 }else if(id==='bagRig'){
  for(const x of [-.31,.31]){box(g,x,-.12,0,.44,.59,.36,canvasTan);box(g,x,.26,0,.46,.1,.38,leather);}
  box(g,0,.44,-.07,1.1,.11,.1,steel);
  for(const x of [-.43,.43])box(g,x,.14,.23,.07,.57,.07,leather);
 }else if(id==='medicTools'){
  box(g,0,0,0,.9,.65,.4,canvasTan);
  box(g,0,.34,0,.97,.09,.45,iron);
  box(g,0,.01,.22,.52,.12,.025,paper);
  box(g,0,.01,.25,.1,.37,.023,brass);
  box(g,0,-.34,.13,.26,.13,.12,steel);
 }
 return g;
}
function createRack(house,station){
 const world=house.scene;
 const g=new THREE.Group();g.position.set(station.x,0,station.z);g.rotation.y=station.rot;world.add(g);
 // No names or subtitles on the cabin walls.
 if(station.id!=='deploy'){
  box(g,0,2.67,-.11,5.65,3.73,.27,darkWood);
  for(const x of [-2.68,2.68])box(g,x,2.65,.13,.12,3.8,.15,trimWood);
  for(const y of [1.02,4.43])box(g,0,y,.12,5.58,.13,.14,trimWood);
  box(g,0,2.55,.07,5.0,2.43,.04,plank);
 }
 // Scroll-free 3D merchandise wall: all weapons and gadgets are real individual catalogue items.
 if(station.id==='weapons'||station.id==='gadgets'){
  const data=station.id==='weapons'?WEAPONS:GADGETS,arr=Object.entries(data);
  const ncol=station.id==='weapons'?6:5,cellWidth=4.8/ncol;
  const rows=Math.ceil(arr.length/ncol);
  for(let i=0;i<rows;i++)box(g,0,i===0?2.69:1.64,.36,5.2,.13,.42,trimWood);
  arr.forEach(([id,item],i)=>{
   const col=i%ncol,row=Math.floor(i/ncol),x=-2.4+cellWidth*(col+.5),y=row===0?3.17:2.11;
   const icon=station.id==='weapons'?weaponModel(id,item):gadgetModel(id);
   icon.position.set(x,y,.47);
   const scale=station.id==='weapons'?.65:1.15;
   icon.scale.setScalar(scale);g.add(icon);
   // The invisible display volume makes each actual 3D item individually inspectable.
   const pick=box(g,x,y,.6,cellWidth*.9,.75,.39,new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}));
   pick.userData.focus={type:'item',station:station.id,kind:station.id==='weapons'?'weapon':'gadget',id};
   house.targets.push(pick);
  });
 }else if(station.id==='missions'){
  const sheet=box(g,0,2.68,.25,3.75,1.78,.06,paper);sheet.rotation.z=-.025;
  for(const x of [-1.3,-.48,.43,1.23]){
   box(g,x,2.86,.33,.53,.68,.02,standard(0xb2aa90));
   for(let j=0;j<4;j++)box(g,x,2.98-j*.11,.36,.37,.014,.02,darkWood);
  }
  for(const x of [-1.65,0,1.65])cylinder(g,x,3.56,.35,.09,.07,brass);
 }else if(station.id==='upgrades'){
  // Show the actual upgrade types, with individual E-to-inspect targets like the armory.
  for(const y of [1.58,2.72])box(g,0,y,.38,5.15,.12,.55,trimWood);
  Object.keys(UPGRADES).forEach((id,i)=>{
   const x=-1.95+(i%4)*1.3,y=i<4?3.25:2.08,icon=upgradeModel(id);
   icon.position.set(x,y,.51);icon.scale.setScalar(.78);g.add(icon);
   const pick=box(g,x,y,.73,1.12,.85,.36,new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}));
   pick.userData.focus={type:'item',station:'upgrades',kind:'upgrade',id};
   house.targets.push(pick);
  });
 }else if(station.id==='crew'){
  box(g,0,2.2,.36,3.3,.65,.61,iron);
  for(const x of [-.7,.7])cylinder(g,x,2.56,.7,.2,.06,brass);
  for(let i=0;i<7;i++)box(g,-1.3+i*.43,2.08,.68,.19,.22,.05,steel);
  tube(g,1.2,3.1,.3,1.2,.04,steel);
  box(g,0,3.02,.19,2.2,.08,.3,trimWood);
 }else if(station.id==='deploy'){
  // Door is floor-mounted in the opening of the real rear wall.
  const z=-.69;
  box(g,0,1.64,z,2.66,3.24,.17,darkWood);
  for(const x of [-1.17,-.84,-.51,-.18,.15,.48,.81,1.14])box(g,x,1.64,z+.1,.305,3.11,.027,plank);
  for(const x of [-1.45,1.45])box(g,x,1.7,z+.14,.21,3.4,.27,trimWood);
  box(g,0,3.4,z+.14,3.12,.25,.31,trimWood);
  for(const y of [.46,1.46,2.64])box(g,0,y,z+.15,2.43,.11,.065,iron);
  box(g,.88,1.27,z+.23,.27,.34,.09,iron);
  cylinder(g,.88,1.28,z+.34,.085,.13,brass);
  box(g,0,.065,z+.27,3.05,.13,.54,steel);
 }
 // Wider interaction zones for radio, armor and door; no painted 3D labels.
 // Keep the upgrade wall's station target behind its individually selectable items.
 const interactive=['crew','deploy'].includes(station.id);
 const board=box(g,0,interactive?1.9:2.7,interactive?.32:-.18,station.id==='deploy'?3.25:5.05,interactive?3.65:3.2,interactive?1.06:.13,new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}));
 board.userData.focus={type:'station',station:station.id};
 house.targets.push(board);return g;
}
export function buildCabin(house,stations){
 const scene=house.scene,wood=house.visuals.surface('wood',0x9d7250,12,12);
 scene.background=new THREE.Color(0x171510);scene.fog=new THREE.FogExp2(0x21170f,.019);
 scene.add(new THREE.HemisphereLight(0xffe7ba,0x29221a,1.45));
 // Floorboards, real plank seams, dark timber wall slats, heavy crossbeams.
 box(scene,0,-.2,0,15.4,.4,15.4,darkWood);
 for(let x=-7.45;x<7.5;x+=.56){
  const floorboard=box(scene,x,.017,0,.535,.045,15.23,wood);
  floorboard.material=wood;
  if(Math.round((x+7.45)/.56)%3===0)box(scene,x,.041,-1,.012,.006,13.3,darkWood);
 }
 box(scene,0,4.6,0,15.35,.24,15.35,darkWood);
 box(scene,0,2.26,-7.6,15.35,4.5,.28,plank);
 for(const x of [-4.54,4.54])box(scene,x,2.26,7.6,6.28,4.5,.28,plank);
 box(scene,0,3.97,7.6,2.8,1.08,.28,plank);
 for(const x of [-7.6,7.6])box(scene,x,2.26,0,.28,4.5,15.35,plank);
 // Individual horizontal logs and exposed vertical posts add cabin depth.
 for(let y=.28;y<=4.35;y+=.43){
  for(const z of [-7.46,7.46]){
   const mat=Math.round(y*10)%2?trimWood:plank;
   if(z>0&&y<3.5)for(const x of [-4.525,4.525])box(scene,x,y,z,6.05,.33,.23,mat);
   else box(scene,0,y,z,15.1,.33,.23,mat);
  }
  for(const x of [-7.46,7.46])box(scene,x,y,0,.23,.33,15.0,(Math.round(y*10)%2?trimWood:plank));
 }
 for(const x of [-7.1,-3.55,0,3.55,7.1])for(const z of [-7.24,7.24]){
  if(x===0&&z>0)continue;
  box(scene,x,2.3,z,.23,4.6,.3,darkWood);
 }
 for(const x of [-1.54,1.54])box(scene,x,1.7,7.24,.22,3.4,.3,darkWood);
 for(const z of [-3.7,0,3.7])for(const x of [-7.28,7.28])box(scene,x,2.3,z,.3,4.6,.25,darkWood);
 for(const z of [-6.9,0,6.9])box(scene,0,4.39,z,15.0,.27,.25,darkWood);
 for(const x of [-5,0,5])box(scene,x,4.39,0,.22,.3,14.9,darkWood);
 // Warm hanging lanterns replace the fluorescent laboratory lighting.
 for(const [x,z] of [[-4.3,-3.9],[4.3,-3.9],[-4.3,4.3],[4.3,4.3],[0,0]]){
  lantern(scene,x,3.86,z);const light=new THREE.PointLight(0xffbd73,3.8,10,2);light.position.set(x,3.65,z);
  scene.add(light);house.lights.push(light);
  box(scene,x,4.28,z,.027,.48,.027,iron);
 }
 // Small patched rug and campaign planning table, placed off the initial sightline.
 box(scene,0,.052,1.12,4.8,.02,3.15,cloth);
 for(const x of [-2.3,2.3])box(scene,x,.068,1.12,.07,.023,3.07,canvasTan);
 for(const z of [-.34,2.55])box(scene,0,.068,z,4.65,.023,.06,canvasTan);
 box(scene,0,.91,1.24,3.85,.22,1.9,trimWood);
 for(const x of [-1.66,1.66])for(const z of [.48,1.99])box(scene,x,.48,z,.2,.84,.23,darkWood);
 for(const [x,z,w,d,rot] of [[-.8,.84,.9,.62,-.09],[.7,1.4,.95,.5,.2],[-.15,1.55,.7,.39,-.16]]){
  const m=box(scene,x,1.045,z,w,.017,d,paper);m.rotation.y=rot;
 }
 box(scene,1.3,1.06,.75,.36,.13,.25,iron);box(scene,1.3,1.16,.77,.13,.08,.055,brass);
 // Storage crates, lantern fuel, burlap sacks, camping cot, old stove.
 for(const [x,z,y] of [[-6.5,-5.7,.35],[6.4,-5.7,.35],[-6.2,5.8,.33],[6.45,5.7,.35]]){
  box(scene,x,y,z,1.3,.7,1.0,darkWood);
  for(const by of [y-.23,y+.23])box(scene,x,by,z+.51,1.31,.09,.05,trimWood);
  for(const bx of [-.48,.48])box(scene,x+bx,y,z+.53,.08,.65,.05,iron);
 }
 box(scene,-4.7,.39,5.42,2.6,.15,1.18,darkWood);box(scene,-4.7,.58,5.42,2.44,.3,1.08,cloth);
 box(scene,-5.4,.76,5.5,.68,.15,.9,canvasTan);
 const stove=box(scene,4.8,.89,5.38,1.28,1.65,1.02,iron);
 box(scene,4.8,1.27,5.9,.65,.53,.03,standard(0x7d4422));
 const chimney=cylinder(scene,4.8,2.65,5.45,.17,2.15,iron);
 for(const x of [4.3,5.3])box(scene,x,.17,5.1,.14,.2,.13,iron);
 const fire=new THREE.PointLight(0xff7d36,2.3,5,2);fire.position.set(4.8,1.35,5.55);scene.add(fire);
 for(const station of stations)createRack(house,station);
}
