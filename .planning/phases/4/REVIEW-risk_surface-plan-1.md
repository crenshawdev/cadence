{
  "findings": [
    {
      "file": "cadence-core/bin/planning/status.mjs",
      "line": 145,
      "severity": "high",
      "claim": "The new grammar treats both `1.1` and `1.10` as legal phase-directory names, but the surviving-directory path still converts each accepted name with `Number(e)`. Those distinct legal names both become `1.1`; since neither is grammar drift, `status` can silently emit two phase-dir records under the same phase identity, contrary to the stated no-different-phase guarantee.",
      "failure_scenario": "Close a milestone with both `.planning/phases/1.1/` and `.planning/phases/1.10/` present. The filter admits both directories, then the existing `Number(e)` mapping collapses `1.10` to `1.1`, so consumers receive duplicate/misattributed status entries and cannot distinguish which directory each result describes."
    },
    {
      "file": "cadence-core/bin/planning/recall.mjs",
      "line": 75,
      "severity": "high",
      "claim": "The recalled corpus now explicitly admits `1.10` as a legal directory through `PHASE_DIR_NAME`, but the result identity remains `Number(n)`. Thus evidence read from `phases/1.10/` is returned as phase `1.1`; the added test even pins this incorrect identity rather than preventing it.",
      "failure_scenario": "Put a searchable SUMMARY entry in `.planning/phases/1.10/` and another phase directory `.planning/phases/1.1/` on the same tree. `recall` indexes the former under numeric phase `1.1`, so a query can return sub-phase-ten evidence labeled as sub-phase one, causing a caller to act on evidence from a different legal phase."
    }
  ]
}
