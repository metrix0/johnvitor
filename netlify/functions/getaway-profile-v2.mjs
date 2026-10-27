import { getStore } from '@netlify/blobs';
const json=(status,body)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const cap=(n,max=9999999)=>Number.isFinite(Number(n))?Math.max(0,Math.min(max,Math.floor(Number(n)))):0;
const allowedJobs=['bodega','offices','datacenter','penthouse','bank'];
const tiers=['armor','damage','mag'];
function normalize(data,name){
 const p=data&&typeof data==='object'?data:{};
 const profile={name,unlocked:Math.min(4,cap(p.unlocked,4)),completed:p.completed===true,earned:cap(p.earned),spent:cap(p.spent),upgrades:{armor:0,damage:0,mag:0},cleared:[],best:{}};
 profile.spent=Math.min(profile.spent,profile.earned);
 for(const k of tiers)profile.upgrades[k]=cap(p.upgrades?.[k],3);
 profile.cleared=Array.isArray(p.cleared)?[...new Set(p.cleared.filter(v=>allowedJobs.includes(v)))]:[];
 if(p.best&&typeof p.best==='object')for(const job of allowedJobs)if(Number.isFinite(Number(p.best[job]))&&Number(p.best[job])>0)profile.best[job]=cap(p.best[job],999999);
 return profile;
}
export default async function handler(request){
 try{
  if(!['GET','POST'].includes(request.method))return json(405,{error:'Method not allowed'});
  const input=request.method==='GET'?Object.fromEntries(new URL(request.url).searchParams):await request.json();
  const name=String(input?.name||'').trim();
  if(!/^[A-Za-z0-9_-]{3,24}$/.test(name))return json(400,{error:'Use 3–24 letters, numbers, underscores or hyphens.'});
  const store=getStore({name:'getaway-club-profiles',consistency:'strong'});
  const id=name.toLowerCase();
  const existing=normalize(await store.get(id,{type:'json'}),name);
  if(request.method==='GET')return json(200,existing);
  const incoming=normalize(input,name);
  const merged={...existing,unlocked:Math.max(existing.unlocked,incoming.unlocked),completed:existing.completed||incoming.completed,earned:Math.max(existing.earned,incoming.earned),spent:Math.max(existing.spent,incoming.spent),cleared:[...new Set([...existing.cleared,...incoming.cleared])],upgrades:{...existing.upgrades},best:{...existing.best}};
  merged.spent=Math.min(merged.spent,merged.earned);
  for(const k of tiers)merged.upgrades[k]=Math.max(existing.upgrades[k],incoming.upgrades[k]);
  for(const job of allowedJobs)if(incoming.best[job])merged.best[job]=merged.best[job]?Math.min(incoming.best[job],merged.best[job]):incoming.best[job];
  await store.setJSON(id,merged);
  return json(200,merged);
 }catch(error){
  console.error('getaway-profile-v2:',error?.message||String(error));
  return json(503,{error:'Profile storage is temporarily unavailable.'});
 }
}
