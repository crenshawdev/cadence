# Phase 13 PLAN-1 execution report

Starting checkout: `/code/cadence`, `cadence/binary-owns-process`,
`a62e76451e2b968bc49305651a504ea74b7d25d8`. Initial worktree was clean.
This report is intentionally uncommitted. All six task implementations are
committed. Execution is blocked at task 6's plan-close quality confirmation:
the reported clippy issue is repaired, but the dispatch requires authorization
before a second invocation. The full workspace suite passed.

All listed commits are authored by John Crenshaw <john@jcrenshaw.dev>,
signed with key 693AB15F91734B0C. Each immediate
`git log -1 --format=%G?` returned `G`; the complete range was rechecked.

| Task | Commit(s), signature | Named verification and literal result |
| --- | --- | --- |
| P13-1-T1 | `1350be8460718c9ffcede69608e0338604d8aedb`, G | `cargo run -p cadence -- verifier-instructions`: exit 0; `Finished dev profile [unoptimized + debuginfo] target(s) in 11.46s`; printed complete compiled contract, verbatim Verifier block and strict schema. |
| P13-1-T2 | Initial test `98b120998c33fff0bced05d2d219b07a50fc5dc0`, G; valid red `095a30d364d73ed2fe2e259bd9db859330871239`, G; green `79e0ab4ffb9980a5bf17495206cbf8ac200bf604`, G | `cargo test -p cadence --test phase13_verification phase13_dispatch_carries_current_verification_inputs -- --exact`: valid red exit 101, `test result: FAILED. 0 passed; 1 failed; 0 ignored; 0 measured; 0 filtered out; finished in 6.72s`; green exit 0, `test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 7.56s`. Exactly one selected function in both. |
| P13-1-T3 | `1583053e17bc5bac73243d0f7bf9753f1405fcca`, G | `cargo test -p cadence --test phase13_support phase13_runner_retains_independent_receipts -- --exact`: exit 0; `test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 9.88s`. |
| P13-1-T4 | `bba7a19d5dffa5c783e6a6849fcf7748d56518a0`, G | `cargo test -p cadence --test mcp skill_contract_matches_wire_patch_and_direct_tool_permissions -- --exact`: exit 0; `test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 17 filtered out; finished in 0.01s`. |
| P13-1-T5 | `e3cf7ae0f92b4d318aae67a2487a96bc1e0cfc2f`, G | `cargo test -p cadence --test mcp execution_calls_refuse_noninteger_phases_and_legacy_plans_without_dispatch -- --exact`: exit 0; `test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 17 filtered out; finished in 0.22s`. |
| P13-1-T6 | `fe6232f5c7842e6691ae77fe9f01631eba8029b3`, G; close repair `3454d86febb9db642a9d3d699effb89c03436fbf`, G | `cargo test -p cadence --test phase13_close phase13_rules_gate_retirement_rehearsal -- --exact`: exit 0; `test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 7.56s`. Same literal result after the close repair; exactly one affected-target rerun. |

## Red evidence

At valid red commit `095a30d364d73ed2fe2e259bd9db859330871239`, both
native plan fixtures completed real execution, suite and risk work.
The assertion at `crates/cadence/tests/phase13_verification.rs:15` failed:

```text
assertion `left == right` failed: verifier dispatch must be retained: {"status":"refused","code":"invalid-patch","reason":"execution validation failed (invalid-patch); check the controlling inputs and retry"}
  left: String("refused")
 right: "ok"
```

No production dispatch implementation was present at that commit. This is
the behavioral red. The earlier setup failure below is not acceptance evidence.
The truth function's cases and controls remain together; its expected outcome
was not changed to make implementation pass.

## Delivered behavior

The project-free verifier entrypoints and native dispatch share compiled
instructions and a strict complete item-patch schema. The real stdio path
retains an attempt before returning its current truths, complete map digest,
publication/admission identities, native execution receipts and exact saved
check commands. Writer/transaction validation owns the new versioned
namespace. Historical replay retains its original prompt without making it
current. Missing/changed authority refuses with no partial dispatch.

