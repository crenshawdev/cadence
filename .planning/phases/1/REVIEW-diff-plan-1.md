{
  "findings": [
    {
      "file": "cadence-core/bin/planning/risk-check.mjs",
      "line": 931,
      "severity": "blocker",
      "claim": "A staged scope is matched only by `base_id` and `staged`, but the index is mutable, so a record from an earlier index state satisfies a later `--staged` status request without the later staged contents ever being scanned.",
      "failure_scenario": "Run `risk-check run --phase 1 --plan 1 --base HEAD --staged` with an empty or benign index, which records `staged: true` and the current HEAD id. Then stage a new risky change without committing, leaving HEAD unchanged. `risk-check status --phase 1 --plan 1 --base HEAD --staged` resolves the same base and `sameRange` returns true for the old record, reporting it recorded despite the newly staged change never being checked. The staged record needs an immutable index identity (for example, the cached tree id) captured by run and compared by status."
    }
  ]
}
