{
  "findings": [
    {
      "file": "cadence-core/bin/lib/trace.mjs",
      "line": 807,
      "severity": "low",
      "claim": "The new cache-fact join key concatenates unescaped untrusted `corr` and `agent_id` fields with a NUL delimiter, so distinct pairs can collide and cache figures can be folded onto the wrong bracket.",
      "failure_scenario": "A valid hostile JSONL fact with `corr: \"run\"` and `agent_id: \"worker\\u0000target\"` produces the same map key as an existing bracket with `corr: \"run\\u0000worker\"` and `agent_id: \"target\"`: both serialize as `run\\u0000worker\\u0000target`. The post-pass then treats the fact as belonging to that bracket and silently adds its cache totals to the victim. JSON permits escaped NULs, and neither this collection path nor the matching path rejects them."
    }
  ]
}