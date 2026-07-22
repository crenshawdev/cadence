---
phase: 1
status: complete
completed: 2026-07-22
---

# Phase 1: Repair the cross-model review seam - Summary

`review-provider.mjs` now resolves its run-as-script guard by realpath on both
operands, so a symlinked plugin install runs the script instead of no-opping;
the `fire()` review path surfaces an empty/unusable (`ok:false`) provider result
as one visible line before the subagent fallback; a symlink regression test
guards the fix.

## What shipped

- Realpath-canonicalizing run-as-script guard (`isRunAsScript()`, `path.resolve`
  fallback on throw per D-02) - `cadence-core/bin/review-provider.mjs`
- Symlink regression test asserting a single non-empty parseable JSON line -
  `cadence-core/bin/review-provider.test.mjs`
- `fire()` step-4 `ok:false` path emits one visible degradation line (reviewer +
  `reason`) before the `claude-subagent` fallback; `ok:true` clean-pass path
  unchanged (D-04) - `cadence-core/references/review-triggers.md`

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | 4721e84 | `fix(1-1)`: compare realpaths in the run-as-script guard (D-01/D-02/D-03) |
| 1 | 2 | 9f3c7d5 | `test(1-1)`: symlink regression test for the entry guard (D-05) |
| 1 | 3 | 1d79a17 | `docs(1-1)`: surface empty/unusable provider results before the subagent fallback (D-04) |
| 1 | 4 | (no commit) | verification only - no files modified; drift/type/suite gate (D-06) |

## Deviations

None - plans executed as written.

## Open items

- (phase 1, human-verify) A live `fire()` run with an empty/failing provider
  result must show the degradation line printed before the `claude-subagent`
  fallback. Needs a configured or deliberately-failing provider. (CONTEXT
  acceptance criterion, carried in PLAN Notes.)
- (phase 1, human-verify) A symlinked plugin install with a real cross-model
  provider key must return an actual cross-model result instead of no-opping to
  the subagent. Needs a configured provider API key. (CONTEXT acceptance
  criterion, carried in PLAN Notes.)
- (phase 1, diff-review low) `references/review-triggers.md` step-4 example line
  hardcodes "falling back to claude-subagent", but the subagent fallback fires
  only when dropping the reviewer empties the set; in a multi-provider panel
  (e.g. `openai` + `gemini`) dropping one leaves the other, so the emitted line
  would falsely announce a fallback that does not occur. One-line prose fix
  (scope the fallback clause to the set-empties case, or make the example about
  the drop only). Surfaced by the advisory `diff` trigger, not a plan deviation.

## Goal check

The three commits plausibly deliver REV-01's three parts. The guard fix
(`4721e84`) makes a symlinked invocation emit an identical non-empty JSON line to
the real-path invocation - verified directly, `detect-models --provider skynet`
prints `{"ok":false,"reason":"bad-provider","detail":"unknown provider: skynet"}`
with exit 1 both ways, where before the symlinked call printed nothing. The
regression test (`9f3c7d5`) asserts a single non-empty parseable JSON line and
was shown to actually guard the fix: reverting `4721e84` fails only the new test
(21/22), restoring it returns 22/22. The surfacing prose (`1d79a17`) rewrites the
step-4 `ok:false` bullet to emit one visible degradation line before the
`claude-subagent` fallback, scoped strictly to `ok:false` so the `ok:true`
empty-findings clean pass is untouched. No CONTRACTS/schema drift (D-06):
`node cadence-core/bin/self-verify.mjs` exits 0, `tsc -p tsconfig.ci.json` is
clean, and `node --test cadence-core/bin/*.test.mjs` is green at 245/245. What is
not settled by code: the two human-verify acceptance criteria (a live
degradation line, and a keyed symlinked cross-model run) inherently need a live
or configured provider and are carried as open items; the low-severity prose
inconsistency the `diff` review found is also open.
