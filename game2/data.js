// GETAWAY CLUB / mission and equipment definitions. All coordinates are authored in tiles.
export const CELL = 2;
export const WIDTH = 27;
export const HEIGHT = 19;
export const WEAPONS = {
  pistol: {name:'M9 SIDEARM',class:'SIDEARM',unlock:0,damage:29,rate:.24,mag:15,reserve:90,reload:1.25,spread:.022,range:35,pellets:1,color:0xb8c1b8},
  smg: {name:'VECTOR 9',class:'SMG',unlock:1,damage:17,rate:.085,mag:32,reserve:192,reload:1.65,spread:.050,range:29,pellets:1,color:0xd1c0a1},
  shotgun: {name:'BREACHER 12',class:'SHOTGUN',unlock:2,damage:14,rate:.72,mag:8,reserve:56,reload:2,spread:.16,range:19,pellets:8,color:0xcaa474},
  rifle: {name:'MK18 CARBINE',class:'ASSAULT',unlock:3,damage:34,rate:.145,mag:30,reserve:150,reload:1.9,spread:.026,range:50,pellets:1,color:0xbac9d1},
  dmr: {name:'GHOST DMR',class:'MARKSMAN',unlock:4,damage:78,rate:.68,mag:12,reserve:72,reload:2.2,spread:.008,range:68,pellets:1,color:0xe3d8c3}
};
export const GADGETS = {
  smoke:{name:'SMOKE',unlock:1,charges:2,description:'Break sightlines for eight seconds.'},
  med:{name:'MED KIT',unlock:2,charges:2,description:'Restore health to yourself or a nearby teammate.'},
  emp:{name:'EMP',unlock:3,charges:2,description:'Disable drones, turrets and cameras for six seconds.'}
};
export const UPGRADES = {
  armor:{name:'BALLISTIC VEST',desc:'+25 maximum health per tier',cost:[200,350,550],icon:'◈'},
  damage:{name:'ARMOR-PIERCING',desc:'+13% weapon damage per tier',cost:[240,400,650],icon:'✳'},
  mag:{name:'EXTENDED MAG',desc:'+20% magazine size per tier',cost:[180,300,500],icon:'▤'}
};
export const MISSIONS = [
 {id:'bodega',number:'01',name:'AFTER HOURS',site:'EASTSIDE MARKET',type:'CORNER STORE',tag:'THE FIRST SCORE',description:'A late-night corner store. Sweep the aisles, crack the registers, and leave before the neighborhood patrol arrives.',theme:'store',accent:'#ffcf79',payout:350,reinforce:48,alarmRate:.10,
  walls:[[7,1,1,5],[7,9,1,9],[16,1,1,6],[16,10,1,8]], 
  decor:[[4,4,'shelf'],[4,7,'shelf'],[4,11,'shelf'],[11,4,'shelf'],[11,11,'shelf'],[20,5,'counter'],[21,11,'fridge'],[23,4,'fridge'],[12,15,'crate']],
  spawn:[2,8],exit:[24,16],enemies:[[11,8,'guard'],[20,9,'guard'],[22,14,'rusher']],
  objectives:[{id:'register-a',at:[5,15],name:'Front register',kind:'cash',duration:1.1},{id:'register-b',at:[20,4],name:'Back register',kind:'cash',duration:1.4},{id:'safe',at:[23,13],name:'Office safe',kind:'safe',duration:3,requires:['register-a','register-b']}],
  completion:'The Vector 9 SMG and smoke grenades are now available.'},
 {id:'offices',number:'02',name:'THE PAPER TRAIL',site:'HALCYON PLAZA',type:'OFFICE BUILDING',tag:'CORPORATE ESPIONAGE',description:'A corporate office after midnight. Steal the access badge, copy the finance files, then find the courier package.',theme:'office',accent:'#7fdcf3',payout:600,reinforce:35,alarmRate:.14,
  walls:[[6,2,1,6],[6,11,1,6],[13,1,1,5],[13,9,1,8],[20,3,1,6],[20,12,1,5]],
  decor:[[3,4,'desk'],[3,14,'desk'],[9,3,'desk'],[9,13,'desk'],[16,6,'desk'],[16,14,'desk'],[23,5,'desk'],[23,14,'desk'],[10,9,'plant'],[18,10,'plant']],
  spawn:[2,9],exit:[24,2],enemies:[[8,6,'guard'],[12,14,'sniper'],[18,5,'guard'],[23,9,'rusher'],[22,15,'guard']],
  objectives:[{id:'badge',at:[3,4],name:'Security badge',kind:'keycard',duration:1.3},{id:'server',at:[17,14],name:'Finance workstation',kind:'hack',duration:3.5,requires:['badge']},{id:'package',at:[23,15],name:'Courier package',kind:'case',duration:1.8,requires:['server']}],
  completion:'The Breacher 12 shotgun and med kits are unlocked.'},
 {id:'datacenter',number:'03',name:'GHOST IN THE MACHINE',site:'NEBULA DATA CAMPUS',type:'DATA CENTER',tag:'BLACKOUT PROTOCOL',description:'Slip through the server farm. Disable the alarm relay, extract the encrypted data, and escape the security drones.',theme:'data',accent:'#8af7d0',payout:850,reinforce:29,alarmRate:.17,
  walls:[[5,1,1,6],[5,10,1,8],[11,2,1,6],[11,11,1,7],[17,1,1,6],[17,10,1,8],[23,3,1,6],[23,12,1,5]],
  decor:[[3,4,'server'],[3,12,'server'],[8,4,'server'],[8,13,'server'],[14,4,'server'],[14,13,'server'],[20,4,'server'],[20,14,'server'],[25,9,'server']],
  spawn:[2,8],exit:[25,17],enemies:[[8,8,'drone'],[10,15,'guard'],[15,8,'guard'],[18,12,'drone'],[21,6,'sniper'],[24,15,'heavy']],
  objectives:[{id:'relay',at:[3,15],name:'Alarm relay',kind:'hack',duration:3},{id:'rack',at:[14,13],name:'Encrypted drive array',kind:'hack',duration:4.2,requires:['relay']},{id:'backup',at:[25,5],name:'Cold backup drive',kind:'data',duration:2,requires:['rack']}],
  completion:'The MK18 carbine and EMP charges are unlocked.'},
 {id:'penthouse',number:'04',name:'SKYLINE ZERO',site:'VANTAGE TOWER',type:'HIGH-RISE',tag:'THE VERTICAL JOB',description:'The penthouse is on lockdown. Find the lift override, eliminate the security network, and steal the executive cipher.',theme:'tower',accent:'#ffa5c1',payout:1250,reinforce:24,alarmRate:.21,
  walls:[[6,1,1,6],[6,10,1,8],[12,3,1,7],[12,13,1,5],[18,1,1,7],[18,11,1,7]],
  decor:[[3,3,'sofa'],[3,13,'plant'],[9,4,'desk'],[9,15,'desk'],[15,3,'plant'],[15,14,'sofa'],[22,4,'desk'],[22,13,'desk'],[24,9,'plant']],
  spawn:[2,8],exit:[24,2],enemies:[[8,9,'rusher'],[10,3,'guard'],[13,12,'drone'],[16,9,'heavy'],[21,4,'sniper'],[23,13,'rusher'],[24,8,'drone']],
  objectives:[{id:'elevator',at:[3,15],name:'Lift override',kind:'hack',duration:3.2},{id:'network',at:[15,4],name:'Security network',kind:'hack',duration:3.8,requires:['elevator']},{id:'cipher',at:[24,15],name:'Executive cipher',kind:'case',duration:2.3,requires:['network']}],
  completion:'The Ghost DMR is unlocked. One job remains: the grand bank.'},
 {id:'bank',number:'05',name:'THE GRAND FINALE',site:'CENTRAL RESERVE',type:'THE BANK',tag:'THE BIG ONE',description:'Break into the reserve, steal two keycards, start the vault drill, survive the lockdown and carry the gold to the getaway.',theme:'bank',accent:'#ffda8b',payout:2000,reinforce:18,alarmRate:.26,
  walls:[[7,1,1,6],[7,10,1,8],[15,2,1,6],[15,11,1,7],[21,2,1,5],[21,10,1,8]],
  decor:[[3,4,'column'],[3,14,'column'],[10,4,'counter'],[10,14,'counter'],[18,4,'column'],[18,14,'column'],[24,8,'vault'],[24,12,'gold'],[24,14,'gold']],
  spawn:[2,8],exit:[2,16],enemies:[[9,6,'guard'],[11,14,'sniper'],[16,9,'heavy'],[18,5,'drone'],[21,14,'guard'],[23,8,'heavy'],[24,16,'rusher'],[13,4,'drone'],[20,10,'sniper']],
  objectives:[{id:'blue',at:[4,3],name:'Blue keycard',kind:'keycard',duration:1.5},{id:'red',at:[19,15],name:'Red keycard',kind:'keycard',duration:1.5},{id:'vault',at:[24,8],name:'Vault drill',kind:'drill',duration:6,requires:['blue','red']},{id:'gold',at:[24,13],name:'Reserve gold',kind:'gold',duration:2.7,requires:['vault']}],
  completion:'The city will remember this crew. Campaign complete.'}
];
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function makeGrid(mission){
  const grid=Array.from({length:HEIGHT},(_,z)=>Array.from({length:WIDTH},(_,x)=>x===0||z===0||x===WIDTH-1||z===HEIGHT-1?'#':'.'));
  for(const [x,z,w,h] of mission.walls)for(let iz=z;iz<z+h;iz++)for(let ix=x;ix<x+w;ix++)if(grid[iz]?.[ix])grid[iz][ix]='#';
  return grid;
}
export const pos=([x,z])=>({x:x*CELL,z:z*CELL});
export function profileDefaults(name){return {name,unlocked:0,completed:false,earned:0,spent:0,upgrades:{armor:0,damage:0,mag:0},cleared:[],best:{}};}
export function normalizeProfile(raw,name){
 const p=profileDefaults(name),r=raw&&typeof raw==='object'?raw:{};
 p.unlocked=clamp(Math.floor(Number(r.unlocked)||0),0,4);
 p.completed=r.completed===true;
 p.earned=clamp(Math.floor(Number(r.earned)||0),0,9999999);
 p.spent=clamp(Math.floor(Number(r.spent)||0),0,p.earned);
 for(const k of Object.keys(UPGRADES))p.upgrades[k]=clamp(Math.floor(Number(r.upgrades?.[k])||0),0,3);
 p.cleared=Array.isArray(r.cleared)?r.cleared.filter(v=>MISSIONS.some(m=>m.id===v)).slice(0,5):[];
 p.best=r.best&&typeof r.best==='object'?r.best:{};
 return p;
}
export function availableWeapons(profile){return Object.entries(WEAPONS).filter(([,w])=>w.unlock<=profile.unlocked);}
export function availableGadgets(profile){return Object.entries(GADGETS).filter(([,g])=>g.unlock<=profile.unlocked);}
