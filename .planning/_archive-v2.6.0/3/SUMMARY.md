---
phase: 3
status: complete
completed: 2026-08-09
---

# Phase 3: Field friction - Summary

Five field-found defects closed: `--phase` now addresses the directory string the
caller typed at every seam, `status` reports every `phases/` entry outside a
numeric-only grammar, `trace ignore` keeps a scaffolded project's run record out
of git, `REQ_ID_EXACT` admits `2FA-01`, and a `CADENCE-DEBT` marker convention
plus a `debt-harvest` seam route deliberate corner-cuts into `.planning/CAPTURE.md`.

## What shipped

- `requirePhaseArg` - `cadence-core/bin/lib/require-int.mjs`, adopted at
  `cursor set`, `uat` (all five sub-subcommands), `plan-overlap`, `seed-reqs`,
  `lease-check`, `trace append`/`render`, and `route.mjs` (its local `PHASE_RE`
  deleted)
- `PHASE_DIR_NAME` + `phaseDirGrammarDrift` - `cadence-core/bin/planning.mjs`,
  wired into `cmdStatus`; the contradicting clause deleted from
  `references/conventions.md`, drift kind added to `workflows/progress.md` and
  `cad-health` check 5
- `trace ignore --root <path> [--check]` - `cadence-core/bin/planning.mjs`, called
  from `workflows/new-project.md:33` at scaffold and read-only from `cad-health`
  check 1
- `REQ_ID_EXACT` widened to
  `^(?:(?=[A-Z0-9]{2,8}-)[A-Z0-9]*[A-Z][A-Z0-9]*-\d+|#\d+)$` -
  `cadence-core/bin/lib/planning-files.mjs`; `REQ_ID_TOKEN` deliberately untouched
- The `CADENCE-DEBT` convention - new `## Deliberate shortcuts` in
  `references/conventions.md`, with the verifier exemption clause in `METHOD.md:221`
  and `skills/cad-verifier-contract/SKILL.md:104`
- `debt-harvest` - pure `cadence-core/bin/lib/debt-markers.mjs`
  (`debtMarkersIn`, `renderDebtSection`), `cmdDebtHarvest` in `planning.mjs`,
  `sectionBound` exported from `lib/planning-files.mjs`, call site at
  `workflows/execute.md`'s summary step

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | ab4bc32 | `--phase` carries the string the caller typed, at every shape site |
| 1 | 2 | 8ebbfe3 | state numeric-only as the phase-directory grammar and report violations |
| 1 | 3 | 452be5c | a project Cadence creates keeps its run record out of git |
| 1 | 4 | 92b34a5 | `REQ_ID_EXACT` admits a category that does not start with a letter |
| 1 | 5 | 3194a8e | state the `CADENCE-DEBT` marker convention and its verifier exemption |
| 1 | 6 | f056ab4 | `debt-harvest` collects `CADENCE-DEBT` markers into `CAPTURE.md` |
| 1 | 7 | (no commit) | AC7 gate evidence only; `self-verify.test.mjs` pins no `CONTRACTS` shape, so the task had no code change to make |

Range `b9d29f7..f056ab4`, six commits.

## Deviations

- [deviation] `route.test.mjs`'s shipped assertion `assert.equal(e.phase, 4)` became
  `'4'` - directed by the plan (the trace event now carries `.raw`), recorded because
  it edits a shipped assertion rather than adding a case. The cursor arm still
  records a Number and is unchanged. (ab4bc32)
- [deviation] `requirePhaseArg` reuses `CURSOR_SHAPE.decimal` INDIRECTLY, by
  delegating to `requireCursorNumber(raw, {decimal: true})`, rather than copying the
  regex to a third caller as the plan's wording implied. Same accept/refuse set. (ab4bc32)
- [deviation] Task 6 mutation A falsified its own fixture: removing the `.planning/`
  skip reddened nothing, because the harvest's rendered bullets contain no marker
  token and so it can never re-ingest itself through the section. What the skip
  actually protects is a planning DOC that writes a literal marker line while
  describing one. Fixture rebuilt (a tracked `.planning/phases/1/PLAN.md` quoting a
  marker) and the misleading comment corrected. (f056ab4)
- [deviation] Task 6 mutation D falsified its fixture TWICE before it pinned
  anything: the first put the fenced `## ` line in `## Todos` (the untouched prefix
  of the rewrite), the second indented it (`  ## build output`), invisible to
  `sectionBound`'s own `/^## /` test. The deciding fixture puts `## Debt markers`
  first holding a stale fenced block with `## build output` at column 0. (f056ab4)
- [deviation] Task 5: the `debt-harvest` `CONTRACTS` row had to land with the PROSE
  (task 5) rather than the implementation (task 6), because `self-verify` check 2
  lints prose invocations against the table. The intermediate commit therefore
  carries a row whose subcommand does not exist yet; no check verifies that
  direction. (3194a8e)
- [deviation] Risk-surface gate on task 1: no match, recorded per
  `review-triggers.md`'s "note each drop and why". `requirePhaseArg` admits only
  `^\d+(?:\.\d+)?$` after trim, so no admitted value carries a separator or `..`,
  and the flag is a local developer's own CLI argument.

## Open items

Filed by the executor (already in `.planning/CAPTURE.md`):

