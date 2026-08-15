---
phase: 1
plan: 1
requirements: [CAP-01]
files:
  - cadence-core/bin/lib/capture-file.mjs
  - cadence-core/bin/capture-file.test.mjs
  - cadence-core/bin/planning.mjs
  - cadence-core/bin/planning.test.mjs
  - cadence-core/bin/self-verify.mjs
  - cadence-core/bin/self-verify.test.mjs
  - cadence-core/bin/weight-budgets.json
  - cadence-core/workflows/execute.md
  - skills/cad-capture/SKILL.md
---

# Phase 1: The capture queue stops dropping filed work - Plan 1

## Goal

A bullet any Cadence writer files into `.planning/CAPTURE.md` lands inside the
section the recall walk visits, and two writers racing on that file either both
land or the loser is told in its return. The write stops being model-held prose
and becomes one seam every product writer calls.

## Must be true when done

- Running `planning.mjs capture --kind todo --text "<sentence>" --phase <N>`
  against a `.planning/` and then `planning.mjs recall "<a word from that
  sentence>"` in the same session returns that bullet, with `phase` set.
- The same holds for `--kind seed` and `--kind note`: each kind lands under
  `## Todos` / `## Seeds` / `## Notes` respectively, and nothing a caller can
  pass makes the seam write outside those three headings.
- A bullet placed under `## Archive` is NOT returned by `recall`, and the test
  suite asserts that pair - so the walk-membership claim is falsifiable rather
  than inspected.
- Twenty `capture` processes started concurrently against one `CAPTURE.md`
  leave twenty bullets in the file; a writer that cannot take the guard prints
  a non-`ok` envelope naming why and leaves the file byte-identical.
- `/cad-capture`, `/cad-execute`'s open-items append and `debt-harvest` all
  reach `CAPTURE.md` through that one seam - no surface restates the bullet
  format or holds `Write`/`Edit` over the file.
- `node --test cadence-core/bin/*.test.mjs` passes and
  `node cadence-core/bin/self-verify.mjs` reports no `unbudgeted-surface`,
  no `budget-overrun` and no `unknown-subcommand`.

## Context

Locked: D-01 (the append becomes a `planning.mjs` subcommand, not skill prose),
D-02 (all three product writers route through it), D-08 (`atomicWrite` in
`lib/planning-files.mjs` is NOT modified - the guard is built above it; 17 call
sites inherit anything changed inside it), D-09 (no bare EOF `O_APPEND` - the
live heading order ends at `## Debt markers`, outside the walk, so an EOF append
reintroduces this phase's headline bug), D-10 (a prose surface that GROWS carries
its `weight-budgets.json` row in the same work).

Existing pieces to build on: `parseCaptureSnippets` in
`cadence-core/bin/lib/planning-files.mjs` is the walk (`Todos`, `Seeds`,
`Notes`); `sectionSpan` in the same file is the exported, fence-aware section
bounder; `atomicWrite` is the crash-safe write; `cmdDebtHarvest` and its private
`replaceSection` in `cadence-core/bin/planning.mjs` are the only code writer of
`CAPTURE.md` today; `appendEvent` in `cadence-core/bin/lib/trace.mjs` is the
house precedent for a record-keeping write that returns a reason and never
throws.

Out of scope here: the phase-tag reader's grammar and the `/cad-health`
out-of-walk report (both in PLAN-2), widening the walk to `## Archive` or
`## Debt markers` (D-03 refuses it), and promoting any archived bullet.

## Tasks

### Task 1: The guarded capture seam, wired end to end

- **Files:** cadence-core/bin/lib/capture-file.mjs,
  cadence-core/bin/planning.mjs, cadence-core/bin/self-verify.mjs
