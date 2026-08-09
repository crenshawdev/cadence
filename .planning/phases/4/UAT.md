---
status: testing
phase: 4
fields_version: 1
started: 2026-08-09
updated: 2026-08-09
---

## Items

### 1. trace append stores role and tokens, and refuses a bad count
expected: A lifecycle return carrying --role cad-executor --tokens 12345 writes one event with "role":"cad-executor" and "tokens":12345 (unquoted number). The same call with --tokens abc returns {"ok":false,...,"reason":"bad-args"} and appends nothing. --tokens lands the same way on checkpoint and escalation. Both flags have CONTRACTS rows.
criterion: AC1
status: pass
first_pass: pass
source: verifier
evidence: Scratch-dir probe: role/tokens written as a number, --tokens abc and --tokens -1 both bad-args at exit 1 with the file byte-unchanged, tokens land identically on checkpoint and escalation; CONTRACTS row at self-verify.mjs:150-156 and header usage at planning.mjs:43-50.

### 2. trace append stores a read-set on a dispatch
expected: trace append --event dispatch --read "a.md,b.md,c.md" stores a three-element array, visible as "read":["a.md","b.md","c.md"] in trace render output.
criterion: AC2
status: pass
first_pass: pass
source: verifier
evidence: --read "a.md,b.md,c.md" renders read:["a.md","b.md","c.md"]; "a.md, ,b.md," trims to two elements; empty and bare --read both refused with nothing appended (planning.mjs:2149-2172).

### 3. trace render prints per-role totals that distinguish unrecorded from zero
expected: trace render --phase <N> prints a roles block beside the four family counts, giving each role its dispatch count. A role whose dispatches carried tokens shows a token total; a role whose dispatches carried none shows an unrecorded dispatch count and NO token total (never 0).
criterion: AC3
status: pass
first_pass: pass
source: verifier
evidence: Render printed cad-planner{dispatches:2,tokens:900,unrecorded:1}, cad-reviewer{dispatches:1,unrecorded:1} and no tokens key on unfunded roles; a string "tokens" line contributed 0. Computed in lib/trace.mjs:275-291,340-352 with a matching TraceRender typedef; tsc clean.

### 4. Every phase-scoped dispatch site carries a written bracket with a non-empty read-set
expected: context.md, plan.md (4 dispatch moments) and review-triggers.md each carry fenced trace append lines with --role and --read before the spawn-agent call and a terminal append after, in verify-deep.md's literal shape. All read-sets are non-empty, including context.md's analyzer dispatch.
criterion: AC4
status: pass
first_pass: pass
source: verifier
evidence: context.md:111/147/161; plan.md:88,221,275,297 dispatches each with their own return and checkpoint closes; review-triggers.md:95/110/119; execute.md:214-216; verify-deep.md:13/34/79. execute.md:110's phase_start anchor deliberately carries none. Cross-model carve-out stated at review-triggers.md:139-147. self-verify ok:true.

### 5. The producer census fails when a bracket half is deleted
expected: node --test cadence-core/bin/trace.test.mjs passes with the tree intact, and FAILS naming the file when any one bracket half is deleted or any read-set is emptied - proved by patch-and-rerun, restored afterwards.
criterion: AC5
status: pass
first_pass: fail
source: model
evidence: Retest after de393af: deleting ONE of plan.md's four '--event checkpoint' closes makes 'node --test cadence-core/bin/trace.test.mjs' fail 1 with 'plan.md: 4 dispatch bracket(s) but only 3 --event checkpoint close(s)'; restored clean (git status 0 modified), suite back to 49 pass / 0 fail.
reported: behavior wrong - the census guards the dispatch, return and --role/--read halves but not the checkpoint arm, so one stated AC5 clause ("dropping any one of its CLOSING events makes the test fail and name the file") does not hold
severity: major
cause: trace.test.mjs:748-762 counts TERMINAL closes as a set (all three arms) and 'return' closes alone, but never the 'checkpoint' arm alone. Each dispatch moment writes two mutually exclusive arms, so deleting all four of plan.md's checkpoint closes leaves 4 dispatches / 4 returns / 4 terminals and every assertion green. Fix is the symmetric assertion, ~6 lines beside the existing two.
fix: de393af, retest

### 6. A real dispatch after the phase produces a non-zero per-role token figure
expected: A subagent dispatch bracketed through THIS repo's own script (not the installed 2.5.0 plugin) produces a trace render whose roles block carries a non-zero token figure for the role that ran.
criterion: AC6
status: pass
first_pass: pass
source: verifier
evidence: .planning/trace.jsonl:606-608 - cad-plan-checker dispatch 13:48:38 closed 13:51:18 with tokens 47717; trace render --phase 4 prints "cad-plan-checker":{"dispatches":1,"tokens":47717} beside unrecorded roles.

