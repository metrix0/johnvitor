import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';

// Nightshift Market / Area 2. Decorative merchandise uses the existing market
// instancing pipeline. Every freestanding fixture stays inside its grid collision.
const COLORS=[0xb75a45,0xe6bc56,0x5b8c9e,0x698d67,0xc79064,0x947b9c,0x518482,0xc4ac8b,0xb8c85f,0xdd8f78];
const ACCENTS=[0xf5e8d3,0x1c353b,0xf3d16b,0xe4e9e4,0x263d50,0xfff3dc];
const box=(v,g,x,y,z,w,h,d,color,metal=0)=>v.marketBox(g,x,y,z,w,h,d,color,metal);
const cylinder=(v,g,x,y,z,r,h,color)=>v.marketCylinder(g,x,y,z,r,h,color);
function stock(v,g,side,y,z,kind,seed){
 const s=side,color=COLORS[seed%COLORS.length],accent=ACCENTS[(seed*3+1)%ACCENTS.length];
 const x=s*.39;
 if(kind===0){ // Tall cereal, tea and pantry cartons with distinct face panels.
  const h=.34+(seed%3)*.065;
  box(v,g,x,y+h/2,z,.27,h,.255,color);
  box(v,g,x+s*.143,y+h*.60,z,.019,h*.46,.185,accent);
  box(v,g,x+s*.155,y+h*.23,z,.021,.033,.18,0xf2ede2);
 }else if(kind===1){ // Soft snack bags with folded tops and contrasting brand bands.
  const h=.27+(seed%4)*.03;
  box(v,g,x,y+h/2,z,.24,h,.25,color);
  box(v,g,x,y+h-.025,z,.23,.045,.24,accent);
  box(v,g,x+s*.13,y+h*.50,z,.012,.11,.21,0xf6e0a0);
  box(v,g,x+s*.136,y+h*.21,z,.012,.035,.22,0x2b3437);
 }else if(kind===2){ // Metal tins and canned food.
  const h=.24+(seed%3)*.03;
  cylinder(v,g,x,y+h/2,z,.115,h,color);
  cylinder(v,g,x,y+h+.012,z,.119,.028,0xc3c8bd);
  box(v,g,x+s*.112,y+h*.50,z,.012,h*.33,.18,accent);
 }else if(kind===3){ // Drinks and oils: glass/plastic bottle, body label and cap.
  const h=.39+(seed%2)*.05;
  cylinder(v,g,x,y+h*.43,z,.095,h*.77,color);
  cylinder(v,g,x,y+h*.87,z,.06,h*.17,accent);
  cylinder(v,g,x,y+h*.97,z,.072,.055,0xe5e3d7);
  box(v,g,x+s*.094,y+h*.42,z,.012,.12,.15,ACCENTS[(seed+2)%ACCENTS.length]);
 }else{ // Peanut butter, spreads and preserved-food jars.
  const h=.28+(seed%2)*.04;
  cylinder(v,g,x,y+h*.49,z,.127,h*.82,0xb68d61);
  cylinder(v,g,x,y+h*.92,z,.13,.066,color);
  box(v,g,x+s*.125,y+h*.52,z,.013,h*.40,.21,accent);
 }
}
function gondola(v,g,fixture){
 const frame=0x545f60,steel=0x87918b,rail=0xe8ded0;
 // A real double-sided 3.55m gondola follows the two z tiles blocked by the grid.
 const middle=1,foot=.14;
 box(v,g,0,foot,middle,1.5,.19,3.55,0x404847,.5);
 box(v,g,0,1.12,middle,.06,2.14,3.54,0x536164,.45);
 for(const z of [-.72,2.72]){
  for(const x of [-.67,.67])box(v,g,x,1.12,z,.075,2.14,.075,frame,.6);
  box(v,g,0,.11,z,1.66,.15,.22,0x4f5552,.5);
 }
 for(const y of [.27,.75,1.23,1.71]){
  box(v,g,0,y,middle,1.52,.066,3.6,steel,.45);
  for(const s of [-1,1]){
   box(v,g,s*.77,y-.029,middle,.03,.071,3.6,rail,.20);
   for(let i=0;i<10;i++){
    const z=-.52+i*.329;
    const key=fixture*37+Math.floor(y*10)*11+i*3+(s+1)*5;
    // Product lines vary by shelf and aisle, with plausible shapes and heights.
    stock(v,g,s,y+.05,z,(fixture+Math.round(y*8)+i)%5,key);
    // Individual small shelf-edge price tags are physically attached to each rail.
    box(v,g,s*.788,y-.027,z,.008,.038,.125,i%3?0xf2ece0:0xe7cd83);
    box(v,g,s*.794,y-.025,z,.009,.012,.06,0x364145);
   }
  }
 }
 box(v,g,0,2.17,middle,1.57,.092,3.62,0x4b5553,.55);
 // Endcap snacks and clip-strip merchandise, kept within the shelf footprint.
 for(const z of [-.78,2.78]){
  box(v,g,0,1.05,z,1.27,1.7,.08,0x4a5757,.48);
  for(let tier=0;tier<3;tier++){
   const y=.51+tier*.43;
   box(v,g,0,y,z+(z<0?-.065:.065),1.35,.07,.24,steel,.45);
   for(let k=0;k<5;k++){
    const x=(k-2)*.245,seed=fixture*17+tier*7+k;
    box(v,g,x,y+.17,z+(z<0?-.10:.10),.19,.31,.075,COLORS[seed%COLORS.length]);
    box(v,g,x,y+.18,z+(z<0?-.143:.143),.15,.12,.008,ACCENTS[(seed+2)%ACCENTS.length]);
   }
  }
 }
}
function coldCase(v,g,fixture){
 const shell=0x29383f,frame=0x7e939b,white=0xdbebed;
 // A four-door refrigeration bank fills each 6m section of the west wall.
 // The real space behind transparent doors remains visible, not a solid block.
 box(v,g,-.68,1.38,0,.09,2.72,5.98,0x27343a,.30);
 for(const y of [.11,2.75])box(v,g,-.03,y,0,1.38,.19,6.00,shell,.65);
 for(const z of [-2.99,2.99])box(v,g,-.04,1.41,z,1.38,2.68,.10,shell,.6);
 for(const y of [.33,.76,1.19,1.62,2.05,2.47]){
  box(v,g,-.04,y,0,1.29,.047,5.90,white,.45);
  box(v,g,.46,y-.018,0,.022,.038,5.86,0xb9d0d2,.32);
 }
 for(let door=0;door<4;door++){
  const z=-2.2425+door*1.495;
  for(let tier=0;tier<5;tier++)for(let i=0;i<4;i++){
   const zz=z-.48+i*.315,seed=fixture*67+door*17+tier*11+i;
   const y=.36+tier*.43;
   const body=COLORS[(seed+tier)%COLORS.length];
   // Front-facing bottles, cartons and cans can be identified through the glass.
   if((tier+door+i)%3===0){
    box(v,g,.22,y+.16,zz,.30,.32,.28,body);
    box(v,g,.375,y+.17,zz,.012,.14,.20,0xe8e9d7);
   }else{
    cylinder(v,g,.25,y+.14,zz,.109,.29,body);
    cylinder(v,g,.25,y+.303,zz,.10,.028,0xc5cac3);
    box(v,g,.359,y+.14,zz,.013,.12,.17,ACCENTS[(seed+3)%ACCENTS.length]);
    if((tier+i)%3===1)cylinder(v,g,.25,y+.335,zz,.067,.062,0xe0e3dd);
   }
  }
  // Slim aluminum door outline, mullions, handle and upper cold LED.
  for(const zEdge of [z-.738,z+.738])box(v,g,.72,1.39,zEdge,.09,2.42,.055,frame,.64);
  for(const y of [.19,2.60])box(v,g,.72,y,z,.08,.07,1.48,frame,.64);
  box(v,g,.81,1.42,z+.51,.06,.76,.058,0xd5e3e3,.63);
  box(v,g,.59,2.54,z,.042,.055,1.38,0xd9fbff,.35);
  // Low-opacity glass shows stocked products instead of blocking the view.
  const glass=new THREE.MeshPhysicalMaterial({color:0xbfe4e8,metalness:.08,roughness:.16,transparent:true,opacity:.12,depthWrite:false,side:THREE.DoubleSide});
  v.box(g,.76,1.40,z,.024,2.29,1.42,glass);
 }
 // Real compressor toe kick and rear cable duct.
 box(v,g,.70,.125,0,.15,.25,5.98,0x222d32,.67);
 box(v,g,-.10,2.85,0,.86,.16,5.95,0x374b54,.48);
 box(v,g,.35,2.85,0,.07,.055,5.90,0x79c8d2,.24);
}
export function buildArea2Fixture(view,group,kind){
 const x=Math.round(group.position.x/2),z=Math.round(group.position.z/2);
 if(x<12||x>44||z<17||z>28)return false;
 if(kind==='shelf'){gondola(view,group,x*19+z);return true;}
 if(kind==='fridge'){coldCase(view,group,z);return true;}
 return false;
}
export function finishArea2(view){
 const world=view.world;
 // Ceiling-mounted fluorescent diffusers and aisle lighting; never free-floating.
 for(const [x,z] of [[24,22],[34,22],[24,26],[34,26]]){
  view.box(world,x*2,4.59,z*2,3.7,.095,.34,0x708387,.34);
  const led=view.box(world,x*2,4.52,z*2,3.42,.052,.23,0xe7f3ea,.12);
  led.material.emissive.setHex(0xdbe9df);led.material.emissiveIntensity=.55;
 }
 // Continuous cool-white header belongs to the refrigerator enclosure.
 view.box(world,14.3*2,2.98,22*2,.33,.12,17.4,0x354d52,.42);
 const led=view.box(world,14.53*2,2.95,22*2,.035,.06,17.1,0xc8eff2,.15);
 led.material.emissive.setHex(0x99dce8);led.material.emissiveIntensity=.48;
}
