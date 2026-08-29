---
phase: 2
plan: 2
requirements:
  - RSK-07
files:
  - cadence-core/bin/issue-filing.mjs
  - cadence-core/bin/issue-filing.test.mjs
  - cadence-core/bin/lib/why-record.mjs
  - cadence-core/bin/why-record.test.mjs
  - cadence-core/bin/lib/why-render.mjs
  - cadence-core/bin/why-render.test.mjs
  - cadence-core/bin/lib/filing-decision.mjs
  - cadence-core/references/triage-gate.md
  - cadence-core/references/review-record.md
  - cadence-core/bin/prose-agreement.test.mjs
  - cadence-core/bin/weight-budgets.json
  - cadence-core/bin/self-verify.test.mjs
---

# Phase 2: a confirmed finding can be recorded unfixed - Plan 2

**SEQUENTIAL: this plan runs AFTER plan 1.** Every task here corrects a consumer
of the record grammar plan 1 widens, and three of them cannot be written until
that grammar exists. Do not dispatch the two plans in parallel.

## Goal

The consumers plan 1's widened `survived` makes wrong are corrected: the filing
step stops offering to open issues for work that is already committed, `/cad-why`
stops rendering a fixed survivor and a confirmed-unfixed one identically, and the
four surfaces that state what `survived` means say one thing, with a test that
reddens if any one of them is edited apart from the others.

## Must be true when done

- `issue-filing unfixed` returns no entry carrying a `fix_commit`. Fed a payload
  reproducing the `medium survived HASFIX` entry in
  `.planning/_archive-v3.7.3/1/ADJUDICATION-risk_surface-plan-2.json`, it offers
  nothing for that entry, and it still offers every survived medium or low that
  carries no commit.
- `/cad-why`'s `review:` block shows two survivors on one commit differently
  when one carries a `fix_commit` and the other does not: a reader can tell
  which finding was fixed and which was confirmed and left standing.
- `lib/adjudication-record.mjs`, `lib/filing-decision.mjs`,
  `references/triage-gate.md` and `references/review-record.md` state the same
  meaning of `survived`, and a `prose-agreement.test.mjs` row goes red when any
  one of the four is edited apart from the others.
- `references/review-record.md` tells a coordinator how to compose a ruling for
  a finding it will not fix and for a finding the user overrode, so the
  reproduction closes at the step it was reported from.
- Every `ADJUDICATION-*.json` written before this phase still reads without a
  refusal through `deriveCounts` and `parseAdjudication` - the readers stay
  fail-soft over records earlier writers produced.

## Context

D-07 locks where the filing filter goes: `issue-filing.mjs`'s `cmdUnfixed`
filters the entries carrying a `fix_commit`, and `lib/filing-decision.mjs` keeps
its stated "TWO FIELDS DECIDE IT AND NOTHING ELSE" rule so a voluntary fix on a
medium can still cite its commit.
D-09 locks the `why` change: distinguish survivors by `fix_commit` presence
rather than leaving `why` untouched and recording the widened meaning in a
comment. Today every survivor `/cad-why` prints is a fixed blocker or high;
after plan 1 a confirmed-unfixed medium joins the same list.
D-05 locks the fourth prose surface: `references/review-record.md` changes
alongside the three the roadmap names, because it is the document the
COORDINATOR reads when composing the payload - the defect was reported from
exactly that step.
D-06 locks where the drift test lives: a row in
`cadence-core/bin/prose-agreement.test.mjs`, not a check in `self-verify.mjs`,
which records a standing decision against text scans over this reference family.
D-08 locks the read path: nothing new is applied when a stored record is read
back, so `parseAdjudication` gains a field and no rule.
Out of scope: a fourth `RULINGS` value and everything downstream of it, the
unknown-key typo guard, and `lib/adjudication-record.mjs` itself, which plan 1
owns.

## Tasks

