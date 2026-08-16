# Phase 2: The record learns to see the run - Context

Gathered: 2026-08-16
Feeds: /cad-plan 2

## Scope boundary

In: The two terms the bill is made of stop being absent from the record.
`trace close` persists the tool-call count the subagent return already carries
and `trace render` reports turns per dispatch and per role (MSR-01); and
`/cad-report` and `/cad-suggest` stop presenting a worker-return token sum as
the run's cost, stating instead what their figure does and does not include
(MSR-02). `/cad-progress --trace` is a third surface presenting the same total
as what a worker COST, and it moves with them (D-09). Each requirement lands
with a check watched failing against the unpatched code first.

Out: The rest of the cost half, each scoped to its own phase - MSR-03 (a
dispatch's live context window budgeted and a crossing reported), PLN-01
(`workflow.max_plan_tasks` re-decided against cold-prefix cost) and TRN-02
(bulk tool OUTPUT riding a file). Both MSR-03 and PLN-01 are unblocked BY this
phase and cannot be argued before it. Cache-hit-rate work of any kind: the rate
is already 96.1% and cache-read is the cheap rate at 62.5% of spend, so it is
deliberately not the lever. The three review-path bounds (#143, #141, WIR-01),
which are the milestone's other half. The two `/cad-report` input-quality
captures - the 20 `cad-reviewer` routing resolves against 1 lifecycle bracket
under `review.reviewers=["openai"]`, and the unread `topFiles`/`fileRedundancy`/
`fileCalls` figures - both improve what the readers SEE rather than what they
claim, which is this phase's subject. Fetching, shelling out to, or bundling
any external cost tool (D-05).

Deferred: None.

Plan shape: multiple plans, same phase - split at the seam boundary, with the
writer half (MSR-01: the flag, its validation, the ten close sites, the
turns-unrecorded counter) landing BEFORE the reader half (MSR-02 plus the third
surface), since the readers must be written against the field shape they
consume. Shared surfaces (`cadence-core/bin/weight-budgets.json`, the
`trace close` contract row in `self-verify.mjs`, `.planning/DOCS-CLAIMS.md`)
get explicit `files:` leases per plan.

## Durable decisions

- D-01 (MSR-01): The turn count arrives as a NEW structured, non-negative-integer
  flag validated inside the shared `append|close` body, refused wholesale when
  malformed - nothing appended - and OMITTED rather than sent as `0` when the
  return carried no figure. It is never parsed out of `--detail`, which phase 1
  D-12 already established is not a machine-join surface: the trigger alone was
  spelled four different ways across 35 `outcome/adjudication` events. A
  best-effort append with the field silently dropped would render the role as
  turn-unrecorded while the caller believes a count landed, which is the exact
  zero/unrecorded/recorded conflation the per-role block exists to prevent.
  Evidence: `cadence-core/bin/planning.mjs:2903-2995` (one body for both
  subcommands; `--tokens` and `--raised` state the "a malformed value is a
  malformed CALL" rule), `:3095-3124` (the conditional spread that omits an
  absent field), `:4668-4681` (`parseArgs` turns a bare flag into boolean
  `true`, which is why every existing flag guards for it),
  `cadence-core/bin/lib/trace.mjs:43-77`, `cadence-core/references/seams.md:118-131`.
- D-02 (MSR-01): The count is read off the HOST's subagent return metadata - the
  same provenance `--tokens` has - and Cadence adds no hook, seam or capture
  mechanism to obtain it. Confirmed live 2026-08-16 in this phase's own context
  pass: the `cad-assumptions-analyzer` return carried `tool_uses: 83` beside
  `subagent_tokens: 186,682`. Nothing in the tree records or exercises that
  shape today - a grep across `cadence-core/`, `agents/`, `hooks/`, `docs/` and
  `.planning/` for `tool uses|tool_calls|tool-calls` returned zero hits - so the
  live observation is the whole basis, and the omit-not-zero rule (D-01) is what
  makes a host that stops surfacing it readable rather than silently wrong. The
  rejected alternatives were deriving turns from `.planning/reads.jsonl` (4,116
  of 8,376 records join to a bracket, across 74 brackets that also carry a token
  figure) and a per-role FLOOR from the `agent_id` grouping; both measure a
  proxy, and only five tools are hooked. Evidence:
  `cadence-core/bin/lib/trace.mjs:49-52` (states that provenance verbatim for
  `--tokens`), `:58-66` (every PLUGIN agent's return carried a token figure while
  the BUILT-IN `Explore` type returned none), `cadence-core/bin/lib/read-trace.mjs:55,451-499`,
  `cadence-core/bin/planning.mjs:2870-2888`, `.planning/CAPTURE.md:272`.
- D-03 (MSR-01): Turns get their OWN unrecorded counter; the existing
  `roles[].unrecorded` keeps meaning "no token figure was reported". Collapsing
  both into one scalar makes a dispatch that reported tokens but no turns
  indistinguishable from the reverse, and falsifies `progress.md`'s stated rule
  that an absent total prints as `unrecorded` and never as `0` with no test going
  red. Evidence: `cadence-core/bin/lib/trace.mjs:430-436,598-712` (`recorded`
  increments only on a token figure; `unrecorded = dispatches - recorded`),
  `cadence-core/bin/trace.test.mjs:1008-1048,1585`,
  `cadence-core/workflows/progress.md:99-114`,
  `cadence-core/workflows/report.md:58-60`.
- D-04 (MSR-01): Every close site gains the flag in THIS phase rather than a
  pilot subset, so turns per role are complete or absent and never silently
  short. A partial rollout puts a second, unstated rule in the tree - "some roles
  report turns" - and a per-role total then reads as low rather than as partial.
  The bracket census already binds the count per file and requires closes to
  EQUAL dispatches, so a partial conversion has no place to be recorded.
  Evidence: `cadence-core/bin/trace.test.mjs:1301-1310` (context.md 1, plan.md 2,
  plan-revision.md 2, review-triggers.md 1, execute.md 1, decision-review.md 1,
  minimalism-review.md 1, verify-deep.md 1), `:1468-1471,1490-1502`,
  `cadence-core/references/seams.md:118-131`,
  `cadence-core/bin/self-verify.mjs:329-332,343-344`.
- D-05 (MSR-02): The external figure is NAMED as provenance in the record and in
  the prose; it is never fetched, shelled out to, or bundled at runtime. A
  read-only command that acquired a runtime dependency would contradict a public
  README claim on the one surface whose whole posture is that it invents no
  number. `burnrate` is absent on this box (probed 2026-08-16), which is the
  normal case rather than an obstacle: the shipped surface names the comparator
  and the user runs it. Evidence: `README.md:14,136` ("Cadence ships no
  instrumentation and phones nothing home", carried accurate at
  `.planning/DOCS-CLAIMS.md` README-41), `cadence-core/workflows/report.md:114-118`
  ("No fabricated figures"), `docs/EVIDENCE.md:1-19`.
- D-06 (MSR-02): The gap is reported as its TERMS - dispatches, turns, the
  per-dispatch window figure, and the count of unmeasured dispatches - against a
  named external comparator, with NO multiplier stored anywhere in the tree; and
  the `~20x` in ROADMAP and REQUIREMENTS is NOT corrected. The re-measurement
  taken during this pass (`sum(return tokens)` 9,829,345 against
  `sum(tokens x joined reads)` 607,262,751 over the 74 brackets carrying both =
  61.8x at a constant window, ~31x under linear growth) measures a DIFFERENT
  quantity than the `~20x`, which is trace 795,845 against burnrate 16,261,487 =
  20.4x, a comparison against an actual bill. The 61.8x is an upper bound built
  on a floor: joined reads count only the five hooked tools, and tokens-per-read
  falls monotonically from 4,738 at 40 reads to 1,808 at 136, so the return
  figure behaves like a FINAL WINDOW rather than a per-turn sum - multiplying a
  grown window by the turns that grew it double-counts the early ones. The two
  figures do not conflict, so no requirement row is wrong. Storing either as a
  multiplier recreates the maintenance loop `v2.7.0` deleted when it removed
  ~200 checked-in derived figures, and MSR-03 and PLN-01 need the FACTORS rather
  than the product. Evidence: `.planning/ROADMAP.md:44-49,150-160`,
  `.planning/REQUIREMENTS.md:29-35`, `cadence-core/bin/lib/read-trace.mjs:55`,
  `docs/EVIDENCE.md:1-19`, `.planning/CAPTURE.md:272` ("the tail must name its
  holes or it repeats the ~25x under-report as a precise-looking number").

## Decisions

- D-07 (MSR-01): The count rides its flag INLINE. It is not caller-derived text,
  so it does not enter the text-transport register and needs no `-file` sibling -
  the register excludes by construction "values that cannot be arbitrary
  repository prose", and `--tokens` is already named there as excluded. The
  36-row pin phase 1 deliberately held stays at 36. Evidence:
  `cadence-core/bin/lib/text-transport.mjs:95-113`,
  `cadence-core/bin/text-transport.test.mjs:44-47`.
- D-08 (MSR-02): `--phase N` does NOT scope a run, and any statement of what the
  figure includes has to say so. The filter is on `phase` alone and never on
  `corr`: measured 2026-08-16, `trace render --phase 1` on this repo returns 12
  distinct `corr` ids spanning 2026-08-07 to 2026-08-16, 61 dispatches, 10
  unrecorded, 2 unpaired, and 60 `provider/request` events carrying no bracket
  and no token field at all. A caveat attached to a figure that pools twelve
  cycles' phase 1 into "the run" is a worse claim than the one it replaces.
  `suggest.md` already states this hazard for its own scope; `report.md` does
  not. Evidence: `cadence-core/bin/lib/trace.mjs:467-476`,
  `cadence-core/workflows/suggest.md:25-28`,
  `cadence-core/workflows/report.md:10-15`.
- D-09 (scope): `/cad-progress --trace`'s cost sentence and the
  `.planning/DOCS-CLAIMS.md` row PROGRESS-28 are corrected in THIS phase rather
  than filed as an open item. PROGRESS-28 records "The record has one `corr`" as
  accurate, which D-08's 12-corr measurement falsifies, and `progress.md` reads
  the `roles` block as "what each worker in this phase COST" - the same claim
  MSR-02 is removing from the other two surfaces. Leaving it would ship two
  surfaces disagreeing about one block and keep a false row marked accurate.
  `progress.md` is budgeted at 8957/8957 with zero headroom, so the re-pin rides
  the same commit (D-12). Evidence:
  `cadence-core/workflows/progress.md:99-114`, `.planning/DOCS-CLAIMS.md`
  (PROGRESS-28), `cadence-core/bin/weight-budgets.json`.
- D-10 (evidence): MSR-02's watched FAIL lands as TWO checks, one per half,
  because half of MSR-02 lives in prose nothing executes: the shipped `evidence`
  string shape pinned in `trace-suggest.test.mjs`, and the caveat sentence
  pinned in `prose-agreement.test.mjs`, which already asserts numeric properties
  of shipped prose. Each new check carries a header comment naming the SHA it was
  watched failing at, matching phase 1 D-17. The rejected alternative - moving
  the caveat into the seam envelope so one test covers both - was not taken
  because `report.md` has no executor at all and would still be relaying an
  unasserted sentence. Evidence: `cadence-core/bin/trace.test.mjs:1241-1249`
  ("whether a model obeys that prose is a UAT question and this test cannot reach
  it"), `cadence-core/bin/prose-agreement.test.mjs:511-525`,
  `cadence-core/bin/lib/trace-suggest.mjs:282-298`,
  `cadence-core/bin/trace-suggest.test.mjs:431-455`.
- D-11 (MSR-02): The `/cad-suggest` half is a SEAM change. Its workflow file may
  not gain a flag and may not recompute or hedge a figure in prose - the file
  states "Add no flag of any kind" and "Relay the figures UNCHANGED and recompute
  none of them", and DOCS-CLAIMS row SUGGEST-04 pins the `--phase`-only contract.
  A caveat landing as prose a model may drop, over a seam still emitting today's
  string, is the failure this forecloses. Evidence:
  `cadence-core/workflows/suggest.md:17-23,56-63`,
  `cadence-core/bin/trace-suggest.test.mjs:365-382`, `.planning/DOCS-CLAIMS.md`
  (SUGGEST-04).
- D-12 (fixtures and pins): The new keys are emitted only when a figure exists
  (D-01), so both committed-fixture deepEquals stay BYTE-IDENTICAL and that
  silence is itself the proof the change is invisible on an old trace; any re-pin
  that does prove necessary carries its arithmetic in the test file's header
  rather than being quietly edited to agree. `weight-budgets.json` and the
  `'trace close'` contract row in `self-verify.mjs` are re-pinned in the same
  commit as each prose edit and belong in the plan's `files:` lease - measured
  2026-08-16 every surface this phase touches sits at exactly its pin with zero
  headroom (`report.md` 6935, `suggest.md` 5141, `seams.md` 19258,
  `progress.md` 8957, `plan.md` 22212, `context.md` 20121, `verify-deep.md` 3851,
  `review-triggers.md` 30539, `plan-revision.md` 3757, `minimalism-review.md`
  8236, `decision-review.md` 10991), with only `execute.md` holding slack at 40
  bytes. Carries phase 1 D-15 forward. Evidence:
  `cadence-core/bin/trace.test.mjs:1545-1592`,
  `cadence-core/bin/lib/trace.mjs:706-711`,
  `cadence-core/bin/fixtures/verbatim.trace.jsonl` (tokens on 14 of 52 lines, no
  tool-call field of any kind), `cadence-core/bin/self-verify.mjs:343-344`.
- D-13 (ledger): The `.planning/DOCS-CLAIMS.md` rows whose line anchors these
  edits move travel WITH the change rather than being left for the next
  `/cad-docs-verify` - REPORT-05, REPORT-10/11/12, SUGGEST-07/08 and
  PROGRESS-15/28/29. The anchors already drift (PROGRESS-13 cites line 93 for a
  command sitting at line 96 today), and two rows become outright false: REPORT-05's
  carried-key list and PROGRESS-28's one-corr claim. Evidence:
  `.planning/DOCS-CLAIMS.md` (the named rows, and the header at `:256-302`
  recording prior re-pinning passes).

## Acceptance criteria

- [ ] AC1: `trace close` persists the tool-call count the subagent return
      carried, and `planning.mjs trace render --phase 2` reports turns per
      dispatch and per role rather than tokens alone.
- [ ] AC2: A close carrying no turn figure renders that role's turns under their
      own `unrecorded` counter and never as `0`, a dispatch reporting tokens but
      no turns stays distinguishable in the render from one reporting turns but
      no tokens, and a malformed `--turns` value (negative, non-integer, or the
      bare flag) is refused wholesale with nothing appended to `trace.jsonl`.
- [ ] AC3: Neither `/cad-report` nor `/cad-suggest` presents a worker-return
      token sum as the run's cost: the seam emits what the figure excludes - the
      orchestrator's own turns, cross-model provider calls, and figureless
      returns - and both readers relay it unchanged, with `/cad-suggest` gaining
      no flag and recomputing nothing.
- [ ] AC4: The gap is reported by naming the external comparator and printing its
      terms (dispatches, turns, the per-dispatch window figure, and the count of
      unmeasured dispatches), and `grep -rn` over `cadence-core/` finds no stored
      multiplier or ratio constant.
- [ ] AC5: `/cad-progress --trace`'s cost sentence and `.planning/DOCS-CLAIMS.md`
      row PROGRESS-28 no longer claim the record has one `corr`, and a render on
      this repo returning more than one `corr` contradicts no shipped prose.
- [ ] AC6: A check fails against the unpatched code first for each of the two
      requirement halves, and each carries a header comment naming the SHA it was
      watched failing at; running that check against that SHA exits non-zero.
- [ ] AC7: `node --test cadence-core/bin/*.test.mjs` and `node
      cadence-core/bin/self-verify.mjs` both exit 0, with `weight-budgets.json`
      re-pinned and the `'trace close'` contract row updated.

## Flagged assumptions

- The host surfaces a tool-call count on every PLUGIN agent return, not just
  most. Confirmed live 2026-08-16 on one `cad-assumptions-analyzer` return
  (`tool_uses: 83`), and `lib/trace.mjs:58-66` already records the built-in
  `Explore` type returning no token figure at all, so the per-agent-type risk is
  real and known; Likely, and if wrong some roles render turns as `unrecorded`
  and the per-role view is partial rather than absent - which is exactly what
  D-03's own counter makes readable.
- The exact flag name (`--turns` vs `--tool-calls`) and the key it writes are the
  planner's call; Likely, and if wrong a rename costs the `self-verify.mjs`
  contract row, the one `seams.md` sentence and every close site.
- Whether the caveat's wording lives in the seam envelope and is relayed, or is
  authored once per reader, is the planner's call within D-10's two-check
  arrangement; Likely, and if wrong the two readers drift in what they claim to
  exclude.
- The 61.8x re-measurement is an upper bound built on a floor and is recorded here
  as context rather than shipped; Confident, and if wrong nothing this phase
  emits changes, because D-06 ships the terms rather than any product.
- Whether the per-dispatch window figure AC4 prints is the return token figure
  itself (which behaves like a final window) or a separately recorded value is the
  planner's call; Likely, and if wrong the printed term is a proxy and the prose
  must name it as one.
