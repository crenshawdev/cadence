---
phase: 1
plan: 3
requirements:
  - WHY-01
files:
  - cadence-core/bin/lib/why-corpus.mjs
  - cadence-core/bin/why-corpus.test.mjs
  - cadence-core/bin/lib/why-render.mjs
  - cadence-core/bin/why.mjs
  - cadence-core/bin/why.test.mjs
---

# Phase 1: The corpus, read back at a file and line - Plan 3

## Goal

A commit whose phase directory was deleted or renumbered by a milestone close
still resolves to the phase that produced it, out of git history, and where it
cannot, the output names the gap instead of guessing a phase number.

## Must be true when done

- A commit behind a `--mode delete` close resolves its phase through a reverse
  commit-to-phase map built from git history, and prints that phase's recovered
  plan task and decision.
- A commit whose phase directory was renumbered still resolves, because the map
  keys on the commit the record names and never on a directory name or a commit
  message scope.
- When the map has no entry for a commit, the output names the gap and, where a
  milestone label is available, names it, and still prints what git history and
  `.planning/ARCHIVE.md` do carry.
- No phase number appears anywhere in the output that was not read from a
  recovered artifact; a conventional-commit scope is printed as corroboration
  and labelled as such, never as the answer.
- Two runs over an unchanged tree remain byte-identical, and the whole command
  still dispatches no subagent.
- `node cadence-core/bin/self-verify.mjs --root .` returns `ok:true` with
  `problems: []`, and `node cadence-core/bin/test.mjs` reports 0 failures.

## Context

Locked by `phases/1/CONTEXT.md`: D-05 builds the reverse map in ONE pass off the
prune commits and their parents' recovered SUMMARY `## Commits` tables, and binds
a milestone label to a prune commit through the ARCHIVE.md heading that same
commit appends; D-03's third tier is git history alone, for the `--mode delete`
closes; D-04 says `.planning/ARCHIVE.md` carries no commit-to-phase edge and
cannot supply one; D-06 forbids reading the commit scope as the phase key. This
plan extends the modules plans 1 and 2 created and writes nothing to the record.

## Tasks

### Task 1: The prune-commit search and the milestone label binding

- **Files:** cadence-core/bin/lib/why-corpus.mjs, cadence-core/bin/why-corpus.test.mjs
- **Action:** Add the history half of the locator: find every commit that
  DELETED a phase SUMMARY, in one pass, and bind each to the milestone label its
  close carried. The search is
  `git log --full-history --diff-filter=D -- '.planning/phases/*/SUMMARY.md'`,
  and `--full-history` is load-bearing rather than decorative: measured against
  this repository on 2026-08-22, the same command WITHOUT it returns 4 prune
  commits and with it returns 25, because git's default history simplification
  drops commits a pathspec makes uninteresting - so the plain form silently
  loses 21 of 25 closes and would report the gap on milestones the record can
  actually answer. Pair it with `--name-only` so the deleted paths come back in
  the same pass; D-05 rejects a lazy per-commit `git show`, which reruns the
  prune search per chain entry. The label comes from the same commit: a prune
  appends `.planning/ARCHIVE.md`'s `## <label>` heading in the commit that
  removes the directories, so diffing that file at the prune commit yields the
  milestone label deterministically (measured: `72940906` appends `## v3.5.9`).
  A prune commit with more than one parent is REPORTED rather than resolved -
  `--full-history` can surface merges and `<sha>^` then names one parent
  arbitrarily; all 25 in this repository are single-parent today, which is what
  makes the refusal cheap rather than a lost answer. Every returned array sorts
  by an explicit key, commit date then full 40-character sha (D-17).
- **Verify:** `node --test cadence-core/bin/why-corpus.test.mjs` passes with:
  the search run against this repository returning 25 prune commits including
  `72940906`, `a34b0c8a` and `8d9bbac9`, and a control assertion that the same
  search without `--full-history` returns strictly fewer, so the flag cannot be
  dropped without a red test; `72940906` binding to the label `v3.5.9`; a temp
  repository with two closes returning both prune commits with their own labels
  and in a stable order across two runs; and a synthetic merge-shaped prune
  commit returning a reported refusal rather than a parent-derived answer.

### Task 2: The reverse commit-to-phase map

