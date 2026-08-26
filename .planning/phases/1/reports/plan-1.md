PLAN COMPLETE
Plan: .planning/phases/1/PLAN-1.md
Tasks: 4 of 4
| Task | Commit | Note |
|---|---|---|
| 1. Register `workflow.max_plan_bytes` as a config key | 1edb03be | Key added to `config.schema.json` after `workflow.max_plan_tasks` (int, min 1, default 675000, `plan-size report only` verbatim in `purpose`); catalog row, reach row and the reading-aid phrase added; `weight-budgets.json` re-pinned 12020 -> 12719 and 22998 -> 23586. `config.mjs get workflow.max_plan_bytes` returns 675000. `self-verify` clean except the two `unknown-flag` findings deviation 1 records. `npx tsc -p tsconfig.ci.json` clean. |
| 2. `plan-size` measures the bytes each plan declares | f2697491 | `declaredBytes` in `planning/plan-size.mjs` reads the `files:` frontmatter off the same plan text `planTaskTitles` gets (still one read per plan), sizes each path with `lstatSync` against `dirname(planningRoot)`, counts bytes only when `isFile()`, and puts `bytes` + `absent` on every `plans[]` entry; out-of-grammar frontmatter reports both as null. Absolute and `..`-bearing paths are never stat'd and land on `absent`. Four new tests, 36 pass 0 fail. `plan-size --phase 1` on this repo: PLAN-1.md 476,479 B / absent 0, PLAN-2.md 451,532 B / absent 0. `npx tsc` clean. |
| 3. `--max-bytes` reports the crossing as an `over[]` entry | be1a16a8 | `--max-bytes` added to the `plan-size` row of `CONTRACTS` with `--max-tasks`'s exact disposition; resolved through `requireInt` with a `bad-args` refusal naming D-08; `plan-too-many-bytes` pushed per over-ceiling plan with the five fields `plan-too-many-tasks` uses; `max_bytes` echoed in the envelope and named in `compared` only when a comparison ran. Four new tests, 40 pass 0 fail. Census re-pin: `arg-contract-flag-entries` 191 -> 192. The other three censuses did NOT move, as the plan predicted - `planning-detail-sites` stays 15 (it counts the `e && e.message` idiom; this refusal is a static string), `phase-spelling-callsites` stays 21, `trace-refusal-sentences` unchanged. `arg-contract-adoption` now reports 321 refusals across 192 entries with the new flag exercised on both arms. `self-verify` clean (0 problems) - deviation 1 resolved here. `npx tsc` clean. |
| 4. `/cad-plan` hands `check_size` the ceiling | 4c9b7be2, 518526f8 | 4c9b7be2 (prior run): `workflow.max_plan_bytes` added to the `parse` step's `config.mjs get` batch; the `check_size` command now reads `plan-size --phase {N} --max-tasks {workflow.max_plan_tasks} --max-bytes {workflow.max_plan_bytes}`; a `plan-too-many-bytes` paragraph added beside the tasks one, naming the PLAN file and both numbers out loud and pointing at the `absent` count, with the existing "Not a hard halt" paragraph left untouched so it governs both kinds. No new command block; `seam-calls.test.mjs` still reports exactly 14 invocations for `workflows/plan.md`. `weight-budgets.json` re-pinned 28764 -> 29485. 518526f8 (this run, the authorized fixture edit deviation 2 was halted on): `` `workflow.max_plan_bytes` `` appended to the `workflow.max_plan_tasks` line of the whole-schema completeness fixture in `self-verify.test.mjs:334` - one line changed, the shape the neighbouring lines use, no new fixture line. Task 4's `Verify:` now fully met: `self-verify.test.mjs` 175 pass 0 fail; `self-verify.mjs` `{"ok":true,...,"problems":[]}`; `node cadence-core/bin/test.mjs` 3369 tests, 3368 pass, 0 fail, 1 skipped (see open items); `npx tsc -p tsconfig.ci.json` clean; `lease-check --phase 1 --plan 1` `ok:true` over 14 declared paths. |

