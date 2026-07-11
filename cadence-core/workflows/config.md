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
   - **preselect the option matching the file's current value** (list it first,
     labelled e.g. `standard (current)`),
   - `Other` (auto-added) is the free-type entry for numbers, strings, and lists.
3. A page whose knobs the user leaves unchanged is a no-op; only diffs are applied.
4. After the last page, show the changed keys as a diff and write once via the
   **Validation seam** (`config.mjs set`) - one atomic, validated write. The user
   may pick `Skip rest` on any page to stop and write what changed so far.
5. `review.providers` is not in the page walk - offer it as a final step
   (`Configure review providers now?`) that enters **Review provider setup**.

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
| `mode` `[repo]` | enum | How the loop runs | `interactive`→stop at gates for your input (only value; `autonomous`/`audit-fix` cut, DESIGN:111) | interactive |
| `granularity` `[repo]` | enum | How finely phases split into tasks (new-project phase count) | `fine`→8-12 phases · `standard`→5-8 · `coarse`→3-5 | standard |
| `context_window` | int | Model context budget (tokens) used for chunking | any token count, e.g. `200000`, `1000000` | 1000000 |
| **Model** |||||
| `model.profile` `[repo]` | enum | Model routing for agents (see `route-table.json`) | `fast`→cheapest/quickest · `balanced`→default mix · `quality`→strongest · `auto`→role + difficulty, escalate on failure | balanced |
| `model.auto.ceiling` `[repo]` | enum | Highest profile `auto` escalation may reach | `fast` · `balanced` · `quality` (caps the escalation) | quality |
| `model.auto.escalate_on_failure` | bool | Bump the tier after a failed attempt | `true`→retry stronger · `false`→stay put | true |
| `model.auto.max_escalations` | int | How many times to escalate before giving up | `0`–`3` | 1 |
| **Workflow** |||||
| `workflow.research` | bool | Run a research pass before planning | `true`→scout first · `false`→skip | false |
| `workflow.plan_check` | bool | Gate plans through the checker before code | `true`→verify plan first · `false`→trust it | true |
| `workflow.verifier` | bool | Goal-backward verification after a phase | `true`→check goal was met · `false`→skip | true |
| `workflow.auto_advance` | bool | Roll into the next phase without asking | `true`→continue · `false`→pause | false |
| `workflow.discuss_mode` `[repo]` | enum | Pre-plan discussion (3 gates collapsed to 1) | `discuss`→the one discussion gate (only value; use `skip_discuss` to disable) | discuss |
| `workflow.skip_discuss` | bool | Skip the discussion step entirely | `true`→straight to plan · `false`→discuss | false |
| `workflow.human_verify_mode` `[proposed]` | enum | When you're asked to UAT | `end-of-phase`→once per phase · `per-task`→each task · `off`→never | end-of-phase |
| `workflow.subagent_timeout` | int | ms before a subagent is killed | e.g. `300000` (5 min) | 300000 |
| `workflow.inline_plan_threshold` | int | Task count at/below which a plan runs inline vs its own doc | e.g. `3` | 3 |
| `workflow.test_command` | str\|null | Command Cadence runs to test | shell string, or empty→`null` (none) | null |
| `workflow.build_command` | str\|null | Command Cadence runs to build | shell string, or empty→`null` (none) | null |
| **Parallelization** |||||
| `parallelization.enabled` | bool | Run independent plans concurrently | `true`→parallel · `false`→sequential | false |
| `parallelization.max_concurrent_agents` | int | Cap on simultaneous agents | e.g. `3` | 3 |
| `parallelization.min_plans_for_parallel` | int | Min plans before going parallel | e.g. `2` | 2 |
| `parallelization.use_worktrees` | bool | Isolate parallel writes in git worktrees | `true`→isolate · `false`→shared tree | true |
| **Git** |||||
| `git.protected_branches` | list | Branches Cadence won't commit to directly | comma list, e.g. `main, master` | main, master |
| `git.on_protected` `[repo]` | enum | What to do on a protected branch | `ask`→prompt · `refuse`→block · `allow`→proceed | ask |
| `git.base_branch` | str\|null | Branch new work branches off | branch name, or empty→`null` (current) | null |
| `git.auto_push` | bool | Push after committing | `true`→push · `false`→local only | false |
| `git.create_tag` | bool | Tag on milestone | `true`→tag · `false`→don't | true |
| **Planning** |||||
| `planning.commit_docs` | bool | Commit `.planning` docs alongside code | `true`→track docs · `false`→leave untracked | true |
| **Search** |||||
| `search.brave_search` | bool | Enable Brave web-search provider | `true`→on · `false`→off | false |
| `search.firecrawl` | bool | Enable Firecrawl provider | `true`→on · `false`→off | false |
| `search.exa_search` | bool | Enable Exa provider | `true`→on · `false`→off | false |
| **Memory** |||||
| `memory.backend` `[repo]` | enum | Where notes/observations route | `none`→off (only value wired today) | none |
| **Review** (providers handled separately) |||||
| `review.reviewers` `[repo]` | list(enum) | Which reviewer backends fire() resolves (multi-select) | `claude-subagent`→local zero-dep · `openai`→cross-model · `gemini`→cross-model | claude-subagent |
| `review.mode` `[repo]` | enum | How multiple reviewers combine | `single`→first available only · `panel`→union all · `adjudicated`→run all, main model grounds each | adjudicated |
| `review.key_file` | str\|null | Path override for the provider key env file | path, or empty→`null` (default location) | null |
| `review.consult.enabled` | bool | Allow a second-model consult at dead-ends | `true`→offer consult · `false`→don't | false |
| `review.consult.tier` `[repo]` | enum | Model tier for consults | `flagship`→strongest · `balanced`→mid · `cheap`→cheapest | flagship |
| `review.consult.effort` `[repo]` | enum | Reasoning effort for consults | `minimal` · `low` · `medium` · `high` | high |
| `review.triggers.<t>.gate` `[repo]` | enum | How this trigger gates | `off`→skip · `advisory`→report only · `blocking`→hard stop · `adjudicated`→ground then hand off | per §7 |
| `review.triggers.<t>.tier` `[repo]` | enum | Model tier for this trigger | `flagship` · `balanced` · `cheap` | per §7 |
| `review.triggers.<t>.effort` `[repo]` | enum | Reasoning effort for this trigger | `minimal` · `low` · `medium` · `high` | per §7 |

