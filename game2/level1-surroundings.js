import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';

// Static scenery beyond Level 1's playable 0..112 × 0..90 metre grid.
// All of this is visual-only: no new collision, objectives, AI or lighting loops.
// Instance-colored geometry means ~300 windows/props add only a few draw calls.
export function buildLevel1Surroundings(view){
 const world=view.world;
 const groups=new Map();
 const add=(kind,x,y,z,w,h,d,color)=>{
  if(!groups.has(kind))groups.set(kind,[]);
  groups.get(kind).push([x,y,z,w,h,d,color]);
 };
 const block=(x,y,z,w,h,d,color)=>add('masonry',x,y,z,w,h,d,color);
 const trim=(x,y,z,w,h,d,color)=>add('trim',x,y,z,w,h,d,color);
 const road=(x,y,z,w,h,d,color)=>add('paving',x,y,z,w,h,d,color);
 const lamp=(x,y,z,w,h,d,color)=>add('glow',x,y,z,w,h,d,color);
 const dark=(x,y,z,w,h,d,color)=>add('dark',x,y,z,w,h,d,color);

 // Seamless low-contrast terrain beneath the actual map; the original map
 // surface stays on top, and only scenery outside it is visible.
 road(56,-.47,45,370,.84,340,0x27323a);

 // Streets in every direction provide depth instead of a hard square map edge.
 // Southern public street sits beyond the market's parking and extraction lot.
 road(56,.003,101,295,.04,27,0x273038);
 road(56,.028,120,295,.10,9,0x727573);
 road(56,.03,90,295,.10,4.8,0x777b79);
 // East/west service streets continue past the player's alley and loading zone.
 road(125,.004,44,22,.04,238,0x28323a);
 road(-17,.004,44,21,.04,238,0x273039);
 road(142,.03,45,5,.09,220,0x6a7474);
 road(-31,.03,45,5,.09,220,0x686f71);
 // Northern streets and shoulders, behind the back rooms.
 road(56,.003,-17,275,.04,24,0x29343a);
 road(56,.028,-32,265,.10,5.5,0x747974);
 road(56,.028,-1.3,265,.08,3,0x6c7472);

 // Sparse lane centerlines and pedestrian crossing by the supermarket.
 for(let x=-64;x<180;x+=13)road(x,.044,101,5.8,.014,.11,0xafa992);
 for(let z=-70;z<147;z+=14){
  road(125,.044,z,.10,.014,6,0xbcb49b);
  road(-17,.044,z,.10,.014,6,0xbcb49b);
 }
 for(let x=31;x<=43;x+=2.4)road(x,.047,108,1.18,.013,4.1,0xa3a49c);
 for(let z=15;z<=25;z+=2.5)road(126,.048,z,3.8,.013,1.08,0x959d9b);
 // Low concrete curbs and drains make the pavement sit on the road.
 for(const zz of [89,124]){
  trim(56,.14,zz,280,.24,.23,0x8b918d);
  dark(56,.050,zz+.65,280,.015,.20,0x1a252a);
 }
 for(const xx of [-30,143])trim(xx,.14,42,.23,.24,206,0x939b97);

 const masonry=[0x58616b,0x6f7372,0x746d67,0x4b5b61,0x777469,0x5d6766,0x686875];
 const awnings=[0x6a4b47,0x556b66,0x4c5560,0x88735f,0x4e5b54];
 const windowColor=[0xd9af73,0xb9cbd3,0xefd39c,0x677b83,0xc6a784];

 // The facades are oriented toward the actual surrounding streets.
 // Roofs and lower-level storefronts are simple silhouettes, not full interiors.
 function building(x,z,w,d,height,seed,side){
  const wall=masonry[seed%masonry.length],roof=0x222c32;
  block(x,height*.5,z,w,height,d,wall);
  dark(x,height+.20,z,w+.7,.40,d+.7,roof);
  // Parapet corners, shopfront panels and muted awning under lit windows.
  if(side==='north'||side==='south'){
   const face=z+(side==='north'?-d/2-.10:d/2+.10);
   const outward=side==='north'?-1:1;
   trim(x,2.1,face,w*.83,.20,.38,awnings[seed%awnings.length]);
   dark(x,1.02,face,w*.78,1.75,.14,0x283941);
   const columns=Math.max(2,Math.floor((w-2.5)/3.8));
   for(let col=0;col<columns;col++){
    const xx=x+(col-(columns-1)/2)*3.45;
    // Ground level recessed shop glass, very low contrast.
    trim(xx,1.02,face+outward*.10,2.2,1.60,.08,0x4d646e);
    for(let floor=0;floor<Math.floor((height-3)/2.7);floor++){
     const y=3.7+floor*2.7;
     const lit=(seed*7+col*3+floor*5)%6!==0;
     dark(xx,y,face,1.42,1.25,.12,0x24313a);
     trim(xx,y,face+outward*.07,1.55,.065,.16,0x919b95);
     if(lit)lamp(xx,y,face+outward*.13,1.15,.95,.085,windowColor[(seed+col+floor)%windowColor.length]);
     else dark(xx,y,face+outward*.13,1.15,.95,.09,0x263740);
    }
   }
  }else{
   const face=x+(side==='west'?-w/2-.10:w/2+.10);
   const outward=side==='west'?-1:1;
   trim(face,2.1,z,.36,.20,d*.82,awnings[seed%awnings.length]);
   dark(face,1.02,z,.12,1.75,d*.78,0x283941);
   const columns=Math.max(2,Math.floor((d-2.5)/3.7));
   for(let col=0;col<columns;col++){
    const zz=z+(col-(columns-1)/2)*3.35;
    trim(face+outward*.10,1.02,zz,.08,1.60,2.2,0x516973);
    for(let floor=0;floor<Math.floor((height-3)/2.7);floor++){
     const y=3.7+floor*2.7;
     dark(face,y,zz,.12,1.25,1.43,0x25333a);
     trim(face+outward*.07,y,zz,.16,.065,1.54,0x899692);
     if((col+seed+floor*2)%5!==0)
      lamp(face+outward*.13,y,zz,.085,.95,1.12,windowColor[(seed+col+floor)%windowColor.length]);
    }
   }
  }
  // HVAC equipment visibly sits on the roof.
  if(seed%2===0){
   dark(x-w*.17,height+.58,z,.95,.83,1.4,0x3b4b51);
   trim(x-w*.17,height+1.01,z,1.06,.10,1.49,0x7c8782);
  }
 }

 // Across the main parking-lot road: mixed low shops, offices and apartments.
 const south=[
  [0,133,19,16,7,0],[23,135,20,19,9,1],[49,134,23,18,12,2],
  [78,134,23,17,8,3],[105,136,20,21,11,4],[133,137,20,17,7,5]
 ];
 for(const [x,z,w,d,h,seed] of south)building(x,z,w,d,h,seed,'north');
 // Service-lane buildings and residential rooftops in peripheral vision.
 for(const [x,z,w,d,h,seed,face] of [
  [-45,10,18,21,9,1,'east'],[-44,39,19,23,12,3,'east'],
  [-45,68,19,22,8,4,'east'],[-45,96,19,19,10,5,'east'],
  [154,-1,18,19,9,2,'west'],[155,27,21,22,13,4,'west'],
  [156,57,21,20,9,6,'west'],[155,84,20,22,12,1,'west'],
  [14,-43,22,19,8,3,'south'],[43,-45,22,20,12,0,'south'],
  [75,-43,25,18,10,5,'south'],[106,-43,22,19,7,2,'south']
 ])building(x,z,w,d,h,seed,face);

 // Low apartment/warehouse silhouettes further behind the street roofs.
 // These are sparse to keep the sky visible; use no animated light sources.
 for(const [x,z,w,d,h] of [
  [-69,-24,26,18,18],[-76,120,23,20,17],
  [172,115,25,21,20],[180,-27,29,23,16],
  [34,160,25,18,18],[97,163,25,21,20]
 ])building(x,z,w,d,h,2,'north');

 // Warm streetlamp props only — fake emissive luminaires; no PointLights.
 function streetlight(x,z,alongX=true,seed=0){
  dark(x,3.0,z,.16,6.0,.16,0x3e525a);
  dark(x,5.94,z,.23,.18,.23,0x54646a);
  if(alongX){
   dark(x+1.0,5.98,z,2.0,.11,.12,0x576b70);
   lamp(x+2,5.86,z,.82,.08,.43,seed%3?0xffcb8c:0xc2deeb);
   trim(x+2,5.99,z,.89,.12,.49,0x394b51);
  }else{
   dark(x,5.98,z+1.0,.12,.11,2.0,0x576b70);
   lamp(x,5.86,z+2,.43,.08,.82,seed%3?0xffcb8c:0xc2deeb);
   trim(x,5.99,z+2,.49,.12,.89,0x394b51);
  }
 }
 for(let x=-12,i=0;x<135;x+=31,i++)streetlight(x,114,true,i);
 for(let z=-25,i=0;z<121;z+=30,i++)streetlight(136,z,false,i);
 for(let z=-20,i=0;z<117;z+=32,i++)streetlight(-27,z,false,i+1);

 // Parked cars and delivery skips beyond map edges sell an active neighborhood.
 function parkedCar(x,z,tone){
  block(x,.68,z,2.10,.77,4.05,tone);
  dark(x,1.28,z-.17,1.83,.70,2.15,0x293941);
  for(const dx of [-1.00,1.00])for(const dz of [-1.24,1.24])
   dark(x+dx,.38,z+dz,.23,.65,.56,0x151d23);
  lamp(x-.68,.71,z-2.07,.31,.13,.06,0xb9cabf);
  lamp(x+.68,.71,z-2.07,.31,.13,.06,0xb9cabf);
 }
 for(const [x,z,tint] of [
  [-5,117,0x4e6368],[19,117,0x68706c],[83,118,0x4c5866],
  [119,117,0x5a5d63],[147,40,0x64726f],[-37,63,0x555f63]
 ])parkedCar(x,z,tint);

 // Tiny greenery islands and roadside service boxes are near the road, not in
 // the playable market; trunks and canopies share the same instanced materials.
 function shrub(x,z,seed){
  trim(x,.31,z,2.1,.55,2.1,0x686a63);
  dark(x,1.25,z,.28,1.9,.28,0x474b40);
  for(const [dx,dz] of [[0,0],[-.65,.38],[.62,-.23]]){
   block(x+dx,2.35,z+dz,1.65,1.7,1.56,seed%2?0x2c4d46:0x344e4c);
  }
 }
 for(const [x,z,n] of [[-32,110,1],[-38,-12,0],[152,109,1],[117,-33,0],[8,121,1]])shrub(x,z,n);
 for(const [x,z] of [[-22,8],[143,73],[112,122]]) {
  block(x,.57,z,1.6,1.1,1.27,0x415c56);
  dark(x,1.19,z,1.77,.17,1.41,0x24343b);
 }

 // Six static instanced meshes regardless of how many background objects exist.
 const unit=new THREE.BoxGeometry(1,1,1);
 const transform=new THREE.Matrix4(),color=new THREE.Color();
 const materials={
  masonry:new THREE.MeshStandardMaterial({color:0xffffff,roughness:.95,metalness:0}),
  trim:new THREE.MeshStandardMaterial({color:0xffffff,roughness:.78,metalness:.11}),
  paving:new THREE.MeshStandardMaterial({color:0xffffff,roughness:1,metalness:0}),
  dark:new THREE.MeshStandardMaterial({color:0xffffff,roughness:.74,metalness:.08}),
  glow:new THREE.MeshBasicMaterial({color:0xffffff,toneMapped:false})
 };
 for(const [kind,items] of groups){
  const mesh=new THREE.InstancedMesh(unit,materials[kind],items.length);
  for(let i=0;i<items.length;i++){
   const [x,y,z,w,h,d,shade]=items[i];
   transform.makeScale(w,h,d);transform.setPosition(x,y,z);
   mesh.setMatrixAt(i,transform);mesh.setColorAt(i,color.setHex(shade));
  }
  mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;
  mesh.frustumCulled=false;world.add(mesh);
 }
}
