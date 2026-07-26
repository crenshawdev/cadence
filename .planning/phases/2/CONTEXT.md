# Phase 2: Seam input validation - Context

Gathered: 2026-07-24
Feeds: /cad-plan 2

## Scope boundary

In: A shared seam-flag validator rejects bad input types before any write or
merge, so no bad flag can corrupt STATE.md or pass config validation. Two filed
bugs, four fix-cases: #42 (`cursor set --total abc` writes `Phase: N of NaN`
while reporting `ok:true`, breaking every later `cursor get` with
`unparseable-cursor`); #45.1 (`phase-done` valueless `--reqs` throws, mislabelled
`reason:"internal"`); #45.2 (`resolve --attempt abc` reports `unresolved` instead
of flagging the bad flag); #45.3 (`config validate` passes a scalar `42` clean,
and `deepMerge` then returns `42` as the whole config with `source:"repo"`). Each
fix carries a failing-capable regression test (FIX-01).
Out: `--name` type-checking on `cursor set` (D-05 - cosmetic, cursor stays
parseable). The broader phase-1 residue where the other six `mergeLayers` callers
silently drop a malformed *layer* (CAPTURE todo) - this phase guards only a scalar
*top-level*, not that wider surface. No new reason string added to route.mjs
(D-03). No self-verify CONTRACTS change - the flags already exist there. No new
features.
Deferred: None
Plan shape: one plan

## Durable decisions

- D-01 (validator architecture, #42/#45.2): a small shared numeric-flag helper
  in `cadence-core/bin/lib/` (e.g. `requireInt`) covers the two NaN cases that
  share shape - `--total` in `planning.mjs` (#42) and `--attempt` in `route.mjs`
  (#45.2); both adopt it. The valueless `--reqs` case (#45.1, a boolean-`true`
  guard, not numeric) stays an inline guard in `planning.mjs`, and the scalar-
  config case (#45.3, a top-level JSON-shape check) is a separate `config.mjs` /
  `config-merge.mjs` concern. Honors the roadmap's "shared seam-flag validator"
  intent for the cases that genuinely share shape, without forcing config's
  different validation kind through the same pipe. Chosen over per-script inline
  everywhere (loses the shared-helper the roadmap named) and one unified
  `lib/seam-args` validator (would have to reconcile three incompatible arg
  styles - planning's post-parse opts map, route's parse-time `parseInt`
  coercion, config's positional tokens). Evidence: `cadence-core/bin/planning.mjs:168,210`,
  `cadence-core/bin/route.mjs:157-169`, `cadence-core/bin/config.mjs:208-214`,
  `cadence-core/bin/lib/` (no arg helper today).
- D-02 (scalar config, both faces, #45.3): the fix closes both code paths #45.3
  touches - an object-shape check in `config.mjs validate` so a scalar `42` stops
  reporting `ok:true, checked:0`, AND a guard in `deepMerge` (`config-merge.mjs`)
  so the read path (`get`/`route`) stops returning `42` as the whole config with
  `source:"repo"`. `validate` flattens the file directly while the read path goes
  through `deepMerge` - two separate paths, so both must be touched to close both
  faces. Scoped to a scalar top-level, distinct from the wider phase-1 malformed-
  layer residue. Chosen over a `validate`-only fix (leaves the read-path hole open).
  Evidence: `cadence-core/bin/config.mjs:81-89,99-112`,
  `cadence-core/bin/lib/config-merge.mjs:49-56`.

## Decisions

- D-03 (route reason, #45.2): a bad `--attempt` surfaces through route.mjs's
  existing `reason:'usage'`, not a new `bad-args` string route never emitted
  (route's reason set is `unknown-role | unresolved | usage | internal`). Caller
  fallback-to-base-model is unaffected either way; this only pins the observable
  contract and tests. Chosen over introducing `bad-args` for cross-seam
  consistency (would add a reason this seam never emitted). Evidence:
  `cadence-core/bin/route.mjs:181,186`.
- D-04 (fail before write): all four validations fail (`bad-args` in planning.mjs,
  `usage` in route.mjs, object-shape error in config.mjs) BEFORE any write or
  merge, keeping the seam non-fatal - the Phase-1 D-04/D-05 lineage. Regression
  tests are net-new assertions (the analyzer's grep found no passing test encoding
  the buggy contract); if one surfaces, it is rewritten per Phase-1 D-05, not
  supplemented. Evidence: `cadence-core/bin/planning.mjs:168,198,210,233-234`,
  `cadence-core/bin/self-verify.mjs:37-92` (CONTRACTS already lists these flags).
- D-05 (`--name` unguarded, #42): `cursor set --name` stays unguarded - a bad
  `--name` is cosmetic and round-trips as a parseable string (`(true)`), unlike a
  NaN `--total` that breaks every reader. Scope stays on flags that actually
  corrupt STATE.md. Evidence: `cadence-core/bin/planning.mjs:707-714`
  (`parseArgs` turns a valueless flag into boolean `true`).

## Acceptance criteria

- [ ] `planning.mjs cursor set --phase N --status planned --next /cad-execute
      --name Foo --total abc` exits `ok:false` `reason:"bad-args"` and STATE.md is
      unchanged (no `Phase: N of NaN` line written); a valid `--total 4` still
      writes and reports `ok:true`.
- [ ] `planning.mjs phase-done` with a valueless `--reqs` (bare flag before the
      next flag) exits `ok:false` `reason:"bad-args"`, not `reason:"internal"`; a
      real `--reqs FIX-01,FIX-02` still parses to the id list.
- [ ] `route.mjs resolve --role plan --attempt abc` exits `ok:false`
      `reason:"usage"` (not `reason:"unresolved"`); a numeric `--attempt 2`
      resolves normally.
- [ ] `config.mjs validate` on a file whose entire content is `42` exits
      `ok:false` reporting the non-object top-level (not `ok:true, checked:0`); a
      normal object config still validates `ok:true`.
- [ ] `config.mjs get` with a scalar `.planning/config.json` does not return the
      scalar as the config - it falls back to global+default values rather than
      reporting `42` at `source:"repo"`.
- [ ] Each of #42, #45.1, #45.2, #45.3 has a test that reproduces the pre-fix
      behavior (NaN written / `internal` / `unresolved` / clean-scalar) and asserts
      the corrected behavior, and `node --test cadence-core/bin/*.test.mjs` passes.

## Flagged assumptions

None - all assumptions confirmed
