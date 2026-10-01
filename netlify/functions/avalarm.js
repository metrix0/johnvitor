const PRODUCT_URL = 'https://astrovials.com/product/estradiol-enanthate/';
const IMENU_URL = 'https://www.imenuapp.com.br';
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

  const kind = event.queryStringParameters?.kind || 'astrovials';

  let title = 'ALARM TRIGGER - AstroVials EEn IN STOCK';
  let body = 'TRIGGER ALARM - Estradiol Enanthate is in stock and purchasable now';
  let click = PRODUCT_URL;

  if (kind === 'imenu') {
    title = 'ALARM TRIGGER - iMenu indisponível';
    body = 'iMenu health check failed twice. Check the service now.';
    click = IMENU_URL;
  } else if (kind === 'imenu-test') {
    title = 'ALARM TRIGGER - iMenu HEALTH CHECK TEST';
    body = 'TEST ONLY - iMenu health-check alarm path is working.';
    click = IMENU_URL;
  }

  try {
    const response = await fetch(NTFY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Title': title,
        'Priority': '5',
        'Tags': 'warning,rotating_light',
        'Click': click
      },
      body
    });

    if (!response.ok) {
      return json(502, { ok: false, error: `ntfy HTTP ${response.status}` });
    }

    return json(200, { ok: true, kind, title });
  } catch (error) {
    return json(502, { ok: false, error: error?.message || String(error) });
  }
};
