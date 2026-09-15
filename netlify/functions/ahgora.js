const crypto = require('crypto');
const { connectLambda, getStore } = require('@netlify/blobs');

const BASE = 'https://app.ahgora.com.br/batidaonline';
const ACTIVATION_BASE = 'https://www.ahgora.com.br/batidaonline';
const COMPANY = 'a518216';
const ENROLLMENT = '96';
const DEVICE_STORE = 'ahgora-device-session';
const DEVICE_KEY = `${COMPANY}-${ENROLLMENT}`;

// This device was activated successfully through Ahgora's official web flow.
// The identity/public key are not credentials; the activation key itself is
// intentionally NOT committed because this repository is public.
const CURRENT_BOOTSTRAP_DEVICE = {
  identity: '36dddfe45d75409f061710b7542a08c4',
  publicKey: `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA7qtdaCKN+fpyaYJC4H6R
l73pprTBgq1B3c1sgGee+ZzOaIRk2NDcEFSXK0w2+tA6mutbwo+1Ht1wGzSr4785
J0AQI7gUmSd7ocFzNW45cL5M/MYZIOvDNh6VS/HRVg/z5/jGchFtTloJPolbm85E
4QocsMDLvQX5e1QeCgNdTBIANJ4S09nX2r1y9YZIJIhz3zxKonSbybqgquxL8W5A
Zhx0vvD2O6GNV7ixhUwmSW1Jg+KBHz4/dBo2mMSlqgkh+hlpFIpFXz5DkRsKhbSt
JbqPIunx3PVOyk+GEZ2zumZWfvdicVLI4SQs4X6kpYKmQ20/tQD+zZqBnrRlLs1I
LwIDAQAB
-----END PUBLIC KEY-----`,
  employee: null,
  baseUrl: ACTIVATION_BASE,
  source: 'official_browser_har'
};

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
  if (typeof data?.reason === 'string' && data.reason.trim()) return data.reason.trim();
  if (typeof data?.raw === 'string' && data.raw.trim()) return data.raw.trim();
  if (typeof text === 'string' && text.trim()) return text.trim();
  return null;
}

