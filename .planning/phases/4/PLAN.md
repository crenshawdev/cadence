---
phase: 4
plan: 1
requirements:
  - STK-03
files:
  - cadence-core/route-table.json
  - cadence-core/bin/lib/risk-surfaces.mjs
  - cadence-core/bin/risk-surfaces.test.mjs
  - cadence-core/bin/lib/phase-plans.mjs
  - cadence-core/bin/phase-plans.test.mjs
  - cadence-core/bin/route.mjs
  - cadence-core/bin/route.test.mjs
  - cadence-core/bin/config.mjs
  - cadence-core/bin/config.test.mjs
  - cadence-core/config.schema.json
  - cadence-core/bin/lib/route-cells.mjs
  - cadence-core/bin/route-cells.test.mjs
  - cadence-core/bin/self-verify.mjs
  - cadence-core/bin/self-verify.test.mjs
  - cadence-core/bin/weight-budgets.json
  - cadence-core/workflows/config.md
  - cadence-core/references/seams.md
  - cadence-core/references/review-triggers.md
  - INTERNALS.md
  - CHANGELOG.md
---

# Phase 4: The computed floor - Plan

## Goal

The risk signal Cadence already computes on every phase stops being used for one
thing and discarded. A declared path match over the phase's own PLAN sets a
stakes FLOOR the user may raise but not silently lower, and the one axis the
floor rides on stops being disableable by a typo.

## Must be true when done

- `node cadence-core/bin/route.mjs resolve --role <r> --phase <N>` against a
  phase whose PLAN `files:` match a `surfaces` row resolves at that row's floor
  even when every config layer says `solo`, returns the floored level's whole
  bundle (`model`, `effort`, `review`, `verify`), and its `reason` names the
  matched surface, the path that matched and the pattern that matched it. The
  same resolve with no `--phase`, against a STATE cursor pointing at that phase,
  returns a byte-identical bundle.
- Detection is a floor and never a tax: a phase whose PLAN matches no row, a
  phase with no PLAN file, a resolve with neither `--phase` nor a cursor, and a
  baseline already at or above the floor all return the level's own bundle with
  `ok:true` and nothing that reads as a raise. A PLAN that is present but
  unreadable - or whose frontmatter is out of grammar - returns the baseline
  bundle plus one warning naming the file, never `ok:false` and never a floor
  computed from a partially parsed `files:` list. A `cad-planner` or
  `cad-assumptions-analyzer` resolve returns the project baseline against the
  same fixture that floors `cad-executor` (D-09).
- Lowering below a detected floor takes a persisted `risk.override.<surface>`
  per surface: naming one of two detected surfaces still resolves floored,
  naming both resolves at the baseline with the `reason` naming each waived
  surface, and `config.mjs set risk.override.<not-a-surface>=true` is refused at
  the write face with a message listing the accepted surface names. The `=true`
  is load-bearing: `config.mjs`'s `checkPairs` calls `splitPair` FIRST, so a bare
  token with no `=` is refused as `not a key=value pair` before
  `surfaceKeyError` is ever reached - a walk that omits it records "refused" for
  the wrong reason and leaves the surface-listing arm untested.
- `node cadence-core/bin/self-verify.mjs` reports `ok:false` naming the
  offending row for a surface whose `floor` is not a stakes level, a surface row
  with no usable pattern list, a surface with no `risk.override.<surface>`
  schema key, and a `risk.override.<surface>` schema key naming no surface row.
- A `review.triggers.<t>.gate` a config layer set outside
  `off|advisory|blocking|adjudicated`, or not a string, no longer reaches the
  bundle: the resolve returns the LEVEL's gate for that trigger plus one warning
  naming the rejected value. That holds against a `route-table.json` carrying no
  `gates` array too - the check falls back to the resolver's own constant rather
  than skipping.
- `node --test cadence-core/bin/*.test.mjs` exits 0,
  `npx tsc -p tsconfig.ci.json` exits 0, and `node cadence-core/bin/self-verify.mjs`
  reports `ok:true` with `--phase` in the `route.mjs` CONTRACTS entry, no budget
  overage, no `unknown-config-key` and no `inert-config-key`.

## Context

Locked by `.planning/phases/4/CONTEXT.md`; read it before task 1. Phase 4
CREATES the detection moment as a deterministic path match over the phase's
declared PLAN `files:`, translating the eight prose risk surfaces into a
`surfaces` block in `cadence-core/route-table.json` (D-01) - it does NOT reuse
or replace the commit-time model-judgment detection in `cad-executor`, which
stays; two detectors coexist after this phase. A detected surface pins the
stakes LEVEL, so all four knobs come from the existing cell grid (D-02), applied
as `max(baseline, floor)` over `[solo, shipped, critical]` with every shipped row
carrying `floor: "critical"` (D-03). `route.mjs resolve` gains `--phase N` with a
`.planning/STATE.md` cursor fallback and derives the planning root from `--file`'s
dirname (D-04). The waiver is a persisted `risk.override.<surface>` key validated
at the write face, waiving PER SURFACE (D-05). The gate axis is otherwise
untouched - phase 3's config-wins precedence stands, and only the missing enum
check at `route.mjs:181-183` closes (D-06). Nothing records a `surfaces:` field
into any artifact; the match is computed live (D-07). Every unresolvable input
fails OPEN to the baseline with `ok:true` (D-08), and the floor starts once a
PLAN exists (D-09). The new input and table land with a CONTRACTS entry,
hand-written test rows and a self-verify walk in both directions (D-10).

Existing shapes to follow, not reinvent: `cadence-core/bin/lib/route-cells.mjs`
is the ONE statement of what makes `route-table.json` well-formed, with the
vocabulary supplied by the caller so a lib never grows a second opinion about
it; `cadence-core/bin/lib/retired-keys.mjs` is the write-face refusal precedent
and carries the doctrine that a value refused at `set` and ignored at `resolve`
is the same defect as no diagnostic; `cadence-core/bin/route.mjs:197-211` is the
resolve-side shape for a bad user value (warn, name it, let the routed value
stand).

