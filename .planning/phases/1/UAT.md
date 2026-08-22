---
status: testing
phase: 1
fields_version: 1
started: 2026-08-22
updated: 2026-08-22
---

## Items

### 1. renumber's #49.2 partial-apply envelope is unchanged
expected: `node --test cadence-core/bin/planning.test.mjs` passes with planning.test.mjs unmodified: renumber against the 0o555 .planning root returns reason:"partial-apply", completed deep-equal to [{rm:'phases/1'},{git_mv:[...]},{git_mv:[...]}], failed deep-equal to {edit:'ROADMAP.md'}, and the doesNotMatch(/by hand,\s*then re-run/) assertion at :4172-4185 still holds.
criterion: AC1
status: pass
first_pass: pass
source: verifier
evidence: planning.test.mjs 452/452 pass with the file unmodified across 61460139^..HEAD; the #49.2 case passes by name with completed deep-equal to the three op objects, failed deep-equal to {edit:'ROADMAP.md'}, and the doesNotMatch(/by hand,\s*then re-run/) assertion at :4183 holding. Op objects reach the envelope by identity via planning.mjs:6023-6028.

### 2. partial-prune's envelope and three-line hint are unchanged
expected: `node --test cadence-core/bin/milestone-prune.test.mjs` passes with milestone-prune.test.mjs unmodified: a partial-prune run returns the same reason, action, failed array, residue_rows, warnings and three-line hint it returned before the refactor (:769-795 and :1049-1075 green).
criterion: AC2
status: pass
first_pass: pass
source: verifier
evidence: milestone-prune.test.mjs 46 tests / 45 pass / 1 expected skip / 0 fail with the file unmodified; :769-795 and :1049-1075 both green. The phase diff of planning.mjs stops at :6504 - the envelope, the partial-prune emit and all three hint lines are byte-untouched, and warning order is preserved by appending the failure warnings immediately after the runTransition call.

### 3. A pre-flight refusal names the condition and writes nothing
expected: A case in cadence-core/bin/file-transition.test.mjs drives runTransition with one pre-checkable condition failing and asserts BOTH that the result is a refusal naming that condition AND that every file in the planned write set is byte-identical on disk afterwards. The test run is green.
criterion: AC3
status: pass
first_pass: pass
source: verifier
evidence: file-transition.test.mjs:149-179 asserts refused==='the archive root is writable', no thunk entered, the third condition never evaluated, and all three planned-write files byte-identical to their pre-call contents. Green in the 12/12 run.

### 4. A refusal creates no new file under .planning/
expected: A case in cadence-core/bin/file-transition.test.mjs takes a full recursive listing of .planning/ before and after a primitive refusal and asserts they are equal - no new file anywhere. The test run is green.
criterion: AC4
status: pass
first_pass: pass
source: verifier
evidence: file-transition.test.mjs:181-195 deep-equals a full recursive sorted listing of the fixture '.planning' root taken before and after a refusal. Green in the 12/12 run; the module performs no fs call on any path.

### 5. The census makes 'one, not four' mechanical
expected: `node cadence-core/bin/helper-census.test.mjs` passes with a HELPERS row for the transition primitive present, AND fails (non-zero exit, naming both copies) when the primitive's body is pasted back under a different name anywhere in cadence-core/bin/**/*.mjs.
criterion: AC5
status: pass
first_pass: pass
source: verifier
evidence: helper-census.test.mjs 10/10 pass with the ninth row at :186-211 keyed on the body idiom; an isolated copy of the bin tree with lib/census-probe.mjs added fails 1 case naming both 'lib/census-probe.mjs (x1)' and 'lib/file-transition.mjs (x1)'. The repo tree was not mutated.

### 6. self-verify is clean
expected: `node cadence-core/bin/self-verify.mjs --root .` returns ok:true with an empty problems array.
criterion: AC6
status: pass
first_pass: pass
source: verifier
evidence: `node cadence-core/bin/self-verify.mjs --root .` returns ok:true with problems: []. Full bin suite 2638 tests / 0 fail; tsc -p tsconfig.ci.json exits 0.

### 7. Neither operation's hint text is pinned by a test that reddens on a paraphrase (ROADMAP phase 1 SC2)
expected: behavior wrong - the envelope IS unchanged today (verified byte-exact against the pre-phase tree), but the durable guard SC2 names does not exist, so the refactored call sites carry no regression protection on the one field the roadmap singled out
origin: verifier
status: pass
first_pass: fail
source: model
evidence: Fixed in 62ed8f2d, then retested at that tip. Three byte-exact `assert.equal(r.hint, ...)` assertions added: planning.test.mjs #49.2 partial arm, planning.test.mjs nothing-written arm, milestone-prune.test.mjs ':769-795' partial-prune (all three lines, interpolating join(dir,'phases')). `node --test cadence-core/bin/planning.test.mjs` -> 452 tests / 452 pass / 0 fail. `node --test cadence-core/bin/milestone-prune.test.mjs` -> 46 tests / 45 pass / 1 expected skip / 0 fail. `node cadence-core/bin/self-verify.mjs --root .` -> ok:true, problems: []. FALSIFIED before landing, which is what SC2 actually asks: paraphrasing 'reconcile the completed ops' -> 'reconcile the finished ops' and 'so a re-run only picks up the rest' -> 'so a re-run just picks up the rest' in planning.mjs preserves every keyword the pre-existing assertions check (/destroy/, /nothing was written/, both doesNotMatch stay clean) and now reddens exactly one case in EACH suite (451/1 and 44/1); planning.mjs was restored from backup and `git diff --stat -- cadence-core/bin/planning.mjs` is empty. Coverage confirmed by grep -rlF: each hint sentence now lives in planning.mjs AND its guarding test file, where before the phase it lived in planning.mjs alone.
reported: behavior wrong - the envelope IS unchanged today (verified byte-exact against the pre-phase tree), but the durable guard SC2 names does not exist, so the refactored call sites carry no regression protection on the one field the roadmap singled out
severity: minor
cause: Plan-level, not code-level: SC2's second clause ('...and their hint text, pinned by a test that reddens on a paraphrase') was never carried into an acceptance criterion. CONTEXT's AC1/AC2 encode only SC2's first clause (envelope unchanged) and additionally require planning.test.mjs and milestone-prune.test.mjs to pass UNMODIFIED - which forbids adding the assertion in the only two files owning these commands' CLI-level fixtures. PLAN.md task 3 saw the collision and substituted two execution-time `grep -c -F` invocations, a one-shot check that never runs again. Verified directly: `grep -rlF` on both hint sentences returns cadence-core/bin/planning.mjs alone (plus UAT.md); planning.test.mjs:4183-4184 and :4205-4206 guard renumber's two arms by keyword regex only (/destroy/, /nothing was written/ plus two doesNotMatch), all of which a paraphrase satisfies; `grep -c hint cadence-core/bin/milestone-prune.test.mjs` returns 0, so the three-line partial-prune hint at planning.mjs:6546-6548 is entirely unpinned. The refactor is correct and the envelope is byte-exact today - what is absent is the durable regression guard, so a later paraphrase of either hint ships silently.
fix: 62ed8f2d, retest

## Summary

total: 7
passed: 7
failed: 0
pending: 0
skipped: 0
blocked: 0
reworked: 1
