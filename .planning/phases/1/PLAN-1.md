---
phase: 1
plan: 1
requirements: [TRN-01]
files:
  - cadence-core/bin/lib/text-flag-file.mjs
  - cadence-core/bin/text-flag-file.test.mjs
  - cadence-core/bin/planning.mjs
  - cadence-core/bin/planning.test.mjs
  - cadence-core/bin/trace.test.mjs
  - cadence-core/bin/milestone-prune.test.mjs
  - cadence-core/bin/self-verify.mjs
---

# Phase 1: One transport for caller-derived text - Plan 1 (the seam)

## Goal

Every seam flag that carries caller-derived free text can take that text as a
FILE PATH instead of a double-quoted shell word, refusing the same way
`capture --text-file` already refuses, so the workflows have a transport to move
to. This plan builds only the seam; Plan 2 moves the prose onto it.

## Must be true when done

- `trace append --detail-file`, `trace close --detail-file`,
  `trace append --read-file`, `uat record --fields-file`,
  `milestone-prune --label-file` and `cursor set --next-file` each produce the
  same record their inline flag produces for the same value.
- A file whose contents carry `$(id)` or a backtick reaches the record verbatim,
  never expanded.
- For every one of those flags: a valueless flag, a missing path, an empty file
  and an unreadable path each return `ok:false, reason:"bad-args"` and write
  nothing, the unreadable case naming the read error; passing the inline and the
  file form together returns `bad-args` rather than resolving by precedence.
- The inline forms all still accept a value at the CLI - nothing is deleted.
- `trace close --detail-file <path>` closes a `checkpoint`, exactly as
  `--detail "<text>"` does, and a close carrying neither still closes a `return`.
- `node --test 'cadence-core/bin/*.test.mjs'` and
  `node cadence-core/bin/self-verify.mjs` both exit 0.

## Context

Locked: D-04 (flags are named `--<field>-file`, are ADDITIVE, and reproduce
`cmdCapture`'s refusal vocabulary in shape - never `readJsonPayload`'s
`no-payload`/`bad-payload`), D-05 (`uat record` takes ONE `--fields-file`
holding a JSON object, not per-field files), D-12 (every new flag joins its
`CONTRACTS` row in `cadence-core/bin/self-verify.mjs` or check 2 files
`unknown-flag` against the workflow that uses it), D-01 (a flag the seam
validates against a closed enum or an integer grammar is out of scope by
construction - `--phase`, `--status`, `--result`, `--severity`, `--origin`,
`--family`, `--event`, `--tokens` gain nothing here).
The model to copy is `cmdCapture` at `cadence-core/bin/planning.mjs:3810-3872`
and its tests at `cadence-core/bin/capture-file.test.mjs:361-397`.
Out of scope here: every prose surface, the register and the self-verify check
(Plan 2), and deleting any inline form.

## Tasks

### Task 1: One file-transport reader, wired through `trace append|close --detail-file`

- **Files:** cadence-core/bin/lib/text-flag-file.mjs,
  cadence-core/bin/text-flag-file.test.mjs, cadence-core/bin/planning.mjs
  (`cmdTrace`), cadence-core/bin/planning.test.mjs,
  cadence-core/bin/self-verify.mjs (`CONTRACTS`)
- **Action:** Add a pure module under `cadence-core/bin/lib/` that resolves a
  `--<field>-file` path to its trimmed contents or to a named refusal, and wire
  `trace append` and `trace close` in `cmdTrace` through it as `--detail-file`.
  The module reproduces all four of `cmdCapture`'s refusals in shape (D-04):
  a flag present with nothing usable after it, an unreadable path whose message
  carries the read error, a file that is empty after trimming, and the inline
  and file form given together. Do NOT route the read through `readText` in
  `lib/seam-input.mjs` - it returns `''` on failure and discards the error that
  AC4 requires be named, and `helper-census.test.mjs` pins that idiom to one
  definition. Do NOT reuse `readJsonPayload` (`planning.mjs:614`): its envelope
  is `no-payload`/`bad-payload`, a vocabulary no workflow reads (D-04). The
  resolved text reaches the same `detail` field `appendEvent` already writes.
  The close arm's checkpoint/return inference at `planning.mjs:2790` currently
  reads `opts.detail` alone and must read the RESOLVED detail instead: left
  as-is it would bill every converted checkpoint site as a clean `return`, the
  one arm the record exists to keep separate (the comment there states why).
  A refusal appends nothing at all. Follow the module-plus-header convention
  `lib/deferred-reads.mjs` and `lib/require-int.mjs` use: the reasoning lives in
  the module header, not restated at each call site. Add `--detail-file` to the
  `trace append` and `trace close` rows of `CONTRACTS` in the same commit (D-12).
