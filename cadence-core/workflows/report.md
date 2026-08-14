<purpose>
The run record already holds the story of what a phase cost and what that
spend caught; this command tells it. Everything reported is drawn from
`.planning/trace.jsonl` and the phase's own artifacts - no subagent runs, no
file is written, and a number that is not in the record is not in the report.
</purpose>

<process>

<step name="scope">
Parse `$ARGUMENTS`: a phase number scopes to that phase; `--all` spans the
whole record; neither means the STATE cursor's phase (`planning.mjs cursor
get`). No `.planning/trace.jsonl` -> say so and stop: there is no record to
report, which is itself the answer.
</step>

<step name="read_record">
Two seam calls:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" trace render [--phase <N>]
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" reads
```

Everything below reads from the first return: `events`, `roles` (per-role
dispatch and token totals), `coordinator` (the coordinator's own per-step
residue, present only where markers were written), `unpaired`, `mismatched`,
`capped`, `malformed`. The second is the in-dispatch read ledger over
`.planning/reads.jsonl` - `fileCalls`, `fileRedundancy`, `topFiles` - and takes
no phase scoping and no flag.
Then open the scoped
phase artifacts that ground the narrative, each at most once:
`.planning/phases/<N>/SUMMARY.md` (deviations, gate-fix commits),
`.planning/phases/<N>/REVIEW-*.md` (persisted advisory findings), and
`.planning/phases/<N>/reports/plan-*.md` ONLY when SUMMARY is absent (an
unfinished phase). Do not re-read the trace file itself - the render is the
reader.
</step>

<step name="compose">
Compose the report, tersest form that keeps the receipts. Shape:

```
Phase <N>: <name> - run record
Dispatches: <table: role | rung | tokens | minutes, one row per dispatch/return pair, from lifecycle brackets + routing resolves>
Gates: <one line per review fire: trigger, gate, outcome - PASS / FAIL+rearm / survivors count / advisory findings file - from outcome events and REVIEW files>
Refuted: <one line per deviation that corrected a D-NN, from SUMMARY deviations; omit the section when none>
Tokens on subagent returns (the host's own per-dispatch figure, not a measured cost): <total recorded; top role and its share; unrecorded dispatch count>
Record health: <only when present: unpaired brackets, mismatched brackets, malformed lines, capped file, coordinator residue - each named, never silently dropped>
Reading (whole `.planning/reads.jsonl`, not this phase): <`fileCalls` calls that carried files, `fileRedundancy` touches per distinct file, the first few `topFiles` with their counts; omit the whole line when the record is empty>
```

Rules, all load-bearing:
- Every number is FROM the record. A dispatch with no token figure reports
  `unrecorded`, never an estimate; minutes come from the bracket's own
  dispatch/return timestamps.
- What that token line EXCLUDES, stated where it is printed: an advisory fire
  records none, because its reviewer closes its own bracket with no `--tokens`
  (`references/review-triggers.md`, the advisory persistence tail), and a
  cross-model provider call records none by design - no lifecycle bracket and no
  token field on that arm at all. So the total prices the claude-subagent voice
  only, and it is short by an unstated amount rather than being a run's cost.
- The coordinator residue is `coordinator.residue_ms` and the `steps[]` row
  carrying the most of it, reported AS GIVEN - the renderer computes it once so
  this line and `trace suggest` cannot disagree, and prose recomputing it is how
  they start to. No `coordinator` block means say nothing about residue at all:
  not a zero, not an absence.
- That residue is TIME the coordinator spent between worker brackets, never
  tokens. A marker carries no token figure, because a figure is read off a
  subagent's return metadata and the coordinator has no such return.
- A `mismatched` entry is a bracket whose terminal named a role its dispatch did
  not. Name the worker it belongs to - its `corr`/`phase`/`plan`, at the
  terminal's `ts` - with BOTH roles: `dispatched`, the role the dispatch opened,
  and `closed`, the role its terminal named. The tokens stay
  billed to the dispatch's role, so a mismatch is a recording defect at one of
  those two prose sites, to fix THERE - never a correction to make in this
  report.
- The reading line prices `.planning/reads.jsonl`, which carries NO phase
  scoping: `fileCalls`, `fileRedundancy` and `topFiles` span every dispatch the
  project ever recorded, so the line says so even when the report is scoped to
  one phase - it does not price the phase. Report the three as returned,
  recomputed nowhere. When the return carries `calls: 0` or its `no reads
  recorded yet` note, say nothing about reading at all - the same silence the
  `coordinator` block gets, because zeros from an absent record read as a run
  that opened no files.
- An advisory fire whose findings file is absent AND whose return is missing
  reports as `lost before persistence shipped` when the dispatch predates the
  findings-file convention, else as `in flight`.
- `--all` renders per-phase subtotals then one milestone line - same shape,
  one block per phase, no invented rollup categories.
</step>

<step name="done">
Print the report. One suggestion max: `/cad-suggest`, whose rules live in
`cadence-core/workflows/suggest.md`, when the report shows a pattern worth a
retune look (a gate with repeated empty adjudications, repeated escalations) -
name it, do not run it unasked.
</step>

</process>

<guardrails>
- Read-only. No planning file, trace line, or config key is written, and no
  subagent is dispatched - this command prices work, it never performs any.
- No fabricated figures: a number absent from the record is reported absent.
</guardrails>