`<t>` ∈ `{plan, diff, risk_surface, pre_ship}` - present the four triggers as
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
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/config.mjs" keys                # dump schema (types/enums/defaults/purpose)
```

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

For each `key=value` (dotted paths allowed, e.g. `workflow.plan_check=false`):
- Validate and write in one shot through the **Validation seam**:
  `config.mjs set <key=value>…`. It rejects an unknown key or bad value
  (`{ok:false, reason:"invalid", detail:[…]}`) atomically - nothing is written
  unless every pair is valid - and echoes `{ok:true, changed:[…]}` on success.
- On rejection, surface the seam's `detail` (the invalid keys and why) and the
  allowed values from `config.mjs keys`; do not retry with a malformed config.

## Review provider setup (the assignment flow)

Goal: fill `review.providers.<name>.tiers.{flagship,balanced,cheap}` with real
detected model ids, per DESIGN §6's three-layer detection (live list ->
classify known ids -> assign per position). Model ids are never hardcoded; they
come from the provider.

Run this for each provider under `review.providers` (openai, gemini):

### 1. Detect

Invoke the call-review-provider seam (this is the only place a provider call
happens):

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/review-provider.mjs" detect-models \
  --provider <name> [--key-file <review.key_file, only if set>]
```

Parse the single JSON line on stdout.

### 2. Handle the result

- `ok:false, reason:"no-key"`: report where to set the key (the `detail` field
  names `env $OPENAI_API_KEY` / `$GEMINI_API_KEY` or the providers.env path).
  Mark this provider unconfigured and move to the next - never block, since
  `claude-subagent` is the always-available fallback.
- `ok:false, reason:"transport"|"http"`: report `detail`. Offer (ask-user seam)
  `[Retry detection | Enter model ids manually | Skip this provider]`. Degrade,
  do not block setup on a network failure.
- `ok:true`: continue with `models[]` - each entry is `{id, tier, high_effort}`
  where `tier` is `flagship|balanced|cheap` for known ids or `null` for unknown
  ones (unknowns are still selectable; the user places them).

### 3. Assign

Ask the user (ask-user seam) which mode:

- **"You decide"** (default, low friction): auto-map each position to the best
  classified candidate -
  - `flagship` <- a `tier:"flagship"` id, preferring `high_effort:true`
  - `balanced` <- a `tier:"balanced"` id
  - `cheap` <- a `tier:"cheap"` id

  If a position has no classified candidate, leave it `null` and flag it. Show
  the proposed three-line mapping and offer `[Accept all | Adjust a position]`.
  On adjust, drill into that one position using the manual picker below.

- **"Manual"**: for each of the three positions, present the detected
  candidates (`id` + tier hint, most-relevant first) as choices, plus an
  `Other` option for a free-typed id. Unknown-tier ids may be assigned to any
  position.

### 4. Write

Write the chosen ids through the **Validation seam**, one `set` per provider so a
mid-flow stop still persists what was decided:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/config.mjs" set \
  'review.providers.<name>.tiers.flagship=<id>' \
  'review.providers.<name>.tiers.balanced=<id>' \
  'review.providers.<name>.tiers.cheap=<id>'
```

A position with no suitable model stays `null` (omit that pair) - triggers that
map to that tier fall back to `claude-subagent` until it is assigned. Once a
provider has assigned tiers, add its name to `review.reviewers` (e.g.
`set 'review.reviewers=["claude-subagent","openai"]'`) so `fire()` actually
resolves it - assignment alone does not enroll a reviewer.

## Wrap-up

Summarize the final tier map per provider and note which triggers now have a
cross-model reviewer (a trigger whose `tier` resolves to a non-null id on a
configured reviewer). Remind the user this is re-runnable (`/cad-config
--review`) and is auto-offered when a review fails with a model-not-found /
deprecated error (trouble-triggered redetect, wired in the review dispatch).

## Degradation contract

If detection fails for everything (offline, no keys, rate limited), the review
subsystem still works via `claude-subagent`; consult is simply not offered.
cad-config only ever writes validated ids and never blocks the spine on a
network call.
