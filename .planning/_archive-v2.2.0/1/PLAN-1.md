---
phase: 1
plan: 1
requirements:
  - CFG-02
files:
  - cadence-core/bin/lib/config-merge.mjs
  - cadence-core/bin/lib/config-reach.mjs
  - cadence-core/bin/config.mjs
  - cadence-core/bin/route.mjs
  - cadence-core/config.schema.json
  - cadence-core/references/config-reach.md
  - cadence-core/bin/config.test.mjs
  - cadence-core/bin/route.test.mjs
  - cadence-core/bin/self-verify.test.mjs
  - DESIGN.md
---

# Phase 1: The read face under everything - Plan

## Goal

The config read face reports exactly what the layers hold: one file resolving as
BOTH layers merges once and is named once, a global-layer `risk.override.*` is
reported the same way by `config.mjs get` and by `route.mjs resolve`, and the
seven config-reach and risk-waiver defects phase 6 deferred are closed.

## Must be true when done

- `config.mjs get` against a repo config and a `CADENCE_GLOBAL_CONFIG` that
  resolves to the SAME file (identical path, a symlink, or a
  relative-vs-absolute spelling) reports ONE layer in `source`, not
  `global+repo`; when that shared file is broken JSON the run names it in
  exactly ONE warning instead of two.
- A `risk.override.<surface>` held only by the global layer is audible on both
  read faces: `config.mjs get` still returns the merged value and now carries a
  warning naming that key as repo-scoped, while `route.mjs resolve` still
  ignores it and warns.
- With `CADENCE_GLOBAL_CONFIG` pointed at the repo config, the waiver is
  HONOURED and `route.mjs resolve` emits no `IGNORED ... waives nothing here`
  warning.
- `route.mjs`'s global-layer waiver warning never hands out remediation the
  write face rejects: a misspelled surface or a non-boolean value in the global
  layer gets the same diagnostic the repo layer gets, naming the global layer.
- `node cadence-core/bin/config.mjs set stakes=solo --file` (the flag's value
  missing) answers with a named diagnostic, never `{"ok":false,"reason":"internal"}`.
- `self-verify`'s reach check reports a duplicate reach row and accepts a
  `Universal` / `universal.` reach cell as the universal sentinel; the eight
  `risk.override.*` rows and their eight schema `purpose` strings carry the
  narrowed reach phrase verbatim, and `self-verify` stays `ok:true`.
- `node --test cadence-core/bin/*.test.mjs` and `npx tsc -p tsconfig.ci.json`
  exit 0 with no budget overrun on any surface this phase edits.

## Context

Locked decisions that bind this plan: D-01 (`get` keeps returning the MERGED
value and adds a warning - the divergence closes by becoming audible), D-02
(a shared file collapses to the REPO layer, never global), D-05 (the collapse
changes `source`, `layers` and `warnings` ONLY - never a merged value; a
"merged twice" value test would pass against HEAD and fail AC1's own
fails-against-HEAD clause), D-07 (`GLOBAL_CONFIG` is a module-load `const`, so
every layer-varying test runs the seam as a SUBPROCESS with
`CADENCE_GLOBAL_CONFIG` set - never in-process, which would read the dev's real
`~/.claude/cadence/config.json`), D-10 (the reach phrase goes VERBATIM into all
eight purposes), D-11 (`references/config-reach.md` carries no byte budget;
`cadence-core/workflows/config.md` is at 18168/18168 with zero headroom), D-12
(the stale "Four phrases" prose is corrected here), D-13 (`src: "repo"` is NOT
a generic narrowing rule - 41 of 73 keys carry it including `stakes`, whose
global-layer inheritance `route.test.mjs:922-931` pins).

Out of scope: the write face v2.0.0 fixed (unchanged, pinned by its existing
tests); phase 6's `e09a0e5` narrowing of `route.mjs` to `layers.repo`
(preserved, not undone - it is what created these items); `deepMerge`'s value
semantics; `CAPTURE.md:167` (the `https?://`-only self-verify URL mask); the
cross-seam proof (PLAN-2).

## Tasks

### Task 1: Collapse two layer paths that resolve to one file, in `mergeLayers`

