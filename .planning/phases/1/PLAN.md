---
phase: 1
plan: 1
requirements: [QW-01, QW-02, QW-03, QW-04, QW-05]
files:
  - .gitignore
  - .planning/CAPTURE.md
  - agents/cad-executor.md
  - agents/cad-executor-xhigh.md
  - cadence-core/bin/branch-decision.test.mjs
  - cadence-core/bin/config.test.mjs
  - cadence-core/bin/git-branch.mjs
  - cadence-core/bin/git-branch.test.mjs
  - cadence-core/bin/git-guard.mjs
  - cadence-core/bin/git-guard.test.mjs
  - cadence-core/bin/git-publish.mjs
  - cadence-core/bin/land-cleanup.mjs
  - cadence-core/bin/lib/branch-decision.mjs
  - cadence-core/bin/lib/merge-warnings.mjs
  - cadence-core/bin/lib/risk-surfaces.mjs
  - cadence-core/bin/lib/trace.mjs
  - cadence-core/bin/planning.mjs
  - cadence-core/bin/planning.test.mjs
  - cadence-core/bin/review-provider.mjs
  - cadence-core/bin/review-provider.test.mjs
  - cadence-core/bin/risk-surfaces.test.mjs
  - cadence-core/bin/route.mjs
  - cadence-core/bin/route.test.mjs
  - cadence-core/bin/self-verify.mjs
  - cadence-core/bin/self-verify.test.mjs
  - cadence-core/bin/trace.test.mjs
  - cadence-core/bin/weight-budgets.json
  - cadence-core/config.schema.json
  - cadence-core/references/bug-patterns.md
  - cadence-core/references/config-reach.md
  - cadence-core/references/review-triggers.md
  - cadence-core/route-table.json
  - cadence-core/templates/config.json
  - cadence-core/workflows/config.md
  - cadence-core/workflows/debug.md
  - cadence-core/workflows/execute.md
  - cadence-core/workflows/progress.md
  - cadence-core/workflows/verify-deep.md
  - cadence-core/workflows/verify.md
  - skills/cad-executor-contract/SKILL.md
  - skills/cad-health/SKILL.md
  - skills/cad-progress/SKILL.md
  - skills/cad-verifier-contract/SKILL.md
---

# Phase 1: Benchmark quick wins - Plan

## Goal

The capability gaps an outside evaluation found are closed where closing them is
real capability rather than scoreboard motion. Cadence gains a static-analysis
path into execution that works without configuration, one joined trace that
explains what a run actually did, enforcement of the file leases it already
declares, and exercised evidence for the provider failure paths it currently
assumes.

## Must be true when done

- In a repo that configured nothing, an executor whose edit fails the project's
  own lint stops at a `blocked` checkpoint with no commit for that task, and the
  command it ran was found by a seam rather than guessed.
- A run leaves one gitignored `.planning/trace.jsonl` whose routing, provider,
  worker-lifecycle and outcome events all carry the same per-phase correlation
  id, `planning.mjs trace render` pairs every worker dispatch to its return or
  checkpoint, `/cad-progress --trace` prints it and writes nothing, and a trace
  that cannot be written changes no seam's envelope by a byte.
- Nothing Cadence already computes dies in silence: a `mergeLayers` caller that
  neither takes `warnings` off the call nor documents why is reported by CI, and
  a torn `.planning/config.json` makes `git commit` return `ask` naming the parse
  failure - on any branch, protected or not.
- An executor that stages a file its own plan never declared is stopped by a
  mechanism before it commits, on the sequential path and the parallel one alike.
- A dependency lockfile no longer floors a phase to `critical`, and a freshly
  scaffolded config no longer overrides the stakes level's `phase_diff` gate.
- Every `review-provider.mjs` failure mode has a test proving what the caller
  sees against a local stub, and a reviewer that drops out of a fired trigger is
  named in the trace with its reason.
- A version this repo has already tagged is never offered as a new integration
  branch, and `/cad-health` names both numbers when the planning docs and the
  shipped version disagree.

## Context

Binding: `.planning/phases/1/CONTEXT.md` D-01..D-28 and AC1..AC8. Repeated here
only where a task would otherwise have to go and look.

- Every new subcommand needs a `CONTRACTS` row in `self-verify.mjs` (check 2),
  and a two-word subcommand also needs its first word in `TWO_WORD`.
- A new config key is ONE commit across all five surfaces: `config.schema.json`,
  `cadence-core/templates/config.json`, the catalog row in
  `cadence-core/workflows/config.md`, the reach row in
  `cadence-core/references/config-reach.md`, and at least one prose reader
  (self-verify check 1b `inert-config-key` fails otherwise). `config.mjs` is
  schema-driven and needs no code change.
- Any edit under `agents/`, `skills/`, `workflows/`, `references/`,
  `templates/` regenerates that surface's entry in
  `cadence-core/bin/weight-budgets.json` in the SAME commit (check 4). The
  entries are exact byte counts; regenerate from
  `node cadence-core/bin/weight.mjs` output. A new prose file needs a new entry.
- Zero runtime dependencies, Node built-ins only, `// @ts-check` on every new
  `.mjs`, pure libs under `cadence-core/bin/lib/` with no fs/emit/process.
- Out of scope this phase: mechanical version-drift detection in `/cad-audit`
  and self-verify (phase 4, FRI-03 - D-24 forbids pulling it forward), a plugin
  `Stop` hook, a plugin MCP server, and a `PreToolUse` lease hook (D-01).

Every task verifies against the CI trio unless its Verify says otherwise:
`node --test cadence-core/bin/*.test.mjs`, `node cadence-core/bin/self-verify.mjs`,
`npx tsc -p tsconfig.ci.json`.

## Tasks

### Task 1: The trace spine - `lib/trace.mjs` and `planning.mjs trace`

- **Files:** `cadence-core/bin/lib/trace.mjs`, `cadence-core/bin/planning.mjs`,
  `cadence-core/bin/self-verify.mjs`, `cadence-core/bin/trace.test.mjs`,
  `.gitignore`
