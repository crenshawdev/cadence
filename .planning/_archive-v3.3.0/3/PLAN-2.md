---
phase: 3
plan: 2
requirements: [COR-01]
files:
  - cadence-core/bin/lib/planning-files.mjs
  - cadence-core/bin/planning-files.test.mjs
  - cadence-core/bin/planning.mjs
  - cadence-core/bin/planning.test.mjs
---

# Phase 3: The scan's correctness gaps close - Plan 2

## Goal

The `## Phases` and `## Active` scanners read the document's real section
instead of the fenced example the shipped templates themselves carry, and a
blank `--root` is refused by `detect-commands` and `detect-surfaces` exactly as
`debt-harvest` refuses it.

## Must be true when done

- `classifyPhaseList` run against the shipped `cadence-core/templates/ROADMAP.md`
  returns `no-section` instead of today's `live` with two phantom phases named
  `[Name]`.
- `classifyActiveSection` run against the shipped
  `cadence-core/templates/REQUIREMENTS.md` returns `ids: null` instead of
  today's `["[CAT]-01","[CAT]-02"]` plus three `active-non-id-bullet` issues,
  and `parseActiveIds` inherits that for free.
- A document carrying a fenced EXAMPLE section above a real one returns the
  REAL section's phases / ids - the shape that today makes the real phases
  invisible rather than merely joined.
- A fenced heading is ignored silently: the walk continues to the next unfenced
  occurrence and no new issue code is emitted for it.
- `node cadence-core/bin/planning.mjs detect-commands --root ""` and
  `detect-surfaces --root ""`, and the whitespace-only spellings, each return
  `{"ok":false,"reason":"bad-args"}`.
- `node --test cadence-core/bin/*.test.mjs` passes and
  `node cadence-core/bin/self-verify.mjs` reports no `unbudgeted-surface` and
  no `budget-overrun`.

## Context

CONTEXT.md D-10 (the fix must reach `parseRoadmapPhases`, which
`classifyPhaseList` delegates to and which takes the FIRST `## Phases`
occurrence - a fence-aware heading loop over a fence-blind parser still reads
the template's example block), D-11 (`## Active` gets the same fix;
`parseActiveIds` is a one-line delegate and inherits it), D-12 (a fenced
heading is IGNORED silently, never a new issue code - a new code would make
every project whose ROADMAP carries a formatting example report a problem it
does not have, matching `classifyAcceptanceCriteria`'s precedent at
`lib/planning-files.mjs:995-1009` with its rationale at `:1030-1037`), D-13 (the
two detect commands adopt `debt-harvest`'s EXACT predicate, trim clause
included), D-14 (the refusal is `fail('bad-args', ...)`, never the
`missing-flag-value` throw), D-15 (no registry change - `self-verify`'s
CONTRACTS table already declares `--root` for both).

Out of scope (D-02): the roadmap WRITE paths stay fence-blind this phase.
`setPhaseBox`, `cutPhaseDetail` and `cmdRenumber`'s list filter can still tick a
checkbox inside a code block, and that reader/writer divergence is accepted
deliberately rather than discovered later.

## Tasks

### Task 1: The `## Phases` scanners see fences

- **Files:** cadence-core/bin/lib/planning-files.mjs, cadence-core/bin/planning-files.test.mjs
- **Action:** Make `parseRoadmapPhases` and `classifyPhaseList` locate the
  `## Phases` heading and its canonical extent through the module's existing
  fence-aware `sectionSpan(lines, heading)` rather than the fence-blind
  `split(/^## Phases\s*$/m)` and the fence-blind heading loop they use today.
  `sectionSpan` is already exactly the combinator D-02 describes - it feeds one
  never-restarted `fenceScanner` over every line so the fence state at the
  heading is the state a reader of the whole document would have, and its own
  header states why a fence-blind start cannot be repaired by a fence-aware
  end - so reuse it rather than introducing a second one; a later fix to the
  write paths then has one call to make. Both functions must change together:
  `classifyPhaseList` delegates its canonical parse to `parseRoadmapPhases`, so
  a fence-aware heading loop over a fence-blind parser still reads the
  template's example block (D-10). Keep `parseRoadmapPhases`' `normalizeCrlf`
  entry - the roadmap's lone-CR carve-out is unrelated to fences and a
  lone-CR file must stay unparseable. `classifyPhaseList`'s CLASSIFICATION
  extent (heading to END OF TEXT, deliberately wider than the canonical bound)
  keeps its width but skips fenced lines, using a scanner started fresh at the
  heading exactly as `classifyAcceptanceCriteria` does at `:1038` and for the
  stated reason: the heading was matched outside a fence, so nothing is open
  there. No new issue code for a fenced heading and no issue for a phase token
  inside a fence (D-12). Note in the change that `sectionSpan` matches a
  heading by trimmed equality where the old test allowed trailing whitespace
  only, so a heading indented up to three spaces now matches - accepted, since
  CommonMark reads that as a heading and no shipped grammar document forbids
  it. Add regression tests that redden on the pre-fix code: the shipped
  `cadence-core/templates/ROADMAP.md` read from disk (today `live` with two
  phantom `[Name]` phases, after the fix `no-section`), and a fixture with a
  fenced example block ABOVE a real `## Phases` section, which today makes the
  real phases invisible.
