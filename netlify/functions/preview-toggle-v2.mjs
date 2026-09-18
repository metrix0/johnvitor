import { getStore } from '@netlify/blobs';

const STORE = 'preview-deploy-toggle-v2';
const KEY = 'enabled';
const DEPLOY_HOOK = 'https://api.vercel.com/v1/integrations/deploy/prj_6dB0Yk1fQjoWLTSOTPvMjibf9nCw/QdNyV6TWd0';

const SECONDARY_PROJECT_NAME = 'imenu';
const SHARED_STATUS_COMMAND = 'if [ "$VERCEL_GIT_COMMIT_REF" = "main" ]; then exit 1; fi; if [ "$VERCEL_GIT_COMMIT_REF" != "preview" ]; then exit 0; fi; if [ "$(curl -fsS --max-time 5 https://johnvitor.com/api/preview-deploy-status)" = "ON" ]; then exit 1; else exit 0; fi';

async function vercelRequest(token, path, options = {}) {
  const response = await fetch(`https://api.vercel.com${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  const raw = await response.text();
  let data = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = { raw };
  }

  if (!response.ok) {
    const detail = data?.error?.message || data?.message || raw || `HTTP ${response.status}`;
    const error = new Error(`Vercel ${response.status}: ${detail}`);
    error.status = response.status;
    throw error;
  }

  return data;
}

async function tryProject(token, teamId = null) {
  const query = teamId ? `?teamId=${encodeURIComponent(teamId)}` : '';

  try {
    const project = await vercelRequest(
      token,
      `/v9/projects/${encodeURIComponent(SECONDARY_PROJECT_NAME)}${query}`
    );
    return { project, teamId };
  } catch (error) {
    if (error?.status === 404 || error?.status === 403) return null;
    throw error;
  }
}

async function findSecondaryProject(token) {
  const direct = await tryProject(token);
  if (direct) return direct;

  const teamsData = await vercelRequest(token, '/v2/teams?limit=100');
  const teams = Array.isArray(teamsData?.teams) ? teamsData.teams : [];

  for (const team of teams) {
    const teamId = team?.id;
    if (!teamId) continue;

    const found = await tryProject(token, teamId);
    if (found) return found;
  }

  throw new Error('Could not find the imenu project with VERCEL_TOKEN_2.');
}

async function ensureSecondaryProjectUsesSharedToggle() {
  const token = process.env.VERCEL_TOKEN_2 || '';
  if (!token) throw new Error('VERCEL_TOKEN_2 is not configured.');

  const { project, teamId } = await findSecondaryProject(token);

  if (project?.commandForIgnoringBuildStep === SHARED_STATUS_COMMAND) return;

  const query = teamId ? `?teamId=${encodeURIComponent(teamId)}` : '';

  await vercelRequest(
    token,
    `/v9/projects/${encodeURIComponent(project.id || SECONDARY_PROJECT_NAME)}${query}`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        commandForIgnoringBuildStep: SHARED_STATUS_COMMAND
      })
    }
  );
}

export default async (req) => {
  if (req.method !== 'GET') return new Response('GET only', { status: 405 });

  try {
    await ensureSecondaryProjectUsesSharedToggle();

    const store = getStore({ name: STORE, consistency: 'strong' });
    const current = await store.get(KEY, { type: 'text' });
    const next = current === 'ON' ? 'OFF' : 'ON';

    await store.set(KEY, next);

    if (next === 'ON') {
      const deploy = await fetch(DEPLOY_HOOK, { method: 'POST' });
      if (!deploy.ok) {
        await store.set(KEY, 'OFF');
        return new Response('ERROR', { status: 502 });
      }
    }

    return new Response(next, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store'
      }
    });
  } catch (error) {
    return new Response(error?.message || String(error), { status: 500 });
  }
};
