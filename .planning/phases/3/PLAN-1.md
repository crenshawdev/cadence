---
phase: 3
plan: 1
requirements: [COR-01]
files:
  - cadence-core/bin/lib/protected-branches.mjs
  - cadence-core/bin/lib/seam-input.mjs
  - cadence-core/bin/lib/git-head.mjs
  - cadence-core/bin/git-guard.mjs
  - cadence-core/bin/git-publish.mjs
  - cadence-core/bin/git-branch.mjs
  - cadence-core/bin/land-cleanup.mjs
  - cadence-core/bin/release-bump.mjs
  - cadence-core/bin/worktree-base.mjs
  - cadence-core/bin/weight.mjs
  - cadence-core/bin/self-verify.mjs
  - cadence-core/bin/protected-branches.test.mjs
  - cadence-core/bin/seam-input.test.mjs
  - cadence-core/bin/git-head.test.mjs
  - cadence-core/bin/helper-census.test.mjs
  - cadence-core/bin/git-guard.test.mjs
  - cadence-core/bin/git-publish.test.mjs
  - cadence-core/bin/git-branch.test.mjs
  - cadence-core/bin/land-cleanup.test.mjs
---

# Phase 3: The scan's correctness gaps close - Plan 1

## Goal

The config key the guard honors and land ignores is honored identically by all
four readers, and the helpers the five git bins copied between themselves are
stated once in `lib/` where a sixth copy reddens a test instead of drifting in
silence.

## Must be true when done

- `protected_branches: "release"` set as an ordinary config key resolves to
  `["release"]` in all four readers - `git-guard`, `git-publish`, `git-branch`,
  `land-cleanup` - and each of the four has a test saying so against its own
  seam, not against a shared helper alone.
- `protected_branches: []` still means nothing is protected: it never falls
  through to `["main","master"]`, and a `git commit` on `main` under it is
  unguarded exactly as it is today.
- `flag`, `flagValue`, the `''`-on-failure `readText` and the
  `rev-parse --abbrev-ref` branch reader are each defined exactly once under
  `cadence-core/bin/`, with `lib/include-consumers.mjs`'s null-returning
  `readText` named as the one deliberate second contract.
- Adding a copy of any of those four to any `.mjs` file under
  `cadence-core/bin/` turns `node --test cadence-core/bin/*.test.mjs` red.
- A valueless `--dir`/`--remote`/`--branch`/`--base`/`--version` on the five
  `flag` callers still defaults exactly as it does today: none of them starts
  refusing with `missing-flag-value`.
- `node --test cadence-core/bin/*.test.mjs` passes and
  `node cadence-core/bin/self-verify.mjs` reports no `unbudgeted-surface` and
  no `budget-overrun`.

## Context

CONTEXT.md D-01 (the protected helper is a PURE coercion over an already-merged
`git` block, never its own `mergeLayers`), D-03 (`flag` and `flagValue` are two
DIFFERENT contracts, both survive; the five `flag` callers are NOT migrated),
D-04 (a NEW args/fs lib module, not an extension of `lib/seam-io.mjs`, whose
header states an output-only boundary; `lib/include-consumers.mjs`'s `readText`
stays put and is named by the census), D-05 (the branch reader gets its own
`lib/` module in the `lib/git-tags.mjs` mold - degrades to `''`, takes the
CALLER's cwd - because `git-guard.mjs` swallows every throw), D-06 (the census
is TREE-WIDE over `cadence-core/bin/**` and asserts DEFINITIONS), D-07 (widening
`land-cleanup` moves its `base` fallback and that is accepted), D-09 (the
fallback fires only on non-array/non-string values), D-16 (definitions, never
call sites).

Out of scope here: widening `config.schema.json`'s `array_string` (D-08 keeps
the validator strict), migrating any `flag` caller to `flagValue` (D-03), and
`git-publish`'s `tornLayerDetail` refusal breadth.

## Tasks

