# Cadence documentation claim ledger

The diff base for the next documentation sweep. Every factual claim
`/cad-docs-verify` extracted from Cadence's own self-description in run 1 has a
row here with its verdict and how it was resolved. The next cycle re-verifies
these rows rather than re-extracting the surface from scratch, so a report that
shrinks is a report that shrank because claims were fixed and not because the
extraction happened to land differently (DOC-02, phase 5 D-03).

## Run 1

Swept 2026-08-09 at `a6b8931` on `cadence/v2.6.0`.

Surface: 25 files, 268,992 B — `README.md`, `METHOD.md`, `INTERNALS.md`,
`CONTRIBUTING.md` and all 21 `cadence-core/workflows/*.md`. The full run-1
report is `.planning/phases/5/docs-verify-run-1.md` (archived with the phase at
the milestone close).

Counts: **509 accurate, 18 stale, 20 unverifiable** — 547 claims. Those are
counted from the report's table ROWS. The report also carries three per-group
headline lines that sum to 480/18/20; each undercounted its own group's accurate
rows, and the report says so. The rows are the record, and this ledger is
transcribed from them.

Three invocations over an explicit path list, recorded verbatim so the next
cycle re-runs them unchanged (D-01, D-02):

1. `/cad-docs-verify README.md METHOD.md INTERNALS.md CONTRIBUTING.md`
2. `/cad-docs-verify cadence-core/workflows/{audit,config,config-review,context,coverage,debug,decision-review,docs-verify,execute,milestone}.md`
3. `/cad-docs-verify cadence-core/workflows/{new-project,phase,plan-gaps,plan,progress,spike,task,undo,verify-deep,verify,verify-sweep}.md`

`docs-verify.md`'s default target set is deliberately NOT changed to match:
`cadence-core/workflows/` is a Cadence-only path, and a generic default naming
it would be wrong prose in the shipped plugin for every other project (D-01).

Two constraints the sweep ran under:

- `CONTRIBUTING.md` was swept by hand end to end, because no mechanical check
  covers it — `cadence-core/bin/self-verify.mjs`'s `mdFiles` walk lints only
  `README.md`, `INTERNALS.md` and `METHOD.md` at the top level (D-15). As of
  `v3.5.5` that walk also covers every page under `docs/`; `CONTRIBUTING.md`
  is still off it.
- `CONTRIBUTING.md:13`'s "the same three checks CI runs" is verified accurate
  against `.github/workflows/test.yml` rather than left unverifiable: that
  workflow still executes, with `origin` self-hosted and GitHub a mirror
  (D-14). The adjacent "no dependencies / no `npm install`" claim was judged on
  its own merits and came back stale.

A search hazard applied throughout run 1, and no longer applies:
`cadence-core/bin/lib/trace.mjs` carried two literal NUL bytes at `:336`, so
`grep`/`rg` over `cadence-core/bin/**` silently skipped that whole file without
`-a`. Filed as `DFC-01` and CLOSED in phase 1 of `v2.6.1` (`1e949bc`): the bytes
are now the `\0` escape and `self-verify` check 15 fails on a literal U+0000
anywhere under `cadence-core/bin/**`.

## Run 2

Swept 2026-08-14 on `cadence/v3.3.0`, in two halves: half A read the docs at
`4602393`, half B at `b41821e`. The reports are
`.planning/phases/5/docs-verify-run-2-a.md` (invocations 1 and 2) and
`.planning/phases/5/docs-verify-run-2-b.md` (invocations 3, 4 and 5 plus the
targeted `.mjs` pass). Neither half states a run-2 total; this section joins
them.

Surface: 32 files, 322,989 B across the five invocations — 14 files / 185,264 B
in half A, 18 files / 137,725 B in half B — against run 1's 25 files /
268,992 B. Three `.mjs` files (`cadence-core/bin/lib/trace.mjs`,
`cadence-core/bin/planning.mjs`, `cadence-core/bin/self-verify.mjs`, 298,480 B
between them) were NOT swept and were read only at ten cited sites; see the
targeted pass below.

Five invocations. The first three are transcribed byte-identically from `:28-30`
above, because run 1's recorded invocations are re-run unchanged so run 2's
counts stay comparable (D-01). New surface is reached by ADDING a named
invocation, never by widening a recorded one: widening invocation 2 or 3's glob
would move the surface run 1's 509/18/20 = 547 counts were taken over and make
run 2 non-comparable by construction.

1. `/cad-docs-verify README.md METHOD.md INTERNALS.md CONTRIBUTING.md`
2. `/cad-docs-verify cadence-core/workflows/{audit,config,config-review,context,coverage,debug,decision-review,docs-verify,execute,milestone}.md`
3. `/cad-docs-verify cadence-core/workflows/{new-project,phase,plan-gaps,plan,progress,spike,task,undo,verify-deep,verify,verify-sweep}.md`
4. `/cad-docs-verify cadence-core/workflows/{adopt,minimalism-review,report,suggest}.md`
5. `/cad-docs-verify cadence-core/references/{config-catalog,recall,plan-revision}.md`

Invocation 4 exists because run 1 swept 21 workflow files and
`cadence-core/workflows/` now holds 25. Two of the four (`report.md`,
`suggest.md`) describe the run record this cycle's phase 2 rewrote, so deferring
them would leave them unchecked for a second cycle. Everything invocation 4
extracts is NEW claim surface: none of those four files carries a run-1 row.

Invocation 5 exists because those three reference docs carry 32 ledgered rows
between them (`config-catalog.md` 29, `recall.md` 2, `plan-revision.md` 1) and
no recorded invocation ever named them — run 1 re-pointed claims here from the
docs that cite them without sweeping the files. Their rows are NOT new surface;
they join to existing rows on `doc` plus claim text. D-04 is untouched either
way: an explicit-path invocation changes no default target set, and
`cadence-core/workflows/docs-verify.md`'s default is not edited.

**The targeted `.mjs` pass** verdicted the ten ledgered rows whose `doc` is a
`.mjs` file — five citing `cadence-core/bin/lib/trace.mjs`, four
`cadence-core/bin/planning.mjs`, one `cadence-core/bin/self-verify.mjs` — by
reading each cited SITE rather than by sweeping the files. It is a per-row
re-verdict and not a sixth invocation because a full extraction over 298,480 B
of code to decide ten claims is a trade this project's token posture refuses.
Its location cells carry the LIVE line, which is what the re-pin below reads.

Counts, from the claim table ROWS in the two reports and never from a per-group
headline, kept apart per invocation so that only the re-run arm is set against
run 1:

- **Invocations 1-3, the re-run arm: 562 accurate, 9 stale, 15 unverifiable —
  586 claims.** This is the ONLY figure comparable to run 1's 509/18/20 = 547,
  and it is taken over the same 25 files. (Half A splits 168/6/8 = 182 for
  invocation 1 and 188/0/1 = 189 for invocation 2; invocation 3 is
  206/3/6 = 215.)
- **Invocation 4, new surface: 82 accurate, 1 stale, 2 unverifiable — 85
  claims.** Not comparable: none of these existed in run 1's 547.
- **Invocation 5, ledgered docs no invocation had named: 58 accurate, 2 stale,
  2 unverifiable — 62 claims.** Not comparable either, though the rows
  themselves join to 32 existing ledger rows.
- **Targeted `.mjs` pass: 8 accurate, 0 stale, 2 unverifiable — 10 claims.** Not
  comparable: a per-row re-verdict, not an extraction.

743 claim rows across both reports (586 + 85 + 62 + 10). Every one of them is
accounted for in the tables below: 358 joined to a row already here and carried
run 2's verdict onto it, and 385 joined to nothing and are filed under
`## Claims added after run 1`. That is why the tables now hold 933 rows - the 548
that predate this run plus those 385 - and why exactly 743 of them read `2` in
the `run` column.

**Re-pin scope: every ledgered doc that CHANGED since `a6b8931`.** Measured with
`git diff --quiet a6b8931 HEAD -- <doc>` per distinct `doc` value, that is 23 of
the 31 docs the ledger cited when run 2 started, carrying 493 of the 548 rows it
held then - the 385 rows run 2 itself filed are pinned live by construction and
are not part of that scope. The other eight docs are
byte-identical to run 1 and their 55 rows were not re-read: `config-review` 10,
`coverage` 8, `docs-verify` 4, `phase` 13, `plan-gaps` 4, `spike` 2, `undo` 8,
`verify-sweep` 6.

The scope is the `a6b8931` baseline rather than phase 5 D-08's seven docs
because D-08 enumerated what moved since `81bdb5d` — this cycle's own commits —
while the phase's success criterion is written against `a6b8931` and asks that
no row cite a line that has moved at all. Where the two disagree the criterion
wins. D-08's saving survives whole: the same eight files are byte-identical
under either baseline, which is what makes the wider scope cost nothing in
re-read surface it could have skipped.

**No ledgered `doc` sits outside run 2's reach.** Invocation 5 and the targeted
`.mjs` pass exist precisely to close the 42 rows across six files that the first
four invocations could not reach, so no row carries a run-1 verdict merely
because nothing looked at its file. Where a row still reads `1` in the `run`
column it is because run 2's fresh extraction produced no claim with that text
for that doc — see `## Reading this ledger`.

## Reading this ledger

**The `run` column is the run that last VERDICTED the row**, and it is
generated by the join rather than typed. It is a run number and not a date cell
because runs, not dates, are what this ledger compares; and it is a column and
not a run-scoped section because a section split dates only NEW claims, which
would have left the 548 rows already here carrying no this-cycle verdict at all.
A third cycle adds a `3` and needs no schema change (phase 5 D-02).

**A `1` is a signal, not a coverage hole.** Every `doc` in both tables was
inside run 2's surface — that is what invocation 5 and the targeted `.mjs` pass
above exist for — so a row reading `1` means run 2's fresh extraction produced
no claim matching that row's TEXT for that doc: the claim was dropped from the
doc, reworded past the join, or is one this cycle re-pinned or re-verdicted by
hand. 190 of the 933 rows read `1` and all 190 predate run 2 - every row run 2
filed reads `2` - so it is 190 of the 548 rows that were here when run 2 ran,
concentrated in the two documents run 2 extracted least like run 1 did
(`METHOD.md` 41 of its 82 pre-run-2 rows, `README.md` 20 of its 51).
The join is `doc` plus claim text, never the id, for the reason stated below.

**A row resolved `corrected - <sha>` is a closed finding and never joins.** Its
claim text is what run 1 read BEFORE the fix, so a run-2 claim that looks like
it is the corrected sentence rather than this claim; joining the two would
overwrite a recorded correction with a verdict about different words. 20 of the
42 rows whose resolution begins `corrected` are in that class: they keep run 1's
verdict, their `corrected - <sha>` resolution, and their run-1 line, which is
provenance rather than an address. Eight more are README-44, whose claim
TEXT was itself rewritten to the corrected sentence (see below) so it joins like
any other row, and the seven phase 5 rewrote to the live `trace close` call. The
remaining fourteen are phase 5's own source fixes, a third shape described
below: a run-2 `stale` verdict, pre-fix claim text, and a cite that became
provenance the moment the fix landed.

**`divergence` is a RESOLUTION value here, and deliberately not a fourth
verdict.** `docs-verify.md`'s classification vocabulary is exactly
`accurate | stale | unverifiable` and stays that way (D-05). A divergence is a
stale claim knowingly left standing, which is a property of what was decided
about the reading rather than of the reading itself; adding it to the workflow's
vocabulary would re-emit it for every other project that runs the command and
would cost a budget regeneration on a file with zero slack.

**The ids are POSITIONAL.** An id is the doc's basename uppercased plus a
two-digit ordinal in run-1 report order (`README-01`, `CONTRIBUTING-03`,
`PLAN-02` for `cadence-core/workflows/plan.md`). That makes them stable within
this run and NOT across runs: one claim added or dropped shifts every id below it
in that doc, so next cycle's `README-02` need not be this cycle's.

**The join rule that follows from it:** the next cycle's diff matches rows on
`doc` plus claim TEXT, and carries an id forward only where that text matches. A
diff joined on the id alone would report a resolved claim as regressed and a
newly drifted one as already corrected.

**As of run 2 the `line` column is the LIVE location** for every row whose `doc`
changed since `a6b8931` - 23 of the 31 docs the ledger cited then, 493 rows, of
which 261 cells moved. 206 came from the run-2 report's own location cell, 55
from a per-row read of the live file, and the rest were confirmed to still hold
their claim. Three classes are deliberately NOT live: a row resolved
`corrected - <sha>`, whose claim text predates the fix and whose cite is
provenance; a row resolved `divergence - ... line left at run-1 provenance`,
whose claim was dropped from the doc outright so there is no live line to move
it to (CONTEXT-06, CONTEXT-07, PLAN-12, VERIFY-DEEP-01, VERIFY-DEEP-02); and the
55 rows on the eight workflow files byte-identical to run 1,
which were not re-read because they cannot have moved. Those three classes are
the whole of it: outside them, opening a row's `doc` at its `line` shows its
claim. The paragraphs below are
the record of how the column got here and still describe how to read a cell that
is provenance.

**Before run 2 the `line` column was run 1's location**, read at `a6b8931`.
Phase 5 of `v2.6.1`'s own corrections moved some of them, by varying amounts and
in more than one file.
`METHOD.md` took three edits in `b2bad1a` - `+3` at `:91`, `+1` at `:276`, `+2`
at `:304`, 614 lines to 620 - so a `METHOD.md` row below `:91` sits 3, 4 or 6
lines lower than its cell says depending on how many of those it is below; and
`044806c` moved four workflow files (`audit.md` `+1`, `execute.md` `+2`,
`progress.md` `+1`, `task.md` `+2`). Do not apply a single offset. The column is
provenance, not an address to seek to, and the
join rule above is on `doc` plus claim text precisely so a line that moved
cannot break the diff. Phase 3 of `v2.6.2` went one step further and re-pointed
rows' `doc` cells at files that did not exist at run 1 - the ~29 CONFIG rows now
naming `cadence-core/references/config-catalog.md`, plus CONTEXT-05 / DEBUG-04
(`references/recall.md`) and PLAN-26 (`references/plan-revision.md`) - because
the prose those claims are about MOVED there whole. The join still reads: it
matches on `doc` plus claim text, both cells were updated together, and the
claim text is byte-identical to what run 1 read.

Phase 1 of `v3.1.0` re-pinned the ten `cadence-core/workflows/context.md` rows
to their locations in the LIVE file rather than at `a6b8931`, so those cells are
no longer run-1 provenance and are the only ones that are not. Four of them
(CONTEXT-03, CONTEXT-06, CONTEXT-07, CONTEXT-15) were already stale before that
phase opened; the rest moved because the phase inserted a coordinator-marker
preamble and a new `spend_gate` step above them. Left alone, the next sweep
would have reported a wave of `stale` verdicts produced by line SHIFTS rather
than by any claim changing, which is the signal this ledger exists to keep
readable. The join is unaffected - it is on `doc` plus claim text - and only
CONTEXT-03's TEXT changed, because that claim itself had become false
(`workflow.subagent_timeout` was deleted from the seam, so the call no longer
reads two keys).

Phase 2 of `v3.1.0` did the same for the `README.md` rows, for the same reason:
`/cad-adopt` added a second-door paragraph under `## The loop` and a bullet
under `## The commands`, so every claim below line 70 moved. All 19 affected
rows now name their LIVE location, joining CONTEXT's ten as cells that are no
longer run-1 provenance; the ten tail rows from README-41 on (README-47 excepted,
it cites the install block) were already off by one before this phase and are
re-pinned to the live file too. A second insert in the same phase - the
`--brief` sentence, two lines under the same `## The loop` heading - moved the
19 rows from README-32 down again, and they are re-pinned with it. The same
phase then did it for all 22
`cadence-core/workflows/new-project.md` rows, which `--brief` moved twice over -
once in the `setup` step where the flag is parsed and once in `questioning`
where what a brief settles stops being asked. Eight of those 22 were already
stale before the phase opened - NEW-PROJECT-15 through -22 cited lines their
claim's text had drifted off, by three to five lines - so every row is pinned to
where the live file states its claim rather than to its old cite plus this
phase's shift. No
`claim`, `verdict` or `resolution` cell changed - nothing here changes what any
claim says, and the join is still `doc` plus claim text.

Phase 3 of `v3.1.0` moved the `README.md` rows once more, and this time one
CLAIM changed with them. Two bullets were inserted into `## The commands` -
`/cad-minimalism-review` under **Review & quality** and `/cad-suggest` under
**Support**, the phase's two new commands - so every claim at or below the first
of them shifted by one line and everything below the second by two. The 13 rows
from README-38 down (README-47 excepted again, it cites the install block) are
re-pinned to where the live file states their claim: README-39's range widens to
`105-130` because the lists it covers grew by two rows. The exception is
README-44, whose claim TEXT had itself become false - the skill count read 23
against a measured 27, wrong by four rather than by this phase's two, since it
was already stale before the phase opened. Task 5 re-measured instead of
incrementing (`grep -L "user-invocable: false" skills/*/SKILL.md | wc -l` and
`ls agents/*.md | wc -l`), so the row's claim text is rewritten to the corrected
sentence and its `resolution` reads `corrected - fe9b9b9`. Its `verdict` is left
as run 1 recorded it, the way phase 2 left verdicts alone. That one rewrite is
called out here on purpose: the ledger's join is `doc` plus claim text, so a
silently rewritten claim would join to nothing in the next sweep and report as a
new extraction rather than as a fix. No row was added - the ledger holds run-1
provenance, and new claims (the two command bullets among them) are extracted by
the next `/cad-docs-verify` run.

Phase 4 of `v3.3.0` invalidated seven rows by their claim TEXT rather than by
their line, and phase 5 rewrote all seven rather than re-pinning them silently.
`4110fde` converted all eight dispatch-close sites from a `trace append` call
carrying an explicit return-or-checkpoint event flag to a single `trace close`
call that infers which one it is, so `PLAN-18`, `PLAN-19`, `CONTEXT-14`, `EXECUTE-17`,
`EXECUTE-18`, `VERIFY-DEEP-05` and `VERIFY-DEEP-12` each stated a spelling no
workflow makes any more. Each now carries a `stale` verdict, the claim its live
file states, a line re-pinned to that statement, and
`corrected - 4110fde - claim rewritten to the live `trace close` call` as its
resolution. This is called out here for the same reason README-44's rewrite is:
the join is `doc` plus claim text, so seven silently rewritten claims would join
to nothing next cycle and report as seven brand-new extractions where seven
fixes happened. The `stale` verdict is the finding and the resolution is the
fix, which is why run 2's `accurate` verdict on the rewritten text is NOT
imported over them.

Phase 5 of `v3.3.0` fixed fourteen rows' prose AT SOURCE, in its two gaps plans,
and closed the rows without rewriting one claim. `813f468`, `ee0199b`, `fdb2d69`
and `75b1d28` corrected the four budgeted plugin surfaces - `plan.md`'s review
step, the plan-check default in `new-project.md` and `adopt.md`, the empty
`**Risk**` catalog category, and `recall.md`'s caller count - and `39583ba`,
`ffb16a4`, `1b4086f` and `fa0d4b4` corrected the three narrative documents:
README's plan gate, METHOD's two plan-gate sentences and its staged-diff commit
check, and the retired risk floor in METHOD and INTERNALS. Twelve of the
fourteen were the rows run 2 had deferred as a divergence, with the fix left to
a later phase; the other two, METHOD-25 and NEW-PROJECT-08, were verdicted
`accurate` over the very sentences those edits removed, so they are re-verdicted
`stale` and closed alongside.

Those fourteen are a THIRD shape, neither of the two classes above: a run-2
`stale` verdict, the claim TEXT exactly as it was read BEFORE the fix, and a
`corrected - <sha>` resolution naming the commit. Their claim text is
deliberately NOT rewritten, which is this ledger's default for a `corrected`
row rather than the README-44 and `trace close` exception - so the fix lives in
the resolution, the `line` cell became provenance the moment its commit landed,
and next cycle's fresh extraction of the corrected sentence files its own row
instead of joining these. They are closed findings, and they never enter the
next cycle's diff.

Phase 2 of `v3.5.3` settled SEVENTEEN rows on 2026-08-16, and it is the first
pass where the two failure modes arrived together: rows whose LINE moved and
rows whose CLAIM became incomplete on the same commits.

Eight of them enumerate the live `trace close` flag list, and `b118576` - which
put `--turns <the tool-call count on the subagent return>` on all ten close
sites - made every one of them state a flag list the workflows no longer write:
`CONTEXT-14`, `PLAN-18`, `EXECUTE-17`, `VERIFY-DEEP-05`, `MINIMALISM-REVIEW-11`,
`DECISION-REVIEW-14`, `PLAN-REVISION-05` and `PLAN-REVISION-10`. Each now names
`--turns` beside the flags it already listed, and four of them also stop naming
the inline `--detail "<what failed>"` that `v3.5.2`'s text-transport work
replaced with `--detail-file <path>` - a claim rewritten to a half-live flag
list would be a new false row, not a fix. Their resolution reads
`corrected - b118576`. Their `verdict` cells are left exactly as run 1 recorded
them, the way every earlier pass left them.

The other nine are D-13's: `REPORT-05`, `REPORT-10`, `REPORT-11`, `REPORT-12`,
`SUGGEST-07`, `SUGGEST-08`, `PROGRESS-15`, `PROGRESS-28` and `PROGRESS-29`.
`8e2ee9f` and `059493f` rewrote the spend prose in `report.md` and the `trace`
step in `progress.md`, so the `REPORT-*` and `PROGRESS-*` anchors all moved;
`SUGGEST-07` and `SUGGEST-08` did not move at all, because D-11 made the
`/cad-suggest` half a SEAM change and `suggest.md` is byte-identical - only
`SUGGEST-08`'s range is tightened from a leading blank line onto the three lines
that state it. Every anchor is pinned to where the LIVE file states its claim
rather than to its old cite plus this phase's shift, since these anchors were
already drifting before the phase opened.

THREE claims were rewritten rather than re-pinned, and they are called out here
for the reason README-44's rewrite and the seven `trace close` rewrites were:
the join is `doc` plus claim text, so a silently rewritten claim joins to
nothing in the next sweep and reports as a brand-new extraction where a fix
happened.

- `PROGRESS-28` asserted that the record holds a single `corr`, which is FALSE
  and was already false when it was verdicted: `trace render --phase 1` on this repository
  returns 12 distinct `corr` ids spanning 2026-08-07 to 2026-08-16. The live
  sentence now says the counts span the events the phase filter admitted, and
  the row states that. `corrected - 059493f`.
- `REPORT-05` listed the keys the render carries, and it stopped matching the
  render the moment `38f5670` added `turns` to `brackets[]` and `turns` /
  `turns_unrecorded` to `roles`. The row now lists what the live `report.md`
  names. `corrected - 8e2ee9f`.
- `PROGRESS-15` is the same defect one file over - the `roles` block's carried
  figures - and is re-stated to the four the live block names.
  `corrected - 059493f`.

No row was added. This ledger holds run-1 provenance, and the claims this phase
CREATED - what the spend figure excludes, the gap terms, the named comparator,
the `--phase` scoping fact - are for the next `/cad-docs-verify` to extract.

Phase 3 of `v3.5.4` settled THREE rows on 2026-08-18, all three verdicted
`accurate` in run 2 over sentences RVW-03 then falsified: `INTERNALS-42`, which
counted `route-table.json`'s grids at three when the file already carried four
and now carries five, and `CONFIG-CATALOG-09` / `CONFIG-CATALOG-10`, whose
Default cells asserted the fixed `flagship`/`high` values the requirement moved
onto the unset sentinel. Each is re-verdicted `stale` and closed the way the
fourteen before them were - claim text left exactly as the sweep read it, the
fix in the resolution cell.

Their resolutions name `RVW-03 (v3.5.4)` where the rows above name a sha, for
the reason `CONFIG-CATALOG-08` already names `v3.4.1 phase 1`: the commit that
corrects a row is the commit that WRITES the row, so a self-referential sha is
unknowable while the cell is being typed. The requirement id and the milestone
locate the change exactly as well and can be written down honestly.

REL-01 settled a FOURTH row in the same phase, the same way: `MILESTONE-01`,
verdicted `accurate` over an up-front read naming two config keys, where the
close now names one - the release-mode half of that pair stopped being read at
all when step 2 moved onto a confirmed version plus a bounded tags probe. Its
resolution names `REL-01 (v3.5.4)` for the reason just given.

`CONFIG-26` was re-read beside it and is deliberately LEFT `accurate`. Its claim
is the catalog's DEFAULT column - `git.create_tag` true, `git.on_land_cleanup`
true, `git.auto_close` false - and REL-01 rewrote that key's Purpose cell while
its default and its two neighbours are untouched. Re-verdicting it would file a
correction over a sentence that is still true.

The seven `MILESTONE-*` rows BELOW the rewritten step are not re-pinned: their
claims are unchanged and their anchors were already drifting before this phase,
so the next sweep's fresh extraction is what re-seats them, exactly as it does
for every other row this ledger has not settled.

Phase 5 of `v3.5.5` moved two of `README.md`'s sections into `docs/` and cut a
third, so the `README-*` rows split three ways and every surviving pin was
re-derived from the post-change files rather than shifted. Eight rows follow the
worked example to `docs/EXAMPLE.md` (README-35, -36, -37, -38, -73, -74, -75,
-85) and eight follow the cost-to-run section to `docs/COST.md` (README-41, -48,
-49, -51, -79, -80, -81, -82); their `doc` and `line` cells changed together and
their claim text is untouched, so the join still holds. Nine RETIRE, because
their sentence was cut rather than moved: the six command-list rows README-39,
-40, -76, -77, -78 and -86 went with `## The commands`, which was CUT rather than
relocated (D-03); README-50's `8,550 bytes to 5,397` clause was cut rather than
re-measured (D-10); and README-53 and README-55 were cut when `## How it works`
was compressed to its argument, the DeepSeek-adapter sentence and the routing
parenthetical respectively. Those last two are not on the phase plan's
retirement list - they are the compression's own cost, recorded here rather than
left to the next sweep to report as claims that vanished.

Two rows straddled the cut, each citing one line that moved and one that was cut.
README-38's `/cad-land` publish claim was stated twice, in the worked example and
in the `## The commands` bullet; the worked-example half survives, so the row
re-points to `docs/EXAMPLE.md` with its text unchanged. README-75 was not so
lucky: `## The commands` carried the half saying the tag is cut by `/cad-land`
after the merge, and the landing page no longer states that anywhere, so the
row's claim TEXT is rewritten to the half that survives. That rewrite is called
out here for the same reason README-44's was - the join is `doc` plus claim text,
so a silently rewritten claim joins to nothing in the next sweep.

Four rows are deliberately NOT re-pinned. README-01, README-02 and README-25
carry a `corrected - <sha>` resolution and README-28 says in its own resolution
that its line is run-1 provenance, and this ledger's rule is that such a line is
provenance rather than an address. README-49 is the one `corrected - <sha>` row
that does move, because its section left `README.md` entirely: a `doc` cell
naming a file that no longer carries anything like the sentence is worse than
losing the run-1 line, which was `README.md:140`.

Every other row is pinned to where the post-change file states its claim rather
than shifted by a constant. A blanket shift would have been wrong in both
directions: commit `c99b778` inserted two lines for the test badge on 2026-08-17,
so rows pinned before that date were stale by two, while rows written after it -
README-74 among them, already citing the correct line - were not, and shifting
those would have broken rows that were right.

