# Task: excerpt-telemetry

## What shipped

- The reads recorder now sees excerpt and records outcomes. RECORDED_TOOLS and the PostToolUse matcher gained mcp__excerpt__excerpt_read and excerpt_search, so a dispatch that reads entirely through excerpt no longer records zero reads. Every recorded call now carries is_error when the response states one, plus the first line of the cause capped at 200 bytes and passed through redactCause, which masks credential-shaped values while keeping their names. excerpt_search records its scope and never its pattern, mirroring Grep. A blocking risk_surface review by openai/gpt-5.6-sol returned three findings; both highs were refuted by running their own scenarios, the medium was accepted as the intended behaviour, and the redaction was adopted from the residual the first high pointed at. hooks.json changed, so the matcher is not live until Claude Code restarts.

## Commits

| Task | Commit | Description |
| --- | --- | --- |
| 1 | 8fadf4bb379de2d325cc92178eed03d1282a0f90 | feat(read-trace): record excerpt's reads and every call's outcome |
| 1 | 6d708ef5ac8367c126658cf761e19d8d409d088d | fix(read-trace): mask credential values in a recorded cause line |

## Files

### Task 1: excerpt-telemetry

- **Files:** .planning/tasks/excerpt-telemetry/REVIEW-risk_surface-task-excerpt-telemetry.md, cadence-core/bin/lib/read-trace.mjs, cadence-core/bin/read-trace.test.mjs, hooks/hooks.json
