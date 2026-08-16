---
phase: 1
plan: 3
requirements:
  - PAR-01
files:
  - cadence-core/references/execute-parallel.md
  - cadence-core/bin/prose-agreement.test.mjs
  - cadence-core/bin/weight-budgets.json
---

# Phase 1: The controls that never reached their path - Plan 3 (PAR-01)

## Goal

The parallel execute branch runs the same risk sequence the sequential one
does - detector, conditional fire, status - so the two branches stop disagreeing
about what "done" means on the one gate that is `blocking` at every stakes
level.

## Must be true when done

- `grep -c risk-check cadence-core/references/execute-parallel.md` returns a
  non-zero count.
- The parallel path reaches the detector, the conditional fire and the status
  call by POINTING at the sequence `workflows/execute.md` already states, not by
  carrying a second copy of it - and a check goes red if that sequence is pasted
  in.
- Each parallel plan's risk range is that plan's own pre-merge/post-merge HEAD
  pair, so no plan's fire sees another plan's work.
- A parallel plan cannot be reported done while `risk-check status` refuses, and
  a check goes red if that gating sentence is removed.
- `node --test cadence-core/bin/*.test.mjs` and `node
  cadence-core/bin/self-verify.mjs` both exit 0.

## Context

Locked: the parallel path reaches the sequence by pointing at
`workflows/execute.md`'s own risk step - already resident, since
`execute_parallel` is the only step that reads this reference - rather than by a
new shared reference, which would cost a deferred-reads registry row, a
`weight-budgets.json` row and a new read anchor (D-06). The range is the
pre-merge/post-merge HEAD pair step 3 already records (D-07). Detection and the
fire run AFTER step 3's merges, in the main tree, beside step 5's `diff` fire
(D-08). `risk-check status` uses the same named-range triple the sequential path
uses, never the phase-wide arm (D-09). Each plan's `risk_surface` survivor file
keeps its `plan-<k>` discriminator (D-10). This plan lands AFTER PLAN-2, so its
new `risk-check status` caller is written against the rule GAT-04 gives that
seam.

## Tasks

**Before task 1, and before ANY commit in this plan:** run `git rev-parse
--short HEAD` and hold that SHA - it is this plan's unpatched baseline for the
watched FAIL recorded in task 2's header comment. Run it here rather than inside
task 2, because by then HEAD already carries task 1's prose and the literal
command names a patched revision. Record the observation at this same point
(`grep -c risk-check` returning 0 for `references/execute-parallel.md` against 2
for `workflows/execute.md`) and carry it into that comment.

### Task 1: The parallel path reaches the risk sequence

- **Files:** cadence-core/references/execute-parallel.md,
  cadence-core/bin/weight-budgets.json
