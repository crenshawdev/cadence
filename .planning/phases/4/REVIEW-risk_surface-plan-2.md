{
 "findings": [
  {
   "file": "cadence-core/bin/seam-calls.test.mjs",
   "line": 44,
   "severity": "medium",
   "claim": "The census counts lexical command occurrences, not calls executed on a happy path.",
   "failure_scenario": "With memory.backend not builtin, context.md skips the conditional recall invocation, but the regex still counts its text and asserts 6. Mutually exclusive and error-branch commands are all counted, so the pinned total is not the round-trip count for any concrete configuration."
  },
  {
   "file": "cadence-core/bin/lib/planning-files.mjs",
   "line": 441,
   "severity": "medium",
   "claim": "phaseCriteria recognizes criteria headings and items inside FENCED examples as real roadmap criteria.",
   "failure_scenario": "A phase whose block contains only a fenced markdown template with **Success Criteria:** and two numbered placeholders returns {found:true,count:2}, so criteria-size reports a phase within bounds that declares no criteria. NOTE: phase 3 of this same cycle shipped COR-01 specifically to guard fence-blind scanners; this is a NEW fence-blind parser."
  },
  {
   "file": "cadence-core/bin/lib/planning-files.mjs",
   "line": 443,
   "severity": "medium",
   "claim": "The parser counts every later top-level ordered item in the phase block, not only the list under the matched criteria heading.",
   "failure_scenario": "For a phase with one criterion followed by a **Risks:** ordered list of two, it reports 3. Verified NOT firing on this repo today: phases 2 and 5 genuinely carry 6 numbered criteria each, so the current out-of-range report is correct."
  },
  {
   "file": "cadence-core/bin/lib/planning-files.mjs",
   "line": 352,
   "severity": "medium",
   "claim": "The exported parser interpolates its phase value into a RegExp without escaping, contradicting its documented no-throw contract.",
   "failure_scenario": "phaseCriteria(roadmap, \"[\") throws SyntaxError instead of returning {found:false,count:0}. The CLI validates its flag first, so only a direct API consumer is exposed."
  },
  {
   "file": "cadence-core/workflows/context.md",
   "line": 374,
   "severity": "medium",
   "claim": "The commit decision uses a planning.commit_docs value captured at the start of a long interactive workflow rather than at commit time.",
   "failure_scenario": "The key flips during the interview; the carried value commits against current policy, or skips a commit the user now wants."
  }
 ]
}
