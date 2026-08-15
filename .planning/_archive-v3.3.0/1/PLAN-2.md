---
phase: 1
plan: 2
requirements: [CAP-01]
files:
  - cadence-core/bin/lib/planning-files.mjs
  - cadence-core/bin/planning-files.test.mjs
  - cadence-core/bin/lib/capture-file.mjs
  - cadence-core/bin/planning.mjs
  - cadence-core/bin/planning.test.mjs
  - cadence-core/bin/self-verify.mjs
  - cadence-core/bin/self-verify.test.mjs
  - cadence-core/bin/weight-budgets.json
  - cadence-core/references/capture-grammar.md
  - skills/cad-health/SKILL.md
---

# Phase 1: The capture queue stops dropping filed work - Plan 2

## Goal

The phase-tag reader admits every shape the queue actually contains, that
grammar is written down once and pinned by a test row per shape, and
`/cad-health` names every `CAPTURE.md` section the recall walk does not visit
with its bullet count - so a bullet filed outside the walk is reported instead
of silent.

## Must be true when done

- `parseCaptureSnippets` emits `phase: N` for `(phase N)`, `(v3.2.0 phase N)`
  and `(phase N, <label>)`, including the combined form, and for decimal phase
  numbers.
- A bullet whose leading parenthetical is a non-phase label - `(cadence-wide)`,
  `(tooling)`, `(v3.2.0 close)` - keeps that label in its indexed text and gets
  no `phase` field.
- `cadence-core/references/capture-grammar.md` lists every admitted shape and
  every out-of-grammar shape, and every claim in it is pinned by a row in a
  table in `cadence-core/bin/planning-files.test.mjs`.
- `planning.mjs capture-sections` run against this repo names `Todos`, `Seeds`
  and `Notes` as in-walk and `Archive` and `Debt markers` as out-of-walk, each
  with its bullet count, with no allowlist anywhere in the path.
- Appending a bullet to an out-of-walk section raises that section's reported
  count on the next run.
- `/cad-health` prints those out-of-walk sections and counts on every run
  against a project that has a `CAPTURE.md`.
- `node --test cadence-core/bin/*.test.mjs` passes and
  `node cadence-core/bin/self-verify.mjs` reports no `unbudgeted-surface`, no
  `budget-overrun` and no `unknown-subcommand`.

## Context

Runs AFTER PLAN-1 - not independent of it: both plans add a subcommand to
`COMMANDS` in `planning.mjs`, a row to `CONTRACTS` in `self-verify.mjs`, rows to
`weight-budgets.json` and tests to `planning.test.mjs`, and task 3 below edits
the module PLAN-1 creates.

Locked: D-04 (criterion 2 is met by widening the READER, with the grammar
written down and a test row per shape - not by narrowing the writer; 45 bullets
already inside the walk carry a leading parenthetical the reader drops, so a
writer-only narrowing leaves them wrong), D-05 (a leading parenthetical that is
NOT a phase tag is content and survives into the indexed text - the widening may
not be a greedy `^\([^)]*\)` strip; 24 bullets carry `(cadence-wide)` or
`(tooling)` as their only scope marker and `parseCaptureSnippets` feeds BM25
directly), D-06 (the out-of-walk report is an unconditional per-section count
with NO allowlist - an `Archive` + `Debt markers` allowlist would have reported
nothing on the incident that motivated this phase, since all five lost bullets
sat under `## Archive`), D-07 (the check ships as a standalone subcommand
`/cad-health` calls beside `status`, NOT as a new drift kind inside `cmdStatus`,
whose `no-planning-dir` / `no-roadmap` / `unparseable-roadmap` early returns fire
before any drift is computed - so folding it in starves exactly the trees most
likely to have a mangled `CAPTURE.md`), D-03 (`## Archive` and `## Debt markers`
stay OUT of the walk; widening it would re-admit 185 deliberately retired
bullets into the BM25 corpus and undo v2.6.0 phase 1 in full), D-10 (a prose
surface this phase grows carries its `weight-budgets.json` row in the same work,
and a NEW surface needs a row or it fires `unbudgeted-surface`).

