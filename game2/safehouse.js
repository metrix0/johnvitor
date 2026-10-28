import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';
import {Visuals} from './visuals.js';

// Physical stations, all reachable from the compact walkable safehouse.
export const SAFEHOUSE_STATIONS = [
 {id:'missions',name:'JOB BOARD',hint:'CHOOSE AN OPERATION',x:0,z:-6.55,rot:0,color:0xffd38c},
 {id:'weapons',name:'WEAPON RACK',hint:'CHOOSE YOUR FIREARM',x:-6.55,z:-2.3,rot:Math.PI/2,color:0x91cfff},
 {id:'gadgets',name:'TACTICAL BENCH',hint:'EQUIP A GADGET',x:6.55,z:-2.3,rot:-Math.PI/2,color:0x9df7cf},
 {id:'upgrades',name:'ARMOR LOCKER',hint:'BUY UPGRADES',x:-6.55,z:2.9,rot:Math.PI/2,color:0xd5b6ff},
 {id:'crew',name:'RADIO STATION',hint:'CREATE / JOIN A CREW',x:6.55,z:2.9,rot:-Math.PI/2,color:0x9bdfff},
 {id:'deploy',name:'EXIT AIRLOCK',hint:'BEGIN THE HEIST',x:0,z:6.55,rot:Math.PI,color:0xffb879}
];
const material=(color,metalness=0,glow=0)=>new THREE.MeshStandardMaterial({
 color,metalness,roughness:.7,emissive:color,emissiveIntensity:glow
});
function placard(title,small,color){
 const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=320;
 const c=canvas.getContext('2d');c.fillStyle='#101c22';c.fillRect(0,0,1024,320);
 c.strokeStyle='#3c555e';c.lineWidth=12;c.strokeRect(9,9,1006,302);
 c.fillStyle='#'+color.toString(16).padStart(6,'0');c.fillRect(36,33,9,255);
 c.font='800 74px Arial';c.textAlign='left';c.fillText(title,79,154);
 c.font='bold 28px Arial';c.fillStyle='#a3bbc2';c.fillText(small,82,213);
 c.fillStyle='#6c8c96';c.font='21px monospace';c.fillText('G·C / UNDERGROUND HEADQUARTERS',82,261);
 const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;return tex;
}
export class Safehouse {
 constructor(container,interact){
  this.container=container;this.interact=interact;
  this.scene=new THREE.Scene();this.scene.background=new THREE.Color(0x08121b);
  this.scene.fog=new THREE.FogExp2(0x08121b,.025);
  this.camera=new THREE.PerspectiveCamera(76,1,.08,80);
  this.camera.rotation.order='YXZ';this.camera.position.set(0,1.75,-2.65);
  this.renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
  this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));
  this.renderer.outputColorSpace=THREE.SRGBColorSpace;
  this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.38;
  this.canvas=this.renderer.domElement;this.canvas.id='safehouseCanvas';this.canvas.tabIndex=0;
  this.container.append(this.canvas);
  this.pos={x:0,z:-2.65};this.yaw=0;this.pitch=0;this.step=0;
  this.move={w:false,a:false,s:false,d:false,shift:false};
  this.active=false;this.lights=[];this.meshes=[];this.elapsed=0;
  this.visuals=new Visuals({camera:this.camera,renderer:this.renderer,world:this.scene,box:(parent,x,y,z,w,h,d,color)=>this.box(x,y,z,w,h,d,color,parent)});
  this.build();this.resize();
  this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(this.container);
  this.canvas.addEventListener('mousedown',()=>{if(this.active&&document.pointerLockElement!==this.canvas){
   const result=this.canvas.requestPointerLock();result?.catch?.(()=>{});
  }});
  this.canvas.addEventListener('contextmenu',e=>e.preventDefault());
 }
 box(x,y,z,w,h,d,mat,parent=this.scene){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
  mesh.position.set(x,y,z);parent.add(mesh);return mesh;
 }
 cylinder(x,y,z,rt,rb,height,mat){
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,height,12),mat);
  mesh.position.set(x,y,z);this.scene.add(mesh);return mesh;
 }
 build(){
  const concrete=this.visuals.surface('plaster',0x374750,15,5),floor=this.visuals.surface('tile',0x263a44,15,15);
  const metal=material(0x344652,.65),black=material(0x0b171c,.38),ceiling=this.visuals.surface('metal',0x465560,15,15);
  const mint=material(0x80f3c7,.12,.5),amber=material(0xf9bc70,.15,.3);
  this.scene.add(new THREE.HemisphereLight(0xb6d8e9,0x111725,1.1));
  this.box(0,-.22,0,15.4,.4,15.4,floor);
  this.box(0,4.65,0,15.4,.3,15.4,ceiling);
  this.box(-7.65,2.25,0,.3,4.6,15.4,concrete);
  this.box(7.65,2.25,0,.3,4.6,15.4,concrete);
  this.box(0,2.25,-7.65,15.4,4.6,.3,concrete);
  this.box(0,2.25,7.65,15.4,4.6,.3,concrete);
  // Pools of light anchor each station in the room, without shadow-map overhead.
  for(const [x,z,color,diameter] of [[-5.3,-2.3,0x83c8ff,5],[5.3,-2.3,0x7de8c5,5],[-5.3,2.9,0xb99dff,5],[5.3,2.9,0x83d5ff,5],[0,-5.4,0xffd09a,6],[0,5.5,0xffa166,6]])this.visuals.pool(x,z,diameter,color,.24,.019);
  // Industrial floor grid, skirting and ceiling conduit.
  const lines=material(0x334953,.2);
  for(let x=-7;x<=7;x+=1.5)this.box(x,.007,0,.017,.014,15.1,lines);
  for(let z=-7;z<=7;z+=1.5)this.box(0,.008,z,15.1,.014,.017,lines);
  for(const v of [-7.25,7.25]){
   this.box(v,.17,0,.14,.34,15,metal);this.box(0,.17,v,15,.34,.14,metal);
   this.box(v,4.43,0,.18,.12,15,metal);this.box(0,4.43,v,15,.12,.18,metal);
  }
  for(const x of [-5.5,0,5.5]){
   this.box(x,4.32,0,3.7,.08,.24,mint);
   const lamp=new THREE.PointLight(0x88ffda,4,12,2);lamp.position.set(x,3.8,0);this.scene.add(lamp);this.lights.push(lamp);
  }
  for(const z of [-6.4,6.4]){
   const lamp=new THREE.PointLight(0xffba77,4,9,2);lamp.position.set(0,2.9,z);this.scene.add(lamp);this.lights.push(lamp);
  }
  // Emergency ventilation and pipes reinforce the hidden bunker look.
  for(const z of [-6.8,6.8]){
   for(const y of [3.75,4.04])this.box(0,y,z,10,.1,.15,metal);
  }
  for(const x of [-5.9,5.9]){
   for(const z of [-5.5,-4.7,4.8,5.6])this.cylinder(x,.28,z,.15,.15,.35,black);
  }
  // A compact planning table with paper dossiers, a glowing floor map and a radio.
  this.box(0,.68,1.05,3.35,.12,2.05,this.visuals.surface('wood',0x637781,4,3));
  for(const x of [-1.43,1.43])for(const z of [.2,1.9])this.box(x,.3,z,.12,.6,.13,black);
  this.box(0,.754,.94,2.6,.016,1.46,material(0x203743,.2,.18));
  for(const x of [-.88,.05,.78])this.box(x,.77,1.1,.46,.018,.64,material(0x809ba7,.04));
  this.box(-1.2,.82,.3,.5,.21,.37,black);
  this.box(-1.2,.95,.3,.22,.08,.08,mint);
  // Every station has a readable in-world sign, glowing trim and identifiable furniture.
  for(const s of SAFEHOUSE_STATIONS){
   const group=new THREE.Group();group.position.set(s.x,0,s.z);group.rotation.y=s.rot;this.scene.add(group);
   const frame=new THREE.Mesh(new THREE.BoxGeometry(5.2,2.7,.26),metal);frame.position.set(0,2.6,-.07);group.add(frame);
   const glow=new THREE.Mesh(new THREE.BoxGeometry(5.0,.045,.16),material(s.color,.15,.65));glow.position.set(0,1.33,.13);group.add(glow);
   const label=new THREE.Mesh(new THREE.PlaneGeometry(4.72,1.48),new THREE.MeshBasicMaterial({map:placard(s.name,s.hint,s.color),side:THREE.DoubleSide}));
   label.position.set(0,2.95,.105);group.add(label);
   const bumper=new THREE.Mesh(new THREE.BoxGeometry(4.95,.12,.32),black);bumper.position.set(0,1.21,.17);group.add(bumper);
   if(s.id==='weapons'){
    for(const t of [-1.55,-.5,.6,1.65]){
     const gun=new THREE.Group();
     const body=new THREE.Mesh(new THREE.BoxGeometry(.78,.13,.13),black);body.position.set(t,1.84,.32);gun.add(body);
     const barrel=new THREE.Mesh(new THREE.BoxGeometry(.5,.07,.065),metal);barrel.position.set(t+.48,1.84,.32);gun.add(barrel);
     const grip=new THREE.Mesh(new THREE.BoxGeometry(.14,.3,.09),black);grip.position.set(t-.19,1.67,.32);gun.add(grip);
     group.add(gun);
    }
   }else if(s.id==='gadgets'){
    for(const x of [-1.7,-.8,.1,1,1.7]){
     const c=new THREE.Mesh(new THREE.BoxGeometry(.53,.43,.43),black);c.position.set(x,1.68,.39);group.add(c);
     const light=new THREE.Mesh(new THREE.BoxGeometry(.32,.045,.05),mint);light.position.set(x,1.86,.63);group.add(light);
    }
   }else if(s.id==='upgrades'){
    for(const x of [-1.2,0,1.2]){
     const plate=new THREE.Mesh(new THREE.BoxGeometry(.9,.62,.2),material(0x566573,.55));plate.position.set(x,1.76,.38);group.add(plate);
     const stripe=new THREE.Mesh(new THREE.BoxGeometry(.12,.62,.23),amber);stripe.position.set(x,1.76,.51);group.add(stripe);
    }
   }else if(s.id==='crew'){
    for(const x of [-1.4,.1,1.5]){
     const radio=new THREE.Mesh(new THREE.BoxGeometry(.8,.52,.35),black);radio.position.set(x,1.78,.36);group.add(radio);
     const screen=new THREE.Mesh(new THREE.BoxGeometry(.46,.18,.025),mint);screen.position.set(x,1.85,.56);group.add(screen);
    }
   }else if(s.id==='missions'){
    for(let x=-1.8;x<2;x+=.9){const pin=new THREE.Mesh(new THREE.BoxGeometry(.43,.1,.08),amber);pin.position.set(x,1.8,.27);group.add(pin);}
   }else if(s.id==='deploy'){
    const door=new THREE.Mesh(new THREE.BoxGeometry(2.4,2.4,.16),black);door.position.set(0,1.35,.3);group.add(door);
    const strip=new THREE.Mesh(new THREE.BoxGeometry(.12,2.4,.18),amber);strip.position.set(-1.1,1.35,.4);group.add(strip);
    const strip2=strip.clone();strip2.position.x=1.1;group.add(strip2);
   }
  }
  // Crates and fuse boxes sit against the walls, leaving a clear walkable center.
  for(const [x,z] of [[-6.5,-5.5],[6.5,-5.5],[-6.5,5.7],[6.5,5.7]]){
   this.box(x,.38,z,1.1,.75,.9,black);this.box(x,.77,z,1.13,.1,.93,metal);
  }
 }
 resize(){
  const w=this.container.clientWidth||900,h=this.container.clientHeight||600;
  this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();
 }
 key(k,down){
  const id=({arrowup:'w',arrowdown:'s',arrowleft:'a',arrowright:'d'})[k]||k;
  if(id in this.move)this.move[id]=down;
  if(k==='shift')this.move.shift=down;
 }
 look(dx,dy){
  this.yaw-=dx*.0022;
  this.pitch=Math.max(-1.2,Math.min(1.2,this.pitch-dy*.0019));
 }
 resetKeys(){for(const k of Object.keys(this.move))this.move[k]=false;}
 nearest(){
  let best=null,bestDistance=3.85;
  const forward={x:-Math.sin(this.yaw),z:-Math.cos(this.yaw)};
  for(const s of SAFEHOUSE_STATIONS){
   const dx=s.x-this.pos.x,dz=s.z-this.pos.z,d=Math.hypot(dx,dz);
   const dot=(dx*forward.x+dz*forward.z)/Math.max(d,.001);
   if(d<bestDistance&&dot>.38){best=s;bestDistance=d;}
  }
  return best;
 }
 update(dt){
  if(!this.active)return;
  const locked=document.pointerLockElement===this.canvas;
  if(locked){
   const forward=(this.move.w?1:0)-(this.move.s?1:0),strafe=(this.move.d?1:0)-(this.move.a?1:0);
   // Match heist movement: run by default, Shift to walk quietly.
   const magnitude=Math.hypot(forward,strafe)||1,speed=this.move.shift?3.2:7.4;
   const dx=(-Math.sin(this.yaw)*forward+Math.cos(this.yaw)*strafe)*dt*speed/magnitude;
   const dz=(-Math.cos(this.yaw)*forward-Math.sin(this.yaw)*strafe)*dt*speed/magnitude;
   this.pos.x=Math.max(-6.2,Math.min(6.2,this.pos.x+dx));
   this.pos.z=Math.max(-6.1,Math.min(6.1,this.pos.z+dz));
   if(forward||strafe)this.step+=dt*(this.move.shift?7:14);
  }
  this.elapsed+=dt;
  this.camera.position.set(this.pos.x,1.73+(locked?(this.move.shift?.008:.018)*Math.sin(this.step):0),this.pos.z);
  this.camera.rotation.set(this.pitch,this.yaw,0,'YXZ');
  this.visuals.update({mission:1,alarm:0},this.elapsed);
  this.renderer.render(this.scene,this.camera);
 }
 setActive(active){this.active=active;this.resetKeys();if(active)this.resize();}
 dispose(){
  this.observer.disconnect();
  this.scene.traverse(obj=>{
   obj.geometry?.dispose();
   if(obj.material){for(const mat of (Array.isArray(obj.material)?obj.material:[obj.material])){
    mat.map?.dispose();mat.dispose();
   }}
  });
  this.visuals.dispose();this.renderer.dispose();this.canvas.remove();
 }
}
