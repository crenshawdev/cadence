---
phase: 3
plan: 2
requirements: [MIN-01]
files:
  - cadence-core/workflows/minimalism-review.md
  - skills/cad-minimalism-review/SKILL.md
  - cadence-core/bin/weight-budgets.json
---

# Phase 3: The lens and the loop back - Plan 2 (the delete-list pass)

## Goal

An on-demand minimalism pass exists as its own command: it dispatches the
existing `cad-reviewer` role with a delete-hunting instruction, returns a ranked
delete-list in the shared reviewer findings shape, and applies nothing.

## Must be true when done

- `cadence-core/workflows/minimalism-review.md` defines a pass that hunts
  reinvented stdlib, single-implementation abstractions, dead flexibility and
  config nobody sets, over a target the user names.
- The pass dispatches the EXISTING `cad-reviewer` role and returns the
  subsystem's `{findings:[{file,line,severity,claim,failure_scenario}]}` shape,
  with `severity` carrying the rank - no bespoke list shape.
- The pass edits nothing: no source file, no planning file, no config key.
- `skills/cad-minimalism-review/SKILL.md` is a user-invocable command whose
  execution context is that one workflow file.
- `cadence-core/route-table.json`'s `roles` array still holds six entries and
  `cadence-core/config.schema.json` carries no `minimalism` review trigger.
- `node cadence-core/bin/self-verify.mjs` reports an empty `problems` array,
  with both new surfaces carrying budget rows.

## Context

- D-04 locks the shape: an on-demand command in the `/cad-decision-review` mold
  - its own skill plus one `cadence-core/workflows/*` file dispatching the
  existing `cad-reviewer` role - never a sixth `fire(trigger)`, a seventh
  routable role, or a `--deep` arm on `/cad-verify`.
- D-05 locks the return: the shared findings schema at
  `skills/cad-reviewer-contract/SKILL.md:50-71`, and the apply-nothing posture is
  `cadence-core/references/triage-gate.md`'s arms minus any fix arm.
- D-06 leaves the config question open and names the cheaper arm; this plan
  takes NO config keys, so nothing reaches `config.schema.json` or
  `references/config-reach.md` and `inert-config-key` cannot fire.
- The precedent to copy, end to end, is
  `cadence-core/workflows/decision-review.md` plus
  `skills/cad-decision-review/SKILL.md`: no wiring-table row, no routing cell,
  the base `cad-reviewer` at the session default.

## Tasks

### Task 1: Write the minimalism-review workflow

- **Files:** cadence-core/workflows/minimalism-review.md, cadence-core/bin/weight-budgets.json
- **Action:** Create `cadence-core/workflows/minimalism-review.md` in the shape of
  `cadence-core/workflows/decision-review.md`: a `<purpose>` saying why this pass
  is separate from the correctness reviewer (an adversarial correctness review
  structurally cannot catch over-building - nothing it checks is wrong) and that
  it never auto-fires, then a `<process>` of named steps. Steps, in order: resolve
  the target from `$ARGUMENTS` - a path, a directory, or a phase whose committed
  range is the target - asking once through the ask-user seam when it is empty or
  ambiguous, and stopping rather than guessing when the named target does not
  exist. Then bracket and dispatch: write the lifecycle dispatch half with
  `planning.mjs trace append --phase <N> --family lifecycle --event dispatch --plan cad-reviewer --role cad-reviewer --read "<target>"`
  taking `<N>` from the STATE cursor (`planning.mjs cursor get`), dispatch
  `cad-reviewer` through the spawn-agent seam with an `{instruction, artifact}`
  payload whose instruction names the four species this pass hunts - reinvented
  stdlib, single-implementation abstractions, dead flexibility, config nobody
  sets - and says plainly that correctness defects are NOT its subject, then close
  the bracket with the `return` event the moment the findings are in hand, omitting
  `--tokens` on a figureless return and closing as `checkpoint` with a `--detail`
  when the dispatch failed or returned nothing parseable. Use only the flags
  `cadence-core/bin/self-verify.mjs`' CONTRACTS row for `trace append` lists, and
  copy the invocation spelling from `decision-review.md:52-68` rather than
  inventing one. Then present: the returned findings ranked by `severity`
  (`blocker`, `high`, `medium`, `low`), each carrying its own `file`, `line`,
  `claim` and `failure_scenario` as the reviewer returned them, and an explicit
  empty-result line rather than a bare "no findings", so a pass that ran clean
  never reads like a pass that never ran. State that this arm resolves no routing
  cell and takes no config keys of its own - it is the base `cad-reviewer` at the
  session default, at every stakes level - so a reader is not left looking for a
  tier/effort pair. `<guardrails>` carry the apply-nothing posture: nothing is
  edited, deleted, committed or configured; the delete-list is input to the user's
  decision exactly as the triage gate treats review findings, and there is no fix
  arm. Do not claim concurrency anywhere - this pass makes one dispatch, and check
  10 reads concurrency prose in workflows. Add the file's measured byte count as a
  row in `cadence-core/bin/weight-budgets.json` in the same commit.
