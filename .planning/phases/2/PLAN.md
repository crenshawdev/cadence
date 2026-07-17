---
phase: 2
plan: 1
requirements: [GIT-02, GIT-03]
files:
  - cadence-core/config.schema.json
  - cadence-core/templates/config.json
  - cadence-core/workflows/config.md
  - cadence-core/bin/self-verify.mjs
  - cadence-core/bin/self-verify.test.mjs
  - cadence-core/bin/lib/close-decision.mjs
  - cadence-core/bin/close-decision.test.mjs
  - cadence-core/bin/land-cleanup.mjs
  - cadence-core/bin/land-cleanup.test.mjs
  - cadence-core/bin/weight-budgets.json
  - skills/cad-land/SKILL.md
  - skills/cad-milestone/SKILL.md
  - cadence-core/workflows/milestone.md
  - cadence-core/references/git.md
---

# Phase 2: Land cleanup + autonomous close - Plan

## Goal

A cycle returns to a clean base by default after a land - back on `main`,
pulled, with the merged integration branch reaped - and can optionally run the
entire close (audit -> tag -> PR -> merge -> reset) end-to-end with no per-step
prompts, without ever losing the `pre_ship` review gate.

## Must be true when done

- `config.mjs get git.on_land_cleanup` returns `true` and `git.auto_close`
  returns `false` on a default config; each rejects a non-boolean value.
- `node cadence-core/bin/self-verify.mjs` exits 0 with both new keys present
  (no `inert-config-key`) and the new seam subcommands in its CONTRACTS table.
- A pure decision function returns return-to-base + pull + reap when
  `on_land_cleanup=true` and the integration branch is merged into base,
  returns leave-in-place when `off`, and never reaps an unmerged branch.
- Under `auto_close=true`, a surviving blocker/high `pre_ship` finding halts the
  chain before merge and surfaces the findings, regardless of configured gate
  mode; with no such finding the chain proceeds.
- A `/cad-milestone` run with `auto_close=true` runs audit -> tag -> PR -> merge
  -> reset with no per-step prompts, ending on a pulled base with the
  integration branch reaped (live-run behaviour).
- With `auto_close=false` (the default), `/cad-land` still asks the publish
  mechanism with no preselected default.
- `node --test` passes across `cadence-core/bin`, including the new cleanup and
  gate-halt tests.

## Context

Locked decisions from CONTEXT.md bind this plan: D-01/D-02 (two schema-only
bool keys + one live prose mention each), D-03 (cleanup is a NEW terminal step
in cad-land, only after a merge landed here), D-04 (base reuses cad-land's
resolution order; reap the version-derived `cadence/<version>` branch only after
`git branch --merged <base>` confirms it, local-only, no remote delete), D-06
(auto_close chains cad-milestone -> `/cad-land` via SlashCommand), D-07 (merge
via host-CLI PR/MR merge), D-08 (off-path keeps the no-default publish ask),
D-09 (blocker/high `pre_ship` is a hard halt regardless of gate mode), D-10
(pure `node --test`-covered decision function + a newly-named subcommand with a
self-verify CONTRACTS entry). Follow Phase 1's shape: pure lib in
`bin/lib/` + a thin advisory seam that emits one JSON line and never mutates git
(mirrors `git-branch.mjs decide`). The reap/checkout/pull mutations live in
cad-land prose, gated by the seam's advice. Merge-CLI contract (researched at
plan time): `gh pr merge` needs an explicit strategy flag and exits 1 on
failure / defers to auto-merge when required checks are unmet; `glab mr merge`
needs `-y` to skip its confirm prompt and exits non-zero on rejection. Out of
scope: release mechanics (Phase 3), any worktree plumbing change, repurposing
`git.base_branch`.

## Tasks

### Task 1: Add `git.on_land_cleanup` and `git.auto_close` config keys

- **Files:** cadence-core/config.schema.json, cadence-core/templates/config.json,
  cadence-core/workflows/config.md, cadence-core/bin/self-verify.test.mjs,
  cadence-core/bin/weight-budgets.json
