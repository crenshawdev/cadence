---
status: testing
phase: 1
fields_version: 1
started: 2026-08-05
updated: 2026-08-05
---

## Items

### 1. Executor returns a five-field digest and its report is in git history
expected: The cad-executor contract's terminal-message section specifies exactly five fields (status, task count, commit range, deviation count, open-item count) with no `| Task | Commit | Note |` table, and `git show 2953950 --stat` names `.planning/phases/1/reports/plan-1.md`.
criterion: AC1
status: pass
first_pass: pass
source: verifier
evidence: skills/cad-executor-contract/SKILL.md:201-215 - the `<report>` block is PLAN {COMPLETE|PARTIAL} / Tasks: / Commits: / Deviations: / Open items:, followed by 'No task table, no deviation text, no open-item text, no plan-file line, and no report path'. The only `| Task | Commit | Note |` in the file is :189, inside `<report_file>`. `git show 2953950 --stat` names .planning/phases/1/reports/plan-1.md | 220 +++++.

### 2. A PLAN PARTIAL continuation re-runs no completed task
expected: A live cad-executor dispatch returns PLAN PARTIAL; the continuation prompt carries the report PATH (not a task table), and `git log` after the re-run shows no second commit for a task the report already lists complete. (human-verify: needs a live cad-executor dispatch)
criterion: AC2
status: skipped
reason: Behavioral half unobservable until v2.3.0 is the installed plugin - this phase wrote the contract the test needs, and the running plugin is v2.2.0, so no dispatch here exercises it. Prose half verified live at cadence-core/workflows/execute.md:151 (partial arm carries the report PATH) and :195 (handle_checkpoint likewise), with the only 'completed-task table' match at :175 being the prohibition itself. Retest after installing v2.3.0.

### 3. A checkpoint return carries no task table and its flagged diff is readable
expected: A live risk_surface or structural checkpoint returns no task table; the report file exists carrying a `CHECKPOINT` status line, and the flagged diff is readable at the absolute path the checkpoint names. (human-verify: needs a live cad-executor dispatch)
criterion: AC3
status: skipped
reason: Behavioral half unobservable until v2.3.0 is the installed plugin, same cause as item 2. Contract half verified live at skills/cad-executor-contract/SKILL.md:94 (report written with a CHECKPOINT: <type> status line), :105 (no Completed: table on that branch) and :110 (flagged-diff path made ABSOLUTE via git rev-parse --show-toplevel). Retest after installing v2.3.0, on both the sequential and worktree paths.

### 4. Verifier writes one findings file behind an asserted narrow Write grant
expected: The verifier contract names exactly one file under `.planning/phases/<N>/` that is NOT `FINDINGS.json`; all four rungs carry `Write` in `tools:` with `Edit`/`MultiEdit` in `disallowedTools:`; self-verify prints `ok:false` with a `verifier-write-grant` problem when either is removed and `ok:true` when restored; and no hand-transcription step survives in verify-deep.md.
criterion: AC4
status: pass
first_pass: pass
source: verifier
evidence: Contract names one file .planning/phases/<N>/verifier-findings.json (skills/cad-verifier-contract/SKILL.md:150,206,211) and states why not FINDINGS.json (:153-155). All four rungs carry `tools: Read, Write, Bash, Grep, Glob` + `disallowedTools: Edit, MultiEdit` (agents/cad-verifier{,-medium,-xhigh,-max}.md:5,8). Mutation probe on a scratch copy: removing Write from cad-verifier-xhigh gives ok:false kind verifier-write-grant; restoring gives ok:true. Removing Edit from disallowedTools on cad-verifier-medium gives the same kind; restoring gives ok:true. verify-deep.md:17-24 pipes the file into `uat merge --payload` with no transcription step.

