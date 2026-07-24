# Changelog

All notable changes to Cadence are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and Cadence follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2026-07-24

"liteSpeed": a flow pass over the whole `/cad-*` surface that cuts coordinator
round-trips without changing what the workflows produce. Two shared conventions
let the spine batch independent known-path reads into one message and fan
independent subagent dispatches out concurrently, instead of walking them one
turn at a time. Three correctness bugs the audit surfaced ship alongside.

### Added

- Parallel-work and concurrent-dispatch conventions (`references/conventions.md`,
  `references/seams.md`), wired into ~18 workflows and skills: independent
  known-path reads batch into one message; independent agent dispatches fire
  concurrently, reusing one route resolution.
- `/cad-config` detects all review providers in one concurrent batch instead of
  serial per-provider timeouts.

### Fixed

- `/cad-progress --stats` no longer writes STATE.md in its documented read-only
  mode (it walked the cursor-reconcile step before the stats stop).
- `/cad-undo` applies the protected-branch guard before a committing revert, like
  every other commit-producing step.
- `/cad-config`'s interactive menu labels `(current)` from the repo file's own
  value, not the effective (possibly global-inherited) value, so an inherited
  global is no longer silently pinned into the repo file.

## [1.2.1] - 2026-07-23

Three high-severity fixes from a post-1.2.0 cross-model review sweep over the
executable seams. All three corrupted state or weakened protection while
reporting success - the silent class the sweep was hunting. Each ships with a
regression test written failing-first.

### Fixed

