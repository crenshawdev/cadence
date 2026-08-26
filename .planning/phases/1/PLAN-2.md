---
phase: 1
plan: 2
requirements:
  - RSK-05
files:
  - cadence-core/bin/lib/risk-diff.mjs
  - cadence-core/bin/risk-diff.test.mjs
  - cadence-core/bin/route.mjs
  - cadence-core/bin/route.test.mjs
  - cadence-core/bin/self-verify.test.mjs
---

# Phase 1: Bound what a dispatch is handed - Plan 2

## Goal

A plan declaring a large file can still earn the routing discount. This plan is
the RSK-05 half: the plan-time risk floor stops treating a whole file's
incidental body lines as evidence of a risk surface, and each replay row states
what reading it cost.

## Must be true when done

- A declared file's line that only IMPORTS a name, or only DECLARES a constant,
  no longer evidences a risk surface at plan time; a line that CALLS something
  still does.
- The narrowing reaches the plan-time face only: `risk-check`'s commit-time scan
  of a diff answers exactly as it does today, and the shared signal table is
  untouched.
- `route.mjs replay` names, per phase, each declared file whose only evidence for
  a surface sat on a withheld line - so a raise that used to rest on a false
  positive says so instead of moving silently.
- Every one of this repository's 28 archived phase directories computes the same
  level after the change as before it, and `regressions` stays empty.
- Every `route.mjs replay` row carries the bytes it read to compute its level.
- `node cadence-core/bin/test.mjs` is green and `node cadence-core/bin/self-verify.mjs`
  reports no problems.

## Context

Locked: there is no diff at plan time and no route to one, so RSK-05 is
satisfied by narrowing what counts as evidence (D-01); the narrowing lives in
`scanDeclared`'s own arms and never in `CONTENT_SIGNALS`, which the blocking
commit-time gate shares (D-02); it is a LINE-KIND exemption for import
statements and constant declarations, and the rejected alternative is a
"more than one matching line" threshold (D-03); `waive_routing_floor` is not the
answer and is left alone (D-04); asking planners to declare narrower files is
foreclosed by the lease grammar (D-05); bytes read are recorded on the replay row
with no reduction target this phase (D-11).

Out of scope here: `plan-size`, the byte ceiling and its config key - that is
PLAN-1, which shares no file with this one. Also out: the rung ladder, the
`waive_routing_floor` key, and any edit to `CONTENT_SIGNALS`.

## Tasks

### Task 1: `scanDeclared` stops counting import and constant-declaration lines

- **Files:** cadence-core/bin/lib/risk-diff.mjs, cadence-core/bin/risk-diff.test.mjs
- **Action:** Start at `scanDeclared`, beside `isSignalTable` and `isDocument`.
  In `scanDeclared`'s body-splitting loop - the one that already
  skips a signal-table path and a document path before pushing a body's lines
  onto `lines` - withhold two LINE KINDS from the array it builds. It goes here
  and nowhere else: `signalIn` and `CONTENT_SIGNALS` are shared with `scanDiff`
  by construction so the two faces' signals and their ORDER cannot drift, and
  that table is the one `blocking`-at-every-stakes-level commit-time gate's too
  (D-02); both existing exemptions are already scoped to this face and say why in
  their own comments. The two kinds (D-03) are: an IMPORT statement - a line
  whose leading token declares a module import, covering at least `import ...`,
  `from X import ...`, `#include ...`, `use ...`, and a `const`/`let`/`var`
  binding initialized from `require(...)`; and a CONSTANT DECLARATION whose
  initializer is a LITERAL, meaning a declaration keyword (`const`, `static`,
  `final`, `val`) or a SCREAMING_SNAKE name bound to a string, number, regex,
  boolean, null or bracketed literal with NO call expression anywhere in the
  initializer. That literal restriction is load-bearing and is this plan's
  reading of "constant declaration", not a reduction of it: `const rows =
  JSON.parse(readFileSync(path, 'utf8'))` in `self-verify.mjs` is syntactically a
  constant declaration and is a real `untrusted_input` call site, so exempting
  every `const` line would buy the discount by weakening the floor, which is the
  one thing this phase's goal forbids, and it would make the floor fire or not
  on assignment style. A line-kind exemption withholds the WHOLE LINE, so a
  line that both declares and calls - `import { rmSync } from 'node:fs'; rmSync(dir, { recursive: true });`, or `import('m').then(() => rmSync(d))` -
  must NOT be withheld: exempt a line only when nothing follows the declaration it matched on that line, and treat a dynamic `import(` call as
  code rather than an import statement. Withholding a mixed line would drop a
  genuine call site and buy the discount by weakening the floor, which AC5 and
  the phase goal forbid - the same reasoning that keeps `const rows =
  JSON.parse(...)` counting. Anchor every pattern at line start, never a substring
  test, on the rule this file's header already states, and add no category-NAME
  keyword grep. The four measured false positives that must stop counting are
  `cadence-core/bin/self-verify.test.mjs:6` (an `fs` teardown import naming
  `rmSync`), `cadence-core/bin/lib/planning-files.mjs:112` (`const PHASE_TOKEN =`
  a regex literal), `cadence-core/bin/review-provider.mjs:306` (`const
  DEFAULT_MAX_PROMPT_TOKENS = 120000`) and `cadence-core/bin/lib/debt-markers.mjs:21`
  (`const DEBT_TOKEN = 'CADENCE-DEBT'`). Do NOT touch `scanDiff`, `parseDiff`,
  `signalIn`, `CONTENT_SIGNALS` or the two existing exemptions: `scanDiff` reads a
  HUNK, where a line someone actually wrote is real evidence and the header's
  fix-at-the-MENTION rule stays in force unedited. Record the exemption's
  argument in a comment beside the other two, as every narrowing in this file
  already is.