Verification-run independently launches only a retained canonical check
command, persists its launch before spawning, captures bounded output and
source/material identities, and retains its result. Replay does not relaunch.
Interrupted launches remain Unknown and execution tasks stay closed.
Submit, waiver, human-result, completion and audit vocabulary is defined,
but operations belonging to later plans return unavailable rather than
pretending success.

Both verifier skills and both executor skills were rendered through actual
binary entrypoints. The five verifier agent files were edited directly as
metadata adapters. Execution guidance includes complete admission/allocation,
integer phases, both Stop continuations, signing, task-token subjects and
exact owner Inspection. Public malformed-input and lifecycle-conflict
refusals retain bounded supplied details through restart/replay.

The close script and its disposable record are committed with task 6.
Actual commands, hashes, retained dispatch identities, raw-byte preservation
and partial-failure recovery are in `hook-retirement.md`. Script SHA-256:
`41fc19c934873d88bc1ab432a6cad05c052e8b394b4754924fe852c9f8dd1392`.
Installed removal remains explicitly pending PLAN-4.

## Deviations and intermediate validation

- Task 2 required one extra test-only commit, preserving immutable history.
  The first test commit (`98b12099`) compiled, but its fixture assumed
  `execution-history.tasks` exposed `checks`; it does not. The run exited
  101 at support line 531 with `left: Null`, `right: "check/A"` and
  `test result: FAILED. 0 passed; 1 failed; 0 ignored; 0 measured; 0 filtered out; finished in 1.46s`.
  This setup error is not valid red. The helper now obtains allocation from
  public plan/map records. The unchanged truth assertion then failed
  behaviorally at committed `095a30d3`. No amendment or earlier-phase test edit.
- Before initial red, `cargo check -p cadence --test phase13_verification`
  caught a local variable shadowing the fixture function (E0618); after
  qualification it exited 0. This was not red evidence.
- During task 2, the named test caught a missing exhaustive apply match arm
  (E0004), then dead-code warnings in decoded schema fields. Both were fixed
  within the lease. An actual prompt assertion also caught SUMMARY material
  entering authored input; dispatch now includes only contributing PLAN
  documents there. Current receipts and map remain operational inputs.
- Task 3's named regression caught a verification-read racing a result
  transaction's intent. Readback now uses the existing store's queued
  ReadVerified path. The final named run passed; no task reopened.
- Tasks 4 and 5 each first detected stale rendered skill bytes, then passed
  after rendering the actual binary modes. Task 5's diagnostic control was
  corrected for serde_json's preserved exponent spelling `13e+0`; the
  supplied value remains a refused noninteger. This is an artifact regression,
  not a change to the truth check.
- Task 6 surface clarification: the credited phase-28 planner authority is
  the compiled `plan-instructions` front door and stdio native publication
  protocol. Inspection of `plan_service.rs` confirms no retained
  planner-prompt query exists. The rehearsal identifies and exercises the
  existing surface, plus actual executor and verify-next dispatches; it
  does not invent a planner response or modify prior phase code. This is
  explicitly documented in the close procedure and rehearsal record.
- The single allowed close clippy invocation found `clippy::explicit_write`
  in the rehearsal helper's deliberate uncaptured stdout record. It exited
  101. Repair commit `3454d86f` locks stdout explicitly, preserving literal
  capture behavior; its exact affected test was rerun once and passed.
  A second clippy invocation requires authorization under the dispatch;
  authorization has been requested, and no second invocation has run yet.

## Plan-close checks

Clippy command: `cargo clippy --workspace --all-targets -- -D warnings`,
after task 6 commit, stdin redirected from /dev/null. Exit 101:

```text
error: use of `writeln!(stdout(), ...).unwrap()`
  --> crates/cadence/tests/phase13_close.rs:66:9
error: could not compile `cadence` (test "phase13_close") due to 1 previous error
warning: build failed, waiting for other jobs to finish...
```

The source is repaired, but a clean clippy result remains unverified.

`cargo test --workspace --no-fail-fast`: exit 0, run exactly once after
the repair. `Finished test profile [unoptimized + debuginfo] target(s) in 20.34s`.
Totals: **897 passed; 0 failed; 0 ignored** across 46 executable targets;
one documentation target ran 0 tests. The main unit target printed two
child-test summaries (1 passed each), then its enclosing 239-passed summary;
those child summaries are not double-counted.

