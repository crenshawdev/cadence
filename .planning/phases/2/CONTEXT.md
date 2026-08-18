# Phase 2: Readers that accept what they have a rule against - Context

Gathered: 2026-08-18
Feeds: /cad-plan 2

## Scope boundary

In: the five faces that hold a rule and do not apply it where the value enters
- `--dir` across every seam that reads it (ARG-01), `release-bump --date`
(ARG-02), the phase-id spelling at `seed-reqs` and `cursor set` (ARG-03), the
shared numeric readers' safe-integer range (ARG-04), and every `config.mjs`
face's prototype-member lookup (ARG-05). Six seam bins, `lib/seam-input.mjs`
and its test's divergence arm, `lib/require-int.mjs`, `lib/issue-decision.mjs`,
two phase-number readers in `lib/planning-files.mjs`, `config.mjs` and
`lib/retired-keys.mjs`.
Out: ARG-06, the declarative argument contract phase 4 builds out of these
per-seam refusals - phase 2 writes the case-by-case fixes it will express;
`planning.mjs`'s own `parseArgs` `--dir` (D-03); the `deepMerge` `__proto__`
latent item, which nothing reads (`.planning/CAPTURE.md`); the bare `--role`
empty-key item, filed against phase 4.
Deferred: None.
Plan shape: multiple plans, same phase - the four areas share no code
(AC1-AC2 the seam bins, AC3-AC4 release-bump, AC5-AC6 the planning numeric
layer, AC7 config), so they carry no ordering constraint between them.

## Durable decisions

