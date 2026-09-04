# Phase 1: Every role has every rung - Context

Gathered: 2026-09-04
Feeds: /cad-plan 1

## Scope boundary

In: the eleven missing rung agent files under `agents/`, their eleven
`RUNG_FILES` entries in `cadence-core/bin/lib/rung-agent.mjs`, their eleven
byte ceilings in `cadence-core/bin/weight-budgets.json`, and the six
`model.effort.*` enums in `cadence-core/config.schema.json`. The gaps, measured by
reading the `effort:` line of all 19 existing files: `low` and `medium` for
`cad-planner`, `cad-assumptions-analyzer` and `cad-executor`; `low` for
`cad-verifier` and `cad-reviewer`; `max` for `cad-assumptions-analyzer`,
`cad-executor` and `cad-plan-checker`.
Out: renaming any existing agent file; any change to `route-table.json` cells,
to the `stakes` key, or to any config schema key OTHER than the six
`model.effort.*` enums - those are phases 2 and 3. No new self-verify rule -
narrowing check 8's existing arm per D-03 is not one. No contract skill edits.

Amended 2026-09-04, after the `plan` review's first survivor. The enums were
Out until the coupling was measured: `effortEnumIssues` in
`cadence-core/bin/lib/rung-agent.mjs` holds each `model.effort.<role>` enum
against `[...Object.keys(RUNG_FILES[role]), null]` element by element, so
eleven map entries with the schema untouched produce six `effort-enum-drift`
problems and AC3 (self-verify reports `ok: true`) is unreachable inside the
original boundary. The enums are this phase's own subject, not phase 2 or 3
work; every other schema key stays Out.
Deferred: None.
Plan shape: one plan.

## Durable decisions

- D-01 (naming): Phase 1 is purely additive - eleven new files in the existing
  naming style, and the nineteen existing filenames are not touched. The bare
  role name means a different rung per role (`cad-assumptions-analyzer` is
  xhigh, `cad-executor` is high, `cad-plan-checker` is low), and that
  irregularity is preserved deliberately rather than regularized. Evidence:
  `cadence-core/bin/lib/rung-agent.mjs` RUNG_FILES. Regularizing all thirty was
  considered and rejected: it would touch the registry, the route-table cells,
  every budget row and every doc naming an agent, and would break a user config
  pinning an agent by name.
- D-02 (ladder shape): All six roles offer all five rungs, including
  `cad-executor` and `cad-planner` at `low`. Filling only the cells that seem
  sensible was considered and rejected. Evidence: GH-249 fills the gaps so the
  interview asks one uniform question per role; a role missing a rung makes the
  interview explain an exception, which is the thing the phase exists to remove.

## Decisions

- D-03 (orphan rungs): No orphan-rung check is added. The eleven new files are
  deliberately unreferenced by any routing cell until the roles block of phase 2
  can name them. Evidence: `cadence-core/bin/lib/route-cells.mjs:249` files
  `missing-rung-agent` for the dangerous direction only - a cell naming a rung
  with no file. A rule for the reverse would FAIL for the whole of phase 1 and
  pass only after phase 3, gating the cycle on itself.
- D-04 (file body): Each new file's post-frontmatter body is its role's existing
  body byte for byte - the two-line pointer at the role's contract skill, adding
  nothing else. Evidence: measured 2026-09-04, the body hash is identical across
  every rung of `cad-planner` (3 files), `cad-verifier` (4) and
  `cad-plan-checker` (4); the shipped rule is `RNG-01` and the v3.7.4 phase 2
  UAT states it.
- D-05 (registry): `RUNG_FILES` gains eleven entries and stays the single source
  of truth for the role-to-file mapping. Evidence: `rungFile()` returns null for
  an unmapped pair rather than guessing a stem, and self-verify files a problem
  on it.
- D-06 (budgets): `weight-budgets.json` gains eleven rows in the same commit as
  the files. Evidence: every agent surface is byte-pinned and an unbudgeted
  surface is a self-verify problem.

## Acceptance criteria

- [ ] AC1: Every one of the thirty role-rung pairs exists as a file in
      `agents/`, and reading the `effort:` line of each yields `low`, `medium`,
      `high`, `xhigh` and `max` for each of the six roles.
- [ ] AC2: `rungFile(role, rung)` returns a non-null stem for all thirty pairs,
      and the file each stem names exists on disk.
- [ ] AC3: `node cadence-core/bin/self-verify.mjs` reports `ok: true` with no
      `unbudgeted-surface` and no `budget-overrun` entry.
- [ ] AC4: Within each role, every rung file's post-frontmatter body is
      byte-identical to its siblings'.
- [ ] AC5: The nineteen existing agent filenames are unchanged - a
      `git diff --name-status` over the phase's commits shows no rename or
      delete under `agents/`.
- [ ] AC6: `node cadence-core/bin/test.mjs` passes, and no test asserts the
      agent-file count nineteen.

## Flagged assumptions

- None - all assumptions confirmed.
