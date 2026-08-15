PLAN CHECKPOINT: human-verify
Plan: .planning/phases/1/PLAN-2.md
Tasks: 6 of 6
| Task | Commit | Note |
|---|---|---|
| 1. Widen the phase-tag reader to the shapes the queue contains | f8854c8 | `CAPTURE_PHASE_TAG` admits `(phase N)`, `(vX.Y.Z phase N)`, `(phase N, label)` and the combination; six-shape fixture matched the prediction exactly (2/1/3/1 and no `phase` for `(cadence-wide)`/`(tooling)`, both parentheticals kept in text) |
| 2. One test row per stated shape | 9edd2fa | `CAPTURE_TAG_ROWS`, 23 rows (15 admitted x bare/unchecked/checked, 8 out-of-grammar), one `test()` from one loop; 247 pass. Falsifier: reverting task 1's pattern reddens exactly the 9 version-prefix/label rows and leaves the 8 out-of-grammar rows green |
| 3. Write the grammar down | a6508ee | `references/capture-grammar.md` (6358 B) on `roadmap-phases.md`'s structure, budget row pinned in the same commit; self-verify 0 problems. Doc rows and `CAPTURE_TAG_ROWS` names read side by side, no mismatch |
| 4. State the recall walk once | 8e27033 | `CAPTURE_WALK_SECTIONS` exported from `lib/planning-files.mjs`; `CAPTURE_HEADINGS` and `EMPTY_CAPTURE` in `lib/capture-file.mjs` derive from it, both byte-identical to their old literals. 1695 tests pass unedited; `grep "'Todos'"` shows one non-test source location |
| 5. The out-of-walk census as a standalone subcommand | 0dbdfda | `captureSections` + `planning.mjs capture-sections` + the `CONTRACTS` row; live run matched prediction (Todos 181 / Seeds 6 / Notes 3 in-walk, Archive 185 / Debt markers 1 out). 7 new rows including the AC4 append delta and the fenced-heading case; self-verify clean of `unknown-subcommand` |
| 6. /cad-health names the sections outside the walk | 593ec7f | Sub-bullet on step 1 beside the trace-ignore bullet (untouched): the seam call, one line per `in_walk:false` section with its count, framed as a named note, silent when absent or fully in-walk, with the no-allowlist reason stated. Budget re-pinned 6666 -> 7827. 1702 tests pass, self-verify 0 problems |

Deviations: none

Open items:

- Declined a preamble arm on the census: a bullet sitting ABOVE the first `## `
  heading belongs to no section and is counted nowhere. The `Verify:` is a
  per-section count and no writer in this codebase can produce such a bullet, so
  the lean shape is sections-only; the limit is stated in `captureSections`'
  own comment rather than left to be discovered. Give it a synthetic
  no-heading entry when a task states that a hand-edited preamble must report.
- `planning.test.mjs`'s `redactUrl` detail-site census was pinned at 5 idiom
  uses and `capture-sections` added a sixth. The count and its comment were
  updated in task 5's commit, with the new site recorded as deliberately
  UNWRAPPED for the same reason `capture --text-file` is: its detail is an `fs`
  error over a path the caller just named, never a credential from a remote.
- The plan's Context recorded a live baseline of `## Todos` 180; the census
  measures 181 today. Nothing turns on it - the counts are read, never asserted
  against that baseline - but a phase record quoting 180 would be stale.

Human-verify outstanding (task 6): `/cad-health` walked in this repo, confirming
the report names `Archive` and `Debt markers` with their counts. The seam half is
already proved - `node cadence-core/bin/planning.mjs capture-sections` returns
`Archive` 185 and `Debt markers` 1 with `in_walk:false` - so what remains is the
skill prose actually printing them on a real run.
