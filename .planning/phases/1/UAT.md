---
status: testing
phase: 1
fields_version: 1
started: 2026-08-15
updated: 2026-08-15
---

## Items

### 1. risk-check run answers a matching range
expected: `node cadence-core/bin/planning.mjs risk-check run --phase <N> --plan <k> --base <ref> --head <ref>` over a range containing a risky change prints one JSON line carrying checked, categories, matches and inconclusive, with matches naming the category and the signal that found it.
status: pass
first_pass: pass
source: verifier
evidence: Scratch-repo run over a range adding m.sql: ok:true with matches [{"category":"migrations","signal":".sql file"}] and all four fields on one JSON line

### 2. risk-check run records a CLEAN range too
expected: The same command over a range with no risky change still prints the four fields AND still appends one {"family":"outcome","event":"risk_check"} line to .planning/trace.jsonl, so a reader can tell "the check never ran" from "it ran and matched nothing".
status: pass
first_pass: pass
source: verifier
evidence: Clean range printed the four fields and the fixture trace.jsonl gained one outcome/risk_check line; the git-failure path also appended, while a bad-args refusal appended nothing

### 3. categories uses the existing eight tokens only
expected: The categories field is exactly the eight tokens already carried by route-table.json's risk_surface_categories and review.triggers.risk_surface.surfaces - no new vocabulary introduced.
status: pass
first_pass: pass
source: verifier
evidence: CATEGORIES from lib/surface-scan.mjs is byte-equal to route-table.json risk_surface_categories and config.schema.json review.triggers.risk_surface.surfaces; risk-diff.mjs takes the vocabulary from the caller and states no token list of its own

### 4. inconclusive stays honest
expected: A range the heuristics cannot judge (a binary file, a gitlink/submodule bump, an unreadable body) reads inconclusive: true with matches: [], and a caller can distinguish it from a judged-clean range, which reads inconclusive: false with matches: [].
status: pass
first_pass: pass
source: verifier
evidence: Binary stanza and gitlink/Subproject bump both -> inconclusive:true with matches:[]; a readable clean hunk -> inconclusive:false; empty/null/scalar -> checked:false with inconclusive:true and no throw

### 5. risk-check status refuses a phase with a missing record
expected: `risk-check status --phase <N>` exits 1 and names, by plan, every completed executor range in that phase carrying no risk record, and exits 0 once each one has a record.
status: pass
first_pass: fail
source: model
evidence: After 64900ee. Five fixture rows green (node --test --test-name-pattern over risk-diff.test.mjs -> 5 tests, 5 pass, 0 fail), two of them watched RED against the pre-fix tree: 'an EARLIER invocation of the same cycle is still required' and 'a return the bound cannot PLACE is still required'. Live: risk-check status --phase 1 -> ok:true exit 0 with one row run 1-279466b plan 1 completed 3 state recorded; before its record existed the same command returned ok:false reason risk-record-missing exit 1.
reported: behavior wrong - the phase-wide arm only sees completed ranges whose correlation id equals the phase's NEWEST phase_start anchor, so any range completed before a re-anchor is silently exempt from the requirement
severity: major
cause: b481fb3's thisRun filter keys on renderTrace's corr, which derives from the phase's NEWEST phase_start anchor. execute.md appends a phase_start with git rev-parse --short HEAD on every invocation, so a phase executed across more than one /cad-execute run re-anchors to a different sha and the earlier run's completed brackets fall outside the filter - exempt from the phase-wide requirement. Confirmed live: phase 1 carries ten phase_start anchors under nine distinct corrs, and risk-check status --phase 1 now reports ok:true over a single plan-1 row. The named-range arm that execute.md actually fires is unaffected and still enforces.
fix: 64900ee, retest

### 6. a narrower earlier record does not satisfy a later range
expected: Given --plan <k> --base <ref> --head <ref>, status requires a record for THAT range: a record left by an earlier or narrower range of the same plan reports stale rather than passing.
status: pass
first_pass: pass
source: verifier
evidence: Live: named range B..H against records for B..C and C..H -> state "stale", exit 1, both ref pairs named; B..C -> "recorded", exit 0. Identity is the resolved base_id/head_id pair

### 7. both completion paths call the seam
expected: workflows/execute.md's post-plan risk_surface step and workflows/task.md's risk_check step invoke `planning.mjs risk-check run` instead of instructing a model to read a prose list of eight categories, and neither reports done while the record is absent - including a run that answered ok:true while its append came back written:false.
status: pass
first_pass: pass
source: verifier
evidence: execute.md runs risk-check run then risk-check status and withholds done on its refusal; task.md runs risk-check run --phase 0 and withholds done on written:false; three failing-capable prose-agreement rows pin all of it and pass

