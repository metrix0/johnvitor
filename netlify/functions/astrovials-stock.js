const { createHash } = require('node:crypto');
const { connectLambda, getStore } = require('@netlify/blobs');

const PAGE_URL = 'https://astrovials.com/en/shop/estradiol-enanthate-mct';
const ALERT_TOPIC_URL = 'https://ntfy.sh/astrovialseen';
const STORE_NAME = 'astrovials-page-monitor';
const STORE_KEY = 'estradiol-enanthate-mct-v1';

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    body: JSON.stringify(body)
  };
}

function excerpt(content, index) {
  const start = Math.max(0, index - 50);
  return content.slice(start, index + 80).replace(/[\r\n\t]+/g, ' ').slice(0, 140);
}

function describeDifference(oldHtml, newHtml) {
  if (typeof oldHtml !== 'string') return 'The previous page snapshot was not available.';
  let index = 0;
  while (index < oldHtml.length && index < newHtml.length && oldHtml[index] === newHtml[index]) index++;
  return `Before: ${excerpt(oldHtml, index)}\nAfter: ${excerpt(newHtml, index)}`;
}

async function notify(title, message) {
  // Do not suppress the alert on a network error: the next scheduled run must retry.
  let lastError;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(ALERT_TOPIC_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          Title: title,
          Priority: '5',
          Tags: 'warning,rotating_light',
          Click: PAGE_URL
        },
        body: message,
        signal: AbortSignal.timeout(5000)
      });
      if (!response.ok) throw new Error(`ntfy HTTP ${response.status}`);
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

exports.handler = async function(event) {
  try {
    connectLambda(event);
    // Lambda's Netlify Blobs context supports eventual consistency here.
    // Site-wide Blobs persist between deployments (unlike in-memory state or ntfy history).
    const store = getStore(STORE_NAME);
    const previous = await store.get(STORE_KEY, { type: 'json' });

    const siteResponse = await fetch(PAGE_URL, {
      headers: {
        Accept: 'text/html',
        'Cache-Control': 'no-cache, no-store',
        Pragma: 'no-cache',
        'User-Agent': 'Mozilla/5.0 AstroVialsPageWatcher/2.0'
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(12000)
    });
    if (!siteResponse.ok) throw new Error(`AstroVials HTTP ${siteResponse.status}`);
    const contentType = siteResponse.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) throw new Error(`Unexpected AstroVials content type: ${contentType || 'none'}`);

    const html = await siteResponse.text();
    if (!html.trim()) throw new Error('AstroVials returned an empty page');

    // Compare the entire response, not just availability labels or a single page state.
    const hash = createHash('sha256').update(html, 'utf8').digest('hex');
    if (previous?.hash === hash) {
      return json(200, { ok: true, changed: false, notified: false, hash });
    }

    const isFirstRun = !previous?.hash;
    const description = isFirstRun
      ? 'No previous baseline existed. The current page has been captured and this is an initial alarm.'
      : describeDifference(previous.html, html);

    await notify(
      isFirstRun ? 'ALARM - AstroVials monitor initialized' : 'ALARM - AstroVials PRODUCT PAGE CHANGED',
      `${isFirstRun ? 'INITIAL WATCHER ALARM' : 'PAGE CONTENT CHANGED'}\n${PAGE_URL}\n${description}`
    );

    // Only acknowledge the new state after ntfy confirms accepting the alert.
    // If notification fails, keep the old hash so next run tries again.
    await store.setJSON(STORE_KEY, { hash, html, checkedAt: new Date().toISOString() });

    return json(200, { ok: true, changed: !isFirstRun, initialized: isFirstRun, notified: true, hash });
  } catch (error) {
    const reason = error?.message || String(error);
    console.error('AstroVials watcher failure:', reason);
    let failureAlarmSent = false;
    try {
      await notify('ALARM - AstroVials WATCHER FAILED', `AstroVials watcher failed: ${reason}\n${PAGE_URL}`);
      failureAlarmSent = true;
    } catch (notifyError) {
      console.error('AstroVials failure notification also failed:', notifyError);
    }
    return json(502, { ok: false, error: reason, failureAlarmSent });
  }
};