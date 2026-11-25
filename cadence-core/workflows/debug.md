# cad-debug workflow

Scientific-method debugging, single pass, with the investigation persisted so a
`/clear` never loses it: the main model runs the method inline and writes state
after every step.

## State file: `.planning/debug/<slug>.md`

The source of truth; a resume reads only this. `<slug>` is a short kebab of the
symptom. On an agile project (`.planning/agile/` exists and
`.planning/PROJECT.md` doesn't) every `.planning/debug/` in this file is
`.planning/agile/debug/`. Schema:

```markdown
# debug: <one-line symptom>
Status: open | resolved
Slug: <slug>
Attempts: <count of applied fixes that did not resolve it>

## Symptom
<what is observed, the exact failing signal, how to reproduce>

## Hypotheses
- [ ] <hypothesis> - untested | testing | refuted | confirmed - <why ranked here>

## Observations
- <test run> -> <result> -> <what it rules in/out>

## Resolution
<root cause + the fix, once found; empty until then>
```

## Route (parse $ARGUMENTS)

- `list` -> pull the symptom + status from every session in one pass
  (`grep -H '^# debug:\|^Status:' .planning/debug/*.md`), filter to those whose
  `Status:` is not resolved in the coordinator, and print one line each (slug +
  symptom). Independent read-only calls go out in one message; only a call that
  consumes a prior call's output is serialized.
- `status <slug>` -> print that state file verbatim. Stop.
- `continue <slug>` -> load that state file and resume at the method loop below,
  trusting the recorded hypothesis/observation state.
- `--diagnose` present -> diagnose-only run (stop at the Root Cause Report, no
  fix). Strip the flag; the remainder is the symptom.
- otherwise -> the remainder is a new symptom.

## New session

1. Capture the symptom precisely: the exact failing signal (error text, wrong
   output, stack), how to reproduce, and what "fixed" looks like. If any is
   missing, ask (ask-user seam) before investigating.
2. Derive a `<slug>` and write the initial state file (Symptom filled,
   Status: open, Attempts: 0).

## The method loop

On every route into this loop - a new symptom AND a `continue <slug>` resume -
first read the config seam once:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/config.mjs" get memory.backend review.consult.enabled review.consult.attempt_threshold testing.scope
```

`testing.scope` set means a testing policy is active: read
`${CLAUDE_PLUGIN_ROOT}/cadence-core/references/test-policy.md` once, for Resolve
step 4.

Repeat until a root cause is confirmed or a dead-end is reached:

1. **Hypothesize.** Read
   `${CLAUDE_PLUGIN_ROOT}/cadence-core/references/bug-patterns.md` FIRST, before
   any candidate is written - it is frequency-ordered, and a pattern whose
   signature matches the symptom enters the list with its cheapest
   discriminating check already named. Then list 2-5 candidate causes ranked
   most-likely-first, but test
   risk-first when a cheap test can eliminate a whole class. Write them to
   Hypotheses. Never jump to a fix before a cause is confirmed by evidence.
   When the effective `memory.backend` (read at loop entry) is `builtin`, run
   recall inline via Bash:

   ```
   node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" recall "<key terms from the symptom / bug description>"
   ```

   Skip this entirely when the backend is `none` - do not issue the call. Read
   `${CLAUDE_PLUGIN_ROOT}/cadence-core/references/recall.md` (one
   consult site - this step) for the result shape and how matching past
   deviations and UAT findings fold into the Hypotheses list.
2. **Predict + test.** For the top untested hypothesis, state what you would
   observe if it were true, then run the CHEAPEST discriminating check (Read,
   Grep, a targeted Bash run, a log line). One variable at a time.
3. **Record.** Append the observation and mark the hypothesis confirmed or
   refuted. Rewrite the state file now - this is the /clear-survival point.
4. **Branch:**
   - Confirmed root cause -> go to Resolve.
   - All current hypotheses refuted -> form the next set from what the
     observations now rule in. If nothing new is left to try, that is the
     "exhausted hypotheses" dead-end (see Consult).

## Resolve

1. State the root cause plainly, tied to the confirming observation.
2. If diagnose-only: write the Root Cause Report into Resolution and stop
   (no fix applied).
3. Else propose the minimal fix and apply it ONLY with user approval (ask-user
   seam). Rewrite the state file every time a fix is applied, then `git add`
   exactly the files the fix touched, and only THEN ask the seam. Whether the
   fix touched a risk surface is the SEAM's answer over the index, never a
   reading of the diff, and `--staged` is that scope's one machine spelling:

   ```
   node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" risk-check run --phase 0 --base HEAD --staged
   ```

   `--phase 0` because 0 is the one number no roadmap phase carries, and a debug
   session sits outside the phase spine. `empty: true` on this arm is NOT a
   pass: stage the fix and re-run rather than trusting it. A non-empty `matches`
   or an `inconclusive: true` fires the `risk_surface` review trigger
   (references/review-triggers.md) before the fix is trusted, and the artifact
   is the staged-diff scope - shape (b): the reviewer runs `git diff --cached`
   in the cwd it inherits, never the diff text. On an agile project its review
   file and record go in `.planning/agile/tasks/<slug>/`, made for them, and
   `<slug>` is the `--task` they pass. That gate is `blocking`; RE-READ
   `${CLAUDE_PLUGIN_ROOT}/cadence-core/references/triage-gate.md` before
   fixing a FAIL, since this workflow does not preload it. On the workflow
   path (`references/review-workflow.md`) the fire is the launch ending the
   turn and the notice resuming this step, with nothing else dispatched in
   between; the resumed step runs the gate on the staged fix and the one
   narrowed re-arm if a FAIL was fixed, and only then does step 4 trust the
   fix. An `ok:false` answer is not a clean one. `no-diff`: stage the fix and
   re-run. `surfaces-unanswered`: run `detect-surfaces --root .`, put the
   one-time surface question to the user in this run as
   `references/risk-surface.md` states it, save the answer, and re-run the same
   `risk-check run --phase 0 --base HEAD --staged` line.
4. Verify: re-run the reproduction. Symptom gone -> set Status: resolved, fill
   Resolution, done. Symptom remains -> increment Attempts, record what the
   attempt changed and did not, and return to the method loop (the failed fix
   is itself an observation). A fix is never retried automatically: each attempt
   goes through step 3's approval. With a policy active, also apply the policy's
   bug-fix rule: ask whether an existing reproducer gives adequate regression
   coverage, confirm it fails for the defect and passes after the fix, and add a
   test only where the completion rule says to.

## Consult at dead-ends (references/consult.md)

With `review.consult.enabled` false, make no offer and leave consult.md unread.
Otherwise offer a consult only when one of these OBSERVABLE states is hit, T
being `review.consult.attempt_threshold` (default 3):

- **Attempts >= T** on the same bug (T applied fixes, still failing).
- **Test still red after T** method-loop iterations.
- **Exhausted hypotheses** - the set is empty and the bug is unresolved.

Read `${CLAUDE_PLUGIN_ROOT}/cadence-core/references/consult.md` for the bound and
run its `offer_consult` with the situation = the symptom, the confirmed/refuted
hypotheses, and what the fixes changed. An offer waits for an explicit yes, and
one that is declined, or whose call fails, is not repeated for the same dead-end
unless a new observation has appeared since. Check each returned angle against
the real code, present the survivors, and let the user pick the next move: the
consult never decides. Write every consult taken to the state file.
