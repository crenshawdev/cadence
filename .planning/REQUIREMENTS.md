# Requirements: Cadence (v2.6.1 shipped)

**Defined:** 2026-07-16
**Core Value:** What Cadence writes down during a project (deviations, decisions, captures, UAT findings) must come back on its own at the moment it matters — planning, context-gathering, and debugging — without any external memory system.

## Active

`v2.6.2 — what the plugin carries` opened on 2026-08-10, scoped from a
context-weight sweep of the plugin's own eager surfaces (four parallel
read-only passes; the record is `design-notes/sweep-2026-08-10-context-weight.md`
and the picks are issues #98-#103). Measured baseline: 119,232 est tokens of
shipped prose, and an eager set per command of 28,682 B on `/cad-execute`,
24,533 B on `/cad-verify`, 22,662 B on `/cad-plan`, 20,777 B on `/cad-context`,
20,547 B on `/cad-config`, 18,209 B on `/cad-land` — bytes that ride turn one
and every turn after. The itemized total available is ~39,700 B.

The order is not arbitrary: `CTW-01` is what makes `CTW-04` safe to make, and
`CTW-02` is what keeps `CTW-03`'s class from returning. Cutting prose before the
checks exist is how this repo got a 5,792 B include that nothing read and a
CHANGELOG entry defending it.

- **CTW-01**: A deferral made from a workflow file or a contract skill is watched by CI. `lib/deferred-reads.mjs` (self-verify check 13) anchors only on `skills/<name>/SKILL.md` regions labelled by a top-level `^N. ` numbered step, and excludes contract skills outright at `:40-44`. Workflow files use `<step name="...">` tags and are themselves the `@`-include; `skills/cad-execute/SKILL.md` is a bare include with no numbered steps and `cad-verify`'s `<process>` is one line, so a register row for either can never satisfy its anchor — adding one fails CI forever, omitting one leaves the deferral unwatched. Rows gain a `file` field naming where the `Read` sentence must live, `regionLabels()` learns `<step name="...">`, and the contract-skill exclusion goes with its rationale, which prices main-thread residency in a tree that now dispatches most of its work. The SENTENCE stays the matching unit — the header documents why a block-level test passes when the real instruction is deleted. Tracked as #98
- **CTW-02**: An `@`-included surface that nothing in the including command's own EAGER prose ever names fails CI. (Wording corrected 2026-08-10 at the plan-review gate: this row said "reachable prose", and the plan implements eager-only. The narrower predicate is the intended one — a one-hop citation is not the including command's own instruction, and the question the check asks is whether the command itself ever tells anyone to use the surface it paid to load. Correcting the row rather than widening the scan, so the requirement and the check state the same predicate; the cost, a false positive for a command whose include is named only in a cited-but-not-eager reference, has zero live instances and is handled by a waiver row with its reason.) Same species as check 3 (paths exist) and check 6 (agent `skills:` resolve): the include claims a consumer and this checks the claim. The opposite direction from `CTW-01` — "included but never named" against "named but no longer included" — and both must hold. Reuses `lib/resident-weight.mjs`' eager/reachable split rather than re-walking. The case that must pass is the file whose workflow IS the surface (`cad-help`'s `COMMANDS.md`), which is the legitimate shape the defect in `CTW-03` was wrongly compared to. Tracked as #99
- **CTW-03**: ~17,400 B leaves the eager path with no new files and no register rows. `skills/cad-verify/SKILL.md:29` eagerly includes `templates/UAT.md` (5,792 B) which nothing reads — `verify.md` never names it, and `verify.md:352` makes UAT.md seam-written with field order owned by `UAT_FIELDS`, so the template is a renderer spec a model that never renders cannot use. The remaining ~11,600 B is duplication inside a single context window: the `--tokens` provenance paragraph stated five times, `<success_criteria>` checklists restating their own contracts, purpose blocks duplicating the SKILL.md objective riding beside them, and regression anecdotes whose home is a `.mjs` header at zero token cost. Rationale bound to a rule the model applies at runtime stays. Tracked as #100 and #101
- **CTW-04**: ~22,300 B of branch-local prose moves behind a `Read` at the step that needs it, each move tested against `references/seams.md:216-253` — only some branches reach it, one consult site, and the read folds into a turn already being taken. The config knob catalog (8,052 B, untouched by two of three routes) takes `/cad-config` from 20,547 to ~11,700; the plan BLOCKER-revision branch, the `execute_parallel` body, and `cad-executor-contract`'s `<worktree_mode>` (dead on a default install, paid by every executor dispatch) follow. Depends on `CTW-01`: without it these ship unguarded, which is the exact failure `lib/deferred-reads.mjs` exists to catch. Tracked as #102
- **CTW-05**: Four prose/code drifts the sweep found in passing are closed: `execute.md:241` names a step `start` that does not exist, `execute.md:36` resolves `workflow.test_command` on a path that never reads it, `config-reach.md:136-138`' reach site for the three `parallelization.*` keys moves with `CTW-04`, and `seams.md:236-240` claims a git-guard consult in cad-land's guardrails that cites none. Tracked as #103