### Task 1: `unfixed` stops offering findings whose fix is already committed

- **Files:** cadence-core/bin/issue-filing.mjs, cadence-core/bin/issue-filing.test.mjs, cadence-core/bin/self-verify.test.mjs
- **Action:** Start reading at `cmdUnfixed` in `issue-filing.mjs`, and at the
  `payloadFor` helper plus the rows under the `unfixed` heading in its test.

  In `cmdUnfixed`, remove from the selected set every entry carrying
  a `fix_commit` before the decline lookup is applied. The set
  `unfixedFindings` returns is "what this fire will not fix now", and after plan
  1 an entry can be in it and still name the commit that fixed it - a voluntary
  fix on a medium, which D-07 keeps legal. Opening a tracker issue asking the
  user about work that is already committed is the defect; one such entry exists
  on disk today, in
  `.planning/_archive-v3.7.3/1/ADJUDICATION-risk_surface-plan-2.json`.

  The filter lands HERE and not in `lib/filing-decision.mjs`. That module's
  header states its two-field rule as a property of its signature, and a third
  field read there would make the rule a sentence it no longer keeps.
  `cmdUnfixed` is already the face that adds the one live lookup on top of the
  pure selection, which is the same shape.

  Account for what was removed rather than dropping it silently: report the
  count on its own envelope key beside `already_declined`, so the three numbers
  a reader sees are the payload's unfixed set, how many of it were already fixed,
  and how many were already declined. Leave `raised` meaning what it means
  today - the size of the set `unfixedFindings` answered with - and leave
  `already_declined` counting declines alone, or two existing numbers change
  meaning to make room for a third.

  In the test file, the `payloadFor` helper attaches `fix_commit: 'a1b2c3d'` to
  every `survived` ruling, and every finding in the `FIVE` fixture is a medium or
  a low ruled `survived` - so under this filter those rows would report an empty
  answer and the file would be asserting the defect. Make the attachment
  conditional on blocker/high severity, which plan 1's record grammar now
  accepts, so the five remainder findings carry no commit and the existing
  counts stand. Then add the AC4 row: a payload whose one ruling reproduces the
  archived record's `medium survived HASFIX` entry - same severity, same ruling,
  a real `fix_commit` - comes back with that entry absent from `findings` and
  counted on the new key.

  `self-verify.test.mjs` is declared because `issue-filing.mjs` is a subject of
  the `self-verify-merge-layers` census, whose count moves only if a
  `mergeLayers` callsite is added or removed. This task adds none, so the count
  is expected to stand; re-pin it only if the check says otherwise.
- **Verify:** `node --test cadence-core/bin/issue-filing.test.mjs` passes,
  including a row where a survived medium carrying a fix commit is absent from
  `envelope.findings` while five survived medium/low findings carrying none are
  all present. `node cadence-core/bin/self-verify.mjs` reports no new problem.

### Task 2: A survivor carries whether it was fixed

- **Files:** cadence-core/bin/lib/why-record.mjs, cadence-core/bin/why-record.test.mjs
- **Action:** Start reading at `parseAdjudication` and the D-11 block comment
  above it.

  `parseAdjudication` builds each survivor from the stored entry's
  own fields and today has no way to say whether that entry named a fix commit.
  Add that fact to the survivor object it returns, read from the entry the same
  fail-soft way `counter_evidence` is read through `str` - an absent or blank
  value is the same answer as no value, and nothing here throws or refuses.

  This is a READER (D-08): it gains a field and no rule. A record written months
  ago by an earlier writer, where every `survived` entry named a commit, must
  still parse to exactly the survivors it parses to today with the new field
  simply carrying that commit. Say so in the D-11 block comment, which currently
  explains why this reader is fail-soft where `lib/adjudication-record.mjs` is
  fail-closed, and extend it to record that after this cycle a survivor with no
  commit is a legitimate stored state rather than a malformed entry.

  Nothing downstream needs a change to receive the field: `readAdjudications` in
  `lib/why-corpus.mjs` spreads the parsed record and `reviewFor` in `why.mjs`
  spreads each survivor, so both carry it through untouched. Do not edit either.
