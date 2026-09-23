const REPOS = Object.freeze({
  imenu: "metrix0/imenu",
  engravida: "metrix0/EngravidaHub"
});

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify(body)
  };
}

function githubToken() {
  return process.env.IMENU_SYNC_TOKEN || "";
}

async function github(repo, path, options = {}) {
  const token = githubToken();
  if (!token) throw new Error("GitHub merge token is not configured.");

  const response = await fetch(`https://api.github.com/repos/${repo}${path}`, {
    ...options,
    headers: {
      "Accept": "application/vnd.github+json",
      "Authorization": `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "johnvitor-merge",
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { message: text }; }

  if (!response.ok) {
    const error = new Error(data?.message || `GitHub returned HTTP ${response.status}.`);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

async function expectedPassword(event) {
  const base = process.env.URL || `https://${event.headers?.host || "johnvitor.com"}`;
  const response = await fetch(`${base.replace(/\/$/, "")}/msg/app.js`, {
    headers: { "Cache-Control": "no-cache" }
  });
  if (!response.ok) throw new Error("Could not load password configuration.");

  const source = await response.text();
  const match = source.match(/const API_KEY = "([^"]+)"/);
  const expected = match?.[1]?.slice(-3);
  if (!expected) throw new Error("Could not read password configuration.");
  return expected;
}

async function findOpenPreviewPr(repo) {
  const query = new URLSearchParams({
    state: "open",
    head: "metrix0:preview",
    base: "main",
    per_page: "10"
  });

  const prs = await github(repo, `/pulls?${query.toString()}`);
  return Array.isArray(prs) ? prs[0] || null : null;
}

async function getOrCreatePr(repo) {
  const existing = await findOpenPreviewPr(repo);
  if (existing) return existing;

  try {
    return await github(repo, "/pulls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Preview",
        head: "preview",
        base: "main"
      })
    });
  } catch (error) {
    if (error.status === 422) {
      const raced = await findOpenPreviewPr(repo);
      if (raced) return raced;
    }
    throw error;
  }
}

exports.handler = async function(event) {
  if (event.httpMethod === "GET" && event.queryStringParameters?.diag === "github-env") {
    return json(200, {
      githubEnvKeys: Object.keys(process.env)
        .filter((key) => /^(GITHUB|GH_)/i.test(key))
        .sort()
    });
  }

  if (event.httpMethod !== "POST") {
    return json(405, { ok: false, error: "Method not allowed." });
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { ok: false, error: "Invalid request." });
  }

  const repo = REPOS[body.project];
  if (!repo) return json(400, { ok: false, error: "Unknown project." });

  try {
    const expected = await expectedPassword(event);
    if (typeof body.password !== "string" || body.password.trim() !== expected) {
      return json(401, { ok: false, error: "Wrong password." });
    }

    if (!githubToken()) {
      return json(500, { ok: false, error: "GitHub merge token is not configured." });
    }

    const comparison = await github(repo, "/compare/main...preview");
    const changedFiles = Array.isArray(comparison.files) ? comparison.files.length : null;

    if ((comparison.ahead_by || 0) === 0 || changedFiles === 0) {
      return json(200, { ok: true, merged: false, synced: true });
    }

    const pr = await getOrCreatePr(repo);

    const result = await github(repo, `/pulls/${pr.number}/merge`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ merge_method: "squash" })
    });

    if (!result.merged) {
      return json(409, {
        ok: false,
        error: result.message || "GitHub did not merge the pull request."
      });
    }

    return json(200, {
      ok: true,
      merged: true,
      pr: pr.number,
      sha: result.sha || null
    });
  } catch (error) {
    console.error("merge:", error);
    const status = error.status === 409 || error.status === 405 ? 409 : 500;
    return json(status, {
      ok: false,
      error: error?.message || "Merge failed."
    });
  }
};
