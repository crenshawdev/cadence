---
phase: 10
plan: 2
requirements:
  - T2
  - T5
files:
  - crates/cadence/src/review/provider/delivery.rs
  - crates/cadence/src/review/provider/records.rs
  - crates/cadence/src/review/provider/transport.rs
  - crates/cadence/src/review_service.rs
  - crates/cadence/src/server.rs
  - crates/cadence/src/phase10_provider_tests.rs
  - docs/architecture/provider-port.md
---

# Phase 10: Provider port - Plan 2

## Goal

The cross-model review provider arm runs in the binary: OpenAI, Gemini and
DeepSeek adapters with credential lookup, bounded payloads, transport, sanitized
diagnostics and the outer timeout, every attempt on phase 9's delivery lifecycle,
and GH-237, GH-239 and GH-240 repaired in that code as it lands. This plan completes
failed-call accounting and durable fallback closure using PLAN-1's native port.

## Must be true when done

- T2. When a provider answers with an error status and usage figures in the
  body, the run record holds those figures and the failure. (GH-239)
- T5. When a provider fails and the local fallback runs, the dispatch closes
  exactly once, with the fallback outcome recorded.

## Context

Execute after PLAN-1; shared source and test files prohibit parallel execution.
D-75 and D-77 bind these tasks unchanged; use PLAN-1's D-76 normalizer.
Phase 9 owns issuance, observations, accepted/failed returns, FIRST selection and
local dispatch; this plan completes the provider arm on those records.
Do not add settlement verification, filing, re-arm/retention completion or a
second provider lifecycle. GH-250/GH-251 belong to Phase 20, not these tasks.

## Evidence map

Bind these items to CONTEXT.md's exact T2/T5 text dated 2026-09-09; it supplies
no numeric version to invent. The shared test file is registered as
`server::review_service::phase10_provider_tests` in PLAN-1. These are the only
two additional check functions: the phase has five checks in total.

Use PLAN-1's real temporary project, admission, retained material, provider
adapters, service, `Store` and production `Filesystem`. All expected attempt,
original, usage and closure values must be read back after actual writes, then
again after reopening the store. HTTP transport, credential inputs, clock and
the external local-review host may be controlled. The local host double only
supplies actual launch/return events or a launch failure to the production
observation/return operations; it cannot supply a pre-closed attempt, a selector
answer or a store receipt. No acceptance check uses the old service-answer,
admission-commit or in-memory filesystem stubs as its subject.

No additional link items are needed: these are stored outcome truths, and the
checks exercise their provider/fallback-to-store paths with persistence real.

### T2

- **P10-T2-C — check.** File `crates/cadence/src/phase10_provider_tests.rs`,
  function `phase10_error_status_retains_usage`. In one table-driven test,
  configure each real adapter against a bounded HTTP 503 wire response with
  usable accounting: OpenAI input 23/output 9; Gemini prompt 23/candidates
  4/thoughts 5; DeepSeek prompt 23/completion 9. Put a valid-looking empty
  findings envelope in the provider text as well, so status refusal is not
  accidentally justified only by malformed findings. Admit/dispatch through
  the real service and read the failed provider attempt, independent of later
  selection. Expected after reopening: each has usage `(23,9)`, state `failed`,
  HTTP failure with status 503, one failed closure and no accepted original.
  A 503 row with no usable usage retains unavailable values, not zeros. Use a
  credential-bearing error excerpt to establish that the saved failure remains
  bounded and sanitized. Boundary real: response extraction, HTTP refusal,
  observation/return persistence and readback. Fake: HTTP and credentials.
  Command: `cargo test -p cadence --bin cadence
  server::review_service::phase10_provider_tests::phase10_error_status_retains_usage -- --exact`.
  Expected: exactly one test passes, zero failures. Reason: refusing HTTP status
  before recording usage erases the cost of the same failed attempt.
- **P10-T2-A1 — artifact.**
  `crates/cadence/src/review/provider/delivery.rs`: available usage is extracted
  from the bounded response before status-dependent refusal; error text cannot
  become findings. Reason: a status-first early return recreates GH-239.
- **P10-T2-A2 — artifact.**
  `crates/cadence/src/review/provider/records.rs` and the corresponding failed
  attempt's observations: valid usage/raw evidence survives failure through the
  existing store transaction rail. Reason: an envelope-only usage value is not
  the run record's value and can disappear on recovery.

### T5

