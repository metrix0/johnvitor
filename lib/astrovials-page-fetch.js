const { snapshotPage } = require('./astrovials-page-fingerprint');

const ATTEMPTS = 2;
const RETRY_DELAY_MS = 350;
const FETCH_TIMEOUT_MS = 6500;

async function fetchProductSnapshot({ url, userAgent, fetchImpl = globalThis.fetch }) {
  let lastError;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      const response = await fetchImpl(url, {
        headers: {
          Accept: 'text/html',
          'Cache-Control': 'no-cache, no-store',
          Pragma: 'no-cache',
          'User-Agent': userAgent
        },
        cache: 'no-store',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
      });

      if (!response.ok) throw new Error('AstroVials HTTP ' + response.status);
      if (!(response.headers.get('content-type') || '').includes('text/html')) {
        throw new Error('Unexpected product page content type');
      }

      // An incomplete response is transient too; retry before reporting a failure.
      const snapshot = snapshotPage(await response.text());
      return { snapshot, attempts: attempt };
    } catch (error) {
      lastError = error;
      if (attempt < ATTEMPTS) {
        console.warn('AstroVials fetch attempt ' + attempt + ' failed; retrying:', error?.message || String(error));
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
      }
    }
  }

  throw new Error(
    'Product page fetch failed after ' + ATTEMPTS + ' attempts: ' + (lastError?.message || String(lastError)),
    { cause: lastError }
  );
}

module.exports = { fetchProductSnapshot };
