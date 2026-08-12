# Runtime evidence: what Cadence weighs

This page carries the DEFINITIONS and the commands that print the numbers. It
does not carry the numbers.

That is a deliberate reversal of what it used to be. Until v2.7.0 it published
about two hundred measured figures across six tables, each asserted against the
live tree by `cadence-core/bin/prose-agreement.test.mjs`. The assertions worked
exactly as designed and the design was wrong: one byte changed in any of 99
measured surfaces could move a directory subtotal, a grand total, a
twelve-largest ranking, a command's eager-and-reachable pair and a dispatch row
at once, so five tables went stale for an edit that had nothing to do with any
of them. Checked-in derived data, plus tests proving the copy still matches the
source, is a maintenance loop rather than evidence. The measurement takes about
200ms; run it.

Nothing here is collected at runtime and nothing is reported home. `weight.mjs`
reads the prose files in the tree and counts bytes.

## The three terms

These are the definitions in `cadence-core/bin/lib/resident-weight.mjs`, not
looser paraphrases of them. They do not drift, which is why they are the part
worth writing down.

- **eager (turn one)** — `skills/<name>/SKILL.md` plus every path on an
  `@${CLAUDE_PLUGIN_ROOT}/...` line at the start of a line in that SKILL.md.
  These are the bytes the host injects **before the command's first turn**, so
  they ride every remaining turn of the run. This is what `README.md` means by
  "load in turn one".
- **reachable** — the eager set plus every `cadence-core/{references,templates,workflows}/<file>`
  the text of the eager files names and that exists on disk. **One hop**, never
  a transitive closure. Reachable bytes are what the command *may* read at some
  step, not what it carries from the start; they are not turn-one bytes and are
  never labelled as such.
- **dispatch (per role)** — one `agents/<file>.md` plus the SKILL.md of every
  contract it preloads. These bytes land in a **fresh subagent context**, not in
  the orchestrator's.

Command and dispatch figures are never summed: a dispatch's bytes land in a
different context, so a combined total would grow with plan count and stop being
reproducible from the tree.

## The commands

Turn-one bytes per command, eager against reachable, the per-role dispatch
weight, and the surfaces reachable from no command at all - all four come out of
one call, as `commands[].eagerBytes`, `commands[].reachableBytes`, `roles[]` and
`zeroResident`:

```
node cadence-core/bin/weight.mjs resident --root .
```

Every measured surface with its byte and estimated-token weight, which is the
per-file view and the input to the budget manifest:

```
node cadence-core/bin/weight.mjs --root .
```

Narrow either to one command or one role with `--command <name>` or
`--role <name>`. Both emit one JSON line, sorted and deterministic, so two runs
on the same tree are byte-identical and a diff between two checkouts means
something.

## What is still enforced

Cutting the published figures weakened no check. `cadence-core/bin/weight-budgets.json`
still carries a byte ceiling per measured surface, and `self-verify` still fails
any surface that EXCEEDS its entry, on the commit that introduces the growth.
That ceiling is what makes prose growth a conscious act: raising it is a visible
line in the diff. It is a ceiling rather than an equality, so shrinking is free
and needs no re-pin.

`self-verify` also fails a measured surface with no budget entry at all
(`unbudgeted-surface`), so new prose cannot arrive unmeasured.

## What this file does not carry

No phase-trace evidence. `.planning/trace.jsonl` is written per phase by
`planning.mjs trace append` and the seam scripts (`route.mjs` writes the
routing event and, per dispatch site, the bracket's dispatch half),
and rendered by `/cad-progress --trace`; the intent was to publish one from a
project that is not Cadence itself.
Checked 2026-08-09 across every project on this machine with a `.planning/`
directory — `atmos`, `burnrate`, `hindsight`, `jcrenshaw.dev`, `placer`,
`reflex`, `tempest`, `weathervane` — none has a `trace.jsonl`; only Cadence
does. Publishing Cadence's own trace as evidence that Cadence works elsewhere
would prove nothing, so that half is closed as not-fired rather than filled with
the wrong input.
