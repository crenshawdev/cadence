# cad-map workflow

Builds the code map, or refreshes the modules that went stale. Everything the readers will open is already on disk as facts, so this prints what a launch would start and waits for a typed yes before any reader does. `references/review-workflow.md` is the pattern for the claim, the launch and the notice. Only the `planning.code_map` switch gates it: a committed `true` can only add a local scan, because no agent starts without a typed `/cad-map` and a yes.

## 1. Read the switch

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/config.mjs" get planning.code_map parallelization.max_concurrent_agents
```

`planning.code_map` false: say `/cad-config planning.code_map=true` turns the code map on, and stop. Run nothing else.

## 2. Scan

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" codemap scan
```

On `ok:false`, relay its `reason` and `hint` and stop. The answer carries `modules`, `bytes`, `built`, `stale`, `unbuilt`, `no_reader`, `readers` (stale plus unbuilt) and `reader_bytes` (what those readers open), and `oversized`.

- The `Workflow` tool is not in this session's tool list: report `modules`, `bytes`, `stale` and `unbuilt`, say the build needs that tool, and stop. There is no single-agent fallback.
- `readers` is 0: say the map is current and stop. Start nothing and ask nothing.
- Otherwise print the count of modules and `bytes`, then the `readers` this launch will start and the `reader_bytes` they will open, which cover only the stale and unbuilt modules. Say a first build's token cost isn't measured. Name each module in `oversized` and give the line that re-cuts the partition: `rm .planning/records/codemap/index.json`.

End the turn in plain text asking for a yes, and ask on a refresh too: a branch switch can stale most of the map. Only a typed yes in the next message goes on. Any other reply starts nothing.

## 3. After a yes: claim, compose, launch

Make this run's scratch directory first and print it: `D="$(mktemp -d "${TMPDIR:-/tmp}/cad-XXXXXX")" && case "$D" in (*[!A-Za-z0-9._/-]*) echo "scratch-unsafe: $D" >&2; exit 1;; esac && echo "scratch dir: $D"`. Keep the printed path as a literal in every later call, because each Bash call starts with `$D` empty.

Claim, with the directory's own name, which is the part after the last `/`:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" workflow-claim take --fire code-map-<the scratch directory's name>
```

`launch: true` means go on, and a win prints the claim's `id`: keep it as a literal, since the release runs in a later turn. With `workflow.multi_workflow` on a take prints no id and holds nothing, so there is nothing to release. On `launch: false`, name the `holder` and its `age_seconds`, and say a holder that may be dead is cleared with `workflow-claim release --fire <holder> --id <holder_id>` (`--stale` in place of `--id` when its `holder_id` is null). Then stop.

From here a claim is held, so every stop below releases it at once:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" workflow-claim release --fire code-map-<the scratch directory's name> --id <the id take printed>
```

Resolve the mapper, with no `--bracket-read`, because brackets are written after the run:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/route.mjs" resolve --role cad-mapper --attempt 1
```

Relay every `warnings[]` entry to the user before you launch, each distinct one once. Take `agent_type` and `model` from the answer, never an agent name of your own: the mapper's unsuffixed file is its high rung, so a name built from the role does not resolve. An answer of `ok:false` takes the spawn-agent seam's arm: the base agent `cadence:cad-mapper` and `model` null.

Only now pin the hashes, so they are the launch's and not the question's:

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" codemap status --out-dir <the scratch directory>
```

A refusal is named in one line and the claim released. The answer's `launch` holds `file`, `items` and `bytes`. With `items` 0 the map went current since the question: say so, release the claim and start nothing. Otherwise Read `launch.file`. If `Read` answers a partial view, follow its instruction to read the whole file; if the whole file can't be had, name that in one line, release the claim and start nothing, and never launch from a partial view.

`args` is that file whole, retyped exactly: `root`, then `items`, each with its `name`, `built_from` and `item`, with not a name, a path, a hash or a byte changed. Add the resolve's `agent_type` and `model` (null when it answered none) and `batch_size`, the `parallelization.max_concurrent_agents` read in step 1.

Launch the `Workflow` tool by its named entry `cadence:code-map` with `args`. If the name does not resolve, launch it with `scriptPath` set to `${CLAUDE_PLUGIN_ROOT}/workflows/code-map.js`. The result prints `Transcript dir` and `Run ID`, so keep both.

- A launch the host refuses: name it in one line and release the claim at once, since no notice will come and nothing was spent.
- A launch call that never issues: name it and release the claim the same way, without saying nothing was spent, since this session's tokens were.

Otherwise end the turn. Dispatch nothing else until the notice.

## 4. On the notice

The notice holds run totals and cuts a result short, so the seam reads the run file whole: `workflows/<Run ID>.json` under the session directory `Transcript dir` names.

```
node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" codemap write --run-file <run file> --launch-file <the launch file status printed> [--notice-tokens <n> --notice-turns <n> --notice-duration-ms <n>]
```

Pass the notice's totals as plain whole numbers, for the case the run file has no agent rows. A `bad-args` refusal has billed and written nothing and the run file is still good, so correct the flag it names and run the same call again before you stop, or `/cad-map` pays for those readers twice. Release the claim right after the call returns any other answer, whether it succeeded or refused, with step 3's release line and the same `id`. A take that printed no id has nothing to release.

The call bills every agent in the run, one bracket each, before it judges anything. Print `written`, each `refused` module with the reason it names, each `dead` reader, and each `missing` module, with `launch_note` when it is present. Say those modules stay stale and that `/cad-map` again rebuilds only them. A refusal of the call is named in one line. One carrying `brackets` has billed its agents, and a `bad-args` one has billed nothing.
