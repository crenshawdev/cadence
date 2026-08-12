---
phase: 1
plan: 1
requirements:
  - TRC-01
files:
  - cadence-core/bin/lib/trace.mjs
  - cadence-core/bin/lib/trace-suggest.mjs
  - cadence-core/bin/planning.mjs
  - cadence-core/bin/self-verify.mjs
  - cadence-core/bin/trace.test.mjs
  - cadence-core/bin/trace-suggest.test.mjs
  - cadence-core/bin/fixtures/verbatim.trace.jsonl
  - cadence-core/bin/weight-budgets.json
  - cadence-core/workflows/report.md
  - cadence-core/workflows/context.md
  - cadence-core/workflows/plan.md
  - docs/EVIDENCE.md
---

# Phase 1: The accounting the trace still misses - Plan 1 (TRC-01)

## Goal

The run record prices the coordinator as well as its workers: a per-step
coordinator marker reaches `.planning/trace.jsonl`, carries only what the
coordinator can know, and is read by `/cad-report` and `trace suggest` without
changing what either says about a trace written before this phase.

## Must be true when done

- `trace render` over a trace carrying coordinator markers lists each one in
  `events[]` as a lifecycle event naming the step it marks, and no marker
  written anywhere in this tree carries a token figure.
- `trace render` and `trace suggest` over the committed verbatim fixture report
  the same `counts`, `roles`, `unpaired` and suggestion list they report today.
- `trace suggest` returns a coordinator entry for a render whose markers put the
  residue above its floor, and `suggestFromRender(render([]))` is still `[]`.
- `/cad-report` on a phase whose trace carries markers names the coordinator-side
  residue on its record-health line, and says nothing about residue for a phase
  whose trace has none.
- Running `/cad-context` or `/cad-plan` on a phase leaves one `lifecycle`
  `coordinator` event per step those workflows ran, alongside the worker
  brackets already there.
- `node cadence-core/bin/self-verify.mjs` and
  `node --test cadence-core/bin/trace.test.mjs` are green on every commit in this
  plan, with no `unknown-flag`, no `budget-overrun`, and the producer census
  admitting the new lifecycle name.

## Context

Locked by `phases/1/CONTEXT.md`: the marker is a fifth EXPORTED lifecycle name,
never a fifth family (D-02); it carries no token figure ever (D-03) and no
`--role` at all (D-07); the residue is wall span minus paired bracket spans
(D-01); a trace with no markers gains no suggestion (D-06); "record health" is
prose composed in `report.md`, not an object the renderer emits (D-05); the
per-phase rollup never groups on `corr` alone (D-04); the verbatim trace is
committed unredacted as a fixture (D-12); a new `trace append` flag joins
self-verify's flag-lint table in the same commit (D-15); a budget row is re-pinned
in the commit whose prose exceeds it (D-16); and the per-file bracket census
counts written prose, so both close arms must survive any edit (D-14).

Out of this plan: the four open `trace.mjs` defects CAPTURE.md records, any
computed spend gate (that is Plan 2), and any fifth event family.

## Tasks

### Task 1: Add the coordinator marker to the lifecycle vocabulary and the append seam

- **Files:** cadence-core/bin/lib/trace.mjs, cadence-core/bin/planning.mjs, cadence-core/bin/self-verify.mjs, cadence-core/bin/trace.test.mjs
- **Action:** Export a fifth lifecycle name from `cadence-core/bin/lib/trace.mjs`
  beside `DISPATCH`, `TERMINAL` and `ANCHOR`, with the value `coordinator`
  (D-02). The literal name is the planner's call per CONTEXT's flagged
  assumption: `coordinator` names the ACTOR and so cannot collide with a future
  worker-side event, where the alternative `step` plausibly could. Document it in
  the header idiom the other three use: it opens nothing, closes nothing, pairs
  with nothing, and never carries `--role` or `tokens`. Do NOT add a branch to
  `renderTrace`'s per-role accounting for it - the existing
  `if (e.event === DISPATCH) ... else if (TERMINAL.includes(e.event))` chain
  already leaves any other lifecycle event alone, and a branch that keyed the
  empty-string role would render a nameless worker row through
  `workflows/progress.md` (D-07). Add `--step` to `trace append` in
  `cadence-core/bin/planning.mjs`: one verbatim non-empty string stored on the
  event, REFUSED as `bad-args` when the flag is present but bare or blank - the
  same refusal `--read` makes at its own site and for the same reason, since a
  marker naming no step is a complete-looking event that defeats the per-step
  attribution the marker exists for. Keep the arm's stated event-agnostic
  contract intact: no flag becomes coupled to an event NAME, so D-03 is held by
  prose and by the census assertion below rather than by a runtime refusal.
  Update the `trace append` flag list in planning.mjs's own header usage block,
  which enumerates every flag today. Add `--step` to
  `CONTRACTS['planning.mjs']['trace append']` in `self-verify.mjs` in this same
  commit (D-15) - check 2 reports `unknown-flag` on the first prose line using
  it. In `trace.test.mjs`'s census, admit the new name in the `known` array built
  from `ANCHOR`, `DISPATCH` and `TERMINAL`; exempt it from the per-event `--role`
  assertion exactly as `ANCHOR` is exempted; and add an assertion that no prose
  `trace append` line writing this event carries `--tokens`, which is AC2's
  static half.
