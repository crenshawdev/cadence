---
phase: 1
status: complete
completed: 2026-09-04
---

# Phase 1: Every role has every rung - Summary

The rung ladder is now square: eleven new agent files bring `agents/` to thirty, so each of the six roles offers all five rungs (`low`, `medium`, `high`, `xhigh`, `max`) and `model.effort.<role>` accepts the same set for every role.

## What shipped

- Eleven new rung agent files - `agents/`, taking it from 19 to 30 files, six per rung
- A complete `RUNG_FILES` map - `cadence-core/bin/lib/rung-agent.mjs`, all 30 role-rung pairs resolving to a file on disk
- Uniform `model.effort.<role>` validation - `cadence-core/config.schema.json`, the same five-rung enum per role
- Check 8 narrowed to the stale-file fault - `cadence-core/bin/self-verify.mjs`, its orphan-rung arm retired now that no rung is unmapped
- Fixtures retargeted off "this role lacks a rung" - `route-cells.test.mjs`, `route.test.mjs`, `rung-agent.test.mjs`, reaching the unmapped branches through role `cad-unmapped` and the out-of-ladder token `ultra`

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | e6c6ad5c | Retire the orphan-rung half of the ladder check; re-state `_meta.rungs`, the README rungs paragraph and the INTERNALS effort paragraph |
| 1 | 2 | 175c7996 | Retarget the fixtures that reached a branch through a missing rung |
| 1 | 3 | 14e387ed | The eleven missing rung files, and the ladder that names them (RNG-06) |

## Deviations

- [deviation] Task 3's Verify asserts `grep -n "\b19\b"` over four test files "returns nothing", which it cannot: `config.test.mjs:729` carries the ISO date `2026-08-19` and `\b19\b` matches its day component. The executor ran the check as `grep -n "\b19\b" <the four files> | grep -v 2026-08-19`, which does return nothing, and reports the underlying criterion - no test asserts the rung-file count nineteen - as met with all four real count pins now at 30. No count literal was edited to satisfy the grep. Commit 14e387ed.

## Open items

- `cadence-core/bin/lib/census-registry.mjs:198-202` still describes the `rung-agent-files` census as "the 19 rung file stems" and names its asserting test as freezing 19. Both are stale by one number. Nothing enforces either string, so no check is red, but the registry row reads wrong. The file is outside this plan's `files:` lease and was left alone.
- `cadence-core/bin/prose-agreement.test.mjs:646` carries "the 19 rung files carry ${bound}" inside an assertion failure message only. Same lease reason; it asserts no count.

## Goal check

The three commits deliver the phase goal. `ls agents/*.md | wc -l` returns 30 and the `effort:` lines across them are exactly six each of `low`, `medium`, `high`, `xhigh` and `max`, which is the ladder the goal asks for. `git diff --name-status 42295be3..HEAD -- agents/` is eleven `A` and nothing else, so the nineteen existing filenames are untouched - no `R`, no `D`, the criterion the plan named to catch a rename masquerading as an addition. `node cadence-core/bin/self-verify.mjs` reports `ok: true` with an empty `problems` array over all thirty checks, which covers `unbudgeted-surface`, `budget-overrun`, `effort-enum-drift` and `undeclared-rung-agent` by name. The suite is `node cadence-core/bin/test.mjs` exit 0, 3813 tests, 3812 passing with one pre-existing conditional skip, and `npx tsc -p tsconfig.ci.json` exits 0 - worth stating separately because the suite does not run tsc. The blocking `diff` review fired on `42295be3..14e387ed` and passed with nothing raised at the flagship tier. What is missing is only what the open items name: two prose strings still saying nineteen, both outside this plan's file lease, neither asserted by any test.
