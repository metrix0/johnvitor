// AFTER HOURS / expanded introductory heist: an entire connected city block.
// Coordinates use the same 2-metre tile units as the campaign.
export const LEVEL1_SIZE={width:74,height:58};
export const LEVEL1_ZONES=[
 {name:'NEON AVENUE',x:1,z:1,w:18,h:55,floor:0x1d2935},
 {name:'SERVICE ALLEY',x:18,z:1,w:46,h:11,floor:0x263039},
 {name:'NIGHTSHIFT MARKET',x:21,z:13,w:23,h:29,floor:0x66594b},
 {name:'STAFF OFFICES',x:45,z:13,w:16,h:16,floor:0x35444b},
 {name:'STOCKROOM',x:45,z:29,w:16,h:13,floor:0x3b3f3d},
 {name:'LOADING YARD',x:62,z:12,w:11,h:44,floor:0x293138},
 {name:'REAR COURTYARD',x:19,z:44,w:43,h:12,floor:0x28323a}
];
const edges=[
 // Long store facade, three distinct ways inside.
 [20,12,42,1,[[36,39]]],
 [20,43,42,1,[[45,48]]],
 [20,13,1,30,[[24,28]]],
 [61,13,1,30,[[34,38]]],
 // Internal shop / office division and office security corridor.
 [44,13,1,17,[[19,22],[26,28]]],
 [45,28,16,1,[[49,52]]],
 [51,29,1,14,[[35,38]]],
 // Stockroom side cages. Doors face a wide central service aisle.
 [52,32,9,1,[[55,58]]],
 [52,40,9,1,[[56,59]]],
 // Office partitions and meeting rooms.
 [46,20,15,1,[[50,53],[56,58]]],
 [53,14,1,14,[[23,26]]],
 // Shipping yard walls and cover with alternative navigation routes.
 [65,21,1,11,[[25,28]]],
 [66,40,1,12,[[45,49]]],
 [28,47,1,8,[[51,54]]]
];
const fixtures=[
 // Grocery aisles, spaced so firefights have usable cover and flanking routes.
 [25,17,'shelf'],[25,22,'shelf'],[25,31,'shelf'],[25,37,'shelf'],
 [31,17,'shelf'],[31,24,'shelf'],[31,34,'shelf'],[37,17,'shelf'],
 [37,24,'shelf'],[37,34,'shelf'],[22,30,'counter'],[39,38,'counter'],
 [40,15,'fridge'],[38,40,'fridge'],[30,40,'fridge'],
 // Management offices, monitors, filing cabinets.
 [47,15,'desk'],[49,24,'desk'],[57,15,'desk'],[58,25,'desk'],
 [46,25,'plant'],[60,18,'plant'],[56,26,'filing'],[58,22,'filing'],
 // Cargo warehouse with stacked stock, cages, pallets and machinery.
 [47,32,'crate'],[47,37,'crate'],[55,31,'crate'],[59,34,'crate'],
 [56,39,'safe'],[48,40,'pallet'],[49,34,'pallet'],
 // Street furniture and distinct street silhouettes.
 [5,7,'car'],[10,14,'car'],[5,34,'car'],[13,43,'car'],
 [9,51,'van'],[10,39,'streetlamp'],[11,9,'streetlamp'],
 [13,19,'tree'],[13,32,'tree'],[14,52,'tree'],[4,20,'barrier'],
 // Alleys, external equipment and loading dock obstacles.
 [23,5,'dumpster'],[33,5,'dumpster'],[49,5,'generator'],
 [61,6,'container'],[67,16,'container'],[67,36,'pallet'],
 [69,46,'container'],[55,49,'dumpster'],[37,50,'car'],
 [43,52,'barrier'],[70,53,'streetlamp'],
];
const accents=[
 {text:'NIGHTSHIFT',x:40,z:12.08,y:2.6,size:6.2,rot:0,color:'#fff2d4'},
 {text:'MARKET + DELI',x:40,z:43.06,y:2.65,size:4.5,rot:Math.PI,color:'#ffe39c'},
 {text:'EMPLOYEES ONLY',x:44.95,z:24,y:2.3,size:3,rot:Math.PI/2,color:'#b6f6fb'},
 {text:'LOADING DOCK 03',x:61.2,z:39,y:2.4,size:3.3,rot:Math.PI/2,color:'#b1cbe6'},
 {text:'EASTSIDE · 02:17 AM',x:8,z:56.1,y:2.6,size:5.8,rot:0,color:'#90b9e8'},
 {text:'WAREHOUSE',x:50,z:42.85,y:2.4,size:3.4,rot:0,color:'#f1ca8f'}
];
export const LEVEL1={
 id:'bodega',number:'01',name:'AFTER HOURS',site:'NIGHTSHIFT MARKET',type:'CITY-BLOCK HEIST',tag:'ONE NIGHT. SIX DISTRICTS.',
 description:'2:17 AM. A corner store hides a cash-transfer operation. Scope out the block, infiltrate the shop, breach the offices, crack the warehouse safe, haul the bags through the city and survive until your driver arrives. An optional security hack and extra register cash are worth the detour.',
 theme:'store',accent:'#ffcf79',payout:800,reinforce:27,alarmRate:.018,
 size:LEVEL1_SIZE,zones:LEVEL1_ZONES,edgeSpecs:edges,decor:fixtures,signs:accents,
 spawn:[7,26],exit:[9,49],dropoff:[9,49],waveSpawns:[[68,48],[68,14],[31,5],[9,6],[39,54],[69,53]],
 enemies:[
  [29,18,'guard'],[42,29,'guard'],[51,17,'guard'],[56,36,'guard'],
  [58,24,'sniper'],[67,27,'rusher'],[34,48,'guard'],[63,7,'guard'],
  [38,12,'guard'],[18,39,'rusher']
 ],
 objectives:[
  {id:'recon',at:[14,29],name:'Survey the market entrances',kind:'recon',duration:2.1,chapter:1},
  {id:'manifest',at:[32,18],name:'Find the delivery manifest',kind:'data',duration:3,chapter:2,requires:['recon']},
  {id:'badge',at:[48,16],name:'Acquire the office access card',kind:'keycard',duration:2.7,chapter:2,requires:['manifest']},
  {id:'breaker',at:[57,24],name:'Override the stockroom shutter',kind:'hack',duration:4.5,chapter:3,requires:['badge']},
  {id:'safe',at:[57,37],name:'Crack the armored cash safe',kind:'safe',duration:12,chapter:4,requires:['breaker']},
  {id:'bags-secured',at:[9,49],name:'Carry 3 cash bags to the van',kind:'haul',duration:0,chapter:5,requires:['safe'],synthetic:true},
  {id:'radio',at:[10,47],name:'Signal the getaway driver',kind:'radio',duration:3.5,chapter:6,requires:['bags-secured']},
  {id:'cctv',at:[58,16],name:'Optional: disable surveillance',kind:'hack',duration:4,chapter:2,optional:true,requires:['badge']},
  {id:'register',at:[40,36],name:'Optional: grab the till cash',kind:'cash',duration:2.5,chapter:3,optional:true,requires:['manifest']},
  {id:'cache',at:[67,38],name:'Optional: steal the shipment cache',kind:'case',duration:3.3,chapter:3,optional:true,requires:['breaker']}
 ],
 completion:'The Vector 9 SMG and smoke grenades are now available. The city belongs to your crew.'
};
export function makeLevel1Grid(){
 const {width,height}=LEVEL1_SIZE;
 const grid=Array.from({length:height},(_,z)=>Array.from({length:width},(_,x)=>x===0||z===0||x===width-1||z===height-1?'#':'.'));
 const add=(x,z,w,h,gaps=[])=>{
  for(let iz=z;iz<z+h;iz++)for(let ix=x;ix<x+w;ix++){
   if(gaps.some(([a,b])=>(h===1?ix>=a&&ix<=b:iz>=a&&iz<=b)))continue;
   if(grid[iz]?.[ix])grid[iz][ix]='#';
  }
 };
 for(const [x,z,w,h,gaps] of edges)add(x,z,w,h,gaps);
 // Street-side blocks are visually and physically substantial, but never obstruct primary approaches.
 for(const [x,z,w,h] of [[15,2,4,7],[2,2,3,4],[2,44,2,8],[65,3,6,5],[23,47,3,4],[36,47,3,4]])add(x,z,w,h);
 // Aisle end-caps and service containers provide real cover.
 for(const [x,z,w,h] of [[27,17,1,3],[27,31,1,4],[33,18,1,4],[33,32,1,5],[39,19,1,4],[39,31,1,4],[67,18,2,4],[67,34,2,3]])add(x,z,w,h);
 // Interactable locations, spawn positions, and getaway remain clear.
 const keyPoints=[LEVEL1.spawn,LEVEL1.exit,LEVEL1.dropoff,...LEVEL1.objectives.map(x=>x.at),...LEVEL1.enemies.map(x=>x.slice(0,2))];
 for(const [x,z] of keyPoints)grid[z][x]='.';
 return grid;
}
