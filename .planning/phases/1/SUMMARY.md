---
phase: 1
status: complete
completed: 2026-08-08
---

# Phase 1: Queue triage - Summary

`.planning/CAPTURE.md` went from a 213-item append-only log to 28 current-cycle
open items each carrying one dated, tree-backed verdict, with the 185 historical
open items moved under a single dated `## Archive` block that `planning.mjs
recall` cannot see.

## What shipped

- The triaged queue - `.planning/CAPTURE.md` (gitignored per D-01, working tree
  only). 28 open items above `## Archive` at `:129`, 185 archived below it, 51
  `- [x]` closed items still in `## Todos` and still in the corpus.
- The archive block and its one dated reason - `.planning/CAPTURE.md:129`,
  stating the presumptive-death premise for the whole move rather than a
  per-item verdict.
- 32 historical `(phase N)` tags requalified to `(vX.Y.Z phase N)`, each
  milestone established from tree evidence (earliest release tag containing the
  cited sha, or the archived phase CONTEXT title).
- The kept-item assignment list - `.planning/phases/1/reports/plan-1.md`, 24
  KEPT rows plus one `## Notes` carry-over row, each with a re-verified citation.
- The `.gitignore` rule protecting triage working copies - `.gitignore`,
  commits `e578e76` and the `diff`-review fix that followed it.

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | e578e76 | Ignore per-phase triage working copies of the planning queue |
| 1 | 2-5 | none (D-01) | Queue edits: `.planning/CAPTURE.md` is gitignored, so no tracked file changed |
| - | diff review | da4e3aa | Re-anchor the ignore rule on the directory name, so a milestone close cannot publish the copies |

## Deviations

- [deviation] The plan stated 44 checked bullets carrying a bare tag; 42 were
  observed. Re-measured with the reader's own anchored regex
  (`planning-files.mjs:627`) applied after the checkbox strip: 179 open tagged
  (matching CONTEXT D-05 exactly) and 42 checked tagged, so the requalification
  set is 32 rather than the plan's 34. The plan instructed re-derivation over
  trusting its figures, and the 38 / 28 / 10 current-cycle figures did reproduce.
- [deviation] Tasks 2 through 5 produced no commit. `.planning/CAPTURE.md` is
  gitignored (`.gitignore:23`) and D-01 fixes it that way, so those tasks change
  no tracked file. No `--allow-empty` marker commit was created: an empty commit
  would assert a change git cannot show, and D-01's point is that the queue's
  state is not in history. `reports/plan-1.md` is the durable record and IS
  tracked.
- [deviation] The `diff` review returned a blocker against task 1's own commit
  and it was fixed rather than reported. `/.planning/phases/*/triage-work/`
  anchored the rule to one fixed parent, but a milestone close MOVES
  `phases/<N>/` to `_archive-<label>/<N>/` and commits everything under it
  (`cadence-core/workflows/milestone.md:77-84`), so the 716 KB of candid queue
  copies would have stopped being ignored at exactly the moment they got
  staged - inverting D-01. Confirmed independently before acting:
  `git check-ignore --no-index .planning/_archive-v2.6.0/1/triage-work/baseline/CAPTURE.md`
  reported NOT IGNORED under the old rule, and `git show --stat 49bf093` shows
  the v2.5.0 prune committing every file under the moved dirs wholesale, so this
  repo takes that branch in practice. The rule is now
  `/.planning/**/triage-work/`, matched on the directory name at any depth,
  which also closes the reviewer's second finding (`tasks/<name>/` and
  `spikes/<name>/` are tracked trees with no protection). Verified across five
  paths ignored and three real artifacts still tracked-eligible.
- [deviation] No static-analysis command exists for this project.
  `workflow.lint_command` is `null` and `planning.mjs detect-commands` returns
  `{"lint":null,"typecheck":null}`, so the contract's both-null arm applied to
  every task.

## Open items

- `cadence-core/bin/lib/trace.mjs` contains two literal NUL bytes and is
  invisible to `grep`. The composite worker key at `:296` is written with raw
  U+0000 characters rather than the `\0` escape, so `file(1)` reports the source
  as `data` and every `grep`/`rg` over `cadence-core/bin/**` silently skips the
  whole file unless `-a` is passed. Confirmed independently: `file` returns
  `data` and `sed -n '294,298p' ... | cat -v` shows `^@` in the template
  literal. Nothing is broken at runtime; the cost is a blind spot in exactly the
  file the joined trace lives in. The fix is one character, `\0` in the
  template. Found while re-verifying an item, not looked for, and out of scope
  here - this phase fixes no defect it finds.
- Two current-cycle KEPT items (assignment rows 15 and 16) describe the
  published-version guard surface phase 2 must build FRI-03 on. They are routed
  to phase 2 as inputs, not as defects.
- AC6 holds on the reader's strict definition but two closed bullets sit in a
  third state worth naming: `(phase 5, criteria-coverage)` at `CAPTURE.md:53-54`
  is not a bare `(phase N)` tag - the anchored regex at
  `planning-files.mjs:627` requires `)` immediately after the digits, so it
  yields no phase field and cannot collide with this cycle - but it was not
  requalified to `(vX.Y.Z phase N)` either. The functional half of AC6 is
  satisfied; the cosmetic half is not, for two items.
- 23 of the 24 KEPT rows are `unassigned`. That is a result, not an omission:
  these are v2.5.0's own residue, while phases 2 and 3 were scoped from the
  older material now archived, so the overlap is genuinely small. Assigning a
  row because it is plausible would grow those phases past the requirements they
  were sized against.

## Goal check

The phase goal is that `.planning/CAPTURE.md` stops being an append-only log and
becomes the set of things still true, with every verdict backed by the tree
rather than by its own wording. The commits alone do not show this, and that is
the phase's defining property rather than a gap: one commit landed
(`e578e76`, a `.gitignore` rule) because D-01 keeps the queue untracked, so the
evidence has to come from the tree itself. Checked directly rather than taken
from the executor's report: `## Archive` is at `CAPTURE.md:129`; 28 open bullets
sit above it and 185 below; all 28 above carry one of the four D-04 verdict
shapes (`grep -cE 'CLOSED [0-9]{4}-|MOOT|KEPT'` over the open bullets above the
heading returns 28, matching the bullet count exactly); `grep -c '^- \[x\]'`
returns 51 with zero of them below the archive heading, so D-02 held and no
closed item was archived. The invisibility claim (AC2) rests on the executor's
paired control run rather than on a check I re-ran: `interrogation` returns
`{"ok":true,"results":[]}` against the live file and one result against a
control copy whose `## Archive` heading was renamed into the walked set. What is
not delivered here, deliberately, is any fix: 24 items were KEPT and re-verified
rather than resolved, and the `trace.mjs` NUL defect found in passing is
recorded, not repaired. One thing the phase's own gate could not have caught is
worth stating: `PLAN.md:102` asserted `git check-ignore -q` only at the
pre-move path, so the ignore rule passed its task verify while being wrong for
the path the copies end up at. The `diff` review is what found it, and the fix
is in the commits above. The goal is met on the reading the phase was scoped to
after the 2026-08-08 cut - a queue whose surviving items are individually true -
and not on the older reading that every one of 213 items gets a verdict, which
that cut removed.
