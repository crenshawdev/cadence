# Phase 3: The too-big arm opens a door - Context

Gathered: 2026-08-29
Feeds: /cad-plan 3

## Scope boundary

In: PHS-02. `cadence-core/workflows/task.md`'s too-big arm stops naming a
command that will refuse an off-roadmap phase, and names `/cad-phase add`
instead, carrying the task's own description into it. The two other sites
that state the old route move in the same edit - `task.md:269`'s guardrail
and `skills/cad-task/SKILL.md:20`'s objective, which rides the main session
prompt. `cadence-core/workflows/context.md:32`'s hintless stop gains the
same pointer so the door opens from either side. `skills/cad-phase/SKILL.md`'s
`argument-hint` gains the description the `add` arm already accepts.
Out: `/cad-phase add`'s own behaviour, the roadmap grammar, and any change to
what `/cad-context` or `/cad-plan` do once the phase line exists - the chain
downstream of the appended line is already unbroken and this phase adds no
capability. No write under `.planning/tasks/<slug>/`: an arm that does no work
scaffolds nothing.
Deferred: none. The size check kept AC1-AC7 in one plan.
Plan shape: one plan - four prose files, one `argument-hint` line, one
budget re-pin, and tests in existing files; no new module and no seam change.

## Durable decisions

- D-01 (the open door): the corrected sequence opens with `/cad-phase add`.
  It is the only command in the plugin that appends a phase to an existing
  roadmap, and three other workflows already route to it for exactly this
  reason. Evidence: `cadence-core/workflows/phase.md:13-20` (the `add` arm
  appends the list line and detail section, no renumber),
  `cadence-core/references/roadmap-phases.md:167`,
  `cadence-core/workflows/plan.md:26-28`,
  `cadence-core/workflows/progress.md:192`,
  `cadence-core/workflows/milestone.md:220`. Rejected: naming any other
  command, which routes the user into the same locked door renamed.
- D-02 (sequence length): the arm prints THREE stops -
  `/cad-phase add` -> `/cad-context {N}` -> `/cad-plan {N}` - unconditionally,
  never branching on config. `/cad-context` stays in it because it is the pass
  that turns the carried description into criteria; dropping it throws away
  what D-04 carries. Rejected: the two-step `/cad-phase add` -> `/cad-plan {N}`
  leaning on CONTEXT.md being optional (`cadence-core/workflows/context.md:12-13`),
  and printing both and letting the user pick the way
  `cadence-core/workflows/plan.md:240-268` does - more prose against a file
  already at its byte ceiling. Evidence for not branching:
  `cadence-core/references/config-reach.md:123` narrows `skip_discuss` to the
  progress next-step suggestion only, matching `config.schema.json:29`.
- D-03 (the number): the arm RESOLVES the phase number with
  `node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" status` and prints
  the real next number (`total + 1`), rather than printing a bare `{N}` the user
  substitutes. This cycle's whole thread is that Cadence holds the answer and
  the code beside it declines to read it; a placeholder here repeats that defect
  under a new name. Evidence: `cadence-core/workflows/phase.md:14` states `add`
  lands at `current total + 1`; `planning.mjs status` returns `total` directly
  (verified 2026-08-29: `{"ok":true,"current":3,"total":5,...}`);
  `cadence-core/bin/planning/status.mjs:132-155` derives phases from the roadmap
  list. Rejected: a literal number (wrong the moment `add` lands elsewhere) and
  a bare placeholder (hands the user a substitution Cadence can make itself).
- D-04 (carry-forward): the arm passes the task's own description as the
  `/cad-phase add` ARGUMENT. `cadence-core/workflows/phase.md:15` already takes
  the name, description and criteria "from args or the ask-user seam", so this
  is real carry-forward with no new write. Rejected: stating plainly that
  nothing carries (criterion 3's cheaper second arm, but it makes the user
  retype what Cadence already has), and persisting via
  `planning.mjs capture --kind seed` - CAPTURE.md is in the recall corpus and
  would reach the planner, but it costs a row in
  `cadence-core/bin/lib/capture-writers.mjs:117-146` or self-verify check 23
  (`cadence-core/bin/self-verify.mjs:200-214`) reports the site `unregistered`
  and AC7 fails.
- D-05 (far side): `cadence-core/workflows/context.md:32`'s stop gains a
  pointer to `/cad-phase add`. PHS-02 as written scopes to the too-big arm, so
  this is scope grown by explicit user choice, taken because a user arriving by
  any other route - a stale STATE cursor, a typed number - still meets a
  refusal that names no next step. Evidence: the line reads "If the phase number
  is not in the roadmap, stop and say so." (verified 2026-08-29) and names
  nothing further; `cadence-core/bin/self-verify.mjs:181-199` lints refusal
  hints only on `.mjs` sites emitting an `ok:false` envelope, so nothing forces
  this and nothing forbids it. Not taken: having `resolve_phase` create the
  phase inline, which collides with `task.md:268-269`'s "rather than improvising
  a phase inline" and widens `/cad-context`.

## Decisions

