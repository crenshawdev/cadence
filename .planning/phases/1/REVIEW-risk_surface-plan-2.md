{
  "findings": [
    {
      "file": "cadence-core/bin/planning.mjs",
      "line": 4199,
      "severity": "medium",
      "claim": "The environment check treats any non-empty GIT_DIR or GIT_WORK_TREE as proof that a repository covers the target, even when the variable selects an unrelated or stale path.",
      "failure_scenario": "A bare planning tree with no .git anywhere, run while inheriting GIT_WORK_TREE=/tmp/unrelated or a stale GIT_DIR. git rm fails, gitDirAbove returns true from the variable alone, and a legitimate recursive fallback is refused. Fails SAFE - a refusal, not a delete - and the error names the command that shows git's own answer."
    },
    {
      "file": "cadence-core/bin/planning.mjs",
      "line": 4233,
      "severity": "medium",
      "claim": "The nested-repository scan recurses without a depth bound, one call frame per directory level.",
      "failure_scenario": "A repository-free phase holding a deep directory chain exhausts the call stack; the RangeError escapes gitDirUnder's catch (which wraps only readdirSync) and surfaces as a partial-apply refusal. Fails SAFE - the delete is refused, not taken."
    }
  ],
  "resolved": [
    {
      "file": "cadence-core/bin/planning.mjs",
      "severity": "high",
      "claim": "gitDirUnder compared readdir entry names case-sensitively, so a nested .GIT was scanned past on a case-insensitive filesystem.",
      "closed_by": "c0b0d04 - the scan probes lstatSync(join(d, '.git')) per directory, inheriting the filesystem's case semantics as gitDirAbove already did."
    }
  ]
}
