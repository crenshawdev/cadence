---
phase: 2
plan: 1
requirements: [RNG-04]
files:
  - cadence-core/templates/config.json
  - cadence-core/bin/route.mjs
  - cadence-core/bin/route.test.mjs
  - cadence-core/bin/config.mjs
  - cadence-core/bin/config.test.mjs
  - cadence-core/workflows/new-project.md
  - cadence-core/workflows/adopt.md
  - cadence-core/bin/weight-budgets.json
  - cadence-core/bin/prose-agreement.test.mjs
  - cadence-core/bin/self-verify.test.mjs
---

# Phase 2: Adaptive routing is reachable - Plan

## Goal

A project initialised by `/cad-new-project` or `/cad-adopt` reaches the
unset-`stakes` resolution `config.schema.json` documents, instead of being
pinned to `shipped` by the template before the resolver is ever consulted.

## Must be true when done

- `cadence-core/templates/config.json` holds no `stakes` key at all - not the
  value, not a `null`, not a placeholder - and `config.mjs validate` on a
  config copied from it returns `ok:true`.
- On a repo whose `.planning/config.json` is that template copy,
  `route.mjs resolve --role cad-executor --phase N` returns `stakes: "solo"`
  with `model: "sonnet"` when every plan in that phase reads clean, and returns
  `ok:true` with `stakes: "shipped"` when one of those plans cannot be read.
- `route.mjs resolve` and `route.mjs replay` each carry `stakes_set` on their
  envelope over the same config: `false` when no config layer set `stakes`,
  `true` when one did.
- `config.mjs get stakes` on a config no layer sets `stakes` in returns a
  warning that names `stakes` as unset and names `route.mjs resolve` as the seam
  that answers it; with `stakes` set it returns the value and no such warning;
  a keyless `get` over the same file still emits no warning for this key.
- Neither `cadence-core/workflows/new-project.md` nor
  `cadence-core/workflows/adopt.md` tells the user shipped stakes were written.
  Each states that `stakes` is unset and names BOTH arms of what unset resolves
  to, and neither file exceeds its `weight-budgets.json` ceiling.
- A shipped test holds the README's "leaving `stakes` unset" sentence against
  real `route.mjs resolve` output over a fixture initialised from the shipped
  template, and the four existing floor tests in `route.test.mjs` are green with
  no edit to them.
- `node cadence-core/bin/test.mjs` is green and
  `node cadence-core/bin/self-verify.mjs` reports `ok:true`.

## Context

Locked by `phases/2/CONTEXT.md`: `stakes` is DELETED from the template, never
nulled (D-01, a nulled key is refused by `config.mjs` and would fail the first
config read on every new project); the cheaper route a fresh project now gets is
accepted whole (D-02); neither init workflow starts ASKING for a level (D-03);
the envelope field is spelled `stakes_set` and rides `replay` too (D-04); the
`config.mjs` read face answers unset for `stakes` (D-05); no migration seam for
already-initialised projects, so no `config.mjs unset` subcommand and no
`/cad-config` option (D-06); the replacement prose names both arms and does NOT
enumerate gate and verify consequences (D-07); any growth re-pins the budget row
in the SAME commit (D-08); the `.planning/DOCS-CLAIMS.md` rows quoting the old
sentences are left as the records they are (D-09); the proof lands in the two
EXISTING test suites and not in a new `self-verify` check (D-10).
Out of scope: the resolver's own floor arithmetic, which v3.5.7 phase 3 shipped
and this phase only makes reachable; the `route-table.json` grids; the surfaces
seam; any second init question; anything that clears a `stakes` already pinned
in an existing project's config.
Baseline measured 2026-08-29 on a fixture built from the shipped template with
`stakes` deleted, one plan declaring `docs/README.md`: the clean-plan resolve
returns `{"stakes":"solo","model":"sonnet","verify":"off"}` with no warnings,
the same phase with a second unreadable plan returns
`{"ok":true,"stakes":"shipped","model":"opus"}`, `config.mjs validate` on that
config returns `ok:true` over 46 checked keys, and `config.mjs get stakes`
returns `{"ok":true,"values":{"stakes":"shipped"},"source":"repo"}` with no
warning.

## Tasks

### Task 1: Stop the template pinning `stakes`

- **Files:** cadence-core/templates/config.json,
  cadence-core/bin/route.test.mjs (start at the test named `the SCAFFOLDED
  template carries no triggers block, so nothing overrides the level`)
