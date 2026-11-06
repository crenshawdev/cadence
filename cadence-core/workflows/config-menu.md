# cad-config menu (cold branch)

Loaded from config.md when `/cad-config` ran with no arguments or with a sentence, or when the reply to the opening
screen is a number or a sentence. Direct set never reads it. Every count and value on a screen comes from `config.mjs layers`, never from a
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

A reply that is only a number from 1 to 6 opens that group (**A group**). Any other reply is read as a sentence
(**A sentence**), the same as a sentence on the command line.

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

**The value.** What the person typed never goes on the command line as typed: a double-quoted word carrying `$(...)`
runs before Node starts, and the preview comes before the yes. Make a directory for the run, write the new value as
JSON to a file in it with the Write tool (`<D>/value.json`), and pass the preview and `set` the key as
`<key>="$(cat <D>/value.json)"` (`references/conventions.md`, Caller-derived text). A picked value takes the same way.

```
D="$(mktemp -d "${TMPDIR:-/tmp}/cad-config-XXXXXX")" && case "$D" in (*[!A-Za-z0-9._/-]*) echo "scratch-unsafe: $D" >&2; exit 1;; esac && echo "$D"
```

The guard refuses a directory whose path holds a space, a quote or anything else the shell would split, so the paths below
need no quoting. Keep the printed path and write it as a literal into every later call, because each Bash call starts
with `$D` empty.

**The preview.** Once the new value is known and before anything is written, run the preview. It writes nothing:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/config.mjs" preview <key>="$(cat <D>/value.json)"
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
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/config.mjs" set [--global] <key>="$(cat <D>/value.json)"
```

Echo the seam's `changed`, then show the list again.

**Advanced.** Opening the entry reads `layers --group "<name>" --advanced` and lists those keys with their
`purpose`. A pick takes the same pick and write path, with `purpose` in place of the question it does not have.
`review.providers.*` goes to **Review provider setup**, never typed.

**Leaving.** Run **Worktree base ref** when `parallelization.use_worktrees` is on, and **Wrap-up**'s dangling
enrollment check when review settings changed. Many settings at once is the full `--walk`.

## A sentence

Reached when `/cad-config` got text that is not a flag or a list of `key=value`, or when the reply to the opening
screen is not a number. The sentence names what the person wants, such as `make reviews cheaper`. Nothing is
written until a yes.

**Matching.** `catalog` answers every setting's `key`, `question`, `purpose`, `explain` and value in force, which is
too big for the transcript, so it goes to a file in a directory this run makes. Run it, and copy the printed
directory and token as literals into the read-back:

```
D="$(mktemp -d "${TMPDIR:-/tmp}/cad-config-XXXXXX")" && case "$D" in (*[!A-Za-z0-9._/-]*) echo "scratch-unsafe: $D" >&2; exit 1;; esac && T="$$-$(date +%s)" && printf '%s' "$T" > "$D/run-token" \
  && node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/config.mjs" catalog > "$D/catalog.json" \
  && echo "scratch dir: $D  run token: $T"
```

Write the words the sentence turns on, and near ones, as a JSON array to `<D>/terms.json` with the Write tool. Read
back only the settings whose `key`, `question`, `purpose` or `explain` holds one of them, so a setting's own name
finds it:

```
node -e 'const f=require("fs");const d=process.argv[1];let tok;try{tok=f.readFileSync(d+"/run-token","utf8")}catch(e){console.error("scratch-stale: no run token in "+d);process.exit(1)}if(tok!==process.argv[2]){console.error("scratch-stale: "+d+" belongs to another run");process.exit(1)}let c,t;try{c=JSON.parse(f.readFileSync(d+"/catalog.json","utf8"));t=JSON.parse(f.readFileSync(d+"/terms.json","utf8"))}catch(e){console.error("scratch-unreadable: "+e.message);process.exit(1)}if(!Array.isArray(c.settings)||!Array.isArray(t)){console.error("scratch-shape: catalog.json has no settings array or terms.json is not an array in "+d);process.exit(1)}const w=t.map((x)=>String(x).toLowerCase()).filter((x)=>x);for(const s of c.settings){const x=[s.key,s.question,s.purpose].concat((s.explain||[]).map((e)=>e.value+" "+(e.text||""))).join(" ").toLowerCase();if(w.some((v)=>x.includes(v)))console.log([s.key,JSON.stringify(s.value),s.question||s.purpose,(s.explain||[]).map((e)=>e.value).join("|")].join("\t"))}' "<the echoed scratch directory>" "<the echoed run token>"
```

Each line is a key, its value in force, its text and its values. A refusal on stderr (`scratch-stale`,
`scratch-unreadable`, `scratch-shape`) means no match was read: say so and stop. From the lines, pick the settings
the sentence asks to change and the value each should take, by what `question`, `purpose` and `explain` say. Nothing
matched: say so, name the groups from the opening screen, and write nothing.

**Hand-off.** The test is the settings you picked to change, not the lines read back and not the words used. A pick
of `review.providers.*`, or one that adds a cross-model name to `review.reviewers`, goes to **Review provider setup**
(`config.md`), because model ids need live detection and enrolling a provider needs the global-layer question only that
setup asks: `set up OpenAI reviews` picks provider keys, while `make reviews cheaper` picks tier keys and shows them
here even when the read-back also held provider keys. A pick of `review.triggers.risk_surface.surfaces` goes to
**Risk surfaces** (`config.md`), as it does in a group and in the walk, and is never typed. Show nothing else here.
When the picks also hold other settings, say which picks weren't made, and that they can ask again after the setup.

**Scratch value.** A value taken from the sentence is written as JSON to its own file in that directory with the
Write tool (`<D>/v1.json`, `<D>/v2.json`), before anything uses it. The preview and `set` take it as
`<key>="$(cat <path>)"` (`references/conventions.md`, Caller-derived text), because a double-quoted word carrying
`$(...)` runs before Node starts, and the preview comes before the yes.

**Showing.** Run the preview from **A group** once for all the picks:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/config.mjs" preview <key>="$(cat <D>/v1.json)" <key>="$(cat <D>/v2.json)"
```

Read each pick with `layers --key <key>`, as **A pick** does. Show each one with its key, `Now:` the value in force,
`New:` the value from the file, and the file from the preview's `files`, then the preview's other lines as **A group**
prints them. When a pick's `applies` is false, add `No effect right now:` with each sentence of `no_effect`, and end
that pick with "You can still set it now."; the yes covers it. An `ok:false` is shown as it is, and nothing is written.

**Writing.** Ask for a yes in a turn of its own. Only after the yes, call `set`, one call per file the preview
named (`set --global` for the global file), each value through its file:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/config.mjs" set [--global] <key>="$(cat <D>/v1.json)"
```

Echo the seam's `changed`.

**Leaving.** The same follow-ups as **A group**: **Worktree base ref** when `parallelization.use_worktrees` is on,
and **Wrap-up**'s dangling enrollment check when review settings changed.
