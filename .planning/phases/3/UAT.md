---
status: testing
phase: 3
fields_version: 1
started: 2026-08-20
updated: 2026-08-20
---

## Items

### 1. risk-check run records an empty range as a completed check
expected: A range whose diff body is empty answers checked:true, inconclusive:false, matches:[], empty:true and writes that record; a revert pair whose base_id differs from head_id but whose net diff is empty reads the same; a range whose diff read FAILS still answers checked:false, inconclusive:true. Tests pin all three.
criterion: AC1
status: pass
first_pass: pass
source: verifier
evidence: risk-diff.mjs:328 splits the empty-body arm to checked:true, inconclusive:false, matches:[], empty:true while :321 keeps the unreadable arm at checked:false; planning.mjs:4043/:4057 carry it onto both the trace record and the envelope. risk-diff.test.mjs 74/74 through the real CLI, including the same-commit row, the revert-pair row that asserts base_id !== head_id, and the unreadable-range row. Collapsing the split in a scratch copy reddens 4 rows.

### 2. risk-check status accepts the empty record as recorded
expected: risk-check status over the empty-range record returns ok:true with the row's state `recorded` (it refused risk-record-missing before). Reverting the run-side split reddens the test. A record written under the old shape, carrying no empty field, does NOT read as empty.
criterion: AC2
status: pass
first_pass: pass
source: verifier
evidence: planning.mjs:4370 reads `empty: e.empty === true` and nothing else changed - no fifth state, no new fire clause. The end-to-end row (risk-diff.test.mjs:572) runs the seam then asserts state `recorded`, missing undefined; the scratch revert of the run-side split fails exactly that row. The pre-fix-shape row (:601) still refuses risk-record-missing with state `unchecked`.

### 3. /cad-execute <N> --rerun completes with no override of a blocking gate
expected: Running /cad-execute against a phase whose tasks are all already satisfied runs to completion without the user overriding a blocking gate, and the outcome is transcribed here. (human-verify: needs a live /cad-execute run)
criterion: AC3
status: pass
first_pass: pass
reported: call it a match

### 4. An unjudged non-empty range still fires the gate
expected: A range that CONTAINS commits but whose diff cannot be judged (binary-only, gitlink) still answers inconclusive:true and still fires, with a test keeping that arm green.
criterion: AC4
status: pass
first_pass: pass
source: verifier
evidence: parseDiff's hunks===0 arm untouched; risk-diff.mjs:372 keeps inconclusive:unreadable, empty:false. Binary-only, gitlink, INCONCLUSIVE-satisfies-the-record-half and failed-read rows all green in the same 74/74 run. No workflows/ or references/ file appears in `git diff --stat dc4c4b1..HEAD`, so the prose fire rule is unchanged (D-05).

### 5. lease-check exempts a rotated report
expected: Staging plan-<k>.<n>.md alongside plan-<k>.md during a task commit returns no undeclared-files, and the test fails against the old byte-equality exemption. Staging plan-2.md or plan-11.md under plan 1's lease still reports undeclared-files.
criterion: AC5
status: pass
first_pass: pass
source: verifier
evidence: planning.mjs:2472-2477 + :2491 replace byte equality with "directly in this plan's reports/ AND isReportName(k, name)". planning.test.mjs:5618 spawns the CLI: plan-1.md + plan-1.1.md is ok:true, staged still 2; plan-1.12.md too. Reverting to `p !== reportFile` in a scratch copy fails exactly that row.

### 6. The report exemption stays bounded
expected: Staging plan-<k>-risk.diff or plan-<k>-risk-task-<n>.diff still reports undeclared-files, and a staged PLAN-1.1.MD is not exempted.
criterion: AC6
status: pass
first_pass: pass
source: verifier
evidence: planning.test.mjs:5642 loops plan-2.md, plan-11.md, plan-1-risk.diff, plan-1-risk-task-2.diff, PLAN-1.1.MD and old/plan-1.1.md, each ok:false with the path NAMED in undeclared. report-rotation.mjs:128 carries no 'i' flag; adding one in a scratch copy fails both the rotation row and the lease row.

