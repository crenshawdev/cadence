# Phase 4: Suggestions become seams - Context

Gathered: 2026-08-14
Feeds: /cad-plan 4

## Scope boundary

In: `ENF-01` in all five of its halves - the criteria ceilings counted by a
seam, one `trace close` replacing the restated close prose (eight files, not
the six the roadmap stated before this pass corrected it), a bounded
`trace render` default, the two measured unbatched round-trips batched with the
new per-workflow count pinned, and the read instrumentation joined to the fire
that caused it - plus the executor-surfaces queue item the roadmap says this
phase absorbs, admitted with a criterion of its own (AC6).

Out: fence-awareness for roadmap WRITE paths (phase 3 D-02 keeps them
fence-blind); `trace suggest`'s rules, which read the FULL event array
in-process and are untouched by the render bound; making `corr` fire-scoped
(phase 2 D-02 locked it phase-scoped); a `trace-suggest.mjs` rule for the reads
join (phase 2 D-11 locked the reader as prose); `execute.md`'s twice-instructed
`triage-gate.md` re-read (D-16); the 2026-08-14 scan's cluster-7 remainder not
named by an AC here - cross-cycle `trace render --phase N` aggregation, the
empty-name role rows, a read-only `route.mjs resolve` mode, bracket read-set
validation, `read-trace.mjs`'s superseded stat block, pricing the cross-model
reviewer arm - which stay in the queue; and phases 5-6 (docs truth and voice).

Deferred: None.

Plan shape: multiple plans, same phase - seven criteria across five independent
fix sites, with AC2 alone touching eight prose files plus a census rewrite.
AC7 is a gate on all of them.

## Durable decisions

- D-01 (ceilings): The counter spans TWO grammars in two files and only one has
  a parser. CONTEXT.md's `## Acceptance criteria` is parsed by
  `classifyAcceptanceCriteria` and already counted per phase by
  `criteria-coverage`; ROADMAP.md's per-phase `Success criteria:` list has NO
  reader at all - `phaseRequirements` reads only `**Requirements:**` and
  `**Goal:**` out of a `### Phase N:` block. A single-parser design silently
  reports `found:false` for every roadmap phase, shipping the
  `new-project`/`adopt` half with no enforcement - the exact silent no-op this
  phase exists to remove. Evidence:
  `cadence-core/bin/lib/planning-files.mjs:355-376`, `:1037-1145`;
  `cadence-core/bin/planning.mjs:1215-1300`;
  `cadence-core/workflows/context.md:287`,
  `cadence-core/workflows/new-project.md:292`,
  `cadence-core/workflows/adopt.md:192` and `:291` (all re-verified at HEAD).
- D-02 (ceilings): The roadmap criteria heading has TWO live spellings and the
  parser admits both. `templates/ROADMAP.md` writes `**Success Criteria:**`
  (bold, capital C); Cadence's own `.planning/ROADMAP.md` writes bare
  `Success criteria:` at all five phase blocks. A parser anchored to the
  template alone reports "no criteria declared" for every phase of the repo
  whose dogfooding proves the seam - and under the `absence is not zero` rule
  it reports nothing rather than failing, so the regression is invisible.
  Evidence: `cadence-core/templates/ROADMAP.md:28` and `:36` vs
  `.planning/ROADMAP.md:68,91,118,139,163` (10 hits tree-wide, measured
  2026-08-14).
- D-03 (ceilings): The new counter reuses `plan-size`'s conditional-comparison
  envelope - `compared[]`, `within: null` when nothing was compared,
  `*_found:false` for an unwritten source - rather than a bare boolean.
  Emitting `ok:true` having compared nothing reproduces the scan's own measured
  defect inside the seam built to fix it. Evidence:
  `cadence-core/bin/planning.mjs:1510-1592`, with the comment at `:1543-1547`
  stating why `within:true` beside `requirements_found:false` was wrong;
  `design-notes/sweep-2026-08-14-repo-scan.md:20-21`.
- D-04 (ceilings): The ceilings are literal numbers in the seam's flags,
  supplied by the caller - NOT new config keys. Mirrors `plan-size`, whose
  header states "the CALLER's resolved values; this seam reads no config", and
  avoids two keys each needing `config.schema.json`, config-catalog and
  config-reach rows. User-decided over `workflow.max_criteria`/`min_criteria`
  keys and over unflagged constants. Evidence:
  `cadence-core/bin/planning.mjs:1506-1509`;
  `cadence-core/workflows/plan.md:34-39`;
  `cadence-core/references/config-catalog.md:30`;
  `cadence-core/references/config-reach.md:124`.
