import { getStore } from '@netlify/blobs';

const STORE = 'preview-deploy-toggle-v2';
const KEY = 'enabled';

export default async (req) => {
  if (req.method !== 'GET') return new Response('GET only', { status: 405 });

  try {
    const store = getStore({ name: STORE, consistency: 'strong' });
    const current = await store.get(KEY, { type: 'text' });
    const next = current === 'ON' ? 'OFF' : 'ON';
    await store.set(KEY, next);
    return new Response(next, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store'
      }
    });
  } catch (error) {
    return new Response(error?.message || String(error), { status: 500 });
  }
};
