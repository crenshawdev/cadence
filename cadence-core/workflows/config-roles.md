# cad-config roles interview and stakes migration (cold branch)

Loaded from config.md's **Roles interview** and **Stakes migration** arms, by
`/cad-new-project` and `/cad-adopt` at setup, and by the spawn-agent seam on a
retired-key warning.

## Roles interview (`--roles`)

Thirteen questions: a model and a start rung for each of the six roles, then
one about the risk floor. `roles.<role>.model` and `roles.<role>.effort` are the
whole answer, so the questions are the documentation.

### 1. Which layer this run writes

Read the user-global file (`~/.claude/cadence/config.json`, or wherever
`CADENCE_GLOBAL_CONFIG` points) raw, for the PRESENCE of a `roles` key only -
one of the three raw-read exceptions `workflows/config.md`'s **Validation seam**
lists, since `config.mjs get` merges the layers and cannot say which one HOLDS a
key.

- **First run** - that file has no `roles` key, or does not exist. Ask all
  thirteen. Write all twelve values plus the floor answer in ONE
  `config.mjs set --global`, whatever the user picked.
- **Any later run** - `/cad-config --roles` in a repository, or the confirmation
  the two init workflows run once the global layer is populated. Show the twelve
  values in force with their layer labels (the two-label rule of `workflows/config.md`'s walk) and write
  ONLY the diffs, through a plain `config.mjs set`, into `.planning/config.json`.
  A pick equal to the value in force writes nothing here.
- **`--roles --global`** - the full thirteen again, against the user-global
  layer, with `config.mjs set --global`.

Name the file the write landed in, by path, before the run ends.

### 2. The four calls

Ask through the ask-user seam
(`${CLAUDE_PLUGIN_ROOT}/cadence-core/references/seam-ask-user.md`), whose caps
make this four calls, in rung-map order:

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

Never list the value in force twice; the remaining options fill the slots. Do
not offer `fable` outright: name it in the last option's `description` as
reachable via `Other`, with the reason that choosing it asserts something about
your own organisation (it needs 30-day data retention, and it refuses some
security review work).

`Other` goes into config exactly as typed; the key is a string, so nothing
rejects an unknown name. Pass it through step 6's file, never inline, and echo
`config.mjs set`'s `changed` array back so the exact string is on screen as it
lands. A model the host does not accept still resolves `ok:true` and dispatches
with NO model parameter, naming the string in the resolve's `warnings[]`.

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

The six values - `low`, `medium`, `high`, `xhigh`, `max` and `null` - take the
rule `workflows/config.md`'s walk states for `review.triggers.<t>.gate`: show
the rung in force plus the three the user is most likely to want, and name every
omitted rung in the last option's `description` with the words "reachable via
`Other`". The descriptions are: `low` "light thinking, fastest", `medium`
"moderate thinking", `high` "deep thinking", `xhigh` "very deep thinking,
slower", `max` "the deepest thinking, slowest and costliest", and `null` "use
the default for this role".

`null` means the key does not pin the rung and the schema default decides; it
is how a repo layer un-pins a global one.

### 5. The floor question

One question, not per role. Ask it word for word:

"Which risky areas should not make a phase's plan review blocking or turn on the deeper check? The review of the actual changes still runs."

A plan Cadence could not read raises the bar too. No role's model or rung
moves; what you just set is what dispatches.

Carry the eight category definitions from
`${CLAUDE_PLUGIN_ROOT}/cadence-core/references/risk-surface.md` as the
question's context, exactly as `workflows/config-surfaces.md` does.

Options:

1. **Leave it as it is** `(recommended)` - "Changes nothing. Areas already
   skipped in your config stay skipped, and with none skipped every risky area
   keeps the blocking plan review and the deeper check." Writes nothing, and
   leaves any waiver already on disk in place.
2. **Choose areas to skip** - "The areas you pick no longer make the plan review
   blocking or turn on the deeper check. The review of the actual changes still
   runs." Writes `review.triggers.risk_surface.waive_routing_floor` with the
   picked categories. It does NOT turn off the `risk_surface` review of the
   diff.

The answer never affects `cad-planner` or `cad-assumptions-analyzer`, which
dispatch before a plan exists.

### 6. Writing

Collect every diff and apply it in ONE `config.mjs set` (or `set --global`)
through `workflows/config.md`'s **Validation seam**. Each value typed through
`Other` goes as JSON to its own file in a directory this run made, passed as
`<key>="$(cat <path>)"` (`references/conventions.md`, Caller-derived text):

```
D="$(mktemp -d "${TMPDIR:-/tmp}/cad-XXXXXX")" && case "$D" in (*[!A-Za-z0-9._/-]*) echo "scratch-unsafe: $D" >&2; exit 1;; esac && echo "$D"
```

Then show the seam's `changed` array back and name the file it wrote to.

## Stakes migration (a retired routing key is still on disk)

The single `stakes` level is retired, nothing routes from it, and
`config.mjs validate` refuses a file that still carries it. The only trigger is
a `config.mjs get` or `route.mjs resolve` envelope carrying the retired-key
warning that names it. Do not relay the warning and carry on: run the
migration, then re-issue the command that produced it.

1. Read `.planning/config.json` and the user-global file RAW, each on its own,
   for a top-level `stakes` key - the third raw-read exception
   `workflows/config.md`'s **Validation seam** lists.

2. Expand EACH layer that holds the key against its OWN value: the global
   file's level becomes the global roles block, the repository file's level the
   repository roles block. Never write one expansion to both layers, and never
   write a layer that does not hold the key.

   | Was | Model, per role | Start rung, per role |
   |---|---|---|
   | `solo` | `sonnet` for all six | planner `high`, analyzer `high`, verifier `high`, reviewer `medium`, executor `high`, plan checker `low` |
   | `shipped` | `opus` for all six except the plan checker, which is `sonnet` | planner `high`, analyzer `high`, verifier `medium`, reviewer `high`, executor `high`, plan checker `medium` |
   | `critical` | `opus` for all six | `xhigh` for all six |

3. Show the twelve values PER LAYER before writing anything - "your machine-wide
   `solo` becomes these twelve; this repository's `critical` becomes these
   twelve" - then run the **Roles interview**'s thirteen questions so the user
   confirms or adjusts each one, with the value in force starting at the
   expanded row.

4. Write each layer's own answers as the **Roles interview**'s step 6 does -
   `config.mjs set --global …` for the user file, plain `config.mjs set …` for
   the repository file - then remove the key from each layer step 1 found it in,
   running only that layer's line:

   ```
   node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/config.mjs" unset stakes
   node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/config.mjs" unset stakes --global
   ```

   Report the files actually edited.

5. Say in ONE line what did NOT come across: the review gates, the cross-model
   reviewer tiers and efforts, and whether the deep verify pass ran. They now
   come from `cadence-core/config.schema.json`'s defaults; a project that wants
   other values sets `review.triggers.<t>.gate`, `review.triggers.<t>.tier` and
   `review.triggers.<t>.effort` in the walk. The deep pass now runs when the
   risk floor raises, with `workflow.verifier` still its off switch.
