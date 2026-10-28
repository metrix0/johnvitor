# The Getaway Club — AI development rules

## Scope and priorities
- Project: **The Getaway Club**, hosted at https://johnvitor.com/game2/ in `metrix0/johnvitor`. Work mainly in `game2/`; the related profile endpoint is `netlify/functions/getaway-profile-v2.mjs`.
- **Working and delivery branch: `main`.** All requested game code changes go through GitHub to `main`; do not create or switch branches unless the user explicitly changes this rule. Unlike iMenu, this project does not use `preview`.
- This repository hosts other sites, utilities, and scheduled functions. Never edit unrelated paths, site behavior, configuration, or deployments while working on the game.
- Current gameplay direction: first-person 3D browser heists, playable solo or by two online players, with five progressively harder jobs (corner store, office, data center, high-rise, bank), unlockable gear, distinct enemy roles, objectives, and extraction. **Current content priority: bigger, longer, more distinctive levels, starting with level 1.** Preserve existing progress rather than rebuilding it unnecessarily.

## Working conduct
- Implement only what the user asks. Make the smallest correct change, and extend/reuse existing systems instead of creating competing implementations.
- Investigation, suggestions, and explanation are **read-only** unless the user explicitly asks to implement or commit.
- Inspect relevant source, state, and callers before drawing conclusions. For bugs, reproduce or establish the cause before fixing; avoid speculative patches and cosmetic workarounds.
- Never invent test results, deployment status, real-time multiplayer success, or cloud-save success. State what was actually verified and what remains untested.
- Keep replies brief and practical. Do not ask for information already available from the repository or conversation.

## Source of truth and structure
- Read current files explicitly from `metrix0/johnvitor` **`main`**. GitHub search excerpts are discovery hints, not guaranteed to represent the intended branch.
- Immediately before modifying an existing file, re-fetch it from the current target-branch HEAD; reconcile concurrent changes. Never overwrite someone else's newer work.
- Inspect current structure before adding files. Prefer feature-adjacent code and existing game architecture, not duplicated subsystems or sweeping reorganizations.
- Existing game modules:
  - `game2/data.js`: missions, equipment, progression, profile normalization.
  - `game2/level1.js`: expanded level-one layout, zones, objectives and landmarks.
  - `game2/simulation.js`: gameplay state, combat, AI, interaction, extraction and revive logic.
  - `game2/render.js`: Three.js/WebGL scene, maps, props and FPS rendering.
  - `game2/main.js`: browser UI, input, game loop, profile persistence and PeerJS co-op.
  - `game2/index.html` and `style.css`: menus, HUD, presentation.
  - `netlify/functions/getaway-profile-v2.mjs`: cloud profile endpoint.
- Preserve the existing username-based profile format, earned currency, unlocks, and browser-local fallback. Avoid destructive schema changes or silently resetting progress.

## Game version — mandatory for every commit
- The single source of truth is the visible `#gameVersion` element in `game2/index.html`, currently initialized at `v0.1.0`. Keep that version visible at the **top right at all times**, including the operator entry screen, the safehouse and its panels, gameplay, mission overlays, and errors. Do not place it behind the UI or obstruct interactive controls.
- **Every commit changing The Getaway Club must increment the visible semantic version exactly once** (including graphics, gameplay, bugs, UI, tests and documentation changes). Default to a PATCH increment; use MINOR for a substantial feature and MAJOR only for a breaking release. Never reuse a version for separate commits.
- Bump the version **after reconciling concurrent changes against the latest remote `main`**. If another agent has already advanced the version, bump from their newest value; never overwrite or skip their bump. Keep the label and current deployed build consistent, and refresh the stylesheet cache key when its styling changes.
- **Every final AI answer reporting a game commit must explicitly state the new version** (and ideally previous → new), alongside the commit SHA/link, affected files, and live URL. Never claim a feature was verified or deployed without actually verifying it. Never omit the version from commit delivery reports.

## Gameplay, co-op and quality
- New or enlarged maps must be traversable: spawn, objectives, enemy routes and extraction should be reachable, with clear sequencing and viable solo progression. Keep new phases, dependencies and routes designed to avoid softlocks.
- Improve actual gameplay, not map area alone: meaningful spaces, encounters, combat pacing, landmarks, optional challenges, and reasons to explore. Keep jobs distinct.
- Preserve keyboard/mouse FPS controls and input feedback (WASD, mouse, shoot, sprint, interact, reload, gadget), enemy variants, upgrades and co-op revive.
- Protect frame rate and loading on desktop browsers. Reuse batched/instanced geometry and existing assets where possible; avoid unbounded per-frame allocations, pathfinding spikes and excessive draw calls.
- Reuse the existing HUD/menu design and interactions across desktop and narrower sizes.

## Concurrent development — mandatory
- Multiple agents and developers may commit to `main` simultaneously. **Never assume the branch has stayed unchanged** since the task began, or since files were first read.
- Record the current remote `main` HEAD SHA before beginning work. **Immediately before creating a commit or pushing**, fetch the latest remote `main` HEAD SHA again and compare it with the recorded SHA. Also re-fetch every intended existing target file from the latest `main`; inspect the intervening changes, especially overlaps with your own edits.
- If `main` advanced, integrate/reapply only your requested changes on top of the **newest** `main` (fetch + rebase/fast-forward or equivalent conflict-aware GitHub edits). Keep concurrent agents' unrelated changes intact; resolve overlapping edits carefully using the latest full file, never an outdated snapshot.
- Recheck remote `main` one final time at commit/push; use non-force fast-forward updates and expected-head/compare-and-swap protections when available.
- If the remote moves or a content-SHA/expected-head check fails during the commit/push, **do not force-push or overwrite**. Fetch the newest HEAD, reconcile again, revalidate, and retry. If a conflict cannot be resolved safely, report the blocker without discarding anyone's work.
- Even when newer commits touch unrelated files, base the final commit on current `main`. One final commit remains the goal; never rewrite, reset, revert, or cherry-pick away other agents' work merely to finish the task.

## Commits and delivery
1. Inspect relevant current source on `main` and make only the requested changes.
2. **Do not run, add, or require game validation**: no automated tests, gameplay regression tests, browser smoke tests, CI validation workflows, or test artifacts. The old game regression tests, Playwright smoke test, and game validation workflow were intentionally removed. Do not recreate them unless the user explicitly requests that.
3. **Run the mandatory concurrent-development HEAD check above immediately before committing/pushing.** Create **one final commit directly on `main`**, based on the latest remote HEAD and containing only intended changes. Do not leave work uncommitted.
4. After committing, report concisely: **new displayed game version** (and previous version), commit SHA/link, exact changed files and count, any unverified functionality if relevant, and the affected live page link (normally https://johnvitor.com/game2/). Clearly distinguish a successful commit from a confirmed deployment.

## Access boundaries
- Use GitHub as the code source of truth. Do not use Remote Desktop Commander, Vercel deployment tools, or unrelated infrastructure connectors without the user's explicit permission for that task.
- If required access is unavailable, identify the precise blocker. Do not claim unperformed checks, successful deployments, or verified functionality.
