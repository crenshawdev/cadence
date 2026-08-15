---
phase: 5
status: complete
completed: 2026-08-14
---

# Phase 5: What Cadence claims about itself is true - Summary

A second `/cad-docs-verify` run over 32 files and 743 claims, transcribed into a
`DOCS-CLAIMS.md` where all 933 rows carry a run number and a live line cite, plus
the four prose corrections and two derived assertions the sweep's findings named.

## What shipped

- Run-2 sweep, half A (four root docs + ten A-M workflow files, 371 claims:
  356 accurate, 6 stale, 9 unverifiable) - `.planning/phases/5/docs-verify-run-2-a.md`
- Run-2 sweep, half B (eleven N-Z workflows, the four workflows run 1 never swept,
  three unreferenced reference docs, and a targeted pass over the ten `.mjs` rows;
  372 claims) - `.planning/phases/5/docs-verify-run-2-b.md`
- The re-dated ledger: 933 rows, a generated `run` column on both tables, 261 line
  re-pins, 10 verdict flips, the seven `trace close` rows rewritten to the live
  call, and 385 post-run-1 claims filed including a `/cad-capture --cadence` row -
  `.planning/DOCS-CLAIMS.md`
- The surviving `REQ_ID` asymmetry stated where three surfaces used to claim a
  head-anchored limit `PRS-02` removed - `cadence-core/references/req-traceability.md:50`
  and `:151`, `cadence-core/templates/REQUIREMENTS.md:62-63`
- The `CADENCE_TEST_SEAM=1` sentinel named beside `CADENCE_PLUGIN_MANIFEST` -
  `cadence-core/references/acceptance-criteria.md:250`
- Two assertions that derive both sides from the tree: README's skill/role/rung-file
  counts, and that `PROJECT.md`'s `### Active` declares its milestone before naming
  any other version - `cadence-core/bin/prose-agreement.test.mjs`

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | 7c92cf9 | Open the run-2 half-A report with its surface and invocations pinned |
| 1 | 2 | 09a8d47 | Sweep invocation 1 - the four root docs (182 claim rows, 6 stale) |
| 1 | 3 | a00473a | Sweep invocation 2 - the ten A-M workflow files (0 stale) |
| 1 | 4 | b41821e | Close half A with its row count and the six stale rows |
| 2 | 1 | f9656e9 | Open the run-2 half-B report with its surface and invocations pinned |
| 2 | 2 | de9ef1a | Sweep invocation 3 - the eleven N-Z workflow files (215 rows, 3 stale) |
| 2 | 3 | 019f939 | Sweep invocation 4 - the four workflow files run 1 never swept (85 rows) |
| 2 | 4 | 3562143 | Sweep invocation 5 - the three reference docs no invocation named (62 rows) |
| 2 | 5 | 95cae80 | Verdict the ten ledgered `.mjs` rows at their cited sites |
| 2 | 6 | acd7389 | Close half B with its per-invocation counts and the six stale rows |
| 3 | 1 | d4b712d | Record run 2 in the ledger header with its five invocations and counts |
| 3 | 2 | f81c1d6 | Add the generated `run` column to both claim tables |
| 3 | 3 | 3ff1d60 | Re-verdict the seven rows phase 4's `trace close` invalidated |
| 3 | 4 | a829f39 | Re-pin every row whose doc moved since `a6b8931` (261 line cells) |
| 3 | 5 | d1ddfcf | Land run 2's verdicts and close the two re-pin lists (10 flips) |
| 3 | 6 | 417eec2 | File run 2's 385 new claims, including the `/cad-capture --cadence` row |
| 3 | 7 | 1a6642e | Close the ledger out consistent with itself |
| 4 | 1 | 3c21fb2 | State the surviving REQ-ID asymmetry in `req-traceability` |
| 4 | 2 | 48769e8 | Correct the REQ-ID note in the REQUIREMENTS template |
| 4 | 3 | 19d9965 | Name the test-seam sentinel beside the manifest override |
| 5 | 1 | e4ba4cc | Assert README's skill, role and rung-file counts against the tree |
| 5 | 2 | ba38c14 | Assert `PROJECT.md`'s Active milestone is the section's first version token |

## Deviations

- [deviation] Plan 3, tasks 2 and 7: the plan's verify commands (an `awk -F'|'`
  field count expecting one distinct value, and a `grep -cE` of the verdict
  vocabulary expected to equal the data-row count) never held on this file and did
  not hold before the plan touched it - 20 claim cells carry `\|`-escaped pipes, and
  `:185` states the vocabulary in prose, so the grep is +1 by construction. Verified
  instead by splitting on unescaped pipes: 933 rows, 9 fields each, every verdict
  cell in vocabulary. (`f81c1d6`, `1a6642e`)
