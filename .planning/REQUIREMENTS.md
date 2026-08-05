# Requirements: Cadence (v2.0.0 shipped)

**Defined:** 2026-07-16
**Core Value:** What Cadence writes down during a project (deviations, decisions, captures, UAT findings) must come back on its own at the moment it matters — planning, context-gathering, and debugging — without any external memory system.

## Active

`v2.4.0 — what Cadence says about itself`. A reconciliation cycle, not a
construction one. `.planning/CAPTURE.md` holds 182 open items accumulated over
nine milestones; some were closed by work that shipped and never struck, some
describe code that no longer exists, and the real ones have gone unread because
the file is too long to triage in passing. That same file is the input to
`/cad-plan`'s recall, so its noise is paid for at every planning dispatch. The
outward half is the same problem: what Cadence claims about itself in
`README.md`, `METHOD.md`, `INTERNALS.md`, `CONTRIBUTING.md` and its workflow
prose has never been checked end to end against the code. Nothing here changes
runtime behavior except where a doc claim turns out to describe a real defect.
An item is closed only against evidence from the tree, naming the commit that
closed it — never because it reads as done. `/cad-plan` seeds each id's
Traceability row as its phase is planned.

- **REC-01**: Every open `CAPTURE.md` item is triaged against the live tree and lands in exactly one of three states — closed with the commit that closed it named, deleted as moot with the reason stated, or kept with its claim re-verified and its file:line citations corrected. No item survives on its original wording alone
- **REC-02**: The capture file stops being an append-only log: closed and moot items move out of the live queue to an archive section or file, so what `/cad-plan`'s recall reads is the set of things still true. The recall path is measured before and after, since a shorter corpus changes what BM25 ranks
- **DOC-02**: `/cad-docs-verify` runs across the whole doc surface — `README.md`, `METHOD.md`, `INTERNALS.md`, `CONTRIBUTING.md` and `cadence-core/workflows/*.md` — and every claim it reports stale is either corrected or recorded as a known divergence with its reason. The run is repeatable and its output is committed, so the next cycle starts from a diff rather than a fresh sweep
- **DOC-03**: A claim that turns out to describe a real defect rather than stale prose is filed as its own requirement rather than silently reworded, so the cycle cannot quietly convert a bug into a documentation edit

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
| TOK-01 (one quote-state tokenizer closes the six rail-3 push holes and the `eval` wrapper family) | 3 | Superseded by TOK-02 (v2.2.0) | v1.4.0 |
| RDM-01 (stated roadmap phase-list grammar; empty `## Phases` is a derived closed-milestone state) | 4 | Complete | v1.4.0 |
| AUD-01 (`audit` counts an unpicked `## Active` id, so the gate holds while a milestone is partly planned) | 5 | Complete | v1.4.0 |
| #65 (executor's terminal success-criteria check deleted; `goal_check` already does that assessment) | — | Complete | v1.4.1 |
| #67 (`conventions.md` states the reach it actually has, not the reach it claimed) | — | Complete | v1.4.1 |
| #68 (worktree fork point stated as `worktree.baseRef`-selectable; parallel execute refuses under `fresh`) | — | Complete | v1.5.0 |
| #64 (per-trigger `effort` scoped to the backend that can honour it) | — | Complete | v1.5.0 |
| #74 (each agent contract stored once as a preloaded contract skill; self-verify asserts every one resolves) | — | Complete | v1.5.0 |
| RNG-01 (per-rung agent files materialize effort off the contract skills; a rung file carrying behaviour fails self-verify) | 1 | Complete | v2.0.0 |
| STK-01 (`model.profile` REPLACED by `stakes` (solo/shipped/critical), `auto` retired, no back-compat alias) | 2 | Complete | v2.0.0 |
| STK-02 (a routing cell resolves `{model, effort, review, verify}` from one small table, every cell self-verified) | 3 | Complete | v2.0.0 |
| STK-03 (detected risk surface sets a rung FLOOR; lowering below it needs an override naming the surface) | 4 | Complete | v2.0.0 |
| ACR-01 (CONTEXT acceptance criteria carry stable ids; `/cad-audit` asserts coverage in both directions) | 5 | Complete | v2.0.0 |
| CFG-01 (the remaining resolved-then-dropped config keys closed at the point of setting) | 6 | Complete | v2.0.0 |
| HST-01 (documented home moved to the self-hosted Forgejo remote; the unbacked README test badge removed) | 6 | Complete | v2.0.0 |
| COV-01 (a fields-less checklist stops being exempt from the coverage gate; the seam states its plugin version; the verifier's findings envelope is persisted beside the phase's artifacts) | 1 | Complete | v2.1.0 |
| TRI-02 (an adjudicated review's survivors are a numbered list the user triages, defaulting to NONE, at every firing site; the reviewer's anti-padding clause removed) | 2 | Complete | v2.1.0 |
| REV-03 (a trigger's reviewers dispatch concurrently in one message; `review.max_prompt_tokens` bounds the paid call) | 2 | Complete | v2.1.0 |
| CFG-02 (the config read face merges a layer once whatever its spelling; six of phase 6's seven deferred config-reach/risk-waiver defects closed, the seventh named open) | 1 | Complete | v2.2.0 |
| TOK-02 (the guard's parser deleted, both rails on one small anchored reader; `git.on_destructive` removed; accepted-cost shapes stated in CHANGELOG) | 2 | Complete | v2.2.0 |
| REL-03 (release seam refuses downgrades, promotes Unreleased into the dated heading, requires `--version` instead of deriving from prose) | 3 | Complete | v2.2.0 |
| DOC-01 (rung-ladder claims corrected in CHANGELOG; `route.mjs` `warnings[]` rides every shape including `ok:false`) | 4 | Complete | v2.2.0 |
| RNG-02 (per-role effort configurable and update-surviving; a rung the role lacks fails self-verify by key) | 4 | Complete | v2.2.0 |
| HST-02 (install path proven live against Forgejo from a fully cold state; transcripts committed in the phase record) | 5 | Complete | v2.2.0 |
| RES-01 (executor reports to `reports/plan-<k>.md`, five-field digest return) | 1 | Complete | v2.3.0 |
| RES-02 (verifier findings to one file, narrow `Write` grant, `uat merge` piped from it) | 1 | Complete | v2.3.0 |
| RES-03 (reviewers get refs or `--payload <file>`, `assertUnderCap` on contents) | 1 | Complete | v2.3.0 |
| RES-04 (`seams.md` states when a file round-trip pays, extended to any deferred read) | 1 | Complete | v2.3.0 |
| LOD-01 (`git.md` split into `git-guard.md` + `git-publish.md`, all citations moved) | 2 | Complete | v2.3.0 |
| LOD-02 (triage gate its own reference, adjudicated arm a tapped multi-select) | 2 | Complete | v2.3.0 |
| LOD-03 (all 17 `conventions.md` parentheticals inlined, eager nowhere) | 2 | Complete | v2.3.0 |
| LOD-04 (`/cad-config` catalog decided on a measured run count, recorded transcribed) | 2 | Complete | v2.3.0 |
| LOD-05 (every eager `@`-include judged per skill with a stated reason) | 2 | Complete | v2.3.0 |
| BUD-01 (29 skill + 19 agent descriptions to one routing line, 8,550 B to 5,397) | 3 | Complete | v2.3.0 |
| BUD-02 (`references/**` + `templates/**` budgeted, both walkers fixed) | 3 | Complete | v2.3.0 |

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

Empty between milestones. `v2.3.0`'s eleven rows moved to `## Shipped` at its
close, so the next cycle's audit starts clean. Rows come back one at a time
from `/cad-plan`'s `seed-reqs` call as each phase is planned - never
hand-populated.

---
*Last updated: 2026-08-05 v2.3.0 closed with all 11 delivered - RES-01..04/LOD-01..05/BUD-01..02 archived to `## Shipped`, Traceability emptied, v2.4.0 opened*
