---
phase: 3
plan: 2
requirements:
  - TRC-07
files:
  - cadence-core/workflows/context.md
  - cadence-core/workflows/plan.md
  - cadence-core/workflows/task.md
  - cadence-core/workflows/verify-deep.md
  - cadence-core/workflows/decision-review.md
  - cadence-core/workflows/minimalism-review.md
  - cadence-core/references/plan-revision.md
  - cadence-core/references/review-triggers.md
  - cadence-core/references/seam-spawn-agent.md
  - cadence-core/bin/weight-budgets.json
  - cadence-core/bin/seam-calls.test.mjs
---

# Phase 3: Make the cache figures reach the record - Plan 2

## Goal

A bracket for a role that is not `cad-executor` can be joined at all. Every
`trace close` the shipped prose writes carries the host's id for the worker it
closes, so the cache figures Plan 1 puts on the record have a bracket to reach,
and the seam's own statement of what the `SubagentStop` hook carries stops being
false the moment that hook gains a second kind of write.

## Must be true when done

- Every `trace close` command line in the shipped prose passes `--agent-id`, not
  just the executor's in `cadence-core/workflows/execute.md`.
- A render over a fixture shows a bracket carrying `agent_id` for a role that is
  not `cad-executor`.
- `cadence-core/references/seam-spawn-agent.md` no longer says the hook's write
  always carries the adopted bracket's identity, and says what it does carry
  when it cannot claim a close.
- Every prose surface this plan grew has a `cadence-core/bin/weight-budgets.json`
  ceiling at or above its new size, so `node cadence-core/bin/self-verify.mjs --root .`
  reports `problems: []` with no `budget-overrun`.
- `node cadence-core/bin/test.mjs` is green and the flag census still reads 192.

## Context

CONTEXT.md D-01 (the join key goes on every `trace close` prose site, because an
`agent_id`-only join otherwise delivers for `cad-executor` and orphans every
other role's fact), D-13 (this spreads an EXISTING flag, so the census stays at
192 and no `trace close` flag is added for figures only a transcript can fill)
and D-14 (the seam's hook paragraph changes, and every prose file D-01 edits has
its byte budget re-measured) bind this plan. Plan 1 names the hook's new
cache-only lifecycle event `worker_cache`; this plan's prose uses that spelling.
Out of scope here: every `.mjs` file and every test, which are Plan 1's.

## Tasks

### Task 1: Put the join key on every `trace close` in the prose

- **Files:** cadence-core/workflows/context.md, cadence-core/workflows/plan.md,
  cadence-core/workflows/task.md, cadence-core/workflows/verify-deep.md,
  cadence-core/workflows/decision-review.md,
  cadence-core/workflows/minimalism-review.md,
  cadence-core/references/plan-revision.md,
  cadence-core/references/review-triggers.md,
  cadence-core/bin/weight-budgets.json
- **Action:** `cadence-core/workflows/execute.md` is the only shipped site
  passing `--agent-id` today, and the measured consequence is that 7 of 2,363
  events on this record carry the key at all: an `agent_id` join delivers for
  `cad-executor` and orphans every other role (D-01). Add
  `--agent-id <the id on the subagent return>` to the `trace close` command line
  at each of the other ten sites CONTEXT.md D-01 enumerates -
  `cadence-core/workflows/context.md` (`cad-assumptions-analyzer`),
  `cadence-core/workflows/plan.md` (two sites, `cad-planner` and
  `cad-plan-checker`), `cadence-core/workflows/task.md` (`cad-task`),
  `cadence-core/workflows/verify-deep.md` (`cad-verifier`),
  `cadence-core/workflows/decision-review.md` (`cad-reviewer`),
  `cadence-core/workflows/minimalism-review.md` (`cad-reviewer`),
  `cadence-core/references/plan-revision.md` (two sites, `cad-planner` and
  `cad-plan-checker`) and `cadence-core/references/review-triggers.md`
  (`cad-reviewer`) - using the exact spelling and the same position relative to
  `--role` and `--tokens` that `execute.md` already uses, so ten sites do not
  become ten dialects. Add NO per-site restatement of when to omit it: the OMIT
  rule is stated once in `cadence-core/references/seam-spawn-agent.md`'s bracket
  paragraph, ten copies of it is the duplication this tree's prose census exists
  to prevent, and these files are eager context weighed byte by byte. Add no new
  flag: `--agent-id` is already declared on the `trace close` row in
  `cadence-core/bin/lib/arg-contract.mjs`, so the census
  `cadence-core/bin/arg-contract.test.mjs` pins at 192 does not move (D-13).
  Re-pin each edited surface's entry in `cadence-core/bin/weight-budgets.json`
  in THIS task rather than a later one: every one of these files sits at exactly
  its ceiling today, so any growth is a `budget-overrun` in `self-verify` and a
  task that deferred the re-pin would not leave the repo committable. Read the
  new sizes off `node cadence-core/bin/weight.mjs` rather than computing them by
  hand, since that is the reader the check itself uses.
