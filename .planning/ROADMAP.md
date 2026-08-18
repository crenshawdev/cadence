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

- [x] **Phase 1: What a wrong answer destroys** - the excerpt stops carrying a truncated credential, and `cad-phase remove` refuses a git state it could not read instead of deleting recursively
- [x] **Phase 2: The ship gate that FAILs correct docs** - version drift, the interrupted-close exemption and tag discovery stop reporting a break on a repository that has none
- [x] **Phase 3: Flags that do more or less than they say** - raising stakes moves both halves of a review panel, `git.create_tag` governs the tag rather than the whole release step, and the per-issue resolve bound is a land's budget rather than a call's


## Phase Details

### Phase 1: What a wrong answer destroys
**Goal:** The two checks whose wrong answer costs something irreversible stop
costing it: `bodyExcerpt` cannot leave a window-edge-truncated credential in a
failure excerpt, and `cad-phase remove` refuses an unreadable git state rather
than reading it as clean and deleting a phase directory recursively.
**Depends on:** Nothing
**Requirements:** EXP-02, PHS-01

These two share no code and are together because they share a consequence. Every
other item in this cycle costs a wrong verdict; these two cost a secret and a
directory.

`EXP-02` (#215) is the one blocker/high finding carried out of v3.5.3 that was
not already fixed. `bodyExcerpt`'s trailing-token safeguard runs only when
`clean <= room`, so a sanitizer shrink can pull a truncated credential's head
under the cap while `clean` still exceeds it - measured at ~36 bytes of secret on
the fire's own scenario.

`PHS-01` (#136) is `uncommittedUnder` returning an empty array whenever
`git status` fails. An unreadable git state reads as a clean one, and the
recursive delete follows.

### Phase 2: The ship gate that FAILs correct docs
**Goal:** `/cad-audit` stops reporting a break on a repository that does not have
one: the version comparand reads the milestone names rather than the first token
of free prose, the interrupted-close exemption holds in the state the workflow
declares exempt, and tag discovery cannot reach an enclosing repository.
**Depends on:** Nothing
**Requirements:** DRF-01, DRF-02, TAG-01

One fix site cluster and one failure: a gate that blocks a ship it had no reason
to block. All three were raised at the v3.5.2 diff review, grounded against the
live files, and left open because each sat outside the firing phase's lease.

`DRF-01` (#210) reproduces on a fixture and this repository is one clause reorder
from it. `DRF-02` (#211) fires in exactly the state `audit.md` declares exempt,
offering a remedy `verify.md` says is impossible, because `blocked` is terminal.
`TAG-01` (#214) is the same shape one level out: a project that is not itself a
repository inherits an umbrella repository's tags and can be failed by a version
it never published.

### Phase 3: Flags that do more or less than they say
**Goal:** Three controls stop misdescribing their own reach: raising `stakes`
moves both halves of a cross-model panel rather than the subagent half alone,
`git.create_tag` governs the tag rather than serving as the release-mode
discriminator for a whole workflow step, and the per-issue resolve bound is a
land's budget rather than a per-call one.
**Depends on:** Nothing
**Requirements:** RVW-03, REL-01, ISS-01

The cost here is a user believing they hold a control they do not.

`RVW-03` (#207): `route-table.json` carries three separate vocabularies for what
a user reads as one dial, so raising stakes upgrades the subagent reviewer and
leaves the cross-model one where it was. `REL-01` (#176) was hit live at the
v3.4.1 close: `git.create_tag` is documented as "Tag on milestone" and read as
the release-mode discriminator for all of `milestone.md` step 2, so setting it
false skips the manifest bump too. `ISS-01` (#181): `issue-check.mjs` stops its
resolve loop only on `timedOut`, so a `tea` that answers slowly and exits
non-zero is never marked timed out and each capped resolve can burn nearly the
full call timeout.
