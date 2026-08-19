# What Cadence costs to run

**Measured on my own account, and the structural work behind the numbers.**

Most of what makes AI-assisted development expensive is not the model, it is the
mess. Context piles up, the same files get read again and again, the
conversation drags a week of history into every single turn, and the bill
follows the clutter. Keeping durable state on disk and doing the heavy reading
in a fresh subagent that hands back an answer instead of a file is the fix for
that, and it shows up in what a unit of work costs rather than in a cache
statistic.

These are measurements of my own real usage, taken from my account's usage data,
not telemetry the tool collects. Cadence ships no instrumentation and phones
nothing home. Measured 2026-07-26 across 7,548 requests, 2,845 of them Cadence.
A request on the main thread inside a Cadence project carries about 92k of
context and costs about 28 cents. The main thread on my freeform work, same
machine, same models, same me, carries about 133k and costs about 36 cents.
Cadence also routes about 27% of its subagent work to Sonnet and Haiku where the
job does not need Opus, against about 8% on my freeform work.

Read that carefully, because it is a comparison between two piles of my own
sessions and not a controlled experiment. I reach for Cadence on the big
multi-phase jobs, so a Cadence session is usually a heavier session overall. The
claim is not that your bill goes down. It is that each turn drags less history
behind it, and you stop paying full freight to re-read your own conversation.

v2.3.0 went at that structurally instead of by measurement, after a month of
usage data showed the ratio the numbers above only imply: about 108k of resident
context per assistant turn against 565 tokens of output, with cache reads alone
at 62.7% of the bill. When cost is context multiplied by turns, thinking harder
is nearly free and carrying less is where the money is. Three things decide what
a turn carries, and all three moved. What the twelve main commands load in turn
one, before they do anything, went from 231,422 bytes to 199,687, and the two
carrying the most dropped hardest: `/cad-pause` from 18,523 to 8,197,
`/cad-land` from 36,235 to 31,016. Every figure in that sentence was measured at
v2.3.0 and stands as a measurement taken then: it is the before-and-after that
carries the point, not a reading of the tree today, and the tree has moved
since. For what those numbers are now — the command count, each command's
turn-one bytes, and what a dispatch carries — run
`node cadence-core/bin/weight.mjs resident --root .` in a checkout;
[`docs/EVIDENCE.md`](EVIDENCE.md) defines the terms and gives the commands.
Published figures were dropped in v2.7.0: they were derived data carried in the
tree, and keeping about two hundred of them honest cost more than reading them
ever paid back. A subagent's full output no longer stays resident in the context
that dispatched it, it writes a file and the parent keeps a five-field digest.
And the skill and agent descriptions, which ride the system prompt of every
session in every project whether or not you ever run a Cadence command, were cut
to one routing line each.

Two honest notes on that. The plugin's own weighed total went up over the same
stretch, because moving a rule out of a shared reference and into the workflow
that actually uses it puts those bytes on a measured surface for the first time.
The win is in what a turn loads, not in what the repository weighs, and
reporting the second number as the headline would have hidden the first. And
five of the twelve commands ended up slightly heavier, because their workflow
files grew when guidance moved inline, which a forty-byte description cut was
never going to pay for. Both are recorded in the phase record rather than netted
away.
