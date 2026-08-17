# `workflow.max_plan_tasks`: the ceiling re-decided against both of its forces

Dated 2026-08-17. PLN-01, `v3.5.3` phase 4. Every figure below names the command
that produced it, so a later reader can re-run the arithmetic rather than trust
it. Where a figure moves because the record keeps growing, that is said at the
figure rather than hidden.

Tracked on purpose, past `.gitignore`'s `/design-notes/dd-*.md` line: the
decision has to outlive the milestone close that removes
`.planning/phases/4/SUMMARY.md`, so this file is force-added rather than left
local like the candid explorations that share its prefix.

## Why the number needed re-deciding

`workflow.max_plan_tasks` was set against ONE of its two forces. Context risk -
a plan outrunning a single executor context - is the force the record can see,
because a checkpoint leaves an event behind. Cold-prefix cost - what a phase
pays for having MORE plans, since each extra plan is another dispatch paid from
zero - was never measured, so the ceiling was argued from half its own problem.
Both are priced here.

## Force 1: cold-prefix cost, which argues for FEWER, larger plans

```
node cadence-core/bin/weight.mjs resident
```

Per-role `dispatchBytes` - the bytes a dispatch of that role carries before it
has read anything of the project - measured 2026-08-17:

| Role | `dispatchBytes` |
|---|---|
| `agents/cad-executor.md` | 12,488 |
| `agents/cad-planner.md` | 11,664 |
| `agents/cad-verifier.md` | 11,277 |
| `agents/cad-assumptions-analyzer.md` | 5,986 |

with `zeroResidentBytes` 40,577 in the same run - references no command preloads
at all, which is the surface this figure is NOT.

Run through the tree's single estimator (`measure()` in
`cadence-core/bin/lib/surface-weight.mjs`, cited here rather than restated so
there is one place the conversion lives), the executor's 12,488 bytes are about
3,122 estimated tokens.

Against the measured executor dispatch below, that fixed prefix is about **2%**
of one dispatch. So the honest form of this force is not "the prefix is
expensive". It is: an extra plan re-buys the other 98%.

What the other 98% is, measured rather than asserted. A fresh executor pays a
cold pass over its plan file and the phase's own artifacts - PROJECT, CONTEXT,
the plan, the files the plan declares - and then reads more during the dispatch.
Summing `statSync` over each plan's declared `files:` list, running the total
through the same estimator, and comparing it to that plan's final terminal
`tokens` on `.planning/trace.jsonl`:

| Plan | Declared read-set (est tok) | Final window (tok) | Share |
|---|---|---|---|
| `.planning/phases/3/PLAN-1.md` | 51,700 | 196,928 | 26% |
| `.planning/phases/3/PLAN-2.md` | 42,508 | 130,795 | 33% |
| `.planning/phases/3/PLAN-3.md` | 43,434 | 89,618 | 48% |

Phase 4 CONTEXT D-06 measured the same three at 26-47% before this phase's own
commits changed those files' sizes; the shares above are the re-run at
execution time. Either way the reading is the same: the declared set is a
quarter to a half of the live window and in-dispatch reading is the rest, and
BOTH are paid again by an additional plan. The 12,488-byte prefix is the
smallest term in the bill an extra plan produces, which is exactly why this
force cannot be argued from the prefix alone.

## Force 2: context risk, which argues for SMALLER plans

```
grep -c '"event":"checkpoint"' .planning/trace.jsonl
grep '"event":"checkpoint"' .planning/trace.jsonl | grep -c '"role":"cad-executor"'
```

**21 `checkpoint` events, 15 of them `cad-executor`**, as of 2026-08-17. A
checkpoint is a fresh-context continuation paid at full dispatch price, so it is
the observable of a plan outrunning one context.

The denominators are LIVE and move under the figure:

```
grep -c '"event":"dispatch"' .planning/trace.jsonl   # 182 at 2026-08-17
grep -c '"event":"return"'   .planning/trace.jsonl   # 157 at 2026-08-17
```

