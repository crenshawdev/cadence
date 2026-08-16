---
phase: 2
plan: 2
requirements:
  - MSR-02
files:
  - cadence-core/bin/lib/trace-suggest.mjs
  - cadence-core/bin/trace-suggest.test.mjs
  - cadence-core/bin/prose-agreement.test.mjs
  - cadence-core/workflows/report.md
  - cadence-core/workflows/progress.md
  - cadence-core/bin/weight-budgets.json
  - .planning/DOCS-CLAIMS.md
---

# Phase 2: The record learns to see the run - Plan 2 (MSR-02, the reader half)

## Goal

`/cad-report` and `/cad-suggest` stop presenting a worker-return token sum as
the run's cost, stating instead what their figure does and does not include, and
`/cad-progress --trace` - the third surface making the same claim - moves with
them. The gap is reported as its terms against a named external comparator
rather than asserted as a multiplier.

## Must be true when done

- `/cad-report`'s spend line no longer presents the recorded token sum as the
  run's cost: at the point it prints the figure it names the three sources that
  figure excludes - the orchestrator's own turns, cross-model provider calls, and
  figureless returns.
- `/cad-report` prints the gap as its TERMS - dispatches, turns, the per-dispatch
  window figure and the count of unmeasured dispatches - beside a named external
  comparator the user runs themselves, and `grep -rn` over `cadence-core/` finds
  no stored multiplier or ratio constant.
- `/cad-report` states that `--phase <N>` filters on `phase` alone and never on
  `corr`, so a figure scoped to a phase can pool several runs' events.
- `planning.mjs trace suggest`'s spend receipt carries the same three exclusions,
  and `cadence-core/workflows/suggest.md` is byte-identical to what it is today -
  no flag, no recomputation, no hedged figure in prose.
- `/cad-progress --trace` no longer calls the `roles` block what each worker
  COST, and no longer says the record has one `corr`.
- Two checks fail against the unpatched code first - one on the seam's evidence
  string, one on the report caveat sentence - each carrying a header naming the
  SHA it was watched failing at, and running each against that SHA exits
  non-zero.
- `node --test cadence-core/bin/*.test.mjs` and `node
  cadence-core/bin/self-verify.mjs` both exit 0, and the nine
  `.planning/DOCS-CLAIMS.md` rows D-13 names agree with the live files.

## Context

Ordered BEHIND PLAN-1 and reading the field shape it settles: `roles[].turns`
and `roles[].turns_unrecorded` on the role row, and a turn figure on each
`brackets[]` row. CONTEXT D-05 forbids fetching, shelling out to or bundling the
external comparator - it is NAMED and the user runs it. D-06 forbids storing a
multiplier or ratio anywhere in the tree and forbids correcting the `~20x` in
ROADMAP and REQUIREMENTS, which measures a different quantity. D-08 requires any
statement of what the figure includes to say that `--phase` does not scope a run.
D-09 puts `/cad-progress --trace` and the `PROGRESS-28` ledger row in this phase.
D-10 splits the watched FAIL into two checks, one per half. D-11 makes the
`/cad-suggest` half a SEAM change with `suggest.md` untouched. D-12 re-pins
`weight-budgets.json` in the same commit as each prose edit and requires any
fixture re-pin to carry its arithmetic in the test file's header. D-13 makes the
named ledger rows travel with the change.

Out of scope: any cache-hit-rate work, the two `/cad-report` input-quality
captures, MSR-03's live-window budgeting, and any new flag on `/cad-suggest`.

## Tasks

### Task 1: the seam names what its spend figure excludes

