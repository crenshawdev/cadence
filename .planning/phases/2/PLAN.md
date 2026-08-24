---
phase: 2
plan: 1
requirements: [SCP-01]
files:
  - cadence-core/config.schema.json
  - cadence-core/bin/lib/config-merge.mjs
  - cadence-core/bin/config.mjs
  - cadence-core/bin/lib/arg-contract.mjs
  - cadence-core/bin/config.test.mjs
  - cadence-core/references/config-catalog.md
  - cadence-core/bin/weight-budgets.json
  - cadence-core/bin/arg-contract.test.mjs
---

# Phase 2: A repo-scoped key refuses at the layer that cannot honour it - Plan

## Goal

Writing a repo-layer-only config key into the user-global layer is refused at
write time, by a rule `config.mjs` reads off a schema marker rather than off a
list of key names.

## Must be true when done

- With `CADENCE_GLOBAL_CONFIG` pointed at a temp file, `node
  cadence-core/bin/config.mjs set git.auto_close=true --global` returns
  `ok:false` with `reason:"invalid"`, a `detail[]` entry naming `git.auto_close`
  and the user-global layer and telling the user to set it with `--file <repo
  config>` instead, and a non-empty `hint`. The same pair aimed at a repo config
  returns `ok:true` and that file holds `true` (AC1).
- The refusal follows the resolved target FILE, not the flag: `set
  git.auto_close=true --file "$CADENCE_GLOBAL_CONFIG"` refuses identically, and
  so does the same path spelled `<global-dir>/./config.json` (AC2).
- `config.mjs check --global git.auto_close=true` returns the same per-pair
  scope error the write face refuses on, and `config.mjs check --global
  stakes=critical` returns `ok:true` (AC3).
- No `"src": "repo"` key is refused: `set stakes=critical --global` returns
  `ok:true` with the value in the file, and `cadence-core/bin/config.test.mjs`'s
  existing `set --global auto-creates the global file (and parent dir) from
  empty` test passes unchanged (AC4).
- A multi-pair global set carrying one marked key writes nothing: `set
  git.auto_close=true stakes=critical --global` against an existing global file
  leaves that file byte-identical (AC6).
- The refused set is derived, not listed: with a substituted schema fixture
  marking a second key, that key refuses at the user-global layer and no line of
  the rule changed (AC5).
- `node cadence-core/bin/self-verify.mjs --root .` returns `ok:true` with
  `problems: []`, and `node cadence-core/bin/test.mjs` reports 0 failures (AC7).

## Context

D-01 is the trap: `"src": "repo"` means "settable in either layer" and its 33
keys include `stakes` and `granularity`, so nothing here may key on it - the
marker is NEW, and `git.auto_close` is the only key that carries it (D-02). The
set is read off the `SCHEMA` object `config.mjs` already loads, never a
hand-maintained module (D-03), which is why `lib/global-only-keys.mjs`'s
opposite choice is not copied and why no new self-verify check is added. The
check lives inside `checkPairs`, which gains the resolved target layer as a
parameter, runs AFTER `checkValue` (D-11), and reports as a per-pair entry in
the existing `reason:"invalid"` detail array with no new reason token (D-09).
The deleted precedent to model is `git show 878956ea` (`repoScopedErrors`,
merged into one refusal list) plus `git show 8063832d`'s realpath fallback.

Out of scope: the read face - a user-global `git.auto_close` still merges and is
still honoured for the `requested` resolution (D-05); the mirror direction,
which stays enforced at the merge (D-06); `validate`'s layer scoping, which has
no layer-aware arm at all; and any new `reason` token.

## Tasks

### Task 1: Mark `git.auto_close` repo-layer-only in the schema

