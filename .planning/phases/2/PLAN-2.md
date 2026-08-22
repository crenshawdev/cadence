---
phase: 2
plan: 2
requirements: [JRN-03]
files:
  - cadence-core/bin/release-bump.mjs
  - cadence-core/bin/release-bump.test.mjs
  - cadence-core/workflows/milestone.md
  - cadence-core/bin/weight-budgets.json
  - .planning/DOCS-CLAIMS.md
---

# Phase 2: Both callers on the journal - Plan 2 (`release-bump`)

## Goal

`release-bump` reads and validates every manifest and the changelog it will
write BEFORE it writes the first of them, so a malformed sibling can no longer
leave a partially bumped release tree inside an `ok:true` envelope - while the
sibling that is readable but simply not upgradeable keeps the `siblings[]`
refusal row the close already halts on.

## Must be true when done

- `release-bump.mjs bump --version <v>` against a fixture whose
  `.claude-plugin/marketplace.json` is present but UNPARSEABLE returns
  `{"ok":false}` at exit 1, `.claude-plugin/plugin.json` still reads the OLD
  version, and `CHANGELOG.md`'s sha256 is unchanged - measured today (n=1) the
  same run returned `ok:true` with `plugin.json` already bumped and the
  CHANGELOG heading already dated.
- That refusal names a machine `reason` of its own, distinct from the primary
  manifest's `unreadable-manifest`, so an operator reading the halt knows which
  manifest to repair without opening both.
- A `CHANGELOG.md` that is present but not readable refuses the same way with
  its own code and nothing written, where today `readText`'s `''`-on-failure
  contract scaffolds a fresh changelog over the old one after the manifest has
  already been bumped.
