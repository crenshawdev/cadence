---
phase: 3
status: complete
completed: 2026-08-05
---

# Phase 3: The surfaces that are always on, and the ratchet that watches them - Summary

The description bytes riding every session in every project drop from 8,550 to
5,397 (skills 5,078 to 3,759, agents 3,472 to 1,638), `cadence-core/references/**`
and `templates/**` come under the weight budget as 23 new entries taking the
weighed set from 69 surfaces to 92, and both walkers stop letting one unreadable
descendant hide an entire subtree.

## What shipped

- Per-entry recursion in `cadence-core/bin/lib/surface-weight.mjs` - an
  unreadable directory is empty data that hides only its own children, and the
  walk stops at symlinked directories met during the walk (a `skills/a/loop -> ..`
  cycle went from 41 counted surfaces of one 2-byte file to 1)
- The same fix in `self-verify.mjs`'s `mdFiles`, so the ENFORCING half names the
  path that is actually unreadable with its own errno - `skills/private` /
  `EACCES` where it used to say `skills` / `EISDIR`
- `references/**` and `templates/**` budgeted at exact current bytes (D-01's
  `**` reading, wider than ROADMAP SC3's spelling), including
  `references/model-hints.json` and `templates/config.json`
- Every prose claim about what the ratchet weighs corrected in five places -
  `weight.mjs`, `self-verify.mjs`'s check-10 rationale, `METHOD.md`,
  `CONTRIBUTING.md` and the `weight.test.mjs` test name
- 23 user-facing skill descriptions and all 19 rung-agent descriptions cut to one
  routing line, each agent line naming the rung `RUNG_FILES` assigns it
- `.planning/phases/3/MEASUREMENTS.md` - the trigger-word audit and the closing
  measurement, with every D-19 baseline reproduced byte-exactly against an
  archived `312011d`

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | 0207b2b | The weighed walk recurses per entry, so one unreadable child hides only itself |
| 1 | 2 | fdd9596 | self-verify names the path that is actually unreadable, not the directory above it |
| 1 | 3 | f6a0405 | references/** and templates/** come under the weight budget |
| 1 | 4 | 932aaf9 | Every claim about what the ratchet weighs names the widened walk |
| 1 | 5 | 6a63445 | The 23 user-facing skill descriptions become one routing line each |
| 1 | 6 | 5df29e5 | All 19 rung-agent descriptions become one routed-rung clause |
| 1 | 7 | 21119ea | The phase record carries the trigger-word table and the closing measurement |

## Deviations

- [deviation] Task 4's verify grep matched the test-name string introduced in
  task 3, and the first METHOD/CONTRIBUTING rewrites kept the literal phrase
  while extending it. Both prose sites reworded and the test renamed to
  `surface set is agents, skills, workflows plus references/** and templates/**
  (D-01)`; the grep now returns nothing.
- [deviation] `.planning/CAPTURE.md` is gitignored (`.gitignore:23`), so task 4's
  `acceptance-criteria.md` bullet exists on disk but is in no commit. Pre-existing
  condition already flagged by a phase-1 capture item; `.gitignore` was not
  changed.
- [deviation] Task 5 expected to rewrite all 23 skill descriptions; `/cad-plan`
  (105 B) and `/cad-task` (103 B) were already single routing lines carrying every
  required trigger word, so editing them would have churned two compliant lines
  and two budget entries for nothing. Both remain in the MEASUREMENTS table with
  identical before/after text.
- [deviation] The plan states four commands grew between D-19 and `35ba9eb`;
  measured, SIX did - `config` +276, `new-project` +248, `context` +224,
  `execute` +198, `plan` +37, and `/cad-verify` +24 (from `workflows/verify.md`
  13,432 -> 13,456). `/cad-verify` reads as flat in the closing table only
  because this phase's own SKILL.md cut took exactly 24 B back off it, which
  MEASUREMENTS.md:112 discloses. In every case the cause is the command's
  workflow file growing in phase 2, not this phase. Reported as-is in
  MEASUREMENTS.md section 2 rather than netted away. (The executor's report and
  the first draft of this line said FIVE; corrected at verification, where the
  same pass also caught three narrative miscounts in MEASUREMENTS.md - no number
  in any table changed.)
- [deviation] The trigger-word audit came out better than the criterion: 0
  dropped, 9 GAINED. Nine words the plan required were absent from the before
  lines (`land`, `verify`, `progress`, `undo`, `help`, `symptom`,
  `review provider`, `plan review`, `PLAN.md`) and are present now, marked
  `(new)` in the table.
- [deviation] MEASUREMENTS.md carries both comma-formatted and raw figures
  (`3759`, `1638`, `246127`), because task 7's verify greps for literal command
  output and `3,759` would not match it.

## Open items

All four came from the `diff` review trigger (advisory) and were adjudicated
against the code; none is a regression this phase introduced except the second.

- **An unreadable repository ROOT still reports a clean empty measurement.**
  `surface-weight.mjs:97` and `self-verify.mjs:225` both gate each branch on
  `existsSync`, which returns false for EACCES rather than surfacing it, so a
  mode-000 root yields `{"ok":true,"surfaces":[]}` and exit 0. Reproduced - and
  reproduced IDENTICALLY on the pre-phase-3 walker at `6e8092a`, so it is
  pre-existing and outside AC4, which is about a descendant. The module header's
  wording ("hides only its OWN children") stays accurate. Worth closing anyway:
  a tool that reports success on a repository it cannot read is the same class of
  quiet-wrong-number this phase existed to fix.
- **The two newly budgeted non-`.md` files have no loud counterpart in either
  direction.** This one IS new, created by D-01's `**` widening.
  `references/model-hints.json` and `templates/config.json` are budgeted, but if
  either becomes unreadable or vanishes, `surfaces()` drops it silently via
  `isFile()` and `self-verify.mjs:213` skips it before its guards because it is
  not `.md` - and the budget check is one-directional (`weighAll` -> manifest), so
  an orphan entry raises nothing. Budget ENFORCEMENT is unaffected: `weighAll`
  covers both files while they exist.
- **The blanket `catch` in `dirents()` converts transient failures into a
  successful undercount.** EMFILE/ENFILE/ELOOP are not "an intentionally
  ignorable unreadable surface" - they mean the measurement is invalid - yet
  `surface-weight.mjs:65` returns `[]` and the run exits `ok:true`. Consistent
  with the pre-existing `isFile()` catch, so not a regression, but it means CI can
  publish a smaller total and skip budget enforcement exactly when the walk broke.
- **A symlinked branch root can double-count.** Traversal is path-based with no
  realpath/inode dedupe, so symlinking `cadence-core/templates` at `references`
  emits the same physical file under both logical paths and `weight.mjs` counts
  its bytes twice. Requires deliberate setup; the root-follows behavior is
  intentional (D-07's recorded exception).

## Goal check

The seven commits deliver the goal, and I verified every criterion independently
rather than taking the executor's word. AC1: the 29 skill descriptions measure
3,759 B against the 5,078 B baseline, all 29 files still carry exactly one
`description:` line, and no line falls outside the 40-175 B band (AC1). AC2: the
19 agent descriptions measure 1,638 B against 3,472 B. AC3: `weight.mjs` reports
92 surfaces and the budget-equality one-liner prints `budgets exact` tree-wide.
AC4: on a fixture with `skills/private/` at mode 000 beside a readable
`skills/good/SKILL.md`, `weight.mjs --root` now lists `skills/good/SKILL.md`
where it printed `"surfaces":[]` before. AC5: `self-verify.mjs --root` on that
same fixture emits
`"kind":"unreadable-surface","file":"skills/private","detail":"EACCES"` - the
path that is actually unreadable, with the real errno. AC6: `node --test
cadence-core/bin/*.test.mjs` reports 1156 pass / 0 fail (up from 1151, the five
new walker rows), `self-verify.mjs` prints `"problems":[]` across all sixteen
checks, `npx tsc -p tsconfig.ci.json` exits 0, and MEASUREMENTS.md's recorded
after-figures (3,759 and 1,638) match my own recomputation of the same commands.
The per-commit budget ratchet was verified by replay rather than by presence: at
both commits that shrank a budgeted surface (`6a63445`, `5df29e5`) an archived
tree measures 92 surfaces with `budgets exact`, so no commit left pre-approved
headroom behind. The gap worth naming is the second open item above - widening
the budget to `**` budgeted two files that neither walker can report on when they
break, which is a smaller version of the hole BUD-02 set out to close.
