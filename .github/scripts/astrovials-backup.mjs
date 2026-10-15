// Independent GitHub Actions backup for the Netlify AstroVials watcher.
import { createHash } from 'node:crypto';

const PAGE_URL = 'https://astrovials.com/en/shop/estradiol-enanthate-mct';
const ALERT_TOPIC_URL = 'https://ntfy.sh/astrovialseen';
const STATE_TOPIC_URL = 'https://ntfy.sh/astrovialseen-github-v2-state-20261015-jv';
const HASH_PREFIX = 'sha256:';

function digest(html) {
  return createHash('sha256').update(html, 'utf8').digest('hex');
}

async function previousHash() {
  const response = await fetch(STATE_TOPIC_URL + '/json?poll=1&since=latest', {
    headers: { Accept: 'application/x-ndjson' },
    cache: 'no-store',
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw new Error('Backup state read HTTP ' + response.status);
  const messages = (await response.text())
    .split('\n').filter(Boolean)
    .map((line) => { try { return JSON.parse(line); } catch { return null; } })
    .filter((entry) => entry?.event === 'message' && typeof entry.message === 'string');
  const last = messages.at(-1)?.message || '';
  return /^sha256:[0-9a-f]{64}$/.test(last) ? last.slice(HASH_PREFIX.length) : null;
}

async function post(url, title, body, priority) {
  let error;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          Title: title,
          Priority: String(priority),
          ...(url === ALERT_TOPIC_URL ? { Tags: 'warning,rotating_light', Click: PAGE_URL } : {})
        },
        body,
        signal: AbortSignal.timeout(10000)
      });
      if (!response.ok) throw new Error('ntfy HTTP ' + response.status);
      return;
    } catch (caught) { error = caught; }
  }
  throw error;
}

async function main() {
  try {
    const previous = await previousHash();
    const response = await fetch(PAGE_URL, {
      headers: {
        Accept: 'text/html',
        'Cache-Control': 'no-cache, no-store',
        Pragma: 'no-cache',
        'User-Agent': 'Mozilla/5.0 AstroVialsGitHubBackup/2.0'
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(12000)
    });
    if (!response.ok) throw new Error('AstroVials HTTP ' + response.status);
    const type = response.headers.get('content-type') || '';
    if (!type.includes('text/html')) throw new Error('Unexpected page content type: ' + (type || 'none'));
    const html = await response.text();
    if (!html.trim()) throw new Error('AstroVials page returned empty HTML');
    const current = digest(html);

    if (previous === current) {
      console.log(JSON.stringify({ ok: true, changed: false, provider: 'github-actions' }));
      return;
    }

    // Alarm even if the previous state expired or was not initialized.
    const initialized = !previous;
    await post(
      ALERT_TOPIC_URL,
      initialized
        ? 'ALARM TRIGGER - AstroVials BACKUP MONITOR INITIALIZED'
        : 'ALARM TRIGGER - AstroVials PRODUCT PAGE CHANGED (BACKUP)',
      (initialized ? 'BACKUP WATCHER BASELINE MISSING OR EXPIRED' : 'BACKUP WATCHER DETECTED PAGE CHANGE') +
        '\n' + PAGE_URL + '\nPrevious SHA-256: ' + (previous || 'none') +
        '\nCurrent SHA-256: ' + current,
      5
    );

    // Never acknowledge an undelivered page change.
    await post(STATE_TOPIC_URL, 'AstroVials GitHub backup SHA-256 state', HASH_PREFIX + current, 1);
    console.log(JSON.stringify({ ok: true, changed: !initialized, initialized, notified: true, provider: 'github-actions' }));
  } catch (caught) {
    const reason = caught?.message || String(caught);
    console.error('AstroVials backup failed:', reason);
    try {
      await post(
        ALERT_TOPIC_URL,
        'ALARM TRIGGER - AstroVials BACKUP WATCHER FAILED',
        'Backup watcher failure: ' + reason + '\n' + PAGE_URL,
        5
      );
    } catch (alarmError) {
      console.error('Backup failure alarm also failed:', alarmError);
    }
    process.exitCode = 1;
  }
}

await main();
