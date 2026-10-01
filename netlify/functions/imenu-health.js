const HEALTH_URL = 'https://www.imenuapp.com.br/api/health';
const STATE_TOPIC_URL = 'https://ntfy.sh/imenu-health-netlify-state-20261001-jv';

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
    headers: { Accept: 'application/x-ndjson' }
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
      Title: 'iMenu Netlify health state',
      Priority: '1'
    },
    body: state
  });

  if (!response.ok) throw new Error(`state write HTTP ${response.status}`);
}

async function sendAlarm() {
  const response = await fetch('https://johnvitor.com/avalarm?kind=imenu', {
    headers: {
      'Cache-Control': 'no-cache',
      'User-Agent': 'Mozilla/5.0 iMenuNetlifyHealthWatcher/1.0'
    }
  });

  if (!response.ok) throw new Error(`alarm relay HTTP ${response.status}`);
}

async function checkHealth() {
  try {
    const response = await fetch(`${HEALTH_URL}?netlifycheck=${Date.now()}`, {
      headers: {
        Accept: 'application/json',
        'Cache-Control': 'no-cache',
        'User-Agent': 'Mozilla/5.0 iMenuNetlifyHealthWatcher/1.0'
      }
    });

    const body = await response.text();
    const ok = response.status === 200 && /"ok"\s*:\s*true/.test(body);

    return {
      ok,
      details: ok ? 'ok' : `HTTP ${response.status}: ${body.slice(0, 300).replace(/\s+/g, ' ')}`
    };
  } catch (error) {
    return {
      ok: false,
      details: error?.message || String(error)
    };
  }
}

exports.handler = async function() {
  try {
    const result = await checkHealth();
    const previousState = await getPreviousState();

    if (result.ok) {
      await saveState('healthy');
      return json(200, {
        ok: true,
        state: 'healthy',
        previousState,
        notified: false
      });
    }

    if (previousState === 'degraded') {
      await sendAlarm();
      await saveState('unhealthy');
      return json(502, {
        ok: false,
        state: 'unhealthy',
        previousState,
        notified: true,
        error: result.details
      });
    }

    if (previousState === 'unhealthy') {
      await saveState('unhealthy');
      return json(502, {
        ok: false,
        state: 'unhealthy',
        previousState,
        notified: false,
        error: result.details
      });
    }

    await saveState('degraded');
    return json(502, {
      ok: false,
      state: 'degraded',
      previousState,
      notified: false,
      error: result.details
    });
  } catch (error) {
    return json(502, {
      ok: false,
      error: error?.message || String(error)
    });
  }
};
