PLAN COMPLETE
Plan: .planning/phases/3/PLAN-2.md
Tasks: 4 of 4
| Task | Commit | Note |
|---|---|---|
| 1 - Self-verify's routing checks re-keyed onto the map and the ladder, cells lib deleted | 6250bca7 | Committed by an EARLIER dispatch; not re-run here. Its full per-arm record is in the rotated `reports/plan-2.1.md`. |
| 2 - route-table.json deleted, its readers re-keyed | 250b1ed2 | Committed by an EARLIER dispatch; not re-run here. Its per-arm record is in the rotated `reports/plan-2.2.md`. `INTERNALS.md` was added to the lease under an approved structural checkpoint and the one-sentence correction rode this commit. |
| 3 - config.mjs can remove a key from one layer | ff9542df | Committed by an EARLIER dispatch; not re-run here. Its per-arm record is in `reports/plan-2.2.md`. |
| 4 - stakes is a retired key, and the retirement rail is re-pinned | 2e77b708 | Predicted before running, then observed, every arm matching. `config.mjs check stakes=shipped` -> `ok:false` exit 1, detail `retired in v4.0.0: ... roles.<role>.model and roles.<role>.effort ... /cad-config --roles ... config.mjs unset stakes`; `config.mjs get stakes` -> `reason:"unknown-key"` exit 1; on a scratch `F` = `{"stakes":"critical","granularity":"fine"}` both `config.mjs get --file F workflow.verifier` and `route.mjs resolve --role cad-executor --file F` carry one `warnings[]` entry containing `"stakes"` and `/cad-config --roles`, with the paired negative control (same commands, same isolated `CADENCE_GLOBAL_CONFIG`, a file with no `stakes`) carrying no `warnings` key at all. `grep -c '"stakes"' config.schema.json` -> 0; `grep -c model_aliases` -> 0; the `model.overrides.cad-*` `string_or_null` count -> 6 and the `enum` count -> 0. `node --test retired-keys.test.mjs config.test.mjs config-seams.test.mjs self-verify.test.mjs` -> tests 314 / pass 314 / fail 0. `node cadence-core/bin/self-verify.mjs` -> `{"ok":true,...,"problems":[]}` exit 0 - the reach-table row deleted alongside the schema row is what keeps check 9 green. `npx tsc -p tsconfig.ci.json` exit 0. The whole-tree arm of this task's Verify was the suite-red checkpoint, resolved in the continuation rows below. The `v4.0.0` version string quoted in this row is what the follow-up row F2 corrects to `v3.7.12`. |
| F1 (continuation) - the suite-red repair: route.test.mjs made hermetic about the repo layer | d9bba3a3 | The approved one-line fix from the checkpoint below, committed under the widened lease. Predicted `tests 147 / pass 147 / fail 0`, observed exactly that. Paired negative control, run because an absent `--file` could have suppressed warnings wholesale rather than emptying the repo layer: same command with `--file` pointed at `{"stakes":"critical"}` still returns `warnings` carrying the retirement string, while the absent path returns no `warnings` key - so the assertion is discriminating, not vacuous. `npx tsc -p tsconfig.ci.json` exit 0. `lease-check --phase 3 --plan 2` -> `{"ok":true,...,"staged":1,"declared":22}`. |
| F2 (continuation) - the retirement names v3.7.12, not v4.0.0 | 3e34b842 | The milestone was relabelled from v4.0.0 to v3.7.12 partway through this phase, so `retired-keys.mjs`'s `stakes` row said a version that will never ship. Predicted before running, then observed: `node --test retired-keys.test.mjs` -> `tests 22 / pass 21 / fail 1`, the ONE failure being the byte-identity pin with `actual: ee1ac81c...`, `expected: fdfe6df6...` and every other case green - which is the falsifiable proof that the twelve edits were a version string and nothing else. After re-cutting the pin: `node --test retired-keys.test.mjs config.test.mjs config-seams.test.mjs` -> `tests 152 / pass 152 / fail 0`; `config.mjs check stakes=shipped` -> `ok:false` exit 1 whose `error` reads `retired in v3.7.12: ...`; `config.mjs get workflow.test_command` over this repo's live config carries the same corrected string in `warnings[0]`. `npx tsc -p tsconfig.ci.json` exit 0; `self-verify.mjs` -> `ok:true`, `problems: []`, exit 0. `lease-check` -> `{"ok":true,...,"staged":4,"declared":22}`. |

## Whole-suite result

`node cadence-core/bin/test.mjs`. Resolved at its only consumer:
`config.mjs get workflow.test_command` -> `null`, and there is no root
`package.json`, `Makefile` or `pyproject.toml`, so the project's own runner is
what ran.

```
tests 3751 / suites 0 / pass 3751 / fail 0 / duration_ms 23670
exit 0
```

Predicted `3751 / 3751 / 0` before running, on the reasoning that neither
continuation commit adds or removes a test case; observed exactly that. The
suite was red at `3750 / 1` when this plan checkpointed, and row F1 is the only
thing between those two numbers.

