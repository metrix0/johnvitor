const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');

const watcherPath = path.resolve(__dirname, '../netlify/functions/astrovials-stock.js');
function setup(initialPage = '<html><main>Sold out</main></html>') {
  const saved = new Map();
  const alarms = [];
  let page = initialPage;
  let failures = 0;
  const originalFetch = global.fetch;
  const oldLoad = Module._load;
  Module._load = function(name, parent, isMain) {
    if (name === '@netlify/blobs') {
      return { connectLambda: () => {}, getStore: () => ({
        get: async key => saved.get(key) || null,
        setJSON: async (key, value) => { saved.set(key, value); }
      }) };
    }
    return oldLoad.call(this, name, parent, isMain);
  };
  delete require.cache[watcherPath];
  const { handler } = require(watcherPath);
  Module._load = oldLoad;
  global.fetch = async (url, opts = {}) => {
    if (String(url).startsWith('https://ntfy.sh/')) {
      if (failures-- > 0) return new Response('rejected', {status: 503});
      alarms.push({url, ...opts});
      return new Response('ok', {status: 200});
    }
    return new Response(page, {status: 200, headers: {'content-type':'text/html; charset=utf-8'}});
  };
  return {
    handler,
    alarms,
    saved,
    setPage: html => { page = html; },
    failNextNtfyAttempts: n => { failures = n; },
    restore: () => { global.fetch = originalFetch; }
  };
}

test('Sold out -> BANANA sends a priority-5 ntfy alarm', async () => {
  const t = setup();
  try {
    const baseline = JSON.parse((await t.handler()).body);
    assert.equal(baseline.initialized, true);
    assert.equal(baseline.notified, true);
    assert.equal(t.alarms.length, 1);
    const unchanged = JSON.parse((await t.handler()).body);
    assert.equal(unchanged.notified, false);
    t.setPage('<html><main>BANANA</main></html>');
    const changed = JSON.parse((await t.handler()).body);
    assert.equal(changed.changed, true);
    assert.equal(changed.notified, true);
    assert.equal(t.alarms.length, 2);
    assert.equal(t.alarms[1].url, 'https://ntfy.sh/astrovialseen');
    assert.equal(t.alarms[1].method, 'POST');
    assert.match(t.alarms[1].body, /Before: .*Sold out/);
    assert.match(t.alarms[1].body, /After: .*BANANA/);
    assert.equal(t.alarms[1].headers.Priority, '5');
    assert.equal(t.alarms[1].headers.Title, 'ALARM TRIGGER - AstroVials PRODUCT PAGE CHANGED');
    assert.equal(t.alarms[1].headers.Click, 'https://astrovials.com/en/shop/estradiol-enanthate-mct');
    assert.equal(JSON.parse((await t.handler()).body).notified, false);
  } finally { t.restore(); }
});

test('ntfy failure never advances baseline; next run retries and alerts', async () => {
  const t = setup();
  try {
    await t.handler();
    t.setPage('<html><main>BANANA</main></html>');
    t.failNextNtfyAttempts(2);
    const failed = JSON.parse((await t.handler()).body);
    assert.equal(failed.ok, false);
    assert.equal(t.alarms.length, 2); // Initial alarm + failure alarm
    const retried = JSON.parse((await t.handler()).body);
    assert.equal(retried.notified, true);
    assert.equal(t.alarms.length, 3);
    assert.match(t.alarms[2].body, /BANANA/);
  } finally { t.restore(); }
});

test('ANY single-character or HTML markup difference causes ALARM TRIGGER, including reversions', async () => {
  const t = setup('<html><main>Sold out</main></html>');
  try {
    await t.handler();
    const expectedChanges = [
      '<html><main>Sold ouT</main></html>',
      '<html><main class="stock">Sold ouT</main></html>',
      '<html><main>Sold out</main></html>'
    ];
    for (const [index, html] of expectedChanges.entries()) {
      t.setPage(html);
      const result = JSON.parse((await t.handler()).body);
      assert.equal(result.changed, true, 'change ' + index);
      assert.equal(result.notified, true, 'change ' + index);
      assert.equal(t.alarms[index + 1].headers.Title, 'ALARM TRIGGER - AstroVials PRODUCT PAGE CHANGED');
      assert.equal(t.alarms[index + 1].headers.Priority, '5');
    }
    assert.equal(t.alarms.length, 4);
  } finally { t.restore(); }
});

test('empty page produces an ALARM TRIGGER watcher failure and does not replace baseline', async () => {
  const t = setup();
  try {
    await t.handler();
    t.setPage('');
    const failed = JSON.parse((await t.handler()).body);
    assert.equal(failed.ok, false);
    assert.equal(failed.failureAlarmSent, true);
    assert.equal(t.alarms[1].headers.Title, 'ALARM TRIGGER - AstroVials WATCHER FAILED');
    t.setPage('<html><main>BANANA</main></html>');
    assert.equal(JSON.parse((await t.handler()).body).notified, true);
    assert.equal(t.alarms[2].headers.Title, 'ALARM TRIGGER - AstroVials PRODUCT PAGE CHANGED');
  } finally { t.restore(); }
});
