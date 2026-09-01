import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env: ${name}`);
  return value;
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

function encryptPassword(password, pem) {
  const paddingName = (process.env.AHGORA_RSA_PADDING || 'pkcs1').toLowerCase();
  const padding = paddingName === 'oaep'
    ? crypto.constants.RSA_PKCS1_OAEP_PADDING
    : crypto.constants.RSA_PKCS1_PADDING;
  const options = { key: pem, padding };
  if (paddingName === 'oaep') options.oaepHash = process.env.AHGORA_RSA_OAEP_HASH || 'sha1';
  return crypto.publicEncrypt(options, Buffer.from(password, 'utf8')).toString('base64');
}

function lockPath(date, window) {
  const dir = process.env.AHGORA_LOCK_DIR || '.locks';
  fs.mkdirSync(dir, { recursive: true });
  const safeWindow = window.replace(/[^0-9-]/g, '_');
  return path.join(dir, `${date}_${safeWindow}.json`);
}

function acquireLock(file, data) {
  try {
    const fd = fs.openSync(file, 'wx');
    fs.writeFileSync(fd, JSON.stringify(data, null, 2));
    fs.closeSync(fd);
  } catch (err) {
    if (err?.code === 'EEXIST') {
      throw new Error(`Punch blocked: idempotency lock already exists at ${file}`);
    }
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

function validateResponse(body) {
  if (!body || body.result !== true) throw new Error(`Ahgora did not confirm success: ${JSON.stringify(body)}`);
  if (!body.NSR) throw new Error('Ahgora success response missing NSR');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(body.day || ''))) throw new Error('Ahgora success response missing/invalid day');
  if (!normalizePunchTime(body.time)) throw new Error('Ahgora success response missing/invalid time');
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
  const window = currentWindow(now);
  if (!window) throw new Error('Punch blocked: current local time is outside AHGORA_ALLOWED_WINDOWS');

  const url = required('AHGORA_PUNCH_URL');
  if (!/^https:\/\//i.test(url)) throw new Error('AHGORA_PUNCH_URL must be HTTPS');

  const account = required('AHGORA_ACCOUNT');
  const password = required('AHGORA_PASSWORD');
  const identity = required('AHGORA_IDENTITY');
  const publicKey = required('AHGORA_PUBLIC_KEY_PEM').replace(/\\n/g, '\n');
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
      dryRun: true,
      url,
      method: 'POST',
      contentType: 'application/x-www-form-urlencoded',
      account,
      identity,
      origin: form.get('origin'),
      app_version: form.get('app_version'),
      enc: true,
      passwordCiphertextLength: encryptedPassword.length,
      localDate: local.date,
      matchedWindow: window,
    }, null, 2));
    return;
  }

  const lock = lockPath(local.date, window);
  const lockData = { state: 'pending', createdAt: now.toISOString(), localDate: local.date, window };
  acquireLock(lock, lockData);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'accept': 'application/json, text/plain, */*',
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

if (process.argv[1] && import.meta.url === new URL(`file://${path.resolve(process.argv[1])}`).href) {
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
