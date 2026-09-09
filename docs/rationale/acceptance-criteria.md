# Acceptance criteria: the authoring rules

Status: binding on every phase from 8 onward. Set by the owner 2026-09-08 after
the phase-7 live probe and phase-8 AC4 were both found to mandate end-to-end
runs.

Acceptance criteria are not documentation. They are the specification tests get
written from, so a malformed criterion produces a malformed test, and the defect
is found phases later when something cannot pass. These rules are enforced at
authoring time, in `/cad-context` when criteria are written and `/cad-plan` when
verifies are written, rather than at audit time when the cost is already sunk.

## The eleven rules

**1. Scope.** A phase's acceptance criteria test only the code that phase adds
or modifies. Existing code is already covered by its own criteria. A phase that
reaches through new code into old code to produce a result is testing the wrong
thing.

**2. Granularity.** Each criterion asserts on a single function or method. Never
a chain, a workflow, an end-to-end path, or a whole suite. Target the smallest
unit that returns something. Anything that depends on that unit is covered by
that unit's own criteria, not by re-testing it through a caller.

**3. Shape.** Every criterion names three things: the input, the expected output
as a literal value, and any boundary that must be stubbed - filesystem, clock,
subprocess, network. If you cannot write all three, it is not a criterion.

**4. Isolation.** Test functions and methods at the unit level against their
inputs and return values. For a method, treat the receiver as an input:
construct the struct in the state you need, call the method, assert on the
return value or the mutated state. Do not write tests that walk the entire call
chain. Where recursion exists, isolate it in a thin orchestrator and test that
separately with a stubbed resolver.

**5. Prose.** Never assert on model-generated text. If the input path includes a
model call, the expected value cannot be fixed, and the criterion is malformed
by construction.

**6. Existence.** If the code does not exist yet, mark the criterion pending. Do
not write a test for behaviour that has not been implemented.

**7. Overflow.** If an item cannot be expressed as input to output - it needs a
live host, a human eye, or a running system - it is not an acceptance criterion.
Route it to the phase's manual checklist, `.planning/phases/<N>/MANUAL.md`. Do
not write an end-to-end test to cover it.

**8. Wiring.** Every production call site of a function the phase adds or
modifies gets one criterion of its own. It names the caller, the callee, and
the literal value that crosses between them. The callee is stubbed to record
what it received; the caller runs for real from constructed state. The test
crosses exactly one seam and asserts on what crossed it, never on the result
of the chain beyond it. A function with no production call site has no wiring
criterion and is refused at planning: it is either unwired or not needed.
Rule 8 replaces the old module-level allowance in rule 4. There is no other
test between a unit and MANUAL.md.

**9. Coverage.** Before a plan is accepted, every function the phase adds has
at least one unit criterion under rules 1 through 7 and one wiring criterion
under rule 8, listed per function in the plan. A function missing either is
refused when the plan is checked, not found at audit. A function the phase
only modifies keeps its existing unit criteria and gains a wiring criterion
for each call site the modification touches.

**10. Boundary.** A criterion may not stub the boundary it asserts about. A seam
may stand in for a collaborator the criterion is not testing - a clock, a
network, an unrelated store - but never the one whose behaviour the assertion
names. If the criterion says a value reaches durable storage, the write runs for
real and the value is read back from it. If the criterion says a call is not
made, the code that would make that call runs. A criterion whose stubbed
boundary appears in its own expected value is refused at planning. Rule 8's
wiring criteria are the one exception, and only for their named callee: the seam
IS the subject there, and what crossed it is what is asserted.

**11. Falsifiability.** A criterion that asserts an absence - that a call is not
made, a value not read, a path not taken - carries a demonstrated failing
variant. Before it is accepted, the change that should break it is made, the
test is observed to fail, and the change is reverted. Record the change and the
observed failure with the criterion. A test that never reaches the code it
constrains passes for the same reason a correct one does, so an absence never
shown to fail is not evidence.

## Rules 10 and 11 were added on 2026-09-08, and they are not retrofitted

Phase 9's AC152 asserted that the supplied admission path reads no current
configuration, and listed "stub ... successful contribution/commit" among its
boundaries. The test therefore replaced the very commit whose behaviour the
criterion was about, and passed in a state where release failed. Nothing in
rules 1 through 9 forbade that: rule 3 requires naming the stubbed boundaries
and says nothing about which boundary may be stubbed.

The criterion authorized its own bypass, so this was a planning defect rather
than an execution one. The executor did exactly what the plan specified. Rule 10
closes it, and rule 11 closes the reason it went unnoticed: an absence assertion
that is never shown to fail cannot distinguish a passing test from an absent one.

Both bind work authored from 2026-09-08 forward. Phases 1 through 9 are NOT
retrofitted; phase 9's own instance is recorded as D-67 in its context.

## Rule 4 was replaced on 2026-09-08, and it is not retrofitted

