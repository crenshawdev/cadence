---
phase: 4
status: complete
completed: 2026-07-28
---

# Phase 4: A stated grammar for the roadmap phase list - Summary

An empty `## Phases` is now a derived closed-milestone state (`cycle:"none"` on an
`ok:true` `status` envelope) rather than `unparseable-roadmap`, and every
phase-shaped line that is NOT the canonical entry is reported per line with its own
diagnostic code by a pure classifier, `classifyPhaseList`.

## What shipped

- `classifyPhaseList(text)` + `CLOSED_CYCLE_NAME` - `cadence-core/bin/lib/planning-files.mjs:80-150`.
  Pure, total, no I/O; returns `{state, phases, issues}` over `live | closed |
  out-of-grammar | no-section`, with the two deliberate extents (canonical parse
  bounded at the next `^## `, classification scan to end of text, D-03).
- Five out-of-grammar codes with a `{line, code, text}` issue each - `phase-heading`,
  `phase-bullet`, `phase-ordered-item`, `phase-table-row`, `phase-prose-line`
  (`planning-files.mjs:131-136`), each pinned by a row in the 22-row
  `PHASE_LIST_ROWS` table in `cadence-core/bin/planning-files.test.mjs`.
- Closed-milestone derivation in `status` - `cadence-core/bin/planning.mjs` `cmdStatus`:
  additive `cycle:"none"` with `current:null`/`total:0` (D-08), a per-line `issues[]`
  failure envelope, the new `phase-dir` drift kind, the closed cursor-agreement arm
  (D-09), and the stale-total `cursor` drift.
- Closed derivation in `cursor set` - `cmdCursorSet` writes `Phase: <N> of 0 (no
  active cycle)` ahead of the prior-cursor fallback, so `/cad-milestone` step 6 runs
  on the tree its own step 3 produces (D-10).
- The grammar written down - new `cadence-core/references/roadmap-phases.md` (149
  lines), pointed at from `references/plan-frontmatter.md`.
- Contradicted surfaces moved - `workflows/milestone.md` (step 3 now prunes each
  phase's `### Phase N:` detail section, the load-bearing edit), `workflows/progress.md`,
  `skills/cad-health/SKILL.md`, `skills/cad-progress/SKILL.md`, with
  `weight-budgets.json` bumped in the same commit (D-14).
- `CHANGELOG.md` entry under `## [1.4.0] - unreleased`.

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | be19a0b | `classifyPhaseList` + `CLOSED_CYCLE_NAME`; `parseRoadmapPhases` normalizes on the parse path; 22-row grammar table |
| 1 | 2 | d1c4f85 | `status` derives the closed milestone, its `phase-dir`/stale-total drift, and its cursor agreement |
| 1 | 3 | c0802b9 | `cursor set` closed-milestone derivation, ahead of the prior-cursor fallback |
| 1 | 4 | d71ce56 | `references/roadmap-phases.md`; `plan-frontmatter.md` points at it |
| 1 | 5 | 9027cbf | milestone/progress/cad-health/cad-progress moved; budgets bumped in the same change |
| 1 | 6 | f14b8b1 | CHANGELOG entry under `[1.4.0]` |

Range: `824787e..f14b8b1`, 6 commits, 12 files, +726/-26.

## Deviations

- [deviation] Task 1's note predicted `cutPhaseDetail`'s bare `### Phase N:` anchor
  would fail on a CRLF checkout and told the executor to fix it. Observed: BOTH the
  bare and the named heading cut correctly. The note's stated mechanism is wrong
  (`.` does not match `\r`), but the conclusion holds for a different reason - under
  `/m`, `$` matches before `\r` too. No anchor change; two `cutPhaseDetail: ... on a
  CRLF checkout` regression tests added instead. (be19a0b)
- [deviation] `design-notes/planning-mjs-interface.md` is in task 5's file list but
  `/design-notes/` is gitignored in this repo. The `cycle` field, `phase-dir` drift
  kind, closed status shape and `cursor set` derivation were written into it on disk;
  they are in no commit. Noted in 9027cbf's message. (9027cbf)
- [deviation] Task 5's quoted budgets (progress 5346, milestone 6251, cad-health 2547,
  cad-progress 981) were exact pre-edit; post-edit values written are 6355 / 7181 /
  2966 / 1016. (9027cbf)
