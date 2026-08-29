---
phase: 1
plan: 1
requirements: [RSK-08]
files:
  - cadence-core/bin/lib/adjudication-record.mjs
  - cadence-core/bin/lib/filing-decision.mjs
  - cadence-core/bin/planning/trace.mjs
  - cadence-core/bin/adjudication-record.test.mjs
  - cadence-core/bin/planning-adjudication.test.mjs
  - cadence-core/references/triage-gate.md
  - cadence-core/references/review-record.md
  - cadence-core/bin/weight-budgets.json
  - cadence-core/bin/self-verify.test.mjs
  - cadence-core/bin/trace.test.mjs
  - cadence-core/bin/planning-lease-check.test.mjs
  - cadence-core/bin/phase-spelling.test.mjs
---

# Phase 1: The record's guards hold for every ruling - Plan

## Goal

`lib/adjudication-record.mjs` validates a `fix_commit` value wherever one is
stored rather than only under `ruling === 'survived'`, and `overridden: true` no
longer discharges the module's strongest refusal on an unverifiable
self-assertion.

## Must be true when done

- Writing a record whose `downgraded` or `refuted` entry sets `fix_commit` to a
  value `git show` cannot spend is REFUSED, and the refusal names both the field
  and the ruling. The same value on a `survived` entry is refused by that one
  same check.
- A `downgraded` entry setting `fix_commit` to `""` or to `null` is refused.
  Today both are accepted and the key is silently absent from the stored entry.
- `trace append` refuses a settle receipt that carries no reason at all when the
  record it settles holds a survived `blocker` or `high` marked
  `overridden: true`, and nothing is appended. The same record settled by an
  `override --detail-file` receipt is accepted.
- The tree holds exactly ONE statement of which entries of a record are unfixed
  halting survivors, exported from `lib/filing-decision.mjs`, and both its
  entries face and `unfixedFindings` answer from that one statement.
- The ruling vocabulary is still exactly `survived | downgraded | refuted`, and
  `overridden: true` on a `downgraded` or `refuted` entry, or on a survived
  `medium` or `low`, is still accepted with no receipt demanded.
- `references/triage-gate.md` states the accepted override settle shape and
  `references/review-record.md` states that a `fix_commit` set on ANY ruling has
  to be a real commit id.
- `node cadence-core/bin/test.mjs` is green and
  `node cadence-core/bin/self-verify.mjs` reports `ok:true`.

## Context

Locked by `phases/1/CONTEXT.md`: the VALUE check is HOISTED, not made
unrepresentable (D-01); `overridden: true` SURVIVES as a marker (D-02); the
receipt join lives at `trace append` beside `recountReceipt` (D-03); the refusal
is phrased as a record/receipt contradiction and never keyed on an event name
(D-04); the predicate's home is `lib/filing-decision.mjs` (D-05); the new
requirement is scoped to survived `blocker`/`high` only (D-06); no new CLI flag,
no `CONTRACTS` row, no self-verify registration (D-15).
Out of scope: the ruling vocabulary, the record's no-stored-count rule, and
anything `land-cleanup.mjs` reads - phase 4 consumes this seam and owns the
gate's halt decision.
Baseline measured 2026-08-29: 108 pass / 0 fail across
`adjudication-record.test.mjs`, `planning-adjudication.test.mjs` and
`filing-decision.test.mjs`; `self-verify` `ok:true`.

## Tasks

### Task 1: Hoist the `fix_commit` VALUE check out of the `survived` branch

- **Files:** cadence-core/bin/lib/adjudication-record.mjs (start at the
  `FIX_COMMIT` doc comment and at the `ruling.ruling === 'survived'` arm inside
  `buildEntries`), cadence-core/bin/adjudication-record.test.mjs
