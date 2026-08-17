# Roadmap

## Overview

**`v3.5.3 - bounds not stated, costs not counted`, opened 2026-08-16.**
Scoped off the Forgejo milestone, which holds eight issues: #168, #143, #141,
#198, #199, #200, #201 and #202.

**The theme is one sentence: the review path accepts whatever comes back, and
one workflow arm recovers from a state that cannot happen.** All three came
from the same external deep dive, two adjudicated AGREE-low and one narrowed
from a finding closed as not-a-Cadence-defect. None is a trust boundary, which
is why they sit at low severity; each is a stated bound the code never actually
states.

`#143` is the response body. `review-provider.mjs` concatenates a provider
response into an unbounded string with no byte ceiling and no destroy path, so
a proxy error page or an unexpectedly large answer is held whole in memory, and
an HTTP failure envelope carries the entire body rather than a capped excerpt.
The host's wrapping command timeout bounds it in practice, which is a bound
Cadence does not own.

`#141` is the shape of what came back. Local validation of a provider's
findings checks an integer `line` and three string fields and nothing else, so
it admits `line <= 0`, empty strings, unknown keys and arbitrarily many
arbitrarily large findings, while the canonical schema says
`additionalProperties: false`. The output goes to a human for triage, so this
is a degradation guard rather than a boundary, and it should still refuse what
the schema refuses.

`#168` is the wiring. `execute.md` opens a recovery arm labelled "timeout or no
report" when nothing in the dispatch path can time out - `seams.md` says so in
those words, and `subagent_timeout` was deleted in v2.7.0 rather than kept as a
knob nothing enforces. Either the word is dead or it silently means "the user
interrupted", which is a different condition with a different recovery. The
default reviewer arm is the one unbounded path left beside it.

Phases are not yet added - `/cad-phase add` opens the first.

## What the record never counted

The other half of this milestone came out of a cost pass on 2026-08-16 rather
than the deep dive. Measured on this repo: `trace.jsonl` recorded 795,845 tokens
for the whole `v3.5.2` milestone across 6 dispatches, while burnrate recorded
16,261,487 billed-equivalent for the project on that one day. The ~20x is
structural rather than a bug. The trace records a figure on a subagent RETURN
only, so the orchestrator contributes zero to it and 59% of actual spend. It
carries no cache fields at any key across all 833 events. And it records neither
turns nor window size, which are the two terms the bill is actually made of.

Decomposed over 7 days: cache-read is 62.5% of spend (181,626,530
billed-equivalent over 1,816,265,297 raw tokens), cache-write another 37.5%, and
fresh input rounds to 0.0%. Across 15,579 messages the average context window is
121,250 tokens. So `cost ~= turns x window x 0.10`, and cache HIT RATE is not the
lever - it is already 96.1% and cache-read is the cheap rate.

`#199` records the tool-call count the return already carries and Cadence
discards (MSR-01). `#198` prices a run from a record that can see the whole
window instead of worker-return tokens (MSR-02). `#202` budgets the live window
the way shipped prose surfaces are already budgeted to the byte (MSR-03). `#200`
applies `v3.5.2`'s own file-transport lesson to bulk tool OUTPUT rather than
caller-derived input (TRN-02). `#201` re-decides `workflow.max_plan_tasks`
against cold-prefix cost as well as context risk, since the current value was set
against only the measured half (PLN-01).

MSR-01 or MSR-02 unblocks MSR-03 and PLN-01; neither is arguable while turns and
window go unrecorded.
## Phases