- **Verify:** `node --test cadence-core/bin/risk-diff.test.mjs` passes with new
  cases proving each of: an entry whose body is only `import { rmSync } from
  'node:fs';` returns no `destructive` match while an entry whose body is
  `rmSync(dir, { recursive: true });` still does; an entry whose body is only
  `const DEBT_TOKEN = 'CADENCE-DEBT';` returns no `secrets` match while a body
  calling `writeFileSync(f, 'OPENAI_API_KEY=x')` still does; an entry whose body
  is `const rows = JSON.parse(readFileSync(p));` STILL returns an
  `untrusted_input` match; an entry whose body is the single line
  `import { rmSync } from 'node:fs'; rmSync(dir, { recursive: true });` STILL
  returns a `destructive` match, and one whose body is
  `import('node:fs').then(({ rmSync }) => rmSync(d));` does too, so a mixed
  line is not withheld; and `scanDiff` over a diff whose added line is that
  same `rmSync` import still reports `destructive`, so the commit-time face did
  not move.

### Task 2: the replay names the file whose match no longer counts

- **Files:** cadence-core/bin/lib/risk-diff.mjs, cadence-core/bin/route.mjs, cadence-core/bin/risk-diff.test.mjs, cadence-core/bin/route.test.mjs
- **Action:** The two edit sites are `scanDeclared` and route.mjs's `levelFor`.
  `scanDeclared` returns, beside `matches`, a second list naming per
  declared path each wanted category that matched ONLY on lines task 1 withheld -
  a category that file evidenced before the narrowing and does not evidence
  after it. Compute it from the lines already split in that loop, through the
  SAME `signalIn` the matches go through, so no second signal table appears
  anywhere; `scanDiff`'s return shape does not change, because that face
  withholds nothing. Then `levelFor` in route.mjs states one `reason` entry per
  such entry, naming the scope, the file and the category, in the `risk floor: `
  vocabulary every other entry in that function uses. It is a `reason` and not a
  `warning`: `warnings[]` there is for an input the floor could NOT read, and a
  withheld line is one it read and judged, which is the distinction that
  function's own comments keep. Nothing is added to `resolve`'s envelope beyond
  the reason list it already carries. Measured on this repository 2026-08-26 this
  fires 5 times across the 28 archived phase directories, so it is a sentence and
  not a flood.
