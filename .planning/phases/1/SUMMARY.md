---
phase: 1
status: complete
completed: 2026-08-18
---

# Phase 1: What a wrong answer destroys - Summary

The two checks whose wrong answer costs something irreversible now refuse rather than proceed: `redactUrl` redacts a URL userinfo span the 4096-byte sanitize window cut before its `@`, and `cad-phase remove` refuses a git state it could not read instead of classifying it as clean and deleting `phases/<N>/` recursively.

## What shipped

- End-of-input userinfo alternatives (`SCHEME_USERINFO_CUT`, `BARE_USERINFO_CUT`) applied after the two terminated rules - `cadence-core/bin/lib/redact-url.mjs`
- `bodyExcerpt` exported so its falsifier runs at unit level - `cadence-core/bin/review-provider.mjs`
- `uncommittedUnder` returning `{paths, unreadable}` so its caller sees three states rather than two, with a new `unreadable-git-state` refusal - `cadence-core/bin/planning.mjs`
- `gitDirAbove` / `gitDirUnder`, the filesystem classifier gating the `rmSync` fallback at, above and inside the target - `cadence-core/bin/planning.mjs`
- `cwd: dir` on the apply loop's `git rm`, so it resolves the phase directory's repository rather than the caller's - `cadence-core/bin/planning.mjs`
- Falsifiers for both requirements plus two source rows pinning the guard mechanism - `cadence-core/bin/redact-url.test.mjs`, `review-provider.test.mjs`, `planning.test.mjs`

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | 63fb7e7 | Export `bodyExcerpt` so its falsifier runs at unit level |
| 1 | 2 | 534a5b3 | Redact a URL userinfo span the sanitize window cut before its `@` |
| 1 | 3 | 79923e6 | Cover the cut-userinfo alternatives and their port boundary |
| 1 | 4 | 5af7158 | EXP-02 falsifier at both parametrizations, watched at ae73dd6 |
| 2 | 1 | f4c0fc1 | `renumber remove` refuses a git state it could not read |
| 2 | 2 | 99ba45c, 1309450 | Gate the `rmSync` fallback on the same `.git` probe; refusal states only what it knows |
| 2 | 3 | e7ec6e4 | PHS-01 falsifier - unreadable git state refuses, non-repo removes |
| 2 | gate | fec446e | Close the three fail-open paths the `risk_surface` review found in the delete guard |
| 2 | gate | c0b0d04 | Probe for `.git` in the nested scan instead of matching entry names |

Range: `ffeaa3f..c0b0d04`, 13 commits including the two worktree merges.

## Deviations

- [deviation] Plan 1, task 4 - the plan names "#215's own parametrization" as a fixture, but #215's body is not recoverable from this tree: the v3.5.3 phase-3 artifacts were pruned at `bc04ef6` and only the ROADMAP's magnitude survives. Built parametrization one as the URL-position twin of the fire's surviving quoted-value fixture and recorded its MEASURED figure at `ae73dd6` (73 bytes) rather than restating the issue's ~36. The high-magnitude case measured 985 bytes, clearing the >=900 bar. Commit 5af7158.
- [deviation] Plan 2, task 2 - the apply loop's `git rm` passed no `cwd`, so git resolved the repository from the caller's process cwd rather than from `--dir`; every remove under a `--dir` outside the caller's repository had been falling through to the `rmSync` fallback with `git rm` never running. Added `cwd: dir`, matching what `uncommittedUnder` has always used. Commit 99ba45c.

## Open items

- `gitMv` has the identical missing-`cwd` defect the plan-2 deviation fixed for `git rm`: a dir move under a foreign `--dir` falls back to `renameSync` and is never recorded in the index. Non-destructive (it renames rather than deletes) and outside phase-1 scope.
- An EMPTY `phases/<N>/` inside a real repository now returns `partial-apply` with the "nothing was written, safe to re-run" hint, because `git rm -r` answers "pathspec did not match any files" and the gate refuses the fallback. Non-destructive and re-runnable after an `rmdir`, but a case that used to succeed silently.
- `risk_surface` survivor (medium): the `GIT_DIR`/`GIT_WORK_TREE` check treats any non-empty value as proof a repository covers the target, so a stale or unrelated variable refuses a legitimate removal. Fails safe - a refusal, not a delete.
- `risk_surface` survivor (medium): `gitDirUnder` recurses without a depth bound, one call frame per level; a deep chain exhausts the stack and surfaces as a `partial-apply` refusal. Fails safe for the same reason.
- Declined the fuller "only at a window edge" signal for `redactUrl` - a `windowed` flag or second entry point applying the unterminated rules to `bodyExcerpt`'s cut prefix alone. Stated cost: a body ENDING in a bare `scheme://authority` now comes back `<redacted>`.
- Declined carrying git's own stderr into the fallback's refusal detail; the detail names the exact `git rm -r --` command instead.

## Goal check

The sum of these commits delivers the phase goal, and both halves are backed by a falsifier watched failing at `ae73dd6` rather than by assertion. For EXP-02, `redact-url.mjs` gained two end-of-input alternatives applied after the terminated rules (534a5b3), and the falsifier at 5af7158 measured 73 bytes of planted secret surviving the excerpt at the unpatched sha on #215's shape and 985 bytes on the high-magnitude case, both zero at HEAD; `redactUrl('https://example.com:8080/path')` is byte-identical mid-body and at end-of-input, so the new anchor does not read a port as userinfo. For PHS-01, `uncommittedUnder` now returns `{paths, unreadable}` and the caller refuses on the third state (f4c0fc1), the `rmSync` fallback carries its own independent gate (99ba45c, 1309450), and the falsifier at e7ec6e4 showed the unpatched tree returning `ok:true` with `{"rm":"phases/3"}` among its ops and `phases/3/PLAN.md` gone. The blocking `risk_surface` review found the classifier itself fail-open in three states no plan task had reached - a `GIT_DIR`-selected repository, an errored probe, and a repository rooted inside the target - all three closed at fec446e with two more falsifiers watched failing at `ae73dd6`, and the re-armed round's surviving `high` (a case-sensitive name comparison where `gitDirAbove` probes) closed at c0b0d04. Full suite 2174 pass / 0 fail / 1 skipped and `tsc -p tsconfig.ci.json` exit 0 at HEAD. What is NOT closed and should not read as closed: the two medium `risk_surface` survivors above, both of which fail toward refusing a legitimate removal rather than toward deleting; and the `gitMv` missing-`cwd` defect, which is the same class as the deviation plan 2 fixed but was left out of scope.
