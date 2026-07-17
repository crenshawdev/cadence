# Requirements: Cadence (toward v1.1.0)

**Defined:** 2026-07-16
**Core Value:** What Cadence writes down during a project (deviations, decisions, captures, UAT findings) must come back on its own at the moment it matters — planning, context-gathering, and debugging — without any external memory system.

## Active

Committed scope for `v1.1.0-rc.2` (the "git model + release lifecycle" round).
Each maps to exactly one roadmap phase.

### Git lifecycle (GIT)

- [ ] **GIT-01**: `git.integration_branch` (`milestone` default | `trunk`) plus `git.auto_branch` (`ask` | `auto` | `off`); cycle-start workflows create/switch to a per-milestone integration branch, and in `milestone` mode the parallel path's worktrees fork from its tip, not `main`
- [ ] **GIT-02**: `git.on_land_cleanup` (default on): after a successful land/merge, return to base (`main`), pull, and reap the merged integration branch
- [ ] **GIT-03**: `git.auto_close` (opt-in, default off): cad-milestone/cad-land run the full close (audit → tag → PR → merge → reset) without per-step prompts, halting on a blocking `pre_ship` FAIL; the default (off) preserves cad-land's no-preselected-default publish posture

### Release mechanics (REL)

- [ ] **REL-01**: For a distributed-plugin project, cad-milestone/cad-land bump the plugin manifest version (`.claude-plugin/plugin.json`, sibling manifests kept in sync) as part of the close, idempotently
- [ ] **REL-02**: A CHANGELOG / release-notes convention wired into the close flow; the first entry documents the shipped v1.1.0 scope and the `memory.backend none → builtin` default flip

### Release readiness (RDY)

- [ ] **RDY-01**: Public docs (README, MANIFESTO, DESIGN, LINEAGE, NOTICE, CHANGELOG) reconciled to the shipped v1.1 code, with drift corrected in place (verified by `/cad-docs-verify`)
- [ ] **RDY-02**: README surfaces the shipped v1.1 capabilities with the locked lineage/attribution (GSD, RTK) positioning; DESIGN.md honestly documents the reversed design decisions with rationale
- [ ] **RDY-03**: The plugin clears the community plugin-store submission bar — `claude plugin validate --strict` clean, complete `.claude-plugin/plugin.json` metadata, README + CHANGELOG present, semver matching the release tag

## Shipped

Delivered and verified. Kept as rows for shipped-scope trace; the `v1.1.0-rc.1`
tag and git history hold the full requirement text. Archived out of
`## Traceability` so a new milestone's audit starts clean (the audit seam
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

| Requirement | Phase | Status |
|-------------|-------|--------|
| GIT-01 | 1 | Complete |
| GIT-02 | 2 | Pending |
| GIT-03 | 2 | Pending |
| REL-01 | 3 | Complete |
| REL-02 | 3 | Complete |
| RDY-01 | 4 | Pending |
| RDY-02 | 4 | Pending |
| RDY-03 | 4 | Pending |

---
*Last updated: 2026-07-17 added Phase 4 (release prep & docs), RDY-01..03*
