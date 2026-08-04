---
phase: 3
plan: 1
requirements:
  - REL-03
files:
  - cadence-core/bin/lib/release-decision.mjs
  - cadence-core/bin/release-bump.mjs
  - cadence-core/bin/release-decision.test.mjs
  - cadence-core/bin/release-bump.test.mjs
  - cadence-core/bin/lib/branch-decision.mjs
  - cadence-core/workflows/milestone.md
  - cadence-core/bin/weight-budgets.json
  - CHANGELOG.md
  - .planning/CAPTURE.md
---

# Phase 3: The release seam cannot lie about the release - Plan

## Goal

The release seam can currently ship the wrong number or empty notes with nothing
said. `decideManifestBump` treats any `from !== to` as a bump, so a downgrade
passes; a dated `## [<version>]` heading can land over an empty section while the
real content sits under `## [Unreleased]`; and the derivation depends on planning
prose no path keeps current between cycles. All three close: a refusal a caller
cannot read as success, a promotion that moves the staged content into the
section that ships, and a number that comes from the human who confirmed it.

## Must be true when done

- A release run that would move the manifest backwards stops: `release-bump.mjs
  bump` with a target below the manifest's current version prints one JSON line
  with `ok:false` and reason `downgrade`, exits 1, and leaves
  `.claude-plugin/plugin.json` and `CHANGELOG.md` byte-identical. `1.1.0-rc.2 ->
  1.1.0` is still accepted as a bump, and `1.1.0 -> 1.1.0-rc.2` is refused.
- A version neither side can parse (`latest`, `1.0`, `01.2.3`) refuses by name
  instead of taking the old any-difference bump path, and writes nothing.
- The shipping number comes only from the `--version` the user confirmed: a
  `bump` run without it refuses even while `.planning/PROJECT.md`'s `### Active`
  names a version, and no path in the seam reads `PROJECT.md` or `ROADMAP.md`
  any more.
- Content staged under `## [Unreleased]` ends up INSIDE the dated `## [<version>]
  - <date>` section after one run, with `## [Unreleased]` surviving as an empty
  stub above it and nothing stranded between the two.
- Re-running is safe in both directions: a re-run whose Unreleased body gained
  new content promotes that too, and a re-run with an empty Unreleased body
  leaves both files byte-identical.
- Every primary refusal the seam can emit (`no-target-version`,
  `unparseable-version`, `unreadable-manifest`, `downgrade`, `not-an-upgrade`)
  shares one envelope - `ok:false`, exit 1, a named reason, nothing written -
  and `cadence-core/workflows/milestone.md` documents it as a halt that stops
  the close before the tag. The one deliberate exception is a SIBLING refusal
  (D-08): top-level `ok` stays true because the primary write already landed,
  so the milestone arm ALSO checks `siblings[]` for `action:'refuse'` and
  halts the close on it - the exception is visible at the call site, never a
  silent success.
- A run that leaves the target's dated section empty - nothing promoted,
  nothing already there - says so in its envelope
  (`changelog.section_empty: true`), and `milestone.md` treats that as
  "author the section before the bump commit", so no close ships a dated
  heading over an empty section with nothing said.
- `node --test cadence-core/bin/*.test.mjs` and `npx tsc -p tsconfig.ci.json`
  both exit 0, and `node cadence-core/bin/self-verify.mjs` reports `ok:true`
  with no budget overrun, with `weight-budgets.json` regenerated in the same
  commit as the `milestone.md` edit.

## Context

CONTEXT.md's D-01 through D-16 are locked; each is either implemented by a
task below or (D-12, D-13) is an explicit exclusion the tasks must not violate. D-01/D-05
set the shape of the whole phase: refusals are verdicts in the pure lib and one
`ok:false`/exit-1 envelope in the seam, following `git-publish.mjs:108,139`.
D-09 keeps the split INTERNALS.md:61 states - the pure `lib/release-decision.mjs`
decides and rewrites text, the seam only reads, calls, writes, emits. D-10 is a
hard guardrail for every task: never run this seam against the repo root, because
the live TOK-02 cost statement must stay under `## [Unreleased]` for
`/cad-milestone` to promote at the close. Baseline at plan time: 1027/1027 tests
pass, `tsc` exits 0, `self-verify` is `ok:true`, `milestone.md` is exactly
7181/7181 bytes. Out of scope: branch naming's prose derivation (D-11), any
`release.*` config key (D-12), a manifest-vs-changelog self-verify check (D-13),
tag policy, and hand-promoting the live CHANGELOG.

