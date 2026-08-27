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
- Contains `<key>=<value>` tokens: go to **Direct set**.
- Empty: go to **Interactive menu** - walk every knob as a selectable list.

## Interactive menu (no args)

Goal: let the user adjust every knob the catalog carries, presented as
selectable lists. Four sets stay edit-the-file-only and have no catalog row:
`review.providers.*`, which needs live detection, so the menu routes it to
**Review provider setup** rather than free-typing model ids; the six
`model.overrides` role pins, which override a decision the routing cells
otherwise make; the six `model.effort` per-role start rungs, which override the
other half of that same decision; and `review.decision_review`'s two keys, which
belong to an on-demand command rather than the phase loop.

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
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/config.mjs" get   [key …]       # EFFECTIVE values (repo > global > defaults)
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/config.mjs" keys                # dump schema (types/enums/defaults/purpose)
```

`get` is how every workflow reads config - the only read that sees the global
layer. Never read `.planning/config.json` raw for a value; the lone exception is
the walk's layer labels (step 2), which read it for the LABEL only.

Each prints one JSON line (`{ok, …}`); `--file <path>` overrides the default
`.planning/config.json`, and `--global` targets the user-global layer at
`~/.claude/cadence/config.json` (`CADENCE_GLOBAL_CONFIG` relocates it), which
`set` auto-creates. Collect the menu's diffs and apply them with a single `set`
call so the write is one atomic, validated operation.

**Config layering.** At read time `bin/route.mjs` deep-merges global under repo
(precedence **repo > global > built-in defaults**); nested objects merge, arrays
replace wholesale. Each file is still validated on its own - every layer must be
independently valid. Use `--global` for machine-wide defaults (e.g. a preferred
`stakes` level) and the per-repo file to override per project.

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
