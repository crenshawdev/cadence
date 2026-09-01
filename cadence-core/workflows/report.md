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
so it rides THIS RUN's own scratch directory
(`${CLAUDE_PLUGIN_ROOT}/cadence-core/references/conventions.md` states the rule;
the file is the model's own scratch, never a phase artifact). The other two stay
inline, under the threshold: `reads --join` measures 2,494 B - re-measured
2026-08-22 on this repository, when the per-role `inDispatch` rows joined that
response, and it grows slowly with the record the same way the render figure
above does - and `trace window` 5,378 B.

```
D="$(mktemp -d "${TMPDIR:-/tmp}/cad-record-XXXXXX")" && T="$$-$(date +%s)" && printf '%s' "$T" > "$D/run-token" \
  && node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" trace render [--phase <N>] > "$D/render.json" \
  && echo "scratch dir: $D  run token: $T"
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" reads --join
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" trace window [--phase <N>]
```

**That last `echo` is why the step exists in this shape.** `compose` runs in a
DIFFERENT Bash invocation, and the tool persists the working directory and not
shell state, so `$D` is empty there. The directory and the run token are printed
here precisely so the next step can carry them as LITERALS - copy the printed
path and the printed token into `compose`'s read-back, and do NOT re-derive
either with a fresh `mktemp`, which would point the read-back at an empty
directory. The token is what makes a carried path safe: a path carried by hand
is the one arm where an EARLIER run's complete, well-formed record still
resolves, and the token it was handed is an id that file cannot supply itself.

Everything below reads from that scratch FILE: `brackets` (one row per paired
dispatch - `role`, `plan`, `event`, `ms`, `tokens`, and `turns` on the rows
whose close carried a tool-call count), `outcomes` (every outcome event),
`roles` (per-role dispatch, token and turn totals, with `unrecorded` and
`turns_unrecorded` beside them), `coordinator` (the
coordinator's own per-step residue, present only where markers were written),
`provider_spend` (what the PROVIDERS said this scope's cross-model reviews cost:
`calls`, `tokens`, `unrecorded` - REVIEW calls that were actually sent, so a
`detect-models` listing, a `/cad-debug` consult and a call refused before the
request left the machine are none of them in it; present only where the scope
holds such a call), `unpaired`, `mismatched`, `capped`, `malformed`, and `rotated` where the
record was cut at its size bound. Never ask for the raw `events`
array: nothing here reads one, and the flag re-buys 27 KB on the one path that
reads a record into a model's context. The third reads the SAME `brackets[]`
rows against the per-role `workflow.max_dispatch_tokens` ceilings and
returns `ceilings`, `problems` (each `{kind, file, detail}`), `compared`,
`unbudgeted` and `unrecorded`; it takes the same `--phase` scope, so pass it
whatever the render got. The second is the in-dispatch read ledger
over `.planning/reads.jsonl` - `fileCalls`, `fileRedundancy`, `topFiles` - and
`--join` ties each record to the dispatch bracket that caused it: `joined`,
`ambiguous`, `unjoined`, `floor`, `coordinator`, `unresolved`, and `inDispatch`
(per-role `roles[]` with `ratio`, `worst` and their bracket counts, plus
`coverage` and `coordinatorFiles`) - the SAME fold `/cad-suggest` reads, so
neither surface recomputes it. Both arms also carry `reads`: the record's own
path, plus `reads.rotated` naming the sibling when that record was cut.
Then open the scoped
phase artifacts that ground the narrative, each at most once:
`.planning/phases/<N>/SUMMARY.md` (deviations, gate-fix commits),
`.planning/phases/<N>/REVIEW-*.md` (persisted advisory findings),
`.planning/phases/<N>/ADJUDICATION-*.json` (one per blocking or adjudicated
fire: the finding bodies and the ruling each was given - that `REVIEW-*.md` glob
cannot match a `.json` sibling, so it is listed separately or the Gates line has
nothing to count), and
`.planning/phases/<N>/reports/plan-*.md` ONLY when SUMMARY is absent (an
unfinished phase). Do not re-read the trace file itself - the render is the
reader.

**The read-back BOUND, or the redirect buys nothing.** Every line of `compose`
below pulls the ONE field it needs out of the scratch file, at the line that
needs it - a `node -e` field read, the shape `workflows/progress.md` and
`references/triage-gate.md` already use:

```
node -e 'const f=require("fs");const d=process.argv[1];let tok;try{tok=f.readFileSync(d+"/run-token","utf8")}catch(e){console.error("scratch-stale: no run token in "+d);process.exit(1)}if(tok!==process.argv[2]){console.error("scratch-stale: "+d+" belongs to another run");process.exit(1)}let r;try{r=JSON.parse(f.readFileSync(d+"/render.json","utf8"))}catch(e){console.error("scratch-unreadable: "+d+"/render.json: "+e.message);process.exit(1)}if(!r||typeof r!=="object"){console.error("scratch-shape: "+d+"/render.json is not an object");process.exit(1)}if(!Array.isArray(r.brackets)){console.error("scratch-shape: brackets is not an array in "+d+"/render.json");process.exit(1)}if(!r.brackets.every((b)=>b&&typeof b==="object")){console.error("scratch-shape: brackets has a non-object entry in "+d+"/render.json");process.exit(1)}for(const b of r.brackets)console.log([b.role,b.plan,b.event,b.ms,b.tokens,b.turns,b.duration_ms].join("\t"))' "<the echoed scratch directory>" "<the echoed run token>"
```

Its first two arguments are the two literals `read_record` printed. It refuses
before it reads anything else: `scratch-stale` when the directory holds no run
token or holds a different one, `scratch-unreadable` when the record cannot be
read or parsed, and `scratch-shape` when `brackets` is not an array - all three
on stderr with a non-zero exit and nothing on stdout, because a report composed
from another run's brackets is worse than no report. Every other field read
below takes the same three guards and the same two leading arguments; only the
last expression changes.

and never read the file whole - no `cat`, no `Read`, no unfiltered `grep` of it
into the transcript. A whole-file read-back after the redirect is the same bytes
on the same turn, which is the transport not happening. The composed report IS
the digest this transport owes the transcript.
</step>

<step name="compose">
Compose the report, tersest form that keeps the receipts. Shape:

```
Phase <N>: <name> - run record
Dispatches: <table: role | rung | tokens | turns | step minutes | worker minutes, one row per `brackets` entry (step minutes from its `ms`, worker minutes from its `duration_ms`, turns from its `turns` key - absent on a row whose close carried none), rung from routing resolves>
Gates: <one line per review fire: trigger, gate, outcome - PASS / FAIL+rearm / survivors count / advisory findings file - from `outcomes` and REVIEW files. Where the fire left an ADJUDICATION record, the survivor figure is that record's rulings COUNTED and checked against the `survivors`/`downgraded`/`refuted` on the event; a fire with no record reads `unrecorded`>
Refuted: <one line per deviation that corrected a D-NN, from SUMMARY deviations; omit the section when none>
Tokens on subagent returns (the host's own per-dispatch figure, not the run's cost - it excludes the orchestrator's own turns, cross-model provider calls, and figureless returns): <total recorded; top role and its share; unrecorded dispatch count>
Gap terms, never a product: <dispatch count; turn count with `turns_unrecorded` beside it; the per-dispatch window figure; the count of dispatches carrying no figure - then the comparator to run for the billed number>
Cross-model reviews (what the PROVIDERS reported off the wire, a different denomination from the token line above and never added to it): <only when `provider_spend` is present: its `tokens` as a provider-reported input+output count, over its `calls` calls, with `unrecorded` beside it when present; no line at all where the scope holds no provider review call>
Window budget (from `trace window`): <only when `problems` is non-empty: one line per crossing - the role, the dispatch it belongs to, its figure and the ceiling it crossed, both as given; then `unbudgeted` roles and `unrecorded` when either is non-zero>
Record health: <only when present: unpaired brackets, mismatched brackets, malformed lines, capped file, rotated record (from `rotated`: the record was cut at the newest phase anchor, so everything older than the run in flight is in the sibling it names and is not in this report - a cut, not a truncation, and not the same fact as capped), coordinator residue (one RUN's, joined on `corr`, not the phase's) - each named, never silently dropped>
Reading (whole `.planning/reads.jsonl`, not this phase): <`fileCalls` calls that carried files, `fileRedundancy` touches per distinct file, the first few `topFiles` with their counts; then `joined` attributed to a bracket, `ambiguous` refused, and `floor` unjoinable by construction; then per role from `inDispatch.roles`, each row whose `ratio` is non-null - the ratio as opens per distinct file inside ONE dispatch, its `worst` file with that file's count, and beside them `inDispatch.coverage` and the `inDispatch.coordinatorFiles` it excluded; then only when `reads.rotated` is present: the record was cut at its size bound, so everything older than the cut is in the sibling it names and is not in this report - a cut, not a truncation; omit the whole line when the record is empty>
```

Rules, all load-bearing:
- Every number is FROM the record. A dispatch with no token figure reports
  `unrecorded`, never an estimate; step minutes come from the row's own `ms`,
  and a null `ms` or a null `tokens` reports absent rather than zero.
- TWO CLOCKS, and the columns are labelled apart because they measure different
  things. Step minutes are the row's `ms`, dispatch-to-close, so they include
  whatever the orchestrator did between the two writes. Worker minutes are the
  row's `duration_ms`, what the HOST reported for the worker itself - copied
  onto the close, never computed and never re-derived from `ms`, which is the
  distinction `cadence-core/bin/lib/trace.mjs`'s `TraceRender` typedef states
  under TWO ELAPSED FIGURES. A bracket with no `duration_ms` key prints
  `unrecorded` in that column and never `0`: an absent wall clock and a worker
  that took no time are different claims, and only one of them is a
  measurement.
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
- The cross-model line is a SECOND denomination and the two are never added.
  `provider_spend.tokens` is an input+output count the PROVIDER reported off the
  wire, summed across the panel; the token line above is a final-window figure
  the execution HOST reported for one dispatch. Print them as two lines with
  their sources named, never as one total and never as a share of each other.
  It is fed from `provider_spend` and never from a Dispatches row: that table is
  one row per bracket, and a phase whose reviews all ran cross-model has no
  `cad-reviewer` bracket to make a row from - measured 2026-09-01,
  `/code/verbatim` phases 5-8 hold 4, 4, 5 and 4 provider reviews against zero
  `cad-reviewer` dispatches each. A call whose event carried no usage counts
  under `unrecorded`, never as a zero, and a scope holding no such call at all
  prints NO line rather than an empty one - the same silence the `coordinator`
  block gets.
- What `calls` COUNTS, because the label is a claim about it: review calls that
  reached a provider. The seam writes the same event for two other commands -
  `detect-models`, which lists a provider's model ids, and `consult`,
  `/cad-debug`'s dead-end second opinion - and for a review it refused before
  sending anything, and `provider_spend` leaves all of them out. So this line is
  not the phase's whole provider bill and must not be printed as one; the calls
  it omits are still counted in the render's `counts.provider`, which is where
  to look when the two numbers disagree. Read the key with the same guarded `node -e` field
  read every other line uses, carrying the same two printed literals and
  refusing the same three ways; never a whole-file read-back and never the raw
  `events` array.
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
- The residue is the ONE figure here that is scoped to a run rather than to a
  phase - the exception to the bullet above, so say a run and never a phase when
  describing it. It is joined on `corr`, so each run's last marker closes at
  that run's own last event; a re-run under the same phase number contributes
  its own windows beside the first run's, and no window ever spans the clock
  between two runs. A marker that is its run's last event closes at itself and
  contributes nothing.
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
  scoping: `fileCalls`, `fileRedundancy` and `topFiles` span every dispatch
  still in the LIVE record, so the line says so even when the report is scoped
  to one phase - it does not price the phase. No close prunes that record; the
  one thing that shortens it is the cut at its size bound, and `reads.rotated`
  on the return is how you know it happened. Report every figure as returned,
  recomputed nowhere. `inDispatch` is that same file read PER ROLE and PER
  DISPATCH - `roles[].ratio` is opens per distinct file INSIDE one bracket and
  `roles[].worst` names the file that bracket opened most - so it answers a
  different question from `fileRedundancy` and the two are never averaged,
  compared or presented as one figure. Three dispositions, and the third is the
  live one:
  - `calls: 0`, or the `no reads recorded yet` note: say nothing about reading
    at all - the same silence the `coordinator` block gets, because zeros from
    an absent record read as a run that opened no files.
  - `calls > 0` with a NULL `ratio` on a role: say nothing about in-dispatch
    re-reading for that role, and never narrate the null as `0`. Every record
    written before the `files` field existed folds to a null, so this is the
    ordinary live case rather than a broken one, and `0` is the reading that
    says the worker opened each file exactly once.
  - a ratio present: state it with BOTH limits the seam returns beside it,
    because either one missing lets the figure read as a total.
    `inDispatch.coverage` is the share of the joined reads in scope that
    recorded file paths, which is the denominator the ratio was actually
    computed over; `inDispatch.coordinatorFiles` is the count of file-carrying
    `coordinator` reads it EXCLUDED, and they are excluded because a coordinator
    read has no worker bracket by construction - the main thread's own
    re-reading cannot be attributed to a dispatch and is outside what this
    figure can measure or cut.
- What the join attributes, and what it never will. `joined` is a read tied to
  the bracket that caused it; `ambiguous` is a read inside two overlapping
  same-role brackets, which the seam refuses to guess between rather than
  picking one. `floor` is a permanent LIMIT, not a gap: `fork` and
  `general-purpose` are HOST agent types with no dispatch event to join to, so
  say so in those words. `coordinator` reads have no worker bracket by
  construction and `unresolved` ones carried no readable agent - report either
  only when nonzero, and never as a failed join.
- The Gates line's survivor figure is COUNTED from the record and never narrated
  out of the event alone. Read the fire's
  `.planning/phases/<N>/ADJUDICATION-<trigger>-<discriminator>.json`, count its
  entries by `ruling`, and compare that against the `survivors`, `downgraded`
  and `refuted` the same fire's `outcomes` event carries. Two independent
  artifacts is the whole point: `.planning/trace.jsonl` is gitignored, so
  custody rests on the committed record and the trace is the local cross-check,
  and comparing them is the only thing that makes a tampered record visible.
- A DISAGREEMENT between the two is NAMED, never silently resolved to one side:
  print both figures and the record's path and say which artifact said which.
  Preferring either one quietly is how the report would launder exactly the
  defect the comparison exists to surface.
- A fire with NO record reads as `unrecorded`. Synthesize no entry and narrate
  no count that cannot be recomputed: earlier phases kept counters rather than
  finding bodies, and the advisory arm writes no record at all
  (`references/review-triggers.md` states why), so a fire predating the format
  has nothing faithful to reconstruct from and says so - the same voice this
  command already uses for an absent `coordinator` block, and not a zero.
- The record is read for the ONE count the line needs, exactly as `read_record`'s
  read-back bound requires of the render: it is a phase artifact opened at most
  once, never dumped whole into the transcript. The Refuted line below reads
  SUMMARY deviations and nothing from here - it consumes a deviation that
  corrected a D-NN, which has nothing to do with a gate's findings.
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
