PLAN CHECKPOINT: structural
Plan: .planning/phases/3/PLAN-2.md
Tasks: 3 of 4
| Task | Commit | Note |
|---|---|---|
| 1 - Self-verify's routing checks re-keyed onto the map and the ladder, cells lib deleted | 6250bca7 | Committed by the PRIOR dispatch; not re-run here. Its full per-arm record is in the rotated `reports/plan-2.1.md`. Verify, all four arms: `test -e cadence-core/bin/lib/route-cells.mjs` and `test -e cadence-core/bin/route-cells.test.mjs` both fail; `node --test cadence-core/bin/self-verify.test.mjs` -> tests 162 / pass 162 / fail 0; `node cadence-core/bin/self-verify.mjs` -> `{"ok":true,...,"problems":[]}` with `checked` now naming `rung-ladder`; with `agents/cad-planner-low.md` moved out, exit 1 and exactly one problem `{"kind":"missing-rung-agent","file":"cadence-core/bin/lib/rung-agent.mjs","detail":"cad-planner at rung low: agents/cad-planner-low.md absent"}` (moved back, tree clean); `node cadence-core/bin/test.mjs routing` -> tests 412 / pass 412 / fail 0. |
| 2 - route-table.json deleted, its readers re-keyed | 250b1ed2 | Predicted before running, then observed, all four arms matching: `test -e cadence-core/route-table.json` exits 1; `grep -rn "'route-table.json'" cadence-core/bin` prints nothing (exit 1); `node cadence-core/bin/test.mjs prose routing` -> tests 717 / pass 717 / fail 0 (was 715 pass / 2 fail before the INTERNALS.md line landed); `node cadence-core/bin/self-verify.mjs` -> `{"ok":true,...,"problems":[]}`, exit 0. Typecheck `npx tsc -p tsconfig.ci.json` exit 0. |
| 3 - config.mjs can remove a key from one layer | ff9542df | Predicted before running, then observed, every arm matching. On a scratch `F` = `{"stakes":"critical","granularity":"fine"}`: `unset --file F stakes` -> `{"ok":true,"file":F,"removed":["stakes"]}` exit 0, F left holding `granularity` only; a second identical run -> `removed:[]` with `sha256sum F` unchanged at `98cbf7d8...`; `CADENCE_GLOBAL_CONFIG=G unset --global stakes` -> `{"ok":true,"file":G,"removed":["stakes"]}`, G edited and F untouched; `unset --file <absent path> stakes` -> `{"ok":true,"removed":[]}` and no file created. `node --test cadence-core/bin/config.test.mjs` -> tests 110 / pass 110 / fail 0. `node cadence-core/bin/self-verify.mjs` -> `{"ok":true,...,"problems":[]}`. Typecheck exit 0. Also green after the change: `node --test cadence-core/bin/arg-contract.test.mjs` 13/13 and `arg-contract-adoption.test.mjs`, whose census spawns every declared refusal against the shipped CLI. |
| 4 - stakes is a retired key, and the retirement rail is re-pinned | (not started) | Blocked before any file was edited. Task 4's very first Action step - deleting the `stakes` row from `config.schema.json` - makes self-verify red on a file outside this plan's lease. See the checkpoint below. Nothing of task 4 is in the working tree; the tree is clean apart from the orchestrator's own `.planning` edits. |

## Checkpoint: task 4 needs config-reach.md, which is PLAN-3's file

**What I found, measured rather than reasoned.** With the one `"stakes"` row
deleted from `cadence-core/config.schema.json` and nothing else changed,
`node cadence-core/bin/self-verify.mjs` returns `ok:false` with exactly ONE
problem:

```
{"kind":"unknown-reach-key",
 "file":"cadence-core/references/config-reach.md",
 "detail":"stakes: reach row names no schema key"}
```

**Cause.** Check 9 holds `references/config-reach.md`'s table against the schema
in both directions. `reachIssues` (`lib/config-reach.mjs:162`) files
`unknown-reach-key` for a row whose Key column names a key the schema does not
hold, and `config-reach.md:106` is that row:

> `| `stakes` | universal | `bin/route.mjs` - picks the row of every cell grid |`

So the schema row cannot go without the reach row going with it, and task 4's
`Verify:` requires BOTH `grep -c '"stakes"' cadence-core/config.schema.json`
printing `0` AND `node cadence-core/bin/self-verify.mjs` reporting `ok:true`.
They cannot both be true inside this lease.

**This is the same class as task 2's approved checkpoint, one check over.**
PLAN-2's Notes anticipated the prose gap only for `stakes` TOKENS
("Self-verify does not flag them - the tokenizer reads dotted tokens only").
That reasoning is right about the tokenizer and does not cover the reach TABLE,
which check 9 reads by key rather than by prose scan.

