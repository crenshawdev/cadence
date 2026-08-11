# The config knob catalog

Read at walk step 2 of `cadence-core/workflows/config.md`'s **Interactive
menu**, which pages through the rows below 4 knobs at a time. Presentation
layer only: the source of truth is `cadence-core/config.schema.json`, enforced
by the `bin/config.mjs` seam. Never hand-validate against this table - call the
seam.

Type key: `bool` = true/false · `int` = free-typed number (Other) · `str|null`
= free-typed string or empty→null · `list` = comma-typed → array · `enum` =
fixed options. `[repo]` = value-set pinned in DESIGN/references; `[proposed]` =
label the executing model honors (membership pinned, behavior not yet wired).
**Purpose** is the question text; each **Value → Explanation** pair is one
selectable option and its `description`.

| Key `[src]` | Type | Purpose (question) | Value → Explanation (option → description) | Default |
|---|---|---|---|---|
| **Core** |||||
| `granularity` `[repo]` | enum | How many phases the roadmap gets - new-project roadmap step only, it splits no phase into tasks | `fine`→8-12 phases · `standard`→5-8 · `coarse`→3-5 | standard |
| **Model** |||||
| `stakes` `[repo]` | enum | What does a break here cost? (routing asks this, not what a dispatch costs) | `solo`→nobody else runs this, a break costs only my time · `shipped`→other people run this, a break comes back as a bug report · `critical`→a break is not a bug report | shipped |
| `model.escalate_on_failure` | bool | Re-dispatch a failed attempt at the role's harder rung | `true`→retry at the rung the role's own cell names · `false`→hold the retry at the rung it started on | true |
| **Workflow** |||||
| `workflow.research` | bool | Run a research pass - new-project research step only | `true`→scout first · `false`→skip | false |
| `workflow.plan_check` | bool | Gate plans through the checker before code | `true`→verify plan first · `false`→trust it | true |
| `workflow.verifier` | bool | Off switch for goal-backward verification after a phase | `true`→the stakes level decides (`--deep` forces) · `false`→always skip | true |
| `workflow.skip_discuss` | bool | Which command `/cad-progress` suggests for an unplanned phase - progress next-step suggestion only, it skips no step | `true`→suggest `/cad-plan` · `false`→suggest `/cad-context` | false |
| `workflow.subagent_timeout` | int | ms before a subagent is killed | e.g. `300000` (5 min) | 300000 |
| `workflow.inline_plan_threshold` | int | Task count at/below which a plan runs inline vs its own doc | e.g. `3` | 3 |
| `workflow.max_plan_tasks` | int | Task count above which a phase plan must return `## PHASE TOO BIG` rather than be written | e.g. `8` | 8 |
| `workflow.test_command` | str\|null | Command Cadence runs to test | shell string, or empty→`null` (none) | null |
| `workflow.lint_command` | str\|null | Command an executor runs for static analysis before it commits - LINT only, there is no typecheck key | shell string, or `null` (none set; the executor detects instead) | null |
| **Parallelization** |||||
| `parallelization.enabled` | bool | Run independent plans concurrently | `true`→parallel · `false`→sequential | true |
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
| **Risk** |||||
| **Review** (providers handled separately) |||||
| `review.reviewers` `[repo]` | list(enum) | Which reviewer backends fire() resolves (multi-select) | `claude-subagent`→local zero-dep · `openai`→cross-model · `gemini`→cross-model · `deepseek`→cross-model | claude-subagent |
| `review.mode` `[repo]` | enum | How multiple reviewers combine | `single`→first available only · `panel`→union all · `adjudicated`→run all, main model grounds each | adjudicated |
| `review.key_file` | str\|null | Path override for the provider key env file | path, or empty→`null` (default location) | null |
| `review.request_timeout_ms` | int | ms before a provider request is aborted | e.g. `540000` (9 min); clamped to the 600000 host ceiling | 540000 |
| `review.max_prompt_tokens` | int | Estimated tokens (chars/4) a review or consult payload may reach | e.g. `120000` (just under the tightest shipped provider window); over-cap is refused before any request, cross-model only | 120000 |
| `review.consult.enabled` | bool | Allow a second-model consult at dead-ends | `true`→offer consult · `false`→don't | false |
| `review.consult.tier` `[repo]` | enum | Model tier for consults | `flagship`→strongest · `balanced`→mid · `cheap`→cheapest | flagship |
| `review.consult.effort` `[repo]` | enum | Reasoning effort for consults | `minimal` · `low` · `medium` · `high` | high |
| `review.consult.attempt_threshold` | int | Failed fix attempts on one bug before cad-debug offers a consult | e.g. `3` | 3 |
| `review.triggers.<t>.gate` `[repo]` | enum | How this trigger gates | `off`→skip · `advisory`→report only · `blocking`→hard stop · `adjudicated`→ground, then present the survivors and ask which to act on (default none) | `adjudicated` for plan/pre_ship · `advisory` for diff/phase_diff · `blocking` for risk_surface |
| `review.triggers.<t>.tier` `[repo]` | enum | Model tier for this trigger - **cross-model only** (the claude-subagent reviewer's model comes from the routing cell) | `flagship` · `balanced` · `cheap` | `flagship`, except `balanced` for diff |
| `review.triggers.<t>.effort` `[repo]` | enum | Reasoning effort for this trigger - **cross-model only** (claude-subagent effort is frontmatter-frozen) | `minimal` · `low` · `medium` · `high` | `high`, except `medium` for diff |

`<t>` ∈ `{plan, diff, risk_surface, phase_diff, pre_ship}` - present the triggers as
their own page (or a "Review triggers?" opt-in step) since they are power knobs.
Every write goes through the **Validation seam** (below); a value outside its set
is rejected, never written.