### Task 1: One protected-branch coercion, consumed by the two readers that already tolerate a string

- **Files:** cadence-core/bin/lib/protected-branches.mjs, cadence-core/bin/protected-branches.test.mjs, cadence-core/bin/git-guard.mjs, cadence-core/bin/git-publish.mjs, cadence-core/bin/git-guard.test.mjs, cadence-core/bin/git-publish.test.mjs
- **Action:** Create `lib/protected-branches.mjs` as a pure, zero-dep module in
  the `lib/git-tags.mjs` mold: one exported function taking an already-merged
  `git` block and returning the branch list. Its whole contract is the coercion
  the four readers currently restate - an array passes through unchanged
  (`[]` included, D-09), a string becomes a one-element array (#38's
  hand-edit tolerance), and ANY other shape (absent, number, object, null)
  falls back to `['main','master']`. It must NOT call `mergeLayers` and must
  import nothing from `lib/config-merge.mjs` (D-01): each of the four callsites
  merges a different thing and needs a different second answer off the same
  merge - `git-publish` needs `{branches, warnings, tornLayers}`,
  `git-guard` keys its torn-layer arm on `tornPrefixes` - so a helper that
  merged would have to be four helpers. It is a NEW module rather than an
  export added to `lib/config-merge.mjs` (whose header states it is the ONE
  implementation of config LAYERING, which a git-key coercion is not) and
  rather than an addition to `lib/seam-io.mjs` (output-only boundary, D-04);
  the four callers already import from `lib/` so the direction is established.
  A lib module takes no `self-verify` CONTRACTS row (`self-verify.mjs:102-104`).
  Then replace the inline ternary chain in `git-guard.mjs`'s `commitDecision`
  (the `protectedBranches` binding, anchored at the `#38` lone-string comment)
  and in `git-publish.mjs`'s `readProtectedBranches` with a call to it, keeping
  `readProtectedBranches`'s three-field return shape byte-identical - the
  `warnings`/`tornLayers` half is what stops the one mutating seam pushing off
  a protected branch and is not this task's subject. Carry the reason the
  ternary states (a lone string names the branch the user means to protect; do
  not silently swap the list) into the new module's header rather than deleting
  it, since these two callsites are where that reasoning was written down.
  Add a string-form arm to `git-publish.test.mjs` (it has none today) using the
  existing `repo({config})` fixture, and a `protected_branches: []` arm to
  `git-guard.test.mjs` proving the empty list still means nothing is protected
  - the arm at `git-guard.test.mjs:152` already covers the string form there
  and stays as the guard's per-consumer proof.
- **Verify:** `node --test cadence-core/bin/protected-branches.test.mjs
  cadence-core/bin/git-guard.test.mjs cadence-core/bin/git-publish.test.mjs`
  passes, and reverting only the new module's string branch to the array-only
  form turns the new `git-publish.test.mjs` arm red. `grep -nE "Array\\.isArray\\([^)]*protected"
  cadence-core/bin/git-guard.mjs cadence-core/bin/git-publish.mjs` prints
  nothing (the inline coercion ternary is gone from both), and
  `grep -l "protected-branches.mjs" cadence-core/bin/git-guard.mjs
  cadence-core/bin/git-publish.mjs` names both files (each consumes the
  shared helper).

### Task 2: The two readers that silently drop a string form start honoring it

