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
- Starts with `--roles`: go to **Roles interview** - the thirteen questions
  that say what each of the six roles costs. A trailing `--global` re-enters
  the full thirteen against the user-global layer instead of writing repo diffs.
- Contains `<key>=<value>` tokens: go to **Direct set**.
- Empty: go to **Interactive menu** - walk every knob as a selectable list.

## Interactive menu (no args)

Goal: let the user adjust every knob the catalog carries, presented as
selectable lists. The twelve `roles.<role>.model` and `roles.<role>.effort`
keys ARE in the catalog. They were excluded while the six `model.overrides`
pins and the six `model.effort` rungs existed to override a decision a routing
grid otherwise made; that grid is gone, and what a role costs is now a plain
answer the user gives, so the menu reaches it like any other knob. Those two
older families stay edit-the-file-only and have no catalog row - they survive
only as the narrower fallbacks UNDER the roles keys, reachable by direct set
(`/cad-config model.effort.cad-executor=medium`) for a config that already
carries them. Two more sets stay out for reasons of their own:
`review.providers.*`, which needs live detection, so the menu routes it to
**Review provider setup** rather than free-typing model ids; and
`review.decision_review`'s two keys, which belong to an on-demand command
rather than the phase loop. The **Roles interview** below is the guided way
into the roles keys, one question per value with what it costs beside it; this
walk is the flat way.

### The walk

1. Read the current config. Show a one-screen summary (each knob = current value).
2. Walk the catalog **in order, 4 knobs per `AskUserQuestion` call** (the
   ask-user seam; its 4-option cap is why we page). For each knob:
   - one question; its text = the knob's **Purpose**, options = the knob's Values,
   - **each option carries its Explanation as the option `description`** (the small
     line shown under the option in the selection list),
   - **Label the value in force, and name the LAYER it comes from. Two labels,
     never zero.** Compare step 0's raw read of `.planning/config.json` against
     `config.mjs get`:
     - the knob IS in the repo file -> that option is `(current)`.
     - the knob is NOT in the repo file -> the effective value's option is
       `(in force)`, and its `description` opens by saying the value is active
       but INHERITED, and that picking it writes it into this repo.
     List the labelled option FIRST either way. An unlabelled option is the bug
     this replaces: `get` returns the effective value, so the old rule dropped
     the label to stop an inherited value being mislabelled `(current)` and
     pinned - but dropping it entirely left the user choosing with nothing on
     screen saying what is active. Name the layer; never hide what is set.
   - **A pick equal to the value already in force writes NOTHING**, on both
     arms: re-picking `(current)` and re-picking `(in force)` are each a no-op.
     This is what stops the walk pinning the whole global layer into the repo
     file one page at a time - a user who agrees with an inherited value is
     agreeing, not choosing to override it.
   - **An enum with more than four values does not fit the seam.** The cap is 4
     options and `Other` is the free-type entry, so show the value in force plus
     the three the user is most likely to want, and name every omitted value in
     the last option's `description` with the words "reachable via `Other`". A
     value silently absent reads as a value that does not exist -
     `review.triggers.<t>.gate` is the live case, at five.
   - `Other` (auto-added) is the free-type entry for numbers, strings, and lists.

   Read `${CLAUDE_PLUGIN_ROOT}/cadence-core/references/config-catalog.md`
   (one consult site - this step) for the rows themselves, in walk
   order, each carrying its Purpose, Values and Explanations.
3. A page whose knobs the user leaves unchanged is a no-op, and so is a page
   where every pick matched the value already in force (step 2's no-op rule).
   Only a value that DIFFERS from what is in force is a diff, and only diffs are
   applied.
4. After the last page, show the changed keys as a diff and write once via the
   **Validation seam** (`config.mjs set`) - one atomic, validated write. The user
   may pick `Skip rest` on any page to stop and write what changed so far.
5. `review.providers` is not in the page walk - offer it as a final step
   (`Configure review providers now?`) that enters **Review provider setup**.
6. Then run **Worktree base ref** below - a HOST setting, offered only when
   the config now in hand runs plans in parallel worktrees.

### Catalog

The catalog is references/config-catalog.md, read at walk step 2 above.
**Source of truth is `cadence-core/config.schema.json`**, enforced by the
`bin/config.mjs` seam - the catalog is the menu's *presentation layer* (purpose
+ per-value copy) and must stay in sync with the schema's keys/types/enums:
never hand-validate against the catalog; call the seam (see **Validation seam**
below). It is deliberately transcribed, NOT derived from `config.mjs keys`: the
schema carries no per-value explanation field, while the walk above requires
each option to carry its Explanation as the option `description`, so deriving
would drop required copy rather than save bytes.

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
`set` auto-creates. Collect the menu's diffs and apply them with a single `set`
call so the write is one atomic, validated operation.

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
refuses to parallelize there (`references/seam-spawn-agent.md`, Worktree
isolation; Claude Code >= 2.1.208). Inside a worktree, `"head"` means that
worktree's own `HEAD`.

