---
status: testing
phase: 2
fields_version: 1
started: 2026-08-25
updated: 2026-08-25
---

## Items

### 1. Registry names four things per census
expected: cadence-core/bin/lib/census-registry.mjs lists rows for self-verify.test.mjs, arg-contract.test.mjs, trace.test.mjs and weight-budgets.json, and each row names the file holding the count, what it counts, the site that asserts it, and its narrow subject path set.
criterion: AC1
status: pass
first_pass: pass
source: verifier
evidence: lib/census-registry.mjs:95-215 carries nine frozen rows including all four AC1 names, each with holder / counts / asserted_by / narrow subjects; census-registry.test.mjs 7 pass / 0 fail, with the shape, lease-grammar-acceptance and deep-freeze arms all green.

### 2. Marked census with no row reddens the suite
expected: A census site carrying the CADENCE-CENSUS marker with no registry row fails the suite, and the failure names the file and the assertion. A fixture pair shows red with the row absent and green with it present.
criterion: AC2
status: pass
first_pass: pass
source: verifier
evidence: Fixture pair at census-registry.test.mjs:91-110 differs only in the id. Independent probe on a scratch copy of the registry with the rung-agent-files row deleted produced exactly one issue against the untouched live rung-agent.test.mjs:78, naming the file and the assertion text.

### 3. Phase 5 lease replay names the right censuses
expected: Replayed against phase 5's PLAN-1 lease exactly as written (git show 6645ce4b:.planning/phases/4/PLAN-1.md, five declared paths), the plan-time arm names trace.test.mjs and self-verify.test.mjs. The run spawns no git subprocess and executes nothing from the plan.
criterion: AC3
status: pass
first_pass: pass
source: verifier
evidence: Live `lease-check --plan-time` on phase 5's five-path lease, run outside any git repo, returned reason `census-at-risk` naming self-verify.test.mjs, trace.test.mjs and planning-lease-check.test.mjs with counts and asserted_by, exit 1. Tests at planning-lease-check.test.mjs:583/601/621 assert the set, zero git spawns via an argv-recording PATH stub, and byte-identical stdout when the Action prose is rewritten.

### 4. Historical replay stays under the half bound
expected: The arm is replayed over every historical PLAN declaring a path under cadence-core/bin/, the per-entry refusal count is recorded in the phase record, and no single registry entry refuses more than half of them.
criterion: AC4
status: pass
first_pass: pass
source: verifier
evidence: Independently recomputed over the live .planning tree: 51 walked, 43 under cadence-core/bin/, worst entry planning-detail-sites 15 (35%) against a bound of 21. Every per-entry count matches .planning/phases/2/census-replay.md exactly, and the bound is asserted at planning-lease-check.test.mjs:700 with a >30-plan non-vacuity floor.

### 5. /cad-plan fires the check before any executor
expected: /cad-plan runs the plan-time check after PLAN.md is written and before any executor is dispatched, on the dispatched path and the --inline path both, and the refusal text names each missing file beside the census it holds.
criterion: AC5
status: pass
first_pass: pass
source: verifier
evidence: plan.md:303 check_census sits strictly between check_size (:277) and count_planned (:342) and ahead of check_gate (:374); `--plan-time` appears exactly once, at :314; the inline path points at the step at :222 with no second spelling; no AskUserQuestion or too_big-style ask in the block; the step states the remedy and the do-not-continue rule. The live refusal payload names each missing file beside what it counts and where it is asserted.

### 6. Commit-time census refusal is distinguishable
expected: A commit-time lease-check refusal on a registered census file carries a different reason code than an ordinary undeclared-files refusal and appends an event to .planning/trace.jsonl; a refusal on an unregistered file carries the old reason. Two fixtures, one each.
criterion: AC6
status: pass
first_pass: pass
source: verifier
evidence: lease-check.mjs:395-443 splits the undeclared list on registry holders, appends one `outcome/census_undeclared` event carrying the census ids, and emits `undeclared-census-files` with `census_files` and `trace:{written}`; the unregistered arm keeps `undeclared-files` byte-identical. Fixtures at planning-lease-check.test.mjs:456 and :480 assert one trace line vs. no trace file at all, and assert each half absent from the other side.

### 7. Suite, self-verify, tsc and this phase's own lease
expected: Full suite green, self-verify.mjs reports zero problems, npx tsc -p tsconfig.ci.json exits 0, and this phase's own PLANs lease cadence-core/bin/arg-contract.test.mjs, cadence-core/bin/weight-budgets.json, .planning/DOCS-CLAIMS.md and cadence-core/bin/citation-census.test.mjs.
criterion: AC7
status: pass
first_pass: pass
source: verifier
evidence: test.mjs 3091 pass / 0 fail exit 0; self-verify problems: [] over 26 checks; npx tsc -p tsconfig.ci.json exit 0; PLAN-2.md leases all four D-14 files at :7, :12, :13, :14.

### 8. Nine census sites carry their markers
expected: The registry holds nine frozen rows and nine live census sites each carry a CADENCE-CENSUS marker naming its registry id.
status: pass
first_pass: pass
source: verifier
evidence: Nine rows, nine markers, ids one-to-one: self-verify.test.mjs:1622, arg-contract.test.mjs:303, trace.test.mjs:2425, self-verify.mjs:756, text-transport.test.mjs:40, bulk-output.test.mjs:49, rung-agent.test.mjs:78, deferred-reads.test.mjs:153, planning-lease-check.test.mjs:312. The live-tree walk is non-vacuous (>60 modules) and the marker head is built from CENSUS_TOKEN rather than spelled.

