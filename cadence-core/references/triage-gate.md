# The consequence gate (triage)

What each gate arm does once a review's findings are in hand. The gate is one of
`off | advisory | blocking | adjudicated`, resolved from the routing bundle at
`references/review-triggers.md` step 1 - `off` returned before any reviewer ran.

- **advisory** - report the findings, continue. Nothing halts.
- **blocking** - PASS if no `blocker`/`high` finding survives, else FAIL. On
  FAIL, halt and surface the findings; resume only after they are fixed or the
  user explicitly overrides. A reviewer that could not run does not silently
  PASS - report that the gate could not be evaluated and ask. The re-arm on that
  fix is CAPPED - see below.

**The blocking re-arm is capped at ONE round.** A fix made to clear a blocking
FAIL is itself reviewable work, so the trigger re-arms on it; unbounded, that is
a loop with no terminal state. It is bounded in the vocabulary the spine's other
blocking loop already uses (`workflows/plan.md`'s ONE revision, maximum):

1. The fix lands -> fire ONCE more, NARROWED: the artifact is the fix's own diff
   plus the blocker list it is confirming, NOT the whole artifact again, and it
   asks one question - is each blocker actually closed, and did the fix introduce
   anything new?
2. Nothing `blocker`/`high` survives that pass -> resume. One still survives ->
   STOP and ask the user (ask-user seam): proceed anyway, or stop and fix by
   hand. Name the reason in the ask - "`<trigger>` re-armed once on its own fix
   and still reports N blocker/high findings" - and never fire that trigger again
   in this loop.

The round count PERSISTS in the trace, so a `/clear` between rounds cannot
reset it. Before firing the narrowed round, run
`planning.mjs trace render --phase <N>`: the envelope's `corr` is the current
run's id, and a `rearm` outcome for this trigger already recorded under that
same id means the one round is SPENT - do not fire again, go straight to the
STOP-and-ask arm above. No such event -> record the round as you fire it:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" trace append --phase <N> --family outcome --event rearm --detail "<trigger>"
```

A fresh `phase_start` (a genuine re-run) derives a new id and gets a fresh
round. The append is best-effort by the trace seam's own contract: when the
record cannot be written or read, the count falls back to what this context
remembers - the pre-persistence behavior, not a new failure mode.
- **adjudicated** - the survivors are already grounded, so what remains is the
  USER's choice, not the model's. Present them as a NUMBERED list, one line per
  survivor: severity, `file:line`, claim. Then ask which to act on through
  `AskUserQuestion` with `multiSelect: true`, and END THE TURN on that question.
  NONE is the first option in every question and the default. Nothing is
  applied, committed, published or re-planned against a survivor the user did
  not name. When nothing survives, say the review RAN and adjudication killed
  everything, not a bare "no findings".

**Two caps, two different numbers.** One question carries at most four options
and NONE occupies one of them, so N survivors become `ceil(N/3)` questions - at
most three survivors per question, NONE first in every one. Those questions then
batch at most four per `AskUserQuestion` call. Options per question and questions
per call are separate caps; collapsing them is what produces the wrong batch
size.

**A contradictory answer re-asks, once.** A multi-select question can come back
with NONE selected TOGETHER with one or more survivors. That answer is
contradictory and is not resolved by guessing which half the user meant:
re-present that single question on its own and take the second answer as final.
Only that question re-asks - the rest of the batch stands.

**The `git.auto_close` carve-out is scoped to `pre_ship` inside `/cad-land`.**
At that trigger, in that command's unattended close only, the adjudicated arm
does not prompt at all: triage is NONE by construction and `land-cleanup.mjs
gate`'s blocker/high halt is the only consequence. The scope is load-bearing
rather than stylistic - no other trigger and no other command reads that key,
and `land-cleanup.mjs gate` does not run outside `/cad-land`, so suppressing the
ask at `plan`, `diff` or `phase_diff` would discard grounded survivors with
nothing left to halt on them.

Adjudicated does not auto-halt like `blocking`, and it is not the auto-replan
convergence loop (cut in DESIGN §6) - it grounds once and asks. Use it for the
deep, rare gates (plan, pre_ship).

`cad-verify` routes fix requests through fire() (a review producing the fix
list), not its own fixer loop. That fire names no wiring-table trigger and has
no resolved gate: its list is always triaged through the `adjudicated` rule
above, before any of it is proposed as a fix.
