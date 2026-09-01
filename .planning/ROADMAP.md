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

- [ ] **Phase 1: Every review fire is bracketed and priced** - a fallback dispatch closes what it opened, and a provider review records what it spent
- [ ] **Phase 2: A receipt can name its home and its authorization** - a settlement written through the seam instead of by hand, and one human answer distinguishable from two
- [ ] **Phase 3: The record states the effort that actually ran** - the observed effort carried onto the return event beside the routed one

## Phase Details

### Phase 1: Every review fire is bracketed and priced

Take `GH-228` and `GH-221` together, because they are one claim about the same
event stream: every review fire appears in the routing ledger exactly once, and
carries what it cost.

The fallback is a prose fix. `review-triggers.md:202-203` routes an empty-set
fallback to the `claude-subagent` arm's bracket procedure rather than to step
3's selection rule, so a fallback dispatch is bracketed like any other and
reaches the close at `:143` - including the failure case that arm already
covers. Worth checking in the same pass whether the close is written only on
the originally resolved arm, or whether any other path can dispatch a reviewer
without reaching it.

The cost is a code fix, and it is not a new measurement to invent: providers
return usage on the response and `review-provider.mjs` discards it. Record the
reported usage on the `provider/request` event so the fire is priceable at its
own site, and make the `routing/resolve` unconditional for a review fire
regardless of which backend serves it, so a reader can count reviews
consistently before trying to price them.

**Success criteria**

- A cross-model provider failure that falls back to `claude-subagent` writes a
  `lifecycle/return` for that dispatch. `trace render` reports no unpaired
  worker for the fire, and its token total is a number rather than
  `unrecorded`.
- A provider review's `provider/request` event carries the usage the provider
  reported. A fire whose response carried no usage is recorded as unrecorded,
  never as zero - the distinction `/cad-report` already protects for roles.
- Every review fire emits a `routing/resolve` for its role, whichever backend
  serves it. A trace with five provider reviews holds five resolves.
- `/cad-report` on a phase whose reviews all ran cross-model prints a reviewer
  row with a real cost, not an empty one.
- `GH-228` and `GH-221` each trace to a REQUIREMENTS row pointing at Phase 1.

### Phase 2: A receipt can name its home and its authorization

`GH-227` and `GH-220` are both the same missing field: a settlement record that
cannot say what it descends from, so a coordinator writes the answer into free
text instead.

Case B of `GH-227` is the cheap half and lands first. The `adjudication` seam
learns `tasks/<slug>/` as a third home beside `phases/<N>/` and `deferred/<N>/`,
sharing one path resolution with the REVIEW writer that already resolves it, so
the two halves stop disagreeing by construction. Case A is OQ-1 and is decided
before code.

`GH-220` gives the override receipt a field naming the authorization rather
than only the range: an id minted when the engineer answers, carried by every
receipt written on that answer. Then a deduplicating reader can collapse the
pair whose counts differ, `/cad-suggest` counts decisions rather than writes,
and "one answer cleared two ranges" is something the record states rather than
something the coordinator smuggles into prose.

**Success criteria**

- `planning.mjs adjudication --phase 0` for a planned task writes under
  `.planning/tasks/{slug}/` and does not refuse. The hand-written
  `ADJUDICATION-risk_surface-declines-off-the-tracker.json` in this repository
  is replaced by one the seam produced, with no `note` field explaining itself.
- OQ-1 is answered in writing before any Case A code, and the chosen shape
  lets a settlement for an earlier window be written through the seam. The
  hand-append stops being the escape hatch.
- An `override` receipt carries an authorization id. Two receipts on one
  authorization share it; two receipts on two authorizations do not.
- `risk-check.mjs`'s `FIRE_RECEIPTS` handling can tell a re-application from a
  duplicate, and its `:718` guard is no longer the only thing standing between
  the two.
- `GH-227` and `GH-220` each trace to a REQUIREMENTS row pointing at Phase 2.

### Phase 3: The record states the effort that actually ran

Gated on OQ-2. Confirm the downgrade happens on the installed host before
writing anything; if it does not, close `GH-226` and end the cycle at two
phases.

If it does, the fix path is already established and the measurement is already
paid for: every hook input carries `effort`, so what a rung actually ran at is
observable at runtime rather than only at `route.mjs resolve` time.
`cadence-core/bin/subagent-trace.mjs` is the `SubagentStop` hook, already parses
the common hook input, already carries `agent_id` and `agent_type`, and already
writes the `worker_cache` and `return` events. It reads `effort` off the payload
it already has and puts it on the `return` event, so the record holds both
numbers - what was routed and what ran.

What to DO about a mismatch - warn, refuse, re-dispatch - is a separate
decision. Recording it honestly is the whole of this phase.

**Success criteria**

- OQ-2 is answered against the installed Claude Code version, with the evidence
  written down, before any code lands.
- A `lifecycle/return` event carries the effort the host reported for that
  dispatch, beside the routed effort already on `routing/resolve`.
- A dispatch whose hook input carried no effort is recorded as unrecorded,
  never as a match - the same rule the token and turn totals already follow.
- `/cad-report` states a routed/ran disagreement rather than smoothing it over.
- `GH-226` traces to a REQUIREMENTS row pointing at Phase 3, or is closed with
  its reason recorded if OQ-2 comes back negative.
