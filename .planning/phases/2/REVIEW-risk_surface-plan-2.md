{
  "findings": [
    {
      "file": "cadence-core/bin/planning.mjs",
      "line": 4654,
      "severity": "medium",
      "claim": "The no-plan record resolver follows symlinks even though the code's safety contract says records must be regular files.",
      "failure_scenario": "For a receipt without `--plan`, an attacker who can place a matching `ADJUDICATION-<trigger>-<discriminator>-<sha>.json` symlink in the phase directory can make `recordForFire` return `join(pdir, hits[0])` without calling `lstatSync`. `readFileSync` subsequently follows that symlink outside the phase tree. The per-plan arm correctly uses `regular()` specifically to reject this condition, but the no-plan arm bypasses it; a hostile repository can therefore make receipt validation consume arbitrary local JSON or fail on an arbitrary target."
    }
  ]
}
