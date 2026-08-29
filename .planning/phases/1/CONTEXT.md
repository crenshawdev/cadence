# Phase 1: reads.jsonl rotates instead of dying at the cap - Context

Gathered: 2026-08-28
Feeds: /cad-plan 1

## Scope boundary

In: a rotation for `.planning/reads.jsonl` at its write-time bound, keeping
exactly one prior generation; the claim robustness that makes it safe under
concurrent hook processes; the reader-side signal that a record was cut; the
filter that keeps a rotation marker from being billed as a tool call; and the
three shipped surfaces plus the `.gitignore` rule that a cut makes false.
Out: `lib/trace.mjs`'s own rotation behaviour, fixed in v3.7.5 and not
reopened (ROADMAP OQ-1 rail). Out: the adjudication-record ruling gap - that is
phase 2 and its OQ-2. Out: any retention key to tune, and any change to the
value of `MAX_READS_BYTES` itself.
Deferred: `.gitignore` rules for the `trace.jsonl.rotate.<pid>.<rand>` and
`trace.1.jsonl.evict.<pid>.<rand>` temps a killed TRACE rotation strands - the
open deviation from v3.7.5 phase 4. Adjacent to AC7's reads-side rule and one
filename over, but it is the trace's residue and TRC-10 does not cover it.
Plan shape: multiple plans, same phase - the rotation mechanism (AC1-AC5) and
the reader/prose/ignore surface it makes false (AC6-AC7) are different files,
and the second only settles once the first exists.

## Durable decisions

- D-01 (Where the rotation lives - ROADMAP OQ-1): write a SECOND rotation in
  `cadence-core/bin/lib/read-trace.mjs` that reuses `rotateTrace`'s link-claim
  technique rather than generalizing `rotateTrace` itself. Evidence:
  `cadence-core/bin/lib/trace.mjs:660-943` is bound to the trace at four levels -
  `tracePath`/`rotatedTracePath`/`rotationClaimPath` (`:285-307`), the re-stat
  trigger (`:823`), the carry policy in `freshRecord` (`:467-531`) and the bound
  inside it (`:524`); its exported-for-testing contract at `:651-655` states
  nothing but `appendEvent` calls it; fourteen rotation rows at
  `cadence-core/bin/trace.test.mjs:175-560` are the proof the trace did not
  change, and a signature change reaches all of them. If wrong: reopens a
  function that took two cycles (TRC-08, TRC-09) to settle.
- D-02 (Carry policy): the reads record carries NOTHING across the cut - the
  whole live file becomes the sibling and the fresh record starts empty. There
  is no `freshRecord` analogue and no "run in flight" tail. Evidence: measured
  2026-08-28 over all 37,567 records in this repo's `.planning/reads.jsonl`, 0
  malformed, key-sets are subsets of
  `ts,tool,agent,agent_id,tool_use_id,target,files,bytes,offset,limit` - no
  `corr`, no `phase`, no anchor. Nothing scans it backward:
  `readReadsRecords` (`cadence-core/bin/planning/core.mjs:342-360`) reads whole
  and `joinReads` (`lib/read-trace.mjs:456-515`) joins by timestamp containment
  against `renderTrace(dir).brackets`, which come from `trace.jsonl`. The
  trace's tail exists only because `correlationId` scans backward for its
  anchor (`trace.mjs:427-441`). If wrong: a dispatch open across the cut has
  its earlier reads in the sibling, so R7's per-bracket `ratio`/`worst`
  understates re-reading for that bracket and `trace-suggest.mjs:601-682`
  renders the figure with no caveat.
- D-03 (Write trigger): move to the pre-emptive `size + pending >=
  MAX_READS_BYTES` form and add an oversized-record refusal, matching what
  TRC-08 did to `appendEvent`. Evidence: `lib/read-trace.mjs:282` is the
  post-hoc `statSync(file).size >= MAX_READS_BYTES`; `lib/trace.mjs:1014-1019`
  is the pre-emptive form with an `oversized-event` reason, and `:973-980`
  records why it was reordered - the old arm admitted one last event past the
  bound. Measured: the longest line in this repo's reads.jsonl is 696 bytes
  against 8,388,608, so the oversized arm is unreachable in practice. If wrong:
  reproduces the one-line overshoot the trace already fixed, and
  `cadence-core/bin/read-trace.test.mjs:147-156` keeps asserting a `size-cap`
  refusal that no longer exists.