- **Action:** Create `lib/trace.mjs` as the one writer and one reader of
  `.planning/trace.jsonl`, exporting `correlationId(planningRoot, phase)`,
  `appendEvent(planningRoot, event)` and `renderTrace(planningRoot, phase?)`.
  One JSON object per line, keys in fixed order:
  `{corr, phase, ts, family, event, ...fields}` where `family` is one of
  `routing | provider | lifecycle | outcome` and `ts` is an ISO-8601 string.
  `correlationId` is DERIVED, never minted and stored (D-06): it is
  `<phase>-<sha>` where `<sha>` is the `sha` field of the NEWEST
  `lifecycle/phase_start` line whose `phase` matches, found by scanning the file
  from the end; with no such line it is `<phase>` alone, which still joins
  within a phase but not across re-runs (the fallback the CONTEXT assumption
  names). Every producer is a fresh one-shot process, so two concurrent
  producers in one phase MUST land on the same id - do not cache it in a file
  and do not use a counter, a pid or a random value. `appendEvent` uses
  `appendFileSync` and NOT `atomicWrite` (D-07): `atomicWrite` is
  write-tmp-plus-rename with no append mode, so a read-modify-write would lose
  events under batched parallel dispatch, which is the exact run the trace
  exists to explain. Enforce the size bound at WRITE time: `statSync` the file
  first and append nothing once it is at or over `MAX_TRACE_BYTES = 1048576`,
  returning `{written: false, reason: 'size-cap'}`. `appendEvent` NEVER throws
  and never writes to stdout or stderr - every fs call sits in its own try and a
  failure returns `{written: false, reason: <code>}`, because its callers'
  envelopes must not move. `renderTrace` reads the file in line order, skips a
  line that does not parse as JSON (counting it), groups by family, and pairs
  worker lifecycle events: a `dispatch` with a given `(phase, plan)` is paired by
  a later `return`, `checkpoint` OR `escalation` with the same `(phase, plan)`;
  unpaired dispatches come back in `unpaired[]`. All three are terminal for a
  worker - task 3 emits `escalation` as a terminal arm, so a renderer pairing
  only `return` and `checkpoint` would strand every escalated worker in
  `unpaired[]` and make AC3's empty-`unpaired` assertion unreachable. `plan` is the WORKER key, not strictly a
  plan number - a plan number for an executor on either execute path, and the
  role name for a role-dispatched worker (`cad-verifier`, task 4), so one pairing
  rule covers every bracketed worker rather than leaving role dispatches keyed on
  `undefined` and pairing with each other. Add the `trace` dispatch-table entry to
  `planning.mjs` with two sub-subcommands: `trace append --phase <N> --family <f>
  --event <e> [--plan <k>] [--sha <sha>] [--detail "<text>"]`, which is how prose
  writes the lifecycle and outcome families and how the orchestrator writes the
  `phase_start` anchor, and `trace render [--phase <N>]`, returning
  `{ok:true, file, corr, capped, counts:{routing,provider,lifecycle,outcome},
  events, unpaired}` with `capped` true when the file is at or over the bound so
  an incomplete record is never read as a complete one. An absent trace file is
  `ok:true` with empty events, never an error - the same never-blocks-the-spine
  contract `recall` follows. Register both in `self-verify.mjs` `CONTRACTS`
  under `planning.mjs` and add `trace` to `TWO_WORD`. Add
  `/.planning/trace.jsonl` to `.gitignore` beside the existing
  `/.planning/CAPTURE.md` line, with the same one-line reason. Write
  `cadence-core/bin/trace.test.mjs` covering: the derived id is identical for
  two calls in the same phase with an anchor and identical without one; the id
  changes when the anchor sha changes; appends survive an interleaved write
  sequence; a file at the bound accepts no further append and renders `capped`;
  an unwritable planning root returns `{written:false}` and throws nothing; and
  `renderTrace` reports an unpaired dispatch.
- **Verify:** `node --test cadence-core/bin/trace.test.mjs` passes; in a scratch
  dir, `node cadence-core/bin/planning.mjs --dir <d> trace append --phase 1
  --family lifecycle --event phase_start --sha abc1234` then `... trace append
  --phase 1 --family lifecycle --event dispatch --plan 1` then `... trace render
  --phase 1` prints one JSON line whose `corr` is `1-abc1234` on both events and
  whose `unpaired` names the dispatch; `node cadence-core/bin/self-verify.mjs`
  returns `ok:true`.

### Task 2: The two seam producers - routing and provider events

- **Files:** `cadence-core/bin/route.mjs`, `cadence-core/bin/review-provider.mjs`,
  `cadence-core/bin/route.test.mjs`, `cadence-core/bin/review-provider.test.mjs`
- **Action:** Wire both seams to `lib/trace.mjs`. In `route.mjs`, after the
  bundle is built and immediately before the final `out({ok:true, ...})`, append
  one `routing`/`resolve` event carrying `role`, `stakes`, `agent`, `model`,
  `effort`, `escalated`, `pinned`, `attempt`, the floor surfaces holding the
  level, and the COUNT of `warnings` (never the strings - the trace records the
  decision, the envelope carries the text). The planning root is
  `dirname(opts.file)`, the phase is `opts.phase` when it parses and
  `cursorPhase(dirname(opts.file))` otherwise, both of which the seam already
  computes. In `review-provider.mjs`, time each `request()` and append one
  `provider`/`request` event from `cmdReview`, `cmdConsult` and `cmdDetect`
  carrying `command`, `provider`, `model`, `effort`, `tier`, `duration_ms` and
  `outcome`; on the `fail()` paths `outcome` is the fail reason and the event
  also carries `degraded: true` plus a short `detail`, so the panel's actual
  composition is recorded whether or not the orchestrator relays the visible
  line `references/review-triggers.md` already mandates (D-18). `tier` is
  required by QW-02's "which reviewer, which tier" and the seam is never TOLD it:
  `review-triggers.md:128` has the caller resolve
  `model = review.providers.<name>.tiers[trigger.tier]` and pass only `--model`,
  so derive the tier by REVERSE LOOKUP - read
  `config.review.providers[provider].tiers` and take the tier key whose value
  equals the `--model` id. Do NOT try to reuse the `mergeLayers` reads at
  `:209`/`:231`: both sit inside memoized scalar helpers (`requestTimeoutMs()`
  `:205-215`, `maxPromptTokens()` `:227-237`) that cache a number and discard the
  config object. Add ONE new lazily-memoized
  `const { config, warnings } = mergeLayers(...)` read whose destructuring binds
  `warnings`, so it satisfies task 10's arm (a) at birth rather than arriving as
  an unrepaired callsite. This makes the tree's total ELEVEN callsites across
  eight files - task 10 counts it and lists it as already satisfied here. `null` when the map has no such value (a hand-passed model,
  or `detect-models`, which carries no model at all) - never a guess, and never a
  new `--tier` flag, which would change the CLI contract at every prose callsite. An empty
  findings set is `ok:true` with `outcome: "ok"` and NO `degraded` flag (D-22) -
  a reviewer that legitimately found nothing must not be recorded as a drop-out.
  The planning root for this seam is `.planning` relative to cwd and the phase
  comes from `cursorPhase('.planning')`. Wrap every append so that a trace
  failure cannot reach the caller: no new field, no new warning, no changed exit
  code, no output on any stream. Add a route.test case proving the envelope is
  byte-for-byte identical between a writable and an unwritable planning root -
  build the unwritable case by creating a tmp dir in which `.planning` is a
  REGULAR FILE and resolving with `--file <tmp>/.planning/config.json`, so the
  append fails ENOTDIR deterministically for any uid rather than depending on
  chmod semantics under a root test runner. Add the matching provider-side case.
- **Verify:** `node --test cadence-core/bin/route.test.mjs
  cadence-core/bin/review-provider.test.mjs` passes, including the
  byte-identical-envelope case; a manual `node cadence-core/bin/route.mjs
  resolve --role cad-executor --phase 1` in this repo followed by
  `node cadence-core/bin/planning.mjs trace render --phase 1` shows one
  `routing`/`resolve` event.

### Task 3: Orchestrator lifecycle brackets and the blocked-halt remedy in `execute.md`

- **Files:** `cadence-core/workflows/execute.md`,
  `cadence-core/bin/weight-budgets.json`
