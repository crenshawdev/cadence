---
status: testing
phase: 1
started: 2026-07-24
updated: 2026-07-24
---

## Items

### 1. Malformed config layer is surfaced (#39)
expected: config.mjs get / route.mjs resolve against a corrupt config still succeed (ok:true) on fallback values, but the parse failure rides through the source/reason field (e.g. 'global config failed to parse') and a stderr line names the file. The revert is no longer silent.
status: pass
first_pass: pass
source: verifier
evidence: Corrupt repo --file: config.mjs get -> ok:true, source='defaults (repo config failed to parse)', stderr names file; route.mjs resolve reason contains 'config:global (repo config failed to parse)'. config-merge.mjs:36-89

### 2. Absent config layer stays clean (#39)
expected: An absent config layer resolves with source reading defaults/repo, NO parse-failure note and NO stderr warning. Absence and corruption never read the same.
status: pass
first_pass: pass
source: verifier
evidence: Absent global+repo -> source='defaults', empty stderr; readLayer returns {config:null, failed:false} on ENOENT (config-merge.mjs:38) so no note/warning

### 3. Corrupt shipped data file degrades, not crashes (#40)
expected: route.mjs / config.mjs pointed at a missing or corrupt route-table.json / config.schema.json (via CADENCE_ROUTE_TABLE / CADENCE_CONFIG_SCHEMA) emit a single {ok:false, reason:'data-file', detail} line naming the file, instead of an uncaught SyntaxError stack. A normal run with the real shipped file still succeeds.
status: pass
first_pass: pass
source: verifier
evidence: CADENCE_ROUTE_TABLE/CADENCE_CONFIG_SCHEMA=corrupt -> {ok:false,reason:'data-file',detail:<file>} exit=1; real files ok:true. Loads are first stmt in dispatch try (route.mjs:168-172, config.mjs:215-219) via loadDataFile (lib/load-data.mjs:25-31)

### 4. Corrupt model-hints.json is surfaced (#43)
expected: review-provider detect-models against a corrupt model-hints.json carries a hints_warning field (naming the file) plus a stderr warning, while an absent hints file stays silent. The non-text exclude filter is no longer silently disabled.
status: pass
first_pass: pass
source: verifier
evidence: loadHints(corrupt).warning names file; buildDetectResult carries hints_warning + stderr warning; absent -> warning:null, no hints_warning key, silent. review-provider.mjs:507,517-528,558-562

### 5. self-verify reports skipped drift checks (#44)
expected: self-verify.mjs on a --root fixture missing an always-expected input (a core surface dir, weight-budgets.json, INTERNALS.md, or agents/) lists that skip in a 'skipped' field; ok still tracks only problems. The real repo run stays ok:true with skipped:[].
status: pass
first_pass: pass
source: verifier
evidence: Real repo -> {ok:true, skipped:[]}; --root fixture missing inputs records skips (internals-paths, context-weight-budgets, tools-lint, config-keys/invocations/paths); ok=problems.length===0 (self-verify.mjs:159,247,279,322,335)

### 6. FIX-01 test gate green
expected: node --test cadence-core/bin/*.test.mjs, node cadence-core/bin/self-verify.mjs, and npx tsc -p tsconfig.ci.json all pass. Each fix carries a failing-capable regression test.
status: pass
first_pass: pass
source: verifier
evidence: node --test cadence-core/bin/*.test.mjs = 271 pass/0 fail; self-verify.mjs real repo ok:true exit 0; tsc -p tsconfig.ci.json exit 0; named regression test per issue confirmed

## Summary

total: 6
passed: 6
failed: 0
pending: 0
skipped: 0
blocked: 0
reworked: 0
