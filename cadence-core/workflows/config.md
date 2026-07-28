# cad-config workflow

Configure `.planning/config.json`. Canonical shape and validation live in
`cadence-core/config.schema.json` (the source of truth), enforced by the
`bin/config.mjs` seam; `cadence-core/templates/config.json` is the scaffolded
default. One interactive skill; the substantive part is review-provider model
assignment, which is the only config knob that needs live detection rather than
a plain edit.

## 0. Locate config

Read `.planning/config.json`. If it is absent, this project has no config yet
(`cad-new-project` writes one). Offer to copy the template into place; stop if
the user declines.

## 1. Route

Parse `$ARGUMENTS`:
- Starts with `--review`: go to **Review provider setup** (a trailing
  `redetect` just means re-run detection and reassign; same flow).
- Contains `<key>=<value>` tokens: go to **Direct set**.
- Empty: go to **Interactive menu** - walk every knob as a selectable list.

## Interactive menu (no args)

Goal: let the user adjust **every** knob, presented as selectable lists - no
knob is edit-the-file-only. `review.providers.*` is the one exception: it needs
live detection, so the menu routes it to **Review provider setup** rather than
free-typing model ids.

### The walk

1. Read the current config. Show a one-screen summary (each knob = current value).
2. Walk the catalog below **in order, 4 knobs per `AskUserQuestion` call** (the
   ask-user seam; its 4-option cap is why we page). For each knob:
   - one question; its text = the knob's **Purpose**, options = the knob's Values,
   - **each option carries its Explanation as the option `description`** (the small
     line shown under the option in the selection list),
   - **preselect the option matching the repo file's OWN literal value** (from
     the step-0 raw read of `.planning/config.json`, never `config.mjs get`:
     `get` returns the *effective* value, so a knob inherited from the global
     layer would show as `(current)` and get pinned into the repo file as if
     chosen). A knob absent from the repo file gets NO `(current)` label - show
     its effective/default value unlabelled, so leaving the page unchanged keeps
     it inherited rather than writing it. List the preselected option first, e.g.
     `standard (current)`,
   - `Other` (auto-added) is the free-type entry for numbers, strings, and lists.
3. A page whose knobs the user leaves unchanged is a no-op; only diffs are applied.
4. After the last page, show the changed keys as a diff and write once via the
   **Validation seam** (`config.mjs set`) - one atomic, validated write. The user
   may pick `Skip rest` on any page to stop and write what changed so far.
5. `review.providers` is not in the page walk - offer it as a final step
   (`Configure review providers now?`) that enters **Review provider setup**.
6. Then run **Worktree base ref** below - a HOST setting, offered only when
   the config now in hand runs plans in parallel worktrees.

### Catalog

**Source of truth is `cadence-core/config.schema.json`**, enforced by the
`bin/config.mjs` seam - this table is the menu's *presentation layer* (purpose +
per-value copy) and must stay in sync with the schema's keys/types/enums. Never
hand-validate against this table; call the seam (see **Validation seam** below).

Type key: `bool` = true/false · `int` = free-typed number (Other) · `str|null`
= free-typed string or empty→null · `list` = comma-typed → array · `enum` =
fixed options. `[repo]` = value-set pinned in DESIGN/references; `[proposed]` =
label the executing model honors (membership pinned, behavior not yet wired).
**Purpose** is the question text; each **Value → Explanation** pair is one
selectable option and its `description`.

