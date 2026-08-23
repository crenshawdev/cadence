# Phase 2: The read-back gate - Context

Gathered: 2026-08-23
Feeds: /cad-plan 2

## Scope boundary

In: a `planning.mjs` subcommand that, for a planned phase, compares the recall
results the planner was actually handed against the prior decisions, captures
and SUMMARY open items the produced PLAN cites, and emits one JSON object
carrying both sides as explicit id lists with a per-kind breakdown; the
`/cad-plan` wiring that runs it after the planner returns and again on the
committed plan, REPORTS a plan citing zero of a non-empty surfaced set, and
appends the figures to `.planning/trace.jsonl` as an outcome-family event; and
the three-state separation that keeps `memory.backend: none`, an empty surfaced
set and a non-empty set cited zero times distinguishable on disk.
Out: any refusal. This phase never blocks a plan, never re-dispatches the
planner and never edits a plan to add a citation - it becomes a gate in a later
cycle once there is a legitimate-zero rate to threshold against. It changes
nothing on the write side: no citation field in `templates/PLAN.md`, no
structured D-NN reference in PLAN or SUMMARY, no new `corrected by` marker, no
change to what `recall` returns. `FST-01`, `FST-02` and `FST-03` are not this
phase, and neither is any threshold, budget or config key expressing one.
Deferred: None.
Plan shape: multiple plans, same phase - the evidence splits three ways: the
seam itself (AC1/AC2/AC6 - subcommand, payload reader, per-item and per-kind
matchers, own-phase scoping), the `/cad-plan` wiring (AC3/AC4 - two count
points, the trace event, and the budget and seam-census re-pins on a file with
zero headroom), and the three-state separation plus the gates (AC5/AC7).
/cad-plan breaks it down.

## Durable decisions

- D-01 (match rule): an item counts cited by PER-ITEM match, and the envelope
  carries a `cited_by_kind` breakdown so the arms that cannot be joined are
  visibly unjoinable rather than silently zero. Measured on a reconstructed
  phase-1 plan-time recall (a copy of `.planning/` with `phases/1/SUMMARY.md`
  and `UAT.md` removed, `--top 5`, `total` 441) against the three real PLAN
  files: the per-item rule reads 1 cited of 5, the per-source rule reads 4 of 5,
  on the identical plan and identical recall. Rejected: the per-source rule
  (an item counts cited when its `source` string appears in the plan text),
  which credits every row from a source on one mention, and the hybrid, which
  mixes two strictnesses invisibly to a later gate. The rule IS the metric, so
  the low honest number is the one that can carry a threshold later. Evidence:
  `cadence-core/references/recall.md:21` (the return is
  `{score, source, phase?, snippet}`); `.planning/phases/1/PLAN-2.md:285`, where
  one line stands for two distinct surfaced CAPTURE rows.
- D-02 (id availability): a surfaced CONTEXT decision carries its own id inside
  the recall snippet; a surfaced CAPTURE row and a surfaced SUMMARY deviation or
  open item carry NONE, so the CAPTURE and deviation arms of `cited_by_kind`
  report as unjoinable rather than as zero. `parseContextDecisions` pushes
  `line.replace(/^- /, '')`, so the snippet begins `D-09 (deviation edge): ...`;
  `parseSummarySnippets` strips `[deviation] ` and returns bare prose, and
  `parseCaptureSnippets` returns `{text, phase?}` with no identifier. An id
  synthesized from corpus position would break AC6 the moment a bullet is added
  above it - the instability `parseArchiveRows`' "ARCHIVE.md LAST, and the
  position is load-bearing" comment exists to avoid. Evidence:
  `cadence-core/bin/lib/planning-files.mjs:998-1010`, `:806-820`, `:906-930`,
  `:2278-2284`; `cadence-core/references/capture-grammar.md` (no id column).
