---
phase: 2
status: complete
completed: 2026-07-24
---

# Phase 2: Seam input validation - Summary

A shared `requireInt` seam guard plus three call-site guards: bad `--total`,
valueless `--reqs`, and non-integer `--attempt` now fail with `bad-args`/`usage`
before any write, and a scalar top-level config is rejected on both the validate
and the read/merge face.

## What shipped

- `requireInt(raw)` numeric-flag validator, dependency-free and side-effect-free,
  callers own the reason string - `cadence-core/bin/lib/require-int.mjs`
- `cursor set --total` rejects a non-integer with `bad-args` before deriving or
  writing - `cadence-core/bin/planning.mjs`
- `phase-done --reqs` rejects the valueless (boolean `true`) form with
  `bad-args`, no longer `internal` - `cadence-core/bin/planning.mjs`
- `route.mjs resolve --attempt` rejects a non-integer with `usage` instead of
  silently coercing NaN to `attempt:1` - `cadence-core/bin/route.mjs`
- Scalar/array top-level config rejected on the validate face
  (`config.mjs validate` -> `ok:false` with a `(root)` error) and skipped with a
  `warnings[]` entry on the read face (`lib/config-merge.mjs mergeLayers`), so
  `get` and route fall back to defaults instead of returning the scalar at
  `source:"repo"` - `cadence-core/bin/config.mjs`,
  `cadence-core/bin/lib/config-merge.mjs`
- Regression tests for each of #42, #45.1, #45.2, #45.3 -
  `require-int.test.mjs`, `planning.test.mjs`, `route.test.mjs`,
  `config.test.mjs`

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | 4e624df | add shared requireInt numeric-flag validator |
| 1 | 2 | 0fac729 | reject non-integer `cursor set --total` before write (#42) |
| 1 | 3 | d8e83d9 | reject valueless `phase-done --reqs` before write (#45.1) |
| 1 | 4 | 94f2c75 | reject non-integer `resolve --attempt` instead of silent coercion (#45.2) |
| 1 | 5 | 7625984 | reject scalar top-level config on validate and read faces (#45.3) |

## Deviations

- None introduced by execution. The plan's own Notes already recorded the one
  departure from CONTEXT D-02's literal wording: the read-face guard sits at the
  `mergeLayers` top-level call rather than inside `deepMerge`'s per-key
  recursion, because guarding the recursion would discard legitimate nested
  scalar repo overrides. D-02's locked outcome (read path stops returning the
  scalar, `source` no longer reports `repo`) is delivered exactly (7625984).

## Open items

Found by the `diff` review trigger (advisory gate, adjudicated against the code;
each verified live, not taken on the reviewer's word):

- **`cursor set` still writes a STATE.md its own parser rejects.** `requireInt`
  validates "is an integer", but `parseCursor`'s regex
  (`lib/planning-files.mjs:28`) requires unsigned decimal digits: `of\s+(\d+)`.
  So `--total -2` returns `ok:true` and writes `Phase: 1 of -2 (Foo)`, and the
  very next `cursor get` returns
  `{ok:false, reason:"unparseable-cursor"}`. `--total 1e21` corrupts the same
  way via `renderCursor`. The fix is a shape check aligned with the file format
  (non-negative, no exponent), not a broader integer check.
- **`cursor set --phase` is unguarded in the same way** (`planning.mjs:169` is
  still a bare `Number()` + NaN check). `--phase -1 --total 3` returns `ok:true`
  and writes `Phase: -1 of 3 (Foo)`, again unparseable on the next read. CONTEXT
  D-05 scoped out `--name`; `--phase` was simply never covered.
- **The config write face was not closed** (#45.3 covered validate and read
  only). With an array config, `config.mjs set --file arr.json granularity=fine`
  prints `{"ok":true,"changed":[...]}` while `atomicWrite` re-serializes the
  array and the key is never persisted - a reported write that did not happen.
  With a scalar `42`, the same command returns
  `{"ok":false,"reason":"internal","detail":"Cannot create property 'granularity'
  on number '42'"}` - the raw-JS-error-as-`internal` class D-04 set out to
  eliminate.
- **`phase-done --reqs ""` passes the shape guard and does the opposite of the
  caller's intent.** The guard rejects only non-strings, and line 233's
  `opts.reqs ? split : phase-filter` treats `''` as absent, so an empty
  interpolated variable (`--reqs "$IDS"`) silently bulk-flips every non-Deferred
  row of that phase to Complete. Verified on a real-format Traceability fixture:
  `reqs:["REQ-01 ...","REQ-02 ..."]`, both rows rewritten.
- **A falsy non-object config layer is skipped silently.** The warning is gated
  on truthiness (`config-merge.mjs:84,88`), so a config truncated to `null`,
  `0`, `false`, or `""` yields `source:"defaults"` with no `warnings` key at all,
  while `validate` on the same file reports it broken. Only truthy scalars warn.
- Minor: in `planning.test.mjs:376` the assertion
  `JSON.stringify(r).includes('NaN') === false` is vacuous - `JSON.stringify`
  renders NaN as `null`, so it passes on unpatched code too. The test remains
  failing-capable through its `r.ok`/`STATE.md` assertions, so this is a wart,
  not a coverage hole.
- Tooling, not code: the `openai` cross-model reviewer could not run this phase -
  `review.providers.openai.tiers.balanced` is pinned to `gpt-5.1-codex-mini`,
  which the provider now returns 404/deprecated for. Re-point it via
  `/cad-config`.

Reviewer claims that did NOT survive adjudication: that `requireInt` wrongly
rejects a numeric argument (no code path supplies one - every flag value comes
from `process.argv` as a string, and rejecting non-strings is the deliberate
mechanism that catches the parser's boolean `true`), and that accepting `"4.0"`
as `4` is a defect (harmless leniency; the plan required rejecting `"4.5"`,
which it does).

## Goal check

The four enumerated cases in the goal are delivered and evidenced: all 275 tests
in `node --test cadence-core/bin/*.test.mjs` pass and `npx tsc -p tsconfig.ci.json`
exits 0 (both re-run at phase close, not merely reported by the executor); the
`--attempt` test is genuinely failing-capable, since unpatched code returns
`ok:true, attempt:1` where the test now asserts `ok:false, reason:'usage'`. The
goal's trailing generalization - "no bad flag can corrupt STATE.md" - is not
fully achieved, and that is the honest gap: `cursor set` accepts two inputs
(`--total -2`, `--phase -1`) that pass the new integer guard and still produce a
STATE.md that `cursor get` immediately rejects as `unparseable-cursor`, verified
live. The scalar-config half of the goal ("or pass config validation") holds for
the validate and read faces but not the write face, where `set` on an array
config still reports a success it did not perform. The phase closed its four
named requirements; it did not close the class those requirements were drawn
from.
