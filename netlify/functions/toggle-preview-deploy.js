const PROJECT_ID = 'prj_6dB0Yk1fQjoWLTSOTPvMjibf9nCw';
const TEAM_ID = 'team_ChUlkjEHU8gOCEr29E1oj1Wo';

const COMMAND_OFF = 'if [ "$VERCEL_GIT_COMMIT_REF" != "main" ]; then exit 0; else exit 1; fi';
const COMMAND_ON = 'if [ "$VERCEL_GIT_COMMIT_REF" != "main" ] && [ "$VERCEL_GIT_COMMIT_REF" != "preview" ]; then exit 0; else exit 1; fi';

function text(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store'
    },
    body
  };
}

async function vercelRequest(method, body) {
  const token = process.env.VERCEL_TOKEN || '';
  if (!token) throw new Error('VERCEL_TOKEN is not configured.');

  const response = await fetch(
    `https://api.vercel.com/v9/projects/${PROJECT_ID}?teamId=${TEAM_ID}`,
    {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      ...(body ? { body: JSON.stringify(body) } : {})
    }
  );

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = data?.error?.message || data?.message || `HTTP ${response.status}`;
    throw new Error(`Vercel ${response.status}: ${detail}`);
  }
  return data;
}

exports.handler = async function(event) {
  if (event.httpMethod !== 'GET') return text(405, 'GET only');

  try {
    const project = await vercelRequest('GET');
    const current = project?.commandForIgnoringBuildStep ?? null;

    if (current !== COMMAND_ON && current !== COMMAND_OFF) {
      return text(409, 'UNKNOWN');
    }

    const enabled = current !== COMMAND_ON;
    await vercelRequest('PATCH', {
      commandForIgnoringBuildStep: enabled ? COMMAND_ON : COMMAND_OFF
    });

    return text(200, enabled ? 'ON' : 'OFF');
  } catch (error) {
    return text(502, error?.message || String(error));
  }
};
