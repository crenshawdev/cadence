---
phase: 6
plan: 1
requirements: [CEN-01, CEN-02]
files:
  - cadence-core/bin/lib/census-registry.mjs
  - cadence-core/bin/seam-calls.test.mjs
  - cadence-core/bin/planning/lease-check.mjs
  - cadence-core/bin/planning-lease-check.test.mjs
  - cadence-core/bin/trace.test.mjs
  - cadence-core/bin/phase-spelling.test.mjs
  - cadence-core/workflows/plan.md
  - cadence-core/bin/weight-budgets.json
  - .planning/phases/2/census-replay.md
  - .planning/phases/2/UAT.md
---

# Phase 6: Close the plan-time lease gate - Plan

## Goal

The plan-time lease gate refuses the two cases phase 2's UAT found it passing:
a hand-maintained census that is not in the registry, and a PLAN whose `files:`
list could not be read at all.

## Must be true when done

- `grep -c CADENCE-CENSUS cadence-core/bin/seam-calls.test.mjs` returns at least
  1, `lib/census-registry.mjs` holds a row whose holder is that file and whose
  subjects are `cadence-core/workflows/plan.md` and
  `cadence-core/workflows/context.md`, the discovery arm in
  `census-registry.test.mjs` reports no unregistered census, and a grep for
  "deliberately absent from this table" in that module returns 0.
- `lease-check --plan-time` returns `ok:false` against a PLAN whose frontmatter
  carries a garbage line and against a PLAN whose key is misspelled `filez:`,
  each naming its own reason token and each carrying a hint; a PLAN that
  declares files and puts no census at risk still returns `ok:true`, exit 0.
- One fixture directory holding two PLAN files pins both gates on both signals:
  `plan-overlap` reports `frontmatter_issues` and `undeclared` over it, and
  `lease-check --plan-time` refuses each of its two plans on the matching
  signal. Removing either half fails the test.
- `workflows/plan.md`'s `check_census` step names every refusal outcome the
  seam now returns instead of claiming `census-at-risk` alone, and
  `self-verify.mjs` reports no weight-budget overrun for it.
- `.planning/phases/2/census-replay.md` carries the new row's refusal count
  beside the others, recomputed over the current corpus, and no registry entry
  refuses more than half of the plans it could speak to.
- `planning.mjs uat status --phase 2` reports `fail: 0` with items 9 and 10
  `pass`; item 11 stays `pending` and `result` stays `partial`, per amended AC5.
- `node cadence-core/bin/test.mjs` runs green, `npx tsc -p tsconfig.ci.json`
  exits 0, and `self-verify.mjs --root .` reports `problems []`.

## Context

CONTEXT.md's decisions bind every task here: the row survives the
half-the-plans breadth rail unchanged (D-01), the refusal needs TWO signals
because a misspelled `filez:` key produces zero `frontmatter_issues` (D-02),
each signal gets its own reason token (D-03), `workflows/plan.md`'s prose is
corrected and this phase absorbs the weight re-pin (D-04), and phase 2's UAT items 9 and 10 are
re-recorded green (D-05). D-05's further expectation that item 11 be observed on
this very run did not hold: `check_census` answered `ok:true` on its first fire
because the lease was complete, so there was no refusal to observe. AC5 was
amended to match (ROADMAP phase 6, criterion 5) and item 11 stays `pending`.

Out of scope and untouched: the commit-time `lease-check` arm, the
`census-at-risk` reason and its `censuses_at_risk` payload, the breadth rail at
`planning-lease-check.test.mjs:707-726`, the `planning-detail-sites` row's stale
`counts` prose, and every census outside `seam-calls.test.mjs`.

## Tasks

### Task 1: Register the seam-invocation census

- **Files:** cadence-core/bin/lib/census-registry.mjs (start at CENSUSES),
  cadence-core/bin/seam-calls.test.mjs (start at its CENSUS table)
