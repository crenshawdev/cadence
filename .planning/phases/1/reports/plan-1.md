PLAN COMPLETE
Plan: .planning/phases/1/PLAN-1.md
Tasks: 5 of 5
| Task | Commit | Note |
|---|---|---|
| 1 The resolver stops returning a list that protects nothing | 567b69e | One `namesABranch` predicate over both spellings; six AC1 rows plus a no-empty-entry sweep; header names all five readers. Falsified: 4 of the new rows go red against the reverted resolver. |
| 2 The guard refuses a commit on `main` under a string `""` | 064b479 | Ask + refuse-alias decision under `""`, plus the `[""]` array spelling; reason matched on `"main" is a protected branch`. Falsified: red against the pre-fix resolver. The `[]`-is-unguarded row untouched and green. |
| 3 `land-cleanup` reaps against a real base under a string `""` | 5e7006e | New row asserts `base === "main"` under `protected_branches: ""` with no `base_branch` and no `--base`. Falsified: reports `''` against the pre-fix resolver, exactly as the plan predicted. |
| 4 `issue-check` reports referenced issues under a string `""` | d1f9bf3 | Row runs with no `--base` and asserts `referenced` carries 42/47/99 with their states. Falsified: red against the pre-fix resolver. |
| 5 The reach table names all five readers | b4c8026 | Reach row names all five and points at `bin/lib/protected-branches.mjs`; Reach cell left `universal`; `weight-budgets.json` re-pinned 21131 -> 21453 in the same commit. self-verify exits 0 with `problems: []`. |

Verification (whole plan): `node --test cadence-core/bin/*.test.mjs` 2226 tests,
2225 pass, 0 fail, 1 skipped (pre-existing). `node cadence-core/bin/self-verify.mjs`
exits 0, `problems: []`. `npx tsc -p tsconfig.ci.json` (the typecheck
`detect-commands` reports; `lint` is null for this project) clean before every
commit. AC1 measured directly through `node -e`: `""` -> `['main','master']`,
`" "` -> `['main','master']`, `[""]` -> `['main','master']`, `["","main"]` ->
`['main']`, `[]` -> `[]`, `"release"` -> `['release']`.

Deviations: none
Open items: none