async function ahgoraFetch(path, options = {}, step = path, baseUrl = BASE) {
  let res;
  try {
    res = await fetch(`${baseUrl}${path}`, {
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
    const device = await store.get(DEVICE_KEY, { type: 'json' });
    if (!device) return { device: null, error: null, warning: null };
    if (!device.identity) {
      return {
        device: null,
        error: null,
        warning: new AhgoraStepError(
          'cache/read',
          'Existe um registro de dispositivo no cache, mas ele não contém identity válida.'
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
      `O dispositivo foi ativado, mas não foi possível salvá-lo no cache: ${error?.message || String(error)}`
    );
  }
}

function normalizeActivationKey(value) {
  return typeof value === 'string' && /^[0-9a-f]+$/i.test(value.trim())
    ? value.trim()
    : null;
}

const SAVED_ACTIVATION_KEYS = [
  '6aa2f36e5e491', '6aa0267ab802a', '6a998efa4f653', '6a9ab2c6a71ef',
  '6aa051207fe0f', '6a9ae07b9fbfc', '6a983d87beaf1', '6aa44567ef7bf',
  '6aa14a0861e48', '6aa41776312d2', '6a9867a8c9756', '6a9961469f8ca',
  '6a96f2f609aa9', '6a998bb472703', '6aa1a2a253b21', '6aa2c9f19879c',
  '6aa2c6334a866', '6aa177be0134e', '6aa29c021b267', '672cd25819261',
  '6aa41b3549a4b', '6aa7e1c4bdd37', '6aa174786ef1c', '6a9ff900c4a90',
  '6aa023a99eb80', '6a99b92874f32', '6a9adcf6af1b8', '6a97155d7ac40',
  '6aa3ed0973486', '6a98399252654', '6a9b0aa9d0488'
];

function configuredActivationKeys() {
  const envKeys = (process.env.AHGORA_ACTIVATION_KEYS || '')
    .split(/[\s,;]+/)
    .map(normalizeActivationKey)
    .filter(Boolean);

  return [...new Set([
    ...SAVED_ACTIVATION_KEYS.map(normalizeActivationKey).filter(Boolean),
    ...envKeys
  ])];
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

function shouldRecoverDevice(error) {
  const step = error?.step || '';
  const explicitIdentity4xx =
    (step.endsWith('/getDefaultExternalInfo') || step.endsWith('/getPublicKey')) &&
    error?.responseReceived === true &&
    Number.isInteger(error?.httpStatus) &&
    error.httpStatus >= 400 &&
    error.httpStatus < 500;

  const explicitlyInactive =
    step.endsWith('/verifyIdentification') &&
    error?.responseReceived === true &&
    error.httpStatus === 200 &&
    /\binativo\b/i.test(error?.message || '');

  return explicitIdentity4xx || explicitlyInactive;
}

function isRejectedActivationKey(error) {
  const step = error?.step || '';
  const status = error?.httpStatus;
  const providerRejected = error?.responseReceived === true && (
    (Number.isInteger(status) && status >= 400 && status < 500) ||
    status === 200
  );

  return providerRejected && (
    step.endsWith('/activateFunctionality') ||
    step.endsWith('/getPublicKey')
  );
}

async function activateWithKey(activationKey, phase, baseUrl = ACTIVATION_BASE) {
  const activationBody = new URLSearchParams({ key: activationKey });
  const activation = await ahgoraFetch('/activateFunctionality', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: activationBody.toString()
  }, `${phase}/activateFunctionality`, baseUrl);

  const identity = activation?.identity;
  if (!identity) {
    throw new AhgoraStepError(
      `${phase}/activateFunctionality`,
      'Ahgora respondeu à ativação da funcionalidade sem retornar identity.',
      { httpStatus: 200, responseReceived: true }
    );
  }

  const publicKeyResponse = await ahgoraFetch(
    `/getPublicKey?identity=${encodeURIComponent(identity)}`,
    {},
    `${phase}/getPublicKey`,
    baseUrl
  );
  const publicKey = publicKeyResponse?.public_key;
  if (!publicKey) {
    throw new AhgoraStepError(
      `${phase}/getPublicKey`,
      'Ahgora respondeu sem retornar public_key.',
      { httpStatus: 200, responseReceived: true }
    );
  }

  return {
    identity,
    publicKey,
    activationKey,
    employee: Array.isArray(activation?.employee) ? activation.employee[0] : activation?.employee || null,
    baseUrl,
    source: 'activation_key',
    createdAt: new Date().toISOString()
  };
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
  }, 'new_device/activateDeviceOnLineByLoginAndPassword', BASE);

  const activationKey = normalizeActivationKey(login?.activationKey || login?.activation_key);
  if (!activationKey) {
    throw new AhgoraStepError(
      'new_device/activateDeviceOnLineByLoginAndPassword',
      'Ahgora respondeu à ativação sem retornar activationKey.',
      { httpStatus: 200, responseReceived: true }
    );
  }

  const device = await activateWithKey(activationKey, 'new_device', BASE);
  device.source = 'generated';
  return device;
}

async function punchWithDevice(device, password, phase) {
  const { identity } = device;
  const baseUrl = device.baseUrl || BASE;

  const externalInfoBody = new URLSearchParams({ identity });
  const externalInfo = await ahgoraFetch('/getDefaultExternalInfo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: externalInfoBody.toString()
  }, `${phase}/getDefaultExternalInfo`, baseUrl);

  const token = externalInfo?.token;
  if (!token) {
    throw new AhgoraStepError(
      `${phase}/getDefaultExternalInfo`,
      'Ahgora respondeu a getDefaultExternalInfo sem retornar token.',
      { httpStatus: 200, responseReceived: true }
    );
  }

  let publicKey = device.publicKey || null;
  if (!publicKey) {
    const publicKeyResponse = await ahgoraFetch(
      `/getPublicKey?identity=${encodeURIComponent(identity)}`,
      {},
      `${phase}/getPublicKey`,
      baseUrl
    );
    publicKey = publicKeyResponse?.public_key || null;
    if (!publicKey) {
      throw new AhgoraStepError(
        `${phase}/getPublicKey`,
        'Ahgora respondeu sem retornar public_key.',
        { httpStatus: 200, responseReceived: true }
      );
    }
  }

  let encryptedPassword;
  try {
    encryptedPassword = crypto.publicEncrypt(
      { key: publicKey, padding: crypto.constants.RSA_PKCS1_PADDING },
      Buffer.from(password, 'utf8')
    ).toString('base64');
  } catch (error) {
    throw new AhgoraStepError(
      `${phase}/encryptPassword`,
      `Não foi possível criptografar a senha com a chave pública do dispositivo: ${error?.message || String(error)}`
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
    headers: { Authorization: token },
    body: form
  }, `${phase}/verifyIdentification`, baseUrl);

  if (punch?.result !== true) {
    const upstream = responseDetail(punch, null);

    throw new AhgoraStepError(
      `${phase}/verifyIdentification`,
      upstream
        ? `Ahgora respondeu sem confirmar a batida: ${upstream}`
        : 'Ahgora respondeu sem confirmar a batida e não informou um motivo.',
      { httpStatus: 200, responseReceived: true }
    );
  }

  punch._externalEmployee = Array.isArray(externalInfo?.employee)
    ? externalInfo.employee[0]
    : externalInfo?.employee || null;

  return punch;
}

function successResponse(punch, device, deviceSession, cacheWarning = null) {
  const employee = punch?.employee || punch?._externalEmployee || device?.employee;
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
    cacheWarning,
    checkedAt: new Date().toISOString()
  });
}

