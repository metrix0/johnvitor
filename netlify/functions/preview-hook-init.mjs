import { getStore } from '@netlify/blobs';

const STORE = 'preview-deploy-toggle-v2';
const KEY = 'deploy-hook-url';

export default async (req) => {
  if (req.method !== 'GET') return new Response('GET only', { status: 405 });

  const hook = new URL(req.url).searchParams.get('hook');
  if (!hook?.startsWith('https://api.vercel.com/v1/integrations/deploy/')) {
    return new Response('Invalid hook', { status: 400 });
  }

  const store = getStore({ name: STORE, consistency: 'strong' });
  const existing = await store.get(KEY, { type: 'text' });
  if (existing) return new Response('ALREADY SET', { status: 409 });

  await store.set(KEY, hook);
  return new Response('SET');
};
