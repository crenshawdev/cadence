---
phase: 1
plan: 1
requirements: ["#39", "#40", "#43", "#44"]
files: ["cadence-core/bin/lib/config-merge.mjs", "cadence-core/bin/config.mjs", "cadence-core/bin/route.mjs", "cadence-core/bin/review-provider.mjs", "cadence-core/bin/self-verify.mjs", "cadence-core/bin/config.test.mjs", "cadence-core/bin/route.test.mjs", "cadence-core/bin/review-provider.test.mjs", "cadence-core/bin/self-verify.test.mjs"]
---

# Phase 1: Silent data-file failures - Plan

## Goal

An absent or malformed shipped data/config file is surfaced, never silently
swallowed into defaults; the "never blocks the spine" seam contract holds -
degraded seams return `{ok:false}` (or an additive `warnings[]`), never a raw
crash.

## Must be true when done

- `config.mjs get` against a malformed `.planning/config.json` returns `ok:true`
  whose `values` and `source` equal the no-repo-layer result AND carries a
  `warnings[]` entry naming the file that failed to parse; a merely-absent file
  yields no warning.
- `route.mjs` (route-table.json) and `config.mjs` (config.schema.json) invoked
  with their shipped data file absent or malformed emit exactly one
  `{ok:false,reason,detail}` JSON line on stdout with no raw stack trace.
- `review-provider.mjs`'s model-hints load surfaces a `warnings[]` entry naming a
  malformed `model-hints.json`, while `classify` still returns candidate models
  with the exclude filter intact (fail-safe); an absent or valid hints file
  yields no warning, so the two outputs are distinguishable.
- `self-verify.mjs` run against a full plugin tree with an always-expected input
  (a core surface dir, `weight-budgets.json`, `INTERNALS.md`) missing exits
  `ok:false` naming it; run against a minimal `--root` fixture that omits optional
  inputs it still exits `ok:true`.
- Each of #39, #40, #43, #44 has a failing-capable regression test, and
  `node --test cadence-core/bin/*.test.mjs` plus `tsc -p tsconfig.ci.json` are
  both green.

## Context

Locked decisions from CONTEXT.md bind this plan: D-01 (parse failure surfaced via
an additive `warnings[]` entry naming the file; `source`/`values`/`models` stay
byte-identical; absence stays silent) shared by #39 and #43; D-02 (relocate the
top-level `TABLE`/`SCHEMA` loads behind the dispatch guard so a bad shipped file
degrades to `{ok:false}`) for #40; D-03 (a missing always-expected input yields
`ok:false` on a full-tree run, gated so a minimal fixture stays `ok:true`) for
#44; D-04 (every runtime-seam fix stays non-fatal - a bad file is skipped or
degraded, never crashes the spine); D-05 (the two tests that currently *assert*
the silent broken==absent contract are rewritten, not supplemented). Follow the
repo's established zero-dep seam pattern: one JSON line on stdout, `emit`/`DONE`
unwind, hermetic tests via a `CADENCE_*` env-path override (mirrors the existing
`CADENCE_GLOBAL_CONFIG`). Out of scope: `self-verify.mjs:149`'s unguarded schema
load stays loud-on-corruption by design; the v1.2.0 by-design holdouts are not
this phase.

## Tasks

### Task 1: Relocate the top-level route-table / schema loads behind the dispatch guard (#40)

