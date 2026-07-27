# Cadence

## What This Is

Cadence is a Claude Code plugin for phased planning and execution: roadmap →
context → plan → execute → verify, with file-based continuity in `.planning/`,
deterministic seam scripts guarding invariants, and an adversarial review
subsystem. `v1.3.1` is the current release: a tech-debt cycle that closed all
13 bugs from the post-`v1.2.0` review sweep, the theme being that seams which
used to fail quietly now say so. Earlier cycles shipped file-based memory and
BM25 recall (`v1.1.0`), the cross-model review repairs and durable-decision
recall (`v1.2.0`), the sweep-highs patch (`v1.2.1`), and the liteSpeed
flow-and-latency pass (`v1.3.0`), on the `v1.0.0` planning baseline.

## Core Value

What Cadence writes down during a project (deviations, decisions, captures,
UAT findings) must come back on its own at the moment it matters — planning,
context-gathering, and debugging — without any external memory system.

## Requirements

### Validated

- ✓ Phased planning spine (new-project / context / plan / execute / verify) — v1.0.0
- ✓ Deterministic seam scripts with tests: config, planning, route, review-provider, git-guard, self-verify (132 tests) — v1.0.0
- ✓ Write-side memory: STATE cursor, per-phase SUMMARY with deviations, CAPTURE.md (todo/seed/note), UAT.md — v1.0.0
- ✓ Self-verify drift linter in CI: config-key tokens ↔ schema, script invocations ↔ CONTRACTS table, plugin-root paths exist; README included as a linted surface — v1.0.0
- ✓ Cross-model review subsystem (plan / diff / phase_diff / pre_ship triggers, consult, detect-models) — v1.0.0
- ✓ `memory.backend` config key reserved, only `none` wired — v1.0.0
- ✓ BM25 recall over `.planning/` artifacts as a zero-dep `planning.mjs` subcommand — v1.1.0-rc.1
- ✓ `memory.backend` gains `builtin` and becomes the default; `none` turns recall off — v1.1.0-rc.1
- ✓ cad-context, cad-planner, and cad-debug inject recall results at the moment they start reasoning — v1.1.0-rc.1
- ✓ Deterministic context-weight measurement of agent/skill prose surfaces via a seam subcommand — v1.1.0-rc.1
- ✓ self-verify budget check on context weight (blocking) — v1.1.0-rc.1
- ✓ self-verify lint: agent prose references only tools declared in that agent's frontmatter (blocking) — v1.1.0-rc.1
- ✓ Two-tier git branching: per-milestone integration branch (parallel-worktree reconciliation point) + `trunk` escape hatch — v1.1.0-rc.2
- ✓ Land cleanup (`git.on_land_cleanup`) + opt-in autonomous close (`git.auto_close`), never-auto-push rail intact via the git-publish seam — v1.1.0-rc.2
- ✓ Release mechanics: manifest version bump + changelog folded into the milestone close, idempotent — v1.1.0-rc.2
- ✓ Release prep: public docs reconciled, DESIGN records the reversals, plugin-store metadata, `validate --strict` clean — v1.1.0-rc.2
- ✓ `auto_close` full close verified live end-to-end against a real remote (audit → tag → PR → merge → reset), closing the deferred Phase-2 item-6 — v1.1.0
- ✓ Final `v1.1.0` published: manifest at `1.1.0`, dated CHANGELOG entry, `v1.1.0` tag cut, community plugin-store submissions filed — v1.1.0
- ✓ Repaired the cross-model review seam: realpath run-as-script guard so `review-provider.mjs` no longer no-ops on a symlinked install, symlink regression test, empty-provider surfacing (REV-01) — v1.2.0
- ✓ `cad-planner` separation-of-concerns nudge: prefer small single-purpose tasks over a shared core, no per-phase restatement (SOC-01) — v1.2.0
- ✓ `cad-context` durable-decision filter: three-part test, `## Durable decisions` heading, recall retargeting with legacy fallback (DEC-01) — v1.2.0
- ✓ `/cad-decision-review`: on-demand refute-then-adjudicate over one decision, Context7 + codebase grounding, per-objection ruling + amendments (DEC-02) — v1.2.0
- ✓ DeepSeek cross-model review provider: Chat Completions adapter (json_object + in-prompt schema), selectable via `review.reviewers` (REV-02) — v1.2.0
- ✓ Every open bug from the post-v1.2.0 sweep triaged and fixed, no won't-fix: silent data-file failures surfaced (#39, #40, #43, #44), seam flag inputs validated before any write (#42, #45), planning parsers de-phantomed and widened (#41, #46, #47, #48), renumber and git-guard hardened (#37, #49, #50) — v1.3.1

### Active

**None open.** `v1.3.1` shipped 2026-07-27 and its phases are pruned, so
`## Phases` is empty. Known consequence until it is fixed: `planning.mjs status`
returns `unparseable-roadmap` on an empty roadmap, so `/cad-progress` does not
work until the next cycle's phases exist. Use `/cad-phase add` or `/cad-plan`
to open the cycle rather than `/cad-progress`.

The next milestone's scope is not set. Candidates, in the order the evidence
argues for them:

1. **The empty-roadmap state itself.** A fix was written and reverted at this
   close after `pre_ship` confirmed two HIGH findings (see CAPTURE.md). It needs
   a real answer to "what is a phase-shaped line" and a routing destination that
   exists, not a heuristic.
2. **The regressions this cycle introduced.** Phase 3's own commits left a HIGH
   (`readFrontmatterList` reads a trailing comment as the whole value and
   discards the block list) and two MEDIUMs, all open in CAPTURE.md.
3. **The Traceability seeding step that has now failed to fire at two
   consecutive milestone closes** (v1.2.0 and v1.3.1), each time requiring a
   hand-populated table before /cad-audit could pass.
