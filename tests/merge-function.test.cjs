const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { handler } = require('../netlify/functions/merge.js');
const SHA = 'a'.repeat(40);
const PR = { number: 12, state: 'open', merged: false, html_url: 'https://github.com/metrix0/imenu/pull/12', head: { ref: 'preview', sha: SHA, repo: { full_name: 'metrix0/imenu' } }, base: { ref: 'main' } };
const SNAPSHOT_PR = { ...PR, head: { ...PR.head, ref: "merge-snapshot-" + SHA } };
const comparison = { ahead_by: 2, files: [{ filename: 'app.ts' }], commits: [{ sha: SHA, commit: { message: 'Fix menu\n\nDetails' } }] };
const check = { id: 10, name: 'merge-typecheck', status: 'completed', conclusion: 'success', html_url: 'https://github.com/metrix0/imenu/actions/runs/10' };
const originalFetch = global.fetch;
const originalToken = process.env.GITHUB_MERGE_TOKEN;
const originalLog = console.error;
afterEach(() => { global.fetch = originalFetch; console.error = originalLog; if (originalToken === undefined) delete process.env.GITHUB_MERGE_TOKEN; else process.env.GITHUB_MERGE_TOKEN = originalToken; });
function setup(overrides = {}) {
  process.env.GITHUB_MERGE_TOKEN = 'test-token';
  console.error = () => {};
  const calls = [];
  global.fetch = async (url, options = {}) => {
    const path = new URL(url).pathname.replace('/repos/metrix0/imenu', '');
    const method = options.method || 'GET';
    calls.push({ path, method, body: options.body ? JSON.parse(options.body) : null });
    if (path === '/msg/app.js') return new Response('const API_KEY = "test-abc";');
    if (path === '/api/health' && !overrides[path]) return Response.json({ ok: true });
    if (overrides[path]) return overrides[path](options, calls);
    if (path === '/compare/main...preview' || path === `/compare/main...${SHA}`) return Response.json(comparison);
    if (path === '/branches/preview') return Response.json({ commit: { sha: SHA } });
    if (path === '/pulls') return Response.json(method === 'POST' ? SNAPSHOT_PR : [SNAPSHOT_PR]);
    if (path === '/git/refs') return Response.json({ ref: 'refs/heads/merge-snapshot-' + SHA });
    if (path === '/pulls/12') return Response.json(PR);
    if (path === `/commits/${SHA}/check-runs`) return Response.json({ check_runs: [check] });
    if (path === '/pulls/12/merge') return Response.json({ merged: true, sha: 'b'.repeat(40) });
    if (path === '/actions/runs') return Response.json({ workflow_runs: [] });
    throw new Error(`Unexpected request: ${method} ${path}`);
  };
  return calls;
}
async function run(action, extra = {}) {
  const response = await handler({ httpMethod: 'POST', body: JSON.stringify({ project: 'imenu', password: 'abc', ...(action ? { action } : {}), ...extra }) });
  return { status: response.statusCode, ...JSON.parse(response.body) };
}
function noMerge(calls) { assert.equal(calls.filter(call => call.method === 'PUT').length, 0); }