CONTEXT D-17 recorded 177/153 for the same two counts earlier the same day, and
the checkpoint numerator itself moved from 20/14 to 21/15 while this phase was
executing - phase 4's own plan-1 dispatch added one. Re-count before quoting;
the decision rests on the shape of the numerator, not on a frozen pair.

The mechanism that reads it is already shipped:
`cadence-core/bin/lib/trace-suggest.mjs`'s R4 rule fires at
`MIN_CHECKPOINTS_FOR_SIZE_SUGGESTION = 2` executor checkpoints with
`action: 'workflow.max_plan_tasks'` - so on this record the tree is already
suggesting this key be tuned.

And the executor window those checkpoints came out of, over every terminal
lifecycle event (`return` and `checkpoint`) carrying a `tokens` figure:

```
node -e 'const v=require("fs").readFileSync(".planning/trace.jsonl","utf8")
  .split("\n").filter(Boolean).map((l)=>JSON.parse(l))
  .filter((e)=>(e.event==="return"||e.event==="checkpoint")
    && e.role==="cad-executor" && typeof e.tokens==="number")
  .map((e)=>e.tokens).sort((a,b)=>a-b);
  console.log(v.length, Math.round(v.reduce((a,b)=>a+b)/v.length),
    v[Math.ceil(0.75*v.length)-1], v[v.length-1]);'
```

n=75, mean 147,740, 75th percentile (nearest-rank) 185,999, max 275,285, as of
2026-08-17. That p75 is the same figure `workflow.max_dispatch_tokens.cad-executor`
was derived from in this phase's plan 1, so the two decisions are reading one
record.

## The falsifying observation

R4 fires on executor checkpoints. It does NOT establish that the ceiling
produced them, and on this record it did not. Every executor checkpoint in this
milestone came from a plan already UNDER the ceiling:

| Checkpoint | Plan | Tasks in it |
|---|---|---|
| 2026-08-16 phase 1 plan 2 | `.planning/phases/1/PLAN-2.md` | 3 |
| 2026-08-16 phase 2 plan 1-fix | `.planning/phases/2/PLAN-1.md` | 6 |
| 2026-08-16 phase 2 plan 1-cut | `.planning/phases/2/PLAN-1.md` | 6 |
| 2026-08-17 phase 4 plan 1 | `.planning/phases/4/PLAN-1.md` | 5 |

(task counts: `grep -c '^### Task ' <plan>`; the plans older than this milestone
were pruned with their phases, so their task counts are no longer readable and
are not claimed here.)

Two of the four are structural checkpoints - a plan needed a file its lease did
not declare - which is not context pressure at all, one is a risk-fix round
handed back for authorization, and only the fourth is a partial return, at 5
tasks. So a ceiling of 8 was not the binding constraint on any of them, and
lowering it would not have prevented one.

## The landing: 8 stands

This is a re-decision that lands on the same number, not a change. The two
forces meet there:

- Cold-prefix cost argues for fewer, larger plans, because every additional plan
  re-buys a whole cold dispatch - the 12,488-byte prefix plus the 26-48% declared
  read-set plus the in-dispatch reading that is the rest of the window.
- Context risk argues for smaller plans, because executor dispatches already sit
  at a 185,999-token 75th percentile, close enough to the ceiling of a single
  context that a plan much larger than 8 tasks would run out of room rather than
  finish.
- 8 is where they meet, and no measured checkpoint on this record was produced by
  the ceiling. Lowering it would multiply the cold pass across every phase
  against no evidence that it buys back a single checkpoint.

If the evidence changes, this is what changes it: executor checkpoints arriving
from plans AT the ceiling (8 tasks) rather than under it, which would put the
ceiling on the causal path for the first time.

## What this decision does not change

Nothing in the seam. `planning.mjs plan-size` counts tasks PER PLAN and takes
the ceiling as the CALLER's resolved number - it reads no config for it - so
re-deciding the value moves only what the caller resolves. The ceiling remains
per plan: a phase needing more capacity gets more plans, sequential where they
share files.