Three claims the compression would otherwise have dropped were restored to
`README.md` rather than retired, because the sentence carrying each one survived
and only a detail inside it did not: README-05's `four-line` state cursor,
README-11 and README-52's attribution of the 2,251 deleted lines to v2.2.0, and
README-16's multi-select triage prompt. Retiring a row whose sentence is still on
the page would have recorded a cut that never happened.

**Resolution values.** Measured over all 933 rows, every cell is one of four
forms: `accurate` on every row the sweep confirmed (837);
`corrected - <sha>` on a stale or unverifiable row whose prose was edited, naming
the commit that edited it (42); `divergence - <reason>` on one deliberately left
standing (44); and `RETIRED - <reason>` on a row whose claimed SENTENCE was cut
rather than corrected, so there is nothing left to re-verify (10 - PLAN-03 plus the
nine `README-*` rows phase 5 of `v3.5.5` retired - each with its `line` cell
reading `—` for the same reason). `pending` is a transient placeholder
used only while a phase is executing, so that no cell is ever empty; zero rows
read `pending` at the close. A row whose claim turned out to describe a code
defect rather than stale prose carries the defect's `DFC-0k` id in its
resolution.

## Defects filed out of this sweep

Run 1 found no claim describing a code defect: all 18 stale rows are stale
PROSE, with the code correct in every one of them. So no ledger row carries a
`divergence - code defect` resolution. Three ids were nonetheless filed under
`## Deferred` in `.planning/REQUIREMENTS.md`, because each names something real
that a correction inside this surface would otherwise bury (DOC-03). All three
are now CLOSED at their source in phase 1 of `v2.6.1`, each landing with a check
that fails against the unpatched tree:

- **DFC-01** — `cadence-core/bin/lib/trace.mjs:336` carried two literal NUL
  bytes, so every `grep`/`rg` over `cadence-core/bin/**` skipped that file
  without `-a`. A genuine code defect, named in advance by the plan and filed
  whether or not the sweep surfaced it. It did not: the file is outside the
  surface. CLOSED `1e949bc` — both bytes are the two-character `\0` escape,
  behaviour identical, and `self-verify` check 15 reports
  `nul-byte-in-source` for a literal U+0000 in ANY file under
  `cadence-core/bin/**`, tests included.
- **DFC-02** — `cadence-core/references/review-triggers.md:244` (and
  `docs/WORKFLOW.md:168`) stated `phase_diff` as `off / off / adjudicated`
  against a live `off / advisory / adjudicated`. Both files are outside this
  surface, and that row is the shared source of the four stale rows `METHOD-01`,
  `METHOD-02`, `EXECUTE-02` and `EXECUTE-03`. Those four were corrected here;
  the source they were copied from was filed, not widened into scope.
  CLOSED `98be3d2` — both cells now read `off / advisory / adjudicated`, and
  `prose-agreement.test.mjs` asserts each against what
  `route.mjs resolve --role cad-reviewer` returns per stakes level.
- **DFC-03** — `skills/cad-plan-checker-contract/SKILL.md:113` said "All
  five dimensions checked" while `:42` of the same file said six. Same fact as
  `METHOD-03`, one file over and outside this surface. CLOSED `f6eed02` — the
  criterion reads six, and `prose-agreement.test.mjs` fails when the declared
  count, the claimed count and the enumerated items disagree.

Where a row's correction has a filing behind it, the row's resolution names the
id: `corrected - <sha> + DFC-0k`. The suffix is the row's only link to its
filing, so a future diff can tell a corrected copy from a fixed source. It
carries the filing's status too — `DFC-0k closed <sha>` once the source is
fixed, which is what makes that link answer the only question it is asked.

## Claims

