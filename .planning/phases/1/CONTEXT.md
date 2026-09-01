# Phase 1: Every review fire is bracketed and priced - Context

Gathered: 2026-09-01
Feeds: /cad-plan 1

## Scope boundary

In: `GH-228` (TRC-12) and `GH-221` (CST-04) as one claim about one event
stream - every review fire appears in the routing ledger exactly once and
carries what it cost. Three moving parts: route the empty-set fallback to the
`claude-subagent` arm's bracket procedure so the dispatch reaches its close;
read the usage a provider returns and record it on the `provider/request`
event; make a `routing/resolve` reach the record for every review fire
whichever backend serves it. Riding with them, the surfaces that assert the
cross-model arm is unmeasured and become false when usage lands.

Out: `GH-229` and `GH-178` (both about resolving an INPUT before a gate runs;
this cycle is about what the record says AFTER one did). `GH-230` and `GH-140`
(decisions, not defects). Phase 2's receipt-home and authorization work and
phase 3's observed-effort work. The advisory bracket inversion at
`review-triggers.md:152-171` (D-09). The three paths that structurally emit no
resolve - `/cad-decision-review`, `/cad-minimalism-review`, and `/cad-verify`'s
fix-request fire (D-06).

Deferred: None.

Plan shape: multiple plans - the prose seam (fallback routing, resolve-per-fire,
the stale surfaces and their budget rows) and the code seam
(`review-provider.mjs` usage extraction and the `/cad-report` reviewer row)
split cleanly; /cad-plan breaks it down.

## Durable decisions

