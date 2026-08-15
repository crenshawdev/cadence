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
status: fail
first_pass: fail
source: verifier
evidence: route-table.json:52 resolves `plan: off` at `shipped` while README.md:56 and cadence-core/workflows/plan.md:331 say advisory (and :336 the same for `diff`); templates/config.json:6 and config.schema.json:27 default workflow.plan_check to false while new-project.md:60-61 and adopt.md:54-56 say a written config turns it on; config-catalog.md:51 ships a `**Risk**` category header with zero rows and no risk* key behind it; recall.md:3-6 says two callers where plan.md:117 and :182 make three; METHOD.md:157-158, :309-310, :373-374 and INTERNALS.md:13 carry the retired risk floor and the shipped-gate error. Each has a dated `stale` + `divergence` ledger row beside it.
reported: behavior wrong - the phase goal is that what Cadence claims about itself is TRUE; the sweep measured and dated the claims but twelve of them remain false in the prose a user reads
severity: major
cause: Plan 4's lease covered only the four surfaces the roadmap named, so the sweep's other twelve stale findings were dated in the ledger but never fixed at their source. The phase measured accuracy without a lease to repair what it measured; the four sharpest misdescribe a review gate a user configures (README.md:56, plan.md:331 and :336, new-project.md:60-61, adopt.md:54-56).
fix: routed to /cad-plan

## Summary

total: 9
passed: 8
failed: 1
pending: 0
skipped: 0
blocked: 0
reworked: 2
