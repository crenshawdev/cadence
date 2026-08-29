# Phase 2: a confirmed finding can be recorded unfixed - Context

Gathered: 2026-08-28
Feeds: /cad-plan 2

## Scope boundary

In: making a blocking gate's below-blocker/high remainder representable in
`lib/adjudication-record.mjs` by gating the `fix_commit` requirement on the
raised severity; the same line's second unrepresentable state, an OVERRIDDEN
blocker/high, closed by an explicit override marker; the filing predicate's
consumer so `issue-filing unfixed` stops offering findings whose fix is already
committed; the four prose surfaces that state what `survived` means and the
drift test that pins them together; and `why record`'s renderer, which after the
widening cannot otherwise tell a fixed survivor from an unfixed one.
Out: a fourth `RULINGS` value (ROADMAP OQ-2, settled as D-01) and everything
that would follow it - no fourth receipt flag, no change to `recountReceipt`,
no change to the deferred arm's "no fourth ruling" D-09 invariant. Out: the
unknown-key typo guard, which is untouched by construction (D-03). Out: any
new rule applied on a READ path (D-08). Out: `.planning/reads.jsonl` rotation,
which was phase 1.
Deferred: None.
Plan shape: multiple plans, same phase - the seam change (AC1-AC3, in
`adjudication-record.mjs` plus the six test files whose fixtures encode the old
rule) and the consumers it makes wrong (AC4-AC6, in `issue-filing.mjs`,
`why-record.mjs`/`why.mjs`, four reference docs and one prose-agreement row) are
different files, and the second only settles once the first exists.

## Durable decisions

