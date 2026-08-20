---
phase: 2
plan: 2
requirements:        # none seeded for v3.5.6 - planned against CONTEXT.md AC1-AC7, see PLAN-1 Notes
files:
  - cadence-core/bin/planning.mjs
  - cadence-core/bin/lib/arg-contract.mjs
  - cadence-core/bin/arg-contract.test.mjs
  - cadence-core/bin/trace.test.mjs
  - cadence-core/references/review-triggers.md
  - cadence-core/references/triage-gate.md
  - cadence-core/workflows/report.md
  - cadence-core/bin/adjudication-record.test.mjs
  - cadence-core/bin/prose-agreement.test.mjs
  - cadence-core/bin/weight-budgets.json
---

# Phase 2: The adjudication record nobody can recount - Plan 2 (the recount and the render)

## Goal

The survivor count stops being asserted. Counting the record's rulings reproduces
the figure on the fire's trace event, a disagreement between the two is visible
rather than silent, and `/cad-report` renders its Gates line from the record -
reporting a fire with no record as unrecorded instead of narrating a number it
cannot recompute.

## Must be true when done

- `trace append --family outcome` accepts `--survivors`, `--downgraded` and
  `--refuted` as structured non-negative integers, stores each on the event, and
  omits the key entirely when the flag was absent - so a fire nobody counted
  stays distinguishable from one that counted zero.
- A malformed value on any of the three appends NOTHING, the way `--raised` and
  `--turns` already refuse, rather than appending with the field dropped.
- The receipt that SETTLES a fire carries those three figures - the adjudicated
  arm's `adjudication` receipt and the blocking arm's `gate_pass` and `override`
  receipts - with the numbers the record seam derived, never a hand count and
  never a figure folded into `--detail`.
- `rearm` gains nothing: it marks a round, it settles no rulings.
- Counting the rulings in a record reproduces the counts on its fire's trace
  event, and flipping one entry's ruling makes the two disagree.
- `/cad-report <N>` renders its Gates line from the record when one exists, names
  a disagreement between the counted rulings and the event's figures rather than
  silently preferring one side, reports a fire with no record as unrecorded, and
  synthesizes nothing for a phase predating the format.
- `/cad-report`'s Refuted line still reads SUMMARY deviations, unchanged.
- `node cadence-core/bin/self-verify.mjs --root .` returns `ok:true` with an
  empty `problems` array at every commit in this plan, and
  `prose-agreement.test.mjs`'s GAT-04 still collects exactly four outcome event
  names.

## Context

Locked by `.planning/phases/2/CONTEXT.md`: D-01 the counts are DERIVED by
counting rulings and written to the trace through new structured flags mirroring
`--raised`, so the recount compares two independent artifacts; D-10 the
`/cad-report` edit lands on the Gates line and NOT the Refuted line, which
consumes SUMMARY deviations and is unrelated to gate findings; D-11 the prose
edits force a same-commit `weight-budgets.json` re-pin and no FIFTH fenced
`trace append --family outcome` event name; D-12 a flag needs its `CONTRACTS`
row before prose may use it. Out, deliberately: tightening `parseAdjudication`
in `cadence-core/bin/lib/trace-suggest.mjs` - its own D-03 forbids it, so the 25
detail spellings and the parse failures stay live and this phase routes around
them. RUNS AFTER PLAN-1, which writes the record and exports the count
derivation this plan runs; the two share six files and `plan-overlap` will report
the overlap, which routes execution sequential.

## Tasks

### Task 1: Give `trace append` the three structured count flags

