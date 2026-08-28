---
status: testing
phase: 1
fields_version: 1
started: 2026-08-28
updated: 2026-08-28
---

## Items

### 1. execute.md's FAIL branch names the cad-executor owner and bans coordinator writes
expected: cadence-core/workflows/execute.md's blocking-gate FAIL arm names a continuation cad-executor dispatched under worker key <k>, its prompt carrying the plan file, the persisted findings path and the fix instruction; its <guardrails> states the coordinator issues no Edit or Write outside .planning/
criterion: AC1
status: pass
first_pass: pass
source: verifier
evidence: execute.md:332-353 (continuation cad-executor, worker key <k>, plan file, persisted REVIEW-risk_surface-plan-<k>.md path, blocker/high-only instruction, no-rotation instruction) and :581-582 (guardrail, stated by path)

### 2. Every plan-key FAIL site names the same dispatch; the inline path is carved out
expected: execute.md's risk_surface and diff-at-adjudicated arms, references/execute-parallel.md's per-plan risk sequence and workflows/task.md's --plan path all name the dispatch; task.md's inline path states it has no plan key and no dispatch, so its FAIL stays with the user
criterion: AC2
status: pass
first_pass: pass
source: verifier
evidence: execute.md:332 and :392-394; references/execute-parallel.md:40-44 (main tree, never a worktree); workflows/task.md:189-197 (--plan path, key `1`, lease gate skipped) and :198-204 (inline path mints no key)

### 3. Widening the lease is what clears the fix commit
expected: lease-check answers undeclared-files naming the path before the amendment, and ok:true for the same staged set after PLAN-<k>.md's files: is widened - with no exemption flag added to the seam
criterion: AC3
status: pass
first_pass: pass
source: verifier
evidence: planning-lease-check.test.mjs 'widening the plan's files: is what clears the fix commit' passes: undeclared-files naming src/helper.js and exit 1 first, ok:true / declared 2 after the amendment alone; lease-check.mjs untouched in the range

### 4. The re-arm read-back is keyed per plan
expected: With a plan-1 rearm already on the record for a trigger, asking for plan 1 returns 1 and plan 2 returns 0, so plan 2's narrowed re-fire still runs
criterion: AC4
status: pass
first_pass: pass
source: verifier
evidence: triage-gate.md:147 gains `&&(o.plan??"")===(process.argv[3]??"")`; prose-agreement test 'RUN, answers per PLAN' executes the fenced block against a real-seam record and gets 1 for plan 1, 0 for plan 2

### 5. The fix commit lands inside a second cad-executor bracket
expected: On an in-test fixture phase, .planning/trace.jsonl holds a second dispatch and a matching close under the original worker key <k> for cad-executor, and the fix commit's sha falls inside that bracket's window
criterion: AC5
status: pass
first_pass: pass
source: verifier
evidence: trace.test.mjs:1386-1453 passes: 2 dispatches, 2 closes, role cad-executor on both, commit %ct inside the second bracket's whole-second window, on an mkdtempSync fixture driven through the real trace seam

### 6. prose-agreement reddens if the FAIL branch or the guardrail is lost
expected: node cadence-core/bin/prose-agreement.test.mjs fails when execute.md's FAIL-branch dispatch instruction is deleted, and fails separately when the <guardrails> no-Edit/Write line is deleted
criterion: AC6
status: pass
first_pass: pass
source: verifier
evidence: Mutation-tested on a git-archive copy in scratch: reverting the FAIL arm reddens only the FAIL-arm test; deleting only the guardrail bullet reddens only the guardrail test

### 7. Full suite green and self-verify clean after the zero-headroom edits
expected: node cadence-core/bin/test.mjs is green and node cadence-core/bin/self-verify.mjs reports ok:true, with no budget-overrun for any of the six files D-17 measured at zero headroom
criterion: AC7
status: pass
first_pass: pass
source: verifier
evidence: test.mjs 3506 pass / 0 fail / 1 skipped; self-verify ok:true, problems []; weight.mjs reports no overrun with the four raised budgets

### 8. execute.md's new guardrail contradicts its own worktree settings-fix step
expected: behavior wrong - two instructions in one file cannot both be obeyed. The guardrail at execute.md:581-582 forbids the coordinator any Edit/Write outside .planning/ with no exception clause, while execute.md:186-190 requires the coordinator to merge `"worktree": {"baseRef": "head"}` into the project's .claude/settings.json or ~/.claude/settings.json on the user's accept. config.md:188-192 confirms that write is the model's own, through no seam.
origin: verifier
status: pass
first_pass: fail
source: model
evidence: Commit 4577ab1d. execute.md:581-583 now reads "no `Edit` or `Write` against a path outside `.planning/`, with the single exception of the `choose_path` settings merge the user accepted through the ask-user seam"; the choose_path site at :186-193 is unchanged and is the exception named, so the two instructions no longer conflict. `node cadence-core/bin/prose-agreement.test.mjs` -> 52 pass / 0 fail (AC6's assertion matches the substring ahead of the new clause and is untouched). `node cadence-core/bin/test.mjs` -> 3506 pass / 0 fail / 1 skipped. `node cadence-core/bin/self-verify.mjs` -> ok:true. weight-budgets.json re-pinned 33485 -> 33594, no budget-overrun. risk-check on HEAD~1..HEAD -> matches [], so no gate fired on the fix.
reported: behavior wrong - two instructions in one file cannot both be obeyed. The guardrail at execute.md:581-582 forbids the coordinator any Edit/Write outside .planning/ with no exception clause, while execute.md:186-190 requires the coordinator to merge `"worktree": {"baseRef": "head"}` into the project's .claude/settings.json or ~/.claude/settings.json on the user's accept. config.md:188-192 confirms that write is the model's own, through no seam.
severity: major
cause: CONTEXT D-13 fixed the guardrail's wording by PATH and enumerated the writes that wording permits - the `plan` gate's PLAN*.md fix, the `summary` and `state` writes, and D-01's lease amendment. All four are inside `.planning/`, so the guardrail was written absolute and with no exception clause. The enumeration was incomplete: `choose_path` (execute.md:186-193) already required the coordinator to merge `"worktree": {"baseRef": "head"}` into the project's `.claude/settings.json` or `~/.claude/settings.json` on the user's accept, and workflows/config.md:188-192 confirms that write is the model's own through no seam. The guardrail was therefore measured against an incomplete inventory of this workflow's own writes, not against the file as it stands.
fix: 4577ab1d, retest

### 9. Run /cad-execute on a phase whose plan trips the risk_surface gate to a FAIL, and watch who edits the source
expected: The coordinator dispatches a continuation cad-executor under the failing plan's key and makes no Edit/Write of its own outside .planning/; .planning/trace.jsonl shows a second dispatch and close for that key around the fix commit
origin: verifier
why_human: Out of reach of any probe here, not merely unexercised: it needs a live multi-agent /cad-execute run against a real review provider, and no artifact records the answer even afterwards - .planning/reads.jsonl captures only the five read-shaped tools (hooks/hooks.json:16-27, lib/read-trace.mjs RECORDED_TOOLS), so a coordinator write inside the fix window leaves no trace to grep. Recording writes was deliberately deferred out of this phase (CONTEXT, Deferred). A person watching the run is the only observer of the ROADMAP's 'zero coordinator writes' clause.
status: skipped
reported: skip will check next run after clear
reason: Deferred to the next live /cad-execute run in a fresh session - the user will watch who edits the source on a real risk_surface FAIL.

## Summary

total: 9
passed: 8
failed: 0
pending: 0
skipped: 1
blocked: 0
reworked: 1
