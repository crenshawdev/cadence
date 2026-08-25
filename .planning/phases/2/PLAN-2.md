---
phase: 2
plan: 2
requirements:
  - HOK-01
  - HOK-02
  - TRC-02
files:
  - hooks/hooks.json
  - cadence-core/bin/subagent-trace.mjs
  - cadence-core/bin/lib/subagent-trace.mjs
  - cadence-core/bin/subagent-trace.test.mjs
  - cadence-core/bin/lib/read-trace.mjs
  - cadence-core/bin/read-trace.test.mjs
  - cadence-core/bin/lib/hook-events.mjs
  - cadence-core/bin/hook-events.test.mjs
  - cadence-core/bin/self-verify.mjs
  - cadence-core/bin/self-verify.test.mjs
  - cadence-core/bin/lib/arg-contract.mjs
  - cadence-core/bin/arg-contract.test.mjs
  - cadence-core/bin/lib/refusal-hints.mjs
  - cadence-core/bin/refusal-hints.test.mjs
  - cadence-core/workflows/execute.md
  - cadence-core/references/seam-spawn-agent.md
  - cadence-core/bin/prose-agreement.test.mjs
  - cadence-core/bin/trace.test.mjs
  - cadence-core/bin/weight-budgets.json
---

# Phase 2: The host writes the bracket - Plan 2

## Goal

A trace bracket survives session death. The host closes it: `SubagentStop` is a
registered Cadence hook that closes the bracket the orchestrator opened, the
orchestrator's hand-written `trace close` is KEPT as the fallback that carries
the figures, and `self-verify` pins the event names Cadence registers so a
rename reddens a check instead of going quiet.

## Must be true when done

- A Cadence subagent dispatch that returns and whose hand-written `trace close`
  never runs still shows up under `brackets` in `planning.mjs trace render`, not
  under `unpaired`.
- A dispatch whose hand-written close DOES run shows exactly one bracket, and
  that bracket still carries the token, tool-use and duration figures the
  hand-written close reported - the hook adds coverage and takes no figure away.
- A non-Cadence subagent - `general-purpose`, `Explore`, `fork`,
  `claude-code-guide` - stopping produces no trace event at all, and a Cadence
  subagent stopping when no matching dispatch is open produces none either.
- Renaming `SubagentStop` in `hooks/hooks.json` to a name the pinned set does
  not hold makes `node cadence-core/bin/self-verify.mjs` report a problem whose
  detail PRINTS the offending event name.
- `cadence-core/workflows/execute.md` enumerates who may write the trace with
  the hook among the writers, and its `<guardrails>` block, its lifecycle-bracket
  paragraph and `references/seam-spawn-agent.md` say the same thing rather than
  contradicting each other.
- `node cadence-core/bin/test.mjs` is green, including `trace.test.mjs`'s
  per-file `BRACKETING` loop still asserting one written `trace close` per
  dispatch moment - the hand-written close stays exercised.

## Context

CONTEXT.md's decisions bind this plan: D-01 (the stop payload carries NO
correlation id, phase, plan, token figure or duration - only `agent_id`,
`agent_type` and the base session fields), D-02 (`SubagentStop` ALONE becomes a
hook writer; the start half stays on `route.mjs resolve --bracket-read`), D-03
(the hook ADOPTS an open bracket rather than deriving a key), D-05 (`/cad-task`'s
hand-written close is load-bearing permanently - no subagent exists behind it),
D-07 (`self-verify` has no `hooks/` awareness today, so the pin is a new check
surface and NOT an extension of the markdown walk), D-08 (`SubagentStop` hooks
cannot be matcher-scoped, so the hook self-filters on `agent_type`) and D-15
(the writer statements criterion 7 corrects live in three places, and fixing one
in isolation contradicts the other two).

This plan runs AFTER PLAN-1 and shares files with it
(`cadence-core/references/seam-spawn-agent.md`,
`cadence-core/bin/weight-budgets.json`, the arg-contract pair,
`cadence-core/bin/trace.test.mjs`), so the two are sequential and never parallel.
It depends on PLAN-1 having landed: the dedup that lets two writers close one
bracket, and the `role` on `unpaired` rows that task 1 below reads.

Out of scope: hooking `SubagentStart` (D-02), registering any of the other hook
events the host exposes, and any change to what `route.mjs resolve` writes on
the dispatch half.

## Tasks

### Task 1: The rule that decides which bracket a stopped subagent closes

- **Files:** cadence-core/bin/lib/subagent-trace.mjs,
  cadence-core/bin/subagent-trace.test.mjs,
  cadence-core/bin/lib/read-trace.mjs, cadence-core/bin/read-trace.test.mjs
