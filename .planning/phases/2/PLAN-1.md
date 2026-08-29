---
phase: 2
plan: 1
requirements:
  - RSK-07
files:
  - cadence-core/bin/lib/adjudication-record.mjs
  - cadence-core/bin/adjudication-record.test.mjs
  - cadence-core/bin/filing-decision.test.mjs
  - cadence-core/bin/planning-adjudication.test.mjs
  - cadence-core/bin/trace.test.mjs
  - cadence-core/bin/deferred-queue.test.mjs
---

# Phase 2: a confirmed finding can be recorded unfixed - Plan 1

## Goal

`lib/adjudication-record.mjs` can store the two states it refuses today: a
finding confirmed at medium or low and left unfixed, and a blocker or high the
user overrode. Neither costs an invented commit id or a ruling the adjudicator
does not hold, and the misspelled-key refusal the `fix_commit` requirement
actually exists for is untouched.

## Must be true when done

- A `survived` ruling on a finding raised at `medium` or `low` that carries no
  `fix_commit` is accepted, and its entry is in the `ADJUDICATION-*.json` the
  real `planning.mjs adjudication` seam writes.
- A `survived` ruling on a finding raised at `blocker` or `high` that carries
  neither a fix commit nor the override marker is still refused, and a ruling
  spelling the key `fix_comit` is still refused for carrying an unknown key.
- A `survived` blocker or high the user overrode is accepted on an explicit
  override marker alone, and the record that lands carries that marker and no
  commit id anywhere on the entry.
- The GH-159 reproduction settles: a blocking fire whose highest finding is a
  medium writes its record, appends its `gate_pass` receipt with the counts the
  seam derived, and `risk-check status` answers satisfied for that range.
- An overridden blocking fire settles the same way through the `override`
  receipt, with the record present rather than absent.
- `RULINGS` still holds exactly three values, and every existing row that
  asserts that still passes untouched.

## Context

D-01 locks the mechanism: gate the `fix_commit` requirement on the RAISED
severity being blocker or high, never a fourth `RULINGS` value. `survived`
widens to mean "stood, fixed or not". A fourth value would need a fourth receipt
flag in `planning/trace.mjs`, a non-positional `SURVIVED_RULING`, and a rewrite
of the "no fourth ruling" invariant `lib/deferred-queue.mjs:27` and
`planning/deferred-record.mjs:34-36` both state - so `RULINGS` stays frozen at
three and D-04 holds by construction.
D-02 locks the second state: an OVERRIDDEN blocker/high is in scope and is
closed by an explicit marker on the ruling, standing in for the commit the
override settle point cannot produce (v3.7.0 phase 2's SUMMARY records this
found on a real run, with no `ADJUDICATION-risk_surface-plan-1.json` written).
D-03 locks what must survive: the UNKNOWN-KEY refusal, not the presence check.
It fires at `:319-320`, before the `survived` arm is reached, and is already
severity-independent.
D-08 locks the read path: nothing added here is applied when a stored record is
read back. `deriveCounts` and `parseAdjudication` stay as they are.
D-10 locks the fixtures: the AC3-era refusal rows are NARROWED, never deleted -
that refusal was locked in v3.5.6 and one of its three fixtures is the unfixed
survivor case.
Out of scope here and belonging to plan 2: `issue-filing.mjs`'s filter,
`lib/why-record.mjs` and `lib/why-render.mjs`, and every prose surface.

## Tasks

### Task 1: Gate the fix-commit requirement on the raised severity

