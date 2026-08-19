---
phase: 2
plan: 2
requirements: [ARG-03, ARG-04]
files:
  - cadence-core/bin/lib/require-int.mjs
  - cadence-core/bin/require-int.test.mjs
  - cadence-core/bin/lib/issue-decision.mjs
  - cadence-core/bin/issue-decision.test.mjs
  - cadence-core/bin/lib/planning-files.mjs
  - cadence-core/bin/planning-files.test.mjs
  - cadence-core/bin/planning.mjs
  - cadence-core/bin/planning.test.mjs
---

# Phase 2: Readers that accept what they have a rule against - Plan 2

## Goal

The planning numeric layer stops answering with a number it silently changed: a
phase spelling that cannot round-trip is refused at the two write faces that
would merge it into another phase, and every shared numeric reader refuses a
digit string outside the safe-integer range instead of rounding it or yielding
`Infinity`.

## Must be true when done

- `requireInt('9007199254740993')` and `requireCursorNumber('9007199254740993')`
  each answer `{ok:false}` where they answer `{ok:true,value:9007199254740992}`
  today, and a 400-digit digit string is refused by both.
- `normalizeNumber`'s two call sites and `scanIssueRefs` refuse the same two
  values, where `scanIssueRefs` yields `Infinity` today; one tracker row carrying
  an out-of-range number fails the WHOLE list read rather than dropping the row.
- No `phase` field produced by `parseCaptureSnippets` or `parseArchiveRows` is
  `Infinity` or a rounded value for any input, and a sub-phase spelling
  (`phase 1.1`, `phases/1.1/SUMMARY.md`) still parses to `1.1`.
- `seed-reqs --phase 1.10` and `cursor set --phase 1.10` each answer `ok:false`
  naming the spelling and write nothing, where they write
  `| BBB-01 | Phase 1.1 | Pending |` and `Phase: 1.1 of 2 (One)` today - the
  OTHER phase's row and the other phase's name.
- `--phase 2.1` and `--phase 2` still succeed at both faces, and
  `phase-done --n 02` still checks its ROADMAP box.
- `node --test 'cadence-core/bin/*.test.mjs'` passes with zero failures.

## Context

CONTEXT.md D-07 (the round-trip refusal lands at the two WRITE faces `seed-reqs`
and `cursor set`, NOT inside `requirePhaseArg`; `phase-done` keeps `.value` per
`planning.mjs:580-582`), D-08 (the safe-integer guard lands across the shared
numeric layer - `requireInt`, `requireCursorNumber`/`requirePhaseArg`,
`normalizeNumber`, `scanIssueRefs`, and the two phase-number readers at
`lib/planning-files.mjs:874` and `:1045` - not in `normalizeNumber` alone),
D-11 (`normalizeNumber`'s refusal fails the whole tracker read by that reader's
stated design, so one pathological row degrades `/cad-land` step 1 to its
one-line skip). `Number.isSafeInteger` appears nowhere in this tree today.

## Tasks

### Task 1: The safe range enters the shared flag guard

- **Files:** cadence-core/bin/lib/require-int.mjs (`requireInt` + `requireCursorNumber` + header),
  cadence-core/bin/require-int.test.mjs