- **Action:** The first two paths are NEW files. Start reading at
  `ROLE_OF_STEM`, `roleOfAgent` and `HOST_AGENT_TYPES` in
  `cadence-core/bin/lib/read-trace.mjs`. Write the pure rule behind the `SubagentStop` hook, in the split
  `cadence-core/bin/lib/reference-routers.mjs` and
  `cadence-core/bin/lib/read-trace.mjs` already use: the rule reasons over
  values and the disk half stays in the bin script (task 2). Given the hook
  payload and a rendered trace, it answers with the close event to append, or
  with nothing. Three gates, in this order. FIRST, the self-filter (D-08): the
  host's `SubagentStop` runner passes no `matchQuery`, so this hook is called
  for every subagent type in the session, and this repository's own corpus
  carries `general-purpose`, `Explore`, `fork` and `claude-code-guide` beside
  the Cadence ones. `agent_type` arrives in the host's `<plugin>:<agent-file-stem>`
  spelling, so map it back through the SAME mapping `cadence-core/bin/lib/read-trace.mjs`
  already holds - `ROLE_OF_STEM`, fed by `lib/rung-agent.mjs`'s `RUNG_FILES`,
  read through `roleOfAgent`, which is currently module-private and needs
  exporting rather than copying: a second copy of that map is how two readers of
  one record start disagreeing, and `HOST_AGENT_TYPES` beside it already names
  the host's own types as a permanent floor. A type that maps to no role means
  DO NOTHING. SECOND, ADOPT, never derive (D-03): take the NEWEST `unpaired`
  dispatch whose `role` equals the mapped role - the field PLAN-1 task 4 puts on
  those rows - and use ITS `corr`, `phase` and `plan` verbatim. Deriving a key
  instead would write `role: "cadence:cad-executor-xhigh"`, a role row no
  `workflow.max_dispatch_tokens.<role>` key can ever match, and the payload
  carries no phase to derive one from anyway (D-01). No matching unpaired
  dispatch means DO NOTHING - the hook never invents a dispatch and never opens
  a bracket. THIRD, the event: a `lifecycle` `return`, carrying the adopted
  `corr`, `phase`, `plan` and `role` and NOTHING else. No `tokens`, no `turns`,
  no `duration_ms`, no `detail`: the payload carries none of them (D-01), and
  `cadence-core/bin/lib/trace.mjs`'s own token-provenance header states that a
  fabricated figure is strictly worse than an absent one - an invented figure
  would land in `trace suggest`'s share denominator and misprice every other
  role with it. Pure: no `fs`, no `emit`, no `process`, no `Date`, no
  randomness. Do NOT add a `reason`-bearing refusal envelope here; the hook has
  no stream to report on, and a bare do-nothing answer is what keeps this module
  out of self-verify check 22's scope.
- **Verify:** `node cadence-core/bin/test.mjs` is green plus a new
  `subagent-trace.test.mjs` proving, against synthetic payload/render pairs:
  `cadence:cad-executor-xhigh` maps to `cad-executor` and adopts the newest of
  two open `cad-executor` dispatches, quoting that row's `corr`, `phase` and
  `plan`; `general-purpose`, `Explore`, `fork` and `claude-code-guide` each
  produce nothing; a Cadence type with no matching unpaired row produces
  nothing; a payload missing `agent_type` entirely produces nothing; and the
  produced event carries no `tokens`, `turns`, `duration_ms` or `detail` key.

### Task 2: Register `SubagentStop` and let it write the close

- **Files:** cadence-core/bin/subagent-trace.mjs, hooks/hooks.json,
  cadence-core/bin/lib/arg-contract.mjs, cadence-core/bin/arg-contract.test.mjs,
  cadence-core/bin/lib/refusal-hints.mjs, cadence-core/bin/refusal-hints.test.mjs
