# Plans a workflow can run: what a planner adds

Read once, at the step that carries the `<plan_graph>` block, and held for the whole run. An inline plan reads only `## The task fields`.

## The task fields

Each task has `**Files:**`, `**Action:**` and `**Verify:**`, and `Verify` stays the executor's authority. It also has three more fields:

- `**Reads:**` holds comma-separated `path#symbol` entries saying where the executor starts reading. It is not a lease: the executor may open anything it needs. When the phase's decisions cite evidence inside a file a task touches, that anchor goes on `Reads:` as the file plus a symbol (function, export or heading), never a line number. An anchor never narrows the lease and never licenses skipping a caller check. `Files:` holds plain paths and nothing else, so an anchor goes on `Reads:` and never on `Files:`.
- `**Decisions:**` holds the D-NN ids in this phase's own `CONTEXT.md` that bind the task, comma-separated. A bad id is refused at plan time.
- `**Pins:**` names the tests that pin the behavior the task changes, from a code map when your prompt has one and otherwise from what you read.

A task with nothing for a field leaves that field out and never writes `none`: a `Decisions` entry that isn't an id refuses the whole brief.

## Plan shape

`depends_on` is an optional frontmatter list of earlier plan numbers this plan builds on, such as `depends_on: [1, 2]`. Split by what can change independently, using a map's change-together notes when you have them. A plan that needs another plan's result without sharing a file with it names that plan in `depends_on`. Where plans must share a file, order them with `depends_on` or move the shared edit into its own plan. Put the edits to a project's test pins and size budgets in one last plan, named by what they are and not by file. An entry in a record every plan adds to, such as a changelog, is a task of that last plan too. That last plan names every earlier plan in `depends_on`, because `waves` orders plans only on a shared file or a `depends_on` entry.

When the last plan would pass the task ceiling, write more than one. Take the earlier plans in order, keep each one's pins together, and start a new last plan only when the next plan's pins do not fit. The shared-record task goes in the final one, and each of these plans names every plan before it in `depends_on`. Never move one of these tasks into an earlier plan to make room.

## Width

After writing the plans, run this yourself for the phase:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" plan-overlap --phase <N>
```

Its `waves` order the plans, and the width is the plan count of the widest wave. Your `## PLANNING COMPLETE` return states the width, plus one line of reason when it is 1 (`overlaps` names the files that made it so). It is information and no gate: a narrow phase is returned as written, never reshaped to look wider. A `frontmatter_issues` entry in that answer means a plan you wrote is wrong, so fix it and run it again before you return.

## Brief size

Run this yourself before you return, for each plan file you wrote or edited, `<k>` from its name and 1 for a bare `PLAN.md`:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" brief --phase <N> --plan <k>
```

It writes nothing. When its `ok:false` says the brief is over its ceiling, split that plan's tasks across more plans the way `## Plan shape` orders them, then run `plan-overlap` and this check again. Any other `ok:false` goes in your return as it stands.
