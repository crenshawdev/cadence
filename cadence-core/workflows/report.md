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
One seam call:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" trace render [--phase <N>]
```

Everything below reads from its return: `events`, `roles` (per-role dispatch
and token totals), `unpaired`, `capped`, `malformed`. Then open the scoped
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
Spend: <total recorded tokens; top role and its share; unrecorded dispatch count>
Record health: <only when present: unpaired brackets, malformed lines, capped file - each named, never silently dropped>
```

Rules, all load-bearing:
- Every number is FROM the record. A dispatch with no token figure reports
  `unrecorded`, never an estimate; minutes come from the bracket's own
  dispatch/return timestamps.
- An advisory fire whose findings file is absent AND whose return is missing
  reports as `lost before persistence shipped` when the dispatch predates the
  findings-file convention, else as `in flight`.
- `--all` renders per-phase subtotals then one milestone line - same shape,
  one block per phase, no invented rollup categories.
</step>

<step name="done">
Print the report. One suggestion max: `planning.mjs trace suggest` when the
report shows a pattern worth a retune look (a gate with repeated empty
adjudications, repeated escalations) - name it, do not run it unasked.
</step>

</process>

<guardrails>
- Read-only. No planning file, trace line, or config key is written, and no
  subagent is dispatched - this command prices work, it never performs any.
- No fabricated figures: a number absent from the record is reported absent.
</guardrails>
