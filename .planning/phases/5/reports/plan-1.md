PLAN COMPLETE
Plan: .planning/phases/5/PLAN-1.md
Tasks: 2 of 2
| Task | Commit | Note |
|---|---|---|
| 1: The residue is scoped to one run, and every surface that describes it says so | 4bb725a | `coord`/`coordRow` re-keyed on `corr` at all three sites (end-of-record `last`, COORDINATOR marker collection, paired-bracket `spans.push`); `steps[]` `phase` now taken from the marker's own event, key set unchanged. Measured over ONE record (live `.planning/trace.jsonl` copied into a scratch `--dir`, rendered by d94c79d's `planning.mjs` and by this tree), `trace render --phase 2`: `coordinator.residue_ms` 366,716,303 -> 3,508,747; largest `steps[]` window `commit` @2026-08-13T20:30:13.500Z 280,613,472 ms -> `acceptance_criteria` @2026-08-12T19:35:12.762Z 1,081,370 ms. Scratch two-run fixture (marker+bracket under corr A, 5 h of clock, `phase_start` with a new sha and events under corr B): corr A's last marker window = 120,000 ms, A's own gap, excluding the hours before B. Three readers moved in the same commit (D-17). `report.md` re-pinned 12343 -> 12883; DOCS-CLAIMS REPORT-13/14/15 re-anchored to 140-151 / 141-142 / 152-154 (REPORT-13's 67-69 was already stale). `grep -c "coordinator time" lib/trace-suggest.mjs` still 1; `grep -n residue report.md` carries no phase-span sentence. |
| 2: The MSR-04 falsifier, watched failing at a named SHA | 01b2ca1 | New test in `trace.test.mjs` asserting the AC5 invariant - no `steps[]` window exceeds the tail of the `corr` that opened it - over a two-run fixture built from the file's own `at`/`mark`/`bracket` helpers and the exported `ANCHOR`/`COORDINATOR` constants. Header `WATCHED FAILING AT d94c79d`, the SHA read from git at execution time; `git cat-file -t d94c79d` = commit and it precedes 4bb725a in `git log`. Watched by the header's own recipe: `pass 108, fail 2`, this test failing with `` `commit`: a 18180000 ms window opened by `1-aaa1111`, whose own record ends 120000 ms after the marker ``. The second failure is task 1's re-pinned two-corr fixture, named in the header as expected there. Exits 0 on this tree. |
Deviations: none
Open items: none

Verification run on this tree after task 2: `node --test cadence-core/bin/*.test.mjs`
2151 pass / 0 fail (exit 0); `node cadence-core/bin/self-verify.mjs` `ok:true`,
no problems (exit 0); `npx tsc -p tsconfig.ci.json` exit 0 (`detect-commands`
reports `lint: null`, so typecheck is the only static-analysis command Cadence
can find here).
