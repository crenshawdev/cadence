# Requirements: Cadence (v2.5.0 shipped)

**Defined:** 2026-07-16
**Core Value:** What Cadence writes down during a project (deviations, decisions, captures, UAT findings) must come back on its own at the moment it matters — planning, context-gathering, and debugging — without any external memory system.

## Active

`v2.6.0 — the reconciliation cycle`. Opened 2026-08-08 when `v2.5.0` closed
early. These nine requirements are `v2.5.0`'s deferred half, carried forward
unchanged: they were never planned against, never cut, and never re-scoped
except where noted on `REC-01`/`REC-02` below.

Why it split. `v2.5.0` ended up containing a fix to Cadence's own planning
gates - `workflow.max_plan_tasks` plus a proportionality dimension on
`cad-plan-checker` - and that fix does nothing until it ships and installs.
Queue triage had by then been planned at 10 tasks, cut, replanned at 15, and passed
every gate both times, which is precisely the failure the new ceiling exists to
catch. Planning four more phases before the release would have run all four
through the same unbounded gates. So the cycle closed on what was verifiably
done and the rest rolls here, where the gates work.

What this cycle is. A reconciliation cycle, not a construction one.
`.planning/CAPTURE.md` holds 213 open items (as of 2026-08-08) accumulated over
nine milestones; some were closed by work that shipped and never struck, some
describe code that no longer exists, and the real ones have gone unread because
the file is too long to triage in passing. That same file is the input to
`/cad-plan`'s recall, so its noise is paid for at every planning dispatch. The
outward half is the same problem: what Cadence claims about itself in
`README.md`, `METHOD.md`, `INTERNALS.md`, `CONTRIBUTING.md` and its workflow
prose has never been checked end to end against the code.

`FRI-*` is the friction the user hits by hand every session and `PRS-*` the
planning-data parser every other seam reads through. Both were scoped from items
whose claims were re-confirmed against the live tree before being written down —
the [blocker] O(K x N) git-guard item, by contrast, was closed by `TOK-02` in
v2.2.0 and is deliberately absent.

v2.5.0's roadmap phases 3-6 carry over, renumbered 1-4 on 2026-08-08 at the open
so this cycle starts where a cycle starts. Queue triage keeps its gathered
context and its written plan, now at `phases/1/CONTEXT.md` and
`phases/1/PLAN.md`, so the cycle resumes from a planned phase rather than a blank
one. A bare `phase N` in this section means a `v2.6.0` phase; a shipped
predecessor is written `v2.5.0 phase N`. `/cad-plan` seeds each id's Traceability
row as its phase is planned.

- **REC-01**: The capture queue stops carrying items nobody has read. Every non-current-cycle open `CAPTURE.md` item is archived as a block under one dated reason — an item carried unread across nine milestones is presumptively dead, and proving that one item at a time costs more than it returns. Every current-cycle (v2.5.0) item IS triaged individually against the live tree and lands in exactly one of three states: closed with the commit or tree evidence that closed it named, moot with the reason stated, or kept with its claim re-verified. No current-cycle item survives on its original wording alone (rescoped 2026-08-08; the original per-item rule over all 213 open items was planned twice, failed review twice, and cost days of executor time for a queue nobody reads)
- **REC-02**: The capture file stops being an append-only log: moot items move out of the live queue to a `## Archive` section, so what `/cad-plan`'s recall reads is the set of things still true. Closed items stay, carrying their `[closed]` marker — `planning-files.mjs:602-609` keeps them in the corpus on purpose as the prior evidence recall exists to surface, and they are 18.9% of it. Archive invisibility is proved directly rather than by measurement: a token occurring only in archived text returns zero from recall, while the same token against a control copy whose `## Archive` heading is renamed into the walked set returns the bullet (the before/after BM25 measurement was dropped 2026-08-08 with the scope cut — it measured work this phase no longer does; the isolation method is preserved verbatim at phase 1 CONTEXT D-07 for any later phase that needs it)
- **FRI-01**: `/cad-verify` states the human-check bar — an item is human-verify only when the model cannot execute it (irreversible against real data, or outside its reach: credentials, GUI, hardware, another machine) — and its walk runs and cites everything else as a results table, reserving the one-at-a-time turn-ending walk for the items that survive the bar. `cad-verifier`'s `why_human` field already encodes this; the walk does not apply it
- **FRI-02**: A blocking review trigger cannot re-arm without bound on the commit that fixes the findings it just raised: the cap is stated, the loop terminates, and exceeding it surfaces a named reason. Every dispatched agent carries an explicit runaway-loop bound (issue #72 — `maxTurns` is the only guard the host offers and Cadence sets it nowhere)
- **FRI-03**: A planning-doc version that disagrees with the shipped manifest is detected mechanically, by `/cad-audit` and self-verify, rather than only reported by the `/cad-health` prose rule `QW-04` ships (issue #87). The routing-floor and branch-naming halves of this requirement moved to `QW-03` and `QW-04`, which closed them in v2.5.0 phase 1
- **PRS-01**: `planning-files.mjs`' frontmatter reads stop dropping and fabricating: a block item with no active `currentKey` yields an `unknown-line` issue rather than vanishing, `unwrap` cannot mint a value from a quote followed by text, and `readFrontmatterList` handles a comment that is the whole remainder of a key line as well as a CRLF-checked-out file
- **PRS-02**: `planning-files.mjs`' section and id reads stop truncating and mis-rejecting: `promoteUnreleased`'s bounding is fence-aware, `REQ_ID_EXACT` accepts a category not starting with `[A-Z]`, and `unseeded` fires on a populated Traceability table missing the milestone's ids rather than only on a zero-row one. Every fix ships with a regression test proved failing-capable against the unpatched code
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
*Last updated: 2026-08-08 v2.6.0's four carried-over phases renumbered 3-6 -> 1-4, so the cycle starts at phase 1; queue triage's context and plan moved to `phases/1/`*
