{
  "findings": [
    {
      "file": "cadence-core/workflows/progress.md",
      "line": 101,
      "severity": "medium",
      "claim": "A scratch render that parses to literal `null` crashes the read-back with an unstructured TypeError instead of the promised `scratch-shape` refusal.",
      "failure_scenario": "`let r; try{r=JSON.parse(...)}catch{...}` then `[\"counts\",\"roles\",\"unpaired\",\"capped\"].filter((k)=>r[k]===undefined)`. A file holding the four bytes `null` parses successfully, so the catch never fires, and `r[\"counts\"]` throws outside it. The same shape sits in `references/triage-gate.md`'s re-arm read-back, where `!Array.isArray(r.outcomes)` dereferences the same possibly-null `r`. Both are the guarded surfaces this plan added, so both promise a named refusal they do not deliver on that one input."
    },
    {
      "file": "cadence-core/bin/lib/scratch-path.mjs",
      "line": 85,
      "severity": "medium",
      "claim": "The shared-path rule is per LINE, so one `mktemp` anywhere on a line clears every other scratch path on it.",
      "failure_scenario": "`if (line.includes('TMPDIR') && !MKTEMP_RE.test(line))` suppresses `scratch-shared-path` for a line that both makes a run directory and redirects into a fixed shared file, e.g. `D=\"$(mktemp -d \"${TMPDIR:-/tmp}/cad-XXXXXX\")\"; render > \"${TMPDIR:-/tmp}/cad-render.json\"`. The second rule does not catch it either: `FIXED_TARGET_RE` requires an absolute literal after the redirect, and `${TMPDIR:-/tmp}/...` is not one. So check 21 stays clean while the collision it exists to detect is back."
    }
  ],
  "killed": [
    {
      "file": "cadence-core/references/review-triggers.md",
      "line": 263,
      "raised_severity": "high",
      "why_killed": "Overstatement of a limitation the file already discloses. The scenario requires the caller to substitute BOTH the stale directory and its own matching stale token, i.e. to copy the prior invocation whole - which no in-band token can detect, because the check asks whether a directory holds the run it was told about. What the token does close is the carried-directory-plus-current-token mismatch and a directory reaped and reused by another run, which is the collision the plan was written for. The surrounding prose already states that a previous run's payload is well-formed by construction and no shape guard can tell it from this run's."
    }
  ]
}
