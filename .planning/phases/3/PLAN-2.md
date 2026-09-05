---
phase: 3
plan: 2
requirements:
  - ROL-02
files:
  - cadence-core/config.schema.json
  - cadence-core/route-table.json
  - cadence-core/bin/self-verify.mjs
  - cadence-core/bin/self-verify.test.mjs
  - cadence-core/bin/lib/route-cells.mjs
  - cadence-core/bin/route-cells.test.mjs
  - cadence-core/bin/test.mjs
  - cadence-core/bin/prose-agreement.test.mjs
  - cadence-core/bin/risk-diff.test.mjs
  - cadence-core/bin/rung-agent.test.mjs
  - cadence-core/bin/gate-agreement.test.mjs
  - cadence-core/bin/config.mjs
  - cadence-core/bin/config.test.mjs
  - cadence-core/bin/config-seams.test.mjs
  - cadence-core/bin/lib/arg-contract.mjs
  - cadence-core/bin/lib/retired-keys.mjs
  - cadence-core/bin/retired-keys.test.mjs
  - cadence-core/bin/arg-contract.test.mjs
  - cadence-core/bin/test-groups.test.mjs
  - INTERNALS.md
  - cadence-core/references/config-reach.md
  - cadence-core/bin/route.test.mjs
---

# Phase 3: The stakes key is gone and an interview replaces it - Plan 2 of 3

Sequential plans. This plan runs SECOND, after PLAN-1's last task has
committed: it deletes files PLAN-1 made unread and a schema row PLAN-1 made
inert, and it shares `config.schema.json`, `config.mjs`, `config.test.mjs`,
`config-seams.test.mjs`, `self-verify.mjs`, `self-verify.test.mjs`,
`prose-agreement.test.mjs` and `lib/arg-contract.mjs` with PLAN-1. PLAN-3
must not start until this plan's last task has committed.

## Goal

`stakes` is a retired key that `config.mjs unset` can remove from either
layer, `route-table.json` and the cells grid no longer exist anywhere in the
tree, and self-verify's routing checks are re-keyed onto what still exists
rather than left green over nothing.

## Must be true when done

- `node cadence-core/bin/config.mjs unset stakes` removes the key from
  `.planning/config.json`, `--global` removes it from the user-global file,
  and `unset` on a key the file does not hold returns `ok:true` and changes
  no bytes.
- `node cadence-core/bin/config.mjs check stakes=shipped` is refused with a
  message naming `v4.0.0`, the roles block and `/cad-config --roles`, and
  both read faces (`config.mjs get`, `route.mjs resolve`) over a config still
  carrying `stakes` return a `warnings[]` entry with the same pointer.
- `cadence-core/route-table.json` and `cadence-core/bin/lib/route-cells.mjs`
  do not exist, `config.schema.json` carries no `stakes` row, no
  `model_aliases`, and no `model.overrides.*` enum.
- `node cadence-core/bin/self-verify.mjs` reports `ok:true`, and a rung file
  `lib/rung-agent.mjs` maps that is missing from `agents/` is reported as
  `missing-rung-agent` rather than passing green.
- The whole suite and `npx tsc -p tsconfig.ci.json` are green after every
  task.

## Context

Locked by `.planning/phases/3/CONTEXT.md`: D-01 (`route-table.json` is
deleted), D-06 (`config.mjs unset <key> [--global]` plus a `retired-keys.mjs`
entry for `stakes` naming the roles block; the sha256 pin in
`retired-keys.test.mjs` is re-cut in the same commit), D-07 (`model.profile`'s
retirement re-pointed at the roles block), D-08 (the three self-verify checks
that `stakes`' removal would silently disable are re-keyed or deleted
deliberately - `gateAgreementIssues` was re-keyed in PLAN-1 Task 2; this plan
handles `cellIssues`, `vocabularyIssues` and the rung-reachability walks).
Measured this session: self-verify's config-token scan only reads DOTTED
tokens with a schema family, so a bare `` `stakes` `` in prose is not an
`unknown-config-key` and the schema row can go before PLAN-3's prose sweep.
Out of this plan: every prose surface, the interview, the migration arm
(PLAN-3); `route.mjs` (finished in PLAN-1).