- **Action:** In `buildEntries` the `fix_commit` VALUE test sits inside the
  `ruling.ruling === 'survived'` arm, so a `downgraded` or `refuted` ruling
  stores an arbitrary unspendable string. Move that test OUT of the arm so it
  runs wherever the key is SET, on every ruling. Presence is read as
  `!== undefined` and never as truthiness, so `''` and `null` are refused rather
  than dropped (D-12) - measured today, `{ruling:'downgraded', fix_commit:''}`
  and `fix_commit:null` both return `ok:true` with the key absent from the
  stored entry, and `fix_commit:'not-a-sha'` returns `ok:true` and stores the
  garbage. `RULING_KEYS` stays ONE flat allow-list and `fix_commit` stays
  representable on `downgraded` and `refuted`: this validates the key there, it
  does not forbid it, and refusing a well-formed `fix_commit` on a non-survived
  ruling is the stronger arm CONTEXT explicitly rejected (D-01). Re-word that
  refusal so it names the RULING as well as the field (D-09), keeping the
  substring `no usable fix_commit`, which is the whole of what the three shipped
  assertions match on. Leave the PRESENCE requirement exactly where it is, still
  gated on `HALTING_SEVERITIES` read off the FINDING, and leave its wording
  alone - it is pinned harder and its text does not move. Update the `FIX_COMMIT`
  doc comment, which today scopes the VALUE check to "wherever a `survived`
  ruling SETS `fix_commit`" and is the sentence issue #165 quotes as asserting
  the opposite of the code; it must state the hoisted rule. Align the entry-emit
  spread that conditions on `ruling.fix_commit` being truthy so it conditions on
  the key being SET - D-08 names that spread as today's silent drop site and it
  contradicts this module's own "PRESENCE MEANS THE KEY IS SET, never that its
  value is truthy" rule; after the hoist the two forms are behaviour-identical,
  so this is the code stating the rule rather than a second change. Add no
  per-ruling key set, do not touch `RULINGS` or `RAISED_SEVERITIES`, and
  introduce no sentence matching "survived ... names a fix commit" without the
  word blocker - `prose-agreement.test.mjs` scans this file for exactly that and
  refuses it. Add the arms that pin the new behaviour to
  `adjudication-record.test.mjs` beside the existing `fix_commit` section, using
  that file's own `finding`/`ruling`/`voice`/`payload` helpers.
- **Verify:** `node --test cadence-core/bin/adjudication-record.test.mjs`
  reports 0 fail, with every pre-existing arm green - in particular the three
  matching `/no usable fix_commit/`, `the marker is not restricted to survived,
  nor to a severity`, and `the ruling enum is exactly three values` - and with
  new arms proving that a `downgraded` entry and a `refuted` entry each carrying
  `fix_commit: 'not-a-sha'`, `''` and `null` are refused, the detail naming both
  `fix_commit` and the ruling word. Against the pre-task tree the
  `'not-a-sha'` row returns `ok:true` and stores the string.

### Task 2: Give the unfixed-halting-survivor test one entries-level home

- **Files:** cadence-core/bin/lib/filing-decision.mjs (start at
  `unfixedFindings` and `HALTING_SEVERITIES`),
  cadence-core/bin/adjudication-record.test.mjs
- **Action:** `unfixedFindings` calls `buildEntries` and then states the
  three-field test inline in its filter, so the meaning of "the one halting
  survivor nobody is fixing" exists only inside a payload-level function. Split
  that test into a new export taking a built record's `entries[]` - the array
  `buildEntries` returns, which is the same array a written `ADJUDICATION-*.json`
  stores - answering in one pass both which of those entries are unfixed halting
  survivors (`survived`, raised at a `HALTING_SEVERITIES` level, carrying the
  `overridden: true` marker, which this module's own comment already calls the
  single case where "survived at a halting severity" stops implying a commit is
  coming) and the filing set `unfixedFindings` returns today. CONTEXT's flagged
  assumption leaves the face shape to planning; the choice recorded here is that
  the entries face is the PRIMITIVE and `unfixedFindings` becomes the wrapper -
  it keeps its signature, keeps passing `buildEntries`'s own `detail` through on
  `ok:false`, returns the identical array it returns today, and reads its set off
  the new export rather than restating the filter. Afterwards the three-field
  test must exist in exactly ONE place in the tree: phase 4's own criterion 1
  fails on a second definition, and inlining it in a seam was rejected for that
  reason. Do not read `fix_commit` in the new export - D-07's split leaves the
  already-committed removal to `issue-filing.mjs`'s `cmdUnfixed`, one layer up -
  and do not export a predicate from `lib/adjudication-record.mjs`, which was
  rejected for splitting the meaning across two modules just before phase 4 needs
  it in one. The module stays pure: node builtins plus `buildEntries`, no fs, no
  git, no process. Prove both faces in `adjudication-record.test.mjs`, which
  already imports from both modules.
- **Verify:** `node --test cadence-core/bin/filing-decision.test.mjs` and
  `node --test cadence-core/bin/issue-filing.test.mjs` are green with no edit to
  either file, and `node --test cadence-core/bin/adjudication-record.test.mjs`
  is green with a new arm that drives ONE fixture - a survived-and-overridden
  blocker, a survived blocker citing a real commit id, a survived medium, a
  downgraded entry and a refuted entry - through both faces and asserts that the
  filing set from the entries face and the set from `unfixedFindings` over the
  same payload are deep-equal, and that the entries face names exactly the
  overridden blocker as the unfixed halting survivor.

### Task 3: Join `overridden: true` to the receipt at `trace append`

