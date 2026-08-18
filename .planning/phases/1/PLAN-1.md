---
phase: 1
plan: 1
requirements: [GRD-01]
files:
  - cadence-core/bin/lib/protected-branches.mjs
  - cadence-core/bin/protected-branches.test.mjs
  - cadence-core/bin/git-guard.test.mjs
  - cadence-core/bin/land-cleanup.test.mjs
  - cadence-core/bin/issue-check.test.mjs
  - cadence-core/references/config-reach.md
  - cadence-core/bin/weight-budgets.json
---

# Phase 1: The guards that remove a protection - Plan 1

## Goal

A `git.protected_branches` value that reads as set resolves to a list that
actually protects: a string `""`, a whitespace-only string and a list whose
entries are empty all fall to `['main','master']` rather than to `[""]`, and the
two callsites that index `[0]` get a base ref naming a real branch.

## Must be true when done

- With `git.protected_branches` set to the string `""` in the repo config layer,
  a `git commit` on `main` is guarded again: `git-guard.mjs` returns a
  protected-branch decision naming `main` instead of `null`.
- No list the resolver returns contains an empty or whitespace-only entry, for
  any of the six values in AC1, and each of those six answers is asserted as its
  own row.
- `protected_branches: []` still means nothing is protected (prior D-09
  unchanged), and `protected_branches: "release"` still protects `release`
  (`#38` unchanged) - neither falls back.
- Under `protected_branches: ""` with no `git.base_branch` and no `--base`,
  `land-cleanup.mjs` reports `base: "main"` and `issue-check.mjs` reports the
  issues its branch's commits reference rather than an empty list.
- Both places in the tree that count this resolver's readers say five, and name
  the same five.
- `node --test cadence-core/bin/*.test.mjs` and
  `node cadence-core/bin/self-verify.mjs` both pass.

## Context

CONTEXT.md D-01 (the grammar applies to ARRAY ELEMENTS as well as to the string
spelling - both filter to non-empty trimmed strings, written down and tested per
row), D-02 (a filter that EMPTIES a non-empty input falls back to the DEFAULT
`['main','master']`, never to `[]`; an input that was already `[]` stays `[]`),
D-03 (prior D-08 is NOT reopened - `config.mjs validate` keeps rejecting a string
as `array_string`, so `cadence-core/config.schema.json` and
`cadence-core/bin/config.mjs` are out of scope), D-09 (the fix lands in
`lib/protected-branches.mjs` alone and reaches five callsites, two of which index
`[0]`), D-10 (`config.mjs get` does not route through the resolver, so the five
prose readers in `workflows/` and `skills/cad-land/SKILL.md` are NOT fixed by this
and are NOT touched here).

## Tasks

### Task 1: The resolver stops returning a list that protects nothing

- **Files:** cadence-core/bin/lib/protected-branches.mjs (`resolveProtectedBranches` and the module header above it), cadence-core/bin/protected-branches.test.mjs
- **Action:** `resolveProtectedBranches` currently returns `value` unchanged for
  any array and `[value]` for any string, so `""` becomes `[""]` and `[""]` stays
  `[""]` - a list that reads as configured and matches no branch. Apply one
  predicate to both spellings: an entry survives only when it is a string whose
  trimmed form is non-empty. An array whose surviving entries are non-empty
  returns those survivors; an array that was already empty returns `[]` unchanged
  (prior D-09, and the D-09 test in this file states why); a NON-empty array whose
  survivors are all gone returns the default `['main','master']`, because a value
  naming no branch is a typo rather than the user saying "protect nothing" (D-02).
  A string returns a one-element list only when it survives the same predicate,
  and otherwise returns the default. Everything else - absent, number, object,
  null - keeps today's default. Do not rewrite a surviving entry: the predicate
  decides what is kept, not what it is spelled as, and re-spelling a branch name
  the user typed is a second behaviour neither D-01 nor AC1 states. Do not make
  the helper merge config or throw: `git-guard.mjs` is a PreToolUse hook that
  swallows every throw, which the existing "a missing git block is the default,
  never a throw" test exists to protect. In the same pass correct the module
  header, which says "the four readers (git-guard, git-publish, git-branch,
  land-cleanup)" and has been stale since `issue-check.mjs` became the fifth
  (D-09) - name all five, and say that the returned list is free of empty entries
  because two of the five index `[0]` for a base ref. Extend
  `protected-branches.test.mjs` with one assertion per AC1 row and keep the
  existing `#38` and D-09 rows green.
- **Verify:** `node --test cadence-core/bin/protected-branches.test.mjs` passes,
  and `node -e` importing `resolveProtectedBranches` returns exactly
  `['main','master']` for `""`, `['main','master']` for `" "`, `['main','master']`
  for `[""]`, `['main']` for `["","main"]`, `[]` for `[]` and `['release']` for
  `"release"`. Reverting the predicate makes that test file red on the `""` and
  `[""]` rows.

### Task 2: The guard refuses a commit on `main` under a string `""`

