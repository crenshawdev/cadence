---
phase: 2
plan: 2
requirements: [GIT-03]
files:
  - cadence-core/bin/git-guard.mjs
  - cadence-core/bin/git-guard.test.mjs
  - skills/cad-land/SKILL.md
  - cadence-core/references/git.md
---

# Phase 2: Land cleanup + autonomous close - Gap-closure Plan

## Goal

Close the GitHub arm of GIT-03: under `git.auto_close`, `/cad-land` can open a
PR for the local-only integration branch fully unattended - the required push
no longer halts at git-guard's ask prompt - while ordinary/interactive pushes
and pushes to a protected base stay guarded exactly as before.

## Must be true when done

- With `git.auto_close: true` in config, a `git push -u origin <branch>` of a
  non-protected branch produces NO permission prompt from git-guard (the hook
  stays silent), so the GitHub auto_close chain reaches `gh pr create` without
  a human.
- With `git.auto_close` false or absent (the default), a `git push` still asks -
  the no-default publish posture (D-08) and rail 3's protection for
  ordinary/interactive pushes are unchanged.
- Even with `git.auto_close: true`, a push while HEAD is on a protected branch
  (git.protected_branches) still asks.
- Even with repo `git.auto_close: true` and HEAD on a non-protected branch, a
  push that is NOT a plain publish of the current branch still asks: any of
  `--force`/`-f`/`--force-with-lease`/`--all`/`--mirror`/`--tags`/`--delete`/`--prune`,
  or a `src:dst` refspec whose destination is another (esp. protected) branch
  (e.g. `git push origin cadence/x:main`). The exemption WHITELISTS the sanctioned
  shape; it does not blanket-allow pushes while auto_close is on (review finding 1).
- The exemption reads `git.auto_close` from the REPO config layer only, not a
  user-global default, so a global `auto_close` never silently mutes the push
  guard in unrelated Cadence projects (review finding 2).
- cad-land's GitHub step 4b performs an explicit `git push -u origin <branch>`
  before `gh pr create`, and its prose no longer claims `gh pr create` "pushes
  it"; the GitLab path documents that `glab mr create` pushes the source branch
  itself (no explicit push).
- `git.md` rail 3 truthfully describes the auto_close push exemption; no prose
  asserts the auto_close path involves no `git push`.
- `node --test 'cadence-core/bin/*.test.mjs'` and
  `node cadence-core/bin/self-verify.mjs` both stay green.

## Context

Locked decisions bind this plan: D-07 (auto_close lands via host-CLI PR/MR
merge), D-08 (auto_close never changes the default off-path posture - a normal
push still asks), rail 3 (references/git.md, "never auto-push"). `auto_close`
is already a defined config key (config.schema.json:34, templates/config.json,
config.md, git.md) - this plan adds NO config key and NO subcommand, only a new
decision branch in git-guard plus prose truth-fixes. Do NOT touch the shipped
close-decision.mjs / land-cleanup.mjs code (item 8 already fixed). Guard chosen
approach (narrowed after plan review): exempt ONLY a plain publish push of the
current non-protected branch, and ONLY when the REPO config sets
`git.auto_close === true`. Any dangerous form (`--force`/`--force-with-lease`/`--all`/`--mirror`/`--tags`/`--delete`/`--prune`,
or a `src:dst` refspec whose destination is another/protected branch), a
protected-branch HEAD, a global-only auto_close, and every push with auto_close
off, all still ask. Whitelist the sanctioned shape rather than blacklisting the
dangerous ones - safer default for a security rail.

## Tasks

### Task 1: Exempt the unattended feature-branch push in git-guard, with tests