- **Action:** `requireInt` ends on `Number.isNaN(n) || !Number.isInteger(n)`;
  replace `Number.isInteger` with `Number.isSafeInteger`, a strict tightening
  (every safe integer is an integer) and exactly what refuses
  `9007199254740993`, measured 2026-08-18 returning
  `{ok:true,value:9007199254740992}` - the flag reader `--total`, `--attempt`,
  `--plan`, `--top`, `--turns` and `--raised` all reach. `requireCursorNumber`
  cannot take the same predicate: its decimal form legitimately accepts `2.1` and
  `Number.isSafeInteger(1.1)` is false, so the integer predicate there would
  refuse every sub-phase. Bound the MAGNITUDE instead - the parsed number must be
  finite and no greater than `Number.MAX_SAFE_INTEGER` - added after the existing
  `CURSOR_SHAPE` test and the `String(n)` round trip, both of which stay: the
  regex is what excludes negatives, exponents and NaN, and the round trip is what
  already refuses a 400-digit string (measured: `requireCursorNumber` of 400
  digits is already `{ok:false}`, while `9007199254740993` is not).
  `requirePhaseArg` inherits through `requireCursorNumber` and gains no check of
  its own. Do NOT introduce a shared range-predicate module for this:
  `lib/issue-decision.mjs` has zero imports and `lib/planning-files.mjs` imports
  only `node:fs` and `lease-grammar.mjs`, and giving either a dependency on the
  seam flag guard for one comparison buys nothing the builtin does not - tasks 2
  and 3 write the same predicate at their own sites, which is the planner's
  choice recorded here. Do not change either function's RETURN shape: both are
  `{ok:true,...}|{ok:false}` unions today and every call site reads them that
  way. Extend the header's stated grammar to say the range is part of it, beside
  the paragraph that already explains the `String(n)` round trip. Add rows to the
  test file: `9007199254740993` and a 400-digit string refused by `requireInt`,
  by `requireCursorNumber` in both forms and by `requirePhaseArg`, with `4`,
  `-2`, `08`, `2.1` and `1.10` still answering exactly as the existing rows pin.
- **Verify:** `node --test cadence-core/bin/require-int.test.mjs` passes; a
  `node -e` import shows `requireInt('9007199254740993')`,
  `requireCursorNumber('9007199254740993')` and
  `requirePhaseArg('9007199254740993')` each `{ok:false}` while
  `requirePhaseArg('1.10')` is still `{ok:true,raw:'1.10',value:1.1}` and
  `requireInt(' -2 ')` is still `{ok:true,value:-2}`; the new rows go red when
  `Number.isSafeInteger` is reverted to `Number.isInteger`;
  `node --test cadence-core/bin/planning.test.mjs cadence-core/bin/route.test.mjs
  cadence-core/bin/trace.test.mjs` still pass - those are the reader's other
  callers.

### Task 2: The tracker readers stop answering about a different issue

- **Files:** cadence-core/bin/lib/issue-decision.mjs (`normalizeNumber` + `scanIssueRefs`),
  cadence-core/bin/issue-decision.test.mjs
- **Action:** `normalizeNumber` returns `raw` for any `typeof raw === 'number'`
  and `Number(raw)` for any `/^\d+$/` string, so a tracker row whose number is
  past the safe range answers with a rounded twin - `9007199254740993` reads as
  `9007199254740992`, a 400-digit one as `Infinity` - and `partitionIssues` then
  answers about a DIFFERENT issue than the one the tracker holds, which is the
  whole value of "#42 is still open" gone. Guard both arms with
  `Number.isSafeInteger` and return `null` when it fails: `null` is this
  function's existing "no readable number" answer and both call sites already act
  on it (`normalizeList` at `:102`, `readOneIssue` at `:136`). Do NOT drop the
  offending row inside `normalizeList`: its stated design at `:100-105` fails the
  WHOLE read on an unreadable number or state because dropping is how a renamed
  field becomes a not-found verdict, and D-11 keeps that - one pathological row
  degrades `/cad-land` step 1 to its one-line skip, which is the accepted cost
  rather than a bug to work around. `scanIssueRefs` returns a bare `number[]`
  with no envelope to refuse into, so an out-of-range reference is EXCLUDED from
  the returned array rather than added as `Infinity`: a 400-digit `#` reference
  names no issue and letting it through makes the seam ask the tracker about
  `Infinity`. State that exclusion in `scanIssueRefs`'s doc block beside the
  near-miss list it already carries. Test through the EXPORTED surfaces -
  `HOST_TABLE.github.normalize` / `.gitlab.normalize` / `.forgejo.normalize` for
  the list arm and `scanIssueRefs` directly - rather than exporting
  `normalizeNumber`, which would widen this seam's surface for a test.