- **Verify:** `node --test cadence-core/bin/why-record.test.mjs` passes, with a
  row parsing one record holding two `survived` entries - one naming a fix
  commit, one naming none - and showing the two survivors differ on the new
  field while every other field they already carried is unchanged.

### Task 3: The renderer tells a fixed survivor from a confirmed-unfixed one

- **Files:** cadence-core/bin/lib/why-render.mjs, cadence-core/bin/why-render.test.mjs
- **Action:** Start reading at `findingLines` and the `fieldReview` doc comment
  beneath it.

  `findingLines` renders a survivor as a head line plus `claim:` and
  `failure_scenario:`, with `counter_evidence:` appended only when the record
  carried one. Two survivors on one commit that differ only in whether a fix
  landed therefore render identically, and after plan 1 that is a confirmed
  medium reading exactly like a fixed blocker beside it.

  Make the fix state visible on every survivor line, both for the survivor that
  names a commit and for the one that does not - an absent line is not a
  statement, and "this finding was confirmed and left standing" is the fact
  `/cad-why` exists to surface. The commit id itself belongs in the rendered
  output where one exists: a reader who wants to see the fix runs `git show` on
  it, which is the reason `lib/adjudication-record.mjs` validates the value at
  all. Follow the file's existing conventions - a `label: value` line under the
  head, and `quoted` doing the block wrapping - and do not change the head line's
  severity, location and record-name composition, which other rows pin.

  Extend the `fieldReview` doc comment, which states the three distinct answers
  the `review:` line gives, so it records this fourth distinction and why it is
  not a fourth answer: the count of survivors covering the commit is unchanged,
  and what changed is what each survivor line says about itself.
- **Verify:** `node --test cadence-core/bin/why-render.test.mjs` passes, with a
  row rendering two survivors on one commit - one carrying a fix commit, one
  carrying none - and asserting the two rendered blocks are not equal and that
  each names its own state. Separately, a `node -e` that reads every
  `ADJUDICATION-*.json` under `.planning/` (7 files today, including the four
  under `_archive-v3.7.3/`), runs `parseAdjudication` and `deriveCounts` over
  each, and prints the per-file `ok` flag and issue list, shows `ok: true` and no
  new issue code for all of them.

### Task 4: `filing-decision.mjs` and `triage-gate.md` state the widened meaning

- **Files:** cadence-core/bin/lib/filing-decision.mjs, cadence-core/references/triage-gate.md, cadence-core/bin/weight-budgets.json
- **Action:** Start reading at the `HALTING_SEVERITIES` and `unfixedFindings`
  doc comments in `filing-decision.mjs`, and at the `blocking` arm bullet plus
  the `unfixed` paragraph in `triage-gate.md`.

  Both documents already turn on the blocker/high pair and neither
  is wrong today, but neither states the half plan 1 made storable: that a
  `survived` finding below blocker/high is one that was CONFIRMED and not fixed,
  and that the record can now hold it. Write that sentence into both, in each
  file's own voice, using the same words `lib/adjudication-record.mjs`'s
  `RULINGS` comment now uses so the four surfaces agree on a phrase and not
  merely on a sentiment - Task 6's row keys on that agreement.

  In `lib/filing-decision.mjs`, change comments only. The two-field rule and
  `unfixedFindings`'s body stay exactly as they are (D-07): the entry `cmdUnfixed`
  now removes is still in this module's answer, because "the gate will not fix it
  now" and "somebody already did" are different questions and only the seam holds
  the second.

  In `references/triage-gate.md`, keep the file's stated discipline: it states
  the OBLIGATION plus the pointer and deliberately does not restate the record's
  mechanics, because "a copy here is a second statement that can drift". So the
  `blocking` arm's remainder sentence gains the fact that the remainder is now
  recordable as confirmed-and-unfixed, and the fix-commit mechanics stay in
  `references/review-record.md` where Task 5 puts them.

  Both reference files are budgeted prose surfaces pinned at their exact current
  byte counts, so any growth fails `self-verify.mjs`'s `budget-overrun` arm.
  Re-pin the affected keys in `cadence-core/bin/weight-budgets.json` in the same
  commit as the prose - that is what declaring the holder is for.
