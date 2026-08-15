# Requirements: Cadence (v3.2.0 open)

**Defined:** 2026-07-16
**Core Value:** What Cadence writes down during a project (deviations, decisions, captures, UAT findings) must come back on its own at the moment it matters — planning, context-gathering, and debugging — without any external memory system.

## Active

`v3.3.0 - the record you plan from`, opened 2026-08-14. Five requirements -
three scoped at open, two added 2026-08-14 from the repo scan
(design-notes/sweep-2026-08-14-repo-scan.md). Originally three,
scoped from a triage of `.planning/CAPTURE.md`: 309 file-wide bullets read down
to 119 live todos, 15 retired against shipped v3.2.0 code, the survivors grouped
by fix site into eight clusters of which three are here. The five ids in
`## Deferred` below - `LND-01`, `PRS-01`, `EVD-01`, `RCL-06`, `CTX-02` - all
still hold their deferral reasons and none is promoted this cycle.

- **COR-01**: The four bin correctness/duplication gaps the 2026-08-14 scan
  verified are closed: string-form `protected_branches` honored by all four
  readers, the fence-blind `## Phases`/`## Active` scanners guarded, blank
  `--root` refused consistently, and the copied helpers
  (`flag`/`flagValue`/`readText`, the branch reader) stated once.
- **ENF-01**: The scan's enforcement and round-trip findings become seams:
  criteria ceilings counted, one `trace close` replacing eight files' restated
  close prose, `trace render` bounded by default, the measured unbatched
  round-trips batched, and the shipped read instrumentation proven (or proven
  absent) inside subagent dispatches and joined to its fire.
- **CAP-01**: A bullet `/cad-capture` writes is reachable by `/cad-plan`'s
  recall, and one that is not reachable is reported rather than silent. Today
  `planning-files.mjs:684` walks `## Todos`, `## Seeds` and `## Notes` only, and
  five items filed after the 2026-08-08 archive block were appended below
  `## Archive` - outside that walk, invisible to recall, one of them a `[high]`
  finding that a tuning rule can never fire - until they were lifted by hand on
  2026-08-14. The tag reader at `:627` compounds it by dropping shapes the queue
  actually contains, so an item can also lose its phase field while staying in
  the walk. Covers the section the writer lands in, the reader's grammar, a
  `/cad-health` report naming any capture bullet outside the walk, and a
  concurrent-append guard: the file has no locking, it is the recall corpus, and
  a lost update was caught in flight while this cycle was being scoped.

- **TRC-01**: The joined run record answers questions about itself correctly.
  `corr` is phase-scoped rather than fire-scoped, so a provider call cannot be
  attributed to the fire that made it; an event written before the phase anchor
  falls back to the bare phase form and never joins; a terminal event's `--role`
  is never validated against its paired dispatch, so a role with zero dispatches
  can render carrying a token total while the real worker reads `unrecorded`;
  `recorded` counts token-bearing events rather than matched dispatches, so a
  replayed terminal can hide a missing report; and `trace suggest`'s R1 rule
  sums survivors across a trigger's whole lifetime (`lib/trace-suggest.mjs:161`),
  which measured over 460 events on 2026-08-14 means it can never fire and never
  has. `/cad-report` prices a phase from this record and `/cad-suggest` derives
  retune advice from it, and run cost is this project's standing second
  priority - these are the instruments that answer it.