Out of scope: replacing the commit-time detection, any change to phase 3's D-04
gate precedence, acceptance-criteria ids (phase 5), the remaining silent config
drops (phase 6), and the four phase-3 open items CONTEXT lists as still open.

### The `surfaces` block, as this plan will write it

Eight rows, every `floor` `critical`, translated from
`cadence-core/references/review-triggers.md:166-168`. Patterns are lowercase
tokens matched for EQUALITY against a declared path's tokens (task 1 states the
tokenizer).

| surface | patterns |
|---|---|
| `auth` | auth, authn, authz, authentication, authorization, oauth, login, logout, signin, signup, session, sessions, permission, permissions, rbac, acl, jwt |
| `migrations` | migration, migrations, migrate, alembic, flyway, liquibase, ddl, seeds |
| `billing` | billing, payment, payments, pricing, invoice, invoices, checkout, subscription, subscriptions, stripe, paypal, ledger, refund, refunds |
| `concurrency` | concurrency, concurrent, mutex, semaphore, lock, locks, locking, thread, threads, threading, scheduler, worker, workers, queue, queues |
| `destructive` | delete, deletion, destroy, drop, purge, prune, truncate, wipe, teardown, rollback |
| `secrets` | secret, secrets, credential, credentials, keyring, keystore, keychain, crypto, cipher, encrypt, encryption, decrypt, signing, gpg, pgp, env, dotenv, vault, password, passwd, htpasswd |
| `api_contract` | api, openapi, swagger, graphql, grpc, proto, protobuf, wire, dto, rpc, webhook, webhooks, idl |
| `untrusted_input` | parser, parsers, deserialize, deserializer, unmarshal, sanitize, sanitizer, sanitizing, upload, uploads, ingest, untrusted, xss, injection |

Surface names are the exact third segment of `risk.override.<surface>`, so they
must stay `[a-z_0-9]` only - a hyphen would not tokenize as a config key in
`cadence-core/bin/self-verify.mjs:280`'s dotted-token regex and the key would
read as prose.

Three tokens are DELIBERATELY absent and must not be added back without a
reason: `key`/`keys` and `token`/`tokens` from `secrets` and `contract` from
`api_contract`. Each matches ordinary Cadence paths
(`cadence-core/bin/lib/retired-keys.mjs`, `shell-tokens.mjs`,
`skills/cad-*-contract/SKILL.md`), so including them floors most Cadence phases
to `critical` on a name collision and trains the user to waive the floor by
reflex, which is the failure mode that makes a floor worthless. `schema` is out
of `migrations` for the same reason (`cadence-core/config.schema.json`).

## Tasks

### Task 1: declare the eight risk surfaces and the pure match lib

- **Files:** cadence-core/route-table.json,
  cadence-core/bin/lib/risk-surfaces.mjs,
  cadence-core/bin/risk-surfaces.test.mjs
- **Action:** Add three top-level blocks to `route-table.json`. `surfaces` is an
  object keyed by surface name, each value `{patterns: [...], floor: "critical"}`,
  with the eight rows of the table above. `stakes_order` is the array
  `["solo","shipped","critical"]` - the floor's comparison order, declared as
  data because `route.mjs` reads only this file and the config layers, and
  deriving an order from `Object.keys(cells)` would make JSON key order
  load-bearing. `gates` is the array
  `["off","advisory","blocking","adjudicated"]`, the accepted vocabulary a
  user-set gate is checked against in task 7 - the same role `model_aliases`
  plays for a pin, in the same file, so the resolver never has to read
  `config.schema.json`. Add a `_meta.surfaces` sentence stating that a row's
  patterns are matched against the phase's declared PLAN `files:`, that a match
  raises the stakes level and never lowers it, and that `risk.override.<surface>`
  is the per-surface waiver. Create `cadence-core/bin/lib/risk-surfaces.mjs` as
  a PURE lib in the shape of `lib/route-cells.mjs` (no fs, no emit, no process,
  no Date, no randomness; `// @ts-check` and JSDoc on every export, because
  `tsconfig.ci.json` type-checks every non-test file under `cadence-core/bin`).
  Export: `pathTokens(path)` - insert a separator at every lower/digit-to-upper
  boundary so `authService.ts` yields `auth`, lowercase, then split on every run
  of non-alphanumeric characters and drop empties, so
  `cadence-core/bin/lib/route-cells.mjs` yields
  `[cadence, core, bin, lib, route, cells, mjs]` and `.env.example` yields
  `[env, example]`; `matchSurfaces(files, surfaces)` - walk the surfaces object
  in declaration order and, for each surface, the files in the order given,
  returning at most ONE entry per surface `{surface, floor, path, pattern}` for
  the first (path, pattern) pair whose token set contains the pattern, so the
  result is deterministic and a surface cannot report twice; `raiseTo(baseline,
  floor, order)` - return whichever of the two sits later in `order`, returning
  `baseline` unchanged when either value is absent from `order` (an unknown
  level must not silently become index -1 and lower the level, which is the
  exact inversion this phase exists to prevent); `OVERRIDE_PREFIX` (the string
  `risk.override.`); `surfacesFromKeys(schemaKeys)` - the surface names a schema
  key list declares under that prefix, sorted; and `surfaceKeyError(key,
  schemaKeys)` - for a key under `risk.override.` that the schema does not hold,
  the write-face string `"<name>" is not a risk surface; accepted surfaces are
  a, b, c` naming every accepted name, and null for every other key. Be
  defensive at every hop the way `lib/route-cells.mjs` is: this runs on whatever
  a user's `route-table.json` and config happen to hold, so a non-array
  `patterns`, a non-string pattern, a non-string path and a non-object surface
  row each contribute NO match rather than throwing. Write
  `risk-surfaces.test.mjs` with hand-written rows: the tokenizer on a
  camelCase path, a dotfile, a path with digits and a Windows-style backslash
  path; a single-surface match naming the path and pattern; a two-surface match
  returning both in declaration order; one path matching two patterns of the
  same surface reporting once; `raiseTo` raising, holding when the floor is
  lower, holding on an unknown level; `surfaceKeyError` returning null for a
  real surface key and for `stakes`, and listing every accepted name for
  `risk.override.nope`; and the malformed-input rows. Never derive an expected
  value from `route-table.json` - that file is the subject under test
  (`cadence-core/bin/route.test.mjs:72-79`).