- **Verify:** `node --test cadence-core/bin/issue-decision.test.mjs` passes;
  `HOST_TABLE.github.normalize('[{"number":9007199254740993,"state":"open"}]', 200)`
  returns `complete:false` with `records: []` and a `detail` naming the field,
  and the same for a 400-digit number string, where both answer `complete:true`
  with one record today (measured 2026-08-18: `9007199254740992` and `Infinity`,
  the second of which `JSON.stringify` prints as `null`, so assert the VALUE and
  not its serialization); `scanIssueRefs('fixes #' + '9'.repeat(400))` returns
  `[]` where it returns a one-element array holding `Infinity`;
  `scanIssueRefs('fixes #42')` still returns `[42]` and the existing
  three-form/dedupe/sort row still passes.

### Task 3: The two phase-number readers in the planning file layer

- **Files:** cadence-core/bin/lib/planning-files.mjs (`parseCaptureSnippets` + `parseArchiveRows`),
  cadence-core/bin/planning-files.test.mjs
- **Action:** Both build a `phase` with a bare `Number()` over a
  `\d+(?:\.\d+)?` capture (`CAPTURE_PHASE_TAG` at `:828`, `ARCHIVE_ROW` at
  `:985`), so a CAPTURE.md tag or an ARCHIVE.md row carrying 400 digits puts
  `Infinity` into the recall corpus and one carrying `9007199254740993` puts a
  neighbouring phase's number there. Use the ROUND-TRIP predicate
  `String(Number(x)) === x`, not `Number.isSafeInteger` and not the magnitude
  bound alone: `1.1` is a legal sub-phase in both grammars, so the integer
  predicate would strip every sub-phase tag and drop every sub-phase archive
  row, while a magnitude bound alone still admits a value that ROUNDS -
  `9007199254740990.1` is under `Number.MAX_SAFE_INTEGER` and `Number()` yields
  `9007199254740990`, a different phase, which is the exact wrong answer this
  task exists to stop. The round trip is what `requireCursorNumber` already
  carries (task 1) and is D-07's own predicate, so the phase states one rule for
  a phase spelling rather than two. It subsumes the magnitude bound: a 400-digit
  string yields `Infinity` whose `String()` is `"Infinity"`, and `1.1` passes
  unchanged. A `(phase 1.10)` tag therefore also leaves `phase` unset, which is
  D-07's answer for that spelling at the write faces, applied here to the read
  faces. The two readers answer differently because their shapes differ.
  In `parseCaptureSnippets` the tag is optional metadata that the `replace`
  callback both records and STRIPS from the snippet text; when the number is out
  of range, leave `phase` unset AND leave the tag in the text (return the matched
  text unchanged), so the bullet still reaches the corpus whole rather than
  losing bytes to a tag that named no phase. In `parseArchiveRows` a row whose
  phase is out of range names a directory nothing in this tree can address, so
  skip the row - the posture that function's own doc block already states for a
  line that does not match `ARCHIVE_ROW` and for a row above the first `## `
  heading - and keep the declared `phase: number` return shape rather than
  widening it to `number|null`, which `cmdRecall`'s corpus (`planning.mjs:2127`)
  and the `alreadyArchived` set (`:4982`) would both have to learn. State both
  answers in the two doc blocks. Do not touch this file's other `Number(` phase
  readers at `:35`, `:99`, `:224` and `:1528`: D-08 names these two and widening
  is a decision nobody made.
- **Verify:** `node --test cadence-core/bin/planning-files.test.mjs` passes with
  new rows - a CAPTURE.md bullet tagged `(phase <400 digits>)` parses with no
  `phase` field and with its text still carrying the tag; a bullet tagged
  `(phase 1.1)` still parses to `phase: 1.1` with the tag stripped; an ARCHIVE.md
  row naming `phases/<400 digits>/SUMMARY.md` is absent from the result while a
  `phases/1.1/SUMMARY.md` row beside it is present with `phase: 1.1`; a bullet
  tagged `(phase 9007199254740990.1)` and an ARCHIVE row naming
  `phases/9007199254740990.1/SUMMARY.md` are refused the same way, where today
  they answer `9007199254740990` - a DIFFERENT phase, and the row a magnitude
  bound alone would have passed; and a `node -e` import shows no returned
  `phase` is `Infinity` and no returned `phase` differs from the digits its
  input spelled.

