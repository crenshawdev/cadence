---
phase: 2
plan: 1
requirements:
  - HLT-01
files:
  - cadence-core/config.schema.json
  - cadence-core/route-table.json
  - cadence-core/bin/route.mjs
  - cadence-core/bin/config.test.mjs
  - cadence-core/bin/route-cells.test.mjs
  - cadence-core/bin/self-verify.test.mjs
  - cadence-core/bin/gate-agreement.test.mjs
  - cadence-core/bin/trace-suggest.test.mjs
  - cadence-core/bin/planning.mjs
  - cadence-core/bin/planning.test.mjs
  - cadence-core/bin/lib/deferred-queue.mjs
  - cadence-core/bin/deferred-queue.test.mjs
  - cadence-core/bin/lib/adjudication-record.mjs
  - cadence-core/bin/adjudication-record.test.mjs
  - cadence-core/bin/lib/arg-contract.mjs
  - cadence-core/bin/arg-contract.test.mjs
  - cadence-core/references/triage-gate.md
  - cadence-core/references/review-triggers.md
  - cadence-core/references/config-catalog.md
  - cadence-core/bin/prose-agreement.test.mjs
  - cadence-core/bin/weight-budgets.json
---

# Phase 2: Blocking that blocks the land - Plan 1 of 3 (vocabulary, receipt, fire artifacts)

## Goal

A blocking finding stops the LAND instead of stopping the RUN. This plan builds
the half that happens at the FIRE: `deferred` resolves as a fifth gate mode, a
fire in that mode runs the reviewer, persists its findings and leaves a durable
queue member plus a receipt that clears the risk gate - and the run continues.

## Must be true when done

- `config.mjs set review.triggers.<t>.gate=deferred` succeeds for all four
  triggers, `route.mjs resolve --role cad-reviewer` returns `deferred` in its
  `review` map for a trigger a config layer pinned that way, and a gate outside
  the vocabulary is refused with a message naming five values.
- `node cadence-core/bin/self-verify.mjs --root .` reports no
  `gate-vocabulary-drift` and no `unknown-gate` against the shipped tree.
- A `deferral` outcome receipt is accepted by `trace append`, and
  `risk-check status` over the range that receipt names reports the range FIRED
  rather than `risk-fire-missing`.
- A deferred fire leaves `REVIEW-<trigger>-<discriminator>.md` carrying the
  reviewer's own `{findings: [...]}` object and
  `DEFERRED-<trigger>-<discriminator>.json` beside it, and writes no
  `ADJUDICATION-*.json` - the adjudication seam still refuses a finding with no
  ruling, so a record at fire time is impossible by construction rather than by
  convention.
- `references/triage-gate.md` states the `deferred` arm once, and every fire
  site reaches it by the re-read it already performs at its gate step - no
  workflow file grows a per-gate arm of its own.

## Context

- D-07/D-08: `deferred` goes into all four `review.triggers.<t>.gate` `values`
  arrays AND `route-table.json`'s `gates`, element-for-element in the same
  order. `gates` is an ORDERED ladder that `/cad-suggest` steps down, so the
  insertion point is a decision, not a formality.
- D-03: the `review` GRID does not move - no stakes level fires `deferred` by
  default, and phase 3 owns what a level decides about gates. Plan 3 pins that.
- D-04: a deferred fire writes a NEW fifth `outcome` receipt, `deferral`.
  Reusing `gate_pass` would read as a clean gate downstream and `override` is
  the manufactured clear the receipt machinery exists to refuse.
- D-09: the fire persists findings exactly as the advisory arm does and writes
  NO `ADJUDICATION-*.json`, because `RULINGS` is frozen at three values.
- D-12: every prose surface this plan edits gets its `weight-budgets.json` row
  re-pinned in the SAME task - the budgets are ceilings set to each file's exact
  byte count.
- Out of scope here: the `/cad-land` refusal, the `/cad-progress` count, the
  cursor and the milestone carry (plan 2); the rail pins (plan 3).

## Tasks

### Task 1: Admit `deferred` to the gate vocabulary, at the ladder position between `advisory` and `blocking`