- **Action:** Add one `entry({...})` row to `CENSUSES` with id
  `seam-call-counts` - the id is the planner's choice and is distinct from the
  eleven the table already carries. Its `holder` is
  `cadence-core/bin/seam-calls.test.mjs`; its `counts` names the per-workflow
  seam-invocation figures that file's `CENSUS` array pins, rather than repeating
  the arithmetic its header derives them from; its `asserted_by` names the
  generated test spelled `<file> instructs exactly <N> seam invocations`; its
  `subjects` are exactly `cadence-core/workflows/plan.md` and
  `cadence-core/workflows/context.md` and nothing wider. The narrow pair is
  load-bearing: measured 2026-08-25 by replaying the shipped `censusesAtRisk`
  predicate over every `PLAN*.md` under `.planning`, that row refuses 9 of the
  47 plans declaring under `cadence-core/bin/` against a bound of 23.5, while
  phase 3's dropped row on subject `cadence-core/bin/` measured 44 of 45 and was
  removed rather than tuned. In the SAME commit, plant one marker line in
  `seam-calls.test.mjs` at the asserting site, spelled to the grammar
  `censusMarkersIn` reads - a `CADENCE-CENSUS:` head, the id, then
  `| asserts: <what it pins>` - and rewrite the header paragraph at
  `census-registry.mjs:44-49` so it neither names `seam-calls.test.mjs` as the
  worked example of what is not a census nor contains the string "deliberately
  absent from this table". Keep the paragraph's actual rule (a DERIVED number
  the test recomputes from the tree on both sides is a measurement no plan can
  invalidate) and either give it an example the corrected D-05 does not
  contradict or state the rule with no example. Do not add a length or count
  export and do not assert the table's length - the module's own D-04 paragraph
  forbids it and `census-registry.test.mjs`'s header states why. Row, marker and
  header are one commit; splitting them leaves the module documenting a rule its
  own table breaks.
- **Verify:** `grep -c CADENCE-CENSUS cadence-core/bin/seam-calls.test.mjs`
  prints at least 1 and
  `grep -c "deliberately absent from this table" cadence-core/bin/lib/census-registry.mjs`
  prints 0. `node --test cadence-core/bin/census-registry.test.mjs` and
  `node --test cadence-core/bin/planning-lease-check.test.mjs` are both green -
  the second includes the half-the-plans breadth rail, now counting the new row.
  On a scratch `.planning/phases/1/PLAN.md` whose `files:` list declares
  `cadence-core/workflows/plan.md` alone,
  `planning.mjs --dir <scratch>/.planning lease-check --phase 1 --plan 1 --plan-time`
  returns `ok:false` with reason `census-at-risk` and a `censuses_at_risk` entry
  whose `missing` is `cadence-core/bin/seam-calls.test.mjs`.

### Task 2: Record the new row in the replay record

- **Files:** .planning/phases/2/census-replay.md
- **Action:** Re-run the replay this file's own header describes - the
  `censusesAtRisk` predicate over the declared list of every `PLAN.md` and
  `PLAN-<k>.md` under `.planning/`, filtered to those declaring at least one
  path under `cadence-core/bin/` - and update the file to what it now measures.
  The corpus grew: the file records 51 walked and 43 under `cadence-core/bin/`,
  and the same walk on 2026-08-25 answered 55 and 47 before this phase's own
  plan landed, so re-measure rather than adjusting the recorded numbers by hand.
  Update the Corpus table and its bound, insert the new row into the per-entry
  table in the same descending rank order, and correct the two sentences that
  count the registry - the "Four of the nine entries refuse nothing at all"
  claim and the "The plan predicted four of these" paragraph - so neither
  misstates the table it describes. Keep the file's structure, its stated method
  and its "What the numbers say" reading of `planning-detail-sites` as the entry
  to watch. Do not tune the bound and do not narrow any row's subjects: this
  update is the follow-up the rail's own failure message instructs
  (`planning-lease-check.test.mjs:723-726`) and the one phase 2's verifier named.
- **Verify:** A fresh replay printed per entry matches the file's table row for
  row, and its walked/under-bin/bound figures match the file's Corpus table.
  `node --test cadence-core/bin/planning-lease-check.test.mjs` stays green, so
  no entry - the new row included - is over half.

### Task 3: The plan-time arm fails closed on a lease it could not read

- **Files:** cadence-core/bin/planning/lease-check.mjs (start at cmdLeaseCheck),
  cadence-core/bin/trace.test.mjs, cadence-core/bin/phase-spelling.test.mjs
