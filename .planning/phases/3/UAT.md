---
status: testing
phase: 3
fields_version: 1
started: 2026-08-14
updated: 2026-08-14
---

## Items

### 1. String protected_branches honored by all four readers
expected: protected_branches: "release" resolves to ["release"] in git-guard, git-publish, git-branch, and land-cleanup via one shared pure helper; a string-form test exists per consumer, and a test pins that protected_branches: [] still means nothing protected (no fallback to ['main','master'])
criterion: AC1
status: pass
first_pass: pass
source: verifier
evidence: lib/protected-branches.mjs consumed at git-guard.mjs:139, git-publish.mjs:94, git-branch.mjs:52, land-cleanup.mjs:110; string arm per consumer test file; [] arm git-guard.test.mjs:167; live land-cleanup fixture run printed base:"release"

### 2. Section scanners skip fenced examples
expected: classifyPhaseList and classifyActiveSection run against the shipped templates/ROADMAP.md and templates/REQUIREMENTS.md return the real section (no-section / ids:null on the templates), not the fenced example; a regression test per scanner reddens on the pre-fix code, including the fenced-example-above-real-section shape
criterion: AC2
status: pass
first_pass: pass
source: verifier
evidence: live: classifyPhaseList(templates/ROADMAP.md)=no-section/[], classifyActiveSection(templates/REQUIREMENTS.md)=ids:null/no issues, parseActiveIds=null; regression arms planning-files.test.mjs:615-635,1020-1040

### 3. Blank --root refused by both detect commands
expected: planning.mjs detect-commands --root "" and detect-surfaces --root "" (and whitespace-only values) return {"ok":false,"reason":"bad-args"} exactly as debt-harvest does, one test row per command per shape
criterion: AC3
status: pass
first_pass: pass
source: verifier
evidence: all four blank/whitespace spellings return {"ok":false,"reason":"bad-args"} matching debt-harvest; planning.test.mjs:4428-4455

### 4. Helpers defined once, pinned by census
expected: flag/optionalFlag, flagValue, the ''-returning readText, and the rev-parse branch reader are each defined exactly once under cadence-core/bin/, and the tree-wide definition census test reddens when a copy is added in any .mjs file
criterion: AC4
status: pass
first_pass: pass
source: verifier
evidence: single definitions confirmed by grep; census falsified live - a pasted probe copy reddened helper-census.test.mjs naming the probe file, green after removal

### 5. Suite green and self-verify clean
expected: node --test cadence-core/bin/*.test.mjs passes with 0 failures, and node cadence-core/bin/self-verify.mjs reports no unbudgeted-surface and no budget-overrun
criterion: AC5
status: pass
first_pass: pass
source: verifier
evidence: 1752/1752 pass, 0 fail; self-verify problems:[]

## Summary

total: 5
passed: 5
failed: 0
pending: 0
skipped: 0
blocked: 0
reworked: 0
