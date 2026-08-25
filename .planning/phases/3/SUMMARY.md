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
- The phase close stops filing open items into the transient queue - `summary` and `state` steps of `cadence-core/workflows/execute.md`
- The check that would have caught it - `cadence-core/bin/lib/capture-writers.mjs`, wired as self-verify check 23 (`capture-writers`)
- The capture contract names who may write the file - `## Who may write this file` in `cadence-core/references/capture-grammar.md`

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
| 3 | 1 | 312e8cbf | The phase close stops filing open items into the transient queue |
| 3 | 2 | d04e7605 | self-verify reports a prose surface that writes the transient queue |
| 3 | 3 | 61683a20 | The capture contract names who may write the file |
| 3 | (repair) | 59a8c728 | Re-pin plan.md's seam census at 14 - orchestrator, outside every plan's lease |

21 commits across two runs: plans 1-2 at `b157ccdc..0169ef62` (17), plan 3 at
`08100808..59a8c728` (4). Plan 3 was authored after the first run closed and
executed under `/cad-execute 3 --rerun`; that rerun re-executed nothing, since
plans 1 and 2 were already committed.

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
- **`risk-check status` cannot be brought to `ok:true` on this phase by any range.**
  The first run recorded this as a `--base/--head` scoping quirk with a workaround
  ("with plan 1's own range it returns `ok:true` and both plans `recorded`"). That
  workaround is FALSE on the tree as it now stands, re-checked 2026-08-25: `--plan 1
  --base b157ccdc --head 56d40eb9` returns `ok:false`, `missing:["1","1"]`, with plan 1
  listed TWICE - once `completed 1, records 2` and once `completed 0, records 2`. The
  count is the mechanism: plan 1's gate was re-armed, so its range carries TWO
  `risk_check` records (heads `57f71bd2` and `56d40eb9`) but only ONE counted
  completion, and a re-armed plan can therefore never satisfy the join. Plan 1's gate
  IS settled on the evidence - `rearm` and `gate_pass` (round 2) both present under
  corr `3-b157ccdc`, `ADJUDICATION-risk_surface-plan-1-r2.json` carrying `entries: []`,
  and `REVIEW-risk_surface-plan-1.md` carrying `findings: []`. No synthetic receipt was
  appended to silence the refusal, because that would erase the evidence of the defect.
  Plan 3's own row is `recorded` with `matches: []`.
- **CAPTURE.md holds 31 substantive bullets against a bound of 40** (`capture-check`
  after plan 3: Todos 21, Seeds 10, Notes 0, `over_bound: false`). Plan 3 removed the
  seven `(phase 3)` bullets its own close had copied out of `## Open items`, each proved
  present in this SUMMARY first; a Seed captured the same day (the `review-triggers.md`
  split) is the net difference from 30. The goal says CAPTURE "cannot accumulate" and
  the durable write is now gone, but nothing drained the pre-existing queue, so
  `/cad-phase done` will still report a non-empty one.
- ~~**`workflows/execute.md`'s summary step still routes open items into
  CAPTURE.md.**~~ RESOLVED by plan 3 task 1 (`312e8cbf`). `grep -c "capture --kind"
  cadence-core/workflows/execute.md` now returns 0; the `summary` step states that an
  open item lives in `phases/<N>/SUMMARY.md` and nowhere else, and the `state` step
  stages `.planning/CAPTURE.md` only when the debt harvest reported `written`.
- Five of this phase's new refusal tokens (`no-forge`, `no-cli`, `no-login`,
  `lookup-failed`, `incomplete-lookup`) are set in helper RETURNS and emitted through
  an interpolated `reason`, so `refusalSites` does not see them as sites and the token
  census cannot watch their spelling. Their hints ARE watched by self-verify check 22.
- `.planning/FILED.md` is declared in plan 1's lease and deliberately NOT created; the
  seam creates it with its own preamble on the first accepted filing.
- Six `jcrenshaw` hits survive outside tests and fixtures (`lib/redact-url.mjs:66`,
  `lib/forge-decision.mjs:139,140,227,228`, `self-verify.mjs:516`). All six are comment
  lines predating this phase; recorded as the pre-run baseline for task 8.
