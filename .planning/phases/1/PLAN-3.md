---
phase: 1
plan: 3
requirements: [RSK-08]
files:
  - cadence-core/bin/lib/arg-contract.mjs
  - cadence-core/bin/planning.mjs
  - cadence-core/bin/arg-contract.test.mjs
  - cadence-core/bin/trace.test.mjs
  - cadence-core/bin/planning-adjudication.test.mjs
  - cadence-core/bin/planning-lease-check.test.mjs
  - cadence-core/bin/citation-census.test.mjs
  - .planning/DOCS-CLAIMS.md
  - .planning/phases/1/CONTEXT.md
---

# Phase 1: The record's guards hold for every ruling - Plan 3

## Goal

Close UAT item 3 (AC3): a settle receipt can no longer discharge the
cleared-halt guard by carrying no settled figures at all, so `overridden: true`
stops being an unverifiable self-assertion that clears a blocking range.

## Must be true when done

- `trace append` refuses a receipt whose `--event` is `adjudication`,
  `gate_pass` or `override` when it carries none of `--survivors`,
  `--downgraded`, `--refuted`. Nothing is appended, and the refusal names the
  flags the caller has to add.
- That requirement is DECLARED in `cadence-core/bin/lib/arg-contract.mjs`
  beside `CONTRACTS` rather than hand-written at the dispatch, and every flag
  it names is a flag the same `trace append` row already declares.
- A `rearm` or a `deferral` receipt carrying no figures is still accepted, so
  the two fenced receipt commands in `cadence-core/references/triage-gate.md`
  that carry no figures still run exactly as they read.
- Over a record holding a survived `blocker` marked `overridden: true`, a
  figureless `gate_pass` is refused and appends nothing, while the
  `override --detail-file` receipt carrying its three figures is still accepted
  and still leaves `risk-check status` reporting the range `recorded`.
- `cadence-core/bin/planning/trace.mjs` is byte-unchanged: `overrideAccounted`,
  its `['survivors','downgraded','refuted'].some(...)` precondition and the
  seam's "never a runtime refusal keyed to an event name" property are exactly
  as they shipped.
- `node cadence-core/bin/test.mjs` is green and
  `node cadence-core/bin/self-verify.mjs` reports `ok:true` with
  `problems: []`.

## Context

Runs AFTER PLAN-2, which carries the eleven shipped arms onto the new shape so
this plan's constraint lands against a tree that already obeys it. The user has
fixed the approach and it is not this plan's to re-open: the hole closes at the
CLI ARGUMENT-CONTRACT layer, never inside `overrideAccounted`, and
`cadence-core/bin/planning/trace.mjs` is not edited by any task here. D-04
stands unamended - the SEAM keeps its event-agnostic property, and the
event-name knowledge lives at the argument door, where
`cadence-core/bin/planning/risk-check.mjs`'s `if (e.event === 'override')` arm
is the shipped precedent for event-name logic outside `trace.mjs`. D-15's
reasoning carries: the guard is unconditional on the paths that already exist,
so no opt-in flag is added. D-11 and D-06 hold: the ruling vocabulary and the
`overridden` grammar do not move.

## Tasks

### Task 1: Declare the settle-receipt figure requirement and enforce it at the door

- **Files:** cadence-core/bin/lib/arg-contract.mjs (start at `CONTRACTS`, at
  the `'trace append'` row and at `evaluateRow`), cadence-core/bin/planning.mjs
  (start at the `evaluateRow` call in the dispatch at the foot of the file),
  cadence-core/bin/arg-contract.test.mjs (start at `ROWS` and at the test named
  `the declarations the CONTEXT decisions bind are the ones in the table`),
  cadence-core/bin/trace.test.mjs (the comment on the arm named `seam:
  --trigger is stored VERBATIM, trimmed, with no vocabulary of its own`),
  .planning/phases/1/CONTEXT.md (D-15, which cites
  `cadence-core/bin/lib/arg-contract.mjs:752`/`:835`)
