PLAN COMPLETE
Plan: .planning/phases/1/PLAN.md
Tasks: 5 of 5
| Task | Commit | Note |
|---|---|---|
| 1: Hoist the `fix_commit` VALUE check out of the `survived` branch | 9f52e361 | `node --test cadence-core/bin/adjudication-record.test.mjs` 49 pass / 0 fail, matching the prediction. Three new arms: an unusable value on `downgraded`/`refuted` (`'not-a-sha'`, `''`, `null`) is refused with the ruling named, a well-formed one on those rulings is still accepted (D-01's rejected stronger arm pinned as rejected), and the `survived` case is refused by that one same check. Entry-emit spread now reads `!== undefined`. `npx tsc -p tsconfig.ci.json` exit 0. |
| 2: Give the unfixed-halting-survivor test one entries-level home | e61bc8f9 | `unfixedFromEntries(entries)` is the primitive, returning `{filing, haltingSurvivors}` in one pass; `unfixedFindings` keeps its signature and becomes the wrapper. `filing-decision.test.mjs` 40 pass / 0 fail and `issue-filing.test.mjs` 34 pass / 0 fail, both with no edit; `adjudication-record.test.mjs` 52 pass / 0 fail, matching the prediction. `grep -rn "overridden !== true" cadence-core/` returns exactly one line. `npx tsc` exit 0. |
| 3: Join `overridden: true` to the receipt at `trace append` | 36ba2652 | `overrideAccounted` sits beside `recountReceipt`, resolves through the same `recordForFire`, and refuses on any settled figure rather than all three. `trace.test.mjs` 171 pass / 0 fail with no edit; `planning-adjudication.test.mjs` 25 pass / 0 fail with the shipped `an OVERRIDDEN blocking fire settles end to end` arm green. New arms prove the reasonless receipt refused with nothing appended, the two-figure receipt refused by the same check, and a record with no cleared halt still taking a reasonless receipt. `npx tsc` exit 0. Its one added import line shifted `planning/trace.mjs` by one line, settled by the follow-up row below. |
| 4: Reproduce both refusals end to end over a mixed-ruling fixture | 6541bd8d | `node cadence-core/bin/test.mjs planning` 1076 pass / 0 fail. The new arm walks `risk-check run` ok:true, the bad-`fix_commit` `adjudication` call ok:false naming `fix_commit` and `downgraded` with no record written, the corrected call ok:true at `{raised:3, survived:1, downgraded:1, refuted:1}`, the reasonless receipt ok:false with nothing appended, the `override --detail-file` receipt ok:true, and `risk-check status` ok:true at `recorded`. Stored bytes asserted off the written `ADJUDICATION-*.json`. `npx tsc` exit 0. |
| 5: State both rules in the two references and re-pin their ceilings | 96d32686 | `node cadence-core/bin/self-verify.mjs` `ok:true` with `problems: []` across all 30 checks; `prose-agreement.test.mjs` 59 pass / 0 fail. `review-record.md` 7259 -> 7790 B and `triage-gate.md` 23006 -> 23677 B, both re-pinned in `weight-budgets.json` in the same commit. No fenced `trace append --family outcome` line added or removed, no second `trace render`, no inline `--detail` value. `npx tsc` exit 0. Its third Verify clause - `node cadence-core/bin/test.mjs` green across every group - was unmet at this commit and is settled by the row below. |
| 5 (cont.): re-pin EXECUTE-22 to the window task 3 shifted it to | aa61edf1 | Checkpoint outcome carried back: the user APPROVED the repair and the plan's `files:` was amended to cover both paths. `.planning/DOCS-CLAIMS.md:867` and `citation-census.test.mjs`'s EXECUTE-22 entry both move `244-246` -> `245-247` (`start: 245`, `end: 247`). Verified first that `planning/trace.mjs:245` is `  const git = gitIgnoreState(root, TRACE_IGNORE_LINE);` rather than trusting the numbers - grammar two reads `lines[start - 1]` and asserts the symbol is on that ONE line, and grammar two's sibling arm keys on the `line` string, so the table cell and the entry had to move together. `node --test cadence-core/bin/citation-census.test.mjs` 5 pass / 0 fail, matching the prediction. `node cadence-core/bin/test.mjs` exit 0, 3562 tests, 3561 pass, 0 fail, 1 skipped - green across every group, which closes task 5's third Verify clause. `node cadence-core/bin/self-verify.mjs` still `ok:true` with `problems: []`. `lease-check --phase 1 --plan 1` `ok:true` (staged 2, declared 20). `npx tsc -p tsconfig.ci.json` exit 0; `detect-commands` reports `lint: null`, so there is no lint command in this project to run. Nothing else changed - no other pinned row cites `planning/trace.mjs`. |
| fix(1-1): an unreadable record refuses the cleared-halt check | 776c67ef | Blocking `risk_surface` review, one surviving `high`: `overrideAccounted` caught `JSON.parse` and returned `pass`, so a truncated or edited record made the guard fail open. Now REFUSED with `reason: 'bad-record'`, at the parse site and after the reason gate - a receipt carrying the user's words has already accounted for whatever the record holds, so it is answered before the file is opened. `recordForFire` returning no file is still a pass: that record does not exist. The docblock's `AN ABSENT OR UNREADABLE RECORD OMITS THE CHECK` paragraph is split in two, the second half naming why the recount cannot cover this: its `keys.every` precondition means a PARTIAL settle line never reaches its own `bad-record` refusal, so the two-figure receipt in the new arm can only be refused by this guard. `node --test cadence-core/bin/planning-adjudication.test.mjs` 27 pass / 0 fail, matching the prediction. `node cadence-core/bin/test.mjs` exit 0, 3563 tests, 3562 pass, 0 fail, 1 skipped - green across every group. `node cadence-core/bin/self-verify.mjs` `ok:true` with `problems: []`. `npx tsc -p tsconfig.ci.json` exit 0; `detect-commands` still reports `lint: null`, so there is no lint command to run. No reference or budget moved: no shipped prose states this rule, and `planning/trace.mjs` carries no weight ceiling. |

Deviations:
- [deviation] Task 3's `Action:` asserted "An absent or unreadable record OMITS the check,
  exactly as `recordForFire` and the recount already declare", and the code was written to it.
  The blocking `risk_surface` review's surviving `high` found that half of it wrong: an
  unreadable record is not an unresolvable one, it is a record somebody changed, and passing
  on it discharges the `overridden: true` marker. The review's own rationale was half wrong
  too - it claimed the recount "is also documented to omit its check for an unreadable
  record", where `recountReceipt` REFUSES one with `bad-record`; the real hole was the
  asymmetry plus that refusal's all-three precondition. Fixed as dispatched: the unreadable
  case refuses, the absent case still passes, and the docblock states both.
- [deviation] Task 5's `Verify:` asserts `node cadence-core/bin/test.mjs` is green across every
  group. At commit 96d32686 it was not: the full suite reported 3562 tests, 3560 pass, 1 fail -
  `citation-census.test.mjs:261` `grammar two: each pinned row resolves to the code it names`,
  failing with "DOCS-CLAIMS.md's EXECUTE-22 is pinned to carry `TRACE_IGNORE_LINE` at
  cadence-core/bin/planning/trace.mjs:244, but that line reads: `  const file = join(root,
  '.gitignore');`". Cause was task 3's single added import line
  (`import { unfixedFromEntries } from '../lib/filing-decision.mjs';` at trace.mjs:33), which
  shifted the file down by exactly one. Confirmed against the pre-phase tree:
  `git show 8bf8971e:cadence-core/bin/planning/trace.mjs | sed -n '244,246p'` is the window the row
  pinned, so the row was accurate before this phase. The repair needed two files outside the plan's
  `files:` lease, so the executor stopped and returned `CHECKPOINT: structural`. The user approved
  the change and the lease was amended; commit aa61edf1 re-pins the one affected row to `245-247`
  and the suite is now green (3561 pass, 0 fail, 1 skipped, exit 0). No other pinned row was
  affected - grammar two checks 4 rows naming this seam and EXECUTE-22 is the only one citing
  `planning/trace.mjs`; the `lib/` files this plan also edited are outside grammar two's scope.

Open items:
- A pinned DOCS-CLAIMS row that names a file by LINE NUMBER rots whenever any earlier line is added
  to that file, and nothing warns the executor at the edit site - the failure surfaces only in the
  full-suite run, one task later. Out of scope here (this plan's job was to fix the one rotted row),
  but the shape is worth a look: an import added at line 33 silently invalidated a citation 200
  lines below it.
