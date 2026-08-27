<purpose>
Answer "where am I and what's next" from the filesystem and git, then hand
off to the spine skill that does the next piece of work. The derivation is
the planning seam's `status` subcommand - count-based truth from ROADMAP and
phase artifacts; the STATE.md cursor is only a hint. This workflow reports,
reconciles the cursor, and routes. Includes auto-resume of incomplete or
paused phases and stats (`--stats`).
</purpose>

<process>

<step name="derive">
Parse `$ARGUMENTS` for `--stats` and `--trace`.

Run the planning seam:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" status
```

Its one JSON line carries everything this workflow reads:

- `phases[]` - each phase's derived status: **unplanned** (no PLAN) ->
  **planned** (PLAN, no SUMMARY) -> **executed** (SUMMARY, UAT not fully
  passed) -> **complete**, with UAT counts where a checklist exists.
- `current` - the lowest non-complete phase (null when all are complete).
- `cycle` - present and `"none"` ONLY when the phase list is a derived closed
  milestone (the window between a close and the next cycle). There, `current`
  is null because no cycle is OPEN, not because every phase is complete - do
  not conflate the two. Grammar:
  `${CLAUDE_PLUGIN_ROOT}/cadence-core/references/roadmap-phases.md`.
- `cursor` - the parsed STATE.md hint, with `agrees` already computed.
  When its status is `paused`, its `next` is the resume pointer /cad-pause
  wrote - the one-line "where I was".
- `drift[]` - contradictions, by kind: `cursor`, `roadmap-box`, `req-status`,
  `phase-dir` (a `phases/<N>/` dir surviving a milestone close),
  `phase-dir-grammar` (a `phases/` entry outside the directory grammar),
  `phase-dir-collision` (two LEGAL names parsing to one number, `1.1`/`1.10`).
- `deferred` - the unadjudicated review queue: `members[]` (each with `phase`,
  `trigger`, `discriminator`, `round`, `path` and its own `findings` count),
  the total `findings`, and `unreadable[]`. ALWAYS present, unlike `cycle` and
  `drift`: an absent key means a seam that predates the queue, never "nothing
  is deferred". The count this workflow reports comes from HERE and never from
  the cursor's `Next:` text - the cursor is a hint the derivation overrides,
  and parsing a count back out of free text is the substitution this repository
  already condemned for trigger names.

On `ok:false`, relay `reason`/`hint` (e.g. `no-planning-dir` -> "No Cadence
project here. /cad-new-project starts one from a blank page; /cad-adopt starts
one from a repo that already has code and history.") and stop.

On `--stats`, branch straight to the stats step now - it derives its own commit
timeline and needs nothing else; do NOT walk reconcile, which writes STATE.md,
and `--stats` must write nothing. On `--trace`, branch straight to the trace
step under the identical rule: it reads one seam and prints, and must not walk
reconcile either. Otherwise (the normal path) batch a
`git log --oneline -8` for the report's Recent line in the SAME message as
`status` - independent, so they share one message; only a call that consumes a
prior call's output is serialized.
</step>

<step name="reconcile">
- Drift kind `cursor` (or no STATE.md at all): rewrite the cursor to the
  derivation through the seam - never by hand:

  ```
  node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" cursor set \
    --phase <current> --status <derived> --next-file <path>
  ```

  The routed action comes from the table below, and on a `paused` row that is
  the user's own pause note carried forward - so write it to a scratch file and
  pass the PATH (caller-derived text - references/conventions.md).
  Status mapping: unplanned -> `ready to plan`, planned -> `planned`,
  executed -> `executed`; all complete -> `phase complete` (with `--phase`
  = the last phase). A `paused` cursor always agrees - leave it.
- Closed milestone (`cycle` is `none`) with cursor drift: rewrite it as
  `--phase 1 --status "ready to plan" --next "/cad-phase add"` - no
  `--name`/`--total`, the seam derives `of 0 (no active cycle)` from the
  pruned roadmap.
- Drift kind `phase-dir`: the prune was interrupted - route to
  `/cad-milestone` to finish it. NOT to `/cad-verify {N}`: that phase is no
  longer in ROADMAP, so the workflow would refuse it.
- Drift kinds `roadmap-box` / `req-status`: do NOT edit those files here -
  cad-verify is the only writer of a ROADMAP checkbox or a Traceability
  Status beyond `Pending`. Note the drift in the report ("ROADMAP shows
  phase N open but it is complete") and route to `/cad-verify N` to repair it.
</step>

<step name="stats">
(`--stats` only.) Print a summary derived on demand, then stop - no routing,
nothing stored:

- Phases: {complete}/{total} from the status output, one line per phase
- Commits: total on this branch; per-phase counts where the commit message
  scope or touched paths identify a phase (approximate by design)
- Timeline: first commit date, latest commit date, days elapsed
</step>

<step name="trace">
(`--trace` only.) Print what the current phase's run actually did, then stop -
one read, nothing stored. The render is bulk output, so it rides this RUN's own
scratch directory and only the fields this step prints reach the transcript
(`${CLAUDE_PLUGIN_ROOT}/cadence-core/references/conventions.md` states the rule;
the scratch file is the model's own, never a phase artifact):

```
D="$(mktemp -d "${TMPDIR:-/tmp}/cad-trace-XXXXXX")" \
  && node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" trace render --phase <current> > "$D/render.json" \
  && node -e 'const f=require("fs");let r;try{r=JSON.parse(f.readFileSync(process.argv[1],"utf8"))}catch(e){console.error("scratch-unreadable: "+process.argv[1]+": "+e.message);process.exit(1)}if(!r||typeof r!=="object"){console.error("scratch-shape: "+process.argv[1]+" is not an object");process.exit(1)}const miss=["counts","roles","unpaired","capped"].filter((k)=>r[k]===undefined||r[k]===null);if(miss.length){console.error("scratch-shape: "+miss.join(", ")+" absent from "+process.argv[1]);process.exit(1)}console.log(JSON.stringify({counts:r.counts,roles:r.roles,unpaired:r.unpaired,capped:r.capped,rotated:r.rotated}))' "$D/render.json"
