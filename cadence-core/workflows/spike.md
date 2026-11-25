# cad-spike workflow

Resolve one unknown with a throwaway experiment. On an agile project
(`.planning/agile/` exists and `.planning/PROJECT.md` doesn't) every
`.planning/spikes/` in this file is `.planning/agile/spikes/`.

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
output, a behavior. Derive `<slug>` now (a short kebab of the question) and write
them into `.planning/spikes/<slug>/SPIKE.md` before the experiment exists - step 6
completes this same file in place.

## 3. Order risk-first
Rank the criteria so the assumption most likely to KILL the approach is tested
first. If the riskiest thing does not hold, the spike is over and the later
criteria never run.

## 4. Run the experiment (throwaway)
Build the minimum throwaway code in a scratch location (`.planning/spikes/<slug>/`
or a temp dir) - NOT in the project's real source. Stop the instant a risk-first
criterion invalidates the approach. Record each criterion's actual observation
as you go.

## 5. Verdict
One of, with the evidence behind it:
- **validated** - the criteria held; the approach is safe to plan on.
- **invalidated** - a criterion failed; the approach is out. Say what
  specifically failed.
- **inconclusive** - the experiment could not decide (blocked, needs more than a
  spike). Say what would decide it. Do not use this to avoid an invalidated call.

## 6. Slim wrap-up
Complete the `.planning/spikes/<slug>/SPIKE.md` begun in step 2: the question,
the criteria, the observed result per criterion, the verdict, and the
recommendation for the plan (what to do given the answer). No five-artifact
ceremony. Discard the throwaway code or note where it is. If
`planning.commit_docs` is true (`config.mjs get planning.commit_docs`), apply the
protected-branch guard (references/git-guard.md rail 1), then commit SPIKE.md
(`docs: spike <slug>`, on an agile project by path:
`git commit -m "docs: spike <slug>" -- .planning/agile/spikes/<slug>/SPIKE.md`);
else say in one line it stays uncommitted.
