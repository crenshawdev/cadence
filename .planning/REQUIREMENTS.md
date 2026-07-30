# Requirements: Cadence (v1.5.0 shipped)

**Defined:** 2026-07-16
**Core Value:** What Cadence writes down during a project (deviations, decisions, captures, UAT findings) must come back on its own at the moment it matters — planning, context-gathering, and debugging — without any external memory system.

## Active

`v2.0.0 — Stakes, not spend`. The routing axis stops asking how much a user
wants to spend and starts asking what happens if the work is wrong. The
breaking change is the enum rename with no back-compat alias; everything else
in the cycle either enables it or rides with it. `/cad-plan` seeds each id's
Traceability row as its phase is planned.

- **RNG-01**: Per-rung agent files materialize effort off the preloaded contract skills, retiring `escalate_effort_variant` and the `cad-plan-checker-high` runtime-read shim; a rung file that carries behaviour fails self-verify
- **STK-01**: The routing axis asks stakes rather than spend - the `model.profile` key is REPLACED by `stakes` (solo/shipped/critical), the `auto` mode is retired, and every surface naming the old key or values moves with them. No back-compat alias: a config a user wrote stops validating on the KEY, not just the value
- **STK-02**: A routing cell resolves `{model, effort, review, verify}` rather than a bare model, computed from a small table, with self-verify asserting every cell resolves to a valid model, a valid effort and a real trigger
- **STK-03**: The top rung is computed from the risk surface Cadence already detects - detection sets a floor, the user may raise it, and lowering below a detected floor requires an explicit override that names what it overrides
- **ACR-01**: CONTEXT acceptance criteria carry stable ids, and `/cad-audit` asserts coverage in both directions - every criterion reaches a UAT item, every UAT item traces to a criterion or is marked verifier-added
- **CFG-01**: The remaining resolved-then-dropped config keys stop lying, closed at the point of setting, the same way per-trigger `effort` was
- **HST-01**: The plugin's documented home moves to the self-hosted Forgejo remote - README install block and test badge and the plugin manifest name `git.jcrenshaw.dev`, and GitHub stops being the published source

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
| GIT-01 (integration-branch model: `git.integration_branch` + `git.auto_branch`, worktrees merge back into the integration branch; they fork from it only under `worktree.baseRef: head`) | 1 | Complete | v1.1.0-rc.2 |
| GIT-02 (`git.on_land_cleanup`: return to base, pull, reap the merged integration branch) | 2 | Complete | v1.1.0-rc.2 |
| GIT-03 (`git.auto_close` full close halting on `pre_ship`; live end-to-end run deferred to final v1.1.0) | 2 | Complete | v1.1.0-rc.2 |
| REL-01 (plugin manifest version bump folded into the close, idempotent) | 3 | Complete | v1.1.0-rc.2 |
| REL-02 (CHANGELOG convention wired into the close; v1.1 scope + `memory.backend` flip documented) | 3 | Complete | v1.1.0-rc.2 |
| RDY-01 (public docs reconciled to shipped v1.1 code, verified by `/cad-docs-verify`) | 4 | Complete | v1.1.0-rc.2 |
| RDY-02 (README v1.1 capabilities + lineage positioning; DESIGN reversals documented) | 4 | Complete | v1.1.0-rc.2 |
| RDY-03 (community plugin-store bar: `validate --strict` clean, metadata, README + CHANGELOG, semver) | 4 | Complete | v1.1.0-rc.2 |
| PUB-01 (`auto_close` full close verified live end-to-end against a real remote; blocking `pre_ship` halts before merge) | — | Complete | v1.1.0 |
| PUB-02 (final `v1.1.0` published: manifest `1.1.0`, dated CHANGELOG entry, `v1.1.0` tag, community plugin-store submissions filed) | — | Complete | v1.1.0 |
| REV-01 (symlink realpath guard on review-provider) | 1 | Complete | v1.2.0 |
| SOC-01 (planner separation-of-concerns nudge) | 2 | Complete | v1.2.0 |
| DEC-01 (durable-decision filter in cad-context) | 3 | Complete | v1.2.0 |
| DEC-02 (`/cad-decision-review` refute-then-adjudicate) | 3 | Complete | v1.2.0 |
| REV-02 (DeepSeek cross-model provider adapter) | 4 | Complete | v1.2.0 |
| TRI-01 (every open bug issue collected and triaged; all 13 accepted, no won't-fix) | — | Complete | v1.3.1 |
| FIX-01 (each accepted bug fixed with a failing-capable regression test) | — | Complete | v1.3.1 |
| WNF-01 (won't-fix rationale documented) | — | Complete | v1.3.1 |
| #39 (malformed config layer named in `warnings[]`, not silently defaulted) | 1 | Complete | v1.3.1 |
| #40 (route/config data-file parse inside the dispatch guard) | 1 | Complete | v1.3.1 |
| #43 (corrupt model-hints.json surfaced, exclude filter no longer fails open) | 1 | Complete | v1.3.1 |
| #44 (absent surfaces/budgets/internals fail a full tree instead of reporting green) | 1 | Complete | v1.3.1 |
| #42 (`cursor set --total` NaN-validated before any write) | 2 | Complete | v1.3.1 |
| #45 (seam flag inputs validated: `--attempt`, `--reqs`, scalar config) | 2 | Complete | v1.3.1 |
| #41 (`parseRequirements` bounded and de-phantomed; no false /cad-audit FAIL) | 3 | Complete | v1.3.1 |
| #46 (UAT parser and merge robustness: phantom items, gaps, dropped merges) | 3 | Complete | v1.3.1 |
| #47 (recall: closed captures indexed, multi-word query joined) | 3 | Complete | v1.3.1 |
| #48 (block-YAML lists and name-less phase headings parsed) | 3 | Complete | v1.3.1 |
| #37 (decimal STATE cursor carved out of the renumber shift) | 4 | Complete | v1.3.1 |
| #49 (unreadable symlink survivable; renumber collision and partial-apply reported) | 4 | Complete | v1.3.1 |
| #50 (git-guard joins backslash line-continuations before parsing) | 4 | Complete | v1.3.1 |
| GRM-01 (plan-file frontmatter grammar: exact reads, byte-exact paths, a named diagnostic for every out-of-grammar input) | 1 | Complete | v1.4.0 |
| SPN-01 (`/cad-plan` seeds its own traceability rows; worktree executor asserts its plan file before task 1) | 2 | Complete | v1.4.0 |
| TOK-01 (one quote-state tokenizer closes the six rail-3 push holes and the `eval` wrapper family) | 3 | Complete | v1.4.0 |
| RDM-01 (stated roadmap phase-list grammar; empty `## Phases` is a derived closed-milestone state) | 4 | Complete | v1.4.0 |
| AUD-01 (`audit` counts an unpicked `## Active` id, so the gate holds while a milestone is partly planned) | 5 | Complete | v1.4.0 |
| #65 (executor's terminal success-criteria check deleted; `goal_check` already does that assessment) | — | Complete | v1.4.1 |
| #67 (`conventions.md` states the reach it actually has, not the reach it claimed) | — | Complete | v1.4.1 |
| #68 (worktree fork point stated as `worktree.baseRef`-selectable; parallel execute refuses under `fresh`) | — | Complete | v1.5.0 |
| #64 (per-trigger `effort` scoped to the backend that can honour it) | — | Complete | v1.5.0 |
| #74 (each agent contract stored once as a preloaded contract skill; self-verify asserts every one resolves) | — | Complete | v1.5.0 |

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

Live requirement → phase → plan → verified trace for the **current** milestone.
`/cad-plan` creates a row per requirement (always at `Pending`); no writer but
cad-verify ever sets a Status beyond it (`references/req-traceability.md`).
Shipped rows move to `## Shipped` above when a milestone closes, so
`/cad-audit` starts each cycle clean. The audit seam reads the rows of this
section only, bounded at the next `## ` heading.

| Requirement | Phase | Status |
|-------------|-------|--------|
| RNG-01 | Phase 1 | Complete |
| STK-01 | Phase 2 | Complete |
| STK-02 | Phase 3 | Complete |
| STK-03 | Phase 4 | Complete |
| ACR-01 | Phase 5 | Complete |
| CFG-01 | Phase 6 | Pending |
| HST-01 | Phase 6 | Pending |

Empty between milestones. `v1.4.0`'s five rows moved to `## Shipped` at its
close, so the next cycle's audit starts clean. Rows come back one at a time
from `/cad-plan`'s `seed-reqs` call as each phase is planned - never
hand-populated.

---
*Last updated: 2026-07-29 HST-01 added at phase 6 (7 active requirements declared)*