| id | doc | line | claim | verdict | resolution | run |
|---|---|---|---|---|---|---|
| README-01 | README.md | 36 | An OpenAI, Gemini **or DeepSeek** key runs the identical review job "with the provider enforcing the output schema". | stale | corrected - b2bad1a | 1 |
| README-02 | README.md | 38 | `docs/WORKFLOW.md` is "six figures and the three tables behind them". | stale | corrected - b2bad1a | 1 |
| README-03 | README.md | 14-15 | Install adds marketplace `https://git.jcrenshaw.dev/crenshawdev/cadence.git` then `/plugin install cadence@cadence`. | accurate | accurate | 2 |
| README-04 | README.md | 18 | Prerequisites are Claude Code with plugin support plus `node`, `git` and one forge CLI (`tea`, `gh` or `glab`) on PATH; those are HOST prerequisites and the runtime scripts are still zero-dependency, "there is no npm install, ever". | accurate | amended - v3.7.1 phase 1 (FRG-02) makes a forge a precondition rather than an option, so the sentence names a forge CLI; the zero-dependency claim is unchanged and still true | 2 |
| README-05 | README.md | 30 | All durable state lives in `.planning/` and git, incl. a four-line state cursor. | accurate | accurate | 1 |
| README-06 | README.md | 67 | Verifier scores every claim verified/failed/uncertain and uncertain counts toward neither side. | accurate | accurate | 1 |
| README-07 | README.md | 67 | The coverage audit reads assertions rather than counting test files. | accurate | accurate | 1 |
| README-08 | README.md | 69 | The git rails are a PreToolUse hook and every push stops and asks. | accurate | accurate | 2 |
| README-09 | README.md | 71 | `isPlainPush` was deleted; the sanctioned push runs in a separate subprocess built from an argument vector. | accurate | accurate | 2 |
| README-10 | README.md | 3 | What the guard reads now is eighty-five lines; a command counts if it starts with the word `git`. | accurate | accurate | 2 |
| README-11 | README.md | 71 | v2.2.0 deleted 2,251 lines of tokenizer. | accurate | accurate | 1 |
| README-12 | README.md | 71 | The hook fails open. | accurate | accurate | 1 |
| README-13 | README.md | 71 | `bash -c "git push"` is invisible and that is written down. | accurate | accurate | 2 |
| README-14 | README.md | 57 | Default reviewer is a fresh-context Claude subagent needing no API key. | accurate | accurate | 2 |
| README-15 | README.md | 57 | Up to four independent voices on one plan. | accurate | accurate | 2 |
| README-16 | README.md | 57 | Triage is a multi-select prompt with none as the default. | accurate | accurate | 2 |
| README-17 | README.md | 80 | `/cad-config stakes=shipped` is the one key. | accurate | accurate | 2 |
| README-18 | README.md | 83 | `solo` / `shipped` / `critical` are the three answers. | accurate | accurate | 1 |
| README-19 | README.md | 85 | The grid is 18 cells, one per level+role pair, in `cadence-core/route-table.json`. | accurate | accurate | 2 |
| README-20 | README.md | 85 | solo planner = Sonnet at `high`; shipped = Opus; critical = Opus `xhigh` with retry `max`. | accurate | accurate | 2 |
| README-21 | README.md | 87 | Rungs are `low`, `medium`, `high`, `xhigh`, `max`. | accurate | accurate | 2 |
| README-22 | README.md | 87 | Effort is frozen in agent frontmatter; self-verify fails on a cell naming a rung with no file and on a rung file no cell reaches. | accurate | accurate | 2 |
| README-23 | README.md | 89 | `model.escalate_on_failure`, on by default. | accurate | accurate | 1 |
| README-24 | README.md | 93-98 | Gates are `off`, `advisory`, `blocking`, `adjudicated`. | accurate | accurate | 2 |
| README-25 | README.md | 56 | Plan review is advisory at `solo`, adjudicated at `shipped` and `critical`. | stale | corrected - 39583ba - `README.md:56` now reads advisory at `solo`, off at `shipped`, adjudicated at `critical` | 2 |
| README-26 | README.md | 93-100 | `risk_surface` is blocking at every level including `solo`. | accurate | accurate | 2 |
| README-27 | README.md | 100 | The eight surfaces are auth, billing, secrets, migrations, destructive, concurrency, API contracts, untrusted input. | accurate | accurate | 2 |
| README-28 | README.md | 58 | `risk.override.<surface>` waives one surface, repo config only; a global waiver is ignored and warned. | stale | divergence - run 2 half A: claim stated nowhere in the file, the `risk.override` family was retired in v2.7.0; line left at run-1 provenance | 1 |
| README-29 | README.md | 83 | Deep verification off at `solo`, on at `shipped` and `critical`. | accurate | accurate | 2 |
| README-30 | README.md | 22 | Commands are namespaced `/cadence:cad-*`. | accurate | accurate | 2 |
| README-31 | README.md | 24 | The five loop commands exist as named. | accurate | accurate | 2 |
| README-32 | README.md | 34 | `/cad-progress` auto-resumes incomplete work. | accurate | accurate | 2 |
| README-33 | README.md | 36 | `docs/figures/phase-loop.svg` exists. | accurate | accurate | 2 |
| README-34 | README.md | — | WORKFLOW.md holds fifteen decision points, the eighteen-cell grid, and the trigger-by-level table. | accurate | RETIRED - the docs/WORKFLOW.md inventory paragraph was cut in the controls rewrite | 2 |
| README-35 | docs/EXAMPLE.md | 5-9 | `/cad-new-project` writes PROJECT.md, REQUIREMENTS.md and a phased ROADMAP.md into `.planning/` and sets a cursor. | accurate | accurate | 1 |
| README-36 | docs/EXAMPLE.md | 17 | `/cad-verify` records in UAT.md. | accurate | accurate | 1 |
| README-37 | docs/EXAMPLE.md | 32-34 | `/cad-milestone` tags the release. | accurate | accurate | 1 |
| README-38 | docs/EXAMPLE.md | 40-42 | `/cad-land` asks push / MR or PR / tag / leave local with no preselected default. | accurate | accurate | 2 |
| README-39 | README.md | — | Every command in the three command lists exists. | accurate | RETIRED - `## The commands` was CUT in v3.5.5 (phase 5, RME-01) rather than relocated; the three command lists this row counted no longer exist and `cadence-core/references/COMMANDS.md` publishes all 27 commands instead | 1 |
| README-40 | README.md | — | `/cad-config` walks every switch; `key=value` sets one directly. | accurate | RETIRED - the `/cad-config` bullet was cut with `## The commands` in v3.5.5 (phase 5, RME-01); `cadence-core/references/COMMANDS.md` carries the entry | 1 |
| README-41 | docs/COST.md | 13-15 | Cadence ships no instrumentation and phones nothing home. | accurate | accurate | 2 |
| README-42 | README.md | 112 | GSD is 71 skills, 34 agents, 46 capabilities, ~1.1M words. | unverifiable | divergence - run 2 half A: a measurement of an external tree this repo does not carry | 2 |
| README-43 | README.md | 112 | Cadence carries ~3% of GSD's documentary mass, measured 2026-07-10 against GSD `d010ea1`. | accurate | accurate | 1 |
| README-44 | README.md | 112 | Today it is 27 skills and 6 agent roles across 19 rung files. | accurate | corrected - fe9b9b9 | 2 |
| README-45 | README.md | 114 | CI fails the build when the prose drifts from the code. | accurate | accurate | 2 |
| README-46 | README.md | 116 | MIT, original copyright in `LICENSE`, lineage in `NOTICE.md`. | accurate | accurate | 2 |
| README-47 | README.md | 14 | The marketplace URL actually serves a plugin marketplace. | unverifiable | divergence - the URL resolves only over the network; `plugin.json`s homepage and the `origin` remote both name that host, and nothing in the tree can settle what it serves | 1 |
| README-48 | docs/COST.md | 13-20 | Usage measurements: 7,548 requests / 2,845 Cadence, ~92k vs ~133k context, ~28c vs ~36c, 27% vs 8% Sonnet+Haiku. | unverifiable | divergence - personal account billing data, external to the repository; the paragraph already states it compares two piles of the authors own sessions rather than a controlled experiment | 1 |
| README-49 | docs/COST.md | 33-36 | v2.3.0 eager totals 231,422 -> 199,687 across "the twelve main commands"; `/cad-pause` 18,523 -> 8,197; `/cad-land` 36,235 -> 31,016. | unverifiable | corrected - 1154790 | 1 |
| README-50 | README.md | — | Skill and agent descriptions went from 8,550 to 5,397 bytes. | unverifiable | RETIRED - the `8,550 bytes to 5,397` clause was cut rather than re-measured when the section moved to `docs/COST.md` in v3.5.5 (phase 5, RME-01) (D-10); the live figure is 6,034 B across 52 skill and agent frontmatter blocks, and the page points at `weight.mjs resident` in its place | 2 |
| README-51 | docs/COST.md | 55-58 | Five of the twelve commands ended up slightly heavier. | unverifiable | divergence - an explicitly historical note about the v2.3.0 change, recorded in that phases record; the preceding paragraph now frames the whole v2.3.0 account as a measurement taken then | 1 |
| METHOD-01 | METHOD.md | 276 | `phase_diff`'s gate at `shipped` is "off (opt-in)". | stale | corrected - b2bad1a + DFC-02 closed 98be3d2 | 1 |
| METHOD-02 | METHOD.md | 279 | "Four of the five fire on their own; `phase_diff` ships off." | stale | corrected - b2bad1a + DFC-02 closed 98be3d2 | 1 |
| METHOD-03 | METHOD.md | 91 | The plan checker "checks five dimensions - requirement coverage, task completeness, sequencing, goal-backward truths, and scope sanity". | stale | corrected - b2bad1a + DFC-03 closed f6eed02 | 1 |
| METHOD-04 | METHOD.md | 301-303 | "Configure an OpenAI, Gemini or DeepSeek key and the identical job runs as a direct API call with the provider enforcing the output schema." | stale | corrected - b2bad1a | 1 |
| METHOD-05 | METHOD.md | 20, 638 | `skills/cad-planner-contract/SKILL.md` is where planning lives. | accurate | accurate | 2 |
| METHOD-06 | METHOD.md | 24-31 | The planner follows the five-step goal-backward order (goal, truths, artifacts, wiring, tasks). | accurate | accurate | 1 |
| METHOD-07 | METHOD.md | 26-31 | 3 to 7 observable truths. | accurate | accurate | 2 |
| METHOD-08 | METHOD.md | 38-42 | Skeleton-first ordering; a working skeleton by commit 2 or 3. | accurate | accurate | 1 |
| METHOD-09 | METHOD.md | 44-46 | Read the actual files before writing tasks, each file once. | accurate | accurate | 1 |
| METHOD-10 | METHOD.md | 48-57 | Every task has exactly three fields: Files, Action, Verify, with the stated rules. | accurate | accurate | 2 |
| METHOD-11 | METHOD.md | 60 | Atomic; a task touching more than ~5 files is usually two tasks. | unverifiable | divergence - run 2 half A: a prose nudge with no seam behind it | 2 |
| METHOD-12 | METHOD.md | 60-62 | A tool the environment lacks makes Verify a `human-verify` instruction. | accurate | accurate | 1 |
| METHOD-13 | METHOD.md | 69-74 | The prohibited scope words and the three `## PHASE TOO BIG` reasons. | accurate | accurate | 2 |
| METHOD-14 | METHOD.md | 74-79 | Six decomposition axes (trigger, size, lifecycle, failure-resume, freshness, ownership), a nudge not a rule. | accurate | accurate | 1 |
| METHOD-15 | METHOD.md | 86 | Plan check is on by default via `workflow.plan_check`. | accurate | accurate | 2 |
| METHOD-16 | METHOD.md | 85-88 | The checker derives must-be-trues before it is allowed to open the plan. | accurate | accurate | 1 |
| METHOD-17 | METHOD.md | 98-100 | Truth with no task = BLOCKER; task no truth needs = WARNING; findings without severity are invalid. | accurate | accurate | 1 |
| METHOD-18 | METHOD.md | 106 | `skills/cad-executor-contract/SKILL.md`. | accurate | accurate | 1 |
| METHOD-19 | METHOD.md | 108 | For each task: implement, verify, commit. | accurate | accurate | 1 |
| METHOD-20 | METHOD.md | 111-115 | State the expected output before running Verify; a surprise result is recorded as `[deviation] expected X, observed Y`. | accurate | accurate | 2 |
| METHOD-21 | METHOD.md | 117-119 | Generalized from Karpathy's recipe; there is no switch for it. | accurate | accurate | 2 |
| METHOD-22 | METHOD.md | 117-127 | Trivial vs structural deviation buckets; unsure means structural. | accurate | accurate | 1 |
| METHOD-23 | METHOD.md | 143-145 | Circuit breaker is three fix attempts per task. | accurate | accurate | 2 |
| METHOD-24 | METHOD.md | 147-152 | A failed package install is never auto-fixed and is the one deviation class with no inline path. | accurate | accurate | 2 |
| METHOD-25 | METHOD.md | 156-157 | Commit protocol: individual staging, never `git add -A`/`.`, risk check on the staged diff, `{type}({scope}): {description}`, post-commit glance. | stale | corrected - 1b4086f - the same removal - the protocol no longer asks for a risk check, and the rest of this claim still holds | 2 |
| METHOD-26 | METHOD.md | 160-162 | Executors never push, force-push, write STATE/ROADMAP/SUMMARY, or spawn a reviewer. | accurate | accurate | 2 |
| METHOD-27 | METHOD.md | 166 | `cadence-core/workflows/execute.md`. | accurate | accurate | 1 |
| METHOD-28 | METHOD.md | 168-173 | The seam intersects declared file lists pairwise; overlap forces sequential; a plan declaring no files forces sequential; a check that could not run forces it too. | accurate | accurate | 2 |
| METHOD-29 | METHOD.md | 175-179 | `phase_diff` is parallel-path only. | accurate | accurate | 2 |
| METHOD-30 | METHOD.md | 183-186 | Worktree safety: branch check before every commit, halt on mismatch; `git stash`, `git clean`, blanket `reset --hard`, `restore .` forbidden. | accurate | accurate | 2 |
| METHOD-31 | METHOD.md | 192 | `skills/cad-verifier-contract/SKILL.md`. | accurate | accurate | 1 |
| METHOD-32 | METHOD.md | 198-206 | Four levels: Exists, Substantive, Wired, Behaves. | accurate | accurate | 2 |
| METHOD-33 | METHOD.md | 209-211 | VERIFIED / FAILED / UNCERTAIN, with UNCERTAIN counting toward neither side. | accurate | accurate | 2 |
| METHOD-34 | METHOD.md | 215-218 | SUMMARY.md is treated as claims to falsify; the goal check in `execute.md` requires a `file:line` or command output. | accurate | accurate | 2 |
| METHOD-35 | METHOD.md | 222 | The four "how verifiers go soft" items. | accurate | accurate | 1 |
| METHOD-36 | METHOD.md | 229-235 | Anti-pattern scan list, the goal-path clause, and the `CADENCE-DEBT` exemption via required ceiling + trigger. | accurate | accurate | 1 |
| METHOD-37 | METHOD.md | 239-242 | Spot-checks: 2-4, ~10s each, no servers/state/network; `cargo test -- --list`, `pytest --collect-only -q`; at most one full-suite run. | accurate | accurate | 2 |
| METHOD-38 | METHOD.md | 248, 645 | `cadence-core/workflows/coverage.md`. | accurate | accurate | 2 |
| METHOD-39 | METHOD.md | 250-252 | The Covered definition quoted verbatim. | accurate | accurate | 1 |
| METHOD-40 | METHOD.md | 256-259 | Reads assertions not file counts; prefers a RED check; test kind in the project's own framework. | accurate | accurate | 1 |
| METHOD-41 | METHOD.md | 262-265 | A heavy new dependency is flagged; the plan is approved first; a red test is never committed and goes to `/cad-debug`. | accurate | accurate | 1 |
| METHOD-42 | METHOD.md | 273 | `cadence-core/references/review-triggers.md`. | accurate | accurate | 1 |
| METHOD-43 | METHOD.md | 277-280 | One `fire(trigger)` procedure, no embedded reviewer loops; that rule lives in `references/conventions.md`. | accurate | accurate | 2 |
| METHOD-44 | METHOD.md | 286-289 | Trigger table rows for `plan`, `diff`, `risk_surface`, `phase_diff` (fired-by, when, gate at `shipped`). Re-stated v3.2.0: `pre_ship` was deleted and `plan`/`phase_diff` are `off` at `shipped`. | accurate | accurate | 2 |
| METHOD-45 | METHOD.md | 301-304 | Gate vocabulary (5) and `review.mode` vocabulary (`single`, `panel`, `adjudicated`). Re-stated v3.5.7: `deferred` added, the arm whose findings stop the LAND rather than the RUN. | accurate | accurate | 2 |
| METHOD-46 | METHOD.md | 310-313 | Gates resolve from `stakes`; `diff` is off/advisory/blocking across the three levels; `risk_surface` does not move; a typo loses to the level's gate and is named in warnings. | accurate | accurate | 1 |
| METHOD-47 | METHOD.md | 322 | The default reviewer is a fresh-context Claude subagent needing no key. | accurate | accurate | 1 |
| METHOD-48 | METHOD.md | 328-332 | The finding schema `{file, line, severity: blocker\|high\|medium\|low, claim, failure_scenario}`. | accurate | accurate | 2 |
| METHOD-49 | METHOD.md | 341-354 | `skills/cad-reviewer-contract/SKILL.md`. | accurate | accurate | 2 |
| METHOD-50 | METHOD.md | 343-351 | Reviewer stance: refute not bless, line + concrete failure, approach differences are not findings, no inflation or softening, empty result valid after a genuine attempt. | accurate | accurate | 1 |
| METHOD-51 | METHOD.md | 358-361 | Adjudication: all reviewers run independently, main session grounds and owns the verdict; convergence is the one strong signal. | accurate | accurate | 1 |
| METHOD-52 | METHOD.md | 367-371 | Survivors are a numbered list with none as the default; three gates ship that way; the auto_close pre-ship arm triages none and halts on blocker/high. | accurate | accurate | 1 |
| METHOD-53 | METHOD.md | 383-385 | `cadence-core/workflows/decision-review.md` never auto-fires. | accurate | accurate | 1 |
| METHOD-54 | METHOD.md | 383-397 | Rulings are `survives`, `partial`, `refuted`, and a `refuted` must state its grounding. | accurate | accurate | 2 |
| METHOD-55 | METHOD.md | 393-396 | Grounding is mandatory and typed: Context7 for library/API claims, the real repo for factual ones, one of each per run or an explicit statement of none. | accurate | accurate | 1 |
| METHOD-56 | METHOD.md | 399-401 | A clean pass retargets onto the decision's own load-bearing claims and is never reported as a bare "no findings". | accurate | accurate | 1 |
| METHOD-57 | METHOD.md | 404 | Cost is reported qualitatively, never as a token or dollar figure. | accurate | accurate | 1 |
| METHOD-58 | METHOD.md | 409-412 | The eight risk surfaces that fire the blocking trigger. | accurate | accurate | 1 |
| METHOD-59 | METHOD.md | 421-428 | Detection sets a floor that only ever raises; lowering takes a named `risk.override.<surface>` read from the repo config alone, a global one is ignored and named. | stale | corrected - fa0d4b4 - the paragraph now states detection sets no floor and names the v2.7.0 cut of the detector and the eight `risk.override.*` waivers; re-corrected - CER-01, v3.5.7 - the paragraph now states the plan-time floor that ships: `stakes` is a MINIMUM, the phase's own declared `files:` read at plan time raise it, an unreadable plan holds the configured level and never drops below it, and lowering below a computed raise takes the `review.triggers.risk_surface.waive_routing_floor` waiver, which lowers the routing level alone | 2 |
| METHOD-60 | METHOD.md | 429-434 | The pre-filter: a destructive op drops only when `git check-ignore` matches **and** `git ls-files` is empty; a secret drops only when template-shaped **and** a stub. | accurate | accurate | 2 |
| METHOD-61 | METHOD.md | 439-442 | The executor detects, stops and hands up; never reviews itself, never skips the gate. | accurate | accurate | 1 |
| METHOD-62 | METHOD.md | 447-463 | `references/consult.md` and its five rules, including `review.consult.attempt_threshold` and no local-subagent consult. | accurate | accurate | 2 |
| METHOD-63 | METHOD.md | 467-469 | The review -> revise -> review convergence loop was considered and cut. | accurate | accurate | 2 |
| METHOD-64 | METHOD.md | 479-482 | The "nothing silently passes" bullets (dropped reviewer names its reason, empty set falls back to the local subagent, pre-filter drop noted, etc.). | accurate | accurate | 1 |
| METHOD-65 | METHOD.md | 499-508 | `cadence-core/workflows/audit.md` and the six break codes `no-phase`, `no-plan`, `unpicked`, `phase-missing`, `not-verified`, `drift`, with `not-verified` expected mid-cycle. | accurate | accurate | 2 |
| METHOD-66 | METHOD.md | 510-512 | Plan frontmatter naming unknown requirement IDs is an orphan, weighed more lightly. | accurate | accurate | 2 |
| METHOD-67 | METHOD.md | 520-522 | `cadence-core/workflows/debug.md` and the four-step loop; 2 to 5 hypotheses, ranked most-likely-first, tested risk-first. | accurate | accurate | 1 |
| METHOD-68 | METHOD.md | 532-534 | `memory.backend: builtin` gates the hypothesize-step recall. | accurate | accurate | 2 |
| METHOD-69 | METHOD.md | 543-545 | `references/git-guard.md`; before the first commit the guard reads `git.protected_branches`, applies `git.on_protected`, and checks base integrity in the same pass. | accurate | accurate | 1 |
| METHOD-70 | METHOD.md | 548-551 | A command counts when its first word is `git` and the verb is the first non-flag word; `bash -c`, `$(...)`, `sudo git` are invisible; rail 3 lists what it misses. | accurate | accurate | 1 |
| METHOD-71 | METHOD.md | 557-561 | Two decisions are marked in `references/seams.md` as deliberately undefaulted: the publish mechanism and the protected-branch guard. | accurate | accurate | 2 |
| METHOD-72 | METHOD.md | 566-569 | Two tiers: an integration branch merged into per `git.auto_branch`, named by `git.integration_branch` (`milestone` default, `trunk` escape hatch); worktrees fork from the host's `worktree.baseRef`, required at `head`; `git.on_land_cleanup` returns to base, pulls, reaps. | accurate | accurate | 2 |
| METHOD-73 | METHOD.md | 571-577 | One conventional commit per task; publishing flows through a single sanctioned seam; `git.auto_close` runs audit through merge with no per-step prompts and halts on a surviving blocker/high `risk_surface` finding. Re-stated v3.2.0: the halt's producer moved off the deleted `pre_ship`. | accurate | accurate | 1 |
| METHOD-74 | METHOD.md | 585-588 | `references/conventions.md`; `STATE.md` is a four-line cursor, overwritten in place, seam is the only correct writer. | accurate | accurate | 2 |
| METHOD-75 | METHOD.md | 590 | No audit logs, activity tables or session narratives. | accurate | accurate | 1 |
| METHOD-76 | METHOD.md | 593-594 | Config is read only through the config seam, one call per key. | accurate | accurate | 2 |
| METHOD-77 | METHOD.md | 602-604 | `cadence-core/bin/self-verify.mjs` lints config keys, script invocations and file paths, and fails on agent prose reaching for an undeclared tool. | accurate | accurate | 2 |
| METHOD-78 | METHOD.md | 605-611 | The concurrency-phrasing check: a block claiming a concurrent set must issue it in one message, judged per issuing sentence, explanatory moods left alone. | accurate | accurate | 2 |
| METHOD-79 | METHOD.md | 613-619 | Five surface sets weighed against `cadence-core/bin/weight-budgets.json`: agents, SKILL.md, workflows, `references/`, `templates/`. | accurate | accurate | 2 |
| METHOD-80 | METHOD.md | 629 | `/cad-docs-verify` checks factual claims against the live codebase. | accurate | accurate | 1 |
| METHOD-81 | METHOD.md | 636-650 | Every path in the "Where each rule lives" table. | accurate | accurate | 2 |
| METHOD-82 | METHOD.md | 271 | "This is the largest subsystem and the one that most shapes the output quality." | unverifiable | divergence - a judgment about which subsystem most shapes output quality; no byte count settles it, and the subsystem spans several files | 1 |
| INTERNALS-01 | INTERNALS.md | 55 | "The API enforces the output shape (OpenAI `response_format`, Gemini `responseSchema`)." | stale | corrected - b2bad1a | 1 |
| INTERNALS-02 | INTERNALS.md | 11 | 19 files cover the six roles. | accurate | accurate | 2 |
| INTERNALS-03 | INTERNALS.md | 11 | `cad-plan-checker-medium` and `cad-plan-checker-high` are the same contract at two depths. | accurate | accurate | 1 |
| INTERNALS-04 | INTERNALS.md | 11 | `lib/rung-agent.mjs` states the rung->file map per role; the analyzer's unsuffixed file is its `xhigh` rung and `-high` is the lower one. | accurate | accurate | 2 |
| INTERNALS-05 | INTERNALS.md | 11 | CI refuses a rung a cell names with no file, and a rung file no cell reaches. | accurate | accurate | 2 |
| INTERNALS-06 | INTERNALS.md | 11 | CI refuses a rung file carrying any instruction of its own. | accurate | accurate | 2 |
| INTERNALS-07 | INTERNALS.md | 11 | CI refuses a rung file whose frontmatter effort is not the rung it is filed under. | accurate | accurate | 2 |
| INTERNALS-08 | INTERNALS.md | 13 | One key `stakes` with three answers; set with `/cad-config stakes=shipped`. | accurate | accurate | 2 |
| INTERNALS-09 | INTERNALS.md | 13 | A cell is model + start rung + retry rung + review gates + deep verify. | accurate | accurate | 2 |
| INTERNALS-10 | INTERNALS.md | 13 | The routed vocabulary is `sonnet` and `opus`; `haiku` and `fable` are reachable only by a `model.overrides` pin. | accurate | accurate | 2 |
| INTERNALS-11 | INTERNALS.md | 13 | An explicit pick wins; a config gate beats the level's only if it is one of the four values, else it loses and is named. | accurate | accurate | 2 |
| INTERNALS-12 | INTERNALS.md | 13 | `model.escalate_on_failure`, on by default; false holds the retry at its start rung. | accurate | accurate | 1 |
| INTERNALS-13 | INTERNALS.md | 13 | The risk floor only ever raises; lowering takes a named per-surface override; a project at `critical` is unaffected. | stale | corrected - fa0d4b4 - the floor clause inside `:13` rewritten to the v2.7.0 cut, every other clause of the line left standing; re-corrected - CER-01, v3.5.7 - the clause now states the answer is a FLOOR, not the last word: the phase's own declared files raise it, leaving `stakes` unset floors at `solo` only when the scope reads clean, an unreadable plan holds the configured level, and lowering below a raise takes the `review.triggers.risk_surface.waive_routing_floor` waiver | 2 |
| INTERNALS-14 | INTERNALS.md | 13 | CI refuses a retry rung that sits below the rung it started on. | accurate | accurate | 2 |
| INTERNALS-15 | INTERNALS.md | 15 | Routing governs dispatched subagents, not the main session. | accurate | accurate | 2 |
| INTERNALS-16 | INTERNALS.md | 17 | The five "read the code" pointers in the routing section. | accurate | accurate | 1 |
| INTERNALS-17 | INTERNALS.md | 21 | Every `git push` through Bash stops and asks; no exceptions. | accurate | accurate | 2 |
| INTERNALS-18 | INTERNALS.md | 23 | `auto_close` is an opt-in key. | accurate | accurate | 1 |
| INTERNALS-19 | INTERNALS.md | 27 | `git-publish.mjs` runs git with an argument vector, a `--` end-of-options separator, strict branch/remote validation, and refuses unless `auto_close` is on and HEAD is a non-protected branch. | accurate | accurate | 2 |
| INTERNALS-20 | INTERNALS.md | 37 | What replaced the tokenizer is `lib/git-segments.mjs`, eighty-five lines; a segment counts only when its command word is `git`, verb = first non-flag word. | accurate | accurate | 2 |
| INTERNALS-21 | INTERNALS.md | 37 | The invisible shapes are written down in `references/git-publish.md` rail 3, in the CHANGELOG, and as a pinned test row apiece. | accurate | accurate | 2 |
| INTERNALS-22 | INTERNALS.md | 39 | The six "read the code" pointers in the push-guard section. | accurate | accurate | 2 |
| INTERNALS-23 | INTERNALS.md | 45 | Detection intersects the live provider list with a shipped hint table; unknown ids fall through to manual placement rather than erroring. | accurate | accurate | 1 |
| INTERNALS-24 | INTERNALS.md | 49 | The three "read the code" pointers in the detection section. | accurate | accurate | 1 |
| INTERNALS-25 | INTERNALS.md | 55 | Gemini's schema enforcement is `responseSchema`. | accurate | accurate | 1 |
| INTERNALS-26 | INTERNALS.md | 61, 65 | Four pure decision cores - `close-decision`, `publish-decision`, `branch-decision`, `release-decision` - each with a unit test per branch. | accurate | accurate | 2 |
| INTERNALS-27 | INTERNALS.md | 71 | Eager bytes are the skill plus its `@`-includes; reachable is eager plus one hop. | accurate | accurate | 2 |
| INTERNALS-28 | INTERNALS.md | 75 | Dispatch weight is a third number that never sums with the other two (agent file plus preloaded contracts). | accurate | accurate | 2 |
| INTERNALS-29 | INTERNALS.md | 79 | `node cadence-core/bin/weight.mjs resident --root <repo root>` works. | accurate | accurate | 2 |
| INTERNALS-30 | INTERNALS.md | 81 | `lib/resident-weight.mjs` and `bin/weight.test.mjs` exist. | accurate | accurate | 2 |
| INTERNALS-31 | INTERNALS.md | 43,45 | "Cross-model review can call OpenAI or Gemini for a second opinion." | accurate | accurate | 1 |
| INTERNALS-32 | INTERNALS.md | 9 | The host's override resolution order is environment -> per-invocation parameter -> frontmatter -> session, and reasoning effort cannot be overridden. | unverifiable | divergence - Claude Code host behaviour, external to this repository; the design depends on it but nothing here can decide it | 1 |
| INTERNALS-33 | INTERNALS.md | 45-47 | Live detection actually returns what a key can reach, and a model-not-found mid-review offers re-detect. | unverifiable | divergence - requires a live provider key and network | 1 |
| INTERNALS-34 | INTERNALS.md | 31 | The six shapes v1.4.0 found silent (`git -C`, `&`, `$(...)`, backticks, subshell, escaped quote, `bash -c`). | accurate | accurate | 2 |
| INTERNALS-35 | INTERNALS.md | 35 | The old scan was O(KxN), 3.1GB at 224KB input, V8 abort at 280KB. | unverifiable | divergence - a measurement of code that no longer exists in the tree | 2 |
| INTERNALS-36 | INTERNALS.md | 37 | The 336KB input that aborted the old hook decides in milliseconds. | unverifiable | divergence - needs a benchmark run, not attempted in this sweep | 1 |
| INTERNALS-37 | INTERNALS.md | 73 | "Before I cut it, `/cad-land` was the heaviest in the plugin by eager bytes and the second lightest of the five I measured by reachable." | unverifiable | divergence - explicitly a pre-cut measurement over the five commands measured then; current figures are published in `docs/EVIDENCE.md` | 1 |
| CONTRIBUTING-01 | CONTRIBUTING.md | 13 | "Cadence has no build step and no dependencies. The scripts inside are zero-dependency Node, so there is no `npm install`." | stale | corrected - b2bad1a | 1 |
| CONTRIBUTING-02 | CONTRIBUTING.md | 13 | "The same three checks CI runs" - three checks, runnable locally. | accurate | accurate | 1 |
| CONTRIBUTING-03 | CONTRIBUTING.md | 16 | `node --test cadence-core/bin/*.test.mjs` - unit tests for the seam cores. | accurate | accurate | 2 |
| CONTRIBUTING-04 | CONTRIBUTING.md | 19 | `node cadence-core/bin/self-verify.mjs` - the prose<->code drift linter. | accurate | accurate | 2 |
| CONTRIBUTING-05 | CONTRIBUTING.md | 20 | `npx tsc -p tsconfig.ci.json` - honors the `@ts-check` pragmas. | stale | corrected - phase 4 UAT | 1 |
| CONTRIBUTING-06 | CONTRIBUTING.md | 13 | `node` and `git` on your PATH are what the three checks need. | accurate | accurate | 2 |
| CONTRIBUTING-07 | CONTRIBUTING.md | 23 | self-verify: every config key, script invocation and file path named in the workflows has to exist or the build fails. | accurate | accurate | 2 |
| CONTRIBUTING-08 | CONTRIBUTING.md | 23 | It weighs every agent file, every SKILL.md, every workflow, and every file under `cadence-core/references/` and `cadence-core/templates/`. | accurate | accurate | 2 |
| CONTRIBUTING-09 | CONTRIBUTING.md | 23 | It fails when one outgrows its byte budget. | accurate | accurate | 2 |
| CONTRIBUTING-10 | CONTRIBUTING.md | 23 | It fails when an agent's prose reaches for a tool its frontmatter never declared. | accurate | accurate | 2 |
| CONTRIBUTING-11 | CONTRIBUTING.md | 21 | "the build will run it for you either way." | accurate | accurate | 1 |
| CONTRIBUTING-12 | CONTRIBUTING.md | 9,29 | The MIT license, and contributions landing under it. | accurate | accurate | 1 |
| CONTRIBUTING-13 | CONTRIBUTING.md | 31 | Cadence is a derivative of GSD at `https://github.com/open-gsd/gsd-core`, spelled out in `NOTICE.md` and `LINEAGE.md`. | accurate | accurate | 2 |
| CONTRIBUTING-14 | CONTRIBUTING.md | 3 | `MANIFESTO.md` link. | accurate | accurate | 2 |
| CONTRIBUTING-15 | CONTRIBUTING.md | 5,7,9 | "Bug reports are welcome... doc fixes land fast"; the feature-PR policy. | unverifiable | divergence - maintainer intent, no code surface to check it against | 1 |
| CONTRIBUTING-16 | CONTRIBUTING.md | 21 | "The self-verify step is the one that catches most drift." | unverifiable | divergence - a relative-yield judgment across three checks; nothing measures it | 1 |
| CONTRIBUTING-17 | CONTRIBUTING.md | 25 | What a good bug report contains (Claude Code version, `node --version`, the relevant `.planning/` slice). | unverifiable | divergence - process guidance rather than a code claim; `.github/ISSUE_TEMPLATE/bug_report.md` exists but enforces no field | 1 |
| AUDIT-01 | cadence-core/workflows/audit.md | 31-34 | A digit-leading category like `2FA-01` is not admitted, so it appears in neither `unseeded` nor `counts` and is reported only in `active_issues`. | stale | corrected - 044806c | 1 |
| AUDIT-02 | cadence-core/workflows/audit.md | 136-140 | On an `active-non-id-bullet`, a span holding nothing but the id that is still reported means the id failed the admission test (a digit-leading category), and no rewrite will count it. | stale | corrected - 044806c | 1 |
| AUDIT-03 | cadence-core/workflows/audit.md | 18-22 | `planning.mjs audit` exists and returns one JSON line. | accurate | accurate | 2 |
| AUDIT-04 | cadence-core/workflows/audit.md | 23-24 | Break codes are `no-phase \| phase-missing \| no-plan \| not-verified \| drift \| unpicked`. | accurate | accurate | 2 |
| AUDIT-05 | cadence-core/workflows/audit.md | 25 | `orphans.plan_ids` holds plan frontmatter referencing unknown REQ-IDs. | accurate | accurate | 1 |
| AUDIT-06 | cadence-core/workflows/audit.md | 27-29 | `frontmatter_issues` exists; `references/plan-frontmatter.md` states the grammar. | accurate | accurate | 1 |
| AUDIT-07 | cadence-core/workflows/audit.md | 29-30 | `unseeded` names `## Active` ids with no Traceability row, each also carrying an `unpicked` break. | accurate | accurate | 1 |
| AUDIT-08 | cadence-core/workflows/audit.md | 35-36 | `active_issues` holds lines inside `## Active` outside the bullet grammar; `references/req-traceability.md` exists. | accurate | accurate | 1 |
| AUDIT-09 | cadence-core/workflows/audit.md | 36-37 | `nonconforming_plans` names a `PLAN*.md` no seam reads, e.g. `PLAN-gaps.md`. | accurate | accurate | 1 |
| AUDIT-10 | cadence-core/workflows/audit.md | 37-38 | `deferred` holds rows whose Status is `Deferred`. | accurate | accurate | 1 |
| AUDIT-11 | cadence-core/workflows/audit.md | 40-41 | `version_drift` is `{doc_version, published_as, cycle_state}` and is omitted when there is nothing to report. | accurate | accurate | 2 |
| AUDIT-12 | cadence-core/workflows/audit.md | 41-43 | `counts.total` is Traceability rows plus unpicked ids, so `total = traced + broken + deferred`. | accurate | accurate | 2 |
| AUDIT-13 | cadence-core/workflows/audit.md | 50-52 | `planning.mjs criteria-coverage` exists. | accurate | accurate | 2 |
| AUDIT-14 | cadence-core/workflows/audit.md | 53-56 | `version` (`{plugin, uat_fields}`) is the first key of the coverage envelope. | accurate | accurate | 2 |
| AUDIT-15 | cadence-core/workflows/audit.md | 56-57 | `phases` entries are `{phase, criteria, items}`. | accurate | accurate | 1 |
| AUDIT-16 | cadence-core/workflows/audit.md | 59-61 | `breaks` entries are `{phase, id, break:"uncovered"}` or `{phase, break:"fieldless-checklist", file}`. | accurate | accurate | 2 |
| AUDIT-17 | cadence-core/workflows/audit.md | 59-60 | `untraced` is an item with no `criterion` and no exempting `origin`. | accurate | accurate | 1 |
| AUDIT-18 | cadence-core/workflows/audit.md | 60 | `legacy` entries are `{phase, reason}` with the exemption's reason stated. | accurate | accurate | 1 |
| AUDIT-19 | cadence-core/workflows/audit.md | 63 | Coverage `counts` satisfies `criteria = covered + uncovered`. | accurate | accurate | 2 |
| AUDIT-20 | cadence-core/workflows/audit.md | 64 | `references/acceptance-criteria.md` holds the grammar and field semantics. | accurate | accurate | 2 |
| AUDIT-21 | cadence-core/workflows/audit.md | 66-69 | `milestone.md` step 3 prunes completed phases from ROADMAP `## Phases`, so `parseRoadmapPhases` only holds the current cycle. | accurate | accurate | 2 |
| AUDIT-22 | cadence-core/workflows/audit.md | 68-70 | An unchecked phase contributes its `uncovered` count but no `uncovered` or `missing-uat` break. | accurate | accurate | 1 |
| AUDIT-23 | cadence-core/workflows/audit.md | 71-73 | `fieldless-checklist` is not box-gated; `uat init` writes `fields_version` before it looks at an item. | accurate | accurate | 2 |
| AUDIT-24 | cadence-core/workflows/audit.md | 102 | Repair form `uat record --phase <N> --item <k> --result <...> --criterion AC<N>`; `--origin criterion` names no id. | accurate | accurate | 2 |
| AUDIT-25 | cadence-core/workflows/audit.md | 107-108 | `version_drift` is issue #87's failure mode: a cycle planned/branched under an already-tagged number. | accurate | accurate | 1 |
| AUDIT-26 | cadence-core/workflows/audit.md | 164-166 | A phase whose checklist holds only passes, skipped-with-reason and `blocked` items no longer holds the cycle open. | accurate | accurate | 1 |
| AUDIT-27 | cadence-core/workflows/audit.md | 168-169 | The test is membership in the tag list, not sort order. | accurate | accurate | 2 |
| AUDIT-28 | cadence-core/workflows/audit.md | 171-177 | `pluginVersion()` resolves relative to the SCRIPT, so the manifest is deliberately not the comparand. | accurate | accurate | 2 |
| AUDIT-29 | cadence-core/workflows/audit.md | 173-174 | `skills/cad-health/SKILL.md` already settled that tags are the publication evidence. | accurate | accurate | 1 |
| AUDIT-30 | cadence-core/workflows/audit.md | 183-190 | `legacy` exempts only on all five terms, the fifth being a CONTEXT declaring no `AC<N>` ids. | accurate | accurate | 1 |
| AUDIT-31 | cadence-core/workflows/audit.md | 194-196 | An absent UAT.md under a present CONTEXT breaks every declared criterion as `missing-uat` on a checked box. | accurate | accurate | 1 |
| AUDIT-32 | cadence-core/workflows/audit.md | 196-197 | `context_issues` can carry `criterion-duplicate-id` / `criterion-unidded`. | accurate | accurate | 1 |
| AUDIT-33 | cadence-core/workflows/audit.md | 198-201 | First-occurrence-wins on a duplicate id, so a second bullet reusing one is dropped from the coverage domain. | accurate | accurate | 1 |
| CONFIG-01 | cadence-core/workflows/config.md | 97 | `parallelization.enabled` default is `false`. | stale | corrected - 044806c | 1 |
| CONFIG-02 | cadence-core/references/config-catalog.md | 63-65 | The `review.triggers.<t>.{gate,tier,effort}` defaults are "per DESIGN section 7". | stale | corrected - 044806c | 1 |
| CONFIG-03 | cadence-core/workflows/config.md | 3-5 | Canonical shape lives in `cadence-core/config.schema.json`, enforced by `bin/config.mjs`. | accurate | accurate | 2 |
| CONFIG-04 | cadence-core/workflows/config.md | 5 | `cadence-core/templates/config.json` is the scaffolded default. | accurate | accurate | 2 |
| CONFIG-05 | cadence-core/workflows/config.md | 29 | `model.overrides` carries six role pins. | accurate | accurate | 1 |
| CONFIG-06 | cadence-core/workflows/config.md | 31 | `model.effort` carries six per-role start rungs. | accurate | accurate | 1 |
| CONFIG-07 | cadence-core/workflows/config.md | 32 | `review.decision_review` has two keys. | accurate | accurate | 1 |
| CONFIG-08 | cadence-core/workflows/config.md | 27-33 | The four edit-the-file-only sets have no catalog row. | accurate | accurate | 1 |
| CONFIG-09 | cadence-core/references/config-catalog.md | 20 | `granularity` enum `fine\|standard\|coarse`, default `standard`, split sizes 8-12 / 5-8 / 3-5. | accurate | accurate | 2 |
| CONFIG-10 | cadence-core/references/config-catalog.md | 22 | `stakes` enum `solo\|shipped\|critical`, default `shipped`. | accurate | accurate | 2 |
| CONFIG-11 | cadence-core/references/config-catalog.md | 23 | `model.escalate_on_failure` bool, default `true`. | accurate | accurate | 2 |
| CONFIG-12 | cadence-core/references/config-catalog.md | 25 | `workflow.research` bool, default `false`. | accurate | accurate | 2 |
| CONFIG-13 | cadence-core/references/config-catalog.md | 26 | `workflow.plan_check` bool, default `true`. | accurate | accurate | 2 |
| CONFIG-14 | cadence-core/references/config-catalog.md | 27 | `workflow.verifier` bool, default `true`; the stakes level decides and `--deep` forces. | accurate | accurate | 2 |
| CONFIG-15 | cadence-core/references/config-catalog.md | 28 | `workflow.skip_discuss` bool, default `false`. | accurate | accurate | 2 |
| CONFIG-16 | cadence-core/references/config-catalog.md | 28 | `workflow.subagent_timeout` int, default `300000`. | stale | divergence - run 2 half B invocation 5: `workflow.subagent_timeout` was retired in v2.7.0 and the catalog no longer carries it; line left at run-1 provenance | 1 |
| CONFIG-17 | cadence-core/references/config-catalog.md | 29 | `workflow.inline_plan_threshold` int, default `3`. | accurate | accurate | 2 |
| CONFIG-18 | cadence-core/references/config-catalog.md | 30 | `workflow.max_plan_tasks` int, default `8`; above it the plan must return `## PHASE TOO BIG`. | accurate | accurate | 2 |
| CONFIG-19 | cadence-core/references/config-catalog.md | 31 | `workflow.test_command` / `workflow.lint_command` are `str\|null`, default `null`; there is no typecheck key. | accurate | accurate | 2 |
| CONFIG-20 | cadence-core/references/config-catalog.md | 34-37 | `parallelization.max_concurrent_agents` 3, `min_plans_for_parallel` 2, `use_worktrees` true. | accurate | accurate | 2 |
| CONFIG-21 | cadence-core/references/config-catalog.md | 39 | `git.protected_branches` default `main, master`. | accurate | accurate | 2 |
| CONFIG-22 | cadence-core/references/config-catalog.md | 40 | `git.on_protected` enum `ask\|refuse\|allow`, default `ask`. | accurate | accurate | 2 |
| CONFIG-23 | cadence-core/references/config-catalog.md | 41 | `git.integration_branch` enum `milestone\|trunk`, default `milestone`. | accurate | accurate | 2 |
| CONFIG-24 | cadence-core/references/config-catalog.md | 42 | `git.auto_branch` enum `ask\|auto\|off`, default `ask`. | accurate | accurate | 2 |
| CONFIG-25 | cadence-core/references/config-catalog.md | 43 | `git.base_branch` `str\|null`, default `null`. | accurate | accurate | 2 |
| CONFIG-26 | cadence-core/references/config-catalog.md | 44-46 | `git.create_tag` true, `git.on_land_cleanup` true, `git.auto_close` false. | accurate | accurate | 2 |
| CONFIG-27 | cadence-core/references/config-catalog.md | 48 | `planning.commit_docs` bool, default `true`. | accurate | accurate | 2 |
| CONFIG-28 | cadence-core/references/config-catalog.md | 50 | `memory.backend` enum `builtin\|none`, default `builtin`. | accurate | accurate | 2 |
| CONFIG-29 | cadence-core/references/config-catalog.md | 52 | `risk.override.<surface>` covers exactly the eight named surfaces, default `false`, repo-scoped with a global waiver named in `warnings`. | stale | divergence - run 2 half B invocation 5: the `**Risk**` category now has zero rows and no `risk.override` key is documented; line left at run-1 provenance | 1 |
| CONFIG-30 | cadence-core/references/config-catalog.md | 52 | `review.reviewers` list(enum) of `claude-subagent\|openai\|gemini\|deepseek`, default `claude-subagent`. | accurate | accurate | 2 |
| CONFIG-31 | cadence-core/references/config-catalog.md | 53 | `review.mode` enum `single\|panel\|adjudicated`, default `adjudicated`. | accurate | accurate | 2 |
| CONFIG-32 | cadence-core/references/config-catalog.md | 54 | `review.key_file` `str\|null`, default `null`. | accurate | accurate | 2 |
| CONFIG-33 | cadence-core/references/config-catalog.md | 55 | `review.request_timeout_ms` default `540000`, clamped to a 600000 host ceiling. | accurate | accurate | 2 |
| CONFIG-34 | cadence-core/references/config-catalog.md | 56 | `review.max_prompt_tokens` default `120000`; over-cap refused before any request, cross-model only. | accurate | accurate | 2 |
| CONFIG-35 | cadence-core/references/config-catalog.md | 57-60 | `review.consult.{enabled,tier,effort,attempt_threshold}` = false / flagship / high / 3. | accurate | accurate | 2 |
| CONFIG-36 | cadence-core/references/config-catalog.md | 66-67 | Trigger set is `{plan, diff, risk_surface, phase_diff}`. Re-stated v3.2.0: `pre_ship` was deleted from the vocabulary. | accurate | accurate | 2 |
| CONFIG-37 | cadence-core/workflows/config.md | 85-88 | `config.mjs` subcommands are `validate \| check \| set \| get \| keys`. | accurate | accurate | 1 |
| CONFIG-38 | cadence-core/workflows/config.md | 97-100 | `--file <path>` overrides `.planning/config.json`; `--global` targets `~/.claude/cadence/config.json`, relocatable via `CADENCE_GLOBAL_CONFIG`, auto-created by `set`. | accurate | accurate | 2 |
| CONFIG-39 | cadence-core/workflows/config.md | 103-105 | `route.mjs` deep-merges global under repo (repo > global > defaults); nested objects merge, arrays replace wholesale. | accurate | accurate | 2 |
| CONFIG-40 | cadence-core/workflows/config.md | 111-113, 137-138 | A `worktree.baseRef=...` pair is rejected by the seam as an unknown key. | accurate | accurate | 2 |
| CONFIG-41 | cadence-core/workflows/config.md | 117-120 | `set` rejects unknown key / bad value / non-object top level / a dotted path through a non-object, atomically, and echoes `{ok:true, changed:[...]}`. | accurate | accurate | 1 |
| CONFIG-42 | cadence-core/workflows/config.md | 123-125 | A key retired by a release carries a `detail` naming the replacement. | accurate | accurate | 2 |
| CONFIG-43 | cadence-core/workflows/config.md | 129-133 | A `(root)` detail means the target file's top level is not a JSON object; `cannot set through "..."` means a container holds an array or scalar. | accurate | accurate | 2 |
| CONFIG-44 | cadence-core/workflows/config.md | 137-140 | `worktree.baseRef` is absent from `config.schema.json`, never goes through `config.mjs`, `"fresh"` is its default and `"head"` is the parallel-safe value. | accurate | accurate | 1 |
| CONFIG-45 | cadence-core/workflows/config.md | 154-160 | `worktree-base.mjs resolve` reports `parallelSafe` and the file the value came from. | accurate | accurate | 2 |
| CONFIG-46 | cadence-core/workflows/config.md | 180 | `workflows/config-review.md` holds the detect/classify/assign/write flow. | accurate | accurate | 1 |
| CONFIG-REVIEW-01 | cadence-core/workflows/config-review.md | 8 | `review.providers.<name>.tiers.{flagship,balanced,cheap}` are the target keys. | accurate | accurate | 2 |
| CONFIG-REVIEW-02 | cadence-core/workflows/config-review.md | 9 | DESIGN section 6 carries the three-layer detection decision. | accurate | accurate | 1 |
| CONFIG-REVIEW-03 | cadence-core/workflows/config-review.md | 20 | Providers under `review.providers` are openai, gemini, deepseek. | accurate | accurate | 2 |
| CONFIG-REVIEW-04 | cadence-core/workflows/config-review.md | 26-28 | `review-provider.mjs detect-models --provider <name> [--key-file <path>]`. | accurate | accurate | 2 |
| CONFIG-REVIEW-05 | cadence-core/workflows/config-review.md | 35-37 | `ok:false, reason:"no-key"` with a `detail` naming `$OPENAI_API_KEY` / `$GEMINI_API_KEY` or the providers.env path. | accurate | accurate | 2 |
| CONFIG-REVIEW-06 | cadence-core/workflows/config-review.md | 40 | `ok:false, reason:"transport"\|"http"`. | accurate | accurate | 2 |
| CONFIG-REVIEW-07 | cadence-core/workflows/config-review.md | 44-46 | `models[]` entries are `{id, tier, high_effort}` with `tier` = `flagship\|balanced\|cheap` or `null` for unknown ids. | accurate | accurate | 2 |
| CONFIG-REVIEW-08 | cadence-core/workflows/config-review.md | 72-76 | `config.mjs set 'review.providers.<name>.tiers.<pos>=<id>'` is the write path. | accurate | accurate | 2 |
| CONFIG-REVIEW-09 | cadence-core/workflows/config-review.md | 80-82 | Adding a provider to `review.reviewers` via `set 'review.reviewers=["claude-subagent","openai"]'` is what enrolls it. | accurate | accurate | 1 |
| CONFIG-REVIEW-10 | cadence-core/workflows/config-review.md | 78-80 | `claude-subagent` is the always-available fallback when a tier is `null`. | accurate | accurate | 2 |
| CONTEXT-01 | cadence-core/workflows/context.md | 19-21 | `planning.mjs cursor get` returns `no-cursor` when STATE.md is absent. | accurate | accurate | 2 |
| CONTEXT-02 | cadence-core/workflows/context.md | 12-13 | Output path `.planning/phases/{N}/CONTEXT.md`. | accurate | accurate | 2 |
| CONTEXT-03 | cadence-core/workflows/context.md | 84-87 | `config.mjs get memory.backend` reads the recall gate in one call. | accurate | accurate | 2 |
| CONTEXT-04 | cadence-core/workflows/context.md | 93 | `builtin` is the schema default for `memory.backend`. | accurate | accurate | 2 |
| CONTEXT-05 | cadence-core/references/recall.md | 18, 21, 28 | `planning.mjs recall "<terms>"` exists and returns `{ok, results:[{score, source, phase?, snippet}]}` with `phase` optional. | accurate | accurate | 1 |
| CONTEXT-06 | cadence-core/workflows/context.md | 163-165 | `trace append --phase --family lifecycle --event dispatch --plan --role --read "..."` - every flag exists. | stale | divergence - run 2 half B: `4110fde` left context.md with no `trace append` call; line left at run-1 provenance | 1 |
| CONTEXT-07 | cadence-core/workflows/context.md | 163-165 | `--family lifecycle` is a valid family. | stale | divergence - run 2 half B: `--family lifecycle` appears nowhere in context.md after `4110fde`; line left at run-1 provenance | 1 |
| CONTEXT-08 | cadence-core/workflows/context.md | 161-163 | The analyzer's contract lives at `skills/cad-assumptions-analyzer-contract`. | accurate | accurate | 2 |
| CONTEXT-09 | cadence-core/bin/lib/trace.mjs | 58-61 | Measured token figures: analyzer 186,577, planner 146,405, executor 154,523, plan-checker 47,717, verifier 78,034. | unverifiable | divergence - run 2 half B targeted `.mjs` pass: a past measurement of host metadata nothing here re-derives | 2 |
| CONTEXT-10 | cadence-core/bin/lib/trace.mjs | 62 | A built-in agent type (`Explore`) returned no token figure at all. | unverifiable | divergence - run 2 half B targeted `.mjs` pass: a runtime observation of a host agent type | 2 |
| CONTEXT-11 | cadence-core/bin/lib/trace.mjs | 64-66 | `unrecorded` can only be nonzero where a dispatch was counted, and sits beside a dispatch COUNT. | accurate | accurate | 2 |
| CONTEXT-12 | cadence-core/bin/lib/trace.mjs | 69-72 | A dispatch written and never closed is `unpaired`; a bracket never appended appears nowhere. | accurate | accurate | 2 |
| CONTEXT-13 | cadence-core/bin/lib/trace.mjs | 72-73 | The census in `trace.test.mjs` binds these lines per file. | accurate | accurate | 2 |
| CONTEXT-14 | cadence-core/workflows/context.md | 183-191 | The analyzer's bracket closes with ONE `trace close --phase <N> --plan cad-assumptions-analyzer --role cad-assumptions-analyzer --tokens <n> --turns <n>` line, and `--detail-file <path>` on the failed-or-timed-out arm makes the seam close a `checkpoint` instead of a `return`. | stale | corrected - b118576 - claim re-stated to the live `trace close` flag list | 2 |
| CONTEXT-15 | cadence-core/workflows/context.md | 366-368 | `cursor set --phase {N} --status "context gathered" --next "/cad-plan {N}"`. | accurate | accurate | 2 |
| CONTEXT-16 | cadence-core/workflows/context.md | 294-295 | `/cad-audit` FAILs on a criterion that reached no UAT item. | accurate | accurate | 2 |
| CONTEXT-17 | cadence-core/workflows/context.md | 414-415 | No review trigger fires here per `references/review-triggers.md`'s wiring table. | accurate | accurate | 2 |
| COVERAGE-01 | cadence-core/workflows/coverage.md | 12-13 | `planning.mjs status` reports per-phase status. | accurate | accurate | 2 |
| COVERAGE-02 | cadence-core/workflows/coverage.md | 13-19 | Statuses include `complete` and `executed` (and `unplanned` / `planned`). | accurate | accurate | 1 |
| COVERAGE-03 | cadence-core/workflows/coverage.md | 14-15 | `ok:false` reasons include `no-planning-dir` and `no-roadmap`, each carrying a `hint`. | accurate | accurate | 2 |
| COVERAGE-04 | cadence-core/workflows/coverage.md | 15-19 | An `ok:true` carrying `cycle: "none"` with an empty `phases[]` is a derived closed milestone. | accurate | accurate | 2 |
| COVERAGE-05 | cadence-core/workflows/coverage.md | 30-31 | A plan's `requirements` frontmatter is a real field. | accurate | accurate | 1 |
| COVERAGE-06 | cadence-core/workflows/coverage.md | 35, 63 | `workflow.test_command` is the runner config key. | accurate | accurate | 2 |
| COVERAGE-07 | cadence-core/workflows/coverage.md | 73 | `references/git-guard.md` holds the protected-branch guard. | accurate | accurate | 1 |
| COVERAGE-08 | cadence-core/workflows/coverage.md | 72 | Commit form `test(phase-<N>): cover <requirements>`. | accurate | accurate | 2 |
| DEBUG-01 | cadence-core/workflows/debug.md | 7-9 | State file lives at `.planning/debug/<slug>.md`. | accurate | accurate | 2 |
| DEBUG-02 | cadence-core/workflows/debug.md | 58-60 | `config.mjs get memory.backend review.consult.attempt_threshold` reads both in one call. | accurate | accurate | 2 |
| DEBUG-03 | cadence-core/workflows/debug.md | 70-72 | `references/bug-patterns.md` exists and is frequency-ordered. | accurate | accurate | 1 |
| DEBUG-04 | cadence-core/references/recall.md | 18-22 | `planning.mjs recall` exists; its JSON is `{ok, results:[{score, source, phase?, snippet}]}`. | accurate | accurate | 2 |
| DEBUG-05 | cadence-core/workflows/debug.md | 85-87 | A `none` backend makes recall's own backend-off return a backstop, not this workflow's gate. | accurate | accurate | 1 |
| DEBUG-06 | cadence-core/workflows/debug.md | 113-116 | The `risk_surface` trigger is `blocking` and its re-arm is capped at ONE narrowed round in `references/triage-gate.md`. | accurate | accurate | 2 |
| DEBUG-07 | cadence-core/workflows/debug.md | 111-114 | The fix's artifact is shape (b), the staged-diff scope, and the reviewer runs `git diff --cached` in the inherited cwd. | accurate | accurate | 1 |
| DEBUG-08 | cadence-core/workflows/debug.md | 126-127 | `review.consult.attempt_threshold` default is 3. | accurate | accurate | 1 |
| DEBUG-09 | cadence-core/workflows/debug.md | 136 | `references/consult.md` defines `offer_consult`. | accurate | accurate | 2 |
| DEBUG-10 | cadence-core/workflows/debug.md | 110 | `cad-debug` is one of the skills that fires `risk_surface`. | accurate | accurate | 1 |
| DECISION-REVIEW-01 | cadence-core/workflows/decision-review.md | 120-121, 162-163 | D-09: the runtime exposes no per-turn token/dollar figures, so cost reporting stays qualitative. | unverifiable | divergence - needs runtime introspection of the hosts per-turn accounting; phase 4s CONTEXT already adjudicated this against that phases subagent-return figures and ruled them a different claim | 1 |
| DECISION-REVIEW-02 | cadence-core/workflows/decision-review.md | 73-74 | The cross-model arm rests on the Phase-1 REV-01 seam repair - a symlinked install must run this seam for real, not no-op. | unverifiable | divergence - a claim about a past repairs effect under a symlinked install; needs an installed-plugin runtime to test | 1 |
| DECISION-REVIEW-03 | cadence-core/workflows/decision-review.md | 2-4, 24-26 | The target is a `- D-NN (...)` line under `## Durable decisions` / `## Decisions`, or a PROJECT.md `## Key Decisions` row. | accurate | accurate | 2 |
| DECISION-REVIEW-04 | cadence-core/workflows/decision-review.md | 10-11, 171-173 | This workflow has no entry in `references/review-triggers.md`'s wiring table. | accurate | accurate | 2 |
| DECISION-REVIEW-05 | cadence-core/workflows/decision-review.md | 43-44 | The reviewer set resolves from `review.reviewers[]` exactly as review-triggers.md step 3 does. | accurate | accurate | 1 |
| DECISION-REVIEW-06 | cadence-core/workflows/decision-review.md | 66-68 | No routing cell resolves a model for the `claude-subagent` arm; it is base `cad-reviewer` at the session default. | accurate | accurate | 2 |
| DECISION-REVIEW-07 | cadence-core/workflows/decision-review.md | 77-81 | `review-provider.mjs review --provider <name> --model <id> --effort <level> [--key-file <path>]` with `{instruction, artifact}` on stdin. | accurate | accurate | 2 |
| DECISION-REVIEW-08 | cadence-core/workflows/decision-review.md | 81-83 | `ok:false` drops that reviewer, same degradation rule as review-triggers.md step 4. | accurate | accurate | 2 |
| DECISION-REVIEW-09 | cadence-core/workflows/decision-review.md | 68-69, 78 | `review.decision_review.{tier,effort}` reach the cross-model arm only. | accurate | accurate | 2 |
| DECISION-REVIEW-10 | cadence-core/workflows/decision-review.md | 100-107 | Context7 is on this skill's main-model surface; the read-only `cad-reviewer` subagent has no MCP tools. | accurate | accurate | 2 |
| DECISION-REVIEW-11 | cadence-core/workflows/decision-review.md | 176-180 | `review-provider.mjs`'s `FINDING_SCHEMA` and self-verify's `CONTRACTS` table are unchanged, and refute still returns `{findings:[...]}`. | accurate | accurate | 2 |
| DOCS-VERIFY-01 | cadence-core/workflows/docs-verify.md | 4 | The writer is cut, per DESIGN section 2. | accurate | accurate | 2 |
| DOCS-VERIFY-02 | cadence-core/workflows/docs-verify.md | 10-11 | The default target set is `README.md` plus `docs/**`. | accurate | accurate | 2 |
| DOCS-VERIFY-03 | cadence-core/workflows/docs-verify.md | 46 | The report table columns are `claim \| location \| verdict \| correct value (if stale)`. | accurate | accurate | 2 |
| DOCS-VERIFY-04 | cadence-core/workflows/docs-verify.md | 40-44 | Verdicts are exactly `accurate \| stale \| unverifiable`. | accurate | accurate | 2 |
| EXECUTE-01 | cadence-core/workflows/execute.md | 174-176 | `cad-executor.md` already carries the executor's standing rules (atomic commit per task, deviation recording, checkpoints, never writing STATE/ROADMAP/SUMMARY, the report format) as its stable, cached definition. | stale | corrected - 044806c | 1 |
| EXECUTE-02 | cadence-core/workflows/execute.md | 360-361 | The `phase_diff` trigger is "Off by default (opt-in)". | stale | corrected - 044806c + DFC-02 closed 98be3d2; line is run-1 provenance, the live `phase_diff` mention is `:35` | 1 |
| EXECUTE-03 | cadence-core/workflows/execute.md | 365-366 | `phase_diff` is "`adjudicated` wherever it is on at all (critical only)". | stale | corrected - 044806c + DFC-02 closed 98be3d2; line is run-1 provenance, the live `phase_diff` mention is `:35` | 1 |
| EXECUTE-04 | cadence-core/workflows/execute.md | 10-12 | `planning.mjs status` returns `current`, `ok:false` with `reason`/`hint`, and `cycle:"none"` with an empty `phases[]` on a closed milestone. | accurate | accurate | 2 |
| EXECUTE-05 | cadence-core/workflows/execute.md | 17-18 | Plan files are `PLAN.md`, or `PLAN-1.md`, `PLAN-2.md`, ... in numeric order. | accurate | accurate | 2 |
| EXECUTE-06 | cadence-core/workflows/execute.md | 27-33 | The nine config keys in the single `config.mjs get` all exist (`workflow.test_command` left the batch in v2.6.2 and is read at its only consumer, `execute_parallel` step 5). | accurate | accurate | 1 |
| EXECUTE-07 | cadence-core/workflows/execute.md | 35-39 | `fire(trigger)` takes gates from the routing bundle, and a `config.mjs get` of a gate returns the schema default when no layer set it. | stale | corrected - v3.4.1 phase 1 | 2 |
| EXECUTE-08 | cadence-core/workflows/execute.md | 70 | `references/git-guard.md` holds the protected-branch guard. | accurate | accurate | 1 |
| EXECUTE-09 | cadence-core/workflows/execute.md | 59-66 | `git diff --cached --quiet` / `--name-status` and `git stash push --staged` (git 2.35+). | accurate | accurate | 2 |
| EXECUTE-10 | cadence-core/bin/planning.mjs | 1990-1996 | `lease-check` reads the whole staged index and has no provenance signal; its refusal code is `undeclared-files`. | accurate | accurate | 2 |
| EXECUTE-11 | cadence-core/workflows/execute.md | 89-94 | `trace append --phase <N> --family lifecycle --event phase_start --sha <PHASE_START>` anchors the correlation id. | accurate | accurate | 2 |
| EXECUTE-12 | cadence-core/workflows/execute.md | 97-100 | An append returning `written:false` (size cap, unwritable root) changes nothing on the execute path. | accurate | accurate | 2 |
| EXECUTE-13 | cadence-core/workflows/execute.md | 112-114 | `planning.mjs plan-overlap --phase <N>` returns `overlaps`, `undeclared` and `frontmatter_issues`. | accurate | accurate | 2 |
| EXECUTE-14 | cadence-core/workflows/execute.md | 124-153 | `worktree-base.mjs resolve` reports `parallelSafe`, with `baseRef:"fresh"` the default. | accurate | accurate | 2 |
| EXECUTE-15 | cadence-core/workflows/execute.md | 183-187 | An executor writes its task table to `<plandir>/reports/plan-<k>.md` and returns a five-field digest. | accurate | accurate | 2 |
| EXECUTE-16 | cadence-core/workflows/execute.md | 191-193 | `git worktree list --porcelain` gives the worktree root for branch `cadence/phase-<N>-plan-<k>`. | accurate | accurate | 2 |
| EXECUTE-17 | cadence-core/workflows/execute.md | 197-207 | The executor bracket is two halves: the dispatch rides the spawn-agent seam's `--bracket-plan <k>` / `--bracket-read "..."` flags, and the close is ONE `trace close --phase <N> --plan <k> --role cad-executor --tokens <n> --turns <n> --detail-file <path>` line. | stale | corrected - b118576 - claim re-stated to the live `trace close` flag list | 2 |
| EXECUTE-18 | cadence-core/workflows/execute.md | 209-213 | `--detail` omitted closes a `return` and carried closes a `checkpoint`; an `escalation` is not inferred and stays on `trace append`; a worker with none of the three is what `trace render` reports as unpaired. | stale | corrected - 4110fde - claim rewritten to the live `trace close` call | 2 |
| EXECUTE-19 | cadence-core/workflows/execute.md | 209-214 | `--role` is a separate key from `--plan`; `--plan` pairs the bracket, `--role` groups the per-role totals. | accurate | accurate | 1 |
| EXECUTE-20 | cadence-core/workflows/execute.md | 216-219 | `--tokens 0` would claim a dispatch that cost nothing, so the flag is omitted when no figure is returned. | accurate | accurate | 1 |
| EXECUTE-21 | cadence-core/workflows/execute.md | 221-224 | The `phase_start` line takes no `--role`, `--tokens` or `--read`. | accurate | accurate | 2 |
| EXECUTE-22 | cadence-core/bin/planning.mjs | 2645-2650 | `.planning/trace.jsonl` is gitignored; `/cad-new-project` writes the line via `planning.mjs trace ignore` and `/cad-health` only reports a pre-seam scaffold. | accurate | accurate | 2 |
| EXECUTE-23 | cadence-core/workflows/execute.md | 267-270 | The `diff` trigger's artifact is shape (a) refs `{base_ref, head_ref}` and its default at `shipped` is advisory. | accurate | accurate | 1 |
| EXECUTE-24 | cadence-core/workflows/execute.md | 255-258 | `references/triage-gate.md` makes NONE the default and caps the blocking re-arm at ONE round. | accurate | accurate | 2 |
| EXECUTE-25 | cadence-core/workflows/execute.md | 252-254 | The `risk_surface` checkpoint artifact is shape (c), a flagged-diff FILE path. | accurate | accurate | 1 |
| EXECUTE-26 | cadence-core/workflows/execute.md | 367-369 | `SUMMARY.md` is written from `cadence-core/templates/SUMMARY.md`. | accurate | accurate | 2 |
| EXECUTE-27 | cadence-core/workflows/execute.md | 396-401 | `planning.mjs debt-harvest --root .` rewrites `.planning/CAPTURE.md`'s own `## Debt markers` section only. | accurate | accurate | 2 |
| EXECUTE-28 | cadence-core/workflows/execute.md | 404-409 | `cursor set --phase <N> --status executed --next "/cad-verify <N>"`. | accurate | accurate | 2 |
| EXECUTE-29 | cadence-core/workflows/execute.md | 415-416 | `plan-<k>-risk-task-<n>.diff` is the transient flagged diff and must never be staged. | accurate | accurate | 1 |
| EXECUTE-30 | cadence-core/workflows/execute.md | 438-439 | STATE.md is exactly the 4-line cursor, overwritten, and this workflow is its only writer. | accurate | accurate | 2 |
| MILESTONE-01 | cadence-core/workflows/milestone.md | 9-12 | One `config.mjs get git.create_tag git.auto_close` reads both keys. | stale | corrected - REL-01 (v3.5.4) - the up-front read is `config.mjs get git.auto_close` alone, and step 2 decides release mode from a confirmed version plus the bounded `git-branch.mjs tags` probe rather than from any key | 2 |
| MILESTONE-02 | cadence-core/workflows/milestone.md | 16-20 | `/cad-audit` is the requirement/phase/plan/verified FAIL gate invoked here. | accurate | accurate | 2 |
| MILESTONE-03 | cadence-core/workflows/milestone.md | 33-39 | `release-bump.mjs bump --dir <root> --version <version>`, with `--version` REQUIRED. | accurate | accurate | 2 |
| MILESTONE-04 | cadence-core/workflows/milestone.md | 41-42 | The seam auto-detects `.claude-plugin/plugin.json` and returns `action:"skip"` when absent. | accurate | accurate | 2 |
| MILESTONE-05 | cadence-core/workflows/milestone.md | 43-45 | It bumps the manifest `version` and any versioned sibling, scaffolds the dated `## [<version>]` heading + link reference, and promotes `## [Unreleased]`. | accurate | accurate | 2 |
| MILESTONE-06 | cadence-core/workflows/milestone.md | 67-72 | An `ok:false` with `action:"refuse"` names one of `no-target-version`, `unparseable-version`, `no-version-field`, `unreadable-manifest`, `unreadable-sibling-manifest`, `unreadable-changelog`, `downgrade`, `not-an-upgrade` or `bad-date`, with nothing written and exit 1. | accurate | accurate | 2 |
| MILESTONE-07 | cadence-core/workflows/milestone.md | 78-83 | A `siblings[]` entry with `action:"refuse"` leaves top-level `ok` true, and means a sibling that was READABLE but not upgradeable - an unreadable one refuses the whole run instead. | accurate | accurate | 2 |
| MILESTONE-08 | cadence-core/workflows/milestone.md | 84-89 | `changelog.section_empty: true` means the dated heading has no body, and `changelog.state: "absent"` means there is no `CHANGELOG.md` to scaffold at all; both halt the close before the bump commit. | accurate | accurate | 2 |
| MILESTONE-09 | cadence-core/workflows/milestone.md | 67-68 | An annotated tag at HEAD (`git tag -a <version> -m ...`), unpushed. | accurate | accurate | 1 |
| MILESTONE-10 | cadence-core/workflows/milestone.md | 88-91 | A surviving `### Phase N:` detail section is the signature of an interrupted close. | accurate | accurate | 2 |
| MILESTONE-11 | cadence-core/workflows/milestone.md | 126-128 | Requirement rows must stay as rows so `/cad-audit` can trace shipped scope; `## Active` bullets take the `- **<ID>**: <one line>` form. | accurate | accurate | 2 |
| MILESTONE-12 | cadence-core/workflows/milestone.md | 135-140 | `cursor set --phase 1 --status "ready to plan" --next "/cad-phase add"`. | accurate | accurate | 2 |
| MILESTONE-13 | cadence-core/workflows/milestone.md | 139-140 | On a fully pruned roadmap the seam derives `of 0 (no active cycle)`; passing `--name`/`--total` is needed when work was deferred, else it returns `cannot-derive`. | accurate | accurate | 1 |
| MILESTONE-14 | cadence-core/workflows/milestone.md | 141-143 | `/cad-phase add` is the only workflow that appends a phase line to an existing roadmap. | accurate | accurate | 2 |
| MILESTONE-15 | cadence-core/workflows/milestone.md | 152-154 | `git.auto_close` false is the default, so the tag stays unpushed and publishing is a separate `/cad-land`. | accurate | accurate | 2 |
| MILESTONE-16 | cadence-core/workflows/milestone.md | 167-172 | The chain reaps via `land-cleanup.mjs`'s `cadence/*`-merged fallback (`resolveReapBranch`). | accurate | accurate | 2 |
| NEW-PROJECT-01 | cadence-core/workflows/new-project.md | 60 | The written defaults are "interactive, research off, plan check and verifier on". | stale | corrected - 044806c | 1 |
| NEW-PROJECT-02 | cadence-core/workflows/new-project.md | 121-122 | Structured-question headers are capped at 12 characters. | unverifiable | divergence - a host `AskUserQuestion` constraint, stated nowhere in this repo except that file and its own `:209` | 1 |
| NEW-PROJECT-03 | cadence-core/workflows/new-project.md | 38 | Skipping init when `git rev-parse --git-dir` fails identifies a non-repo. | accurate | accurate | 1 |
| NEW-PROJECT-04 | cadence-core/workflows/new-project.md | 42 | `planning.mjs trace ignore --root .` exists as a seam call. | accurate | accurate | 2 |
| NEW-PROJECT-05 | cadence-core/workflows/new-project.md | 47 | A re-run returns `written:false` with `reason:"already-ignored"`. | accurate | accurate | 2 |
| NEW-PROJECT-06 | cadence-core/workflows/new-project.md | 48 | A project ignoring `.planning/` wholesale is detected and left alone. | accurate | accurate | 1 |
| NEW-PROJECT-07 | cadence-core/workflows/new-project.md | 56, 59 | `cadence-core/templates/config.json` is the engine template, copied verbatim, and setup asks no configuration questions - with ONE stated exception, the forge in item 6, because a forge is a precondition no template can default. | accurate | accurate | 2 |
| NEW-PROJECT-08 | cadence-core/workflows/new-project.md | 61 | Defaults are research off, plan check on, verifier on. | stale | corrected - ee0199b - the same sentence - the written default for `workflow.plan_check` is reported as off | 1 |
| NEW-PROJECT-09 | cadence-core/workflows/new-project.md | 66-68 | The seven keys read via `config.mjs get` all resolve. | accurate | accurate | 2 |
| NEW-PROJECT-10 | cadence-core/workflows/new-project.md | 161 | `cadence-core/templates/PROJECT.md` exists. | accurate | accurate | 2 |
| NEW-PROJECT-11 | cadence-core/workflows/new-project.md | 173 | The protected-branch guard lives in `references/git-guard.md`. | accurate | accurate | 2 |
| NEW-PROJECT-12 | cadence-core/workflows/new-project.md | 188 | Dispatch via the spawn-agent seam with timeout `workflow.subagent_timeout`. | accurate | accurate | 1 |
| NEW-PROJECT-13 | cadence-core/workflows/new-project.md | 206-207 | The research agent is the only Cadence dispatch path with no `maxTurns` bound, and `maxTurns` is per-FILE frontmatter. | accurate | accurate | 2 |
| NEW-PROJECT-14 | cadence-core/workflows/new-project.md | 207-210 | A 20th rung file would cost a `route-table.json` rung row plus both directions of self-verify's rung checks. | accurate | accurate | 2 |
| NEW-PROJECT-15 | cadence-core/workflows/new-project.md | 244-245 | Category questions batch up to 4 per AskUserQuestion call. | accurate | accurate | 1 |
| NEW-PROJECT-16 | cadence-core/workflows/new-project.md | 268 | `cadence-core/templates/REQUIREMENTS.md` exists. | accurate | accurate | 2 |
| NEW-PROJECT-17 | cadence-core/workflows/new-project.md | 270-271, 298-300 | Traceability rows are seeded per phase by `/cad-plan`. | accurate | accurate | 2 |
| NEW-PROJECT-18 | cadence-core/workflows/new-project.md | 287-288 | `granularity`: coarse 3-5, standard 5-8, fine 8-12. | accurate | accurate | 2 |
| NEW-PROJECT-19 | cadence-core/workflows/new-project.md | 297 | `cadence-core/templates/ROADMAP.md` exists. | accurate | accurate | 2 |
| NEW-PROJECT-20 | cadence-core/workflows/new-project.md | 337-338 | `cursor set --phase 1 --status "ready to plan" --next "/cad-context 1"` is a valid call. | accurate | accurate | 2 |
| NEW-PROJECT-21 | cadence-core/workflows/new-project.md | 341-345 | A phase directory is `.planning/phases/<N>/` with no zero-padding and no slug suffix. | accurate | accurate | 2 |
| NEW-PROJECT-22 | cadence-core/workflows/new-project.md | 374-375, 402 | STATE.md is a 4-line cursor. | accurate | accurate | 2 |
| PHASE-01 | cadence-core/workflows/phase.md | 4-6 | A phase number appears in four places: ROADMAP list, `.planning/phases/<N>/`, the REQUIREMENTS Phase column, the STATE cursor. | accurate | accurate | 2 |
| PHASE-02 | cadence-core/workflows/phase.md | 7 | The renumber mechanics live in the planning seam's `renumber` subcommand. | accurate | accurate | 2 |
| PHASE-03 | cadence-core/workflows/phase.md | 18-20 | `cursor set` requires `--phase` and does not preserve the prior one, so `cursor get` first is not optional. | accurate | accurate | 2 |
| PHASE-04 | cadence-core/workflows/phase.md | 30 | `renumber insert --at <N> --dry-run` is the dry-run form. | accurate | accurate | 2 |
| PHASE-05 | cadence-core/workflows/phase.md | 32 | The dry-run returns `ops`, `in_text_refs` and `warn`. | accurate | accurate | 2 |
| PHASE-06 | cadence-core/workflows/phase.md | 36-38 | Insert moves dirs high-to-low via `git mv`, shifts `Phase K`/`phases/K/` at or above N, re-points the cursor. | accurate | accurate | 2 |
| PHASE-07 | cadence-core/workflows/phase.md | 39 | The insert output carries `slot` for the empty numbered slot. | accurate | accurate | 2 |
| PHASE-08 | cadence-core/workflows/phase.md | 51-53 | `renumber remove --n <N> --dry-run` returns `orphaned_reqs`. | accurate | accurate | 2 |
| PHASE-09 | cadence-core/workflows/phase.md | 54-57 | Remove drops the list line and detail section, `git rm`s the dir, renumbers low-to-high, re-points the cursor. | accurate | accurate | 1 |
| PHASE-10 | cadence-core/workflows/phase.md | 56-57 | Orphaned rows' Phase cells are blanked and surface as `no-phase` in /cad-audit. | accurate | accurate | 2 |
| PHASE-11 | cadence-core/workflows/phase.md | 62-64 | A failed apply returns `ok:false` with a `completed` list; the seam is not transactional. | accurate | accurate | 2 |
| PHASE-12 | cadence-core/workflows/phase.md | 65 | `planning.mjs status` is the sanity spot-check. | accurate | accurate | 1 |
| PHASE-13 | cadence-core/workflows/phase.md | 67 | The protected-branch guard is in `references/git-guard.md`. | accurate | accurate | 2 |
| PLAN-GAPS-01 | cadence-core/workflows/plan-gaps.md | 10 | `planning.mjs uat status --phase <N>` reads the outstanding items. | accurate | accurate | 2 |
| PLAN-GAPS-02 | cadence-core/workflows/plan-gaps.md | 13 | A missing checklist returns `no-uat`. | accurate | accurate | 2 |
| PLAN-GAPS-03 | cadence-core/workflows/plan-gaps.md | 15 | `.planning/phases/<N>/UAT.md` holds the item detail. | accurate | accurate | 1 |
| PLAN-GAPS-04 | cadence-core/workflows/plan-gaps.md | 19 | plan.md has a `spawn_planner` step to rejoin. | accurate | accurate | 1 |
| PLAN-01 | cadence-core/workflows/plan.md | 109-110 | `(D-03)` names the decision that recall's backend-off return is a backstop, not this workflow's gate. | unverifiable | divergence - a bare decision id naming no phase or file; the CONTEXT that held it is in neither the live `.planning/` tree nor any `_archive-*` milestone, so it cannot be resolved mechanically | 1 |
| PLAN-02 | cadence-core/workflows/plan.md | 124-125 | `(D-01 / cache discipline)` names the decision that recall snippets ride the dispatch prompt. | unverifiable | divergence - same for the `D-01` half; the `cache discipline` half resolves at `references/seams.md:191` | 1 |
| PLAN-03 | cadence-core/workflows/plan.md | — | 4 flags, not ~20. | accurate | RETIRED - the sentence was cut in v2.6.2 (phase 2, CTW-03) as design-history contrast; nothing left to re-verify | 1 |
| PLAN-04 | cadence-core/workflows/plan.md | 17-18 | `planning.mjs status` returns `current` and a `phases[]` showing which phases still need plans. | accurate | accurate | 2 |
| PLAN-05 | cadence-core/workflows/plan.md | 20-22 | `ok:true` with `cycle: "none"` and an empty `phases[]` is a derived closed milestone. | accurate | accurate | 2 |
| PLAN-06 | cadence-core/workflows/plan.md | 28-29 | `--gaps` loads `cadence-core/workflows/plan-gaps.md`. | accurate | accurate | 2 |
| PLAN-07 | cadence-core/workflows/plan.md | 34-38 | The eight-key `config.mjs get` batch is valid. | accurate | accurate | 2 |
| PLAN-08 | cadence-core/workflows/plan.md | 58-59 | `fire(trigger)` takes gates from the routing bundle (`route.mjs resolve`). | accurate | accurate | 2 |
| PLAN-09 | cadence-core/workflows/plan.md | 60-62 | `config.mjs get` returns the schema DEFAULT for a gate no layer set. | stale | corrected - v3.4.1 phase 1 | 2 |
| PLAN-10 | cadence-core/workflows/plan.md | 64-66, 107-108, 180-185 | `memory.backend` gates recall in spawn_planner and inline_plan. | accurate | accurate | 2 |
| PLAN-11 | cadence-core/workflows/plan.md | 88-89 | `workflow.inline_plan_threshold` is the inline routing threshold. | accurate | accurate | 1 |
| PLAN-12 | cadence-core/workflows/plan.md | 86 | `trace append --phase --family lifecycle --event dispatch --plan --role --read` is a valid call. | stale | divergence - run 2 half B: `4110fde` left plan.md with no `trace append` call; line left at run-1 provenance | 1 |
| PLAN-13 | cadence-core/workflows/plan.md | 117 | `planning.mjs recall "<terms>"` is the recall call. | accurate | accurate | 2 |
| PLAN-14 | cadence-core/workflows/plan.md | 120 | Recall returns `{ok, results:[{score, source, phase?, snippet}]}`. | accurate | accurate | 2 |
| PLAN-15 | cadence-core/workflows/plan.md | 117,153 | seams.md states a cache discipline for dispatch prompts. | accurate | accurate | 1 |
| PLAN-16 | cadence-core/workflows/plan.md | 139 | `workflow.max_plan_tasks` is the ceiling and the planner returns `## PHASE TOO BIG` above it. | accurate | accurate | 1 |
| PLAN-17 | cadence-core/workflows/plan.md | 150 | `cadence-core/templates/PLAN.md` exists. | accurate | accurate | 2 |
| PLAN-18 | cadence-core/workflows/plan.md | 193-197 | The planner's return closes with ONE `trace close --phase <N> --plan cad-planner --role cad-planner --tokens <n> --turns <n>` line, and `--tokens` is omitted on a figureless return. | stale | corrected - b118576 - claim re-stated to the live `trace close` flag list | 2 |
| PLAN-19 | cadence-core/workflows/plan.md | 191-192 | On the empty-or-unmarked arm `--detail "<empty or unmarked return>"` is added and the seam closes it as a checkpoint instead. | stale | corrected - 4110fde - claim rewritten to the live `trace close` call | 2 |
| PLAN-20 | cadence-core/workflows/plan.md | 198 | `## PLANNING COMPLETE` is a planner return marker. | accurate | accurate | 1 |
| PLAN-21 | cadence-core/workflows/plan.md | 224-227 | `plan-overlap` means plans sharing a file cannot run concurrently. | accurate | accurate | 2 |
| PLAN-22 | cadence-core/workflows/plan.md | 230 | `offer_consult` is defined in `references/consult.md`. | accurate | accurate | 2 |
| PLAN-23 | cadence-core/workflows/plan.md | 275 | The Task ceiling feeds the checker's dimension 6. | accurate | accurate | 1 |
| PLAN-24 | cadence-core/workflows/plan.md | 297-298 | The checker returns `## VERIFICATION PASSED` or `## ISSUES FOUND` with BLOCKER/WARNING findings. | accurate | accurate | 1 |
| PLAN-25 | cadence-core/workflows/plan.md | 299 | WARNING means quality is degraded but execution can proceed. | accurate | accurate | 1 |
| PLAN-26 | cadence-core/references/plan-revision.md | 10-12 | `--attempt 2` makes the routing seam climb to the retry rung the cell names. | accurate | accurate | 2 |
| PLAN-27 | cadence-core/workflows/plan.md | 331 | The `plan` gate defaults to adjudicated. | stale | corrected - 813f468 - the review step now names the gate each level resolves - `off` at `shipped`, advisory at `solo`, adjudicated at `critical` | 2 |
| PLAN-28 | cadence-core/workflows/plan.md | 354 | `cadence-core/references/triage-gate.md` exists. | accurate | accurate | 1 |
| PLAN-29 | cadence-core/workflows/plan.md | 368 | `planning.mjs seed-reqs --phase {N}` exists. | accurate | accurate | 2 |
| PLAN-30 | cadence-core/workflows/plan.md | 376-377 | seed-reqs inserts `\| <id> \| Phase {N} \| Pending \|` for `## Active`-bounded declared ids, idempotently. | accurate | accurate | 1 |
| PLAN-31 | cadence-core/workflows/plan.md | 379-380 | It reports `orphan_ids`, `no_active_section: true`, and always Pending status. | accurate | accurate | 1 |
| PLAN-32 | cadence-core/workflows/plan.md | 372 | `cursor set --phase {N} --status planned --next "/cad-execute {N}"` is valid. | accurate | accurate | 2 |
| PLAN-33 | cadence-core/workflows/plan.md | 389 | `references/git-guard.md` rail 1 is the protected-branch guard. | accurate | accurate | 2 |
| PROGRESS-01 | cadence-core/workflows/progress.md | 172-173 | The trace file is written by the seams and by the execute and verify workflows. | stale | corrected - 044806c | 1 |
| PROGRESS-02 | cadence-core/workflows/progress.md | 180 | `planning.mjs status` is the derivation. | accurate | accurate | 1 |
| PROGRESS-03 | cadence-core/workflows/progress.md | 23-25 | Derived statuses are unplanned -> planned -> executed -> complete, with UAT counts. | accurate | accurate | 2 |
| PROGRESS-04 | cadence-core/workflows/progress.md | 26 | `current` is the lowest non-complete phase, null when all complete. | accurate | accurate | 2 |
| PROGRESS-05 | cadence-core/workflows/progress.md | 27-30 | `cycle` is present and `"none"` only for a derived closed milestone. | accurate | accurate | 2 |
| PROGRESS-06 | cadence-core/workflows/progress.md | 31 | `references/roadmap-phases.md` holds the grammar. | accurate | accurate | 1 |
| PROGRESS-07 | cadence-core/workflows/progress.md | 32-33 | `cursor` carries `agrees`, already computed. | accurate | accurate | 2 |
| PROGRESS-08 | cadence-core/workflows/progress.md | 36-37 | `drift[]` kinds are `cursor`, `roadmap-box`, `req-status`, `phase-dir`, `phase-dir-grammar`. | accurate | accurate | 2 |
| PROGRESS-09 | cadence-core/workflows/progress.md | 39-41 | `ok:false` with `no-planning-dir` is the no-project reason. | accurate | accurate | 2 |
| PROGRESS-10 | cadence-core/workflows/progress.md | 58-59 | Cursor drift is repaired through `cursor set`. | accurate | accurate | 2 |
| PROGRESS-11 | cadence-core/workflows/progress.md | 61-64 | Status mapping unplanned/planned/executed/all-complete are legal cursor statuses. | accurate | accurate | 1 |
| PROGRESS-12 | cadence-core/workflows/progress.md | 65-68 | A closed-milestone cursor set with no `--name`/`--total` derives "no active cycle" and 0. | accurate | accurate | 2 |
| PROGRESS-13 | cadence-core/workflows/progress.md | 96 | `trace render --phase <current>`. | accurate | accurate | 2 |
| PROGRESS-14 | cadence-core/workflows/progress.md | 99-101 | Four family counts `routing`, `provider`, `lifecycle`, `outcome` printed over the events the phase filter admitted. | accurate | corrected - 059493f - the `under one corr` tail dropped as falsified; the scoping fact that tail stated wrong is PROGRESS-28's subject | 2 |
| PROGRESS-15 | cadence-core/workflows/progress.md | 102-109 | The `roles` block carries a dispatch count, a token total, a turn total, and `unrecorded` / `turns_unrecorded` when present; an absent total prints `unrecorded`, never 0. | accurate | corrected - 059493f - claim re-stated to the live `roles` block | 2 |
| PROGRESS-16 | cadence-core/workflows/progress.md | 104 | A render carrying no `roles` key prints nothing for it. | accurate | accurate | 1 |
| PROGRESS-17 | cadence-core/workflows/progress.md | 105-107 | `unpaired` names a worker with no return, checkpoint or escalation. | accurate | accurate | 2 |
| PROGRESS-18 | cadence-core/workflows/progress.md | 107-109 | `capped` true means the record hit its size bound. | accurate | accurate | 2 |
| PROGRESS-19 | cadence-core/workflows/progress.md | 109-111 | An absent trace file returns `ok:true` with empty counts. | accurate | accurate | 2 |
| PROGRESS-20 | cadence-core/workflows/progress.md | 139 | `workflow.skip_discuss` selects /cad-plan over /cad-context. | accurate | accurate | 2 |
| SPIKE-01 | cadence-core/workflows/spike.md | 20-21,45 | The spike record lives at `.planning/spikes/<slug>/SPIKE.md`. | accurate | accurate | 1 |
| SPIKE-02 | cadence-core/workflows/spike.md | 51 | The SPIKE.md commit honors the protected-branch guard. | accurate | accurate | 2 |
| TASK-01 | cadence-core/workflows/task.md | 75-77 | The `risk_surface` fire's artifact is refs, shape (a) `{base_ref: parent of the task's first commit, head_ref: HEAD}`. | stale | corrected - 044806c + DFC-04 closed 98be3d2 | 1 |
| TASK-02 | cadence-core/workflows/task.md | 2-4 | Rail 1 is the protected-branch check plus base-integrity plus the integration-branch decision, not a bare branch check. | accurate | accurate | 2 |
| TASK-03 | cadence-core/workflows/task.md | 23 | `cadence-core/references/git-guard.md` exists. | accurate | accurate | 1 |
| TASK-04 | cadence-core/workflows/task.md | 46 | `workflow.test_command` is a config key. | accurate | accurate | 2 |
| TASK-05 | cadence-core/workflows/task.md | 48 | Rail 2 is atomic conventional commits of specific files. | accurate | accurate | 2 |
| TASK-06 | cadence-core/workflows/task.md | 54 | Planned tasks write `.planning/tasks/{slug}/PLAN.md`. | accurate | accurate | 2 |
| TASK-07 | cadence-core/workflows/task.md | 63-64 | cad-executor is dispatched via the spawn-agent seam. | accurate | accurate | 1 |
| TASK-08 | cadence-core/workflows/task.md | 66-68 | The executor's report is `.planning/tasks/{slug}/reports/plan-1.md` and it returns a digest, not a table. | accurate | accurate | 2 |
| TASK-09 | cadence-core/workflows/task.md | 69 | `planning.commit_docs` gates the plan-file commit. | accurate | accurate | 2 |
| TASK-10 | cadence-core/workflows/task.md | 90, 107 | `risk_surface` is blocking at every level. | accurate | accurate | 2 |
| TASK-11 | cadence-core/workflows/task.md | 107-110 | Its re-arm is capped at ONE narrowed round, and that cap lives only in `triage-gate.md`. | accurate | accurate | 2 |
| UNDO-01 | cadence-core/workflows/undo.md | 4-5 | SUMMARY.md is the manifest - cad-execute writes commits-per-task with hashes there. | accurate | accurate | 2 |
| UNDO-02 | cadence-core/workflows/undo.md | 10 | The phase's docs commit is `docs(<N>): ...`. | accurate | accurate | 1 |
| UNDO-03 | cadence-core/workflows/undo.md | 20-21 | The dirty guard offers a stash through the ask-user seam. | accurate | accurate | 1 |
| UNDO-04 | cadence-core/workflows/undo.md | 28-33 | Only the protected-branch check of `git-guard.md` rail 1 applies to a committing revert. | accurate | accurate | 2 |
| UNDO-05 | cadence-core/workflows/undo.md | 35-42 | `git revert --no-edit`, `git revert --no-commit`, `git revert --abort`. | accurate | accurate | 2 |
| UNDO-06 | cadence-core/workflows/undo.md | 48 | `planning.mjs phase-done --n <N> --undo`. | accurate | accurate | 2 |
| UNDO-07 | cadence-core/workflows/undo.md | 49 | `cursor set --phase <N> --status <planned \| "ready to plan"> --next ...`. | accurate | accurate | 2 |
| UNDO-08 | cadence-core/workflows/undo.md | 54-55 | `--undo` unchecks the ROADMAP box and flips traceability rows back to Pending. | accurate | accurate | 2 |
| VERIFY-DEEP-01 | cadence-core/workflows/verify-deep.md | 13 | The dispatch bracket call with `--plan cad-verifier --role cad-verifier --read "..."` is valid. | stale | divergence - run 2 half B: the dispatch half now rides `--bracket-read` on the resolve, no `trace append` call remains; line left at run-1 provenance | 1 |
| VERIFY-DEEP-02 | cadence-core/workflows/verify-deep.md | 8-11 | `--plan` is the pairing key and `--role` the per-role grouping key. | stale | divergence - run 2 half B: that prose lives in execute.md now and verify-deep.md no longer states it; line left at run-1 provenance | 1 |
| VERIFY-DEEP-03 | cadence-core/workflows/verify-deep.md | 10-13 | The verifier writes `.planning/phases/<N>/verifier-findings.json`. | accurate | accurate | 2 |
| VERIFY-DEEP-04 | cadence-core/workflows/verify-deep.md | 13 | The verifier contract lives at `skills/cad-verifier-contract`. | accurate | accurate | 2 |
| VERIFY-DEEP-05 | cadence-core/workflows/verify-deep.md | 15-19, 26 | The verifier's bracket closes with ONE `trace close --phase <N> --plan cad-verifier --role cad-verifier --tokens <n> --turns <n> --detail-file <path>` line the moment the return is in hand, and `--tokens` is omitted on a figureless return. | stale | corrected - b118576 - claim re-stated to the live `trace close` flag list | 2 |
| VERIFY-DEEP-06 | cadence-core/workflows/verify-deep.md | 36-37 | `uat merge --phase <N> --payload <file>`. | accurate | accurate | 2 |
| VERIFY-DEEP-07 | cadence-core/workflows/verify-deep.md | 42-45 | Verifier results only fill `pending` items; a conflicting finding is skipped and counted. | accurate | accurate | 2 |
| VERIFY-DEEP-08 | cadence-core/workflows/verify-deep.md | 44-45 | Unmatched gaps append as new failed items; human checks append as pending. | accurate | accurate | 1 |
| VERIFY-DEEP-09 | cadence-core/workflows/verify-deep.md | 45-46 | An entry resolving to no usable item name is rejected and counted, never appended. | accurate | accurate | 2 |
| VERIFY-DEEP-10 | cadence-core/workflows/verify-deep.md | 48-49 | The seam's summary carries `auto_passed`, `gaps`, `added`, `skipped`, `rejected`. | accurate | accurate | 2 |
| VERIFY-DEEP-11 | cadence-core/workflows/verify-deep.md | 54-57 | The seam writes `.planning/phases/<N>/FINDINGS.json` with those counters plus `rejected_entries` and `skipped_entries`, overwriting on every successful merge. | accurate | accurate | 2 |
| VERIFY-DEEP-12 | cadence-core/workflows/verify-deep.md | 22-23 | Carrying `--detail` on a failed, empty or timed-out dispatch closes a `checkpoint`; omitting it on a usable return closes a `return`. | stale | corrected - 4110fde - claim rewritten to the live `trace close` call | 2 |
| VERIFY-01 | cadence-core/workflows/verify.md | 7-8 | The seam owns first_pass set-once, verifier-never-overwrites-user, counts recomputed every write. | accurate | accurate | 2 |
| VERIFY-02 | cadence-core/workflows/verify.md | 10-11, 19-20 | `--sweep` cold branch is `workflows/verify-sweep.md`; `--deep` is `workflows/verify-deep.md`. | accurate | accurate | 2 |
| VERIFY-03 | cadence-core/workflows/verify.md | 22 | `planning.mjs cursor get` supplies the current phase. | accurate | accurate | 2 |
| VERIFY-04 | cadence-core/workflows/verify.md | 30 | `uat status --phase <N>` is the state check and returns `counts`. | accurate | accurate | 2 |
| VERIFY-05 | cadence-core/workflows/verify.md | 39-41 | `uat refresh --phase <N>` takes a stdin array of `{name, expected, criterion}`. | accurate | accurate | 2 |
| VERIFY-06 | cadence-core/workflows/verify.md | 43-45 | Refresh appends only genuinely new names and never touches recorded results. | accurate | accurate | 2 |
| VERIFY-07 | cadence-core/workflows/verify.md | 47 | A missing checklist reports `no-uat`. | accurate | accurate | 2 |
| VERIFY-08 | cadence-core/workflows/verify.md | 64-68 | An item from a CONTEXT criterion carries `"criterion":"AC<N>"`. | accurate | accurate | 2 |
| VERIFY-09 | cadence-core/workflows/verify.md | 69-70 | /cad-audit FAILs on a criterion no item names. | accurate | accurate | 2 |
| VERIFY-10 | cadence-core/workflows/verify.md | 72 | Other-source items carry `"origin"`; the smoke item sends `"origin":"smoke"`. | accurate | accurate | 2 |
| VERIFY-11 | cadence-core/bin/planning.mjs | 696-700 | `uat init` writes `fields_version` before it looks at an item. | accurate | accurate | 2 |
| VERIFY-12 | cadence-core/bin/planning.mjs | 1281-1283 | Legacy also requires a CONTEXT declaring no ids beside a fieldless checklist. | accurate | accurate | 2 |
| VERIFY-13 | cadence-core/workflows/verify.md | 80 | CONTEXT criteria may carry a `(human-verify: needs <tool/service>)` tag. | accurate | accurate | 1 |
| VERIFY-14 | cadence-core/workflows/verify.md | 94-95 | `uat init --phase <N>` takes the item array on stdin. | accurate | accurate | 2 |
| VERIFY-15 | cadence-core/workflows/verify.md | 103 | `workflow.verifier: false` always skips the deep pass. | accurate | accurate | 2 |
| VERIFY-16 | cadence-core/workflows/verify.md | 108 | `route.mjs resolve --role cad-verifier` is the stakes probe. | accurate | accurate | 2 |
| VERIFY-17 | cadence-core/workflows/verify.md | 112 | Every `warnings[]` entry must be relayed. | accurate | accurate | 2 |
| VERIFY-18 | cadence-core/workflows/verify.md | 114 | `verify` on that line is `on` or `off`. | accurate | accurate | 2 |
| VERIFY-19 | cadence-core/workflows/verify.md | 115-117 | The seam refuses a resolve with no role. | accurate | accurate | 2 |
| VERIFY-20 | cadence-core/workflows/verify.md | 120-121 | At stakes solo the deep verify pass is off. | accurate | accurate | 2 |
| VERIFY-21 | cadence-core/workflows/verify.md | 138-140,155 | A suffix-tagged `(human-verify: ...)` item goes straight to pass 2. | accurate | accurate | 1 |
| VERIFY-22 | cadence-core/workflows/verify.md | 145-148 | The deep pass writes `why_human` for every UNCERTAIN truth as well as every human-only check. | accurate | accurate | 1 |
| VERIFY-23 | cadence-core/workflows/verify.md | 156-159 | `blocked` is terminal: `next` offers only `pending`. | accurate | accurate | 2 |
| VERIFY-24 | cadence-core/workflows/verify.md | 158 | `refresh` appends only unseen names. | accurate | accurate | 1 |
| VERIFY-25 | cadence-core/workflows/verify.md | 159 | `route_failures`' reset is scoped to `status: fail`. | accurate | accurate | 1 |
| VERIFY-26 | cadence-core/workflows/verify.md | 159-160 | Completion refuses a `blocked` item. | accurate | accurate | 1 |
| VERIFY-27 | cadence-core/workflows/verify.md | 167-169 | `uat status` returns `status`, `counts`, `result` and `first_pending` alone. | accurate | accurate | 2 |
| VERIFY-28 | cadence-core/workflows/verify.md | 177-179 | `uat record --phase <N> --item <k> --result <r> --evidence "..." --source model` is valid. | accurate | accurate | 2 |
| VERIFY-29 | cadence-core/workflows/verify.md | 181-184 | `uat merge` atomically overwrites `phases/<N>/FINDINGS.json` on every success. | accurate | accurate | 2 |
| VERIFY-30 | cadence-core/workflows/verify.md | 214-219 | The reply/result mapping uses only legal results (pass/skipped/blocked/fail). | accurate | accurate | 1 |
| VERIFY-31 | cadence-core/workflows/verify.md | 229-231 | `uat record ... [--reported] [--severity] [--reason]` are recorded fields. | accurate | accurate | 2 |
| VERIFY-32 | cadence-core/workflows/verify.md | 233-234 | The output's `next` field is the next pending item. | accurate | accurate | 2 |
| VERIFY-33 | cadence-core/workflows/verify.md | 241-242 | A re-record with `--cause` adds the field and leaves first_pass safe. | accurate | accurate | 2 |
| VERIFY-34 | cadence-core/workflows/verify.md | 243-247 | The verifier's gap carries `missing` and its human check carries `why_human`. | accurate | accurate | 2 |
| VERIFY-35 | cadence-core/workflows/verify.md | 250-253 | The route_failures review fire uses shape (c), file paths. | accurate | accurate | 1 |
| VERIFY-36 | cadence-core/workflows/verify.md | 257 | `cadence-core/references/triage-gate.md` exists and holds the triage rules. | accurate | accurate | 1 |
| VERIFY-37 | cadence-core/workflows/verify.md | 268-269 | The commit-time `risk_surface` fire is shape (b), the staged-diff scope, blocking, re-arm capped at one narrowed round. | accurate | accurate | 2 |
| VERIFY-38 | cadence-core/workflows/verify.md | 270-272 | `uat record --item <k> --result pending --fix "{hash}, retest"` is valid. | accurate | accurate | 2 |
| VERIFY-39 | cadence-core/workflows/verify.md | 286-288 | `result: complete` means every item passed or was skipped with a reason. | accurate | accurate | 2 |
| VERIFY-40 | cadence-core/workflows/verify.md | 294 | `trace append --phase <N> --family outcome --event uat_verdict --detail "..."` is valid. | accurate | accurate | 2 |
| VERIFY-41 | cadence-core/workflows/verify.md | 302-304 | `phase-done --n <N>` checks the ROADMAP box and flips traceability rows to Complete, Deferred exempt. | accurate | accurate | 2 |
| VERIFY-42 | cadence-core/workflows/verify.md | 305-307 | `cursor set --phase <N> --status "phase complete" --next ...` is valid. | accurate | accurate | 2 |
| VERIFY-43 | cadence-core/workflows/verify.md | 312-315 | The commit stages UAT.md, `phases/<N>/FINDINGS.json` and `phases/<N>/verifier-findings.json`. | accurate | accurate | 2 |
| VERIFY-44 | cadence-core/workflows/verify.md | 321 | The report distinguishes `{v} auto-verified` from `{m} model-executed`. | unverifiable | divergence - run 2 half B: no seam returns that split | 2 |
| VERIFY-SWEEP-01 | cadence-core/workflows/verify-sweep.md | 9 | `planning.mjs status` is the one seam call. | accurate | accurate | 2 |
| VERIFY-SWEEP-02 | cadence-core/workflows/verify-sweep.md | 11-12 | `phases[]` already carries each phase's derived state and UAT counts. | accurate | accurate | 2 |
| VERIFY-SWEEP-03 | cadence-core/workflows/verify-sweep.md | 12-14 | A phase with status `executed` and no `uat` field was built and never verified. | accurate | accurate | 2 |
| VERIFY-SWEEP-04 | cadence-core/workflows/verify-sweep.md | 20 | Open-failure phases are read from `.planning/phases/<N>/UAT.md`. | accurate | accurate | 1 |
| VERIFY-SWEEP-05 | cadence-core/workflows/verify-sweep.md | 28 | The resume offer goes through the ask-user seam. | accurate | accurate | 2 |
| VERIFY-SWEEP-06 | cadence-core/workflows/verify-sweep.md | 4,32 | verify.md has a `build_or_resume` step to return to. | accurate | accurate | 2 |

## Claims added after run 1

Run 1's positional ids and its 509/18/20 = 547 counts describe run 1's table
ONLY, and nothing below is part of them. Rows here are claims made after that
sweep closed, which the next sweep must re-verify on the same `doc` plus claim
TEXT join rule the run-1 rows use.

They are kept out of the run-1 table precisely so that count stays a true record
of what was swept: folding a later claim into it would make 547 describe a
surface no run ever read, and the shrink-versus-drift comparison the ledger
exists for would be measured against a moving baseline.

**Run 2's extractions live here too**, for the same reason. 385 of run 2's 743
claims joined to no run-1 row and are transcribed below verbatim; the other 358
carried run 2's verdict onto the run-1 row they joined. Three kinds are here:
everything invocation 4 extracted from the four workflow files run 1 never swept
(`adopt.md`, `minimalism-review.md`, `report.md`, `suggest.md`, 85 rows,
none of which could have a run-1 row); everything invocation 5 extracted beyond
the 32 rows run 1 had re-pointed at those three reference docs; and every claim
the three re-run invocations extracted that run 1's table does not carry, which
is the bulk of them - run 2 was a FRESH extraction under `docs-verify.md` steps
2-4 and decomposed the same prose differently, so a claim reworded past the
`doc` plus claim TEXT join arrives here as a new row rather than as a verdict on
an old one. Some of those restate a run-1 row in different words. That is the
stated cost of joining on text rather than on an id, and it is the cost run 1's
own join rule chose (see `## Reading this ledger`).

