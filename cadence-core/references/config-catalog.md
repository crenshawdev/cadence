# The config knob catalog

Read at walk step 2 of `cadence-core/workflows/config.md`'s **Interactive
menu**, which pages through the rows below 4 knobs at a time. Presentation
layer only: the source of truth is `cadence-core/config.schema.json`, enforced
by the `bin/config.mjs` seam. Never hand-validate against this table - call the
seam.

Type key: `bool` = true/false · `int` = free-typed number (Other) · `str|null`
= free-typed string or empty→null · `list` = comma-typed → array · `enum` =
fixed options. The `[src]` marker is CONFIG-LAYER SCOPE: `[repo]` = settable in
either layer; `[global]` = the user-global layer only, and a repo layer setting
it is stripped at the merge and named in the read face's warnings; no marker =
repo-settable. `[repo-layer-only]` is a DIFFERENT marker from `[repo]` and not
a stronger reading of it: `bin/config.mjs set` REFUSES that key at the
user-global layer, because a user-global value cannot authorize a change to the
one repository that has to honour it. **Purpose** is the question text; each **Value → Explanation**
pair is one selectable option and its `description`.

| Key `[src]` | Type | Purpose (question) | Value → Explanation (option → description) | Default |
|---|---|---|---|---|
| **Core** |||||
| `granularity` `[repo]` | enum | How many phases the roadmap gets - new-project roadmap step only, it splits no phase into tasks | `fine`→8-12 phases · `standard`→5-8 · `coarse`→3-5 | standard |
| **Model** |||||
| `stakes` `[repo]` | enum | How bad is it if something here breaks? | `solo`→just me - a break costs my own time · `shipped`→other people run this - a break comes back as a bug report · `critical`→a break costs more than a bug report: money, security, safety or data loss | shipped |
| `model.escalate_on_failure` | bool | Re-dispatch a failed attempt at the role's harder rung | `true`→retry at the rung the role's own cell names · `false`→hold the retry at the rung it started on | false |
| **Workflow** |||||
| `workflow.research` | bool | Run a research pass - new-project research step only | `true`→scout first · `false`→skip | false |
| `workflow.plan_check` | bool | Gate plans through the checker before code | `true`→verify plan first · `false`→trust it | false |
| `workflow.verifier` | bool | Off switch for goal-backward verification after a phase | `true`→the stakes level decides (`--deep` forces) · `false`→always skip | true |
| `workflow.skip_discuss` | bool | Which command `/cad-progress` suggests for an unplanned phase - progress next-step suggestion only, it skips no step | `true`→suggest `/cad-plan` · `false`→suggest `/cad-context` | false |
| `workflow.inline_plan_threshold` | int | Task count at/below which a plan runs inline vs its own doc | e.g. `3` | 3 |
| `workflow.max_plan_tasks` | int | Task ceiling PER PLAN; a phase needing more capacity gets more plans, sequential where they share files. Counted at `check_size` by `planning.mjs plan-size`. Re-decided 2026-08-17 against both of its forces and landing on 8, unchanged: cold-prefix cost (the executor's fixed dispatch prefix is 12,488 bytes, about 2% of a measured executor dispatch, so an extra plan re-buys the cold pass rather than the prefix) and context risk (15 executor checkpoints of 21 in `.planning/trace.jsonl`, every one from a plan already under this ceiling); dated arithmetic in `design-notes/dd-plan-task-ceiling.md` | e.g. `8` | 8 |
| `workflow.test_command` `[global]` | str\|null | Command Cadence runs to test - set it in the user-global layer, a repo layer's value is ignored | shell string, or empty→`null` (none) | null |
| `workflow.lint_command` `[global]` | str\|null | Command an executor runs for static analysis before it commits - LINT only, there is no typecheck key; set it in the user-global layer, a repo layer's value is ignored | shell string, or `null` (none set; the executor detects instead) | null |
| **Parallelization** |||||
| `parallelization.enabled` | bool | Run independent plans concurrently | `true`→parallel · `false`→sequential | true |
| `parallelization.max_concurrent_agents` | int | Cap on simultaneous agents | e.g. `3` | 3 |
| `parallelization.min_plans_for_parallel` | int | Min plans before going parallel | e.g. `2` | 2 |
| `parallelization.use_worktrees` | bool | Isolate parallel writes in git worktrees | `true`→isolate · `false`→shared tree | true |
| **Git** |||||
| `git.protected_branches` | list | Branches Cadence won't commit to directly | comma list, e.g. `main, master` | main, master |
| `git.on_protected` `[repo]` | enum | What to do on a protected branch | `ask`→prompt · `refuse`→block · `allow`→proceed | ask |
| `git.integration_branch` `[repo]` | enum | Where a cycle's commits land | `milestone`→one shared branch per milestone that every plan's work merges into · `trunk`→no shared branch, commit straight onto the base branch | milestone |
| `git.auto_branch` `[repo]` | enum | How the integration branch is created at cycle start | `ask`→prompt once · `auto`→create/switch silently · `off`→stay put | ask |
| `git.base_branch` | str\|null | Branch new work branches off | branch name, or empty→`null` (current) | null |
| `git.create_tag` | bool | At the end of a land, cut the release tag on the pulled base once the merge confirms? | `true`→tag · `false`→don't | true |
| `git.on_land_cleanup` | bool | After a land/merge, return to base, pull, reap the merged integration branch? | `true`→return + pull + reap · `false`→leave in place | true |
| `git.issue_check` | bool | When a land starts, show which issues this branch's commits mention and which are still open? | `true`→show it, read-only, and say in one line when the tracker cannot be reached · `false`→skip it, and never call the hosting CLI | true |
| `git.forge_provider` | enum | Which forge hosts this repository's issue tracker? Asked once at project setup, then read instead of guessing from the remote | `forgejo`→a Forgejo/Gitea instance, driven by `tea` · `github`→driven by `gh` · `gitlab`→driven by `glab` · empty→`null` (not asked yet) | null |
| `git.forge_repo` `[repo-layer-only]` | str\|null | Which repository on that forge - the `owner/name` slug every forge call addresses | `owner/name`, or empty→`null` (not asked yet) | null |
| `git.forge_host` | str\|null | Which Forgejo instance serves it - the host you reach in a browser, never read off the remote URL | hostname, or empty→`null` (not asked yet, and always null on `github` and `gitlab`) | null |
| `git.auto_close` `[repo-layer-only]` | bool | Run the whole close unattended (audit → tag → PR → merge → reset) with no prompts? | `true`→run it start to finish, stopping only if a serious review finding is still unresolved · `false`→stop before publishing - you run `/cad-land` yourself | false |
| **Planning** |||||
| `planning.commit_docs` | bool | Commit `.planning` docs alongside code | `true`→track docs · `false`→leave untracked | true |
| `planning.max_capture_bullets` | int | How many live items may sit in `.planning/CAPTURE.md` before Cadence says the queue has stopped being the phase in flight? A crossing is reported by `planning.mjs capture-check` and nothing is refused - filing never stops. The default sits above this repository's own 30 (measured 2026-08-25), so it fires on growth rather than on arrival | e.g. `40` | 40 |
| **Memory** |||||
| `memory.backend` `[repo]` | enum | How past planning notes are searched and resurfaced | `builtin`→built-in search over your `.planning/` docs, no setup and no dependencies · `none`→turn that search off | builtin |
| **Review** (providers handled separately) |||||
| `review.reviewers` `[repo]` | list(enum) | Which reviewers should run? (pick any number) | `claude-subagent`→runs locally, needs no API key · `openai`→a second model, needs a key · `gemini`→a second model, needs a key · `deepseek`→a second model, needs a key | claude-subagent |
| `review.mode` `[repo]` | enum | When several reviewers are on, how are their findings combined? | `single`→use only the first reviewer that is available · `panel`→report every finding from all of them · `adjudicated`→run all, then have the main model check each finding against the code and drop the ones that do not hold | adjudicated |
| `review.key_file` `[global]` | str\|null | Path override for the provider key env file - set it in the user-global layer, a repo layer's value is ignored | path, or empty→`null` (default location) | null |
| `review.request_timeout_ms` | int | ms before a provider request is aborted | e.g. `540000` (9 min); clamped to the 600000 host ceiling | 540000 |
| `review.max_prompt_tokens` | int | Estimated tokens (chars/4) a review or consult payload may reach | e.g. `120000` (just under the tightest shipped provider window); over-cap is refused before any request, cross-model only | 120000 |
| `review.consult.enabled` | bool | Allow a second-model consult at dead-ends | `true`→offer consult · `false`→don't | false |
| `review.consult.tier` `[repo]` | enum | Model tier for consults | `flagship`→strongest · `balanced`→mid · `cheap`→cheapest | flagship |
| `review.consult.effort` `[repo]` | enum | Reasoning effort for consults | `minimal` · `low` · `medium` · `high` | high |
| `review.consult.attempt_threshold` | int | Failed fix attempts on one bug before cad-debug offers a consult | e.g. `3` | 3 |
| `review.triggers.<t>.gate` `[repo]` | enum | When this review runs, what should happen to what it finds? | `off`→do not run it · `advisory`→run it and just report what it finds · `deferred`→run it, save the findings, and let the work continue - `/cad-land` refuses to publish until you rule on them · `blocking`→run it and stop the work until the findings are dealt with · `adjudicated`→run it, check each finding against the code, then show you the ones that hold and ask which to act on (nothing is preselected) | unset→the stakes level decides, per trigger (`route.mjs resolve` answers it) |
| `review.triggers.<t>.tier` `[repo]` | enum | Model tier for this trigger - **cross-model only** (the claude-subagent reviewer's model comes from the routing cell) | `flagship` · `balanced` · `cheap` | unset→the stakes level decides, per trigger (`route.mjs resolve` answers it) |
| `review.triggers.<t>.effort` `[repo]` | enum | Reasoning effort for this trigger - **cross-model only** (claude-subagent effort is frontmatter-frozen) | `minimal` · `low` · `medium` · `high` | unset→the stakes level decides, per trigger (`route.mjs resolve` answers it) |
| `review.triggers.risk_surface.surfaces` `[repo]` | list(enum) | Which kinds of risky code get the blocking review (risk_surface only) | picking this opens **Risk surfaces** (`/cad-config --surfaces`), which scans your project first and offers answers based on what it finds, instead of asking you to type a list blind | unset→all eight, and the first fire asks once |
| `review.triggers.risk_surface.waive_routing_floor` `[repo]` | list(enum) | Which risky-code categories should stop bumping a plan up to a stronger model? (risk_surface only) - this changes the model only; the blocking review still runs either way | `auth`, `migrations`, `billing`, `concurrency`, `destructive`, `secrets`, `api_contract`, `untrusted_input` - the same eight as `surfaces`, listed because this row is where a reader meets them. A category you pick here holds the plan at your normal `stakes` level and no lower; one you leave out still bumps it up. Every category actually waived is named in the routing decision's `reason` | unset→nothing is waived |

`<t>` ∈ `{plan, diff, risk_surface, phase_diff}` - present the triggers as
their own page (or a "Review triggers?" opt-in step) since they are power knobs.
Every write goes through the **Validation seam** (below); a value outside its set
is rejected, never written.
