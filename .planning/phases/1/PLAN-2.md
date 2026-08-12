---
phase: 1
plan: 2
requirements:
  - SIZ-01
files:
  - cadence-core/workflows/context.md
  - skills/cad-context/SKILL.md
  - cadence-core/bin/lib/deferred-reads.mjs
  - cadence-core/bin/deferred-reads.test.mjs
  - cadence-core/bin/prose-agreement.test.mjs
  - cadence-core/bin/weight-budgets.json
  - .planning/DOCS-CLAIMS.md
---

# Phase 1: The accounting the trace still misses - Plan 2 (SIZ-01)

## Goal

No phase buys the assumptions-analyzer pass unasked: `/cad-context` settles
whether that dispatch is worth its price BEFORE the resolve that brackets it, and
a phase small enough, or already grounded by a prior phase's deviations, reaches
its CONTEXT.md through a conversational pass with no analyzer dispatch in the
trace.

## Must be true when done

- `/cad-context` asks whether to buy the analyzer pass before any `route.mjs
  resolve` for `cad-assumptions-analyzer`, and that question is named and worded
  differently from the size question, which still runs after the acceptance
  criteria.
- A phase whose spend gate is answered "skip" still ends with a written
  `.planning/phases/<N>/CONTEXT.md`, and that phase's `.planning/trace.jsonl`
  carries neither a `lifecycle/dispatch` nor a `routing/resolve` event for
  `cad-assumptions-analyzer`.
- The gate is annotated with evidence the coordinator already read - the phase's
  requirement count, the surfaces its roadmap entry names, and prior phases'
  SUMMARY deviations - and computes no score and holds no threshold.
- Walked against verbatim phase 2's roadmap entry and its phase-1 SUMMARY
  deviations, the gate's recommended option is dispatch, not skip.
- Every surface that today claims `/cad-context` asks exactly one size question
  states one size question plus one spend question.
- `node cadence-core/bin/self-verify.mjs`, `node --test
  cadence-core/bin/trace.test.mjs` and `node --test
  cadence-core/bin/prose-agreement.test.mjs` are green: the deferred-read register
  resolves at the arm that performs the read, the per-file bracket census still
  counts one dispatch, one return and one checkpoint in `context.md`, and no
  budget row is overrun.

## Context

Locked by `phases/1/CONTEXT.md`: the gate sits BEFORE the `route.mjs resolve`,
not merely before the Task spawn, because the resolve writes the dispatch half
unconditionally (D-08); `size_check` does not move and the spend gate is a NEW,
differently-named question before `analyze` (D-09); the gate is JUDGED through
the ask-user seam with no computed discriminator and no threshold, because the
fixture's two phases sit on the same side of every cheap metric (D-11);
`load_priors` widens to prior phases' SUMMARY deviations, which `context.md`
never opens today (D-10); both of the analyzer bracket's close arms must survive
the restructure or the per-file census fails (D-14); a budget row is re-pinned in
the commit whose prose exceeds it, and no Read sentence this phase writes needs a
byte figure (D-16); the stale `DOCS-CLAIMS.md` rows for `context.md` are
corrected as this phase's line shifts move them (D-17).

This plan runs AFTER PLAN-1, which lands the trace half and adds the coordinator
marker instruction to `context.md`'s `<process>` preamble.

Out of this plan: any splitting framework or size score (banned by the workflow's
own guardrails), any move of `size_check`, and the deferred `--brief` / adopt
work of phase 2.

## Tasks

### Task 1: load_priors reads prior phases' deviations

- **Files:** cadence-core/workflows/context.md, cadence-core/bin/weight-budgets.json
- **Action:** Widen `load_priors` to read prior phases' `SUMMARY.md` alongside
  the up-to-3 prior `CONTEXT.md` files it reads today, taking their `##
  Deviations` bullets into the internal prior-decisions summary (D-10). Bound it
  the way the CONTEXT reads are bounded - most recent first, same 3-file ceiling -
  so the read set cannot grow with N, which is the cost the analyzer's own
  contract already removed from this workflow. State what the deviations are FOR
  in one clause: they are the evidence the spend gate's "already grounded by a
  prior phase" arm turns on, and without them that arm never fires and the gate
  collapses to its size arm alone. `workflows/report.md` already reads deviations
  out of SUMMARY for its `Refuted:` line, so this is the same source, not a new
  artifact. Missing files stay fine - the step's existing "Missing files are fine"
  contract covers them. If this commit's measured bytes exceed
  `cadence-core/workflows/context.md`'s `weight-budgets.json` row (651 B of
  headroom today), re-pin the row in the same commit (D-16); the check is a
  ceiling only, so nothing is owed if it still fits.
