# Task: bound-plan-size

## What shipped

- Shipped in three commits: `093408c` (config key across schema, template, config-reach, catalog), `2c2b1ee` (ceiling into the cad-planner dispatch; `## PHASE TOO BIG` routes to `/cad-phase add`), `6ed57a7` (checker dimension 6). self-verify `ok:true` across 19 checks; 1356/1356 tests pass.
- Deviations, both in task 3. Dimension 5 already carried a soft "roughly <= 10 tasks per plan" bar, which the plan had not accounted for - so the change is a SPLIT of an existing dimension rather than a pure addition, and that soft bar moved into dimension 6 against the configured value.
- The reason it never fired is worth recording: dimension 5 asked for scope fidelity and size in one breath, and those two pull opposite ways, so the size half lost every time.
- `cadence-core/bin/self-verify.test.mjs` also joined the change - its placeholder-keys fixture enumerates every config key by design, so a new key fails it until listed. That failure was the config-keys check doing its job.
- Budgets re-pinned in the commit that grew each surface, per `3b7c3c4`: config-reach.md +211B, config.md +143B, templates/config.json +21B, plan.md +556B, cad-plan-checker-contract +646B. The plan.md arm was proved failing-capable: budget at 16145 reports `budget-overrun` naming the file by 1B, at 16146 self-verify is clean.
- Not done, and deliberately so: `workflows/context.md`'s size step still asks its one question before any task breakdown exists. The ceiling now lands where the breakdown actually happens, which is the planner, so moving the context question was not needed to close this defect.

## Commits

| Task | Commit | Description |
| --- | --- | --- |
| 1 | 093408c97560521e1e295ce949ac8beda2f29e50 | feat(config): add workflow.max_plan_tasks, the plan-size ceiling |
| 1 | 2c2b1eef15a547788e13b5b20b7cf7644f972a72 | feat(plan): hand cad-planner a task ceiling and route TOO BIG to phases |
| 1 | 6ed57a7a16b8f4bd2fa1ed537ddec43ccd06b287 | feat(plan-checker): ask whether the plan is proportionate, separately |

## Files

### Task 1: bound-plan-size

- **Files:** cadence-core/bin/self-verify.test.mjs, cadence-core/bin/weight-budgets.json, cadence-core/config.schema.json, cadence-core/references/config-reach.md, cadence-core/templates/config.json, cadence-core/workflows/config.md, cadence-core/workflows/plan.md, skills/cad-plan-checker-contract/SKILL.md
