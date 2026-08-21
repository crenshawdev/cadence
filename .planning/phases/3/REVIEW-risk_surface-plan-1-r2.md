{
 "findings": [
  {
   "file": "cadence-core/bin/route.mjs",
   "line": 347,
   "severity": "medium",
   "claim": "lstatSync guards only the FINAL declared path component; a symlinked parent directory is still followed, so a declared body outside the repository can be read as evidence.",
   "failure_scenario": "A repository carries `src` as a symlink to a directory outside it while a clean PLAN declares `src/secret.mjs`. The lexical absolute/`..` check passes, lstatSync follows `src` and reports a regular file, and readFileSync reads it. Adjudicated DOWN from high: the unbounded-read half is closed (a character device fails isFile() whichever component links to it), the body is never echoed so nothing leaks, and the level moves only for a repository whose own directory layout is hostile. The residual is the boundary claim in declaredBodies' docstring, which containment (realpathSync against the repo root) would make true."
  }
 ]
}