- **Files:** cadence-core/bin/planning/trace.mjs (start at `recountReceipt`,
  `recordForFire` and the `recount` call inside `cmdTrace`'s append arm),
  cadence-core/bin/planning-adjudication.test.mjs
- **Action:** `trace append` is the only place in the tree where a fire's
  receipt and its adjudication record are both in hand under a key that is
  PROVED rather than reconstructed, so the marker's join lives there (D-03;
  `risk-check status` and the `adjudication` seam were both rejected, the second
  because it inverts the documented write order and would leave `recountReceipt`
  finding no record). Add a function beside `recountReceipt` that resolves this
  fire's record through the existing `recordForFire` with the same `dir`, phase,
  trigger, plan, sha and round the recount is given, reads it, asks
  `lib/filing-decision.mjs`'s entries-level export whether the stored entries
  hold an unfixed halting survivor, and refuses the append when they do while the
  receipt carries no reason at all. Call it from the append arm immediately after
  the `recountReceipt` call and before `appendEvent`, through the same `fail(...)`
  shape, so a refusal appends nothing. Run it whenever ANY of the three settled
  figures is present, which still keeps `rearm` and `deferral`, the two receipts
  that carry no figures, out of scope. Do NOT copy `recountReceipt`'s all-three
  precondition: that one exists because a partial set cannot be checked against a
  recount answering all three, and this check recounts nothing - inherited, it
  would let a caller discharge the marker by dropping one figure from the settle
  line, which is the self-assertion this guard exists to stop. An
  absent or unreadable record OMITS the check, exactly as `recordForFire` and the
  recount already declare, because a cross-check that cannot resolve its record
  must never fail an append. The thing the receipt is tested for is the user's own
  words, already resolved onto `detail` at the top of the append arm:
  `--detail-file` is the transport `references/triage-gate.md` states for an
  override, and `planning/risk-check.mjs` already refuses an `override` receipt
  whose reason is empty, so a receipt carrying no reason at all over a record
  holding a halt the user cleared reads as a clean settle. The refusal detail
  must name the CONTRADICTION - the record holds a survived blocker or high that
  STOOD with no fix commit, and this receipt says nothing about why - and must
  neither mention nor branch on an event name (D-04): this seam's own comment
  states it carries no runtime refusal keyed to an event name, and the first one
  would be read as drift and deleted. Add no CLI flag, no `CONTRACTS` row in
  `lib/arg-contract.mjs` and no self-verify registration (D-15) - an opt-in flag
  would make the guard declinable, which is the shape OQ-1 already rejects.
  Import from `lib/filing-decision.mjs` rather than restating the test; there is
  no cycle, that module imports only `node:crypto` and `buildEntries`.
- **Verify:** `node --test cadence-core/bin/trace.test.mjs` is green with no edit
  to it, and `node --test cadence-core/bin/planning-adjudication.test.mjs` is
  green with the shipped `an OVERRIDDEN blocking fire settles end to end` arm
  unchanged and passing (its `override --detail-file` receipt is still accepted),
  plus a new arm proving that over that same written record a settle receipt
  carrying the same three settled figures and NO reason returns `ok:false`, its
  detail naming the record and the survived blocker rather than any event name,
  and that `.planning/trace.jsonl` gained no event from the refused call; plus an
  arm over that same record proving a reasonless receipt carrying only TWO of the
  three settled figures is refused by the same check, so the guard cannot be
  discharged by omitting a figure.

### Task 4: Reproduce both refusals end to end over a mixed-ruling fixture

- **Files:** cadence-core/bin/planning-adjudication.test.mjs (start at
  `deferralRepo`, `plRun`, `survivedPayload` and `survivedPayloadFile`)