- **Action:** Two edits to `execute.md`, both orchestrator-side. First, the
  lifecycle family (D-08): at the `git_guard` step, where PHASE_START is
  recorded, also write the anchor with `planning.mjs trace append --phase <N>
  --family lifecycle --event phase_start --sha <PHASE_START>`; then bracket every
  worker on BOTH the sequential and parallel paths with `dispatch` before the
  dispatch and `return`, `checkpoint` or `escalation` after it, each carrying
  `--plan <k>`. State explicitly that a worktree executor emits NO trace events
  of its own and that inner tool-level detail is deliberately not captured: the
  trace file is gitignored so nothing a worktree writes can ride the merge back,
  and the executor's return is a frozen five-field digest. State that the trace
  is best-effort and that a failed `trace append` never changes the execute path.
  Second, criterion 6 (D-19, D-20): in `handle_checkpoint`, give the `blocked`
  arm a named orchestrator-side remedy for a halt naming a MISSING PLAN file -
  reconcile the worktree from the main tree in the orchestrator's own serialized
  turn (the executor contract is not touched; `<worktree_mode>` already forbids
  `git merge`, `rebase`, `fetch` and `stash` outright) and re-dispatch that plan
  once. After the remedy has failed twice, that plan falls back to the SEQUENTIAL
  path in the main tree - not a bounded re-dispatch loop, because every failure
  arm in `choose_path` already resolves to sequential and a retry loop here would
  reintroduce on the execute path the unbounded re-arm FRI-02 files against
  review triggers for phase 4. Say in the same paragraph that Cadence still
  issues no `git worktree add`. Regenerate the `cadence-core/workflows/execute.md`
  budget entry in this commit.
- **Verify:** `node cadence-core/bin/self-verify.mjs` returns `ok:true` (the
  budget entry matches, every `planning.mjs trace append` form matches the
  CONTRACTS row, and check 10's dispatch-phrasing rule still passes on the
  edited dispatch sentences); `grep -c "trace append" cadence-core/workflows/execute.md`
  is at least 4.

### Task 4: The outcome family and `/cad-progress --trace`

- **Files:** `cadence-core/references/review-triggers.md`,
  `cadence-core/workflows/verify.md`, `cadence-core/workflows/verify-deep.md`,
  `cadence-core/workflows/progress.md`,
  `skills/cad-progress/SKILL.md`, `cadence-core/bin/weight-budgets.json`
