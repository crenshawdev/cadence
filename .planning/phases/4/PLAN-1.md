---
phase: 4
plan: 1
requirements: [ARG-06]
files:
  - cadence-core/bin/lib/arg-contract.mjs
  - cadence-core/bin/arg-contract.test.mjs
  - cadence-core/bin/self-verify.mjs
  - cadence-core/bin/self-verify.test.mjs
---

# Phase 4: One argument contract instead of nine - Plan 1

## Goal

The rules the seam CLIs each restate exist once, as a declarative argument
contract under `cadence-core/bin/lib/` with a shared evaluator, and
`self-verify.mjs`'s `CONTRACTS` table is that contract rather than a second
table beside it.

## Must be true when done

- `cadence-core/bin/lib/arg-contract.mjs` exists and holds both halves: the
  per-script, per-subcommand declarations and one evaluator that classifies a
  flag's value against its declaration. It emits nothing, reads no environment
  and touches no filesystem.
- Every flag in every row declares a complete grammar - required or optional, a
  type, a value disposition and a SEPARATE bare-flag disposition - and the
  disposition vocabulary is exactly three words: refuse, warn, fall back.
- `self-verify.mjs` no longer defines `CONTRACTS` and imports it; `node
  cadence-core/bin/self-verify.mjs` returns `{"ok":true,...,"problems":[]}`.
- Removing one flag from a row in the shared module makes `self-verify` report
  `unknown-flag` against the prose that names it, so the single table still has
  the teeth the two-table shape had.
- `self-verify.mjs` reads its own `--root` through its declared row rather than
  through a hand-written reader call, and a valueless or empty `--root` still
  refuses as `missing-flag-value` on one stdout JSON line with exit 1.

## Context

D-06 binds the move: `CONTRACTS` MOVES out of `self-verify.mjs`, gains the value
grammar, and self-verify reads it back - one source, not two bound by a check.
D-10 binds the shape: declarative DATA plus a shared evaluator, and the
evaluator returns a classification rather than emitting, the way
`lib/require-int.mjs` and `lib/text-flag-file.mjs` already do. D-11 binds the
return: ONE FLAT `{ok, value, detail}` on both paths, never a JSDoc
discriminated union. D-04 binds the vocabulary to three dispositions. D-14 binds
the placement to `cadence-core/bin/lib/`, which costs nothing in self-verify
terms - check 14 is deliberately non-recursive and skips `lib/`, and no
`weight-budgets.json` entry is under `bin/`. Out of scope here: every adopting
CLI (plans 2 and 3) and the prose section (plan 4).

## Tasks

### Task 1: The declarative contract module and its evaluator

- **Files:** cadence-core/bin/lib/arg-contract.mjs, cadence-core/bin/arg-contract.test.mjs
- **Action:** Create the module holding the declaration grammar - per script, per
  subcommand, each flag declaring whether it is required, its TYPE, its value
  DISPOSITION and, separately, its BARE-FLAG disposition (D-05) - and one
  evaluator that classifies a flag's value against that declaration. The
  disposition vocabulary is exactly the three D-04 names: refuse, warn, fall
  back. Do NOT mint a fourth for the drop-on-bare spreads in `planning.mjs`'s
  `trace append|close` body: dropping a bare flag IS `fallback`, since the bare
  form reads as absent and the caller's own `|| default` or key-omission
  answers. The evaluator returns ONE FLAT object carrying `ok`, `value` and
  `detail` on both the accepted and the refused path and never a JSDoc
  discriminated union (D-11) - `tsconfig.ci.json` runs `checkJs: true` with
  `strict: false` over every non-test `.mjs` under `cadence-core/bin`, and
  `lib/text-flag-file.mjs`'s header records a MEASURED TS2339 at its first call
  site from exactly that pattern. It NEVER emits, never reads `process` or the
  environment and never touches the filesystem: the caller owns its envelope and
  its `reason` string (D-10). The type vocabulary must reach the classifiers
  this tree already has rather than re-derive them - `requireInt`,
  `requireCursorNumber` and `requirePhaseArg` in `lib/require-int.mjs`,
  `requirePlanKey` in `lib/plan-key.mjs` - and it needs a boolean type for the
  flags whose bare form IS the value (`--undo`, `--dry-run`, `--global`,
  `--events`, `--join`, `--list`, `--stats`, `--no-numbers`), or a door reading
  one would call it malformed. Positional argv reading goes through
  `optionalFlag` and `flagValue` imported from `lib/seam-input.mjs`: do NOT
  re-spell either body here, because `helper-census.test.mjs` pins each to
  exactly one home tree-wide and a second copy reddens it. Collapsing
  `optionalFlag` into this module is plan 3's last task, in the same commit as
  the census rewrite (D-09). One hard boundary: this module governs VALUE
  grammar only and must NOT refuse an undeclared flag at runtime - flag
  membership is self-verify check 2's prose-side job, and a runtime refusal
  would break callers no decision here asks about.