- **Action:** Delete the `stakes` key and its value from
  `cadence-core/templates/config.json` outright. It must not be replaced by
  `null`, by a comment, or by any placeholder: `config.mjs` refuses `null` for
  this key, so a nulled template makes the first config read on every brand-new
  project fail (D-01, measured - `validate` on a nulled template returns
  `ok:false` naming `stakes`). The shipped precedent for an omitted key is the
  absent `review.triggers` block, which the test named above already pins with
  "the template must write no gate at all"; this is the same absent-is-not-zero
  rule applied to a second key. Leave every other key in the template exactly as
  it is - `granularity`, the `workflow` block, the three `null` forge keys and
  the rest all keep their values, and no key is reordered. In
  `route.test.mjs`, that same test asserts `rs.stakes === 'shipped'` for a
  PHASE-LESS resolve on the template, and that assertion stays green off
  `DEFAULTS` (measured 2026-08-29 - a resolve with no `--phase` in hand still
  returns `shipped` on the stripped template) - do not change the assertion.
  What must change is its message string, `the template ships at shipped`, which
  becomes false the moment the key is gone: restate it as the default standing
  in the template's silence, so the message says what the assertion now proves.
  Touch nothing else in that test; its `review.triggers` arms and its
  `stakes: 'critical'` overlay arm are unrelated to this change.
- **Verify:** `node -e` printing `'stakes' in JSON.parse(...)` over
  `cadence-core/templates/config.json` prints `false`, and grepping the file for
  `stakes` returns nothing. `node cadence-core/bin/config.mjs validate --file
  cadence-core/templates/config.json` returns `ok:true` with an empty `errors`
  array. `node --test cadence-core/bin/route.test.mjs` reports 0 fail, and no
  message string in that file claims the template ships a stakes level. And the
  removal is the ONLY change to that file: `git diff --unified=0
  cadence-core/templates/config.json` shows exactly one removed line and no
  added or reordered one, and a `node -e` comparison of
  `Object.keys(JSON.parse(...))` before and against `git show HEAD:` the same
  path differs by the single entry `stakes`. Neither `validate` nor the routing
  arms can catch a template reduced to `{}` - schema defaults make it validate
  and still resolve `solo` on clean plans - so this is the check that falsifies
  collateral deletion.

### Task 2: Prove both arms of the unset floor from a template-initialised repo

- **Files:** cadence-core/bin/route.test.mjs (start at `floorRoot` and at the
  `fail-closed:` tests below it)
- **Action:** Add a test to the plan-time risk floor section that proves AC3
  from `route.mjs resolve` output over a repo built from the SHIPPED TEMPLATE
  rather than from a hand-written config. Build it through the existing
  `floorRoot` helper, which already takes a config object, a `<phase>/<file>`
  plan map and a repo-file map and writes a whole repo root; the config it is
  handed is the parsed `cadence-core/templates/config.json`, read the way the
  template test at the top of this file already reads it. Two arms in one
  fixture shape. First: one phase, every plan reading clean and declaring a repo
  file that touches no risk surface (`docs/README.md` holding `# Readme\n` is
  the body CONTEXT measured), resolving to `stakes: "solo"` and
  `model: "sonnet"`. Second: the same phase with one plan that cannot be read,
  built as a DIRECTORY at the plan's own name - the technique the shipped
  `fail-closed: a PLAN whose file mode makes it unreadable holds the configured
  stakes` test states its reason for, because a chmod is silently a no-op under
  a root test runner - resolving to `ok:true` with `stakes: "shipped"`. Do NOT
  overlay the `ANSWERED` surfaces constant used by the floor tests above: the
  template writes no `review.triggers` block, so a template-initialised project
  gets all eight categories with `surfaces_answered: false`, and overlaying an
  answered set would test a project this template does not produce. Do not
  assert an empty `warnings` array on the unreadable arm - the withheld-discount
  warning naming the plan is expected there and is part of what fail-closed
  means. Do not edit the four existing floor tests (`floor: an explicit
  stakes=critical is never resolved below`, `floor: with stakes UNSET a
  surfaceless phase resolves solo`, `floor: stakes=solo is a FLOOR`, and the
  waived-surface arm): each writes its own `stakes` into its own fixture config
  and never reads the template, so AC4's "unchanged and green" holds by
  construction (D-11).
- **Verify:** `node --test cadence-core/bin/route.test.mjs` reports 0 fail with
  the new arms present, and `git diff` shows no change to the four existing
  floor tests. Against a tree where the template still writes
  `"stakes": "shipped"` the clean arm fails, reporting `shipped` where it
  expects `solo` - that failure is what makes the arm a proof of this phase and
  not of the resolver.

