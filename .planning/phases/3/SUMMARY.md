---
phase: 3
status: complete
completed: 2026-08-19
---

# Phase 3: Gates that fire on themselves or cannot be satisfied - Summary

Four defects where a check answered about something other than what it was asked
are closed: `detect-commands` probes reachability before naming a command, both
`risk-check` faces read one worker-key grammar, the `risk_surface` detector no
longer matches its own source or fixtures, and every `## Shipped` / `##
Traceability` locator reads fence-aware.

## What shipped

- One executable-reachability predicate, pure `fs`, with a `PATHEXT` arm -
  `cadence-core/bin/lib/on-path.mjs`, imported by `issue-check.mjs` and by
  `detect-commands`
- `detect-commands` nulls an unreachable winning arm and names the tool in
  `warnings[]` with no fall-through to a lower arm - `cadence-core/bin/planning.mjs`
- One stated worker-key grammar, 16 rows, shared by `risk-check run` and
  `risk-check status` - `cadence-core/bin/lib/plan-key.mjs`; a refused bracket key
  is reported in `malformed[]` rather than dropped into `missing[]`
- `workflows/execute.md` states the key a continuation or fix-pass dispatch
  carries, and that the record and the receipt must share one spelling (D-12)
- The `risk_surface` detector and its test file stop matching themselves - 29
  literal sites split, reach proven unchanged, pinned by a census row -
  `cadence-core/bin/lib/risk-diff.mjs`, `cadence-core/bin/risk-diff.test.mjs`
- All four `## Traceability` locators and the `## Shipped` lookup (start AND end)
  route through `sectionSpan` - `cadence-core/bin/lib/planning-files.mjs`,
  `cadence-core/bin/lib/milestone-prune.mjs`

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | 4cd2a0f | One executable-resolution predicate in `lib/`, two callers |
| 1 | 2 | bc16856 | `detect-commands` names a command only when its binary resolves |
| 1 | 3 | ad0abbc | One worker-key grammar for `--plan`, with its stated table |
| 1 | 4 | 9d7c4a5 | Both `risk-check` faces read one worker-key grammar |
| 1 | - | 3998438 | `weight-budgets.json` enters plan 1's lease (orchestrator, user-authorized) |
| 1 | 5 | 02476be | `execute.md` states the key a second dispatch carries |
| 2 | 1 | d7fa77e | The risk detector stops matching its own pattern table |
| 2 | 2 | 803f27f | The risk-diff fixtures stop matching the detector they test |
| 2 | 3 | 76c67ae | A census row pins the detector and its fixtures clean |
| 3 | 1 | b8cccc8 | The three `## Traceability` locators read fence-aware |
| 3 | 2 | 28b1eb5 | `## Shipped` and the Traceability filter read fence-aware |
| 3 | 3 | e2ff4f5 | The seam's answer on a document whose sections are only fenced |

Merges: `7e5058b` (plan 1), `8a88bc9` (plan 2), `6ee0835` (plan 3). Reports at
`52448b9`, `d8bd7bc`, `d26b2ea`, `95e5564`.

## Deviations

- [deviation] Plan 1 task 5 was unsatisfiable as written: its `Action:` adds prose
  to `cadence-core/workflows/execute.md` while its `Verify:` requires
  `self-verify.mjs` to pass, and `cadence-core/bin/weight-budgets.json` pinned that
  file at 26928 B - exactly its pre-change size, zero headroom. The manifest was
  outside PLAN-1's `files:` lease. Returned as a structural checkpoint; the user
  authorized the lease extension (`3998438`), and the continuation set the entry to
  the measured post-edit size 27834 and committed it with the prose (`02476be`).
  No criterion redefined - `self-verify.mjs` passes on its own terms.
- [deviation] Plan 1 task 2's `Verify:` asserts `detect-commands --root .` answers
  `npx tsc -p tsconfig.ci.json` "where `node_modules/.bin/tsc` exists". In a git
  worktree it does not - `node_modules` is gitignored and lives only in the main
  checkout - so the command answered `typecheck: null` there. The premise was false
  in that tree, not the behaviour wrong; the hermetic `node_modules/.bin` fixture
  row asserts the same shape and passes.
