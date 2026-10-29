import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';
import {CELL,WIDTH,HEIGHT,MISSIONS,WEAPONS} from './data.js?v=6';
import {LEVEL1_ZONES,LEVEL1_PROP_CELLS} from './level1.js?v=6';
import {buildCheckoutArea} from './level1-zone-3.js?v=1';
import {Visuals} from './visuals.js?v=6';
import {buildLevel1Zone4} from './level1-zone-4.js?v=1';
import {buildLevel1Zone1} from './level1-zone-1.js?v=1';
const palette={
 store:{floor:0x313536,wall:0x60686b,accent:0xffc774,light:0xffe3b4,sky:0x101719},
 office:{floor:0x303b44,wall:0x778998,accent:0x82d7fb,light:0xcce8ff,sky:0x101b2a},
 data:{floor:0x152932,wall:0x3e5362,accent:0x54f3cd,light:0x8adad9,sky:0x06171e},
 tower:{floor:0x333540,wall:0x6e7589,accent:0xff82a8,light:0xf4bce1,sky:0x171a2d},
 bank:{floor:0x363437,wall:0x88847b,accent:0xffd789,light:0xfbe7c3,sky:0x17151b}
};
const mat=(c,metalness=0,emissive=0)=>new THREE.MeshStandardMaterial({color:c,roughness:metalness?.45:.8,metalness,emissive,emissiveIntensity:.8});
export class View{
 constructor(container){
  this.el=container;this.scene=new THREE.Scene();this.scene.background=new THREE.Color(0x10171a);
  this.camera=new THREE.PerspectiveCamera(76,1,.07,140);
  this.camera.rotation.order='YXZ';
  this.renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
  this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.6));
  this.renderer.outputColorSpace=THREE.SRGBColorSpace;
  this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.35;
  this.renderer.shadowMap.enabled=false;
  container.prepend(this.renderer.domElement);this.canvas=this.renderer.domElement;
  this.world=new THREE.Group();this.scene.add(this.world);
  this.ambient=new THREE.HemisphereLight(0xdfebff,0x1d2633,1.8);this.scene.add(this.ambient);
  this.sun=new THREE.DirectionalLight(0xffffff,1.55);this.sun.position.set(7,16,18);this.scene.add(this.sun);
  this.visuals=new Visuals(this);
  this.mission=-1;this.currentRun='';this.enemies=new Map();this.allies=new Map();this.bags=new Map();this.objectives=new Map();this.pickups=new Map();this.lights=[];this.tracerMeshes=new Map();this.enemyRounds=new Map();this.clock=0;this.lastShots=0;this.cameraReady=false;this.hitFlash=0;
  this.makeGun();this.resize();
  this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(container);
 }
 resize(){const w=this.el.clientWidth||960,h=this.el.clientHeight||520;this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();}
 clear(){this.world.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material&&o.material.dispose&&!Array.isArray(o.material))o.material.dispose();});this.world.clear();this.enemies.clear();this.allies.clear();this.bags.clear();this.objectives.clear();this.rain=null;this.pickups.clear();this.tracerMeshes.clear();this.enemyRounds.clear();this.lights=[];this.visuals.clear();}
 box(parent,x,y,z,w,h,d,color,metal=0){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),typeof color==='number'?mat(color,metal):color);m.position.set(x,y,z);parent.add(m);return m;}
 cyl(parent,x,y,z,r,depth,color,segments=12){const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,depth,segments),mat(color,.25));m.position.set(x,y,z);parent.add(m);return m;}
 textTexture(text,fg='#e7f9ed',bg='#10181c',w=512,h=128){
  const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d');ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
  ctx.strokeStyle=fg;ctx.globalAlpha=.18;ctx.strokeRect(5,5,w-10,h-10);ctx.globalAlpha=1;
  ctx.fillStyle=fg;ctx.font='bold 45px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,256,64,490);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
 }
 sign(text,x,y,z,rot=0,color='#d7ffe4',size=3.6){
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(size,size*.25),new THREE.MeshBasicMaterial({map:this.textTexture(text,color),transparent:false,side:THREE.DoubleSide}));
  mesh.position.set(x,y,z);mesh.rotation.y=rot;this.world.add(mesh);return mesh;
 }
 build(run){
  const mission=MISSIONS[run.mission],p=palette[mission.theme];
  this.clear();this.mission=run.mission;this.currentRun=run.runId;this.cameraReady=false;this.scene.background=new THREE.Color(p.sky);this.scene.fog=new THREE.FogExp2(p.sky,.018);
  this.ambient.color.setHex(p.light);this.sun.color.setHex(p.light);
  this.canvas.style.background='#0b141a';this.visuals.setup(run,p);
  if(run.mission===0){this.buildCityBlock(run,p);return;}
  const world=this.world;
  const ground=this.box(world,(WIDTH-1)*CELL/2,-.17,(HEIGHT-1)*CELL/2,WIDTH*CELL,.3,HEIGHT*CELL,this.visuals.surface('tile',p.floor,WIDTH*CELL,HEIGHT*CELL));
  const tiles=mat(p.floor);const seam=mat(0x151d24);
  // Thin tile seams, safety-yellow aisle lines and architectural baseboards.
  for(let x=1;x<WIDTH-1;x++){this.box(world,x*CELL,-.008,(HEIGHT-1)*CELL/2,.024,.015,HEIGHT*CELL-.1,seam);}
  for(let z=1;z<HEIGHT-1;z++){this.box(world,(WIDTH-1)*CELL/2,-.006,z*CELL,WIDTH*CELL-.1,.015,.024,seam);}
  let wallCount=0;
  for(let z=0;z<HEIGHT;z++)for(let x=0;x<WIDTH;x++){
   if(run.grid[z][x]!=='#')continue;
   wallCount++;
   const outside=x===0||z===0||x===WIDTH-1||z===HEIGHT-1;
   const base=outside?p.wall:p.wall;
   this.box(world,x*CELL,1.65,z*CELL,CELL,3.3,CELL,this.visuals.surface('plaster',base,CELL,CELL));
   this.box(world,x*CELL,.13,z*CELL,CELL+.025,.26,CELL+.025,0x22282c,.2);
   this.box(world,x*CELL,3.24,z*CELL,CELL+.025,.13,CELL+.025,0x202a2b,.2);
   if((x+z)%3===0)this.box(world,x*CELL,2.65,z*CELL,CELL*.66,.045,CELL*.66,p.accent,.4);
  }
  // Emissive ceiling bars light rooms without relying on network texture assets.
  for(let x=3;x<WIDTH-2;x+=5)for(let z=3;z<HEIGHT-2;z+=5){
   if(run.grid[z][x]!=='#'){
    const bar=this.box(world,x*CELL,3.17,z*CELL,2.7,.08,.24,0xe8ffff,.35);
    bar.material.emissive=new THREE.Color(p.accent);bar.material.emissiveIntensity=1.5;
    if((x+z)%3===0){const l=new THREE.PointLight(p.accent,7,12,2);l.position.set(x*CELL,2.8,z*CELL);world.add(l);this.lights.push(l);}
   }
  }
  const floorStripe=this.box(world,4,.015,run.exit.z,5,.022,.18,p.accent);
  floorStripe.material.emissive=new THREE.Color(p.accent);floorStripe.material.emissiveIntensity=.6;
  mission.decor.forEach(([x,z,kind])=>this.prop(kind,x*CELL,z*CELL,p));
  this.sign(mission.site,(WIDTH-1)*CELL/2,2.6,1.06,0,'#ffffff',6);
  this.sign('EXIT',(WIDTH-2)*CELL,2.2,run.exit.z,Math.PI/2,'#93ffb3',2.2);
  // Extraction pad and pulsating column.
  const ring=new THREE.Mesh(new THREE.TorusGeometry(2.65,.1,8,48),new THREE.MeshBasicMaterial({color:0x67f6bb}));ring.rotation.x=Math.PI/2;ring.position.set(run.exit.x,.12,run.exit.z);world.add(ring);this.exitRing=ring;
  const beacon=new THREE.Mesh(new THREE.CylinderGeometry(1.8,1.8,3.3,24,1,true),new THREE.MeshBasicMaterial({color:0x4affbb,transparent:true,opacity:.06,side:THREE.DoubleSide,depthWrite:false}));beacon.position.set(run.exit.x,1.7,run.exit.z);world.add(beacon);this.exitBeacon=beacon;
  for(const obj of run.objectives){const g=this.objectiveMesh(obj,p);world.add(g);this.objectives.set(obj.id,g);}
  this.visuals.decorate(run,p);
 }
 buildCityBlock(run,p){
  const mission=MISSIONS[0],world=this.world,cols=run.grid[0].length,rows=run.grid.length;
  const w=(cols-1)*CELL,h=(rows-1)*CELL;
  this.scene.background=new THREE.Color(0x0a1219);
  this.scene.fog=new THREE.FogExp2(0x0a1219,.008);
  this.ambient.intensity=.94;this.sun.intensity=.55;
  this.box(world,w/2,-.32,h/2,cols*CELL,.65,rows*CELL,this.visuals.surface('asphalt',0x29343c,cols*CELL,rows*CELL));
  for(const zone of LEVEL1_ZONES){
   this.box(world,(zone.x+zone.w/2)*CELL,-.03,(zone.z+zone.h/2)*CELL,zone.w*CELL,.085,zone.h*CELL,this.visuals.surface(zone.name==='SHOP FLOOR'||zone.name==='RESTROOM'?'market-tile':zone.name==='BACK OFFICE'?'wood':zone.name==='STOCKROOM'?'concrete':'asphalt',zone.name==='SHOP FLOOR'?0xe7dfcf:zone.floor,zone.w*CELL,zone.h*CELL));
  }
  // Zone 1 owns parking and sidewalk; preserve Area 5 delivery and alley markings.
  for(const z of [14,19,24,29])this.box(world,8*CELL,.061,z*CELL,8,.02,.16,0xd9b165);
  this.box(world,46*CELL,.04,22*CELL,3,.09,34,0x8a8d86,.1);
  for(const z of [9,17,25,33])this.box(world,46*CELL,.092,z*CELL,2.8,.014,.06,0x525a60);

  // Thousands of metres of wall are batched into a handful of GPU instanced meshes.
  // The previous per-segment BoxGeometry/Material approach stalled software WebGL.
  const batches=new Map();
  const batch=(color,x,y,z,sx,sy,sz)=>{
   const key=String(color);if(!batches.has(key))batches.set(key,[]);
   batches.get(key).push([x,y,z,sx,sy,sz]);
  };
  // Decorative shelf / fixture collisions must not render as full-height masonry.
  // Window collision remains solid, but the corresponding façade is transparent.
  const isWindow=(x,z)=>z===33&&((x>=14&&x<=24)||(x>=34&&x<=43));
  const visibleWall=(x,z)=>x>0&&z>0&&x<cols-1&&z<rows-1&&run.grid[z][x]==='#'&&!LEVEL1_PROP_CELLS.has(x+','+z)&&!isWindow(x,z);
  for(let z=0;z<rows;z++){
   let x=0;
   while(x<cols){
    if(!visibleWall(x,z)){x++;continue;}
    let end=x+1;while(end<cols&&visibleWall(end,z))end++;
    const mx=(x+end-1)*CELL/2,mz=z*CELL,len=(end-x)*CELL;
    const indoors=x>=12&&x<=44&&z>=7&&z<=33;
    const color=indoors?(z===33?0x857469:0xd6d0c4):0x454f55;
    batch(color,mx,2.28,mz,len,4.56,CELL);
    batch(indoors?0x655f56:0x263038,mx,.23,mz,len+.03,.46,CELL+.03);
    batch(indoors?0xe4ded1:0x647177,mx,4.51,mz,len+.03,.17,CELL+.03);
    x=end;
   }
  }
  const matrix=new THREE.Matrix4();
  for(const [color,instances] of batches){
   const mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),this.visuals.surface(Number(color)===0xd6d0c4?'market-wall':'brick',Number(color),6,5),instances.length);
   for(let i=0;i<instances.length;i++){
    const [x,y,z,sx,sy,sz]=instances[i];
    matrix.compose(new THREE.Vector3(x,y,z),new THREE.Quaternion(),new THREE.Vector3(sx,sy,sz));
    mesh.setMatrixAt(i,matrix);
   }
   mesh.instanceMatrix.needsUpdate=true;mesh.frustumCulled=false;world.add(mesh);
  }
  // Acoustic commercial ceiling hides the sky above the store and rear rooms.
  for(const zone of LEVEL1_ZONES.filter(z=>['SHOP FLOOR','STOCKROOM','BACK OFFICE','RESTROOM'].includes(z.name))){
   const ceiling=this.visuals.surface('market-ceiling',0xf3f0e7,zone.w*CELL,zone.h*CELL);
   ceiling.emissive.setHex(0x98988d);ceiling.emissiveIntensity=.25;
   this.box(world,(zone.x+zone.w/2)*CELL,4.78,(zone.z+zone.h/2)*CELL,zone.w*CELL,.24,zone.h*CELL,ceiling);
  }
  for(const x of [13,20,27,34,41])this.box(world,x*CELL,4.62,25*CELL,.055,.055,17*CELL,0x9ba3a2,.31);
  for(const z of [17,23,29])this.box(world,28*CELL,4.62,z*CELL,33*CELL,.055,.065,0x9ba3a2,.31);
  // The facade, approach and parking belong exclusively to Level 1 Area 1.
  buildLevel1Zone1(this,world,CELL);
  for(const x of [26,30]){this.box(world,x*CELL,1.18,30*CELL,.85,.36,.55,0x303a40,.65);this.box(world,x*CELL,1.36,29.8*CELL,.77,.22,.16,0x9bd3ae,.28);}
  for(const x of [38,42]){this.box(world,x*CELL,.35,9*CELL,.7,.5,.85,0xdbe6dc);this.box(world,x*CELL,.73,9.4*CELL,.44,.2,.27,0xeef1eb);}

  // Batch repeated opaque market details across ALL fixtures into shared GPU instances.
  this.marketBatches=new Map();
  for(const [x,z,kind] of mission.decor){
   if(kind==='counter'&&z>=28&&z<=34)continue; // Zone 3 owns checkout fixtures.
   if(x>=12&&x<45&&z>=7&&z<17)continue; // Zone 4 builds its back rooms separately.
   if(z===40&&(kind==='car'||kind==='van')&&[15,34,45].includes(x))continue; // Zone 1 vehicles.
   if(kind==='streetlamp'&&x===44&&z===38)continue; // Zone 1 lamp.
   this.prop(kind,x*CELL,z*CELL,p);
  }
  this.finishMarketBatches();
  buildCheckoutArea(this);
  buildLevel1Zone4(this);
  // Only the one fascia wordmark from Area 1 is visible; no floating signs.

  // Keep the existing street lights lightweight; the visuals layer adds limited nearby accent/alarm lights.
  for(const [x,z,color] of [[28,23,0xffedce],[28,35,0xffd199]]){
   const lamp=new THREE.PointLight(color,4.1,24,2);
   lamp.position.set(x*CELL,3.85,z*CELL);world.add(lamp);this.lights.push(lamp);
  }
  for(const [x,z,w] of [[19,20,4.2],[29,20,4.2],[39,20,4.2],[19,27,4.2],[29,27,4.2],[39,27,4.2],[29,11,3.2],[18,11,3.2]]){
   const panel=this.box(world,x*CELL,4.5,z*CELL,w,.13,.65,0xfff0d6,.16);
   panel.material.emissive=new THREE.Color(0xffe9c6);panel.material.emissiveIntensity=1.35;
  }

  // Billboard signs and alarms.
  for(const at of [[37,18],[31,13]]){
   this.box(world,at[0]*CELL,3.7,at[1]*CELL,.45,.2,.7,0x233138,.6);
   this.box(world,at[0]*CELL,3.7,(at[1]-.2)*CELL,.17,.1,.1,0xe16d5e,.8);
  }

  // Guide lights along the route towards the getaway.
  for(let x=19;x<=28;x+=4)this.box(world,x*CELL,.055,36*CELL,.42,.026,1.65,0xaec28e,.25);

  const ring=new THREE.Mesh(new THREE.TorusGeometry(3.2,.12,8,48),new THREE.MeshBasicMaterial({color:0x314c49}));
  ring.rotation.x=Math.PI/2;ring.position.set(run.exit.x,.1,run.exit.z);world.add(ring);this.exitRing=ring;
  const beacon=new THREE.Mesh(new THREE.CylinderGeometry(2.4,2.4,4,20,1,true),new THREE.MeshBasicMaterial({color:0x80ffb5,transparent:true,opacity:.08,side:THREE.DoubleSide,depthWrite:false}));
  beacon.position.set(run.exit.x,2.05,run.exit.z);world.add(beacon);this.exitBeacon=beacon;
  for(const obj of run.objectives){
   if(obj.synthetic)continue;
   const g=this.objectiveMesh(obj,p);world.add(g);this.objectives.set(obj.id,g);
  }
  // Subtle night rain, a cheap animated particle system.
  const count=350,pts=new Float32Array(count*3),random=new Float32Array(count);
  for(let i=0;i<count;i++){
   pts[i*3]=Math.random()*w;pts[i*3+1]=Math.random()*12;pts[i*3+2]=Math.random()*h;
   random[i]=9+Math.random()*7;
  }
  const geom=new THREE.BufferGeometry();geom.setAttribute('position',new THREE.BufferAttribute(pts,3));
  this.rain={mesh:new THREE.Points(geom,new THREE.PointsMaterial({color:0x9fbfd8,size:.045,transparent:true,opacity:.42,depthWrite:false})),speed:random};
  world.add(this.rain.mesh);
  this.visuals.decorate(run,p);
 }
 prop(kind,x,z,p){
  const g=new THREE.Group();g.position.set(x,0,z);this.world.add(g);
  if(this.mission===0&&['shelf','fridge','counter','desk','filing','crate','pallet'].includes(kind)){
   this.marketProp(g,kind);return;
  }
  if(kind==='car'||kind==='van'){
   const van=kind==='van',body=van?0x819ca0:0x51667e;
   this.box(g,0,.75,0,van?3.4:2.7,van?1.5:.85,van?6.2:4.5,body,.7);
   this.box(g,0,van?1.82:1.36,-.2,van?3.1:2.3,van?1.35:.68,van?3.1:2.4,0x34434f,.65);
   this.box(g,0,van?1.75:1.49,-1.48,van?2.7:2.1,.72,.06,0x83b8c7,.7);
   for(const xx of [-1.5,1.5])for(const zz of [-1.8,1.8]){const wheel=this.cyl(g,xx,.45,zz,.48,.24,0x121920,14);wheel.rotation.z=Math.PI/2;}
   for(const xx of [-1,1])this.box(g,xx,.8,-(van?3.15:2.3),.47,.21,.09,0xfff4cc,.4);
   if(van&&this.mission!==0){this.sign('GETAWAY',x,2.8,z+3.25,Math.PI,'#b7ffe3',3);}
  }else if(kind==='streetlamp'){
   this.cyl(g,0,2.65,0,.11,5.3,0x59656d,10);
   this.box(g,0,5.25,.5,.18,.16,1.3,0x6f8490,.6);
   const glow=this.box(g,0,5.08,1.07,.7,.12,.45,0xffd29a,.2);glow.material.emissive=new THREE.Color(0xffb775);glow.material.emissiveIntensity=2;
  }else if(kind==='tree'){
   this.cyl(g,0,1.7,0,.29,3.4,0x65564a,9);
   for(const [xx,yy,zz,rr] of [[0,4,0,1.6],[-.9,3.5,0,1.25],[.8,3.8,.5,1.2]])
   {const top=new THREE.Mesh(new THREE.DodecahedronGeometry(rr,0),mat(0x284d43));top.position.set(xx,yy,zz);g.add(top);}
  }else if(kind==='container'){
   this.box(g,0,1.5,0,3,3,5.6,0x416374,.6);
   for(let i=-2;i<=2;i++)this.box(g,-1.52,1.5,i*.98,.045,2.65,.05,0x81a0af,.55);
   this.box(g,0,2.75,0,3.1,.16,5.8,0x283c46,.6);
  }else if(kind==='dumpster'){
   this.box(g,0,.93,0,2,1.7,1.55,0x365b53,.55);
   this.box(g,0,1.82,-.06,2.16,.14,1.7,0x192e34,.7);
  }else if(kind==='pallet'){
   this.box(g,0,.15,0,2.4,.28,1.85,0x897052);
   for(let j=0;j<3;j++)this.box(g,0,.5+j*.62,0,2,.95,1.8,j%2?0x60695e:0x8d846a,.1);
  }else if(kind==='generator'){
   this.box(g,0,.9,0,2.2,1.65,1.55,0xb99b58,.6);
   for(let i=0;i<5;i++)this.box(g,-.8+i*.4,.92,.81,.14,1.1,.1,0x25343a,.6);
  }else if(kind==='barrier'){
   this.box(g,0,.55,0,2.9,1,.55,0x9ba7a8,.4);
   for(let xx=-.8;xx<=.8;xx+=.8)this.box(g,xx,.65,-.3,.48,.3,.045,0xf2a24c,.4);
  }else if(kind==='filing'){
   this.box(g,0,1.1,0,.95,2.2,1.1,0x73818c,.7);
   for(let y=.48;y<2.1;y+=.58)this.box(g,0,y,.56,.55,.045,.035,0x15252b,.7);
  }else if(kind==='safe'){
   this.box(g,0,1.3,0,1.6,2.3,1.3,0x9aa7a8,.85);
   const dial=this.cyl(g,0,1.5,.7,.34,.12,0xe2c88c,14);dial.rotation.x=Math.PI/2;
  }else if(kind==='shelf'){
   for(let j=0;j<3;j++){this.box(g,0,.5+j*.54,0,2.5,.15,1.1,0x706857,.25);for(let i=0;i<5;i++){this.box(g,-.95+i*.46,.72+j*.54,rnd(i+j)*.2,.27,.32,.42,[0xe5b77e,0xc6d88b,0x90b7c2,0xd89e9f][(i+j)%4]);}}
   this.box(g,-1.2,.9,0,.1,2,.9,0x383c3d,.4);this.box(g,1.2,.9,0,.1,2,.9,0x383c3d,.4);
  } else if(kind==='counter'||kind==='desk'){
   this.box(g,0,.86,0,2.7,.18,1.3,kind==='counter'?0xb7a27a:0x7c8b94,.2);
   this.box(g,-1.05,.42,0,.16,.8,1.1,0x414c52,.4);this.box(g,1.05,.42,0,.16,.8,1.1,0x414c52,.4);
   if(kind==='desk'){this.box(g,0,1.23,-.25,.95,.7,.08,0x111b24,.5);this.box(g,0,1.23,-.203,.84,.57,.01,0x3de0d5);this.box(g,0,1,-.25,.1,.2,.1,0x151f26);}
  }else if(kind==='server'){
   for(let i=0;i<2;i++){this.box(g,-.6+i*1.2,1.35,0,1.05,2.7,1.5,0x1b2934,.6);for(let j=0;j<7;j++){this.box(g,-.6+i*1.2,.25+j*.34,.773,.72,.09,.04,j%3?0x60c0c6:0x94f9a2,.3);}}
  }else if(kind==='fridge'){
   this.box(g,0,1.2,0,1.35,2.4,1.1,0x9fb2ba,.65);this.box(g,0,1.25,.58,1.12,2.02,.07,0x0e2939,.6);
   for(let i=0;i<5;i++)this.box(g,0,.34+i*.42,.64,.9,.04,.05,i%2?0x5fd6fa:0xa6f7ce);
  }else if(kind==='plant'){
   this.cyl(g,0,.35,0,.45,.7,0x8b867f);
   for(let i=0;i<7;i++){let leaf=this.cyl(g,Math.sin(i*2.5)*.24,1+Math.sin(i)*.4,Math.cos(i*2.5)*.24,.20,.9,0x47765b,6);leaf.rotation.z=i*.32;}
  }else if(kind==='sofa'){
   this.box(g,0,.5,0,2.8,.8,1,0x525d72);this.box(g,0,.87,-.4,2.8,.85,.28,0x67748b);
  }else if(kind==='crate'){
   this.box(g,0,.7,0,1.4,1.4,1.4,0x796751);this.box(g,0,1.42,0,1.5,.08,1.5,0xb8a17e);
  }else if(kind==='column'){
   this.cyl(g,0,1.65,0,.8,3.3,0xa8a59d,10);this.cyl(g,0,.14,0,1,.28,0xddd1b4,10);
  }else if(kind==='vault'){
   this.box(g,0,1.5,0,2.8,3,.65,0x909ba0,.95);this.cyl(g,0,1.5,.38,.78,.2,0x4a565e,12).rotation.x=Math.PI/2;this.cyl(g,0,1.5,.54,.25,.21,0xd1b97b,12).rotation.x=Math.PI/2;
  }else if(kind==='gold'){
   this.box(g,0,.55,0,2,.95,1.45,0x65523a,.4);
   for(let i=0;i<5;i++)for(let j=0;j<2;j++)this.box(g,-.75+i*.36,1.1,j*.35-.2,.32,.18,.32,0xffc95b,.9);
  }
  this.visuals.detailProp(g,kind);
 }
 marketInstance(group,shape,x,y,z,w,h,d,color,metal=0){
  const key=shape+':'+metal;
  if(!this.marketBatches.has(key))this.marketBatches.set(key,[]);
  this.marketBatches.get(key).push({x:group.position.x+x,y:group.position.y+y,z:group.position.z+z,w,h,d,color});
 }
 marketBox(group,x,y,z,w,h,d,color,metal=0){
  this.marketInstance(group,'box',x,y,z,w,h,d,color,metal);
 }
 marketCylinder(group,x,y,z,r,height,color){
  this.marketInstance(group,'cylinder',x,y,z,r*2,height,r*2,color,.25);
 }
 finishMarketBatches(){
  const matrix=new THREE.Matrix4(),color=new THREE.Color();
  for(const [key,items] of this.marketBatches){
   const [shape,metal]=key.split(':');
   const geometry=shape==='cylinder'?new THREE.CylinderGeometry(.5,.5,1,9):new THREE.BoxGeometry(1,1,1);
   const mesh=new THREE.InstancedMesh(geometry,mat(0xffffff,Number(metal)),items.length);
   for(let i=0;i<items.length;i++){
    const item=items[i];
    matrix.makeScale(item.w,item.h,item.d);
    matrix.setPosition(item.x,item.y,item.z);
    mesh.setMatrixAt(i,matrix);
    mesh.setColorAt(i,color.setHex(item.color));
   }
   mesh.instanceMatrix.needsUpdate=true;
   mesh.instanceColor.needsUpdate=true;
   // Instances are distributed across the market; one shared bounding sphere is too coarse.
   mesh.frustumCulled=false;
   this.world.add(mesh);
  }
  this.marketBatches=null;
 }
 marketProp(g,kind){
  // Distinct real-looking store fixtures; the collision grid is handled in level1.js.
  const shell=0x3b4346,metal=0x637077,light=0xd4d6c9,wood=0x846b52;
  if(kind==='shelf'){
   // Freestanding gondola shelves with metal uprights, stocked products and price rails.
   for(const x of [-1.23,1.23])this.marketBox(g,x,1.03,0,.075,2.04,.94,shell,.55);
   for(const y of [.29,.81,1.34,1.87]){
    this.marketBox(g,0,y,0,2.55,.095,1.03,metal,.55);
    this.marketBox(g,0,y-.075,-.52,2.4,.048,.055,0xe7d0a3,.25);
    this.marketBox(g,0,y-.075,.52,2.4,.048,.055,0xe7d0a3,.25);
   }
   this.marketBox(g,0,2.13,0,2.6,.09,1.08,shell,.56);
   const palette=[0xba6a4c,0xe0c66f,0x7196a3,0x8da179,0xd69b72,0x9680a2,0x5c867e,0xc4b39a];
   for(let tier=0;tier<4;tier++)for(let side=0;side<2;side++)for(let ix=0;ix<7;ix++){
    const xx=-1.02+ix*.34,yy=.39+tier*.525,zz=side?-.22:.22;
    this.marketBox(g,xx,yy,zz,.27*(.88+(ix%3)*.07),.33*(.89+(tier%2)*.12),.34*.94,palette[(ix+tier*2+side*3)%palette.length]);
    this.marketBox(g,xx,yy,zz+(side?-.18:.18),.25*.86,.08*.7,.014,0xe9dfce);
   }
  }else if(kind==='fridge'){
   // Glass-front beverage cabinet with lit interior and distinguishable cans.
   this.marketBox(g,0,1.35,0,1.62,2.69,1.15,shell,.7);
   this.marketBox(g,0,1.32,.60,1.4,2.35,.075,0x17333c,.6);
   this.marketBox(g,0,2.61,.6,1.48,.13,.15,0x89e6f5,.4);
   for(const y of [.45,.88,1.3,1.73,2.16]){
    this.marketBox(g,0,y,.43,1.43,.055,.75,light,.3);
    for(let k=0;k<5;k++){
     this.marketCylinder(g,-.52+k*.26,y+.16,.27,.1,.31,[0xab3832,0xbfa24e,0x4c9bbb,0x589b73,0xbe8a75][(k+Math.floor(y*5))%5]);
     this.marketBox(g,-.52+k*.26,y+.31,.28,.18,.02,.16,0xe8e4d5);
    }
   }
   const glass=this.box(g,0,1.34,.655,1.36,2.31,.03,new THREE.MeshPhysicalMaterial({color:0xc1e6ee,roughness:.14,metalness:.07,transparent:true,opacity:.19,depthWrite:false}));
   this.marketBox(g,-.71,1.32,.68,.06,2.39,.08,0xa7bdc3,.5);this.marketBox(g,.71,1.32,.68,.06,2.39,.08,0xa7bdc3,.5);
   this.marketBox(g,.03,1.4,.71,.042,.65,.06,0xc7d3d5,.4);
  }else if(kind==='counter'){
   this.marketBox(g,0,.54,0,2.78,1.09,1.25,0x64594f,.24);
   this.marketBox(g,0,1.10,0,2.93,.16,1.4,0xb8ae99,.24);
   this.marketBox(g,0,.48,.66,2.56,.46,.05,0x3c4e55,.33);
   for(const x of [-.82,0,.82])this.marketBox(g,x,.48,.69,.45,.26,.025,0x8b9695,.42);
   const gx=g.position.x/CELL;
   if(gx>26&&gx<32){
    this.marketBox(g,0,1.36,-.15,.74,.43,.56,0x25353d,.5);
    const panel=this.box(g,0,1.39,.15,.58,.21,.035,0x89b9ac,.1);
    panel.material.emissive.setHex(0x51796f);panel.material.emissiveIntensity=.28;
    this.marketBox(g,.82,1.24,.22,.32,.09,.46,0x313d40,.4);
   }else{for(let x=-1.0;x<=1.01;x+=.48)this.marketBox(g,x,1.24,-.15,.34,.1,.42,0x8e9773);}
  }else if(kind==='desk'){
   this.marketBox(g,0,.86,0,2.5,.16,1.3,wood,.19);
   for(const x of [-1.1,1.1])this.marketBox(g,x,.44,0,.12,.87,1.12,shell,.4);
   this.marketBox(g,0,1.22,-.24,1.05,.69,.08,0x212a2f,.5);
   this.marketBox(g,0,1.22,-.19,.92,.55,.025,0x59979c);
   this.marketBox(g,0,1.01,.18,1.0,.035,.34,0x485359);
   this.marketBox(g,.92,1.0,.25,.31,.03,.27,0xd4c7ad);
  }else if(kind==='filing'){
   this.marketBox(g,0,1.14,0,1.0,2.25,1.05,0x899394,.58);
   for(const y of [.42,.97,1.52,2.06]){
    this.marketBox(g,0,y,.54,.81,.47,.028,0x9ca5a5,.48);
    this.marketBox(g,0,y,.58,.32,.055,.035,0x3f4a4c,.62);
   }
  }else if(kind==='crate'||kind==='pallet'){
   const stack=kind==='pallet';
   this.marketBox(g,0,.18,0,stack?2.4:1.42,.22,stack?1.85:1.42,wood,.12);
   const colors=[0xa99070,0xc0aa8e,0x947c5f];
   for(let y=0;y<(stack?2:1);y++)for(let x=-1;x<=1;x++){
    const xx=x*(stack?.67:.34),yy=.48+y*.67;
    this.marketBox(g,xx,yy,0,stack?.58:.38,.57,stack?1.46:.95,colors[(x+3+y)%3],.05);
    this.marketBox(g,xx,yy,.74*(stack?1:.7),stack?.26:.19,.13,.025,0xd4c7b4);
   }
  }
 }
 objectiveMesh(o,p){
  const g=new THREE.Group();g.userData.kind=o.kind;
  g.position.set(o.x,0,o.z);
  // Market checkout objects are built in zone 3; the ground marker remains reachable.
  const marketCash=this.mission===0&&o.kind==='cash';
  if(!marketCash)this.box(g,0,.28,0,1.1,.55,.95,0x1a2930,.6);
  if(o.kind==='hack'||o.kind==='drill'||o.kind==='radio'||o.kind==='recon'){
   this.box(g,0,1,0,.96,1.05,.34,0x1e333d,.55);
   const screen=this.box(g,0,1.07,.195,.72,.68,.025,0x4fffdc);
   screen.material.emissive=new THREE.Color(p.accent);screen.material.emissiveIntensity=2;
  }else if(o.kind==='gold'){for(let i=0;i<3;i++)this.box(g,(i-1)*.3,.7,0,.28,.2,.46,0xf0c765,.8);}
  else if(o.kind==='keycard'||o.kind==='data'){this.box(g,0,.82,0,.5,.14,.72,o.kind==='data'?0x5beedc:0x8dd5fa,.4);}
  else if(o.kind==='safe'){this.box(g,0,.8,0,1,1,.8,0xadb6b6,.85);this.cyl(g,0,.85,.42,.18,.12,0x384a52).rotation.x=Math.PI/2;}
  else if(!marketCash)this.box(g,0,.65,0,.75,.48,.53,0xd7b47c,.3);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.94,.045,8,40),new THREE.MeshBasicMaterial({color:p.accent}));ring.rotation.x=Math.PI/2;ring.position.y=.1;g.add(ring);g.userData.ring=ring;
  const beam=new THREE.Mesh(new THREE.CylinderGeometry(.18,.18,2.7,12,1,true),new THREE.MeshBasicMaterial({color:p.accent,transparent:true,opacity:.14,depthWrite:false,side:THREE.DoubleSide}));beam.position.y=1.45;g.add(beam);g.userData.beam=beam;
  return g;
 }
 enemyMesh(e){
  const g=new THREE.Group();const kind=e.type;
  const tint={guard:0xd17e6b,rusher:0xeab660,sniper:0xa98de2,heavy:0xb95e64,drone:0x71c8eb}[kind];
  if(kind==='drone'){
   this.box(g,0,2.05,0,.92,.36,.9,0x344959,.7);
   for(const sx of [-.7,.7])for(const sz of [-.65,.65]){
    this.box(g,sx,2.13,sz,.55,.11,.1,0x647887,.7);this.cyl(g,sx,2.2,sz,.3,.03,0x86eef8); 
   }
   this.box(g,0,1.98,-.49,.45,.15,.14,0x7cfff0,.6);
  }else{
   const scale=kind==='heavy'?1.22:kind==='rusher'?.9:1;g.scale.setScalar(scale);
   this.box(g,0,1.07,0,.74,1,.42,kind==='heavy'?0x5e4549:0x333f4b,.2);
   this.box(g,0,1.11,-.24,.58,.68,.15,tint,.3);
   this.cyl(g,0,1.85,0,.28,.43,0xcda991);
   this.box(g,0,2.05,0,.55,.23,.53,0x293840,.6);
   this.box(g,0,1.86,-.23,.53,.12,.14,kind==='sniper'?0x9e9fff:0x2b3034,.6);
   for(const s of [-1,1]){this.box(g,s*.22,.42,0,.27,.84,.35,0x222c32);this.box(g,s*.49,1.14,0,.21,.66,.34,tint);}
   // Weapons are assembled on the animated rig below (no duplicate fixed rifle).
  }
  const hpBack=this.box(g,0,kind==='drone'?2.65:2.49,0,1,.09,.05,0x17202a);
  const hpFill=this.box(g,-.49,kind==='drone'?2.65:2.49,.035,.98,.08,.045,0x8affbd);
  g.userData.hpFill=hpFill;g.userData.hpBack=hpBack;
  this.visuals.detailEnemy(g,e);
  // The same weapon rigs are shared with /game2/enemies.
  const rig=new THREE.Group();g.add(rig);
  const drone=kind==='drone',rusher=kind==='rusher',heavy=kind==='heavy',sniper=kind==='sniper';
  rig.position.set(drone?0:rusher?.43:.17,drone?1.99:rusher?1.60:1.30,drone?-.44:rusher?-.24:-.37);
  if(rusher){
   // The rusher is a MELEE attacker. Pivot the entire forearm and blade from
   // shoulder height so the wind-up and slash are readable from a distance.
   this.box(rig,0,-.21,-.08,.25,.47,.28,0x445057,.20);
   this.box(rig,0,-.46,-.21,.22,.23,.26,0x29373c,.12);
   this.box(rig,0,-.46,-.49,.14,.12,.47,0x30383b,.50);
   const blade=this.box(rig,0,-.46,-.93,.10,.075,.69,0xb2c4cc,.38);
   blade.material.roughness=.53;
   this.box(rig,0,-.46,-.64,.29,.09,.07,0x57696d,.25);
   const arc=new THREE.Mesh(
    new THREE.TorusGeometry(.65,.025,5,32,Math.PI*.92),
    new THREE.MeshBasicMaterial({color:0xffbd76,transparent:true,opacity:.64,depthWrite:false,side:THREE.DoubleSide})
   );
   arc.position.set(-.16,-.30,-.88);arc.rotation.z=-.52;arc.visible=false;rig.add(arc);
   g.userData.slashArc=arc;
  }else{
   const dark=0x18242b,steel=heavy?0x59636b:sniper?0x627880:0x354951;
   this.box(rig,0,0,-.27,heavy?.65:sniper?.31:.37,heavy?.33:.23,heavy?.77:sniper?.85:.56,steel,.65);
   this.box(rig,0,-.14,-.09,.18,.23,.23,dark,.45);
   this.box(rig,.06,.15,-.27,.17,.13,.29,0x15232b,.55);
   const front=heavy?-.99:sniper?-1.13:-.77;
   const barrel=this.cyl(rig,0,.015,front,heavy?.085:sniper?.047:.052,heavy?.86:sniper?.91:.61,dark,10);
   barrel.rotation.x=Math.PI/2;
   if(heavy)for(const x of [-.15,.15]){
    const tube=this.cyl(rig,x,.015,-1.0,.055,.78,0x202e37,10);tube.rotation.x=Math.PI/2;
   }
   if(sniper){
    this.box(rig,0,.2,-.30,.16,.13,.56,0x151f25,.65);
    this.cyl(rig,0,.22,-.3,.095,.3,0x151f25,12).rotation.x=Math.PI/2;
   }
   if(drone){
    this.box(rig,0,-.15,-.31,.43,.15,.48,0x283b46,.65);
   }else{
    this.box(g,.18,1.16,-.54,.21,.23,.57,0x343d42,.24);
    this.box(g,-.21,1.17,-.42,.18,.22,.45,0x3b484f,.25);
   }
  }
  const tip=drone?-.98:heavy?-1.45:sniper?-1.61:-1.07;
  // Small, stationary muzzle flare. The old cone rotated every frame and
  // appeared as a spinning white object after firing.
  const flare=new THREE.Mesh(new THREE.SphereGeometry(heavy?.14:.10,8,6),
   new THREE.MeshBasicMaterial({color:drone?0x77cfe2:0xffb06b,transparent:true,opacity:.65,depthWrite:false}));
  flare.position.set(0,.015,tip);
  flare.visible=false;rig.add(flare);
  const slide=this.box(rig,0,.13,-.23,.17,.05,.22,0x8c9da0,.55);
  const casing=this.box(rig,.27,.12,-.27,.085,.06,.14,0xa88d5a,.25);
  casing.visible=false;
  g.userData.weaponRig=rig;g.userData.flare=flare;g.userData.slide=slide;g.userData.casing=casing;
  g.userData.lastFireSeq=e.fireSeq||0;g.userData.fireTime=0;
  return g;
 }
 // Shared attack animations for the real game and the enemy showroom.
 animateEnemy(model,e,dt=0){
  const u=model.userData;if(!u.weaponRig)return;
  const melee=e.type==='rusher',duration=melee?.58:.24;
  if((e.fireSeq||0)!==u.lastFireSeq){
   u.lastFireSeq=e.fireSeq||0;
   u.fireTime=duration;
  }
  u.fireTime=Math.max(0,u.fireTime-Math.max(0,dt));
  const elapsed=duration-u.fireTime;
  const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
  if(melee){
   const windup=smooth(elapsed/.16);
   const strike=smooth((elapsed-.16)/.17);
   const recover=smooth((elapsed-.37)/.21);
   const lunge=strike*(1-recover);
   // Wind back the arm, then make a quick shoulder-driven horizontal slash.
   u.weaponRig.rotation.x=-.10-.28*windup+.82*strike-.44*recover;
   u.weaponRig.rotation.z=-.10-.78*windup+1.85*strike-1.07*recover;
   u.weaponRig.position.set(.43-.12*lunge,1.60-.13*lunge,-.24-.41*lunge);
   if(u.slashArc){
    u.slashArc.visible=elapsed>.17&&elapsed<.34;
    u.slashArc.material.opacity=.52*(1-smooth((elapsed-.22)/.12));
   }
   model.rotation.x=.09*lunge;
   u.flare.visible=false;
   u.casing.visible=false;
   u.slide.visible=false;
  }else{
   const recoil=u.fireTime>0?Math.sin(Math.PI*smooth(elapsed/duration)):.0;
   u.weaponRig.rotation.x=-.20*recoil;
   u.weaponRig.rotation.z=e.type==='heavy'?.07*recoil:0;
   u.weaponRig.position.z=(e.type==='drone'?-.44:-.37)+.13*recoil;
   // Flash only for the first ~70 ms. It never rotates or spins.
   u.flare.visible=u.fireTime>duration-.07;
   if(u.flare.visible)u.flare.scale.setScalar(1.0+.40*(1-elapsed/.07));
   u.slide.position.z=-.23+.12*recoil;
   u.casing.visible=e.type!=='drone'&&elapsed>.06&&elapsed<.17;
   if(u.casing.visible)u.casing.position.set(.27+elapsed*.8,.12+elapsed*.44,-.27+elapsed*.18);
   model.rotation.x=0;
  }
  if(e.type==='drone')model.position.y=Math.sin(this.clock*3+(e.id||0))*.15;
  if(e.flinch>0)model.rotation.z=Math.sin(this.clock*45)*.06;
  else model.rotation.z=0;
 }
 makeGun(){
  this.gun=new THREE.Group();this.camera.add(this.gun);this.scene.add(this.camera);
  this.gunBody=new THREE.Group();this.gun.add(this.gunBody);
  this.box(this.gunBody,0,0,0,.23,.2,.54,0x2d3a3c,.7);
  this.box(this.gunBody,0,.09,-.23,.16,.14,.37,0x4c5d62,.75);
  const barrel=this.cyl(this.gunBody,0,.065,-.48,.043,.49,0x161f21);barrel.rotation.x=Math.PI/2;
  // Magazine is its own rig so it can physically leave the magwell.
  this.magazine=new THREE.Group();this.magazine.position.set(-.06,-.22,.16);this.gunBody.add(this.magazine);
  this.box(this.magazine,0,0,0,.16,.35,.19,0x2b3535,.62);
  this.box(this.magazine,0,-.19,0,.19,.045,.22,0x879ba3,.75);
  this.freshMagazine=this.magazine.clone(true);this.freshMagazine.visible=false;this.gunBody.add(this.freshMagazine);
  // Visible mechanisms and hands instead of only rotating the entire gun.
  this.chargingHandle=this.box(this.gunBody,.14,.16,-.15,.11,.085,.14,0x172228,.7);
  this.cylinder=this.cyl(this.gunBody,0,-.055,-.04,.12,.24,0x687984,12);
  this.cylinder.rotation.x=Math.PI/2;this.cylinder.visible=false;
  this.pump=this.box(this.gunBody,0,-.095,-.38,.205,.15,.33,0x384744,.45);this.pump.visible=false;
  this.box(this.gunBody,.17,-.17,.26,.24,.24,.48,0x4a5962);
  this.box(this.gunBody,.23,-.24,.32,.23,.16,.26,0x26353d,.8);
  this.box(this.gunBody,.29,-.35,.48,.25,.23,.29,0x313a41,.6);
  this.reloadHand=new THREE.Group();this.gunBody.add(this.reloadHand);
  this.box(this.reloadHand,0,0,0,.22,.15,.23,0x27353c,.8);
  for(const x of [-.072,-.025,.022,.069])this.box(this.reloadHand,x,-.072,-.075,.039,.11,.095,0x34444c,.7);
  this.box(this.reloadHand,-.035,-.155,.13,.23,.24,.32,0x414b52,.6);
  this.reloadHand.visible=false;
  // Sight line is at the camera's screen center when the gun is raised to ADS.
  this.sightHeight=.235;
  this.irons=new THREE.Group();this.gunBody.add(this.irons);
  this.box(this.irons,0,.19,-.53,.037,.09,.055,0x0b1316,.6);
  this.box(this.irons,-.088,.185,.13,.044,.10,.09,0x0b1316,.6);
  this.box(this.irons,.088,.185,.13,.044,.10,.09,0x0b1316,.6);
  this.box(this.irons,0,.115,.13,.22,.05,.14,0x182a2d,.5);
  this.optic=new THREE.Group();this.gunBody.add(this.optic);
  this.box(this.optic,0,.125,-.09,.13,.11,.18,0x1e292c,.6);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.078,.007,10,40),new THREE.MeshStandardMaterial({color:0x283237,metalness:.24,roughness:.78}));
  ring.position.set(0,this.sightHeight,-.09);this.optic.add(ring);
  // The crisp ADS dot is screen-aligned in the HUD; avoid a second, aliased 3D reticle.
  // Keep the optic's physical frame visible on the firearm.
  // The iron sight/optic should stay dark and readable irrespective of lighting.
  // Actual aiming feedback is drawn in the screen-aligned HUD.
  for(const sight of [this.irons,this.optic])sight.traverse(part=>{
   if(part.isMesh&&part.material?.color)
    part.material=new THREE.MeshBasicMaterial({color:part.material.color.clone().multiplyScalar(.72),toneMapped:false});
  });
  // Keep the held weapon on its own layer with restrained lighting.
  this.camera.layers.enable(1);
  this.gunBody.traverse(part=>part.layers.set(1));
  this.weaponFill=new THREE.HemisphereLight(0xaabbbf,0x202b32,.5);
  this.weaponFill.layers.set(1);this.camera.add(this.weaponFill);
  this.weaponKey=new THREE.DirectionalLight(0xc6ced1,.38);
  this.weaponKey.layers.set(1);this.weaponKey.position.set(-1,1.4,1.1);
  this.weaponKey.target.position.set(0,0,-1);
  this.camera.add(this.weaponKey,this.weaponKey.target);
  this.gunTarget=new THREE.Vector3();
  this.muzzle=new THREE.PointLight(0xffd187,0,1.8);this.muzzle.position.set(0,.06,-.8);this.gun.add(this.muzzle);
  this.flash=new THREE.Mesh(new THREE.ConeGeometry(.11,.30,8),new THREE.MeshBasicMaterial({color:0xffbd72,transparent:true,opacity:.60,depthWrite:false}));this.flash.rotation.x=-Math.PI/2;this.flash.position.set(0,.07,-.8);this.gun.add(this.flash);this.flash.visible=false;this.flash.layers.set(1);
 }
 applyGun(weapon){
  const w=WEAPONS[weapon]||WEAPONS.pistol;
  const shotgun=w.pellets>1,long=['rifle','lmg','dmr','sniper','burst'].includes(weapon),compact=['smg','silenced'].includes(weapon);
  this.gunBody.scale.set(shotgun?1.35:weapon==='lmg'?1.5:compact?.94:1,1,weapon==='sniper'?1.9:long?1.5:shotgun?1.4:compact?1.2:1);
  this.weaponType=weapon;
  this.optic.visible=long||compact;
  this.irons.visible=!this.optic.visible;
  this.cylinder.visible=weapon==='revolver';
  this.pump.visible=weapon==='shotgun';
  const sightParts=new Set();
  this.optic.traverse(part=>sightParts.add(part));
  this.irons.traverse(part=>sightParts.add(part));
  this.gunBody.traverse(part=>{
   if(part.material?.color&&!sightParts.has(part))part.material.color.lerp(new THREE.Color(w.color),.3);
  });
 }
 update(run,playerIndex,angles,dt=0,input={}){
  if(!run)return;
  if(this.currentRun!==run.runId)this.build(run);
  this.clock+=dt;
  const p=run.players[playerIndex]||run.players[0];if(!p)return;
  const camera=this.camera;
  const desired=new THREE.Vector3(p.x,1.67-(p.hp<=0?.9:0),p.z);
  camera.position.copy(desired);this.cameraReady=true;
  camera.rotation.set(angles.pitch||0,angles.yaw||0,0,'YXZ');
  const moving=!!(input.forward||input.back||input.left||input.right);
  const bob=moving&&p.hp>0?Math.sin(this.clock*(input.aim?9:input.walk?8:14))*(input.aim?.005:input.walk?.008:.02):0;
  const reloading=p.reload>0,wantsAim=!!input.aim&&p.hp>0,aiming=wantsAim&&!reloading;
  const duration=WEAPONS[p.weapon]?.reload||1;
  const progress=reloading?Math.max(0,Math.min(1,1-p.reload/duration)):0;
  const ease=(a,b)=>{const t=Math.max(0,Math.min(1,(progress-a)/(b-a)));return t*t*(3-2*t);};
  // Bring the entire firearm back into view before operating the magazine and action.
  const pose=reloading?ease(0,.15)*(1-ease(.85,1)):0;
  const baseX=wantsAim?0:.37,baseY=wantsAim?-this.sightHeight:-.36+bob;
  this.gunTarget.set(baseX+(.24-baseX)*pose,baseY+(-.095-baseY)*pose,-.55-pose*.48+p.recoil*.08);
  this.gun.position.lerp(this.gunTarget,Math.min(1,dt*19));
  this.gun.rotation.x=(aiming?0:Math.sin(this.clock*6)*.01)-p.recoil*(aiming?.055:.13);
  this.gunBody.rotation.set(-pose*.22,pose*.29,-pose*.32);
  const revolver=this.weaponType==='revolver',shotgun=this.weaponType==='shotgun';
  const magFed=!revolver&&!shotgun;
  // Deliberate phases: release -> extract -> fetch fresh mag -> seat -> rack -> settle.
  const release=ease(.15,.37),seat=ease(.48,.72);
  this.magazine.visible=magFed&&(!reloading||progress<.42);
  this.magazine.position.set(-.06-release*.14,-.22-release*.51,.16+release*.08);
  this.magazine.rotation.z=-release*.2;
  this.freshMagazine.visible=magFed&&reloading&&progress>=.42;
  this.freshMagazine.position.set(-.20+seat*.14,-.79+seat*.57,.25-seat*.09);
  this.freshMagazine.rotation.z=-.2*(1-seat);
  const rack=ease(.77,.83)*(1-ease(.89,.96));
  this.chargingHandle.position.z=-.15+rack*.20;
  this.cylinder.position.x=-ease(.18,.37)*.20*(1-ease(.72,.89));
  this.cylinder.rotation.z=progress*Math.PI*3;
  this.pump.position.z=-.38+ease(.79,.85)*(1-ease(.88,.96))*.22;
  // Support hand travels with the old/new magazine, then racks the action.
  this.reloadHand.visible=reloading&&progress>.055&&progress<.97;
  if(this.reloadHand.visible){
   let hx,hy,hz;
   if(revolver){
    hx=-.22-ease(.22,.42)*.12;hy=-.06;hz=.08;
    if(progress>.72){hx=-.17;hy=.05;hz=-.12;}
   }else if(shotgun){
    hx=-.14;hy=-.17-ease(.20,.42)*.12;hz=.04;
    if(progress>.78){hx=-.14;hy=-.105;hz=this.pump.position.z;}
   }else if(progress<.42){
    hx=this.magazine.position.x-.12;hy=this.magazine.position.y-.06;hz=this.magazine.position.z+.10;
   }else if(progress<.77){
    hx=this.freshMagazine.position.x-.12;hy=this.freshMagazine.position.y-.06;hz=this.freshMagazine.position.z+.10;
   }else{
    hx=.15;hy=.17;hz=this.chargingHandle.position.z+.025;
   }
   this.reloadHand.position.set(hx,hy,hz);
   this.reloadHand.rotation.set(0,0,progress<.77?-.18:.24);
  }
  camera.fov+=((aiming?56:input.walk?74:moving?80:76)-camera.fov)*Math.min(1,dt*9);camera.updateProjectionMatrix();
  // Never project a near-camera muzzle flash/light across the ADS sight.
  // Recoil, tracers and hitmarkers still communicate ADS shots.
  this.weaponFill.intensity=aiming?.30:.5;
  this.weaponKey.intensity=aiming?.20:.38;
  this.muzzle.intensity=aiming?0:Math.max(0,this.muzzle.intensity-dt*40);
  this.flash.visible=!aiming&&this.muzzle.intensity>.35;
  if(p.stats.shots!==this.lastShots){
   this.lastShots=p.stats.shots;this.muzzle.intensity=aiming?0:2.2;this.flash.visible=!aiming;
  }
  this.exitRing.rotation.z+=dt*.38;
  this.exitRing.material.color.setHex(run.objectives.every(o=>o.done||o.optional)?0x8affbb:0x465b54);
  this.exitBeacon.visible=run.objectives.every(o=>o.done||o.optional);
  for(const o of run.objectives){
   const m=this.objectives.get(o.id);if(!m)continue;m.visible=!o.done;
   m.userData.beam.material.opacity=o.requires.every(id=>run.objectives.find(x=>x.id===id)?.done)?(.12+Math.sin(this.clock*3)*.05):.02;
   m.userData.ring.rotation.z+=dt*.9;
  }
  const crewIds=new Set();
  for(const mate of run.players){
   if(mate.id===playerIndex)continue;
   crewIds.add(mate.id);
   if(!this.allies.has(mate.id)){
    const model=this.enemyMesh({type:'guard'}),marker=new THREE.Mesh(new THREE.TorusGeometry(.65,.065,7,28),new THREE.MeshBasicMaterial({color:0x7fddff}));
    marker.rotation.x=Math.PI/2;marker.position.y=.11;model.add(marker);
    model.traverse(mesh=>{if(mesh.isMesh&&mesh.material?.color&&mesh!==model.userData.hpFill&&mesh!==model.userData.hpBack)mesh.material.color.lerp(new THREE.Color(0x6dbde0),.45);});
    this.world.add(model);this.allies.set(mate.id,model);
   }
   const model=this.allies.get(mate.id);model.visible=mate.hp>0;
   model.position.lerp(new THREE.Vector3(mate.x,0,mate.z),Math.min(1,dt*15));
   model.rotation.y=mate.yaw;
   const ratio=mate.hp/mate.maxHp;model.userData.hpFill.scale.x=ratio;
   model.userData.hpFill.position.x=-(1-ratio)*.49;
  }
  for(const [id,mesh] of this.allies)if(!crewIds.has(id)){this.world.remove(mesh);this.allies.delete(id);}
  const alive=new Set();
  for(const e of run.enemies){alive.add(e.id);
   if(!this.enemies.has(e.id)){const model=this.enemyMesh(e);this.world.add(model);this.enemies.set(e.id,model);}
   const m=this.enemies.get(e.id);m.visible=e.hp>0;if(e.hp<=0)continue;
   m.position.lerp(new THREE.Vector3(e.x,0,e.z),Math.min(1,dt*13));
   m.rotation.y=e.dir+Math.PI;
   const bar=m.userData.hpFill,ratio=e.hp/e.maxHp;bar.scale.x=ratio;bar.position.x=-(1-ratio)*.49;
   bar.material.color.setHex(ratio<.4?0xffa18a:0x8affbd);
   this.animateEnemy(m,e,dt);
  }
  for(const [id,m] of this.enemies)if(!alive.has(id)){this.world.remove(m);this.enemies.delete(id);}
  // The projectiles are simulated already; give active shots a visible, inexpensive streak.
  const liveRounds=new Set();
  for(const shot of run.projectiles){
   liveRounds.add(shot.id);
   let mesh=this.enemyRounds.get(shot.id);
   if(!mesh){
    mesh=new THREE.Mesh(new THREE.BoxGeometry(.038,.038,.57),
     new THREE.MeshBasicMaterial({color:shot.type==='drone'?0x8af3ff:shot.type==='sniper'?0xffb4ac:0xffd58b}));
    this.world.add(mesh);this.enemyRounds.set(shot.id,mesh);
   }
   mesh.position.set(shot.x,shot.y||1.3,shot.z);
   mesh.rotation.y=Math.atan2(shot.dx,shot.dz);
  }
  for(const [id,mesh] of this.enemyRounds)if(!liveRounds.has(id)){
   this.world.remove(mesh);mesh.geometry.dispose();mesh.material.dispose();this.enemyRounds.delete(id);
  }
  const visibleBags=new Set();
  for(const bag of run.loot||[]){
   visibleBags.add(bag.id);
   if(!this.bags.has(bag.id)){
    const bagModel=new THREE.Group();
    this.box(bagModel,0,.34,0,.85,.66,.65,0xc9a76e,.2);
    this.box(bagModel,0,.71,0,.5,.15,.36,0xe0cd98,.2);
    this.box(bagModel,0,.68,0,.13,.16,.72,0x65543e,.5);
    this.world.add(bagModel);this.bags.set(bag.id,bagModel);
   }
   const mesh=this.bags.get(bag.id);
   mesh.visible=!bag.secured&&bag.carrier===null;
   mesh.position.set(bag.x,.12+Math.sin(this.clock*3+bag.id)*.06,bag.z);
  }
  for(const [id,mesh] of this.bags)if(!visibleBags.has(id)){this.world.remove(mesh);this.bags.delete(id);}
  if(this.rain&&dt>0){
   const positions=this.rain.mesh.geometry.attributes.position;
   for(let i=0;i<positions.count;i++){
    let y=positions.getY(i)-this.rain.speed[i]*dt;
    if(y<.3)y+=12;
    positions.setY(i,y);
   }
   positions.needsUpdate=true;
  }
  const available=new Set();
  for(const item of run.pickups){if(item.taken)continue;
   if(item.type==='smoke'){
    if(!this.pickups.has(item.id)){const mesh=new THREE.Mesh(new THREE.SphereGeometry(3.8,16,12),new THREE.MeshBasicMaterial({color:0x9dbdbd,transparent:true,opacity:.17,depthWrite:false}));this.world.add(mesh);this.pickups.set(item.id,mesh);}
   }else if(!this.pickups.has(item.id)){
    let mesh;
    if(item.type==='blast'||item.type==='flash'){
     mesh=new THREE.Mesh(new THREE.SphereGeometry(item.type==='blast'?2.8:3.6,12,8),new THREE.MeshBasicMaterial({color:item.type==='blast'?0xff994c:0xf4faff,transparent:true,opacity:.34,depthWrite:false}));
     this.world.add(mesh);
    }else{
     const tint={med:0x86edb0,ammo:0xe5ca8f,mine:0xff776a,decoy:0x82d5ff}[item.type]||0xe5ca8f;
     mesh=this.box(this.world,item.x,.45,item.z,item.type==='mine'?.8:.55,.55,item.type==='mine'?.8:.55,tint);
    }
    this.pickups.set(item.id,mesh);
   }
   available.add(item.id);const mesh=this.pickups.get(item.id);
   if(item.type==='blast'||item.type==='flash'){mesh.material.opacity=.34*Math.min(1,(item.ttl||0)*5);mesh.scale.setScalar(1+(1-(item.ttl||0)/.35)*.2);}
   mesh.position.set(item.x,item.type==='smoke'?1.5:item.type==='blast'||item.type==='flash'?1.45:.55+Math.sin(this.clock*3)*.12,item.z);
  }
  for(const [id,mesh] of this.pickups)if(!available.has(id)){this.world.remove(mesh);this.pickups.delete(id);}
  const activeTracers=new Set();
  for(const t of run.tracers){activeTracers.add(t.id);
   if(!this.tracerMeshes.has(t.id)){
    const a=new THREE.Vector3(t.x,t.y??1.64,t.z),b=new THREE.Vector3(t.tx,t.ty??1.64,t.tz);
    const geo=new THREE.BufferGeometry().setFromPoints([a,b]);
    const line=new THREE.Line(geo,new THREE.LineBasicMaterial({color:t.owner===playerIndex?0xfff1aa:0xfda3a0,transparent:true,opacity:.95}));this.world.add(line);this.tracerMeshes.set(t.id,line);
   }
   this.tracerMeshes.get(t.id).material.opacity=Math.max(0,t.ttl/.13);
  }
  for(const [id,mesh] of this.tracerMeshes)if(!activeTracers.has(id)){this.world.remove(mesh);mesh.geometry.dispose();mesh.material.dispose();this.tracerMeshes.delete(id);}
  this.visuals.update(run,this.clock,aiming,dt);
  this.renderer.render(this.scene,camera);
 }
 dispose(){this.observer.disconnect();this.clear();this.visuals.dispose();this.renderer.dispose();}
}
function rnd(n){return Math.sin(n*12.9898)*.5;}
