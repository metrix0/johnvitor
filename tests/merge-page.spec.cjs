const { test, expect, chromium } = require('playwright/test');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const SHA = 'a'.repeat(40);
const ready = { ok: true, ready: true, pr: 12, prUrl: 'https://github.com/metrix0/imenu/pull/12', headSha: SHA, commits: ['Improve menu'], validation: { ready: true, typecheck: { state: 'success', status: 'completed', url: 'https://github.com/metrix0/imenu/actions/runs/10' } } };
const merged = { ok: true, merged: true, pr: 12, prUrl: ready.prUrl, sha: 'b'.repeat(40) };
const synced = { ok: true, synced: true, commits: [] };
let server, browser, base;
test.beforeAll(async () => {
  server = http.createServer((req, res) => {
    if (req.url.startsWith('/msg/app.js')) { res.setHeader('Content-Type', 'application/javascript'); res.end('const API_KEY = "test-abc";'); return; }
    if (req.url === '/merge') { res.setHeader('Content-Type', 'text/html'); res.end(fs.readFileSync(path.join(__dirname, '../merge/index.html'))); return; }
    res.writeHead(404); res.end();
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ executablePath: process.env.MERGE_TEST_CHROMIUM || undefined, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
});
test.afterAll(async () => { await browser?.close(); if (server) await new Promise(resolve => server.close(resolve)); });
async function setup(mock, options = {}) {
  const context = await browser.newContext({ viewport: options.viewport || { width: 1200, height: 900 } });
  const page = await context.newPage();
  const calls = [], errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem('ANKI_APP_ACCESS_UNTIL', String(Date.now() + 60000)));
  await page.route('**/api/merge', async route => {
    const body = route.request().postDataJSON(); calls.push(body);
    const result = await mock(body, calls);
    if (result === 'abort') { await route.abort('failed'); return; }
    await route.fulfill({ status: result.status || 200, contentType: 'application/json', body: JSON.stringify(result.body || result) });
  });
  await page.goto(`${base}/merge`);
  return { context, page, calls, errors, card: page.locator('[data-id="imenu"]') };
}
const status = { ok: true, commits: ['Improve menu', '<script>Untrusted title</script>'] };
function defaultMock(body) { return body.project === 'engravida' ? synced : status; }

test('loading the page only reads status and keeps commit titles as text', async () => {
  const { context, page, card, calls, errors } = await setup(defaultMock);
  await expect(card.getByRole('button')).toHaveText('Validate & merge');
  await expect(card.locator('.commits li')).toHaveCount(2);
  await expect(card.locator('.commits')).toContainText('<script>Untrusted title</script>');
  expect(calls.every(call => call.action === 'status')).toBeTruthy();
  await expect(page.locator('[data-id="engravida"] .badge')).toHaveText('Synced');
  expect(errors).toEqual([]);
  if (process.env.MERGE_SCREENSHOTS) await page.screenshot({ path: `${process.env.MERGE_SCREENSHOTS}/ready.png`, fullPage: true });
  await context.close();
});
test('queued → running → passed → merged remains visible after refresh and reload', async () => {
  let validations = 0, hasMerged = false;
  let releaseMerge;
  const mergeGate = new Promise(resolve => { releaseMerge = resolve; });
  const { context, page, card, calls, errors } = await setup(async body => {
    if (body.project === 'engravida') return synced;
    if (body.action === 'status') return hasMerged ? synced : status;
    if (body.action === 'validate') {
      validations++;
      if (validations < 3) return { status: 202, body: { ...ready, ready: false, pending: true, validation: { typecheck: { state: 'pending', status: validations === 1 ? 'queued' : 'in_progress', url: ready.validation.typecheck.url } } } };
      return ready;
    }
    if (body.action === 'merge') { await mergeGate; hasMerged = true; return merged; }
    throw new Error('Unexpected action');
  });
  await card.getByRole('button').click();
  await expect(card.getByRole('heading', { name: 'Waiting for the TypeScript check' })).toBeVisible();
  await expect(card.getByRole('button')).toBeDisabled();
  await expect(card.locator('.step').nth(0)).toHaveAttribute('data-state', 'active');
  await expect(card.getByRole('heading', { name: 'TypeScript check is running' })).toBeVisible({ timeout: 6000 });
  expect(calls.filter(call => call.action === 'merge')).toHaveLength(0);
  await expect(card.getByRole('heading', { name: 'Validation passed · merging' })).toBeVisible({ timeout: 6000 });
  await expect(card.locator('.step').nth(0)).toHaveAttribute('data-state', 'done');
  releaseMerge();
  await expect(card.getByRole('heading', { name: 'Merged successfully' })).toBeVisible();
  await expect(card.getByRole('button')).toHaveText('Merged successfully ✓');
  await expect(card.locator('.commits li')).toHaveCount(0);
  expect(calls.filter(call => call.action === 'merge')).toEqual([expect.objectContaining({ pr: 12, headSha: SHA })]);
  expect(errors).toEqual([]);
  if (process.env.MERGE_SCREENSHOTS) await page.screenshot({ path: `${process.env.MERGE_SCREENSHOTS}/merged.png`, fullPage: true });
  await page.reload();
  await expect(card.getByRole('heading', { name: 'Merged successfully' })).toBeVisible();
  expect(calls.filter(call => call.action === 'merge')).toHaveLength(1);
  await context.close();
});
test('validation failure stays inline, preserves errors, and sends no merge', async () => {
  const { context, page, card, calls } = await setup(body => body.action === 'validate'
    ? { status: 409, body: { ok: false, error: 'TypeScript validation failed.', pr: 12, prUrl: ready.prUrl, validation: { typecheck: { state: 'failure', error: 'menu.ts:4\nTS2322: Type mismatch', url: ready.validation.typecheck.url } } } }
    : defaultMock(body));
  await card.getByRole('button').click();
  await expect(card.getByRole('heading', { name: 'Validation did not pass · not merged' })).toBeVisible();
  await expect(card.locator('pre')).toContainText('menu.ts:4');
  await expect(card.getByRole('link', { name: 'TypeScript check' })).toHaveAttribute('href', ready.validation.typecheck.url);
  await page.waitForTimeout(1500);
  await expect(card.locator('.badge')).toHaveText('Not merged');
  expect(calls.filter(call => call.action === 'merge')).toHaveLength(0);
  if (process.env.MERGE_SCREENSHOTS) await page.screenshot({ path: `${process.env.MERGE_SCREENSHOTS}/failed.png`, fullPage: true });
  await context.close();
});
test('preview changes after validation are clearly not merged', async () => {
  const { context, card, calls } = await setup(body => {
    if (body.action === 'validate') return ready;
    if (body.action === 'merge') return { status: 409, body: { ok: false, code: 'preview_changed', error: 'Preview changed', commits: ['A newer change'] } };
    return defaultMock(body);
  });
  await card.getByRole('button').click();
  await expect(card.locator('.outcome')).toContainText('Preview changed after validation');
  await expect(card.getByRole('button')).toHaveText('Retry validation & merge');
  await expect(card.locator('.commits')).toContainText('A newer change');
  expect(calls.filter(call => call.action === 'merge')).toHaveLength(1);
  await context.close();
});
test('lost response checks the existing PR and confirms success without retrying merge', async () => {
  const { context, card, calls } = await setup(body => {
    if (body.action === 'validate') return ready;
    if (body.action === 'merge') return 'abort';
    if (body.action === 'result') return merged;
    return defaultMock(body);
  });
  await card.getByRole('button').click();
  await expect(card.getByRole('heading', { name: 'Merged successfully' })).toBeVisible();
  expect(calls.filter(call => call.action === 'merge')).toHaveLength(1);
  expect(calls.filter(call => call.action === 'result')).toHaveLength(1);
  await expect(card.getByRole('button')).toHaveText('Merge new changes');
  await expect(card.locator('.outcome')).toContainText('New preview changes');
  await context.close();
});
test('unconfirmed result stays honest and Check result only reads GitHub', async () => {
  let confirm = false;
  const { context, page, card, calls } = await setup(body => {
    if (body.action === 'validate') return ready;
    if (body.action === 'merge') return { status: 500, body: { ok: false, uncertain: true, pr: 12, error: 'Lost connection' } };
    if (body.action === 'result') return confirm ? merged : { ok: true, merged: false, closed: false, pr: 12 };
    return defaultMock(body);
  });
  await card.getByRole('button').click();
  await expect(card.getByRole('heading', { name: 'Merge result not confirmed' })).toBeVisible({ timeout: 14000 });
  await expect(card.getByRole('button')).toHaveText('Check merge result');
  expect(calls.filter(call => call.action === 'merge')).toHaveLength(1);
  if (process.env.MERGE_SCREENSHOTS) await page.screenshot({ path: `${process.env.MERGE_SCREENSHOTS}/unconfirmed.png`, fullPage: true });
  confirm = true;
  await card.getByRole('button').click();
  await expect(card.getByRole('heading', { name: 'Merged successfully' })).toBeVisible();
  expect(calls.filter(call => call.action === 'merge')).toHaveLength(1);
  await context.close();
});
test('reload during a merge recovers through a read-only result check', async () => {
  const { context, page, card, calls } = await setup(body => body.action === 'result' ? merged : defaultMock(body));
  await page.evaluate(() => sessionStorage.setItem('MERGE_RESULT_imenu', JSON.stringify({ phase: 'uncertain', pr: 12, prUrl: 'https://github.com/metrix0/imenu/pull/12' })));
  await page.reload();
  await expect(card.getByRole('heading', { name: 'Merged successfully' })).toBeVisible();
  expect(calls.filter(call => ['merge', 'validate'].includes(call.action))).toHaveLength(0);
  await context.close();
});
test('closed PR is confirmed as not merged', async () => {
  const { context, card } = await setup(body => {
    if (body.action === 'validate') return ready;
    if (body.action === 'merge') return 'abort';
    if (body.action === 'result') return { ok: true, merged: false, closed: true, pr: 12 };
    return defaultMock(body);
  });
  await card.getByRole('button').click();
  await expect(card.locator('.outcome')).toContainText('closed without merging');
  await expect(card.locator('.badge')).toHaveText('Not merged');
  await context.close();
});
test('loading error offers a read-only retry, not a merge', async () => {
  let fail = true;
  const { context, card, calls } = await setup(body => body.project === 'imenu' && fail ? { status: 500, body: { ok: false, error: 'GitHub unavailable' } } : defaultMock(body));
  await expect(card.getByRole('button')).toHaveText('Retry loading changes');
  fail = false;
  await card.getByRole('button').click();
  await expect(card.getByRole('button')).toHaveText('Validate & merge');
  expect(calls.every(call => call.action === 'status')).toBeTruthy();
  await context.close();
});
test('projects operate independently and the mobile page has no horizontal overflow', async () => {
  const { context, page, card, calls, errors } = await setup(body => body.action === 'validate'
    ? { status: 202, body: { ...ready, ready: false, pending: true } }
    : status, { viewport: { width: 390, height: 844 } });
  await card.getByRole('button').click();
  await expect(card.getByRole('button')).toBeDisabled();
  await expect(page.locator('[data-id="engravida"] button')).toBeEnabled();
  await page.locator('[data-id="engravida"] button').click();
  await expect.poll(() => calls.filter(call => call.action === 'validate').length).toBe(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  expect(errors).toEqual([]);
  if (process.env.MERGE_SCREENSHOTS) await page.screenshot({ path: `${process.env.MERGE_SCREENSHOTS}/mobile.png`, fullPage: true });
  await context.close();
});

test('browser drives the actual function from validation to confirmed squash merge', async () => {
  const { handler } = require('../netlify/functions/merge.js');
  const originalFetch = global.fetch;
  const originalToken = process.env.GITHUB_MERGE_TOKEN;
  const githubCalls = [];
  let checks = 0, didMerge = false, context;
  process.env.GITHUB_MERGE_TOKEN = 'test-token';
  global.fetch = async (url, options = {}) => {
    const parsed = new URL(url);
    if (parsed.pathname === '/msg/app.js') return new Response('const API_KEY = "test-abc";');
    const route = parsed.pathname.replace('/repos/metrix0/imenu', '');
    githubCalls.push({ route, method: options.method || 'GET', body: options.body ? JSON.parse(options.body) : null });
    const pr = { number: 12, state: 'open', merged: false, html_url: ready.prUrl, head: { ref: 'preview', sha: SHA, repo: { full_name: 'metrix0/imenu' } }, base: { ref: 'main' } };
    if (route === '/compare/main...preview') return Response.json({ ahead_by: didMerge ? 0 : 1, files: didMerge ? [] : [{ filename: 'menu.ts' }], commits: [{ sha: SHA, commit: { message: 'Improve menu' } }] });
    if (route === '/pulls') return Response.json([pr]);
    if (route === '/pulls/12') return Response.json(pr);
    if (route === `/commits/${SHA}/check-runs`) return Response.json({ check_runs: [{ id: 10, name: 'merge-typecheck', status: ++checks === 1 ? 'in_progress' : 'completed', conclusion: checks === 1 ? null : 'success' }] });
    if (route === '/pulls/12/merge') { didMerge = true; return Response.json({ merged: true, sha: merged.sha }); }
    throw new Error(`Unexpected GitHub call: ${route}`);
  };
  try {
    const state = await setup(async body => {
      if (body.project === 'engravida') return synced;
      const result = await handler({ httpMethod: 'POST', headers: { host: 'example.test' }, body: JSON.stringify(body) });
      return { status: result.statusCode, body: JSON.parse(result.body) };
    });
    context = state.context;
    await state.card.getByRole('button').click();
    await expect(state.card.getByRole('heading', { name: 'TypeScript check is running' })).toBeVisible();
    await expect(state.card.getByRole('heading', { name: 'Merged successfully' })).toBeVisible({ timeout: 7000 });
    await expect(state.card.getByRole('button')).toHaveText('Merged successfully ✓');
    expect(githubCalls.filter(call => call.method === 'PUT')).toEqual([{ route: '/pulls/12/merge', method: 'PUT', body: { merge_method: 'squash', sha: SHA } }]);
    expect(state.errors).toEqual([]);
  } finally {
    await context?.close(); global.fetch = originalFetch;
    if (originalToken === undefined) delete process.env.GITHUB_MERGE_TOKEN; else process.env.GITHUB_MERGE_TOKEN = originalToken;
  }
});
