// Developer navigation palette for the disposable /game2/test session only.
// This file is never imported by normal game routes and evaluates no arbitrary code.
const AREAS = [
 {id:'entrance',name:'Entrance',x:28,z:38,yaw:0},
 {id:'parking',name:'Parking lot',x:28,z:41,yaw:0},
 {id:'aisles',name:'Grocery aisles',x:28,z:23,yaw:0},
 {id:'drinks',name:'Cold drinks',x:16,z:23,yaw:90},
 {id:'checkout',name:'Checkout',x:28,z:31,yaw:0},
 {id:'stockroom',name:'Stockroom',x:18,z:13,yaw:180},
 {id:'office',name:'Manager office',x:30,z:12,yaw:180},
 {id:'restroom',name:'Restroom',x:40,z:12,yaw:180},
 {id:'delivery',name:'Delivery bay',x:8,z:21,yaw:-90},
 {id:'alley',name:'Side alley',x:50,z:23,yaw:90},
 {id:'side-door',name:'Staff entrance',x:48,z:12,yaw:90}
];
const HELP = [
 'goto <area>    Jump to a named map area',
 'tp <x> <z>     Teleport to tile coordinates',
 'look <yaw> [pitch]   Aim camera in degrees',
 'where          Show your current location and camera',
 'hud off/on     Hide or restore gameplay HUD for screenshots',
 'reset          Jump back to the parking-lot spawn',
 'restart        Restart the temporary Level 1 run',
 'clear          Clear command output',
 'help           Show this command reference'
].join('\n');
const ALIASES = {front:'entrance',market:'entrance',shop:'aisles',groceries:'aisles',shelves:'aisles',cold:'drinks',fridge:'drinks',register:'checkout',counter:'checkout',stock:'stockroom',backroom:'office',bathroom:'restroom',loading:'delivery',staff:'side-door'};
const toNumber = value => value!=='' && Number.isFinite(Number(value)) ? Number(value) : null;
const label = (n) => Number(n).toFixed(1);

