---
status: testing
phase: 5
fields_version: 1
started: 2026-08-27
updated: 2026-08-27
---

## Items

### 1. Inflected pairs return the same documents
expected: Over the committed fixture corpus, `planning.mjs recall` returns the same document set for each of seam/seams, close/closes, file/files, note/notes and type/types.
criterion: AC1
status: pass
first_pass: pass
source: verifier
evidence: Real CLI over the materialized fixture root: seam/seams both total=2 ids=zq02,zq01; close/closes both total=2 ids=zq03,zq04. planning-recall-fold.test.mjs:248-277 deep-equals results and totals across all five pairs and asserts each pair's exclusive-form document is in the hits; 12/12 arms pass.

### 2. name/named/naming and the other -ed pairs converge
expected: Over that same corpus, name, named and naming return the same document set, and so do refuse/refused and plan/planned.
criterion: AC2
status: pass
first_pass: pass
source: verifier
evidence: CLI: name, named and naming each total=3 ids=zq12,zq11,zq13. refuse/refused and plan/planned covered by the same GROUPS arm with equal totals and the other-member document present; tokenize confirms refused->refuse and planned->plan.

### 3. The fold never deletes a term by landing it on a stopword
expected: A query for `notes` returns a non-empty result set and the term notes is present in the built index; `being` likewise. The stopword filter still tests the raw token.
criterion: AC3
status: pass
first_pass: pass
source: verifier
evidence: bm25.mjs:161-162 filters the raw token before .map(foldSuffix). planning-recall-fold.test.mjs:290-301 proves being->be and its->it are in the index while both folds are stopwords; :314-322 proves the filter still runs. CLI: `notes` total=2, `being` total=1.

### 4. The committed fixture query set runs and its named hits hold
expected: A committed fixture query set names its known-good top hits and runs under `node cadence-core/bin/test.mjs`. Each query's named hits appear in its top 5, except the queries the fixture explicitly marks as changed by the fold.
criterion: AC4
status: pass
first_pass: pass
source: verifier
evidence: 30 documents / 4 sources / 3 tiers and 16 queries under cadence-core/bin/fixtures/; the fold commit 1d6a10ac moved exactly 2 of 16 entries, each carrying changed_by_fold naming what entered and what fell, leaving 14 at the pre-fold baseline. The arm runs inside test.mjs's planning group and passes.

### 5. SUMMARY records the two undelivered GH-93 items with reasons
expected: The phase SUMMARY records GH-93 items 2 and 3 as open items, each naming why it was not delivered, and states all three item-3 obstacles: parseSummarySnippets returning 0 on live reports/plan-<k>.md, REVIEW-*.md being JSON whose adjudicated rulings live in ADJUDICATION-*.json, and milestone-prune's residue walk needing extension for any new tier.
criterion: AC5
status: pass
first_pass: pass
source: verifier
evidence: SUMMARY.md:58-73 carries both items with reasons and all three item-3 obstacles; obstacle 2 confirmed against .planning/phases/4/REVIEW-risk_surface-plan-1.md, which is JSON, with ADJUDICATION-*.json beside it.

### 6. Suite green, self-verify ok, new test file in the planning group
expected: `node cadence-core/bin/test.mjs` is green, `node cadence-core/bin/self-verify.mjs` reports ok:true, and the new test file's stem is registered in test.mjs's `planning` group rather than falling into `other`.
criterion: AC6
status: pass
first_pass: pass
source: verifier
evidence: 3502/3502 pass, 0 fail; self-verify {"ok":true,"problems":[]} over 30 checks; --list shows planning-recall-fold in planning (29) and not in other.

## Summary

total: 6
passed: 6
failed: 0
pending: 0
skipped: 0
blocked: 0
reworked: 0
