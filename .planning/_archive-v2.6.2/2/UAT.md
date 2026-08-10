---
status: testing
phase: 2
fields_version: 1
started: 2026-08-10
updated: 2026-08-10
---

## Items

### 1. Dead templates/UAT.md include deleted, template kept, waiver register empty
expected: Steps: 1) cd /data/code/cadence 2) `grep -c 'templates/UAT.md' skills/cad-verify/SKILL.md` prints `0` 3) `test -f cadence-core/templates/UAT.md` succeeds and `node -e 'console.log(require("./cadence-core/bin/weight-budgets.json").budgets["cadence-core/templates/UAT.md"])'` prints `5792` 4) in a scratch worktree at commit 75f4aac, `node cadence-core/bin/weight.mjs resident --root <wt>` reports /cad-verify eagerBytes `18688` 5) `node --input-type=module -e 'const m=await import("/data/code/cadence/cadence-core/bin/lib/include-consumers.mjs");console.log(m.WAIVED.length)'` prints `0` 6) `node --test cadence-core/bin/include-consumers.test.mjs cadence-core/bin/self-verify.test.mjs` prints `fail 0`, with both files asserting WAIVED length 0.
criterion: AC1
status: pass
first_pass: pass
source: verifier
evidence: grep -c 'templates/UAT.md' skills/cad-verify/SKILL.md -> 0; template on disk with budget row 5792 unchanged across the range; scratch worktree at 75f4aac reports /cad-verify eagerBytes 18688 (SKILL.md 1102 -> 1049); WAIVED.length -> 0 and frozen, asserted at include-consumers.test.mjs:203-209 and self-verify.test.mjs:1930; node --test on both files -> fail 0.

### 2. self-verify clean at EVERY commit the phase created, not only the last
expected: Steps: 1) cd /data/code/cadence 2) for each of the nine commits 75f4aac b5a4143 064f49e a5ec70b f914dbe 0e9d24e 9ab56dd 49ba72e 366771b, check it out into a scratch worktree 3) run `node cadence-core/bin/self-verify.mjs` in each 4) all nine print `"ok":true` with `"problems":[]` - no commit carries a weight-budgets.json row that lags its own cut.
criterion: AC2
status: pass
first_pass: pass
source: verifier
evidence: All nine commits checked out detached in a scratch worktree: 75f4aac b5a4143 064f49e a5ec70b f914dbe 0e9d24e 9ab56dd 49ba72e 366771b each return ok=true problems=[]; HEAD 26638e8 likewise. No commit carries a lagging weight-budgets.json row. Worktree removed.

