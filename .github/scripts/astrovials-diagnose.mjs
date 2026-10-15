import fingerprint from '../../lib/astrovials-page-fingerprint.js';
import pageFetch from '../../lib/astrovials-page-fetch.js';
const {snapshotPage, hashSnapshot} = fingerprint;
const {fetchProductSnapshot} = pageFetch;
const url='https://astrovials.com/en/shop/estradiol-enanthate-mct';
const samples=[];
function changes(a,b) {
  let start=0;while(start<Math.min(a.length,b.length)&&a[start]===b[start]) start++;
  let endA=a.length-1,endB=b.length-1;
  while(endA>=start&&endB>=start&&a[endA]===b[endB]) {endA--;endB--}
  return {
    firstDifference:start,
    old: a.slice(Math.max(0,start-140),Math.min(a.length,endA+141)).slice(0,1400),
    next:b.slice(Math.max(0,start-140),Math.min(b.length,endB+141)).slice(0,1400),
    lengths:[a.length,b.length]
  };
}
for(let n=0;n<5;n++){
  const {snapshot, attempts}=await fetchProductSnapshot({url,userAgent:'Mozilla/5.0 AstroVialsGitHubBackup/3.1'});
  const hash=hashSnapshot(snapshot);
  console.log('SAMPLE',n,{hash,length:snapshot.length,attempts});
  for(let m=0;m<n;m++) if(samples[m].hash!==hash) {
    console.log('DIFF SAMPLE',m,'vs',n,JSON.stringify(changes(samples[m].snapshot,snapshot)));
  }
  samples.push({hash,snapshot});
  if(n<4) await new Promise(resolve=>setTimeout(resolve,4000));
}
console.log('DISTINCT_FINGERPRINTS',new Set(samples.map(x=>x.hash)).size);