- D-05 (close): The restated close prose lives in EIGHT files across TEN
  dispatch moments and twenty lines, not the six both shipped statements
  claimed. Corrected in place this pass in `.planning/REQUIREMENTS.md` (ENF-01)
  and `.planning/ROADMAP.md:144` on the user's yes. A plan scoped to six leaves
  two files writing raw `trace append --event return`, and
  `trace.test.mjs`'s per-file `BRACKETING` census - which has a row for all
  eight - reddens on the half-converted tree. Evidence, measured 2026-08-14:
  `references/plan-revision.md:23,30,54,60`, `references/review-triggers.md:131,140`,
  `workflows/context.md:179,193`, `workflows/decision-review.md:61,68`,
  `workflows/execute.md:202,203`, `workflows/minimalism-review.md:87,94`,
  `workflows/plan.md:194,202,297,303`, `workflows/verify-deep.md:24,67`.
- D-06 (close): The inference may NOT key on `--tokens`, and the caller still
  passes a discriminator - `--detail` is the only flag that separates the arms
  today. Measured across all 20 close lines: 6 of 10 checkpoint sites DO carry
  `--tokens` (`decision-review.md:68`, `execute.md:203`,
  `review-triggers.md:140`, `minimalism-review.md:94`, `verify-deep.md:67`)
  while 4 do not; every checkpoint carries `--detail` and no return does. The
  "return shapes" themselves are heterogeneous - `plan.md:205-206` tests
  `## PLANNING COMPLETE`, `verify-deep.md:15-17` tests failed/empty/timed-out,
  `skills/cad-executor-contract/SKILL.md:159-160` writes `CHECKPOINT: <type>`
  into a report FILE. A token-presence classifier writes `return` for four
  shipped checkpoint sites, billing an unusable worker as a clean close -
  the arm `trace.test.mjs:1057-1068` calls load-bearing.
