# The consequence gate: the `deferred` arm

The `deferred` gate's own text. The receipt rules its `deferral` receipt is
written under, and the narrowed round and terminal STOP-and-ask its queue's
triage takes, are in `references/triage-gate.md`.

- **deferred** - the reviewer RAN and what it found stops the LAND instead of
  the RUN. Persist the findings by the `risk_surface` persistence rule in
  `references/review-triggers.md` step 5 - the settled `{ "findings": [...] }`
  object written to
  `.planning/phases/<N>/records/REVIEW-<trigger>-<discriminator>.md`, on the same
  discriminator grammar (the names step 5 keeps for a fire at this gate, and no
  unsuffixed path). This file stays JSON whatever `review.mode` says, because
  `deferred record --payload` parses it; only gate `adjudicated` writes the
  Markdown review file. Then pass THAT SAME FILE as the queue member's payload:

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
  REVIEW file beside it: stage it with the next commit this run makes, since the
  trace and an untracked REVIEW file are gone on a fresh clone. This arm writes
  NO adjudication record, so a member reads as unruled until a real
  adjudication supersedes it.

**The DEFERRED queue is triaged later, and its cap rides the QUEUE.** A deferred
fire ruled nothing - it QUEUED, and the triage happens where `/cad-land`
refuses, often days and a `/clear` away from the run that deferred. Work the
queue MEMBER BY MEMBER: rule each one through the adjudication seam
`references/review-triggers.md` step 5 states, at that member's own trigger,
discriminator and round. The record SUPERSEDES its member - same round, sibling
filename - so a member with no record beside it is still queued and the refusal
clears one ruling at a time.

Where a `blocker`/`high` survives that ruling, the fix re-arms the trigger for
ONE narrowed round: the same cap, narrowed artifact and terminal STOP-and-ask
the blocking re-arm in `references/triage-gate.md` already states. What differs
is WHERE THE ROUND COUNT IS READ: off the QUEUE - the highest round on disk for
THAT fire - and never by counting `rearm` outcome events under this run's
`corr`. The triage runs under a `corr` that matches no `rearm` the deferring run
wrote, so that count reads 0 every time and re-arms without end.

On disk means the FILENAMES in the fire's home
(`.planning/phases/<N>/records/`, or `.planning/records/deferred/<N>/` once a
close has carried it there): the highest `-r<n>` suffix among that fire's
`DEFERRED-<trigger>-<discriminator>*.json`, an unsuffixed name being round one.
Count a member an adjudication has already SUPERSEDED - a settled round is a
round spent. The re-armed round records itself the way it was queued: fire
narrowed, then write its own member through the `deferred record` call above
with `--round 2`, which mints `DEFERRED-<trigger>-<discriminator>-r2.json`
beside round one, on the naming `ADJUDICATION-<trigger>-<discriminator>-r2.json`
already uses. A `blocker`/`high` still surviving round two is the terminal
STOP-and-ask, never a round three.