- **Action:** `cadence-core/bin/subagent-trace.mjs` is a NEW file. Add the disk
  half and register it. The bin script is modelled on
  `cadence-core/bin/read-trace.mjs`, the PostToolUse recorder, and inherits its
  contract exactly: stdin carries the hook JSON, the script emits NOTHING on any
  stream and exits 0 unconditionally, every failure silent - a nonzero exit or
  stray stdout from a hook is fed back to the model as feedback, so a recorder
  that spoke would be editing the conversation it exists to measure. It resolves
  the project's `.planning` from the payload's `cwd` the way `read-trace.mjs`
  does, renders the trace through `cadence-core/bin/lib/trace.mjs`'s `renderTrace`
  with NO phase scope - the payload carries no phase (D-01) - hands the payload
  and that render to task 1's rule, and appends whatever it answers through
  `appendEvent`, which honours a caller-supplied `corr` and so joins the adopted
  bracket rather than re-deriving one off disk. In `hooks/hooks.json`, register
  `SubagentStop` beside the two existing events, pointing at the new script
  under `${CLAUDE_PLUGIN_ROOT}`. Declare NO `matcher` on the entry (D-08): the
  2.1.245 `Stop`/`SubagentStop` runner calls the dispatcher with no
  `matchQuery`, so a declared matcher is a filter the host will never apply and
  the self-filter in task 1 is the whole enforcement. Give the entry a `timeout`
  sized for a full parse of a 1 MiB `.planning/trace.jsonl` rather than copying
  the PostToolUse recorder's, which appends one line and parses nothing. The new
  top-level script needs a `CONTRACTS` row in
  `cadence-core/bin/lib/arg-contract.mjs` or self-verify check 14 reports
  `uncontracted-script`; it takes no flags and no subcommand, so the row is the
  same empty shape `read-trace.mjs` and `git-guard.mjs` already carry, which
  adds NO flag entries but moves the top-level row count - re-pin the
  flag-entries census in this same commit to 190 entries across 20 rows (the 190
  is PLAN-1's). If self-verify check 22 reports the new files, add a register
  row in `cadence-core/bin/lib/refusal-hints.mjs` rather than silencing the
  check, on the model of the `lib/read-trace.mjs` and `lib/trace.mjs` rows
  already there.
- **Verify:** `node cadence-core/bin/self-verify.mjs` reports `ok:true` - no
  `uncontracted-script`, no `refusal-hints` problem - and
  `node cadence-core/bin/test.mjs` is green with the census at 190 entries
  across 20 rows. Piping a synthetic `SubagentStop` payload naming a Cadence
  agent type into `node cadence-core/bin/subagent-trace.mjs` from a scratch
  project whose trace holds one matching open dispatch prints NOTHING, exits 0,
  and appends one `lifecycle` `return` line that `planning.mjs trace render`
  then shows under `brackets` with `unpaired` empty; the same pipe with
  `agent_type` `general-purpose` appends nothing. **human-verify:** with the
  plugin installed, run a real Cadence dispatch, let it return, and issue NO
  hand-written `trace close`; `planning.mjs trace render --phase 2` lists that
  worker under `brackets`, not `unpaired` (AC2, AC3 - needs a live subagent
  dispatch in the host, which the execution environment cannot produce).

### Task 3: `self-verify` pins the hook event names Cadence registers

- **Files:** cadence-core/bin/lib/hook-events.mjs,
  cadence-core/bin/hook-events.test.mjs,
  cadence-core/bin/self-verify.mjs, cadence-core/bin/self-verify.test.mjs
- **Action:** The first two paths are NEW files. Add the check that makes a hook
  rename LOUD. It is a NEW check
  surface, not an extension of an existing one (D-07): `self-verify`'s
  always-expected-input list covers `cadence-core/workflows`, `references`,
  `templates`, `skills`, `agents` and four named files, none of them
  `hooks/hooks.json`, and a check bolted onto the `mdFiles` walk never sees a
  JSON file - it would read green while pinning nothing, which is the exact
  silent failure the pin exists to prevent. Put the rule and its
  hand-maintained register in `cadence-core/bin/lib/hook-events.mjs`, the split
  `lib/reference-routers.mjs`, `lib/deferred-reads.mjs` and
  `lib/capture-writers.mjs` all use, with one row per event name Cadence
  registers and a one-line reason on each saying what that event is for. The
  register is hand-maintained for the reason `lib/reference-routers.mjs` states
  about its own: the set IS the statement, and a row is added in the same commit
  that adds a registration. The check reads the event names out of
  `hooks/hooks.json` and reports any name no row holds, with the OFFENDING EVENT
  NAME in the problem's detail - a problem that cannot name the event is a
  number. Wire it in `run(root)` beside the other whole-root rules, add its
  header entry to the numbered list at the top of `self-verify.mjs`, and add its
  token to the `checked` string on the emitted envelope, or a check that ran is
  indistinguishable from one that does not exist. Handle the file the way
  `weight-budgets.json` is handled: unreadable or malformed JSON is ONE reported
  problem rather than an unwound run, and an ABSENT file is a `missing-input`
  only on a full tree, so a minimal `--root` fixture stays lenient. Do NOT add
  the reverse direction - a registered row whose event `hooks.json` no longer
  carries - and do not check the command paths: the locked criterion is the
  event-name direction alone.
- **Verify:** `node cadence-core/bin/self-verify.mjs` reports `ok:true` with the
  new check's token in `checked`; against a fixture root whose
  `hooks/hooks.json` renames `SubagentStop` to a name outside the register, the
  same run reports `ok:false` and the problem's detail contains that exact
  spelling; a fixture with no `hooks/hooks.json` and no plugin manifest reports
  no problem from this check, while a full tree missing the file reports
  `missing-input`; a fixture whose `hooks/hooks.json` is malformed JSON reports
  one problem naming the file and the run still completes.

### Task 4: The prose says who may write the trace, in all three places

- **Files:** cadence-core/workflows/execute.md,
  cadence-core/references/seam-spawn-agent.md,
  cadence-core/bin/prose-agreement.test.mjs,
  cadence-core/bin/trace.test.mjs, cadence-core/bin/weight-budgets.json
- **Action:** Correct the writer enumeration, and correct it in all three places
  at once (D-15). `execute.md`'s `<guardrails>` block says nothing about the
  trace today, and the writer statements live in the process body instead: "The
  DISPATCH half rides each executor's own resolve... The CLOSE half stays with
  the caller", and the sentences saying a worktree executor emits no events of
  its own and that "the orchestrator's brackets are what make every worker
  attributable". `references/seam-spawn-agent.md`'s bracket rule states the same
  split from the seam side with "The CLOSE half stays with the caller, which
  alone sees the return". All of those are now false in one respect and still
  true in another, and the correction has to say both: the host's
  `SubagentStop` hook also closes a bracket, so the close half is no longer the
  caller's alone; the caller's close is KEPT and is still the only writer that
  can carry the token, tool-use and duration figures, because it alone sees the
  return. Add the guardrail bullet that ENUMERATES the writers - the dispatch
  half on `route.mjs resolve --bracket-read`, the hand-written `trace close`,
  and the `SubagentStop` hook - rather than appending a loose sentence, and
  make the body sentences agree with it; a bullet added in isolation contradicts
  the worktree-executor paragraph, and `prose-agreement.test.mjs` already holds
  `execute.md`/`seam-spawn-agent.md` agreement assertions plus five structural
  section reads on `execute.md`, so a half-correction is caught late rather than
  never. Say explicitly that the hand-written close is a FALLBACK kept on
  purpose and not a duplicate to prune: `/cad-task`'s phase-0 close has no
  subagent behind it and no hook will ever close it (D-05), and a hook-only
  design goes silently quiet on a host rename where a missing close renders as
  the visible `unpaired` defect. In the same pass add `--duration-ms` to
  `execute.md`'s `trace close` command line beside `--tokens` and `--turns`,
  under the same omit-rather-than-zero rule, so the largest spender in a phase
  actually records the wall clock PLAN-1's flag accepts. Re-pin the
  `cadence-core/workflows/execute.md` and
  `cadence-core/references/seam-spawn-agent.md` entries in
  `weight-budgets.json` to their measured post-edit byte counts in this commit
  (D-12) - the budget check is a ceiling and growth without a re-pin is a
  `budget-overrun`.
- **Verify:** `node cadence-core/bin/test.mjs` is green, including
  `prose-agreement.test.mjs`'s producer-clause comparison between `execute.md`
  and `seam-spawn-agent.md` and `trace.test.mjs`'s `BRACKETING` loop still
  asserting `closed === dispatched` for `execute.md` - the hand-written close is
  still written down and still exercised (AC7);
  `node cadence-core/bin/self-verify.mjs` reports `ok:true` with no
  `budget-overrun`; reading `execute.md`'s `<guardrails>` alone names all three
  trace writers, and no sentence anywhere in `execute.md` or
  `seam-spawn-agent.md` still says the close half is the caller's alone.

## Notes

**The split is sequential, not parallel.** CONTEXT's `Plan shape` directive
orders this plan after PLAN-1, and the two share
`cadence-core/references/seam-spawn-agent.md`,
`cadence-core/bin/weight-budgets.json`, `cadence-core/bin/lib/arg-contract.mjs`,
`cadence-core/bin/arg-contract.test.mjs` and `cadence-core/bin/trace.test.mjs`.
They must never be routed into separate worktrees.

**Two accepted costs D-03's adoption rule implies**, stated here rather than
worked around, because the decision is locked. First, the hook adopts the NEWEST
unpaired dispatch for a role, so two `cad-executor` workers running concurrently
on the parallel `/cad-execute` path can have their two closes attributed to each
other's worker key - both brackets still pair and both roles still bill
correctly, but the plan numbers can cross. The payload's `agent_id` is the field
that would fix it, and it can only be joined through a start-half hook, which
D-02 refuses on measured grounds. Second, a Cadence subagent dispatched from a
site that opens no bracket would have its stop adopt some OTHER open dispatch of
the same role; the nine bracketing sites `trace.test.mjs`'s `BRACKETING` map
pins are what keeps that set closed today.

**Two files declared defensively.**
`cadence-core/bin/lib/refusal-hints.mjs` and
`cadence-core/bin/refusal-hints.test.mjs` are in the lease so a register row can
be added in the same commit if self-verify check 22 classifies either new module
as a refusal site; task 1's Action is written to avoid that, and if the check
stays quiet neither file is touched. `cadence-core/bin/read-trace.test.mjs` is
declared because task 1 exports a currently-private function from
`cadence-core/bin/lib/read-trace.mjs`.
