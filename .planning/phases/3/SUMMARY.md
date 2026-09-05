---
phase: 3
status: complete
completed: 2026-09-05
---

# Phase 3: The stakes key is gone and an interview replaces it - Summary

`stakes`, `route-table.json` and the cells grid are deleted; routing resolves
each role's model and effort from `roles.<role>.*` and the schema, and
`/cad-config --roles` asks thirteen questions in their place.

## What shipped

- **The level is gone from the resolver** - `route.mjs resolve` no longer emits
  `stakes` or `stakes_set`; gates, tiers, efforts and the deep-verify switch
  answer from `config.schema.json` defaults plus a two-effect risk floor.
- **`stakes` is a retired key** - `config.mjs` refuses it with a message naming
  v3.7.12 and pointing at `/cad-config --roles`; `config.mjs unset` can remove
  it from either layer (a new subcommand).
- **The routing data table is deleted** - `cadence-core/route-table.json` and
  `cadence-core/bin/lib/route-cells.mjs` no longer exist; self-verify's ladder
  checks read the schema.
- **The roles block is the routing source** - `roles.<role>.model` and
  `roles.<role>.effort` win over the legacy `model.overrides.*` and
  `model.effort.*`, which survive as narrower fallbacks.
- **The interview** - `/cad-config --roles` in `workflows/config.md`, reached
  from `COMMANDS.md` and `skills/cad-config/SKILL.md`: thirteen questions
  (twelve role values plus the risk floor) at four knobs per `AskUserQuestion`
  call, with catalog rows for all twelve `roles.*` keys.
- **The prose and the public docs** - 31 files swept, 45 `DOCS-CLAIMS.md` rows
  rewritten, `DESIGN.md` carries a dated superseding bullet and `CHANGELOG.md`'s
  `[Unreleased]` records the break.

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | 34de9d68 | state the rung ladder beside the map it orders |
| 1 | 2 | b275c82a | give the twelve review-trigger rows real defaults |
| 1 | 3 | 6d55fdfc | answer gates, tiers and efforts from the schema, cut the floor to two effects |
| 1 | 4 | 1f4436b9 | resolve model and effort from the roles block and the schema |
| 1 | 5 | b9e2f86f | stop the run record and the suggest ladders naming a level |
| 1 | 6 | 76e2b20f | stop route.mjs reading a routing table |
| 2 | 1 | 6250bca7 | re-key self-verify's ladder checks onto the map, delete the cells lib |
| 2 | 2 | 250b1ed2 | delete route-table.json and re-key its readers onto the schema |
| 2 | 3 | ff9542df | config.mjs can remove a key from one layer |
| 2 | 4 | 2e77b708 | retire stakes, re-point the retirement rail at the roles block |
| 2 | fix | d9bba3a3 | make the sentinel-gate test hermetic about the repo config layer |
| 2 | fix | 3e34b842 | the stakes retirement names v3.7.12, the version that ships it |
| 3 | 1 | 7bbc46cb | the thirteen questions land in the config workflow |
| 3 | 2 | 71bc9a12 | the init workflows ask, and the spawn seam states the new contract |
| 3 | 3 | 45d21e52 | the shipped prose and the comments stop describing a level |
| 3 | 4 | 64fac04c | the public docs, the design record and the ledger say what HEAD does |
| 3 | fix | 05e390d2 | hold the trace.mjs citation pin the level sweep shifted |

Range `6fcaba7a..05e390d2`, 17 commits. Suite 3751/3751, `self-verify ok:true`,
`npx tsc -p tsconfig.ci.json` clean.

## Deviations

**Five lease amendments, all the same defect.** The plans declared the files a
task EDITS but not the files that CITE what it deletes. Each was found by a
checker inside an executor dispatch, not at plan time, and each cost a full
re-dispatch. Approved by the user in turn:

- [deviation] plan-1: `references/seam-spawn-agent.md:251` named `route.mjs
  replay` in prose, so deleting its CONTRACTS row made self-verify report
  `unknown-subcommand`. File added to PLAN-1's lease; paragraph deleted in
  6d55fdfc. **This refutes CONTEXT D-14**, which is annotated in CONTEXT.md.
- [deviation] plan-1: `reason-census.test.mjs:104` held `'bad-table'` in a
  frozen `REASON_TOKENS` list, holding the suite at 3809/3811. File added to
  the lease; entry deleted alongside the failure it named in 76e2b20f.
- [deviation] plan-2: deleting `route-table.json` dangled `INTERNALS.md`'s
  citation, filing `missing-internals-path`. File added; corrected in 250b1ed2.
- [deviation] plan-2: deleting the schema's `stakes` row filed
  `unknown-reach-key` against `references/config-reach.md:106`. File added; the
  row deletion rode 2e77b708.
- [deviation] plan-2: `route.test.mjs:938` asserted a resolve over this repo's
  own `.planning/config.json` carries no `warnings`, and retiring `stakes` puts
  one there. File added; repaired hermetically in d9bba3a3.

Other deviations:

- [deviation] plan-1 task 5: `routeLadder` had a THIRD caller
  (`planning/risk-check.mjs:50`, `risk_surface_categories`) the Action did not
  name; an explicit key-to-row map closed it with nothing observable moved.
