# Cost

The useful question is what it costs to finish the work with enough confidence to keep it. A cheap dispatch that creates a day of rework wasn't cheap.

Cadence gives you separate choices for role models, effort, review gates and external providers. Start with the work the role has to do, then use the run record to see where the spend went.

## Read an actual run

```text
/cadence:cad-report 1
/cadence:cad-report --all
```

The report brings together dispatch costs and recorded outcomes. Use `/cadence:cad-suggest` when you want configuration suggestions tied to that evidence. It proposes changes; it doesn't apply them itself.

The trace can be incomplete, and a reported cost is only as good as the data available for that dispatch. Treat gaps as gaps.

## Context is part of the cost

A command loads some instructions immediately and may read more as it works. A subagent receives a separate context. These aren't interchangeable measurements.

| Term | What it measures |
|---|---|
| Eager | The command skill and files it preloads before its first turn. |
| Reachable | The eager set plus existing referenced workflow, template and reference files one hop away. Potential reading, not all loaded at startup. |
| Dispatch | An agent file and its preloaded role contracts in the subagent's context. |

From a Cadence checkout, the current tree can be measured with:

```sh
node cadence-core/bin/weight.mjs resident --root .
```

Don't add command and dispatch weights together and call the result the main session's context. They belong to different contexts. The [measurement reference](https://github.com/crenshawdev/cadence/blob/main/docs/EVIDENCE.md) explains the definitions and available commands.

## What the historical figures mean

The [published cost notes](https://github.com/crenshawdev/cadence/blob/main/docs/COST.md) contain dated measurements from my own account. They compare my Cadence sessions with my freeform work; they aren't a controlled experiment or a prediction of your bill.

For your project, use your own run record. Change a setting for a reason you can name, then see whether it improved the work. More reviewers and higher effort both need to earn their place.