## Tasks

### Task 1: one refusal envelope, `ok:false` and exit 1, end to end

- **Files:** cadence-core/bin/lib/release-decision.mjs,
  cadence-core/bin/release-bump.mjs, cadence-core/bin/release-decision.test.mjs,
  cadence-core/bin/release-bump.test.mjs
- **Action:** D-01, D-05. This is the spine every later task hangs a new refusal
  cause on, so it lands first and alone. In the lib, give `decideManifestBump`'s
  verdict a `code` field - a stable machine token the seam emits as its `reason`,
  while the existing human `reason` prose becomes the seam's `detail`. The codes
  are a closed set, stated in the JSDoc: `no-target-version`, `no-version-field`,
  `already-at-target`, `bump`, plus `unparseable-version`, `downgrade` and
  `not-an-upgrade` arriving in task 3. Rename the no-target verdict's action from
  `'error'` to `'refuse'`: `refuse` is the vocabulary `lib/publish-decision.mjs`
  already uses for exactly this, and one word for one concept keeps the seam's
  mapping a single arm instead of a list that grows with every cause. Update the
  `@returns` typedef to
  `{action:'bump'|'noop'|'skip'|'refuse', code:string, bumped:boolean, from:string|null, to:string|null, reason:string}`
  - `tsconfig.ci.json` runs `checkJs`, so a stale typedef is a build failure, not
  a comment. In `release-bump.mjs`, replace the special-cased
  `primary.action === 'error'` block (lines 91-96) with one arm on
  `primary.action === 'refuse'` that emits `ok:false`, `action:'refuse'`,
  `reason: primary.code`, `detail: primary.reason`, `target`,
  `manifest:{from,to,bumped:false}`, `siblings:[]`, `changelog:{changed:false}`
  and RETURNS before any write. Add no `process.exit` call: `emit`
  (`lib/seam-io.mjs:25-28`) already mirrors `ok:false` into exit code 1, and the
  convention exists because `process.exit` can truncate stdout mid-write on a
  pipe. Leave no `ok:true` refusal shape anywhere in this seam - a scripted
  caller reading `ok` must never be able to read a refusal as success. The
  `reason` key must carry a machine code on EVERY path, not just refusals:
  change the final `emit` in `bump()` (currently `reason: primary.reason`) to
  `reason: primary.code, detail: primary.reason`, so a caller branching on
  `reason` never gets a token when `ok:false` but a sentence when `ok:true`
  from the same seam. Two homes for the code vocabulary, stated in each: the
  lib JSDoc's closed set holds the verdict codes (`no-target-version`,
  `no-version-field`, `already-at-target`, `bump`, plus task 3's three), and
  the seam header holds the seam-level codes it alone emits
  (`no-plugin-manifest`, `unreadable-manifest`, `usage`, `internal`) - one
  list, one owner each, so the documented set can never disagree with itself.
  Split `readManifest`'s null while here: an ABSENT file keeps the existing
  skip `no-plugin-manifest`, unchanged; a present-but-unparseable JSON
  (trailing comma, truncated half-write) refuses `unreadable-manifest`
  through the new envelope - a mangled manifest read as "non-plugin project,
  nothing to bump" is the seam lying about the release, exit 0 included. Add
  a seam test with a trailing-comma `plugin.json` fixture asserting
  `ok:false`, `reason:'unreadable-manifest'`, exit 1, file byte-unchanged. Rewrite `release-bump.mjs`'s header block (lines
  22-26) to state the refusal envelope this task lands - `ok:false`,
  `action:'refuse'`, a named `reason` code, exit 1, nothing written - instead
  of the `action:"error"` shape it currently documents. Update the
  two tests that pin the old shape: `release-decision.test.mjs`'s "no target
  version -> error" (now `action:'refuse'`, `code:'no-target-version'`, reason
  prose unchanged) and `release-bump.test.mjs`'s "no derivable version -> error"
  (now `ok:false`, `reason:'no-target-version'`, both files still byte-unchanged).
  Add a `seamStatus(args)` helper beside the existing `seam()` in
  `release-bump.test.mjs`: run `spawnSync('node', [SEAM, ...args], {encoding:'utf8', env})`
  and return `{json: JSON.parse(r.stdout), status: r.status}`, because the
  existing helper catches the throw and parses `e.stdout`, discarding the exit
  status the envelope's whole contract rests on. Assert `status === 1` on the
  refusal.