- **Files:** cadence-core/bin/git-branch.mjs, cadence-core/bin/land-cleanup.mjs, cadence-core/bin/git-branch.test.mjs, cadence-core/bin/land-cleanup.test.mjs
- **Action:** Replace the `Array.isArray(git.protected_branches) ? ... :
  ['main','master']` binding in `git-branch.mjs`'s `decide` and in
  `land-cleanup.mjs`'s `cleanup` with the task-1 helper, so a string value is
  no longer dropped. Both merges stay exactly as they are - the helper takes
  the already-merged `git` block and neither callsite's `warnings` handling
  moves. In `land-cleanup` this is a deliberate behavior change beyond the
  coercion, per D-07: `base` falls back to `protectedBranches[0]`, so
  `protected_branches: "release"` now resolves `base` to `release` and
  `git branch --merged release` becomes the reap query. That is the accepted
  consequence of one grammar, not a regression - state it in the arm rather
  than working around it. Add a string-form arm per consumer using each file's
  existing fixture helper (`fixture(gitConfig)` in both), driving the seam and
  asserting the observable each seam actually emits, not an echoed input:
  `git-branch`'s decision about being on a protected branch, and
  `land-cleanup`'s `base`. Leave `config-seams.test.mjs:405-407`'s base arm
  intact - it drives `git.base_branch` and an array-form list, which the change
  does not move.
- **Verify:** `node --test cadence-core/bin/git-branch.test.mjs
  cadence-core/bin/land-cleanup.test.mjs cadence-core/bin/config-seams.test.mjs`
  passes; `node cadence-core/bin/land-cleanup.mjs cleanup --dir <fixture>` on a
  fixture whose `.planning/config.json` carries
  `{"git":{"protected_branches":"release"}}` prints `"base":"release"`, where
  the same command on the pre-fix code prints `"base":"main"`.

### Task 3: The shared argv/file input module

- **Files:** cadence-core/bin/lib/seam-input.mjs, cadence-core/bin/seam-input.test.mjs
- **Action:** Create `lib/seam-input.mjs` as the input-side counterpart to
  `lib/seam-io.mjs` - which owns the OUTPUT convention only and must not grow
  an input face (D-04) - exporting three helpers whose contracts are already
  fixed in-tree and must be copied verbatim in behavior, not harmonized:
  (1) the non-throwing positional flag reader, today five byte-identical copies
  at `git-branch.mjs:77-80`, `git-publish.mjs:211-214`,
  `land-cleanup.mjs:161-164`, `release-bump.mjs:208-211`,
  `worktree-base.mjs:141-144` - it closes over `argv` in each copy, so the
  shared form has to take the argv array as a parameter the way the throwing
  one already does; (2) the throwing value reader, today two copies at
  `weight.mjs:46-55` and `self-verify.mjs:1294-1303`, which refuses a missing,
  empty or flag-shaped value by throwing `{seam:'missing-flag-value', detail}`;
  (3) the `''`-on-failure `readText`, today three copies at
  `git-branch.mjs:33-36`, `land-cleanup.mjs:46-49`, `release-bump.mjs:59-62`.
  The two flag readers stay TWO exports with two names and two contracts
  (D-03): the non-throwing one defaults through `|| fallback` at five seams
  that have no `e.seam` catch arm, and folding them would turn a valueless
  `--dir` into `{"ok":false,"reason":"internal","detail":"[object Object]"}`
  across seams this phase never named. State that divergence in the module
  header so the next reader does not "fix" it. State also that
  `lib/include-consumers.mjs:123-130`'s `isFile()`-guarded, null-returning
  reader is a DIFFERENT contract that deliberately does not live here. Pure
  module, no `emit`, no `mergeLayers`, no CONTRACTS row. Cover each export's
  edges in `seam-input.test.mjs`: absent flag, present-and-valueless,
  empty-string value, flag-shaped value, and `readText` over a missing path and
  a directory.
- **Verify:** `node --test cadence-core/bin/seam-input.test.mjs` passes, and it
  contains an arm asserting the non-throwing reader returns `undefined` (never
  throws) for a present-but-valueless flag while the throwing reader throws
  `missing-flag-value` for the same input.

### Task 4: The five bins import the flag and file readers instead of defining them