- **Re-pin in this same commit:** D-15's two citations are the lines this task
  moves. `:835` is the head of the `'trace append'` row itself, which is
  exactly where the second declared structure lands, and `:752` is the
  `adjudication:` row above it. Re-read both after the edit and rewrite the two
  numbers in `CONTEXT.md` to whatever they became. D-15's CLAIM is untouched -
  it says this phase adds no CLI flag and no `CONTRACTS` row, and a second
  structure beside `CONTRACTS` is neither - so only the line numbers move, not
  the sentence.
- **Action:** Today `CONTRACTS` can state a per-flag value grammar and nothing
  else, and `evaluateRow`'s own docblock says so: it is a VALUE door, not a
  presence door, and leaves `required` to the bin that owns the wording. A
  conditional requirement - this event implies at least one of these flags - is
  not expressible, so the table gains a SECOND declared structure beside
  `CONTRACTS`, keyed the same way (script, then subcommand key), stating that
  on `planning.mjs`'s `trace append` an `--event` of `adjudication`,
  `gate_pass` or `override` requires at least one of `--survivors`,
  `--downgraded`, `--refuted`; and an evaluator beside `evaluateRow` that
  answers it. It must NOT be a key inside the `trace append` row: `flagNames`
  is `Object.keys(row)`, `self-verify.mjs` check 2 unions those keys as the
  allowed FLAG names for prose, `planning/trace.mjs`'s `TRACE_GRAMMAR` spreads
  both trace rows as flag specs, and `arg-contract.test.mjs`'s completeness
  walk asserts every row key holds exactly `bare`, `required`, `type` and
  `value` and calls a fifth field "a rule this table states in two places". All
  three would read a non-flag key as a flag. JUDGE EVERY OCCURRENCE OF THE
  CONDITIONING FLAG, not the first: this module's own header states that a
  declaration holding only at the position one reader happens to pick is not a
  contract, and here it is load-bearing - `planning.mjs`'s `parseArgs` keeps
  the LAST occurrence while `evaluateFlag` answers about the first, so
  `--event rearm --event gate_pass` would otherwise walk a figureless
  `gate_pass` straight past the door. Compare the event spelling AS GIVEN,
  untrimmed: `trace.mjs` stores `--event` verbatim and `risk-check.mjs` joins
  `FIRE_RECEIPTS` by exact string, so a padded spelling settles nothing
  downstream and is not this rule's business. Satisfaction is the PRESENCE of
  any ONE of the three, never all three: `recountReceipt`'s all-three
  precondition exists because a partial set cannot be compared against a
  recount that answers all three, and this door recounts nothing. Leave `rearm`
  and `deferral` unconstrained - they settle nothing, and the fenced receipt
  commands for both in `references/triage-gate.md` carry no figures by
  contract, so binding them would refuse a documented line. Wire it in
  `planning.mjs`'s dispatch AFTER `evaluateRow` and only when that returned
  `ok`, so every malformed-value refusal keeps naming its own flag and the
  spawned invocations in `arg-contract-adoption.test.mjs` keep refusing exactly
  where they already do. Mint the refusal INSIDE the same if/else chain that
  already carries the `!args.ok` arm: `fail` in `planning/core.mjs` emits and
  returns rather than exiting, and a `fail` outside that chain was measured
  printing a second JSON line beside the handler's own, which breaks every test
  helper that parses stdout as one line. Use `bad-args`, the reason this door
  already mints - this file has one refusal vocabulary - and GIVE IT A HINT:
  measured without one, `self-verify.mjs` returns `ok:false` with
  `{kind:'hintless-refusal', file:'cadence-core/bin/planning.mjs'}`. The detail
  names the three flags and what they are for, and it MAY name the event: this
  is the argument door, which is exactly where the user's decision puts the
  event-name knowledge, and D-04's "never a runtime refusal keyed to an event
  name" is a property of the SEAM, which this task does not touch. Write the
  sentence ONCE, at the site that mints it, and add no second copy in
  `planning/core.mjs` - `trace.test.mjs`'s `trace-refusal-sentences` census is
  the standing proof that this seam refuses a duplicated refusal sentence. Add
  arms to `arg-contract.test.mjs` in that file's own idiom - the `ROWS` table
  for evaluator behaviour and the `PINNED` shape for a declaration the reasons
  bind - proving that the declared rule for `trace append` is exactly those
  three events and those three flags, that the evaluator refuses each of the
  three events figureless and accepts each of them with any ONE figure, that a
  figureless `rearm` and a figureless `deferral` are accepted, that a repeated
  `--event` naming a settle event at ANY position is judged, and that every
  flag the new structure names is declared in the same
  `CONTRACTS['planning.mjs']['trace append']` row so a typo reddens instead of
  silently never firing. Write no hand-typed COUNT in those arms: a count needs
  a `CADENCE-CENSUS` marker and a `lib/census-registry.mjs` row, and the
  existing `arg-contract-flag-entries` census stays at 194 because this task
  adds no flag. Last, the arm named `seam: --trigger is stored VERBATIM,
  trimmed, with no vocabulary of its own` carries a comment claiming "no
  coupling to an event NAME and no refusal keyed to one" - true of the seam,
  false of the door from this commit on, so say which layer the sentence is
  about rather than leaving a reader to find the contradiction.