- **Verify:** `node cadence-core/bin/self-verify.mjs` exits 0 with no
  `budget-overrun`; `grep -n "SUMMARY" cadence-core/workflows/context.md` shows
  the read inside the `load_priors` step and names deviations as the gate's
  evidence.

### Task 2: A spend gate before the analyzer resolve, with a conversational skip arm

- **Files:** cadence-core/workflows/context.md, cadence-core/bin/lib/deferred-reads.mjs, cadence-core/bin/weight-budgets.json
- **Action:** Add a new step to `context.md` between `load_priors` and `analyze`
  that decides whether this phase buys the analyzer pass, and route both of its
  arms. It sits before `analyze` as a whole, which is what puts it before the
  `route.mjs resolve` carrying `--bracket-read`: that resolve writes the lifecycle
  dispatch half unconditionally, so a gate placed after it would strand an
  unpaired bracket on every skipped phase and invert the record-health signal
  PLAN-1 just sharpened (D-08). Move the `config.mjs get memory.backend` call, the
  gated `recall` call, and the `references/recall.md` Read sentence out of
  `analyze` into this new step, because BOTH arms need prior-project memory - the
  buy arm feeds it to the analyzer payload exactly as today, the skip arm reasons
  with it - and update the `cad-context` / `references/recall.md` row in
  `cadence-core/bin/lib/deferred-reads.mjs` from the `analyze` anchor to this
  step's name in the SAME commit, keeping `read_paragraphs` at 1. The moved Read
  sentence must keep an inline consult-site count ("one consult site - this step"),
  which `prose-agreement.test.mjs` requires at every anchor; it needs no byte
  figure (D-16). The gate itself is a JUDGED ask through the ask-user seam,
  structured, with its own header and a question about SPEND - never a second size
  question - annotated with evidence the coordinator has already read: how many
  requirements the phase carries, the surfaces its ROADMAP entry names, and
  whether a prior phase's SUMMARY deviations already settled this ground (D-10).
  It computes no score, holds no threshold, and runs no seam to rank the phase:
  measured on the fixture, a requirement-count gate orders verbatim's two phases
  backwards, and the workflow's own guardrails already ban splitting frameworks
  (D-11). Present a recommended option first, as every other ask in this workflow
  does. On the buy arm, continue into `analyze` unchanged. On the skip arm, do NOT
  enter `analyze` at all - no resolve, no dispatch, no bracket - and take the
  plain conversational pass `analyze`'s failure arm already describes (derive 2-4
  gray areas from the phase goal and the priors, treat each as Unclear), then
  continue at `close_gray_areas`; say plainly which arm was taken rather than
  degrading silently. Nothing in `analyze`'s bracketing may be dropped or
  reworded away: its one `--bracket-read` resolve, its one `--event return` close
  and its one `--event checkpoint` close all stay written, or the per-file census
  fails with "unclosed on its FAILURE path" (D-14). Re-pin `context.md`'s
  `weight-budgets.json` row in this commit if the file now exceeds it (D-16).
- **Verify:** `node --test cadence-core/bin/trace.test.mjs` exits 0 with
  `context.md` still counted at one dispatch, one return and one checkpoint;
  `node --test cadence-core/bin/prose-agreement.test.mjs` exits 0, proving the
  register's recall row resolves at its new anchor with a consult-site count;
  `node cadence-core/bin/self-verify.mjs` exits 0 with no `budget-overrun` and no
  `deferred-read-unread`. human-verify (AC5): run `/cad-context <N>` on a small
  phase and answer the spend question "skip"; observe `.planning/phases/<N>/CONTEXT.md`
  written, then run `node cadence-core/bin/planning.mjs trace render --phase <N>`
  and observe no `lifecycle/dispatch` and no `routing/resolve` event naming
  `cad-assumptions-analyzer`.

### Task 3: Every surface states one size question AND one spend question

