import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';
import {CELL} from './data.js?v=6';

// Area 3 only: checkout islands and cashier-side fittings, all in world units.
// No floating signage. Merchandise is instanced to keep this inexpensive in WebGL.
const X=n=>n*CELL,Z=n=>n*CELL;
const opaque=(color,metalness=.04,roughness=.65)=>new THREE.MeshStandardMaterial({color,metalness,roughness});
const tint={cabinet:0x374249,front:0x667075,trim:0x1c2b32,top:0xc0b4a0,edge:0x8a7463,cream:0xe6d9bf,steel:0x809395,black:0x1c282f,gray:0x48565b,glass:0x96b8c0};
const glow=(color,intensity)=>new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:intensity,roughness:.33});
function maker(world){
 const groups=new Map();
 const cube=new THREE.BoxGeometry(1,1,1);
 const unit=new THREE.CylinderGeometry(.5,.5,1,10);
 function add(x,y,z,w,h,d,c,kind='matte'){
  let arr=groups.get(kind);if(!arr){arr=[];groups.set(kind,arr);}
  arr.push({x,y,z,w,h,d,c});
 }
 function finish(){
  const matrix=new THREE.Matrix4(),color=new THREE.Color();
  for(const [key,items] of groups){
   const isMetal=key==='metal',emissive=key==='led';
   const material=new THREE.MeshStandardMaterial({color:0xffffff,roughness:emissive?.32:isMetal?.34:.76,metalness:isMetal?.55:.04,
    emissive:emissive?0x293b36:0x000000,emissiveIntensity:emissive?.45:0});
   const mesh=new THREE.InstancedMesh(key==='can'?unit:cube,material,items.length);
   for(let i=0;i<items.length;i++){
    const it=items[i];matrix.makeScale(it.w,it.h,it.d);matrix.setPosition(it.x,it.y,it.z);
    mesh.setMatrixAt(i,matrix);mesh.setColorAt(i,color.setHex(it.c));
   }
   mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;mesh.frustumCulled=false;
   world.add(mesh);
  }
  // Geometry remains owned by the instanced meshes until the scene is cleared.
 }
 return {add,finish,world};
}
function glass(world,x,y,z,w,h,d){
 const mat=new THREE.MeshPhysicalMaterial({color:0xb2e2ee,metalness:.06,roughness:.17,transparent:true,opacity:.20,depthWrite:false,clearcoat:.8});
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);mesh.position.set(x,y,z);world.add(mesh);
}
function screen(world,x,y,z,w,h,color=0x7fc7bb){
 const frame=new THREE.Mesh(new THREE.BoxGeometry(w+.105,h+.105,.095),opaque(0x152228,.33,.44));
 frame.position.set(x,y,z);world.add(frame);
 const display=new THREE.Mesh(new THREE.BoxGeometry(w,h,.016),glow(color,.55));
 display.position.set(x,y,z-.059);world.add(display);
}
function counter(b,tx,tz,kind,index){
 const x=X(tx),z=Z(tz),lotto=kind==='lotto';
 const w=lotto?2.93:3.08,d=lotto?1.34:1.48;
 // Recessed base and floating-looking laminate only where supported.
 b.add(x,.10,z,w-.22,.19,d-.17,0x232b30);
 b.add(x,.57,z,w-.10,.91,d-.12,lotto?0x5d625c:tint.cabinet);
 b.add(x,1.053,z,w+.07,.10,d+.14,lotto?0xd4be9c:tint.top);
 b.add(x,1.11,z,w+.08,.025,d+.14,0xe8ddce);
 // Vertical panels, toes, brushed-metal drawer handles, drawer boundaries.
 for(const sx of [-w/2+.10,w/2-.10])b.add(x+sx,.53,z,.045,.89,d-.04,0x1b282e,'metal');
 b.add(x,.13,z-d/2-.025,w-.18,.10,.032,0x161f26);
 for(const sx of [-.83,.04,.91]){
  b.add(x+sx,.58,z+d/2+.006,.75,.45,.045,lotto?0x484c47:0x4e605f);
  b.add(x+sx,.70,z+d/2+.042,.32,.035,.035,0xabbabb,'metal');
 }
 // Shopper-side illuminated glass candy bay, broken into individual compartments.
 b.add(x,.65,z-d/2-.04,w-.29,.60,.04,0x384b52,'metal');
 for(const sx of [-.98,-.32,.34,1]){
  b.add(x+sx,.78,z-d/2-.09,.055,.36,.075,0x798e94,'metal');
  for(let i=0;i<3;i++){
   b.add(x+sx-.13+i*.13,.55,z-d/2-.095,.12,.13,.07,[0xcbb071,0x9f443f,0x647d9d,0x83976a][(i+index)%4]);
   b.add(x+sx-.13+i*.13,.55,z-d/2-.151,.085,.025,.01,0xe4d5bc);
  }
 }
 if(lotto){
  // Angled scratch-card display protected by a pane, not a blank cabinet.
  b.add(x,1.30,z-.31,w-.20,.045,.43,0x554b40);
  for(let i=0;i<14;i++){
   const cx=x-1.19+(i%7)*.396,cy=1.18+Math.floor(i/7)*.165;
   b.add(cx,cy,z-.61,.35,.145,.018,[0xc27b52,0x87b39a,0xb4a0cf,0xe4b756,0x88b6d0][i%5]);
   b.add(cx,cy,z-.622,.20,.03,.008,0xf5efdb);
  }
  glass(b.world||null,x,1.25,z-.60,w-.13,.42,.025);
 }else{
  // Two practical register workstations; product and equipment sizes are deliberately small.
  const register=index===1||index===2;
  if(register){
   const s=index===1?-.32:-1.15;
   b.add(x+s,1.18,z+.23,.70,.12,.57,0x253038,'metal'); // cash drawer
   b.add(x+s,1.26,z+.22,.57,.06,.41,0x424d4f,'metal');
   b.add(x+s,1.46,z+.18,.085,.43,.09,0x7e9192,'metal'); // screen support
   b.add(x+s,1.69,z+.05,.74,.49,.105,0x152129,'metal');
   b.add(x+s,1.69,z-.012,.60,.36,.018,0x6caea4,'led');
   b.add(x+s-.12,1.76,z-.030,.30,.025,.018,0xdcf1e3);
   b.add(x+s-.12,1.69,z-.030,.30,.025,.018,0x477c73);
   b.add(x+s,1.62,z-.030,.38,.024,.018,0x94c6b4);
   b.add(x+s+.91,1.23,z-.16,.26,.14,.34,0x343d42,'metal'); // bank terminal
   b.add(x+s+.91,1.306,z-.17,.185,.009,.24,0x90d5ca,'led');
   for(let key=0;key<9;key++)b.add(x+s+.84+(key%3)*.069,1.317,z-.08+Math.floor(key/3)*.068,.039,.008,.032,0x27373a);
   b.add(x+s-.90,1.22,z-.19,.48,.23,.40,0xd8cbb5); // receipt printer
   b.add(x+s-.90,1.355,z-.19,.29,.023,.27,0x2b3337);
   b.add(x+s-.90,1.26,z-.403,.32,.015,.11,0xf1ebdc); // printed receipt
  }else{
   // Small checkout impulse buys and a scanner at the end of the line.
   b.add(x-.65,1.18,z-.11,.56,.13,.34,0x1d292d,'metal');
   b.add(x-.65,1.251,z-.11,.43,.012,.25,0x30494c,'led');
   for(let i=0;i<12;i++)b.add(x-.24+(i%6)*.18,1.21,z-.22+Math.floor(i/6)*.25,.13,.18,.15,[0xd2bd66,0xa86551,0x6095a5][i%3]);
  }
 }
}
function behindCounter(b){
 // Cigarette lockbox at the cashier-side wall: actual rack / packs / price rail.
 // It stays west of the entrance, not across the doorway at tile X 27–30.
 const x=X(23.5),z=Z(32.10),w=5.10;
 b.add(x,2.43,z,w,2.23,.30,0x39444a,'metal');
 b.add(x,2.40,z+.18,w-.14,2.06,.060,0xd5ccba);
 for(let shelf=0;shelf<4;shelf++){
  const y=1.71+shelf*.48;
  b.add(x,y-.18,z-.12,w-.15,.058,.40,0x74878c,'metal');
  b.add(x,y-.22,z-.39,w-.15,.043,.045,0xbaa87c);
  for(let i=0;i<16;i++){
   const bx=x-2.26+i*.302;
   const colors=[0xe3dfd4,0x3f5261,0x9a5d4f,0xb2a064,0x657f78,0x7d8495];
   b.add(bx,y,z-.30,.225,.30,.16,colors[(i*7+shelf*3)%6]);
   b.add(bx,y+.07,z-.402,.175,.025,.011,0xf3ece3);
   b.add(bx,y-.02,z-.402,.14,.014,.011,0xb3ad9e);
  }
 }
 // Locking frame and a shallow overhead downlight.
 for(const sx of [-2.52,2.52])b.add(x+sx,2.42,z-.14,.09,2.25,.32,0x45575d,'metal');
 b.add(x,3.57,z-.30,w,.095,.22,0x253239,'metal');
 b.add(x,3.54,z-.43,3.6,.025,.022,0xe4d4ae,'led');
}
function queue(b){
 // Contact-free queue guides lie directly on the tile, leaving the centre aisle open.
 for(const [x,z] of [[24.5,28.48],[38,28.5]]){
  b.add(X(x),.043,Z(z),3.1,.006,.058,0xb9ab83);
  b.add(X(x)-1.56,.044,Z(z)+.59,.065,.008,1.24,0xb9ab83);
 }
 // Entrance mat is shallow, centered in the existing doorway, not a new entrance.
 b.add(X(28.5),.055,Z(32.25),4.6,.018,1.65,0x283a3b);
 for(let i=0;i<8;i++)b.add(X(28.5)-2+i*.57,.068,Z(32.25),.025,.005,1.34,0x5c6b65);
}
function lotteryWall(b){
 const x=X(38.65),z=Z(32.0);
 b.add(x,2.45,z,3.6,2.13,.32,0x3b484a,'metal');
 b.add(x,2.47,z-.20,3.40,1.90,.06,0xd9d3c3);
 for(let row=0;row<6;row++){
  const y=1.66+row*.30;
  b.add(x,y-.15,z-.26,3.3,.045,.36,0x55676b,'metal');
  for(let i=0;i<10;i++){
   const px=x-1.45+i*.32;
   b.add(px,y,z-.345,.268,.227,.035,[0xd5a253,0x8aa5ba,0xa1ad77,0xc88974,0xb8a7c8][(i+row*2)%5]);
   b.add(px,y-.035,z-.369,.15,.018,.008,0xfff1d9);
  }
 }
 b.add(x,3.52,z-.21,3.5,.10,.12,0xb0a17a,'metal');
}
export function buildCheckoutArea(view){
 const world=view.world,b=maker(world);
 // All fixture anchors below are from the original level-1 fixture cells.
 for(const [i,tx] of [24,27,31,38].entries())counter(b,tx,30,tx===38?'lotto':'register',i);
 behindCounter(b);lotteryWall(b);queue(b);
 // Real cashier-side open floor is preserved around the primary till (29,29)
 // and the lottery objective (39,29). Do not put fixtures on those cells.
 // Small supervised light sources: avoid dozens of individual point lights.
 for(const tx of [26,39]){
  b.add(X(tx),4.43,Z(31.15),3.5,.075,.34,0xb9c6bd,'metal');
  b.add(X(tx),4.38,Z(31.15),3.17,.018,.16,0xfff0db,'led');
  const light=new THREE.PointLight(0xffe8cc,1.40,8,2);
  light.position.set(X(tx),4.17,Z(31.15));world.add(light);view.lights.push(light);
 }
 b.finish();
}