- [x] **Phase 1: The controls that never reached their path** - recall survives a milestone close, the parallel branch runs the same risk sequence the sequential one does, and `risk-check status` stops accepting a matched range with no fire behind it
- [x] **Phase 2: The record learns to see the run** - `trace close` records the tool-call count the return already carries, and `/cad-report` / `/cad-suggest` price a run from a record that can see the whole window instead of worker-return tokens alone
- [ ] **Phase 3: Bounds the review path never stated** - a provider response is bounded by bytes, local validation of provider findings refuses what the canonical schema refuses, and `execute.md`'s "timeout or no report" arm either names what produces that state or loses the word
- [ ] **Phase 4: Costs argued from the new record** - the record Phase 2 taught to see turns and window gets spent: a live window is budgeted, bulk tool output rides a file, and `workflow.max_plan_tasks` is re-decided against both forces


## Phase Details

### Phase 1: The controls that never reached their path
**Goal:** Three controls Cadence already has stop being unreachable from the
path that needs them: the recall corpus survives a milestone close, the parallel
execute branch runs the same risk sequence the sequential one does, and
`risk-check status` refuses a matched range carrying no outcome event.
**Depends on:** Nothing
**Requirements:** RCL-07, PAR-01, GAT-04

Adjudicated from the external strict re-review of 2026-08-16. Ten findings in,
five killed as already-filed, already-deferred or by-design, three survived
verification against the code, one fixed inline as a doc contradiction
(`docs/WORKFLOW.md` said the shipped `plan` gate was `off` when the route table
says `blocking`), and one - the append-only caps - left open at 17% and 19% of
its ceilings.

The three that survived share a shape: the control EXISTS, is correct, and does
not reach the path that needs it.

`RCL-07` is the one that falsifies a stated claim rather than a documented rail.
`PROJECT.md`'s Core Value says what Cadence writes down "must come back on its
own at the moment it matters". `milestone-prune` deletes `phases/<N>/` at the
close and the corpus walker (`planning.mjs:2036-2064`) reads only live phase
dirs plus `CAPTURE.md`, so every shipped SUMMARY, UAT and CONTEXT decision goes
unreachable. Reproduced live here hours after the `v3.5.2` close: a recall for
this milestone's own lease-grammar decisions returns `CAPTURE.md` hits and
nothing else. Nothing is LOST - git holds it - so this is reachability, not
durability, and the fix shape the tree already chose for the same problem one
layer up is the `## Shipped` residue that keeps requirement rows traceable after
the dirs are gone.

`PAR-01` is arithmetic: `grep -c risk-check` returns 2 for
`workflows/execute.md` and 0 for `references/execute-parallel.md`. The one gate
that is `blocking` at every stakes level does not exist on the parallel path,
and `risk-check status` - which the sequential branch requires before a plan may
be reported done - is never called there, so the two branches disagree about
what "done" means. This repo's move to `stakes: critical` buys compensating
`diff` and `phase_diff` cover but not the detector receipt.

`GAT-04` is the same argument one step out. `risk-check status` proves a range
was READ and RECORDED; it does not prove the blocking fire happened. A
coordinator can run the detector, skip the fire, and still receive `ok:true`.
Cadence's stated failure model is a fallible coordinator, and the tree
repeatedly replaces "the prose says to" with "the seam refuses" - this is that
move applied to the one gate that never got it.

**Success criteria:**
- A recall query for a decision, UAT item or deviation from a CLOSED milestone
  returns it, on both the `delete` and `archive` prune arms, with the corpus
  source named in the result.
- `references/execute-parallel.md` reaches the same risk sequence
  `workflows/execute.md` states - detector, conditional fire, status - without
  restating it as a second copy, and a parallel plan cannot be reported done
  while `risk-check status` refuses.
- `risk-check status` refuses a range recorded as `matches` non-empty or
  `inconclusive: true` that carries no adjudication, re-arm or explicit-override
  outcome event under the same correlation id, and an explicit user override
  records an event of its own so a deliberately cleared range still passes.
- A check fails against the unpatched code first for each of the three, and the
  watched FAIL is recorded with its SHA.

### Phase 2: The record learns to see the run
**Goal:** The two terms the bill is actually made of - turns and window - stop
being absent from `trace.jsonl`, so a run's price can be argued from the record
rather than from a figure that structurally cannot include the orchestrator.
**Depends on:** Nothing
**Requirements:** MSR-01, MSR-02

