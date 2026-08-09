# Phase 5 - confirmation run over the ledger ids (run 2)

Re-verified 2026-08-09 at `c0a7326` on `cadence/v2.6.0`, against
`.planning/DOCS-CLAIMS.md`'s 547 ids.

**run-1 stale 18 -> run-2 stale 0 + 18 divergences**

This is not a second extraction. D-03 defines the confirmation run as a pass
over the ledger's IDS, so the delta above is a set difference on a fixed claim
set rather than a comparison of two independently extracted sets. A second
extraction over 269 KB of prose would have produced a different claim set, and a
smaller report would then have measured extraction variance instead of
corrections.

`/cad-docs-verify` was NOT invoked. The command is the orchestrator's (D-13) and
`agents/cad-executor.md` declares no `Task` or skill-invocation tool, so a task
calling it returns blocked. Every id below was re-checked directly with `Read`,
`Grep`, `Glob` and read-only `Bash`, the same checks run 1 cites per claim.

## Method

Run 1 swept at `a6b8931`. `git diff --name-only a6b8931..HEAD` names every file
this phase changed, and that partitions the ledger:

- **10 of the 25 surface files changed** — `README.md`, `METHOD.md`,
  `INTERNALS.md`, `CONTRIBUTING.md` and `cadence-core/workflows/`
  `audit.md`, `config.md`, `execute.md`, `new-project.md`, `progress.md`,
  `task.md`. Their 349 rows were re-read at HEAD. Every corrected row was
  re-checked against the thing it asserts (the schema default, the live
  `route-table.json` cell, the regex, the CI step, the file count), and every
  ACCURATE row in those same files was checked for collateral damage from the
  edit beside it — the phrases those rows quote all survive intact
  (`README.md:36`'s three neighbouring claims, `METHOD.md`'s severity and gate
  vocabulary sentences, `INTERNALS.md:55`'s Gemini half, `CONTRIBUTING.md:13`'s
  "the same three checks CI runs" and "`node` and `git` on your PATH",
  `audit.md`'s `unpicked` clause, `config.md`'s trigger set,
  `execute.md`'s report path, `new-project.md:51`'s surviving three defaults,
  `task.md`'s blocking-and-capped pair).
- **15 of the 25 did not change**, and neither did any file under
  `cadence-core/bin/` other than `weight-budgets.json`, whose entry COUNT is
  still 93. Their 198 rows were verified against a doc and a codebase both
  byte-identical to what run 1 read. That identity is the verification, and it
  is what "the next cycle starts from a diff" means in practice.

No row moved to `stale`. No row was resolved by rewording a claim into a
description of a defect: the three real defects behind these corrections are
filed as `DFC-01`, `DFC-02` and `DFC-03` under `## Deferred` in
`.planning/REQUIREMENTS.md`.

## Counts

| | run 1 | run 2 |
|---|---|---|
| accurate | 509 | 527 |
| stale | 18 | 0 |
| unverifiable | 20 | 20 |
| **total** | **547** | **547** |

Ledger resolutions: 509 `accurate`, 19 `corrected`, 19 `divergence`. Zero
`pending`, zero empty.

The 20 unverifiable rows do not become verifiable by being corrected, and the
count is deliberately flat. Eighteen are recorded as divergences with the reason
each stands: personal billing data, Claude Code host behaviour, historical
measurements of code that no longer exists, judgments no count settles, and two
bare decision ids whose CONTEXT is in neither the live tree nor any archive. The
other two are `README.md:132`'s v2.3.0 figures, which were re-anchored at task 1
rather than restated as current — the before/after is the paragraph's point, and
`docs/EVIDENCE.md` now carries the current numbers beside the command that
regenerates them.

## Rows

### Rows stale in run 1 (18) - every one now accurate

| id | doc | run-1 | run-2 | how re-verified |
|---|---|---|---|---|
| README-01 | README.md | stale | accurate | re-read at HEAD |
| README-02 | README.md | stale | accurate | re-read at HEAD |
| METHOD-01 | METHOD.md | stale | accurate | re-read at HEAD |
| METHOD-02 | METHOD.md | stale | accurate | re-read at HEAD |
| METHOD-03 | METHOD.md | stale | accurate | re-read at HEAD |
| METHOD-04 | METHOD.md | stale | accurate | re-read at HEAD |
| INTERNALS-01 | INTERNALS.md | stale | accurate | re-read at HEAD |
| CONTRIBUTING-01 | CONTRIBUTING.md | stale | accurate | re-read at HEAD |
| AUDIT-01 | cadence-core/workflows/audit.md | stale | accurate | re-read at HEAD |
| AUDIT-02 | cadence-core/workflows/audit.md | stale | accurate | re-read at HEAD |
| CONFIG-01 | cadence-core/workflows/config.md | stale | accurate | re-read at HEAD |
| CONFIG-02 | cadence-core/workflows/config.md | stale | accurate | re-read at HEAD |
| EXECUTE-01 | cadence-core/workflows/execute.md | stale | accurate | re-read at HEAD |
| EXECUTE-02 | cadence-core/workflows/execute.md | stale | accurate | re-read at HEAD |
| EXECUTE-03 | cadence-core/workflows/execute.md | stale | accurate | re-read at HEAD |
| NEW-PROJECT-01 | cadence-core/workflows/new-project.md | stale | accurate | re-read at HEAD |
| PROGRESS-01 | cadence-core/workflows/progress.md | stale | accurate | re-read at HEAD |
| TASK-01 | cadence-core/workflows/task.md | stale | accurate | re-read at HEAD |

### Rows unverifiable in run 1 (20) - 18 resolved as divergences, 2 corrected at task 1

| id | doc | run-1 | run-2 | how re-verified |
|---|---|---|---|---|
| README-47 | README.md | unverifiable | unverifiable | re-read at HEAD |
| README-48 | README.md | unverifiable | unverifiable | re-read at HEAD |
| README-49 | README.md | unverifiable | unverifiable | re-read at HEAD |
| README-50 | README.md | unverifiable | unverifiable | re-read at HEAD |
| README-51 | README.md | unverifiable | unverifiable | re-read at HEAD |
| METHOD-82 | METHOD.md | unverifiable | unverifiable | re-read at HEAD |
| INTERNALS-32 | INTERNALS.md | unverifiable | unverifiable | re-read at HEAD |
| INTERNALS-33 | INTERNALS.md | unverifiable | unverifiable | re-read at HEAD |
| INTERNALS-34 | INTERNALS.md | unverifiable | unverifiable | re-read at HEAD |
| INTERNALS-35 | INTERNALS.md | unverifiable | unverifiable | re-read at HEAD |
| INTERNALS-36 | INTERNALS.md | unverifiable | unverifiable | re-read at HEAD |
| INTERNALS-37 | INTERNALS.md | unverifiable | unverifiable | re-read at HEAD |
| CONTRIBUTING-15 | CONTRIBUTING.md | unverifiable | unverifiable | re-read at HEAD |
| CONTRIBUTING-16 | CONTRIBUTING.md | unverifiable | unverifiable | re-read at HEAD |
| CONTRIBUTING-17 | CONTRIBUTING.md | unverifiable | unverifiable | re-read at HEAD |
| DECISION-REVIEW-01 | cadence-core/workflows/decision-review.md | unverifiable | unverifiable | doc and cited code byte-identical to `a6b8931` |
| DECISION-REVIEW-02 | cadence-core/workflows/decision-review.md | unverifiable | unverifiable | doc and cited code byte-identical to `a6b8931` |
| NEW-PROJECT-02 | cadence-core/workflows/new-project.md | unverifiable | unverifiable | re-read at HEAD |
| PLAN-01 | cadence-core/workflows/plan.md | unverifiable | unverifiable | doc and cited code byte-identical to `a6b8931` |
| PLAN-02 | cadence-core/workflows/plan.md | unverifiable | unverifiable | doc and cited code byte-identical to `a6b8931` |

### Rows accurate in run 1 (509) - all still accurate

| id | doc | run-1 | run-2 | how re-verified |
|---|---|---|---|---|
| README-03 | README.md | accurate | accurate | re-read at HEAD |
| README-04 | README.md | accurate | accurate | re-read at HEAD |
| README-05 | README.md | accurate | accurate | re-read at HEAD |
| README-06 | README.md | accurate | accurate | re-read at HEAD |
| README-07 | README.md | accurate | accurate | re-read at HEAD |
| README-08 | README.md | accurate | accurate | re-read at HEAD |
| README-09 | README.md | accurate | accurate | re-read at HEAD |
| README-10 | README.md | accurate | accurate | re-read at HEAD |
| README-11 | README.md | accurate | accurate | re-read at HEAD |
| README-12 | README.md | accurate | accurate | re-read at HEAD |
| README-13 | README.md | accurate | accurate | re-read at HEAD |
| README-14 | README.md | accurate | accurate | re-read at HEAD |
| README-15 | README.md | accurate | accurate | re-read at HEAD |
| README-16 | README.md | accurate | accurate | re-read at HEAD |
| README-17 | README.md | accurate | accurate | re-read at HEAD |
| README-18 | README.md | accurate | accurate | re-read at HEAD |
| README-19 | README.md | accurate | accurate | re-read at HEAD |
| README-20 | README.md | accurate | accurate | re-read at HEAD |
| README-21 | README.md | accurate | accurate | re-read at HEAD |
| README-22 | README.md | accurate | accurate | re-read at HEAD |
| README-23 | README.md | accurate | accurate | re-read at HEAD |
| README-24 | README.md | accurate | accurate | re-read at HEAD |
| README-25 | README.md | accurate | accurate | re-read at HEAD |
| README-26 | README.md | accurate | accurate | re-read at HEAD |
| README-27 | README.md | accurate | accurate | re-read at HEAD |
| README-28 | README.md | accurate | accurate | re-read at HEAD |
| README-29 | README.md | accurate | accurate | re-read at HEAD |
| README-30 | README.md | accurate | accurate | re-read at HEAD |
| README-31 | README.md | accurate | accurate | re-read at HEAD |
| README-32 | README.md | accurate | accurate | re-read at HEAD |
| README-33 | README.md | accurate | accurate | re-read at HEAD |
| README-34 | README.md | accurate | accurate | re-read at HEAD |
| README-35 | README.md | accurate | accurate | re-read at HEAD |
| README-36 | README.md | accurate | accurate | re-read at HEAD |
| README-37 | README.md | accurate | accurate | re-read at HEAD |
| README-38 | README.md | accurate | accurate | re-read at HEAD |
| README-39 | README.md | accurate | accurate | re-read at HEAD |
| README-40 | README.md | accurate | accurate | re-read at HEAD |
| README-41 | README.md | accurate | accurate | re-read at HEAD |
| README-42 | README.md | accurate | accurate | re-read at HEAD |
| README-43 | README.md | accurate | accurate | re-read at HEAD |
| README-44 | README.md | accurate | accurate | re-read at HEAD |
| README-45 | README.md | accurate | accurate | re-read at HEAD |
| README-46 | README.md | accurate | accurate | re-read at HEAD |
| METHOD-05 | METHOD.md | accurate | accurate | re-read at HEAD |
| METHOD-06 | METHOD.md | accurate | accurate | re-read at HEAD |
| METHOD-07 | METHOD.md | accurate | accurate | re-read at HEAD |
| METHOD-08 | METHOD.md | accurate | accurate | re-read at HEAD |
| METHOD-09 | METHOD.md | accurate | accurate | re-read at HEAD |
| METHOD-10 | METHOD.md | accurate | accurate | re-read at HEAD |
| METHOD-11 | METHOD.md | accurate | accurate | re-read at HEAD |
| METHOD-12 | METHOD.md | accurate | accurate | re-read at HEAD |
| METHOD-13 | METHOD.md | accurate | accurate | re-read at HEAD |
| METHOD-14 | METHOD.md | accurate | accurate | re-read at HEAD |
| METHOD-15 | METHOD.md | accurate | accurate | re-read at HEAD |
| METHOD-16 | METHOD.md | accurate | accurate | re-read at HEAD |
| METHOD-17 | METHOD.md | accurate | accurate | re-read at HEAD |
| METHOD-18 | METHOD.md | accurate | accurate | re-read at HEAD |
| METHOD-19 | METHOD.md | accurate | accurate | re-read at HEAD |
| METHOD-20 | METHOD.md | accurate | accurate | re-read at HEAD |
| METHOD-21 | METHOD.md | accurate | accurate | re-read at HEAD |
| METHOD-22 | METHOD.md | accurate | accurate | re-read at HEAD |
| METHOD-23 | METHOD.md | accurate | accurate | re-read at HEAD |
| METHOD-24 | METHOD.md | accurate | accurate | re-read at HEAD |
| METHOD-25 | METHOD.md | accurate | accurate | re-read at HEAD |
| METHOD-26 | METHOD.md | accurate | accurate | re-read at HEAD |
| METHOD-27 | METHOD.md | accurate | accurate | re-read at HEAD |
| METHOD-28 | METHOD.md | accurate | accurate | re-read at HEAD |
| METHOD-29 | METHOD.md | accurate | accurate | re-read at HEAD |
| METHOD-30 | METHOD.md | accurate | accurate | re-read at HEAD |
| METHOD-31 | METHOD.md | accurate | accurate | re-read at HEAD |
| METHOD-32 | METHOD.md | accurate | accurate | re-read at HEAD |
| METHOD-33 | METHOD.md | accurate | accurate | re-read at HEAD |
| METHOD-34 | METHOD.md | accurate | accurate | re-read at HEAD |
| METHOD-35 | METHOD.md | accurate | accurate | re-read at HEAD |
| METHOD-36 | METHOD.md | accurate | accurate | re-read at HEAD |
| METHOD-37 | METHOD.md | accurate | accurate | re-read at HEAD |
| METHOD-38 | METHOD.md | accurate | accurate | re-read at HEAD |
| METHOD-39 | METHOD.md | accurate | accurate | re-read at HEAD |
| METHOD-40 | METHOD.md | accurate | accurate | re-read at HEAD |
| METHOD-41 | METHOD.md | accurate | accurate | re-read at HEAD |
| METHOD-42 | METHOD.md | accurate | accurate | re-read at HEAD |
| METHOD-43 | METHOD.md | accurate | accurate | re-read at HEAD |
| METHOD-44 | METHOD.md | accurate | accurate | re-read at HEAD |
| METHOD-45 | METHOD.md | accurate | accurate | re-read at HEAD |
| METHOD-46 | METHOD.md | accurate | accurate | re-read at HEAD |
| METHOD-47 | METHOD.md | accurate | accurate | re-read at HEAD |
| METHOD-48 | METHOD.md | accurate | accurate | re-read at HEAD |
| METHOD-49 | METHOD.md | accurate | accurate | re-read at HEAD |
| METHOD-50 | METHOD.md | accurate | accurate | re-read at HEAD |
| METHOD-51 | METHOD.md | accurate | accurate | re-read at HEAD |
| METHOD-52 | METHOD.md | accurate | accurate | re-read at HEAD |
| METHOD-53 | METHOD.md | accurate | accurate | re-read at HEAD |
| METHOD-54 | METHOD.md | accurate | accurate | re-read at HEAD |
| METHOD-55 | METHOD.md | accurate | accurate | re-read at HEAD |
| METHOD-56 | METHOD.md | accurate | accurate | re-read at HEAD |
| METHOD-57 | METHOD.md | accurate | accurate | re-read at HEAD |
| METHOD-58 | METHOD.md | accurate | accurate | re-read at HEAD |
| METHOD-59 | METHOD.md | accurate | accurate | re-read at HEAD |
| METHOD-60 | METHOD.md | accurate | accurate | re-read at HEAD |
| METHOD-61 | METHOD.md | accurate | accurate | re-read at HEAD |
| METHOD-62 | METHOD.md | accurate | accurate | re-read at HEAD |
| METHOD-63 | METHOD.md | accurate | accurate | re-read at HEAD |
| METHOD-64 | METHOD.md | accurate | accurate | re-read at HEAD |
| METHOD-65 | METHOD.md | accurate | accurate | re-read at HEAD |
| METHOD-66 | METHOD.md | accurate | accurate | re-read at HEAD |
| METHOD-67 | METHOD.md | accurate | accurate | re-read at HEAD |
| METHOD-68 | METHOD.md | accurate | accurate | re-read at HEAD |
| METHOD-69 | METHOD.md | accurate | accurate | re-read at HEAD |
| METHOD-70 | METHOD.md | accurate | accurate | re-read at HEAD |
| METHOD-71 | METHOD.md | accurate | accurate | re-read at HEAD |
| METHOD-72 | METHOD.md | accurate | accurate | re-read at HEAD |
| METHOD-73 | METHOD.md | accurate | accurate | re-read at HEAD |
| METHOD-74 | METHOD.md | accurate | accurate | re-read at HEAD |
| METHOD-75 | METHOD.md | accurate | accurate | re-read at HEAD |
| METHOD-76 | METHOD.md | accurate | accurate | re-read at HEAD |
| METHOD-77 | METHOD.md | accurate | accurate | re-read at HEAD |
| METHOD-78 | METHOD.md | accurate | accurate | re-read at HEAD |
| METHOD-79 | METHOD.md | accurate | accurate | re-read at HEAD |
| METHOD-80 | METHOD.md | accurate | accurate | re-read at HEAD |
| METHOD-81 | METHOD.md | accurate | accurate | re-read at HEAD |
| INTERNALS-02 | INTERNALS.md | accurate | accurate | re-read at HEAD |
| INTERNALS-03 | INTERNALS.md | accurate | accurate | re-read at HEAD |
| INTERNALS-04 | INTERNALS.md | accurate | accurate | re-read at HEAD |
| INTERNALS-05 | INTERNALS.md | accurate | accurate | re-read at HEAD |
| INTERNALS-06 | INTERNALS.md | accurate | accurate | re-read at HEAD |
| INTERNALS-07 | INTERNALS.md | accurate | accurate | re-read at HEAD |
| INTERNALS-08 | INTERNALS.md | accurate | accurate | re-read at HEAD |
| INTERNALS-09 | INTERNALS.md | accurate | accurate | re-read at HEAD |
| INTERNALS-10 | INTERNALS.md | accurate | accurate | re-read at HEAD |
| INTERNALS-11 | INTERNALS.md | accurate | accurate | re-read at HEAD |
| INTERNALS-12 | INTERNALS.md | accurate | accurate | re-read at HEAD |
| INTERNALS-13 | INTERNALS.md | accurate | accurate | re-read at HEAD |
| INTERNALS-14 | INTERNALS.md | accurate | accurate | re-read at HEAD |
| INTERNALS-15 | INTERNALS.md | accurate | accurate | re-read at HEAD |
| INTERNALS-16 | INTERNALS.md | accurate | accurate | re-read at HEAD |
| INTERNALS-17 | INTERNALS.md | accurate | accurate | re-read at HEAD |
| INTERNALS-18 | INTERNALS.md | accurate | accurate | re-read at HEAD |
| INTERNALS-19 | INTERNALS.md | accurate | accurate | re-read at HEAD |
| INTERNALS-20 | INTERNALS.md | accurate | accurate | re-read at HEAD |
| INTERNALS-21 | INTERNALS.md | accurate | accurate | re-read at HEAD |
| INTERNALS-22 | INTERNALS.md | accurate | accurate | re-read at HEAD |
| INTERNALS-23 | INTERNALS.md | accurate | accurate | re-read at HEAD |
| INTERNALS-24 | INTERNALS.md | accurate | accurate | re-read at HEAD |
| INTERNALS-25 | INTERNALS.md | accurate | accurate | re-read at HEAD |
| INTERNALS-26 | INTERNALS.md | accurate | accurate | re-read at HEAD |
| INTERNALS-27 | INTERNALS.md | accurate | accurate | re-read at HEAD |
| INTERNALS-28 | INTERNALS.md | accurate | accurate | re-read at HEAD |
| INTERNALS-29 | INTERNALS.md | accurate | accurate | re-read at HEAD |
| INTERNALS-30 | INTERNALS.md | accurate | accurate | re-read at HEAD |
| INTERNALS-31 | INTERNALS.md | accurate | accurate | re-read at HEAD |
| CONTRIBUTING-02 | CONTRIBUTING.md | accurate | accurate | re-read at HEAD |
| CONTRIBUTING-03 | CONTRIBUTING.md | accurate | accurate | re-read at HEAD |
| CONTRIBUTING-04 | CONTRIBUTING.md | accurate | accurate | re-read at HEAD |
| CONTRIBUTING-05 | CONTRIBUTING.md | accurate | accurate | re-read at HEAD |
| CONTRIBUTING-06 | CONTRIBUTING.md | accurate | accurate | re-read at HEAD |
| CONTRIBUTING-07 | CONTRIBUTING.md | accurate | accurate | re-read at HEAD |
| CONTRIBUTING-08 | CONTRIBUTING.md | accurate | accurate | re-read at HEAD |
| CONTRIBUTING-09 | CONTRIBUTING.md | accurate | accurate | re-read at HEAD |
| CONTRIBUTING-10 | CONTRIBUTING.md | accurate | accurate | re-read at HEAD |
| CONTRIBUTING-11 | CONTRIBUTING.md | accurate | accurate | re-read at HEAD |
| CONTRIBUTING-12 | CONTRIBUTING.md | accurate | accurate | re-read at HEAD |
| CONTRIBUTING-13 | CONTRIBUTING.md | accurate | accurate | re-read at HEAD |
| CONTRIBUTING-14 | CONTRIBUTING.md | accurate | accurate | re-read at HEAD |
| AUDIT-03 | cadence-core/workflows/audit.md | accurate | accurate | re-read at HEAD |
| AUDIT-04 | cadence-core/workflows/audit.md | accurate | accurate | re-read at HEAD |
| AUDIT-05 | cadence-core/workflows/audit.md | accurate | accurate | re-read at HEAD |
| AUDIT-06 | cadence-core/workflows/audit.md | accurate | accurate | re-read at HEAD |
| AUDIT-07 | cadence-core/workflows/audit.md | accurate | accurate | re-read at HEAD |
| AUDIT-08 | cadence-core/workflows/audit.md | accurate | accurate | re-read at HEAD |
| AUDIT-09 | cadence-core/workflows/audit.md | accurate | accurate | re-read at HEAD |
| AUDIT-10 | cadence-core/workflows/audit.md | accurate | accurate | re-read at HEAD |
| AUDIT-11 | cadence-core/workflows/audit.md | accurate | accurate | re-read at HEAD |
| AUDIT-12 | cadence-core/workflows/audit.md | accurate | accurate | re-read at HEAD |
| AUDIT-13 | cadence-core/workflows/audit.md | accurate | accurate | re-read at HEAD |
| AUDIT-14 | cadence-core/workflows/audit.md | accurate | accurate | re-read at HEAD |
| AUDIT-15 | cadence-core/workflows/audit.md | accurate | accurate | re-read at HEAD |
| AUDIT-16 | cadence-core/workflows/audit.md | accurate | accurate | re-read at HEAD |
| AUDIT-17 | cadence-core/workflows/audit.md | accurate | accurate | re-read at HEAD |
| AUDIT-18 | cadence-core/workflows/audit.md | accurate | accurate | re-read at HEAD |
| AUDIT-19 | cadence-core/workflows/audit.md | accurate | accurate | re-read at HEAD |
| AUDIT-20 | cadence-core/workflows/audit.md | accurate | accurate | re-read at HEAD |
| AUDIT-21 | cadence-core/workflows/audit.md | accurate | accurate | re-read at HEAD |
| AUDIT-22 | cadence-core/workflows/audit.md | accurate | accurate | re-read at HEAD |
| AUDIT-23 | cadence-core/workflows/audit.md | accurate | accurate | re-read at HEAD |
| AUDIT-24 | cadence-core/workflows/audit.md | accurate | accurate | re-read at HEAD |
| AUDIT-25 | cadence-core/workflows/audit.md | accurate | accurate | re-read at HEAD |
| AUDIT-26 | cadence-core/workflows/audit.md | accurate | accurate | re-read at HEAD |
| AUDIT-27 | cadence-core/workflows/audit.md | accurate | accurate | re-read at HEAD |
| AUDIT-28 | cadence-core/workflows/audit.md | accurate | accurate | re-read at HEAD |
| AUDIT-29 | cadence-core/workflows/audit.md | accurate | accurate | re-read at HEAD |
| AUDIT-30 | cadence-core/workflows/audit.md | accurate | accurate | re-read at HEAD |
| AUDIT-31 | cadence-core/workflows/audit.md | accurate | accurate | re-read at HEAD |
| AUDIT-32 | cadence-core/workflows/audit.md | accurate | accurate | re-read at HEAD |
| AUDIT-33 | cadence-core/workflows/audit.md | accurate | accurate | re-read at HEAD |
| CONFIG-03 | cadence-core/workflows/config.md | accurate | accurate | re-read at HEAD |
| CONFIG-04 | cadence-core/workflows/config.md | accurate | accurate | re-read at HEAD |
| CONFIG-05 | cadence-core/workflows/config.md | accurate | accurate | re-read at HEAD |
| CONFIG-06 | cadence-core/workflows/config.md | accurate | accurate | re-read at HEAD |
| CONFIG-07 | cadence-core/workflows/config.md | accurate | accurate | re-read at HEAD |
| CONFIG-08 | cadence-core/workflows/config.md | accurate | accurate | re-read at HEAD |
| CONFIG-09 | cadence-core/workflows/config.md | accurate | accurate | re-read at HEAD |
| CONFIG-10 | cadence-core/workflows/config.md | accurate | accurate | re-read at HEAD |
| CONFIG-11 | cadence-core/workflows/config.md | accurate | accurate | re-read at HEAD |
| CONFIG-12 | cadence-core/workflows/config.md | accurate | accurate | re-read at HEAD |
| CONFIG-13 | cadence-core/workflows/config.md | accurate | accurate | re-read at HEAD |
| CONFIG-14 | cadence-core/workflows/config.md | accurate | accurate | re-read at HEAD |
| CONFIG-15 | cadence-core/workflows/config.md | accurate | accurate | re-read at HEAD |
| CONFIG-16 | cadence-core/workflows/config.md | accurate | accurate | re-read at HEAD |
| CONFIG-17 | cadence-core/workflows/config.md | accurate | accurate | re-read at HEAD |
| CONFIG-18 | cadence-core/workflows/config.md | accurate | accurate | re-read at HEAD |
| CONFIG-19 | cadence-core/workflows/config.md | accurate | accurate | re-read at HEAD |
| CONFIG-20 | cadence-core/workflows/config.md | accurate | accurate | re-read at HEAD |
| CONFIG-21 | cadence-core/workflows/config.md | accurate | accurate | re-read at HEAD |
| CONFIG-22 | cadence-core/workflows/config.md | accurate | accurate | re-read at HEAD |
| CONFIG-23 | cadence-core/workflows/config.md | accurate | accurate | re-read at HEAD |
| CONFIG-24 | cadence-core/workflows/config.md | accurate | accurate | re-read at HEAD |
| CONFIG-25 | cadence-core/workflows/config.md | accurate | accurate | re-read at HEAD |
| CONFIG-26 | cadence-core/workflows/config.md | accurate | accurate | re-read at HEAD |
| CONFIG-27 | cadence-core/workflows/config.md | accurate | accurate | re-read at HEAD |
| CONFIG-28 | cadence-core/workflows/config.md | accurate | accurate | re-read at HEAD |
| CONFIG-29 | cadence-core/workflows/config.md | accurate | accurate | re-read at HEAD |
| CONFIG-30 | cadence-core/workflows/config.md | accurate | accurate | re-read at HEAD |
| CONFIG-31 | cadence-core/workflows/config.md | accurate | accurate | re-read at HEAD |
| CONFIG-32 | cadence-core/workflows/config.md | accurate | accurate | re-read at HEAD |
| CONFIG-33 | cadence-core/workflows/config.md | accurate | accurate | re-read at HEAD |
| CONFIG-34 | cadence-core/workflows/config.md | accurate | accurate | re-read at HEAD |
| CONFIG-35 | cadence-core/workflows/config.md | accurate | accurate | re-read at HEAD |
| CONFIG-36 | cadence-core/workflows/config.md | accurate | accurate | re-read at HEAD |
| CONFIG-37 | cadence-core/workflows/config.md | accurate | accurate | re-read at HEAD |
| CONFIG-38 | cadence-core/workflows/config.md | accurate | accurate | re-read at HEAD |
| CONFIG-39 | cadence-core/workflows/config.md | accurate | accurate | re-read at HEAD |
| CONFIG-40 | cadence-core/workflows/config.md | accurate | accurate | re-read at HEAD |
| CONFIG-41 | cadence-core/workflows/config.md | accurate | accurate | re-read at HEAD |
| CONFIG-42 | cadence-core/workflows/config.md | accurate | accurate | re-read at HEAD |
| CONFIG-43 | cadence-core/workflows/config.md | accurate | accurate | re-read at HEAD |
| CONFIG-44 | cadence-core/workflows/config.md | accurate | accurate | re-read at HEAD |
| CONFIG-45 | cadence-core/workflows/config.md | accurate | accurate | re-read at HEAD |
| CONFIG-46 | cadence-core/workflows/config.md | accurate | accurate | re-read at HEAD |
| CONFIG-REVIEW-01 | cadence-core/workflows/config-review.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| CONFIG-REVIEW-02 | cadence-core/workflows/config-review.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| CONFIG-REVIEW-03 | cadence-core/workflows/config-review.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| CONFIG-REVIEW-04 | cadence-core/workflows/config-review.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| CONFIG-REVIEW-05 | cadence-core/workflows/config-review.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| CONFIG-REVIEW-06 | cadence-core/workflows/config-review.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| CONFIG-REVIEW-07 | cadence-core/workflows/config-review.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| CONFIG-REVIEW-08 | cadence-core/workflows/config-review.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| CONFIG-REVIEW-09 | cadence-core/workflows/config-review.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| CONFIG-REVIEW-10 | cadence-core/workflows/config-review.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| CONTEXT-01 | cadence-core/workflows/context.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| CONTEXT-02 | cadence-core/workflows/context.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| CONTEXT-03 | cadence-core/workflows/context.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| CONTEXT-04 | cadence-core/workflows/context.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| CONTEXT-05 | cadence-core/workflows/context.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| CONTEXT-06 | cadence-core/workflows/context.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| CONTEXT-07 | cadence-core/workflows/context.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| CONTEXT-08 | cadence-core/workflows/context.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| CONTEXT-09 | cadence-core/workflows/context.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| CONTEXT-10 | cadence-core/workflows/context.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| CONTEXT-11 | cadence-core/workflows/context.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| CONTEXT-12 | cadence-core/workflows/context.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| CONTEXT-13 | cadence-core/workflows/context.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| CONTEXT-14 | cadence-core/workflows/context.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| CONTEXT-15 | cadence-core/workflows/context.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| CONTEXT-16 | cadence-core/workflows/context.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| CONTEXT-17 | cadence-core/workflows/context.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| COVERAGE-01 | cadence-core/workflows/coverage.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| COVERAGE-02 | cadence-core/workflows/coverage.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| COVERAGE-03 | cadence-core/workflows/coverage.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| COVERAGE-04 | cadence-core/workflows/coverage.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| COVERAGE-05 | cadence-core/workflows/coverage.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| COVERAGE-06 | cadence-core/workflows/coverage.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| COVERAGE-07 | cadence-core/workflows/coverage.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| COVERAGE-08 | cadence-core/workflows/coverage.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| DEBUG-01 | cadence-core/workflows/debug.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| DEBUG-02 | cadence-core/workflows/debug.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| DEBUG-03 | cadence-core/workflows/debug.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| DEBUG-04 | cadence-core/workflows/debug.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| DEBUG-05 | cadence-core/workflows/debug.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| DEBUG-06 | cadence-core/workflows/debug.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| DEBUG-07 | cadence-core/workflows/debug.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| DEBUG-08 | cadence-core/workflows/debug.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| DEBUG-09 | cadence-core/workflows/debug.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| DEBUG-10 | cadence-core/workflows/debug.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| DECISION-REVIEW-03 | cadence-core/workflows/decision-review.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| DECISION-REVIEW-04 | cadence-core/workflows/decision-review.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| DECISION-REVIEW-05 | cadence-core/workflows/decision-review.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| DECISION-REVIEW-06 | cadence-core/workflows/decision-review.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| DECISION-REVIEW-07 | cadence-core/workflows/decision-review.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| DECISION-REVIEW-08 | cadence-core/workflows/decision-review.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| DECISION-REVIEW-09 | cadence-core/workflows/decision-review.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| DECISION-REVIEW-10 | cadence-core/workflows/decision-review.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| DECISION-REVIEW-11 | cadence-core/workflows/decision-review.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| DOCS-VERIFY-01 | cadence-core/workflows/docs-verify.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| DOCS-VERIFY-02 | cadence-core/workflows/docs-verify.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| DOCS-VERIFY-03 | cadence-core/workflows/docs-verify.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| DOCS-VERIFY-04 | cadence-core/workflows/docs-verify.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| EXECUTE-04 | cadence-core/workflows/execute.md | accurate | accurate | re-read at HEAD |
| EXECUTE-05 | cadence-core/workflows/execute.md | accurate | accurate | re-read at HEAD |
| EXECUTE-06 | cadence-core/workflows/execute.md | accurate | accurate | re-read at HEAD |
| EXECUTE-07 | cadence-core/workflows/execute.md | accurate | accurate | re-read at HEAD |
| EXECUTE-08 | cadence-core/workflows/execute.md | accurate | accurate | re-read at HEAD |
| EXECUTE-09 | cadence-core/workflows/execute.md | accurate | accurate | re-read at HEAD |
| EXECUTE-10 | cadence-core/workflows/execute.md | accurate | accurate | re-read at HEAD |
| EXECUTE-11 | cadence-core/workflows/execute.md | accurate | accurate | re-read at HEAD |
| EXECUTE-12 | cadence-core/workflows/execute.md | accurate | accurate | re-read at HEAD |
| EXECUTE-13 | cadence-core/workflows/execute.md | accurate | accurate | re-read at HEAD |
| EXECUTE-14 | cadence-core/workflows/execute.md | accurate | accurate | re-read at HEAD |
| EXECUTE-15 | cadence-core/workflows/execute.md | accurate | accurate | re-read at HEAD |
| EXECUTE-16 | cadence-core/workflows/execute.md | accurate | accurate | re-read at HEAD |
| EXECUTE-17 | cadence-core/workflows/execute.md | accurate | accurate | re-read at HEAD |
| EXECUTE-18 | cadence-core/workflows/execute.md | accurate | accurate | re-read at HEAD |
| EXECUTE-19 | cadence-core/workflows/execute.md | accurate | accurate | re-read at HEAD |
| EXECUTE-20 | cadence-core/workflows/execute.md | accurate | accurate | re-read at HEAD |
| EXECUTE-21 | cadence-core/workflows/execute.md | accurate | accurate | re-read at HEAD |
| EXECUTE-22 | cadence-core/workflows/execute.md | accurate | accurate | re-read at HEAD |
| EXECUTE-23 | cadence-core/workflows/execute.md | accurate | accurate | re-read at HEAD |
| EXECUTE-24 | cadence-core/workflows/execute.md | accurate | accurate | re-read at HEAD |
| EXECUTE-25 | cadence-core/workflows/execute.md | accurate | accurate | re-read at HEAD |
| EXECUTE-26 | cadence-core/workflows/execute.md | accurate | accurate | re-read at HEAD |
| EXECUTE-27 | cadence-core/workflows/execute.md | accurate | accurate | re-read at HEAD |
| EXECUTE-28 | cadence-core/workflows/execute.md | accurate | accurate | re-read at HEAD |
| EXECUTE-29 | cadence-core/workflows/execute.md | accurate | accurate | re-read at HEAD |
| EXECUTE-30 | cadence-core/workflows/execute.md | accurate | accurate | re-read at HEAD |
| MILESTONE-01 | cadence-core/workflows/milestone.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| MILESTONE-02 | cadence-core/workflows/milestone.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| MILESTONE-03 | cadence-core/workflows/milestone.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| MILESTONE-04 | cadence-core/workflows/milestone.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| MILESTONE-05 | cadence-core/workflows/milestone.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| MILESTONE-06 | cadence-core/workflows/milestone.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| MILESTONE-07 | cadence-core/workflows/milestone.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| MILESTONE-08 | cadence-core/workflows/milestone.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| MILESTONE-09 | cadence-core/workflows/milestone.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| MILESTONE-10 | cadence-core/workflows/milestone.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| MILESTONE-11 | cadence-core/workflows/milestone.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| MILESTONE-12 | cadence-core/workflows/milestone.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| MILESTONE-13 | cadence-core/workflows/milestone.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| MILESTONE-14 | cadence-core/workflows/milestone.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| MILESTONE-15 | cadence-core/workflows/milestone.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| MILESTONE-16 | cadence-core/workflows/milestone.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| NEW-PROJECT-03 | cadence-core/workflows/new-project.md | accurate | accurate | re-read at HEAD |
| NEW-PROJECT-04 | cadence-core/workflows/new-project.md | accurate | accurate | re-read at HEAD |
| NEW-PROJECT-05 | cadence-core/workflows/new-project.md | accurate | accurate | re-read at HEAD |
| NEW-PROJECT-06 | cadence-core/workflows/new-project.md | accurate | accurate | re-read at HEAD |
| NEW-PROJECT-07 | cadence-core/workflows/new-project.md | accurate | accurate | re-read at HEAD |
| NEW-PROJECT-08 | cadence-core/workflows/new-project.md | accurate | accurate | re-read at HEAD |
| NEW-PROJECT-09 | cadence-core/workflows/new-project.md | accurate | accurate | re-read at HEAD |
| NEW-PROJECT-10 | cadence-core/workflows/new-project.md | accurate | accurate | re-read at HEAD |
| NEW-PROJECT-11 | cadence-core/workflows/new-project.md | accurate | accurate | re-read at HEAD |
| NEW-PROJECT-12 | cadence-core/workflows/new-project.md | accurate | accurate | re-read at HEAD |
| NEW-PROJECT-13 | cadence-core/workflows/new-project.md | accurate | accurate | re-read at HEAD |
| NEW-PROJECT-14 | cadence-core/workflows/new-project.md | accurate | accurate | re-read at HEAD |
| NEW-PROJECT-15 | cadence-core/workflows/new-project.md | accurate | accurate | re-read at HEAD |
| NEW-PROJECT-16 | cadence-core/workflows/new-project.md | accurate | accurate | re-read at HEAD |
| NEW-PROJECT-17 | cadence-core/workflows/new-project.md | accurate | accurate | re-read at HEAD |
| NEW-PROJECT-18 | cadence-core/workflows/new-project.md | accurate | accurate | re-read at HEAD |
| NEW-PROJECT-19 | cadence-core/workflows/new-project.md | accurate | accurate | re-read at HEAD |
| NEW-PROJECT-20 | cadence-core/workflows/new-project.md | accurate | accurate | re-read at HEAD |
| NEW-PROJECT-21 | cadence-core/workflows/new-project.md | accurate | accurate | re-read at HEAD |
| NEW-PROJECT-22 | cadence-core/workflows/new-project.md | accurate | accurate | re-read at HEAD |
| PHASE-01 | cadence-core/workflows/phase.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| PHASE-02 | cadence-core/workflows/phase.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| PHASE-03 | cadence-core/workflows/phase.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| PHASE-04 | cadence-core/workflows/phase.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| PHASE-05 | cadence-core/workflows/phase.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| PHASE-06 | cadence-core/workflows/phase.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| PHASE-07 | cadence-core/workflows/phase.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| PHASE-08 | cadence-core/workflows/phase.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| PHASE-09 | cadence-core/workflows/phase.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| PHASE-10 | cadence-core/workflows/phase.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| PHASE-11 | cadence-core/workflows/phase.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| PHASE-12 | cadence-core/workflows/phase.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| PHASE-13 | cadence-core/workflows/phase.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| PLAN-GAPS-01 | cadence-core/workflows/plan-gaps.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| PLAN-GAPS-02 | cadence-core/workflows/plan-gaps.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| PLAN-GAPS-03 | cadence-core/workflows/plan-gaps.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| PLAN-GAPS-04 | cadence-core/workflows/plan-gaps.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| PLAN-03 | cadence-core/workflows/plan.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| PLAN-04 | cadence-core/workflows/plan.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| PLAN-05 | cadence-core/workflows/plan.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| PLAN-06 | cadence-core/workflows/plan.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| PLAN-07 | cadence-core/workflows/plan.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| PLAN-08 | cadence-core/workflows/plan.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| PLAN-09 | cadence-core/workflows/plan.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| PLAN-10 | cadence-core/workflows/plan.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| PLAN-11 | cadence-core/workflows/plan.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| PLAN-12 | cadence-core/workflows/plan.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| PLAN-13 | cadence-core/workflows/plan.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| PLAN-14 | cadence-core/workflows/plan.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| PLAN-15 | cadence-core/workflows/plan.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| PLAN-16 | cadence-core/workflows/plan.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| PLAN-17 | cadence-core/workflows/plan.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| PLAN-18 | cadence-core/workflows/plan.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| PLAN-19 | cadence-core/workflows/plan.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| PLAN-20 | cadence-core/workflows/plan.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| PLAN-21 | cadence-core/workflows/plan.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| PLAN-22 | cadence-core/workflows/plan.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| PLAN-23 | cadence-core/workflows/plan.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| PLAN-24 | cadence-core/workflows/plan.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| PLAN-25 | cadence-core/workflows/plan.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| PLAN-26 | cadence-core/workflows/plan.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| PLAN-27 | cadence-core/workflows/plan.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| PLAN-28 | cadence-core/workflows/plan.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| PLAN-29 | cadence-core/workflows/plan.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| PLAN-30 | cadence-core/workflows/plan.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| PLAN-31 | cadence-core/workflows/plan.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| PLAN-32 | cadence-core/workflows/plan.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| PLAN-33 | cadence-core/workflows/plan.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| PROGRESS-02 | cadence-core/workflows/progress.md | accurate | accurate | re-read at HEAD |
| PROGRESS-03 | cadence-core/workflows/progress.md | accurate | accurate | re-read at HEAD |
| PROGRESS-04 | cadence-core/workflows/progress.md | accurate | accurate | re-read at HEAD |
| PROGRESS-05 | cadence-core/workflows/progress.md | accurate | accurate | re-read at HEAD |
| PROGRESS-06 | cadence-core/workflows/progress.md | accurate | accurate | re-read at HEAD |
| PROGRESS-07 | cadence-core/workflows/progress.md | accurate | accurate | re-read at HEAD |
| PROGRESS-08 | cadence-core/workflows/progress.md | accurate | accurate | re-read at HEAD |
| PROGRESS-09 | cadence-core/workflows/progress.md | accurate | accurate | re-read at HEAD |
| PROGRESS-10 | cadence-core/workflows/progress.md | accurate | accurate | re-read at HEAD |
| PROGRESS-11 | cadence-core/workflows/progress.md | accurate | accurate | re-read at HEAD |
| PROGRESS-12 | cadence-core/workflows/progress.md | accurate | accurate | re-read at HEAD |
| PROGRESS-13 | cadence-core/workflows/progress.md | accurate | accurate | re-read at HEAD |
| PROGRESS-14 | cadence-core/workflows/progress.md | accurate | accurate | re-read at HEAD |
| PROGRESS-15 | cadence-core/workflows/progress.md | accurate | accurate | re-read at HEAD |
| PROGRESS-16 | cadence-core/workflows/progress.md | accurate | accurate | re-read at HEAD |
| PROGRESS-17 | cadence-core/workflows/progress.md | accurate | accurate | re-read at HEAD |
| PROGRESS-18 | cadence-core/workflows/progress.md | accurate | accurate | re-read at HEAD |
| PROGRESS-19 | cadence-core/workflows/progress.md | accurate | accurate | re-read at HEAD |
| PROGRESS-20 | cadence-core/workflows/progress.md | accurate | accurate | re-read at HEAD |
| SPIKE-01 | cadence-core/workflows/spike.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| SPIKE-02 | cadence-core/workflows/spike.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| TASK-02 | cadence-core/workflows/task.md | accurate | accurate | re-read at HEAD |
| TASK-03 | cadence-core/workflows/task.md | accurate | accurate | re-read at HEAD |
| TASK-04 | cadence-core/workflows/task.md | accurate | accurate | re-read at HEAD |
| TASK-05 | cadence-core/workflows/task.md | accurate | accurate | re-read at HEAD |
| TASK-06 | cadence-core/workflows/task.md | accurate | accurate | re-read at HEAD |
| TASK-07 | cadence-core/workflows/task.md | accurate | accurate | re-read at HEAD |
| TASK-08 | cadence-core/workflows/task.md | accurate | accurate | re-read at HEAD |
| TASK-09 | cadence-core/workflows/task.md | accurate | accurate | re-read at HEAD |
| TASK-10 | cadence-core/workflows/task.md | accurate | accurate | re-read at HEAD |
| TASK-11 | cadence-core/workflows/task.md | accurate | accurate | re-read at HEAD |
| UNDO-01 | cadence-core/workflows/undo.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| UNDO-02 | cadence-core/workflows/undo.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| UNDO-03 | cadence-core/workflows/undo.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| UNDO-04 | cadence-core/workflows/undo.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| UNDO-05 | cadence-core/workflows/undo.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| UNDO-06 | cadence-core/workflows/undo.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| UNDO-07 | cadence-core/workflows/undo.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| UNDO-08 | cadence-core/workflows/undo.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| VERIFY-DEEP-01 | cadence-core/workflows/verify-deep.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| VERIFY-DEEP-02 | cadence-core/workflows/verify-deep.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| VERIFY-DEEP-03 | cadence-core/workflows/verify-deep.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| VERIFY-DEEP-04 | cadence-core/workflows/verify-deep.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| VERIFY-DEEP-05 | cadence-core/workflows/verify-deep.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| VERIFY-DEEP-06 | cadence-core/workflows/verify-deep.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| VERIFY-DEEP-07 | cadence-core/workflows/verify-deep.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| VERIFY-DEEP-08 | cadence-core/workflows/verify-deep.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| VERIFY-DEEP-09 | cadence-core/workflows/verify-deep.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| VERIFY-DEEP-10 | cadence-core/workflows/verify-deep.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| VERIFY-DEEP-11 | cadence-core/workflows/verify-deep.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| VERIFY-DEEP-12 | cadence-core/workflows/verify-deep.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| VERIFY-01 | cadence-core/workflows/verify.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| VERIFY-02 | cadence-core/workflows/verify.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| VERIFY-03 | cadence-core/workflows/verify.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| VERIFY-04 | cadence-core/workflows/verify.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| VERIFY-05 | cadence-core/workflows/verify.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| VERIFY-06 | cadence-core/workflows/verify.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| VERIFY-07 | cadence-core/workflows/verify.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| VERIFY-08 | cadence-core/workflows/verify.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| VERIFY-09 | cadence-core/workflows/verify.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| VERIFY-10 | cadence-core/workflows/verify.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| VERIFY-11 | cadence-core/workflows/verify.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| VERIFY-12 | cadence-core/workflows/verify.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| VERIFY-13 | cadence-core/workflows/verify.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| VERIFY-14 | cadence-core/workflows/verify.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| VERIFY-15 | cadence-core/workflows/verify.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| VERIFY-16 | cadence-core/workflows/verify.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| VERIFY-17 | cadence-core/workflows/verify.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| VERIFY-18 | cadence-core/workflows/verify.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| VERIFY-19 | cadence-core/workflows/verify.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| VERIFY-20 | cadence-core/workflows/verify.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| VERIFY-21 | cadence-core/workflows/verify.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| VERIFY-22 | cadence-core/workflows/verify.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| VERIFY-23 | cadence-core/workflows/verify.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| VERIFY-24 | cadence-core/workflows/verify.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| VERIFY-25 | cadence-core/workflows/verify.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| VERIFY-26 | cadence-core/workflows/verify.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| VERIFY-27 | cadence-core/workflows/verify.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| VERIFY-28 | cadence-core/workflows/verify.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| VERIFY-29 | cadence-core/workflows/verify.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| VERIFY-30 | cadence-core/workflows/verify.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| VERIFY-31 | cadence-core/workflows/verify.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| VERIFY-32 | cadence-core/workflows/verify.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| VERIFY-33 | cadence-core/workflows/verify.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| VERIFY-34 | cadence-core/workflows/verify.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| VERIFY-35 | cadence-core/workflows/verify.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| VERIFY-36 | cadence-core/workflows/verify.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| VERIFY-37 | cadence-core/workflows/verify.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| VERIFY-38 | cadence-core/workflows/verify.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| VERIFY-39 | cadence-core/workflows/verify.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| VERIFY-40 | cadence-core/workflows/verify.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| VERIFY-41 | cadence-core/workflows/verify.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| VERIFY-42 | cadence-core/workflows/verify.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| VERIFY-43 | cadence-core/workflows/verify.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| VERIFY-44 | cadence-core/workflows/verify.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| VERIFY-SWEEP-01 | cadence-core/workflows/verify-sweep.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| VERIFY-SWEEP-02 | cadence-core/workflows/verify-sweep.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| VERIFY-SWEEP-03 | cadence-core/workflows/verify-sweep.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| VERIFY-SWEEP-04 | cadence-core/workflows/verify-sweep.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| VERIFY-SWEEP-05 | cadence-core/workflows/verify-sweep.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
| VERIFY-SWEEP-06 | cadence-core/workflows/verify-sweep.md | accurate | accurate | doc and cited code byte-identical to `a6b8931` |
