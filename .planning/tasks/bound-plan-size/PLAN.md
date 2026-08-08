# Task: Bound plan size

Cadence has no ceiling on plan size, and that is the defect behind two
consecutive failed plan gates on phase 3 (planned at 10 tasks, cut, replanned at
15, both passing every existing gate). The gates that should catch it do not ask
the question:

- `skills/cad-plan-checker-contract/SKILL.md:10` asks "does this plan actually
  deliver the phase goal?" - which a BIGGER plan answers better. The checker is
  structurally biased toward growth.
- `cadence-core/workflows/context.md`'s size step asks one question with no
  task-count bar, fires before any task breakdown exists, and is forbidden from
  re-asking.
- `cadence-core/workflows/plan.md`'s only size lever is
  `workflow.inline_plan_threshold`, which routes SMALL plans inline and places no
  ceiling on a spawned one.

Net: a planner that over-builds is never told, and the human only sees it after
paying for two review rounds. `## PHASE TOO BIG` already exists as a return
marker (`workflows/plan.md` handle_return, planner contract reason 1) but is
reachable only by the planner's own judgement, against a contract that
simultaneously forbids reducing scope.

Constraint discovered before planning: `cadence-core/workflows/plan.md`,
`skills/cad-planner-contract/SKILL.md` and
`skills/cad-plan-checker-contract/SKILL.md` each sit EXACTLY at their
`weight-budgets.json` entry, so every task here must re-pin the budget it grows
in the same commit, per the convention at `3b7c3c4`.

## Task 1: Declare the ceiling as a config key

- **Files:** `cadence-core/config.schema.json`, `cadence-core/templates/config.json`,
  `cadence-core/references/config-reach.md`, `cadence-core/workflows/config.md`
- **Action:** Add `workflow.max_plan_tasks`, an `int` with `min` 1 and default 8,
  purpose "Task count above which a phase plan must return `## PHASE TOO BIG`
  instead of being written". Follow `workflow.inline_plan_threshold` exactly as
  the pattern - it is declared in all four places and self-verify's `config-keys`
  and `config-reach` checks enforce that. Default 8 is set against the evidence:
  the two plans that failed were 10 and 15 tasks, and the surviving phase-3 plan
  is 5.
  Behaviour comes in task 2; this task only makes the key exist and resolve.
- **Verify:** `node cadence-core/bin/config.mjs get workflow.max_plan_tasks`
  returns `8`. `node cadence-core/bin/self-verify.mjs` returns `ok:true` with an
  empty `problems` array - which fails if the key is missing from any of the four
  declaration sites. `node --test cadence-core/bin/config.test.mjs` passes.

## Task 2: Give the planner the ceiling, and route TOO BIG to smaller phases

- **Files:** `cadence-core/workflows/plan.md`, `cadence-core/bin/weight-budgets.json`
- **Action:** Add `workflow.max_plan_tasks` to the existing `config.mjs get`
  batch in the `parse` step - one call, no new round-trip.
  In `spawn_planner`'s prompt, state the ceiling as a directive line and make
  exceeding it a REQUIRED return rather than a judgement call: if the phase needs
  more than N tasks, return `## PHASE TOO BIG` instead of writing the plan. This
  is what makes reason 1 ("context cost") reachable without contradicting the
  planner's standing prohibition on reducing scope - the planner is not being
  asked to cut, it is being asked to report.
  In `handle_return`, change the `## PHASE TOO BIG` arm's first option from
  "restructure the roadmap" to the concrete route: `/cad-phase add` to split the
  work into SMALL independent phases, not into multiple plans inside this phase.
  State the reason inline, because it is not obvious: `plan-overlap` correctly
  refuses two plans declaring the same path, so multiple plans inside one phase
  cannot run concurrently, while `parallelization.max_concurrent_agents` is
  already 6 and independent phases can. Phases are also the unit that verifies
  and lands independently.
  Re-pin `workflows/plan.md`'s budget to its new size in the same commit.
- **Verify:** `grep -c 'max_plan_tasks' cadence-core/workflows/plan.md` returns at
  least 2 (the config batch and the dispatch directive).
  `node cadence-core/bin/self-verify.mjs` returns `ok:true` - it fails with
  `budget-overrun` if the budget was not re-pinned, and with `config-reach` if
  the key is read by a workflow the reach table does not record.
  Falsifier for the budget arm: temporarily lower the `workflows/plan.md` budget
  by 1 byte, confirm self-verify reports `budget-overrun` naming that file, then
  restore. Record both outputs in the commit body.

## Task 3: Ask the checker whether the plan is PROPORTIONATE, separately

- **Files:** `skills/cad-plan-checker-contract/SKILL.md`,
  `cadence-core/bin/weight-budgets.json`
- **Action:** Add a sixth dimension, Proportionality: is this the smallest plan
  that delivers the goal? Flag tasks that build tooling to police the phase's own
  work, verification apparatus heavier than the thing verified, and any plan
  exceeding `workflow.max_plan_tasks`.
  Two properties are load-bearing and must be stated, not implied. First, this
  question is INDEPENDENT of the goal question - a finding here is valid even
  when the plan would achieve the goal, precisely because "achieves the goal" and
  "is proportionate" otherwise trade off against each other and the goal question
  always wins. Second, its default severity is WARNING, not BLOCKER: an oversized
  plan still ships the phase, so inflating it would halt correct work. It becomes
  a BLOCKER only when the excess is itself a correctness risk.
  Re-pin the contract's budget in the same commit.
- **Verify:** `node cadence-core/bin/self-verify.mjs` returns `ok:true` (budget
  re-pinned, `agent-skills` and `CONTRACTS` checks still clean).
  `node --test cadence-core/bin/self-verify.test.mjs` passes.
  The contract names Proportionality as its own numbered dimension and states
  both the independence rule and the WARNING default: `grep -c 'Proportionality'`
  returns at least 1 and the surrounding text carries both.

## Outcome

Shipped in three commits: `093408c` (config key across schema, template,
config-reach, catalog), `2c2b1ee` (ceiling into the cad-planner dispatch;
`## PHASE TOO BIG` routes to `/cad-phase add`), `6ed57a7` (checker dimension 6).
self-verify `ok:true` across 19 checks; 1356/1356 tests pass.

Deviations, both in task 3. Dimension 5 already carried a soft "roughly <= 10
tasks per plan" bar, which the plan had not accounted for - so the change is a
SPLIT of an existing dimension rather than a pure addition, and that soft bar
moved into dimension 6 against the configured value. The reason it never fired
is worth recording: dimension 5 asked for scope fidelity and size in one breath,
and those two pull opposite ways, so the size half lost every time.
`cadence-core/bin/self-verify.test.mjs` also joined the change - its
placeholder-keys fixture enumerates every config key by design, so a new key
fails it until listed. That failure was the config-keys check doing its job.

Budgets re-pinned in the commit that grew each surface, per `3b7c3c4`:
config-reach.md +211B, config.md +143B, templates/config.json +21B, plan.md
+556B, cad-plan-checker-contract +646B. The plan.md arm was proved
failing-capable: budget at 16145 reports `budget-overrun` naming the file by 1B,
at 16146 self-verify is clean.

Not done, and deliberately so: `workflows/context.md`'s size step still asks its
one question before any task breakdown exists. The ceiling now lands where the
breakdown actually happens, which is the planner, so moving the context question
was not needed to close this defect.
