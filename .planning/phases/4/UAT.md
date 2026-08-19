---
status: testing
phase: 4
fields_version: 1
started: 2026-08-19
updated: 2026-08-19
---

## Items

### 1. planning.mjs --dir refuses the empty and bare spellings
expected: `planning.mjs status --dir ''` and `planning.mjs status --dir` (bare) each print ONE JSON line `{"ok":false,...}` naming the flag, exit 1, and write nothing to stderr. Baseline was ok:true about ./.planning for the empty form, and a DEP0187 warning on stderr beside no-planning-dir for the bare one.
criterion: AC1
status: pass
first_pass: pass
source: verifier
evidence: Both spellings print exactly one stdout line {"ok":false,"reason":"bad-args","detail":"--dir needs a path after it: --dir <planning dir>"}, exit 1, stderr 0 bytes - no DEP0187. Read through the declared row at cadence-core/bin/planning.mjs:5486.

### 2. route.mjs and review-provider.mjs stop swallowing the next flag
expected: `route.mjs resolve --role --attempt 2` and `review-provider.mjs consult --payload --provider openai` each refuse naming the valueless flag, each refusal's reason is a code that bin's own published vocabulary already contains, and references/seams.md lines 329-332 are unchanged. Baseline was unknown-role:"--attempt" and bad-provider:"unknown provider: undefined".
criterion: AC2
status: pass
first_pass: pass
source: verifier
evidence: route -> reason "usage" naming --role; review-provider -> reason "bad-args" naming --payload. Both codes predate the phase (953bf52:route.mjs:778-787; seams.md:330), and seams.md has no diff across 953bf52..6985052. Wired at route.mjs:803 and review-provider.mjs:214; pinned by route.test.mjs:549 and review-provider.test.mjs:634.

### 3. a bare --role refuses; bare --plan and --sha still drop
expected: `trace append --phase 1 --family lifecycle --event dispatch --role --tokens 5` returns ok:false and `trace render` reports no "" key under roles. A `trace close` with a bare --plan or a bare --sha still returns ok:true and still omits that key.
criterion: AC3
status: pass
first_pass: pass
source: verifier
evidence: Bare --role -> ok:false bad-args, nothing appended, and a subsequent render shows only the real role key, no "". Bare --plan and bare --sha each -> {"ok":true,"written":true} with no plan/sha key in trace.jsonl. Dispositions read off CONTRACTS at planning.mjs:3286-3287/3518; pinned by trace.test.mjs:640.

### 4. all three dispositions hold at a named flag
expected: issue-check with a malformed --timeout-ms still returns ok:true on its constant (fallback); `route.mjs resolve --phase <malformed>` still warns and resolves rather than refusing (warn); a valueless --dir refuses (refuse).
criterion: AC4
status: pass
first_pass: pass
source: verifier
evidence: fallback: issue-check --timeout-ms abc -> ok:true, no warning. warn: route resolve --role cad-planner --phase 1.abc -> ok:true full bundle plus the phase warning. refuse: git-branch decide --dir -> ok:false missing-flag-value "--dir", exit 1.

### 5. one CONTRACTS table, and it is enforced
expected: self-verify.mjs no longer defines CONTRACTS and imports it from the shared module; `node cadence-core/bin/self-verify.mjs` returns {"ok":true,...,"problems":[]}; and removing one flag from a row in the shared spec makes self-verify report unknown-flag against the prose that names it.
criterion: AC5
status: pass
first_pass: pass
source: verifier
evidence: self-verify defines no CONTRACTS (grep count 0) and imports it at self-verify.mjs:215 from lib/arg-contract.mjs:316; live run ok:true, problems [] over 25 checks. Falsifier reproduced on a scratch copy: emptying the plan-overlap row yields unknown-flag against cadence-core/workflows/execute.md.

### 6. suite green and optionalFlag gone
expected: `node cadence-core/bin/test.mjs` passes with zero failures, cadence-core/bin/lib/seam-input.mjs no longer exports optionalFlag, and seam-input.test.mjs carries no surviving divergence arm.
criterion: AC6
status: pass
first_pass: pass
source: verifier
evidence: test.mjs -> 2373 tests, 2373 pass, 0 fail. seam-input.mjs exports only missingFlagValue, flagValue, readText; optionalFlag survives as two comment lines and no test arm.

