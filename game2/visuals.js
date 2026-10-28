import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';

// Shared, locally generated materials: no image downloads, predictable memory use.
export class Visuals {
 constructor(view) {
  this.view=view;
  this.canvases=new Map();
  this.textures=new Map();
  this.alerts=[];
  this.glows=[];
  this.lamps=[];
  this.flashlight=new THREE.SpotLight(0xe9f3ff,2.65,23,Math.PI/5,.82,1.65);
  // The world flashlight must not illuminate the held weapon inches in front of it.
  this.flashlight.layers.set(0);
  this.flashlight.position.set(0,-.12,-.14);
  this.flashlight.target.position.set(0,-.22,-10);
  view.camera.add(this.flashlight,this.flashlight.target);
 }
 pattern(kind) {
  if(this.canvases.has(kind))return this.canvases.get(kind);
  const c=document.createElement('canvas');c.width=c.height=256;
  const a=c.getContext('2d'),size=256;
  let seed=kind.split('').reduce((n,ch)=>n*31+ch.charCodeAt(0),11)>>>0;
  const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  a.fillStyle=kind==='asphalt'?'#b1b3b8':kind==='metal'?'#b3bcc0':kind==='wood'?'#c3b5a0':'#c4c4c1';
  a.fillRect(0,0,size,size);
  for(let i=0;i<3900;i++){
   const x=rand()*size,y=rand()*size,r=.35+rand()*2;
   a.fillStyle=rand()>.52?'rgba(255,255,255,.19)':'rgba(9,18,25,.23)';
   a.fillRect(x,y,r,kind==='metal'?.25+rand()*.5:r);
  }
  if(kind==='tile'){
   a.strokeStyle='rgba(20,28,32,.50)';a.lineWidth=2.5;
   for(let i=0;i<=4;i++){a.beginPath();a.moveTo(i*64,0);a.lineTo(i*64,256);a.stroke();a.beginPath();a.moveTo(0,i*64);a.lineTo(256,i*64);a.stroke();}
   a.strokeStyle='rgba(255,255,255,.19)';a.lineWidth=1;
   for(let i=0;i<4;i++){a.strokeRect(i*64+3,3,59,250);}
  }else if(kind==='brick'||kind==='plaster'){
   a.lineWidth=kind==='brick'?3:1;
   a.strokeStyle=kind==='brick'?'rgba(35,38,39,.35)':'rgba(42,53,60,.19)';
   for(let y=0;y<256;y+=kind==='brick'?42:65){
    a.beginPath();a.moveTo(0,y);a.lineTo(256,y);a.stroke();
    if(kind==='brick')for(let x=(y/42%2)*43;x<256;x+=86){a.beginPath();a.moveTo(x,y);a.lineTo(x,y+42);a.stroke();}
   }
   if(kind==='plaster')for(let i=0;i<95;i++){
    const x=rand()*size,y=rand()*size,w=5+rand()*34,h=2+rand()*20;
    a.fillStyle=rand()>.48?'rgba(35,38,42,.10)':'rgba(255,255,255,.11)';
    a.fillRect(x,y,w,h);
   }
  }else if(kind==='asphalt'||kind==='concrete'){
   // Surface aggregate, worn patches and cracks remain legible under night lighting.
   for(let i=0;i<120;i++){
    const x=rand()*size,y=rand()*size,w=3+rand()*28,h=1+rand()*13;
    a.fillStyle=rand()>.46?'rgba(24,33,39,.16)':'rgba(255,255,255,.08)';
    a.fillRect(x,y,w,h);
   }
   for(let i=0;i<(kind==='asphalt'?24:13);i++){
    let x=rand()*size,y=rand()*size;
    a.strokeStyle=kind==='asphalt'?'rgba(23,27,31,.37)':'rgba(26,35,39,.28)';
    a.lineWidth=.55+rand()*1.1;a.beginPath();a.moveTo(x,y);
    for(let j=0;j<4;j++){x+=rand()*17-5;y+=rand()*18-4;a.lineTo(x,y);}
    a.stroke();
   }
  }else if(kind==='wood'){
   for(let i=0;i<65;i++){
    a.strokeStyle=rand()>.5?'rgba(44,26,18,.26)':'rgba(255,238,198,.19)';
    a.lineWidth=.35+rand()*1.5;const y=rand()*256;
    a.beginPath();a.moveTo(0,y);a.bezierCurveTo(90,y+rand()*5,175,y-5+rand()*10,256,y+rand()*6);a.stroke();
   }
  }else if(kind==='metal'){
   for(let i=0;i<90;i++){
    a.fillStyle=rand()>.5?'rgba(255,255,255,.1)':'rgba(18,29,38,.1)';
    a.fillRect(0,rand()*256,256,.3+rand()*.7);
   }
  }else {
   for(let i=0;i<18;i++){
    const x=rand()*256,y=rand()*256;
    a.strokeStyle='rgba(32,37,44,.12)';a.lineWidth=.7;
    a.beginPath();a.moveTo(x,y);a.lineTo(x+4+rand()*38,y+rand()*5);a.stroke();
   }
  }
  this.canvases.set(kind,c);return c;
 }
 texture(kind,repeatX=1,repeatY=1) {
  const key=kind+':'+repeatX+':'+repeatY;
  if(this.textures.has(key))return this.textures.get(key);
  const t=new THREE.CanvasTexture(this.pattern(kind));
  t.colorSpace=THREE.SRGBColorSpace;
  t.wrapS=t.wrapT=THREE.RepeatWrapping;
  t.repeat.set(Math.min(50,Math.max(1,Math.round(repeatX))),Math.min(50,Math.max(1,Math.round(repeatY))));
  t.anisotropy=Math.min(4,this.view.renderer.capabilities.getMaxAnisotropy());
  this.textures.set(key,t);return t;
 }
 surface(kind,color,width=5,depth=5) {
  const tex=this.texture(kind,Math.max(1,width/3),Math.max(1,depth/3));
  const roughness=kind==='asphalt'?.57:kind==='metal'?.42:kind==='tile'?.45:.86;
  const m=new THREE.MeshStandardMaterial({
   color,map:tex,roughness,metalness:kind==='metal'?.48:.06,
   // One shared cached map gives subtle relief without more texture downloads.
   bumpMap:tex,bumpScale:kind==='metal'?.012:kind==='wood'?.022:kind==='tile'?.018:.035
  });
  if(kind==='asphalt'||kind==='tile')m.envMapIntensity=.8;
  return m;
 }
 glowTexture(){
  if(this.textures.has('glow'))return this.textures.get('glow');
  const c=document.createElement('canvas');c.width=c.height=128;
  const a=c.getContext('2d'),g=a.createRadialGradient(64,64,0,64,64,64);
  g.addColorStop(0,'rgba(255,255,255,.87)');g.addColorStop(.25,'rgba(255,255,255,.5)');
  g.addColorStop(.68,'rgba(255,255,255,.08)');g.addColorStop(1,'rgba(255,255,255,0)');
  a.fillStyle=g;a.fillRect(0,0,128,128);
  const t=new THREE.CanvasTexture(c);this.textures.set('glow',t);return t;
 }
 pool(x,z,diameter,color,opacity=.35,y=.052) {
  const m=new THREE.Mesh(new THREE.PlaneGeometry(diameter,diameter),
   new THREE.MeshBasicMaterial({color,map:this.glowTexture(),transparent:true,opacity,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2}));
  m.rotation.x=-Math.PI/2;m.position.set(x,y,z);this.view.world.add(m);this.glows.push(m);return m;
 }
 shadow(group,size=1.4){
  const m=new THREE.Mesh(new THREE.PlaneGeometry(size,size),
   new THREE.MeshBasicMaterial({color:0x030b10,map:this.glowTexture(),transparent:true,opacity:.31,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}));
  m.rotation.x=-Math.PI/2;m.position.y=.045;group.add(m);return m;
 }
 lamp(x,y,z,color,intensity=3,range=11,alarm=false){
  const light=new THREE.PointLight(color,intensity,range,2);
  light.position.set(x,y,z);this.view.world.add(light);this.lamps.push(light);
  if(alarm)this.alerts.push({light,base:intensity});
  return light;
 }
 setup(run,p) {
  const city=run.mission===0;
  this.view.ambient.intensity=city?.94:1.12;
  this.view.sun.intensity=city?.55:.92;
  this.view.renderer.toneMappingExposure=city?1.28:1.33;
  this.flashlight.color.setHex(city?0xe9f1ff:p.light);
  this.flashlight.intensity=city?3:2.3;
 }
 decorate(run,p) {
  const v=this.view,city=run.mission===0;
  if(city){
   // Pools of amber street light and colder storefront spill create a readable night-time route.
   for(const [x,z,tone,r] of [[11,9,0xffbb73,15],[10,39,0xffca87,18],[70,53,0xffce9c,15],[19,26,0xffca85,23],[38,20,0xffdd9d,17],[53,34,0xa3ecff,16],[67,45,0xb1d5ff,20]]){
    this.pool(x*2,z*2,r,tone,.27);
   }
   this.lamp(20*2,3.55,26*2,0xffb66e,3.4,16);
   this.lamp(53*2,3.5,34*2,0x87dfff,3.1,17);
   for(const [x,z] of [[40,16],[55,19],[47,36]]){
    const l=this.lamp(x*2,3.45,z*2,0xff463d,0,10,true);
    this.pool(x*2,z*2,7,0xff3930,.11);
   }
   // Simple luminous canopy strips, always visible without per-window shadow maps.
   for(const [x,z,w] of [[19.2,26,7],[19.2,35,6],[53,13.1,10]]){
    const bar=v.box(v.world,x*2,3.05,z*2,w,.055,.075,0xffdfa4);
    bar.material.emissive.setHex(0xffbc72);bar.material.emissiveIntensity=2.1;
   }
  }else{
   const cols=run.grid[0].length,rows=run.grid.length;
   for(let z=3;z<rows-2;z+=7)for(let x=3;x<cols-2;x+=7){
    if(run.grid[z]?.[x]!=='#')this.pool(x*2,z*2,11,p.accent,.15,.025);
   }
   for(const [x,z] of [[3,3],[cols-4,rows-4]]){
    if(run.grid[z]?.[x]==='#')continue;
    this.lamp(x*2,2.8,z*2,0xff554b,0,12,true);
    this.pool(x*2,z*2,9,0xff443d,.12,.025);
   }
  }
 }
 detailEnemy(group,e) {
  const v=this.view,box=(x,y,z,w,h,d,c,m=0)=>v.box(group,x,y,z,w,h,d,c,m);
  this.shadow(group,e.type==='heavy'?1.9:1.4);
  if(e.type==='drone'){
   for(const x of [-.65,.65])for(const z of [-.65,.65]){
    const rotor=new THREE.Mesh(new THREE.TorusGeometry(.24,.027,5,16),new THREE.MeshStandardMaterial({color:0x7f9aa7,metalness:.7,roughness:.4}));
    rotor.rotation.x=Math.PI/2;rotor.position.set(x,2.22,z);group.add(rotor);
   }
   const lens=box(0,1.94,-.56,.32,.16,.08,0x46f5f4,.3);
   lens.material.emissive.setHex(0x35d9e8);lens.material.emissiveIntensity=1.7;
   return;
  }
  box(0,1.44,-.24,.61,.23,.16,e.type==='heavy'?0x323b42:0x4e5d65,.2);
  box(0,1.07,-.34,.45,.4,.09,e.type==='sniper'?0x65577c:0x202d37,.25);
  for(const s of [-1,1]){
   box(s*.22,.16,-.045,.32,.22,.48,0x1a2229,.05);
   box(s*.5,1.48,0,.26,.2,.38,e.type==='heavy'?0x4e5960:0x39444c,.35);
  }
  box(0,1.76,-.3,.46,.19,.13,0x202e34,.18);
  if(e.type==='sniper'){
   box(.16,1.38,-.7,.1,.1,.64,0x161e25,.65);
   box(.16,1.47,-.78,.16,.15,.2,0x3a4252,.65);
  }
  if(e.type==='heavy')box(0,1.17,.25,.72,.63,.2,0x566068,.65);
 }
 detailProp(group,kind) {
  const v=this.view;
  if(!['streetlamp','plant'].includes(kind))this.shadow(group,kind==='van'?5.4:kind==='car'?4.1:kind==='container'?4.5:1.9);
  if(kind==='car'||kind==='van'){
   const van=kind==='van',length=van?3.15:2.3;
   for(const x of [-1,1]){
    const light=v.box(group,x*(van?1.05:.88),.8,-length,.38,.17,.075,0xffe7bd);
    light.material.emissive.setHex(0xffd09c);light.material.emissiveIntensity=2;
    const tail=v.box(group,x*(van?1.08:.86),.83,length,.29,.2,.08,0xb6292e);
    tail.material.emissive.setHex(0xff2424);tail.material.emissiveIntensity=1.5;
   }
   v.box(group,0,van?1.75:1.49,van?1.4:.99,van?2.65:2.08,.65,.06,
    new THREE.MeshPhysicalMaterial({color:0x2d4d65,metalness:.3,roughness:.12,clearcoat:.8}));
  }else if(kind==='streetlamp'){
   const halo=v.box(group,0,5.03,1.04,.52,.045,.34,0xffd3a0);
   halo.material.emissive.setHex(0xffb36d);halo.material.emissiveIntensity=3;
  }else if(kind==='server'){
   const led=v.box(group,0,2.1,.79,.24,.055,.05,0x56f4e3);
   led.material.emissive.setHex(0x56f4e3);led.material.emissiveIntensity=2;
  }else if(kind==='generator'){
   const led=v.box(group,.87,1.4,.82,.12,.14,.06,0xffae39);
   led.material.emissive.setHex(0xffae39);led.material.emissiveIntensity=2.4;
  }
 }
 update(run,seconds){
  const a=Math.min(1,(run.alarm||0)/65);
  this.flashlight.intensity=(run.mission===0?3:2.3)*(1+.06*Math.sin(seconds*1.7));
  for(const {light,base} of this.alerts)
   light.intensity=a*(base+2.9)*(0.74+.26*Math.sin(seconds*7.3+light.position.x*.11)**2);
 }
 clear(){this.alerts=[];this.glows=[];this.lamps=[];}
 dispose(){
  for(const t of this.textures.values())t.dispose();
  this.textures.clear();this.canvases.clear();
  this.view.camera.remove(this.flashlight,this.flashlight.target);
 }
}