- **Verify:** `node --test cadence-core/bin/risk-surfaces.test.mjs` exits 0;
  `node -e "const t=require('node:fs').readFileSync('cadence-core/route-table.json','utf8');const j=JSON.parse(t);console.log(Object.keys(j.surfaces).length, j.stakes_order.join(','), j.gates.length)"`
  prints `8 solo,shipped,critical 4`; and `npx tsc -p tsconfig.ci.json` exits 0.

### Task 2: read the phase's declared PLAN files off disk, failing open

- **Files:** cadence-core/bin/lib/phase-plans.mjs,
  cadence-core/bin/phase-plans.test.mjs
- **Action:** Create `cadence-core/bin/lib/phase-plans.mjs`, the disk side of
  the detection, split from task 1's lib on trigger and failure mode: this one
  does guarded I/O against `.planning/` and returns warnings, task 1's is pure
  and returns matches. Model it on `lib/config-merge.mjs`, the existing
  fs-touching lib that both seams share. It imports `parseCursor` and
  `readFrontmatterList` from `./planning-files.mjs` - the ONE place a `.planning`
  grammar lives - and adds none of its own. Export `cursorPhase(planningRoot)`:
  read `<planningRoot>/STATE.md`, return `parseCursor`'s `phase` or null on any
  read/parse failure, silently (an absent STATE.md is the ordinary pre-project
  state). Export `declaredPhaseFiles(planningRoot, phase)` returning
  `{files, warnings}`: list `<planningRoot>/phases/<phase>/`, keep entries
  matching `/^PLAN(-\d+)?\.md$/` sorted lexicographically (a split phase has
  PLAN-1.md and PLAN-2.md and both declare files), read each, and union
  `readFrontmatterList(text, 'files').items` across them. `phase` is rendered
  with `String()`
  so a decimal cursor phase (`2.1`, which `parseCursor` returns as a Number and
  `planning-files.mjs` documents as a real state) addresses `phases/2.1/`.
  Fail-open rules, all of them (D-08): a missing planning root, a missing
  `phases/<N>/` directory and a directory holding no PLAN file each return
  `{files: [], warnings: []}` - a phase with no plan yet is the normal pre-plan
  state, so warning about it would fire on every `/cad-context` dispatch of
  every project; a PLAN file whose read THROWS contributes no paths and adds one
  warning naming the file and the error code; a PLAN whose
  `readFrontmatterList` returns a non-empty `issues` array contributes NO paths
  and adds one warning naming the file and the first issue. D-08 is explicit
  that an unreadable PLAN frontmatter fails open to the BASELINE bundle, and the
  "Must be true when done" line above says the same, so salvaging whatever
  half-parsed is a third behaviour neither one allows: it floors a phase off a
  path list the grammar already rejected. A half-parsed `files:` list is an
  unresolvable input, not a shorter one. Never throw: every fs call is inside
  its own try.

  Read the FRONTMATTER `files:` list only, via
  `readFrontmatterList(text, 'files')` - not `parsePlanFiles`'s union. D-01
  names "the phase's declared PLAN `files:` frontmatter" specifically, and
  `parsePlanFiles` (`lib/planning-files.mjs:1299-1315`) unions that list with
  every `- **Files:**` task line in the body. Under the union a PLAN whose
  frontmatter declares only `README.md` still floors the whole phase to
  `critical` because one implementation task happens to name
  `src/auth/session.rs` - detection driven by incidental task prose rather than
  by the curated declaration D-01 locked. The union's "safe direction" argument
  does not survive that: over-flooring on prose trains the user to waive by
  reflex, which is the same failure mode this plan's own token exclusions above
  exist to prevent. Write
  `phase-plans.test.mjs` against temp fixtures built with `mkdtempSync`: a phase
  with one PLAN returning its declared files; a phase with PLAN-1.md and
  PLAN-2.md returning the union; a missing phase directory returning empty with
  no warning; an unreadable PLAN (`chmodSync(file, 0o000)`, guarded
  `{skip: process.getuid?.() === 0}` the way
  `cadence-core/bin/self-verify.test.mjs:398` guards its unreadable-file row)
  returning empty plus one warning naming the file; a PLAN with out-of-grammar
  frontmatter returning EMPTY plus one warning (the D-08 arm above - assert the
  files array is empty, not merely that a warning fired); a PLAN whose
  frontmatter `files:` omits a path that a `- **Files:**` task line names,
  asserting the task-line path is ABSENT from the result (the D-01 arm - this
  row is what keeps a later refactor from quietly restoring the union); a
  STATE.md
  cursor returning its phase; and a missing/garbled STATE.md returning null.
- **Verify:** `node --test cadence-core/bin/phase-plans.test.mjs` exits 0;
  `node -e "import('./cadence-core/bin/lib/phase-plans.mjs').then(m=>console.log(JSON.stringify(m.declaredPhaseFiles('.planning', 3))))"`
  run from the repo root prints this repo's phase-3 plan file list (it contains
  `cadence-core/route-table.json`) with an empty `warnings` array, and
  `cursorPhase('.planning')` prints `4`; and `npx tsc -p tsconfig.ci.json`
  exits 0.

### Task 3: resolve the floor in route.mjs behind --phase and the cursor

- **Files:** cadence-core/bin/route.mjs, cadence-core/bin/route.test.mjs,
  cadence-core/bin/self-verify.mjs
