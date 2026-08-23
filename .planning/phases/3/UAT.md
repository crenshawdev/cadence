---
status: testing
phase: 3
fields_version: 1
started: 2026-08-23
updated: 2026-08-23
---

## Items

### 1. Task record written and reachable by recall
expected: .planning/tasks/<slug>/RECORD.md exists with a '## Commits' table and '- **Files:**' lines, and `planning.mjs recall "<terms naming what that task did>"` returns that RECORD.md among its hits. Run against a repo with no .planning/ at all: no directory is created, no record is written, and the envelope states the reason.
criterion: AC1
status: pass
first_pass: pass
source: verifier
evidence: recall 'plan size ceiling max_plan_tasks task count' returns tasks/bound-plan-size/RECORD.md at rank 4 of 5 with no phase key; the record carries a '## Commits' table of 40-char shas and a '- **Files:**' line. Writer exercised in an isolated repo: derived-not-retyped (commits and files read off the range), byte-identical on re-run, '../escape' slug refused, and with no .planning/ present it created nothing and answered written:false with the reason 'no planning root at <path>, and this command creates neither it nor tasks/'.

### 2. /cad-why resolves a task-touched file to its task
expected: `node cadence-core/bin/why.mjs <a file named in a real task RECORD.md>` renders that commit as the task's slug (an off-roadmap task) instead of printing a gap block.
criterion: AC2
status: pass
first_pass: pass
source: verifier
evidence: why.mjs cadence-core/templates/config.json renders 093408c9 as 'off-roadmap task bound-plan-size - a /cad-task run, not a roadmap phase (tasks/bound-plan-size)' with 'declared by: declared in RECORD.md', no gap block, no phase number. Tier ordering holds: a sha in both a phase SUMMARY and a task record still resolves to the phase (why-corpus.test.mjs named cases pass).

### 3. Phase-0 bracket pairs under a per-run correlation id
expected: `planning.mjs trace render --phase 0` shows the run's bracket paired under a per-run correlation id with cad-task in the roles block; on the inline arm token and turn totals read 'unrecorded' and that arm's trace holds zero lifecycle/dispatch events. Two runs of the same slug produce two brackets, neither listed under unpaired.
criterion: AC3
status: pass
first_pass: pass
source: verifier
evidence: Substantive half verified against an isolated planning root. Two runs of one slug from one unchanged HEAD: brackets 2, unpaired [], roles {cad-task:{dispatches:2, unrecorded:2}} with no tokens and no turns key, and two DISTINCT correlation ids ('0-<sha>-<pid>-1' and '-2'), neither the bare '0'. Abandoning run 1's close leaves exactly one unpaired dispatch from run 1 while run 2 pairs with its own. The item's clause 'that arm's trace holds zero lifecycle/dispatch events' is NOT satisfied and cannot be - see the appended criteria-text gap.

### 4. FST-02 prose pin fails loudly when either line is removed
expected: `node cadence-core/bin/test.mjs` fails when the `risk-check run --phase 0` line is removed from cadence-core/workflows/task.md, and again when the `written: false` withholding sentence is removed, and the failure message names which one is missing.
criterion: AC4
status: pass
first_pass: pass
source: verifier
evidence: Both mutations proved by editing, running and reverting. Removing '--phase 0' fails naming that flag; removing the risk_check withholding sentence fails naming the withholding. Distinct messages, each naming its own subject. Tree restored - git diff --stat empty.

### 5. task.md names no planning machinery
expected: grep for cad-context, cad-plan-checker and cad-verify in cadence-core/workflows/task.md returns nothing.
criterion: AC5
status: pass
first_pass: pass
source: verifier
evidence: ROADMAP criterion 5 holds: cad-plan-checker and cad-verify appear nowhere in cadence-core/workflows/task.md, and no workflow.max_dispatch_tokens.cad-task key was added. cad-context appears exactly twice (:35, :254), both routing work OUT to the phase spine and both byte-unchanged by this phase's commits. The item's expected text ('returns nothing') is literally false against the shipped file - see the appended criteria-text gap.

### 6. Self-verify clean and full suite green
expected: `node cadence-core/bin/self-verify.mjs --root .` returns ok:true with problems: [], and `node cadence-core/bin/test.mjs` reports 0 failures.
criterion: AC6
status: pass
first_pass: pass
source: verifier
evidence: self-verify.mjs --root . -> ok:true, problems: []. test.mjs -> 2903 tests, 2903 pass, 0 fail.

### 7. A live /cad-task run records, brackets once, and reports its path
expected: Running /cad-task end to end in a session writes the RECORD.md, opens and closes its bracket exactly once, and reports the record's path in its done block. (human-verify: needs a live /cad-task session)
criterion: AC7
status: pass
first_pass: pass
source: model
evidence: Live /cad-task run on this repository, slug task-record-slug-filter. Record written: .planning/tasks/task-record-slug-filter/RECORD.md (envelope written:true, commits:1, files:2). Bracket opened and closed exactly once: `trace render --phase 0` returns brackets:[{corr:0-f9e486d1-1140123-1787505432, plan:task-record-slug-filter, role:cad-task, event:return, ms:103095, tokens:null}], roles:{cad-task:{dispatches:1, unrecorded:1}}, unpaired:[]. The done block printed the Record: line naming that path.

