<purpose>
The user tests, Claude records. Plain-text answers. Severity is inferred,
never asked.

All checklist persistence goes through the planning seam's `uat` subcommands
- the model extracts and words items and infers results; the seam owns the
file and its invariants (first_pass set once, verifier never overwrites a
user result, counts recomputed every write).

`--sweep` folds the cross-phase audit in (cold branch: verify-sweep.md).
`--deep` adds a goal-backward codebase pass (cold branch: verify-deep.md).

Why each step is shaped the way it is - the measured failures, the ordering
arguments, the rejected alternatives - is in `docs/rationale/verify.md`. It is
not read at runtime. Read it before EDITING this file, so a step is not removed
for looking redundant.
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
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" uat refresh --phase <N>
   stdin: [{"name":"...","expected":"...","criterion":"AC3"}]
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
criteria miss - each becomes an item too. Read the applicable source docs in
ONE batch - CONTEXT.md + SUMMARY.md, or the PLAN.md + ROADMAP.md + SUMMARY.md
fallback - not both branches; they are known independent paths, and only a read
whose path a prior call computed would be serialized.

Item rules (the model's judgment, before the seam call):
- One item per observable behavior: name + expected (what the user should
  SEE, specific and falsifiable). Skip internal criteria (refactors, type
  changes) - execution already covered those.
- **Carry the criterion id.** An item built from a CONTEXT criterion sends
  `"criterion":"AC<N>"` - the id at the head of the bullet it came from. This
  is the ONLY place the link is created: the wording is yours, so nothing
  downstream can recover which criterion an item came from by comparing
  strings. `/cad-audit` FAILs on a criterion no item names
  (`references/acceptance-criteria.md`).
- An item built from any other source carries `"origin"` instead of
  `criterion`: the cold-start smoke item below sends `"origin":"smoke"`, and
  an item from the PLAN+ROADMAP fallback branch or a SUMMARY-derived
  deliverable sends neither field - `/cad-audit` reports it as untraced
  without moving the verdict.
- A CONTEXT whose criteria carry no `AC<N>` ids yields no `criterion` values
  at all. Those items report as `untraced`, which is additive.
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
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" uat init --phase <N>
   stdin: [{"name":"...","expected":"...","criterion":"AC1"}, ...]
```

Continue to `deep_check`.
</step>

<step name="deep_check">
Run the goal-backward cad-verifier pass when `--deep` was passed or the user
asks for it. `workflow.verifier: false` (`config.mjs get workflow.verifier`)
always skips it - it is the off switch. Otherwise run it when this is the FIRST
UAT session for the phase AND the resolve says to:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/route.mjs" resolve --role cad-verifier
```

Relay every `warnings[]` entry that resolve returns to the user before running
the pass, each distinct warning once per run
(`references/seam-spawn-agent.md`).

`verify` on that line is `on` or `off`. This step holds no role and the seam
refuses a resolve without one, so it resolves as `cad-verifier` - the role it is
deciding whether to dispatch. Both terms are load-bearing: keep the
first-session term, which is what holds the pass to once per phase.

`verify` is `on` exactly when the plan-time risk floor raised - the phase's
plans declare a file touching an answered risk surface, or a declared scope
could not be read - and `off` otherwise. No config key sets it directly.

When `verify` is `off`, say so in one line - "no risk surface in this phase's
plans, so the deep verify pass is off; run `/cad-verify --deep` to force it" -
rather than skipping silently.

To run it: Read `${CLAUDE_PLUGIN_ROOT}/cadence-core/workflows/verify-deep.md`
and follow it. Otherwise skip to `walk`.
</step>

<step name="walk">
TWO passes: the model executes and cites everything it can, then the user is
asked about only what is left.

**The bar.** An item is a HUMAN check only when the model cannot execute it -
it is irreversible against real data, or it is outside the model's reach
(credentials it does not hold, a GUI, hardware, another machine). Everything
else the model runs. ONE kind of item is ALREADY judged; its reason stands and
is not re-litigated:

- an item whose `expected` carries the CONTEXT-time
  `(human-verify: needs <tool/service>)` suffix, written precisely when that
  tool is known absent on THIS machine.

A `why_human` item is NOT that kind, and the field is not the predicate - the
deep pass writes it for every UNCERTAIN truth as well as every human-only check.
So READ the reason and apply the bar to it: it goes to pass 2 only when it names
irreversibility against real data or a resource outside the model's reach.
Anything else - "no probe ran", "not exercised by a named test" - goes to pass 1
and is executed.

The suffix-tagged item, and a `why_human` item whose reason clears that reading,
go straight to pass 2; pass 1 never runs their commands.

`blocked` is TERMINAL - nothing returns an item to the walk from it - so a bar
applied loosely enough to run an impossible command puts the phase permanently
out of reach of Complete. Pass 1 records `blocked` ONLY for an item that cleared the
bar and then failed on an environmental cause the bar did not predict, and the
results table says it needs the user's answer on the next run rather than being
left to rot.

**Pass 1 - execute and cite.** Read `.planning/phases/<N>/UAT.md` ONCE, at the
top of the walk, for the pending items and their `expected` text. It has no
substitute - `uat status` returns no item list and no `expected` string. ONE
read BEFORE the chain starts, so the "no UAT.md re-reads between items" rule is
unchanged and still governs pass 2.

Then, before offering ANY item, run the check for every pending item that
clears the bar and record each the moment it is settled. The evidence is
composed from what the check printed, so write
`{"evidence": "<the command and the output that settles it>"}` to a scratch
file and pass its PATH (caller-derived text - references/conventions.md); the
enum flags stay inline on the same call:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" uat record --phase <N> --item <k> --result <r> \
  --fields-file <path> --source model
```

One call per item, never a `uat merge` payload: merge would clobber the deep
pass's findings envelope.

Then print ONE results table, so the executed items are visible in the
transcript and not only on disk:

```
| # | Item | Result | Evidence |
|---|---|---|---|
| 3 | Lease check refuses | pass | `node --test x.test.mjs` -> `262 pass 0 fail` |
```

A pass-1 `fail` routes to `route_failures` unchanged - the walk fixes nothing
itself.

**Pass 2 - the ask.** Walk only the items that survive the bar, from the `next`
item each seam call returns - no UAT.md re-reads between items. This needs
nothing new: an item recorded in pass 1 is no longer `pending`, so `next` stops
offering it. Present one item:

```
## {n}/{total}: {name}

Expected: {expected}
```

End the turn by asking in plain words: name what to run and what they should
see, then ask what happened. Never an abstract "does this match", and never
phrase it as though the user has already run it (ask-user seam, open-ended
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
timestamp, and first_pass (set once, structurally) in one atomic write. The
reply and the reason are the user's own words, so both ride ONE scratch file -
`{"reported": "<verbatim reply>", "reason": "<why>"}`, either key left out when
there is nothing to record - and the call carries its PATH (caller-derived text
- references/conventions.md):

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" uat record --phase <N> --item <k> --result <r> \
  [--fields-file <path>] [--severity <s>]
```

The output's `next` field is the next pending item - present it, or
continue to `route_failures` when `next` is null or the user stops.
</step>

<step name="route_failures">
For each item with `status: fail` and no recorded cause:

1. **Diagnose inline** - read the relevant code, find the root cause, and
   record it: `uat record ... --result fail --fields-file <path>`, the file
   holding `{"cause": "<root cause>"}` (caller-derived text -
   references/conventions.md; a re-record of the same result adds the field;
   first_pass is safe). When the
   item was recorded by the deep pass, open
   `.planning/phases/<N>/verifier-findings.json` AT THIS POINT - the only
   place this workflow opens it - and read the gap's `missing` (or the human
   check's `why_human`) before diagnosing: that is the diagnosis the verifier
   already did, and it is why those fields ride the file. If a
   diagnosis deserves a second opinion, use the review-trigger interface
   (references/review-triggers.md) - never an embedded reviewer loop. Its
   artifact is the failed item's cited file PATHS - shape (c) - plus the
   recorded `reported` and `cause` text, never file contents. That
   fire names no wiring-table trigger, so it has no resolved gate and its fix
   list is ALWAYS triaged before any of it becomes a proposed fix: the
   survivors are a numbered list the user triages, NONE is the default, and
   only what the user names goes on to step 2, so an unpicked finding never
   reaches step 3's "Apply now". RE-READ
   `${CLAUDE_PLUGIN_ROOT}/cadence-core/references/triage-gate.md`
   before presenting, since this workflow does not preload it.
2. **Propose the fix**, then ask the user (ask-user seam):
   1. Apply the fix now
   2. Re-plan it through /cad-plan (phase-sized gap)
   3. Leave it open
3. **Apply now** -> make the change, then `git add` exactly the files it
   touched, and only THEN ask the seam whether it touched a risk surface
   BEFORE the commit lands. Staging is a STEP here, not a description:
   references/git-guard.md fires the trigger at commit time, `--staged` reads
   the index against HEAD and that is its one machine spelling (the index has
   no commit for a `--head` to name), so a fix still sitting in the worktree
   is outside the scope this call reads and no sentence saying it is staged
   puts it there.

   ```
   node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" risk-check run --phase <N> --base HEAD --staged
   ```

   `<N>` is the phase under verification. `empty: true` on this arm is NOT a
   pass: it says the read found no scannable change between HEAD and the
   index, which is exactly what an unstaged fix looks like - the seam returns
   `ok: true, checked: true, matches: []` over nothing at all. Stage the fix
   and re-run; never commit on that answer. A non-empty `matches` or an
   `inconclusive: true` fires the `risk_surface` trigger and the fire carries
   the staged-diff scope, shape (b): the reviewer runs
   `git diff --cached` in the cwd it inherits; that gate is blocking and its
   re-arm is capped at ONE narrowed round by the same triage-gate.md this step
   already re-reads. An `ok:false` answer (`no-diff`, `surfaces-unanswered`)
   is not a clean one: the gate is blocking and a check that could not run
   clears nothing, so repair what the refusal's `hint` names and re-run rather
   than landing the fix on it. Then commit as an atomic conventional commit
   per references/git-guard.md (protected-branch guard, specific files) and
   set the item back to pending for retest:
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
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" uat status --phase <N>
```

`result: complete` means every item passed or was skipped with a reason;
anything else is `partial`. Record that verdict either way - it is the phase's
own outcome event, and a partial session is exactly the one worth having in the
record:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" trace append --phase <N> --family outcome --event uat_verdict --detail "<complete or partial>"
```

On **complete**, this skill is the only writer of a persisted phase status
TRANSITION - row creation at `Pending` belongs to `/cad-plan`'s seeding step;
this skill is the only writer of any Status beyond it. Two seam calls, then
one commit:

1. `node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" phase-done --n <N>` - checks the phase's
   ROADMAP box and flips its traceability rows to Complete (Deferred rows
   exempt), reporting exactly what changed. Its `capture` field is the CLOSE
   ASSERTION over `.planning/CAPTURE.md`, which holds the phase in flight and
   nothing else: print each `items[]` entry - section, line and text - and say
   what it is. **These are items this phase did not resolve.** Resolving one
   means REMOVING it - filed on the tracker, or dropped - never annotating it
   in place and never moving it to another heading in the same file, which
   leaves the bytes exactly where they were. The close already happened either
   way; this is a list for the user, not a gate. `capture.unread` means the
   file is present and could not be opened - run `capture-check` for the
   reason.
2. `node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" cursor set --phase <N> --status "phase complete"
   --next "<next phase's /cad-context, or /cad-milestone if this was the last
   - the audit gate precedes any ship>"`

On a **partial** session, do neither - the phase is not done.

If `planning.commit_docs` is true (`config.mjs get planning.commit_docs`),
commit UAT.md, `phases/<N>/FINDINGS.json` and
`phases/<N>/verifier-findings.json` if a deep pass wrote them, plus
whichever of STATE.md, ROADMAP.md, and REQUIREMENTS.md changed:
`docs: phase <N> UAT - {passed} passed, {failed} failed`.

Report tersely:

```
UAT {complete|partial}: phase <N>
Passed {n}/{total} ({v} auto-verified, {m} model-executed) | Failed {n} | Skipped {n} | Blocked {n}
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
- A pass comes from the user's own answer, cited cad-verifier evidence, or a
  walk-executed check whose command and output are cited on the item
  (`source: model`) - never from assuming a criterion holds because the code
  "should" work.
- UAT.md is written ONLY through the uat seam - the seam guarantees what
  the prose used to beg for: user results unoverwritable, first_pass
  set-once, counts always consistent, every write atomic.
- No internal fixer or reviewer loops; second opinions only via the
  review-trigger interface, fixes only with user approval.
- Never ask severity - infer it, default major.
- Phase status TRANSITIONS (cursor, ROADMAP box, REQUIREMENTS row Status
  beyond Pending) are written only on full pass, only via phase-done + cursor
  set - row creation at Pending is `/cad-plan`'s seeding step, not this one.
</guardrails>

<success_criteria>
- [ ] UAT.md has one item per acceptance criterion, each carrying its
      `criterion` id; every result recorded through `uat record` the moment it
      was given
- [ ] User walked through only untested items, one at a time, plain-text
      answers, using the seam's `next` chaining (no re-reads)
- [ ] Every failure carries verbatim evidence + inferred severity
- [ ] Fixes were user-approved atomic commits or a /cad-plan route
- [ ] On full pass: phase-done + cursor set + one docs commit; on partial,
      no status writes at all
</success_criteria>
