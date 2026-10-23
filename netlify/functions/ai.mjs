import { createHash, randomBytes } from 'node:crypto';
import { getStore } from '@netlify/blobs';

const STORE = 'ai-report-inbox-v1';
const BASE = 'https://johnvitor.com';
const LIMIT = 60;


function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'private, no-store, max-age=0',
      'referrer-policy': 'no-referrer',
      'x-robots-tag': 'noindex, nofollow',
      'access-control-allow-origin': BASE
    }
  });
}
const digest = value => createHash('sha256').update(String(value)).digest('hex');
const token = () => randomBytes(32).toString('base64url');
const text = (v, max = 160) => String(v ?? '').trim().replace(/\s+/g, ' ').slice(0, max);
const validToken = v => typeof v === 'string' && /^[A-Za-z0-9_-]{40,100}$/.test(v);
function safeChatUrl(value) {
  if (!value) return '';
  try {
    const url = new URL(String(value));
    if (url.protocol !== 'https:' || !['chatgpt.com', 'chat.openai.com'].includes(url.hostname)) return '';
    const parts = url.pathname.split('/').filter(Boolean);
    const chatId = parts[0] === 'c' && parts.length === 2 ? parts[1] :
      parts[0] === 'g' && parts[2] === 'c' && parts.length === 4 ? parts[3] : '';
    if (!/^[a-f0-9-]{16,}$/i.test(chatId)) return '';
    return url.origin + url.pathname;
  } catch { return ''; }
}
function store() { return getStore({ name: STORE, consistency: 'strong' }); }
async function register() {
  const inbox = token(), write = token(), channel = token();
  const blobs = store();
  await Promise.all([
    blobs.setJSON('read/' + digest(inbox), { channel }, { onlyIfNew: true }),
    blobs.setJSON('write/' + digest(write), { channel }, { onlyIfNew: true })
  ]);
  return json(201, {
    ok: true,
    readKey: inbox,
    writeKey: write,
    reportUrl: BASE + '/ai?key=' + encodeURIComponent(write),
    version: 1
  });
}
async function submit(params) {
  const key = String(params.key || '');
  if (!validToken(key)) return json(401, { ok: false, error: 'Invalid reporting key' });
  const blobs = store();
  const who = await blobs.get('write/' + digest(key), { type: 'json' });
  if (!who?.channel) return json(401, { ok: false, error: 'Reporting key not recognized' });

  const kind = params.kind === 'cron' ? 'cron' : params.kind === 'chat' ? 'chat' : null;
  const status = ['done', 'blocked', 'unknown'].includes(params.status) ? params.status : null;
  const title = text(params.title, 100);
  const summary = text(params.summary, 280);
  const nonce = text(params.nonce, 80);
  if (!kind || !status || !title || !summary || !/^[a-zA-Z0-9_-]{8,80}$/.test(nonce)) {
    return json(400, { ok: false, error: 'Required: kind=chat|cron, status=done|blocked|unknown, title, summary, unique nonce (8-80 ASCII characters)' });
  }

  const channel = who.channel;
  const nonceKey = 'nonce/' + channel + '/' + digest(nonce);
  const prior = await blobs.get(nonceKey, { type: 'json' });
  if (prior?.id) return json(200, { ok: true, id: prior.id, duplicate: true });

  const now = new Date();
  const id = now.toISOString().replace(/[:.]/g, '-') + '-' + randomBytes(8).toString('hex');
  const report = {
    id, kind, status, title, summary,
    conversationUrl: safeChatUrl(params.conversationUrl || params.url),
    sourceId: text(params.sourceId, 100),
    reportedAt: now.toISOString()
  };
  await blobs.setJSON('event/' + channel + '/' + id, report, { onlyIfNew: true });
  await blobs.setJSON(nonceKey, { id }, { onlyIfNew: true });
  return json(201, { ok: true, id, stored: true, kind, status });
}
async function inbox(request) {
  const authorization = request.headers.get('authorization') || '';
  const readKey = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!validToken(readKey)) return json(401, { ok: false, error: 'Missing inbox credential' });
  const blobs = store();
  const who = await blobs.get('read/' + digest(readKey), { type: 'json' });
  if (!who?.channel) return json(401, { ok: false, error: 'Invalid inbox credential' });

  const prefix = 'event/' + who.channel + '/';
  const listing = await blobs.list({ prefix });
  const newest = listing.blobs
    .map(x => x.key)
    .filter(x => x.startsWith(prefix))
    .sort().reverse()
    .slice(0, LIMIT);
  // A bounded feed: reading the inbox cannot accidentally scan entire ChatGPT history.
  const entries = await Promise.all(newest.map(k => blobs.get(k, { type: 'json' }).catch(() => null)));
  const reports = entries.filter(x => x && x.id).sort((a, b) => b.reportedAt.localeCompare(a.reportedAt));
  return json(200, { ok: true, reports, serverTime: new Date().toISOString(), limit: LIMIT });
}
export default async function handler(request) {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get('action');
    if (request.method === 'GET' && action === 'health') {
      await store().list({ prefix: 'healthcheck/' });
      return json(200, { ok: true, service: 'ai-report-inbox', storage: 'reachable' });
    }
    if (request.method === 'POST' && action === 'register') return await register();
    if (request.method === 'GET' && action === 'inbox') return await inbox(request);
    if ((request.method === 'POST' || request.method === 'GET') && action === 'report') {
      if (request.method === 'GET' && url.search.length > 1800) return json(413, { ok: false, error: 'Report URL too long' });
      let params;
      if (request.method === 'POST') {
        if (Number(request.headers.get('content-length') || 0) > 4096) return json(413, { ok: false, error: 'Body too large' });
        const raw = await request.text();
        if (raw.length > 4096) return json(413, { ok: false, error: 'Body too large' });
        try { params = JSON.parse(raw); } catch { return json(400, { ok: false, error: 'Invalid JSON' }); }
        params.key = request.headers.get('x-report-key') || params.key;
      } else {
        // Fallback for AI tools that can only open URLs. Sensitive write capability
        // remains separate from the read capability used by the Brave extension.
        params = Object.fromEntries(url.searchParams.entries());
      }
      return await submit(params || {});
    }
    return json(405, {
      ok: false, error: 'Supported: POST ?action=register; POST/GET ?action=report; GET ?action=inbox',
      instructions: BASE + '/ai'
    });
  } catch (error) {
    console.error('ai-report-inbox:', error?.message || String(error));
    return json(500, { ok: false, error: 'Storage unavailable. No report was recorded.' });
  }
}