### 7. self-verify is clean and the rotated-name grammar is stated once
expected: node cadence-core/bin/self-verify.mjs --root . returns ok:true with an empty problems array; the rotated-name grammar has exactly one statement in cadence-core/bin/lib/report-rotation.mjs, with no second regex in cmdLeaseCheck.
criterion: AC7
status: pass
first_pass: pass
source: verifier
evidence: self-verify.mjs --root . -> ok:true, problems:[] (25 checks); tsc -p tsconfig.ci.json exits 0. rotatedSource is stated once (report-rotation.mjs:99) and consulted by isReportName and rotationTarget; planning.mjs holds no copy of the pattern. The helper-census row (helper-census.test.mjs:148) keys on the pattern source and reddens naming both files when it is pasted back into planning.mjs.

### 8. A diff driver cannot present a risky range as empty
expected: With a checked-in .gitattributes diff=<driver> bound to a command that prints nothing, risk-check run over a range that changed a file to a recursive delete still answers empty:false with a destructive match - the seam reads with --no-ext-diff --no-textconv.
status: pass
first_pass: pass
source: verifier
evidence: planning.mjs:3996 reads with --no-ext-diff --no-textconv. risk-diff.test.mjs:361 proves the fixture really suppresses the plain diff, then asserts empty:false with matches ['destructive'] on envelope and record. Dropping either flag in a scratch copy fails exactly that row.

### 9. The phase's own round-1 risk_surface receipt cites the amended sha, so the phase-wide risk-check status refuses
expected: behavior wrong - the `rearm` receipt written for round 1 carries sha 95ba7b2 (the fix commit, later amended to f5efcb4 and now unreachable: `git merge-base --is-ancestor 95ba7b2 HEAD` -> NOT-ancestor) instead of the reviewed head 31c2085, so no receipt settles the first matched record.
origin: verifier
status: pass
first_pass: fail
source: model
evidence: Appended outcome/adjudication for corr 3-dc4c4b1, trigger risk_surface, plan 1, base dc4c4b1, sha 31c2085, raised 1 survivors 1 downgraded 0 refuted 0 - the rulings ADJUDICATION-risk_surface-plan-1.json already holds. `node cadence-core/bin/planning.mjs risk-check status --phase 3` now returns ok:true with the plan-1 row state `recorded`, where it read `risk-fire-missing`/`unfired` before. No commit: .gitignore:29 excludes .planning/trace.jsonl. The wrong rearm line remains in the record beside the correction - the trace is append-only and nothing was rewritten.
reported: behavior wrong - the `rearm` receipt written for round 1 carries sha 95ba7b2 (the fix commit, later amended to f5efcb4 and now unreachable: `git merge-base --is-ancestor 95ba7b2 HEAD` -> NOT-ancestor) instead of the reviewed head 31c2085, so no receipt settles the first matched record.
severity: minor
cause: Coordinator error in the execute run, not a code defect. triage-gate.md states the rearm receipt's --sha is what makes the round a receipt for the range it re-armed on; round 1 fired on dc4c4b1..31c2085, so the receipt owed --sha 31c2085. I passed 95ba7b2, the fix commit, which names the range the round produced rather than the range it settled. I then amended 95ba7b2 to f5efcb4 to drop a detector-matching literal from a comment, so the cited sha now resolves to nothing at all. No receipt therefore joins the first matched risk_check record, and the phase-wide arm of risk-check status reads the range as unfired.
fix: trace append adjudication dc4c4b1..31c2085 (no commit - .planning/trace.jsonl is gitignored), retest

### 10. Run /cad-execute <N> --rerun against a phase whose tasks are all already satisfied, and transcribe the outcome into .planning/phases/3/UAT.md item 3
expected: The run reaches completion with no user override of a blocking gate: the risk-check run over the empty committed range answers checked:true, inconclusive:false, matches:[], empty:true, and the following `risk-check status --phase <N> --plan <k> --base {pre-plan HEAD} --head HEAD` returns ok:true with state `recorded` rather than refusing risk-record-missing.
origin: verifier
why_human: Out of reach, not merely unexercised: /cad-execute is a slash command dispatched into an interactive Claude Code session with a live coordinator and subagent spend, and the criterion is specifically that no HUMAN override was needed - which only a human sitting in that run can observe. The seam halves it rests on are already verified end to end here (truths 1 and 2, both driven through the real CLI), and D-11 records that the machine trace of the run is gitignored, so the transcription into UAT.md is the only durable record.
status: pass
first_pass: pass
reported: call it a match

## Summary

total: 10
passed: 10
failed: 0
pending: 0
skipped: 0
blocked: 0
reworked: 1
