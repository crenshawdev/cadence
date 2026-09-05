{
  "findings": [
    {
      "file": "cadence-core/bin/route.mjs",
      "line": 960,
      "severity": "medium",
      "claim": "Explicit `null` for `roles.<role>.effort` is treated as absence and allows the legacy `model.effort.<role>` key to win, contradicting the new schema contract that null unpins to the role schema default.",
      "failure_scenario": "Set a global `model.effort.cad-executor` to `low`, then set repo `roles.cad-executor.effort` to `null` to unpin global routing. After merge, `rolesEffortSet` is false, so the resolver selects the legacy global `low` value before consulting the role default `high`. The schema explicitly says null leaves the role default as the answer, but this input silently resolves to the weaker legacy rung instead."
    }
  ]
}