- **Verify:** `node cadence-core/bin/self-verify.mjs` reports no
  `budget-overrun` and no `unbudgeted-surface`. `node --test
  'cadence-core/bin/*.test.mjs'` is green, including the existing
  `prose-agreement.test.mjs` rows that already read `triage-gate.md`.

### Task 5: `review-record.md` tells a coordinator how to compose both cases

- **Files:** cadence-core/references/review-record.md,
  cadence-core/bin/weight-budgets.json
- **Action:** This is the file the coordinator reads when composing the payload,
  and its sentence "a `survived` one names the fix commit" is the instruction
  that produced the defect: followed literally, a coordinator either fabricates a
  commit or records a ruling it does not hold. Replace it with the severity-gated
  rule in the same words the other three surfaces now use - a `survived` blocker
  or high names its fix commit, and a `survived` finding below them is one the
  gate confirmed and moved past, carrying no commit.

  Add the override case beside it, since this is the only document that tells a
  coordinator what goes IN a ruling: a blocker or high the user overrode carries
  the boolean marker plan 1 added to the ruling grammar instead of a commit, and
  never a SHA invented to satisfy the field. Name the marker by the exact key
  plan 1 shipped - read it out of `RULING_KEYS` in
  `cadence-core/bin/lib/adjudication-record.mjs` rather than from this plan, so
  the document names what the code accepts. Point at
  `references/triage-gate.md`'s `override` settle point for where the user's own
  reason goes - it rides the receipt's `--detail-file` and is not duplicated
  onto the entry.

  Keep the paragraph's existing statement that there is no fourth `ruling`
  value: `RULINGS` stayed frozen at three (D-01, D-04) and that sentence is
  still true, so it must not be softened into implying otherwise.

  Re-pin this surface's key in `cadence-core/bin/weight-budgets.json` in the same
  commit.
- **Verify:** `node cadence-core/bin/self-verify.mjs` reports no
  `budget-overrun`. `grep -n` for the retired unconditional sentence in
  `cadence-core/references/review-record.md` returns nothing, and the file names
  the override marker with the same spelling `RULING_KEYS` carries. `node --test
  cadence-core/bin/prose-agreement.test.mjs` still passes its existing GAT-04
  row, which reads this file's fenced receipt blocks.

### Task 6: A drift row reddens when one surface is edited apart from the others

- **Files:** cadence-core/bin/prose-agreement.test.mjs
- **Action:** Add one row over the four surfaces AC5 names:
  `cadence-core/bin/lib/adjudication-record.mjs`,
  `cadence-core/bin/lib/filing-decision.mjs`,
  `cadence-core/references/triage-gate.md` and
  `cadence-core/references/review-record.md`. It belongs in this file rather
  than in `self-verify.mjs` (D-06): `self-verify.mjs:927` records a standing
  decision against text scans over this reference family, and check 14 does not
  reach `lib/adjudication-record.mjs` at all, which takes no CONTRACTS row and no
  CLI entry point.

  The property the row pins: each of the four states the severity-gated meaning
  of `survived`, and none of them still states the unconditional one. Assert it
  on the shared phrase Tasks 4 and 5 wrote and plan 1 originated - read the four
  files with the existing `doc` helper, collapse whitespace before matching so a
  wrapped line reads the same as a single-line one, and fail with a message
  naming WHICH file lost the agreement rather than "the four disagree", because
  the remedy is to edit one file and the reader has to be told which.

  Follow this file's own charter: one NAMED thing per row, never a document's
  shape, so a reformat that changed no fact leaves the row green. Head the row
  with the block comment convention its neighbours use - what drifted, what the
  consequence was, and what nothing else pins - naming the GH-159 report as the
  case where the coordinator followed `review-record.md` and got a refusal.