- D-01 (Usage denomination): Provider usage is a DIFFERENT denomination from
  `roles.tokens` and stops at the `provider/request` event - it is never summed
  into a per-role total. The host figure on a bracket is a final-window proxy;
  a provider's usage is an input+output count off the wire. Evidence:
  `cadence-core/bin/lib/trace.mjs:1221-1300` (TraceRender typedef: "They stop
  HERE either way: they never reach `roles`"), `cadence-core/workflows/report.md:150-159`,
  and the v3.7.3 phase-1 precedent that cache figures ride the bracket row and
  never the roles bill. If wrong: `roles.cad-reviewer.tokens` becomes a sum of
  two denominations and every downstream reader - `/cad-report`'s token line,
  `trace window`'s ceiling comparison, `trace-suggest`'s R5 share - reports a
  number denominated in nothing.
- D-02 (Usage spelling): The event records BOTH a normalized input/output pair
  and the provider's own raw usage object. The normalized pair is what a reader
  sums across a mixed-provider panel; the raw object is what an auditor joins
  back to the wire response with no translation table. This knowingly departs
  from `cadence-core/bin/lib/subagent-transcript.mjs:125-140`, which takes the
  host's own spelling - that case has ONE writer, this one has three adapters
  returning three shapes. Evidence: `cadence-core/bin/review-provider.mjs:951-1072`
  (three adapters, no usage reader), `cadence-core/references/provider-api.md`
  (documents no usage field for any provider).
- D-03 (Extraction point): The usage reader belongs in `callStructured`, the
  only frame holding the raw provider response. `traceProvider` receives `meta`
  alone and never sees a response, so a reader written at the `cmdReview` level
  has nothing to read. Evidence:
  `cadence-core/bin/review-provider.mjs:1188-1214` (`res.json` consumed by
  `adapter.extractText`, then discarded), `:589-634` (`traceProvider`'s fixed
  field set). If wrong: the change records `unrecorded` on every successful
  call, indistinguishable from today.
- D-04 (Burned budget still costs): Usage is recorded on the degraded terminal
  outcomes that still burned the call - `no-output`, `bad-json`, `bad-shape` -
  not on `ok` alone. `http` and every pre-request refusal have nothing to read.
  This costs a `traceProvider` signature change reached from four sites.
  Evidence: `cadence-core/bin/review-provider.mjs:1196-1213`, `:1243-1251`;
  `cadence-core/references/review-triggers.md:146-150` states the same rule for
  the subagent arm ("a reviewer that burned its budget and came back unusable
  is exactly the dispatch whose cost must still reach the record").
- D-05 (Resolve is a prose fix): `route.mjs` needs NO change to emit the
  resolve - the append at `cadence-core/bin/route.mjs:1349-1366` is gated only
  on `tracePhase !== null`, unconditional on backend. What is missing is a
  resolve CALL per fire, so this half is a prose fix like the fallback.
  Evidence: measured 2026-09-01 - `/code/verbatim` phase 2 holds 5 provider
  reviews (372,333 ms summed) against `cad-reviewer` resolves at 17:36:02 and
  18:29:01 only; `/code/smithers` phase 3 holds 39 provider reviews against 14
  resolves. If wrong: a code change writes a second resolve for a fire that
  already resolved, and `trace-suggest`'s per-role escalation denominator
  (`workflows/suggest.md:115`) starts double-counting.
- D-06 (The resolve unit is the FIRE): One resolve serves one `fire(trigger)`,
  not one provider request. A panel fire naming two providers writes two
  `provider/request` events against one resolve. The three paths that state
  they resolve no model stay out of scope. Evidence:
  `cadence-core/references/review-triggers.md:78-82` ("One resolve serves every
  dispatch: payloads differ, routing does not"), `workflows/decision-review.md:69`,
  `workflows/minimalism-review.md:80`, `references/triage-gate.md:369-372`.

## Decisions

- D-07 (Fallback prose, two files): The empty-set fallback sentence is
  duplicated and BOTH copies are load-bearing. Fixing
  `cadence-core/references/review-triggers.md:202-203` alone leaves the same
  wrong routing at `cadence-core/references/review-cross-model.md:130-132`,
  which is the file a model is actually reading when it hits the fallback.
  Evidence: `review-triggers.md:202-204`, `review-cross-model.md:6,130-132`.
  If wrong: the fix lands in the file the model already left and the phase
  ships with the observed failure intact.
- D-08 (The defect is the CLOSE): The observed fallback already wrote its
  dispatch half under the `claude-subagent` arm's keying, so the fix must land
  at the close at `review-triggers.md:143` and its failure case at `:146-150`,
  not merely at the dispatch line at `:123`. Evidence: measured 2026-09-01 over
  `/code/smithers/.planning/trace.jsonl` - `corr` `3-5812523` holds
  `routing/resolve` 03:58:05, `provider/request` 03:58:43 `HTTP 429`,
  `lifecycle/dispatch plan=cad-reviewer reviewer=claude-subagent` 03:58:50, and
  no terminal of any kind and no `worker_cache`; the same phase's 5 planner, 23
  executor and 1 verifier dispatches all got both halves.
- D-09 (Advisory arm untouched): The advisory bracket inversion at
  `review-triggers.md:152-171` is not implicated. The observed fire ran `plan`
  at `critical`, where the gate is `adjudicated` and the fire site itself owed
  the close. Evidence: the smithers resolve carries `stakes:"critical"`;
  `.planning/REQUIREMENTS.md:261` (CST-01 leaves the `adjudicated` arm at
  `critical` untouched).
- D-10 (No other unclosed path): The two out-of-band reviewer sites each write
  their own dispatch AND close, so "any other path that dispatches a reviewer
  without reaching a close" resolves to the fallback alone. Evidence:
  `workflows/decision-review.md:54,63`, `workflows/minimalism-review.md:76,90`,
  `review-triggers.md:165` (the advisory arm moves the writer, it does not drop
  it).
- D-11 (Absent usage omits the key): A response carrying no usage produces an
  event holding NEITHER usage key - never a zero. Same present-only-when-real
  shape `redactions` and `config_warnings` already take on this event.
  Evidence: `cadence-core/bin/review-provider.mjs:617-631`,
  `cadence-core/bin/planning/trace.mjs:908-918`,
  `cadence-core/bin/lib/subagent-transcript.mjs:133-140`. If wrong, every
  pre-change `provider/request` event in a live record reads as a call that
  cost zero.
- D-12 (A resolve is counted, not joined): `RESOLVE_FLAGS` carries no
  `--trigger` and the resolve event holds no trigger field, while
  `provider/request` does - so AC5 is a COUNT and cannot assert that a given
  resolve served a given fire. Evidence: `cadence-core/bin/route.mjs:1520-1545`,
  `:1351-1364`, `cadence-core/bin/review-provider.mjs:617-618`. Noted so the
  criterion is read for what it proves.
- D-13 (Five stale surfaces move in this phase): Five live surfaces assert the
  cross-model arm is unmeasured and all become false when usage lands:
  `references/review-triggers.md:195-198`, `references/review-cross-model.md:6,15-21`,
  `workflows/report.md:113,142-143`, and
  `cadence-core/bin/lib/trace-suggest.mjs:123-127` (`SPEND_EXCLUDES`, frozen,
  `'cross-model provider calls'` its second entry) - whose length-3 assertion at
  `cadence-core/bin/trace-suggest.test.mjs:885-888` goes red on the change.
  `.planning/DOCS-CLAIMS.md:1174` registers REPORT-12 as `accurate` on the same
  claim and needs re-adjudicating.
- D-14 (Prose growth costs a budget re-pin): All four affected references sit
  EXACTLY at their `weight-budgets.json` ceilings, measured 2026-09-01 -
  `review-triggers.md` 20,196/20,196, `review-cross-model.md` 9,812/9,812,
  `seam-review-provider.md` 3,666/3,666, `provider-api.md` 6,304/6,304. Any
  added sentence re-pins its row in the same commit or `self-verify` reports
  `budget-overrun`. Evidence: `cadence-core/bin/weight-budgets.json:38,41,43,48`,
  `cadence-core/bin/self-verify.mjs:808-818` (a shrink is free per `:791-796`).
- D-15 (The report row is a NEW surface): The `/cad-report` reviewer cost row is
  fed from provider events, not from a row in the existing Dispatches table -
  that table is one row per `brackets` entry, and a cross-model-only phase has
  zero `cad-reviewer` brackets to make a row from. Evidence:
  `workflows/report.md:87,110`, `cadence-core/bin/lib/trace.mjs:1376-1387`
  (renderTrace exposes provider events only via `events[]` and
  `counts.provider`); measured 2026-09-01, `/code/verbatim` phases 5-8 hold 4,
  4, 5 and 4 provider reviews against 0 `cad-reviewer` dispatches each.

## Acceptance criteria

- [ ] AC1: Neither `cadence-core/references/review-triggers.md` nor
      `cadence-core/references/review-cross-model.md` routes the empty-set
      fallback to step 3's reviewer-selection rule; both send it to the
      `claude-subagent` arm's bracket procedure, reaching the close at
      `review-triggers.md:143` and its failure case at `:146-150`.
- [ ] AC2: A cross-model fire whose provider fails and falls back to
      `claude-subagent` produces a `lifecycle/return` for that dispatch:
      `trace render` lists no entry under `unpaired` for it, and its token
      total is a number rather than `unrecorded`. (human-verify: needs a live
      provider API key and an induced provider failure)
- [ ] AC3: `review-provider.test.mjs` against a fixture response carrying usage
      produces a `provider/request` event holding both the normalized
      input/output pair and the provider's raw usage object; the same call
      against a fixture with no usage produces an event holding neither key -
      not zero.
- [ ] AC4: `trace render` on a phase whose only token figures come from
      provider usage reports `cad-reviewer` under `roles` as `unrecorded`, and
      no provider usage figure appears in any `roles` total.
- [ ] AC5: A phase trace containing five review fires served by a provider
      holds five `routing/resolve` events for the reviewer role.
- [ ] AC6: `/cad-report` on a phase with provider reviews and zero
      `cad-reviewer` lifecycle dispatches prints a reviewer row carrying a cost
      figure, not an empty one.
- [ ] AC7: `node cadence-core/bin/test.mjs`, `npx tsc -p tsconfig.ci.json` and
      `self-verify` all pass - `SPEND_EXCLUDES` no longer excludes cross-model
      provider calls and its length assertion matches, every edited reference
      file's `weight-budgets.json` row is re-pinned, and `DOCS-CLAIMS.md`
      REPORT-12 is re-adjudicated.

## Flagged assumptions

- The usage field names and shapes on the three shipped provider APIs (OpenAI
  Responses `POST /v1/responses`, Gemini `generateContent`, DeepSeek chat
  completions) are unverified here - Unclear; `references/provider-api.md`
  documents zero usage fields, no fixture in `review-provider.test.mjs` carries
  a usage object, and 366 live provider events measured 2026-09-01 across
  `/code/cadence` (293), `/code/smithers` (39) and `/code/verbatim` (34) hold
  none, so the corpus cannot be sampled for the shape either. The executor
  verifies the names against live provider docs at implementation time. If
  wrong: the reader misses a field that is present and records `unrecorded`,
  which D-11 makes visible rather than silently false.
- Whether a provider returns usage on a response whose text is missing or
  unparseable (the `no-output` and `bad-json` outcomes) - Unclear. If a
  provider returns none on those arms, D-04's rule is reachable prose on
  `bad-shape` only rather than on all three. If wrong: the signature change
  D-04 costs buys less than it appears to, but records nothing false.