- **Files:** cadence-core/config.schema.json
- **Action:** Add a NEW spec field to the `git.auto_close` entry, spelled
  `"repo_only": true`. That spelling is the planner's choice where D-02 names
  the field's MEANING and not its name, and it is fixed here because tasks 2, 4
  and 5 all read it: a boolean cannot express a `"global"` mirror this phase
  does not implement (D-06 keeps that at the merge), and it can never be misread
  as a second value of `src`. Do NOT touch the `src` field, its value, or its
  legend clause - `src` means "settable in either layer" and 33 keys carry it
  (D-01). Extend `_meta.note` with a clause defining the new field: present and
  `true` means only the repository's own `.planning/config.json` can set the key
  and `bin/config.mjs` refuses a write at the user-global layer at write time,
  because a user-global value authorizes nothing on a repository that never
  opted in; absent means either layer, which is every other key. State that the
  test the marker encodes is that authorization question, so a later maintainer
  can tell whether a new key qualifies. Mark exactly ONE key: D-02 scanned all
  78 `purpose` strings and found no second, and marking a key this phase never
  examined is scope invention. Do NOT delete or reword the phrase `repo config
  layer only for the unattended publish` inside `git.auto_close`'s `purpose` -
  `cadence-core/references/config-reach.md`'s row for that key declares exactly
  that reach and self-verify check 9 (`lib/config-reach.mjs` `reachIssues`)
  reports `unstated-reach` the moment the normalized purpose stops containing
  it. Appending to the purpose is safe; rewriting it is not. `config.schema.json`
  carries no `weight-budgets.json` row, so `_meta.note` is free to grow (D-12).
- **Verify:** `node -e "const k=JSON.parse(require('fs').readFileSync('cadence-core/config.schema.json','utf8')).keys; console.log(JSON.stringify(Object.keys(k).filter((x)=>k[x].repo_only===true)))"`
  prints exactly `["git.auto_close"]`, and the same one-liner filtering on
  `k[x].src==='repo'` still prints 33 keys. `node cadence-core/bin/config.mjs
  keys` returns `ok:true`. `node cadence-core/bin/self-verify.mjs --root .`
  returns `ok:true` with `problems: []`, and `node cadence-core/bin/test.mjs`
  reports 0 failures.

### Task 2: Refuse a marked key at the resolved user-global layer