- **Files:** cadence-core/bin/lib/adjudication-record.mjs, cadence-core/bin/adjudication-record.test.mjs
- **Action:** Start reading at the `survived` arm inside `buildEntries`, the
  `FIX_COMMIT` doc comment above it, and the `RULING_KEYS` comment; in the test
  file, at the four rows whose names begin `AC3:` and the unknown-key row.

  Give this module its own frozen list of the two severities a
  blocking gate halts over, declared beside `RAISED_SEVERITIES` and pinned by a
  test rather than imported. It must NOT import `HALTING_SEVERITIES` from
  `lib/filing-decision.mjs`: that module imports `buildEntries` from this one at
  its line 31, so the import would be a cycle. This is the same
  hand-maintained-then-compared shape `RAISED_SEVERITIES` already carries
  against `review-provider.mjs`'s `FINDING_SCHEMA`, and the pin is what stops
  the two lists drifting.

  Then change the `ruling.ruling === 'survived'` arm so the fix-commit
  requirement applies only when the RAISED severity of `findings[idx]` is in
  that list. Read the severity off the finding, never off the ruling - a ruling
  carries no severity and `filing-decision.mjs`'s own comment states why there
  is no second one to pick the wrong of. A survived medium or low carrying no
  `fix_commit` is ACCEPTED. A survived medium or low that DOES carry one still
  has it validated against `FIX_COMMIT` and still stores it, because D-07 keeps
  a voluntary fix on a medium able to cite its commit; a value that cannot be a
  commit id is refused at every severity, exactly as today.

  Do not touch `RULING_KEYS`, `unknownKey` or the refusal at `:319-320`. That is
  the guard D-03 says this phase must not lose, it is already
  severity-independent, and it fires before this arm is reached - the comment at
  `:132-137` attributes it to `additionalProperties: false` and not to the
  presence check, so nothing about it changes.

  Rewrite the two comments that now state a rule the code no longer holds: the
  `FIX_COMMIT` doc comment above the regex, and the `survived` arm's refusal
  sentence. The refusal must name the severity gate, so a caller reading it
  learns that a medium was never being asked for a commit rather than hunting a
  value it does not have. Write the module's canonical sentence for what
  `survived` now means into the `RULINGS` doc comment - that comment is one of
  AC5's four surfaces and plan 2's drift row reads it, so it must say plainly
  that a `survived` blocker or high names its fix commit and a `survived`
  finding below them is one that was confirmed and not fixed.

  In the test file, NARROW the AC3-era rows rather than deleting them (D-10).
  The `AC3: a survived entry with no fix commit is REFUSED` row and the blank/
  non-hexadecimal row lean on `finding()`'s default `severity: 'high'`; make that
  severity EXPLICIT at each of those call sites so the narrowing is visible in
  the row instead of riding a default that could change. Add rows for the new
  arm: a survived `medium` and a survived `low` with no `fix_commit` are
  accepted and their entries carry no `fix_commit` key at all; a survived
  `medium` carrying a valid one is accepted and stores it; a survived `medium`
  carrying `'zzzzzzz'` is still refused. Add the drift pin beside the existing
  `the severity vocabulary matches FINDING_SCHEMA's own enum` row at `:292`,
  comparing the new list against `HALTING_SEVERITIES` imported from
  `./lib/filing-decision.mjs`. Leave the unknown-key row at `:364-368` and its
  `fix_comit` case exactly as they are.
- **Verify:** `node --test cadence-core/bin/adjudication-record.test.mjs`
  passes. `node -e` calling `buildEntries` on a one-voice payload whose single
  finding is `severity: 'medium'` ruled `survived` with no `fix_commit` prints
  `ok: true` and an entry with no `fix_commit` key; the same payload at
  `severity: 'high'` prints `ok: false` with a detail naming blocker and high;
  the same payload at `severity: 'medium'` with the ruling key spelled
  `fix_comit` prints `ok: false` with a detail matching
  `carries an unknown key: fix_comit`.

### Task 2: Accept an overridden blocker or high on an explicit marker

