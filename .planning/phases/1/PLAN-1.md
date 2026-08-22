---
phase: 1
plan: 1
requirements: [REL-02, REL-03]
files:
  - cadence-core/bin/lib/release-decision.mjs
  - cadence-core/bin/release-decision.test.mjs
---

# Phase 1: The close that continues over a manifest nobody bumped - Plan 1

## Goal

The pure changelog core stops answering about a document it did not actually
read: section bounding, emptiness and the trailing link-reference block are
decided from the document's real structure - fences, subheadings and which
reference keys name a heading - rather than from a first-match line scan.

## Must be true when done

- Promoting an `## [Unreleased]` body that contains a fenced block with a `## `
  line inside it moves the WHOLE body into the dated section: the fence-open
  line, the fenced `## ` line, the fence-close and the trailing bullet all
  travel together.
- Scaffolding the dated heading into that same document never writes it INSIDE
  the fence: the fenced block comes through contiguous, and once the promotion
  has run the dated heading sits above it.
- A section whose body holds only `###`/`####` subheadings and blank lines
  reports as empty; a body that is a prose paragraph with no bullets does not.
- A last-in-file `## [Unreleased]` section ending in a `[#NN]: url` definition
  promotes that definition with its section, while a file-final `[1.0.0]: url`
  whose key names an existing `## [1.0.0]` heading stays where it is.
- `decideManifestBump`'s JSDoc names all nine codes the release-bump seam owns,
  and the seven verdict codes it owns itself are unchanged.
- `node --test cadence-core/bin/release-decision.test.mjs` passes with the three
  committed guard tests (the two link-reference tests and the sectionEmpty one)
  unmodified, and `node cadence-core/bin/self-verify.mjs --root .` returns
  `ok:true` with an empty `problems` array.

## Context

CONTEXT.md D-03 (emptiness is blank lines plus `###`/`####` only, prose is
content), D-04 (a heading-only body still PROMOTES and the halt fires off
`section_empty:true`), D-05 (the trailing ref block is the run at EOF whose keys
name an existing `## [key]` heading), D-09 (BOTH `^## ` scans get fence
awareness, not just `sectionEnd`) and D-11's JSDoc half are locked and bind every
task here. D-13 names the three regression guards: `release-decision.test.mjs`'s
two link-reference tests and its `sectionEmpty` test must stay green UNMODIFIED.
Out of scope for this plan: the seam envelope, `release-bump.mjs`, `milestone.md`
and the verdict-code set itself - D-02 keeps `decideManifestBump` returning
`skip`/`no-version-field` exactly as it does today, so no task here adds,
renames or removes a `code:` literal.

## Tasks

### Task 1: Make every `## ` heading scan in the module fence-aware

- **Files:** cadence-core/bin/lib/release-decision.mjs, cadence-core/bin/release-decision.test.mjs
- **Action:** Start reading at `sectionEnd`, then `prependChangelogEntry` - the
  two scans CONTEXT D-09 names. A `## ` line inside a fenced code block is not a heading, for
  every scan in this module. Add ONE module-private fence-state scanner and let
  the heading scans consult it; mirror the shape of the module-private
  `fenceScanner` in `lib/planning-files.mjs` - an opening fence is three or more
  backticks or tildes with up to three leading spaces, a closing fence is the
  same character at least as long carrying no info string, and the delimiter
  line itself is never a heading. It must be fed every line in order so the
  fence state at a match is the state a reader of the whole document would have.
  D-09 makes both cited scans in scope, not just `sectionEnd`: the next-heading
  scan in `sectionEnd`, and `prependChangelogEntry`'s anchor scans - its
  released-heading test, its `## [Unreleased]` locator, the next-`## `-after-
  Unreleased scan and the first-`## ` fallback. `prependChangelogEntry` is the
  one that actually corrupts the file: measured 2026-08-22 against this tree, it
  wrote `## [2.0.0] - 2026-08-22` INSIDE the fenced block, and the promotion that
  followed moved 3 of the body's lines and stranded the rest. Those two are the
  FLOOR, not the whole list: `promoteUnreleased`'s own `## [Unreleased]` and
  release-heading locators and `releaseSectionEmpty`'s heading locator are the
  same `^## ` scan and must consult the same fence state. Measured 2026-08-22 on
  a prototype that fixed only D-09's two: the fenced `## [2.0.0]` line the
  scaffold had left behind was then found as the promotion target and the whole
  staged body was spliced to the TOP of the file, above `# Changelog` - a worse
  document than the one the fix started from. Do NOT import the
  scanner from `lib/planning-files.mjs`: that module carries `node:fs`, this
  file's header states it never does I/O, and `lib/planning-files.mjs` is phase
  2's file and out of this phase's scope - moving the helper into a shared module
  would touch it. A second private scanner is not a censused copy: the `HELPERS`
  list in `helper-census.test.mjs` carries no fence row, and its rules match
  named body idioms only.
