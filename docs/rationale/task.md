# Why /cad-task is shaped this way

Companion to `cadence-core/workflows/task.md`. **Not read at runtime** - no
workflow, skill or agent loads this file, and it is outside every budgeted
prose surface (`weight.mjs` measures `cadence-core/workflows/*.md` top-level
only).

Read it before EDITING that workflow. Anchors match the step names.

---

## scope - why the "Too big" arm names both doors and doesn't probe the git root

Cadence has no seam for "existing code" versus "blank page": `planning.mjs
status` collapses every treeless repository into the one reason
`no-planning-dir`. Probing the git root to pick between /cad-adopt and
/cad-new-project would make /cad-task answer differently than /cad-progress on
the same tree, so the arm names both and the user picks.

## scope - why there is no `[ -d .planning ]` check beside the seam

Two ways of asking "is there a project here" in one workflow drift, so the
seam's answer is the only gate. `risk_check`'s completion rule reads the
envelope's own `reason` for the same cause.

## risk_check - why an inline run doesn't make its task folder early

A folder made at the fire stays behind empty whenever the run ends before
`record`, on a blocking FAIL for example, once the transient diff is deleted.
That leaves one empty folder per risk-surface task. The diff goes to the run's
own directory, and `record` is what creates the folder.

## risk_check - why the inline diff has no fixed shared name

Two inline runs of the same-slugged task would share a fixed name under the
temp directory. The trigger defaults to `blocking`, so the collision would hand
a stale diff to a blocking gate. Each run's `mktemp` directory keeps them apart.
