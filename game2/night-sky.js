import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';

// Level 1 only: a static, self-contained night panorama. One sky mesh and one
// generated texture; no remote images, per-frame sky calculations, or extra lights.
export function buildNightSky(view){
 const canvas=document.createElement('canvas');
 canvas.width=1024;canvas.height=512;
 const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
 const dusk=ctx.createLinearGradient(0,0,0,h);
 dusk.addColorStop(0,'#050b17');
 dusk.addColorStop(.24,'#0b172b');
 dusk.addColorStop(.40,'#1a3044');
 dusk.addColorStop(.50,'#243b4b');
 dusk.addColorStop(.62,'#142334');
 dusk.addColorStop(.82,'#081221');
 dusk.addColorStop(1,'#060c15');
 ctx.fillStyle=dusk;ctx.fillRect(0,0,w,h);

 // Faint, uneven urban haze on the skyline, soft enough to be fog-compatible.
 for(const [x,y,r] of [[180,255,240],[520,264,270],[860,250,240]]){
  const haze=ctx.createRadialGradient(x,y,4,x,y,r);
  haze.addColorStop(0,'rgba(114,125,139,.09)');
  haze.addColorStop(1,'rgba(75,96,116,0)');
  ctx.fillStyle=haze;ctx.fillRect(x-r,y-r,r*2,r*2);
 }

 let seed=0x41a14e;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 // A few hundred star pixels are baked into the texture, not independent meshes.
 for(let i=0;i<390;i++){
  const x=random()*w,y=10+random()*232;
  const altitude=1-y/260;
  if(random()<.28||altitude<.04)continue;
  const radius=random()>.95?1.3:.38+random()*.46;
  ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);
  ctx.fillStyle='rgba(221,236,255,'+(.14+random()*.46*altitude).toFixed(3)+')';ctx.fill();
 }

 // Thin high clouds: tinted, irregular streaks instead of opaque flat bands.
 for(let i=0;i<32;i++){
  const x=random()*w,y=84+random()*154,r=30+random()*116;
  ctx.save();ctx.translate(x,y);ctx.scale(1,.22+random()*.12);
  const cloud=ctx.createRadialGradient(0,0,2,0,0,r);
  cloud.addColorStop(0,'rgba(151,178,198,'+(0.025+random()*.045).toFixed(3)+')');
  cloud.addColorStop(1,'rgba(151,178,198,0)');
  ctx.fillStyle=cloud;ctx.fillRect(-r,-r,r*2,r*2);ctx.restore();
 }

 // A subdued moon and scattering halo on the far side of the parking lot.
 const moonX=684,moonY=128;
 const halo=ctx.createRadialGradient(moonX,moonY,4,moonX,moonY,80);
 halo.addColorStop(0,'rgba(208,228,245,.22)');
 halo.addColorStop(.22,'rgba(167,196,228,.075)');
 halo.addColorStop(1,'rgba(151,188,224,0)');
 ctx.fillStyle=halo;ctx.fillRect(moonX-80,moonY-80,160,160);
 ctx.beginPath();ctx.arc(moonX,moonY,9.5,0,Math.PI*2);
 ctx.fillStyle='#dce6ed';ctx.fill();
 ctx.beginPath();ctx.arc(moonX-2.2,moonY-1.4,8.2,0,Math.PI*2);
 ctx.fillStyle='rgba(247,249,250,.25)';ctx.fill();

 const texture=new THREE.CanvasTexture(canvas);
 texture.colorSpace=THREE.SRGBColorSpace;
 texture.wrapS=THREE.RepeatWrapping;
 texture.magFilter=THREE.LinearFilter;
 texture.minFilter=THREE.LinearFilter;
 // A skydome keeps the horizon and moon direction stable as the camera turns.
 const geometry=new THREE.SphereGeometry(118,40,24);
 const material=new THREE.MeshBasicMaterial({
  map:texture,side:THREE.BackSide,depthWrite:false,depthTest:true,
  fog:false,toneMapped:false
 });
 const sky=new THREE.Mesh(geometry,material);
 sky.name='nightshift-sky';
 sky.renderOrder=-100;
 sky.frustumCulled=false;
 sky.position.copy(view.camera.position);
 view.world.add(sky);
 return sky;
}