- **Action:** Teach `parseArgs` a `--phase` flag (stored raw) and add `--phase`
  to `self-verify.mjs`'s `CONTRACTS['route.mjs'].resolve` list, or every
  documented invocation in task 8 becomes an `unknown-flag` problem. In
  `resolve`, AFTER `readConfig` and BEFORE the `TABLE.cells[cfg.stakes]` lookup
  at `route.mjs:115`, compute the floor: skip the whole computation for the two
  pre-PLAN roles (see the D-09 arm below); derive the planning root as
  `dirname(opts.file)` (the default `--file` is `.planning/config.json`, so the
  default root is `.planning`); take the phase from `--phase` when it matches
  `/^\d+(\.\d+)?$/`, and when `--phase` was PASSED but does not match, resolve at
  the baseline with the warning below and do NOT fall through to the cursor -
  falling through would answer a typo with a floor computed from a different
  phase, which is worse than the value the user typed. Only an ABSENT `--phase`
  reaches `cursorPhase(root)`. Then call
  `declaredPhaseFiles(root, phase)` and `matchSurfaces(files, TABLE.surfaces)`;
  drop every match the config waives (task 5 supplies that arm - here the match
  list is used whole); and set the effective level to
  `raiseTo(cfg.stakes, highest floor among the matches, TABLE.stakes_order)`,
  where "highest" is the match whose floor sits latest in `stakes_order`. Use
  that EFFECTIVE level for the `cells`, `review` and `verify` lookups, for the
  emitted `stakes` field, for the level named in the gate-disagreement
  warning string and for the level named in the model-pin reason at
  `route.mjs:203` (`wins over the ${cfg.stakes}/${opts.role} cell`) - that
  string names a cell the resolve did not read once a floor applied, the same
  defect class as the line below - and keep the baseline in `reason` - a bundle that reports the
  baseline level while dispatching the floored cell is worse than no floor. A
  `--phase` value outside that shape does NOT return `{ok:false, reason:'usage'}`
  the way a bad `--attempt` does: it resolves at the baseline with `ok:true`
  plus one warning naming the rejected value, because `{ok:false}` makes the
  caller dispatch the base agent at the session default
  (`cadence-core/references/seams.md:111-112`), which routes a possibly-risky
  phase LOWER than its own baseline - the inversion D-08 exists to prevent.
  D-09 by ROLE, not by mechanism alone: `cad-planner` and
  `cad-assumptions-analyzer` skip the floor computation outright and resolve at
  the project baseline. "No PLAN yet, so no floor" delivers D-09 only when the
  cursor names the phase being dispatched, and it does not:
  `cadence-core/workflows/context.md:315` sets the cursor at the END of
  /cad-context while `:105` dispatches `cad-assumptions-analyzer` well before
  it, so during `/cad-context 5` the cursor still reads phase 4 and the analyzer
  would be floored off phase 4's PLAN - a floor computed from a different
  phase's file list, which D-09 forbids and which no `reason` string would
  reveal as wrong. The same staleness routes the OTHER direction on any phase
  whose cursor lags, silently unflooring it. Two named roles is one rule with
  D-09 behind it, not a second rule with no decision behind it.
  Reason entries: every floor-related entry starts with the literal prefix
  `risk floor:` so a caller and a test can assert its presence or absence with
  one match. A raise pushes `risk floor: phase <N> surface "<s>" matched <path>
  (pattern "<p>"); stakes <baseline> -> <effective>`. A match that does NOT
  raise (the baseline already sits at or above the floor) pushes `risk floor:
  phase <N> surface "<s>" detected (floor <f>); baseline <baseline> already at
  or above it` and changes no knob - that is criterion 3, the raise-never-caps
  behaviour. No match, no phase and no plan push NOTHING: an entry saying
  nothing fired would appear on every dispatch of every phase for the life of
  every project. Name only values that are identical between the two entry
  points - the phase number, the surface, the path, the pattern - and NEVER how
  the phase was obtained, because AC1 requires the `--phase N` bundle and the
  cursor-fallback bundle to be identical. Spread `declaredPhaseFiles`'s warnings
  onto the existing `warnings` array. Add hand-written rows to
  `route.test.mjs`, each building a temp planning root (a `phases/<N>/PLAN.md`
  with a `files:` frontmatter list, and a `STATE.md` rendered through
  `renderCursor`) in its OWN `mkdtempSync` directory with its config written
  inside that same directory - never through the existing `cfg()`/`rawCfg()`
  helpers. Those write into the single module-level `dir`
  (`route.test.mjs:13,24-32`) that every existing row already shares, and the
  planning root is `dirname(opts.file)`, so one floor fixture dropping a
  `STATE.md` and a `phases/<N>/PLAN.md` there would put every other row in the
  file - including all 18 `cell <stakes>/<role>` cases at `:106-120` - behind a
  cursor pointing at an auth-declaring PLAN, resolving them `critical` and
  failing assertions that have nothing to do with this phase. Add a
  `planningRoot(files, {phase, cursor, config})` helper that returns a fresh
  root per call. Every row passes
  `CADENCE_GLOBAL_CONFIG` at the existing `NO_GLOBAL` path - this machine's real
  global layer sets `review.triggers.phase_diff.gate`, so a non-hermetic row's
  warning-count assertion lies: a `solo` config plus a PLAN declaring
  `src/auth/session.rs` resolving `stakes:"critical"` with the critical cell's
  `model`, `effort`, `review` and `verify` and a `reason` entry matching
  `/risk floor:/`, `/auth/` and `/session\.rs/`; the same fixture with no
  `--phase` and a cursor pointing at that phase returning a deep-equal bundle;
  a PLAN declaring only `README.md` resolving `solo` with no `risk floor:`
  entry; a phase directory with no PLAN file, and a root with neither cursor nor
  `--phase`, both resolving `solo` with `ok:true`, no floor entry and no
  warnings; an unreadable PLAN resolving `solo` with `ok:true` and exactly one
  warning naming the file; `--phase notanumber` against a root whose cursor DOES
  point at the auth-declaring phase resolving `solo` with `ok:true`, one warning
  naming the value and NO `risk floor:` entry - the row that pins the
  no-fallthrough rule, and the one that fails if a later edit reorders the two
  arms; `cad-planner` and `cad-assumptions-analyzer` each resolving at the
  baseline with no `risk floor:` entry against the same fixture that floors
  `cad-executor` to `critical`, passing `--phase` explicitly so the row proves
  the ROLE arm rather than an absent phase (the D-09 pair); and - injected
  through
  `CADENCE_ROUTE_TABLE`, a copy of the shipped table whose `surfaces.auth.floor`
  is `shipped` - a `critical` baseline resolving `critical` with a
  `risk floor: ... already at or above it` entry and every critical knob intact.
  That injected row is the only way to exercise `raiseTo`'s cap-never branch,
  since every shipped row floors to the top rung (D-03).
