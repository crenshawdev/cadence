{
  "findings": [
    {
      "file": "cadence-core/bin/lib/arg-contract.mjs",
      "line": 284,
      "severity": "medium",
      "claim": "A repeated flag whose LATER occurrence takes the `fallback` disposition is discarded when an earlier occurrence parsed cleanly: only a `warn` result (non-empty `detail`) overrides the first, so `fallback` never wins a later position.",
      "failure_scenario": "For a non-boolean row declaring `value: 'fallback'`, `evaluateFlag(['--timeout-ms', '1', '--timeout-ms', 'abc'], ...)` keeps the first parsed value 1 and returns it, while a bin whose own reader keeps the LAST occurrence sees `abc`. The declared fallback outcome for the occurrence that reader consumes is not carried out. No declared refusal is bypassed - all six fallback rows (`--timeout-ms`, `--branch`, `--base`, `--remote`, `--merged`, `--version`) answer with a benign default - which is why this settled as medium and not as a blocker."
    }
  ]
}