### Task 4: `seed-reqs` and `cursor set` refuse a spelling that cannot round-trip

- **Files:** cadence-core/bin/planning.mjs (`cmdCursorSet` + `cmdSeedReqs`),
  cadence-core/bin/planning.test.mjs
- **Action:** `requirePhaseArg` deliberately returns the caller's raw spelling
  beside the numeric value, and both of these WRITE faces then use the NUMBER:
  measured 2026-08-18 on a fixture holding both `phases/1.1/` and `phases/1.10/`,
  `seed-reqs --phase 1.10` wrote `| BBB-01 | Phase 1.1 | Pending |` and
  `cursor set --phase 1.10` wrote `Phase: 1.1 of 2 (One)` - each picking the
  other phase's name, silently, with `ok:true`. At both faces, after the existing
  `requirePhaseArg` check and before any read or write, refuse a spelling that
  does not round-trip: the parsed value rendered back with `String()` must equal
  the raw spelling the caller sent, so `1.10`, `1.0` and `01` are refused while
  `2`, `2.1` and `10` pass. Fail through the existing `bad-args` reason - no new
  reason code - with a detail that quotes the spelling the caller sent AND the
  spelling that would be accepted, since the caller's fix is either to retype the
  flag or to rename the directory. Write the predicate ONCE in this file and call
  it from both faces rather than pasting the comparison twice. The refusal lands
  at these two faces only (D-07): `requirePhaseArg` itself is unchanged, its
  `raw` field and the `require-int.test.mjs:31-33` rows that pin it stay, and the
  other `requirePhaseArg` call sites in this file keep today's behaviour -
  `phase-done` in particular keeps reading `.value` per its own D-11 comment at
  `:578-582`, so `--n 02` still boxes its phase and `--n 2.1` still boxes Phase
  2.1. Both faces' existing comments describe the collision as a known,
  deliberately-carried cost and point at `.planning/CAPTURE.md`; rewrite those
  two comments to say what is now true - the collision is refused at the door
  here, and the raw spelling still addresses `phases/<raw>/` at the four reads
  that are not these two faces. STATED COST (D-07): this removes the ability to
  seed traceability rows for, or point the cursor at, a `phases/1.10/`
  directory - a capability `lib/require-int.mjs:48-66` deliberately built.
- **Verify:** on a fixture with `phases/1.1/` and `phases/1.10/` both holding a
  PLAN.md, `planning.mjs seed-reqs --dir <fixture> --phase 1.10` and
  `planning.mjs cursor set --dir <fixture> --phase 1.10 --status planning --next
  '/cad-plan 1'` each print `ok:false` with `reason:"bad-args"` and a detail
  quoting `1.10`, exit 1, and leave REQUIREMENTS.md and STATE.md byte-identical
  (`sha256sum` before and after); `--phase 2.1` and `--phase 2` still succeed at
  both faces on the same fixture; `planning.mjs phase-done --n 02` still checks
  its ROADMAP box; `node --test cadence-core/bin/planning.test.mjs` passes with
  rows for `1.10`, `1.0` and `01` refused and `2`, `2.1` accepted at each face.

## Notes

- No new shared reader is introduced anywhere in this plan, and no existing
  reader's return shape changes. Recalled from `.planning/CAPTURE.md` (latent):
  the shared reader in `lib/text-flag-file.mjs` returns ONE shape
  (`{ok, value, detail}`) rather than an ok-discriminated union because the union
  is a TS2339 at the first call site under this repo's `strict:false` CI
  typecheck - measured, not assumed. `require-int.mjs`'s existing union is
  already assignable at its call sites; leave it alone rather than reshaping it
  while tightening the range.
- `tsc` is absent from this machine (`tsconfig.ci.json` installs TypeScript
  ephemerally in CI), so no Verify above runs the typecheck. Task 3 is the one
  that touches a documented return shape, and it deliberately keeps
  `phase: number` for that reason.
- CONTEXT flags an assumption this plan cannot settle: no shipped project outside
  this repo addresses a `phases/1.10/` directory that task 4's refusal would
  strand. If that is wrong, the repair for such a project is a directory rename
  it was never told to make.
