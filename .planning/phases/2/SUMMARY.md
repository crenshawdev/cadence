---
phase: 2
status: complete
completed: 2026-08-18
---

# Phase 2: The ship gate that FAILs correct docs - Summary

`/cad-audit` no longer fails a healthy repository on three counts: the version
comparand reads the milestone the `### Active` section declares rather than a
wrapped continuation line, the rolled-forward phase is exempt from
`version_drift` where the workflow already said it was, and tag discovery is
bounded to the caller's own project root.

## What shipped

- Whole-body two-scan `activeVersion` with an agreement-or-sentence-opening
  admission, so a line-anchored predecessor on a wrapped continuation line can
  no longer out-declare the milestone - `cadence-core/bin/lib/branch-decision.mjs:117`,
  shared with `git-branch.mjs decide` per D-01
- The DOC-02 prose-agreement pin's remedy now names changing the reader, not the
  file (D-03 reverses phase 1's D-07) - `cadence-core/bin/prose-agreement.test.mjs`
- `readTags(dir, projectRoot)` with a `--show-toplevel` containment probe on
  realpaths; an umbrella repository's tags no longer reach a non-repository
  project inside it, while a linked worktree still reads its repository's tags -
  `cadence-core/bin/lib/git-tags.mjs:70-75`
- `rolledOver` over the Traceability rows `cmdAudit` already parsed, with an
  at-least-one-row guard, so a sanctioned rolled-forward phase emits no
  `version_drift` - `cadence-core/bin/planning.mjs:1346`
- `audit.md`'s `version_drift` bullet now names three exits including the
  roll-forward the seam honours - `cadence-core/workflows/audit.md:110-115`;
  `weight-budgets.json` re-pinned 12912 -> 13029 in the same commit per D-11

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | 58c6a47 | fix(2-1): stop a wrapped continuation line from out-declaring the milestone |
| 1 | 2 | 487e150 | docs(2-1): the DOC-02 pin's remedy names the reader, not the file |
| 1 | 3 | caf3a23 | fix(2-1): bound tag discovery to the caller's own project root |
| 1 | 4 | ca0f2ed | fix(2-1): exempt the sanctioned rolled-over phase from the drift signal |
| 1 | 5 | 03895e6 | docs(2-1): state the rolled-over exit where the audit's reader looks |

## Deviations

- [deviation] The plan's `## Must be true when done` and AC7 assert
  `node --test cadence-core/bin/*.test.mjs` exits 0. It exits 1 at the phase-start
  commit 2c88137, before any change in this phase:
  `cadence-core/bin/milestone-prune.test.mjs:433` asserts every moved `## Active`
  bullet is wrapped, and `.planning/REQUIREMENTS.md:31` (PHS-01) is one unwrapped
  line. `git log -1 -- .planning/REQUIREMENTS.md` returns 2c88137, so the cause
  predates every executor commit. Neither file is in the plan's lease. Verified
  post-phase: 2182 of 2183 tests pass, this being the sole red one.
- [deviation] Task 2's Verify asserts `grep -rn "Fix the section - declare the
  milestone" .` returns nothing; it returns `.planning/phases/2/PLAN.md:143` -
  the Verify line quoting its own pattern - and the sentence survives line-wrapped
  in `CONTEXT.md:74` and `PLAN.md:39,136` as quotations of what to delete. The
  substantive criterion holds: `grep -rn "Fix the section" cadence-core/` returns
  nothing, so no live occurrence survives on a shipped surface.

Neither deviation refutes a numbered CONTEXT decision, so no D-NN line is annotated.

## Open items

- `.planning/REQUIREMENTS.md:31` - PHS-01's bullet needs wrapping at the repo's
  prose width for the milestone-prune corpus test to hold. Until then AC7's
  `node --test` half cannot pass on this repository. Filed to CAPTURE.
- `.planning/DOCS-CLAIMS.md` rows AUDIT-25 and AUDIT-39 cite `audit.md` lines
  105-113; task 5 grew that bullet by two lines, so those citations now point two
  lines short. Filed to CAPTURE.
- Recorded decline (no action queued): task 3 did not give `readTags` a
  distinguishable "the repository is not this project's" reason - D-08 and the
  task's Verify both want the permissive `[]`, so the three no-evidence answers
  stay collapsed. A consumer needing to tell them apart needs a different
  question, not a second failure mode here.
- Recorded decline (no action queued): task 1 did not make the sentence-opening
  discriminator configurable or exported - nothing in the plan sets a second
  policy, so the rule stays inline in `activeVersion`'s two-scan admission.

## Goal check

The five commits plausibly deliver the phase goal, and each of the three
requirements has a live fix in the tree rather than only a passing fixture.
DRF-01: `activeVersion` at `cadence-core/bin/lib/branch-decision.mjs:117` scans
the whole body twice and admits a line-anchored token only on agreement or a
sentence opening, and the shared reader is the one `git-branch.mjs decide` uses
(`branch-decision.mjs:199`), so D-01's "move the shared reader" holds rather than
an audit-only comparand. TAG-01: `readTags` now takes `projectRoot` and refuses
on `!within(physical(top), physical(projectRoot))`
(`cadence-core/bin/lib/git-tags.mjs:70-75`), the containment probe D-06 specified.
DRF-02: `rolledOver` gates the drift signal at `cadence-core/bin/planning.mjs:1346`
over rows already parsed, per D-04's "cannot be derived from the phase alone",
and `audit.md:110-115` now names the roll-forward exit, so the workflow's stated
exemption and the seam's behaviour agree. `node cadence-core/bin/self-verify.mjs`
exits 0. What is NOT delivered: AC7's `node --test cadence-core/bin/*.test.mjs`
exit 0. The suite exits 1 on exactly one test,
`milestone-prune.test.mjs:433`, whose cause is `.planning/REQUIREMENTS.md:31`
last touched at 2c88137 - the phase-start commit - so it is inherited, not
caused, and its fix sits outside the plan's lease. That is the one gap between
this phase's acceptance criteria as written and the tree as it stands.
