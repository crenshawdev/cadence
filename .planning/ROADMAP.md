# Roadmap

## Overview

**`v3.2.0 - the controls that reported success`, opened 2026-08-13.** Scoped from
a full-codebase security and quality audit rather than from the capture queue.
Three parallel deep scans ran over ~34k lines of `.mjs` with 1420 tests green and
`self-verify` clean across all 20 checks, and every finding in this cycle was
reproduced against the real code before it was written down.

**The theme is one sentence: a control that reports success without having
checked is worse than no control**, because the product advertises the check and
the user stops looking. Four of the nine are silent by construction. `config.mjs
validate` returns `{"ok":true,"checked":0,"errors":[]}` on a config that is
actively disabling the git rails. `milestone-prune` records a deliberately
deferred requirement as delivered, inside the command whose stated job is
auditing that nothing was dropped. The unattended-close gate reports "no
surviving blocker/high finding" about input it never read. And `atomicWrite`
follows a symlink that the read path, nine hundred lines away, already defends
against with a comment explaining why.

**Phase 1 goes first because two of them are the same fact.** `CFG-01` and
`CFG-02` both come down to a tracked `.planning/config.json` being
attacker-controlled input rather than the user's own settings, and they share one
hostile-repo fixture. Fixing either alone leaves the other's proof standing.

**Phase 3 is the same theme one level up.** The review arm cannot currently tell a
gate that found nothing from a reviewer that produced nine false positives, so
its own tuning advice is computed over a figure that conflates them. `RVW-01`'s
first item costs zero tokens and is what makes the other three measurable rather
than asserted, which is why it is ordered ahead of them inside the phase. `RVW-02`
joined the phase on 2026-08-13, from a substitution caught in flight rather than
from the audit: the gate half of a review fire is resolved by the seam and the
REVIEWER half by prose, so a blocking `risk_surface` fire went to a same-model
subagent while `review.reviewers` said `openai`, and nothing refused it or
recorded it.

**The cycle adds no new surface.** Every phase hardens what already ships.
`LND-01` was scoped into phase 4 and CUT on 2026-08-14 before execution: it was
the one remaining item that ADDED a mechanism, at a point where the evidence
said the next improvement comes from deleting mechanisms rather than adding
gates, and its GitLab arm could not be tested here. It is `## Deferred` with
issue #121 open. What remains is `CST-03` and `HYG-01`, which retune a bound,
stop a surface reporting an unmeasured figure as spend, and clear the audit's
low-severity residue so it is not carried into another cycle.

## Phases


## Phase Details
