---
phase: 5
plan: 5
requirements: [DOC-02]
files:
  - cadence-core/bin/prose-agreement.test.mjs
---

# Phase 5: What Cadence claims about itself is true - Plan 5 (the two derived assertions)

## Goal

The two facts Cadence has been trusting rather than checking - README's own
skill/role/rung-file counts, and that `PROJECT.md`'s `### Active` declares its
milestone before it mentions any other version - are asserted by tests that
derive BOTH sides from the tree.

## Must be true when done

- `cadence-core/bin/prose-agreement.test.mjs` carries an assertion that reads
  README's "Today it is N skills and M agent roles across K rung files" sentence
  and compares all three numbers against counts measured from `skills/` and
  `agents/` in the same run - no number typed into the test.
- It carries a second assertion that the version `activeVersion()` returns for
  `.planning/PROJECT.md` is the same version as the first version token appearing
  anywhere in that file's `### Active` body - naming no version literal.
- Feeding a README that carries a wrong count makes the first assertion fail,
  demonstrated on a scratch copy and shown in the task's output.
- Feeding `git show 81bdb5d:.planning/PROJECT.md` makes the second assertion
  fail, demonstrated and shown.
- `node cadence-core/bin/test.mjs prose` exits 0 against the live tree.

## Context

Locked by `phases/5/CONTEXT.md`. D-06: the count assertion lives HERE, in the
`prose` CI group, derives both sides from the tree, and covers `README.md` ONLY -
`cadence-core/bin/self-verify.mjs` runs against every `--root` fixture and any
user tree it is pointed at, where a `skills/` count means nothing, and a
hardcoded number would pin today's tree and report a correct future count as a
defect. `LINEAGE.md` duplicates the same two counts and stays a queue item; do
not touch it. D-07: the version assertion is STRUCTURAL and
`cadence-core/bin/lib/branch-decision.mjs` is NOT changed - neither
`activeVersion()` nor `DECLARED_VERSION_RE`. The line anchor is the deliberate
v2.4.0 fix for reading a mention as the milestone, with four fixtures pinning it
at `cadence-core/bin/branch-decision.test.mjs:237-265`, and loosening it would
ship a behaviour change to the branch-naming seam and the `version_drift`
comparand out of a docs phase. An assertion phrased as "the first version token"
would have PASSED on the broken file, which is why the property is that the two
scans AGREE.

The file's own subject is prose that copies a machine-readable fact
(`:1-17`), and both assertions are that. It already has a `doc(...parts)` helper
reading from the repo root and imports `readdirSync`, so read the existing
helpers before adding anything.

Measured at plan time: the live README sentence reads "27 skills and 6 agent
roles across 19 rung files"; `grep -L "user-invocable: false" skills/*/SKILL.md`
counts 27, `agents/*.md` counts 19, and those 19 collapse to 6 role basenames
once the `-low|-medium|-high|-xhigh|-max` rung suffix is stripped. At `81bdb5d`
`activeVersion()` returned `v3.0.0` while the first version token anywhere in the
`### Active` body was `v3.2.0` on the section's opening line - the line-anchored
token that won sat forty lines below it, produced by markdown wrapping
mid-sentence. On the live file both sides read `v3.3.0`.

## Tasks

### Task 1: Assert README's skill, role and rung-file counts against the tree

- **Files:** cadence-core/bin/prose-agreement.test.mjs
- **Action:** Add a test that parses the three numbers out of README's "Today it
  is N skills and M agent roles across K rung files" sentence and compares each
  against a count taken from the tree in the same run. Derive the sides, never
  type them: skills are the `skills/*/SKILL.md` files that do NOT declare
  `user-invocable: false` (the same question `README-44`'s v3.1.0 correction
  measured with `grep -L`, recorded at `.planning/DOCS-CLAIMS.md:136`); rung files
  are the `.md` files directly under `agents/`; roles are those filenames with the
  rung suffix stripped, deduplicated. Match the sentence by its shape rather than
  by a line number so a README edit above it cannot break the test, and fail with
  a message naming which of the three disagrees and both values, because a bare
  count mismatch tells a reader nothing about where to look. Do NOT read
  `LINEAGE.md`, which duplicates the same two counts and still publishes a stale
  agents row - it is a historical doc that `self-verify` already excludes and it
  stays a queue item (D-06). Do not add this check to
  `cadence-core/bin/self-verify.mjs`.
- **Verify:** `node --test cadence-core/bin/prose-agreement.test.mjs` passes
  against the live tree; and with a scratch copy of README.md whose count sentence
  carries a wrong skill number written over `README.md`, the same command FAILS
  naming the skill count and both values, after which `git checkout -- README.md`
  restores the tree and the command passes again.

### Task 2: Assert the `### Active` version declaration is the section's first version token

- **Files:** cadence-core/bin/prose-agreement.test.mjs
- **Action:** Add a test asserting a STRUCTURAL property of
  `.planning/PROJECT.md`: the version `activeVersion()` returns - imported from
  `cadence-core/bin/lib/branch-decision.mjs`, which this task does not modify -
  is the same version as the FIRST version token appearing anywhere in the
  `### Active` body, where the body runs from the `### Active` heading to the next
  level-1..3 heading exactly as `activeVersion`'s own doc comment defines it. Name
  no version literal anywhere in the test, so it never needs re-baselining at a
  cycle open. Fail with a message giving both tokens and the line each was read
  on, and say what the disagreement means - a line-anchored token below an earlier
  prose mention wins under `DECLARED_VERSION_RE`, which makes `version_drift`
  compare the wrong version against the tag list while the docs themselves are
  correct. Do not change `activeVersion()` or `DECLARED_VERSION_RE` and do not add
  a fallback to them: the anchor is the deliberate v2.4.0 fix for reading a
  mention as the milestone and four fixtures pin it (D-07).
- **Verify:** `node --test cadence-core/bin/prose-agreement.test.mjs` passes
  against the live tree; and with `git show 81bdb5d:.planning/PROJECT.md` written
  over `.planning/PROJECT.md`, the same command FAILS naming `v3.0.0` and
  `v3.2.0`, after which `git checkout -- .planning/PROJECT.md` restores the tree
  and the command passes. `node cadence-core/bin/test.mjs prose` exits 0 at the
  task's commit.

## Notes

Independent of plans 1, 2, 3 and 4 - it shares no file with any of them.
`cadence-core/bin/*.test.mjs` carries no `weight-budgets.json` entry, so nothing
here needs a budget re-pin.

This is the first test in `cadence-core/bin/` to read the repo's own
`.planning/PROJECT.md` rather than a fixture it wrote. That is what AC6 asks for
and what makes the assertion load-bearing, but it means the test is coupled to a
file that exists in this checkout; if the executor finds it does not resolve
under the CI invocation, that is a finding to report, not a reason to weaken the
assertion into a fixture that cannot go red.