- **Verify:** `node --test cadence-core/bin/arg-contract.test.mjs` passes, with
  rows exercising each of the three dispositions on BOTH axes (a malformed value
  and a bare flag), a row asserting the returned object carries `ok`, `value`
  and `detail` keys on the accepted path and on the refused path, and a row
  asserting the evaluator writes nothing to stdout. `node
  cadence-core/bin/test.mjs` still reports 0 failures out of 2357, so the helper
  census still finds exactly one home for each reader.

### Task 2: `CONTRACTS` moves into the module and self-verify reads it back

- **Files:** cadence-core/bin/lib/arg-contract.mjs, cadence-core/bin/self-verify.mjs, cadence-core/bin/self-verify.test.mjs
- **Action:** Move the `CONTRACTS` table out of `self-verify.mjs` (the `const
  CONTRACTS = {` definition and everything through its closing brace) into the
  shared module and delete the local definition, so the flag list has ONE source
  rather than two bound by a check (D-06). Every row moves with its comments:
  the `'*'` global row, the `''` bare-form row, all 16 top-level script keys and
  all 77 subcommand rows, and no flag name changes. `self-verify.mjs`'s two
  consumers read it back through the module - check 2's `const contract =
  CONTRACTS[script]` with its `new Set([...contract[sub], ...contract['*']])`
  allowed-set, and check 14's `if (!CONTRACTS[d.name])`. Because task 3 gives
  each row a value grammar, expose the flag-NAME set those two checks need as an
  accessor on the module rather than letting check 2 spread a row directly; that
  accessor is what keeps the prose lint working once a row stops being a bare
  array. `TWO_WORD` stays in `self-verify.mjs` if check 2 is its only reader.
  Correct `self-verify.mjs`'s own header prose in the same edit - the check-2
  entry describing "the CONTRACTS table below" and the four "takes no CONTRACTS
  row" notes - so the file does not state a location it no longer has. If two
  tables shipped, a flag added to one and not the other is either silently
  accepted at the CLI or reported `unknown-flag` against correct prose, which is
  the drift ARG-06 exists to end reintroduced by the fix.
- **Verify:** `grep -c "const CONTRACTS = {" cadence-core/bin/self-verify.mjs`
  returns 0; `node cadence-core/bin/self-verify.mjs` returns
  `{"ok":true,...,"problems":[]}`; deleting `'--phase'` from the `plan-overlap`
  row in the shared module makes `node cadence-core/bin/self-verify.mjs` report
  an `unknown-flag` problem naming `cadence-core/workflows/execute.md` (which
  invokes `plan-overlap --phase <N>` at line 113), restored afterwards; `node
  --test cadence-core/bin/self-verify.test.mjs` passes.

### Task 3: Every row gains its value grammar

- **Files:** cadence-core/bin/lib/arg-contract.mjs, cadence-core/bin/arg-contract.test.mjs
- **Action:** Give each of the 144 declared flag entries its grammar. Two
  constraints bind the authoring. First, required-ness is per SUBCOMMAND, not
  per flag: `risk-check run` requires `--base` and `--head` while `risk-check
  status` takes the same pair optionally, and folding them would make the table
  state a bound one face does not hold. Second, every disposition must reproduce
  the behavior that ships today, because this phase's requirement is structural
  and a seam that starts refusing an input it used to accept is a regression
  dressed as a fix. The load-bearing ones, each with its evidence: `--dir` and
  `--root` refuse the empty, bare and flag-shaped spellings; `--branch`,
  `--base`, `--remote`, `--merged` and `--version` declare `fallback` on the
  bare form, which is what makes plan 3's collapse safe (D-12) - without it they
  start refusing a valueless spelling their seams' `|| fallback` currently
  absorbs; `--timeout-ms` declares `fallback` on a MALFORMED VALUE, because
  `issue-check.mjs` falls back to its constant on one and that seam's whole
  contract is that it never fails a land; `route.mjs`'s `--phase` declares
  `warn`, never a `usage` refusal, which would route the phase lower than its
  own baseline; `--step`, `--reviewer`, `--trigger` and `--role` on `trace
  append|close` declare refuse on the bare form; `--plan`, `--sha` and `--base`
  on the same two subcommands declare `fallback` on the bare form, keeping the
  drop; `--date` declares refuse on the bare form, which is the rule
  `release-bump.mjs` hand-writes today by testing the flag's own appearance in
  argv beside the reader. A contract that made every typed flag refuse on
  malformed input would reverse two documented decisions at once (D-04).
- **Verify:** A row in `arg-contract.test.mjs` walks every script, every
  subcommand and every flag in the table and asserts each carries a complete
  grammar - a type, a value disposition and a bare-flag disposition, each
  disposition drawn from the three-word vocabulary - so a row added later
  without one reddens rather than defaulting silently. `node
  cadence-core/bin/test.mjs` reports 0 failures; `node
  cadence-core/bin/self-verify.mjs` returns `ok:true` with an empty `problems`.

### Task 4: self-verify adopts the contract for its own `--root`

- **Files:** cadence-core/bin/self-verify.mjs, cadence-core/bin/self-verify.test.mjs
- **Action:** `self-verify.mjs`'s entry block reads `--root` through the
  contract's own declared row instead of the hand-written `flagValue(argv,
  '--root')` call, so the rule comes from the declaration rather than from a
  call the file restates. This is the tracer bullet for the whole phase -
  declaration to evaluator to CLI refusal to envelope - and the first adopter is
  deliberately the file the table just left. It keeps the THROWING mechanism and
  the `e.seam` catch arm below it (D-08): the refusal still emits
  `{ok:false, reason:'missing-flag-value', detail:'--root'}` on stdout, and
  without that arm a thrown seam object carrying no `message` would surface as
  detail `"[object Object]"`. A genuinely ABSENT `--root` still falls through to
  `join(HERE, '..', '..')`, unchanged. Do not touch any of the 25 checks.
- **Verify:** `node cadence-core/bin/self-verify.mjs --root ''` and `node
  cadence-core/bin/self-verify.mjs --root` each print exactly one JSON line
  `{"ok":false,"reason":"missing-flag-value","detail":"--root"}`, exit 1, and
  write zero bytes to stderr; `node cadence-core/bin/self-verify.mjs` with no
  flag still returns `{"ok":true,...,"problems":[]}`; `node
  cadence-core/bin/self-verify.mjs --root .` returns `ok:true`; `node --test
  cadence-core/bin/self-verify.test.mjs` passes.

## Notes

Flagged assumption checked during planning: `self-verify.mjs` importing the
table from a runtime module creates no cycle. The contract module's imports are
`lib/seam-input.mjs` (which self-verify already imports), `lib/require-int.mjs`
and `lib/plan-key.mjs`, and none of the three imports anything under `bin/`
past node builtins. If a load-order problem does appear, D-06's single table
becomes a data-only file both sides import - record that as a deviation rather
than shipping two tables.

Plans 2, 3 and 4 all depend on this plan; plan 3 also writes
`cadence-core/bin/lib/arg-contract.mjs` for the `optionalFlag` collapse, so
these two plans are SEQUENTIAL and must not run on the parallel path.
