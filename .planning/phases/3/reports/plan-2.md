PLAN COMPLETE
Plan: .planning/phases/3/PLAN-2.md
Tasks: 2 of 2
| Task | Commit | Note |
|---|---|---|
| 1: Write the minimalism-review workflow | 31518d3 | New `cadence-core/workflows/minimalism-review.md` (8,244 B) in `decision-review.md`'s shape: purpose / three-step process (`resolve_target`, `dispatch`, `present`) / guardrails / success criteria. Four species named in the instruction, which states plainly that correctness is not the subject and that the retarget is what displaces the reviewer contract's default. One `cad-reviewer` dispatch through the spawn-agent seam, bracketed `--event dispatch` with a non-empty `--read`, closed on BOTH the `return` and the `checkpoint` arm; no concurrency prose anywhere. Budget row pinned at the measured value in the same commit. Verify: self-verify `problems:[]`, `roles.length` 6, `grep -c minimalism cadence-core/config.schema.json` 0. |
| 2: Ship `/cad-minimalism-review` as a discoverable skill | 923896b | New `skills/cad-minimalism-review/SKILL.md` (2,333 B): one-line routing description, `argument-hint` for the three target shapes, `allowed-tools` = Read/Bash/Glob/Grep/Task/AskUserQuestion and no MCP tool, `<execution_context>` `@`-including the workflow only, three-step `<process>`. COMMANDS.md, README.md and DOCS-CLAIMS.md deliberately untouched (plan 4 owns them). Budget row pinned in the same commit. Verify: self-verify `problems:[]`; `weight.mjs` reports the skill at exactly 2,333 against its row; user-invocable skills 25 -> 26. |

Deviations: none

Open items:
- The plan's task-2 human-verify half is not walkable from a dispatch and is
  routed to `/cad-verify 3` as CONTEXT AC3: run `/cad-minimalism-review` against
  a named target in a live session and observe (1) a ranked delete-list whose
  entries carry `file`, `line`, `severity`, `claim` and `failure_scenario`, and
  (2) `git status --short` byte-identical before and after the run. The
  mechanical half of the same Verify passed in full, and the three static halves
  of AC3 hold at 923896b: `route-table.json` `roles` is 6, `config.schema.json`
  has no `minimalism` trigger, and self-verify is green.
- Budget rows this plan added, for plans 3 and 4 to pin against rather than the
  CONTEXT's 2026-08-13 measurements: `cadence-core/workflows/minimalism-review.md`
  8,244 and `skills/cad-minimalism-review/SKILL.md` 2,333. Plan 1's re-pins
  (`skills/cad-executor-contract/SKILL.md` 10,718, `skills/cad-land/SKILL.md`
  12,041) are untouched here.
- `cadence-core/bin/trace.test.mjs`'s `BRACKETING` map is per-FILE and this new
  workflow's one dispatch bracket is not in it, so nothing asserts that
  `minimalism-review.md` keeps its bracket. The census test still validates the
  bracket's family, event, `--role` and `--read` globally, which is why the suite
  is green either way. Adding the row would touch a file outside this plan's
  lease; noted for whoever next edits that map.
