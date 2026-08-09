---
status: testing
phase: 1
fields_version: 1
started: 2026-08-09
updated: 2026-08-09
---

## Items

### 1. The NUL guard fires, and the source is text again
expected: 1. cd /data/code/cadence 2. Run: node cadence-core/bin/self-verify.mjs --root . Expect: a line ending "problems":[] 3. Run: grep -rn "const worker" cadence-core/bin/ Expect: cadence-core/bin/lib/trace.mjs:336 printed (no -a flag needed, no "binary file matches") 4. Run: file cadence-core/bin/lib/trace.mjs Expect: JavaScript source, ASCII text (NOT "data") 5. Plant a NUL: printf '\0' >> cadence-core/bin/lib/trace.mjs 6. Run: node cadence-core/bin/self-verify.mjs --root .; echo "exit=$?" Expect: exit=1 and a problem with "kind":"nul-byte-in-source" naming cadence-core/bin/lib/trace.mjs 7. Run: git checkout -- cadence-core/bin/lib/trace.mjs 8. Run: node cadence-core/bin/self-verify.mjs --root . Expect: "problems":[] again
criterion: AC1
status: pass
first_pass: pass
source: verifier
evidence: trace.mjs is 'JavaScript source, ASCII text', grep finds :336 without -a, no NUL under cadence-core/bin; self-verify check 15 (self-verify.mjs:1129-1155) reported nul-byte-in-source at offset 18118 against a planted NUL in an isolated tree copy, and three fixture tests (.mjs, *.test.mjs, non-.mjs) pass

### 2. trace behaviour is unchanged, separator still U+0000
expected: 1. cd /data/code/cadence 2. Run: node --test cadence-core/bin/trace.test.mjs 2>&1 | tail -6 Expect: fail 0, and a non-zero pass count 3. Run: grep -n "const worker" cadence-core/bin/lib/trace.mjs Expect: the key is built with \0 escapes: `${key(e.corr)}\0${key(e.phase)}\0${key(e.plan)}` (the separator is still U+0000 at runtime; only the SOURCE bytes changed)
criterion: AC2
status: pass
first_pass: pass
source: verifier
evidence: trace.mjs:336 uses \0 escapes; node --test trace.test.mjs 50 pass / 0 fail including 'the U+0000 worker separator keeps two SHIFTED brackets apart'

### 3. phase_diff's gate row matches the resolver everywhere
expected: 1. cd /data/code/cadence 2. Run: node cadence-core/bin/route.mjs resolve --role cad-reviewer Expect: the JSON carries "phase_diff":"advisory" (default level is shipped) 3. Run: grep -n "phase_diff" cadence-core/references/review-triggers.md | grep "|" Expect: the wiring row's last cell reads: off / advisory / adjudicated 4. Run: sed -n '168p' docs/WORKFLOW.md Expect: the phase_diff row's three level columns read: off | advisory | adjudicated 5. Run: grep -rn "off / off" cadence-core docs skills METHOD.md README.md Expect: only two hits, both inside test/comment fixtures (dispatch-phrasing.test.mjs:254 and prose-agreement.test.mjs:126) - no live gate claim
criterion: AC3
status: pass
first_pass: pass
source: verifier
evidence: resolver returns advisory at shipped; review-triggers.md:244 and docs/WORKFLOW.md:168 both read off/advisory/adjudicated; the only 'off / off' hits are two test/comment fixtures; prose-agreement test drives resolve at all three levels

### 4. The plan-checker contract agrees with itself on its dimension count
expected: 1. cd /data/code/cadence 2. Run: grep -n "dimensions checked\|Check six\|Check five" skills/cad-plan-checker-contract/SKILL.md Expect: line 42 "Check six dimensions:" and line 113 "- [ ] All six dimensions checked" (both six) 3. Run: sed -n '42,60p' skills/cad-plan-checker-contract/SKILL.md | grep -c "^[0-9]\. \*\*" Expect: 6 4. Run: node --test cadence-core/bin/prose-agreement.test.mjs 2>&1 | tail -6 Expect: fail 0
criterion: AC4
status: pass
first_pass: pass
source: verifier
evidence: SKILL.md:42 'Check six dimensions', :113 'All six dimensions checked', 6 enumerated items; three-way agreement test passes

