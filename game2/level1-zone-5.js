// Nightshift Market, Area 5: service yard and side alley.
// Decorative geometry is GPU-instanced; leave service-door gaps and reinforcement lanes open.
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';

export function buildLevel1Zone5(view, CELL) {
 const world=view.world, t=n=>n*CELL, entries=new Map();
 const add=(x,y,z,w,h,d,color,metal=.1,angle=0)=>{
  const key=metal===-1?'glow':String(metal);
  if(!entries.has(key))entries.set(key,[]);
  entries.get(key).push({x,y,z,w,h,d,color,angle});
 };
 const b=(x,y,z,w,h,d,c,m=.1,angle=0)=>add(t(x),y,t(z),w,h,d,c,m,angle);
 const lit=(x,y,z,w,d,tone)=>{
  b(x,y,z,w,.11,d,0x28343a,.5);
  b(x,y-.07,z,w*.86,.045,d*.8,tone,-1);
 };
 const serviceDoor=(x,z,side)=>{
  const f=side<0?x-.53:x+.53;
  // Door threshold remains physically open and the frame never spans the walking volume.
  for(const zz of [z-1.54,z+1.54])b(f,1.88,zz,.32,3.75,.2,0x39484d,.66);
  b(f,3.76,z,.32,.24,4.35,0x344249,.67);
  b(f,3.45,z,.15,.08,3.6,0xe5b85f,-1);
  b(f,.095,z,.9,.1,3.65,0x666d6b,.55);
  b(f,2.45,z-1.48,.37,.23,.12,0xaba78b,.34);
  b(f,2.4,z+1.48,.37,.23,.12,0xaba78b,.34);
 };
 // Loading dock flush with the west staff opening: protected rolling threshold,
 // shallow plate, edge strip and forklift hazard marks.
 serviceDoor(12,12,-1);
 b(10.72,.12,12,4.35,.24,8.1,0x777d78,.2);
 b(9.58,.28,12,.15,.2,8.15,0xc6ab62,.35);
 for(let i=0;i<6;i++){
  b(9.25,.057,10.1+i*.77,1.45,.025,.13,i%2?0x413b2a:0xd4a44f,.1,-.48);
 }
 for(const zz of [9.78,14.2]){
  b(11.55,.68,zz,.45,1.17,.43,0xe4b24e,.64);
  b(11.55,.1,zz,.67,.18,.63,0x353e43,.55);
 }
 // Loading shutter is raised above the existing gap, not an invisible wall.
 for(let i=0;i<4;i++)b(11.46,4.15+i*.145,12,.16,.105,4.22,i%2?0x78888c:0x49595f,.67);
 lit(11.4,4.21,12,1.6,.3,0xffdc9b);
 // Weathered utility conduit, protective cable trays and visibly mounted fixtures.
 for(const side of [12,44]){
  const x=side===12?11.44:44.56;
  const wallZ=side===12?[17.9,21.4,26.1,30.2]:[17.6,21.1,26,30.3];
  for(const z of wallZ){
   b(x,1.75,z,.12,3.48,.14,0x788484,.56);
   b(x,3.65,z,.32,.28,.35,0x3a4649,.65);
  }
  for(const y of [2.95,3.14]){
   for(const [z,len] of [[8.3,2.45],[17.8,14.8],[28.1,9.5]]){
    b(x,y,z,.11,.075,len,0x505d60,.73);
   }
  }
 }
 // Closed receiving shutter and maintenance bay fronts make the otherwise blank west
 // wall read as a working back-of-house facade; these sit flush against solid wall.
 for(const z of [21.1,28.3]){
  b(11.48,2.22,z,.16,3.55,5.7,0x718087,.57);
  b(11.45,4.08,z,.34,.29,6.1,0x283b42,.66);
  for(let i=0;i<11;i++){
   const y=.69+i*.29;
   b(11.38,y,z,.065,.056,5.75,i%3?0x87989a:0x354d57,.63);
  }
  for(const zz of [z-1.48,z+1.48]){
   b(11.39,2.1,zz,.3,3.86,.17,0x35454b,.67);
   b(11.36,.23,zz,.23,.27,.2,0xe0af54,.6);
  }
  b(11.35,3.65,z,.1,.25,.6,0xe0cda0,-1);
  b(11.37,1.42,z+1.21,.1,.42,.32,0x34494c,.66);
 }

 // Side alley: secure employee entry with a real door frame, recessed fixture and step.
 serviceDoor(44,12,1);
 lit(44.75,4.13,12,1.18,.34,0xcde8f0);
 b(44.65,.062,12,1.15,.065,4.2,0x9aa39d,.2);
 for(const zz of [10.6,13.5]){
  b(44.47,.58,zz,.38,1.05,.37,0xd8b36f,.36);
 }
 // The formerly endless open side is enclosed by a neighboring low industrial
 // building and a chain-link security run. Both sit outside playable tile centers.
 b(55.7,3.14,24,.45,6.28,66,0x52636a,.12);
 b(55.7,6.35,24,.72,.28,66,0x516166,.55);
 for(let z=8;z<42;z+=4.1){
  b(55.35,2.7,z,.26,5.4,.24,0x78858a,.63);
  b(55.35,4.9,z,.42,.21,.48,0x52666b,.64);
 }
 for(const y of [1.15,3.35,5.05])b(55.32,y,24,.1,.12,66,0x52646a,.7);
 // Open mesh fence toward the parking transition. Repeated slender wires are
 // combined into instanced draw calls, not individual 3D objects.
 for(const zz of [35,40]){
  for(let x=47.6;x<=54.8;x+=1.6)b(x,1.83,zz,.075,3.65,.08,0x708080,.63);
  for(const y of [.35,1.75,3.54])b(51.2,y,zz,14.5,.075,.085,0x62767a,.63);
 }
 // Alley storm drain / cable trench: flush to ground, never across player height.
 for(const zz of [18.8,27.1,35.1]){
  b(51.8,.068,zz,4.3,.042,.7,0x1d2b32,.64);
  for(let i=0;i<8;i++)b(50.15+i*.46,.096,zz,.06,.03,.6,0x738183,.63);
 }
 // Dumpster bases already exist in the mission decor and collision grid.
 // Add lids, ribs, hinges, wheels, corner guards and refuse bags in place.
 for(const [x,z] of [[49,10],[51,22],[50,33]]){
  for(const dx of [-.78,.78]){
   b(x+dx,.96,z+0.8,.09,1.55,.09,0x77928a,.56);
   b(x+dx,.96,z-.8,.09,1.55,.09,0x77928a,.56);
   for(const dz of [-.55,.55])b(x+dx,.22,z+dz,.32,.26,.28,0x1a252a,.5);
  }
  b(x,1.87,z-.39,2.14,.11,.86,0x27433f,.66);
  b(x,1.91,z+.43,2.14,.09,.8,0x253d3a,.66);
  b(x,1.84,z,2.25,.075,.16,0x83988e,.54);
  for(const dz of [-.44,.44])b(x,1.92,z+dz,1.9,.045,.06,0x4d7771,.55);
  b(x,1.17,z+0.81,.94,.32,.038,0xb5b99c,.08);
 }
 // Pallet cover stays anchored at existing pallet locations; no random obstacles
 // are put in the narrow staff-entry or reinforcement corridors.
 for(const [x,z] of [[6,15],[9,30],[53,16]]){
  for(const dz of [-.64,.64])b(x,.16,z+dz,2.25,.14,.19,0x9c7952,.1);
  for(const dx of [-.83,0,.83])b(x+dx,.09,z,.16,.18,1.75,0x584936,.1);
  for(let tier=0;tier<2;tier++)for(let i=0;i<2;i++){
   const xx=x+(i?0.37:-.37),zz=z+.04*(tier%2);
   b(xx,1.45+tier*.42,zz,.65,.38,1.14,i===tier?0x9b815d:0x766349,.05);
   b(xx,1.45+tier*.42,zz+.59,.42,.095,.018,0xc6b394,.06);
  }
 }
 // A parked wholesale delivery van becomes a recognizable refrigerated box truck:
 // cab details, cargo box side panels, door hinges, refrigeration unit and rails.
 const tx=5,tz=22;
 b(tx,2.2,tz+.5,3.38,2.1,4.8,0xcdd3ca,.14);
 b(tx,3.28,tz+.5,3.48,.18,4.92,0xf2f0df,.33);
 for(const dx of [-1.72,1.72]){
  b(tx+dx,2.14,tz+.5,.07,1.78,4.7,0x718582,.54);
  b(tx+dx*1.015,2.23,tz+.55,.045,.3,4.5,0x28666a,.3);
  for(let z=-1.4;z<=2.15;z+=.78)b(tx+dx*1.023,2.48,tz+z,.045,.85,.055,0xa9b5ac,.32);
 }
 b(tx,2.85,tz-2.63,2.16,.65,.55,0x40565c,.64);
 for(const dx of [-.7,.7])b(tx+dx,2.67,tz-2.91,.65,.25,.09,0x839c9c,.55);
 for(const dx of [-1.25,1.25]){
  b(tx+dx,1.16,tz-3.1,.5,.32,.12,0xffe3b5,-1);
  b(tx+dx,1.16,tz+3.13,.42,.29,.11,0xe16a5a,-1);
 }
 b(tx,1.1,tz+3.17,2.9,.07,.1,0xb0b8ac,.72);
 for(const dx of [-.7,.7])b(tx+dx,2.06,tz+3.18,.06,1.68,.1,0x6b7671,.65);
 // Rooftop mechanical units and exhaust conduits mounted to the service facade.
 for(const [x,z] of [[11.48,20],[44.58,24],[44.58,29.6]]){
  b(x,2.05,z,.44,1.18,1.35,0x647a7b,.61);
  for(let i=0;i<5;i++)b(x+(x>20?.23:-.23),1.75+i*.13,z,.035,.045,1.1,0x273c41,.62);
  b(x,2.7,z,.55,.13,1.43,0x9caaa3,.56);
  b(x,1.27,z,.4,.1,1.3,0x344a4e,.58);
 }
 // Industrial fixture halos, with only two modest local dynamic lights.
 for(const [x,z,c] of [[11.35,15.5,0xffdc9d],[11.35,29.2,0xffcc90],[44.75,15.5,0xcbe8ed],[44.75,23.4,0xa3d9ec],[44.75,31.1,0xc8e4ee]]){
  b(x,3.97,z,.56,.26,.72,0x2c3a40,.63);
  b(x,3.82,z,.42,.04,.58,c,-1);
  b(x,3.72,z,.55,.05,.14,0x4a5c5d,.57);
 }
 for(const [x,z,c] of [[11.4,22,0xffd69a],[46,30,0x9dcce3]]){
  const light=new THREE.PointLight(c,3.0,17,2);
  light.position.set(t(x),3.48,t(z));world.add(light);view.lights.push(light);
 }
 // Parking-to-alley transition: drain strips, curbs and edge warning stripes.
 for(const [x,z,w,d] of [[47.1,34.7,2.7,1.4],[10.6,31.2,2.5,1.2]]){
  b(x,.055,z,w,.035,d,0x353f43,.2);
  for(let i=0;i<5;i++)b(x-w/4+i*w/8,.081,z,.055,.02,d*.8,0x6d807e,.52);
 }
 for(let i=0;i<8;i++)b(45.7,.058,17+i*2.1,.12,.026,.75,i%2?0xd3ad5f:0x313b3f,.1);
 // Flush pooled reflections are deliberately subdued rather than opaque puddles.
 for(const [x,z,w,d] of [[7,12,3.5,1.2],[5,26,2.7,1.6],[49,19,2.8,1.2],[52,29,3.4,1.1]]){
  b(x,.043,z,w,.012,d,0x35484e,.12);
 }
 const matrix=new THREE.Matrix4(),q=new THREE.Quaternion(),scale=new THREE.Vector3();
 const color=new THREE.Color();
 for(const [key,items] of entries){
  const glowing=key==='glow';
  const material=glowing?new THREE.MeshBasicMaterial({color:0xffffff,toneMapped:false})
   :new THREE.MeshStandardMaterial({color:0xffffff,roughness:Number(key)>.5?.48:.79,metalness:Number(key)});
  const mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),material,items.length);
  items.forEach((o,i)=>{
   q.setFromAxisAngle(new THREE.Vector3(0,1,0),o.angle||0);
   scale.set(o.w,o.h,o.d);
   matrix.compose(new THREE.Vector3(o.x,o.y,o.z),q,scale);
   mesh.setMatrixAt(i,matrix);mesh.setColorAt(i,color.setHex(o.color));
  });
  mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;
  mesh.frustumCulled=false;world.add(mesh);
 }
}
