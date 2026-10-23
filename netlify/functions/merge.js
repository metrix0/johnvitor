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

// Delete the exact snapshot branch only after a GitHub-confirmed merge.
// Failures are reported separately and retried by the result endpoint.
async function cleanupMergedSnapshot(repo, pr) {
  if (!pr?.merged || !trustedMergePr(pr, repo) ||
      !pr.head.ref.startsWith(SNAPSHOT_PREFIX)) return {};

  try {
    await github(repo, "/git/refs/heads/" + pr.head.ref, { method: "DELETE" });
    return { snapshotDeleted: true };
  } catch (error) {
    if (error.status === 404) return { snapshotDeleted: true };
    console.error("merge snapshot cleanup:", error);
    return {
      snapshotDeleted: false,
      snapshotCleanupError: "GitHub confirmed the merge, but could not delete the snapshot branch."
    };
  }
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


function githubActionsJobId(run) {
  const url = String(run?.details_url || run?.html_url || "");
  const match = /^https:\/\/github\.com\/[^/]+\/[^/]+\/actions\/runs\/\d+\/job\/(\d+)(?:[/?#]|$)/.exec(url);
  return match ? Number(match[1]) : null;
}

function failureLogExcerpt(log) {
  const lines = log.split(/\r?\n/).map(line => line
    .replace(/^\d{4}-\d\d-\d\dT\S+Z\s*/, "")
    .replace(/\x1b\[[\d;]*m/g, "")
    .replace(/github_pat_[\w]{20,}|gh[pousr]_[A-Za-z0-9_]{20,}/g, "[redacted]")
    .replace(/(Bearer\s+)\S+/gi, "$1[redacted]")
    .trimEnd()).filter(Boolean);
  const diagnostic = /\berror TS\d+\b|\b(?:TimeoutError|AssertionError|SyntaxError|ReferenceError|TypeError|Error):|\bFAIL\b|##\[error\]/i;
  const hits = lines.map((line, index) => ({ line, index }))
    .filter(({ line }) => diagnostic.test(line) && !/Process completed with exit code/i.test(line));
  if (!hits.length) return null;
  const recent = [...new Set(hits.map(hit => hit.line))].slice(-5);
  const last = hits[hits.length - 1].index;
  return [...new Set([...recent, ...lines.slice(last + 1, last + 10)])].join("\n").slice(0, 3000);
}

async function failedJobDetails(repo, run) {
  const id = githubActionsJobId(run);
  if (!id) return { failedStep: null, passedSteps: [], log: null };
  let failedStep = null, passedSteps = [], log = null;
  try {
    const job = await github(repo, `/actions/jobs/${id}`);
    const steps = Array.isArray(job?.steps) ? job.steps : [];
    failedStep = steps.find(step => step?.conclusion === "failure" || step?.conclusion === "timed_out")?.name || null;
    passedSteps = steps.filter(step => step?.conclusion === "success" && /^(Typecheck|Build)$/i.test(step?.name || ""))
      .map(step => step.name);
  } catch { /* Preserve annotations if the job metadata is unavailable. */ }
  try {
    const response = await fetch(`https://api.github.com/repos/${repo}/actions/jobs/${id}/logs`, {
      headers: {
        "Accept": "application/vnd.github+json",
        "Authorization": `Bearer ${githubToken()}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "johnvitor-merge"
      },
      signal: AbortSignal.timeout(8000)
    });
    if (response.ok && response.body) {
      const decoder = new TextDecoder();
      let tail = "";
      for await (const chunk of response.body) {
        tail += decoder.decode(chunk, { stream: true });
        if (tail.length > 150000) tail = tail.slice(-150000);
      }
      log = failureLogExcerpt(tail + decoder.decode());
    }
  } catch { /* Job logs are optional; failure must remain visible without them. */ }
  return { failedStep, passedSteps, log };
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

  let error = null, failedStep = null, passedSteps = [];
  if (typecheckRun?.conclusion === "failure" && typecheckRun.id) {
    const job = await failedJobDetails(repo, typecheckRun);
    failedStep = job.failedStep;
    passedSteps = job.passedSteps;
    let annotations = [];
    try {
      const response = await github(repo, `/check-runs/${typecheckRun.id}/annotations?per_page=100`);
      annotations = (Array.isArray(response) ? response : [])
        .map(annotation => {
          const location = annotation?.path
            ? `${annotation.path}${annotation.start_line ? `:${annotation.start_line}` : ""}`
            : "";
          return [location, String(annotation?.message || "").trim()].filter(Boolean).join("\n");
        }).filter(Boolean);
    } catch { /* Check-run output remains available. */ }
    error = [
      failedStep ? `Failed step: ${failedStep}` : null,
      passedSteps.length ? `Passed: ${passedSteps.join(", ")}` : null,
      job.log ? `Log excerpt:\n${job.log}` : null,
      annotations.length ? `GitHub annotations:\n${annotations.join("\n\n")}` : null,
      !job.log && !annotations.length ? [
        typecheckRun?.output?.title,
        typecheckRun?.output?.summary,
        typecheckRun?.output?.text
      ].filter(Boolean).join("\n\n") : null
    ].filter(Boolean).join("\n\n") || null;
  }

  const typecheck = {
    state: checkRunState(typecheckRun),
    status: typecheckRun?.status || "queued",
    conclusion: typecheckRun?.conclusion || null,
    url: typecheckRun?.html_url || typecheckRun?.details_url || null,
    failedStep,
    passedSteps,
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
    ? `Required validation failed.\n\n${details}`
    : "Required validation failed.";
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
        const cleanup = activePr.merged
          ? await cleanupMergedSnapshot(repo, activePr)
          : {};
        return json(200, {
          ok: true,
          merged: Boolean(activePr.merged),
          closed: activePr.state === "closed",
          pr: activePr.number,
          prUrl: activePr.html_url,
          sha: activePr.merged ? activePr.merge_commit_sha : null,
          ...cleanup
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

    const cleanup = await cleanupMergedSnapshot(repo, { ...pr, merged: true });
    return json(200, {
      ok: true,
      merged: true,
      ...metadata,
      sha: result.sha || null,
      ...cleanup
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