This phase is the measurement, not the cut. `## Active` states the ordering it
comes from: MSR-01 or MSR-02 unblocks MSR-03 and PLN-01, and neither of those is
arguable while turns and window go unrecorded. Budgeting a live window (MSR-03)
and re-deciding `workflow.max_plan_tasks` against cold-prefix cost (PLN-01) are
both arguments from figures this record does not hold yet, so planning them
first would be planning against the same blind spot this phase exists to close.

The gap is structural rather than a bug, which is why it needs a phase rather
than a fix. Measured on this repo 2026-08-16: `trace.jsonl` recorded 795,845
tokens for the whole `v3.5.2` milestone across 6 dispatches, against burnrate's
16,261,487 billed-equivalent for the project on that one day. The trace records
a figure on a subagent RETURN only, so the orchestrator - 59% of actual spend -
contributes zero to it by construction. No key carries a cache field across all
833 events. And neither turns nor window size is recorded anywhere, which is
what makes the ~20x unrecoverable from the file: `cost ~= turns x window x 0.10`,
and the record holds neither factor.

Cache hit rate is deliberately NOT the target. Decomposed over 7 days,
cache-read is 62.5% of spend and cache-write 37.5%, with fresh input rounding to
0.0% - and the hit rate is already 96.1%, at the cheap rate. The lever is turns
against a 121,250-token average window, which is exactly the pair this phase
makes visible.

