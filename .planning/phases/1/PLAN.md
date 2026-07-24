---
phase: 1
plan: 1
requirements: [FIX-01]
files:
  - cadence-core/bin/lib/config-merge.mjs
  - cadence-core/bin/lib/load-data.mjs
  - cadence-core/bin/route.mjs
  - cadence-core/bin/config.mjs
  - cadence-core/bin/review-provider.mjs
  - cadence-core/bin/self-verify.mjs
  - cadence-core/bin/config.test.mjs
  - cadence-core/bin/route.test.mjs
  - cadence-core/bin/review-provider.test.mjs
  - cadence-core/bin/self-verify.test.mjs
---

# Phase 1: Silent data-file failures - Plan

## Goal

An absent or malformed shipped data/config file is surfaced, never silently
swallowed into defaults, and the "never blocks the spine" seam contract holds:
a bad file degrades to a distinguishable signal or a `{ok:false}` JSON line,
never a raw crash or an invisible revert. Closes #39, #40, #43, #44 under
FIX-01, each with a failing-capable regression test.

## Must be true when done

- A malformed `.planning/config.json` (or global config) is distinguishable
  from an absent one: `config.mjs get` / `route.mjs resolve` report the parse
  failure in the `source`/`reason` field and a stderr warning names the file,
  while the command still succeeds (`ok:true`) on defaults - the revert is no
  longer silent (#39).
- An absent config layer stays clean (`source` reads `defaults`/`repo`/etc.
  with no parse-failure note and no warning) - absence and corruption never
  read the same (#39).
- `route.mjs` and `config.mjs` run against a missing or corrupt shipped data
  file (`route-table.json` / `config.schema.json`) emit the contracted
  one-line `{ok:false, reason, detail}` with the file named, instead of an
  uncaught `SyntaxError` stack (#40).
- `review-provider` distinguishes a corrupt `model-hints.json` (surfaced via a
  stderr warning naming the file and a `hints_warning` field on
  `detect-models` output) from a legitimately absent one (silent), so a broken
  hints file no longer silently disables the non-text exclude filter (#43).
- `self-verify` reports every drift check it skips for an absent always-expected
  input (a core surface dir, `weight-budgets.json`, or `INTERNALS.md`) in a
  `skipped` field of its output, so a renamed surface can no longer drop to
  zero coverage while staying green (#44).
- Each fix carries a failing-capable regression test in the sibling
  `*.test.mjs`; `node --test cadence-core/bin/*.test.mjs`, `node
  cadence-core/bin/self-verify.mjs`, and `npx tsc -p tsconfig.ci.json` all stay
  green (FIX-01).

## Context

No CONTEXT.md for this phase; the four issues are the locked spec (read in
full via `gh issue view 39|40|43|44`). This is a bugfix phase, not a feature
spine, so tasks are independent fixes ordered by shared-file dependency: Task 1
(#39) and Task 2 (#40) both touch `config.mjs`/`route.mjs`/their tests and run
first in that order; Task 3 (#43) and Task 4 (#44) touch disjoint files.

Binding constraints from the issues and PROJECT.md:
- The fail-safe swallow STAYS for #39/#43/#44 - the fix is ending the TOTAL
  SILENCE, distinguishing absent/legitimately-empty from present-but-failed-to-parse
  and surfacing only the latter. Do NOT make a bad layer fatal.
- #40 is the opposite shape: move the top-level `JSON.parse(readFileSync(...))`
  behind the dispatch guard so a bad data file degrades to `{ok:false}`.
- OUT OF SCOPE (do not touch): `self-verify.mjs:149` loading
  `config.schema.json` unguarded is correct-by-design (loud dev/CI crash) -
  leave it. Do not pull in any other sweep issue (#37/#41/#42/#45-50).
- Zero runtime deps; one-line JSON on stdout, exit code mirrors `ok`; keep
  `@ts-check`/`tsc` clean. CI test glob is `cadence-core/bin/*.test.mjs` (it
  does NOT match `lib/`), so all regression tests live in the sibling
  `bin/*.test.mjs`, never a `lib/*.test.mjs`. None of these fixes add a
  subcommand or flag, so the `self-verify.mjs` CONTRACTS table needs no edit -
  but re-run self-verify to confirm it stays green.

## Tasks

### Task 1: Surface a malformed config layer (#39)

- **Files:** cadence-core/bin/lib/config-merge.mjs, cadence-core/bin/config.test.mjs, cadence-core/bin/route.test.mjs
- **Action:** In `config-merge.mjs`, make the layer reader distinguish an
  absent file from a malformed one. Replace the boolean use of `readJSON` in
  `mergeLayers` with a reader that reports the outcome per layer: absent
  (ENOENT) or present-and-parsed vs present-but-`SyntaxError`/unreadable.
  Preserve the existing fail-safe merge (a bad layer still contributes nothing;
  `deepMerge(global||{}, repo||{})` is unchanged). When a layer failed to
  parse, (a) append a parenthetical note to the returned `source` string naming
  that layer, e.g. `defaults (repo config failed to parse)` or `global (repo
  config failed to parse)`, so the note rides through `config.mjs get`'s
  `source` and `route.mjs`'s `config:<source>` reason unchanged, and (b) write
  one line to stderr naming the failed file (via `process.stderr.write`, so the
  single JSON stdout line the seam parses stays clean). An absent layer must
  add NO note and NO warning - that is the absent-vs-malformed distinction.
  Keep the exported `readJSON` signature working for any other caller; you may
  add a new internal/exported `readLayer(file)` returning the discriminated
  outcome. Keep `@ts-check` clean. In `config.test.mjs`, UPDATE the existing
  `'get: a corrupt layer is skipped, not fatal'` test (currently asserts
  `source === 'repo'` for a corrupt global, encoding the old silent behavior)
  to assert the new surfacing: `ok:true`, the fallback values still resolve,
  and `source` matches `/global config failed to parse/`; add a companion test
  for a corrupt REPO file asserting `source` matches `/repo config failed to
  parse/` while an absent repo file (existing 'defaults' tests) stays clean
  with no note. In `route.test.mjs`, add one assertion that `resolve` against a
  corrupt `--file` still returns `ok:true` and its `reason` array contains an
  entry matching `/config failed to parse/`.
- **Verify:** `node --test cadence-core/bin/config.test.mjs cadence-core/bin/route.test.mjs` passes; the new/updated tests fail if the parse-failure note is removed. `npx tsc -p tsconfig.ci.json` clean.

### Task 2: Move shipped-data-file parse behind the dispatch guard (#40)

- **Files:** cadence-core/bin/lib/load-data.mjs, cadence-core/bin/route.mjs, cadence-core/bin/config.mjs, cadence-core/bin/route.test.mjs, cadence-core/bin/config.test.mjs
- **Action:** Create `cadence-core/bin/lib/load-data.mjs` exporting a single
  zero-dep helper `loadDataFile(file)` that reads and JSON-parses `file` and
  returns a discriminated result - `{ ok:true, data }` on success, `{ ok:false,
  detail }` (detail names the file and the error message) on any read/parse
  failure - so callers degrade instead of throwing. Keep `@ts-check` clean.
  In `route.mjs`: remove the module-top `const TABLE = JSON.parse(readFileSync(
  join(HERE,'..','route-table.json'),'utf8'))` (line 32); declare `let TABLE;`
  at module scope (the resolve/bumpTier/stepProfile/`table` code keeps reading
  the module binding) and, as the FIRST step inside the existing dispatch `try`
  (line 165), load it via `loadDataFile`, resolving the path from
  `process.env.CADENCE_ROUTE_TABLE || join(HERE,'..','route-table.json')`
  (env override mirrors the existing `CADENCE_GLOBAL_CONFIG` hermetic-test
  seam) - on `ok:false` emit `{ok:false, reason:'data-file', detail}` and stop
  before dispatch. In `config.mjs`: same shape - remove the module-top `const
  SCHEMA = JSON.parse(...).keys` (lines 30-32), declare `let SCHEMA;` at module
  scope, and load it as the first step inside the dispatch `try` (line 213) via
  `loadDataFile` with path `process.env.CADENCE_CONFIG_SCHEMA || join(HERE,
  '..','config.schema.json')`, taking `.keys`; on failure emit `{ok:false,
  reason:'data-file', detail}`. Do NOT touch `self-verify.mjs:149` (out of
  scope by design). Add tests: in `route.test.mjs` and `config.test.mjs`, point
  the respective env override at a corrupt fixture file and assert the command
  emits `ok:false` with `reason === 'data-file'` and `detail` naming the file
  (no thrown/uncaught stack), and that a normal run with the real shipped file
  still succeeds. Optionally import `loadDataFile` directly for a unit assertion
  (corrupt/absent path -> `ok:false`; valid -> `ok:true` with parsed `data`).
- **Verify:** `node --test cadence-core/bin/route.test.mjs cadence-core/bin/config.test.mjs` passes; pointing `CADENCE_ROUTE_TABLE`/`CADENCE_CONFIG_SCHEMA` at a corrupt file yields the `{ok:false, reason:'data-file'}` line rather than a crash. Existing route/config tests still green; `npx tsc -p tsconfig.ci.json` clean.

### Task 3: Surface a corrupt model-hints.json in review-provider (#43)

- **Files:** cadence-core/bin/review-provider.mjs, cadence-core/bin/review-provider.test.mjs
- **Action:** In `review-provider.mjs`, refactor the hints load inside
  `classify` (lines 519-523) into an exported helper `loadHints(hintsFile)`
  returning `{ rules, exclude, warning }`. Distinguish outcomes: a legitimately
  ABSENT file (ENOENT) yields `rules:[], exclude:[], warning:null` (stay silent
  - this is the benign-absence case the existing tests rely on); a present file
  that fails to parse (SyntaxError) or is otherwise unreadable yields
  `rules:[], exclude:[]` plus `warning` set to a string naming the file (e.g.
  `model-hints.json failed to load: <msg>`), and additionally writes that one
  line to stderr. `classify(provider, ids, hintsFile)` calls `loadHints` and
  returns the SAME model array shape as today (so the existing ordering,
  first-match, exclude, and all-unknown-degrade tests stay valid). Wire the
  warning to the operator through a NETWORK-FREE, testable seam: extract the
  detect-models result assembly into an exported pure helper
  `buildDetectResult(provider, ids, hintsFile)` that calls `loadHints`, runs
  `classify`, and returns `{ provider, models, ...(warning ? { hints_warning:
  warning } : {}) }` (the `hints_warning` key present only when a warning was
  produced). `cmdDetect` fetches the model `ids` (the live step) and then
  returns `ok(buildDetectResult(provider, ids, hintsFile))` - so the
  warning-surfacing logic lives entirely in a helper that a unit test can drive
  with pre-supplied `ids` and no network round-trip. The exclude-filter behavior
  itself is unchanged - only the silence on a broken file is fixed. Keep
  `@ts-check` clean and do not disturb the REV-01 realpath run-as-script guard
  below. In `review-provider.test.mjs`: (a) add a test importing `loadHints`
  that asserts `loadHints(<broken json path>).warning` is truthy and matches the
  filename, while `loadHints(<absent path>).warning` is null; (b) add a
  FAILING-CAPABLE test importing `buildDetectResult` that, given fixed `ids` and
  a corrupt hints file, asserts the returned object carries `hints_warning`
  (truthy, names the file), and that with a clean or absent hints file the
  result has NO `hints_warning` key - this is what catches a mis-wired
  `cmdDetect` (the operator-facing #43 deliverable), which a `loadHints`-only
  test cannot; keep the existing `'broken or missing hints degrade to
  all-unknown'` test green (classify's array return is unchanged).
- **Verify:** `node --test cadence-core/bin/review-provider.test.mjs` passes; the `loadHints` test fails if a corrupt hints file returns a null warning, and the `buildDetectResult` test fails if `cmdDetect`'s result omits `hints_warning` for a corrupt hints file (catching a mis-wired surfacing, not just `loadHints`). `npx tsc -p tsconfig.ci.json` clean.

### Task 4: Report skipped self-verify drift checks (#44)

- **Files:** cadence-core/bin/self-verify.mjs, cadence-core/bin/self-verify.test.mjs
- **Action:** In `self-verify.mjs`, stop letting an absent always-expected
  input skip a check invisibly. Collect a `skipped` list in `run(root)` and add
  an entry (naming the check and the absent path) whenever one of these guarded
  inputs is missing: each core surface dir in `mdFiles` (the
  `cadence-core/workflows|references|templates`, `skills`, `agents` dirs at
  lines 106-112 - lift the dir list so `run` can test presence and record
  skips, or have `mdFiles` push to a passed-in collector), the `agents` dir
  (line 272), the `weight-budgets.json` manifest (line 247), and `INTERNALS.md`
  (line 222). Return `skipped` from `run` and add it to the final `emit(...)`
  (line 313). Do NOT flip `ok` on a skip - `ok` stays `problems.length === 0`;
  a recorded skip is the surfaced signal (the issue explicitly permits a
  skipped-check note). Leave the `config.schema.json` load at line 149 unguarded
  (out of scope). Keep `@ts-check` clean and confirm the real-repo run still
  emits `ok:true` with `skipped: []` (the shipped repo has every input). In
  `self-verify.test.mjs`, add a test with a `--root` fixture that omits one
  expected input (e.g. no `cadence-core/templates` dir, or no `INTERNALS.md`)
  and assert `r.skipped` contains an entry naming it while `r.ok` is still
  driven only by `problems`; assert the existing default-root
  `'the repo itself passes self-verification'` test still holds with
  `skipped: []` (add that assertion).
- **Verify:** `node --test cadence-core/bin/self-verify.test.mjs` passes; `node cadence-core/bin/self-verify.mjs` on the real repo prints `ok:true` with an empty `skipped`; the new test fails if a missing input goes unrecorded. `npx tsc -p tsconfig.ci.json` clean.

## Notes

- #44 is fixed with a `skipped`-note surfaced in the output (not an `ok:false`
  failure). This is the issue's explicitly-permitted minimal faithful choice
  ("a problem, or at least a skipped-check note in the output") and it keeps the
  fix testable: forcing a hard failure would only be observable on the real
  default-root run, which the suite cannot make fail without deleting real repo
  dirs, whereas the `skipped` field is falsifiable from a `--root` fixture.
- #40 threads the shipped data-file path through a `CADENCE_ROUTE_TABLE` /
  `CADENCE_CONFIG_SCHEMA` env override solely to make the corrupt-data-file
  regression testable, mirroring the existing `CADENCE_GLOBAL_CONFIG` hermetic-
  test seam in `config-merge.mjs`; these are not config keys, so `self-verify`
  does not lint them.
- Recall note (CAPTURE.md, phase 1): a symlinked install returned a real
  cross-model result through the REV-01 seam - so Task 3 must not disturb the
  realpath run-as-script guard at the bottom of `review-provider.mjs` while
  editing `classify`/`loadHints` above it.
- Plan-review amendment (adjudicated `plan` trigger, cad-reviewer): Task 3
  gained a network-free `buildDetectResult` helper + a failing-capable test for
  the `hints_warning` surfacing, closing a grounded low finding that only
  `loadHints` was tested while the operator-facing #43 deliverable (the field on
  `detect-models` output) had no regression coverage. The DeepSeek cross-model
  reviewer timed out and was dropped; the review stands on the subagent.
- One PLAN.md per the CONTEXT plan-shape directive; no deviation. #39 and #40
  share `config.mjs`, `route.mjs`, and their test files, forcing them into one
  plan; #43/#44 are file-independent but the phase is small and cohesive, and a
  single plan is permitted by the independence test.
