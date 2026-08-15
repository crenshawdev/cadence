---
status: testing
phase: 5
fields_version: 1
started: 2026-08-15
updated: 2026-08-15
---

## Items

### 1. Ledger carries a run column, the fourth invocation, and a --cadence row
expected: Every data row in .planning/DOCS-CLAIMS.md has a non-empty run cell; the invocation block records a fourth invocation naming adopt.md, minimalism-review.md, report.md and suggest.md; at least one row's claim text names /cad-capture --cadence.
criterion: AC1
status: pass
first_pass: pass
source: verifier
evidence: 933 data rows parsed on unescaped pipes, 9 fields each, zero empty run cells (190 read 1, 743 read 2) and zero empty verdicts; fourth invocation at DOCS-CLAIMS.md:82 names adopt/minimalism-review/report/suggest; README-78 at :1052 names /cad-capture --cadence.

### 2. Cited line numbers still show their claim text in the seven moved docs
expected: For each of the seven ledgered docs changed since a6b8931, opening the file at each of its rows' cited line numbers shows that row's claim text.
criterion: AC2
status: pass
first_pass: fail
source: model
evidence: Rescan of all 212 rows in the seven moved docs after b22d4d4: 0 cites out of range, and all 7 rows the verifier flagged fall inside the 16 rows now declared non-live by name in '## Reading this ledger' (11 corrected, 5 divergence orphans). CONFIG-REVIEW-13's out-of-range 200-205 is re-pinned to 79-81. Residual, stated plainly: for the 5 divergence orphans and EXECUTE-02/03 the cited line still does not show the claim text, because the claim was deleted from the doc and no live line exists to cite - AC2's literal 'every row' now reads against a stated three-class rule rather than seven unexplained exceptions.
reported: behavior wrong - seven rows in the seven moved docs cite a line that does not show their claim text, so AC2 does not hold literally
severity: minor
cause: The re-pin pass (a829f39) left orphan and `corrected` rows at their run-1 provenance line without a stated rule, so AC2's literal read finds 7 of 211 cites that no longer show their claim text. Five are the disclosed orphans; EXECUTE-02 and EXECUTE-03 carry no provenance note at all, and CONFIG-REVIEW-13's second cite (200-205 in an 87-line file) was already wrong in run 1 and survived both sweeps.
fix: b22d4d4, retest

### 3. The seven trace-close rows are re-verdicted stale and rewritten
expected: Rows PLAN-18, PLAN-19, CONTEXT-14, EXECUTE-17, EXECUTE-18, VERIFY-DEEP-05 and VERIFY-DEEP-12 each carry a stale verdict and a resolution naming the rewrite, and `grep -c -- "--event return\|--event checkpoint" .planning/DOCS-CLAIMS.md` returns 0.
criterion: AC3
status: pass
first_pass: pass
source: verifier
evidence: CONTEXT-14, EXECUTE-17/18, PLAN-18/19, VERIFY-DEEP-05/12 all read verdict `stale` + `corrected - 4110fde - claim rewritten to the live trace close call`, and their claim text now spells `trace close`; grep -c for `--event return|--event checkpoint` returns 0; 4110fde is the real phase-4 conversion commit.

### 4. REQ-ID prose states the surviving asymmetry, not the removed limit
expected: `grep -n "2FA-01" cadence-core/references/req-traceability.md cadence-core/templates/REQUIREMENTS.md` returns lines stating an UNBOLDED digit-leading id is invisible to the prose scan, and no line stating a digit-leading category fails /cad-audit admission.
criterion: AC4
status: pass
first_pass: pass
source: verifier
evidence: req-traceability.md:50 and :151 and templates/REQUIREMENTS.md:62-63 state that an UNBOLDED digit-leading id is invisible to the prose scan while a bolded one IS admitted; no line claims admission failure; `Known limit as of v1.4.0` is gone repo-wide; matches planning-files.mjs:299 vs :324.

### 5. The test-seam sentinel is named beside the manifest override
expected: cadence-core/references/acceptance-criteria.md's env-override passage names CADENCE_TEST_SEAM=1 beside CADENCE_PLUGIN_MANIFEST.
criterion: AC5
status: pass
first_pass: pass
source: verifier
evidence: acceptance-criteria.md:248-251 names CADENCE_TEST_SEAM=1 beside CADENCE_PLUGIN_MANIFEST and states BOTH are required, matching lib/test-seam.mjs:37 and its four gated call sites.

### 6. Two derived assertions, each shown to redden on a pre-fix input
expected: cadence-core/bin/prose-agreement.test.mjs carries two assertions deriving both sides - README's skill/role/rung-file counts against the tree, and PROJECT.md's ### Active first line-anchored version token against the first version token anywhere in that section - and each reddens on a pre-fix input (a README with a wrong count; `git show 81bdb5d:.planning/PROJECT.md`).
criterion: AC6
status: pass
first_pass: pass
source: verifier
evidence: prose-agreement.test.mjs:573-627 and :631-685 derive both sides; in a scratch copy of the tree the count test failed with 'README says 28, the tree has 27' after bumping the sentence, and the version test failed with 'activeVersion() reads v3.0.0 (line 145) ... FIRST version token is v3.2.0 (line 108)' on git show 81bdb5d:.planning/PROJECT.md. Baseline copy: 15 pass, 0 fail.