export function createDevConsole({getPosition,teleport,aim,onOpen,onClose,onHudToggle}){
 const root=document.createElement('div');
 root.className='devConsoleRoot';
 root.innerHTML=`
  <button type="button" class="devConsoleLauncher" aria-controls="devConsolePanel" aria-expanded="false">
   <span class="devConsoleDot"></span> DEV CONSOLE <kbd>~</kbd>
  </button>
  <section class="devConsolePanel hidden" id="devConsolePanel" aria-label="Level 1 developer navigation console">
   <header><div><small>LEVEL 1 / TEST MODE</small><strong>MAP INSPECTOR</strong></div><button class="devConsoleClose" type="button" aria-label="Close developer console">×</button></header>
   <div class="devConsolePosition" aria-live="off">POSITION —</div>
   <div class="devConsoleLocations"><small>TELEPORT TO AREA</small><div class="devConsoleGrid"></div></div>
   <div class="devConsoleHistory" role="log" aria-live="polite"></div>
   <form class="devConsoleForm"><span>&gt;</span><input class="devConsoleCommand" type="text" spellcheck="false" autocapitalize="off" autocomplete="off" placeholder="goto aisles · tp 28 22 · help" aria-label="Developer console command"><button type="submit">RUN</button></form>
   <footer>~ / F2 TO TOGGLE · ESC TO CLOSE · COMMANDS ARE LOCAL-ONLY</footer>
  </section>`;
 document.getElementById('gameScreen').append(root);
 const launcher=root.querySelector('.devConsoleLauncher');
 const panel=root.querySelector('.devConsolePanel');
 const closeButton=root.querySelector('.devConsoleClose');
 const history=root.querySelector('.devConsoleHistory');
 const form=root.querySelector('.devConsoleForm');
 const input=root.querySelector('.devConsoleCommand');
 const position=root.querySelector('.devConsolePosition');
 let opened=false,historyCommands=[],index=0;
 const log=(message,kind='info')=>{
  const line=document.createElement('div');line.className='devConsoleLog devConsoleLog--'+kind;
  line.textContent=message;history.append(line);
  while(history.children.length>38)history.firstElementChild.remove();
  history.scrollTop=history.scrollHeight;
 };
 const locate=()=>{
  const p=getPosition();
  if(!p){position.textContent='POSITION — NO ACTIVE RUN';return;}
  position.textContent=`X ${label(p.x)}  /  Z ${label(p.z)}  ·  YAW ${label(p.yaw)}°  PITCH ${label(p.pitch)}°`;
 };
 const enter=(area)=>{
  const result=teleport(area.x,area.z);
  if(result!==true){log(String(result||'Teleport unavailable'),'error');return false;}
  aim(area.yaw,0);
  log(`→ ${area.name} (${area.x}, ${area.z}) / heading ${area.yaw}°`,'success');
  locate();return true;
 };
 for(const area of AREAS){
  const button=document.createElement('button');button.type='button';
  button.textContent=area.name;button.addEventListener('click',()=>enter(area));
  root.querySelector('.devConsoleGrid').append(button);
 }
 const runCommand=text=>{
  const command=text.trim();
  if(!command)return;
  log('> '+command,'command');
  const [verb,...args]=command.split(/\s+/),op=verb.toLowerCase();
  if(op==='help'||op==='?'){log(HELP);return;}
  if(op==='clear'){history.replaceChildren();return;}
  if(op==='where'||op==='pos'||op==='coords'){
   locate();log(position.textContent,'success');return;
  }
  if(op==='goto'||op==='go'){
   const query=args.join(' ').trim().toLowerCase().replace(/\s+/g,'-');
   const id=ALIASES[query]||query,area=AREAS.find(a=>a.id===id);
   if(!area){log('Unknown area. Use help or one of the area buttons.','error');return;}
   enter(area);return;
  }
  if(op==='tp'||op==='teleport'){
   const x=toNumber(args[0]??''),z=toNumber(args[1]??'');
   if(args.length!==2||x===null||z===null){log('Usage: tp <x> <z>  (tile coordinates)','error');return;}
   const result=teleport(x,z);
   if(result!==true)log(String(result||'Teleport unavailable'),'error');
   else {locate();log(`→ X ${label(x)} / Z ${label(z)}`,'success');}
   return;
  }
  if(op==='look'||op==='face'){
   const yaw=toNumber(args[0]??''),pitch=toNumber(args[1]??'0');
   if(args.length<1||args.length>2||yaw===null||pitch===null){log('Usage: look <yaw> [pitch]  (degrees)','error');return;}
   aim(yaw,pitch);locate();log(`→ Looking yaw ${label(yaw)}°, pitch ${label(pitch)}°`,'success');return;
  }
  if(op==='hud'){
   if(args.length!==1||!['on','off'].includes(args[0].toLowerCase())){log('Usage: hud on | hud off','error');return;}
   onHudToggle(args[0].toLowerCase()==='on');log('Gameplay HUD '+args[0].toLowerCase(),'success');return;
  }
  if(op==='reset'){enter(AREAS[1]);return;}
  if(op==='restart'){location.reload();return;}
  log('Unknown command. Type help for available commands.','error');
 };
 form.addEventListener('submit',event=>{
  event.preventDefault();const command=input.value.trim();
  if(!command)return;
  historyCommands.push(command);index=historyCommands.length;input.value='';
  runCommand(command);input.focus();
 });
 input.addEventListener('keydown',event=>{
  if(event.key==='ArrowUp'||event.key==='ArrowDown'){
   event.preventDefault();
   index=Math.max(0,Math.min(historyCommands.length,index+(event.key==='ArrowUp'?-1:1)));
   input.value=historyCommands[index]||'';input.setSelectionRange(input.value.length,input.value.length);
  }
 });
 const close=()=>{
  if(!opened)return;
  opened=false;panel.classList.add('hidden');launcher.setAttribute('aria-expanded','false');
  onClose?.();
 };
 const open=()=>{
  if(opened)return;
  opened=true;panel.classList.remove('hidden');launcher.setAttribute('aria-expanded','true');
  onOpen?.();locate();input.focus();
 };
 launcher.addEventListener('click',()=>opened?close():open());
 closeButton.addEventListener('click',close);
 log('Local-only developer commands ready. Pick an area or type help.','success');
 return {open,close,toggle:()=>opened?close():open(),isOpen:()=>opened,update:()=>{if(opened)locate();}};
}
