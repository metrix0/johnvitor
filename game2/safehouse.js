import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';
import {Visuals} from './visuals.js?v=3';
import {buildCabin} from './cabin.js?v=2';

// Physical stations, all reachable from the compact walkable safehouse.
export const SAFEHOUSE_STATIONS = [
 {id:'missions',name:'JOBS',x:0,z:-6.55,rot:0,color:0xffd38c},
 {id:'weapons',name:'WEAPONS',x:-6.55,z:-2.3,rot:Math.PI/2,color:0x91cfff},
 {id:'gadgets',name:'GADGETS',x:6.55,z:-2.3,rot:-Math.PI/2,color:0x9df7cf},
 {id:'upgrades',name:'UPGRADES',x:-6.55,z:2.9,rot:Math.PI/2,color:0xd5b6ff},
 {id:'crew',name:'CREW',x:6.55,z:2.9,rot:-Math.PI/2,color:0x9bdfff},
 {id:'deploy',name:'DEPLOY',x:0,z:6.55,rot:Math.PI,color:0xffb879}
];
const material=(color,metalness=0,glow=0)=>new THREE.MeshStandardMaterial({
 color,metalness,roughness:.7,emissive:color,emissiveIntensity:glow
});
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
  this.targets=[];this.raycaster=new THREE.Raycaster();this.focused=null;this.focusMesh=null;this.highlight=null;
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
 build(){buildCabin(this,SAFEHOUSE_STATIONS);}
 focus(){return this.focused;}
 pick(){
  this.raycaster.setFromCamera({x:0,y:0},this.camera);
  const hit=this.raycaster.intersectObjects(this.targets,false).find(({distance})=>distance<6.4);
  const mesh=hit?.object||null;
  if(mesh!==this.focusMesh){
   if(this.highlight){this.scene.remove(this.highlight);this.highlight.geometry.dispose();this.highlight.material.dispose();this.highlight=null;}
   this.focusMesh=mesh;
   if(mesh?.userData.focus?.type==='item'){
    this.scene.updateMatrixWorld(true);
    this.highlight=new THREE.BoxHelper(mesh,0xf5d6a0);
    this.highlight.material.transparent=true;this.highlight.material.opacity=.8;
    this.scene.add(this.highlight);
   }
  }
  // Allow a nearby station to be opened without perfect crosshair precision.
  const nearby=mesh?null:this.nearest();
  this.focused=mesh?.userData.focus||(nearby?{type:'station',station:nearby.id}:null);
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
  this.pick();
  this.renderer.render(this.scene,this.camera);
 }
 setActive(active){this.active=active;this.resetKeys();if(active)this.resize();}
 dispose(){
  this.observer.disconnect();
  if(this.highlight){this.scene.remove(this.highlight);this.highlight.geometry.dispose();this.highlight.material.dispose();}
  this.scene.traverse(obj=>{
   obj.geometry?.dispose();
   if(obj.material){for(const mat of (Array.isArray(obj.material)?obj.material:[obj.material])){
    mat.map?.dispose();mat.dispose();
   }}
  });
  this.visuals.dispose();this.renderer.dispose();this.canvas.remove();
 }
}