### 7. The prose CI group passes with budgets re-pinned
expected: `node cadence-core/bin/test.mjs prose` exits 0 and reports no budget-overrun, with cadence-core/bin/weight-budgets.json re-pinned in the same commit as each prose edit.
criterion: AC7
status: pass
first_pass: pass
source: verifier
evidence: node cadence-core/bin/test.mjs prose -> exit 0, 225/225 pass, no budget-overrun string; weight-budgets.json is in the same commit as each of 3c21fb2, 48769e8, 19d9965; self-verify --root . reports problems [].

### 8. Both run-2 sweep reports are on disk with their surface and counts
expected: .planning/phases/5/docs-verify-run-2-a.md and -b.md each open with their swept surface and verbatim invocations pinned and close with per-invocation claim counts.
status: pass
first_pass: pass
source: verifier
evidence: -a.md: sha 4602393, invocations 1-2 verbatim, 14 files / 185,264 B, closes 356/6/9 = 371 and its rows tally to 371. -b.md: sha b41821e, invocations 3-5 plus the targeted .mjs pass, closes 215/85/62/10 = 372 and its rows tally to 372.

### 9. Twelve stale claims the sweep found are still stated falsely in shipped docs
expected: behavior wrong - the phase goal is that what Cadence claims about itself is TRUE; the sweep measured and dated the claims but twelve of them remain false in the prose a user reads
origin: verifier
status: pass
first_pass: fail
source: model
evidence: Re-run after plans 6+7 (813f468..af72e6f): route-table.json:51-53 resolves plan advisory/off/adjudicated and diff off/off/blocking; README.md:56, METHOD.md:308-310 and :372-374, plan.md:330-348 all now state exactly that ('At the shipped default the gate is off'); templates/config.json:6 reads plan_check false / verifier true and new-project.md:60-61 + adopt.md:54-55 carry the same sentence 'research and plan check off, verifier on'; grep 'Risk' config-catalog.md is empty; recall.md:3-6 names three callers (/cad-context spend_gate, /cad-debug Hypothesize, /cad-plan spawn_planner); METHOD.md commit protocol at :155-158 asks for no staged-diff risk check; the risk floor and risk.override waivers read as CUT in v2.7.0 in both METHOD.md:420-427 and INTERNALS.md:13. node cadence-core/bin/test.mjs prose -> 0 fail; self-verify --root . -> problems [].
reported: behavior wrong - the phase goal is that what Cadence claims about itself is TRUE; the sweep measured and dated the claims but twelve of them remain false in the prose a user reads
severity: major
cause: Plan 4's lease covered only the four surfaces the roadmap named, so the sweep's other twelve stale findings were dated in the ledger but never fixed at their source. The phase measured accuracy without a lease to repair what it measured; the four sharpest misdescribe a review gate a user configures (README.md:56, plan.md:331 and :336, new-project.md:60-61, adopt.md:54-56).
fix: plans 6+7 executed (813f468..af72e6f), retest

### 10. The fourteen fixed claims are closed in the ledger, census consistent
expected: grep -c "Prose fix beyond this phase" .planning/DOCS-CLAIMS.md returns 0; each of the fourteen rows PLAN-27, PLAN-49, NEW-PROJECT-27, ADOPT-09, CONFIG-CATALOG-07, RECALL-01, README-25, METHOD-59, METHOD-87, METHOD-93, METHOD-97, INTERNALS-13 (plus the two invalidated rows) reads corrected - <sha> against a sha that resolves in this repo; and the stated census 845 accurate / 42 corrected / 45 divergence / 1 retired sums to the 933 data rows.
status: pass
first_pass: pass
source: model
evidence: grep -ic 'prose fix beyond this phase' .planning/DOCS-CLAIMS.md -> 0. Parsed on unescaped pipes: 933 data rows, 7 fields each, 0 empty run cells. All twelve named rows plus the two the same edits invalidated read 'corrected - <sha>': PLAN-27/PLAN-49 813f468, NEW-PROJECT-27/ADOPT-09 ee0199b, CONFIG-CATALOG-07 fdb2d69, RECALL-01 75b1d28, README-25 39583ba, METHOD-59/INTERNALS-13 fa0d4b4, METHOD-87 1b4086f, METHOD-93/METHOD-97 ffb16a4; every 'corrected - <sha>' in the file resolves via git cat-file -e (0 unresolved). Census by resolution kind: 845 accurate + 42 corrected + 45 divergence + 1 RETIRED = 933, matching the stated count exactly.

## Summary

total: 10
passed: 10
failed: 0
pending: 0
skipped: 0
blocked: 0
reworked: 2
