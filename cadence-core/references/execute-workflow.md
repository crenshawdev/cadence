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

Take the first wave of `waves` that still holds a plan, and in it keep only the plans in the dispatch set `locate` defined that are not already done in this run. The width is what is left. A plan stopped by an earlier wave holds the next wave, so no wave is launched until it is answered.

**Each plan's dispatch.** Record the pre-plan HEAD with `git rev-parse HEAD` once, for the whole wave. Make the run's scratch directory the first time it is needed, with the `mktemp` line `execute_sequential` states, and print it. For each plan in the wave:

- Its own resolve, because the risk floor differs by plan, with its own bracket and the `--bracket-read` value `execute_sequential`'s stretch for the brief states:

  ```
  node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/route.mjs" resolve --role cad-executor --attempt 1 --phase <N> --plan <k> --bracket-plan <k> --bracket-read "CLAUDE.md,<the brief path>"
  ```

  Keep its `agent_type` and `model` (null when it answered none).
- Its brief, composed as that stretch states, ahead of the resolve, with `--out-dir <the scratch directory>`. Above width 1 add `--main-root <the main tree's root>`, so the brief names the plan, `PROJECT.md` and `CONTEXT.md` by the main tree's absolute path. A refused or unreadable brief takes that stretch's own arm.
- Its prompt, the one `execute_sequential` composes with that stretch: phase number, name and goal, the shared files, the `surfaces` bullet, the testing-policy line when it applies, the brief file by its absolute path, and the commit scope `{phase}-{plan}`. Add the pre-plan HEAD and this sentence: the host may restart the executor with this same prompt, so any commit after that HEAD in this plan's scope is its own earlier work to continue from and never redo. Then the mode line. At width 1 it is "Sequential executor on the normal working tree." Above width 1 it is, word for word:

  "Workflow worktree executor on branch `cadence/phase-<N>-plan-<k>` - worktree mode, workflow rules apply."

  Above width 1 every `.planning/` path the prompt names is the main tree's absolute path. The prompt also names the plan's report path, `<the scratch directory>/reports/plan-<k>.md`, which the workflow arm of `references/worktree-executor.md` writes in place of `<plandir>/reports/plan-<k>.md`, because the host refuses a worktree agent's write into the main tree.

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