### 9. A tenth census - seam-calls.test.mjs - has no registry row and no marker
expected: missing - ROADMAP criterion 1 and CEN-01 both say EVERY hand-maintained census is registered, and one known census is not. It is invisible to the discovery arm because it also carries no marker, and the module header still documents the opposite rule.
origin: verifier
status: pass
first_pass: fail
source: verifier
evidence: Retested at badcb33e. `lib/census-registry.mjs` now carries the `seam-call-counts` row - holder `cadence-core/bin/seam-calls.test.mjs`, subjects `cadence-core/workflows/plan.md` and `cadence-core/workflows/context.md` - and that file carries the matching CADENCE-CENSUS marker at its asserting loop, so `grep -c CADENCE-CENSUS cadence-core/bin/seam-calls.test.mjs` returns 1. The header's pre-correction D-05 paragraph is rewritten: `grep -c "deliberately absent from this table" cadence-core/bin/lib/census-registry.mjs` returns 0. census-registry.test.mjs 7/7 including the live-tree discovery arm, which reports no unregistered census. Live: a scratch PLAN.md declaring cadence-core/workflows/plan.md alone now returns ok:false, reason census-at-risk, naming cadence-core/bin/seam-calls.test.mjs with its counts and asserted_by, exit 1. .planning/phases/2/census-replay.md re-measured over the current corpus: the row refuses 9 of 48 plans against a bound of 24. Commit ac01bcc7.
reported: missing - ROADMAP criterion 1 and CEN-01 both say EVERY hand-maintained census is registered, and one known census is not. It is invisible to the discovery arm because it also carries no marker, and the module header still documents the opposite rule.
severity: major
cause: The registry was authored under the pre-correction D-05, which named seam-calls.test.mjs as the worked example of what is NOT a census. D-05 was corrected mid-phase (plan 2 task 7), but lib/census-registry.mjs is plan 1's module and PLAN-2 never leases it, so the correction could not reach the registry inside this phase without editing outside a lease - the exact act the phase exists to prevent. Row, marker, and the module header at :44-49 are one commit.
fix: ac01bcc7, retest

### 10. lease-check --plan-time passes any lease it could not read
expected: behavior wrong - the plan-time gate fails OPEN on an empty or unparsed declared set, where the commit-time arm on the same file fails closed.
origin: verifier
status: pass
first_pass: fail
source: verifier
evidence: Retested at badcb33e. The plan-time arm refuses on two signals above `censusesAtRisk`. Live on a scratch tree: a PLAN.md with a garbage frontmatter line returns ok:false, reason unparsed-lease, with frontmatter_issues and a hint, exit 1; a PLAN.md whose key is misspelled `filez:` returns ok:false, reason empty-lease, declared:0, with a hint, exit 1; a PLAN.md declaring src/a.mjs returns ok:true, declared:1, exit 0, so this is fail-closed and not a blanket refusal. Two signals because a misspelled key is a structurally valid key line producing zero frontmatter_issues. One fixture directory holds two plans and pins both gates on the same two signals: plan-overlap reports frontmatter_issues naming PLAN-1.md and undeclared naming PLAN-2.md, and lease-check --plan-time refuses PLAN-1 as unparsed-lease and PLAN-2 as empty-lease (planning-lease-check.test.mjs, 31/31). Reverting either arm alone, or both, reddens that test and nothing else. workflows/plan.md's check_census now names all three refusal outcomes. Commits 3bf5264e, 6db19be9.
reported: behavior wrong - the plan-time gate fails OPEN on an empty or unparsed declared set, where the commit-time arm on the same file fails closed.
severity: major
cause: lease-check.mjs:267 `if (!atRisk.length) return ok(base)` is reached whenever parsePlanFiles() yields declared:[], and censusesAtRisk([]) is empty by construction, so an unread lease is indistinguishable from a lease that puts nothing at risk. frontmatter_issues is carried as informational output and never consulted by the plan-time arm. The commit-time arm on the same file fails closed on the same signal, and execute.md's choose_path already treats a frontmatter_issues entry as grounds to refuse - two gates, one signal, two readings.
fix: 3bf5264e, retest

### 11. Run /cad-plan on a phase whose PLAN under-declares a census subject and watch what the orchestrator does with the refusal
expected: check_census emits `census-at-risk`, the orchestrator says the missing files out loud beside the census each holds, amends the plan's files: list, re-runs until ok:true, and reaches neither count_planned nor any dispatch while it refuses.
origin: verifier
why_human: Out of reach from here, not merely unexercised: /cad-plan is an orchestrator workflow that dispatches a cad-planner subagent and writes real PLAN files, and nothing in code stops a workflow reading prose - D-07's whole premise is this project's record of two refusals committed rather than obeyed. The seam's exit code and payload are verified; whether the workflow halts on them can only be observed in a live planning run.
status: skipped
reason: Orchestrator halt unobservable this cycle: no unplanned phase remains in v3.7.1 to run /cad-plan against. The seam arm it depends on is verified - item 3 (replay names the right censuses, no git subprocess) and item 10 (fail-closed on unparsed-lease and empty-lease, live on a scratch tree, planning-lease-check.test.mjs 31/31). What is unobserved is only whether the /cad-plan workflow obeys the refusal; that carries to the first /cad-plan of the next cycle.

## Summary

total: 11
passed: 10
failed: 0
pending: 0
skipped: 1
blocked: 0
reworked: 2
