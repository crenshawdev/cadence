# Phase 6: The boundary and the execute slice - Falsification

Gathered: 2026-09-07
Against: repository at `c8a266d8`, phase 5 closed at `5c92bfff`

## Method

This pass opened every bullet under `## Must be true when done` and every
`**Verify:**` clause in both plans. `FALSE` means the current code has contrary
behavior or no production path capable of the criterion. `UNVERIFIABLE` means
the claim depends on the future diff or an actual host/model observation and
cannot be established from the current tree. A future test name, plan sentence
or model return is never counted as evidence. No Cargo, Node or live-host test
was run during planning.

Result before implementation: 24 criteria are FALSE and 3 are UNVERIFIABLE.
That is expected for a phase plan, but the reasons expose whether each check can
actually become evidence and whether the plan assumed machinery that is not
there.

## Must be true when done

### PLAN-1

- **P1-M1 - FALSE** (`.planning/phases/6/PLAN-1.md:49-51`). There is no
  execution-plan domain: the library exports only derivation, evidence,
  next_action, pause and store (`crates/cadence/src/lib.rs:1-5`). The only phase
  number parser in this path preserves legacy binary64 compatibility and accepts
  a decimal component (`crates/cadence/src/derivation/parse.rs:80-120`); it does
  not read stable task IDs, verify commands, suite commands or PLAN bodies.

- **P1-M2 - FALSE** (`.planning/phases/6/PLAN-1.md:52-56`). The snapshot exposes
  generic `serde_json::Value` data and a global generation
  (`crates/cadence/src/store/model.rs:88-97`), and the writer accepts generic
  snapshot/transaction operations (`crates/cadence/src/store/writer.rs:17-34`).
  No active-dispatch, execution-subtree version, executor-patch or scoped merge
  type exists.

- **P1-M3 - FALSE** (`.planning/phases/6/PLAN-1.md:57-60`). Current mutations
  render only items, decisions and state (`crates/cadence/src/store/writer.rs:306-333`).
  External participants are limited to repo/global config
  (`crates/cadence/src/store/writer.rs:317-326`), and the filesystem rejects an
  unregistered multi-component phase-summary target
  (`crates/cadence/src/store/filesystem.rs:95-123`). It cannot confirm SUMMARY
  in the owner transaction today.

- **P1-M4 - FALSE** (`.planning/phases/6/PLAN-1.md:61-64`). The resident request
  enum has Pause, NextAction, Evidence, Lifecycle, Store and Recall only
  (`crates/cadence/src/recall/mod.rs:201-232`). There is no dispatch to persist,
  no execution reply to lose and no summary render to repair after restart.

- **P1-M5 - FALSE** (`.planning/phases/6/PLAN-1.md:65-67`). The decision model
  has only Routing, Gate and Refusal variants and no occurrence counter,
  request/response digest or terminal replay record
  (`crates/cadence/src/store/model.rs:57-86`). The current writer has no log-bound
  operation (`crates/cadence/src/store/writer.rs:17-34`).

- **P1-M6 - FALSE** (`.planning/phases/6/PLAN-1.md:68-70`). The CLI exposes only
  `serve` (`crates/cadence/src/main.rs:18-29`). The committed PreToolUse matcher
  covers Bash, not Write/Edit, and calls Node
  (`hooks/hooks.json:3-12`); there is no Rust hook parser or ownership denial.

- **P1-M7 - UNVERIFIABLE** (`.planning/phases/6/PLAN-1.md:71-72`). The current
  baseline does have only one public tool
  (`crates/cadence/tests/mcp.rs:153-170`) and phase 5 reports its deterministic
  suites green (`.planning/phases/5/SUMMARY.md:138-142`), but a promise that those
  behaviors remain unchanged can only be checked after PLAN-1's broad store,
  resident and server edits. The code does not provide prospective regression
  evidence.

### PLAN-2

- **P2-M1 - FALSE** (`.planning/phases/6/PLAN-2.md:34-37`). The macro router
  declares only `cadence_version` and its handler accepts no arguments
  (`crates/cadence/src/server.rs:144-185`). The raw stdio test asserts a
  one-element tool list (`crates/cadence/tests/mcp.rs:153-170`); there is no
  malformed phase-6 call or decision to inspect.

- **P2-M2 - FALSE** (`.planning/phases/6/PLAN-2.md:38-41`). Internal methods can
  call pause, next-action, evidence, lifecycle, store and recall
  (`crates/cadence/src/server.rs:78-141`), but none is publicly registered. The
  only public outcome is the version `ok` envelope
  (`crates/cadence/src/server.rs:162-184`), so no dispatch, completion or
  judgment result crosses MCP.

