---
phase: 1
plan: 2
requirements: [REL-01, REL-03]
files:
  - cadence-core/bin/release-bump.mjs
  - cadence-core/bin/release-bump.test.mjs
  - cadence-core/bin/prose-agreement.test.mjs
  - cadence-core/workflows/milestone.md
  - cadence-core/bin/weight-budgets.json
  - .planning/DOCS-CLAIMS.md
---

# Phase 1: The close that continues over a manifest nobody bumped - Plan 2

## Goal

The release seam stops returning success, or a benign `skip`, over inputs it did
not handle: a primary manifest carrying no `version` field halts the close, an
absent `CHANGELOG.md` is a state the envelope names, an unparseable `--version`
refuses by naming what it was given, and every verdict code the core can return
reaches the documents that claim to list them.

## Must be true when done

- `release-bump.mjs bump` against a manifest with no `version` field halts the
  close: `ok:false`, `action:"refuse"`, `reason:"no-version-field"`, exit 1, and
  neither the manifest nor `CHANGELOG.md` changes a byte - while this repo's own
  manifest pair still bumps `ok:true` with `.claude-plugin/marketplace.json`
  recorded as `action:"skip"`.
- An absent `CHANGELOG.md`, a present one that was read and needed nothing, and a
  run that refused before the changelog was ever examined return three
  distinguishable envelopes, and `workflows/milestone.md` names the absent state.
- `release-bump.mjs bump --version v` refuses with the raw `v` in the envelope
  and named in the detail, instead of `no-target-version` over an empty target.
- Adding a verdict code to `decideManifestBump` without documenting it in BOTH
  `release-bump.mjs`'s header and `release-decision.mjs`'s JSDoc reddens a test.
- `workflows/milestone.md`'s halt list stops the close on the no-version-field
  refusal.
- `node cadence-core/bin/self-verify.mjs --root .` returns `ok:true` with an
  empty `problems` array, and `node --test 'cadence-core/bin/release-*.test.mjs'`
  plus `node --test cadence-core/bin/prose-agreement.test.mjs` pass.

## Context

CONTEXT.md's locked decisions bind every task: D-01 puts the no-version-field
refusal at the SEAM (`ok:false`), never in the pure core and never as a fifth
`milestone.md` halt; D-02 keeps `decideManifestBump` returning
`skip`/`no-version-field` and keeps SIBLING manifests skipping, because
`.claude-plugin/marketplace.json` carries no `version` by design; D-06 keeps the
raw `--version` argument and refuses naming it rather than changing
`normalizeTargetVersion`, whose second consumer is `planning.mjs`'s
`version_drift` signal; D-07 derives the code-set test from executable source,
never from one prose list compared to another; D-10 makes the absent-changelog
signal an explicit field set on every path; D-12 makes the `milestone.md` budget
re-pin part of the same commit as any prose added there. Out of scope for this
plan: `lib/release-decision.mjs` and `release-decision.test.mjs` (plan 1's
files), any change to `normalizeTargetVersion`, and any rewrite of the changelog
format.

## Tasks

### Task 1: Refuse a primary manifest that carries no `version` field

- **Files:** cadence-core/bin/release-bump.mjs, cadence-core/bin/release-bump.test.mjs
- **Action:** Start reading at `bump`, at its `decideManifestBump`
  primary-verdict arm. A PRIMARY verdict of `skip`/`no-version-field` becomes the seam's
  refusal: `ok:false`, `action:"refuse"`, `reason:"no-version-field"`, the target
  and `manifest` disposition fields filled the way the neighbouring refusal arm
  fills them, `siblings:[]`, nothing written, exit 1 through `emit`'s ok-mirroring
  (never `process.exit`, which can truncate stdout on a pipe). Measured
  2026-08-22 against this tree, that case returns `{"ok":true,"action":"skip"}` at
  exit 0 and the close continues over an unbumped manifest. Write the seam's OWN
  `detail` sentence - the primary manifest carries no `version` field, so this
  release would ship unbumped; repair the manifest or close without a version
  bump - rather than passing the verdict's "leave it untouched" sentence
  through, which reads as benign on a refusal. SIBLINGS ARE UNTOUCHED (D-01,
  D-02): a sibling's `skip` keeps its `siblings[]` row and the pure core keeps
  returning that verdict, because `.claude-plugin/marketplace.json` carries no
  `version` by design and a verdict-level refusal would halt Cadence's own
  milestone close every cycle. Record the mapping in the header's refusal
  section, beside the existing sibling-refusal exception, since the header
  currently says verdict codes are emitted verbatim and this is the one primary
  verdict the seam re-classifies. Rewrite the committed `bump: a version-less
  manifest skips` test to the refusal, keeping its assertion that the `version`
  field really was removed from the fixture and its byte-identical `CHANGELOG.md`
  check.
