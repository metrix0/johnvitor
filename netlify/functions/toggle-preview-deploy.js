const { connectLambda, getStore } = require('@netlify/blobs');

const STORE = 'preview-deploy-toggle';
const KEY = 'enabled';

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

exports.handler = async function(event) {
  if (event.httpMethod !== 'GET') return text(405, 'GET only');

  try {
    connectLambda(event);
    const store = getStore(STORE);
    const current = await store.get(KEY, { type: 'text' });
    const next = current === 'ON' ? 'OFF' : 'ON';
    await store.set(KEY, next);
    return text(200, next);
  } catch (error) {
    return text(500, error?.message || String(error));
  }
};
