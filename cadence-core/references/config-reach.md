# Config-key reach grammar

The stated grammar for `cadence-core/references/config-reach.md` - this file.
It answers one question for every key in `cadence-core/config.schema.json`:
**where does this value actually reach?** A key whose answer is narrower than
its `purpose` admits is the defect this table exists to make impossible to add
silently - a value the user sets, Cadence resolves, carries down the dispatch
path, and then throws away with nothing said (CFG-01, the shape `#64` closed
for per-trigger `effort`).

The single implementation is `parseReachTable` / `reachIssues` in
`cadence-core/bin/lib/config-reach.mjs`, called by check 9 of
`cadence-core/bin/self-verify.mjs`. Row-by-row test cases live in
`cadence-core/bin/self-verify.test.mjs`.

## What the check proves, and what it does not

It proves the reach table and the schema agree **with each other**:

- every schema key has a row here,
- every row here names a real schema key,
- and a row whose reach is narrower than `universal` says so in that key's own
  `purpose`, where a user setting the value will read it.

It does **not** prove either document agrees with the code. A key whose real
reader is narrower than both say so is invisible to this check - that judgment
is the human test below, and it is the accepted cost of a table over a `reach`
field on every key. What the pair buys is that a NEW key cannot arrive
silently: adding one to the schema fails CI until someone answers the reach
question for it in writing.

## The test a human applies when adding a key

Ask both halves:

1. Is there a configuration in which this value is resolved and then not
   honoured - a backend, an arm, or a path that reads it for one caller and
   drops it for another?
2. Is the reader narrower than the plain reading of the `purpose` - one
   workflow, one step, one command, rather than "whenever this applies"?

If either is yes, the reach is that narrower thing, the row says so, and the
key's `purpose` must carry the same phrase verbatim. If both are no, the reach
is `universal`.

The phrase is compared literally (backticks stripped, whitespace collapsed),
so a reach and a `purpose` are kept in one vocabulary rather than two
paraphrases. The phrases in use today:

- `cross-model reviewers only`
- `cross-model provider calls only`
- `new-project roadmap step only`
- `new-project research step only`
- `progress next-step suggestion only`
- `repo config layer only`
- `repo config layer only for the unattended publish`
- `user-global config layer only`

Nothing machine-checks this list against the rows, so it is a reading aid: the
rows below are the declaration. Deliberately unenumerated - a stated count has
now gone stale twice in two phases, each time in the same commit that added a
phrase, and a wrong count reads as authority where a missing one reads as a
list to check.

## Row grammar

Rows live under the `## Reach rows` heading below, bounded at the next `## `
heading like every other section parser in this repo - so this heading is last
in the file and nothing after it exists to be misread. A body row is a line
starting with `|`; the header row (first cell exactly `Key`) and the delimiter
row declare nothing. Cells are read backticks-stripped and whitespace-collapsed.
First occurrence of a key wins.

Columns are `Key | Reach | Honoured by`. `Key` is the schema key verbatim.
`Reach` is either the literal `universal` or the narrower phrase. `Honoured by`
is prose naming the consumer; it is **not** machine-checked, and is here so a
reader can go straight to the reader rather than grep for it.

The sentinel `universal` is read case-insensitively and with one optional
trailing period, so `Universal` and `universal.` declare exactly what
`universal` does. A NARROWER phrase is compared verbatim, in both directions -
that literal comparison is what keeps a row and a `purpose` in one vocabulary
instead of two paraphrases, so folding the narrow half would defeat the row.

### The forms this grammar does not read

| Code | Example | What the check does with it | Fix |
|---|---|---|---|
| `missing-reach-section` | the `## Reach rows` heading is absent or renamed | reported once, naming the heading; no rows are read and no key is reported missing | restore the heading |
| `malformed-reach-row` | `\| granularity \|` (two cells), or a row with an empty Key or Reach cell | reported with the line number and the line, and declares no row | write all three cells |
| `missing-reach-row` | a schema key no row names | reported, naming the key | add a row and answer the test above |
| `unknown-reach-key` | `\| frobnicate.enabled \| universal \| ... \|` | reported, naming the key | delete the row, or fix the typo; a retired key keeps no row |
| `unstated-reach` | a row reading `cross-model reviewers only` whose key's `purpose` never says so | reported, naming the key | put the phrase in the `purpose`, verbatim - that is the whole point of the row |
| `duplicate-reach-row` | a second row for a key an earlier row already declared | reported, naming the key and BOTH lines; the first occurrence still wins and the later row declares nothing | edit the existing row rather than appending a new one, then delete the duplicate |

