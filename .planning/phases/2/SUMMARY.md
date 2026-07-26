---
phase: 2
status: complete
completed: 2026-07-26
---

# Phase 2: Seam input validation - Summary

A shared `requireInt` seam guard plus call-site guards on every flag the phase
named: bad `--total`/`--phase`, valueless or empty `--reqs`, and non-integer
`--attempt` now fail with `bad-args`/`usage` before any write, and a non-object
top-level config is rejected on all three faces - validate, read/merge, and
(plan 2) the `set` write face.

## What shipped

**Plan 1 - the named requirements (#42, #45.1-.3)**

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

**Post-UAT fixes (during phase-2 verification)**

- `cursor set --phase`/`--total` guards aligned with the STATE.md format itself
  (non-negative, no exponent), so a value the guard accepts is one `parseCursor`
  can read back - `cadence-core/bin/planning.mjs`
- `phase-done --reqs` keys off flag presence, not truthiness, so `--reqs ""`
  (an empty interpolated variable) is refused instead of bulk-closing the whole
  phase - `cadence-core/bin/planning.mjs`

**Plan 2 - the gaps plan (UAT items 9, 10)**

- `config.mjs set` rejects a non-object top-level config before writing:
  `ok:false, reason:"invalid"` naming `(root)`, target file byte-identical,
  never `reason:"internal"` with a raw JS message. `isPlainObject` is now
  exported from `config-merge.mjs` so both faces share one predicate -
  `cadence-core/bin/config.mjs`, `cadence-core/bin/lib/config-merge.mjs`
- `readLayer` gained a `present` field and `mergeLayers` gates the
  skipped-layer warning on presence rather than truthiness, so a layer
  truncated to `null`/`0`/`false`/`""` warns exactly like a truthy scalar;
  an absent layer stays silent and an unparseable one warns exactly once -
  `cadence-core/bin/lib/config-merge.mjs`
- 6 new regression tests across both faces - `cadence-core/bin/config.test.mjs`
- `cadence-core/workflows/config.md` documents the write-face rejection

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | 4e624df | add shared requireInt numeric-flag validator |
| 1 | 2 | 0fac729 | reject non-integer `cursor set --total` before write (#42) |
| 1 | 3 | d8e83d9 | reject valueless `phase-done --reqs` before write (#45.1) |
| 1 | 4 | 94f2c75 | reject non-integer `resolve --attempt` instead of silent coercion (#45.2) |
| 1 | 5 | 7625984 | reject scalar top-level config on validate and read faces (#45.3) |
| - | - | bf48810 | align `cursor set --phase`/`--total` guards with the STATE.md format |
| - | - | 68061f5 | refuse an empty `phase-done --reqs` instead of closing the whole phase |
| 2 | 1 | 9a99a07 | reject a non-object top-level config on the `set` write face |
| 2 | 2 | 346c2b0 | warn on a falsy non-object config layer, not just a truthy one |

## Deviations

- Plan 1: none introduced by execution. The plan's own Notes already recorded
  the one departure from CONTEXT D-02's literal wording: the read-face guard
  sits at the `mergeLayers` top-level call rather than inside `deepMerge`'s
  per-key recursion, because guarding the recursion would discard legitimate
  nested scalar repo overrides. D-02's locked outcome (read path stops
  returning the scalar, `source` no longer reports `repo`) is delivered
  exactly (7625984).
- [deviation] Plan 2 task 1's doc edit pushed `cadence-core/workflows/config.md`
  from 13360B to 13613B, past its `weight-budgets.json` entry;
  `self-verify.mjs` caught it as a real test failure in `self-verify.test.mjs`.
  Rebudgeted to the new measured size (confirmed by
  `node cadence-core/bin/weight.mjs`) inside task 2's commit (346c2b0);
  `self-verify.mjs` reports `ok:true, problems:[]` again.
- [deviation, cosmetic] 346c2b0's commit message contains a typo
  ("diagnosic"). Left as-is rather than rewriting a landed commit.

## Open items

Found by the `diff` review trigger on 66aed5d..HEAD (advisory gate,
`adjudicated` mode - each claim re-run against the code here, not taken on the
reviewer's word):

- **REGRESSION, introduced by 9a99a07: `setInto` destroys a non-object
  container one level below the one it now protects.** With
  `F = {"git":["main","master"]}`, `config.mjs set --file F git.on_protected=allow`
  returns `{"ok":true,"changed":[{"key":"git.on_protected","value":"allow"}]}`
  and rewrites F as `{"git":{"on_protected":"allow"}}` - both branch names gone,
  nothing in `changed[]` or `warnings` saying a container was discarded
  (`cadence-core/bin/config.mjs:164`). At 66aed5d the same command left the
  array intact and silently dropped the change instead. So the phase traded
  "lose the change, keep the data" for "lose the data, keep the change" at
  depth >= 1, under exactly the condition it now refuses at depth 0. The fix is
  to make the mid-path container check fail the way the top-level one does:
  `ok:false` naming the path, file untouched.
- **A single file that resolves as BOTH the global and the repo layer warns
  twice.** `mergeLayers` reads `GLOBAL_CONFIG` and `repoFile` as independent
  layers with no identity check (`lib/config-merge.mjs:92`), so with
  `CADENCE_GLOBAL_CONFIG=/tmp/g.json` containing `null`,
  `config.mjs get --global granularity` returns two identical
  `warnings[]` entries for one file. Pre-existing for truthy scalars; 346c2b0's
  `present` gate extends the doubling to falsy layers, which previously produced
  zero entries. Cosmetic (no data or resolution effect), but it breaks the
  "exactly one entry per non-object layer" property the change is built on.
- Minor, carried from plan 1: `planning.test.mjs:376`'s
  `JSON.stringify(r).includes('NaN') === false` is vacuous - `JSON.stringify`
  renders NaN as `null`, so it passes on unpatched code too. The test stays
  failing-capable through its `r.ok`/STATE.md assertions, so this is a wart,
  not a coverage hole.
- Tooling, not code: the `openai` cross-model reviewer could not run this phase
  either - `review.providers.openai.tiers.balanced` is pinned to
  `gpt-5.1-codex-mini`, which the provider returns
  `404 model_not_found / deprecated` for. The review ran with `claude-subagent`
  + `deepseek` only. Re-point the tier via `/cad-config`.

Reviewer claims that did NOT survive adjudication:

- `deepseek`: "`source` is `global+repo` when the repo layer is skipped."
  Refuted by direct run - with a `[1,2,3]` repo layer and an object global
  layer, `get` returns `"source":"global"` with one warning, identical at
  66aed5d and HEAD. The skipped layer is already excluded from the label.
- (plan 1, carried) that `requireInt` wrongly rejects a numeric argument, and
  that accepting `"4.0"` as `4` is a defect.

## Goal check

The goal's enumerated cases are now all delivered and independently re-verified
at phase close, not merely reported by the executors. `config.mjs set` on a
top-level `[1,2,3]` and on `42` both return
`{"ok":false,"reason":"invalid","detail":[{"key":"(root)",...}]}` with the target
file's md5 unchanged across the call - the write face that UAT item 9 failed on,
and the `reason:"internal"` raw-JS-message class D-04 targets, are both closed.
Each of `null`, `0`, `false`, `""` as a whole config layer now yields exactly one
`warnings[]` entry where it previously yielded none, while an absent file still
returns `source:"global"` with no `warnings` key at all - UAT item 10's
presence-vs-truthiness distinction. `cursor set --total -2 / --phase -1` and
`phase-done --reqs ""` (the two post-UAT gaps) are refused with `bad-args`
leaving STATE.md byte-identical. `node --test cadence-core/bin/*.test.mjs`
reports 292 pass / 0 fail and `tsc -p tsconfig.ci.json` exits clean, both re-run
here at HEAD. The honest remaining gap is that the goal's generalization - "no
bad flag can corrupt STATE.md or pass config validation" - is now violated one
level deeper than it was: 9a99a07 closed the top-level write face but introduced
a path where a non-object container at depth >= 1 is silently replaced and its
contents lost (`{"git":["main","master"]}` -> `{"git":{"on_protected":"allow"}}`,
`ok:true`, verified live at HEAD against 66aed5d). The phase closes its four
named requirements and both UAT gaps; it does not yet close the class those
requirements were drawn from, and it added one new instance of that class.