- **Files:** `cadence-core/bin/lib/trace-suggest.mjs` (rule R5, the spend
  receipt, and the module's exports), `cadence-core/bin/trace-suggest.test.mjs`
  (the `fixture: the committed verbatim trace suggests exactly what it did
  before this phase` literal)
- **Action:** Make R5 state what its figure is not. Add ONE frozen exported array
  to `lib/trace-suggest.mjs` naming the three sources the recorded token total
  excludes - the orchestrator's own turns, cross-model provider calls, and
  figureless returns - with a header comment saying it exists so the seam's
  evidence string and `report.md`'s caveat cannot drift into two different claims
  (the risk CONTEXT's third flagged assumption names), the same reason
  `lib/trace.mjs` exports `DISPATCH`/`TERMINAL`/`ANCHOR` rather than letting the
  census hold a copy. Build R5's `evidence` from that array so the three names
  have one source. Keep everything else about R5 as it is: `kind: 'info'`,
  `action: null`, silent when no role carried a figure, and no arithmetic beyond
  the share it already computes - no multiplier, no ratio against any external
  number, and nothing stored. Do NOT add a rule, an envelope key or a flag, and
  do not touch `cadence-core/workflows/suggest.md` at all: it states "Add no flag
  of any kind" and "Relay the figures UNCHANGED and recompute none of them", so a
  longer `evidence` string reaches the user through the relay that already
  exists, and a caveat landing as prose a model may drop is the failure D-11
  forecloses. Re-pin the committed-fixture literal in
  `trace-suggest.test.mjs` to the new string and record in that test's header
  WHY it moved and that the figures inside it are unchanged - D-12 requires a
  necessary re-pin to carry its arithmetic rather than be quietly edited to
  agree.
- **Verify:** `node --test cadence-core/bin/trace-suggest.test.mjs` passes, and
  its fixture assertion shows the spend receipt carrying the same
  `423,846 of 968,705 recorded tokens (44%)` figures it carries today plus the
  three exclusion names. `git diff --stat cadence-core/workflows/suggest.md`
  reports no change. `grep -rniE 'multiplier|[0-9]+(\.[0-9]+)?x (under|low|gap)'
  cadence-core/` returns nothing.

### Task 2: `/cad-report` states what its figure excludes and prints the gap as its terms

- **Files:** `cadence-core/workflows/report.md` (the `compose` step's shape block
  and its `Rules, all load-bearing:` list, whose token line today reads `Tokens
  on subagent returns (the host's own per-dispatch figure, not a measured cost)`
  and whose EXCLUDES rule today names only the advisory-fire and cross-model
  arms), `cadence-core/bin/weight-budgets.json`
- **Action:** Four things become true in this file and nothing else does. FIRST,
  the spend line names the three sources it excludes at the point it prints the
  figure - the orchestrator's own turns, cross-model provider calls, and
  figureless returns - in the same words the seam's exported array uses, so a
  reader of either surface gets one claim. The existing rule already covers two
  of the three; the orchestrator's own turns are the one it never stated, and
  they are the majority of the gap because the trace records a figure on a
  subagent RETURN only. SECOND, the report prints the gap as its TERMS rather
  than as a product: the dispatch count, the turn count with the turn-unrecorded
  count beside it, the per-dispatch window figure, and the count of unmeasured
  dispatches. The per-dispatch window figure is the return token figure on each
  `brackets[]` row, and the prose must NAME it as a proxy - it behaves like a
  dispatch's FINAL context window rather than a per-turn sum, so multiplying it
  by the turns that grew that window double-counts the early ones. Print no
  multiplier, no ratio and no single gap number: MSR-03 and PLN-01 need the
  factors, and a stored product recreates the maintenance loop `v2.7.0` deleted.
  THIRD, name the external comparator the user runs to get the billed figure -
  the measurement behind this phase was taken against `burnrate` - and state that
  Cadence fetches nothing, shells out to nothing and bundles nothing, which is
  what keeps `README.md`'s "ships no instrumentation and phones nothing home"
  true. FOURTH, state D-08's scoping fact where the figure is described:
  `--phase <N>` filters on `phase` alone and never on `corr`, so a phase-scoped
  figure can pool several cycles' events - measured on this repo, `trace render
  --phase 1` returns 12 distinct `corr` ids. Also carry the turn figure into the
  `Dispatches:` table row description beside `tokens`, since `brackets[]` now
  supplies it. Keep the `No fabricated figures` guardrail intact and add no seam
  call. `report.md` sits at exactly its 6935-byte pin with zero headroom, so
  re-pin `weight-budgets.json` in this same commit (D-12).
- **Verify:** `node cadence-core/bin/self-verify.mjs` exits 0 (an over-budget
  surface fails it, so a green run proves the re-pin landed). `grep -c 'corr'
  cadence-core/workflows/report.md` returns non-zero and the matching sentence
  says `--phase` does not scope a run. `grep -rniE 'multiplier|[0-9]+(\.[0-9]+)?x'
  cadence-core/workflows/report.md` returns nothing.

### Task 3: `/cad-progress --trace` stops calling the roles block a cost

- **Files:** `cadence-core/workflows/progress.md` (the `trace` step, whose
  sentence today reads `under the record's one \`corr\`` and `what each worker in
  this phase COST`), `cadence-core/bin/weight-budgets.json`
- **Action:** Correct exactly two claims in the `trace` step and leave the rest
  of the file alone. The one-`corr` clause is false - a render on this repo
  returns 12 distinct `corr` ids for phase 1 - so state what the counts actually
  span: the events the phase filter admitted, which can be several runs of that
  phase number. And the `roles` block stops being described as what each worker
  COST: say what it carries - a dispatch count, the host's own token figure off
  the subagent returns, the turn count, and each of the two unrecorded counters
  when present - and that it is not the run's price, for the same reason
  `/cad-report` now states. Keep the block's existing reading rule verbatim in
  substance: an absent total means NO dispatch of that role reported a figure and
  prints as `unrecorded`, never as `0`, and that rule now governs the turn total
  under its own counter as well - a role that was never measured and a role that
  spent nothing are different answers. Do not restate `/cad-report`'s terms or
  its comparator here; this file reports, it does not price. `progress.md` sits
  at exactly its 8957-byte pin with zero headroom, so re-pin
  `weight-budgets.json` in this same commit (D-09, D-12).
- **Verify:** `node cadence-core/bin/self-verify.mjs` exits 0. `grep -n "one
  \`corr\`" cadence-core/workflows/progress.md` returns nothing, and `grep -n
  'COST' cadence-core/workflows/progress.md` returns nothing.

### Task 4: the watched FAIL on the seam half

- **Files:** `cadence-core/bin/trace-suggest.test.mjs`
- **Action:** Add one new check pinning the SHIPPED shape of the spend receipt's
  `evidence` string: that it names all three excluded sources, and that the three
  names come from the frozen array task 1 exports rather than from a copied list
  in this test - a test holding its own copy goes green on the day the seam and
  the prose stop agreeing, which is the failure it exists to catch. Assert it
  over a render built by this file's existing `render()` helper so the check is
  about the rule and not about the committed fixture. Carry a header comment in
  the shape `cadence-core/bin/milestone-prune.test.mjs`'s RCL-07 falsifier uses:
  `WATCHED FAILING AT <sha>` naming the tip of the unpatched tree, the observed
  unpatched output quoted verbatim, and the re-watch recipe (`git worktree add
  --detach <tmp> <sha>`, copy this file into that checkout's `cadence-core/bin/`,
  `node --test` it there, remove the worktree). Phase 1 D-17 is the convention.
  That recipe MUST also copy this phase's `cadence-core/bin/lib/trace-suggest.mjs`
  export into the old checkout - or the check must import the frozen array
  through a guarded read that substitutes the three literal names when the export
  is absent. Without one of the two, the unpatched run dies at module link on a
  missing named export and the recorded FAIL proves only that a new helper does
  not exist yet, never that unpatched `/cad-suggest` makes the wrong cost claim.
  The header's quoted output has to show the assertion failing, so state in it
  which of the two arms the recipe uses.
- **Verify:** `node --test cadence-core/bin/trace-suggest.test.mjs` exits 0 on
  this tree. Following the header's own re-watch recipe against the SHA it names,
  the same command exits NON-ZERO with this test failing on its assertion, and
  the header quotes that observed output.

### Task 5: the watched FAIL on the prose half

- **Files:** `cadence-core/bin/prose-agreement.test.mjs`
- **Action:** Add one new check asserting that `cadence-core/workflows/report.md`
  names all three excluded sources where it prints the spend figure, reading the
  three names by importing the frozen array from
  `cadence-core/bin/lib/trace-suggest.mjs` rather than restating them - the
  subject of this check is that the seam and the prose make ONE claim, so a
  literal copy here would assert nothing about agreement. This is the half of
  MSR-02 that lives in prose nothing executes, which is why it needs a check of
  its own and why moving the caveat into the seam envelope was rejected:
  `report.md` has no executor at all and would still be relaying an unasserted
  sentence. Assert by the named anchor, never by the shape of the sentence around
  it, the way this file's existing prose checks do, so a rewrap that changed no
  fact stays green. Carry the same `WATCHED FAILING AT <sha>` header task 4
  describes, with its own observed unpatched output and re-watch recipe -
  including task 4's requirement that the old-checkout run reach the assertion
  rather than die at module link on the absent frozen export.
- **Verify:** `node --test cadence-core/bin/prose-agreement.test.mjs` exits 0 on
  this tree. Following the header's own re-watch recipe against the SHA it names,
  the same command exits NON-ZERO with this test failing on its assertion.
  Deleting one of the three exclusion names from `report.md` makes the check FAIL
  on this tree (restore it afterwards).

### Task 6: the ledger rows travel with the change

- **Files:** `.planning/DOCS-CLAIMS.md`
- **Action:** Settle SEVENTEEN rows against the live files, not nine. The nine
  D-13 names - `REPORT-05`, `REPORT-10`, `REPORT-11`, `REPORT-12`, `SUGGEST-07`,
  `SUGGEST-08`, `PROGRESS-15`, `PROGRESS-28` and `PROGRESS-29` - plus the eight
  that enumerate the live `trace close` flag list and become INCOMPLETE the
  moment PLAN-1 task 4 lands `--turns` on those ten invocations: `CONTEXT-14`,
  `PLAN-18`, `EXECUTE-17`, `VERIFY-DEEP-05`, `MINIMALISM-REVIEW-11`,
  `DECISION-REVIEW-14`, `PLAN-REVISION-05` and `PLAN-REVISION-10`. Their line
  anchors do not move, so they need no re-pin - their CLAIM TEXT does, for
  exactly the reason D-13 gives for `REPORT-05` and `PROGRESS-28`: a row that
  became false travels with the change rather than waiting for the next
  `/cad-docs-verify`. Settle all seventeen
  rather than leaving them for the next `/cad-docs-verify`. Re-pin the line
  anchor of every row whose claim moved (the anchors already drift - PROGRESS-13
  cites line 93 for a command sitting at line 96 today - so pin each to where the
  LIVE file states its claim rather than to its old cite plus this phase's
  shift). Two rows become outright FALSE and get their claim TEXT rewritten
  rather than re-pinned: `REPORT-05`, whose carried-key list no longer matches
  what the render carries, and `PROGRESS-28`, whose "The record has one `corr`"
  is falsified by the 12-corr measurement. Leave every `verdict` cell as run 1
  recorded it, the way the earlier passes did, and set the `resolution` on each
  rewritten row to name the correcting commit. Add a dated paragraph to the
  ledger's re-pinning header saying which rows moved, which claims were
  rewritten and why - the join is `doc` plus claim text, so a silently rewritten
  claim joins to nothing in the next sweep and reports as a new extraction where
  a fix happened. Add no new row: this ledger holds run-1 provenance, and claims
  this phase created are extracted by the next `/cad-docs-verify`.
- **Verify:** For each of the seventeen ids, the line number in its ledger row
  points at a line in the named live file that states the row's claim
  (spot-check with `sed -n '<line>p' <doc>` for each). `grep -n "The record has
  one" .planning/DOCS-CLAIMS.md` returns nothing, and `grep -n "REPORT-05"
  .planning/DOCS-CLAIMS.md` shows a claim text listing the keys the live
  `report.md` names. For each of the eight flag-list rows, the claim text names
  `--turns` alongside the flags it already listed - `grep -c -- '--turns'` over
  the rows for `CONTEXT-14`, `PLAN-18`, `EXECUTE-17`, `VERIFY-DEEP-05`,
  `MINIMALISM-REVIEW-11`, `DECISION-REVIEW-14`, `PLAN-REVISION-05` and
  `PLAN-REVISION-10` returns 8.

## Notes

- CONTEXT's third flagged assumption (whether the caveat's wording lives in the
  seam envelope and is relayed, or is authored once per reader) is answered in
  tasks 1, 4 and 5: authored once per reader, since D-10 explicitly rejected the
  seam envelope, with the named risk - the two readers drifting in what they
  claim to exclude - closed by a single frozen export both checks read instead of
  copying.
- CONTEXT's fifth flagged assumption (whether the per-dispatch window figure is
  the return token figure or a separately recorded value) is answered in task 2:
  it is the return token figure, and the prose names it as a proxy for a
  dispatch's FINAL window rather than a per-turn sum. A separately recorded
  window value is MSR-03's, which this phase's Scope boundary puts out.
