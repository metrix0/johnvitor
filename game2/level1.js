// NIGHTSHIFT MARKET — reference-map-inspired first robbery.
// North is the stockroom / office / restroom wing; store aisles to the south,
// delivery bay to the west, side alley to the east, parking / getaway to the south.
// Geometry intentionally adapts the reference for open first-person sightlines.
export const LEVEL1_SIZE={width:57,height:46};
export const LEVEL1_ZONES=[
 {name:'PARKING LOT',x:9,z:34,w:37,h:11,floor:0x283038},
 {name:'DELIVERY AREA',x:1,z:12,w:11,h:23,floor:0x33363a},
 {name:'SIDE ALLEY',x:45,z:5,w:11,h:39,floor:0x242b30},
 {name:'SHOP FLOOR',x:12,z:16,w:33,h:18,floor:0x8f8777},
 {name:'STOCKROOM',x:12,z:7,w:13,h:9,floor:0x666057},
 {name:'BACK OFFICE',x:25,z:7,w:11,h:9,floor:0x69645c},
 {name:'RESTROOM',x:36,z:7,w:9,h:9,floor:0x768082}
];
const fixtures=[
 // The southwest entry wall is lined with coolers, while front displays
 // and the cashier's counter frame the main door.
 [14,19,'fridge'],[14,22,'fridge'],[14,25,'fridge'],
 [15,29,'shelf'],[19,30,'shelf'],[24,30,'counter'],[27,30,'counter'],[31,30,'counter'],
 [38,30,'counter'],[41,30,'shelf'],[42,21,'shelf'],[42,26,'shelf'],
 // Five visible grocery aisles with navigable gaps and endcaps.
 [19,20,'shelf'],[19,24,'shelf'],[24,20,'shelf'],[24,24,'shelf'],
 [29,20,'shelf'],[29,24,'shelf'],[34,20,'shelf'],[34,24,'shelf'],
 [39,20,'shelf'],[39,24,'shelf'],
 // Overpacked stock room.
 [14,9,'pallet'],[15,13,'crate'],[18,9,'shelf'],[18,13,'crate'],
 [21,9,'pallet'],[22,13,'shelf'],
 // Manager's office, cash safe, paperwork.
 [27,9,'filing'],[30,10,'safe'],[33,9,'filing'],[32,13,'desk'],
 // Restroom and staff facilities.
 [37,9,'filing'],[41,9,'filing'],[42,13,'crate'],
 // Parking cars, delivery truck, and getaway vehicle.
 [7,22,'van'],[6,15,'pallet'],[9,30,'pallet'],[15,40,'van'],
 [34,40,'car'],[45,40,'car'],[9,40,'streetlamp'],[44,38,'streetlamp'],
 // Realistic cover near the employee exit; reinforcements enter here.
 [49,10,'dumpster'],[51,22,'dumpster'],[50,33,'dumpster'],[53,16,'pallet'],
 [4,8,'container'],[5,37,'barrier'],[52,39,'barrier']
];
const accents=[
 {text:'NIGHTSHIFT MARKET',x:28,z:33.35,y:3.6,size:6.2,rot:Math.PI,color:'#f0d5a4'},
 {text:'24 HOURS',x:37,z:33.31,y:2.8,size:2.3,rot:Math.PI,color:'#9deaff'},
 {text:'EMPLOYEES ONLY',x:44.27,z:12,y:2.5,size:3.1,rot:-Math.PI/2,color:'#f2d8aa'},
 {text:'DELIVERIES',x:11.72,z:12,y:2.5,size:3,rot:Math.PI/2,color:'#f4cb8a'},
 {text:'STOCKROOM',x:19,z:15.72,y:2.5,size:2.8,rot:Math.PI,color:'#f2d9b5'},
 {text:'MANAGER',x:30.2,z:15.72,y:2.5,size:2.4,rot:Math.PI,color:'#f2d9b5'},
 {text:'RESTROOM',x:40,z:15.72,y:2.5,size:2.3,rot:Math.PI,color:'#d5ecf2'},
 {text:'COLD DRINKS',x:14.6,z:21.9,y:3,size:2.8,rot:Math.PI/2,color:'#91ddfb'},
 {text:'SIDE EXIT',x:46.8,z:17.6,y:2.3,size:2.7,rot:Math.PI/2,color:'#f0d2b4'}
];
export const LEVEL1={
 id:'bodega',number:'01',name:'NIGHTSHIFT MARKET',site:'NIGHTSHIFT MARKET',type:'LATE-NIGHT STORE ROBBERY',tag:'THE FIRST SCORE',
 description:'After closing, the Nightshift Market still has cash in the register and the manager\'s office. Enter from the parking lot or staff side door, take the till, crack the office safe, bring the loot to your van, and get away. A few guards are on duty; the reinforcements only arrive after the robbery starts.',
 theme:'store',accent:'#e8c487',payout:500,reinforce:24,alarmRate:.0015,
 size:LEVEL1_SIZE,zones:LEVEL1_ZONES,decor:fixtures,signs:accents,
 spawn:[28,39],exit:[19,40],dropoff:[19,40],checkpoint:[28,35],
 waveSpawns:[[52,11],[52,30],[9,21],[41,40],[11,38]],
 enemies:[[17,22,'guard'],[38,22,'guard'],[32,12,'guard']],
 objectives:[
  {id:'till',at:[29,29],name:'Empty the front cash register',kind:'cash',duration:4.4,chapter:1},
  {id:'safe',at:[29,12],name:'Open the manager\'s office safe',kind:'safe',duration:7,chapter:2,requires:['till']},
  {id:'bags-secured',at:[19,40],name:'Carry 2 cash bags to the getaway van',kind:'haul',duration:0,chapter:3,requires:['safe'],synthetic:true},
  {id:'radio',at:[20,39],name:'Call the getaway driver',kind:'radio',duration:2.8,chapter:4,requires:['bags-secured']},
  {id:'stock',at:[17,11],name:'Optional: take the stockroom shipment',kind:'case',duration:2.7,optional:true,requires:['till']},
  {id:'cctv',at:[33,12],name:'Optional: cut the security feed',kind:'hack',duration:3.3,optional:true,requires:['till']},
  {id:'lottery',at:[39,29],name:'Optional: collect lottery scratchers',kind:'cash',duration:2.2,optional:true,requires:['till']}
 ],
 completion:'Your first successful store robbery is in the books. The crew is ready for its next job.'
};
export function makeLevel1Grid(){
 const {width,height}=LEVEL1_SIZE;
 const grid=Array.from({length:height},(_,z)=>Array.from({length:width},(_,x)=>x===0||z===0||x===width-1||z===height-1?'#':'.'));
 const set=(x,z,w,h,gaps=[])=>{
  for(let zz=z;zz<z+h;zz++)for(let xx=x;xx<x+w;xx++){
   if(gaps.some(([lo,hi])=>h===1?xx>=lo&&xx<=hi:zz>=lo&&zz<=hi))continue;
   if(grid[zz]?.[xx]!==undefined)grid[zz][xx]='#';
  }
 };
 // Exterior walls; front door points south at the parking lot.
 set(12,7,33,1);
 set(12,33,33,1,[[27,30]]);
 set(12,7,1,27,[[11,13]]);    // loading / employee bay opening
 set(44,7,1,27,[[11,13]]);    // side employee entrance
 // Deep rear storeroom, office and restroom wing.
 set(12,16,33,1,[[21,23],[29,31],[39,40]]);
 set(24,7,1,10,[[11,13]]);
 set(35,7,1,10,[[11,13]]);
 // Shelving cores have physical collision; wide rows leave flanking routes.
 for(const x of [19,24,29,34,39])for(const z of [20,24])set(x,z,1,2);
 // Stockroom racks, bathroom partitions and exterior dumpsters.
 for(const [x,z,w,h] of [[18,9,1,2],[21,9,1,2],[40,9,1,2],[49,10,2,1],[51,22,2,1],[50,33,2,1],[4,8,3,3]])set(x,z,w,h);
 // Maintain accessible floor around mandatory objectives, doors and spawns.
 const access=[LEVEL1.spawn,LEVEL1.exit,LEVEL1.dropoff,...LEVEL1.objectives.map(o=>o.at),...LEVEL1.enemies.map(e=>e.slice(0,2)),...LEVEL1.waveSpawns];
 for(const [x,z] of access)grid[z][x]='.';
 return grid;
}
