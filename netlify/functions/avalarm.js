const PRODUCT_URL = 'https://astrovials.com/product/estradiol-enanthate/';
const NTFY_URL = 'https://ntfy.sh/astrovialseen';

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    },
    body: JSON.stringify(body)
  };
}

exports.handler = async function(event) {
  if (event.httpMethod !== 'GET') {
    return json(405, { ok: false, error: 'Method not allowed.' });
  }

  try {
    const response = await fetch(NTFY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Title': 'AstroVials EEn IN STOCK',
        'Priority': '5',
        'Tags': 'warning,rotating_light',
        'Click': PRODUCT_URL
      },
      body: 'TRIGGER ALARM - Estradiol Enanthate is in stock and purchasable now'
    });

    if (!response.ok) {
      return json(502, { ok: false, error: `ntfy HTTP ${response.status}` });
    }

    return json(200, { ok: true });
  } catch (error) {
    return json(502, { ok: false, error: error?.message || String(error) });
  }
};