### 7. the rule is stated once in prose, and the budget matches
expected: references/conventions.md carries an arguments section stating the three dispositions and the bare-vs-empty split, its weight-budgets.json row equals its new byte size, and `npx tsc -p tsconfig.ci.json` reports zero errors.
criterion: AC7
status: pass
first_pass: pass
source: verifier
evidence: conventions.md:76-111 '## Seam arguments' carries the three dispositions and the bare-vs-value split; file is 14556 bytes and weight-budgets.json:30 is 14556; npx tsc -p tsconfig.ci.json exits 0.

### 8. the table declares refuse where the CLI still writes the boolean through
expected: behavior wrong - a declared disposition that no reader applies. planning.mjs holds 98 of the table's 144 flag rows but consults the table at only two sites, so most of its rows state a rule the bin does not enforce, and for at least three of them the row and the shipped behavior disagree outright.
origin: verifier
status: fail
first_pass: fail
source: verifier
evidence: cadence-core/bin/lib/arg-contract.mjs:331 declares cursor set --name {value:'refuse',bare:'refuse'}, yet `planning.mjs cursor set --dir <s>/.planning --phase 1 --status planned --next '/cad-plan 1' --total 5 --name` returns ok:true and writes `Phase: 1 of 5 (true)` into STATE.md. arg-contract.mjs:341 declares uat init --sources refuse, yet the bare spelling writes `sources: true` into the UAT front-matter. arg-contract.mjs:356 declares uat record --reason refuse, yet the bare spelling writes `reason: true` into UAT.md - into the very file this gate is merged onto. The readers that exist are planning.mjs:5486 (--dir only) and planning.mjs:3518 (trace grammar only); the other refusals remain the 79 hand-written fail('bad-args') sites. Nothing catches the divergence: arg-contract.test.mjs checks only the table's own shape, and self-verify reads flag NAMES through flagNames, never the required/type/value/bare fields. The module header (arg-contract.mjs:1-12, 'the rules are DECLARED here, once') carries no caveat that a row may be unread, and conventions.md:103-107 states the same claim in prose.
reported: behavior wrong - a declared disposition that no reader applies. planning.mjs holds 98 of the table's 144 flag rows but consults the table at only two sites, so most of its rows state a rule the bin does not enforce, and for at least three of them the row and the shipped behavior disagree outright.
severity: major
cause: Plan 1 declared rows for all 98 planning.mjs flag entries (its own deviation predicted this: 'Nothing adopts these rows in this plan... plan 2's adoption of planning.mjs is where they take effect'). Plan 2 then adopted only TWO of them - task 1 covered --dir (planning.mjs:5472) and task 2 covered the trace append|close grammar (planning.mjs:3278). No task covered the other 96 entries across 35 subcommand rows, so the remaining 79 hand-written fail('bad-args') sites D-02 measured were never migrated. Reproduced live: `cursor set --name` (bare) returns ok:true and writes `Phase: 1 of 5 (true)` into STATE.md. Root cause is plan scope, not an executor error - the phase's plans never contained a task for the bulk of D-02's centre of gravity.
fix: routed to /cad-plan

### 9. config.mjs get accepts --global with no row to declare it
expected: missing - a live, exercised flag with no declaration on the subcommand that accepts it, inside the table whose completeness is the phase's product.
origin: verifier
status: fail
first_pass: fail
source: verifier
evidence: `node cadence-core/bin/config.mjs get stakes --global` returns {"ok":true,"values":{"stakes":"shipped"},"source":"global"}, but CONTRACTS['config.mjs'].get in cadence-core/bin/lib/arg-contract.mjs declares only --file, while the validate and set rows each declare --global. self-verify is green only because no workflow prose spells `config.mjs get --global` (7 `config.mjs get` hits under cadence-core, none with --global), so check 2 never reaches the pair; the moment any prose spells it, correct prose reports unknown-flag. --global is also read by hand at config.mjs:331-333 rather than off a row.
reported: missing - a live, exercised flag with no declaration on the subcommand that accepts it, inside the table whose completeness is the phase's product.
severity: minor
cause: Same defect class as item 8, one row further out: CONTRACTS['config.mjs'].get declares only --file while the validate and set rows each declare --global, and config.mjs reads --global by hand at config.mjs:331-333 rather than off a row. Recorded as an open item at execution time and filed to CAPTURE. Self-verify stays green only because no workflow prose spells `config.mjs get --global`, so check 2 never reaches the pair.
fix: routed to /cad-plan

## Summary

total: 9
passed: 7
failed: 2
pending: 0
skipped: 0
blocked: 0
reworked: 2