- **Action:** Inside the `opts['plan-time']` block and ABOVE the
  `censusesAtRisk(declared)` call, refuse on two signals with two NEW reason
  tokens, each emitted the way the `census-at-risk` arm beside it is - a direct
  `emit` carrying `ok:false`, the reason, the spread `base` (so `phase`, `plan`,
  `plan_file`, `declared` and any `frontmatter_issues` ride the refusal) and a
  top-level `hint`, which is what `self-verify.mjs` check 22 reads. The first
  signal is a non-empty `issues` list from `parsePlanFiles` and its token is
  `unparsed-lease`; the second is `declared.length === 0` and its token is
  `empty-lease`. Both token names are the planner's choice and are pinned by the
  Verify below. Check the frontmatter signal FIRST, because it names why the
  lease could not be read and a plan can carry both. Two tokens rather than one
  discriminated token: `census-at-risk` is defined by a non-empty
  `censuses_at_risk` list, which is empty here by construction; `undeclared-files`
  is a statement about the staged side this arm never reads; and
  `workflows/execute.md`'s `choose_path` already reads `frontmatter_issues` and
  `undeclared` as two separate clauses, which is what makes "both gates read the
  signal the same way" literally true. BOTH signals are needed and neither is
  redundant - measured 2026-08-25 by calling `parsePlanFiles` on four fixtures, a
  misspelled `filez:` key is a structurally valid key line and returns an empty
  file list with ZERO issues, while a garbage frontmatter line returns a
  NON-EMPTY file list with one `unknown-line` issue, so each signal catches
  exactly the case the other misses. Each hint names the remedy in the shape the
  two arms below already use - repair the plan's frontmatter, or declare files in
  it, then re-run this check. Refusing an empty declared set is not a blanket
  refusal: of the 55 plans under `.planning`, exactly 2 declare zero files and
  both are `/cad-task` plans with no YAML frontmatter at all, which `check_census`
  never runs against, and 0 of 55 carry any frontmatter issue. Leave the
  commit-time arm below completely alone, append no trace event on either new arm
  and keep the branch above the `execFileSync` block - the `appendEvent` is the
  `undeclared-census-files` arm's distinguishing signal and this arm must still
  spawn no git. Introduce no `e && e.message ? e.message : String(e)` detail:
  `planning-detail-sites` pins 15 of those over the concatenated seam and this
  refusal catches nothing. Extend the plan-time block's comment to state both
  signals and why there are two, and correct the header sentence "An unprovable
  lease is never a pass: a missing plan and an unreadable staged set are both
  ok:false" so it also covers the lease this arm could not read.
  `trace.test.mjs` and `phase-spelling.test.mjs` are on this task's lease because
  their censuses take `cadence-core/bin/planning/` as a subject; neither count
  should move, since this adds no refusing trace flag sentence and no
  `requirePhaseArg` callsite, and if one does it is re-pinned here rather than in
  a later task.
- **Verify:** On a scratch `.planning/phases/1/` holding one PLAN.md,
  `planning.mjs --dir <scratch>/.planning lease-check --phase 1 --plan 1 --plan-time`
  returns: with a garbage line in the frontmatter, `ok:false`, reason
  `unparsed-lease`, a non-empty `hint`, exit 1; with the key misspelled `filez:`,
  `ok:false`, reason `empty-lease`, a non-empty `hint`, exit 1; with a valid
  `files:` list declaring `src/a.mjs` alone, `ok:true` with `declared:1` and exit
  0. `node --test cadence-core/bin/planning-lease-check.test.mjs`,
  `node --test cadence-core/bin/trace.test.mjs` and
  `node --test cadence-core/bin/phase-spelling.test.mjs` are all green, so the
  phase-5 replay arm still answers `census-at-risk` and the no-git-spawn arm
  still finds no argv log.

### Task 4: One fixture, two plans, both gates, both signals

