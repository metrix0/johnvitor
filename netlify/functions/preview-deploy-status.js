const { connectLambda, getStore } = require('@netlify/blobs');

const STORE = 'preview-deploy-toggle';
const KEY = 'enabled';

exports.handler = async function(event) {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'GET only' };
  }

  try {
    connectLambda(event);
    const store = getStore(STORE);
    const current = await store.get(KEY, { type: 'text' });
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store'
      },
      body: current === 'ON' ? 'ON' : 'OFF'
    };
  } catch (error) {
    return { statusCode: 500, body: error?.message || String(error) };
  }
};
