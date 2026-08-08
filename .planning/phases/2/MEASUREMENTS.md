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

Reproduce with:

```
node cadence-core/bin/weight.mjs resident
```

Measured at `a3f6e1c`, recorded in its child commit - the sha named is the
PARENT for the same reason `## Before` names one, and the child commit cannot
move these numbers because `.planning/**` is outside the measured walk. The
dispatch table below stands beside the command table and never sums with it
(D-05).

### Commands (all 23), by eager bytes descending

| Command | Eager B | Reachable B |
|---|---:|---:|
| **cad-execute** | 25017 | 92295 |
| cad-config | 20260 | 44018 |
| **cad-verify** | 20136 | 90760 |
| **cad-land** | 17934 | 59304 |
| cad-context | 17442 | 80103 |
| **cad-plan** | 16438 | 67783 |
| cad-milestone | 15935 | 60085 |
| cad-new-project | 15598 | 62596 |
| cad-decision-review | 12213 | 27347 |
| cad-audit | 11533 | 61718 |
| cad-phase | 11006 | 30751 |
| cad-undo | 10642 | 30387 |
| cad-progress | 8920 | 38175 |
| cad-pause | 8477 | 28222 |
| cad-debug | 8181 | 31910 |
| cad-coverage | 5162 | 11608 |
| cad-help | 4889 | 24371 |
| cad-task | 4784 | 26364 |
| cad-health | 4756 | 9871 |
| cad-docs-verify | 3960 | 3960 |
| cad-spike | 3898 | 3898 |
| **cad-plan-review** | 2353 | 17487 |
| cad-capture | 2345 | 2345 |

**Workhorse mean (eager):** (`cad-execute` 25,017 + `cad-plan` 16,438 +
`cad-verify` 20,136) / 3 = **20,530.33 B**, unmoved - no file of those three is
touched by this phase.

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

Every dispatch figure is unchanged from `## Before`: this phase touched no agent
file and no contract skill.

### Deltas

| Command | Eager before | Eager after | Eager delta | Reach before | Reach after | Reach delta |
|---|---:|---:|---:|---:|---:|---:|
| cad-land | 32676 | 17934 | -14742 | 57540 | 59304 | +1764 |
| cad-plan-review | 17511 | 2353 | -15158 | 37764 | 17487 | -20277 |
| cad-execute | 25017 | 25017 | 0 | 90923 | 92295 | +1372 |
| cad-plan | 16438 | 16438 | 0 | 66411 | 67783 | +1372 |
| cad-verify | 20136 | 20136 | 0 | 89388 | 90760 | +1372 |

Workhorse mean (eager), before and after: **20,530.33 B** both times.

**AC3.** `cad-land` eager is 17,934 B, below the 20,530.33 B workhorse mean. It
was the heaviest command in the plugin and is now fourth.

**AC4.** `cad-plan-review` eager fell 15,158 B, at or above the 15,134 B of the
`references/review-triggers.md` include the criterion names.

**D-09.** The zero-resident total is 26,095 B before and after, over the same
three files. It is excluded from every delta above: nobody pays those bytes, so
nobody can save them.

#### Every reachable change, split by cause

Reachable is measured ONE HOP from the eager set, so de-preloading a file moves
that file's own citations out of the count even though the model still Reads it
at the step and can still follow them from there. That part of a reachable drop
is an artifact of the definition, not bytes anyone stopped paying, and it is
named separately here rather than folded into the cut's delta.

- **`cad-plan-review`, -20,277 B.** Of that, **-20,253 B is the definition
  artifact**: `references/seams.md` (17,203 B as it stood before task 4's
  amendment) and `references/triage-gate.md` (3,050 B) left the one-hop set only
  because `review-triggers.md`, which cites them, stopped being eager. Step 2
  Reads `review-triggers.md`, which still cites both, so the model reaches them
  exactly as before. The remaining **-24 B** is real: the `SKILL.md` itself,
  2,377 -> 2,353. `review-triggers.md` stays in the set, cited by full path at
  step 2.
- **`cad-land`, +1,764 B, no set-membership change at all.** Its own prose
  already cited `seams.md`, `triage-gate.md` and `git-publish.md`, so nothing
  entered or left. The move is two file-size changes: **+1,372 B from task 4's
  `seams.md` amendment** and **+392 B from the Read paragraph task 5 added** to
  this SKILL.md.
- **`cad-execute`, `cad-plan`, `cad-verify`, +1,372 B each.** All three are task
  4's `seams.md` amendment (17,203 -> 18,575 B), which every command citing
  `seams.md` picked up. None of these three had a file touched by the deferrals,
  and their eager bytes did not move at all - which is what keeps the AC3 bar
  fixed.

So of this phase's reachable movement, the deferrals themselves account for
-24 B; the rest is 20,253 B of one-hop bookkeeping and 1,372 B of documented
prose growth in a reference that no command preloads.

## Scope corrections

Applied at context time under D-10, so this task verifies and records them
rather than re-editing them. Verified on the tree at `a3f6e1c`:

- `.planning/ROADMAP.md:100-111` - phase 2's **Success Criteria** carries the
  re-scoped preamble naming D-01, D-02, D-03 and D-06, and criteria 1-5 read the
  re-scoped scope (`weight.mjs` subcommand, `cad-land` + `cad-plan-review`, the
  Read check, `phases/2/MEASUREMENTS.md`, the scope corrections themselves).
- `.planning/REQUIREMENTS.md:58` - the `CTX-01` row reads the re-scoped scope
  with its "Re-scoped 2026-08-08 at phase-2 context" note.
- `.planning/REQUIREMENTS.md:153` - `CTX-02` sits under `## Deferred` (heading at
  `:148`), not under `## Active` (`:6`), with its deferral reason stated.
- `node cadence-core/bin/planning.mjs seed-reqs --phase 2` was run
  unconditionally at this task and returned `{"seeded":[],"skipped":["CTX-01"]}`:
  the Traceability row already existed, so nothing needed writing.
- `node cadence-core/bin/planning.mjs audit` returns `ok:true`, with `CTX-01` at
  `"phase":2`, `"plan":"phases/2/PLAN.md"` and `"break":"not-verified"` - no
  `unpicked` - and `orphans` null, so `phases/2/PLAN.md` is not an orphan. The
  nine ids owned by phases 3-6 (`REC-01`, `REC-02`, `FRI-01`, `FRI-02`, `FRI-03`,
  `PRS-01`, `PRS-02`, `DOC-02`, `DOC-03`) stay `unpicked`, which means "no
  Traceability row yet" and not "unserved": ROADMAP already assigns every one to
  a phase.