### 5. The risk_surface row admits what /cad-task can produce
expected: 1. cd /data/code/cadence 2. Run: grep -n "risk_surface" cadence-core/references/review-triggers.md | grep "cad-task" Expect: the wiring row's payload cell reads "(c) the flagged-diff FILE path, or (b) the staged-diff scope in-context" - NO "the checkpoint returned" qualifier 3. Run: grep -n "risk-task-{slug}.diff" cadence-core/workflows/task.md Expect: at least one hit naming .planning/tasks/{slug}/risk-task-{slug}.diff 4. Run: grep -in "never stage it\|delete it once" cadence-core/workflows/task.md Expect: both the never-stage rule and the delete-on-return cleanup are present
criterion: AC5
status: pass
first_pass: pass
source: verifier
evidence: review-triggers.md:243 shape-(c) clause carries no producer qualifier; task.md:78 names the transient path and :81 the never-stage + delete-on-return rules; bounded prose-agreement test passes

### 6. The weight budget is exact in both directions
expected: 1. cd /data/code/cadence 2. Run: node cadence-core/bin/self-verify.mjs --root . Expect: "problems":[] 3. Run: node cadence-core/bin/weight.mjs --root . 2>&1 | tail -3 Expect: it reports the surfaces with no mismatch against weight-budgets.json 4. Plant a shrink: truncate -s -1 cadence-core/references/git-guard.md 5. Run: node cadence-core/bin/self-verify.mjs --root .; echo "exit=$?" Expect: exit=1 and a problem with "kind":"budget-undershoot" naming cadence-core/references/git-guard.md and the 1B shortfall 6. Run: git checkout -- cadence-core/references/git-guard.md 7. Run: node cadence-core/bin/self-verify.mjs --root . Expect: "problems":[] again
criterion: AC6
status: pass
first_pass: pass
source: verifier
evidence: self-verify.mjs:666-682 overrun/undershoot branches; clean tree "problems":[] with 93 surfaces at budget; a 1-byte truncation of git-guard.md in an isolated copy produced budget-undershoot with the 1B shortfall; named undershoot test passes

### 7. All four sites quoting review-triggers.md's size agree with the measurement
expected: 1. cd /data/code/cadence 2. Run: node cadence-core/bin/weight.mjs --root . 2>&1 | grep review-triggers Expect: a byte count for cadence-core/references/review-triggers.md (17,714 today) 3. Run: grep -n "review-triggers" cadence-core/bin/weight-budgets.json Expect: the same number 4. Run: sed -n '44p' skills/cad-land/SKILL.md; sed -n '39p' skills/cad-plan-review/SKILL.md Expect: both quote the same number in NN,NNN B form 5. Run: grep -n "review-triggers" docs/EVIDENCE.md Expect: the twelve-largest row states the same number 6. Run: node --test cadence-core/bin/prose-agreement.test.mjs 2>&1 | tail -6 Expect: fail 0 (the test asserts all of the above plus EVIDENCE's directory subtotals and grand total)
criterion: AC7
status: pass
first_pass: pass
source: verifier
evidence: weight.mjs and wc -c both give 17714; weight-budgets.json:35, cad-land/SKILL.md:44, cad-plan-review/SKILL.md:39, docs/EVIDENCE.md:165 all state 17,714 (4,429 est tokens); three weighAll-backed tests pass, covering all twelve-largest rows plus the directory subtotals and grand total

### 8. The sweep ledger states each defect's real status, and all three gates are green
expected: 1. cd /data/code/cadence 2. Run: grep -n "DFC-0" .planning/DOCS-CLAIMS.md Expect: the DFC-01/02/03 bullets read as CLOSED with their commits, the five + DFC-0k suffix rows state a closed status, and TASK-01 carries + DFC-04 closed 98be3d2 - no bullet or suffix still reads as an open filing 3. Run: node --test cadence-core/bin/*.test.mjs 2>&1 | tail -6 Expect: fail 0 (1467 pass today) 4. Run: node cadence-core/bin/self-verify.mjs --root . Expect: "problems":[] 5. Run: npx tsc -p tsconfig.ci.json; echo "exit=$?" Expect: exit=0 with no diagnostics
criterion: AC8
status: pass
first_pass: pass
source: verifier
evidence: DOCS-CLAIMS.md bullets read CLOSED with commits and all six suffix rows carry a closed status incl. TASK-01 '+ DFC-04 closed 98be3d2'; 1467/1467 tests pass, self-verify "problems":[], tsc exit 0

## Summary

total: 8
passed: 8
failed: 0
pending: 0
skipped: 0
blocked: 0
reworked: 0
