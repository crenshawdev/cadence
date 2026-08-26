# Phase 4: Keep the record writable - Context

Gathered: 2026-08-26
Feeds: /cad-plan 4

## Scope boundary

In: `.planning/trace.jsonl` stops being able to reach a state where every
subsequent append fails forever. The rotation decision point is `appendEvent`'s
existing pre-write size arm; the live file keeps the in-flight run's tail; the
rotated sibling is gitignored; and two reader envelopes name the record they
read and report that a rotation happened. Serves TRC-08.
Out: expiring stale `unpaired` rows as a deliberate feature (phase 3's D-03
deferred the mechanism here, and rotation drops them as a side effect of the cut
rule - this phase does not add a separate expiry). Pruning the trace at a
milestone close. Re-litigating `MAX_TRACE_BYTES` itself, or the `capped` flag's
meaning on the read side.
Deferred: None.
Plan shape: one plan.

## Durable decisions

- D-01 (Cut rule / F1): rotation carries the tail from the NEWEST
  `lifecycle/phase_start` anchor forward into the new live file, rather than
  renaming the whole file away. `correlationId` scans BACKWARD from the end for
  that anchor and returns the bare `<phase>` with none, so a whole-file rename
  leaves post-rotation events carrying `<phase>` while their dispatch halves
  carry `<phase>-<sha>`: `risk-check.mjs`'s `corr`-scoped lookup and the triage
  gate's prior-`rearm` lookup both miss, and the one-re-arm cap on the only
  blocking trigger fails OPEN. Carrying the tail also keeps gate 2a's
  `render.brackets` and gate 2b's `corr`-scoped candidate set whole for a run in
  flight. Measured 2026-08-26: the newest anchor sits at byte 597,177 of
  604,183, so the carried tail is ~7 KB (1.2%) against 83 anchors and 88
  distinct `corr` in the file. Evidence:
  `cadence-core/bin/lib/trace.mjs:283-303` (`correlationId`), `:641-694` (the
  read-time PASS 2 repair, and `:684-693` where a bare event with no later
  anchor keeps the bare form), `cadence-core/bin/planning/risk-check.mjs:390-422`,
  `cadence-core/references/triage-gate.md:143`,
  `cadence-core/bin/planning/trace.mjs:884-900`,
  `cadence-core/bin/lib/subagent-trace.mjs:474-479` (gate 2a), `:493-497`
  (gate 2b).
- D-02 (Write path): rotation lives in `appendEvent` and nowhere else. Every
  writer in the tree reaches `trace.jsonl` only through that one function, so
  rotation there covers all of them and no call site learns about it. Evidence:
  `cadence-core/bin/lib/trace.mjs:349` (the `size-cap` refusal) and `:377` (the
  only `appendFileSync` on the trace). The complete writer census:
  `cadence-core/bin/route.mjs:873` and `:1351`,
  `cadence-core/bin/review-provider.mjs:532`,
  `cadence-core/bin/subagent-trace.mjs:143`,
  `cadence-core/bin/planning/trace.mjs:765`,
  `cadence-core/bin/planning/task-record.mjs:210`,
  `cadence-core/bin/planning/risk-check.mjs:238`,
  `cadence-core/bin/planning/cite-count.mjs:208`,
  `cadence-core/bin/planning/lease-check.mjs:476`. Rejected: placing rotation in
  `planning/trace.mjs`'s CLI arm, which leaves `route.mjs` and the
  `SubagentStop` hook - the two highest-volume writers, and the only writers of
  a bracket's dispatch half - still write-dead, so brackets open without closing
  while `trace close` keeps succeeding.
- D-03 (Concurrency / F2): rotation is a whole-file `renameSync` claim with NO
  lock: a writer treats EEXIST/ENOENT as "somebody else already rotated",
  re-stats, and proceeds to append. Rejected: `withPlanningFileLock` around
  rotate-and-append, because the `SubagentStop` hook would then acquire a lock
  inside a path its own contract forbids speaking on. The concurrency to design
  against is cross-PROCESS: the hook renders at `subagent-trace.mjs:142` and
  appends at `:143` under a 10-second timeout, so a rotation landing between
  those two is a real interleaving. Evidence:
  `cadence-core/bin/lib/capture-file.mjs:250-295` (the existing single-winner
  `renameSync` claim pattern), `cadence-core/bin/lib/report-rotation.mjs:38-42`
  (fail-closed posture) and `:170-186` (lowest-free-suffix),
  `cadence-core/bin/lib/capture-file.mjs:301` (`withPlanningFileLock`, the
  rejected alternative), `hooks/hooks.json:26-34`.