- **Files:** cadence-core/bin/lib/config-merge.mjs, cadence-core/bin/config.mjs, cadence-core/bin/config.test.mjs
- **Action:** Export `layerIdentity` from `lib/config-merge.mjs` (D-07) with its
  body and `mergeLayers`'s two uses of it unchanged, and import it in
  `config.mjs`. Do not restate the realpath fallback inside `config.mjs`: that
  copy existed as `fsIdentity`, `git show 8063832d` deleted it, and a second
  copy drifts from the merge's answer to the same "one file, both layers"
  question. In `config.mjs`, give `checkPairs` a second parameter carrying the
  resolved target layer (D-08) and add the scope check AFTER the `checkValue`
  call, so a pair that is both out-of-scope and type-invalid reports the type
  (D-11). The check reads the marker off the `SCHEMA` object the dispatch
  already loads from `SCHEMA_PATH`, through `Object.hasOwn` like the three
  lookups already in this file - never a hand-maintained key list (D-03), and
  never anything keyed on `src`. On a match push a per-pair entry onto the SAME
  `errors` array `checkPairs` already returns, so `reason` stays `"invalid"` and
  no new token is minted (D-09); word that entry's `error` string so it names
  the key, says a user-global value cannot authorize a change to the repository
  that has to honour it, and names the next step - set it with `--file <repo
  config>` instead (D-10). In `set`, resolve the target layer as the third
  parameter it already receives from `optFile`'s `global` field, OR the target
  file and `GLOBAL_CONFIG` resolving to the same `layerIdentity` (D-04) - a
  flag-only rule leaves `--file <that same path>` writing straight through, and
  the `<global-dir>/./config.json` spelling is what forced the realpath
  hardening the first time. A `null` identity must never match a `null`:
  `GLOBAL_CONFIG` is deliberately `''` where `homedir()` throws. Keep the
  resolution and the `checkPairs` call ahead of every read and every write in
  `set`, so a multi-pair refusal writes nothing. Add no new `emit`, `out` or
  `fail` site - the refusal rides `set`'s existing `fail('invalid', errors,
  hint)`, which is what keeps self-verify check 22 (`lib/refusal-hints.mjs`)
  needing no register row. Commit regression tests in `config.test.mjs` through
  its existing `run(args, globalPath)` helper covering the `--global` arm, the
  `--file <global path>` arm, the `/./` spelling of that path, a repo-layer
  write of the same pair succeeding, and a two-pair global set leaving an
  existing target file byte-identical.
- **Verify:** With `CADENCE_GLOBAL_CONFIG` pointed at a temp file (never the
  user's real `~/.claude/cadence/config.json`): `config.mjs set
  git.auto_close=true --global` prints `ok:false`, `reason:"invalid"`,
  `detail[0].key` of `git.auto_close`, a `detail[0].error` containing `--file`,
  and a non-empty `hint`; `set git.auto_close=true --file
  "$CADENCE_GLOBAL_CONFIG"` and the same path spelled with a `/./` segment print
  the same `detail[0]`; `set git.auto_close=true --file <a temp repo config>`
  prints `ok:true` and that file then holds `"auto_close": true`; `set
  git.auto_close=true stakes=critical --global` against a pre-written global
  file leaves its `sha256sum` unchanged; `set stakes=critical --global` prints
  `ok:true`. `node cadence-core/bin/test.mjs routing` reports 0 failures.

### Task 3: `check --global` reports what the write face refuses

- **Files:** cadence-core/bin/lib/arg-contract.mjs, cadence-core/bin/config.mjs, cadence-core/bin/config.test.mjs
- **Action:** Declare `--global` on `CONTRACTS['config.mjs'].check` in
  `lib/arg-contract.mjs` with the identical grammar its three siblings carry
  (`required: false`, `type: 'boolean'`, `value: 'fallback'`, `bare:
  'fallback'`), and wire the `check` dispatch arm in `config.mjs` to read it
  through `evaluateFlag` off that declared row, drop the flag token from what it
  hands `checkPairs`, and pass the resulting layer as `checkPairs`'s new second
  argument. Today `check --global` answers `not a key=value pair`, which is why
  the inspect face cannot report what the write face refuses. Do NOT give
  `check` a `--file` row - the CONTEXT scopes this to `--global` alone - and do
  NOT route the `check` arm through `optFile`: `optFile` falls through to
  `CONTRACTS['config.mjs'][cmd]['--file']` whenever a `--file` token is present,
  and for a subcommand with no such row that hands `undefined` to `evaluateFlag`
  and surfaces to the user as `reason:"internal"`. Widen the ARG-06 test in
  `config.test.mjs` - the one iterating `['validate','set','get']` and asserting
  each declares `--global` with the same grammar object - to include `check`,
  and add arms for the accepted and refused pairs. The `check` envelope is
  otherwise untouched: same `reason:"invalid"`, same `detail` array, same
  existing `hint`.
- **Verify:** With `CADENCE_GLOBAL_CONFIG` at a temp file: `config.mjs check
  --global git.auto_close=true` prints `ok:false` with `reason:"invalid"` and a
  `detail[0]` equal to the entry `set git.auto_close=true --global` refuses
  with; `config.mjs check --global stakes=critical` prints `{"ok":true}`;
  `config.mjs check git.auto_close=true` with no flag prints `{"ok":true}`;
  `config.mjs check --global` with no pairs prints `{"ok":true}` rather than a
  `not a key=value pair` error. `node cadence-core/bin/self-verify.mjs --root .`
  reports no `unknown-flag` and no `unknown-subcommand` problem, and `node
  cadence-core/bin/test.mjs routing prose` reports 0 failures.

### Task 4: Prove the refused set comes from the schema marker

- **Files:** cadence-core/bin/config.test.mjs
- **Action:** Commit the AC5 test. Use the existing `runWithSchema(args,
  schemaPath)` helper, which sets both `CADENCE_CONFIG_SCHEMA` and the
  `CADENCE_TEST_SEAM=1` sentinel that override is gated behind - a fixture
  missing the sentinel is silently ignored and the test would pass against the
  shipped schema. Write a fixture schema holding at least two keys, exactly one
  of them carrying `"repo_only": true`, and assert the marked one refuses at the
  user-global layer with the same per-pair `error` shape task 2 produces while
  the unmarked sibling is accepted - so the assertion is about the MARKER and
  not about the name `git.auto_close`, which must appear nowhere in the fixture.
  Add the AC4 negative control in the same file: read the shipped
  `cadence-core/config.schema.json` in-process, assert the set of keys carrying
  the marker is exactly `['git.auto_close']`, and assert no key carrying `"src":
  "repo"` other than that one carries it - an in-process derivation rather than
  33 subprocess runs, because the property is about the schema and each
  subprocess would only re-prove task 2's rule. Leave the existing `set --global
  auto-creates the global file (and parent dir) from empty` test byte-identical;
  it is AC4's shipped half and must pass unchanged.
- **Verify:** `node --test cadence-core/bin/config.test.mjs` reports 0 failures
  and names the new schema-derivation test in its output. Deleting the
  `"repo_only": true` line from the fixture's marked key makes exactly that test
  fail and no other - watch it fail, then restore it. `node
  cadence-core/bin/test.mjs routing` reports 0 failures.

### Task 5: State the marker in the config catalog and re-pin its budget

- **Files:** cadence-core/references/config-catalog.md, cadence-core/bin/weight-budgets.json
- **Action:** D-12. Add ONE clause to the legend paragraph that already defines
  the `[src]` marker as CONFIG-LAYER SCOPE, naming the repo-layer-only marker,
  saying it is a DIFFERENT marker from `[repo]`, and saying what it means at the
  write face: `config.mjs set` refuses that key at the user-global layer.
  Spell the row marker `[repo-layer-only]`, not `[repo-only]`, so it cannot be
  skimmed as `[repo]` in the same column. Put that marker on the
  `git.auto_close` row's Key cell in the same backticked form `[repo]` and
  `[global]` already take on other rows. Change no other row - in particular
  leave every cell of the `workflow.max_plan_tasks` row alone, because
  `prose-agreement.test.mjs` extracts that decision from both this row and the
  schema and asserts the two agree. Do not touch `cadence-core/workflows/config.md`,
  `cadence-core/templates/config.json` or `skills/cad-config/SKILL.md`: all
  three are measured at exactly zero budget headroom and D-01 rejected the
  alternative precisely because it would have cost edits to them. Then re-pin
  `cadence-core/references/config-catalog.md`'s entry in
  `cadence-core/bin/weight-budgets.json` to the file's new byte count IN THIS
  SAME COMMIT: the surface sits at 10452/10452 with zero headroom, and
  self-verify check 4 treats a budget as a ceiling (`bytes > budget`), so growth
  without the re-pin is a `budget-overrun` problem. Re-pinning is the sanctioned
  move here, not a silenced check.
- **Verify:** `wc -c cadence-core/references/config-catalog.md` and the
  `cadence-core/references/config-catalog.md` value in
  `cadence-core/bin/weight-budgets.json` print the same number. `node
  cadence-core/bin/weight.mjs --root .` reports that surface within its pin.
  `node cadence-core/bin/self-verify.mjs --root .` returns `ok:true` with
  `problems: []`, and `node cadence-core/bin/test.mjs` reports 0 failures across
  every group.

## Notes

- **Plan shape honored.** One plan, per the CONTEXT directive. The five source
  files it names all share `config.mjs` as the consumer, so no split is
  available on the independence test anyway.
- **Two files beyond CONTEXT's five.** `cadence-core/bin/config.test.mjs` is
  required by AC5's "a committed test", and `cadence-core/bin/weight-budgets.json`
  by D-12's "re-pinned in the same commit". Both are declared in `files:` so
  `lease-check` admits them.
- **Marker name is the planner's call.** D-02 fixes the field's meaning and not
  its spelling; `"repo_only": true` and the catalog's `[repo-layer-only]` are
  chosen in task 1 and referenced by tasks 2, 4 and 5.
- **ROADMAP SC2 is superseded by CONTEXT D-01.** SC2 says the refusal covers all
  33 `"src": "repo"` keys; D-01 established that marker means "settable in
  either layer" and that refusing on it would reverse shipped behaviour for
  `stakes` and `granularity`. AC5 is the surviving form of SC2's real ask - the
  set is derived from a marker, not from a list - and the plan builds to AC5.
- **Recalled prior art.** `.planning/CAPTURE.md` records this gap twice (the
  v3.5.1 phase-1 deferral naming `checkPairs` as validating "retired / unknown /
  type and nothing about layer scope", and a 2026-08-04 entry from the write-face
  angle); both are closed by task 2. The same capture's note that no
  `repoScoped*` symbol exists under `cadence-core/bin/` today is still true and
  is why task 2 writes one rather than wiring an existing one.
- **Known consequence of D-04, not a defect.** Where `CADENCE_GLOBAL_CONFIG` is
  pointed AT a repo config (the collapse case `mergeLayers` documents), a
  `--file` write of a marked key to that path now refuses, because the two paths
  resolve to one `layerIdentity`. No shipped test hits it - every `set --file`
  arm in `config.test.mjs` uses a global path distinct from its target.
- **Left open by CONTEXT, for the human.** `check --global` ships undocumented in
  `cadence-core/workflows/config.md`: D-12 named only `_meta.note` and
  `references/config-catalog.md` as this phase's prose surfaces, and that
  workflow measures at 15705/15705 with zero headroom. And the flagged
  assumption stands - `validate --global` will keep blessing a file that `set
  --global` refuses, since `validate` reaches `checkValue` by its own path and
  never through `checkPairs`.
