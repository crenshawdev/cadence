---
phase: 6
plan: 2
requirements:
  - AC1
  - AC2
  - AC3
  - AC4
  - AC5
  - AC6
  - AC7
  - AC8
files:
  - crates/cadence/src/server.rs
  - crates/cadence/src/main.rs
  - crates/cadence/tests/mcp.rs
  - skills/cad-execute/SKILL.md
  - skills/cad-executor-contract/SKILL.md
  - agents/cad-executor.md
  - .planning/phases/6/UAT.md
---

# Phase 6: The boundary and the execute slice - Plan 2

## Goal

Expose PLAN-1 through a three-tool typed MCP boundary, reduce `/cad-execute` to
the five-step direct-tool loop, and prove the slice through an actual host and
executor. Deterministic protocol tests and live model observations remain
separate, and neither uses JavaScript or a shell fallback to Cadence.

## Must be true when done

- AC1: `tools/list` exposes exactly three grouped tools with accurate input and
  output schemas. Every malformed arguments object sent to a declared phase-6
  tool reaches Cadence and returns a successful typed refusal with a durable
  decision, never rmcp's parameter error.
- AC2/AC4/AC5: Public query and apply calls use PLAN-1's production resident,
  derivation, Git checks and writer. Their envelopes distinguish dispatch,
  completion, judgment stop, refusal, unknown and not-applicable without a
  second state machine at the boundary.
- AC3: `/cad-execute` is markdown that directly asks, dispatches the returned
  prompt, submits the returned patch field-for-field without interpreting its
  judgment fields and repeats. It has no local
  filesystem or shell tools and no JavaScript, report, replay, Git, plan-parser
  or SUMMARY-writing path.
- AC3/AC7: The fixed executor changes project source, invokes the dispatched
  verification commands, makes the required task commits and returns exactly
  the advertised patch. It cannot author reports or Cadence state, and actual
  protected Write/Edit attempts are denied by the Rust guard.
- AC6: Raw stdio MCP tests cross a real child-process boundary and prove
  outstanding-dispatch identity before and after server restart; accepted and
  refused patches preserve the same behavior over the wire as in-process.
- AC3/AC7/AC8: A recorded live UAT uses a real host, real stdio server and real
  executor. It asserts orchestration shape only, identifies every stub and
  untestable observation, and does not turn model-produced content or an
  inconclusive compaction probe into a pass.
- The public surface remains three tools, no ToolSearch preamble is added, no
  `.mcp.json` or production hook path is installed early, and no JavaScript or
  redirect script is created.

## Context

Phase 6 CONTEXT D-15, D-16 and D-24 through D-26 bind this plan. The current
wire test expects only `cadence_version` (`crates/cadence/tests/mcp.rs:153-170`),
the current skill imports the frozen JavaScript executor workflow
(`skills/cad-execute/SKILL.md:24-29`), and the current executor writes reports
and returns a five-field digest (`skills/cad-executor-contract/SKILL.md:242-310`).
All three are deliberately replaced for this slice.

Run after PLAN-1. Both plans edit `crates/cadence/src/server.rs` and
`crates/cadence/src/main.rs`; PLAN-2 must adapt the landed service and guard
interfaces rather than inventing parallel ones. The live UAT uses temporary
host settings and MCP configuration outside the repository because installed
release wiring belongs to phase 18.

## Tasks

### Task 1: Publish three schemas while keeping validation inside Cadence