test('status only compares branches: no PR creation or validation', async () => {
  const calls = setup();
  const data = await run('status');
  assert.deepEqual(data.commits, ['Fix menu']);
  assert.equal(data.status, 200);
  assert.deepEqual(calls.map(call => call.path), ['/msg/app.js', '/compare/main...preview']);
});
test('VPS statuses use production health and last three preview workflow runs', async () => {
  const calls = setup({
    '/branches/preview': () => Response.json({ commit: { sha: SHA } }),
    '/actions/runs': () => Response.json({ workflow_runs: [
      { path: '.github/workflows/validate-build.yml', head_sha: SHA, created_at: '2026-10-16T14:00:00Z' },
      { path: '.github/workflows/deploy-vps-preview.yml', head_sha: SHA, status: 'completed', conclusion: 'success', created_at: '2026-10-16T13:00:00Z', html_url: 'https://github.com/metrix0/imenu/actions/runs/12' },
      { path: '.github/workflows/deploy-vps-preview.yml', head_sha: 'b'.repeat(40), status: 'completed', conclusion: 'failure', created_at: '2026-10-16T12:00:00Z' },
      { path: '.github/workflows/deploy-vps-preview.yml', head_sha: 'c'.repeat(40), status: 'completed', conclusion: 'success', created_at: '2026-10-16T11:00:00Z' },
      { path: '.github/workflows/deploy-vps-preview.yml', head_sha: 'd'.repeat(40), status: 'completed', conclusion: 'success', created_at: '2026-10-16T10:00:00Z' }
    ] })
  });
  const data = await run('deploy-status');
  assert.equal(data.ok, true);
  assert.deepEqual(data.deployments.main, { state: 'success', sha: null, url: 'https://www.imenuapp.com.br', history: [] });
  assert.equal(data.deployments.preview.state, 'success');
  assert.equal(data.deployments.preview.sha, SHA);
  assert.equal(data.deployments.preview.history.length, 3);
  assert.deepEqual(data.deployments.preview.history.map(x => x.state), ['success', 'failure', 'success']);
  assert.equal(data.deployments.preview.url, 'https://github.com/metrix0/imenu/actions/runs/12');
  assert.deepEqual(calls.map(x => x.path), ['/msg/app.js', '/branches/preview', '/actions/runs', '/api/health']);
  noMerge(calls);
});
test('old preview workflow runs are not presented as current deployment', async () => {
  setup({
    '/branches/preview': () => Response.json({ commit: { sha: SHA } }),
    '/actions/runs': () => Response.json({ workflow_runs: [
      { path: '.github/workflows/deploy-vps-preview.yml', head_sha: 'b'.repeat(40), status: 'completed', conclusion: 'success', created_at: '2026-10-16T10:00:00Z' }
    ] })
  });
  const data = await run('deploy-status');
  assert.equal(data.deployments.preview.state, 'not_deployed');
  assert.equal(data.deployments.preview.history.length, 1);
});
test('unreachable production health does not count as a failed deployment', async () => {
  setup({
    '/branches/preview': () => Response.json({ commit: { sha: SHA } }),
    '/actions/runs': () => Response.json({ workflow_runs: [] }),
    '/api/health': () => { throw new Error('Unreachable'); }
  });
  const data = await run('deploy-status');
  assert.equal(data.deployments.main.state, 'unknown');
  assert.equal(data.deployments.preview.state, 'unknown');
});
test('authentication failure makes no GitHub calls', async () => {
  const calls = setup();
  assert.equal((await run('validate', { password: 'wrong' })).status, 401);
  assert.equal(calls.length, 1);
});
test('synced preview does not create a PR or merge', async () => {
  const calls = setup({ '/compare/main...preview': () => Response.json({ ...comparison, files: [] }) });
  assert.equal((await run('validate')).synced, true);
  assert.equal(calls.length, 3);
});
test('validation success returns the exact head and never merges', async () => {
  const calls = setup();
  const data = await run('validate');
  assert.equal(data.ready, true); assert.equal(data.headSha, SHA); assert.equal(data.validation.typecheck.state, 'success');
  noMerge(calls);
});
test('pending validation exposes queued/running state without merging', async () => {
  const calls = setup({ [`/commits/${SHA}/check-runs`]: () => Response.json({ check_runs: [{ ...check, status: 'in_progress', conclusion: null }] }) });
  const data = await run('validate');
  assert.equal(data.status, 202); assert.equal(data.pending, true); assert.equal(data.validation.typecheck.status, 'in_progress');
  noMerge(calls);
});
test('failed validation retains source locations and errors', async () => {
  const calls = setup({
    [`/commits/${SHA}/check-runs`]: () => Response.json({ check_runs: [{ ...check, conclusion: 'failure' }] }),
    '/check-runs/10/annotations': () => Response.json([{ path: 'menu.ts', start_line: 4, message: 'TS2322: Type mismatch' }])
  });
  const data = await run('validate');
  assert.equal(data.status, 409); assert.match(data.error, /menu.ts:4\nTS2322/);
  noMerge(calls);
});
test('cancelled checks cannot pass validation', async () => {
  const calls = setup({ [`/commits/${SHA}/check-runs`]: () => Response.json({ check_runs: [{ ...check, conclusion: 'cancelled' }] }) });
  const data = await run('validate');
  assert.equal(data.validation.failed, true); assert.equal(data.validation.typecheck.conclusion, 'cancelled');
  noMerge(calls);
});
test('latest applicable check controls validation', async () => {
  const calls = setup({ [`/commits/${SHA}/check-runs`]: () => Response.json({ check_runs: [check, { ...check, id: 20, conclusion: 'cancelled' }, { ...check, id: 30, conclusion: 'skipped' }] }) });
  assert.equal((await run('validate')).validation.failed, true);
  noMerge(calls);
});
test('blocked checks retain existing close/reopen recovery', async () => {
  const calls = setup({
    [`/commits/${SHA}/check-runs`]: () => Response.json({ check_runs: [] }),
    '/actions/runs': () => Response.json({ workflow_runs: [{ id: 1, path: '.github/workflows/validate-build.yml', conclusion: 'action_required', html_url: 'https://github.com/metrix0/imenu/actions/runs/1' }] })
  });
  assert.equal((await run('validate')).pending, true);
  assert.deepEqual(calls.filter(call => call.method === 'PATCH').map(call => call.body.state), ['closed', 'open']);
  noMerge(calls);
});
test('newer workflow avoids repeatedly restarting a blocked run', async () => {
  const calls = setup({
    [`/commits/${SHA}/check-runs`]: () => Response.json({ check_runs: [] }),
    '/actions/runs': () => Response.json({ workflow_runs: [
      { id: 1, path: '.github/workflows/validate-build.yml', conclusion: 'action_required', created_at: '2026-10-10T10:00:00Z' },
      { id: 2, path: '.github/workflows/validate-build.yml', conclusion: null, created_at: '2026-10-10T10:01:00Z', html_url: 'https://github.com/metrix0/imenu/actions/runs/2' }
    ] })
  });
  assert.equal((await run('validate')).pending, true);
  assert.equal(calls.filter(call => call.method === 'PATCH').length, 0);
});
test('merge rejects a head that changed after validation', async () => {
  const calls = setup({ '/pulls/12': () => Response.json({ ...PR, head: { ...PR.head, sha: 'c'.repeat(40) } }) });
  const data = await run('merge', { pr: 12, headSha: SHA });
  assert.equal(data.code, 'preview_changed'); noMerge(calls);
});
test('merge revalidates and pins the GitHub PUT to the validated head', async () => {
  const calls = setup();
  const data = await run('merge', { pr: 12, headSha: SHA });
  assert.equal(data.merged, true);
  assert.deepEqual(calls.find(call => call.method === 'PUT').body, { merge_method: 'squash', sha: SHA });
});
test('merge refuses when validation is pending again', async () => {
  const calls = setup({ [`/commits/${SHA}/check-runs`]: () => Response.json({ check_runs: [] }) });
  assert.equal((await run('merge', { pr: 12, headSha: SHA })).pending, true);
  noMerge(calls);
});
test('legacy merge callers still validate and squash merge', async () => {
  const calls = setup();
  assert.equal((await run()).merged, true);
  assert.equal(calls.find(call => call.method === 'PUT').body.sha, SHA);
});
test('a known GitHub refusal is not reported as uncertain', async () => {
  setup({ '/pulls/12/merge': () => Response.json({ message: 'Merge conflict' }, { status: 409 }) });
  const data = await run('merge', { pr: 12, headSha: SHA });
  assert.equal(data.status, 409); assert.equal(data.uncertain, undefined); assert.equal(data.pr, 12);
});
test('lost write response preserves PR metadata for read-only confirmation', async () => {
  setup({ '/pulls/12/merge': () => { throw new Error('Connection lost'); } });
  const data = await run('merge', { pr: 12, headSha: SHA });
  assert.equal(data.uncertain, true); assert.equal(data.pr, 12);
});
test('result confirms previous merge even when newer preview changes exist', async () => {
  const calls = setup({ '/pulls/12': () => Response.json({ ...PR, merged: true, state: 'closed', merge_commit_sha: 'b'.repeat(40) }) });
  const data = await run('result', { pr: 12 });
  assert.equal(data.merged, true); assert.equal(data.sha, 'b'.repeat(40));
  assert.deepEqual(calls.map(call => call.path), ['/msg/app.js', '/pulls/12']); noMerge(calls);
});
test('result distinguishes open from closed without merging', async () => {
  setup(); assert.equal((await run('result', { pr: 12 })).closed, false);
  const calls = setup({ '/pulls/12': () => Response.json({ ...PR, state: 'closed' }) });
  const data = await run('result', { pr: 12 });
  assert.equal(data.closed, true); assert.equal(data.merged, false); noMerge(calls);
});
test('result rejects unrelated PRs', async () => {
  const calls = setup({ '/pulls/12': () => Response.json({ ...PR, head: { ...PR.head, ref: 'feature' } }) });
  assert.equal((await run('result', { pr: 12 })).status, 400); noMerge(calls);
});
test('invalid action and missing validated SHA are rejected before API calls', async () => {
  const calls = setup();
  assert.equal((await run('delete')).status, 400);
  assert.equal((await run('merge', { pr: 12 })).status, 400);
  assert.equal((await run('result', { pr: '../other' })).status, 400);
  assert.equal(calls.length, 0);
});

