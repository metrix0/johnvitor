import {WEAPONS,GADGETS,clamp} from './data.js?v=9';
// Purchased gear stays in the stash until deployed and lost. Consumable stock is
// deducted when used; the issued pistol is always available to prevent softlocks.
export function canEquipWeapon(profile,id){return id==='pistol'||!!(WEAPONS[id]&&profile.weapons?.includes(id));}
export function canEquipGadget(profile,id){return !!(GADGETS[id]&&(profile.gadgetStock?.[id]||0)>0);}
export function equippedKit(profile,weapon,gadget){
 const w=canEquipWeapon(profile,weapon)?weapon:'pistol',g=canEquipGadget(profile,gadget)?gadget:null;
 return {weapon:w,gadget:g,charges:g?Math.min(GADGETS[g].charges,profile.gadgetStock[g]):0};
}
export function touchGear(profile){
 profile.gearRev=clamp((profile.gearRev||0)+1,0,999999999);
 profile.gearUpdatedAt=Date.now();
}
export function purchaseGear(profile,kind,id){
 const entry=kind==='weapon'?WEAPONS[id]:kind==='gadget'?GADGETS[id]:null;
 if(!entry||!entry.cost||entry.unlock>profile.unlocked||profile.earned-profile.spent<entry.cost)return false;
 if(kind==='weapon'){
  if(canEquipWeapon(profile,id))return false;
  profile.weapons=[...profile.weapons,id];
 }else{
  const old=profile.gadgetStock[id]||0;
  if(old+entry.charges>30)return false;
  profile.gadgetStock[id]=old+entry.charges;
 }
 profile.spent+=entry.cost;touchGear(profile);return true;
}
export function settleGear(profile,player,failed){
 if(!player)return false;
 let changed=false;
 if(failed&&player.weapon!=='pistol'&&profile.weapons?.includes(player.weapon)){
  profile.weapons=profile.weapons.filter(id=>id!==player.weapon);changed=true;
 }
 if(player.gadget&&GADGETS[player.gadget]){
  const owned=profile.gadgetStock[player.gadget]||0;
  const remaining=failed?0:Math.max(0,owned-Math.max(0,(player.gadgetStart??player.gadgets)-player.gadgets));
  if(remaining!==owned){if(remaining)profile.gadgetStock[player.gadget]=remaining;else delete profile.gadgetStock[player.gadget];changed=true;}
 }
 if(changed)touchGear(profile);
 return changed;
}
export function chooseGearSnapshot(a,b){
 const ar=a.gearRev||0,br=b.gearRev||0;
 return ar>br?a:br>ar?b:(a.gearUpdatedAt||0)>=(b.gearUpdatedAt||0)?a:b;
}
