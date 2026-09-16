const crypto = require('crypto');

const PROJECT_ID = 'prj_6dB0Yk1fQjoWLTSOTPvMjibf9nCw';
const TEAM_ID = 'team_ChUlkjEHU8gOCEr29E1oj1Wo';
const PREVIEW_BRANCH = 'preview';

const COMMAND_OFF = 'if [ "$VERCEL_GIT_COMMIT_REF" != "main" ]; then exit 0; else exit 1; fi';
const COMMAND_ON = 'if [ "$VERCEL_GIT_COMMIT_REF" != "main" ] && [ "$VERCEL_GIT_COMMIT_REF" != "preview" ]; then exit 0; else exit 1; fi';

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

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function isAuthorized(event) {
  const expected = process.env.PREVIEW_DEPLOY_TOGGLE_SECRET || '';
  const authorization = event.headers?.authorization || event.headers?.Authorization || '';
  if (!expected || !authorization.startsWith('Bearer ')) return false;
  return safeEqual(authorization.slice(7), expected);
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

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    const detail = data?.error?.message || data?.message || text || `HTTP ${response.status}`;
    throw new Error(`Vercel ${response.status}: ${detail}`);
  }

  return data;
}

function stateFromCommand(command) {
  if (command === COMMAND_ON) return { recognized: true, enabled: true };
  if (command === COMMAND_OFF) return { recognized: true, enabled: false };
  return { recognized: false, enabled: null };
}

exports.handler = async function(event) {
  if (!['GET', 'POST'].includes(event.httpMethod)) {
    return json(405, { ok: false, error: 'Method not allowed.' });
  }

  if (!isAuthorized(event)) {
    return json(401, { ok: false, error: 'Unauthorized.' });
  }

  try {
    const project = await vercelRequest('GET');
    const currentCommand = project?.commandForIgnoringBuildStep ?? null;
    const currentState = stateFromCommand(currentCommand);

    if (event.httpMethod === 'GET') {
      return json(200, {
        ok: true,
        project: 'imenu',
        branch: PREVIEW_BRANCH,
        ...currentState
      });
    }

    let requestedEnabled;
    if (event.body) {
      try {
        const parsed = JSON.parse(event.body);
        if (typeof parsed?.enabled === 'boolean') requestedEnabled = parsed.enabled;
      } catch {
        return json(400, { ok: false, error: 'Invalid JSON body.' });
      }
    }

    if (requestedEnabled === undefined && !currentState.recognized) {
      return json(409, {
        ok: false,
        error: 'Current Ignored Build Step is not one of the expected toggle states. No change was made.',
        currentCommand
      });
    }

    const nextEnabled = requestedEnabled ?? !currentState.enabled;
    const nextCommand = nextEnabled ? COMMAND_ON : COMMAND_OFF;

    await vercelRequest('PATCH', {
      commandForIgnoringBuildStep: nextCommand
    });

    return json(200, {
      ok: true,
      project: 'imenu',
      branch: PREVIEW_BRANCH,
      enabled: nextEnabled,
      previousEnabled: currentState.enabled
    });
  } catch (error) {
    return json(502, {
      ok: false,
      error: error?.message || String(error)
    });
  }
};
