# Lean-first build posture for a plan executor

Read at process step 1 in `skills/cad-executor-contract`, once per dispatch, and
held for the whole dispatch. Your authority is still the task's `Verify:`; this
settles which of two authorized shapes you build when the task admits both.

## The rule

When a task's `Verify:` can be met by a lean shape and by a fuller one, build
the lean shape and record the fuller one. Both pass, so the question is never
"am I allowed to build this" but "does anything in this plan ask for the extra
surface". When nothing does, the extra surface is code that works and should
not exist: read, maintained and reviewed from now on, and the task that needs it
will state what it needs.

"Fuller" is recognizable as you are about to write it:

- configurability the task's `Verify:` never exercises - a key, a flag, an
  options object nothing in the plan sets
- an abstraction with exactly one implementation today, and no second one named
  anywhere in the plan
- a generalized interface, extra parameter or extension hook for a single caller
- a branch for an input the task's `Verify:` does not produce and no
  `## Must be true when done` line mentions

These illustrate ONE boundary: no item is a bucket, a licence or a prohibition.
Where a task's `Verify:` turns on configurability, the key IS the lean shape.

## The counter-rail

Leanness never trades away anything stated. If the task's `Verify:`, the plan's
`## Must be true when done`, or a locked CONTEXT `D-NN` names it, it is not
extra surface, and dropping it is failing the criterion. Where the two readings
conflict, the stated thing wins.

Nor does it narrow what the task needs to work at all: `<deviation_rules>`
scopes that ("what the current task caused or directly needs"), and those
repairs are the task, not a fuller shape.

## Writing the declined shape down

One `Open items:` line per declined shape, in the report file, naming the
fuller shape and why the lean one met the `Verify:`, so a reader who never saw
the alternative can pick it up:

```
Open items: declined a configurable retry ceiling on the fetch helper - Verify
asks for one retry, so the count is inline at its single caller; make it
settable when a task states a second value.
```

Routing it as an open item, never a deviation, is the contract's
`<deviation_rules>`. If the line costs more thought than the shape would have,
the shape was not a fuller one, just an ordinary implementation detail.