- **Action:** Create `cadence-core/bin/lib/capture-file.mjs` as the one owner of
  `CAPTURE.md` file I/O, and register a `capture` subcommand in `COMMANDS` in
  `planning.mjs` that calls it. The module takes a CAPTURE.md path, a kind, the
  bullet text and an optional phase, and appends the bullet at the END of that
  kind's section body. The kind-to-heading map is FIXED inside the module -
  `todo` to `## Todos`, `seed` to `## Seeds`, `note` to `## Notes` - and no
  caller-supplied section name is accepted, because the structural reason five
  bullets were lost is that the writer could name a heading the walk does not
  visit; make that unrepresentable rather than validated. The three headings are
  exactly the three `parseCaptureSnippets` walks, and the module's header comment
  must say that they are one fact with two implementations and name the other
  site. Locate the section with the EXPORTED `sectionSpan` from
  `lib/planning-files.mjs` - it is bounded at both ends and fence-aware, and a
  bare heading scan was already the destructive half of a fixed bug (see
  `replaceSection`'s comment) - then write the whole file with `atomicWrite`.
  Never `appendFileSync` at EOF: today's last heading is `## Debt markers`, so an
  EOF append lands outside the walk (D-09). Do NOT touch `atomicWrite` (D-08).
  When the file is absent, create it with the same three headings
  `cmdDebtHarvest` writes for that case, then append. Bullet shapes are exactly
  those `skills/cad-capture/SKILL.md` step 3 states: a todo is
  `- [ ] (phase N) <text>` and `- [ ] <text>` unphased, a seed is `- <text>`, a
  note is `- <YYYY-MM-DD> <text>` with the date computed by the seam. An existing
  `- None.` placeholder is left alone - removing it is not this phase's business.
  The subcommand contract: `--kind` (one of the three words, anything else is
  `bad-args`), `--text` (a non-empty string; `parseArgs` hands a valueless flag
  the boolean `true`, so a bare `--text` must be refused and never written as
  "true"), `--phase` (through `requirePhaseArg` from `lib/require-int.mjs`,
  decimals legal, and admitted ONLY with `--kind todo` - passed with `seed` or
  `note` it is `bad-args`, so no caller can believe it tagged something), and
  `--file <path>` overriding the default `<dir>/CAPTURE.md` for `/cad-capture
  --cadence`'s global queue, refused when present-but-unusable exactly the way
  the `debt-harvest` entry refuses `--root` (#42/#45). Add the matching `capture`
  row to `CONTRACTS` in `self-verify.mjs` - check 2 lints every prose invocation
  against it, and a missing row is a silent opt-out rather than an unlinted
  command.
- **Verify:** In a temp `.planning/` with no `CAPTURE.md`,
  `node cadence-core/bin/planning.mjs capture --kind todo --text "quarantine the
  flaky fixture" --phase 2 --dir <tmp>/.planning` prints `ok:true`, and the
  file it created has `- [ ] (phase 2) quarantine the flaky fixture` under
  `## Todos`. `... capture --kind todo --text --dir <tmp>/.planning` prints
  `ok:false` with `bad-args`. `... capture --kind todo --text x --phase 1
  --file <tmp>/elsewhere/CAPTURE.md` writes that path and not the `--dir` one.
  `node cadence-core/bin/self-verify.mjs` reports no `unknown-subcommand` and no
  `unknown-flag`.

### Task 2: Prove the walk membership, and prove the proof can fail

- **Files:** cadence-core/bin/capture-file.test.mjs,
  cadence-core/bin/planning.test.mjs
- **Action:** New `cadence-core/bin/capture-file.test.mjs` for the module as a
  unit: one row per kind asserting the bullet lands under that kind's heading
  and under no other; a row for an absent file (created with the three headings,
  bullet inside); a row for a file whose target section is the LAST one and one
  whose target section is followed by others, so the insertion point is pinned at
  both ends; a row for a fenced `## `-looking line inside an earlier section,
  which must not become the boundary; and rows for the four `bad-args` refusals.
  In `planning.test.mjs`, add the seam-level round trip AC1 names: run `capture`
  through the CLI against a fixture `.planning/`, then run `recall` with a term
  from that sentence in the same test, and assert the bullet comes back with its
  `phase`. Beside it, the FALSIFIER: write a bullet carrying the same distinctive
  term directly under a `## Archive` heading in the same fixture, and assert
  `recall` does NOT return it - that pair is what makes the walk-membership claim
  refutable instead of inspected, and a test asserting only the positive half
  would stay green if the seam wrote to `## Archive`. Follow the existing fixture
  helper in `planning.test.mjs` that builds `CAPTURE.md` from a
  `[{section, text, phase?}]` spec, extending it rather than writing a second
  builder.
- **Verify:** `node --test cadence-core/bin/capture-file.test.mjs` and
  `node --test cadence-core/bin/planning.test.mjs` both pass. Temporarily
  changing the module's `todo` heading to `## Archive` turns the new
  planning.test.mjs round-trip test RED (revert after checking).

### Task 3: The concurrent-append guard

- **Files:** cadence-core/bin/lib/capture-file.mjs,
  cadence-core/bin/capture-file.test.mjs
- **Action:** Put a mutual-exclusion guard around the module's whole
  read-modify-write, so two writers cannot last-write-wins each other's bullet.
  Use a sibling lock file created with an exclusive-create open (`wx`) - the
  first writer wins, later writers see EEXIST - with a bounded retry so an
  ordinary overlap still lets BOTH bullets land, a stale-lock break by the lock
  file's mtime age so a crashed writer cannot wedge the queue forever, and
  release in a `finally` so a throw inside the write does not leak the lock. The
  retry budget and the staleness threshold are named constants with a comment
  saying what each buys; keep the retry budget short enough that a held lock is
  refused in well under a second, since this seam sits inside an interactive
  command. `atomicWrite` is NOT changed (D-08): its stated contract is
  crash-safety and 17 call sites in 4 files inherit anything added inside it.
  A writer that cannot take the guard RETURNS a reason and does not throw -
  settling the flagged assumption in CONTEXT deliberately. The trade-off, and
  state it in the module header: a throw would match `atomicWrite`'s convention
  but would surface inside a `/cad-capture` step whose prose has no handler, so
  the user's sentence would be lost with a stack trace instead of a retry, which
  is the same lost update made noisy; a returned reason matches `appendEvent` in
  `lib/trace.mjs` and `cmdDebtHarvest`'s existing `fail('write-failed')`, and the
  calling prose in task 5 is what makes it non-silent. The subcommand surfaces
  that reason as an `ok:false` envelope, never as a silent success. Note in the
  header that the lock path is a working-tree file: it is unlinked on every exit
  path, and `/cad-capture` step 4 stages only `CAPTURE.md`, so a transient lock
  is never committed.
- **Verify:** `node --test cadence-core/bin/capture-file.test.mjs` passes with
  three new rows: (1) twenty `capture` child processes spawned concurrently
  against one `CAPTURE.md` leave twenty distinct bullets under `## Todos`, none
  lost; (2) a lock file pre-planted with a fresh mtime makes the seam print
  `ok:false` with a reason naming the lock, and `CAPTURE.md` is byte-identical
  before and after; (3) a lock file pre-planted with an mtime older than the
  staleness threshold is broken and the bullet lands.

### Task 4: Route debt-harvest through the seam

- **Files:** cadence-core/bin/planning.mjs,
  cadence-core/bin/lib/capture-file.mjs
- **Action:** Move `replaceSection` out of `planning.mjs` into
  `lib/capture-file.mjs` and have `cmdDebtHarvest` do its `## Debt markers`
  rewrite through the module, under the same guard the append takes - so the
  harvest and a `/cad-capture` running at the same moment cannot lose each
  other's work, which is the whole point of D-02 naming all three writers.
  `replaceSection` moves verbatim, comment included: its `sectionSpan` bounding
  at BOTH ends is the fix for a real bug where a fenced `## Debt markers` example
  in an earlier section became the rewrite anchor and everything after it was
  replaced. `cmdDebtHarvest`'s observable behaviour must not move: the
  written-only-when-different idempotence, the `written:false` second run, the
  absent-file creation with the three `/cad-capture` headings, and the existing
  `fail('write-failed')` envelope all stay, with the guard's refusal reason
  reported through that same failure path rather than a new one.
- **Verify:** `node --test cadence-core/bin/planning.test.mjs` passes with its
  existing `debt-harvest` tests unedited - including the byte-identical second
  run, the fenced-heading row and the absent-CAPTURE.md row. `grep -n
  "replaceSection" cadence-core/bin/planning.mjs` shows no local definition, only
  the import.

### Task 5: /cad-capture writes through the seam

- **Files:** skills/cad-capture/SKILL.md, cadence-core/bin/weight-budgets.json
- **Action:** Replace steps 2 and 3 with one call to
  `node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" capture` carrying
  the parsed kind, text and phase, and make step 5's `--cadence` arm the same
  call with `--file` pointing at the resolved global queue path - the skill still
  resolves that path itself (the `CADENCE_GLOBAL_CONFIG` directory, else
  `~/.claude/cadence/`), the seam only writes it. Delete the restated bullet
  format from the prose: the seam owns the shapes now, and two statements of one
  format is how the writer and reader drifted apart. Keep every rail that is not
  about writing bytes - the three `--cadence` rails (no commit, nothing
  transmitted, never fall back to `.planning/CAPTURE.md` when the global
  directory cannot be resolved), the quote-nothing-else rule, step 4's
  stage-only-CAPTURE.md commit, and the unphased-capture fallback when the cursor
  is absent. Add the branch the guard needs: an `ok:false` return is REPORTED to
  the user with its reason and the sentence they gave, so a bullet that did not
  land is never reported as captured. Drop `Write` and `Edit` from
  `allowed-tools` once no remaining step needs them - a grant with no prose
  behind it is exactly the second write path this decision exists to close. If
  the file's byte count GROWS, re-pin its `weight-budgets.json` row in this same
  commit (D-10); the check is a ceiling, so a shrink needs no re-pin.
- **Verify:** `node cadence-core/bin/self-verify.mjs` reports no
  `unknown-subcommand`, no `unknown-flag`, no `unbudgeted-surface` and no
  `budget-overrun` - check 2 lints the new invocation line against the `capture`
  row task 1 added. `grep -n "Write\|Edit" skills/cad-capture/SKILL.md` returns
  no tool grant and no write instruction over `CAPTURE.md`.

### Task 6: /cad-execute's open-items append writes through the seam

- **Files:** cadence-core/workflows/execute.md,
  cadence-core/bin/weight-budgets.json
- **Action:** In the summary step, replace the hand-written
  `- [ ] (phase <N>) <text>` append and its create-the-file-with-three-headings
  instruction with one `planning.mjs capture --kind todo --text <item> --phase
  <N>` call per open item - the seam creates the file and owns the format, so
  this surface stops being a second statement of both. Keep what is NOT about
  bytes: the reason open items go to `CAPTURE.md` at all (SUMMARY is the phase's
  record, CAPTURE is the live phase-linked queue), the do-not-duplicate rule, and
  the file joining the docs commit in the state step. The `debt-harvest` call
  immediately after is unchanged and stays best-effort. Report an `ok:false`
  return in one line rather than silently continuing, for the same reason task 5
  gives. If this file GROWS, re-pin its `weight-budgets.json` row in the same
  commit (D-10).
- **Verify:** `node --test cadence-core/bin/*.test.mjs` passes and
  `node cadence-core/bin/self-verify.mjs` reports no `unbudgeted-surface`, no
  `budget-overrun` and no `unknown-subcommand` (AC6 for this plan).
  `grep -n "phase <N>) <text>" cadence-core/workflows/execute.md` returns
  nothing.

## Notes

- The CONTEXT `Plan shape` directive asked for two plans in this phase and this
  is the first. The two slices are NOT file-independent - both add a subcommand
  to `COMMANDS` in `planning.mjs`, a row to `CONTRACTS` in `self-verify.mjs`,
  rows to `weight-budgets.json` and tests to `planning.test.mjs` - so they run
  SEQUENTIALLY, PLAN-1 then PLAN-2, and `plan-overlap` will correctly report the
  shared paths. `workflows/plan.md` states a sequential multi-plan phase is a
  supported shape, and the archived `phases/1/PLAN.md` + `PLAN-2.md` of v2.5.0
  are house precedent for split plans that share `planning.mjs`.
- CONTEXT's flagged assumption about the losing writer is settled here in favour
  of a RETURNED reason, not a throw, with the trade-off written into the module
  header (task 3). If field use shows a `/cad-capture` silently swallowing that
  reason, the fix is in the prose branch task 5 adds, not in the module.
- CONTEXT's flagged assumption about Claude Code `Edit`/`Write` semantics under
  concurrent external modification is unresolvable from this repo and is why D-01
  is load-bearing for AC5 as well as AC1: after task 5 and task 6 there is no
  model-held write over `CAPTURE.md` left to be unguarded.
- The remaining honest gap, also flagged in CONTEXT: a hand or script edit racing
  a code writer stays unguarded, because it never takes the lock. That is the
  2026-08-14 near-miss's actual shape, and AC5 can pass with it open. Not closed
  here and not worth a lock nobody else honours.
