# cad-config roles interview and stakes migration (cold branch)

Loaded from config.md's **Roles interview** and **Stakes migration** arms,
and opened directly by `/cad-new-project` and `/cad-adopt` at setup and by the
spawn-agent seam on a retired-key warning.

## Roles interview (`--roles`)

Thirteen questions that decide what each of the six roles costs: a model and a
start rung for each, then one question about the risk floor. There is no level
and no grid behind them - `roles.<role>.model` and `roles.<role>.effort` are the
whole answer - so the questions themselves are the documentation. Each one says
what the role does in the phase loop and what the choice costs there.

Reached four ways: `/cad-config --roles` on demand; `/cad-config --roles
--global` to re-enter the full thirteen against the user-global layer; the
first-run pass `/cad-new-project` and `/cad-adopt` run after the template copy;
and the **Stakes migration** arm below, which runs the same questions over an
expanded level.

### 1. Which layer this run writes

Read the user-global file (`~/.claude/cadence/config.json`, or wherever
`CADENCE_GLOBAL_CONFIG` points) raw, and for the PRESENCE of a `roles` key only.
This is one of the three raw-read exceptions `workflows/config.md`'s **Validation seam**
lists, for the reason it states: `config.mjs get` merges the layers, so it cannot say which
one HOLDS a key.

- **First run** - that file has no `roles` key, or does not exist. Ask all
  thirteen. Write all twelve values plus the floor answer in ONE
  `config.mjs set --global`, whatever the user picked. This is the one place the
  walk's "a pick equal to the value in force writes nothing" rule is
  deliberately suspended: a first run where the user accepted every default
  would otherwise leave no `roles` key on disk, which is the exact state this
  step reads as a first run, and the interview would re-ask forever.
