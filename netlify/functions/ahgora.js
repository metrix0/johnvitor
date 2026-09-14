const crypto = require('crypto');

const BASE = 'https://app.ahgora.com.br/batidaonline';
const COMPANY = 'a518216';
const ENROLLMENT = '96';

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

async function ahgoraFetch(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json, text/plain, */*',
      ...(options.headers || {})
    }
  });

  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }

  if (!res.ok) {
    throw new Error(`Ahgora HTTP ${res.status}: ${data?.message || data?.error || text || 'erro desconhecido'}`);
  }

  return data;
}

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return json(405, { ok: false, error: 'Method not allowed.' });
  }

  const password = process.env.AHGORA_PASSWORD;
  if (!password) {
    return json(500, { ok: false, error: 'AHGORA_PASSWORD não configurada no Netlify.' });
  }

  try {
    const loginBody = new URLSearchParams({
      company: COMPANY,
      enrollment: ENROLLMENT,
      password
    });

    const login = await ahgoraFetch('/activateDeviceOnLineByLoginAndPassword', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: loginBody.toString()
    });

    const activationKey = login?.activationKey || login?.activation_key;
    if (!activationKey) throw new Error('Ahgora não retornou activationKey.');

    const activationBody = new URLSearchParams({ key: activationKey });
    const activation = await ahgoraFetch('/activateFunctionality', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: activationBody.toString()
    });

    const identity = activation?.identity;
    if (!identity) throw new Error('Ahgora não retornou identity.');

    const publicKeyResponse = await ahgoraFetch(`/getPublicKey?identity=${encodeURIComponent(identity)}`);
    const publicKey = publicKeyResponse?.public_key;
    if (!publicKey) throw new Error('Ahgora não retornou public_key.');

    const externalInfoBody = new URLSearchParams({ identity });
    await ahgoraFetch('/getDefaultExternalInfo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: externalInfoBody.toString()
    });

    const encryptedPassword = crypto.publicEncrypt(
      {
        key: publicKey,
        padding: crypto.constants.RSA_PKCS1_PADDING
      },
      Buffer.from(password, 'utf8')
    ).toString('base64');

    const form = new FormData();
    form.append('account', ENROLLMENT);
    form.append('password', encryptedPassword);
    form.append('identity', identity);
    form.append('origin', 'pw2');
    form.append('app_version', '2.0');
    form.append('key', '');
    form.append('enc', 'true');

    const punch = await ahgoraFetch('/verifyIdentification', {
      method: 'POST',
      body: form
    });

    if (punch?.result !== true) {
      throw new Error(punch?.message || punch?.error || 'Ahgora não confirmou o registro do ponto.');
    }

    const employee = punch?.employee || (Array.isArray(activation?.employee) ? activation.employee[0] : activation?.employee);

    return json(200, {
      ok: true,
      punched: true,
      result: true,
      nsr: punch?.NSR ?? null,
      day: punch?.day ?? null,
      time: punch?.time ?? null,
      punchesToday: punch?.batidas_dia ?? null,
      enrollment: employee?.enrollment || ENROLLMENT,
      employeeName: employee?.name || null,
      checkedAt: new Date().toISOString()
    });
  } catch (error) {
    return json(502, {
      ok: false,
      punched: false,
      error: error?.message || String(error)
    });
  }
};
