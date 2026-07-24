# Phase 1: Silent data-file failures - Context

Gathered: 2026-07-24
Feeds: /cad-plan 1

## Scope boundary

In: An absent or malformed shipped data/config file is surfaced, never silently
swallowed into defaults, while the "never blocks the spine" seam contract holds.
Four filed bugs: #39 (config-merge malformed==absent), #40 (route.mjs /
config.mjs top-level parse crashes outside the dispatch guard), #43
(review-provider model-hints load failure disables the exclude filter silently),
#44 (self-verify silently skips absent always-expected inputs while staying
green). Each fix carries a failing-capable regression test (FIX-01).
Out: The by-design swallows this phase deliberately preserves - a bad runtime
layer is skipped, never made fatal; `self-verify.mjs:149`'s unguarded schema load
stays loud-on-corruption by design (#40 out-of-scope note, #44 model to follow).
The v1.2.0 by-design holdouts (git-guard fail-open, deepMerge scalar) are not
this phase. No new features.
Deferred: None
Plan shape: one plan

## Durable decisions

- D-01 (surfacing convention, #39/#43): a shipped runtime file that fails to
  *parse* (distinct from being legitimately absent) is surfaced via an additive
  `warnings[]` entry on the seam's JSON envelope, naming the file. One convention
  shared by config-merge (#39) and review-provider (#43). Existing
  `source`/`values`/`models` output stays byte-identical; absence stays silent,
  only a parse failure warns. Chosen over mutating `source` in place (breaks
  consumers that string-match it) and a stderr warning (breaks the one-JSON-blob-
  on-stdout convention). Evidence: `cadence-core/bin/lib/config-merge.mjs:21-24,47-57`,
  `cadence-core/bin/review-provider.mjs:519-524,59`.
- D-02 (relocate top-level parses, #40): `route.mjs:32` `TABLE` and
  `config.mjs:30-32` `SCHEMA` move behind the dispatch guard so a missing or
  malformed shipped data file degrades to `{ok:false,reason,detail}` on stdout
  instead of a raw SyntaxError. `self-verify.mjs:149`'s identical unguarded load
  stays as-is by design (dev/CI tool, may fail loud). Evidence:
  `cadence-core/bin/route.mjs:31-32`, `cadence-core/bin/config.mjs:29-32,213`,
  `cadence-core/bin/self-verify.mjs:147-150`.
- D-03 (self-verify severity, #44): a missing *always-expected* input (a core
  surface dir, `weight-budgets.json`, `INTERNALS.md`) yields `ok:false` on a
  real-repo run, gated so a minimal `--root` fixture that omits optional inputs
  stays `ok:true`. Follows `self-verify.mjs:149`'s fail-loud model; chosen over a
  soft skipped-note-but-green (a dropped check must break the build, not scroll
  past). Evidence: `cadence-core/bin/self-verify.mjs:113-114,222,246-247`,
  `cadence-core/bin/self-verify.test.mjs:24-34,90-111`.

## Decisions

- D-04 (fail-safe preserved): every runtime-seam fix (#39, #40, #43) keeps the
  seam non-fatal - a bad file is skipped or degraded, never crashes the spine;
  only visibility changes. `classify()` still returns its candidate array and a
  broken hints file never blocks provider setup. Evidence:
  `cadence-core/bin/review-provider.mjs:507,517-534`,
  `cadence-core/workflows/config-review.md:34-45`.
- D-05 (regression tests rewrite the silent-contract assertions):
  `config.test.mjs:182-191` and `review-provider.test.mjs:135-145` currently
  *assert* the byte-identical broken==absent behavior being fixed; they are
  rewritten, not merely supplemented, so no test keeps asserting the silent
  contract. Evidence: `cadence-core/bin/config.test.mjs:182-191`,
  `cadence-core/bin/review-provider.test.mjs:135-145`.

## Acceptance criteria

- [ ] With a syntactically malformed `.planning/config.json`, `config.mjs get`
      returns `ok:true` whose `values` and `source` equal the no-repo-layer
      result AND a `warnings[]` entry naming the file that failed to parse; with
      the file merely absent, no such warning appears.
- [ ] With `route-table.json` (route.mjs) or `config.schema.json` (config.mjs)
      absent or malformed, invoking the script emits exactly one
      `{ok:false,reason,detail}` JSON line on stdout with no raw stack trace.
- [ ] `review-provider.mjs detect-models` with a malformed
      `references/model-hints.json` returns `ok:true` with candidate models AND a
      `warnings[]` entry naming the load failure; a valid-but-ruleless hints file
      produces no such warning, so the two outputs are distinguishable.
- [ ] `self-verify.mjs` run against the real repo with an always-expected input
      removed (e.g. `weight-budgets.json` deleted, or a core surface dir renamed)
      exits `ok:false` naming the missing input; run against a minimal `--root`
      fixture that omits optional inputs it still exits `ok:true`.
- [ ] Each of #39, #40, #43, #44 has a test that reproduces the pre-fix
      silent/crash behavior and asserts the surfaced behavior, and
      `node --test cadence-core/bin/*.test.mjs` passes.

## Flagged assumptions

None - all assumptions confirmed
