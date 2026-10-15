const { connectLambda, getStore } = require('@netlify/blobs');
const { snapshotPage, hashSnapshot, humanDiff } = require('../../lib/astrovials-page-fingerprint');

const PAGE_URL = 'https://astrovials.com/en/shop/estradiol-enanthate-mct';
const ALERT_TOPIC_URL = 'https://ntfy.sh/astrovialseen';
const STORE_NAME = 'astrovials-page-monitor';
const STORE_KEY = 'estradiol-enanthate-mct-semantic-v2';

function json(statusCode, body) {
  return { statusCode, headers: {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'},
    body: JSON.stringify(body) };
}

async function notify(title, message) {
  let lastError;
  for (let attempt=0; attempt<2; attempt++) {
    try {
      const response = await fetch(ALERT_TOPIC_URL, {
        method:'POST',
        headers:{'Content-Type':'text/plain; charset=utf-8',Title:title,Priority:'5',
          Tags:'warning,rotating_light',Click:PAGE_URL},
        body:message,
        signal:AbortSignal.timeout(7000)
      });
      if (!response.ok) throw new Error('ntfy HTTP '+response.status);
      return;
    } catch (error) { lastError=error; }
  }
  throw lastError;
}

exports.handler = async function(event) {
  let store; let previous;
  try {
    connectLambda(event);
    store = getStore(STORE_NAME);
    previous = await store.get(STORE_KEY, {type:'json'});
    const response = await fetch(PAGE_URL, {
      headers:{Accept:'text/html','Cache-Control':'no-cache, no-store',
        Pragma:'no-cache','User-Agent':'Mozilla/5.0 AstroVialsPageWatcher/3.0'},
      cache:'no-store', signal:AbortSignal.timeout(14000)
    });
    if (!response.ok) throw new Error('AstroVials HTTP '+response.status);
    if (!(response.headers.get('content-type') || '').includes('text/html')) {
      throw new Error('Unexpected product page content type');
    }
    const snapshot = snapshotPage(await response.text());
    const hash = hashSnapshot(snapshot);

    // The new snapshot format needs a new baseline; initializing isn't a change.
    if (!previous?.hash) {
      await store.setJSON(STORE_KEY, {hash,snapshot,status:'healthy',checkedAt:new Date().toISOString()});
      return json(200, {ok:true,initialized:true,changed:false,notified:false});
    }

    if (previous.hash !== hash) {
      try {
        await notify('ALARM TRIGGER - AstroVials PRODUCT PAGE CHANGED',
          'PRODUCT PAGE CONTENT CHANGED\n'+PAGE_URL+'\n'+humanDiff(previous.snapshot,snapshot));
      } catch (notificationError) {
        // Don't overwrite the old snapshot. Retry this exact change next minute.
        console.error('AstroVials change alarm failed:',notificationError);
        return json(502,{ok:false,error:'Page change notification failed',pendingChange:true});
      }
      await store.setJSON(STORE_KEY, {hash,snapshot,status:'healthy',checkedAt:new Date().toISOString()});
      return json(200,{ok:true,changed:true,notified:true,hash});
    }

    if (previous.status !== 'healthy') {
      await store.setJSON(STORE_KEY,{...previous,status:'healthy',checkedAt:new Date().toISOString()});
    }
    return json(200,{ok:true,changed:false,notified:false,hash});
  } catch (error) {
    const reason = error?.message || String(error);
    console.error('AstroVials watcher failed:',reason);
    let failureAlarmSent=false;
    // One alarm per error incident, not once a minute for an ongoing outage.
    if (store && previous && previous.status !== 'error') {
      try {
        await notify('ALARM TRIGGER - AstroVials WATCHER FAILED',
          'PRODUCT PAGE MONITOR ERROR\n'+PAGE_URL+'\n'+reason);
        failureAlarmSent=true;
        await store.setJSON(STORE_KEY,{...previous,status:'error',lastError:reason});
      } catch (notificationError) {
        console.error('AstroVials failure alarm could not be saved:',notificationError);
      }
    }
    return json(502,{ok:false,error:reason,failureAlarmSent});
  }
};