- **Verify:** `grep -rn 'trace close --phase' cadence-core/workflows cadence-core/references | grep -vc 'agent-id'`
  prints 0 over 11 matched command lines (today the same pair prints 10 of 11).
  `node cadence-core/bin/self-verify.mjs --root .` reports `ok: true` with
  `problems: []`. `node cadence-core/bin/test.mjs` is green, and
  `node --test cadence-core/bin/arg-contract.test.mjs` still asserts 192 flag
  entries. For the render half: in a temporary `.planning/` whose `trace.jsonl`
  holds a `lifecycle/dispatch` for `cad-verifier` and a `lifecycle/return`
  carrying an `agent_id`, `node cadence-core/bin/planning.mjs trace render --dir <that .planning>`
  prints one bracket whose `role` is `cad-verifier` and which carries that
  `agent_id`.

### Task 2: Make the seam's statement of what the hook carries true again

- **Files:** cadence-core/references/seam-spawn-agent.md (the paragraph opening
  `**The bracket rides the resolve.**`, at the sentence beginning "and it
  carries IDENTITY plus the two cache figures"),
  cadence-core/bin/weight-budgets.json
- **Action:** That sentence says the `SubagentStop` hook carries identity plus
  the two cache figures it sums off the stopped worker's transcript, and it
  stops being true in this phase (D-14): the hook now also writes a cache-only
  lifecycle fact, `worker_cache`, on the three stops where it cannot claim a
  close at all - a worker that had not stopped when the host fired, a worker
  whose bracket the caller had already closed, and a worker whose role has two
  open dispatches the evidence cannot separate. Rewrite the sentence so it
  states both writes and the difference between them: a CLOSE adopts an open
  bracket and carries THAT bracket's identity, while the fact claims no bracket
  and carries the stopped worker's own `agent_id` and its two cache figures,
  alongside the `corr` and `phase` every lifecycle event carries, and is joined
  to a bracket at render time on `corr` plus `agent_id`. Do NOT write that the
  fact carries the two figures and an id ALONE: PLAN-1 task 5 requires it to
  carry `corr` and `phase` read off the render, D-04 requires the real `phase`
  so a phase-filtered render can still see it, and the `corr` is half the join
  key named in this same sentence - a paragraph claiming otherwise would be
  false on the day it ships, which is the exact defect this task exists to
  close. Say plainly why `--agent-id` on this caller's line
  is what lets that fact reach a bracket at all, since that is the reason the
  other ten close sites now carry it. Keep the paragraph ONE statement:
  `cadence-core/bin/prose-agreement.test.mjs`'s MSR-01 test reads this paragraph
  by its bolded opening, asserts three `--turns` clauses inside it, and asserts
  the file holds exactly one `ONE statement` marker - so do not split the rule
  into a second paragraph, do not add a second marker, and do not disturb those
  three clauses. Re-pin `cadence-core/references/seam-spawn-agent.md` in
  `cadence-core/bin/weight-budgets.json` in this same task: it sits at exactly
  its 23,919 B ceiling today, so any growth reddens `self-verify` at this
  task's own commit.
- **Verify:** `node --test cadence-core/bin/prose-agreement.test.mjs` is green,
  MSR-01 included. `grep -c 'ONE statement' cadence-core/references/seam-spawn-agent.md`
  prints 1. The text between `**The bracket rides the resolve.**` and the next
  blank line contains both `worker_cache` and `--agent-id`, and no longer claims
  the hook's write carries identity in every case.
  `node cadence-core/bin/self-verify.mjs --root .` reports `problems: []`.

## Notes

- **Independence.** This plan shares no file with PLAN-1.md and needs no
  ordering against it: PLAN-1 touches only `.mjs` files and one spike record,
  this one only prose surfaces and the byte manifest. The two are checked
  independently - PLAN-1 by the test suite, this one by `self-verify` and the
  prose tests - and both are green on their own.
- **Plan shape deviation.** CONTEXT.md's `Plan shape` directive assigns only
  D-14's "byte re-measures" to this slice, leaving its seam-spawn-agent
  paragraph with the hook seam. Both halves need
  `cadence-core/bin/weight-budgets.json`, and every prose surface here is at
  exactly its ceiling, so splitting D-14 would put one manifest in two `files:`
  leases. File independence wins, so the whole of D-14 is task 2 here.
- **The site count.** CONTEXT.md D-01 says "nine" sites and then enumerates ten
  beyond `execute.md`; the tree holds eleven `trace close` command lines in
  total. The plan follows the enumerated LIST, which is the evidence, not the
  count.
- **`cadence-core/workflows/task.md` is the one inert site.** `/cad-task` runs
  inline and has no subagent behind its phase-0 bracket, so its close will never
  have an id to pass and the standing OMIT rule covers it. D-01 names the site,
  so it is edited exactly as the decision states.
