---
status: testing
phase: 1
fields_version: 1
started: 2026-07-28
updated: 2026-07-29
---

## Items

### 1. 13 rung files exist, each carrying its own rung's effort
expected: agents/ holds exactly the 13 files the route-table rungs arrays name (6 base + 7 suffixed); every file's frontmatter effort equals the rung in its name; deleting any one makes `node --test cadence-core/bin/self-verify.test.mjs` fail with a problem naming that agent.
criterion: AC1
status: pass
first_pass: pass
source: verifier
evidence: `ls agents/*.md | wc -l` = 13; `grep -n '^effort:' agents/*.md` shows all 13 matching the rung in the name (base files match base_effort: cad-assumptions-analyzer.md:7 xhigh, cad-plan-checker.md:7 low). In a scratch copy, deleting each of the 13 in turn yields ok:false with `missing-rung-agent | <role> rung <rung> -> agents/<name>.md absent` for exactly that file, 13/13. With cad-reviewer-xhigh.md removed, `node --test cadence-core/bin/self-verify.test.mjs` = tests 40 / pass 39 / fail 1, failing row `the repo itself passes self-verification` (self-verify.test.mjs:109).

### 2. A rung file carrying behaviour fails CI
expected: Adding a contract-skill section tag (<process>, <guardrails>, ...) to the body of an agent file that declares skills: makes `node cadence-core/bin/self-verify.mjs` report ok:false with that file named; removing it returns ok:true.
criterion: AC2
status: pass
first_pass: pass
source: verifier
evidence: Appending `<guardrails>` to agents/cad-planner-xhigh.md in a scratch copy: ok:false with problem `agent-carries-behaviour | agents/cad-planner-xhigh.md | body carries contract section <guardrails> - the contract belongs in the preloaded skill`; restoring the file returns ok:true.

### 3. Retired effort-variant vocabulary is gone from live surfaces
expected: grep -rn "escalate_effort_variant\|effort-variant" --include=*.md --include=*.json --include=*.mjs . returns matches only under .planning/, in CHANGELOG.md, and in DESIGN.md's dated SUPERSEDED bullet (the recorded deviation).
criterion: AC3
status: pass
first_pass: pass
source: verifier
evidence: AC3's exact grep matches only .planning/**, CHANGELOG.md:43, DESIGN.md:369 (the dated SUPERSEDED bullet), and two files under design-notes/ which `git check-ignore -v` reports ignored by .gitignore:20 (untracked local scratch, not a shipped surface). `grep -c escalate_effort_variant` = 0 for route-table.json, route.mjs, route.test.mjs.

### 4. rung_order is declared and out-of-ladder rungs fail with the role named
expected: route-table.json carries rung_order: [low, medium, high, xhigh, max]; a role whose base_effort or escalate_to falls outside its own rungs array fails self-verify with that role named.
criterion: AC4
status: pass
first_pass: pass
source: verifier
evidence: route-table.json rung_order = [low, medium, high, xhigh, max]. Scratch mutations each fire with the role named: base_effort "max" on cad-verifier -> `rung-not-declared | cad-verifier base_effort "max" is not in its own rungs [high, xhigh]`; escalate_to "max" on cad-reviewer -> same kind naming cad-reviewer; rungs += "ludicrous" on cad-executor -> `unknown-rung | cad-executor names rung "ludicrous", which is not in rung_order`.

### 5. Escalation still resolves, now through escalate_to
expected: resolve('cad-plan-checker', autoCfg, ['--attempt','2']) still returns agent cad-plan-checker-high, effort high, escalated true; the four existing escalation rows in route.test.mjs pass unchanged, plus a new row pinning escalate_to as the source of the swap.
criterion: AC5
status: pass
first_pass: pass
source: verifier
evidence: route.mjs:120-131 reads role.escalate_to and names the agent via agentForRung; agents/cad-plan-checker-high.md carries no runtime read. Named-test run of the five escalation rows (including `escalate_to is the SOURCE of the swap - repointing it moves the resolved agent`) = 5 pass / 0 fail. `git diff d01146d..HEAD -- cadence-core/bin/route.test.mjs` shows the three surviving rows changed only in test name and comment; assertions byte-identical. Row :339 was replaced, as SUMMARY's AC5 note records.

### 6. Full test suite and typecheck are green
expected: `node --test cadence-core/bin/*.test.mjs` exits 0 and `npx tsc -p tsconfig.ci.json` exits 0.
criterion: AC6
status: pass
first_pass: pass
source: verifier
evidence: `node --test cadence-core/bin/*.test.mjs` EXIT=0, tests 774 / pass 774 / fail 0. `npx tsc -p tsconfig.ci.json` EXIT=0.