### 5. uat merge refuses a bad payload and the deep pass falls through
expected: `planning.mjs uat merge --payload <file>` refuses a missing, empty, literal-`null` and wrong-shape payload with `ok:false`, a named reason and exit 1, leaving UAT.md byte-identical; and a failed deep pass returns to the walk with the checklist unchanged.
criterion: AC5
status: pass
first_pass: pass
source: verifier
evidence: Probed in a scratch copy: missing -> no-payload exit 1; empty -> no-payload '... is empty'; literal null -> bad-payload 'expected a JSON object carrying passes, gaps or human_checks'; "hello" -> same; {"foo":1} -> bad-payload 'payload carries none of passes, gaps, human_checks as an array'; malformed JSON -> bad-payload; bare --payload -> no-payload. md5sum of UAT.md identical before and after every refusal (a936603a3a6e5af3be36fb869f1ecf22). One test row per case at planning.test.mjs:1254,1262,1270,1280,1288,1297,1305. Fall-through wired at verify-deep.md:26 into :47-55.

### 6. No reviewer receives an inlined diff
expected: Every fire site hands a reference - a `{base_ref, head_ref}` pair, a staged-diff scope, or a path - and cross-model gets `--payload <file>`; a non-string artifact is refused `bad-payload` before the cap is consulted.
criterion: AC6
status: pass
first_pass: pass
source: verifier
evidence: Shapes defined at cadence-core/references/review-triggers.md:51-64; the wiring table :202-208 gives all five triggers a shape. Fire sites: execute.md:161-162 (a), :185-188 (c), :222 (a), :232-233 (a); cad-land/SKILL.md:43-46 (a); debug.md and verify.md:191-194 (c/b); task.md:74-77 (a). Cross-model composer takes the artifact path as process.argv[2]; live probe round-tripped quotes, backslashes and $ byte-identically. Non-string artifact probe: {"blob":"y"} -> bad-payload 'payload needs {instruction, artifact}, both strings' exit 1, refused at review-provider.mjs:576-578, one line before assertUnderCap at :579.

### 7. The break-even rule is stated and the cycle is green
expected: `cadence-core/references/seams.md` states when the extra turn pays and which side extracts; `node --test cadence-core/bin/*.test.mjs` and `node cadence-core/bin/self-verify.mjs` both pass, with `weight-budgets.json` regenerated in every commit that edited a budgeted surface.
criterion: AC7
status: pass
first_pass: pass
source: verifier
evidence: cadence-core/references/seams.md:207-220 states when the extra turn pays and that the side with the SMALLER resident context extracts, sitting between Handoff read discipline (:201) and ## Seam: call-review-provider (:221). node --test cadence-core/bin/*.test.mjs -> pass 1147 fail 0; node cadence-core/bin/self-verify.mjs -> ok:true with verifier-write-grant in checked and problems []; npx tsc -p tsconfig.ci.json exit 0. D-17 ratchet re-checked independently: self-verify run against a git archive of all 15 commits in eff04e3..HEAD reports budget-overrun [] at every one, and 0dd055f is byte-neutral (548/535/531/523 before and after).

### 8. cad-verifier's agent description still claims the agent is read-only
expected: Stale prose contradicting the shipped grant: agents/cad-verifier.md:3 says 'Read-only; returns structured findings for cad-verify to merge into UAT.md' while :5 grants Write and skills/cad-verifier-contract/SKILL.md:150 requires it to write verifier-findings.json. The description also still describes findings coming back in the return, which the digest-plus-path design replaced.
origin: verifier
status: pass
first_pass: fail
source: verifier
evidence: agents/cad-verifier.md:3 against agents/cad-verifier.md:5 and skills/cad-verifier-contract/SKILL.md:150,218-224
reported: Stale prose contradicting the shipped grant: agents/cad-verifier.md:3 says 'Read-only; returns structured findings for cad-verify to merge into UAT.md' while :5 grants Write and skills/cad-verifier-contract/SKILL.md:150 requires it to write verifier-findings.json. The description also still describes findings coming back in the return, which the digest-plus-path design replaced.
severity: minor
cause: Deliberate scope deferral, not an oversight: CONTEXT scopes all 29 agent/skill descriptions to phase 3, which measures them against a baseline captured before phase 1, so editing one here moves that baseline mid-cycle. The claim is false as of 0dd055f.
fix: f895731, retest