Existing pieces to follow: `cadence-core/references/roadmap-phases.md` is the
shape precedent for a written grammar, and `PHASE_LIST_ROWS` in
`cadence-core/bin/planning-files.test.mjs` with its row loop is the shape
precedent for one test per stated row. Live baseline measured 2026-08-14 -
`## Todos` 180, `## Seeds` 6, `## Notes` 3, `## Archive` 185, `## Debt markers`
1.

Out of scope: BM25 scoring or ranking changes, promoting any archived bullet
back into the live queue, and what `/cad-plan` does with a recall result.

## Tasks

### Task 1: Widen the phase-tag reader to the shapes the queue contains

- **Files:** cadence-core/bin/lib/planning-files.mjs
- **Action:** In `parseCaptureSnippets`, replace the single `(phase N)` strip
  with one anchored pattern admitting four shapes and nothing more: `(phase N)`,
  `(vX.Y.Z phase N)`, `(phase N, <label>)` and their combination
  `(vX.Y.Z phase N, <label>)`, where the version prefix is a `v` followed by
  dot-separated digits, `N` is an integer or a decimal `N.M` (decimals are
  already legal and must stay so), and the label is the remainder after a comma
  up to the closing paren. The pattern stays anchored at the head of the bullet
  text AFTER the checkbox strip - the existing order, which a checked box used to
  block - and it must NOT be widened to a greedy `^\([^)]*\)` (D-05): a
  parenthetical that does not match this pattern is CONTENT, left byte-identical
  in the indexed text with no `phase` emitted, because 24 live bullets carry
  `(cadence-wide)` or `(tooling)` as their only scope marker and this function
  feeds BM25 directly. An ADMITTED tag is stripped whole, tag and trailing space,
  as `(phase N)` already is - so the version token and the label leave the indexed
  text when they ride inside a real tag. Say that cost in the function's comment
  rather than inventing a partial-strip rule that would have to synthesize text:
  the phase FIELD is what recall renders and what a planner filters on, and 32
  bullets trading a version token in their body for a correct phase field is the
  trade this decision makes. Also state in the comment that the grammar's prose
  home is `cadence-core/references/capture-grammar.md` and its row table is in
  `planning-files.test.mjs`, the same way this file already points
  `parseRoadmapPhases` at `references/roadmap-phases.md`.
- **Verify:** In a node one-liner importing `parseCaptureSnippets`, a fixture
  with the six live shapes - `(phase 2)`, `(v3.2.0 phase 1)`,
  `(phase 3, docs)`, `(v3.2.0 phase 1, docs)`, `(cadence-wide)`, `(tooling)` -
  yields `phase` 2, 1, 3, 1 for the first four with the tag gone from each text,
  and no `phase` for the last two with `(cadence-wide)` / `(tooling)` still
  present in their text. `node --test cadence-core/bin/planning-files.test.mjs`
  and `node --test cadence-core/bin/planning.test.mjs` still pass.

### Task 2: One test row per stated shape

- **Files:** cadence-core/bin/planning-files.test.mjs
- **Action:** Add a row table for the capture phase-tag grammar in the same shape
  as the existing `PHASE_LIST_ROWS` table and its row loop - a named row per
  shape, one `test()` per row from a single loop, so a shape stated in prose and
  a shape asserted in code cannot diverge. Rows for every ADMITTED shape:
  `(phase N)`, decimal `(phase N.M)`, `(v3.2.0 phase N)`, `(phase N, label)`,
  `(v3.2.0 phase N, label)`, and each of those behind an unchecked and a checked
  box (the checked one also carrying the `[closed] ` text prefix that already
  ships). Rows for every OUT-OF-GRAMMAR shape, each asserting no `phase` and the
  parenthetical still in the text: `(cadence-wide)`, `(tooling)`,
  `(v3.2.0 close)`, `(Phase 2)` capitalized, `(phase)` with no number,
  `(phase two)` non-numeric, a parenthetical that is not at the head, and an
  unclosed `(phase 2`. Each row asserts the emitted `phase` (or its absence) AND
  the emitted text, because a rule that gets the phase right while eating content
  is the D-05 failure and a phase-only assertion cannot see it.
- **Verify:** `node --test cadence-core/bin/planning-files.test.mjs` passes with
  one test per row. Reverting task 1's pattern to the old `(phase N)`-only strip
  turns the `(v3.2.0 phase N)` and `(phase N, label)` rows RED and leaves the
  `(cadence-wide)` / `(tooling)` rows green (revert back after checking) - the
  table is what proves the widening did something and did not overreach.