- **Action:** Close the fourth event family, the verification branch's lifecycle
  bracket, and the display. In `references/review-triggers.md`, at the point
  where an adjudicated trigger's survivor list is settled, append one
  `outcome`/`adjudication` event naming the trigger, the count acted on, and the
  reviewer set that ACTUALLY RAN. The voice list is load-bearing, not decoration:
  a `claude-subagent` voice never passes through `review-provider.mjs` and so has
  no provider event of its own, and criterion 9 fails a panel silently reduced to
  one voice while the gate reports clean - the survivor count alone cannot show
  that reduction, and the dropped cross-model voice is only half of it. In
  `workflows/verify.md`, at the `complete` step where `uat status` returns the
  session result, append one `outcome`/`uat_verdict` event naming the phase and
  the result. In `workflows/verify-deep.md`, bracket the cad-verifier dispatch
  with the SAME lifecycle events task 3 defines, keyed `--plan cad-verifier` (the
  worker key task 1's pairing rule takes): a `dispatch` event before the
  spawn-agent seam call in the `dispatch` step, a `return` event after a dispatch
  that reaches `merge`, and a `checkpoint` event carrying the one-line reason in
  the `fall_through` step, which is the single terminal failure arm both branches
  share. Without this the deep pass is the one verification branch criterion 3
  names that no event attributes, since `verify.md` only decides whether to run
  it. There is no verifier retry to bracket - a failed, empty or timed-out
  dispatch goes straight to `fall_through`. Phrase each of the three additions as
  a step instruction around the existing dispatch sentence rather than a second
  imperative dispatch verb, so check 10's dispatch-phrasing rule still passes. In
  `workflows/progress.md`, add `--trace` beside `--stats` in the `derive` step's
  `$ARGUMENTS` parse and give it its own read-only early branch that calls
  `planning.mjs trace render --phase <current>`, prints the four family counts
  plus any `unpaired` entries and any `capped` flag, and STOPS - it must not walk
  `reconcile`, which writes STATE.md (D-16, mirroring `--stats` exactly). Amend
  the progress guardrail that today says "--stats derives on demand" to name both
  flags and to state that the trace is written by the seams and by the execute
  and verify workflows, never by progress. Update `skills/cad-progress/SKILL.md`'s
  `argument-hint` and its one-line `--stats` sentence to name `--trace` too.
  Regenerate all five budget entries in this commit (`review-triggers.md`,
  `verify.md`, `verify-deep.md`, `progress.md`, `cad-progress/SKILL.md`).
- **Verify:** `node cadence-core/bin/self-verify.mjs` returns `ok:true`;
  `node cadence-core/bin/planning.mjs trace render --phase 1` in this repo
  returns `ok:true`; `git status --short .planning/STATE.md` is empty after a
  `--trace` render (nothing was written). Then the SYNTHETIC-PHASE proof of AC3's
  mechanism, which this phase's own run cannot supply (see Notes): in a scratch
  `--dir`, script one `trace append` per family in dispatch order - `lifecycle`
  `phase_start --sha abc1234`, `lifecycle dispatch --plan 1`, `routing resolve`,
  `provider request`, `lifecycle return --plan 1`, `lifecycle dispatch --plan
  cad-verifier`, `lifecycle checkpoint --plan cad-verifier`, `outcome
  adjudication`, `outcome uat_verdict` - then `trace render --phase 1` returns
  all four `counts` non-zero, ONE `corr` of `1-abc1234` across every event, and
  `unpaired` EMPTY (both dispatches paired, one by a `return` and one by a
  `checkpoint`). Re-run it with the `lifecycle return --plan 1` line removed and
  `unpaired` names plan 1 - the assertion is falsifiable, not a tautology.

### Task 5: The `LSP` tool grant on both `cad-executor` rungs

- **Files:** `cadence-core/bin/self-verify.mjs`, `agents/cad-executor.md`,
  `agents/cad-executor-xhigh.md`, `cadence-core/bin/weight-budgets.json`,
  `cadence-core/bin/self-verify.test.mjs`
- **Action:** Add `LSP` to `KNOWN_TOOLS` in `self-verify.mjs` and to the `tools:`
  line of BOTH `cad-executor` rung files. Both halves are required and neither is
  optional (D-14): the tools lint is one-directional - it flags
  referenced-but-undeclared only - so a token outside the fixed vocabulary is
  scanned by nothing at all, and "self-verify's tool lint passes with it" would
  otherwise be vacuously true. Add a `self-verify.test.mjs` case pinning that a
  fixture agent whose prose backticks `LSP` without declaring it reports
  `undeclared-tool`, so the vocabulary addition is proved to have teeth rather
  than merely to be present. Regenerate both rung-file budget entries in this
  commit. Add no behaviour to either rung file - check 7 fails a rung file that
  carries any.
- **Verify:** `node cadence-core/bin/self-verify.mjs` returns `ok:true`;
  `node --test cadence-core/bin/self-verify.test.mjs` passes;
  `grep -n "^tools:" agents/cad-executor.md agents/cad-executor-xhigh.md` shows
  `LSP` on both. Then human-verify: dispatch a `cad-executor` on this machine,
  which has no code-intelligence plugin installed, and confirm the dispatch
  completes normally rather than erroring on an unrecognized `tools:` entry - the
  executor cannot spawn agents (`<never>`), so this half is the user's
  observation. If the dispatch DOES error, both rung files revert and the grant
  is recorded as a refuted assumption.

### Task 6: `planning.mjs detect-commands` - the unconfigured static-analysis path

- **Files:** `cadence-core/bin/planning.mjs`, `cadence-core/bin/self-verify.mjs`,
  `cadence-core/bin/planning.test.mjs`
- **Action:** Add `detect-commands [--root <path>]` (default `process.cwd()`),
  returning `{ok:true, root, lint, typecheck, source, warnings?}` where `lint`
  and `typecheck` are shell strings or `null` and `source` names the manifest
  each came from. This is a SEAM and not executor judgment (D-04) because
  criterion 1 asserts behaviour "in a repo that configured nothing" and nothing
  in CI can prove a judgment fired; a seam is testable on fixture trees. Note
  that `--root` is the PROJECT root, not `.planning` - do not reuse `--dir`, which
  this script defines as the planning directory. First match wins per slot, in
  this declared order. lint: `package.json` `scripts.lint` -> `npm run lint`;
  `Cargo.toml` -> `cargo clippy --all-targets -- -D warnings`; `pyproject.toml`
  containing `[tool.ruff` -> `ruff check .`; `go.mod` -> `go vet ./...`; an
  `eslint.config.{js,mjs,cjs,ts}` or `.eslintrc*` -> `npx eslint .`. typecheck:
  `package.json` `scripts.typecheck` or `scripts["type-check"]` -> `npm run
  <that name>`; `tsconfig.json` -> `npx tsc --noEmit`; `Cargo.toml` ->
  `cargo check --all-targets`; `pyproject.toml` containing `[tool.mypy` ->
  `mypy .`; `go.mod` -> `go build ./...`. The typecheck rule matches
  `tsconfig.json` and that name ONLY - a non-default `tsconfig*.json` is
  deliberately not matched, because `npx tsc --noEmit` ignores a config it is not
  pointed at and guessing `-p` across several candidates would name a CI-only or
  editor-only project file as the project's typecheck. This repo is that case and
  is the fixture for it (its only TS config is `tsconfig.ci.json`, whose own
  `_comment` says it exists for the CI step). Detecting nothing is `ok:true` with
  both `null` - a successful check with a negative answer, like `plan-overlap` -
  never an error. An unreadable or malformed manifest contributes nothing and is
  named in `warnings[]` rather than throwing. The root is read one directory
  deep only: no recursive walk, no monorepo inference. Register
  `'detect-commands': ['--root']` in `self-verify.mjs` `CONTRACTS`. Add
  `planning.test.mjs` fixture-tree cases for each manifest above, for the
  script-beats-tool-config precedence, for the nothing-detected envelope, and
  for a malformed `package.json`.
- **Verify:** `node --test cadence-core/bin/planning.test.mjs` passes; on a
  scratch tree holding only `{"scripts":{"lint":"eslint ."}}` in `package.json`,
  `node cadence-core/bin/planning.mjs detect-commands --root <d>` prints
  `"lint":"npm run lint"` and `"typecheck":null`; on THIS repo
  `node cadence-core/bin/planning.mjs detect-commands --root .` prints
  `"lint":null` and `"typecheck":null` with `ok:true` - the nothing-detected
  envelope on a real tree, since the repo root carries no `package.json`, no
  `tsconfig.json`, no `Cargo.toml`/`pyproject.toml`/`go.mod` and no eslint
  config, and `tsconfig.ci.json` is out of the declared order by design. Cadence
  itself therefore takes the executor contract's arm (c) - states that no
  static-analysis command was found and skips - until a user sets
  `workflow.lint_command`, which no task in this plan does.
  `node cadence-core/bin/self-verify.mjs` returns `ok:true`.

### Task 7: `workflow.lint_command` across five surfaces, and the executor's static-analysis step

- **Files:** `cadence-core/config.schema.json`,
  `cadence-core/templates/config.json`, `cadence-core/workflows/config.md`,
  `cadence-core/references/config-reach.md`,
  `skills/cad-executor-contract/SKILL.md`, `cadence-core/bin/weight-budgets.json`,
  `cadence-core/bin/config.test.mjs`
- **Action:** One commit, all five surfaces (the key is inert and CI fails
  otherwise). `workflow.lint_command` is a single `string_or_null` defaulting to
  `null`, cloning `workflow.test_command`'s footprint verbatim (D-12). There is
  NO companion `workflow.typecheck_command`: the configured arm covers only what
  the user names while the detected arm of task 6 covers both, and the schema
  `purpose` and the reach row must SAY so rather than implying the key covers
  typecheck. Add the schema entry beside `workflow.test_command`, the
  `"lint_command": null` line to the template's `workflow` block, the catalog row
  to the `**Workflow**` section of `workflows/config.md` in that table's existing
  column shape, and the reach row to `references/config-reach.md` in schema-key
  order. The prose reader is the executor contract: add a Static analysis step to
  `<process>` between the current step 2 (verify) and step 3 (commit) that (a)
  runs `workflow.lint_command` when it is set, (b) otherwise runs
  `${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs detect-commands` ONCE per
  dispatch and runs the `lint` and `typecheck` it returns, (c) says so and skips
  when both are null, and (d) states when to prefer `LSP` diagnostics over a lint
  subprocess - when the change is confined to files the language server already
  has indexed and the diagnostics cover the same defect class, since that is a
  read of state the host already holds rather than a process spawn; fall back to
  the subprocess otherwise. A failure gets the same three bounded fix attempts
  as any other blocker, and surviving the third is a `blocked` checkpoint - NOT
  the existing "record it as an open item and move on" arm, because criterion 1
  requires that the executor not reach the commit step. Narrow the
  `<deviation_rules>` three-attempts bullet in place to state that carve-out
  (D-13) rather than leaving the two readings in tension. Add `config.test.mjs`
  cases for get/set/validate of the new key. Regenerate the contract's and the
  template's budget entries in this commit; keep the contract addition tight,
  since phase 2 is the context-reduction phase and every byte added here is
  charged to it.
- **Verify:** `node cadence-core/bin/self-verify.mjs` returns `ok:true` - which
  is the whole five-surface proof, since check 1b reports `inert-config-key` for
  a key no prose reads and check 9 reports a missing reach row;
  `node cadence-core/bin/config.mjs get workflow.lint_command` prints `null`;
  `node --test cadence-core/bin/config.test.mjs` passes. Then human-verify AC1's
  BEHAVIOURAL half, which no CI command can reach - the executor contract forbids
  spawning agents, so an executor cannot dispatch the executor this proves: (1)
  `mkdir` a scratch dir, `git init`, and write `package.json` holding
  `{"scripts":{"lint":"exit 1"}}` and nothing else - no `.planning/config.json`,
  so the repo has configured nothing; (2) write one source file with a trivial
  defect and run `/cad-task` there against a task that edits it; (3) expect the
  dispatch to report running `npm run lint` (found by `detect-commands`, not
  guessed), three bounded attempts, and a `blocked` checkpoint; (4) expect
  `git log --oneline` to show NO commit for that task. A commit at step 4 refutes
  D-13's carve-out and the `<deviation_rules>` narrowing is wrong.

### Task 8: `planning.mjs lease-check` and the executor's commit-step lease gate

- **Files:** `cadence-core/bin/planning.mjs`, `cadence-core/bin/self-verify.mjs`,
  `cadence-core/bin/planning.test.mjs`,
  `skills/cad-executor-contract/SKILL.md`, `cadence-core/bin/weight-budgets.json`
- **Action:** Add `lease-check --phase <N> --plan <k>` returning `ok:true` when
  every staged path is declared, and `ok:false` with
  `reason:"undeclared-files"` and the offending paths when it is not. Read the
  plan's declared list with `parsePlanFiles` - the SAME reader `cmdPlanOverlap`
  uses, so a path the pre-flight overlap gate admitted cannot be refused here
  and vice versa; `declaredPhaseFiles` is the wrong reader because it unions
  across the phase rather than per plan. Read the staged set from
  `git diff --cached --name-only` run at `git rev-parse --show-toplevel`, compare
  repo-relative paths for exact equality, and treat a declared path ending in `/`
  as a prefix. Exempt exactly one path, the plan's own
  `<plandir>/reports/plan-<k>.md`, and nothing else. A missing plan file is
  `ok:false, reason:"no-plan"`; a git call that fails is
  `ok:false, reason:"no-staged-set"` with the detail - an unprovable lease is
  never a pass. Register `'lease-check': ['--phase', '--plan']` in
  `CONTRACTS`. Then add the gate to the executor contract's
  `<commit_protocol>` as a new step immediately after the risk-surface gate and
  before the commit: run the seam, and on `ok:false` do NOT commit - stop and
  return a `blocked` checkpoint naming each undeclared path, exactly as the
  risk-surface gate returns its own checkpoint. State that the step is skipped
  when `<plandir>` is not `.planning/phases/<N>/`, because `/cad-task` dispatches
  from `.planning/tasks/<slug>/` where there is no phase lease to check. This is a
  seam and not a `PreToolUse` hook on `Write`/`Edit` (D-01): the hook would fire on
  every write in every project the plugin is installed in and cannot reliably
  resolve which plan is writing, since the branch name is the only signal and it
  is absent on the sequential path and on orchestrator writes. The seam form
  covers the sequential path too. Add `planning.test.mjs` cases for a clean
  lease, an undeclared staged path, the report-file exemption, a missing plan and
  an unreadable staged set. Regenerate the contract's budget entry.
- **Verify:** `node --test cadence-core/bin/planning.test.mjs` passes; in a
  scratch git repo whose `phases/1/PLAN.md` declares only `a.txt`, staging `b.txt`
  and running `node cadence-core/bin/planning.mjs --dir <d> lease-check --phase 1
  --plan 1` prints `"ok":false` naming `b.txt` and exits 1;
  `node cadence-core/bin/self-verify.mjs` returns `ok:true`.

### Task 9: The git-guard torn-config diagnostic, and CAPTURE.md:227 closed with tree evidence

- **Files:** `cadence-core/bin/git-guard.mjs`,
  `cadence-core/bin/git-guard.test.mjs`, `.planning/CAPTURE.md`
- **Action:** Take `warnings` off the `mergeLayers` call in `commitDecision` and
  act on it. When the repo config layer produced a parse warning, a `git commit`
  returns `ask` carrying that warning text in `permissionDecisionReason`,
  REGARDLESS of whether the current branch is in the defaulted
  `protected_branches` list (D-17). Keying it to a protected-branch hit would fire
  only when the user is on `main` and never in the case where their own custom
  list is the thing that was lost, which is the case worth catching. A warning
  still never produces a `deny`: the fail-open contract stated at
  `git-guard.mjs:23-24` stands, and a torn layer must not be able to block work.
  Order the rails so the push rail is unchanged and the torn-layer `ask` precedes
  the ordinary protected-branch decision. Add `git-guard.test.mjs` cases for: a
  torn config on a NON-protected branch returns `ask` naming the parse failure; a
  torn config on a protected branch returns `ask` once, not twice; a well-formed
  config on a non-protected branch still returns nothing; and `on_protected:
  allow` with a torn layer still returns the torn-layer `ask` rather than silence.
  In the same task, close the CAPTURE item at `.planning/CAPTURE.md:227` (the
  `[blocker]` O(K x N) overlapping-args reading in the hook) with tree evidence
  in phase 3's locked grammar: flip its box to `[x]` and append one sentence
  naming what closed it - `TOK-02` deleted `lib/destructive-git.mjs` and the
  quote-state tokenizer in v2.2.0, so the O(K x N) arg walk no longer exists -
  citing the repo-rooted file:line you confirmed it against and the date.
  Confirm before writing that the cited path is genuinely absent; do not close it
  because it reads as done. `.planning/CAPTURE.md` is gitignored
  (`.gitignore:22`), so this task's commit carries the two tracked files only.
- **Verify:** `node --test cadence-core/bin/git-guard.test.mjs` passes; piping
  `{"tool_input":{"command":"git commit -m x"},"cwd":"<d>"}` into
  `node cadence-core/bin/git-guard.mjs` where `<d>/.planning/config.json` holds
  `{` and HEAD is a non-protected branch prints `"permissionDecision":"ask"` with
  the parse failure in the reason; `grep -n "^- \[x\].*O(K x N)" .planning/CAPTURE.md`
  matches.

### Task 10: The `mergeLayers` warnings check over `cadence-core/bin/**.mjs`

- **Files:** `cadence-core/bin/lib/merge-warnings.mjs`,
  `cadence-core/bin/self-verify.mjs`, `cadence-core/bin/self-verify.test.mjs`,
  `cadence-core/bin/git-branch.mjs`, `cadence-core/bin/git-publish.mjs`,
  `cadence-core/bin/land-cleanup.mjs`, `cadence-core/bin/planning.mjs`,
  `cadence-core/bin/review-provider.mjs`, `.planning/CAPTURE.md`
- **Action:** Make criterion 4 mechanical rather than ten hand-written sentences
  (D-09), following `lib/route-relay.mjs`'s split exactly: the pure rule in a lib
  returning problem CODES, the disk half in `self-verify.mjs`. Create
  `lib/merge-warnings.mjs` exporting `CODE = 'undocumented-merge-warnings'` and
  `mergeWarningIssues(text)`. A CALLSITE is a `mergeLayers(` occurrence that is
  not the `import` line and not the definition. A file with at least one callsite
  is SATISFIED when either (a) the callsite's own destructuring binds `warnings`
  - matched on the `const {...} = mergeLayers(` form, which is exactly "surfaces
  the warning in its envelope" made checkable - or (b) the file's leading comment
  header carries a marker line matching `mergeLayers warnings[]:` followed by
  prose stating why the envelope is the surfacing. Otherwise the rule reports one
  issue per unsatisfied callsite, naming the 1-based line. A non-string input
  yields `[]`. In `self-verify.mjs`, add a NEW walker over `cadence-core/bin/**`
  yielding `.mjs` files and excluding `*.test.mjs` and `lib/config-merge.mjs`
  itself - `mdFiles` traverses only `.md` surfaces and cannot be reused - then
  file each returned code as a problem, add the check to the header comment list
  and to the `checked:` string. Then satisfy the rule at the SEVEN callsites this
  task owns: `git-branch.mjs:41`, `land-cleanup.mjs:72` and `:114`,
  `planning.mjs:1309`, `review-provider.mjs:209` and `:231`, `git-publish.mjs:78`.
  Prefer arm (a) where the value can genuinely ride an existing envelope, and use
  arm (b) - one header line stating why - where it cannot; `route.mjs:119` and
  `config.mjs:339` already satisfy arm (a) and must stay untouched. The eighth
  unsatisfied callsite, `git-guard.mjs:89`, is NOT edited here: task 9 repairs it
  with arm (a) as part of the torn-config diagnostic, which is why this task runs
  AFTER task 9 rather than beside it - landing the check first would report a
  callsite this task may not touch. Seven, plus that one, plus the two already
  clean, plus the one task 2 adds to `review-provider.mjs` for the tier reverse
  lookup (which binds `warnings` at birth and is therefore already satisfied), is
  ELEVEN callsites across EIGHT files, with `review-provider.mjs` carrying three
  and `land-cleanup.mjs` two. D-28 recorded ten against the pre-phase tree and
  stays accurate as the count this phase INHERITED; eleven is the count it leaves.
  Assert the total in a test as the
  two-arm split it actually is - eleven callsites over eight files, each one landing
  in arm (a) or arm (b) and none in neither - so a future callsite cannot be added
  without choosing an arm, and a miscount in either direction fails rather than
  passing quietly. Add `self-verify.test.mjs` cases for a fixture file with an
  undocumented callsite (reports), one with the destructured form (clean), one
  with the header marker (clean), and one where the marker sits in the body
  rather than the header (reports). In the same task, close the CAPTURE item at
  `.planning/CAPTURE.md:214` (a single markdown table row evaluable as an
  instruction) with tree evidence in the same grammar: re-confirm against the
  live tree that both sides are pinned by tests in `self-verify.test.mjs` and
  that the behaviour is the accepted cost recorded at `e9b05d4`, then flip the
  box and append the closing sentence with the repo-rooted `file:line` you
  verified and the date. `.planning/CAPTURE.md` is gitignored so the commit
  carries the tracked files only.
- **Verify:** `node cadence-core/bin/self-verify.mjs` returns `ok:true` with the
  new check named in `checked`; temporarily adding a bare `mergeLayers(x)` call
  to a scratch copy of a bin script under `--root` makes it report
  `undocumented-merge-warnings` naming that line;
  `node --test cadence-core/bin/self-verify.test.mjs` passes;
  `grep -c "mergeLayers" cadence-core/bin/*.mjs cadence-core/bin/lib/*.mjs`
  accounts for ELEVEN callsites across eight files - ten inherited plus the one
  task 2 added to `review-provider.mjs` for the tier reverse lookup. Ten here is
  a FAILURE: it means task 2's read was never added, or was added without binding
  `warnings`.

### Task 11: `phase_diff` resolves the same through all three surfaces

- **Files:** `cadence-core/route-table.json`, `cadence-core/config.schema.json`,
  `cadence-core/templates/config.json`, `cadence-core/bin/route.test.mjs`,
  `cadence-core/bin/weight-budgets.json`
- **Action:** Three surfaces decide `phase_diff` and they disagree today. Set the
  route table's `review.shipped.phase_diff` to `advisory` (critical stays
  `adjudicated`, solo stays `off`), set the schema default for
  `review.triggers.phase_diff.gate` to `advisory`, and DELETE the pre-written
  `review.triggers` block from `cadence-core/templates/config.json` entirely
  (D-02) - do not merely change `phase_diff` from `off` to `advisory` there. A
  written gate WINS over the level's and warns (`route.mjs:533-548`), so changing
  the value keeps the override and only makes it prettier: a scaffolded repo
  later switched to `stakes: critical` would still have `advisory` beating
  `critical`'s `adjudicated`, which is the exact thing this criterion exists to
  stop. Dropping the block lets the level decide and also closes the recorded
  three gate-disagreement warnings on every scaffolded resolve. Update the
  schema `purpose` text so it no longer describes the trigger as off by default.
  Add route.test cases: with a config carrying no `triggers` block,
  `resolve --role cad-executor` returns `phase_diff: "adjudicated"` at critical
  and `"advisory"` at shipped, and `warnings` carries NO gate-disagreement entry
  at either level. Regenerate the template's budget entry.