- [deviation] Plan 3, task 4: the plan assumed the rows needing a human read were
  few. Measured, the `doc` + claim-text join matched only 358 of 548 rows, because
  run 2 was a fresh extraction that decomposed the same prose differently - 190 rows
  carried no run-2 claim with their text and 385 run-2 claims joined to nothing.
  Resolved inside the task with an IDF containment measure, validated against the
  256 strongly-joined rows (235 exact, 6 within six lines, 15 misses, every miss an
  "X exists" pointer claim), producing 55 re-pins with 11 hand-read overrides, 8
  hand-read orphans and 94 confirmed citations. Knock-on: task 6 filed 385 new rows
  rather than the ~85 invocation 4 alone would have. (`a829f39`, `417eec2`)
- [deviation] Plan 3, task 5: the plan had run 2's verdict imported onto every
  `run` 2 row. A row already resolved `corrected - <sha>` carries its
  pre-correction text by construction, so run 2's claim at that site is a different
  sentence and the import would overwrite a recorded correction with a verdict about
  words the row does not state. Those 20 rows are held out, keep run 1's verdict and
  read `1`; the rule and its one exception (`README-44`) are written into
  `## Reading this ledger`. (`d1ddfcf`)

## Open items

- Twelve stale claims the sweep found are recorded in the ledger but still stated
  falsely in the shipped docs - plan 4's lease covered only the four surfaces the
  roadmap named. The sharpest: three shipped surfaces (`README.md:56`,
  `cadence-core/workflows/plan.md:331`, and `:336` for `diff`) describe a `plan`
  gate that `route-table.json` does not resolve at the `shipped` default;
  `new-project.md:60-61` and `adopt.md:54-56` state verbatim that a written config
  turns "plan check and verifier on" while `workflow.plan_check` defaults to
  `false`; `config-catalog.md:51` publishes a `**Risk**` knob category with zero
  rows behind it and no `risk*` key left in `config.schema.json`; `recall.md:3-6`
  says two commands call `planning.mjs recall` when `plan.md:117` and `:182` make
  it three.
- The ledger's 385 newly-filed rows include an unknown number of near-duplicates of
  run-1 rows whose wording drifted. Deduplicating needs a claim-level identity the
  ledger does not have. A third cycle could cut it by having `/cad-docs-verify`
  emit the ledger id it re-verified when it recognises one.
- `cadence-core/bin/prose-agreement.test.mjs` spells the version-token grammar
  locally because `lib/branch-decision.mjs` exports neither `VERSION_RE` nor
  `DECLARED_VERSION_RE`, and D-07 forbade modifying that file. If the seam's grammar
  widens, the test's loose scan will not follow it.
- Eight ledger rows are orphans left at run 1's line, resolved `stale` +
  `divergence` rather than re-pinned, and 20 `corrected` rows deliberately still
  read run `1`. Both are recorded rules rather than unswept surface, but they are
  the rows a reader of criterion 1 would question.

## Goal check

The phase goal was that what Cadence claims about itself is true, and the sum of
these 22 commits delivers the measurement and the named edits but not the whole
claim. Five of the six roadmap criteria are met and independently checked here:
the three head-anchored `REQ_ID` surfaces now state the surviving asymmetry
(`req-traceability.md:50` and `:151`, `templates/REQUIREMENTS.md:62-63`, and
`grep -c "Known limit as of v1.4.0"` returns 0); `acceptance-criteria.md:250` names
`CADENCE_TEST_SEAM=1`; `/cad-capture --cadence` is discoverable at `COMMANDS.md:48`
and `README.md:124` and now carries a ledger row; both derived assertions live in
`prose-agreement.test.mjs` and `node cadence-core/bin/test.mjs prose` exits 0 at
225 pass / 0 fail, each having been shown to redden on a seeded wrong tree
(plan 5's report records the exact failure strings); `self-verify.mjs --root .`
reports `problems:[]` across 21 checks. Criterion 1 - every row verdicted this
cycle with no moved line cite - is met in substance at 933 rows with no `pending`
and no empty cell, with two honest qualifications already listed as open items:
eight orphan rows keep run 1's line under a `divergence` resolution, and 20
`corrected` rows deliberately read run `1` because importing a run-2 verdict onto
pre-correction text would misattribute it. What is missing is the gap between
measuring and fixing: the sweep found twelve stale claims, and plan 4's lease
covered four surfaces, so eight of them - including three that describe a review
gate the routing table does not resolve - remain stated falsely in shipped docs
with a dated `stale` row beside them. The claims are now true *about the ledger*
and dated; they are not yet all true *in the docs a user reads*, and phase 6's
voice pass runs over prose that still contains them.
