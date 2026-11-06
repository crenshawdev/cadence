# cad-config menu (cold branch)

Loaded from config.md when `/cad-config` ran with no arguments, or when the reply to the opening screen is a
number. Direct set never reads it. Every count and value on a screen comes from `config.mjs layers`, never from a
raw config file.

## Opening screen

Read the counts once:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/config.mjs" layers
```

It answers `groups` (each with `n`, `name`, `settings`, `repo`, `global`, `beating`, `at_default`), `totals` in the
same fields, `unreadable` and `warnings`. Print it as plain text and end the turn: text above a choice box can be
hidden while the box is open, so the opening screen is never a box.

```
Cadence config
This repo sets <totals.repo>, <totals.at_default> of them the shipped default. Your global config sets <totals.global>. <totals.beating> repo values beat global.

1. <name>   <settings> settings   <global> global, <repo> this repo (<beating> beat global)

For the full walk of every setting, run /cad-config --walk
Pick a number or say what you want to change.
```

One line per group, in the answer's order. Leave out a number that is 0, and the "beat global" part when it is 0.
Show `warnings` above the list, one line each. A count the answer gives as `unreadable` is not a number: write
"unreadable" and the file name from `unreadable` where the count would be, and never show it as 0.

A reply that is only a number from 1 to 6 opens that group. Any other reply: ask which number it belongs to.
