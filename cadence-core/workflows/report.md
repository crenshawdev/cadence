<purpose>
The run record already holds the story of what a phase cost and what that
spend caught; this command tells it. Everything reported is drawn from
`.planning/trace.jsonl` and the phase's own artifacts - no subagent runs, no
planning file is written (the render's scratch file is the model's own temp),
and a number that is not in the record is not in the report.
</purpose>

<process>

<step name="scope">
Parse `$ARGUMENTS`: a phase number scopes to that phase; `--all` spans the
whole record; neither means the STATE cursor's phase (`planning.mjs cursor
get`). No `.planning/trace.jsonl` -> say so and stop: there is no record to
report, which is itself the answer.
</step>

<step name="read_record">
Three seam calls. The render is the largest response any Cadence prose
prescribes - measured 2026-08-17 at 68,044 B unscoped and 14,857 B at
`--phase 3` on this repository, and the unscoped figure grows with the record -
so it rides a scratch file
(`${CLAUDE_PLUGIN_ROOT}/cadence-core/references/conventions.md` states the rule;
the file is the model's own scratch, never a phase artifact). The other two stay
inline, under the threshold: `reads --join` measures 1,507 B and `trace window`
5,378 B.

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" trace render [--phase <N>] > "${TMPDIR:-/tmp}/cad-record.json"
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" reads --join
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" trace window [--phase <N>]
```

