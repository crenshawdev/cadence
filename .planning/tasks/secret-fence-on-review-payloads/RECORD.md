# Task: secret-fence-on-review-payloads

## What shipped

- An outbound secret fence on the cross-model review seam, closing GH-167.
- Review payloads are raw repository contents and max_prompt_tokens was the only
- thing applied to them before the write. Both paid commands now cross a fence -
- redactUrl composed with redactCredentials, the same shared helper the inbound
- excerpt already used, no new pattern in the tree - after the shape gate and
- before the cap, with the removed-span count on the ok envelope and the
- provider/request event.
- Making that safe took the redactors from quadratic to linear: they had only ever
- run on a 4096-byte excerpt, and a whole artifact hung the suite outright. Three
- bounds, none of which moves a verdict - whitespace segmentation, a literal
- pre-check per rule, and a lookbehind pinning each rule to the start of a run.
- The blocking risk_surface gate fired twice and cost four more commits. It also
- could not be settled at all: adjudication --phase 0 refused no-phase-dir, which
- is GH-227 case B, so a task's fire record gained the home the seam will accept -
- authorized mid-run, since every remaining strike would have hit the same wall.
- One medium survives and is captured: --task has no converse guard.

## Commits

| Task | Commit | Description |
| --- | --- | --- |
| 1 | 46022937f4bda24536a5772cc5b62d8332062b21 | perf(redact-url): the redactors survive a whole artifact, not just an excerpt |
| 1 | 94c73e8a9dd2bc6c86b2b176d41029b43a4ccb04 | feat(review-provider): fence the outbound payload before it leaves the machine |
| 1 | 364be4dc7c85fdc43d9ca26670ab47ed431e0976 | docs(review): the seam contract states the outbound fence and its limit |
| 1 | 2499e2117541062c33187c283586ab2083274414 | fix(review-provider): the fence cannot hang the run, and cannot report a false zero |
| 1 | 4a2ce02fe00c2860355ac358d3f290c8b2c4bc12 | fix(redact-url): pin the scheme rules at a run start, not merely at a non-letter |
| 1 | f860560e86f23d579a05e41e7fb96ebb646d3017 | feat(planning): a task's fire record gets a home the seam will accept |
| 1 | 2d81c61e05606ac832bee86ae0a39364d3652f88 | fix(planning): the task home cannot be followed out of the tree, and phase 0 needs its slug |
| 1 | a85234de9b79f8815cbe570065f5d0c3a71b1832 | docs: task record for secret-fence-on-review-payloads |

## Files

### Task 1: secret-fence-on-review-payloads

- **Files:** .planning/tasks/secret-fence-on-review-payloads/ADJUDICATION-risk_surface-cad-task-4a2ce02f-r2.json, .planning/tasks/secret-fence-on-review-payloads/ADJUDICATION-risk_surface-cad-task-4a2ce02f.json, .planning/tasks/secret-fence-on-review-payloads/ADJUDICATION-risk_surface-cad-task-f860560e-r2.json, .planning/tasks/secret-fence-on-review-payloads/ADJUDICATION-risk_surface-cad-task-f860560e.json, .planning/tasks/secret-fence-on-review-payloads/PLAN.md, .planning/tasks/secret-fence-on-review-payloads/REVIEW-risk_surface-cad-task-4a2ce02f-r2.md, .planning/tasks/secret-fence-on-review-payloads/REVIEW-risk_surface-cad-task-4a2ce02f.md, .planning/tasks/secret-fence-on-review-payloads/REVIEW-risk_surface-cad-task-f860560e-r2.md, .planning/tasks/secret-fence-on-review-payloads/REVIEW-risk_surface-cad-task-f860560e.md, cadence-core/bin/arg-contract.test.mjs, cadence-core/bin/lib/arg-contract.mjs, cadence-core/bin/lib/redact-url.mjs, cadence-core/bin/planning-adjudication.test.mjs, cadence-core/bin/planning/adjudication.mjs, cadence-core/bin/planning/core.mjs, cadence-core/bin/redact-url.test.mjs, cadence-core/bin/review-provider.mjs, cadence-core/bin/review-provider.test.mjs, cadence-core/bin/weight-budgets.json, cadence-core/references/review-cross-model.md, cadence-core/references/review-record.md, cadence-core/references/seam-review-provider.md, cadence-core/workflows/task.md
