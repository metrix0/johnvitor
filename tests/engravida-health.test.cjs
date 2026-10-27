const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { handler } = require('../netlify/functions/engravida-health');

const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });

function mockRun({ previousState = 'healthy', healthStatus = 200, healthBody, healthError, alarmStatus = 200, stateReadStatus = 200, stateWriteStatus = 200 } = {}) {
  const calls = [];
  global.fetch = async (url, options = {}) => {
    const u = String(url);
    calls.push({ url: u, options });
    if (u.startsWith('https://hub.engravida.com.br/api/current-user?')) {
      if (healthError) throw healthError;
      return new Response(healthBody ?? JSON.stringify({ok:true,user:null,permission:null}), { status: healthStatus });
    }
    if (u.includes('/json?poll=1&since=latest')) {
      return new Response(previousState === null ? '' : JSON.stringify({event:'message',message:previousState})+'\n', { status: stateReadStatus });
    }
    if (u === 'https://ntfy.sh/engravida-health-netlify-state-20261027-jv') {
      return new Response('', { status: stateWriteStatus });
    }
    if (u === 'https://johnvitor.com/avalarm?kind=engravida') {
      return new Response('', { status: alarmStatus });
    }
    throw new Error('Unexpected fetch '+u);
  };
  return calls;
}

function saved(calls) {
  return calls.filter(c=>c.url === 'https://ntfy.sh/engravida-health-netlify-state-20261027-jv').map(c=>c.options.body);
}
function alarms(calls) { return calls.filter(c=>c.url.includes('/avalarm')); }

test('healthy response records healthy and does not alarm', async () => {
  const calls = mockRun({ previousState: 'unhealthy' });
  const result = await handler();
  assert.equal(result.statusCode,200);
  assert.deepEqual(saved(calls), ['healthy']);
  assert.equal(alarms(calls).length,0);
  assert.equal(JSON.parse(result.body).service,'engravida-hub');
});

test('first failure records degraded without alarm', async () => {
  const calls=mockRun({ healthStatus:503, healthBody:'unavailable' });
  const result=await handler();
  assert.equal(result.statusCode,502);
  assert.equal(JSON.parse(result.body).state,'degraded');
  assert.deepEqual(saved(calls),['degraded']);
  assert.equal(alarms(calls).length,0);
});

test('second consecutive failure alerts once', async () => {
  const calls=mockRun({ previousState:'degraded',healthBody:'<html>login</html>' });
  const result=await handler();
  assert.equal(JSON.parse(result.body).notified,true);
  assert.deepEqual(saved(calls),['unhealthy']);
  assert.equal(alarms(calls).length,1);
});

test('continued outage does not re-alert while unhealthy', async () => {
  const calls=mockRun({ previousState:'unhealthy',healthError:new Error('network timeout') });
  const result=await handler();
  assert.equal(JSON.parse(result.body).notified,false);
  assert.deepEqual(saved(calls),['unhealthy']);
  assert.equal(alarms(calls).length,0);
});

test('invalid or unexpected JSON is not considered healthy', async () => {
  const calls=mockRun({ previousState:null,healthBody:'{"ok":true,"user":{"email":"test@example.com"}}' });
  const result=await handler();
  assert.equal(JSON.parse(result.body).state,'degraded');
  assert.deepEqual(saved(calls),['degraded']);
});

test('failed alarm delivery leaves state degraded for retry', async () => {
  const calls=mockRun({ previousState:'degraded',healthStatus:500,alarmStatus:503 });
  const result=await handler();
  assert.equal(result.statusCode,502);
  assert.match(JSON.parse(result.body).error,/alarm relay HTTP 503/);
  assert.deepEqual(saved(calls),[]);
});

test('state read failure prevents false success reporting', async () => {
  const calls=mockRun({stateReadStatus:503});
  const result=await handler();
  assert.equal(result.statusCode,502);
  assert.match(JSON.parse(result.body).error,/state read HTTP 503/);
  assert.deepEqual(saved(calls),[]);
});