- **Verify:** `node cadence-core/bin/self-verify.mjs` prints `"problems":[]`
  (no `unbudgeted-surface`, no `missing-path`, no `dispatch-phrasing` entry);
  `node -e "const j=require('./cadence-core/route-table.json');console.log(j.roles.length)"`
  prints 6; and `grep -c minimalism cadence-core/config.schema.json` returns 0.

### Task 2: Ship `/cad-minimalism-review` as a discoverable skill

- **Files:** skills/cad-minimalism-review/SKILL.md, cadence-core/bin/weight-budgets.json
- **Action:** Create `skills/cad-minimalism-review/SKILL.md` in the mold of
  `skills/cad-decision-review/SKILL.md`: frontmatter with `name:
  cad-minimalism-review`, a ONE-LINE routing description naming what the command
  returns (a ranked delete-list over code that works and should not exist) and
  carrying its trigger words, an `argument-hint`, and an `allowed-tools` list
  holding exactly what the workflow needs - Read, Bash, Glob, Grep, Task and
  AskUserQuestion. It declares no MCP tools: unlike `/cad-decision-review` this
  pass grounds nothing against library docs. The body is an `<objective>` stating
  that the capability lives entirely in the workflow and that this pass applies
  nothing, an `<execution_context>` `@`-including
  `${CLAUDE_PLUGIN_ROOT}/cadence-core/workflows/minimalism-review.md`, and a short
  `<process>` that resolves the target, runs the workflow end to end, and presents
  the ranked list without applying any of it. A `cadence-core/workflows/*` include
  is exempt from check 16's consumer rule, so no other reference is `@`-included
  here. Add the skill's measured byte count as a row in
  `cadence-core/bin/weight-budgets.json` in the same commit. Do NOT register the
  command in `cadence-core/references/COMMANDS.md`, `README.md` or
  `.planning/DOCS-CLAIMS.md` here - plan 4 owns those three surfaces for both of
  this phase's new commands, in one re-pinned commit each.
- **Verify:** `node cadence-core/bin/self-verify.mjs` prints `"problems":[]`;
  `node cadence-core/bin/weight.mjs` reports
  `skills/cad-minimalism-review/SKILL.md` at exactly its budgets row; and
  `grep -L "user-invocable: false" skills/*/SKILL.md | wc -l` counts one more
  user-invocable skill than before this task.
  human-verify: run `/cad-minimalism-review` against a named target in a live
  session and observe (1) a ranked delete-list whose entries carry `file`, `line`,
  `severity`, `claim` and `failure_scenario`, and (2) `git status --short`
  byte-identical before and after the run.

## Notes

- Both this phase's new command names were the planner's call under the CONTEXT
  flagged assumption. `cad-minimalism-review` follows the existing
  `plan-review` / `decision-review` family so the cluster it joins in
  `references/COMMANDS.md` reads consistently.
- D-06's open question is answered NO here: the pass takes no config keys and
  runs at the session default, which is the cheaper arm the decision names.
  There is therefore no cross-model arm - a provider call needs a resolved
  `review.providers.<name>.tiers[<tier>]` and no tier key exists for this pass.
- This plan shares `cadence-core/bin/weight-budgets.json` with plans 1, 3 and 4,
  so the phase's plans run sequentially. It must land before plan 4, which
  registers this command.