- **Files:** cadence-core/bin/lib/config-merge.mjs, cadence-core/bin/config.test.mjs
- **Action:** Add a module-private `layerIdentity(p)` to config-merge.mjs
  mirroring `config.mjs`'s `fsIdentity` (`realpathSync(p)`, else
  `join(realpathSync(dirname(p)), basename(p))`, else `resolve(p)`) but TOTAL
  and never-matching for a non-string or EMPTY path: return `null` there and
  treat `null` as equal to nothing, because `GLOBAL_CONFIG` is deliberately `''`
  when `homedir()` throws and `''` must never match a real target (the same
  guard `config.mjs:225-226` states). In `mergeLayers(repoFile)`, compute both
  identities BEFORE either `readLayer` call; when both are non-null and equal,
  read the file ONCE via `readLayer(repoFile)` and treat the result as the REPO
  layer alone - `layers.repo` gets the parsed object, `layers.global` stays
  `null`, `source` resolves to `repo` (or `defaults` when the shared file is
  absent, unparseable, or not a JSON object), and the parse / not-an-object
  warning names the file exactly once. Collapse toward REPO, never global (D-02):
  resolving toward global would silently REVOKE a waiver that works today for
  anyone pointing `CADENCE_GLOBAL_CONFIG` at their repo config, a behaviour
  change nothing authorizes. Do not touch `deepMerge`, `readLayer`, or
  `isPlainObject`, and change no merged VALUE (D-05: `deepMerge(x, x)` is already
  a no-op for objects, arrays and scalars). Keep the `[...new Set(warnings)]`
  dedupe - two genuinely different broken layers still get one entry each.
  Replace the now-false block comment at `config-merge.mjs:123-132` (which says
  closing both arms "needs a realpath/inode identity check on the two layer
  paths before they are read, not a string compare here") with what the function
  now does, and extend the `mergeLayers` doc comment's `layers` paragraph to
  state the collapse and its direction. Then add config.test.mjs rows, run as
  subprocesses through the existing `run(args, globalPath)` helper (D-07): (a)
  `get --file R` with `CADENCE_GLOBAL_CONFIG` set to a SYMLINK to `R` reports
  `source: 'repo'` and no `global+repo`; (b) the same with a
  relative-vs-absolute spelling of `R`; (c) the shared file holding broken JSON
  yields exactly ONE `warnings` entry naming it; (d) the two-DIFFERENT-files case
  still reports `global+repo` (the existing row at config.test.mjs:290 must keep
  passing unedited); and (e) D-06's case - `get --global <key>` makes one file
  BOTH layers by construction (`config.mjs:289` feeding `:265`), so assert the
  LITERAL `source` string it now reports.

  **D-02 AMENDMENT (from the plan review).** D-02 constrains `layers`, never
  `source`. Collapsing to `layers.repo` while ALSO labelling `source: 'repo'`
  ships the inverse of `CAPTURE.md:46`(b) - it names a repo layer the user does
  not have - and it leaves task 3's warning unreachable on the `--global` path,
  so AC2's divergence survives exactly where it is easiest to hit. Therefore:
  `layers` collapses to the repo slot per D-02 (that is what preserves the
  honoured waiver), but `source` names the file that ACTUALLY supplied the
  values - `'global'` when the collapsed file is `GLOBAL_CONFIG` (the `--global`
  path and the aliased-env path), `'repo'` otherwise. Task 3's
  `globalScopeWarnings` must key off that same identity rather than off
  `layers.global` being non-null, so a `--global` read of a file holding
  `risk.override.auth: true` still emits its repo-scoped warning.
  `symlinkSync` is already imported by config.test.mjs.
- **Verify:** Write the five test rows FIRST and run
  `node --test cadence-core/bin/config.test.mjs` before editing
  config-merge.mjs: rows (a)-(c) and (e) must FAIL, and that recorded output is
  AC1's fails-against-HEAD evidence. Do NOT use `git stash` to stage the failing proof
  (`.planning/CAPTURE.md`, phase 4: the stash is shared state and the same proof
  is forbidden under worktree mode) - the test-first ordering needs no stash.
  After the fix, the same command passes all five, and
  `node cadence-core/bin/config.mjs get --file /nonexistent/c.json stakes`
  still prints `"source":"defaults"`.

### Task 2: Prove the collapse on the router's read face

- **Files:** cadence-core/bin/route.test.mjs
- **Action:** Add route.test.mjs rows for AC3, using the existing
  `resolve(role, file, extra, {global})` subprocess helper. The row that matters:
  a repo config carrying `stakes: 'solo'` and `risk.override.auth: true` in a
  phase whose declared files match the `auth` surface, with `opts.global` set to
  THAT SAME repo config path - assert `r.stakes === 'solo'` (the waiver is
  honoured through `layers.repo`), assert `r.warnings` carries no
  `IGNORED`/`waives nothing here` entry, and assert the `config:` reason entry
  names a single layer rather than `global+repo`. Add a second row using a
  SYMLINK to the repo config as `opts.global` so the identity check is proven
  through an alias, not just an exact string. Expect NO change to route.mjs for
  this task: with `layers.global` collapsed to `null`, `riskOverridesIn(null)`
  returns `{}` and the `globalWaivers` map produces nothing - if route.mjs turns
  out to need an edit, make it here and say so rather than widening task 4.
  Resolve the third flagged assumption while here: run the existing
  `route.test.mjs:902` row ("both layers naming it: the repo value waives, the
  global one is still named") unedited - it uses two DIFFERENT files
  (`g-waive-auth2.json` vs the repo config) so no collapse applies and it must
  still pass; if it does move, record that in the phase SUMMARY rather than
  deleting it.
- **Verify:** `node --test cadence-core/bin/route.test.mjs` passes, including the
  unedited rows at 881, 894, 902 and 912. Run the two new rows before task 1's
  fix is present: pre-fix they fail on the `IGNORED` warning and on the
  `config:global+repo` reason ONLY. `stakes` stays `solo` both before and after,
  because D-02's own rationale is that such a waiver is ALREADY honoured through
  `layers.repo` - do not expect `stakes: 'critical'` pre-fix and do not reshape
  the fixture when it does not appear. Asserting the stakes half would make this
  row pass at HEAD for the wrong reason and destroy AC3's evidence.

### Task 3: `config.mjs get` names a global-layer risk waiver as repo-scoped

- **Files:** cadence-core/bin/config.mjs, cadence-core/bin/config.test.mjs
- **Action:** In `get(file, keys)`, also destructure `layers` from
  `mergeLayers(file)`. Add a module-level helper (name it
  `globalScopeWarnings(layers)`) that RETURNS `[]` IMMEDIATELY when
  `layers.global` is null - `flatten` opens with `Object.entries(obj)`
  (`config.mjs:85`) and throws on null, and `layers.global` is null whenever the
  user-global file is absent, unparseable, non-object, or collapsed by task 1,
  which is nearly every real invocation. Without that guard
  `node cadence-core/bin/config.mjs get stakes` returns
  `{"ok":false,"reason":"internal"}` on any machine with no
  `~/.claude/cadence/config.json`. Then flatten `layers.global` with the existing
  `flatten` helper, keep only dotted keys starting with the already-imported
  `OVERRIDE_PREFIX` whose value is TRUTHY, and returns one warning string per
  key. Match `route.mjs`'s truthy filter exactly: a global `risk.override.auth:
  false` is the ordinary not-waived case and warning on it would put a line on
  every `get` in every repository. Each warning must name the full key, state
  that it is repo-scoped (`src: repo`), state that the value reported in
  `values` is the MERGED value while `route.mjs` honours the repo layer alone,
  and point at this repo's own `.planning/config.json` - it must NOT suggest
  `config.mjs set --global`, which the write face refuses. Push the strings into
  `allWarnings` beside `retiredKeysIn(config)`; `values`, `source` and the
  envelope shape are untouched (D-01: `get` keeps returning the merged value, and
  the warning channel already exists at `config.mjs:269`, so no caller changes).
  Do NOT drive this off the schema's `src: "repo"` field generically (D-13): 41
  of 73 keys carry `src: repo`, including `stakes`, whose global-layer
  inheritance is pinned by `route.test.mjs:922-931`, so a generic rule would warn
  on ordinary inheritance and fail that test. Scope it to `OVERRIDE_PREFIX`
  alone. Add config.test.mjs rows: a global-only `risk.override.auth: true` makes
  `get` return `values['risk.override.auth'] === true` AND a `warnings` entry
  matching `/risk\.override\.auth/` and `/src: repo/`; a global-only
  `risk.override.auth: false` produces NO warning; a repo-layer
  `risk.override.auth: true` with no global layer produces no warning.
- **Verify:** `node --test cadence-core/bin/config.test.mjs` passes, and a manual
  run with `CADENCE_GLOBAL_CONFIG` pointed at a file holding
  `{"risk":{"override":{"auth":true}}}` prints both `"risk.override.auth":true`
  and a `warnings` entry naming the key (closes `.planning/CAPTURE.md:164`).

### Task 4: `route.mjs`'s global-waiver warning stops handing out a rejected remediation

- **Files:** cadence-core/bin/route.mjs, cadence-core/bin/route.test.mjs
- **Action:** Close `.planning/CAPTURE.md:166` - today a global-layer
  `risk.override.athu: true` earns "set it in this repo's own
  `.planning/config.json` to waive the athu floor" while `config.mjs set` refuses
  the key outright, and a non-boolean global value earns the same instruction
  though the repo layer would refuse to honour it too. Extract the two
  diagnostic arms `riskFloor` already applies to REPO-layer entries
  (`route.mjs:190-215`: "names no declared risk surface (...)" and "is not true
  or false; the <surface> risk floor stands") plus the `declaredSurfaces`
  computation off `TABLE.surfaces` into module-level helpers, and call them from
  BOTH `riskFloor`'s loop and `readConfig`'s `globalWaivers` map. `TABLE` is
  assigned in the dispatch block at `route.mjs:446` before `resolve()` calls
  `readConfig`, so it is populated - keep the existing defensive shape
  (`TABLE.surfaces` non-object yields an empty list). After the change a global
  entry earns the "move it to this repo's config" remediation ONLY when its
  surface is declared AND its value is strictly `true`; an undeclared surface
  gets the names-no-declared-surface diagnostic and a non-boolean value gets the
  not-true-or-false diagnostic, each NAMING the user-global layer so it is
  distinguishable from the identical repo-layer warning rather than deduping into
  it. A global `false` still warns about nothing. Add route.test.mjs rows:
  global-only `risk.override.athu: true` warns with the accepted-surface list and
  no `.planning/config.json` remediation; global-only `risk.override.auth: "yes"`
  warns that it is not true or false; global-only `risk.override.auth: true`
  still produces the existing repo-scoped remediation warning (the unedited row
  at 881 covers this).
- **Verify:** `node --test cadence-core/bin/route.test.mjs` passes. Cross-check
  the two faces by hand on MEMBERSHIP only: the surface name in the new warning
  must be one `node cadence-core/bin/config.mjs check risk.override.athu=true`
  also rejects, and the two accepted-surface lists must hold the SAME SET.
  Do NOT require the strings to match: `check` sorts schema keys
  (`lib/risk-surfaces.mjs:120` → `api_contract, auth, billing, concurrency,
  destructive, migrations, secrets, untrusted_input`) while `route.mjs` uses
  `Object.keys(TABLE.surfaces)` in route-table declaration order (`route.mjs:204`
  → `auth, migrations, billing, ...`). Both were measured live. Requiring string
  equality would push the executor into either recording a false failure or
  sorting `declaredSurfaces` / repointing route.mjs at the schema - an
  unauthorized change to shipped warning text that this task's Action forbids.

### Task 5: A missing `--file` value is diagnosed, never `reason:"internal"`

- **Files:** cadence-core/bin/config.mjs, cadence-core/bin/config.test.mjs
- **Action:** Close `.planning/CAPTURE.md:168`. Two changes in config.mjs. First,
  make `fsIdentity(p)` total: return a never-matching sentinel (`null`) for a
  non-string or empty `p` before the `realpathSync` attempts, so the last
  fallback `resolvePath(p)` can no longer raise a TypeError outside the try and
  escape `repoScopedErrors`; update `repoScopedErrors`' identity comparison so a
  `null` identity never equals another (an unresolvable path must not
  accidentally target the global layer). Second, make `optFile(tokens)` refuse a
  `--file` whose value is absent - when `tokens.indexOf('--file')` is the last
  index, `fail('usage', ...)` naming the flag and what it needs, so
  `set stakes=solo --file` answers with a named diagnostic instead of falling
  through with `file === undefined`. Both changes are one concern: the seam
  diagnoses the missing value rather than crashing on it. Do not change the
  `--global` arm or the default `.planning/config.json` arm. Add config.test.mjs
  rows for `set stakes=solo --file`, `get --file` and `validate --file`, each
  asserting `ok === false`, `reason === 'usage'` (not `internal`), and a `detail`
  naming `--file`.
- **Verify:** `node cadence-core/bin/config.mjs set stakes=solo --file` prints a
  JSON line whose `reason` is `usage` and whose `detail` names `--file`, and
  carries no Node type error text; `node --test cadence-core/bin/config.test.mjs`
  passes.

### Task 6: The reach parser reports a duplicate row and reads the universal sentinel

- **Files:** cadence-core/bin/lib/config-reach.mjs, cadence-core/bin/self-verify.test.mjs, cadence-core/references/config-reach.md
- **Action:** Close `.planning/CAPTURE.md:170` and `:171`. In `parseReachTable`,
  replace the silent `if (seen.has(cells[0])) continue;` at
  `config-reach.mjs:95` with a pushed issue `{code: 'duplicate-reach-row', detail}`
  whose detail names the key, this row's 1-based line, and the line the first
  occurrence declared it on - then still `continue`, so first-occurrence-wins is
  unchanged and only the silence goes. Track the first line per key in the `seen`
  structure (a `Map` rather than a `Set`). In `reachIssues`, test the universal
  sentinel case-insensitively and tolerant of one trailing period: compare
  `normalize(row.reach)` lowercased with a single trailing `.` stripped against
  `UNIVERSAL` for the short-circuit, so `Universal` and `universal.` stop falling
  through to the purpose test and emitting `unstated-reach`. Leave the narrow-
  phrase purpose test itself case-SENSITIVE and unfolded - the doc's stated rule
  is that the phrase is compared literally, and folding one side only would break
  the verbatim contract. Add no "reach is outside the declared vocabulary" code:
  AC5 asks for the two behaviours above and nothing further. Update
  `references/config-reach.md`: add a `duplicate-reach-row` row to the "forms this
  grammar does not read" table (`:68-74`), DELETE the now-false paragraph at
  `:76-77` ("A duplicate row for a key already declared is ignored rather than
  reported"), and state in the Row grammar section that the literal `universal`
  is read case-insensitively with an optional trailing period while a narrower
  phrase is compared verbatim. Add self-verify.test.mjs rows for both: a table
  with two rows for one key reports `duplicate-reach-row` naming both lines, and
  a row whose Reach cell is `Universal` or `universal.` reports nothing.
- **Verify:** `node --test cadence-core/bin/self-verify.test.mjs` passes, and
  `node cadence-core/bin/self-verify.mjs` still prints `"ok":true` (the shipped
  table has no duplicate row, so the new code must fire on the fixture only).

### Task 7: The eight `risk.override.*` rows adopt the narrowed reach phrase

- **Files:** cadence-core/references/config-reach.md, cadence-core/config.schema.json, cadence-core/bin/self-verify.test.mjs
- **Action:** Close `.planning/CAPTURE.md:165`. The reach phrase is
  `repo config layer only` (planner's choice, D-10 left the wording open). Change
  the Reach cell of all eight `risk.override.*` rows in
  `references/config-reach.md:92-99` from `universal` to that phrase, leaving the
  `Honoured by` cells as they are. Append the phrase VERBATIM to all eight
  `purpose` strings in `config.schema.json` - e.g. after each purpose's existing
  final clause, a sentence reading "Honoured from the repo config layer only: a
  waiver written to the user-global layer is ignored and named in the resolver's
  warnings." The eight rows now fail the `reach === UNIVERSAL` short-circuit and
  reach the purpose test, which is exactly what makes check 9 able to see this
  narrowing at all; the comparison runs through `normalize`, so the phrase may
  wrap across lines in the JSON but must be byte-identical once whitespace is
  collapsed and backticks stripped. Correct D-12's stale prose at
  `references/config-reach.md:47-51` in the same edit: "Four phrases are in use
  today" is already false against the fifth at `:125`
  (`cross-model provider calls only`) and this task adds a sixth - restate the
  count and enumerate all six verbatim. Add a self-verify.test.mjs row proving the
  new coupling has teeth: a fixture whose `risk.override.auth` row carries the
  phrase while the key's `purpose` does not reports `unstated-reach` naming that
  key.
- **Verify:** `node cadence-core/bin/self-verify.mjs` prints `"ok":true` with an
  empty `problems` array, and BOTH of these read exactly `8`:
  `node cadence-core/bin/config.mjs keys | grep -o 'repo config layer only' | wc -l`
  and
  `grep -c 'repo config layer only' cadence-core/references/config-reach.md`.
  A `grep -c` on `keys` cannot serve here - it prints ONE JSON line, so it
  returns 1 whether one purpose carries the phrase or eight. self-verify does not
  cover the gap either: check 9 fires only when a row and its purpose DISAGREE,
  so six narrowed rows with six narrowed purposes is green and silent while two
  rows still read `universal`. `node --test cadence-core/bin/self-verify.test.mjs`
  passes.

### Task 8: Amend DESIGN's "the read face is deliberately unchanged" marker

- **Files:** DESIGN.md
- **Action:** D-01 requires this marker AMENDED rather than left contradicted.
  Rewrite the closing sentences of the `REPO SCOPE CLOSED (2026-07-29, CFG-01)`
  block at `DESIGN.md:443-456` - currently "The read face is deliberately
  unchanged: `config.mjs get` still reports a global-layer waiver as an effective
  value, because `get` returns the merged config by contract" - to state what this
  phase changed and what it deliberately kept: `get` still returns the MERGED
  value by contract (the alternative, a per-key differently-scoped answer, was
  rejected), and it now NAMES a truthy global-layer `risk.override.*` in
  `warnings` so both read faces report the same situation; and `mergeLayers` now
  collapses two layer paths that resolve to one file to the REPO layer, so a
  shared file no longer reports a repo layer plus a global layer the user does not
  have. Keep the block's existing history intact - amend the marker, do not
  rewrite what v2.0.0 shipped. DESIGN.md is not on `self-verify`'s md walk
  (`mdFiles` covers `cadence-core/workflows`, `references`, `templates`, `skills`
  and `agents` only) and carries no byte budget, so this edit costs no
  regeneration.
- **Verify:** `grep -n "read face is deliberately unchanged" DESIGN.md` returns
  nothing, and `grep -n "repo config layer only\|collapses" DESIGN.md` shows the
  amended text naming both changes.

### Task 9: Close the phase gate and the seven-item roster

- **Files:** cadence-core/bin/config.test.mjs, cadence-core/bin/route.test.mjs, cadence-core/bin/self-verify.test.mjs
- **Action:** Run the full gate AC8 names and fix whatever it surfaces in the test
  files this plan already owns; a failure that can only be fixed in a source file
  belongs back in the task that owns it, not here. Budgets (D-11): no task in this
  plan edits a budgeted surface - `cadence-core/references/config-reach.md` has no
  entry in `cadence-core/bin/weight-budgets.json` and `DESIGN.md` is not a
  weighted surface - so no regeneration is due. Do NOT edit
  `cadence-core/workflows/config.md`: it sits at exactly 18168/18168 bytes with
  zero headroom, and any prose edit there requires regenerating
  `weight-budgets.json` in the same commit or AC8 fails. If `/cad-docs-verify`
  later flags `workflows/config.md` as stale against task 3's new warning class
  (`:108` says a global-layer waiver is "ignored and named in the resolve's
  `warnings`" - true but now incomplete, and `:141-148` documents `get` as the
  only correct read), the escape hatch is a BYTE-NEUTRAL rewrite of those lines,
  or the prose edit plus a regenerated `weight-budgets.json` in the same commit -
  never a silent byte addition. Absent that, record the deliberate omission in
  the SUMMARY rather than leaving the docs gate with no stated route.

  Record for the phase SUMMARY, which AC6 requires to name each of the seven
  roster items (D-03) INDIVIDUALLY with the test that pins it - item → TASK is
  not what AC6 asks for, so carry item → TEST FILE + exact test title:

  | CAPTURE item | Task | Test file | Test title |
  |---|---|---|---|
  | `:164` (half a: the two read faces disagree) | 3 | config.test.mjs | (title written by task 3) |
  | `:164` (half b: `validate --global` blesses what `set --global` refuses) | — | — | NOT CLOSED - see below |
  | `:165` | 7 | self-verify.test.mjs | (title written by task 7) |
  | `:166` | 4 | route.test.mjs | (title written by task 4) |
  | `:168` | 5 | config.test.mjs | (title written by task 5) |
  | `:169` | 2 | route.test.mjs | (title written by task 2) |
  | `:170` | 6 | self-verify.test.mjs | (title written by task 6) |
  | `:171` | 6 | self-verify.test.mjs | (title written by task 6) |

  Plus the shared root at `:46` (task 1). `:167` is deferred by CONTEXT and must
  not be claimed.

  `CAPTURE.md:164` has TWO live halves and this plan closes only one. Half (a),
  the `get`/`route` disagreement, closes in task 3. Half (b) - `validate
  --global` returning `{"ok":true,"checked":1,"errors":[]}` on a file holding
  `risk.override.auth: true` while `set --global` refuses the same write as
  repo-scoped, both measured live at HEAD - is touched by no task here. The
  SUMMARY must say so plainly and leave `:164` recorded as PARTIALLY closed;
  claiming it closed outright makes AC6's "the test that pins it" true only in
  appearance. Append the open half to `.planning/CAPTURE.md` as a phase-1 todo.

  The `--global` `source` label is NO LONGER a residual: the D-02 amendment in
  task 1 makes `source` name the file that actually supplied the values, so
  `get --global` reports `'global'` and task 3's warning stays reachable there.
  Record the amendment in the SUMMARY as a decision changed by the plan review,
  not as a silent divergence from CONTEXT's D-02.
- **Verify:** All three exit 0 / report clean:
  `node --test cadence-core/bin/*.test.mjs` (1138 tests passed at the phase
  baseline, so the count must only grow), `npx tsc -p tsconfig.ci.json`, and
  `node cadence-core/bin/self-verify.mjs` printing `"ok":true` with
  `"problems":[]`. Then prove the roster is real rather than asserted: for each
  of the seven rows above, `grep -c "<exact test title>" cadence-core/bin/<test
  file>` returns at least 1. A row whose title greps to 0 means that item has no
  pinning test and AC6 is not met.

## Notes

- Plan shape deviation: CONTEXT proposes three plans (root fix AC1-AC3 /
  config-reach AC4-AC6 / cross-seam AC7). Slices 1 and 2 both write
  `cadence-core/bin/config.mjs` (D-01's `get` warning in AC2, `fsIdentity`'s
  totality in AC4) and both write `cadence-core/bin/config.test.mjs`, so the
  file-independence test makes them ONE plan. AC7 shares no file with either and
  is PLAN-2. Two plans, not three.
- Baseline measured before planning: `node --test cadence-core/bin/*.test.mjs`
  = 1138 pass / 0 fail, `node cadence-core/bin/self-verify.mjs` = `ok:true` with
  no problems, `wc -c cadence-core/workflows/config.md` = 18168 (its budget
  exactly, confirming D-11's zero headroom).
- CONTEXT's second flagged assumption checked out and needs no task:
  `cadence-core/workflows/config.md:43-47` explicitly instructs the `/cad-config`
  menu to preselect off the repo file's own literal value, "never `config.mjs
  get`", so D-01's warning has one consumer (the `get` envelope) and the menu is
  not showing a waiver that waives nothing. That is why no task edits
  `workflows/config.md`, which is the one budgeted surface with zero headroom.
- Failing-capable proofs are staged test-first, never with `git stash`: the
  phase-4 CAPTURE item records that the stash is shared state and the same proof
  would be forbidden under worktree mode.