- **Verify:** `node --test cadence-core/bin/route.test.mjs` passes;
  `node -e 'JSON.parse(require("fs").readFileSync("cadence-core/templates/config.json"))'`
  succeeds and `grep -c triggers cadence-core/templates/config.json` is 0;
  a resolve against a copy of the template config prints
  `"phase_diff":"advisory"` with no gate-disagreement warning;
  `node cadence-core/bin/self-verify.mjs` returns `ok:true`.

### Task 12: A dependency lockfile stops matching the `concurrency` risk surface

- **Files:** `cadence-core/bin/lib/risk-surfaces.mjs`,
  `cadence-core/bin/risk-surfaces.test.mjs`, `cadence-core/bin/route.test.mjs`
- **Action:** Keep the `concurrency` surface's `lock` and `locks` patterns and
  add a BASENAME exclusion in `matchSurfaces`, applied before the token match, for
  a path whose basename is `*.lock` or `*-lock.json` (D-05). Removing the two
  patterns was the simpler data-only edit and is rejected: it trades a real
  detection away to close a false one, so `src/lock.rs`,
  `internal/lock/manager.go` and `db/locks.sql` would stop flooring with no test
  naming the loss. Excluding by basename names the lockfile class at the point it
  is excluded, and the exclusion belongs in the pure lib beside `pathTokens`,
  which is what splits `package-lock.json` into a `lock` token in the first place.
  Keep the function total and defensive: a non-string path is already filtered
  out upstream and must stay so. Add `risk-surfaces.test.mjs` cases for
  `package-lock.json`, `Cargo.lock`, `yarn.lock`, `poetry.lock` and `Gemfile.lock`
  matching nothing, and for `src/lock.rs`, `internal/lock/manager.go`,
  `db/locks.sql` and `src/locking.rs` still matching `concurrency`. Add route.test
  resolve-level cases proving the end state, and note that each lockfile needs its
  OWN fixture plan plus a separate `src/lock.rs` plan (D-21): `matchSurfaces`
  returns at most one match per surface - the first path that hits - so a single
  plan declaring all of them proves only the first.