- **P10-T5-C — check.** Same file/module; function
  `phase10_fallback_closes_once`. Admit FIRST with two configured providers and
  the inherited `claude-subagent` fallback. In one table-driven lifecycle test,
  make all configured provider attempts fail using wire/environment fixtures:
  no key before request, over-cap payload before request, transport failure,
  error status, malformed response, oversized response, native request timeout
  and outer-operation expiry. These are fixtures for the same trigger/outcome,
  not separate checks. Drive real `Query::Next` until it returns local dispatch;
  run that dispatch against the external host double and forward its launch
  observations and unchanged return through `Apply::Observation` and
  `Apply::Return`. Supply a hand-authored nonempty successful fallback outcome
  and failed fallback outcomes (definite launch failure, missing return and
  malformed return) in the same test. Drop a pending polling request in the
  timeout row, then reconnect/poll while the native operation remains owned by
  the binary. Repeat the terminal forward/next calls and reopen the store.
  Expected property: configured providers are attempted sequentially once;
  every issued provider and fallback attempt has exactly one durable closure;
  the fallback is actually issued once after exhaustion and its actual outcome
  is recorded. Successful fallback keeps its exact findings and observed local
  voice with `usable-complete`; failed fallback has no successful original and
  finishes `complete-with-failure`. No-key/over-cap attempts have no invented
  model, usage or provider participation. Replay produces no second request,
  original or closure, and a late completion cannot overwrite a timeout's
  closure. The expired operation persists its failure within the reserved
  acknowledgment budget even when the polling request has gone away.
  Boundary real: selection, provider worker, local dispatch construction,
  observation/return handling, timeout ownership and filesystem store.
  Fake: HTTP, clock, credentials and the external local-review host only.
  Command: `cargo test -p cadence --bin cadence
  server::review_service::phase10_provider_tests::phase10_fallback_closes_once -- --exact`.
  Expected: exactly one test passes, zero failures. Reason: an unclosed provider,
  fabricated fallback success or duplicate dispatch changes the recovered run.
- **P10-T5-A1 — artifact.** `crates/cadence/src/review_service.rs` at `next` and
  `crates/cadence/src/review/provider/delivery.rs`: each failure enters existing
  `accept_launch_failure` or `accept_return`, and saved FIRST selection reaches
  the existing local dispatch path with its real acknowledgment contract.
  Reason: merely returning an unavailable-provider envelope leaves the fire open.
- **P10-T5-A2 — artifact.**
  `crates/cadence/src/review/provider/transport.rs` and
  `crates/cadence/src/review/provider/delivery.rs`: nested native request and
  operation deadlines, with separately owned failure persistence and cancellation
  of transport. Reason: aborting the whole future can abort the closure too.
- **P10-T5-A3 — artifact.** `crates/cadence/src/server.rs`,
  `crates/cadence/src/review_service.rs` and `docs/architecture/provider-port.md`:
  the actual MCP pending/poll contract, compiled dispatch guidance and documented
  effective deadline/acknowledgment budget. Reason: assuming the old Bash host
  timeout for a resident MCP operation leaves the actual host unbounded or silent.
- **P10-T5-O1 — observation, source O1.**
  The owner runs one live review against a real provider account and sees
  in the run record the observed voice, model and usage for that dispatch
  (T1), and one deliberately failed provider call closing through the local
  fallback exactly once (T5). Deterministic tests are necessary but
  insufficient: the phase-6 boundary passed 347 tests and did not load in a
  real host.
  Attribution: the owner, CONTEXT.md dated 2026-09-09. This is the same owner
  observation attached to T1 in PLAN-1. Preserve the reported phase-6 experience;
  attach the actual phase-10 owner/time/run/attempt references when supplied,
  otherwise keep that episode not seen. Do not infer a live result from tests
  or expand O1 into the retired MANUAL.md scenarios. Reason: only the live host
  episode establishes that its wait/forward path really runs. Even accepted O1
  caps T5 at `concerns`, never `met`.

## Tasks

### Task 1: Preserve accounting on HTTP refusal

- **Files:** `crates/cadence/src/review/provider/delivery.rs`, `crates/cadence/src/review/provider/records.rs`, `crates/cadence/src/phase10_provider_tests.rs`.
- **Action:** Deliver P10-T2-C, P10-T2-A1 and P10-T2-A2. Write the T2 check first and record its failure before changing the error-status branch. Repair frozen `callStructured`'s early HTTP exit as this failed-accounting path lands: extract available usage from the bounded parsed response, run PLAN-1's D-76 normalizer, and durably retain the observed accounting on the same attempt before status refusal/failed closure acknowledgment. Keep the response's observed model if present without substituting the requested model. HTTP failure remains failure even when the text is syntactically valid findings; do not send it to successful acceptance. Preserve bounded sanitized raw usage independently from a bounded sanitized error excerpt. Missing/unusable usage and pre-request failures retain absence, never an invented zero. Reuse existing conditional persistence/replay handling so failure does not replace earlier valid evidence and a retried acknowledgment does not double-count it. Do not add a second provider trace or fabricate a bill from the requested token cap.
- **Verify:** `cargo test -p cadence --bin cadence server::review_service::phase10_provider_tests::phase10_error_status_retains_usage -- --exact` selects one test and passes with `(23,9)`, status 503, one failed closure and no original in the reopened records specified by P10-T2-C. Record red and green revisions.

### Task 2: Route every failed attempt to saved FIRST selection

