---
phase: 1
plan: 2
requirements:
  - CFG-02
files:
  - cadence-core/bin/config-seams.test.mjs
---

# Phase 1: The read face under everything - Plan 2

## Goal

Every seam that imports `mergeLayers` demonstrably reads what
`node cadence-core/bin/config.mjs get` reports for a key that seam actually
reads, and the two seams that deliberately read narrower than the merged config
have that narrowing pinned as expected rather than papered over as equality.

## Must be true when done

- For each of the seven consuming seams - `git-guard`, `git-branch`,
  `land-cleanup`, `git-publish`, `route`, `planning`, `review-provider` - a test
  drives the seam over a two-layer fixture and asserts the value it observably
  acted on equals `config.mjs get <key>` read over the SAME two layers.
- The key each arm uses is one that seam actually reads, not a shared key six of
  the seven ignore.
- `git-publish`'s repo-layer-only `git.auto_close` and `route.mjs`'s
  repo-layer-only `risk.override.*` are encoded as EXPECTED divergences from
  `get` - a global-layer value that `get` reports and the seam deliberately does
  not honour - so a future widening of either narrowing fails a test instead of
  passing silently.
- Every seam invocation and every `config.mjs get` in the file runs as a
  subprocess with `CADENCE_GLOBAL_CONFIG` pointed at a fixture path, so no test
  can read the developer's real `~/.claude/cadence/config.json`.
- `node --test cadence-core/bin/config-seams.test.mjs` passes and the full suite
  `node --test cadence-core/bin/*.test.mjs` still exits 0.

## Context

D-09 fixes this criterion's shape: no single config key is read by all seven
seams, so AC7 means "for each seam, one key that seam actually reads, asserted
equal to `config.mjs get` of that key", and the test must also encode two
deliberate narrowings as expected - `git-publish.mjs:55-72` reads
`git.auto_close` from the repo layer alone, and `route.mjs:124` reads
`risk.override.*` from the repo layer alone. D-07 fixes the mechanism:
`GLOBAL_CONFIG` is a module-load `const` off `process.env`, so every arm runs the
seam as a SUBPROCESS with `CADENCE_GLOBAL_CONFIG` set. D-08 fixes the awkward
one: `review-provider.mjs` reads a CWD-relative `.planning/config.json` and
caches per process, so it is driven as a subprocess with `cwd` set to the fixture
root - the seam gains no `--dir`/`--file` flag.

This plan writes ONE new file and modifies no source. It shares no file with
PLAN-1, and it must stay order-free with it: assert on `values[<key>]` from
`config.mjs get` only, never on the presence or absence of `get`'s `warnings`
field, which PLAN-1 task 3 adds entries to. The merged VALUES do not move in
this phase (D-05), so every assertion here holds before and after PLAN-1.

## Tasks

### Task 1: The harness and the first arm, end to end

- **Files:** cadence-core/bin/config-seams.test.mjs
- **Action:** Create the file with the repo's zero-dep test conventions (only
  `node:` builtins, the header comment naming the run command, as in
  route.test.mjs and git-publish.test.mjs). Build the shared harness the other
  three tasks reuse: a `layers({global, repo})` helper that writes a fixture root
  holding `.planning/config.json` from `repo` and a separate global-layer JSON
  file from `global`, returning both paths; a `getValue(key, {repoFile,
  globalFile})` helper that runs `node <bin>/config.mjs get --file <repoFile>
  <key>` as a subprocess with `CADENCE_GLOBAL_CONFIG=<globalFile>` and returns
  `values[key]` ONLY - never touching `source` or `warnings`, so the arm stays
  independent of PLAN-1; and a `seam(script, args, {globalFile, cwd})` runner
  following git-publish.test.mjs's shape (seams mirror `ok` into the exit code,
  so catch and parse `e.stdout`). Then land the first arm end to end so every
  layer of the harness is exercised in this task rather than at the end:
  `route.mjs resolve --role cad-executor --file <repoFile>` with `stakes:
  'critical'` in the GLOBAL layer alone and no `stakes` in the repo layer -
  assert `r.stakes` equals `getValue('stakes', ...)`, which proves the router
  inherits the global layer exactly as `get` reports it. Guard the fixture
  against the risk floor so the assertion is about config and not detection: pass
  `--phase` at a phase with no PLAN, or a PLAN whose declared files match no
  surface.
- **Verify:** `node --test cadence-core/bin/config-seams.test.mjs` passes with
  the route arm present, and temporarily writing `stakes: 'solo'` into the repo
  layer flips BOTH sides of the assertion together (the equality is real, not
  vacuous).

### Task 2: The three `--dir` git seams

