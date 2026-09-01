---
phase: 2
plan: 2
requirements:
  - RSK-09
  - AUT-03
files:
  - cadence-core/bin/lib/arg-contract.mjs
  - cadence-core/bin/planning/trace.mjs
  - cadence-core/references/triage-gate.md
  - cadence-core/bin/weight-budgets.json
  - cadence-core/bin/arg-contract.test.mjs
  - cadence-core/bin/trace.test.mjs
  - cadence-core/bin/planning-adjudication.test.mjs
  - cadence-core/bin/planning-lease-check.test.mjs
  - cadence-core/bin/phase-spelling.test.mjs
  - cadence-core/bin/self-verify.test.mjs
---

# Phase 2: A receipt can name its home and its authorization - Plan 2

## Goal

A receipt states the window it settles and the human answer it descends from,
in structured flags rather than in free text. This plan lands both `trace
append` flags: the anchor a settlement for an earlier phase window names, and
the authorization id that makes one human answer distinguishable from two.

## Must be true when done

- `planning.mjs trace append` accepts a flag naming the anchor of the window a
  receipt settles, its row is declared in `cadence-core/bin/lib/arg-contract.mjs`,
  and `cadence-core/references/triage-gate.md` states when a coordinator uses it.
- A settlement receipt written after a phase has re-anchored, carrying that flag
  with the earlier window's `phase_start` sha, appears in `trace render` for that
  phase and settles that window's fired range under `risk-check status` - where
  the same receipt without the flag leaves the range reading `unfired`.
- Two `outcome/override` events written on one authorization carry the same
  authorization id, and two written on two authorizations carry different ones.
  An event written without one carries no such key at all - absent, never empty.
- A fired range carrying no receipt of its own still answers `ok:false` under
  `risk-check status` even when a receipt naming the same authorization id
  settles a different range: the id LABELS a pair for a reader and never lets
  one receipt settle a second range.
- `node cadence-core/bin/test.mjs`, `npx tsc -p tsconfig.ci.json` and
  `node cadence-core/bin/self-verify.mjs` all pass, with
  `cadence-core/references/triage-gate.md`'s `weight-budgets.json` row re-pinned
  in the commit that grew it.

## Context

CONTEXT.md's decisions bind every task here. The load-bearing ones: a receipt
NAMES the anchor it settles under rather than re-anchoring carrying fires
forward (D-01); the authorization id is MINTED by the coordinator when the
engineer answers, never derived from the reason text (D-02); it LABELS the pair
and never widens what a receipt settles, so `risk-check.mjs`'s `settledBy` and
its both-ends requirement are untouched (D-03); the id rides a declared flag on
the `--agent-id` precedent, never a substring of `--detail` (D-09); shape (a)
changes no reader, because both joins are on the correlation id and a receipt
written under the window it names joins by construction (D-10, D-11);
`triage-gate.md` is the one prose writer and no `DOCS-CLAIMS.md` row asserts its
flag set (D-14); a new flag must move its row, its prose line and the code in
one commit or `self-verify` reports `unknown-flag` (D-15); `triage-gate.md` sits
exactly at its 24,693 B ceiling (D-13).

Out of scope here: the record seam (PLAN-1), the `/cad-suggest` reader (PLAN-3),
any change to gate strength (D-03), and any existence check on the anchor the
flag names - D-01 states the accepted cost, that a receipt can name a window it
does not belong to and the gate's range check is what objects.

## Tasks

### Task 1: A receipt can name the window it settles

- **Files:** cadence-core/bin/lib/arg-contract.mjs (the `'trace append'` row
  inside `CONTRACTS['planning.mjs']`), cadence-core/bin/planning/trace.mjs
  (`TRACE_STRING_FLAGS`, and `cmdTrace`'s shared `append|close` body up to the
  `appendEvent` call), cadence-core/references/triage-gate.md (the "Every
  receipt names the RANGE it settles" paragraph and the fenced `gate_pass` and
  `override` commands), cadence-core/bin/weight-budgets.json,
  cadence-core/bin/arg-contract.test.mjs (the `arg-contract-flag-entries`
  census), cadence-core/bin/trace.test.mjs
