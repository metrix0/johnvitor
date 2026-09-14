const crypto = require('crypto');
const { connectLambda, getStore } = require('@netlify/blobs');

const BASE = 'https://app.ahgora.com.br/batidaonline';
const COMPANY = 'a518216';
const ENROLLMENT = '96';
const DEVICE_STORE = 'ahgora-device-session';
const DEVICE_KEY = `${COMPANY}-${ENROLLMENT}`;

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

async function getCachedDevice(store) {
  try {
    const device = await store.get(DEVICE_KEY, { type: 'json', consistency: 'strong' });
    if (!device?.identity || !device?.publicKey) return null;
    return device;
  } catch (error) {
    console.error(`Ahgora: failed to load cached device: ${error?.message || String(error)}`);
    return null;
  }
}

async function saveCachedDevice(store, device) {
  try {
    await store.setJSON(DEVICE_KEY, device);
  } catch (error) {
    console.error(`Ahgora: failed to persist device session: ${error?.message || String(error)}`);
  }
}

async function clearCachedDevice(store) {
  try {
    await store.delete(DEVICE_KEY);
  } catch (error) {
    console.error(`Ahgora: failed to clear cached device: ${error?.message || String(error)}`);
  }
}

async function createDevice(password) {
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

  return {
    identity,
    publicKey,
    createdAt: new Date().toISOString()
  };
}

async function punchWithDevice(device, password) {
  const { identity, publicKey } = device;

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

  return punch;
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
    connectLambda(event);
    const store = getStore(DEVICE_STORE);

    let punch;
    let deviceSession = 'new';
    const cachedDevice = await getCachedDevice(store);

    if (cachedDevice) {
      try {
        punch = await punchWithDevice(cachedDevice, password);
        deviceSession = 'reused';
        console.log(`Ahgora: reused cached device ${cachedDevice.identity}.`);
      } catch (error) {
        console.warn(`Ahgora: cached device failed, activating a new one: ${error?.message || String(error)}`);
        await clearCachedDevice(store);
      }
    }

    if (!punch) {
      const newDevice = await createDevice(password);
      punch = await punchWithDevice(newDevice, password);
      await saveCachedDevice(store, newDevice);
      console.log(`Ahgora: activated and cached new device ${newDevice.identity}.`);
    }

    const employee = punch?.employee;

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
      deviceSession,
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
