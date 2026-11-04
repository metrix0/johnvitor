import { getStore } from '@netlify/blobs';

const STORE = 'preview-deploy-toggle-v2';
const KEY = 'enabled';

const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

function isEnabled(value, now = Date.now()) {
  if (value === 'ON') return true; // Backward compatibility for existing untimed switches.
  if (typeof value !== 'string' || !value.startsWith('ON:')) return false;
  const expiresAt = Number(value.slice(3));
  return Number.isSafeInteger(expiresAt) && expiresAt > now;
}

export default async (req) => {
  if (req.method !== 'GET') return new Response('GET only', { status: 405 });

  try {
    const store = getStore({ name: STORE, consistency: 'strong' });
    const current = await store.get(KEY, { type: 'text' });
    return new Response(isEnabled(current) ? 'ON' : 'OFF', {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store'
      }
    });
  } catch (error) {
    return new Response(error?.message || String(error), { status: 500 });
  }
};
