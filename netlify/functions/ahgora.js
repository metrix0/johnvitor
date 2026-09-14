const crypto = require('crypto');
const { connectLambda, getStore } = require('@netlify/blobs');

const BASE = 'https://app.ahgora.com.br/batidaonline';
const COMPANY = 'a518216';
const ENROLLMENT = '96';
const DEVICE_STORE = 'ahgora-device-session';
const DEVICE_KEY = `${COMPANY}-${ENROLLMENT}`;

class AhgoraStepError extends Error {
  constructor(step, detail, { httpStatus = null, responseReceived = false } = {}) {
    super(detail);
    this.name = 'AhgoraStepError';
    this.step = step;
    this.httpStatus = httpStatus;
    this.responseReceived = responseReceived;
  }
}

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

function responseDetail(data, text) {
  if (typeof data?.message === 'string' && data.message.trim()) return data.message.trim();
  if (typeof data?.error === 'string' && data.error.trim()) return data.error.trim();
  if (typeof data?.raw === 'string' && data.raw.trim()) return data.raw.trim();
  if (typeof text === 'string' && text.trim()) return text.trim();
  return null;
}

async function ahgoraFetch(path, options = {}, step = path) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...options,
      headers: {
        Accept: 'application/json, text/plain, */*',
        ...(options.headers || {})
      }
    });
  } catch (error) {
    throw new AhgoraStepError(
      step,
      `A requisição à Ahgora não retornou resposta: ${error?.message || String(error)}`,
      { responseReceived: false }
    );
  }

  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }

  if (!res.ok) {
    const upstream = responseDetail(data, text);
    throw new AhgoraStepError(
      step,
      upstream
        ? `Ahgora respondeu HTTP ${res.status}: ${upstream}`
        : `Ahgora respondeu HTTP ${res.status} sem mensagem de erro.`,
      { httpStatus: res.status, responseReceived: true }
    );
  }

  return data;
}

async function readCachedDevice(store) {
  try {
    const device = await store.get(DEVICE_KEY, { type: 'json', consistency: 'strong' });
    if (!device) return { device: null, error: null, warning: null };
    if (!device.identity || !device.publicKey) {
      return {
        device: null,
        error: null,
        warning: new AhgoraStepError(
          'cache/read',
          'Existe um registro de dispositivo no cache, mas ele não contém identity e publicKey válidos.'
        )
      };
    }
    return { device, error: null, warning: null };
  } catch (error) {
    return {
      device: null,
      error: new AhgoraStepError(
        'cache/read',
        `Não foi possível ler o dispositivo salvo: ${error?.message || String(error)}`
      ),
      warning: null
    };
  }
}

async function saveCachedDevice(store, device) {
  try {
    await store.setJSON(DEVICE_KEY, device);
    return null;
  } catch (error) {
    return new AhgoraStepError(
      'cache/write',
      `O novo dispositivo foi ativado, mas não foi possível salvá-lo no cache: ${error?.message || String(error)}`
    );
  }
}

function failureRecord(phase, error) {
  return {
    phase,
    step: error?.step || 'unknown',
    httpStatus: Number.isInteger(error?.httpStatus) ? error.httpStatus : null,
    responseReceived: error?.responseReceived === true,
    detail: error?.message || String(error)
  };
}

function failureResponse(attempts) {
  const verificationReached = attempts.some(attempt => attempt.step.endsWith('/verifyIdentification'));
  const finalAttempt = attempts[attempts.length - 1];

  return json(502, {
    ok: false,
    punched: false,
    punchStatus: verificationReached ? 'not_confirmed' : 'not_attempted',
    error: finalAttempt?.detail || 'A batida não foi confirmada.',
    attempts,
    checkedAt: new Date().toISOString()
  });
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
  }, 'new_device/activateDeviceOnLineByLoginAndPassword');

  const activationKey = login?.activationKey || login?.activation_key;
  if (!activationKey) {
    throw new AhgoraStepError(
      'new_device/activateDeviceOnLineByLoginAndPassword',
      'Ahgora respondeu à ativação sem retornar activationKey.',
      { httpStatus: 200, responseReceived: true }
    );
  }

  const activationBody = new URLSearchParams({ key: activationKey });
  const activation = await ahgoraFetch('/activateFunctionality', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: activationBody.toString()
  }, 'new_device/activateFunctionality');

  const identity = activation?.identity;
  if (!identity) {
    throw new AhgoraStepError(
      'new_device/activateFunctionality',
      'Ahgora respondeu à ativação da funcionalidade sem retornar identity.',
      { httpStatus: 200, responseReceived: true }
    );
  }

  const publicKeyResponse = await ahgoraFetch(
    `/getPublicKey?identity=${encodeURIComponent(identity)}`,
    {},
    'new_device/getPublicKey'
  );
  const publicKey = publicKeyResponse?.public_key;
  if (!publicKey) {
    throw new AhgoraStepError(
      'new_device/getPublicKey',
      'Ahgora respondeu sem retornar public_key.',
      { httpStatus: 200, responseReceived: true }
    );
  }

  return {
    identity,
    publicKey,
    employee: Array.isArray(activation?.employee) ? activation.employee[0] : activation?.employee || null,
    createdAt: new Date().toISOString()
  };
}