- **Files:** cadence-core/bin/config-seams.test.mjs
- **Action:** Add three arms, each over a fixture whose GLOBAL layer alone
  carries the key so the merge is doing real work. `git-branch.mjs decide --dir
  <root>`: key `git.integration_branch`, which the seam echoes back as `mode` in
  its emitted line - assert `mode` equals `getValue('git.integration_branch')`.
  `land-cleanup.mjs cleanup --dir <root>`: key `git.base_branch`, which the seam
  emits as `base` - assert `base` equals `getValue('git.base_branch')`; the
  fixture needs no git repo, `readMergedBranches` degrades to `[]` when git
  cannot read the directory. `git-guard.mjs`: key `git.on_protected`, fed the
  PreToolUse stdin payload the way git-guard.test.mjs's `guard()` helper does,
  over a git fixture on a protected branch built like that file's `project()`
  helper (`git init -b main` plus a first commit, with
  `GIT_CONFIG_GLOBAL=/dev/null` and `GIT_CONFIG_SYSTEM=/dev/null` so the
  developer's git config never leaks in). Assert the pair: with
  `git.on_protected: 'allow'` in the global layer the guard emits nothing at all
  for `git commit` on `main` while `getValue('git.on_protected')` is `allow`, and
  with the key absent from both layers the guard asks while `getValue` returns
  the schema default `ask`. Using the silent/ask pair rather than `refuse` keeps
  the arm off `commitDecision`'s `canDeny` input, which is a property of the hook
  payload rather than of config.
- **Verify:** `node --test cadence-core/bin/config-seams.test.mjs` passes all
  four arms, and each of the three new arms fails when its global-layer value is
  changed on one side only.

### Task 3: The two repo-layer narrowings, encoded as expected

- **Files:** cadence-core/bin/config-seams.test.mjs
- **Action:** Add the two arms AC7 singles out, each asserting the DIVERGENCE
  rather than equality, with a comment naming the seam line that creates it so a
  future widening reads as a deliberate change. `git-publish.mjs publish --dir
  <root> --remote origin` over a git fixture with a local bare origin (the shape
  git-publish.test.mjs's `repo()` helper builds): put `git.auto_close: true` in
  the GLOBAL layer alone and assert `getValue('git.auto_close')` is `true` while
  the seam refuses with `reason: 'auto-close-off'` - `repoAutoClose`
  (`git-publish.mjs:55-61`) reads the repo file directly, so a user-global
  `auto_close` must never enable an unattended publish in an unrelated project.
  Pair it with an equality arm on a key the same seam reads through the merge -
  `git.protected_branches` from the global layer, observable as a
  `reason: 'protected-branch'` refusal once `git.auto_close: true` is in the REPO
  layer - asserting the seam's protected list agrees with
  `getValue('git.protected_branches')`. Then the router arm: with
  `risk.override.auth: true` in the GLOBAL layer alone and a phase whose declared
  PLAN files match the `auth` surface, assert `getValue('risk.override.auth')` is
  `true` while `route.mjs resolve` still returns the FLOORED stakes and names the
  key in `warnings` - `route.mjs:124` reads waivers from `layers.repo` alone.
  Assert on `r.stakes` and on the warning's key name, not on `r.warnings.length`,
  so PLAN-1 task 4's added diagnostic arms cannot break this file.
- **Verify:** `node --test cadence-core/bin/config-seams.test.mjs` passes; moving
  `git.auto_close` from the global to the repo layer flips the git-publish arm
  from `auto-close-off` to a real publish, and moving `risk.override.auth` from
  the global to the repo layer drops the router's stakes to the baseline - both
  confirming the arms pin the narrowing rather than an unrelated refusal.

### Task 4: The planning and review-provider arms

- **Files:** cadence-core/bin/config-seams.test.mjs
- **Action:** Add the last two arms. `planning.mjs recall --dir <root>/.planning
  "<query>"`: key `memory.backend`, read at `planning.mjs:1233` off
  `mergeLayers(join(dir, 'config.json'))` - note the seam's `--dir` is the
  `.planning` directory itself, not the project root. With `memory.backend:
  'none'` in the GLOBAL layer alone, assert the emitted line carries `backend:
  'none'` with `results: []` and that it equals `getValue('memory.backend')`;
  add the counterpart with the key absent, where `getValue` returns the schema
  default `builtin` and recall runs. `review-provider.mjs consult --provider
  openai --model gpt-test --key-file <fixture env file>`: key
  `review.max_prompt_tokens`, driven as a subprocess with `cwd` set to the
  fixture root (D-08 - the seam reads a CWD-relative `.planning/config.json`,
  caches per process, and gains no flag here). Put a small
  `review.max_prompt_tokens` in the repo layer, write a fake key file
  (`OPENAI_API_KEY="from-file"`, exactly as review-provider.test.mjs:411 does, so
  `resolveProvider` passes without a network call), feed an over-cap payload on
  stdin, and assert the refusal is `reason: 'over-cap'` with a `detail` whose
  parenthesised cap equals `getValue('review.max_prompt_tokens')`. The suite
  forbids network: `assertUnderCap` runs before any request, and the `over-cap`
  reason is itself the proof nothing was sent.
- **Verify:** `node --test cadence-core/bin/config-seams.test.mjs` passes with
  all seven seams covered, and `node --test cadence-core/bin/*.test.mjs` exits 0
  with a pass count above the 1138 phase baseline and zero failures.

## Notes

- Plan shape: CONTEXT's directive proposes three plans; PLAN-1 records why the
  first two collapse into one (shared `cadence-core/bin/config.mjs` and
  `cadence-core/bin/config.test.mjs`). This plan is the third slice unchanged -
  it writes one new file, modifies no source, and overlaps PLAN-1 on nothing, so
  the two can execute in parallel.
- Ordering with PLAN-1 is deliberate and one-directional: nothing here depends on
  PLAN-1's fixes because the collapse changes `source`, `layers` and `warnings`
  only, never a merged value (D-05). The tasks stay order-free by asserting on
  `values[<key>]` and on named warning content, never on `get`'s `source` or on a
  warning COUNT.