**Measured, not assumed.** With the one-row deletion staged,
`node cadence-core/bin/planning.mjs lease-check --phase 3 --plan 2` returns
`{"ok":false,"reason":"undeclared-files",...,"undeclared":["cadence-core/references/config-reach.md"]}`.
The probe was reverted; `git status` on both probed files is clean.

**Blast radius is exactly this one row.** Checked before proposing:

- The only code anywhere that READS the schema's `stakes` row is
  `config.test.mjs:351-352` (`r.keys['stakes'].values` / `.default`), which is
  in this plan's lease and which task 4's Action already sends me to rewrite.
- `route.test.mjs` is the one `stakes`-mentioning test file outside the lease
  (22 matches). Two of its rows build configs that still carry the key -
  `:698` `rawCfg({ stakes: 'critical' }, ...)` and `:1622`
  `floorRoot({ stakes: 'critical', ...ANSWERED }, ...)`. Both assert
  field-by-field (`r.ok`, `'stakes' in r`, `effort`, `model`, `review`,
  `effects()`), never a whole-envelope `deepEqual`, so the new `warnings[]`
  entry the retirement adds does not move them. Left as found.
- The other machinery task 4's `Verify:` depends on is already in place:
  `route.mjs:128,321` folds `retiredKeysIn(c)` into its warnings, and
  `CONTRACTS['route.mjs'].resolve` declares `--file`.
