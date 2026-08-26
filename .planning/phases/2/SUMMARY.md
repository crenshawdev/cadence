---
phase: 2
status: complete
completed: 2026-08-26
---

# Phase 2: Unforeclose the shared rung prefix - Summary

The rung sentence is gone from all 19 agent bodies, so every one of the six roles now carries exactly ONE distinct body across its rung files, and a new self-verify check (`rung-prefix`) fails the build when a future rung file breaks byte-identity with its siblings.

## What shipped

- Rung sentence deleted from the canonical body and all 19 rung files - `agents/*.md`; `rungBody(skill)` and `rungBodyIssue(body, skills)` lost their `rung` parameter in `cadence-core/bin/lib/rung-agent.mjs`
- `rungPrefixIssues(bodies)` returning `{code:'rung-prefix-split', role, stems, detail}` - `cadence-core/bin/lib/rung-agent.mjs`, wired as self-verify check 7d and named `rung-prefix` in the `checked:` list
- The plan checker's rung arrives in its dispatch prompt instead of its body - `skills/cad-plan-checker-contract/SKILL.md` `<rung>`, with `Rung: {resolved effort}` added at both dispatch sites (`cadence-core/workflows/plan.md` `check_gate`, `cadence-core/references/plan-revision.md` step 2)

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | 03b89d0d | Delete the rung sentence from the canonical body and every rung file |
| 1 | 2 | 143019e3 | CI refuses a rung body that differs from its siblings by one byte |
| 1 | 3 | 8ca0dfdc | The plan checker's rung arrives in its dispatch prompt |

## Deviations

- [deviation] Task 3's Verify asserts `node cadence-core/bin/test.mjs` "reports every group green". The executor observed 3391 tests / 3382 pass / 9 fail, all 9 in `cadence-core/bin/planning-renumber.test.mjs`, and reported them as pre-existing on the grounds that a detached worktree at the phase base `167272d5` produced the same 9 by name. It verified the criterion's intent instead: none of the 9 reads `agents/`, `lib/rung-agent.mjs`, `self-verify.mjs` or any file in the plan's lease, and the count and names were identical before and after all three commits. Every other clause of every task's Verify passed as written. Commit 8ca0dfdc.
  - **Orchestrator check, post-phase:** the 9 failures do NOT reproduce at HEAD (`8ca0dfdc`). `node cadence-core/bin/test.mjs` returns tests 3391 / pass 3391 / fail 0, and `node --test cadence-core/bin/planning-renumber.test.mjs` alone returns tests 25 / pass 25 / fail 0, including the `PHS-01: an unreadable git state refuses the remove, a non-repo still removes` row the executor singled out. The deviation's *conclusion* (the criterion was met in the form it could be met) stands; its *premise* does not survive re-measurement.

## Open items

- `planning-renumber.test.mjs` is load-dependent flaky, not wrong. Its `renumber remove` rows and `PHS-01: an unreadable git state refuses the remove, a non-repo still removes` failed 9-for-9 during the executor's run and pass 25-for-25 on two separate re-runs at the same HEAD. The rows build real git fixtures under `mktemp -d`, so the likely cause is contention in the parallel runner rather than the `unreadable-git-state` classification the executor suspected. Worth a `/cad-task` to make the fixtures contention-safe; do NOT open it as a classification bug on the strength of the executor's reading.
- `INTERNALS.md:11` says "Three things keep the price honest" about the rung-file gates. Task 2 makes it four. Nothing in that sentence became false and no acceptance criterion covers it; `INTERNALS.md` was outside this plan's `files:` lease.

## Goal check

The phase goal is met on both success criteria, and the second half of the requirement is explicitly not this phase's. Criterion 1: every rung file for a role shares a byte-identical body - measured directly, all six role groups collapse to 1 distinct post-frontmatter body (`cad-executor` 1 across 2 files, `cad-planner` 1 across 3, `cad-reviewer` 1 across 4, `cad-verifier` 1 across 4, `cad-plan-checker` 1 across 4, `cad-assumptions-analyzer` 1 across 2), and `grep -rn "Your rung is\|and your rung" agents/` is empty. The check that fails when a future file breaks it is real and wired, not merely written: `self-verify.mjs --root .` lists `rung-prefix` in `checked` and returns `problems:[]`, and the executor's live mutation probe re-wrapped `agents/cad-executor-xhigh.md` alone and got `ok:false` with exactly one problem naming that file and `cad-executor` (`reports/plan-1.md`, task 2). Criterion 2: routing is unmoved - `node --test cadence-core/bin/route.test.mjs` returns tests 160 / pass 160 / fail 0 with all 18 (level, role) cells pinned, so the move changed layout and not routing. Nothing looks missing. RNG-03's MEASUREMENT clause - proving what the shared prefix recovers on the record - is phase 3's (`TRC-07`) by design, because the `SubagentStop` hook cannot reach its cache-figure write path yet; this phase deliberately shipped the layout half alone rather than a claim it could not check.