- **Verify:** `node cadence-core/bin/test.mjs` reports 0 failures and
  `node cadence-core/bin/self-verify.mjs` reports `ok:true` with an empty
  `problems` array. Against a scratch planning dir,
  `planning.mjs trace append --phase 1 --family outcome --event gate_pass
  --trigger risk_surface --plan 1 --base <a> --sha <b>` returns `ok:false` with
  `reason: "bad-args"` on ONE stdout line carrying a `hint`, and no
  `trace.jsonl` is created; the same call with `--survivors 0 --downgraded 0
  --refuted 0` returns `ok:true` and writes exactly one line; the same call
  with `--event rearm` and no figures returns `ok:true`; and
  `--event gate_pass --event rearm` with no figures is refused whichever order
  the two are typed in. `node --test cadence-core/bin/arg-contract.test.mjs`
  and `node --test cadence-core/bin/arg-contract-adoption.test.mjs` are both
  green, the second with no edit to it.

### Task 2: Prove the cleared halt cannot be settled by a figureless receipt

- **Files:** cadence-core/bin/planning-adjudication.test.mjs (start at
  `deferralRepo`, `plRun`, `survivedPayload`, `survivedPayloadFile` and
  `traceLines`, and at the arm named `RSK-08: a REASONLESS receipt over a
  record holding a cleared halt is refused`)
- **Action:** Add the arm that reddens if the requirement is ever removed,
  using this file's own harness rather than a new fixture: `deferralRepo` for
  the scratch repository and its matched range, `plRun` for every seam call,
  `survivedPayload('blocker', { overridden: true })` for the record, and
  `traceLines` to prove nothing was appended. It walks `risk-check run` ->
  `adjudication` -> the receipt, and asserts that a `gate_pass` receipt naming
  `--trigger`, `--plan`, `--base` and `--sha` but carrying NONE of
  `--survivors`, `--downgraded`, `--refuted` returns `ok:false` with
  `reason: 'bad-args'`, that `traceLines` is unchanged in length across the
  call, and that `risk-check status` over the range still does NOT report the
  plan `recorded` - which is the whole of what UAT item 3 measured going the
  other way, where the figureless receipt was appended and the range then read
  `recorded`. Assert beside it that the accepted shapes still pass over that
  same record: the `override --detail-file` receipt carrying its three figures
  is `ok:true` and leaves the range `recorded`, so the arm proves the door
  refuses the figureless CALL and not the fixture. Do NOT copy the neighbouring
  `assert.doesNotMatch(receipt.detail, /gate_pass|override|rearm|deferral|adjudication/)`
  assertion into this arm: that one pins the SEAM's refusal, which stays a
  record/receipt contradiction, while this refusal comes from the argument door
  and is allowed to name the event it refused - asserting otherwise here would
  pin the opposite of the decision this plan implements. Leave every shipped
  `RSK-08:` arm in the file untouched, in particular the two that send a
  partial settle line of two figures: those still reach `overrideAccounted` and
  its `bad-record` sibling exactly as before, so the new door neither subsumes
  nor shadows them. Add nothing to `cadence-core/bin/test.mjs` - this stem is
  already a member of the `planning` group.