async function activateSaveAndPunch({
  store,
  activationKey,
  password,
  phase,
  baseUrl = ACTIVATION_BASE,
  attempts
}) {
  let device;
  try {
    device = await activateWithKey(activationKey, phase, baseUrl);
  } catch (error) {
    attempts.push(failureRecord(phase, error));
    return {
      done: !isRejectedActivationKey(error),
      response: isRejectedActivationKey(error) ? null : failureResponse(attempts)
    };
  }

  const cacheWriteError = await saveCachedDevice(store, device);
  if (cacheWriteError) console.error(`Ahgora: ${cacheWriteError.message}`);

  try {
    const punch = await punchWithDevice(device, password, phase);
    console.log(`Ahgora: activated and cached reusable device ${device.identity}.`);
    return {
      done: true,
      response: successResponse(
        punch,
        device,
        cacheWriteError ? 'activation_key_not_cached' : 'activation_key_cached',
        cacheWriteError?.message || null
      )
    };
  } catch (error) {
    attempts.push(failureRecord(phase, error));
    if (cacheWriteError) attempts.push(failureRecord('cache', cacheWriteError));

    if (shouldRecoverDevice(error)) {
      console.warn(`Ahgora: activation key produced an inactive/rejected identity; trying the next saved key.`);
      return { done: false, response: null };
    }

    return { done: true, response: failureResponse(attempts) };
  }
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
    return failureResponse(attempts);
  }
  if (cached.warning) attempts.push(failureRecord('cache', cached.warning));

  if (cached.device) {
    try {
      const punch = await punchWithDevice(cached.device, password, 'cached_device');
      console.log(`Ahgora: reused cached device ${cached.device.identity}.`);
      return successResponse(punch, cached.device, 'reused');
    } catch (error) {
      attempts.push(failureRecord('cached_device', error));
      console.warn(`Ahgora: cached device was not confirmed: ${error?.message || String(error)}`);
      if (!shouldRecoverDevice(error)) return failureResponse(attempts);
    }
  }

  // A freshly activated browser identity from the official Ahgora flow gives us
  // an immediate reusable device even before the historical keys are configured.
  if (!cached.device && CURRENT_BOOTSTRAP_DEVICE.identity) {
    try {
      const punch = await punchWithDevice(CURRENT_BOOTSTRAP_DEVICE, password, 'browser_device');
      const cacheWriteError = await saveCachedDevice(store, CURRENT_BOOTSTRAP_DEVICE);
      return successResponse(
        punch,
        CURRENT_BOOTSTRAP_DEVICE,
        cacheWriteError ? 'browser_bootstrap_not_cached' : 'browser_bootstrap_cached',
        cacheWriteError?.message || null
      );
    } catch (error) {
      attempts.push(failureRecord('browser_device', error));
      if (!shouldRecoverDevice(error)) return failureResponse(attempts);
    }
  }

  // Reuse the key that created the cached device first, then every historical
  // saved historical key. Nothing new is generated while an old key works.
  const candidateKeys = [...new Set([
    normalizeActivationKey(cached.device?.activationKey),
    ...configuredActivationKeys()
  ].filter(Boolean))];

  for (let index = 0; index < candidateKeys.length; index += 1) {
    const result = await activateSaveAndPunch({
      store,
      activationKey: candidateKeys[index],
      password,
      phase: `saved_key_${index + 1}`,
      baseUrl: ACTIVATION_BASE,
      attempts
    });
    if (result.done) return result.response;
  }

  // Only after every reusable key is unavailable/rejected do we fall back to
  // the original creation flow. The returned activationKey is persisted with
  // the device, so future recovery reuses it instead of creating another key.
  let newDevice;
  try {
    newDevice = await createDevice(password);
  } catch (error) {
    attempts.push(failureRecord('new_device', error));
    return failureResponse(attempts);
  }

  const cacheWriteError = await saveCachedDevice(store, newDevice);
  if (cacheWriteError) console.error(`Ahgora: ${cacheWriteError.message}`);

  try {
    const punch = await punchWithDevice(newDevice, password, 'new_device');
    return successResponse(
      punch,
      newDevice,
      cacheWriteError ? 'new_not_cached' : 'new_cached',
      cacheWriteError?.message || null
    );
  } catch (error) {
    attempts.push(failureRecord('new_device', error));
    if (cacheWriteError) attempts.push(failureRecord('cache', cacheWriteError));
    return failureResponse(attempts);
  }
};