- **Files:** cadence-core/bin/git-branch.mjs, cadence-core/bin/git-publish.mjs, cadence-core/bin/land-cleanup.mjs, cadence-core/bin/release-bump.mjs, cadence-core/bin/worktree-base.mjs
- **Action:** Delete the five `flag` definitions and the three `readText`
  definitions from these files and import them from `lib/seam-input.mjs`,
  passing the module-level `argv` each dispatch block already builds. The
  bridge is a one-line module-level partial application in each bin -
  `const flag = (name) => <shared export>(argv, name)` - which is what lets
  every call site keep its spelling; it is an adapter binding over the shared
  reader, never a helper definition, and task 7's census must not count it as
  one. Every
  call site keeps its spelling and its `|| fallback` (`flag('--dir') ||
  process.cwd()` and siblings): the callers are NOT migrated to the throwing
  contract (D-03), and no dispatch block gains an `e.seam` arm. Nothing else in
  these files moves - no envelope, no reason string, no `warnings` handling.
  Keep the per-file doc comment where a file's header documents the flag it
  reads (`git-branch.mjs:17` names the rev-parse degradation, `worktree-base`'s
  header names its own test hooks).
- **Verify:** `node --test cadence-core/bin/*.test.mjs` passes; `grep -n
  "function flag(\|function readText(" cadence-core/bin/*.mjs` returns nothing;
  and each of the five seams still answers from cwd on a valueless flag -
  `node cadence-core/bin/git-branch.mjs decide --dir` prints a line with
  `"ok":true`, not `"reason":"internal"`.

### Task 5: The two throwing-flag bins import the same reader