- D-01 (ARG-01 reach): ALL SIX `--dir` seams take `lib/seam-input.mjs`'s strict
  `flagValue` - `git-publish.mjs`, `release-bump.mjs`, `land-cleanup.mjs`,
  `git-branch.mjs`, `worktree-base.mjs`, `issue-check.mjs` - not only the two
  whose headers claim mutation. This REVERSES a stated, tested guarantee, so
  `lib/seam-input.mjs:19-32` ("THE TWO FLAG READERS ARE TWO CONTRACTS, AND BOTH
  SURVIVE (D-03). Do not 'fix' this into one") and the `seam-input.test.mjs`
  divergence arm at `:27-38` are EDITED as part of this fix rather than left to
  go red. Evidence: measured 2026-08-18, `git-publish.mjs reap --dir '' --branch
  nosuchbranch-xyz` returned `{"ok":true,"action":"already-absent"}` and
  `git-branch.mjs tags --dir ''` returned this repo's 33 tags - the advisory
  seams show the identical defect the mutating ones do, and
  `.planning/CAPTURE.md`'s own `[act]` item names read-only `git-branch tags`
  as the site to fix.
- D-02 (refusal shape): the refusal is the SEAM ENVELOPE - one JSON line on
  stdout, `ok:false`, a named `reason`, exit 1 via `emit` - and NOT phase 1's
  stderr-plus-non-zero pattern, which applied to shell read-backs in workflow
  prose. Evidence: `cadence-core/bin/lib/seam-io.mjs` ("stdout is the single
  channel the whole seam layer parses"). A refusal on stderr is invisible to
  every workflow that parses the seam's stdout line.
- D-03 (ARG-01 scope): `planning.mjs`'s `--dir` is OUT - it comes from that
  file's own `parseArgs` (`:5107-5119`, `:5191`), not from the permissive flag
  reader ARG-01 names. Recorded as a KNOWN GAP for phase 4 rather than as
  silence: measured 2026-08-18, `planning.mjs status --dir ''` answered about
  `./.planning` relative to the process cwd with `ok:true`, so the tree's
  largest mutator still retargets on an empty flag after this phase.
- D-04 (ARG-02 vocabulary): the malformed-date refusal mints a NEW seam-level
  reason code in the vocabulary `release-bump.mjs:38-47` enumerates and owns,
  never `usage` and never a verdict code owned by `lib/release-decision.mjs`.
  Evidence: `:26-37` states the D-01 refusal envelope; `:38-47` states the two
  vocabularies and their one owner each. A caller branching on `reason` must be
  able to tell a bad `--date` from a bad subcommand.
- D-05 (ARG-02 grammar): `--date ""` REFUSES rather than falling through to
  today's date. Evidence: `release-bump.mjs:103` (`dateArg || new Date()...`)
  collapses absent and empty; measured 2026-08-18, `--date ''` wrote
  `## [1.1.0] - 2026-08-18`. This is the same absent-vs-empty collapse ARG-01
  refuses for `--dir`, and two different answers for an empty flag is exactly
  what phase 4's shared contract cannot inherit.
- D-06 (ARG-02 ordering): the date is validated at the dispatch line beside
  `--version`, BEFORE `bump()` is entered. The consequence is stated rather
  than avoided: a malformed `--date` now refuses on a non-plugin project too,
  where `release-bump.mjs:108-114` used to return
  `{"ok":true,"action":"skip","reason":"no-plugin-manifest"}`. A malformed
  value is malformed whether or not anything would be written, and the caller
  learning it only on the run that also writes is the defect this phase closes.
- D-07 (ARG-03 mechanism): a phase spelling the numeric grammar cannot
  round-trip (`String(Number(x)) !== x` - `1.10`, `1.0`, `01`) is REFUSED at the
  two write faces `seed-reqs` and `cursor set`, rather than carried raw through
  `parseCursor`, `parseRoadmapPhases` and `parseRequirements`. `phase-done`
  keeps `.value` per `planning.mjs:580-582`'s own D-11, so `--n 02` and
  `--n 2.1` are unaffected. STATED COST: this removes the `phases/1.10/`
  directory read that `planning.mjs:1706`, `:1891`, `:1984`, `:2334` and
  `:3048` perform through `parsedPhase.raw` - a capability the codebase
  deliberately built (`lib/require-int.mjs:48-66`,
  `require-int.test.mjs:31-33`). Evidence for the defect: measured 2026-08-18
  on a fixture with `phases/1.1/` and `phases/1.10/`, `seed-reqs --phase 1.10`
  wrote `| BBB-01 | Phase 1.1 | Pending |` and `cursor set --phase 1.10` wrote
  `Phase: 1.1 of 2 (One)` - picking the OTHER phase's name.
- D-08 (ARG-04 reach): the safe-integer guard lands in the SHARED numeric
  layer, not in `normalizeNumber` alone - `requireInt`,
  `requireCursorNumber`/`requirePhaseArg` (`lib/require-int.mjs`),
  `normalizeNumber` and `scanIssueRefs` (`lib/issue-decision.mjs:70`, `:393`),
  plus the two phase-number readers `lib/planning-files.mjs:874` and `:1045`.
  Evidence: `Number.isSafeInteger` appears nowhere in the tree; measured
  2026-08-18, `requireInt('9007199254740993')` returns
  `{ok:true,value:9007199254740992}` and `requireInt('1'+'0'.repeat(21))`
  returns `{ok:true,value:1e+21}`. `requireInt` is the reader `--total`,
  `--attempt`, `--plan`, `--top`, `--turns` and `--raised` all reach, and
  `normalizeNumber` reads forge ISSUE numbers rather than the phase numbers
  ARG-04's roadmap sentence describes - closing only the named function would
  leave the described defect open.

## Decisions

- D-09 (ARG-01 form): every migrated bin gains its own `e.seam` catch arm ahead
  of its generic `internal` arm - the migration is not complete without it.
  Evidence: the dispatch tails of all six bins end
  `catch (e) { emit({ok:false, reason:'internal', ...}) }`;
  `self-verify.mjs:1493-1497` shows the arm shape that already exists. Without
  it a valueless `--dir` produces
  `{"ok":false,"reason":"internal","detail":"[object Object]"}`.
- D-10 (ARG-02 format): the format is the one the seam's own header states -
  `YYYY-MM-DD` (`release-bump.mjs:18`, `:23`) - anchored on the WHOLE string,
  with an embedded newline rejected specifically. Evidence: measured
  2026-08-18, a newline-carrying `--date` wrote a forged second release section
  `## [9.9.9] - forged` into `CHANGELOG.md` above the real one; the refusal
  precedent is `planning.mjs:501-504` (`cursor set --next`).
- D-11 (ARG-04 semantics): `normalizeNumber`'s out-of-range refusal fails the
  WHOLE tracker read rather than dropping the row, by that reader's stated
  design (`lib/issue-decision.mjs:100-105` - "dropping it is how a renamed
  field becomes a not-found verdict"). One pathological row therefore degrades
  `/cad-land` step 1 to its one-line skip.
- D-12 (ARG-05 form): `Object.hasOwn` at all four bare index reads -
  `config.mjs:271`, `:274`, `:165` and `lib/retired-keys.mjs:155` - matching
  the guard `validate` already carries at `config.mjs:138-142`. No new helper
  and no new reason code. Evidence: measured 2026-08-18,
  `config.mjs check '__proto__=1'` returns `retired in v2.0.0: undefined` - a
  fabricated retirement claim, a wrong diagnostic rather than a missing one.
- D-13 (ARG-05 scope): the fix and its test are stated over EVERY
  `Object.prototype` member, not over `__proto__` alone. Evidence: measured
  2026-08-18, `config.mjs get constructor` and `get toString` each return
  `{"ok":true,"values":{}}` exit 0 identically, and `get stakes __proto__`
  returns one key of the two asked for with nothing saying so.
  `config.test.mjs:901-907` already pins `constructor` and `prototype` on the
  MERGE path; the READ path has no counterpart.

## Acceptance criteria

- [ ] AC1: each of the six `--dir` seams, run with `--dir ''` and with a
      valueless `--dir`, prints one JSON line `{"ok":false,...}` naming the flag
      and the seam and exits 1. Baseline: `git-publish.mjs reap --dir ''
      --branch nosuchbranch-xyz` returns `{"ok":true,"action":"already-absent"}`
      and `git-branch.mjs tags --dir ''` returns this repo's tag list.
- [ ] AC2: `node --test cadence-core/bin/*.test.mjs` passes with zero failures,
      and `cadence-core/bin/lib/seam-input.mjs`'s header no longer claims two
      surviving `--dir` contracts.
- [ ] AC3: `release-bump.mjs bump --date` with each of `not-a-date`,
      `2026-13-45`, `2026-8-1`, `''`, and a newline-carrying value returns
      `{"ok":false,"action":"refuse"}` with the new reason code and exit 1, and
      `CHANGELOG.md` is byte-identical afterwards; `--date 2026-08-18` still
      writes `## [<version>] - 2026-08-18`.
- [ ] AC4: against a directory with no plugin manifest, `--date not-a-date`
      returns the date refusal, not
      `{"ok":true,"action":"skip","reason":"no-plugin-manifest"}`.
- [ ] AC5: `seed-reqs --phase 1.10` and `cursor set --phase 1.10` each return
      `ok:false` naming the spelling; `--phase 2.1` and `--phase 2` still
      succeed; `phase-done --n 02` still checks its roadmap box.
- [ ] AC6: `requireInt`, `requireCursorNumber`, `normalizeNumber` and
      `scanIssueRefs` each refuse `9007199254740993` and a 400-digit string,
      where today they return `9007199254740992` and `Infinity`.
- [ ] AC7: `config.mjs get __proto__`, `get constructor` and `get toString`
      each return `unknown-key` and exit 1; `get stakes __proto__` refuses
      rather than answering about one key of two; `check '__proto__=1'` no
      longer reports `retired in v2.0.0: undefined`.

## Flagged assumptions

- No shipped project outside this repo addresses a `phases/1.10/` directory
  that D-07's refusal would strand - Unclear; if wrong, that project can no
  longer name its own phase, and the repair is a directory rename it was never
  told to make.
- No seam flag legitimately carries a value above `2^53` (`--total`,
  `--attempt`, `--plan`, `--top`, `--turns`, `--raised`) - Likely; if wrong,
  D-08's guard refuses a value the seam used to accept.
- `lib/retired-keys.mjs`'s guard can be placed so a genuinely retired key still
  reports its real `since` and `detail` - Likely; if wrong, a real retirement
  reports as `unknown-key` and the retirement vocabulary is silently lost.
- The split of the four areas across plans is the planner's call within the
  multiple-plans shape - Unclear; if wrong, two plans lease the same file and
  one overwrites the other's edit.
