---
status: testing
phase: 1
fields_version: 1
started: 2026-08-25
updated: 2026-08-25
---

## Items

### 1. Router entrypoints name every branch and its cold file
expected: `cadence-core/references/seams.md` names all three seams and the one file each Reads, and `review-triggers.md` states a branch decision for `risk-surface.md`, `review-cross-model.md`, `review-record.md` and `triage-gate.md` - a reader can name which file a given call loads without opening any of them.
status: pass
first_pass: pass
source: verifier
evidence: seams.md:12-22 names all three seams with their Reads plus a rule index at :26-46; review-triggers.md states a branch decision and a ${CLAUDE_PLUGIN_ROOT} Read for review-cross-model.md (:205), review-record.md (:246), risk-surface.md (:266,:332) and triage-gate.md (:277). self-verify check 3 proves each path resolves on disk

### 2. No caller loads a branch it did not select
expected: No skill, workflow or agent eagerly `@`-includes one of the six cold files; each is reached only through a Read at its own branch site.
status: pass
first_pass: pass
source: verifier
evidence: All 27 eager `@${CLAUDE_PLUGIN_ROOT}` includes in skills/ and agents/ enumerated: 22 workflows, references/COMMANDS.md, references/git-guard.md. None of the six cold files, and neither router, is eagerly included; the cold files appear only as prose citations or branch-site Reads

### 3. Safety rules stay in the hot entrypoint
expected: The blocking/adjudicated gate arms and the ONE-round re-arm cap are named in `review-triggers.md` itself, so a caller obeys them before it picks a branch - the cap's own file is ordered RE-READ at step 6 for ANY gate.
status: pass
first_pass: pass
source: verifier
evidence: review-triggers.md:276-286 orders a RE-READ of triage-gate.md before ANY gate, `blocking` included, and names the ONE-round cap; :26-31 the four gate arms and off-returns-immediately; :95-99 never silently skip a blocking trigger; :232-245 the four-arm record statement; :252-258 the `--round 2` refusal; :288-300 the Wiring table

### 4. self-verify reddens on a branch that lost its contract
expected: `node cadence-core/bin/self-verify.mjs` prints `ok:true`, `problems: []`, with `reference-routers` in `checked`; renaming a cold file away makes it print `ok:false` naming that file, and deleting a branch's Read line makes it print `ok:false` naming that branch.
status: pass
first_pass: pass
source: verifier
evidence: Live: ok:true, problems:[], `reference-routers` in checked. On a scratch copy: cold file moved aside -> ok:false, reference-router-missing-cold naming seam-ask-user.md; Read line deleted -> ok:false, reference-router-branch-unread naming the ask-user branch. Wired at self-verify.mjs:250,1238,1351

### 5. Every register row and Read is pinned by a test
expected: `node --test cadence-core/bin/reference-routers.test.mjs` passes, and the register carries one row per cold file so a renamed branch cannot go unnoticed.
status: pass
first_pass: pass
source: verifier
evidence: reference-routers.test.mjs 19 pass / 0 fail; CADENCE-CENSUS at :46 pins 7 rows over 2 routers against ROUTERS at lib/reference-routers.mjs:96-133; census registered at lib/census-registry.mjs:244-256; live-tree assertion at self-verify.test.mjs:1989-1990

### 6. Weight-budget pins moved with the split
expected: `node cadence-core/bin/weight.mjs` reports every one of the eight reference files byte-equal to its `cadence-core/bin/weight-budgets.json` row, with `seams.md` under 4,000 B and `review-triggers.md` under half its pre-split 40,413 B.
status: pass
first_pass: pass
source: verifier
evidence: All eight reference files byte-equal to weight-budgets.json; seams.md 2,323 < 4,000 and review-triggers.md 20,153 < 20,206; weight.mjs ok:true with no overrun; every one of the six task commits touches weight-budgets.json in the same commit

### 7. No prose surface attributes a moved rule to seams.md
expected: `grep -rn "seams\.md" cadence-core/workflows cadence-core/references skills agents METHOD.md DESIGN.md` surfaces no bracket rule, concurrent dispatch, spawn-agent, ask-user or provider-degradation claim still attributed to the router.
status: pass
first_pass: pass
source: verifier
evidence: The scoped grep returns zero hits; every re-pointed citation names the holding file. Remaining seams.md mentions are code comments under cadence-core/bin/, outside the item's surface set and disclosed as an open item

### 8. Moved content is gone from the routers
expected: `grep -c 'route.mjs" resolve' cadence-core/references/seams.md` prints 0; `grep -c "risk_surface detection" cadence-core/references/review-triggers.md` prints 0 and the same grep on `risk-surface.md` prints 1; `grep -c mktemp cadence-core/references/review-triggers.md` prints 0.
status: pass
first_pass: pass
source: verifier
evidence: route.mjs resolve count 0 in seams.md; `risk_surface detection` 0 in review-triggers.md and 1 in risk-surface.md; mktemp 0 in review-triggers.md

### 9. Full suite green and the split is measured, not asserted
expected: `node --test cadence-core/bin/*.test.mjs` passes, and `.planning/phases/1/SUMMARY.md` carries the measured before/after byte counts for both split files rather than the plan's predicted figures.
status: pass
first_pass: pass
source: verifier
evidence: 3288 tests, 3287 pass, 0 fail, 1 skip. Before/after re-derived from git (25,068 -> 2,323 and 40,413 -> 20,153) match SUMMARY.md exactly and contradict the plan's predicted figure, and the caa07bfb regression test fails against the pre-fix module

### 10. The seams router is now orphaned - nothing points a reader at it, and its framing rule lives only there
expected: unwired - task 3 re-pointed all 42 citations at the three seam files and left none naming the seam family, so cadence-core/references/seams.md is cited by no workflow, reference, skill, agent, METHOD.md or DESIGN.md and is @-included by nothing
origin: verifier
status: pass
first_pass: fail
source: model
evidence: `grep -rn 'seams\.md' cadence-core/workflows cadence-core/references skills agents METHOD.md DESIGN.md` now returns 1 hit: conventions.md:239, in `## Subagents and reviews`, naming seams.md as the router for the three seams and carrying the framing rule that host-runtime specifics live in them and nowhere else. `node cadence-core/bin/self-verify.mjs` -> ok:true, problems []; conventions.md budget re-pinned 15204 -> 15457 in the same commit (6f8f1b0b). Full suite 3287 pass 0 fail 1 skip. risk-check run on HEAD~1..HEAD -> matches [], so no risk_surface fire.
reported: unwired - task 3 re-pointed all 42 citations at the three seam files and left none naming the seam family, so cadence-core/references/seams.md is cited by no workflow, reference, skill, agent, METHOD.md or DESIGN.md and is @-included by nothing
severity: minor
cause: Task 3 re-pointed all 42 citations at the seam FILE that holds each rule, which was the task. Nothing re-pointed the FAMILY: conventions.md:238-241 now cites seam-spawn-agent.md and review-triggers.md directly, so no surface names seams.md at all (grep over workflows, references, skills, agents, METHOD.md, DESIGN.md returns 0 hits). The router still carries a rule that lives nowhere else - seams.md:3-6, that these three seams are the ONLY places host-runtime specifics may appear and workflows never inline host-specific alternatives - so the orphaning drops a framing rule rather than just an index. The register check cannot catch it: reference-routers.mjs checks a router reaches its branches, never that anything reaches the router.
fix: 6f8f1b0b, retest

## Summary

total: 10
passed: 10
failed: 0
pending: 0
skipped: 0
blocked: 0
reworked: 1
