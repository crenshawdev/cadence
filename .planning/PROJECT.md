# Cadence

## What This Is

Cadence is a Claude Code plugin for phased planning and execution: roadmap →
context → plan → execute → verify, with file-based continuity in `.planning/`,
deterministic seam scripts guarding invariants, and an adversarial review
subsystem. `v3.7.2` is the current release: the reference routers
load their cold branches late and the host writes the trace bracket. Before it,
`v3.7.1` closed the queue nothing
drained, closed at its cause - a gate that declines a finding files it on the
repository's own issue tracker in the step that decided, CAPTURE.md holds the
phase in flight and nothing else, and phase close asserts it empty. Riding with
it: a census registry with a plan-time lease check, `planning.mjs` split into 30
per-command modules, and one spelling per phase directory. `v3.7.0` before it
was Cadence stating its failures in its own vocabulary and never stating the
remedy, so a hintless refusal became a build failure. `v3.6.1` before that was
the three gaps `v3.6.0` named about its own `/cad-why` work, closed - the chain
states the reachability it does not have, the entry cap carries a byte claim
measurement supports, and closes order by parsed instants. `v3.6.0` before it was everything Cadence wrote down being
written by a gate and read by nobody: `/cad-why` walks the record join,
`cite-count` measures whether recall was read, and the fast path leaves a
record behind it. `v3.5.9` before it was the release seam and the frontmatter
reader returning clean answers over cases they did not handle; `v3.5.8` four
operations that wrote several files and reported the result as if they had
written one. `v3.5.7` was measurement with no lever to spend it: `stakes` became a floor a phase raises from, a fifth gate mode moved
the blocking refusal to the land, and read redundancy reached `trace suggest`.
`v3.5.6` was the machinery that records what a run did - rotating executor
reports, a refused re-run, and an adjudication record carrying each finding's
verbatim claim, its ruling and a head SHA. `v3.5.5` before it was readers
that accept input they have a rule against, closed by replacing nine hand-rolled
argument parsers with one declarative table. `v3.5.4` was three checks that
reported a verdict they had not earned; `v3.5.3` bounds not stated and costs not
counted; `v3.5.2` one reader, one transport; `v3.5.1` authorization the repo
grants rather than the user. Earlier cycles:
`v2.6.1` the four defects the `v2.6.0` doc sweep filed closed at their source,
`v2.6.0` the reconciliation cycle that triaged the capture queue from 213 open
items to 28 and swept 547 doc claims with a committed ledger, `v2.5.0` static analysis
reaching execution and plan gates that ask whether a plan is proportionate,
`v2.4.0` the parallel path that could never engage, `v2.3.0` where the bytes
live, `v2.2.0` the config read face and the deleted git-guard parser, `v2.1.0`
coverage and triage gates, `v2.0.0` the
stakes routing axis, `v1.5.0` self-description corrections, `v1.4.x` stated
grammars, `v1.3.x` flow and tech-debt passes, `v1.2.x` cross-model review
repairs, `v1.1.0` file-based memory and BM25 recall, on the `v1.0.0` planning
baseline.

## Core Value

What Cadence writes down during a project (deviations, decisions, captures,
UAT findings) must come back on its own at the moment it matters — planning,
context-gathering, and debugging — without any external memory system.

## Requirements

### Validated

