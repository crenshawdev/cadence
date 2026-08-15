{
 "findings": [
  {
   "file": "cadence-core/bin/planning.mjs",
   "line": 2622,
   "severity": "medium",
   "claim": "`trace close` does not require the worker key (--plan) or role even though those fields are the subcommand pairing contract.",
   "failure_scenario": "CONFIRMED empirically 2026-08-14: `trace close --phase 1 --role cad-executor` with no --plan returns ok:true,written:true. The terminal cannot pair with the dispatch, so that worker renders unpaired while the seam told the caller the close succeeded."
  },
  {
   "file": "cadence-core/bin/planning.mjs",
   "line": 2643,
   "severity": "medium",
   "claim": "The implementation contradicts the advertised presence-based --detail contract by requiring non-whitespace content before selecting checkpoint.",
   "failure_scenario": "CONFIRMED empirically 2026-08-14: `trace close ... --detail \"\"` returns ok:true and writes a clean return. A failure path passing an empty $ERROR records an unusable worker as successful."
  },
  {
   "file": "cadence-core/bin/lib/trace.mjs",
   "line": 647,
   "severity": "medium",
   "claim": "A bracket row prefers terminal tokens even when accounting funded the dispatch-side figure, so brackets[].tokens can disagree with roles[].tokens.",
   "failure_scenario": "Dispatch carries tokens:5, return carries tokens:7. Role accounting retains 5 to avoid double funding; the bracket exposes 7. The report prints 7 for a dispatch whose role total is 5. NOT independently verified."
  },
  {
   "file": "cadence-core/bin/planning.mjs",
   "line": 2582,
   "severity": "medium",
   "claim": "The reads join uses brackets from a capped trace render but discards the capped signal, so omitted brackets are reported as failed joins.",
   "failure_scenario": "On a trace past the render cap, a read inside a closed bracket outside the retained slice reports as unjoined with no indication the bracket was excluded rather than missing. NOT independently verified."
  },
  {
   "file": "cadence-core/bin/planning.mjs",
   "line": 2571,
   "severity": "medium",
   "claim": "The reads parser treats every JSON parse failure as a partial final line, including corruption mid-ledger.",
   "failure_scenario": "A malformed record between two valid ones vanishes with no malformed count, so the ledger presents as complete rather than corrupted. NOT independently verified."
  },
  {
   "file": "cadence-core/bin/lib/read-trace.mjs",
   "line": 419,
   "severity": "medium",
   "claim": "Agent normalization strips any namespace rather than requiring the Cadence plugin namespace.",
   "failure_scenario": "A record with agent:\"other-plugin:cad-executor\" timestamped inside a Cadence executor bracket normalizes to cad-executor and is counted as joined, charging another plugin reads to Cadence. NOT independently verified."
  },
  {
   "file": "cadence-core/workflows/report.md",
   "line": 48,
   "severity": "medium",
   "claim": "report.md still requires each dispatch rung from routing resolves, but the prescribed default render no longer returns routing events.",
   "failure_scenario": "For a medium-rung worker the bracket carries no routing resolve, and report.md forbids --events, so the dispatch table must omit or invent the rung. NOT independently verified."
  }
 ]
}
