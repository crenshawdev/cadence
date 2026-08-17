---
status: testing
phase: 4
fields_version: 1
started: 2026-08-17
updated: 2026-08-17
---

## Items

### 1. Dispatch-window ceiling is a config key and trace reports a per-role crossing
expected: config.schema.json holds a key naming the dispatch-window ceiling in tokens, and `planning.mjs trace window` run against this repo's trace.jsonl prints at least one budget-overrun-shaped crossing ({kind, file, detail: "<n> exceeds budget <m> by <d>"}) naming the role that crossed.
criterion: AC1
status: pass
first_pass: pass
source: verifier
evidence: config.schema.json:32-37 six per-role int keys; planning.mjs:3265-3305 resolves them through mergeLayers into windowBudget(r.brackets); live `trace window --phase 4` printed 4 `budget-overrun` problems naming cad-executor and cad-planner with n/m/delta, compared 18, unbudgeted {"(no role)":1}, unrecorded 2; CONTRACTS row at self-verify.mjs:382.

### 2. The ceiling's value is argued in shipped prose, and nothing is refused
expected: Shipped prose argues the ceiling from named trace.jsonl keys with the per-role figures behind it, and the crossing is a finding only - no dispatch is refused and the run completes.
criterion: AC2
status: pass
first_pass: pass
source: verifier
evidence: seams.md:67-95 argues each default as that role's p75 terminal `tokens` on brackets[] rows rounded up to 25,000, with n/p75/max per role, and states the ceiling is READ never applied; reach grep finds no dispatch-path, agent-frontmatter or spawn-seam consumer - only planning.mjs's report, report.md:43 and the six config-reach.md:125-130 'trace window report only' rows; the live run returned ok:true with crossings and refused nothing.

### 3. The bulk-output rule is stated exactly once
expected: `grep -rn` over cadence-core/ finds the bulk-output rule statement in references/conventions.md and in no other file; a frozen register lives in cadence-core/bin/lib/ and the rule module carries no copy of the statement.
criterion: AC3
status: pass
first_pass: pass
source: verifier
evidence: `grep -rn 'rides a file, not the transcript'` over cadence-core/, agents/ and skills/ returns exactly conventions.md:97; the 17-row register plus pure rule in bin/lib/bulk-output.mjs carries a pointer and no copy; the test assembles the clause from halves so it is not its own second carrier.

### 4. self-verify bites when a registered bulk-output site regresses
expected: `node cadence-core/bin/self-verify.mjs` reports a named problem when a registered bulk-output site is edited back to riding the transcript, and reports an unclassified site rather than skipping it.
criterion: AC4
status: pass
first_pass: pass
source: verifier
evidence: bulkOutputIssues on the shipped triage-gate.md returns []; with the redirect stripped it returns `bulk-output-inline` naming that file; an unregistered call returns `bulk-output-unregistered` rather than being skipped. Wired at self-verify.mjs:184/:868 with ok = problems.length===0 at :1460; full-tree run ok:true, problems [].

### 5. max_plan_tasks carries a written decision on a bound surface
expected: workflow.max_plan_tasks carries a written decision on a surface self-verify binds, naming both forces with a measured figure behind each (checkpoint count from trace.jsonl, per-role dispatchBytes from weight.mjs resident) and the value it lands on.
criterion: AC5
status: pass
first_pass: pass
source: verifier
evidence: design-notes/dd-plan-task-ceiling.md plus the schema `purpose` and config-catalog.md:30 both state the 2026-08-17 re-decision landing on 8; probes reproduce 12,488 executor dispatchBytes and 22/16 checkpoints (note dated 21/15 and flags the numerator as live); every surviving checkpoint-bearing plan file has 3-7 tasks.

### 6. Each falsifier carries a WATCHED FAILING AT sha that actually fails
expected: For MSR-03, TRN-02 and PLN-01 a check carries a `WATCHED FAILING AT <sha>` header, and running that check against the SHA it names exits non-zero; the audit extracts each SHA per line rather than counting occurrences.
criterion: AC6
status: pass
first_pass: pass
source: verifier
evidence: Per-line SHA extraction: window-budget.test.mjs:249 9b1fe53, prose-agreement.test.mjs:1236 86cd45d, :1350 617a2a1. Re-watched in detached worktrees at each named SHA with the current test file copied in: exit 1 in all three, each on the intended assertion; worktrees removed.

### 7. Full suite and self-verify green, pins and CONTRACTS current
expected: `node --test cadence-core/bin/*.test.mjs` and `node cadence-core/bin/self-verify.mjs` both exit 0, with weight-budgets.json re-pinned for every edited surface and a CONTRACTS row for any new flag or subcommand.
criterion: AC7
status: pass
first_pass: pass
source: verifier
evidence: `node --test cadence-core/bin/*.test.mjs` exit 0, 2150/2150 pass; `node cadence-core/bin/self-verify.mjs` exit 0 with empty problems across 24 checks (budgets check green implies the re-pins landed); `trace window` CONTRACTS row present.

## Summary

total: 7
passed: 7
failed: 0
pending: 0
skipped: 0
blocked: 0
reworked: 0
