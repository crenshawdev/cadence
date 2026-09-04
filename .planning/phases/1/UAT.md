---
status: testing
phase: 1
fields_version: 1
started: 2026-09-04
updated: 2026-09-04
---

## Items

### 1. Thirty rung files, five rungs per role
expected: `ls agents/*.md | wc -l` returns 30, and the `effort:` lines across them are exactly six each of low, medium, high, xhigh and max.
criterion: AC1
status: pass
first_pass: pass
source: verifier
evidence: `ls agents/*.md | wc -l` = 30; the effort: lines tally 6 low, 6 medium, 6 high, 6 xhigh, 6 max, with six distinct roles inside each rung group. The analyzer's D-01 inversion is intact.

### 2. rungFile resolves all thirty pairs
expected: rungFile(role, rung) returns a non-null stem for all 30 role-rung pairs, and the file each stem names exists in agents/.
criterion: AC2
status: pass
first_pass: pass
source: verifier
evidence: Importing RUNG_FILES/rungFile from cadence-core/bin/lib/rung-agent.mjs and walking the 6x5 cross product: 30 pairs, 0 bad - every pair returns a stem and every stem names an existing agents/*.md.

### 3. self-verify is clean
expected: `node cadence-core/bin/self-verify.mjs` reports ok: true with no unbudgeted-surface and no budget-overrun entry.
criterion: AC3
status: pass
first_pass: pass
source: verifier
evidence: `node cadence-core/bin/self-verify.mjs` exit 0, ok:true, problems:[] over 30 checks including budgets, rung-effort, rung-prefix, routing-cells and effort-enums. weight-budgets.json carries 30 agents/ rows and each new row equals the file's actual byte count.

### 4. Rung bodies identical within a role
expected: Within each role, every rung file's post-frontmatter body is byte-identical to its siblings' - one body hash per role.
criterion: AC4
status: pass
first_pass: pass
source: verifier
evidence: sha256 over the post-frontmatter body of all 30 files yields exactly six digests, one per role, each shared by that role's five rung files. agents/cad-executor-max.md differs from agents/cad-executor.md in name, description and effort only.

### 5. No existing agent file renamed or deleted
expected: `git diff --name-status` over the phase's commits shows only additions under agents/ - no R and no D.
criterion: AC5
status: pass
first_pass: pass
source: verifier
evidence: `git diff --name-status 42295be3..14e387ed -- agents/` is 11 A, zero R, zero D; all eleven land in 14e387ed and the two earlier commits touch agents/ not at all.

### 6. Suite passes and no test pins nineteen
expected: `node cadence-core/bin/test.mjs` exits 0, and no test asserts the agent-file count nineteen.
criterion: AC6
status: pass
first_pass: pass
source: verifier
evidence: `node cadence-core/bin/test.mjs` exit 0 - 3813 tests, 3812 pass, 0 fail, 1 unrelated conditional skip. The rung-agent census test and its marker both read 30. route.test.mjs:887's `byName.size === 19` counts stems the route-table CELLS reach, not files on disk, and PLAN Task 1 kept it deliberately; prose-agreement.test.mjs:646's '19' is failure-message text that asserts nothing.

### 7. model.effort accepts every rung for every role
expected: config.schema.json gives all six model.effort.<role> keys the same five-rung enum, so a config setting any role to any rung validates.
status: pass
first_pass: pass
source: verifier
evidence: config.schema.json:19-24 - six identical enums [low, medium, high, xhigh, max, null]. `config.mjs check model.effort.<role>=<rung>` returns ok:true for all 30 pairs, and `=ultra` is refused by all six roles with the byte-identical message 'must be one of: low, medium, high, xhigh, max, null'.

### 8. A shipped reference still promises the ladder check that Task 1 deleted
expected: behavior wrong - the doc states a CI guarantee that no longer exists, and states it against exactly the files this phase shipped
origin: verifier
status: pass
first_pass: fail
source: model
evidence: Fixed in 65245283 and retested. `grep -c 'no cell reaches' cadence-core/references/seam-spawn-agent.md` -> 0; the clause at :16 now reads "directions: a rung with no file, and a rung file no role maps", which is what self-verify.mjs:1164-1168 files (undeclared-rung-agent where rungFile(role, rung) !== stem). The file is 26343B against its 26346B budget, so no budget row moved. `node cadence-core/bin/self-verify.mjs` -> ok:true, problems: [] over all 30 checks.
reported: behavior wrong - the doc states a CI guarantee that no longer exists, and states it against exactly the files this phase shipped
severity: major
cause: Confirmed at HEAD. cadence-core/references/seam-spawn-agent.md:15-16 still reads "Self-verify fails in both directions: a rung with no file, and a rung file no cell reaches." Commit e6c6ad5c retired that second arm - route-table.json:4 already carries the narrowed wording ("a rung-suffixed agent file that map files for no role") and self-verify check 8 now files undeclared-rung-agent only where rungFile(role, rung) !== stem. The eleven files this phase shipped are exactly "a rung file no cell reaches", so the reference promises a CI refusal for the ordinary state of a complete ladder. Root cause: Task 1's Verify grepped "both directions" across README.md, INTERNALS.md and route-table.json only, and references/ was outside that grep's path list.
fix: dcded42c, retest

### 9. Five shipped surfaces still record the ladder as nineteen files
expected: behavior wrong - stale counts, and one census whose two halves now contradict each other with nothing enforcing agreement
origin: verifier
status: pass
first_pass: fail
source: model
evidence: Fixed in 65245283 and retested. Six sites, one more than the verifier found: census-registry.mjs:199 counts 'the 30 rung file stems...', :200 asserted_by 'the test named `RUNG_FILES names 30 files across the six roles, and is frozen`' which now matches rung-agent.test.mjs:83 verbatim; seam-spawn-agent.md:18 'all 30 rung files'; read-trace.mjs:42, :1220 and :1282 (the third one the verifier missed); prose-agreement.test.mjs:646. `grep -n '19 rung\|19 files\|19 stems'` over all four files returns nothing. `node cadence-core/bin/test.mjs` -> 3813 tests, 3812 pass, 0 fail, 1 pre-existing skip; `npx tsc -p tsconfig.ci.json` exit 0.
reported: behavior wrong - stale counts, and one census whose two halves now contradict each other with nothing enforcing agreement
severity: minor
cause: Confirmed at HEAD, five sites. The load-bearing one is cadence-core/bin/lib/census-registry.mjs:199-201: counts says "the 19 rung file stems" and asserted_by names the test `RUNG_FILES names 19 files across the six roles, and is frozen`, which no longer exists - rung-agent.test.mjs:83 is now "names 30 files" and its CADENCE-CENSUS marker at :82 already reads 30. census-registry.test.mjs joins marker to row by id alone and only checks the strings are non-empty, so the two halves contradict each other with the suite green. The other four are prose: seam-spawn-agent.md:18 ("all 19 rung files"), read-trace.mjs:42 and :1220 (comments; the code at :1213-1229 derives from RUNG_FILES and is correct), prose-agreement.test.mjs:646 (assertion failure message only). Root cause: no check compares a census row's count text against the marker it joins to, so a count restated in prose drifts silently. SUMMARY's Goal check names two of the five.
fix: dcded42c, retest

## Summary

total: 9
passed: 9
failed: 0
pending: 0
skipped: 0
blocked: 0
reworked: 2
