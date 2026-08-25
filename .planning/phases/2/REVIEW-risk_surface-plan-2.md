# risk_surface review - phase 2, plan 2

Range: 54520d22..6e7fca8b
Fired on: untrusted_input (changed line: a JSON.parse call)
Backend: openai / gpt-5.6-terra, effort medium, tier balanced
Gate: blocking

## Findings

```json
{"findings":[{"file":"cadence-core/bin/planning/lease-check.mjs","line":265,"severity":"medium","claim":"The new plan-time arm returns `ok:true` when `parsePlanFiles()` reports malformed or missing lease frontmatter, because `frontmatter_issues` is included only as informational output and an empty `declared` list produces no at-risk entries.","failure_scenario":"Run `lease-check --phase 1 --plan 1 --plan-time` against a readable `PLAN.md` with no `files:` declaration (or malformed frontmatter such that `parsePlanFiles()` returns issues and `files: []`). `censusesAtRisk([])` returns no entries, so this branch emits a successful result with `frontmatter_issues` despite having no valid lease to inspect. The workflow is instructed to continue when this check answers `ok:true`, allowing a plan that changes a census subject to bypass the intended pre-execution lease gate."}]}
```

## Disposition

One finding, severity `medium`. The blocking gate fixes blocker/high only, so this
is filed as an open item rather than fixed in this range.

Recorded because it bears on the phase goal: `execute.md`'s `choose_path` already
treats a `frontmatter_issues` entry as a reason to refuse to prove independence.
The plan-time arm does not apply that same conservatism, so the two gates read the
same signal differently.
