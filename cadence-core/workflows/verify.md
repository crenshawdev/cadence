<purpose>
Conversational UAT for a completed phase, with persistent state. Builds or
refreshes `.planning/phases/<N>/UAT.md` from the phase's acceptance
criteria, then walks the user through untested items one at a time: show
what SHOULD happen, ask whether it does. Results persist across sessions
and /clear - re-running resumes at the first untested item.

The user tests, Claude records. Plain-text answers. Severity is inferred,
never asked. Failures are diagnosed and routed through the normal Cadence
flow (user-approved atomic fix commit, or /cad-plan for phase-sized gaps) -
there is no internal auto-fixer loop.

All checklist persistence goes through the planning seam's `uat` subcommands
- the model extracts and words items and infers results; the seam owns the
file and its invariants (first_pass set once, verifier never overwrites a
user result, counts recomputed every write).

`--sweep` folds the cross-phase audit in (cold branch: verify-sweep.md).
`--deep` adds a goal-backward codebase pass (cold branch: verify-deep.md).
</purpose>

<process>

<step name="parse">
Parse `$ARGUMENTS`: optional phase number, `--sweep`, `--deep`.

- `--sweep` -> Read `${CLAUDE_PLUGIN_ROOT}/cadence-core/workflows/verify-sweep.md`
  and follow it (it returns here on resume).
- Phase number given -> that phase.
- Neither -> `planning.mjs cursor get` for the current phase. No cursor and
  no argument: ask which phase to verify (ask-user seam).
</step>

<step name="build_or_resume">
Check the checklist state:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" uat status --phase <N>
```

**If it exists** (`ok:true`): announce progress from `counts`
("{tested}/{total} tested, {failed} failed so far"). Then refresh: extract
the acceptance criteria (sources below), and pipe any criterion not already
covered as a new item:

```
node ".../planning.mjs" uat refresh --phase <N> --items -
   stdin: [{"name":"...","expected":"..."}]
```

Refresh appends only genuinely new names - recorded results are never
touched, and an item whose source criterion no longer exists stays in place
(tell the user so they can skip it deliberately). Continue to `deep_check`.

**If it does not exist** (`no-uat`): extract the items from the phase's
acceptance criteria, in this source order:

1. `.planning/phases/<N>/CONTEXT.md` acceptance criteria, if present.
2. Else: each verification in `.planning/phases/<N>/PLAN.md` (the per-task
   "running X shows Y" lines) plus the phase's success criteria from
   `.planning/ROADMAP.md`.

Also read `SUMMARY.md` if present for user-observable deliverables the
criteria miss - each becomes an item too.

Item rules (the model's judgment, before the seam call):
- One item per observable behavior: name + expected (what the user should
  SEE, specific and falsifiable). Skip internal criteria (refactors, type
  changes) - execution already covered those.
- Deduplicate: a PLAN verification restating a ROADMAP criterion is one
  item, worded as the ROADMAP criterion (the contract).
- A criterion tagged `(human-verify: needs <tool/service>)` in CONTEXT
  becomes an item the deep verifier does not attempt as a machine check -
  it is presented in the walk as a human check, since the tool that would
  settle it is known to be absent here.
- Cold-start smoke test: if the phase touched server/service entry
  points, database/migration/seed files, or startup/container config,
  PREPEND an item: "Stop everything, clear ephemeral state, start from
  scratch - boots clean, migrations/seeds complete, one primary query
  returns real data." Fresh-start bugs pass against warm state and break
  in production.

Then create the checklist in one call:

```
node ".../planning.mjs" uat init --phase <N> --items -
   stdin: [{"name":"...","expected":"..."}, ...]
```

Continue to `deep_check`.
</step>

<step name="deep_check">
Run the goal-backward cad-verifier pass when `--deep` was passed or the
user asks for it, OR when this is the first UAT session for the phase and
`workflow.verifier` is true (`config.mjs get workflow.verifier`).

To run it: Read `${CLAUDE_PLUGIN_ROOT}/cadence-core/workflows/verify-deep.md`
and follow it. Otherwise skip to `walk`.
</step>

<step name="walk">
Walk from the `next` item each seam call returns - no UAT.md re-reads
between items. Present one item:

```
## {n}/{total}: {name}

