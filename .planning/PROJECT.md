# Cadence

## What This Is

Cadence is a Claude Code plugin for phased planning and execution: roadmap →
context → plan → execute → verify, with file-based continuity in `.planning/`,
deterministic seam scripts guarding invariants, and an adversarial review
subsystem. `v2.2.0` is the current release: the config read face merges a
layer once whatever its spelling, the git guard's parser is deleted in favor
of one small anchored reader, the release seam can no longer ship a number or
notes it never got from the close, every shipped rung-ladder claim is true or
gone, and the documented Forgejo install path is proven live rather than
inferred. Earlier cycles: `v2.1.0` coverage and triage gates, `v2.0.0` the
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

### Active

**`v2.4.0 — what Cadence says about itself`**, opened 2026-08-05. The
predecessor `v2.3.0 — where the bytes live` closed 2026-08-05 with all eleven
requirements delivered (RES-01..04, LOD-01..05, BUD-01..02 — rows above), both
audit arms green (11/11 traced, 20/20 criteria covered), and the manifest at
`2.3.0`.

This cycle turns on the queue rather than on a measurement. `.planning/CAPTURE.md`
holds 187 open items accumulated across nine milestones. Some were closed by
work that shipped and were never struck; some are real and have been carried
unread for months because the file
is too long to triage in passing. A queue nobody can read is the same failure as
no queue, and it is currently the input to `/cad-plan`'s recall.

The cycle is therefore **reconciliation, not construction**: triage the queue
against the live tree, close what shipped, delete what is moot, and keep what
survives with its reason restated. Then the same pass outward — reconcile what
Cadence claims about itself, in `README.md`, `METHOD.md`, `INTERNALS.md`,
`CONTRIBUTING.md` and the workflow prose, against what the code now does. The
v2.3.0 close found two live examples inside one release section: a phase-2
CHANGELOG bullet asserting `references/` is unbudgeted while a phase-3 bullet
budgets it, and `MEASUREMENTS.md` narrative counts contradicting their own
table. `/cad-docs-verify` exists for exactly this and has never been run across
the whole surface.

Guardrail for the cycle, learned from v2.3.0: an item is closed only against
evidence from the tree, never because it reads as done. The close-out of a
capture item names the commit that closed it, the same way a UAT item names its
evidence.

### Out of Scope

- Embeddings / vector search — BM25 is deterministic, zero-dep, and sufficient for a corpus of dozens of markdown files (Ratel's benchmark is the existence proof); embeddings add infra Cadence's philosophy forbids
- External memory backends (mem-*, claude-mem, MCP) in this cycle — the `builtin` backend defines the recall contract first; external backends slot in behind the same seam later
- Knowledge memory / cross-project recall — Cadence owns project-scoped working memory only; global memory belongs to the developer's own tools (LINEAGE cut, stands)
- Runtime token telemetry of live sessions — Claude Code exposes no per-turn stats to a plugin script; measurement is static prose weight, not live usage
- Second-model lanes (research/verify/build) — deferred to a later cycle, tracked separately

## Context

Brownfield: Cadence v1.0.0 shipped publicly today (2026-07-16, repo
crenshawdev/cadence, tag v1.0.0). This cycle is v1.1.0, built by dogfooding
Cadence on itself — the first project init on this repo.

The gap being closed: deviations are recorded at execute time (cad-executor →
SUMMARY.md), CAPTURE.md accumulates, UAT findings accumulate — but neither
cad-plan nor cad-context reads any of it back. `memory.backend` is an empty
socket (`enum: ["none"]`).

Design provenance: inspired by ratel-ai/ratel — progressive disclosure via
deterministic BM25 catalogs, no vector DB, no infra. Cadence applies the same
bet to its own planning artifacts rather than to tool schemas.

Established patterns this work must follow: zero-dep Node seam scripts in
`cadence-core/bin` with one-line JSON stdout and exit codes; every new
subcommand gets a CONTRACTS entry in self-verify.mjs plus tests in the
sibling `*.test.mjs`; prose keeps judgment, scripts keep invariants.

## Constraints

- **Dependencies**: zero runtime deps — BM25 and stats are hand-rolled JS in `cadence-core/bin` (lib/ helpers allowed)
- **Compatibility**: existing `.planning/` layouts must work unchanged; recall on a project with no SUMMARYs degrades to empty results, never an error
- **Determinism**: same corpus + same query → same results; no timestamps, no randomness in ranking
- **Toolchain**: Node 22/24 (CI matrix), `node --test`, `tsc --checkJs` must stay green
- **Semver honesty**: `v1.0.0` is the public baseline (immutable). `v1.1.0` shipped through `-rc.N` candidates; `v1.2.0` is a straight minor bump cut at publish. A larger future scope may use `-rc.N` again; small backward-compatible cycles tag straight. Never retag a published version. `v2.0.0` is major for one reason only: `model.profile`'s enum values change with no back-compat alias, so a config a user wrote stops validating.

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
*Last updated: 2026-07-29 HST-01 added at phase 6 (7 requirements, 6 phases)*
