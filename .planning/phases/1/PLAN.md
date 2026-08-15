---
phase: 1
plan: 1
requirements:
  - AUT-01
  - AUT-02
files:
  - .planning/spikes/gitlab-authorization-gap/SPIKE.md
  - cadence-core/bin/lib/repo-auto-close.mjs
  - cadence-core/bin/repo-auto-close.test.mjs
  - cadence-core/bin/lib/publish-decision.mjs
  - cadence-core/bin/publish-decision.test.mjs
  - cadence-core/bin/git-publish.mjs
  - cadence-core/bin/git-publish.test.mjs
  - cadence-core/bin/issue-check.test.mjs
  - cadence-core/bin/self-verify.mjs
  - skills/cad-land/SKILL.md
  - cadence-core/references/git-publish.md
  - cadence-core/references/config-reach.md
  - cadence-core/config.schema.json
  - cadence-core/bin/weight-budgets.json
  - cadence-core/bin/prose-agreement.test.mjs
  - cadence-core/bin/config-seams.test.mjs
---

# Phase 1: Authorization the repo grants, not the user - Plan

## Goal

An unattended publish or merge requires authorization the REPOSITORY granted,
on every host, while the close gate and the publish ask keep reading the one
merged value they must agree on.

## Must be true when done

- Under a config pair where the two values DIFFER - user-global
  `git.auto_close: true`, repo `.planning/config.json` never setting it - the
  publish seam still refuses, and its envelope now says the REPOSITORY never
  authorized it. The same seam on a pair that is off in BOTH layers refuses with
  a visibly different sentence, so "off everywhere" and "requested globally,
  never authorized here" are distinguishable in the output a user reads.
- The GitLab arm has an authorization answer it must consult before
  `glab mr create`: run under that same pair with `gh`, `glab` and `tea` stubs
  on PATH, the seam refuses and the spawn-marker file shows no forge CLI ran at
  all.
- Neither `skills/cad-land/SKILL.md` nor `cadence-core/references/git-publish.md`
  still states that no seam call is needed on GitLab, and a test goes red if the
  GitLab bullet stops naming the seam call.
- The skipped-ask / halt pairing is untouched: for the same pair
  `config.mjs get git.auto_close` still reports `true` (what `/cad-land` skips
  the ask on) and `land-cleanup.mjs gate` still halts on a surviving blocker
  there. A test fails if either moves to a different source.
- `config.schema.json`'s `git.auto_close` purpose and `config-reach.md`'s row
  both describe the two resolutions and which arm reads which, and
  `node cadence-core/bin/self-verify.mjs` reports no `unstated-reach`.
- `node --test 'cadence-core/bin/*.test.mjs'` and
  `node cadence-core/bin/self-verify.mjs` both run clean.

## Context