### Task 3: Write the grammar down

- **Files:** cadence-core/references/capture-grammar.md,
  cadence-core/bin/weight-budgets.json
- **Action:** New reference stating the `CAPTURE.md` bullet grammar once, built
  on `cadence-core/references/roadmap-phases.md`'s structure: what the file's
  sections are and which three the recall walk visits, the bullet head (a
  column-0 dash, an optional checkbox in any state, then the text), the leading
  phase tag's admitted shapes with what each emits and what it strips, and a
  section listing every out-of-grammar shape with what it does instead - no
  phase, parenthetical kept as content. State the two rules that are decisions
  rather than mechanics: a non-phase leading parenthetical is content (D-05, with
  the 24-bullet `(cadence-wide)`/`(tooling)` evidence), and `## Archive` /
  `## Debt markers` are deliberately outside the walk (D-03, with the 185-bullet
  re-admission this would cause). Close with the sentence
  `roadmap-phases.md` uses - every claim here is pinned by a row in the table in
  `cadence-core/bin/planning-files.test.mjs` - and name that table. This is a
  DEFERRED reference: nothing `@`-includes it and no workflow preloads it, so it
  adds no eager bytes; it is cited from `parseCaptureSnippets`'s comment and from
  the test table's header. Add its `weight-budgets.json` row in the same commit -
  a new measured surface with no row fires `unbudgeted-surface` (D-10).
- **Verify:** `node cadence-core/bin/self-verify.mjs` reports no
  `unbudgeted-surface` and no `budget-overrun`. Every shape named in the doc has
  a matching row name in `planning-files.test.mjs` and every row has a line in
  the doc - checked by reading both lists side by side, with any mismatch fixed
  in whichever file is wrong.

### Task 4: State the recall walk once

- **Files:** cadence-core/bin/lib/planning-files.mjs,
  cadence-core/bin/lib/capture-file.mjs
- **Action:** The three walked headings are currently written out in
  `parseCaptureSnippets` and again in the kind-to-heading map PLAN-1 added to
  `lib/capture-file.mjs`, and the census in task 5 would be a third. Export one
  frozen list of the walked headings from `lib/planning-files.mjs` beside
  `parseCaptureSnippets`, have that function iterate it, and have
  `lib/capture-file.mjs` derive its map from it rather than restating the names -
  the writer and the reader disagreeing about which sections are the walk is
  literally this phase's defect, and it can only recur while the fact is written
  down twice. The kind-to-heading MAPPING stays in `capture-file.mjs` (it is
  writer knowledge); only the heading names come from the shared list. No
  behaviour changes.
- **Verify:** `node --test cadence-core/bin/*.test.mjs` passes with every PLAN-1
  and task 2 test unedited. `grep -n "'Todos'" cadence-core/bin/lib/*.mjs
  cadence-core/bin/*.mjs` shows the heading named in exactly one non-test
  source location.

### Task 5: The out-of-walk census as a standalone subcommand

- **Files:** cadence-core/bin/lib/planning-files.mjs,
  cadence-core/bin/planning.mjs, cadence-core/bin/self-verify.mjs,
  cadence-core/bin/planning-files.test.mjs, cadence-core/bin/planning.test.mjs
- **Action:** Add a census beside `parseCaptureSnippets` in
  `lib/planning-files.mjs` that walks EVERY `## ` heading in a `CAPTURE.md` and
  returns each with its bullet count and whether it is in the walk, using the
  same bullet-line rule `parseCaptureSnippets` applies and the shared heading
  list from task 4. Unconditional and with NO allowlist (D-06): an
  `Archive` + `Debt markers` exemption would have reported nothing on the
  incident that motivated this phase, since all five lost bullets sat under
  `## Archive`. Register it in `planning.mjs` as a `capture-sections` subcommand
  - STANDALONE, called beside `status` rather than folded into `cmdStatus` as a
  drift kind (D-07): `cmdStatus` returns `no-planning-dir` / `no-roadmap` /
  `unparseable-roadmap` before any drift is computed, so folding it in gives no
  capture report at all to the trees most likely to need one. The envelope names
  the file, the walked headings, and one entry per section with its heading,
  bullet count and in-walk flag. An absent `CAPTURE.md` is `ok:true` with the
  absence stated and no sections - absence is data here, as everywhere in this
  file - never a `fail`. Take a `--file <path>` override with the same
  present-but-unusable refusal `capture` and `debt-harvest` use, and add the
  matching `CONTRACTS` row in `self-verify.mjs`.
