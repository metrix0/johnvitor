const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const { snapshotPage, hashSnapshot } = require('../lib/astrovials-page-fingerprint');

const watcherPath = path.resolve(__dirname, '../netlify/functions/astrovials-stock.js');
function page(product='Sold out', build='build1', more='') {
  return '<html><head><title>Estradiol Enanthate (MCT)</title>' +
    '<link href="/_next/static/'+build+'.js"></head><body>' +
    '<main><h1>Estradiol Enanthate (MCT)</h1><p>€50.00</p>' +
    '<p>'+product+'</p>'+more+'</main>' +
    '<script>self.__next_f.push(["'+build+'"])</script></body></html>';
}
function setup(initialPage=page()) {
  const saved=new Map(),alarms=[];
  let current=initialPage,failures=0,pageFailures=0,pageFailureMode='network',pageRequests=0;
  const originalFetch=global.fetch,originalLoad=Module._load;
  Module._load=function(name,parent,isMain) {
    if (name==='@netlify/blobs') return {connectLambda:()=>{},getStore:()=>({
      get:async key=>saved.get(key)||null,setJSON:async(key,value)=>saved.set(key,value)
    })};
    return originalLoad.call(this,name,parent,isMain);
  };
  delete require.cache[watcherPath];
  const {handler}=require(watcherPath);
  Module._load=originalLoad;
  global.fetch=async(url,opts={})=>{
    if (String(url).startsWith('https://ntfy.sh/')) {
      if (failures-- >0) return new Response('rejected',{status:503});
      alarms.push({url,...opts});
      return new Response('ok',{status:200});
    }
    pageRequests++;
    if (pageFailures-- > 0) {
      if (pageFailureMode==='http') return new Response('Unavailable',{status:503});
      throw new TypeError('fetch failed');
    }
    return new Response(current,{status:200,headers:{'content-type':'text/html; charset=utf-8'}});
  };
  return {handler,alarms,setPage:html=>{current=html},failNtfy:n=>{failures=n},
    failPage:(n,mode='network')=>{pageFailures=n;pageFailureMode=mode},
    pageRequests:()=>pageRequests,
    restore:()=>{global.fetch=originalFetch}};
}

test('ignore rotating Next.js build chunks and hydration scripts',async()=>{
  const t=setup();
  try {
    assert.equal(JSON.parse((await t.handler()).body).initialized,true);
    for (const build of ['build2','build3','build4']) {
      t.setPage(page('Sold out',build));
      assert.equal(JSON.parse((await t.handler()).body).notified,false);
    }
    assert.equal(t.alarms.length,0);
  } finally {t.restore()}
});

test('Sold out to BANANA sends priority 5 ALARM TRIGGER and readable diff',async()=>{
  const t=setup();
  try {
    await t.handler();
    t.setPage(page('BANANA','other-build'));
    const result=JSON.parse((await t.handler()).body);
    assert.equal(result.changed,true);
    assert.equal(result.notified,true);
    assert.equal(t.alarms.length,1);
    assert.equal(t.alarms[0].headers.Title,'ALARM TRIGGER - AstroVials PRODUCT PAGE CHANGED');
    assert.equal(t.alarms[0].headers.Priority,'5');
    assert.match(t.alarms[0].body,/Before: .*Sold out/);
    assert.match(t.alarms[0].body,/After: .*BANANA/);
    assert.equal(JSON.parse((await t.handler()).body).notified,false);
  } finally {t.restore()}
});

test('stock, price, image, attribute, and reversion changes each trigger',async()=>{
  const t=setup();
  try {
    await t.handler();
    for (const html of [
      page('In stock'),
      page('In stock','b','<img src="/uploads/1.webp">'),
      page('In stock','b','<img src="/uploads/2.webp">'),
      page('In stock','b','<img src="/uploads/2.webp" class="new">'),
      page('Sold out')
    ]) {
      t.setPage(html);
      const response=JSON.parse((await t.handler()).body);
      assert.equal(response.notified,true);
      assert.equal(t.alarms.at(-1).headers.Title,'ALARM TRIGGER - AstroVials PRODUCT PAGE CHANGED');
    }
    t.setPage(page('Sold out','third-build').replace('€50.00','€52.00'));
    assert.equal(JSON.parse((await t.handler()).body).notified,true);
    assert.equal(t.alarms.length,6);
  } finally {t.restore()}
});