- **Files:** cadence-core/bin/route.mjs, cadence-core/bin/config.mjs, cadence-core/bin/route.test.mjs, cadence-core/bin/config.test.mjs
- **Action:** In `route.mjs`, change the module-top `const TABLE = JSON.parse(readFileSync(join(HERE,'..','route-table.json'),'utf8'))` (line 32) to a module-scope `let TABLE;` plus a `const TABLE_PATH = process.env.CADENCE_ROUTE_TABLE || join(HERE,'..','route-table.json')`; move the read+parse to be the FIRST statement inside the existing dispatch `try` block (line 165), wrapped in its own inner try that on failure calls a structured degrade and unwinds. Import `DONE` alongside `emit` from `./lib/seam-io.mjs` and add `const fail = (reason, detail) => { out({ ok:false, reason, detail }); throw DONE; };`; the inner catch does `fail('bad-table', \`cannot read/parse ${TABLE_PATH}: ${e.message}\`)`, and the outer catch becomes `if (e !== DONE) out({ ok:false, reason:'internal', detail:... })`. `bumpTier`/`stepProfile`/`resolve` keep referencing the module-scope `TABLE` (they run only after assignment). In `config.mjs`, apply the same shape: change `const SCHEMA = JSON.parse(...).keys` (lines 30-32) to `let SCHEMA;` plus `const SCHEMA_PATH = process.env.CADENCE_CONFIG_SCHEMA || join(HERE,'..','config.schema.json')`, and load it (`SCHEMA = JSON.parse(readFileSync(SCHEMA_PATH,'utf8')).keys`) as the first statement inside the existing dispatch `try` (line 213), wrapped in an inner try whose catch calls the existing `fail('bad-schema', \`cannot read/parse ${SCHEMA_PATH}: ${e.message}\`)`. Do NOT touch `self-verify.mjs:149`'s schema load (loud-by-design, out of scope) and do NOT re-route `config.mjs`'s already-guarded `crossWarnings` route-table read (line 137). The env-path overrides are the hermetic injection seam for the tests below; production defaults to the shipped path. Add regression tests: in `route.test.mjs`, a test that runs the CLI with `CADENCE_ROUTE_TABLE` pointed at (a) a malformed temp file and (b) a nonexistent path, asserting each yields a single parsed JSON line with `ok:false` and `reason:'bad-table'` and that stdout parsed cleanly (no stack). In `config.test.mjs`, the mirror test with `CADENCE_CONFIG_SCHEMA` malformed/absent asserting `ok:false` and `reason:'bad-schema'`.
- **Verify:** `node --test cadence-core/bin/route.test.mjs cadence-core/bin/config.test.mjs` passes; `CADENCE_ROUTE_TABLE=/nonexistent node cadence-core/bin/route.mjs table` prints one line whose JSON has `ok:false,"reason":"bad-table"` and no stack trace; `CADENCE_CONFIG_SCHEMA=/nonexistent node cadence-core/bin/config.mjs keys` likewise prints `ok:false,"reason":"bad-schema"`.

### Task 2: Surface a malformed config layer via warnings[] in the merge lib (#39)

- **Files:** cadence-core/bin/lib/config-merge.mjs, cadence-core/bin/config.mjs, cadence-core/bin/config.test.mjs
- **Action:** In `config-merge.mjs`, add an exported `readLayer(file)` that returns `{ value, warning }`: on successful parse `{ value: parsed, warning: null }`; on `e.code === 'ENOENT'` (legitimately absent) `{ value: null, warning: null }`; on any other failure (parse error, unreadable) `{ value: null, warning: \`config layer ${file} failed to parse and was skipped: ${e.message}\` }`. Rework `mergeLayers` (lines 47-57) to call `readLayer` for the global and repo layers, build `layers` from `.value` truthiness exactly as today (so a malformed layer contributes nothing and `source` stays byte-identical to the absent case), and return a third field `warnings` = `[globalWarning, repoWarning].filter(Boolean)`. Keep the existing `readJSON` export unchanged (internal callers/tests may still use it). Every other `mergeLayers` caller (route.mjs, git-*.mjs, land-cleanup.mjs, planning.mjs) ignores the new field - do not touch them. In `config.mjs`, change `get` (lines 186-198) to destructure `warnings` from `mergeLayers(file)` and emit `out({ ok:true, values, source, ...(warnings && warnings.length ? { warnings } : {}) })`; do not alter `values` or `source` computation. Per D-05, REWRITE (not supplement) the `config.test.mjs` "a corrupt layer is skipped, not fatal" test at lines 182-191: it must now assert that with a malformed `--file` (repo) layer the result is `ok:true`, `values`/`source` equal the no-repo-layer result, AND `warnings` contains an entry whose text includes the offending file path; and that with the file merely absent, `warnings` is absent. Keep a corrupt-global variant asserting `source:'repo'` plus a warning naming the global file.
- **Verify:** `node --test cadence-core/bin/config.test.mjs` passes and no remaining test asserts the silent broken==absent contract; manually, `config.mjs get --file <a-malformed-json>` prints `ok:true` with a `warnings` array naming that file while `values`/`source` match the same call against an absent file (which prints no `warnings`).

