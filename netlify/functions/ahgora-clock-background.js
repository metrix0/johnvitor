const SITE_URL = 'https://johnvitor.com';
const TIME_ZONE = 'America/Sao_Paulo';
const DEFAULT_NTFY_SERVER = 'https://ntfy.sh';

const NATIONAL_HOLIDAYS = new Set([
  '01-01', // Confraternização Universal
  '04-21', // Tiradentes
  '05-01', // Dia do Trabalho
  '09-07', // Independência do Brasil
  '10-12', // Nossa Senhora Aparecida
  '11-02', // Finados
  '11-15', // Proclamação da República
  '11-20', // Dia Nacional de Zumbi e da Consciência Negra
  '12-25'  // Natal
]);

function getSaoPauloDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short'
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return {
    isoDate: `${values.year}-${values.month}-${values.day}`,
    monthDay: `${values.month}-${values.day}`,
    weekday: values.weekday
  };
}

function getExtraNonWorkDates() {
  return new Set(
    (process.env.AHGORA_EXTRA_NONWORK_DATES || '')
      .split(',')
      .map(value => value.trim())
      .filter(Boolean)
  );
}

function getNonWorkReason(date = new Date()) {
  const { isoDate, monthDay, weekday } = getSaoPauloDateParts(date);

  if (weekday === 'Sat' || weekday === 'Sun') return `weekend (${weekday})`;
  if (NATIONAL_HOLIDAYS.has(monthDay)) return `Brazil national holiday (${monthDay})`;
  if (getExtraNonWorkDates().has(isoDate)) return `extra non-work date (${isoDate})`;

  return null;
}

function pickOffsetMinutes() {
  const r = Math.random() * 100;
  if (r < 7.5) return -2;
  if (r < 22.5) return -1;
  if (r < 52.5) return 0;
  if (r < 87) return 1;
  if (r < 97) return 2;
  if (r < 98.5) return 3;
  return 4;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function sendFailureAlert(slot, reason) {
  const topic = process.env.NTFY_TOPIC;
  const server = (process.env.NTFY_SERVER || DEFAULT_NTFY_SERVER).replace(/\/$/, '');

  if (!topic) {
    console.error(`Ahgora ${slot}: ntfy not configured; alert not sent.`);
    return;
  }

  try {
    const response = await fetch(`${server}/${encodeURIComponent(topic)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Title': 'Ahgora: batida falhou',
        'Priority': '5',
        'Tags': 'warning,rotating_light',
        'Click': `${SITE_URL}/ahgora`
      },
      body: `Batida das ${slot} falhou: ${reason}`
    });

    if (!response.ok) {
      console.error(`Ahgora ${slot}: ntfy alert failed: HTTP ${response.status}`);
      return;
    }

    console.log(`Ahgora ${slot}: ntfy urgent alert sent.`);
  } catch (error) {
    console.error(`Ahgora ${slot}: ntfy alert error: ${error?.message || String(error)}`);
  }
}

exports.handler = async function(event) {
  let slot = 'unknown';

  try {
    const body = event.body ? JSON.parse(event.body) : {};
    slot = body.slot || 'unknown';

    const nonWorkReason = getNonWorkReason();
    if (nonWorkReason) {
      console.log(`Ahgora ${slot}: skipped — ${nonWorkReason}.`);
      return;
    }

    const offsetMinutes = pickOffsetMinutes();
    const delayMinutes = offsetMinutes + 2;

    console.log(`Ahgora ${slot}: offset ${offsetMinutes >= 0 ? '+' : ''}${offsetMinutes} min; waiting ${delayMinutes} min.`);

    if (delayMinutes > 0) {
      await sleep(delayMinutes * 60 * 1000);
    }

    const response = await fetch(`${SITE_URL}/api/ahgora`, {
      method: 'POST',
      headers: { Accept: 'application/json' }
    });

    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch { data = null; }

    if (!response.ok || !data?.ok || !data?.punched) {
      const reason = data?.error || `HTTP ${response.status}`;
      console.error(`Ahgora ${slot}: punch failed: ${reason}`);
      await sendFailureAlert(slot, reason);
      return;
    }

    console.log(`Ahgora ${slot}: punch registered at ${data.time || 'unknown time'}; NSR ${data.nsr ?? 'unknown'}.`);
  } catch (error) {
    // Do not throw: Netlify background functions retry failed invocations,
    // which could create a duplicate punch if the first request actually succeeded.
    const reason = error?.message || String(error);
    console.error(`Ahgora ${slot}: background clock error: ${reason}`);
    await sendFailureAlert(slot, reason);
  }
};
