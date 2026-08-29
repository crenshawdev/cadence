---
phase: 1
plan: 2
requirements: [RSK-08]
files:
  - cadence-core/bin/trace.test.mjs
  - cadence-core/bin/plan-key.test.mjs
  - cadence-core/bin/risk-diff.test.mjs
  - cadence-core/bin/trace-suggest.test.mjs
---

# Phase 1: The record's guards hold for every ruling - Plan 2

## Goal

The first half of closing UAT item 3 (AC3): every shipped `trace append` arm
that settles a fire already carries a settled figure, so PLAN-3 can declare the
requirement against a tree that already obeys it.

## Must be true when done

- Each of the eleven shipped test arms that drive `trace append` with an
  `adjudication`, `gate_pass` or `override` event now passes at least one of
  `--survivors`, `--downgraded`, `--refuted`, or no longer names a settle event
  at all.
- Every one of those eleven arms still asserts exactly what it asserted before,
  including the arm whose whole point is that a receipt carrying NO settled
  figure writes none of those keys.
- `node cadence-core/bin/test.mjs` is green before this plan and after it: this
  plan changes no behaviour, it only stops four test files relying on a
  permission PLAN-3 removes.

## Context

The user has fixed the approach and it is not this plan's to re-open. The hole
closes at the CLI ARGUMENT-CONTRACT layer, never inside `overrideAccounted`:
`cadence-core/bin/planning/trace.mjs` is not edited by any task in either plan.
D-04 stands unamended - the SEAM keeps its event-agnostic property, and the
event-name knowledge lives at the argument door, where
`cadence-core/bin/planning/risk-check.mjs`'s `if (e.event === 'override')` arm
is the shipped precedent for event-name logic outside `trace.mjs`. D-15's
reasoning carries: the guard is unconditional on the paths that already exist,
so no opt-in flag is added. D-11 and D-06 hold: the ruling vocabulary and the
`overridden` grammar do not move.

Measured 2026-08-29 against a scratch copy of this tree carrying a prototype of
the constraint: the whole suite runs 3563 tests, and exactly 11 arms across the
four files below refuse that do not refuse today. THAT FIGURE IS A COUNT OF
FAILING ARMS, NOT OF FIGURELESS INVOCATIONS, and the two are not the same
number: `node:test` ends an arm at its first throw, so a second figureless
append later in the same arm is invisible to it, and an arm that ALREADY
asserts `ok:false` stays green under the prototype and never enters the count
at all. The task below is therefore bounded by an INVOCATION census, and the
eleven are where it starts rather than what it is. No workflow, skill, agent,
hook or reference prose is among them - the three fenced settle receipts
(`review-record.md`'s `adjudication`, `triage-gate.md`'s `gate_pass` and
`override`) each already spell all three figures.

## Tasks

### Task 1: Carry the settled figures on every shipped settle-receipt append

- **Files:** cadence-core/bin/trace.test.mjs (start at the `receipt` helper and
  at the `--raised`, settled-count and `--trigger` sections),
  cadence-core/bin/plan-key.test.mjs (start at the test named `risk-check
  status: a 1-fix bracket is satisfiable - record, then fire receipt`),
  cadence-core/bin/risk-diff.test.mjs (start at the test named `risk-check
  status: an explicit user OVERRIDE written through the seam clears the
  range`), cadence-core/bin/trace-suggest.test.mjs (start at the test named
  `seam: a real trace written through appendEvent reads back through \`trace
  suggest\``)