- D-04 (Atomicity): rotation is a rename plus a fresh write of the carried tail,
  never a read-modify-write truncation in place. Append mode is what makes
  interleaved writers lossless today, and a trim-in-place drops events written
  by the hook between the read and the write - a loss the record's
  `unpaired`/`unrecorded` vocabulary cannot distinguish from a worker that never
  returned. Evidence: `cadence-core/bin/trace.test.mjs:103-118` (the
  concurrent-producers test and its own statement of this rule),
  `cadence-core/bin/lib/trace.mjs:377`, `:66-73`.
- D-05 (Bound / F3): no new config key. Rotation fires at the existing
  `MAX_TRACE_BYTES` and keeps exactly ONE generation, so the total on disk is
  bounded at 2 MiB with no tunable. The three sibling ceilings in this seam
  family are all code constants beside their code:
  `cadence-core/bin/lib/trace.mjs:93` (`MAX_TRACE_BYTES`),
  `cadence-core/bin/lib/read-trace.mjs:52` (`MAX_READS_BYTES`, argued in its own
  doc comment against `MAX_TRACE_BYTES`), `cadence-core/bin/subagent-trace.mjs:48-62`
  (`MAX_TRANSCRIPT_BYTES`). Rejected: a `workflow.max_trace_files` retention key,
  which costs FIVE files - `cadence-core/config.schema.json`,
  `cadence-core/references/config-catalog.md`,
  `cadence-core/references/config-reach.md` (`REACH_DOC` at
  `cadence-core/bin/self-verify.mjs:1216`, `inert-config-key` at `:781`), the
  whole-schema fixture at `cadence-core/bin/self-verify.test.mjs:1410-1417`, plus
  a real reader - and every existing `int` key in the schema carries a measured
  derivation this phase has not budgeted.

## Decisions