### 3. Full test suite passes at EVERY commit the phase created
expected: Steps: 1) cd /data/code/cadence 2) for each of the same nine commits in a scratch worktree 3) run `node --test cadence-core/bin/*.test.mjs` 4) all nine report `fail 0` 5) `cadence-core/bin/prose-agreement.test.mjs` is among the files run at each, so the docs/EVIDENCE.md tables updated in those commits were asserted at the commit that changed them.
criterion: AC3
status: pass
first_pass: pass
source: verifier
evidence: node --test cadence-core/bin/*.test.mjs in the same nine worktree checkouts: tests 1516 / pass 1516 / fail 0 at every commit, and 1516/1516 at HEAD. prose-agreement.test.mjs is present at each commit and inside the glob, so each commit's own docs/EVIDENCE.md re-pin was asserted where it landed.

### 4. --tokens provenance stated in full exactly once, in lib/trace.mjs's header
expected: Steps: 1) cd /data/code/cadence 2) `grep -rl 'read off the HOST' cadence-core/ skills/ agents/ docs/` prints exactly one path, `cadence-core/bin/lib/trace.mjs` 3) `grep -c 'TOKEN PROVENANCE' cadence-core/bin/lib/trace.mjs` prints `1` and the paragraph under it states all three rules 4) each of the six prose sites - workflows/context.md, workflows/execute.md, workflows/plan.md (two sites), workflows/verify-deep.md, references/review-triggers.md - carries ONE sentence naming all three rules: omit the flag when no figure exists, never `--tokens 0`, a figureless return is ROUTINE rather than a defect.
criterion: AC4
status: pass
first_pass: pass
source: verifier
evidence: grep -rl 'read off the HOST' over cadence-core/ skills/ agents/ docs/ -> one path, lib/trace.mjs; grep -c 'TOKEN PROVENANCE' -> 1 as the header's fourth named contract; all six sites (context.md:118, execute.md:216, plan.md:181 and :243, verify-deep.md:37, review-triggers.md:106) carry one sentence naming all three rules including the ROUTINE clause.

### 5. All four CTW-05 drifts closed, each grep-checkable
expected: Steps: 1) cd /data/code/cadence 2) `grep -c 'in `start`' cadence-core/workflows/execute.md` prints `0` 3) `grep -c workflow.test_command cadence-core/workflows/execute.md` prints `1` and that hit sits inside `execute_parallel`, absent from the batch config resolve 4) `git diff b3748a4..HEAD -- cadence-core/references/config-reach.md | grep '^[+-][^+-]' | grep -c 'min_plans_for_parallel\|use_worktrees'` prints `0`, so only the max_concurrent_agents cell changed 5) `grep -c 'guardrails block' cadence-core/references/seams.md` prints `0`.
criterion: AC5
status: pass
first_pass: pass
source: verifier
evidence: grep -c 'in `start`' execute.md -> 0 (replaced by git_guard, no start step exists); workflow.test_command appears once at execute.md:344, inside execute_parallel and removed from the :30-38 batch resolve; scoped diff of config-reach.md matches min_plans_for_parallel/use_worktrees 0 times, one cell changed; grep -c 'guardrails block' seams.md -> 0 with :237-239 now naming steps 1, 2 and 3.

### 6. Every removed rationale block landed in a git-tracked destination
expected: Steps: 1) cd /data/code/cadence 2) `git ls-files design-notes/sweep-2026-08-10-context-weight.md` lists it, and its 'Where phase 2's moved rationale landed' table names a destination for every removed block 3) each named destination exists: `grep -c 'BREAK-EVEN ARITHMETIC' cadence-core/bin/lib/deferred-reads.mjs`, `grep -c 'TOKEN PROVENANCE' cadence-core/bin/lib/trace.mjs` and `grep -c 'sorts above the newest tag' cadence-core/bin/lib/branch-decision.mjs` each print `1` 4) no destination is a gitignored `design-notes/dd-*.md` - `git check-ignore` matches none of them 5) `grep -c success_criteria skills/cad-plan-checker-contract/SKILL.md` prints `2`, so D-18's holdout survived.
criterion: AC6
status: pass
first_pass: pass
source: verifier
evidence: git ls-files lists design-notes/sweep-2026-08-10-context-weight.md and its single destination table rows every removed block; 'BREAK-EVEN ARITHMETIC', 'TOKEN PROVENANCE' and 'sorts above the newest tag' each grep 1 in deferred-reads.mjs, trace.mjs and branch-decision.mjs; git check-ignore matches no destination (exit 1); grep -c success_criteria skills/cad-plan-checker-contract/SKILL.md -> 2, that file untouched by the phase.

### 7. /cad-verify still behaves without the inlined UAT template
expected: Live-session behavioural check; needs Cadence v2.6.2 installed as the plugin. Steps: 1) install cadence v2.6.2 2) in a project with a completed phase N that has a CONTEXT.md and no UAT file, run `/cad-verify N` 3) it writes `.planning/phases/N/UAT.md` carrying `fields_version: 1` in the frontmatter 4) `grep -c '^criterion:' .planning/phases/N/UAT.md` equals the number of `AC<n>` ids in that phase's CONTEXT 5) the walk presents one item at a time and never shows pass/fail buttons - the template is no longer @-included, so this is what proves the seam's spec still reaches the model.
criterion: AC7
status: skipped
reason: Not testable until v2.6.2 ships: needs Cadence v2.6.2 installed as the plugin (installed is v2.6.1), and this project uses no dev-plugin symlink wiring by standing decision. User answer, 2026-08-10. Re-walk items 7-12 after the v2.6.2 release is installed.

### 8. /cad-land still refuses to publish without an explicit answer
expected: Live-session behavioural check; needs v2.6.2 installed. Steps: 1) with repo `git.auto_close` off, run `/cad-land` on a branch carrying commits 2) at step 3 it Reads `cadence-core/references/review-triggers.md` before firing `pre_ship`, as one extra tool call and not an extra turn 3) it asks the publish mechanism with NO preselected default 4) after a push or MR answer it Reads `cadence-core/references/git-publish.md` before acting 5) it never runs a bare `git push` unprompted and never chains push AND tag unless both were chosen - the trimmed `<guardrails>` did not take those rules with it.
criterion: AC7
status: skipped
reason: Not testable until v2.6.2 ships: needs Cadence v2.6.2 installed as the plugin (installed is v2.6.1), and this project uses no dev-plugin symlink wiring by standing decision. User answer, 2026-08-10. Re-walk items 7-12 after the v2.6.2 release is installed.

### 9. /cad-execute still guards and brackets before the first dispatch
expected: Live-session behavioural check; needs v2.6.2 installed. Steps: 1) run `/cad-execute N` on a planned phase 2) it applies the protected-branch guard and the clean-starting-index check BEFORE the first executor dispatch 3) it appends a `lifecycle/phase_start` trace anchor and brackets each executor with a `dispatch` and a closing `return`/`checkpoint` carrying `--plan` and `--role` 4) it fires the `diff` trigger once per plan 5) nothing in the run refers to a step named `start` - the cut duplication did not take the guard, the bracket keys or the trigger with it.
criterion: AC7
status: skipped
reason: Not testable until v2.6.2 ships: needs Cadence v2.6.2 installed as the plugin (installed is v2.6.1), and this project uses no dev-plugin symlink wiring by standing decision. User answer, 2026-08-10. Re-walk items 7-12 after the v2.6.2 release is installed.

### 10. /cad-plan still caps revisions at one and covers every requirement
expected: Live-session behavioural check; needs v2.6.2 installed. Steps: 1) run `/cad-plan N` on a phase that has a CONTEXT.md 2) it dispatches cad-planner, runs the check gate, then fires the `plan` review trigger 3) a check-gate FAIL produces at most ONE revision round, never a loop 4) the written PLAN.md frontmatter `requirements` covers every requirement id the phase declares in ROADMAP 5) no task action carries scope-reduction phrasing (`v1`, `simplified`, `for now`, `placeholder`) - the cut design-history contrast and the dropped contract checklist did not take the cap, the coverage rule or the prohibition with them.
criterion: AC7
status: skipped
reason: Not testable until v2.6.2 ships: needs Cadence v2.6.2 installed as the plugin (installed is v2.6.1), and this project uses no dev-plugin symlink wiring by standing decision. User answer, 2026-08-10. Re-walk items 7-12 after the v2.6.2 release is installed.

### 11. /cad-context still writes five sections with AC ids
expected: Live-session behavioural check; needs v2.6.2 installed. Steps: 1) run `/cad-context N` on an unplanned phase 2) it writes `.planning/phases/N/CONTEXT.md` with exactly the five sections and nothing else 3) every bullet under `## Acceptance criteria` carries an `AC<n>` id and is falsifiable rather than aspirational 4) assumptions are judged, not scored 5) locked decisions are recorded as `D-NN` rows - the cut purpose and output-contract prose did not take the five-section contract or the AC-id grammar with it.
criterion: AC7
status: skipped
reason: Not testable until v2.6.2 ships: needs Cadence v2.6.2 installed as the plugin (installed is v2.6.1), and this project uses no dev-plugin symlink wiring by standing decision. User answer, 2026-08-10. Re-walk items 7-12 after the v2.6.2 release is installed.

### 12. /cad-health still reports the branch/tag relationship correctly
expected: Live-session behavioural check; needs v2.6.2 installed. Steps: 1) run `/cad-health` in a project whose current branch name sorts above the newest tag (e.g. branch `cadence/v2.6.2` against tag `v2.6.1`) 2) it reports the branch/tag relationship correctly and does not claim the branch is behind or untagged in error 3) it reports `.planning`'s core docs present, the STATE cursor parseable, and ROADMAP/REQUIREMENTS consistent 4) it does not attempt a traceability audit - that is `/cad-audit` - the maintainer cross-reference moving into `lib/branch-decision.mjs` did not change the reported verdict.
criterion: AC7
status: skipped
reason: Not testable until v2.6.2 ships: needs Cadence v2.6.2 installed as the plugin (installed is v2.6.1), and this project uses no dev-plugin symlink wiring by standing decision. User answer, 2026-08-10. Re-walk items 7-12 after the v2.6.2 release is installed.

### 13. The phase goal's ~17,400 B figure is not met - the measured eager fall is 11,639 B, and ROADMAP still states the old number
expected: behavior wrong - the delivered saving is 67% of the figure the ROADMAP phase-2 Goal line names, and the contract document was never re-pinned to the corrected expectation the way REQUIREMENTS.md's CTW-03 row was
origin: verifier
status: pass
first_pass: fail
source: model
evidence: Retest after 5c7df5e. ROADMAP:44 and :74 now read 11,639 B; the ~17,400 B estimate survives only inside the re-pin parenthetical at :77 that records the supersession. Superseded figures corrected: 'three contract' -> 0 occurrences and 'two contract' -> 1; 'five prose sites' -> 0 and 'six prose sites' -> 1; 18,741 -> 1 occurrence, inside criterion 1's own 'this line read 18,741 before the phase-2 verify gate' clause, which is the intended record of the correction. Figure re-measured independently at HEAD: weight.mjs resident summed over 23 commands = 269,045 B against the 280,684 B baseline = 11,639 B, matching the re-pinned number exactly. node cadence-core/bin/self-verify.mjs ok:true problems:[]; node --test cadence-core/bin/*.test.mjs 1516 pass 0 fail; planning.mjs status still parses the phase. Requirement and contract document now agree - REQUIREMENTS.md CTW-03 and ROADMAP both state per-surface measured figures.
reported: behavior wrong - the delivered saving is 67% of the figure the ROADMAP phase-2 Goal line names, and the contract document was never re-pinned to the corrected expectation the way REQUIREMENTS.md's CTW-03 row was
severity: minor
cause: The shortfall is entirely in the duplication portion, not spread across the phase. CTW-03 decomposes the ~17,400 B as the dead include (a measured 5,845 B, 24,533 -> 18,688 on /cad-verify) plus ~11,600 B of duplication. The include delivered its 5,845 B exactly; the eight duplication commits delivered 11,639 - 5,845 = 5,794 B against ~11,600 predicted, i.e. half. Three causes, all disclosed in advance or in execution: D-11 keeps one compressed sentence (~200 B) at each of six --tokens sites, D-18 makes one of three contract checklists uncuttable, and review-triggers.md (+123 B) and config-reach.md (+26 B) both GREW to state a rule correctly. No success criterion and no AC pins a total, so nothing failed a gate - what is actually wrong is a document disagreement: REQUIREMENTS.md CTW-03 was corrected at the phase-2 context gate, ROADMAP.md's phase-2 Goal line (:74) and phase list line (:44) still read ~17,400 B.
fix: 5c7df5e, retest

### 14. /cad-verify still behaves without the inlined UAT template (UAT item 7)
expected: In a project with a completed phase N that has a CONTEXT.md and no UAT file, `/cad-verify N` writes .planning/phases/N/UAT.md with fields_version: 1, one `criterion:` line per AC<n> id declared in that phase's CONTEXT, and walks one item at a time with no pass/fail buttons.
origin: verifier
why_human: Out-of-reach resource, not an unexercised probe: this needs Cadence v2.6.2 running as the installed plugin, and the installed plugin here is v2.6.1. This project deliberately uses no dev-plugin symlink wiring (a standing decision), so there is nothing this session can install or point at to make the v2.6.2 prose the one the host loads. Every static half of the check is already verified under item 1.
status: skipped
source: model
reason: Duplicate of item 7, which the deep pass restated under a suffixed name instead of filling. Item 7 carries the AC7 link and the numbered steps; its why_human is this item's.

### 15. /cad-land still refuses to publish without an explicit answer (UAT item 8)
expected: With git.auto_close off, `/cad-land` on a branch carrying commits Reads references/review-triggers.md before firing pre_ship as one extra tool call, asks the publish mechanism with NO preselected default, Reads references/git-publish.md after the answer, never runs a bare git push unprompted and never chains push AND tag unless both were chosen.
origin: verifier
why_human: Needs v2.6.2 installed as the plugin (installed is v2.6.1, no dev-symlink wiring by project decision), AND it is an interactive publish path against a real repo - the prohibition being checked is precisely that nothing publishes without a human answer, so no probe can settle it without a human at the prompt. Static residue is verified: the no-raw-push rule at skills/cad-land/SKILL.md:113-118 and the No auto-push guardrail at :169-172 both survived the trim.
status: skipped
source: model
reason: Duplicate of item 8, which the deep pass restated under a suffixed name instead of filling. Item 8 carries the AC7 link and the numbered steps; its why_human is this item's.

### 16. /cad-execute still guards and brackets before the first dispatch (UAT item 9)
expected: `/cad-execute N` on a planned phase applies the protected-branch guard and the clean-starting-index check BEFORE the first executor dispatch, appends a lifecycle/phase_start anchor, brackets each executor with a dispatch and a closing return/checkpoint carrying --plan and --role, fires the diff trigger once per plan, and never refers to a step named start.
origin: verifier
why_human: Needs v2.6.2 installed as the plugin (installed is v2.6.1, no dev-symlink wiring by project decision), and it dispatches real executor subagents that write commits - a mutating run this pass may not start. The prose-level residue (git_guard at execute.md:42, brackets at :199-223, no start step anywhere) is already verified under item 5.
status: skipped
source: model
reason: Duplicate of item 9, which the deep pass restated under a suffixed name instead of filling. Item 9 carries the AC7 link and the numbered steps; its why_human is this item's.

### 17. /cad-plan still caps revisions at one and covers every requirement (UAT item 10)
expected: `/cad-plan N` dispatches cad-planner, runs the check gate, then fires the plan trigger; a check-gate FAIL produces at most ONE revision round; the written PLAN.md frontmatter requirements covers every requirement id the phase declares in ROADMAP; no task action carries v1/simplified/for now/placeholder phrasing.
origin: verifier
why_human: Needs v2.6.2 installed as the plugin (installed is v2.6.1, no dev-symlink wiring by project decision), and it is the one item with no mechanical failure mode by design - CONTEXT's own flagged assumption for D-19 states that a planner behaviour regression from the dropped <success_criteria> block surfaces only in this walk. A dispatched-role compliance judgement is not decidable from the file bytes.
status: skipped
source: model
reason: Duplicate of item 10, which the deep pass restated under a suffixed name instead of filling. Item 10 carries the AC7 link and the numbered steps; its why_human is this item's.

### 18. /cad-context still writes five sections with AC ids (UAT item 11)
expected: `/cad-context N` on an unplanned phase writes .planning/phases/N/CONTEXT.md with exactly the five sections and nothing else, every bullet under ## Acceptance criteria carrying an AC<n> id and falsifiable rather than aspirational, assumptions judged not scored, locked decisions recorded as D-NN rows.
origin: verifier
why_human: Needs v2.6.2 installed as the plugin (installed is v2.6.1, no dev-symlink wiring by project decision), and it is an interactive interview whose output quality (falsifiable vs aspirational, judged vs scored) is a human reading, not a grep.
status: skipped
source: model
reason: Duplicate of item 11, which the deep pass restated under a suffixed name instead of filling. Item 11 carries the AC7 link and the numbered steps; its why_human is this item's.

### 19. /cad-health still reports the branch/tag relationship correctly (UAT item 12)
expected: `/cad-health` on a branch that sorts above the newest tag (e.g. cadence/v2.6.2 against v2.6.1) reports the branch/tag relationship correctly and does not call it behind or untagged in error, reports .planning core docs present, STATE cursor parseable and ROADMAP/REQUIREMENTS consistent, and does not attempt a traceability audit.
origin: verifier
why_human: Needs v2.6.2 installed as the plugin (installed is v2.6.1, no dev-symlink wiring by project decision). The regression D-20 guards against is a verdict the model issues at runtime from the eager SKILL.md text, so only a live run on this exact branch/tag shape can show the moved cross-reference did not change it. The static half is verified: the cross-reference lands once in lib/branch-decision.mjs and the v1.9.1 worked example stayed eager.
status: skipped
source: model
reason: Duplicate of item 12, which the deep pass restated under a suffixed name instead of filling. Item 12 carries the AC7 link and the numbered steps; its why_human is this item's.

## Summary

total: 19
passed: 7
failed: 0
pending: 0
skipped: 12
blocked: 0
reworked: 1
