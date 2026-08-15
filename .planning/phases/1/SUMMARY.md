---
phase: 1
status: complete
completed: 2026-08-15
---

# Phase 1: What the config says is what routing does - Summary

`config.schema.json`, `config.mjs get` and `route-table.json` now give one
answer per review trigger per stakes level, and `self-verify.mjs` check 18
(`gate-agreement`) fails when they stop doing so.

## What shipped

- The gate-agreement rule as a pure, six-code lib -
  `cadence-core/bin/lib/gate-agreement.mjs`, 28 rows of fixture tests in
  `cadence-core/bin/gate-agreement.test.mjs`
- Check 18 wired into the existing `route-table.json` arm -
  `cadence-core/bin/self-verify.mjs:1046-1083`; `checked` names
  `gate-agreement`, four CLI arms on a synthetic root in
  `cadence-core/bin/self-verify.test.mjs`
- All four `review.triggers.*.gate` defaults on the `null` sentinel, each
  `purpose` carrying its solo/shipped/critical clause -
  `cadence-core/config.schema.json`
- `config.mjs get` reporting an unset gate as unset (`null` + one `warnings[]`
  entry naming `route.mjs resolve`) - `cadence-core/bin/config.mjs`, five arms
  in `cadence-core/bin/config.test.mjs`
- The workaround paragraph retired from `cadence-core/workflows/execute.md` and
  `cadence-core/workflows/plan.md`, and the per-key scalar default off
  `cadence-core/references/config-catalog.md`'s gate row

## The twelve cells, audited (ROADMAP criterion 2)

Read from `cadence-core/route-table.json`'s `review` grid after the phase; the
schema's four `purpose` strings now state exactly these.

| Trigger | solo | shipped | critical | Moved? |
|---|---|---|---|---|
| `plan` | advisory | blocking | adjudicated | schema default `adjudicated` -> `null`; prose gained all three clauses |
| `diff` | off | off | blocking | schema default `advisory` -> `null`; prose gained all three clauses |
| `risk_surface` | blocking | blocking | blocking | schema default `blocking` -> `null` (D-01); prose gained all three clauses. No cell moved |
| `phase_diff` | off | off | adjudicated | schema default `advisory` -> `null`; prose claim `advisory at shipped` corrected to `off at shipped` - the cell already on the floor |

`route-table.json` itself is unchanged: the grid is the authority (D-04).

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | cfd573a | The gate-agreement rule as a pure lib, unit-tested from fixtures |
| 1 | 2 + 3 | 690d268 | Wire the check into self-verify; move the four schema gate rows onto the route table (one commit - see Deviations) |
| 1 | 4 | 5356dc9 | `config.mjs get` reports an unset gate as unset |
| 1 | 5 | 703a357 | Retire the workaround paragraph from both workflow files |
| 1 | 6 | 65d8f72 | The catalog's gate row stops publishing a default routing never fires |

## Deviations

- [deviation] Tasks 2 and 3 landed as ONE commit (`690d268`) by user decision at
  a structural checkpoint. Task 2's `Verify:` asked for a commit that was red on
  `self-verify.mjs` and green on `node --test`, which is impossible on this tree:
  `cadence-core/bin/self-verify.test.mjs:210-214` already asserts the LIVE repo
  has `problems: []`, so wiring the check against the unpatched schema reddens
  the suite (measured: 140 tests, 139 pass, 1 fail, that row). Task 2's `Action:`
  line "do not add any live-tree assertion to the test file" was written on the
  false premise that none existed; the assertion stands, was not removed and was
  not loosened. The failing-run evidence ROADMAP criterion 1 asks for was
  produced against the unpatched tree and is recorded verbatim in
  `.planning/phases/1/reports/plan-1.md`, which is what the plan asks ("recorded
  rather than asserted").
- The CONTEXT's second flagged assumption held on its own terms - the v3.4.0
  count pins at `self-verify.test.mjs:290-300` and `:1591-1592` were off this
  phase's path - but a different live-tree assertion in the same file forced the
  checkpoint it was written to anticipate. No numbered decision D-01..D-12 was
  refuted; all twelve held.
- Fuller shapes declined, both recorded by the executor and both scope
  judgments rather than gaps: the gate-agreement lib exposes no options beyond
  the caller's `{levels, gates}` vocabularies (no configurable clause grammar,
  no per-code severity, no opt-out register), and the CLI test files four arms
  proving the WIRING rather than one arm per code - `gate-grid-missing` and
  `gate-row-malformed` are pinned from the lib side.

## Open items

- The `gate-agreement` check does not flag a non-`null` gate default that
  happens to equal every level's cell. Reverting
  `review.triggers.risk_surface.gate.default` to `"blocking"` passes
  self-verification and CI while `config.mjs get` silently drops the unset
  warning. Raised by the `risk_surface` cross-model review of this phase's range
  (`.planning/phases/1/REVIEW-risk_surface-execute-65d8f72.md`, medium - below
  the blocking gate's blocker/high bar, so it did not halt the phase).
- `cadence-core/route-table.json`'s `_meta.review` still says "the five triggers
  config.schema.json defines" while four remain (`pre_ship` retired in v3.2.0).
  Out of scope per CONTEXT's scope boundary; one line away from a block this
  phase reads.

## Goal check

The phase goal is met. The three surfaces agree and the check that keeps them
agreeing is live and load-bearing. Evidence, each claim to its command:
`node cadence-core/bin/self-verify.mjs` exits 0 with `problems: []` and its
`checked` string names `gate-agreement`; the four `purpose` strings read out of
`cadence-core/config.schema.json` name gates for solo, shipped and critical that
match `route-table.json`'s `review` grid cell-for-cell (the twelve-cell table
above is that comparison); `config.mjs get review.triggers.phase_diff.gate`
answers `{"review.triggers.phase_diff.gate":null}` with one `warnings[]` entry
naming `route.mjs resolve`, while the pinned `review.triggers.plan.gate` still
reads back `"adjudicated"` with no such warning and a keyless `get` carries no
gate warning at all; `config.mjs check review.triggers.diff.gate=null` still
returns `ok:false` with `must be one of: off, advisory, blocking, adjudicated`;
`grep -n "schema default" cadence-core/workflows/execute.md
cadence-core/workflows/plan.md` returns nothing; and `node --test
cadence-core/bin/*.test.mjs` is 1870 pass, 0 fail, with no test file removed.
The check's failing direction was proved twice rather than inspected - once
against the unpatched tree before the data edit (the verbatim JSON in
`reports/plan-1.md`, naming `plan`, `diff` and `phase_diff`, two entries naming
`phase_diff` with `shipped`), and once after the phase by deleting `blocking at
shipped` from `review.triggers.plan.gate`'s purpose, which produced exactly one
`gate-prose-missing` problem naming `plan` and `shipped` before the schema was
restored byte-identical. The one honest gap is the open item above: the check
proves agreement between the default and the cells, not that the default is the
`null` sentinel, so `risk_surface` - whose three cells are identical today - can
regress its default without tripping anything.
