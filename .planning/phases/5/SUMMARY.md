---
phase: 5
status: complete
completed: 2026-08-15
---

# Phase 5: What Cadence claims about itself is true - Summary

A second `/cad-docs-verify` run over 32 files and 743 claims, transcribed into a
`DOCS-CLAIMS.md` where all 933 rows carry a run number and a live line cite, plus
the four prose corrections and two derived assertions the sweep's findings named -
then, after UAT refused the phase on the gap between measuring and fixing, the
fourteen stale claims themselves corrected at source across seven shipped surfaces
and closed in the ledger.

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
- The four budgeted plugin surfaces corrected: `plan.md`'s review step names the
  gate each stakes level resolves and what a `shipped` run does at the no-op,
  `new-project.md` and `adopt.md` report the copied config's real defaults (plan
  check off, verifier on), `config-catalog.md` drops the empty `Risk` category,
  and `recall.md` names all three callers at the step each calls it
- The three narrative docs corrected: `README.md:56` and `METHOD.md:309`/`:374`
  state the plan gate as advisory / off / adjudicated, `METHOD.md`'s commit
  protocol no longer asks the executor for a staged-diff risk check it never
  makes, and the v2.7.0-retired risk floor and `risk.override.<surface>` waivers
  are gone from `METHOD.md:420-427` and `INTERNALS.md:13`
- The ledger closed against both: 112 further line re-pins, and all fourteen rows
  re-read `corrected - <sha>` against the eight PLAN-6/PLAN-7 commits, with the
  census re-stated to 845 accurate / 42 corrected / 45 divergence / 1 retired

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
| 6 | 1 | 813f468 | Name the gate each stakes level resolves in `plan.md`'s review step |
| 6 | 2 | ee0199b | Report the config template's real plan-check default in both setup workflows |
| 6 | 3 | fdb2d69 | Drop the empty `Risk` knob category from the config catalog |
| 6 | 4 | 75b1d28 | Name all three callers of `planning.mjs recall` and the step each calls it at |
| 7 | 1 | 39583ba | Name the gate each stakes level resolves for the plan review in README |
| 7 | 2 | ffb16a4 | Make METHOD's two plan-gate sentences agree with its own trigger table |
| 7 | 3 | 1b4086f | Drop the staged-diff risk check from METHOD's commit protocol |
| 7 | 4 | fa0d4b4 | Retire the dispatch-time risk floor from METHOD and INTERNALS |
| 7 | 5 | 4c651fe | Re-pin the ledger cites this phase's gap edits moved |
| 7 | 6 | af72e6f | Close the fourteen rows this phase fixed at source and re-state the ledger's counts |

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
- [deviation] Plan 6, task 4: the task's verify asserts `grep -c "analyze"
  cadence-core/references/recall.md` returns 0. It cannot - three surviving lines
  match the substring through the live agent name (`recall.md:41`, `:44`, `:49`,
  `cad-assumptions-analyzer` and its payload), all true and outside the one
  paragraph the task scopes. Fixed the claim the criterion was written for and
  left the agent name intact: `grep -n "at .analyze" recall.md` is empty. (`75b1d28`)
- [deviation] Plan 7, task 5: the task asserts both that a doc's rows reproduce
  its per-hunk deltas and that a row opened at its cite shows its claim. For
  METHOD-88 the two conflict - its cite `158-159` straddles the commit-protocol
  hunk, so the mechanical delta yields `158-158`, half the claim. Pinned to its
  live location `157-158`, which is what the ledger's `:206-216` read rule is
  written to. (`4c651fe`)
- [deviation] Plan 7, task 5: five rows below a hunk were deliberately not
  shifted, because their cite is provenance rather than an address under the
  ledger's own rule at `:173-181` - four resolved `corrected - <sha>` (METHOD-01,
  METHOD-02, METHOD-04, CONFIG-02) and CONFIG-29 resolved `divergence`. The
  precedent is `a829f39`, which re-pinned 261 cells and no `corrected` row.
  (`4c651fe`)

## Open items

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

The phase goal was that what Cadence claims about itself is true, and after ten
further commits the sum of these 32 delivers it. The measurement half was already
met and is unchanged; what UAT refused - the gap between dating a stale claim and
fixing it - is now closed at source. All fourteen claims the sweep found stale are
corrected in the prose a user actually reads: `README.md:56` and `METHOD.md:309`
and `:374` now state the plan gate as advisory at `solo`, off at `shipped`,
adjudicated at `critical`, which is what `route-table.json:52` resolves;
`new-project.md` and `adopt.md` carry one byte-identical sentence reporting plan
check off and verifier on, matching `templates/config.json:6`;
`config-catalog.md`'s zero-row `**Risk**` header is deleted and `self-verify`
reports no `inert-config-key`; `recall.md` names three callers where `plan.md:117`
and `:182` make three; `METHOD.md`'s commit protocol no longer asks for a
staged-diff risk check the executor does not make; and the retired risk floor is
gone from `METHOD.md:420-427` and `INTERNALS.md:13`, where the single surviving
`risk.override` mention at `METHOD.md:422` is the sentence naming the v2.7.0 cut
rather than a live claim. The ledger closed against all of it:
`grep -ic "prose fix beyond this phase"` returns 0, every one of the fourteen rows
reads `corrected - <sha>` against a resolving commit, and the census re-states to
845 accurate / 42 corrected / 45 divergence / 1 retired = 933.
`node cadence-core/bin/test.mjs prose` exits 0 at 225 pass / 0 fail with every
edited file re-pinned in its own commit. What is left is smaller and named above
as open items rather than hidden: one paragraph at `METHOD.md:317-319` restating
the same gate defect one paragraph below the fix, a `plan.md:426` checkbox no
ledger row cites, the ledger's own run-2 arithmetic gone stale against its new
counts, and two transcription defects (INTERNALS-12, the CONFIG-CATALOG gate row)
that are ledger bugs rather than doc claims. None of those was in a lease this
phase held, and phase 6's voice pass runs over prose that no longer states a
falsehood about the gates.
