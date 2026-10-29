// NIGHTSHIFT MARKET / AREA 4 — stockroom, office and staff restroom.
// Decorative meshes only: Level 1's existing grid, portals and objectives own collisions.
// Coordinates are in map tiles; all dimensions/heights below are in world metres.
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';

export function buildLevel1Zone4(view){
 const world=view.world, pieces=new Map();
 const C=2, toX=x=>x*C, toZ=z=>z*C;
 const put=(material,x,y,z,w,h,d,color,angle=0)=>{
  if(!pieces.has(material))pieces.set(material,[]);
  pieces.get(material).push({x:toX(x),y,z:toZ(z),w,h,d,color,angle});
 };
 const box=(x,y,z,w,h,d,color,angle=0)=>put('paint',x,y,z,w,h,d,color,angle);
 const steel=(x,y,z,w,h,d,color=0x617279,angle=0)=>put('steel',x,y,z,w,h,d,color,angle);
 const wood=(x,y,z,w,h,d,color=0x8c7356,angle=0)=>put('wood',x,y,z,w,h,d,color,angle);
 const porcelain=(x,y,z,w,h,d,color=0xf0f0e8,angle=0)=>put('ceramic',x,y,z,w,h,d,color,angle);
 const lightBox=(x,y,z,w,h,d,color)=>{
  const mesh=view.box(world,toX(x),y,toZ(z),w,h,d,color);
  mesh.material.emissive=new THREE.Color(color);
  mesh.material.emissiveIntensity=.76;
  return mesh;
 };
 const tube=(x,y,z,r,h,color,axis)=>{
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,12),
   new THREE.MeshStandardMaterial({color,roughness:.48,metalness:color===0xd6dde0?.7:.08}));
  mesh.position.set(toX(x),y,toZ(z));
  if(axis==='x')mesh.rotation.z=Math.PI/2;
  if(axis==='z')mesh.rotation.x=Math.PI/2;
  world.add(mesh);
  return mesh;
 };
 const shade=(x,z,w,d)=>{ // A slight dark material joint grounds equipment without opaque planes.
  box(x,.026,z,w,.035,d,0x454b48);
 };
 const container=(x,y,z,w,h,d,tint=0xad9472)=>{
  box(x,y,z,w,h,d,tint);
  box(x,y+h/2+.006,z,w*.90,.022,.07,0xd6c5a6);
  box(x,y,z+d/2+.012,w*.52,.13,.014,0xe0d3b4);
  box(x-w*.16,y,z+d/2+.018,.028,h*.48,.009,0x88735d);
 };
 const trolley=(x,z)=>{
  // Freight handtruck tucked to the rack rather than floating in the aisle.
  steel(x,.48,z,1.05,.07,.58,0x52636d);
  steel(x,.93,z-.23,.075,1.5,.07,0x8fa09d);
  steel(x,1.66,z-.23,1.05,.055,.08,0x8fa09d);
  for(const s of [-1,1])tube(x+s*.22,.18,z+.22,.18,.12,0x22292d,'x');
 };
 const rack=(x,z,width=2.8,depth=3.05,levels=4,seed=0)=>{
  shade(x,z,width+.28,depth+.26);
  for(const side of [-1,1])for(const end of [-1,1]){
   steel(x+side*(width-.12)/4,1.69,z+end*(depth-.12)/4,.075,3.34,.075,0x4d6970);
   box(x+side*(width-.12)/4,2.78,z+end*(depth-.12)/4,.084,.068,.086,0xdab56d);
  }
  for(let level=0;level<levels;level++){
   const yy=.24+level*.78;
   steel(x,yy,z,width,.075,depth,0x708087);
   steel(x,yy-.07,z+depth/4,width,.067,.10,0x505b60);
   for(let n=0;n<6;n++){
    const colors=[0xa89476,0xc2ab83,0x9a8b73,0x8eae9f,0xa5a8a1,0xb79b82];
    const xx=x+(n-2.5)*width/13,zz=z+((n+seed+level)%3-1)*depth/9;
    const h=.29+((n+level+seed)%3)*.105;
    if((n+level+seed)%5===0){
     steel(xx,yy+h/2+.04,zz,.34,h,.38,0x7b8f90);
     box(xx,yy+h/2+.04,zz+0.101,.22,.06,.017,0xd7c0a0);
    }else container(xx,yy+h/2+.035,zz,.31,h,.47,colors[(n+seed+level)%colors.length]);
   }
  }
  for(let level=0;level<2;level++)steel(x,.9+level*1.56,z-depth/4,width,.048,.08,0x354d57);
 };

 // STOCKROOM — cold grey wall protection, loading-rack uprights, pallets, boxes.
 // Keep the x=12 and x=24 side-door routes, and the southern opening at x=21..23.
 box(18.5,.12,7.77,23,.24,.12,0x5a6d72);
 for(const x of [13.1,24.0])box(x,1.02,9.05,.12,2.02,3.1,0x7b8986);
 for(const x of [14,17,20,23])steel(x,3.88,7.96,.075,.21,.24,0x95a7a6);
 rack(14.65,9.75,2.3,2.55,4,2);
 rack(18.1,9.72,2.55,3.02,4,1); // x=18,z=9-10 collidable slot
 rack(21.05,9.76,2.55,3.02,4,3); // x=21,z=9-10 collidable slot
 // Secondary low stacks, kept to the sides of the stock shipment at x17,z11.
 for(const [x,z] of [[13.9,13.36],[20.1,13.55]]){
  wood(x,.15,z,2.1,.24,1.48,0x795c40);
  for(const edge of [-1,0,1])wood(x+edge*.34,.05,z,0.16,.12,1.44,0x5d493b);
  for(let tier=0;tier<2;tier++)for(let col=0;col<3;col++){
   container(x+(col-1)*.34,.56+tier*.62,z,0.62,.56,.76,
     [0xa68d70,0xb4a180,0xc3ab91,0x9a8469][(col+tier+2)%4]);
  }
 }
 trolley(23.6,14.2);
 steel(13.2,1.8,15.13,.11,3.15,.12,0x849b9a); // southern wall safety upright
 box(18.2,3.69,14.85,9.4,.12,.22,0x798780);
 lightBox(18.3,4.48,10.6,6.6,.085,.55,0xbddfed);
 box(18.3,4.54,10.6,6.75,.08,.7,0x4a6b74);
 // Delivery ledger and hand scanner are mounted on the western wall, out of doors.
 steel(13.35,1.36,14.23,.55,.95,.14,0x516267);
 lightBox(13.37,1.47,14.30,.39,.31,.03,0x85c4ad);

 // OFFICE — warm wooden surfaces, filing drawers, desk computer and safe cabinet.
 wood(30.1,.083,8.08,16,.065,.08,0x886f53);
 for(const z of [9.2,10.8,14.6])wood(25.85,.44,z,.09,.83,2.1,0x8c775d);
 for(const x of [27.4,32.9]){
  shade(x,9.2,1.26,1.24);
  steel(x,1.15,9.2,1.12,2.26,1.14,0x737e83);
  for(let n=0;n<4;n++){
   steel(x,.37+n*.54,9.50,.94,.49,.036,0x969d9a);
   steel(x,.40+n*.54,9.52,.34,.045,.055,0x2f3a3f);
   box(x,.27+n*.54,9.524,.15,.036,.061,0xd9bd8f);
  }
 }
 // Manager's pinboard, framed on the back wall (no hovering room labels).
 wood(29.75,2.4,7.85,4.2,1.2,.09,0x9f7751);
 box(29.75,2.41,7.91,3.94,.95,.035,0xb6a689);
 for(const [x,y,w,h] of [[29.1,2.54,.56,.5],[30.05,2.27,.72,.43],[30.85,2.58,.46,.34]]){
  box(x,y,7.938,w,h,.009,0xe3d9be);
  box(x,y+h*.41,7.946,w*.76,.022,.009,0x817b6e);
 }
 // Locked safe housing adjacent to the real safe objective at x29,z12.
 shade(28.70,10.96,2.12,1.42);
 box(28.7,1.06,10.96,1.90,2.05,1.17,0x50636b);
 steel(28.7,1.10,11.28,1.67,1.72,.06,0x71838a);
 for(const x of [28.15,29.25]){
  steel(x,1.11,11.327,.09,1.45,.07,0x34424b);
 }
 tube(28.57,1.45,11.337,.18,.09,0xd9bf81,'z');
 tube(28.57,1.45,11.392,.08,.065,0x4f6467,'z');
 for(let row=0;row<3;row++)for(let col=0;col<2;col++)
  steel(29.00+col*.09,1.25-row*.105,11.34,.055,.048,.025,0xacb5ad);
 // Right-hand executive desk keeps CCTV objective at x33,z12 approachable.
 wood(31.95,.88,13.65,3.55,.16,1.42,0x9c7853);
 wood(30.69,.46,13.65,.13,.85,1.26,0x6c5846);
 wood(33.22,.46,13.65,.13,.85,1.26,0x6c5846);
 wood(31.95,.50,13.13,2.98,.06,.12,0x6a5848);
 steel(31.98,1.20,13.43,1.11,.70,.11,0x25343d);
 lightBox(31.98,1.20,13.50,.92,.53,.035,0x7eb8b3);
 steel(31.98,.96,13.45,.09,.17,.10,0x536066);
 steel(31.98,.87,13.25,.56,.04,.43,0x3e5155);
 steel(32.05,.984,14.07,1.15,.035,.35,0x313d42); // keyboard, facing south
 for(let col=0;col<5;col++)box(31.79+col*.12,.996,14.16,.068,.009,.055,0xaeb6af);
 box(33.10,.98,13.50,.48,.035,.37,0xddcba8);
 box(30.85,.94,13.28,.35,.08,.31,0x536a6b);
 // Manager chair tucked behind workstation; low enough not to block door.
 steel(31.96,.48,14.85,.68,.12,.62,0x252e33);
 steel(31.96,1.02,15.14,.71,.98,.16,0x38494c);
 for(const s of [-1,1])steel(31.96+s*.20,.12,14.85,.08,.21,.45,0x3b4449);
 tube(31.96,.34,14.85,.055,.5,0x546165);
 // Locked under-desk drawer, file boxes and a warm pool of task light.
 wood(33.01,.45,13.65,.68,.70,1.14,0x6f5947);
 for(const y of [.30,.57])steel(33.04,y,13.97,.37,.035,.025,0x9aabac);
 const deskLamp=tube(30.8,1.02,13.65,.085,.32,0xa9916e);
 steel(30.67,1.32,13.63,.49,.14,.40,0x9aabac);
 const warm=new THREE.PointLight(0xffd39b,.8,7.5,2);
 warm.position.set(toX(30.75),2.3,toZ(13.6));world.add(warm);
 lightBox(30.2,4.50,10.35,4.3,.08,.45,0xffdfb3);
 box(30.2,4.56,10.35,4.55,.065,.64,0x775d43);

 // STAFF RESTROOM — neutral washable tile, enclosed toilet cubicles, sinks and mirrors.
 // The public corridor enters at x39..40,z16. Leave the central approach wide.
 for(const z of [8.25,10,11.75,13.5])steel(36.35,.24,z,.055,.15,2.52,0xaebbc0);
 for(const x of [37.4,39.8,42.2,43.8])porcelain(x,.042,8.07,1.6,.026,.09,0xcbd5d2);
 // Two distinct toilet stalls on the north edge, with open door angles south.
 for(const [x] of [[38.22],[42.20]]){
  // Cubicle wall panels and base feet.
  const left=x-1.50,right=x+1.50,front=11.28,back=8.0;
  steel(left,1.48,(front+back)/2,.085,2.76,5.65,0x879a9c);
  steel(right,1.48,(front+back)/2,.085,2.76,5.65,0x879a9c);
  steel(x,2.76,front,2.94,.10,.065,0x44595e);
  steel(x-1.18,1.49,front,.53,2.66,.072,0x91a2a4);
  steel(x+1.18,1.49,front,.53,2.66,.072,0x91a2a4);
  steel(x-.58,1.43,front-.18,.065,2.58,.86,0x81959b,-.46); // open stall door
  steel(x-.15,1.48,front+.01,.055,.12,.09,0xcedbd7);
  porcelain(x,.49,9.32,.75,.67,.98,0xecefeb);
  porcelain(x,.92,8.88,.86,.72,.31,0xe1e8e6);
  const bowl=tube(x,.71,9.65,.42,.18,0xf1f3ed);
  tube(x,.82,9.65,.33,.054,0xd5dee0);
  steel(x,.95,8.63,.38,.08,.04,0xc6d3d1);
  steel(x+1.1,.70,9.65,.05,.07,.62,0x899da3);
 }
 // Sink basins with visible faucets and drains, mirrors mounted on the south wall.
 for(const x of [37.5,43.0]){
  porcelain(x,.93,13.92,1.56,.17,.99,0xf3f5ef);
  porcelain(x,.70,13.92,.71,.33,.52,0xd5e1e0);
  steel(x,.98,13.92,.69,.04,.63,0xb9c9cb);
  tube(x,1.14,13.70,.065,.30,0xc8d3d2);
  steel(x,1.28,13.84,.075,.035,.36,0xc2cece);
  steel(x,.985,14.12,.11,.012,.08,0x627c84);
  steel(x,2.23,15.05,1.94,1.48,.07,0x41545c);
  const mirror=view.box(world,toX(x),2.23,toZ(15.08),1.72,1.26,.031,
   new THREE.MeshBasicMaterial({color:0x94b5bc,transparent:true,opacity:.93}));
  // Soft linear reflection reads as a mirror even in night-time WebGL lighting.
  const glint=new THREE.Mesh(new THREE.PlaneGeometry(.22,1.0),
   new THREE.MeshBasicMaterial({color:0xe1f1ec,transparent:true,opacity:.17,depthWrite:false}));
  glint.position.set(toX(x)-.38,2.29,toZ(15.10));world.add(glint);
  steel(x,2.97,15.08,1.97,.065,.09,0xd3dcdb);
 }
 // Wall-mounted hand dryer, towel dispenser and subdued safety light.
 steel(36.8,1.57,12.2,.55,.64,.39,0xc4d0cc);
 steel(36.8,1.34,12.43,.30,.045,.055,0x667e81);
 steel(43.7,1.72,12.4,.59,.78,.27,0x94b5b5);
 porcelain(43.7,1.63,12.55,.32,.43,.04,0xdfe9e3);
 lightBox(40,4.50,12.18,5.1,.09,.66,0xd3eff0);
 box(40,4.57,12.18,5.3,.06,.82,0x6c8e91);
 const cool=new THREE.PointLight(0xb4dce2,1.20,12,2);
 cool.position.set(toX(40),3.25,toZ(12));world.add(cool);


 // AREA 4 FINISHING PASS — all fixtures remain inside the original three rooms.
 // Keep the tile-centre routes (17,11), (29,12), (33,12), and southern portals clear.
 // These many small fittings use the same four InstancedMesh material batches.

 // STOCKROOM: rack cross-bracing, shelf trays, freight labels and upright guards.
 for(const [x,z,w] of [[14.65,9.75,2.3],[18.1,9.72,2.55],[21.05,9.76,2.55]]){
  const near=z-1.23,far=z+1.23;
  for(const side of [-1,1]){
   const xx=x+side*w/4;
   for(let tier=0;tier<3;tier++){
    steel(xx,.66+tier*.80,near,.085,.08,.42,0xc6b069);
    steel(xx,.66+tier*.80,far,.085,.08,.42,0xc6b069);
   }
   // Floor-anchored bump guards; small enough not to narrow the central route.
   steel(xx,.35,near,.22,.62,.21,0xd6a84e);
   steel(xx,.35,far,.22,.62,.21,0xd6a84e);
  }
  for(const level of [1,2,3]){
   const yy=.24+level*.78;
   steel(x,yy+.025,near,w,.04,.075,0x3b4c52);
   box(x,yy+.055,near+.015,.48,.042,.014,0xece7d9);
   box(x,yy+.055,near+.026,.28,.012,.008,0x374247);
  }
  // Corrugated shipping cartons with visible tape and identification patches.
  for(let i=0;i<5;i++){
   const zz=z+(i-2)*.21,xx=x+((i%2)?-.23:.23);
   container(xx,3.40,zz,.28,.33,.30,[0x957b62,0xaf9474,0xb4ab92][i%3]);
   box(xx,3.46,zz+.165,.12,.06,.014,0xece6d6);
  }
 }
 // Safety markings are flat decals, not knee-height boxes or collision barriers.
 for(let i=0;i<8;i++){
  box(16.15+i*.24,.022,12.55,.19,.012,.22,i%2?0x323b3a:0xd5ae59,-.30);
  box(22.85,.022,8.2+i*.36,.14,.012,.25,i%2?0x383f3b:0xe1b75e,.31);
 }
 // Freight inventory across existing pallet cells, all visibly grounded.
 for(const [x,z,tint] of [[13.82,13.3,0x95866f],[20.1,13.55,0xb3a78f]]){
  for(let n=0;n<4;n++){
   const dx=(n-1.5)*.23;
   box(x+dx,1.36,z-.18,.40,.29,.54,tint);
   wood(x+dx,1.52,z-.18,.29,.023,.05,0xdac7a9);
   box(x+dx,1.38,z+.105,.19,.08,.014,0xdad4c3);
  }
  // Translucent stretch-wrap layers catch cool light but remain attached to stock.
  for(const s of [-1,1])steel(x+s*.55,.92,z,.02,1.58,1.35,0x94a5a3);
 }
 // Cleaning cart / shipping scanner at the west pallet bay, leaving the south door open.
 steel(16.2,.66,14.25,.96,.68,.73,0x53696b);
 steel(16.2,1.02,14.25,1.07,.095,.81,0x859592);
 for(const xx of [15.9,16.5])tube(xx,.21,14.54,.125,.13,0x242d31,'x');
 box(16.2,1.22,14.27,.58,.33,.25,0x324d52);
 lightBox(16.21,1.27,14.40,.36,.16,.028,0xa3bfad);
 box(16.22,1.02,14.59,.27,.045,.12,0xcbaf73);
 // Visible extraction fan, conduit and chilled stock shelving support.
 steel(19.0,4.13,8.05,3.0,.48,.28,0x44555b);
 for(let i=0;i<9;i++)steel(17.78+i*.29,4.14,8.22,.065,.26,.025,0x9bb0b0);
 for(const x of [14.2,20.9]){
  tube(x,4.02,8.24,.07,3.2,0x9aaca9,'z');
  steel(x,4.02,8.10,.17,.19,.31,0x34434b);
 }
 // Wall-mounted safety cabinet and extinguisher, placed outside the west door.
 steel(13.0,2.13,15.16,.61,.78,.16,0xd7ddd1);
 box(13.0,2.17,15.26,.22,.36,.025,0xbd6452);
 tube(13.62,.58,15.25,.15,.83,0xb73e32);
 steel(13.62,1.11,15.25,.38,.09,.18,0x26333a);
 tube(13.64,1.19,15.25,.035,.24,0x8b9391,'z');
 // Neutral emergency light and wall protection make the stock room read industrial.
 box(18.0,1.18,7.75,11.5,.10,.09,0xb2a66c);
 box(18.0,1.03,7.745,11.5,.09,.10,0x43535a);
 for(const x of [14.0,19.6,23.15])lightBox(x,3.9,8.11,.63,.10,.13,0xc7e4e4);

 // OFFICE: modular desk details, paper files and a visitor chair along the wall.
 // The center path to the safe (29,12) and CCTV (33,12) stays open.
 wood(27.3,.042,13.60,2.9,.06,1.96,0x6c5e52); // low-profile rug
 for(let stripe=0;stripe<7;stripe++)wood(26.72+stripe*.19,.075,13.59,.025,.005,1.82,0x8c7a69);
 // Visitor chair against the left perimeter; legs meet the floor.
 steel(26.68,.52,13.62,1.0,.13,.85,0x28353c);
 steel(26.45,1.04,13.92,1.08,1.02,.15,0x33474e);
 for(const x of [26.45,26.9]){
  steel(x,.26,13.36,.075,.46,.075,0x5e6b6f);
  steel(x,.26,13.87,.075,.46,.075,0x5e6b6f);
 }
 // Rear wall bookcases made from mounted wood panels (not huge opaque blocks).
 wood(34.15,2.37,8.35,1.28,1.58,.36,0x6f5540);
 for(const y of [1.72,2.24,2.76,3.14]){
  wood(34.15,y,8.44,1.16,.05,.31,0xb09a79);
  for(let n=0;n<5;n++){
   const tx=33.72+n*.20;
   box(tx,y+.19,8.45,.13,.33,.22,[0x445c60,0x84776c,0xa8977b,0x747f77,0x9d725d][(n+Math.floor(y*10))%5]);
   wood(tx,y+.16,8.58,.025,.20,.012,0xd1c4aa);
  }
 }
 // Wall clock with a real face, center hub and radial hands.
 tube(31.82,3.16,7.82,.35,.068,0x303d42,'z');
 tube(31.82,3.16,7.87,.295,.018,0xd3cbb7,'z');
 steel(31.82,3.23,7.89,.022,.20,.018,0x2c373d);
 steel(31.90,3.15,7.89,.22,.018,.018,0x2c373d);
 tube(31.82,3.16,7.91,.035,.022,0x8d795d,'z');
 // Printer on its own wall console and a network/receipt tray.
 wood(34.1,1.06,11.10,1.7,.14,.75,0x786247);
 steel(34.1,1.29,11.10,1.23,.38,.65,0x3b4951);
 steel(34.1,1.49,11.12,1.22,.07,.59,0x667980);
 porcelain(34.1,1.085,11.43,.77,.021,.32,0xe0d6c4);
 for(let n=0;n<4;n++)box(34.08,1.105+n*.012,11.51,.64,.010,.23,0xf6eee0);
 // Filing tray, pens and orderly paperwork on the main desk.
 steel(33.02,.985,14.1,.5,.06,.33,0x667a7a);
 for(let i=0;i<3;i++)porcelain(33.02,.995+i*.028,14.11,.43,.015,.24,0xdadac9);
 tube(30.97,1.055,14.08,.12,.21,0x566f70);
 for(const dx of [-.045,.03,.075])tube(30.97+dx,1.23,14.08,.013,.28,0xd3aa6f);
 for(let i=0;i<4;i++)box(31.40+i*.20,.972,14.26,.17,.014,.12,0xd9ccb2);
 // Electrical conduit and base skirting run continuously only along solid walls.
 wood(29.45,.13,7.78,16.0,.21,.075,0x725943);
 wood(34.45,.13,9.55,.075,.21,6.1,0x725943);
 wood(25.55,.13,9.00,.075,.21,4.35,0x725943);
 steel(34.28,2.83,12.15,.22,1.1,.12,0x7d8a8b);
 steel(34.28,2.24,12.16,.38,.32,.19,0x4a5b60);
 box(34.28,2.25,12.29,.23,.13,.026,0x8eafae);
 // Safe combination protection and desk lamp with physical glow in this one room.
 for(const [yy,ww] of [[2.20,1.90],[.16,1.96]]){
  steel(28.7,yy,10.96,ww,.09,1.23,0x243b43);
 }
 steel(30.70,1.32,13.64,.40,.12,.32,0xc9a478);
 lightBox(30.66,1.255,13.65,.29,.037,.20,0xffcf9b);

 // RESTROOM: smaller ceramic tile modules, accessible stalls and real plumbing.
 // Keep the southern 39..40 entrance corridor and both sink approaches free.
 for(const z of [8.2,9.6,11.0,12.4,13.8,15.2]){
  porcelain(36.45,.75,z,.045,1.5,2.65,0xb4c3c1);
  porcelain(43.48,.75,z,.045,1.5,2.65,0xb4c3c1);
 }
 // Grout grid is shallow, not duplicate full-size walls.
 for(let k=0;k<8;k++){
  const yy=.26+k*.23;
  // Two real wall segments; never draw grout across the x39..40 doorway.
  steel(37.4,yy,15.46,5.6,.016,.022,0xb7c9ca);
  steel(42.3,yy,15.46,5.5,.016,.022,0xb7c9ca);
 }
 for(const x of [36.6,38.1,41.1,42.6,43.6]){
  steel(x,.95,15.47,.018,1.42,.022,0xb2c3c1);
 }
 // Realistic toilet seat rims, bolted hinges, waste pipe and flush controls.
 for(const x of [38.22,42.20]){
  const seat=new THREE.Mesh(new THREE.TorusGeometry(.36,.047,8,20),
   new THREE.MeshStandardMaterial({color:0xe9ebe3,roughness:.42}));
  seat.rotation.x=Math.PI/2;seat.scale.y=.82;
  seat.position.set(toX(x),.858,toZ(9.61));world.add(seat);
  steel(x,.99,8.72,.43,.11,.16,0xb2bdba);
  steel(x+.20,1.03,8.59,.12,.065,.11,0xb7c3c4);
  tube(x,.28,8.7,.075,.45,0x7c9399,'z');
  // Surface-mounted toilet-roll holder on adjacent partition.
  steel(x+1.02,1.06,10.62,.48,.07,.13,0x788a8d);
  tube(x+1.02,1.06,10.67,.15,.22,0xe5e1d6,'x');
 }
 // Basin undersides, hot/cold taps, bottle soap and polished drain covers.
 for(const x of [37.5,43.0]){
  porcelain(x,.59,13.92,.52,.38,.38,0xcfdada);
  steel(x,.28,13.89,.15,.54,.14,0x96a8a9);
  tube(x,.97,14.10,.047,.035,0x5d7275);
  tube(x+.48,1.11,13.83,.065,.20,0x779aa0);
  box(x+.48,1.23,13.85,.20,.22,.16,0xe5d5b6);
  steel(x+.48,1.36,13.85,.09,.045,.09,0x3f5d64);
  steel(x,1.62,15.16,1.97,.06,.08,0xc0d3d1);
  for(let n=0;n<4;n++)steel(x-.48+n*.30,1.57,15.20,.06,.12,.025,0x9cb3b9);
 }
 // Floor drain, no tripping geometry.
 steel(40.2,.020,13.57,.42,.01,.42,0x788d91);
 for(const k of [-1,0,1])steel(40.2+k*.07,.028,13.57,.022,.009,.38,0x2b454a);
 // Individual stall feet and leg-clearance shadows.
 for(const [x] of [[38.22],[42.20]]){
  for(const sx of [-1.5,1.5]){
   steel(x+sx,.13,11.15,.18,.23,.16,0x566c6d);
   steel(x+sx,.11,8.25,.18,.20,.16,0x566c6d);
  }
 }
 // Medical first-aid / janitorial supply on east wall, never at a doorway.
 steel(43.36,2.4,13.25,.15,.88,.58,0xe5e8de);
 box(43.28,2.4,13.25,.035,.46,.16,0x6aa38a);
 box(43.28,2.4,13.25,.035,.12,.46,0x6aa38a);
 box(42.05,.50,14.7,1.08,.96,.48,0x6a7c7e);
 steel(42.05,1.03,14.7,1.12,.07,.51,0x9aada8);
 box(41.85,1.11,14.70,.25,.18,.20,0xe0cfc0);
 tube(42.2,1.17,14.70,.11,.25,0xb7d1c8);
 // Frosted maintenance grille gives back room a believable ventilated ceiling.
 steel(40.2,4.50,9.0,2.4,.08,1.35,0x7a9699);
 for(let i=0;i<8;i++)steel(39.70+i*.145,4.44,9.0,.035,.018,1.1,0x354c50);

 // Batch opaque details into four GPU instanced meshes, keeping the extra detail cheap.
 const geometry=new THREE.BoxGeometry(1,1,1);
 const baseMaterials={
  paint:new THREE.MeshStandardMaterial({color:0xffffff,roughness:.87,metalness:.02}),
  steel:new THREE.MeshStandardMaterial({color:0xffffff,roughness:.61,metalness:.24}),
  wood:new THREE.MeshStandardMaterial({color:0xffffff,roughness:.75,metalness:.03}),
  ceramic:new THREE.MeshStandardMaterial({color:0xffffff,roughness:.31,metalness:.06})
 };
 const matrix=new THREE.Matrix4(),q=new THREE.Quaternion(),color=new THREE.Color(),axis=new THREE.Vector3(0,1,0);
 for(const [name,items] of pieces){
  if(!items.length)continue;
  const mesh=new THREE.InstancedMesh(geometry,baseMaterials[name],items.length);
  for(let i=0;i<items.length;i++){
   const item=items[i];
   q.setFromAxisAngle(axis,item.angle);
   matrix.compose(new THREE.Vector3(item.x,item.y,item.z),q,new THREE.Vector3(item.w,item.h,item.d));
   mesh.setMatrixAt(i,matrix);mesh.setColorAt(i,color.setHex(item.color));
  }
  mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;
  mesh.frustumCulled=false;world.add(mesh);
 }
}
