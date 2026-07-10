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

Replaces GSD's verify-work + audit-uat pair: `--sweep` folds the
cross-phase audit into this skill. `--deep` adds a goal-backward codebase
pass via the cad-verifier agent.
</purpose>

<process>

<step name="parse">
Parse `$ARGUMENTS`: optional phase number, `--sweep`, `--deep`.

- `--sweep` -> go to `sweep`.
- Phase number given -> that phase.
- Neither -> read the current phase from the `.planning/STATE.md` cursor.
  No cursor and no argument: ask which phase to verify (ask-user seam).

The phase directory is `.planning/phases/<N>/`; the checklist lives at
`.planning/phases/<N>/UAT.md` (format: templates/UAT.md).
</step>

<step name="sweep">
(`--sweep` only.)

Scan all phases for outstanding verification work:

1. Glob `.planning/phases/*/UAT.md`; parse each frontmatter status and
   Summary counts.
2. Glob `.planning/phases/*/SUMMARY.md`; a phase with a SUMMARY but no
   UAT.md was built and never verified - list it as untested.
3. Report one cross-phase table:

   | Phase | Status | Pass | Fail | Pending | Skipped/Blocked |

   followed by the open failed items themselves (phase, item, severity).

4. Pick the most consequential phase to resume: open failures of the
   highest severity first, then most pending items, then lowest phase
   number. Offer via the ask-user seam:
   1. Resume UAT for phase <N> (recommended)
   2. Pick a different phase
   3. Stop here
   On resume, continue to `build_or_resume` with the chosen phase.

If nothing is outstanding anywhere, say so and stop.
</step>

