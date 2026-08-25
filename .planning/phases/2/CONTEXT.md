# Phase 2: The host writes the bracket - Context

Gathered: 2026-08-25
Feeds: /cad-plan 2

## Scope boundary

In: `SubagentStop` registered in `hooks/hooks.json` and writing the trace
bracket's close half; a real dedup on `(corr, phase, plan)` in
`cadence-core/bin/lib/trace.mjs`; a new `self-verify` check pinning the hook
event names Cadence registers; one `--duration-ms` flag on `trace close`; and
the host-return contract documented in `references/seam-spawn-agent.md` with
`config.schema.json`'s six stale citations corrected.

Out: hooking `SubagentStart` (D-02); registering any of the other 29 hook
events the host exposes; the worktree question (GH-117, held in the
`Worktree verdict` milestone); any change to what `route.mjs resolve` writes on
the dispatch half.

Deferred: None.

Plan shape: multiple plans, same phase. Criterion 1's own wording - the
host-return contract is documented BEFORE any hook writes anything - orders the
split: the documentation, dedup and duration groundwork (AC1, AC4, AC6) lands
before the hook writer and its pin (AC2, AC3, AC5).

## Durable decisions

- D-01 (host contract): Neither `SubagentStart` nor `SubagentStop` carries a
  correlation id, a phase, a plan/worker key, a token figure or a duration. The
  only join material is `agent_id` (start-to-stop), `agent_type`, and the base
  `session_id`/`transcript_path`/`cwd`. This is the OQ-2 answer and it closes
  the question rather than deferring it again. Evidence: measured against the
  running binary at `/home/john/.local/share/claude/versions/2.1.245`; the
  payload field sets were confirmed independently at gather time. Compare
  `cadence-core/bin/lib/trace.mjs:212` (`correlationId` derives `<phase>-<sha>`
  from disk, never from a caller) and `cadence-core/bin/route.mjs:832-844`.
- D-02 (host contract): `SubagentStop` alone becomes a hook writer. The start
  half stays on `route.mjs resolve --bracket-read`, which already knows phase,
  plan and role at dispatch time. Hooking both was considered and refused: a
  start hook must guess the phase, and both available sources are measurably
  stale - `.planning/STATE.md` read `Phase: 1 of 3` while this very `/cad-context 2`
  run was phase 2, and the newest `lifecycle/phase_start` anchor is written only
  by `workflows/execute.md:109` and `workflows/task.md:52`, so a `/cad-plan` or
  `/cad-context` dispatch runs under a stale one. Two writers deriving different
  corrs never dedup; the result is one permanent extra `unpaired` row per
  dispatch, which is worse than the 11 unpaired the record carries today.
  Evidence: `cadence-core/bin/planning/cursor-get.mjs`, `.planning/trace.jsonl`
  (75 `phase_start` anchors, latest `{phase:'1', sha:'aeca7fd3'}`).
- D-03 (bracket identity): The Stop hook ADOPTS an open bracket rather than
  deriving a key. It maps `agent_type` to a role and closes the newest unpaired
  dispatch for that role. `agent_type` arrives as `<plugin>:<agent-file-stem>`
  (e.g. `cadence:cad-executor-xhigh`), so the hook strips the prefix and reverse-
  maps the rung stem; the mapping already exists at
  `cadence-core/bin/lib/read-trace.mjs:394-417` (`ROLE_OF_STEM`, `roleOfAgent`)
  fed by `lib/rung-agent.mjs`'s `RUNG_FILES` (19 stems over 6 roles). Deriving
  instead of adopting would write `role: "cadence:cad-executor-xhigh"`, a role
  row no `workflow.max_dispatch_tokens.<role>` key can ever match.
- D-04 (bracket identity): `renderTrace`'s existing replay guard is NOT a dedup
  and will not suppress a second close from a different writer. It keys on
  `worker\0event\0role\0ts\0tokens\0turns`
  (`cadence-core/bin/lib/trace.mjs:684`), so two closes are collapsed only when
  they agree to the millisecond - which a hook close and a hand-written close
  never do. Line 689's `pending.shift()` then hands the second close a different
  open dispatch. A real dedup is this phase's work, not an existing behavior to
  lean on. The comment at `lib/trace.mjs:598-603` already names this phase as
  the one that owes the fix.
- D-05 (bracket identity): `/cad-task`'s hand-written close is load-bearing
  permanently. No subagent exists behind it, so no hook will ever close it:
  `cad-task` is absent from `cadence-core/route-table.json`'s six roles and has
  no file under `agents/`. Evidence: `cadence-core/workflows/task.md:219` closes
  `--phase 0 --plan <slug> --role cad-task`; v3.6.0 phase 3's D-03 established
  that the inline arm's trace holds zero lifecycle/dispatch events. Any design
  that treats the hook as primary and prunes hand-written closes deletes phase
  0's only bracket.
