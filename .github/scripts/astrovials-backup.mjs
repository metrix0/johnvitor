// Independent five-minute GitHub backup for the Netlify AstroVials monitor.
import pageFingerprint from '../../lib/astrovials-page-fingerprint.js';
import pageFetch from '../../lib/astrovials-page-fetch.js';
const {hashSnapshot} = pageFingerprint;
const {fetchProductSnapshot} = pageFetch;
const PAGE_URL='https://astrovials.com/en/shop/estradiol-enanthate-mct';
const ALERT_TOPIC_URL='https://ntfy.sh/astrovialseen';
const STATE_TOPIC_URL='https://ntfy.sh/astrovialseen-github-v3-state-20261015-jv';
const HASH_PREFIX='sha256:';

async function previousHash() {
  const response=await fetch(STATE_TOPIC_URL+'/json?poll=1&since=latest',{
    headers:{Accept:'application/x-ndjson'},cache:'no-store',signal:AbortSignal.timeout(10000)
  });
  if (!response.ok) throw new Error('Backup state read HTTP '+response.status);
  const messages=(await response.text()).split('\n').filter(Boolean)
    .map(line=>{try{return JSON.parse(line)}catch{return null}})
    .filter(entry=>entry?.event==='message'&&typeof entry.message==='string');
  const latest=messages.at(-1)?.message||'';
  return /^sha256:[0-9a-f]{64}$/.test(latest)?latest.slice(HASH_PREFIX.length):null;
}

async function post(url,title,body,priority) {
  let lastError;
  for (let attempt=0;attempt<2;attempt++) {
    try {
      const response=await fetch(url,{
        method:'POST',
        headers:{'Content-Type':'text/plain; charset=utf-8',Title:title,Priority:String(priority),
          ...(url===ALERT_TOPIC_URL?{Tags:'warning,rotating_light',Click:PAGE_URL}:{})},
        body,signal:AbortSignal.timeout(10000)
      });
      if (!response.ok) throw new Error('ntfy HTTP '+response.status);
      return;
    } catch (error) {lastError=error}
  }
  throw lastError;
}

async function main() {
  try {
    const previous=await previousHash();
    // Use the same two-attempt protection as Netlify.
    const {snapshot,attempts}=await fetchProductSnapshot({
      url:PAGE_URL, userAgent:'Mozilla/5.0 AstroVialsGitHubBackup/3.1'
    });
    const hash=hashSnapshot(snapshot);
    if (!previous) {
      // Initializing new semantic state is not an actual page change.
      await post(STATE_TOPIC_URL,'AstroVials backup semantic state',HASH_PREFIX+hash,1);
      console.log(JSON.stringify({ok:true,initialized:true,notified:false,provider:'github-actions'}));
      return;
    }
    if (previous!==hash) {
      await post(ALERT_TOPIC_URL,'ALARM TRIGGER - AstroVials PRODUCT PAGE CHANGED (BACKUP)',
        'PRODUCT PAGE CONTENT CHANGED\n'+PAGE_URL+'\nPrevious fingerprint: '+previous+
          '\nCurrent fingerprint: '+hash,5);
    }
    // Refresh the ntfy state TTL; acknowledge only after any change alert succeeded.
    await post(STATE_TOPIC_URL,'AstroVials backup semantic state',HASH_PREFIX+hash,1);
    console.log(JSON.stringify({ok:true,changed:previous!==hash,notified:previous!==hash,provider:'github-actions'}));
  } catch (error) {
    console.error('AstroVials backup failed:',error?.message||String(error));
    process.exitCode=1;
  }
}
await main();