```

The directory is made for this run and both calls are `&&`-chained to it, so no
other run's render can be the one this step prints and the read-back cannot run
on a render that failed.

The read-back REFUSES rather than printing an answer it could not stand behind:
`scratch-unreadable` on stderr with a non-zero exit when the file could not be
read or parsed, and `scratch-shape` NAMING the missing field when the parse
succeeded without one of the four this step prints. Both matter here because
the old form had no guard at all - a truncated file threw, and a file of the
wrong shape stringified four `undefined` fields into `{}`, which prints as a
clean, empty, successful answer.

The `brackets` and `outcomes` arrays are the bulk of that response and nothing
in this step reads either, so they stay in the file - widening that field list
to the whole envelope is the same bytes on the same turn and buys nothing.

Print the four family counts (`routing`, `provider`, `lifecycle`, `outcome`)
over the events the phase filter admitted - the filter reads `phase` alone and
never `corr`, so those counts can span several runs of the same phase number;
then the `roles` block, one line per role key carrying its dispatch count, the
host's own token figure off the subagent returns, its turn count, and each of
`unrecorded` and `turns_unrecorded` when present. That block is what each
worker's returns REPORTED, never the run's price - for the reason `/cad-report`
now states where it prints the same figure. Read it by this rule, which is
the distinction the block exists to protect: an absent token total means NO
dispatch of that role reported a figure, and is printed as `unrecorded`, never
as `0` - a role that was never measured and a role that spent nothing are
different answers. The same rule governs the turn total under its own
`turns_unrecorded` counter: a role whose returns carried no tool-call count is
turn-unrecorded, not a role that took zero turns. An `unrecorded` count BESIDE a
real total means that many of
that role's dispatches came back without one, so the total is real but short. A
render carrying no `roles` key prints nothing for it, exactly as an absent trace
file already prints empty counts. Then every `unpaired` entry, which names a worker
that was handed work and never came back with a return, checkpoint or
escalation; then the `capped` flag when it is true, which means the record hit
its size bound and what follows is missing rather than absent; then `rotated`
when the render carries it, which is the OTHER thing a size bound does and not
the same one - the record was cut at the newest phase anchor, so everything
older than the run in flight is in the sibling it names and is not in what was
just read. A rotated record is not a capped one. An absent trace
file returns `ok:true` with empty counts - a phase can simply not have run yet,
and that is an answer, not an error.
</step>

<step name="report">
Compact status, no banners:

```
# {project} - phase {N} of {total}: {name}