### Task 3: Carry `stakes_set` on the resolve and replay envelopes

- **Files:** cadence-core/bin/route.mjs (start at `readConfig`'s `stakesSet`
  field, at the `out({ ok: true, role: ... })` call that ends the resolve path
  and at `replay`'s `out({ ok: true, stakes: today, ... })`),
  cadence-core/bin/route.test.mjs
- **Action:** Emit set-ness on both output envelopes under the key `stakes_set`,
  snake_case on the envelope's own convention beside the shipped
  `surfaces_answered` (D-04) - `stakesSet` stays the internal spelling and is not
  renamed at its three existing read sites. The value is the flag `readConfig`
  already returns, carried outward rather than re-derived at the envelope: a
  second derivation of "did a layer carry this key" is how the reported set-ness
  and the floor's own discount predicate would come to disagree, and they read
  the same fact. Place it beside `stakes` in each envelope so the flag and the
  value it qualifies are read together, and extend the envelope's own doc
  comment - the one that walks `review`, `reviewers`, `surfaces` +
  `surfaces_answered` and `verify` - to say what `stakes_set` distinguishes, on
  the `surfaces_answered` precedent: a default reported as a configured value is
  the defect this file's `readConfig` comment and its first-`reason` arm already
  exist to prevent, and free text in `reason` is not machine-checkable. On
  `replay` the field qualifies the `today` column, which is `cfg.stakes` and is
  the schema default when no layer set it, so the same rule applies for the same
  reason. Do NOT add the field to the `appendEvent` routing trace record: D-04
  names the resolve envelope and `replay`, the trace line is a different
  consumer with its own shape, and widening it is scope this phase does not
  carry. Add arms to `route.test.mjs` proving both faces - a config with no
  `stakes` reports `false`, a config setting `stakes` reports `true`, and
  `replay` reports the same field over the same config as `resolve` does - using
  that file's own `cfg`/`rawCfg`/`resolve` helpers and its `floorRoot` fixture
  for the replay arm, which needs a phase directory to produce a row.
- **Verify:** `node cadence-core/bin/route.mjs resolve --role cad-executor
  --file <a config with no stakes key>` prints `"stakes_set":false` beside
  `"stakes":"shipped"`, the same command over a config setting `stakes` prints
  `"stakes_set":true`, and `node cadence-core/bin/route.mjs replay --file` over
  each of those two configs prints the matching value on its envelope.
  `node --test cadence-core/bin/route.test.mjs` reports 0 fail with arms
  covering all four of those combinations.

### Task 4: Make `config.mjs get stakes` answer unset instead of reporting the default

- **Files:** cadence-core/bin/config.mjs (start at `LEVEL_KEY`,
  `LEVEL_KEY_NOUN` and the `levelKey` arm inside `get`),
  cadence-core/bin/config.test.mjs
- **Action:** `config.mjs get stakes` returns
  `{"ok":true,"values":{"stakes":"shipped"},"source":"repo"}` identically for a
  config that sets the key and one that does not (measured 2026-08-29), so the
  init workflow's new sentence would tell a user `stakes` is unset while the
  very next `/cad-config` read tells them it is `shipped` from the repo layer -
  the "a default reported as a configured value" failure reproduced one seam
  over. Give `stakes` its own unset arm BESIDE the existing `LEVEL_KEY` one
  rather than widening that regex. CONTEXT D-05 named this as the alternative if
  the two nouns do not share a sentence, and they do not: the shipped sentence
  ends "so the stakes level decides it", which cannot be said of `stakes`
  itself, and `LEVEL_KEY_NOUN` maps the key's last segment to a noun a
  `review.triggers.*` key has and this key does not. Gate the new arm on exactly
  the same two conditions the existing one uses - an EXPLICIT read (`keys` was
  non-empty) and no layer having supplied a value - because a keyless `get`
  walks every schema key and would append this line to every full read, which
  workflows relay straight to the user. Its sentence states that no config layer
  set `stakes`, that the level is therefore decided per phase from the plans in
  scope, and it names `route.mjs resolve` as the seam that answers it, matching
  the shipped phrasing precedent in `references/config-catalog.md`'s unset rows.
  Leave the value line exactly as it is: `values.stakes` still reports the
  schema default, because the schema sentinel does that work and the read face's
  job here is to say which of the two states the key is in. Do not read
  `route-table.json` and do not state what the level fires - this seam does not
  know the stakes level, and answering as if it did is the same defect pointed
  the other way. Add no subcommand and no CLI flag (D-06). Prove both states and
  the keyless case in `config.test.mjs` using that file's own `run` helper.
- **Verify:** `node cadence-core/bin/config.mjs get stakes --file <a config with
  no stakes key>` returns `ok:true` with a `warnings` array whose entry names
  both `stakes` and `route.mjs resolve`, and `values.stakes` still `shipped`;
  the same command over a config setting `stakes` returns the set value with no
  `warnings` key at all; `node cadence-core/bin/config.mjs get --file <the
  stakes-less config>` with no key named returns no warning mentioning `stakes`.
  `node --test cadence-core/bin/config.test.mjs` reports 0 fail with arms for
  all three, and `node --test cadence-core/bin/config-seams.test.mjs` is green
  with no edit to it. `node --test cadence-core/bin/self-verify.test.mjs`
  reports 0 fail: check 12's census sentence at
  `cadence-core/bin/self-verify.test.mjs:1675` counts the `mergeLayers`
  callsites and the files holding them, and this task's new arm sits in the file
  that holds one of them. If the arm moves either number, re-pin that sentence
  and the assertion message beside it to the new count IN THIS SAME COMMIT -
  that obligation is why the test file is in this plan's lease.

### Task 5: Both init workflows state what is actually written, with their ceilings re-pinned

- **Files:** cadence-core/workflows/new-project.md (start at the "Config written
  with defaults" line in the config-copy step),
  cadence-core/workflows/adopt.md (start at the byte-identical line in its own
  config-copy step), cadence-core/bin/weight-budgets.json
- **Action:** Both files tell the user "Config written with defaults (standard
  granularity, shipped stakes, research and plan check off, verifier on)" in a
  sentence that is byte-identical between them. Shipped stakes are no longer
  written. Replace that claim in BOTH files with one that states `stakes` is
  unset and names both arms of what unset resolves to, in the schema's own
  terms: it floors at `solo` when every plan in scope was read clean, and holds
  the `shipped` default when any of them could not be. Naming both arms is what
  stops an unreadable plan pricing a phase at `shipped` from later reading as a
  bug (D-07). Do NOT enumerate the gate and verify consequences of that level -
  which model runs, which review gate fires, whether deep verify runs - that is
  the resolver's answer per dispatch and this line is about what the file on
  disk holds. Keep the other three defaults in the sentence accurate and keep
  the two sentences byte-identical to each other, so the pair continues to move
  together the way `.planning/DOCS-CLAIMS.md` records them moving. Neither file
  starts ASKING for a stakes level: both state one deliberate exception to "ask
  no configuration questions", the forge on FRG-02 grounds, and both say "Every
  other key keeps the template's value" - a second question contradicts a stated
  invariant in both files and re-pins the level this phase exists to leave unset
  (D-03). If the new prose names a seam, name it with no flag: self-verify's
  invocation check validates every `<script>.mjs <subcommand> --flag` triple it
  finds in prose against the declared contract table, and the shipped precedent
  for this phrasing writes `route.mjs resolve` bare. Both files sit EXACTLY at
  their ceiling in `weight-budgets.json` today (`workflows/new-project.md`
  26241, `workflows/adopt.md` 21030, measured equal to on-disk bytes), and the
  budget check is a ceiling comparison, so any growth is a `budget-overrun` -
  re-pin each grown row to its new measured byte count in this same commit
  (D-08). The template row needs no re-pin: it only shrank.
- **Verify:** `grep -rn "shipped stakes" cadence-core/workflows/` returns
  nothing, both files contain a sentence naming `solo` and `shipped` as the two
  arms of an unset `stakes`, and `diff <(grep ...)` or an equivalent comparison
  shows the two replacement sentences are byte-identical to each other.
  `node cadence-core/bin/self-verify.mjs` reports `ok:true` with an empty
  `problems` array - in particular no `budget-overrun` and no `unknown-flag` for
  either file - and `node cadence-core/bin/weight.mjs` reports byte counts for
  both surfaces at or below their `weight-budgets.json` rows. Each grown row is
  re-pinned to the count `weight.mjs` MEASURES, not merely to some number above
  it: for each of the two workflow surfaces the row's value EQUALS that measured
  byte count exactly, checked by comparing the two figures rather than by
  reading `budget-overrun`'s silence. A ceiling raised past the measurement
  satisfies every other check on this line and is precisely what D-08's re-pin
  forbids, because it retires the guard against uncontrolled prose growth.

### Task 6: Hold the README's adaptive-routing claim against a real resolve

- **Files:** cadence-core/bin/prose-agreement.test.mjs (start at
  `resolvedReview` and the `doc` helper)
- **Action:** The README states that "leaving `stakes` unset is what lets a
  phase touching none of them route below the old default". Until this phase
  that sentence was false of every project Cadence initialises. Add a test to
  this file that reads the live README and holds that claim against real
  `route.mjs resolve` output over a fixture initialised FROM THE SHIPPED
  TEMPLATE, which is this file's established shape: read a live document and the
  artifact it copies from, and fail when the two have drifted. Add a second
  fixture helper beside `resolvedReview` rather than generalising it -
  `resolvedReview` writes a bare config carrying one `stakes` value and asserts
  the resolve came back AT that level, which is the opposite of the case here,
  and it builds no repo tree, no phase directory and no declared file. The new
  helper copies `cadence-core/templates/config.json` into a temp repo's
  `.planning/config.json`, writes a plan under `.planning/phases/<N>/` whose
  frontmatter declares one repo file that touches no risk surface, writes that
  file, and resolves with `--phase`. Locate the README sentence by a stable
  substring rather than by a line number, which rots. Read the level the claim
  is measured against out of the artifacts rather than hardcoding it: the schema
  default is `cadence-core/config.schema.json`'s `keys.stakes.default`, and
  `cadence-core/route-table.json`'s `stakes_order` is the list that makes
  "below" mean something. Assert that the claim is still present in the README
  AND that the template-initialised resolve returns a level strictly below that
  default - a test that only checked the sentence is there would pass on the
  broken tree this phase repairs. This file needs no group registration in
  `test.mjs`; it is already named in the `prose` group.
- **Verify:** `node --test cadence-core/bin/prose-agreement.test.mjs` reports 0
  fail with the new arm present, and the arm fails against a tree where
  `cadence-core/templates/config.json` still writes `"stakes": "shipped"`, with
  a message naming the resolved level and the schema default. `node
  cadence-core/bin/test.mjs` is green across every group and
  `node cadence-core/bin/self-verify.mjs` reports `ok:true`.

## Notes

- One plan, matching CONTEXT's `Plan shape` directive. The independence test
  forbids anything else: tasks 1, 2 and 3 all write
  `cadence-core/bin/route.test.mjs`, and task 2's fixture only proves the phase
  once task 1 has removed the key.
- Two CONTEXT flagged assumptions are resolved here by reading the tree rather
  than left open. D-04's shape question is answered in task 3: `readConfig`
  carries the flag outward and the envelope builders emit it, no re-derivation.
  D-05's SHAPE assumption resolves to its named alternative, a separate unset
  arm rather than a widened `LEVEL_KEY` - the existing sentence's tail, "so the
  stakes level decides it", is exactly what cannot be said of `stakes` itself,
  and `LEVEL_KEY_NOUN` keys off a last segment this key does not have. That is
  the alternative CONTEXT authorised, not a deviation from it.
- D-10's third flagged assumption - whether `resolvedReview` generalises or a
  second helper lands beside it - resolves to a second helper, in task 6, for
  the reason stated there.
- `cadence-core/bin/weight-budgets.json` is in the lease and is not optional:
  both init workflows are byte-for-byte at their ceiling right now, so task 5's
  prose edit fails self-verify's budget check without it, and AC7 requires
  `self-verify` `ok:true`.
- `cadence-core/bin/self-verify.test.mjs` is in the lease for the same kind of
  reason: `lease-check --plan-time` refused this plan without it, because the
  declared `config.mjs` and `route.mjs` both hold `mergeLayers` callsites that
  check 12's `CADENCE-CENSUS: self-verify-merge-layers` sentence counts. No task
  is expected to change that count - task 4 adds an arm, not a callsite - but if
  one does, the re-pin lands in the same commit (task 4's verify states it). The
  declaration authorises that re-pin and nothing else.
- No task touches `.planning/DOCS-CLAIMS.md`, `references/config-catalog.md` or
  `config.schema.json`. The DOCS-CLAIMS rows quoting the old sentences are
  resolved records of a past correction and stay as they are (D-09); the
  catalog's `stakes` Default column still names the schema default, which this
  phase does not change; and the schema's own unset paragraph is the wording the
  new prose copies FROM.
- A recalled v3.5.7 phase 3 UAT finding - "an unreadable plan fails closed at
  the configured stakes ... never below it, never `ok:false`" - is the second arm
  task 2 pins, and it is why that arm asserts `ok:true` alongside `shipped`
  rather than only the level.