- **Action:** Give this path the risk sequence it has never had, placed AFTER
  step 3's merges and step 4's worktree removal and beside step 5's `diff` fire,
  in the main tree. The placement is load-bearing: a fire issued before the
  merge asks git for a commit the tree does not hold and `risk-check run`
  returns `ok:false, reason:"no-diff"` (D-08); after step 4 the worktrees are
  gone, so the report directory the sequential path already writes its transient
  range diff into is in the main tree by construction, which is what "outside
  any worktree" means here. Per plan, in order: invoke `planning.mjs risk-check
  run` with `--phase`, that plan's `--plan <k>`, and the `--base`/`--head` pair
  step 3 recorded for it - its pre-merge HEAD and the HEAD its merge produced,
  which step 3 already records BOTH ends of and says why; not the pre-plan HEAD
  and not `{PHASE_START, HEAD}`, either of which fires the blocking gate on a
  range containing other plans' work (D-07). Then, before the plan may be
  reported done, invoke `planning.mjs risk-check status` with the SAME triple -
  `--plan`, `--base` and `--head` together, never the phase-wide arm, which
  passes on `usable.length` alone and never compares the range, so a parallel
  plan would clear on a record an earlier, narrower one left (D-09). State that
  the plan is NOT reported done while that call refuses. For everything in
  between - what the detector's answer means, when the trigger fires, the
  transient range-diff file and its rails, the blocking gate and its capped
  re-arm - POINT at the sequence `workflows/execute.md` states at its
  `execute_sequential` step and do not restate a word of it: that workflow is
  the file this reference is read from and is already resident, so the pointer
  costs nothing, and a second copy is two statements of one rule that will
  disagree at the next edit (D-06). Say in one clause that the fire is PER PLAN,
  so each plan's survivor file keeps the `plan-<k>` discriminator the milestone
  carry-forward glob needs and a later plan's empty settle cannot overwrite an
  earlier plan's survivor (D-10). Do not add a new reference file, do not
  restate the triage gate, and do not touch step 6's `phase_diff` paragraph. Re-
  pin the `cadence-core/references/execute-parallel.md` row in
  `weight-budgets.json` in the SAME commit: the surface sits at 4242 against a
  4242 budget with zero headroom, so any growth is a `budget-overrun`
  self-verify failure and an uncommittable tree.
- **Verify:** `grep -c risk-check cadence-core/references/execute-parallel.md`
  returns a non-zero count covering both `risk-check run` and `risk-check
  status`; `node cadence-core/bin/self-verify.mjs` exits 0 with no
  `budget-overrun`; the file names `workflows/execute.md`'s step as the sequence
  it defers to and contains neither the fire rule's `inconclusive` wording nor
  the transient-file rail's `never stage it` wording, both of which stay in
  `workflows/execute.md` alone.

### Task 2: The checks that hold both halves, with their watched FAIL

- **Files:** cadence-core/bin/prose-agreement.test.mjs
- **Action:** Two checks in the file that already owns "prose that copies a
  machine-readable fact must still match that fact", beside its existing
  `RSK-01/RSK-02` block whose ENFORCEMENT test makes the same argument for
  `workflows/execute.md`. The first: the parallel path REACHES the sequence and
  does not COPY it - it invokes both `risk-check run` and `risk-check status`,
  it names the sequential step it defers to, and the marker sentences that
  belong to `workflows/execute.md`'s risk step appear THERE and not here. Choose
  the markers from sentences `workflows/execute.md` demonstrably owns today -
  its fire rule (the one carrying `inconclusive`) and its transient-file rail
  (the one carrying `never stage it`) - and assert each present in
  `workflows/execute.md` and absent from `references/execute-parallel.md`, so
  the check reddens on a paste-back in either direction rather than pinning a
  paragraph's wording. The second: the parallel path GATES reporting a plan done
  on the status call, asserted the way the sibling `ENFORCEMENT, execute.md`
  test asserts its own, so deleting that sentence goes red. Carry a header
  comment on the block naming the short SHA the FAIL was watched at (D-17),
  captured with `git rev-parse --short HEAD` before this plan's first commit,
  and stating what was observed there: `grep -c risk-check` returning 0 for
  `references/execute-parallel.md` against 2 for `workflows/execute.md`. Read
  both documents through the file's existing `doc()` helper; add no new import
  and no fixture, so against the unpatched tree the block fails on its
  assertions rather than on a missing symbol. A THIRD check holds the range
  identity, because the first two assert only that the two command NAMES are
  present and the whole of D-07 and D-09 - and this plan's own "each plan's risk
  range is that plan's own pre-merge/post-merge HEAD pair" must-be-true - can be
  violated with both names still there: assert that BOTH the `risk-check run`
  and the `risk-check status` invocation in `references/execute-parallel.md`
  carry `--plan`, `--base` and `--head`, that neither is the bare phase-wide
  `status` arm, and that both name the SAME pre-merge/post-merge pair step 3
  records rather than `{pre-plan HEAD, HEAD}` or `{PHASE_START, HEAD}`. Without
  it the plan states a locked range rule with no falsifiable check behind it.
- **Verify:** `node --test cadence-core/bin/prose-agreement.test.mjs` exits 0 on
  this tree, and exits non-zero on each of these five mutations, each reverted
  afterwards: (1) appending `workflows/execute.md`'s fire-rule sentence to
  `references/execute-parallel.md`; (2) deleting the not-reported-done sentence
  from `references/execute-parallel.md`; (3) rewriting the parallel `risk-check
  status` call to the phase-wide arm (dropping `--plan`/`--base`/`--head`) while
  leaving both command names in place; (4) changing the parallel range to
  `{PHASE_START, HEAD}` while leaving both command names in place; (5) running
  this test file inside a
  `git worktree add --detach` checkout of the SHA named in its header. Then
  `node --test cadence-core/bin/*.test.mjs` and `node
  cadence-core/bin/self-verify.mjs` both exit 0.

## Notes

- **Deviation from the strict file-independence test, recorded rather than
  silent.** The CONTEXT `Plan shape` directive asks for multiple plans split
  along the three seams, with GAT-04 landing before PAR-01's new `risk-check
  status` caller, and it asks for shared surfaces to get explicit `files:`
  leases per plan. Both halves of that are incompatible with the "no shared
  files, no cross-slice ordering" test for a PARALLEL split: all three plans
  declare `cadence-core/bin/weight-budgets.json`, PLAN-1 and PLAN-2 both declare
  `cadence-core/bin/planning.mjs`, and PLAN-2 must land before PLAN-3. The split
  is honored as the directive intends and the consequence is stated here: this
  is a SEQUENTIAL three-plan phase. `plan-overlap --phase 1` will report
  overlaps, `/cad-execute`'s `choose_path` will therefore take the sequential
  path, and the plans must be executed in number order - 1, 2, 3 - with PLAN-3
  strictly after PLAN-2.
- `workflows/execute.md` is deliberately not edited by this plan and is not
  leased. D-06's "point at execute.md's own risk step" is delivered by naming
  the `execute_sequential` step from `references/execute-parallel.md`; moving
  the risk paragraphs into a separate named step would restructure a 26 KB
  surface with 40 bytes of budget headroom to buy a better-sounding anchor name
  and nothing else.
- The three tree-wide count pins CONTEXT flags (D-16) do not move in this phase.
  `DEFERRED_READS.length === 10` is unchanged because D-06 adds no reference;
  the 12-callsite `mergeLayers` census is untouched; and the
  `text-transport.test.mjs` 36/20 pin stays put for the reason recorded in
  PLAN-2's Notes.
