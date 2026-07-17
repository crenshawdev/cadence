# Cadence

Cadence is a planning and execution system for a single developer working in Claude Code. It runs one disciplined loop, discuss then plan then execute then verify, with an atomic commit per task, opinionated defaults, and a deliberately small surface. Your state lives in files, not in the conversation, so you can `/clear` aggressively and the next command rebuilds from disk.

It is built to say no. One runtime, no team tooling, no feature catalog. What it keeps, it keeps sharp: model routing that spends tokens like a budget, review gates that stop bad work before it lands, and a git model that guards protected branches from ad-hoc pushes and asks how you publish rather than deciding for you, unless you opt into an autonomous close.

> Cadence is a standalone planning-and-execution system for Claude Code. Its methodology descends from [GSD](https://github.com/open-gsd/gsd-core) - the discuss/plan/execute/verify loop - and everything else is its own, carrying about 3% of GSD's mass (measured 2026-07-10, GSD commit d010ea1). <!-- HAND-DRAFT (John): GSD lineage/distillation framing (crenshaw-voice); no "rewrite"/"forked" --> See [`LINEAGE.md`](./LINEAGE.md) for the measured distance, [`MANIFESTO.md`](./MANIFESTO.md) for the why, and [`DESIGN.md`](./DESIGN.md) for the full design.

## Why Cadence

Most of what makes AI-assisted development expensive is not the model, it is the mess. Context piles up, the same files get read again and again, the conversation drags a week of history into every single turn, and the bill follows the clutter.

Cadence is built the other way around. One loop, discuss then plan then execute then verify. State lives in files, not in the conversation. Clear between steps and you lose nothing. Every task lands as one commit. The heavy reading happens in fresh-context subagents that hand back a short answer instead of emptying a file into your window. Small batches, clean state, tight loops, the same discipline that has always separated software that scales from software that seizes up.

The effect shows up in the numbers. These are measurements of my own real usage, taken from my account's usage data, not telemetry the tool collects. Cadence ships no instrumentation and phones nothing home. Across roughly a billion input tokens of real work, about 96% of that input was served from cache, the cached prefix was reused around 27 times for every rebuild, and fresh uncached input stayed near six hundredths of a percent. Your numbers will vary with your habits. That is not the tool being clever with your money. It is the tool refusing to let your context rot, which keeps the model reading the same clean prefix instead of a growing pile. You still do real work and spend real tokens. You just stop paying full freight to re-read your own history.

## Install

Cadence is a Claude Code plugin. Add the marketplace, then install:

```
/plugin marketplace add https://github.com/crenshawdev/cadence.git
/plugin install cadence@cadence
```

Update with `/plugin update cadence@cadence`, remove with `/plugin uninstall cadence@cadence`. Requires Claude Code with plugin support, plus `node` and `git` on your PATH. The scripts inside are zero-dependency: there is no npm install, ever.

## The loop

Cadence runs as slash commands in Claude Code, namespaced `/cadence:cad-*` (for example `/cadence:cad-new-project`). They are written below without the `cadence:` prefix for brevity. A project moves through five steps, each its own command:

1. **`/cad-new-project`** — define the project through deep questioning: what, why, who, done.
2. **`/cad-context <phase>`** — gather locked decisions and acceptance criteria before planning.
3. **`/cad-plan <phase>`** — turn a phase into an executable, checkable plan.
4. **`/cad-execute <phase>`** — build it, one atomic commit per task.
5. **`/cad-verify <phase>`** — confirm the phase delivered what it promised.

`/cad-progress` tells you where you stand and what's next at any point, and auto-resumes incomplete work.

## The commands

Everything is a `/cad-*` command. `/cad-help` prints the full reference, `/cad-help <name>` shows one entry.

**Review & quality**
- **`/cad-plan-review`** — adversarial review of a plan before any code is written.
- **`/cad-audit`** — pre-ship traceability: every requirement traced to a phase, a plan, a verification. Catches silently-dropped work.
- **`/cad-coverage`** — find a phase's requirements that have zero failing-capable test coverage, then close the gaps.
- **`/cad-docs-verify`** — check factual claims in docs against the live codebase.
- **`/cad-debug`** — systematic debugging with hypotheses that survive `/clear`.

**Lifecycle & git**
- **`/cad-milestone`** — cut a release: audit nothing was dropped, tag, prune completed phases, evolve the docs.
- **`/cad-land`** — publish finished work, asking how (push / MR or PR / tag / leave local) with no preselected default.
- **`/cad-phase`** — add, insert, remove, or renumber phases, fixing every reference in one pass.
- **`/cad-undo`** — safely roll back a phase's commits from its summary manifest.
- **`/cad-pause`** — stop cleanly with a WIP commit and a resume pointer.

**Support**
- **`/cad-config`** — the config: workflow toggles, model routing, review gates and providers,
  parallelism, consult. `/cad-config` walks every switch; `key=value` sets one directly.
- **`/cad-capture`** — a phase-linked todo or a seed idea, captured without losing your place.
- **`/cad-spike`** — a time-boxed experiment to resolve one unknown before you bet on it.
- **`/cad-task`** — a small off-roadmap task with atomic commits.
- **`/cad-health`** — a quick planning-health check.
- **`/cad-help`** — the command reference.

## What's inside

- **Claude Code only** — one clean runtime, no multi-host shim. Portability-ready seams
  (ask-user / spawn-agent / review-provider) if a contributor ever adds a runtime.
- **Deterministic seams** — every read and write of `.planning/` state, model routing, and
  config validation runs through small zero-dependency Node scripts (`planning.mjs`,
  `route.mjs`, `config.mjs`, `review-provider.mjs`) that speak one JSON line and never block
  the loop. Prose keeps the judgment; the scripts keep the invariants, so state transitions
  don't drift with the model's mood.
- **22 skills, 7 agents, and nothing you didn't ask for.** No team or multi-author tooling,
  no AI-product track, no web-UI design track, no catalog-scaling, and nothing that duplicates
  a developer's own memory or graph tools. See [`LINEAGE.md`](./LINEAGE.md) for the full cut.
- **Adversarial review is a first-class, configurable subsystem** — a fresh-context Claude
  reviewer by default, with pluggable cross-model reviewers (OpenAI and Gemini, direct API
  calls with provider-enforced structured output). Four review gates fire along the loop
  (plan, diff, risk surface, pre-ship), each with its own gate/tier/effort switches in
  `/cad-config`. At a debugging dead-end, an optional consult brings a second model's angles
  to the table; it advises, never decides, always asks first, and is off until you enable
  `review.consult.enabled`.
- **Model routing** — three canned profiles (fast / balanced / quality) plus an optional `auto`
  mode that picks model (and effort, via role) per task, with guardrails. Routing governs the
  subagents Cadence dispatches; the main session's model and effort are yours to set in Claude
  Code, and Cadence cannot set them for you. My recommendation: run the main session on the
  strongest model at high effort. The context discipline is what makes that affordable, because
  the orchestrator stays lean and reads its own prefix from cache while the heavy file work
  happens in routed subagents.
- **Git model** — atomic commits and a protected-branch guard enforced by the harness itself (a
  PreToolUse hook, not prose the model can talk itself out of) that blocks ad-hoc pushes, with a
  `land` step that asks how you want to publish with no preselected default instead of forcing a
  branch/PR flow. Work runs on a two-tier branch model: a per-milestone integration branch that
  parallel worktrees fork from and merge into (`git.integration_branch`, `milestone` by default
  with a `trunk` escape hatch, created at cycle start per `git.auto_branch`). After a successful
  land, cleanup returns to the base branch, pulls, and reaps the merged integration branch
  (`git.on_land_cleanup`, on by default). Publishing flows through one sanctioned git-publish
  seam — the single code-guarded push path Cadence uses — and an opt-in end-to-end close
  (`git.auto_close`, off by default) runs audit → tag → PR → merge → reset with no per-step
  prompts, halting on a blocking `pre_ship` FAIL.
- **Parallel execution, gated by arithmetic** — independent plans can run concurrently in
  isolated git worktrees (`parallelization.enabled`, off by default). Parallelism is offered
  only when a deterministic file-overlap check proves the plans declare no shared files, and
  an opt-in `phase_diff` review can inspect the merged result as one diff, since per-plan
  reviews cannot see cross-plan interactions.
- **A working method, baked in** — plans are ordered skeleton-first, so a wired end-to-end
  tracer bullet exists by the second or third commit; the executor states the output it
  expects before running each verification and records any surprise as a deviation instead
  of rationalizing it; and every goal-check claim carries file:line or command-output
  evidence. Generalized from Andrej Karpathy's "A Recipe for Training Neural Networks":
  make no assumptions, failures are silent, verify, don't trust. There is no switch for
  this. It is simply how Cadence plans and builds.
- **Lean `.planning/`** — ROADMAP + per-phase PLAN/SUMMARY/UAT + a ~4-line state cursor. No
  audit logs duplicating git.
- **Context-frugal by design** — durable state lives in `.planning/` files and git, and every
  plan/review/execution runs in a fresh subagent, so you can `/clear` aggressively: clear at any
  phase boundary and the next command rebuilds from disk. An attempt to keep prompt-cache reuse
  high and context lean, not a magic trick.
- **Built-in minimal memory** — `/cad-capture` keeps phase-linked todos, seeds, and notes in
  `.planning/CAPTURE.md`, and `memory.backend` defaults to `builtin`: a zero-dep BM25 `recall`
  over what `.planning/` already records (SUMMARY deviations, CAPTURE items, UAT findings,
  CONTEXT decisions), so past decisions resurface at planning time. `none` turns recall off;
  external backends (mem-*, a vault) stay reserved behind the same seam.
- **Self-verifying** — CI lints the prose against the code: every config key, script
  invocation, and file path named in the workflows must actually exist, or the build fails.
  It also weighs every agent, skill, and workflow surface and fails the build when one
  outgrows its byte budget, or when an agent's prose reaches for a tool its frontmatter
  never declared. The docs cannot quietly drift from the tool, and its context claims are
  measured, not asserted.

## Attribution

Cadence is a derivative work of GSD by Open GSD, used under the MIT License. The original
copyright is retained in [`LICENSE`](./LICENSE) and the lineage is spelled out in
[`NOTICE`](./NOTICE.md). Cadence is maintained by John Crenshaw and distributed
under the MIT License.
