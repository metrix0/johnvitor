# The Getaway Club — AI development rules

## Scope and priorities
- Project: **The Getaway Club**, hosted at https://johnvitor.com/game2/ in `metrix0/johnvitor`. Work mainly in `game2/`; the related profile endpoint is `netlify/functions/getaway-profile-v2.mjs`.
- **Working and delivery branch: `main`.** All requested game code changes go through GitHub to `main`; do not create or switch branches unless the user explicitly changes this rule. Unlike iMenu, this project does not use `preview`.
- This repository hosts other sites, utilities, and scheduled functions. Never edit unrelated paths, site behavior, configuration, or deployments while working on the game.
- Current gameplay direction: first-person 3D browser heists, playable solo or by two online players, with five progressively harder jobs (corner store, office, data center, high-rise, bank), unlockable gear, distinct enemy roles, objectives, and extraction. **Current content priority: bigger, longer, more distinctive levels, starting with level 1.** Preserve existing progress rather than rebuilding it unnecessarily.

## Working conduct
- Implement only what the user asks. Make the smallest correct change, and extend/reuse existing systems instead of creating competing implementations.
- Investigation, suggestions, and explanation are **read-only** unless the user explicitly asks to implement or commit.
- Inspect relevant source, state, callers, and tests before drawing conclusions. For bugs, reproduce or establish the cause before fixing; avoid speculative patches and cosmetic workarounds.
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
  - `game2/game.test.mjs`, `game2/browser.smoke.mjs`: regression and browser tests.
  - `netlify/functions/getaway-profile-v2.mjs`: cloud profile endpoint.
- Preserve the existing username-based profile format, earned currency, unlocks, and browser-local fallback. Avoid destructive schema changes or silently resetting progress.

## Gameplay, co-op and quality
- New or enlarged maps must be traversable: spawn, objectives, enemy routes and extraction should be reachable, with clear sequencing and viable solo progression. Add/update tests for new phases, dependencies and softlock risks.
- Improve actual gameplay, not map area alone: meaningful spaces, encounters, combat pacing, landmarks, optional challenges, and reasons to explore. Keep jobs distinct.
- Preserve keyboard/mouse FPS controls and input feedback (WASD, mouse, shoot, sprint, interact, reload, gadget), enemy variants, upgrades and co-op revive.
- Test single-player and two-player behavior separately. Passing simulation tests does **not** prove real PeerJS connections work between two browsers/devices. Do not call co-op end-to-end verified without a real two-client check.
- Likewise, browser-local profile saves do **not** prove Netlify Blobs cloud persistence works. Test cloud GET/POST on the deployed endpoint before claiming cloud saves are verified.
- Protect frame rate and loading on desktop browsers. Reuse batched/instanced geometry and existing assets where possible; avoid unbounded per-frame allocations, pathfinding spikes and excessive draw calls.
- Reuse the existing HUD/menu design and interactions. For visual changes, inspect the rendered page and relevant states at desktop and narrower sizes; don't treat a passing build as visual validation.

## Validation and delivery
1. Inspect the affected source and tests on `main`; make only the requested changes.
2. Validate with applicable existing checks:
   - `node --check --experimental-default-type=module game2/data.js` (and each other modified JS module).
   - `node --experimental-default-type=module --test game2/game.test.mjs`.
   - `node game2/browser.smoke.mjs` when Playwright/Chromium dependencies are available.
   - Add targeted gameplay tests for altered mission mechanics; perform real two-client and cloud checks when claiming those flows.
3. Create **one final commit directly on `main`**, containing only intended game changes. Do not leave requested work as an uncommitted local-only modification.
4. The existing `.github/workflows/getaway-game.yml` automatically validates changes to `game2/**`. Do not manually trigger workflows, manage deployments or modify site-wide CI unless explicitly requested.
5. After committing, report concisely: commit SHA/link, exact changed files and count, tests actually run with results, any unverified flows, and the affected live page link (normally https://johnvitor.com/game2/). Clearly distinguish a successful commit from a confirmed deployment.

## Access boundaries
- Use GitHub as the code source of truth. Do not use Remote Desktop Commander, Vercel deployment tools, or unrelated infrastructure connectors without the user's explicit permission for that task.
- If required access is unavailable, identify the precise blocker. If only environment/secrets prevent an optional live test, commit otherwise complete work and report the test as unverified.