- **P2-M3 - FALSE** (`.planning/phases/6/PLAN-2.md:42-46`). `/cad-execute`
  currently grants Read, Write, Edit, Bash, Grep, Glob, AskUserQuestion and Task
  and imports the frozen JavaScript workflow
  (`skills/cad-execute/SKILL.md:5-29`). It neither names a Cadence MCP tool nor
  implements the five-step patch loop.

- **P2-M4 - FALSE** (`.planning/phases/6/PLAN-2.md:47-50`). The executor contract
  currently rotates and rewrites a report after every task
  (`skills/cad-executor-contract/SKILL.md:242-284`) and returns a five-field text
  digest (`skills/cad-executor-contract/SKILL.md:286-310`). The CLI has no guard
  (`crates/cadence/src/main.rs:18-29`), so a host cannot receive the planned Rust
  denial.

- **P2-M5 - FALSE** (`.planning/phases/6/PLAN-2.md:51-53`). The raw protocol
  suite covers initialize, version listing/call and clean stdin closure only
  (`crates/cadence/tests/mcp.rs:139-206`). It never starts an execution call,
  restarts an outstanding dispatch or sends a patch.

- **P2-M6 - UNVERIFIABLE** (`.planning/phases/6/PLAN-2.md:54-57`). A real host
  and executor are intentionally outside deterministic test authority
  (`.planning/ROADMAP.md:176-183`). The current public server cannot dispatch
  either one because it exposes version alone
  (`crates/cadence/src/server.rs:144-185`). This criterion needs the live UAT
  after both plans; source inspection cannot substitute.

- **P2-M7 - FALSE** (`.planning/phases/6/PLAN-2.md:58-60`). The target
  three-tool surface does not exist (`crates/cadence/tests/mcp.rs:153-170`), and
  every committed hook command still launches a `.mjs` file through Node
  (`hooks/hooks.json:1-38`). The desired absence of a newly added shim is a
  future diff check, but the whole bullet is false because its public-surface
  premise is false now.

## Verify clauses

### PLAN-1

- **P1-V1 - FALSE** (`.planning/phases/6/PLAN-1.md:93`). There is no
  `execution::plan` test module or source module
  (`crates/cadence/src/lib.rs:1-5`), and the dependency list has no YAML
  deserializer (`crates/cadence/Cargo.toml:21-55`). Current derivation parses
  ROADMAP phase declarations, not native PLAN frontmatter
  (`crates/cadence/src/derivation/parse.rs:80-131`).

- **P1-V2 - FALSE** (`.planning/phases/6/PLAN-1.md:99`). There is no
  `execution::patch` test target because no execution module is registered
  (`crates/cadence/src/lib.rs:1-5`). Current validation can validate generic
  store records/snapshots, but its snapshot payload remains an untyped JSON
  value (`crates/cadence/src/store/model.rs:88-97`); it cannot exercise any
  patch-key or task-order case.

- **P1-V3 - FALSE** (`.planning/phases/6/PLAN-1.md:105`). No
  `execution_store.rs` target exists in the current test surface, and the writer
  rejects every external participant except the two config names
  (`crates/cadence/src/store/writer.rs:317-326`). Persisted intents likewise
  allow only the three store files and two config targets
  (`crates/cadence/src/store/transaction.rs:64-92`), so SUMMARY recovery and the
  257th boundary transition are impossible now.

- **P1-V4 - FALSE** (`.planning/phases/6/PLAN-1.md:111`). No production
  execution request exists in the resident (`crates/cadence/src/recall/mod.rs:201-232`),
  and the current next-action service returns only an `Option<Action>` after
  observing lifecycle/config (`crates/cadence/src/next_action_service.rs:209-258`).
  It does not parse a plan, inspect task commits, create a dispatch or return a
  completion patch outcome.

- **P1-V5 - FALSE** (`.planning/phases/6/PLAN-1.md:117`). There are no
  execution restart barriers or execution child commands in the resident
  request family (`crates/cadence/src/recall/mod.rs:201-232`). The transaction
  recovery loop can repair its current fixed participants
  (`crates/cadence/src/store/transaction.rs:202-234`), but there is no SUMMARY
  participant or dispatch identity for this clause to assert.