Expected: {expected}
```

End the turn asking whether reality matches (ask-user seam, open-ended
prose - free-text pass/fail/describe answers do not fit a structured
choice). Infer the result from the reply; never show pass/fail buttons,
never ask severity:

| Reply looks like | Record |
|---|---|
| empty, "yes", "y", "ok", "pass", "next" | `pass` |
| "skip", "can't test", "n/a" | `skipped` + reason if given |
| "blocked", "server not running", "need device/build" | `blocked` + reason |
| anything else | `fail` + verbatim reply + inferred severity |

Severity inference (default major): crash/error/unusable -> blocker;
doesn't work/wrong/missing -> major; slow/weird/small -> minor;
color/spacing/visual -> cosmetic.

Record each reply through the seam - it updates the item, the counts, the
timestamp, and first_pass (set once, structurally) in one atomic write:

```
node ".../planning.mjs" uat record --phase <N> --item <k> --result <r> \
  [--reported "<verbatim reply>"] [--severity <s>] [--reason "<why>"]
```

The output's `next` field is the next pending item - present it, or
continue to `route_failures` when `next` is null or the user stops.
</step>

<step name="route_failures">
For each item with `status: fail` and no recorded cause:

1. **Diagnose inline** - read the relevant code, find the root cause, and
   record it: `uat record ... --result fail --cause "<root cause>"` (a
   re-record of the same result adds the field; first_pass is safe). If a
   diagnosis deserves a second opinion, use the review-trigger interface
   (references/review-triggers.md) - never an embedded reviewer loop.
2. **Propose the fix**, then ask the user (ask-user seam):
   1. Apply the fix now
   2. Re-plan it through /cad-plan (phase-sized gap)
   3. Leave it open
3. **Apply now** -> make the change as an atomic conventional commit per
   references/git.md (protected-branch guard, specific files, risk-surface
   trigger at commit time). Then set the item back to pending for retest:
   `uat record --item <k> --result pending --fix "{hash}, retest"` and offer
   to re-walk it immediately (first_pass keeps the original fail).
4. **Re-plan** -> `--fix "routed to /cad-plan"`, leave it failed, and tell
   the user to take the gap to `/cad-plan <N>`. Do not auto-run it.
5. **Leave open** -> record the decision, move on.

Never batch-fix silently; never loop fix-retest-fix without the user
between rounds.
</step>

<step name="complete">
Ask the seam for the session result:

```
node ".../planning.mjs" uat status --phase <N>
```

`result: complete` means every item passed or was skipped with a reason;
anything else is `partial`.

On **complete**, this skill is the single writer of persisted phase status.
Two seam calls, then one commit:

1. `node ".../planning.mjs" phase-done --n <N>` - checks the phase's
   ROADMAP box and flips its traceability rows to Complete (Deferred rows
   exempt), reporting exactly what changed.
2. `node ".../planning.mjs" cursor set --phase <N> --status "phase complete"
   --next "<next phase's /cad-context, or /cad-land if this was the last>"`

On a **partial** session, do neither - the phase is not done.

If `planning.commit_docs` is true (`config.mjs get planning.commit_docs`),
commit UAT.md plus whichever of STATE.md, ROADMAP.md, and REQUIREMENTS.md
changed: `docs: phase <N> UAT - {passed} passed, {failed} failed`.

Report tersely:

```
UAT {complete|partial}: phase <N>
Passed {n}/{total} ({v} auto-verified) | Failed {n} | Skipped {n} | Blocked {n}
Reworked {n} (items that failed first pass, then were fixed)
{open failed items, one line each, if any}
```

Omit the Reworked line when the count is zero.

One suggestion max: the resume command if partial, the next phase if
complete. Either way, safe to `/clear` first: UAT.md and the STATE cursor
hold the result and the next command starts fresh.
</step>

</process>

<guardrails>
- A pass comes from the user's own answer or cited cad-verifier evidence -
  never from assuming a criterion holds because the code "should" work.
- UAT.md is written ONLY through the uat seam - the seam guarantees what
  the prose used to beg for: user results unoverwritable, first_pass
  set-once, counts always consistent, every write atomic.
- No internal fixer or reviewer loops; second opinions only via the
  review-trigger interface, fixes only with user approval.
- Never ask severity - infer it, default major.
- Phase status (cursor, ROADMAP box, REQUIREMENTS rows) is written only on
  full pass, only via phase-done + cursor set.
</guardrails>

<success_criteria>
- [ ] UAT.md has one item per acceptance criterion; every result recorded
      through `uat record` the moment it was given
- [ ] User walked through only untested items, one at a time, plain-text
      answers, using the seam's `next` chaining (no re-reads)
- [ ] Every failure carries verbatim evidence + inferred severity
- [ ] Fixes were user-approved atomic commits or a /cad-plan route
- [ ] On full pass: phase-done + cursor set + one docs commit; on partial,
      no status writes at all
</success_criteria>
