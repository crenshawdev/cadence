---
phase: 1
plan: 2
requirements: [PHS-01]
files:
  - cadence-core/bin/planning.mjs
  - cadence-core/bin/planning.test.mjs
---

# Phase 1: What a wrong answer destroys - Plan 2 (PHS-01)

## Goal

`cad-phase remove` refuses a git state it could not read rather than classifying
it as clean and deleting `phases/<N>/` recursively - at the pre-flight read and
at the `rmSync` fallback that is the destructive act itself.

## Must be true when done

- `renumber remove` run against a phase directory inside a repository whose git
  state cannot be read returns `ok:false` with a reason that is NOT
  `uncommitted-work`, on `--dry-run` and on apply alike, and `phases/<N>/` still
  exists afterwards.
- The refusal's detail and hint describe an unreadable git state and its remedy,
  never "commit or discard them first", which is the wrong instruction for a git
  that could not answer.
- `renumber remove` run in a directory that is not a git repository at all still
  succeeds and removes `phases/<N>/`; the eleven existing renumber fixtures on
  the bare `mkdtemp` tree pass unchanged.
- The `rmSync` recursive fallback cannot run on an unreadable git state: the
  classifier gates it independently of the pre-flight, and the failure it
  produces leaves `phases/<N>/` on disk.
- PHS-01 carries a check whose `WATCHED FAILING AT` header names `ae73dd6` or an
  earlier sha, and that check fails when re-run against that commit's tree.
- `node --test cadence-core/bin/*.test.mjs` and
  `node cadence-core/bin/self-verify.mjs` both exit 0.

## Context

Locked by `phases/1/CONTEXT.md`: D-05 keeps "not a git repository" PERMISSIVE -
empty answer, delete proceeds - so only a failure that is not that case may
refuse; D-06 makes the classifier a FILESYSTEM probe (walk up from `cwd` for a
`.git` entry), never git's exit code and never its stderr text, because a `.git`
at mode 000 makes `git status` and `git rev-parse` exit 128 with
`fatal: not a git repository`, byte-identical to a genuine non-repo; D-07 puts
the same classifier on the `rmSync` fallback as well as the pre-flight read;
D-11 makes the refusal a NEW named reason with its own hint, firing on
`--dry-run` too; D-12 builds the falsifier on a real repo made unreadable via
mode bits, carrying the established root skip.

The in-tree precedent for a probe that refuses to read a diagnostic string is
`gitIgnoreState` in this same file; the ban on a diagnostic string deciding
control flow is stated at `review-provider.mjs:278-282`. The current fail-open is
`uncommittedUnder`'s bare `catch { return []; }`, whose only caller is the guard
above the dry-run return in the renumber command; the second one is the
`try { git rm -r -q } catch { rmSync(..., { recursive: true }) }` step in the
apply loop.

## Tasks

### Task 1: The pre-flight refuses a git state it could not read

- **Files:** cadence-core/bin/planning.mjs
- **Action:** Add a filesystem classifier that answers, for a starting
  directory, whether a `.git` entry exists at it or at any ancestor - `lstat`-
  based so a dangling or unreadable symlink counts as present rather than
  absent, and total, never throwing. Wire it into `uncommittedUnder`'s catch
  arm so the caller can distinguish three states rather than two: a successful
  read (the paths, as today), a failure with no `.git` ancestor (still the
  permissive empty answer D-05 requires, since nothing is tracked there), and a
  failure with a `.git` ancestor present (unreadable). Choose the return shape;
  `uncommittedUnder` has exactly one caller, so a shape change costs nothing
  beyond that guard, and record the choice in the function's doc comment
  alongside the two-reasons paragraph already there. At the guard, refuse the
  unreadable state with a NEW reason distinct from `uncommitted-work` (D-11),
  emitted through the existing `fail(reason, detail, hint)` helper, whose detail
  names the phase directory and the unreadable git state and whose hint offers a
  remedy that fits it - never `uncommitted-work`'s "commit or discard them first",
  which instructs the caller to do something git cannot currently do for them.
  The guard already sits ABOVE the dry-run return, so the refusal fires on both
  arms; keep it there. Do not consult git's exit code, its status number or its
  stderr text to make this classification (D-06) - both states exit 128 with the
  same message, so a text read would be a parser over free text and would
  reclassify a genuine non-repo as unreadable, breaking D-05 and every bare
  `mkdtemp` renumber fixture.
- **Verify:** `node --test cadence-core/bin/planning.test.mjs` passes with every
  existing renumber fixture unchanged, including `renumber remove: uncommitted
  work in phases/<at> is refused before any write` (the real-repo one) and the
  bare-tree ones that must still remove successfully. By hand in a scratch
  repository whose `.git` is `chmod 000`: `renumber remove --n <N> --dry-run`
  and the same call without `--dry-run` both return `ok:false` with the new
  reason, and `phases/<N>/` still exists after both.