- [deviation] This refutes D-04, and `CONTEXT.md` is annotated accordingly. D-04
  states `<root>/node_modules/.bin/<tool>` is "where `npx` actually resolves it".
  It is not, in general: `npx` walks ancestor directories. Measured 2026-08-19 -
  `npx --no-install tsc --version` prints `Version 7.0.2` from a directory two
  levels under this repo carrying no local `node_modules`. A root-only probe
  therefore nulls a command `npx` would run.
- [deviation] All three executors were dispatched naming branch
  `cadence/phase-3-plan-<k>`; the host created its worktrees on
  `worktree-agent-<id>` branches instead. Plan 1's executor created the named
  branch at the correct base and committed there; plans 2 and 3 committed on the
  host branches and said so. Every worktree forked at `0e7844b`, carrying this
  phase's `CONTEXT.md` and its own `PLAN-<k>.md`. All three merged cleanly.

## Open items

- `reachable()` does not walk parent directories for `node_modules/.bin`, which is
  what `npx` does. Measured cost: an executor on the parallel path gets
  `typecheck: null` for this repository, where `npx tsc -p tsconfig.ci.json` does
  run. This is the D-04 refutation above, as work.
- `parseRequirements` still counts a fenced example table nested INSIDE a real
  `## Traceability` section as rows, and `archiveRequirements`' append scan still
  counts a fenced `|` line inside `## Shipped` as the last row. Phase 3 scoped
  itself to the LOCATOR; the nested-example answer was never stated.
- The census row in `risk-diff.test.mjs` hardcodes this project's three answered
  surfaces rather than reading `.planning/config.json`, so the row cannot track a
  changing answer. Deliberate: the eight-category half dominates, and a test
  reading the repo root's `.planning/` would fail in any tree shipping
  `cadence-core/` without it.
- The range that lands plan 2's fix still fires `risk_surface` once, unavoidably:
  `parseDiff` reads REMOVED lines by design, and the old literals are removed lines
  in that range. Both fires were reviewed and returned zero findings.

## Goal check

The phase goal asks that three gates and one locator stop answering about
something other than what they were asked, and the commits deliver all four with
evidence. Reachability: `bc16856` makes `detect-commands` null an unreachable
winning arm, and plan 1's report records 402/402 planning rows passing both with
`ruff`/`mypy`/`eslint`/`tsc`/`go` absent from PATH and with all five stubbed onto
it, so the answer is pinned by fixtures rather than by this machine. Satisfiability:
`ad0abbc` and `9d7c4a5` put one grammar behind both `risk-check` faces, and this
run is itself the evidence - `risk-check status` answered `ok:true` with
`state: "recorded"` for all three plans, the condition RSK-03 said was permanently
unreachable for a non-numeric key. Self-match: `76c67ae` adds a census row that
asserts whole-file adds of `lib/risk-diff.mjs` and `risk-diff.test.mjs` scan clean
under both the eight-category set and this repo's three, watched failing against
the `0e7844b` blob. Fence-awareness: `b8cccc8` and `28b1eb5` route all four
`## Traceability` locators plus `## Shipped`'s start and end through `sectionSpan`,
with plan 3's falsifier observed by hand - the pre-phase libs wrote
`| STOR-01 | 1 | Complete | v1.2.0 |` inside a fenced `## Shipped` table.

The full suite passes on the merged tree: `node cadence-core/bin/test.mjs` reports
2357 pass / 0 fail, which is the only place the three plans' work is exercised
together, since each executor tested in isolation in its own worktree. Both
`risk_surface` fires (plans 1 and 2; plan 3 matched nothing) returned zero
findings from the cross-model reviewer.

What is missing is bounded and named: D-04's premise was wrong about where `npx`
resolves, so RCH-01's fix is correct for the main checkout and incomplete for any
tree whose `node_modules` sits in an ancestor - measured, not suspected. That is
an open item rather than a phase failure, because the requirement RCH-01 states is
that a named command be reachable, and a root-only probe answers that
conservatively (it nulls rather than naming an unreachable tool). SHP-01's nested
fenced-example case is likewise out of the scope the phase set for itself and is
queued.
