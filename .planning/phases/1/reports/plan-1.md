PLAN COMPLETE
Plan: .planning/phases/1/PLAN.md
Tasks: 4 of 4 plus 3 of 3 blocking-gate fixes (risk_surface, 279466b..HEAD)
  plus 1 of 1 defect found by running the shipped gate against this repo
| Task | Commit | Note |
|---|---|---|
| 1: the diff detector, born distinct from the scoping aid | ba593f4 | lib/risk-diff.mjs + 10 test() rows; surface-scan.mjs header names the split, scanTree unchanged and its own suite green. |
| 2: `risk-check run` - the record written on every invocation | bbffe32 | dispatch-table entry, CONTRACTS row, TWO_WORD entry; 6 seam rows over a scratch git repo. |
| 3: `risk-check status` - completion requires the record | 3eb0971 | 7 rows incl. the frozen-bytes evidence arm; live run against this repo's `.planning/` quoted verbatim in the commit body (ok:false, plans 1 and 2 missing, exit 1). |
| 4: both completion paths call the seam | 23daf54, 7ac6a83 | 23daf54: both fire sites re-pointed, both ENFORCEMENT rows watched to FAIL against the pre-edit files (0 occurrences of `risk-check` and of `written: false` at HEAD~1); budgets re-pinned. 7ac6a83: the `redactUrl` census in planning.test.mjs moved 6 -> 7 sites and 1 -> 2 wrapped, naming planning.mjs:3108 as the second wrapped site and why (a git failure detail can quote back a remote URL with credentials - the same EXP-01 rail as `no-staged-set`). Neither call site respelled, the pin stays a COUNT. |
| gate fix 1: `risk-check status` reads the record's verdict fields | d6cd001 | `checked`/`inconclusive` carried onto the record rows; only `checked:true` satisfies, new `unchecked` state; `inconclusive:true` satisfies by decision, stated in a comment at the map. 3 rows watched to FAIL first. |
| gate fix 2: range identity is the resolved commit pair | eec7528 | `resolveRange` resolves both refs to commit ids; `run` records `base_id`/`head_id` and diffs by them, `status` compares ids and refuses an unresolvable ref with `unresolved-range`. 4 rows watched to FAIL first; 3 range rows moved onto real repo fixtures; redactUrl census 7->8 sites, 2->3 wrapped. |
| gate fix 3: a gitlink section is unread, not clean | 86e351c | `160000` mode marker + `Subproject commit` pointer line land the section in `unreadable`, so a submodule bump reports `inconclusive:true`; the pointer line is kept out of `changed`. 3 rows watched to FAIL first, built from real `git diff` bytes. |
| gate fix 4: the gate reads THIS run's brackets, not every cycle's phase 1 | b481fb3 | `risk-check status` walked every `cad-executor` bracket in an append-only trace, so `--phase 1` reached seven prior cycles' phase 1 and demanded a record for a v3.4.x plan 2 that predates the seam - enforcement unsatisfiable on any project with more than one milestone. Both scans (brackets AND records) now key on `renderTrace`'s own `corr`, the same identity triage-gate.md's re-arm cap uses; `renderTrace` already exposed it, so lib/trace.mjs is untouched. 3 rows watched to FAIL first, on frozen real bytes from the v3.4.x record. |

Task 4 verification, re-run in full after 7ac6a83:
- `node --test 'cadence-core/bin/*.test.mjs'` - 1896 tests, 1896 pass, 0 fail.
  Predicted before running: the census row passes and the suite goes
  1895/1896 -> all pass. Observed exactly that.
- `node cadence-core/bin/self-verify.mjs` - `{"ok":true,...,"problems":[]}`,
  exit 0. No `budget-overrun`, no `unbudgeted-surface`, no
  `unknown-subcommand`, no `unknown-flag`.
- `git diff --stat cadence-core/route-table.json cadence-core/config.schema.json`
  - empty, both against the working tree and against the pre-phase commit
  279466b, so no gate, key or cell moved.
- `grep -c 'risk-check run'` - execute.md 1, task.md 1.
- `grep -c 'triage-gate.md'` - execute.md 3, task.md 1, the same counts those
  files carried at 3eb0971 (checked with `git show`).
- Static analysis: `detect-commands` reports `lint: null` and
  `typecheck: npx tsc -p tsconfig.ci.json`; the typecheck exits 0 with no
  diagnostics. No lint command Cadence can find, so that half is an answer
  rather than a failure.

Blocking-gate fix verification (the three adjudicated `risk_surface`
survivors on 279466b..HEAD, closed one commit each):
- `node --test 'cadence-core/bin/*.test.mjs'` - 1905 tests, 1905 pass, 0 fail
  (1896 before; +10 new rows, one converted in place). Predicted before each
  fix landed: the new rows fail and nothing else does. Observed exactly that -
  3 red for fix 1, 4 for fix 2, 3 for fix 3, in every case only the new rows.
- `node cadence-core/bin/self-verify.mjs` - `{"ok":true,...,"problems":[]}`,
  exit 0, 22 checks.