- **Verify:** `node --test cadence-core/bin/risk-surfaces.test.mjs
  cadence-core/bin/route.test.mjs` passes; with `stakes: solo` and a phase plan
  declaring `package-lock.json`, `node cadence-core/bin/route.mjs resolve --role
  cad-executor --phase <N> --file <cfg>` prints `"stakes":"solo"`, and the same
  resolve against a plan declaring `src/lock.rs` prints `"stakes":"critical"`.

### Task 13: Fault injection across all six `review-provider.mjs` failure modes

- **Files:** `cadence-core/bin/review-provider.mjs`,
  `cadence-core/bin/review-provider.test.mjs`
- **Action:** Reach the failure modes through a test-only base-URL override
  following this repo's existing `CADENCE_*` precedent (D-11; `CADENCE_ROUTE_TABLE`,
  `CADENCE_GLOBAL_CONFIG`, `CADENCE_PLUGIN_MANIFEST`), because every failure mode
  lives past `https.request` and the three adapter base URLs are hardcoded.
  Extracting pure helpers and testing those is rejected: it proves what a helper
  returns, where the criterion says "what the caller sees". Add
  `CADENCE_PROVIDER_BASE`, which replaces `adapter.base` for whichever provider
  is invoked, with TWO rails, both load-bearing and both measured during planning
  (see Notes): the override is honoured ONLY when its URL hostname is a loopback
  literal (`127.0.0.1`, `::1`, `localhost`), and otherwise ignored with the
  hardcoded base standing, so no env var can ever redirect a keyed call off-box;
  and `request()` selects its transport from the resolved URL's protocol -
  `node:http` for `http:`, `node:https` otherwise - because `https.request` on an
  `http:` URL throws `ERR_INVALID_PROTOCOL` before a single byte moves. Keep
  every other byte of `request()` identical, timeout behaviour included. Then
  write a test per mode against a `node:http` stub bound to `127.0.0.1:0`, each
  driven through the existing `run()` helper so the assertion is on the ONE JSON
  line and the exit code the caller actually sees: request timeout (the stub
  accepts and never responds, with the child's cwd holding a
  `.planning/config.json` setting a small `review.request_timeout_ms`) ->
  `reason:"transport"`; HTTP 401 and HTTP 503 -> `reason:"http"` carrying that
  status; an unknown model id answered with the provider's own 404 body ->
  `reason:"http"` with 404; a 200 whose extracted text is truncated JSON ->
  `reason:"bad-json"`, and a 200 with no text at all -> `reason:"no-output"`; and
  an empty findings set -> `ok:true` with `findings: []`, which is NOT a
  degradation and must carry no `degraded` provider trace event (D-22). Assert in
  the timeout and HTTP cases that the provider trace event task 2 added names the
  reason. Correct the file header of `review-provider.test.mjs`, which today
  states the wire paths are "deliberately untested here - no network in the
  suite": this phase reverses that standing policy and says so in the same commit
  (D-10), stating that the suite now exercises the wire paths against a loopback
  stub and still makes no network call. Do not leave two stated policies with no
  reversal between them.