test('validation creates a missing snapshot PR, without sending a merge', async () => {
  const calls = setup({ '/pulls': options => Response.json(options.method === 'POST' ? SNAPSHOT_PR : []) });
  assert.equal((await run('validate')).ready, true);
  assert.deepEqual(calls.find(call => call.path === '/pulls' && call.method === 'POST').body, { title: 'Preview', head: 'merge-snapshot-' + SHA, base: 'main' });
  noMerge(calls);
});
test('concurrent PR creation reuses the PR returned after GitHub 422', async () => {
  let reads = 0;
  const calls = setup({ '/pulls': options => {
    if (options.method === 'POST') return Response.json({ message: 'Already exists' }, { status: 422 });
    return Response.json(++reads === 1 ? [] : [SNAPSHOT_PR]);
  } });
  assert.equal((await run('validate')).pr, 12); noMerge(calls);
});
test('an incomplete write response cannot be reported as not merged', async () => {
  setup({ '/pulls/12/merge': () => new Response('{"merged":tr') });
  const data = await run('merge', { pr: 12, headSha: SHA });
  assert.equal(data.uncertain, true); assert.equal(data.pr, 12);
});

test('snapshot remains pinned when newer preview commits arrive during validation', async () => {
  const newer = 'c'.repeat(40);
  const calls = setup({
    '/pulls/12': () => Response.json(SNAPSHOT_PR),
    '/branches/preview': () => Response.json({ commit: { sha: SHA } })
  });
  const first = await run('validate');
  assert.equal(first.headSha, SHA);
  const poll = await run('validate', { pr: first.pr });
  assert.equal(poll.headSha, SHA);
  const merged = await run('merge', { pr: first.pr, headSha: SHA });
  assert.equal(merged.merged, true);
  assert.equal(calls.filter(x => x.path === '/branches/preview').length, 1);
  const put = calls.find(x => x.path === '/pulls/12/merge');
  assert.equal(put.body.sha, SHA);
  assert.match(put.body.commit_message, /merge-snapshot:/);
});