- **Files:** cadence-core/bin/lib/arg-contract.mjs (its `trace append` row), cadence-core/bin/planning.mjs (the shared `append|close` body in `cmdTrace`), cadence-core/bin/trace.test.mjs
- **Action:** D-01/AC4. Declare `--survivors`, `--downgraded` and `--refuted` on
  the `trace append` row - `required: false`, type `int`, `refuse` on both the
  value and the bare axis, exactly as `--raised` is declared - and carry the
  row's stated reason: the flag row is what makes a structured flag the only
  route, because `--detail` is not a machine-join surface. Then read them in the
  shared body beside `--raised`, validated the same way through `requireInt`: a
  negative or non-integer value is a malformed CALL and NOTHING is appended,
  never a best-effort append with the field dropped, because a dropped figure
  reads downstream as unknown while the caller believes a count landed. No
  comma-grouping exception, for the reason the `--raised` and `--turns` comments
  both give - a finding count is never printed grouped, so accepting `1,234`
  would only widen what can be mistyped. Each key is OMITTED from the event when
  its flag was absent and a real `--survivors 0` still records a 0, the same
  distinction the `--turns` spread already states. Keep all three OFF the
  `trace close` row for the reason `--raised` is off it: a flag row never widens
  what a subcommand accepts. Do NOT touch `parseAdjudication` in
  `cadence-core/bin/lib/trace-suggest.mjs` - CONTEXT puts it out of scope and its
  own D-03 records that a tighter reader drops the historical fires on disk.
  Declare `--round` on the same row - `required: false`, type `int`, default 1,
  refused the same way - and store it on the event. It is not decoration: PLAN-1
  writes a capped re-arm's record at `...-<discriminator>-r<round>.json`, so a
  receipt that cannot name its round resolves the ROUND-1 filename and checks a
  round-2 settle against round one's stale rulings, passing whenever the two
  counts happen to coincide. The receipt names the round it settles.
  Then CHECK the three against the record rather than storing whatever the
  caller typed (AC4). When all three flags are present and the call carries
  `--trigger` and `--sha` (plus `--plan <k>` on a per-plan fire), resolve the
  D-06 record path for that fire AT THE ROUND the call names - `--round` absent
  meaning round 1, exactly as it does on the write side, so the two sides
  resolve one filename by one rule - and, when a record IS there, recount its
  rulings through the count function PLAN-1 task 1 exports: a figure that
  disagrees is a malformed CALL refused `ok:false` naming the flag, the stored
  figure and the recounted one, with NOTHING appended to the trace file. Absent
  record - a fire predating the format, or an advisory arm that wrote none -
  omits the check and stores the flags as given; the check is a cross-artifact
  guard, never a requirement that a record exist. This is what makes AC4's
  property hold AT WRITE TIME rather than only under task 4's after-the-fact
  recount: the coordinator composes this line by hand from the seam's envelope,
  and a mistyped survivor count that only a later test catches has already
  shipped on the fire's own record.
- **Verify:** `node --test cadence-core/bin/trace.test.mjs` passes with cases
  showing each of the three stored on the appended event, a bare flag and a
  non-integer value each refused `ok:false` naming the flag with NOTHING appended
  to the trace file, an absent flag omitting the key, and `--survivors 0`
  recording a zero. Plus the cross-check, built on a real record the PLAN-1 task
  2 subcommand wrote into a fixture tree: counts matching its rulings append
  normally; a `--survivors` one higher than the record's rulings is refused
  `ok:false` naming both figures with the trace file byte-identical afterwards;
  and the same call against a fire with no record on disk appends and stores the
  flags. Plus the re-arm case, which is what makes the round flag load-bearing:
  with a round-1 and a round-2 record on disk carrying DIFFERENT rulings,
  `--round 2` with round two's counts appends, and the same counts WITHOUT
  `--round` are refused against round one's - so a round that resolves the wrong
  record reddens rather than passing on a coincidence.
  `node --test cadence-core/bin/arg-contract-adoption.test.mjs`
  passes - it spawns the real binary for every declared refusal on the widened
  row. `node cadence-core/bin/self-verify.mjs --root .` returns `ok:true` with
  `problems: []`.

### Task 2: Make the settle receipts carry the derived counts