- D-07 (close): `trace close` lives in `planning.mjs` beside `trace append`,
  never folded onto `route.mjs resolve`. The resolve happens BEFORE the worker
  returns and cannot see the close, so folding it collapses every measured
  duration to zero. Evidence: `cadence-core/bin/route.mjs:20-23` states the
  shipped position ("The CLOSE half stays with the caller, which alone sees
  it"); `cadence-core/bin/self-verify.mjs:253-256`.
- D-08 (render): The bound belongs in `planning.mjs`'s `render` CLI arm, NOT
  inside `renderTrace` - two in-process consumers need the full array.
  `trace suggest` calls `renderTrace` then reads `r.events.length`, and
  `lib/trace-suggest.mjs:122` reads `render.events` directly; bounding the
  function makes every evidence-backed retune suggestion price a fraction of
  the run. Evidence: `cadence-core/bin/planning.mjs:2754-2774`, `:2737-2741`.
- D-09 (render): The bounded form is NOT a tail-N of `events`. It carries the
  per-bracket rows plus EVERY `outcome` event, because `references/triage-gate.md:38-43`
  reads `trace render --phase <N>` to find a prior `rearm` under the current
  `corr` before firing the narrowed round. A truncated payload makes that
  lookup miss, so the one-re-arm cap on the only BLOCKING trigger fails open -
  the uncapped-re-arm loop `.planning/CAPTURE.md:291` records as measured
  damage. Second reader: `workflows/report.md:41-42` needs one row per
  dispatch/return pair and one line per review fire.
- D-10 (join): Read-time inference - normalize `cadence:cad-<role>[-<rung>]` to
  a role and test timestamp containment inside a dispatch/terminal bracket -
  NOT a corr stamped at hook time. A hook-time stamp gives a read running
  inside a subagent the coordinator's current corr, making the join
  confidently wrong rather than honestly absent, against a hook whose stated
  contract (`lib/read-trace.mjs:10-15`) is that it never disturbs normal work.
  User-decided over hook-time stamping and over a phase-only stamp. Measured
  2026-08-14: 1,129 of 1,721 subagent records land inside exactly one closed
  bracket. Consistent with phase 2 D-01 (repair at read time, writer
  untouched). Evidence: `lib/read-trace.mjs:204-254`, `:25-53`;
  `lib/trace.mjs:212-241`, `:395-467`.
- D-11 (join): A role+time join CANNOT attribute a read to a PLAN on the
  parallel execute path - same-role brackets genuinely overlap. Measured over
  all 100 closed brackets in `.planning/trace.jsonl`: 2 overlapping same-role
  pairs, both `cad-executor` (phase 4 plans 1 and 2 opening at
  `2026-08-14T15:51:15Z`/`:16Z`; phase 3 plans 2 and 1 at `22:57:52Z`/`22:57:36Z`).
  The join reports ambiguous there rather than picking a bracket, because
  guessing is wrong exactly on the highest-cost path - `cad-executor` is 440
  records, the largest subagent share of the corpus. Evidence:
  `lib/trace.mjs:370-375` keys pairing on `(corr, phase, plan)` for this reason.

## Decisions

- D-12 (surfaces): The executor-surfaces queue item is IN this phase with its
  own criterion (AC6), rather than absorbed silently or returned to the queue.
  The roadmap says the phase absorbs it but no criterion covered it and ENF-01
  never named it, so without AC6 the phase either closes with it untouched or
  grows an unfalsifiable sixth deliverable. User-decided. Evidence:
  `.planning/CAPTURE.md:209` (tagged `v3.3.0 phase 4`);
  `.planning/ROADMAP.md:134-136`; `skills/cad-executor-contract/SKILL.md` has 0
  occurrences of `concurrency|untrusted_input|risk_surface` and `:154-157` tells
  the executor NOT to halt for a risky diff; `workflows/execute.md` names
  `surfaces` nowhere; `route.mjs resolve --role cad-executor` returns six
  answered surfaces with `surfaces_answered:true` (run 2026-08-14).
- D-13 (close): `escalation` stays OUTSIDE `trace close`'s inference. It is a
  `TERMINAL` member with zero prose producers - the 20-line close census found
  no `--event escalation` anywhere under `cadence-core/`, `skills/` or
  `agents/`. Building and testing a three-way inference for an arm nothing
  writes is dead flexibility; it stays reachable through `trace append`, and
  the seam's header says so. Evidence: `lib/trace.mjs:111`.
- D-14 (close): `trace.test.mjs`'s per-FILE `BRACKETING` census is re-expressed
  on the new spelling in the SAME work - its three assertions are stated in
  terms of counting `--event return` / `--event checkpoint` occurrences per
  file, so converting the prose turns all eight rows red. The cheapest way out
  (deleting the failure-arm assertion) would remove the only check that a
  worker which burned its budget and returned nothing still reaches the record.
  Evidence: `cadence-core/bin/trace.test.mjs:921-930`, `:939-967`, `:1042-1068`.
- D-15 (batching): `context.md`'s single batched config read needs exactly two
  keys - `memory.backend` (`:84`) and `planning.commit_docs` (`:359`) - which
  are its only two config reads. The batched multi-key form already ships at
  seven other sites (`plan.md:32-39`, `execute.md:27-33`, `debug.md:59`,
  `adopt.md:42`, `new-project.md:66`, `milestone.md:9`,
  `skills/cad-land/SKILL.md:24`); `context.md` is the outlier.
- D-16 (batching): `execute.md`'s twice-instructed `RE-READ triage-gate.md` is
  OUT of scope - both sites sit on CONDITIONAL failure arms (`:251-253` the
  `risk_surface` FAIL fix arm, `:285-288` the `adjudicated` diff-gate arm) and
  neither fires on a happy path, which is what criterion 4 measures. Declined
  explicitly so the next scan reads it as settled rather than new.
- D-17 (batching): `plan.md`'s seed-reqs + cursor-set batch is a PROSE-only
  change - both calls exist at `:367-391` and no value flows from the first
  into the second. No seam change is planned for what a two-line prose edit
  closes. Evidence: `design-notes/sweep-2026-08-14-repo-scan.md:29-30` records
  it batched by hand this session.
- D-18 (batching): The stated per-workflow seam-call count is pinned by a
  census test that counts invocations per workflow file and asserts the number
  - the phase 3 D-06 census shape - not by a prose sentence or a
  `DOCS-CLAIMS.md` row. Nothing in the tree states such a count today, and this
  repo treats a stale self-claim as a defect (phase 5's whole premise).
  User-decided. Evidence: grep for `seam call`/`round-trip` returns only
  single-call mentions (`references/req-traceability.md:89`,
  `workflows/suggest.md:32`, `workflows/verify.md:199,299`,
  `references/acceptance-criteria.md:346`); the ~10 and ~8 figures live only in
  the untracked `design-notes/sweep-2026-08-14-repo-scan.md:36-37`.
- D-19 (budgets): Seven of the surfaces this phase edits sit at ZERO
  weight-budget headroom, so phase 1's D-10 row-change rule is load-bearing
  here rather than bookkeeping. Measured 2026-08-14: `report.md` 5,850/5,850,
  `new-project.md` 17,858/17,858, `adopt.md` 14,966/14,966,
  `decision-review.md` 10,993/10,993, `minimalism-review.md` 8,244/8,244,
  `references/review-triggers.md` 28,012/28,012, `progress.md` 8,749/8,749;
  `execute.md` has 59 B, `context.md` and `plan.md` 627 B each. The reflex fix
  (raise the number) is the drift the check exists to catch. Evidence:
  `cadence-core/bin/weight-budgets.json`; `cadence-core/bin/self-verify.mjs:769-792`.
- D-20 (contracts): Two flag additions require `CONTRACTS` row changes in the
  same work, or `self-verify` check 2 reports `unknown-flag` on correct prose:
  `trace render` declares `['--phase']` only (`self-verify.mjs:254`), and
  `reads` declares `[]` (`:236`). Precedent for the failure:
  `.planning/CAPTURE.md:38` records it happening to `weight.mjs --root`.
- D-21 (contracts): Scoping the `reads` seam also contradicts shipped PROSE
  that moves with it - `workflows/report.md:24-26` states it "takes no phase
  scoping and no flag", and `:76-79` carries the whole-corpus caveat on the
  reading line that the join is meant to retire.
- D-22 (testing): Both `.planning/trace.jsonl` and `.planning/reads.jsonl` are
  gitignored (`.gitignore:29-30`, neither in `git ls-files`), so the join's
  regression test runs on committed FIXTURES - including a fixture for the
  overlapping same-role case, which the live corpus alone would leave untested.
  Live-corpus figures are quoted as string literals, the
  `trace-suggest.test.mjs:63-81` precedent phase 2 D-09 locked.

## Acceptance criteria

- [ ] AC1: A surface whose criteria count falls outside its ceiling is reported
      by a seam - CONTEXT's `## Acceptance criteria` against 3-7, ROADMAP's
      per-phase `Success criteria:` against 2-5 - with both heading spellings
      (`**Success Criteria:**` and bare `Success criteria:`) admitted, one test
      row each. A surface that declared no criteria reports `*_found:false`
      with `within: null`, never a pass.
- [ ] AC2: `planning.mjs trace close` writes the return/checkpoint terminal,
      all eight files restating that prose call it instead, and
      `trace.test.mjs`'s `BRACKETING` census asserts the new spelling across
      all eight rows - a raw `trace append --event return` left in any of them
      reddens the suite.
- [ ] AC3: `trace render`'s default response carries no `events` array and is
      at least 3x smaller than the 36,916 B it returns for `--phase 3` today,
      while still carrying every `outcome` event and one row per
      dispatch/return bracket - proved by `triage-gate`'s `rearm` lookup still
      finding its event in the default response. The full array is behind an
      explicit flag carrying a `CONTRACTS` row.
- [ ] AC4: `context.md` reads `memory.backend` and `planning.commit_docs` in
      one call; `plan.md` issues `seed-reqs` and `cursor set` in one message;
      and a census test asserts the per-workflow seam-invocation count for both
      files, reddening when a call is added back.
- [ ] AC5: A `reads.jsonl` record joins to the `trace.jsonl` bracket that
      caused it by role normalization and timestamp containment, proved on
      committed fixtures - including the overlapping same-role case, which
      reports ambiguous rather than picking a bracket. The unjoinable floor
      (host `fork` / `general-purpose` types) is reported as a count, and
      `report.md`'s "no phase scoping and no flag" prose plus the `reads: []`
      `CONTRACTS` row both move with the new flag.
- [ ] AC6: A `cad-executor` dispatch carries `route.mjs resolve`'s answered
      `surfaces` into the executor's prompt, and the executor contract states
      what the executor does with them - asserted by a test on the dispatch
      payload.
- [ ] AC7: `node --test cadence-core/bin/*.test.mjs` passes and
      `node cadence-core/bin/self-verify.mjs` reports no `unbudgeted-surface`,
      `budget-overrun`, `unknown-flag`, or config-key failure.

## Flagged assumptions

- The host guarantees `agent_id` and `agent_type` on every `PostToolUse`
  payload across subagent kinds and host versions - Unclear; the corpus shows
  both fields on 1,718 of 2,725 records today, but neither is documented
  (`lib/read-trace.mjs:242-246` already notes `tool_response` has the same
  undocumented-but-present status). If wrong: the join degrades to the
  coordinator half on some host versions and must report that honestly rather
  than silently. Build the join to state an absent field rather than assume it.
- The read instrumentation DOES fire inside subagent dispatches - Confident,
  measured 2026-08-14 over `.planning/reads.jsonl` (2,725 records, 0
  unparseable): 1,718 carry a subagent `agent_type` across seven types
  (`cadence:cad-executor` 440, `cadence:cad-assumptions-analyzer-high` 440,
  `general-purpose` 401, `cadence:cad-planner` 173, `fork` 152,
  `cadence:cad-verifier-medium` 133) against 1,006 `coordinator`, over 33
  distinct `agent_id`s each holding a contiguous time window. AC5's "proven to
  fire - or proven not to" half is therefore already answered in the
  affirmative; only the join is open work.
- `fork` and `general-purpose` are HOST agent types, not Cadence roles, so
  their 553 records have no dispatch event to join to and never will. Settled
  during this pass from the host's own Agent-tool contract rather than left for
  research: this is a permanent, statable floor (32% of subagent reads) rather
  than a gap to close.