- [deviation] plan-2: the milestone was relabelled v4.0.0 -> v3.7.12 mid-phase,
  so PLAN-2's criterion naming `v4.0.0` is false on purpose. The shipped warning
  said "retired in v4.0.0" and needed the follow-up commit 3e34b842. Caught by
  the coordinator reading a resolve envelope, not by any gate.
- [deviation] plan-3 tasks 3 and 4: **the sweep keyed on the word `stakes`, and
  the level survives in prose that never spells it** - `review-triggers.md`
  carried a `Gate (solo/shipped/critical)` table under "The gate column is per
  LEVEL". Nine such sites inside the lease were rewritten in 64fac04c; four
  outside it are open items. The same false premise made the ledger sweep 45
  rows rather than the 13 the Action named.
- [deviation] plan-3 task 3: the two whole-tree sweep assertions print 14 and 3
  rather than 3 and 0. Every residual is a comment PLAN-1 or PLAN-2 wrote this
  phase recording the removal, plus three "table stakes" lines of ordinary
  English. Ruled stale arithmetic 2026-09-05; the `## Must be true when done`
  bullet was rewritten to the criterion that actually holds, naming all fifteen
  legitimate hits so a new one in any other file still fails it.
- [deviation] plan-3: task 3's commit grew a header comment by one line and
  pushed `TRACE_IGNORE_LINE` off the `DOCS-CLAIMS.md` pin at
  `planning/trace.mjs:245`, reddening `citation-census`. Repaired by reflowing
  the comment rather than re-pinning, since that census file is not in the lease.

## Open items

- **Four prose surfaces outside plan 3's lease still describe the level as
  current behaviour**: `references/plan-revision.md:11-12`,
  `references/execute-parallel.md:76-80`, `references/triage-gate.md:398`,
  `references/git-guard.md:125`. `DOCS-CLAIMS.md`'s `PLAN-26` is marked
  `stale | pending` against the first.
- Two `route.mjs` comments still read present-tense about the level (`:295`,
  `:329`), and `:179` says `model_aliases` "is going" rather than is gone.
- Five test-file comments still say "blocking at every stakes level":
  `risk-diff.test.mjs:415,1668,1878`, `planning-adjudication.test.mjs:293`, and
  a fixture AC string at `planning-files.test.mjs:1636`.
- `planning/risk-check.mjs:34-46` documents `surfaceVocabulary` as reading
  `route-table.json`, false since plan 1 task 5. Declared by no plan.
- `docs/figures/effort-ladder.svg` still renders "shipped project" inside the
  image; it cannot be re-rendered here. `docs/WORKFLOW.md`'s alt text no longer
  repeats the level name.
- `prose-agreement.test.mjs:2763` is not hermetic about `FORCE_COLOR`: with
  `FORCE_COLOR=3` a subprocess `console.log` of a number emits ANSI codes and
  the literal comparison fails. Pre-existing; reproduces against the unedited
  file. All runs this phase used `FORCE_COLOR=0`.
- Three `DOCS-CLAIMS.md` rows are wrong for reasons this phase did not create:
  `README-23` and `INTERNALS-12` claim `model.escalate_on_failure` is on by
  default (it is off), and `README-24` enumerates four gate values where the
  schema has five.
- No lint command exists for this project (`detect-commands` reports
  `lint: null`); `typecheck` ran clean before every commit.
- Two risk-surface findings were confirmed, downgraded and DECLINED to
  `.planning/DECLINED.md`: every config write re-serializes the whole layer, so
  an integer above 2^53 is silently rounded (pre-existing in `set`); and
  `unset a.b` cannot distinguish a literal dotted key from a nested path
  (unreachable - layers are nested and every face splits identically). A third,
  the `roles.<role>.effort` explicit-null fallthrough at `route.mjs:960`, was
  FILED on the tracker.

## Goal check

The goal is delivered, and each clause verifies against the tree rather than
against a report. The level: `route.mjs resolve` was run three times across this
phase and its envelope carries neither `stakes` nor `stakes_set` by the end,
where the first run carried both. The cells grid: `cadence-core/route-table.json`
and `cadence-core/bin/lib/route-cells.mjs` are absent from disk. The alias list:
`model_aliases` survives at two sites only, `route.mjs:179` (a comment recording
its removal) and a `planning-files.test.mjs:1629` fixture string. The interview:
`--roles` resolves in `workflows/config.md` (5 mentions),
`skills/cad-config/SKILL.md` (2) and `references/COMMANDS.md` (1), and
`config.md:280` and `:301` describe thirteen questions as twelve role values plus
the floor answer, at four knobs per call - arithmetic that closes. What is NOT
finished is the sweep's reach: plan 3's own deviation establishes that the level
lives in prose that never spells `stakes`, and four reference files plus seven
code and test comments outside any plan's lease still describe it as current
behaviour. Those are listed above and are prose defects in a shipping release,
not behavioural ones - the suite is 3751/3751 and self-verify is clean. The
interview itself is unexercised: it needs an interactive session and no run in
this phase drove it, so `/cad-verify 3` inherits it as the phase's central
human-verify item.
