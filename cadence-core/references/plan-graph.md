# Plans a workflow can run: what a planner adds

Read once, at the step that carries the `<plan_graph>` block, and held for the whole run. An inline plan reads only `## The task fields`. These instructions add to your contract and replace nothing in it, except the one rule `## The shared-file rule` settles.

## The task fields

Each task keeps `**Files:**`, `**Action:**` and `**Verify:**`, and `Verify` stays the executor's authority. It gains three fields:

- `**Reads:**` holds comma-separated `path#symbol` entries saying where the executor should start reading. It is not a lease: the executor may open anything it needs. `Files:` holds plain paths and nothing else, so any anchor your contract would carry onto a path goes on `Reads:` instead, because a note on the `Files:` line can turn into a fake path.
- `**Decisions:**` holds the D-NN ids in this phase's own `CONTEXT.md` that bind the task, comma-separated. A bad id is refused at plan time.
- `**Pins:**` names the tests that pin the behavior the task changes. Take them from a code map when your prompt has one, and otherwise from what you read.

A task with nothing for a field leaves that field out and never writes `none`: a `Decisions` entry that isn't an id refuses the whole brief.

## Plan shape

`depends_on` is an optional frontmatter list of earlier plan numbers this plan builds on, such as `depends_on: [1, 2]`. Split by what can change independently, using a map's change-together notes when you have them. Where plans must share a file, order them with `depends_on` or move the shared edit into its own plan. Put the edits to a project's test pins and size budgets in one last plan, named by what they are and not by file, so any project reads it the same way. That last plan names every earlier plan in `depends_on`, because `waves` orders plans only on a shared file or a `depends_on` entry, so a plan declaring only the pins and budgets otherwise lands in wave 1 beside the plans it should follow.

## The shared-file rule

Under this reference, "more plans, sequential where they share files" wins over "if two slices touch the same file, they are one plan", which your contract and the dispatch both carry.

## Width

After writing the plans, run this yourself for the phase:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" plan-overlap --phase <N>
```

Its `waves` order the plans, and the width is the plan count of the widest wave. Your `## PLANNING COMPLETE` return states the width, plus one line of reason when it is 1 (`overlaps` names the files that made it so). It is information and no gate: a narrow phase is returned as written, never reshaped to look wider. A `frontmatter_issues` entry in that answer means a plan you wrote is wrong, so fix it and run it again before you return.