| Key `[src]` | Type | Purpose (question) | Value → Explanation (option → description) | Default |
|---|---|---|---|---|
| **Core** |||||
| `granularity` `[repo]` | enum | How finely phases split into tasks (new-project phase count) | `fine`→8-12 phases · `standard`→5-8 · `coarse`→3-5 | standard |
| **Model** |||||
| `model.profile` `[repo]` | enum | Model routing for agents (see `route-table.json`) | `fast`→cheapest/quickest · `balanced`→default mix · `quality`→strongest · `auto`→role + difficulty, escalate on failure | balanced |
| `model.auto.ceiling` `[repo]` | enum | Highest profile `auto` escalation may reach | `fast` · `balanced` · `quality` (caps the escalation) | quality |
| `model.auto.escalate_on_failure` | bool | Bump the tier after a failed attempt | `true`→retry stronger · `false`→stay put | true |
| `model.auto.max_escalations` | int | How many times to escalate before giving up | `0`–`3` | 1 |
| **Workflow** |||||
| `workflow.research` | bool | Run a research pass before planning | `true`→scout first · `false`→skip | false |
| `workflow.plan_check` | bool | Gate plans through the checker before code | `true`→verify plan first · `false`→trust it | true |
| `workflow.verifier` | bool | Goal-backward verification after a phase | `true`→check goal was met · `false`→skip | true |
| `workflow.skip_discuss` | bool | Skip the pre-plan discussion step entirely | `true`→straight to plan · `false`→discuss | false |
| `workflow.subagent_timeout` | int | ms before a subagent is killed | e.g. `300000` (5 min) | 300000 |
| `workflow.inline_plan_threshold` | int | Task count at/below which a plan runs inline vs its own doc | e.g. `3` | 3 |
| `workflow.test_command` | str\|null | Command Cadence runs to test | shell string, or empty→`null` (none) | null |
| **Parallelization** |||||
| `parallelization.enabled` | bool | Run independent plans concurrently | `true`→parallel · `false`→sequential | false |
| `parallelization.max_concurrent_agents` | int | Cap on simultaneous agents | e.g. `3` | 3 |
| `parallelization.min_plans_for_parallel` | int | Min plans before going parallel | e.g. `2` | 2 |
| `parallelization.use_worktrees` | bool | Isolate parallel writes in git worktrees | `true`→isolate · `false`→shared tree | true |
| **Git** |||||
| `git.protected_branches` | list | Branches Cadence won't commit to directly | comma list, e.g. `main, master` | main, master |
| `git.on_protected` `[repo]` | enum | What to do on a protected branch | `ask`→prompt · `refuse`→block · `allow`→proceed | ask |
| `git.integration_branch` `[repo]` | enum | Two-tier branch model at cycle start | `milestone`→create a per-milestone integration branch (the branch worktrees merge back into; where they fork FROM is the host's `worktree.baseRef`) · `trunk`→no integration branch, commit on the base under `on_protected` | milestone |
| `git.auto_branch` `[repo]` | enum | How the integration branch is created at cycle start | `ask`→prompt once · `auto`→create/switch silently · `off`→stay put | ask |
| `git.base_branch` | str\|null | Branch new work branches off | branch name, or empty→`null` (current) | null |
| `git.create_tag` | bool | Tag on milestone | `true`→tag · `false`→don't | true |
| `git.on_land_cleanup` | bool | After a land/merge, return to base, pull, reap the merged integration branch? | `true`→return + pull + reap · `false`→leave in place | true |
| `git.auto_close` | bool | Run the close end-to-end (audit → tag → PR → merge → reset) with no per-step prompts? | `true`→autonomous close, halting on a blocking `pre_ship` FAIL · `false`→publish stays the user's separate call | false |
| **Planning** |||||
| `planning.commit_docs` | bool | Commit `.planning` docs alongside code | `true`→track docs · `false`→leave untracked | true |
| **Memory** |||||
| `memory.backend` `[repo]` | enum | Backend for recall over `.planning/` | `builtin`→zero-dep BM25 recall over `.planning/` · `none`→recall off | builtin |
| **Review** (providers handled separately) |||||
| `review.reviewers` `[repo]` | list(enum) | Which reviewer backends fire() resolves (multi-select) | `claude-subagent`→local zero-dep · `openai`→cross-model · `gemini`→cross-model | claude-subagent |
| `review.mode` `[repo]` | enum | How multiple reviewers combine | `single`→first available only · `panel`→union all · `adjudicated`→run all, main model grounds each | adjudicated |
| `review.key_file` | str\|null | Path override for the provider key env file | path, or empty→`null` (default location) | null |
| `review.request_timeout_ms` | int | ms before a provider request is aborted | e.g. `540000` (9 min); clamped to the 600000 host ceiling | 540000 |
| `review.consult.enabled` | bool | Allow a second-model consult at dead-ends | `true`→offer consult · `false`→don't | false |
| `review.consult.tier` `[repo]` | enum | Model tier for consults | `flagship`→strongest · `balanced`→mid · `cheap`→cheapest | flagship |
| `review.consult.effort` `[repo]` | enum | Reasoning effort for consults | `minimal` · `low` · `medium` · `high` | high |
| `review.consult.attempt_threshold` | int | Failed fix attempts on one bug before cad-debug offers a consult | e.g. `3` | 3 |
| `review.triggers.<t>.gate` `[repo]` | enum | How this trigger gates | `off`→skip · `advisory`→report only · `blocking`→hard stop · `adjudicated`→ground then hand off | per §7 |
| `review.triggers.<t>.tier` `[repo]` | enum | Model tier for this trigger | `flagship` · `balanced` · `cheap` | per §7 |
| `review.triggers.<t>.effort` `[repo]` | enum | Reasoning effort for this trigger | `minimal` · `low` · `medium` · `high` | per §7 |

`<t>` ∈ `{plan, diff, risk_surface, phase_diff, pre_ship}` - present the triggers as
their own page (or a "Review triggers?" opt-in step) since they are power knobs.
Every write goes through the **Validation seam** (below); a value outside its set
is rejected, never written.

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

`get` is how every workflow reads config - it is the only read that sees the
global layer. Never read `.planning/config.json` raw for a value. (Lone
exception: the interactive menu's `(current)` label needs the repo layer's
literal value to avoid pinning an inherited global, so it reads the repo file raw
for the label only - never for a workflow value.)

Each prints one JSON line (`{ok, …}`); `--file <path>` overrides the default
`.planning/config.json`, and `--global` targets the user-global layer at
`~/.claude/cadence/config.json` (`CADENCE_GLOBAL_CONFIG` relocates it), which
`set` auto-creates. Collect the menu's diffs and apply them with a single `set`
call so the write is one atomic, validated operation.

**Config layering.** At read time `bin/route.mjs` deep-merges global under repo
(precedence **repo > global > built-in defaults**); nested objects merge, arrays
replace wholesale. Each file is still validated on its own - every layer must be
independently valid. Use `--global` for machine-wide defaults (e.g. a preferred
`model.profile`) and the per-repo file to override per project.

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
refuses to parallelize there (`references/seams.md`, Worktree isolation;
Claude Code >= 2.1.208). Inside a worktree, `"head"` means that worktree's own
`HEAD`.

Run this step when `parallelization.enabled` and `parallelization.use_worktrees`
are both true in the config as it now stands (so a value just flipped in the
walk counts); otherwise skip it silently - the setting is inert for a
sequential project.

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