- `npx tsc -p tsconfig.ci.json` - clean. `detect-commands` still reports
  `lint: null`, so there is no lint command Cadence can find.
- `git diff --stat 279466b..HEAD -- cadence-core/route-table.json
  cadence-core/config.schema.json` - empty. No config key, flag or route-table
  cell moved, and the `--base`/`--head` redaction was not touched: the
  adjudicated non-survivors stay non-survivors.
- Two record-shape assertions were updated rather than watched to fail
  (`plans[0].records` deepEquals in the phase-wide rows): the rows now carry
  `checked`, `inconclusive`, `base_id` and `head_id`, which is the fix itself.
- Three status rows naming a range moved from bare strings onto real
  repository fixtures, because range identity is now the resolved commit pair
  and a fixture whose refs resolve to nothing cannot exercise it.

Defect-fix verification (b481fb3, the gate run against this repository):
- Watched to fail first: with the fix reverted (`git stash push -- planning.mjs`),
  the new scoping row reported
  `{"ok":false,"reason":"risk-record-missing",...,"missing":["2"]}` - the plan 2
  of a v3.4.x cycle, exactly the live defect. Predicted before running: rows 1
  and 3 red with `missing:["2"]`, row 2 (the not-a-blanket-pass negative) green.
  Observed exactly that.
- `node --test 'cadence-core/bin/*.test.mjs'` - 1908 tests, 1908 pass, 0 fail
  (1905 before; +3 rows).
- `node cadence-core/bin/self-verify.mjs` - `{"ok":true,...,"problems":[]}`, exit 0,
  22 checks.
- `npx tsc -p tsconfig.ci.json` - clean. First run reported one TS2741 on the
  `thisRun` predicate's JSDoc param (`Record<string, any>` does not satisfy a
  REQUIRED `corr`); the param is `{corr?: any}` and the second run is silent.
  `detect-commands` still reports `lint: null`.
- The real command, against this repo at 86e351c:
  `node cadence-core/bin/planning.mjs risk-check status --phase 1 --plan 1 --base 279466b --head 86e351c`
  ->
  `{"ok":true,"phase":1,"plans":[{"plan":"1","completed":2,"state":"recorded","records":[{"base":"279466b","head":"HEAD","base_id":null,"head_id":null,"checked":true,"inconclusive":false},{"base":"279466b","head":"86e351c","base_id":"279466bcaed091d1c493497d9628ce82cfd61785","head_id":"86e351c2121d492dcb2cd5c94d7dbd6de6490538","checked":true,"inconclusive":false}],"wanted":{"base":"279466b","head":"86e351c","base_id":"279466bcaed091d1c493497d9628ce82cfd61785","head_id":"86e351c2121d492dcb2cd5c94d7dbd6de6490538"}}]}`,
  exit 0. The phase-wide arm (`--phase 1` alone) is `ok:true` on the same row.

Deviations:
- [deviation] the dispatch named `cadence-core/bin/planning.test.mjs` for the
  failing-capable rows; every `risk-check status` row and its fixture harness
  (`FROZEN_PHASE_1`, `traceFixture`, `recordLine`, `riskStatus`) live in
  `cadence-core/bin/risk-diff.test.mjs`, so the three rows landed there beside
  them rather than duplicating the harness into a second file. Both files are on
  the plan's declared `files:` list and both run under
  `node --test 'cadence-core/bin/*.test.mjs'`.

Open items:
- A `cad-executor` return carrying NO correlation id at all is now out of scope
  for the phase-wide arm: it cannot be attributed to this run, so it no longer
  holds the gate open. The named-range arm is unaffected - the caller's plan is
  always required - and the trace's own writer always stamps a `corr`, so this
  is reachable only through a hand-edited record.
- CLOSED by gate fix 1 (d6cd001): `risk-check status` treated presence as
  satisfaction, so a record whose own `checked` was `false` satisfied the gate.
  The review's first high finding is the same defect, and `status` now refuses
  any record that is not `checked:true`.
- The seam returns `inconclusive` as a bare boolean and does not say WHICH half
  made it true (a binary file, a body with no readable hunk, or a gitlink). The lean shape
  meets every `Verify:` row - the fire sites act on the boolean alone - so the
  reason string is left for a task that states a caller who needs it.
- The `redactUrl` census now pins THREE wrapped sites by count alone (8 idiom
  uses, 3 wrapped, after eec7528), so it cannot say which one lost its wrapper
  when it goes red; the assertion message names all three candidates instead. A per-site pin would need an anchored pattern
  per call site, which is more surface than the row's job.
- A record written before eec7528 carries no `base_id`/`head_id`, so it can
  never satisfy a NAMED range and reports `stale`. That is the safe direction
  and the only available one - the spelling it does carry cannot say which
  commits it meant - but any phase holding such a record needs one
  `risk-check run` to re-record before its status call can pass.
- `risk-check status`'s range arm now needs to run inside the repository whose
  refs it names, since it resolves them. Both documented call sites already do;
  a caller invoking it from elsewhere gets `unresolved-range` rather than a
  wrong answer.