### Task 3: Surface a malformed model-hints load via warnings[] in detect-models (#43)

- **Files:** cadence-core/bin/review-provider.mjs, cadence-core/bin/review-provider.test.mjs
- **Action:** In `review-provider.mjs`, extract the hints-file load out of `classify` (lines 517-523) into an exported `readModelHints(hintsFile)` returning `{ hints, warning }`: resolve `file = hintsFile || path.join(HERE,'..','references','model-hints.json')`; on parse success `{ hints: parsed, warning: null }`; on `e.code === 'ENOENT'` `{ hints: {}, warning: null }` (absence stays silent, per D-01); on any other failure `{ hints: {}, warning: \`model-hints file ${file} failed to parse and was ignored: ${e.message}\` }`. Rewrite `classify` to call `const { hints } = readModelHints(hintsFile)` then `const rules = (hints.rules && hints.rules[provider]) || []; const exclude = hints.exclude || []` and keep the rest of its body and its ARRAY return byte-identical (D-04: still filters excludes and returns candidates; the seven existing `classify(...)` array call sites stay valid). Factor the envelope assembly into an exported pure builder `detectEnvelope(provider, ids, hintsFile)` that composes both helpers: `const { warning } = readModelHints(hintsFile); const models = classify(provider, ids, hintsFile); return warning ? { provider, models, warnings: [warning] } : { provider, models };`. In `cmdDetect` (lines 488-508), replace the final `ok({ provider, models: classify(provider, ids) })` with `ok(detectEnvelope(provider, ids))` (default hintsFile resolves to the shipped path inside the helpers). Extracting the pure builder is what lets AC3 - the *envelope* carries `warnings[]` for a malformed hints file, absent for a valid/absent one - be proved by a hermetic test instead of code inspection, since `detect-models` itself needs a live key + network. Per D-05, REWRITE the `review-provider.test.mjs` "broken or missing hints degrade to all-unknown" test at lines 135-145: import `readModelHints`, `classify`, and `detectEnvelope`; assert `classify` STILL returns the all-unknown candidate array for both a broken and an absent hints file (fail-safe preserved, exclude list still applied); assert `readModelHints(<broken-file>).warning` is a non-null string containing the file path and `readModelHints(<absent-file>).warning` is `null`; and assert `detectEnvelope('anthropic', ids, <broken-file>)` returns an object with a `warnings` array naming the file while `detectEnvelope('anthropic', ids, <valid-ruleless-file>)` (a temp file holding `{}` or `{"rules":{}}` - a successfully-parsed but empty hints file) returns one with NO `warnings` key. The no-warning contrast MUST be a valid-but-ruleless file, not an absent one: AC3 names the valid-ruleless case specifically, and only a parsed-but-empty file exercises the branch a future over-eager `readModelHints` edit could wrongly flag. Add a separate `readModelHints(<absent-file>).warning === null` assertion for the ENOENT-silence path. This closes AC3 at the envelope level and proves malformed, valid-ruleless, and absent are the three distinguishable outputs in the shipped shape.
- **Verify:** `node --test cadence-core/bin/review-provider.test.mjs` passes; the rewritten test asserts a warning string for a malformed hints file and `null` for an absent one, and no test still asserts broken==absent silence.

### Task 4: Gate self-verify to fail on missing always-expected inputs in a full tree (#44)

