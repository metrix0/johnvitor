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

const SNAPSHOT_PREFIX = "merge-snapshot-";

function trustedMergePr(pr, repo) {
  const ref = pr?.head?.ref || "";
  return pr?.base?.ref === "main" && pr?.head?.repo?.full_name === repo &&
    (ref === "preview" ||
      (ref.startsWith(SNAPSHOT_PREFIX) && ref.slice(SNAPSHOT_PREFIX.length) === pr?.head?.sha));
}

async function getOrCreateSnapshotPr(repo, sha) {
  const branch = SNAPSHOT_PREFIX + sha;
  const query = new URLSearchParams({
    state: "open", head: repo.split("/")[0] + ":" + branch, base: "main", per_page: "10"
  });
  const lookup = () => github(repo, `/pulls?${query.toString()}`);
  const existing = await lookup();
  if (existing[0]) {
    if (!trustedMergePr(existing[0], repo) || existing[0].head.sha !== sha) {
      throw new Error("The snapshot pull request does not match the approved commit.");
    }
    return existing[0];
  }

  try {
    await github(repo, "/git/refs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ref: "refs/heads/" + branch, sha })
    });
  } catch (error) {
    if (error.status !== 422) throw error;
    const ref = await github(repo, "/git/ref/heads/" + branch);
    if (ref?.object?.sha !== sha) throw error;
  }

  try {
    return await github(repo, "/pulls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Preview", head: branch, base: "main" })
    });
  } catch (error) {
    if (error.status === 422) {
      const raced = await lookup();
      if (raced[0] && trustedMergePr(raced[0], repo) && raced[0].head.sha === sha) return raced[0];
    }
    throw error;
  }
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

async function restartBlockedTypecheck(repo, sha, prNumber) {
  const query = new URLSearchParams({
    event: "pull_request",
    head_sha: sha,
    per_page: "20"
  });
  const runs = await github(repo, `/actions/runs?${query.toString()}`);
  const workflowRuns = (Array.isArray(runs?.workflow_runs) ? runs.workflow_runs : [])
    .filter(run => run?.path === ".github/workflows/validate-build.yml")
    .sort((a, b) => Number(b?.id || 0) - Number(a?.id || 0));

  const blocked = workflowRuns.find(
    run => run?.conclusion === "action_required"
  ) || null;

  if (!blocked?.id) return null;

  const newerRun = workflowRuns.find(run =>
    run?.id !== blocked.id &&
    run?.conclusion !== "action_required" &&
    new Date(run?.created_at || 0).getTime() >=
      new Date(blocked?.created_at || 0).getTime()
  );
  if (newerRun) return newerRun.html_url || blocked.html_url || null;

  const headers = { "Content-Type": "application/json" };
  await github(repo, `/pulls/${prNumber}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ state: "closed" })
  });
  await github(repo, `/pulls/${prNumber}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ state: "open" })
  });

  return blocked.html_url || null;
}

