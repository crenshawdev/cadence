---
phase: 2
status: complete
completed: 2026-08-16
---

# Phase 2: One reader for the lease grammar - Summary

`plan-overlap` and `lease-check` both reach path containment through one
exported predicate in `cadence-core/bin/lib/lease-grammar.mjs`, so a directory
lease that the commit-step enforcement would refuse can no longer pass the
pre-flight overlap gate.

## What shipped

- The lease-grammar module - `covers`, `intersects`, `isRefusedSpelling`,
  three exports, no fourth - at `cadence-core/bin/lib/lease-grammar.mjs:63,76,104`
- `plan-overlap` reading containment through that module rather than a local
  `.includes(` comparison - `cadence-core/bin/planning.mjs`
- `lease-check` asking the same predicate, its 19 shipped cases green and
  unedited - `cadence-core/bin/planning.mjs`
- `./` prefixes and redundant separators refused with a named
  `redundant-path-segment` diagnostic through BOTH declaration doors, frontmatter
  `files:` and a `- **Files:**` task line - `cadence-core/bin/lib/planning-files.mjs`
- The grammar written down and its surface budget re-pinned to 17312 B -
  `cadence-core/references/plan-frontmatter.md`, `cadence-core/bin/weight-budgets.json`
- A census row that reddens when the containment body idiom is pasted anywhere
  under `cadence-core/bin/` - `cadence-core/bin/helper-census.test.mjs`
- Unit coverage for the module and both doors - `cadence-core/bin/lease-grammar.test.mjs`,
  `cadence-core/bin/planning.test.mjs`

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | 328ce76 | The two defective lease pairs, as failing-capable cases |
| 1 | 2 | ecd3465 | One module states what a declaration covers, and plan-overlap reads it |
| 1 | 3 | fe84b23 | lease-check asks the same predicate the overlap gate asks |
| 1 | 4 | eb65ebc | `./` and redundant separators refused at both declaration doors |
| 1 | 5 | 71d544d | The lease grammar written down, with its budget re-pinned |
| 1 | 6 | 13b49c0 | The census row that reddens on a pasted-back containment |

## Deviations

None - plan executed as written.

## Open items

- `parsePlanFiles`'s task-line pattern `/^\s*-\s*\*\*Files:\*\*\s*(.+)$/gm` has a
  leading `\s*` that matches NEWLINES, so `m.index` names an earlier line than the
  declaration is written on. Task 4's diagnostic measures to the `**Files:**`
  marker instead, so the defect is latent, not live; tightening the pattern to
  `[^\S\n]*` changes what the arm matches and belongs to the task-line arm's own
  grammar.
- Declined a `containments: [{covering, covered}]` sibling field on `overlaps[]`
  and any exported helper beyond the three. D-06 is met by the flat string-list
  shape; a fourth export would have exactly one caller.
- `plans[].files` and `lease-check`'s `declared` fall by one per REFUSED
  declaration, because a refusal drops the entry before the set is built. That is
  the decided shape and does not touch D-10 (which is about resolved and deduped
  forms), but a plan author writing `./a.txt` sees a count one lower than the lines
  they wrote, with `redundant-path-segment` beside it naming why.

## Goal check

The six commits plausibly deliver the phase goal. Containment now has exactly one
definition: `cadence-core/bin/lib/lease-grammar.mjs:63,76,104` exports `covers`,
`intersects` and `isRefusedSpelling`, and the census test added at
`cadence-core/bin/helper-census.test.mjs` reddens on a pasted-back copy, proved by
the executor's probe run (`cp lib/lease-grammar.mjs lib/census-probe.mjs` ->
`node --test cadence-core/bin/helper-census.test.mjs` exit 1, naming both files).
The gate-versus-enforcement disagreement that opened the phase is closed at its
root: the two `src/` versus `src/auth.js` and `src/` versus `src/auth/` cases were
committed FAILING alone at 328ce76 (`node --test cadence-core/bin/planning.test.mjs`
-> exit 1, 2 failures, both named) and are green from ecd3465 onward, while
`lease-check`'s 19 shipped cases stayed unedited through fe84b23. The refusal arm
reaches both doors (eb65ebc) and the grammar is written down with its budget
re-pinned, `node cadence-core/bin/self-verify.mjs` -> exit 0, `problems: []`. The
whole diff touches exactly the 8 files the plan declared (`git diff --stat
392ae60..HEAD`, 8 files, 569 insertions), and `risk-check run --phase 2 --plan 1`
returned `matches: []`, `inconclusive: false` across all 8 categories. Nothing
looks missing against the phase goal. What is NOT closed, and is named above as an
open item rather than a gap: the `parsePlanFiles` task-line offset bug is real and
untouched, latent only because the new diagnostic does not consume that offset.
