# Roadmap

## Overview

**`v3.5.7 - measured, and no lever to change it`, opened 2026-08-20.** Scoped
from the tracker milestone `v3.5.7`, which holds five issues: #167, #174, #189,
#193 and #206.

**The theme is one sentence: Cadence measures its own cost and gives you nothing
to spend it with.** `v3.5.6` closed the machinery that records what a run did.
This cycle takes the controls over what a run costs. A read trace that measures
read-set redundancy and no consumer that acts on the number (#167). A security
review invoked 61 times, paying 61 cold prefixes where one process reviewing N
diffs pays one (#174). `stakes` as a single project-level dial, so a README phase
and an auth phase buy the same model, the same effort rung and the same gates
(#189). And the one question Cadence asks on its own, the risk-surface interview,
asked exactly once with no way back to it and a menu that offers the same set
twice (#206). And blocking that blocks the RUN rather than the land, which is the
single constraint stopping Cadence from working while nobody watches (#193).

Three of the five are a control at the wrong granularity or missing outright.
#174 is the bill that granularity runs up, which is why it is scoped here rather
than filed as a cost note. #193 comes at the same sentence from the other end:
the guarantee worth keeping is that unreviewed work never reaches base, and that
guarantee does not require a human present at the moment the finding lands.

**Three phases, and two spikes that are deliberately NOT phases.** #167 and
#174 each carry an unknown their own issue says to resolve before betting on it.
#167: "Record `redundancy` per role across a few real phases before changing
anything... If the recorded per-role redundancy turns out to be near 1.0 on
current contracts, the 7.0x figure is historical and this closes with a note
rather than a change." #174: "whether a batched review over N diffs finds what N
single-diff reviews find. A per-commit review is scoped to one change on purpose,
so this is a real trade rather than free." Both run as `/cad-spike`, and `RDX-01`
and `BCH-01` are held in `## Active` unplanned until their spike returns a
verdict. A spike that comes back `invalidated` closes its issue with a note and
its id moves to Deferred carrying that note - it does not quietly vanish.

**Both spikes ran on 2026-08-21 and they split.** `RDX-01` **validated** and is
now Phase 4: in-dispatch read redundancy is 3.64 for `cad-executor` and 2.05 for
`cad-verifier`, nowhere near the 1.0 that would have closed #167 with a note -
though the 7.0x the issue carries IS historical, since it was measured over
declared read-sets rather than observed reads. The phase is scoped narrower than
the requirement's wording as a result
(`.planning/spikes/read-set-redundancy/SPIKE.md`).

`BCH-01` **invalidated** and moved to `## Deferred` carrying its note, which is
the exit this paragraph committed to. Batching saves 1.91% of reviewer spend and
2.09% at the 61 invocations #174 cites - the ratio is fixed at ~2% for any N,
because both sides scale with N. Reviewer cost is set by payload, not invocation
count: six observed dispatches span 25,753 to 125,100 tokens around a
1,676-token fixed prefix. The per-commit scoping #174 correctly names as a real
cost would have been traded for a rounding error, and the fidelity question was
never reached - C1 ended it for free, spending zero review dispatches
(`.planning/spikes/batched-review-fidelity/SPIKE.md`).

That last sentence is the point of writing this down. `v3.5.6` was scoped as
four issues, shipped one, and the other three were never planned into a phase
and never recorded as dropped, so nothing re-asked them. The audit could not
catch it either: that cycle seeded no requirement ids, so its trace arm ran over
zero requirements and returned PASS on an empty set while the coverage arm
carried the whole proof. This cycle seeds ids up front - `RDX-01`, `BCH-01`,
`CER-01`, `IVW-01`, `HLT-01` - so every one of the five is either traced to a
phase or visibly `unpicked` in `/cad-audit`.

`/cad-plan` seeds each requirement's Traceability row as its phase is planned.

## Phases


## Phase Details
