<purpose>
The run record prices its own configuration. `planning.mjs trace suggest` reads
the joined trace and returns the retune the record supports - each suggestion
carrying the evidence behind it and the config key it concerns - and this
command presents that and stops. Every figure comes from the seam: nothing here
is recomputed, and nothing here is applied.

This file is the ONE statement of those presentation rules.
`cadence-core/workflows/milestone.md`'s retune step and
`cadence-core/workflows/report.md`'s closing pointer both route here instead of
restating them, so the rules cannot drift into three versions of themselves.
</purpose>

<process>

<step name="scope">
Parse `$ARGUMENTS` for a phase number: it becomes `--phase <N>`. NO argument
means the WHOLE record, on purpose - the milestone close is the caller this seam
was built for, and a milestone's evidence spans every phase it shipped. Those
are the only two scopes. Add no flag of any kind: `trace suggest`'s contract row
in `cadence-core/bin/self-verify.mjs` fixes its flag set at `--phase` alone, so
a scoping flag would be a seam contract change, and there is no correlation-id
scoping to reach for either.

The scope is REPORTED, never narrowed. Say which record was read - the return's
`file` names it - and what it spans: nothing prunes `.planning/trace.jsonl` at a
close, so an unscoped run spans every milestone still in the LIVE record, and a
`--phase <N>` run admits an older cycle's phase `N` beside this one's. The one
thing that ever shortens it is the cut at its size bound, which `rotated`
reports. The user reading a suggestion needs both.

The same is true of the SECOND record the seam reads, `.planning/reads.jsonl`,
and it has one more caveat of its own: nothing prunes it at a close either, the
one thing that ever shortens it is the same cut at its size bound - which
`reads.rotated` reports - and it carries NO phase scoping at all: it is one
file per project. A `--phase <N>`
run therefore reaches its reads only through that phase's dispatch BRACKETS,
which is the join doing the scoping rather than the flag. Say that where an
in-dispatch figure is presented.
</step>

