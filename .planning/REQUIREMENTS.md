# Requirements: Cadence (v2.6.0 shipped)

**Defined:** 2026-07-16
**Core Value:** What Cadence writes down during a project (deviations, decisions, captures, UAT findings) must come back on its own at the moment it matters — planning, context-gathering, and debugging — without any external memory system.

## Active

`v2.6.1 — the defects the sweep found`. Opened 2026-08-09 when `v2.6.0` closed
with all fourteen of its requirements delivered. The entire scope is the four
defects that cycle's own doc sweep found and filed under `## Deferred` rather
than rewording away, now promoted here.

Why they are a cycle rather than a backlog. Each is located to a file and a
line, each is close to a one-line fix, and none is a design question, so the
whole thing is small on purpose. Filing them was an explicit refusal to convert
a bug into a documentation edit (that is `DOC-03`, which shipped in v2.6.0); a
defect filed and then left for a convenient cycle just ages into the next
sweep's findings, which is the failure the filing existed to prevent.

What to plan for rather than discover: `DFC-02` and `DFC-04` both live in
`cadence-core/references/review-triggers.md`, a file sitting at exactly its byte
budget with zero slack, and that budget figure is quoted inline by
`skills/cad-land/SKILL.md` and `skills/cad-plan-review/SKILL.md`. Either fix is
three coordinated edits, not one. `cadence-core/references/**` was outside
v2.6.0's swept surface, which is why both were filed instead of corrected in
place.

Guardrail, earned twice in v2.6.0: a correction is not free. Two independent
review passes each caught that cycle's doc sweep breaking something while fixing
something else, once shipping a command name that exists nowhere in the tree,
once replacing a working artifact reference with an under-specified one. Every
fix here lands with the check that would have caught its own failure mode.

- **DFC-01**: `cadence-core/bin/lib/trace.mjs:336` builds the composite worker key with two literal U+0000 bytes typed into the template string rather than the `\0` escape sequence, so `file(1)` classifies the source as `data` and every `grep`/`rg` over `cadence-core/bin/**` silently skips that whole file unless the caller passes `-a`. The code computes the right key, which is why no test catches it — the defect is entirely in what the bytes do to every tool that reads the file afterwards, and a search that silently omits one file returns a wrong answer with no error. It is a one-character-per-byte fix (`^@` -> `\0`) that changes no behaviour. Filed rather than fixed inline because phase 5 edits documentation and this is a source change; filed rather than left as a note because it has already cost a debugging detour in phase 4's UAT, its only prior record was `.planning/CAPTURE.md`, which is gitignored in this repo and therefore exists on one machine only, and every pass that does not know about it rediscovers it and works around it. Named in advance by `phases/5/PLAN.md` task 3 and filed whether or not the sweep surfaced it; run 1 did not, because the file is outside the swept surface
- **DFC-02**: The review-trigger wiring table at `cadence-core/references/review-triggers.md:244` states `phase_diff`'s gates as `off / off / adjudicated` across solo/shipped/critical, and `docs/WORKFLOW.md:168` carries the same row. The live `cadence-core/route-table.json` resolves `off / advisory / adjudicated`, and the `review.triggers.phase_diff.gate` schema default is `advisory`. Not a wording preference: `review-triggers.md` is the reference every other surface cites for this table, so four of run 1's eighteen stale rows — `METHOD.md:276`, `METHOD.md:279`, `cadence-core/workflows/execute.md:382-383`, `:387-388` — are one fact copied out of it, and correcting the four without correcting the source leaves the drift to be re-derived. Both files are outside AC1's swept surface (`cadence-core/references/**` and `docs/**` are excluded by `phases/5/CONTEXT.md`'s scope boundary and by the plan's file lease), and `review-triggers.md` sits at exactly its 17,733 B budget with zero slack, so `off` -> `advisory` also moves the budget and the two inline figures AC6 is fixing in the same phase. Filed rather than reworded away, and rather than widened into scope on an executor's own judgement
- **DFC-03**: `skills/cad-plan-checker-contract/SKILL.md` contradicts itself about its own size: `:42` says "Check six dimensions" and lists Proportionality as the sixth, while `:113`'s `<success_criteria>` still says "All five dimensions checked". A checker whose completion criterion names five of the six it was told to check can report success having skipped the one added to bound plan size, which is the dimension `v2.5.0` shipped the whole cycle early to install. Same fact as run 1's `METHOD.md:91` row, one file over; that row is corrected in this phase, this one is filed because `skills/**` is outside AC1's surface and the file is not in the plan's lease
- **DFC-04**: The `risk_surface` row of the wiring table at `cadence-core/references/review-triggers.md:243` admits shape (c) only as "the flagged-diff FILE path the checkpoint returned", and `/cad-task` is the one `risk_surface` fire site with no executor and no checkpoint: it can produce a shape-(c) path, but not the one the row describes. Section 2's own definition of shape (c) at `:59-63` is already broad enough ("a file artifact... or one the reviewer's tree cannot reach"), so the row's QUALIFIER is what is wrong, not its shape vocabulary. CORRECTED 2026-08-09 at /cad-context 1: the workflow half of this filing is already closed. This row originally also said `cadence-core/workflows/task.md`'s corrected text named no diff path, no never-stage rule and no cleanup, which described `044806c`'s state; `716fb60` superseded it during `/cad-verify 5` by taking the second exit named below, so `task.md:73-88` now carries all three. What remains is the table row alone. Whoever takes it decides one thing: broaden the row's qualifier so it admits a shape-(c) path however it was produced, or admit shape (a) for already-committed fire sites and revert `task.md` to refs - the second discards what `716fb60` restored

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

Empty between milestones. `v2.3.0`'s eleven rows moved to `## Shipped` at its
close, so the next cycle's audit starts clean. Rows come back one at a time
from `/cad-plan`'s `seed-reqs` call as each phase is planned - never
hand-populated.

---
*Last updated: 2026-08-09 v2.6.0 closed with all fourteen requirements delivered; they move to `## Shipped` as rows and `## Traceability` starts clean. `v2.6.1` opens on DFC-01..04, promoted out of `## Deferred`*
