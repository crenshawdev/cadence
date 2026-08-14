---
phase: 2
plan: 3
requirements: [TRC-01]
files:
  - cadence-core/workflows/report.md
  - cadence-core/bin/weight-budgets.json
---

# Phase 2: The run record joins - Plan 3

## Goal

The figures the seams already compute reach a reader: `/cad-report` prices the
in-dispatch file reading the `reads` summary measures, and names a bracket
closed under the wrong role instead of leaving it in an array nobody opens.

## Must be true when done

- Running `/cad-report` calls `planning.mjs reads` and reports `fileCalls`,
  `fileRedundancy` and `topFiles` by name, with the record it read scoped
  honestly.
- The record-health line names a `mismatched` bracket when the render carries
  one, alongside the unpaired, malformed and capped conditions it already names.
- No figure is invented when the reads record is empty - the report says nothing
  about reading rather than printing zeros.
- `node cadence-core/bin/self-verify.mjs` reports no `unbudgeted-surface`, no
  `budget-overrun` and no unknown subcommand or flag for the new seam call, and
  `node --test cadence-core/bin/*.test.mjs` passes.

## Context

- D-10: `topFiles` / `fileRedundancy` / `fileCalls` resolve keep-and-wire, not
  delete - deleting them removes the file-half measurement phase 4's
  read-instrumentation join is scheduled to use.
- D-11: the reader is PROSE - a `planning.mjs reads` call in a workflow - never
  a rule inside `lib/trace-suggest.mjs`, whose contract is no I/O. The whole
  `reads` subcommand has zero consumers today.
- `/cad-report` is the reader chosen over `/cad-suggest`: the reads figures
  price a run, and `/cad-suggest` may only name config keys that
  `cadence-core/config.schema.json` carries, which none of these three have.
- `cadence-core/workflows/report.md`'s budget entry in
  `cadence-core/bin/weight-budgets.json` is currently 4336 B, exactly its size,
  so any addition here overruns until the row is re-pinned in the same commit.
- The `mismatched` array's name and shape are fixed by PLAN-1; this plan only
  reads it.

## Tasks

### Task 1: /cad-report prices the in-dispatch reading

- **Files:** cadence-core/workflows/report.md, cadence-core/bin/weight-budgets.json
- **Action:** Add the second seam call to `cadence-core/workflows/report.md`'s
  `read_record` step - `node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs"
  reads` - and a line in the `compose` shape that reports `fileCalls`,
  `fileRedundancy` and `topFiles` by those names, drawn from that return and
  recomputed nowhere. Two constraints the prose must state, both load-bearing:
  the `reads` record has NO phase scoping, so its figures span the whole
  `.planning/reads.jsonl` even when the report is scoped to one phase and the
  line must say so rather than implying it prices the phase, naming
  `.planning/reads.jsonl` in that caveat; and when the return
  carries `calls: 0` or its `no reads recorded yet` note, the report says
  nothing about reading at all - state that arm with the words "nothing about
  reading" so the rule is greppable - the same silence the `coordinator` block already gets,
  because zeros from an absent record read as a run that opened no files. Do not
  add a flag to the call: the `reads` row in `self-verify.mjs`'s CONTRACTS table
  is flagless beside the shared `--dir`. Keep the existing read-only and
  no-fabricated-figures guardrails intact, and re-pin
  `cadence-core/workflows/report.md` in `cadence-core/bin/weight-budgets.json`
  to the file's new byte count in this same change.
- **Verify:** `node cadence-core/bin/planning.mjs reads` run from
  `/data/code/cadence` returns `ok:true` carrying `fileCalls`, `fileRedundancy`
  and `topFiles`; `grep -n "reads\|fileRedundancy\|topFiles"
  cadence-core/workflows/report.md` shows the call and all three field names;
  `grep -n "reads.jsonl" cadence-core/workflows/report.md` shows the whole-file
  scoping caveat naming `.planning/reads.jsonl`, and
  `grep -ni "nothing about reading" cadence-core/workflows/report.md` shows the
  empty-record silence rule;
  and `node cadence-core/bin/self-verify.mjs` reports no `budget-overrun`, no
  `unbudgeted-surface` and no `unknown-subcommand`/unknown-flag problem for
  `report.md`.

### Task 2: The record-health line names a mismatched bracket

- **Files:** cadence-core/workflows/report.md, cadence-core/bin/weight-budgets.json
- **Action:** Extend the `Record health` line in `report.md`'s `compose` step so
  a `mismatched` entry on the `trace render` return is named with the rest -
  reporting the worker, the role the dispatch opened and the role its terminal
  named - and state that the token total is billed to the DISPATCH's role, so a
  mismatch is a recording defect to fix at the prose site rather than a
  correction to make in the report. The line's existing rule stands: each
  condition named, never silently dropped, and nothing said when the array is
  empty. Re-pin `cadence-core/workflows/report.md` in
  `cadence-core/bin/weight-budgets.json` to the new byte count again in this
  change.
- **Verify:** `grep -n "mismatched" cadence-core/workflows/report.md` shows the
  clause naming the worker and BOTH roles (dispatched and closed), and
  `grep -n "billed to the dispatch" cadence-core/workflows/report.md` shows the
  billing rule stated; `node cadence-core/bin/self-verify.mjs` reports no
  `budget-overrun` and no `unbudgeted-surface`; `node --test
  cadence-core/bin/*.test.mjs` passes.

## Notes

- This plan's second task reads an array PLAN-1 creates. It is prose naming a
  key, not a code dependency, and the key name is quoted in both plan files - but
  if PLAN-1 lands a different name, this prose is what has to move.
- Deliberate departure from the CONTEXT `Plan shape` directive, which assigns
  this slice AC6 alone: the mismatch array AC2 adds would otherwise ship with no
  reader, which is the exact defect AC6 exists to close. The array itself
  (AC2's requirement) lands in PLAN-1; only its reader is here, and no new
  behaviour is added beyond naming it.
