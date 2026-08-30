---
status: testing
phase: 4
fields_version: 1
started: 2026-08-30
updated: 2026-08-30
---

## Items

### 1. The v3.7.7 close no longer halts on an already-fixed high
expected: Fed the phase-2 review plus its -r2 adjudication record, `land-cleanup.mjs gate` under auto_close returns action "proceed"; remove the fix_commit from that entry and the same call returns action "halt".
criterion: AC1
status: pass
first_pass: pass
source: verifier
evidence: Live `land-cleanup.mjs gate --dir /code/cadence` fed the entries of `git show 220f99d3:.planning/phases/2/ADJUDICATION-risk_surface-plan-1-r2.json` returns action "proceed" with findings []; deleting only the :460 high's fix_commit returns action "halt" with that entry alone (findings[0].line 460). auto_close is true in .planning/config.json, so this repo is genuinely on the halting arm. The four `v3.7.7 (a)-(d)` tests in land-cleanup.test.mjs pass, and the inlined fixture matches the git-show bytes.

### 2. Exactly one definition of the genuinely-unfixed test
expected: A helper-census.test.mjs row matches exactly one definition across every .mjs under cadence-core/bin/, pasting a second copy of that body anywhere reddens it, and close-decision.mjs no longer contains the inline 'blocker' || 'high' literal.
criterion: AC2
status: pass
first_pass: pass
source: verifier
evidence: helper-census.test.mjs:212-238 matches the body idiom once tree-wide; pasting the body into a scratch copy's lib/second-copy.mjs reddens it with "must be defined exactly once, in lib/filing-decision.mjs; found in lib/filing-decision.mjs (x1), lib/second-copy.mjs (x1)". `grep -n "'blocker'\|'high'" lib/close-decision.mjs` returns nothing. Every .mjs in the repo is under cadence-core/bin/, so the walk has no blind spot, and issue-filing.mjs's duplicate fix_commit filter is gone.

### 3. A review nothing ruled is a fifth named state that halts
expected: A REVIEW-risk_surface-*.md with no sibling ADJUDICATION-*.json is reported by its own name in the gate's output and returns action "halt" under auto_close.
criterion: AC3
status: pass
first_pass: pass
source: verifier
evidence: Live gate with `unruled: [".planning/phases/9/REVIEW-risk_surface-plan-1.md"]` -> action halt, reason names `unruled-review` and the path. A present-but-not-a-list `unruled` also halts, naming only the value's type. Decided in its own arm at lib/close-decision.mjs:171-175, after the unreadable arm, never folded into one of the four.

### 4. The four unreadable-input states are unchanged
expected: stdin-unreadable, stdin-empty, malformed-json and not-a-findings-payload keep their names and each still halts under auto_close; close-decision.test.mjs's UNREADABLE loop passes with no edit to it.
criterion: AC4
status: pass
first_pass: pass
source: verifier
evidence: All four halt live under auto_close, each naming itself in the reason: stdin-empty, malformed-json, not-a-findings-payload, and stdin-unreadable (via its named test, tests 1 pass 1). `git diff 2ba6665f..HEAD -- close-decision.test.mjs` shows the UNREADABLE const and its loop unedited.

### 5. An unfixed override is surfaced without moving the verdict
expected: An entry with overridden:true and no fix_commit appears by name on the gate envelope while action is unchanged; an entry carrying both overridden:true and a fix_commit appears nowhere in that surfacing and does not halt.
criterion: AC5
status: pass
first_pass: pass
source: verifier
evidence: Live gate: overridden survived blocker with no fix_commit -> action proceed, findings [], overridden [that entry]. The same entry carrying fix_commit "3341ffb0" -> overridden [] and findings [], so it is surfaced nowhere and halts nothing. One pass at lib/filing-decision.mjs:186-196 decides both, so filter order cannot make one entry a permanent unfixed override.

### 6. The rulings survive the prune that deletes the phase
expected: After milestone-prune.mjs --mode delete over a fixture, the carried ADJUDICATION-*.json is still readable at the carry destination and gate returns the identical halt decision before and after the prune; land-cleanup.mjs's header comment states what the gate reads and where it comes from.
criterion: AC6
status: pass
first_pass: pass
source: verifier
evidence: Scratch fixture: risk-carry --phase 3 copied both artifacts to .planning/risk-carry/3/, milestone-prune --mode delete removed phases/3/ entirely (dirs.deleted [3], confirmed by find), and the payload rebuilt from risk-carry/3/ alone is byte-identical (cmp) and yields the identical halt. Seam registered at planning.mjs:312 with an arg-contract row at lib/arg-contract.mjs:884; milestone.md:110 runs it before the prune, pinned positionally by prose-agreement.test.mjs. land-cleanup.mjs:36-56 states both record roots, every round, and that the gate reads stdin only.

### 7. The full suite and self-verify are green
expected: `node cadence-core/bin/test.mjs` passes with zero failures and `node cadence-core/bin/self-verify.mjs` reports ok:true, with weight-budgets.json re-pinned for every prose file whose byte count changed.
criterion: AC7
status: pass
first_pass: pass
source: verifier
evidence: node cadence-core/bin/test.mjs -> 3622 pass, 0 fail, exit 0. node cadence-core/bin/self-verify.mjs -> ok:true, problems []. weight-budgets.json re-pins all four prose files that changed size, and self-verify's `budgets` check is the enforcer that is passing.

## Summary

total: 7
passed: 7
failed: 0
pending: 0
skipped: 0
blocked: 0
reworked: 0
