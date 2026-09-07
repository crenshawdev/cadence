---
phase: 6
status: complete
completed: 2026-09-07
---

# Phase 6: The boundary and the execute slice - Summary

Before this phase `tools/list` declared one diagnostic tool and nothing a skill
could reach. It now declares three, every public answer is a typed envelope
confirmed against a durable decision, `/cad-execute` is twenty-one lines of
markdown holding no logic, and a real host has driven the whole loop end to end
against a real model executor.

The phase also produced the most useful negative result of the rewrite so far:
**a green deterministic suite said the boundary worked while the product did not
load at all.** Two host constraints, invisible to 347 passing tests, were found
only by running a real host. That is why the live gate exists and why it stays.

## What shipped

- **The three-tool boundary** - `crates/cadence/src/server.rs`. `cadence_version`
  as a side-effect-free diagnostic, `cadence_query` selecting the next unit of
  work, `cadence_apply` submitting an executor patch. Exactly three is a pinned
  assertion, not an accident of registration.
- **Validation inside the handler, not at the boundary.** Arguments arrive as a
  raw JSON object and deserialize inside the named handler, so a malformed
  object returns a typed `Envelope::Refused` that Cadence produced and recorded.
  rmcp's parameter error would have been a protocol error with no decision
  behind it. Undeclared tool names and invalid frames stay protocol errors and
  are distinguishable by test.
- **One envelope vocabulary** - `dispatch`, `complete`, `refused`,
  `judgment-stop`, `unknown`, `not-applicable`, `next-plan`. No second state
  machine at the boundary; the adapter maps the resident's outcomes without
  recomputing selection, patch validity or state.
- **`skills/cad-execute/SKILL.md` reduced to 21 lines and three allowed tools.**
  No filesystem, shell or JavaScript path; no report, replay, Git, plan-parser
  or SUMMARY-writing arm. The binary is the only continuation authority.
- **The guard** - `cadence guard` as a PreToolUse hook denying model `Write` and
  `Edit` against binary-owned outputs while allowing project source.
- **PLAN-3's prerequisite repairs** - the patch schema generated from the type
  Cadence deserializes, a root-scoped refusal for requests with no validated
  phase, and a persisted digest that hashes the envelope actually returned,
  terminal replay included.
- **`docs/architecture/boundary.md`** - the module doc, including both host
  constraints so the next person does not rediscover them the expensive way.

## Commits

48 commits, `5c92bfff..14528100`. Three plans: PLAN-1 seven tasks, PLAN-3 six,
PLAN-2 eight after two were added mid-phase. Suite moved 237 -> 350 passing.

Four PLAN-1 commits use the scope `phase-6` rather than the bare digit
(`8ea58a3e`, `1d986f80`, `ab3dbddb`, `1d2b8712`). Recorded, not rewritten.

## Deviations

- **PLAN-2 stopped at 0 of 6 having written nothing.** Three structural
  contradictions in the landed interfaces, each cited with `file:line`. This is
  the plan working as intended: criteria precise enough to be unsatisfiable in a
  detectable way. PLAN-3 was written as a prerequisite repair and PLAN-2 resumed
  unchanged. Execution order became PLAN-1, PLAN-3, PLAN-2.
- **Two host constraints found only live**, each costing a blocked UAT attempt.
  Advertised schemas need a root `"type": "object"`; `schemars` renders a Rust
  tagged enum as a root `oneOf` without one. And an input schema may not use a
  top-level `oneOf` - the host drops such a tool silently, still reports itself
  connected, and explains only in its own log: *"which the Anthropic API does not
  accept"*. Repaired by tasks 7 and 8, both added to PLAN-2 mid-phase.
- **D-27, D-28 and D-29** were ruled during the phase rather than at context
  time. D-29 in particular retired the frozen v3 prose linters from CI: they
  lint the live `skills/` tree against v3 grammar the 4.0 rewrite deliberately
  stopped speaking.
- **Two CI defects, neither a code defect.** `cargo-test` checked out shallow so
  sixteen tests reading the frozen tag failed on `not a valid object name`. And
  five tests signed fixture commits with a personal secret key, so they could
  only ever pass on one machine. Both fixed; CI is green, 12 of 12.
- **The live UAT's first two fixtures were refused** for returning extra suite
  receipts, the first also prefixing its JSON with commentary.

## Open items

- **AC3's unassisted-contract clause is `unverified`, not passed.** The
  successful fixture had to spell out its receipt inventory. Whether the
  executor contract reliably elicits the right receipts without that guidance is
  untested, and it is a real signal for phase 11.
- **Compaction causality is INCONCLUSIVE.** No compaction was observed; OQ-2
  stays non-decision-bearing, OQ-1 stays no-preamble.
- The operator-answer flow was stubbed in the UAT fixture.
- Hardware power loss and installed-file identity remain unproved by
  construction, per D-28.
- Phase 7-9 rails, phase 11 general execution behavior, and phase 17-18
  acceptance and install wiring are unimplemented, not implied by this slice.

## Goal check

AC1-AC8 are mapped in `UAT.md` to named machine tests, with the host and model
clauses of AC3 and AC7 carried by recorded live observations rather than by the
suite. AC7's guard evidence is complete for the first time: three `Write`
denials, three `Edit` denials and one source allowance, all seven matching the
stated prediction. AC6's process replacement is real - server `2904048` was
terminated after `next-plan`, both it and its host confirmed absent, and a fresh
server `2905724` returned plan 2 with T1's SHA as its dispatch base.

The slice is proven end to end. General execution behaviour is not, and this
SUMMARY does not claim it.
