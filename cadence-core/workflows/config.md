# cad-config workflow

Configure `.planning/config.json`. Canonical shape and validation live in
`cadence-core/config.schema.json` (the source of truth), enforced by the
`bin/config.mjs` seam; `cadence-core/templates/config.json` is the scaffolded
default. One interactive skill; the substantive part is review-provider model
assignment, which is the only config knob that needs live detection rather than
a plain edit.

## 0. Locate config

Read `.planning/config.json`. If it is absent, this project has no config yet
(`cad-new-project` writes one for a blank page, `cad-adopt` for a repo that
already has code and history). Offer to copy the template into place; stop if
the user declines.

## 1. Route

Parse `$ARGUMENTS`:
- Starts with `--review`: go to **Review provider setup** (a trailing
  `redetect` just means re-run detection and reassign; same flow).
- Starts with `--surfaces`: go to **Risk surfaces** - re-open the one-time
  risk-surface question with the current answer and today's evidence beside it.
- Starts with `--testing`: go to **Testing policy** - accept or reopen the one
  project testing policy, then (only on this route) ask about verification
  publishing.
- Starts with `--roles`: go to **Roles interview** - the thirteen questions
  that say what each of the six roles costs. A trailing `--global` re-enters
  the full thirteen against the user-global layer instead of writing repo diffs.
- `--walk`: go to **Interactive menu (no args)** - the full walk of every knob.
- Starts with a `<key>=` token (a dotted key name, then `=`): go to **Direct set**.
  A value runs to the next `<key>=` token or the end, so it may hold spaces
  (`git.protected_branches=["main", "develop"]`). An `=` further into the text
  does not make it a setting.
- Any other text is a sentence: Read `${CLAUDE_PLUGIN_ROOT}/cadence-core/workflows/config-menu.md`
  and follow its **A sentence**. A reply to the opening screen that is not a
  number from 1 to 6 goes the same way.
- Empty: Read the same file and follow its **Opening screen**. That file is also
  where the reply to the screen goes; Direct set never reads it.

The menu is opt-in. Before either of those last two arms, read the switch (a
repo value counts):

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/config.mjs" get workflow.config_menu
```

- `true`: the arms above work as written.
- Not `true` (the default is `false`): empty goes to **Interactive menu (no
  args)**, the walk, exactly as `/cad-config` did before the menu. A sentence, or
  a pick of a group, is not taken: say in one line that the menu is off, give
  `/cad-config workflow.config_menu=true` as the command that turns it on, read
  no menu file and write nothing.

A flag, `--walk` and `<key>=<value>` never read the switch.

## Interactive menu (no args)

Reached with `--walk`, or with no arguments while `workflow.config_menu` is off. Goal: let the user adjust every knob the walk carries, presented as
selectable lists, the twelve `roles.<role>.model` and `.effort` keys included. Two sets stay out:
`review.providers.*`, which needs live detection, so the menu routes it to
**Review provider setup** rather than free-typing model ids; and
`review.decision_review`'s two keys, which belong to an on-demand command
rather than the phase loop. The **Roles interview** below is the guided way
into the roles keys, one question per value with what it costs beside it; this
walk is the flat way.

### The walk

1. Read the current config. Show a one-screen summary (each knob = current value). Reached with no arguments, end it with this line: `A menu of six settings groups is off. /cad-config workflow.config_menu=true turns it on.`
2. Read the walk's rows with
   `node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/config.mjs" keys --walk`
   (sections in walk order).
   Walk them **in order, 4 knobs per `AskUserQuestion` call** (the ask-user seam;
   its 4-option cap is why we page). For each knob:
   - one question; its text = the knob's `question`, options = the first item of
     each `explain` entry (`[value, text?]`),
   - **each option carries the entry's second item, `text`, as its
     `description`**,
   - **Label the value in force, and name the LAYER it comes from. Two labels,
     never zero.** Compare step 0's raw read of `.planning/config.json` against
     `config.mjs get`:
     - the knob IS in the repo file -> that option is `(current)`.
     - the knob is NOT in the repo file -> the effective value's option is
       `(in force)`, and its `description` opens by saying the value is active
       but INHERITED, and that picking it writes it into this repo.
     List the labelled option FIRST either way.
   - **A pick equal to the value already in force writes NOTHING**, on both
     arms: re-picking `(current)` and re-picking `(in force)` are each a no-op.
     This is what stops the walk pinning the whole global layer into the repo
     file page by page - a user who agrees with an inherited value is
     agreeing, not choosing to override it.
   - **A key with more than four options does not fit the seam.** The cap is 4
     options and `Other` is the free-type entry, so show the value in force plus
     the three the user is most likely to want, and name every omitted value in
     the last option's `description` with the words "reachable via `Other`".
     `review.triggers.<t>.gate` is the live case, at five.
   - A `hint` is shown as text, never offered as an option. A `null` entry on
     a list key explains the unset state and is not written, because `set`
     refuses it. A key with fewer than two options offers the value in force and
     a fixed `Leave unchanged`, both writing nothing; `Other` types a new value.
   - `type` says how a key is answered: `bool` and `enum` are picked;
     `int`, `string` and `string_or_null` are typed through `Other` (empty
     becomes `null`); `array_string` and `array_enum` are comma-typed and
     written as an array.
   - `src` and `repo_only` say which layer a key is written to: `global` is the
     user-global layer only (`set --global`), `repo` either layer, and
     `repo_only` is refused at the user-global layer.
   - The twelve `review.triggers.<t>.gate`, `.tier` and `.effort` keys are power
     knobs: give them their own page, or a "Review triggers?" opt-in step.
   - Picking `review.triggers.risk_surface.surfaces` opens **Risk surfaces**
     (`/cad-config --surfaces`), which scans the project first and offers
     answers from what it finds.