- **Verify:** `node --test cadence-core/bin/route.test.mjs` exits 0; with a
  scratch tree holding `p/config.json` = `{"stakes":"solo"}` and
  `p/phases/9/PLAN.md` whose frontmatter `files:` lists `src/auth/login.rs`,
  `CADENCE_GLOBAL_CONFIG=/nonexistent node cadence-core/bin/route.mjs resolve
  --role cad-executor --file p/config.json --phase 9` prints `"stakes":"critical"`,
  `"model":"opus"`, `"effort":"xhigh"` and a `reason` entry containing
  `risk floor:` and `auth`; the same command with `--phase 8` (no such phase)
  prints `"stakes":"solo"` and no `risk floor:` entry; and
  `npx tsc -p tsconfig.ci.json` exits 0.

### Task 4: declare and refuse the per-surface override at the write face

- **Files:** cadence-core/config.schema.json, cadence-core/bin/config.mjs,
  cadence-core/bin/config.test.mjs, cadence-core/bin/self-verify.mjs,
  cadence-core/workflows/config.md, cadence-core/bin/weight-budgets.json
- **Action:** Add eight `risk.override.<surface>` keys to
  `config.schema.json` - one per surface name in task 1's table, spelled out as
  eight explicit keys rather than a pattern, exactly as
  `model.overrides.<role>` already is - each `{"type": "bool", "default": false,
  "src": "repo"}` with a `purpose` naming what it waives and that it lowers the
  floor for that surface ALONE. Then ENFORCE that `src` for these eight keys
  specifically: a `set` targeting the global layer (`--global`, or any `--file`
  resolving to `GLOBAL_CONFIG`) is refused with a message naming the key and
  saying the waiver is repo-scoped. `src` is schema metadata that nothing in
  `bin/` reads today, so without this arm one
  `config.mjs set risk.override.auth=true --global` waives the auth floor in
  every repository on the machine, forever, with nothing in any of those repos
  recording it - a silent lowering, which is the exact inversion the phase goal
  names. Enforcing `src` generally is phase 6's shape (a key resolved and then
  thrown away) and is NOT in scope here; this is one narrow refusal on the one
  key family whose whole purpose is to lower a floor. In `config.mjs`'s `checkPairs`, immediately
  after the `retiredKeyError` call and BEFORE the `SCHEMA[key]` lookup (the same
  placement and the same reason the retired-key check states: the generic
  `unknown key` arm would answer a misspelled surface with nothing the user can
  act on), call `surfaceKeyError(key, Object.keys(SCHEMA))` from
  `lib/risk-surfaces.mjs` and push its string as the error when it returns one.
  Make the same call in `validate`'s per-leaf loop before its own `unknown key`
  arm, so the whole-file face and the write face give one message rather than
  two - a value refused at `set` with one message and named differently at
  `validate` is the drift this repo keeps closing. In `self-verify.mjs`, derive
  `SURFACES` from the schema keys under `risk.override.` the same way `TRIGGERS`
  and `PROVIDERS` are derived, and add a `<surface>` substitution to `expand()`
  so prose writing `risk.override.<surface>` expands across all eight keys in
  both directions of check 1. Add one row to `workflows/config.md`'s cheat-sheet
  table, in the shape of the `review.triggers.<t>.gate` row:
  `` `risk.override.<surface>` `` `[repo]`, bool, "Waive the detected risk floor
  for ONE surface", values column naming the eight surface names, default
  `false`. Regenerate that file's `weight-budgets.json` entry from
  `node cadence-core/bin/weight.mjs`, taking the measured byte count verbatim -
  exact fit, never rounded up, since a loose entry pre-approves unaudited growth.
  Add `config.test.mjs` rows: `set risk.override.auth=true` writing the nested
  key; `check risk.override.notasurface=true` failing with an error string
  listing every accepted surface name; `check risk.override.auth=yes` failing on
  the bool type; `validate` on a file holding a bogus surface key reporting
  the same listing message rather than `unknown key`; and
  `set risk.override.auth=true --global` (pointed at a temp global path) failing
  with a message naming the key and its repo scope, beside a control row proving
  the same set SUCCEEDS against a repo-scoped `--file`.
- **Verify:** `node cadence-core/bin/config.mjs check risk.override.auth=true`
  prints `"ok":true`;
  `node cadence-core/bin/config.mjs set risk.override.athu=true --file /tmp/x.json`
  prints `"ok":false` with a detail naming `auth`, `secrets` and the other six
  accepted surfaces; `node cadence-core/bin/self-verify.mjs` prints `"ok":true`
  with no `inert-config-key`, no `unknown-config-key` and no `budget-overrun`;
  and `node --test cadence-core/bin/*.test.mjs` exits 0.

### Task 5: waive the floor per surface at resolve time