### 9. uat merge accepts a wrong-shaped sibling list as a successful merge
expected: The envelope check requires only ONE of passes/gaps/human_checks to be an array, so a sibling that is a string is iterated per character. The deep pass reports a merge instead of falling through.
origin: verifier
status: pass
first_pass: fail
source: verifier
evidence: Probe against a scratch copy: {"passes":[],"gaps":"oops","human_checks":[]} -> ok:true with rejected:4, exit 0. UAT.md itself unchanged (the usableName guard drops the phantoms). Envelope check at cadence-core/bin/planning.mjs:607-608.
reported: The envelope check requires only ONE of passes/gaps/human_checks to be an array, so a sibling that is a string is iterated per character. The deep pass reports a merge instead of falling through.
severity: minor
cause: planning.mjs:607-608 tests the disjunction (at least ONE of passes/gaps/human_checks is an array) but never validates the siblings, so a string sibling reaches the for..of and is iterated per character. The usableName guard stops phantom items being written, which is why the damage is confined to an inflated rejected counter.
fix: 16c007d, retest

### 10. execute_parallel step 5 names a per-plan post-merge HEAD that step 3 never records
expected: The ref pair handed to a per-plan diff reviewer is not reconstructible from what the workflow recorded. After all merges only the final HEAD exists.
origin: verifier
status: pass
first_pass: fail
source: verifier
evidence: cadence-core/workflows/execute.md:213-216 records only each branch's pre-merge HEAD, while :222-224 asks for {base_ref: that plan's pre-merge HEAD from step 3, head_ref: HEAD after that plan's merge}.
reported: The ref pair handed to a per-plan diff reviewer is not reconstructible from what the workflow recorded. After all merges only the final HEAD exists.
severity: minor
cause: execute.md:213-216 records only each branch's pre-merge HEAD; :222-224 then asks for the post-merge HEAD per plan, which no step retained. Task 3 wrote the step-3 recording line and task 9 wrote the step-5 consumer, and neither pass reconciled the two.
fix: f5fbe4d, retest

### 11. The task-9 completeness sweep pattern misses a site it converted, and the report's class counts contradict its lists
expected: The sweep grep cannot see cadence-core/workflows/verify.md, which task 9 converted at route_failures, because that file writes 'review-trigger interface' and 'risk-surface' hyphenated. Separately the report labels a six-file list 'NOT a fire site (5)'. All 13 returned files are individually accounted for, so the total is right by coincidence rather than by membership.
origin: verifier
status: pass
first_pass: fail
source: verifier
evidence: grep -n "risk_surface|pre_ship|phase_diff|review trigger|fire(" cadence-core/workflows/verify.md returns nothing, yet .planning/phases/1/reports/plan-1.md:20-21 lists it under CONVERTED (5); the same block's 'NOT a fire site (5)' bullet enumerates six files.
reported: The sweep grep cannot see cadence-core/workflows/verify.md, which task 9 converted at route_failures, because that file writes 'review-trigger interface' and 'risk-surface' hyphenated. Separately the report labels a six-file list 'NOT a fire site (5)'. All 13 returned files are individually accounted for, so the total is right by coincidence rather than by membership.
severity: cosmetic
cause: The sweep pattern greps literal 'risk_surface|pre_ship|phase_diff|review trigger|fire(' but verify.md writes 'review-trigger interface' and 'risk-surface' hyphenated, so the file task 9 converted is invisible to the check meant to prove completeness. The report's class counts (5+3+5) hit 13 by coincidence while one bullet lists six files.
fix: 76668a3, retest

## Summary

total: 11
passed: 9
failed: 0
pending: 0
skipped: 2
blocked: 0
reworked: 4
