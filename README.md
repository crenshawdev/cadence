# Cadence

**Cadence is a single-developer fork of [GSD ("Get Shit Done")](https://github.com/open-gsd/gsd-core),
trimmed and re-focused for solo work.** It keeps GSD's core discipline — a
discuss → plan → execute → verify loop with atomic commits — and strips the
team, multi-runtime, and AI-product machinery a solo developer doesn't need.

> Status: **early scaffolding.** See [`DESIGN.md`](./DESIGN.md) for the full design and rationale.

## What Cadence changes vs GSD

- **Claude Code only** — one clean runtime, no multi-host shim. Portability-ready seams
  (ask-user / spawn-agent / review-CLI) if a contributor ever adds a runtime.
- **~18 skills instead of 69, ~9 agents instead of 34.** Deleted: team/multi-author tooling,
  the AI-product track, web-UI design track, catalog-scaling, and features that duplicate a
  developer's own memory/graph tools.
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
copyright is retained in [`LICENSE`](./LICENSE). Cadence is maintained by
John Crenshaw (VintageTechie) and distributed under the MIT License.
