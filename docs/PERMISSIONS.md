# Permissions and data

The complete disclosures now live in the [Cadence guide](guide/reference/permissions.md).

The `Workflow` tool is listed in `allowed-tools` by the commands that fire reviews (`/cadence:cad-plan`, `/cadence:cad-plan-review`, `/cadence:cad-execute`, `/cadence:cad-verify`, `/cadence:cad-task`, `/cadence:cad-debug`). Those commands start a workflow only when `workflow.use_workflows` is true in both your repository's config and your user-global config, which is off by default.

`/cadence:cad-map` also lists `Workflow`, to run the code map's readers. It doesn't read `workflow.use_workflows`: it runs only with `planning.code_map` on and only after you type a yes to a prompt that names the readers it would start, so a repository's committed setting alone can't start one.
