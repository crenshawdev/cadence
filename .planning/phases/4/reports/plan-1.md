PLAN COMPLETE
Plan: .planning/phases/4/PLAN.md
Tasks: 6 of 6
| Task | Commit | Note |
|---|---|---|
| 1: Fold joined reads into per-role in-dispatch file figures | 49137e7a | `inDispatchReads(rows)` added beside `joinReads`; `joinReads` rows now carry the record's normalized `files`. 55/55 in `read-trace.test.mjs`, `npx tsc -p tsconfig.ci.json` clean. |
| 2: The rule, its per-role thresholds, and the no-lever decision | 509b7bb7 | R7 + exported frozen `IN_DISPATCH_FLOORS` (`cad-executor` 3.00, `cad-verifier` 2.00); third optional `reads` parameter on `suggestFromRender`. 44/44 in `trace-suggest.test.mjs`, typecheck clean. |
| 3: `trace suggest` opens `.planning/reads.jsonl` | 90e127ee | One lifted `readReadsRecords(dir)` helper reporting `ok`/`absent`/`unreadable`; `cmdReads` keeps its `read-failed` arm, `suggest` warns instead. Fixtures `reread.{reads,trace}.jsonl` added. 47/47 trace-suggest, 55/55 read-trace, `self-verify --root .` ok:true / 0 problems. Live run on this repo: `cad-executor` 3.64 over 78 dispatches, worst `cadence-core/bin/planning.mjs` 29 times, coverage 63%, 4,438 coordinator reads excluded - the spike's figures reproduced through the seam rather than restated. |
| 4: `reads --join` carries the same figure | eecceaaa | `inDispatch` key on the `--join` envelope only, off the same fold. The no-flag envelope and the `no reads recorded yet` arm are both untouched and asserted so. 58/58 read-trace, typecheck clean. |
| 5: Both prose faces state the figure, its coverage and its exclusions | d25b644c | report.md Reading line + reading rule (three dispositions including the live `calls > 0` null case), suggest.md `scope` / `read_record` / `present`. `reads --join` re-measured at 2,494 B and the prose agrees to the byte. New prose-agreement arm FALSIFIED IN BOTH DIRECTIONS over all 14 asserted clauses - each deleted individually reddens naming that clause, each restored greens. Budgets re-pinned in the same commit (report.md 19249, suggest.md 9398); `self-verify --root .` ok:true / 0 problems; 41/41 prose-agreement. |
| 6: Retire the spike's throwaway measurement code | 7910e7ed | Both `measure*.mjs` deleted, `SPIKE.md` untouched, nothing in the tree referenced them. `.planning/spikes/read-set-redundancy/` lists `SPIKE.md` alone; 105/105 across the two test files. |

Closing checks: `node cadence-core/bin/self-verify.mjs --root .` returns `ok:true` with an
empty `problems` array. `npx tsc -p tsconfig.ci.json` clean (`workflow.lint_command` is
unset and `detect-commands` reports `lint: null`, so typecheck is the whole static-analysis
answer this repo can give). Full suite `node --test 'cadence-core/bin/*.test.mjs'`:
2,624 of 2,625 pass, the one failure pre-existing - see Open items.

Deviations: none

Open items:
- PRE-EXISTING, not caused here: `milestone-prune.test.mjs`'s "corpus: pruning this
  repository's own REQUIREMENTS.md needs no hand repair" fails. Confirmed failing at
  `5e223b2a`, the commit this dispatch started from, in a detached worktree with none
  of this plan's changes present. Nothing in this plan's lease touches
  `milestone-prune.mjs` or `REQUIREMENTS.md`.
- The `reads --join` byte figure in `report.md`'s transport paragraph is a live
  measurement of a gitignored record that grows by roughly a byte per few tool calls.
  It agreed exactly at the commit, and the prose now carries the same growth caveat the
  render figure above it already carried, so a later reader does not read a drifted
  digit as a broken claim. A figure measured against the committed fixtures instead
  would be stable but would no longer answer the question the paragraph asks, which is
  what this call costs on a real record.
