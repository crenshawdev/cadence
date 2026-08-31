# Phase 1: The next step it names is one you can take - Context

Gathered: 2026-08-31
Feeds: /cad-plan 1

## Scope boundary

In: the three sites where Cadence prints a next action that is unreachable,
stale, or not the outstanding work - `/cad-task`'s guard-before-classify and
its phase-sized arm, `/cad-progress` reading a SUMMARY as the end of the work,
and the shipped auto-resume claims. Plus the `/cad-plan --gaps` plan naming the
analyzer proved the progress fix depends on.
Out: a real `--resume` flag for `/cad-progress` (a separate decision, not this
phase); the receipts cluster (`GH-226`, `GH-227`, `GH-220`, `GH-221`, `GH-228`)
and the unresolved-input guards (`GH-229`, `GH-202`, `GH-196`), both deliberately
out of this cycle; widening `derivePhases`'s directory resolution to spelling.
Deferred: None.
Plan shape: multiple plans - three separable surfaces (`task.md`; the
`status`/`replay-check`/`progress.md` seam plus `--gaps` naming; the five doc
sites and their byte pins).

## Durable decisions

- D-01 (gap plan naming): `/cad-plan --gaps` writes the next free
  `PLAN-<k>.md` instead of overwriting `PLAN.md`. Measured 2026-08-31 on a
  fixture: with the gap plan written over `PLAN.md` the prior run's
  `reports/plan-1.md` still reads `PLAN COMPLETE` and `replay-check` returns
  `dispatch_set: []`, so routing off the seam cannot see the gap plan at all;
  renaming it to `PLAN-2.md` in the same fixture returned
  `dispatch_set: ["PLAN-2.md"]`. This fixes `/cad-execute` by the same change.
  Rejected: an mtime comparison, which does not survive a fresh clone or a
  checkout. Evidence: `cadence-core/workflows/plan.md:81,174-176`,
  `cadence-core/bin/planning/replay-check.mjs:47-50,62`,
  `skills/cad-executor-contract/SKILL.md:245-250`,
  `.planning/tasks/gh-179-gaps-execute/RECORD.md`.
- D-02 (OQ-1, shape): the outstanding-plan fact is an additive field on the
  `planning.mjs status` envelope, beside `deferred`. No new derived phase
  status and no new cursor status. `CURSOR_STATUSES` is a closed list, and
  minting a status moves `status`, `audit`, `phase-done` and the cursor at
  once, making every cursor written by a prior Cadence version read as drift.
  Evidence: `.planning/spikes/execute-replay-blast-radius/SPIKE.md:218-227`,
  `cadence-core/bin/lib/planning-files.mjs:13-16`,
  `cadence-core/bin/planning/cursor-set.mjs:81-83`,
  `cadence-core/bin/planning/status.mjs:119-123,263-278`,
  `cadence-core/bin/prose-agreement.test.mjs:1533-1537,1558-1561`.
- D-03 (OQ-1, site): the read lands in `status`, not a second `replay-check`
  call from `progress.md`. The deciding evidence is call count rather than
  bytes: the route table scans ALL phases lowest-first, so the alternative is
  one process spawn per executed phase on every `/cad-progress`. Evidence:
  `cadence-core/workflows/progress.md:184-198`,
  `cadence-core/bin/planning/core.mjs:191-206`,
  `cadence-core/bin/planning/status.mjs:157`,
  `cadence-core/bin/prose-agreement.test.mjs:888-897`.
- D-04 (one definition): the report-completeness derivation hoists into
  `cadence-core/bin/planning/core.mjs` so `status` and `replay-check` read one
  definition, rather than `status.mjs` growing its own copy of `planNumber` /
  `firstLine`. Evidence: `cadence-core/bin/planning/replay-check.mjs:15-22`,
  `cadence-core/bin/planning/core.mjs:275-294` (the repo's stated one-reader
  rule).
- D-05 (`/cad-task` arm): the phase-sized arm NAMES both doors and lets the
  user pick; it does not measure "existing code" versus "blank repository"
  itself. Cadence has no seam for that distinction - `status` collapses every
  treeless repo into one `no-planning-dir` reason - and `progress.md:48-50`
  and `context.md:29-31` already relay that one reason as two named doors.
  Rejected: an `adopt.md`-style `git rev-parse --show-toplevel` probe, which
  would make `/cad-task` answer differently than `/cad-progress` on the same
  tree. Evidence: `cadence-core/bin/planning/status.mjs:129`,
  `cadence-core/workflows/adopt.md:21-32`.
- D-06 (phase directory resolution): the outstanding set inherits
  `derivePhases`'s numeric resolution (`join(dir, 'phases', String(p.n))`),
  so a `phases/1.10` tree resolves to `phases/1.1` - the same limitation
  `status` already reports as `phase-dir-collision` drift. Not widened here:
  resolving by spelling inside `derivePhases` changes `status` and `audit`
  behaviour on collision trees at the same time. Evidence:
  `cadence-core/bin/planning/core.mjs:193`,
  `cadence-core/bin/planning/replay-check.mjs:35`,
  `cadence-core/bin/planning/status.mjs:97-116`,
  `cadence-core/bin/phase-spelling.test.mjs:487-488`.

