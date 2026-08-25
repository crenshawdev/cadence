---
phase: 2
plan: 1
requirements:
  - TRC-02
  - TRC-03
  - HOK-01
files:
  - cadence-core/bin/lib/arg-contract.mjs
  - cadence-core/bin/arg-contract.test.mjs
  - cadence-core/bin/planning/trace.mjs
  - cadence-core/bin/lib/trace.mjs
  - cadence-core/bin/trace.test.mjs
  - cadence-core/bin/trace-suggest.test.mjs
  - cadence-core/bin/window-budget.test.mjs
  - cadence-core/bin/planning-lease-check.test.mjs
  - cadence-core/bin/phase-spelling.test.mjs
  - cadence-core/bin/self-verify.test.mjs
  - cadence-core/references/seam-spawn-agent.md
  - cadence-core/config.schema.json
  - cadence-core/bin/weight-budgets.json
---

# Phase 2: The host writes the bracket - Plan 1

## Goal

The record can hold a second writer before one exists: a bracket carries the
wall clock the host returns, two closes of one dispatch render as one bracket
with the figures intact, an open dispatch names the role that opened it, and the
undocumented host-return dependency the whole bracket system rests on is stated
where a reader finds it.

## Must be true when done

- `planning.mjs trace close --duration-ms "1m 23s"` is accepted and records
  83000; a plain integer is accepted as milliseconds; a spelling outside the
  duration grammar is refused with NOTHING appended, so a mistyped duration
  never costs the bracket it was recording.
- `planning.mjs trace render` shows a `duration_ms` on every bracket whose close
  carried one, and no `duration_ms` key at all on a bracket whose close did not
  - an absent wall clock stays distinguishable from a zero one.
- A dispatch closed TWICE - once with no figures, once carrying tokens, turns, a
  duration and a detail - renders as exactly ONE bracket that carries all of
  those figures, `unpaired` gains no row, and the role is billed for one
  dispatch and one token figure. The same two closes in the opposite order
  render identically.
- Two genuine dispatches on one worker key, each with its own close, still
  render as two brackets - the dedup collapses a repeat close, never a repeat
  dispatch.
- `trace render`'s `unpaired` rows name the ROLE their dispatch was opened
  under, so a reader can say which kind of worker is still open without
  re-deriving the pairing.
- `cadence-core/references/seam-spawn-agent.md` names all three figures Cadence
  reads off a subagent return, what depends on each, and that the rendering can
  change with no deprecation; `grep -n 'seams\.md' cadence-core/config.schema.json`
  returns no hit inside the six `max_dispatch_tokens` purposes.
- `node cadence-core/bin/test.mjs` is green and `node cadence-core/bin/self-verify.mjs`
  reports `ok:true` after every task.

## Context