- [deviation] Task 6's verify block ends in slash-command surfaces the executor cannot
  invoke. The machine-checkable half ran; the three slash-command checks are open
  items below.

## Open items

- ~~**HIGH, regression from be19a0b - a lone-CR (classic-Mac) ROADMAP.md is now silently
  corrupted by `renumber remove`.**~~ **CLOSED by `81bab78`** (`/cad-task`, same branch):
  the parse path split into `normalizeCrlf` (BOM + `\r\n`) for the roadmap grammar, with
  the shared `normalize` left unchanged for the frontmatter reader that never writes back.
  Lone CR returns to unparseable, so `renumber remove` bails `ok:false` with the file
  byte-identical. The CRLF half was verified rather than assumed: every roadmap write path
  matches without a `$` anchor (`setPhaseBox:197`, `cmdRenumber`'s list filter) or under
  `/m` where `$` matches before `\r` (`cutPhaseDetail:1153`), so CRLF round-trips - a CRLF
  `renumber remove` was run end to end and preserved both the renumbering and the line
  endings. 8 tests added (4 parser-level, 4 seam-level), all 4 lone-CR ones confirmed
  failing-capable by reintroducing the regression. `references/roadmap-phases.md`'s
  Normalization section corrected in the same commit. Original finding for the record: Adding `normalize()` inside the shared
  `parseRoadmapPhases` (`lib/planning-files.mjs:66`) makes lone-`\r` files parse, but
  every WRITE path still splits on `'\n'` against raw bytes. Reproduced live at HEAD:
  a lone-CR roadmap with phases 1 and 2 plus both detail sections, then
  `planning.mjs renumber remove --n 1` returns `{"ok":true,"ops":[{"edit":"ROADMAP.md","changes":2}],"total":2}`
  and leaves
  `"# Roadmap\r\r## Phases\r\r- [x] **Phase 1: A** - a\r- [ ] **Phase 1: B** - b\r\r## Phase Details\r\r"`
  - two `**Phase 1:**` lines and BOTH detail sections deleted, no warning. Pre-diff
  (`824787e`) the same file gave `parseRoadmapPhases -> []` and the command bailed
  with `unparseable-roadmap`. The same asymmetry makes `phase-done --n 1` answer
  `unknown-phase` for a phase `status` reports as existing (`setPhaseBox` also splits
  on `'\n'`). Fix is to normalize on the write paths too, or restrict the new
  `normalize` to CRLF only. Converged by `cad-reviewer`, verified independently here.
- **MEDIUM - `progress.md`'s route table has no `phase-dir` row**, so its own reconcile
  rule is unreachable. `progress.md:64-66` says drift kind `phase-dir` routes to
  `/cad-milestone` to finish the interrupted prune; the route table at `:99-110` is
  explicitly first-match-wins/one-suggestion-only and the only matching row is
  `` `cycle` is `none` (milestone closed) | /cad-phase add ``. An interrupted close is
  therefore offered a NEW phase on top of an unfinished prune - the exact state the
  `phase-dir` drift was added to catch.
- **MEDIUM - three other `status` consumers were never taught `cycle`.**
  `grep -n "cycle" cadence-core/workflows/{coverage,execute,plan}.md` returns nothing.
  An empty phase list used to stop them at `ok:false`; it now returns
  `{"ok":true,"cycle":"none","current":null,"total":0,"phases":[]}`. `coverage.md:13-17`
  says take "the highest phase whose status is complete, else executed" from an empty
  array with no rule for that case. Task 5's file list did not include them.
- **LOW/MEDIUM - a canonical phase line under a LATER `## ` heading gets a dead-end
  diagnostic.** The classification extent runs to EOF (deliberate, D-03), so a
  byte-perfect `- [ ] **Phase 1: Auth** - ...` sitting under `## Next milestone (draft)`
  is reported `phase-bullet`, whose documented fix ("rewrite as the canonical entry")
  is a no-op on a line that already is one. The real cause (wrong section) is never
  named. `planning-files.mjs:133`.
- **LOW - `/cad-pause` erases the interrupted-close evidence.** `skills/cad-pause/SKILL.md`
  calls `cursor set` with no `--name`/`--total`; against a zero-phase roadmap the new
  closed arm fills `no active cycle`/`0`, destroying the stale `of <M>` that
  `cmdStatus` treats as the only surviving signal of an unfinished close.
- **LOW / by design - `PHASE_TOKEN` matches a phase number in prose.**
  `/\bPhase (\d+(?:\.\d+)?)\b/` matches `Phase 1.2.3` in a sentence, so a legitimately
  closed roadmap that retains prose mentioning a capitalized phase number classifies
  `out-of-grammar`. This is the stated catch-all (`phase-prose-line`) doing what the
  grammar says; the documented escape is lowercase `phase`. Recorded, not filed as a bug.
- **Human-verify, slash-command surfaces (task 6).** Against a scratch TEMPLATE-shaped
  tree pruned by the amended step 3: (a) `/cad-progress` reports the closed milestone
  and offers `/cad-phase add`; (b) `/cad-health` reports no structural issue; (c)
  `/cad-phase add` on that pruned roadmap round-trips. The executor verified (c)'s
  mechanical equivalent at the seam; what stays unverified is `workflows/phase.md`'s
  own "current total + 1" derivation from zero.

## Goal check

The commits plausibly deliver the goal, and the one before/after the phase exists to
move is verified end to end rather than asserted. A template-shaped roadmap pruned by
the AMENDED `milestone.md` step 3 now returns `{"ok":true,"current":null,"total":0,"cycle":"none","phases":[]}`
from `planning.mjs status`, where the same tree pruned by HEAD's wording (list lines
only) still returns `unparseable-roadmap` naming the surviving `### Phase 1: Auth`,
`### Phase 2: Billing` and `**Depends on:** Phase 1` lines - so the closed state is
reachable on the shipped close path, not just on a roadmap that happens to have no
detail section, and step 3's prune edit (`grep -n "Phase Details"
cadence-core/workflows/milestone.md`, zero hits at HEAD) is what makes it so. The
cursor half round-trips: `cursor set --phase 1 --status "ready to plan" --next
"/cad-phase add"` against a pruned roadmap returns
`{"ok":true,"cursor":{"phase":1,"total":0,"name":"no active cycle",...}}` and the
following `cursor get` returns `ok:true`, never `unparseable-cursor`. The out-of-grammar
diagnostic names the offending LINE rather than one blanket string:
`{"ok":false,"reason":"unparseable-roadmap","detail":"line 5: - Phase 1: Ship auth","issues":[{"line":5,"code":"phase-bullet","text":"- Phase 1: Ship auth"}]}`.
`node --test cadence-core/bin/*.test.mjs` is 666 pass / 0 fail, `npx tsc -p
tsconfig.ci.json` exits 0, and `node cadence-core/bin/self-verify.mjs` prints
`{"ok":true,...,"problems":[]}` - no `budget-overrun`, no `missing-path` for the new
reference. What is missing is at the edges, not the center: the routing half of the
goal ("routes to a destination that exists") is delivered in the table but contradicted
by the same file's reconcile rule for `phase-dir`, so an interrupted close routes to
`/cad-phase add` instead of `/cad-milestone`; three other workflows read the status
envelope and were never told what `cycle` means; and the phase introduced one HIGH
regression outside its own surface - a lone-CR roadmap that used to be inert now parses
into the write paths and `renumber remove` corrupts it while reporting `ok:true`. None
of those is a claim this phase makes falsely; they are the phase's blast radius, and
they belong to `/cad-verify 4`.
