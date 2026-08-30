# Task: check-readme-claims

## What shipped

- Audit of README.md claims against the live tree at c8078000. Read-only: no
- code or prose changed, so this range carries no commits.
- Every falsifiable claim in README.md was checked against the artifact it names.
- All of them hold.
- Counts and grids
- "five commands out of twenty-eight" (L50) and "28 skills and 6 agent roles
- across 19 rung files" (L136): skills/ holds 34 directories, 6 of which are
- *-contract internal role contracts, leaving 28 user-invocable. agents/ holds
- 19 files; route-table.json `roles` names 6. LINEAGE.md L17 states the same
- split ("34 (28 user-invocable, 6 contract)").
- "a grid of 18 cells" (L109): route-table.json `cells` is 3 stakes levels x 6
- roles = 18. "At solo the planner runs Sonnet at high" - cells.solo.cad-planner
- is sonnet/high. "At shipped it runs Opus" - opus/high. "At critical it runs
- Opus at xhigh and a retry goes to max" - opus/xhigh/max. All exact.
- "The rungs are low, medium, high, xhigh, max" (L111): matches `rung_order`.
- The review-gate table (L117-122) matches route-table.json `review` cell for
- cell across all twelve pairs, risk_surface blocking at every level included.
- "off at solo and on at shipped and critical" (L132): `verify` is
- {solo: off, shipped: on, critical: on}.
- "the controls, eight of them" (L54): the table below it has exactly 8 rows.
- "eight named surfaces ... auth, billing, secrets, migrations, destructive
- operations, concurrency, API contracts, untrusted input" (L59, L124):
- `risk_surface_categories` holds those 8 under their machine names.
- Paths, keys and commands
- Every linked file exists: METHOD.md, INTERNALS.md, DESIGN.md, LINEAGE.md,
- MANIFESTO.md, NOTICE.md, LICENSE, docs/{WORKFLOW,EVIDENCE,COST,EXAMPLE,
- DISCOVERY}.md, docs/figures/phase-loop.svg, all three docs/screenshots/*.png,
- cadence-core/references/COMMANDS.md, cadence-core/route-table.json,
- .github/workflows/test.yml (the badge target).
- "a PreToolUse hook, cadence-core/bin/git-guard.mjs" (L60): hooks/hooks.json
- registers exactly that command under PreToolUse/Bash.
- `git.on_protected` (L61) is an enum ask|refuse|allow defaulting to ask.
- `/cad-config stakes=shipped` (L102): cad-config's argument-hint admits
- `<key>=<value>`; `stakes` is a schema enum solo|shipped|critical.
- `model.escalate_on_failure` "off by default" (L113): schema default false.
- `review.triggers.risk_surface.surfaces` (L126) exists as a schema key.
- "planning.mjs risk-check run" (L128) is a live subcommand; its envelope
- carries checked/matches/inconclusive and a trace.written flag, as described.
- "up to four independent voices" (L79): `review.reviewers` is an array_enum
- over exactly claude-subagent, openai, gemini, deepseek.
- "/plugin install cadence@cadence" (L27): marketplace.json names the
- marketplace `cadence` and the plugin inside it `cadence`.
- "no npm install, ever" (L30): the repo root carries no package.json.
- The forge-CLI requirement (L30) matches config-catalog's `git.forge_provider`
- row, which maps forgejo->tea, github->gh, gitlab->glab.
- Numbers with a history
- "what the guard reads now is eighty-five lines" (L93): git-segments.mjs is
- exactly 85 lines.
- "the 2,251 lines v2.2.0 deleted" (L93): CHANGELOG L3264 under [2.2.0] names
- that figure, and DESIGN.md L591 states the 2,251-for-85 replacement.
- "as of v3.2.0" for narrowing the surface list (L126): the [3.2.0] entry
- introduces `review.triggers.risk_surface.surfaces` and the detect-surfaces
- structural scan.
- "As of v3.5.0 the check is a seam" (L128): the [3.5.0] entry introduces
- `risk-check run` and the record-before-completion rule.
- "that detector is gone as of v2.7.0" (L130): the [2.7.0] entry is the
- filenames-instead-of-behavior removal.
- "about 3% of GSD's documentary mass, measured 2026-07-10 against GSD commit
- d010ea1" (L136): LINEAGE.md L5 and L15 give d010ea1, 2026-07-10, and
- 1,113,812 -> 33,621 words, ~3%.
- "CI fails the build when the prose drifts from the code" (L138):
- .github/workflows/test.yml runs self-verify.mjs as its own job, described in
- the workflow as the prose<->code drift linter.
- Two claims are historical measurements with no artifact in the tree to check
- them against, so they are unverifiable here rather than wrong: the keyword pass
- "measured on this repo on 2026-08-13" that false-positived auth on sixteen hits
- of the word session (L126), and the "four rounds of adversarial review found
- four ways around" isPlainPush (L93). Both are anecdote about past runs, not
- statements about the current tree, so neither can go stale the way a path or a
- count can.
- No edits were made and none are recommended.

## Commits

| Task | Commit | Description |
| --- | --- | --- |

## Files

### Task 1: check-readme-claims

- **Files:** 
