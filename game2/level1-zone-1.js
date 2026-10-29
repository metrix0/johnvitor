import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';

// Zone 1 / Nightshift Market: parking, approach and south-facing storefront.
// All dimensions are metres in the existing world coordinate system (tile*CELL).
// Keep every detail inside this region so other level-area modules are independent.
export function buildLevel1Zone1(view,world,CELL){
 const t=n=>n*CELL;
 const opaque=(color,metalness=0,roughness=.8,emissive=0)=>new THREE.MeshStandardMaterial({color,metalness,roughness,emissive:emissive||0,emissiveIntensity:emissive ? .32 : 0});
 const black=opaque(0x1a2429,.35),frame=opaque(0x34444b,.6,.43),trim=opaque(0x98a9a5,.55,.45);
 const brick=opaque(0x816b57,.12,.92),concrete=opaque(0xa5a49a,.1,.88),warm=opaque(0xe2be83,.25,.55,0xc49148);
 const green=opaque(0x265246,.35,.5);
 const glass=new THREE.MeshPhysicalMaterial({color:0x86c8d3,metalness:.08,roughness:.13,transparent:true,opacity:.12,side:THREE.DoubleSide,depthWrite:false,clearcoat:.6});
 const tinted=new THREE.MeshPhysicalMaterial({color:0x63828a,metalness:.15,roughness:.19,transparent:true,opacity:.40,side:THREE.DoubleSide,depthWrite:false});
 const box=(x,y,z,w,h,d,m)=>{
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);mesh.position.set(x,y,z);
  mesh.castShadow=false;mesh.receiveShadow=true;world.add(mesh);return mesh;
 };
 const cyl=(x,y,z,r,h,m,segments=14)=>{
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,segments),m);
  mesh.position.set(x,y,z);world.add(mesh);return mesh;
 };
 const light=(color,power,range,x,y,z)=>{
  const obj=new THREE.PointLight(color,power,range,2);obj.position.set(x,y,z);
  world.add(obj);view.lights.push(obj);
 };
 // Mineral aggregate / weathered concrete procedural textures: no image/network dependency.
 function pavementMaterial(tone,asphalt){
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;
  const ctx=canvas.getContext('2d');ctx.fillStyle=asphalt?'#292d31':'#9a9b96';ctx.fillRect(0,0,256,256);
  let seed=asphalt?1829:8203;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  const count=asphalt?1450:800;
  for(let i=0;i<count;i++){
   const lum=asphalt?34+Math.floor(rnd()*55):119+Math.floor(rnd()*70);
   ctx.fillStyle='rgba('+lum+','+lum+','+(lum-2)+','+(asphalt?.38:.24)+')';
   const x=rnd()*256,y=rnd()*256,w=.5+rnd()*2.5;
   ctx.fillRect(x,y,w,.4+rnd()*1.6);
  }
  const tex=new THREE.CanvasTexture(canvas);tex.wrapS=tex.wrapT=THREE.RepeatWrapping;
  tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=4;
  tex.repeat.set(asphalt?7:4,asphalt?3:1.5);
  return new THREE.MeshStandardMaterial({color:tone,map:tex,roughness:.96,metalness:0});
 }
 const parkingMat=pavementMaterial(0xdddddd,true);
 const sidewalkMat=pavementMaterial(0xe6e7e3,false);
 // Asphalt sits exactly over the reference floor without glowing slabs.
 box(t(28),.04,t(40),t(36.2),.1,t(10),parkingMat);
 box(t(28),.107,t(35.12),t(33.6),.20,5.0,sidewalkMat);
 // Robust curb edges, inset seams and a wide barrier-free entrance ramp.
 box(t(28),.202,t(36.4),t(33.6),.12,.22,opaque(0x8f938d,.05,.88));
 for(let x=14;x<=43;x+=4.2)box(t(x),.214,t(35.14),.065,.015,4.8,opaque(0x6d7774,.08,.97));
 box(t(28.5),.187,t(36.4),7.7,.04,2.25,sidewalkMat);
 box(t(28.5),.218,t(36.54),6.3,.028,.39,opaque(0xc7b76c,.1,.88));
 for(let i=0;i<18;i++)box(t(27.1)+i*.32,.24,t(36.55),.11,.025,.16,opaque(0x94864c,.1,.88));
 // Parking bay stripe geometry lies on the asphalt plane with physically plausible stops.
 const paint=new THREE.MeshBasicMaterial({color:0xd5d8d1,transparent:true,opacity:.78,depthWrite:false});
 const faded=new THREE.MeshBasicMaterial({color:0xe4be71,transparent:true,opacity:.79,depthWrite:false});
 for(const x of [14,22,30,38,44]){
  box(t(x),.1,t(40.6),.12,.014,9.9,paint);
  box(t(x+3.8),.1,t(44.2),6.1,.012,.14,paint);
 }
 for(const x of [15.8,22.5,35.5,42])box(t(x),.123,t(37.6),2.7,.22,.5,concrete);
 // Slightly battered yellow bollards, each with reflective white collar and base.
 for(const x of [25.4,26.5,30.7,31.8]){
  const px=t(x),pz=t(35.7);
  cyl(px,.2,pz,.24,.32,black);
  cyl(px,.78,pz,.155,1.25,opaque(0xc9a33f,.4,.45));
  cyl(px,1.04,pz,.159,.14,opaque(0xe5d9aa,.16,.4));
  cyl(px,1.42,pz,.174,.12,opaque(0xa78b47,.5,.45));
 }
 // One contiguous dark aluminium storefront, not floating rectangular windows.
 // Window panes line up to the existing collision openings (z=33 tiles).
 const facadeZ=t(33)+1.04;
 for(const [lo,hi] of [[13.5,25],[32.8,43.5]]){
  const x1=t(lo),x2=t(hi),center=(x1+x2)/2,width=x2-x1;
  // No opaque backing behind panes: the furnished store stays visible from outside.
  box(center,2.33,facadeZ+.092,width-.30,2.85,.035,glass);
  box(center,.77,facadeZ+.14,width-.14,.13,.16,frame);
  box(center,3.87,facadeZ+.14,width-.14,.14,.18,frame);
  for(let x=x1+.1;x<x2-.1;x+=3.42){
   box(x,2.33,facadeZ+.13,.105,3.05,.20,frame);
   box(x,2.26,facadeZ+.171,.025,2.6,.025,trim);
  }
  box(center,2.18,facadeZ+.15,width,.09,.13,frame);
  // Store lit display backing only along sill, leaving clear views of actual merchandise.
  box(center,.46,facadeZ+.07,width,.61,.14,opaque(0x8c8a80,.2,.82));
  box(center,.73,facadeZ+.16,width-.3,.07,.16,trim);
 }
 // Glass sliding entry: leaves are visibly retracted and the central route remains clear.
 const center=t(28.5),left=t(26.7),right=t(30.7);
 box(left,2.18,facadeZ,.15,3.54,.26,frame);
 box(right,2.18,facadeZ,.15,3.54,.26,frame);
 box(center,3.94,facadeZ,8.5,.18,.27,frame);
 for(const [x,side] of [[t(27),-1],[t(30.35),1]]){
  box(x,2.23,facadeZ+.11,1.8,3.0,.045,tinted);
  box(x,2.2,facadeZ+.18,1.9,.07,.09,frame);
  box(x+(side*.92),2.2,facadeZ+.18,.065,3.04,.10,frame);
  box(x,1.15,facadeZ+.22,.16,.58,.06,trim);
 }
 // Soffit and awning are built into the roofline, supported by the façade.
 box(t(28),4.72,t(34.02),t(32),.27,2.9,opaque(0x444c4a,.45,.65));
 box(t(28),4.58,t(34.7),t(32),.18,.21,trim);
 box(t(28),4.40,t(34.66),t(32),.12,.16,opaque(0x887150,.36,.54));
 for(const x of [15.1,19.5,23.8,28,32.2,36.5,40.9]){
  const m=box(t(x),4.44,t(34.5),2.3,.08,.38,opaque(0xffe9c2,.08,.41,0xd4a15e));
  m.material.emissiveIntensity=.78;
 }
 // Fascia with ONLY one readable, physically mounted market wordmark.
 box(center,3.95,facadeZ+.32,17.5,1.0,.22,opaque(0x203137,.46,.47));
 box(center,4.52,facadeZ+.33,17.5,.07,.27,trim);
 box(center,3.39,facadeZ+.33,17.5,.055,.27,opaque(0xb0905e,.36,.58));
 const canvas=document.createElement('canvas');canvas.width=1536;canvas.height=192;
 const ctx=canvas.getContext('2d');
 ctx.clearRect(0,0,1536,192);ctx.fillStyle='#f7e6c7';
 ctx.font='900 125px Arial, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
 ctx.fillText('NIGHTSHIFT MARKET',768,96);
 const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;
 const signMat=new THREE.MeshBasicMaterial({map:tex,transparent:true,side:THREE.DoubleSide,depthWrite:false});
 const sign=new THREE.Mesh(new THREE.PlaneGeometry(16.4,1.13),signMat);
 sign.position.set(center,3.96,facadeZ+.49);world.add(sign);
 // Brick-faced end caps and front pillars continue down to the pavement.
 for(const x of [12.6,25.9,31.5,44.1]){
  box(t(x),2.2,facadeZ-.31,1.23,4.4,1.4,brick);
  for(let y=.48;y<=3.96;y+=.47){
   box(t(x),y,facadeZ+.43,1.16,.027,.037,opaque(0x50463e,.1,.94));
  }
  box(t(x),.44,facadeZ+.45,1.48,.85,.11,concrete);
  box(t(x),4.49,facadeZ+.3,1.48,.13,1.6,trim);
 }
 // Diffuse warm pool at doors; cool light through display windows.
 light(0xffcf8c,3.3,15,center,3.65,t(35.4));
 for(const x of [18.5,38.2])light(0xb4e7f0,2.1,14,t(x),3.05,t(34.4));
 // A lighted pole just outside the right bay, no unsupported cables.
 cyl(t(43.4),2.55,t(39.4),.09,5.1,frame);
 box(t(43.4),5.0,t(39.4)-.55,.16,.12,1.5,frame);
 const lamp=box(t(43.4),4.91,t(39.4)-1.2,.65,.07,.5,opaque(0xffe2a8,.1,.38,0xffbd70));
 lamp.material.emissiveIntensity=1.1;light(0xffc787,1.7,13,t(43.4),4.7,t(39.4)-1.15);
 // Ground-level litter and painted drainage, visually subordinate to navigation.
 for(const x of [17,24,37,41])box(t(x),.111,t(36.7),1.25,.027,.06,opaque(0x696d68,.2,.7));
 // Vehicle geometry is authored in this zone; no duplicate generic cars in render.prop.
 function vehicle(tileX,tileZ,van,bodyColor){
  const x=t(tileX),z=t(tileZ),body=opaque(bodyColor,.58,.38),dark=opaque(0x1d292b,.43,.5),rubber=opaque(0x12171a,.1,.95),chrome=opaque(0xc4caca,.77,.29);
  const width=van?2.85:2.55,length=van?5.7:4.65;
  box(x,.77,z,width,1.06,length,body);
  box(x,van?1.83:1.46,z+(van?.25:.34),width-.22,van?1.33:.55,van?3.72:2.55,body);
  // Hood, trunk and protective bumpers are separate from the passenger compartment.
  box(x,.86,z-length/2+.54,width-.14,.35,1.05,body);
  box(x,.81,z+length/2-.24,width+.12,.28,.25,dark);
  box(x,.78,z-length/2-.05,width+.15,.26,.22,dark);
  if(van){
   for(const xx of [-1,1])box(x+xx*1.02,1.79,z+.35,.045,.8,2.1,dark);
   box(x,1.65,z-1.68,width-.55,.86,.049,tinted);
   box(x,2.5,z+.2,width-.48,.085,3.5,dark);
  }else{
   box(x,1.64,z-.65,width-.45,.48,.055,tinted);
   box(x,1.56,z+1.58,width-.5,.42,.055,tinted);
   box(x,1.58,z+.35,width-.15,.05,2.25,body);
  }
  for(const xx of [-1,1]){
   for(const zz of [-1,1]){
    const wz=z+zz*(van?1.85:1.42),wx=x+xx*(width/2+.055);
    const tyre=new THREE.Mesh(new THREE.CylinderGeometry(.43,.43,.23,14),rubber);
    tyre.rotation.z=Math.PI/2;tyre.position.set(wx,.46,wz);world.add(tyre);
    const hub=new THREE.Mesh(new THREE.CylinderGeometry(.24,.24,.245,12),chrome);
    hub.rotation.z=Math.PI/2;hub.position.set(wx,.46,wz);world.add(hub);
   }
   box(x+xx*(width*.34),.88,z-length/2-.15,.42,.21,.055,opaque(0xd9e9df,.25,.33,0x645d42));
   box(x+xx*(width*.34),.89,z+length/2+.15,.43,.18,.056,opaque(0xaa3532,.24,.42,0x4c1511));
   box(x+xx*(width*.52),1.29,z-.75,.18,.14,.28,dark);
  }
  box(x,.67,z-length/2-.175,.58,.12,.055,chrome);
  if(van){
   box(x,1.06,z+length/2+.16,1.4,.55,.07,opaque(0xd6d5c6));
   box(x,.78,z-length/2-.19,.73,.14,.055,opaque(0xdcd8c4));
   box(x,.86,z+length/2+.19,.81,.14,.055,opaque(0xf4e6bd));
   box(x,1.24,z+length/2+.19,width-.2,.08,.06,green);
  }
 }
 vehicle(15,40,true,0x60746b);
 vehicle(34,40,false,0x414c57);
 vehicle(45,40,false,0x6c746f);
}