- **Files:** `crates/cadence/src/server.rs`, `crates/cadence/src/main.rs`, `crates/cadence/tests/mcp.rs`
- **Action:** Replace the macro-only router with an explicit rmcp `ServerHandler` tool listing and raw call dispatch. Bind the public server once to the normalized project root supplied to `cadence serve --project-root <path>`, with current-working-directory discovery only when the option is omitted; tool arguments never select arbitrary repositories. List exactly `cadence_version`, `cadence_query` and `cadence_apply`. `cadence_version` keeps an empty-object input schema and its existing envelope output. `cadence_query` advertises a discriminated operation union whose phase-6 member is `{operation: "execute-next", phase: positive integer}`. `cadence_apply` advertises PLAN-1's exact discriminated executor-patch schema at its top level, not a string, generic map or nested report blob. Generate schemas from the same types Cadence deserializes, but receive `CallToolRequestParams.arguments` as a raw optional JSON object and invoke deserialization inside the named handler. Reject absent/extra/wrong-type/unknown-tag/schema-version fields with `Envelope::Refused`; do not use `Parameters<T>` or a macro path that deserializes before the handler. Calls to undeclared names and syntactically invalid JSON-RPC remain protocol errors and are not mislabeled Cadence refusals.
- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test mcp tool_schemas` handshakes with the real stdio child, asserts the exact three names and schemas, and validates the schemas contain the query discriminator and complete executor patch fields without permitting a free-form object. For every declared phase-6 tool it sends omitted arguments and an object with each required key missing, extra, wrong-typed or unknown-tagged in turn; every response has `isError` absent/false and identical `status/code/reason` in structured content and mirrored text. A transport-invalid frame and unknown tool remain JSON-RPC errors, proving the test distinguishes the two layers. Removing the internal raw dispatch must make at least one malformed-object case fail.

### Task 2: Route every public execution answer through the resident and audit log

- **Files:** `crates/cadence/src/server.rs`, `crates/cadence/tests/mcp.rs`
- **Action:** Map validated `execute-next` and executor-patch calls directly onto PLAN-1's resident requests and map their typed outcomes into the shared envelope vocabulary without recomputing selection, patch validity or state. For a malformed arguments object, build the refusal through the bound root's execution service so its decision is confirmed before the call returns. For valid calls, confirm the matching boundary decision before returning dispatch, complete, blocked, refused, unknown or not-applicable. Include compact identifiers and reasons in envelopes; keep prompt/body only in dispatch success and keep all responses bounded. Preserve `cadence_version` as a side-effect-free diagnostic and do not pretend it is an execution decision. Map internal changed-input, lifecycle conflict, store conflict, Git validation and log-bound outcomes to stable public codes without leaking localized I/O strings. A refusal-decision write failure is a non-successful server failure because Cadence cannot claim a recorded refusal it did not persist.
- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test mcp execution_calls` starts the production child against external strict fixtures and drives successful dispatch, blocked stop, completion, malformed patch, wrong scope, stale version, changed plan/Git, store failure and log-bound replay over JSON-RPC. After each response an independent store reader finds exactly its semantic decision and matching response digest. Refused patch cases compare execution namespace and SUMMARY bytes before/after while allowing decision metadata to advance. Injected refusal-log failure cannot return a recorded `refused` envelope. Response-size assertions exclude the prompt-bearing dispatch and set explicit maximums for every other arm.

### Task 3: Replace reports with the stateless skill and patch-return contract

- **Files:** `skills/cad-execute/SKILL.md`, `skills/cad-executor-contract/SKILL.md`, `agents/cad-executor.md`
- **Action:** Rewrite `/cad-execute` as the literal five-step loop. Its allowed tools are only `mcp__cadence__cadence_query`, `mcp__cadence__cadence_apply` and `Task`. Pass the user's phase spelling unchanged to query so the binary owns validation. On dispatch, invoke only the fixed `cad-executor` with exactly the returned prompt; do not read the plan or inspect state. Submit the executor's JSON object field-for-field to apply without classifying its judgment text. On a refused/unknown/not-applicable/judgment outcome, display the structured reason and stop; on dispatch or completion, continue as the envelope directs. This strict slice has no operator-answer round trip. Add no ToolSearch preamble and name no `cadence` CLI, Bash command or JavaScript path. Rewrite the preloaded executor contract to consume only the binary prompt, work tasks in the given order, invoke each given verification command and the supplied suite command, create one signed conventional commit per completed task with its stable task ID in the subject, and return exactly one JSON executor patch. Use completed/blocked/not-run task rows as typed; never create/rotate/read a report or write `.planning/` state/SUMMARY/ROADMAP. Remove worktree, configuration detection, review and report rules from this strict contract, recording their fixed disabled values from the dispatch instead. Update only the fixed `cad-executor` agent's stale JavaScript-routing description; later rungs remain out of scope.
- **Verify:** A markdown contract check in `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test mcp skill_contract` parses the three frontmatters and asserts the main skill's exact three-tool allowlist, the fixed executor's code-tool set, the direct query/Task/apply order, the exact patch key inventory, and the absence of `.mjs`, `node`, report paths, `STATE.md`, direct SUMMARY writes, `cadence <op>`, worktrees, AskUserQuestion and ToolSearch. The check asserts structural tokens and permissions, not generated engineering prose. It fails if the skill gains a second state channel or the executor's return differs from the advertised schema.

### Task 4: Prove the typed loop over raw stdio and process replacement

- **Files:** `crates/cadence/tests/mcp.rs`
- **Action:** Extend the existing raw JSON-RPC child harness with a strict external repository, native plans, fixture-local Git identity/signing and direct store inspection. Exercise query -> malformed apply -> same query -> valid apply -> process exit -> new child -> query until complete. Use at least two plans sharing one declared file to prove overlap order, and multiple tasks with one signed commit apiece. Construct the invalid patch independently of production types so it can omit a required task, add a foreign state key and name another dispatch. Verify all request/response envelopes and persisted decisions without calling internal service helpers. Preserve the existing initialize/version coverage. This is the deterministic boundary proof; it does not spawn a model or claim a skill ran.
- **Verify:** `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence --test mcp execute_restart` proves the first and replacement binaries are different processes, the refused patch is a successful call with a reason and decision, the outstanding dispatch is byte-identical after refusal/restart, the two valid patches advance in overlap order, and final query is complete with exactly the fixture task SHAs in SUMMARY. Git object reads prove signatures, ancestry, order and subject/task shape. No expected envelope is obtained by serializing production response types, and no service method bypasses stdio.

### Task 5: Run the actual host, executor and denial UAT

