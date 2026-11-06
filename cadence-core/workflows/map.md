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
- Otherwise print the count of modules and `bytes`, then the `readers` this launch will start and the `reader_bytes` they will open, which cover only the stale and unbuilt modules. Say a first build's token cost isn't measured. Name each module in `oversized` and give the line that re-cuts the partition: `rm .planning/codemap/index.json`.

End the turn in plain text asking for a yes, and ask on a refresh too: a branch switch can stale most of the map. Only a typed yes in the next message goes on. Any other reply starts nothing.