- **P1-V6 - FALSE** (`.planning/phases/6/PLAN-1.md:123`). The compiled command
  enum has only Serve (`crates/cadence/src/main.rs:18-29`). Current hook JSON
  calls JavaScript and has no Write/Edit matcher
  (`hooks/hooks.json:3-12`), so no compiled guard input/output case can run.

- **P1-V7 - FALSE** (`.planning/phases/6/PLAN-1.md:129`). The phase-6 inventory
  modules and integration target do not exist (`crates/cadence/src/lib.rs:1-5`).
  The one-tool MCP assertion is present and is the correct PLAN-1 baseline
  (`crates/cadence/tests/mcp.rs:153-170`), but passing today's suite would not
  execute any of AC2, AC4, AC5, AC6, AC7 or AC8.

### PLAN-2

- **P2-V1 - FALSE** (`.planning/phases/6/PLAN-2.md:83`). Current `tools/list`
  returns one name and tests only that tool's output schema
  (`crates/cadence/tests/mcp.rs:153-170`). No query discriminator, patch schema,
  missing-key matrix or transport-versus-Cadence negative control exists.

- **P2-V2 - FALSE** (`.planning/phases/6/PLAN-2.md:89`). No public execution
  handler exists (`crates/cadence/src/server.rs:144-185`) and `Decision` has no
  boundary request/response digest shape
  (`crates/cadence/src/store/model.rs:57-86`). The current wire suite cannot
  produce or inspect any of the named outcomes.

- **P2-V3 - FALSE** (`.planning/phases/6/PLAN-2.md:95`). The current skill has an
  eight-tool local allowlist and a `.mjs` include
  (`skills/cad-execute/SKILL.md:5-29`), while the executor contract contains
  report paths, report rotation, worktree behavior and a text digest
  (`skills/cad-executor-contract/SKILL.md:233-310`). It fails the planned
  structural absence checks before any model runs.

- **P2-V4 - FALSE** (`.planning/phases/6/PLAN-2.md:101`). The stdio test file
  ends with the clean-stdin test and contains no execute/restart case
  (`crates/cadence/tests/mcp.rs:199-206`). Its tool caller can call arbitrary
  names, but the server declares only version
  (`crates/cadence/src/server.rs:162-184`), so no valid or invalid executor patch
  can advance a fixture.

- **P2-V5 - UNVERIFIABLE** (`.planning/phases/6/PLAN-2.md:107`). Host version,
  credentials, signing access, model tool calls, actual hook denials and process
  replacement are runtime observations, not facts in the current source. The
  roadmap explicitly requires live usage rather than a mock for this half
  (`.planning/ROADMAP.md:176-187`), and current MCP reachability is version-only
  (`.planning/phases/5/SUMMARY.md:122-124`). UAT must stay unverified until run.

- **P2-V6 - FALSE** (`.planning/phases/6/PLAN-2.md:113`). Baseline suite and
  frozen-tree checks may pass, but the acceptance map, three-tool boundary and
  UAT evidence named by this compound clause do not exist. The current MCP test
  positively asserts one tool (`crates/cadence/tests/mcp.rs:153-170`), and the
  current skill still routes into JavaScript
  (`skills/cad-execute/SKILL.md:24-29`); a green present-day suite cannot close
  the planned phase.

## Corrections made after falsification

- **Bound root before argument parsing.** The draft put project root inside
  `execute-next`, which made a missing-root malformed call impossible to record
  in any project decisions log. Current public construction has no root at all
  (`crates/cadence/src/server.rs:144-160`). CONTEXT D-17 and PLAN-2 Task 1 now
  bind one root at `serve` startup and keep repository selection out of tool
  arguments (`.planning/phases/6/CONTEXT.md:88-100`;
  `.planning/phases/6/PLAN-2.md:81-83`). This also keeps the apply tool's schema
  equal to the role patch rather than a root-plus-patch wrapper.

- **Separate execution version from store generation.** The draft used the
  global snapshot generation as the patch precondition. Every refusal or repeat
  query also writes a decision, and every current mutation increments that
  generation (`crates/cadence/src/store/writer.rs:306-315`), so the audit log
  would invalidate the outstanding patch it described. D-19/D-20 and PLAN-1
  Tasks 2/4 now use a monotonic execution-subtree version for model-visible
  expected-version checks; the writer still uses fresh global generation and
  integrity internally (`.planning/phases/6/CONTEXT.md:119-149`;
  `.planning/phases/6/PLAN-1.md:97-111`).