- D-06 (the three old-route sites): exactly three places state the wrong route
  and they move together - `cadence-core/workflows/task.md:35` ("This is
  phase-sized. Route it through /cad-context -> /cad-plan, or /cad-capture it
  for later."), `task.md:269` (the guardrail's mid-task re-route), and
  `skills/cad-task/SKILL.md:20` ("Feature-sized requests get re-routed to
  /cad-context."). A tree-wide grep for `cad-context` across both task surfaces
  returns exactly these three (verified 2026-08-29). The SKILL objective rides
  the main session prompt, so leaving it advertises the locked door while the
  workflow body names the open one.
- D-07 (byte ceilings): `cadence-core/bin/weight-budgets.json` is re-pinned in
  the SAME commit as the prose. Every file this phase touches sits exactly at
  its ceiling, measured with `wc -c` on 2026-08-29: `workflows/task.md`
  14131/14131 (`:81`), `workflows/context.md` 19421/19421 (`:66`),
  `workflows/phase.md` 3448/3448 (`:75`), `skills/cad-task/SKILL.md` 737/737
  (`:114`), `skills/cad-phase/SKILL.md` 1112/1112 (`:105`). A one-byte addition
  turns `self-verify` red with a `budget-overrun` and fails AC7.
- D-08 (nothing is persisted today): the too-big arm writes no trace event, no
  directory and no record, so D-04 is the phase's own carry rather than a
  pointer at something already on disk. Evidence:
  `cadence-core/workflows/task.md:41-43` excludes the too-big arm from the
  `bracket` step that mints the run directory; `:102-106` and `:221-225` make
  `planned_path` and the `task-record` seam the only writers under
  `.planning/tasks/{slug}/`.
- D-09 (no scaffolding): the arm creates nothing under
  `.planning/tasks/<slug>/`. Evidence: `cadence-core/workflows/task.md:104-106`,
  `:153-160`, `:168-182`, `:276-277` - the workflow states this about itself,
  and the too-big arm is the one arm that does no work at all.
- D-10 (the archived UAT criterion does not bind): the v3.6.0 phase 3 UAT item
  "task.md names no planning machinery" is not enforced anywhere live and the
  same archive records it as already false against shipped code
  (`.planning/ARCHIVE.md:657`, `:665`). The live file names `/cad-context` at
  `task.md:35` and `:269` today. No test in `cadence-core/bin/*.test.mjs` joins
  `cad-context` to `task.md`; `prose-agreement.test.mjs`'s only `task.md`
  assertions are at `:244-246`, `:1176-1186` and `:1404-1410`, none touching the
  `scope` step.
- D-11 (line-pinned linters do not bind): `citation-census.test.mjs` pins
  `planning*.mjs:<line>` citations and DOCS-CLAIMS rows naming the planning
  seam, not workflow prose (`:73`, `:206-210`, `:217-250`; the four pinned rows
  are `lease-check.mjs`, `trace.mjs`, `uat.mjs`, `criteria-coverage.mjs`).
  Phase 1's deviation was an inserted line in `planning/*.mjs`, which this phase
  does not touch. `.planning/DOCS-CLAIMS.md:230-232` states the column is
  provenance, not an address.
- D-12 (self-verify's whole-surface checks apply to what the arm prints): the
  new `planning.mjs status` call must match the real flag contract, its
  `${CLAUDE_PLUGIN_ROOT}` path must exist, and no dotted config token may appear
  that the schema lacks. Evidence: `cadence-core/bin/self-verify.mjs:11-23`
  (checks 1-3), `:47-68` (check 10), `:178-199` (checks 19, 22).

## Acceptance criteria

- [ ] AC1: `cadence-core/workflows/task.md`'s too-big arm names `/cad-phase add`
      as the first action and prints the sequence
      `/cad-phase add` -> `/cad-context {N}` -> `/cad-plan {N}`; the arm's text
      contains no route that starts at `/cad-context`.
- [ ] AC2: the arm resolves the phase number by calling
      `node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" status` and
      printing `total + 1`, rather than a literal or an unsubstituted
      placeholder. Proved by running that command on this repo and matching the
      number the arm's stated rule produces.
- [ ] AC3: the printed sequence passes the task's own description as the
      `/cad-phase add` argument, and `skills/cad-phase/SKILL.md`'s
      `argument-hint` advertises that `add` accepts one.
- [ ] AC4: all three old-route sites have moved -
      `grep -n "cad-context" cadence-core/workflows/task.md
      skills/cad-task/SKILL.md` returns no line that routes a phase-sized task
      to `/cad-context` as its first stop.
- [ ] AC5: `cadence-core/workflows/context.md`'s off-roadmap stop names
      `/cad-phase add` as the next action.
- [ ] AC6: following the printed sequence in a live session from a repo whose
      roadmap has no matching phase reaches a planned phase with no command
      refusing. (human-verify: needs a live Claude Code session)
- [ ] AC7: `node cadence-core/bin/test.mjs` is green and
      `node cadence-core/bin/self-verify.mjs` reports `ok:true`, with
      `cadence-core/bin/weight-budgets.json` re-pinned in the same commit for
      every prose file whose byte count changed.

## Flagged assumptions

- The chain after `/cad-phase add` is unbroken today, so no gate downstream of
  the appended roadmap line refuses a freshly added phase - Confident
  (`cadence-core/workflows/context.md:29-32`, `workflows/plan.md:74-75`,
  `bin/planning/plan-size.mjs:163-183` reports rather than refuses,
  `bin/lib/planning-files.mjs:427-443` is the criteria-heading grammar the
  `add` detail section must match); if wrong: AC6 fails at a gate nobody
  predicted and the phase grows a second workflow's repair.
- The mechanical half of AC6 is a fixture proof through `planning.mjs status`
  and the roadmap gates; there is no runner that executes three slash-command
  workflows in CI - Likely
  (`cadence-core/references/acceptance-criteria.md:30` defines the
  `human-verify` grammar; `bin/lib/planning-files.mjs:56-101` and
  `bin/planning/status.mjs:132-155` report a phase the moment its list line
  exists); if wrong: the planner spends a task building a runner this repo has
  no precedent for.