- **Files:** cadence-core/bin/route.mjs, cadence-core/bin/route.test.mjs
- **Action:** In `readConfig`, collect the merged config's `risk.override.*`
  entries the way `triggerGatesIn` collects per-trigger gates - defensively, a
  scalar where an object belongs contributing nothing - and return them as
  `riskOverrides` keyed by surface name. The field name is NOT `overrides`:
  `readConfig` already returns `overrides: m.overrides ?? {}` at
  `route.mjs:66`, read at `route.mjs:197` as `cfg.overrides[opts.role]` for the
  per-role model pin. Reusing the name replaces that map with surface keys,
  making every `model.overrides.<role>` pin resolve `undefined` and silently
  regressing phase 3's shipped AC4 - and a config setting both a pin and a
  waiver would have the two writers fight over one field. In `resolve`, filter
  task 3's match list:
  a surface whose key is strictly `true` is dropped from the set and named in
  `reason`; any other non-`false`, non-null value does NOT waive and adds one
  warning naming the key and the value, mirroring the unknown-alias arm at
  `route.mjs:207` - a typo must not silently lower a floor any more than it may
  silently redirect a model. A `risk.override.<name>` naming a surface the table
  does not declare adds one warning naming the key and the accepted names, since
  a waiver that matches nothing is a value resolved and thrown away. The floor
  then comes from the SURVIVING matches, so waiving one of two detected surfaces
  still floors, and the level drops to the baseline only when every detected
  surface is waived (D-05). Reason entries keep the `risk floor:` prefix: a
  partial waiver pushes `risk floor: risk.override.<s> waives "<s>"` alongside
  the raise entry for the surface still standing; a full waiver pushes
  `risk floor: waived by risk.override.<a>, risk.override.<b> - every detected
  surface is named; stakes stays <baseline>` and no raise entry, so the waived
  names survive in the record rather than the floor vanishing without a trace.
  Add `route.test.mjs` rows against a fixture PLAN declaring two paths that
  match two DIFFERENT surfaces (for example `src/auth/login.rs` and
  `db/migrations/001.sql`): no override resolving `critical`; one override
  resolving `critical` with the waived name and the surviving surface both in
  `reason`; both overrides resolving `solo` with `reason` naming each waived
  surface and no raise entry; an override set to a non-boolean still resolving
  `critical` with one warning; an override naming an undeclared surface
  resolving `critical` with one warning; and the coexistence row that guards the
  field-name split above - a config carrying BOTH `risk.override.auth: true` and
  `model.overrides.cad-executor: "haiku"`, asserting `pinned: true` with
  `model: "haiku"` AND the waiver applied, which fails against any
  implementation that folds the two into one field. Build every row through task
  3's `planningRoot` helper with a verbatim config body, not through the shared
  `cfg`/`rawCfg` helpers: these rows need a planning root beside the config for
  the same reason task 3's do, and `cfg` shapes everything but `stakes` under
  `model` anyway.
- **Verify:** `node --test cadence-core/bin/route.test.mjs` exits 0; against the
  task-3 scratch tree with `p/config.json` = `{"stakes":"solo","risk":{"override":{"auth":true}}}`,
  `CADENCE_GLOBAL_CONFIG=/nonexistent node cadence-core/bin/route.mjs resolve
  --role cad-executor --file p/config.json --phase 9` prints `"stakes":"solo"`
  with a `reason` entry naming `risk.override.auth`, and the same command with
  the override set to `"true"` (the string) prints `"stakes":"critical"` with a
  warning naming the key.

### Task 6: walk the surface vocabulary in self-verify, both directions

- **Files:** cadence-core/bin/lib/route-cells.mjs,
  cadence-core/bin/route-cells.test.mjs, cadence-core/bin/self-verify.mjs,
  cadence-core/bin/self-verify.test.mjs
- **Action:** Extend `lib/route-cells.mjs` - already "the ONE statement of what
  makes `route-table.json` well-formed", and the `surfaces` block is part of that
  file - with `surfaceIssues(table, {levels, overrideSurfaces, gates})` returning
  the same `{code, detail}` shape, every detail NAMING THE ROW. Codes:
  `unknown-floor` for a surface whose `floor` is not one of the caller's
  `levels`, or is missing or not a string; `bad-pattern` for a surface whose
  `patterns` is absent, not an array, empty, or holds an entry that is not a
  non-empty `[a-z0-9]+` token (an entry carrying a slash, a dot or an uppercase
  letter can never equal a token `pathTokens` produces, so it is an inert
  pattern - a silently unfloored surface, which is the same defect class as the
  gate hole this phase closes); `missing-override-key` for a surface the table
  declares with no `risk.override.<surface>` entry in `overrideSurfaces`;
  `undeclared-risk-surface` for an `overrideSurfaces` name the table declares no
  row for; and `floor-below-required` for a row whose `floor` is not the
  caller's OPTIONAL `requiredFloor`, checked only when the caller passes one.
  That option is what enforces D-03's other half - "every shipped `surfaces` row
  carries `floor: \"critical\"`" - which nothing else in this plan checks:
  `unknown-floor` accepts any value in `levels`, so editing a shipped row to
  `floor: "shipped"` passes the table check, passes the schema, passes task 1's
  count-only verify and passes every route row that does not happen to exercise
  that surface, leaving a declared risk surface quietly flooring one rung below
  the level D-03 locked. It is an option rather than a fixed rule because the
  lib must still tolerate the sub-top floor task 3 injects through
  `CADENCE_ROUTE_TABLE` to exercise `raiseTo`'s cap-never branch; only
  self-verify, which reads the shipped tree, passes `requiredFloor`. Add two codes the acceptance criteria do not name and the new data
  makes mandatory, for the reason phase 3's `rung-demotion` was mandatory - a
  vocabulary duplicated across two files with no guard drifts silently:
  `stakes-order-drift` when `table.stakes_order` is not element-for-element
  equal to the caller's `levels` (the resolver compares floors by index in that
  array, so a drifted order silently reorders the whole ladder), and
  `gate-vocabulary-drift` when `table.gates` is not element-for-element equal to
  the caller's `gates` (task 7 refuses a user gate against `table.gates`; a
  drifted list would refuse a gate `config.mjs set` accepts). Take the
  vocabulary from the CALLER, never off the table, so this lib never grows a
  second opinion about the accepted names. In `self-verify.mjs`'s check 8, call
  `surfaceIssues` beside the existing `cellIssues` call with `levels` from the
  schema's `stakes` enum values, `gates` from the `review.triggers.plan.gate`
  enum values (both already read there), `overrideSurfaces` from task 4's
  `SURFACES` and `requiredFloor` as the LAST element of the schema's `stakes`
  enum (never the literal `"critical"` - the level names come from the schema
  everywhere else in this check, and a hardcoded copy here is the vocabulary
  drift task 6 exists to catch), filing each issue against
  `cadence-core/route-table.json`, and add `risk-surfaces` to the `checked`
  string. Add `route-cells.test.mjs` rows: one
  per code, each asserting the code AND that the detail names the offending
  surface; a well-formed surfaces block yielding no issues; a table with NO
  `surfaces` block yielding no issues (a fixture table need not carry one, the
  same tolerance `cellIssues` gives an absent vocabulary); and one row proving
  two faults in different rows report twice rather than short-circuiting. Add
  `self-verify.test.mjs` rows for each of the four AC5 classes end to end, built
  by extending the existing `cellTable` helper with a `surfaces` block and an
  `overrideSurfaces`-shaped schema, asserting `ok:false` and the named row, plus
  one row proving `risk.override.<surface>` prose covers every surface key in
  check 1's reverse direction (the shape
  `cadence-core/bin/self-verify.test.mjs:190`'s `<t>` row already uses).
