---
phase: 1
plan: 2
requirements:
  - GAT-04
files:
  - cadence-core/bin/planning.mjs
  - cadence-core/bin/self-verify.mjs
  - cadence-core/bin/trace.test.mjs
  - cadence-core/bin/risk-diff.test.mjs
  - cadence-core/references/review-triggers.md
  - cadence-core/references/triage-gate.md
  - cadence-core/bin/weight-budgets.json
---

# Phase 1: The controls that never reached their path - Plan 2 (GAT-04)

## Goal

`risk-check status` stops accepting a matched or inconclusive range that
carries no outcome event, so proving the detector RAN stops standing in for
proving the blocking fire HAPPENED.

## Must be true when done

- `risk-check status` returns `ok:false` for a range whose record carries a
  non-empty `matches` or `inconclusive: true` and which has no outcome event
  naming the `risk_surface` trigger under the same correlation id and plan.
- The identical call returns `ok:true` once an adjudication, a re-arm, a clean
  blocking pass or an explicit user override has been recorded under that
  correlation id and plan.
- A blocking `risk_surface` fire that finds nothing blocker/high writes a
  receipt of its own, so a matched range whose fire came back clean is still
  clearable.
- An explicit user override of a blocking FAIL writes its own receipt, with the
  user's reason carried by `--detail-file`.
- The join runs on structured fields; no reader parses a trigger or a plan out
  of a free-text `--detail`.
- A record that read nothing, a stale range and a missing record all keep the
  answers they give today.
- `node --test cadence-core/bin/*.test.mjs` and `node
  cadence-core/bin/self-verify.mjs` both exit 0.

## Context

Locked: every blocking `risk_surface` fire records an outcome event of its own,
PASS included, so "the detector ran" and "the fire happened" are two receipts
`risk-check status` can demand together (D-11). The event carries STRUCTURED
trigger and plan identity; the free-text `--detail` slot is never parsed to join
an event to a trigger or a range (D-12). The explicit override records its event
from `references/triage-gate.md`'s blocking arm, its reason riding
`--detail-file` under the v3.5.2 transport rule (D-13). The `/cad-task`,
`/cad-debug` and `/cad-verify` fire sites stay OUTSIDE the status gate - GAT-04
changes only what `risk-check status` accepts on the execute path (D-14). This
plan lands before PLAN-3, whose new `risk-check status` caller is written
against the rule it must satisfy.

## Tasks

**Before task 1, and before ANY commit in this plan:** run `git rev-parse
--short HEAD` and hold that SHA - it is this plan's unpatched baseline for the
watched FAIL recorded in task 2's header comment. Run it here rather than inside
task 2, because by then HEAD already carries task 1 and the literal command
names a patched revision. Observe the unpatched behaviour at this same point (a
`risk-check status` returning `ok:true` for a range whose record carries a
non-empty `matches` and no receipt) and carry it into that comment.

### Task 1: `trace append` carries a structured trigger

- **Files:** cadence-core/bin/planning.mjs, cadence-core/bin/self-verify.mjs, cadence-core/bin/trace.test.mjs
- **Action:** Start reading at `cmdTrace`'s `append` arm and at the
  `'trace append'` row of self-verify.mjs's `CONTRACTS` table. Add a `--trigger`
  flag to `trace append`, stored verbatim as one
  non-empty trimmed string on the appended event, and REFUSED as `bad-args` with
  nothing appended when the flag is present but bare or blank - the identical
  guard `--step` and `--reviewer` already carry two paragraphs above, for the
  identical reason: `parseArgs` gives a valueless flag the boolean `true`, which
  would store the literal `true` as a trigger name. Event-agnostic like every
  other flag on this seam: no coupling to an event NAME, no new refusal keyed to
  one. It does NOT go on the `close` row - `close` fixes its own family and
  event and takes neither `--family` nor `--event`, and the transport never
  widens what a subcommand accepts. Add `--trigger` to the `'trace append'` row
  in self-verify.mjs's `CONTRACTS` table in the same commit, with a comment
  saying why it exists: without the row, check 2 reports `unknown-flag` against
  correct prose. Why structured rather than parsed back out of `--detail`
  (D-12): measured on this repository's 35 `outcome/adjudication` events the
  trigger is spelled four different ways in `detail` - `risk_surface`,
  `risk_surface re-arm`, `risk_surface rearm`, `risk_surface plan-1` - and
  `lib/trace-suggest.mjs` discards that text entirely. Change NOTHING about what
  `--detail` carries at any existing site: `lib/trace-suggest.mjs`'s
  `parseAdjudication` still reads its trigger out of the adjudication detail and
  the rearm detail, and moving that is a different requirement.
