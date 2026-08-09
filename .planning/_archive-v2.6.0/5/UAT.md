---
status: testing
phase: 5
fields_version: 1
started: 2026-08-09
updated: 2026-08-09
---

## Items

### 1. Run-1 report covers all 25 surface files
expected: `.planning/phases/5/docs-verify-run-1.md` is committed and every one of the 25 AC1-surface filenames (the four root docs and all 21 cadence-core/workflows/*.md) appears in it, each with its own claim table.
criterion: AC1
status: pass
first_pass: pass
source: verifier
evidence: 25 `###` sections in docs-verify-run-1.md covering the 4 root docs and all 21 workflow files, each with a 4-column claim table; 597 table lines - 50 header/separator lines = 547 claims, matching the report's headline at :8.

### 2. Ledger complete, every resolution stated
expected: `.planning/DOCS-CLAIMS.md` is committed at the .planning root, its row count equals the run-1 report's claim count, every row's resolution reads `accurate`, `corrected - <sha>` or `divergence - <reason>`, and no row reads `pending` or has an empty cell.
criterion: AC2
status: pass
first_pass: pass
source: verifier
evidence: 547 ledger rows vs 547 report claim rows, and per-doc counts diff clean for all 25 docs. Resolutions: 509 accurate, 19 `corrected - <sha>`, 19 `divergence - <reason>`; zero rows read `pending` in the resolution column, zero empty cells, and each corrected sha's commit touched the doc its row names.

### 3. Confirmation run states a real delta
expected: `.planning/phases/5/docs-verify-run-2.md` carries exactly one line matching `run-1 stale N -> run-2 stale M + K divergences` with M strictly less than N, and the counts in it agree with the ledger.
criterion: AC3
status: pass
first_pass: pass
source: verifier
evidence: docs-verify-run-2.md:6 carries the single line `run-1 stale 18 -> run-2 stale 0 + 19 divergences`; its 547 ids are identical to the ledger's, its verdict column tallies 527/0/20, and 19 divergences equals the ledger's divergence count at HEAD.

### 4. Code defects filed, not reworded
expected: Every claim found to describe a real defect has its own DFC id under `## Deferred` in .planning/REQUIREMENTS.md, each is named in phases/5/SUMMARY.md, and `planning.mjs audit --dir .planning` reports zero `unpicked` breaks.
criterion: AC4
status: pass
first_pass: pass
source: verifier
evidence: DFC-01..04 at REQUIREMENTS.md:174-177, all under `## Deferred` and none under `## Active`; `planning.mjs audit --dir .planning` returns ok:true with only the three expected `not-verified` breaks on DOC-02/DOC-03/EVD-02 and zero `unpicked`; all four are described in SUMMARY.md:32-37.

### 5. Evidence artifact reproduces and is linked
expected: A committed file under docs/ carries the weight.mjs resident and turn-one figures with the exact regenerating command, README.md links it, re-running that command reproduces the figures at HEAD, and SUMMARY.md states no non-Cadence project had a phase trace.
criterion: AC5
status: pass
first_pass: pass
source: verifier
evidence: Re-ran both weight.mjs forms at HEAD: all 23 eager figures, the 279,064 total, 10 reachable figures, 19 dispatch rows, zeroResident 26,306, the 5 per-directory rows (93/475,412) and the 12 largest-surface rows all match docs/EVIDENCE.md with zero mismatches. README.md:38 and :132 both link it; every command and path the file names exists (no `/cad-trace` anywhere); SUMMARY.md:124-126 closes the trace half.

### 6. One byte figure for review-triggers.md
expected: skills/cad-land/SKILL.md and skills/cad-plan-review/SKILL.md both name the same byte figure for cadence-core/references/review-triggers.md that `node cadence-core/bin/weight.mjs --root .` reports for it.
criterion: AC6
status: pass
first_pass: pass
source: verifier
evidence: cad-land/SKILL.md:44 and cad-plan-review/SKILL.md:39 both read `17,733 B`, the figure `weight.mjs --root .` reports; no `15,376` remains under skills/.

### 7. Three gates green with budgets regenerated
expected: `node --test cadence-core/bin/*.test.mjs` reports fail 0, `node cadence-core/bin/self-verify.mjs --root .` prints "problems":[], `npx tsc -p tsconfig.ci.json` exits 0, and every weight-budgets.json entry equals the bytes weight.mjs reports.
criterion: AC7
status: pass
first_pass: pass
source: verifier
evidence: tests 1455 / pass 1455 / fail 0; self-verify `"problems":[]`; `npx tsc -p tsconfig.ci.json` exit 0; all 93 weight-budgets.json entries equal the bytes weight.mjs reports (0 drift, 0 unbudgeted).

### 8. METHOD.md's corrected trigger paragraph states a false fact and contradicts itself
expected: behavior wrong - the b2bad1a correction of METHOD-02 replaced a stale sentence with an inaccurate one
origin: verifier
status: pass
first_pass: fail
source: model
evidence: route-table.json review.solo has diff:off and phase_diff:off; METHOD.md:281-282 now names both and no longer contradicts :292
reported: behavior wrong - the b2bad1a correction of METHOD-02 replaced a stale sentence with an inaccurate one
severity: minor
cause: b2bad1a rewrote METHOD.md:279-282 to correct the phase_diff gate row and overreached: it added a sentence claiming phase_diff is the ONLY trigger off at solo. route-table.json:47 also has diff:off at solo, and METHOD.md:292 states that nine lines later, so the file now contradicts itself.
fix: 716fb60, retest

### 9. task.md's risk_surface instruction lost the diff-path, never-stage and cleanup rules its sibling site keeps
expected: behavior wrong - 044806c rewrote a working instruction to conform to a wiring table the same phase filed as defective (DFC-04)
origin: verifier
status: pass
first_pass: fail
source: model
evidence: task.md:76-82 names .planning/tasks/{slug}/risk-task-{slug}.diff, states never stage it, and states delete it once the trigger returns - matching execute.md:452's rule for its sibling transient diff
reported: behavior wrong - 044806c rewrote a working instruction to conform to a wiring table the same phase filed as defective (DFC-04)
severity: minor
cause: 044806c corrected task.md's risk_surface artifact from shape (a) to shape (c) to match the wiring table, but shape (c) requires a file and the replacement names no path, no never-stage rule and no cleanup - unlike execute.md:452, which names plan-<k>-risk-task-<n>.diff and states it must never be staged. The root cause is the wiring table omitting shape (a) for the one already-committed fire site, which is filed as DFC-04.
fix: 716fb60, retest

## Summary

total: 9
passed: 9
failed: 0
pending: 0
skipped: 0
blocked: 0
reworked: 2
