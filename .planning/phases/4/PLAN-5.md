---
phase: 4
plan: 5
requirements: [ARG-06]
files:
  - cadence-core/bin/lib/arg-contract.mjs
  - cadence-core/bin/arg-contract.test.mjs
  - cadence-core/bin/arg-contract-adoption.test.mjs
  - cadence-core/bin/self-verify.mjs
  - cadence-core/bin/self-verify.test.mjs
  - cadence-core/bin/planning.mjs
  - cadence-core/bin/planning.test.mjs
  - cadence-core/bin/trace.test.mjs
  - cadence-core/bin/config.mjs
  - cadence-core/bin/config.test.mjs
  - cadence-core/references/conventions.md
  - cadence-core/bin/weight-budgets.json
---

# Phase 4: One argument contract instead of nine - Plan 5

## Goal

Every row the argument contract declares is a rule the owning CLI actually
carries out, so the table stops stating refusals `planning.mjs` never applies -
and a check that walks the whole table is what keeps the 145th row from
reopening the gap.

## Must be true when done

- The three spellings UAT item 8 reproduced each refuse: `cursor set --name`
  (bare) returns `ok:false` and leaves `STATE.md` byte-unchanged, `uat init
  --sources` (bare) writes no UAT file, and `uat record --reason` (bare) leaves
  `UAT.md` byte-unchanged. None of the three writes `true` through as a value.
- `planning.mjs` judges its flags off the resolved subcommand's declared row
  wholesale, at its dispatch, rather than at the two sites it consults today.
- A test walks the WHOLE table and proves each declared refusal against the
  shipped CLI: every entry saying `bare: 'refuse'` refuses live naming its flag,
  and so does every entry saying `value: 'refuse'` given a malformed value. A
  REFUSAL row added later that nothing reads reddens there. The bound is
  stated rather than implied: a later row declaring only `fallback` or `warn`
  has no refusal arm to exercise, so the census cannot catch one that nothing
  reads - task 4's Action says why, and narrowing this sentence is the same
  honesty the plan demands of the module header.
- Nothing about ABSENCE moves: `planning.mjs status` with no `--dir` still
  answers about `.planning`, `trace close` with no `--plan` still returns
  `ok:true` omitting the key, and every absent-required refusal keeps the reason
  and the sentence it publishes today (`cursor set needs --phase <N>`, `capture
  --kind must be one of todo | seed | note`, `bad-result` for a bad `--result`).
- `config.mjs get <key> --global` is declared on the `get` row and read off it,
  so a `--global` accepted by a subcommand that declares none is no longer
  possible at that seam.
- `lib/arg-contract.mjs`'s header and `references/conventions.md`'s `## Seam
  arguments` state the reach that shipped - including that PRESENCE is answered
  by the bin that owns the wording and not by the shared door - and
  `conventions.md`'s `weight-budgets.json` row equals its new byte size.
- `node cadence-core/bin/test.mjs` reports 0 failures and `node
  cadence-core/bin/self-verify.mjs` returns `{"ok":true,...,"problems":[]}`.

## Context

Closes UAT items 8 (major) and 9 (minor) of this phase; plans 1-4 are shipped
and are not replanned. D-07 binds the vocabulary: `planning.mjs` mints no new
reason code and names its refusals `bad-args`, because it has ONE refusal
vocabulary and no `e.seam` arm (D-08) - a throwing form there surfaces as
`reason:"internal"`. D-04 keeps the three dispositions and D-05 keeps the
bare-versus-value split as two fields. D-06 keeps one table. D-14 keeps the
shared module under `bin/lib/`. D-16 makes `conventions.md`'s budget row move in
the same commit as its prose, because that file sits at exactly 0 B of headroom.
Out of scope: adding, removing or re-dispositioning any flag row except
`config.mjs get --global`, and any change to how an ABSENT flag is answered.

## Tasks

### Task 1: The row door, and one home for the subcommand key

- **Files:** cadence-core/bin/lib/arg-contract.mjs (beside `evaluateFlag` and
  `flagNames`), cadence-core/bin/arg-contract.test.mjs,
  cadence-core/bin/self-verify.mjs (`TWO_WORD` and check 2's subcommand
  resolution), cadence-core/bin/self-verify.test.mjs
