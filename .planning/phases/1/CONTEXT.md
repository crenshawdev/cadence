# Phase 1: The record's guards hold for every ruling - Context

Gathered: 2026-08-29
Feeds: /cad-plan 1

## Scope boundary

In: RSK-08's two halves. The `fix_commit` VALUE check in
`cadence-core/bin/lib/adjudication-record.mjs` runs wherever the key is set
rather than only under `ruling === 'survived'` (issue #165), and
`overridden: true` on a survived blocker or high stops discharging the
module's strongest refusal on an unverifiable self-assertion (issue #164).
The prose that states both lands in `references/triage-gate.md` and
`references/review-record.md` together.
Out: the ruling vocabulary, the record's no-stored-count rule, and anything
`land-cleanup.mjs` reads. Phase 4 consumes this seam and owns the gate's
halt decision; this phase only makes the guards it will rest on correct.
`/cad-milestone`'s prune and what survives it is OQ-2, phase 4's call.
Deferred: none. The size check kept AC1-AC7 in one plan.
Plan shape: one plan - two seams plus a predicate move, two reference edits,
and tests in two existing files with no new fixture harness.

## Durable decisions

- D-01 (OQ-1, first half): the `fix_commit` VALUE check is HOISTED out of the
  `ruling === 'survived'` branch and runs wherever the key is SET on any
  ruling; `RULING_KEYS` stays one flat allow-list and the key remains
  representable on `downgraded`/`refuted`, merely validated there. Rejected:
  per-ruling key sets (makes `fix_commit` the only key with a per-ruling
  allow-list, and the refusal reads "unknown key" rather than naming the
  field and the ruling, failing AC1 as written), and the stronger arm
  refusing even a well-formed `fix_commit` on a non-survived ruling.
  Evidence: `cadence-core/bin/lib/adjudication-record.mjs:147-155` already
  states the hoist as shipped design and issue #165 quotes that comment as
  asserting the opposite of the code; `:213` is the flat list; `:424-443` is
  the precedent that a ruling-specific rule ADDS a requirement rather than
  removing a key; `cadence-core/bin/adjudication-record.test.mjs:292-300`
  pins `counter_evidence` and `overridden` as carried "with no severity or
  ruling condition".
- D-02 (OQ-1, second half): `overridden: true` SURVIVES as a marker. AC3's
  alternative reading - refuse the marker by name - is not taken, because
  refusing it re-opens the representability defect that created it: an
  overridden blocker would again have no record at all, and the only ways to
  settle the fire become downgrading the finding or inventing a SHA.
  Evidence: `cadence-core/bin/lib/adjudication-record.mjs:164-188`,
  `cadence-core/references/review-record.md:98-108`,
  `cadence-core/bin/planning-adjudication.test.mjs:573-619`,
  `cadence-core/bin/adjudication-record.test.mjs:243-256`; v3.7.0 phase 2
  SUMMARY names `adjudication-record.mjs:365` as the refusal that left an
  `override` receipt with no record beside it.
- D-03 (join site): the `overridden` -> `override`-receipt join lives at
  `trace append`, beside `recountReceipt` - the only place in the tree where
  the record and the receipt are both in hand under a key that is proved
  rather than reconstructed. Rejected: `risk-check status` (would be
  `planning/risk-check.mjs`'s first filesystem read - it imports no
  `node:fs` today - and needs `recordForFire`, which `trace.mjs:1251` does
  not export) and the `adjudication` seam (inverts the documented write
  order, so `recountReceipt` finds no record and silently omits its count
  cross-check on exactly the fires carrying an override). Evidence:
  `cadence-core/bin/planning/trace.mjs:1140-1185`, `:1211-1246`, `:853-868`;
  `cadence-core/bin/planning-adjudication.test.mjs:587-604` and
  `cadence-core/references/triage-gate.md:78-92` pin the write order.
- D-04 (refusal shape): the refusal is phrased as a record/receipt
  CONTRADICTION, never keyed on an event name. `gate_pass` means "nothing
  blocker/high survived" while an overridden entry is by construction a
  survived blocker/high with no `fix_commit`, so the contradiction is
  already documented and needs no new coupling. [corrected by plan-1 deviation: the record
  schema PERMITS both `overridden: true` and a `fix_commit` on one entry -
  `cadence-core/bin/lib/adjudication-record.mjs:473` refuses only when NEITHER is present -
  so an overridden entry is not by construction one with no fix commit] Evidence:
  `cadence-core/bin/planning/trace.mjs:870-875` states the seam stays
  event-agnostic with "never a runtime refusal keyed to an event name", and
  `:860-864` states an absent record OMITS the check;
  `cadence-core/bin/planning/risk-check.mjs:359`,
  `cadence-core/references/triage-gate.md:94`. An event-name-keyed refusal
  would be the first in a seam whose comment says it has none, and the next
  reader deletes it as drift.
- D-05 (predicate home): the "unfixed halting survivor" test gets an
  ENTRIES-level entry point in `cadence-core/bin/lib/filing-decision.mjs`,
  with the existing payload-level path as the wrapper over it. The meaning
  stays in the module that already owns "genuinely unfixed", which is the
  module ROADMAP's OQ-2 rail names as the single definition phase 4 must
  reuse. Rejected: exporting a predicate from `lib/adjudication-record.mjs`
  beside `deriveCounts` (splits the meaning across two modules just before
  phase 4 needs it in one) and inlining the test in the seam (gives phase 4
  two definitions, which its own criterion 1 says a test must fail on).
  Evidence: `cadence-core/bin/lib/filing-decision.mjs:101-109` takes a
  payload and calls `buildEntries` itself;
  `cadence-core/bin/lib/adjudication-record.mjs:248` (`deriveCounts`) is the
  only entries-level export today and `trace.mjs:1233` is its consumer.
- D-06 (constraint scope): the new receipt requirement is scoped to
  `survived` entries at `blocker`/`high` ONLY. `overridden: true` on a
  `downgraded` or `refuted` entry, and on a survived medium or low, stays
  accepted with no receipt demanded. Evidence:
  `cadence-core/bin/adjudication-record.test.mjs:292-300` is a shipped test
  accepting `{ruling:'downgraded', overridden:true}`;
  `cadence-core/bin/lib/adjudication-record.mjs:180-186` states the marker's
  check is deliberately unscoped while what it BUYS is scoped. A join
  written over every `overridden` entry changes the marker's grammar, which
  RSK-08 does not ask for.

## Decisions

- D-07 (corpus): no record this project has written carries `fix_commit` on a
  non-`survived` ruling, so D-01 invalidates nothing and rests on design
  alone. Measured 2026-08-29 over every `ADJUDICATION-*.json` blob in
  `git rev-list --all --objects`: 77 unique blobs, 145 entries - `survived`
  64 (62 carrying `fix_commit`), `downgraded` 52, `refuted` 29,
  `fix_commit` on a non-survived ruling 0, `overridden` present 0.
- D-08 (silent drop): the hoist converts an accepted-then-dropped payload
  into a refusal, which is a behaviour change on inputs accepted today.
  Measured 2026-08-29 against the real `buildEntries`:
  `{ruling:'downgraded', fix_commit:'not-a-sha'}` returns `ok:true` and
  stores the garbage; `fix_commit:''` and `fix_commit:null` return `ok:true`
  with the key ABSENT from the stored entry. The drop is
  `cadence-core/bin/lib/adjudication-record.mjs:495`, whose
  `ruling.fix_commit ?` spread contradicts the "PRESENCE MEANS THE KEY IS
  SET, never that its value is truthy" rule at `:157-160`.
- D-09 (refusal text): the VALUE refusal at
  `cadence-core/bin/lib/adjudication-record.mjs:452-454` is re-worded to
  name the ruling, and that is free - the three tests covering the typo
  guard assert only the substring `no usable fix_commit`
  (`cadence-core/bin/adjudication-record.test.mjs:278`, `:354`, `:369`),
  never the word "survived". The PRESENCE refusal at `:462-467` is pinned
  harder by `:231-237` and its text does not move.
- D-10 (purity): the join cannot live in
  `cadence-core/bin/lib/adjudication-record.mjs`, so the pure module's
  `overridden` grammar is unchanged by this phase. Evidence: `:47-52` states
  the purity contract; `cadence-core/bin/planning/adjudication.mjs:30-34`
  restates the split. An fs read inside `buildEntries` also drags a
  repository dependency into `lib/filing-decision.mjs`, which calls it on a
  raw payload with no repo in hand.
- D-11 (vocabulary): `RULINGS` stays `survived | downgraded | refuted` and
  nothing this phase adds is a fourth value or a stored count. Evidence:
  `cadence-core/bin/lib/adjudication-record.mjs:110`, `:36-40`;
  `cadence-core/bin/adjudication-record.test.mjs:309-317`. A fourth value
  would need a new `FIRE_RECEIPTS` member
  (`cadence-core/bin/planning/risk-check.mjs:381`) and a new count flag in
  `recountReceipt`, which is phase 4's seam.
- D-12 (absent, not zero): applied here as key PRESENCE - a set-but-malformed
  `fix_commit` is refused rather than normalised away, and an entry never
  overridden carries no `overridden` key at all. Evidence:
  `cadence-core/bin/lib/adjudication-record.mjs:157-160`, `:180-186`;
  `cadence-core/bin/adjudication-record.test.mjs:302-307`, `:319-334`.
  Normalising a malformed value to absent would reproduce D-08's drop under
  a new name, and an auditor could not tell a fire that named no commit from
  one that named a broken string.
- D-13 (prose): `references/triage-gate.md` and `references/review-record.md`
  move in the SAME edit, and two shipped linters constrain the phrasing.
  `cadence-core/bin/prose-agreement.test.mjs:1515-1551` censuses every fenced
  `trace append --family outcome` line across both files and asserts the
  exact five event names plus `--trigger --plan --base --sha` on each;
  `:1584-1615` refuses any sentence matching `survived ... names a fix
  commit` that does not also say `blocker`. Today's statements sit at
  `cadence-core/references/triage-gate.md:67-92`, `:101-110`, `:283-286` and
  `cadence-core/references/review-record.md:88-108`.
- D-14 (tests): the tests land in the two existing files and
  `cadence-core/bin/test.mjs` needs no edit.
  `cadence-core/bin/planning-adjudication.test.mjs:530-619` already runs
  `risk-check run` -> adjudication -> `trace append` (both `gate_pass` and
  `override --detail-file`) -> `risk-check status`, and `:573-619` is the
  override case D-02 concerns;
  `cadence-core/bin/adjudication-record.test.mjs:592-621` (`seamRecord`)
  already drives a mixed `['survived','refuted','downgraded','refuted']`
  payload through the real seam. Baseline measured 2026-08-29: 108 pass, 0
  fail across the three adjudication test files. A new `planning-*` stem NOT
  added to the `planning` group at `cadence-core/bin/test.mjs:61-72` would be
  invisible to that group and to its CI matrix cell.
- D-15 (no new flag): the guard is unconditional on the paths that already
  exist, so this phase adds no CLI flag, no `CONTRACTS` row at
  `cadence-core/bin/lib/arg-contract.mjs:823`/`:906`, and no self-verify
  registration. An opt-in flag would make the guard something a caller can
  decline, which is the shape OQ-1 already rejects for the receipt itself.

## Acceptance criteria

- [ ] AC1: Writing a record whose `downgraded` or `refuted` entry carries
      `fix_commit: "not-a-sha"` returns a refusal whose detail names both the
      field and the ruling. The same value on a `survived` entry is refused by
      that same check, and the three existing assertions matching
      `/no usable fix_commit/` are green unchanged.
- [ ] AC2: A `downgraded` entry carrying `fix_commit: ""` or
      `fix_commit: null` is refused. Today both return `ok:true` with the key
      silently absent from the stored entry.
- [ ] AC3: `trace append` refuses a receipt settling a record that holds a
      survived blocker or high marked `overridden: true` when that receipt
      asserts no override; the refusal names the record/receipt contradiction
      rather than an event name, and nothing is appended. An
      `override --detail-file` receipt over the same record is accepted, and
      that accepted shape is stated in `references/triage-gate.md`.
- [ ] AC4: The ruling vocabulary is still exactly
      `survived | downgraded | refuted`, and `overridden: true` on a
      `downgraded` or `refuted` entry, or on a survived medium or low, is
      still accepted with no receipt demanded - both proved by
      `adjudication-record.test.mjs:292-300` and `:309-317` green unchanged.
- [ ] AC5: `lib/filing-decision.mjs` answers the unfixed-halting-survivor
      question over a written record's `entries[]`, and its payload face
      returns the identical answer for the same data, proved by one test
      driving both faces over one fixture.
- [ ] AC6: Reproduced end to end over a fixture carrying one entry of each
      ruling with at least one bad `fix_commit`: `risk-check run` ->
      adjudication -> receipt -> `risk-check status`, with the refusals
      landing where AC1 and AC3 say.
- [ ] AC7: `node cadence-core/bin/test.mjs` is green and `self-verify`
      reports `ok:true`.

## Flagged assumptions

- D-15's "no new CLI flag" is Likely, not settled: if the planner finds
  `recordForFire`'s implicit resolution too weak to refuse on, the named
  alternative is an explicit flag on `trace append` identifying the record
  being settled - which costs a `CONTRACTS` row and a prose line in both
  references. Planner's call; if wrong, the guard becomes declinable, which
  D-15 rejects.
- D-05 fixes WHERE the predicate lives but not which face wraps which. The
  entries-level entry point may be the primitive with the payload path
  calling it, or the payload path may stay primary with the entries face
  beside it. AC5 pins the observable - identical answers over one fixture -
  and leaves the shape to /cad-plan.