<step name="build_or_resume">
**If UAT.md exists:** read it, announce progress ("{tested}/{total}
tested, {failed} failed so far"), and refresh it: any acceptance
criterion (sources below) with no matching item is appended as a new
`pending` item. Never delete or rewrite a recorded result; if an item's
source criterion no longer exists, keep the item and note "criterion
removed" so the user can skip it deliberately. Continue to `deep_check`.

**If it does not exist:** build it from the phase's acceptance criteria,
in this source order:

1. `.planning/phases/<N>/CONTEXT.md` acceptance criteria, if present.
2. Else: each verification in `.planning/phases/<N>/PLAN.md` (the
   per-task "running X shows Y" lines) plus the phase's success criteria
   from `.planning/ROADMAP.md`.

Also read `SUMMARY.md` if present for user-observable deliverables the
criteria miss - each becomes an item too.

Item rules:
- One item per observable behavior: name + expected (what the user should
  SEE, specific and falsifiable). Skip internal criteria (refactors, type
  changes) - execution already covered those.
- Deduplicate: a PLAN verification restating a ROADMAP criterion is one
  item, worded as the ROADMAP criterion (the contract).
- Cold-start smoke test: if the phase touched server/service entry
  points, database/migration/seed files, or startup/container config,
  PREPEND an item: "Stop everything, clear ephemeral state, start from
  scratch - boots clean, migrations/seeds complete, one primary query
  returns real data." Fresh-start bugs pass against warm state and break
  in production.

Write the file per templates/UAT.md, all items `pending`, status
`testing`. Continue to `deep_check`.
</step>

<step name="deep_check">
A goal-backward pass by the cad-verifier agent: does the codebase deliver
what the phase promised, independent of what SUMMARY claims. Run it when:

- `--deep` was passed or the user asks for it, OR
- this is the first UAT session for the phase and `workflow.verifier` is
  true in config (with `workflow.human_verify_mode: "end-of-phase"`,
  this skill is the phase's verification gate, so the deep pass belongs
  here rather than mid-execution).

Otherwise skip to `walk`.

Dispatch cad-verifier via the spawn-agent seam with the phase number,
goal, the current UAT items, and the PLAN/SUMMARY/ROADMAP paths. It
returns structured findings (per-truth status + evidence, gaps, human
checks) and writes nothing. Merge into UAT.md:

- VERIFIED truth matching an item -> `status: pass`, `source: verifier`,
  evidence recorded. Not presented in the walk - the machine check saves
  the human the click.
- Gap (FAILED truth) -> the matching item becomes `status: fail`,
  `source: verifier`, with reason and artifacts as evidence; unmatched
  gaps append as new failed items. These route through `route_failures`
  exactly like user-reported failures.
- Human check -> append as `pending` if not already covered by an item.
- NEVER overwrite a result the user recorded; verifier findings only fill
  items still `pending`.

Report a one-line merge summary (n auto-passed, n gaps, n items added).
</step>

<step name="walk">
One item at a time, from the first `pending` item (verifier-sourced
results are skipped):

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
| empty, "yes", "y", "ok", "pass", "next" | `status: pass` |
| "skip", "can't test", "n/a" | `status: skipped` + reason if given |
| "blocked", "server not running", "need device/build" | `status: blocked` + reason |
| anything else | `status: fail` + verbatim reply + inferred severity |

Severity inference (default major): crash/error/unusable -> blocker;
doesn't work/wrong/missing -> major; slow/weird/small -> minor;
color/spacing/visual -> cosmetic.

After EVERY reply: update the item, the Summary counts, and the
frontmatter `updated` timestamp, then write the file - persistence never
waits for the end of the session. Present the next pending item, or
continue to `route_failures` when none remain or the user stops.
</step>

<step name="route_failures">
For each item with `status: fail` and no recorded `cause`:

1. **Diagnose inline** - read the relevant code, find the root cause,
   record it on the item (`cause:`). If a diagnosis deserves a second
   opinion, get it through the review-trigger interface
   (references/review-triggers.md) - never an embedded reviewer loop.
2. **Propose the fix**, then ask the user (ask-user seam):
   1. Apply the fix now
   2. Re-plan it through /cad-plan (phase-sized gap)
   3. Leave it open
3. **Apply now** -> make the change as an atomic conventional commit per
   references/git.md (protected-branch guard, specific files,
   risk-surface trigger at commit time). Set the item back to `pending`
   with `fix: {hash}, retest` and offer to re-walk it immediately.
4. **Re-plan** -> record `fix: routed to /cad-plan`, leave the item
   failed, and tell the user to take the gap to `/cad-plan <N>`. Do not
   auto-run it.
5. **Leave open** -> record the decision, move on.

Never batch-fix silently; never loop fix-retest-fix without the user
between rounds.
</step>

<step name="complete">
Compute the session result:

- **complete** - every item is `pass`, or `skipped` with a reason, and
  none failed.
- **partial** - anything `pending`, `fail`, `blocked`, or skipped
  without a reason.

Update the UAT.md frontmatter status. On **complete**, overwrite the
`.planning/STATE.md` cursor in the canonical schema (references/conventions.md):
`Phase: <N> of <total> (<name>)`, status "phase complete", next action (next
phase's /cad-context, or /cad-land if this was the last), `Updated:` today.
STATE.md stays a 4-line cursor - no session log, no history append.

If `planning.commit_docs` is true, commit UAT.md (plus STATE.md when it
changed): `docs: phase <N> UAT - {passed} passed, {failed} failed`.

Report tersely:

```
UAT {complete|partial}: phase <N>
Passed {n}/{total} ({v} auto-verified) | Failed {n} | Skipped {n} | Blocked {n}
{open failed items, one line each, if any}
```

One suggestion max: the resume command if partial, the next phase if
complete.
</step>

</process>

<guardrails>
- A pass comes from the user's own answer or cited cad-verifier evidence -
  never from assuming a criterion holds because the code "should" work.
- Never overwrite a user-recorded result; refreshes and verifier merges
  only touch `pending` items.
- Write UAT.md after every single response - the file IS the session state.
- No internal fixer or reviewer loops; second opinions only via the
  review-trigger interface, fixes only with user approval.
- Never ask severity - infer it, default major.
- STATE.md is overwritten as a cursor, and only when the phase's UAT
  fully passes.
- Never push (references/git.md rail 3).
</guardrails>

<success_criteria>
- [ ] UAT.md has one item per acceptance criterion and persists every result the moment it is given
- [ ] User walked through only untested items, one at a time, plain-text answers
- [ ] Every failure carries verbatim evidence + inferred severity in UAT.md
- [ ] Fixes were user-approved atomic commits or a /cad-plan route - no auto-fix loop
- [ ] STATE.md cursor updated only on full pass
</success_criteria>