Run this step whenever `parallelization.use_worktrees` is true in the config as
it now stands, WITHOUT also requiring `parallelization.enabled`. Gating it on
`enabled` was circular: the step is what makes `enabled` do anything, so a user
who turned parallelization on by editing config.json directly never reached it
and every run degraded to sequential in silence. Skip the step only when
`use_worktrees` is false, where worktrees genuinely cannot be used.

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

The one configuration question Cadence asks on its own - which of the eight risk
surfaces the blocking `risk_surface` trigger fires on - reached deliberately,
with the evidence beside it, and answerable again after the repository has
changed shape. The first fire asks it once
(`${CLAUDE_PLUGIN_ROOT}/cadence-core/references/risk-surface.md`); this arm
is the way back to it, and re-entering it must never cost the user the answer
they already gave.

1. Read the effective answer through the **Validation seam** (below):

   ```
   node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/config.mjs" get review.triggers.risk_surface.surfaces
   ```

   Never a raw read of `.planning/config.json` for a workflow value - the lone
   exception is the interactive menu's `(current)` label, and this is not it. A
   `null` value means nobody has answered and all eight stand.

2. Scan the structure for what it evidences NOW:

   ```
   node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" detect-surfaces --root . --answered <a,b,c>
   ```

   `--answered` carries step 1's answered set, comma-separated. DROP the flag
   entirely when step 1 returned `null`: the flag's absence is what says nobody
   has answered, and a `--answered` with nothing usable after it is refused.

3. Show the two SIDE BY SIDE before asking anything - the answered set, and each
   category the envelope's `evidenced` names with its `signal` string - and call
   out every evidenced category the answered set does not contain. That gap is
   the whole reason this arm exists: a project that added Stripe six months
   after answering has no other way to see it. When the scan reports
   `inconclusive: true`, say plainly that the structure evidences nothing either
   way rather than reporting it as a clean bill - silence is never absence
   (D-14), and the recommendation stays all eight.

4. Ask through the ask-user seam
   (`${CLAUDE_PLUGIN_ROOT}/cadence-core/references/seam-ask-user.md`),
   rendering the envelope's `options` array in the order it arrives: at most
   four options per
   question, the first labelled `(recommended)`, and that label is a display
   convention and never a pre-selection - the user still chooses and the seam
   still blocks. Each option's own `reason` is what it states beside it, and
   this step composes no options of its own. Carry the LEGEND with the question:
   read the eight one-line category definitions from
   `${CLAUDE_PLUGIN_ROOT}/cadence-core/references/risk-surface.md` and present
   them verbatim as the question's context. This arm is the one a user reaches
   deliberately, so it is the one most likely to be read by someone who does not
   already know what `api_contract` means, and it is the path that passes the
   legend nowhere else. Say plainly that keeping the
   current answer and declining are both valid answers.

