# Consult: on-demand second-model help at a dead-end

The counterpart to the review subsystem (references/review-triggers.md). Review
is scheduled critique of an artifact; consult is reactive help when the primary
model is stuck. It reuses the same provider connections (the call-review-provider
seam) but for a different job: `consult` returns angles to investigate, never a
verdict on an artifact. It codifies the "phone a friend" move at the dead-ends
GSD rails you past without one.

The hard rules (DESIGN §6), in order of importance:

1. **Always user-approval-gated.** Even when a trigger condition is met, a
   workflow OFFERS a consult and waits for an explicit yes. It NEVER
   auto-consults. (Review can fire automatically per its gate; consult always
   asks, because it spends a second model's tokens on a judgment call.)
2. **Decision-support, never delegation.** The consult returns
   hypotheses/angles. The main model grounds each against the real code, and the
   USER decides. It never takes the wheel or auto-picks a process fork.
3. **Triggered by observable state, not self-assessment.** Offer only when a
   counter/checkpoint the system can see is hit - never "the model feels stuck"
   (the least reliable signal; the feature meant to fight thrashing would
   otherwise cause it).
4. **Bounded.** One consult per dead-end, unless genuinely new information
   appears. Advisory only.
5. **Opportunistic.** Available only if a provider is wired (`review.consult.
   enabled` true and a provider tier is assigned). No key -> the offer is simply
   not made; there is no claude-subagent consult (a second Claude is not a second
   opinion). The spine is never blocked by its absence.

## offer_consult(dead_end)

1. **Gate.** If `review.consult.enabled` is false, or no provider has a model at
   `review.consult.tier`, do nothing (no offer). Else continue.
2. **Bound.** If a consult was already spent on THIS dead-end and no new
   information has appeared since, do not offer again.
3. **Offer (ask-user seam).** Present the option: "Stuck at <dead-end>. Consult a
   second model (<provider>/<model>) for angles to try?" with choices
   `[Consult | Keep going without it]`. Wait for an explicit yes. A no ends here.
4. **Call.** On yes, run the seam:
   ```
   node "$HOME/.claude/cadence-core/bin/review-provider.mjs" consult \
     --provider <name> --model <review.consult.tier -> id> \
     --effort <review.consult.effort> [--key-file <review.key_file if set>]
   ```
   with `{situation}` on stdin - a tight description of the dead-end: the goal,
   what was tried, the exact failing signal. Read the one JSON line.
   - `ok:false` -> report `reason` and continue without a consult (never block).
   - `ok:true` -> `angles[]`, each `{hypothesis, rationale, how_to_check}`.
5. **Ground, then hand to the user.** For each angle, the main model checks it
   against the real code/state - confirm plausible, kill what the code already
   rules out - and presents the surviving angles as options to try. The user
   picks the next move. The consult never decides it.

## Where it lives (observable triggers)

| Dead-end (observable) | Home | Offer after |
|---|---|---|
| N failed fix attempts on one bug | cad-debug | the Nth failed attempt |
| Test still red after K debug iterations | cad-debug | K iterations |
| Exhausted hypotheses | cad-debug | the hypothesis set is empty, bug unresolved |
| Structural-deviation stop | cad-execute | the executor returns a structural checkpoint |
| PHASE TOO BIG | cad-plan | the plan cannot fit one pass |

All rows are live: cad-debug references this file at its three dead-ends
(Attempts >= 3, test red after 3 iterations, exhausted hypotheses), and
cad-execute's structural checkpoint and cad-plan's PHASE-TOO-BIG reference it at
those points.

## Config

`review.consult = { enabled, tier, effort }`. `enabled` is the switch; `tier`
resolves against `review.providers.<name>.tiers` like any trigger (flagship by
default - dead-end help wants the strongest reasoner); `effort` is high. Which
provider: the first configured reviewer whose consult tier is assigned.