`/cad-plan` seeds each requirement's Traceability row as its phase is planned -
rows are never hand-populated here.

## Shipped

Delivered and verified. Kept as rows for shipped-scope trace; the
release-candidate tags and git history hold the full requirement text. Archived
out of `## Traceability` so a new milestone's audit starts clean (the audit seam
parses only the Traceability table).

| Requirement | Phase | Status | Milestone |
|-------------|-------|--------|-----------|
| REC-01 (capture queue triaged, non-current items archived under one dated reason) | 1 | Complete | v2.6.0 |
| REC-02 (moot items leave the live queue; closed items stay in the recall corpus) | 1 | Complete | v2.6.0 |
| FRI-01 (the verify walk states the human-check bar and runs everything else) | 2 | Complete | v2.6.0 |
| FRI-02 (the blocking re-arm is capped at one round; every agent carries maxTurns) | 2 | Complete | v2.6.0 |
| FRI-03 (/cad-audit detects an already-published planning-doc version) | 2 | Complete | v2.6.0 |
| FLD-01 (numeric-only phase-directory grammar, stated and reported) | 3 | Complete | v2.6.0 |
| FLD-02 (a project Cadence creates keeps .planning/trace.jsonl out of git) | 3 | Complete | v2.6.0 |
| PRS-02 (REQ_ID_EXACT admits a category not starting with a letter) | 3 | Complete | v2.6.0 |
| DBT-01 (CADENCE-DEBT markers plus an idempotent debt-harvest seam) | 3 | Complete | v2.6.0 |
| TOK-03 (--tokens, --role and --read on trace append; per-role totals in render) | 4 | Complete | v2.6.0 |
| TOK-04 (every phase-scoped dispatch site brackets its worker) | 4 | Complete | v2.6.0 |
| EVD-02 (docs/EVIDENCE.md, measured byte figures linked from README) | 5 | Complete | v2.6.0 |
| DOC-02 (/cad-docs-verify across the whole doc surface, output committed) | 5 | Complete | v2.6.0 |
| DOC-03 (a real defect is filed as its own requirement, never reworded away) | 5 | Complete | v2.6.0 |
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
| QW-01 (static-analysis reaches execution, unconfigured detection + LSP grant) | 1 | Complete | v2.5.0 |
| QW-02 (one joined trace per phase, four families under one corr; mergeLayers warnings surfaced) | 1 | Complete | v2.5.0 |
| QW-03 (file leases enforced at commit, not just compared pre-flight) | 1 | Complete | v2.5.0 |
| QW-04 (a published version is never presented as current) | 1 | Complete | v2.5.0 |
| QW-05 (every provider failure path exercised, drop-outs named loudly) | 1 | Complete | v2.5.0 |
| CTX-01 (`weight.mjs resident` + the two heaviest commands stop eager-preloading) | 2 | Complete | v2.5.0 |
| DFC-01 (two literal NUL bytes in `lib/trace.mjs`, plus a `nul-byte-in-source` guard over every file under `bin/`) | 1 | Complete | v2.6.1 |
| DFC-02 (`phase_diff`s gate row states what the resolver returns, in both prose sites) | 1 | Complete | v2.6.1 |
| DFC-03 (the plan-checker contract agrees with itself on its dimension count) | 1 | Complete | v2.6.1 |
| DFC-04 (the `risk_surface` row admits the artifact `/cad-task` can produce) | 1 | Complete | v2.6.1 |

## Deferred

Tracked, not in the current roadmap.

Deferred out of `v2.5.0` on 2026-08-08 as a block, to release the plan-size
fix early rather than hold it behind four more phases. Nothing about these
nine changed - they carry forward to `v2.6.0` together with v2.5.0's roadmap
phases 3-6 (renumbered 1-4 at the open) and with queue triage's context and
plan intact at `phases/1/`, so the next cycle resumes from a planned phase
rather than a blank one. The reason for the split is that
`workflow.max_plan_tasks` and the plan-checker's proportionality dimension do
nothing until they ship and install; every phase planned before that release is
planned by the unbounded gates that cost this cycle two failed plan rounds on
queue triage alone.

