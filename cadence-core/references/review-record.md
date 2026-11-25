# The adjudication outcome record

`references/review-triggers.md` step 5 decides WHEN each of these two writes
happens - the trace receipt on the ADJUDICATED arm alone, the ADJUDICATION
RECORD on the BLOCKING arm as well, and neither on ADVISORY - and it states the
discriminator grammar both of them name. This file is the MECHANICS: the two
command lines, what every flag on them means, and the payload and ruling
grammar the seam refuses on.

## The trace receipt

Write the detail - `<trigger>: <n> survivors; voices <the reviewers that
actually ran>` - to a scratch file and pass its path; the voice list is composed
from what actually ran (caller-derived text - references/conventions.md):

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" trace append --phase <N> --family outcome --event adjudication --trigger <trigger> --plan <k> --base <base> --sha <head> --raised <findings the reviewers raised before adjudication> --survivors <n> --downgraded <n> --refuted <n> [--round <round>] --detail-file <path>
```

`--plan <k>` is required whenever the fire was per-plan: `risk-check status`
joins a receipt to a record on the run AND the plan, so a receipt without it
joins nothing and leaves a fired, adjudicated range reading as never fired. Omit
it only for a fire that is not per-plan (`/cad-debug`, `/cad-task`,
`/cad-verify`).

`--base <base> --sha <head>` name the RANGE this adjudication settled, by the
range rule in `references/triage-gate.md`.

The RAISED count travels on `--raised` and never inside `--detail`. The three
SETTLED counts travel the same way, on `--survivors`, `--downgraded` and
`--refuted`, and they are the figures the record seam DERIVED and returned on
its envelope - never a number you counted by hand off the survivor list, and
never folded into `--detail`. The seam recounts the record's rulings against
them and REFUSES a receipt that disagrees. `--round <round>` is omitted on an
ordinary fire and on a range-named re-arm, whose own ends name its record, and
carries the round on any other re-armed one: without it a round-two settle is
checked against round one's rulings. The TRIGGER travels on `--trigger`, and
`--plan <k>` rides a per-plan fire: `risk-check status` joins a matched range to
its receipt on those two fields and never on the detail
(`references/triage-gate.md` states the rule at all five settle points).

`<N>` is the phase in hand, or the STATE cursor's phase for a trigger whose
range spans phases. The VOICE LIST is load-bearing: a `claude-subagent` voice
never passes through `review-provider.mjs`, so it has no provider event of its
own, and the survivor count alone cannot show a panel silently reduced to one
voice. Name the set that RAN, never the set the trigger asked for.

## The review file

At gate `adjudicated`, at `/cad-verify`'s fire and on a `blocking`
`risk_surface` fire on the workflow path, write the REVIEW file with this seam
before triage. Compose its payload as a file in this run's scratch directory:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" review-file --phase <N> --trigger <trigger> --discriminator <discriminator> --base <base> --head <head> --payload <path> [--round <round>] [--task <slug>]
```

The payload is `{raised, survivors: [...]}`, with `raised` the count of
findings the voices raised and the survivors in triage's order. Each survivor
carries `file`, `line`, `severity`, `voices` and the six texts `what_breaks`,
`why_care`, `what_triggers`, `what_proves`, `what_uncertain` and
`recommendation`, plus an optional one-line `root_cause` shared by survivors with
one cause. A survivor missing any of the six is refused, and so is a second write
to the same name: a re-arm passes `--round 2` or, range-named, its own range.

A suspected `blocker` or `high` the named check then re-rules is corrected in the file, so it and the record agree. Pass the fire's identity as above and `--mark <n>`, with a payload of `{ruling: refuted|proved, found}`. It puts a line ahead of survivor `n`'s headings, a refuted one stops counting as a survivor, and a number the file lacks or one already marked is refused.

## The adjudication record

When a fire holding a `blocker` or `high` survivor writes this record is `references/review-triggers.md` step 5's order.

