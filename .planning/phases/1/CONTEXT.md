# Phase 1: The re-run that overwrites its own evidence - Context

Gathered: 2026-08-19
Feeds: /cad-plan 1

## Scope boundary

In: The executor stops destroying the previous run's per-task report, and
`/cad-execute` stops silently re-dispatching a phase whose work is already
committed. Concretely: a pure suffix-picker in `cadence-core/bin/lib/` with
fixture tests, the rotate-before-first-write rule stated in
`skills/cad-executor-contract/SKILL.md`, the state step in
`cadence-core/workflows/execute.md` staging the reports directory, an
unconditional `status` call plus a refusal in that file's locate step, and the
`weight-budgets.json` re-pin the prose edits force.

Out: Any change to the correlation id itself. `correlationId`
(`cadence-core/bin/lib/trace.mjs:212-229`) mints the same string for two runs at
an unchanged HEAD, and its comments at `:218-219` and `:394-396` both assert the
opposite. This phase routes around that rather than fixing it - D-01 needs no
run key at all - so the overstated comments and the FIFO-pairing consequence
stay live and belong in the capture queue.

Out: The three other `v3.5.6` issues (#139, #140, #145). #145's shared journal
primitive is deliberately last in the cycle.

Deferred: None.

Plan shape: one plan.

## Durable decisions

- D-01 (The run-scoping key): Run scoping is rotation-on-write, not a key. The
  executor rotates any pre-existing `<plandir>/reports/plan-<k>.md` to a free
  suffix before its first write, so no run identifier is derived, minted or
  carried in the dispatch. This keeps the contract's standing rule - derive the
  path from the plan path alone, never accept a dispatch-supplied one - intact,
  and it is the only option that works in a worktree and under `/cad-task`.
  Rejected: the correlation id, which #195 asserts is "already unique per run"
  and is not (`trace.mjs:212-229` returns `${phase}-${sha}` from the newest
  `phase_start` anchor, so the run that died before committing anything re-mints
  the same string); and an orchestrator-minted timestamp, which relaxes the
  contract rule and needs a defined fallback for the `written:false` arms
  (`trace.mjs:262-290` withholds `corr` on `symlinked-trace`, `size-cap` and
  `stat-failed`, and `execute.md:117-120` tolerates all three).
  Evidence: `skills/cad-executor-contract/SKILL.md:195-203`;
  `cadence-core/bin/lib/trace.mjs:212-229`, `:239-249`, `:262-290`;
  `cadence-core/workflows/execute.md:110-120`; `cadence-core/workflows/task.md:56-70`.

- D-02 (The failing-capable test): The free-suffix choice is a pure function in
  `cadence-core/bin/lib/`, unit-tested against fixture directories; the executor
  contract states the rule in one sentence pointing at it. Prose-agreement
  assertions alone were rejected: under D-01 the current-run path is still
  `plan-<k>.md`, so there is no new literal to assert and a grep for a string the
  same commit writes cannot fail - which is the exact failure mode the "committed
  as a failing-capable test BEFORE the fix" criterion was written against.
  Evidence: `cadence-core/bin/prose-agreement.test.mjs:657-682`;
  `cadence-core/bin/planning.test.mjs:5609-5615`.

## Decisions

- D-03 (Staging): The state step stages `<plandir>/reports/` as a directory
  rather than `<plandir>/reports/plan-<k>.md` by name, and the existing
  never-stage rule for `plan-<k>-risk-task-<n>.diff` is restated against a
  directory. Without this, rotation leaves an unstaged deletion at the old
  tracked path and an untracked file at the new one, so the prior run's report
  survives in the working tree, is lost from history, and leaves the tree dirty.
  Evidence: `cadence-core/workflows/execute.md:455-458`;
  `skills/cad-executor-contract/SKILL.md:102` (the `<plandir>/reports/**` glance
  exemption already has this shape).

- D-04 (The locate refusal): The locate step refuses a phase whose DERIVED
  status is `executed` or `complete`, naming `/cad-undo <N>` then
  `/cad-execute <N>`, with an override flag as the deliberate way through. The
  `status` call becomes unconditional: today `execute.md:10-20` runs it only on
  the no-argument branch, so `/cad-execute 3` reaches locate with neither the
  derived status nor the plan-file list the next bullet consumes. `complete` is
  refused alongside `executed` because it re-runs identically today and destroys
  the same evidence one status later. The derivation, not the cursor, is the
  source: `planning.mjs:453-455` states the cursor is a hint the derivation beats.
  Evidence: `cadence-core/workflows/execute.md:10-20`;
  `cadence-core/bin/planning.mjs:274-289`, `:399-400`, `:453-455`, `:492-500`.

## Acceptance criteria

- [ ] AC1: The suffix-picker's tests pass across three fixture states - no
      report present, one present, several already rotated - and mutating the
      picker to return the base name unchanged fails at least one case.
- [ ] AC2: In a fixture plan directory, rotating twice leaves three readable
      reports, and the earliest one is byte-identical to its pre-rotation content.
- [ ] AC3: A prose-agreement test asserts that `execute.md`'s locate step refuses
      derived status `executed` and `complete`, and that its `status` call is not
      under the `else` branch; the test fails when either is reverted.
- [ ] AC4: `/cad-execute <N>` against a phase whose derived status is `executed`
      refuses, names `/cad-undo <N>` then `/cad-execute <N>`, and the phase trace
      records no executor dispatch for that invocation. (human-verify: needs a
      live /cad-execute run)
- [ ] AC5: `node cadence-core/bin/self-verify.mjs --root .` returns `ok:true`
      with an empty `problems` array, with `cadence-core/bin/weight-budgets.json`
      rows 65 and 91 re-pinned in the same commit as the prose edits.
- [ ] AC6: `/cad-report <N>` on a phase carrying a rotated report lists both
      reports.

## Flagged assumptions

- Issue #195's blast radius of "five sites" is wrong: there are sixteen. Eight
  in `execute.md` (`:189`, `:239`, `:243`, `:252`, `:344`, `:376`, `:413`,
  `:456`), two in the executor contract (`:74`, `:197`), and six outside them -
  `cadence-core/references/worktree-executor.md:25` (where the pathspec is
  load-bearing, since a bare `git commit` there would sweep in a staged risk
  diff), `cadence-core/workflows/task.md:67` and `:70`,
  `cadence-core/workflows/report.md:66`,
  `skills/cad-executor-contract/SKILL.md:102`,
  `cadence-core/bin/prose-agreement.test.mjs:681`, and
  `cadence-core/bin/weight-budgets.json:65,91`. Confident; if wrong: the fix
  lands on the three sites #195 counted and the surviving `execute.md` sites
  still name a path whose contents the rotation has moved.
- `/cad-undo` is NOT a site. `cadence-core/workflows/undo.md` contains zero
  occurrences of "report"; its manifest fallback is
  `.planning/phases/<N>/SUMMARY.md` falling back to `git log` filtered to the
  phase's commit scope (`undo.md:8-12`). #195's prose mis-attributes it.
  Confident; if wrong: a site is missed.
- Both target files sit at exactly their byte ceiling with zero headroom:
  `execute.md` at 27834 against the budget 27834, the executor contract at 12050
  against 12050 (measured 2026-08-19). `self-verify.mjs:736-739` flags
  `budget-overrun` on `bytes > budget`. Confident; if wrong: the phase lands and
  `self-verify` goes red on two rows, which every downstream step consults.
- No JavaScript reader constructs the report path - all sixteen sites are prose
  read by an agent. The only `.mjs` occurrences are test fixtures and the
  prose-agreement assertion. Confident; if wrong: a seam resolves the old path
  and answers `ok:true` about a file that is not there.
- The run component must stay in the FILENAME, not a per-run subdirectory:
  `report.md:66` globs `.planning/phases/<N>/reports/plan-*.md`, which matches a
  rotated `plan-1.1.md` and does not match `reports/<key>/plan-1.md`. Confident;
  this is what makes D-01's rotation compatible with `/cad-report`.
- No migration is needed: `find .planning/phases -type f` returns nothing after
  the v3.5.5 `--mode delete` close, and the 30 tracked `reports/plan-*` files all
  sit under `.planning/_archive-v*/`, which no reader targets - the recall corpus
  walk (`planning.mjs:2137-2163`) reads SUMMARY, UAT and CONTEXT only. Confident;
  if wrong: a backward-compatibility fallback gets built for a path nothing reads,
  on a file already at its byte ceiling.
- The override flag is new vocabulary: no `--force`, `--redo`, `--again` or
  `--override` exists on any Cadence workflow today, and adding one also touches
  `skills/cad-execute/SKILL.md`'s `argument-hint`, which nothing enforces. Left
  to the planner: the flag's spelling. Confident on the absence; if wrong: the
  refusal names a way through the user cannot discover.
