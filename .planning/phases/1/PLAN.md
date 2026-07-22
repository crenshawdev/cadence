---
phase: 1
plan: 1
requirements: [REV-01]
files:
  - cadence-core/bin/review-provider.mjs
  - cadence-core/bin/review-provider.test.mjs
  - cadence-core/references/review-triggers.md
---

# Phase 1: Repair the cross-model review seam - Plan

## Goal

`review-provider.mjs` runs correctly when invoked through a symlinked plugin
path (cross-model `review` / `consult` / `detect-models` no longer silently
no-op), the review `fire()` path surfaces an empty or unusable provider result
as one visible line instead of degrading to the subagent silently, and a
regression test invoking the script through a symlink guards the fix.

## Must be true when done

- Invoking `review-provider.mjs` through a symlink emits the exact same
  non-empty JSON line as invoking it by its real path (before the fix the
  symlinked invocation emitted nothing).
- The run-as-script guard compares the realpath of both operands and does not
  throw on a missing/odd `argv[1]`, falling back to the normalized comparison
  so the module's never-throw-and-crash-the-spine contract holds.
- `review-provider.test.mjs` contains a symlink regression test asserting a
  single non-empty parseable JSON line, and `node --test` over
  `cadence-core/bin/` is green.
- In the review `fire()` path, an empty or unusable cross-model provider result
  produces one visible line naming the degradation before falling back to the
  `claude-subagent` reviewer.
- `tsc --checkJs` and `node cadence-core/bin/self-verify.mjs` both pass with the
  change in place (no schema/CONTRACTS drift; the subcommands and flags are
  unchanged).

## Context

Locked decisions from `phases/1/CONTEXT.md` bind this plan: D-01 (guard compares
`fs.realpathSync` of both `process.argv[1]` and `fileURLToPath(import.meta.url)`,
not `path.resolve` which normalizes but does not follow symlinks); D-02 (guard
the `realpathSync` calls against throwing, falling back to normalized compare);
D-03 (keep the fix local to `review-provider.mjs` - do NOT extract a shared
`isMainModule()` helper into `lib/seam-io.mjs`); D-04 (surface an empty/unusable
provider result as one visible line in `references/review-triggers.md` `fire()`
step 4 before the `claude-subagent` fallback, review path only); D-05 (symlink
regression test in `review-provider.test.mjs` asserting a single non-empty
parseable JSON line); D-06 (no `self-verify.mjs` CONTRACTS change). The
never-throw output contract lives at `review-provider.mjs:18-23`, `:59-74`. Out
of scope: consult/detect-models surfacing, new config keys/subcommands/flags,
provider or model-detection behavior changes.

