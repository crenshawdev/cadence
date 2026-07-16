---
phase: 1
status: complete
completed: 2026-07-16
---

# Phase 1: Recall engine - Summary

Project memory became queryable: a zero-dep, deterministic BM25 `recall`
subcommand on `planning.mjs` ranks item-level snippets from `.planning/`
artifacts (SUMMARY deviations, CAPTURE items, UAT findings, CONTEXT decisions),
honors `memory.backend`, and is drift-linted and tested like every other seam.

## What shipped

- `memory.backend` wired to a `builtin` default - `config.schema.json`,
  `templates/config.json`, this repo's `.planning/config.json`
- Corpus snippet parsers - `parseSummarySnippets`, `parseCaptureSnippets`,
  `parseContextDecisions` in `cadence-core/bin/lib/planning-files.mjs`
- BM25 ranking module (k1=1.2, b=0.75, no stemming, fixed stopword list) with
  reference-value tests - `cadence-core/bin/lib/bm25.mjs`, `bm25.test.mjs`
- `recall "<query>"` subcommand + `recall:[]` CONTRACTS entry -
  `cadence-core/bin/planning.mjs`, `self-verify.mjs`
- Recall integration tests (ranking, empty/absent corpus, determinism,
  backend-off) + extended `makeTree` fixture - `cadence-core/bin/planning.test.mjs`
- Prose corrected on the three surfaces that claimed only `none` was wired -
  `README.md`, `cadence-core/workflows/config.md`, `skills/cad-capture/SKILL.md`

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | 77cc5f6 | flip memory.backend default to builtin (schema + templates) |
| 1 | 2 | 105acd1 | recall corpus snippet parsers in planning-files.mjs |
| 1 | 3 | 1f2713f | BM25 ranking module with reference tests |
| 1 | 4 | 5a65b42 | recall subcommand - BM25 retrieval over .planning artifacts |
| 1 | 5 | d262ef7 | recall tests: ranking, empty corpus, determinism, backend-off |
| 1 | 6 | 4903856 | describe active builtin recall across the three prose surfaces |

## Deviations

- [process] Phase ran in the main context, not a spawned `cad-executor`
  subagent as `/cad-execute` intends. A `cad-executor` run crashed early in the
  session; the plan was hand-executed and hand-reviewed against CONTEXT's locked
  decisions instead. Same commits, same atomic-per-task discipline; no plan
  content changed. (Spans commits 77cc5f6-4903856.)
- [process] Execution split across two sittings by the sustained safety-classifier
  Bash outage. Tasks 1-3 committed before the outage; Tasks 4-6 were written to
  disk, held uncommitted through the outage (a `/cad-pause` was attempted but its
  WIP-commit and cursor-set steps both need Bash), then verified and committed as
  5a65b42/d262ef7/4903856 once Bash recovered. No work was lost.

## Open items

- None. Consumer injection (cad-context / planner / debug reading recall) is
  Phase 2 by design, not a gap; external backends are v2.

## Goal check

The six commits deliver the phase goal. Verified live, not just asserted:
`node cadence-core/bin/planning.mjs recall "recall engine bm25"` over this
repo's own `.planning/` prints one `ok:true` JSON line ranking the matching
CONTEXT decisions first with source and phase; two runs are byte-identical
(determinism confirmed by shell compare); `node --test` passes 142/142 with the
new BM25 and recall tests; `self-verify.mjs` exits `ok:true` with the `recall`
CONTRACTS entry. The three prose surfaces no longer claim only `none` is wired.
A human can now query project memory from the CLI; no skill consumes it yet,
which is exactly the Phase 1 boundary.