- **Action:** Add the end-to-end reproduction phase criterion 4 and AC6 name,
  using the harness already in this file rather than a new fixture harness
  (D-14): `deferralRepo` for the scratch repository and matched range, `plRun`
  for every seam call. One fixture, one voice, carrying one entry of EACH ruling
  - a `survived`, a `downgraded` and a `refuted` - where the entry setting a
  `fix_commit` that `git show` cannot spend is the `downgraded` one or the
  `refuted` one, NEVER the `survived` one: the pre-phase code already refuses a
  bad value on a `survived` ruling, so a fixture that puts it there passes every
  assertion below without exercising the path task 1 adds. Walk `risk-check run`,
  then `adjudication`, then the settle receipt, then `risk-check status`, and
  assert where each refusal lands: the bad-value payload is REFUSED by the
  adjudication seam with the detail naming the field and the ruling (task 1's
  guard), the corrected payload records, and a record holding a survived blocker
  marked `overridden: true` refuses a reasonless settle receipt while the
  `override --detail-file` receipt is accepted and leaves `risk-check status`
  reporting the range `recorded` (task 3's guard). Assert the STORED bytes, not
  only the envelopes - read the written `ADJUDICATION-*.json` back and check the
  entries it holds - because an envelope that says `ok:true` is not evidence the
  entry reached the record. Add nothing to `cadence-core/bin/test.mjs`: this stem
  is already a member of the `planning` group, and a new `planning-*` stem would
  be invisible to that group and to its CI matrix cell.
- **Verify:** `node cadence-core/bin/test.mjs planning` is green, and the new arm
  reports the chain running end to end: `risk-check run` `ok:true`, the
  bad-`fix_commit` `adjudication` call `ok:false` naming the field and the
  ruling, the corrected `adjudication` call `ok:true`, the reasonless receipt
  `ok:false` with nothing appended, the `override --detail-file` receipt
  `ok:true`, and `risk-check status` `ok:true` with the plan's state `recorded`.

### Task 5: State both rules in the two references and re-pin their ceilings

- **Files:** cadence-core/references/review-record.md (start at the
  `survived`-ruling paragraph that states the `fix_commit` rule),
  cadence-core/references/triage-gate.md (start at the `override` settle-point
  paragraph and its fenced receipt command),
  cadence-core/bin/weight-budgets.json
- **Action:** Both references move in the SAME edit (D-13). In
  `review-record.md`, the payload-composition prose says only what a `survived`
  ruling does with `fix_commit`; it must also state that the value is checked
  wherever the key is SET, on ANY ruling - a `downgraded` or `refuted` ruling may
  carry one and it has to be a real commit id, and a blank or junk value is
  refused rather than quietly dropped. In `triage-gate.md`, state the ACCEPTED
  override settle shape at the `override` settle point: when the record for this
  fire holds a survived `blocker` or `high` marked `overridden: true`, the settle
  receipt carries the user's own reason on `--detail-file`, and a receipt
  carrying no reason at all is refused with nothing appended. Keep both files
  inside the linters that already bind them - do not add or remove a fenced
  `trace append --family outcome` command, since `prose-agreement.test.mjs`
  censuses those across both files and asserts exactly the five event names with
  `--trigger --plan --base --sha` on each; do not add a second `trace render`
  call to `triage-gate.md`, which another census pins at exactly one; do not
  write an inline `--detail "..."` anywhere, which would need a new row in
  `lib/text-transport.mjs`'s register; keep the phrase "confirmed and not fixed"
  in both files; and write no sentence matching "survived ... names a fix commit"
  that does not also say `blocker`. Both files sit EXACTLY at their ceiling in
  `weight-budgets.json` today (`triage-gate.md` 23006, `review-record.md` 7259),
  so any growth is a `budget-overrun` in self-verify's budget check - raise both
  entries to the new measured byte counts in this same commit.
- **Verify:** `node cadence-core/bin/self-verify.mjs` reports `ok:true` with an
  empty `problems` array, `node --test cadence-core/bin/prose-agreement.test.mjs`
  is green, and `node cadence-core/bin/test.mjs` is green across every group.

## Notes

- One plan, matching CONTEXT's `Plan shape` directive. The independence test
  forbids anything else here: tasks 1, 2 and 3 share the meaning being moved,
  tasks 1 and 2 both write `adjudication-record.test.mjs`, and tasks 3 and 4
  both write `planning-adjudication.test.mjs`.
- Two CONTEXT items were resolved by reading the tree rather than by a task.
  D-05's flagged assumption ("which face wraps which") is answered in task 2:
  entries face primitive, payload face wrapper. D-15's flagged assumption ("no
  new CLI flag" is Likely, not settled) holds - `recordForFire` already resolves
  the record from `--trigger`, `--plan`, `--sha` and `--round` under a rule the
  writer and the recount share, and `recountReceipt` already refuses a receipt on
  that resolution, so the join rests on a resolution the tree already trusts to
  refuse on. No `--record`-style flag is planned.
- One file the CONTEXT decisions do not name is in the lease and is NOT optional:
  `cadence-core/bin/weight-budgets.json`. `triage-gate.md` and
  `review-record.md` are each byte-for-byte at their ceiling right now, so
  task 5's prose edit fails `self-verify`'s budget check without it, and AC7
  requires `self-verify` `ok:true`.
- A recalled v3.7.7 phase 2 UAT finding - `triage-gate.md:281-282` telling the
  coordinator a survived blocker/high can never be in the unfixed set - was
  checked against the current file and is already repaired at commit `3341ffb0`
  (the text now reads "UNLESS it carries `overridden: true`"). No task re-fixes
  it.
- `cadence-core/bin/filing-decision.test.mjs` is deliberately NOT in the lease.
  Task 2 preserves `unfixedFindings`'s signature and its returned array exactly,
  so that file's 20 shipped arms are the regression proof and stay untouched;
  AC5's both-faces arm goes to `adjudication-record.test.mjs`, which already
  imports from both modules, per D-14's "the two existing files".