- D-01 (The ruling vocabulary - ROADMAP OQ-2): close GH-159 by gating the
  `fix_commit` requirement on the raised severity being blocker or high - the
  predicate `cadence-core/bin/lib/filing-decision.mjs:76-79` already uses -
  rather than by adding a fourth `RULINGS` value. `survived` widens to mean
  "stood, fixed or not". Evidence: `RULINGS` at
  `cadence-core/bin/lib/adjudication-record.mjs:79`, the requirement at `:366`;
  a fourth value has a measured blast radius the roadmap's three-file criterion
  does not name - `cadence-core/bin/planning/trace.mjs:1211-1246`
  (`recountReceipt` checks exactly `survivors|downgraded|refuted`) and `:715`
  (three flags parsed), `cadence-core/bin/lib/why-record.mjs:452-462`
  (`SURVIVED_RULING = RULINGS[0]`, positional),
  `cadence-core/bin/why-record.test.mjs:324` (`assert.equal(RULINGS.length, 3,
  'a fourth ruling would need a decision here, not a silent pass')`),
  `cadence-core/bin/lib/deferred-queue.mjs:27` and
  `cadence-core/bin/planning/deferred-record.mjs:34-36` (both state "no fourth
  ruling" as a D-09 invariant), `cadence-core/references/review-record.md:17,81,87`,
  `cadence-core/references/triage-gate.md:34-36,95,106`. If wrong: a fourth
  ruling lands with no fourth receipt flag, so `deriveCounts`
  (`adjudication-record.mjs:179-186`) counts it in `raised` and in no bucket,
  `recountReceipt` passes a receipt whose three figures silently omit every
  confirmed-unfixed finding, and the "the count is DERIVED from the record"
  cross-check stops detecting the exact category this phase creates.
- D-02 (The override case): an OVERRIDDEN blocker/high is in scope this phase
  and is closed by an explicit override marker on the ruling, standing in for
  the commit the override settle point cannot produce. It is DISTINCT from
  GH-159's remainder under D-01: an override is by definition a blocker/high
  that survived unfixed, which is exactly the severity a severity-gated
  requirement keeps refusing. Evidence:
  `cadence-core/references/triage-gate.md:64-73` ("both settle points below - a
  `gate_pass` and an `override` - carry no finding body at all without it") and
  `:98-107` (the `override` receipt is written when the user overrides a FAIL);
  `.planning/ARCHIVE.md:724` records that no `ADJUDICATION-risk_surface-plan-1.json`
  was ever written for that override; v3.7.0 phase 2 SUMMARY records the same
  defect found on a real run. If wrong: the phase ships, GH-159 closes, and the
  next user override still cannot write its adjudication record - the second
  unrepresentable state stays open under a different issue number.
- D-08 (No rule on the read path): nothing this phase adds is applied when a
  stored record is READ back; the readers stay fail-soft over records written
  by earlier versions of the writer. Evidence: `planning/trace.mjs:1233` (the
  recount uses `deriveCounts` over `record.entries`, not `buildEntries`),
  `lib/why-record.mjs:443-449` (an explicitly fail-soft second reader, "over
  records written months ago by earlier versions of that writer"),
  `lib/filing-decision.mjs:74-76` (validates the composed PAYLOAD, written at
  fire time). Measured 2026-08-28 over 10 distinct records recovered from git
  history: `3 high survived HASFIX`, `6 medium downgraded`, `3 low downgraded`,
  `2 medium refuted`, `2 high refuted`, `3 high downgraded`, `1 blocker
  downgraded`, `1 blocker refuted` - no `survived` entry below `high` exists in
  history, so the corpus is consistent with today's reading either way. If
  wrong: a stricter rule on the read path makes `why record` and `trace` refuse
  historical records, deleting the evidence base those commands exist to serve.

## Decisions

- D-03 (The typo guard): the guard `GH-159` must not lose is the unknown-key
  refusal, NOT the `fix_commit` presence check, so it survives D-01 untouched.
  Evidence: `lib/adjudication-record.mjs:141` (`RULING_KEYS`), `:150-153`
  (`unknownKey`), `:319-320` (the refusal that fires on `fix_comit`), and
  `cadence-core/bin/adjudication-record.test.mjs:364-368`, the test that names
  this as "the case the strictness exists for". The comment at `:132-137`
  attributes the guard to `additionalProperties: false`, not to `:366`. The
  guard is already severity-independent and already fires before `:366` is
  reached.
- D-04 (The deferred arm): the "no fourth ruling" D-09 invariant stays true by
  CONSTRUCTION rather than by convention, because D-01 leaves `RULINGS` frozen
  at three. Evidence: `planning/deferred-record.mjs:34-36`,
  `lib/deferred-queue.mjs:27`, `cadence-core/bin/planning-deferred.test.mjs:80`,
  `references/triage-gate.md:34-36` ("`RULINGS` has three values and none of
  them is 'not yet'"). If wrong: a fourth ruling reading as "recorded, not acted
  on" gives the deferred arm a value it could write at fire time, and the queue
  member's "unruled until a real adjudication supersedes it" property becomes a
  convention a caller can break.
- D-05 (The authoritative sentence): `cadence-core/references/review-record.md`
  changes alongside the three files the roadmap's fourth criterion names,
  because it is the document the COORDINATOR reads when composing the payload.
  Evidence: `references/review-record.md:78-87` ("a `survived` one names the fix
  commit", "there is no fourth value"); `references/review-triggers.md:242-246`
  sends the fire site to that file for the payload and ruling mechanics;
  `references/triage-gate.md:64-73` states the obligation and deliberately does
  not restate the mechanics ("a copy here is a second statement that can
  drift"). If wrong: the three named files agree and the coordinator still
  composes a payload with a fix commit on every `survived` entry - the defect
  reproduces at the exact step it was reported from.
- D-06 (Where the drift test lives): a row in
  `cadence-core/bin/prose-agreement.test.mjs`, not a check in `self-verify.mjs`.
  Evidence: `prose-agreement.test.mjs:1-18` (the file's own charter and its
  stated reason for not living in the linter), `:309` and `:1498-1499` (existing
  rows already read `references/triage-gate.md` and `references/review-record.md`);
  `lib/adjudication-record.mjs:47-52` (the module takes no CONTRACTS row and no
  CLI entry point, so `self-verify` check 14 does not reach it). If wrong: the
  test lands in `self-verify.mjs` as a text scan over reference markdown, which
  `self-verify.mjs:927` already records a standing decision against for this
  table family, and it goes red on a reformat that changed no fact.
- D-07 (Where the filing filter goes): `issue-filing.mjs cmdUnfixed` filters the
  entries carrying a `fix_commit`; `lib/filing-decision.mjs` keeps its stated
  "TWO FIELDS DECIDE IT AND NOTHING ELSE" rule and a voluntary fix on a medium
  can still cite its commit. Evidence:
  `lib/filing-decision.mjs:48-81` (the two-field rule, implemented at `:77-79`),
  `lib/adjudication-record.mjs:398` (the entry carries `fix_commit` through to
  the record), `cadence-core/bin/issue-filing.mjs:280-287` (`unfixed` passes
  `selected.findings` straight through with no further filter, so the filter
  lands where the pass-through is). Measured 2026-08-28 across every
  `ADJUDICATION-*.json` on disk: one entry is `medium survived HASFIX`
  (`.planning/_archive-v3.7.3/1/ADJUDICATION-risk_surface-plan-2.json`) - the
  exact entry `unfixed` would file an issue for over already-committed work.
  [corrected by plan-1 deviation: `lib/filing-decision.mjs` states THREE fields,
  not two - closing the `risk_surface` high required `unfixedFindings` to read
  the `overridden` marker beside `ruling` and the raised `severity` (3341ffb0);
  `fix_commit` still decides nothing there, which is the part of D-07 that held.]
- D-09 (`why record`'s renderer): distinguish survivors by `fix_commit`
  presence, rather than leaving `why` untouched and recording the widened
  meaning in a comment. Evidence: `lib/why-record.mjs:420-433` (the D-11 reader
  takes only entries whose `ruling` is `survived`), `cadence-core/bin/why.mjs:236-253`
  (`reviewFor` joins those survivors to a sha by range). Today every such entry
  is a FIXED blocker/high; after D-01 a confirmed-unfixed medium joins the same
  list. If wrong: `why` surfaces unfixed mediums as findings that "survived on
  this commit" with no distinction from the fixed blockers beside them.
- D-10 (The fixture surface): the AC3-era refusal rows are NARROWED to
  blocker/high, never deleted - that refusal was locked in v3.5.6 and one of
  its three fixtures is the "unfixed survivor" case. Six test files build a
  `survived` fixture with an unconditional `fix_commit` and must be edited
  deliberately. Evidence: `cadence-core/bin/filing-decision.test.mjs:31`
  (`...(verdict === 'survived' ? { fix_commit: 'a1b2c3d' } : {})`, and `:48-60`,
  whose "survived low" case therefore carries a fix commit today),
  `cadence-core/bin/issue-filing.test.mjs:144`,
  `cadence-core/bin/adjudication-record.test.mjs:218-246,450,524`,
  `cadence-core/bin/trace.test.mjs:1197`,
  `cadence-core/bin/planning-adjudication.test.mjs:98`,
  `cadence-core/bin/deferred-queue.test.mjs:104` (which pins `fix_commit` as an
  UNKNOWN key on a queue member and must keep doing so). If wrong: the AC3 rows
  at `adjudication-record.test.mjs:218-223` and this phase's fix contradict each
  other, and whichever is edited carelessly removes the v3.5.6-locked refusal
  instead of narrowing it.

## Acceptance criteria

- [ ] AC1: A `survived` ruling raised at medium or below, carrying no
      `fix_commit`, is accepted by `adjudication-record.mjs` and its entry
      appears in the written `ADJUDICATION-*.json` - not a refusal.
- [ ] AC2: A `survived` blocker or high carrying no `fix_commit` is still
      refused, and an entry carrying `fix_comit` is still refused as an unknown
      key.
- [ ] AC3: An overridden blocker/high writes an `ADJUDICATION-*.json` carrying
      its override marker with no fabricated commit SHA, and `risk-check status`
      joins that receipt as satisfied.
- [ ] AC4: `issue-filing unfixed` returns no entry carrying a `fix_commit`: fed
      the `medium survived HASFIX` entry in
      `.planning/_archive-v3.7.3/1/ADJUDICATION-risk_surface-plan-2.json`, it
      offers nothing for that entry.
- [ ] AC5: `lib/adjudication-record.mjs`, `lib/filing-decision.mjs`,
      `references/triage-gate.md` and `references/review-record.md` state the
      same meaning of `survived`, and a `prose-agreement.test.mjs` row goes red
      when any one of them is edited apart from the others.
- [ ] AC6: `why record` tells a fixed survivor from a confirmed-unfixed one:
      two survivors on one commit, one with a `fix_commit` and one without, do
      not render identically.
- [ ] AC7: The GH-159 reproduction closes - a blocking fire whose highest
      finding is a medium reaches a written receipt and a satisfied `risk-check
      status` with no halt - and `trace recount`, `why record` and the deferred
      readers still read the 10 pre-change records recovered from git history
      without refusing.

## Flagged assumptions

- The shape of D-02's override marker - a boolean key on the entry, a reason
  string, or a value on an existing field - is the planner's call, constrained
  only by D-03: whatever it is must be added to `RULING_KEYS` so the unknown-key
  guard admits it. Likely; if wrong: the marker is stored as an unknown key and
  the entry is refused for the very guard this phase promised to keep.
- Whether AC5's drift test is a prose-agreement ROW over the four surfaces or a
  shared exported predicate both modules import (making drift an import error
  rather than a test failure) is the planner's call under D-06. Likely; if
  wrong: a shared predicate reaches `lib/filing-decision.mjs`, whose two-field
  purity D-07 exists to preserve.
- Whether AC7's "no halt" is observable without a live review provider is
  assumed yes: the failure GH-159 reports is at the record seam, which composes
  from a hand-written adjudication record plus `trace append` and `risk-check
  status`, all local. `OPENAI_API_KEY` is unset on this machine. Likely; if
  wrong: AC7 needs a `(human-verify: needs a live review provider)` tag and
  /cad-verify should route it to a human check rather than the executor.