- **Files:** cadence-core/bin/lib/adjudication-record.mjs, cadence-core/bin/adjudication-record.test.mjs
- **Action:** Start reading at `RULING_KEYS`, the `survived` arm, and the entry
  construction at the end of `buildEntries`' per-voice loop.

  Add one boolean ruling key, `overridden`, to `RULING_KEYS`. It has
  to be on that list or the unknown-key guard refuses the very entry this
  decision exists to admit - that is the flagged assumption CONTEXT records, and
  adding the key is what settles it.

  Two checks, in this order, and never one branch that skips the other. FIRST,
  the VALUE check, unconditional: whenever `fix_commit` is PRESENT on a
  `survived` ruling it is validated against `FIX_COMMIT` and a value that cannot
  be a commit id is refused - at every severity, and whether or not `overridden`
  is set. That is the sentence Task 1 wrote, and the marker does not buy an
  exemption from it: an auditor runs `git show` on whatever the entry carries,
  so a junk id stored beside an override fails them exactly as one stored alone
  does. SECOND, the PRESENCE requirement, which is the only thing the marker
  satisfies: a blocker or high must carry EITHER a `fix_commit` (which has
  already passed the value check above) OR `overridden` set to the boolean
  `true`. Accept only the boolean literal: a string, a number or `false` is
  refused by a detail naming the marker, because a truthy string would otherwise
  buy a clear that nobody stated and `false` means the finding was not
  overridden at all. Do not add a refusal for a ruling carrying both the marker
  and a commit - that combination is legal, and the value check above is what
  keeps it honest - and do not refuse the marker on a `downgraded`, a `refuted`
  or a medium: `counter_evidence` is likewise carried without a severity or
  ruling restriction, and one locked decision does not license a second check
  beside it. Extend the refusal sentence Task 1 wrote so it names both ways out
  of the PRESENCE requirement, since a coordinator settling an override reads
  that sentence and has no commit to offer.

  Carry the marker onto the entry the same way `counter_evidence` and
  `fix_commit` are carried - conditionally spread, so an ordinary entry gains no
  key - and state in the comment why an overridden entry has no commit id: the
  override settle point in `references/triage-gate.md` produces a user's reason
  on the receipt and no commit, so a SHA there would be fabricated.

  Add rows: an overridden survived blocker with no `fix_commit` is accepted and
  its entry carries the marker and no `fix_commit`; the same entry with
  `overridden` set to the string `'yes'`, to `1` and to `false` is refused each
  time; an overridden survived blocker carrying `fix_commit: 'zzzzzzz'` is
  REFUSED by the value check, because that is the combination in which the
  marker could otherwise buy a pass for a malformed id, and the existing
  `'zzzzzzz'` row at `adjudication-record.test.mjs:224-234` carries no marker
  and so cannot catch it; an overridden survived blocker carrying a VALID
  `fix_commit` is accepted and its entry carries both keys; a survived high
  carrying neither is still refused; `RULINGS` still has three values.
- **Verify:** `node --test cadence-core/bin/adjudication-record.test.mjs`
  passes, including a row proving an overridden survived blocker is accepted
  with no commit id on the entry, a row proving a non-boolean marker is
  refused, and a row proving `overridden: true` beside a malformed `fix_commit`
  is refused rather than stored. `node --test 'cadence-core/bin/*.test.mjs'` is
  green.

### Task 3: Stop the shared payload fixtures encoding the old rule