- **Files:** cadence-core/bin/git-guard.mjs, cadence-core/bin/git-guard.test.mjs
- **Action:** Restructure `main()` so branch/config are available to the push
  path. After computing `subs`, `isPush`, `isCommit`, return early when neither
  is present. Add a `currentBranch()` helper wrapping the existing
  `execFileSync('git', ['-C', cwd, 'rev-parse', '--abbrev-ref', 'HEAD'], { encoding:'utf8', stdio:['ignore','pipe','ignore'] }).trim()`,
  returning `''` on throw; reuse it in the commit path in place of the inline
  rev-parse. Derive `protectedBranches` from the merged config
  (`mergeLayers(join(root,'.planning','config.json')).config.git`,
  `Array.isArray(git.protected_branches) ? ... : ['main','master']`).
  For the exemption, read `git.auto_close` from the REPO layer ONLY - parse
  `.planning/config.json` at `root` directly (`JSON.parse(readFileSync(...))`
  inside try/catch, `false` on missing/bad/absent-key), NOT the merged/global
  value - so a user-global `auto_close` never mutes the guard in unrelated repos
  (review finding 2). In the push branch, exempt (silent `return`, allow) ONLY
  when ALL hold: (1) repo `git.auto_close === true`; (2) `branch = currentBranch()`
  is non-empty and NOT in `protectedBranches`; (3) the push is a PLAIN publish of
  the current branch, decided by a small pure `isPlainPush(command, branch,
  protectedBranches)` helper (unit-testable, mirrors `gitSubcommands`' quote-strip
  + split): it returns true ONLY when the `push` segment contains none of the
  dangerous tokens `--force`/`-f`/`--force-with-lease`/`--all`/`--mirror`/`--tags`/`--delete`/`--prune`,
  no token contains `:` (no `src:dst` refspec), and every non-flag positional
  after the remote is either absent or exactly `branch` (so bare `git push`,
  `git push -u origin <branch>`, `git push origin <branch>` qualify; a positional
  naming a protected branch or any other branch does not). Otherwise fall through
  to the existing `decide('ask', ...)`. Keep the ask reason, appending that a
  plain publish of the current non-protected branch under repo `git.auto_close`
  is exempt (cad-land's sanctioned unattended push). Do NOT exempt when auto_close
  is off, when HEAD is protected, when auto_close is only global, or for any
  non-plain push - all still ask (D-08 + rail 3). In git-guard.test.mjs add
  cases, each driving the real hook entry (`guard(command, cwd)` -> stdin JSON,
  stdout decision or null): (a) repo auto_close true + `git push -u origin
  cadence/v1.1.0-rc.2` on that branch -> `guard(...) === null`; (b) repo
  auto_close true + `git push origin main` on `main` -> `permissionDecision ===
  'ask'`; (c) auto_close explicitly false + feature push -> `ask`; (d) repo
  auto_close true + `git push --force origin cadence/v1.1.0-rc.2` on that branch
  -> `ask`; (e) repo auto_close true + `git push origin cadence/v1.1.0-rc.2:main`
  -> `ask`; (f) auto_close set ONLY in the global layer (via `CADENCE_GLOBAL_CONFIG`,
  repo config omits it) + feature push -> `ask` (proves the repo-layer read).
  Leave the existing "git push always asks" default test intact.
- **Verify:** `node --test cadence-core/bin/git-guard.test.mjs` passes including
  the six new cases; `node --test 'cadence-core/bin/*.test.mjs'` reports 0
  failures; `node cadence-core/bin/self-verify.mjs` exits 0 with empty problems.

### Task 2: Correct cad-land step 4b to push the branch before opening the GitHub PR

- **Files:** skills/cad-land/SKILL.md
- **Action:** In step 4b's "Open (or reuse) the PR/MR" bullet (~lines 68-76),
  remove the false claim that opening the PR "pushes it" and the line "gh/glab
  are not git push, so the git-guard push hook never prompts and the chain
  holds." Replace with: on GitHub the integration branch is local-only, and
  `gh pr create --head <branch>` will NOT push a branch with no remote
  non-interactively (it prompts/errors), so run `git push -u origin <branch>`
  first, then `gh pr create --base <base> --head <branch> --fill`. State that
  under repo `git.auto_close` git-guard exempts ONLY this plain publish push of
  the current non-protected branch so it runs without a prompt - a
  force/refspec/`--all` push, a push while HEAD is on a protected branch, and
  every push with auto_close off, all still ask. Note that on GitLab
  `glab mr create --source-branch <branch>
  --target-branch <base> --fill` pushes the source branch itself, so no explicit
  push is needed there. Keep the existing reuse-when-open behavior (`gh pr view`
  / `glab mr view`). Do not alter the merge or cleanup bullets. Also update the
  `<guardrails>` exception block (~lines 108-112): it currently frames the
  `git.auto_close` exception as `PR -> merge -> reset` with no push, which now
  contradicts the sanctioned step-4b push - extend it to acknowledge the one
  sanctioned integration-branch publish push under `auto_close` (non-protected
  branch, guard-exempt), keeping the "no auto-push by default / off-path
  unchanged" framing. If the touched byte count exceeds the file's weight-budget
  entry, raise that entry to the new size (matching the shipped phase-2 deviation
  pattern).
- **Verify:** `grep -n "git push -u origin" skills/cad-land/SKILL.md` shows the
  new push on the GitHub path; `grep -n "pushes it" skills/cad-land/SKILL.md`
  returns nothing; `grep -n "auto_close" skills/cad-land/SKILL.md` shows both
  step 4b and the `<guardrails>` exception acknowledge the push; `node
  cadence-core/bin/self-verify.mjs` exits 0 (no weight-budget or inert-config-key
  regression).

### Task 3: Make git.md rail 3 truthful about the auto_close push exemption

- **Files:** cadence-core/references/git.md
- **Action:** In rail 3 (~lines 89-96) the auto_close paragraph currently reads
  "That is a platform merge, not a `git push`, so the never-auto-push rule
  holds." Since the GitHub path now pushes the integration branch before the
  platform merge, revise this to state accurately: the platform PR/MR merge is
  not a push, AND a plain publish push of the current non-protected branch is
  exempted by git-guard ONLY when repo `git.auto_close` is on - a
  force/refspec/`--all` push, a push while HEAD is on a protected branch, a
  global-only auto_close, and every push with auto_close off, all still ask - so
  the never-auto-push rule and the no-preselected-default posture both still
  hold. Describe the exemption in terms of what the guard actually checks
  (repo-layer auto_close, HEAD's branch, and a whitelisted plain push); do not
  claim it is scoped to cad-land's single push (any plain publish push of a
  non-protected branch qualifies) nor claim destination/refspec protection
  beyond the whitelist.
  Keep the "blocking pre_ship finding still halts" sentence. Do not touch rails
  1, 2, or 4.
- **Verify:** `grep -n "auto_close" cadence-core/references/git.md` shows rail 3
  describes the push exemption; the paragraph no longer asserts the auto_close
  path involves no `git push`; `node cadence-core/bin/self-verify.mjs` exits 0.

## Notes

- The two live end-to-end paths (a real GitHub remote + `gh` unattended
  PR-open/merge) remain human-verify, as flagged in the phase SUMMARY goal
  check; this plan is verified at the guard-behavior and prose-truth layer,
  which is where the gap (UAT item 9) actually lives.
- Recalled prior art (CAPTURE.md, phase 2): the naive "git push -u before
  gh pr create" fix is wrong on its own because it trips git-guard's
  ask-on-every-push; Task 1's guard exemption is what makes Task 2's push safe
  under auto_close.
- Scope note (from plan review): the exemption is a WHITELIST, not a blanket
  auto_close pass. It fires only for a plain publish push of the current
  non-protected branch, read from the REPO config layer. A `src:dst` refspec
  (incl. one targeting a protected base), a `--force`/`--all`/`--mirror`/`--tags`
  push, a protected-branch HEAD, and a global-only auto_close all fall through
  to the existing ask - so no destructive or protected-destination push is
  silently allowed (review findings 1 and 2). This is deliberately broader than
  "cad-land's single push" (any plain publish push of a non-protected branch
  under repo auto_close qualifies); the prose is worded to that actual breadth,
  not narrower (review finding 3). The live end-to-end GitHub path (real remote
  + gh) remains human-verify, as in the phase SUMMARY.
