const ALERT_TOPIC_URL = 'https://ntfy.sh/astrovialseen';

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

  const isTest = event.queryStringParameters?.test === '1';
  const title = isTest
    ? 'ALARM TRIGGER - iMenu HEALTH CHECK TEST'
    : 'ALARM TRIGGER - iMenu indisponível';
  const body = isTest
    ? 'TEST ONLY - iMenu health-check alarm path is working.'
    : 'GitHub health checker: iMenu falhou duas vezes (retry após 30s). Verifique o serviço agora.';

  try {
    const response = await fetch(ALERT_TOPIC_URL, {
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
