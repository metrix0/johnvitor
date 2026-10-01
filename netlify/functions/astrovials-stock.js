const SITE_URL = 'https://astrovials.com/';
const ALERT_TOPIC_URL = 'https://ntfy.sh/astrovialseen';
const STATE_TOPIC_URL = 'https://ntfy.sh/astrovialseen-site-state-20261001-jv';

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

function detectSiteState(html) {
  const hasComingSoonHeading = /<h1\b[^>]*>\s*Coming soon\s*<\/h1>/i.test(html);
  const hasNotOpenMessage = /<p\b[^>]*>\s*This shop is not open yet\.\s*<\/p>/i.test(html);

  return hasComingSoonHeading && hasNotOpenMessage
    ? 'coming_soon'
    : 'changed';
}

async function getPreviousState() {
  const response = await fetch(`${STATE_TOPIC_URL}/json?poll=1&since=latest`, {
    headers: {
      'Accept': 'application/x-ndjson'
    }
  });

  if (!response.ok) {
    throw new Error(`state read HTTP ${response.status}`);
  }

  const body = await response.text();
  const messages = body
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter((entry) => entry && entry.event === 'message');

  const latest = messages[messages.length - 1];
  return ['coming_soon', 'changed'].includes(latest?.message)
    ? latest.message
    : null;
}

async function saveState(state) {
  const response = await fetch(STATE_TOPIC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Title': 'AstroVials site state',
      'Priority': '1'
    },
    body: state
  });

  if (!response.ok) {
    throw new Error(`state write HTTP ${response.status}`);
  }
}

async function sendAlarm() {
  const response = await fetch(ALERT_TOPIC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Title': 'ALARM TRIGGER - AstroVials SITE CHANGED',
      'Priority': '5',
      'Tags': 'warning,rotating_light',
      'Click': SITE_URL
    },
    body: 'ALARM TRIGGER - AstroVials no longer shows the current Coming Soon page. Check the site now.'
  });

  if (!response.ok) {
    throw new Error(`ntfy HTTP ${response.status}`);
  }
}

exports.handler = async function() {
  try {
    const siteResponse = await fetch(`${SITE_URL}?sitecheck=${Date.now()}`, {
      headers: {
        'Accept': 'text/html',
        'Cache-Control': 'no-cache',
        'User-Agent': 'Mozilla/5.0 AstroVialsSiteWatcher/1.0'
      }
    });

    if (!siteResponse.ok) {
      return json(502, { ok: false, error: `AstroVials HTTP ${siteResponse.status}` });
    }

    const html = await siteResponse.text();
    const state = detectSiteState(html);
    const previousState = await getPreviousState();
    const shouldNotify = state === 'changed' && previousState === 'coming_soon';

    if (shouldNotify) {
      await sendAlarm();
    }

    await saveState(state);

    return json(200, {
      ok: true,
      state,
      previousState,
      notified: shouldNotify
    });
  } catch (error) {
    return json(502, { ok: false, error: error?.message || String(error) });
  }
};
