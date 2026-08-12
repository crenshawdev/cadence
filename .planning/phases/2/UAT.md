---
status: testing
phase: 2
fields_version: 1
started: 2026-08-12
updated: 2026-08-12
---

## Items

### 1. /cad-adopt initializes .planning/ on a brownfield repo
expected: Run /cad-adopt in a git repo with no .planning/ (e.g. /code/axel): it writes PROJECT.md, REQUIREMENTS.md, ROADMAP.md, STATE.md and config.json, and /cad-health on that directory reports zero problems. (human-verify: needs a walked /cad-adopt run on a brownfield repo)
criterion: AC1
status: pending

### 2. Adopted .planning/ carries remaining work only
expected: In that adopted .planning/: ROADMAP.md's ## Phases list has no - [x] entry, REQUIREMENTS.md's ## Traceability table has headers and zero rows, the ### Active version does not appear in `git tag --list`, and the STATE cursor names phase 1. (human-verify: needs the same walked /cad-adopt run)
criterion: AC2
status: pending

### 3. Adopt asks only what the repo cannot answer
expected: Walked on a repo whose README and manifest already state its goal, stack and build commands, adopt asks about none of those three, and every question it does ask names something absent from the repo. (human-verify: needs a walked /cad-adopt run)
criterion: AC3
status: pending

### 4. Brief fixture test passes
expected: node --test over cadence-core/bin/design-brief.test.mjs passes against the committed cadence-core/bin/fixtures/ copy of verbatim's DESIGN-BRIEF.md, asserting its ## 17. Open items rows.
criterion: AC4
status: pass
first_pass: pass
source: verifier
evidence: `node --test cadence-core/bin/design-brief.test.mjs` -> tests 5, pass 5, fail 0, asserting the `## 17. Open items` heading, exactly five data rows, their identities, prose statuses and the two-`OPEN` count. Fixture cadence-core/bin/fixtures/verbatim.design-brief.md is byte-identical (`cmp` silent) to /data/code/verbatim/DESIGN-BRIEF.md at 29447 B.

### 5. --brief stops re-asking what the brief settles
expected: /cad-new-project --brief walked against that brief does not re-ask the problem, the users, the non-goals, the stack or the constraints, and every question it asks traces to an open item in the brief. (human-verify: needs a walked /cad-new-project --brief run)
criterion: AC5
status: pending

### 6. Discovery docs page linked from README
expected: A docs/ page states the freeform-conversation -> design-brief -> --brief sequence and what a good brief answers, and README.md's getting-started path links to it by path.
criterion: AC6
status: pass
first_pass: pass
source: verifier
evidence: docs/DISCOVERY.md:13-20 (conversation -> brief -> `--brief` sequence), :25-44 (what a good brief answers), :46-59 (guidance not a form - no template, schema or parsing seam); README.md:74 links `docs/DISCOVERY.md` by path inside `## The loop` (README.md:62-81).

### 7. Self-verify green and /cad-adopt registered everywhere
expected: node cadence-core/bin/self-verify.mjs is green with no unbudgeted-surface and no budget-overrun; /cad-adopt appears in cadence-core/references/COMMANDS.md, skills/cad-help/SKILL.md and README.md; and the five D-15 surfaces also name /cad-adopt.
criterion: AC7
status: pass
first_pass: pass
source: verifier
evidence: self-verify.mjs -> ok:true, problems:[] (no unbudgeted-surface, no budget-overrun); weight-budgets.json:53,75 carry both new surfaces; /cad-adopt at COMMANDS.md:13, README.md:72,121, and all five D-15 sites (progress.md:40, cad-health/SKILL.md:25, context.md:40, config.md:13, git-guard.md:42). cad-help names no command literally - it `@`-includes COMMANDS.md at skills/cad-help/SKILL.md:15, so the new row is what it renders.

### 8. Adopt refuses a subdirectory of a git repo
expected: Running /cad-adopt from a subdirectory of a git repo refuses rather than answering from the parent repo's log and tags while writing .planning/ into the subdirectory.
status: pending

### 9. Run /cad-adopt in a brownfield git repo with no .planning/ (PLAN-1 names /code/axel as the cheapest target), then run /cad-health there
expected: .planning/ holds PROJECT.md, REQUIREMENTS.md, ROADMAP.md, STATE.md and config.json, and /cad-health reports zero problems
origin: verifier
why_human: Out of reach rather than unexercised: the run mutates a real repo outside this working tree (creates files, appends a .gitignore line and makes a `docs:` commit) and passes through the AskUserQuestion approval gate, and the contract forbids mutating state. No probe can stand in for it.
status: skipped
reason: duplicate wording of item 1 (AC1); walked and recorded there

### 10. In that same adopted .planning/, check ROADMAP.md's ## Phases for any `- [x]`, REQUIREMENTS.md's ## Traceability row count, whether the ### Active version appears in `git tag --list`, and the STATE cursor's phase
expected: Zero `- [x]` entries, headers with zero Traceability rows, an Active version absent from `git tag --list`, cursor naming phase 1
origin: verifier
why_human: Depends on the artifacts the walk above produces; the rules are stated in adopt.md but nothing computes them, so only inspecting a real adopted directory settles it.
status: skipped
reason: duplicate wording of item 2 (AC2); walked and recorded there

### 11. During that /cad-adopt run, note every question it asks on a repo whose README and manifest already state its goal, stack and build commands
expected: None of the three is re-asked, and every question asked names something absent from the repo
origin: verifier
why_human: Live model behavior against a stated judgment rule (D-05 accepted that AC3 is walked, not CI-checkable); there is no runnable probe of what a coordinator chooses to ask.
status: skipped
reason: duplicate wording of item 3 (AC3); walked and recorded there

### 12. Run /cad-new-project --brief cadence-core/bin/fixtures/verbatim.design-brief.md in a scratch directory and watch the questioning
expected: A read-back of the settled material instead of the opening question, no re-asking of the problem, users, non-goals, stack or constraints, and every question tracing to one of the brief's five open items
origin: verifier
why_human: Out of reach: it initializes a project (writes files and commits) and is live model behavior with no schema or seam to assert against - D-07 deliberately took the no-parser trade, so no CI falsifier exists.
status: skipped
reason: duplicate wording of item 5 (AC5); walked and recorded there

### 13. Run /cad-adopt from a subdirectory of a git repo (e.g. /code/axel/src)
expected: It refuses with "This is a subdirectory of {root}. Run /cad-adopt in {root}." and writes no .planning/ in the subdirectory
origin: verifier
why_human: The gate at adopt.md:21-32 is model-followed prose with no executable enforcement; observing the refusal requires invoking the command, which this pass may not do.
status: skipped
reason: duplicate wording of item 8; walked and recorded there

## Summary

total: 13
passed: 3
failed: 0
pending: 5
skipped: 5
blocked: 0
reworked: 0
