# Why /cad-progress is shaped this way

Companion to `cadence-core/workflows/progress.md`. **Not read at runtime** - no
workflow, skill or agent loads this file, and it is outside every budgeted
prose surface (`weight.mjs` measures `cadence-core/workflows/*.md` top-level
only).

Read it before EDITING that workflow. Anchors match the step names.

---

## route - why the `phase-dir` and `deferred` rows sit where they do

The `phase-dir` row sits above `cycle is none` because an interrupted close
returns both at once, and finishing the prune comes before opening a new cycle.
The other order would offer a new phase on top of unfinished work.

The `deferred` row sits below every recovery and work row (a paused cursor, a
planned phase, an executed one), because those are where the work that clears
the queue happens. It sits above the three rows below it because of where they
route. Two go to `/cad-milestone`, whose land `/cad-land` refuses on this same
queue: the close chains `/cad-land` only where `git.auto_close` authorizes it
(`milestone.md` step 7), and otherwise the land is the user's own call. The
third, `cycle` is `none`, goes to `/cad-phase add`, which would open a new cycle
over a queue a close carried out untriaged (`milestone.md` step 3).