| Cargo target | Literal final result |
| --- | --- |
| `unittests src/lib.rs` | `test result: ok. 176 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.91s` |
| `unittests src/main.rs` | `test result: ok. 239 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 125.64s` |
| `tests/derivation_consistency.rs` | `test result: ok. 6 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.06s` |
| `tests/derivation_inputs.rs` | `test result: ok. 12 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s` |
| `tests/evidence_store.rs` | `test result: ok. 4 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s` |
| `tests/execution_boundary_compat.rs` | `test result: ok. 11 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.79s` |
| `tests/execution_store.rs` | `test result: ok. 18 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 285.33s` |
| `tests/mcp.rs` | `test result: ok. 18 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 42.96s` |
| `tests/next_action.rs` | `test result: ok. 7 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s` |
| `tests/phase11_context.rs` | `test result: ok. 7 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 1.06s` |
| `tests/phase12_execution.rs` | `test result: ok. 7 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 116.34s` |
| `tests/phase13_close.rs` | `test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 7.55s` |
| `tests/phase13_support.rs` | `test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 9.99s` |
| `tests/phase13_verification.rs` | `test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 7.66s` |
| `tests/phase27_plan.rs` | `test result: ok. 7 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 1.08s` |
| `tests/phase28_evidence.rs` | `test result: ok. 7 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 4.83s` |
| `tests/phase29_limits.rs` | `test result: ok. 4 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 17.48s` |
| `tests/phase7_guard.rs` | `test result: ok. 23 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.60s` |
| `tests/phase7_lease.rs` | `test result: ok. 23 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 9.64s` |
| `tests/phase7_receipts.rs` | `test result: ok. 11 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.08s` |
| `tests/phase7_risk.rs` | `test result: ok. 22 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 3.35s` |
| `tests/phase7_surfaces.rs` | `test result: ok. 4 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s` |
| `tests/phase8_config.rs` | `test result: ok. 6 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.03s` |
| `tests/phase8_dispatch.rs` | `test result: ok. 24 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.05s` |
| `tests/phase8_global.rs` | `test result: ok. 12 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s` |
| `tests/phase8_interview.rs` | `test result: ok. 40 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s` |
| `tests/phase8_routing.rs` | `test result: ok. 44 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 6.11s` |
| `tests/phase9_admission.rs` | `test result: ok. 8 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s` |
| `tests/phase9_binding.rs` | `test result: ok. 4 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s` |
| `tests/phase9_consumers.rs` | `test result: ok. 7 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s` |
| `tests/phase9_context.rs` | `test result: ok. 5 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s` |
| `tests/phase9_contract.rs` | `test result: ok. 31 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s` |
| `tests/phase9_deferred.rs` | `test result: ok. 12 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s` |
| `tests/phase9_history.rs` | `test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s` |
| `tests/phase9_inventory.rs` | `test result: ok. 3 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s` |
| `tests/phase9_invoking.rs` | `test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s` |
| `tests/phase9_material.rs` | `test result: ok. 14 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s` |
| `tests/phase9_model.rs` | `test result: ok. 2 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s` |
| `tests/phase9_observations.rs` | `test result: ok. 3 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s` |
| `tests/phase9_policy.rs` | `test result: ok. 11 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s` |
| `tests/phase9_recovery.rs` | `test result: ok. 10 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s` |
| `tests/phase9_returns.rs` | `test result: ok. 7 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s` |
| `tests/phase9_selection.rs` | `test result: ok. 21 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s` |
| `tests/phase9_specialist.rs` | `test result: ok. 3 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s` |
| `tests/phase9_stream.rs` | `test result: ok. 2 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.05s` |
| `tests/store.rs` | `test result: ok. 17 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.02s` |
| `Doc-tests cadence` | `test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s` |

No linker crash or retry has occurred. No manual access to owner Claude
settings/hooks, protected fixtures/roots/locks, `.codex-analysis/`, or live
native import was used. Changed paths are inside the PLAN-1 lease; this
uncommitted report is separately authorized. PLAN-2 through PLAN-4 were not
executed. No approval or judgment quality is inferred from these checks.
