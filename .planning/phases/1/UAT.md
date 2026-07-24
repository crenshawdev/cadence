---
status: testing
phase: 1
started: 2026-07-24
updated: 2026-07-24
---

## Items

### 1. Malformed config.json surfaced, absent stays silent (#39)
expected: With a syntactically malformed .planning/config.json, `config.mjs get` returns ok:true whose values and source equal the no-repo-layer result AND a warnings[] entry naming the file that failed to parse; with the file merely absent, no such warning appears.
status: pass
first_pass: pass
source: verifier
evidence: config.mjs get --file <torn.json> -> ok:true, source:"global" + warnings:["config layer .../torn.json failed to parse and was skipped"]; --file <absent> -> identical values/source, no warnings key; malformed global (CADENCE_GLOBAL_CONFIG) -> source:"defaults" + warning naming global. config-merge.mjs:35-42,69-80 (readLayer ENOENT->null/no-warning, other->warning), config.mjs:190,200

### 2. Missing/malformed route-table or config-schema degrades cleanly (#40)
expected: With route-table.json (route.mjs) or config.schema.json (config.mjs) absent or malformed, invoking the script emits exactly one {ok:false,reason,detail} JSON line on stdout with no raw stack trace.
status: pass
first_pass: pass
source: verifier
evidence: 4 runs each printed exactly one JSON line: bad-table/bad-schema for both nonexistent and malformed fixtures, no stack. Loads relocated inside dispatch try. route.mjs:36-38,171-190; config.mjs:216-234

### 3. detect-models warns on malformed model-hints, silent on valid-ruleless (#43)
expected: review-provider.mjs detect-models with a malformed references/model-hints.json returns ok:true with candidate models AND a warnings[] entry naming the load failure; a valid-but-ruleless hints file produces no such warning, so the two outputs are distinguishable.
status: pass
first_pass: pass
source: verifier
evidence: readModelHints/classify/detectEnvelope exercised: classify len 2 for broken and absent (candidates preserved, fail-safe intact); readModelHints(broken).warning non-null naming file, absent->null; detectEnvelope warnings only for broken, absent for ruleless {"rules":{}} and absent. review-provider.mjs:517-525,535-549,555-559,507. (Live detect-models needs an API key; verified at envelope/unit level.)

### 4. self-verify fails on missing always-expected input, minimal fixture green (#44)
expected: self-verify.mjs run against the real repo with an always-expected input removed (e.g. weight-budgets.json deleted, or a core surface dir renamed) exits ok:false naming the missing input; run against a minimal --root fixture that omits optional inputs it still exits ok:true.
status: pass
first_pass: pass
source: verifier
evidence: Real-repo run -> ok:true, problems:[]. Gate isFullTree=existsSync(.claude-plugin/plugin.json) guards surface-dir loop (self-verify.mjs:173-180), INTERNALS (248-249), weight-budgets (280-281) as missing-input. Suite tests for missing weight-budgets.json, renamed core surface dir, missing INTERNALS.md all fail ok:false; minimal non-full-tree fixture stays clean.

### 5. Regression test per finding + full bin suite passes (FIX-01)
expected: Each of #39, #40, #43, #44 has a test that reproduces the pre-fix silent/crash behavior and asserts the surfaced behavior, and `node --test cadence-core/bin/*.test.mjs` passes.
status: pass
first_pass: pass
source: verifier
evidence: node --test cadence-core/bin/*.test.mjs -> tests 266 / pass 266 / fail 0. Per-finding tests: #40 route.test.mjs:283,299 + config.test.mjs:243,255; #39 config.test.mjs:182,196; #43 review-provider.test.mjs:136; #44 four full-fixture tests. tsc -p tsconfig.ci.json exits clean. D-05: no test still asserts broken==absent silence.

## Summary

total: 5
passed: 5
failed: 0
pending: 0
skipped: 0
blocked: 0
reworked: 0
