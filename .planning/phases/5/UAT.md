---
status: testing
phase: 4
fields_version: 1
started: 2026-08-24
updated: 2026-08-24
---

## Items

### 1. Entry file is dispatch only
expected: `wc -l cadence-core/bin/planning.mjs` is under 2,000, all 32 `cmd*` handlers live in modules under `cadence-core/bin/planning/`, and every subcommand still resolves through the `COMMANDS` table.
criterion: AC1
status: pass
first_pass: pass
source: model
evidence: wc -l cadence-core/bin/planning.mjs -> 360 (ceiling 2,000). grep -cE "^(async )?function cmd[A-Z]" planning.mjs -> 0. Same grep across cadence-core/bin/planning/*.mjs -> 32 handlers over 30 modules. COMMANDS table parses 26 entries; invoking all 26 subcommands via `node planning.mjs <cmd>` returned zero unknown-command envelopes.

### 2. No behaviour change
expected: `node cadence-core/bin/test.mjs` is green, `node cadence-core/bin/self-verify.mjs` reports zero problems across all 26 checks, and `npx tsc -p tsconfig.ci.json` exits 0.
criterion: AC2
status: pass
first_pass: pass
source: model
evidence: node cadence-core/bin/test.mjs -> tests 3076 / pass 3076 / fail 0. node cadence-core/bin/self-verify.mjs -> "problems":[] across 26 named checks. npx tsc -p tsconfig.ci.json -> exit 0.

### 3. Citation census pins both grammars
expected: A census test pins live `planning.mjs:<line>` citations in both the inline grammar and the `DOCS-CLAIMS.md` line-range column, and fails naming any stale one. `.planning/_archive-v*` and `.planning/trace.jsonl` are byte-unchanged.
criterion: AC3
status: pass
first_pass: pass
source: model
evidence: Falsified in BOTH grammars. Grammar one: REQUIREMENTS.md SPL-01 planning/status.mjs:28 -> :9999 made citation-census.test.mjs fail 1 of 5, naming ".planning/REQUIREMENTS.md::planning/status.mjs:9999" as the extra and :28 as the missing row. Grammar two: DOCS-CLAIMS EXECUTE-10 line-range cell 331-334 -> 9990-9994 failed "grammar two: every this-seam DOCS-CLAIMS row has exactly one pinned row". Census reports grammar one checked 3, grammar two checked 4. Both edits reverted; git status clean. git diff --name-only 66ce9bd5..HEAD -- .planning/_archive-v* -> 0 files; trace.jsonl is gitignored and holds no citations.

### 4. Split test stems all run
expected: `planning.test.mjs` is split along its command banners into `cadence-core/bin/*.test.mjs`, and `node cadence-core/bin/test.mjs` runs every new stem - proven by the reported test count matching the pre-split total, not by the files existing.
criterion: AC4
status: pass
first_pass: pass
source: model
evidence: ls cadence-core/bin/planning-*.test.mjs -> 22 stems. node cadence-core/bin/test.mjs --list -> zero planning-* stems under the "other" group, so every stem is declared in GROUPS.planning and runs. Count preserved across the split: executors reported tests 3071 / pass 3071 / fail 0 unchanged through all 7 plan-2 tasks (449 + 28 = 477, the pre-split planning.test.mjs total, at task 1). Suite now 3076; the +5 is citation-census.test.mjs, which reports exactly 5 tests.

### 5. prose-agreement assertions not weakened
expected: The three source-byte assertions in `prose-agreement.test.mjs` still pass AND still assert the same thing: `SUGGEST_KEY_DEFAULTS` compared against `config.schema.json`, and `undeclared-files` matched at its emitting site. A diff shows neither narrowed to a weaker claim.
criterion: AC5
status: pass
first_pass: pass
source: model
evidence: node --test cadence-core/bin/prose-agreement.test.mjs -> tests 47 / pass 47 / fail 0. git diff 66ce9bd5..HEAD on that file shows both assertions REPOINTED, not weakened: undeclared-files still `assert.match(seam, /reason: \x27undeclared-files\x27/)` with seam moved from planning.mjs to planning/lease-check.mjs (the emitting site); SUGGEST_KEY_DEFAULTS still parses the literal out of source bytes via the same regex and still deep-equals it against config.schema.json defaults key by key, with the source moved to planning/trace.mjs. Neither predicate narrowed.

### 6. Read cost measured, median and worst
expected: The SUMMARY records before-and-after read cost for reaching a MEDIAN handler and the WORST-CASE handler, both by `wc -c`, so the saving is measured rather than asserted.
criterion: AC6
status: pass
first_pass: pass
source: model
evidence: READ-COST.md measures all three by wc -c: BEFORE `git show 22eca08a:cadence-core/bin/planning.mjs | wc -c` -> 417,009 bytes (~104,252 tokens); MEDIAN entry+core+phase-done.mjs (15th of 29 sorted) -> 71,985 bytes (~17,996 tokens); WORST entry+core+trace.mjs -> 117,473 bytes (~29,368 tokens). Both after-figures land under the 50,000-token read cap; BEFORE was 2.1x over it. SUMMARY.md goal check restates the same figures and names the limits.

## Summary

total: 6
passed: 6
failed: 0
pending: 0
skipped: 0
blocked: 0
reworked: 0
