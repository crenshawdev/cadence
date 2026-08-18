# Roadmap

## Overview

**`v3.5.4 - the gate that clears itself wrong`, opened 2026-08-18.** Scoped from
the capture queue's open review findings and the v3.5.3 close, which holds nine
issues: #215, #136, #210, #211, #214, #207, #176, #181 and #187.

**The theme is one sentence: a gate that reports a verdict it did not earn.**
Every item is a check that already runs and already answers, and answers wrong in
a way its own output cannot show. That is the shape `v3.5.3` closed for controls
that never reached their path; this cycle closes it for controls that reach the
path and mis-answer once they are there.

The three phases are ordered by what a wrong answer costs, not by where the code
lives. Phase 1 carries the two whose wrong answer destroys something - a
credential fragment left in an excerpt, and a recursive delete taken on a git
state nobody could read. Phase 2 carries the ship gate that FAILs correct docs,
which is the failure that stops a release rather than corrupting one. Phase 3
carries three flags that do more or less than they say, where the cost is a user
believing a control they do not have.

Two of this cycle's candidates were cut before it opened rather than scheduled.
`VER-01` and `CAP-02` each described a sentence that could be misread, and the
v3.5.3 close was their counter-evidence: the deep verifier wrote `why_human` on
two phase-5 UAT items and the walk executed them rather than handing them back,
and the blocking `risk_surface` gate re-armed exactly once. Neither failure mode
occurred. They are closed as #212 and #213, to be refiled on a run that carries a
trace if one ever happens.

`#187` is not a phase. It is a verification item this cycle satisfies by having
its own commits cite their issue numbers, so `/cad-land`'s tracker line exercises
the `referenced` arm rather than falling back to the open list - which is what
the v3.5.3 land did, and why the item is still open.

## Phases



## Phase Details
