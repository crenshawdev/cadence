# Roles and context

A long conversation is a poor place to keep the only copy of a project decision. Cadence puts that decision in a file and gives each role the context it needs for its part of the work.

The main session coordinates. Subagents do bounded jobs and return results that the main session can inspect and route.

| Role | Responsibility |
|---|---|
| Assumptions analyzer | Examine the code and the unresolved assumptions before planning. |
| Planner | Turn the phase's goal and decisions into executable plans. |
| Plan checker | Check a plan against its context when that optional pass is enabled. |
| Executor | Implement a plan, run checks and record task commits. |
| Reviewer | Challenge a plan, diff or decision with findings tied to evidence. |
| Verifier | Work backward from the goal to examine whether it was achieved. |

These are separate contexts, not a guarantee that the judgments will be independent or correct. A fresh reviewer can miss a defect or repeat an assumption. Its findings still need grounding in the code, and behavioral claims still need evidence.

## A continuation reads the record

A paused or interrupted executor doesn't need its old conversation restored. A fresh continuation reads the plan and the report of completed work, with Git history establishing what was committed.

The report is important here. It lets the coordinator ask for the remaining work instead of paying for a new attempt at tasks that already landed.

## Model and effort are separate choices

Each role has a model setting and a starting effort setting. In Cadence's dispatch design, model selection is passed with the dispatch; effort comes from the selected agent file's frontmatter. The files share a role contract so a different effort level doesn't introduce a different set of instructions.

Those settings govern Cadence's subagents. Your main session's model and effort remain Claude Code choices. External API reviewers have their own provider model tiers and effort settings.

Use the [role configuration](../configuration/roles.md) to choose them. Raising every role's effort isn't a substitute for a clear plan or a useful assertion.