### 8. AC3 and AC5 carry clauses the delivery deliberately contradicts, and neither CONTEXT nor SUMMARY records the change
expected: behavior wrong - the criteria text, not the code. AC3/item 3's 'that arm's trace holds zero lifecycle/dispatch events' is incompatible with the bracket the same criterion demands (a role row and a paired bracket exist only because a dispatch event does), and AC5/item 5's 'a grep for cad-context ... returns nothing' is false against a file this phase never touched on those two lines. PLAN-3.md's Notes state both re-readings; CONTEXT.md's acceptance criteria and the generated UAT items were never amended, and SUMMARY.md's Deviations section says 'None - plans executed as written'. A human walking items 3 and 5 literally fails two items whose behavior is correct, and the phase record then disagrees with itself about what was contracted.
origin: verifier
status: pass
first_pass: fail
source: model
evidence: Retest after b5a64248. CONTEXT.md AC3 now reads 'no lifecycle/dispatch event on that arm names any role but cad-task' and carries a dated amendment note citing PLAN-3.md's Notes; AC5 now reads 'a grep for cad-plan-checker and cad-verify returns nothing, and the cad-context count stays at exactly 2 with both sentences byte-identical - :35 and :254' with the same note. SUMMARY.md's Deviations section now records both as delivered-as-re-read instead of 'None - plans executed as written'. Live counts against the shipped file: grep -c cad-context -> 2, grep -c 'cad-plan-checker|cad-verify' -> 0. The phase record no longer disagrees with itself.
reported: behavior wrong - the criteria text, not the code. AC3/item 3's 'that arm's trace holds zero lifecycle/dispatch events' is incompatible with the bracket the same criterion demands (a role row and a paired bracket exist only because a dispatch event does), and AC5/item 5's 'a grep for cad-context ... returns nothing' is false against a file this phase never touched on those two lines. PLAN-3.md's Notes state both re-readings; CONTEXT.md's acceptance criteria and the generated UAT items were never amended, and SUMMARY.md's Deviations section says 'None - plans executed as written'. A human walking items 3 and 5 literally fails two items whose behavior is correct, and the phase record then disagrees with itself about what was contracted.
severity: minor
cause: Confirmed, and it is a documentation-consistency defect, not a code one. PLAN-3.md:253 and :263 recorded both re-readings at plan time ('AC3's third clause, read literally, contradicts its first'; 'AC5's grep, read literally, already fails against the shipped file'), but nothing carried them back: CONTEXT.md's AC3 and AC5 were never amended, and SUMMARY.md's Deviations says 'None - plans executed as written'. Verified independently: task.md:35 and :254 are the two cad-context mentions and both route work OUT to the phase spine (the too-big arm and the scope-growth guardrail), so AC5's literal grep can never return nothing; and the live run above shows one lifecycle/dispatch on the inline arm, which is exactly what produces the paired bracket and the roles.cad-task row AC3's first clause demands, so AC3's third clause is self-contradictory. Root cause: the plan is the only place the re-reading is written down, and no step propagates a plan-time re-reading of an acceptance criterion back to CONTEXT or into SUMMARY's Deviations.
fix: b5a64248, retest

### 9. Run /cad-task end to end in a live session on this repository and read back its done block and `planning.mjs trace render --phase 0`
expected: .planning/tasks/<slug>/RECORD.md is written; `trace render --phase 0` shows exactly one new paired bracket for that slug with role cad-task under a correlation id that is not the bare '0' and nothing new in `unpaired`; the done block prints a `Record:` line naming the record's path.
origin: verifier
why_human: Out of reach, not merely unexercised. The behavior is an interactive slash-command session driven by the coordinator's own context, which no probe in this pass can launch. It must also run against the LIVE .planning/ tree to be the check it claims to be, and a verification pass is barred from mutating it: an abandoned or partial probe run would append a permanent unpaired cad-task dispatch to .planning/trace.jsonl and misprice this milestone's per-role accounting forever. Every part of it a probe CAN reach was executed against an isolated planning root and passed (record written and byte-stable, bracket paired per-run, second run not mis-funded by an abandoned first, prose and flags declared and pinned).
status: pass
first_pass: pass
source: model
evidence: Same live run. Exactly one new paired bracket for slug task-record-slug-filter with role cad-task, under correlation id 0-f9e486d1-1140123-1787505432 - a per-run anchor derived from the start sha f9e486d1 plus a run token, not the bare '0'. unpaired:[] - nothing new stranded. Stored corr on the four events this run wrote is the per-run id; the ten pre-existing phase-0 events still store the bare '0' on disk. The done block printed `Record: .planning/tasks/task-record-slug-filter/RECORD.md` and that file exists, committed at c3a054d7.

## Summary

total: 9
passed: 9
failed: 0
pending: 0
skipped: 0
blocked: 0
reworked: 1