- **Verify:** `node --test cadence-core/bin/release-bump.test.mjs` passes, with
  the rewritten test asserting `ok:false`, `action:"refuse"`,
  `reason:"no-version-field"`, exit status 1 through the file's `seamStatus`
  helper, and `.claude-plugin/plugin.json` plus `CHANGELOG.md` byte-identical
  afterwards; and a new test that copies THIS repo's own
  `.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json` into a temp
  fixture and runs the seam with a target above the manifest's own version,
  asserting `ok:true` with a `siblings[]` row for
  `.claude-plugin/marketplace.json` carrying `action:"skip"`.

### Task 2: Name the changelog's state explicitly on every envelope

- **Files:** cadence-core/bin/release-bump.mjs, cadence-core/bin/release-bump.test.mjs
- **Action:** Start reading at `bump`'s changelog gate and at `readChangelog`.
  Every `changelog` object this seam emits carries an explicit field
  naming what happened to `CHANGELOG.md` on that run, set on EVERY path that
  emits one - the `ok:true` success emit, all the in-`bump` refusals including
  the one task 1 added, and the `partial-bump` arm (whose object is spread from
  the same value, so it inherits the field). Today the three states differ only
  by key PRESENCE - `section_empty` is absent when the changelog is absent and
  `false`/`true` when it was read - so `milestone.md`'s halt reads an absent
  changelog and a clean one alike, and a project with no `CHANGELOG.md` closes as
  if the notes were fine. Planner's choice, recorded here because D-10 leaves the
  spelling open: the field is `changelog.state` and it reuses `readChangelog`'s
  own three-state vocabulary - `absent`, `unreadable`, `ok` - plus `not-examined`
  for the paths that returned before the changelog gate was entered. Do not
  touch the two envelopes that deliberately carry no `manifest`, `siblings` or
  `changelog` key at all: the `no-plugin-manifest` skip and the dispatch's
  `bad-date` refusal, whose own comment states that filling those fields there
  would fabricate them. Keep `changed`, `promoted` and `section_empty` exactly as
  they are - `section_empty` is still what the close's empty-section halt reads.
- **Verify:** `node --test cadence-core/bin/release-bump.test.mjs` passes with
  one new test driving three fixtures and asserting three different values of the
  new field in one place: a run whose `CHANGELOG.md` is absent, a second run over
  a present changelog with nothing left to do, and a run that refuses before the
  changelog gate (a no-version-field or unreadable-sibling fixture). The three
  envelopes must differ by that field's VALUE, not by whether the key is present.

### Task 3: Refuse an unparseable `--version` by naming the raw argument

- **Files:** cadence-core/bin/release-bump.mjs, cadence-core/bin/release-bump.test.mjs
- **Action:** Start reading at `bump`'s `normalizeTargetVersion` call, the line
  CONTEXT D-06 cites. Measured 2026-08-22: `bump --version v` returns
  `{"ok":false,"reason":"no-target-version","target":""}` - the seam strips the
  leading `v`, is left with an empty string, discards the raw argument and then
  reports that no version was given, which is false and names nothing the
  operator can fix. Keep the raw argument (D-06): when `--version` carried a
  value whose trimmed form is non-empty but normalization leaves nothing usable,
  the run refuses as `unparseable-version` with the RAW trimmed value in `target`
  and named in `detail`. Reach that verdict through the existing
  `decideManifestBump`, whose `unparseable-version` sentence already names the
  offending value, rather than minting a verdict code inside the seam - the code
  set has one owner and this phase does not move it. Do NOT change
  `normalizeTargetVersion`: `planning.mjs` reads it for v-stripping inside the
  audit's `version_drift` signal, so its contract is not local to this seam, and
  the null-returning variant CAPTURE proposes still yields `no-target-version`,
  which does not name `v`. An ABSENT `--version` must keep returning
  `no-target-version` (the committed `bump: no --version refuses even while
  PROJECT.md ### Active names one` test pins it), and a blank value must keep
  refusing at its declared `lib/arg-contract.mjs` row as `missing-flag-value`.
- **Verify:** `release-bump.mjs bump --dir <fixture> --version v` prints
  `ok:false`, `action:"refuse"`, `reason:"unparseable-version"`, `target:"v"` and
  a `detail` containing `v`, at exit 1 with the fixture's manifest and changelog
  byte-identical; `--version "  v  "` behaves the same; `--version vv` still
  refuses as `unparseable-version`; `--version` absent still returns
  `no-target-version`; `--version "   "` still returns `missing-flag-value`. A
  new test pins each of those and `node --test
  cadence-core/bin/release-bump.test.mjs` passes.

### Task 4: Redden when a verdict code never reaches the two documents

