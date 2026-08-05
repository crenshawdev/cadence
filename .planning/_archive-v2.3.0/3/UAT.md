---
status: testing
phase: 3
fields_version: 1
started: 2026-08-05
updated: 2026-08-05
---

## Items

### 1. The 29 skill descriptions are one routing line each, below baseline, none deleted
expected: `grep -h "^description:" skills/cad-*/SKILL.md | sed 's/^description: //' | wc -c` returns below 5078; all 29 values are a single line each; the six cad-*-contract descriptions are byte-identical to their pre-phase text; and the phase record carries a before/after trigger-word list for the edited skills showing no trigger word dropped.
criterion: AC1
status: pass
first_pass: pass
source: verifier
evidence: 3759 B at HEAD vs 5078 at 35ba9eb and 6e8092a; 29 files, exactly one description: line each, no wrapped value; all six cad-*-contract lines byte-identical to 35ba9eb; per-skill bytes match all 23 MEASUREMENTS rows exactly; aggregates 4,511->3,192 and 567->567 reproduce. Trigger-word re-audit against git show 35ba9eb: vs HEAD over PLAN task 5's 23 required word lists: 0 dropped, 9 gained (review provider, symptom, help, land, plan review, PLAN.md, progress, undo, verify); all 46 before/after strings verbatim identical to git

### 2. All 19 rung-agent descriptions are one routed-rung clause, rung map untouched
expected: Each of the 19 agents/*.md descriptions is one clause naming its rung and that it is routed rather than user-selected, with the six unsuffixed files also carrying a role noun; and the phase diff shows no change to any effort:, tools:, disallowedTools: or skills: line, to any agent body, or to lib/rung-agent.mjs.
criterion: AC2
status: pass
first_pass: pass
source: verifier
evidence: git diff 6e8092a..HEAD -- agents/ is 19 files, 19 insertions / 19 deletions, and filtering out ^[+-]description: leaves ZERO diff lines, so no effort:, tools:, disallowedTools:, skills: or body changed; lib/rung-agent.mjs has no diff; each line names the rung RUNG_FILES assigns it, checked file-by-file against rung-agent.mjs:36-68; the six unsuffixed files carry a role noun; 1638 B vs 3472

### 3. references/** and templates/** are under the weight budget at exact bytes
expected: `node cadence-core/bin/weight.mjs` lists every file under cadence-core/references/ and cadence-core/templates/; weight-budgets.json carries an entry for each equal to its exact byte count; and the budget-equality one-liner prints `budgets exact` tree-wide.
criterion: AC3
status: pass
first_pass: pass
source: verifier
evidence: weight.mjs reports 92 surfaces / 418,081 B; all 23 files under cadence-core/{references,templates} present (23/23 against find) totalling 162,186 B; programmatic manifest compare gives 0 mismatches, 0 orphans, 92 budget keys. Behavioral proof the ratchet bites: appending 6 B to references/model-hints.json and templates/STATE.md on an archived HEAD makes self-verify --root return ok:false with two budget-overrun problems. Per-commit replay over all seven phase commits: each archived tree measures mismatch=0 orphan=0 (69 surfaces before f6a0405, 92 after)

### 4. One unreadable descendant no longer hides its whole subtree, and a symlink cycle counts once
expected: On a fixture with skills/private/ at mode 000 beside a readable skills/good/SKILL.md, `weight.mjs --root <fixture>` lists skills/good/SKILL.md in surfaces; on a skills/a/loop -> .. cycle it reports one surface rather than 41; and weight.test.mjs carries a row pinning each.
criterion: AC4
status: pass
first_pass: pass
source: verifier
evidence: Live fixture: weight.mjs --root with skills/private at mode 000 beside skills/good/SKILL.md returns surfaces containing skills/good/SKILL.md; a skills/a/loop -> .. cycle returns exactly one surface. Pinned by weight.test.mjs:91 (BUD-02), :112 (D-07) and :130 (the qualified symlinked-branch-root exception). Suite ran as uid 1000 with 0 skipped, so the mode-bit rows really executed

### 5. self-verify names the path that is actually unreadable
expected: On that same mode-000 fixture, `node cadence-core/bin/self-verify.mjs` names skills/private with an EACCES-derived detail, rather than naming skills with EISDIR.
criterion: AC5
status: pass
first_pass: pass
source: verifier
evidence: self-verify.mjs:187-224 recurses per dirent and yields {file: dir, unreadable: e.code} for the failing directory only; self-verify.test.mjs:499 asserts exactly one unreadable-surface with file === 'skills/private' and detail === 'EACCES', asserts no problem names 'skills', and asserts the readable sibling is still linted. Reproduced live on a fixture

### 6. The gates are green and the closing measurement is recorded and recomputable
expected: `node --test cadence-core/bin/*.test.mjs` and `node cadence-core/bin/self-verify.mjs` both pass; the phase record carries the closing measurement as per-command turn-one totals against the D-19 baseline, with the weighed total reported separately and the reference/template entries called out as new coverage; and the recorded after-figures match a fresh recomputation.
criterion: AC6
status: pass
first_pass: fail
source: verifier
evidence: MEASUREMENTS.md:104 reads 'seven of twelve fell, one is flat, and four rose'; the table above it shows SIX falls (cad-land, cad-milestone, cad-pause, cad-plan-review, cad-phase, cad-undo), one flat (cad-verify), and FIVE rises (cad-config +231, cad-context +209, cad-new-project +249, cad-execute +192, cad-plan +37). :106 repeats the overcount ('The seven falls'); :116 says 'The four rises' and then enumerates five in the same sentence. SUMMARY's deviation says five commands grew between D-19 and 35ba9eb; measured, SIX did - the five plus cad-verify 19,834 -> 19,858 (+24 from workflows/verify.md), which MEASUREMENTS:112 discloses elsewhere. Gates themselves: 1156 pass / 0 fail, self-verify problems:[], tsc exit 0.
reported: The gates ARE green and every number in the record reproduces, but the phase record's narrative contradicts its own correct table, and SUMMARY's deviation count is off. MEASUREMENTS.md is the sole evidence for AC6 and this is the last phase of the milestone, so the wrong counts ship.
severity: minor
cause: Hand-written narrative counts over a generated table, never recomputed against it. MEASUREMENTS.md:104/:106/:116 say seven falls and four rises; the table shows six falls, one flat, five rises - and :116 enumerates five files in the same sentence that says four. SUMMARY's deviation says five commands grew between D-19 and 35ba9eb; six did, the extra being /cad-verify +24 from workflows/verify.md, which MEASUREMENTS:112 already discloses. Every number in every table is correct and reproduces; only the prose counts are wrong.
fix: 0bc357f, retest

### 7. Host skill selection still routes correctly after the description cut
expected: In a live session, a natural request that used to reach a command still selects the same skill - 'audit whether any requirement got dropped' reaches /cad-audit, 'roll back phase 2' reaches /cad-undo - and the three disambiguating negatives still hold, so /cad-health is not chosen for a traceability audit. No Cadence code reads a description: line (D-04), so nothing in the repo can falsify the host's matching behavior; the clean trigger-word audit is the hedge, but only a live session settles it.
origin: verifier
status: skipped
reason: Only checkable once v2.3.0 is the INSTALLED plugin - a live session loads the installed version (2.2.0 today), not this working tree, so any routing test now exercises the old descriptions. Not wired in as a dev plugin by standing preference. Re-check after release; the clean trigger-word audit (0 dropped, 9 gained) is the standing hedge.

## Summary

total: 7
passed: 6
failed: 0
pending: 0
skipped: 1
blocked: 0
reworked: 1
