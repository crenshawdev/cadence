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

The scope is REPORTED, never narrowed. Say which record was read and what it
spans: nothing prunes `.planning/trace.jsonl` at a close, so an unscoped run
spans every milestone still in the file, and a `--phase <N>` run admits an older
cycle's phase `N` beside this one's. The user reading a suggestion needs that.
</step>

<step name="read_record">
One seam call:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" trace suggest [--phase <N>]
```

Everything below reads off its return: `scope`, `events_read`, `suggestions`,
and `capped` / `malformed` / `warnings` when any of the three is present - a
`warnings` entry is a config layer the merge could not read whole, so a `current`
below may be reading less than the project set, and it is relayed rather than
swallowed. Do not open `.planning/trace.jsonl` - the seam is the reader, and
prose that re-reads it is prose that can disagree with it.
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
- Its `current` value - and where that came back as the unset form, that form
  and the stakes level it names, AS GIVEN. Never resolved here to the value the
  level would fire: a user who sets a key to move it off a printed effective
  value has just pinned that gate at every stakes level.
- Its `direction`, with the `proposed` target beside it where the seam returned
  one - `current` to `proposed`, both spelled as returned. Where the entry
  carries NO `proposed`, state that absence in words rather than leaving a
  blank, which is indistinguishable from a forgotten field: the record cannot
  price a target, and a suggestion it cannot price comes back without one rather
  than with a guess.
- Its `evidence`, verbatim as the seam computed it.

When the return carries `info` entries but no `suggest` entry, that heading
still appears and carries exactly one line: the record supports no tweak in this
scope. Nothing is attached to that line - an offer with nothing behind it is the
same mute output pointed the other way.

**Heading two - the receipts, below the tweak block.** Every `kind: "info"`
entry is one line under it. An `info` asks for nothing; it is there because the
record earned it a mention, and it is never lifted into the block above.
`capped` or `malformed` gets one line each here, named rather than swallowed: a
capped file was read to a limit, a malformed count is lines the reader could not
parse.

Relay the figures UNCHANGED and recompute none of them - including the ones
whose denominator is arguable. The per-role escalation evidence is denominated
in `routing/resolve` events, so on a cross-model-only configuration it counts
routing decisions no subagent ever acted on, and a run can report a start rung
"held across N resolves" for a role dispatched once or not at all. Relay it as
given anyway: correcting it means changing the seam's denominators, and a number
quietly adjusted in prose is the one failure mode this command has no defence
against.

Then STOP - apply NOTHING. A suggestion is input to the user's decision, exactly
as `cadence-core/references/triage-gate.md` treats review findings: the user
names which keys to change and changes them through `/cad-config` or a direct
edit of `.planning/config.json`, and an unanswered list means no change. There is
no apply arm here to decline.
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
- Read-only, and narrowly so: no config file is written - not
  `.planning/config.json`, not the global Cadence layer - and no planning file,
  trace line or `.planning/` artifact either. This command reads a
  recommendation out loud; changing anything is the user's next move.
- No subagent is dispatched. There is no reviewer, no adjudication, no verdict:
  a suggestion cannot PASS or FAIL anything.
- No fabricated figures. Every count, share and duration is the seam's own; a
  figure the record does not carry is reported absent, never filled in.
- Name no config key that `cadence-core/config.schema.json` does not carry. In
  practice name none at all: each suggestion states its own key at runtime, and
  that is where the key belongs.
</guardrails>
