---
phase: 2
plan: 1
requirements: ["#42", "#45"]
files: ["cadence-core/bin/lib/require-int.mjs", "cadence-core/bin/require-int.test.mjs", "cadence-core/bin/planning.mjs", "cadence-core/bin/planning.test.mjs", "cadence-core/bin/route.mjs", "cadence-core/bin/route.test.mjs", "cadence-core/bin/config.mjs", "cadence-core/bin/lib/config-merge.mjs", "cadence-core/bin/config.test.mjs"]
---

# Phase 2: Seam input validation - Plan

## Goal

A shared seam-flag validator rejects bad input types (NaN `--total`, valueless
`--reqs`, bad `--attempt`, scalar config) with a clean `bad-args`/`usage` result
before any write or merge, so no bad flag can corrupt STATE.md or pass config
validation.

## Must be true when done

- `planning.mjs cursor set ... --total abc` exits `ok:false reason:"bad-args"`
  and writes no `Phase: N of NaN` line to STATE.md; a valid `--total 4` still
  writes and reports `ok:true`.
- `planning.mjs phase-done` with a valueless `--reqs` exits `ok:false
  reason:"bad-args"` (never `reason:"internal"`); a real `--reqs FIX-01,FIX-02`
  still parses to the id list.
- `route.mjs resolve --role plan --attempt abc` exits `ok:false
  reason:"usage"` (pre-fix it silently coerces the NaN to `ok:true, attempt:1`);
  a numeric `--attempt 2` resolves normally.
- `config.mjs validate` on a file whose entire content is `42` exits `ok:false`
  reporting the non-object top-level (never `ok:true, checked:0`); a normal
  object config still validates `ok:true`.
