# Permissions and data

The complete disclosures now live in the [Cadence guide](guide/reference/permissions.md).

The `Workflow` tool is listed in `allowed-tools` by the commands that fire reviews (`/cadence:cad-plan`, `/cadence:cad-plan-review`, `/cadence:cad-execute`, `/cadence:cad-verify`, `/cadence:cad-task`, `/cadence:cad-debug`). It starts a workflow only when `workflow.use_workflows` is true in both your repository's config and your user-global config, which is off by default.
