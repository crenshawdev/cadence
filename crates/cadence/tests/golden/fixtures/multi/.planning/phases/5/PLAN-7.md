---
phase: 5
plan: 7
requirements: [DOC-02]
files:
  - README.md
  - METHOD.md
  - INTERNALS.md
  - .planning/DOCS-CLAIMS.md
---

# Phase 5: What Cadence claims about itself is true - Plan 7 (the narrative docs, and the ledger closed against them)

## Goal

The three narrative documents a reader trusts before running Cadence -
`README.md`, `METHOD.md`, `INTERNALS.md` - stop stating a review gate, a commit
check and a risk floor the code does not have, and every claim this phase fixed
is closed in `.planning/DOCS-CLAIMS.md` as corrected rather than deferred.

## Must be true when done

- No shipped doc states that a `plan` review is advisory at `shipped`;
  `README.md`, `METHOD.md` and `cadence-core/route-table.json` agree on all
  three levels.
- `METHOD.md`'s Commit protocol asks the executor for no check the executor does
  not make.
- Neither `METHOD.md` nor `INTERNALS.md` describes a risk floor that raises a
  phase's `stakes`, or a `risk.override.<surface>` waiver - both retired in
  v2.7.0 - while every other claim those two passages carry is left standing.
- `grep -c "Prose fix beyond this phase" .planning/DOCS-CLAIMS.md` returns 0,
  and each of the fourteen closed rows reads `corrected - <sha>` against a sha
  that resolves in this repo, with its claim text still the pre-fix wording.
- Opening any row of the eight docs this phase's gaps plans edited at its cited
  line still shows that row's claim, outside the three classes
  `## Reading this ledger` names as provenance.
- `node cadence-core/bin/self-verify.mjs --root .` prints `problems:[]` and
  `node cadence-core/bin/test.mjs prose` exits 0 at every commit this plan
  makes.

## Context

Runs AFTER PLAN-6, which fixes the six ledger rows on the budgeted plugin
surfaces; this plan fixes the other six (README-25, METHOD-59, METHOD-87,
METHOD-93, METHOD-97, INTERNALS-13) and then closes all twelve plus two rows the
same edits invalidate. Accuracy only - phase 6 owns tone and audience over
exactly this prose, and a line may be true and badly voiced when this plan
closes. No task changes `cadence-core/route-table.json`,
`cadence-core/config.schema.json` or `cadence-core/templates/config.json`.

`README.md`, `METHOD.md` and `INTERNALS.md` carry no
`cadence-core/bin/weight-budgets.json` entry and are not weighed
(`unbudgeted-surface` would already be reporting them), so D-09's same-commit
re-pin does not apply to any task here. Two self-verify checks do bite:
`missing-internals-path` resolves every backticked token containing a `/` in
`INTERNALS.md` (`cadence-core/bin/self-verify.mjs:758-763`), and
`inert-config-key` fires when a schema key loses its last prose mention
(`:772-775`).

## Tasks

### Task 1: Correct the plan gate README states

- **Files:** README.md
- **Action:** Line 56 reads "Each trigger gets a gate, `off`, `advisory`,
  `blocking`, or `adjudicated`, so a plan review is advisory at `solo` and
  `shipped`, adjudicated at `critical`." Read `cadence-core/route-table.json`'s
  `review` grid to establish the truth - `plan` is `advisory` at `solo`, `off`
  at `shipped`, `adjudicated` at `critical` - and
  `cadence-core/references/review-triggers.md:351-355`, which states why it is
  off at `shipped` (an advisory gate blocks nothing and its findings files were
  referenced by no SUMMARY and no CONTEXT) and that a user who wants it sets
  `review.triggers.<t>.gate` and wins over the level. Correct the resolution in
  place, with at most one added clause carrying that reason, so a reader does
  not read `off` as an oversight. Four other ledger rows cite this same line as
  accurate and every one of their clauses stays exactly as it is: README-24 (the
  four gate values), README-26 (`risk_surface` blocking at every level including
  `solo`), README-27 (the eight surfaces by name), README-65 and README-66
  (`review.triggers.risk_surface.surfaces` narrowing the list, populated from a
  structural scan). The paragraph is one physical line, so keep the edit inside
  it: README's ledger rows below `:56` are pinned to live lines and a line count
  change would move them all. Do not start phase 6's voice pass on the
  paragraph.
