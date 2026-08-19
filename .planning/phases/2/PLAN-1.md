---
phase: 2
plan: 1
requirements: [ARG-01, ARG-02]
files:
  - cadence-core/bin/lib/seam-input.mjs
  - cadence-core/bin/seam-input.test.mjs
  - cadence-core/bin/helper-census.test.mjs
  - cadence-core/bin/git-publish.mjs
  - cadence-core/bin/git-publish.test.mjs
  - cadence-core/bin/release-bump.mjs
  - cadence-core/bin/release-bump.test.mjs
  - cadence-core/bin/git-branch.mjs
  - cadence-core/bin/git-branch.test.mjs
  - cadence-core/bin/worktree-base.mjs
  - cadence-core/bin/worktree-base.test.mjs
  - cadence-core/bin/land-cleanup.mjs
  - cadence-core/bin/land-cleanup.test.mjs
  - cadence-core/bin/issue-check.mjs
  - cadence-core/bin/issue-check.test.mjs
  - cadence-core/workflows/milestone.md
---

# Phase 2: Readers that accept what they have a rule against - Plan 1

## Goal

The two flag faces that select a tree and date a release refuse malformed input
at the door: every seam reading `--dir` refuses an empty or valueless one
instead of answering about the process cwd, and `release-bump --date` is
validated against the `YYYY-MM-DD` format its own header states before anything
is read or written.

## Must be true when done

- Each of the six `--dir` seams - `git-publish.mjs`, `release-bump.mjs`,
  `land-cleanup.mjs`, `git-branch.mjs`, `worktree-base.mjs`, `issue-check.mjs` -
  run with `--dir ''` and with a valueless `--dir`, prints one JSON line
  `{"ok":false,"reason":"missing-flag-value","detail":"--dir"}` on stdout and
  exits 1. Today `git-publish.mjs reap --dir '' --branch nosuchbranch-xyz`
  answers `{"ok":true,"action":"already-absent"}` and `git-branch.mjs tags
  --dir ''` prints this repo's 33 tags.
- An ABSENT `--dir` still resolves to the process cwd at all six, so every
  existing call site and test keeps its answer.
- `release-bump.mjs bump --date` refuses `not-a-date`, `2026-13-45`, `2026-8-1`,
  `''` and a newline-carrying value with `ok:false`, `action:"refuse"`, this
  seam's own new reason code and exit 1, leaving `CHANGELOG.md` byte-identical;
  `--date 2026-08-18` still writes `## [<version>] - 2026-08-18`.
- That date refusal fires against a directory with NO `.claude-plugin/plugin.json`
  too, where the seam answers `{"ok":true,"action":"skip","reason":"no-plugin-manifest"}`
  today.
- No file in the tree still claims that both `--dir` flag contracts survive, and
  no prose still tells a contributor that the seams reading `--dir` carry no
  `e.seam` catch arm.
- `node --test 'cadence-core/bin/*.test.mjs'` passes with zero failures and
  `node cadence-core/bin/self-verify.mjs` passes.

## Context

