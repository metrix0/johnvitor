const SITE_URL = 'https://johnvitor.com';

function pickOffsetMinutes() {
  const r = Math.random() * 100;
  if (r < 5) return -3;
  if (r < 15) return -1.5;
  if (r < 63) return 0;
  if (r < 93) return 1.5;
  if (r < 98) return 3;
  if (r < 99) return 4.5;
  return 6;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

exports.handler = async function(event) {
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const slot = body.slot || 'unknown';
    const offsetMinutes = pickOffsetMinutes();
    const delayMinutes = offsetMinutes + 3;

    console.log(`Ahgora ${slot}: offset ${offsetMinutes >= 0 ? '+' : ''}${offsetMinutes} min; waiting ${delayMinutes} min.`);

    if (delayMinutes > 0) {
      await sleep(delayMinutes * 60 * 1000);
    }

    const response = await fetch(`${SITE_URL}/api/ahgora`, {
      method: 'POST',
      headers: { Accept: 'application/json' }
    });

    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch { data = null; }

    if (!response.ok || !data?.ok || !data?.punched) {
      console.error(`Ahgora ${slot}: punch failed: ${data?.error || `HTTP ${response.status}`}`);
      return;
    }

    console.log(`Ahgora ${slot}: punch registered at ${data.time || 'unknown time'}; NSR ${data.nsr ?? 'unknown'}.`);
  } catch (error) {
    // Do not throw: Netlify background functions retry failed invocations,
    // which could create a duplicate punch if the first request actually succeeded.
    console.error('Ahgora background clock error:', error?.message || String(error));
  }
};