Rule 4 previously read: "Stub at real boundaries only. Do not mock internal
collaborators - that binds the test to call structure and breaks it on refactor.
Deterministic internals are called for real." The owner replaced it with the
text now standing above, and the replacement is narrower and more specific: the
unit is a FUNCTION OR METHOD rather than a module, a method's receiver is an
input to be constructed rather than a context to be arranged, no test walks the
entire call chain, recursion is isolated behind a thin orchestrator with a
stubbed resolver, and module-level tests exist only for a public surface where
composition itself can fail.

**It binds work authored from 2026-09-08 forward. Existing tests are NOT
retrofitted** - the owner's instruction was "you do not have to go back and
retrofit, use it moving forward." Phases 1 through 9 were built under the old
rule 4 and stand as they are. Two known divergences in that older work, recorded
so nobody mistakes them for the standard:

- Seven self-recursive functions in `src/review/` - `persistence::{get, read,
  confirm, contribute}`, `material_io::{read, now}`, `history::read` - have no
  thin orchestrator and no stubbed resolver.
- Several phase 9 test files carry unit coverage at module level rather than
  keeping module tests few and thin: `phase9_policy` spans 11 distinct
  functions, `phase9_material` 8.

New work does not copy either shape.

## What a wiring criterion looks like

The shape is caller, callee, value, in one sentence, with the callee stubbed.
Phase 9's gap 158 as it should have been written:

- [ ] Given a completed receipt `d1` with no saved review binding, and a
      config read stubbed to return `diff = advisory`, route `R`, the
      execution handoff calls `review_service::admit` once with a request
      whose `gate = "advisory"` and `routing = R`. Boundaries: config read
      stubbed; `admit` stubbed to record its argument.

That fails on the shipped code, which built a request carrying neither field.
It does not run admission, does not read the store, and does not start a
process. Gap 154 could not have been written at all, because
`risk_review_action` had no caller to name, so rule 8 refuses it at planning.

A wiring criterion is not an end-to-end test. It crosses one seam. Two seams
is a chain, and rule 2 still forbids it.

Rule 9's per-function list is a `## Coverage` section in PLAN.md, one table
row per function the phase adds or modifies: the function, the AC ids of its
unit criteria, the AC ids of its wiring criteria. An empty cell is a refusal.
The plan gate reads this table; it does not infer coverage from prose.

## The test rules that fall out of them

A well-formed criterion can still produce a badly scoped test. These rules
apply to the test and its setup. Paths below are relative to
`crates/cadence/`.

**One test, one unit.** Call the function named by the criterion and assert on
its result, including observable state changes when it writes. Construct its
inputs directly; do not run a workflow to obtain them or assert on a caller to
prove a callee. A unit may cross zero or several real boundaries. Name and
control each one; there is no one-boundary quota.

**Separate decisions from acquisition.** `src/config/merge.rs::deep_merge`,
`src/derivation/parse.rs` and `src/next_action/select.rs::select` work on
supplied values. They need no mocks. Files on disk are not pure inputs:
reading them is I/O. `src/derivation/capture.rs::ArtifactIo` and
`src/config/reload.rs::ConfigIo` are filesystem seams;
`src/store/filesystem.rs` writes and syncs durable state.
`src/rail/git.rs::run` starts Git. `src/guard/audit.rs::event_identity` reads
`SystemTime` when no tool-use ID is supplied. Control these boundaries when
testing their consumers. There is no direct network client in this crate;
`src/main.rs::run_serve` uses MCP over stdio. Do not invent a network mock.

**Private visibility does not require a public test API.** A child test module
can access its ancestors' private items. `#[cfg(test)]` selects test code; it
does not relax privacy or expose library internals to `tests/*.rs`. The inline
modules in `src/execution/plan.rs` show the placement. A direct test of
private `src/guard/bash.rs::verb` belongs under that module, not behind a
spawned guard. This solves access, not I/O isolation.

**Use independent inputs and literal expectations.** Hand-author fixtures at
the unit's input boundary. Do not derive the expected answer with the function
under test or its production serializer. `tests/phase7_receipts.rs`
hand-encodes receipt inputs;
`exact_committed_and_null_head_staged_records_settle` asserts `State::Settled`
and rejects changed material. The literal JSON and digest fixtures in
`src/execution/boundary.rs` provide independent serialization oracles. Table
rows may vary one contract without driving a chain: `tests/phase7_lease.rs`
has `admission_rejects_trailing_file_separators_with_typed_field_error`, which
asserts `invalid-path`. Test absent, empty, malformed and unavailable inputs
separately where their meanings differ, as
`empty_unavailable_binary_and_unchanged_context_stay_distinct` does in
`tests/phase7_risk.rs`. Fixed fixture prose is input data, not model output.

**Fake real boundaries; call deterministic internals.**
`tests/derivation_inputs.rs::MemoryIo` supplies artifact observations without
replacing derivation. Use injected failures for unreadable inputs and failed
writes. `tests/phase7_surfaces.rs` uses `detect_observed` to inject permission
denials; `tests/store.rs::either_sync_failure_prevents_success` injects both
sync failures through `Filesystem::with_probe`. A temporary directory is real
filesystem I/O, not a stub. It is useful when the filesystem adapter itself is
the subject. Boundary assertions can include forbidden reads:
`two_level_walk_names_extensions_skips_and_symlinks_never_open_source_bodies`
in `tests/phase7_surfaces.rs` checks that contract. Internal call counts are
not output contracts.

