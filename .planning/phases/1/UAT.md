---
status: testing
phase: 1
fields_version: 1
started: 2026-08-26
updated: 2026-08-26
---

## Items

### 1. Over-ceiling plan reports a byte entry
expected: `planning.mjs plan-size --phase <N> --max-bytes <low>` against a plan whose files: frontmatter declares more than the ceiling returns an over[] entry carrying the plan name, its measured bytes and the ceiling, in the same field shape plan-too-many-tasks uses.
criterion: AC1
status: pass
first_pass: pass
source: verifier
evidence: plan-size --phase 1 --max-bytes 100000 returns two plan-too-many-bytes entries carrying plan/measured/ceiling/detail - the same five fields plan-too-many-tasks pushes at plan-size.mjs:186-190

### 2. Under-ceiling plan reports no byte entry
expected: The same plan-size call with a ceiling above the plan's declared bytes returns no byte entry in over[] (within: true).
criterion: AC2
status: pass
first_pass: pass
source: verifier
evidence: plan-size --phase 1 --max-bytes 675000 -> over: [], compared: ["max_bytes"], within: true, with both plans measured (613294 and 471305)

### 3. Absent declared paths are counted
expected: The byte measurement reports how many declared paths were absent from disk, and a plan declaring a path that does not exist shows a non-zero absent count.
criterion: AC3
status: pass
first_pass: pass
source: verifier
evidence: Hermetic plan declaring one real 500 B file and one nonexistent path -> {"bytes":500,"absent":1}; the named unit test 'a declared path that is not on disk counts zero bytes and one absent' passes on its own

### 4. A replay scope cites different evidence
expected: `route.mjs replay --file .planning/config.json` shows _archive-v2.2.0/2 raising on `destructive` instead of `secrets`, with its reason naming the file whose body match no longer counts.
criterion: AC4
status: pass
first_pass: pass
source: verifier
evidence: _archive-v2.2.0/2 is destructive/publish-decision.test.mjs with reason naming git-publish.test.mjs as no longer counting; the pre-phase 6f9b13de replay shows the same row as secrets/git-publish.test.mjs

### 5. Genuine raises are unchanged
expected: In that same replay, every scope whose raise came from a body line that is neither an import nor a constant declaration computes the level it computes today - regressions is empty and 0 rows drop a rung.
criterion: AC5
status: pass
first_pass: pass
source: verifier
evidence: regressions: [] and a row-by-row diff against the 6f9b13de baseline replay shows 0 of 29 rows changed `computed`; only 5 rows changed which file/surface they cite

### 6. Every replay row carries bytes read
expected: Each `route.mjs replay` row carries an integer bytes_read field.
criterion: AC6
status: pass
first_pass: pass
source: verifier
evidence: 29 of 29 rows have an integer bytes_read (6,629 to 1,293,579); the baseline replay has the field on no row

### 7. Suite green and the key is registered
expected: `node cadence-core/bin/test.mjs` is green, `self-verify` reports problems: [], and workflow.max_plan_bytes appears in config.schema.json, references/config-catalog.md and references/config-reach.md.
criterion: AC7
status: pass
first_pass: pass
source: verifier
evidence: test.mjs 3381 tests, 3380 pass, 0 fail, 1 skip; self-verify problems: [] across 29 checks; workflow.max_plan_bytes at config.schema.json:32, config-catalog.md:34, config-reach.md:126

## Summary

total: 7
passed: 7
failed: 0
pending: 0
skipped: 0
blocked: 0
reworked: 0
