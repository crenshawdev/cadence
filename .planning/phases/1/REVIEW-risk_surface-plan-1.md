{
  "findings": [
    {
      "file": "cadence-core/bin/lib/file-transition.mjs",
      "line": 124,
      "severity": "low",
      "claim": "A pre-flight refusal is not guaranteed to write nothing: `satisfied` is arbitrary caller code and is executed before the refusal result is returned.",
      "failure_scenario": "A caller can supply `{ condition: 'destination is safe', satisfied: () => { writeFileSync(target, ''); return false; } }`. `runTransition` invokes that function at line 151, the function truncates `target`, and then the primitive returns `{ ok:false, refused: ... }`. No transition step ran, but the refused transition has already modified the tree. The API/JSDoc promises that an unsatisfied condition means “no thunk runs, nothing is written,” but neither the implementation nor the `PreflightCondition` contract requires or enforces a side-effect-free predicate; the tests cover only pure predicates."
    }
  ]
}