- **Verify:** `node --test cadence-core/bin/release-decision.test.mjs` passes
  with two new tests over one fixture whose `## [Unreleased]` body holds a
  bullet, a fenced block containing a `## [9.9.9] - inside a fence` line and a
  trailing bullet, above a real `## [1.0.0]` section: (1) `prependChangelogEntry`
  alone leaves the fence-open line, the fenced `## ` line and the fence-close
  line CONTIGUOUS - no dated heading spliced between them - and puts
  `## [<version>] - <date>` above the unfenced `## [1.0.0]` heading; (2)
  scaffolding then promoting, the order the seam composes in, puts the dated
  heading ABOVE the fence-open line with all five body lines - bullet,
  fence-open, the fenced `## ` line, fence-close, trailing bullet - between it
  and `## [1.0.0]`. Every pre-existing test in the file passes unmodified.

### Task 2: Report a heading-only release section as empty

- **Files:** cadence-core/bin/lib/release-decision.mjs, cadence-core/bin/release-decision.test.mjs
- **Action:** Start reading at `releaseSectionEmpty`. It is the module's only definition of "empty",
  and D-03 fixes that definition: blank lines plus `###`/`####` subheadings are
  emptiness, and ANY other non-blank line is content - including a prose
  paragraph with no bullets. Do not adopt the natural-looking "must contain a
  `- ` bullet" rule: every released section in this repo's own `CHANGELOG.md`
  opens with prose before any bullet, so that rule would report real authored
  sections as empty and fire the close's halt on every close. Leave
  `promoteUnreleased`'s own blank-edge trim and its `empty-unreleased` early
  return alone - D-04 keeps a heading-only `## [Unreleased]` body PROMOTING, with
  the halt firing afterwards off the returned `sectionEmpty`, and widening the
  trim so the `### ` scaffold survives under the stub is explicitly rejected.
  The fence work from task 1 already governs where the section ends, so this
  task changes what counts as content inside those bounds and nothing else.
- **Verify:** `node --test cadence-core/bin/release-decision.test.mjs` passes
  with two new assertions: scaffolding then promoting a document whose
  `## [Unreleased]` body is `### Added` and `### Fixed` with no bullets returns
  `sectionEmpty:true` (today it returns false - measured 2026-08-22), and the
  same over a body that is one prose paragraph with no bullets returns
  `sectionEmpty:false`. The committed `promote: sectionEmpty is false once
  content landed, true when the section stays bare` test passes unmodified.

### Task 3: Bound the trailing link-reference block by heading keys

- **Files:** cadence-core/bin/lib/release-decision.mjs, cadence-core/bin/release-decision.test.mjs
- **Action:** Start reading at `sectionEnd`'s trailing-reference scan, below the
  next-heading scan task 1 changed. D-05's rule, exactly: the trailing link-reference block is the run
  of `[key]: url` definitions at end of file whose keys name an existing
  `## [key]` heading in the document. Walking up from the last non-blank line,
  the block ends at the first definition whose key names no such heading, and
  everything above that point is body content that promotes with its section.
  Build the heading pattern for a key through the module's existing `escapeRe`,
  the way `promoteUnreleased` and `releaseSectionEmpty` already do for a version.
  Reject the obvious "stop the backwards scan at the first blank line": the
  committed `promote: trailing link references stay put when [Unreleased] is the
  last section` test pins the opposite outcome for a fixture that is also
  blank-separated. Reject version-shaped-keys-only (it loses refs for a project
  using non-semver release keys) and bounding from the last `## ` heading.
  Measured 2026-08-22 against a patched copy of this module: under this rule all
  42 committed tests in `release-decision.test.mjs` pass unchanged. Record the
  accepted cost in a comment where the rule is implemented: in a document whose
  file-final definition names no heading, the whole run at EOF becomes body and
  promotes - that is the rule's stated edge, not a regression to repair with a
  second exclusion.