- **Verify:** `node cadence-core/bin/route.mjs replay --file .planning/config.json`
  shows the `_archive-v2.2.0/2` row carrying a `reason` entry that names
  `cadence-core/bin/git-publish.test.mjs` and `secrets`, and that row's cited
  evidence is no longer `secrets` on that file; all 28 rows carry the same
  `computed` level they carry today - 25 at `shipped` with `raised: true`,
  `_archive-v2.2.0/5` and `_archive-v2.6.0/1` at `solo`, `_archive-v2.6.0/5` at
  `shipped` with `raised: false` - and `regressions` is empty. `node --test
  cadence-core/bin/risk-diff.test.mjs cadence-core/bin/route.test.mjs` passes,
  including a case that a declared file whose category survives on a non-withheld
  line is NOT named in that list.

### Task 3: every replay row carries the bytes it read

- **Files:** cadence-core/bin/route.mjs, cadence-core/bin/route.test.mjs, cadence-core/bin/self-verify.test.mjs
- **Action:** The three edit sites are `declaredBodies`, `levelFor` and
  `replay`. `declaredBodies` already reads each declared body or declines it
  with `unread`. Carry the byte length of every body it actually read up through
  `levelFor`'s returned record and print it on each `replay` row in the
  snake_case that row's `plans_found` and `plans_clean` already use (D-11). It
  counts the DECLARED bodies and only those: the PLAN files' own bytes are
  `declaredFilesIn`'s read rather than this one's, a path that took any `unread`
  arm and a path that does not exist contributed nothing, and `evidencedBy`'s
  per-entry re-scan re-reads no disk, so a body scanned several times is counted
  once. Do not put the figure on `resolve`'s envelope: the criterion asks for the
  replay row, and the resolve bundle's shape is read at every dispatch site.
  There is no reduction target this phase (D-11) - the row exists so that the
  17.2 MB this floor reads across 28 phase directories is on the record instead
  of being inferred. `lease-check --plan-time` names one hand-maintained count at
  risk from this plan: the `mergeLayers` callsite census in
  `self-verify.test.mjs`, because route.mjs holds one of those callsites. This
  task adds none, so re-run that test and leave its pinned numbers alone unless
  they genuinely moved.
- **Verify:** `node cadence-core/bin/route.mjs replay --file .planning/config.json`
  gives all 28 rows an integer byte figure, with `_archive-v2.2.0/5` reporting
  14853 - it declares three paths and only `README.md`, which is 14,853 B,
  exists. `node --test cadence-core/bin/route.test.mjs` passes with a case
  proving a scope whose one declared path does not exist reports the figure as 0
  rather than omitting the field, and a case proving a scope with an oversized or
  otherwise `unread` declared file does not count that file's bytes.

## Notes

- **AC4's "lower level" half has no witness on this corpus, measured.** Under
  the D-03 exemption no archived scope computes a level below the one it computes
  today, because for a level to drop EVERY answered category must go silent for
  that scope, and all 25 raising scopes hold at least one genuine call-site match
  that is neither an import nor a constant declaration - typically a `JSON.parse(`
  or an `rmSync(` call. Measured 2026-08-26 over all 28 phase directories: 2.0%
  of the 296,170 declared body lines are withheld, 5 files across 5 rows lose
  their only evidence for a category, 1 row (`_archive-v2.2.0/2`) changes its
  winning surface from `secrets` to `destructive`, 5 rows change the file their
  raise cites, and 0 rows change level. The broader reading of "constant
  declaration" (any `const` line, whatever its initializer) was measured too and
  also moves 0 levels, while additionally exempting real `const x = JSON.parse(...)`
  call sites. This is the CONTEXT's own first flagged assumption firing, one step
  worse than it anticipated: it is AC4 that is left without a witness, not AC5.
  AC5 is satisfied in full - all 28 scopes compute today's level - and AC4's
  second half, a `reason` naming the file whose body match no longer counts, is
  what task 2 delivers.
- `_archive-v2.6.0/5` holds at `shipped` without raising for a reason the
  discount predicate already states, and `_archive-v2.2.0/5` and
  `_archive-v2.6.0/1` take the unset-stakes `solo` floor because they read clean
  and matched nothing. Nothing in this plan changes either arm.
- These two plans share no declared file, so `/cad-execute` may run them
  concurrently. Both must be green before the phase's AC7 (`test.mjs`,
  `self-verify`) can be checked.
