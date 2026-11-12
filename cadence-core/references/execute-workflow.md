# The execute path as a workflow

Read at `<step name="execute_workflow">` in `cadence-core/workflows/execute.md`, which is the only step that reaches it. This file is one procedure, run once per wave. A wave's executors run inside `workflows/execute-wave.js`, one per plan. Every decision and every git merge stays with you. From the launch to the notice you dispatch nothing else: end the turn at the launch.

Keep these as literals, since each turn starts with nothing remembered: the scratch directory, the claim `id`, the wave's label, `Transcript dir`, `Run ID`, the pre-plan HEAD, and for each plan its brief path and its resolve's `agent_type` and `model`.

## 1. Launch one wave

Run this before every wave. The wave number `<j>` counts the waves launched so far in this run, from 1.

**Claim first.** Take it before any resolve below, so a lost claim leaves no dispatch open:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" workflow-claim take --fire execute-<N>-wave-<j>
```

`launch: true` prints the claim's `id`, so keep it as a literal. `launch: false` names the `holder`, its `holder_id` and its `age_seconds`. When this session holds it for a fire awaiting its notice, wait for that notice and take the claim again. When another session holds it, or this session holds nothing awaiting a notice, name the holder and its age and ask through the ask-user seam: check again, or today's path. An old claim from a dead session is cleared through that ask with `workflow-claim release --fire <holder> --id <holder_id>`, or `--stale` for a holder with no id, and then you take the claim again. Today's path opened nothing: the rest of the phase runs on today's sequential path, and no further step of this file runs.

**Read the wave again.** Ask `plan-overlap` again, never from a list held since `choose_path`, because a fix can widen a lease:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" plan-overlap --phase <N>
```

Pick the wave in `choose_path`'s order. In every wave of `waves`, keep only the plans in the dispatch set `locate` defined that are not already done in this run, then drop any wave left empty. Take the first wave that remains, and the width is what it holds. When none remain there is nothing to launch: release the claim with the line below and go to the after-the-last-wave step in "Then". A plan stopped by an earlier wave holds the next wave, so no wave is launched until it is answered.

**Each plan's dispatch.** Record the pre-plan HEAD with `git rev-parse HEAD` once, for the whole wave. Make the run's scratch directory the first time it is needed, with the `mktemp` line `execute_sequential` states, and print it. For each plan in the wave:

- Its own resolve, because the risk floor differs by plan, with its own bracket and the `--bracket-read` value `execute_sequential`'s stretch for the brief states:

  ```
  node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/route.mjs" resolve --role cad-executor --attempt 1 --phase <N> --plan <k> --bracket-plan <k> --bracket-read "CLAUDE.md,<the brief path>"
  ```

  Keep its `agent_type` and `model` (null when it answered none).
- Its brief, composed as that stretch states, ahead of the resolve, with `--out-dir <the scratch directory>`. Above width 1 add `--main-root <the main tree's root>`, so the brief names the plan, `PROJECT.md` and `CONTEXT.md` by the main tree's absolute path. A refused or unreadable brief takes that stretch's own arm.
- Its prompt, the one `execute_sequential` composes with that stretch: phase number, name and goal, the shared files, the `surfaces` bullet, the testing-policy line when it applies, the brief file by its absolute path, and the commit scope `{phase}-{plan}`. Add the pre-plan HEAD and this sentence: the host may restart the executor with this same prompt, so any commit after that HEAD in this plan's scope is its own earlier work to continue from and never redo. Then the mode line. At width 1 it is "Sequential executor on the normal working tree." Above width 1 it is, word for word:

  "Workflow worktree executor on branch `cadence/phase-<N>-plan-<k>` - worktree mode, workflow rules apply."

  Above width 1 every `.planning/` path the prompt names is the main tree's absolute path. The prompt also names the plan's report path, `<the scratch directory>/reports/plan-<k>.md`, which the workflow arm of `references/worktree-executor.md` writes in place of `<plandir>/records/reports/plan-<k>.md`, because the host refuses a worktree agent's write into the main tree.