- **PRS-01**: `planning-files.mjs`' frontmatter reads stop dropping and fabricating: a block item with no active `currentKey` yields an `unknown-line` issue rather than vanishing, `unwrap` cannot mint a value from a quote followed by text, and `readFrontmatterList` handles a comment that is the whole remainder of a key line as well as a CRLF-checked-out file. Carries `PRS-02`'s deferred half: `promoteUnreleased`'s fence-aware bounding and `unseeded` firing on a populated Traceability table missing the milestone's ids. Deferred 2026-08-08 out of `v2.6.0` on field evidence: running this parser over every plan file in five live projects (`burnrate`, `hindsight`, `assistant`, `jcrenshaw.dev`, `placer`) produced ZERO frontmatter or undeclared issues. The defects are real in the code and have never given anyone a wrong answer - they were found by reading the parser, not by the parser failing. Real, unhit, and correctly behind work that is breaking someone today. Promote on the first field occurrence
- **EVD-01**: A phase's joined run record has a publishable form. `planning.mjs trace export` reads `.planning/trace.jsonl` and emits a redacted artifact under a STATED rule - what is dropped, what is preserved, and why the raw file stays out of the repo - where a field the rule does not name is dropped rather than emitted, so a future event family cannot leak by default. Publication is an export, never a lifting of the ignore, on the same reasoning D-01 applied to the capture queue in phase 1. Deferred 2026-08-08 with the demotion of `EVD-02`: this machinery exists to PUBLISH a trace, which is an audit-facing want rather than a live defect, and the live defect in the same area - a run record no project keeps out of git at all - is `FLD-02` in phase 3. Promote when a trace is actually going to be shared
- **XCP-01**: Friction with Cadence itself, noticed while using Cadence on another project, reaches Cadence's own queue instead of the host project's. `/cad-capture` writes to the current project's `.planning/CAPTURE.md`, which is right for domain work and cannot express this one case, so the note either becomes noise the host's triage archives as out of scope or is never written. Measured 2026-08-08: 135 open capture items across `hindsight` (82), `assistant` (28) and `burnrate` (25), of which 5 lines total mention Cadence at all - ten projects of field use, five tagged and shipped, producing essentially no Cadence feedback. The consequence is this roadmap: `v2.2.0` the residue, `v2.3.0` where the bytes live, `v2.4.0` the parallel path, `v2.5.0` what Cadence says about itself, `v2.6.0` reconciliation - five consecutive cycles scoped from Cadence auditing Cadence, because that is the only loop that closes. `FRI-01..03` exist because the maintainer hit them by hand and remembered. Open design questions a plan must answer, not assumptions: where the target queue lives when Cadence is an installed read-only plugin cache rather than a checkout, what happens when the maintainer is not the user, and whether a capture crossing a project boundary needs the redaction `EVD-01` gives a run record. Tracked as #96. Not `v2.6.0` - that cycle is full
- **MIN-01**: Over-building is named and attacked at the three points it can be, as ONE stated posture rather than three proposals: `cad-executor` ships the lean version and flags the fuller option in its deviation record instead of building it speculatively; a review pass hunts complexity to DELETE (reinvented stdlib, single-implementation abstractions, dead flexibility, config nobody sets) and returns a ranked delete-list applying nothing, separate from the correctness reviewer. **Part 3 - the in-code shortcut marker and its harvest - was PULLED FORWARD 2026-08-08 as `DBT-01`, in `v2.6.0` phase 3, and is no longer part of this id.** It was the only one of the three that adds no resident prose to the dispatch path - a convention plus a seam - so the objection that keeps the other two here does not reach it. What remains deferred under this id is parts 1 and 2. Folded 2026-08-08 from issues #29, #30 and #31 into #95 - each part is nearly worthless alone (a delete-list nobody acts on, a YAGNI default with no pass catching what slips through, a marker convention with no harvest), and an adversarial CORRECTNESS review structurally cannot catch over-building because nothing it checks is wrong. Not `v2.6.0`: parts 1 and 2 add resident prose, the same objection that deferred `CTX-02`, and this cycle's live-friction surfaces already sit at exactly their byte budgets. The 2026 harness dossier (audited at `v2.4.0`, ranked Cadence #1 of 35) lists this as improvement priority #4, reading the three open issues as outstanding
- **RCL-06**: External memory backends (mem-*/claude-mem/MCP) behind the same `recall(query) → snippets` contract
- **CTX-02**: Prose that rides every dispatch is stated once rather than restated per file: a writing contract (issue #69) preloaded and asserted to resolve for every agent, and a review minimalism lens (issue #29) reporting what could be deleted, separately from the correctness pass. Deferred out of `v2.5.0` on 2026-08-08 at phase-2 context: both halves ADD resident bytes in the phase that exists to cut them, and the writing contract's premise is false in this tree — nothing restates a writing contract per agent today (grep of `skills/`, `agents/`, `cadence-core/` returns zero), so it is net-new prose on all 19 agent files rather than a deduplication. The minimalism lens as a new review trigger needs coordinated edits across at least six mutually self-verified surfaces, every one of which adds bytes. Neither issue has a statement in this tree to plan against. See `phases/2/CONTEXT.md` D-06

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
| CTW-01 | Phase 1 | Complete |
| CTW-02 | Phase 1 | Complete |

Empty between milestones. `v2.3.0`'s eleven rows moved to `## Shipped` at its
close, so the next cycle's audit starts clean. Rows come back one at a time
from `/cad-plan`'s `seed-reqs` call as each phase is planned - never
hand-populated.

---
*Last updated: 2026-08-09 v2.6.1 closed with all four requirements delivered and verified (4/4 traced, 8/8 acceptance criteria covered); DFC-01..04 move to `## Shipped` as rows and `## Traceability` starts clean. No next cycle scoped yet*