`fire(trigger)` is a prose workflow step in `references/review-triggers.md` that
the main-context model executes by reading the steps and dispatching reviewers -
there is NO JavaScript `fire()` function in the codebase (grep-verified: `fire(`
appears only in that reference doc). Per D-04, `review-provider.mjs` already
emits a structured `reason`/`detail` on `ok:false`; the sole place that result
is swallowed is the caller prose, so Task 3's amendment to that prose IS the
implementation of the surfacing behavior - no additional code task exists or is
needed. (Any "fire() is a stub" note in the root `RESUME.md` is stale v1.1.0
build-out narrative; step 4's `ok:false` path is fully specified today.)

## Tasks

### Task 1: Fix the run-as-script guard to compare realpaths on both sides

- **Files:** cadence-core/bin/review-provider.mjs
- **Action:** Replace the guard at `:501`
  (`if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url)))`)
  with a call to a new file-local function `isRunAsScript()` defined just above
  the guard (keep it local per D-03 - do not add anything to `lib/seam-io.mjs`).
  `isRunAsScript()` returns false when `process.argv[1]` is absent; otherwise it
  canonicalizes both `process.argv[1]` and `fileURLToPath(import.meta.url)`
  through a single inner helper that returns `fs.realpathSync(p)` inside a
  try/catch and returns `path.resolve(p)` on any throw (per D-02, so an ENOENT
  or odd `argv[1]` degrades to the normalized comparison rather than crashing),
  then returns whether the two canonicalized values are equal. Both operands
  must pass through the same helper so a realpath failure on one side still
  yields a normalized-vs-normalized compare. Do not change `main()`, the
  `ok()`/`fail()` helpers, the `unhandledRejection`/`uncaughtException` handlers,
  or the `main().catch(...)` body - only the boolean guard changes. `fs` and
  `path` are already imported at `:44-46`.
- **Verify:** From `cadence-core/bin`, `ln -s "$PWD/review-provider.mjs"
  /tmp/rp-link.mjs && node /tmp/rp-link.mjs detect-models --provider skynet`
  prints a single non-empty JSON line with `"reason":"bad-provider"` identical
  to `node review-provider.mjs detect-models --provider skynet`; before this
  change the symlinked invocation printed nothing. `tsc --checkJs` stays green.

### Task 2: Add the symlink regression test

- **Files:** cadence-core/bin/review-provider.test.mjs
- **Action:** Add a CLI test near the existing pre-network failure-path tests
  (`:176-193`) that reproduces the `argv[1]`-vs-`import.meta.url` divergence.
  Import `symlinkSync` from `node:fs` (alongside the existing `mkdtempSync`,
  `writeFileSync` at `:10`). In the test, create a symlink to `SCRIPT` (defined
  at `:19`) inside the existing `dir` tmpdir (a single-file symlink is
  sufficient per the CONTEXT flagged assumption - it already reproduces the
  divergence), invoke it through the symlink over a no-network failure path
  (`detect-models --provider skynet`) using `execFileSync('node', [linkPath,
  ...args])` with the same key-stripped env as the `run()` helper at `:22-34`,
  and assert the captured stdout is one non-empty line that `JSON.parse`s to an
  object with `ok === false` and `reason === 'bad-provider'` - matching what the
  real-path invocation returns. Assert the parsed line is non-empty (the object
  is truthy and has a `reason`), which is the property the pre-fix bug violated
  (empty stdout). Do not alter the existing `run()` helper or other tests.
- **Verify:** `node --test cadence-core/bin/review-provider.test.mjs` passes
  including the new test; reverting Task 1's guard change makes only the new test
  fail (empty stdout / JSON parse error), confirming it guards the regression.

### Task 3: Surface the empty/unusable provider result in fire() step 4

- **Files:** cadence-core/references/review-triggers.md
- **Action:** Amend the `### 4. Run the reviewers` prose (`:40-56`), the
  `ok:false` bullet at `:54-56`, so that when a cross-model provider result is
  `ok:false` (unavailable/unusable) the caller emits one visible line naming the
  degradation - the reviewer that dropped and its `reason` (e.g. "cross-model
  reviewer `openai` unavailable: no-key - falling back to claude-subagent") -
  BEFORE falling back to `claude-subagent`, rather than degrading silently. Scope
  the surfacing strictly to the `ok:false` result: that is the only outcome that
  drops a reviewer and triggers the subagent fallback, and the only one carrying
  a `reason`. Do NOT surface or fall back on `ok:true` with an empty `findings`
  array - that is a legitimate clean cross-model pass (reviewer ran, found
  nothing; `review-provider.mjs:416` emits `ok:true` with the validated
  `findings`, no `reason` field), and the existing `ok:true -> use findings`
  behavior must be preserved unchanged. Scope this to the review path only per
  D-04; do not touch consult/detect-models references, and do not add a config
  key or change the step-3 resolution rule. The script already emits structured
  `reason`/`detail`; this closes the caller-side gap where those reasons were
  swallowed.
- **Verify:** `review-triggers.md` step 4's `ok:false` path now directs the
  caller to emit one visible line naming the reviewer and reason before the
  `claude-subagent` fallback (readable in the diff). human-verify: a live review
  run with an empty/failing provider result shows that line printed before the
  subagent fallback (needs a configured or deliberately-failing provider).

### Task 4: Confirm no drift and a green suite

- **Files:** (none modified) cadence-core/bin/review-provider.mjs, cadence-core/bin/review-provider.test.mjs, cadence-core/references/review-triggers.md
- **Action:** Run the drift and type gates over the completed change to confirm
  D-06 holds (no CONTRACTS/schema drift; `review` / `consult` / `detect-models`
  subcommands and flags at `self-verify.mjs:86-91` unchanged). Make no code
  edits in this task; if either gate reports drift, the fix belongs in the task
  that introduced it, not here.
- **Verify:** `node cadence-core/bin/self-verify.mjs` exits 0 with no drift
  reported, `tsc --checkJs` is clean, and `node --test cadence-core/bin/` is
  fully green.

## Notes

Two acceptance criteria from CONTEXT.md are human-verify and cannot be settled
by the executor: (a) the empty/unusable provider result printing one visible
line in a live `fire()` run (needs a live or deliberately-failing provider
result, Task 3), and (b) a symlinked plugin install with a real cross-model
provider key returning an actual cross-model result instead of no-opping to the
subagent (needs a configured provider API key). Tasks 1-2 prove the mechanism
deterministically over the no-network failure path; the key-gated end-to-end
behavior rides on that same guard.

Flagged assumption carried from CONTEXT.md: Node's main-module symlink
resolution across the 22/24 CI matrix is unconfirmed, but realpath-ing both
operands (Task 1) is robust whichever way `process.argv[1]` and
`import.meta.url` resolve, so it does not block the plan.

The recalled memory for this phase surfaced only phase 1's own CONTEXT.md
(D-01..D-05 restated), not external prior art; no cross-phase precedent applies.