- **A newline in verifier-authored UAT text can no longer flip a verdict.**
  `renderUat` flattens every field value to one line on write, so an evidence
  string containing `"\nstatus: pass"` stays inert instead of reparsing as a
  second status line where last-assignment-wins silently turned a failed item
  into a pass and opened the phase gate. (#35)
- **`renumber insert` no longer corrupts the phase directories when the
  highest phase is a decimal insertion.** The dir-move ceiling is computed
  over integer phases only, so with a `2.1` present the countdown visits the
  integer dirs it must shift and leaves the decimal dir untouched - previously
  it did the exact opposite and still reported ok. (#36)
- **`git-guard` honors the config it documents.** `on_protected: "deny"` now
  hard-blocks as an alias of `refuse` (it previously fell through to a soft
  ask), and a lone-string `protected_branches` guards the named branch instead
  of silently reverting to `['main','master']` - in `git-publish` too. (#38)

## [1.2.0] - 2026-07-22

The judgment-sharpening cycle, dogfooded on Cadence itself. It repairs the
cross-model review seam so a second opinion actually fires instead of silently
no-opping, sharpens how the planner splits work and how context decides which
decisions are worth remembering, adds an on-demand way to stress-test one
load-bearing decision, and grows the cross-model roster with DeepSeek.

### Cross-model review, repaired

- **The run-as-script guard now compares realpaths on both sides**, so
  `review-provider.mjs` no longer no-ops when the plugin is installed through a
  symlink - cross-model `review` / `consult` / `detect-models` reach the real
  provider instead of degrading to the subagent unnoticed. A symlink regression
  test invokes the script through a link and asserts a non-empty JSON line.
- **An empty or unusable provider result surfaces one line** in the caller
  before falling back to `claude-subagent`, rather than degrading silently.

### Sharper planning and context

- **`cad-planner` carries a standing separation-of-concerns nudge** - a
  heuristic, not a hard rule - that prefers small single-purpose tasks over a
  shared core and splits responsibilities that differ on trigger, size,
  lifecycle, failure-resume, freshness, or ownership. It applies to every plan
  with no per-phase restatement and never forces a split that does not earn
  itself.
- **`cad-context` marks a decision durable only when it passes a three-part
  filter** (hard-to-reverse, surprising-without-context, and the result of a
  real trade-off). Durable decisions are written under a `## Durable decisions`
  heading and resurface via recall; the phase-local rest stay under
  `## Decisions`. Legacy `CONTEXT.md` files with only `## Decisions` still
  resurface unchanged - no retrofitting.

### Decision review

- **`/cad-decision-review <path>`** runs an on-demand refute-then-adjudicate
  pass over one load-bearing decision (a `CONTEXT.md` line or a `PROJECT.md` Key
  Decisions row) through the existing review subsystem. `cad-reviewer` - and a
  cross-model provider when one is configured - refutes the decision; the main
  model grounds each objection against Context7 (library/API claims) and the
  real codebase, then rules it `survives | partial | refuted` with a concrete
  amendment list. It never auto-fires and reports its cost qualitatively. New
  `review.decision_review.{tier,effort}` config governs the model.

### DeepSeek cross-model provider

- **DeepSeek is a third cross-model review provider**, via its own Chat
  Completions adapter (not an OpenAI Responses base-URL swap). Because DeepSeek
  has no server-side `json_schema`, the adapter uses `json_object` mode with the
  finding schema injected into the prompt and the shared validate-on-return
  guard, so a schema-ignoring response degrades to a structured `bad-shape`
  rather than bad data. `reasoning_effort` maps the effort dial and keys resolve
  via `DEEPSEEK_API_KEY`, never logged. Selectable through `review.reviewers`
  and `review.providers.deepseek.tiers.*`.

## [1.1.0] - 2026-07-17

The stable `1.1.0`, promoting the `rc.1` and `rc.2` line to a public release. The
full feature detail lives in those two entries below - recall, measured context,
the two-tier git model, and the release lifecycle all shipped there and carry
forward unchanged.

This final round closed the one acceptance the candidates could not: the
autonomous close (`git.auto_close`) was exercised live end-to-end against the
real remote - audit, tag, PR, merge, then reset to a pulled base with the merged
integration branch reaped - confirming the close chain the `rc.2` tests proved in
isolation also holds in a real publish. The never-auto-push rail via the
git-publish seam stays intact; `auto_close` remains opt-in and off by default.

## [1.1.0-rc.2] - 2026-07-17

Second release candidate toward `1.1.0`, built by dogfooding Cadence on itself.
This line closes Cadence's biggest self-admitted gap - its write-only memory -
turns the context-engineering claims into measured, CI-enforced facts, and gives
the plugin an explicit git branching model plus a release lifecycle that keeps
its own version honest. It accumulates the `rc.1` recall work and adds this
round's git model and release mechanics. The final `1.1.0` tag is cut only at
publish.

### Recall - the write-only memory gap, closed

- **`memory.backend` now defaults to `builtin`** (was the reserved, wired-to-`none`
  socket in `1.0.0`). `none` remains the off switch. The feature's value is being
  there without setup.
- **Deterministic BM25 recall over `.planning/`** as a zero-dep `planning.mjs
  recall` subcommand - same corpus and query always rank the same, no timestamps
  and no embeddings. An empty corpus returns `{ok:true, results:[]}`, never an
  error.
- **Recall is injected where past knowledge changes a decision:** `/cad-context`
  (assumptions), `/cad-plan` (task breakdown), and `/cad-debug` (hypotheses) each
  pull cited snippets at the moment they start reasoning.

### Measured context, enforced in CI

- **Per-surface context-weight measurement** (byte and estimated-token weight of
  agent and skill prose) via a deterministic seam subcommand.
- **A blocking self-verify budget check** names the surface and its overage, so
  prose bloat is caught mechanically, the same way drift is.
- **A blocking tools-declaration lint:** agent prose may reference only the tools
  declared in that agent's frontmatter.

### Two-tier git model

- **`git.integration_branch`** (`milestone` default, `trunk` escape hatch) plus
  **`git.auto_branch`** (`ask` | `auto` | `off`). In `milestone` mode a
  per-milestone integration branch is created at cycle start as the reconciliation
  point parallel worktrees fork from and merge into, keeping merge churn off
  `main`. `trunk` composes with the existing protected-branch guard and creates
  nothing.

### Land cleanup and opt-in autonomous close

- **`git.on_land_cleanup`** (default on): after a land or merge actually lands,
  return to base, pull, and reap the merged integration branch - never via a
  remote-tracking delete.
- **`git.auto_close`** (opt-in, default off): lets `/cad-milestone` and `/cad-land`
  run the whole close - audit, tag, PR or MR, merge, reset - with no per-step
  prompts. A blocking `pre_ship` finding still halts the chain before merge. With
  it off (the default), `/cad-land` still asks the publish mechanism with no
  preselected default: the opt-in never changes the default posture. The decision
  core, gate-halt, publish seam, and guard behavior are covered by tests; the full
  unattended chain has not yet been exercised end-to-end against a live remote, and
  that run is the gate for the final `1.1.0`.
- **The never-auto-push rail holds.** The GitHub arm's one sanctioned push runs
  through a code-guarded `git-publish` subprocess seam invoked only by `/cad-land`;
  every Bash `git push` the guard sees still asks unconditionally (the old
  `isPlainPush` command-string exemption was deleted).

### Release mechanics folded into the close

- **`release-bump.mjs`** bumps a distributed plugin's own `.claude-plugin/plugin.json`
  version and scaffolds the dated CHANGELOG heading and link reference as part of
  the milestone close, idempotently. Non-plugin projects are unaffected (it skips
  when no manifest is present). A plugin release stops shipping with a stale
  version.

### Release prep and store readiness

- **Public docs reconciled** to the shipped code (README, MANIFESTO, DESIGN,
  LINEAGE, NOTICE, CHANGELOG), verified by `/cad-docs-verify`.
- **DESIGN.md records the reversed decisions** with what changed and why - the
  never-auto-push reversal (opt-in `auto_close` plus the one sanctioned push seam)
  and the deleted `isPlainPush` whitelist.
- **GSD lineage framing settled** to independent distillation, with the ~3%
  documentary-mass figure date-labelled (measured 2026-07-10, GSD commit d010ea1).
- **Plugin-store metadata** added (`displayName`, marketplace description);
  `claude plugin validate --strict` exits clean.

## [1.0.0] - 2026-07-16

First public release. Cadence is a standalone planning-and-execution system for
Claude Code, installed as a plugin. Its methodology descends from
[GSD](https://github.com/open-gsd/gsd-core) (MIT) - the discuss/plan/execute/verify
loop - but the codebase is an independent distillation carrying roughly 3% of GSD's
documentary mass (measured 2026-07-10, GSD commit d010ea1). See
[`LINEAGE.md`](./LINEAGE.md) for the measured distance and
[`NOTICE.md`](./NOTICE.md) for the attribution.

### The loop

- One disciplined cycle: `/cad-new-project` then `/cad-context`, `/cad-plan`,
  `/cad-execute`, `/cad-verify`, per phase, with `/cad-progress` reporting where
  you stand and auto-resuming incomplete work.
- One atomic conventional commit per task.
- Durable state lives in `.planning/` files and git, never in the conversation,
  so you can `/clear` at any phase boundary and the next command rebuilds from
  disk.
- 22 skills and 7 agents, and nothing beyond them: no team or multi-author
  tooling, no feature catalog.

### Determinism ladder

- **Deterministic seams.** Every read and write of `.planning/` state, model
  routing, and config validation runs through small zero-dependency Node scripts
  (`planning.mjs`, `route.mjs`, `config.mjs`, `review-provider.mjs`) that emit one
  JSON line and never block the loop. Prose keeps the judgment; the scripts keep
  the invariants.
- **Harness-enforced git rails.** The protected-branch guard is a `PreToolUse`
  hook (`git-guard.mjs`), enforced by the harness rather than by prose the model
  can talk itself out of. It acts only inside a Cadence project and never touches
  unrelated repositories.

### Git model

- Atomic commits, never an automatic push, and a `/cad-land` step that asks how
  you want to publish (push, MR or PR, tag, or leave local) with no preselected
  default.

### Review and routing

- Adversarial review is a first-class, configurable subsystem: a fresh-context
  Claude reviewer by default, with pluggable cross-model reviewers (OpenAI and
  Gemini, direct API calls with provider-enforced structured output). A
  user-gated consult can bring a second model's angles to a debugging dead-end.
- Model routing ships three profiles (fast, balanced, quality) plus an optional
  `auto` mode that picks model (and effort, via role variants) per task, with
  guardrails. Failure escalation only ever raises; a retry is never demoted.

### Memory

- A built-in minimal memory (`.planning/CAPTURE.md`). `memory.backend` reserves
  the seam for a richer backend; only `none` is wired today.

### Hardening pass (2026-07-16, before tagging)

The entry above was drafted 2026-07-15; before cutting the tag, the whole
codebase went through a claims audit and a four-pass sweep, and everything
found was fixed in this release rather than deferred.

- **Parallel safety is arithmetic now.** `planning.mjs plan-overlap` intersects
  the declared file lists of a phase's plans; `/cad-execute` refuses to
  parallelize on any overlap or any plan with no declarations.
- **New review trigger `phase_diff`** (opt-in, off by default): one aggregate
  review of the merged phase diff after parallel execution, because per-plan
  reviews cannot see cross-plan interactions.
- **Configurable consult cadence:** `review.consult.attempt_threshold`
  (default 3) sets how many failed fixes count as a dead-end in `/cad-debug`.
- **Working-method discipline** (after Karpathy's "Recipe" generalized):
  planners order tasks skeleton-first (a wired tracer bullet by commit 2-3),
  executors state the expected output before running each verification and
  record surprises as deviations, and every goal-check claim carries file:line
  or command-output evidence.
- **Guard hardening:** the push rail matches the actual git subcommand
  (`git stash push` and quoted arguments no longer trip it), the project check
  walks up from subdirectories, and the hook is time-bounded.
- **Model detection fixes:** legacy non-reasoning families and Gemini 2.x are
  no longer steered into effort parameters their APIs reject.
- **Ten config keys with no reader were pruned** rather than documented,
  including a `git.auto_push` switch that contradicted the no-push rail.
- **Self-verification in CI:** a drift linter proves every config key, script
  invocation, and path named in the prose exists in the code, on every push.
  Plus typechecking of the `@ts-check` pragmas and a Node 22/24 matrix.
- **Tests: 84 to 132**, covering the previously untested invariants, with
  hermetic fixtures and midnight-robust assertions. The pass surfaced and
  fixed two latent bugs in decimal-phase renumbering.

### Install

```
/plugin marketplace add https://github.com/crenshawdev/cadence.git
/plugin install cadence@cadence
```

[1.2.1]: https://github.com/crenshawdev/cadence/releases/tag/v1.2.1
[1.2.0]: https://github.com/crenshawdev/cadence/releases/tag/v1.2.0
[1.1.0]: https://github.com/crenshawdev/cadence/releases/tag/v1.1.0
[1.1.0-rc.2]: https://github.com/crenshawdev/cadence/releases/tag/v1.1.0-rc.2
[1.0.0]: https://github.com/crenshawdev/cadence/releases