Print each plan's dispatching line, with the position line `locate` states.

Relay every `warnings[]` entry a resolve returns before the launch, each distinct warning once per run, as `references/seam-spawn-agent.md` states.

**`args`**, as the header of `workflows/execute-wave.js` states:

```
{"plans": [{"plan": <k>, "prompt": "<that plan's prompt>", "agent_type": "<its resolve's>", "model": "<its resolve's, or null>"}], "batch_size": <parallelization.max_concurrent_agents>}
```

**Launch** with the claim held. Use the `Workflow` tool by its named entry `cadence:execute-wave` with `args`. If the name does not resolve, launch it with `scriptPath` set to `${CLAUDE_PLUGIN_ROOT}/workflows/execute-wave.js`. The result prints `Transcript dir` and `Run ID`, so keep both, and end the turn.

A launch the host refuses releases the claim at once, since no notice will come:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" workflow-claim release --fire execute-<N>-wave-<j> --id <the id take printed>
```

Then close each plan's opened bracket as an `escalation`, one call per plan:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" trace append --phase <N> --family lifecycle --event escalation --plan <k> --role cad-executor
```

Print one line, and run the rest of the phase on today's sequential path.

## 2. On the notice

The notice holds run totals and cuts a long result short, so the seam reads the run file whole: `workflows/<Run ID>.json` under the session directory `Transcript dir` names.

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" workflow-run --phase <N> --run-file <the run file> --out-dir <the scratch directory> --payload-ref <the scratch directory> --plans <the wave's plan numbers, comma-separated, as 1,2,3> [--notice-tokens <n> --notice-turns <n> --notice-duration-ms <n>]
```

Release the claim right after this call returns, whether it answered or refused, with the `workflow-claim release` line from section 1 and the same `id`.

The call bills every executor of the wave, each under its plan number and with its own figures, and no `trace close` is written for any plan. `--plans` is how it knows the wave when the run file cannot say: a plan the file has no row for, a file with no rows, one that is unreadable and one holding the script's message all still close every listed plan, as a `checkpoint` under its own plan number that says why, with the notice's totals on the first of them. Spend is billed as `cad-executor`. It writes no `<run id>-notice` bracket for a wave, and the same call twice, or the notice's totals after the rows or the rows after the notice's totals, bills the wave once.

Its answer holds each plan's outcome in `plans`, a `digest` or null, and `restarted`. Relay each plan's outcome with its position line. For each entry of `restarted`, name that plan's agent as restarted by the host. A refusal has billed what it could: treat every plan of the wave as a dead slot (section 3) and read each from its report.

Sort each plan by its outcome:

- **Settled**: the digest reads `PLAN COMPLETE`. It goes on below.
- **A checkpoint**, a `PLAN PARTIAL`, a null digest or a digest that does not parse: section 3.

### A wave wider than 1

Read `${CLAUDE_PLUGIN_ROOT}/cadence-core/references/execute-parallel.md` and follow steps 3 to 5 for the plans that settled, with these differences.

- **Step 3, merge.** Merge each plan's branch `cadence/phase-<N>-plan-<k>` in plan order, with both HEADs recorded. A settled plan with no such branch landed nothing, so its two HEADs are one commit and step 5 takes the skip for it.
- **The report moves after its merge.** Once a plan's branch has merged, move its report from `<the scratch directory>/reports/plan-<k>.md` into `<plandir>/records/reports/plan-<k>.md`. First rotate a report already there aside to the next free `plan-<k>.<n>.md`, as the executor contract's rotation rule does. Edit nothing in the moved file (D-06). A plan whose branch has not merged keeps its report in the scratch directory, so the main tree never holds a `PLAN COMPLETE` for unmerged work.
- **Step 4, cleanup.** Remove a worktree only if the host kept it: look for the branch in `git worktree list --porcelain`. Delete each merged branch.
- **Step 5, the suite and the risk sequence.** The suite runs after this wave, not once at the end, because the next wave forks from this merge. Then run the skip or `risk-check run` for every settled plan first. Then the fires: each `risk_surface` fire a `run` answer called for, and each plan's `diff` trigger. Then each plan's `status`, since `status` counts every executor the run closed, so a plan's done waits on its wave-mates' records. A `risk_surface` fix runs in the main tree under worker key `<k>`. Under `review.triggers.diff.when` `phase_end`, those fires leave out each plan's `diff` trigger, and the `risk_surface` fires and each plan's `status` run as above.

The report on this path is never in a worktree and no executor commits it. The move above brings it into the main tree, and the `state` step's existing staging is its only commit.

### A wave of one plan

It ran in the normal tree, so nothing merges and its report is already at `<plandir>/records/reports/plan-<k>.md`. The plan's range is its pre-plan HEAD to HEAD. The risk sequence, the cursor write and the `diff` fire are `execute_sequential`'s, as it states them. Under `review.triggers.diff.when` `phase_end` it takes `execute_sequential`'s skip of the per-plan `diff` fire and does not make its phase-end fire, which belongs to the sequential path; the one phase-end review here is the one in "Then".

### Then

A wave is done only when each of its plans is, and a stopped plan, an open question or a conflict holds the next wave. Launch the next from section 1 when every plan of this one is done. After the last wave, fire `phase_diff` once, as step 6 of `execute-parallel.md` states. When its gate is `off` and a wave ran wider than 1, print one line saying the interaction of the merged plans went unreviewed. Under `review.triggers.diff.when` `phase_end`, step 6 of `execute-parallel.md` states the rule, and its review is the only phase-end `diff` review on this path whatever the width of the last wave; the line above is not printed, because with `phase_diff` `off` step 6 fires `diff` over `PHASE_BASE..HEAD` and the merged plans are reviewed. Then `goal_check` and on, as today.

## 3. Where a wave stops

**A merge conflict.** At the first one, stop with the conflicted merge left in place. Name the plan and the conflicting paths (`git diff --name-only --diff-filter=U`) and ask through the ask-user seam. Start no further merge, risk check, cursor write, review, SUMMARY or next wave. Never run `git merge --abort` yourself, since it hides the conflict. Headless, the run ends there and the file state is the proof.

**A checkpoint.** The plans that settled merge in plan order as section 2 states, and the next wave waits. Route the checkpoint as `handle_checkpoint` does, with the position line. The stopped plan's branch waits for the answer and then merges, its report moving in with that merge as section 2 states. Its continuation then runs in the normal tree on today's sequential dispatch under worker key `<k>`, the way the parallel path's fix dispatch runs, never back into a worktree. Its risk range runs from the pre-merge HEAD recorded at its merge to HEAD once the continuation settles. On this path that replaces the closing sentence of `execute-parallel.md`. A wave of one has no branch to merge, so its continuation follows the answer at once.

**A null slot, a turn cap or a digest that does not parse**, and a `PLAN PARTIAL`:

- In a wave of one plan the executor ran in the normal tree and made no branch. Do what `execute_sequential`'s turn-cap arm does: read `<plandir>/records/reports/plan-<k>.md`, check it against `git log {pre-plan HEAD}..HEAD`, report what landed, and ask whether to re-dispatch the remainder or stop. A re-dispatch runs under worker key `<k>`.
- In a wave wider than 1, read the plan's report in the scratch directory and check whether its branch exists. No branch means nothing landed and nothing merges, so its report moves in as it stands, unless it reads `PLAN COMPLETE`, which is named and left in the scratch directory. The next wave still waits for the answer. A branch is handled like a checkpoint: it waits for the answer, which is today's turn-cap question, whether to re-dispatch the remainder or stop. Then it merges, and a remainder runs in the normal tree.

**A restart.** A plan whose agent the host restarted is named in that plan's relay, from `restarted` in `workflow-run`'s answer. Its outcome is judged as any other: the restarted executor continued from its own commits after the pre-plan HEAD.