**Setup must obey isolation too.** `tests/support/signing.rs::generate` starts
GPG; `src/execution_service_tests.rs::fixture` starts Git and `ssh-keygen`.
`tests/mcp.rs::Client` starts `cadence serve`. These are real process tests,
even when their requests and receipts are synthetic. They cannot establish
that a model executed the task. Supply fixed subprocess observations to a
consumer test; keep tests of real process or persistence behavior explicitly
scoped to those boundaries. They do not satisfy a callee's unit criterion.

**The existing suite is not uniformly compliant.** Concrete violations:

- `src/execution_service_tests.rs`:
  `resident_selects_overlap_graph_durably_and_ignores_report_bodies` drives
  lifecycle acceptance, dispatch, signed commits, patch application and
  receipt settlement to assert plan selection. This violates granularity.
- `tests/phase7_guard.rs`:
  `bounded_scanner_recognizes_top_level_separators_paths_and_seven_options`
  proves the private scanner through a spawned guard's permission output. This
  asserts on the caller to prove the callee and leaves subprocesses real.
- `src/derivation_service_tests.rs`:
  `query_guards_reobserve_changes_denials_and_fresh_hit_without_write` asserts
  an internal `Event::Derived` count as well as returned and persisted state.
  The count binds the test to internal execution structure.
- `src/execution/tests.rs`:
  `phase_six_core_acceptance_inventory_runs_registered_evidence` launches its
  test binary for `--list` and calls other tests. It tests an inventory, not
  one production unit. Similar inventory wrappers recur in the service and
  store suites.

**Control ordering; investigate nondeterminism.** Use a boundary barrier to
establish that an operation reached the point being tested. `tests/store.rs`
uses channels in
`confirmation_holds_own_reply_and_cancellation_preserves_admitted_work`; its
timeout bounds a hang. In contrast, `tests/phase7_guard.rs` uses a 100 ms
sleep before asserting a child is still running in
`killed_recovery_owner_releases_waiter_and_replays_exactly_once`. That is a
scheduling assumption, not proof that the child attempted the blocked work.
The same file's `legacy_invocations_do_not_coalesce_by_command_digest` reaches
the real clock, PID and sequence counter; it checks uniqueness, not a fixed
time-derived value. An unchanged-code failure can expose an internal race as
well as uncontrolled input. Investigate and fix the cause; a passing retry is
not evidence that the test or code is sound.

**No end-to-end test substitutes for a routed overflow item.** When rule 7
sends an item to `MANUAL.md`, keep it there. A synthetic boundary test cannot
prove live host behavior or model judgment. Mark criteria for missing code
pending; do not substitute a harness, source-text search or suite inventory.

## What rule 7 replaces

The frozen v3 surface ships `(human-verify: needs <tool/service>)` as an AC tag,
and its verify workflow routes tagged items to a human check inside the UAT
walk. Under rule 7 such an item is not a criterion at all: it leaves the AC list
for `MANUAL.md`. Overflow ROUTES, it does not delete - the routed text is
preserved verbatim with its original AC number, so nothing is lost by
reclassification. The v4 verify surface must not reintroduce the tag.

## Why rule 5 is stated as malformation and not difficulty

The phase-7 real-host probe launched a second session and asserted over its
transcript. The same test failed and then passed on the same code, with only
contract prose changed between runs. A test whose result moves without the code
moving is not measuring the code. The general form: when a model call sits in
the input path there is no correct expected value to write down, so the
criterion cannot be repaired by making the test more careful. It is wrong at the
point it was written.

## What these rules condemned when first applied

Audited across phases 8, 9 and 10 on 2026-09-08, 50 criteria:

- **Regression re-runs are not criteria.** Phase 8 AC1 and phase 10 AC16 both
  said "existing assertions still pass" and named a `cargo test` line. Phase 8
  AC1 conceded the point in its own text: "This retains completed behavior, not
  a new implementation obligation." Rules 1 and 2. Both removed.
- **Cross-phase production chains.** Six phase-10 criteria opened "Consume
  phase-9-produced...", and its AC1 forbade fixtures outright. Rule 1 inverts
  this: phase 9 commits a fixture, phase 10 reads it.
- **Bundling.** Every phase-9 and phase-10 criterion carried many assertions;
  phase 10 AC12 held roughly twelve. Nothing in them can fail on its own, which
  is what made phase 8's original AC4 unusable and forced its split into AC4 and
  AC12 through AC16.
- **Live pilots.** Phase 9 AC7 and phase 10 AC17 were owner-inspected pilot
  records end to end. Routed to `MANUAL.md` under rule 7.

## Where this binds in v4

Phase 11 owns CONTEXT creation and PLAN authoring, so it owns enforcement: the
binary validates a submitted criterion against rules 1 through 9 and returns a
typed refusal naming the rule and the missing element, rather than persisting it
and leaving the defect for a later audit. The prompt the binary emits to the
authoring agent carries these rules, which is the only way a subagent receives
them - a rule that lives solely in a maintainer's head or a memory file does not
reach the agent doing the writing.
