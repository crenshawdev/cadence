# Task: release-tag-ci-gate

## What shipped

- Closed the release-pipeline gap recorded in .planning/CAPTURE.md and verified against the live rulesets 2026-08-25.
- Before: release.yml triggered on `tags: ['v*']` and ran only version-match, CHANGELOG-slice and `gh release create`. test.yml fires on `push: branches: [main]` and `pull_request` and never on tags, and the `protect-release-tags` ruleset (id 19145547) carries only `deletion` and `non_fast_forward`, neither of which constrains where a new tag may point. So `git tag v9.9.9 <any-sha> && git push origin v9.9.9` published an official release from a SHA that never reached main and that no CI had seen.
- After: a `guard` job runs first and `publish` carries `needs: guard`. The guard asserts BOTH conditions - the tagged commit is reachable from `origin/main` (`git merge-base --is-ancestor`, on a fetch-depth: 0 checkout), and the zero-dep suite is green for that exact SHA (`test.mjs` full run plus `self-verify.mjs`). Reachability alone would admit a red commit sitting on main; a green suite alone would admit any SHA. test.yml's `typecheck` arm is deliberately not duplicated - it needs an ephemeral `npm install` - and the comment in the file says so.
- Also pinned `actions/checkout@v4` to `11d5960a326750d5838078e36cf38b85af677262` (v4.4.0, resolved live from the actions/checkout tag refs) at both call sites in release.yml, including the one in the `contents: write` publish job that the capture named. The three checkouts in test.yml are `contents: read` and were left alone as out of scope.
- Verification was observed, not assumed: `git merge-base --is-ancestor` was run locally against real refs and discriminates correctly - the merge-base commit 6224e290 (on main) passes and this branch's HEAD (not on main) is refused. The file parses as YAML after each edit, with jobs [guard, publish] and publish needs guard. actionlint is not installed on this machine, so the workflow was not linted.

## Commits

| Task | Commit | Description |
| --- | --- | --- |
| 1 | 0cd498a4ae7fc224c976b4c3d1ef151887f6d5ee | ci: refuse a release tag that is not a green commit on main |
| 1 | a3b2a908a8d55d6217b4a4669a0b91a6bd8a1b1e | ci: pin actions/checkout to a full commit sha in the release workflow |

## Files

### Task 1: release-tag-ci-gate

- **Files:** .github/workflows/release.yml
