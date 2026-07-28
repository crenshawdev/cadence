# Cadence

## What This Is

Cadence is a Claude Code plugin for phased planning and execution: roadmap →
context → plan → execute → verify, with file-based continuity in `.planning/`,
deterministic seam scripts guarding invariants, and an adversarial review
subsystem. `v1.5.0` is the current release: four corrections to things Cadence
said about itself, and one structural change - each agent's contract is now
stored once, as a skill preloaded through `skills:` - so there are fewer places
left to say them. Earlier cycles shipped file-based memory and BM25 recall
(`v1.1.0`), the cross-model review repairs and durable-decision recall
(`v1.2.0`), the sweep-highs patch (`v1.2.1`), the liteSpeed flow-and-latency
pass (`v1.3.0`), the tech-debt cycle that closed all 13 post-`v1.2.0` sweep
bugs (`v1.3.1`), the four stated grammars (`v1.4.0`) and the two
internally-inconsistent contracts closed by subtraction (`v1.4.1`), on the
`v1.0.0` planning baseline.

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
- ✓ One quote-state tokenizer drives both git-guard rails, closing the six verified rail-3 push holes plus the `eval` wrapper family (TOK-01) — v1.4.0
- ✓ The roadmap phase list has a stated grammar, so an empty `## Phases` is a derived closed-milestone state and `/cad-progress` works between milestones (RDM-01) — v1.4.0
- ✓ `/cad-audit` counts an `## Active` requirement no phase picked up, so the traceability gate holds in the partially-planned state (AUD-01) — v1.4.0
- ✓ Two contracts that contradicted themselves closed by subtraction: the executor's terminal success-criteria check (#65) and `conventions.md`'s claim to reach every skill (#67) — v1.4.1
- ✓ The worktree fork point stated as `worktree.baseRef`-selectable across six surfaces, with `/cad-execute` refusing the parallel path under `fresh` (#68) — v1.5.0
- ✓ Per-trigger `effort` scoped to the backend that can honour it, rather than resolved and silently dropped on the `claude-subagent` arm (#64) — v1.5.0
- ✓ Each agent's contract stored once as a preloaded contract skill, with self-verify asserting every one resolves and is model-invocable (#74) — v1.5.0

### Active

**v2.0.0 — Stakes, not spend**, opened 2026-07-28. Six requirements across six
phases, tracked as GitHub milestone `v2.0.0`.

- **RNG-01** — per-rung agent files materialize effort off the preloaded
  contract skills, retiring `escalate_effort_variant` and the
  `cad-plan-checker-high` runtime-read shim
- **STK-01** — `model.profile`'s enum becomes the stakes question, no
  back-compat alias. This is the break that makes the release major
- **STK-02** — a routing cell resolves `{model, effort, review, verify}`
  rather than a bare model, computed from one small table
- **STK-03** — the risk surface Cadence already detects raises a phase's rung
  by itself; detection is a floor, lowering it needs a named override
- **ACR-01** — CONTEXT acceptance criteria get stable ids and `/cad-audit`
  proves coverage in both directions
- **CFG-01** — the remaining resolved-then-dropped config keys, closed the way
  per-trigger effort was

Two things deliberately left open at setup. The rung names
(`personal`/`production`/`critical`) are a proposal the issue holds least
firmly; they lock at `/cad-context 2`, and whatever they become must describe
a situation rather than grade an effort. And the executor-model claim behind
the cell values ("heavier model on the executor produced fewer review cycles")
has only an informal result behind it — a spike inside phase 3, not a gate on
the cycle, since it decides which model lands in which cell and not whether
the axis is right.

Not chosen for this cycle:

- **Streaming provider responses.** The evidence is good (the same model at the
  same effort measured 292s and 118s on two payloads, so no fixed timeout is
  ever right), but `review.request_timeout_ms` at 540000 plus the 600000ms Bash
  ceiling bounds the damage, and the rewrite touches every adapter, response
  handling, and the structured-output assertion. It is a cycle, not a phase.
- **v1.4.0's own known gaps**, listed under `[1.4.0] Known gaps` in
  CHANGELOG.md: one stated rule for markdown inside a frontmatter value (the
  interior-backtick class, where `` lib/a`b.mjs `` and `` **`src/a.rs`** `` are
  structurally identical inputs), scoping `backtick-wrapped-value` off prose
  keys, surfacing `seed-reqs`' computed-but-unread `mismatched`, and the
  missing orchestrator-side worktree refresh behind a `blocked` halt.
- **The remaining open `[enhancement]` issues** (#14-#31) — features, not
  correctness, which is why they have sat out four cycles. #54 left that set
  and joined this milestone, where it closes as superseded rather than ships:
  the reframe deletes the tier ladder it wanted to expose.

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
*Last updated: 2026-07-28 opened v2.0.0 — Stakes, not spend (6 requirements, 6 phases)*
