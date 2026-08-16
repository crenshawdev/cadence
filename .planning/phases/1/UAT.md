---
status: testing
phase: 1
fields_version: 1
started: 2026-08-16
updated: 2026-08-16
---

## Items

### 1. Pruned-phase recall survives the close, with its origin
expected: After milestone-prune --mode delete over a phase, planning.mjs recall for a term appearing only in that phase's SUMMARY deviation returns the hit, with source naming the SUMMARY origin rather than a flat residue filename. The same run under --mode archive returns the same result.
criterion: AC1
status: pass
first_pass: pass
source: verifier
evidence: Live probe on a fresh fixture, both arms: after `milestone-prune --mode delete --label vP.R.O` (residue_rows 3, phases/1 removed), `recall flombozzle` returned {"source":"vP.R.O/phases/1/SUMMARY.md","phase":1}; identical under --mode archive. A `recall wibbet` kept SUMMARY, UAT and CONTEXT separable as three distinct sources. Residue is written before the directory loop and under a lock (planning.mjs:4517-4573); staging stated at workflows/milestone.md:109-131.

### 2. execute-parallel.md reaches the risk sequence without copying it
expected: grep -c risk-check cadence-core/references/execute-parallel.md returns non-zero, and a check fails when the detector/fire/status sequence is restated there as a second copy of workflows/execute.md's.
criterion: AC2
status: pass
first_pass: pass
source: verifier
evidence: grep -c risk-check = 2 (execute-parallel.md:33,43); the step names `execute_sequential` and says to restate none of it (:31-37). Pasting execute.md's `inconclusive` fire rule into the reference in a detached HEAD worktree took prose-agreement.test.mjs from exit 0 to exit 1 on the PAR-01 no-copy row (:858-887). The range check (:900-934) also reddened on a phase-wide-arm collapse and on a {PHASE_START, HEAD} rewrite.

### 3. A check holds the parallel done-gating sentence
expected: A check asserts execute-parallel.md gates reporting a plan done on the risk-check status call, and that check fails when the gating sentence is removed.
criterion: AC3
status: pass
first_pass: pass
source: verifier
evidence: prose-agreement.test.mjs:889-899 asserts /not reported done while that call refuses/i; deleting that sentence from execute-parallel.md:47 in a worktree flipped the file to exit 1 on exactly that test.

### 4. risk-check status refuses a fired range with no receipt
expected: risk-check status returns ok:false for a range recorded with matches non-empty or inconclusive:true that carries no outcome event under the same correlation id and plan, and ok:true once an adjudication, re-arm, clean-pass or override event exists under that corr+plan.
criterion: AC4
status: pass
first_pass: pass
source: verifier
evidence: Live probe with a real `risk-check run` record (matches:["auth"]): status answered {"ok":false,"reason":"risk-fire-missing","state":"unfired"} exit 1, and {"ok":true,"state":"recorded"} once a receipt existed under the same corr and plan. Seam at planning.mjs:3448, 3719-3735, 3775-3795, 3838-3872. Note the shipped rule is stricter than AC4: the receipt must also name both ends of the range.

### 5. An explicit override clears the gate via --detail-file
expected: An explicit user override appends its own outcome event with its reason carried by --detail-file, after which risk-check status returns ok:true for that range.
criterion: AC5
status: pass
first_pass: pass
source: verifier
evidence: The override append with --detail-file wrote its reason onto the event's `detail` and flipped the identical status call to ok:true; a reasonless override is refused as a receipt (planning.mjs:3723-3732). Transport stated at triage-gate.md:40-47, and self-verify reports no text-transport problem.

### 6. Each new check names the SHA it was watched failing at
expected: Each of the three new checks carries a header comment naming the SHA it was watched failing at, and running that check against that SHA exits non-zero.
criterion: AC6
status: pass
first_pass: pass
source: verifier
evidence: milestone-prune.test.mjs:850 / risk-diff.test.mjs:757 / prose-agreement.test.mjs:845 name 182d2e1, d30ed50 and e4f95a3. Re-watched each in a detached worktree with the current test file copied in: exit 1 in all three, failing on assertions (10/40, 17/62 and 3/23 rows respectively), never on a missing export.