- **Files:** cadence-core/references/review-triggers.md (its `adjudication` receipt), cadence-core/references/triage-gate.md (its `gate_pass` and `override` receipts), cadence-core/bin/weight-budgets.json (both rows)
- **Action:** Add the three flags to the fenced receipt lines that SETTLE a fire
  and to nothing else. The adjudicated arm's `adjudication` line in
  `review-triggers.md`; the `gate_pass` and `override` lines in `triage-gate.md`,
  which are the blocking arm's two settle points and are alternatives to each
  other at the same moment. The `rearm` line gains nothing: it marks a round and
  settles no rulings, so a count there would describe a fire still in flight.
  Add `--round` to the SAME lines, in the same edit: a settle after a capped
  re-arm is settling round two, and `triage-gate.md`'s own re-arm cap is the
  thing that makes a second round possible, so a receipt there that names no
  round points the task-1 cross-check at round one's record. State at both files
  that it is omitted on an ordinary fire and carries the round on a re-armed one.
  State in one clause at each file that the figures are the ones the record seam
  DERIVED and returned - never a number the coordinator counted by hand, and
  never folded into `--detail`, the slot both files already condemn for exactly
  this, since a figure parsed back out of free text is as trustworthy as the
  voice-list substitution that condemned it. Keep every existing flag on all four
  fenced lines: `prose-agreement.test.mjs`'s GAT-04 asserts each carries
  `--trigger --plan --base --sha` and that the collected event list deep-equals
  exactly `adjudication`, `gate_pass`, `override`, `rearm`, so a fifth name or a
  dropped flag reddens it (D-11). Re-pin BOTH surfaces' rows in
  `cadence-core/bin/weight-budgets.json` in this same commit (AC7) - both sit at
  their ceilings with zero headroom - taking the figures from
  `node cadence-core/bin/weight.mjs --root .`.
- **Verify:** `node --test cadence-core/bin/prose-agreement.test.mjs` passes with
  GAT-04 green. `node cadence-core/bin/self-verify.mjs --root .` returns
  `ok:true` with `problems: []`, which is what proves task 1's row landed first -
  check 2 reports `unknown-flag` against prose whose flag has no row. `grep -n
  'family outcome' cadence-core/references/review-triggers.md
  cadence-core/references/triage-gate.md` shows `--survivors`, `--downgraded` and
  `--refuted` on the `adjudication`, `gate_pass` and `override` lines and on
  neither the `rearm` line nor any `trace close`.

### Task 3: Render the Gates line from the record

- **Files:** cadence-core/workflows/report.md (its `read_record` artifact list and its `compose` shape block), cadence-core/bin/weight-budgets.json (its report.md row)
- **Action:** D-10/AC6, on the Gates line and nowhere else.
  (a) The `read_record` step's scoped-artifact list opens
  `.planning/phases/<N>/REVIEW-*.md`; that glob cannot match a `.json` sibling,
  so add the record file to that list, keeping the list's existing
  each-at-most-once rule and its "do not re-read the trace file - the render is
  the reader" sentence untouched.
  (b) The Gates line renders from the record when one exists: the fire's rulings
  COUNTED, and that count compared against the structured counts already on the
  `outcomes` event, with a disagreement NAMED rather than silently resolved to
  one side. That comparison of two independent artifacts is the whole of what
  D-01 bought, and it is the only thing that makes a tampered record visible -
  `.planning/trace.jsonl` is gitignored, so custody rests on the committed record
  and the trace is the local cross-check.
  (c) A fire with NO record reads as unrecorded. Never synthesize an entry and
  never narrate a count that cannot be recomputed: earlier phases kept counters
  rather than bodies, so a phase predating the format has nothing faithful to
  reconstruct from and says so, in the same voice this step already uses for a
  `coordinator` block that is absent.
  (d) The Refuted line is NOT touched: it consumes SUMMARY deviations that
  corrected a D-NN and has nothing to do with gate findings (D-10). Leave the
  `outcomes`-sourced fields it already reads - `raised`, `trigger`, `plan`,
  `base`, `sha`, `detail` - exactly as they are; only the finding BODIES need the
  new file.
  Keep this step's read-back bound: every line pulls the ONE field it needs, so
  the record is read as the phase artifact the list prescribes and never dumped
  whole into the transcript. Re-pin report.md's row in the same commit (AC7) - it
  sits at exactly its 15101-byte ceiling.