**A `run` cell reading `-` is a claim filed WITH the code, between sweeps.** No
run has verdicted it yet: its verdict column is the filing phase's own check,
named in `resolution`, and the next sweep verdicts it like any other row and
replaces the `-` with its number. Keeping those rows here rather than holding
them until a sweep is what stops a cycle's new prose from being invisible to the
ledger it is supposed to be measured by.

Ids continue their doc's ordinal rather than restarting, so no id below collides
with one above. Where run 1 re-pointed a row's `doc` at a file it had never
swept, the run-1 row keeps the id it was given (the ~29 `CONFIG-` rows now
naming `config-catalog.md`) while rows extracted from that file directly take
its own basename (`CONFIG-CATALOG-`); the pair is a provenance record, not a
mistake.

| id | doc | line | claim | verdict | resolution | run |
|---|---|---|---|---|---|---|
| COMMANDS-01 | cadence-core/references/COMMANDS.md | 40 | `/cad-land [base]` reports git state PLUS the tracker - which issues this branch's commits reference and which are still open - reads only and closes nothing, and `git.issue_check: false` turns the report off. | accurate | filed with the code, v3.4.0 phase 1 (LND-01); the row's key exists in `config.schema.json` and self-verify check 1 is clean | - |
| README-85 | docs/EXAMPLE.md | 42-46 | Before `/cad-land` asks how to publish, it names the issues this branch's commits reference and which of them are still open on the forge picked at project setup; it closes nothing, and `git.issue_check: false` turns the report off. | accurate | corrected - v3.7.1 phase 1 (FRG-01): config is authoritative, so the sentence no longer says "the host the origin points at". Proved by `issue-check.test.mjs` (report arm, three providers) and by the key-off spawn-marker case | - |
| README-86 | README.md | — | The `## The commands` entry for `/cad-land` states the same tracker report and the same `git.issue_check` off switch. | accurate | RETIRED - the `## The commands` entry for `/cad-land` was cut in v3.5.5 (phase 5, RME-01); README-85 carries the same claim from `docs/EXAMPLE.md` | - |
| CONFIG-CATALOG-13 | cadence-core/references/config-catalog.md | 46 | `git.issue_check` is a bool defaulting to `true`: `true` gives a read-only tracker report - against the forge `git.forge_provider` and `git.forge_repo` name - with one line naming the reason when it cannot be read, `false` says nothing about the tracker and runs no forge CLI. | accurate | amended - v3.7.1 phase 1 (FRG-01) names the forge the report is made against; the default is proved by `config.mjs get git.issue_check` over a config that omits it, the no-spawn half by the marker-file case in `issue-check.test.mjs` | - |
| CAD-LAND-01 | skills/cad-land/SKILL.md | 32-54 | Step 1 runs `issue-check.mjs check` before any publish ask, on both step-3 arms, and on the `skip` action prints the envelope's `reason` verbatim as ONE line and carries on - never blocking, retrying, asking, or listing an issue the seam did not read. | accurate | filed with the code, v3.4.0 phase 1 (LND-01); the one-line degradation is proved per path by the 9-case matrix in `issue-check.test.mjs`, each asserting exit 0, `ok:true`, an empty issue list and a reason unique across the matrix | - |
| CAD-LAND-02 | skills/cad-land/SKILL.md | 55-56 | Landing closes no issue; closing one stays an explicit ask the user makes at publish time. | accurate | filed with the code, v3.4.0 phase 1 (LND-01); no argv in `lib/issue-decision.mjs`'s host table writes to a tracker, and the seam has one subcommand and no write path | - |
| SELFVERIFY-01 | cadence-core/bin/self-verify.mjs | 90-104 | Check 16 fails an `@`-included `cadence-core/references/*` or `cadence-core/templates/*` surface that no eager prose of the including command ever names, while `cadence-core/workflows/*` includes are exempt because the workflow IS the command's process. | accurate | accurate | 2 |
| ADOPT-01 | cadence-core/workflows/adopt.md | 5-7 | Adopt writes the same `.planning/` shape /cad-new-project writes - same files, same STATE cursor, same config | accurate | accurate | 2 |
| ADOPT-02 | cadence-core/workflows/adopt.md | 9-11, 274-277 | Everything is derived INLINE - no subagent is dispatched and no detector seam is added | accurate | accurate | 2 |
| ADOPT-03 | cadence-core/workflows/adopt.md | 21-27 | `git rev-parse --show-toplevel` must succeed AND equal the working directory | accurate | accurate | 2 |
| ADOPT-04 | cadence-core/workflows/adopt.md | 28-32 | `git rev-parse --git-dir` is NOT this check - it succeeds in any subdirectory of an enclosing repo | accurate | accurate | 2 |
| ADOPT-05 | cadence-core/workflows/adopt.md | 40, 47-48 | `planning.mjs trace ignore --root .` and it is the only thing in Cadence that writes the rule | accurate | accurate | 2 |
| ADOPT-06 | cadence-core/workflows/adopt.md | 49-51 | /cad-health reports `ignored:false` and `tracked:true` as separate issues with different remedies | accurate | accurate | 2 |
| ADOPT-07 | cadence-core/workflows/adopt.md | 50-51 | Append-if-absent, so a brownfield `.gitignore` keeps every line and a re-run adds no second line | accurate | accurate | 2 |
| ADOPT-08 | cadence-core/workflows/adopt.md | 41, 54 | The config template is copied VERBATIM from `cadence-core/templates/config.json`, and adopt asks no configuration questions - with ONE stated exception, the forge in item 4, because a forge is a precondition no template can default. | accurate | accurate | 2 |
| ADOPT-09 | cadence-core/workflows/adopt.md | 54-56 | "Config written with defaults (standard granularity, shipped stakes, research off, plan check and verifier on)" | stale | corrected - ee0199b - the same fix, byte-identical sentence in `adopt.md` | 2 |
| ADOPT-10 | cadence-core/workflows/adopt.md | 42-44 | The five keys read: `planning.commit_docs`, `granularity`, `git.protected_branches`, `git.on_protected`, `git.base_branch` | accurate | accurate | 2 |
| ADOPT-11 | cadence-core/workflows/adopt.md | 61-62 | `planning.mjs detect-commands` is neither required nor extended for this | accurate | accurate | 2 |
| ADOPT-12 | cadence-core/workflows/adopt.md | 135 | `cadence-core/templates/PROJECT.md` | accurate | accurate | 2 |
| ADOPT-13 | cadence-core/workflows/adopt.md | 149-155 | The `### Active` milestone version is never the repo's current tag, because /cad-health rule 7 reports drift when it is a member of `git tag --list` | accurate | accurate | 2 |
| ADOPT-14 | cadence-core/workflows/adopt.md | 159 | `cadence-core/templates/REQUIREMENTS.md` | accurate | accurate | 2 |
| ADOPT-15 | cadence-core/workflows/adopt.md | 162-164 | `## Active` bullets take the stated grammar `- **[CAT]-01**: [requirement]`, a 3-5 letter category code starting with a letter | accurate | accurate | 2 |
| ADOPT-16 | cadence-core/workflows/adopt.md | 170-172 | `## Traceability` is left as BARE HEADERS; `/cad-plan` seeds each row (`references/req-traceability.md`) | accurate | accurate | 2 |
| ADOPT-17 | cadence-core/workflows/adopt.md | 171-174 | `planning.mjs seed-reqs` reads `.planning/phases/<N>/PLAN*.md` and returns `no-phase-dir` / `no-plans` before any plan exists | accurate | accurate | 2 |
| ADOPT-18 | cadence-core/workflows/adopt.md | 179 | `cadence-core/templates/ROADMAP.md` | accurate | accurate | 2 |
| ADOPT-19 | cadence-core/workflows/adopt.md | 184-186 | /cad-health rule 5 flags an `- [x]` phase whose mapped REQUIREMENTS rows are not all `Complete` | accurate | accurate | 2 |
| ADOPT-20 | cadence-core/workflows/adopt.md | 186-187 | Seeded rows are always `Pending` | accurate | accurate | 2 |
| ADOPT-21 | cadence-core/workflows/adopt.md | 188-189 | Phase count follows `granularity`: coarse 3-5, standard 5-8, fine 8-12 | accurate | accurate | 2 |
| ADOPT-22 | cadence-core/workflows/adopt.md | 200-206 | `planning.mjs criteria-size --roadmap-min 2 --roadmap-max 5`, no `--phase`, `roadmap_found: false` is not zero | accurate | accurate | 2 |
| ADOPT-23 | cadence-core/workflows/adopt.md | 206-207 | A REPORT, not a gate, exactly as `plan-size`'s `phase-too-big` is | accurate | accurate | 2 |
| ADOPT-24 | cadence-core/workflows/adopt.md | 229-230 | `cursor set --phase 1 --status "ready to plan" --next "/cad-context 1"` | accurate | accurate | 2 |
| ADOPT-25 | cadence-core/workflows/adopt.md | 233-235 | A phase directory is `.planning/phases/<N>/` with a bare integer, created lazily | accurate | accurate | 2 |
| ADOPT-26 | cadence-core/workflows/adopt.md | 239-240 | `planning.commit_docs` false skips the commit step entirely | accurate | accurate | 2 |
| ADOPT-27 | cadence-core/workflows/adopt.md | 242 | The protected-branch guard is `references/git-guard.md` | accurate | accurate | 2 |
| ADOPT-28 | cadence-core/workflows/adopt.md | 247-251 | ONE commit staging exactly five files: PROJECT.md, REQUIREMENTS.md, ROADMAP.md, STATE.md, config.json | accurate | accurate | 2 |
| ADOPT-29 | cadence-core/workflows/adopt.md | 277-279 | Adopt REFUSES a non-repo-root and never runs `git init` | accurate | accurate | 2 |
| MINIMALISM-REVIEW-01 | cadence-core/workflows/minimalism-review.md | 10-13 | It reuses the review subsystem's `claude-subagent` backend (`references/review-triggers.md`) | accurate | accurate | 2 |
| MINIMALISM-REVIEW-02 | cadence-core/workflows/minimalism-review.md | 12-13, 124-126 | The list comes back in the findings schema every reviewer in the subsystem shares | accurate | accurate | 2 |
| MINIMALISM-REVIEW-03 | cadence-core/workflows/minimalism-review.md | 15-17, 122-123 | It never auto-fires - no entry in the wiring table, no `review.triggers` key, no gate | accurate | accurate | 2 |
| MINIMALISM-REVIEW-04 | cadence-core/workflows/minimalism-review.md | 28-29 | A phase target resolves to the committed range `.planning/phases/<N>/SUMMARY.md` records, as a `<base_ref>..<head_ref>` pair | accurate | accurate | 2 |
| MINIMALISM-REVIEW-05 | cadence-core/workflows/minimalism-review.md | 45-48 | `artifact` is the target as a REFERENCE, never its bytes (`references/seams.md`'s deferred-read rule) | accurate | accurate | 2 |
| MINIMALISM-REVIEW-06 | cadence-core/workflows/minimalism-review.md | 63-65 | `skills/cad-reviewer-contract` defaults to correctness and rules approach differences out of scope | accurate | accurate | 2 |
| MINIMALISM-REVIEW-07 | cadence-core/workflows/minimalism-review.md | 68-70 | `planning.mjs cursor get` supplies `<N>` for a path or directory target | accurate | accurate | 2 |
| MINIMALISM-REVIEW-08 | cadence-core/workflows/minimalism-review.md | 73 | `trace append --phase <N> --family lifecycle --event dispatch --plan cad-reviewer --role cad-reviewer --read "<ref>"` | accurate | accurate | 2 |
| MINIMALISM-REVIEW-09 | cadence-core/workflows/minimalism-review.md | 77-79 | No routing cell resolves a model for this arm - it is the base `cad-reviewer` at the session default, at every stakes level | accurate | accurate | 2 |
| MINIMALISM-REVIEW-10 | cadence-core/workflows/minimalism-review.md | 80-81 | There is no cross-model arm: a provider call needs a resolved tier and this pass owns no tier key | accurate | accurate | 2 |
| MINIMALISM-REVIEW-11 | cadence-core/workflows/minimalism-review.md | 85-89 | `trace close --phase <N> --plan cad-reviewer --role cad-reviewer --tokens <n> --turns <n>`, `--tokens` omitted on a figureless return | accurate | corrected - b118576 - claim re-stated to the live `trace close` flag list | 2 |
| MINIMALISM-REVIEW-12 | cadence-core/workflows/minimalism-review.md | 90-92 | Adding `--detail "<what failed>"` to that same line closes as a checkpoint | accurate | accurate | 2 |
| MINIMALISM-REVIEW-13 | cadence-core/workflows/minimalism-review.md | 99-100 | Severity ranks are `blocker`, `high`, `medium`, `low` | accurate | accurate | 2 |
| MINIMALISM-REVIEW-14 | cadence-core/workflows/minimalism-review.md | 100-101 | Each entry carries the reviewer's own `file`, `line`, `claim` and `failure_scenario` | accurate | accurate | 2 |
| MINIMALISM-REVIEW-15 | cadence-core/workflows/minimalism-review.md | 118-120 | The delete-list is input to the user's decision exactly as `references/triage-gate.md` treats review findings | accurate | accurate | 2 |
| MINIMALISM-REVIEW-16 | cadence-core/workflows/minimalism-review.md | 116-118, 149-150 | It applies NOTHING, so `git status --short` is byte-identical before and after a run | accurate | accurate | 2 |
| REPORT-01 | cadence-core/workflows/report.md | 3-5, 115-116 | Everything reported is drawn from `.planning/trace.jsonl` and the phase's own artifacts; no file is written | accurate | accurate | 2 |
| REPORT-02 | cadence-core/workflows/report.md | 11-13 | Neither a phase number nor `--all` means the STATE cursor's phase (`planning.mjs cursor get`) | accurate | accurate | 2 |
| REPORT-03 | cadence-core/workflows/report.md | 21 | `planning.mjs trace render [--phase <N>]` | accurate | accurate | 2 |
| REPORT-04 | cadence-core/workflows/report.md | 22 | `planning.mjs reads --join` | accurate | accurate | 2 |
| REPORT-05 | cadence-core/workflows/report.md | 25-31 | The render carries `brackets` (`role`, `plan`, `event`, `ms`, `tokens`, and `turns` where the close carried one), `outcomes`, `roles` (per-role dispatch, token and turn totals with `unrecorded` and `turns_unrecorded`), `coordinator`, `unpaired`, `mismatched`, `capped`, `malformed` | accurate | corrected - 8e2ee9f - claim rewritten to the keys the live render carries | 2 |
| REPORT-06 | cadence-core/workflows/report.md | 29-31 | Never ask for the raw `events` array - the flag re-buys 27 KB | unverifiable | divergence - run 2 half B inv 4: a past measurement with no artifact in this tree to re-derive it | 2 |
| REPORT-07 | cadence-core/workflows/report.md | 31-33 | `reads --join` reports `fileCalls`, `fileRedundancy`, `topFiles` over `.planning/reads.jsonl` | accurate | accurate | 2 |
| REPORT-08 | cadence-core/workflows/report.md | 33-34 | `--join` ties each record to the bracket that caused it: `joined`, `ambiguous`, `unjoined`, `floor`, `coordinator`, `unresolved` | accurate | accurate | 2 |
| REPORT-09 | cadence-core/workflows/report.md | 37-40 | `.planning/phases/<N>/SUMMARY.md`, `REVIEW-*.md` and `reports/plan-*.md` are the grounding artifacts, the last ONLY when SUMMARY is absent | accurate | accurate | 2 |
| REPORT-10 | cadence-core/workflows/report.md | 61-63 | A dispatch with no token figure reports `unrecorded`, never an estimate | accurate | accurate | 2 |
| REPORT-11 | cadence-core/workflows/report.md | 74-77 | An advisory fire records no tokens, because its reviewer closes its own bracket with no `--tokens` | accurate | accurate | 2 |
| REPORT-12 | cadence-core/workflows/report.md | 72-73 | A cross-model provider call records no tokens - no lifecycle bracket and no token field on that arm at all | accurate | accurate | 2 |
| REPORT-13 | cadence-core/workflows/report.md | 140-151 | The coordinator residue is `coordinator.residue_ms` and the `steps[]` row carrying the most of it, scoped to one RUN by `corr` rather than to a phase - each run's last marker closes at that run's own last event and no window spans two runs | accurate | accurate | 2 |
| REPORT-14 | cadence-core/workflows/report.md | 141-142 | The renderer computes it once so this line and `trace suggest` cannot disagree | accurate | accurate | 2 |
| REPORT-15 | cadence-core/workflows/report.md | 152-154 | Residue is TIME between worker brackets, never tokens; a marker carries no token figure | accurate | accurate | 2 |
| REPORT-16 | cadence-core/workflows/report.md | 75-79 | A `mismatched` entry names `corr`, `phase`, `plan`, `ts`, `dispatched` and `closed` | accurate | accurate | 2 |
| REPORT-17 | cadence-core/workflows/report.md | 79-80 | The tokens stay billed to the dispatch's role | accurate | accurate | 2 |
| REPORT-18 | cadence-core/workflows/report.md | 82-85 | `.planning/reads.jsonl` carries NO phase scoping - it is one file per project | accurate | accurate | 2 |
| REPORT-19 | cadence-core/workflows/report.md | 86-89 | `calls: 0` or the `no reads recorded yet` note means say nothing about reading | accurate | accurate | 2 |
| REPORT-20 | cadence-core/workflows/report.md | 93-95 | `floor` is a permanent LIMIT: `fork` and `general-purpose` are HOST agent types with no dispatch event to join to | accurate | accurate | 2 |
| REPORT-21 | cadence-core/workflows/report.md | 95-97 | `coordinator` reads have no worker bracket by construction and `unresolved` ones carried no readable agent | accurate | accurate | 2 |
| REPORT-22 | cadence-core/workflows/report.md | 101-102 | `--all` renders per-phase subtotals then one milestone line | unverifiable | divergence - run 2 half B inv 4: a prose rule for the model's own writing with no seam behind it | 2 |
| REPORT-23 | cadence-core/workflows/report.md | 106-107 | The closing pointer is `/cad-suggest`, whose rules live in `cadence-core/workflows/suggest.md` | accurate | accurate | 2 |
| SUGGEST-01 | cadence-core/workflows/suggest.md | 2-4 | `planning.mjs trace suggest` reads the joined trace and returns the retune the record supports | accurate | accurate | 2 |
| SUGGEST-02 | cadence-core/workflows/suggest.md | 8-11 | This file is the ONE statement of the presentation rules, and milestone.md's retune step and report.md's closing pointer both route here | accurate | accurate | 2 |
| SUGGEST-03 | cadence-core/workflows/suggest.md | 17-20 | A phase number becomes `--phase <N>`; no argument means the WHOLE record; those are the only two scopes | accurate | accurate | 2 |
| SUGGEST-04 | cadence-core/workflows/suggest.md | 20-22 | `trace suggest`'s contract row in `cadence-core/bin/self-verify.mjs` fixes its flag set at `--phase` alone | accurate | accurate | 2 |
| SUGGEST-05 | cadence-core/workflows/suggest.md | 22-23 | There is no correlation-id scoping to reach for | accurate | accurate | 2 |
| SUGGEST-06 | cadence-core/workflows/suggest.md | 26-28 | Nothing prunes `.planning/trace.jsonl` at a close, so an unscoped run spans every milestone still in the file | accurate | accurate | 2 |
| SUGGEST-07 | cadence-core/workflows/suggest.md | 35-43 | `planning.mjs trace suggest [--phase <N>]` returns `scope`, `events_read`, `suggestions`, and `capped` / `malformed` / `warnings` when any of the three is present | accurate | accurate | 2 |
| SUGGEST-08 | cadence-core/workflows/suggest.md | 51-67 | Every `kind: "suggest"` entry carries `subject`, `action`, `current`, `direction` and `evidence`, plus `proposed` where the seam priced a target | accurate | accurate | 2 |
| SUGGEST-09 | cadence-core/workflows/suggest.md | 74-76 | Every `kind: "info"` entry is one receipt line under a heading of its own below the tweak block, and asks for nothing | accurate | accurate | 2 |
| SUGGEST-10 | cadence-core/workflows/suggest.md | 82-85 | The per-role escalation evidence is denominated in `routing/resolve` events | accurate | accurate | 2 |
| SUGGEST-11 | cadence-core/workflows/suggest.md | 90-102 | The step ends by ASKING whether to run `/cad-config` with the `<key>=<value>` tokens the priced tweaks became, keeping the posture `cadence-core/references/triage-gate.md` holds review findings to: nothing is applied on the way to asking and an unanswered offer means no change | accurate | accurate | 2 |
| SUGGEST-12 | cadence-core/workflows/suggest.md | 103-106 | The write, on a yes, happens inside `/cad-config`, which takes `<key>=<value>` tokens directly; a user who would rather edit `.planning/config.json` by hand declines and does that | accurate | accurate | 2 |
| SUGGEST-13 | cadence-core/workflows/suggest.md | 110-117 | The envelope offers one discriminator, `events_read`, so the thin-record arm has exactly two lines to choose between | accurate | accurate | 2 |
| SUGGEST-14 | cadence-core/workflows/suggest.md | 119-121 | The envelope returns no floor figure | accurate | accurate | 2 |
| SUGGEST-15 | cadence-core/workflows/suggest.md | 139-140 | Name no config key that `cadence-core/config.schema.json` does not carry | accurate | accurate | 2 |
| SUGGEST-16 | cadence-core/workflows/suggest.md | 129-134 | This command writes nothing itself - no config file, not `.planning/config.json` and not the global layer - and on a yes to its offer the write is `/cad-config`'s | accurate | accurate | 2 |
| SUGGEST-17 | cadence-core/workflows/suggest.md | 135-136 | No subagent is dispatched; a suggestion cannot PASS or FAIL anything | accurate | accurate | 2 |
| README-52 | README.md | 71 | v2.2.0 deleted 2,251 lines of the shell tokenizer | accurate | accurate | 2 |
| README-53 | README.md | — | OpenAI and Gemini enforce the output schema themselves; DeepSeek has no server-side schema, so its adapter puts the schema in the prompt and asserts the returned shape | accurate | RETIRED - the DeepSeek-adapter sentence was cut when `## How it works` was compressed to its argument in v3.5.5 (phase 5, RME-01); `METHOD.md` carries the mechanism | 2 |
| README-54 | README.md | 73 | `METHOD.md`, `INTERNALS.md`, `docs/WORKFLOW.md` and `docs/EVIDENCE.md` all exist | accurate | accurate | 2 |
| README-55 | README.md | — | Routing is one question out and four knobs back - model, effort rung, review gates, deep verify | accurate | RETIRED - the routing parenthetical was cut when the pointer paragraph was compressed in v3.5.5 (phase 5, RME-01); `INTERNALS.md` and README's own `## What a break costs` state all four knobs | 2 |
| README-56 | README.md | 36 | `docs/WORKFLOW.md` is five figures and the four tables behind them | accurate | accurate | 2 |
| README-57 | README.md | 73 | `docs/EVIDENCE.md` defines the three weight terms and gives the `weight.mjs` commands | accurate | accurate | 2 |
| README-58 | README.md | 15 | `/plugin install cadence@cadence` names an existing marketplace and plugin | accurate | accurate | 2 |
| README-59 | README.md | 18 | `/plugin update cadence@cadence` and `/plugin uninstall cadence@cadence` | unverifiable | divergence - run 2 half A inv 1: a host command surface this repo neither defines nor constrains | 2 |
| README-60 | README.md | 18 | Requires `node` and `git` on PATH | accurate | accurate | 2 |
| README-61 | README.md | 85 | At `solo` the planner runs Sonnet at `high` | accurate | accurate | 2 |
| README-62 | README.md | 30 | At `shipped` the planner runs Opus | accurate | accurate | 2 |
| README-63 | README.md | 85 | The whole thing is `cadence-core/route-table.json` | accurate | accurate | 2 |
| README-64 | README.md | 89 | `model.escalate_on_failure` is off by default | accurate | accurate | 2 |
| README-65 | README.md | 102 | `review.triggers.risk_surface.surfaces` narrows the list, and leaving it unset keeps all eight | accurate | accurate | 2 |
| README-66 | README.md | 102 | The subset is populated from a structural scan of manifests and directories rather than keyword greps | accurate | accurate | 2 |
| README-67 | README.md | 104 | The list is checked against the diff itself, once per plan, on the completed commit range | accurate | accurate | 2 |
| README-68 | README.md | 106 | The dispatch-time file-NAME detector that raised a whole phase is gone as of v2.7.0 | accurate | accurate | 2 |
| README-69 | README.md | 30 | `/cad-adopt` is the second door into step 1 | accurate | accurate | 2 |
| README-70 | README.md | 32 | `/cad-new-project --brief <file>` | accurate | accurate | 2 |
| README-71 | README.md | 32 | `docs/DISCOVERY.md` | accurate | accurate | 2 |
| README-72 | README.md | 36 | `docs/WORKFLOW.md` carries the eighteen-cell stakes grid | accurate | accurate | 2 |
| README-73 | docs/EXAMPLE.md | 28-30 | `/cad-debug` runs hypotheses that survive a clear; `/cad-capture` parks a todo | accurate | accurate | 2 |
| README-74 | docs/EXAMPLE.md | 35-40 | `/cad-suggest` turns the milestone's trace into evidence-backed retune suggestions, each with its config key, the value in force, a direction and a target where one can be priced, and ends by offering to route the accepted tweaks to `/cad-config` rather than writing any itself | accurate | accurate | 2 |
| README-75 | docs/EXAMPLE.md | 32-34 | `/cad-milestone` audits, bumps the version, prunes the completed phases from the live roadmap and evolves the docs for the next cycle | accurate | accurate | 2 |
| README-76 | README.md | — | `/cad-help` prints the full reference and `/cad-help <name>` shows one entry | accurate | RETIRED - the `## The commands` intro line was cut in v3.5.5 (phase 5, RME-01); README.md:46 restates the `/cad-help` half in new words, which the next sweep extracts as its own row | 2 |
| README-77 | README.md | — | All 21 commands listed under Review & quality, Lifecycle & git and Support exist | accurate | RETIRED - `## The commands` was CUT in v3.5.5 (phase 5, RME-01); the 21 bullets this row counted no longer exist | 2 |
| README-78 | README.md | — | `/cad-capture --cadence` routes friction with Cadence to Cadence's own queue | accurate | RETIRED - the `/cad-capture` bullet was cut with `## The commands` in v3.5.5 (phase 5, RME-01); `cadence-core/references/COMMANDS.md` carries the entry | 2 |
| README-79 | docs/COST.md | 13-20 | Usage figures: 7,548 requests, 2,845 Cadence, ~92k/28c against ~133k/36c, 27% against 8% Sonnet-Haiku routing | unverifiable | divergence - run 2 half A inv 1: a measurement of the author's own account usage, not re-derivable here | 2 |
| README-80 | docs/COST.md | 33-36 | v2.3.0 turn-one figures: 231,422 to 199,687 B overall, `/cad-pause` 18,523 to 8,197, `/cad-land` 36,235 to 31,016 | unverifiable | divergence - run 2 half A inv 1: turn-one figures for a past release, not re-derivable from this tree | 2 |
| README-81 | docs/COST.md | 41 | `node cadence-core/bin/weight.mjs resident --root .` reports the current numbers | accurate | accurate | 2 |
| README-82 | docs/COST.md | 45-46 | A subagent's full output no longer stays resident: it writes a file and the parent keeps a five-field digest | accurate | accurate | 2 |
| README-83 | README.md | 112 | Today it is 27 skills | accurate | accurate | 2 |
| README-84 | README.md | 114 | `DESIGN.md`, `INTERNALS.md`, `LINEAGE.md` and `MANIFESTO.md` exist | accurate | accurate | 2 |
| METHOD-83 | METHOD.md | 52-54 | Action names symbols that already exist and never invents an identifier, signature or call path | accurate | accurate | 2 |
| METHOD-84 | METHOD.md | 55-57 | Verify is the task's authority: any implementation that satisfies it is authorized | accurate | accurate | 2 |
| METHOD-85 | METHOD.md | 93-96 | The checker checks six dimensions, and proportionality asks about `workflow.max_plan_tasks` | accurate | accurate | 2 |
| METHOD-86 | METHOD.md | 130-134 | A deviation is exactly one thing: an acceptance criterion or locked decision turned out wrong | accurate | accurate | 2 |
| METHOD-87 | METHOD.md | 157-158 | "Then check the staged diff against the risk-surface list before committing" | stale | corrected - 1b4086f - the staged-diff risk check removed from the Commit protocol | 2 |
| METHOD-88 | METHOD.md | 157-158 | Commit message shape `{type}({scope}): {description}` and a post-commit glance | accurate | accurate | 2 |
| METHOD-89 | METHOD.md | 229-231 | Anti-pattern scan covers TODO, FIXME, XXX, HACK, "placeholder", "not implemented", `todo!()` | accurate | accurate | 2 |
| METHOD-90 | METHOD.md | 233-235 | A `CADENCE-DEBT` marker is exempt because its ceiling and trigger fields ARE the reference | accurate | accurate | 2 |
| METHOD-91 | METHOD.md | 288 | `risk_surface` is fired by execute, debug, task and verify | accurate | accurate | 2 |
| METHOD-92 | METHOD.md | 291-292 | Exactly one of the four fires on its own at the default `shipped` level | accurate | accurate | 2 |
| METHOD-93 | METHOD.md | 309-310 | "a `plan` review is advisory at `solo` and `shipped` and adjudicated at `critical`" | stale | corrected - ffb16a4 - the sentence now names `off` at `shipped`, matching this document's own trigger table | 2 |
| METHOD-94 | METHOD.md | 309-310 | An ordinary `diff` is off at `solo` and `shipped`, and blocking at `critical` | accurate | accurate | 2 |
| METHOD-95 | METHOD.md | 310-311 | `risk_surface` is blocking at all three levels | accurate | accurate | 2 |
| METHOD-96 | METHOD.md | 311-314 | A gate typo loses to the level's gate and is named in the warnings | accurate | accurate | 2 |
| METHOD-97 | METHOD.md | 373-374 | "the plan review in `/cad-plan`, advisory at `shipped` and adjudicated at `critical`" | stale | corrected - ffb16a4 - the adjudicated-list clause now names `off` at `shipped` | 2 |
| METHOD-98 | METHOD.md | 374 | `/cad-execute`'s per-plan diff review is `off` below `critical` | accurate | accurate | 2 |
| METHOD-99 | METHOD.md | 375-379 | `/cad-land`'s unattended close fires no review of its own and halts on a surviving blocker or high | accurate | accurate | 2 |
| METHOD-100 | METHOD.md | 409-412 | The eight risk-detection categories named in prose | accurate | accurate | 2 |
| METHOD-101 | METHOD.md | 414-418 | It fires once, against the plan's completed commit range, never against a staged index mid-plan | accurate | accurate | 2 |
| METHOD-102 | METHOD.md | 518-530 | The debug loop is hypothesize / predict-and-test / record / branch, in a file that survives `/clear` | accurate | accurate | 2 |
| METHOD-103 | METHOD.md | 548-555 | The guard reads a command as `git` only in first-word position; wrapped or substituted invocations are invisible | accurate | accurate | 2 |
| METHOD-104 | METHOD.md | 540, 555, 648 | `references/git-guard.md` and `references/git-publish.md` both exist and rail 3 lists what the guard misses | accurate | accurate | 2 |
| METHOD-105 | METHOD.md | 564-565 | `worktree.baseRef` is the HOST's setting, which the parallel path requires at `head` | accurate | accurate | 2 |
| METHOD-106 | METHOD.md | 575-577 | `git.auto_close` runs audit through merge with no per-step prompts and halts on a surviving blocker or high | accurate | accurate | 2 |
| METHOD-107 | METHOD.md | 621-625 | The budget is a CEILING, not an equality | accurate | accurate | 2 |
| INTERNALS-38 | INTERNALS.md | 9 | Model is overridable at dispatch time; effort is frozen in the agent file's frontmatter | unverifiable | divergence - run 2 half A inv 1: a statement about the Claude Code host's own resolution order | 2 |
| INTERNALS-39 | INTERNALS.md | 11 | `cad-plan-checker-medium` and `cad-plan-checker-high` are the same contract at two depths | accurate | accurate | 2 |
| INTERNALS-40 | INTERNALS.md | 11 | `cadence-core/bin/lib/rung-agent.mjs` states the rung-to-file map per role | accurate | accurate | 2 |
| INTERNALS-41 | INTERNALS.md | 13 | `model.escalate_on_failure` is off by default and climbs a retry to the rung its cell names | accurate | accurate | 2 |
| INTERNALS-42 | INTERNALS.md | 17 | `route.mjs`, `route-table.json` (three grids, 18 cells), `lib/rung-agent.mjs`, `route.test.mjs` all exist | stale | corrected - RVW-03 (v3.5.4) - the sentence now reads "the five grids - the 18 cells, the review gates, the cross-model reviewer's tiers and efforts, the verify switch"; the four files it names all still exist | 2 |
| INTERNALS-43 | INTERNALS.md | 23-26 | `isPlainPush` was built and deleted; four adversarial rounds, four bypasses | accurate | accurate | 2 |
| INTERNALS-44 | INTERNALS.md | 27 | It refuses unless the repo opted into `auto_close` and HEAD is a non-protected branch | accurate | accurate | 2 |
| INTERNALS-45 | INTERNALS.md | 33 | The tokenizer was 2,251 lines with the tests | accurate | accurate | 2 |
| INTERNALS-46 | INTERNALS.md | 45 | Live detection asks OpenAI's models endpoint and Gemini's ListModels | accurate | accurate | 2 |
| INTERNALS-47 | INTERNALS.md | 49 | `references/model-hints.json` is the soft hint table and `references/provider-api.md` the wire shapes | accurate | accurate | 2 |
| INTERNALS-48 | INTERNALS.md | 55 | Cross-model reviewers are direct API calls, with OpenAI's Responses API `text.format` carrying a strict `json_schema` and Gemini's `responseSchema` | accurate | accurate | 2 |
| CONTRIBUTING-18 | CONTRIBUTING.md | 13 | Cadence has no build step and no runtime dependencies | accurate | accurate | 2 |
| CONTRIBUTING-19 | CONTRIBUTING.md | 13 | Nothing under `cadence-core/bin/` imports anything but `node:` builtins | accurate | accurate | 2 |
| CONTRIBUTING-20 | CONTRIBUTING.md | 13 | Running Cadence never installs a package | accurate | accurate | 2 |
| CONTRIBUTING-21 | CONTRIBUTING.md | 13 | CI installs both packages for one job with `npm install --no-save --no-package-lock typescript @types/node` before `npx tsc` | accurate | accurate | 2 |
| CONTRIBUTING-22 | CONTRIBUTING.md | 13 | `tsconfig.ci.json` sets `"types": ["node"]`, so a missing `@types/node` fails with `TS2688` | accurate | accurate | 2 |
| CONTRIBUTING-23 | CONTRIBUTING.md | 17 | `node cadence-core/bin/test.mjs routing` runs one group | accurate | accurate | 2 |
| CONTRIBUTING-24 | CONTRIBUTING.md | 18 | `node cadence-core/bin/test.mjs --list` lists the groups and what each owns | accurate | accurate | 2 |
| CONTRIBUTING-25 | CONTRIBUTING.md | 20 | `npx tsc -p tsconfig.ci.json` is checkJs over `cadence-core/bin` with tests excluded | accurate | accurate | 2 |
| AUDIT-34 | cadence-core/workflows/audit.md | 4-9 | The persisted status is the REQUIREMENTS traceability table plus the ROADMAP `## Phases` checkbox, and the audit never edits status | accurate | accurate | 2 |
| AUDIT-35 | cadence-core/workflows/audit.md | 24-41 | The line also carries `orphans.plan_ids`, `frontmatter_issues`, `unseeded`, `active_issues`, `nonconforming_plans`, `deferred` and `version_drift` | accurate | accurate | 2 |
| AUDIT-36 | cadence-core/workflows/audit.md | 31-35 | Only ids whose category is 2-8 chars of `[A-Z0-9]` holding at least one letter, or `#N`, are admitted to `unseeded`; `2FA-01` is admitted, `14-01` is not | accurate | accurate | 2 |
| AUDIT-37 | cadence-core/workflows/audit.md | 57-63 | The coverage arm returns `phases`, `breaks`, `untraced`, `legacy`, `unknown_criterion`, `context_issues` and `counts` | accurate | accurate | 2 |
| AUDIT-38 | cadence-core/workflows/audit.md | 104 | `--origin criterion` names no id and is not a repair | accurate | accurate | 2 |
| AUDIT-39 | cadence-core/workflows/audit.md | 105-113, 146-153 | `version_drift` moves the verdict to FAIL; it is not additive | accurate | accurate | 2 |
| AUDIT-40 | cadence-core/workflows/audit.md | 118-129 | PASS is zero broken and zero coverage `breaks`; FAIL on any break whatever its code | accurate | accurate | 2 |
| AUDIT-41 | cadence-core/workflows/audit.md | 131-144 | `frontmatter_issues`, `active_issues` and `nonconforming_plans` are additive and change neither counts nor verdict; `unseeded` is not additive | accurate | accurate | 2 |
| AUDIT-42 | cadence-core/workflows/audit.md | 132-133 | `references/plan-frontmatter.md` states per code which diagnostics drop payload | accurate | accurate | 2 |
| CONFIG-47 | cadence-core/workflows/config.md | 28-34 | Four sets stay edit-the-file-only: `review.providers.*`, the six `model.overrides` role pins, the six `model.effort` per-role rungs, and `review.decision_review`'s two keys | accurate | accurate | 2 |
| CONFIG-48 | cadence-core/workflows/config.md | 39-40 | The ask-user seam has a 4-option cap, which is why the walk pages 4 knobs per call | accurate | accurate | 2 |
| CONFIG-49 | cadence-core/workflows/config.md | 54-56, 68 | `references/config-catalog.md` carries the rows in walk order | accurate | accurate | 2 |
| CONFIG-50 | cadence-core/workflows/config.md | 73-76 | The catalog is deliberately transcribed, not derived from `config.mjs keys`, because the schema carries no per-value explanation field | accurate | accurate | 2 |
| CONFIG-51 | cadence-core/workflows/config.md | 84 | `config.mjs validate` asks whether the whole file is ok | accurate | accurate | 2 |
| CONFIG-52 | cadence-core/workflows/config.md | 85 | `config.mjs check <key=value>...` dry-runs pairs | accurate | accurate | 2 |
| CONFIG-53 | cadence-core/workflows/config.md | 86 | `config.mjs set <key=value>...` validates then writes atomically | accurate | accurate | 2 |
| CONFIG-54 | cadence-core/workflows/config.md | 87, 91 | `config.mjs get [key ...]` returns EFFECTIVE values, repo > global > defaults | accurate | accurate | 2 |
| CONFIG-55 | cadence-core/workflows/config.md | 88 | `config.mjs keys` dumps the schema | accurate | accurate | 2 |
| CONFIG-56 | cadence-core/workflows/config.md | 118-121 | Rejection contract is `{ok:false, reason:"invalid", detail:[...]}`, atomic, and success echoes `{ok:true, changed:[...]}` | accurate | accurate | 2 |
| CONFIG-57 | cadence-core/workflows/config.md | 139-145 | `worktree.baseRef`'s `"fresh"` default makes a worktree branch from the remote default branch, which is why `choose_path` refuses to parallelize there | accurate | accurate | 2 |
| CONFIG-58 | cadence-core/workflows/config.md | 147-152 | The step runs whenever `parallelization.use_worktrees` is true, without also requiring `parallelization.enabled` | accurate | accurate | 2 |
| CONFIG-59 | cadence-core/workflows/config.md | 177-182 | The assignment flow lives in `cadence-core/workflows/config-review.md` and rejoins at Wrap-up | accurate | accurate | 2 |
| CONFIG-60 | cadence-core/workflows/config.md | 192-198 | A trigger whose provider tier resolves to `null` silently falls back to `claude-subagent` | accurate | accurate | 2 |
| CONFIG-REVIEW-11 | cadence-core/workflows/config-review.md | 3-5, 84-87 | It is loaded from config.md on `--review` and rejoins config.md at Wrap-up | accurate | accurate | 2 |
| CONFIG-REVIEW-12 | cadence-core/workflows/config-review.md | 43-45 | `ok:true` carries `models[]` of `{id, tier, high_effort}` | accurate | accurate | 2 |
| CONFIG-REVIEW-13 | cadence-core/workflows/config-review.md | 38-39, 79-81 | `claude-subagent` is the always-available fallback, so a failed provider never blocks | accurate | accurate | 2 |
| CONFIG-REVIEW-14 | cadence-core/workflows/config-review.md | 80-82 | Assignment alone does not enrol a reviewer - the provider must be added to `review.reviewers` | accurate | accurate | 2 |
| CONTEXT-18 | cadence-core/workflows/context.md | 44-58 | Priors read: PROJECT.md, REQUIREMENTS.md, up to 3 prior CONTEXT.md files, and up to 3 prior SUMMARY `## Deviations` blocks | accurate | accurate | 2 |
| CONTEXT-19 | cadence-core/workflows/context.md | 55-58 | `workflows/report.md` already reads deviations out of SUMMARY for its `Refuted:` line | accurate | accurate | 2 |
| CONTEXT-20 | cadence-core/workflows/context.md | 73-78 | The spend gate is decided BEFORE `analyze`, because that step's `route.mjs resolve` writes the lifecycle dispatch half unconditionally | accurate | accurate | 2 |
| CONTEXT-21 | cadence-core/workflows/context.md | 96-103 | `planning.mjs recall "<terms>"` is the recall call, skipped entirely on `none` | accurate | accurate | 2 |
| CONTEXT-22 | cadence-core/workflows/context.md | 105-108 | `references/recall.md` is the one consult site for the result shape | accurate | accurate | 2 |
| CONTEXT-23 | cadence-core/workflows/context.md | 157-159 | The analyzer dispatch brackets on `--bracket-read ".planning/ROADMAP.md"` | accurate | accurate | 2 |
| CONTEXT-24 | cadence-core/workflows/context.md | 191-196 | The analyzer returns `assumptions[]` with area, statement, evidence, if-wrong, confidence and alternatives, plus `needs_research[]` | accurate | accurate | 2 |
| CONTEXT-25 | cadence-core/workflows/context.md | 206-211 | Unclear items are batched `ceil(N/4)` per `AskUserQuestion` call, up to four questions per call | accurate | accurate | 2 |
| CONTEXT-26 | cadence-core/workflows/context.md | 291-295 | Each criterion carries a phase-local `AC<N>` id, never phase-prefixed, never renumbered | accurate | accurate | 2 |
| CONTEXT-27 | cadence-core/workflows/context.md | 257-270 | The durability filter is prose judgment with no scoring seam | accurate | accurate | 2 |
| CONTEXT-28 | cadence-core/workflows/context.md | 340-342 | `templates/CONTEXT.md` has five sections | accurate | accurate | 2 |
| CONTEXT-29 | cadence-core/workflows/context.md | 352-359 | `planning.mjs criteria-size --phase {N} --context-min 3 --context-max 7`, reporting `over` entries and `context_found: false` | accurate | accurate | 2 |
| CONTEXT-30 | cadence-core/workflows/context.md | 371-378 | The commit is gated on `planning.commit_docs` and applies `references/git-guard.md` rail 1 | accurate | accurate | 2 |
| COVERAGE-09 | cadence-core/workflows/coverage.md | 6-8 | The definition of Covered is a test whose failure would signal the requirement regressed | accurate | accurate | 2 |
| COVERAGE-10 | cadence-core/workflows/coverage.md | 32 | `git diff <phase-start>..<phase-end> --stat` is the implementation read | accurate | accurate | 2 |
| COVERAGE-11 | cadence-core/workflows/coverage.md | 64-67 | A red test is never committed as coverage; the failure goes to `/cad-debug` | accurate | accurate | 2 |
| COVERAGE-12 | cadence-core/workflows/coverage.md | 47-52 | The approval gate precedes any test being written | accurate | accurate | 2 |
| COVERAGE-13 | cadence-core/workflows/coverage.md | 48-49 | Test kind is chosen from what the code is rather than from a default | unverifiable | divergence - run 2 half A inv 2: a prose nudge with no seam behind it | 2 |
| DEBUG-11 | cadence-core/workflows/debug.md | 12-29 | The schema carries Status, Slug, Attempts, Symptom, Hypotheses, Observations, Resolution | accurate | accurate | 2 |
| DEBUG-12 | cadence-core/workflows/debug.md | 33-37 | `list` greps `^# debug:\|^Status:` across `.planning/debug/*.md` in one pass | accurate | accurate | 2 |
| DEBUG-13 | cadence-core/workflows/debug.md | 125-127 | `review.consult.attempt_threshold` defaults to 3 | accurate | accurate | 2 |
| DEBUG-14 | cadence-core/workflows/debug.md | 69-73 | `references/bug-patterns.md` is read FIRST, before any candidate is written | accurate | accurate | 2 |
| DEBUG-15 | cadence-core/workflows/debug.md | 79-88 | Recall runs inline via `planning.mjs recall "<terms>"` when the backend is `builtin`, and is skipped entirely on `none` | accurate | accurate | 2 |
| DEBUG-16 | cadence-core/workflows/debug.md | 88-91 | `references/recall.md` is the one consult site for the result shape | accurate | accurate | 2 |
| DEBUG-17 | cadence-core/workflows/debug.md | 73-76 | 2-5 candidate causes, ranked most-likely-first but tested risk-first | accurate | accurate | 2 |
| DEBUG-18 | cadence-core/workflows/debug.md | 109-113 | A fix touching a risk surface fires the `risk_surface` trigger as shape (b), the reviewer running `git diff --cached` in its inherited cwd | accurate | accurate | 2 |
| DEBUG-19 | cadence-core/workflows/debug.md | 132-134 | The consult thresholds are Attempts >= T, test still red after T iterations, exhausted hypotheses | accurate | accurate | 2 |
| DEBUG-20 | cadence-core/workflows/debug.md | 146-147 | Single pass, no automatic retry loops | accurate | accurate | 2 |
| DECISION-REVIEW-12 | cadence-core/workflows/decision-review.md | 5-6 | It reuses the review subsystem via `references/review-triggers.md` | accurate | accurate | 2 |
| DECISION-REVIEW-13 | cadence-core/workflows/decision-review.md | 51-53 | The claude-subagent arm brackets with `planning.mjs trace append --phase --family lifecycle --event dispatch --plan --role --read` | accurate | accurate | 2 |
| DECISION-REVIEW-14 | cadence-core/workflows/decision-review.md | 59-63, 66-68 | The close is `planning.mjs trace close --phase --plan --role --tokens --turns`, with `--detail-file` closing it as a checkpoint | accurate | corrected - b118576 - claim re-stated to the live `trace close` flag list | 2 |
| DECISION-REVIEW-15 | cadence-core/workflows/decision-review.md | 57-58 | `--tokens` is omitted on a figureless return, per seams.md's bracket rule | accurate | accurate | 2 |
| DECISION-REVIEW-16 | cadence-core/workflows/decision-review.md | 70-75 | The cross-model arm runs only when `review.reviewers` names the provider AND its `tiers[tier]` is a non-null model id | accurate | accurate | 2 |
| DECISION-REVIEW-17 | cadence-core/workflows/decision-review.md | 85-89 | Multiple reviewers dispatch CONCURRENTLY in one message | accurate | accurate | 2 |
| DECISION-REVIEW-18 | cadence-core/workflows/decision-review.md | 125-131 | Each objection is ruled exactly one of `survives`, `partial`, `refuted` | accurate | accurate | 2 |
| DECISION-REVIEW-19 | cadence-core/workflows/decision-review.md | 138-140, 181-182 | Cost is reported qualitatively, never as a token or dollar figure | accurate | accurate | 2 |
| DECISION-REVIEW-20 | cadence-core/workflows/decision-review.md | 162-165, 174-175 | The workflow edits no file, including the target decision doc | accurate | accurate | 2 |
| DOCS-VERIFY-05 | cadence-core/workflows/docs-verify.md | 16-21 | The claim classes are paths, commands, code symbols, config keys, env vars, structure/behavior, defaults, counts and version numbers | accurate | accurate | 2 |
| DOCS-VERIFY-06 | cadence-core/workflows/docs-verify.md | 25-27 | Checks are batched: path checks one pass, symbol greps in one message, cited-code reads one batch | accurate | accurate | 2 |
| DOCS-VERIFY-07 | cadence-core/workflows/docs-verify.md | 32-33 | Never run a destructive or state-changing command to verify one | accurate | accurate | 2 |
| DOCS-VERIFY-08 | cadence-core/workflows/docs-verify.md | 50-54 | It stops at the report and offers the follow-up through the ask-user seam without auto-applying | accurate | accurate | 2 |
| EXECUTE-31 | cadence-core/workflows/execute.md | 13-16 | `cycle: "none"` with an empty `phases[]` is a derived closed milestone and `current` is legitimately null | accurate | accurate | 2 |
| EXECUTE-32 | cadence-core/workflows/execute.md | 28-33 | One batched `config.mjs get` of `planning.commit_docs`, four `parallelization.*` keys, `git.protected_branches`, `git.on_protected`, `git.base_branch` | accurate | accurate | 2 |
| EXECUTE-33 | cadence-core/workflows/execute.md | 117-121 | Any `undeclared` or `frontmatter_issues` entry also forces sequential | accurate | accurate | 2 |
| EXECUTE-34 | cadence-core/workflows/execute.md | 132-136 | Under `baseRef: "fresh"` (the default, so an unset key counts) a worktree branches from the remote default branch | accurate | accurate | 2 |
| EXECUTE-35 | cadence-core/workflows/execute.md | 168-171 | The dispatch prompt hands over the resolve's `surfaces` verbatim, and says what `surfaces_answered: false` means | accurate | accurate | 2 |
| EXECUTE-36 | cadence-core/workflows/execute.md | 176-181 | The executor's standing rules are NOT restated, because `skills/cad-executor-contract/SKILL.md` carries them and every rung file preloads it | accurate | accurate | 2 |
| EXECUTE-37 | cadence-core/workflows/execute.md | 213 | `trace render` reports a worker with no close as unpaired | accurate | accurate | 2 |
| EXECUTE-38 | cadence-core/workflows/execute.md | 248-254 | `risk_surface` fires ONCE after each plan, on `git diff {pre-plan HEAD}..HEAD`, written to `<plandir>/reports/plan-<k>-risk.diff` as shape (c) | accurate | accurate | 2 |
| EXECUTE-39 | cadence-core/workflows/execute.md | 253-254 | The risk diff is transient: never staged, deleted once the trigger returns | accurate | accurate | 2 |
| EXECUTE-40 | cadence-core/workflows/execute.md | 270 | The `diff` trigger's default is `off` at `solo` and `shipped` | accurate | accurate | 2 |
| EXECUTE-41 | cadence-core/workflows/execute.md | 277-284 | At `advisory` the fire overlaps the next dispatch and persists findings at `.planning/phases/<N>/REVIEW-diff-plan-<k>.md` | accurate | accurate | 2 |
| EXECUTE-42 | cadence-core/workflows/execute.md | 305-309 | The structural checkpoint arm runs `offer_consult` per `references/consult.md` before the ask | accurate | accurate | 2 |
| EXECUTE-43 | cadence-core/workflows/execute.md | 318-321 | `references/worktree-executor.md` forbids `git merge`, `rebase`, `fetch` and `stash` outright | accurate | accurate | 2 |
| EXECUTE-44 | cadence-core/workflows/execute.md | 323-324 | Cadence issues no `git worktree add` of its own | accurate | accurate | 2 |
| EXECUTE-45 | cadence-core/workflows/execute.md | 345-349 | `references/execute-parallel.md` is the one consult site for the parallel path | accurate | accurate | 2 |
| EXECUTE-46 | cadence-core/workflows/execute.md | 383-388 | Open items are filed with `planning.mjs capture --kind todo --text-file <path> --phase <N>`, never `--text`, because `--text` would shell-expand a `$(...)` | accurate | accurate | 2 |
| EXECUTE-47 | cadence-core/workflows/execute.md | 411-420 | The docs commit is `docs(<N>): phase <N> summary`, gated on `planning.commit_docs`, and never stages a transient risk diff | accurate | accurate | 2 |
| MILESTONE-17 | cadence-core/workflows/milestone.md | 6-7, 68-72, 188-190 | The release tag is NOT cut here; `/cad-land` cuts it on the pulled base after the merge | accurate | accurate | 2 |
| MILESTONE-18 | cadence-core/workflows/milestone.md | 64-66 | The bump commit is `chore: bump manifest to <version> + changelog` | accurate | accurate | 2 |
| MILESTONE-19 | cadence-core/workflows/milestone.md | 76-86, 163-165 | The carry-forward unions `.planning/phases/*/REVIEW-risk_surface*.md` into `.planning/REVIEW-risk_surface-<label>.md`, transient and never staged | accurate | accurate | 2 |
| MILESTONE-20 | cadence-core/workflows/milestone.md | 96-98 | `planning.mjs milestone-prune --label <label> --mode <delete\|archive>` does the mechanical half | accurate | accurate | 2 |
| MILESTONE-21 | cadence-core/workflows/milestone.md | 92-94 | Requirements move from `## Active` and `## Traceability` into `## Shipped` rows carrying the label | accurate | accurate | 2 |
| MILESTONE-22 | cadence-core/workflows/milestone.md | 100-104 | `--mode delete` on a release, `--mode archive` on an untagged milestone, moving dirs to `_archive-<label>/` | accurate | accurate | 2 |
| MILESTONE-23 | cadence-core/workflows/milestone.md | 105-106 | `action:"skip"` means no checked phase existed | accurate | accurate | 2 |
| MILESTONE-24 | cadence-core/workflows/milestone.md | 110-112 | The prune commit is `chore: prune <label> completed phases`, not staging the carry-forward file | accurate | accurate | 2 |
| MILESTONE-25 | cadence-core/workflows/milestone.md | 155-157 | On `true` it chains `/cad-land` via the SlashCommand tool for PR -> merge -> tag -> reset | accurate | accurate | 2 |
| MILESTONE-26 | cadence-core/workflows/milestone.md | 157-161 | A surviving blocker/high `risk_surface` finding stops the chain before merge | accurate | accurate | 2 |
| MILESTONE-27 | cadence-core/workflows/milestone.md | 174-178 | Step 8 invokes `/cad-suggest` unscoped, with its rules in `cadence-core/workflows/suggest.md` | accurate | accurate | 2 |
| MILESTONE-28 | cadence-core/workflows/milestone.md | 180-182 | A failed or missing retune run degrades to a one-line note, never a halt | accurate | accurate | 2 |
| NEW-PROJECT-23 | cadence-core/workflows/new-project.md | 18-20 | `--research` forces the research pass on regardless of config, and `--brief <file>` carries a design brief | accurate | accurate | 2 |
| NEW-PROJECT-24 | cadence-core/workflows/new-project.md | 21 | `docs/DISCOVERY.md` describes how a user arrives with a brief | accurate | accurate | 2 |
| NEW-PROJECT-25 | cadence-core/workflows/new-project.md | 23-24 | A brief is `Read` WHOLE - no parser, no schema, no seam subcommand | accurate | accurate | 2 |
| NEW-PROJECT-26 | cadence-core/workflows/new-project.md | 50-51 | `trace ignore` is the only thing in Cadence that writes that ignore line | accurate | accurate | 2 |
| NEW-PROJECT-27 | cadence-core/workflows/new-project.md | 60-61 | "Config written with defaults (standard granularity, shipped stakes, research off, plan check and verifier on)" | stale | corrected - ee0199b - the sentence now reads research and plan check off, verifier on | 2 |
| NEW-PROJECT-28 | cadence-core/workflows/new-project.md | 174-176 | A repo with no commits (`git rev-parse HEAD` fails) skips the guard | accurate | accurate | 2 |
| NEW-PROJECT-29 | cadence-core/workflows/new-project.md | 212-213 | A wall-clock config key was its bound until v2.7.0, when it was deleted for claiming a control nothing could apply | accurate | accurate | 2 |
| NEW-PROJECT-30 | cadence-core/workflows/new-project.md | 213 | `workflow.research` default false | accurate | accurate | 2 |
| NEW-PROJECT-31 | cadence-core/workflows/new-project.md | 201, 217 | The pass writes `.planning/research/RESEARCH.md` | unverifiable | divergence - run 2 half B inv 3: written at runtime by a dispatched agent, no seam constrains the path | 2 |
| NEW-PROJECT-32 | cadence-core/workflows/new-project.md | 300 | `cadence-core/references/req-traceability.md` | accurate | accurate | 2 |
| NEW-PROJECT-33 | cadence-core/workflows/new-project.md | 305 | `planning.mjs criteria-size --roadmap-min 2 --roadmap-max 5` | accurate | accurate | 2 |
| NEW-PROJECT-34 | cadence-core/workflows/new-project.md | 308-309 | No `--phase`: one call walks every phase the roadmap declares | accurate | accurate | 2 |
| NEW-PROJECT-35 | cadence-core/workflows/new-project.md | 309-311 | `roadmap_found: false` is not zero criteria | accurate | accurate | 2 |
| NEW-PROJECT-36 | cadence-core/workflows/new-project.md | 311-312 | It is a REPORT, not a gate, exactly as `plan-size`'s `phase-too-big` is | accurate | accurate | 2 |
| NEW-PROJECT-37 | cadence-core/workflows/new-project.md | 152-181 | Every repository Cadence creates is PRIVATE on every provider and visibility is never asked, and `forge.mjs create` is never invoked without `--confirmed`, which is what the user's answer to the confirmation naming provider, owner, repository name and visibility buys. | accurate | filed with the code, v3.7.1 phase 1 (FRG-01); every `CREATE_TABLE` row is asserted to pin `--private` by `forge-decision.test.mjs`, the seam refuses an unconfirmed create in `forge.test.mjs`, and `prose-agreement.test.mjs` asserts the confirmation sits at an earlier offset than the one `forge.mjs create` invocation | - |
| PHASE-14 | cadence-core/workflows/phase.md | 17-18 | `add` re-writes the cursor via `cursor get` then `cursor set` | accurate | accurate | 2 |
| PHASE-15 | cadence-core/workflows/phase.md | 37-38 | It shifts every `Phase K` token and `phases/K/` path >= N in ROADMAP/REQUIREMENTS | accurate | accurate | 2 |
| PHASE-16 | cadence-core/workflows/phase.md | 33-34, 42-43 | `in_text_refs` are lowercase prose references the seam will NOT rewrite | accurate | accurate | 2 |
| PHASE-17 | cadence-core/workflows/phase.md | 52 | The remove arm reports `orphaned_reqs` | accurate | accurate | 2 |
| PLAN-GAPS-05 | cadence-core/workflows/plan-gaps.md | 3-4 | Loaded from plan.md when `--gaps` was passed | accurate | accurate | 2 |
| PLAN-GAPS-06 | cadence-core/workflows/plan-gaps.md | 5, 19 | Rejoin plan.md at `spawn_planner` with Mode: gaps | accurate | accurate | 2 |
| PLAN-GAPS-07 | cadence-core/workflows/plan-gaps.md | 20-22 | The planner's read list additionally includes `phases/<N>/UAT.md` plus the existing PLAN* and SUMMARY* files | accurate | accurate | 2 |
| PLAN-34 | cadence-core/workflows/plan.md | 2-5 | The pipeline is read goal -> spawn cad-planner -> optional cad-plan-checker gate -> fire the `plan` review trigger -> commit docs | accurate | accurate | 2 |
| PLAN-35 | cadence-core/workflows/plan.md | 24-25 | `--skip-check` skips the plan-checker gate even when `workflow.plan_check` is true | accurate | accurate | 2 |
| PLAN-36 | cadence-core/workflows/plan.md | 26-27 | `--inline` is honored only for small phases | accurate | accurate | 2 |
| PLAN-37 | cadence-core/workflows/plan.md | 44-45 | `planning.mjs plan-size --phase {N} --max-reqs 12 --max-tasks {n}` | accurate | accurate | 2 |
| PLAN-38 | cadence-core/workflows/plan.md | 48-49 | A `phase-too-big` entry in `over` means the phase names more requirements than one phase should carry | accurate | accurate | 2 |
| PLAN-39 | cadence-core/workflows/plan.md | 51-52 | `--max-reqs 12` is a fixed rail rather than a config key | accurate | accurate | 2 |
| PLAN-40 | cadence-core/workflows/plan.md | 54-56 | `requirements_found: false` is NOT zero - an unmeasured phase is never compared | accurate | accurate | 2 |
| PLAN-41 | cadence-core/workflows/plan.md | 99-102 | `--bracket-read` is ONE comma-separated value, never a repeated flag | accurate | accurate | 2 |
| PLAN-42 | cadence-core/workflows/plan.md | 103-104 | The resolve writes the lifecycle dispatch event itself; only the CLOSE stays in the workflow | accurate | accurate | 2 |
| PLAN-43 | cadence-core/workflows/plan.md | 218 | `parallelization.max_concurrent_agents` bounds concurrent phases | accurate | accurate | 2 |
| PLAN-44 | cadence-core/workflows/plan.md | 242-243 | A second `plan-size --phase {N} --max-tasks {n}` runs after `handle_return` | accurate | accurate | 2 |
| PLAN-45 | cadence-core/workflows/plan.md | 246 | `plan-too-many-tasks` names the PLAN file and both numbers | accurate | accurate | 2 |
| PLAN-46 | cadence-core/workflows/plan.md | 304-305 | `cadence-core/references/plan-revision.md` is the one consult site for the BLOCKER arm | accurate | accurate | 2 |
| PLAN-47 | cadence-core/workflows/plan.md | 312-315 | The `plan` trigger's payload is the PLAN file(s) plus ROADMAP, REQUIREMENTS and CONTEXT | accurate | accurate | 2 |
| PLAN-48 | cadence-core/workflows/plan.md | 317-319 | All four ride the fire's `--read` bracket list (review-triggers.md step 4) | accurate | accurate | 2 |
| PLAN-49 | cadence-core/workflows/plan.md | 336 | "the same overlap the per-plan `diff` review runs at advisory" | stale | corrected - 813f468 - the false `diff`-at-advisory comparand dropped from the advisory bullet | 2 |
| PLAN-50 | cadence-core/workflows/plan.md | 341-345 | The advisory tail writes findings to `.planning/phases/<N>/REVIEW-plan.md` and the reviewer closes its own bracket | accurate | accurate | 2 |
| PLAN-51 | cadence-core/workflows/plan.md | 350-355 | Adjudicated survivors are a numbered list the user triages, NONE the default, per `references/triage-gate.md` | accurate | accurate | 2 |
| PLAN-52 | cadence-core/workflows/plan.md | 375 | `cursor set` derives name/total from ROADMAP and stamps the date | accurate | accurate | 2 |
| PLAN-53 | cadence-core/workflows/plan.md | 376-379 | `seed-reqs` inserts a three-cell Traceability row (id / `Phase {N}` / `Pending`) for declared ids that also have an `## Active` bullet, and is idempotent | accurate | accurate | 2 |
| PLAN-54 | cadence-core/workflows/plan.md | 379-380 | `orphan_ids` reports a declared id with no `## Active` bullet | accurate | accurate | 2 |
| PLAN-55 | cadence-core/workflows/plan.md | 380-383 | `no_active_section: true` is a DIFFERENT report - the `## Active` section itself is absent | accurate | accurate | 2 |
| PLAN-56 | cadence-core/workflows/plan.md | 384-385 | Status is always `Pending`; cad-verify remains the only writer of any other status | accurate | accurate | 2 |
| PLAN-57 | cadence-core/workflows/plan.md | 385-386 | `ok:false` is reported and the workflow CONTINUES - seeding is not a gate | accurate | accurate | 2 |
| PROGRESS-21 | cadence-core/workflows/progress.md | 3-5 | The derivation is the planning seam's `status` subcommand; the STATE.md cursor is only a hint | accurate | accurate | 2 |
| PROGRESS-22 | cadence-core/workflows/progress.md | 13 | `--stats` and `--trace` | accurate | accurate | 2 |
| PROGRESS-23 | cadence-core/workflows/progress.md | 30-31 | The phase-list grammar is `cadence-core/references/roadmap-phases.md` | accurate | accurate | 2 |
| PROGRESS-24 | cadence-core/workflows/progress.md | 36-37 | `phase-dir` is a `phases/<N>/` dir surviving a milestone close | accurate | accurate | 2 |
| PROGRESS-25 | cadence-core/workflows/progress.md | 37 | `phase-dir-grammar` is a `phases/` entry outside the directory grammar | accurate | accurate | 2 |
| PROGRESS-26 | cadence-core/workflows/progress.md | 64 | A `paused` cursor always agrees - leave it | accurate | accurate | 2 |
| PROGRESS-27 | cadence-core/workflows/progress.md | 72-74 | cad-verify is the only writer of a ROADMAP checkbox or a Traceability Status beyond `Pending` | accurate | accurate | 2 |
| PROGRESS-28 | cadence-core/workflows/progress.md | 99-101 | The `--trace` counts span the events the phase filter admitted; the filter reads `phase` alone and never `corr`, so they can cover several runs of the same phase number | accurate | corrected - 059493f - claim rewritten; the one-corr claim is falsified by the 12 distinct `corr` ids `trace render --phase 1` returns on this repo | 2 |
| PROGRESS-29 | cadence-core/workflows/progress.md | 107-109 | An absent token total is printed as `unrecorded`, never as `0` | accurate | accurate | 2 |
| PROGRESS-30 | cadence-core/workflows/progress.md | 173-175 | The trace file is written by the seams and by the context, plan, execute, verify and verify-deep workflows plus the reviewer bracket - never by progress | accurate | accurate | 2 |
| SPIKE-03 | cadence-core/workflows/spike.md | 12-16 | Criteria are written as Given/When/Then with an OBSERVABLE outcome | unverifiable | divergence - run 2 half B inv 3: a prose rule for the model's own writing with no seam behind it | 2 |
| SPIKE-04 | cadence-core/workflows/spike.md | 19-21 | The criteria file is `.planning/spikes/<slug>/SPIKE.md`, written before the experiment exists | unverifiable | divergence - run 2 half B inv 3: a prose rule for the model's own writing with no seam behind it | 2 |
| SPIKE-05 | cadence-core/workflows/spike.md | 30-32 | Throwaway code goes in `.planning/spikes/<slug>/` or a temp dir, NOT the project's real source | unverifiable | divergence - run 2 half B inv 3: a prose rule for the model's own writing with no seam behind it | 2 |
| SPIKE-06 | cadence-core/workflows/spike.md | 37-42 | The verdict vocabulary is `validated` / `invalidated` / `inconclusive` | accurate | accurate | 2 |
| SPIKE-07 | cadence-core/workflows/spike.md | 20-21, 45-46 | Step 6 completes the SAME file step 2 began, in place | accurate | accurate | 2 |
| TASK-12 | cadence-core/workflows/task.md | 6-7, 16 | `--plan` opts into a written PLAN.md | accurate | accurate | 2 |
| TASK-13 | cadence-core/workflows/task.md | 78-80 | The `risk_surface` fire uses shape (c), the flagged-diff FILE path, because shape (a) refs is not one of the shapes the wiring table admits for `risk_surface` | accurate | accurate | 2 |
| TASK-14 | cadence-core/workflows/task.md | 80-82 | That file is transient exactly like `execute.md`'s `plan-<k>-risk-task-<n>.diff` | accurate | accurate | 2 |
| TASK-15 | cadence-core/workflows/task.md | 85-88 | `planned_path` step 1 is the only writer of `.planning/tasks/{slug}/` | accurate | accurate | 2 |
| TASK-16 | cadence-core/workflows/task.md | 100-101 | `Zero planning artifacts for inline tasks` is this workflow's own success criterion | accurate | accurate | 2 |
| TASK-17 | cadence-core/workflows/task.md | 125-129 | The inline arm makes this run's own directory with `mktemp -d` and writes the diff to `$D/cadence-risk-task-{slug}.diff` - still shape (c), which since v2.6.1 admits a flagged-diff file however it was produced | accurate | accurate | 2 |
| UNDO-09 | cadence-core/workflows/undo.md | 10-12 | Fallback is `git log` filtered to the phase's conventional-commit scope, SHOWN before it is trusted | accurate | accurate | 2 |
| UNDO-10 | cadence-core/workflows/undo.md | 30-32 | Only the protected-branch check applies; a recovery revert does not open an integration branch | accurate | accurate | 2 |
| UNDO-11 | cadence-core/workflows/undo.md | 32-33 | The `--no-commit` form writes no commit, so it skips the guard | accurate | accurate | 2 |
| UNDO-12 | cadence-core/workflows/undo.md | 59 | Never auto-push the reverts - publishing is /cad-land's call | accurate | accurate | 2 |
| VERIFY-DEEP-13 | cadence-core/workflows/verify-deep.md | 3-4 | Loaded from verify.md `deep_check` when it actually runs; return to verify.md `walk` afterward | accurate | accurate | 2 |
| VERIFY-DEEP-14 | cadence-core/workflows/verify-deep.md | 7-8 | The bracket rides the resolve as `--bracket-read "<csv>"` | accurate | accurate | 2 |
| VERIFY-DEEP-15 | cadence-core/workflows/verify-deep.md | 24 | OMIT `--tokens` on a figureless return (seams.md's bracket rule) | accurate | accurate | 2 |
| VERIFY-DEEP-16 | cadence-core/workflows/verify-deep.md | 46-47 | Failed items route through verify.md `route_failures` exactly like user-reported failures | accurate | accurate | 2 |
| VERIFY-DEEP-17 | cadence-core/workflows/verify-deep.md | 57-58 | The seam overwrites its own file on every successful merge, which is why the verifier's may not carry that name | accurate | accurate | 2 |
| VERIFY-DEEP-18 | cadence-core/workflows/verify-deep.md | 64-67 | The bracket is closed in `dispatch` and `fall_through` has no close of its own, so a merge that fails after a usable return cannot close twice | accurate | accurate | 2 |
| VERIFY-45 | cadence-core/workflows/verify.md | 5-6 | All checklist persistence goes through the planning seam's `uat` subcommands | accurate | accurate | 2 |
| VERIFY-46 | cadence-core/workflows/verify.md | 33 | An existing checklist announces progress from `counts` | accurate | accurate | 2 |
| VERIFY-47 | cadence-core/workflows/verify.md | 73-75 | An item from the PLAN+ROADMAP fallback or a SUMMARY-derived deliverable sends neither field and reports as untraced without moving the verdict | accurate | accurate | 2 |
| VERIFY-48 | cadence-core/workflows/verify.md | 190-192 | The results table format is the four columns `#` / Item / Result / Evidence | accurate | accurate | 2 |
| VERIFY-49 | cadence-core/workflows/verify.md | 216-219 | The result vocabulary is pass / skipped / blocked / fail (plus pending) | accurate | accurate | 2 |
| VERIFY-50 | cadence-core/workflows/verify.md | 212, 221-223 | Severity inference defaults to major, and severity is never asked | unverifiable | divergence - run 2 half B inv 3: a prose rule for the model's own writing with no seam behind it | 2 |
| VERIFY-51 | cadence-core/workflows/verify.md | 248-253 | A diagnosis second opinion goes through `references/review-triggers.md`, artifact = the failed item's cited file PATHS, shape (c) | accurate | accurate | 2 |
| VERIFY-52 | cadence-core/workflows/verify.md | 253-255 | That fire names no wiring-table trigger, so it has no resolved gate | accurate | accurate | 2 |
| VERIFY-53 | cadence-core/workflows/verify.md | 255-258 | Its survivors are a numbered list the user triages, NONE the default, per a RE-READ of `references/triage-gate.md` | accurate | accurate | 2 |
| VERIFY-54 | cadence-core/workflows/verify.md | 263-268 | The Apply-now commit fires `risk_surface` with the staged-diff scope, shape (b): the reviewer re-runs `git diff --cached` in the cwd it inherits | accurate | accurate | 2 |
| VERIFY-55 | cadence-core/workflows/verify.md | 309 | On a partial session, do neither | accurate | accurate | 2 |
| VERIFY-56 | cadence-core/workflows/verify.md | 311 | `planning.commit_docs` (`config.mjs get planning.commit_docs`) gates the docs commit | accurate | accurate | 2 |
| VERIFY-57 | cadence-core/workflows/verify.md | 323 | The Reworked count is items that failed first pass then were fixed | accurate | accurate | 2 |
| VERIFY-58 | cadence-core/workflows/verify.md | 336-339 | A pass may come from `source: model` with the command and output cited on the item | accurate | accurate | 2 |
| VERIFY-59 | cadence-core/workflows/verify.md | 297-298, 346-348 | Row creation at `Pending` is `/cad-plan`'s seeding step, not this one | accurate | accurate | 2 |
| VERIFY-SWEEP-07 | cadence-core/workflows/verify-sweep.md | 20-22 | The `.planning/phases/<N>/UAT.md` paths are already known from the status output, so no read is serialized behind a prior result | accurate | accurate | 2 |
| CONFIG-CATALOG-01 | cadence-core/references/config-catalog.md | 3-5 | Read at walk step 2 of `cadence-core/workflows/config.md`'s Interactive menu, which pages through the rows 4 knobs at a time | accurate | accurate | 2 |
| CONFIG-CATALOG-02 | cadence-core/references/config-catalog.md | 5-7 | The source of truth is `cadence-core/config.schema.json`, enforced by the `bin/config.mjs` seam | accurate | accurate | 2 |
| CONFIG-CATALOG-03 | cadence-core/references/config-catalog.md | 11-13 | `[global]` means the user-global layer only, and a repo layer setting it is stripped at the merge and named in the read face's warnings | accurate | accurate | 2 |
| CONFIG-CATALOG-04 | cadence-core/references/config-catalog.md | 32 | `workflow.lint_command` `[global]`, LINT only - there is no typecheck key | accurate | accurate | 2 |
| CONFIG-CATALOG-05 | cadence-core/references/config-catalog.md | 46 | `git.auto_close` carries no `[src]` marker | accurate | accurate | 2 |
| CONFIG-CATALOG-06 | cadence-core/references/config-catalog.md | 46 | `git.auto_close` halts on a surviving blocker/high `risk_surface` finding | accurate | accurate | 2 |
| CONFIG-CATALOG-07 | cadence-core/references/config-catalog.md | 51 | A `**Risk**` knob category exists | stale | corrected - fdb2d69 - the empty `**Risk**` category header deleted, no surviving row moved | 2 |
| CONFIG-CATALOG-08 | cadence-core/references/config-catalog.md | 61 | `review.triggers.<t>.gate` defaults: `adjudicated` for plan, `advisory` for diff/phase_diff, `blocking` for risk_surface | stale | corrected - v3.4.1 phase 1 | 2 |
| CONFIG-CATALOG-09 | cadence-core/references/config-catalog.md | 62 | `review.triggers.<t>.tier` default `flagship`, except `balanced` for diff - cross-model only | stale | corrected - RVW-03 (v3.5.4) - the schema default moved to the unset sentinel, and the Default cell now reads "unset→the stakes level decides, per trigger (`route.mjs resolve` answers it)"; the cross-model-only reach is unchanged | 2 |
| CONFIG-CATALOG-10 | cadence-core/references/config-catalog.md | 63 | `review.triggers.<t>.effort` default `high`, except `medium` for diff - cross-model only | stale | corrected - RVW-03 (v3.5.4) - the schema default moved to the unset sentinel, and the Default cell now reads "unset→the stakes level decides, per trigger (`route.mjs resolve` answers it)"; the cross-model-only reach is unchanged | 2 |
| CONFIG-CATALOG-11 | cadence-core/references/config-catalog.md | 64 | `review.triggers.risk_surface.surfaces` list(enum) over the eight surfaces, unset means all eight and the first fire asks once | accurate | accurate | 2 |
| CONFIG-CATALOG-12 | cadence-core/references/config-catalog.md | 68-69 | Every write goes through the Validation seam; a value outside its set is rejected, never written | accurate | accurate | 2 |
| RECALL-01 | cadence-core/references/recall.md | 3-6 | Two commands call `planning.mjs recall` - `/cad-context` at `analyze` and `/cad-debug` at Hypothesize - and the contract is stated here once instead of drifting in two workflows | stale | corrected - 75b1d28 - the opening paragraph now names all three callers and the step each calls recall at | 2 |
| RECALL-02 | cadence-core/references/recall.md | 11-14 | The `memory.backend` `builtin`/`none` gate is deliberately NOT here - it stays inline at every calling site | accurate | accurate | 2 |
| RECALL-03 | cadence-core/references/recall.md | 24-26 | `results` is ranked best first and BOUNDED - `--top N` returns at most N, default 5 | accurate | accurate | 2 |
| RECALL-04 | cadence-core/references/recall.md | 26-28 | `total` is how many matched, so a truncated answer reads as truncated | accurate | accurate | 2 |
| RECALL-05 | cadence-core/references/recall.md | 29-33 | Unbounded, a real query returned 72 results at 55.8 KB; the same query bounded is 953 B | unverifiable | divergence - run 2 half B inv 5: a past measurement with no artifact in this tree to re-derive it | 2 |
| RECALL-06 | cadence-core/references/recall.md | 37-39 | `phase` is OPTIONAL - a phaseless `CAPTURE.md` item omits it; never substitute a blank or an inferred number | accurate | accurate | 2 |
| RECALL-07 | cadence-core/references/recall.md | 43-46 | /cad-context renders the top results as a `<recalled_memory>` block placed right after `<search_terms>` | accurate | accurate | 2 |
| RECALL-08 | cadence-core/references/recall.md | 48-52 | Those snippets ride the DISPATCH PROMPT and never the `cad-assumptions-analyzer` definition | accurate | accurate | 2 |
| RECALL-09 | cadence-core/references/recall.md | 55-57 | /cad-debug has no block and no payload - there is no debug subagent | accurate | accurate | 2 |
| RECALL-10 | cadence-core/references/recall.md | 57-59 | /cad-debug folds matching past deviations and UAT findings into the Hypotheses list with `source` and `phase` | accurate | accurate | 2 |
| PLAN-REVISION-01 | cadence-core/references/plan-revision.md | 3-5 | Read at `<step name="check_gate">` in `cadence-core/workflows/plan.md`, on the one arm that reaches it - `## ISSUES FOUND` with at least one BLOCKER | accurate | accurate | 2 |
| PLAN-REVISION-02 | cadence-core/references/plan-revision.md | 5-6, 61-63 | ONE revision maximum, with step 3 enforcing the bound | accurate | accurate | 2 |
| PLAN-REVISION-03 | cadence-core/references/plan-revision.md | 8-11 | The re-dispatch is FRESH, never a resume, and the plan on disk preserves its grounding | accurate | accurate | 2 |
| PLAN-REVISION-04 | cadence-core/references/plan-revision.md | 14-16 | The bracket rides the `--attempt 2` resolve with the same read-set spawn_planner uses | accurate | accurate | 2 |
| PLAN-REVISION-05 | cadence-core/references/plan-revision.md | 23 | `trace close --phase <N> --plan cad-planner --role cad-planner --tokens <n> --turns <n>` closes it at the end of THIS step | accurate | corrected - b118576 - claim re-stated to the live `trace close` flag list | 2 |
| PLAN-REVISION-06 | cadence-core/references/plan-revision.md | 26-28, 54-55 | An empty or unmarked return carries `--detail` and the seam closes it as a checkpoint | accurate | accurate | 2 |
| PLAN-REVISION-07 | cadence-core/references/plan-revision.md | 29-31 | The narrowed checker re-dispatch uses `--bracket-read ".planning/phases/{N}/PLAN*.md"`, narrower than check_gate's | accurate | accurate | 2 |
| PLAN-REVISION-08 | cadence-core/references/plan-revision.md | 33-35 | Its artifact is the revision's own diff, `git diff -- .planning/phases/{N}/PLAN*.md` | accurate | accurate | 2 |
| PLAN-REVISION-09 | cadence-core/references/plan-revision.md | 38-40 | Measured, a full re-read was ten minutes to convert two blockers into one | unverifiable | divergence - run 2 half B inv 5: a past measurement with no artifact in this tree to re-derive it | 2 |
| PLAN-REVISION-10 | cadence-core/references/plan-revision.md | 52 | `trace close --phase <N> --plan cad-plan-checker --role cad-plan-checker --tokens <n> --turns <n>` | accurate | corrected - b118576 - claim re-stated to the live `trace close` flag list | 2 |
| PLAN-REVISION-11 | cadence-core/references/plan-revision.md | 57-60 | The per-file census asserts one `trace close` per dispatch moment, so folding these two into one close reddens the suite | accurate | accurate | 2 |
| PLAN-REVISION-12 | cadence-core/references/plan-revision.md | 44-46 | `plan.md`'s own `review` step is the full-artifact second opinion and fires AFTER this | accurate | accurate | 2 |