## Decisions

- D-07 (`/cad-task` guard): reorder the EXISTING `<step name="git_guard">` to
  run after `scope` and re-scope it to the inline and planned arms - not a
  second guard sentence copied into each arm, which would ship two copies in
  one file. This is where `task.md:48` already puts the trace bracket, for the
  same reason. The workflow's own success criterion ("Protected-branch guard
  applied before the first commit", `task.md:286`) still holds. Evidence:
  `cadence-core/workflows/task.md:21-24,26-45,47-49,286`.
- D-08 (`/cad-task` status call): the `planning.mjs status` call stays on the
  phase-sized arm and is gated on its own `ok:false` / `no-planning-dir`
  answer, so `total + 1` is reached only on the initialised-project branch. No
  separate `[ -d .planning ]` filesystem probe - two ways of asking "is there
  a project here" must not ship in one workflow. Evidence:
  `cadence-core/workflows/task.md:36-39`,
  `cadence-core/bin/planning/status.mjs:129`.
- D-09 (test movement): the `PHS-02` prose tests move with the arm in the same
  commit. `tooBigArm()` slices the `- **Too big**` bullet from its marker to
  the FIRST BLANK LINE, so a three-way branch written as separate paragraphs
  falls outside the slice and the assertions pass vacuously. Evidence:
  `cadence-core/bin/prose-agreement.test.mjs:3366-3372,3374-3386,3388-3404`.
- D-10 (route table): the new row sits between "Lowest **planned** phase" and
  "Lowest **executed** phase", and the derived status stays `executed`, so
  `reconcile`'s status mapping and the written cursor are untouched. Evidence:
  `cadence-core/workflows/progress.md:74-76,184-198`,
  `cadence-core/bin/prose-agreement.test.mjs:1516-1531`.
- D-11 (doc scope): all FIVE shipped auto-resume sites are restated, not the
  three the roadmap names - `README.md:49`, `skills/cad-progress/SKILL.md:3`,
  `cadence-core/workflows/progress.md:6`, plus
  `cadence-core/references/COMMANDS.md:18` (what `/cad-help` prints) and
  `skills/cad-pause/SKILL.md:16` (rides every session's prompt). Fixing three
  would leave `cad-pause`'s description saying what the fixed `cad-progress`
  description denies. Evidence: those five paths.
- D-12 (byte pins): the re-pin is not one row. `cadence-core/workflows/progress.md`
  (13513 B) and `cadence-core/workflows/task.md` (14991 B) are budgeted at
  EXACTLY their current byte counts, so any prose this phase adds overruns;
  `skills/cad-progress/SKILL.md` (1129 B), `references/COMMANDS.md` and
  `skills/cad-pause/SKILL.md` re-pin alongside them. `README.md` is not a
  weighed surface and needs no pin. Measured 2026-08-31 with `wc -c`.
  Evidence: `cadence-core/bin/weight-budgets.json:78,81,110`,
  `cadence-core/bin/self-verify.mjs:797-819`,
  `cadence-core/bin/lib/surface-weight.mjs:8-19`.
- D-13 (claim ledger): `.planning/DOCS-CLAIMS.md`'s `README-32` row gets its
  line and verdict updated in the same commit. It currently records the claim
  at `README.md` line 34 marked accurate, so the next `/cad-docs-verify` sweep
  would re-bless exactly the claim this phase removes. Evidence:
  `.planning/DOCS-CLAIMS.md:551`,
  `cadence-core/bin/citation-census.test.mjs:203-209,252-269`.

## Acceptance criteria

- [ ] AC1: A `/cad-task` invocation whose description classifies as phase-sized
      asks no protected-branch and no integration-branch question before it
      stops.
- [ ] AC2: `/cad-task`'s phase-sized arm, run in a repository with no
      `.planning/` directory, names `/cad-adopt` and `/cad-new-project` and
      never `/cad-phase add`.
- [ ] AC3: `/cad-plan --gaps` on a phase that already has `PLAN.md` writes
      `PLAN-2.md` and leaves the existing `PLAN.md` and its report
      byte-identical.
- [ ] AC4: With that unexecuted gap plan beside an existing SUMMARY,
      `/cad-progress` routes to `/cad-execute N`, and a test pins the case
      against a fixture.
- [ ] AC5: A phase whose outstanding set is empty still routes to
      `/cad-verify N` - the fix narrows the executed row, it does not invert it.
- [ ] AC6: `planning.mjs status` carries the outstanding-plan field on every
      call, empty rather than absent when nothing is outstanding, and
      `CURSOR_STATUSES` gains no new value.
- [ ] AC7: The five auto-resume sites describe an offer, `DOCS-CLAIMS.md`'s
      `README-32` row carries the corrected line and verdict, and
      `node cadence-core/bin/self-verify.mjs` reports no `budget-overrun`.

## Flagged assumptions

None - all assumptions confirmed.