- **Verify:** `node --test cadence-core/bin/review-provider.test.mjs` passes with
  a named test per mode and completes in under ten seconds; running the suite
  with the network unavailable still passes (no test resolves a public hostname);
  `CADENCE_PROVIDER_BASE=https://evil.example node cadence-core/bin/review-provider.mjs
  detect-models --provider openai` still targets `api.openai.com` (the override is
  ignored for a non-loopback host); `npx tsc -p tsconfig.ci.json` prints no errors.

### Task 14: `git-branch.mjs decide` refuses a version the repo has already published

- **Files:** `cadence-core/bin/lib/branch-decision.mjs`,
  `cadence-core/bin/git-branch.mjs`,
  `cadence-core/bin/branch-decision.test.mjs`,
  `cadence-core/bin/git-branch.test.mjs`, `.planning/CAPTURE.md`
- **Action:** Compare the `PROJECT.md ### Active` milestone against the target
  repo's git TAGS (`git tag --list` at `--dir`), never against a manifest (D-03).
  "Already published" means a tag exists, which is language-agnostic and true in a
  project that is not Cadence, and the seam already shells out to git for the
  current branch; the only manifest reader in the tree reads Cadence's OWN
  `.claude-plugin/plugin.json`, which in any other project would compare a user's
  milestone against Cadence's version. `git-branch.mjs` reads the tag list,
  degrading to `[]` on any failure, selects the highest tag that parses as
  semver, and passes it to `decideBranch` as a new `publishedVersion` argument -
  `branch-decision.mjs` stays PURE and keeps running under `node --test` with no
  live git (D-23). Do the comparison with `compareVersions` imported from
  `lib/release-decision.mjs`, never a second semver reader: that module keeps one
  module-private `SEMVER_RE` explicitly so no second reader can drift from it.
  Strip the leading `v` from both sides before comparing - `compareVersions`
  rejects a leading `v` by design. In milestone mode on a protected base, when the
  derived integration name is `cadence/<v>` and `compareVersions(v,
  publishedVersion)` is `0` or `-1`, return
  `{action:'ask', branch:null, reason:<...>}` naming BOTH numbers and what to do
  (open the next milestone version, or confirm deliberately). A `null` comparison
  means "I cannot tell" and must leave every existing arm exactly as it is - never
  escalate to `ask` on an unprovable comparison. Every other arm - trunk mode, off
  a protected base, `off`, the naming-problem downgrade - is unchanged. Add
  `branch-decision.test.mjs` cases for equal, lower, higher, absent and
  unparseable published versions, and a `git-branch.test.mjs` case in a scratch
  repo whose `PROJECT.md ### Active` names a version an existing tag already
  carries. In the same task, record QW-04's remaining clause - `#87(a)` is
  ALREADY SHIPPED - as a closed `.planning/CAPTURE.md` item in D-27's grammar,
  one sentence citing the two arms that shipped it by repo-rooted `file:line`:
  `lib/release-decision.mjs:212-214` refuses a `downgrade` and `:216-218` refuses
  a `not-an-upgrade`, both reached through `decideManifestBump`. Confirm those
  line numbers against the live tree before writing them (this task imports
  `compareVersions` from that module already, so the file is open) and date the
  sentence. Recording it here rather than in a report is what makes phase 3 read
  it as closed by phase 1 instead of re-triaging it, and phase 4's FRI-03 - the
  MECHANICAL half of #87 - inherits the citation. `.planning/CAPTURE.md` is
  gitignored, so this task's commit carries the four tracked files only.
- **Verify:** `node --test cadence-core/bin/branch-decision.test.mjs
  cadence-core/bin/git-branch.test.mjs` passes, including the scratch-repo case
  AC8 names: a repo tagged `v0.1.0` and `v0.2.0` whose `PROJECT.md ### Active`
  names `v0.1.0` - a version `git tag --list` already carries - returns
  `{"action":"ask","branch":null}` with `0.1.0` and `0.2.0` both in the reason,
  under `git.auto_branch: auto` on `main`. Then the REGRESSION assertion on this
  repo: `node cadence-core/bin/git-branch.mjs decide --branch main` still prints
  `"action":"create"` with `"branch":"cadence/v2.5.0"`, in an envelope
  byte-identical to its output before this task, because `### Active` names `v2.5.0` (renumbered 2026-08-07)
  while the newest tag is `v2.4.0`, and `compareVersions('2.5.0','2.4.0')` is `1`.
  An `ask` here is a FAILURE, not the criterion: escalating a milestone that sorts
  ABOVE everything published is exactly the arm D-03 and AC8 do not ask for, and
  would make the guard refuse every legitimate new cycle. `grep -n "release-decision" .planning/CAPTURE.md`
  shows the closed `#87(a)` sentence with both arms cited.

### Task 15: The `/cad-health` drift rule, the verifier's traced-value level 3, and the bug-patterns checklist

- **Files:** `skills/cad-health/SKILL.md`,
  `skills/cad-verifier-contract/SKILL.md`,
  `cadence-core/references/bug-patterns.md`,
  `cadence-core/workflows/debug.md`, `cadence-core/bin/weight-budgets.json`