CONTEXT.md D-01 (all SIX `--dir` seams take `flagValue`, and `seam-input.mjs`'s
"BOTH SURVIVE" header plus `seam-input.test.mjs`'s divergence arm are EDITED as
part of the fix rather than left to go red), D-02 (the refusal is the seam
envelope - one JSON line on stdout via `emit`, never stderr), D-03
(`planning.mjs`'s own `parseArgs` `--dir` is OUT and stays a known gap), D-04
(the date refusal mints a NEW seam-level reason code, never `usage` and never a
`lib/release-decision.mjs` verdict code), D-05 (`--date ''` refuses rather than
falling through to today), D-06 (the date is validated at the dispatch, before
`bump()` is entered), D-09 (every migrated bin gains its own `e.seam` catch arm),
D-10 (`YYYY-MM-DD` anchored on the whole string, embedded newline rejected
specifically). `planning.mjs` and `weight.mjs`/`self-verify.mjs` are untouched
here.

## Tasks

### Task 1: Retarget the stated two-reader contract before any seam moves

- **Files:** cadence-core/bin/lib/seam-input.mjs (the header block above `optionalFlag`),
  cadence-core/bin/seam-input.test.mjs (its file header + the two `optionalFlag` arms),
  cadence-core/bin/helper-census.test.mjs (the `flagValue` row of `HELPERS`)
- **Action:** `seam-input.mjs`'s header states "THE TWO FLAG READERS ARE TWO
  CONTRACTS, AND BOTH SURVIVE (D-03). Do not 'fix' this into one" and justifies
  `optionalFlag` with "the five seams that call it default through
  `optionalFlag(argv,'--dir') || process.cwd()` and carry NO `e.seam` catch arm".
  This phase's D-01 reverses exactly that guarantee, for `--dir` and only for
  `--dir`, so the header is edited here FIRST: no seam should be migrated against
  a comment instructing the executor not to. Rewrite it to say what stays true -
  the two readers still answer differently for a present-but-valueless flag and
  both are still live; `flagValue` is the reader for `--dir` at every seam;
  `optionalFlag` stays the reader for the flags that legitimately default
  (`--branch`, `--base`, `--remote`, `--merged`, `--version`, `--date`,
  `--timeout-ms`) - and say that the `--dir` divergence was reversed because the
  advisory seams showed the same defect the mutating ones did. Do NOT delete
  `optionalFlag`, do not merge the two functions and do not change either
  function body: what is being deleted is the CLAIM about `--dir`, not the
  reader. In `seam-input.test.mjs` the two arms at `:27-38`
  (`optionalFlag: present-and-valueless is undefined, NOT a throw` and
  `optionalFlag: an empty or flag-shaped value is returned as-is`) assert facts
  that remain true but spell them with `--dir` and justify them with the same
  five-callers sentence; re-spell them on a flag that still reads through
  `optionalFlag` after this plan and correct their comments, keeping every
  assertion and keeping the explicit divergence test. Apply the same correction
  to the `flagValue` row's `note` in `helper-census.test.mjs`, which repeats that
  sentence as contributor guidance and would otherwise instruct a future reader
  to un-fix this. No behaviour changes in this task.
- **Verify:** `node --test cadence-core/bin/seam-input.test.mjs
  cadence-core/bin/helper-census.test.mjs` passes;
  `grep -c "BOTH SURVIVE" cadence-core/bin/lib/seam-input.mjs` is 0, and
  `grep -rin "carry no" cadence-core/bin/lib/seam-input.mjs
  cadence-core/bin/seam-input.test.mjs cadence-core/bin/helper-census.test.mjs`
  returns nothing where it returns exactly one line per file today - that
  sentence is the claim D-01 reverses, stated once in each of the three;
  `grep -c "missing-flag-value"
  cadence-core/bin/lib/seam-input.mjs` is still non-zero, proving the reader
  itself was not touched.

### Task 2: `--dir` refuses at the two seams that WRITE

- **Files:** cadence-core/bin/git-publish.mjs (header `--dir` lines + dispatch tail),
  cadence-core/bin/git-publish.test.mjs,
  cadence-core/bin/release-bump.mjs (header `--dir` line + dispatch tail),
  cadence-core/bin/release-bump.test.mjs
- **Action:** These two are the seams whose headers claim mutation
  (`git-publish.mjs` rail 3, `release-bump.mjs` "this seam WRITES"), so `--dir`
  here selects the tree that gets written. Read it through
  `flagValue(argv, '--dir')` from `./lib/seam-input.mjs` at every subcommand -
  `publish`, `reap` and `authorized` in git-publish, `bump` in release-bump -
  instead of the `flag` adapter over `optionalFlag`. KEEP the trailing
  `|| process.cwd()`: `flagValue` returns `undefined` for a genuinely absent
  flag, so absent-means-cwd is unchanged and only the empty, valueless and
  flag-shaped spellings throw. Keep the `flag` binding for every other flag in
  each file; `--remote`, `--branch`, `--version` and `--date` all still default
  through the permissive reader. Then add the `e.seam` catch arm ahead of the
  existing generic arm in each dispatch tail (D-09), in the shape
  `self-verify.mjs:1493-1497` already carries: a thrown object with a `seam`
  field emits `{ok:false, reason:e.seam, detail:e.detail}`, everything else falls
  to the existing `internal` arm kept byte for byte, including git-publish's
  `redactUrl` wrapper. Without that arm the refusal surfaces as
  `{"ok":false,"reason":"internal","detail":"[object Object]"}`, because the
  thrown object carries no `message`. The refusal must go out through `emit` on
  stdout and nowhere else (D-02): stdout is the single channel the seam layer
  parses, and a refusal on stderr is invisible to every workflow reading the
  line. Update each bin's `--dir` header line to say an empty or valueless value
  refuses. Add rows to both test files for `--dir ''` and for a valueless
  `--dir`, on every subcommand, asserting the reason, the detail and exit 1.
- **Verify:** `node cadence-core/bin/git-publish.mjs reap --dir '' --branch
  nosuchbranch-xyz` prints `{"ok":false,"reason":"missing-flag-value","detail":"--dir"}`
  and exits 1, where it prints `{"ok":true,"action":"already-absent"}` today; the
  same for a valueless `--dir`, for `git-publish.mjs publish` and `authorized`,
  and for `release-bump.mjs bump`; `git-publish.mjs authorized` with NO `--dir`
  still answers about the cwd; `node --test cadence-core/bin/git-publish.test.mjs
  cadence-core/bin/release-bump.test.mjs cadence-core/bin/config-seams.test.mjs`
  passes.

### Task 3: `--dir` refuses at `git-branch` and `worktree-base`

- **Files:** cadence-core/bin/git-branch.mjs (header `--dir` lines + dispatch tail),
  cadence-core/bin/git-branch.test.mjs,
  cadence-core/bin/worktree-base.mjs (header `--dir` line + dispatch tail),
  cadence-core/bin/worktree-base.test.mjs
- **Action:** Same migration as task 2, applied to `decide` and `tags` in
  git-branch and to `resolve` in worktree-base: `flagValue(argv, '--dir')`, the
  `|| process.cwd()` default kept for the absent case, the `flag` binding kept
  for `--branch`, and the `e.seam` arm added ahead of the generic `internal` arm.
  These are ADVISORY readers that mutate nothing, and they are in scope on
  purpose (D-01): measured 2026-08-18, `git-branch.mjs tags --dir ''` returned
  this repository's 33 tags, so the caller that meant to ask about another tree
  got a confident answer about this one - the same quiet-wrong-answer class the
  `--root` refusal in `weight.mjs` exists for. Do not narrow the change to
  `decide` on the theory that only the config-reading subcommand matters:
  `.planning/CAPTURE.md`'s own `[act]` item names read-only `git-branch tags` as
  the site to fix.
- **Verify:** `node cadence-core/bin/git-branch.mjs tags --dir ''` prints
  `{"ok":false,"reason":"missing-flag-value","detail":"--dir"}` and exits 1 where
  it printed the tag list; the same for a valueless `--dir`, for
  `git-branch.mjs decide` and for `worktree-base.mjs resolve`; `git-branch.mjs
  tags` with no `--dir` still prints this repo's tags with `ok:true`;
  `node --test cadence-core/bin/git-branch.test.mjs
  cadence-core/bin/worktree-base.test.mjs` passes.

### Task 4: `--dir` refuses at `land-cleanup` and `issue-check`

- **Files:** cadence-core/bin/land-cleanup.mjs (header `--dir` lines + dispatch tail),
  cadence-core/bin/land-cleanup.test.mjs,
  cadence-core/bin/issue-check.mjs (header `--dir` lines + dispatch tail),
  cadence-core/bin/issue-check.test.mjs
- **Action:** Same migration again, applied to `cleanup` and `gate` in
  land-cleanup and to `check` in issue-check. Two constraints specific to this
  pair. First, `--dir` is the only flag that changes: issue-check's dispatch
  deliberately falls back to `DEFAULT_TIMEOUT_MS` on a malformed `--timeout-ms`
  rather than refusing, with a comment stating why (an unbounded call is the one
  thing this seam may never make), and `--base`, `--branch` and `--merged` all
  keep the permissive reader - D-01 names `--dir` and widening it here would be
  a second decision. Second, issue-check's header states the call is bound to
  the repository `--dir` names two ways together, and that the seam never fails
  a land: a refusal for a malformed CALL is not that seam failing a tracker
  read, and the header should say so on its `--dir` line rather than leaving the
  two claims looking contradictory. `land-cleanup.mjs gate` reads stdin; the
  `--dir` refusal must still emit exactly one JSON line and exit 1 regardless of
  what stdin carries.
- **Verify:** `node cadence-core/bin/land-cleanup.mjs cleanup --dir ''` and
  `node cadence-core/bin/issue-check.mjs check --dir ''` each print
  `{"ok":false,"reason":"missing-flag-value","detail":"--dir"}` and exit 1; the
  same for valueless `--dir` and for `land-cleanup.mjs gate`; `issue-check.mjs
  check --dir . --timeout-ms abc` still runs with the default timeout rather
  than refusing; `node --test cadence-core/bin/land-cleanup.test.mjs
  cadence-core/bin/issue-check.test.mjs` passes.

### Task 5: `release-bump --date` is validated before `bump()` is entered

- **Files:** cadence-core/bin/release-bump.mjs (header vocabulary block + dispatch),
  cadence-core/bin/release-bump.test.mjs,
  cadence-core/workflows/milestone.md (the `ok:false` halt bullet)
- **Action:** `bump()` opens with `const date = dateArg || new Date()...`, which
  collapses absent with empty and then hands whatever string arrived to
  `prependChangelogEntry`; measured 2026-08-18, `--date ''` wrote
  `## [1.1.0] - 2026-08-18` and a newline-carrying `--date` wrote a forged second
  release section `## [9.9.9] - forged` into CHANGELOG.md above the real one.
  Validate the value at the dispatch, beside `flag('--version')`, BEFORE `bump()`
  is called (D-06). Validate only a PRESENT `--date`, and test presence with
  `!== undefined` rather than truthiness: `''` is falsy, so a truthiness test is
  itself the absent-vs-empty collapse D-05 refuses. An absent flag keeps
  defaulting to today, while `--date ''` REFUSES rather than falling through
  (D-05) - two different answers for an empty flag is exactly what phase 4's
  shared contract cannot inherit. `--date` keeps reading through `optionalFlag`,
  so a BARE trailing `--date` is indistinguishable from an absent one and still
  dates today; that residue is stated rather than closed here, because D-01
  moves `--dir` to `flagValue` and nothing else, and refusing it through
  `missing-flag-value` would give this seam two reason codes for one malformed
  flag. The grammar is the one the header already
  states, `YYYY-MM-DD`, anchored over the WHOLE string with the month and day
  ranges spelled out so `2026-13-45` and `2026-8-1` both fail; give a value
  carrying `\r` or `\n` its own arm ahead of the format test with its own
  `detail` sentence (D-10), the way `planning.mjs:501-504`'s `cursor set --next`
  newline term reads, because "not YYYY-MM-DD" is the wrong sentence for a value
  that appended a release section. The refusal is this seam's own envelope as
  `release-bump.mjs:28-38` states it: `ok:false`, `action:"refuse"`, the human
  sentence in `detail`, exit 1 through `emit`, nothing written - and no
  `manifest`, `siblings` or `changelog` fields, which the in-`bump()` refusals
  fill from a manifest this path never read and which would be fabricated here.
  It carries a NEW seam-level reason code, `bad-date` (the planner's spelling of
  the code D-04 requires): never `usage`, which is this seam's bad-subcommand
  code, and never a verdict code, which `lib/release-decision.mjs` owns - a
  caller branching on `reason` must be able to tell a bad `--date` from a bad
  subcommand. Add it to the SEAM-level list in the header block beside
  `no-plugin-manifest`, `unreadable-manifest`, `usage` and `internal`, and add it
  to the `ok:false` halt bullet in workflows/milestone.md, which enumerates five
  reasons today and would otherwise tell the closer that a reason it can now
  receive does not exist. Do not add calendar validation beyond the stated
  format - `2026-02-31` is outside D-10 and inventing a rule here is a rule
  phase 4 would inherit unstated. Accept the stated consequence (D-06): a
  malformed `--date` now refuses on a non-plugin project too, where the manifest
  gate answered `{"ok":true,"action":"skip","reason":"no-plugin-manifest"}`
  first.
- **Verify:** on a fixture holding `.claude-plugin/plugin.json` and
  `CHANGELOG.md`, `release-bump.mjs bump --dir <fixture> --version <next> --date
  <value>` for each of `not-a-date`, `2026-13-45`, `2026-8-1`, `''` and
  `$'2026-08-18\n## [9.9.9] - forged'` prints
  `{"ok":false,"action":"refuse","reason":"bad-date",...}`, exits 1, and leaves
  CHANGELOG.md byte-identical (compare `sha256sum` before and after); the same
  five values refuse identically against a fixture with no
  `.claude-plugin/plugin.json`, where the run answers
  `{"ok":true,"action":"skip","reason":"no-plugin-manifest"}` today;
  `--date 2026-08-18` still writes `## [<version>] - 2026-08-18` and a run with
  no `--date` still dates today; `node --test cadence-core/bin/release-bump.test.mjs`
  passes with rows for all five values plus the no-manifest case.

## Notes

- Plan shape deviation, recorded per the contract: CONTEXT.md's `Plan shape`
  directive splits this phase into four areas and asserts "AC1-AC2 the six seam
  bins plus lib/seam-input.mjs, AC3-AC4 release-bump" share no code. They do -
  `cadence-core/bin/release-bump.mjs` is one of the six `--dir` seams D-01 names
  AND the seam ARG-02 validates - so those two areas are one plan here rather
  than two plans leasing the same file, which is the failure mode CONTEXT's
  fourth flagged assumption names. The directive's "multiple plans" is honored:
  this phase ships three, and the other two share no file with this one.
- The `bad-date` spelling is the planner's choice under D-04, which fixes the
  vocabulary and the owner but not the token. Any other seam-level spelling that
  is distinct from `usage`, `internal`, `no-plugin-manifest`,
  `unreadable-manifest` and from every `lib/release-decision.mjs` verdict code
  satisfies the decision equally; if the executor picks a different one, the
  header block, milestone.md and the tests must all name the same token.
- Prior art for the refusal shape, from `v3.5.3/phases/2/UAT.md` (phase 2): a
  malformed `--turns` value is refused wholesale with nothing appended -
  `trace close --turns -1`, a non-integer and the bare flag each exit non-zero
  and append no line to `trace.jsonl`. Tasks 2-5 keep that shape: refuse first,
  write nothing.
- Out of this phase by CONTEXT: the bare `--role` empty-key item in
  `.planning/CAPTURE.md` (filed against phase 4) and `planning.mjs`'s own
  `parseArgs` `--dir` (D-03, a known gap after this phase). Neither is folded in
  here. A third residue task 5 states rather than closes: a bare trailing
  `--date` still reads as absent and dates today, since `--date` keeps the
  permissive reader. All three are input for phase 4's declarative contract.
- The CI typecheck (`tsconfig.ci.json`, `checkJs` with `strict:false`) is not
  runnable locally - `tsc` is absent from this machine and the config installs it
  ephemerally in CI - so it is not in any Verify above. Nothing in this plan
  changes an exported signature.