- **Action:** `lib/trace.mjs`'s `correlationId` derives a run's id off the
  phase's NEWEST `lifecycle/phase_start`, so a settlement written after a phase
  re-anchored is stamped with the new window's id and can never settle the old
  one - the state `GH-227` Case A reports, repaired today by hand-appending the
  line. `renderEvent` already prefers an explicit non-empty `corr` on the event
  and falls back to the derivation only when there is none, so the whole of
  shape (a) is a flag that supplies one. Add `--anchor` to the `'trace append'`
  row as `{required: false, type: 'string', value: 'refuse', bare: 'refuse'}` -
  the `--trigger` disposition and for its reason: a blank anchor would read as
  "no anchor" while the caller believes the receipt was bound. Leave the `trace
  close` row alone; a flag row is a prose allowlist that never widens what a
  subcommand accepts, and the shared body validates it for both. Add it to
  `TRACE_STRING_FLAGS` and correct the two comments the addition falsifies -
  the count in "The seven string flags" and the `fallback`/`refuse` split
  stated above the constant. The flag's VALUE is the `sha` the window's own
  `lifecycle/phase_start` carried, not a whole correlation id: derive the id
  through `correlationId(dir, parsedPhase.raw, <that sha>)`, the one derivation
  in the tree, which short-circuits on a supplied sha and returns
  `<phase>-<sha>` with no file read - so a receipt can only name a window of
  the phase it already declares, and the two spellings cannot drift. Put the
  derived id on the event object handed to `appendEvent` as `corr`; add no key
  when the flag is absent, so every existing call derives exactly as it does
  today. Do not couple the flag to an event NAME: this seam carries no runtime
  refusal keyed to an event, and the first one would be read as drift and
  deleted. Add no `FLAG_SENTENCES` row in `planning/core.mjs` - that map lists
  only the spellings that already ship and everything else composes from the
  flag's name and declared type, which is what keeps the
  `trace-refusal-sentences` census at four sentences. In `triage-gate.md`, state
  in the receipt paragraph that a settlement for a window the run has already
  moved past names that window with this flag, carrying the earlier
  `phase_start` sha, and that an ordinary same-window receipt omits it; add the
  optional flag to the existing fenced `gate_pass` and `override` commands. Do
  NOT add a new fenced `trace append --family outcome` block: the GAT-04 census
  in `prose-agreement.test.mjs` collects one `--event` per such line and asserts
  the set is exactly the five settle points, so a sixth line reddens it. Re-pin
  `triage-gate.md`'s `weight-budgets.json` row in the same commit - it is at its
  ceiling to the byte - and re-pin the `arg-contract-flag-entries` count from
  197 to 198 in both the `assert.equal` and the `CADENCE-CENSUS` marker line
  above it.
- **Verify:** `node --test cadence-core/bin/trace.test.mjs` passes with new
  cases: an append carrying the flag writes a line whose `corr` is
  `<phase>-<the sha given>` while the phase's newest anchor is a different sha;
  the same append without the flag writes the newest anchor's id; a bare
  `--anchor` is refused with `bad-args` and appends nothing; and `renderTrace`
  for that phase still lists the flagged event, proving the pre-anchor repair
  does not rewrite an explicit earlier id. `node --test
  cadence-core/bin/planning-adjudication.test.mjs` passes with an end-to-end
  case built on the real seams the way that file's `deferral` arms are: a phase
  anchored at sha A, a `cad-executor` dispatch and `return` for a plan under
  that anchor, a `risk-check run` whose record matches a surface, then a SECOND
  `phase_start` at sha B, then a settle receipt appended with `--anchor A` -
  `risk-check status --phase <N>` answers `ok:true`, where the identical receipt
  written without the flag leaves that plan's row reading `unfired`.
  `node --test cadence-core/bin/arg-contract.test.mjs` passes with the re-pinned
  entry count. `node cadence-core/bin/self-verify.mjs` reports no
  `budget-overrun` and no `unknown-flag`. `node cadence-core/bin/test.mjs` and
  `npx tsc -p tsconfig.ci.json` pass.