4. **The two phase-sized rewrites CAPTURE argues for**: one quote-state
   tokenizer closing the six known git-guard rail-3 holes, and streaming
   provider responses so review timeouts stop being a fixed-number guess.
5. **The 11 open `[enhancement]` issues** (#14-#31, #54).

### Out of Scope

- Embeddings / vector search — BM25 is deterministic, zero-dep, and sufficient for a corpus of dozens of markdown files (Ratel's benchmark is the existence proof); embeddings add infra Cadence's philosophy forbids
- External memory backends (mem-*, claude-mem, MCP) in this cycle — the `builtin` backend defines the recall contract first; external backends slot in behind the same seam later
- Knowledge memory / cross-project recall — Cadence owns project-scoped working memory only; global memory belongs to the developer's own tools (LINEAGE cut, stands)
- Runtime token telemetry of live sessions — Claude Code exposes no per-turn stats to a plugin script; measurement is static prose weight, not live usage
- Second-model lanes (research/verify/build) — deferred to a later cycle, tracked separately

## Context

Brownfield: Cadence v1.0.0 shipped publicly today (2026-07-16, repo
crenshawdev/cadence, tag v1.0.0). This cycle is v1.1.0, built by dogfooding
Cadence on itself — the first project init on this repo.

The gap being closed: deviations are recorded at execute time (cad-executor →
SUMMARY.md), CAPTURE.md accumulates, UAT findings accumulate — but neither
cad-plan nor cad-context reads any of it back. `memory.backend` is an empty
socket (`enum: ["none"]`).

Design provenance: inspired by ratel-ai/ratel — progressive disclosure via
deterministic BM25 catalogs, no vector DB, no infra. Cadence applies the same
bet to its own planning artifacts rather than to tool schemas.

Established patterns this work must follow: zero-dep Node seam scripts in
`cadence-core/bin` with one-line JSON stdout and exit codes; every new
subcommand gets a CONTRACTS entry in self-verify.mjs plus tests in the
sibling `*.test.mjs`; prose keeps judgment, scripts keep invariants.

## Constraints

- **Dependencies**: zero runtime deps — BM25 and stats are hand-rolled JS in `cadence-core/bin` (lib/ helpers allowed)
- **Compatibility**: existing `.planning/` layouts must work unchanged; recall on a project with no SUMMARYs degrades to empty results, never an error
- **Determinism**: same corpus + same query → same results; no timestamps, no randomness in ranking
- **Toolchain**: Node 22/24 (CI matrix), `node --test`, `tsc --checkJs` must stay green
- **Semver honesty**: `v1.0.0` is the public baseline (immutable). `v1.1.0` shipped through `-rc.N` candidates; `v1.2.0` is a straight minor bump cut at publish. A larger future scope may use `-rc.N` again; small backward-compatible cycles tag straight. Never retag a published version.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| BM25, not embeddings | Deterministic, zero-dep, fast on a small corpus; matches seam philosophy | ✓ Shipped v1.1.0-rc.1 |
| `memory.backend` default flips to `builtin` | The feature's value is being there without setup; `none` remains the off switch | ✓ Shipped v1.1.0-rc.1 |
| Context-weight stats live in a seam + self-verify budget check | Deterministic measurement; CI catches prose bloat mechanically, same as drift | ✓ Shipped v1.1.0-rc.1 |
| Tools-declaration lint is blocking | Same species as the config-key drift check; consistency in how the linter treats drift | ✓ Shipped v1.1.0-rc.1 |
| Recall consumers: cad-context, cad-planner, cad-debug | The three moments past knowledge changes decisions: assumptions, task breakdown, hypotheses | ✓ Shipped v1.1.0-rc.1 |
| Pre-release versioning toward v1.1.0 | v1.0.0 is public; dogfood iterations shouldn't each burn a public minor — candidates converge on one release | ✓ Adopted — `-rc.N` per iteration (rc.2 this round) |
| Integration-branch per milestone (two-tier) | The milestone branch is the reconciliation point for parallel worktrees, keeping merge churn off `main`; worktrees are the disposable tier below it | ✓ Shipped v1.1.0-rc.2 |
| Autonomous close is opt-in, never the default | Preserves cad-land's "the publish mechanism is the user's call"; `auto_close` is an explicit override that still halts on a blocking `pre_ship` FAIL | ✓ Shipped v1.1.0-rc.2 (live end-to-end run deferred to final v1.1.0) |
| Reset-to-base + pull after every land | A cycle always ends on an up-to-date `main`, so the next starts clean; removes the manual return step | ✓ Shipped v1.1.0-rc.2 |
| `v1.2.0` cut straight, no rc cycle | A small backward-compatible minor (one bug fix, two guidance nudges, one command); the rc line was for the larger v1.1.0 scope | ✓ Shipped v1.2.0 |
| A close-time fix still goes through the ship gate | An empty-roadmap fix written during the v1.3.1 close looked small, passed 340 tests, and was reverted when `pre_ship` confirmed two HIGH findings: its heuristic reported a broken roadmap as a cleanly closed milestone, and it routed users to a workflow that refuses phases absent from ROADMAP | ✗ Reverted at the v1.3.1 close; requeued as a designed phase |
| Durability is prose judgment, not a score | The three-part filter lives in cad-context workflow prose; no scoring seam, matching "prose keeps judgment, scripts keep invariants" | ✓ Shipped v1.2.0 |
| DeepSeek via json_object + in-prompt schema | DeepSeek has no server-side json_schema; the shared validate-on-return guard degrades a schema-ignoring response to bad-shape, not bad data | ✓ Shipped v1.2.0 |

---
*Last updated: 2026-07-27 shipped v1.3.1 (13 sweep bugs closed + one off-roadmap fix); no milestone open*