- `config.mjs get` (and route's read path) with a scalar `.planning/config.json`
  falls back to global+default values rather than returning `42` at
  `source:"repo"`.
- Each of #42, #45.1, #45.2, #45.3 has a test that reproduces the pre-fix
  behavior and asserts the corrected behavior, and
  `node --test cadence-core/bin/*.test.mjs` passes.

## Context

Locked decisions from CONTEXT.md bind this plan: D-01 (a shared `requireInt`
helper in `bin/lib/` covers the two NaN cases that share shape - `--total` in
planning.mjs and `--attempt` in route.mjs; the valueless `--reqs` and scalar-
config cases stay separate inline/shape guards). D-02 (scalar config closes both
faces: an object-shape check in `config.mjs validate` AND a top-level guard on
the merge read path in `config-merge.mjs`). D-03 (bad `--attempt` surfaces
through route's existing `reason:'usage'`, no new `bad-args` string). D-04 (all
four validations fail before any write/merge, seam stays non-fatal - one
`{ok:false, reason, detail}` JSON line, no raw stack trace, mirroring the phase-1
seam contract). D-05 (`cursor set --name` stays unguarded - out of scope). Out
of scope: the wider phase-1 malformed-*layer* residue (this guards only a scalar
*top-level*); no self-verify CONTRACTS change (the flags already exist there).
Tests are zero-dep `node:test` siblings in `bin/`, run via `execFileSync` against
the seam scripts (see the `run`/`resolve` helpers already in each test file).

## Tasks

### Task 1: Add the shared requireInt numeric-flag helper

- **Files:** cadence-core/bin/lib/require-int.mjs, cadence-core/bin/require-int.test.mjs
- **Action:** Create `require-int.mjs` exporting `requireInt(raw)` returning
  `{ ok: true, value: <int> }` when `raw` is a string that parses to an integer,
  else `{ ok: false }`. Reject: a non-string (catches parseArgs' boolean `true`
  from a valueless flag), an empty/whitespace-only string, and any value where
  `Number(raw.trim())` is `NaN` or not `Number.isInteger`. Accept a leading sign
  and surrounding whitespace (`"4"`, `" -2 "` -> ok). Keep it dependency-free and
  side-effect-free (no emit, no I/O) - callers own their reason string, so the
  helper never picks `bad-args` vs `usage` (D-01/D-03). Add a header comment
  naming it the shared seam numeric-flag guard for `--total` (#42) and
  `--attempt` (#45.2). In `require-int.test.mjs` (import the helper directly,
  mirror `bm25.test.mjs`'s in-process style) assert: `"4"`->`{ok:true,value:4}`,
  `" -2 "`->ok:-2, `"abc"`/`""`/`"  "`/`"4.5"`/`"4abc"`->`{ok:false}`, and a
  boolean `true` / `undefined` ->`{ok:false}`.
- **Verify:** `node --test cadence-core/bin/require-int.test.mjs` passes.

### Task 2: Guard cursor set --total with requireInt (#42)

- **Files:** cadence-core/bin/planning.mjs, cadence-core/bin/planning.test.mjs
- **Action:** In `planning.mjs` import `requireInt` from `./lib/require-int.mjs`.
  In `cmdCursorSet`, replace the `let total = opts.total ? Number(opts.total) :
  undefined;` line (around 176): when `'total' in opts`, run `requireInt(opts.total)`
  and if it fails `return fail('bad-args', 'cursor set --total needs an integer')`
  BEFORE any derivation or write; on success set `total` to the returned integer.
  When `--total` is absent, leave `total` undefined so ROADMAP/prior-cursor
  derivation still runs unchanged. This also closes the latent `Number(true)===1`
  path from a valueless `--total`. Do not touch `--name` (D-05). Add a regression
  test to `planning.test.mjs`: `run(['cursor','set','--phase','1','--status',
  'planned','--next','/cad-execute 1','--name','Foo','--total','abc'], dir)` on a
  makeTree returns `ok:false`, `reason:'bad-args'`, and STATE.md was not written
  (`!readdirSync(dir).includes('STATE.md')`, or unchanged if pre-seeded) with no
  `NaN` in any output; and assert a sibling `--total 4` run still returns
  `ok:true` with `cursor.total === 4`.
- **Verify:** `node --test cadence-core/bin/planning.test.mjs` passes, including
  the new NaN-`--total` regression test.

### Task 3: Guard phase-done valueless --reqs (#45.1)

- **Files:** cadence-core/bin/planning.mjs, cadence-core/bin/planning.test.mjs
- **Action:** In `cmdPhaseDone`, immediately after the `--n` check (around line
  210) and BEFORE reading ROADMAP or writing anything, add an inline guard: if
  `'reqs' in opts && typeof opts.reqs !== 'string'` then `return fail('bad-args',
  'phase-done --reqs needs a comma-separated id list')`. This is the boolean-`true`
  case parseArgs produces for a valueless flag - keep it inline, not routed
  through `requireInt` (it is a shape guard, not numeric; D-01). Do not change the
  existing `opts.reqs.split(',')` path for a real value. Add a regression test to
  `planning.test.mjs`: a `phase-done --n 1 --reqs` run (valueless `--reqs` as the
  trailing token) returns `ok:false`, `reason:'bad-args'` (explicitly assert it is
  NOT `'internal'`), and ROADMAP/REQUIREMENTS were left unchanged; assert a
  sibling `phase-done --n 1 --reqs REQ-2,REQ-3` still parses to the id list
  (`reqs` includes those ids) as today.
- **Verify:** `node --test cadence-core/bin/planning.test.mjs` passes, including
  the valueless-`--reqs` regression test asserting `reason:'bad-args'` not
  `'internal'`.

### Task 4: Guard route --attempt with requireInt (#45.2)

- **Files:** cadence-core/bin/route.mjs, cadence-core/bin/route.test.mjs
- **Action:** In `route.mjs` import `requireInt` from `./lib/require-int.mjs`. In
  `parseArgs`, change the `--attempt` branch so it no longer silently coerces via
  `parseInt`: read the raw token, run `requireInt(raw)`, on success set
  `o.attempt` to the returned integer, on failure set `o.attempt = raw` and mark
  `o.attemptInvalid = true`. In the dispatch `resolve` branch (around 179-182),
  after the `!o.role` usage check, add `else if (o.attemptInvalid) { out({ ok:
  false, reason: 'usage', detail: 'resolve --attempt must be an integer' }); }`
  BEFORE calling `resolve(o)` - surfacing through route's existing `usage` reason,
  not a new `bad-args` string (D-03). Leave `--files`/`--ambiguity` untouched
  (out of scope). Add a regression test to `route.test.mjs`: `resolve('cad-planner',
  cfg({profile:'fast'}), ['--attempt','abc'])` returns `ok:false`,
  `reason:'usage'` - this is the failing-capable assertion: unpatched, the same
  call returns `ok:true` with `--attempt` silently coerced to `attempt:1` (that
  silent NaN->1 coercion IS the #45.2 bug; it is not a `reason:'unresolved'`
  path). Assert a sibling `--attempt 2` run returns `ok:true` and `attempt === 2`.
- **Verify:** `node --test cadence-core/bin/route.test.mjs` passes, including the
  bad-`--attempt` regression test whose `ok:false`/`reason:'usage'` assertion
  fails on unpatched code (which returns `ok:true, attempt:1`).

### Task 5: Reject a scalar top-level config on both faces (#45.3)

- **Files:** cadence-core/bin/config.mjs, cadence-core/bin/lib/config-merge.mjs, cadence-core/bin/config.test.mjs
- **Action:** Close both code paths #45.3 touches (D-02). (a) Validate face - in
  `config.mjs validate(file)`, after the `JSON.parse` succeeds and before
  `flatten`, if the parsed config is not a plain object (`cfg === null ||
  typeof cfg !== 'object' || Array.isArray(cfg)`) emit
  `out({ ok: false, file, checked: 0, errors: [{ key: '(root)', error:
  'top-level config must be a JSON object', value: cfg }] })` and return, so a
  scalar `42` stops reporting `ok:true, checked:0`. (b) Read face - in
  `config-merge.mjs mergeLayers`, guard the top-level entry into `deepMerge`: add
  an `isPlainObject(v)` check (`v !== null && typeof v === 'object' &&
  !Array.isArray(v)`) and treat a layer whose parsed value is present but not a
  plain object as skipped - it is not pushed to `layers` (so `source` no longer
  reports `repo`), contributes `{}` to the merge (so `get`/route no longer return
  `42` as the whole config), and adds a warning like `config layer <file>
  top-level is not an object; skipped` to the returned `warnings[]` (mirroring the
  phase-1 skipped-layer surfacing). Do NOT add the scalar guard inside
  `deepMerge`'s per-key recursion - that would break legitimate nested scalar
  overrides (a repo value replacing a default); the guard belongs only at the
  `mergeLayers` top-level call (see Notes). Add regression tests to
  `config.test.mjs`: (1) `validate` on a file containing `42` returns `ok:false`
  with a `(root)`/non-object error and `checked === 0`; a normal object config
  still returns `ok:true`. (2) `get` with a scalar repo config file returns
  `ok:true`, `source` is not `repo` (falls to `defaults`/`global`), values equal
  the schema defaults, and a `warnings[]` names the skipped layer - contrast with
  the pre-fix `42 at source:"repo"`.
- **Verify:** `node --test cadence-core/bin/config.test.mjs` passes, including
  both scalar-config regression tests (validate face and get read face). Then
  `node --test cadence-core/bin/*.test.mjs` passes across all seam tests.

## Notes

- Deviation from D-02's literal wording: D-02 names "a guard in `deepMerge`" for
  the read face. The guard is implemented at the `mergeLayers` top-level call
  into `deepMerge` (same file, `config-merge.mjs`), not inside `deepMerge`'s
  body, because `deepMerge` recurses per-key and a scalar-rejecting guard in its
  recursion would discard every legitimate nested repo override (a repo scalar
  replacing a default). This honors D-02's locked outcome exactly - the read path
  stops returning the scalar and `source` is no longer `repo` - while keeping
  override semantics correct; the observable contract in the acceptance criteria
  is unchanged.
- Fixing `mergeLayers` closes the scalar read-face for route.mjs as well as
  `config.mjs get`, since both read through the one shared merge lib (D-02 names
  both `get` and route).
- Plan structure matches the CONTEXT `Plan shape: one plan` directive: Tasks 2
  and 3 share `planning.mjs`/`planning.test.mjs`, so they cannot be split into
  independent parallel slices - one plan is correct.