{one line per phase: number, name, status}

Recent: {2-3 recent commit subjects}
Paused: {the cursor's Next line}   (only when Status is paused)
Deferred: {deferred.findings} finding(s) across {deferred.members.length} queued fire(s)
```

The `Deferred:` line prints only when `deferred.findings` is non-zero or
`deferred.unreadable` is non-empty, and both figures are read off the `status`
envelope's `deferred` block - never counted by hand and never taken off the
cursor's `Next:` text, even when that text names the queue.

When `cycle` is `none`, the header is `# {project} - milestone closed - no
active cycle` and there is no phase list to print.
</step>

<step name="route">
Pick the next step from the status output, first match wins, one suggestion
only:

| Condition | Next step |
|---|---|
| Paused cursor pointing at the current phase | resume at the cursor's next action |
| Lowest **planned** phase | /cad-execute {N} |
| Lowest **executed** phase | /cad-verify {N} |
| `current` is **unplanned** | /cad-context {N}, or /cad-plan {N} when `workflow.skip_discuss` is true |
| `deferred.findings` non-zero, or `deferred.unreadable` non-empty | triage the queue (`${CLAUDE_PLUGIN_ROOT}/cadence-core/references/triage-gate.md`, the `deferred` arm) - never /cad-land |
| Drift kind `phase-dir` (interrupted prune) | /cad-milestone |
| `cycle` is `none` (milestone closed) | /cad-phase add |
| `current` is null (all complete) | /cad-milestone |

The planned/executed rows scan ALL phases lowest-first, not just the
cursor's phase - this recovers a mid-execution session death even when the
cursor was advanced past the unfinished work. A pause note pointing at a
different phase than the derivation is shown as context but does not route.

The `phase-dir` row sits ABOVE `cycle is none` deliberately: an interrupted
close returns both at once, and finishing the prune precedes opening a new
cycle. Reordering them offers a new phase on top of unfinished work.

The `deferred` row sits BELOW every recovery and work row - a paused cursor, a
planned phase, an executed one - because those are where the work that clears
the queue happens, and ABOVE the three rows that end a cycle, because each of
them leads to a land: `/cad-milestone` chains `/cad-land` after its prune, and
`/cad-land` refuses on this same queue. It is the one row whose next step is
not a skill invocation, so the ask-user offer below reads "triage the queue"
and this workflow invokes nothing.

Offer the suggestion through the ask-user seam (references/seam-ask-user.md):
1. Continue now - invoke the suggested skill
2. Stop here - report only
</step>

<step name="handoff">
If the user chose to continue, invoke the suggested skill and end this
workflow. cad-progress never does the work itself.
</step>

</process>

<guardrails>
- Report and route only - never plan, execute, verify, or fix anything here.
- The seam's derivation is authoritative; never trust the STATE.md cursor
  over it, and never re-derive by hand what `status` already returned.
- The cursor is written only through `cursor set` - no manual STATE.md edits.
- ROADMAP/REQUIREMENTS drift is reported and routed to /cad-verify, never
  edited here.
- No stored analytics or progress artifacts; `--stats` and `--trace` both derive
  on demand and store nothing - the `--trace` scratch render is the model's own
  temp file, never a phase artifact. The trace file itself is written by the seams and
  by the context, plan, execute, verify and verify-deep workflows, plus the
  reviewer bracket in `references/review-triggers.md` - never by progress.
- Never invoke a spine skill without the user accepting the offer.
</guardrails>

<success_criteria>
- [ ] Status came from one `planning.mjs status` call plus git, not from
      hand-derivation or the cursor
- [ ] Incomplete or paused work found lowest-first, with the matching resume
      step offered
- [ ] Cursor rewritten via `cursor set` whenever the seam reported cursor
      drift; other drift routed to /cad-verify untouched
- [ ] Exactly one suggestion made; work handed off only on user acceptance
- [ ] --stats printed a derived summary, and --trace printed the phase's run
      record; neither stored a planning artifact
</success_criteria>