- D-03 (surfaced-set provenance): what recall surfaced reaches the seam as a
  PAYLOAD FILE holding the recall envelope the plan-time call actually returned
  - the `--payload` shape `adjudication`, `uat merge` and `deferred record`
  already use. Nothing on disk records a recall result today:
  `workflows/plan.md:116-128` renders the results straight into the dispatch
  prompt and persists nothing, and the query at `plan.md:117` is
  `"<key terms from the phase goal>"`, model-authored and never fixed. Rejected:
  the seam re-running recall from `--query`, where re-typed terms produce a
  different top-5 so a plan that cited every real hit reports zero -
  indistinguishable from a genuine zero, the exact false signal RBK-01 exists to
  remove; and passing ids inline on a comma-separated flag, which makes the
  coordinator retype them. Evidence:
  `cadence-core/bin/lib/arg-contract.mjs:652-656`.
- D-04 (own-phase scoping): rows whose `source` is `phases/<the planned N>/` are
  EXCLUDED from the surfaced set; archived same-numbered phases
  (`_archive-v*/<N>/`) stay in. `cmdRecall` walks every `phases/<n>` directory
  with no exclusion, and `plan.md:76-80` reads `phases/{N}/CONTEXT.md` before the
  `spawn_planner` recall at `plan.md:107-118`, so the phase's own CONTEXT is in
  the corpus at plan time - the reconstructed phase-1 recall put its own
  `phases/1/CONTEXT.md` D-09 at rank 3 of 5, and `PLAN-2.md` cites D-09 twice.
  A plan trivially cites its own CONTEXT (1028 own-phase D-NN mentions measured
  across the corpus), so admitting those rows reads near-100% on every phase that
  ran `/cad-context` and the zero case would never fire. The roadmap goal says
  PRIOR decisions. Rejected: admitting them with an `own_phase` field and leaving
  the discount to the reader, which leaves the headline number unable to move.
  Evidence: `cadence-core/bin/planning.mjs:2250-2272`.