- **Files:** `.planning/phases/6/UAT.md`
- **Action:** After deterministic tests pass, create an external temporary repository containing a minimal compilable project, two native plans with at least one shared lease, and project-local copies of the landed `cad-execute`, executor contract and fixed agent whose bytes/digests are checked against this repository. Do not load the repository plugin or its frozen JavaScript hooks. Build the Rust binary once. Start the actual host noninteractively with `--mcp-config` and `--strict-mcp-config` pointing to a temporary stdio definition that launches that binary directly as `cadence serve --project-root <fixture>`, and `--settings` pointing to a temporary `Write|Edit` PreToolUse hook that launches the same binary directly as `cadence guard`. Invoke `/cad-execute <N>` without a ToolSearch load. Require the real executor to change source, invoke the dispatched task verify and suite commands, create one signed commit per task and return/apply the patch. Between plan dispatches terminate the MCP process and resume the host/session with a fresh server. Separately dispatch a real model with Write/Edit permission to attempt each protected target and one authorized source target; record the hook's actual deny/allow observations. If a real compaction happens, record before/after calls and the never-loaded control but label the causal conclusion inconclusive. Inspect Git, SUMMARY and decisions independently of the model return. Write UAT.md with command/environment versions, exact stubs, checklist outcomes, decision/dispatch IDs, full SHAs, process IDs or other replacement evidence, and explicit unverified items. Never include credentials, signing secrets, a session URL, or model-generated source/test prose.
- **Verify:** This is live-only. AC3 and AC7 remain unverified until UAT.md records an actual host version, two distinct Rust server processes, direct pre-load MCP success, the malformed-patch refusal, a real executor Task invocation, observed verification-command tool calls, signed ordered commits, accepted patch calls, exact SUMMARY SHA shape, three protected-write denials and one source-write allowance. The reviewer independently compares store/Git/file shape to those IDs. Missing credentials, signing, model access, denial observation or process-replacement evidence is `blocked` or `unverified`, never skipped-as-pass. No assertion evaluates the source, test output, deviation/blocker prose or compaction causality.

### Task 6: Close the phase boundary without overstating the slice

- **Files:** `crates/cadence/tests/mcp.rs`, `.planning/phases/6/UAT.md`
- **Action:** Run the deterministic suite and inspect the live checklist independently of the executor's return. Map AC1-AC8 to named machine tests and, only for AC3/AC7's host/model clauses, the recorded UAT observations. Confirm the three-tool count, typed refusal log, strict stubs, restart identity, lossless patch, renderer ownership and guard denial individually. Report phase 11's attempt history, checkpoints, general SUMMARY/task/lease behavior and phase 7-9 rails as unimplemented, not implied by a green slice. Record OQ-1 as no preamble and OQ-2 as non-decision-bearing under the failed negative control. Do not move ROADMAP/STATE/REQUIREMENTS or alter phase 1-5 artifacts in this plan.
- **Verify:** From `/code/cadence`, `TMPDIR=/tmp RUSTC_WRAPPER= cargo test -p cadence` and `TMPDIR=/tmp RUSTC_WRAPPER= cargo clippy --all-targets -- -D warnings` pass; `TMPDIR=/tmp RUSTC_WRAPPER= cargo fmt --check` passes; `TMPDIR=/tmp npx tsc -p tsconfig.ci.json` and `TMPDIR=/tmp node --test` preserve the frozen reference checks. `git diff --exit-code v3.7.12 -- cadence-core/` is empty. `rg --files crates skills agents hooks | rg '\.(mjs|js|cjs)$'` shows no newly added phase-6 executable or redirect, and the phase diff adds no `.mcp.json`. The acceptance map must leave the live clauses unverified if Task 5 did not actually run; a green Cargo suite alone cannot complete AC3 or AC7.

## Notes

- Execute PLAN-1 -> PLAN-2. The `server.rs` and `main.rs` overlap is deliberate
  and prohibits parallel execution. PLAN-1's landed service and guard are the
  only interfaces this plan may expose; do not fork replacements in the MCP
  adapter.
- The public server is root-bound so even an arguments object missing every
  field has a known decisions log. The root is startup configuration, not part
  of the executor patch, which keeps the advertised apply schema equal to the
  role patch schema. Multi-root public sessions are outside this strict slice.
- The UAT's temporary skill/agent copies avoid loading the v3.7.12 plugin hooks;
  their byte comparison prevents a hand-edited test double. Temporary MCP and
  settings JSON live under `/tmp` and are evidence inputs, not files Cadence
  ships. No wrapper script is permitted between host and binary.
- Exact host flags and PreToolUse JSON were checked against current host
  documentation through Context7: `--mcp-config`, `--strict-mcp-config` and
  `--settings` load isolated configuration, command hooks consume stdin JSON,
  and a deny uses `hookSpecificOutput.permissionDecision`. Recheck the installed
  host's help before UAT and record its version because host behavior is an
  environmental observation.
- All Cargo commands clear `RUSTC_WRAPPER` and use `TMPDIR=/tmp`. Live fixtures,
  Git identity and signing configuration stay local to the external test
  repository. Do not change global Git or repository Git configuration to make
  a test pass.