- **Files:** cadence-core/bin/filing-decision.test.mjs, cadence-core/bin/trace.test.mjs, cadence-core/bin/planning-adjudication.test.mjs, cadence-core/bin/deferred-queue.test.mjs
- **Action:** Start reading at each file's payload fixture: the `ruling` builder
  and the `a survived blocker stays behind` row in `filing-decision.test.mjs`,
  `firePayload` in `trace.test.mjs`, the payload helper in
  `planning-adjudication.test.mjs`, and the malformed-finding case list in
  `deferred-queue.test.mjs`.

  Four files build a `survived` fixture that attaches a
  `fix_commit` unconditionally, and after Task 1 each of them is either wrong or
  incidentally still right - D-10 requires the difference to be decided
  deliberately, one file at a time, rather than discovered by whichever row
  happens to go red.

  In `filing-decision.test.mjs`, the builder attaches `fix_commit: 'a1b2c3d'` to
  every `survived` ruling, so the `remainder` finding in the
  `a survived blocker stays behind; a downgraded high and a survived low are the
  set` row is a survived LOW carrying a fix commit - a shape that says the gate
  fixed a finding it never asked to have fixed. Make the attachment conditional
  on the finding's severity being blocker or high, so the survived low goes
  through with no commit, and keep the row's assertion unchanged: the two-field
  rule in `unfixedFindings` is untouched by this phase (D-07) and that low must
  still be in the set.

  In `trace.test.mjs` and `planning-adjudication.test.mjs`, read the fixture's
  own severity before changing anything: both raise their findings at `high`, so
  an unconditional fix commit is still exactly correct there and the right
  deliberate act is to leave the payload alone. Where the file's comment implies
  the commit rides every `survived` ruling regardless of severity, correct that
  sentence and nothing else.

  In `deferred-queue.test.mjs`, the `fix_commit` case in the malformed-finding
  list pins that key as UNKNOWN on a queue member's FINDING, which is a
  different grammar from a ruling and is unaffected by Task 1 and Task 2. Leave
  the row and its expected sentence exactly as they are; the point of declaring
  the file is that this was checked rather than assumed.
- **Verify:** `node --test cadence-core/bin/filing-decision.test.mjs
  cadence-core/bin/trace.test.mjs
  cadence-core/bin/planning-adjudication.test.mjs
  cadence-core/bin/deferred-queue.test.mjs` passes, and `git diff` shows
  `filing-decision.test.mjs`'s builder attaching the commit only at blocker and
  high while `deferred-queue.test.mjs`'s `carries an unknown key: fix_commit`
  expectation is unchanged.

### Task 4: The GH-159 reproduction settles end to end

- **Files:** cadence-core/bin/planning-adjudication.test.mjs
- **Action:** The new row goes beside the existing end-to-end rows in this file,
  the ones that already run `risk-check run`, `trace append` and `risk-check
  status` as real seams over a scratch git repository - start reading there.

  Add the reproduction the roadmap's fifth success criterion names,
  as one row over the real seams: a blocking fire whose highest finding is a
  `medium`, ruled `survived` with no fix commit. Run `risk-check run` over the
  scratch repository's range, write the payload to a file, run
  `planning.mjs adjudication` with it, append the `gate_pass` outcome receipt
  carrying the `--survivors`, `--downgraded` and `--refuted` figures the
  adjudication envelope returned, and run `risk-check status` over the same
  range.

  Every one of those four steps must answer `ok: true`, and the assertion that
  carries the criterion is the last: `status` reports the range satisfied rather
  than unfired. The receipt's counts must be the seam's own figures rather than
  numbers the row types beside them - `recountReceipt` in `planning/trace.mjs`
  recomputes them from the record's rulings and refuses a receipt that
  disagrees, so passing the envelope's figures is what proves the medium's
  entry reached the stored record and was counted as a survivor.

  Assert the written `ADJUDICATION-*.json` holds one entry whose `ruling` is
  `survived`, whose `severity` is `medium`, and which carries no `fix_commit`
  key. Before Task 1 this fire could not be settled at all, which is the state
  the row exists to keep closed.
- **Verify:** `node --test cadence-core/bin/planning-adjudication.test.mjs`
  passes, with the new row showing `risk-check status` answering satisfied for a
  fire whose only finding is a survived medium with no fix commit, and the
  record on disk carrying that entry.

### Task 5: An overridden fire settles end to end

