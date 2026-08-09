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
- **FRI-03**: A planning-doc version the project has ALREADY PUBLISHED is detected mechanically by `/cad-audit`, rather than only reported by the `/cad-health` prose rule `QW-04` ships (issue #87). The routing-floor and branch-naming halves of this requirement moved to `QW-03` and `QW-04`, which closed them in v2.5.0 phase 1. NARROWED 2026-08-08 to the `/cad-audit` arm alone; the self-verify arm is dropped. `QW-04` already ships a published-version guard and a `/cad-health` rule, so this was building detectors two AND three for one incident that is already caught. `/cad-audit` is the arm that matters because it is the ship gate a close runs through, and one detector at the gate is the whole requirement
- **FLD-01**: A phase directory named `08-meteogram-legend` is addressable by every seam that takes `--phase`, or Cadence states numeric-only as a grammar and `/cad-health` reports a violation. Today `planning.mjs plan-overlap --phase 08-meteogram-legend` returns `bad-args`, so those seams are simply unusable on `tempest` and `atmos`, both shipped projects using named directories. A numeric-prefix collision (`atmos` has `14-data-depth-...` and `14-shared-derivation-extraction`) produces a named diagnostic rather than one silently shadowing the other. Found 2026-08-08 by running Cadence's own seams across ten live projects; unfiled until then, which is `XCP-01`'s argument demonstrated rather than asserted
- **FLD-02**: A project Cadence created keeps `.planning/trace.jsonl` out of git without the user having done anything by hand. `cadence-core/workflows/execute.md:226` asserts the record "is gitignored" as the load-bearing reason a worktree's trace cannot ride a merge back, and NOTHING in Cadence writes that line - `/cad-new-project` mentions gitignore nowhere, and the premise holds in this repo only because it was added manually. Every other Cadence project commits its run record, carrying routing, provider and worker events, on the next `git add .planning`. Nine projects have no trace today only because none has run a phase since `QW-02` shipped in `v2.5.0`. Proved on a scratch project, not on this one
- **PRS-02**: `REQ_ID_EXACT` accepts an id whose category does not start with `[A-Z]`, closing the v1.4.0 phase-5 regression, with a regression test proved failing-capable against the unpatched code. NARROWED 2026-08-08: `promoteUnreleased` fence-awareness and the `unseeded` populated-table arm moved to Deferred with `PRS-01`, for the reason recorded there. This id keeps only the defect with a recorded field occurrence
- **DBT-01**: A deliberate corner-cut is marked where it is cut, and the marker reaches the deferred-work queue instead of rotting in a comment nobody greps for. Three parts: a stated convention for marking a shortcut at its location in the code, naming the shortcut's CEILING (what it does not handle) and the TRIGGER that should prompt revisiting it; a harvest that collects those markers into `.planning/CAPTURE.md`, the deferred-work stream `/cad-capture` already owns; and a regression test proving the harvest finds a planted marker and does not invent one. Part 3 of issue #95 only, pulled forward 2026-08-08 as a foothold - parts 1 and 2 (the executor's YAGNI posture and the review delete-list) stay deferred under `MIN-01` with their existing reasoning, because they add resident prose on the dispatch path and this does not. Two findings that constrain it, measured before it was written: the tree already carries 19 conventional markers (14 `TODO`, 2 `NOTE`, 1 each `XXX`/`HACK`/`FIXME`) and nothing lints any of them, so the convention needs its OWN token or the harvest returns 19 false positives on its first run; and `.planning/CAPTURE.md` is gitignored here and in `burnrate` but TRACKED in `hindsight` and `assistant`, so the queue's durability varies by project. That asymmetry has one coherent answer and the requirement takes it: the marker in tracked code is the durable record, the queue is a REGENERABLE view of it, and the harvest is idempotent - a queue lost to a clone is rebuilt by re-running the harvest. The harvest is a seam rather than a documented grep for the same reason: only a seam can be idempotent and carry the regression test, and per D-20 it ships with its `CONTRACTS` row in the same task
- **TOK-03**: What a dispatch costs is recorded where it happens. `trace append` takes a numeric token count on a lifecycle `return` and stores it on the event, and EVERY site that dispatches a worker brackets it. The second half is the larger one and it is measured, not assumed: only `execute.md` and `verify-deep.md` bracket anything today, while `context.md` (1 dispatch), `plan.md` (3) and `review-triggers.md` (every reviewer - it records an adjudication outcome but no lifecycle bracket) have none. On the session that scoped this phase, 71% of subagent spend happened at unbracketed sites: 206,901 tokens for the assumptions analyzer, 346,882 for planner plus checker plus revision, 219,068 for two reviewers, against 310,503 for the two bracketed roles. Adding a token field without the missing brackets would have measured the cheap 29% and reported it as the whole. `trace render` then reports per-role totals - tokens and dispatch count per worker key - beside the four family counts, and a role that ran with no figure available renders `unrecorded` rather than zero, because those are different claims. Cheap by construction: `renderEvent` already spreads unknown fields onto the line (`trace.mjs`), so no library schema changes - what is new is a CLI flag with numeric validation and its `CONTRACTS` row, plus prose brackets at six dispatch sites
- **TOK-04**: The trace records the READ-SET each dispatch was told to consume - the planning-doc paths named in its prompt - so the duplicate-read fraction is computed from the record instead of estimated. Motivation, measured: `PROJECT + REQUIREMENTS + ROADMAP + CONTEXT` is 85,413 B (~21.4K tokens) in this repo, and five dispatches were each told to read that same set for phase 2's planning - about 107K tokens of byte-identical re-reads. Whether that is 15% of the phase's spend or 40% is currently unanswerable, and the answer decides whether trimming the planning docs is worth a requirement at all. This is the half that makes `TOK-03`'s totals actionable rather than merely true: knowing a role cost 200K says nothing about what to cut, while knowing 21K of it was the same four files every other role also read does
- **EVD-02**: One runtime-evidence artifact is committed and linked from `README.md`: the `weight.mjs` resident and turn-one byte figures with the exact command that regenerates them, plus - if a non-Cadence project has run a phase by then - that project's phase trace, named with the project it came from and the environment it ran in. DEMOTED 2026-08-08 from its own phase to one task in the doc sweep, and `EVD-01`'s export-and-redaction machinery deferred with it: the publish half was scoped from an external audit rather than from anything failing, and `FLD-02` carries the part that is actually broken. The trace half is contingent by design - no non-Cadence project has a run record yet - and the byte half stands alone if none arrives. If the trace lands, the artifact states that it records a run that happened and is not reproducible. The trace comes from a project that is NOT Cadence: Cadence measuring Cadence is the weakest available evidence for the one thing the 2026 harness dossier could not check, and five shipped projects are available (`tempest` v2.9.5, `burnrate` v1.0.3, `weathervane` v0.9.1, `atmos` v1.3.1-alpha, `placer` v0.1.0-beta.2), with `hindsight` and `assistant` mid-cycle
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
| REC-01 | Phase 1 | Complete |
| REC-02 | Phase 1 | Complete |
| FRI-01 | Phase 2 | Complete |
| FRI-02 | Phase 2 | Complete |
| FRI-03 | Phase 2 | Complete |
| FLD-01 | Phase 3 | Complete |
| FLD-02 | Phase 3 | Complete |
| PRS-02 | Phase 3 | Complete |
| DBT-01 | Phase 3 | Complete |
| TOK-03 | Phase 4 | Pending |
| TOK-04 | Phase 4 | Pending |

Empty between milestones. `v2.3.0`'s eleven rows moved to `## Shipped` at its
close, so the next cycle's audit starts clean. Rows come back one at a time
from `/cad-plan`'s `seed-reqs` call as each phase is planned - never
hand-populated.

---
*Last updated: 2026-08-08 v2.6.0's four carried-over phases renumbered 3-6 -> 1-4, so the cycle starts at phase 1; queue triage's context and plan moved to `phases/1/`*
