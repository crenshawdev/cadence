---
phase: 1
plan: 1
requirements:
  - RSK-01
  - RSK-02
files:
  - cadence-core/bin/lib/risk-diff.mjs
  - cadence-core/bin/risk-diff.test.mjs
  - cadence-core/bin/lib/surface-scan.mjs
  - cadence-core/bin/planning.mjs
  - cadence-core/bin/self-verify.mjs
  - cadence-core/bin/prose-agreement.test.mjs
  - cadence-core/workflows/execute.md
  - cadence-core/workflows/task.md
  - cadence-core/references/review-triggers.md
  - cadence-core/bin/weight-budgets.json
---

# Phase 1: The check that proves it ran - Plan

## Goal

A completed diff range cannot report done without an executable risk record, so
the run record distinguishes "the detection step was skipped" from "it ran and
matched nothing".

## Must be true when done

- `planning.mjs risk-check run --phase <N> --plan <k> --base <ref> --head <ref>`
  prints one JSON line carrying `checked`, `categories`, `matches` and
  `inconclusive`, and appends one `{"family":"outcome","event":"risk_check"}`
  line to `.planning/trace.jsonl` on a MATCHING range and on a CLEAN one alike.
- A range the heuristics cannot judge reads `inconclusive: true` with
  `matches: []`, and a reader can tell it apart from a judged-clean range, which
  reads `inconclusive: false` with `matches: []`.
- `planning.mjs risk-check status --phase <N>` exits 1 and names, by plan, every
  completed executor range in that phase carrying no risk record, and exits 0
  once each one has a record. Given `--plan <k> --base <ref> --head <ref>` it
  requires a record for THAT range, so a record left by an earlier, narrower
  range of the same plan does not satisfy a later one.
- Both completion paths call the seam rather than instructing a model to read a
  prose list: `workflows/execute.md`'s post-plan `risk_surface` step and
  `workflows/task.md`'s `risk_check` step, neither reporting done while the
  record is absent - which includes a run that answered `ok:true` while its
  append came back `written: false`. The blocking-on-match behaviour and the ONE-round re-arm cap
  in `references/triage-gate.md` read exactly as they do today.
- `risk_surface`'s gate at every stakes level is unchanged: `route-table.json`
  and `config.schema.json` are byte-identical to their pre-phase state.
- `cadence-core/bin/lib/surface-scan.mjs` still answers "which categories does
  this project SCOPE" and still returns all eight unconditionally; the new lib
  answers "did this RANGE touch one", and each file's header names the other.
- `node --test 'cadence-core/bin/*.test.mjs'` and
  `node cadence-core/bin/self-verify.mjs` both run clean, with the fixture rows
  for a risky range, a clean range, an inconclusive range and the missing-record
  refusal in the suite.

## Context

No CONTEXT.md exists for this phase; the ROADMAP entry's eight success criteria
are the locked scope and nothing beyond them is planned here. Shapes to match:
`lib/surface-scan.mjs` + `surface-scan.test.mjs` (pure lib, caller does the I/O,
seam rows tested beside the lib), `lib/gate-agreement.mjs` +
`gate-agreement.test.mjs` (vocabulary from the caller, frozen pre-patch literals
as the watched-to-fail evidence), and `cmdLeaseCheck` (a gate that refuses with
`emit({ok:false, ...})` carrying the offending list). Out of scope, deliberately:
`workflows/debug.md`'s and `/cad-verify`'s single-staged-fix fires, which are not
completion paths; any change to a config key, a route-table cell or a gate; and
any widening of `scanTree`, which stays a scoping aid.

Two prior-project findings bind the wiring task (CAPTURE.md, phase 2): the ONE-
round re-arm cap lives only in `references/triage-gate.md` and the `risk_surface`
fire sites restate the blocking arm inline without it, so the re-read
instructions at both sites must survive this edit intact; and RVW-02 is the
precedent shape this phase repeats - state the fact in the record, never infer it
from silence.

## Tasks

### Task 1: the diff detector, born distinct from the scoping aid