- D-06 (duration): `trace close` grows a `--duration-ms` flag with a STRING-
  tolerant grammar, not a plain `int`. The host surfaces its duration as a
  formatted human string inside `Done (N tool uses - X tokens - Ys)`, the same
  renderer whose token grouping already forced the comma-stripping exception at
  `cadence-core/bin/planning/trace.mjs:448-470`. Declaring the flag `int` to
  match `--tokens`/`--turns`/`--raised` (`lib/arg-contract.mjs:861-870`) would
  refuse the only spelling an orchestrator can copy, stranding the worker in
  `unpaired`. Computing the duration at render instead (`lib/trace.mjs:709`
  already derives `ms` from the two timestamps) was considered and refused: it
  measures dispatch-to-close wall clock including orchestrator time, which is a
  different quantity than TRC-02 names.
- D-07 (pins): `self-verify` has NO `hooks/` awareness today, so criterion 5's
  pin is a new check surface rather than an extension of an existing one. Its
  always-expected-input list (`cadence-core/bin/self-verify.mjs:505-515`) covers
  `cadence-core/workflows`, `references`, `templates`, `skills`, `agents` and
  four named files - none of them `hooks/hooks.json` - and no test under
  `cadence-core/bin/` asserts anything about the registration. A check bolted
  onto the markdown walk (`mdFiles`) never sees `hooks/hooks.json` and would
  read green while pinning nothing, which is the exact silent failure the pin
  exists to prevent.

## Decisions

- D-08 (host contract): `SubagentStop` hooks cannot be matcher-scoped, so the
  hook self-filters on `agent_type` and `hooks/hooks.json` declares no matcher
  it will not get. In the 2.1.245 bundle the `SubagentStart` runner passes
  `matchQuery: <agent_type>` into the hook dispatcher while the `Stop`/
  `SubagentStop` runner calls it with no `matchQuery` at all. Non-Cadence
  subagent types are already present in this repo's corpus - `general-purpose`
  1,983, `Explore` 96, `fork` 152, `claude-code-guide` 6 of 31,226 records in
  `.planning/reads.jsonl` - and `lib/read-trace.mjs:392` already names
  `HOST_AGENT_TYPES` as a permanent floor for this reason.
- D-09 (bracket identity): The "worker key" the roadmap names is
  `(corr, phase, plan)` in code, not `(corr, role)`, and `plan` is caller-chosen
  text. `cadence-core/bin/lib/trace.mjs:650` builds
  `worker = ${corr}\0${phase}\0${plan}`; `route.mjs:839` writes
  `plan: opts.bracketPlan || opts.role`. Across the shipped close sites `--plan`
  equals the role for `cad-planner`, `cad-plan-checker`, `cad-verifier`,
  `cad-assumptions-analyzer` and `cad-reviewer`, but is the plan NUMBER for
  `cad-executor` (`workflows/execute.md:230`, with `:240-243` stating why) and
  the task SLUG for `cad-task` (`workflows/task.md:219`). A hook keying on the
  role would mismatch on 170 of this record's 386 dispatches.
- D-10 (pins): The `arg-contract-flag-entries` census is at 189 across 19 rows
  today, so one added flag moves it 189 -> 190. The roadmap's criterion 6 says
  185 -> 186 and is wrong. Evidence: `cadence-core/bin/arg-contract.test.mjs:303`
  asserts 189, confirmed at gather time. The plan's lease must declare the real
  number.
- D-11 (pins): The `seam-call-counts` census does NOT move for this phase.
  It counts literal seam INVOCATIONS in `workflows/plan.md` (14) and
  `workflows/context.md` (6) only (`cadence-core/bin/seam-calls.test.mjs:139`,
  scoped by `lib/census-registry.mjs:258-276`), and adding a flag to an existing
  `trace close` line adds no invocation. Criterion 8's seam-calls clause is
  CONDITIONAL - re-pin only if a prose edit adds or removes a literal call - not
  work to schedule. Declaring that test in a lease would widen the plan's
  surface for nothing.
- D-12 (pins): `weight-budgets` is the pin that actually moves, because every
  budget is the surface's exact current byte count and criterion 1's
  documentation has to land in a budgeted file. Current entries:
  `references/seam-spawn-agent.md` 19863, `workflows/execute.md` 31480,
  `references/conventions.md` 15457, `references/seams.md` 2323.
  `cadence-core/bin/self-verify.mjs:788-804` raises `budget-overrun` on any
  surface over its entry, exactly as `review-triggers.md` did in phase 1.