- D-05 (count point): the count runs at BOTH points and the envelope records the
  pair - once after `handle_return`/`check_size` and before `check_gate` (the
  criterion's literal "after the planner returns"), and once on the plan as
  committed. `plan.md:309-313` drives at most one checker revision that edits the
  plan file, and `plan.md:356-359` applies an adjudicated survivor that edits it
  again before the commit, so a single early count describes a plan that no
  longer exists and a revision adding the missing citation would still be
  recorded as a zero-citation plan. Recording the pair makes a revision's effect
  on citation visible, which is data the later gate decision needs. Rejected:
  counting once at either end alone. Evidence: `plan.md:238-262` (`check_size`,
  the existing post-return count step, which states its own placement for the
  same reason).
- D-06 (three states): `memory.backend: none` is a THIRD state on the record,
  distinct from both "surfaced nothing" and "surfaced N, cited zero".
  `planning.mjs:2242` returns `{backend:'none', results:[], total:0}` on the off
  path and omits `backend` otherwise, and `plan.md:107-113` skips the call
  entirely on `none`, so on that path there is no envelope at all. This
  repository sets no `memory.backend` and runs the `builtin` default, so its own
  dogfooding never exercises the off arm - the state has to be constructed to be
  tested. Evidence: `.planning/config.json`; `cadence-core/bin/planning.mjs:2242`.

## Decisions

- D-07 (seam surface): the count ships as a `planning.mjs` subcommand taking
  `--phase <N>`, not a new top-level `cadence-core/bin/` script. Phase 1's D-01
  chose a new bin for `/cad-why` BECAUSE its primary argument is a repository
  path; every input here (`phases/<N>/PLAN*.md`, the recall payload,
  `trace.jsonl`) lives under the planning root the dispatcher already passes as
  `--dir`. A new bin would need its own `CONTRACTS` row or self-verify check 14
  files `uncontracted-script`, plus an `arg-contract-adoption.test.mjs` entry.
  Evidence: `cadence-core/bin/planning.mjs:2049` (`cmdPlanOverlap`) and its
  `plan-size` sibling; `cadence-core/bin/self-verify.mjs:1200`.
- D-08 (trace write): the seam appends its own `outcome`-family event IN CODE and
  reports `{written, reason}` on the envelope, rather than staying a pure reader
  with `/cad-plan` issuing a separate `trace append`. `risk-check run` is the
  precedent: it computes and appends `outcome/risk_check` itself on every path
  past argument validation, "so even a refusal leaves the record saying the check
  was ATTEMPTED", with `written`/`reason` on the envelope and an explicit rule
  that the write may NOT change the verdict. The alternative puts two extra
  invocations in `plan.md` and makes the coordinator retype both figures onto
  flags - the transcription surface `planning.mjs:3589-3592` condemns. Evidence:
  `cadence-core/bin/planning.mjs:4203-4245`;
  `cadence-core/bin/trace.test.mjs:1851` (in-code seam producers are admitted to
  the family census).
- D-09 (cited-side reader): the cited side is a TEXTUAL scan of the whole
  `PLAN*.md` file(s), not a structural field, and fence-awareness is not
  required. Phase 1's D-10 established that nothing in a PLAN.md or SUMMARY.md
  structurally references a D-NN and that `templates/PLAN.md`'s `## Context` is
  free prose; measured across all 47 `PLAN*.md` under `.planning/`, 1041 D-NN
  mentions appear and 0 of them are inside a fenced block, with 43 of 47 files
  carrying at least one. Adding a citation field to the template would violate
  this cycle's stated "reader before writer" and would make every archived plan
  uncountable. Evidence: `cadence-core/templates/PLAN.md`.
- D-10 (D-NN scoping): a bare `D-NN` in a plan is phase-scoped to that plan's OWN
  phase, so a plan's `D-08` matches a surfaced decision only when that decision's
  `source` names the same phase. Measured over the same 47 plans: of 1028 D-NN
  mentions, 23 are phase-qualified (2.2%), across at least four spellings
  (`phase 2 D-02`, `` `phases/1/CONTEXT.md` D-13 ``,
  `` `phases/5/CONTEXT.md`: D-01 ``, `` `phases/2/CONTEXT.md`'s D-01 ``).
  Since D-numbers restart per phase, matching by number alone makes the collision
  rate near-total and the legitimate-zero rate would be measured against noise.
  Evidence: `.planning/phases/1/PLAN-1.md:51` and `PLAN-2.md:43`, both opening
  `## Context` with "Locked by `phases/1/CONTEXT.md`: D-08 ...", establishing the
  unqualified numbers after it as own-phase.
- D-11 (surfaced bound): the surfaced set is the BOUNDED `results` the caller was
  handed, never `total`. `--top N` defaults to 5 and `results` is documented as
  ranked and BOUNDED while `total` is how many matched; `plan.md:122` renders one
  line per top result. The reconstructed phase-1 plan-time query returned
  `total: 441` against 5 results, so counting against `total` caps the reported
  rate at about 1% on a set the planner was never shown. Evidence:
  `cadence-core/references/recall.md:23-32`.
- D-12 (inline path): the `--inline` under-threshold path gets the same count as
  `spawn_planner`. `plan.md:171-186` (`inline_plan`) already extends recall to
  that path for precisely this reason - "a real task-breakdown moment with no
  cad-planner dispatch, so it must not skip prior memory" - and writes a
  `PLAN.md` from the same template; criterion 2 names `/cad-plan`, not a dispatch
  mode. Leaving it out would make the cheap planning path the one path with no
  citation data, the same shape of hole this cycle's phase 3 exists to close on
  `/cad-task`. Evidence: `cadence-core/workflows/plan.md:171-186`.
- D-13 (naming constraint): the subcommand's name must NOT contain the token
  `recall`, and no line of new prose may put `recall` and `planning.mjs`
  together, or self-verify files `bulk-output-unregistered`. `BULK_SHAPES`
  watches `/\brecall\b/g` scoped to lines containing `planning.mjs`; running
  `bulkOutputIssues('cadence-core/workflows/plan.md', <probe>)` directly on
  2026-08-23 reported for `planning.mjs ... recall-cite --phase {N}` and for the
  plain sentence "the count compares what recall surfaced against what
  planning.mjs cited", while `cite-count` and `citation-count` produced no issue.
  This is the OPPOSITE of phase 1's D-13, where `BULK_SHAPES` did not see the new
  prescribing site. Evidence: `cadence-core/bin/lib/bulk-output.mjs:142-149`.
- D-14 (re-pinned rows): `cadence-core/workflows/plan.md` is at its exact weight
  budget with zero headroom and is pinned at exactly 9 seam invocations, so this
  phase re-pins both rows with the measurement that justifies them. `weight.mjs
  --root .` reports `plan.md` at 22,638 B against a `weight-budgets.json:71`
  budget of 22638, and self-verify check 4 files `budget-overrun` on
  `bytes > budget`; `seam-calls.test.mjs`'s CENSUS pins `plan.md` at `calls: 9`
  with the note "A tenth means a call came back". Both arms of AC7 fail at once
  otherwise, for prose the phase has to add anyway. Evidence:
  `cadence-core/bin/self-verify.mjs:736`; `cadence-core/bin/seam-calls.test.mjs`.
- D-15 (trace bound): `.planning/trace.jsonl` is gitignored, unpruned and bounded
  at 1 MiB, so "measurable across phases" (criterion 3) means ONE machine's
  history, and the cap is a stated failure mode rather than a silent one.
  `MAX_TRACE_BYTES = 1048576` and `appendEvent` stats before writing, so at the
  cap nothing more is appended and `renderTrace` reports `capped`;
  `lib/milestone-prune.mjs` never touches the file. Current size 419,756 B
  holding 1,762 events on 2026-08-23. A `written:false` with its reason on the
  count's envelope (D-08) is the only place a caller could learn the write was
  dropped. Evidence: `.gitignore` "Joined run record" block;
  `cadence-core/bin/lib/trace.mjs:93`.

## Acceptance criteria

- [ ] AC1: `node cadence-core/bin/planning.mjs <name> --phase 2 --payload <file>`
      emits one JSON object carrying `surfaced` (count plus ids) and `cited`
      (count plus an explicit id list, not a number alone), with a
      `cited_by_kind` breakdown naming the D-NN, CAPTURE and deviation arms
      separately.
- [ ] AC2: given a payload whose results include a row sourced at
      `phases/<the queried N>/`, that row is absent from `surfaced`, while a row
      sourced at `_archive-v*/<the same N>/` is present.
- [ ] AC3: running `/cad-plan` on a phase whose plan cites zero of a non-empty
      surfaced set prints a report naming the count; the plan file's bytes are
      unchanged by the count, no second planner dispatch occurs, and the workflow
      proceeds to its next step rather than stopping.
- [ ] AC4: after that run, `.planning/trace.jsonl` contains an `outcome`-family
      event carrying both figures under the run's correlation id, and the seam's
      envelope carries `written` plus a `reason` when it is false.
- [ ] AC5: three runs are distinguishable on disk by their recorded fields alone
      - `memory.backend: none`, a surfaced set of zero, and a non-empty surfaced
      set cited zero times.
- [ ] AC6: invoking the subcommand twice over an unchanged plan and payload
      returns byte-identical stdout, and the run's trace records no
      `lifecycle/dispatch` event for it.
- [ ] AC7: `node cadence-core/bin/self-verify.mjs --root .` returns `ok:true`
      with `problems: []`, and `node cadence-core/bin/test.mjs` reports 0
      failures.

## Flagged assumptions

None - all assumptions confirmed.
