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
joins a receipt to a record on the run AND the plan, so a receipt written
without it keys to no plan and joins nothing, leaving a range that WAS fired and
adjudicated reading as never fired. Omit it only for a fire that is not per-plan
(`/cad-debug`, `/cad-task`, `/cad-verify`).

`--base <base> --sha <head>` name the RANGE this adjudication settled - BOTH
ends, since two ranges can share a head and differ at the base and are then
different diffs over different surfaces. That is what lets `risk-check status`
tell an adjudication of THIS range from one of an earlier, narrower range for
the same plan. A receipt missing either end settles nothing, so omitting one
leaves a matched range reading as never fired.

The RAISED count travels on the `--raised` FLAG and never inside `--detail`: a
figure parsed back out of that free-text slot would be exactly as trustworthy
as the voice-list substitution the slot is already condemned for, so do not
helpfully fold it back in. The three SETTLED counts travel the same way, on
`--survivors`, `--downgraded` and `--refuted`, and they are the figures the
record seam DERIVED and returned on its envelope - never a number you counted
by hand off the survivor list, and never folded into `--detail` either. The
seam recounts the record's rulings against them and REFUSES a receipt that
disagrees, which is what makes the survivor count recomputable instead of
asserted. `--round <round>` is omitted on an ordinary fire and carries the
round on a re-armed one, because that is the record the recount has to read:
without it a round-two settle is checked against round one's stale rulings and
passes whenever the two counts happen to coincide. The TRIGGER travels the same way, on `--trigger`,
and `--plan <k>` rides a per-plan fire: `risk-check status` joins a matched
range to its receipt on those two structured fields and never on the detail
(`references/triage-gate.md` states the rule at all four settle points).

`<N>` is the phase in hand, or the STATE cursor's phase for a trigger whose
range spans phases. The VOICE LIST is load-bearing, not decoration: a
`claude-subagent` voice never passes through `review-provider.mjs`, so it has no
provider event of its own, and the survivor count alone cannot show a panel
silently reduced to one voice while the gate reports clean - the dropped
cross-model reviewer is only half of it. Name the set that RAN, never the set
the trigger asked for.

## The adjudication record

Then WRITE THE ADJUDICATION RECORD: the rulings themselves, not a count of them.
An adjudicated-only rule would record nothing at all on most projects -
`route.mjs resolve` returns `plan: blocking` and `risk_surface: blocking` at
`shipped` stakes - and would exclude the sharpest case there is, a gate that
passed with everything killed.

YOU compose the payload, because you are the only actor holding both the raised
finding bodies and the ruling: `review-provider.mjs` returns `findings` on
stdout and never persists them, its own record carries provider, model, effort,
tier, duration and outcome with no finding field, and
`skills/cad-reviewer-contract/SKILL.md` specifies a return shape only. Compose
it as a FILE in THIS RUN's own scratch directory, the way
`references/review-cross-model.md` composes the provider payload, and NEVER
hand-assemble that JSON with `echo` or a heredoc:
the record's whole content is verbatim reviewer text with arbitrary quoting, so
one unescaped quote makes the payload unparseable after the adjudication is
already done and cannot be redone.

The payload carries, PER VOICE, the reviewer's returned findings object
VERBATIM, that voice's model, and one ruling per returned finding -
`{voices: [{voice, model, returned, rulings: [...]}]}`, one entry per finding
RAISED per raising voice. A `ruling` is `survived`, `downgraded` or `refuted`
and there is no fourth value. Each ruling RESTATES the claim and the failure
scenario it rules on, and the seam REFUSES the payload when a restatement
differs from the returned text by one byte: the entry is stored from the
reviewer's own words, so a paraphrase is refused rather than recorded. A
`refuted` ruling names the contradicting code in its counter-evidence.

A `survived` ruling is severity-gated, and this is the sentence to follow when
the gate will not fix a finding. A `survived` finding RAISED at `blocker` or
`high` names its fix commit in `fix_commit` - an auditor runs `git show` on that
value, so it has to be a real one. A `survived` finding raised BELOW them is one
that was confirmed and NOT fixed - reported, moved past - and carries no commit
id because none exists: leave `fix_commit` off the ruling entirely. Do not
downgrade a finding to make it storable and do not invent a SHA to fill the
field; both are false statements about what happened, and the record accepts the
true one.

A `blocker` or `high` the USER OVERRODE carries `overridden: true` instead of a
commit - the one survived-at-a-halting-severity case where no fix is coming, so
no SHA exists to name. The marker is the fact ALONE: the user's own reason rides
the `override` receipt's `--detail-file` (see `references/triage-gate.md`) and a
second copy on the entry is a second statement that can drift. Only the boolean
`true` is accepted, and `false` is refused because absence already says the
finding was not overridden.

`fix_commit` IS CHECKED WHEREVER THE KEY IS SET, on ANY ruling. A `downgraded`
or a `refuted` ruling MAY carry one - a fix that landed while the finding was
being argued down is a real thing to record - and the value is held to the same
bar there as anywhere else: an auditor runs `git show` on it, so a blank, a
`null` or a junk string is REFUSED rather than quietly dropped from the stored
entry. The key is VALIDATED on those rulings, never forbidden on them, and the
refusal names both the field and the ruling it was set on.

Neither case is a fourth `ruling` value. The vocabulary is still `survived`,
`downgraded`, `refuted`, and what varies is what a `survived` entry carries
beside the ruling.

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" adjudication --phase <N> --trigger <trigger> --discriminator <discriminator> --base <base> --head <head> --payload <path>
```

It lands at `.planning/phases/<N>/ADJUDICATION-<trigger>-<discriminator>.json`,
beside the sibling `REVIEW-<trigger>-<discriminator>.md` and on the same
discriminator grammar, which `references/review-triggers.md` step 5 states
once. It does NOT go
inside `<plandir>/reports/`: the lease check
exempts exactly one path under that directory by byte equality, so anything else
staged from there answers `undeclared-files`.