- **Respect the transaction's final semantic participant.** The draft proposed
  a crash after state installation but before SUMMARY confirmation. Current
  external participants are installed before items/decisions/state
  (`crates/cadence/src/store/writer.rs:317-333`), and the transaction explicitly
  treats snapshot as final semantic completion
  (`crates/cadence/src/store/transaction.rs:184-199`). D-21 and PLAN-1 Task 5
  now put the derived SUMMARY before final state and kill between SUMMARY and
  state confirmation (`.planning/phases/6/CONTEXT.md:161-179`;
  `.planning/phases/6/PLAN-1.md:113-117`).

- **Make blocked patches representable.** The draft required a commit and passed
  verification for every task row while also requiring blockers. Those states
  cannot coexist for the blocked task. D-19 and PLAN-1 Task 2 now define
  completed, blocked and not-run row invariants and require an explicit full
  task set without fabricating commits (`.planning/phases/6/CONTEXT.md:119-138`;
  `.planning/phases/6/PLAN-1.md:95-99`).

- **Give the full suite an authoritative source.** The draft told the executor
  to run a suite command that no schema supplied. Current configuration lookup
  exists only in the old executor workflow, including a JavaScript fallback
  (`skills/cad-executor-contract/SKILL.md:92-112`). D-18 and PLAN-1 Task 1 now
  make one full-suite command native frontmatter data alongside per-task verify
  commands (`.planning/phases/6/CONTEXT.md:102-117`;
  `.planning/phases/6/PLAN-1.md:89-93`). Fixed configuration stays a reported
  phase-6 stub.

- **Do not ask an answer the boundary cannot persist.** The draft left
  AskUserQuestion in `/cad-execute` even though this three-tool slice has no
  answer-submission operation. Phase 5 requires an answer to be persisted before
  continuation relies on it (`.planning/phases/5/CONTEXT.md:183-194`). PLAN-2
  Task 3 now has exactly query, apply and Task permissions, reports a judgment
  stop, and explicitly defers the operator-answer round trip
  (`.planning/phases/6/PLAN-2.md:91-95`).

- **Keep Task transport structural, not byte-fictional.** The draft said the
  skill submits the executor return "unchanged", but a Task return is host text
  and the next MCP call is a JSON object. D-24 and PLAN-2 now require a
  field-for-field normalized JSON transfer without interpreting judgment fields,
  which is falsifiable at the apply request
  (`.planning/phases/6/CONTEXT.md:208-224`;
  `.planning/phases/6/PLAN-2.md:42-46` and
  `.planning/phases/6/PLAN-2.md:91-95`).

- **Do not let the UAT accidentally prove the JavaScript path.** Loading the
  repository plugin would also load three Node hook commands
  (`hooks/hooks.json:1-38`). PLAN-2 Task 5 now uses byte-checked temporary copies
  of the landed markdown/agent files, isolated MCP/settings files, and direct
  invocations of the built Rust binary; it does not load the plugin or add a
  wrapper (`.planning/phases/6/PLAN-2.md:103-107` and
  `.planning/phases/6/PLAN-2.md:125-128`).

- **Resolve stale storage names and the finite-log collision openly.** The
  architecture still says `trace.jsonl` and `STATE.md`, but the native store
  constants are `decisions.jsonl` and `state.json`
  (`crates/cadence/src/store/model.rs:8-11`). The corrected plans use the native
  names and a persisted 257th terminal refusal replayed thereafter. CONTEXT
  flags both premise mismatches rather than claiming every repeated wire call
  can append forever (`.planning/phases/6/CONTEXT.md:299-320` and
  `.planning/phases/6/CONTEXT.md:363-373`).

## Remaining knowingly unproved claims

- The real model may fail to follow the executor patch contract, run the named
  commands or make the required commits. Only PLAN-2's live UAT can observe that;
  deterministic tests prove the refusal/recovery behavior around it, not model
  compliance.
- Tool survival across compaction remains causally unproved because the recorded
  host calls never-loaded tools too (`.planning/ROADMAP.md:274-282`). The plans
  make no product behavior depend on that observation.
- Phase 6 observes commit paths but does not enforce the source lease. That
  obligation is explicitly assigned to phase 11
  (`.planning/ROADMAP.md:840-846`), so this slice cannot be cited as proving it.
- Installed plugin MCP and hook paths remain phase 18 work
  (`.planning/ROADMAP.md:1058-1070`). The temporary UAT configuration proves the
  boundary, not release installation.