- ✓ Phased planning spine (new-project / context / plan / execute / verify) — v1.0.0
- ✓ Deterministic seam scripts with tests: config, planning, route, review-provider, git-guard, self-verify (132 tests) — v1.0.0
- ✓ Write-side memory: STATE cursor, per-phase SUMMARY with deviations, CAPTURE.md (todo/seed/note), UAT.md — v1.0.0
- ✓ Self-verify drift linter in CI: config-key tokens ↔ schema, script invocations ↔ CONTRACTS table, plugin-root paths exist; README included as a linted surface — v1.0.0
- ✓ Cross-model review subsystem (plan / diff / phase_diff / pre_ship triggers, consult, detect-models) — v1.0.0
- ✓ `memory.backend` config key reserved, only `none` wired — v1.0.0
- ✓ BM25 recall over `.planning/` artifacts as a zero-dep `planning.mjs` subcommand — v1.1.0-rc.1
- ✓ `memory.backend` gains `builtin` and becomes the default; `none` turns recall off — v1.1.0-rc.1
- ✓ cad-context, cad-planner, and cad-debug inject recall results at the moment they start reasoning — v1.1.0-rc.1
- ✓ Deterministic context-weight measurement of agent/skill prose surfaces via a seam subcommand — v1.1.0-rc.1
- ✓ self-verify budget check on context weight (blocking) — v1.1.0-rc.1
- ✓ self-verify lint: agent prose references only tools declared in that agent's frontmatter (blocking) — v1.1.0-rc.1
- ✓ Two-tier git branching: per-milestone integration branch (parallel-worktree reconciliation point) + `trunk` escape hatch — v1.1.0-rc.2
- ✓ Land cleanup (`git.on_land_cleanup`) + opt-in autonomous close (`git.auto_close`), never-auto-push rail intact via the git-publish seam — v1.1.0-rc.2
- ✓ Release mechanics: manifest version bump + changelog folded into the milestone close, idempotent — v1.1.0-rc.2
- ✓ Release prep: public docs reconciled, DESIGN records the reversals, plugin-store metadata, `validate --strict` clean — v1.1.0-rc.2
- ✓ `auto_close` full close verified live end-to-end against a real remote (audit → tag → PR → merge → reset), closing the deferred Phase-2 item-6 — v1.1.0
- ✓ Final `v1.1.0` published: manifest at `1.1.0`, dated CHANGELOG entry, `v1.1.0` tag cut, community plugin-store submissions filed — v1.1.0
- ✓ Repaired the cross-model review seam: realpath run-as-script guard so `review-provider.mjs` no longer no-ops on a symlinked install, symlink regression test, empty-provider surfacing (REV-01) — v1.2.0
- ✓ `cad-planner` separation-of-concerns nudge: prefer small single-purpose tasks over a shared core, no per-phase restatement (SOC-01) — v1.2.0
- ✓ `cad-context` durable-decision filter: three-part test, `## Durable decisions` heading, recall retargeting with legacy fallback (DEC-01) — v1.2.0
- ✓ `/cad-decision-review`: on-demand refute-then-adjudicate over one decision, Context7 + codebase grounding, per-objection ruling + amendments (DEC-02) — v1.2.0
- ✓ DeepSeek cross-model review provider: Chat Completions adapter (json_object + in-prompt schema), selectable via `review.reviewers` (REV-02) — v1.2.0
- ✓ Every open bug from the post-v1.2.0 sweep triaged and fixed, no won't-fix: silent data-file failures surfaced (#39, #40, #43, #44), seam flag inputs validated before any write (#42, #45), planning parsers de-phantomed and widened (#41, #46, #47, #48), renumber and git-guard hardened (#37, #49, #50) — v1.3.1
- ✓ Plan-file frontmatter reads to exactly what is declared, byte-exact to `plan-overlap`, and every out-of-grammar input carries a named diagnostic instead of changing what was read (GRM-01) — v1.4.0
- ✓ `/cad-plan` seeds its own REQUIREMENTS traceability rows via `seed-reqs`; a worktree executor asserts its own plan file before task 1 (SPN-01) — v1.4.0
- ✓ One quote-state tokenizer drives both git-guard rails, closing the six verified rail-3 push holes plus the `eval` wrapper family (TOK-01) — v1.4.0, SUPERSEDED by TOK-02 in v2.2.0 on both halves: the tokenizer and the command-position deny gate are deleted, and the six shapes it closed are silent again as the stated cost of an anchored reader
- ✓ The roadmap phase list has a stated grammar, so an empty `## Phases` is a derived closed-milestone state and `/cad-progress` works between milestones (RDM-01) — v1.4.0
- ✓ `/cad-audit` counts an `## Active` requirement no phase picked up, so the traceability gate holds in the partially-planned state (AUD-01) — v1.4.0
- ✓ Two contracts that contradicted themselves closed by subtraction: the executor's terminal success-criteria check (#65) and `conventions.md`'s claim to reach every skill (#67) — v1.4.1
- ✓ The worktree fork point stated as `worktree.baseRef`-selectable across six surfaces, with `/cad-execute` refusing the parallel path under `fresh` (#68) — v1.5.0
- ✓ Per-trigger `effort` scoped to the backend that can honour it, rather than resolved and silently dropped on the `claude-subagent` arm (#64) — v1.5.0
- ✓ Each agent's contract stored once as a preloaded contract skill, with self-verify asserting every one resolves and is model-invocable (#74) — v1.5.0
- ✓ Effort became a dial the routing layer varies per role: each contract skill materialized at the rungs it needs, the runtime-read shim and `escalate_effort_variant` retired, a rung file carrying behaviour failing self-verify (RNG-01) — v2.0.0
- ✓ The routing axis asks what happens if the work is wrong, not what it costs: `model.profile` REPLACED by `stakes` (solo/shipped/critical), `auto` retired, no back-compat alias, refused at the write face (STK-01) — v2.0.0
- ✓ A routing cell resolves the whole quality bundle `{model, effort, review, verify}` from one readable table, with every cell's model, effort and trigger asserted by self-verify (STK-02) — v2.0.0
- ✓ The risk surface Cadence already detects sets a rung FLOOR by itself; raising is free, lowering below it is refused without an override naming the surface (STK-03) — v2.0.0
- ✓ CONTEXT acceptance criteria carry stable ids and `/cad-audit` proves coverage in both directions, so a criterion that never reached the UAT checklist fails the gate by id (ACR-01) — v2.0.0
- ✓ The remaining resolved-then-dropped config keys closed at the point of setting, with a re-runnable written-down sweep reporting zero left (CFG-01) — v2.0.0
- ✓ The plugin's documented home moved to the self-hosted Forgejo remote, GitHub retired as the published source, and the README test badge removed rather than repointed (HST-01) — v2.0.0
- ✓ A coverage gate stops being able to pass a phase it never checked: a fieldless checklist is reported rather than exempted, the seam states its plugin version, and the verifier's findings envelope is persisted beside the phase's artifacts (COV-01) — v2.1.0
- ✓ An adjudicated review's survivors are a numbered list the user triages, defaulting to NONE, at every firing site, and the reviewer contract stops pre-filtering ahead of the adjudicator (TRI-02) — v2.1.0
- ✓ A trigger's reviewers dispatch concurrently in one message, and `review.max_prompt_tokens` bounds the paid call before it is sent (REV-03) — v2.1.0
- ✓ The config read face merges a layer once whatever its spelling; six of the seven deferred config-reach/risk-waiver defects closed, the seventh named open (CFG-02) — v2.2.0
- ✓ The guard's parser deleted, both rails on one ~30-line anchored reader; `git.on_destructive` removed with it, accepted-cost shapes stated in the CHANGELOG (TOK-02) — v2.2.0
- ✓ The release seam refuses downgrades, promotes Unreleased into the dated heading, and requires `--version` instead of deriving from prose (REL-03) — v2.2.0
- ✓ Every shipped rung-ladder claim true or corrected; `route.mjs` `warnings[]` rides every result shape including `ok:false` (DOC-01) — v2.2.0
- ✓ Per-role effort configurable from the config layer and update-surviving; a rung the role lacks fails self-verify by key (RNG-02) — v2.2.0
- ✓ The documented install path proven live against the Forgejo remote from a fully cold state, transcripts committed in the phase record (HST-02) — v2.2.0
- ✓ Executor reports leave the orchestrator context: `cad-executor` writes `reports/plan-<k>.md` and returns a five-field digest, and the partial/timeout continuations read the FILE so a re-run cannot repeat a finished task (RES-01) — v2.3.0
- ✓ Verifier findings leave the orchestrator context, with a narrow `Write` grant (one file under `.planning/phases/<N>/`, `Edit`/`MultiEdit` still denied on all four rungs) and `uat merge` piped straight from it (RES-02) — v2.3.0
- ✓ Reviewers receive a reference, never artifact bytes: refs valid in their own tree, or `--payload <file>` with `assertUnderCap` measuring the file's contents and refusing a non-string payload first (RES-03) — v2.3.0
- ✓ `references/seams.md` states when a file round-trip is worth its extra turn, extended to cover any deferred read rather than a subagent round-trip alone (RES-04) — v2.3.0
- ✓ `references/git.md` split into `git-guard.md` (rails 1, 2, 4) and `git-publish.md` (rail 3), every citation moved with it including the ones citing rails by number (LOD-01) — v2.3.0
- ✓ The triage gate lives in its own 3.0 KB reference and its adjudicated arm is a tapped multi-select — `ceil(N/3)` questions batched four per call, NONE first and default — replacing the open-ended-prose mandate (LOD-02) — v2.3.0
- ✓ `conventions.md` stops being half-referenced: all 17 bare parentheticals in workflows inlined at their use sites, leaving it `@`-included nowhere in the plugin (LOD-03) — v2.3.0
- ✓ `/cad-config`'s catalog decided on a measured menu-vs-non-menu run count and recorded as deliberately transcribed rather than derived (LOD-04) — v2.3.0
- ✓ Every eager `@`-include judged per skill against the break-even test, with all 26 keep-or-move calls stated with their reasons (LOD-05) — v2.3.0
- ✓ The 29 skill and 19 rung-agent descriptions riding every session's system prompt cut to one routing line each — 8,550 B to 5,397 — with zero trigger words dropped and nine gained (BUD-01) — v2.3.0
- ✓ `references/**` and `templates/**` under the weight budget as 23 exact-byte entries, and both walkers fixed so one unreadable descendant hides only its own children (BUD-02) — v2.3.0

- ✓ A static-analysis path reaches execution and works unconfigured — `workflow.lint_command` across five surfaces, `detect-commands` reading the project's own manifests when it is unset, plus the `LSP` grant on both executor rungs (QW-01) — v2.5.0
- ✓ One joined `.planning/trace.jsonl` per phase carrying routing, provider, lifecycle and outcome events under a single correlation id, provably unable to change a seam envelope; every `mergeLayers` callsite surfaces its warnings or says why (QW-02) — v2.5.0
- ✓ File leases enforced at the commit step by `lease-check` rather than compared once pre-flight; `phase_diff` resolves the same through all three surfaces; lockfiles stop matching the `concurrency` risk surface (QW-03) — v2.5.0
- ✓ A version the repo already published is never presented as current — `/cad-health` names both numbers and `git-branch.mjs decide` refuses by tag membership rather than sort order (QW-04) — v2.5.0
- ✓ Every `review-provider.mjs` failure path fault-injected with a test proving what the caller sees, and drop-outs recorded before the wire rather than only past it (QW-05) — v2.5.0
- ✓ `weight.mjs resident` composes eager, reachable and dispatch bytes; `cad-land` and `cad-plan-review` stop eagerly preloading references they read at one step, with a self-verify check that a de-preloaded reference keeps a Read at the arm that needs it (CTX-01) — v2.5.0

- ✓ `v2.6.0 — the reconciliation cycle`: the capture queue triaged from 213 open items to 28 with the rest archived out of the recall corpus (REC-01, REC-02); the verify walk, the unbounded re-arm and version drift (FRI-01..03); named phase dirs, an ignored run record, `REQ_ID_EXACT` and the debt-marker harvest (FLD-01, FLD-02, PRS-02, DBT-01); per-role token accounting with every phase dispatch bracketed (TOK-03, TOK-04); and the first end-to-end doc sweep, 547 claims with a committed ledger (DOC-02, DOC-03, EVD-02) — v2.6.0
- ✓ `v3.2.0 - the controls that reported success`: a hostile repo config layer stopped reparenting the merged config and inspection stopped disagreeing with enforcement (CFG-01, CFG-02); the symlinked temp write, the gate that could not read its findings, the valueless flag and the credential-carrying failure detail all fail safe now (FSW-01, GAT-01, VAL-01, EXP-01); adjudication records kills as well as survivors and the reviewer set is resolved in the seam rather than by prose (RVW-01, RVW-02); three triggers that blocked nothing turned off or deleted, and `risk_surface` scoped to the surfaces a project has (CST-01, CST-02); the dispatch bound tuned 400 to 200 with the audit's low-severity tail deleted rather than carried (CST-03, HYG-01) - v3.2.0

- ✓ `v3.5.1 - authorization the repo grants, not the user`: `git.auto_close` resolved as two booleans so a user-global `true` stops speaking for a repository that never opted in, with the GitLab arm gated ahead of its reuse probe (AUT-01, AUT-02); `milestone-prune` reading a whole wrapped bullet span through a fence-aware bound with its pipes escaped, proved on this repo's own close (PRN-01); and the tracker report binding by `tea --remote origin` behind a guard that declines to ask when no login names the remote's host, after the login-matching surface FAILed its blocking gate twice and was deleted (TRK-01) - v3.5.1

- ✓ `v3.5.2 - one reader, one transport`: caller-derived free text rides a file path at every seam flag that carries it, with the rule stated once in `conventions.md` and a 36-row register that a new `self-verify` check reads, so a seventeenth inline site is refused rather than noticed later (TRN-01); and `plan-overlap` and `lease-check` reach containment through one `lib/lease-grammar.mjs` predicate, so the pre-flight gate can no longer admit a plan pair the commit-time enforcement would refuse, with `./` and redundant separators refused at both declaration doors and a census test that reddens on a paste-back (LSE-01) - v3.5.2

- ✓ `v3.5.3 - bounds not stated, costs not counted`: the provider response gained a 4 MiB ceiling Cadence owns with its own `over-response` reason and a sanitized 1024-byte failure excerpt, local finding validation was pinned to the canonical schema by an 18-fixture agreement table, and the recovery arm stopped naming a timeout the dispatch path cannot produce (RVP-01, RVP-02, WIR-01); the run record learned turns per dispatch and per role and the three surfaces pricing a run now name what that figure excludes (MSR-01, MSR-02); six per-role window ceilings derived from this repo's own p75, a bulk-output file transport with a 17-row register, and `workflow.max_plan_tasks` re-decided against both its forces and left at 8 (MSR-03, TRN-02, PLN-01); the coordinator residue re-keyed on `corr` so one run's marker stops closing at another run's event, and every retune suggestion gained a direction, a current value and a read target with an offer to route it (MSR-04, SGT-01); plus three controls that existed and never reached their path - the recall corpus surviving a close, a receipt naming the range it settles, and the parallel branch reaching the sequential risk sequence (RCL-07, GAT-04, PAR-01) - v3.5.3

- ✓ `v3.5.4 - the gate that clears itself wrong`: `redactUrl` gained end-of-input
  userinfo alternatives so a credential the 4096-byte `bodyExcerpt` window cut
  before its `@` is redacted rather than shipped to a review provider, and
  `cad-phase remove` refuses a git state it could not read instead of classifying
  it clean and deleting `phases/<N>/` recursively (EXP-02, PHS-01); `/cad-audit`
  stopped FAILing a healthy repository on three counts - a wrapped continuation
  line out-declaring the milestone, `version_drift` firing on the rolled-forward
  phase the workflow declares exempt, and tag discovery walking upward out of the
  caller's own project root (DRF-01, DRF-02, TAG-01); and three flags were made
  to mean what they say - the stakes level moves both halves of a cross-model
  review panel through level-keyed `tiers` and a new `efforts` grid returned on
  the resolve line, `git.create_tag` governs the land-time tag cut alone with the
  milestone close deciding release mode from evidence, and issue-check's
  per-issue resolve loop runs under one wall-clock budget rather than a per-call
  timeout its own exit condition could not detect (RVW-03, REL-01, ISS-01) - v3.5.4

- ✓ `v3.5.7 - measured, and no lever to change it`: `stakes` became the floor a
  phase raises from rather than the level every phase pays, resolved off the
  phase's own declared `files:` at plan time and replayable over this repo's 30
  phases (CER-01); a fifth gate mode `deferred` queues its findings as a
  committed `DEFERRED-*.json` and moves the refusal to `/cad-land`, so blocking
  stops blocking the run (HLT-01); the risk-surface interview got a deliberate
  entry point and stopped offering the same set twice (IVW-01); and the
  in-dispatch read redundancy reached `trace suggest` as a per-file entry naming
  the worst offender in one dispatch, with no config key behind it because none
  exists (RDX-01) - v3.5.7

- ✓ `v3.5.8 - the transition that claims to be one`: one primitive owns the
  ordered multi-file write - a lazy pre-flight, two disciplines, and a census row
  that reddens if its body is copied under any name - with `renumber` and
  `milestone-prune` routing their existing partial-state refusals through it and
  neither envelope moving (JRN-01); `cmdPhaseDone` validates every edit before
  the first write and names which documents landed, its "all-or-nothing" comment
  gone rather than qualified (JRN-02); and `release-bump` reads and decides its
  whole write set before the first `atomicWrite`, so a malformed sibling leaves
  the primary manifest at the old version under `ok:false` instead of shipping a
  half-bumped tree as success (JRN-03) - v3.5.8

- ✓ `v3.5.9 - the defects that were filed and never read`: the release seam and
  the frontmatter reader both stopped returning a clean answer over a case they
  did not handle. The changelog core decides section bounds, emptiness and the
  trailing link-reference block from the document's real structure rather than
  from a heuristic a fenced `## ` defeats (REL-01); a version-less primary
  manifest and an absent CHANGELOG halt the close instead of passing as a benign
  `skip`, with `changelog.state` named on every emitting envelope (REL-02); an
  unparseable `--version` refuses by naming the raw argument rather than
  reporting `no-target-version` over an empty target (REL-03); the four
  value-level grammar codes are scoped to the two list keys the seams read, so a
  backtick in `goal:` stops bailing the risk floor on a plan's whole declared
  file list, while the five structural codes still cross keys on purpose
  (FRM-01); and a markdown-decorated `files:` path reports
  `markdown-decorated-path` instead of parsing clean, so two plans that collide
  on one file route sequential rather than into separate worktrees (FRM-02) -
  v3.5.9

- ✓ `v3.6.0 - reading the corpus back`: what the gates write is now read back.
  `/cad-why <path>[:<line>]` joins a path's commits to six record edges - phase,
  plan task, decision, deviation, surviving review finding and declaring task -
  over four tiers, the live `phases/<N>/`, `_archive-v<ver>/`, task records, and
  milestones recovered out of git history, naming the gap in words where no tier
  answers (WHY-01); `planning.mjs cite-count` counts what recall surfaced against
  what the produced plan cites, at both of `/cad-plan`'s points and on the
  under-threshold inline arm, advisory by design, with backend-off, surfaced-
  nothing and cited-nothing distinct on the record rather than collapsed to one
  number (RBK-01); and `/cad-task` writes
  `.planning/tasks/<slug>/RECORD.md` through a `task-record` seam that derives
  every figure from the committed range, read by both the recall corpus and
  `/cad-why`, bracketed under a per-run phase-0 correlation anchor so the fast
  path appears in per-role accounting at last (FST-01, FST-02, FST-03) - v3.6.0

### Active

**No cycle open.** `/cad-phase add` opens the next one.

**`v3.7.11 - unresolved inputs`, opened 2026-09-02, closed 2026-09-03.** Three
phases, 43 commits off `main` (9 feat and 10 fix against 21 docs, 2 chore and
1 test). Four requirement ids - `RNG-05`, `RSK-10`, `RSK-11`, `TRK-02` - each
traced to a verified phase; `/cad-audit` passed 4/4 with 13/13 acceptance
criteria covered and nothing deferred. Manifest bumped to 3.7.11. The ids came
off the sentence v3.7.10's overview used to defer `GH-229`, plus `GH-246` and
`GH-244`. One claim held all three phases: a gate ran, the input it ran on could
not be resolved, and the code treated "could not resolve" as an ordinary value.
An empty diff from a ref that does not exist, a record that could not be
written, a tracker search that never ran - each read as the benign second
meaning. Phase 1 made `risk-check` resolve each end of a range on its own and
name the end that failed, gave the staged scope one spelling bound to the
index's own tree id, and replaced the self-comparing range at three spine
callers with a `risk_check_skipped` event. Phase 2 stated one completion rule
for a record that cannot land - an absent planning root reports done and calls
it unrecorded, every other reason withholds it - so a task on a repository with
no `.planning/` finishes honestly and creates nothing. Phase 3 put a
title-scoped lookup in front of `issue-filing.mjs file`'s first create, with an
ambiguous create written as an unconfirmed `FILED.md` row the retry honours, and
scoped a complete tracker miss to the forge whose query was actually measured
(`lookupMeasured`) - github and forgejo measured, the forgejo half against the
live mirror during UAT, gitlab still assuming. Their rows are now under
`## Shipped` in REQUIREMENTS.md, the narrative is the `[3.7.11]` section of
CHANGELOG.md, and the phase residue - deviations, UAT items, CONTEXT decisions -
is in `.planning/ARCHIVE.md` (49 rows). Outstanding: the merge to `main` and the
`v3.7.11` tag, both `/cad-land`'s. `/cad-phase add` opens the next cycle.

**`v3.7.10 - review receipts`, opened 2026-09-01, closed 2026-09-02.** Three
phases, 50 commits off `main` (11 feat and 8 fix against 27 docs, 3 chore and
1 test). Five requirement ids - `TRC-12`, `CST-04`, `RSK-09`, `AUT-03`,
`TRC-13` - each traced to a verified phase; `/cad-audit` passed 5/5 with 20/20
acceptance criteria covered and nothing deferred. Manifest bumped to 3.7.10.
The ids came off the receipts cluster the v3.7.9 overview named and left open -
`GH-228`, `GH-221`, `GH-227`, `GH-220` and `GH-226`. One claim held all three
phases: a review ran, and the run record must not say something untrue about
it. A fallback reviewer that was never closed, a provider review whose cost was
dropped on the floor, a settlement with no home the seam accepts, one
authorization writing two receipts, and a declared effort nothing verified.
Phase 3's gate held - OQ-2 was answered against the installed host before any
code (Claude Code 2.1.258 downgrades silently, the hook payload cannot see it,
the worker's transcript can), so the cycle ran to three phases rather than
closing at two. Their rows are now under `## Shipped` in REQUIREMENTS.md, the
narrative is the `[3.7.10]` section of CHANGELOG.md, and the phase residue -
deviations, UAT items, CONTEXT decisions - is in `.planning/ARCHIVE.md` (59
rows). Outstanding: the merge to `main` and the `v3.7.10` tag, both
`/cad-land`'s. `/cad-phase add` opens the next cycle.

**`v3.7.9 - progress not perfection`, opened 2026-08-31, closed 2026-09-01.**
One phase, 15 commits off `main` (2 feat and 3 fix against 6 docs, 1 refactor
and 3 chore). Three requirement ids - `PHS-03`, `RTE-01`, `DOC-05` - each
traced to the verified phase; `/cad-audit` passed 3/3 with 7/7 acceptance
criteria covered and nothing deferred. Manifest bumped to 3.7.9. The ids came
off the open tracker after the v3.7.8 close - `GH-233`, `GH-232` and `GH-218`,
the three sites where Cadence named a next step that was unreachable, stale, or
not the outstanding work. Their rows are now under `## Shipped` in
REQUIREMENTS.md, the narrative is the `[3.7.9]` section of CHANGELOG.md, and
the phase residue - deviations, UAT items, CONTEXT decisions - is in
`.planning/ARCHIVE.md`. Outstanding: the merge to `main` and the `v3.7.9` tag,
both `/cad-land`'s. `/cad-phase add` opens the next cycle.

**`v3.7.8 - what Cadence already knows`, opened 2026-08-29, closed 2026-08-30.**
Five phases, 86 commits off `main` (10 feat and 22 fix against 36 docs, 14 test,
2 refactor and 2 chore). Five requirement ids - `RSK-08`, `RNG-04`, `PHS-02`,
`LND-02`, `TRC-11` - each traced to a verified phase; `/cad-audit` passed 5/5
with 33/33 acceptance criteria covered and nothing deferred. Manifest bumped to
3.7.8. The ids came off the scan taken immediately after the v3.7.7 tag plus
three findings standing against the v3.7.7 adjudication work itself.

The thread was one shape: Cadence already held the answer on disk and the code
standing next to it declined to read it. The record validated a `fix_commit`
only inside the `survived` branch while `downgraded` and `refuted` walked
through; the scaffolded template wrote `stakes` before the resolver that exists
to tell unset from configured was ever asked; `/cad-task` recognised a
phase-sized task and handed the user to `/cad-context`, which refuses without a
phase; the autonomous close read raw review findings with the rulings sitting
unread beside them; and both append-only records lost events on a contended
second rotation. None of the five was a missing capability.

`GH-167`, the outbound review payload's missing secret fence, was carried as a
spike rather than a phase and is not closed by this cycle.

Its Traceability rows are under `## Shipped` in REQUIREMENTS.md, its narrative
is the 3.7.8 section of CHANGELOG.md, and its per-phase residue (101 rows) is in
`.planning/ARCHIVE.md`. Still outstanding: the merge to `main` and the release
tag, both `/cad-land`'s. Four `medium` findings from phase 4's own
`risk_surface` rounds are confirmed and deliberately unfixed, below the halt
line; every blocker and high across the cycle carries a fix commit. Twelve
issues were filed on the public tracker over 2026-08-29 and 2026-08-30, and the
CAPTURE queue stands at 16 walked items including the forge cluster seed
(GH-102 through 107).

**Previously:**

**`v3.7.7 - the record says what happened`, opened 2026-08-28, closed
2026-08-29.** Two phases, 36 commits off `main` (11 feat and 4 fix against 15
docs, 4 test and 2 chore). Two requirement ids, `TRC-10` and `RSK-07`, both
traced to a verified phase; `/cad-audit` passed 2/2 with 14/14 acceptance
criteria covered and nothing deferred. Manifest bumped to 3.7.7. Both ids came
off real runs rather than a read, both filed on the public tracker as S2:
`GH-145` and `GH-159`. The thread was that a record Cadence keeps could not
represent a state that actually occurs, and failed silently rather than
refusing.

Phase 1 gave `.planning/reads.jsonl` a rotation. It had an 8 MiB write-time
bound and no rotation at all, so at the bound the writer dropped every later
append permanently and answered `{written:false}` with nothing said; this
repository's own file was 93% full and the fill tracked age rather than project
size. It rotates into one prior generation now, under a `linkSync` claim with a
250ms in-flight wait and a dated stale-claim sidecar, and both reader envelopes
carry `reads: {file, rotated?}` so a shortened history says so. Phase 2 closed
the adjudication gap: a blocking gate's below-blocker/high remainder is
documented as reported-and-moved-past and the record refused to store it, so
the fire could not be settled without writing something false. The `fix_commit`
requirement is gated on the raised severity now, `survived` means "stood, fixed
or not", and the override case settles on an explicit `overridden: true` marker
rather than a commit it cannot produce.

Its Traceability rows are under `## Shipped` in REQUIREMENTS.md, its narrative
is the 3.7.7 section of CHANGELOG.md, and its per-phase residue (37 rows) is in
`.planning/ARCHIVE.md`. Still outstanding: the merge to `main` and the release
tag, both `/cad-land`'s. Two `medium` findings from phase 2's own `risk_surface`
round are confirmed and unfixed on the tracker (`ca1fbd834199dfcb`,
`dd09d6a6113e9112`), and the forge cluster seed (GH-102 through 107) is still
unclaimed in CAPTURE.md.

**Previously:**


**`v3.7.6 - the coordinator stays the coordinator`, opened 2026-08-28, closed
2026-08-28.** Two phases, 29 commits off `main` (2 feat and 2 fix against 18
docs and 5 test, which is what a cycle that edits contracts rather than code
looks like). Two requirement ids, `EXP-04` and `EXP-05`, both traced to a
verified phase; `/cad-audit` passed 2/2 with 14/14 acceptance criteria covered
and nothing deferred. Both ids came off one read of the first foreign project
Cadence executed end to end, on the standard v3.7.5 set: would a user on their
own project feel it.

Phase 1 made the blocking gate's fix pass a `cad-executor` continuation under
the failing plan's own worker key, at every FAIL site that mints one, and
banned the coordinator from any `Edit` or `Write` outside `.planning/`. The
record that prompted it showed the main session doing fifteen edits across
eight files in one two-minute window, all unreviewed by construction because
the one-round re-arm cap was already spent. Phase 2 gave the executor one
targeted run per task and one full-suite run per dispatch: bare full-suite
invocations went from 4, 6, 2, 1, 2, 6 per dispatch to 1, 0, 0, 0, and
test-running tool calls per dispatch from 6.9 to 2.6. The cost was always
turns, not seconds, against a suite that runs in 0.6 s.

Shipped rows are under `## Shipped` in `REQUIREMENTS.md`, the user-facing
narrative is `CHANGELOG.md` `## [3.7.6]`, and 32 residue rows from both phases
are in `.planning/ARCHIVE.md`. Manifest bumped to `3.7.6` at `dcfda4e1`. The
merge and the `v3.7.6` tag are `/cad-land`'s, cut on the pulled base after the
merge confirms.


**`v3.7.5 - the defects a user's own project feels`, opened 2026-08-26, closed
2026-08-27.** Five phases, 53 commits off `main` (8 feat against 7 fix, where
`v3.7.4` ran 16 against 6). Eight requirement ids, all traced to a verified
phase: `FRG-03`, `FRG-04`, `FRG-05`, `FRG-06`, `EXP-03`, `RSK-06`, `TRC-09`,
`RCL-08`. `/cad-audit` PASS on both arms, 8 of 8 requirements traced with 0
broken and 23 of 23 acceptance criteria covered with 0 breaks. UAT 38 passed, 0
failed. Manifest bumped to `3.7.5` at `308e19f8`.

**The cycle had no subject, it had a standard.** Every open issue was re-triaged
2026-08-26 against one question, would a user running Cadence on their own
project ever feel this, or does it only bite while Cadence is being developed on
Cadence. Seven of 22 answered the first way and became this cycle's eight ids.
That standard is the thing worth keeping: it is a filter that can be applied
again without re-arguing what the roadmap is about.

Where it went: the shipped rows are in `REQUIREMENTS.md` under `## Shipped`, the
user-facing narrative is `CHANGELOG.md` `## [3.7.5]`, and 75 residue rows from
the five pruned phases are in `.planning/ARCHIVE.md`. The merge and the release
tag are `/cad-land`'s, cut on the pulled base after the merge confirms.

**What shipped, in one line each.** `git.forge_host` takes `host[:port]`,
enforced at the config write face and carried whole into the `tea` login match
and into `forge.mjs create`, which now refuses a `--remote-url` whose port the
instance does not serve. `/cad-execute` reads each plan's report first line
before it spends anything and refuses to re-dispatch a phase whose work is
already committed. `risk-check run` withholds the four stored-reviewer-text
artifacts under `.planning/phases/` from the range it reads, so filing a finding
no longer re-trips the gate that produced it. A `trace.jsonl` rotation claim
dates itself and a claim older than 30 s is reclaimed by the next append, so a
SIGKILL mid-rotation costs one rotation instead of every rotation after it. And
`recall` folds suffixes through Porter steps 1a and 1b inside `tokenize`, the
one site both indexing and querying already pass through.

**What it did not settle.** Two of the three items GH-93 names did not ship. The
multi-query union changes the `recall` seam signature that
`cadence-core/references/recall.md` pins for three callers, `/cad-context` at
`spend_gate`, `/cad-debug` at Hypothesize and `/cad-plan` at `spawn_planner`, so
it is a contract change this cycle deliberately did not take. The failure
records sitting outside the corpus needs a scope decision that was not taken,
and three measured obstacles sit under its phrasing: `parseSummarySnippets`
returns 0 on every live `reports/plan-<k>.md`, `REVIEW-*.md` files are JSON
holding raw findings while the adjudicated rulings live in `ADJUDICATION-*.json`
beside them, and any new tier inside `phases/<N>/` needs `milestone-prune`'s
residue walk extended or it goes unreachable at the next milestone close, which
is the exact defect `RCL-07` closed.

The fold's own boundary is worth writing down here rather than rediscovering:
steps 1a and 1b only, so `verifies` reaches `verifi` while `verify` is
untouched, `released` reaches `releas`, and `indices` never reaches `index`.

**Outstanding, carried out of the close.** GH-137, a phase with commits but no
`SUMMARY.md` deriving as `planned`, was the target of phase 2 and the replay
stop closes the expensive half of it. GH-146 is unchanged: `.planning/reads.jsonl`
carries the original write-dead defect and shares none of phase 4's rotation
code. GH-148 and GH-145 were excluded on this cycle's own standard and are
recorded as such in `REQUIREMENTS.md`. The remainder of the Forge cluster and
the seven todos in `.planning/CAPTURE.md` are the material a next cycle would
triage; no theme is named, and `/cad-phase add` is what opens one.

### Previously

**`v3.7.4 - cut the cost the record can now measure`**, opened 2026-08-26 and
closed 2026-08-27. Four phases, 71 commits off `main`, five ids - `BUD-03`,
`RSK-05`, `RNG-03`, `TRC-07`, `TRC-08`. A plan's declared read set became a
measured number with a reported ceiling, the plan-time risk floor stopped
reading an import statement as evidence of a risk surface, the rung sentence
came out of all 19 agent bodies so a role's rung files share one byte-identical
prefix, and the record grew the prompt-cache figures that would price it. The
prefix win is UNMEASURED rather than refuted: the after side is two
`cad-verifier` dispatches at the same rung against a 33-dispatch before side,
which bears on cross-rung sharing neither way, and settling it needs two rung
files of one role to actually run. `TRC-07` records the figures automatically
now, so the comparison costs nothing to take later. The cycle also caught
`.planning/trace.jsonl` at 57.6% of a cap that refused every append past it,
with no rotation, about eleven days out at the then-current rate - v3.7.4


**`v3.7.3 - the record has to be right before it can be cut`**, opened and
closed 2026-08-26. Four phases planned, CLOSED AT PHASE 1 on a measured rework
rate: half the cycle's code commits were fixing the other half (7 fix against 7
feat, where `v3.7.1` ran 27% and `v3.7.2` 22%), four of those seven were four
passes at one question - which in-flight dispatch an async `SubagentStop`
callback belongs to - and one real defect landed after the phase's UAT reported
8 passed and 0 failed. Delivered `TRC-04` (a delayed repeat close stops stealing
the next dispatch's bracket), `TRC-06` (the stop close lands on the worker that
actually stopped, or writes nothing), `MSR-05` (`duration_ms` has a reader) and
`TRC-05` (a bracket records cache traffic). Also moved workflow rationale out of
the runtime path into `docs/rationale/`, taking 10,952 B off the four most-read
workflows with no step removed and no gate weakened - v3.7.3

**`v3.7.2 - the router loads late and the host writes the bracket` closed
2026-08-26.** Three phases, 42 commits off `v3.7.1`, seven requirement ids all
traced to a verified phase: `LOD-06` (two eager references cold-split behind a
router, 25,068 B to 2,323 and 40,413 B to 20,153), `TRC-02`, `TRC-03`
(`--duration-ms` on the close, close dedup on the worker key, `role` on an
unpaired row), `HOK-01`, `HOK-02` (`SubagentStop` writes the bracket close, the
hand-written one kept as the fallback that alone carries the figures), `CEN-03`
(a both-directions census over the `planning` test group's stem list) and
`DOC-04` (`CADENCE-CENSUS` given a prose home, two stale self-claims
corrected). `/cad-audit` PASS on both arms: 7 of 7 requirements traced, 14 of 14
acceptance criteria covered. Manifest bumped to `3.7.2`.

Where the cycle now lives: its requirement rows under `## Shipped` in
REQUIREMENTS.md, its narrative in `CHANGELOG.md` under `[3.7.2]`, and 52 residue
rows - phase deviations, UAT items and CONTEXT decisions - under this label's
heading in `.planning/ARCHIVE.md`, which is what `recall` indexes now that
`phases/1-3/` are gone from the live tree. The phase work itself is in git.

Landed and published: merged as #134 with all 14 required checks green, tagged
`v3.7.2` on the pulled base, release published 2026-08-26. Its eight tracker
issues are closed. Two items remain in CAPTURE, both release-path and both sized
as `/cad-task` rather than a phase: a `v*` tag publishes an official release
from a SHA that never reached `main` (`release.yml` triggers on tags, `test.yml`
never does), and `actions/checkout@v4` at `release.yml:20` is unpinned while
running under `contents: write`.

**`v3.7.1 - the tracker is the record` closed 2026-08-25.** Six phases, 138
commits off `v3.7.0`, ten requirement ids all traced to a verified phase:
`FRG-01`, `FRG-02` (the forge resolved at project setup), `CEN-01`, `CEN-02`
(the census registry and the plan-time lease check), `CAP-01`, `CAP-02`,
`CAP-03` (the tracker is the record; CAPTURE holds the phase in flight and
close asserts it empty), `SPL-01`, `SPL-02` (one spelling per phase) and
`LOD-02` (`planning.mjs` split into 30 per-command modules behind a 360-line
entry file). `/cad-audit` PASS on both arms - 10 of 10 requirements traced, 33
of 33 acceptance criteria covered across five phases. Manifest bumped to
`3.7.1`.

Where the cycle now lives: its requirement rows under `## Shipped` in
REQUIREMENTS.md, its narrative in `CHANGELOG.md` under `[3.7.1]`, and 144
residue rows - phase deviations, UAT items and CONTEXT decisions - under this
label's heading in `.planning/ARCHIVE.md`, which is what `recall` indexes now
that `phases/1-6/` are gone from the live tree. The phase work itself is in git
history off `v3.7.0`.

Outstanding at this close: the merge to `main` and the `v3.7.1` release tag,
both `/cad-land`'s (the tag is cut on the pulled base after the merge
confirms). One acceptance item carries forward rather than shipping proven -
phase 2's UAT item 11, whether the `/cad-plan` orchestrator halts on a live
`check_census` refusal rather than dispatching past it. The seam arm underneath
it is verified in both directions; only the workflow's obedience is unobserved,
and the first `/cad-plan` of the next cycle observes it.

**`v3.7.0 - the refusal that names the next step` closed 2026-08-24.** Two
phases, 36 commits off `v3.6.1`, three ids seeded at the open and all three
traced to a verified phase: `HNT-01`, `HNT-02` (#238) and `SCP-01` (#249).
`/cad-audit` PASS on both arms - 3 of 3 requirements traced, 13 of 13
acceptance criteria covered. Manifest bumped to `3.7.0`.

The theme: Cadence stated a failure in its own vocabulary and never stated the
remedy. Phase 1 wrote hints at every in-scope refusal under `cadence-core/bin/`
- 243 sites, 0 hintless, down from 215 hintless when the check went in - and
added `self-verify.mjs` check 22 (`refusal-hints`), which is what makes it a
property of the tree rather than a number that drifts back. Phase 2 made
`config.mjs set` refuse a repo-scoped key at the user-global layer at WRITE
time, reading a new `repo_only` schema marker.

One premise was disproved mid-cycle and is recorded rather than quietly
dropped: the open assumed `"src": "repo"` was the layer-scope marker and that
the refusal would cover all 33 keys carrying it. The schema's own legend
defines `"src": "repo"` as "settable in either layer", so phase 2 shipped a new
`repo_only` field instead, carried by one key today (CONTEXT D-01). The
derivation off a schema marker, not the count, was what the criterion wanted.

Shipped requirement rows live under `## Shipped` in REQUIREMENTS.md; the
narrative is the `3.7.0` CHANGELOG entry; the phase residue - SUMMARY
deviations, UAT items, CONTEXT decisions, 41 rows - is in `.planning/ARCHIVE.md`
under this label, which is what `recall` reads now that the phase directories
are pruned.

Outstanding. The merge and the release tag are `/cad-land`'s, cut on the pulled
base after the merge confirms. One accepted limitation ships with it: phase 2's
scope check resolves layer identity from a pathname and re-resolves that same
pathname for the read and the write, so a symlink swap in that window defeats
the refusal. Raised by the blocking risk-surface gate, confirmed by the phase
verifier, explicitly overridden on the record, and queued rather than fixed.
#238's own deferred siblings - the ask-user register rail and the done-step
report field lists - stay deferred.

**`v3.6.1 - the gaps v3.6.0 named` closed 2026-08-23.** A patch cycle over the
three gaps the `v3.6.0` changelog stated about its own work, and nothing else.
One phase, 19 commits off `v3.6.0`, three requirement ids seeded at the open and
all three traced to a verified phase: `WHY-02`, `WHY-03`, `WHY-04`. `/cad-audit`
PASS on both arms, 6 of 6 acceptance criteria covered. Manifest at `3.6.1`.

`/cad-why` now states the reachability it does not have rather than being
silently short, carries an entry cap whose stated reason measurement supports,
and orders closes by parsed instants. The third one changed the number it was
supposed to defend: `DEFAULT_TOP` moved from 10 to 6, re-measured after the
exclusion block landed rather than inherited from the plan.

Two things the phase's own verify pass caught that the plan did not. The cap's
header claimed to bound the response in bytes; swept across all 548 tracked
paths, 63 of them render at or over the 10,000-byte line, worst 30,825 B, so the
header now says the cap bounds ENTRY COUNT and names relocating the bytes as the
fix that would actually bound it. And the false `WHY-02` account was live at
three sites in the planning record, one more than the phase SUMMARY named; all
three are corrected.

Where it lives now: the shipped rows are under `REQUIREMENTS.md`'s `## Shipped`
tagged `v3.6.1`, the narrative is the `CHANGELOG.md` `## [3.6.1]` section, and
the phase's deviations, UAT items and CONTEXT decisions are 17 residue rows
under `.planning/ARCHIVE.md`'s `## v3.6.1` heading. The phase directory is
pruned from the live tree; git history keeps it.

Still outstanding: the merge to base and the `v3.6.1` release tag are
`/cad-land`'s, cut on the pulled base after the merge confirms. Two cache issues
are queued as a seed in `.planning/CAPTURE.md` and filed on the origin - record
prompt-cache figures on the dispatch bracket (#242), THEN move the rung label
below the contract reference (#241), in that order, because #241's benefit is
argued from byte layout and #242 is what would make it measurable. Neither is
scoped to a cycle yet. The four deferred ids - `PRS-01`, `EVD-01`, `RCL-06`,
`CTX-02` - keep their reasons and are unpromoted.

Next: `/cad-plan 1`.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| BM25, not embeddings | Deterministic, zero-dep, fast on a small corpus; matches seam philosophy | ✓ Shipped v1.1.0-rc.1 |
| `memory.backend` default flips to `builtin` | The feature's value is being there without setup; `none` remains the off switch | ✓ Shipped v1.1.0-rc.1 |
| Context-weight stats live in a seam + self-verify budget check | Deterministic measurement; CI catches prose bloat mechanically, same as drift | ✓ Shipped v1.1.0-rc.1 |
| Tools-declaration lint is blocking | Same species as the config-key drift check; consistency in how the linter treats drift | ✓ Shipped v1.1.0-rc.1 |
| Recall consumers: cad-context, cad-planner, cad-debug | The three moments past knowledge changes decisions: assumptions, task breakdown, hypotheses | ✓ Shipped v1.1.0-rc.1 |
| Pre-release versioning toward v1.1.0 | v1.0.0 is public; dogfood iterations shouldn't each burn a public minor — candidates converge on one release | ✓ Adopted — `-rc.N` per iteration (rc.2 this round) |
| Integration-branch per milestone (two-tier) | The milestone branch is the reconciliation point for parallel worktrees, keeping merge churn off `main`; worktrees are the disposable tier below it | ✓ Shipped v1.1.0-rc.2 |
| Autonomous close is opt-in, never the default | Preserves cad-land's "the publish mechanism is the user's call"; `auto_close` is an explicit override that still halts on a blocking `pre_ship` FAIL | ✓ Shipped v1.1.0-rc.2 (live end-to-end run deferred to final v1.1.0) |
| Reset-to-base + pull after every land | A cycle always ends on an up-to-date `main`, so the next starts clean; removes the manual return step | ✓ Shipped v1.1.0-rc.2 |
| `v1.2.0` cut straight, no rc cycle | A small backward-compatible minor (one bug fix, two guidance nudges, one command); the rc line was for the larger v1.1.0 scope | ✓ Shipped v1.2.0 |
| A close-time fix still goes through the ship gate | An empty-roadmap fix written during the v1.3.1 close looked small, passed 340 tests, and was reverted when `pre_ship` confirmed two HIGH findings: its heuristic reported a broken roadmap as a cleanly closed milestone, and it routed users to a workflow that refuses phases absent from ROADMAP | ✗ Reverted at the v1.3.1 close; requeued as a designed phase |
| Durability is prose judgment, not a score | The three-part filter lives in cad-context workflow prose; no scoring seam, matching "prose keeps judgment, scripts keep invariants" | ✓ Shipped v1.2.0 |
| DeepSeek via json_object + in-prompt schema | DeepSeek has no server-side json_schema; the shared validate-on-return guard degrades a schema-ignoring response to bad-shape, not bad data | ✓ Shipped v1.2.0 |
| A grammar is written down, tabled, and tested per row | The four readers this cycle replaced each failed silently in BOTH directions; a stated grammar with an out-of-grammar table makes the limit a documented row instead of an accident | ✓ Shipped v1.4.0 (4 references, per-row tests) |
| Detection any-position, hard refusal command-position only | Matching a wrapper anywhere keeps `sudo bash -c "git push"` from going silent; refusing anywhere would hard-block read-only work like `rg -t sh "git commit"` and `command -v git commit`, which run nothing | ✓ Shipped v1.4.0 — costs a deny on transparent prefixes, which now ask |
| The two roadmap readers keep DIFFERENT extents | Canonical parse stops at the next `## `; classification runs to end of text, so a wiped checkbox list whose `### Phase N:` sections survive reports as an interrupted prune instead of a clean close | ✓ Shipped v1.4.0 — restoring "consistency" re-opens the false close |
| `unseeded` became verdict-breaking, reversing v1.4.0's own earlier shape | A diagnostic that never moves the verdict leaves the ship gate exactly as permeable as it was; the additive form shipped in phase 2 is what phase 5 had to undo | ✓ Shipped v1.4.0 (breaking for `total === rows.length` callers) |
| The release tag is cut after the merge, not at the close | A tag made during `/cad-milestone` names a commit on the integration branch that base never contains as a tip; publishing is `/cad-land`'s step, and the tag rides with it | ✓ Adopted at the v1.4.0 close |
| The routing axis asks stakes, not spend | "How much will you spend" is answerable but useless, and on a Max subscription it is not a question the user has; "what happens if this is wrong" is answerable in one second and is the only form a risk signal can auto-set. MANIFESTO's principle is value per dispatch — stakes is the numerator it was always reaching for | Adopted for v2.0.0 (STK-01); breaking, no alias |
| The rung ladder is one contract materialized N times, not N variants | The host freezes `effort` per agent file on the Agent/Task dispatch path, so rungs need files; the contract lives in exactly one skill and a rung file that ever carries behaviour fails self-verify. Without that check this is the GSD namespace-variant sin the MANIFESTO names | Adopted for v2.0.0 (RNG-01), on the v1.5.0 contract skills |
| Bare `#NNN` stays the Forgejo archive; GitHub issues carry `GH-` | Cadence and Verbatim move to GitHub as primary with Forgejo as the mirror. GitHub renumbers issues from 1, so the 151 existing bare `#NNN` citations (93 distinct, 109 of them in REQUIREMENTS.md) would each resolve to a different real issue - a wrong answer that looks right. Rewriting them would edit ARCHIVE.md and REQUIREMENTS.md `## Shipped`, records of what was true when written. So nothing is rewritten: a bare `#NNN` means the public Forgejo archive at git.jcrenshaw.dev/crenshawdev/cadence, and issues filed on GitHub from 2026-08-25 are written `GH-NNN`. `planning-files.mjs:330` already admits `#\d+` as a requirement-id token, so traceability is unaffected either way | Adopted 2026-08-25 |

---
*Last updated: 2026-08-16 v3.5.3 opened from the v3.5.2 close (3 issues, phases to be added)*