- **Verify:** `sed -n '56p' README.md` states the plan review advisory at
  `solo`, off at `shipped` and adjudicated at `critical`, and still carries the
  four gate values, the `risk_surface`-blocking-at-every-level clause, the eight
  surfaces and the `surfaces` narrowing sentence; `git show --stat HEAD` reports
  1 insertion and 1 deletion on `README.md` and `wc -l README.md` is unchanged
  from the pre-commit count; `node cadence-core/bin/self-verify.mjs --root .`
  prints `problems:[]`.

### Task 2: Make METHOD's two plan-gate sentences agree with its own trigger table

- **Files:** METHOD.md
- **Action:** Two sentences state the `plan` gate wrongly and the document
  already contradicts them: its trigger table at `:285-290` lists `plan` as
  `off` at the default `shipped` level, and the paragraph at `:292-301` says so
  again and gives the reason. Confirm against `cadence-core/route-table.json`'s
  `review` grid (`advisory` / `off` / `adjudicated`), then fix `:309-310`, "a
  `plan` review is advisory at `solo` and `shipped` and adjudicated at
  `critical`", to name `off` at `shipped`; and fix the clause at `:373-374`,
  "the plan review in `/cad-plan`, advisory at `shipped` and adjudicated at
  `critical`", inside the "Three more end this way wherever their gate resolves
  adjudicated" list. Leave the neighbouring clause at `:310-311` - "an ordinary
  `diff` is off at `solo` and `shipped`, and blocking at `critical`" - byte for
  byte: it is METHOD-94 and it is accurate. Leave the `diff` and `phase_diff`
  members of the `:371-377` list alone as well; they sit outside these two rows
  and read true against the same grid. Change nothing else in either paragraph.
- **Verify:** `grep -n "advisory" METHOD.md` returns no line pairing a plan
  review with `shipped`; the diff sentence at `:310-311` is untouched (`git show
  HEAD -- METHOD.md` shows no `-` line containing "an ordinary `diff` is off");
  `node cadence-core/bin/self-verify.mjs --root .` prints `problems:[]`.

### Task 3: Remove the staged-diff risk check from METHOD's commit protocol

- **Files:** METHOD.md
- **Action:** The Commit protocol at `:154-159` tells an executor "Then check
  the staged diff against the risk-surface list before committing." No such
  check exists. Establish that from this same document at `:415-419` - the
  `risk_surface` review "fires once, against the plan's completed commit range,
  never against a staged index mid-plan", with the paragraph's own account of
  why halting at each risky commit was dropped - and from
  `cadence-core/references/review-triggers.md`'s Wiring table `risk_surface`
  row, which reads "ONCE per plan/task/fix - `cad-execute`/`cad-task` on the
  completed commit range, never mid-plan". Remove the staged-diff instruction.
  Keep the rest of the protocol exactly as it stands - stage the specific files
  individually, never `git add -A` or `git add .`, the
  `{type}({scope}): {description}` message shape, the post-commit glance for
  unexpected deletions and untracked generated files - because that is
  METHOD-88's accurate claim and the whole of what the protocol asks for. If
  anything replaces the removed clause, it says only what the document already
  states elsewhere: the risk-surface review fires once, on the plan's completed
  range. Do not restate the `:415-419` paragraph here.
- **Verify:** `grep -n "staged diff" METHOD.md` returns no line inside the
  Commit protocol; the protocol still names `git add -A`, the
  `{type}({scope}): {description}` shape and the post-commit glance; `node
  cadence-core/bin/self-verify.mjs --root .` prints `problems:[]`.

### Task 4: Retire the risk floor from METHOD and INTERNALS