- D-04 (Rotation signal): the cut reaches both reader envelopes on a key
  DISTINCT from the existing `rotated`, because `rotated` on `trace suggest`
  already means the TRACE rotated. Evidence:
  `cadence-core/bin/planning/trace.mjs:906-924` emits `file: r.file` (the trace
  path) and a conditional `rotated` sourced from `trace.mjs:1323`;
  `cadence-core/workflows/suggest.md:29-30` ties `rotated` specifically to the
  trace's size-bound cut; `cmdReads` (`cadence-core/bin/planning/reads.mjs:16-66`)
  emits neither a `file` nor any rotation key on success. If wrong: one
  `rotated` key means two different records and `suggest.md`'s sentence about
  it becomes silently wrong for whichever record the reader assumed.

## Decisions

- D-05 (Execution environment): the rotation must be lock-free, silent, bounded
  and fail-live. Evidence: `hooks/hooks.json:15-25` gives `read-trace.mjs` a
  `"timeout": 5`, half what `SubagentStop` gets; `cadence-core/bin/read-trace.mjs:10-16`
  states it emits nothing on any stream and exits 0 unconditionally, and `:53-57`
  swallows every failure; `trace.mjs:626-631` (D-03 there) already refuses
  `withPlanningFileLock` for the same class of reason, with `ROTATE_WAIT_MS = 250`
  (`:541`) and `CLAIM_STALE_MS = 30_000` (`:557`) the budgets that posture produced.
- D-06 (Cost): a whole-file read inside that hook is affordable, so cost is not
  a reason to prefer a rename-only cut. Evidence: measured 2026-08-28 against
  the real 7,852,530-byte `.planning/reads.jsonl`, 5 runs - `linkSync` claim +
  `readFileSync` + fresh write + `renameSync` took 1.72, 1.76, 1.76, 2.36 and
  3.90 ms, against a 5,000 ms hook budget and comparable to the 3.17-6.50 ms
  `trace.mjs:549-551` records for a 1 MiB rotation.
- D-07 (Contention): concurrent appends are the ordinary case here, not a
  theoretical one. Evidence: `hooks/hooks.json:17` matches
  `Read|Grep|Glob|Bash|NotebookRead` and `lib/read-trace.mjs:55` records all
  five, one OS process per tool call, so parallel subagents run concurrent
  `appendRead` processes; 37,562 records spanning 2026-08-14 to 2026-08-28
  against `trace.jsonl`'s 663,522 bytes over twice that span.
- D-08 (Readers): `.planning/reads.jsonl` has exactly two readers, both through
  one parse, and no prose surface opens it. Evidence:
  `cadence-core/bin/planning/core.mjs:325-360` (`readReadsRecords`, stated as
  the one line parse in that file), called from
  `cadence-core/bin/planning/reads.mjs:16` and the `trace suggest` arm at
  `cadence-core/bin/planning/trace.mjs:898-904`;
  `cadence-core/workflows/suggest.md:56-58` instructs readers to open neither
  record. No reader bounds its read - unlike `trace.mjs:342-364`'s `readLines`,
  `readReadsRecords` calls `readFileSync` whole.
- D-09 (Marker is not inert): a rotation marker written INTO `reads.jsonl` is
  counted as a read by both folds unless something filters it. Evidence:
  `lib/read-trace.mjs:338-342` does `calls++` for any object and bills
  `r.agent || 'coordinator'` into `byAgent`; `joinReads` at `:475-497` pushes
  `unresolved` for a record with no `agent`; `planning/reads.mjs:47-53` rides
  all six counts on the envelope. Contrast `trace.mjs:276-280`, where the
  marker is inert by construction. If wrong: every rotated project gains a
  phantom read that `cadence-core/workflows/report.md:116` prints in its
  Reading line as a real tool call.