- **Action:** Give the module the two things an adopting dispatch needs and
  neither half has today. First, a resolver from a script's positional words to
  the subcommand KEY its table is filed under. That is a MOVE, not a second
  copy: `self-verify.mjs`'s `TWO_WORD` set and check 2's `TWO_WORD.has(w1) && w2
  ? w1 + ' ' + w2 : w1` expression are the rule, and after this task they live
  in `lib/arg-contract.mjs` with check 2 reading them back - two spellings of
  one rule is the drift ARG-06 exists to end, and `helper-census.test.mjs`
  polices exactly this shape. The bare form (no subcommand) keeps resolving to
  the `''` key, which is what stops check 2 reading a first flag as a
  subcommand. Second, a row-level evaluator that applies `evaluateFlag` to every
  flag a resolved row declares and returns the FIRST refusal, or the accepted
  values. Three constraints bind it. It is a VALUE door and not a presence door:
  it evaluates only the flags actually PRESENT in the argument list and leaves
  an absent-but-required flag to the bin that owns the wording. That is
  `review-provider.mjs`'s shipped position - its exported `parseArgs` skips a
  flag with `if (!rest.includes(flag)) continue;` and its header states why -
  and reversing it would replace diagnostics the declaration cannot express
  (`capture --kind must be one of todo | seed | note`, `milestone-prune needs
  --mode <delete|archive> (tagged release: ...)`) with a generic sentence, on
  inputs neither UAT item is about. It evaluates the script-global `'*'` row
  BEFORE the subcommand's own, because `planning.mjs`'s `--dir` refusal is what
  answers first today and the first failing flag names the refusal. And it
  carries NO wording and no reason code (D-07): the caller names both.
  `arg-contract.test.mjs` asserts every spec has exactly the four fields
  `bare|required|type|value` and calls a fifth "a rule this table states in two
  places", so the refusal sentence may not be added to the table.
- **Verify:** `node --test cadence-core/bin/arg-contract.test.mjs` passes with
  rows showing: a row whose first declared flag is absent and whose second is
  bare refuses naming the SECOND flag; a row whose bare flag declares `fallback`
  is not refused; a refusing `'*'` flag wins over a refusing subcommand flag;
  and the resolver answers `cursor set`, `trace append`, `uat record`,
  `risk-check run` and `renumber insert` for those word pairs, `status` and
  `recall` for one-word forms, and the `''` key for no words at all.
  `grep -c "'cursor', 'uat', 'renumber'" cadence-core/bin/self-verify.mjs`
  returns 0 while the same list appears exactly once under
  `cadence-core/bin/lib/`. `node cadence-core/bin/self-verify.mjs` returns
  `{"ok":true,...,"problems":[]}` and `node --test
  cadence-core/bin/self-verify.test.mjs` passes.

### Task 2: `planning.mjs` gates every declared row at its dispatch