- Task 4's widening makes three prose surfaces FALSE, all outside the plan's file
  lease: `references/req-traceability.md:50`, `references/req-traceability.md:150`
  and `templates/REQUIREMENTS.md:63`. `self-verify` lints keys, invocations, paths
  and budgets, not semantic claims, so the tree is green with the false prose in
  place. Natural home is this cycle's doc phase.
- The `--phase` decimal spelling is still normalized away in exactly two places,
  both deliberate: `cmdSeedReqs`' Traceability rows (compared against ROADMAP phase
  numbers) and `cmdCursorSet`'s written value (`parseCursor` returns a Number that
  `renumber`, `cmdStatus`'s agreement test and `cursorPhase` all consume).

From the `diff` review (openai, adjudicated; gate `advisory`, so reported not fixed):

- **[high, live-verified] `replaceSection`'s START boundary is fence-blind, and it
  deletes user content.** `planning.mjs:2444` finds the owned heading with
  `lines.findIndex(l => l.trim() === heading)` with no fence state; `sectionBound`
  guards only the END. A `CAPTURE.md` whose `## Todos` holds a fenced example
  `## Debt markers` was rewritten from inside the fence and `## Notes` plus its
  bullet were DESTROYED, leaving the fence unclosed. Reproduced on a scratch repo
  today. Task 6's own D-12 comment claims this shape is covered; it is covered in
  one direction only.
- **[high, live-verified] `trace ignore` is non-idempotent, and reports `ignored`
  wrongly, when `trace.jsonl` is already TRACKED.** `git check-ignore` does not
  match a tracked path without `--no-index`, so `gitIgnoreState` returns no source
  and `cmdTraceIgnore` appends the comment+line again on every run. Verified: a repo
  with `.planning/trace.jsonl` in `.gitignore` and force-added grew three copies of
  the line across two runs, each reporting `ignored:false, tracked:true,
  written:true`. AC3's "edited by nothing" still holds for `/cad-health`, which uses
  `--check` - but the `ignored` field it reports is false in that state.
- **[medium, live-verified] `debtMarkersIn` loses the second marker on a line and
  corrupts the first.** `lib/debt-markers.mjs:64` takes `indexOf(MARKER_HEAD)` only,
  then parses EVERY later pipe field into that one marker. A line carrying two
  markers returned one entry whose text was `first` and whose ceiling/trigger were
  `c2`/`t2` - the second marker's. Either scan all matches or refuse the shape.
- **[low] `PHASE_DIR_NAME` accepts a zero-padded sub-phase while its own diagnostic
  says "no zero-padding".** `/^[1-9]\d*(?:\.\d+)?$/` returns true for `1.01`, `1.00`
  and `2.0` (checked), so `phases/1.01` is silently legal. The strict form is
  `(?:\.[1-9]\d*)?`.
- **[low, live-verified] `debt-harvest` follows tracked symlinks out of the tree.**
  `planning.mjs:2490` uses `statSync`/`readFileSync`, so a tracked `src/link.js ->
  /tmp/outside-debt.js` put the external marker in `CAPTURE.md` as `src/link.js:1`.
  `lstatSync` plus a skip, or a resolved-path-under-root check.

Killed at adjudication, recorded so they are not re-raised: the reviewer's
"`status` omits stray FILES" finding is plan-sanctioned (`PLAN.md:197` states it and
`PLAN.md:235` pins it), and its "`segs.includes('.planning')` is over-broad" finding
is the deliberate, documented direction - a nested `.planning/` is also Cadence
output.

`.planning/CAPTURE.md` is gitignored (`.gitignore:23`), so these filings live on
disk only and are not in the docs commit.

## Goal check

The six commits plausibly deliver the phase goal, with one AC only partly
discharged. Every claim below was checked in this tree, not read off the report.
AC1 holds: `lease-check --phase 1.10 --plan 1` answers
`no PLAN-1.md or PLAN.md under .planning/phases/1.10` and `uat status --phase 08`
answers `.planning/phases/08/UAT.md not found`, so both address the spelling rather
than `1.1` and `8`. AC2 holds in the negative direction that matters here:
`planning.mjs status` on this repo returns `drift: undefined`, and
`references/conventions.md` now states the grammar with the permitting clause gone
(8ebbfe3). AC4 holds: `isRequirementId` returns true for `2FA-01` and false for
`14-01`, `08-02` and `2026-08`. AC5 holds - `debt-harvest --root .` writes the
`## Debt markers` section and a second run reports `written:false` - and my own
scratch runs collected real markers into it. The whole suite is green at 1425/1425
(`node --test cadence-core/bin/*.test.mjs`), which is the executor's claimed number
independently reproduced. AC3 is the partial one: the scaffold arm is proved
(executor transcript, and `workflows/new-project.md:33` carries the call), but the
"an existing project whose trace is tracked or unignored is REPORTED" half reports a
FALSE `ignored:false` when the line is present and the file is tracked, which is the
second high open item above. Task 7 shipping no commit is honest rather than a gap:
`self-verify.test.mjs` pins no `CONTRACTS` shape, so there was nothing for it to
add. The three prose surfaces task 4 falsified are real debt this phase created and
deliberately left, and they are the strongest argument for the doc phase that
follows.
