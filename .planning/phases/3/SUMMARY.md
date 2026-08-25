---
phase: 3
status: partial
completed: 2026-08-25
---

# Phase 3: CAPTURE is transient - Summary

A gate that declines to fix a finding now files it on the repository's own forge in
that same step (`bin/issue-filing.mjs`, one pinned argv row per forge), and
`.planning/CAPTURE.md` gained a configured bound, a `capture-check` reading and a
phase-close assertion that the queue is empty rather than a roll-out that empties it.

## What shipped

- The unfixed set and the `(file, claim)` fingerprint - `cadence-core/bin/lib/filing-decision.mjs`
- The filing seam, `unfixed` and `file`, one `mergeLayers` callsite for both faces - `cadence-core/bin/issue-filing.mjs`
- One pinned create and lookup argv per forge, `DECLINE_LABEL = 'cadence-declined'` - `FILING_TABLE` in `cadence-core/bin/lib/filing-decision.mjs`
- A filed finding stays reachable by recall - `parseFiledRows`/`appendFiledRow` in `cadence-core/bin/lib/planning-files.mjs`, walked last by recall
- The gate asks once, in the step that decided - `## What happens to a finding this fire will not fix` in `cadence-core/references/triage-gate.md`
- The refusal vocabulary pinned forward, 82 literal tokens asserted by containment - `cadence-core/bin/reason-census.test.mjs`
- What the walked queue holds, as a pure reading - `cadence-core/bin/lib/capture-health.mjs`
- One command the health walk and the close both read - `cadence-core/bin/planning/capture-check.mjs`
- A configured bound that fails loud and refuses nothing - `planning.max_capture_bullets` (int, min 1, default 40)
- The close ASSERTS the queue is empty - `capture` field on `cmdPhaseDone`'s close arm, `cadence-core/bin/planning/phase-done.mjs:112-128`
- `/cad-health` prints the verdict - `skills/cad-health/SKILL.md`
- `## Archive` left the capture contract - `cadence-core/references/capture-grammar.md`

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | 6c539751 | The unfixed set and the (file, claim) fingerprint |
| 1 | 2 | d65604b6 | One pinned create and lookup vector per forge |
| 1 | 3 | 99ca9e4b | The seam that asks the tracker once and writes what it is told |
| 1 | 4 | 2e70b0d1 | A filed finding stays reachable by recall |
| 1 | (fix) | 922d9353 | The no-forge hint names a setup step that exists |
| 1 | 5 | 5ffb9040 | The gate asks once, in the step that decided |
| 1 | 6 | 33099d75 | The tree stops claiming glab is absent |
| 1 | 7 | 57f71bd2 | The refusal vocabulary is pinned forward |
| 1 | 8 | - | DEFERRED - live forge proof, human-verify |
| 1 | gate | a644e6d8 | Redact the payload path in both readPayload refusal arms |
| 1 | gate | cb2eb2a9 | Surface the mirror result on the create-failed envelope |
| 1 | gate | 56d40eb9 | Tell the truth about an ambiguous create in the retry hint |
| 2 | 1 | e4336f55 | What the walked queue actually holds, as a pure reading |
| 2 | 2 | eae3a002 | One command the health walk and the close both read |
| 2 | 3 | a6b5675d | A configured bound that fails loud and refuses nothing |
| 2 | 4 | 87b157d5 | The close asserts the queue is empty |
| 2 | 5 | b4c857b2 | /cad-health prints the verdict |
| 2 | 6 | 0169ef62 | `## Archive` leaves the capture contract |

17 commits, `b157ccdc..0169ef62`.

## Deviations

- [deviation] Plan 1 task 7 asserted the refusal-token list ships as a REGISTERED
  census - a `CADENCE-CENSUS` marker plus a `CENSUSES` row with subjects
  `cadence-core/bin/`. `cadence-core/bin/planning-lease-check.test.mjs:700` bounds
  any registry entry at half this repository's own plans; measured on the live
  corpus, 45 plans declare under `cadence-core/bin/` so the line is 22.5, and that
  subject refuses 44 of 45 while the narrowest honest alternative still refuses 26.
  That rail's own message says a rail that fires wrong is deleted, not tuned, so
  task 7's `Verify:` contradicted itself. The user decided: drop the marker and the
  row, keep the forward-assertion test, and state in its header why it is not a
  registered census. `57f71bd2`, and PLAN-2 inherits no lease tax from it.
- [deviation] Plan 1 task 7 asks for the derived count in the test's header. The
  first run recorded 256 sites / 99 distinct / 82 literal / 17 expressions;
  re-derived on the live tree it is 266 / 104 / 82 / 22 across 46 files. The gap is
  this phase's own `bin/issue-filing.mjs` - 10 sites, 5 new distinct tokens, all in
  the expression class. Corrected in the header. `57f71bd2`.

## Open items