- **Verify:** `node cadence-core/bin/self-verify.mjs` prints `"ok":true` on the
  shipped tree with `risk-surfaces` in `checked`; with each mutation applied one
  at a time to `cadence-core/route-table.json` - `surfaces.auth.floor` set to
  `ludicrous`, `surfaces.auth.floor` set to the valid-but-too-low `shipped`
  (the `floor-below-required` arm; `shipped` is a level the enum accepts, so
  this mutation fails ONLY if `requiredFloor` actually reached the lib),
  `surfaces.auth.patterns` set to `[]`, a
  `surfaces.frobnicate` row added, and the `auth` row deleted (which leaves its
  schema key orphaned) - it prints `"ok":false` with a detail naming `auth` or
  `frobnicate`, reverting each mutation before the next; and
  `node --test cadence-core/bin/*.test.mjs` exits 0.

### Task 7: close the gate-enum hole the floor's own axis rides on

- **Files:** cadence-core/bin/route.mjs, cadence-core/bin/route.test.mjs
- **Action:** In `resolve`'s review walk (`route.mjs:178-187`), check a config
  gate against `TABLE.gates` before it can win: when a layer set a gate for a
  trigger and the value is not a string in `TABLE.gates`, take the LEVEL's gate
  and push one warning naming the trigger, the rejected value and the level gate
  that stands - the same treatment `route.mjs:199` already gives an unknown model
  alias, and the shape D-06 names. A valid gate that disagrees still wins and
  still warns exactly as phase 3's D-04 left it: this task adds a validity check
  in front of that precedence and changes no part of it. When `TABLE.gates` is
  absent or not a non-empty array of strings, fall back to a module-level
  `DEFAULT_GATES` constant in `route.mjs` holding the same four values and check
  against THAT - never skip the check. Skipping leaves AC6 open on exactly the
  tables most likely to be wrong: an older or hand-edited `route-table.json`, or
  one injected through `CADENCE_ROUTE_TABLE`, carries no `gates` array, so a
  `"blockign"` typo would still reach the bundle intact on the very input shape
  the fix exists to cover. Task 6's `gate-vocabulary-drift` catches a DRIFTED
  list on the shipped tree at self-verify time; it is not in the resolve path
  and cannot make a skipped runtime check safe. The constant also decouples this
  task from task 1 - with it, task 7 depends on nothing else in the plan and can
  genuinely land first - while `TABLE.gates` stays the source of truth whenever
  it is present, so the table remains the editable vocabulary and task 6 still
  guards it against the schema. Update the
  `review.triggers.*.gate` line in the file's header config-key comment to say
  the value must be one of the table's gates. Add `route.test.mjs` rows: the
  CONTEXT-cited repro `{"stakes":"critical","review":{"triggers":{"risk_surface":
  {"gate":"blockign"}}}}` resolving `review.risk_surface` to `blocking` with
  exactly one warning matching `/blockign/` - today this resolves `ok:true`
  carrying `"blockign"`, so the row is failing-capable against the current code;
  a non-string gate (a number, `true`, an object) taking the same path; a valid
  disagreeing gate still winning with the phase-3 warning unchanged; a valid
  agreeing gate still emitting no warning; and the same `"blockign"` repro run
  against a `CADENCE_ROUTE_TABLE` copy with `gates` DELETED, still resolving
  `blocking` with the warning - the row that proves the fallback rather than the
  skip, and the row that fails if a later edit restores the skip.
- **Verify:** `node --test cadence-core/bin/route.test.mjs` exits 0; with
  `/tmp/g.json` = `{"stakes":"critical","review":{"triggers":{"risk_surface":{"gate":"blockign"}}}}`,
  `CADENCE_GLOBAL_CONFIG=/nonexistent node cadence-core/bin/route.mjs resolve
  --role cad-reviewer --file /tmp/g.json` prints `"risk_surface":"blocking"` and
  a warning containing `blockign`; and reverting only the new check makes that
  same command print `"risk_surface":"blockign"`.

### Task 8: state the floor in the seams, the trigger reference and the docs

- **Files:** cadence-core/references/seams.md,
  cadence-core/references/review-triggers.md, INTERNALS.md, CHANGELOG.md
- **Action:** In `seams.md`'s Routing section, add `[--phase <N>]` to the
  invocation block and one paragraph stating: the resolve reads the phase's
  declared PLAN `files:` and raises the stakes level to a matched risk surface's
  floor; the phase comes from `--phase` or from the STATE cursor, so an existing
  call site keeps working; the floor RAISES and never caps, and never blocks -
  every unresolvable input resolves at the baseline with `ok:true`. Add a bullet
  beside the existing "Tell the user when a pin fires" one, on the same
  reasoning and scoped the same way: when `reason` carries a `risk floor:` entry
  that raised the level, say so on its own line before spawning - "dispatching
  cad-executor at critical (risk floor: auth)" - because the approval dialog
  shows neither the level nor the reason, and a floor the user never sees is the
  resolved-then-dropped shape this milestone exists to close. Name
  `risk.override.<surface>` as the waiver and say it waives ONE surface. In
  `review-triggers.md`'s "risk_surface detection" section, correct the two
  sentences at `:170-173` that are now false: the prose list still defines the
  `critical` stakes value AND a machine translation of it now lives in
  `route-table.json`'s `surfaces` block, where a path match against the phase's
  PLAN raises the level at dispatch time. State plainly that TWO detectors now
  exist and neither replaces the other - a path match at dispatch (coarse, no
  diff in hand, sets the floor) and this section's model judgment at commit time
  (reads the diff, fires the trigger) - and that the two pre-filters below apply
  to the commit-time judgment only, because the dispatch-time floor has no diff
  to judge; the per-surface override is its escape hatch instead. Write "risk
  surface" as prose there and in every linted surface, never a dotted `risk.`
  token, or self-verify's check 1 reads it as a config key. In `INTERNALS.md`'s
  "Model routing" section, add the floor to the guardrail list - the stakes
  answer picks the row unless the phase's own plan touches a declared risk
  surface, in which case the level is raised, the reason says which surface and
  which file, and lowering it back takes a named per-surface override - and add
  `cadence-core/bin/lib/risk-surfaces.mjs` to the "Read the code" line (a
  backticked repo path there is checked to exist by check 3b). In
  `CHANGELOG.md`'s `## [Unreleased]` section add `### Added` entries for the
  computed floor (the `surfaces` block, `--phase` with the cursor fallback, the
  `risk.override.<surface>` waiver, the self-verify surface walk) and a
  `### Fixed` entry for the gate-enum hole, stating that a
  `review.triggers.<t>.gate` outside the four values used to reach the bundle
  intact and now loses to the level's gate with a warning. No
  `weight-budgets.json` entry changes here: `references/*.md`, `INTERNALS.md`
  and `CHANGELOG.md` are not in the manifest (task 4 owns the one budgeted
  surface this phase edits).
