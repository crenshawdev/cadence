---
status: testing
phase: 1
fields_version: 1
started: 2026-09-03
updated: 2026-09-03
---

## Items

### 1. resolveRange names the end that failed
expected: With one resolvable and one unresolvable ref, resolveRange returns ok:false, the resolved end's full sha, '' for the other, and an error starting with 'head' or 'base' naming the failed end. A test covers each end failing.
status: pass
first_pass: pass
source: verifier
evidence: core.mjs:542-556/:619-637; scratch run kept base_id and named `head`, mirror kept head_id and named `base`; both named tests pass in the suite.

### 2. A no-diff risk_check row states its cause
expected: risk-check run over an unresolvable range answers ok:false reason:no-diff, keeps the resolved end's id, and the appended trace row has checked:false, inconclusive:true and a non-empty detail starting with the failed end's name - never a bare inconclusive.
status: pass
first_pass: pass
source: verifier
evidence: risk-check.mjs:404-420; scratch trace rows read checked:false, inconclusive:true, detail opening with the failed end's name, resolved end's id kept.

### 3. risk-check run --base <ref> --staged is the staged scope's one spelling
expected: Staging a risky file and running risk-check run --phase 1 --base HEAD --staged answers ok:true with matches, staged:true, head_id:null. The same content only in the worktree answers matches:[]. An empty index answers checked:true empty:true. Adding --head beside --staged answers bad-args.
status: pass
first_pass: pass
source: verifier
evidence: risk-check.mjs:150-183/:307-350, arg-contract.mjs:785-798; scratch: staged auth match with staged:true/head_id:null, unadded worktree file -> matches:[], empty index -> checked:true empty:true, --head beside --staged -> bad-args appending nothing.

### 4. risk-check status finds the staged record
expected: After a staged run, risk-check status --phase 1 --plan 1 --base HEAD --staged answers ok:true, plans[0].state recorded, wanted.staged true. When the only record is a ref-range run it answers risk-record-missing. --staged without --plan or with --head answers bad-args.
status: pass
first_pass: pass
source: verifier
evidence: risk-check.mjs:518-613/:1000-1006; scratch: state 'recorded' with wanted.staged true and wanted.head_id null, ref-range ask against a staged-only record -> risk-record-missing, both/neither -> bad-args, unresolvable base -> unresolved-range naming `base`.

### 5. A staged record binds to the index tree it diffed
expected: A staged risk_check row carries index_id equal to git write-tree's id and the body diffed is <base> <tree>, so the id and the bytes are one object.
status: pass
first_pass: pass
source: verifier
evidence: core.mjs:581-586, risk-check.mjs:343-348; scratch index_id equalled `git write-tree` exactly and a one-byte index change turned the status ask 'stale'.

### 6. Workflows spell the staged scope one way; no rev git rejects
expected: verify.md, debug.md and risk-surface.md invoke risk-check run with --base <ref> --staged. No workflow or reference passes a STAGED token or any rev spelling git rev-parse --verify rejects. prose-agreement test pins it.
status: pass
first_pass: pass
source: verifier
evidence: Seven planning.mjs risk-check run lines, each with --base and exactly one scope end; verify.md:280 and debug.md:117 use --staged; the only STAGED token is prose emphasis at worktree-executor.md:37; prose-agreement RSK-10 invocation test passes.

### 7. A plan that landed nothing records a skip, not a clean check
expected: execute.md, task.md and execute-parallel.md each have one trace append line for risk_check_skipped with --family outcome, replacing a risk-check run over a range whose two ends are the same commit. No checked:true empty:true row for that case.
status: pass
first_pass: pass
source: verifier
evidence: One `trace append --family outcome --event risk_check_skipped` line each in execute.md:346, task.md:160, execute-parallel.md:40, each guarded by a sentence naming its own recorded end; prose-agreement skip test passes.

### 8. GH-229 traces to a REQUIREMENTS row on Phase 1
expected: REQUIREMENTS.md has RNG-05 and RSK-10 rows naming GH-229 and Phase 1, and the traceability table lists both under Phase 1.
status: pass
first_pass: pass
source: verifier
evidence: REQUIREMENTS.md:17-18 name GH-229 and Phase 1; traceability rows at :503-504.

### 9. Suite green and typecheck clean
expected: node cadence-core/bin/test.mjs is green, node cadence-core/bin/self-verify.mjs --root . answers ok:true, and npx tsc -p tsconfig.ci.json prints no error.
status: pass
first_pass: pass
source: verifier
evidence: test.mjs 3766/3765 pass, 1 skip, exit 0; self-verify ok:true, problems []; tsc -p tsconfig.ci.json exit 0.

### 10. A skipped plan makes the NEXT plan's risk-check status refuse, so the blocking gate cannot be cleared
expected: behavior wrong - the seam does not read the event the workflows now write. `risk_check_skipped` is prose-only: cmdRiskCheckStatus counts every in-cycle cad-executor return bracket into `completed` (risk-check.mjs:759-765) but only `outcome/risk_check` rows into `records`/`byPlan` (:800-803), so a plan whose only outcome row is the skip reports `missing` and the whole call answers ok:false. execute.md:404 says 'The plan is NOT reported done while that call refuses', so a phase where an EARLIER plan lands no commits can no longer report a LATER plan done - the unsatisfiable blocking gate whose only exit is an override.
origin: verifier
status: pass
first_pass: fail
source: model
evidence: bc2f9212. `node --test --test-name-pattern="skipped EARLIER plan" cadence-core/bin/risk-diff.test.mjs` -> `1 pass 0 fail`: real binary in a scratch repo, plan 1 skipped at the pre-plan HEAD, plan 2 committed and checked; `risk-check status --phase 1 --plan 2 --base <a> --head <b>` answers ok:true, plan 1 state `skipped`, plan 2 `recorded`, no `missing`. Full suite 3769 pass 0 fail 1 skip; tsc clean; staged risk check checked:true matches:[].
reported: behavior wrong - the seam does not read the event the workflows now write. `risk_check_skipped` is prose-only: cmdRiskCheckStatus counts every in-cycle cad-executor return bracket into `completed` (risk-check.mjs:759-765) but only `outcome/risk_check` rows into `records`/`byPlan` (:800-803), so a plan whose only outcome row is the skip reports `missing` and the whole call answers ok:false. execute.md:404 says 'The plan is NOT reported done while that call refuses', so a phase where an EARLIER plan lands no commits can no longer report a LATER plan done - the unsatisfiable blocking gate whose only exit is an override.
severity: blocker
cause: cmdRiskCheckStatus (risk-check.mjs) builds one row per in-cycle cad-executor return bracket (:759-765) and requires every row to reach `recorded`, but the only event that fills a row is `outcome/risk_check` (:800-803). Phase 1 taught execute.md, task.md and execute-parallel.md to write `outcome/risk_check_skipped` in place of the run for a plan that landed nothing, and never taught the reader. On a multi-plan phase, a skipped earlier plan stays `missing`, `offending` is non-empty (:1044), and every later plan's `risk-check status` answers ok:false risk-record-missing - a blocking gate with no exit but an override. Single-plan phases and /cad-task are unaffected because the skip replaces both calls there.
fix: bc2f9212, retest

## Summary

total: 10
passed: 10
failed: 0
pending: 0
skipped: 0
blocked: 0
reworked: 1
