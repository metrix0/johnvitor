const SITE_URL = 'https://johnvitor.com';
const DEFAULT_NTFY_SERVER = 'https://ntfy.sh';

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
  if (event.httpMethod !== 'POST') {
    return json(405, { ok: false, error: 'Method not allowed.' });
  }

  const topic = process.env.NTFY_TOPIC;
  const server = (process.env.NTFY_SERVER || DEFAULT_NTFY_SERVER).replace(/\/$/, '');

  if (!topic) {
    return json(500, { ok: false, error: 'NTFY_TOPIC não configurado no Netlify.' });
  }

  try {
    const response = await fetch(`${server}/${encodeURIComponent(topic)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Title': '⚠️ Ahgora: teste de falha',
        'Priority': '5',
        'Tags': 'warning,rotating_light',
        'Click': `${SITE_URL}/ahgora`
      },
      body: 'Teste de notificação: simulação de falha na batida.'
    });

    if (!response.ok) {
      return json(502, { ok: false, error: `ntfy HTTP ${response.status}` });
    }

    return json(200, { ok: true });
  } catch (error) {
    return json(502, { ok: false, error: error?.message || String(error) });
  }
};