- **Verify:** `node --test 'cadence-core/bin/text-flag-file.test.mjs'
  'cadence-core/bin/planning.test.mjs'` exits 0 with new cases showing: a file
  whose contents contain `$(id)` and a backtick appends a `detail` byte-equal to
  the file's trimmed contents; a valueless `--detail-file`, a path that does not
  exist, an unreadable path, an empty file, and `--detail "x" --detail-file
  <path>` together each return `ok:false, reason:"bad-args"` and leave
  `trace.jsonl` byte-unchanged; the unreadable case's `detail` contains the
  errno text; `trace close --detail-file <path>` writes `"event":"checkpoint"`
  and a `trace close` with neither flag still writes `"event":"return"`.
  `node cadence-core/bin/self-verify.mjs` exits 0.

### Task 2: `trace append --read-file`

- **Files:** cadence-core/bin/planning.mjs (`cmdTrace`),
  cadence-core/bin/planning.test.mjs, cadence-core/bin/self-verify.mjs
  (`CONTRACTS`)
- **Action:** Accept `--read-file <path>` on `trace append` (and on `trace
  close` only if the existing `--read` handling already reaches that arm - do
  not widen the close row beyond what `--read` has today). The file's contents
  are split by the SAME comma grammar `--read` uses at `planning.mjs:2861-2870`,
  with the same all-blank refusal, so the two transports cannot disagree about
  what an element is; the grammar comment there (an element is any verbatim
  string naming something the site caused the worker to read - a path, a glob,
  or a ref range, stored with no existence check and no normalization) governs
  the file form unchanged. Reuse task 1's reader for the read and its four
  refusals. Add `--read-file` to the `trace append` row of `CONTRACTS`.
- **Verify:** `node --test 'cadence-core/bin/planning.test.mjs'` exits 0 with
  cases showing a two-element comma list in a file producing the identical
  `read` array the same value produces inline; a valueless flag, a missing path,
  an unreadable path, an empty file, an all-blank file and `--read` plus
  `--read-file` together each returning `bad-args` with nothing appended.
  `node cadence-core/bin/self-verify.mjs` exits 0.

### Task 3: `uat record --fields-file`

- **Files:** cadence-core/bin/planning.mjs (`cmdUat`),
  cadence-core/bin/planning.test.mjs, cadence-core/bin/self-verify.mjs
  (`CONTRACTS`)
- **Action:** Accept ONE `--fields-file <path>` on `uat record` holding a JSON
  object of the free-text fields - `reason`, `reported`, `cause`, `fix`,
  `evidence` - and nothing else (D-05: per-field files would cost up to three
  extra Writes per failed item on the workflow whose per-item round-trip
  discipline is explicit). The accepted values land in the same
  `[flag, field]` loop at `planning.mjs:800-804` that the inline flags feed, so
  an identical value produces a byte-identical UAT.md. The refusals are task 1's
  `bad-args` set, NOT `uat merge --payload`'s `no-payload`/`bad-payload`
  (D-05), plus: a payload that is not a JSON object, a value that is not a
  string, a key outside the five free-text fields, and a field given both
  inline and in the file. Refuse an out-of-set key rather than dropping it -
  `severity`, `origin`, `criterion`, `result` and `source` are enum-validated at
  their own guards (`planning.mjs:743-790`) and admitting them through the file
  would either bypass those guards or silently discard a field the caller
  believes was recorded; the seam's standing posture at those guards is that a
  rejected value leaves the file byte-unchanged. Every refusal lands BEFORE any
  write. Do NOT add a newline guard to the values: `renderUat` already flattens
  embedded newlines on write and its comment states why. Add `--fields-file` to
  the `uat record` row of `CONTRACTS`.