Deviations:
- [deviation] Task 1's `Verify:` asserts `self-verify` reports no problems at that
  commit. It could not: the same Action requires the catalog and reach prose to name
  `planning.mjs plan-size --max-bytes` as the reader, and self-verify check 2 parses
  that literal invocation against `CONTRACTS`, where `--max-bytes` did not exist until
  Task 3. Observed exactly two problems at 1edb03be, both `unknown-flag ... plan-size
  --max-bytes`, one per prose file; no `inert-config-key`, no reach finding, no
  weight-budget overage. Continued rather than checkpointed: the plan's own Task 4
  `Verify:` names "no unknown-flag finding for `--max-bytes`" as the thing to confirm,
  so the plan places the resolution at Task 3, and `## Must be true when done` is
  unchanged. RESOLVED at be1a16a8: `self-verify` reports 0 problems.
- [deviation] Task 4's `Verify:` (and `## Must be true when done`) asserts `node
  cadence-core/bin/test.mjs` is green, and CONTEXT D-12 states a new config key lands
  in FOUR places. Both were wrong in the same way: registering ANY new schema key also
  fails `self-verify.test.mjs:315` "placeholder keys expand: <t> prose covers every
  trigger key", whose synthetic root enumerates every schema key by hand so nothing
  reports `inert-config-key`. Observed at 4c9b7be2: exactly one failing test, 3367 of
  3369 passing, the failure being
  `[{"kind":"inert-config-key","file":"cadence-core/config.schema.json","detail":"workflow.max_plan_bytes"}]`.
  So a new key lands in FIVE places, and the fifth is a file this plan's 13-path lease
  did not declare while PLAN-2 did - which is why the prior run stopped here with a
  `structural` checkpoint rather than reaching across the lease. RESOLVED this run: the
  continuation dispatch granted the file (PLAN-2's executor left zero hunks on it, so
  nothing is contested), the one-token edit landed at 518526f8, and the whole suite is
  green. The lease was made true rather than bypassed: `cadence-core/bin/self-verify.test.mjs`
  was added to PLAN-1.md's `files:` list, which is the first remedy `lease-check`'s own
  refusal hint names, and the gate then returned `ok:true` over the staged set. Before
  that amendment it returned
  `{"ok":false,"reason":"undeclared-census-files","undeclared":["cadence-core/bin/self-verify.test.mjs"]}`.
  No commit was made against a red gate.

Open items:
- The reading-aid phrase list at `cadence-core/references/config-reach.md` was already
  stale before this change: `capture-check report only` and `trace window report only`
  are declared by rows and missing from the list. Only `plan-size report only` was
  added, because nothing machine-checks the list and the two absent phrases are
  pre-existing.
- Task 3's list of four at-risk hand-maintained counts missed a fifth at-risk
  assertion in the same file: `phase-spelling.test.mjs`'s `plan-size` READERS row
  `deepEqual`s the whole `r.plans` entry, so the two new fields broke it. Repaired in
  the same commit (`bytes: 0, absent: 1` - the fixture declares `a.txt` and never
  writes it). Not a census count, so `lease-check --plan-time` could not have named it.
- No UAT witness for the over-ceiling arm was produced against this repository's own
  live phase: both of phase 1's plans measure under 675,000 (476,479 and 451,532), so
  `plan-size --phase 1 --max-bytes 675000` comes back `within: true`. The arm is
  covered by unit tests and is reachable by hand with a low `--max-bytes`, which the
  plan's own Notes anticipated.
- D-12 says four registration sites; reality is five. The fifth,
  `self-verify.test.mjs`'s whole-schema completeness fixture, is hand-maintained and
  nothing points a key author at it - the failure only surfaces when the full suite
  runs. Worth stating in the config-registration prose, or worth deriving that fixture
  from the schema; neither is in this plan's scope.
- The full-suite line reads 3368 pass / 1 skipped, not 3369 pass. The skip is
  pre-existing and self-declared: "corpus: pruning this repository's own
  REQUIREMENTS.md needs no hand repair # no completed phase in the live roadmap:
  between milestones, nothing to archive". Zero failures.
- This run did NOT rotate the prior `plan-1.md` aside. It was a continuation of the
  same plan, the checkpoint version was already committed at 587419dd and already read
  by the orchestrator that dispatched this run, and every row and deviation it carried
  is carried forward above - so the record rotation exists to protect is intact in
  history and in this file, and a `plan-1.1.md` would only shadow a superseded
  CHECKPOINT report beside the COMPLETE one in `workflows/report.md`'s glob.
- `.planning/phases/1/PLAN-1.md` is committed by this run alongside the report, for the
  one-line `files:` amendment deviation 2 describes. The plan file is not declarable in
  its own lease, so it cannot ride a task commit.