Narrowing a key by appending a row rather than editing the old one is the
authoring mistake that motivates the last code: the stale row wins, so the
purpose test runs against the reach the author just replaced.

## Reach rows

| Key | Reach | Honoured by |
|---|---|---|
| `granularity` | new-project roadmap step only | `workflows/new-project.md` step 2 of the roadmap draft, as a phase count |
| `stakes` | universal | `bin/route.mjs` - picks the row of every cell grid |
| `model.escalate_on_failure` | universal | `bin/route.mjs` - whether a failed attempt climbs to the cell's retry rung |
| `model.overrides.cad-planner` | universal | `bin/route.mjs` - pins this role to a model alias, bypassing the cell |
| `model.overrides.cad-assumptions-analyzer` | universal | `bin/route.mjs` - pins this role to a model alias, bypassing the cell |
| `model.overrides.cad-verifier` | universal | `bin/route.mjs` - pins this role to a model alias, bypassing the cell |
| `model.overrides.cad-reviewer` | universal | `bin/route.mjs` - pins this role to a model alias, bypassing the cell |
| `model.overrides.cad-executor` | universal | `bin/route.mjs` - pins this role to a model alias, bypassing the cell |
| `model.overrides.cad-plan-checker` | universal | `bin/route.mjs` - pins this role to a model alias, bypassing the cell |
| `model.effort.cad-planner` | universal | `bin/route.mjs` - selects the rung this role starts at, replacing the cell's; no floor reaches it (pre-plan role, dispatched before the PLAN the floor reads) |
| `model.effort.cad-assumptions-analyzer` | universal | `bin/route.mjs` - selects the rung this role starts at, replacing the cell's; no floor reaches it (pre-plan role, dispatched before the PLAN the floor reads) |
| `model.effort.cad-verifier` | universal | `bin/route.mjs` - selects the rung this role starts at, replacing the cell's, floored by any detected risk surface |
| `model.effort.cad-reviewer` | universal | `bin/route.mjs` - selects the rung this role starts at, replacing the cell's, floored by any detected risk surface |
| `model.effort.cad-executor` | universal | `bin/route.mjs` - selects the rung this role starts at, replacing the cell's, floored by any detected risk surface |
| `model.effort.cad-plan-checker` | universal | `bin/route.mjs` - selects the rung this role starts at, replacing the cell's, floored by any detected risk surface |
| `workflow.research` | new-project research step only | `workflows/new-project.md`'s research pass; no other workflow reads it |
| `workflow.plan_check` | universal | `workflows/plan.md` - whether the plan checker runs before code |
| `workflow.verifier` | universal | `workflows/verify.md` - off switch for the goal-backward pass |
| `workflow.skip_discuss` | progress next-step suggestion only | `workflows/progress.md`'s next-step table, for an unplanned current phase |
| `workflow.inline_plan_threshold` | universal | `workflows/plan.md` - task count at/below which a plan runs inline |
| `workflow.max_plan_tasks` | universal | `workflows/plan.md` - the ceiling handed to cad-planner, PER PLAN; a phase needing more capacity gets more plans. `planning.mjs plan-size --max-tasks` counts the written plan against it at `check_size`, and cad-plan-checker flags compound tasks under Proportionality - the half a count cannot see |
| `workflow.max_dispatch_tokens.cad-planner` | trace window report only | `bin/planning.mjs` - the window report reads this role's ceiling off the merged config and compares it to the `tokens` on each `brackets[]` row of the rendered record; nothing on the dispatch path reads it, so a crossing is a finding about a run that already finished |
| `workflow.max_dispatch_tokens.cad-assumptions-analyzer` | trace window report only | `bin/planning.mjs` - the window report reads this role's ceiling off the merged config and compares it to the `tokens` on each `brackets[]` row of the rendered record; nothing on the dispatch path reads it, so a crossing is a finding about a run that already finished |
| `workflow.max_dispatch_tokens.cad-verifier` | trace window report only | `bin/planning.mjs` - the window report reads this role's ceiling off the merged config and compares it to the `tokens` on each `brackets[]` row of the rendered record; nothing on the dispatch path reads it, so a crossing is a finding about a run that already finished |
| `workflow.max_dispatch_tokens.cad-reviewer` | trace window report only | `bin/planning.mjs` - the window report reads this role's ceiling off the merged config and compares it to the `tokens` on each `brackets[]` row of the rendered record; nothing on the dispatch path reads it, so a crossing is a finding about a run that already finished |
| `workflow.max_dispatch_tokens.cad-executor` | trace window report only | `bin/planning.mjs` - the window report reads this role's ceiling off the merged config and compares it to the `tokens` on each `brackets[]` row of the rendered record; nothing on the dispatch path reads it, so a crossing is a finding about a run that already finished |
| `workflow.max_dispatch_tokens.cad-plan-checker` | trace window report only | `bin/planning.mjs` - the window report reads this role's ceiling off the merged config and compares it to the `tokens` on each `brackets[]` row of the rendered record; nothing on the dispatch path reads it, so a crossing is a finding about a run that already finished |
| `workflow.test_command` | user-global config layer only | `workflows/task.md`, `workflows/coverage.md`, `references/execute-parallel.md` (the post-batch run, at its only consumer) and the executor contract - but only ever with the user-global layer's value: `bin/lib/config-merge.mjs` strips this key out of the repo layer before the merge, whatever its value, and names a non-null one in `scopeWarnings` (CFG-02) |
| `workflow.lint_command` | user-global config layer only | the executor contract's static-analysis step - the LINT command only; unset there means `bin/planning.mjs detect-commands` supplies both lint and typecheck from the project's own manifests. Same strip as the row above: `bin/lib/config-merge.mjs` removes it from the repo layer before the merge |
| `parallelization.enabled` | universal | `workflows/execute.md` - the parallel-path gate |
| `parallelization.max_concurrent_agents` | universal | `references/execute-parallel.md`, read at `workflows/execute.md`'s `execute_parallel` step - dispatch batch size |
| `parallelization.min_plans_for_parallel` | universal | `workflows/execute.md` - the parallel-path gate |
| `parallelization.use_worktrees` | universal | `workflows/execute.md` - worktree isolation for parallel writes |
| `git.protected_branches` | universal | `bin/git-guard.mjs`, `bin/land-cleanup.mjs` and `bin/git-publish.mjs` |
| `git.on_protected` | universal | `bin/git-guard.mjs` - ask / refuse / allow on a protected branch |
| `git.integration_branch` | universal | `bin/git-branch.mjs` - milestone branch or trunk |
| `git.auto_branch` | universal | `bin/git-branch.mjs` - how that branch is created |
| `git.base_branch` | universal | `bin/land-cleanup.mjs` - the base a land returns to |
| `git.create_tag` | universal | `workflows/milestone.md` - release-mode detection |
| `git.on_land_cleanup` | universal | `bin/land-cleanup.mjs` - return, pull, reap after a merge |
| `git.issue_check` | universal | `bin/issue-check.mjs` - the read-only tracker report `/cad-land` step 1 prints |
| `git.auto_close` | repo config layer only for the unattended publish | `bin/git-publish.mjs` `publish` AND `authorized` read the repo layer alone, through `bin/lib/repo-auto-close.mjs` - a user-global value authorizes no push (D-08) and no `glab mr create`, which `skills/cad-land/SKILL.md` step 3(b) consults `authorized` before, since on GitLab the create is itself the publish; `bin/land-cleanup.mjs` gate, `skills/cad-land/SKILL.md` and `cadence-core/workflows/milestone.md` read the MERGED value, because the triage ask and the gate's halt are a matched pair and must agree |
| `planning.commit_docs` | universal | `references/git-guard.md` and `workflows/task.md` - whether `.planning/` docs are committed |
| `memory.backend` | universal | `bin/planning.mjs recall` - `builtin` BM25 or `none` |
| `review.mode` | universal | `references/review-triggers.md` step 5, how multiple reviewers combine |
| `review.reviewers` | universal | `bin/route.mjs resolve` - the backend set, filtered per trigger by availability into the `reviewers` map beside `review` (review-triggers.md step 3 TAKES it) |
| `review.key_file` | user-global config layer only | `bin/review-provider.mjs` - the provider env-file path, reached through the `--key-file` flag the prose sites interpolate; `bin/lib/config-merge.mjs` strips the key out of the repo layer before the merge, so no future reader of the merged config can be pointed at a repo-chosen key file (CFG-02) |
| `review.request_timeout_ms` | universal | `bin/review-provider.mjs` - ms before a provider request aborts |
| `review.max_prompt_tokens` | cross-model provider calls only | `bin/review-provider.mjs` `review` and `consult` - both refuse an over-cap payload before any request; the claude-subagent reviewer never runs the script |
| `review.providers.openai.tiers.flagship` | universal | `bin/review-provider.mjs` `--model`, resolved by `review.providers.<name>.tiers[trigger.tier]` |
| `review.providers.openai.tiers.balanced` | universal | `bin/review-provider.mjs` `--model`, resolved by `review.providers.<name>.tiers[trigger.tier]` |
| `review.providers.openai.tiers.cheap` | universal | `bin/review-provider.mjs` `--model`, resolved by `review.providers.<name>.tiers[trigger.tier]` |
| `review.providers.gemini.tiers.flagship` | universal | `bin/review-provider.mjs` `--model`, resolved by `review.providers.<name>.tiers[trigger.tier]` |
| `review.providers.gemini.tiers.balanced` | universal | `bin/review-provider.mjs` `--model`, resolved by `review.providers.<name>.tiers[trigger.tier]` |
| `review.providers.gemini.tiers.cheap` | universal | `bin/review-provider.mjs` `--model`, resolved by `review.providers.<name>.tiers[trigger.tier]` |
| `review.providers.deepseek.tiers.flagship` | universal | `bin/review-provider.mjs` `--model`, resolved by `review.providers.<name>.tiers[trigger.tier]` |
| `review.providers.deepseek.tiers.balanced` | universal | `bin/review-provider.mjs` `--model`, resolved by `review.providers.<name>.tiers[trigger.tier]` |
| `review.providers.deepseek.tiers.cheap` | universal | `bin/review-provider.mjs` `--model`, resolved by `review.providers.<name>.tiers[trigger.tier]` |
| `review.triggers.plan.gate` | universal | `bin/route.mjs resolve` - the plan review's gate, over the level's |
| `review.triggers.plan.tier` | cross-model reviewers only | `references/review-triggers.md` step 4 - `review.providers.<name>.tiers[trigger.tier]`, and `bin/route.mjs resolve`'s availability test reads the same tier (falling back to route-table.json's `tiers` row when no layer sets it); the claude-subagent reviewer's model comes from the routing cell |
| `review.triggers.plan.effort` | cross-model reviewers only | `bin/review-provider.mjs` `--effort`; the claude-subagent reviewer's effort is frontmatter-frozen |
| `review.triggers.diff.gate` | universal | `bin/route.mjs resolve` - the diff review's gate, over the level's |
| `review.triggers.diff.tier` | cross-model reviewers only | `references/review-triggers.md` step 4 - `review.providers.<name>.tiers[trigger.tier]`, and `bin/route.mjs resolve`'s availability test reads the same tier (falling back to route-table.json's `tiers` row when no layer sets it); the claude-subagent reviewer's model comes from the routing cell |
| `review.triggers.diff.effort` | cross-model reviewers only | `bin/review-provider.mjs` `--effort`; the claude-subagent reviewer's effort is frontmatter-frozen |
| `review.triggers.risk_surface.gate` | universal | `bin/route.mjs resolve` - the risk-surface review's gate, over the level's |
| `review.triggers.risk_surface.tier` | cross-model reviewers only | `references/review-triggers.md` step 4 - `review.providers.<name>.tiers[trigger.tier]`, and `bin/route.mjs resolve`'s availability test reads the same tier (falling back to route-table.json's `tiers` row when no layer sets it); the claude-subagent reviewer's model comes from the routing cell |
| `review.triggers.risk_surface.effort` | cross-model reviewers only | `bin/review-provider.mjs` `--effort`; the claude-subagent reviewer's effort is frontmatter-frozen |
| `review.triggers.risk_surface.surfaces` | universal | `bin/route.mjs resolve` - the category set the risk-surface fire is scoped to, returned beside `review`; a heuristic match outside it does not fire, and unset resolves to all eight |
| `review.triggers.phase_diff.gate` | universal | `bin/route.mjs resolve` - the merged-phase review's gate, over the level's |
| `review.triggers.phase_diff.tier` | cross-model reviewers only | `references/review-triggers.md` step 4 - `review.providers.<name>.tiers[trigger.tier]`, and `bin/route.mjs resolve`'s availability test reads the same tier (falling back to route-table.json's `tiers` row when no layer sets it); the claude-subagent reviewer's model comes from the routing cell |
| `review.triggers.phase_diff.effort` | cross-model reviewers only | `bin/review-provider.mjs` `--effort`; the claude-subagent reviewer's effort is frontmatter-frozen |
| `review.consult.enabled` | universal | `references/consult.md` step 1 - the consult gate |
| `review.consult.tier` | universal | `references/consult.md` - the consult model id (a consult is always a cross-model call, so nothing drops it) |
| `review.consult.effort` | universal | `references/consult.md` - `--effort` on the consult call |
| `review.consult.attempt_threshold` | universal | `references/consult.md` - failed attempts before cad-debug offers a consult |
| `review.decision_review.tier` | cross-model reviewers only | `workflows/decision-review.md` refute step - the cross-model model id; its cad-reviewer arm resolves no model at all |
| `review.decision_review.effort` | cross-model reviewers only | `workflows/decision-review.md` refute step - `--effort` on the cross-model call; cad-reviewer runs at the session default |
