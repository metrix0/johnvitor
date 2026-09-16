import { getStore } from '@netlify/blobs';

const STORE = 'preview-deploy-toggle-v2';
const KEY = 'enabled';
const DEPLOY_HOOK = 'https://api.vercel.com/v1/integrations/deploy/prj_6dB0Yk1fQjoWLTSOTPvMjibf9nCw/QdNyV6TWd0';

export default async (req) => {
  if (req.method !== 'GET') return new Response('GET only', { status: 405 });

  try {
    const store = getStore({ name: STORE, consistency: 'strong' });
    const current = await store.get(KEY, { type: 'text' });
    const next = current === 'ON' ? 'OFF' : 'ON';

    await store.set(KEY, next);

    if (next === 'ON') {
      const deploy = await fetch(DEPLOY_HOOK, { method: 'POST' });
      if (!deploy.ok) {
        await store.set(KEY, 'OFF');
        return new Response('ERROR', { status: 502 });
      }
    }

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