- **Files:** cadence-core/workflows/context.md, skills/cad-context/SKILL.md, cadence-core/bin/weight-budgets.json
- **Action:** Four surfaces assert today that this workflow asks exactly one size
  question; each restates as one size question plus one spend question, naming
  what each asks so they cannot be confused (D-09): the `size_check` step's
  opening line ("Exactly ONE size question, now that the criteria make size
  visible"), the third `<guardrails>` bullet ("Exactly one size question, near the
  end. No SPIDR, no story formats, no splitting frameworks."), the third
  `<success_criteria>` checkbox ("Exactly one size question was asked, and its
  outcome is recorded as Plan shape"), and `skills/cad-context/SKILL.md`'s
  objective sentence ("ask exactly once whether the phase is too big for one
  plan"). Keep every restatement's second half intact - the SPIDR / story-format /
  splitting-framework ban still applies to both questions, and the Plan shape
  recording is still the size question's outcome alone. `size_check` does not
  move: it sits after `acceptance_criteria` because the criteria are what make
  size visible, and moving it forward would strip it of the evidence its own prose
  names and degrade the `Plan shape` line `/cad-plan` consumes for every phase
  (D-09). Re-pin either file's `weight-budgets.json` row in this commit if it now
  exceeds (D-16).
- **Verify:** `node cadence-core/bin/self-verify.mjs` exits 0 with no
  `budget-overrun`; `grep -rn "exactly one size question\|Exactly ONE size
  question\|exactly once whether" cadence-core/workflows/context.md
  skills/cad-context/SKILL.md` returns no line that names a size question without
  naming the spend question beside it.

### Task 4: Pin the gate's position and the four surfaces' agreement with a test

- **Files:** cadence-core/bin/prose-agreement.test.mjs
- **Action:** Add one test to `prose-agreement.test.mjs` - the file for prose that
  copies a machine-readable fact and must not drift from it - asserting two
  things about `cadence-core/workflows/context.md`. First, position: the spend
  gate's `<step name="...">` opening appears BEFORE the `analyze` step's opening
  and before the line carrying `--bracket-read`, by index in the file's text, with
  a failure message naming why (a gate after the resolve leaves a dispatch event
  with no worker). Second, agreement: each of the three `context.md` regions task
  3 restated, plus `skills/cad-context/SKILL.md`, names both questions rather than
  one. Follow the file's stated idiom - read the live documents, assert one named
  fact each, no table-shape parsing - and keep the assertions anchored on step
  names and sentence content rather than on line numbers, which this phase is
  already shifting.
- **Verify:** `node --test cadence-core/bin/prose-agreement.test.mjs` exits 0; the
  same run fails with its own message when the spend-gate step block is moved
  below `analyze` in a scratch copy of `context.md`.

### Task 5: Correct the DOCS-CLAIMS rows this phase's line shifts moved

- **Files:** .planning/DOCS-CLAIMS.md
- **Action:** Re-pin every `DOCS-CLAIMS.md` row citing
  `cadence-core/workflows/context.md` whose cited line number this phase's edits
  moved, so `/cad-docs-verify` stops reporting a wave of `stale` verdicts caused
  by line shifts rather than by any claim changing (D-17). Four are already stale
  before this phase touched anything and are corrected here whatever else moves:
  CONTEXT-03 cites line 76 for `config.mjs get memory.backend
  workflow.subagent_timeout` when that line reads `... get memory.backend` alone
  (`workflow.subagent_timeout` was deleted) and the call has moved again in task
  2, so correct BOTH the line and the claim text; CONTEXT-06 and CONTEXT-07 cite
  line 107 for the analyzer dispatch append; CONTEXT-15 cites line 351 for
  `cursor set`. Correct the line numbers only against the file as it stands at
  this commit - the last commit in the phase that shifts `context.md` - and change
  a claim's TEXT only where the claim itself is now false, never to make a stale
  claim easier to verify.
- **Verify:** For every corrected row, `sed -n '<line>p'
  cadence-core/workflows/context.md` shows the construct the row's claim names;
  `grep -n "workflow.subagent_timeout" .planning/DOCS-CLAIMS.md` returns no
  CONTEXT-03 row asserting it is read in that call.

## Notes

- Plan shape deviation, recorded per contract: CONTEXT directs multiple plans and
  this plan honors it, but PLAN-1 and PLAN-2 SHARE
  `cadence-core/workflows/context.md` and `cadence-core/bin/weight-budgets.json`,
  so they are not the independent slices a parallel split needs. They run
  SEQUENTIALLY, PLAN-1 first, which is also the order CONTEXT gives (the trace
  half lands green before the gate half restructures `analyze`). `plan-overlap`
  will report the shared paths and `/cad-execute` will route sequential - the
  intended shape, not a defect to fix.
- AC6 is a human-verify walk with no machine arm: run `/cad-context 2` against a
  checkout of verbatim (or replay its phase-2 roadmap entry and phase-1 SUMMARY
  deviations by hand), and observe that the spend gate presents six named surfaces
  as its evidence and recommends dispatch. CONTEXT records that the skip arm ships
  with no positive fixture evidence - across 21 archived Cadence phases plus
  verbatim's two, no phase would have taken it (D-13) - so the skip arm is proven
  against a constructed phase in task 2's walk, not against a corpus.