- **Verify:** `node --test cadence-core/bin/trace.test.mjs` exits 0 with new
  cases: `--trigger risk_surface` lands the value on the appended event; a bare
  `--trigger`, an empty string and a whitespace-only value each return
  `bad-args` and append NOTHING; an append with no `--trigger` produces a line
  byte-identical to what it produces today. `node cadence-core/bin/self-verify.mjs`
  exits 0 with no `unknown-flag`.

### Task 2: `risk-check status` demands the fire receipt

- **Files:** cadence-core/bin/planning.mjs, cadence-core/bin/risk-diff.test.mjs
- **Action:** Start reading at `cmdRiskCheckStatus`. The per-record shape it
  builds gains `matches` - the
  category tokens `cmdRiskCheckRun` already writes onto every record and this
  reader currently drops. A record that is `checked: true` and carries either a
  non-empty `matches` or `inconclusive: true` is a FIRED range: it satisfies the
  gate only when an outcome event exists under the same `rowKey(corr, plan)`
  identity this function already keys its rows on, carrying the trigger
  `risk_surface` in the structured field task 1 added AND one of exactly four
  event names - the adjudicated arm's `adjudication`, the capped re-arm's
  `rearm`, and the two receipts task 3 adds. Four, because those are the four
  outcomes a blocking fire can reach; a fifth would be a state nothing produces.
  Rows keep the four states they report today and gain one more, for a fired
  range whose receipt is absent, and the refusal envelope keeps `ok:false` with
  the offending plans named, its `hint` pointing at the FIRE rather than at
  `risk-check run` when that is the state in hand. Scope the receipt join
  exactly as the existing arms scope records: the named-range arm joins under
  this invocation's `corr` and the asked plan - the same identity
  `planRow(r.corr, wanted.plan)` already registers - and the phase-wide arm
  joins under the row's own key. Receipts pass through `inCycle` exactly as
  records do; do not re-derive the sign-off bound. Nothing about the
  `checked:false`, `stale`, `unchecked` or `missing` arms moves: a record that
  never read its range is still not a check, and this rule sits ON TOP of that
  answer rather than in place of it. Why the receipt and not the `written` flag:
  `risk-check status` proves a range was read and RECORDED, and a coordinator
  can run the detector, skip the fire and still receive `ok:true` - GAT-04 is
  precisely that gap. Reach the seam from the tests through the CLI only, the
  way `riskStatus` in that file already does, so the check fails on its
  assertion against the unpatched tree rather than on an import. Carry a header
  comment on the new block naming the short SHA the FAIL was watched at (D-17),
  captured with `git rev-parse --short HEAD` before this plan's first commit,
  and stating what was observed there.
- **Verify:** `node --test cadence-core/bin/risk-diff.test.mjs` exits 0 on this
  tree with new cases: a record carrying a non-empty `matches` and no receipt
  refuses with `ok:false`, exit 1, that plan in `missing` and its row in the new
  state; the same fixture plus an `adjudication` event carrying trigger
  `risk_surface` under the same corr and plan passes; and - the case that keeps
  an implementation from recognizing `adjudication` ALONE and still passing this
  file - the same fixture passes on each of the other three receipt names in
  turn, `rearm`, `gate_pass` and `override`, one case per name, since all four
  are outcomes a blocking fire can reach and AC4 and AC5 both fail at runtime if
  only the first is honored; AC5's own path asserted end to end (a range whose
  `matches` is non-empty and whose only event is the explicit user `override`
  passes, which is what makes a deliberately cleared range clear); a receipt
  carrying a DIFFERENT trigger under the same corr and plan does not satisfy it,
  asserted for all four names and not only for `adjudication`; a receipt
  under a different corr does not; a record with empty `matches` and
  `inconclusive: false` still passes with no receipt at all; an `inconclusive:
  true` record requires one; a `checked:false` record still reports `unchecked`
  rather than the new state. Against the unpatched tree the same file exits
  non-zero: `git worktree add --detach` a temporary checkout of the SHA named in
  the header, copy this test file in, run `node --test` there, observe the
  non-zero exit, remove the worktree.