`MSR-01` (#199) is the cheaper half and the one with no new plumbing: the
tool-call count is already on the subagent return that `trace close` reads, and
Cadence discards it. Recording it makes turns per dispatch and per role visible
without changing what any worker does.

`MSR-02` (#198) is the reader half. `/cad-report` and `/cad-suggest` price a run
today from worker-return tokens, the one figure that provably excludes the
majority of spend, and both present that price to the user as the run's cost.

**Success criteria:**
- `trace close` persists the tool-call count the subagent return carried, and a
  render of that phase's record reports turns per dispatch and per role rather
  than tokens alone.
- A dispatch whose return carries no tool-call figure is recorded as unrecorded
  rather than as zero, so a silent return is never priced as a free one.
- `/cad-report` and `/cad-suggest` state what their figure does and does not
  include, and no longer present a worker-return token sum as the run's cost.
- The measured ~20x gap is reported against a named external figure rather than
  asserted, so a later phase can argue MSR-03 and PLN-01 from it.
- A check fails against the unpatched code first for each requirement, and the
  watched FAIL is recorded with its SHA.

### Phase 3: Bounds the review path never stated
**Goal:** The three places the review path asserts a control it does not hold
stop asserting it: a provider response is bounded by bytes rather than by the
host's wrapping timeout, local validation refuses exactly what the canonical
schema refuses, and a recovery arm stops naming a state nothing in the dispatch
path can produce.
**Depends on:** Nothing
**Requirements:** RVP-01, RVP-02, WIR-01

These are the three the milestone was originally scoped off - #143, #141 and
#168 - and the half that has not moved. Two were adjudicated AGREE-low from the
external deep dive and one was narrowed from a finding closed as
not-a-Cadence-defect. None is a trust boundary, which is why they sit at low
severity, and none is a bug in the ordinary sense: in each the code works and
the prose around it claims a bound the code never states.

`RVP-01` is the response body. `review-provider.mjs` concatenates a provider
response into an unbounded string with no byte ceiling and no destroy path, so a
proxy error page or an unexpectedly large answer is held whole in memory, and an
HTTP failure envelope carries the entire body rather than a capped excerpt. The
host's command timeout bounds it in practice - a bound Cadence does not own, and
the distinction is the whole finding.

`RVP-02` is the shape of what came back. Local validation checks an integer
`line` and three string fields and nothing else, so it admits `line <= 0`, empty
strings, unknown keys and arbitrarily many arbitrarily large findings, while the
canonical schema says `additionalProperties: false`. The output goes to a human
for triage, so this is a degradation guard rather than a boundary - and it
should still refuse what the schema refuses, or the schema is decoration.

`WIR-01` is the wiring. `execute.md` opens a recovery arm labelled "timeout or
no report" when nothing in the dispatch path can time out - `seams.md` says so
in those words, and `subagent_timeout` was deleted in v2.7.0 rather than kept as
a knob nothing enforces. Either the word is dead or it silently means "the user
interrupted", which is a different condition with a different recovery.

**Success criteria:**
- A provider response crossing the stated byte ceiling destroys the request
  rather than concatenating past it, and the failure envelope carries a capped
  sanitized excerpt rather than the whole body.
- Local validation refuses `line <= 0`, an empty `file` / `claim` /
  `failure_scenario`, an unknown key, and a finding count or field length past
  its stated bound - each with a named diagnostic rather than a silent drop.
- Those refusals are the canonical schema's own: a fixture the schema rejects is
  rejected locally and one it accepts is accepted, with no third answer.
- `execute.md` carries no recovery arm for a state nothing in the dispatch path
  can produce - the arm names its producer or the word goes - and `seams.md` and
  the arm agree in the same words.
- The default reviewer arm states its own bound rather than standing as the one
  unbounded path beside a bounded one.
- A check fails against the unpatched code first for each of the three, and the
  watched FAIL is recorded with its SHA.

### Phase 4: Costs argued from the new record
**Goal:** The record Phase 2 taught to see turns and window gets spent on the
three decisions that were not arguable without it: a live context window is
budgeted the way shipped prose surfaces already are, bulk tool OUTPUT rides a
file the way caller-derived input now does, and `workflow.max_plan_tasks` is
re-decided against cold-prefix cost as well as context risk.
**Depends on:** Phase 2
**Requirements:** MSR-03, TRN-02, PLN-01

`## Active` states this ordering rather than assuming it: MSR-01 or MSR-02
unblocks MSR-03 and PLN-01, and neither is arguable while turns and window go
unrecorded. Phase 2 closed that, so this phase is the cut the measurement
bought - the point where a figure in `trace.jsonl` changes a shipped default
instead of only describing one.

`MSR-03` (#202) budgets the live window. Cadence already budgets shipped prose
surfaces to the byte and fails self-verify on a crossing in either direction;
the dispatch window - the larger term of `cost ~= turns x window x 0.10`, at a
measured 121,250-token average - carries no budget at all. The asymmetry is the
finding: the small surface is governed and the large one is not.

`TRN-02` (#200) applies `v3.5.2`'s own file-transport lesson to the other
direction. That milestone moved caller-derived INPUT onto a file and stated the
rule once; bulk tool OUTPUT still rides the transcript, where it is paid for on
every subsequent turn at the cache-read rate that is 62.5% of spend.

`PLN-01` (#201) re-decides `workflow.max_plan_tasks`. The current value was set
against context risk alone - one of the two forces - and cold-prefix cost is the
half the record could not see until now. The requirement is a recorded decision
against both, not a change: landing on the same number for a stated reason
satisfies it.

**Success criteria:**
- A dispatch's live context window is measured and budgeted, and a crossing is
  reported in the same failure shape a prose-surface budget crossing already
  uses rather than a new one.
- The budget's numbers are argued from `trace.jsonl` keys Phase 2 made
  recordable, with the source key named, rather than from an asserted constant.
- Bulk tool OUTPUT rides a file rather than the transcript, the rule is stated
  once, the sites carrying it are registered, and self-verify reads that
  register and fails when a site drifts off it.
- `workflow.max_plan_tasks` carries a written decision naming both forces -
  cold-prefix cost and context risk - with the measured figure behind each and
  the value it lands on, whether or not that value changes.
- A check fails against the unpatched code first for each requirement, and the
  watched FAIL is recorded with its SHA.