- **Files:** cadence-core/bin/self-verify.mjs, cadence-core/bin/self-verify.test.mjs
- **Action:** In `self-verify.mjs` `run(root)`, add near the top `const isFullTree = existsSync(join(root, '.claude-plugin', 'plugin.json'))` - the plugin manifest is the definitive marker of a real Cadence install; the minimal test fixtures never create it, so they stay lenient (D-03). Document that intent in a comment. Then make the always-expected inputs hard failures ONLY when `isFullTree`: (a) add an explicit loop over the five core surface dirs (`cadence-core/workflows`, `cadence-core/references`, `cadence-core/templates`, `skills`, `agents`) that, when `isFullTree` and a dir is absent, pushes `{ kind:'missing-input', file:<dir>, detail:'core surface dir absent' }` (leave `mdFiles`'s own silent skip as-is); (b) change the budget block (line 247) so that when `budgetPath` is absent AND `isFullTree` it pushes `{ kind:'missing-input', file:'cadence-core/bin/weight-budgets.json', detail:'always-expected input absent' }`, else when absent and not full-tree it skips as today, else runs the existing check; (c) change the INTERNALS block (line 222) the same way - absent AND `isFullTree` pushes `{ kind:'missing-input', file:'INTERNALS.md', detail:'always-expected input absent' }`, otherwise current behavior. Do not change the default-root resolution or any check that already passes on the real repo. Add regression tests to `self-verify.test.mjs`: a `fullFixture()` helper that builds a tree WITH `.claude-plugin/plugin.json` (content `{}`) plus the schema, the five surface dirs, `cadence-core/bin/weight-budgets.json`, and `INTERNALS.md`; a test that deletes `weight-budgets.json` (and a second that renames a core surface dir) from that full fixture and asserts `run(['--root', root])` yields `ok:false` with a `missing-input` problem whose detail/file names the removed input; and a test that a NON-full fixture (the existing minimal `fixture()`, no `.claude-plugin`) omitting `weight-budgets.json`/`INTERNALS.md` produces NO `missing-input` problem - proving the gate distinguishes a real tree from a fixture.
- **Verify:** `node --test cadence-core/bin/self-verify.test.mjs` passes including "the repo itself passes self-verification" (the real repo has all inputs), the full-fixture-missing-input test asserts `ok:false` naming the input, and the minimal-fixture test asserts no `missing-input` problem.

### Task 5: Full-suite and type-check integration gate

- **Files:** (none - verification only)
- **Action:** Run the complete bin test suite and the CI type-check to confirm the four fixes compose with no cross-fix regression and no `@ts-check` breakage. Fix any failure surfaced here in the owning task's files before considering the phase done; do not suppress or `// @ts-ignore` a real type error.
- **Verify:** `node --test cadence-core/bin/*.test.mjs` reports 0 failures, and `tsc -p tsconfig.ci.json` exits 0 with no diagnostics.

## Notes

- Tasks 1 and 2 both edit `cadence-core/bin/config.mjs` and `cadence-core/bin/config.test.mjs`, and Task 1 introduces the `DONE` import that Task 1's own `fail` helper uses; execute in the given order (they touch different regions - the dispatch-guard load vs. `get`'s output line).
- Planner decision (D-02 support): the `CADENCE_ROUTE_TABLE` / `CADENCE_CONFIG_SCHEMA` env-path overrides are added solely as the hermetic injection seam that makes the #40 regression tests possible without clobbering the shipped data files; they mirror the existing `CADENCE_GLOBAL_CONFIG` pattern, default to the shipped path in production, and are env vars (not config keys or CLI flags), so they add no self-verify drift surface.
- Planner decision (#43 fixture testability): `detect-models` cannot be exercised end-to-end in the suite (it needs a live key and a network call, which the suite forbids), so the #43 regression is proved without invoking `cmdDetect` - `readModelHints`/`classify` at the helper level plus the pure `detectEnvelope` builder that assembles the exact `{provider, models, warnings?}` shape `cmdDetect` returns. Factoring `detectEnvelope` out closes CONTEXT AC3 (the *envelope* carries `warnings[]` for a malformed hints file) with a hermetic test rather than code inspection, guarding the one line a future edit could drop. (Folded in from the plan-checker WARNING.)
