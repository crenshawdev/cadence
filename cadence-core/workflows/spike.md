# cad-spike workflow

Resolve one unknown with a throwaway experiment. The value is in the order:
criteria first, riskiest assumption first, verdict last. Reversing any of those
turns a spike into wishful coding that declares success on an assumption.

## 1. Frame the question
State the unknown as a single question and the decision that hinges on it
(`$ARGUMENTS`, refined via the ask-user seam if vague). If nothing downstream
changes based on the answer, it is not worth a spike - say so and stop.

## 2. Write falsifiable criteria FIRST
Before building anything, write the acceptance criteria as Given/When/Then, each
with an OBSERVABLE outcome that decides validated vs invalidated:
> Given <setup>, When <action>, Then <measurable result> -> validated;
> <the opposite observation> -> invalidated.
Vague criteria ("it feels fast enough") are not allowed - pin a number, an
output, a behavior. Write them into a SPIKE.md before the experiment exists, so
the result cannot be rationalized after the fact.

## 3. Order risk-first
Rank the criteria so the assumption most likely to KILL the approach is tested
first. The point is to fail fast: if the riskiest thing does not hold, the spike
is over and the later criteria never run. Order for fastest disproof, not for
easiest confirmation.

## 4. Run the experiment (throwaway)
Build the minimum throwaway code in a scratch location (`.planning/spikes/<slug>/`
or a temp dir) - NOT in the project's real source. Run the criteria in
risk-first order. Stop the instant a risk-first criterion invalidates the
approach; do not keep polishing a dead idea. Record each criterion's actual
observation as you go.

## 5. Verdict
One of, with the evidence behind it:
- **validated** - the criteria held; the approach is safe to plan on.
- **invalidated** - a criterion failed; the approach is out (this is a win - it
  saved the real build). Say what specifically failed.
- **inconclusive** - the experiment could not decide (blocked, needs more than a
  spike). Say what would decide it. Do not use this to avoid an invalidated call.

## 6. Slim wrap-up
Write ONE SPIKE.md: the question, the criteria, the observed result per
criterion, the verdict, and the recommendation for the plan (what to do given
the answer). No five-artifact ceremony. Discard the throwaway code or note where
it is; it is not project source. Commit SPIKE.md (`docs: spike <slug>`,
protected-branch guard) so the decision record survives.