CONTEXT.md's decisions bind this plan: D-04 (the existing replay guard is NOT a
dedup and must not be leaned on), D-06 (`--duration-ms` takes a STRING-tolerant
grammar, never a plain `int`, and the duration is NOT computed at render),
D-09 (the worker key is `(corr, phase, plan)` in code, built at
`cadence-core/bin/lib/trace.mjs`'s `renderTrace`), D-10 (the flag-entries census
is 189 today and moves to 190; the roadmap's 185 -> 186 is wrong), D-12
(`weight-budgets` is the pin that moves), D-13 (the dispatch contract this phase
edits is `references/seam-spawn-agent.md`, NOT `seams.md`) and D-14 (the six
`max_dispatch_tokens` purposes cite a file that no longer carries the argument).

This plan lands BEFORE PLAN-2, which adds the hook writer - criterion 1's own
wording orders it. PLAN-2 shares `references/seam-spawn-agent.md`,
`cadence-core/bin/weight-budgets.json` and the arg-contract pair with this plan,
so the two run sequentially and never in parallel worktrees.

Out of scope here: `hooks/hooks.json`, any hook script, the `self-verify` event
pin, and `workflows/execute.md` - all PLAN-2's. Also out: adding
`--duration-ms` to the ten literal `trace close` command lines in the workflows
(see Notes).

## Tasks

### Task 1: `trace close` takes a duration in the spelling the host prints

- **Files:** cadence-core/bin/lib/arg-contract.mjs,
  cadence-core/bin/arg-contract.test.mjs,
  cadence-core/bin/planning/trace.mjs, cadence-core/bin/trace.test.mjs
- **Action:** Start at the `'trace close'` row in `CONTRACTS`
  (`cadence-core/bin/lib/arg-contract.mjs`), the shared `append|close` body in
  `cmdTrace` (`cadence-core/bin/planning/trace.mjs`), and the test named `every
  flag in every row declares a complete grammar`
  (`cadence-core/bin/arg-contract.test.mjs`). Add one `--duration-ms` flag to
  that row and parse it in the shared `append|close` body beside the existing
  `--tokens` and `--turns` blocks, writing the parsed value onto the appended
  event under the key `duration_ms` - the same spelling the 231 `provider`
  events already on `.planning/trace.jsonl` use, so one reader parses one field
  name. The declared `type` must NOT be `int` (D-06): the host surfaces this
  figure as a formatted human string inside its `Done (N tool uses - X tokens -
  Ys)` line, and an `int` row refuses the only spelling an orchestrator can
  copy, stranding the worker in `unpaired` - the exact escalation the
  comma-stripping exception on `--tokens` in this same body exists to prevent.
  `TYPES` in `cadence-core/bin/lib/arg-contract.mjs` is the closed vocabulary to
  pick from. The grammar the BODY then applies: a plain non-negative integer is
  a millisecond count, and the host's formatted spelling is a sequence of
  number-plus-unit terms over hours, minutes, seconds and milliseconds,
  optionally space-separated, converted to an integer millisecond count.
  Anything outside that shape is a malformed CALL - refuse with nothing
  appended, the posture `--tokens` and `--turns` already state and for the
  reason they state it, because a dropped field renders the bracket
  duration-less while the caller believes a figure landed. Keep the grammar
  CLOSED to digits and unit letters rather than accepting free text: that is
  what keeps this flag out of `cadence-core/bin/lib/text-transport.mjs`'s
  `TEXT_FLAGS`, whose header already excludes `--tokens` on exactly this
  ground. Declare the row so the flag needs no entry in
  `cadence-core/bin/planning/core.mjs`'s `FLAG_SENTENCES` - `flagSentence`
  composes a sentence for any flag that map does not name, and adding a fifth
  hand-written sentence there would make the `trace-refusal-sentences` census's
  "four refusing trace flags" wording false. `--duration-ms` goes on the CLOSE
  row ONLY, exactly as `--turns` does: a flag row is a prose allowlist that
  never widens what a subcommand accepts. Re-pin the flag-entries census in the
  same commit - 189 to 190 (D-10; the roadmap's 185 -> 186 is wrong), leaving
  the top-level row count at 19.
- **Verify:** `node cadence-core/bin/test.mjs` is green with
  `arg-contract.test.mjs` asserting 190 flag entries across 19 rows; against a
  scratch `.planning` dir, `planning.mjs trace close --phase 2 --plan p --role
  cad-executor --duration-ms "1m 23s"` answers `ok:true` and the appended line
  carries `"duration_ms":83000`; `--duration-ms 4200` appends
  `"duration_ms":4200`; `--duration-ms later` answers `ok:false` and appends
  NOTHING (the file's line count is unchanged); a bare `--duration-ms` at the
  end of the line is refused.

### Task 2: A bracket carries the duration its close reported

- **Files:** cadence-core/bin/lib/trace.mjs, cadence-core/bin/trace.test.mjs
- **Action:** Start at `renderTrace` and the `TraceRender` typedef in
  `cadence-core/bin/lib/trace.mjs`. Carry a terminal event's `duration_ms` onto the `brackets[]` row
  `renderTrace` builds when the two halves are both in hand. Guard the read the
  way the `tokens` and `turns` reads beside it are guarded - a non-numeric or
  non-finite value on a hand-edited or foreign-producer line contributes NOTHING
  and is never string-concatenated onto anything. The key is OPTIONAL on the
  row, the shape `turns` already has and for its stated reason: `ms` and
  `tokens` are on every row because they can always be computed or nulled, while
  a bracket whose close carried no duration has no `duration_ms` key at all, so
  a record written before this flag existed renders byte-identically. Do NOT
  compute this quantity from the two timestamps: `ms` on the same row already
  derives dispatch-to-close wall clock, which INCLUDES orchestrator time and is
  a different quantity than the one the host reports for the dispatch itself
  (D-06). Update the `TraceRender` typedef's `brackets` entry so the new key is
  described where the other three are, and say there which of `ms` and
  `duration_ms` measures what - two elapsed figures on one row that nothing
  distinguishes is how a later reader picks the wrong one.
- **Verify:** `node cadence-core/bin/test.mjs planning` is green; a fixture
  trace holding a dispatch plus a close carrying `duration_ms` renders a
  `brackets[0].duration_ms` equal to that figure while `brackets[0].ms` still
  equals the timestamp difference and the two differ; a fixture whose close
  carries no duration renders a bracket row with no `duration_ms` key at all
  (`'duration_ms' in row` is false, not `=== null`).

### Task 3: Two closes of one dispatch render as one bracket

- **Files:** cadence-core/bin/lib/trace.mjs, cadence-core/bin/trace.test.mjs
- **Action:** Start at `renderTrace`'s terminal arm - the `seenTerminals` guard,
  the `pending.shift()` pairing and the `matched` block below them - and the
  `TraceRender` typedef, both in `cadence-core/bin/lib/trace.mjs`. Add the real
  dedup on the worker key `renderTrace` already builds
  - `corr`, `phase` and `plan` joined - so that a SECOND close of a dispatch
  that has already been paired is folded into the bracket the first one opened
  instead of creating a second row, consuming the next pending dispatch, or
  billing its figures again. The existing `seenTerminals` replay guard is NOT
  this and must stay: it keys on the millisecond as well, so a hook close and a
  hand-written close never collide on it, and the FIFO `pending.shift()` then
  hands the second close a different open dispatch (D-04; the accepted-cost
  paragraph in this function's own terminal arm names the fix as owed here).
  The rule, and it must hold in EITHER arrival order because neither writer may
  assume it ran first: the first terminal to find a pending dispatch for a
  worker key PAIRS and owns the row's identity; a later terminal for that same
  worker key that finds NO pending dispatch is a repeat close of that same row -
  it adds no bracket, no `unpaired` row and no second billing, its `tokens`,
  `turns` and `duration_ms` fill fields the row left empty, and its event name
  replaces the row's only when the row currently reads `return` and the repeat
  names `checkpoint` or `escalation`, never the reverse. That last clause is
  load-bearing: a figureless writer that always ran first would otherwise turn
  every checkpoint into a clean `return`, and `lib/trace.mjs`'s own header calls
  that the one arm the record exists to keep separate. Fund the role totals
  through the `funded` and `turnsFunded` flags already carried on the pending
  entry, so a dispatch closed twice is billed exactly once and a figure that
  arrived only on the second close still clears `unrecorded`. Leave TODAY's
  behaviour untouched for a terminal that never had a pending dispatch AT ALL -
  a close whose dispatch fell outside the `--phase` filter or above the read cap
  still bills its own role row and opens no bracket, because that is a different
  input from a repeat close and collapsing the two would drop figures the record
  currently keeps. A duplicated DISPATCH is deliberately still not folded in
  here, the boundary the replay guard's comment already draws.
- **Verify:** `node cadence-core/bin/test.mjs planning` is green, plus a new
  test that drives BOTH writers against one fixture dispatch - one close with no
  figures and one close carrying tokens, turns, a duration and a detail - and
  asserts: `brackets.length === 1`, that row carries all three figures and the
  `checkpoint` arm, `unpaired` is empty, and `roles.<role>` reads one dispatch,
  the token figure counted once and no `unrecorded`. The same fixture with the
  two closes written in the opposite order renders a deep-equal result. A third
  fixture holding dispatch, close, dispatch, close on ONE worker key still
  renders two brackets.

### Task 4: An open dispatch names the role it was opened under

- **Files:** cadence-core/bin/lib/trace.mjs, cadence-core/bin/trace.test.mjs,
  cadence-core/bin/trace-suggest.test.mjs,
  cadence-core/bin/window-budget.test.mjs
- **Action:** Start at `renderTrace`'s `unpaired` push and the `TraceRender`
  typedef in `cadence-core/bin/lib/trace.mjs`. Put the dispatched `role` on
  every `unpaired[]` row. The pending
  entry already carries it - the same value `brackets[]` rows expose as the
  billing authority - so this exposes a field the pairing already computed
  rather than deriving a second answer. It is the enabling read for CONTEXT
  D-03: PLAN-2's `SubagentStop` hook ADOPTS the newest unpaired dispatch for a
  role instead of deriving a worker key, and re-deriving `open` and
  `seenTerminals` in a second reader is how two readers of one record start
  disagreeing about which bracket closed - the reason this function exposes
  `brackets[]` in the first place. Additive only: no existing key moves or
  changes meaning. Update the `TraceRender` typedef's `unpaired` entry to
  describe the key. `cadence-core/bin/trace.test.mjs` holds at least one
  whole-array `deepEqual` over `unpaired`; repair those expectations rather than
  loosening the assertion, since the whole-array comparison is what makes the
  row shape a pinned fact.
- **Verify:** `node cadence-core/bin/test.mjs` is green; against this
  repository's own record, `planning.mjs trace render --phase 2` lists a `role`
  on every entry of `unpaired`, and a fixture whose dispatch carried no `--role`
  renders that row with the empty-string role rather than dropping the key - a
  forgotten flag stays visible instead of vanishing.

### Task 5: State the host-return dependency where a reader finds it

- **Files:** cadence-core/references/seam-spawn-agent.md,
  cadence-core/config.schema.json,
  cadence-core/bin/weight-budgets.json
- **Action:** Start at the window-CEILING bullet and the bracket rule in
  `cadence-core/references/seam-spawn-agent.md`, and at the six
  `workflow.max_dispatch_tokens.<role>` purposes in
  `cadence-core/config.schema.json`. In `references/seam-spawn-agent.md` - the cold spawn-agent branch
  of the `seams.md` router, NOT `seams.md`, which is 2,323 B since phase 1 and
  carries none of this (D-13) - state the standing exposure the bracket system
  rests on: the three figures Cadence reads off a subagent return are the token
  count, the tool-use count and the duration; the bracket system, the six
  `workflow.max_dispatch_tokens` keys and `cadence-core/bin/weight-budgets.json`
  each depend on one or more of them; Anthropic can change that rendering with
  no deprecation; and the mitigation is the recovery ALREADY IN FORCE, not new
  work - a figureless return omits `--tokens` rather than sending `0`, and the
  renderer keeps `unrecorded` distinct from a recorded zero. Put it where the
  window-CEILING bullet and the bracket rule already are, so a reader arriving
  for either one meets it. In the same pass, extend the bracket rule's ONE
  statement of the close line - the paragraph that already ends "This paragraph
  is the ONE statement of that rule; dispatch sites point here rather than
  restating it" - to name `--duration-ms` beside `--tokens` and `--turns`, with
  the same omit-rather-than-zero rule the other two carry. Then correct
  `config.schema.json`: all six `max_dispatch_tokens` purposes end
  "references/seams.md carries the argument", which phase 1 moved to
  `seam-spawn-agent.md`, so a reader following that citation today lands on a
  45-line router with no argument in it (D-14). `references/config-reach.md` is
  correct and is NOT edited. Re-pin `weight-budgets.json`'s
  `cadence-core/references/seam-spawn-agent.md` entry (19863 today) to the
  measured post-edit byte count in this same commit - the budget check is a
  ceiling and growth without a re-pin is a `budget-overrun`, exactly as
  `review-triggers.md` was in phase 1 (D-12).
- **Verify:** `grep -n 'seams\.md' cadence-core/config.schema.json` returns no
  hit inside the six `max_dispatch_tokens` purposes;
  `node cadence-core/bin/self-verify.mjs` reports `ok:true` with no
  `budget-overrun`; `node cadence-core/bin/weight.mjs` reports
  `cadence-core/references/seam-spawn-agent.md` at exactly the byte figure
  `weight-budgets.json` now pins; a reader opening `seam-spawn-agent.md` can
  name all three return figures, the code depending on each, and the two-part
  recovery without opening another file.

## Notes

**The plan is split, and the two halves are NOT independent.** CONTEXT's `Plan
shape` directive asks for multiple plans in this phase and orders them - the
documentation, dedup and duration groundwork before the hook writer and its pin.
This plan honours that ordering, but the slices SHARE files
(`cadence-core/references/seam-spawn-agent.md`,
`cadence-core/bin/weight-budgets.json`, `cadence-core/bin/lib/arg-contract.mjs`
and `cadence-core/bin/arg-contract.test.mjs`), so they are sequential and must
never be routed into separate worktrees. The split is for capacity and ordering,
not for parallelism.

**Census holders declared but not expected to change.**
`cadence-core/bin/planning/trace.mjs` sits under the `subjects` of four
registered censuses, so `check_census` requires their holders in this lease:
`cadence-core/bin/trace.test.mjs` (`trace-refusal-sentences`),
`cadence-core/bin/planning-lease-check.test.mjs` (`planning-detail-sites`),
`cadence-core/bin/phase-spelling.test.mjs` (`phase-spelling-callsites`) and
`cadence-core/bin/self-verify.test.mjs` (`self-verify-merge-layers`). Task 1
should move none of those counts - it adds no error-detail site, no phase
argument, no `mergeLayers` callsite and no fifth refusal sentence - but each is
declared so a count that DOES move can be re-pinned in the same commit instead
of forcing a lease amendment mid-run.
`cadence-core/bin/trace-suggest.test.mjs` and
`cadence-core/bin/window-budget.test.mjs` are declared for the same reason: both
read `brackets[]` rows, and tasks 2 and 4 add keys to those rows.

**What this plan deliberately leaves undone, for the human to decide.** Ten of
the eleven shipped `trace close` command lines in
`cadence-core/workflows/` and `cadence-core/references/` spell out
`--tokens <...> --turns <...>` verbatim. This plan updates the ONE STATEMENT of
that rule in `seam-spawn-agent.md` and PLAN-2 updates
`workflows/execute.md`'s line, but the other nine literal lines
(`plan.md` twice, `context.md`, `verify-deep.md`, `decision-review.md`,
`minimalism-review.md`, `review-triggers.md`, `plan-revision.md` twice) still
show a close without `--duration-ms`, so an orchestrator copying one of those
lines verbatim records no wall clock for that role. Sweeping all nine was left
out because CONTEXT's scope boundary says "one `--duration-ms` flag on `trace
close`" and D-12 enumerates only `seam-spawn-agent.md`, `execute.md`,
`conventions.md` and `seams.md` as the budgeted surfaces this phase touches - a
nine-file prose sweep is more than the decisions state. `workflows/task.md`'s
`cad-task` close is correctly excluded either way: there is no subagent return
behind it to read a duration off, which is the same reason it carries no
`--tokens` today (D-05).
