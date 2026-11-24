<purpose>
`planning.mjs trace suggest` reads the joined trace and returns the retune the
record supports. This command presents that retune and stops.

This file is the ONE statement of those presentation rules.
</purpose>

<process>

<step name="scope">
Parse `$ARGUMENTS` for a phase number: it becomes `--phase <N>`. NO argument
means the WHOLE record. Those are the only two scopes. Add no flag of any kind.

The scope is REPORTED, never narrowed. Say which record was read - the return's
`file` names it - and what it spans: nothing prunes `.planning/records/trace.jsonl`
at a close, so an unscoped run spans every milestone still in the LIVE record. A
`--phase <N>` run starts after the newest cycle marker in the trace, so it covers
the open cycle's phase `N`, and a trace with no marker pools every cycle's phase
`N`. The one thing that ever shortens the record is the cut at its size bound,
which `rotated` reports.

The same is true of the SECOND record the seam reads, `.planning/records/reads.jsonl`:
nothing prunes it at a close either, and the one thing that ever shortens it is
the same cut at its size bound, which `reads.rotated` reports. Its own caveat is
that it carries NO phase scoping at all: it is one file per project. A
`--phase <N>` run reaches its reads only through that phase's dispatch BRACKETS:
the join does the scoping, not the flag. Say that where an in-dispatch figure is
presented.
</step>

<step name="read_record">
One seam call, through the `Bash` tool:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" trace suggest [--phase <N>]
```

Everything below reads off its return: `file`, `scope`, `events_read`,
`suggestions`, `reads` (the second record's path, and `reads.rotated` when that
record was cut), and `capped` / `rotated` / `malformed` / `warnings` when any of
the four is present. A `warnings` entry is a config layer the merge could not
read whole, so a `current` below may be reading less than the project set: relay
it, never swallow it. One naming `.planning/records/reads.jsonl` is that file
being unreadable, so no in-dispatch figure was measured this run: relay it the
same way.

That one call reads TWO records, `.planning/records/trace.jsonl` and
`.planning/records/reads.jsonl`, and open NEITHER.
</step>

<step name="present">
Open with one line naming the scope read and the `events_read` count. Then TWO
headed blocks, the tweaks first and the receipts below them. The two kinds never
interleave.

**Heading one - the tweaks this record supports.** Every `kind: "suggest"` entry
is a NUMBERED item under it and no `info` entry appears inside it. Each item
states five things, in this order:

- What it is about: its `subject`, the role, trigger or marker the rule counted.
- The config key it concerns: its `action`, spelled exactly as returned.
- Its `current` value - the key and the value in force, AS GIVEN. Never
  re-resolved here into what would actually fire: a user who moves a key off a
  printed effective value pins that gate.
- Its `direction`, with the `proposed` target beside it where the seam returned
  one - `current` to `proposed`, both spelled as returned. Where the entry
  carries NO `proposed`, state that absence in words.
- Its `evidence`, verbatim as the seam computed it.

When the return carries `info` entries but no `suggest` entry, that heading
still appears and carries exactly one line: the record supports no tweak in this
scope, meaning no CONFIG KEY this record prices - a claim about keys and not
about the run. Where a receipt below names a remedy that is not a key, that line
points at the receipts rather than standing alone. Nothing else is attached to
that line.

**Heading two - the receipts, below the tweak block.** Every `kind: "info"`
entry is one line under it. An `info` asks for nothing, and it is never lifted
into the block above.

That has ONE stated exception, of presentation rather than of kind. An
in-dispatch re-reading receipt names a remedy that is not a config key, which is
why its `action` is null, so relay the remedy its `evidence` names, in its own
words. It stays a receipt, it is still not numbered, and it still generates no
`/cad-config` token: there is no key to put in one.

`capped`, `rotated` or `malformed` gets one line each here, named rather than
swallowed: a capped file was read to a limit, a rotated one was CUT at the
newest phase anchor with everything older in the sibling it names, and a
malformed count is lines the reader could not parse. Capped and rotated are
different facts - a rotated record is whole.

Relay the figures UNCHANGED and recompute none of them - including the ones
whose denominator is arguable. A figure the record does not carry is reported
absent, never filled in.

Then ASK, below the receipts. Every tweak that came back with a `proposed`
target is one `/cad-config <key>=<value>` token - the key as `action` returned
it, the value its `proposed` - and the closing question is whether to run
`/cad-config` with those tokens, through the `SlashCommand` tool. Name the exact
tokens in the question. A tweak the seam could not price has no token to offer
and is named in the block without one - never synthesize a value for it - and
when NO entry carries a target there is nothing to route, so say that and ask
nothing.

The suggestion is input to the user's decision: nothing is applied on the way to
asking, and an unanswered offer means no change. Bind the question through the
ask-user seam's open-ended arm - end the turn on the question, never assume the
answer. WHERE the write happens, on a yes, is inside `/cad-config`, which takes
`<key>=<value>` tokens directly; this command writes no config key itself,
before the question or after it.
</step>

<step name="thin_record">
When `suggestions` came back empty this step REPLACES `present`, and it is
exactly one line. The envelope offers one discriminator, `events_read`, so there
are two lines to choose between and they are not interchangeable:

- `events_read: 0` - the record holds no events in the scope read. Say that.
- `events_read` non-zero, `suggestions` empty - say how many events were read and
  that none of them cleared the evidence floors the rules require.

Never report "no trace" for a record that merely sits below the floors, and never
state a floor figure. `ok: false`, or a return showing the subcommand is not
there, degrades to one line as well - what failed, and that there is no retune
to read. Never a halt, never a guess.
</step>

</process>

<guardrails>
- This command writes nothing itself: no config file in either layer, no
  planning file, trace line or `.planning/` artifact.
- No subagent is dispatched. There is no reviewer, no adjudication, no verdict:
  a suggestion cannot PASS or FAIL anything.
- Name no config key that `cadence-core/config.schema.json` does not carry. In
  practice name none at all: each suggestion states its own key at runtime, and
  that is where the key belongs.
</guardrails>