- **Files:** cadence-core/config.schema.json, cadence-core/route-table.json, cadence-core/bin/route.mjs, cadence-core/bin/config.test.mjs, cadence-core/bin/route-cells.test.mjs, cadence-core/bin/self-verify.test.mjs, cadence-core/bin/gate-agreement.test.mjs, cadence-core/bin/trace-suggest.test.mjs
- **Action:** Add `deferred` to the `values` array of all four
  `review.triggers.<t>.gate` keys in `config.schema.json`, to `route-table.json`'s
  `gates` array, and to `DEFAULT_GATES` in `cadence-core/bin/route.mjs` - the
  same five names in the same order in all three, since `vocabularyIssues` in
  `lib/route-cells.mjs` compares `gates` against the schema enum
  element-for-element and files `gate-vocabulary-drift` on any difference.
  Insert it BETWEEN `advisory` and `blocking`, giving
  `off, advisory, deferred, blocking, adjudicated`. That position is the
  planner's call on the flagged assumption in CONTEXT, and the reason is
  `oneStepDown` in `lib/trace-suggest.mjs`: the ladder is what `/cad-suggest`
  proposes a retune down, and a `blocking` gate whose fires keep coming back
  empty should be proposed down to a mode that still stops the land, not to
  `advisory`, which stops nothing. Do NOT touch the `review` grid in
  `route-table.json` (D-03) and do NOT touch any key's `purpose` prose beyond
  what the next sentence requires: `gateAgreementIssues` in
  `lib/gate-agreement.mjs` holds each `purpose` to a `<gate> at <level>` clause
  for every level, and those clauses describe the GRID, which does not move.
  Update the five test files that transcribe the four-name list by hand -
  `config.test.mjs`'s `must be one of` assertion and its no-gate-name-in-warning
  guard, `route-cells.test.mjs`'s `GATES` fixture and its two detail-message
  matches, `self-verify.test.mjs`'s two gate lists,
  `gate-agreement.test.mjs`'s `GATES`, and `trace-suggest.test.mjs`'s `GATES` -
  and in `trace-suggest.test.mjs` add one arm pinning that a `blocking` gate
  proposes `deferred` one step down, so moving `deferred` in the ladder reddens
  a test instead of silently re-aiming every retune suggestion. Do not add a
  back-compat alias and do not widen `review.mode`, which is a different enum
  that happens to share the word `adjudicated`.
- **Verify:** `node cadence-core/bin/config.mjs set review.triggers.plan.gate=deferred --dir <a scratch .planning>` succeeds and the same for `diff`, `risk_surface` and `phase_diff`; `node cadence-core/bin/config.mjs check review.triggers.diff.gate=nope` refuses with a detail naming all five values; `node cadence-core/bin/route.mjs resolve --role cad-reviewer` against a tree pinning one trigger to `deferred` returns `deferred` for that trigger in its `review` map; `node cadence-core/bin/self-verify.mjs --root .` reports no problem of kind `gate-vocabulary-drift` or `unknown-gate`; `node cadence-core/bin/test.mjs routing` and `node cadence-core/bin/test.mjs prose` and `node cadence-core/bin/test.mjs other` all pass.

### Task 2: `deferral` becomes the fifth fire receipt `risk-check status` accepts

- **Files:** cadence-core/bin/planning.mjs, cadence-core/bin/planning.test.mjs
- **Action:** Add `deferral` to `FIRE_RECEIPTS` in `cadence-core/bin/planning.mjs`
  and rewrite the block comment above it: it currently ends "A FIFTH name would
  be a state nothing produces", which is the sentence this phase falsifies, so
  it must now name the fifth outcome and what produces it - a gate resolved
  `deferred` settles by queuing rather than by adjudicating, and without an
  accepted receipt `cmdRiskCheckStatus` reports the matched range `unfired`
  forever and the run halts exactly where criterion 2 says it must not. Give
  `deferral` NO special-case beside `override`'s empty-reason refusal: it is a
  settled review outcome, not a coordinator's own say-so, so it is exactly as
  joinable as `gate_pass` and needs the same `--trigger`, `--plan`, `--base` and
  `--sha` to settle a range through `settledBy`. Add a `planning.test.mjs` arm
  that appends a `deferral` receipt over a matched, recorded range and asserts
  `risk-check status` answers `ok:true` for it, plus its negative: with
  `deferral` absent from the accepted set the same range answers
  `risk-fire-missing`. Do not touch `RISK_TRIGGER`, the `inCycle` sign-off
  bound, or `recountReceipt` - a `deferral` receipt carries no settled figures,
  so the recount's all-three-present guard already omits it.
