PLAN COMPLETE
Plan: .planning/phases/1/PLAN-2.md
Tasks: 3 of 3
| Task | Commit | Note |
|---|---|---|
| 1: The one parse drops the marker and reports the cut | b99a9fcd | `readReadsRecords` imports `isReadsRotationMarker`, keeps the marker out of `records` and returns `rotated: {file, ts}` only where one was seen. Falsified: with the filter removed the new row reports `calls` 18 vs 17 and `coordinator` 2 vs 1. `trace-suggest.test.mjs` 50/50; `npx tsc -p tsconfig.ci.json` clean. |
| 2: Both reader envelopes name the record and state the cut | bf49cb0e | Nested `reads: {file, rotated?}` on every `ok` arm of `cmdReads` (absent arm included) and on the `trace suggest` envelope, sourced from the `readReadsRecords` result each already holds. Two new rows: both faces carry the identical object, `trace suggest`'s top-level `rotated` is absent, `unresolved` 0 and `coordinator` 1; an absent record still names its path with no rotation. `trace-suggest.test.mjs` + `read-trace.test.mjs` 119/119 (the flagged/unflagged shared-half equality still holds); typecheck clean. |
| 3: An ignore rule covers the reads record, its sibling and its claim files | 62f4c818 | `READS_IGNORE_LINES` derives four rules from `READS_FILE`, `ROTATED_READS_FILE` and `READS_CLAIM_FILE`; each is asked through the same git-then-literal reader pair the sibling rule uses, folded into `ignored`, reported on a new `reads_lines` field, and written as its own commented block containing only what is missing. This repo's `.gitignore` gained the sibling and the two claim lines beside the live line it already carried. Three pre-existing rows updated (their fixtures are half-covered under the new definition of covered), four new rows added. `planning-trace-ignore.test.mjs` 15/15; typecheck clean. First run of the new rows failed on my own `ignoreSource` helper returning `<source>:<line>:<pattern>` rather than the source alone - helper bug, fixed, not a fact about the plan. |
| 3 (cont.): re-pin the census citation task 3 moved | 3d470fea | The checkpoint below, resolved by the coordinator widening the lease to both cells. `TRACE_IGNORE_LINE` verified at the new range before the edit: `cadence-core/bin/planning/trace.mjs:235` reads `const git = gitIgnoreState(root, TRACE_IGNORE_LINE);` and 235-237 is byte-identical to the old 197-199. Both cells moved together - `citation-census.test.mjs`'s EXECUTE-22 `line`/`start`/`end` and `.planning/DOCS-CLAIMS.md:867`'s third cell. `citation-census.test.mjs` 5/5; typecheck clean; lint is null (`detect-commands` finds no lint command), so it was skipped. |

AT THE CHECKPOINT (prior run, before `3d470fea`) - full suite
(`node --test cadence-core/bin/*.test.mjs`, the command `CONTRIBUTING.md:16`
names - `workflow.test_command` is null): ONE failing row, and it is outside
this plan's lease.

`cadence-core/bin/citation-census.test.mjs` "grammar two: each pinned row
resolves to the code it names" fails because task 3 inserted 38 lines into
`cadence-core/bin/planning/trace.mjs` above `cmdTraceIgnore`, moving the
`TRACE_IGNORE_LINE` citation `.planning/DOCS-CLAIMS.md`'s EXECUTE-22 row pins
from `197-199` to `235-237`. The three pinned lines are byte-identical and still
in that order; only their numbers moved.

The repair is two line-number cells that must move together, because grammar one
asserts the DOCS-CLAIMS `line` cell and the test's declared `line` are equal:

- `.planning/DOCS-CLAIMS.md:867`, the EXECUTE-22 row's third cell: `197-199` -> `235-237`
- `cadence-core/bin/citation-census.test.mjs:227-229`, the EXECUTE-22 entry:
  `line: '197-199', start: 197, end: 199` -> `line: '235-237', start: 235, end: 237`

Neither file is in this plan's declared `files:` list, so neither may ride a
commit of mine. The plan's Notes anticipated exactly this class of re-pin and
declared four test files for it - `self-verify.test.mjs`, `trace.test.mjs`,
`planning-lease-check.test.mjs`, `phase-spelling.test.mjs` - but
`citation-census.test.mjs` and `.planning/DOCS-CLAIMS.md` are not among them.

Checkpoint RESOLVED. The coordinator added `cadence-core/bin/citation-census.test.mjs`
and `.planning/DOCS-CLAIMS.md` to this plan's `files:` list; the re-pin landed as
`3d470fea` and the full suite is green: `node --test cadence-core/bin/*.test.mjs`
3527 tests, 3526 pass, 0 fail, 1 skipped (pre-existing).

Deviations: [deviation] the plan's Notes assert that the census surfaces at risk
for work under `cadence-core/bin/planning/` are the four test files it declares,
and that declaring them "is what lets the executor re-pin one in the same
commit". What is actually true is that the surface this work moved is a fifth
one, `citation-census.test.mjs` plus `.planning/DOCS-CLAIMS.md`, neither
declared. I committed all three tasks (each Verify passes) and stopped at the
suite rather than staging an undeclared file.
Open items: `cadence-core/workflows/report.md:25` states "`reads --join` measures 2,494 B" as a dated measurement, and the nested `reads` key grows that response by the length of the record's absolute path. `report.md` and `prose-agreement.test.mjs:2481` are plan 3's lease, not this plan's, so the re-measurement belongs there.