### 8. blocking behaviour and the re-arm cap are unchanged
expected: risk_surface still blocks on a match, and the ONE-round narrowed re-arm cap in references/triage-gate.md reads exactly as it did before this phase.
status: pass
first_pass: pass
source: verifier
evidence: triage-gate.md byte-identical across the range; triage-gate.md reference counts in execute.md (3) and task.md (1) unchanged from 279466b

### 9. no gate, key or route-table cell moved
expected: `git diff --stat 279466b..HEAD -- cadence-core/route-table.json cadence-core/config.schema.json` is empty: risk_surface's gate at every stakes level reads exactly as it does today.
status: pass
first_pass: pass
source: verifier
evidence: git diff --stat over route-table.json and config.schema.json across 279466b..b481fb3 is empty

### 10. surface-scan.mjs stayed the scoping aid
expected: lib/surface-scan.mjs still answers "which categories does this project SCOPE" and still returns all eight unconditionally; lib/risk-diff.mjs answers "did this RANGE touch one"; each file's header names the other, and no caller confuses them.
status: pass
first_pass: pass
source: verifier
evidence: Comment-only change to surface-scan.mjs; scanTree still returns all eight unconditionally; both headers name the split; planning.mjs uses CATEGORIES only as the vocabulary passed to scanDiff

### 11. the new seam has its self-verify CONTRACTS row
expected: cadence-core/bin/self-verify.mjs carries a CONTRACTS row for the risk-check subcommand, so the invocation lint covers its flags.
status: pass
first_pass: pass
source: verifier
evidence: Two CONTRACTS rows plus risk-check added to TWO_WORD; self-verify reports problems [] with no unknown-subcommand or uncontracted-script

### 12. the suite and self-verify run clean
expected: `node --test 'cadence-core/bin/*.test.mjs'` and `node cadence-core/bin/self-verify.mjs` both run clean, with fixture rows for a risky range, a clean range, an inconclusive range and the missing-record refusal in the suite.
status: pass
first_pass: pass
source: verifier
evidence: 1908/1908 tests pass in one full run; self-verify problems [] over 22 checks; 36 named rows in risk-diff.test.mjs cover risky, clean, inconclusive and missing-record

### 13. the enforcement was watched to FAIL first
expected: The completion requirement was demonstrated failing against the tree as it stood before the wiring landed - a completed range with no risk record reported by name - rather than only passing afterwards.
status: pass
first_pass: pass
source: verifier
evidence: 3eb0971 landed before the wiring commit 23daf54 and quotes the verbatim exit-1 refusal naming plans 1 and 2; FROZEN_PHASE_1 freezes the pre-wiring bytes

### 14. the detector self-matches its own test fixtures
expected: behavior wrong - the content patterns fire on the literal strings in cadence-core/bin/risk-diff.test.mjs, so the blocking gate's first live firing on this repository was a false positive on the seam's own fixtures
origin: verifier
status: fail
first_pass: fail
source: verifier
evidence: `risk-check run --base 279466b --head b481fb3` (record diverted to a scratch planning dir) returns six of eight categories: auth 'a JWT sign/verify call', migrations 'an ALTER TABLE statement', billing 'a Stripe reference', concurrency 'a lock primitive', destructive 'an `rm -rf`', untrusted_input 'a JSON.parse call'. Every one of those strings is fixture text in cadence-core/bin/risk-diff.test.mjs. The ROADMAP holds detection heuristic on purpose, so this breaches no success criterion, but it means every future Cadence phase touching that file fires the one gate that is blocking at every stakes level
reported: behavior wrong - the content patterns fire on the literal strings in cadence-core/bin/risk-diff.test.mjs, so the blocking gate's first live firing on this repository was a false positive on the seam's own fixtures
severity: minor
cause: lib/risk-diff.mjs scans changed lines for content signals, and cadence-core/bin/risk-diff.test.mjs holds those signals as literal fixture text (a JWT sign call, ALTER TABLE, a Stripe reference, rm -rf, a lock primitive, JSON.parse). The detector has no notion of its own fixtures, so any range touching that file self-matches. Breaches no ROADMAP success criterion - detection is heuristic by design - but risk_surface is blocking at every stakes level, so the false positive lands on the one gate that always fires.
fix: left open by decision 2026-08-15: breaches no ROADMAP success criterion (detection is heuristic by design), already queued in .planning/CAPTURE.md

## Summary

total: 14
passed: 13
failed: 1
pending: 0
skipped: 0
blocked: 0
reworked: 2