Locked: D-01 (no existing `git.auto_close` read moves - the merged reads in
`skills/cad-land/SKILL.md`, `workflows/milestone.md` and `land-cleanup.mjs
gate()` stay exactly as they are), D-02 (the authorized value comes from the RAW
`JSON.parse` repo read extracted out of `git-publish.mjs`'s `repoAutoClose`, NOT
from `mergeLayers(...).layers.repo`), D-03 (no new config key), D-04 (the GitLab
gate is an authorization ANSWER the prose consults - nothing in
`cadence-core/bin/` may spawn a forge CLI), D-05 (the `config.mjs set --global`
write face is untouched), D-09 (`land-cleanup.mjs` and `lib/close-decision.mjs`
are NOT fix sites), D-10/D-11 (one pure core words the refusal; `reason` stays
the token `auto-close-off` and the naming rides `detail`), D-12 (the schema
purpose must carry the reach cell's narrow phrase verbatim), D-13 (exactly two
doc surfaces change), D-14 (step 3's `3(a)`/`3(b)` numbering stays), D-15 (a new
subcommand needs its flag list on the script's CONTRACTS row).

Discretionary call made here, from the CONTEXT flagged assumption: the GitLab
authorization answer ships as a NEW SUBCOMMAND `authorized` on
`cadence-core/bin/git-publish.mjs`, not as a new top-level bin seam. It reuses
the existing CONTRACTS row (one flag-list edit under D-15), adds no new script,
no new check-14 entry and no new test file, and it puts the one repo-layer
authorization question in the one file that already owns it. It spawns nothing.

Out: the skipped-ask / halt pairing on the requested side, `lib/milestone-prune.mjs`,
`issue-check.mjs`'s own behaviour, and the open `tornLayerRefusal` question -
the raw repo read routes around it rather than fixing it.

## Tasks

### Task 1: Demonstrate the ungated GitLab path against the tree as it stands

- **Files:** .planning/spikes/gitlab-authorization-gap/SPIKE.md
- **Action:** Before any fix lands, record the gap as a run rather than as an
  assertion (AC6). Build a throwaway fixture outside the repo: a git repo with
  a `.planning/config.json` that does NOT set `git.auto_close`, and a
  user-global layer file that sets it to `true`, supplied through
  `CADENCE_GLOBAL_CONFIG` the way `config-seams.test.mjs`'s `seam` helper does.
  Against that fixture run, and transcribe verbatim: `config.mjs get
  git.auto_close` (the value `skills/cad-land/SKILL.md` step 3 branches on, so
  `true` means the run enters arm 3(b) with the ask skipped);
  `land-cleanup.mjs gate` with NO surviving blocker on stdin, so it PASSES -
  the state an ordinary unattended close is in, and the one that leaves nothing
  standing between the skipped ask and the merge. (Run the blocker-fed halt too
  if you want the pairing on record, but label it the CONTRAST: a halt
  demonstrates the opposite outcome and is not the pre-fix failure AC6 asks to
  watch.) And `git-publish.mjs publish`,
  which refuses with `auto-close-off` - the refusal the GitHub and Forgejo arms
  die on and the GitLab arm never reaches. Then DEMONSTRATE the GitLab path
  proceeding rather than quoting prose about it: with `gh`, `glab` and `tea`
  stubs on PATH and `CAD_SPAWN_MARKER` set (the `issue-check.test.mjs`
  convention task 5 exports - write the stubs inline here, since task 5 has not
  landed yet), walk `skills/cad-land/SKILL.md` step 3(b)'s GitLab bullets
  against the same fixture and transcribe the marker file, which must record
  `glab mr create` followed by `glab mr merge` with NO refusal between them -
  an unattended merge authorized by a value the repository never set. Quote the
  bullets beside it as the reason no seam call intervened. Write the spike in the shape
  `.planning/spikes/maxturns-cap-behaviour/SPIKE.md` uses (Question, why it
  exists, what was run, verdict), dated, with the commit SHA the run was made
  against. Do not change any source file in this task - its whole value is that
  it describes the unfixed tree.
- **Verify:** `.planning/spikes/gitlab-authorization-gap/SPIKE.md` exists and
  contains the verbatim JSON line from each of the three seam runs, with the
  `gate` line showing a PASS rather than a halt, AND the transcribed
  `$CAD_SPAWN_MARKER` contents showing `glab mr create` then `glab mr merge`
  with no refusal between them, plus the quoted GitLab bullets; `git status
  --porcelain` shows that file as the only change; `node --test
  'cadence-core/bin/*.test.mjs'` still passes.

### Task 2: Extract the repo-layer authorization read into lib/

- **Files:** cadence-core/bin/lib/repo-auto-close.mjs, cadence-core/bin/repo-auto-close.test.mjs, cadence-core/bin/git-publish.mjs
- **Action:** Move `repoAutoClose` out of `cadence-core/bin/git-publish.mjs`
  into a new pure-ish lib module and import it back, keeping the function's
  BEHAVIOUR byte-for-byte: the raw `JSON.parse` of `<dir>/.planning/config.json`,
  `true` only on an explicit `git.auto_close === true`, and `false` on every
  throw - missing file, unreadable file, unparseable file, global-only value
  (D-02). It must NOT be re-expressed through `mergeLayers`: the raw read fails
  CLOSED, and a merge-derived answer would let a torn USER-GLOBAL layer withdraw
  a repository's authorization, which is the direction an authorization check
  must never fail in. Carry the reason into the new module's header, not just
  the "what": this is the value that says the repository itself opted in, so no
  other layer may speak for it (D-08). The lib module keeps the `// @ts-check`
  and `'use strict'` discipline every sibling under `lib/` carries. Give it a
  test file of its own following the `lib/<x>.mjs` -> `<x>.test.mjs` naming the
  directory already uses, covering: repo `true`, repo `false`, key absent,
  `.planning/config.json` absent, truncated JSON, and a global-only value with
  the repo file silent.
- **Verify:** `node --test 'cadence-core/bin/repo-auto-close.test.mjs'` passes
  with an arm for each of the six cases; `grep -c "JSON.parse" cadence-core/bin/git-publish.mjs`
  returns 0; `grep -c "mergeLayers(" cadence-core/bin/git-publish.mjs` still
  returns 1 (the count `cadence-core/bin/self-verify.test.mjs` pins tree-wide);
  `node --test 'cadence-core/bin/git-publish.test.mjs'` passes unchanged.

### Task 3: Word the refusal from one core that receives both booleans

- **Files:** cadence-core/bin/lib/publish-decision.mjs, cadence-core/bin/publish-decision.test.mjs
- **Action:** `decidePublish`'s gate 1 today refuses from `autoClose !== true`
  alone, so it cannot tell "off everywhere" from "on globally, repository never
  opted in" - the exact sentence AC4 asks for. Add ONE exported, pure, total
  function to `cadence-core/bin/lib/publish-decision.mjs` (name it
  `authorizationDetail`) that receives BOTH booleans - the merged/requested
  value and the repo-layer authorized value - and returns the sentence naming
  which authorization was missing, or null when the repository did authorize.
  Two distinct sentences: one for requested-and-authorized-both-off, one for
  requested-globally-but-this-repository-never-opted-in, and the second must say
  plainly that a user-global setting cannot authorize this repository and name
  `.planning/config.json` as where the opt-in belongs. Then have `decidePublish`
  take the requested value as an additional optional input and put that
  function's answer on its gate-1 refusal only, as `detail`. `reason` STAYS the
  token `auto-close-off` on both arms - it is asserted by equality in
  `git-publish.test.mjs` and `config-seams.test.mjs`, and changing its text is a
  test edit with no behavioural gain (D-11). Keep the module's stated
  discipline: no I/O, nothing throws, a non-boolean input coerces rather than
  refuses, and the JSDoc gate ladder at the top of `decidePublish` must be
  updated to state what gate 1 now carries. Do not touch `decideReap` or
  `tornLayerRefusal`.
- **Verify:** `node --test 'cadence-core/bin/publish-decision.test.mjs'` passes
  with arms proving: both-off and requested-only produce DIFFERENT non-empty
  details while both carry `reason: 'auto-close-off'`; an authorized call
  returns `action: 'publish'` with no detail; and every other refuse arm's
  `reason` is unchanged from what the file's existing arms already assert.

### Task 4: Wire both booleans into the seam and add the `authorized` subcommand

- **Files:** cadence-core/bin/git-publish.mjs, cadence-core/bin/git-publish.test.mjs, cadence-core/bin/self-verify.mjs
- **Action:** In `cadence-core/bin/git-publish.mjs`, resolve the two values by
  name at the seam boundary: the authorized one from task 2's lib read, the
  requested one from the merged config the file ALREADY merges in
  `readProtectedBranches` - extend that existing call's return rather than
  adding a second `mergeLayers(` callsite, because `cadence-core/bin/self-verify.test.mjs`
  pins the tree-wide callsite total and the per-file count. Pass both into
  `decidePublish` so `publish`'s existing `auto-close-off` refusal now carries
  the `detail`; every other refuse arm's envelope is unchanged. Then add a third
  subcommand, `authorized [--dir <path>]`, that answers the SAME question and
  mutates nothing: it runs no `git`, spawns no process at all, emits `ok:true`
  with an action naming the repository's opt-in when the repo layer authorized
  it, and otherwise `ok:false` with `reason: 'auto-close-off'` and the same
  `detail` from the same core (D-10) - one core, two emits. It must NOT apply
  `tornLayerRefusal`: nothing mutates on this arm, the raw repo read already
  fails closed, and refusing here on a torn GLOBAL layer would let one corrupt
  user file withdraw a repository's authorization. `warnings[]` rides its
  envelope like every other arm's. Update the file's header (the "ONE seam that
  actually MUTATES" paragraph and the subcommand list) to state that `publish`
  and `reap` act while `authorized` only answers, and add `authorized` to the
  `usage` detail string - the existing `usage: the detail names both
  subcommands` test in `git-publish.test.mjs` must be widened to all three.
  Finally add `authorized: []` to the `'git-publish.mjs'` row of the `CONTRACTS`
  table in `cadence-core/bin/self-verify.mjs` (the row's `'*'` already grants
  `--dir`), or check 2 reports `unknown-subcommand` on the prose task 6 writes
  (D-15).
- **Verify:** With a fixture whose global layer sets `git.auto_close: true` and
  whose repo layer does not, `node cadence-core/bin/git-publish.mjs authorized
  --dir <fixture>` exits 1 and prints `"reason":"auto-close-off"` with a
  `detail` naming the repository, while the same fixture with the repo layer set
  to `true` exits 0; `node --test 'cadence-core/bin/git-publish.test.mjs'`
  passes with new arms for both `authorized` outcomes AND for the two
  distinguishable `publish` details; `node cadence-core/bin/self-verify.mjs`
  prints `"problems":[]`.

### Task 5: Prove the GitLab arm refuses with no forge CLI spawned

- **Files:** cadence-core/bin/issue-check.test.mjs, cadence-core/bin/git-publish.test.mjs
- **Action:** AC3's first half, through the harness that already exists rather
  than a copy of it (D-08). `cadence-core/bin/issue-check.test.mjs` holds the
  PATH-injected stub writer and the `$CAD_SPAWN_MARKER` convention where every
  stub appends its own name to a file, which is what makes "no forge CLI ran" an
  assertion about the filesystem. Export it: bind `test` to a no-op unless the
  module is the entry file and export the stub writer, exactly as
  `cadence-core/bin/config-seams.test.mjs` does and for the reason its header
  gives - importing a test file otherwise re-registers every one of its arms in
  the importing process. Import it into `cadence-core/bin/git-publish.test.mjs`
  (which already imports `gitLayers` from `config-seams.test.mjs`, the same
  precedent) and add the GitLab arm's case: `gh`, `glab` and `tea` stubs on the
  child's PATH with `CAD_SPAWN_MARKER` set, a fixture whose global layer sets
  `git.auto_close: true` and whose repo layer never does, and the `authorized`
  subcommand run against it. Assert the refusal AND that the marker file was
  never written - `glab` is absent on this machine, so a stub on PATH is the
  only way this arm is provable, and the marker is what proves the answer needed
  no forge CLI to reach (D-04). Do not add a `glab`-spawning path anywhere to
  make this test convenient.
- **Verify:** `node --test 'cadence-core/bin/issue-check.test.mjs'` still
  registers and passes every arm it does today (compare the pass count against
  the run before this task); `node --test 'cadence-core/bin/git-publish.test.mjs'`
  passes and its new GitLab arm asserts both the `auto-close-off` refusal and
  that the `$CAD_SPAWN_MARKER` file does not exist; `node --test
  'cadence-core/bin/*.test.mjs'` passes as a whole, proving the imported module
  registers nothing twice.

### Task 6: Rewire the two doc surfaces that say GitLab needs no seam call

- **Files:** skills/cad-land/SKILL.md, cadence-core/references/git-publish.md, cadence-core/bin/weight-budgets.json, cadence-core/bin/prose-agreement.test.mjs
- **Action:** AC3's second half, at exactly the two surfaces D-13 names and no
  others. In `skills/cad-land/SKILL.md` step 3(b), the "Open (or reuse) the
  PR/MR" bullet currently ends "On GitLab `glab mr create` publishes the source
  branch itself, so no seam call is needed there" - the sentence that states the
  gap as correct. Replace it: because `glab mr create` publishes the source
  branch itself, it IS the unattended external mutation, so the GitLab arm runs
  `git-publish.mjs authorized --dir <root>` FIRST and creates nothing on
  `ok:false` - it stops and surfaces the reason, the way the GitHub/Forgejo arm
  already stops on the publish seam's `ok:false`. Spell the invocation in the
  shipped form the other two calls in this file use
  (`node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/git-publish.mjs" authorized
  --dir <root>`, on its own physical line). ONE consult, before `glab mr
  create`, and no second check beside `glab mr merge` - the create is the first
  mutation and stopping it stops the chain. The bullet stays INSIDE the existing
  `3(b)` region and the `3(a)`/`3(b)` numbering does not move, or check 13's
  deferred-read anchors report against regions that no longer exist (D-14). In
  `cadence-core/references/git-publish.md` rail 3, the sentence "On GitLab `glab
  mr create` publishes the source branch itself." must state the same rule
  rather than the exemption. Both files are budgeted at their current byte count
  in `cadence-core/bin/weight-budgets.json`, so re-pin both rows in this same
  commit or the budget check fails. Then add the prose pin D-07 requires to
  `cadence-core/bin/prose-agreement.test.mjs`, in the shape of that file's
  existing "both fire sites invoke the risk-check seam rather than reading a
  prose list" test: the GitLab bullet must name the seam call, and the pin must
  go red on a tree where the old "no seam call is needed" sentence comes back.
  Pin the ORDER, not merely the presence: assert that within the `3(b)` GitLab
  region the `git-publish.mjs authorized` invocation appears at a lower index
  than the `glab mr create` invocation, so a tree that keeps the seam call but
  moves it after the create goes red. Presence alone leaves the branch already
  published by the time authorization is asked, which is the whole failure this
  phase exists to close. On GitLab the enforcement IS the prose, so a seam test
  alone proves nothing.
- **Verify:** `grep -n "no seam call is needed" skills/cad-land/SKILL.md
  cadence-core/references/git-publish.md` returns nothing; `node --test
  'cadence-core/bin/prose-agreement.test.mjs'` passes, and reverting only the
  SKILL.md bullet makes the new arm fail; moving the `authorized` line to AFTER
  `glab mr create` in that bullet ALSO makes it fail (prove both, then revert); `node cadence-core/bin/self-verify.mjs`
  prints `"problems":[]` (budgets re-pinned, check 2 accepts the new subcommand
  invocation, check 13's anchors still resolve).

### Task 7: State the two-boolean behaviour where the user sets the key

- **Files:** cadence-core/config.schema.json, cadence-core/references/config-reach.md, cadence-core/bin/weight-budgets.json
- **Action:** AC5. Rewrite `git.auto_close`'s `purpose` in
  `cadence-core/config.schema.json` so it describes what now ships: two
  resolutions of one key - the merged value `/cad-land`'s publish ask and
  `land-cleanup.mjs gate` read (and why they must be the same value), and the
  repository-layer value that alone authorizes an unattended publish or merge,
  on every host including GitLab. Keep the Reach cell's narrow phrase `repo
  config layer only for the unattended publish` VERBATIM inside the new purpose:
  check 9 compares it as a literal substring, so dropping or paraphrasing it
  fails self-verify with `unstated-reach` (D-12). Leaving the Reach phrase
  itself unchanged is deliberate - it is still true, and it keeps the vocabulary
  list at `cadence-core/references/config-reach.md`'s "phrases in use today"
  correct without a second edit. In that same file, rewrite the `git.auto_close`
  row's third cell, which today names `bin/git-publish.mjs` publish as the only
  repo-layer reader and so describes a one-consumer world: it must now name the
  `authorized` arm and the GitLab consult beside publish, and keep naming
  `land-cleanup.mjs` gate, `skills/cad-land/SKILL.md` and
  `cadence-core/workflows/milestone.md` as the merged readers. Add no config key
  (D-03) and change no other row. Re-pin `config-reach.md`'s row in
  `cadence-core/bin/weight-budgets.json` if the file grew.
- **Verify:** `node cadence-core/bin/self-verify.mjs` prints `"problems":[]`
  (no `unstated-reach`, no `budget-overrun`); `node cadence-core/bin/config.mjs
  get git.auto_close` still answers with the merged value and no error; `node
  --test 'cadence-core/bin/self-verify.test.mjs'` passes; deleting the phrase
  `repo config layer only for the unattended publish` from the new purpose makes
  self-verify report `unstated-reach` naming `git.auto_close`.

### Task 8: Pin the two resolutions and the pairing they must not break

- **Files:** cadence-core/bin/config-seams.test.mjs, cadence-core/bin/prose-agreement.test.mjs
- **Action:** AC1 and AC2, in the file that already owns the cross-seam
  divergence arms - its test `git-publish + land-cleanup: one git.auto_close,
  two questions, two layer reads` is the existing pin and is where this belongs
  rather than in a new file. Extend that arm, on the SAME global-true/repo-unset
  fixture, so all four facts are asserted together: `config.mjs get
  git.auto_close` reports `true` (the requested value, the one the prose skips
  the ask on and the one the gate reads); `git-publish.mjs authorized` refuses
  (the authorized value, `false`, from the repo layer alone); the two therefore
  DIFFER on one config pair, which is what makes them two resolutions rather
  than one value; and `land-cleanup.mjs gate` still halts on a surviving blocker
  there, so the arm that switched off the human is still the arm the gate
  covers. Keep the arm's existing contrast case - the same value in the REPO
  layer turning both seams on, and a global `false` unable to turn either off.
  Extend the test's comment to say why the divergence is the design and not an
  inconsistency to eliminate, citing `0b1c322` as the collapse that was reverted,
  so a future reader does not re-align them. Change no seam in this task.

  Then close AC2's other half, at the CALL SITE. The four facts above are all
  seam-level, so they hold even if `skills/cad-land/SKILL.md` is later repointed
  at the raw repo value while `config.mjs get` and the gate stay merged - the
  ask and the gate would then read different sources with every arm still green.
  Add a pin to `cadence-core/bin/prose-agreement.test.mjs` (which task 6 has
  already opened) asserting that SKILL.md step 3's auto-close branch takes its
  value from `config.mjs get git.auto_close` and from no other source: the
  region must carry that invocation, and must NOT carry a raw
  `.planning/config.json` read or a `git-publish.mjs authorized` call as the
  thing it branches on. That is what makes "the arm that switched off the human
  is the arm the gate covers" a fact a test can lose rather than a comment.
- **Verify:** `node --test 'cadence-core/bin/config-seams.test.mjs'` passes;
  the arm fails if `git-publish.mjs`'s authorization is re-pointed at the merged
  value (prove it by temporarily making the lib read return the merged value and
  observing the failure, then reverting); `node --test
  'cadence-core/bin/prose-agreement.test.mjs'` passes, and editing SKILL.md
  step 3's branch to read the repo layer directly instead of `config.mjs get
  git.auto_close` makes the new call-site pin fail (prove it, then revert); `node --test
  'cadence-core/bin/*.test.mjs'` and `node cadence-core/bin/self-verify.mjs`
  both run clean, which is AC7.

## Notes

- Plan shape follows the CONTEXT directive (one plan). The tasks share
  `cadence-core/bin/git-publish.mjs`, `git-publish.test.mjs` and
  `weight-budgets.json`, so no split was available anyway.
- CONTEXT tension, RESOLVED at the `plan` review gate (2026-08-15, user ruling):
  AC1's closing sentence ("No site produces either value from a bare
  `config.mjs get git.auto_close`") read literally against D-01, which LOCKS
  the merged `config.mjs get` in `skills/cad-land/SKILL.md` and
  `cadence-core/workflows/milestone.md` as `autoCloseRequested`'s source and
  says no existing read moves. AC1 was narrowed in CONTEXT.md to bar only the
  AUTHORIZED value from a bare `get`, which is the reading tasks 2 and 4
  enforce. The requested side does not move in this phase.
- Three further survivors of that same gate were applied: task 1 now
  DEMONSTRATES the GitLab merge proceeding (marker file, gate passing) rather
  than quoting prose at a halting gate; task 6's prose pin asserts the
  `authorized` call precedes `glab mr create` rather than merely appearing; and
  task 8 pins `config.mjs get` as SKILL.md's OWN ask source, so AC2 can no
  longer pass with the skill repointed at the repo layer.
- Evidence drift found while planning, no scope change: CONTEXT D-02 cites
  `cadence-core/bin/git-publish.mjs:116-118` `tornLayerDetail` as refusing on
  ANY `mergeLayers` warning. The shipped file has moved past that - the symbol
  is `tornLayerRefusal` in `lib/publish-decision.mjs` and it discriminates on
  `tornLayers` rather than on `warnings[]`. D-02's reason (a) (`config.mjs get`
  cannot answer per-layer at all) is unaffected and still carries the decision,
  and task 4 keeps the read-only arm off that gate for the fail-closed reason
  D-02 gives.
- `glab` is absent on this machine and stays absent; the GitLab arm is proven by
  a PATH-injected stub plus the `$CAD_SPAWN_MARKER` filesystem assertion (D-08,
  measured 2026-08-15). Nothing in this plan makes a live `glab` call.
- Budgets bite: `skills/cad-land/SKILL.md` (12268 B),
  `cadence-core/references/git-publish.md` (4629 B) and
  `cadence-core/references/config-reach.md` (17232 B) are each budgeted at
  exactly their current size in `cadence-core/bin/weight-budgets.json`, so tasks
  6 and 7 re-pin in the same commit or self-verify reports `budget-overrun`.
