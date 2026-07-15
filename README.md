# Cadence

Cadence is a planning and execution system for a single developer working in Claude Code. It runs one disciplined loop, discuss then plan then execute then verify, with an atomic commit per task, opinionated defaults, and a deliberately small surface. Your state lives in files, not in the conversation, so you can `/clear` aggressively and the next command rebuilds from disk.

It is built to say no. One runtime, no team tooling, no feature catalog. What it keeps, it keeps sharp: model routing that spends tokens like a budget, review gates that stop bad work before it lands, and a git model that never pushes and never decides how you publish without asking.

> Cadence is a standalone planning-and-execution system for Claude Code. Its methodology descends from [GSD](https://github.com/open-gsd/gsd-core) - the discuss/plan/execute/verify loop - but everything else is a ground-up rewrite, carrying about 3% of GSD's mass. See [`LINEAGE.md`](./LINEAGE.md) for the measured distance, [`MANIFESTO.md`](./MANIFESTO.md) for the why, and [`DESIGN.md`](./DESIGN.md) for the full design.

## Why Cadence

Most of what makes AI-assisted development expensive is not the model, it is the mess. Context piles up, the same files get read again and again, the conversation drags a week of history into every single turn, and the bill follows the clutter.

Cadence is built the other way around. One loop, discuss then plan then execute then verify. State lives in files, not in the conversation. Clear between steps and you lose nothing. Every task lands as one commit. The heavy reading happens in fresh-context subagents that hand back a short answer instead of emptying a file into your window. Small batches, clean state, tight loops, the same discipline that has always separated software that scales from software that seizes up.

The effect shows up in the numbers. Across roughly a billion input tokens of real work, about 96% of that input was served from cache, the cached prefix was reused around 27 times for every rebuild, and fresh uncached input stayed near six hundredths of a percent. That is not the tool being clever with your money. It is the tool refusing to let your context rot, which keeps the model reading the same clean prefix instead of a growing pile. You still do real work and spend real tokens. You just stop paying full freight to re-read your own history.

## Install

Cadence is a Claude Code plugin. Add the marketplace, then install:

```
/plugin marketplace add https://github.com/crenshawdev/cadence.git
/plugin install cadence@cadence
```

Update with `/plugin update cadence@cadence`, remove with `/plugin uninstall cadence@cadence`. Requires Claude Code with plugin support.

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
- **`/cad-config`** — the ~22-key config: workflow toggles, model routing, cross-model review providers.
- **`/cad-capture`** — a phase-linked todo or a seed idea, captured without losing your place.
- **`/cad-spike`** — a time-boxed experiment to resolve one unknown before you bet on it.
- **`/cad-task`** — a small off-roadmap task with atomic commits.
- **`/cad-health`** — a quick planning-health check.
- **`/cad-help`** — the command reference.

## What's inside

- **Claude Code only** — one clean runtime, no multi-host shim. Portability-ready seams
  (ask-user / spawn-agent / review-provider) if a contributor ever adds a runtime.
- **22 skills, 7 agents, and nothing you didn't ask for.** No team or multi-author tooling,
  no AI-product track, no web-UI design track, no catalog-scaling, and nothing that duplicates
  a developer's own memory or graph tools. See [`LINEAGE.md`](./LINEAGE.md) for the full cut.
- **Adversarial review is a first-class, configurable subsystem** — a fresh-context Claude
  reviewer by default, with pluggable cross-model reviewers (Codex, Gemini, any CLI).
- **Model routing** — three canned profiles (low / balanced / quality) plus an optional `auto`
  mode that picks model (and effort, via role) per task, with guardrails.
- **Git model** — atomic commits, a protected-branch guard, never auto-pushes, and a `land`
  step that asks how you want to publish instead of forcing a branch/PR flow.
- **Lean `.planning/`** — ROADMAP + per-phase PLAN/SUMMARY/UAT + a ~4-line state cursor. No
  audit logs duplicating git.
- **Context-frugal by design** — durable state lives in `.planning/` files and git, and every
  plan/review/execution runs in a fresh subagent, so you can `/clear` aggressively: clear at any
  phase boundary and the next command rebuilds from disk. An attempt to keep prompt-cache reuse
  high and context lean, not a magic trick.
- **Built-in minimal memory** with an optional hook to a richer backend.

## Attribution

Cadence is a derivative work of GSD by Open GSD, used under the MIT License. The original
copyright is retained in [`LICENSE`](./LICENSE) and the lineage is spelled out in
[`NOTICE`](./NOTICE.md). Cadence is maintained by John Crenshaw and distributed
under the MIT License.
