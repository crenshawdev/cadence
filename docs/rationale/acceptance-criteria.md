# Acceptance criteria: the authoring rules

Status: binding on every phase from 8 onward. Set by the owner 2026-09-08 after
the phase-7 live probe and phase-8 AC4 were both found to mandate end-to-end
runs.

Acceptance criteria are not documentation. They are the specification tests get
written from, so a malformed criterion produces a malformed test, and the defect
is found phases later when something cannot pass. These rules are enforced at
authoring time, in `/cad-context` when criteria are written and `/cad-plan` when
verifies are written, rather than at audit time when the cost is already sunk.

## The seven rules

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

**4. Isolation.** Stub at real boundaries only. Do not mock internal
collaborators - that binds the test to call structure and breaks it on refactor.
Deterministic internals are called for real.

**5. Prose.** Never assert on model-generated text. If the input path includes a
model call, the expected value cannot be fixed, and the criterion is malformed
by construction.

**6. Existence.** If the code does not exist yet, mark the criterion pending. Do
not write a test for behaviour that has not been implemented.

**7. Overflow.** If an item cannot be expressed as input to output - it needs a
live host, a human eye, or a running system - it is not an acceptance criterion.
Route it to the phase's manual checklist, `.planning/phases/<N>/MANUAL.md`. Do
not write an end-to-end test to cover it.

## The test rules that fall out of them

A criterion is the specification a test is written from, so each rule above
lands as a rule about the test itself. Stated separately because a test can
violate these even when the criterion it came from is well formed.

**One test, one unit, one boundary.** The test calls a single function and
asserts on what it returns. It does not drive a workflow to reach that function,
and it does not assert on a caller's behaviour to prove the callee works.

**Solitary at real boundaries, sociable through deterministic internals.** Stub
the filesystem, the clock, a subprocess, the network. Call everything else for
real. Mocking an internal collaborator asserts on call structure rather than
behaviour, so the test breaks on a refactor that changed nothing observable -
that is a false failure, and false failures are what teach people to ignore a
suite.

**Rust makes this cheap, which removes the usual excuse.** Most of this
codebase is pure derivation - config plus files in, a decision out - so it needs
no mocks at all, and `#[cfg(test)]` reaches private functions without exposing a
seam just to reach them. "I need a live host to test this" almost always means
the logic was never separated from the I/O; the fix is to separate it, not to
build a harness that starts a host.

**A test whose result moves without the code moving is not measuring the code.**
That is the diagnostic, not a flake to be retried. It means the assertion
depends on something outside the unit - a model's wording, a real clock, a
network, another test's leftovers - and the test is deleted or rewritten rather
than stabilised.

**No end-to-end test substitutes for a routed overflow item.** When rule 7 sends
an item to `MANUAL.md`, the answer is not to approximate it with a broad test
that exercises the whole chain. A human drives it, and it is expected that a
human finds some problems.

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
binary validates a submitted criterion against rules 1 through 7 and returns a
typed refusal naming the rule and the missing element, rather than persisting it
and leaving the defect for a later audit. The prompt the binary emits to the
authoring agent carries these rules, which is the only way a subagent receives
them - a rule that lives solely in a maintainer's head or a memory file does not
reach the agent doing the writing.