- **Action:** In `config.schema.json` `keys`, add two entries in the `git.*`
  block copying the `git.create_tag` bool shape: `git.on_land_cleanup`
  (`type: "bool"`, `default: true`, purpose "After a successful land/merge,
  return to the base branch, pull, and reap the merged integration branch") and
  `git.auto_close` (`type: "bool"`, `default: false`, purpose "Opt-in
  end-to-end close: cad-milestone/cad-land run audit -> tag -> PR -> merge ->
  reset with no per-step prompts, halting on a blocking pre_ship FAIL"). Add
  both to the `git` block of `templates/config.json` (after `create_tag`).
  In `config.md`'s `**Git**` catalog section, add one row per key with a bool
  Type, the Purpose as question text, and `true`/`false` explanations and the
  default (`git.on_land_cleanup` default true, `git.auto_close` default false),
  keeping the dotted token `git.on_land_cleanup` / `git.auto_close` literally in
  the row so the reverse `inert-config-key` check sees a live mention. In
  `self-verify.test.mjs`, add both dotted keys to the `git.` line of the
  `placeholder keys expand` fixture (the hardcoded full-schema list, currently
  ``\`git.auto_branch\` \`git.base_branch\` \`git.create_tag\```) so its
  `assert r.ok === true` still holds. Do NOT touch `config.mjs` - these are
  plain schema-driven bools, no code change. If adding the catalog rows pushes
  `cadence-core/workflows/config.md` over its `weight-budgets.json` entry
  (self-verify reports `budget-overrun` with the exact bytes), raise that
  surface's budget to the reported actual bytes - accepted surface growth, per
  the manifest's own `_comment` (same as Phase 1).
- **Verify:** `node cadence-core/bin/config.mjs get git.on_land_cleanup git.auto_close`
  prints `true` and `false`; `node cadence-core/bin/config.mjs check git.on_land_cleanup=yes`
  returns `{ok:false,...}` (non-boolean rejected); `node cadence-core/bin/self-verify.mjs`
  exits 0 with no `inert-config-key` problem for either key;
  `node --test cadence-core/bin/self-verify.test.mjs` passes.

### Task 2: Pure decision core - `close-decision.mjs` + unit tests

- **Files:** cadence-core/bin/lib/close-decision.mjs, cadence-core/bin/close-decision.test.mjs
- **Action:** Create `bin/lib/close-decision.mjs` (zero-dep, node builtins only,
  no live git, no I/O), mirroring `branch-decision.mjs`'s totality discipline,
  exporting three total functions. `resolveReapBranch(derivedName,
  mergedBranches)` picks which branch cleanup should reap from a derived name
  plus the list of branches `git branch --merged <base>` reported (the seam
  supplies the live list; this function stays pure): return `derivedName` when it
  is a non-empty string present in `mergedBranches`; otherwise return the sole
  `cadence/*` entry of `mergedBranches` when exactly one exists (the CONTEXT
  robustness fallback for an already-evolved `### Active` or a null-derived name);
  else `null`. `decideCleanup({ onLandCleanup, mergedIntoBase,
  branch })` returns `{ action, returnToBase, pull, reap, branch, reason }`:
  when `onLandCleanup !== true` -> `{ action:'skip', returnToBase:false,
  pull:false, reap:false, branch: branch ?? null, reason }` (leave in place);
  when `onLandCleanup === true` -> `{ action:'cleanup', returnToBase:true,
  pull:true, reap: mergedIntoBase === true, branch: branch ?? null, reason }` so
  reap is false whenever the branch is not confirmed merged. `decideGateHalt({
  autoClose, findings })` returns `{ action, findings, reason }`: coerce a
  non-array `findings` to `[]`; let `blocking` = findings whose `severity` is
  `'blocker'` or `'high'`; when `autoClose === true` and `blocking.length > 0`
  -> `{ action:'halt', findings: blocking, reason }` (surface them, do not
  merge); otherwise `{ action:'proceed', findings: [], reason }`. Both functions
  must never throw on unknown/missing inputs. Create `bin/close-decision.test.mjs`
  (in `bin/`, matching `branch-decision.test.mjs`'s location and `node:test` +
  `node:assert/strict` style) covering: `resolveReapBranch` - derived name in the
  merged list -> that name; derived null + one merged `cadence/*` -> that branch;
  derived names an unmerged branch but one other `cadence/*` is merged -> the
  merged one; zero merged `cadence/*` -> null; two merged `cadence/*` -> null;
  cleanup on + merged -> reap true;
  cleanup on + not merged -> `action:'cleanup'`, reap false; cleanup off ->
  `action:'skip'`, all flags false; gate autoClose+blocker -> halt with that
  finding; gate autoClose+high -> halt; gate autoClose+only-medium/low ->
  proceed; gate autoClose false + blocker -> proceed (chain not running);
  gate non-array findings -> proceed without throwing.
- **Verify:** `node --test cadence-core/bin/close-decision.test.mjs` passes with
  0 failures.

### Task 3: `land-cleanup.mjs` advisory seam + CONTRACTS entry + seam test

- **Files:** cadence-core/bin/land-cleanup.mjs, cadence-core/bin/land-cleanup.test.mjs,
  cadence-core/bin/self-verify.mjs
- **Action:** Create `bin/land-cleanup.mjs` as the workflow-facing seam over
  `lib/close-decision.mjs`, following `git-branch.mjs`'s structure (import
  `emit` from `lib/seam-io.mjs`, `mergeLayers` from `lib/config-merge.mjs`,
  `integrationBranchName` from
  `lib/branch-decision.mjs`; one JSON line, exit via `emit`; never run
  `checkout`/`pull`/`branch -D` - it only advises). Two subcommands.
  `cleanup [--dir <path>] [--branch <name>] [--base <name>] [--merged <true|false>]`:
  read effective config via `mergeLayers(<dir>/.planning/config.json)`, take
  `onLandCleanup = git.on_land_cleanup !== false` (default true); resolve `base`
  from `--base`, else `git.base_branch`, else the first `git.protected_branches`
  entry (mirroring cad-land / git.md order); parse the merged-branch list once
  from `git -C <dir> branch --merged <base>` (degrade to `[]` if git cannot be
  read, matching `git-branch.mjs`'s degrade-to-empty pattern - never throw), then
  resolve the reap target with `resolveReapBranch(derived, mergedList)` where
  `derived` = `--branch` when given else `integrationBranchName(PROJECT.md,
  ROADMAP.md)` - so an already-evolved `### Active` (Task 5) or a null-derived
  name still reaps the `cadence/*` branch that actually merged; determine
  `mergedIntoBase` from `--merged` when given (test hook, like git-branch's
  `--branch`), else as "the resolved branch is non-null and present in
  `mergedList`"; pass the resolved branch into `decideCleanup` (it echoes it back
  as `decision.branch`) and `emit({ ok:true, ...decision, base })`.
  `gate [--dir <path>]`: read `autoClose = git.auto_close === true`, read
  `{ findings }` JSON from stdin (empty stdin -> `findings:[]`), call
  `decideGateHalt`, `emit({ ok:true, ...decision })`. Unknown subcommand ->
  `emit({ ok:false, reason:'usage', ... })`. In `self-verify.mjs`, add to
  `CONTRACTS` the entry `'land-cleanup.mjs': { '*': ['--dir'], cleanup:
  ['--branch', '--base', '--merged'], gate: [] }` so prose invocations of the
  seam pass the invocation check. Create `bin/land-cleanup.test.mjs`
  (`node:test`, executing the seam via `execFileSync('node', ...)` and parsing
  the JSON line, like `git-branch.test.mjs`) covering: `cleanup --merged true`
  on a fixture config with `on_land_cleanup` default -> `reap:true`,
  `returnToBase:true`; `cleanup --merged false` -> `reap:false`,
  `action:'cleanup'`; a fixture config with `git.on_land_cleanup=false` ->
  `action:'skip'`; `gate` with stdin `{"findings":[{"severity":"blocker"}]}`
  and `git.auto_close=true` -> `action:'halt'`; `gate` with only a `medium`
  finding -> `action:'proceed'`.
- **Verify:** `node --test cadence-core/bin/land-cleanup.test.mjs` passes;
  `echo '{"findings":[{"severity":"high"}]}' | node cadence-core/bin/land-cleanup.mjs gate --dir <a fixture whose config sets git.auto_close=true>`
  prints `"action":"halt"`; `node cadence-core/bin/self-verify.mjs` exits 0.

### Task 4: cad-land - terminal cleanup step + auto_close publish path

- **Files:** skills/cad-land/SKILL.md, cadence-core/bin/weight-budgets.json
- **Action:** Extend cad-land's `<process>` without weakening its no-default
  posture. (a) In step 3 (`pre_ship`), add that under `git.auto_close` a
  surviving blocker/high finding is a hard halt before any merge regardless of
  the configured gate mode - run `node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/land-cleanup.mjs" gate`
  with the adjudicated `pre_ship` survivors as `{findings}` on stdin, and on
  `action:"halt"` stop and surface the findings (D-09). (b) Make step 4 branch
  on `git.auto_close`: when `false` (default) keep the existing ask-user seam
  with NO preselected default, unchanged (D-08); when `true`, skip that ask
  entirely and land the integration branch on base as the criterion's two-step
  `PR -> merge`. **PR (open + push):** the integration branch is local-only
  (rail 3 never auto-pushes), so `gh pr merge` / `glab mr merge` would fail with
  "no PR found" - first open it, which pushes it: reuse an existing open PR/MR
  when `gh pr view <branch>` / `glab mr view <branch>` finds one, else create it -
  GitHub `gh pr create --base <base> --head <branch> --fill`, GitLab
  `glab mr create --source-branch <branch> --target-branch <base> --fill`. `gh`
  and `glab` are not `git push`, so `git-guard.mjs` (which intercepts only
  `git push`) never prompts and the unattended chain holds (D-07). **merge:**
  then land it - GitHub `gh pr merge <branch> --merge --delete-branch`
  (an explicit merge strategy is required or gh errors/prompts; `--delete-branch`
  removes the remote+local source); GitLab: `glab mr merge <branch> --yes
  --remove-source-branch` (`--yes` skips the confirm prompt; add
  `--auto-merge=false` to merge immediately rather than defer when a pipeline is
  running). After the merge command, confirm the merge actually landed before
  cleanup - `gh pr view <branch> --json state,mergedAt` shows MERGED, or
  `glab mr view <branch>` shows merged; a non-zero exit (protected-branch /
  not-mergeable) or a still-open PR/MR (auto-merge only enabled, CI pending)
  means the merge did NOT land: stop, surface the reason, do NOT reap. (c) Add
  a new terminal step (after publish) - the return-to-base + pull + reap cleanup
  (GIT-02, D-03) - run only when a merge actually landed on this machine (skip
  after open-PR / leave-local). Because the auto_close merge lands on the
  platform (D-07), the LOCAL base is stale until pulled, so `git checkout <base>`
  then `git pull` FIRST, then run
  `node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/land-cleanup.mjs" cleanup` so the
  reap decision is computed against the now-current base. In the auto_close path
  pass `--merged true` (step (b) already confirmed the PR/MR MERGED) so the reap
  decision never hinges on local-base freshness; the manual land path omits it
  and the seam falls back to `git branch --merged <base>`. When the seam returns
  `reap:true`, `git branch -D <decision.branch>` locally only (no
  remote-tracking delete - D-04 - avoiding the push guard; idempotent - a no-op
  if `--delete-branch`/`--remove-source-branch` already removed it). Reference
  the `git.on_land_cleanup` and `git.auto_close` tokens in the prose. If
  cad-land SKILL.md now overruns its `weight-budgets.json` entry, raise it to
  the reported bytes (accepted growth).
- **Verify:** `node cadence-core/bin/self-verify.mjs` exits 0 (prose references
  `land-cleanup.mjs cleanup`/`gate` and both config tokens, all in-contract, no
  `inert-config-key`, no `budget-overrun`). human-verify: on a repo with a
  remote and gh/glab, a `/cad-land` with `git.auto_close=false` presents the
  publish options with no option preselected; with `git.auto_close=true` it
  merges the integration branch and ends on the pulled base with the branch
  reaped, and a seeded blocker `pre_ship` finding halts it before merge.

### Task 5: cad-milestone - chain into `/cad-land` under auto_close

- **Files:** cadence-core/workflows/milestone.md, skills/cad-milestone/SKILL.md,
  cadence-core/bin/weight-budgets.json
- **Action:** In `milestone.md`, add an auto_close branch to the close flow
  (D-06, GIT-03): after step 2 (tag) and the prune/evolve/refresh steps, when
  `git.auto_close` is `true`, chain the publish end-to-end by invoking
  `/cad-land` via the SlashCommand tool (cad-milestone already declares it) so
  PR -> merge -> reset runs with no per-step prompts, and note that the
  `pre_ship` gate-halt inside cad-land still applies (a blocking finding stops
  the chain before merge). Because this chain runs AFTER step 4 has evolved
  PROJECT.md `### Active` to the next version, cad-land can no longer re-derive
  the just-shipped branch name by version - it reaps via Task 3's
  `resolveReapBranch` `cadence/*`-merged fallback, so the shipped
  `cadence/<this-version>` branch is still reaped correctly (call this out in the
  prose so the ordering reads as intentional, not a latent bug). When
  `git.auto_close` is `false` (default), the flow
  is unchanged: tag stays unpushed and publishing is the user's separate
  `/cad-land` call (step 7). Reference the `git.auto_close` token. In
  `cad-milestone/SKILL.md`'s `<process>`, add one line that under `git.auto_close`
  the milestone chains into `/cad-land` to complete the close, otherwise it
  stops at the tag as today. If either weighed surface overruns its
  `weight-budgets.json` entry, raise it to the reported bytes.
- **Verify:** `node cadence-core/bin/self-verify.mjs` exits 0 (the `git.auto_close`
  token is a live mention, no `budget-overrun`). human-verify: `/cad-milestone`
  with `git.auto_close=true` on a repo with a remote runs audit -> tag -> PR ->
  merge -> reset without asking the publish mechanism; with `git.auto_close=false`
  it stops after the tag and leaves publishing to a separate `/cad-land`.

### Task 6: git.md - wire cleanup + auto_close into the rails

- **Files:** cadence-core/references/git.md
- **Action:** Update rail 3 (`## 3. Never auto-push`) so the invariant stays
  true while naming the two sanctioned additions. State that `git.auto_close`
  (default off) is the single opt-in that lets `/cad-land` complete the close
  unattended, and that it lands the integration branch on base via a host-CLI
  PR/MR **merge** on the platform (`gh pr merge` / `glab mr merge`) - which is a
  platform merge, not a `git push`, so the never-auto-push rule and the
  no-preselected-default publish posture (off by default) both hold. Add that
  after a land/merge lands on this machine, `git.on_land_cleanup` (default on)
  returns HEAD to the base, pulls, and reaps the merged integration branch
  locally (advised by `land-cleanup.mjs cleanup`, reaping only when
  `git branch --merged <base>` confirms it - never a remote-tracking delete).
  Keep both `git.on_land_cleanup` and `git.auto_close` tokens literally in the
  prose. git.md is not a weighed surface, so no budget entry applies.
- **Verify:** `node cadence-core/bin/self-verify.mjs` exits 0 (git.md's
  `land-cleanup.mjs cleanup` reference is in-contract and both tokens resolve);
  `node --test cadence-core/bin/*.test.mjs` passes across the whole bin suite.

## Notes

The `auto_close` merge and the reset/reap require a live remote plus `gh`/`glab`
and cannot be proven by a command in the executor's sandbox, so those criteria
are human-verify (they carry the CONTEXT `human-verify` tag). All pure-logic and
seam behaviour is covered by `node --test` and `self-verify`.

Robustness note carried from Phase 1 (SUMMARY open item + recalled memory): reap
re-derives the integration name the same way branch creation does, so a
version-less project derives `null` and has nothing to reap by name. The plan
review surfaced that the autonomous-close chain hits this same class of failure
from a second direction - cad-milestone evolves PROJECT.md `### Active` to the
next version before cad-land reaps, so a pure re-derivation would target the
wrong (or a null) name. Both are closed in-phase by `resolveReapBranch`
(Task 2): when the derived name is null or is not among the branches merged into
base, cleanup reaps the sole `cadence/*` branch that actually merged, and reaps
nothing when zero or several match. The `--merged`/`--branch` test hooks keep
this pure logic falsifiable under `node --test` without a live remote.