- **Verify:** `node cadence-core/bin/self-verify.mjs` prints `"ok":true` with
  `problems: []` - README/INTERNALS and both references are linted surfaces, so
  an invented key, flag or path fails here, and this is the check that proves
  the `--phase` CONTRACTS entry from task 3 covers the prose written in this
  task; `grep -n "risk floor" cadence-core/references/seams.md` shows the relay
  bullet; `node --test cadence-core/bin/*.test.mjs` exits 0; and
  `npx tsc -p tsconfig.ci.json` exits 0.

## Notes

- **Plan shape deviation.** CONTEXT's `Plan shape` line asks for multiple plans
  in one phase, reasoning that the AC6 gate fix is independent of the floor.
  This is ONE plan, because the independence test is the hard constraint and the
  two arms share files: the gate fix edits `cadence-core/bin/route.mjs`'s review
  walk and adds rows to `cadence-core/bin/route.test.mjs`, and the floor arm
  edits those same two files in tasks 3 and 5. Two tasks, not four - an earlier
  draft of this note said four, and the task Files lines refute it (tasks 1, 2,
  4, 6 and 8 name neither file). The overlap is smaller than claimed and still
  decisive: split plans that touch one file cannot run in parallel and cannot
  merge cleanly, which is exactly what the independence test forbids, and it is
  the reason a split cannot be recovered by ordering the two plans either.
  So the gate fix is its own TASK (7) instead - independently verifiable,
  individually landable, and genuinely reorderable ahead of the floor tasks now
  that its `DEFAULT_GATES` fallback removes the dependency on task 1's
  `TABLE.gates`. That dependency was real when this note was first written and
  was the plan's own creation, not the gate fix's; task 7 no longer has it.
- **The two pre-filters have no floor equivalent, deliberately.** CONTEXT's
  flagged assumptions leave this to the planner.
  `references/review-triggers.md:175-195`'s gitignored-target and
  placeholder-secret drops are judgments about diff CONTENT, and the floor runs
  at dispatch time with no diff in hand; approximating them from a path would
  mean guessing that `*.env.example` holds no real key, which is exactly the
  guess the second pre-filter refuses to make on its own. So a phase whose PLAN
  lists an example env file DOES floor to `critical`, and `risk.override.secrets`
  is the stated way out. The cost is one deliberate keystroke; the alternative
  is a path-shaped exemption that silently unfloors a real secret sitting in a
  file named like a sample.
- **D-09 is implemented by ROLE, not by the no-PLAN mechanism alone.** An
  earlier draft of this plan relied on "no `files:` list exists before
  `/cad-plan` runs" and treated a role exclusion as a second rule with no
  decision behind it. The mechanism does not deliver D-09 on its own: it holds
  only when the STATE cursor names the phase being dispatched, and
  `cadence-core/workflows/context.md` dispatches `cad-assumptions-analyzer` at
  `:105` while setting the cursor at `:315`, so `/cad-context 5` runs the
  analyzer with the cursor still reading phase 4 and would floor it off phase
  4's PLAN. That is not a safe-direction superset - it is a floor computed from
  a different phase's file list, invisible in `reason`, and the same staleness
  silently UNFLOORS a phase whose cursor lags. So task 3 skips the floor for
  `cad-planner` and `cad-assumptions-analyzer` by name. D-09 states that role
  behaviour outright, so naming the roles is that decision written down, not a
  new one. A replan of an already-planned phase therefore leaves its planner at
  the baseline too, which is what D-09 says.
- **`surfaces` is an overloaded word in this tree.** `lib/surface-weight.mjs`,
  `unbudgeted-surface` and `unreadable-surface` all mean PROSE surfaces. The
  block name `surfaces` in `route-table.json` is locked by CONTEXT, so the new
  lib is `risk-surfaces.mjs`, the new self-verify problem code is
  `undeclared-risk-surface`, and prose says "risk surface" in full.
- **Prior art applied.** `.planning/CAPTURE.md` (phase 3, confirmed) is the
  source of task 7's repro: a `"blockign"` typo silently replaces `critical`'s
  deliberately-`blocking` `risk_surface` gate, and `route.mjs:199` is the shape
  the fix copies. `.planning/phases/3/SUMMARY.md` records that anything outside
  `roles[]` and the stakes enum is checked by nothing, which is why task 6 walks
  the new vocabulary in both directions rather than trusting it. Phase 3's
  `rung-demotion` precedent is why task 6 adds two codes no acceptance criterion
  asked for.
- **Hermeticity is load-bearing in every test row and every hand check.** This
  machine's user-global config sets `review.triggers.phase_diff.gate`, so every
  `route.mjs resolve` run without `CADENCE_GLOBAL_CONFIG` pointed somewhere
  absent emits one gate-disagreement warning, and AC2's "no warning" clauses read
  as failures against a correct tree. An EMPTY config file parses as a torn layer
  and adds its own warning, so use a nonexistent path, never an empty one.
