# Phase 2: Context reduction - Measurements

Every number in this file comes from one command:

```
node cadence-core/bin/weight.mjs resident
```

The `## Before` figures were measured at `01d220a`, recorded in its child
commit - the run necessarily precedes the commit that writes this file, so the
sha named is the PARENT and the file lands in the child; the child commit cannot
move a single number here, because `.planning/**` is outside the measured walk,
which reads only `skills/`, `agents/` and
`cadence-core/{references,templates,workflows}`. Every figure in a TABLE below is
written as the seam prints it, digits only with no thousands separator, so a
re-run diffs against these rows literally; the prose around the tables uses
separators for readability.

**What the two command numbers mean.** EAGER is `skills/<name>/SKILL.md` plus
every path on an `@`-include line in it - the bytes the host injects before the
command's first turn, which then ride every remaining turn. REACHABLE is the
eager set plus every `cadence-core/{references,templates,workflows}` file the
text of those eager files names, ONE HOP OUT and never a transitive closure.
Both are published because the ranking inverts between them: `cad-land` is the
heaviest of the five measured commands under eager and the second-lightest under
reachable. Publishing one alone would let this phase claim or lose its result by
choosing a spreadsheet (D-04).

**Orchestrator and dispatch bytes stand side by side and are never summed**
(D-05). A dispatch's bytes land in a FRESH subagent context, not in the
orchestrator's, so a combined total would grow with plan count and stop being
reproducible from the tree.

## Before

Measured at `01d220a` - pre-cut, so these are the true baseline bytes.

### Commands (all 23), by eager bytes descending

The five commands this phase is measured on are in **bold**.

| Command | Eager B | Reachable B |
|---|---:|---:|
| **cad-land** | 32676 | 57540 |
| **cad-execute** | 25017 | 90923 |
| cad-config | 20260 | 42646 |
| **cad-verify** | 20136 | 89388 |
| **cad-plan-review** | 17511 | 37764 |
| cad-context | 17442 | 78731 |
| **cad-plan** | 16438 | 66411 |
| cad-milestone | 15935 | 60085 |
| cad-new-project | 15598 | 61224 |
| cad-decision-review | 12213 | 27347 |
| cad-audit | 11533 | 61718 |
| cad-phase | 11006 | 30751 |
| cad-undo | 10642 | 30387 |
| cad-progress | 8920 | 36803 |
| cad-pause | 8477 | 28222 |
| cad-debug | 8181 | 31910 |
| cad-coverage | 5162 | 11608 |
| cad-help | 4889 | 24371 |
| cad-task | 4784 | 26364 |
| cad-health | 4756 | 9871 |
| cad-docs-verify | 3960 | 3960 |
| cad-spike | 3898 | 3898 |
| cad-capture | 2345 | 2345 |

**Workhorse mean (eager):** (`cad-execute` 25,017 + `cad-plan` 16,438 +
`cad-verify` 20,136) / 3 = **20,530.33 B**. This is the bar AC3 measures
`cad-land` against.

### Dispatch weight, per agent file

| Agent | Role | Agent B | Preloaded contract | Dispatch B |
|---|---|---:|---|---:|
| agents/cad-assumptions-analyzer-high.md | cad-assumptions-analyzer | 475 | cad-assumptions-analyzer-contract | 4581 |
| agents/cad-assumptions-analyzer.md | cad-assumptions-analyzer | 505 | cad-assumptions-analyzer-contract | 4611 |
| agents/cad-executor-xhigh.md | cad-executor | 411 | cad-executor-contract | 13036 |
| agents/cad-executor.md | cad-executor | 424 | cad-executor-contract | 13049 |
| agents/cad-plan-checker-high.md | cad-plan-checker | 444 | cad-plan-checker-contract | 4919 |
| agents/cad-plan-checker-medium.md | cad-plan-checker | 452 | cad-plan-checker-contract | 4927 |
| agents/cad-plan-checker-xhigh.md | cad-plan-checker | 448 | cad-plan-checker-contract | 4923 |
| agents/cad-plan-checker.md | cad-plan-checker | 462 | cad-plan-checker-contract | 4937 |
| agents/cad-planner-max.md | cad-planner | 393 | cad-planner-contract | 9047 |
| agents/cad-planner-xhigh.md | cad-planner | 401 | cad-planner-contract | 9055 |
| agents/cad-planner.md | cad-planner | 415 | cad-planner-contract | 9069 |
| agents/cad-reviewer-max.md | cad-reviewer | 422 | cad-reviewer-contract | 4030 |
| agents/cad-reviewer-medium.md | cad-reviewer | 434 | cad-reviewer-contract | 4042 |
| agents/cad-reviewer-xhigh.md | cad-reviewer | 430 | cad-reviewer-contract | 4038 |
| agents/cad-reviewer.md | cad-reviewer | 451 | cad-reviewer-contract | 4059 |
| agents/cad-verifier-max.md | cad-verifier | 424 | cad-verifier-contract | 10068 |
| agents/cad-verifier-medium.md | cad-verifier | 436 | cad-verifier-contract | 10080 |
| agents/cad-verifier-xhigh.md | cad-verifier | 432 | cad-verifier-contract | 10076 |
| agents/cad-verifier.md | cad-verifier | 458 | cad-verifier-contract | 10102 |

## Zero-resident

These budgeted reference files appear in no command's reachable set at all: they
enter no model context, so a cut there would move the main thread by zero bytes,
and no delta in this file may claim them as a saving (D-09). The set is derived
by the same command, never hardcoded.

| Surface | Bytes |
|---|---:|
| cadence-core/references/config-reach.md | 18412 |
| cadence-core/references/model-hints.json | 2635 |
| cadence-core/references/provider-api.md | 5048 |
| **Total** | **26095** |

## After

Filled in at task 8.