- `config.schema.json:42` (`workflow.verifier`'s purpose, "the stakes level
  decides whether it runs") and `:106` (`waive_routing_floor`'s purpose) still
  name the level in PROSE. Nothing mechanical reads them - self-verify's prose
  walk is `.md` only - and they are PLAN-3's sweep, so they are not part of this
  request.

**Proposed fix** - delete the one row, and PLAN-3 still owns the file for the
rest of its `stakes` prose (its lines 181-193 name the level in the Honoured-by
column, which check 9 does not read):

```
- | `stakes` | universal | `bin/route.mjs` - picks the row of every cell grid |
```

**What I need:** either (a) `cadence-core/references/config-reach.md` added to
PLAN-2's `files:` lease so the one-row deletion rides task 4's commit, or (b) a
decision that task 4 moves to PLAN-3. (a) is much the smaller change: PLAN-3's
lease does NOT carry `config.test.mjs` or `config-seams.test.mjs`, which task 4
must edit, so (b) needs two lease changes rather than one and reorders the plan.

Deviations:
- [deviation] Task 4's `## Must be true when done` requires both
  `config.schema.json` carrying no `stakes` row and
  `node cadence-core/bin/self-verify.mjs` reporting `ok:true`. Measured, those
  two cannot both hold: the reach table's `stakes` row is filed
  `unknown-reach-key` the moment the schema row goes, and correcting it needs a
  file outside this plan's lease (`lease-check` returns `ok:false`). I stopped
  before editing anything rather than widening the lease myself.
- [deviation] (carried from the prior dispatch, now RESOLVED) Task 2's `Verify:`
  asserted `self-verify.mjs` reports `ok:true` after `route-table.json` is
  deleted. It did not: check 3b filed `missing-internals-path` for
  `INTERNALS.md`'s backticked citation of the deleted file. The structural
  checkpoint was APPROVED, `INTERNALS.md` was added to PLAN-2's lease, and the
  one-sentence correction rode task 2's own commit. `lease-check` now returns
  `ok:true` for that range.
- [deviation] (carried from the prior dispatch) Task 2's Action says to reword
  the header comments in `gate-agreement.test.mjs`. PLAN-1 already did that (its
  line 3 reads "now that the schema `default` IS the answer and no level-keyed
  grid decides it") and the file names `route-table.json` nowhere, so there was
  nothing to change; the file is untouched and is not in the commit. Same for
  "any remaining `route-table.json` remark in `rung-agent.test.mjs`" - there is
  none. One stale CELL remark there was corrected instead
  (`"route normally off the cell"` at the `effort-enum-drift` null row), which
  is what the cells' deletion made false.

Open items:
- Static analysis: `workflow.lint_command` is null and
  `planning.mjs detect-commands --root /code/cadence` reports `lint: null`, so
  there is no lint command Cadence can find for this project. `typecheck` is
  `npx tsc -p tsconfig.ci.json` and exited 0 after tasks 2 and 3.
- No full-suite run happened this dispatch. The allowance is one run after the
  LAST task's commit and never between tasks, and task 4 is unstarted, so the
  suite is still owed. Targeted coverage that IS green at `ff9542df`:
  `test.mjs prose routing` 717/717, `config.test.mjs` 110/110,
  `arg-contract.test.mjs` 13/13, `arg-contract-adoption.test.mjs`,
  `self-verify.mjs` `ok:true`, `tsc` exit 0.
- Task 3 touched two files its own `Files:` line does not name, both inside
  PLAN-2's declared lease and both a direct consequence of the new row.
  `cadence-core/bin/arg-contract.test.mjs`: the
  `CADENCE-CENSUS: arg-contract-flag-entries` pin re-cut from 200 flag entries
  to 202 (watched failing at `actual: 202, expected: 200` before the edit) - the
  `unset` row carries the same two entries `set` does.
  `cadence-core/bin/config.test.mjs`'s ARG-06 loop gained `unset`, whose stated
  subject is "every subcommand that ACCEPTS --global declares it"; leaving it
  out would have made that claim false the moment the row landed.
- Declined fuller shapes in task 3, all of which the `Verify:` passes without:
  `unset` prunes no container the removal leaves empty (the plan makes this the
  executor's call - `flatten` skips an object with no entries, so
  `{"risk":{"override":{}}}` contributes no leaf and `validate` passes, asserted
  in the test file); `unset` with NO key words answers `{ok:true, removed:[]}`
  rather than a `usage` refusal, matching `set`'s own behaviour on an empty pair
  list; and the `--global` flag is not passed into `unset()` at all, because
  which layer is answered by the resolved FILE and `unset` never creates one.
- `DESIGN.md:617` still states the seam's surface as
  `validate | check | set | get | keys`, which is now short by one. `DESIGN.md`
  is PLAN-3's file, not this plan's, so it is left as found.
- The INTERNALS.md correction in task 2 was scoped narrowly, as the continuation
  dispatch directed: only the dangling `cadence-core/route-table.json` pointer
  at :17 and the parenthetical claim around it. The pointer now names
  `cadence-core/config.schema.json` ("where the review gates and the cross-model
  reviewer's tiers and efforts take their defaults"). The declined fuller shape:
  the old parenthetical also credited that file with "the verify switch", which
  is now neither the table's nor the schema's - `route.mjs:1109-1112` sets
  `verify` from `floor.raised`, and the CONTEXT notes it "has no config key of
  its own". Saying so in INTERNALS.md is prose about `stakes` and the floor,
  which is PLAN-3's sweep, so the clause was dropped rather than re-homed. The
  pointer count `.planning/DOCS-CLAIMS.md`'s `INTERNALS-16` row states (five) is
  unchanged.
- `README.md:112` still links
  `[cadence-core/route-table.json](./cadence-core/route-table.json)`, now a
  dangling relative link, and still describes the 18-cell grid. Nothing
  mechanical catches it: self-verify check 3b reads `INTERNALS.md` only and
  check 3 reads only `${CLAUDE_PLUGIN_ROOT}` paths. `README.md` is PLAN-3's
  file.
- Task 1's map-to-disk arm is gated on `isFullTree`; the plan's Action did not
  name a gate. `RUNG_FILES` lives in code, so a `--root` fixture cannot supply
  its own the way it supplied its own `route-table.json`, and ungated the arm
  reports thirty absent files against every minimal fixture - including the tree
  behind the `assert.equal(r.ok, true)` row at self-verify.test.mjs:347. The
  gate is the same D-03 line every always-expected input already sits on.
- `fullFixture()` in self-verify.test.mjs now writes the whole 30-file ladder
  with a budget row each, rather than one `cad-verifier.md`. That removes a
  pre-existing `rung-effort-mismatch` its single agent file had been producing
  in every full-tree row, and is what lets the missing-rung-agent row assert
  exactly ONE problem.
- `cadence-core/bin/route.mjs:78-79` still says the unanswered surface set is
  "ALL of the table's `risk_surface_categories`". The resolver reads
  `config.schema.json`'s `review.triggers.risk_surface.surfaces` values
  (`route.mjs:221`), so the remark names a file that no longer exists.
  `route.mjs` is in no plan's `files:` list this phase, so it is left as found.
- Several `lib/*.mjs` comments still cite `route-table.json` as a live file
  (`lib/surface-scan.mjs:42,75`, `lib/trace-suggest.mjs:22,228`,
  `lib/why-record.mjs:468`, `lib/adjudication-record.mjs:66`,
  `planning/risk-check.mjs:35`, `planning/trace.mjs:13`,
  `references/review-triggers.md:98`, `DESIGN.md:385,390,401,435`). None is in
  this plan's lease and none is read by any check; they belong to PLAN-3's
  sweep. The quoted plan and UAT prose inside `planning-files.test.mjs` and
  `planning-criteria-coverage.test.mjs` fixtures is historical text and was left
  alone as the plan instructs.