- **Files:** cadence-core/bin/weight.mjs, cadence-core/bin/self-verify.mjs
- **Action:** Delete the two `flagValue` definitions and import the throwing
  reader from `lib/seam-input.mjs`. Both entry points keep their existing
  `catch` arms unchanged - `self-verify.mjs`'s arm at the foot of the file
  tests `e.seam` and emits `{ok:false, reason:e.seam, detail:e.detail}`, and
  that arm is the reason a thrown seam object does not surface as
  `[object Object]`; the throw shape the shared module raises must keep both
  fields so neither arm changes. `weight.mjs`'s `flagValue(argv,'--root') ||
  join(HERE,'..','..')` fallback stays exactly as written: the throw fires
  before the `||` can be reached, which is what makes a valueless `--root`
  refuse instead of silently reporting Cadence's own tree.
- **Verify:** `node --test cadence-core/bin/weight.test.mjs
  cadence-core/bin/self-verify.test.mjs` passes; `node cadence-core/bin/weight.mjs
  resident --root` and `node cadence-core/bin/weight.mjs resident --root ""`
  each print `{"ok":false,"reason":"missing-flag-value","detail":"--root"}`, and
  `node cadence-core/bin/self-verify.mjs --root ""` prints the same shape.

### Task 6: One reader of "what branch is this repo on"

- **Files:** cadence-core/bin/lib/git-head.mjs, cadence-core/bin/git-head.test.mjs, cadence-core/bin/git-guard.mjs, cadence-core/bin/git-publish.mjs, cadence-core/bin/git-branch.mjs
- **Action:** Create `lib/git-head.mjs` in the `lib/git-tags.mjs` mold - zero
  dep, node builtins only, one exported reader over `git -C <dir> rev-parse
  --abbrev-ref HEAD` that degrades to `''` on ANY failure (no repo, no commits,
  no git on PATH, unreadable dir) and takes the CALLER's directory as its only
  argument. Degrading rather than throwing is load-bearing, not a style choice
  (D-05): `git-guard.mjs` is a PreToolUse hook whose final line swallows every
  throw, so a helper that threw would make the guard silently stop guarding.
  State that in the header the way `lib/git-tags.mjs` states its own
  no-evidence-is-not-evidence-of-none rule. Then delete the three copies -
  `git-guard.mjs:73-79` (called with the hook's cwd at its `commitDecision`
  callsite), `git-publish.mjs:49-54`, `git-branch.mjs:38-44` - and import it.
  THREE sites, not four: `land-cleanup.mjs` has no rev-parse reader and must
  not gain one. Keep each caller's local variable naming and the surrounding
  comments; `git-branch.mjs`'s header sentence about degrading to `""` stays
  true and stays.
- **Verify:** `node --test cadence-core/bin/git-head.test.mjs
  cadence-core/bin/git-guard.test.mjs cadence-core/bin/git-publish.test.mjs
  cadence-core/bin/git-branch.test.mjs` passes, with an arm proving the reader
  returns `''` for a directory that is not a git repo rather than throwing;
  `grep -n "'--abbrev-ref'" cadence-core/bin/*.mjs cadence-core/bin/lib/*.mjs`
  names `lib/git-head.mjs` and nothing else.

### Task 7: A tree-wide definition census that reddens on a re-copy

- **Files:** cadence-core/bin/helper-census.test.mjs
- **Action:** Add a census test that walks every `.mjs` file under
  `cadence-core/bin/` (bins, `lib/`, and test files alike) and asserts each of
  the four extracted helpers has exactly one DEFINITION, naming the file that
  holds it. TREE-WIDE, not per-file, and a deliberate deviation from the
  per-file `redactUrl` precedent the roadmap cites (`git-publish.test.mjs:362-378`,
  `planning.test.mjs:4579-4598`): a re-copy into a sixth file is invisible to
  any file-scoped count, and the copies this phase deletes accumulated in
  exactly that way. It matches DEFINITIONS, never call sites (D-16) - the five
  bins keep calling the flag reader after importing it and a call-site census
  would redden on every legitimate use. `readText` is the one name with TWO
  admitted definitions: the shared `''`-returning one and
  `lib/include-consumers.mjs`'s `isFile()`-guarded null-returning reader, which
  is a different contract that stays where it is (D-04) - name that file and
  its reason in the assertion message so a future reader cannot mistake the
  exemption for an oversight. The branch reader's definition is the site that
  spawns `rev-parse --abbrev-ref`, so its census matches the quoted argument
  pair as it appears in an `execFileSync` argument array rather than the bare
  words, which also appear in `git-branch.mjs`'s prose header - the same
  lexical-rule discipline `lib/merge-warnings.mjs:56-62` states, where the fix
  for a self-matching rule is at the mention or in the pattern, never a second
  exclusion list. Each assertion message must name what a failure means and
  where the one home is, so a contributor who added a copy is told where to
  import from.
- **Verify:** `node --test cadence-core/bin/helper-census.test.mjs` passes; and
  pasting any one of the four definitions back into a second `.mjs` file under
  `cadence-core/bin/` (including a test file) makes that run fail with a
  message naming the file and the shared home. Then, as this plan's closing
  AC5 gate: `node --test cadence-core/bin/*.test.mjs` passes and
  `node cadence-core/bin/self-verify.mjs` reports no `unbudgeted-surface` and
  no `budget-overrun` - when PLAN-2 has already landed, this run gates the
  integrated tree.

## Notes

Planner's calls, recorded per CONTEXT's flagged assumptions:

- Module names: `lib/protected-branches.mjs`, `lib/seam-input.mjs`,
  `lib/git-head.mjs`. The branch reader stands alone rather than extending
  `lib/git-tags.mjs` - the tag list and the current branch answer different
  questions and only three seams want the second - and the protected-branch
  coercion is its own module rather than an export on `lib/config-merge.mjs`,
  whose header claims config LAYERING as its whole subject.
- The census lands as a TEST file (`helper-census.test.mjs`), not a
  `self-verify` check beside checks 12/15. The trade stated in CONTEXT: a test
  reddens in `node --test`, which is AC5's first gate, and costs one artifact;
  a self-verify check would need a new pure `lib/` rule, a wiring block, an
  entry in the header's numbered check list and a new token in the `checked:`
  string, all for the same binding force.
- `weight-budgets.json` is untouched: this plan adds no prose surface (CONTEXT
  flagged assumption, phase 1 D-10).