- **Verify:** `node cadence-core/bin/test.mjs planning` is green with the new
  arm, and `node cadence-core/bin/test.mjs` reports 0 failures overall. The
  arm REDDENS on demand: with the three event names removed from the declared
  rule in `lib/arg-contract.mjs` (and nothing else changed),
  `node --test cadence-core/bin/planning-adjudication.test.mjs` fails on this
  arm because the figureless receipt answers `ok:true` and appends a line -
  restore the rule and it is green again.

## Notes

- PLAN-2 and PLAN-3 are SEQUENTIAL, PLAN-2 first. PLAN-2 makes the eleven
  shipped arms obey a rule that does not exist yet; this plan lands the rule
  against a tree that already obeys it. Reversed, the suite is red between the
  two plans.
- Two files rather than one because the single plan measured 811,001 declared
  bytes against `workflow.max_plan_bytes` of 675,000. This half is 625,740, the
  other 379,295. The split is a redistribution of the same three tasks; no
  task's text, verification or citation changed.
- `cadence-core/bin/trace.test.mjs` is declared by both plans and is NOT
  optional here, for two independent reasons. It is the HOLDER of the
  `trace-refusal-sentences` census, whose subjects include
  `cadence-core/bin/planning.mjs`, so without it `lease-check --plan-time`
  refuses this plan with `census-at-risk` naming that row; and task 1 edits the
  comment on one arm in it. Sharing the path costs nothing - the two plans are
  sequential already.
- `cadence-core/bin/planning-lease-check.test.mjs` is in the lease because it
  holds the `planning-detail-sites` census, whose subjects also include
  `planning.mjs`. `censusesAtRisk` over this plan's declared files returns
  `[]`; drop either holder and it does not. No count in it moves - that census
  counts an `e && e.message ? ...` detail idiom this plan adds none of.
- `.planning/DOCS-CLAIMS.md` and `cadence-core/bin/citation-census.test.mjs`
  are in the lease as insurance, not because a shift is expected. Measured: no
  `DOCS-CLAIMS.md` row and no `CITATIONS` row cites `planning.mjs` or
  `lib/arg-contract.mjs` by line, so the two files task 1 grows are unpinned -
  but plan 1's own structural checkpoint came from exactly this class, one task
  after the edit that caused it, and the declaration costs nothing.
- No reference prose changes. All three fenced settle receipts already carry
  all three figures (`review-record.md:17`, `triage-gate.md:98`, `:109`), and
  the `rearm` and `deferral` lines (`triage-gate.md:201`, `:25`) carry none by
  contract and stay unbound - so no coordinator following the documented shape
  meets this refusal, `weight-budgets.json` needs no re-pin, and
  `prose-agreement.test.mjs`'s five-receipt census is untouched.
- `cadence-core/bin/planning/core.mjs` is deliberately NOT in the lease. The
  refusal sentence lives at the single site that mints it in `planning.mjs`,
  the way that site's existing `bad-args` hint already does; routing it through
  `argRefusal` would put a conditional-presence rule inside a per-flag wording
  map and would pull four more census holders into the lease for nothing.