- D-13 (prose): The dispatch contract this phase edits is
  `cadence-core/references/seam-spawn-agent.md`, a cold branch of the `seams.md`
  router - NOT `seams.md`, which is now 2,323 B and carries none of it.
  `lib/reference-routers.mjs:101-104` registers the branch; the bracket rule and
  the `max_dispatch_tokens` argument live at `seam-spawn-agent.md:29` and
  `:104-131`. An edit aimed at `seams.md` would grow the hot file phase 1 exists
  to keep small.
- D-14 (prose): `cadence-core/config.schema.json:32-37`'s six
  `max_dispatch_tokens` purposes still end "references/seams.md carries the
  argument", which phase 1 moved to `seam-spawn-agent.md:29`. Criterion 1's
  documentation resolves this rather than inheriting it; a reader following the
  citation today finds a 45-line router with no argument in it.
  `references/config-reach.md:125-130` is correct and unaffected.
- D-15 (prose): `execute.md`'s `<guardrails>` block (`:532-544`, six bullets)
  says nothing about the trace today. The writer statements criterion 7 wants
  corrected live in the process body at `:216-255` ("The DISPATCH half rides
  each executor's own resolve... The CLOSE half stays with the caller",
  `:252-255` on worktree executors emitting no events of their own), and
  `references/seam-spawn-agent.md:110-111` states the same split from the seam
  side. Correct all three consistently: a guardrail bullet added in isolation
  contradicts `:252-255`, and `prose-agreement.test.mjs` catches it late - that
  file already holds `execute.md`/`seam-spawn-agent.md` agreement assertions at
  `:656-687` and section reads on `execute.md` at `:268`, `:733`, `:923`,
  `:961`, `:1145`.

## Acceptance criteria

- [ ] AC1: `references/seam-spawn-agent.md` names all three figures Cadence
      reads off a subagent return (tokens, tool uses, duration), the code
      depending on each (the bracket system, `weight-budgets.json`, the six
      `max_dispatch_tokens` keys), and states that the rendering can change with
      no deprecation, with the existing recovery (omit `--tokens` on a figureless
      return, render `unrecorded` distinctly from `0`) named as the mitigation
      already in force. `grep -n 'seams\.md' cadence-core/config.schema.json`
      returns no hit inside the six `max_dispatch_tokens` purposes.
- [ ] AC2: `hooks/hooks.json` registers `SubagentStop`, and a Cadence dispatch
      completed with NO hand-written `trace close` issued still appears closed in
      `planning.mjs trace render --phase 2`.
      (human-verify: needs a live subagent dispatch in the host)
- [ ] AC3: A dispatch whose close never runs is still paired: `trace render`
      lists it under `brackets`, not `unpaired`.
      (human-verify: needs a live subagent dispatch in the host)
- [ ] AC4: When both writers fire on one dispatch, `trace render` shows exactly
      one close for that `(corr, phase, plan)` and `unpaired` gains no row. A
      test drives both paths against a fixture and asserts the count is 1.
- [ ] AC5: Renaming a registered event in `hooks/hooks.json` to a name outside
      the pinned set makes `self-verify` report a failure that prints the
      offending event name. Checked by running `self-verify` against a mutated
      fixture.
- [ ] AC6: `trace close --duration-ms` accepts the host's formatted spelling
      (e.g. `1m 23s`) without refusal, `trace render` reports a duration per
      bracket, and `arg-contract.test.mjs` asserts 190 flag entries.
- [ ] AC7: `node cadence-core/bin/test.mjs` is green, and `trace.test.mjs`'s
      `BRACKETING` loop still asserts `closed === dispatched` over prose files -
      the hand-written close remains exercised.

## Flagged assumptions

- The host's subagent-return duration is a formatted human string rather than an
  integer, read off the same TUI renderer as the token and tool-use figures -
  Likely; if wrong and an integer is reachable, D-06's string grammar is looser
  than it needed to be, which costs nothing but an unused tolerance.
- `SubagentStop` cannot be matcher-scoped (D-08) - Likely; if wrong, the hook's
  self-filter is redundant rather than harmful, and `hooks/hooks.json` may
  declare a matcher after all.
- The phase a start-half hook would need is not reliably recoverable from disk
  (D-02's basis) - Likely; if a reliable dispatch-scoped phase source exists that
  this pass missed, OQ-2 could resolve the other way and the start half becomes
  hookable in a later phase.