- **The capture-writer register carries FOUR live write sites, not the three plan 3's
  task 2 named.** `cadence-core/references/conventions.md:49` has its own
  `planning.mjs debt-harvest --root .` invocation beside the `CADENCE-DEBT` marker
  grammar. Registered with the same wholesale-rewrite reason. Proved by running the
  rule over the walked tree against an EMPTY row set: exactly four surfaces report, and
  zero report against the shipped register.
- **The capture-writer scan reads a write instruction in two shapes only** - an
  executed `planning.mjs <capture|debt-harvest>` and a shell redirect at
  `.planning/CAPTURE.md`. Prose instructing a hand write in English words alone
  ("append the item to CAPTURE.md") stays invisible. Declined deliberately in plan 3
  task 2 as the unbounded-grammar problem; the module header states the cost rather
  than the code chasing it.
- **`cadence-core/workflows/plan.md`'s seam census was left un-re-pinned by
  `08100808`**, which put the suite at 3214/3215 red from that hand commit until
  `59a8c728`. Neither `workflows/plan.md` nor `bin/seam-calls.test.mjs` was in any
  phase 3 plan's lease, so plan 3 halted `structural` on it and the repair was carried
  by the orchestrator. Worth noting as a pattern rather than a one-off: a hand commit
  that edits a censused prose surface has no gate reminding it to re-pin the row, and
  the cost lands on whatever plan runs next.

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

**Plan 3 (rerun, `08100808..59a8c728`).** The gap the paragraph above names as
outstanding is now closed, and it is the one the goal's second half turned on.
`workflows/execute.md`'s summary step no longer writes into the file this phase
declares transient: `grep -c "capture --kind" cadence-core/workflows/execute.md`
returns 0, the step now states that an open item lives in
`phases/<N>/SUMMARY.md` and nowhere else, and the `state` step stages
`.planning/CAPTURE.md` only when the debt harvest reported `written` (this run's
harvest answered `written: false`, so it was not staged). The reason is recorded
in the code rather than as a preference: `parseSummarySnippets`
(`lib/planning-files.mjs`) already indexes `## Open items` into the recall
corpus, and the measured pair is 42.4677 for the SUMMARY row against 31.1468 for
the CAPTURE duplicate on the same query. So "cannot accumulate" is now a
property of the tree and not only of a bound: the durable write is gone, and
`capture-check` answers `substantive: 31, bound: 40, over_bound: false` after
plan 3 removed the seven `(phase 3)` bullets its own close had copied out of
this file, each proved present here first.

What stops it returning silently is check 23. `lib/capture-writers.mjs` is a
pure rule over a frozen register, wired into `self-verify.mjs`'s per-surface
loop, and `self-verify.mjs` now reports `capture-writers` in its `checked` list
with `problems: []`. Its own test replays the retired `execute.md` block
verbatim from `0169ef62` and confirms it is reported against an empty row set -
so the check is proved to catch the exact defect that motivated it, not merely
to pass on a clean tree.

Two honest limits. The register carries four live write sites where the plan
named three (`references/conventions.md:49` was the fourth), and the scan reads
only two syntactic shapes, so prose instructing a hand write in English alone is
invisible - both recorded above as open items and stated in the module header.

The suite is green at 3215 tests / 3215 pass / 0 fail (`node
cadence-core/bin/test.mjs`) and `self-verify.mjs` reports `problems: []`.
Reaching that took one repair outside every plan's lease: `08100808`, a hand
commit, added the two `route.mjs resolve` blocks to `workflows/plan.md` without
re-pinning `seam-calls.test.mjs:125`, leaving the suite at 3214/3215 before this
rerun began. Plan 3 halted `structural` on it rather than editing outside its
lease, which is the contract working. The re-pin (`59a8c728`, 12 -> 14) carries
the measurement the row's own failure message demands: `git show 08100808 --
cadence-core/workflows/plan.md` shows both sites already instructed the resolve
in prose and already carried `--bracket-read` inline, so no round-trip was added
and only the spelling became literal.

Plan 3's `risk_surface` gate did not fire: `risk-check run --phase 3 --plan 3
--base 08100808 --head HEAD` answered `matches: []`, `inconclusive: false`.
`risk-check status` still refuses phase-wide on plan 1 of the first run, which
is the join defect recorded in the open items above and not a missing fire; no
synthetic receipt was written to clear it.

Nothing in this rerun touches the first half of the goal. CAP-01 is still not
demonstrated until plan 1 task 8 runs against a live forge, and verification
should treat it exactly as the paragraph above says.