- **Files:** cadence-core/bin/lib/why-corpus.mjs, cadence-core/bin/why-corpus.test.mjs
- **Action:** For each prune commit task 1 found, recover the SUMMARY.md at that
  commit's parent for every phase path the prune deleted - `git show
  <prune>^:<path>` - and index its `## Commits` rows through the reader plan 2
  task 1 built, under the milestone label task 1 bound. The result is one map
  from a commit to `{milestone label, phase, plan, task, description}`, merged
  with the on-disk index plan 2 task 2 produces, so a caller asks one question
  and the tier that answers it is an implementation detail (D-03). The KEY is
  the commit named in the record, never the directory name and never the commit
  message scope: that is what makes a renumbered phase resolve unchanged - a
  `/cad-phase` renumber moves the directory and leaves the table's rows exactly
  where they were. Matching stays a case-insensitive prefix test in either
  direction against full 40-character shas (D-17), which is what admits the
  7-character abbreviations every on-disk archive uses and the 8-character ones
  v3.5.9's record carries. A sha the map names that this clone does not have is
  a stated absence, not a dropped row: 248 of 248 shas extracted from archived
  tables resolve with `git cat-file -e` here, and a shallow clone is the case
  that does not.
- **Verify:** `node --test cadence-core/bin/why-corpus.test.mjs` passes with:
  the merged map resolving `73aa7bba` to milestone `v3.5.9`, phase 1, plan 1,
  task 1 with the description `Fence-aware heading scans in
  release-decision.mjs` verbatim, recovered from
  `git show 72940906^:.planning/phases/1/SUMMARY.md`; the same map NOT resolving
  it to the live `.planning/phases/1`, which holds v3.6.0's phase 1; the
  8-character `73aa7bba` matching its own full sha and not `73aa7bbb...`;
  building the map twice over the unchanged repository returning deep-equal
  results; and a fixture whose recovered SUMMARY names a sha absent from the
  repository returning that row with a stated-absent commit rather than
  omitting it.

### Task 3: Wire the recovered map into the chain

- **Files:** cadence-core/bin/why.mjs, cadence-core/bin/lib/why-render.mjs, cadence-core/bin/why.test.mjs
- **Action:** Build the merged map once per invocation in the seam, at the same
  place plan 2 task 3 built the on-disk index, and let an entry that no on-disk
  summary claims resolve through the recovered half. A resolved entry prints
  the milestone label beside the phase number so a reader can tell v3.5.9's
  phase 1 from v3.6.0's, which is the whole failure D-06 names as invisible.
  Every field printed here is read from the recovered artifact; nothing is
  derived from the directory that no longer exists.
- **Verify:** `node --test cadence-core/bin/why.test.mjs` passes with a seam run
  against `cadence-core/bin/lib/release-decision.mjs` in this repository whose
  entry for `73aa7bba` names milestone `v3.5.9`, phase 1, plan 1 and task 1, and
  carries `Fence-aware heading scans in release-decision.mjs` verbatim - a path
  whose phase directory does not exist on disk in any form. The two-run
  byte-identity assertion from plan 1 still passes with the recovered map in
  place.

### Task 4: The recovered artifacts behind the remaining edges

- **Files:** cadence-core/bin/lib/why-corpus.mjs, cadence-core/bin/why-corpus.test.mjs, cadence-core/bin/why.mjs, cadence-core/bin/why.test.mjs
- **Action:** Make plan 2's decision, deviation and surviving-review edges work
  on a phase whose directory is gone, by reading their artifacts at the prune
  commit's parent instead of from disk - the CONTEXT.md, the plan files and the
  `ADJUDICATION-*.json` records under the same recovered `phases/<N>/` path -
  and feeding them to the SAME readers plan 2 built, never to a second set. The
  readers stay pure and text-fed precisely so this tier costs a different source
  and not a different parser. Listing the recovered directory is
  `git ls-tree` at the parent, not a guess at filenames, because
  `ADJUDICATION-<trigger>-<discriminator>[-rN].json` carries a discriminator no
  caller can predict. Bound this: recover artifacts only for the phases the
  chain's entries actually resolved to, so a chain of ten entries reads at most
  ten phases' artifacts rather than every phase in history. An artifact the
  parent tree does not carry is a stated absence for that edge, not a failure of
  the entry.
