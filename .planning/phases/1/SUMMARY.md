---
phase: 1
status: complete
completed: 2026-08-15
---

# Phase 1: The check that proves it ran - Summary

`planning.mjs risk-check`, an executable risk seam that answers a resolved commit range with `{checked, categories, matches, inconclusive}` and appends that record to `trace.jsonl` on every invocation, plus the completion gate in both `execute.md` and `task.md` that refuses to report done without one.

## What shipped

- The detector - `cadence-core/bin/lib/risk-diff.mjs`, born distinct from `lib/surface-scan.mjs`: `surface-scan.mjs` still answers "which categories does this project scope", `risk-diff.mjs` answers "did this range touch one", and the header of each names the split.
- `risk-check run` - `cadence-core/bin/planning.mjs`, one JSON line plus one `{"family":"outcome","event":"risk_check"}` append on a matching range and a clean one alike, so silence is no longer the same bytes as a check that never ran.
- `risk-check status` - the enforcement half (RSK-02), scoped to the current run's `corr`, requiring `checked:true` and matching a range by RESOLVED commit pair rather than ref spelling.
- Both fire sites re-pointed - `cadence-core/workflows/execute.md`'s post-plan step and `cadence-core/workflows/task.md`'s `risk_check` step call the seam instead of instructing a model to read a prose list.
- `self-verify.mjs` `CONTRACTS` row for the new subcommand, so the invocation lint covers it.
- No config key, flag or route-table cell moved: `git diff --stat 279466b..HEAD -- cadence-core/route-table.json cadence-core/config.schema.json` is empty.

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | ba593f4 | the diff detector, born distinct from the scoping aid |
| 1 | 2 | bbffe32 | `risk-check run` - the record written on every invocation |
| 1 | 3 | 3eb0971 | `risk-check status` - completion requires the record |
| 1 | 4 | 23daf54 | both completion paths call the seam, and withhold done without it |
| 1 | 4 | 7ac6a83 | move the `redactUrl` census to the site task 2 added (6->7 sites, 1->2 wrapped) |
| 1 | gate fix 1 | d6cd001 | a risk record is not a check - `status` reads the verdict fields |
| 1 | gate fix 2 | eec7528 | range identity is the resolved commit pair, not the ref spelling |
| 1 | gate fix 3 | 86e351c | a gitlink section is unread, not clean |
| 1 | gate fix 4 | b481fb3 | the gate reads THIS run's brackets, not every cycle's phase 1 |

## Deviations

- [deviation] The corr-scoping fix's failing-capable rows were dispatched against `cadence-core/bin/planning.test.mjs` but landed in `cadence-core/bin/risk-diff.test.mjs` (b481fb3), where the whole `risk-check status` fixture harness (`FROZEN_PHASE_1`, `traceFixture`, `recordLine`, `riskStatus`) already lives. Duplicating the harness into a second file was the alternative. Both files are on the plan's declared `files:` and both run under `node --test 'cadence-core/bin/*.test.mjs'`.

Structural checkpoint, resolved rather than deviated: the plan's `files:` was extended with `cadence-core/bin/planning.test.mjs` mid-run, on the user's approval, so task 4 could move the `redactUrl` count census its own task 2 had tripped.

## Open items

- The detector matches its own test fixtures. `risk-diff.test.mjs` contains the literal strings the detector hunts (a JWT sign call, `ALTER TABLE`, a Stripe reference, `rm -rf`), so `risk-check run` over this phase's range reports matches in `auth`, `migrations`, `billing`, `concurrency`, `destructive` and `untrusted_input` - a self-match. Every future Cadence phase that touches that file will fire the blocking gate on its own fixtures.
- `b481fb3` is the one commit in the phase range no reviewer saw. The `risk_surface` blocking gate's ONE-round re-arm cap (`references/triage-gate.md`) was already spent on the narrowed round over `7ac6a83..86e351c`, which returned zero findings, and b481fb3 landed after it as a defect fix found by running the gate.
- Adjudicated non-survivors of the `risk_surface` fire (4 of 7 raised, killed as overstated, recorded rather than fixed): `--base`/`--head` are persisted into `trace.jsonl` unredacted while the git error `detail` beside them is redacted; `risk-check run` reads the cwd repository while writing into `--dir`'s planning root (reachable only through the hermetic-test hook the spine never passes); the `untrusted_input` signal misses direct request-body APIs such as `request.get_json()`; the `destructive` signal misses `rm --recursive --force`. The last two are detection breadth, which the ROADMAP holds heuristic on purpose.
- `inconclusive` is a bare boolean and does not say WHICH half made it true - a binary file, a body with no readable hunk, or a gitlink.
- The `redactUrl` census now pins three wrapped sites by count alone (8 idiom uses, 3 wrapped), so it cannot name which one lost its wrapper when it goes red.
- A record written before eec7528 carries no `base_id`/`head_id` and can never satisfy a NAMED range, reporting `stale`. Any phase holding such a record needs one `risk-check run` to re-record before its status call passes.
- `risk-check status`'s range arm must run inside the repository whose refs it names, since it resolves them; a caller elsewhere gets `unresolved-range` rather than a wrong answer.
- A `cad-executor` return carrying no correlation id is now out of scope for the phase-wide arm, reachable only through a hand-edited record.

## Goal check

The phase goal was that a completed diff range cannot report done without an executable risk record, so the run record distinguishes "the detection step was skipped" from "it ran and matched nothing". The sum of these nine commits delivers it, and the strongest evidence is that the gate was turned on its own phase and refused: `risk-check status --phase 1 --plan 1 --base 279466b --head HEAD` exited 1 with `reason:"risk-record-missing"` until a record existed, and now exits 0 with `state:"recorded"` carrying `base_id` `279466bcaed091d1c493497d9628ce82cfd61785` and `head_id` `b481fb388d99dbfffcb13100a331315f47f9bad0`. Criterion 2 holds by construction: `appendEvent` runs before the envelope is emitted on every path past argument validation (`cadence-core/bin/planning.mjs:3125`), the git-failure path included. Criterion 3 holds and was strengthened during the run - a gitlink section now lands in the `unreadable` arm (86e351c), so a submodule bump reports `inconclusive:true` instead of a judged-clean `matches: []`. Criterion 7 holds: `route-table.json` and `config.schema.json` are byte-identical across the range. Verification is real and independently re-run by the orchestrator, not taken on report: `node --test 'cadence-core/bin/*.test.mjs'` is 1908/1908, `node cadence-core/bin/self-verify.mjs` is `{"ok":true,...,"problems":[]}` over 22 checks, and `npx tsc -p tsconfig.ci.json` exits 0. What is honestly weaker than the criteria imply: criterion 1 asked for `categories` to use exactly the eight tokens already carried by `route-table.json`, and it does, but the run over this phase's own range matched six of the eight against strings that exist only as TEST FIXTURES in `risk-diff.test.mjs` - so the detector's first live firing on this repository was a false positive on itself, which is the first open item above and the one a reader should not mistake for the gate catching real risk. And `b481fb3`, the commit that made the enforcement work at all on a project with history, is unreviewed: the capped re-arm round was spent before it existed.
