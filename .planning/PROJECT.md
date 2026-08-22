# Cadence

## What This Is

Cadence is a Claude Code plugin for phased planning and execution: roadmap →
context → plan → execute → verify, with file-based continuity in `.planning/`,
deterministic seam scripts guarding invariants, and an adversarial review
subsystem. `v3.5.6` is the current release: the machinery that records what a
run did. Executor reports rotate instead of overwriting, a re-run of an executed
phase is refused, and every gate fire writes an adjudication record carrying each
finding's verbatim claim, its ruling and a head SHA you can check out, so a
survivor count is recounted rather than asserted. `v3.5.5` before it was readers
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

### Active

**`v3.5.8 - the transition that claims to be one`, opened 2026-08-22.** Scoped
from the tracker milestone `v3.5.8`, which holds #145, #139 and #140. These are
one piece of work, not three: #145 is the shared primitive and the other two are
its first two consumers, which is why the previous cycle dropping all three left
its own stated theme untouched.

The theme is one sentence: four operations in this codebase write several files
and report the result as if they wrote one. Phase completion writes ROADMAP.md
and REQUIREMENTS.md, the release bump writes the primary manifest, a sibling and
the changelog, the milestone prune writes phase directories and both documents,
and renumbering writes deletions, moves and three documents. An atomic rename
protects one file from torn bytes and cannot create a transaction across files,
so every one of these can leave a half-applied tree inside an `ok:true`
envelope. #140 names that gap at `cmdPhaseDone`, whose own comment says
"all-or-nothing" over two separate renames. #139 names it at
`release-bump.mjs:138-141`, which writes the primary manifest before it has read
or validated the sibling, so a malformed sibling leaves a partially bumped
release tree and reports success. #145 is the primitive both want: a journal or
recovery step that makes a multi-file transition either complete or recoverable,
rather than reported honestly only where someone remembered to report it -
renumbering already does report partial application (`planning.mjs:3227-3273`),
which is the existing behaviour to generalize rather than replace.

Requirement ids are seeded at the open, in `REQUIREMENTS.md`'s `## Active`, the
practice `v3.5.7` established and `v3.5.6` did not have. Phases are not yet
added.

`v3.5.7` closed on 2026-08-22: four phases, 83 commits off `v3.5.6`, the manifest
at `3.5.7`, and `/cad-audit` PASS on both arms - four of four requirements traced
requirement to phase to plan to verified, and 14 of 14 acceptance criteria
covered with zero breaks. Its narrative is in `CHANGELOG.md`, its per-phase
residue in `.planning/ARCHIVE.md` at 89 new rows, and its phase record in git
history at the pruning commit; this close ran `--mode delete`, so there is no
`_archive-v3.5.7/`. The merge and the release tag are still outstanding:
`/cad-land` cuts `v3.5.7` on the pulled base after the merge confirms.

What it delivered: the controls to spend what Cadence had only been measuring.
`stakes` became the minimum a project accepts rather than the level every phase
pays, with the phase's own declared `files:` scanned at plan time to raise from
that floor - `route.mjs replay` shows 27 of this repository's 30 phases raising
back to `shipped` on real evidence, 2 taking the discount and 1 withheld because
a declared path was not readable, which is the fail-closed direction. A fifth
gate mode `deferred` runs its reviewer, queues what it found as a committed
`DEFERRED-*.json` and lets the phase finish, moving the guarantee to the land
where `/cad-land` refuses on both publish arms while any member is
unadjudicated. `/cad-config --surfaces` gives the risk-surface interview a way
back in against a fresh scan. And `trace suggest` finally opens
`.planning/reads.jsonl`, so the in-dispatch read redundancy the record had been
carrying reaches a consumer: `cad-executor` at 3.64 opens per distinct file
inside one dispatch, worst case `planning.mjs` read 29 times in one bracket, with
the coverage, the scope and the excluded coordinator reads stated in the entry's
own evidence string rather than only in prose.

The honest line on this cycle: it shipped four of the five issues it was scoped
for, and the fifth was killed rather than dropped. `BCH-01` (#174) went to
`## Deferred` on a spike that invalidated it - batching N security reviews into
one process saves 1.91%, a 1,676-token fixed prefix against six dispatches
totalling 438,080 tokens, and it does not flip at the 61 invocations the issue
cites because both sides of the ratio scale with N. The other spike narrowed
#167 before it was planned: the 7.0x read redundancy the issue carries was
measured over declared read-sets, and the observed in-dispatch figure is 3.64.
Two spikes cost this cycle one phase and saved it from building a lever worth a
rounding error.

Still unassigned, carried into `v3.5.8` unscoped: two blocker/high `risk_surface`
findings from phase 3 are persisted in the carried
`.planning/REVIEW-risk_surface-v3.5.7.md` although the adjudication records show
both fixed (`7ae1489`, `70bd22a`), so that file needs a look before the next
close treats it as live. The medium survivors from `v3.5.4`, `v3.5.5` and
`v3.5.6` are still unassigned, and so are #190, #191 and #192, which PROJECT has
called a cycle of their own rather than filler. The deferred ids `PRS-01`,
`EVD-01`, `RCL-06` and `CTX-02` were not promoted and their 2026-08-18 caveats
stand: `CTX-02`'s stated basis no longer holds and `RCL-06` carries no promotion
trigger, so both want a decision before either is scoped.

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

---
*Last updated: 2026-08-16 v3.5.3 opened from the v3.5.2 close (3 issues, phases to be added)*
