// Independent GitHub Actions backup. Durable comparison state lives on a dedicated
// GitHub branch, never in the expiring ntfy history or the website's main branch.
import pageFingerprint from '../../lib/astrovials-page-fingerprint.js';
import pageFetch from '../../lib/astrovials-page-fetch.js';

const { hashSnapshot } = pageFingerprint;
const { fetchProductSnapshot } = pageFetch;
const PAGE_URL = 'https://astrovials.com/en/shop/estradiol-enanthate-mct';
const ALERT_TOPIC_URL = 'https://ntfy.sh/astrovialseen';

const STATE_BRANCH = 'astrovials-watcher-state';  // Keep stable across code revisions.
const STATE_PATH = 'astrovials/estradiol-enanthate-mct.json';
const ALGORITHM = 'product-dom-semantic-v2';
const githubRepo = process.env.GITHUB_REPOSITORY;
const githubToken = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;

async function githubRequest(url, options = {}) {
  if (!githubRepo || !githubToken) throw new Error('GitHub state storage not configured');
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: 'Bearer ' + githubToken,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.headers || {})
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(10000)
  });
  const raw = await response.text();
  if (!response.ok) throw new Error('GitHub state HTTP ' + response.status + ': ' + raw.slice(0,300));
  return JSON.parse(raw);
}

const stateUrl = () =>
  'https://api.github.com/repos/' + githubRepo + '/contents/' + STATE_PATH;

async function readState() {
  const data = await githubRequest(stateUrl() + '?ref=' + encodeURIComponent(STATE_BRANCH));
  const current = JSON.parse(Buffer.from(data.content.replace(/\s/g, ''), 'base64').toString('utf8'));
  if (current.version !== 1 || current.algorithm !== ALGORITHM ||
      current.page !== PAGE_URL || !/^[a-f0-9]{64}$/.test(current.hash)) {
    // Never silently reset or compare differently-versioned snapshots.
    throw new Error('Backup baseline exists but has an incompatible format');
  }
  return { current, blobSha: data.sha };
}

async function saveState(next, blobSha) {
  const content = Buffer.from(JSON.stringify(next, null, 2) + '\n').toString('base64');
  await githubRequest(stateUrl(), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'chore(watcher-state): update durable AstroVials product fingerprint',
      branch: STATE_BRANCH,
      sha: blobSha,
      content
    })
  });
}

async function sendAlarm(previous, current) {
  let lastError;
  for (let attempt=0; attempt<2; attempt++) {
    try {
      const response = await fetch(ALERT_TOPIC_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          Title: 'ALARM TRIGGER - AstroVials PRODUCT PAGE CHANGED (BACKUP)',
          Priority: '5',
          Tags: 'warning,rotating_light',
          Click: PAGE_URL
        },
        body: 'PRODUCT PAGE CONTENT CHANGED\n' + PAGE_URL +
          '\nPrevious fingerprint: ' + previous +
          '\nCurrent fingerprint: ' + current,
        signal: AbortSignal.timeout(9000)
      });
      if (!response.ok) throw new Error('ntfy HTTP ' + response.status);
      return;
    } catch (error) { lastError = error; }
  }
  throw lastError;
}

async function main() {
  // First load durable history. Missing/unreadable history is an error, never
  // a page change and never permission to silently choose a new baseline.
  const { current: previous, blobSha } = await readState();
  const { snapshot, attempts } = await fetchProductSnapshot({
    url: PAGE_URL,
    userAgent: 'Mozilla/5.0 AstroVialsGitHubBackup/4.0'
  });
  const hash = hashSnapshot(snapshot);
  if (process.env.ASTROVIALS_BACKUP_DRY_RUN === '1') {
    console.log(JSON.stringify({ok:true,dryRun:true,baselineFound:true,changed:previous.hash!==hash,hash,previousHash:previous.hash,attempts}));
    return;
  }
  if (previous.hash !== hash) {
    await sendAlarm(previous.hash, hash);
  }
  // Store current canonical DOM for diagnosing any future false positives.
  // Save after sending, so failed notifications don't discard the change.
  if (previous.hash !== hash || previous.snapshot !== snapshot) {
    await saveState({
      version: 1,
      algorithm: ALGORITHM,
      page: PAGE_URL,
      hash,
      snapshot,
      checkedAt: new Date().toISOString()
    }, blobSha);
  }
  console.log(JSON.stringify({
    ok: true, provider: 'github-actions',
    changed: previous.hash !== hash,
    notified: previous.hash !== hash,
    hash, attempts, stateBranch: STATE_BRANCH
  }));
}

main().catch(error => {
  // Failed GitHub jobs are surfaced in Actions, without spamming the phone
  // with a false "page changed" alert.
  console.error('AstroVials backup monitor FAILED:',error?.message||String(error));
  process.exitCode=1;
});