## Tasks

### Task 1: Self-verify's routing checks are re-keyed onto the map and the ladder, and the cells lib is deleted

- **Files:** cadence-core/bin/self-verify.mjs, cadence-core/bin/self-verify.test.mjs,
  cadence-core/bin/lib/route-cells.mjs, cadence-core/bin/route-cells.test.mjs,
  cadence-core/bin/test.mjs
- **Action:** Delete `lib/route-cells.mjs` and `route-cells.test.mjs` - the
  cells grid, the table's vocabulary arrays and the cell-vs-alias check are
  the whole of its subject and all three are what this phase removes (D-08:
  deleted deliberately, not disabled) - and drop `route-cells` from the
  `routing` stem list in `bin/test.mjs`. In `self-verify.mjs`, check 8 no
  longer reads `cadence-core/route-table.json`: the `existsSync` block, the
  `unreadable-surface` arm for it, the `missing-input` arm for it, the
  `schema.stakes` read and the imports from `route-cells.mjs` all go. What
  replaces them, keyed on what still exists: map to disk - every agent stem
  `RUNG_FILES` names must exist as `agents/<stem>.md`, filed as
  `missing-rung-agent` with a detail naming role and rung, because every rung
  is reachable by config now so the reachable set IS the map; disk to map -
  an `agents/<role>-<rung>.md` whose rung is in `RUNG_ORDER` but which
  `rungFile(role, rung)` does not map to is `undeclared-rung-agent`, same
  code as today, keyed on `Object.keys(RUNG_FILES)` (longest first, as the
  existing walk sorts) and `RUNG_ORDER` instead of the table's `roles` and
  `rung_order`. Check 8b hands `effortEnumIssues` `RUNG_ORDER`. Rewrite the
  header comment's check list (the `routing cells` and `agreement` entries)
  and any remark that the tree needs a table. In `self-verify.test.mjs`, the
  fixture-tree builders stop writing `cadence-core/route-table.json`; rewrite
  the check 8 cases - a `RUNG_FILES` stem absent from the fixture's `agents/`
  is one `missing-rung-agent` naming it; a rung-suffixed file the map does
  not name is `undeclared-rung-agent`; a mapped, present ladder is clean -
  delete the drifted-`stakes_order`/`gates` vocabulary cases and the
  malformed-table and no-table cases, and make the "tree with no
  route-table.json" case the ordinary tree.
- **Verify:** `test -e cadence-core/bin/lib/route-cells.mjs` and
  `test -e cadence-core/bin/route-cells.test.mjs` both fail;
  `node --test cadence-core/bin/self-verify.test.mjs` passes;
  `node cadence-core/bin/self-verify.mjs` reports `ok: true`; with
  `agents/cad-planner-low.md` temporarily moved out of the tree the same
  command reports a `missing-rung-agent` whose detail names `cad-planner`
  and `low` (move it back); `node cadence-core/bin/test.mjs routing` passes.

### Task 2: route-table.json is deleted, and the tests that read it read the schema and the libs instead

- **Files:** cadence-core/route-table.json, cadence-core/bin/prose-agreement.test.mjs,
  cadence-core/bin/risk-diff.test.mjs, cadence-core/bin/rung-agent.test.mjs,
  cadence-core/bin/gate-agreement.test.mjs
- **Action:** Delete `cadence-core/route-table.json` (D-01: after PLAN-1 the
  resolver reads nothing from it and `RUNG_ORDER` carries the one array it
  still held). In `prose-agreement.test.mjs`, `CST-02` (the eight categories
  stated in three places) compares the schema's
  `review.triggers.risk_surface.surfaces` `values`, `CATEGORIES` exported by
  `lib/surface-scan.mjs`, and the category list in
  `references/risk-surface.md` - still three places, the table leg replaced
  by the lib that `planning.mjs detect-surfaces` and `risk-check` already
  judge against; `DOC-02`'s rung-count arm reads `RUNG_ORDER` instead of the
  table's `rung_order`. In `risk-diff.test.mjs`, the case
  `risk-check run: the answer is judged against route-table.json's
  vocabulary` compares the schema enum with `CATEGORIES`. Reword the header
  comments in `gate-agreement.test.mjs` and any remaining
  `route-table.json` remark in `rung-agent.test.mjs`. Leave the quoted plan
  and UAT prose inside `planning-files.test.mjs` and
  `planning-criteria-coverage.test.mjs` fixtures alone - they are historical
  text a parser is tested over, not statements about HEAD.