- **Verify:** `node cadence-core/bin/planning.mjs capture-sections` in this repo
  reports `Todos`, `Seeds` and `Notes` in-walk and `Archive` and `Debt markers`
  out-of-walk, each with a non-zero bullet count. New tests pass: a fixture with
  five sections returns exact counts per section; running the census, appending
  one bullet under the fixture's `## Archive`, and running again shows that
  section's count one higher and every other count unchanged (AC4); an absent
  `CAPTURE.md` returns `ok:true` with no sections; a fenced `## `-looking line
  inside a section body does not mint a section.
  `node cadence-core/bin/self-verify.mjs` reports no `unknown-subcommand`.

### Task 6: /cad-health names the sections outside the walk

- **Files:** skills/cad-health/SKILL.md, cadence-core/bin/weight-budgets.json
- **Action:** Attach the census to step 1 (Presence) as a sub-bullet in the same
  shape as the `trace ignore --check` bullet already there - the seam call, what
  to report, and when to say nothing. It runs `capture-sections` and prints one
  line per out-of-walk section with its heading and bullet count, EVERY run,
  never suppressed and never filtered against a list of expected sections: state
  in the prose why, because the obvious allowlist is the thing that would have
  hidden the five lost bullets, all of which sat under `## Archive`. Frame it as
  a NAMED NOTE rather than an issue, the way step 7's manifest clause is a
  distinct lower note: a project that deliberately archives inside `CAPTURE.md`
  has out-of-walk bullets by design, and calling that an issue every run trains
  the user to skim past exactly the line this phase exists to make readable. Say
  what the note MEANS in one clause - those bullets are invisible to
  `/cad-plan`'s recall - so the reader can act on it. Silent when the file is
  absent or every section is in the walk. Do not touch the trace-ignore bullet
  beside it. Re-pin the `weight-budgets.json` row for this file in the same
  commit: it grows (D-10).
- **Verify:** `node --test cadence-core/bin/*.test.mjs` passes and
  `node cadence-core/bin/self-verify.mjs` reports no `unbudgeted-surface`, no
  `budget-overrun`, no `unknown-subcommand` and no `unknown-flag` - check 2 lints
  the new invocation line against the `capture-sections` row task 5 added
  (AC6 for this plan). human-verify: run `/cad-health` in this repo and confirm
  the report names `Archive` and `Debt markers` with their counts.

## Notes

- Deviation from the CONTEXT `Plan shape` directive, recorded rather than left
  silent: the directive asked for two plans and there are two, but they are NOT
  file-independent and therefore NOT parallel-eligible. Both add a subcommand to
  `COMMANDS` in `planning.mjs`, a row to `CONTRACTS` in `self-verify.mjs`, rows
  to `weight-budgets.json` and tests to `planning.test.mjs`, and task 4 above
  edits the module PLAN-1 creates. They run sequentially, PLAN-1 first;
  `plan-overlap` will report the shared paths and `/cad-execute` will correctly
  route sequential. `workflows/plan.md` states this is a supported shape, and the
  archived v2.5.0 `phases/1/PLAN.md` + `PLAN-2.md` are house precedent for split
  plans sharing `planning.mjs`.
- Planner's discretion, recorded per the contract: an ADMITTED phase tag is
  stripped WHOLE rather than partially, so a version token or label riding inside
  a real tag leaves the indexed text. The alternative - strip the phase words and
  keep the remainder - synthesizes bullet text that nobody wrote and needs a
  second rule for what to do when the remainder is empty. The stated cost is that
  32 bullets tagged `(vX.Y.Z phase N)` stop carrying their version as a BM25
  term; they gain the phase field, which is what recall renders and what a
  planner filters on.
- Planner's discretion: the `/cad-health` line is an unconditional NOTE, not an
  issue. D-06 binds the allowlist question (there is none) and the count; whether
  the result reads as an issue was left open, and a report that fires on every
  healthy repo with an `## Archive` block is a report users learn to skip.
