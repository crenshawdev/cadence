# Requirements: Cadence (toward v1.2.0)

**Defined:** 2026-07-16
**Core Value:** What Cadence writes down during a project (deviations, decisions, captures, UAT findings) must come back on its own at the moment it matters — planning, context-gathering, and debugging — without any external memory system.

## Active

Committed scope for `v1.2.0`. Each maps to a roadmap phase once `/cad-plan` runs.

### Review reliability (REV)

- [ ] **REV-01**: `review-provider.mjs` runs correctly when invoked through a symlinked plugin path (the run-as-script guard compares via realpath on both sides, not as-typed `argv[1]`), so cross-model `review` / `consult` / `detect-models` no longer silently no-op. An empty provider result surfaces one line rather than silently degrading to the subagent. A regression test invokes the script through a symlink and asserts non-empty JSON. (#12, Phase 1)
- [ ] **REV-02**: Cadence supports DeepSeek as a third cross-model review provider through a dedicated Chat Completions adapter (its own adapter, not an OpenAI Responses base-URL swap), selectable via `review.reviewers` and `review.providers.deepseek.tiers.*`. Structured output uses json_object mode with an in-prompt schema plus the shared validate-on-return guard, since DeepSeek has no server-side `json_schema`. `reasoning_effort` maps the effort dial; keys resolve via `DEEPSEEK_API_KEY`, never logged. Built to verify DEC-02's cross-model panel against a real provider. (Phase 4)

### Planning minimalism (SOC)

- [ ] **SOC-01**: `cad-planner` carries a standing separation-of-concerns heuristic (a nudge, not a hard rule) that prefers small single-purpose tasks over a shared core and splits responsibilities that differ on trigger / size / lifecycle / failure-resume / freshness / ownership. It applies to every plan with no per-phase restatement, and never forces a split that does not earn itself. (#32, Phase 2)

### Decision rigor (DEC)

- [ ] **DEC-01**: `cad-context` marks a decision durable only when it passes a three-part filter (hard-to-reverse, surprising-without-context, and the result of a real trade-off). Durable decisions carry forward and resurface via recall; the rest stay phase-local. No ADR tree, no glossary import. (#26, Phase 3)
- [ ] **DEC-02**: `/cad-decision-review <path>` runs an on-demand refute-then-adjudicate pass over one decision doc through the existing review subsystem, extending the shared finding schema with a per-objection `survives | partial | refuted` ruling and a concrete amendment list. The adjudicator verifies factual and library claims against real sources (Context7, codebase), reports its cost honestly, and never auto-fires. Single-model by default, cross-model panel when configured (the cross-model path depends on REV-01). (#28, Phase 3)

## Shipped

Delivered and verified. Kept as rows for shipped-scope trace; the
release-candidate tags and git history hold the full requirement text. Archived
out of `## Traceability` so a new milestone's audit starts clean (the audit seam
parses only the Traceability table).

| Requirement | Phase | Status | Milestone |
|-------------|-------|--------|-----------|
| RCL-01 (BM25 recall over `.planning/`, one-line JSON, deterministic) | 1 | Complete | v1.1.0-rc.1 |
| RCL-02 (empty corpus → `{ok:true, results:[]}`, never an error) | 1 | Complete | v1.1.0-rc.1 |
| RCL-03 (`memory.backend` accepts `builtin`, defaults to it; `none` disables recall) | 1 | Complete | v1.1.0-rc.1 |
| RCL-04 (cad-context / cad-planner / cad-debug inject cited recall) | 2 | Complete | v1.1.0-rc.1 |
| RCL-05 (recall CONTRACTS entry + tests: ranking, empty-corpus, determinism) | 1 | Complete | v1.1.0-rc.1 |
| CWT-01 (per-surface byte + est-token weight seam, one-line JSON) | 3 | Complete | v1.1.0-rc.1 |
| CWT-02 (blocking self-verify budget check, names surface + overage) | 3 | Complete | v1.1.0-rc.1 |
| CWT-03 (blocking self-verify agent tools-declaration lint) | 3 | Complete | v1.1.0-rc.1 |
| GIT-01 (integration-branch model: `git.integration_branch` + `git.auto_branch`, worktrees fork from the integration tip) | 1 | Complete | v1.1.0-rc.2 |
| GIT-02 (`git.on_land_cleanup`: return to base, pull, reap the merged integration branch) | 2 | Complete | v1.1.0-rc.2 |
| GIT-03 (`git.auto_close` full close halting on `pre_ship`; live end-to-end run deferred to final v1.1.0) | 2 | Complete | v1.1.0-rc.2 |
| REL-01 (plugin manifest version bump folded into the close, idempotent) | 3 | Complete | v1.1.0-rc.2 |
| REL-02 (CHANGELOG convention wired into the close; v1.1 scope + `memory.backend` flip documented) | 3 | Complete | v1.1.0-rc.2 |
| RDY-01 (public docs reconciled to shipped v1.1 code, verified by `/cad-docs-verify`) | 4 | Complete | v1.1.0-rc.2 |
| RDY-02 (README v1.1 capabilities + lineage positioning; DESIGN reversals documented) | 4 | Complete | v1.1.0-rc.2 |
| RDY-03 (community plugin-store bar: `validate --strict` clean, metadata, README + CHANGELOG, semver) | 4 | Complete | v1.1.0-rc.2 |
| PUB-01 (`auto_close` full close verified live end-to-end against a real remote; blocking `pre_ship` halts before merge) | — | Complete | v1.1.0 |
| PUB-02 (final `v1.1.0` published: manifest `1.1.0`, dated CHANGELOG entry, `v1.1.0` tag, community plugin-store submissions filed) | — | Complete | v1.1.0 |

## Deferred

Tracked, not in the current roadmap.

- **RCL-06**: External memory backends (mem-*/claude-mem/MCP) behind the same `recall(query) → snippets` contract

## Out of Scope

Explicit exclusions. The reason prevents scope creep later.

| Feature | Reason |
|---------|--------|
| Embeddings / vector search | BM25 is deterministic, zero-dep, sufficient for dozens of markdown files; embeddings add forbidden infra |
| Knowledge / cross-project memory | Cadence owns project-scoped working memory only; global memory belongs to the developer's own tools (LINEAGE cut) |
| Live token telemetry | Claude Code exposes no per-turn stats to plugin scripts; measurement is static prose weight |
| Second-model lanes | Separate deferred cycle, tracked in project memory |

## Traceability

Live requirement → phase → plan → verified trace for the **current** milestone,
written solely by cad-verify. Shipped rows move to `## Shipped` above when a
milestone closes, so `/cad-audit` starts each cycle clean. This section must
remain the last in the file — the audit seam parses every row beneath it.

_Empty until `/cad-plan` maps the v1.2.0 requirements (REV-01, SOC-01, DEC-01,
DEC-02) to phases; cad-verify then writes each row as phases complete._

| Requirement | Phase | Status |
|-------------|-------|--------|

---
*Last updated: 2026-07-22 opened v1.2.0 (REV-01, SOC-01, DEC-01, DEC-02)*
