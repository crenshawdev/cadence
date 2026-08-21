---
phase: 3
status: complete
completed: 2026-08-21
---

# Phase 3: Ceremony the change pays for - Summary

`stakes` became the minimum a project accepts rather than the level every phase
pays: `route.mjs resolve` now reads the phase's own declared `files:` at plan
time and raises from that floor, per plan for an executor and per phase for
everyone else.

## What shipped

- `declaredPhaseFiles` / `declaredPlanFiles` - what a phase's plans declare,
  with the `found`/`clean` counts the aggregation rule needs -
  `cadence-core/bin/lib/phase-plans.mjs`
- `scanDeclared` - what a declared file set touches, at plan time, beside the
  existing `scanDiff` over one extracted signal walk -
  `cadence-core/bin/lib/risk-diff.mjs`
- `riskFloor` - the floor resolve itself, every move it makes stated in
  `reason` and every input it could not read in `warnings` -
  `cadence-core/bin/route.mjs`
- `resolve --plan <k>`, so an executor floors on the plan it was handed and a
  clean plan in a mixed phase routes below its risky sibling -
  `cadence-core/bin/lib/arg-contract.mjs`, `cadence-core/bin/route.mjs`
- `--phase` REFUSES a malformed value rather than warning and answering about
  the cursor's phase - `cadence-core/bin/lib/arg-contract.mjs`
- The call sites that pass what the floor needs - `--plan {k}` at execute.md's
  executor resolve, `--phase {N}` at plan.md's check gate -
  `cadence-core/workflows/execute.md`, `cadence-core/workflows/plan.md`,
  `cadence-core/references/seams.md`

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | a9bbffa | read what a phase's plans declare, with the counts the floor needs |
| 1 | 2 | bf10430 | `scanDeclared` - what a declared file set touches, at plan time |
| 1 | 3 | b87d5e2 | `stakes` becomes a floor the phase's declared files raise |
| 1 | 4 | 78854e6 | no surface and no evidence stop being the same sentence |
| 1 | 5 | b70e217 | `resolve --plan`, so an executor floors on the plan it was handed |
| 1 | 6 | 77e53de | a malformed `--phase` is refused, not answered about another phase |
| 1 | 7 | 1c2c45c | the call sites pass what the floor needs, and the seam says so |
| 1 | gate | da5bae4 | the risk-floor discount is a claim the scope was READ |

## Deviations

- [deviation] Task 2's Verify asserted that `cadence-core/bin/lib/risk-diff.mjs`
  yields no content match under its own path "while the identical bytes supplied
  under another path do". Measured: it matches nothing under either path -
  v3.5.5's mention-level respelling already removed every self-matching line.
  The exemption is proved on the other named signal-table file instead
  (`lib/surface-scan.mjs`, which self-matches auth, billing and untrusted_input
  by construction and reports `[]` only under its own path), and risk-diff.mjs
  keeps a row pinning `[]` under both. Commit bf10430.

## Open items

- `milestone-prune.test.mjs:557` fails on a clean tree at 23fb76d, before any
  commit in this phase - verified by stashing and re-running. Pre-existing and
  outside this plan's lease.
- `lib/retired-keys.mjs`'s eight `risk.override.*` detail strings say "there is
  no floor for a waiver to lower", which stopped being true at b87d5e2. D-03
  locks that file byte-identical and PLAN-2 pins it with a test, so the sentence
  stands - flagged rather than fixed.
- PLAN-1's Notes record "path signals 0/48, body pass 39/48" over this repo's
  PLAN files. Re-measuring the same shape through `scanDeclared` gives 0/49 and
  9/49. Nothing in the plan rests on the figure, but the note is not
  reproducible as written.
- `declaredBodies` guards the FINAL declared path component against a symlink,
  and still follows a symlinked parent directory, so a declared body outside the
  repository can be read as evidence. Raised by the `risk_surface` re-arm round
  and adjudicated DOWN from high to medium - the unbounded-read half is closed,
  the body is never echoed, and the level moves only for a repository whose own
  layout is hostile. `realpathSync` containment against the repo root would make
  the docstring's boundary claim true. See
  `.planning/phases/3/ADJUDICATION-risk_surface-plan-1-r2.json`.
- No `lint` command exists for this project (`detect-commands` answers
  `lint: null`); static analysis ran as `npx tsc -p tsconfig.ci.json`, clean
  before every commit.

## Goal check

The commits deliver the goal. The floor is live rather than only tested: a
resolve for this repository's own phase 3 now prints `risk floor: phase 3:
cadence-core/bin/config-seams.test.mjs touches secrets (changed line: a
credential-named assignment); level solo -> shipped` in its `reason` - a level
that was previously the unexamined schema default now names the file that
raised it. The two acceptance criteria that are claims about levels are pinned
by tests rather than asserted: `route.test.mjs`'s "an explicit stakes=critical
is never resolved below (AC1)" and "with stakes UNSET a surfaceless phase
resolves solo, where today it is shipped (AC2)", the latter asserting both
outputs side by side in one test. `node cadence-core/bin/test.mjs routing prose`
reports 669 pass / 0 fail and `node cadence-core/bin/self-verify.mjs --root .`
returns `ok:true` with `"problems":[]`. What is NOT closed and the phase should
not be read as claiming: the `stakes` prose in
`cadence-core/bin/lib/retired-keys.mjs` still describes a world with no floor
(open item 2), and `declaredBodies`' outside-repository boundary is guarded only
at the final path component (open item 4). Both are recorded above rather than
folded into the goal.