- The existing `siblings[]` refusal arm is untouched: a sibling that PARSES but
  whose `decideManifestBump` verdict is `refuse` still returns `ok:true` with a
  `siblings[]` row carrying `action:"refuse"` and that verdict's own code, and
  `cadence-core/bin/release-bump.test.mjs`'s case `bump: a SIBLING that would
  downgrade is recorded as a refusal, not silently written (D-08)` passes
  unmodified.
- In `cadence-core/bin/release-bump.mjs` the line number of the FIRST
  `atomicWrite` call is greater than the line number of every `readManifest(`
  and every changelog read in `bump()` - the whole write set is read and decided
  before the first write, structurally and not by convention.
- A write that fails anyway reports which files landed rather than
  `{"ok":false,"reason":"internal"}` carrying no `manifest`, `siblings` or
  `changelog` field at all, which is what the measured unwritable-CHANGELOG run
  produced.
- `cadence-core/workflows/milestone.md`'s halt prose states the reasons the seam
  now emits and what a `siblings[]` refusal now means, its
  `cadence-core/bin/weight-budgets.json` entry is re-pinned in the same commit,
  and `node cadence-core/bin/self-verify.mjs --root .` returns `ok:true` with
  `problems: []`.

## Context

Locked: D-06 (the whole write set - primary manifest, sibling, CHANGELOG - is
read and DECIDED into a plan before the first write, then run as one transition
through phase 1's `runTransition`; `emit()` and every reason string stay in
`release-bump.mjs`, phase 1's D-02), D-07 (an UNREADABLE sibling becomes a
top-level `ok:false` refusal with nothing written, while a sibling that parses
but is not upgradeable keeps its `ok:true` `siblings[]` row - collapsing both
into a refusal deletes the arm AC5 protects, leaving both as rows leaves AC4
unmet), D-08 (the sibling's unreadable case gets its OWN machine `reason` code,
because this seam's header already promises "a machine code on EVERY path" and
`milestone.md`'s halt list enumerates codes by name), D-09 ("validated" for the
CHANGELOG means present, readable and a regular file - NOT a content grammar
check, because `prependChangelogEntry` and `promoteUnreleased` in
`cadence-core/bin/lib/release-decision.mjs` are pure and never throw), D-10 (the
sibling set stays the one hardcoded `.claude-plugin/marketplace.json` path, at
most a declared one-entry `const` array - never a discovery scan), D-11 (the
prose moves with the code: `milestone.md`'s halt list AND its "Top-level `ok`
stays true" sentence, `weight-budgets.json` re-pinned and the two DOCS-CLAIMS
rows refreshed in the same commit), D-12 (nothing in
`cadence-core/bin/lib/file-transition.mjs` is edited), D-13 (no new subcommand,
no `CONTRACTS` row, no arg-contract row, no `HELPERS` census row).
Existing facts to build on: `readManifest` in `cadence-core/bin/release-bump.mjs`
is already the three-state absent/unreadable/ok reader with its reasoning in
place; `bump()` today writes the primary, THEN reads the sibling, THEN reads the
changelog; the seam already imports `atomicWrite` from `./lib/planning-files.mjs`
so the `./lib/` import path is proven and `runTransition` comes from
`./lib/file-transition.mjs` the same way.
Out of scope: `cmdPhaseDone` (plan 1); any journal, resume path or rollback; a
discovery scan for siblings; changing what `decideManifestBump` returns or
editing `cadence-core/bin/lib/release-decision.mjs` at all; the
`no-plugin-manifest` skip arm and the `--date` / `--dir` / `--version`
argument contract.

## Tasks

### Task 1: read and decide the whole write set, then run the writes as one transition

- **Files:** cadence-core/bin/release-bump.mjs (`bump`)
- **Action:** Restructure `bump()` into two halves with no interleaving: a READ
  AND DECIDE half that touches nothing on disk, then a WRITE half that is one
  `runTransition` call under the `'stop-at-first-failure'` discipline. Today the
  primary `atomicWrite` sits above the sibling's `readManifest` and the
  changelog's read, which is the defect JRN-03 names - measured 2026-08-22, an
  unwritable `CHANGELOG.md` emitted
  `{"ok":false,"reason":"internal","detail":"EISDIR: ... rename
  'CHANGELOG.md.<pid>.1.tmp' -> 'CHANGELOG.md'"}` while `plugin.json` on disk
  already read the new version. Move the sibling read and verdict, and the
  changelog read plus the `prependChangelogEntry` / `promoteUnreleased` pass,
  ABOVE the first write; all three transforms are pure and return `{text,
  changed}`, so computing them early changes no result. Promote the single
  hardcoded sibling path to a declared one-entry `const` array of relative
  sibling paths and iterate it, so a second sibling later is a data change and
  the seam still never scans for files nobody declared (D-10). Then build the
  step list in today's write order - primary manifest, then each sibling whose
  verdict is `bump`, then the changelog when it changed - each step keyed by the
  repo-relative file path (`.claude-plugin/plugin.json`,
  `.claude-plugin/marketplace.json`, `CHANGELOG.md`), each thunk performing
  exactly the `atomicWrite` it performs today with the same serialized bytes
  (`JSON.stringify(manifest, null, 2) + '\n'`, field order preserved). Every
  gate that decides whether a write happens at all stays exactly where it is in
  meaning: the primary writes only on a `bump` verdict, a sibling writes only on
  a `bump` verdict, the changelog is still gated on `existsSync`, a truthy
  target, a primary verdict of `bump` or `noop` (NEVER `skip` - a manifest with
  no `version` field bumped nothing, and dating a heading for that release would
  have the changelog claim a release that never happened) and on the composed
  transform having changed something, and it is still written ONCE because two
  `atomicWrite`s would expose an intermediate state on disk. The success
  `emit()` and every field in it - `action`, `target`, `reason`, `detail`,
  `manifest`, `siblings`, `changelog` including `promoted` and `section_empty` -
  are unchanged in this task, and so is every refusal already in the function.
  Add the `runTransition` import from `./lib/file-transition.mjs`; do not
  copy any part of that module's body, which
  `cadence-core/bin/helper-census.test.mjs` pins as a single definition.
- **Verify:** `node --test cadence-core/bin/release-bump.test.mjs` exits 0
  reporting 33 tests and 0 failures with `git status --porcelain --
  cadence-core/bin/release-bump.test.mjs` printing nothing (this task edits no
  test). The ordering is proven mechanically rather than by reading: the line
  number printed by `grep -n "atomicWrite(" cadence-core/bin/release-bump.mjs |
  head -1` is GREATER than every line number printed by `grep -n "readManifest("
  cadence-core/bin/release-bump.mjs` and than the line of the changelog's own
  read. `grep -c "runTransition" cadence-core/bin/release-bump.mjs` prints at
  least 2 (the import and the call). `./node_modules/.bin/tsc -p
  tsconfig.ci.json` exits 0.

### Task 2: an unreadable sibling refuses the whole run, under its own code

- **Files:** cadence-core/bin/release-bump.mjs (`bump` plus the header's SEAM-level code list), cadence-core/bin/release-bump.test.mjs
- **Action:** Turn the sibling `state === 'unreadable'` arm from a recorded
  `siblings[]` row into a top-level `ok:false` refusal emitted before the
  transition runs, so nothing is written (D-07). This is the half of D-08 that
  splits rather than dies: the arm that keeps its `ok:true` `siblings[]` row is
  the sibling that PARSES and whose `decideManifestBump` verdict is `refuse` -
  `downgrade`, `not-an-upgrade`, `unparseable-version` - and that arm must not
  change at all, because collapsing the two deletes a distinction
  `milestone.md`'s close already acts on. The refusal carries this seam's
  standard refusal envelope: `ok:false`, `action:"refuse"`, exit 1 via `emit`'s
  mirror, `manifest` with `bumped:false` (nothing landed, whatever the primary
  verdict was), `siblings: []`, `changelog: {changed:false}`, and a `detail`
  naming the sibling path and the repair. Give it its OWN machine `reason` code,
  `unreadable-sibling-manifest` - this plan's choice, distinct from the primary's
  `unreadable-manifest` by D-08, because `milestone.md`'s halt list enumerates
  codes by name and one token for two files leaves the operator opening both.
  Update the SEAM-level code list in this file's own header in the same edit:
  the header states "Two code vocabularies, one owner each" and lists the codes
  owned here, so a new one that is not listed there breaks the file's own stated
  contract. Do NOT touch the parallel list in
  `cadence-core/bin/lib/release-decision.mjs`'s JSDoc; that file is out of scope
  for this phase and its cross-reference is already incomplete for other reasons.
- **Verify:** one new case in `cadence-core/bin/release-bump.test.mjs`, added
  without editing any existing case: build a `fixture()`, overwrite
  `.claude-plugin/marketplace.json` with a mangled body (a trailing comma, the
  shape a hand-edited half-write leaves - the same idiom the existing case
  `bump: a present-but-unparseable plugin.json refuses` already uses for the
  primary), capture `plugin.json` and `CHANGELOG.md` before the run, then drive
  `seamStatus(['bump','--dir',dir,'--version','2.0.0','--date','2026-07-17'])`
  and assert `json.ok` is `false`, `json.action` is `'refuse'`, `json.reason` is
  `'unreadable-sibling-manifest'`, `status` is `1`, `plugin.json` reads back
  byte-identical to before (its `version` still the OLD `1.0.0`), and
  `CHANGELOG.md` reads back byte-identical to before. `node --test
  cadence-core/bin/release-bump.test.mjs` exits 0 at 34 tests, 0 failures, with
  `bump: a SIBLING that would downgrade is recorded as a refusal, not silently
  written (D-08)` passing BY NAME and `git diff -U0 --
  cadence-core/bin/release-bump.test.mjs | grep -c '^-[^-]'` printing `0`.
  `./node_modules/.bin/tsc -p tsconfig.ci.json` exits 0.

### Task 3: the CHANGELOG joins the validated write set

- **Files:** cadence-core/bin/release-bump.mjs (`bump` plus the header's SEAM-level code list), cadence-core/bin/release-bump.test.mjs
- **Action:** Validate `CHANGELOG.md` before the first write, to exactly the bar
  D-09 sets: present, readable, and a regular file - no content grammar check,
  because the transform pass over it is pure and cannot fail. Today the only
  gate is `existsSync`, and the text comes from `readText`, whose
  `''`-on-failure contract (stated at `cadence-core/bin/lib/seam-input.mjs`)
  means an unreadable changelog is scaffolded over as if it were empty, wiping a
  real release history. Replace that read inside `bump()` with a local
  three-state read - absent, unreadable, read - mirroring the `readManifest`
  shape already in this file. ABSENT keeps today's behaviour exactly: no
  changelog step, `changelog: {changed:false}`, `ok:true`. UNREADABLE becomes a
  top-level refusal in this seam's standard envelope with nothing written and
  its own machine code, `unreadable-changelog` - this plan's choice, required by
  the file's own header rule that `reason` carries a machine code on EVERY path,
  and distinct for the same operator reason D-08 gives for the sibling. Do NOT
  edit `cadence-core/bin/lib/seam-input.mjs`: `readText`'s `''` contract has
  other callers that depend on it and `cadence-core/bin/helper-census.test.mjs`
  pins its body as a single definition, so this is a caller-side read, not a
  change to the shared one - and do not paste that body here.
- **Verify:** one new case in `cadence-core/bin/release-bump.test.mjs`: a
  `fixture()` whose `CHANGELOG.md` is replaced by a DIRECTORY (`rmSync` then
  `mkdirSync` - filesystem-shaped and uid-independent, no `chmodSync`, which is
  a silent no-op under a root test runner, D-02), driven through `seamStatus`
  with a valid `--version`; assert `json.ok` is `false`, `json.action` is
  `'refuse'`, `json.reason` is `'unreadable-changelog'`, `status` is `1`, and
  `.claude-plugin/plugin.json` reads back byte-identical to before with its OLD
  version. `node --test cadence-core/bin/release-bump.test.mjs` exits 0 at 35
  tests, 0 failures, with the existing cases `bump: rewrites only version,
  preserves every other field, scaffolds changelog`, `bump: a second run is a
  noop, plugin.json and CHANGELOG byte-identical (no double-bump)` and `bump: one
  run puts the staged Unreleased body INSIDE the dated section` all passing by
  name. `git diff -U0 -- cadence-core/bin/release-bump.test.mjs | grep -c
  '^-[^-]'` prints `0`. `./node_modules/.bin/tsc -p tsconfig.ci.json` exits 0.

### Task 4: a write that fails anyway names what landed

- **Files:** cadence-core/bin/release-bump.mjs (`bump` plus the header's refusal-envelope paragraph)
- **Action:** Render the transition's FAILURE result into an envelope of this
  seam's own rather than letting the throw fall through to the dispatch's
  `catch`, which emits `{"ok":false,"reason":"internal"}` with no `manifest`, no
  `siblings` and no `changelog` field at all - the measured shape D-06 names, and
  the one that leaves an operator unable to tell a bumped tree from an untouched
  one. Emit `ok:false` with `action:"partial"` - the vocabulary
  `cmdMilestonePrune` already uses for exactly this state - and the machine
  reason `partial-bump`, this plan's choice in the family `partial-apply` and
  `partial-prune` already form. Fill `manifest`, `siblings` and `changelog` from
  what the transition actually COMPLETED rather than from what was decided:
  `manifest.bumped` is true only if the primary's step key is in the completed
  list, a sibling row's `bumped` only if that sibling's key is,
  `changelog.changed` only if the changelog's key is. Carry the thrown error's
  message in `detail`. Update this file's header in the same edit: the
  "Refusal envelope (D-01, one shape for every cause)" paragraph currently says
  every refusal is `action:"refuse"`, and this arm adds a second `ok:false`
  shape - the header must admit it, and must keep the sentence that no `ok:true`
  refusal shape exists anywhere in this seam, which stays true.
- **Verify:** the arm is proven live with a throwaway copy, never a committed
  test, because tasks 2 and 3 convert every uid-independent forcing shape (a
  directory or an unparseable file at any member of the write set) into a
  pre-write refusal, and D-02 forbids `chmodSync`. Run `cp
  cadence-core/bin/release-bump.mjs cadence-core/bin/release-bump-probe.mjs`,
  edit ONLY the copy so the CHANGELOG step's thunk throws (its `./lib/...`
  imports resolve unchanged from the same directory), drive it against a fixture
  tree with `bump --dir <fixture> --version 2.0.0 --date 2026-07-17`, and
  observe one JSON line reading `ok:false`, `action` `"partial"`, `reason`
  `partial-bump`, `manifest.bumped` true, `changelog.changed` false and a
  `detail` carrying the thrown message, at exit 1. Then `rm -f
  cadence-core/bin/release-bump-probe.mjs` and confirm `git status --porcelain`
  lists only `cadence-core/bin/release-bump.mjs`; the probe is never staged and
  must be gone before the commit, since a second copy of a censused helper body
  under `cadence-core/bin/` reddens `node --test
  cadence-core/bin/helper-census.test.mjs` while it exists. `node --test
  cadence-core/bin/release-bump.test.mjs` exits 0 at 35 tests, 0 failures.
  `./node_modules/.bin/tsc -p tsconfig.ci.json` exits 0.

### Task 5: the halt prose, the budget and the ledger move with the behaviour

- **Files:** cadence-core/workflows/milestone.md (the halts list under `## 2. Version bump`), cadence-core/bin/weight-budgets.json, .planning/DOCS-CLAIMS.md (rows MILESTONE-06 and MILESTONE-07)
- **Action:** Bring `milestone.md`'s three-halts list into agreement with what
  the seam now emits, in the same commit as the last behaviour change (D-11).
  Three edits there. First, the `ok:false` bullet's reason list, which today
  reads
  `no-target-version`, `unparseable-version`, `unreadable-manifest`,
  `downgrade`, `not-an-upgrade` or `bad-date`, gains the two codes tasks 2 and 3
  added and keeps its "The seam wrote NOTHING" sentence, which is now more true
  than it was rather than less - but that sentence must be SCOPED to
  `action:"refuse"` in the same edit, because task 4 adds a second `ok:false`
  shape where the seam DID write, and a reader who takes `ok:false` alone as
  "nothing landed" is given a false state guarantee by exactly the bullet that
  is supposed to stop the close. So the list becomes the refusal codes under
  `action:"refuse"`, and a FOURTH halt bullet carries task 4's partial: `ok:false`
  with `action:"partial"` and `reason:"partial-bump"` means the transition
  failed PART WAY and `manifest.bumped`, each `siblings[]` row's `bumped` and
  `changelog.changed` name what actually landed - the operator reads those three
  fields to see what is on disk, repairs the tree, and STOPS; it is the one halt
  where re-running the bump is not a clean retry. Put it directly below the
  `ok:false` refusal bullet, so the two `ok:false` shapes read together, and
  change the list's own header from "Three halts" to "Four halts" in the same
  edit. Second, the `siblings[]` bullet, which today
  says top-level `ok` stays true "(the primary manifest already wrote)": the
  parenthetical's ORDERING claim is no longer how the seam works - nothing is
  written until the whole set is decided - and the bullet must now say what a
  `siblings[]` refusal actually means, which is a sibling that was READABLE and
  simply not upgradeable, the unreadable one having become an `ok:false` halt in
  the bullet above. Keep the operator instruction in both bullets unchanged in
  force: name the file and STOP. Say what changed and nothing more - the three
  halts that already exist, their order and the `changelog.section_empty` bullet
  stay as they are, and the partial bullet is added beneath the refusal one
  rather than displacing any of them. Then re-pin `cadence-core/bin/weight-budgets.json`'s
  `cadence-core/workflows/milestone.md` entry to the file's new byte count in
  this same commit: the entry is a CEILING (`self-verify` reports
  `budget-overrun` only when measured bytes EXCEED it) and milestone.md sits at
  exactly 14222 today, so any growth reddens check 4 until the entry moves.
  Finally refresh the two ledger rows in `.planning/DOCS-CLAIMS.md`: MILESTONE-06
  restates the `ok:false` reason list and MILESTONE-07 restates what a
  `siblings[]` refusal means, and BOTH rows' line-number column is corrected to
  where those bullets actually sit after this edit (they currently read 52-54 and
  57-59 against bullets that live near line 66 and 72 - the drift predates this
  phase and a row re-stated at a stale anchor is a row nobody can check). Leave
  every other row in that file alone.
- **Verify:** `node cadence-core/bin/self-verify.mjs --root .` prints `ok:true`
  with an empty `problems` array - the check that would redden on a missed
  re-pin is `budgets`, and it is in the `checked` list. `wc -c
  cadence-core/workflows/milestone.md` prints exactly the number now stored at
  the `cadence-core/workflows/milestone.md` key in
  `cadence-core/bin/weight-budgets.json`. Each of `unreadable-sibling-manifest`,
  `unreadable-changelog` and `partial-bump` appears in
  `cadence-core/workflows/milestone.md`
  (`grep -c` prints at least 1 for each) and each of the first two appears in the
  MILESTONE-06 row of
  `.planning/DOCS-CLAIMS.md`. `grep -n "the primary manifest already wrote"
  cadence-core/workflows/milestone.md` prints nothing, and `grep -c "Four halts"
  cadence-core/workflows/milestone.md` prints `1` while `grep -c "Three halts"`
  on the same file prints `0` - the count in the header moved with the bullet
  rather than being left to be read as prose. `node --test
  'cadence-core/bin/*.test.mjs'` exits 0 and `./node_modules/.bin/tsc -p
  tsconfig.ci.json` exits 0.

## Notes

- Two plans this phase, matching the CONTEXT `Plan shape` directive, and the
  independence test agrees: this plan's five declared files do not intersect
  plan 1's two, the suites are separate (`release-bump.test.mjs` against
  `planning.test.mjs`), and neither plan's tasks depend on the other's. AC7
  (`self-verify` `ok:true`) is the whole-phase gate; the only self-verify-visible
  change in either plan is milestone.md's byte count, re-pinned inside the same
  task that grows it, so no commit in either plan leaves the check red.
- Three names here are the planner's choice inside decisions that fixed only the
  shape, which is why each is pinned by a Verify: the sibling code
  `unreadable-sibling-manifest` (D-08 fixed only that it must be its own code),
  the changelog code `unreadable-changelog` (D-09 fixed the validation bar, not
  the token) and the partial reason `partial-bump`. An executor that picks
  different spellings owes a deviation note, not a re-plan, provided the new
  test cases, the seam header's code list, milestone.md's halt list and the
  MILESTONE-06 ledger row all move with them - the last three are the ones a
  rename most easily leaves behind.
- `cadence-core/bin/lib/release-decision.mjs`'s JSDoc names the seam's disjoint
  code set as `(no-plugin-manifest, unreadable-manifest, usage, internal)` and
  is ALREADY missing `bad-date` and `missing-flag-value`, which shipped in
  earlier cycles. This plan deliberately does not touch it: the file is outside
  the phase's scope, the staleness predates this work, and the owner of the seam
  code list is `release-bump.mjs`'s own header, which tasks 2 and 3 do update.
  Recorded here and in the return marker so it is a known carried item rather
  than something this phase introduced.
- Task 4's partial arm ships implemented and probe-proven but with no committed
  regression test, and that is the deliberate consequence of D-06 plus D-02
  rather than a gap: the pre-write validation converts every forcible shape into
  a refusal, and the residual failures (EACCES on the repo root, a symlink
  planted at `atomicWrite`'s `${file}.${pid}.${seq}.tmp` path, ENOSPC) cannot be
  produced from a fixture without `chmodSync`, which D-02 refuses. A verifier
  seeing no test named for `partial-bump` should read this note, not file a
  coverage gap.
- Baselines measured on this branch at planning time, so a Verify figure that
  moves is a signal rather than a surprise: `release-bump.test.mjs` 33 tests / 33
  pass, `cadence-core/workflows/milestone.md` 14222 bytes against a
  `weight-budgets.json` entry of exactly 14222, `self-verify.mjs --root .`
  `ok:true` with `problems: []`, and `./node_modules/.bin/tsc -p
  tsconfig.ci.json` exit 0. `tsc` resolves from this repo's `node_modules/.bin`
  even though the repo carries no `package.json`; if it is absent in the
  execution environment, CI's typecheck step is the same check and the local run
  may be reported as unavailable rather than passed.
- Recalled prior art, weighed and acted on: `v3.5.5` phase 4's SUMMARY records
  that `cadence-core/bin/release-bump.test.mjs:424-428` still names a retired
  `optionalFlag` in a comment, left because the file sat outside that plan's
  lease. It IS inside this plan's lease, and it is deliberately still not this
  plan's work - the comment describes the `--date` argument seam, which nothing
  here touches, and sweeping it would be scope this phase did not buy. Named so
  an executor reading that comment while adding cases beneath it does not treat
  it as drift introduced here.
