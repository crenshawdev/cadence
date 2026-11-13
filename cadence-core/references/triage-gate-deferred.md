# The consequence gate: the `deferred` arm

The `deferred` gate's own text, split out of `references/triage-gate.md`. The
receipt rules its `deferral` receipt is written under, and the narrowed round
and terminal STOP-and-ask its queue's triage takes, stay in that file.

- **deferred** - the reviewer RAN and what it found stops the LAND instead of
  the RUN. Persist the findings exactly as the `risk_surface` persistence rule
  in `references/review-triggers.md` step 5 already specifies - the settled
  `{ "findings": [...] }` object written to
  `.planning/phases/<N>/records/REVIEW-<trigger>-<discriminator>.md`, on the same
  discriminator grammar (`plan-<k>` for a per-plan fire, `<command>-<short HEAD
  sha>` otherwise, and no unsuffixed path). This arm's file stays JSON whatever
  `review.mode` says, because `deferred record --payload` parses it; only gate
  `adjudicated` writes the Markdown review file. Then pass THAT SAME FILE as the
  queue member's payload:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" deferred record --phase <N> --trigger <trigger> --discriminator <discriminator> --base <base> --head <head> --payload .planning/phases/<N>/records/REVIEW-<trigger>-<discriminator>.md [--round <round>]
```

  then leave the receipt that says this fire happened:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" trace append --phase <N> --family outcome --event deferral --trigger <trigger> --plan <k> --base <base> --sha <head> [--round <round>]
```

  Then the run CONTINUES. No halt, no ask, no re-arm here, and nothing is fixed
  at the fire - the finding is answered at `/cad-land`, which refuses while any
  queue member is unadjudicated. The queue member is COMMITTED, unlike the
  REVIEW file beside it: stage it with the next commit this run makes.
  `.planning/records/trace.jsonl` is gitignored and a REVIEW file left untracked
  evaporates on a fresh clone, so a queue that lived in either is a queue that
  is gone by the time the land reads it. This arm writes NO adjudication record
  - `RULINGS` has three values and none of them is "not yet" - so a member
  reads as unruled until a real adjudication supersedes it.

**The DEFERRED queue is triaged later, and its cap rides the QUEUE.** A deferred
fire ruled nothing - it QUEUED, and the triage happens where `/cad-land`
refuses, in a session that can be days and a `/clear` away from the run that
deferred. Work the queue MEMBER BY MEMBER: rule each one through the
adjudication seam `references/review-triggers.md` step 5 states, at that
member's own trigger, discriminator and round. The record SUPERSEDES its member
- same round, sibling filename - so a member with no record beside it is still
queued and the refusal clears one ruling at a time, never all at once.

Where a `blocker`/`high` survives that ruling, the fix re-arms the trigger for
ONE narrowed round: the same cap, the same narrowed artifact and the same
terminal STOP-and-ask the blocking re-arm in `references/triage-gate.md` already states, and this arm
restates none of them. What differs is WHERE THE ROUND COUNT IS READ. Read it
off the QUEUE - the highest round on disk for THAT fire - and never by counting
`rearm` outcome events under this run's `corr`. The blocking arm's corr-keyed count is
right where the fix and the fire are the same run; here the triage runs under a
`corr` that matches no `rearm` the deferring run wrote, so it comes back 0 every
time, reads as "the round is unspent", and re-arms again on this land and the
next one - the unbounded loop the cap exists to forbid. The fire is what is
still true in a session that has forgotten everything else, so the fire is what
the count is keyed to.

On disk means the FILENAMES in the fire's home
(`.planning/phases/<N>/records/`, or `.planning/records/deferred/<N>/` once a close has carried
it there): the highest `-r<n>` suffix among that fire's
`DEFERRED-<trigger>-<discriminator>*.json`, an unsuffixed name being round one.
Count a member an adjudication has already SUPERSEDED - a settled round is a
round spent, and a cap that read only what is still queued would refund the
round at the exact moment the triage clears it. The re-armed round records
itself the same way it was queued: fire narrowed, then write its own member
through the `deferred record` call above with `--round 2`, which mints
`DEFERRED-<trigger>-<discriminator>-r2.json` beside round one on the
round-suffixed naming `ADJUDICATION-<trigger>-<discriminator>-r2.json` already
uses. The cap is then answered by reading what is on disk rather than by
remembering it, whoever asks and from whichever session. A `blocker`/`high`
still surviving round two is the terminal STOP-and-ask, never a round three.
