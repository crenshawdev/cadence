PLAN COMPLETE
Plan: .planning/phases/1/PLAN-1.md
Tasks: 5 of 5
| Task | Commit | Note |
|---|---|---|
| 1. One file-transport reader, wired through `trace append\|close --detail-file` | 2524fb9 | `lib/text-flag-file.mjs` + unit test; `cmdTrace` resolves the detail BEFORE the close arm's checkpoint/return inference; `--detail-file` added to both `CONTRACTS` rows. Trace seam cases landed in `trace.test.mjs` (its CLI harness and `traceBytes` byte-unchanged helper live there) rather than `planning.test.mjs`; both files are in the plan lease and the WHOLE suite plus self-verify was run at every task. |
| 2. `trace append --read-file` | 01bd5bc | One list-builder now serves both transports, so the comma grammar and the all-blank refusal cannot drift; `--read-file` on the `trace append` row only - the close row carries no `--read` either. |
| 3. `uat record --fields-file` | c354ff0 | ONE JSON object of the five free-text fields, feeding the same `[flag, field]` loop; out-of-set key, non-string value, array and both-ways-given all refused before any mutation. The redactUrl census in `planning.test.mjs` pins the caught-error-detail idiom BY COUNT, so the new `JSON.parse` catch moved it 8 -> 9 with its not-wrapped reason recorded beside `capture --text-file`'s. |
| 4. `milestone-prune --label-file` | 7bfe9f5 | Resolved before both label terms, which now have seam-level coverage through the file transport (`\|` and `../../../outside-tree` refused, tree untouched). |
| 5. `cursor set --next-file` | b7ad086 | Resolved next feeds `renderCursor`; a value carrying a newline is refused rather than flattened. |

Deviations: none

Open items:
- The reader returns ONE shape (`{ok, value, detail}`) rather than an
  `ok`-discriminated union: the union is a TS2339 at the first call site under
  this repo's `strict: false` CI typecheck, which is the `resolveRange`
  precedent already recorded in `planning.mjs`. Measured, not assumed.
- Task 5's newline refusal is applied to the RESOLVED value, so it also narrows
  the inline `--next` (previously a newline there wrote a fifth STATE.md line
  that `parseCursor` could not read back). No shipped site passes a multi-line
  pointer - all eleven `--next` prose sites pass a one-line resume pointer -
  so nothing in the tree changes behaviour; it is recorded because it is a
  narrowing of an inline form, which the plan otherwise leaves untouched.
- The `$(...)`/backtick verbatim arm is asserted per FLAG for `--detail-file`,
  `--fields-file` and `--next-file` (where the task named it) and once in the
  module's own unit test for the shared reader, not repeated for `--read-file`
  and `--label-file`; one reader carries the bytes for all five.