async function getMergeValidation(repo, sha, prNumber) {
  const checks = await github(repo, `/commits/${sha}/check-runs?per_page=100`);

  const typecheckRun = (Array.isArray(checks?.check_runs) ? checks.check_runs : [])
    .filter(run => run?.name === "merge-typecheck" && run?.conclusion !== "skipped")
    .sort((a, b) => Number(b?.id || 0) - Number(a?.id || 0))[0] || null;

  if (!typecheckRun) {
    const restartUrl = await restartBlockedTypecheck(repo, sha, prNumber);
    if (restartUrl) {
      return {
        ready: false,
        failed: false,
        typecheck: {
          state: "pending",
          status: "queued",
          url: restartUrl,
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
    status: typecheckRun?.status || "queued",
    conclusion: typecheckRun?.conclusion || null,
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

async function productionHealth() {
  try {
    const response = await fetch("https://www.imenuapp.com.br/api/health", {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000)
    });
    const data = await response.json().catch(() => null);
    return response.status === 200 && data?.ok === true ? "success" : "failure";
  } catch {
    return "unknown";
  }
}

function deploymentRunState(run) {
  if (!run) return "unknown";
  if (run.status !== "completed") return "pending";
  if (run.conclusion === "success") return "success";
  if (run.conclusion === "cancelled") return "cancelled";
  if (run.conclusion === "skipped") return "skipped";
  return "failure";
}

async function getImenuDeployments(repo) {
  const [preview, actions, productionState] = await Promise.all([
    github(repo, "/branches/preview"),
    github(repo, "/actions/runs?branch=preview&per_page=100"),
    productionHealth()
  ]);
  const previewSha = preview?.commit?.sha || null;
  const runs = (Array.isArray(actions?.workflow_runs) ? actions.workflow_runs : [])
    .filter(run => run?.path === ".github/workflows/deploy-vps-preview.yml")
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  const currentRun = runs.find(run => run.head_sha === previewSha) || null;
  return {
    main: { state: productionState, sha: null, url: "https://www.imenuapp.com.br", history: [] },
    preview: {
      state: !currentRun && runs.length ? "not_deployed" : deploymentRunState(currentRun),
      sha: previewSha,
      url: currentRun?.html_url || null,
      history: runs.slice(0, 3).map(run => ({
        state: deploymentRunState(run),
        sha: run.head_sha || null,
        date: run.created_at || null,
        url: run.html_url || null
      }))
    }
  };
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
  const action = body.action || "merge";
  if (!["status", "deploy-status", "validate", "merge", "result"].includes(action)) {
    return json(400, { ok: false, error: "Unknown action." });
  }
  if ((action === "result" || body.pr !== undefined) &&
      (!Number.isSafeInteger(body.pr) || body.pr < 1)) {
    return json(400, { ok: false, error: "Invalid pull request." });
  }
  if (action === "merge" && body.pr !== undefined && !/^[a-f0-9]{40}$/.test(body.headSha || "")) {
    return json(400, { ok: false, error: "Missing validated commit." });
  }

  let activePr = null;
  let mergeRequested = false;

  try {
    const expected = await expectedPassword(event);
    if (typeof body.password !== "string" || body.password.trim() !== expected) {
      return json(401, { ok: false, error: "Wrong password." });
    }

    if (!githubToken()) {
      return json(500, { ok: false, error: "GitHub merge token is not configured." });
    }

    if (action === "deploy-status") {
      if (body.project !== "imenu") {
        return json(400, { ok: false, error: "Deployment status is only available for iMenu." });
      }
      return json(200, { ok: true, deployments: await getImenuDeployments(repo) });
    }

    // Once created, the PR keeps the exact snapshot across all validation polls.
    if (body.pr !== undefined && ["validate", "merge", "result"].includes(action)) {
      activePr = await github(repo, `/pulls/${body.pr}`);
      if (!trustedMergePr(activePr, repo)) {
        return json(400, { ok: false, error: "This is not a trusted preview snapshot pull request." });
      }
      if (action === "result" || activePr.merged) {
        return json(200, {
          ok: true,
          merged: Boolean(activePr.merged),
          closed: activePr.state === "closed",
          pr: activePr.number,
          prUrl: activePr.html_url,
          sha: activePr.merged ? activePr.merge_commit_sha : null
        });
      }
      if (activePr.state !== "open") {
        return json(409, { ok: false, pr: activePr.number, error: "Pull request was closed without merging." });
      }
    }

    const snapshotSha = action === "validate" && !activePr
      ? (await github(repo, "/branches/preview"))?.commit?.sha
      : null;
    if (snapshotSha !== null && !/^[a-f0-9]{40}$/.test(snapshotSha || "")) {
      throw new Error("Could not capture the preview snapshot.");
    }
    const comparisonRef = activePr?.head?.sha || snapshotSha || "preview";
    const comparison = await github(repo, `/compare/main...${comparisonRef}`);
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

    if (action === "status") {
      return json(200, {
        ok: true,
        commits
      });
    }

    const pr = activePr || (action === "validate"
      ? await getOrCreateSnapshotPr(repo, snapshotSha)
      : await getOrCreatePr(repo));
    activePr = pr;
    const headSha = pr?.head?.sha || comparison?.commits?.at(-1)?.sha;
    const metadata = { pr: pr.number, prUrl: pr.html_url, headSha, commits };
    if (action === "merge" && body.headSha && body.headSha !== headSha) {
      return json(409, {
        ok: false, ...metadata, code: "preview_changed",
        error: "Preview changed after validation. Validate the new changes before merging."
      });
    }
    const validation = await getMergeValidation(
      repo,
      headSha,
      pr.number
    );

    if (validation.failed) {
      return json(409, {
        ok: false,
        error: validationError(validation),
        ...metadata,
        validation
      });
    }

    if (!validation.ready) {
      return json(202, {
        ok: true,
        pending: true,
        ...metadata,
        validation
      });
    }

    if (action === "validate") {
      return json(200, { ok: true, ready: true, ...metadata, validation });
    }

    // GitHub must merge exactly the head that passed validation.
    mergeRequested = true;
    const isSnapshot = pr.head.ref.startsWith(SNAPSHOT_PREFIX);
    const mergeBody = { merge_method: "squash", sha: headSha };
    if (isSnapshot) {
      mergeBody.commit_message = commits.map(title => "* " + title).join("\n") +
        "\n\n[merge-snapshot:" + headSha + "]";
    }
    const result = await github(repo, `/pulls/${pr.number}/merge`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mergeBody)
    });

    if (typeof result.merged !== "boolean") {
      throw new Error("GitHub did not return a confirmed merge result.");
    }

    if (!result.merged) {
      return json(409, {
        ok: false,
        ...metadata,
        error: result.message || "GitHub did not merge the pull request."
      });
    }

    return json(200, {
      ok: true,
      merged: true,
      ...metadata,
      sha: result.sha || null
    });
  } catch (error) {
    console.error("merge:", error);
    const refused = [400, 401, 403, 404, 405, 409, 422].includes(error.status);
    const uncertain = mergeRequested && !refused;
    const status = refused ? 409 : 500;
    return json(status, {
      ok: false,
      ...(activePr ? { pr: activePr.number, prUrl: activePr.html_url } : {}),
      ...(uncertain ? { uncertain: true } : {}),
      error: error?.message || "Merge failed."
    });
  }
};