async function punchWithDevice(device, password, phase) {
  const { identity, publicKey } = device;

  const externalInfoBody = new URLSearchParams({ identity });
  await ahgoraFetch('/getDefaultExternalInfo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: externalInfoBody.toString()
  }, `${phase}/getDefaultExternalInfo`);

  let encryptedPassword;
  try {
    encryptedPassword = crypto.publicEncrypt(
      {
        key: publicKey,
        padding: crypto.constants.RSA_PKCS1_PADDING
      },
      Buffer.from(password, 'utf8')
    ).toString('base64');
  } catch (error) {
    throw new AhgoraStepError(
      `${phase}/encryptPassword`,
      `Não foi possível criptografar a senha com a chave pública salva: ${error?.message || String(error)}`
    );
  }

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
  }, `${phase}/verifyIdentification`);

  if (punch?.result !== true) {
    const upstream =
      (typeof punch?.message === 'string' && punch.message.trim()) ||
      (typeof punch?.error === 'string' && punch.error.trim()) ||
      null;

    throw new AhgoraStepError(
      `${phase}/verifyIdentification`,
      upstream
        ? `Ahgora respondeu sem confirmar a batida: ${upstream}`
        : 'Ahgora respondeu sem confirmar a batida e não informou um motivo.',
      { httpStatus: 200, responseReceived: true }
    );
  }

  return punch;
}

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return json(405, { ok: false, error: 'Method not allowed.' });
  }

  const password = process.env.AHGORA_PASSWORD;
  if (!password) {
    return json(500, {
      ok: false,
      punched: false,
      punchStatus: 'not_attempted',
      error: 'AHGORA_PASSWORD não configurada no Netlify.',
      attempts: [{
        phase: 'configuration',
        step: 'configuration/AHGORA_PASSWORD',
        httpStatus: null,
        responseReceived: false,
        detail: 'AHGORA_PASSWORD não configurada no Netlify.'
      }]
    });
  }

  let store;
  try {
    connectLambda(event);
    store = getStore(DEVICE_STORE);
  } catch (error) {
    return failureResponse([failureRecord('cache', new AhgoraStepError(
      'cache/init',
      `Não foi possível inicializar o cache do dispositivo: ${error?.message || String(error)}`
    ))]);
  }

  const attempts = [];
  const cached = await readCachedDevice(store);
  if (cached.error) {
    attempts.push(failureRecord('cache', cached.error));
    console.error(`Ahgora: ${cached.error.message}`);
    return failureResponse(attempts);
  }

  if (cached.warning) {
    attempts.push(failureRecord('cache', cached.warning));
    console.warn(`Ahgora: ${cached.warning.message}`);
  }

  if (cached.device) {
    try {
      const punch = await punchWithDevice(cached.device, password, 'cached_device');
      const employee = punch?.employee || cached.device.employee;
      console.log(`Ahgora: reused cached device ${cached.device.identity}.`);

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
        deviceSession: 'reused',
        checkedAt: new Date().toISOString()
      });
    } catch (error) {
      attempts.push(failureRecord('cached_device', error));
      console.warn(`Ahgora: cached device attempt was not confirmed: ${error?.message || String(error)}`);
      // Keep the cached device unless a replacement is successfully activated.
      // A transient Ahgora/network error must not destroy a device that may still be valid.
    }
  }

  let newDevice;
  try {
    newDevice = await createDevice(password);
  } catch (error) {
    attempts.push(failureRecord('new_device', error));
    console.error(`Ahgora: new device activation failed: ${error?.message || String(error)}`);
    return failureResponse(attempts);
  }

  // Persist a successfully activated device before attempting the punch. If the
  // punch response is lost or inconclusive, the next run can still reuse this device
  // instead of activating yet another one.
  const cacheWriteError = await saveCachedDevice(store, newDevice);
  if (cacheWriteError) {
    console.error(`Ahgora: ${cacheWriteError.message}`);
  } else {
    console.log(`Ahgora: activated and cached new device ${newDevice.identity}.`);
  }

  let punch;
  try {
    punch = await punchWithDevice(newDevice, password, 'new_device');
  } catch (error) {
    attempts.push(failureRecord('new_device', error));
    if (cacheWriteError) attempts.push(failureRecord('cache', cacheWriteError));
    console.error(`Ahgora: new device punch was not confirmed: ${error?.message || String(error)}`);
    return failureResponse(attempts);
  }

  const employee = punch?.employee || newDevice.employee;
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
    deviceSession: cacheWriteError ? 'new_not_cached' : 'new_cached',
    cacheWarning: cacheWriteError?.message || null,
    checkedAt: new Date().toISOString()
  });
};