## The suite-red checkpoint, and how it was closed

The checkpoint below is RESOLVED. `cadence-core/bin/route.test.mjs` was added to
PLAN-2's `files:` lease by the coordinator and the proposed one-line fix landed
as commit d9bba3a3 (row F1). The record of what was found is kept verbatim
because it is the reasoning the lease widening was granted on.

### What was found, measured rather than reasoned

`route.test.mjs:933-934` spawned `route.mjs resolve --role cad-planner` with
**no `--file`**, so the resolve read THIS repository's own
`.planning/config.json` - which carries `stakes: "critical"`. Task 4 makes that
key retired, so every read face now folds one `retiredKeysIn` string onto its
`warnings`, and `'warnings' in r` flipped from false to true. Measured directly,
outside the test:

```
CADENCE_GLOBAL_CONFIG=<absent> route.mjs resolve --role cad-planner
  -> warnings: ["config key \"stakes\" was retired in ... and is ignored: ..."]
CADENCE_GLOBAL_CONFIG=<absent> route.mjs resolve --role cad-planner --file <empty {}>
  -> no `warnings` key at all
```

### Cause, and why it was nobody's mistake

The test is deliberately hermetic about the GLOBAL layer
(`CADENCE_GLOBAL_CONFIG: NO_GLOBAL`, `delete env.CADENCE_TEST_SEAM`, with the
comment "hermetic: never inherit an open seam") and simply never isolated the
REPO layer, because until Task 4 nothing this repo's config held could add a
warning. PLAN-2's Notes anticipated the consequence in general - "this
repository's own `.planning/config.json` fails `config.mjs validate` on its
`stakes` row and every read face warns about it" - and PLAN-1's Notes lock the
fixture in place: "`.planning/config.json` in this repository carries
`stakes: "critical"` ... No task in any of the three plans edits it: after
PLAN-2 it is the live fixture for AC2's human-verify." What neither anticipated
is that ONE test asserts the absence of warnings on a read face pointed at that
very file.

### The fix, and why the alternatives were worse

The repo layer is now isolated the same way the global one already was, at
`route.test.mjs:933-941`: the resolve is given
`--file <join(dir, 'no-repo-layer.json')>`, an absent path inside the test's own
tmpdir. An absent path is a silent absence at the config-merge seam, so the test
still proves exactly what it says it proves - the shipped
`review.triggers.risk_surface.gate` default stands with the sentinel unset, and
the same hostile schema DOES take with `CADENCE_TEST_SEAM=1`.

- Running `config.mjs unset stakes` on `.planning/config.json` also worked, and
  was refused on the record: PLAN-1's Notes and PLAN-3's human-verify (its lines
  235-239 observe the key leaving that file during `/cad-config --roles`) both
  require the row to survive until the migration is exercised.
- Moving the fix to PLAN-3 needed the same single lease edit AND left the suite
  red between two plans.

Deviations:
- [deviation] PLAN-2's `## Must be true when done` asserts
  "`node cadence-core/bin/config.mjs check stakes=shipped` is refused with a
  message naming `v4.0.0`", and Task 4's `Verify:` asserts the same detail
  "matches `retired in v4.0.0`". Both are now false on purpose: the milestone was
  relabelled from v4.0.0 to v3.7.12 partway through the phase, with 4.0.0
  reserved for a later rewrite, so the criterion names a version that will never
  ship. The refusal now reads `retired in v3.7.12: ...` and everything else the
  criterion requires - the roles block and `/cad-config --roles` - is unchanged.
  Directed by the coordinator on the return dispatch; the `.planning/` text was
  left as written, on instruction.
- [deviation] (RESOLVED) PLAN-2's `## Must be true when done` says "The whole
  suite and `npx tsc -p tsconfig.ci.json` are green after every task", and Task
  4's `Verify:` ends "then the whole tree: `node cadence-core/bin/test.mjs`
  passes". Measured, that could not hold inside the lease as PLAN-2 declared it:
  retiring `stakes` makes every read face warn over this repository's own
  `.planning/config.json`, and `route.test.mjs:938` asserted a resolve over that
  file carries no `warnings` key. The plan's own Notes require the config row to
  stay, so the only repair was in `route.test.mjs`, which `lease-check` refused.
  The coordinator added that file to the lease; the repair is row F1.
- [deviation] (carried) Task 4's Action says to "remove any remaining read of
  `keys.stakes`" in `prose-agreement.test.mjs`. There is none - PLAN-1 already
  cleared it (CONTEXT D-15 recorded the read at `:154-155`, and
  `grep -n "keys\.stakes\|keys\['stakes'\]"` across `cadence-core/bin/*.test.mjs`
  now matches only `config.test.mjs:351-352`, which this task rewrote). The file
  is untouched and is not in the commit; its four remaining `stakes` mentions are
  prose comments about gates that block "at every stakes level", which are
  PLAN-3's sweep.
