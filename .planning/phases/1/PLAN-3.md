---
phase: 1
plan: 3
requirements: [HNT-01]
files:
  - cadence-core/bin/planning.mjs
  - cadence-core/bin/planning.test.mjs
---

# Phase 1: Every refusal names its next step - Plan 3 of 3

## Goal

Every in-scope refusal in `planning.mjs` - the largest user-facing refusal
surface in the plugin - tells the user what to do next, and the phase ends with
`self-verify` green and both integers stated.

## Must be true when done

- `node cadence-core/bin/self-verify.mjs --root .` returns `ok:true` with
  `problems: []` (AC2, AC6's sibling), and `node cadence-core/bin/test.mjs`
  reports 0 failures including `self-verify.test.mjs`'s live-tree assertion.
- Two integers can be read off one command - the in-scope site count and the
  hintless in-scope count - and the second is 0.
- Every refusal a user reaches from `/cad-plan`, `/cad-execute`, `/cad-verify`,
  `/cad-capture`, `/cad-milestone` and the trace and risk seams prints a `hint`
  naming an action in the user's terms, not a restatement of the `detail` and
  not an explanation of the seam's internals.
- No `reason` token string and no positional first argument to a `fail(...)`
  call changed anywhere in the phase: `git diff main...HEAD` shows no edit to a
  reason literal, and no test's expected reason string was updated (AC4).
- `node cadence-core/bin/weight.mjs` reports every budgeted surface within its
  pin and `git diff --name-only main...HEAD` lists no path under
  `cadence-core/workflows/`, `cadence-core/references/` or
  `skills/cad-*-contract/` (AC5).

## Context

`planning.mjs`'s `fail` at `:247` is ALREADY three-argument
(`const fail = (reason, detail, hint) => emit({ ok: false, reason, ...(detail ?
{ detail } : {}), ...(hint ? { hint } : {}) })`), so this whole plan is additive
text with no signature change. 155 in-scope sites carry no hint at plan time and
25 already do; those 25 are the wording model - `cadence-core/bin/planning.mjs`
lines 811, 2842, 2913, 4888, 5310, 5497, 5507, 5718, 5870, 6109, 6197, 6650 and
7160, e.g. `make them readable and re-run - an unreadable queue refuses a land
exactly as a member does` and `add these paths to <plan>'s files: list, or
unstage them`. D-03 keeps the `usage` and `internal` tokens out. AC4 forbids any
reason-literal edit; AC5 forbids any path under `cadence-core/workflows/`,
`cadence-core/references/` or `skills/cad-*-contract/`.

The check from plan 1 is the worklist: `node cadence-core/bin/self-verify.mjs
--root .` names every remaining site by file, line and reason token. Where the
check and a count in these tasks disagree, the check is the authority. This file
is 392 KB, so orient with `node cadence-core/bin/skim.mjs
cadence-core/bin/planning.mjs` and then Read the exact ranges - the comments in
this file are its design record and are what stop a hint contradicting a
decision already made a few lines above the refusal.

## Tasks

### Task 1: The cursor and phase-close refusals name their next step

- **Files:** cadence-core/bin/planning.mjs
- **Action:** Close every site the check names between `cmdStatus` and
  `cmdPhaseDone` - 19 at plan time, roughly lines 420-800, across `cmdStatus`,
  `cmdCursorGet`, `cmdCursorSet` and `cmdPhaseDone`. Most are `bad-args`
  refusals whose `detail` already names the missing flag; the hint says what the
  user does about it, which is supply that flag in the spelling the detail names
  and re-run, or in the phase-spelling cases pick a phase the numeric grammar
  can round-trip. `cmdStatus`'s `no-planning-dir` already carries the hint
  `/cad-new-project`, pinned byte-exact by a shipped test - leave it alone.
  `cmdPhaseDone` reports which documents landed rather than claiming
  all-or-nothing across ROADMAP.md and REQUIREMENTS.md, and its hint must not
  re-introduce that claim: where a close lands partially, the hint names what to
  inspect, never "re-run and it will finish".
- **Verify:** `node cadence-core/bin/self-verify.mjs --root . | python3 -c
  "import json,sys,re; p=[x for x in json.load(sys.stdin)['problems'] if
  x['kind']=='hintless-refusal' and x['file'].endswith('planning.mjs')];
  print(len([x for x in p if int(re.search(r'line (\d+)',
  x['detail']).group(1)) < 800]))"` prints `0`. `node
  cadence-core/bin/planning.mjs cursor set --dir .planning` prints a non-empty
  `hint` with `reason` still `bad-args`. `node cadence-core/bin/test.mjs
  planning` reports 0 failures.

### Task 2: The UAT and payload-reading refusals name their next step

- **Files:** cadence-core/bin/planning.mjs
- **Action:** Close every site the check names across `readJsonPayload`,
  `loadUat` and `cmdUat` - 27 at plan time, roughly lines 850-1180, the single
  densest command family in the file. These are read by a user mid-verify, so
  the hints split cleanly two ways: a payload refusal names the file to fix and
  what shape it must have (this is the `--payload <file>` transport, so the
  action is repairing or re-writing the file, never re-typing the value on the
  command line), and a UAT refusal names the checklist item or the phase to
  address and the command that addresses it. Do not restate the `detail`, which
  already carries the offending id or path.
- **Verify:** The same JSON filter as task 1 with the range `>= 800` and
  `< 1200` prints `0`.
  `node cadence-core/bin/planning.mjs uat record --dir .planning` prints a
  non-empty `hint`. `node cadence-core/bin/test.mjs planning` reports 0
  failures.

### Task 3: The audit, sizing and seeding refusals name their next step

- **Files:** cadence-core/bin/planning.mjs
- **Action:** Close every site the check names across `cmdAudit`,
  `cmdCriteriaCoverage`, `cmdPlanSize`, `cmdCriteriaSize`, `cmdPlanOverlap`,
  `cmdCiteCount`, `cmdSeedReqs` and `cmdRecall` - 22 at plan time, roughly lines
  1380-2500. These refuse a planning document the seam could not read or could
  not parse, so the hint names the document and the repair: which heading or
  table is missing, which command writes it, which id spelling the grammar
  accepts. `cmdSeedReqs` writes the numeric half of a phase and refuses a
  spelling the grammar cannot round-trip - its hint names an acceptable spelling
  rather than explaining the round-trip. `cmdPlanOverlap` and the sizing seams
  are read by the plan gate, so their hints name what a planner changes in the
  PLAN file.
- **Verify:** The same JSON filter as task 1 with the range `>= 1200` and
  `< 2600` prints `0`.
  `node cadence-core/bin/planning.mjs seed-reqs --dir .planning` prints a
  non-empty `hint`. `node cadence-core/bin/test.mjs planning` reports 0
  failures.

### Task 4: The lease, detection and trace refusals name their next step

- **Files:** cadence-core/bin/planning.mjs
- **Action:** Close every site the check names across `cmdLeaseCheck`,
  `cmdDetectCommands`, `cmdDetectSurfaces`, `cmdTraceIgnore`, `cmdReads` and
  `cmdTrace` - 25 at plan time, roughly lines 2780-4250, `cmdTrace` alone
  holding 15. `cmdLeaseCheck` already carries two of the file's best hints
  (`add these paths to <plan>'s files: list, or unstage them`, and the
  non-UTF-8 one); match their register for the sites beside them. A `trace`
  refusal is read mid-run by a coordinator closing a bracket, so its hint names
  the argument or the record state that would let the append or close succeed -
  and where a bracket cannot be closed because the record is unreadable, it says
  what to inspect rather than prescribing a re-run that would append a second
  bracket.
- **Verify:** The same JSON filter as task 1 with the range `>= 2600` and
  `< 4300` prints `0`.
  `node cadence-core/bin/planning.mjs lease-check --dir .planning` and `node
  cadence-core/bin/planning.mjs trace close --dir .planning` each print a
  non-empty `hint`. `node cadence-core/bin/test.mjs planning` reports 0
  failures.

### Task 5: The risk, task-record, adjudication and deferred refusals name their next step

- **Files:** cadence-core/bin/planning.mjs
- **Action:** Close every site the check names across `cmdRiskCheckRun`,
  `cmdRiskCheckStatus`, `cmdTaskRecord`, `fireIdentity`, `fireHome`,
  `cmdAdjudication`, `cmdDeferredRecord`, `cmdDeferredList` and
  `cmdDeferredCarry` - 31 at plan time, roughly lines 4360-6180. Six of these
  commands already carry hints (`name a --base and --head this repository can
  resolve, then re-run this check`, `restore or re-write the record for this
  fire, then append the receipt`, `pass the figures the adjudication seam
  returned for this fire (round <n>)`, and the two unreadable-queue lines) -
  they are the register to match, and a new hint next to one of them must not
  contradict it. `risk_surface` is blocking at every stakes level, so a refusal
  here stops a phase: the hint must name the action that unblocks it and must
  never suggest skipping the gate. `cmdDeferredCarry`'s existing hint warns that
  an unreadable queue must be repaired BEFORE `milestone-prune` deletes the
  directory - hints added beside it keep that ordering.
- **Verify:** The same JSON filter as task 1 with the range `>= 4300` and
  `< 6300` prints `0`.
  `node cadence-core/bin/planning.mjs risk-check status --dir .planning` and
  `node cadence-core/bin/planning.mjs deferred carry --dir .planning` each print
  a non-empty `hint`. `node cadence-core/bin/test.mjs planning` reports 0
  failures.

### Task 6: The renumber, capture, debt and milestone-close refusals name their next step

- **Files:** cadence-core/bin/planning.mjs
- **Action:** Close every site the check names across `cmdRenumber`,
  `cmdCapture`, `cmdCaptureSections`, `cmdDebtHarvest`, `cmdMilestonePrune` and
  the dispatch block at the foot of the file - 30 at plan time, roughly lines
  6380-7400. Three constraints here are load-bearing:
  `cadence-core/bin/planning.test.mjs` asserts that on the arm where git's state
  could not be READ, neither `detail` nor `hint` matches `/commit or discard/` -
  an unreadable repository cannot perform that remedy - so the renumber hints
  must distinguish "git said there is uncommitted work" from "git could not
  answer" and only the first may prescribe committing or discarding.
  `cmdMilestonePrune` already carries a byte-exact hint pinned by
  `milestone-prune.test.mjs` about phase directories surviving a close; leave it
  and match its register. And the dispatch-level `bad-args` at the foot of the
  file is the single most-hit refusal in the plugin, since it renders every
  argument-contract violation through `argRefusal` - its hint must send the user
  to the flag spelling the detail names and must NOT promise that a bare `--`
  separator protects a positional, because `parseArgs` in this file treats any
  `--`-prefixed token as a flag that consumes the next word (recorded and not
  fixed, re-verified 2026-08-08; source: CAPTURE.md, phase 1).
- **Verify:** The same JSON filter as task 1 with the range `>= 6300` prints
  `0`. `node
  cadence-core/bin/planning.mjs milestone-prune --dir .planning` and `node
  cadence-core/bin/planning.mjs recall --query --dir .planning` - the second
  being the dispatch-level `argRefusal` path - each print a non-empty `hint`
  with `reason` still `bad-args`. `node cadence-core/bin/planning.mjs
  nosuchsubcommand` still prints NO hint, because `usage` is excluded by D-03. `node cadence-core/bin/test.mjs planning`
  reports 0 failures, including the renumber unreadable-git test.

### Task 7: The count reaches zero and the tree is green

- **Files:** cadence-core/bin/planning.mjs, cadence-core/bin/planning.test.mjs
- **Action:** Run the check over the whole tree and close whatever it still
  names - the residue this plan's five sweep tasks and plan 2's six did not
  reach, including any site whose reason is an expression rather than a literal.
  Then record the two integers AC2 asks the phase SUMMARY to state: the in-scope
  site count and the hintless in-scope count, the second being 0. Do not close a
  remaining entry by widening the exclusion register or by narrowing the rule -
  the register is what plan 1 locked and AC6 pins, and an exclusion added here to
  make a number go green is the silencing this check exists to prevent. If a
  shipped assertion in `cadence-core/bin/planning.test.mjs` reads a `hint` field
  and a new hint moves it, adjust that assertion to the new text; never change a
  test's expected REASON string, which AC4 forbids.
- **Verify:** `node cadence-core/bin/self-verify.mjs --root .` prints
  `"ok":true` with `"problems":[]`. `node cadence-core/bin/test.mjs` reports 0
  failures across every group. `node --input-type=module -e "import
  {refusalSites} from './cadence-core/bin/lib/refusal-hints.mjs'; const
  s=refusalSites('.'); console.log(s.length, s.filter(x=>!x.hinted).length);"`
  prints two integers whose second is `0`. `node cadence-core/bin/weight.mjs`
  reports every budgeted surface within its pin. `git diff --name-only
  main...HEAD` lists no path under `cadence-core/workflows/`,
  `cadence-core/references/` or `skills/cad-*-contract/`.

## Notes

- Plan ordering is PLAN-1, then PLAN-2, then PLAN-3, sequential. Task 7 here can
  only pass once PLAN-2 has closed the other twelve CLIs, which is what makes
  this plan last rather than merely file-disjoint from PLAN-2.
- `cadence-core/bin/planning.test.mjs` is declared as a lease for task 7's
  narrow case only. The phase expects no test edit: hints ride as a conditional
  key (D-10) and no shipped `deepStrictEqual` compares a whole refusal envelope.
- The line-range checks in the Verify fields are a coarse progress signal over
  the check's own output, not the boundary of the work. The authority in every
  task is the check: an entry naming this file that the task's range missed
  still belongs to whichever task owns its command family.