- **Files:** `crates/cadence/src/review/provider/delivery.rs`, `crates/cadence/src/review_service.rs` (`next`).
- **Action:** Deliver P10-T5-A1. Finish the failure exits on the existing lifecycle, including no-key, refused payload/material, transport/response bounds, missing or malformed output and timeout results supplied by task 3. A definite pre-launch failure uses `accept_launch_failure` without invented launch/host/model; a launched attempt uses observed invocation identity and `accept_return` with its actual failure. Only confirmed durable closure lets selection advance. Use `select_next` and the saved admitted order; never fan out a FIRST fire or refresh its roster from current configuration. If every configured choice fails, issue the existing local fallback and retain the local dispatch's WAIT contract: the invoking host actually runs it, forwards its unchanged return or definite launch failure, and the binary persists the actual result before acknowledging. Missing/malformed fallback output is failure, not an empty clean result. Preserve phase 9's already-admitted panel semantics when this common path is used; do not widen single mode into a panel or alter settlement. Repeated next/return calls and terminal provider callbacks reuse existing immutable closure/original records; they must not restart a provider or issue a second fallback. A lost store acknowledgment is recovered as the saved result, not permission to repeat a paid request.
- **Verify:** `cat crates/cadence/src/review/provider/delivery.rs crates/cadence/src/review_service.rs` shows all failure exits reaching the appropriate existing return operation, selection advancing only after confirmed persistence, and exhausted FIRST returning the existing local dispatch. Inspect P10-T5-A1 for the actual fallback forward/acknowledgment path, including failed fallback. This is artifact inspection; P10-T5-C is delivered once in task 3.

### Task 3: Close timed-out operations inside the resident host

- **Files:** `crates/cadence/src/review/provider/transport.rs`, `crates/cadence/src/review/provider/delivery.rs`, `crates/cadence/src/review_service.rs` (`next`, `execute`), `crates/cadence/src/server.rs` (`PublicServer`, tool descriptions), `crates/cadence/src/phase10_provider_tests.rs`, `docs/architecture/provider-port.md`.
- **Action:** Deliver P10-T5-C, P10-T5-A2 and P10-T5-A3; carry P10-T5-O1 into the final live-pilot handoff. Write the single T5 check before installing the missing outer-deadline behavior; its expiry/canceled-poll row must fail, even if task 2 already makes ordinary fallback rows pass. Bound the entire native attempt operation, including payload preparation and response handling, with a deadline separate from the HTTP client's deadline. Reserve time after cancellation to persist failure using the still-live store owner; do not wrap the closure write inside the future being canceled. Use this explicit budget: effective request timeout is the positive configured timeout capped at 540000 ms, default 540000; outer provider-work deadline is 570000 ms; the remaining 30000 ms of the 600000 ms internal attempt budget is reserved for durable acknowledgment. Make those effective values visible in saved non-secret provider settings and the documentation. These are Cadence's internal limits, not an assertion that MCP inherits Bash's 600000 ms ceiling. The host-facing `review-next` returns pending promptly and polls existing records; long work remains owned by the resident binary independently of one tool request's lifetime. Preserve the unchanged local WAIT/forward contract, provide compiled guidance in the actual response/tool surface, and avoid blocking the resident mailbox. Cancel the actual HTTP read on expiry, preserve any usage already observed, then close through the existing failure path before offering fallback. A late result cannot create a second terminal record or overwrite timeout failure. A genuinely unavailable store stays unacknowledged through the existing delivery error; never claim closure merely because a timer fired. Retain phase 9's interrupted/uncertain recovery for a killed binary without inventing a returned review or automatically resending a possibly charged request. Update the documented owner pilot with the implemented public operations, saved deadline values and durable attempt/closure readback; record O1 only when the owner supplies the live observations, with its `concerns` cap.
- **Verify:** `cargo test -p cadence --bin cadence server::review_service::phase10_provider_tests::phase10_fallback_closes_once -- --exact` selects one test and passes with the actual fallback outcome, one durable closure per issued attempt, replay stability and timeout acknowledgment property in P10-T5-C. Record red and green revisions. O1 remains the separately attributed owner observation, not a result inferred from this command.

## Notes

- This sequential 3-task plan follows PLAN-1's 8 tasks. Together the eleven
  concerns exceed the task ceiling; the user's dispatch permits shared-file
  sequential plans and overrides the contract/template's parallel-only split
  rule. There is no independent parallel slice to claim here.
- Read PLAN-1's notes on the resident mailbox, metadata representation and
  artifact-only verification. Neither plan introduces an acceptance engine,
  per-function criteria, a coverage table or tests of the model's prose.
- D-77's failure record and D-75's fallback are separate tasks because preserving
  observed accounting is not the same responsibility as advancing delivery.
  Native/outer deadline ownership is another concern, with a different failure
  and cancellation path. The plan does not combine these to fit a task count.
- No planner build, suite, clippy, live paid request or commit is authorized by
  this planning dispatch. At execution, run only each task's named command while
  working, the full suite once at plan close, and
  `cargo clippy --workspace --all-targets -- -D warnings` after the final source
  change; clippy consumes no stdin. The verifier runs only the five mapped
  checks across this phase and inspects all other evidence items.
- O1 is one live provider dispatch plus one deliberately failed dispatch with
  actual local fallback. It is not the obsolete broader pilot in MANUAL.md.
  No phase-10 live identifiers/time have been supplied to the planner; tests
  cannot fill them in. An accepted observation still caps its truth at
  `concerns`; an item not seen remains visible under the acceptance design.
