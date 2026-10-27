import { getStore } from '@netlify/blobs';
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
export default async function handler(request) {
  try {
    if (!['GET', 'POST'].includes(request.method)) return json(405, { error: 'Method not allowed' });
    const input = request.method === 'GET' ? Object.fromEntries(new URL(request.url).searchParams) : await request.json();
    const name = String(input.name || '').trim();
    if (!/^[a-zA-Z0-9_-]{3,24}$/.test(name)) return json(400, { error: 'Use 3–24 letters, numbers, underscores or hyphens.' });
    const store = getStore({ name: 'getaway-club-profiles', consistency: 'strong' });
    const key = name.toLowerCase();
    const profile = await store.get(key, { type: 'json' }) || { name, unlocked: 0, completed: false };
    if (request.method === 'POST') {
      const level = Number(input.unlocked);
      if (!Number.isInteger(level) || level < 0 || level > 4) return json(400, { error: 'Invalid level' });
      profile.unlocked = Math.max(profile.unlocked || 0, level);
      profile.completed = !!profile.completed || input.completed === true;
      await store.setJSON(key, profile);
    }
    return json(200, profile);
  } catch (error) {
    console.error('getaway-profile:', error?.message || String(error));
    return json(503, { error: 'Profile storage is unavailable.' });
  }
}