- **Verify:** `node --test cadence-core/bin/trace.test.mjs` and
  `node cadence-core/bin/self-verify.mjs` both exit 0. In a scratch directory,
  `node cadence-core/bin/planning.mjs --dir <tmp>/.planning trace append --phase 1
  --family lifecycle --event coordinator --step analyze` returns `written:true`,
  and `trace render --phase 1` on that directory shows the event in `events[]`
  with `"family":"lifecycle"`, `"event":"coordinator"`, `"step":"analyze"`, no
  `tokens` key, and no `roles` key in the envelope. The same append with a bare
  `--step` (no value) returns `ok:false` with reason `bad-args`.

### Task 2: Commit verbatim's trace as a fixture and pin today's reader output against it

- **Files:** cadence-core/bin/fixtures/verbatim.trace.jsonl, cadence-core/bin/trace.test.mjs, cadence-core/bin/trace-suggest.test.mjs, docs/EVIDENCE.md
- **Action:** Copy `/data/code/verbatim/.planning/trace.jsonl` byte-for-byte to
  `cadence-core/bin/fixtures/verbatim.trace.jsonl` - unredacted, all 40 lines
  spanning that project's phases 1 and 2 (D-12). It goes under
  `cadence-core/bin/` deliberately: `weighAll` measures `agents/`, `skills/`,
  `cadence-core/{workflows,references,templates}` only, so a fixture there needs
  no `weight-budgets.json` row and cannot trip `unbudgeted-surface`, while the
  same file under `references/` would. Then pin what the two readers say about it
  TODAY, before any later task in this plan touches them: in `trace.test.mjs`, a
  test that copies the fixture into a temp planning root and asserts the exact
  `counts`, `roles`, `unpaired` and `capped` of `renderTrace(dir, '1')`; in
  `trace-suggest.test.mjs`, a test that runs `suggestFromRender` over that same
  render and asserts the exact suggestion list. Write the measured values as
  literals, not as expressions recomputed from the fixture - a self-comparing
  assertion proves nothing. These two tests are AC1's guard and must pass
  UNCHANGED through tasks 3-6. Correct the falsified passage in
  `docs/EVIDENCE.md`'s "What this file does not carry" section: the 2026-08-09
  sentence claiming no project on this machine but Cadence has a `trace.jsonl` is
  now false, so state what is true instead - verbatim's two-phase record is
  committed at the fixture path, unredacted, as the calibration input for the
  trace readers - and leave the separate EVD-01 position (a publishable export is
  still deferred, the raw file still stays out of a project's git) standing.
- **Verify:** `node --test cadence-core/bin/trace.test.mjs
  cadence-core/bin/trace-suggest.test.mjs` exits 0;
  `diff /data/code/verbatim/.planning/trace.jsonl
  cadence-core/bin/fixtures/verbatim.trace.jsonl` prints nothing;
  `grep -c "none has a trace.jsonl" docs/EVIDENCE.md` prints 0.

### Task 3: Compute the per-step coordinator residue in renderTrace

- **Files:** cadence-core/bin/lib/trace.mjs, cadence-core/bin/planning.mjs, cadence-core/bin/trace.test.mjs
- **Action:** `renderTrace` gains a `coordinator` block, present ONLY when the
  scoped events carry at least one marker and absent otherwise, so a trace
  written before this phase renders exactly as it did (AC1). The arithmetic is
  D-01's, unchanged - a window's wall span minus the paired bracket spans inside
  it - but it is computed ONCE here rather than in each reader: CONTEXT's third
  flagged assumption leaves that site to the planner and names the cost of the
  other choice ("the two readers compute the residue independently and drift"),
  so `/cad-report` and `trace suggest` both read this one number and cannot
  disagree. Shape: totals `wall_ms`, `bracket_ms`, `residue_ms`, plus `steps[]`
  of `{phase, step, ts, residue_ms}` in time order. Rules, each load-bearing:
  partition events by PHASE key and order by `ts`, never grouping on `corr` - a
  marker written before `phase_start` takes the phase-only id (D-04), so a
  corr-keyed rollup reports the coordinator twice; a step's window runs from its
  marker's `ts` to the next marker's `ts` in the same phase, and the last
  marker's window ends at that phase's last event; bracket spans come from the
  pairing `renderTrace` already performs, so an UNPAIRED dispatch contributes no
  span at all (the fixture's 12:24:57 `cad-reviewer` dispatch is exactly that
  case); overlapping bracket intervals are merged into a union before
  subtraction, so two workers running at once cannot subtract the same wall time
  twice; each window's residue is floored at zero; and an event whose `ts` is
  absent or unparseable contributes nothing and never puts NaN into a total.
  Extend the `TraceRender` typedef with the block. In `planning.mjs`'s
  `trace render` arm, emit `coordinator` conditionally the way `roles` is emitted
  today. Tests: two markers bracketing one paired dispatch of known length; a
  marker before `phase_start` joining the same phase's stream across both corr
  ids; overlapping brackets subtracted once; an unpaired dispatch subtracting
  nothing; and the committed fixture producing no `coordinator` key at all.
- **Verify:** `node --test cadence-core/bin/trace.test.mjs` exits 0, including a
  case where two markers 10 minutes apart span one paired 4-minute bracket and
  that step's `residue_ms` is 360000; the task-2 fixture tests still pass with no
  edit; and `trace render --phase 1` over a temp copy of the fixture emits no
  `coordinator` key.

### Task 4: trace suggest reads the coordinator block

- **Files:** cadence-core/bin/lib/trace-suggest.mjs, cadence-core/bin/trace-suggest.test.mjs
- **Action:** Add one rule over `render.coordinator`, in the file's existing
  numbered-rule idiom and after R5, plus its evidence floor as a new exported
  `MIN_*` constant beside the four already there. It emits `kind: 'info'` with
  `action: null` and subject `coordinator`, evidence naming the residue and the
  step carrying the largest share of it, drawn from the render's own figures -
  `action` is null because no `config.schema.json` key governs coordinator spend
  and this file's own test refuses an action naming a key the schema lacks. The
  rule is SILENT when the render carries no `coordinator` block at all - never an
  "absent coordinator record" line (D-06) - and silent below its floor, so the
  existing `suggestFromRender(render([]))` deep-equality assertions and the
  fixture's pinned list keep passing untouched. Extend the `RenderLike` typedef
  with the optional block; the test helper builds `{counts, roles, events}`, so
  the rule must tolerate the key being absent rather than assuming it.
- **Verify:** `node --test cadence-core/bin/trace-suggest.test.mjs` exits 0 with
  new cases proving: a render whose coordinator residue is above the floor yields
  exactly one entry naming the top step; one below the floor yields none; a render
  with no `coordinator` key yields none; `suggestFromRender(render([]))` still
  deep-equals `[]`; and the task-2 fixture suggestion list is unchanged.

### Task 5: /cad-report's record-health line reports the residue

- **Files:** cadence-core/workflows/report.md, cadence-core/bin/weight-budgets.json
- **Action:** In `read_record`, add `coordinator` to the list of render fields
  the rest of the workflow reads. In `compose`, the `Record health:` line reports
  the coordinator-side residue - the total and the step that carried the most -
  when the render carries the block, and says nothing about residue when it does
  not (AC3). Add to that step's Rules that the residue is the render's own figure,
  reported as given and never recomputed in prose, and that a coordinator marker
  carries no token figure, so this is TIME the coordinator spent between
  brackets, never tokens (D-03). Keep the health line prose composed here - the
  renderer emits no health object and this phase does not add one (D-05). Re-pin
  `cadence-core/workflows/report.md` in `weight-budgets.json` in this same commit
  to the new measured byte count: the row is at zero headroom today (3,065 B) and
  the budget check is a ceiling, so it fails on the commit that introduces the
  growth (D-16).
- **Verify:** `node cadence-core/bin/self-verify.mjs` exits 0 with no
  `budget-overrun` and no `unbudgeted-surface`; `grep -n "coordinator"
  cadence-core/workflows/report.md` shows it named in both `read_record` and the
  `Record health` line. human-verify (AC3): run `/cad-report 1` in a project whose
  phase-1 trace carries markers and observe a coordinator residue on the record
  health line, then `/cad-report` on a phase whose trace has none and observe no
  residue mentioned.

### Task 6: The coordinator writes a marker at each step it can name

- **Files:** cadence-core/workflows/context.md, cadence-core/workflows/plan.md, cadence-core/bin/weight-budgets.json
- **Action:** Add ONE standing instruction to each of these two workflows,
  immediately after the opening `<process>` tag, stating that at the start of
  every step below - from the step where the phase number is known onward, since
  `trace append` requires `--phase` - the coordinator appends one marker naming
  that step, and carrying the step name and nothing else: no `--role`, no
  `--tokens`, ever (D-03, D-07). Write the seam line once per file in the fenced
  form the other appends use, with `--family lifecycle --event coordinator --step
  <this step's name>`. One WRITTEN line per file, executed once per step at
  runtime - do not add a per-step append line, which would multiply the prose by
  the step count in the two files with the least budget headroom in the tree.
  Producer set is these two files ONLY: CONTEXT prices exactly `report.md`,
  `plan.md` and `context.md` (D-16), and the largest coordinator gap the fixture
  measures - 38.7 minutes at the analyzer return to the planner dispatch - falls
  on the boundary these two own. Do NOT add the instruction to `execute.md`,
  `verify.md` or the two references in the census's `BRACKETING` map; that
  extension is named for the human in this plan's Notes, not built here. Nothing
  in either file's bracketing may move: `context.md` must still carry 1
  `--bracket-read`, 1 `--event return` and 1 `--event checkpoint`, and `plan.md`
  2 of each, or the per-file census fails (D-14). Re-pin both files'
  `weight-budgets.json` rows in this commit - `plan.md` is at zero headroom and
  `context.md` at 651 B (D-16).
- **Verify:** `node --test cadence-core/bin/trace.test.mjs` exits 0 - the census
  accepts the new producer lines, and the per-file bracket counts are unchanged;
  `node cadence-core/bin/self-verify.mjs` exits 0 with no `unknown-flag` and no
  `budget-overrun`; `grep -c "event coordinator" cadence-core/workflows/context.md
  cadence-core/workflows/plan.md` prints 1 for each file.

## Notes

- Plan shape: CONTEXT directs multiple plans in this phase, trace half first.
  Honored, with the deviation recorded: PLAN-1 and PLAN-2 SHARE
  `cadence-core/workflows/context.md` and `cadence-core/bin/weight-budgets.json`,
  so they are SEQUENTIAL (PLAN-1 then PLAN-2), not the independent slices a
  parallel split needs. `plan-overlap` will report the shared paths and
  `/cad-execute` will route sequential, which is the intended shape here - the
  split exists to keep each plan inside the task ceiling and to land the trace
  half green before the gate half restructures the `analyze` step.
- Two CONTEXT flagged assumptions are settled by this plan and recorded here so
  the choice is visible: the marker's literal name is `coordinator` (task 1), and
  the residue is a computed RENDER field rather than arithmetic each reader does
  for itself (task 3). The marker EVENT still carries nothing computed, which is
  what D-01 binds.
- For the human, not built here: markers ride `context.md` and `plan.md` only, so
  `/cad-report` prices the coordinator's time across `/cad-context` and
  `/cad-plan` and reports nothing for the `/cad-execute` and `/cad-verify` half of
  a phase - which on the fixture is a further ~18 minutes between the reviewer
  return and the verifier resolve. Extending the standing instruction to
  `execute.md` and `verify.md` is one line each plus two budget re-pins, and it is
  outside the surfaces CONTEXT priced.
