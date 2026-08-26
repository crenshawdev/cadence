# Why /cad-context is shaped this way

Companion to `cadence-core/workflows/context.md`. **Not read at runtime** - no
workflow, skill or agent loads this file, and it is outside every budgeted
prose surface (`weight.mjs` measures `cadence-core/workflows/*.md` top-level
only).

Read it before EDITING that workflow. Anchors match the step names.

Note: this workflow was already close to instruction-only. It gave up 818 bytes
against `plan.md`'s 5,084, and that is the honest signal that the prose here was
carrying its weight rather than defending itself.

---

## load_priors - why prior SUMMARY deviations are read

`workflows/report.md` already reads deviations out of SUMMARY for its `Refuted:`
line, so this is the same source, not a new artifact. Without them the spend
gate's "already grounded by a prior phase" arm never fires and the gate
collapses to its size arm alone.

The read is bounded most-recent-first, exactly as the CONTEXT reads are, so the
set cannot grow with N.

## spend_gate - why planning.commit_docs is read this early

It is not needed until the `commit` step at the very end. It rides this batch
because this workflow's only other config touchpoint was a second Bash
round-trip for one key.

## spend_gate - why the recall gate precedes the call (D-03)

Recall's own backend-off return is a backstop for a direct caller, not this
workflow's gate. `none` means the call is never made and no recalled data
reaches the pass, rather than a call made and a result discarded.

## spend_gate - why the gate computes no score

A requirement-count threshold was measured on the committed verbatim fixture and
orders its two phases backwards. This workflow's guardrails already ban
splitting frameworks for the same reason, and a ranking seam here would be one.

## spend_gate - why the gate sits above analyze

`analyze`'s `route.mjs resolve` writes the lifecycle dispatch half
unconditionally - before any Task spawn, before any answer. So "before the
spawn" is not far enough: a gate anywhere below that line leaves an unpaired
bracket on every phase that skips the analyzer, which renders as a worker that
never came back and inverts the record-health signal `/cad-report` reads.

`prose-agreement.test.mjs` pins this as an ORDER, not a sentence: the gate step
must open above both `<step name="analyze">` and the `--bracket-read` resolve.
The step name is read off the deferred-read register rather than hardcoded, so
renaming the step in one place fails the test instead of quietly passing against
a step that no longer exists.

## analyze - why the bracket read-set is one path

This is the single most expensive dispatch in the whole spine. The read-set
records what the SITE causes the worker to read, which is not what the prompt
names - the prompt names no planning path at all, and the analyzer's contract is
what sends it to the roadmap entry.

Prior phases' decisions reach it as a distilled `<prior_decisions>` summary
rather than as files. The contract opens a prior CONTEXT.md itself only when the
code contradicts a cited decision, so the sweep of every prior phase's file that
used to grow with N is gone from both the contract and this record.

## write_context - why the template read is deferred

Deferred on SIZE, not branch-locality (references/seam-spawn-agent.md, File
round-trip). The step is unconditional but reached once, at the very end, so the
read folds into the turn that writes the file, while an eager copy would ride
every turn of the interview before it.

## write_context - why criteria-size is a seam call

A ceiling nothing counts is a silent no-op. The seam is what makes the 3-7 bound
in `acceptance_criteria` an actual comparison rather than a number in prose.