- **Verify:** `test -e cadence-core/route-table.json` fails;
  `grep -rn "'route-table.json'" cadence-core/bin` prints nothing (no code
  path builds the file's name any more); `node cadence-core/bin/test.mjs prose routing`
  passes; `node cadence-core/bin/self-verify.mjs` reports `ok: true`.

### Task 3: config.mjs can remove a key from one layer

- **Files:** cadence-core/bin/config.mjs, cadence-core/bin/lib/arg-contract.mjs,
  cadence-core/bin/config.test.mjs
- **Action:** Add an `unset` subcommand: `unset <key> [<key> ...]` with the
  same `--file <path>` / `--global` selection `optFile` already performs for
  `set` and `get`. It edits exactly ONE file - never the merged view - and
  removes each dotted path present in it, answering `{ok:true, file,
  removed:[...]}` where `removed` lists only the keys that were actually
  present. When nothing was removed - the key is absent, or the file does not
  exist - it writes nothing at all, so the file is byte-identical and no
  file is created (AC3); a file that exists but cannot be parsed, or whose
  top level is not an object, is refused with the same `read` / `invalid`
  envelopes `set` uses. It accepts any dotted path - a schema key, a retired
  key or an unknown one - because its job is removing what `validate`
  refuses, and a write face that refused a retired key here would leave the
  migration with no seam while `workflows/config.md` forbids hand edits
  (D-06). Whether a container the removal left empty is pruned is the
  executor's call; `validate` must pass on the result either way. Add a
  `CONTRACTS['config.mjs'].unset` row in `lib/arg-contract.mjs` declaring
  `--file` and `--global` exactly as the `set` row does - `optFile` reads
  `CONTRACTS['config.mjs'][cmd]` and throws on an absent row, and check 2
  lints every prose invocation against it. Name `unset` in the usage string.
  In `config.test.mjs`, add a section covering every AC3 arm, including
  sha256 byte-identity on the no-op arm, `--global` against a relocated
  `CADENCE_GLOBAL_CONFIG`, a nonexistent `--file` creating nothing, and a
  malformed file refused.
- **Verify:** On a scratch file `F` holding `{"stakes":"critical","granularity":"fine"}`:
  `node cadence-core/bin/config.mjs unset --file F stakes` prints `ok:true`
  with `removed:["stakes"]` and `F` no longer contains `stakes` while still
  containing `granularity`; a second identical run prints `ok:true` with
  `removed:[]` and `sha256sum F` is unchanged;
  `CADENCE_GLOBAL_CONFIG=G node cadence-core/bin/config.mjs unset --global stakes`
  on a scratch `G` edits `G` and nothing else; `unset --file <path that does
  not exist> stakes` prints `ok:true` and creates no file;
  `node --test cadence-core/bin/config.test.mjs` passes;
  `node cadence-core/bin/self-verify.mjs` reports `ok: true`.

### Task 4: stakes is a retired key, and the retirement rail is re-pinned

- **Files:** cadence-core/config.schema.json, cadence-core/bin/config.mjs,
  cadence-core/bin/config.test.mjs, cadence-core/bin/config-seams.test.mjs,
  cadence-core/bin/lib/retired-keys.mjs, cadence-core/bin/retired-keys.test.mjs,
  cadence-core/bin/self-verify.test.mjs, cadence-core/bin/prose-agreement.test.mjs
- **Action:** Delete the `stakes` row from `config.schema.json` - after PLAN-1
  nothing reads it - and the `k === 'stakes'` arm in `config.mjs`'s `get`
  with its comment block. In `lib/retired-keys.mjs`, add a `stakes` entry
  with `since: 'v4.0.0'` whose rendered messages (both `retiredKeyError` and
  `retiredKeysIn`) name the roles block - `roles.<role>.model` and
  `roles.<role>.effort` - and name `/cad-config --roles` as the migration
  that expands the level into per-role values and removes the key with
  `config.mjs unset stakes`; whether the pointer rides `replacement` or
  `detail` is the executor's call so long as both rendered strings carry it.
  Re-point `model.profile` at the roles block (D-07 - today it tells a user
  to set a key the write face now refuses). Reword
  `model.auto.escalate_on_failure`'s detail, which says "honoured at every
  stakes level"; leave the eight `risk.override.*` details exactly as they
  are - the test's own comment calls their wording a separate decision. In
  `retired-keys.test.mjs`, re-cut `RETIRED_KEYS_SHA256` to the new file's
  digest, rewrite the docblock so it records THIS phase's edit as the
  decision behind the new pin, rewrite the `model.profile` case, and add a
  `stakes` case on both faces. In `config.test.mjs`, rewrite the section
  `get: an unset stakes reads as unset` (a `get stakes` is now
  `unknown-key`, a `check`/`set` of it is the retirement refusal) and move
  every test that used `stakes` as its sample key onto a key that still
  exists. In `config-seams.test.mjs`, clear the remaining `stakes` uses the
  same way. In `self-verify.test.mjs`, drop `stakes` from the prose-token
  fixture list that names schema keys. In `prose-agreement.test.mjs`, remove
  any remaining read of `keys.stakes`.
- **Verify:** `node cadence-core/bin/config.mjs check stakes=shipped` prints
  `ok:false` whose detail matches `retired in v4.0.0`, `roles.` and
  `/cad-config --roles`; `node cadence-core/bin/config.mjs get stakes` prints
  `reason:"unknown-key"`; on a scratch config `F` carrying `stakes`,
  `node cadence-core/bin/config.mjs get --file F workflow.verifier` and
  `node cadence-core/bin/route.mjs resolve --role cad-executor --file F` both
  carry a `warnings[]` entry containing `"stakes"` and `/cad-config --roles`;
  `grep -c '"stakes"' cadence-core/config.schema.json` prints `0`;
  `grep -c "model_aliases" cadence-core/config.schema.json` prints `0`;
  `grep -cE '"model\.overrides\.cad-[a-z-]+":\s*\{ "type": "string_or_null"' cadence-core/config.schema.json`
  prints `6` and `grep -cE '"model\.overrides\.cad-[a-z-]+":\s*\{ "type": "enum"' cadence-core/config.schema.json`
  prints `0`; `node --test cadence-core/bin/retired-keys.test.mjs cadence-core/bin/config.test.mjs cadence-core/bin/config-seams.test.mjs cadence-core/bin/self-verify.test.mjs`
  pass; then the whole tree: `node cadence-core/bin/test.mjs` passes,
  `node cadence-core/bin/self-verify.mjs` reports `ok: true`, and
  `npx tsc -p tsconfig.ci.json` is clean.

## Notes

- Requirement id: **ROL-02**, declared identically in PLAN-1 (see its Notes for
  the statement). Sequential plan; do not start before PLAN-1's Task 6 commit.
- Task 3 lands before Task 4 on purpose: the retirement message names
  `config.mjs unset stakes`, and a message naming a subcommand that does not
  exist yet would be false for one commit.
- The sha256 re-cut in Task 4 is the cost D-06 accepted. The eight
  `risk.override.*` detail strings stay in the false state
  `retired-keys.test.mjs` documents; correcting them is a decision this phase
  was not asked to take.
- After Task 4, this repository's own `.planning/config.json` fails
  `config.mjs validate` on its `stakes` row and every read face warns about
  it. That is AC2's live fixture, deliberately left for the human-verify;
  routing keeps working through the `model.overrides` and `model.effort`
  fallbacks the schema still carries.
- Prose under `cadence-core/` and `skills/` still says `stakes` in eighteen
  places after this plan; PLAN-3 sweeps them. Self-verify does not flag them
  (the tokenizer reads dotted tokens only), so the suite stays green across
  the gap.