- The eight `.planning/DOCS-CLAIMS.md` rows that enumerate the live `trace close`
  flag list - `CONTEXT-14`, `PLAN-18`, `EXECUTE-17`, `VERIFY-DEEP-05`,
  `MINIMALISM-REVIEW-11`, `DECISION-REVIEW-14`, `PLAN-REVISION-05` and
  `PLAN-REVISION-10` - were originally left to the human because their line
  anchors do not move and D-13 names only nine rows. Folded INTO task 6 at the
  `plan` trigger's adjudication instead: D-13's own reason for the nine is that a
  row which became FALSE travels with the change, and PLAN-1 task 4 makes these
  eight incomplete on the same commit. No new task - task 6 widens, so the plan
  stays at 6 against the 8-task ceiling.
- DEVIATION FROM THE PLANNER'S DEFAULT SPLIT RULE, recorded rather than silent:
  this phase ships as two plan files that SHARE
  `cadence-core/bin/weight-budgets.json`, where the default rule is that
  shared-file slices collapse into one plan. Two things override it. The task
  ceiling is 8 per plan and the phase needs twelve tasks, so one plan cannot hold
  it; and the CONTEXT `Plan shape` directive splits at the seam boundary, orders
  the writer half first, and explicitly asks for `files:` leases on the shared
  surfaces per plan. The consequence is stated: `plan-overlap` will report the
  overlap and `/cad-execute` will run PLAN-1 then PLAN-2 SEQUENTIALLY, which is
  the required ordering anyway - PLAN-2's readers are written against the field
  shape PLAN-1 settles. This is the same arrangement phase 1 shipped, where all
  three plans declared `weight-budgets.json`.
