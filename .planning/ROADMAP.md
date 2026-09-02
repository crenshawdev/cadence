# Roadmap: v3.7.10 - review receipts

## Overview

**`v3.7.10`, opened 2026-09-01.** The source is the receipts cluster the
v3.7.9 overview named and deliberately left open: `GH-228`, `GH-221`, `GH-227`,
`GH-220` and `GH-226`. Three tracker rows closed with that cycle rather than
against this one - `GH-233`, `GH-232` and `GH-218` all shipped in v3.7.9 and
were still open on the board.

**The thread.** A review ran, and the run record says something untrue about
it. Not silent, not missing - written down, and wrong. A fallback reviewer is
dispatched and never closed, so the record shows a worker that vanished. A
provider review returns its usage on the wire and the code drops it, so the
reviewer row reads zero and the phase looks like review was free. A settlement
that correctly closes a blocking gate has no home the seam will accept, so it
gets hand-typed and no guard can see it. One human authorization writes two
override receipts and nothing says which. And nine rung files declare an effort
the host may not honour, with nothing anywhere that would notice.

**What is broken.**

`cadence-core/references/review-triggers.md:202-203` sends the empty-set
fallback to step 3's reviewer-selection rule rather than to the
`claude-subagent` arm at `:110-148` that owns the bracket. A model on that path
dispatches and is never routed to the close at `:143`. Observed on smithers
phase 3: a 429 at 03:58:43, a `claude-subagent` dispatch at 03:58:50, and no
return, checkpoint or escalation ever - `corr` `3-5812523`, the phase's only
unpaired worker.

`cadence-core/bin/review-provider.mjs` has no reference to a response `usage`
field. Its only token arithmetic is the outbound cap at `:29,402,437`. Five
provider reviews on verbatim phase 2 spent 372 seconds between them and
recorded not one token, and only two of the five were preceded by a
`routing/resolve` at all.

`cadence-core/bin/lib/adjudication-record.mjs` refuses any phase without a
`phases/<N>/` or `deferred/<N>/` directory, while `workflows/task.md:135`
chooses phase 0 on purpose and `:171` puts a planned task's artifacts under
`.planning/tasks/{slug}/`. The REVIEW half already resolves that path; the
adjudication half does not. Separately, `cadence-core/bin/lib/trace.mjs:12-20`
derives the correlation id off the phase's NEWEST `phase_start`, so a receipt
for an earlier window has no id to be written under - and this repository's own
`ADJUDICATION-risk_surface-declines-off-the-tracker.json` carries a `note`
field explaining in prose why it was written by hand.

`cadence-core/references/triage-gate.md:109` keys an override receipt on
`--sha <head>`, which moves as work lands, so one authorization applied to two
ranges is two receipts by construction. `risk-check.mjs:710-722` puts
`override` in `FIRE_RECEIPTS` and its `:718` guard checks only that a reason
string is non-empty, so two receipts on one human answer can settle two ranges.

`cadence-core/bin/route.mjs:974-976` states that the agent file carries the
effort and the router only reports it. Nothing reads what the host actually
ran, so a `routing/resolve` saying `effort: max` beside a request that ran at
`high` is contradicted by nothing.

**The standard.** Would a user on their own project feel it. Every observation
above came off verbatim and smithers, not off Cadence-on-Cadence. The cost
figures `/cad-report` narrates and the retune signals `/cad-suggest` reads are
both drawn from these records, so a false zero and an unpaired worker are not
bookkeeping - they are the evidence the tool asks the engineer to act on.

**Out of scope, deliberately.** `GH-229` (a blocking risk check scoped on a
range it could not resolve) and `GH-178` (`reads.jsonl` stores a program, not a
shape) are real and stay open. Both are about resolving an INPUT before a gate
runs; this cycle is about what the record says AFTER one did. `GH-230` and
`GH-140` are decisions, not defects.

## Open Questions

- **OQ-1 - what a receipt names when it settles an earlier window.** `GH-227`
  Case A gives two shapes: a receipt may NAME the anchor it settles under, so a
  later run can close an earlier window, or re-anchoring must carry unsettled
  fires forward. The first is smaller and the second is more honest about what
  a phase window means. Case B (`tasks/<slug>/` as a third home) does not
  depend on this and can land first.
- **OQ-2 - whether the host actually downgrades.** `GH-226` rests on a
  changelog reading, not an observation: that Claude Code 2.1.251 turns
  `xhigh`/`max` into a silent downgrade to `high` when thinking is off. Confirm
  it on the installed version before writing code. If the host still
  hard-errors, phase 3 is void and the cycle closes at two phases.

## Phases


## Phase Details