- **Files:** cadence-core/bin/git-guard.test.mjs
- **Action:** Add this seam's own proof that the coercion reaches a DECISION and
  not only the helper, the way the existing "a string protected_branches guards
  THAT branch" row does for `#38`. Using the file's `project(branch, config)` and
  `guard(command, cwd)` helpers, assert that a `git commit` on `main` under
  `git.protected_branches: ""` returns a non-null protected-branch decision
  naming `main` - `permissionDecision: "ask"` under the default `on_protected`,
  and `"deny"` with `on_protected: "refuse"` - where the pre-fix tree returns
  `null` because `[""]` contains no branch. Add the array spelling of the same
  hole (`[""]`) beside it, since D-01 makes them one grammar reached two ways.
  Leave the existing `[]`-is-unguarded row exactly as it is: it asserts the
  opposite answer for the opposite input and is what stops this fix from
  re-protecting `main` behind a user who emptied the list.
- **Verify:** `node --test cadence-core/bin/git-guard.test.mjs` passes, the new
  rows fail against a tree with task 1 reverted, and the existing
  `an EMPTY protected_branches list still means nothing is protected (D-09)` row
  still passes.

### Task 3: `land-cleanup` reaps against a real base under a string `""`

- **Files:** cadence-core/bin/land-cleanup.test.mjs
- **Action:** `cleanup()` resolves `base` as `git.base_branch || protectedBranches[0]`,
  so an out-of-grammar list moves a BASE REF and not only a guard verdict (D-09).
  Add a row in the mold of the existing
  `a STRING protected_branches resolves base to that branch (#38, COR-01, D-07)`
  test, built with the file's `fixture(gitConfig)` and `seam(args)` helpers: a
  fixture whose git block sets `protected_branches` to `""` with no
  `base_branch`, run with no `--base`, must report `base: "main"` - the D-02
  fallback arriving at the consumer - where the pre-fix tree reports the empty
  string and turns the reap query into `git branch --merged ""`. Keep the
  existing `release` row and its explicit-`--base`-wins assertion green: they are
  what prove the fallback did not swallow a value the user did set.
- **Verify:** `node --test cadence-core/bin/land-cleanup.test.mjs` passes and the
  new row reports `base === "main"`; with task 1 reverted the same row reports
  `base === ""`.

### Task 4: `issue-check` reports referenced issues under a string `""`

- **Files:** cadence-core/bin/issue-check.test.mjs
- **Action:** `check()` resolves the same `git.base_branch || resolveProtectedBranches(git)[0]`
  fallback and spends it on `git log <base>..HEAD`, so under `""` the range
  becomes `..HEAD`, git reads the empty side as `HEAD`, the log is empty and the
  tracker report names no issue at all while still answering `ok:true` - a
  silently empty report rather than a visible failure. Add a row using this
  file's `repo({originUrl, commits, gitConfig})`, `seamRun`/`seam` and
  `ALL_STUBS` harness: a repository whose HEAD is a branch forked from `main`
  carrying the `COMMITS` messages, `protected_branches` set to `""` in
  `gitConfig` with no `base_branch`, run with no `--base`, must reach
  `action: "report"` with the issue numbers those commits reference present in
  `referenced`. Assert the numbers, not merely the action - the pre-fix tree also
  answers `action: "report"`, and `referenced: []` is exactly the defect. Do not
  add a base-ref field to the seam's envelope: the seam does not emit one today,
  and the referenced list is the observable this task needs.
- **Verify:** `node --test cadence-core/bin/issue-check.test.mjs` passes and the
  new row's `referenced` carries the issue numbers from the fixture's commits;
  with task 1 reverted the same row returns `referenced: []`.

### Task 5: The reach table names all five readers

- **Files:** cadence-core/references/config-reach.md (the `git.protected_branches` reach row), cadence-core/bin/weight-budgets.json
- **Action:** The `git.protected_branches` reach row names three readers -
  `bin/git-guard.mjs`, `bin/land-cleanup.mjs` and `bin/git-publish.mjs` - and has
  been stale since `git-branch.mjs` and `issue-check.mjs` began reading the same
  coercion (D-09). Name all five in that row's purpose cell and say they read it
  through `bin/lib/protected-branches.mjs`, so the next reader finds the one place
  the grammar lives rather than five callsites. Leave the Reach cell at
  `universal`: the key is honoured in every layer that can set it and nothing about
  this phase narrows that, and `reachIssues` short-circuits a universal row before
  it ever compares the purpose text. The file is budgeted at its exact current byte
  count, so re-pin its entry in `weight-budgets.json` in the same commit -
  `budget-overrun` is a self-verify failure, and re-pinning in a later commit is
  the drift that check exists against.
- **Verify:** `node cadence-core/bin/self-verify.mjs` exits 0 with no
  `budget-overrun`, no `unbudgeted-surface` and no `missing-reach-row` /
  `unstated-reach` problem; `grep -n 'git.protected_branches' cadence-core/references/config-reach.md`
  shows all five reader scripts on that row, and the header of
  `cadence-core/bin/lib/protected-branches.mjs` names the same five.

## Notes

- This plan and PLAN-2 share exactly one declared file,
  `cadence-core/bin/weight-budgets.json`: every budgeted prose surface in this
  repository sits at its exact byte budget, so both slices must re-pin it. They
  are therefore SEQUENTIAL, not parallel - `plan-overlap` will report the
  intersection and the parallel path must decline. Nothing else is shared.
- Out of scope by locked decision and deliberately not planned: `config.mjs`'s
  `array_string` validation, which keeps rejecting a string (D-03), and the five
  prose readers that go through `config.mjs get` rather than the resolver (D-10).
  Neither is fixed by this plan and neither is a gap in it.