- **Files:** cadence-core/bin/planning-adjudication.test.mjs
- **Action:** Add the second end-to-end row, for D-02's case: a blocking fire
  whose finding is a `blocker` ruled `survived` with the override marker and no
  fix commit. Same four real seams as Task 4, with the `override` outcome event
  in place of `gate_pass`.

  The `override` receipt is the one `planning/risk-check.mjs:718-721` skips when
  its reason is empty, so append it with the user's reason through
  `--detail-file` - a reason on an inline `--detail` is not the transport this
  receipt takes, and an empty one is silently not a receipt at all. Assert
  `risk-check status` answers the range satisfied, and assert the record on disk
  carries the entry with its override marker and no `fix_commit` key anywhere on
  it.

  This is the exact run `.planning/ARCHIVE.md:724` records as having written an
  `override` receipt with no adjudication record beside it, because the record
  seam refused the only ruling the adjudicator held. The row is what stops that
  recurring.
- **Verify:** `node --test cadence-core/bin/planning-adjudication.test.mjs`
  passes with both end-to-end rows. `node --test
  'cadence-core/bin/*.test.mjs'` is green, and
  `node cadence-core/bin/self-verify.mjs` reports no new problem.

## Notes

- The override marker's shape was the planner's call under CONTEXT's first
  flagged assumption. Chosen: a boolean `overridden` key on the ruling, added to
  `RULING_KEYS` so D-03's unknown-key guard admits it. A reason string was
  rejected because `references/triage-gate.md:98-107` already puts the user's
  own words on the `override` receipt through `--detail-file`, and a second copy
  on the entry is a second statement that can drift.
- AC7's second half - the ten pre-change records still read without a refusal -
  is verified in plan 2, because one of the three readers it names is the one
  plan 2 changes.
- CONTEXT's third flagged assumption holds: Tasks 4 and 5 reach a written
  receipt and a satisfied `risk-check status` with no live review provider,
  because every step is a local seam over a hand-written payload. Neither task
  needs `OPENAI_API_KEY`.

### Open items from the `plan` review, unrecorded by design

The `plan` gate passed (no blocker/high survives round two), but its own settle
could not write `ADJUDICATION-plan-*.json`: `planning.mjs adjudication` and
`issue-filing.mjs unfixed` both refuse a `survived` ruling that names no fix
commit, which is GH-159 firing on the review that planned its own fix. Nothing
was downgraded to force the record through - a downgrade converts "reported and
moved past" into "passed", which is the corruption this phase exists to end.
So the findings live HERE until phase 2 makes them recordable. The `gate_pass`
receipt at `42e5eb57..308c8a58` is on the record; the rulings are not.

Confirmed against the cited code, not fixed, and in scope for an executor to
notice while working these tasks:

- **Task 1 / Task 2 contradict each other about `RULING_KEYS`** (low). Task 1
  says "Do not touch `RULING_KEYS`"; Task 2 requires adding `overridden` to it.
  Task 1's prohibition is meant to protect the unknown-key REFUSAL at
  `lib/adjudication-record.mjs:319-320`, not the key list - an executor that
  honours it literally ships Task 2 with `overridden` absent from the list, and
  every overridden ruling is refused as an unknown key. Read Task 1's
  prohibition as scoped to the refusal.
- **"PRESENT" in Task 2's value check is undefined** (medium). The plan's only
  other use of the idea is the truthiness spread (`ruling.fix_commit ? ...`), so
  an executor reading presence as truthiness loses the refusal for FALSY
  malformed values - `''`, `null`, `0` - which `:367`'s
  `typeof ruling.fix_commit !== 'string' || !FIX_COMMIT.test(...)` refuses
  today. Presence means the KEY IS SET (`!== undefined`), never truthiness, and
  a row over `fix_commit: null` at a medium is what would prove it.
- **The comment Task 2 orders overstates its own rule** (low). "An overridden
  entry has no commit id" is disproved by Task 2's own new row, where an
  overridden blocker carrying a valid `fix_commit` is accepted with BOTH keys.
  Scope that comment to the marker-ALONE case.