### Task 2: An override receipt names the authorization it descends from

- **Files:** cadence-core/bin/lib/arg-contract.mjs (the `'trace append'` row),
  cadence-core/bin/planning/trace.mjs (`TRACE_STRING_FLAGS` and the
  `appendEvent` call's optional-key spread),
  cadence-core/references/triage-gate.md (the override paragraph and its fenced
  command), cadence-core/bin/weight-budgets.json,
  cadence-core/bin/arg-contract.test.mjs, cadence-core/bin/trace.test.mjs
- **Action:** One human authorization applied to two ranges is two receipts by
  construction, and nothing on either says they descend from one answer:
  measured 2026-09-01 over `/code/smithers`'s nine `outcome/override` events,
  grouping by exact `detail` text collapses two duplicate pairs but misses the
  phase-3 trio, three receipts with three distinct texts on one standing
  authorization - so a derived key answers two of three and misses the case that
  motivated the issue (D-02). Add `--authorization-id` to the `'trace append'`
  row as `{required: false, type: 'string', value: 'refuse', bare: 'refuse'}`,
  the `--agent-id` row character for character and for its reason: a blank id
  would read as "no id" while the caller believes the receipt was labelled. Add
  it to `TRACE_STRING_FLAGS` beside the other refusing flags, trim it the way
  `--agent-id` is trimmed - a stored id is a JOIN KEY and a padded copy must not
  read as a second decision - and write it onto the event as `authorization_id`,
  present ONLY when the flag was given, the omit-when-absent spread every
  optional key on that event already takes. Absent and empty must stay
  distinguishable, or every event written before this flag existed reads as a
  labelled one. Do not key the flag to the `override` event name: the seam is
  event-agnostic by contract and the rule that only an override carries an id is
  held by the prose that writes it, exactly as the rule that a coordinator
  marker carries no `--role` is. Do not derive, hash or normalize anything: the
  id is minted and typed by the coordinator when the engineer answers (D-02).
  In `triage-gate.md`, add the flag to the existing fenced `override` command
  and one sentence to the paragraph beside it: the coordinator mints one id when
  the engineer answers and carries it on EVERY receipt written on that answer,
  so a reader can tell a second range settled by one decision from a duplicate
  write of one range; a receipt written on its own answer carries a fresh one,
  and a receipt written with no authorization at all omits the flag.
  `triage-gate.md:109` is the only line in `cadence-core/**/*.md` that issues an
  override-receipt command and no `.planning/DOCS-CLAIMS.md` row asserts its
  flag set, so nothing else moves and no claim is re-adjudicated (D-14). Add no
  new fenced `--family outcome` block, for the census reason task 1 gives.
  Re-pin `triage-gate.md`'s `weight-budgets.json` row and the
  `arg-contract-flag-entries` count from 198 to 199 - the `assert.equal` and its
  `CADENCE-CENSUS` marker line - in the same commit.
- **Verify:** `node --test cadence-core/bin/trace.test.mjs` passes with new
  cases: two `outcome/override` appends over different ranges carrying the same
  `--authorization-id` write two lines whose `authorization_id` values are equal;
  two carrying different ids write two lines whose values differ; an append with
  no such flag writes a line where `'authorization_id' in event` is FALSE,
  asserted as absence and not as an empty string; a bare `--authorization-id` is
  refused with `bad-args` and appends nothing; and a value with surrounding
  whitespace is stored trimmed. `node --test cadence-core/bin/arg-contract.test.mjs`
  passes with the re-pinned entry count. `node cadence-core/bin/self-verify.mjs`
  reports no `budget-overrun` and no `unknown-flag`, and `grep -n` over
  `cadence-core/references/triage-gate.md` shows the flag on the `override`
  fenced command and on no other. `node cadence-core/bin/test.mjs` and
  `npx tsc -p tsconfig.ci.json` pass.

### Task 3: Pin that the authorization id labels a pair and never widens a settle

- **Files:** cadence-core/bin/planning-adjudication.test.mjs
- **Action:** `GH-220`'s body reads as declare-and-accept - "one answer cleared
  two ranges" becomes something the record states - while the roadmap's own
  criterion reads as tighten, and the roadmap criterion wins (D-03). The id is a
  LABEL: `planning/risk-check.mjs`'s `settles` still requires every fired record
  to carry its own receipt and `settledBy` still requires BOTH range ends, and a
  comment on `settledBy` records that "matched if supplied" on the head alone
  already reopened the widened-range bypass once under a different name. Nothing
  in `risk-check.mjs` changes in this phase, and this task exists to make that a
  pinned property rather than an unstated one: add a regression case proving a
  second fired range with no receipt of its own stays refused even when a
  receipt carrying the same authorization id settles a different range. Build it
  on the real seams the way that file's `deferral` arms are, not on hand-written
  trace lines: the correlation id, the resolved range ids and the row key are
  then the seams' own. Edit no source file - if this case passes only after a
  change to `risk-check.mjs`, the phase has a defect PLAN-2's earlier tasks
  introduced and that is what the case is for.
- **Verify:** `node --test cadence-core/bin/planning-adjudication.test.mjs`
  passes with a new case where one plan has two fired ranges recorded, an
  `override` receipt carrying `--authorization-id <id>` settles the first, a
  second `override` receipt carrying the SAME id settles nothing (it names
  neither end of the second range), and `risk-check status` answers `ok:false`
  with `reason` `risk-fire-missing` and the second range's row reading
  `unfired`; the same status call answers `ok:true` once a receipt naming the
  second range's own base and head is appended. `git diff --stat` for this
  task's commit shows one changed file. `node cadence-core/bin/test.mjs` passes.

## Notes

**Plan order.** This plan runs SECOND. It shares
`cadence-core/bin/planning/trace.mjs`, `cadence-core/bin/planning-adjudication.test.mjs`
and the three census holders with PLAN-1, and
`cadence-core/bin/weight-budgets.json` with PLAN-3, so `plan-overlap` reports
the overlaps and `/cad-execute` routes the three plans sequential on its own.

**Why the two flags are one plan rather than two.** CONTEXT's plan shape asks
for the anchor flag and the authorization id as separate slices on the grounds
that they split along files that do not overlap. They do not: both land their
row in `cadence-core/bin/lib/arg-contract.mjs`'s `'trace append'` entry, both
read through `TRACE_STRING_FLAGS` in `cadence-core/bin/planning/trace.mjs`, both
write their prose line into `cadence-core/references/triage-gate.md`, and both
re-pin the same two counts in `cadence-core/bin/weight-budgets.json` and
`cadence-core/bin/arg-contract.test.mjs`. Two plans over one file set is two
sequential dispatches re-reading the same 575 KB, so they are one plan with one
task each.

**The census holders.** `cadence-core/bin/planning/` is a census subject for
`trace-refusal-sentences`, `planning-detail-sites` and `phase-spelling-callsites`,
so `lease-check --plan-time` requires their three holders on any plan editing a
file under it; `cadence-core/bin/lib/arg-contract.mjs` is the subject of
`arg-contract-flag-entries`, whose holder is `arg-contract.test.mjs`, and that
one really does move - twice, once per flag. `cadence-core/references/` is a
subject of the `weight-budgets` census, whose holder is `weight-budgets.json`,
already declared for the re-pins.

**The flag spelling was the planner's, and here is the choice.** CONTEXT left
`--corr` versus `--anchor` and its placement open. `--anchor` naming the
window's `phase_start` SHA wins over `--corr` naming a whole correlation id: the
id is then derived through the one derivation in the tree rather than typed, and
a receipt can only name a window of the phase it already declares. Both flags
go on `trace append` alone and not on the adjudication writer - the record
already states its own range and its own home, and the correlation id is a
property of the trace, which is the only artifact either flag reaches.
