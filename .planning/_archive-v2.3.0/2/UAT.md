---
status: testing
phase: 2
fields_version: 1
started: 2026-08-05
updated: 2026-08-05
---

## Items

### 1. The git rail split is complete and nothing still points at the old file
expected: cadence-core/references/git.md is gone; git-guard.md and git-publish.md exist; the citation sweep over cadence-core/, skills/, agents/, INTERNALS.md and METHOD.md returns nothing for both the prefixed and the bare form; every surviving "rail N" citation names the file that now holds that rail; self-verify exits 0.
criterion: AC1
status: pass
first_pass: pass
source: verifier
evidence: cadence-core/references/git.md absent; git-guard.md 6,166 B (rails 1,2,4) and git-publish.md 4,611 B (rail 3 + auto_close); grep -rn "references/git.md" over cadence-core/ skills/ agents/ INTERNALS.md METHOD.md exits 1; surviving rail citations name their holder (INTERNALS.md:37, METHOD.md:523, lib/git-segments.mjs:61, git-guard.mjs:141, task.md:48, undo.md:28); self-verify.mjs exits 0

### 2. The eager include map, and cad-land reading the publish rails where it publishes
expected: cad-phase, cad-pause, cad-undo and cad-milestone each @-include references/git-guard.md and no other reference; cad-pause includes no conventions.md; cad-land @-includes git-guard.md but NOT git-publish.md, and reads git-publish.md at each step that acts on the publish rails (both the manual arm and the auto_close arm).
criterion: AC2
status: pass
first_pass: pass
source: verifier
evidence: cad-phase/SKILL.md:24, cad-undo/SKILL.md:24, cad-milestone/SKILL.md:27, cad-pause/SKILL.md:21 each @-include git-guard.md and no other reference; cad-land/SKILL.md:20-21 has review-triggers.md + git-guard.md, no git-publish.md; arm 4a reads it at cad-land/SKILL.md:84-92 (gated on a publishing answer), arm 4b at :105-113 explicitly covering GitLab's glab mr create. AC2 names land.md, which has never existed - SKILL.md is the only site the criterion could mean and the intent is met there (fix 19e6eba)

### 3. The triage gate is its own reference and the five citation sites read it
expected: cadence-core/references/triage-gate.md exists; the five sites in execute.md, plan.md and verify.md name it and instruct no read of review-triggers.md; review-triggers.md section 6 is a pointer rather than the gate itself.
criterion: AC3
status: pass
first_pass: pass
source: verifier
evidence: cadence-core/references/triage-gate.md 2,830 B holds all three arms + caps + contradiction rule + carve-out + the cad-verify rule; execute.md:169, execute.md:236, execute.md:248, plan.md:231, verify.md:198 each RE-READ it and none instructs a read of review-triggers.md; review-triggers.md:172-178 is a pointer only

### 4. The adjudicated arm is a tapped multi-select with a scoped carve-out
expected: The extracted arm specifies AskUserQuestion with multiSelect: true and NONE first and default; no open-ended-prose mandate remains anywhere in cadence-core/; seams.md's ask-user binding no longer limits the tool to 2-4 mutually exclusive options; the git.auto_close carve-out reads as scoped to pre_ship inside cad-land, with land-cleanup.mjs and land-cleanup.test.mjs naming the file and line that now hold it. NOTE: the criterion says batched ceil(N/4); the phase shipped ceil(N/3) deliberately - see the deviation in the walk.
criterion: AC4
status: pass
first_pass: pass
source: verifier
evidence: triage-gate.md:12-19 (AskUserQuestion, multiSelect: true, END THE TURN, NONE first and default), :21-26 the two caps, :28-32 the contradiction re-ask, :34-41 the carve-out scoped to pre_ship inside /cad-land; seams.md:12-17 binding rewritten to two caps; land-cleanup.mjs:100 and land-cleanup.test.mjs:140 both cite references/triage-gate.md:34; no open-ended-prose mandate survives. AC4's literal ceil(N/4) is what was WRONG: NONE occupies one of the four option slots, so only three survivors fit per question - shipped ceil(N/3) is correct, and four remains the questions-per-call cap

### 5. No conventions.md phantom remains in any workflow
expected: grep -n "conventions.md" over cadence-core/workflows/*.md returns nothing, and each of the three cited rules (Parallel work, batch-asks, lazy-create) reads in full at every one of its 17 former citation sites.
criterion: AC5
status: pass
first_pass: pass
source: verifier
evidence: grep -n "conventions.md" cadence-core/workflows/*.md exits 1; 13 + 4 = 17 sites converted across 0f2824c and bb1bc24; spot-checks coverage.md:22-26, debug.md, progress.md, new-project.md and cad-pause/SKILL.md all carry both operative clauses

### 6. The /cad-config catalog decision is on the record
expected: The decision is recorded with both the run-count measurement and the byte arithmetic, and config.md's catalog section states whether the catalog is derived or transcribed with no ambiguity left.
criterion: AC6
status: pass
first_pass: pass
source: verifier
evidence: CONTEXT.md D-09 carries both grounds (n=5 runs, none non-menu, vs cad-verify 46 / cad-plan 44; 20,769 B derived output vs 6,827 B table with no per-value field) and D-18 the every-branch cost; workflows/config.md:67-70 states 'deliberately transcribed, NOT derived from config.mjs keys'

### 7. The break-even rule covers a deferred read, and the gates are green
expected: seams.md's break-even rule covers any deferred read (not only a subagent round-trip); every eager-include keep-or-move call is stated with its reason; node --test cadence-core/bin/*.test.mjs and node cadence-core/bin/self-verify.mjs both pass, with weight-budgets.json regenerated in the commits that touched budgeted surfaces.
criterion: AC7
status: pass
first_pass: pass
source: verifier
evidence: seams.md:220-231 extends the two-clause test to any deferred read plus the eager-include corollary and the 'folds into' qualifier; node --test cadence-core/bin/*.test.mjs 1151 pass / 0 fail; self-verify.mjs exits 0 with budgets among its checks. Measured turn-one drop vs D-19 baseline: cad-pause 18,523 to 8,253 B, cad-milestone 20,855 to 15,778, cad-land 36,235 to 31,075, cad-phase 15,941 to 10,825, cad-undo 15,633 to 10,481

## Summary

total: 7
passed: 7
failed: 0
pending: 0
skipped: 0
blocked: 0
reworked: 0
