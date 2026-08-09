---
status: testing
phase: 1
fields_version: 1
started: 2026-08-08
updated: 2026-08-08
---

## Items

### 1. Only current-cycle items remain open, each with one verdict
expected: Above the `## Archive` heading in .planning/CAPTURE.md, every `- [ ]` bullet that was present at the baseline is a current-cycle (v2.5.0) item and carries exactly one dated verdict clause - CLOSED by <sha>, CLOSED verified live against <file:line>, MOOT with reason, or KEPT re-verified against <file:line>. 28 bullets, 28 verdicts, none missing.
criterion: AC1
status: pass
first_pass: pass
source: verifier
evidence: 28 of the 30 open bullets above `## Archive` carry exactly one of the four D-04 verdict shapes (24 KEPT, 4 CLOSED); the 2 without are absent from `triage-work/baseline/CAPTURE.md` and are the `/cad-execute` summary appends AC1 exempts. 185 archived + 28 triaged accounts for all 213 baseline open items.

### 2. Historical items archived as a block, invisible to recall
expected: Every non-current-cycle open item from the baseline sits under `## Archive`, the section opens with one dated block reason stating the presumptive-death premise, and a token occurring ONLY in archived text returns zero results from `planning.mjs recall` - while the same token against a control copy whose `## Archive` heading is renamed into the walked set returns the bullet.
criterion: AC2
status: pass
first_pass: pass
source: verifier
evidence: 185 bullets under `## Archive` (`.planning/CAPTURE.md:131`) with one dated block reason and no per-item verdict; all 185 verbatim from the baseline, no dupes. Re-run against fresh snapshots: `recall` for `interrogation` returns `{"ok":true,"results":[]}` live and the bullet (3.0682) against the single-pass `sed` control whose `## Notes` count is 1 - a zero that is invisibility, not absence.

### 3. Closed items stay in Todos and stay in the corpus
expected: All 51 `- [x]` bullets remain under `## Todos` with none below `## Archive`, and the recall query `git guard tokenizer` still returns the `[closed]` 'Six pre-existing git-guard rail-3 holes' item at rank 1.
criterion: AC3
status: pass
first_pass: pass
source: verifier
evidence: 51 `- [x]` bullets, zero below `## Archive`; `parseCaptureSnippets` yields 51 `[closed] ` docs of 88 and no bare `[closed]`; `git guard tokenizer` still returns "Six pre-existing `git-guard` rail-3 holes" at rank 1 (7.6432).

### 4. No visible bare (phase N) tag names a pre-v2.5.0 milestone
expected: Every bullet still visible to the reader that carries a bare `(phase N)` tag is a current-cycle item; historical tags read `(vX.Y.Z phase N)` and no longer parse as a phase field through the anchored regex at planning-files.mjs:627.
criterion: AC6
status: pass
first_pass: pass
source: verifier
evidence: All 40 bare tags above `## Archive` are v2.5.0 `(phase 1)`/`(phase 2)` captures; 32 historical tags read `(vX.Y.Z phase N)` and no longer parse as a phase field, three of them confirmed by `git describe --contains` (81bab78 -> v1.4.0, 1e34058 -> v2.0.0, 19e6eba -> v2.3.0). The `(phase 5, criteria-coverage)` pair SUMMARY names is excluded by D-05's own regex evidence.

### 5. SUMMARY carries the kept-item assignment list
expected: .planning/phases/1/SUMMARY.md contains the kept-item assignment list itself - one row per KEPT item with a restatement, a re-verified citation and a target of phase 2, phase 3 or unassigned - so phases 2 and 3 can consume it without opening CAPTURE.md. No row targets context reduction.
criterion: AC7
status: pass
first_pass: pass
source: verifier
evidence: `SUMMARY.md:114-149`: 24 KEPT rows + 1 carry-over, equal to the queue's 24 KEPT verdicts, byte-identical to the table at `reports/plan-1.md:188`, targets only `phase 2` (2) and `unassigned` (23).

## Summary

total: 5
passed: 5
failed: 0
pending: 0
skipped: 0
blocked: 0
reworked: 0
