# Task: task-record-slug-filter

## What shipped

- taskRecordsIn now applies isTaskSlug to every tasks/ entry name before joining it onto a path.
- Containment judged where a path resolved and nothing about how its NAME read, so an entry called `a\n## Commits` or one carrying a terminal escape resolved inside the planning root and reached /cad-why's rendered output and the recall index verbatim.
- Four rows in task-record.test.mjs pin it: refused spellings, a newline and a terminal escape, an over-long name, and the invariant that every slug returned satisfies isTaskSlug. Three of the four fail when the guard line is removed.
- Closes the third open item from the phase 3 summary, raised medium by the plan 2 risk_surface review and ruled down to low.

## Commits

| Task | Commit | Description |
| --- | --- | --- |
| 1 | 8f43985442fda61948c935224816a30ef8720703 | fix: a task entry name the writer would refuse is not listed back |

## Files

### Task 1: task-record-slug-filter

- **Files:** cadence-core/bin/lib/task-record.mjs, cadence-core/bin/task-record.test.mjs