Then WRITE THE ADJUDICATION RECORD: the rulings themselves, not a count of them.

YOU compose the payload, because you are the only actor holding both the raised
finding bodies and the ruling: `review-provider.mjs` never persists findings.
Compose it as a FILE in THIS RUN's own scratch directory, the way
`references/review-cross-model.md` composes the provider payload, and NEVER
hand-assemble that JSON with `echo` or a heredoc: it is verbatim reviewer text
with arbitrary quoting, and one unescaped quote makes it unparseable after the
adjudication is done.

The payload carries, PER VOICE, the reviewer's returned findings object
VERBATIM, that voice's model, and one ruling per returned finding -
`{voices: [{voice, model, returned, rulings: [...]}]}`, one entry per finding
RAISED per raising voice. A `ruling` is `survived`, `downgraded` or `refuted`
and there is no fourth value. Each ruling RESTATES the claim and the failure
scenario it rules on, and the seam REFUSES the payload when a restatement
differs from the returned text by one byte. A `refuted` ruling names the
contradicting code in its counter-evidence.

A `survived` ruling is severity-gated, and this is the sentence to follow when
the gate will not fix a finding. A `survived` finding RAISED at `blocker` or
`high` names its fix commit in `fix_commit` - an auditor runs `git show` on that
value, so it has to be a real one. A `survived` finding raised BELOW them is one
that was confirmed and NOT fixed - reported, moved past - and carries no commit
id: leave `fix_commit` off the ruling entirely. Do not downgrade a finding to
make it storable and do not invent a SHA to fill the field.

A fix that leaves no commit, because it edits a file git does not track, carries `fix_file` instead: that file's repo-relative path. It is neither a downgrade nor an override. So a survived `blocker` or `high` settles one of three ways: `fix_commit`, `fix_file` or `overridden: true`. The seam refuses `fix_file` beside `fix_commit`, an absolute path or one with a `..` segment, and a file git tracks, since that fix has a commit to name.

A `blocker` or `high` the USER OVERRODE carries `overridden: true` instead of a
commit. The marker is the fact ALONE: the user's reason rides the `override`
receipt's `--detail-file` (see `references/triage-gate.md`). Only the boolean
`true` is accepted, and `false` is refused.

`fix_commit` IS CHECKED WHEREVER THE KEY IS SET, on ANY ruling. A `downgraded`
or a `refuted` ruling MAY carry one, held to the same bar: a blank, a `null` or
a junk string is REFUSED rather than dropped, and the refusal names both the
field and the ruling it was set on.

A suspected finding (`references/review-triggers.md` step 5) is a `survived` ruling with no new value or key: it shows as suspected in the review file's heading text alone. At `blocker` or `high` it is never downgraded, and the record refuses it with none of a fix commit, a fix file or `overridden: true`.

None of these is a fourth `ruling` value: what varies is what a `survived`
entry carries beside the ruling.

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" adjudication --phase <N> --trigger <trigger> --discriminator <discriminator> --base <base> --head <head> --payload <path> [--task <slug>]
```

`--task <slug>` on a `/cad-task` fire ONLY, and required there: that workflow
fires with `--phase 0` and keeps its artifacts under `.planning/tasks/<slug>/`
(`.planning/agile/tasks/<slug>/` on an agile project),
so the record goes beside the sibling REVIEW file there. Without it `--phase 0`
is refused. A phase fire passes nothing. `deferred record` does NOT take it:
the queue enumeration reads the two phase homes only, so a member under a slug
would never be found.

It lands at `.planning/phases/<N>/records/ADJUDICATION-<trigger>-<discriminator>.json`,
beside the sibling `REVIEW-<trigger>-<discriminator>.md`, on the discriminator
grammar `references/review-triggers.md` step 5 states. It does NOT go inside
`<plandir>/records/reports/`: the lease check exempts exactly one path there,
so anything else staged from there answers `undeclared-files`.
