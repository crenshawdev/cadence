# Phase 3 measurement: what the computed level actually costs

AC6 asks for a real milestone compared at today's fixed level and at the
computed one, per-phase `tokens` diffed. No executor can dispatch a live
milestone - the human-verify tag on the criterion means the orchestrator or
the user runs it. This file is what that run reads against: the level diff a
run today would move through, the distribution this phase itself changed, the
per-phase cost baseline the comparison starts from, and the prediction the
live run would falsify.

## 1. Per-phase level diff

`node cadence-core/bin/route.mjs replay`, run 2026-08-21 at commit `72b2339`
on `cadence/v3.5.7`. `ok:true`, 30 rows, `regressions: []` - re-run it and diff
row for row against the table below to check this file rather than trust it.

| Phase | Today | Computed | Evidence behind a raise |
|---|---|---|---|
| `_archive-v2.1.0/1` | shipped | shipped | secrets - `cadence-core/bin/planning.mjs` |
| `_archive-v2.1.0/2` | shipped | shipped | secrets - `cadence-core/bin/review-provider.mjs` |
| `_archive-v2.2.0/1` | shipped | shipped | secrets - `cadence-core/bin/config-seams.test.mjs` |
| `_archive-v2.2.0/2` | shipped | shipped | secrets - `cadence-core/bin/git-publish.test.mjs` |
| `_archive-v2.2.0/3` | shipped | shipped | untrusted_input - `cadence-core/bin/release-bump.mjs` |
| `_archive-v2.2.0/4` | shipped | shipped | destructive - `cadence-core/bin/self-verify.test.mjs` |
| `_archive-v2.2.0/5` | shipped | **solo** | no answered surface touched - discount |
| `_archive-v2.3.0/1` | shipped | shipped | secrets - `cadence-core/bin/planning.mjs` |
| `_archive-v2.3.0/2` | shipped | shipped | destructive - `cadence-core/bin/git-guard.test.mjs` |
| `_archive-v2.3.0/3` | shipped | shipped | destructive - `cadence-core/bin/self-verify.test.mjs` |
| `_archive-v2.5.0/1` | shipped | shipped | secrets - `cadence-core/bin/planning.mjs` |
| `_archive-v2.5.0/2` | shipped | shipped | destructive - `cadence-core/bin/self-verify.test.mjs` |
| `_archive-v2.6.0/1` | shipped | **solo** | no answered surface touched - discount |
| `_archive-v2.6.0/2` | shipped | shipped | secrets - `cadence-core/bin/lib/planning-files.mjs` |
| `_archive-v2.6.0/3` | shipped | shipped | secrets - `cadence-core/bin/lib/debt-markers.mjs` |
| `_archive-v2.6.0/4` | shipped | shipped | secrets - `cadence-core/bin/planning.mjs` |
| `_archive-v2.6.0/5` | shipped | shipped | 1 declared file unread (`cadence-core/workflows/`, not a regular file) - discount withheld, fails closed |
| `_archive-v2.6.1/1` | shipped | shipped | destructive - `cadence-core/bin/self-verify.test.mjs` |
| `_archive-v2.6.2/1` | shipped | shipped | destructive - `cadence-core/bin/self-verify.test.mjs` |
| `_archive-v2.6.2/2` | shipped | shipped | secrets - `cadence-core/bin/planning.mjs` |
| `_archive-v2.6.2/3` | shipped | shipped | destructive - `cadence-core/bin/self-verify.test.mjs` |
| `_archive-v3.3.0/1` | shipped | shipped | secrets - `cadence-core/bin/planning.mjs` |
| `_archive-v3.3.0/2` | shipped | shipped | secrets - `cadence-core/bin/planning.mjs` |
| `_archive-v3.3.0/3` | shipped | shipped | secrets - `cadence-core/bin/git-publish.test.mjs` |
| `_archive-v3.3.0/4` | shipped | shipped | secrets - `cadence-core/bin/planning.mjs` |
| `_archive-v3.3.0/5` | shipped | shipped | untrusted_input - `cadence-core/bin/prose-agreement.test.mjs` |
| `_archive-v3.4.0/1` | shipped | shipped | secrets - `cadence-core/bin/issue-check.mjs` |
| `phases/1` | shipped | shipped | secrets - `cadence-core/bin/planning.mjs` |
| `phases/2` | shipped | shipped | secrets - `cadence-core/bin/planning.mjs` |
| `phases/3` | shipped | shipped | secrets - `cadence-core/bin/config-seams.test.mjs` |