- **Action:** Three prose closures, one commit. (1) Add a seventh numbered check
  to `/cad-health`'s process: a `PROJECT.md ### Active` milestone version that
  does not sort ABOVE what the project has already shipped is an issue, reported
  with BOTH numbers named. The comparand is the newest release tag in the repo
  (`git tag --list`), plus a manifest version when the project ships one that
  names it; say which comparand answered. This rule is PROSE ONLY this phase
  (D-24) - mechanical detection in `/cad-audit` and self-verify is deliberately
  phase 4 (FRI-03) and must not be pulled forward, so do not add a seam call or a
  self-verify check here. (2) Modify level 3 (`Wired`) of the verifier contract's
  existing four-level ladder IN PLACE, adding the requirement that one real value
  is traced end to end across each seam on the goal path - not a fifth level
  (D-26); level 4 already carries the evidence vocabulary level 3 borrows, so
  reuse that wording rather than inventing a second one. (3) Create
  `cadence-core/references/bug-patterns.md`, a frequency-ordered checklist of bug
  patterns to consult before forming a first hypothesis, and have
  `workflows/debug.md` READ it by `${CLAUDE_PLUGIN_ROOT}` path at the top of the
  method loop's Hypothesize step, before the candidate list is written - a
  read-on-demand reference, never inlined (D-25): `debug.md` sits at 6510 B
  against a 6510 budget with zero headroom, and inlining would put it on phase 2's
  cut list one phase after it ships. Order the checklist by observed frequency and
  keep each entry to a pattern, its signature and the cheapest discriminating
  check. Add a NEW budget entry for `cadence-core/references/bug-patterns.md` and
  regenerate the other three in this commit.
- **Verify:** `node cadence-core/bin/self-verify.mjs` returns `ok:true` - which
  proves the new reference has a budget entry (`unbudgeted-surface`), that every
  edited surface is at or under its regenerated budget (`budget-overrun`), and
  that `debug.md`'s `${CLAUDE_PLUGIN_ROOT}` path to the new file resolves
  (`missing-path`); `grep -n "bug-patterns" cadence-core/workflows/debug.md` shows
  the read sitting before the Hypothesize candidate list;
  `grep -n "traced" skills/cad-verifier-contract/SKILL.md` shows the requirement
  inside level 3 with no level 5 added.

## Notes

**Plan shape deviates from the CONTEXT directive, deliberately.** CONTEXT's
`Plan shape` asks for multiple plans; this is one PLAN.md. The file-independence
test fails, and file independence is the hard constraint: `weight-budgets.json`
is regenerated by every prose-touching slice in the same commit (self-verify
check 4), so no two slices that both edit prose can be independent at all. On top
of that, `planning.mjs` gains three subcommands across three different criteria,
`self-verify.mjs` gains four CONTRACTS rows plus `KNOWN_TOOLS` plus a new walker
across four criteria, `config.schema.json` and `templates/config.json` are each
touched by two criteria (AC1's new key and AC6's gate defaults), and
`skills/cad-executor-contract/SKILL.md` is touched by AC1, AC5 and D-13. There
are also real cross-slice orderings: the contract cannot name
`detect-commands` before task 6 lands (check 2 reports `unknown-subcommand`), and
cannot backtick `LSP` before task 5 lands (the tools lint reports
`undeclared-tool`). Splitting anyway would produce plans `plan-overlap` refuses,
which /cad-execute answers by running them sequentially - the same execution
order this file already states, minus the guarantee. The size relief CONTEXT
wanted is available without the split: the executor rewrites
`reports/plan-1.md` after every task, so a `PLAN PARTIAL` return continues from
the next task with fresh context. Fifteen tasks is above the one-pass guideline,
so the intended RESUME BOUNDARY is after task 8: tasks 1-8 are the trace spine and
the two executor-contract additions, every one of which touches
`planning.mjs`/`self-verify.mjs`/the contract, and tasks 9-15 are seven closures
whose only cross-task ordering is 9 before 10. They are a cheaper resume point
than mid-cluster, NOT an independent set, and must not be reordered: tasks 10 and
13 both edit `review-provider.mjs`, 10 and 14 both edit `git-branch.mjs`, and 11
and 12 both edit `route.test.mjs`. A continuation that returns `PLAN PARTIAL`
at task 8 restarts on a clean seam rather than mid-cluster; returning earlier is
allowed and costs only re-reading the cluster's shared files.

**The flagged `node:https` assumption is resolved, measured during planning, not
deferred into task 13.** Measured on Node v26.4.0 in this working tree:
`https.request(new URL('http://127.0.0.1:<port>/...'), ...)` throws
`ERR_INVALID_PROTOCOL` synchronously, so D-11's env-var base override does NOT
work unmodified against a plain-HTTP stub. A loopback TLS stub DOES work with the
exact `https.request(url, {method, timeout, headers}, cb)` shape
`review-provider.mjs` already uses - a self-signed `CN=127.0.0.1` cert plus
`NODE_EXTRA_CA_CERTS` in the child env returned `200` - but it buys an `openssl`
dependency at test time or a checked-in private key, for a suite whose whole
premise is zero dependencies. Task 13 therefore keeps D-11's chosen env-var base
override and adds the smallest thing that makes it work: transport selection by
URL protocol, fenced to loopback hostnames. That is strictly less machinery than
the stated fallback (a replaceable module-level transport reference, a seam with
no precedent in this tree) and it leaves production behaviour byte-identical,
since all three adapter bases are `https:` and a non-loopback override is
ignored.

**Three criteria close outside the executor's reach and belong to /cad-verify's
walk.** AC2's "a `cad-executor` dispatch completes normally on this machine" is
written as a human-verify step in task 5 because the executor contract forbids
spawning agents. AC1's behavioural half - "an executor given a task whose edit
fails it produces a `blocked` checkpoint with no commit for that task" - is the
same shape and is written as a human-verify step in task 7, with the fixture
spelled out there. AC3's "a completed phase leaves `.planning/trace.jsonl`
holding all four event families under one correlation id, every worker dispatch
paired to its return or checkpoint" splits in two, and THIS PHASE'S OWN RUN
CANNOT SUPPLY THE SECOND HALF: `execute.md`'s bracketing prose and the
`planning.mjs trace` subcommand do not exist until tasks 1 and 3 commit, the
orchestrator already loaded `execute.md` at the start of this run, and the early
`route.mjs` resolves predate task 2, so a `trace.jsonl` written during phase 1 is
structurally partial no matter how the tasks go. The mechanism half is therefore
proved synthetically inside the phase - task 4's Verify scripts all four families
plus a paired dispatch/return and a paired dispatch/checkpoint through the real
`trace append` and `trace render`, with a falsifying re-run. The real-run half is
a UAT item deferred to the NEXT `/cad-execute` (phase 2's), where every producer
exists before the run starts: it passes when that phase's `.planning/trace.jsonl`
carries all four families under one `corr` and `trace render` returns an empty
`unpaired`. Recording it as deferred is the point - asserting this phase's own
run supplies it would produce a pass nothing measured.

**Recalled prior art.** `.planning/CAPTURE.md` phase 2 records that
`references/review-triggers.md` finished with ~29 B of headroom against its
budget; task 4 adds one trace line there and must regenerate that entry rather
than assume room exists. The same file records `pre_ship` being unreachable at
milestone scale, which is why task 13's provider fault injection asserts on the
seam's own envelope and its trace event rather than on any gate outcome.
