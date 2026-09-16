const { connectLambda, getStore } = require('@netlify/blobs');

const STORE = 'preview-deploy-toggle';
const PREFIX = 'state/';

function text(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store'
    },
    body
  };
}

async function currentState(store) {
  const { blobs = [] } = await store.list({ prefix: PREFIX });
  if (!blobs.length) return 'OFF';
  const latest = blobs.map(blob => blob.key).sort().at(-1) || '';
  return latest.includes('-ON-') ? 'ON' : 'OFF';
}

exports.handler = async function(event) {
  if (event.httpMethod !== 'GET') return text(405, 'GET only');

  try {
    connectLambda(event);
    const store = getStore(STORE);
    const current = await currentState(store);
    const next = current === 'ON' ? 'OFF' : 'ON';
    const key = `${PREFIX}${Date.now()}-${next}-${Math.random().toString(36).slice(2)}`;
    await store.set(key, next);
    return text(200, next);
  } catch (error) {
    return text(500, error?.message || String(error));
  }
};
