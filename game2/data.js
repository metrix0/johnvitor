import {LEVEL1,makeLevel1Grid} from './level1.js?v=7';
// GETAWAY CLUB / mission and equipment definitions. All coordinates are authored in tiles.
export const CELL = 2;
export const WIDTH = 27;
export const HEIGHT = 19;
export const WEAPONS = {
  pistol: {name:'M9 SIDEARM',class:'SIDEARM',unlock:0,cost:0,damage:29,rate:.24,mag:15,reserve:90,reload:1.25,spread:.022,range:35,pellets:1,color:0xb8c1b8,description:'Free issued backup. Reliable, but no match for upgraded gear.'},
  compact: {name:'KITE .45',class:'SIDEARM',unlock:0,cost:150,damage:40,rate:.28,mag:12,reserve:72,reload:1.15,spread:.026,range:32,pellets:1,color:0xe4c49b,description:'Hard-hitting close-range sidearm.'},
  revolver: {name:'JUDGE .357',class:'HAND CANNON',unlock:0,cost:260,damage:78,rate:.56,mag:6,reserve:48,reload:1.8,spread:.013,range:44,pellets:1,armorPen:.5,color:0xccc3b1,description:'Six precise rounds; punches through heavy armor.'},
  smg: {name:'VECTOR 9',class:'SMG',unlock:1,cost:390,damage:17,rate:.085,mag:32,reserve:192,reload:1.65,spread:.050,range:29,pellets:1,color:0xd1c0a1,description:'Rapid room-clearing fire with high ammo capacity.'},
  silenced: {name:'WHISPER MP5',class:'SUPPRESSED',unlock:1,cost:460,damage:23,rate:.11,mag:28,reserve:168,reload:1.5,spread:.023,range:38,pellets:1,noise:.16,color:0x83999a,description:'Low signature fire; keeps the security alarm down.'},
  burst: {name:'KRAIT-3',class:'BURST CARBINE',unlock:1,cost:510,damage:21,rate:.32,mag:27,reserve:162,reload:1.75,spread:.025,range:47,pellets:1,burst:3,color:0x9dbbb9,description:'Three rounds per trigger cycle for controlled bursts.'},
  shotgun: {name:'BREACHER 12',class:'SHOTGUN',unlock:2,cost:590,damage:14,rate:.72,mag:8,reserve:56,reload:2,spread:.16,range:19,pellets:8,color:0xcaa474,description:'Eight damaging pellets devastate nearby targets.'},
  autoshotgun: {name:'MAULER AUTO',class:'AUTO SHOTGUN',unlock:2,cost:790,damage:10,rate:.28,mag:12,reserve:72,reload:2.45,spread:.19,range:17,pellets:7,color:0xd3ad87,description:'Fast repeated blasts with wide room coverage.'},
  rifle: {name:'MK18 CARBINE',class:'ASSAULT',unlock:3,cost:820,damage:34,rate:.145,mag:30,reserve:150,reload:1.9,spread:.026,range:50,pellets:1,armorPen:.2,color:0xbac9d1,description:'Balanced range, control and medium armor penetration.'},
  lmg: {name:'HAMMER LMG',class:'SUPPORT',unlock:3,cost:1130,damage:31,rate:.125,mag:72,reserve:216,reload:3.5,spread:.056,range:45,pellets:1,armorPen:.25,color:0x999d79,description:'Sustained fire with massive magazines and slow reloads.'},
  dmr: {name:'GHOST DMR',class:'MARKSMAN',unlock:4,cost:1080,damage:78,rate:.68,mag:12,reserve:72,reload:2.2,spread:.008,range:68,pellets:1,armorPen:.7,color:0xe3d8c3,description:'Accurate long-range stopping power.'},
  sniper: {name:'LANCER .50',class:'ANTI-MATERIEL',unlock:4,cost:1420,damage:160,rate:1.35,mag:5,reserve:35,reload:2.9,spread:.002,range:95,pellets:1,armorPen:1,color:0xe9d6ba,description:'Single-shot eliminations and full heavy armor penetration.'}
};
export const GADGETS = {
  smoke:{name:'SMOKE GRENADE',unlock:0,cost:120,charges:2,description:'Two clouds block enemy sightlines for eight seconds.'},
  med:{name:'TRAUMA KIT',unlock:0,cost:145,charges:2,description:'Heal yourself or a nearby wounded teammate by 65 HP.'},
  flash:{name:'FLASHBANG',unlock:0,cost:160,charges:2,description:'Blind nearby enemies, stopping them for four seconds.'},
  frag:{name:'FRAG GRENADE',unlock:1,cost:230,charges:2,description:'High explosive damages groups of enemies in cover-free range.'},
  ammo:{name:'AMMO SATCHEL',unlock:1,cost:170,charges:2,description:'Refill ammunition for yourself and nearby teammates.'},
  emp:{name:'EMP CHARGE',unlock:2,cost:250,charges:2,description:'Disable nearby drones and security sensors for six seconds.'},
  jammer:{name:'SIGNAL JAMMER',unlock:2,cost:215,charges:2,description:'Suppress alarm growth and surveillance for 12 seconds.'},
  shield:{name:'ARMOR PLATE',unlock:3,cost:275,charges:2,description:'Reduce incoming damage by 65% for eight seconds.'},
  decoy:{name:'SOUND DECOY',unlock:3,cost:185,charges:2,description:'Pull guards away from your position for ten seconds.'},
  mine:{name:'TRIP MINE',unlock:4,cost:310,charges:2,description:'Set a proximity mine that explodes when enemies approach.'}
};
export const UPGRADES = {
  armor:{name:'BALLISTIC VEST',desc:'+25 maximum health per tier',cost:[200,350,550],icon:'◈'},
  damage:{name:'ARMOR-PIERCING',desc:'+13% weapon damage per tier',cost:[240,400,650],icon:'✳'},
  mag:{name:'EXTENDED MAG',desc:'+20% magazine size per tier',cost:[180,300,500],icon:'▤'}
};
export const MISSIONS = [
 LEVEL1,
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
  if(mission.id==='bodega')return makeLevel1Grid();
  const grid=Array.from({length:HEIGHT},(_,z)=>Array.from({length:WIDTH},(_,x)=>x===0||z===0||x===WIDTH-1||z===HEIGHT-1?'#':'.'));
  for(const [x,z,w,h] of mission.walls)for(let iz=z;iz<z+h;iz++)for(let ix=x;ix<x+w;ix++)if(grid[iz]?.[ix])grid[iz][ix]='#';
  return grid;
}
export const pos=([x,z])=>({x:x*CELL,z:z*CELL});
export function profileDefaults(name){return {name,unlocked:0,completed:false,earned:0,spent:0,upgrades:{armor:0,damage:0,mag:0},weapons:['pistol'],gadgetStock:{},gearRev:0,gearUpdatedAt:0,cleared:[],best:{}};}
export function normalizeProfile(raw,name){
 const p=profileDefaults(name),r=raw&&typeof raw==='object'?raw:{};
 p.unlocked=clamp(Math.floor(Number(r.unlocked)||0),0,4);
 p.completed=r.completed===true;
 p.earned=clamp(Math.floor(Number(r.earned)||0),0,9999999);
 p.spent=clamp(Math.floor(Number(r.spent)||0),0,p.earned);
 for(const k of Object.keys(UPGRADES))p.upgrades[k]=clamp(Math.floor(Number(r.upgrades?.[k])||0),0,3);
 p.weapons=['pistol',...new Set((Array.isArray(r.weapons)?r.weapons:[]).filter(id=>id!=='pistol'&&WEAPONS[id]))];
 for(const id of Object.keys(GADGETS)){const qty=clamp(Math.floor(Number(r.gadgetStock?.[id])||0),0,30);if(qty>0)p.gadgetStock[id]=qty;}
 p.gearRev=clamp(Math.floor(Number(r.gearRev)||0),0,999999999);
 p.gearUpdatedAt=clamp(Math.floor(Number(r.gearUpdatedAt)||0),0,9999999999999);
 p.cleared=Array.isArray(r.cleared)?r.cleared.filter(v=>MISSIONS.some(m=>m.id===v)).slice(0,5):[];
 p.best=r.best&&typeof r.best==='object'?r.best:{};
 return p;
}
export function availableWeapons(profile){return Object.entries(WEAPONS).filter(([,w])=>w.unlock<=profile.unlocked);}
export function availableGadgets(profile){return Object.entries(GADGETS).filter(([,g])=>g.unlock<=profile.unlocked);}
