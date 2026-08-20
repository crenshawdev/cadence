{
  "findings": [
    {
      "file": "cadence-core/bin/lib/adjudication-record.mjs",
      "line": 95,
      "severity": "medium",
      "claim": "FIX_COMMIT validates only that fix_commit looks like 7–40 hexadecimal characters; buildEntries accepts it without resolving it to a commit reachable in the repository.",
      "failure_scenario": "A composed payload can rule a blocker/high finding as survived with fix_commit \"abcdef1\" (the new integration fixture itself uses this value). The record is accepted and written even when that object does not exist, so the claimed remediation cannot be audited with git show and a blocking settlement retains invalid fix evidence."
    }
  ]
}