- **Verify:** `node --test cadence-core/bin/why.test.mjs` passes with a seam run
  against `cadence-core/bin/release-bump.mjs` in this repository whose entry for
  `c7921b29` - v3.5.8 phase 2, plan 2, task 3, inside the record's
  `776c1d8e`..`649f1694` range - carries the surviving finding from
  `git show a34b0c8a^:.planning/phases/2/ADJUDICATION-risk_surface-plan-2.json`,
  quoting its `claim` verbatim, and carries that phase's recovered CONTEXT
  decisions and `## Deviations` bullets. `node --test
  cadence-core/bin/why-corpus.test.mjs` passes with a temp repository where a
  pruned phase's parent tree carries a CONTEXT.md but no adjudication record,
  and the decision edge resolves while the review edge states its absence.

### Task 5: The named gap, and the phase number that is never guessed

- **Files:** cadence-core/bin/lib/why-corpus.mjs, cadence-core/bin/why-corpus.test.mjs, cadence-core/bin/lib/why-render.mjs, cadence-core/bin/why.mjs, cadence-core/bin/why.test.mjs
- **Action:** Close AC4's second half. When neither tier resolves a commit, the
  entry names the gap explicitly - which lookup failed and, where the commit's
  date falls inside a known close, which milestone label the gap sits under -
  and still prints what git history carries for that commit: its sha, date,
  author-facing subject and the paths it touched. `.planning/ARCHIVE.md`
  contributes its milestone's residue snippets and NOTHING else: it carries no
  commit-to-phase edge and cannot supply one, its row grammar is an origin path
  plus free text, only 18 of 558 rows contain any hex token and those are
  incidental prose inside deviation text, and only `Deviations` and `Open items`
  ever reach the file - the `## Commits` table is never archived (D-04). Read
  its rows through `parseArchiveRows` in `lib/planning-files.mjs`, which already
  carries the label/origin split and the phase-number round-trip guard; do not
  re-split its composed `source`. Finally the corroboration arm: a conventional
  commit's `<type>(<phase>-<plan>)` scope is PRINTED, labelled as a scope read
  off the commit message and explicitly not a resolved phase (D-06). It may
  never become the answer - phase numbers reset every milestone, `feat(1-1)`
  exists in seven cycles, both candidate directories legitimately exist and the
  failure is therefore invisible. Measured over 1,711 commits: 749 carry
  `(N-M)`, 190 carry `(N)`, 526 are conventional with no scope and 135 are not
  conventional at all, so the scope is absent or uninformative on 39% of them
  anyway.
- **Verify:** `node --test cadence-core/bin/why.test.mjs` passes with: a seam
  run over a temp repository whose commit no summary names, returning that entry
  with a named gap, its sha, date, subject and touched paths, and NO phase
  number anywhere in the entry; the same fixture with a `feat(3-1)` subject
  showing `3-1` under a scope label while the phase field still reads as the
  gap; a fixture carrying an `.planning/ARCHIVE.md` with one `## <label>`
  section printing that section's rows and no commit join; and a whole-output
  assertion that on the unresolved arm the rendered `text` contains no digit
  presented as a phase. `node cadence-core/bin/self-verify.mjs --root .`
  returns `ok:true` with `problems: []` and `node cadence-core/bin/test.mjs`
  reports 0 failures.

## Notes

- The `--full-history` finding in task 1 was measured during planning, not
  inherited from CONTEXT: D-05 states the search without that flag, and the
  plain form returns 4 of this repository's 25 prune commits. Task 1's control
  assertion exists so the flag cannot be removed without a red test.
- All three plans of this phase share declared files, so `plan-overlap` reports
  overlaps and the phase runs sequentially in plan order. Plan 3 must run last:
  it extends the locator plan 2 built and the seam plan 1 created.
- CONTEXT's second flagged assumption - that every `ADJUDICATION-*.json` entry
  carries both `base_id` and `head_id` - held on the second record checked
  during planning (`a34b0c8a^:.planning/phases/2/ADJUDICATION-risk_surface-plan-2.json`,
  one `survived` entry, both fields present). Plan 2 task 6 already carries the
  degradation arm for the case it does not.