- **Files:** cadence-core/bin/lib/risk-diff.mjs, cadence-core/bin/risk-diff.test.mjs, cadence-core/bin/lib/surface-scan.mjs
- **Action:** Create a pure lib that maps a unified-diff BODY plus a category
  vocabulary to `{checked, categories, matches, inconclusive}`. Pure in the sense
  `lib/surface-scan.mjs`'s header states and `lib/gate-agreement.mjs` follows: no
  fs, no emit, no process, no Date, no randomness - the caller reads the tree,
  this side owns the map from what was read to what it means. The category
  vocabulary arrives from the CALLER, the way `gateAgreementIssues` takes its
  gate and level names, so this file never becomes another statement of the eight
  tokens; `CATEGORIES` in `lib/surface-scan.mjs` is the existing lib-side
  statement and the caller passes it. Each `matches` entry names the category and
  the ONE signal that found it first, the shape `scanTree`'s `evidenced` already
  uses, so a fire site can state a reason instead of a bare verdict.
  Signals are the diff's changed PATHS (whole path segments, file names and
  extensions, never substrings - `src/auth` may not be matched by
  `src/authority.rs`, the rule `cmdLeaseCheck` already states for declared paths)
  and the ADDED and REMOVED lines only, never context lines, with every content
  pattern anchored. Do NOT add a category-name keyword grep: that pass was
  measured on this repo on 2026-08-13 and false-positived `auth` on sixteen
  `session` matches, every one a Claude session, and `billing` on prose about
  token cost (the rule and its evidence are in `lib/surface-scan.mjs`'s header).
  Trusted for nothing: a null, a scalar or an unparseable body reports rather
  than throws. `inconclusive` is TRUE when the range carries change this cannot
  judge - a file whose body git rendered as binary, or a body with no readable
  hunk - is NEVER collapsed into `matches: []`, and is independent of `matches`,
  so a partly-unreadable range that also matched reports both. `checked` is FALSE
  only when there was no diff body to read at all, and `checked: false` implies
  `inconclusive: true`. In `lib/surface-scan.mjs` add only the sentence naming the
  split - that file answers which categories a project SCOPES, this new one
  answers whether a RANGE touched one - and change no behaviour: `scanTree` must
  keep returning `recommended = [...CATEGORIES]` unconditionally.
- **Verify:** `node --test cadence-core/bin/risk-diff.test.mjs` passes with one
  `test()` per row (a loop inside one `test()` reports the loop's count, not the
  rows'): a risky fixture diff returns at least one match whose category is one
  of the eight tokens and whose signal names what found it; a clean fixture diff
  returns `matches: []` with `inconclusive: false` and `checked: true`; a
  binary-only fixture returns `inconclusive: true` with `matches: []`; an empty
  body returns `checked: false` with `inconclusive: true`; a fixture whose only
  candidate is a substring (`src/authority.rs` against an `auth` path signal)
  returns no match; and a null and a scalar body each return a record rather than
  throwing. `node -e "import('./cadence-core/bin/lib/risk-diff.mjs')"` from the
  repo root prints nothing, proving the lib imports with no side effect.

### Task 2: `risk-check run` - the record written on every invocation

- **Files:** cadence-core/bin/planning.mjs, cadence-core/bin/self-verify.mjs, cadence-core/bin/risk-diff.test.mjs
- **Action:** Start reading planning.mjs at `cmdDetectSurfaces` and its `COMMANDS`
  dispatch row, and self-verify.mjs at `CONTRACTS` and `TWO_WORD`. Add a
  `risk-check` entry to planning.mjs's `COMMANDS` dispatch
  table - by table entry, never an if-chain, the rule the file header states -
  whose `run` arm takes `--phase <N>`, `--base <ref>`, `--head <ref>`, an
  optional `--plan <k>` and an optional `--surfaces <comma-list>`. `--phase` goes
  through `requirePhaseArg` and `--plan` through `requireInt`, the VAL-01 rail
  (`parseArgs` gives a valueless flag the boolean `true`, and `Number(true)` is
  `1`); `--base` and `--head` are both REQUIRED, because a defaulted head is a
  range the caller never stated. Resolve the repository with
  `git rev-parse --show-toplevel` and read the range with `execFileSync` against
  `git -C <top> diff`, the way `cmdLeaseCheck` reads its staged set, with an
  explicit `maxBuffer` so an oversized body is a reported state rather than a
  throw; any git failure message goes through `redactUrl` before it reaches the
  envelope, the EXP-01 rail `cmdLeaseCheck`'s `no-staged-set` already applies.
  Hand the body to task 1's lib with `CATEGORIES` imported from
  `lib/surface-scan.mjs` beside the existing `scanTree` import, narrowed by
  `--surfaces` when given so the record states what was actually checked; a
  `--surfaces` value carrying a token outside the eight is a malformed CALL -
  `fail('bad-args', ...)` and NOTHING appended, the rule `trace append --tokens`
  already states, because a caller who mistyped the scope of a blocking gate must
  see a refusal rather than a narrowed clean answer.
  The record is appended through `appendEvent` from `lib/trace.mjs` directly,
  never by shelling out to `trace append` - the split that file's header states
  for `route.mjs` and `review-provider.mjs` - as `family: 'outcome'`, event
  `risk_check`, carrying the plan when given, the base and head, `checked`, the
  resolved `categories`, the matched category tokens and `inconclusive`. It is
  appended on EVERY invocation that got past argument validation, including the
  no-match path and the git-failure path, and BEFORE the envelope is emitted, so
  even a refusal leaves the record that says the check was attempted.
  `appendEvent` never throws and never speaks; its `{written, reason}` rides the
  envelope so a trace that could not be written is reported rather than silently
  dropped, and it may not change the verdict. A run that could not read a diff
  emits `ok: false` naming that reason, since a caller must not be able to read
  it as a clean range. Add the `'risk-check run'` row to
  `CONTRACTS['planning.mjs']` listing exactly these flags, and add `risk-check`
  to the `TWO_WORD` set beside `cursor`, `uat`, `renumber` and `trace` - without
  the second, check 2 reads `run` as the whole subcommand and reports
  `unknown-subcommand` against correct prose. Add the subcommand to planning.mjs's
  header subcommand list, where every other subcommand is described.
- **Verify:** In a scratch git repo fixture with its own `.planning` dir,
  `node cadence-core/bin/planning.mjs risk-check run --dir <planning> --phase 1
  --plan 1 --base <first sha> --head HEAD` over a range touching a risky file
  prints `ok:true` with a non-empty `matches`, and over a clean range prints
  `ok:true` with `matches: []` and `inconclusive:false`; in BOTH cases the
  fixture's `trace.jsonl` gains exactly one line whose `family` is `outcome` and
  `event` is `risk_check`, asserted by parsing the file. A `--surfaces` value
  naming a token outside the eight prints `ok:false` with `reason:"bad-args"` and
  the trace file gains NO line. A `--base` naming a ref that does not exist
  prints `ok:false` with `checked:false` on the appended record, and the trace
  file DOES gain its line. `node cadence-core/bin/self-verify.mjs` prints
  `"problems":[]` - specifically no `unknown-subcommand` and no
  `uncontracted-script`.

### Task 3: `risk-check status` - completion requires the record, watched to fail first

- **Files:** cadence-core/bin/planning.mjs, cadence-core/bin/self-verify.mjs, cadence-core/bin/risk-diff.test.mjs
- **Action:** Add the `status` arm to task 2's `risk-check` dispatch entry, taking
  `--phase <N>` alone. It reads the run
  record through `renderTrace` from `lib/trace.mjs` and through nothing else: a
  second reader of one record is how two readers of it start disagreeing about
  what closed, which is the reason `renderTrace` exposes its paired `brackets` at
  all. A COMPLETED range is a `brackets` row whose dispatch `role` is
  `cad-executor` and whose terminal `event` is `return`; the row's `plan` is its
  identity. A range HAS a record when a scoped `outcome`/`risk_check` event
  carries the same `plan`. Group by plan, so a checkpoint-then-return
  continuation counts once rather than twice.
  A plan number alone is NOT a range identity, and the bracket cannot supply
  one: `renderTrace`'s rows carry `{corr, phase, plan, role, event, ts, end,
  ms, tokens}` and no refs, so nothing in the paired record says which range an
  executor actually committed. The refs therefore come from the CALLER: `status`
  takes an optional `--plan <k> --base <ref> --head <ref>` triple, and when it is
  given, that plan is satisfied only by a `risk_check` event whose `base` and
  `head` equal the ones passed. A plan-matching record with different refs is
  reported as STALE with both ref pairs named, and does NOT satisfy the range -
  a plan re-dispatched over a widened range (`execute.md`'s "re-dispatch the
  remainder" arm) is exactly the case that would otherwise pass on the record its
  earlier range left. Without the triple the phase-wide arm keeps plan-level
  matching, and reports each record's `base`/`head` in its rows so a stale one is
  visible rather than silently counted. When one or more completed ranges
  carry no record, refuse with `emit({ok: false, reason: 'risk-record-missing',
  ...})` listing the offending plans by name plus a hint naming the `risk-check
  run` call that closes it - emitted directly rather than through `fail()`,
  because `fail()`'s reason/detail/hint shape has no channel for the list and the
  list is the whole point of the refusal, exactly as `cmdLeaseCheck`'s
  `undeclared-files` arm reasons. With every completed range recorded, `ok:true`
  carrying the per-plan rows. A phase with no completed executor range at all is
  `ok:true` with an empty list: nothing to require is not a failure, and a gate
  that refused there would block the first plan of every phase. Add the
  `'risk-check status'` CONTRACTS row and the header subcommand entry.
- **Verify:** Two arms, and the second lands BEFORE task 4's wiring exists.
  (a) A `.planning` fixture whose `trace.jsonl` holds a `cad-executor`
  dispatch/return pair for plan 1 under one `phase_start` anchor and no
  `risk_check` event makes `planning.mjs risk-check status --dir <planning>
  --phase 1` exit 1 with `reason:"risk-record-missing"` naming plan 1; appending
  a plan-1 `risk_check` record makes the identical call exit 0. A fixture with a
  checkpoint AND a return for plan 1 reports plan 1 once, not twice. And the
  stale-record row: with a plan-1 `risk_check` record carrying `base` A and
  `head` B on disk, the same call passed `--plan 1 --base A --head C` exits 1
  reporting that plan STALE and naming both ref pairs, while `--base A --head B`
  exits 0 - failing-capable in both directions, so a status that ignored the refs
  goes red on the first row.
  (b) The evidence arm: build the fixture for (a) from the REAL bytes of this
  repo's `.planning/trace.jsonl` - the `"role":"cad-executor"` dispatch/return
  lines for phase 1, copied verbatim as frozen literals with a comment saying why
  they are frozen, the way `gate-agreement.test.mjs`'s `PRE_PATCH` and
  `SHIPPED_REVIEW` are - so the row proves the check reports the omission that
  was actually there and cannot evaporate once the wiring lands. Also run
  `node cadence-core/bin/planning.mjs risk-check status --phase 1` against this
  repo's live `.planning/` at this commit and quote its exact output in the
  commit message body, whatever it says.

### Task 4: both completion paths call the seam

- **Files:** cadence-core/workflows/execute.md, cadence-core/workflows/task.md, cadence-core/references/review-triggers.md, cadence-core/bin/weight-budgets.json, cadence-core/bin/prose-agreement.test.mjs
- **Action:** The three prose surfaces are read at their steps: execute.md's
  post-plan `risk_surface` step, task.md's `risk_check` step, and
  review-triggers.md's `## risk_surface detection` section. Replace the detection
  INSTRUCTION at both fire sites with the seam call. In `workflows/execute.md`'s post-plan step - the paragraph beginning
  "After each plan completes, first fire `risk_surface`" - the orchestrator runs
  `planning.mjs risk-check run` for the plan's committed range and reads its
  answer, instead of checking the diff against the prose list in
  `references/review-triggers.md`. A non-empty `matches` OR `inconclusive: true`
  fires the trigger: an unjudged range is not a cleared one, and widening is the
  only safe direction on the one gate that is `blocking` at every stakes level -
  the same reasoning `lib/surface-scan.mjs`'s header and `route.mjs`'s surfaces
  block both state in their own words. Everything downstream of the decision is
  UNCHANGED: shape (c), the diff file at `<plandir>/reports/plan-<k>-risk.diff`,
  the never-stage rail, the delete-once-the-trigger-returns rail, the blocking
  arm, and the RE-READ of `references/triage-gate.md` for the ONE-round re-arm
  cap, which the fire sites carry precisely because that cap lives nowhere else.
  Before the plan is reported done the step runs `risk-check status` for the
  phase and does not report done while it refuses. Make the same substitution in
  `workflows/task.md`'s `risk_check` step, keeping the slug derivation, both
  directory arms and the `${TMPDIR:-/tmp}` inline-path arm exactly as they are;
  the task path reports done only on an `ok:true` run whose record actually
  reached the trace - `written: true` - and states that state rather than
  assuming it. `ok:true, written:false` (a symlinked trace, a failed stat, a
  full disk, the `size-cap` bound) is NOT a completed check: it is the exact
  state RSK-02 exists to make impossible to report done on, and the execute path
  is covered here only because its `risk-check status` call re-reads the trace
  and finds nothing. The task path has no status call of its own, so the
  `written` flag is its whole guard: on `written:false` it reports the reason and
  does not report done until a record lands. In `references/review-triggers.md`'s
  `## risk_surface detection` section, say that detection is the seam's answer
  and name which file answers which question - `lib/surface-scan.mjs` for which
  categories the project scopes, the new lib for whether a range touched one -
  and leave the eight `- \`token\` - prose` bullets in their exact grammar,
  because `prose-agreement.test.mjs` parses them with an anchored pattern, and
  leave the wiring table's `risk_surface` row, its gate column and every gate
  cell byte-identical. All three prose surfaces sit EXACTLY at their budget today
  (execute.md 25287 B, task.md 6104 B, review-triggers.md 28015 B), so any that
  grows must have its `weight-budgets.json` row re-pinned in the same commit or
  self-verify reports `budget-overrun`. Add one `prose-agreement.test.mjs` row
  asserting both fire sites invoke `planning.mjs risk-check run`; do not weaken
  the rows already pinning `plan-<k>-risk.diff`, `risk-task-{slug}.diff`, "never
  stage it" and the delete rail.
- **Verify:** `node --test 'cadence-core/bin/*.test.mjs'` passes, including the
  new prose-agreement row and every pre-existing `risk_surface` row.
  `node cadence-core/bin/self-verify.mjs` prints `"problems":[]` - specifically
  no `budget-overrun`, no `unbudgeted-surface`, no `unknown-subcommand` and no
  `unknown-flag` against the new invocations. `git diff --stat
  cadence-core/route-table.json cadence-core/config.schema.json` prints nothing,
  proving no gate, key or cell moved. `grep -c 'risk-check run'
  cadence-core/workflows/execute.md cadence-core/workflows/task.md` reports at
  least 1 for each file, and `grep -c 'triage-gate.md'
  cadence-core/workflows/execute.md cadence-core/workflows/task.md` reports the
  same counts it did before this task.
  Those greps prove only that detection was re-pointed at the seam, which is the
  smaller half. The ENFORCEMENT half gets its own failing-capable rows, added to
  `prose-agreement.test.mjs` beside the `risk-check run` row and each watched to
  FAIL against these two files as they stand before this task's edit: execute.md's
  post-plan step invokes `planning.mjs risk-check status` and states that the plan
  is not reported done while that call refuses; task.md's `risk_check` step states
  that done is withheld on `written: false`. A tree carrying `risk-check run` at
  both sites and neither of those two sentences must go RED - stated as the test's
  own assertion message, because an implementation delivering detection without
  enforcement passing every other check in this task is precisely the outcome
  RSK-02 exists to prevent.

## Notes

- One plan, not a split: every task after the first writes
  `cadence-core/bin/risk-diff.test.mjs` or `cadence-core/bin/planning.mjs`, and
  tasks 3 and 4 depend on task 2's subcommand existing. No independent slice
  exists. The CONTEXT `Plan shape` directive was "not specified", so nothing is
  contradicted.
- No user-facing surface is added - no `/cad-*` command, no config key, no flag
  a user sets - so no README or `skills/cad-help` registration task is planned
  here, unlike a phase that ships a command.
- Two planner choices in the discretionary space, recorded because no CONTEXT.md
  locked them: `inconclusive: true` fires the trigger exactly as a match does
  (criterion 3 makes the state distinguishable, and leaving the caller's response
  unstated would make it decorative), and the seam does not write the transient
  `.diff` file - the fire sites keep their own redirect, since a detection seam
  that also produced review artifacts would own two lifecycles.
