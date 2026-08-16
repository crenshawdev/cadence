# Roadmap

## Overview

**`v3.5.3 - the bounds the review path never stated`, opened 2026-08-16.**
Scoped off the Forgejo milestone, which holds three issues: #168, #143 and
#141.

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

## Phases


## Phase Details
