const PRODUCT_URL = 'https://astrovials.com/product/estradiol-enanthate/';
const SITE_URL = 'https://astrovials.com/';
const ALERT_TOPIC_URL = 'https://ntfy.sh/astrovialseen';
const STATE_TOPIC_URL = 'https://ntfy.sh/astrovialseen-state-20260909-jv';
const SITE_STATE_TOPIC_URL = 'https://ntfy.sh/astrovialseen-site-state-20261001-jv';

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

function detectStock(html) {
  const normalized = html.replace(/\s+/g, ' ').toLowerCase();

  if (normalized.includes('out of stock')) {
    return 'out_of_stock';
  }

  if (
    normalized.includes('availability: in stock') ||
    normalized.includes('>in stock<') ||
    normalized.includes('add to cart')
  ) {
    return 'in_stock';
  }

  return 'unknown';
}

function detectSiteState(html) {
  const normalized = html.replace(/\s+/g, ' ').toLowerCase();
  return (
    normalized.includes('coming soon') &&
    normalized.includes('this shop is not open yet')
  )
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
  return ['in_stock', 'out_of_stock', 'unknown'].includes(latest?.message)
    ? latest.message
    : null;
}

async function getPreviousSiteState() {
  const response = await fetch(`${SITE_STATE_TOPIC_URL}/json?poll=1&since=latest`, {
    headers: {
      'Accept': 'application/x-ndjson'
    }
  });

  if (!response.ok) {
    throw new Error(`site state read HTTP ${response.status}`);
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
      'Title': 'AstroVials stock state',
      'Priority': '1'
    },
    body: state
  });

  if (!response.ok) {
    throw new Error(`state write HTTP ${response.status}`);
  }
}

async function saveSiteState(state) {
  const response = await fetch(SITE_STATE_TOPIC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Title': 'AstroVials site state',
      'Priority': '1'
    },
    body: state
  });

  if (!response.ok) {
    throw new Error(`site state write HTTP ${response.status}`);
  }
}

async function sendAlarm(state) {
  const response = await fetch(ALERT_TOPIC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Title': 'ALARM TRIGGER - AstroVials EEn NOT OUT OF STOCK',
      'Priority': '5',
      'Tags': 'warning,rotating_light',
      'Click': PRODUCT_URL
    },
    body: `TRIGGER ALARM - AstroVials is no longer explicitly out of stock (detected: ${state}). Check the product now.`
  });

  if (!response.ok) {
    throw new Error(`ntfy HTTP ${response.status}`);
  }
}

async function sendSiteAlarm() {
  const response = await fetch(ALERT_TOPIC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Title': 'ALARM TRIGGER - AstroVials SITE CHANGED',
      'Priority': '5',
      'Tags': 'warning,rotating_light',
      'Click': SITE_URL
    },
    body: 'TRIGGER ALARM - AstroVials no longer shows the current "Coming soon / This shop is not open yet" screen. Check the site now.'
  });

  if (!response.ok) {
    throw new Error(`ntfy HTTP ${response.status}`);
  }
}

async function checkSiteChange() {
  const siteResponse = await fetch(`${SITE_URL}?sitecheck=${Date.now()}`, {
    headers: {
      'Accept': 'text/html',
      'Cache-Control': 'no-cache',
      'User-Agent': 'Mozilla/5.0 AstroVialsStockWatcher/1.0'
    }
  });

  if (!siteResponse.ok) {
    throw new Error(`AstroVials site HTTP ${siteResponse.status}`);
  }

  const html = await siteResponse.text();
  const state = detectSiteState(html);
  const previousState = await getPreviousSiteState();
  const shouldNotify = state === 'changed' && previousState === 'coming_soon';

  if (shouldNotify) {
    await sendSiteAlarm();
  }

  await saveSiteState(state);

  return {
    ok: true,
    state,
    previousState,
    notified: shouldNotify
  };
}

exports.handler = async function() {
  try {
    let siteCheck;

    try {
      siteCheck = await checkSiteChange();
    } catch (error) {
      siteCheck = {
        ok: false,
        error: error?.message || String(error)
      };
    }

    const productResponse = await fetch(`${PRODUCT_URL}?stockcheck=${Date.now()}`, {
      headers: {
        'Accept': 'text/html',
        'Cache-Control': 'no-cache',
        'User-Agent': 'Mozilla/5.0 AstroVialsStockWatcher/1.0'
      }
    });

    if (!productResponse.ok) {
      return json(502, {
        ok: false,
        error: `AstroVials HTTP ${productResponse.status}`,
        siteCheck
      });
    }

    const html = await productResponse.text();
    const state = detectStock(html);
    const previousState = await getPreviousState();
    const shouldNotify = state !== 'out_of_stock' && previousState !== state;

    if (shouldNotify) {
      await sendAlarm(state);
    }

    await saveState(state);

    return json(200, {
      ok: true,
      state,
      previousState,
      notified: shouldNotify,
      siteCheck
    });
  } catch (error) {
    return json(502, { ok: false, error: error?.message || String(error) });
  }
};