### 7. Whole-tree suite and self-verify are green on the re-pinned counts
expected: node --test cadence-core/bin/*.test.mjs and node cadence-core/bin/self-verify.mjs both exit 0, with the moved count pins and weight-budgets.json re-pinned.
criterion: AC7
status: pass
first_pass: pass
source: verifier
evidence: node --test cadence-core/bin/*.test.mjs -> exit 0 (2066 tests, 0 fail, 1 skipped); node cadence-core/bin/self-verify.mjs -> exit 0, problems []; npx tsc -p tsconfig.ci.json -> exit 0. Five weight-budgets.json rows re-pinned across a32704e..HEAD; the three D-16 count pins unmoved.

### 8. Three of the four documented fire receipts omit --plan, so the new gate cannot be cleared by following the command as written
expected: behavior wrong - the gate joins a receipt on rowKey(corr, plan) (cadence-core/bin/planning.mjs:3734), but the copyable commands for gate_pass, override and rearm carry no --plan, so a receipt written exactly as documented does not settle a per-plan record and risk-check status keeps refusing
origin: verifier
status: pass
first_pass: fail
source: model
evidence: Fixed at 470c281. End-to-end retest in a scratch git repo with a real per-plan risk_check record (matches: untrusted_input, secrets): `risk-check status --phase 1 --plan 1 --base <b> --head <h>` answered {"ok":false,"reason":"risk-fire-missing","state":"unfired"}; running triage-gate.md:36 VERBATIM as it now reads (`trace append --phase 1 --family outcome --event gate_pass --trigger risk_surface --plan 1 --base <b> --sha <h>`) returned {"ok":true,"written":true} and the identical status call flipped to {"ok":true,"state":"recorded"}. Pinned by a new prose-agreement.test.mjs check that reads every fenced `--family outcome` invocation in triage-gate.md and review-triggers.md and demands --trigger, --plan, --base and --sha on each, plus all four settle points present so a deleted block cannot pass vacuously; watched failing at dd3920e -> exit 1, 23/24, on `the gate_pass receipt drops --plan`. weight-budgets.json re-pinned 8726 -> 8759. Whole tree at 470c281: node --test cadence-core/bin/*.test.mjs -> 2066 pass / 0 fail / 1 skipped, node cadence-core/bin/self-verify.mjs -> problems [], npx tsc -p tsconfig.ci.json -> exit 0. The fix commit's own range cleared the blocking gate: risk-check run --base HEAD~1 --head HEAD returned matches [] and status ok:true.
reported: behavior wrong - the gate joins a receipt on rowKey(corr, plan) (cadence-core/bin/planning.mjs:3734), but the copyable commands for gate_pass, override and rearm carry no --plan, so a receipt written exactly as documented does not settle a per-plan record and risk-check status keeps refusing
severity: major
cause: triage-gate.md states the --plan rule in prose at :20 but omits it from the three fenced trace append blocks a coordinator copies verbatim (:36 gate_pass, :47 override, :82 rearm). review-triggers.md:284 inlines it for adjudication AND repeats the rule in prose beneath the block, so only that one settle point is copy-safe. The join is rowKey(e.corr, e.plan) at planning.mjs:3734, so a receipt appended without --plan keys to no plan and settles nothing. Nothing pins the agreement: risk-diff.test.mjs's receiptLine helper always supplies a plan, so the fixtures hand the seam what the prose omits, and PLAN-2 task 3's verify grepped only for --trigger and --detail-file. Confirmed: weight-budgets.json:45 pins triage-gate.md at 8726 which is its exact current byte count, so the edit needs a re-pin in the same commit.
fix: 470c281, retest

## Summary

total: 8
passed: 8
failed: 0
pending: 0
skipped: 0
blocked: 0
reworked: 1
