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

A reply that is only a number from 1 to 6 opens that group (**A group**). Any other reply: ask which number it belongs to.

## A group

Opened by a number from the opening screen, with that group's `name`:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/config.mjs" layers --group "<name>"
```

It answers `rows` (the group's shown settings in order, each with `key`, `value`, `winner`, `default`, `global`,
`repo` and `applies`) and `advanced` (the keys the group keeps under Advanced).

**The list.** A numbered list of the rows by dotted key, each with its value and who set it: `this repo`, `your
global config` or `the default` from `winner`. A row with no `winner` is on only when both files set it, so say
which one is missing. A cell in state `ignored` says the value is ignored there, and `unreadable` names its file. A row whose `applies` is
false is marked `(no effect right now)`.
Below the list, an `A. Advanced` line when `advanced` is not empty, and the group's guided setup: `--roles` for
Models and effort, `--surfaces` for When reviews run, `--review` for Who reviews, `--testing` for Testing. Git and
landing and How work runs have none. Naming one opens that arm of config.md. Plain text that ends the turn, never a
choice box.

**A pick.** A number opens that setting. Read it with `layers --key <key>` and show a block: the key, `Now:` with
its value and who set it, the default, global and repo values with who wins, and what it does, which is its
`question` with each `explain` text beside its value. When `applies` is false, add `No effect right now:` with each
sentence of `no_effect`. Add `Works with:` with the `interacts` text and each of `works_with` as its key beside its
value, and leave the line out when both are empty. Ask for the new value in the turn's last line. A setting with no effect can still be picked, because it may be
set up ahead of its gate, so end that line with "You can still set it now." and change nothing else in the flow.

- `type` says how a value is typed: `bool` and `enum` are picked from the `explain` values, `int`, `string` and
  `string_or_null` are typed (empty becomes `null`), `array_string` and `array_enum` are comma-typed and written
  as an array. A `hint` is shown as text.
- A `null` on a list key is not written, because `set` refuses it.
- `review.triggers.risk_surface.surfaces` opens **Risk surfaces** instead of being typed.
- A value equal to the one in force writes nothing. Four keys can have a value in force that differs from what the
  target file stores: `git.auto_close`, `workflow.use_workflows`, `workflow.multi_workflow` and `review.reviewers`.
  On those, a pick writes nothing only when it equals what the target file stores, or when that file stores
  nothing and the pick equals the value in force. So picking false over a repo true is written, and the menu can
  undo its own write.

**The preview.** Once the new value is known and before anything is written, run the preview. It writes nothing:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/config.mjs" preview <key>=<value>
```

It answers `files` (each with its `file` and `pairs`: `before` and `after` in force, `stored` on the four keys above,
and `second_file` with `stays_off` for a setting that needs both files), `resolves` (each role with its `changes`),
`starts` and `stops` (each a key with `why`). An `ok:false` is shown as it is, with its next step, and nothing is
written. Print it under the setting's block:

```
If you pick <value>:
             Writes <key>=<value> to <file>.
             <field>: <before> becomes <after>        (one line per entry of `changes`)
             <key> starts applying.   <key> stops applying: <why>.
             <second_file.file> also has to set it: it stays off until both files are set.
```

Leave out a line with nothing to say. When nothing in force changes, say "Nothing changes right now." and, on a key
with `stored`, what the file stores before and after.

**The write.** With the preview on screen, ask for a yes in a turn of its own. Only after the yes, call `set`. The file
follows the key: the repo's `.planning/config.json` by default, `set --global` for `src: global`, and the repo for
`repo_only`.

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/config.mjs" set [--global] <key>=<value>
```

Echo the seam's `changed`, then show the list again.

**Advanced.** Opening the entry reads `layers --group "<name>" --advanced` and lists those keys with their
`purpose`. A pick takes the same pick and write path, with `purpose` in place of the question it does not have.
`review.providers.*` goes to **Review provider setup**, never typed.

**Leaving.** Run **Worktree base ref** when `parallelization.use_worktrees` is on, and **Wrap-up**'s dangling
enrollment check when review settings changed. Many settings at once is the full `--walk`.