- **Verify:** `node --test cadence-core/bin/release-decision.test.mjs` passes
  with two new tests: (1) a document whose LAST section is `## [Unreleased]` with
  a body of `- closes [#87]` followed by `[#87]: https://git.example/issues/87`
  promotes BOTH lines into the dated section (today the definition is stranded
  under the `## [Unreleased]` stub - measured 2026-08-22); (2) a document whose
  file-final `[1.0.0]: url` key names an existing `## [1.0.0]` heading leaves that
  definition in the trailing block, outside the promoted body. The committed
  `promote: trailing link references stay put...` and `promote: a reference
  definition INSIDE the body travels with the content that cites it` tests pass
  unmodified.

### Task 4: Name all nine seam codes in `decideManifestBump`'s JSDoc

- **Files:** cadence-core/bin/lib/release-decision.mjs
- **Action:** Start reading at `decideManifestBump`'s JSDoc, at its "the seam
  owns its own disjoint set" sentence. D-11's drift is bidirectional and this is its half in this file:
  the JSDoc sentence naming the seam's own disjoint set lists four codes
  (`no-plugin-manifest`, `unreadable-manifest`, `usage`, `internal`) where
  `release-bump.mjs`'s header owns nine. Add the five missing ones -
  `unreadable-sibling-manifest`, `unreadable-changelog`, `partial-bump`,
  `bad-date`, `missing-flag-value` - so the claim that "one list has one owner
  and the two can never disagree" is true rather than asserted. Leave the seven
  verdict codes listed immediately below BYTE-IDENTICAL: plan 2 adds a test that
  derives that set from this module's executable `code:` literals and asserts
  every member appears both here and in `release-bump.mjs`'s header, so a reflow
  of that list is what the guard exists to catch. Add, rename and remove no
  `code:` literal in this phase - D-02 keeps the `skip`/`no-version-field`
  verdict exactly as it is, and the seam-level refusal built on it is plan 2's
  work in `release-bump.mjs`.
- **Verify:** `grep -n "unreadable-sibling-manifest\|unreadable-changelog\|partial-bump\|bad-date\|missing-flag-value" cadence-core/bin/lib/release-decision.mjs`
  shows all five inside the `decideManifestBump` JSDoc block;
  `grep -n "no-target-version | unparseable-version | no-version-field |" cadence-core/bin/lib/release-decision.mjs`
  still matches, and the line below it still reads
  `already-at-target | downgrade | not-an-upgrade | bump`, so the verdict list
  was not reflowed; `node --test
  cadence-core/bin/release-decision.test.mjs` and
  `node cadence-core/bin/self-verify.mjs --root .` both pass, the latter with an
  empty `problems` array.

## Notes

- Plan structure deviates from CONTEXT's `Plan shape` directive in ONE detail
  and is otherwise the two-plan split it asks for: D-11's JSDoc half lives in
  `release-decision.mjs`, which is this plan's file, so it is task 4 here rather
  than in the seam plan that owns the rest of AC6. That keeps the two plans'
  declared `files:` disjoint, which is the hard constraint a split has to meet.
- One invariant is shared with plan 2 and is stated in both: the verdict-code
  set and the JSDoc list of it stay exactly as they are, because plan 2's
  code-set test reads them out of this file.
- All three rules here were prototyped on 2026-08-22 against a scratch copy of
  `lib/release-decision.mjs`, with the COMMITTED `release-decision.test.mjs` run
  against it: 42 of 42 passed with the fence masking, the heading-only emptiness
  rule and D-05's heading-key rule all applied together. D-05's flagged
  assumption in CONTEXT is therefore measured against the existing tests, though
  still not against a corpus of real-world changelogs.
- The one behaviour change that assumption predicted does happen: in a document
  whose file-final definition names no `## [key]` heading, the run at EOF is
  body and promotes. The committed `promote: trailing link references stay put`
  test still passes because it asserts the definitions' order and their position
  relative to the promoted bullet, not their position relative to the stub.