- **Files:** cadence-core/bin/planning.mjs (the dispatch tail's `try { const
  { words, opts } = parseArgs(ARGV); ... }` block, and the four hand-written
  `--root` guards: `detect-commands`, `detect-surfaces` and `debt-harvest` in
  `COMMANDS`, and `trace ignore` in `cmdTrace`),
  cadence-core/bin/planning.test.mjs
- **Action:** Replace the single `--dir` evaluation with the row door from task
  1: resolve the subcommand key from the parsed `words`, and run every flag the
  resolved row and the `'*'` row declare - and that is PRESENT in `ARGV` -
  through the door before `COMMANDS[cmd]` is called. This is the gap UAT item 8
  named: 98 of the table's 144 entries are `planning.mjs`'s and only `--dir`
  and the trace grammar are consulted, so `cursor set --name` (bare) answered
  `ok:true` and wrote `Phase: 1 of 5 (true)` into STATE.md. The refusal is
  `fail('bad-args', ...)` and never the `missing-flag-value` throw (D-07): this
  file has ONE refusal vocabulary and no `e.seam` arm, and its own
  `detect-commands --root` guard states that in code. The refusal SENTENCE
  comes from the flag→sentence map task 3 introduces - the bin owns its wording
  the way `route.mjs`'s `RESOLVE_FLAGS` and `review-provider.mjs`'s `NEEDS`
  already do - and the composed form must reproduce today's text where today's
  text exists: a flag declared on the `'*'` row carries no subcommand prefix
  (`--dir needs a path after it: --dir <planning dir>`, the line UAT item 1
  verified), a flag on a subcommand row does (`detect-commands --root needs a
  path after it: --root <project root>`), and a `--<field>-file` flag composes
  the same sentence `lib/text-flag-file.mjs` produces so its callers see no
  change. Delete the four `--root` shape guards the door makes dead; their
  `'root' in opts && (typeof opts.root !== 'string' || opts.root.trim() === '')`
  predicate is exactly what the declared row now says, trim clause included.
  Three things must NOT move. The door does not mutate `opts`: handlers pass
  values to `requireInt`, `requirePhaseArg` and `resolveTextFlag` themselves,
  and the only non-boolean `fallback` rows in this script are the trace body's,
  which that body already reads as absent through its own loop - overwriting or
  deleting keys here would change what `resolveTextFlag` sees and silently drop
  its "takes `--x` or `--x-file`, never both" refusal. The door never refuses an
  UNDECLARED flag, which is the module's stated hard boundary. And an unknown
  subcommand still falls through to the existing `usage` refusal listing
  `Object.keys(COMMANDS)`, with the door finding no row and evaluating only
  `'*'`. What DOES move, and is the fix: a bare, empty, whitespace-only or
  flag-shaped value on any flag whose row says `refuse` now refuses before the
  handler runs. Record a before/after matrix across the 34 subcommand rows, and
  treat any spelling that starts refusing which its row does NOT declare
  `refuse` as a defect to fix rather than a cost to absorb.
- **Verify:** The three UAT-8 reproductions, each with the rest of the call
  complete, against a scratch `--dir`: `cursor set --phase 1 --status planned
  --next '/cad-plan 1' --total 5 --name` returns `{"ok":false,"reason":"bad-args"}`
  whose detail names `--name` and leaves STATE.md byte-identical; `uat init
  --phase 1 --sources` with a valid JSON payload on stdin returns `ok:false`
  naming `--sources` and writes no `phases/1/UAT.md`; `uat record --phase 1
  --item 1 --result pass --reason` returns `ok:false` naming `--reason` and
  leaves UAT.md byte-identical. The non-regressions, all against the same
  scratch tree: `status` with no `--dir` still answers `ok:true` about
  `.planning`; `status --dir ''` and a bare `--dir` still print exactly
  `{"ok":false,"reason":"bad-args","detail":"--dir needs a path after it: --dir
  <planning dir>"}` with exit 1 and zero bytes on stderr; `cursor set --status
  planned --next x --total 1` (no `--phase`) still returns `cursor set needs
  --phase <N>`; `capture --text hi` (no `--kind`) still returns `capture --kind
  must be one of todo | seed | note (got: none)`; `uat record --phase 1 --item 1
  --result maybe` still returns `reason:"bad-result"`; `detect-commands --root`
  (bare) still returns `bad-args` with `detect-commands --root needs a path
  after it: --root <project root>`. `node --test
  cadence-core/bin/planning.test.mjs` passes.

### Task 3: One flag→sentence map, read by the door and by the trace body

- **Files:** cadence-core/bin/planning.mjs (`TRACE_REFUSALS` and the
  `TRACE_STRING_FLAGS` loop in `cmdTrace`'s `append|close` arm),
  cadence-core/bin/trace.test.mjs
- **Action:** The door now refuses four flags the `trace append|close` body also
  refuses, so without this task `planning.mjs` holds the same sentence twice.
  Fold `TRACE_REFUSALS` into the single flag→sentence map task 2 reads, and have
  the trace loop read its wording from that one map, so `trace append --role`
  (bare) answers with the same sentence whichever side refuses it first. DO NOT
  delete `TRACE_GRAMMAR` or the `TRACE_STRING_FLAGS` loop, and this is the trap
  the task exists to state: `TRACE_GRAMMAR` UNIONS the `trace append` and `trace
  close` rows because one body validates both subcommands, while the door
  evaluates the resolved subcommand's row alone - and the `trace close` row
  deliberately declares no `--sha`, `--base`, `--step` or `--trigger`, since a
  flag row is a prose allowlist that never widens what a subcommand accepts. Cut
  the loop and a bare `--sha` on `trace close` stops being dropped and starts
  being written into the event as the literal `true`, which is the class this
  whole phase closed. Keep the TRIM the four refusing flags get: the shared
  `string` classifier tests `raw.trim() !== ''` but returns the value untrimmed,
  so ` cad-executor ` is accepted by the row and must still be trimmed here
  before it becomes a per-role join key.
- **Verify:** `grep -c "needs a role name after it" cadence-core/bin/planning.mjs`
  returns 1. Against a scratch tree: `trace append --phase 1 --family lifecycle
  --event dispatch --role --tokens 5` returns `ok:false` `bad-args` with the
  same detail it returns on the shipped tree and appends nothing; `trace close
  --phase 1 --step` (bare, a flag the close row does not declare) still returns
  `ok:false` `bad-args` naming `--step`; `trace close --phase 1 --sha` (bare)
  and `trace close --phase 1 --plan` (bare) each still return
  `{"ok":true,"written":true}` and the written JSONL line still omits that key;
  `trace render --phase 1` reports no `""` key under `roles`. `node --test
  cadence-core/bin/trace.test.mjs` and `node --test
  cadence-core/bin/planning.test.mjs` pass.

### Task 4: The adoption census - every declared refusal, matched against the shipped CLI

- **Files:** cadence-core/bin/arg-contract-adoption.test.mjs
- **Action:** Add the mechanical guard the gap needs, because a fix that
  migrates 96 rows by hand and leaves nothing to catch the 97th is the same
  defect one commit later. The census walks the WHOLE `CONTRACTS` table and, for
  every entry, spawns the owning script and asserts the shipped CLI answers what
  the row declares. Two arms, both refusals, because those are the ones that can
  be exercised without running the command: for every entry whose `bare` is
  `refuse`, the script invoked with that subcommand's words and the flag as the
  LAST token exits 1 with one JSON line whose `ok` is false and whose text names
  the flag; for every entry whose `value` is `refuse`, the same invocation with
  a malformed value after the flag answers the same way, the malformed sample
  chosen per declared type (a whitespace-only string, a non-numeric `int` or
  `cursor`, an out-of-grammar `phase`). Skip `boolean`-typed entries on both
  arms - presence is their whole grammar, so neither axis can fire. Do NOT add a
  live `fallback` or `warn` arm: proving those means the command RUNS, and
  `git-publish publish` and `milestone-prune` are mutations; those two
  dispositions are already pinned in-process in `arg-contract.test.mjs` and
  live at a named flag by UAT item 4. Three authoring rules make the walk total
  rather than sampled. A `'*'`-row entry is exercised through one of that
  script's own subcommands, or through its bare form where it declares a `''`
  row. A script declaring `--dir` gets one pointing at a scratch directory, so
  no invocation can touch this repository's own `.planning` - except when the
  flag under test IS `--dir`, which must appear bare and alone or the earlier
  occurrence answers for it. And the walk asserts the count of entries it
  actually exercised, so an entry silently skipped reddens rather than passing
  vacuously. Measured while planning: the census is currently GREEN for all 15
  non-`planning.mjs` scripts on both arms and RED for `planning.mjs`, which is
  exactly the shape of UAT item 8 - so it is a falsifier for this task, not a
  restatement of it. A full spawn of `planning.mjs` costs ~24 ms here, so the
  whole census is a few seconds.
- **Verify:** `node --test cadence-core/bin/arg-contract-adoption.test.mjs`
  passes and reports having exercised every entry of the table that declares
  `refuse` on either axis, naming the count it skipped and why.
  Reverting task 2's door (or emptying the `--name` row's `bare` disposition to
  `fallback`) makes it fail naming `planning.mjs cursor set --name`, restored
  afterwards. `node cadence-core/bin/test.mjs` reports 0 failures and includes
  the new file in the `other` group, which the default run and CI both execute.

### Task 5: `config.mjs get` declares `--global` and reads it off that row

- **Files:** cadence-core/bin/lib/arg-contract.mjs (`CONTRACTS['config.mjs']`),
  cadence-core/bin/arg-contract.test.mjs, cadence-core/bin/config.mjs
  (`optFile`), cadence-core/bin/config.test.mjs
- **Action:** UAT item 9: `config.mjs get stakes --global` returns `ok:true`
  while `CONTRACTS['config.mjs'].get` declares only `--file`, and the `validate`
  and `set` rows each declare `--global`. Self-verify is green only because no
  workflow prose spells that pair, so check 2 never reaches it - correct prose
  spelling it would be reported `unknown-flag`. Declare `--global` on the `get`
  row with the same grammar its two siblings carry, and read it in `optFile`
  through `evaluateFlag` against `CONTRACTS['config.mjs'][cmd]` instead of the
  hand-written `tokens.indexOf('--global')` probe. Reading it off the row is
  what makes the class unrepeatable at this seam: a subcommand accepting a
  `--global` it does not declare stops being possible, because the read needs
  the row. Two mechanics stay exactly as they are: `--global` is tested FIRST
  and short-circuits to `GLOBAL_CONFIG` before `--file` is looked at, and the
  returned `tokens` still has the consumed flag filtered out before `set` and
  `get` read the key list from it. `arg-contract.test.mjs` pins the table at 144
  entries with the message "the table declares N flag entries"; that pin moves
  to 145 in this task, and nothing else about it changes.
- **Verify:** `node cadence-core/bin/config.mjs get stakes --global` returns the
  same `{"ok":true,"values":{"stakes":...},"source":"global"}` it returns today;
  `node cadence-core/bin/config.mjs get stakes` and `... validate --global` and
  `... set --global` each answer exactly as they do today; deleting the
  `--global` entry from the `get` row makes `config.mjs get stakes --global`
  stop answering `source: "global"`, restored afterwards. `node --test
  cadence-core/bin/config.test.mjs`, `node --test
  cadence-core/bin/config-seams.test.mjs` and `node --test
  cadence-core/bin/arg-contract.test.mjs` pass; `node
  cadence-core/bin/self-verify.mjs` returns `{"ok":true,...,"problems":[]}`.

### Task 6: The header and the prose state the reach that shipped

- **Files:** cadence-core/bin/lib/arg-contract.mjs (the module header, lines
  1-12 and the ONE HARD BOUNDARY paragraph),
  cadence-core/references/conventions.md (`## Seam arguments`),
  cadence-core/bin/weight-budgets.json
- **Action:** Both surfaces currently claim the rules are declared once and
  enforced, and UAT item 8 was raised against exactly that claim. Make it true
  where it now is and narrow it where it is not, in the same commit as the
  budget row. Say three things and no more. The declaration is what refuses: an
  adopting bin runs the declared row at its door rather than restating the rule,
  and the census walks the table against the shipped CLI so a row nothing reads
  reddens. PRESENCE is the stated exception: a flag genuinely ABSENT is answered
  by the bin that owns the wording, not by the shared door, because the
  diagnostics for a missing enum-valued flag are not expressible in a
  declaration - `review-provider.mjs` has held that position in code since plan
  2 and this is where it is written down. And the boundary that already exists
  stays stated: the contract governs VALUE grammar only and never refuses an
  undeclared flag at runtime, flag membership being self-verify check 2's
  prose-side job. Follow `conventions.md`'s existing form - short bulleted
  rules, the rule first and its reason second, no fenced code blocks, the module
  cited by path - and any command spelling in the new prose must be one the
  table already allows, or check 2 reports `unknown-flag` against this very
  file. Watch the second prose lint plan 4 was caught by: `trace.test.mjs`'s
  producer census reads any line naming both `planning.mjs` and `trace append`
  as a real invocation. Re-pin
  `cadence-core/references/conventions.md` in `cadence-core/bin/weight-budgets.json`
  to the file's new exact byte size in the SAME commit - the row is 14556
  against a measured 14556 B, exactly 0 B of headroom (D-16).
- **Verify:** `wc -c < cadence-core/references/conventions.md` equals the
  `"cadence-core/references/conventions.md"` value in
  `cadence-core/bin/weight-budgets.json`; `node cadence-core/bin/self-verify.mjs`
  returns `{"ok":true,...,"problems":[]}` with no `budget-overrun` and no
  `unknown-flag` naming that file; `node cadence-core/bin/test.mjs` reports 0
  failures; `npx --no-install tsc -p tsconfig.ci.json` reports zero errors.

## Notes

PLAN SHAPE DEVIATION, recorded rather than taken silently. The phase CONTEXT
directs "multiple plans, same phase" and this closure is ONE plan. No
independent slice exists: tasks 1, 5 and 6 all write
`cadence-core/bin/lib/arg-contract.mjs`, tasks 2 and 3 both write
`cadence-core/bin/planning.mjs`, and the two that share no file with the others
(task 4's census, task 6's prose) are both ordered BEHIND task 2 - the census is
a falsifier for the door and the prose must describe the reach that shipped,
which is the `#67` failure this repository has already paid for once. Splitting
would produce sequential plans that cannot use the parallel path the shape
directive exists to feed. Six tasks is inside the ceiling of eight.

Scope calls, for the human rather than for a task:

- The door is a VALUE door, following `review-provider.mjs`'s shipped carve-out,
  so the `required` field stays read by the bins that choose to read it
  (`route.mjs`'s `--role`, `review-provider.mjs`'s handlers) and not by
  `planning.mjs`. Enforcing presence at the door was measured during planning
  and rejected: it would replace ten specific diagnostics with a generic
  sentence and move `uat record`'s absent-`--result` answer from `bad-result` to
  `bad-args`, neither of which either UAT item asks for. Task 6 is where that
  narrowing is written down instead of being left implied.
- The remaining `fail('bad-args', ...)` sites in `planning.mjs` after this plan
  are DOMAIN refusals - enum membership, cross-flag rules, the phase-spelling
  round trip, the `--fields-file` key check - not restatements of a declared
  rule. Plan 2's Notes drew that same line; what UAT item 8 found is that the
  argument-DOOR half was never migrated past two sites, and that is what this
  plan moves.
- `.planning/phases/4/UAT.md` items 8 and 9 are the evidence behind tasks 2 and
  5; the reproductions in their `evidence` fields are quoted into those tasks'
  Verify rather than restated.
