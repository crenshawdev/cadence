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
Parse `$ARGUMENTS` for `--stats`.

Run the planning seam:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" status
```

Its one JSON line carries everything this workflow reads:

- `phases[]` - each phase's derived status: **unplanned** (no PLAN) ->
  **planned** (PLAN, no SUMMARY) -> **executed** (SUMMARY, UAT not fully
  passed) -> **complete**, with UAT counts where a checklist exists.
- `current` - the lowest non-complete phase (null when all are complete).
- `cursor` - the parsed STATE.md hint, with `agrees` already computed.
  When its status is `paused`, its `next` is the resume pointer /cad-pause
  wrote - the one-line "where I was".
- `drift[]` - contradictions, by kind: `cursor`, `roadmap-box`, `req-status`.

On `ok:false`, relay `reason` and its `hint` (e.g. `no-planning-dir` ->
"No Cadence project here. /cad-new-project starts one.") and stop.

Then `git log --oneline -8` for recent context.
</step>

<step name="reconcile">
- Drift kind `cursor` (or no STATE.md at all): rewrite the cursor to the
  derivation through the seam - never by hand:

  ```
  node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" cursor set \
    --phase <current> --status <derived> --next "<routed action from below>"
  ```

  Status mapping: unplanned -> `ready to plan`, planned -> `planned`,
  executed -> `executed`; all complete -> `phase complete` (with `--phase`
  = the last phase). A `paused` cursor always agrees - leave it.
- Drift kinds `roadmap-box` / `req-status`: do NOT edit those files here -
  cad-verify is their single writer. Note the drift in the report
  ("ROADMAP shows phase N open but it is complete") and route to
  `/cad-verify N` to repair it.
</step>

<step name="stats">
(`--stats` only.) Print a summary derived on demand, then stop - no routing,
nothing stored:

- Phases: {complete}/{total} from the status output, one line per phase
- Commits: total on this branch; per-phase counts where the commit message
  scope or touched paths identify a phase (approximate by design)
- Timeline: first commit date, latest commit date, days elapsed
</step>

<step name="report">
Compact status, no banners:

```
# {project} - phase {N} of {total}: {name}

{one line per phase: number, name, status}

Recent: {2-3 recent commit subjects}
Paused: {the cursor's Next line}   (only when Status is paused)
```
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
| `current` is null (all complete) | /cad-milestone |

The planned/executed rows scan ALL phases lowest-first, not just the
cursor's phase - this recovers a mid-execution session death even when the
cursor was advanced past the unfinished work. A pause note pointing at a
different phase than the derivation is shown as context but does not route.

Offer the suggestion through the ask-user seam (references/seams.md):
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
- No stored analytics or progress artifacts; --stats derives on demand.
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
- [ ] --stats printed a derived summary and wrote nothing
</success_criteria>