- D-06 (Visibility / F4): the rotation signal is `renderTrace`'s existing `file`
  field plus a rotation field on the render envelope; `trace suggest` GAINS
  `file`, which it does not carry today. NOT the `capped` flag: `capped` is the
  same numeric predicate as the write cap but answers a different question
  ("this READ was truncated at the ceiling"), and rotation makes the two come
  apart - a healthy rotated writer beside a reader still looking at a
  head-truncated file. Reusing it would make three shipped prose surfaces print
  "the record hit its size bound and what follows is missing" about a file that
  just rotated successfully. Evidence:
  `cadence-core/bin/lib/trace.mjs:618` (`capped`) versus `:349` (the write arm),
  `:245-262` (`readLines` reads only the FIRST `MAX_TRACE_BYTES`), `:529`
  (`out.file`); `cadence-core/bin/planning/trace.mjs:955` and `:951` (`file` on
  render and window) versus `:857-865` (suggest's envelope, no `file`);
  `.planning/DOCS-CLAIMS.md:981` (PROGRESS-18), `:1167` (REPORT-05), `:1192`
  (SUGGEST-07); `cadence-core/workflows/progress.md:148`,
  `cadence-core/workflows/report.md:114`, `cadence-core/workflows/suggest.md:101`.
- D-07 (Gitignore): the rotated sibling must be gitignored, and is not today.
  Measured 2026-08-26: `git check-ignore -v .planning/trace.jsonl` returns
  `.gitignore:29:/.planning/trace.jsonl` and exits 0, while
  `git check-ignore .planning/trace.1.jsonl` and `.planning/trace.jsonl.1` both
  exit 1; `.planning/_archive-v*/` is not ignored either. Without it the first
  rotation leaves a ~1 MiB untracked file that `git add .planning` sweeps into a
  public repo, reversing D-07 of `v3.6.0` phase 1 (`.planning/ARCHIVE.md:626`)
  and re-creating the failure `cmdTraceIgnore` exists to prevent. The literal is
  written by `cadence-core/bin/planning/trace.mjs:170` and asserted at
  `cadence-core/bin/planning-trace-ignore.test.mjs:73`.
- D-08 (Registration): a rotation event spelled as a new `lifecycle` name is
  INERT in the renderer and needs no producer-census row, because that census
  scans PROSE surfaces plus two code seams only - so it also cannot satisfy
  criterion 3 on its own. `trace render`'s default response carries `brackets`
  plus `outcome` events only, so a `lifecycle` rotation event reaches none of
  the four shipped prose readers. This is why D-06 puts the signal on the
  ENVELOPE. Evidence: `cadence-core/bin/lib/trace.mjs` lifecycle dispatch at
  `:676`, `:688`, `:794`, `:842`, `:853`, `:875` (an unrecognised name falls
  through every branch) and `:634` (`counts` keyed by FAMILY);
  `cadence-core/bin/trace.test.mjs:2089-2150` (the census) and `:1967-1988`
  (`proseSurfaces`), `:2119-2126`; `cadence-core/bin/planning/trace.mjs:962-968`.
- D-09 (Registration): any new CLI surface - a subcommand or a flag on an
  existing one - needs a declared row in the arg contract, or `self-verify`
  fails AC7. Evidence: `cadence-core/bin/lib/arg-contract.mjs:876-918` (the
  per-subcommand rows for `trace close`/`render`/`suggest`/`window`/`ignore`),
  `cadence-core/bin/self-verify.mjs:644` (`unknown-subcommand`) and `:656`
  (`unknown-flag`), `cadence-core/bin/planning/trace.mjs:1000` (the usage line).
- D-10 (Weight budgets): every prose surface that would state the retention rule
  is at EXACTLY zero headroom, so `weight-budgets.json` is re-pinned in the same
  commit as the prose. Measured 2026-08-26:
  `cadence-core/workflows/progress.md` 13,197/13,197;
  `cadence-core/workflows/report.md` 20,038/20,038;
  `cadence-core/workflows/suggest.md` 9,398/9,398;
  `cadence-core/references/config-catalog.md` 12,719/12,719. Evidence:
  `cadence-core/bin/weight-budgets.json`, `cadence-core/bin/self-verify.mjs:816`
  (`budget-overrun`).
- D-11 (Stale rows): dropping the 11 stale `unpaired` rows is a BENEFIT, not a
  regression. Phase 3's D-03 already scoped gate 2b by `corr` so it no longer
  counts them, and D-01's cut rule keeps the live run's brackets in the live
  file, so gate 2a stays sighted. Measured 2026-08-26 via `trace render`:
  exactly 11 `unpaired` rows spanning 2026-08-09T02:40 to 2026-08-26T22:50,
  against 413 brackets. Evidence:
  `cadence-core/bin/lib/subagent-trace.mjs:380-410` (`currentRun`), `:474-479`,
  `:493-497`.
- D-12 (Deadline): the phase is bounded by a live deadline. Measured 2026-08-26
  over all 2,420 lines: 604,183 B = 57.6% of the 1,048,576 B cap, 19 active days
  from 2026-08-07, mean 31,799 B/day, last seven active days 24,035-62,476 B/day.
  The remaining 444,393 B is roughly 11 days at the recent rate. This changes no
  design choice; it sizes the retention window so rotation fires every few weeks
  rather than every few days. Evidence: `.planning/trace.jsonl` (measured),
  `.planning/REQUIREMENTS.md:50-54` (TRC-08, recorded at 567,248 B / 54.1%
  earlier the same day).

## Acceptance criteria

- [ ] AC1: With `.planning/trace.jsonl` at or over `MAX_TRACE_BYTES`, a writer's
      append reports the event written, and reading the live file afterward
      finds that event. Today the same call reports
      `{written:false, reason:"size-cap"}` and the file is unchanged.
- [ ] AC2: Running `planning.mjs trace render --phase N` immediately before and
      immediately after a rotation returns the same `corr` string for the
      in-flight run and the same bracket count under it.
- [ ] AC3: `git check-ignore <the rotated file>` exits 0. Today
      `git check-ignore .planning/trace.1.jsonl` exits 1.
- [ ] AC4: After a rotation, no file in `.planning/` matching the trace or its
      rotated spelling exceeds `MAX_TRACE_BYTES`, and at most one rotated
      generation is present on disk.
- [ ] AC5: `planning.mjs trace render` and `planning.mjs trace suggest` each
      emit a `file` field naming the record read, and the first render after a
      rotation carries a field stating that a rotation happened. A caller
      reading only the envelope can name both.
- [ ] AC6: Two writers each entering the append with the file over cap produce
      exactly one rotated file, and both of their events are present in the live
      file afterward.
- [ ] AC7: `node cadence-core/bin/test.mjs` is green,
      `node cadence-core/bin/self-verify.mjs` reports no problems, and any prose
      surface whose bytes changed is re-pinned in
      `cadence-core/bin/weight-budgets.json`.

## Flagged assumptions

None - all assumptions confirmed.