- **Plan 1 task 8 is DEFERRED, by the user's decision.** The live proof against
  `tea`, `gh` and `glab` on three operator-owned scratch repos - one run driven by a
  real `blocking` fire - never ran. `glab` reports no token found; `tea` and `gh` are
  authenticated. The procedure, the exact per-forge argv at this commit, a
  reproducible five-finding payload generator and empty result fields are at
  `.planning/phases/3/live-forge-check.md`, uncommitted. Until it runs, every argv in
  `FILING_TABLE` is proved against PATH-injected stubs only, and the ROADMAP's open
  question - whether the decline label must pre-exist or the forge creates it on the
  create call - is still open.
- **This repository cannot run the path this phase just built.** `git.forge_provider`
  and `git.forge_repo` are unset, so `issue-filing.mjs unfixed` returns
  `{"ok":false,"reason":"no-forge"}`. That refusal fired for real during this run:
  the plan-2 `risk_surface` fire produced one downgraded finding, and the ask that
  should have offered to file it could not be made.
- **The downgraded finding, still in hand and unfiled.** `phase-done.mjs:127` - the
  phase-close queue assertion reads CAPTURE.md unlocked and BEFORE `runTransition`, so
  a writer appending in that window is not seen. Downgraded from `high` because the
  field gates nothing (`phase-done.mjs:116-117`: a non-empty queue is "a named problem
  and never a refusal"), the raced entry stays in CAPTURE.md, and the next
  `capture-check` reads it. Full record at
  `.planning/phases/3/ADJUDICATION-risk_surface-plan-2.json`.
- **`risk-check status` scopes `--base/--head` phase-wide, not per plan.** With
  `--plan 2 --base 56d40eb9 --head 0169ef62` it evaluates plan 1 against plan 2's range
  and reports plan 1 `unfired`, `ok:false`, `missing:["1"]`; with plan 1's own range it
  returns `ok:true` and both plans `recorded`. Both plans really are settled - the
  refusal is the flag scope, not a missing fire.
- **CAPTURE.md holds 30 substantive bullets against a bound of 40** (`capture-check`
  on this tree: Todos 21, Seeds 9, Notes 0). The goal says CAPTURE "cannot accumulate";
  the machinery to stop it accumulating shipped, but nothing drained what is already
  there, so `/cad-phase done` will report a non-empty queue.
- **`workflows/execute.md`'s summary step still routes open items into CAPTURE.md.**
  It is not in either plan's lease and was not changed, so the workflow that closes a
  phase still writes durably into the file this phase declared transient.
- Five of this phase's new refusal tokens (`no-forge`, `no-cli`, `no-login`,
  `lookup-failed`, `incomplete-lookup`) are set in helper RETURNS and emitted through
  an interpolated `reason`, so `refusalSites` does not see them as sites and the token
  census cannot watch their spelling. Their hints ARE watched by self-verify check 22.
- `.planning/FILED.md` is declared in plan 1's lease and deliberately NOT created; the
  seam creates it with its own preamble on the first accepted filing.
- Six `jcrenshaw` hits survive outside tests and fixtures (`lib/redact-url.mjs:66`,
  `lib/forge-decision.mjs:139,140,227,228`, `self-verify.mjs:516`). All six are comment
  lines predating this phase; recorded as the pre-run baseline for task 8.

## Goal check

The goal has two halves and the commits deliver one of them outright and the other
only as machinery. The first half - a finding leaves at the moment a gate declines to
fix it - is built and wired: `references/triage-gate.md` now carries
`## What happens to a finding this fire will not fix`, with both the blocking and
adjudicated arms pointing at it, and `bin/issue-filing.mjs` implements the two calls it
names (`grep -n "per finding"` returns one line, and it forbids the per-finding prompt
rather than instructing it). What is NOT proved is that a real gate reaches that ask:
plan 1 task 8, the one step that would have shown it, is deferred, and this run is
itself the counter-example - the plan-2 `risk_surface` fire produced a finding it would
not fix, reached `issue-filing.mjs unfixed`, and got
`{"ok":false,"reason":"no-forge"}` because this repository never answered the forge
setup step. So the seam is proved against stubs and refused on the one live call it
got. The second half - CAPTURE holds only the phase in flight and cannot accumulate -
is delivered as enforcement, not as a state: `planning.max_capture_bullets` (default
40) has one reader, `planning/capture-check.mjs` reports the crossing at exit 0 rather
than refusing, `cmdPhaseDone` carries a `capture` field read before the transition
(`phase-done.mjs:128`) and `capture-grammar.md` now says `## Archive` is not part of the
file. But `capture-check` on this tree answers `substantive: 30, bound: 40,
over_bound: false` - thirty bullets are sitting in the file the phase calls transient,
nothing in this phase drains them, and `workflows/execute.md`'s own summary step (in
neither plan's lease, unchanged) still writes open items into it. The suite is green at
3199 pass / 0 fail with `npx tsc -p tsconfig.ci.json` at exit 0 and
`self-verify.mjs` problems `[]`, and the `risk_surface` gate blocked once on plan 1 and
was cleared by three fixes with a narrowed second round returning zero findings
(`ADJUDICATION-risk_surface-plan-1.json`, `-r2.json`). Verification should not treat
CAP-01 as demonstrated until task 8 runs.