- **Verify:** `node --test cadence-core/bin/release-decision.test.mjs
  cadence-core/bin/release-bump.test.mjs` passes; in a scratch directory holding
  only `.claude-plugin/plugin.json`, `node cadence-core/bin/release-bump.mjs bump
  --dir <that dir>` prints a line with `"ok":false` and
  `"reason":"no-target-version"` and `echo $?` prints `1`; `npx tsc -p
  tsconfig.ci.json` exits 0.

### Task 2: the shipping number is the explicit `--version`, not prose

- **Files:** cadence-core/bin/lib/release-decision.mjs,
  cadence-core/bin/release-bump.mjs, cadence-core/bin/lib/branch-decision.mjs,
  cadence-core/bin/release-decision.test.mjs,
  cadence-core/bin/release-bump.test.mjs
- **Action:** D-03, AC5. Delete `deriveTargetVersion`'s two prose arms and the
  `import { activeVersion, titleVersion } from './branch-decision.mjs'`, and
  rename the function `normalizeTargetVersion(argVersion)` - one positional
  argument, total: a non-string, empty or whitespace-only value returns null,
  otherwise trim and strip ONE leading `v` so the manifest keeps bare semver.
  The rename is load-bearing, not cosmetic: a function still called `derive*`
  while it derives nothing is the same false self-description REL-03 exists to
  remove. In `release-bump.mjs`, `bump()` stops reading `.planning/PROJECT.md`
  and `.planning/ROADMAP.md` entirely - delete both `join(dir, '.planning', ...)`
  reads and pass `versionArg` straight to `normalizeTargetVersion`; keep
  `readText`, still used for `CHANGELOG.md`. Correct the file header's usage
  block: `--version` is no longer "override the derived target", it is the
  REQUIRED shipping number and its absence refuses. In `branch-decision.mjs`,
  lines 12-15 justify exporting `activeVersion` and `titleVersion` solely by the
  release derivation reusing them; that consumer is now gone and nothing else in
  the tree imports either name, so drop the `export` keyword from both (they stay
  module-private inputs to `integrationBranchName`) and rewrite that header
  paragraph to name `integrationBranchName` and `decideBranch` as the module's
  whole public surface. Change NOTHING else there: D-11 keeps the branch model's
  `### Active` -> ROADMAP-title derivation exactly as it is, and
  `git-branch.mjs`, `land-cleanup.mjs` and `references/git.md:56,64` stay
  correct. Tests: DELETE `release-decision.test.mjs`'s "derive: precedence
  argVersion > ### Active > ROADMAP title" - the precedence it pins no longer
  exists, and a test kept alive against removed behaviour is how the prose arm
  comes back; re-point the v-strip and null-return tests at
  `normalizeTargetVersion`. Rename `release-bump.test.mjs:156`'s test title
  `'bump: --version overrides the derived target and strips a leading v'` -
  it still passes but describes an override of a derivation that no longer
  exists; retitle it to name `--version` as the required shipping number.
  In `release-bump.test.mjs` keep the fixture writing a
  `### Active` version (it is the evidence, not scaffolding) and add a test that
  `bump` with NO `--version` returns `ok:false`, `reason:'no-target-version'` and
  exit 1 through `seamStatus` while `.planning/PROJECT.md` names `v1.1.0-rc.2`,
  with `plugin.json` and `CHANGELOG.md` byte-unchanged; this is the test that
  fails against HEAD, where the prose arm supplies a target. Repair rather than
  delete the two tests that relied on that arm ("bump: rewrites only version..."
  and "bump: a second run is a noop...") by passing `--version 1.1.0-rc.2`
  explicitly. Record in this phase's SUMMARY, as SC3/AC5 require: the replacement
  derivation is the explicit `--version` the milestone workflow already confirms
  with the user at step 2, and the failure it removes is a shipping number read
  from `PROJECT.md ### Active` prose no path keeps current between cycles - this
  repo's own `### Active` still described phase 2's reversed premise weeks after
  the reversal, and `cadence-core/templates/PROJECT.md` carries no version token
  at all, so a fresh project could never satisfy that arm.
