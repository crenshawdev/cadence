# Runtime evidence: what Cadence weighs

Measured 2026-08-09 against the tree at commit `98be3d2`, by the commands
printed beside each table. The commit that carries this file changes no figure
in it: `docs/` holds no measured surface, so the numbers below are the ones
`weight.mjs` reports at the tip of this phase. Check the tree out, run the
command, compare. Nothing here is collected at runtime and nothing is reported
home — `weight.mjs` reads the prose files in the tree and counts bytes.

Three terms are used throughout, and they are the definitions in
`cadence-core/bin/lib/resident-weight.mjs`, not looser paraphrases of them:

- **eager (turn one)** — `skills/<name>/SKILL.md` plus every path on an
  `@${CLAUDE_PLUGIN_ROOT}/...` line at the start of a line in that SKILL.md.
  These are the bytes the host injects **before the command's first turn**, so
  they ride every remaining turn of the run. This is what `README.md` means by
  "load in turn one".
- **reachable** — the eager set plus every `cadence-core/{references,templates,workflows}/<file>`
  the text of the eager files names and that exists on disk. **One hop**, never
  a transitive closure. Reachable bytes are what the command *may* read at some
  step, not what it carries from the start; they are not turn-one bytes and are
  never labelled as such.
- **dispatch (per role)** — one `agents/<file>.md` plus the SKILL.md of every
  contract it preloads. These bytes land in a **fresh subagent context**, not in
  the orchestrator's.

Command and dispatch figures are reported side by side and are never summed: a
dispatch's bytes land in a different context, so a combined total would grow
with plan count and stop being reproducible from the tree.

## Turn one: what each command loads before it does anything

```
node cadence-core/bin/weight.mjs resident --root .
```

Eager bytes are the `eagerBytes` field of each entry in `commands`.

| Command | Turn-one bytes |
|---|---|
| `/cad-audit` | 14,551 |
| `/cad-capture` | 2,345 |
| `/cad-config` | 20,547 |
| `/cad-context` | 20,777 |
| `/cad-coverage` | 5,162 |
| `/cad-debug` | 8,397 |
| `/cad-decision-review` | 12,213 |
| `/cad-docs-verify` | 3,960 |
| `/cad-execute` | 28,682 |
| `/cad-health` | 7,006 |
| `/cad-help` | 4,889 |
| `/cad-land` | 18,209 |
| `/cad-milestone` | 16,210 |
| `/cad-new-project` | 16,708 |
| `/cad-pause` | 8,752 |
| `/cad-phase` | 11,281 |
| `/cad-plan` | 22,662 |
| `/cad-plan-review` | 2,353 |
| `/cad-progress` | 9,791 |
| `/cad-spike` | 3,898 |
| `/cad-task` | 5,380 |
| `/cad-undo` | 10,917 |
| `/cad-verify` | 24,533 |
| **23 user-invocable commands** | **279,223** |

That total is the sum of the column, not a quantity any single session pays.
One command's turn-one bytes are what that run carries; you never run all 23 in
one context.

## Resident composition: eager against reachable

```
node cadence-core/bin/weight.mjs resident --root .
```

The ten heaviest commands by turn-one bytes. Reachable is the one-hop set and
includes the eager bytes, so the gap between the columns is what the command
may open at a step rather than what it starts holding.

| Command | Eager (turn one) | Reachable (one hop) |
|---|---|---|
| `/cad-execute` | 28,682 | 100,293 |
| `/cad-verify` | 24,533 | 100,098 |
| `/cad-plan` | 22,662 | 78,074 |
| `/cad-context` | 20,777 | 86,293 |
| `/cad-config` | 20,547 | 44,326 |
| `/cad-land` | 18,209 | 63,350 |
| `/cad-new-project` | 16,708 | 64,002 |
| `/cad-milestone` | 16,210 | 67,181 |
| `/cad-audit` | 14,551 | 64,736 |
| `/cad-decision-review` | 12,213 | 29,927 |

Three reference files are reachable from no command at all — budgeted bytes
that enter no model context, so no context saving may ever claim them
(`zeroResident` in the same output, 26,306 B):

| Surface | Bytes |
|---|---|
| `cadence-core/references/config-reach.md` | 18,623 |
| `cadence-core/references/model-hints.json` | 2,635 |
| `cadence-core/references/provider-api.md` | 5,048 |

## Dispatch: what a fresh subagent context carries

```
node cadence-core/bin/weight.mjs resident --root .
```

Dispatch bytes are the `dispatchBytes` field of each entry in `roles`: the rung
agent file plus its preloaded contract skills. The rung files differ from each
other by tens of bytes because a rung carries no behaviour, only its effort
setting — that invariant is what the spread in this table shows.