- **Verify:** `node --test cadence-core/bin/prose-agreement.test.mjs` passes.
  Then, once per surface: delete the severity qualification from that one file
  in the working tree, re-run the row, confirm it fails and that its message
  names that file, and revert. Four edits, four red runs, four reverts, then
  `node --test 'cadence-core/bin/*.test.mjs'` green on the restored tree.

## Notes

- The AC4 envelope gains one key. That was the planner's call: the alternatives
  were dropping the entries silently, which this seam's own header refuses on the
  filing side, or folding them into `already_declined`, which would make a
  tracker-derived number count something the tracker never said.
- CONTEXT's second flagged assumption is settled as a prose-agreement ROW, not a
  shared exported predicate. A predicate both modules import would reach
  `lib/filing-decision.mjs`, whose two-field purity D-07 exists to preserve, and
  `lib/adjudication-record.mjs` cannot import from it in either direction without
  a cycle.
- The plan touches `lib/why-render.mjs` where CONTEXT's plan-shape line said
  `why.mjs`. `why.mjs` holds the survivor-to-commit JOIN (`reviewFor`) and
  spreads each survivor through; the rendering `/cad-why` prints is
  `findingLines` and `fieldReview` in `lib/why-render.mjs`. `why.mjs` needs no
  edit and is not leased.
- `cadence-core/bin/self-verify.test.mjs` and
  `cadence-core/bin/weight-budgets.json` are leased because `censusesAtRisk`
  refuses this lease without them: `issue-filing.mjs` is a subject of the
  `self-verify-merge-layers` census and `cadence-core/references/` is a subject
  of the `weight-budgets` census. Verified by running `censusesAtRisk` over this
  plan's declared list on 2026-08-28.

### Open items from the `plan` review, unrecorded by design

Same fire, same reason PLAN-1's Notes state: the `plan` gate passed, and its
settle could not write the adjudication record because GH-159 refuses a
`survived` ruling carrying no fix commit. These three were confirmed against
the cited code and are not fixed by any task here.

- **The override case has no consumer** (medium). Plan 1 Task 2 creates a
  survived-and-unfixed blocker/high, and `unfixedFindings` excludes every
  survived blocker/high, so `issue-filing unfixed` returns `ok:true, raised:0`
  on a payload that is a loud refusal today. An overridden blocker would then
  be never fixed, never filed, never declined and never asked about - the
  collapse of "nothing to ask about" into "unreadable" that
  `lib/filing-decision.mjs:61-66` says must never happen. No AC covers it.
- **Task 4's `triage-gate.md` edit is scoped too narrowly** (medium). It
  rewrites the `blocking` arm's remainder sentence but leaves
  `references/triage-gate.md:275-281`, which enumerates the returned set, stating
  a membership rule Task 1 makes false: after Task 1 a survived `medium`
  carrying a voluntary `fix_commit` is also excluded, and that paragraph says
  only two things are. Task 6's drift row pins the meaning of `survived`, not
  this set statement, so nothing reddens.
- **AC7's second half is narrowed** (low). CONTEXT D-08 measured a 10-record
  corpus recovered from git history; `find .planning -name 'ADJUDICATION-*.json'`
  returns 7, and Task 3 covers only those 7 with `deriveCounts` +
  `parseAdjudication`. The 3 git-history-only records - written by the oldest
  writer versions, so the shapes most likely to differ - are read by no task,
  and `trace recount` (`planning/trace.mjs:1211`) is exercised only over records
  the new code just wrote.
