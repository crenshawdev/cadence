---
phase: 3
plan: 2
requirements:
  - REL-01
files:
  - cadence-core/bin/git-branch.mjs
  - cadence-core/bin/git-branch.test.mjs
  - cadence-core/bin/self-verify.mjs
  - cadence-core/workflows/milestone.md
  - cadence-core/config.schema.json
  - cadence-core/references/config-catalog.md
  - cadence-core/references/config-reach.md
  - cadence-core/bin/weight-budgets.json
  - cadence-core/bin/prose-agreement.test.mjs
  - .planning/DOCS-CLAIMS.md
---

# Phase 3: Flags that do more or less than they say - Plan 2 (REL-01)

## Goal

`git.create_tag` governs the tag and nothing else. The milestone close stops
using it as the release-mode discriminator for the whole of step 2 - it decides
release mode from a BOUNDED tag probe plus a confirmed version - so setting the
key false no longer silently skips the manifest bump, and the key's documented
words name the site that actually reads it.

## Must be true when done

- `grep -rn "create_tag" cadence-core/ skills/` shows the key READ at exactly
  one site: `skills/cad-land/SKILL.md`'s land-time tag cut. No workflow file
  reads it.
- A milestone close that confirms a version bumps the plugin manifest
  regardless of `git.create_tag`, because step 2 never consults that key.
- Step 2 decides release mode from a bounded tags read plus a confirmed
  version, and the manifest bump stays gated on that CONFIRMED version rather
  than becoming unconditional.
- The bounded tags read returns no tags for a project that is not itself a
  repository sitting inside a repository that IS tagged, and still returns that
  repository's tags when asked from inside a real tagged repository.
- The key's schema `purpose`, its catalog row and its reach row all name the
  land-time tag cut; none of them says the tag happens at milestone close.
- `node --test cadence-core/bin/*.test.mjs` and `node
  cadence-core/bin/self-verify.mjs` both exit 0.

## Context

Locked: D-07 (after the fix exactly ONE site reads the key - cad-land's tag
cut; step 2 decides from the tag probe plus a confirmed version), D-08 (the
manifest bump stays gated on a CONFIRMED version - `release-bump.mjs` emits
`no-target-version` when the version is missing and `milestone.md` treats an
`ok:false` as a STOP, so an unconditional call turns a non-release close from a
skip into a failure), D-09 (the probe is bounded through phase 2's
`lib/git-tags.mjs readTags`, exposed to prose as a read-only tags subcommand,
not the bare `git tag` it is today), D-13 (the up-front one-shot config read
drops `git.create_tag` and keeps `git.auto_close`; the DOCS-CLAIMS rows
asserting that pair move in the same change), D-14 (the schema `purpose`,
catalog and reach rows are corrected to name the land-time tag cut), D-17
(a prose surface that GROWS carries its `weight-budgets.json` bump in the same
commit - `milestone.md` 11413 and `config-catalog.md` 9257 and
`config-reach.md` 19521 all sit EXACTLY at budget today), D-18 (the reach row
is REWRITTEN because its reach site changes file).

`skills/cad-land/SKILL.md` is deliberately NOT in this plan's files: it already
guards its tag cut on the key and is the site the corrected prose points at.

## Tasks

### Task 1: A bounded, read-only tags subcommand over readTags

- **Files:** cadence-core/bin/git-branch.mjs,
  cadence-core/bin/git-branch.test.mjs, cadence-core/bin/self-verify.mjs
- **Action:** `lib/git-tags.mjs`'s `readTags(dir, projectRoot)` is bounded to
  the project root the caller states (TAG-01) and has only two callers, both
  internal - so no seam exposes it to prose, and `milestone.md` step 2 still
  shells a bare `git tag`, which discovers upward. Add a `tags` subcommand to
  `git-branch.mjs` taking the same `--dir` its `decide` arm takes and printing
  one JSON line carrying the tag list, through `readTags` with `--dir` as BOTH
  the directory the question is asked from and the project root the answer must
  belong to - the binding `decide` already makes for itself and states in its
  own comment. `git-branch.mjs` is the right home over `planning.mjs`: it
  already imports `readTags`, its `--dir` already means the project root, and
  it is the git-facing workflow seam, where `planning.mjs`'s `--dir` is the
  planning root and its subcommands are planning-document surgery. Read-only in
  the strongest sense - the arm runs `git rev-parse` and `git tag --list` and
  nothing else, and it degrades to an empty list on every failure exactly as
  `readTags` already does, so a caller in a non-repository decides as it did
  before. Keep the seam convention the file already follows: one JSON line on
  stdout, exit 0, and the usage string for an unknown subcommand names both
  arms. Add the row for the new subcommand to `self-verify.mjs`'s script
  contract table beside `git-branch.mjs`'s existing `decide` row, or check 2
  reports `unknown-flag` against correct prose in Task 2.
- **Verify:** With `sub/` a non-repository directory holding `.planning/`
  inside a git repository tagged `v9.9.0` (the shape
  `git-branch.test.mjs`'s TAG-01 test at line 177 already builds, and
  `taggedFixture` already cuts tags), `node cadence-core/bin/git-branch.mjs
  tags --dir <sub>` prints `ok:true` with an EMPTY tag list, while the same
  command with `--dir` at the tagged repository's own root prints `v9.9.0`;
  `node --test cadence-core/bin/git-branch.test.mjs` and `node
  cadence-core/bin/self-verify.mjs` both pass.

### Task 2: Milestone step 2 decides release mode without git.create_tag

- **Files:** cadence-core/workflows/milestone.md,
  cadence-core/bin/weight-budgets.json, .planning/DOCS-CLAIMS.md