<step name="read_record">
One seam call, through the `Bash` tool:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" trace suggest [--phase <N>]
```

Everything below reads off its return: `file`, `scope`, `events_read`,
`suggestions`, `reads` (the second record's path, and `reads.rotated` when that
record was cut), and `capped` / `rotated` / `malformed` / `warnings` when any of
the four is present - a
`warnings` entry is a config layer the merge could not read whole, so a `current`
below may be reading less than the project set, and it is relayed rather than
swallowed. A `warnings` entry naming `.planning/reads.jsonl` is that file being
unreadable, so no in-dispatch figure was measured this run - relay it the same
way rather than reporting an absence as a low number.

That one call reads TWO records - `.planning/trace.jsonl` and
`.planning/reads.jsonl` - and open NEITHER. The seam is the reader, and prose
that re-reads either is prose that can disagree with it.
</step>

<step name="present">
Open with one line naming the scope read and the `events_read` count. Then TWO
headed blocks, the tweaks first and the receipts below them. The two kinds never
interleave: presenting them as one list is what makes a retune read as a report.

**Heading one - the tweaks this record supports.** Every `kind: "suggest"` entry
is a NUMBERED item under it and no `info` entry appears inside it. Each item
states five things, in this order:

- What it is about: its `subject`, the role, trigger or marker the rule counted.
- The config key it concerns: its `action`, spelled exactly as returned.
- Its `current` value - the key and the value in force, AS GIVEN. Never
  re-resolved here into what would actually fire: a user who sets a key to move
  it off a printed effective value has just pinned that gate, and a printed
  value they did not choose is what makes them do it.
- Its `direction`, with the `proposed` target beside it where the seam returned
  one - `current` to `proposed`, both spelled as returned. Where the entry
  carries NO `proposed`, state that absence in words rather than leaving a
  blank, which is indistinguishable from a forgotten field: the record cannot
  price a target, and a suggestion it cannot price comes back without one rather
  than with a guess.
- Its `evidence`, verbatim as the seam computed it.

When the return carries `info` entries but no `suggest` entry, that heading
still appears and carries exactly one line: the record supports no tweak in this
scope, meaning no CONFIG KEY this record prices - which is a claim about keys
specifically and not about the run. Where a receipt below names a remedy that is
not a key, that line points at the receipts rather than standing alone; the
in-dispatch re-reading receipt is the case this exists for, and printing "no
tweak" directly above a file opened 29 times inside one dispatch is the reading
it prevents. Nothing else is attached to that line - an offer with nothing
behind it is the same mute output pointed the other way.

**Heading two - the receipts, below the tweak block.** Every `kind: "info"`
entry is one line under it. An `info` asks for nothing; it is there because the
record earned it a mention, and it is never lifted into the block above.

That has ONE stated exception, and it is one of presentation rather than of
kind. An in-dispatch re-reading receipt names a remedy that is not a config key
- there is none, which is why its `action` is null - so relay the remedy its
`evidence` names, in its own words, rather than leaving the reader holding a
ratio with nothing to do about it. It stays a receipt, it is still not numbered,
and it still generates no `/cad-config` token: there is no key to put in one.
`capped`, `rotated` or `malformed` gets one line each here, named rather than
swallowed: a capped file was read to a limit, a rotated one was CUT at the
newest phase anchor with everything older in the sibling it names, and a
malformed count is lines the reader could not parse. Capped and rotated are
different facts - a rotated record is whole.

Relay the figures UNCHANGED and recompute none of them - including the ones
whose denominator is arguable. The per-role escalation evidence is denominated
in `routing/resolve` events, so on a cross-model-only configuration it counts
routing decisions no subagent ever acted on, and a run can report a start rung
"held across N resolves" for a role dispatched once or not at all. Relay it as
given anyway: correcting it means changing the seam's denominators, and a number
quietly adjusted in prose is the one failure mode this command has no defence
against.

Then ASK, below the receipts. Every tweak that came back with a `proposed`
target is one `/cad-config <key>=<value>` token - the key as `action` returned
it, the value its `proposed` - and the closing question is whether to run
`/cad-config` with those tokens, through the `SlashCommand` tool. Name the exact
tokens in the question: a user answering "yes" to a summary has not seen the
values. A tweak the seam could not price has no token to offer and is named in
the block without one - never synthesize a value for it - and when NO entry
carries a target there is nothing to route, so say that and ask nothing.

The posture that question keeps is `cadence-core/references/triage-gate.md`'s
over review findings: the suggestion is input to the user's decision, nothing is
applied on the way to asking, and an unanswered offer means no change. Bind it
through the ask-user seam's open-ended arm - end the turn on the question, never
assume the answer. WHERE the write happens, on a yes, is inside `/cad-config`,
which takes `<key>=<value>` tokens directly; this command writes no config key
itself, before the question or after it, and a user who would rather edit
`.planning/config.json` by hand declines and does that.
</step>

<step name="thin_record">
When `suggestions` came back empty this step REPLACES `present`, and it is
exactly one line. The envelope offers one discriminator, `events_read`, so there
are two lines to choose between and they are not interchangeable:

- `events_read: 0` - the record holds no events in the scope read. Say that.
- `events_read` non-zero, `suggestions` empty - say how many events were read and
  that none of them cleared the evidence floors the rules require. The
  configuration earned its keep, which is worth its own line.

Never report "no trace" for a record that merely sits below the floors, and never
state a floor figure: the envelope returns none, and this is the one command
whose whole posture is that it invents no number. `ok: false`, or a return
showing the subcommand is not there, degrades to one line as well - what failed,
and that there is no retune to read. Never a halt, never a guess.
</step>

</process>

<guardrails>
- This command writes nothing itself: no config file - not
  `.planning/config.json`, not the global Cadence layer - and no planning file,
  trace line or `.planning/` artifact either. It ends by ASKING whether to route
  the priced tweaks to `/cad-config`; on a yes the write is `/cad-config`'s,
  made from the tokens the offer named. Changing anything is still the user's
  call, and a question is not a change.
- No subagent is dispatched. There is no reviewer, no adjudication, no verdict:
  a suggestion cannot PASS or FAIL anything.
- No fabricated figures. Every count, share and duration is the seam's own; a
  figure the record does not carry is reported absent, never filled in.
- Name no config key that `cadence-core/config.schema.json` does not carry. In
  practice name none at all: each suggestion states its own key at runtime, and
  that is where the key belongs.
</guardrails>
