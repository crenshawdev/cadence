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


## Phase Details