| Role | Agent file | Agent bytes | Dispatch bytes |
|---|---|---|---|
| cad-assumptions-analyzer | `agents/cad-assumptions-analyzer-high.md` | 489 | 4,595 |
| cad-assumptions-analyzer | `agents/cad-assumptions-analyzer.md` | 519 | 4,625 |
| cad-executor | `agents/cad-executor-xhigh.md` | 425 | 13,050 |
| cad-executor | `agents/cad-executor.md` | 438 | 13,063 |
| cad-plan-checker | `agents/cad-plan-checker-high.md` | 458 | 5,801 |
| cad-plan-checker | `agents/cad-plan-checker-medium.md` | 466 | 5,809 |
| cad-plan-checker | `agents/cad-plan-checker-xhigh.md` | 462 | 5,805 |
| cad-plan-checker | `agents/cad-plan-checker.md` | 476 | 5,819 |
| cad-planner | `agents/cad-planner-max.md` | 407 | 9,061 |
| cad-planner | `agents/cad-planner-xhigh.md` | 415 | 9,069 |
| cad-planner | `agents/cad-planner.md` | 429 | 9,083 |
| cad-reviewer | `agents/cad-reviewer-max.md` | 436 | 4,044 |
| cad-reviewer | `agents/cad-reviewer-medium.md` | 448 | 4,056 |
| cad-reviewer | `agents/cad-reviewer-xhigh.md` | 444 | 4,052 |
| cad-reviewer | `agents/cad-reviewer.md` | 465 | 4,073 |
| cad-verifier | `agents/cad-verifier-max.md` | 438 | 10,639 |
| cad-verifier | `agents/cad-verifier-medium.md` | 450 | 10,651 |
| cad-verifier | `agents/cad-verifier-xhigh.md` | 446 | 10,647 |
| cad-verifier | `agents/cad-verifier.md` | 472 | 10,673 |

## Per surface: what the plugin weighs on disk

```
node cadence-core/bin/weight.mjs --root .
```

93 budgeted surfaces. This is the repository's weight, not any context's — the
turn-one table above is the number that decides what a session pays.

| Directory | Surfaces | Bytes |
|---|---|---|
| `agents/` | 19 | 8,583 |
| `cadence-core/references/` | 16 | 159,165 |
| `cadence-core/templates/` | 8 | 16,861 |
| `cadence-core/workflows/` | 21 | 200,209 |
| `skills/` | 29 | 90,733 |
| **total** | **93** | **475,551** |

The twelve largest individual surfaces:

| Surface | Bytes | Est. tokens |
|---|---|---|
| `cadence-core/workflows/execute.md` | 27,940 | 6,985 |
| `cadence-core/references/acceptance-criteria.md` | 22,506 | 5,627 |
| `cadence-core/workflows/plan.md` | 21,814 | 5,454 |
| `cadence-core/workflows/context.md` | 19,950 | 4,988 |
| `cadence-core/workflows/config.md` | 19,256 | 4,763 |
| `cadence-core/references/config-reach.md` | 18,623 | 4,656 |
| `cadence-core/references/seams.md` | 18,575 | 4,644 |
| `cadence-core/references/review-triggers.md` | 17,714 | 4,429 |
| `cadence-core/workflows/verify.md` | 17,639 | 4,410 |
| `cadence-core/workflows/new-project.md` | 15,872 | 3,968 |
| `cadence-core/references/plan-frontmatter.md` | 13,954 | 3,489 |
| `cadence-core/references/req-traceability.md` | 13,725 | 3,432 |

Every one of those 93 surfaces sits at exactly its budgeted byte count in
`cadence-core/bin/weight-budgets.json`, with total slack zero, and that is now
enforced rather than merely maintained: `self-verify` fails on any DIFFERENCE
between a surface and its entry, added bytes or removed, on the commit that
introduces it. A shrink counts because nothing regenerates these entries — a
surface left sitting under its number banks slack the next growth then spends
in silence.

## What this file does not carry

No phase-trace evidence. `.planning/trace.jsonl` is written per phase by
`planning.mjs trace append`, called from the workflows that dispatch workers,
and rendered by `/cad-progress --trace`; the intent was to publish one from a
project that is not Cadence itself.
Checked 2026-08-09 across every project on this machine with a `.planning/`
directory — `atmos`, `burnrate`, `hindsight`, `jcrenshaw.dev`, `placer`,
`reflex`, `tempest`, `weathervane` — none has a `trace.jsonl`; only Cadence
does. Publishing Cadence's own trace as evidence that Cadence works elsewhere
would prove nothing, so that half is closed as not-fired rather than filled with
the wrong input.
