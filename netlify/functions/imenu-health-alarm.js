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

  const isTest = event.queryStringParameters?.test === '1';
  const title = isTest
    ? 'ALARM TRIGGER - iMenu HEALTH CHECK TEST'
    : 'ALARM TRIGGER - iMenu indisponível';
  const body = isTest
    ? 'TEST ONLY - iMenu health-check alarm path is working.'
    : 'GitHub health checker: iMenu falhou duas vezes (retry após 30s). Verifique o serviço agora.';

  try {
    const response = await fetch(`${server}/${encodeURIComponent(topic)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        Title: title,
        Priority: '5',
        Tags: 'warning,rotating_light',
        Click: 'https://www.imenuapp.com.br'
      },
      body
    });

    if (!response.ok) {
      return json(502, { ok: false, error: `ntfy HTTP ${response.status}` });
    }

    return json(200, { ok: true, test: isTest });
  } catch (error) {
    return json(502, { ok: false, error: error?.message || String(error) });
  }
};