- **Action:** Eleven shipped arms drive `planning.mjs trace append` with a
  settle event and no settled figure, and every one of them refuses once
  PLAN-3's requirement lands. Bring them to the new shape FIRST, in a commit
  that is green before and after, so the constraint itself lands against a tree
  that already obeys it. The eleven, measured by running the whole suite
  against a prototype of the constraint: in `trace.test.mjs`, `seam: --raised
  rides an adjudication event as a NUMBER`, `seam: --raised 0 is a recorded
  figure, not an omission`, `seam: an append with no --raised is byte-identical
  to today's`, `seam: a settled count of 0 is a recorded figure, an absent one
  omits the key`, `seam: --trigger stores the review trigger an event belongs
  to, as a string`, `seam: --trigger is stored VERBATIM, trimmed, with no
  vocabulary of its own`, `seam: an append with no --trigger is byte-identical
  to today's` and `seam: --detail-file carries a detail no shell could expand`;
  plus the one named arm in each of the other three files. TWO of those are
  not one invocation each. `trace-suggest.test.mjs`'s arm spawns the same
  figureless `adjudication` append TWICE, at `:653` and `:655`, and the
  duplication is the point - `trace suggest` is being shown a REPEATED event -
  so both calls take the figures and neither is collapsed into the other.
  A NINTH ARM in `trace.test.mjs` is bound by this task and is absent from the
  eleven because it never failed: `seam: a malformed --raised appends NOTHING
  at all` drives figureless `adjudication` appends at `:1137` and `:1145` and
  asserts `ok:false` with `reason: 'bad-args'`, which is what PLAN-3's
  constraint returns too - so it stays green while silently ceasing to prove
  the `--raised` validation it exists for. Give its appends the settled
  figures, so the refusal it asserts is once again the one its name claims.
  PRESERVE WHAT EACH ARM PROVES, which is the whole constraint on how you fix
  them. Where the
  settle event is the arm's own SUBJECT - the `--raised` arms, whose point is
  that the figure rides an adjudication event - add the figures and leave the
  subject alone. Where the settle event is incidental scenery, either add the
  figures or move the call to an event this rule does not bind, `rearm` or
  `deferral`, and never soften an assertion to make it pass. One arm needs the
  second remedy rather than the first: `seam: a settled count of 0 is a
  recorded figure, an absent one omits the key` proves in its second half that
  a receipt carrying NO settled figure writes none of those keys, and adding a
  figure there would delete the property the arm exists for - that half belongs
  on an event the rule leaves unconstrained. Note that `receipt` in
  `trace.test.mjs` hard-codes `--event adjudication` for several callers, so it
  is the helper and not only the call sites that has to admit the change. Watch
  the two cross-artifact checks in the seam when you add figures: all THREE
  present engages `recountReceipt`, any ONE engages `overrideAccounted`, and
  both pass silently when no record exists for the fire - none of these four
  fixtures writes an `ADJUDICATION-*.json`, but a figure typed beside a record
  that DOES exist has to be that record's own count or the append refuses with
  `count-disagreement`. Change no assertion text, delete no arm, and add no new
  test here: this task carries existing arms across, and the arms that prove
  the new refusal are PLAN-3's second task.
- **Verify:** `node cadence-core/bin/test.mjs` reports 0 failures (3562 pass, 1
  skipped, exit 0), and the INVOCATION census is clean:
  `grep -n "'--event', '\(adjudication\|gate_pass\|override\)'"` over the four
  files, read call by call and not arm by arm, shows EVERY hit that is a
  `planning.mjs trace append` spawn either passing at least one of
  `--survivors`, `--downgraded`, `--refuted` in the same argument array or no
  longer naming a settle event at all - with no hit left over, including the
  second call in `trace-suggest.test.mjs` and both calls in `seam: a malformed
  --raised appends NOTHING at all`. A hit that builds a JSONL line directly
  rather than spawning the CLI (`risk-diff.test.mjs`'s `receiptLine`) is not an
  invocation and is out of scope - the door this constrains is the argument
  parser, which those never reach. Then re-run the whole suite against a
  scratch copy carrying the PLAN-3 prototype and confirm 0 failures, which is
  the check the failing-arm count could not perform on itself. Each migrated
  arm still asserts what it asserted before the task, checked arm by arm
  against `git diff`.

## Notes

- PLAN-2 and PLAN-3 are SEQUENTIAL, PLAN-2 first, and the order is the only one
  that keeps every commit green: this plan makes eleven shipped arms obey a
  rule that does not exist yet (a no-op against today's tree), and PLAN-3 lands
  the rule against a tree that already obeys it. Reversed, the suite is red
  between the two plans.
- They are two files rather than one because the single plan measured 811,001
  declared bytes against `workflow.max_plan_bytes` of 675,000. This half is
  379,295 (`trace.test.mjs` 194,034, `risk-diff.test.mjs` 102,647,
  `trace-suggest.test.mjs` 68,727, `plan-key.test.mjs` 13,887). The split is a
  redistribution of the same three tasks, not a re-plan; no task's text,
  verification or citation changed.
- `cadence-core/bin/trace.test.mjs` is declared by BOTH plans - the only shared
  path, and unavoidable in PLAN-3 for a reason of its own, stated there. It
  costs nothing: the two are sequential already.
- The breakage census was MEASURED, not read: a scratch copy of this tree with
  a prototype of the constraint wired at `planning.mjs`'s dispatch ran the full
  suite at 3563 tests with exactly 11 failures, in `trace.test.mjs` (8),
  `plan-key.test.mjs`, `risk-diff.test.mjs` and `trace-suggest.test.mjs`.