### Task 3: every blocking fire leaves a joinable receipt

- **Files:** cadence-core/references/triage-gate.md,
  cadence-core/references/review-triggers.md,
  cadence-core/bin/weight-budgets.json
- **Action:** Make the fire's own outcome a receipt the record carries, at the
  four points a blocking fire can settle. In `triage-gate.md`'s `blocking` arm,
  add two appends, both `--family outcome`: a clean PASS, when nothing
  blocker/high survives, and an explicit user OVERRIDE of a FAIL. Name the two
  events `gate_pass` and `override` - the planner's call on CONTEXT's open
  question, and both are new `outcome` event names rather than a new detail
  shape on an existing family, because `lib/trace-suggest.mjs` keys on
  `adjudication` and `rearm` alone so neither new name reaches it, while
  `workflows/report.md`'s Gates line already names PASS as an outcome it
  renders. The PASS receipt exists because the roadmap's stated acceptance set
  has no arm for a clean pass and a blocking PASS writes nothing today: without
  it, `risk-check status` would refuse every matched range whose fire found no
  blocker, and this tree has already stated its verdict on that shape - an
  unclearable gate is one that gets bypassed. In the same commit, give the two
  outcome appends that ALREADY exist the identity the join needs: step 5's
  `adjudication` append in `review-triggers.md` and the `rearm` append in
  `triage-gate.md`. All four appends carry `--trigger <trigger>` and, when the
  fire is per-plan, `--plan <k>` - the same worker key the execute path's
  lifecycle brackets already use; a fire with no plan (the `/cad-debug`,
  `/cad-task` and `/cad-verify` sites) simply omits it, and those sites stay
  outside the status gate by D-14, which this must not widen. The override's
  reason is the user's own words, so it rides `--detail-file <path>` and never
  an inline `--detail`; when the prose NAMES the inline form in explaining why,
  write the flag bare in backticks and never followed by a quoted or
  `<`-opened value, or self-verify's check 19 reports a new unregistered
  text-transport site. Change no existing `--detail` value: `lib/trace-suggest.mjs`
  still parses the trigger out of the adjudication and rearm details. Do not
  touch the ONE-round re-arm cap, the multi-select triage arm, the contradictory
  answer rule, or the `git.auto_close` carve-out. Re-pin BOTH surfaces in
  `weight-budgets.json` in this same commit - `references/triage-gate.md` sits
  at 6261/6261 and `references/review-triggers.md` at 29413/29413, zero headroom
  each, so any growth is a `budget-overrun` and an uncommittable tree.
- **Verify:** `node cadence-core/bin/self-verify.mjs` exits 0 with no
  `budget-overrun`, no `text-transport-inline`, no `text-transport-unregistered`
  and no `text-transport-unclear`. `grep -n 'family outcome'
  cadence-core/references/triage-gate.md cadence-core/references/review-triggers.md`
  shows four appends, every one carrying `--trigger`, and the override one
  carrying `--detail-file`. `node --test cadence-core/bin/*.test.mjs` exits 0.

## Notes

- CONTEXT's third flagged assumption (whether the clean-pass receipt is a new
  outcome event kind or an existing family under a new detail shape) is answered
  in task 3: two new `outcome` event names, `gate_pass` and `override`.
  `lib/trace-suggest.mjs` reads `adjudication` and `rearm` by name and ignores
  everything else, and `trace render` emits every `outcome` event unfiltered, so
  the new kinds are additive at both consumers. `workflows/report.md`'s Gates
  line already lists PASS among the outcomes it renders, so it needs no edit -
  if a reader wants the two new names spelled there, that is a separate,
  unrequired change and is recorded here rather than taken.
- No 37th `lib/text-transport.mjs` register row is added and the
  `text-transport.test.mjs` count pin stays at 36/20. `FLAG_RE` carries
  `(?![a-z0-9-])`, so `--detail-file` never matches `--detail` and the override
  append creates no site for the scan to classify. That is the whole reason D-13
  chose the file transport, and adding a row "for completeness" would move a
  tree-wide pin for a site the scan cannot see.
- `workflows/execute.md` is deliberately NOT edited. Its sentence "The plan is
  NOT reported done while that call refuses" already governs the new refusal,
  and its following clause names one thing the re-read also catches without
  claiming to be exhaustive. Naming the second one would be true and is not
  required by any locked decision or acceptance criterion; it is left for the
  human rather than folded in.