- **Action:** Rewrite step 2 so the release-mode decision is a CONFIRMED
  version plus the bounded tags read from Task 1, and `git.create_tag` is not
  read anywhere in this file. Confirm the version first (`$ARGUMENTS`, else
  propose the next from PROJECT.md's current and confirm it), probe published
  tags through the new subcommand naming the project root, and treat the close
  as a non-release milestone only when the project has never tagged AND no
  version was confirmed - then skip the step, note "no version bump
  (non-release milestone)", and do not frame the close as a version cut. Keep
  the existing posture verbatim: do not press the user toward a release they
  did not ask for. The `release-bump.mjs bump` call stays gated on that
  confirmed version and is NOT made unconditional (D-08): the seam emits
  `no-target-version` without one and this workflow treats an `ok:false` as a
  STOP, so an unconditional call would turn a non-release close from a skip
  into a failed close. The three halts, the tag-after-merge paragraph and the
  bump commit message are unchanged. In the up-front read at the top of the
  file, drop `git.create_tag` from the one-shot `config.mjs get` and keep
  `git.auto_close`, correcting the sentence that says the values are reused at
  steps 2 and 7 (D-13). Move `.planning/DOCS-CLAIMS.md`'s MILESTONE-01 row in
  the same change, in the ledger's own default style - the Claim cell stays as
  the sweep recorded it, the Resolution cell names the correction and what the
  file now reads; a self-referential commit sha is unknowable while writing the
  row, so name the requirement and milestone (`REL-01`, `v3.5.4`) where a prior
  row names a sha. Re-pin `milestone.md` in `weight-budgets.json` in this same
  commit if the file GREW - it sits exactly at its budget today, so any
  addition is an immediate `budget-overrun`; a shrink is left alone (D-17).
- **Verify:** `grep -n "create_tag" cadence-core/workflows/milestone.md`
  returns nothing, `grep -n "git tag" cadence-core/workflows/milestone.md`
  shows no bare probe left in step 2, and `node
  cadence-core/bin/self-verify.mjs` reports `ok:true` with no
  `budget-overrun`, no `missing-invocation` and no `unknown-flag` problem for
  the new subcommand.

### Task 3: The key's documented words name the land-time tag cut

- **Files:** cadence-core/config.schema.json,
  cadence-core/references/config-catalog.md,
  cadence-core/references/config-reach.md,
  cadence-core/bin/weight-budgets.json, .planning/DOCS-CLAIMS.md
- **Action:** `git.create_tag`'s schema `purpose` is the three words "Tag on
  milestone", which is the requirement's own framing of the defect: it says the
  tag happens at the milestone close, where the tag is cut at land on the
  pulled base after the merge confirms. Rewrite it to name that site and that
  moment, and rewrite the catalog row's Purpose (question) cell to match - the
  catalog is the question text a user reads while setting the key, so leaving
  it makes the flag keep misdescribing its reach after the code is right
  (D-14). The reach row currently reads `workflows/milestone.md -
  release-mode detection`, which Task 2 makes false and which omits the tag
  site entirely: rewrite the site column to name `skills/cad-land/SKILL.md`'s
  tag cut (D-18). If the reach column stays `universal` the purpose owes it
  nothing; if the rewrite states a narrower reach, the purpose must carry that
  phrase verbatim - self-verify check 9 is what decides, and it must stay
  green. Move `.planning/DOCS-CLAIMS.md`'s CONFIG-26 row (the catalog row's
  ledger entry) in the same change, in the style Task 2 uses. Re-pin any grown
  surface in `weight-budgets.json` in this commit (D-17).
- **Verify:** `node cadence-core/bin/config.mjs get git.create_tag` prints a
  purpose-free value line and `node cadence-core/bin/self-verify.mjs` reports
  `ok:true` with no `config-reach` and no `budget-overrun` problem; `grep -rn
  "create_tag" cadence-core/ skills/` shows no remaining text claiming the tag
  is cut at milestone close.

### Task 4: A check that fails on the pre-fix tree

- **Files:** cadence-core/bin/prose-agreement.test.mjs
- **Action:** Add the REL-01 falsifier to the file whose whole subject is prose
  that copies a machine-readable fact. Two assertions, both false at the tree
  this plan opened against: no file under `cadence-core/workflows/` names
  `git.create_tag` at all, and the key's schema `purpose` does not claim the
  tag is cut at the milestone close while `skills/cad-land/SKILL.md` is the one
  prose surface that reads the key. Scope the search to prose READ sites -
  `cadence-core/workflows/` and `skills/` - and not to `config.schema.json`,
  the catalog or the reach table, which name the key by definition; a check
  that counted those would be red for the wrong reason forever. Carry a
  `WATCHED FAILING AT <sha>` header naming a real commit preceding this fix,
  with what was observed there, in the shape the file's existing watched checks
  already use. Do not parse the shape of any table this file's header
  deliberately refuses to parse - read a named row or a literal string.
- **Verify:** `node --test cadence-core/bin/prose-agreement.test.mjs` passes on
  this tree, and re-running that one test file against the commit named in the
  `WATCHED FAILING AT` header FAILS.

## Notes

- This plan and PLAN-1 are NOT parallel-safe: they share
  `cadence-core/config.schema.json`,
  `cadence-core/references/config-catalog.md`,
  `cadence-core/references/config-reach.md`,
  `cadence-core/bin/weight-budgets.json`, `cadence-core/bin/self-verify.mjs`
  and `.planning/DOCS-CLAIMS.md`. Run them sequentially in plan-number order.
  PLAN-3 shares nothing with either and can run beside them.
- AC3's behavioral half ("with `git.create_tag: false` the close still bumps
  the manifest") is delivered as a property of the prose - step 2 never reads
  the key - and is proved by Task 2's grep plus Task 4's check rather than by
  running a live milestone close, which would mutate this repository's own
  planning documents.
