# State and records

Cadence keeps enough on disk for a new session to work out what the project intended, what changed and what remains. Git history preserves earlier versions of that record.

## The project and phase files

| Record | Purpose |
|---|---|
| `.planning/PROJECT.md` | Project purpose, constraints and current direction. |
| `.planning/REQUIREMENTS.md` | Requirements and their traceability. |
| `.planning/ROADMAP.md` | Phases and the goals they serve. |
| `.planning/STATE.md` | A cursor pointing at current work; a hint that progress checks against other evidence. |
| A phase's `CONTEXT.md` | Settled decisions and acceptance criteria. |
| Its `PLAN.md` or numbered plans | The tasks and checks to execute. |
| Its executor reports | Completed tasks, commits and remaining work. |
| Its `SUMMARY.md` | What the execution run delivered, deviations and open items. |
| Its `UAT.md` | Verification results, including pending CI and recorded CI verification. |

A summary says a run finished reporting. It doesn't by itself prove that the phase passed, or that a gap plan written later has been executed.

## Records have different jobs

The workflows assign ownership of updates. Executors report task work; the coordinator writes the phase summary and updates the cursor. Verification records acceptance results and updates completion state. Progress derives status and can reconcile a stale cursor.

That separation matters when files disagree. The answer is to examine the underlying plans, reports, checks and commits, not to pick whichever status looks most complete.

## Run evidence

`.planning/trace.jsonl` records dispatch and workflow events, including the information used for cost and review-outcome reporting. `.planning/reads.jsonl` records file paths read by tools, not file contents. These are local records, not telemetry sent to Cadence's author.

`/cadence:cad-report` reads the run record. `/cadence:cad-suggest` uses it to propose changes that the evidence supports. A missing or incomplete record limits what either can establish.

Deferred reviews have a durable queue because landing must still find them after a session ends. They don't become resolved because a conversation or a local trace disappeared.

See [project-record settings](../configuration/records.md) for committing planning documents, capture limits and recall, and [permissions and data](../reference/permissions.md) for where information is read or written.