- **Files:** METHOD.md, INTERNALS.md
- **Action:** Both documents describe a dispatch-time risk floor and a waiver
  that no longer exist. `METHOD.md:421-428` says "Detection also sets a floor",
  that a phase's `stakes` level is raised when its plan declares a path on a
  risk surface, that the raise only ever goes up, and that lowering it takes a
  named per-surface `risk.override.<surface>` read from the repo config alone;
  `INTERNALS.md:13` says the same inside one long line ("Your answer is a floor
  rather than the last word, though: ... It only ever raises; a project already
  at `critical` is unaffected."). Establish the truth from
  `cadence-core/bin/route.mjs:64-76`, whose comment states the
  `risk.override.<surface>` family "is retired ... along with the dispatch-time
  floor that gave it something to lower", that the floor judged a file by its
  NAME and raised a whole phase on one path token, and that the surfaces list
  now scopes ONE review trigger's fire rather than any floor; from
  `cadence-core/bin/config-seams.test.mjs:615-630`, which pins that a set
  `risk.override.auth` is named in `warnings` and routes nothing; and from
  `cadence-core/config.schema.json`, which carries no `risk.*` key at all.
  Rewrite METHOD's paragraph to state that detection sets no floor: the level is
  not raised by what a plan declares, the name-based detector and the eight
  `risk.override.*` waivers were cut in v2.7.0, and what the surfaces drive
  instead is the one `risk_surface` review that is blocking at every level and
  fires once on the completed commit range. Do the same for the floor clause
  inside `INTERNALS.md:13` and leave every other clause of that line intact -
  seven ledger rows cite it as accurate (INTERNALS-08 the `stakes` key and
  `/cad-config stakes=shipped`, -09 what a cell carries, -10 the routed
  `sonnet`/`opus` vocabulary with `haiku`/`fable` pin-only, -11 an explicit pick
  wins and a config gate beats the level's only if it is one of the four values,
  -12/-41 `model.escalate_on_failure` off by default, -14 CI refusing a retry
  rung below its start). `README.md:58` already states the v2.7.0 cut
  correctly ("that detector is gone as of v2.7.0. What the code does decides;
  what the file is called does not") and is the account to stay consistent with.
  Any repo path this rewrite puts in backticks inside `INTERNALS.md` must exist
  on disk - `missing-internals-path` resolves every backticked token containing
  a `/`. Keep the destructive-op pre-filter paragraph that follows METHOD's
  floor paragraph untouched.
- **Verify:** `grep -n "risk.override" METHOD.md INTERNALS.md` returns nothing,
  or only a line stating the family is retired; `grep -n "floor" METHOD.md
  INTERNALS.md` returns no line claiming a phase's level is raised by detection;
  `sed -n '13p' INTERNALS.md` still carries the `stakes` key sentence, the
  cell-is-a-bundle sentence, the `sonnet`/`opus` routed-vocabulary sentence, the
  gate-beats-the-level sentence, `model.escalate_on_failure` off by default and
  the CI retry-rung refusal; `node cadence-core/bin/self-verify.mjs --root .`
  prints `problems:[]`; `node cadence-core/bin/test.mjs prose` exits 0.

### Task 5: Re-pin the ledger cites this phase's gap edits moved

- **Files:** .planning/DOCS-CLAIMS.md
- **Action:** PLAN-6 and this plan edit eight ledgered docs that together carry
  413 rows (`README.md` 84, `METHOD.md` 107, `INTERNALS.md` 48,
  `cadence-core/workflows/plan.md` 56, `cadence-core/workflows/new-project.md`
  36, `cadence-core/workflows/adopt.md` 29,
  `cadence-core/references/config-catalog.md` 41,
  `cadence-core/references/recall.md` 12). `## Reading this ledger` states at
  `:206-216` that outside three named classes, opening a row's `doc` at its
  `line` shows its claim, and phase 5's AC2 is checked against that sentence, so
  an edit that shifts lines without re-pinning regresses a criterion that
  already passed. For each of the eight docs run `git diff -U0
  13094a8..HEAD -- <doc>`, take each hunk's net line delta, and shift every row's
  `line` cell for that doc that sits BELOW a hunk by the cumulative delta above
  it; a cell above the first hunk does not move, and a doc whose hunks net to
  zero needs no edit at all - record which of the eight those were. Change only
  `line` cells: no `claim`, `verdict`, `resolution` or `run` cell moves here,
  which is how `a829f39` scoped the same job. Leave the fourteen rows task 6
  closes at the cite they carry now - a corrected row's cite is provenance by
  the rule at `:173-181` and `:206-208`, not an address.
- **Verify:** For each of the eight docs, the shift applied to its rows
  reproduces the per-hunk deltas of `git diff -U0 13094a8..HEAD -- <doc>`; open
  each doc at the cite of the first row below its last hunk and at the cite of
  its largest-numbered row (16 reads) and each shows that row's claim text;
  `git show --stat HEAD` lists `.planning/DOCS-CLAIMS.md` as the only file in
  the commit; `git show HEAD -- .planning/DOCS-CLAIMS.md` shows every changed
  line differing in its third field only.

### Task 6: Close the fourteen rows and re-state the ledger's own counts

- **Files:** .planning/DOCS-CLAIMS.md
- **Action:** Twelve rows carry a `stale` verdict with a `divergence - ...
  prose fix beyond this phase` resolution and are exactly what `grep -n "Prose
  fix beyond this phase" .planning/DOCS-CLAIMS.md` returns: README-25, PLAN-27,
  PLAN-49, NEW-PROJECT-27, ADOPT-09, CONFIG-CATALOG-07, RECALL-01, METHOD-59,
  METHOD-87, METHOD-93, METHOD-97, INTERNALS-13. Move each resolution to
  `corrected - <sha> - <what changed>`, naming the PLAN-6 or PLAN-7 commit that
  fixed that claim; leave the `verdict` at `stale`, because the stale verdict is
  the finding and the resolution is the fix, and leave the `claim` cell at its
  pre-fix wording - `:173-181` states that a corrected row's claim text is what
  was read BEFORE the fix and that rewriting it is a deliberate, called-out
  exception rather than the rule. Two further rows are made false by these same
  edits and are closed with them, both currently verdicted `accurate`: METHOD-25
  (`METHOD.md:156-157`) restates the staged-diff risk check as part of the
  commit protocol, the identical claim METHOD-87 records as stale; and
  NEW-PROJECT-08 (`new-project.md:61`) reads "Defaults are research off, plan
  check on, verifier on", which `cadence-core/templates/config.json`'s
  `"plan_check": false` contradicts on its own. Re-verdict both `stale` and
  resolve them `corrected - <sha>` alongside the twelve; leaving either at
  `accurate` would have the ledger asserting, after the fix, the very sentence
  the fix removed. Then close the file out consistent with itself. The
  `**Resolution values**` paragraph at `:306-316` states 28 `corrected` and 57
  `divergence` cells - both exact against the live file on 2026-08-15 - and must
  state the post-fix counts. The paragraph at `:173-181` classifies the 28 into
  20 that keep run 1's verdict and 8 whose claim TEXT was rewritten; these
  fourteen are a third shape - a run-2 `stale` verdict, pre-fix claim text, and
  a cite that becomes provenance - so name them as their own class rather than
  folding them into either. Add the called-out paragraph this file's convention
  requires for a batch of corrections, in the shape of the phase-4/5 paragraph
  at `:290-304`, recording that the prose was fixed at source by this phase's
  gaps plans and that the claim text was deliberately NOT rewritten, so these
  rows are closed findings that never join the next cycle's diff. Do not
  re-verdict, re-pin or re-word any other row.
- **Verify:** `grep -c "Prose fix beyond this phase" .planning/DOCS-CLAIMS.md`
  returns 0; each of the fourteen ids reads a `corrected - <sha>` resolution
  whose sha `git cat-file -e <sha>` resolves; re-counting the resolution cells
  by splitting rows on unescaped pipes yields exactly the two numbers the
  `**Resolution values**` paragraph now states; `git diff 13094a8..HEAD --
  .planning/DOCS-CLAIMS.md` shows no change inside the `claim` cell of any of the
  twelve; `node cadence-core/bin/self-verify.mjs --root .` prints `problems:[]`
  and `node cadence-core/bin/test.mjs prose` exits 0.

## Notes

`13094a8` is the phase-5 UAT commit and the base this plan's line-delta and
claim-text comparisons are taken against; it is HEAD when PLAN-6 opens.

The count reconciliation (twelve, not the eight the SUMMARY and CAPTURE state)
is recorded in PLAN-6's Notes. Two further inaccuracies were measured while
planning and are NOT tasked here, because they are defects in the ledger's own
transcription rather than in shipped prose, and no criterion of this phase
reaches them: INTERNALS-12 reads "`model.escalate_on_failure`, on by default"
under an `accurate` verdict, while the doc it cites says off and
`templates/config.json` writes `false` (INTERNALS-41, same line, states it
correctly); and CONFIG-CATALOG's `review.triggers.<t>.gate` row publishes a
default column - `adjudicated` for plan, `advisory` for diff/phase_diff - that
`route-table.json` resolves at no stakes level, though it is a faithful reading
of `config.schema.json`'s per-key defaults. Both are queue items for a human to
route.

Sequential with PLAN-6 and second: tasks 5 and 6 read commits PLAN-6 makes. The
two plans share no file.