- **Files:** cadence-core/bin/release-bump.mjs, cadence-core/bin/prose-agreement.test.mjs
- **Action:** Start reading at `release-bump.mjs`'s leading header comment block,
  at its "The VERDICT codes" sentence. Two halves, both about the same drift. First: the header's verdict
  sentence names four of the seven codes the core can return - add
  `unparseable-version`, `downgrade` and `not-an-upgrade`, and state there that a
  PRIMARY `no-version-field` is re-classified by this seam as a refusal (task 1)
  if that sentence does not already say so. Second: a test that derives the set
  from EXECUTABLE source - the `code: '<token>'` string literals inside
  `decideManifestBump` in `cadence-core/bin/lib/release-decision.mjs` - and
  asserts every token appears in `release-bump.mjs`'s leading header comment
  block AND in that function's JSDoc block. Derive from the literals and never by
  comparing the two prose lists to each other (D-07): a JSDoc-to-header
  comparison passes when both lists are stale together, which is exactly how this
  defect survived two cycles. `helper-census.test.mjs` is this tree's precedent
  for a test that regexes module source. The test lives in
  `prose-agreement.test.mjs` because its subject is that file's stated one -
  prose copying a machine-readable fact must still match it - and because the
  `prose` group in `test.mjs` already runs that stem, so no runner registration
  is needed. Assert the extraction is non-vacuous - at least the seven codes
  shipped today - so a regex that matched nothing cannot pass green, and make
  each failure message name the missing token and the document that lacks it. Do
  not extend the test to `milestone.md`'s halt list or to the seam's own nine
  codes: AC6 scopes it to these two documents.
- **Verify:** `node --test cadence-core/bin/prose-agreement.test.mjs` passes;
  deleting one code token from `release-bump.mjs`'s header makes it FAIL naming
  that token and that file, and deleting one from `decideManifestBump`'s JSDoc
  makes it fail naming that file - both restored afterwards, with the test green
  again.

### Task 5: Halt the close on the two states, and re-pin the surfaces that name them

- **Files:** cadence-core/workflows/milestone.md, cadence-core/bin/weight-budgets.json, .planning/DOCS-CLAIMS.md
- **Action:** Step 2's refusal halt enumerates the reason codes by name; add
  `no-version-field` to that list so the close stops on the refusal task 1 built
  (D-01 costs exactly this one token, and the caller census makes this file the
  seam's only production caller). The changelog halt names only
  `changelog.section_empty: true`; add the ABSENT state by name, using the field
  and value task 2 shipped, so a run over a project with no `CHANGELOG.md` is
  reported as that rather than read as a clean changelog. Keep both additions
  tight: `milestone.md` measures 14937 bytes against a budget of exactly 14937,
  so re-pin its entry in `weight-budgets.json` to the file's new byte count IN
  THIS SAME COMMIT or self-verify's budget check fails on this phase's own work
  (D-12). Then update `.planning/DOCS-CLAIMS.md` by hand (D-14): the
  `MILESTONE-06` row's claim must list the refusal codes the prose now names, and
  the `MILESTONE-08` row's line range is already stale - it cites 60-62 while the
  claim lives further down - so both rows get their current line ranges. No
  mechanical check enforces those rows; the hand edit is the floor, and this
  phase adds no new backstop for them.
- **Verify:** `node cadence-core/bin/self-verify.mjs --root .` returns `ok:true`
  with an empty `problems` array; `wc -c cadence-core/workflows/milestone.md`
  equals the re-pinned `cadence-core/workflows/milestone.md` value in
  `weight-budgets.json`; `grep -n "no-version-field" cadence-core/workflows/milestone.md`
  shows it inside step 2's refusal halt; grepping the changelog halt shows the
  absent state named with the same field and value the seam emits; and the
  `MILESTONE-06` and `MILESTONE-08` rows in `.planning/DOCS-CLAIMS.md` cite line
  ranges that match where those claims now sit.

## Notes

- Plan structure follows CONTEXT's `Plan shape` directive with one recorded
  deviation: D-11's release-decision.mjs JSDoc half rides plan 1, because that
  file is plan 1's and the two plans' declared `files:` must not overlap. Task 4
  here still fixes the other direction of the same drift and guards both.
- One invariant is shared with plan 1 and stated in both: neither plan adds,
  renames or removes a `code:` literal in `decideManifestBump`, which is what
  lets task 4's test read that file while plan 1 edits its prose.
- Both plans are independently verifiable against the current tree: nothing in
  this plan needs plan 1's parser fixes, and none of the committed
  `release-bump.test.mjs` fixtures carry a fenced block, a heading-only
  `## [Unreleased]` body or a body-final link reference, so plan 1's changes do
  not move any assertion here.
