const PROJECTS = Object.freeze({
  imenu: {
    repo: "metrix0/imenu"
  },
  engravida: {
    repo: "metrix0/EngravidaHub"
  }
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
  return process.env.GITHUB_MERGE_TOKEN || "";
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

function checkRunState(run) {
  if (!run || run.status !== "completed") return "pending";
  return run.conclusion === "success" ? "success" : "failure";
}

async function approveBlockedTypecheck(repo, sha) {
  const query = new URLSearchParams({
    event: "pull_request",
    head_sha: sha,
    per_page: "20"
  });
  const runs = await github(repo, `/actions/runs?${query.toString()}`);
  const blocked = (Array.isArray(runs?.workflow_runs) ? runs.workflow_runs : [])
    .filter(run =>
      run?.path === ".github/workflows/validate-build.yml" &&
      run?.conclusion === "action_required"
    )
    .sort((a, b) => Number(b?.id || 0) - Number(a?.id || 0))[0] || null;

  if (!blocked?.id) return null;

  try {
    await github(repo, `/actions/runs/${blocked.id}/approve`, {
      method: "POST"
    });
  } catch (error) {
    if (![409, 422].includes(error.status)) throw error;
  }

  return blocked.html_url || null;
}

async function getMergeValidation(repo, sha) {
  const checks = await github(repo, `/commits/${sha}/check-runs?per_page=100`);

  const typecheckRun = (Array.isArray(checks?.check_runs) ? checks.check_runs : [])
    .filter(run => run?.name === "merge-typecheck" && run?.conclusion !== "skipped")
    .sort((a, b) => Number(b?.id || 0) - Number(a?.id || 0))[0] || null;

  if (!typecheckRun) {
    const approvalUrl = await approveBlockedTypecheck(repo, sha);
    if (approvalUrl) {
      return {
        ready: false,
        failed: false,
        typecheck: {
          state: "pending",
          url: approvalUrl,
          error: null
        }
      };
    }
  }

  let error = null;
  if (typecheckRun?.conclusion === "failure" && typecheckRun.id) {
    try {
      const annotations = await github(
        repo,
        `/check-runs/${typecheckRun.id}/annotations?per_page=100`
      );
      const details = (Array.isArray(annotations) ? annotations : [])
        .map(annotation => {
          const location = annotation?.path
            ? `${annotation.path}${annotation.start_line ? `:${annotation.start_line}` : ""}`
            : "";
          const message = String(annotation?.message || "").trim();
          return [location, message].filter(Boolean).join("\n");
        })
        .filter(Boolean);

      if (details.length) error = details.join("\n\n");
    } catch {
      // Fall back to the check output below.
    }

    if (!error) {
      error = [
        typecheckRun?.output?.title,
        typecheckRun?.output?.summary,
        typecheckRun?.output?.text
      ].filter(Boolean).join("\n\n") || null;
    }
  }

  const typecheck = {
    state: checkRunState(typecheckRun),
    url: typecheckRun?.html_url || typecheckRun?.details_url || null,
    error
  };

  return {
    ready: typecheck.state === "success",
    failed: typecheck.state === "failure",
    typecheck
  };
}

function validationError(validation) {
  if (validation?.typecheck?.state !== "failure") {
    return "Required validation is still running.";
  }

  const details = String(validation.typecheck.error || "").trim();
  return details
    ? `TypeScript validation failed.\n\n${details}`
    : "TypeScript validation failed.";
}

exports.handler = async function(event) {
  if (event.httpMethod !== "POST") {
    return json(405, { ok: false, error: "Method not allowed." });
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { ok: false, error: "Invalid request." });
  }

  const project = PROJECTS[body.project];
  if (!project) return json(400, { ok: false, error: "Unknown project." });
  const repo = project.repo;

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
    const commits = Array.isArray(comparison.commits)
      ? comparison.commits.map(commit =>
          String(commit?.commit?.message || "").split("\n")[0].trim()
        ).filter(Boolean)
      : [];
    const synced = (comparison.ahead_by || 0) === 0 || changedFiles === 0;

    if (synced) {
      return json(200, {
        ok: true,
        merged: false,
        synced: true,
        commits: []
      });
    }

    if (body.action === "status") {
      return json(200, {
        ok: true,
        commits
      });
    }

    const pr = await getOrCreatePr(repo);
    const validation = await getMergeValidation(
      repo,
      pr?.head?.sha || comparison?.commits?.at(-1)?.sha
    );

    if (validation.failed) {
      return json(409, {
        ok: false,
        error: validationError(validation),
        pr: pr.number,
        validation
      });
    }

    if (!validation.ready) {
      return json(202, {
        ok: true,
        pending: true,
        pr: pr.number,
        validation
      });
    }

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