- **Files:** cadence-core/bin/planning-lease-check.test.mjs (start at planTimeTree)
- **Action:** Add one fixture directory holding TWO plan files, and the arms
  that read it through both gates. Two plans and not one: `cmdPlanOverlap`
  returns before computing `undeclared` when fewer than two plans exist -
  `planning/plan-overlap.mjs:63-70` spreads `frontmatter_issues` on that early
  return but not `undeclared` - so a one-plan fixture pins only half the
  reading. Give PLAN-1.md a garbage frontmatter line beside a real `files:`
  entry and PLAN-2.md a misspelled `filez:` key, so `plan-overlap` over that one
  directory reports `frontmatter_issues` naming PLAN-1.md and `undeclared`
  naming PLAN-2.md, while `lease-check --plan-time` refuses `--plan 1` on the
  frontmatter signal and `--plan 2` on the empty-lease signal - one fixture, two
  gates, the same two signals. Build it with the existing `planTimeTree` and
  `writePlanTimePlan` rather than a second tree builder; this file's header
  states that two copies of a fixture builder is how two fixtures drift apart.
  `planTimeRaw` hard-codes `--plan 1`, so reaching PLAN-2.md means that plan
  number becomes a parameter of the existing helpers, never a copied function.
  `plan-overlap` is reached through the `run` helper this file already imports
  from `planning.test.mjs`. Assert each half by name so removing either fails:
  the two reason tokens, a `hint` on each refusal, exit 1 on each, and both
  `frontmatter_issues` and `undeclared` present on the plan-overlap envelope
  carrying the plan names they belong to. Add one arm proving this is not a
  blanket refusal - a two-plan fixture whose plans declare real paths that put no
  census at risk answers `ok:true` on both plan numbers. Leave the existing
  plan-time arms and the breadth rail at `:707-726` untouched.
- **Verify:** `node --test cadence-core/bin/planning-lease-check.test.mjs` is
  green. Then mutate each signal's implementation arm SEPARATELY and confirm the
  file goes red each time, restoring between: revert only the `unparsed-lease`
  arm in `planning/lease-check.mjs` (leaving the `empty-lease` arm in place) and
  the file is red; restore it, revert only the `empty-lease` arm and the file is
  red again. Deleting an assertion is NOT the check - a deleted assertion leaves
  every remaining one passing and the file green, so it can never demonstrate
  coverage. Reverting both new arms together makes the new tests red while every
  pre-existing arm in the file stays green.

### Task 5: `check_census` states what the seam now returns

- **Files:** cadence-core/workflows/plan.md (start at the check_census step),
  cadence-core/bin/weight-budgets.json (start at its plan.md line)
- **Action:** The step's sentence "It answers `ok:true`, or it refuses with
  `census-at-risk` and a `censuses_at_risk` list" is exhaustive, and task 3
  falsifies it. Rewrite it to name every refusal outcome the seam now returns and
  the remedy each one carries: the census refusal keeps its `censuses_at_risk`
  list and its "declare these files" remedy, and the two unread-lease refusals
  say the plan's `files:` frontmatter could not be read, so the remedy is to
  repair the frontmatter rather than to add a file - a distinction the caller
  cannot act on if the prose collapses them. Keep everything else in the step as
  it stands: the once-per-plan-file rule, the do-not-continue rule, the "say the
  missing files out loud" instruction and the reasoning for why this step
  refuses rather than reports. Add and remove NO
  `node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/<seam>.mjs"` command block
  anywhere in this file - `seam-calls.test.mjs` pins `plan.md` at exactly 14 seam
  invocations, and this correction is prose, not a call. Then re-pin the single
  `cadence-core/workflows/plan.md` line in `weight-budgets.json` to the file's
  exact new UTF-8 byte size. It is at exactly its budget today (measured
  2026-08-25: 33,187 B against 33,187), so any growth is an overrun; the row's
  own claim is the EXACT size, so re-pin in whichever direction it moved. Re-pin
  that one line by hand - regenerating the budgets file wholesale moves five
  unrelated keys into this diff.
- **Verify:** `node cadence-core/bin/self-verify.mjs --root .` reports
  `problems []`, so no `budget-overrun` for `plan.md`. `wc -c
  cadence-core/workflows/plan.md` equals the `cadence-core/workflows/plan.md`
  value in `weight-budgets.json`, and `git diff -U0
  cadence-core/bin/weight-budgets.json` shows exactly one changed line.
  `node --test cadence-core/bin/seam-calls.test.mjs` is green, so the file still
  instructs 14 seam invocations. `grep -n unparsed-lease cadence-core/workflows/plan.md`
  and `grep -n empty-lease cadence-core/workflows/plan.md` each return a line
  inside the `check_census` step, and `census-at-risk` is still named there.

