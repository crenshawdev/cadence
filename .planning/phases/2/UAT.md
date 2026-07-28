---
status: testing
phase: 2
started: 2026-07-28
updated: 2026-07-28
---

## Items

### 1. seed-reqs writes a bounded Traceability row
expected: Running /cad-plan on a phase whose PLAN.md declares requirements: [X], where X has an ## Active row, leaves a `| X | <N> | Pending |` row in REQUIREMENTS.md ## Traceability. A declared id with NO ## Active row creates no row and is still reported under audit's orphans.plan_ids.
status: pass
first_pass: pass
source: verifier
evidence: Scratch tree: seed-reqs --phase 1 -> {"seeded":["AAA-01"],"skipped":[],"orphan_ids":["CCC-03"]}; diff vs pristine shows exactly one added line `| AAA-01 | Phase 1 | Pending |`, decoy table under ## Notes untouched. Same tree audit -> orphans.plan_ids [{phases/1/PLAN.md, [CCC-03]}]. Impl planning-files.mjs:232-281 (insertReqRows, Pending literal), planning.mjs:631-694 (cmdSeedReqs, ## Active-bounded). Reachable from /cad-plan: workflows/plan.md:221-238,249,261,290; dispatch planning.mjs:1058; CONTRACTS self-verify.mjs:52

### 2. Seeding is idempotent and names skipped ids
expected: Running the seeding a second time against the same plan leaves exactly one row per id and names the skipped ids in its output (e.g. {"seeded":[],"skipped":["SPN-01"]}), with REQUIREMENTS.md byte-unchanged.
status: pass
first_pass: pass
source: verifier
evidence: Runs 2 and 3 each returned {"seeded":[],"skipped":["AAA-01"]}; cmp against post-run-1 snapshot byte-identical both times; grep -c AAA-01 = 2 (## Active bullet + exactly one row). Named test passes in planning.test.mjs

### 3. This repo is seeded and audit counts more than zero
expected: .planning/REQUIREMENTS.md ## Active carries a requirement row for each of v1.4.0's four phases, each phase's PLAN.md requirements: frontmatter names its ids, and `node cadence-core/bin/planning.mjs audit` reports counts.total greater than 0.
status: pass
first_pass: pass
source: verifier
evidence: .planning/REQUIREMENTS.md:12-24 carries ## Active bullets for all four v1.4.0 phases (GRM-01, SPN-01, TOK-01, RDM-01); :110-112 the two seeded rows; audit -> counts {total:2, traced:1, broken:1}, GRM-01 -> phases/1/PLAN-2.md Complete, SPN-01 -> phases/2/PLAN.md Pending. Frontmatter requirements: [GRM-01] in both phase-1 plans, [SPN-01] in phases/2/PLAN.md

### 4. Zero-row table gets an additive unseeded signal, verdict unmoved
expected: audit against a .planning whose ## Traceability has zero rows returns an additive field naming the unseeded state, while counts.broken stays 0 and the PASS/FAIL verdict for that tree is byte-identical to before the phase.
status: pass
first_pass: pass
source: verifier
evidence: Zero-row scratch tree run under HEAD vs pre-phase a3cd7fb (git archive): outputs differ ONLY by "unseeded":{"active_ids":["AAA-01","BBB-02"]}; counts identical (total:0, traced:0, broken:0) so audit.md PASS (counts.broken == 0) is unmoved. Absent-## Active variant yields {active_ids:[], no_active_section:true}. On a populated tree the two versions' audit JSON diff is empty. audit.md:48-59 keeps the verdict prose additive

### 5. Non-conforming plan filenames are reported
expected: A PLAN-gaps.md in a phase directory is reported by both audit and plan-overlap as a non-conforming plan filename; a PLAN-2.md in the same directory is not.
status: pass
first_pass: pass
source: verifier
evidence: With PLAN.md + PLAN-2.md + PLAN-gaps.md in a phase dir: audit -> "nonconforming_plans":["phases/1/PLAN-gaps.md"]; plan-overlap --phase 1 -> plans [PLAN-2.md, PLAN.md] plus nonconforming_plans [PLAN-gaps.md]. Pre-phase binary on the same tree emits neither field. Single classifier planning.mjs:476-486

### 6. Worktree-mode executor halts blocked on a missing plan file (human-verify)
expected: A cad-executor dispatched into a worktree that does not contain its own PLAN-<k>.md halts with a blocked checkpoint naming the missing file, before any task-1 commit. Needs a live parallel /cad-execute run under host worktree isolation.
status: skipped
reason: Proxy run, not a live /cad-execute: a general-purpose agent given agents/cad-executor.md as its contract, dispatched under real host worktree isolation with plan .planning/phases/3/PLAN-2.md on branch cadence/phase-3-plan-2. It halted before task 1 with a blocked checkpoint naming the missing PLAN path and the worktree HEAD, repaired nothing, made no commit. Notably the host forked the worktree from d8941e9 (main), not the cadence/v1.4.0 tip 5c651a8, so the tree genuinely lacked all phase 1-2 commits - the phase-4 stale-fork shape reproduced live, and it resolves CONTEXT.md's flagged assumption (isolation forks from the merge base, not HEAD). Not recorded as a pass because the registered cadence:cad-executor subagent resolves to released 1.3.1, which has no assertion; a faithful run needs the dev-plugin flip plus a multi-plan phase.

### 7. Green checks and no stale fork-from-HEAD claims
expected: `node --test cadence-core/bin/*.test.mjs` and `npx tsc -p tsconfig.ci.json` both pass, self-verify reports no budget-overrun, and /cad-docs-verify reports no stale claim that worktrees fork from HEAD or the integration tip (references/git.md, lib/branch-decision.mjs, METHOD.md).
status: pass
first_pass: pass
source: verifier
evidence: node --test cadence-core/bin/*.test.mjs -> tests 449, pass 449, fail 0; npx tsc -p tsconfig.ci.json -> exit 0; self-verify.mjs -> {ok:true, problems:[]} (no budget-overrun). Claims corrected at references/git.md:78-87, lib/branch-decision.mjs:71-73,95, METHOD.md:487-489; honest binding added references/seams.md:55-65, workflows/config.md:94, config.schema.json:36. Repo-wide grep finds no surviving fork-from-HEAD assertion in a live surface

## Summary

total: 7
passed: 6
failed: 0
pending: 0
skipped: 1
blocked: 0
reworked: 0
