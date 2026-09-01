import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env: ${name}`);
  return value;
}

function requireTrue(name) {
  if (String(process.env[name] || '').toLowerCase() !== 'true') {
    throw new Error(`Execution blocked: ${name}=true is required after DevTools verification`);
  }
}

function localParts(date = new Date(), timeZone = process.env.AHGORA_TIMEZONE || 'America/Sao_Paulo') {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date);
  const get = type => parts.find(p => p.type === type)?.value;
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    hh: Number(get('hour')),
    mm: Number(get('minute')),
    ss: Number(get('second')),
  };
}

export function normalizePunchTime(raw) {
  const s = String(raw ?? '').trim();
  if (!/^\d{4}(\d{2})?$/.test(s)) return null;
  const hh = Number(s.slice(0, 2));
  const mm = Number(s.slice(2, 4));
  const ss = s.length === 6 ? Number(s.slice(4, 6)) : 0;
  if (hh > 23 || mm > 59 || ss > 59) return null;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

export function normalizePunchList(values = []) {
  return [...new Set(values.map(normalizePunchTime).filter(Boolean))];
}

function minuteOfDay(hhmm) {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!m) throw new Error(`Invalid window time: ${hhmm}`);
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) throw new Error(`Invalid window time: ${hhmm}`);
  return h * 60 + min;
}

function currentWindow(now) {
  const raw = required('AHGORA_ALLOWED_WINDOWS');
  const { hh, mm } = localParts(now);
  const current = hh * 60 + mm;
  for (const item of raw.split(',').map(v => v.trim()).filter(Boolean)) {
    const [start, end] = item.split('-');
    if (!start || !end) throw new Error(`Invalid AHGORA_ALLOWED_WINDOWS entry: ${item}`);
    const a = minuteOfDay(start);
    const b = minuteOfDay(end);
    if (b < a) throw new Error(`Overnight windows are not supported: ${item}`);
    if (current >= a && current <= b) return item;
  }
  return null;
}

function getPublicKey(pem) {
  try {
    return crypto.createPublicKey(pem);
  } catch (error) {
    throw new Error(`Invalid AHGORA_PUBLIC_KEY_PEM: ${error.message}`);
  }
}

function publicKeyFingerprint(key) {
  const der = key.export({ type: 'spki', format: 'der' });
  return crypto.createHash('sha256').update(der).digest('hex');
}

function encryptPassword(password, key) {
  const paddingName = required('AHGORA_RSA_PADDING').toLowerCase();
  if (!['pkcs1', 'oaep'].includes(paddingName)) {
    throw new Error('AHGORA_RSA_PADDING must be pkcs1 or oaep');
  }
  const padding = paddingName === 'oaep'
    ? crypto.constants.RSA_PKCS1_OAEP_PADDING
    : crypto.constants.RSA_PKCS1_PADDING;
  const options = { key, padding };
  if (paddingName === 'oaep') options.oaepHash = required('AHGORA_RSA_OAEP_HASH');
  return crypto.publicEncrypt(options, Buffer.from(password, 'utf8')).toString('base64');
}

function lockPath(date, window) {
  const dir = process.env.AHGORA_LOCK_DIR || '.locks';
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `${date}_${window.replace(/[^0-9-]/g, '_')}.json`);
}

function acquireLock(file, data) {
  try {
    const fd = fs.openSync(file, 'wx');
    fs.writeFileSync(fd, JSON.stringify(data, null, 2));
    fs.closeSync(fd);
  } catch (err) {
    if (err?.code === 'EEXIST') throw new Error(`Punch blocked: idempotency lock already exists at ${file}`);
    throw err;
  }
}

function updateLock(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function appendLog(entry) {
  const file = process.env.AHGORA_LOG_FILE || 'punches.ndjson';
  fs.appendFileSync(file, `${JSON.stringify(entry)}\n`);
}

function parseExtraHeaders() {
  const raw = process.env.AHGORA_EXTRA_HEADERS_JSON;
  if (!raw) return {};
  let parsed;
  try { parsed = JSON.parse(raw); } catch { throw new Error('AHGORA_EXTRA_HEADERS_JSON must be valid JSON'); }
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error('AHGORA_EXTRA_HEADERS_JSON must be a JSON object');
  return Object.fromEntries(Object.entries(parsed).map(([k, v]) => [k, String(v)]));
}

function validateCapturedTransport(url, method, contentType) {
  if (!/^https:\/\//i.test(url)) throw new Error('AHGORA_PUNCH_URL must be HTTPS');
  if (method !== 'POST') throw new Error(`Execution blocked: expected captured POST method, got ${method}`);
  if (!/^application\/x-www-form-urlencoded(?:;|$)/i.test(contentType)) {
    throw new Error(`Execution blocked: unsupported/unverified content type: ${contentType}`);
  }
}

function validateResponse(body) {
  if (!body || body.result !== true) throw new Error(`Ahgora did not confirm success: ${JSON.stringify(body)}`);
  if (!body.NSR) throw new Error('Ahgora success response missing NSR');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(body.day || ''))) throw new Error('Ahgora success response missing/invalid day');
  if (!normalizePunchTime(body.time)) throw new Error('Ahgora success response missing/invalid time');
  const expectedEmployee = process.env.AHGORA_EMPLOYEE_ID;
  if (expectedEmployee && body.employee?._id && body.employee._id !== expectedEmployee) {
    throw new Error(`Ahgora returned unexpected employee id: ${body.employee._id}`);
  }
  return {
    nsr: body.NSR,
    day: body.day,
    time: normalizePunchTime(body.time),
    punchesToday: normalizePunchList(body.batidas_dia),
  };
}

async function main() {
  const execute = process.argv.includes('--execute');
  const now = new Date();
  const local = localParts(now);

  const url = required('AHGORA_PUNCH_URL');
  const method = required('AHGORA_REQUEST_METHOD').toUpperCase();
  const contentType = required('AHGORA_CONTENT_TYPE');
  validateCapturedTransport(url, method, contentType);

  const account = required('AHGORA_ACCOUNT');
  const password = required('AHGORA_PASSWORD');
  const identity = required('AHGORA_IDENTITY');
  const publicKeyPem = required('AHGORA_PUBLIC_KEY_PEM').replace(/\\n/g, '\n');
  const publicKey = getPublicKey(publicKeyPem);
  const fingerprint = publicKeyFingerprint(publicKey);
  const expectedFingerprint = required('AHGORA_PUBLIC_KEY_SHA256').toLowerCase();
  if (fingerprint !== expectedFingerprint) {
    throw new Error(`Execution blocked: RSA public-key fingerprint mismatch (${fingerprint})`);
  }
  const encryptedPassword = encryptPassword(password, publicKey);

  const form = new URLSearchParams({
    account,
    password: encryptedPassword,
    identity,
    origin: process.env.AHGORA_ORIGIN || 'pw2',
    app_version: process.env.AHGORA_APP_VERSION || '2.0',
    key: process.env.AHGORA_KEY || '',
    enc: 'true',
  });

  if (!execute) {
    console.log(JSON.stringify({
      preflight: true,
      requestSent: false,
      url,
      method,
      contentType,
      account,
      identity,
      publicKeySha256: fingerprint,
      rsaPadding: process.env.AHGORA_RSA_PADDING,
      rsaOaepHash: process.env.AHGORA_RSA_PADDING === 'oaep' ? process.env.AHGORA_RSA_OAEP_HASH : null,
      passwordCiphertextLength: encryptedPassword.length,
      localDate: local.date,
    }, null, 2));
    return;
  }

  requireTrue('AHGORA_CAPTURE_CONFIRMED');
  requireTrue('AHGORA_RSA_CONFIRMED');

  const window = currentWindow(now);
  if (!window) throw new Error('Punch blocked: current local time is outside AHGORA_ALLOWED_WINDOWS');

  const lock = lockPath(local.date, window);
  const lockData = { state: 'pending', createdAt: now.toISOString(), localDate: local.date, window };
  acquireLock(lock, lockData);

  try {
    const response = await fetch(url, {
      method,
      headers: {
        'content-type': contentType,
        'accept': 'application/json, text/plain, */*',
        ...parseExtraHeaders(),
      },
      body: form,
      redirect: 'manual',
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
    const body = await response.json();
    const result = validateResponse(body);
    const success = { ...lockData, state: 'success', completedAt: new Date().toISOString(), ...result };
    updateLock(lock, success);
    appendLog(success);
    console.log(JSON.stringify(success, null, 2));
  } catch (error) {
    const failed = { ...lockData, state: 'uncertain_or_failed', failedAt: new Date().toISOString(), error: String(error?.message || error) };
    updateLock(lock, failed);
    appendLog(failed);
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
