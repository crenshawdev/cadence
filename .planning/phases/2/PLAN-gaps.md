---
phase: 2
plan: 2
requirements: [GIT-03]
files:
  - cadence-core/bin/lib/publish-decision.mjs
  - cadence-core/bin/publish-decision.test.mjs
  - cadence-core/bin/git-publish.mjs
  - cadence-core/bin/git-publish.test.mjs
  - cadence-core/bin/self-verify.mjs
  - cadence-core/bin/git-guard.mjs
  - cadence-core/bin/git-guard.test.mjs
  - skills/cad-land/SKILL.md
  - cadence-core/references/git.md
  - cadence-core/bin/weight-budgets.json
---

# Phase 2: Land cleanup + autonomous close - Gap-closure Plan

## Goal

Close the GitHub arm of GIT-03: under `git.auto_close`, `/cad-land` publishes
the local-only integration branch fully unattended through a dedicated
git-publish seam (a subprocess `git push` git-guard's Bash hook never sees),
then opens and merges the PR - while git-guard itself carries NO push exemption
and every Bash `git push` it sees still asks unconditionally.

## Must be true when done

- `node cadence-core/bin/git-publish.mjs publish --dir <repo>` publishes the
  current non-protected branch to `origin` (as a subprocess argv `git push`)
  ONLY when repo `git.auto_close === true` and HEAD is a non-protected branch on
  a configured remote; the pushed ref is exactly `refs/heads/<branch>` on that
  remote and nothing else moves.
- The seam refuses (emits `ok:false` with a specific reason, pushes nothing) on
  every unsafe input: auto_close off, detached/empty HEAD, a protected branch, a
  malformed branch or remote, a remote not in `git remote`, or auto_close set
  only in the global config layer (D-08 preserved).
- git-guard no longer contains `isPlainPush` or any command-string push parsing;
  `grep -c isPlainPush cadence-core/bin/git-guard.mjs` is 0, and EVERY `git push`
  the Bash hook sees - including one under repo `git.auto_close: true` - returns
  `permissionDecision: 'ask'`.
- cad-land's GitHub step 4b invokes the git-publish seam before `gh pr create`
  (on its own physical line, only `--dir`/`--remote` adjacent to it), and no
  prose on any of the three surfaces claims `gh pr create` "pushes it" or that
  the auto_close path involves no `git push`.
- self-verify's CONTRACTS knows `git-publish.mjs publish` with `--dir`/`--remote`;
  `node cadence-core/bin/self-verify.mjs` emits `ok:true` with `problems:[]`,
  including the weight-budget check after the cad-land SKILL.md rewrite.
- The full gate is green on the post-change tree: `node --test
  'cadence-core/bin/*.test.mjs'` reports 0 failures, self-verify is `ok:true`,
  and `tsc --checkJs` is clean.

## Context

Locked decisions bind this plan: D-07 (auto_close lands via a host-CLI PR/MR
merge, not a raw push to base), D-08 (auto_close never weakens the off-path
posture - a normal push still asks, no preselected default), D-09 (a blocking
`pre_ship` finding halts before merge), D-10 (safety lives in a pure, total
decision fn covered by `node --test`, separated from I/O). The authoritative
seam design is design-notes/push-seam-2026-07-17.md; this plan realizes its
seven tasks in order. Prior art (CAPTURE.md, phase 2): the naive "git push
before gh pr create" fix trips git-guard's ask-on-every-push - the subprocess
seam the Bash hook never sees is what makes the unattended publish work.

Hard constraints (must-honor, do not drift):
- Do NOT reintroduce `isPlainPush`, `PUSH_SAFE_LONG`/`PUSH_SAFE_SHORT`,
  `SAFE_TOKEN`, a `repoAutoClose` inside git-guard.mjs, or ANY command-string
  parsing of a push anywhere. The git-guard push rail ends as an unconditional
  `ask` with no exemption of any kind (this replaces the REJECTED char-class
  isPlainPush approach that the superseded PLAN-gaps.md described).
- Publish ONLY through the git-publish seam via `execFileSync` argv (no shell,
  no user-supplied refspec, no `--branch` flag, no env-prefix). The pushed
  refspec is the fully-qualified `refs/heads/<branch>:refs/heads/<branch>` built
  inside the pure `decidePublish` and returned as byte-exact argv.
- Read `git.auto_close` from the REPO layer ONLY (a dedicated `repoAutoClose(dir)`
  over `<dir>/.planning/config.json`), never the merged/global value - preserve
  D-08. Read `protected_branches` from the merged config (default
  `['main','master']`).
- Add NO config key - reuse existing `git.auto_close` and `git.protected_branches`.
- Do NOT touch the shipped close-decision.mjs / land-cleanup.mjs cleanup logic
  (the 6d415fd item-8 null-branch reap fix). The seam push sits strictly BEFORE
  `gh pr create`/`gh pr merge --delete-branch`, keeping the post-merge
  reap-resolves-null ordering intact.
- No em-dashes in any new/edited prose - use spaced hyphens ' - '.
- e194bb4 was committed UNVERIFIED; treat the post-change tree as source of
  truth and end on a full green gate (Task 7).

## Tasks

### Task 1: Add the decidePublish pure decision fn + unit tests

- **Files:** cadence-core/bin/lib/publish-decision.mjs, cadence-core/bin/publish-decision.test.mjs
- **Action:** Create `lib/publish-decision.mjs` (`// @ts-check`, zero I/O, zero
  live git) exporting a PURE, TOTAL `decidePublish({ autoClose, currentBranch,
  protectedBranches, remote, configuredRemotes })` returning `{ action:
  'publish'|'refuse', argv:string[], branch:string|null, remote:string|null,
  reason:string }`, mirroring the discipline of lib/close-decision.mjs and
  lib/branch-decision.mjs (unknown/missing inputs never throw). Module-local
  constants: `SAFE_BRANCH = /^[A-Za-z0-9][A-Za-z0-9._\/-]*$/` (forbids leading
  '-', ':', whitespace, and shell metachars, so a branch can never be an option
  or a `src:dst` refspec) and `REMOTE_NAME = /^[A-Za-z0-9._-]+$/` (rejects '/',
  ':', '@', so no path or URL can stand in as the remote). Coerce a non-array
  `protectedBranches`/`configuredRemotes` to `[]` and a non-string
  `currentBranch`/`remote` to a refuse; NEVER throw. Gates, FIRST FAILING WINS,
  every refuse total (`argv:[]`): (1) `autoClose !== true` -> refuse reason
  `'auto-close-off'`; (2) `!currentBranch || currentBranch === 'HEAD'` -> refuse
  `'no-branch'`; (3) `!SAFE_BRANCH.test(currentBranch)` -> refuse `'bad-branch'`;
  (4) `protectedBranches.includes(currentBranch)` -> refuse `'protected-branch'`;
  (5) `!REMOTE_NAME.test(remote)` -> refuse `'bad-remote'`; (6)
  `!configuredRemotes.includes(remote)` -> refuse `'remote-not-configured'`;
  (7) else publish with `argv = ['push', '--set-upstream', remote,
  `refs/heads/${currentBranch}:refs/heads/${currentBranch}`]`, `branch =
  currentBranch`, `remote = remote`, reason `'sanctioned unattended
  integration-branch publish'`. The fn returns the fully-built argv MINUS the
  runtime `-C <dir>` prefix (the seam prepends it) so a unit test can assert the
  vector byte-exact. Add the bin-level test file `publish-decision.test.mjs`
  (placed under `bin/` so the `cadence-core/bin/*.test.mjs` glob runs it),
  importing `./lib/publish-decision.mjs` exactly as close-decision.test.mjs
  imports `./lib/close-decision.mjs`, covering: the byte-exact publish argv with
  the branch string appearing ONLY inside the one `refs/heads` refspec token;
  each refuse gate reached in order; a leading-dash branch `'-rf'` ->
  `'bad-branch'`; a metachar/colon branch -> `'bad-branch'`; a remote not in
  `configuredRemotes` -> `'remote-not-configured'`; a path/URL remote (`'/tmp/e'`
  or `'git@h:x'`) -> `'bad-remote'`; a valid non-`origin` remote that IS
  configured -> `publish`; and totality on non-array/missing fields (no throw,
  a refuse). Do NOT interpolate the branch anywhere other than the single
  refspec token.
- **Verify:** `node --test cadence-core/bin/publish-decision.test.mjs` reports 0
  failures, including an `assert.deepEqual` on the publish argv equal to
  `['push','--set-upstream','origin','refs/heads/cadence/v1.1.0-rc.2:refs/heads/cadence/v1.1.0-rc.2']`.

### Task 2: Add the git-publish I/O seam + seam tests

- **Files:** cadence-core/bin/git-publish.mjs, cadence-core/bin/git-publish.test.mjs
- **Action:** Create `git-publish.mjs` (`// @ts-check`, `'use strict'`) on the
  git-branch.mjs skeleton: import `mergeLayers` from `./lib/config-merge.mjs`,
  `emit` from `./lib/seam-io.mjs`, `decidePublish` from
  `./lib/publish-decision.mjs`, `execFileSync` from `node:child_process`,
  `readFileSync` from `node:fs`, `join` from `node:path`; an argv `flag(name)`
  helper copied verbatim from git-branch.mjs (`argv.indexOf(name)` ->
  `argv[i+1]`); a `try/catch` dispatcher emitting `{ ok:false, reason:'usage',
  detail:'subcommand: publish [--dir <path>] [--remote <name>]' }` for an unknown
  subcommand and `{ ok:false, reason:'internal', detail }` on throw. Header
  comment must state WHY this is a new file, not a land-cleanup.mjs subcommand:
  land-cleanup and close-decision are advisory (never run live git); git-publish
  is the ONE seam that actually mutates (runs `git push`), so folding a live push
  into an advisory file would destroy the advisory/acting boundary - it gets its
  own file, CONTRACTS row, test file, and git-* name. Subcommand `publish [--dir
  <path>] [--remote <name>]`: resolve `dir = flag('--dir') || process.cwd()` and
  `remote = flag('--remote') || 'origin'`; read `currentBranch` via
  `execFileSync('git', ['-C', dir, 'rev-parse', '--abbrev-ref', 'HEAD'],
  {encoding:'utf8', stdio:['ignore','pipe','ignore']}).trim()` degrading to `''`
  on throw; read `configuredRemotes` via `execFileSync('git', ['-C', dir,
  'remote'], {...}).split('\n').map(s=>s.trim()).filter(Boolean)` degrading to
  `[]` on throw; read `autoClose` via a REPO-LAYER-ONLY `repoAutoClose(dir)` -
  `JSON.parse(readFileSync(join(dir,'.planning','config.json'),'utf8'))?.git?.auto_close
  === true` inside try/catch, `false` on missing/bad/global-only (preserves D-08:
  a user-global auto_close must never enable an unattended publish in an
  unrelated project); read `protectedBranches` via
  `mergeLayers(join(dir,'.planning','config.json')).config.git.protected_branches`
  defaulting to `['main','master']`. Then `const decision = decidePublish({
  autoClose, currentBranch, protectedBranches, remote, configuredRemotes })`. On
  `decision.action !== 'publish'` emit `{ ok:false, reason:decision.reason,
  branch:decision.branch, remote:decision.remote }` and return. Otherwise run
  `execFileSync('git', ['-C', dir, ...decision.argv], {encoding:'utf8',
  stdio:['ignore','pipe','pipe']})` inside try/catch, emitting `{ ok:true,
  action:'published', branch:decision.branch, remote:decision.remote }` on
  success or `{ ok:false, reason:'push-failed', detail:e && e.message ?
  e.message : String(e) }` on throw. NEVER build a command string; the program is
  the literal `'git'` and args is a JS array (execve, never `/bin/sh`); never
  emit a `-c`/`--config`/global option; the only variable tokens are `dir` (right
  after `-C`, a path), the validated `remote`, and the `branch` (only inside the
  refspec). Add `git-publish.test.mjs` with a local bare-origin fixture (hermetic
  `GIT_CONFIG_GLOBAL=/dev/null`/`GIT_CONFIG_SYSTEM=/dev/null` like
  git-guard.test.mjs): init a work repo, commit, `git init --bare <bare>`,
  `git remote add origin <bare>`, checkout an integration branch (e.g.
  `cadence/v1.1.0-rc.2`), write `.planning/config.json` `{git:{auto_close:true}}`.
  Assert `publish --dir <dir>` emits `ok:true action:'published'` AND `git -C
  <bare> rev-parse --verify refs/heads/cadence/v1.1.0-rc.2` succeeds; plus refuse
  fixtures each asserting `ok:false` with the right reason AND that the bare
  origin gained NO branch: auto_close false -> `'auto-close-off'`; HEAD on `main`
  (protected) -> `'protected-branch'`; no `origin` remote configured ->
  `'remote-not-configured'`; detached HEAD -> `'no-branch'`; auto_close present
  only via `CADENCE_GLOBAL_CONFIG` (repo config omits it) -> `'auto-close-off'`;
  and an unknown subcommand -> `reason:'usage'`.
- **Verify:** `node --test cadence-core/bin/git-publish.test.mjs` reports 0
  failures; the auto_close-true fixture leaves `refs/heads/cadence/v1.1.0-rc.2`
  present in the bare origin (`git -C <bare> rev-parse --verify` exit 0) and every
  refuse fixture leaves it absent.

### Task 3: Register git-publish in self-verify CONTRACTS

- **Files:** cadence-core/bin/self-verify.mjs
- **Action:** Add the entry `'git-publish.mjs': { '*': ['--dir'], publish:
  ['--remote'] }` to the `CONTRACTS` object (self-verify.mjs, currently the
  object spanning lines 35-82), placed beside the other git-* seams (after the
  `'git-branch.mjs'` block at lines 62-65, or near `'land-cleanup.mjs'` at
  66-70). This turns on flag-validation for the prose invocation (subcommand
  `publish` known, `--dir` under `'*'`, `--remote` allowed). No other change - a
  script absent from CONTRACTS is silently skipped (`if (!contract) continue`, line
  179), so the entry is required by D-10, not by green-ness; self-verify.test.mjs
  does not assert CONTRACTS contents, so it is unaffected.
- **Verify:** `node cadence-core/bin/self-verify.mjs` still emits
  `{"ok":true,...,"problems":[]}` and `node --test
  cadence-core/bin/self-verify.test.mjs` reports 0 failures.

### Task 4: Delete git-guard isPlainPush exemption; restore the unconditional push-ask

- **Files:** cadence-core/bin/git-guard.mjs, cadence-core/bin/git-guard.test.mjs
- **Action:** In git-guard.mjs: DELETE the header rail exemption prose (the "ONE
  exemption ... still asks." block, which begins mid-line 14 and runs through
  line 25 - NOTE: the design cited 15-25; the "ONE exemption" clause actually
  starts at the end of line 14, so delete from there) and restore the plain rail
  comment so `git push -> permissionDecision 'ask' - publishing is /cad-land's
  call (references/git.md rail 3); the user decides at the prompt`, optionally
  adding one truthful sentence that a subprocess push from the git-publish seam
  is not a Bash tool call, so this hook never sees it - no exemption lives here.
  DELETE constants `PUSH_SAFE_LONG` (104-105), `PUSH_SAFE_SHORT` (107-109),
  `SAFE_TOKEN` (165), `REMOTE_NAME` (169) and the entire `isPlainPush`
  rationale-comment + function block as one contiguous region (comment starts
  line 97, function 170-240). DELETE the `repoAutoClose` comment + function
  (250-258). Inside `main()`'s `isPush` branch (283-298): DELETE the "Exempt ONLY
  a plain publish push..." comment, `const branch = currentBranch(cwd);`, and the
  `if (repoAutoClose(root) && ... && isPlainPush(...)) return;` block; and trim
  the ask reason's trailing "(A plain publish ... is exempt.)" parenthetical
  (297). REPLACE the push handling with an unconditional ask, MOVED ABOVE the
  `mergeLayers` read (a push needs no config): right after `if (!isPush &&
  !isCommit) return;` (line 276) insert `if (isPush) { decide('ask', 'Cadence
  rail: workflows never push - publishing is /cad-land\'s call (references/git.md
  rail 3). Approve only if you are deliberately publishing.'); return; }`; the
  `mergeLayers`/`protectedBranches` read (278-281) then serves the commit rail
  only. PRESERVE UNCHANGED: `currentBranch()` (242-248, still called by the
  commit rail at line 305), `gitSubcommands()`/`GIT_OPT_WITH_ARG` (67-95),
  `planningRoot()` (56-65), the whole commit rail (302-314), and ALL imports
  (`execFileSync` via currentBranch, `readFileSync` via stdin read, `mergeLayers`
  via commit rail, `join`/`dirname`/`existsSync` via planningRoot) - no orphaned
  symbol or import. Do NOT reintroduce isPlainPush or any command-string parsing
  anywhere. In git-guard.test.mjs: DELETE the entire exemption suite lines
  69-206 (the standalone auto_close cases 69-72/74-77/79-83/85-89/91-95, the four
  `for` tables 101-115/122-134/141-155/165-180, the two "stays exempt (silent)"
  tests 182-186/188-192, and the global-layer read test 194-206) - all assert
  exemption behavior that no longer exists. KEEP intact: lines 62-67 (`git push
  always asks (publishing is /cad-land's call)` - this IS the restored invariant),
  53-60 (silent outside project / non-git), and every commit/protected/walk-up/
  subcommand/stash/quoted/compound/malformed-stdin test (208-292). ADD one
  regression guard, the direct inversion of the deleted 69-72 case: a test named
  `'auto_close true does not exempt any push - every push still asks'` that builds
  `project('cadence/v1.1.0-rc.2', { git: { auto_close: true } })`, runs
  `guard('git push -u origin cadence/v1.1.0-rc.2', dir)`, and asserts
  `d.permissionDecision === 'ask'` - locking in "every push asks" so any future
  re-introduction of an exemption fails the suite.
- **Verify:** `grep -c isPlainPush cadence-core/bin/git-guard.mjs` prints `0`;
  `node --test cadence-core/bin/git-guard.test.mjs` reports 0 failures and the
  new 'every push still asks' test passes.

### Task 5: Correct cad-land + git.md prose to the seam truth and invocation

- **Files:** skills/cad-land/SKILL.md, cadence-core/references/git.md
- **Action:** In skills/cad-land/SKILL.md step 4b "Open (or reuse) the PR/MR"
  (lines 71-76): DELETE the false "so a merge would fail with 'no PR found' -
  open it first, which pushes it" framing (68-70) and the "`gh`/`glab` are not
  `git push`, so the git-guard push hook never prompts and the chain holds."
  sentence (75-76). REPLACE with: the branch is local-only (rail 3 never
  auto-pushes); on GitHub `gh pr create --head <branch>` will NOT push a
  remoteless branch non-interactively, so publish first via the seam on its OWN
  physical line - `node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/git-publish.mjs"
  publish --dir <root>` - with NOTHING but `--dir`/`--remote` sharing that
  physical line (end the line with a backtick/newline BEFORE writing any `gh pr
  create --base ...` or `git push --set-upstream ...`, mirroring the existing line
  95/96 pattern that breaks `--merged` onto the next line); then state on the NEXT
  line that the seam does one sanctioned `git push` of the current non-protected
  branch as a subprocess (execFileSync argv) that git-guard's Bash hook never
  sees, refuses with `ok:false` unless repo `git.auto_close` is true and HEAD is a
  non-protected branch, and on `ok:true` proceed to `gh pr create --base <base>
  --head <branch> --fill` while on `ok:false` stop and surface the reason (do NOT
  fall back to a raw `git push`, which would hit the guard's unconditional ask).
  GitLab unchanged: `glab mr create --source-branch <branch> --target-branch
  <base> --fill` publishes the source branch itself, so no seam call there. Keep
  the reuse-when-open behavior and the merge/cleanup bullets. In the `<guardrails>`
  block (108-114): REPLACE the "PR -> merge -> reset unattended" framing (which
  implies no push) with: `git.auto_close` (default off) is the explicit opt-in
  that runs the close unattended; on the GitHub arm it makes ONE sanctioned
  publish of the local-only integration branch through the git-publish seam (a
  subprocess push git-guard does not intercept, code-guarded to the current
  non-protected branch under repo `git.auto_close`) BEFORE opening the PR, then
  PR -> merge -> reset; every Bash `git push` still asks unconditionally, the seam
  is the only code-guarded unattended publish; it skips the 4a ask rather than
  preselecting a default and still halts on a blocking `pre_ship` finding. In
  cadence-core/references/git.md rail 3 (lines 89-96): REPLACE "That is a platform
  merge, not a `git push`, so the never-auto-push rule holds." with prose stating
  the platform PR/MR merge is not a push, and on the GitHub arm the local-only
  integration branch is first published by the git-publish seam (one sanctioned
  push of the current non-protected branch, run as a subprocess so the Bash `git
  push` guard never sees it and there is no prompt), the seam refusing unless repo
  `git.auto_close` is true and HEAD is non-protected and pushing exactly that
  branch to a configured bare-name remote; every Bash `git push` the guard sees
  still asks unconditionally (git-guard now carries NO push exemption), the seam
  is the one code-guarded exception invoked only by cad-land, so the
  never-auto-push rule and the no-preselected-default posture both still hold; on
  GitLab `glab mr create` publishes the source branch itself; a blocking
  `pre_ship` finding still halts the chain before merge. Keep rails 1, 2, 4
  untouched. MANDATORY authoring rules (or self-verify exits 1): in git.md NEVER
  write `git-publish.mjs` immediately followed by a lowercase word (say "the
  git-publish seam" everywhere except the one real SKILL.md invocation, which is
  followed by `publish`); use spaced hyphens ' - ', no em-dashes.
- **Verify:** `node cadence-core/bin/self-verify.mjs` emits
  `{"ok":true,...,"problems":[]}` (no unknown-subcommand/unknown-flag from the new
  prose); `grep -nE 'git-publish\.mjs [a-z]' cadence-core/references/git.md`
  returns no line where `.mjs` is followed by a lowercase word other than the word
  `publish`; `grep -n "—" skills/cad-land/SKILL.md cadence-core/references/git.md`
  returns nothing new (no em-dashes).

### Task 6: Rebudget cad-land after the step-4b rewrite

- **Files:** cadence-core/bin/weight-budgets.json
- **Action:** Re-measure `skills/cad-land/SKILL.md` with `node
  cadence-core/bin/weight.mjs` (its bytes for that surface) and set the
  `"skills/cad-land/SKILL.md"` entry in weight-budgets.json (currently exactly
  6384, zero headroom - verified this session) to the exact new byte count. This
  bump is DEFINITE, not conditional: the step-4b + guardrails rewrite is
  net-additive, so leaving 6384 makes self-verify's check 4 emit a budget-overrun.
  Change NO other entry - the new bin files (git-publish.mjs, publish-decision.mjs,
  both .test.mjs) are under `bin/` and unweighed, and references/git.md is
  unweighed, so cad-land's SKILL.md is the only weighed surface touched.
- **Verify:** `node cadence-core/bin/self-verify.mjs` emits `ok:true` with no
  `budget-overrun`, and the `"skills/cad-land/SKILL.md"` value in
  weight-budgets.json exactly equals the bytes reported by `node
  cadence-core/bin/weight.mjs` for that surface.

### Task 7: Full green gate (e194bb4 was committed unverified)

- **Files:** cadence-core/bin
- **Action:** Run the whole gate on the post-change tree and fix-forward any red
  before closing: `node --test 'cadence-core/bin/*.test.mjs'`, `node
  cadence-core/bin/self-verify.mjs`, and the phase's `tsc --checkJs` typecheck
  (confirm the project's exact typecheck command from the phase SUMMARY / repo
  scripts and that the two new `@ts-check` files - publish-decision.mjs and
  git-publish.mjs - pass it). No new commit unless a fix is needed (then an atomic
  fix commit). Because the baseline is currently green (self-verify ok, tests
  pass), any post-change red is attributable to this work - do not close on red.
- **Verify:** `node --test 'cadence-core/bin/*.test.mjs'` reports 0 failures
  (baseline minus the deleted git-guard exemption cases plus the new
  publish-decision + git-publish + restoration tests), `node
  cadence-core/bin/self-verify.mjs` emits `{"ok":true,...,"problems":[]}`, and the
  project's `tsc --checkJs` typecheck is clean.

## Notes

- Line-region citations were re-verified against the current files. All of the
  design's git-guard.mjs and git-guard.test.mjs regions match EXCEPT one nuance
  carried into Task 4: the header "ONE exemption" clause the design cites at lines
  15-25 actually begins at the end of line 14 ("... still works in one step. ONE
  exemption: when the REPO config ..."), so the deletion starts mid-line-14.
- The two live end-to-end paths (a real GitHub remote + `gh` running the
  unattended PR-open/merge) remain human-verify, as flagged in the phase SUMMARY
  goal check and consistent with UAT items 5/6 being blocked human-verify and out
  of scope. This plan is verified at the seam-behavior, guard-behavior, and
  prose-truth layers, which is where the gap (UAT item 9) actually lives.
- Accepted residual risks (from the authoritative design, not re-opened here):
  an env-prefix RCE from Bash (`GIT_SSH_COMMAND=x node .../git-publish.mjs
  publish`) is outside git-guard's threat model and cannot retarget the validated
  branch/destination; a hostile `remote.origin.url` in `.git/config` is game-over
  independent of the seam; a repo with no `origin` gets a clean `ok:false
  'remote-not-configured'` and cad-land halts (intended, `gh pr create` would fail
  anyway). The verify gates on 0 failures and self-verify `ok`, not on a fixed
  test count, to avoid brittleness.
