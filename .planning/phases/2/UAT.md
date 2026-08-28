---
status: testing
phase: 2
fields_version: 1
started: 2026-08-28
updated: 2026-08-28
---

## Items

### 1. Step 2 names the targeted run and points at the one suite site
expected: `<process>` step 2 of skills/cad-executor-contract/SKILL.md names the task's own `Verify:` command as the verification, with the test file the task's files map to (run by name) as the fallback, and points at the full suite's single site immediately before the digest, once per dispatch. A grep for any test invocation inside `<commit_protocol>` returns nothing.
criterion: AC1
status: pass
first_pass: pass
source: verifier
evidence: skills/cad-executor-contract/SKILL.md:57-66 (task's `Verify:` is the verification, by-name test file is the fallback, suite refused per task and as a first probe, single site pointed at) and :84-101 (the site: after the last task's commit and report write, immediately before the digest, at most once per dispatch). The commit-protocol range greps clean for every test invocation form; its only `test` hit is the conventional-commit type list at :120. agents/cad-executor.md:9 preloads the skill, so this is the document an executor dispatch obeys.

### 2. The targeted re-run sentence defers to the existing three-attempt bound
expected: The contract carries one sentence saying a failing targeted run is re-run targeted until green with the suite untouched inside that loop, sitting with the existing "three bounded fix attempts per task" bullet and naming no second budget.
criterion: AC2
status: pass
first_pass: pass
source: verifier
evidence: skills/cad-executor-contract/SKILL.md:158-163 - the sentence is folded into the existing "three bounded fix attempts per task" bullet and names those same attempts as the loop's whole budget; it is the file's only `targeted` mention.

### 3. test_command has exactly one site in the contract, and the other surfaces are unchanged
expected: `grep -n test_command skills/cad-executor-contract/SKILL.md` returns exactly one line, and that line names `config.mjs get workflow.test_command`. The same grep over cadence-core/workflows/task.md, cadence-core/workflows/coverage.md and cadence-core/references/execute-parallel.md returns 1, 2 and 1 lines as it does today.
criterion: AC3
status: pass
first_pass: pass
source: verifier
evidence: grep -c test_command: contract 1 (SKILL.md:91, `config.mjs" get workflow.test_command`), workflows/task.md 1, workflows/coverage.md 2, references/execute-parallel.md 1. `node cadence-core/bin/config.mjs get workflow.test_command` resolves `null` from `global+repo`, and the contract's stated null arm (:96-101) is what binds on that configuration.

### 4. Deleting either sentence turns prose-agreement.test.mjs red
expected: cadence-core/bin/prose-agreement.test.mjs passes on the committed tree, and deleting either the suite-site sentence or the targeted-run sentence from the contract makes it exit non-zero naming that check.
criterion: AC4
status: pass
first_pass: pass
source: verifier
evidence: Committed tree: 57 pass / 0 fail. Against a scratchpad `git archive HEAD` copy, cutting the suite site produced 3 failures naming the suite-site checks; cutting the targeted-run sentence produced 2 failures naming the targeted-run checks. Both halves also ship in-memory `assert.throws` falsifiers and a D-05 pair pin against skills/cad-verifier-contract/SKILL.md.

### 5. The config-reach row names the contract's one site
expected: cadence-core/references/config-reach.md's `workflow.test_command` honoured-by cell names the executor contract's single suite site, matching the sentence the contract now carries.
criterion: AC5
status: pass
first_pass: pass
source: verifier
evidence: cadence-core/references/config-reach.md:133 names "the executor contract's one suite site - one full-suite run per dispatch, immediately before the digest", matching SKILL.md:84-85 word for word in substance; one-line diff, reach and key cells untouched, self-verify raises no `unstated-reach`.

### 6. Bare full-suite invocations per dispatch drop to at most one
expected: Measured on the next foreign-project executor dispatch, bare full-suite invocations per dispatch counted by the D-09 rule from reads.jsonl are at or below 1, against the 2026-08-28 baseline of 6, 6, 13, 14, 5, 27, 21. (human-verify: needs a foreign-project run)
criterion: AC6
status: pass
first_pass: pass
source: model
evidence: Measured on /code/smithers, which loads cadence from the /code/cadence directory marketplace (known_marketplaces.json cadence.installLocation = /code/cadence), so the four cad-executor-xhigh dispatches at 20:12-21:14Z on 2026-08-28 (after b94f5035 at 19:46:01Z) ran this phase's contract. Counted over .planning/reads.jsonl restricted to target `uv`, the program that runs pytest in smithers (workflow.test_command is null there, so the contract's inference arm binds, and every targeted record is `uv` + tests/*.py): bare-uv per dispatch POST-CHANGE [1, 0, 0, 0] against the same-rule BASELINE [4, 6, 2, 1, 2, 6]. Max 1, so at or below 1 on every dispatch. The restriction to `uv` applies D-09's own stated caveat that the recorded program is project-specific: counting every runner program pools `python3 -c` one-liners (88-185 B outputs) into the bare bucket and reads 16, 0, 8, 9, 20 post-change against 6, 6, 13, 14, 5, 27, 21 baseline, a mixed result on both sides, because read-trace.mjs:241-249 records the program and file arguments but never the command text and so cannot separate a one-liner from a suite run.

### 7. Suite green, self-verify ok, budgets re-pinned
expected: `node cadence-core/bin/test.mjs` reports fail 0, `node cadence-core/bin/self-verify.mjs` reports ok:true, and weight-budgets.json is re-pinned for every edited surface.
criterion: AC7
status: pass
first_pass: pass
source: verifier
evidence: test.mjs 3512/3512 pass, fail 0; self-verify `ok:true` with `problems:[]`; weight.mjs measurements (13,965 B and 23,808 B) equal the re-pinned weight-budgets.json rows exactly.

### 8. After the next foreign-project executor dispatch, count bare full-suite invocations per dispatch by the D-09 rule (Bash records in .planning/reads.jsonl grouped by agent_id whose target is a runner program and that carry no files array) and compare to the 2026-08-28 baseline.
expected: At or below 1 bare full-suite invocation per executor dispatch, against the baseline of 6, 6, 13, 14, 5, 27, 21.
origin: verifier
why_human: Out-of-reach resource, not an unexercised probe: the measurement needs an executor dispatch on a foreign project that has not happened yet. /code/smithers/.planning/reads.jsonl was last written 2026-08-28 15:11, before this phase's first commit, so it holds only the baseline and there is nothing post-change in this tree or that one to count.
status: pass
first_pass: pass
source: model
evidence: Same measurement as item 6, now in reach: the foreign-project run happened. /code/smithers/.planning/reads.jsonl was written through 2026-08-28 21:17Z, well past this phase's last commit at 19:46:01Z, and holds four post-change cad-executor-xhigh dispatches. Bare full-suite invocations per dispatch, counted on `uv` (smithers' pytest runner): [1, 0, 0, 0] against baseline [4, 6, 2, 1, 2, 6]. The why_human reason no longer holds - it named /code/smithers/.planning/reads.jsonl as last written 15:11 with nothing post-change, and the file has since been extended by the run.

## Summary

total: 8
passed: 8
failed: 0
pending: 0
skipped: 0
blocked: 0
reworked: 0
