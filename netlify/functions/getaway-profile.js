const { connectLambda, getStore } = require('@netlify/blobs');
exports.handler = async event => {
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
  try {
    const method = event.httpMethod;
    if (method !== 'GET' && method !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
    const payload = method === 'POST' ? JSON.parse(event.body || '{}') : event.queryStringParameters || {};
    const name = String(payload.name || '').trim();
    if (!/^[a-zA-Z0-9_-]{3,24}$/.test(name)) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Use 3–24 letters, numbers, underscores or hyphens.' }) };
    connectLambda(event);
    const store = getStore({ name: 'getaway-club-profiles', consistency: 'strong' });
    const key = name.toLowerCase();
    const current = await store.get(key, { type: 'json' }) || { name, unlocked: 0, completed: false };
    if (method === 'POST') {
      const level = Number(payload.unlocked);
      if (!Number.isInteger(level) || level < 0 || level > 4) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid level' }) };
      current.unlocked = Math.max(current.unlocked || 0, level);
      current.completed = !!current.completed || payload.completed === true;
      await store.setJSON(key, current);
    }
    return { statusCode: 200, headers, body: JSON.stringify(current) };
  } catch (err) {
    console.error('Profile storage failed', err.message);
    return { statusCode: 503, headers, body: JSON.stringify({ error: 'Profile storage is unavailable.' }) };
  }
};