- [deviation] (carried, RESOLVED) The prior dispatch's structural checkpoint -
  Task 4's schema-row deletion files `unknown-reach-key` against
  `references/config-reach.md:106` - was APPROVED, the file was added to PLAN-2's
  lease, and the one-row deletion rode Task 4's own commit. `self-verify.mjs`
  returns `ok:true` with an empty `problems` array at 2e77b708.
- [deviation] (carried from the earlier dispatch) Task 2's `Verify:` asserted
  `self-verify.mjs` reports `ok:true` after `route-table.json` is deleted; check
  3b filed `missing-internals-path` for `INTERNALS.md`'s citation of the deleted
  file. Approved, `INTERNALS.md` added to the lease, corrected in Task 2's commit.
- [deviation] (carried from the earlier dispatch) Task 2's Action says to reword
  header comments in `gate-agreement.test.mjs`; PLAN-1 had already done it and
  the file names `route-table.json` nowhere, so nothing changed there.

Open items:
- Static analysis: `workflow.lint_command` is null and
  `planning.mjs detect-commands --root /code/cadence` reports `lint: null`, so
  there is no lint command Cadence can find for this project. `typecheck` is
  `npx tsc -p tsconfig.ci.json` and exited 0 after Task 4 and after both
  continuation rows.
- Process slip, recorded because the count is auditable: the full suite ran
  TWICE on this dispatch rather than once. The second run added nothing - it was
  to capture the exit code, which `fail 0` had already settled. No repair round
  was needed and nothing changed between the two runs.
- The version relabel was swept across the four leased files that carried it and
  a whole-tree `grep -rn 'v4\.0\.0'` outside `.planning/` now returns nothing, so
  no stale label was left behind a lease boundary. Whether any `.planning/`
  document still says v4.0.0 was deliberately not touched, on instruction.
- The `stakes` row's `since` is the ONLY version string in `retired-keys.mjs`
  that this relabel could reach; the other twelve rows are `v2.7.0`, `v3.2.0` and
  `v2.0.0` and are historical, so none of them moved.
- Declined fuller shapes in Task 4, all of which the `Verify:` passes without:
  `replacement` stays `null` on both the new `stakes` row and the re-pointed
  `model.profile` row rather than naming `roles.<role>.model`, because that field
  renders as `use "<key>" instead` and `roles.<role>.model` is a placeholder the
  write face would refuse - pointing at it would re-create the exact D-07 defect
  being fixed. The pointer rides `detail`, which both faces render verbatim, so
  both rendered strings carry it as the plan requires.
- Task 4 touched three things its own Action does not name, each a direct
  consequence of the schema row leaving and each inside the lease.
  `config.mjs:270-272`'s comment said `src: "repo"` is carried by "33 keys,
  `stakes` and `granularity` among them" - it is 32 now, and the same sentence is
  repeated at `config.test.mjs`'s SCP-01 negative control, which now asserts
  `srcRepo.length === 32` so the count cannot rot silently again.
  `config.test.mjs`'s `check: a retired KEY names its replacement` row asserted
  `model.profile`'s message contains `stakes` and all three level values, which
  D-07 makes false. And `validate: this repository own config layer passes the
  new grammars` asserted `ok:true` over `.planning/config.json`; it now asserts
  the error LIST is exactly `['stakes']` while that file still carries the key,
  so the grammar half it was written for still fails loudly and a second entry is
  still a regression.
- Two fixture SCHEMAS in `config.test.mjs` (the SCP-01 `repo_only` derivation and
  the unregistered-grammar row) used `stakes` as the name of their unmarked
  sibling key. That stopped working for a reason worth recording: `checkPairs`
  consults `retiredKeyError` BEFORE the schema lookup (`config.mjs:247-253`,
  deliberately), so a retired name is refused even against an injected schema
  that declares it. Both moved to `workflow.research`.
- `retired-keys.mjs`'s eight `risk.override.*` `detail` strings are still in the
  false state the pin's docblock documents. The re-cut digest deliberately does
  not correct them; PLAN-2's Notes make that a decision this phase was not asked
  to take.
- `config.schema.json:41` (`workflow.verifier`'s purpose, "the stakes level
  decides whether it runs") and `:105` (`waive_routing_floor`'s purpose, "the
  level holds at the configured `stakes`") still name the level in PROSE, and
  `references/config-reach.md`'s lines 180-192 still name it in the Honoured-by
  column. Nothing mechanical reads any of them - self-verify's prose walk is
  `.md` only and check 9 reads the Key column alone - and both files are PLAN-3's
  sweep for exactly this text.
- `config.mjs:472` and `:488` keep two historical comments that mention the level
  (`get stakes __proto__` as the measured pre-repair answer, and the sentence the
  twelve trigger keys used to carry). Both are records of what USED to happen and
  are still true as history, so they were left as found.
- Carried from the earlier dispatch and still open: `DESIGN.md:617` states the
  config seam's surface as `validate | check | set | get | keys`, now short by
  one; `README.md:112` still links the deleted `cadence-core/route-table.json`
  and describes the 18-cell grid; `route.mjs:78-79` and several `lib/*.mjs`
  comments still cite `route-table.json` as a live file. None is in this plan's
  lease; all are PLAN-3's.