- **DOC-02**: What Cadence claims about itself is verified this cycle or
  corrected. Fourteen queue items are stale prose left behind by v3.0 through
  v3.2: three surfaces still state the `REQ_ID_EXACT` head-anchored limit
  `PRS-02` removed, `/cad-capture --cadence` is registered in both user-facing
  surfaces but covered by no `DOCS-CLAIMS.md` row, the `README.md` skill count
  has been stale twice and nothing re-measures it,
  `references/acceptance-criteria.md` documents an env override without the
  sentinel now required beside it, and `PROJECT.md`'s `### Active` is trusted
  rather than asserted to name the open cycle's version first. One
  `/cad-docs-verify` sweep plus the edits it names, run last so it also
  reconciles the prose the four phases ahead of it move.

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
| TRC-01 (The coordinator's own spend reaches the run record. Every subagent is priced; the orchestrating session - half the original cost spiral - is invisible (verbatim phase 1: ~968k recorded subagent tokens, coordinator unknown). A per-step marker event carries only what the coordinator can actually know (never a fabricated token figure), calibrated against verbatim's completed phase-1 trace, and is consumed by `/cad-report`'s record-health line and `trace suggest`'s evidence floors. Tracked as #108) | 1 | Complete | v3.1.0 |
| SIZ-01 (`context.md` gains the sizing gate `plan.md` already has: settle phase scope cheaply BEFORE buying the analyzer pass - the single most expensive dispatch in the spine (75k on verbatim phase 1, 132k on phase 2) - and skip to a conversational fallback when the phase is small or its ground was settled by a prior phase's deviations. The phase-2 evidence says a big phase earns the pass; the gate exists for the small ones. Tracked as #109) | 1 | Complete | v3.1.0 |
| ADP-01 (`/cad-adopt` initializes `.planning/` from an EXISTING repo: PROJECT.md, REQUIREMENTS.md and a remaining-work ROADMAP.md reverse-engineered from the code and git history, with the deep questioning asking ONLY what the code cannot answer. The output shape is exactly `new-project`'s, so every downstream command works unchanged - falsifiable as: an adopt on a brownfield repo yields a `.planning/` that passes `/cad-health` and seeds Traceability through the same seams. Tracked as #106) | 2 | Complete | v3.1.0 |
| BRF-01 (`cad-new-project --brief <file>` reads a design brief from a freeform discovery session and asks only what the brief leaves open - the socket, never a scripted interview (the discovery works BECAUSE it is freeform; verbatim's first commit is "restart from the design brief" and its init re-asked settled questions). Ships with a one-page `docs/` entry on the discovery workflow linked from the README getting-started path: what a good brief answers (the problem, the user, the non-goals, the real constraints), a page, not a methodology. Tracked as #107) | 2 | Complete | v3.1.0 |
| MIN-01 (Over-building is named and attacked at the three points it can be, as ONE stated posture rather than three proposals: `cad-executor` ships the lean version and records the fuller option as an `Open items:` line in its report file instead of building it speculatively; a review pass hunts complexity to DELETE (reinvented stdlib, single-implementation abstractions, dead flexibility, config nobody sets) and returns a ranked delete-list applying nothing, separate from the correctness reviewer. **Part 3 - the in-code shortcut marker and its harvest - was PULLED FORWARD 2026-08-08 as `DBT-01`, in `v2.6.0` phase 3, and is no longer part of this id.** It was the only one of the three that adds no resident prose to the dispatch path - a convention plus a seam - so the objection that keeps the other two here does not reach it. What remains deferred under this id is parts 1 and 2. Folded 2026-08-08 from issues #29, #30 and #31 into #95 - each part is nearly worthless alone (a delete-list nobody acts on, a YAGNI default with no pass catching what slips through, a marker convention with no harvest), and an adversarial CORRECTNESS review structurally cannot catch over-building because nothing it checks is wrong. Promoted from Deferred 2026-08-12: the prose-cost objection is answered by the deferred-read machinery CTW-04 shipped - branch-local lens prose can ride behind a Read, watched by check 13. Tracked as #95) | 3 | Complete | v3.1.0 |
| CTW-06 (The re-measured remnant of #101 leaves the eager path: `skills/cad-land/SKILL.md`'s guardrails re-derivation of the `git.auto_close` mechanic (the named keeps stand: the no-preselected-default block and the not-scoped-to-GitHub clause) and `cad-executor-contract`'s static-analysis carve-out stated in full twice (the step copy becomes a pointer to `<deviation_rules>`). Correction recorded 2026-08-12: the #101 re-measure listed `cad-plan-checker-contract`'s `<success_criteria>` checklist as outstanding, but CTW-03's own history keeps it deliberately - `prose-agreement.test.mjs:69-95` asserts it as the DFC-03 fix - so it is NOT in this id. Per-surface re-pins in the same commit, as CTW-03 required. Tracked as #101) | 3 | Complete | v3.1.0 |
| XCP-01 (Friction with Cadence itself, noticed while using Cadence on another project, reaches Cadence's own queue instead of the host project's. `/cad-capture` writes to the current project's `.planning/CAPTURE.md`, which is right for domain work and cannot express this one case, so the note either becomes noise the host's triage archives as out of scope or is never written. Measured 2026-08-08: 135 open capture items across `hindsight` (82), `assistant` (28) and `burnrate` (25), of which 5 lines total mention Cadence at all - ten projects of field use, five tagged and shipped, producing essentially no Cadence feedback. The consequence is this roadmap: `v2.2.0` the residue, `v2.3.0` where the bytes live, `v2.4.0` the parallel path, `v2.5.0` what Cadence says about itself, `v2.6.0` reconciliation - five consecutive cycles scoped from Cadence auditing Cadence, because that is the only loop that closes. `FRI-01..03` exist because the maintainer hit them by hand and remembered. Open design questions a plan must answer, not assumptions: where the target queue lives when Cadence is an installed read-only plugin cache rather than a checkout, what happens when the maintainer is not the user, and whether a capture crossing a project boundary needs the redaction `EVD-01` gives a run record. Promoted from Deferred 2026-08-12. Tracked as #96) | 3 | Complete | v3.1.0 |
| TUN-01 (`/cad-suggest` gives `trace suggest` a front door. The seam already ranks routing recommendations off the run record and carries the evidence behind each one; the only path to it is a one-line pointer at the end of `/cad-report` (`workflows/report.md`), so a user who does not run that command, or who stops reading before its last line, never learns the tuner exists. Falsifiable as: a discoverable skill at `skills/cad-suggest/SKILL.md` relays `node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" trace suggest`, presents each recommendation with the trace figures behind it, writes no config of its own and names the `/cad-config` path for anything accepted, and reports the thin-trace refusal in one line rather than inventing a suggestion to fill the space. Registration in `skills/cad-help`, `README.md` and `.planning/DOCS-CLAIMS.md` is part of the requirement, not a follow-up, with the README update carried as its own execution task when phase 3 is planned. Ordered behind `TRC-01`: the coordinator events change what the evidence floors are computed over, so the command cannot correctly ship until phase 1 lands. Tracked as #110) | 3 | Complete | v3.1.0 |
| CFG-01 (A `__proto__` key in a tracked `.planning/config.json` cannot reparent the merged config or reach any enforcement surface. `lib/config-merge.mjs:68-70` assigns through `merged[k] = deepMerge(...)`, and `JSON.parse` makes `__proto__` an own property, so the setter fires and the merged object is reparented. Proven end to end: with `{"__proto__":{"git":{"on_protected":"allow","protected_branches":[]}}}`, `git commit` on `main` produced NO output from `git-guard.mjs` (allowed), the benign control returned `permissionDecision: "ask"`, and `config.mjs validate` reported `{"ok":true,"checked":0,"errors":[]}`. The split is the defect: `flatten()` (`config.mjs:88-96`) enumerates OWN keys so inspection sees nothing, while `commitDecision`'s `config.git` walks the prototype and obeys it. It bites only when no LOWER layer defines the key (`mergeLayers` bases on `globalValue || {}`), which makes it WORST on a fresh install with no global config, and a naive test on a configured machine looks clean. Scoped honestly: no global `Object.prototype` write, and raw-`JSON.parse` readers like `git-publish.mjs:69 repoAutoClose` are unaffected. Tracked as #114) | 1 | Complete | v3.2.0 |
| CFG-02 (No executable or key-bearing config value lives in the tracked layer at all. `workflow.test_command` and `workflow.lint_command` are commands Cadence runs; `review.key_file` redirects which env file the provider key is read from, passed through by `providersEnvPath(override)` and wired from repo config at four call sites (`references/review-triggers.md:197`, `workflows/decision-review.md:82`, `references/consult.md:43`, `workflows/config-review.md:27`). A cloned repo can point `key_file` at a key file committed inside itself, sending the review payload - plan text, diffs, source - to the attacker's provider account while looking like a working review. DECIDED 2026-08-13, reversing an earlier confirm-on-first-use proposal: approving an injection risk after it has arrived is the wrong shape and trains users to click through a security prompt on every fresh clone. The mechanism already exists and is inert - `config.schema.json` carries a `src` field with exactly one value across 34 keys (`"src": "repo"`) that no `.mjs` reads, though `references/config-catalog.md:11,17` derives its `[src]` column from it and `_meta.note` documents it as ENUM PROVENANCE rather than layer scope - so make it load-bearing with `"src": "global"` and rewrite that legend in the same change, rather than inventing a second config home. A repo layer setting one warns, never silently drops. `cmdDetectCommands` (`planning.mjs:2001-2065`) is unaffected and is the migration path: it emits fixed literals and never interpolates repo content. Tracked as #119) | 1 | Complete | v3.2.0 |
| FSW-01 (`atomicWrite` cannot be redirected by a pre-planted symlink and cannot collide under parallelism. `lib/planning-files.mjs:1808-1812` uses a fixed, predictable, repo-relative `${file}.tmp` and `writeFileSync`, which follows symlinks. Proven: `repo/ROADMAP.md.tmp` planted as a symlink wrote through to a file OUTSIDE the repo, and afterwards `ROADMAP.md` WAS the symlink, so the redirect persists for every future write. Same primitive through `STATE.md.tmp`, `config.json.tmp`, `.gitignore.tmp`, `plugin.json.tmp`, `CAPTURE.md.tmp`; `lib/trace.mjs:278 appendEvent` is the append-only variant. The read path already defends against exactly this (`planning.mjs:2751-2758` lstats and skips symlinks, with a comment saying why); the write path never got it. Second defect, same function: the fixed `.tmp` name plus `parallelization.enabled` defaulting true means two concurrent writers share one temp path, defeating the atomicity the function exists to provide. Tracked as #115) | 2 | Complete | v3.2.0 |
| GAT-01 (No gate returns a clean answer about input it did not successfully read. Two do today. `lib/milestone-prune.mjs:107` filters shipped rows with no `r.status !== 'Deferred'` term where every sibling has one (`planning.mjs:317`, `:513`, `:1023`), and its bullet removal at `:118-124` scans the WHOLE file unbounded while the Traceability removal nine lines below IS bounded, so the `## Deferred` bullet is deleted too and last-write-wins makes the deferral note the shipped row's summary - a deliberately held requirement permanently recorded as delivered, inside the command whose stated job is auditing that nothing was dropped. `land-cleanup.mjs:59-69` collapses unreadable stdin, malformed JSON and a wrong-shaped envelope all to `[]`, and `decideGateHalt` turns that into `proceed` carrying the affirmative reason "no surviving blocker/high finding"; under `git.auto_close` this is the ONLY stop before merge and the payload is model-composed. An unprovable finding set is not an empty one. Tracked as #116) | 2 | Complete | v3.2.0 |
| EXP-01 (No exposure surface leaks a credential or honors an ungated override. `git-publish.mjs:161-163` (also `:209`, `:233`, `planning.mjs:1917-1918`) puts git's stderr into the failure `detail`, and a remote URL carrying userinfo reaches the envelope verbatim - the PAT lands in the transcript permanently and forces a rotation. CORRECTED 2026-08-13 against git 2.55.0, which the audit's own example does not survive: the cited `https://x-access-token:TOKEN@host/...` form is anonymized by git itself before the error is emitted (`unable to access 'https://example.invalid/o/r.git/'`), while `git://` and path-shaped remotes leak it in full (`fatal: unable to look up x-access-token:...@host.invalid`). The defect is real on the transports that do not anonymize; a test built on the https form passes against unpatched code. Six env vars commented "hermetic test injection only" are honored in production with nothing gating them, including `CADENCE_ROUTE_TABLE` (sets every review trigger's gate) and `CADENCE_GLOBAL_CONFIG` (supplies a whole config layer) - which contradicts `review-provider.mjs:445-460`, the repo's own best-reasoned refusal of an env override on exactly these grounds, and which was the lever used to demonstrate CFG-01. CI installs `typescript` and `@types/node` unpinned with lifecycle scripts enabled; blast radius is genuinely small (`contents: read`, no secrets, not `pull_request_target`), so this arm is hygiene, not a finding. Tracked as #118) | 2 | Complete | v3.2.0 |
| VAL-01 (Unvalidated input cannot reach a destructive or authoritative path. Three sites take `Number(opts.x)` where `parseArgs` gives a valueless flag the boolean `true` and `Number(true) === 1`: `planning.mjs:483` (`phase-done`), `:673` (`uat record`), `:2471` (`renumber`). `lib/require-int.mjs`'s own header names this hazard and `require-int.test.mjs:23` tests it; these three skip it. All reproduced: the wrong phase boxed complete, a UAT item marked pass nobody walked, `renumber remove` targeting phase 1. Trigger is ordinary - `--n "$PHASE"` with `$PHASE` unset. Separately `planning.mjs:118` `read()` collapses ENOENT with EACCES/EISDIR/EIO so `criteria-coverage` (`:1247`) treats an UNREADABLE CONTEXT.md as the "absent is nothing to prove" exemption D-10 wrote for ABSENT: two uncovered breaks become `{"ok":true,"phases":[]}` under `chmod 000`. And `milestone-prune --label` is only trimmed (`:2812`) before `join(dir, '_archive-' + label)` (`:2847`) and mkdir/rename (`:2854-2855`), so a label from PROJECT.md escapes the tree. Tracked as #117) | 2 | Complete | v3.2.0 |
| RVW-01 (The review arm records what adjudication KILLS, and the cross-model reviewers are held to the same bar as the local one. Today `references/review-triggers.md:238` records only `<n> survivors`, so `lib/trace-suggest.mjs:118` cannot distinguish 0-of-0 (the gate is unnecessary) from 0-of-9 (the reviewer is miscalibrated and the gate is doing real work) and proposes turning the gate off in both cases - this lands FIRST because every other item here becomes measurable rather than asserted once it does. `review-provider.mjs:830` passes a one-line model-authored `instruction` as the external reviewer's ENTIRE system prompt, so it never sees `<stance>`, `<what_to_look_for>`, the severity definitions, "approach differences are NOT findings", or that an empty `findings: []` is valid, and at `review.mode: panel|single` with a `blocking` gate that uncalibrated output can FAIL a gate (~+600 tokens against a 120k cap). The contract demands the reviewer find "a requirement with no task" and "a contradicted locked decision" while the `plan` payload is the PLAN path ALONE, where the sibling gate hands cad-plan-checker ROADMAP, REQUIREMENTS and CONTEXT for the same questions. And cad-reviewer is the ONLY role contract with no `<process>` section, its guardrail "One pass... there is no second look" actively discouraging the self-refutation whose success-criteria assertion was cut in `49ba72e` for ~200 B - `design-notes/sweep-2026-08-10-context-weight.md:46` framed that cut as "easiest to reverse if compliance drops", and this is that condition. Tracked as #120) | 3 | Complete | v3.2.0 |
| CST-01 (No review fires that nothing consumes. At `shipped` three of five triggers are `advisory` - `plan`, `phase_diff`, `pre_ship` - and an advisory gate blocks nothing by definition: it writes a findings file and execution continues regardless. Measured on a reporting user's 3.1.0 run, `cad-reviewer` was 711,636 of 3,450,628 processed tokens (~20.6%) while the trace recorded it as 0, because `references/review-triggers.md` step 4 inverts the bracket writer for an advisory gate and the reviewer closes its own bracket with no `--tokens`. Evidence the output is not consumed, from this repo: `.planning/phases/1/REVIEW-plan.md` and `.planning/phases/2/REVIEW-plan.md` were both written 2026-08-13, are both untracked, and are referenced by no SUMMARY or CONTEXT; the trace records the phase-2 fire as `plan: 6 raised, unadjudicated (advisory gate)`. Six findings, one full `cad-reviewer` dispatch, zero effect on what shipped. `plan` and `phase_diff` default `off` at `shipped` (the `adjudicated` arm at `critical` is untouched, and a user who does read the files may turn them back on); `pre_ship` is deleted outright with its config key, its wiring-table row, `skills/cad-land/SKILL.md` step 3 and its deferred-reads register row, per the standing CAPTURE item that already recommends it and the `review.triggers.pre_ship.gate=off` already set in this repo.) | 3 | Complete | v3.2.0 |
| RVW-02 (Which reviewer actually ran is resolved by the seam and recorded, not asserted by prose. The gate half of a fire is structured - `route.mjs resolve --role cad-reviewer` returns `review{plan,diff,risk_surface,phase_diff,pre_ship}` - while the reviewer half is not: `readConfig` (`bin/route.mjs:96-113`) folds `stakes`, `escalate_on_failure`, `overrides`, `effort` and `triggerGates` and reads neither `review.reviewers` nor `review.providers.<name>.tiers`, so the resolved bundle carries no reviewer identity at all and `references/review-triggers.md:65` step 3 is the only thing that says to derive one. Observed 2026-08-13 during `/cad-verify 1`: `review.reviewers` was `["openai"]`, the resolve correctly returned `risk_surface: "blocking"`, and the fire was dispatched to the `cad-reviewer` Claude subagent with step 3 never executed - nothing refused it, and the user caught it. Nothing could catch it afterwards either: the claude-subagent bracket (`:98`) is keyed `--plan cad-reviewer --role cad-reviewer` whichever reviewer was configured, the cross-model arm writes NO bracket by design (`:166`), and the one place the running set is named - step 5's `voices <the reviewers that actually ran>` detail (`:238`) - is free text written by the same model that chose the substitution, which `lib/trace-suggest.mjs:58 parseAdjudication` then discards entirely, capturing only the trigger and the survivor count. Same defect class as CFG-01/CFG-02 one layer up - the config states one thing, the enforcement is prose, so inspection and enforcement can diverge - and it lands on the one trigger that is `blocking` at every stakes level. The fix belongs in the seam: resolve availability there (a provider is available iff its `tiers[<trigger.tier>]` is non-null, `claude-subagent` always available, an empty set falling back to `["claude-subagent"]`), return it per trigger beside `review` with the fallback and its cause stated rather than inferred, and carry the reviewer identity on the lifecycle event so a cross-model review that never happened stops being indistinguishable from one that did. Tracked as #123) | 3 | Complete | v3.2.0 |
| CST-02 (`risk_surface` fires on the surfaces a project actually has, chosen once by the user rather than assumed. It is the only trigger that scales per plan - blocking at every stakes level, once per plan on a detection match, and a FAIL re-arms for a second full dispatch - so on a security-shaped phase where nearly every plan matches it is the dominant review cost. It must not simply be turned down: it is what makes a blocking review mean anything, and phase 2 shipped five plans of unreviewed security work by suppressing it. Add `review.triggers.risk_surface.surfaces`, the subset of the eight categories at `references/review-triggers.md:285` this project contains, absent meaning all eight so no existing user's coverage silently shrinks. Populate it from a STRUCTURAL scan - dependency manifests, directory existence, file types - never from keyword greps of source text: that approach was tested against this repo on 2026-08-13 and false-positived `auth` (matching `session` x16, meaning Claude sessions) and `money/billing` (matching prose about token cost), failing toward expensive. Present the result as a one-time choice the user cannot skip, at the first `risk_surface` fire on a project that has not answered it, through the ask-user seam: four presets (the seam caps options at four), each stating its cost, with detection run BEFORE the question so it marks the recommendation per seams.md's existing recommended-option convention.) | 3 | Complete | v3.2.0 |
| CST-03 (The bound that already exists is tuned and described, and no surface reports an unmeasured figure as spend. Every agent file carries `maxTurns: 400` while phase 2's five executors used 36-76 tool calls, so the bound sits 5-11x above anything observed and has never bound anything - and `references/seams.md:56` tells readers "this seam offers no bound and no cancel", which is false against Cadence's own agent frontmatter and is why nobody tuned it. Lower it above observed usage and correct that sentence. PAIRED, landing together or not at all: a standing CAPTURE item records that a truncated `cad-reviewer`, `cad-verifier`, `cad-plan-checker` or `cad-planner` returns prose where a contract-shaped payload was expected with nothing marking it - only the executor family has a consumer-side arm for that signature - so lowering the cap without that arm trades overspend for silent garbage. Separately, `workflows/report.md`'s `compose` step prints the recorded token figure under the heading `Spend:`; `lib/trace.mjs:41` states that figure is "read off the HOST's subagent return", and a reporting user's 3.1.0 run put it 23x below actual transcript telemetry (117,646 recorded against 2,738,992 for `cad-executor`), so `/cad-report` tells a user a number is their cost when it is 3-4% of it. Label what the figure is and name what it excludes; this half adds no new capture.) | 4 | Complete | v3.2.0 |
| HYG-01 (The audit's low-severity residue is closed rather than carried. The test suite is excluded from typechecking (`tsconfig.ci.json:15` drops ~13,000 lines including the 5,051-line `planning.test.mjs`) while every non-test file is checked, and a test that only reads the properties that still exist keeps passing after the shape changes underneath it - a class `self-verify` structurally cannot see. `@ts-check` pragmas are decorative under `checkJs: true` (48 of 49 non-test files carry one; `review-provider.mjs` lacks it and is checked anyway) though the tsconfig comment calls them load-bearing. `lib/config-merge.mjs:33 readJSON` has zero callers. `lib/milestone-prune.mjs:60`'s `/^## /` clause is unreachable because `/^###? /` already matches it. `lib/planning-files.mjs:1164` uses `in` where `lib/trace.mjs:463` uses `hasOwnProperty` for the identical job and says why. `self-verify.mjs:1269` reads `--root` with an inline `indexOf`, so `--root ""` lints the cwd and returns `ok:true`, where `weight.mjs:46-53` has a `flagValue()` written specifically to close that class. `planning.mjs:1575` reports `within: true` beside `requirements_found: false` when ROADMAP.md is absent. And `design-brief.test.mjs`'s five tests import no Cadence module at all, asserting only over an immutable fixture, so they cannot fail on a regression - a green test that cannot go red reports coverage that does not exist. Tracked as #122) | 4 | Complete | v3.2.0 |

## Deferred

- **LND-01**: `/cad-land` surfaces the tracker before work lands. Nothing in the spine ever looks at issues, and landing work without checking whether it addressed one is the most frequent process miss in real use. It belongs in step 1, which ALREADY detects the remote host from the origin URL and resolves a `tea` login to pick the PR mechanism (`skills/cad-land/SKILL.md:31-38`), so the host and CLI are already in hand and `gh`/`glab`/`tea` are already first-class here. Two facts: open issues on the detected host, and any issue number a commit on this branch references (`git log <base>..HEAD` for `#N`, `closes #N`, `fixes #N`). The second earns its place - "your branch references #42 and #47; #42 is still open" is a specific discrepancy, where a bare list is easy to skim past. Read-only and default on, so it does not violate the skill's "never decides how you publish" objective; closing an issue stays an explicit ask and is never implied by landing. Degrades in ONE line on no remote, unrecognized host, missing CLI, no login or a nonzero exit, never blocking the land and never fabricating a list, and bounded so a hanging forge CLI cannot stall a land. NAMING TRAP: `git.auto_close` already means "merge the integration branch unattended" across `cad-land` step 4b, `land-cleanup.mjs` and `close-decision.mjs`, so the new key must not share that vocabulary - `git.issue_check` is the suggestion. Registration in `skills/cad-help`, `README.md`, `.planning/DOCS-CLAIMS.md` and the config catalog is part of the requirement. Tracked as #121 DEFERRED 2026-08-14: cut from phase 4 before execution - the one remaining item in the v3.2.0 cycle that ADDED a mechanism, and its GitLab arm is untestable here (`glab` absent). Issue #121 stays open. DEFERRED 2026-08-14: cut from phase 4 before execution - the one remaining item in the v3.2.0 cycle that ADDED a mechanism, and its GitLab arm is untestable here (`glab` absent). Issue #121 stays open.
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
| CAP-01 | Phase 1 | Complete |
| TRC-01 | Phase 2 | Complete |
| COR-01 | Phase 3 | Complete |
| ENF-01 | Phase 4 | Complete |
| DOC-02 | Phase 5 | Pending |

Empty between milestones. `v2.3.0`'s eleven rows moved to `## Shipped` at its
close, so the next cycle's audit starts clean. Rows come back one at a time
from `/cad-plan`'s `seed-reqs` call as each phase is planned - never
hand-populated.

---
*Last updated: 2026-08-10 v2.6.2 closed with all five requirements delivered and verified (5/5 traced, 21/21 acceptance criteria covered); CTW-01..05 move to `## Shipped` as rows and `## Traceability` starts clean. No next cycle scoped yet*