5. Write ONLY on an explicit pick, through the **Validation seam**, at the repo
   layer:

   ```
   node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/config.mjs" set 'review.triggers.risk_surface.surfaces=["secrets","destructive"]'
   ```

   A decline calls no `set` and edits no file, so `.planning/config.json` stays
   byte-identical and the existing answer survives. Nothing on this arm writes a
   default and nothing re-asks on its own.

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
This is one of the three raw-read exceptions the **Validation seam** lists, for
the reason it states: `config.mjs get` merges the layers, so it cannot say which
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
  values in force with their layer labels (the walk's two-label rule) and write
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
by the walk's two-label rule - `(current)` when the layer being written already
holds it, `(in force)` when it is inherited, and an inherited option's
`description` opens by saying so.

### 3. The model question, per role

Text: what the role does in the phase loop, then what a stronger or weaker model
buys there. Options, in this order, up to the cap of four:

1. **The value in force**, labelled `(current)` or `(in force)`. When no layer
   sets it, that value is `null` and its description is "no model parameter -
   the dispatch runs at your session's model".
2. `opus` - the strongest and the most expensive per dispatch.
3. `sonnet` - the middle of the three; most work lands here.
4. `haiku` - the cheapest and the weakest.

Never list the value in force twice: whichever of those it already is, the
remaining options fill the slots. `fable` is a fifth name the host accepts and
is deliberately NOT offered outright - name it in the last option's
`description` as reachable via `Other`, with the reason: choosing it is an
assertion about your own organisation (it needs 30-day data retention, and its
classifiers refuse cyber-adjacent review work), not a rung on a ladder.

`Other` is free-typed and goes into config exactly as typed - the key is a
string, not an enum, so nothing rejects a name this host has never heard of.
Echo `config.mjs set`'s `changed` array back to the user, so the exact string
that landed is on screen at the moment it lands rather than at the first
dispatch. A model the host does not accept still resolves `ok:true` and
dispatches with NO model parameter, naming the string in the resolve's
`warnings[]`.

What each role does, for the question text:

- **`cad-planner`** - turns a phase's context into the plan files every executor
  then runs from. Once or twice per phase, and a weak plan is paid for again by
  every dispatch that reads it.
- **`cad-assumptions-analyzer`** - reads a phase's context before any plan
  exists and names what the work is assuming. Once per phase, and the cheapest
  place there is to catch a wrong premise.
- **`cad-verifier`** - the goal-backward pass after a phase, asking whether the
  goal is actually met rather than whether the tasks ran. It runs only when the
  deep pass is on.
- **`cad-reviewer`** - the local reviewer behind every review trigger. The
  most-dispatched role after the executor, so its model moves a cycle's total
  cost more per step than any other.
- **`cad-executor`** - writes the code, one dispatch per plan. The single
  largest spend in a phase.
- **`cad-plan-checker`** - checks a plan against its context before any code is
  written, and only when `workflow.plan_check` is on. Short, structured work.

### 4. The effort question, per role

Text: what the rung buys for this role. The rung is where the role STARTS;
`model.escalate_on_failure` re-dispatches a failed attempt one rung higher,
holding at the top.

Six values - `low`, `medium`, `high`, `xhigh`, `max` and `null` - do not fit the
four-option cap, so this takes exactly the rule the walk already states for
`review.triggers.<t>.gate`: show the rung in force plus the three the user is
most likely to want, and name every omitted rung in the last option's
`description` with the words "reachable via `Other`". A rung silently absent
reads as a rung that does not exist.

`null` is a real answer and means "this key does not pin the rung, so the
schema default decides" - which is how a repo layer un-pins a global one.

### 5. The floor question

One question, and the only one that is not per role. Text: when a phase's plans
declare a file that touches one of your answered risk surfaces, exactly two
things happen - the plan review becomes blocking, and the deep-verify pass runs.
No role's model moves and no role's rung moves; what you just set is what
dispatches. A plan Cadence could not read raises it too, on purpose, because a
scope nobody read has proved nothing.

Carry the eight category definitions from
`${CLAUDE_PLUGIN_ROOT}/cadence-core/references/risk-surface.md` as the
question's context, exactly as **Risk surfaces** does - this is the other arm
where a user meets the category names.

Options:

1. **Keep it for every surface** `(recommended)` - writes nothing, because a
   config with no waiver key is already in that state.
2. **Name surfaces to waive** - writes
   `review.triggers.risk_surface.waive_routing_floor` with the picked
   categories. A surface named there stops making the plan review blocking and
   stops turning the deep pass on, for that surface only. It does NOT turn off
   the `risk_surface` review itself, which still fires on the actual diff and
   which this key cannot reach.

Two of the six roles are unaffected by this answer whatever it is: `cad-planner`
and `cad-assumptions-analyzer` are dispatched before a plan exists, so there is
no plan for the floor to read.

### 6. Writing

Collect every diff and apply it in ONE `config.mjs set` (or `set --global`)
through the **Validation seam** - one atomic, validated write, the same rule the
menu walk follows. Then show the seam's `changed` array back and name the file
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
   files, so the raw read is the job rather than an exception to it.

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

4. Write each layer's own answers through the **Validation seam** -
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
   catalog, and the deep pass now runs when the risk floor raises rather than
   when a level said so, with `workflow.verifier` still its off switch.

## Review provider setup (cold branch)

The assignment flow (detect -> classify -> assign -> write) lives in
`${CLAUDE_PLUGIN_ROOT}/cadence-core/workflows/config-review.md` - Read it and
follow it when `--review` was passed or the user opts in from the menu. It
rejoins here at **Wrap-up**.

## Wrap-up

Summarize the final tier map per provider and note which triggers now have a
cross-model reviewer (a trigger whose `tier` resolves to a non-null id on a
configured reviewer). Remind the user this is re-runnable (`/cad-config
--review`) and is auto-offered when a review fails with a model-not-found /
deprecated error (trouble-triggered redetect, wired in the review dispatch).

**Flag dangling enrollment.** If `review.reviewers` names a cross-model
provider (`openai`/`gemini`) but one or more `review.triggers.<t>.tier`
values resolve to `null` for it (that provider's tier is unassigned), say so
explicitly: the trigger silently falls back to `claude-subagent`, so the
cross-model setup is inert for it. Name the trigger and the empty tier and
offer to assign it or drop the provider from `reviewers`. A config that
enrolls a reviewer it cannot actually reach should never look configured.

## Degradation contract

If detection fails for everything (offline, no keys, rate limited), the review
subsystem still works via `claude-subagent`; consult is simply not offered.
cad-config only ever writes validated ids and never blocks the spine on a
network call.
