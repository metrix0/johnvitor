// Persistent, non-expiring GitHub state for the independent AstroVials backup.
// Do not rename the branch/path when updating watcher code: doing so loses history.
const BASELINE_BRANCH = 'astrovials-watcher-state';
const BASELINE_PATH = 'astrovials/estradiol-enanthate-mct.json';
const PAGE_URL = 'https://astrovials.com/en/shop/estradiol-enanthate-mct';
const ALGORITHM = 'product-dom-semantic-v2';

async function request(url, { token, method='GET', body, fetchImpl=globalThis.fetch }) {
  if (!token) throw new Error('Missing GH_TOKEN: cannot read the persistent backup baseline');
  const response = await fetchImpl(url, {
    method,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: 'Bearer ' + token,
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      'User-Agent': 'AstroVialsGitHubBackup/4.0'
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) {
    throw new Error('Persistent GitHub baseline ' + method + ' failed: HTTP ' + response.status +
      ' (will not reset the baseline or send a false page-change alert)');
  }
  return response.json();
}

function githubUrl(repo) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo || '')) {
    throw new Error('Invalid GITHUB_REPOSITORY');
  }
  return 'https://api.github.com/repos/' + repo + '/contents/' + BASELINE_PATH;
}

async function readBaseline({token, repo, fetchImpl}) {
  // GitHub contents API is the primary source. A missing or deleted state file is an error,
  // never interpreted as a genuine website change or an instruction to silently reset.
  const data = await request(githubUrl(repo) + '?ref=' + BASELINE_BRANCH, {token, fetchImpl});
  if (data.type !== 'file' || !data.sha || typeof data.content !== 'string') {
    throw new Error('GitHub baseline file returned invalid metadata');
  }
  let parsed;
  try {
    parsed = JSON.parse(Buffer.from(data.content.replace(/\s/g,''),'base64').toString('utf8'));
  } catch {
    throw new Error('GitHub baseline content is corrupt; refusing to reset');
  }
  if (parsed.version !== 1 || parsed.algorithm !== ALGORITHM ||
      parsed.page !== PAGE_URL || !/^[0-9a-f]{64}$/.test(parsed.hash || '')) {
    throw new Error('GitHub baseline format or page does not match this watcher; migration required');
  }
  return {hash:parsed.hash, sha:data.sha};
}

async function writeBaseline({token, repo, fetchImpl, hash, sha}) {
  if (!/^[0-9a-f]{64}$/.test(hash || '') || !sha) {
    throw new Error('Refusing to write invalid GitHub baseline');
  }
  const document = {
    version:1,
    algorithm:ALGORITHM,
    page:PAGE_URL,
    hash,
    updatedAt:new Date().toISOString()
  };
  await request(githubUrl(repo), {
    token, fetchImpl, method:'PUT',
    body:{
      message:'chore(watcher-state): record verified AstroVials product page fingerprint',
      branch:BASELINE_BRANCH,
      sha,
      content:Buffer.from(JSON.stringify(document,null,2)+'\n','utf8').toString('base64')
    }
  });
}

module.exports = {readBaseline,writeBaseline,BASELINE_BRANCH,BASELINE_PATH,ALGORITHM};