### 7. self-verify reports ok:true with the agent checks intact
expected: `node cadence-core/bin/self-verify.mjs` reports ok:true with agent-skills still in its checked list; all 13 agent files have weight-budgets.json entries (no unbudgeted-surface); no rung file's contract skill sets disable-model-invocation: true.
criterion: AC7
status: pass
first_pass: pass
source: verifier
evidence: `node cadence-core/bin/self-verify.mjs` -> {"ok":true,"checked":"config-keys, invocations, paths, internals-paths, budgets, tools, agent-skills, agent-behaviour, rung-agents","problems":[]}. All 13 agents/*.md have budget entries; all 13 name an existing skills/cad-*-contract; `grep -rn disable-model-invocation skills/` returns nothing, with self-verify.mjs:507 the check that would catch it.

### 8. Weight-budget manifest is exact, not a stale ceiling
expected: Every weight-budgets.json entry equals its file's actual byte size. SUMMARY records one grounded mismatch: cadence-core/workflows/plan.md budgeted at 13874 against an actual 13872, leaving 2 bytes of unaudited growth pre-approved under the ceiling check.
origin: verifier
status: pass
first_pass: fail
source: verifier
evidence: Script over all 63 entries: exactly 1 mismatch. cadence-core/bin/weight-budgets.json entry `cadence-core/workflows/plan.md` = 13874; stat on that file = 13872 (delta -2). The other 62 entries, including all 13 under agents/, are exact.
reported: The manifest's regenerate-on-growth convention is that a budget equals the file's exact current bytes; one entry sits 2 bytes above actual, and the check is a ceiling (bytes > budget), so CI stays green while 2 bytes of unaudited growth are pre-approved.
severity: minor
cause: Nothing asserts a budget EQUALS its file's bytes - the check is bytes > budget, so an entry left too high after a shrink is invisible to it. Task 5 predicted plan.md would grow past 13874, the edit shrank it to 13872, and the plan's 'only if it pushes it over' clause left the entry unregenerated.
fix: 994761d, retest

### 9. No live doc names a rung file the ladder cannot produce
expected: DESIGN.md:134's "Effort-variant files (planner-high/planner-low etc.)" is resolved. Neither planner-high nor planner-low is a name the declared ladder can produce, and AC3's case-sensitive grep misses the capitalized spelling.
origin: verifier
status: pass
first_pass: fail
source: verifier
evidence: DESIGN.md:134-135 reads "Effort-variant files (`planner-high`/`planner-low` etc., §6) add ~4-8 files but are variants of kept roles, not new agents." cad-planner's declared rungs are [high, xhigh] with base high at the unsuffixed file, so neither name is producible. Contrast DESIGN.md:369, which WAS correctly rewritten as a dated SUPERSEDED bullet.
reported: A live doc line still names the retired mechanism and two agent filenames the declared ladder cannot produce; the phase's own AC3 grep cannot see it because it is case-sensitive.
severity: minor
cause: DESIGN.md:134-135 predates the ladder and was not in D-12's file list; the sweep that would have caught it, AC3's grep, is case-sensitive and 'Effort-variant' is capitalized.
fix: 1e770f5, retest

### 10. A malformed route-table role does not collapse self-verify
expected: A null (or otherwise malformed) role entry in route-table.json makes self-verify report that as a problem, rather than throwing at self-verify.mjs:580's unguarded spec.base_effort deref and collapsing run() into {ok:false, reason:internal} with every problem found so far discarded.
origin: verifier
status: pass
first_pass: fail
source: verifier
evidence: self-verify.mjs:580 dereferences spec.base_effort with no null guard. With `"cad-bogus": null` added to roles, `node cadence-core/bin/self-verify.mjs` prints {"ok":false,"reason":"internal","detail":"Cannot read properties of null (reading 'base_effort')"} and discards every problem found by checks 1-7 - the #49.1 collapse the comment says it prevents. A null entry for a role whose base file EXISTS does not throw, and a scalar entry does not either; the collapse needs a null spec plus an absent base file.
reported: Unwired guard. The block's own comment at self-verify.mjs:549-557 claims it is guarded "the way the budget manifest's are: a malformed table is ONE problem and the run continues", but the guard covers only the file read and the JSON.parse, not a null role spec.
severity: major
cause: self-verify.mjs:580 dereferences spec.base_effort with no null guard. The surrounding guard covers the file read and the JSON.parse only, so a null role spec escapes it and unwinds run().
fix: aab0c1a, retest

### 11. A downward escalate_to is caught, not reported ok:true
expected: An escalate_to that names a rung BELOW its role's base_effort in rung_order is reported by self-verify. Today route.mjs:124 accepts any escalate_to and rungIssues only tests membership in rungs, never direction, so a data-only edit can make a failure retry resolve DOWN the ladder while still reporting escalated: true.
origin: verifier
status: pass
first_pass: fail
source: verifier
evidence: lib/rung-agent.mjs rungIssues tests only rungs.includes(...) and rungOrder.includes(...), never index order; route.mjs:124 (`const target = role.escalate_to`) accepts any value. Reproduced: cad-reviewer.escalate_to = "medium" -> self-verify ok:true, problems:[]; `route.mjs resolve --role cad-reviewer --attempt 2` -> agent cad-reviewer-medium, effort medium, escalated true, reason `rung high->medium (cad-reviewer-medium)`. The profile arm still enforces direction at route.mjs:71-82, so the invariant is held on one arm and dropped on the other.
reported: Missing check. Nothing compares escalate_to against base_effort in rung_order order, so a data-only edit makes a failure retry re-dispatch at LOWER effort while route.mjs reports escalated: true.
severity: major
cause: rungIssues validates rung MEMBERSHIP (rungs.includes, rungOrder.includes) and never ORDER, and route.mjs:124 takes escalate_to as given. The profile arm still enforces direction at route.mjs:71-82, so the invariant is held on one arm and dropped on the other.
fix: 844eac0, retest

### 12. Check 7's enforcement matches what the docs claim it enforces
expected: INTERNALS.md:11 ("refuses a rung file that carries any instruction of its own") and DESIGN.md:378 are true of check 7 as built, or narrowed to match it. Check 7 matches only the seven literal section tags, so a rung file whose whole body is plain-prose behaviour passes CI.
origin: verifier
status: pass
first_pass: fail
reported: recommendation accepted: widen check 7 rather than narrow the docs
severity: major
cause: check 7 is a denylist of seven contract section tags, so a rung file whose body is plain-prose behaviour passes CI; D-04's own rejection of a size-only check (a 200-byte behavioural instruction fits under any budget) applies verbatim to the denylist it chose instead. INTERNALS.md:11 and DESIGN.md:378 claim the stronger guarantee.
fix: 1e6724f, retest

### 13. undeclared-rung-agent names the real fault
expected: For a file suffixed with its role's BASE rung (e.g. agents/cad-planner-high.md when high is cad-planner's base), the reported detail points at the D-01 duplication rather than claiming "cad-planner does not declare rung high" when the table does declare it at the unsuffixed filename.
origin: verifier
status: pass
first_pass: fail
source: verifier
evidence: self-verify.mjs:604-606 emits `${role} does not declare rung ${rung}` from bare absence in the routable-name set. With agents/cad-planner-high.md present, the detail reads "cad-planner does not declare rung high" while route-table.json declares cad-planner rungs [high, xhigh], base_effort high. The actual fault is D-01: high is the base rung and lives at the unsuffixed agents/cad-planner.md.
reported: The reported detail contradicts the table for a file suffixed with its role's own base rung, pointing a maintainer at the wrong file to edit.
severity: minor
cause: self-verify.mjs:604-606 builds the detail from bare absence in the routable-name set, with no branch on rung === spec.base_effort - so a base rung duplicated at a suffixed filename is reported as an undeclared rung.
fix: 6ffcb9b, retest

### 14. LINEAGE.md agent figures and vocabulary: decided
expected: LINEAGE.md:14 (| Agents | 34 | 7 | 21% |), :35 ("Cadence's 7 agents") and :43 (retired vocabulary) are either updated to the 13-file reality or explicitly kept as a dated provenance record like CHANGELOG.md:43 - a deliberate decision either way, not drift.
origin: verifier
status: pass
first_pass: fail
evidence: LINEAGE.md:11 header now reads | Surface | GSD (d010ea1) | Cadence (2026-07-10) | Retained |; :17 References = 7, matching the 7 cadence-core/references/*.md in tree 1f94fbe; :35 reads 'Cadence's 6 agent roles, materialized as 13 rung files' with no 'Cadence's 7 agents' remaining anywhere in the file; README.md:111 scopes 'measured 2026-07-10' to the 3% mass claim and states today's shape separately. self-verify.mjs = ok:true, problems:[].
reported: fix 43
severity: minor
cause: LINEAGE's table is a reproducible 2026-07-10 snapshot, not drift: rebuilding 1f94fbe reproduces agents 7, skills 22, workflows 16, .mjs 3, and 33,727 words against the recorded 33,621. Three real defects remain: References 8 does not reproduce (tree has 7); :35 states 'Cadence's 7 agents' in present tense with no date framing; and README:111 folds today's shape (23 skills, 6 roles, 13 rung files) into a sentence stamped 'measured 2026-07-10', a date at which none of those three numbers held.
fix: 37ea261, retest

## Summary

total: 14
passed: 14
failed: 0
pending: 0
skipped: 0
blocked: 0
reworked: 7