Everything below reads from that scratch FILE: `brackets` (one row per paired
dispatch - `role`, `plan`, `event`, `ms`, `tokens`, and `turns` on the rows
whose close carried a tool-call count), `outcomes` (every outcome event),
`roles` (per-role dispatch, token and turn totals, with `unrecorded` and
`turns_unrecorded` beside them), `coordinator` (the
coordinator's own per-step residue, present only where markers were written),
`unpaired`, `mismatched`, `capped`, `malformed`. Never ask for the raw `events`
array: nothing here reads one, and the flag re-buys 27 KB on the one path that
reads a record into a model's context. The third reads the SAME `brackets[]`
rows against the per-role `workflow.max_dispatch_tokens` ceilings and
returns `ceilings`, `problems` (each `{kind, file, detail}`), `compared`,
`unbudgeted` and `unrecorded`; it takes the same `--phase` scope, so pass it
whatever the render got. The second is the in-dispatch read ledger
over `.planning/reads.jsonl` - `fileCalls`, `fileRedundancy`, `topFiles` - and
`--join` ties each record to the dispatch bracket that caused it: `joined`,
`ambiguous`, `unjoined`, `floor`, `coordinator`, `unresolved`.
Then open the scoped
phase artifacts that ground the narrative, each at most once:
`.planning/phases/<N>/SUMMARY.md` (deviations, gate-fix commits),
`.planning/phases/<N>/REVIEW-*.md` (persisted advisory findings), and
`.planning/phases/<N>/reports/plan-*.md` ONLY when SUMMARY is absent (an
unfinished phase). Do not re-read the trace file itself - the render is the
reader.

**The read-back BOUND, or the redirect buys nothing.** Every line of `compose`
below pulls the ONE field it needs out of the scratch file, at the line that
needs it - a `node -e` field read, the shape `workflows/progress.md` and
`references/triage-gate.md` already use:

```
node -e 'const r=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));for(const b of r.brackets)console.log([b.role,b.plan,b.event,b.ms,b.tokens,b.turns].join("\t"))' "${TMPDIR:-/tmp}/cad-record.json"
```

and never read the file whole - no `cat`, no `Read`, no unfiltered `grep` of it
into the transcript. A whole-file read-back after the redirect is the same bytes
on the same turn, which is the transport not happening. The composed report IS
the digest this transport owes the transcript.
</step>

<step name="compose">
Compose the report, tersest form that keeps the receipts. Shape:

```
Phase <N>: <name> - run record
Dispatches: <table: role | rung | tokens | turns | minutes, one row per `brackets` entry (minutes from its `ms`, turns from its `turns` key - absent on a row whose close carried none), rung from routing resolves>
Gates: <one line per review fire: trigger, gate, outcome - PASS / FAIL+rearm / survivors count / advisory findings file - from `outcomes` and REVIEW files>
Refuted: <one line per deviation that corrected a D-NN, from SUMMARY deviations; omit the section when none>
Tokens on subagent returns (the host's own per-dispatch figure, not the run's cost - it excludes the orchestrator's own turns, cross-model provider calls, and figureless returns): <total recorded; top role and its share; unrecorded dispatch count>
Gap terms, never a product: <dispatch count; turn count with `turns_unrecorded` beside it; the per-dispatch window figure; the count of dispatches carrying no figure - then the comparator to run for the billed number>
Window budget (from `trace window`): <only when `problems` is non-empty: one line per crossing - the role, the dispatch it belongs to, its figure and the ceiling it crossed, both as given; then `unbudgeted` roles and `unrecorded` when either is non-zero>
Record health: <only when present: unpaired brackets, mismatched brackets, malformed lines, capped file, coordinator residue - each named, never silently dropped>
Reading (whole `.planning/reads.jsonl`, not this phase): <`fileCalls` calls that carried files, `fileRedundancy` touches per distinct file, the first few `topFiles` with their counts; then `joined` attributed to a bracket, `ambiguous` refused, and `floor` unjoinable by construction; omit the whole line when the record is empty>
```

Rules, all load-bearing:
- Every number is FROM the record. A dispatch with no token figure reports
  `unrecorded`, never an estimate; minutes come from the row's own `ms`, and a
  null `ms` or a null `tokens` reports absent rather than zero.
- What that token line EXCLUDES, stated where the figure is printed, in the
  same three names `cadence-core/bin/lib/trace-suggest.mjs` exports as
  `SPEND_EXCLUDES` and `/cad-suggest` relays - one list, so the two surfaces
  cannot end up claiming different things:
  - the orchestrator's own turns. A figure is read off a subagent RETURN and
    the coordinator has no return of its own, so every turn it takes
    contributes nothing to this total. It is the majority of what is missing
    and the one arm this report never stated.
  - cross-model provider calls. None by design - no lifecycle bracket and no
    token field on that arm at all.
  - figureless returns. A close that carried no `--tokens`, an advisory fire
    among them because its reviewer closes its own bracket without one
    (`references/review-triggers.md`, the advisory persistence tail); they
    count under `unrecorded`, never as a zero.
  So the total prices recorded claude-subagent returns only, short by an
  unstated amount, and it is not what the run cost.
- The gap is printed as its TERMS and never as one number: the dispatch count,
  the turn count with `turns_unrecorded` beside it, the per-dispatch window
  figure, and the count of dispatches that came back with no figure. The
  per-dispatch window figure is the `tokens` on each `brackets[]` row, and say
  it is a PROXY: it behaves like that dispatch's FINAL context window rather
  than a sum across its turns, so multiplying it by the turns that grew that
  window double-counts the early ones. Print no ratio and no single gap number -
  a later budgeting decision needs the factors, and a stored product recreates
  the maintenance loop `v2.7.0` deleted when it removed the checked-in derived
  figures.
- A window crossing is a FINDING and refuses nothing. The dispatch it names
  already returned - nothing in the dispatch seam can resize or cancel a running
  one - so the line reports what a completed run cost against a ceiling, and the
  run it came from completed. Its figure is the SAME final-window proxy the gap
  terms above describe, read off the same `brackets[]` `tokens` key, so this
  command never acquires a second, differently denominated window number. Print
  the figure and the ceiling as the two numbers they are and never their
  quotient, and print no crossing the seam did not return: a role with no ceiling
  counts under `unbudgeted` and a return with no figure under `unrecorded`,
  neither as a zero and neither as a crossing.
- The billed figure comes from a tool the USER runs, named here only as
  provenance: `burnrate`, which is what the measurement behind this line was
  taken against. Cadence fetches nothing, shells out to nothing and bundles
  nothing to obtain it, which is what keeps README's "ships no instrumentation
  and phones nothing home" true. Name the comparator and stop; never print a
  billed number this command did not read out of the record.
- `--phase <N>` does NOT scope a run, and the line describing the figure says
  so. The filter reads the events' `phase` field alone and never `corr`, so a
  phase-scoped figure can pool several cycles that used the same phase number:
  measured on this repository, `trace render --phase 1` spans 12 distinct
  `corr` ids. A caveat attached to a total that pooled twelve cycles would be a
  worse claim than the one it replaced.
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
  one phase - it does not price the phase. Report every figure as returned,
  recomputed nowhere. When the return carries `calls: 0` or its `no reads
  recorded yet` note, say nothing about reading at all - the same silence the
  `coordinator` block gets, because zeros from an absent record read as a run
  that opened no files.
- What the join attributes, and what it never will. `joined` is a read tied to
  the bracket that caused it; `ambiguous` is a read inside two overlapping
  same-role brackets, which the seam refuses to guess between rather than
  picking one. `floor` is a permanent LIMIT, not a gap: `fork` and
  `general-purpose` are HOST agent types with no dispatch event to join to, so
  say so in those words. `coordinator` reads have no worker bracket by
  construction and `unresolved` ones carried no readable agent - report either
  only when nonzero, and never as a failed join.
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
