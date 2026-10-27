const HEALTH_URL = 'https://hub.engravida.com.br/api/current-user';
const STATE_TOPIC_URL = 'https://ntfy.sh/engravida-health-netlify-state-20261027-jv';
const ALARM_URL = 'https://johnvitor.com/avalarm?kind=engravida';

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    },
    body: JSON.stringify(body)
  };
}

async function getPreviousState() {
  const response = await fetch(`${STATE_TOPIC_URL}/json?poll=1&since=latest`, {
    headers: { Accept: 'application/x-ndjson' },
    signal: AbortSignal.timeout(10000)
  });

  if (!response.ok) throw new Error(`state read HTTP ${response.status}`);

  const messages = (await response.text())
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try { return JSON.parse(line); } catch { return null; }
    })
    .filter((entry) => entry && entry.event === 'message');

  const latest = messages[messages.length - 1];
  return ['healthy', 'degraded', 'unhealthy'].includes(latest?.message)
    ? latest.message
    : null;
}

async function saveState(state) {
  const response = await fetch(STATE_TOPIC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      Title: 'Engravida Hub Netlify health state',
      Priority: '1'
    },
    body: state,
    signal: AbortSignal.timeout(10000)
  });

  if (!response.ok) throw new Error(`state write HTTP ${response.status}`);
}

async function sendAlarm() {
  const response = await fetch(ALARM_URL, {
    headers: { 'Cache-Control': 'no-cache' },
    signal: AbortSignal.timeout(10000)
  });

  if (!response.ok) throw new Error(`alarm relay HTTP ${response.status}`);
}

async function checkHealth() {
  try {
    const response = await fetch(`${HEALTH_URL}?netlifycheck=${Date.now()}`, {
      headers: {
        Accept: 'application/json',
        'Cache-Control': 'no-cache',
        'User-Agent': 'Mozilla/5.0 EngravidaNetlifyHealthWatcher/1.0'
      },
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(10000)
    });

    const body = await response.text();
    let data;
    try { data = JSON.parse(body); } catch { data = null; }
    const ok = response.status === 200 &&
      data?.ok === true && data.user === null && data.permission === null;

    return {
      ok,
      details: ok ? 'ok' : `HTTP ${response.status}: ${body.slice(0, 300).replace(/\s+/g, ' ')}`
    };
  } catch (error) {
    return { ok: false, details: error?.message || String(error) };
  }
}

exports.handler = async function() {
  try {
    const result = await checkHealth();
    const previousState = await getPreviousState();

    if (result.ok) {
      await saveState('healthy');
      return json(200, { ok: true, service: 'engravida-hub', state: 'healthy', previousState, notified: false });
    }

    if (previousState === 'degraded') {
      await sendAlarm();
      await saveState('unhealthy');
      return json(502, {
        ok: false, service: 'engravida-hub', state: 'unhealthy', previousState,
        notified: true, error: result.details
      });
    }

    if (previousState === 'unhealthy') {
      await saveState('unhealthy');
      return json(502, {
        ok: false, service: 'engravida-hub', state: 'unhealthy', previousState,
        notified: false, error: result.details
      });
    }

    await saveState('degraded');
    return json(502, {
      ok: false, service: 'engravida-hub', state: 'degraded', previousState,
      notified: false, error: result.details
    });
  } catch (error) {
    return json(502, { ok: false, service: 'engravida-hub', error: error?.message || String(error) });
  }
};