- **Verify:** `node --test cadence-core/bin/planning-files.test.mjs` passes;
  a one-liner importing `classifyPhaseList` and calling it on
  `cadence-core/templates/ROADMAP.md` prints state `no-section` with an empty
  `phases` and empty `issues`; the same call on the pre-fix code prints `live`
  with two phases, so the new arms are falsifiable.

### Task 2: The `## Active` scanner sees fences

- **Files:** cadence-core/bin/lib/planning-files.mjs, cadence-core/bin/planning-files.test.mjs
- **Action:** Give `classifyActiveSection` the same treatment through
  `sectionSpan`: the heading is located outside fences and the section's end
  bound is fence-aware, so a fenced `## ` line inside the section can no longer
  end it early. The body walk between those bounds skips fenced lines, so a
  fenced example bullet neither declares an id nor raises an
  `active-prose-line`/`active-non-id-bullet` issue. The `elsewhere` computation
  that filters prose candidates already slices on `heading`/`end`, so it takes
  its bounds from the same span rather than recomputing them. `parseActiveIds`
  stays the one-line delegate it is (D-11) and inherits the fix; do not add a
  second id extraction beside it. No new issue code (D-12). Add regression
  tests that redden on the pre-fix code: the shipped
  `cadence-core/templates/REQUIREMENTS.md` read from disk (today
  `["[CAT]-01","[CAT]-02"]` with three `active-non-id-bullet` issues, after the
  fix `ids: null` with no issues, since its only `## Active` sits inside the
  fence opened at its template block), and a fixture with a fenced example
  `## Active` above a real one, asserted through both `classifyActiveSection`
  and `parseActiveIds` so the delegate is pinned as inheriting rather than
  diverging.
- **Verify:** `node --test cadence-core/bin/planning-files.test.mjs
  cadence-core/bin/planning.test.mjs` passes; a one-liner importing
  `parseActiveIds` and calling it on `cadence-core/templates/REQUIREMENTS.md`
  prints `null`, where the pre-fix code prints the two `[CAT]` ids.

### Task 3: `detect-commands` and `detect-surfaces` refuse a blank `--root`

- **Files:** cadence-core/bin/planning.mjs, cadence-core/bin/planning.test.mjs
- **Action:** Replace the `opts.root !== undefined && typeof opts.root !==
  'string'` guard on the `detect-commands` and `detect-surfaces` dispatch rows
  with `debt-harvest`'s EXACT predicate one row below them - `'root' in opts &&
  (typeof opts.root !== 'string' || opts.root.trim() === '')` - so an empty and
  a whitespace-only value are refused alongside a valueless flag, and so the
  root that reaches the command is the string form `debt-harvest` already
  passes. Measured 2026-08-14: both commands answer `ok:true` from cwd on
  `--root ""` today, and `--root "   "` answers `no-root` in one vocabulary
  where the other would answer `bad-args`. The refusal stays a
  `fail('bad-args', ...)` with each command's own message naming its flag
  (D-14): `planning.mjs` has ONE refusal vocabulary and three cross-referencing
  sites already state it, and the `missing-flag-value` throw
  `weight.mjs`/`self-verify.mjs` use belongs to seams with an `e.seam` catch arm
  this file does not have. No registry change (D-15) - `self-verify`'s CONTRACTS
  table already declares `--root` for both subcommands, and the fix is confined
  to the two dispatch rows and their comments. Add one test row per command per
  shape - valueless, empty string, whitespace-only - plus a control proving a
  real `--root <path>` still answers about that tree and not the cwd.
- **Verify:** `node --test cadence-core/bin/planning.test.mjs` passes;
  `node cadence-core/bin/planning.mjs detect-commands --root ""`,
  `... detect-commands --root "   "`, `... detect-surfaces --root ""` and
  `... detect-surfaces --root "   "` each print a line whose `ok` is `false`
  and whose `reason` is `bad-args`, matching what
  `node cadence-core/bin/planning.mjs debt-harvest --root ""` prints. Then,
  as this plan's closing AC5 gate: `node --test cadence-core/bin/*.test.mjs`
  passes and `node cadence-core/bin/self-verify.mjs` reports no
  `unbudgeted-surface` and no `budget-overrun` - when PLAN-1 has already
  landed, this run gates the integrated tree.

## Notes

- This plan is independent of PLAN-1 by file: PLAN-1 touches the git bins,
  `weight.mjs`, `self-verify.mjs` and the new `lib/` helper modules; this one
  touches `lib/planning-files.mjs` and `planning.mjs` and neither of their test
  files appears in the other plan. Neither plan's tasks depend on the other's
  output. PLAN-1's tree-wide census READS `planning.mjs` but does not write it,
  and `planning.mjs` defines none of the four censused helpers today.
- Tasks 1 and 2 both write `lib/planning-files.mjs` and its test file, so they
  are sequential inside this plan and were not split further.
- AC5 is a gate on this plan as well as PLAN-1: whichever lands second runs the
  full suite and `self-verify` over both changes.
- `weight-budgets.json` is untouched: this plan adds no prose surface (CONTEXT
  flagged assumption, phase 1 D-10).
