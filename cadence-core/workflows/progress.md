<purpose>
Answer "where am I and what's next" from the filesystem and git, then hand
off to the spine skill that does the next piece of work. Count-based truth:
ROADMAP.md phases vs phases/<N>/ artifacts decide status; STATE.md is only a
hint. Folds in GSD's resume-work (auto-resume of incomplete or paused phases)
and stats (`--stats`).
</purpose>

<process>

<step name="parse">
Parse `$ARGUMENTS` for `--stats`.
If `.planning/` does not exist: "No Cadence project here. /cad-new-project
starts one." Stop.
If ROADMAP.md is missing or has no parseable phase list, report exactly that
and stop - this is the only health check cad-progress performs.
</step>

<step name="derive">
Build the truth from files and git, never from logs or memory:

1. Parse ROADMAP.md: phase numbers, names, goals.
2. For each phase N, inspect `.planning/phases/<N>*/`:
   - no PLAN.md -> **unplanned**
   - PLAN.md without SUMMARY.md -> **planned** (execution incomplete)
   - SUMMARY.md, but UAT.md missing or has failing/pending items -> **executed** (unverified)
   - SUMMARY.md and UAT.md fully passed -> **complete**
3. `git log --oneline -8` for recent context.
4. Read the STATE.md cursor (phase / status / next, plus the one-line pause
   note if /cad-pause wrote one). It is a hint only.

Current phase = the lowest-numbered phase that is not complete. If the cursor
disagrees with the derivation, the derivation wins.
</step>

<step name="reconcile">
If STATE.md is missing, or its cursor disagrees with the derived current
phase/status, overwrite it with the derived cursor in the canonical schema
(references/conventions.md): `Phase: <N> of <total> (<name>)`, the derived
status, next action, `Updated:` today, keeping an existing pause note only if
it still applies. Overwrite, never append - git is the log.

Also check the persisted status hints against the derivation, but do NOT edit
those files here - cad-verify is their single writer:
- ROADMAP `## Phases` box: a phase derived complete whose box is still `- [ ]`
  (or vice versa) is drift.
- REQUIREMENTS Traceability: a complete phase's requirement still `Pending`
  is drift.
On drift, note it in the report ("ROADMAP shows phase N open but it is
complete") and route to `/cad-verify N` to repair it. Only the STATE cursor is
rewritten here.
</step>

<step name="stats">
(`--stats` only.) Print a summary derived on demand, then stop - no routing,
nothing stored:

- Phases: {complete}/{total}, one line per phase with status
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
Paused: {one-line note}          (only if a pause note exists)
```
</step>

<step name="route">
Pick the next step, first match wins, one suggestion only:

| Condition | Next step |
|---|---|
| Pause note matches the derived current phase | resume at the cursor's next action |
| Lowest **planned** phase (PLAN, no SUMMARY) | /cad-execute {N} |
| Lowest **executed** phase (unverified) | /cad-verify {N} |
| Next roadmap phase **unplanned** | /cad-context {N}, or /cad-plan {N} when `workflow.skip_discuss` is true |
| All phases complete | /cad-milestone |

The planned/executed rows scan ALL phases lowest-first, not just the cursor's
phase - this recovers a mid-execution session death even when the cursor was
advanced past the unfinished work. A pause note pointing at a different phase
than the derivation is shown as context but does not route.

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
- Derived counts are authoritative; never trust the STATE.md cursor over them.
- STATE.md stays a ~4-line overwritten cursor - no audit log, no history.
- No stored analytics or progress artifacts; --stats derives on demand.
- The only health check is "does ROADMAP.md parse". Deeper integrity auditing
  is out of scope.
- Never invoke a spine skill without the user accepting the offer.
</guardrails>

<success_criteria>
- [ ] Status derived from ROADMAP/phase-dir/UAT counts plus git, not from the cursor
- [ ] Incomplete or paused work found lowest-first, with the matching resume step offered
- [ ] STATE.md rewritten whenever it disagreed with the derivation
- [ ] Exactly one suggestion made; work handed off only on user acceptance
- [ ] --stats printed a derived summary and wrote nothing
</success_criteria>
