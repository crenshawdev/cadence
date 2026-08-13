# Lean-first build posture for a plan executor

Read at process step 1 in `skills/cad-executor-contract`, once per dispatch, and
held for the whole dispatch. It changes nothing about WHAT authorizes a change -
your authority is still the task's `Verify:` - it settles which of two already
authorized shapes you build when the task admits both.

## The rule

When a task's `Verify:` can be met by a lean shape and by a fuller one, build
the lean shape and record the fuller one. Both shapes pass: that is the whole
premise, so the question is never "am I allowed to build this", it is "does
anything in this plan ask for the extra surface". When nothing does, the extra
surface is code that works and should not exist - read, maintained and reviewed
from now on, and the task that eventually needs it will state what it needs,
which is rarely what you guessed.

"Fuller" is recognizable at the moment you are about to write it:

- configurability the task's `Verify:` never exercises - a key, a flag, an
  options object nothing in the plan sets
- an abstraction with exactly one implementation today, and no second one named
  anywhere in the plan
- a generalized interface, extra parameter or extension hook for a single caller
- a branch for an input the task's `Verify:` does not produce and no
  `## Must be true when done` line mentions

Those are illustrations of ONE boundary, never buckets to sort a change into.
No item is a licence and no item is a prohibition: where a task's `Verify:`
turns on configurability the key IS the lean shape, and the list has nothing to
say about it.

## The counter-rail

Leanness never trades away anything stated. If the task's `Verify:`, the plan's
`## Must be true when done`, or a locked CONTEXT `D-NN` names it, it is not
extra surface, and dropping it is not leanness - it is failing the criterion
under a nicer word. This is a choice between two shapes that both pass, never a
licence to pass less, so where the two readings conflict the stated thing wins
and there was never a decision to make.

Nor does it narrow what the task needs to work at all. `<deviation_rules>`
already scopes that - "what the current task caused or directly needs" - and
those repairs are the task, not a fuller shape.

## Writing the declined shape down

One `Open items:` line in the report file, naming the fuller shape you did not
build and the reason the lean one met the `Verify:`. Enough that a reader who
never saw the alternative can pick it up:

```
Open items: declined a configurable retry ceiling on the fetch helper - Verify
asks for one retry, so the count is inline at its single caller; make it
settable when a task states a second value.
```

Its ROUTING - open item, never a deviation, because nothing turned out wrong -
belongs to the contract's `<deviation_rules>`, and the wording belongs here, so
neither restates the other. One line per declined shape, in the report you were
writing anyway. If the line costs more thought than the shape would have, the
shape was not a fuller one and you are recording an ordinary implementation
detail.