### Task 2: The `rmSync` recursive fallback is gated by the same classifier

- **Files:** cadence-core/bin/planning.mjs, cadence-core/bin/planning.test.mjs
- **Action:** Gate the apply loop's `rmSync(..., { recursive: true })` fallback -
  the one reached when `git rm -r -q` throws - on the same classifier Task 1
  added (D-07). When the classifier says a `.git` ancestor is present while git
  could not answer, the fallback must NOT delete: let the step fail with an error
  whose message names the unreadable git state, which the loop's existing catch
  turns into the `partial-apply` envelope with `completed: []` and its
  "nothing was written" hint, leaving `phases/<N>/` on disk. When no `.git`
  ancestor exists, the fallback still deletes exactly as today - that is the bare
  `mkdtemp` path every renumber fixture runs on, and breaking it would fail
  eleven shipped tests. This is a SECOND, independent fail-open, not a duplicate
  of Task 1: the pre-flight normally stops the caller first, and this arm is what
  covers a git state that became unreadable between the two, plus any `git rm`
  failure the pre-flight did not predict. Note in the step's comment why the
  guard is repeated here rather than trusted from the pre-flight.
- **Verify:** A source-level check added to `cadence-core/bin/planning.test.mjs`,
  in the form the shipped `source: planning.mjs's no-staged-set detail goes
  through redactUrl` test already uses, asserts the `rmSync` recursive fallback
  in the renumber apply loop is guarded by the classifier and fails if the
  unguarded `catch { rmSync(...) }` form comes back. `node --test
  cadence-core/bin/planning.test.mjs` passes, including every bare-tree renumber
  fixture that relies on the fallback deleting.

### Task 3: The PHS-01 falsifier on a real repo with an unreadable git state

- **Files:** cadence-core/bin/planning.test.mjs
- **Action:** Add the PHS-01 falsifier beside the existing real-repo fixture
  `renumber remove: uncommitted work in phases/<at> is refused before any write`,
  reusing its construction: `renumberTree()`, `git init` in the parent with
  `GIT_CONFIG_GLOBAL=/dev/null` and `GIT_CONFIG_SYSTEM=/dev/null` isolation, an
  initial commit, and the established root skip
  (`process.getuid() === 0 ? 'root bypasses mode bits' : false`) since the fixture
  makes git unreadable through mode bits (D-12). Assert both arms of the
  classifier in one family: with `.git` unreadable, `--dry-run` and apply each
  return `ok:false` with a reason that is not `uncommitted-work`, ROADMAP.md is
  byte-identical to before, and `phases/<N>/` and its `PLAN.md` still exist; and
  the permissive arm (AC5) - the bare `mkdtemp` tree with no repository at all
  still removes `phases/<N>/` and returns `ok:true`. Restore the mode bits in a
  `finally` so a failing assertion cannot leave an undeletable tmpdir behind, the
  way the shipped partial-apply fixture restores its `chmod`. Head the family
  with a `WATCHED FAILING AT ae73dd6` block in the form the `RVP-02 falsifier`
  block in `cadence-core/bin/review-provider.test.mjs` uses: the observed failure
  output at that sha (the remove reporting success and `phases/<N>/` gone), what
  it proves, and a re-watch recipe naming `git worktree add --detach`, the file
  to copy into that checkout (this test file alone - it drives the CLI through
  `execFileSync` and imports nothing this plan added), and a
  `--test-name-pattern` scope so the other cases are not mistaken for the watched
  failure.
- **Verify:** `node --test cadence-core/bin/planning.test.mjs` passes at HEAD.
  Re-run in a detached worktree at `ae73dd6` with only this test file copied in
  and the family's `--test-name-pattern` applied: it FAILS there, showing the
  remove succeeding and the phase directory gone. Then
  `node --test cadence-core/bin/*.test.mjs` and
  `node cadence-core/bin/self-verify.mjs` both exit 0.

## Notes

- D-13 (mechanics): this plan edits code the BLOCKING `risk_surface` detector
  matches - `lib/risk-diff.mjs`'s `destructive` category fires on `rmSync`, which
  is this plan's subject matter rather than a new exposure. Budget the blocking
  round and record the outcome or the override.
- `cadence-core/workflows/phase.md`'s `remove <N>` steps describe the dry-run
  gate but enumerate no failure reasons, so the new reason needs no doc edit to
  stay accurate. Whether that step should NAME the refusal is a separate
  judgement no locked decision covers; it is not planned here.
- The falsifier depends on mode bits behaving as measured on git 2.55.0. Under
  a filesystem or a user (root) where mode bits do not bind, the family skips
  rather than passing vacuously - that is what the root skip carries forward.