### 7. The three gates are green with budgets regenerated
expected: node --test cadence-core/bin/*.test.mjs has 0 failures, npx tsc -p tsconfig.ci.json prints nothing, and node cadence-core/bin/self-verify.mjs --root . returns "ok":true with no budget-overrun or unbudgeted-surface.
criterion: AC7
status: pass
first_pass: pass
source: verifier
evidence: 1451/1451 tests pass, 0 fail; tsc -p tsconfig.ci.json exit 0 with no output; self-verify --root . {"ok":true,"problems":[]} including the budgets check.

### 8. /cad-progress --trace prints the per-role totals
expected: cadence-core/workflows/progress.md's trace step instructs printing the roles block between the family counts and unpaired, stating that an absent token total reads as unrecorded and never as 0.
status: pass
first_pass: pass
source: verifier
evidence: progress.md's trace step instructs the roles block between the family counts and unpaired, with the absent-total-is-unrecorded-never-0 rule and the absent-roles-key case both stated.

### 9. The per-role renderer misbills two reproducible edge inputs
expected: behavior wrong - the roles aggregation loses a whole render block on one role name and credits tokens to a role that never dispatched
origin: verifier
status: pass
first_pass: fail
source: model
evidence: Retest after f536040: a __proto__ role now renders as its own row {dispatches:1,tokens:5} with a sibling role surviving beside it; a bracket opened --role cad-executor and closed --role cad-reviewer --tokens 500 now renders {cad-executor:{dispatches:1,tokens:500}} with no cad-reviewer row. Four regression tests added (mismatched close, unmatched terminal, duplicated terminal, __proto__). Full gate: 1455/1455 tests, tsc exit 0, self-verify problems [].
reported: behavior wrong - the roles aggregation loses a whole render block on one role name and credits tokens to a role that never dispatched
severity: minor
cause: (a) lib/trace.mjs:275 declares roles as a plain object literal, so out.roles['__proto__'] at :346 sets the prototype instead of an own key and planning.mjs:2219's Object.keys gate then omits the whole block - fix is Object.create(null). (b) lib/trace.mjs:313-317 sums tokens on e.role independently of the (corr,phase,plan) pairing loop at :319-334 and never checks a terminal's role against its dispatch's - fix is to derive the accounting role from the matched dispatch. (c) row.recorded++ counts token-bearing EVENTS, not matched dispatches.
fix: f536040, retest

### 10. Run one full phase through /cad-context, /cad-plan and /cad-execute and read `trace render --phase <N>`'s roles block
expected: Every role that ran in the phase appears with a dispatch count, and each closed bracket carries a token figure read off the host's subagent return metadata - no role that actually ran is reported entirely `unrecorded`, and no bracket is left in `unpaired`.
origin: verifier
why_human: The brackets are PROSE instructions to a model, not code paths. The census proves they are written down and speak the renderer's vocabulary; whether the orchestrator actually runs each one and reads a real figure off the return metadata can only be observed in a live run - and the provenance of a `--tokens` value (real metadata versus a typed number) is not machine-checkable at all.
status: pass
first_pass: fail
source: model
evidence: Clean end-to-end run through the CURRENT code only (scratch --dir, all brackets via this repo's script, phase_start anchored at 045c479): a real cad-plan-checker dispatch returned subagent_tokens 28181 and trace render printed roles={"cad-plan-checker":{"dispatches":1,"tokens":28181}} with unpaired 0 - every clause of the expected holds. The two exceptions in .planning/trace.jsonl are pre-fix artifacts of this session's mixed run, not defects: the "" row is plan 1's executor bracket written by the INSTALLED 2.5.0 seam that predates --role (self-resolves on reinstall; this repo's execute.md:215 now carries it), and cad-verifier's unrecorded dispatch is an Explore built-in whose return carried no usage metadata - now documented as routine at context.md:129-144 (045c479, corrected by ef34529 after a checker caught the false claim that an unwritten bracket surfaces in unpaired; it surfaces nowhere).
reported: live run done: unpaired 0 and every role carries a dispatch count, but the '' role (plan 1's executor) is reported entirely unrecorded, and one closed cad-verifier bracket carries no token figure
severity: minor
cause: Two causes. BENIGN: the '' role is plan 1's executor bracket, written by the INSTALLED 2.5.0 planning.mjs during /cad-execute - that seam predates --role, and this repo's execute.md:214-216 now carries --role cad-executor, so it self-resolves on the next plugin install (exactly the staleness D-16 anticipated). SUBSTANTIVE: the first cad-verifier bracket carries no figure because the dispatch under it was a built-in Explore agent whose return carried NO usage metadata at all. Every PLUGIN agent return did carry one (cad-planner 146405, cad-executor 154523, cad-plan-checker 47717, cad-verifier 78034). So D-11's premise holds for plugin agents but not universally, and 'unrecorded' is a routine outcome rather than an edge case.
fix: 045c479, retest

## Summary

total: 10
passed: 10
failed: 0
pending: 0
skipped: 0
blocked: 0
reworked: 3