- D-10 (Surfaces the cut falsifies): three shipped surfaces assert nothing ever
  shortens this file, two pinned by tests. Evidence:
  `cadence-core/bin/lib/trace-suggest.mjs:672` builds R7's evidence string
  containing "nothing prunes `.planning/reads.jsonl` at a milestone close",
  asserted verbatim at `cadence-core/bin/trace-suggest.test.mjs:932`;
  `cadence-core/workflows/suggest.md:32-34` says "nothing prunes it at a close
  either"; `cadence-core/workflows/report.md:203-205` says `fileCalls`,
  `fileRedundancy` and `topFiles` span every dispatch the project ever
  recorded, asserted at `cadence-core/bin/prose-agreement.test.mjs:2448-2468`.
- D-11 (No ignore rule ships): nothing Cadence ships writes a `.gitignore` rule
  for the reads record, so a `reads.1.jsonl` sibling lands untracked and
  unignored on every user project. Evidence:
  `cadence-core/bin/planning/trace.mjs:58,76` define exactly two ignore lines,
  both for the trace, and `:214-231` is their only writer; this repo's
  `.gitignore:32-36` carries the trace rules and `/.planning/reads.jsonl` by
  hand. If wrong: the first rotation leaves up to 8 MiB for the next
  `git add .planning` to sweep in - what `ROTATED_IGNORE_LINE`
  (`planning/trace.mjs:66-75`) exists to prevent for the trace, one filename over.
- D-12 (No refusal surface): `appendRead`'s return value reaches no user-facing
  surface, so no refusal-hint or prose row is owed for a new or removed reason
  token. Evidence: `cadence-core/bin/read-trace.mjs:52` discards the return
  outright under the silence contract at `:10-16`;
  `cadence-core/bin/lib/refusal-hints.mjs` names `lib/read-trace.mjs` only at
  `:95` and `:159` as a sub-envelope shape, never as a hinted refusal site;
  `size-cap` appears in one production line, one test assertion and trace.mjs
  comments, on no prose surface. This is also why the write-death went four
  cycles unnoticed.

## Acceptance criteria

- [ ] AC1: With `.planning/reads.jsonl` at or over `MAX_READS_BYTES`, appending
      a record reports it written and reading the live file afterward finds that
      record - not `{written:false, reason:"size-cap"}`.
- [ ] AC2: After two rotations, `.planning/` holds the live record plus exactly
      one sibling, and the first generation's records are present in neither.
- [ ] AC3: Two `appendRead` processes appending at the bound at once leave every
      record they wrote present across the pair on disk, and leave no claim
      behind that would stop a later rotation - no held hard-link claim and no
      private stamp. The shared `.claim` sidecar a completed rotation leaves is
      inert and is not such a claim: unlinking it after the swap would delete
      the fresh sidecar of a process that legitimately claimed in that window,
      which `lib/trace.mjs:912-932` records as costing the reclaim permanently.
- [ ] AC4: With an abandoned claim on disk and the record at the bound, the next
      append rotates rather than refusing.
- [ ] AC5: `cadence-core/bin/trace.test.mjs`'s existing rotation rows pass with
      no edit to that file.
- [ ] AC6: `planning.mjs reads` and `trace suggest` each name the record they
      read and state that a reads rotation happened, on a key that is not the
      trace's `rotated`; and the rotation marker appears in none of `calls`,
      `byAgent`, or the unresolved/coordinator split.
- [ ] AC7: R7's evidence string, `workflows/suggest.md` and `workflows/report.md`
      no longer claim the reads record is never shortened, their pinning tests
      assert the new wording, and a `.gitignore` write covers the reads sibling
      and its claim files.

## Flagged assumptions

- The exact factoring under D-01 - extract the claim primitive (link-claim,
  private sidecar stamp, staleness read, single-winner evict) into a shared
  module both records call, versus copy the technique into `read-trace.mjs` -
  is left to the planner. Likely; if wrong: a copy drifts from the trace's
  claim semantics on the next fix to either one, and a shared module touches
  `trace.mjs`'s call sites, which D-01's rail exists to avoid.
- Which channel carries AC6's signal under D-04 - a new key on both envelopes,
  the existing `warnings[]` channel that `workflows/suggest.md:52-55` already
  dedicates to reads-record problems, or a nested `reads: {file, rotated}` -
  is the planner's call. Likely; if wrong: `cmdReads` grows a field shape a
  later reader has to special-case.
