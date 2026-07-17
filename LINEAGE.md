# Lineage: Cadence vs GSD

Cadence's methodology descends from [GSD ("Get Shit Done")](https://github.com/open-gsd/gsd-core), and the rest is its own.
<!-- HAND-DRAFT (John): GSD lineage/distillation framing (crenshaw-voice); no "rewrite"/"forked" -->
This file records the measured distance between the two, so the lineage in
[`DESIGN.md`](./DESIGN.md) rests on numbers, not adjectives.

**Provenance.** Figures below are counted from GSD at commit `d010ea1` (2026-07-10)
and Cadence at the same date. They are reproducible: clone both trees and re-run the
counts (`find`/`wc` over `agents/`, `skills/`, `gsd-core/workflows/`, `*.md`).

## The distance

| Surface | GSD | Cadence | Retained |
|---|---|---|---|
| **Documentary mass (words)** | **1,113,812** | **33,621** | **~3%** |
| Agents | 34 | 7 | 21% |
| Skills | 71 | 22 | 31% |
| Workflows | 114 | 16 | 14% |
| References | 86 | 8 | 9% |
| Commands | 71 | 0 (folded into skills) | — |
| Capabilities | 46 | 0 | — |
| `src/` code files | 163 (full TypeScript product) | 3 `.mjs` scripts | ~2% |

The single honest summary: **Cadence carries roughly 3% of GSD's documentary mass.**

## What was kept — the spine

The shared skeleton, and the reason Cadence is recognizably GSD's descendant:

- The **discuss -> plan -> execute -> verify** loop.
- **Atomic conventional commits**, one logical change per commit.
- **Fresh-context subagents** for the load-bearing roles.
- The **`.planning/` artifact model** (roadmap, per-phase plan/summary/UAT, a state cursor).

## What was rewritten — the survivors

Cadence's 7 agents descend from ~6 GSD ancestors, but every one was slimmed ~80-90%
and reconceived, not copied. The GSD originals were enormous:

| GSD agent | size | Cadence descendant |
|---|---|---|
| `gsd-planner` | 47K | `cad-planner` (a fraction of the size) |
| `gsd-verifier` | 48K | `cad-verifier` |
| `gsd-executor` | 43K | `cad-executor` |
| `gsd-plan-checker` | 44K | `cad-plan-checker` (+ `-high` variant) |
| `gsd-assumptions-analyzer` | 4.5K | `cad-assumptions-analyzer` |
| `gsd-code-reviewer` | 16.5K | `cad-reviewer` (now one voice in a configurable review subsystem) |

`gsd-review` became `cad-plan-review` as a first-class configurable subsystem, and
GSD's `code_review_command` was removed entirely.

## What was cut

Whole categories, deleted rather than trimmed:

- The **multi-runtime shim** — `.kilo/`, `.opencode/`, `vscode/`, `GEMINI.md`, and the
  ~40-line CLI-locator pasted into nearly every workflow. Cadence runs on Claude Code only.
- The **AI-product / research / UI / eval / security-audit / mempalace / forensics**
  machinery — a swathe of GSD agents (`gsd-debugger` alone was 50K) and skills.
- The **command and capability layers** (71 commands, 46 capabilities).
- The **TypeScript codebase and build apparatus** — `src/` (163 files), tests, eslint
  rules, changesets, the VS Code extension.
- **Internationalization** (pt-BR, ja-JP translations).
- The **giant living docs** — a 227K `CONTEXT.md`, a 172K `CHANGELOG.md`.

## Why there is no patch surface to track

GSD ships its own `update` / `sync-skills` / `reapply-patches` / three-way-merge
machinery to track upstream as patches. At **~3% retained mass, there is no patch
surface to track** — a three-way merge has almost nothing to align. The
tolerable-divergence ceiling is not merely low; it is gone. Cadence owns its source as
the single point of truth, and upstream ideas are cherry-picked by hand, adjudicated
one at a time.
<!-- HAND-DRAFT (John): GSD lineage/distillation framing (crenshaw-voice); no "rewrite"/"forked" -->

*GSD remains the origin and the debt is acknowledged in [`LICENSE`](./LICENSE) and
[`README.md`](./README.md). This file measures the distance; it does not diminish the
lineage.*