- **Verify:** `node --test cadence-core/bin/release-decision.test.mjs
  cadence-core/bin/release-bump.test.mjs cadence-core/bin/branch-decision.test.mjs
  cadence-core/bin/git-branch.test.mjs cadence-core/bin/land-cleanup.test.mjs`
  passes; `grep -n "activeVersion\|titleVersion\|PROJECT\.md\|ROADMAP\|### Active\|action: *'error'\|action:\"error\""
  cadence-core/bin/lib/release-decision.mjs cadence-core/bin/release-bump.mjs`
  returns nothing (the bare `ROADMAP` term matters: `release-bump.mjs:82`'s
  inline comment says `ROADMAP.` without the `md`, and a `ROADMAP.md` pattern
  misses it); `grep -n "^export function"
  cadence-core/bin/lib/branch-decision.mjs` lists only `integrationBranchName`
  and `decideBranch`; `npx tsc -p tsconfig.ci.json` exits 0; `node
  cadence-core/bin/self-verify.mjs` reports `ok:true`.

### Task 3: a target that is not a strict upgrade refuses

- **Files:** cadence-core/bin/lib/release-decision.mjs,
  cadence-core/bin/release-decision.test.mjs, cadence-core/bin/release-bump.mjs,
  cadence-core/bin/release-bump.test.mjs
- **Action:** D-02, D-05, D-06, D-07, D-08, AC1, AC2. Write the tests FIRST, run
  them once against the unmodified lib, and paste the observed failure lines into
  the SUMMARY - AC1 requires a refusal proven to fail against HEAD, and a test
  written after the fix proves only that the fix is self-consistent. Add one
  exported total function `compareVersions(a, b)` returning `-1 | 0 | 1`, or
  `null` when either side is unparseable; keep its parser module-private so the
  grammar has exactly one home. The grammar is anchored full semver: `MAJOR`,
  `MINOR` and `PATCH` each `0` or a non-zero-leading digit run, an optional `-`
  prerelease of dot-separated identifiers (each either numeric without leading
  zeros, or alphanumeric-with-hyphen), and an optional `+` build-metadata run of
  dot-separated alphanumeric-hyphen identifiers. Anything else is unparseable, so
  `1.0`, `latest`, `01.2.3` and `''` all yield null. Do NOT accept a leading `v`
  here - `normalizeTargetVersion` strips it upstream, and accepting it in two
  places is how the two drift. Precedence follows semver §11 exactly: major,
  minor, patch numerically; a version WITH a prerelease sorts below the same
  version without one; then prerelease identifiers left to right, numeric
  compared numerically - implement every numeric compare (MAJOR/MINOR/PATCH
  and numeric prerelease identifiers alike) as digit-run length first, then
  lexicographic, which equals numeric order for canonical no-leading-zero
  identifiers at ANY magnitude and cannot collapse above
  `Number.MAX_SAFE_INTEGER` the way a parse-to-Number compare does -
  alphanumeric compared by ASCII order, numeric ranked
  below alphanumeric, and when all shared identifiers tie the longer identifier
  list wins; build metadata is ignored entirely. A simplified triple-plus-rc rule
  is explicitly rejected (D-02) because it is wrong for every prerelease shape
  beyond `-rc.N`. Then restate `decideManifestBump`'s arms as a first-match-wins
  list in its JSDoc and implement them in that order: (1) missing/blank target ->
  refuse `no-target-version`; (2) target unparseable -> refuse
  `unparseable-version`, reason naming the side and the offending value; (3)
  `currentVersion` null/undefined -> skip `no-version-field`; (4) current
  unparseable -> refuse `unparseable-version`; (5) `from === to` -> noop
  `already-at-target`; (6) `compareVersions(to, from) < 0` -> refuse `downgrade`,
  reason naming both; (7) `=== 0` with differing strings, i.e. a
  build-metadata-only difference -> refuse `not-an-upgrade`; (8) otherwise bump.
  Target checks precede manifest checks because the target is the same for every
  manifest in one run, so a bad number can never write one file and refuse the
  next. Add NO `--allow-downgrade` flag and no config key (D-07): an escape hatch
  no caller passes is the dead reach phase 2 just deleted, and a new flag would
  also need a `self-verify.mjs` CONTRACTS row. Siblings (D-08): the sibling loop
  already calls the same function so it inherits the guard - record a refused
  sibling as `{file, action:'refuse', bumped:false, reason: d.code}` in
  `siblings[]` and do NOT abort, because the primary write has already happened
  and unwinding it would need a transaction this seam does not have; the run's
  top-level `ok` stays true. Task 5's milestone arm is what keeps that visible:
  it checks `siblings[]` for a refusal and halts the close, so D-08's
  record-without-abort never becomes a silent partial ship. `marketplace.json` carries no `version` field, so
  build this arm's coverage from a fixture that adds one. Lib tests, one `test()`
  per row rather than a loop over a table (the convention and its reason are at
  `retired-keys.test.mjs:4-6`): the canonical §11 chain `1.0.0-alpha <
  1.0.0-alpha.1 < 1.0.0-alpha.beta < 1.0.0-beta < 1.0.0-beta.2 < 1.0.0-beta.11 <
  1.0.0-rc.1 < 1.0.0` asserted pairwise with the pair named in each message;
  `2.0.0 > 1.9.9`; `1.0.0+a`, `1.0.0+b` and `1.0.0` all mutually equal; the four
  unparseable inputs; `2.0.0 -> 1.9.9` refuses `downgrade`; `1.1.0-rc.2 -> 1.1.0`
  still bumps; `1.1.0 -> 1.1.0-rc.2` refuses `downgrade`; either side unparseable
  refuses `unparseable-version`; `1.0.0 -> 1.0.0+build` refuses `not-an-upgrade`,
  which pins the build-metadata assumption CONTEXT flagged instead of leaving it
  assumed; and `9007199254740993.0.0 > 9007199254740992.0.0` (majors above
  2^53), pinning the length-then-lexicographic compare where Number
  arithmetic would call the two equal. Seam tests, through `seamStatus`, each asserting exit 1 and both files
  byte-identical to a pre-run read: a manifest at `2.0.0` with `--version 1.0.0`;
  `--version latest`; and a manifest whose version is `1.0` with a valid
  `--version`.
