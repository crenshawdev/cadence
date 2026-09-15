# Review policy and selection

The phase-9 policy adapters consume resolved phase-8 values: the effective
ordinary gate after any applicable floor decision, routing answer and evidence,
ordered selection and fallback, and the admitted durable home. They neither
reload configuration nor allocate a home. `ordinary_request` retains these
values; manual-plan, automatic-plan, task, execute, debug and verify adapters
change only the caller label. Ordinary triggers are plan, diff and risk_surface.
There is no milestone trigger or phase_diff revival. A small task retains a
resolved deferred gate. Defaults and floor precedence belong to phase 8.

Delivery permission describes durable delivery, independent of severity and
combination. Pending, interrupted and failed delivery do not grant continuation.
Accepted advisory findings allow continuation, including blockers under
adjudicated combination. An off gate has no obligation; deferred requests enqueue
before continuation. Blocking and adjudicated gates wait for independently
verified settlement. Raw acceptance never supplies that settlement. The
settlement projection defaults to pending when none has been supplied.

Risk selection consumes the detector's supplied observation: match dispatches,
nonmatch produces no review, inconclusive waits for evidence, and unanswered
asks for surfaces. Off produces no review. This decision does not run detection
or reinterpret missing evidence as a clean result.

## FIRST

`select_next` consumes a saved single-mode selection and per-choice observations.
An absent attempt is unattempted; intended, running, interrupted and uncertain
attempts remain incomplete and require their existing recovery path. Selection
requests only the first unattempted choice. Terminal failures advance through the
configured order. Accepted bytes pass through the unchanged H4-1 classifier;
missing and malformed returns cannot be successful empty reviews.

The first usable result, including an empty findings array, ends selection.
Later configured choices are explicitly `not_selected`. Exhaustion selects the
admitted local fallback once; its actual outcome produces `usable-complete` or
`complete-with-failure`. Completion does not imply settlement. `attempt_usage`
preserves supplied token and monetary observations for failed attempts too;
missing observations remain null rather than zero.

## Panel and adjudicated delivery

`dispatch_roster` freezes every supplied required slot and each slot's fallback
rule. Both combination modes preserve the same full roster. The roster records
`all-required-terminal`; `delivery_completion` checks every required slot.
Missing, pending or interrupted work makes the fire incomplete even after
another slot returns usable empty findings. A failed primary with an admitted
fallback waits for that fallback's actual outcome. Explicit no-fallback failure
and exhausted fallback failure produce `complete-with-failure`; successful
fallback can produce `usable-complete`. An absent fallback rule remains unknown,
not an implicit permission to drop the slot. Originals remain per attempt;
selection does not combine, discard or adjudicate findings.

## Specialists and adapter boundary

`minimalism_request` accepts an already-retained named-file, frozen-directory or
resolved phase-range manifest. It requests one base reviewer, returns the same
manifest identity and explicit null ordinary routing, even when ordinary routing
selects a panel. It performs no filesystem reads, judgment or evidence verification.
Other target kinds are refused by this minimalism adapter.

Decision and diagnosis remain distinct `Specialist` and `Target` variants.
Plan 2's `DecisionMaterial` keeps selected decision text and inline context;
`DiagnosisMaterial` keeps named entries and reported/cause text. These payloads
remain retained material and do not become ordinary configured triggers.

The functions describe work over supplied observations. The host adapter must
record actual participation and submit returns; intended dispatch alone is not
participation evidence. Provider credential lookup, transport, payload handling
and acquisition of usage observations are reserved for phase 10, which consumes
this selection contract. Phase 10 also supplies accepted settlement and clearance.
The direct tests here establish none of the real-host or human-review obligations
in the phase's manual checklist.
