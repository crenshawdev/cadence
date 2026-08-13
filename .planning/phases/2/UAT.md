---
status: testing
phase: 2
fields_version: 1
started: 2026-08-12
updated: 2026-08-13
---

## Items

### 1. /cad-adopt initializes .planning/ on a brownfield repo
expected: Run /cad-adopt in a git repo with no .planning/ (e.g. /code/axel): it writes PROJECT.md, REQUIREMENTS.md, ROADMAP.md, STATE.md and config.json, and /cad-health on that directory reports zero problems. (human-verify: needs a walked /cad-adopt run on a brownfield repo)
criterion: AC1
status: pass
first_pass: pass
source: model
evidence: Walked /cad-adopt in /data/code/axel (git repo, no .planning/). All five files written and committed as f373cd2 "docs: adopt existing project into Cadence": PROJECT.md 8963 B, REQUIREMENTS.md 4854 B, ROADMAP.md 6806 B, STATE.md 117 B, config.json 1319 B. /cad-health checks run against it one by one, all clean: (1) presence OK x4 and `trace ignore --root . --check` -> ignored:true, tracked:false (silent arm); (2) STATE cursor parses to the 4-line schema, status "ready to plan" is a lifecycle value; (3) ROADMAP ## Phases numbered 1..6, no gaps or dupes; (4) Traceability table parses with zero rows, no bad Status; (5) `planning.mjs status` -> cursor 1 of 6 matching the 6 phases, agrees:true, no phases/ dirs; (6) parallelization.enabled true with use_worktrees true and `worktree-base.mjs resolve` -> parallelSafe:true, reviewers ["claude-subagent"] needs no credential, so nothing inert; (7) Active v0.1.0 against an empty `git tag --list` -> no drift. Zero problems.

### 2. Adopted .planning/ carries remaining work only
expected: In that adopted .planning/: ROADMAP.md's ## Phases list has no - [x] entry, REQUIREMENTS.md's ## Traceability table has headers and zero rows, the ### Active version does not appear in `git tag --list`, and the STATE cursor names phase 1. (human-verify: needs the same walked /cad-adopt run)
criterion: AC2
status: pass
first_pass: pass
source: model
evidence: Same adopted /data/code/axel/.planning/, four sub-checks: (a) `grep -c "^- \[x\]" .planning/ROADMAP.md` -> 0; all six ## Phases entries are `- [ ]` (Machine-Independent Defaults, CI On Push, Vendored Integration Surface, One-Command Install, Release Artifacts, Cut v0.1.0) - all REMAINING work, D-04 held. (b) ## Traceability is the bare header row plus separator, zero data rows, matching D-10 (seed-reqs seeds them at /cad-plan). (c) PROJECT.md:35 ### Active names "Milestone v0.1.0"; `git tag --list` is empty, so the Active version appears in no tag - health rule 7 clean. (d) STATE.md reads "Phase: 1 of 6 (Machine-Independent Defaults)" and `planning.mjs status` parses cursor.phase 1, agrees:true. Note: the earlier plan-mode survey proposed v0.2.0 to dodge the Cargo.toml 0.1.0 collision; the live run wrote v0.1.0, which is still clean because rule 7 keys on tags and there are none.

### 3. Adopt asks only what the repo cannot answer
expected: Walked on a repo whose README and manifest already state its goal, stack and build commands, adopt asks about none of those three, and every question it does ask names something absent from the repo. (human-verify: needs a walked /cad-adopt run)
criterion: AC3
status: pass
first_pass: pass
source: model
evidence: Walked against /data/code/axel (README.md + ARCHITECTURE.md + Cargo.toml present, 74 commits). Adopt derived rather than asked all three forbidden topics: goal ("one .r8 SQLite file as an agent's whole brain"), stack ("Rust workspace, 3 crates, ~14.7k lines, clap CLI with 15 subcommands"), build/test ("144 tests, no CI"). It asked exactly two questions plus one confirmation, each naming something absent from the repo: (1) ownership/upstream intent - every commit authored by a different person and origin is a third-party GitHub remote, which no file states; (2) the next milestone - explicitly citing that the consolidation roadmap was moved OUT of the repo in commit 1e5dd7d, so nothing on disk names it; (3) the D-12 ### Active version confirmation, proposing v0.2.0 over the Cargo.toml 0.1.0 rather than reusing a current version. It also re-checked REVIEW.md against HEAD instead of trusting it. Run captured at tasks/by9k4s3is.output.

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
status: pass
first_pass: pass
source: model
evidence: Walked in /tmp/brieftest; questions recovered verbatim from the run transcript (~/.claude/projects/-tmp-brieftest/a7b7c1cf-*.jsonl), 2 AskUserQuestion calls carrying 7 questions total. NOT re-asked, all five: the problem, the users, the non-goals, the stack, the constraints - zero questions touch any of them. Every question traces to something the brief leaves open: (1) "first genuinely usable slice" -> brief:510 commits to "0.0.1 onward, agile increments" and names no first slice; (2) crates.io -> brief:515 states the unresolved fork verbatim ("Publish as verbatim-cli ... or skip crates.io"), and the two options mirror its two arms; (3) where the credentials library lives -> brief:343 says it "needs its own small library" but never says where; (4) /data/verbatim-legacy import -> ## 17 row 3 "Deferred"; (6) what done looks like personally -> the gap D-08 identified by measurement as one of the two background items this brief leaves open; (7) Windows UserPromptSubmit spawn cost -> ## 17 row 2 "Measure". The one exception is (5) v1 scope, which is a follow-up to the user ANSWER to (3) rather than to the brief - adaptive questioning off a live answer, not a re-ask of settled material.

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
status: pass
first_pass: pass
source: model
evidence: Scratch repo test: from the repo root, `git rev-parse --show-toplevel` == cwd; from `sub/`, cwd=.../gate/sub while toplevel=.../gate, so the gate at adopt.md:21-32 fires and directs the stop "This is a subdirectory of {root}. Run /cad-adopt in {root}." with nothing written (find -name .planning returned nothing). The banned substitution is confirmed banned for cause: `git rev-parse --git-dir` succeeded from sub/ (returned .../gate/.git), which is exactly the false-accept adopt.md:26-32 describes. Residual: the stop itself is model-followed prose, not executable enforcement, so this proves the discriminator and the instruction, not a live coordinator obeying it.

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
passed: 8
failed: 0
pending: 0
skipped: 5
blocked: 0
reworked: 0