- **Verify:** `node cadence-core/bin/self-verify.mjs --root .` returns `ok:true`
  with `problems: []` and `node cadence-core/bin/test.mjs prose` passes.
  `grep -n 'ADJUDICATION' cadence-core/workflows/report.md` shows the record in
  the `read_record` artifact list and named on the Gates line; `grep -n
  '^Refuted:' cadence-core/workflows/report.md` shows that line still sourced
  from SUMMARY deviations and otherwise byte-unchanged. human-verify (needs a
  live fire this executor cannot make): `/cad-report 2` after a real fire shows a
  Gates line whose survivor count came from the record, and `/cad-report 1` -
  a phase predating the format - shows its fires as unrecorded rather than
  narrated.

### Task 4: Pin the recount and the render rule with tests

- **Files:** cadence-core/bin/adjudication-record.test.mjs (the file PLAN-1 task 1 created), cadence-core/bin/prose-agreement.test.mjs
- **Action:** Two assertions, one per artifact this plan changed.
  (a) THE RECOUNT (AC4), against the count function PLAN-1's
  `cadence-core/bin/lib/adjudication-record.mjs` exports: counting the rulings of
  a record reproduces the three figures a fixture outcome event carries; flipping
  ONE entry's ruling changes the recomputed count so the two artifacts no longer
  agree; and that disagreement is decidable from the record and the event alone,
  with no third source. Build the record fixture as the SEAM's own output rather
  than by hand - run the subcommand PLAN-1 task 2 added against a fixture tree
  and read back what it wrote - so the test cannot pass against a shape the seam
  never writes, which is the failure `design-brief.test.mjs` was cited for at the
  `v3.2.0` audit.
  (b) THE RENDER RULE, as a prose-agreement test over
  `cadence-core/workflows/report.md` asserting AC6's three clauses: the Gates
  line reads the record, it states the unrecorded arm for a fire with no record,
  and the Refuted line still names SUMMARY deviations. Follow this file's own
  discipline - read the named region by its own anchor rather than by the shape
  of the prose around it, reusing the `doc` and `sentenceAround` helpers, so a
  rewrap stays green while a revert of either clause reddens.
- **Verify:** `node --test cadence-core/bin/adjudication-record.test.mjs` and
  `node --test cadence-core/bin/prose-agreement.test.mjs` both pass.
  Falsifiable in both directions, checked by hand and then restored: flip one
  ruling in the recount fixture and the case reports the disagreement rather than
  agreeing; delete the unrecorded clause from
  `cadence-core/workflows/report.md` and the prose test FAILS; restore both and
  `node cadence-core/bin/test.mjs prose planning` passes on the restored tree.

## Notes

- **Runs after PLAN-1, sequentially.** The two plans share
  `cadence-core/bin/planning.mjs`, `cadence-core/bin/lib/arg-contract.mjs`,
  `cadence-core/references/review-triggers.md`,
  `cadence-core/references/triage-gate.md`,
  `cadence-core/bin/adjudication-record.test.mjs` and
  `cadence-core/bin/weight-budgets.json`, so `plan-overlap` reports overlaps and
  `execute.md`'s choose_path routes sequential. That is the intended shape, not a
  defect: task 4 imports the count function PLAN-1 exports, and task 3's Gates
  line has nothing to render until PLAN-1's seam writes a record. The full
  rationale for the split is in PLAN-1's Notes.
- **The advisory arm is unrecorded by construction, and AC6 permits it.** Its
  reviewer writes the findings file and closes its own bracket, and the
  orchestrator's session may end before the return lands, so nothing is
  positioned to rule. Task 3's unrecorded arm is what an advisory fire reads as,
  and no task adds a fourth ruling value to describe it (D-02).
- **`trace suggest` still parses the detail string and keeps doing so.**
  `lib/trace-suggest.mjs`'s `parseAdjudication` reads survivors out of `--detail`
  and resolves `raised` from the structured field first. This plan adds three
  structured counts that it does not read. Wiring them in would mean touching
  exactly the reader CONTEXT puts out of scope, so it is left for the human
  rather than folded in here.
