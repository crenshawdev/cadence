PLAN COMPLETE
Plan: .planning/phases/3/PLAN-3.md
Tasks: 3 of 3
| Task | Commit | Note |
|---|---|---|
| 1: The three `## Traceability` locators in `lib/planning-files.mjs` | b8cccc8 | `parseRequirements`, `setReqStatus` and `insertReqRows` all take BOTH ends from `sectionSpan`; locator-only, D-14 widening stated at each site. 8 new `traceability:` rows, 6 watched failing against the pre-phase tree (the other 2 are the companion "still works" assertions). |
| 2: `## Shipped` and the Traceability filter in `lib/milestone-prune.mjs` | 28b1eb5 | The Traceability row filter, the `## Shipped` lookup and the append-after-last-row loop's END all bounded by `sectionSpan` (D-08/D-13); a fenced-only `## Shipped` now takes the create-a-real-section arm. 3 new rows, all watched failing against the pre-phase copies of both libs. |
| 3: The seam's own answer on a document whose sections are only fenced | e2ff4f5 | 2 new seam rows on `scaffold()`/`run()`, AC7 at the seam. Falsifier observed by hand on the pre-phase libs: the close wrote `\| STOR-01 \| 1 \| Complete \| v1.2.0 \|` INSIDE the fenced `## Shipped` table and deleted the example's Traceability row, while leaving the fenced `## Active` bullet alone. |

Verification: `node cadence-core/bin/test.mjs` 2333 pass / 0 fail (self-verify and the live-REQUIREMENTS.md corpus row included); `node --test` over planning-files/planning/milestone-prune 728 pass / 0 fail. Static analysis: `detect-commands` reports `lint: null`, `typecheck: npx tsc -p tsconfig.ci.json` - the typecheck was run clean before each of the three commits; there is no lint command Cadence can find in this project.

`## Must be true when done`: all five lines hold. `planning.test.mjs` did not redden at any point, so PLAN-1's lease was never reached.

Deviations: [deviation] the dispatch names branch `cadence/phase-3-plan-3`; the harness created this worktree on `worktree-agent-a994e3eb42c543ed5` and no `cadence/phase-3-plan-3` ref exists anywhere in the repo. Proceeded on the harness branch rather than halting: the worktree rule's hazards are provably absent - the fork point is `0e7844b`, this phase's `PLAN-3.md` and `CONTEXT.md` are present, and the branch is per-agent and unprotected - and no ref was created, renamed or repaired. The three commits for this plan are on `worktree-agent-a994e3eb42c543ed5`, range `0e7844b..e2ff4f5`.

Open items:
- Declined widening `parseRequirements` to SKIP fenced lines INSIDE a real `## Traceability` section, the way `parseRoadmapPhases` skips them inside `## Phases`. The plan scopes this task to the LOCATOR ("the row regex ... stay exactly as they are") and every `Verify:` line is met without it, so a fenced example table nested inside a real Traceability section still contributes rows. Same for the append scan in `archiveRequirements`, which still counts a fenced `|` line inside `## Shipped` as the last row. Worth a task that states the intended answer for a nested example.
- `lib/milestone-prune.mjs`'s bullet-scan comment cited `lib/planning-files.mjs:388-391` for the section cut; that line reference was already stale and the fix moved the cited code, so it was replaced with a citation by NAME (`sectionSpan`) rather than by line. No other line-number citation in the two edited files pointed into the changed ranges.
