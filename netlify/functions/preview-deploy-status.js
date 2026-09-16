const { connectLambda, getStore } = require('@netlify/blobs');

const STORE = 'preview-deploy-toggle';
const PREFIX = 'state/';

exports.handler = async function(event) {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'GET only' };
  }

  try {
    connectLambda(event);
    const store = getStore(STORE);
    const { blobs = [] } = await store.list({ prefix: PREFIX });
    const latest = blobs.length ? blobs.map(blob => blob.key).sort().at(-1) || '' : '';
    const state = latest.includes('-ON-') ? 'ON' : 'OFF';
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store'
      },
      body: state
    };
  } catch (error) {
    return { statusCode: 500, body: error?.message || String(error) };
  }
};