- **Verify:** `node --test cadence-core/bin/release-decision.test.mjs
  cadence-core/bin/release-bump.test.mjs` passes with the new rows present; in a
  scratch fixture whose `plugin.json` version is `2.0.0`, `node
  cadence-core/bin/release-bump.mjs bump --dir <fixture> --version 1.0.0` prints
  `"ok":false` with `"reason":"downgrade"`, `echo $?` prints `1`, and `git
  diff`-style byte comparison of `plugin.json` and `CHANGELOG.md` before and
  after shows no change; `npx tsc -p tsconfig.ci.json` exits 0.

### Task 4: staged `## [Unreleased]` content is promoted into the dated heading

- **Files:** cadence-core/bin/lib/release-decision.mjs,
  cadence-core/bin/release-decision.test.mjs, cadence-core/bin/release-bump.mjs,
  cadence-core/bin/release-bump.test.mjs
- **Action:** D-04, D-09, AC3, AC4. Add a second exported total function
  `promoteUnreleased(changelogText, version)` returning `{text, changed, reason}`.
  Do NOT fold it into `prependChangelogEntry` and do NOT remove that function's
  heading-exists early return: the early return is correct for the heading, and
  the two have different idempotency conditions - heading insertion is idempotent
  on the dated heading existing, promotion is idempotent on the Unreleased body
  being empty - which is precisely why this is a second function rather than a
  branch inside the first. Algorithm, on `text.split('\n')`: a non-string text
  coerces to `''` and a falsy version returns `changed:false`, reason
  `no-version`; find the first line matching `^## \[unreleased\]` case-insensitively,
  absent -> `changed:false`, reason `no-unreleased-section`; bound the body at
  the first following `^## ` heading, and when none exists (Unreleased is the
  file's last section) bound instead at the start of the TRAILING
  link-reference block - the contiguous run of `^\[[^\]]+\]:\s` lines that
  ends the file - so the refs never promote, while a reference definition
  sitting INSIDE the body (a bullet's `[#87]: <url>` line) promotes together
  with the content that cites it rather than truncating the promotion at that
  line and stranding everything below it; trim leading
  and trailing blank lines from that body and, if nothing remains, return
  `changed:false`, reason `empty-unreleased` - that arm is what makes a re-run
  byte-identical; locate the `^## \[<escaped version>\]` heading BEFORE mutating
  and, when absent, return `changed:false`, reason `no-release-heading`; splice
  the body span out and leave a single empty line so `## [Unreleased]` survives
  as an empty stub (Keep a Changelog pins it at the top and the next cycle
  stages into it; note D-04's claim that deleting the stub breaks the ordering
  tests at `release-decision.test.mjs:146-147,158-159` is wrong as EVIDENCE -
  those tests call only `prependChangelogEntry` and never touch this function -
  so the convention and the next cycle's staging target are the real
  constraints, and they are sufficient on their own); then RE-FIND the release heading
  on the mutated array rather than doing arithmetic on a stale index - the same
  discipline the existing link-reference insert uses at line 139-140 - and splice
  `['', ...body]` in immediately after it. Reuse the existing `escapeRe` helper
  for the version. In the seam, compose rather than branch: run
  `prependChangelogEntry` first, pass its `text` to `promoteUnreleased` with the
  same target, write ONCE with `atomicWrite` when either reports `changed`, and
  report `changelog: {changed: scaffold.changed || promo.changed, promoted:
  promo.changed, section_empty: <boolean>}`. One write only - `atomicWrite`
  renames a temp file into place, and two writes would expose an intermediate
  state on disk. Gate the changelog block on the primary verdict being `bump`
  OR `noop` (`already-at-target`) - never on `skip`: D-04's "promotion runs on
  EVERY run whose Unreleased body is non-empty" needs the noop arm for the
  re-run case, but the block currently runs on `skip` too, so a `plugin.json`
  with no `version` field would get a dated `## [<target>] - <date>` heading
  and a promotion while the manifest bumped nothing and the emit said `skip` -
  a changelog claiming a release that never happened. Pin it with a seam test:
  a version-less `plugin.json` with `--version 2.2.0` leaves `CHANGELOG.md`
  byte-unchanged and reports `changelog:{changed:false}`. `section_empty` is
  computed after scaffold plus promotion: true when the target's dated section
  body holds nothing (nothing promoted, nothing pre-existing). The milestone
  workflow (task 5) turns it into "author the section before the bump commit" -
  a heading the workflow fills two lines later is fine; one that ships empty
  with nothing said is the goal's second failure mode. Add a seam test that an
  empty-Unreleased first run reports `section_empty:true` and a run that
  promoted content reports `section_empty:false`. Lib tests: a fixture whose `## [Unreleased]`
  holds a `### Removed` heading and a bullet above a dated `## [1.0.0]` - after
  scaffold plus promotion the bullet sits after `## [2.0.0] - <date>` and before
  `## [1.0.0]`, `## [Unreleased]` still exists, and the span between it and the
  next `## ` heading is blank; a second `promoteUnreleased` call on that result is
  `changed:false` and byte-identical; appending a new bullet under Unreleased and
  calling again promotes it into the same dated section; the `no-unreleased-section`
  and `no-release-heading` arms; an Unreleased-last fixture with link
  references below it, proving the refs do not move; and a fixture whose
  Unreleased body itself contains a `[#87]: <url>` definition between two
  bullet blocks, proving the whole body promotes with the definition intact
  rather than truncating at it. Seam tests via `seam()`: one
  `bump --version 2.0.0` run against a CHANGELOG carrying both an Unreleased body
  and `## [1.0.0]` produces the promoted content inside the dated section with
  nothing but blank lines between the two headings; a second identical run leaves
  `plugin.json` and `CHANGELOG.md` byte-identical; a third run after appending a
  bullet under Unreleased promotes that bullet too. Run the seam against temp
  fixtures ONLY - never `--dir` the repo root (D-10): the live TOK-02 cost
  statement must stay under `## [Unreleased]` for `/cad-milestone` to promote at
  the close through the capability this task ships. Rewrite
  `release-decision.mjs`'s module header (lines 2-11): it states "three TOTAL
  functions that decide, from prose + manifest state, the target version",
  which tasks 2-4 make false twice over - name the current function set and
  drop the prose-derivation claim, keeping the TOTAL-functions discipline
  statement.
- **Verify:** `node --test cadence-core/bin/release-decision.test.mjs
  cadence-core/bin/release-bump.test.mjs` passes; `git status --porcelain
  CHANGELOG.md` is empty (the repo's own changelog was never touched); `npx tsc
  -p tsconfig.ci.json` exits 0.

### Task 5: the close halts on a refusal, and says which number it ships

- **Files:** cadence-core/workflows/milestone.md,
  cadence-core/bin/weight-budgets.json, CHANGELOG.md, .planning/CAPTURE.md
- **Action:** D-14, D-15, D-10, AC6, and CONTEXT's recorded deferral.
  `workflows/milestone.md` is this seam's only caller (grepped across
  `cadence-core/`, `skills/`, `agents/`) and nothing reads its exit status, so
  this prose is where the refusal becomes a halt. In step 2: make `--version
  <version>` unconditional on the run line - the parenthetical "add `--version
  <version>` when the user named one via `$ARGUMENTS`" is now wrong, since the
  seam refuses without it and the version was already confirmed with the user
  four lines above. Add the refusal arm beside the existing `skip` arm: `ok:false`
  (exit 1) means the seam wrote NOTHING and named a reason
  (`no-target-version`, `unparseable-version`, `unreadable-manifest`,
  `downgrade`, `not-an-upgrade`);
  report that reason and STOP the close there, before the annotated tag and
  before the `chore: bump manifest` commit, because a tag cut after a refused
  bump names a commit whose manifest still carries the previous version - the
  silent wrong-number ship REL-03 exists to prevent. Two more checks on the
  SUCCESS envelope, because they are the refusal contract's deliberate
  exceptions: a `siblings[]` entry with `action:'refuse'` (top-level `ok`
  stays true - the primary already wrote - but a shipped sibling manifest
  carrying a refused version is the same wrong-number ship, so halt and name
  the file); and `changelog.section_empty: true`, which means the dated
  heading currently has no body - author the release notes into it before the
  bump commit, because a close that ships it empty is the "empty notes with
  nothing said" failure this phase closes. State that the seam now also
  PROMOTES `## [Unreleased]` content into the dated section, so the model authors
  bullet prose only for what was not already staged there rather than
  re-authoring what the promotion moved (duplicating it is how one change gets
  listed twice; prior art: the v1.3.1-close CAPTURE finding that release notes
  must narrow their claims to what shipped). Repair the now-false rationale at
  lines 45-47: "This runs before step 4 evolves `### Active`, so derivation reads
  the shipping version" describes a derivation that no longer exists - keep the
  half that is still true, that the `git.auto_close` chain inherits the bump
  because step 2 always runs pre-tag. Do NOT touch step 7's ordering note: its
  `### Active` claim is about BRANCH naming through `land-cleanup.mjs`, which
  D-11 leaves alone. `milestone.md` is a MEASURED surface sitting at exactly
  7181/7181 bytes with zero headroom (D-15), so `weight-budgets.json` must be
  updated IN THIS SAME COMMIT or self-verify goes red on the commit that grew it.
  `weight.mjs` WRITES NOTHING - it prints one JSON line and the manifest is a
  different shape (`_comment` plus a sorted `budgets` map) - so run `node
  cadence-core/bin/weight.mjs`, read the reported byte count for
  `cadence-core/workflows/milestone.md`, and edit that one entry in place
  preserving `_comment` and key order - set it to the NEW measured count
  (growth past today's 7181 is expected here); self-verify flags only
  `bytes > budget`, so a budget at or above the measured size passes, and a
  file that shrank below an untouched budget was never a problem. Finally append one `- [ ] (phase 3)`
  bullet to `.planning/CAPTURE.md`'s `## Todos`: `milestone.md`'s "create an
  annotated tag at HEAD" sentence contradicts the tag-after-merge Key Decision
  PROJECT.md adopted at the v1.4.0 close, it is out of REL-03's scope, and it is
  deliberately not fixed here. Do not fix it in this phase. Finally stage this
  phase's own release note: append under `CHANGELOG.md`'s `## [Unreleased]` a
  `### Changed` entry naming (a) `release-bump.mjs bump` now requires
  `--version` and refuses without it, (b) refusals emit `ok:false` and exit 1
  rather than `ok:true, action:"error"`, and (c) staged Unreleased content is
  now promoted into the dated heading. Edit the file directly - never run the
  seam against the repo root (D-10 stays intact); this lands in task 5, not
  task 4, because task 4's verify asserts `git status --porcelain
  CHANGELOG.md` is empty. Leaving REL-03's release note to be reconstructed
  from git history at the close would be a soft version of the
  "derived from something no path keeps current" failure this phase closes.
- **Verify:** `grep -n "ok:false" cadence-core/workflows/milestone.md` shows the
  refusal arm and `grep -n "derivation reads the shipping version"
  cadence-core/workflows/milestone.md` returns nothing; `grep -n "(phase 3)"
  .planning/CAPTURE.md` returns the new todo; `sed -n '/## \[Unreleased\]/,/^## \[[0-9]/p'
  CHANGELOG.md | grep -c "release-bump"` is 1 or more (the REL-03 entry sits
  under Unreleased, above the first dated heading, whatever its number); `node cadence-core/bin/weight.mjs`
  reports a byte count for `cadence-core/workflows/milestone.md` at or under its
  `weight-budgets.json` entry; then the full gate - `node --test
  cadence-core/bin/*.test.mjs` reports 0 fail with a total above the 1027
  baseline, `npx tsc -p tsconfig.ci.json` exits 0, and `node
  cadence-core/bin/self-verify.mjs` reports `ok:true` with an empty `problems`
  array (no `budget-overrun`, no `unknown-subcommand`).

## Notes

**Plan shape.** One plan, as the CONTEXT directive states. No deviation: tasks
1-4 all touch `lib/release-decision.mjs` and `release-bump.mjs`, so no
independent slice exists.

**Three files added to CONTEXT's declared list, deliberately rather than by
drift.** `cadence-core/bin/lib/branch-decision.mjs` (task 2): its header states
`activeVersion` and `titleVersion` are exported *because* the release derivation
reuses them, and D-03 removes that consumer, so the file's own self-description
goes false the moment task 2 lands. The edit is the export keyword and that
paragraph only - no behaviour, no derivation change, D-11 untouched.
`.planning/CAPTURE.md` (task 5) is the destination CONTEXT's own Deferred section
names for the tag-at-HEAD contradiction. `CHANGELOG.md` (task 5) stages REL-03's
own release note under `## [Unreleased]` - added at the plan-check gate, because
leaving the note to be reconstructed from git history at the close is a soft
version of the failure this phase closes.

**Accepted cost, made explicit at review.** A run whose `--version` names an
ALREADY-PUBLISHED release (manifest one behind, that release's dated heading
already in the changelog) will bump the manifest and promote the staged
Unreleased body into the published section. D-04 makes promotion into an
existing heading the re-run semantics, and D-13 declines the
manifest-vs-changelog cross-check that could tell the two apart, so inside the
seam this is indistinguishable from a legitimate re-run. The guard is the
milestone workflow confirming the version with the user before the run;
accepted, not missed.

**Recalled prior art, cited.** The tag-after-merge Key Decision that task 5's
CAPTURE todo records is project memory from the v1.4.0 close (`/cad-milestone`
bumps and commits but must not `git tag`); the "narrow release-note claims to
what shipped" instruction in task 5 comes from the v1.3.1-close CAPTURE finding
about a `### Known gaps` section that advertised more than was delivered; and
every Verify grep in this plan is path-scoped rather than repo-wide, per the
phase-4 CAPTURE finding that a repo-wide "retired vocabulary appears nowhere"
grep fails against a correct tree.

**Assumptions carried from CONTEXT, unresolved by planning.** The
sibling-refusal arm is fixture-exercised only, since `marketplace.json` carries
no `version` field; if a sibling manifest ever gains a real one, D-08's
record-without-abort split-state choice needs revisiting. Task 3's
`not-an-upgrade` arm converts the third flagged assumption (build metadata never
appears in this repo's manifests) from an assumption into a pinned test row.
