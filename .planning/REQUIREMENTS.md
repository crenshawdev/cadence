# Requirements: Cadence v1.1.0

**Defined:** 2026-07-16
**Core Value:** What Cadence writes down during a project (deviations, decisions, captures, UAT findings) must come back on its own at the moment it matters — planning, context-gathering, and debugging — without any external memory system.

## v1 Requirements

Committed scope. Each maps to exactly one roadmap phase.

### Recall (RCL)

- [ ] **RCL-01**: Running `planning.mjs recall "<query>"` returns ranked snippets from `.planning/` artifacts (phase SUMMARYs, CAPTURE.md, UAT.md, CONTEXT decisions) as one-line JSON, via zero-dep BM25; same corpus + same query always returns the same results
- [ ] **RCL-02**: On a project with no recallable artifacts, `recall` returns `{ok: true, results: []}` — never an error
- [ ] **RCL-03**: `memory.backend` accepts `builtin` and defaults to it; `none` disables recall and every consumer skips it silently
- [ ] **RCL-04**: cad-context injects recall results for the phase goal into its assumptions pass, cad-planner into its planning context, and cad-debug into hypothesis formation — each visibly citing the recalled source (file + phase)
- [ ] **RCL-05**: The `recall` subcommand has a CONTRACTS entry in self-verify.mjs and tests in planning.test.mjs covering ranking, empty-corpus, and determinism

### Context Weight (CWT)

- [ ] **CWT-01**: A seam subcommand reports byte and estimated-token weight per agent/skill prose surface (agents/*.md, skills/*/SKILL.md, workflow files) as one-line JSON
- [ ] **CWT-02**: self-verify runs a blocking budget check: any measured surface exceeding its declared size budget fails CI (exit 1) with the surface and overage named
- [ ] **CWT-03**: self-verify lints that each agent's prose references only tools declared in that agent's frontmatter `tools:` list; violations are blocking (exit 1)

## v2 Requirements

Deferred. Tracked, not in the current roadmap.

### Recall (RCL)

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

| Requirement | Phase | Status |
|-------------|-------|--------|
| RCL-01 | Phase 1 | Complete |
| RCL-02 | Phase 1 | Complete |
| RCL-03 | Phase 1 | Complete |
| RCL-04 | Phase 2 | Pending |
| RCL-05 | Phase 1 | Complete |
| CWT-01 | Phase 3 | Pending |
| CWT-02 | Phase 3 | Pending |
| CWT-03 | Phase 3 | Pending |

**Coverage:** 8 v1 requirements, 8 mapped, 0 unmapped

---
*Last updated: 2026-07-16 after project init (v1.1.0 cycle)*
