# cad-debug workflow

Scientific-method debugging, single pass, with the investigation persisted so a
`/clear` never loses it. No session-manager layer and no specialist dispatch
(cut from GSD) - the main model runs the method inline and writes state after
every step.

## State file: `.planning/debug/<slug>.md`

The source of truth; a resume reads only this. `<slug>` is a short kebab of the
symptom. Schema:

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

- `list` -> print open sessions: `.planning/debug/*.md` whose `Status:` is not
  resolved, one line each (slug + symptom).
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

Repeat until a root cause is confirmed or a dead-end is reached:

1. **Hypothesize.** List 2-5 candidate causes ranked most-likely-first, but test
   risk-first when a cheap test can eliminate a whole class. Write them to
   Hypotheses. Never jump to a fix before a cause is confirmed by evidence.
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
   seam). A fix that touches a risk surface fires the `risk_surface` review
   trigger (references/review-triggers.md) before it is trusted.
4. Verify: re-run the reproduction. Symptom gone -> set Status: resolved, fill
   Resolution, done. Symptom remains -> increment Attempts, record what the
   attempt changed and did not, and return to the method loop (the failed fix
   is itself an observation).

## Consult at dead-ends (references/consult.md)

Offer a consult - user-gated, one per dead-end - when an OBSERVABLE state is hit,
never on a feeling of being stuck:

- **Attempts >= 3** on the same bug (three applied fixes, still failing).
- **Test still red after 3** method-loop iterations.
- **Exhausted hypotheses** - the set is empty and the bug is unresolved.

Run `offer_consult` with the situation = the symptom, the confirmed/refuted
hypotheses, and what the fixes changed. Ground each returned angle against the
real code, present the survivors, and let the user pick the next move. The
consult never decides; it reopens the hypothesis space. Bounded: do not
re-offer for the same dead-end unless a new observation has appeared since.

## Discipline

- One variable per test; no shotgun fixes.
- Persist the state file after every test and every fix attempt.
- Single pass: no automatic retry loops. Each fix attempt and each consult is a
  deliberate, recorded step.