test('no baseline triggers NO notification; broken page alarms once and recovers',async()=>{
  const t=setup();
  try {
    assert.equal(JSON.parse((await t.handler()).body).notified,false);
    t.setPage('<html><body><div>Server incomplete</div></body></html>');
    const failure=JSON.parse((await t.handler()).body);
    assert.equal(failure.ok,false);
    assert.equal(failure.failureAlarmSent,true);
    assert.equal(t.alarms[0].headers.Title,'ALARM TRIGGER - AstroVials WATCHER FAILED');
    assert.equal(JSON.parse((await t.handler()).body).failureAlarmSent,false);
    assert.equal(t.alarms.length,1);
    t.setPage(page('BANANA'));
    const result=JSON.parse((await t.handler()).body);
    assert.equal(result.notified,true);
    assert.equal(t.alarms[1].headers.Title,'ALARM TRIGGER - AstroVials PRODUCT PAGE CHANGED');
  } finally {t.restore()}
});

test('failed ntfy alarm keeps prior state for a retry next run',async()=>{
  const t=setup();
  try {
    await t.handler();
    t.setPage(page('BANANA'));
    t.failNtfy(2);
    const failed=JSON.parse((await t.handler()).body);
    assert.equal(failed.ok,false);
    assert.equal(failed.pendingChange,true);
    assert.equal(t.alarms.length,0);
    const recovered=JSON.parse((await t.handler()).body);
    assert.equal(recovered.notified,true);
    assert.equal(t.alarms.length,1);
  } finally {t.restore()}
});

test('fingerprint ignores changes outside main, detects markup inside main',()=>{
  assert.equal(hashSnapshot(snapshotPage(page('Sold out','A'))),
    hashSnapshot(snapshotPage(page('Sold out','B'))));
  assert.notEqual(hashSnapshot(snapshotPage(page('Sold out','A'))),
    hashSnapshot(snapshotPage(page('Sold out','A','<span data-amount="2"></span>'))));
});


test('one transient fetch failed error gets retried, with no false alarm',async()=>{
  const t=setup();
  try {
    await t.handler();
    const before=t.pageRequests();
    t.failPage(1);
    const result=JSON.parse((await t.handler()).body);
    assert.equal(result.ok,true);
    assert.equal(result.notified,false);
    assert.equal(t.pageRequests()-before,2);
    assert.equal(t.alarms.length,0);
  } finally {t.restore()}
});

test('HTTP 503 once then 200 is retried without an alarm',async()=>{
  const t=setup();
  try {
    await t.handler();
    t.failPage(1,'http');
    const before=t.pageRequests();
    const result=JSON.parse((await t.handler()).body);
    assert.equal(result.ok,true);
    assert.equal(result.notified,false);
    assert.equal(t.pageRequests()-before,2);
    assert.equal(t.alarms.length,0);
  } finally {t.restore()}
});

test('two fetch failed attempts send ONE ALARM TRIGGER, then recover',async()=>{
  const t=setup();
  try {
    await t.handler();
    t.failPage(2);
    const before=t.pageRequests();
    const result=JSON.parse((await t.handler()).body);
    assert.equal(result.ok,false);
    assert.match(result.error,/fetch failed after 2 attempts/);
    assert.equal(result.failureAlarmSent,true);
    assert.equal(t.pageRequests()-before,2);
    assert.equal(t.alarms.length,1);
    assert.equal(t.alarms[0].headers.Title,'ALARM TRIGGER - AstroVials WATCHER FAILED');
    assert.equal(t.alarms[0].headers.Priority,'5');
    t.failPage(2);
    const next=JSON.parse((await t.handler()).body);
    assert.equal(next.failureAlarmSent,false);
    assert.equal(t.alarms.length,1);
    const recovered=JSON.parse((await t.handler()).body);
    assert.equal(recovered.ok,true);
    assert.equal(recovered.notified,false);
  } finally {t.restore()}
});

test('retry succeeds on an actual stock change and still sends change alarm',async()=>{
  const t=setup();
  try {
    await t.handler();
    t.setPage(page('BANANA'));
    t.failPage(1);
    const response=JSON.parse((await t.handler()).body);
    assert.equal(response.ok,true);
    assert.equal(response.notified,true);
    assert.equal(t.alarms.length,1);
    assert.equal(t.alarms[0].headers.Title,'ALARM TRIGGER - AstroVials PRODUCT PAGE CHANGED');
    assert.match(t.alarms[0].body,/After: .*BANANA/);
  } finally {t.restore()}
});