- **Any later run** - `/cad-config --roles` in a repository, or the confirmation
  the two init workflows run once the global layer is populated. Show the twelve
  values in force with their layer labels (the two-label rule of `workflows/config.md`'s walk) and write
  ONLY the diffs, through a plain `config.mjs set`, into `.planning/config.json`.
  A pick equal to the value in force writes nothing here.
- **`--roles --global`** - the full thirteen again, against the user-global
  layer, with `config.mjs set --global`. This is the way back into machine-wide
  defaults; without it they could only be revised one key at a time.

Name the file the write landed in, by path, before the run ends.

### 2. The four calls

Thirteen questions do not fit one call. The ask-user seam
(`${CLAUDE_PLUGIN_ROOT}/cadence-core/references/seam-ask-user.md`) takes at most
four questions per call and at most four options per question - two caps, not
one. Ask them in rung-map order, four calls:

1. `cad-planner` model, `cad-planner` effort, `cad-assumptions-analyzer` model,
   `cad-assumptions-analyzer` effort.
2. `cad-verifier` model, `cad-verifier` effort, `cad-reviewer` model,
   `cad-reviewer` effort.
3. `cad-executor` model, `cad-executor` effort, `cad-plan-checker` model,
   `cad-plan-checker` effort.
4. The risk floor.

Every question carries a default: the value in force, listed FIRST and labelled
by the two-label rule of `workflows/config.md`'s walk - `(current)` when the
layer being written already holds it, `(in force)` when it is inherited, and an
inherited option's `description` opens by saying so.

### 3. The model question, per role

Ask the role's question, word for word:

- `cad-planner`: "Which model writes your plans? Everything built later follows them, so a stronger model costs more here and saves rework later."
- `cad-assumptions-analyzer`: "Which model lists what a phase assumes, before any plan exists? It runs only when you choose to have the code read, at most once a phase, and a stronger one catches a wrong premise early."
- `cad-verifier`: "Which model checks whether a phase met its goal, not just whether its tasks ran? It runs only when the deeper check is on, and a stronger one misses less."
- `cad-reviewer`: "Which model runs the Claude reviewer? If you use it, it runs on every review, so a cheaper model saves the most and a stronger one catches more."
- `cad-executor`: "Which model writes the code, one run per plan? It is the largest cost in a phase, so a cheaper model saves the most and a stronger one makes fewer mistakes."
- `cad-plan-checker`: "Which model checks each plan before any code is written? It runs only when plan checking is on, and the work is short, so a cheaper model often does."

Options, in this order, up to the cap of four:

1. **The value in force**, labelled `(current)` or `(in force)`. When no layer
   sets it, that value is `null` and its description is "use your session's
   model".
2. `opus` - "strongest, costs the most".
3. `sonnet` - "in the middle; most work fits here".
4. `haiku` - "cheapest, least capable".

Never list the value in force twice: whichever of those it already is, the
remaining options fill the slots. `fable` is a fifth name the host accepts and
is deliberately NOT offered outright - name it in the last option's
`description` as reachable via `Other`, with the reason: choosing it is an
assertion about your own organisation (it needs 30-day data retention, and it
refuses some security review work), not a rung on a ladder.

`Other` is free-typed and goes into config exactly as typed - the key is a
string, not an enum, so nothing rejects a name this host has never heard of.
Echo `config.mjs set`'s `changed` array back to the user, so the exact string
that landed is on screen at the moment it lands rather than at the first
dispatch. A model the host does not accept still resolves `ok:true` and
dispatches with NO model parameter, naming the string in the resolve's
`warnings[]`.

### 4. The effort question, per role

Ask the role's question, word for word:

- `cad-planner`: "How hard should the planner work when it starts? If the setting Retry a failure at higher effort is on, a failed try retries one step harder."
- `cad-assumptions-analyzer`: "How hard should the assumptions analyzer work when it starts? If the setting Retry a failure at higher effort is on, a failed try retries one step harder."
- `cad-verifier`: "How hard should the verifier work when it starts? If the setting Retry a failure at higher effort is on, a failed try retries one step harder."
- `cad-reviewer`: "How hard should the Claude reviewer work when it starts? If the setting Retry a failure at higher effort is on, a failed try retries one step harder."
- `cad-executor`: "How hard should the executor work when it starts? If the setting Retry a failure at higher effort is on, a failed try retries one step harder."
- `cad-plan-checker`: "How hard should the plan checker work when it starts? If the setting Retry a failure at higher effort is on, a failed try retries one step harder."

The rung is where the role STARTS; `model.escalate_on_failure` re-dispatches a
failed attempt one rung higher, holding at the top.

Six values - `low`, `medium`, `high`, `xhigh`, `max` and `null` - do not fit the
four-option cap, so this takes exactly the rule `workflows/config.md`'s walk states for
`review.triggers.<t>.gate`: show the rung in force plus the three the user is
most likely to want, and name every omitted rung in the last option's
`description` with the words "reachable via `Other`". A rung silently absent
reads as a rung that does not exist. The descriptions are: `low` "light
thinking, fastest", `medium` "moderate thinking", `high` "deep thinking",
`xhigh` "very deep thinking, slower", `max` "the deepest thinking, slowest and
costliest", and `null` "use the default for this role".

`null` is a real answer and means "this key does not pin the rung, so the
schema default decides" - which is how a repo layer un-pins a global one.

### 5. The floor question

One question, and the only one that is not per role. Ask it word for word:

"Which risky areas should not make a phase's plan review blocking or turn on the deeper check? The review of the actual changes still runs."

A plan Cadence could not read raises the bar too, on purpose, because a scope
nobody read has proved nothing. No role's model or rung moves; what you just set
is what dispatches.

Carry the eight category definitions from
`${CLAUDE_PLUGIN_ROOT}/cadence-core/references/risk-surface.md` as the
question's context, exactly as `workflows/config-surfaces.md` does - this is the other arm
where a user meets the category names.

Options:

1. **Leave it as it is** `(recommended)` - "Changes nothing. Areas already
   skipped in your config stay skipped, and with none skipped every risky area
   keeps the blocking plan review and the deeper check." Writes nothing, and
   leaves any waiver already on disk in place.
2. **Choose areas to skip** - "The areas you pick no longer make the plan review
   blocking or turn on the deeper check. The review of the actual changes still
   runs." Writes `review.triggers.risk_surface.waive_routing_floor` with the
   picked categories, for those categories only. It does NOT turn off the
   `risk_surface` review itself, which still fires on the actual diff and which
   this key cannot reach.

Two of the six roles are unaffected by this answer whatever it is: `cad-planner`
and `cad-assumptions-analyzer` are dispatched before a plan exists, so there is
no plan for the floor to read.

### 6. Writing

Collect every diff and apply it in ONE `config.mjs set` (or `set --global`)
through `workflows/config.md`'s **Validation seam** - one atomic, validated write, the
same rule the menu walk follows. Then show the seam's `changed` array back and name the file
it wrote to.

## Stakes migration (a retired routing key is still on disk)

The single level that decided every role's model and effort is retired, nothing
routes from it, and `config.mjs validate` refuses a file that still carries it.
Open this arm whenever a `config.mjs get` or a `route.mjs resolve` envelope
comes back carrying the retired-key warning that names it. That warning is the
only trigger, so a config which never held the key never reaches this arm and
nothing re-asks on its own. Do not relay the warning and carry on: run the
migration, then re-issue the command that produced it.

1. Read `.planning/config.json` and the user-global file RAW, each on its own,
   for a top-level `stakes` key. This arm is about to remove that key from those
   files: this is the third raw-read exception
   `workflows/config.md`'s **Validation seam** lists.

2. Expand EACH layer that holds the key independently, against its OWN value.
   The global file's level becomes the global roles block; the repository file's
   level becomes the repository roles block. Never write one expansion to both
   layers: a machine sitting at `solo` beside this repository at `critical`
   would otherwise hand every other project on it critical's models and rungs.
   A layer that does not hold the key is not written at all.

   | Was | Model, per role | Start rung, per role |
   |---|---|---|
   | `solo` | `sonnet` for all six | planner `high`, analyzer `high`, verifier `high`, reviewer `medium`, executor `high`, plan checker `low` |
   | `shipped` | `opus` for all six except the plan checker, which is `sonnet` | planner `high`, analyzer `high`, verifier `medium`, reviewer `high`, executor `high`, plan checker `medium` |
   | `critical` | `opus` for all six | `xhigh` for all six |

   That table is the last copy of the retired routing grid anywhere in this
   repository, and it is prose this arm reads - no code reads it, and nothing
   else in the tree hand-copies a model name.

3. Show the twelve values PER LAYER before writing anything - "your machine-wide
   `solo` becomes these twelve; this repository's `critical` becomes these
   twelve" - then run them through the **Roles interview**'s questions so the
   user confirms or adjusts each one. Same thirteen questions; the only
   difference is that the value in force starts at the expanded row rather than
   at the schema default.

4. Write each layer's own answers through `workflows/config.md`'s **Validation seam** -
   `config.mjs set --global …` for the user file, plain `config.mjs set …` for
   the repository file - and then remove the key from every layer that held it:

   ```
   node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/config.mjs" unset stakes
   node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/config.mjs" unset stakes --global
   ```

   Run only the line for a layer step 1 found the key in. `unset` on a layer
   that does not hold it is `ok:true` and changes no bytes, but what you report
   back has to name the files that were actually edited.

5. Say in ONE line what did NOT come across. The level also decided the review
   gates, the cross-model reviewer tiers and efforts, and whether the deep
   verify pass ran; none of those is migrated. They now come from
   `cadence-core/config.schema.json`'s own defaults, so a project that leaned on
   a `critical` row's gates has to state them itself - `review.triggers.<t>.gate`,
   `review.triggers.<t>.tier` and `review.triggers.<t>.effort` are in the
   walk, and the deep pass now runs when the risk floor raises rather than
   when a level said so, with `workflow.verifier` still its off switch.