### Task 6: Phase 2's UAT items 9 and 10 re-test green

- **Files:** .planning/phases/2/UAT.md
- **Action:** Items 9 and 10 are recorded `fail`, and `uat record --source
  verifier` refuses `would-overwrite` on an item that is not pending
  (`planning/uat.mjs:194-198`), so each is first set back to pending with
  `--result pending --fix "<hash>, retest"` - the exact shape that module's
  comment at `:44-47` states - and then re-recorded as a pass with `--source
  verifier`. Item 9's evidence is task 1's row, marker and green discovery arm;
  item 10's is task 3's two refusals and task 4's shared fixture. Evidence is
  caller-derived text, so it rides `--fields-file` rather than an inline
  `--evidence`, while `--fix "<hash>, retest"` stays inline - the text-transport
  register carries a row for exactly that value. Item 11 is `pending` and STAYS
  pending - do not touch it. Its `why_human` puts it out of reach of code: it
  needs a live `/cad-plan` run whose `check_census` actually refuses, and this
  phase's own planning run declared all fourteen census holders correctly, so no
  refusal existed to observe. Do not narrow it, do not record it `skipped`, and
  do not record a pass for an observation nobody made. The consequence is
  accepted, not worked around: `uatComplete`
  (`lib/planning-files.mjs:1801-1805`) requires every item to be `pass`, or
  `skipped` WITH a reason, so phase 2's UAT stays `partial` and `result` never
  reaches `complete` in this phase. AC5 was amended to say exactly that (ROADMAP
  phase 6, criterion 5), so a `partial` here is the criterion being met, not
  missed. Touch no other
  item, and do not run `uat merge`: merge atomically overwrites
  `phases/2/FINDINGS.json`, which nothing in this phase has reason to rewrite.
- **Verify:** `node cadence-core/bin/planning.mjs uat status --phase 2` prints
  `fail:0` with items 9 and 10 both `pass`, and `pending:1` naming item 11 alone;
  `result` is `partial`, which is what amended AC5 asks for. `grep -n "^status:"
  .planning/phases/2/UAT.md` shows exactly one `pending`, and item 11's block is
  byte-identical to its pre-task state (`git diff` over UAT.md touches items 9
  and 10 only). Then the whole-tree
  gate: `node cadence-core/bin/test.mjs` runs green,
  `npx tsc -p tsconfig.ci.json` exits 0, and
  `node cadence-core/bin/self-verify.mjs --root .` reports `problems []`.

## Notes

- Plan shape follows the CONTEXT directive: one plan. The independence test
  agrees - tasks 3, 4 and 5 all sit downstream of `planning/lease-check.mjs`'s
  new reason tokens, and any split would make both plans declare the same census
  holders and pay the lease twice.
- The lease declares four census holders beyond the files the tasks edit -
  `cadence-core/bin/trace.test.mjs`, `cadence-core/bin/phase-spelling.test.mjs`,
  `cadence-core/bin/planning-lease-check.test.mjs` and
  `cadence-core/bin/weight-budgets.json`. `censusesAtRisk` refuses at plan time
  on subject intersection alone, and this plan declares a file under
  `cadence-core/bin/planning/` plus `cadence-core/workflows/plan.md`, which
  intersects all four rows' subjects. Verified 2026-08-25: `censusesAtRisk` over
  this exact ten-path lease returns an empty list, and returns those four ids
  when the holders are dropped.
- Item 11 (task 6) was RESOLVED at plan time and needs nothing from the
  executor. The item expects to observe `check_census` REFUSING and the
  orchestrator obeying. This plan declares its full census lease up front, so
  `check_census` answered `ok:true` on its first fire during this run and
  produced no refusal to observe; under-declaring on purpose to manufacture one
  is not something this plan does. The user's call (2026-08-25) was to amend AC5
  rather than record an unobserved pass or a `skipped`: item 11 stays `pending`,
  phase 2's UAT stays `partial`, and item 11 is answered by a later planning run
  that genuinely under-declares. Task 6 records items 9 and 10 only.
- The two new reason tokens are additions, so `reason-census.test.mjs` needs no
  edit: its census is one-directional by design and a token the list does not
  carry passes. It is deliberately not a registered census and carries no marker,
  which its own header states.