- **Verify:** `node cadence-core/bin/planning.mjs trace append --phase <N> --family outcome --event deferral --trigger risk_surface --plan 1 --base <base> --sha <head>` returns `ok:true`; `node cadence-core/bin/planning.mjs risk-check status --phase <N> --plan 1 --base <base> --head <head>` on a range whose `risk_check` record carries matches answers `ok:true` with that plan's row `state: "recorded"`; removing `deferral` from `FIRE_RECEIPTS` reddens the new arm in `node cadence-core/bin/test.mjs planning`.

### Task 3: The queue artifact seam - `planning.mjs deferred record`

- **Files:** cadence-core/bin/lib/deferred-queue.mjs, cadence-core/bin/deferred-queue.test.mjs, cadence-core/bin/lib/adjudication-record.mjs, cadence-core/bin/adjudication-record.test.mjs, cadence-core/bin/planning.mjs, cadence-core/bin/lib/arg-contract.mjs, cadence-core/bin/arg-contract.test.mjs
- **Action:** Create `cadence-core/bin/lib/deferred-queue.mjs` as a pure module
  and a `deferred record` face on `cadence-core/bin/planning.mjs`, splitting
  them the way `lib/adjudication-record.mjs` and `cmdAdjudication` already are:
  the module owns the grammar and the classification, the command owns every
  decision that touches the world. The face takes `--phase`, `--trigger`,
  `--discriminator`, `--base`, `--head`, `--payload <file>` and an optional
  `--round` (defaulting to 1), validates `--trigger` and `--discriminator`
  against the existing `RECORD_TOKEN` rail in `planning.mjs` - both reach a
  FILENAME, and `milestone-prune --label` is the precedent for refusing rather
  than sanitizing - resolves the range through `resolveRange` so the stored ids
  are full and checkoutable rather than the caller's spelling, and writes
  `DEFERRED-<trigger>-<discriminator>[-r<round>].json` into
  `.planning/phases/<N>/`, refusing to overwrite an existing file and refusing
  when the phase directory does not already exist, both for the reasons
  `cmdAdjudication` states for its own writes. The payload is the reviewer's own
  `{findings: [...]}` object - the SAME file the fire site wrote to the sibling
  `REVIEW-<trigger>-<discriminator>.md`, read through `readJsonPayload`, never
  inline JSON - and the stored record carries those findings VERBATIM alongside
  the phase, trigger, discriminator, round and resolved range ids. Verbatim
  rather than a bare count, because `/cad-milestone` deletes the sibling REVIEW
  file and plan 2 carries this artifact past that delete: a queue member whose
  findings live only in a pruned file cannot be triaged and cannot be counted.
  Do NOT write an `ADJUDICATION-*.json` here and do not add a fourth ruling -
  `RULINGS` stays frozen at three (D-09). Two deduplications belong in this
  task, because a second copy of either rule is a second place for the queue and
  the record to disagree about which file they mean: move `recordName` out of
  `planning.mjs` into `lib/adjudication-record.mjs` as an export and import it
  back at both existing call sites (`cmdAdjudication`'s writer and
  `recordForFire`'s receipt recount), so the queue module resolves the
  superseding record's name from the one rule; and extract the per-finding
  validation already inside `buildEntries` - the `FINDING_KEYS` unknown-key
  test, the `file`/`claim`/`failure_scenario` bounds, the `line` floor and the
  `RAISED_SEVERITIES` enum - into an exported function that both `buildEntries`
  and the queue module call, so the shape a queue member stores is the shape an
  adjudication record already refuses to store wrong. Register `deferred` in
  `TWO_WORD` in `lib/arg-contract.mjs` and add the `deferred record` row to
  `CONTRACTS['planning.mjs']`; the Set is earned here because this face is one
  of three operations (`record` now, `list` and `carry` in plan 2), which is the
  `risk-check run|status` precedent rather than the single-operation
  `adjudication` one.
- **Verify:** `node cadence-core/bin/planning.mjs deferred record --phase <N> --trigger diff --discriminator plan-1 --base <base> --head <head> --payload <a findings file>` writes `.planning/phases/<N>/DEFERRED-diff-plan-1.json` holding those findings verbatim and no `ADJUDICATION-*.json` appears; the same call a second time refuses instead of overwriting; `--trigger ../../etc` and `--discriminator .` are both refused naming the character rule; a payload carrying a finding with `line: 0` or an unknown key is refused with the same wording `buildEntries` gives; `node cadence-core/bin/test.mjs other` and `node cadence-core/bin/test.mjs planning` pass, `adjudication-record.test.mjs`'s three-ruling arm still passes, and `node cadence-core/bin/self-verify.mjs --root .` reports no `unknown-subcommand` or `unknown-flag`.

### Task 4: State the `deferred` arm once, where every fire site already re-reads it

- **Files:** cadence-core/references/triage-gate.md, cadence-core/references/review-triggers.md, cadence-core/references/config-catalog.md, cadence-core/bin/prose-agreement.test.mjs, cadence-core/bin/weight-budgets.json
- **Action:** Add the `deferred` arm to `references/triage-gate.md` beside
  `advisory`, `blocking` and `adjudicated`, and widen that file's opening
  sentence, which currently enumerates four gates. The arm states, in this
  order: the reviewer runs and the findings are persisted exactly as the
  `risk_surface` persistence rule in `references/review-triggers.md` step 5
  already specifies - the settled `{findings: [...]}` object written to
  `.planning/phases/<N>/REVIEW-<trigger>-<discriminator>.md` on the same
  discriminator grammar, `plan-<k>` for a per-plan fire and
  `<command>-<short HEAD sha>` otherwise, with no unsuffixed path; then that
  same file is passed as `--payload` to a fenced
  `planning.mjs deferred record` line; then the fenced
  `trace append --family outcome --event deferral` receipt carrying
  `--trigger`, `--plan`, `--base` and `--sha`; then the run CONTINUES - no
  halt, no ask, no re-arm here, and nothing is fixed at the fire. State
  explicitly that the queue member is COMMITTED, unlike the REVIEW file beside
  it, and that whoever fires stages it with the next commit that run makes, with
  the reason: `.planning/trace.jsonl` is gitignored and a REVIEW file left
  untracked evaporates on a fresh clone, which is the state D-01 rejects. State
  that this arm writes NO adjudication record and reads as unruled until one
  supersedes it. In `references/review-triggers.md`, widen step 1's
  `advisory | blocking | adjudicated` list and step 6's three-arm parenthetical
  to name `deferred`, and nothing else in that file - the persistence rule the
  arm points at is already there. In `references/config-catalog.md`, add
  `deferred` to the `review.triggers.<t>.gate` row's value list with a
  one-clause meaning in the row's existing style. Update
  `prose-agreement.test.mjs`'s GAT-04 receipt census in the SAME task: its
  expected set is exactly the four settle-point names, so the new fenced
  `deferral` line reddens it until the expectation reads five, and moving them
  apart makes a correct addition look like a deleted assertion. Re-pin the
  `weight-budgets.json` rows for `references/triage-gate.md`,
  `references/review-triggers.md` and `references/config-catalog.md` to their
  new exact byte counts (D-12) - the budgets are ceilings at each file's current
  size, so an edit without the re-pin fails self-verify on `budget-overrun`
  after the work is otherwise done. Do NOT add a per-gate `deferred` arm to
  `workflows/plan.md`, `workflows/execute.md` or
  `references/execute-parallel.md`: those state what each LEVEL resolves, no
  level resolves `deferred` (D-03), and every one of them already re-reads
  `triage-gate.md` at its gate step, which is why that file exists.
- **Verify:** `node cadence-core/bin/test.mjs prose` passes with the GAT-04 census asserting five receipt names; `node cadence-core/bin/self-verify.mjs --root .` returns `ok:true` with an empty `problems` array, budget rows included; `grep -c 'deferred' cadence-core/references/triage-gate.md` shows the arm present and `grep 'deferred' cadence-core/workflows/plan.md cadence-core/workflows/execute.md cadence-core/references/execute-parallel.md` returns nothing.

## Notes

- Plans 1, 2 and 3 of this phase SHARE files (`planning.mjs`,
  `lib/deferred-queue.mjs`, `lib/arg-contract.mjs`, `references/triage-gate.md`,
  `prose-agreement.test.mjs`, `weight-budgets.json`), so they are SEQUENTIAL -
  1, then 2, then 3. `plan-overlap` will report the overlaps and
  `/cad-execute` will take its sequential arm, which is correct here; do not
  parallelize them.
- `deferred-queue.test.mjs` is a new stem no group in `cadence-core/bin/test.mjs`
  names, so it lands in `other`, which the CI matrix already runs -
  `adjudication-record` sits there for the same reason. No edit to `test.mjs`
  is needed.
- A `deferral` receipt is exactly as forgeable as `gate_pass`: nothing checks
  that a queue member exists for it. That is the shipped disposition for the
  clean-pass receipt and this plan does not widen it; if the human wants a
  receipt that cannot be minted without its artifact, that is a separate
  decision.
