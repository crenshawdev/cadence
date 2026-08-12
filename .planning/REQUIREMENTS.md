# Requirements: Cadence (v2.6.1 shipped)

**Defined:** 2026-07-16
**Core Value:** What Cadence writes down during a project (deviations, decisions, captures, UAT findings) must come back on its own at the moment it matters — planning, context-gathering, and debugging — without any external memory system.

## Active

`v3.1.0 — Cadence meets outside work` opened on 2026-08-12, scoped from the
v3.0.0 backlog: the first external-project dogfood run (verbatim, phase 1
end-to-end at ~968k recorded subagent tokens under the retuned defaults) plus
the tracker picks #95, #96, #101, #106-#110. Two themes: work that started
outside Cadence (a brownfield repo, a freeform discovery session, friction
noticed on a host project), and the accounting the trace still misses (the
coordinator itself, the one dispatch bought without a sizing question, and the
tuner that reads the finished record having no front door to reach it by).

- **ADP-01**: `/cad-adopt` initializes `.planning/` from an EXISTING repo: PROJECT.md, REQUIREMENTS.md and a remaining-work ROADMAP.md reverse-engineered from the code and git history, with the deep questioning asking ONLY what the code cannot answer. The output shape is exactly `new-project`'s, so every downstream command works unchanged - falsifiable as: an adopt on a brownfield repo yields a `.planning/` that passes `/cad-health` and seeds Traceability through the same seams. Tracked as #106
- **BRF-01**: `cad-new-project --brief <file>` reads a design brief from a freeform discovery session and asks only what the brief leaves open - the socket, never a scripted interview (the discovery works BECAUSE it is freeform; verbatim's first commit is "restart from the design brief" and its init re-asked settled questions). Ships with a one-page `docs/` entry on the discovery workflow linked from the README getting-started path: what a good brief answers (the problem, the user, the non-goals, the real constraints), a page, not a methodology. Tracked as #107
- **TRC-01**: The coordinator's own spend reaches the run record. Every subagent is priced; the orchestrating session - half the original cost spiral - is invisible (verbatim phase 1: ~968k recorded subagent tokens, coordinator unknown). A per-step marker event carries only what the coordinator can actually know (never a fabricated token figure), calibrated against verbatim's completed phase-1 trace, and is consumed by `/cad-report`'s record-health line and `trace suggest`'s evidence floors. Tracked as #108
- **SIZ-01**: `context.md` gains the sizing gate `plan.md` already has: settle phase scope cheaply BEFORE buying the analyzer pass - the single most expensive dispatch in the spine (75k on verbatim phase 1, 132k on phase 2) - and skip to a conversational fallback when the phase is small or its ground was settled by a prior phase's deviations. The phase-2 evidence says a big phase earns the pass; the gate exists for the small ones. Tracked as #109
- **MIN-01**: Over-building is named and attacked at the three points it can be, as ONE stated posture rather than three proposals: `cad-executor` ships the lean version and flags the fuller option in its deviation record instead of building it speculatively; a review pass hunts complexity to DELETE (reinvented stdlib, single-implementation abstractions, dead flexibility, config nobody sets) and returns a ranked delete-list applying nothing, separate from the correctness reviewer. **Part 3 - the in-code shortcut marker and its harvest - was PULLED FORWARD 2026-08-08 as `DBT-01`, in `v2.6.0` phase 3, and is no longer part of this id.** It was the only one of the three that adds no resident prose to the dispatch path - a convention plus a seam - so the objection that keeps the other two here does not reach it. What remains deferred under this id is parts 1 and 2. Folded 2026-08-08 from issues #29, #30 and #31 into #95 - each part is nearly worthless alone (a delete-list nobody acts on, a YAGNI default with no pass catching what slips through, a marker convention with no harvest), and an adversarial CORRECTNESS review structurally cannot catch over-building because nothing it checks is wrong. Promoted from Deferred 2026-08-12: the prose-cost objection is answered by the deferred-read machinery CTW-04 shipped - branch-local lens prose can ride behind a Read, watched by check 13. Tracked as #95
- **XCP-01**: Friction with Cadence itself, noticed while using Cadence on another project, reaches Cadence's own queue instead of the host project's. `/cad-capture` writes to the current project's `.planning/CAPTURE.md`, which is right for domain work and cannot express this one case, so the note either becomes noise the host's triage archives as out of scope or is never written. Measured 2026-08-08: 135 open capture items across `hindsight` (82), `assistant` (28) and `burnrate` (25), of which 5 lines total mention Cadence at all - ten projects of field use, five tagged and shipped, producing essentially no Cadence feedback. The consequence is this roadmap: `v2.2.0` the residue, `v2.3.0` where the bytes live, `v2.4.0` the parallel path, `v2.5.0` what Cadence says about itself, `v2.6.0` reconciliation - five consecutive cycles scoped from Cadence auditing Cadence, because that is the only loop that closes. `FRI-01..03` exist because the maintainer hit them by hand and remembered. Open design questions a plan must answer, not assumptions: where the target queue lives when Cadence is an installed read-only plugin cache rather than a checkout, what happens when the maintainer is not the user, and whether a capture crossing a project boundary needs the redaction `EVD-01` gives a run record. Promoted from Deferred 2026-08-12. Tracked as #96
- **CTW-06**: The re-measured remnant of #101 leaves the eager path: `skills/cad-land/SKILL.md`'s guardrails re-derivation of the `git.auto_close` mechanic (the named keeps stand: the no-preselected-default block and the not-scoped-to-GitHub clause) and `cad-executor-contract`'s static-analysis carve-out stated in full twice (the step copy becomes a pointer to `<deviation_rules>`). Correction recorded 2026-08-12: the #101 re-measure listed `cad-plan-checker-contract`'s `<success_criteria>` checklist as outstanding, but CTW-03's own history keeps it deliberately - `prose-agreement.test.mjs:69-95` asserts it as the DFC-03 fix - so it is NOT in this id. Per-surface re-pins in the same commit, as CTW-03 required. Tracked as #101
- **TUN-01**: `/cad-suggest` gives `trace suggest` a front door. The seam already ranks routing recommendations off the run record and carries the evidence behind each one; the only path to it is a one-line pointer at the end of `/cad-report` (`workflows/report.md`), so a user who does not run that command, or who stops reading before its last line, never learns the tuner exists. Falsifiable as: a discoverable skill at `skills/cad-suggest/SKILL.md` relays `node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" trace suggest`, presents each recommendation with the trace figures behind it, writes no config of its own and names the `/cad-config` path for anything accepted, and reports the thin-trace refusal in one line rather than inventing a suggestion to fill the space. Registration in `skills/cad-help`, `README.md` and `.planning/DOCS-CLAIMS.md` is part of the requirement, not a follow-up, with the README update carried as its own execution task when phase 3 is planned. Ordered behind `TRC-01`: the coordinator events change what the evidence floors are computed over, so the command cannot correctly ship until phase 1 lands. Tracked as #110

`/cad-plan` seeds each requirement's Traceability row as its phase is planned -
rows are never hand-populated here.

## Shipped` below, its phase record in `.planning/_archive-v2.6.2/`, and its
narrative in `CHANGELOG.md`.

The next milestone's requirements are seeded here when it opens. The candidate
pool is `.planning/CAPTURE.md`, which holds 260 open todos - 18 tagged `[high]`
and 21 sourced from review passes, clustering on gate correctness.

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
| EVD-02 (docs/EVIDENCE.md, weight definitions + the commands that measure, linked from README) | 5 | Complete | v2.7.0 |
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
| CTW-01 (a deferral from a workflow file or contract skill is watched by CI) | 1 | Complete | v2.6.2 |
| CTW-02 (an `@`-include nothing in the command's own eager prose names fails CI) | 1 | Complete | v2.6.2 |
| CTW-03 (eager bytes leave the path with no new files or register rows) | 2 | Complete | v2.6.2 |
| CTW-05 (four prose/code drifts the sweep found in passing) | 2 | Complete | v2.6.2 |
| CTW-04 (~22,300 B of branch-local prose moves behind a `Read` at its step) | 3 | Complete | v2.6.2 |

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
| TRC-01 | Phase 1 | Complete |
| SIZ-01 | Phase 1 | Complete |

Empty between milestones. `v2.3.0`'s eleven rows moved to `## Shipped` at its
close, so the next cycle's audit starts clean. Rows come back one at a time
from `/cad-plan`'s `seed-reqs` call as each phase is planned - never
hand-populated.

---
*Last updated: 2026-08-10 v2.6.2 closed with all five requirements delivered and verified (5/5 traced, 21/21 acceptance criteria covered); CTW-01..05 move to `## Shipped` as rows and `## Traceability` starts clean. No next cycle scoped yet*