3. A page whose knobs the user leaves unchanged is a no-op, and so is a page
   where every pick matched the value already in force (step 2's no-op rule).
   Only a value that DIFFERS from what is in force is a diff, and only diffs are
   applied.
4. After the last page, show the changed keys as a diff. A value typed through
   `Other` can carry `$(...)`, which runs before Node starts, and the preview
   comes before the yes, so write each changed value as JSON to its own file in
   a directory this run made
   (`D="$(mktemp -d "${TMPDIR:-/tmp}/cad-XXXXXX")" && case "$D" in (*[!A-Za-z0-9._/-]*) echo "scratch-unsafe: $D" >&2; exit 1;; esac && echo "$D"`) and pass the
   preview and `set` each key as `<key>="$(cat <path>)"` (`references/conventions.md`,
   Caller-derived text). Run `config.mjs preview <key>="$(cat <path>)"…` once for
   the whole batch, show what it answers and ask for a yes in a turn of its own,
   then write via the **Validation seam** (`config.mjs set`). The preview's
   `files` says which file gets what; a batch for both layers is two `set` calls.
   The user may pick `Skip rest` on any page to stop and preview and write what
   changed so far.
5. `review.providers` is not in the page walk - offer it as a final step
   (`Configure review providers now?`) that enters **Review provider setup**.
6. Then run **Worktree base ref** below - a HOST setting, offered only when
   the config now in hand runs plans in parallel worktrees.

### Validation seam

`bin/config.mjs` is the enforcement point - the schema, not this doc, decides what
is valid. Never write config JSON by hand; go through the seam:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/config.mjs" validate            # whole file ok?
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/config.mjs" check <key=value>…  # dry-run one or more pairs
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/config.mjs" set   <key=value>…  # validate then write (atomic: all-or-nothing)
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/config.mjs" unset <key>…        # remove keys from ONE layer; absent key = ok, no bytes changed
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/config.mjs" get   [key …]       # EFFECTIVE values (repo > global > defaults)
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/config.mjs" keys                # dump schema (types/enums/defaults/purpose)
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/config.mjs" keys --walk         # the walk's rows only: question + value explanations
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/config.mjs" preview <key=value>…  # read-only: the file, before and after, what changes
```

`get` is how every workflow reads config - the only read that sees the global
layer. Never read a config file raw for a VALUE. There are exactly three
exceptions, and every one of them asks which LAYER holds a key rather than what
the key says, which is the one question a merged read cannot answer: the walk's
layer labels (step 2); the **Roles interview**'s first-run test, which reads the
user-global file for the PRESENCE of a `roles` key; and the **Stakes
migration**, which reads both files for a key it is about to remove from them.

Each prints one JSON line (`{ok, …}`); `--file <path>` overrides the default
`.planning/config.json`, and `--global` targets the user-global layer at
`~/.claude/cadence/config.json` (`CADENCE_GLOBAL_CONFIG` relocates it), which
`set` auto-creates. Collect the menu's diffs and apply them with one `set` call
per file, so each write is one atomic, validated operation.

**Config layering.** At read time `bin/route.mjs` deep-merges global under repo
(precedence **repo > global > built-in defaults**); nested objects merge, arrays
replace wholesale. Each file is still validated on its own - every layer must be
independently valid. Use `--global` for machine-wide defaults - the model and
the start rung each role runs at, which is exactly what the **Roles interview**
writes there on a first run - and the per-repo file to override per project.

## Direct set

A `worktree.baseRef=…` pair is not a Cadence key and the seam would reject it
as unknown: route it to **Worktree base ref** instead, and say it is a Claude
Code setting the user's own settings file owns.

For each `key=value` (dotted paths allowed, e.g. `workflow.plan_check=false`):
- Validate and write in one shot through the **Validation seam**:
  `config.mjs set <key=value>…`. It rejects an unknown key, a bad value, a
  target file whose top level is not a JSON object, or a dotted path running
  through a container that already holds a non-object (`{ok:false,
  reason:"invalid", detail:[…]}`) atomically - nothing is written unless every
  pair is valid - and echoes `{ok:true, changed:[…]}` on success.
- `check` dry-runs the same pairs and speaks the same contract - `{ok:true}`,
  or `{ok:false, reason:"invalid", detail:[…]}` - without writing anything, and
  a key retired by a release carries a `detail` naming the key that replaced it,
  so that remediation needs no `keys` lookup.
- On rejection, surface the seam's `detail` (the invalid keys and why). For a
  per-key detail, look up the allowed values via `config.mjs keys`; for a
  `(root)` detail, that lookup returns nothing - the remediation instead is
  that the target file's top level is not a JSON object (repair or replace the
  file). A `cannot set through "…"` detail carries its own remediation: that
  container holds an array or a scalar and must be removed or replaced first -
  the seam will not overwrite it, because doing so would discard its contents.
  Do not retry with a malformed config.

## Worktree base ref (a HOST setting - offered, never written silently)

`worktree.baseRef` is a Claude Code setting, not a Cadence key: it is absent
from `config.schema.json`, never goes through `config.mjs`, and lives in the
user's settings files. It decides where a subagent worktree forks from, so the
parallel `/cad-execute` path depends on it - under its `"fresh"` default a
worktree branches from the remote default branch and an executor arrives
without this phase's CONTEXT or its own PLAN file, which is why `choose_path`
refuses to parallelize there (`workflows/execute.md`; Claude Code >= 2.1.208).
Inside a worktree, `"head"` means that worktree's own `HEAD`.

Run this step whenever `parallelization.use_worktrees` is true in the config as
it now stands, WITHOUT also requiring `parallelization.enabled`. Skip the step
only when `use_worktrees` is false, where worktrees genuinely cannot be used.

1. Read the effective value:

   ```
   node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/worktree-base.mjs" resolve
   ```

2. `parallelSafe: true` -> say so in one line (the value and the file it came
   from) and stop. Nothing to change.
3. Otherwise ask through the ask-user seam, quoting the exact JSON
   (`"worktree": { "baseRef": "head" }`) and naming the file each option
   writes: the project's `.claude/settings.json` (recommended - it travels
   with the repo, so every clone's parallel runs behave the same) /
   `~/.claude/settings.json` (all projects) / leave it (parallel execution
   keeps falling back to sequential). Declining is a valid answer and ends the
   step - a plugin does not overrule a user's settings.
4. On accept: READ the target file first and show the user its current
   `worktree` block (or that there is none), then merge the one key in,
   preserving every other setting byte-for-byte, and write it back. Never
   replace a settings file wholesale, never write one whose contents you did
   not read, and never touch a managed-policy file - a higher layer keeps
   winning, so the write would be a lie. Re-run the seam and report the value
   it now resolves to and the file it came from.

## Risk surfaces (`--surfaces`)

Reached by `--surfaces`, by the walk's pick of
`review.triggers.risk_surface.surfaces` or from the menu. Read
`${CLAUDE_PLUGIN_ROOT}/cadence-core/workflows/config-surfaces.md` (one consult
site - this section) and follow it.

## Testing policy (`--testing`)

Reached by `--testing`. Read
`${CLAUDE_PLUGIN_ROOT}/cadence-core/workflows/config-testing.md` (one consult
site - this section) and follow it.

## Roles interview (`--roles`)

Reached by `--roles`; a trailing `--global` re-enters the full thirteen against
the user-global layer. Read
`${CLAUDE_PLUGIN_ROOT}/cadence-core/workflows/config-roles.md` (one consult
site - this section) and follow its **Roles interview** arm.

## Stakes migration (a retired routing key is still on disk)

Open this arm whenever a `config.mjs get` or a `route.mjs resolve` envelope
comes back carrying the retired-key warning that names `stakes`; nothing else
reaches it. Read `${CLAUDE_PLUGIN_ROOT}/cadence-core/workflows/config-roles.md`
(one consult site - this section) and follow its **Stakes migration** arm.

## Review provider setup (cold branch)

The assignment flow (detect -> classify -> assign -> write) lives in
`${CLAUDE_PLUGIN_ROOT}/cadence-core/workflows/config-review.md` - Read it and
follow it when `--review` was passed or the user opts in from the menu. It
rejoins here at **Wrap-up**.

## Wrap-up

Summarize the final tier map per provider and note which triggers now have a
cross-model reviewer (a trigger whose `tier` resolves to a non-null id on a
reviewer that both this repository's and the user-global `review.reviewers`
name). Remind the user this is re-runnable (`/cad-config
--review`).

**Flag dangling enrollment, user-global half included.** If `review.reviewers`
names a cross-model provider (`openai`, `gemini` or `deepseek`) but one or more `review.triggers.<t>.tier`
values resolve to `null` for it (that provider's tier is unassigned), say so
explicitly: the trigger silently falls back to `claude-subagent`, so the
cross-model setup is inert for it. Name the trigger and the empty tier and
offer to assign it or drop the provider from `reviewers`. Flag too a provider
this repository's `review.reviewers` names but the user-global config's does
not: the user-global config must name it too, or every trigger drops it. A
config that enrolls a reviewer it cannot actually reach should never look
configured.

## Degradation contract

If detection fails for everything (offline, no keys, rate limited), the review
subsystem still works via `claude-subagent`; consult is simply not offered.
cad-config only ever writes validated ids and never blocks the spine on a
network call.