- **Verify:** `node --test 'cadence-core/bin/planning.test.mjs'` exits 0 with
  cases showing a `--fields-file` holding all five free-text fields - `reason`,
  `reported`, `cause`, `fix` and `evidence` - producing a UAT.md byte-identical
  to the same five values passed inline, so a field silently dropped by the
  reader fails a case rather than passing one; a
  value containing `$(id)` landing verbatim; a valueless flag, a missing path,
  an unreadable path, an empty file, a JSON array, a non-string value, a
  `severity` key, and `--reason` inline beside a `reason` key in the file each
  returning `bad-args` with UAT.md byte-unchanged.
  `node cadence-core/bin/self-verify.mjs` exits 0.

### Task 4: `milestone-prune --label-file`

- **Files:** cadence-core/bin/planning.mjs (`cmdMilestonePrune`),
  cadence-core/bin/milestone-prune.test.mjs, cadence-core/bin/self-verify.mjs
  (`CONTRACTS`)
- **Action:** Accept `--label-file <path>` on `milestone-prune`, resolved
  through task 1's reader, feeding the SAME `label` the inline flag feeds. Both
  existing terms at `planning.mjs:4053` (the `|`-or-newline table term) and
  `:4065` (the `_archive-<label>` containment term) still run on the resolved
  label and in the same order, before any read, mkdir or rename and in both
  modes - the transport changes how the label arrives, never what it must
  satisfy. Add `--label-file` to the `milestone-prune` row of `CONTRACTS`.
- **Verify:** `node --test 'cadence-core/bin/milestone-prune.test.mjs'
  'cadence-core/bin/planning.test.mjs'` exits 0 with cases showing a label from
  a file producing the same archive directory and the same `## Shipped` rows the
  inline label produces; a file holding `../../../outside-tree` still refused by
  the containment term; a file holding a `|` still refused by the table term; a
  valueless flag, a missing path, an unreadable path, an empty file and
  `--label` beside `--label-file` each returning `bad-args` with the tree
  untouched. `node cadence-core/bin/self-verify.mjs` exits 0.

### Task 5: `cursor set --next-file`

- **Files:** cadence-core/bin/planning.mjs (`cmdCursorSet`),
  cadence-core/bin/planning.test.mjs, cadence-core/bin/self-verify.mjs
  (`CONTRACTS`)
- **Action:** Accept `--next-file <path>` on `cursor set`, resolved through
  task 1's reader, feeding the same `next` value the inline flag feeds; the
  existing `--status`/`--phase` refusals and the name/total derivation are
  untouched. One added refusal beyond task 1's set: a resolved value containing
  a newline is `bad-args` naming the newline, because `renderCursor` writes
  `next` into the cursor's `Next:` line unflattened and
  `references/conventions.md` states the cursor is always exactly four lines -
  a wrapped resume pointer written to a file would otherwise produce a fifth
  line that `parseCursor` cannot read back. This mirrors the structural refusal
  `milestone-prune --label` already makes at `planning.mjs:4053`, and it refuses
  rather than flattening because this seam's standing posture is that a
  malformed value is a malformed CALL and nothing is written. Add `--next-file`
  to the `cursor set` row of `CONTRACTS`.
- **Verify:** `node --test 'cadence-core/bin/planning.test.mjs'` exits 0 with
  cases showing a resume pointer from a file producing a STATE.md byte-identical
  to the same value passed inline, a value containing `$(id)` landing verbatim,
  a two-line file returning `bad-args` with STATE.md byte-unchanged, and the
  valueless / missing / unreadable / empty / both-forms cases each returning
  `bad-args`. `node --test 'cadence-core/bin/*.test.mjs'` and
  `node cadence-core/bin/self-verify.mjs` both exit 0.

## Notes

- This plan shares `cadence-core/bin/self-verify.mjs` with Plan 2 (the
  `CONTRACTS` rows here, check 19 there). That is deliberate: Plan 2's prose
  prescribes flags that only exist once this plan lands, so the two must run
  SEQUENTIALLY, and a reported overlap is what makes `plan-overlap` refuse the
  parallel path rather than authorizing both plans against one tree.
- The `CONTRACTS` rows land with their flags here even though no prose uses them
  yet: check 2 only fires on a surface that names a flag, so the rows are inert
  until Plan 2's sweep and then are exactly what keeps it green (D-12).
- Whether the five flags share one reader module or repeat the guard inline is
  the executor's call, but the refusal vocabulary must be identical in shape at
  all five; the tree's convention for a repeated guard is a `lib/` module
  (`lib/require-int.mjs`, `lib/seam-input.mjs`), which is why task 1 names one.
  If the module is not written, drop its two paths from the lease rather than
  creating an empty file.