27 of 30 raise back to `shipped` on real evidence. 2 take the unset->`solo`
discount (`_archive-v2.2.0/5`, `_archive-v2.6.0/1`) - a plan read clean,
declaring nothing that touches `[secrets, destructive, untrusted_input]`. 1
(`_archive-v2.6.0/5`) holds `shipped` without evidence because a declared file
went unread - the fail-closed arm, not a raise.

## 2. Distribution this phase itself moved

Same 30 phase directories, before and after the fix this phase shipped in
`b3dbbac` (`fix(3-2): a declared document body is prose, not code`), which
stopped `scanDeclared` reading a declared document's BODY as if it were code.

Measured live by swapping `cadence-core/bin/lib/risk-diff.mjs` back to its
pre-`b3dbbac` state, re-running `route.mjs replay`, and diffing the rows
against the committed tree's replay - then restoring the file (`git diff`
clean afterward, no residue):

| | Before (`b3dbbac~1`) | After (current tree) |
|---|---|---|
| Raised | 29 of 30 | 27 of 30 |
| Discount / withheld | 1 of 30 | 3 of 30 |

The two rows that stopped raising: `_archive-v2.6.0/1` (evidenced only by
`.planning/CAPTURE.md` matching a body pattern) and `_archive-v2.6.0/5`
(evidenced only by `METHOD.md` documenting a recursive-delete call). Both had
no OTHER evidence backing the raise - a document was the only match - which is
the same shape `b3dbbac`'s own commit message measured: dropping thirteen
documentation-body matches took the raising count from 29/30 to 27/30 across
this repository, and every phase that lost a raise had no other evidence at
all.

## 3. Per-phase `tokens` baseline, this milestone

Read off `.planning/trace.jsonl` via `node cadence-core/bin/planning.mjs
trace render --phase <N>`, 2026-08-21 - named as the seam names it
(`roles.<role>.tokens`), not as "the run's cost": the figure excludes what
`references/seams.md`'s measurement section already states it excludes.

| Phase | corr | cad-assumptions-analyzer | cad-planner | cad-plan-checker | cad-executor | cad-reviewer | cad-verifier | Phase total |
|---|---|---|---|---|---|---|---|---|
| 1 | `1-0d3385b` | 1,305,542 | 2,370,505 | 43,579 | 4,756,064 | - | 999,833 | 9,475,523 |
| 2 | `2-bedf576` | 1,426,297 | 2,134,275 | 64,203 | 4,256,479 | - | 693,706 | 8,574,960 |
| 3 | `3-424da85` | 1,314,493 | 1,829,872 | 132,318 | 4,162,996 | 312,980 | 657,343 | 8,410,002 |

Phase 3's row is a snapshot mid-phase: this plan (PLAN-4) is still executing
when the figure above was read, so phase 3's total will grow past this number
before the phase closes. Phases 1 and 2 are closed and final.

## 4. Prediction the live comparison would falsify

Every phase this project has shipped or archived declares source that
genuinely parses JSON, deletes paths, or reads a credential-named assignment -
`cadence-core/bin/planning.mjs`, `self-verify.test.mjs` and their kin recur
across a dozen rows in section 1 for exactly that reason. A milestone of THIS
repository is therefore a weak test of the floor's economics: 27 of 30 phase
directories raise back to `shipped` on real evidence and would pay the same
`tokens` figure at either resolver, fixed or floored. The two phases the table
marks as taking the discount (`_archive-v2.2.0/5`, `_archive-v2.6.0/1`) are
where a saving can appear at all, and a documentation-heavy project - one
whose declared files are prose rather than code touching an answered surface -
is where the discount actually shows, not this one.

What the live run should observe: the phases this table marks `solo` cost
measurably less in per-phase `tokens` than the same phase run at the
pinned-`shipped` fixed level, and no phase this table marks `shipped` (raised)
costs MORE than it did before - the floor never regresses a phase that was
already paying full price. A milestone run over a project closer to
documentation-only declared files, not this one, is where the saving would be
large enough to see past normal run-to-run variance.
