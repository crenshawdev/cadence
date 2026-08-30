# Phase 4: Land reads rulings, not raw findings - Context

Gathered: 2026-08-29
Feeds: /cad-plan 4

## Scope boundary

In: LND-02. `land-cleanup.mjs gate` stops unioning raw
`REVIEW-risk_surface*.md` findings and instead halts on the adjudicated
state, reusing the one definition of genuinely-unfixed that
`cadence-core/bin/lib/filing-decision.mjs` already owns. Three pieces move
together: the predicate gains the `fix_commit` field and a third named
answer; the gate classifies from records and surfaces overridden entries on
its envelope; and `/cad-milestone`'s carry grows to move the
`ADJUDICATION-*.json` records through the prune that today deletes them.
Four prose files that state the union move in the same edit -
`skills/cad-land/SKILL.md:122-138`, `cadence-core/workflows/milestone.md:106-115`
and `:242-244`, `cadence-core/references/risk-surface.md:169-190`,
`cadence-core/references/triage-gate.md:339-348` - with
`cadence-core/bin/weight-budgets.json` re-pinned in the same commit.
Out: the ruling vocabulary and the record schema (phase 1's ground), the
deferred queue's own gate, and anything `/cad-land` does after `action`.
The gate grows no disk read of its own: `--dir` stays the config-only flag
it is today.
Deferred: none.
Plan shape: multiple plans, same phase - the predicate plus its census proof,
the gate's classification and envelope, and the carry plus the prose. Let
/cad-plan break it down.

## Durable decisions

- D-01 (OQ-2, the arm): `/cad-milestone`'s carry GROWS to move the
  `ADJUDICATION-*.json` records through the prune; the gate derives the
  verdict at close time from them. Rejected: `/cad-milestone` resolving
  genuinely-unfixed at carry time and carrying the verdict - it puts a frozen
  answer on disk that nothing can re-derive, so criterion 1's "exactly one
  definition" holds on paper while the artifact is a second one. Evidence:
  the carry today is orchestrator prose with no seam
  (`cadence-core/workflows/milestone.md:107-115`), so either arm needs new
  code and the cheapness argument does not separate them;
  `cadence-core/bin/planning/deferred-carry.mjs` is the only carry seam that
  exists and it MOVES artifacts;
  `cadence-core/bin/planning/milestone-prune.mjs:246-260` is the destructor -
  `--mode delete` `rmSync`s `phases/<N>` whole, records included.
- D-02 (the join): what the carry and the gate union is the adjudication
  records' `entries[]`, never the REVIEW files' `findings[]` joined to
  rulings after the fact. Rejected: a content join on `(file, line, claim)`
  and one on `(file, line)`. Evidence: measured 2026-08-29 over all 15
  `REVIEW-risk_surface-*.md` in `.planning/` plus the v3.7.7 pair at
  `220f99d3` - of the 6 review findings with a sibling record,
  `(file, line, claim)` joins 4/6 and `(file, line)` joins 6/6. The 2 that
  fail on `claim` are exactly the DOWNGRADED ones, where the settled review
  re-words the claim and restates it at the raised severity
  (`cadence-core/bin/lib/adjudication-record.mjs:466-471` stores only the
  raised severity). A claim-keyed join therefore drops every downgraded
  finding, and both failure arms are bad: fail-open rebuilds the v3.7.7 bug,
  fail-closed halts every close that downgraded anything.
- D-03 (unruled findings): a `REVIEW-risk_surface-*.md` with NO sibling
  `ADJUDICATION-*.json` is a FIFTH named state - it is reported by name in
  the gate's output and it HALTS under `auto_close`. Rejected: scoping the
  halt to fires that have a record and reporting the unruled count
  separately, which lets a deferred or legacy fire's blocker through and is a
  strictly worse version of the bug LND-02 exists to close. Evidence: 10 of
  the 15 `REVIEW-risk_surface-*.md` files in `.planning/` have no sibling
  record at all (every `_archive-v3.3.0/*` and `_archive-v3.4.0/*` one), 15
  findings between them; `cadence-core/bin/lib/deferred-queue.mjs:27-32`
  states the same fact as a design premise - "a deferred fire writes no
  `ADJUDICATION-*.json` at all, and its members read as unruled". Accepted
  cost: a project carrying pre-v3.7.3 review artifacts halts until it rules
  or clears them.
- D-04 (the one definition): the `fix_commit` exclusion MOVES INTO
  `cadence-core/bin/lib/filing-decision.mjs`. `unfixedFromEntries` gains a
  third named answer in its existing single pass, and
  `cadence-core/bin/issue-filing.mjs:278`'s
  `selected.findings.filter((e) => !e.fix_commit)` retires. Rejected: leaving
  the module a three-field test and applying the `fix_commit` filter at the
  gate's call site, which spells the full meaning of genuinely-unfixed in two
  places - what criterion 1 forbids and what phase 1's D-05 refactor removed.
  Evidence: `cadence-core/bin/lib/filing-decision.mjs:92-97` states
  `fix_commit` "IS STILL NOT ONE OF THE FIELDS" and delegates removal to the
  seam; `:113-126` shows a non-overridden halting survivor `continue`ing
  before either array is pushed, so the set the gate halts over is exactly
  the entries neither `filing` nor `haltingSurvivors` holds.
- D-05 (overridden vs fix_commit): an entry carrying BOTH `overridden: true`
  and a `fix_commit` counts as FIXED - it does not halt and it is not
  surfaced as an unfixed override. `fix_commit` wins. Evidence: the record
  schema permits both on one entry
  (`cadence-core/bin/lib/adjudication-record.mjs:472-473` refuses only when
  NEITHER is present - phase 1's SUMMARY deviation against its own D-04,
  filed as `eb3c4bdae2b8fb82`), and
  `cadence-core/bin/lib/filing-decision.mjs:96-97` already states this
  precedence for filing: "An overridden entry that ALSO names a commit is in
  the set here and is removed there". Rejected: leaving the precedence to
  filter statement order, which is how one entry becomes a permanent unfixed
  override at every close.
- D-06 (where the derivation runs): the classification runs at the
  `cadence-core/bin/land-cleanup.mjs` seam, which hands `decideGateHalt` an
  already-classified halting list plus the overridden list.
  `cadence-core/bin/lib/close-decision.mjs` does NOT import
  `filing-decision.mjs`. Rejected: importing it and restating the header -
  `filing-decision.mjs:30-31` pulls `createHash` and `buildEntries`, and
  `adjudication-record.mjs` is 543 lines of validator, which makes
  `close-decision.mjs:2-11`'s "Zero-dep (node builtins only, and it uses
  none) ... never does I/O" false in its own header.
- D-07 (the gate's input path): the gate keeps taking its payload from stdin
  and grows no disk read of `ADJUDICATION-*.json`; `--dir` stays the
  config-only flag it is today. What changes is what the CALLER pipes.
  Rejected: globbing records under `--dir` (gives the gate two input paths, so
  a tree with no records and a valid stdin payload lands in a state criterion
  4's four names do not cover) and a new `gate --records` subcommand.
  Evidence: `cadence-core/bin/land-cleanup.mjs:97-109`, `:169-174`;
  `cadence-core/bin/lib/arg-contract.mjs:1093-1102` declares `gate: {}`.
- D-08 (rounds): when a fire has records, EVERY round is unioned - the
  highest round alone is not the record of the fire. Evidence: measured -
  `.planning/_archive-v3.7.3/1/` holds both
  `ADJUDICATION-risk_surface-plan-1.json` (4 entries) and `-r2.json` (3), and
  2 of the review file's 6 findings appear only in round 1; unioning leaves
  0/6 unmatched, highest-round-only leaves 2/6.
  `cadence-core/references/review-triggers.md:253-258` states a re-arm is a
  second fire on the same discriminator.
- D-09 (criterion 5's shape): an overridden halting survivor is surfaced by
  an ADDITIVE key on the gate envelope carrying `unfixedFromEntries`'s
  `haltingSurvivors`. It is not folded into `findings` and `action` does not
  change. Evidence: `cadence-core/bin/lib/close-decision.mjs:105-107` states
  "`/cad-land` keeps branching on `action` alone (D-08)";
  `skills/cad-land/SKILL.md:132-134` branches on `action:"halt"`;
  `cadence-core/bin/land-cleanup.mjs:174` spreads the decision onto the
  envelope. Folding it into `findings` re-adds the false halt for the one
  case a person already decided.
- D-10 (the no-second-classifier proof): criterion 1's test is a
  `cadence-core/bin/helper-census.test.mjs` row - a body-idiom regex over
  every `.mjs` under `cadence-core/bin/`. Rejected: an import-count or
  per-file assertion, and relying on the two-face agreement test alone.
  Evidence: `helper-census.test.mjs:1-30` states exactly this design ("a
  re-copy into a SIXTH file is invisible to any file-scoped count"; "It
  matches DEFINITIONS, never call sites"), `:53-140` shows the six existing
  rows' shape, and `cadence-core/bin/lib/census-registry.mjs` is where a
  written-down count would need its row.

## Decisions

- D-11 (the third spelling): `cadence-core/bin/lib/close-decision.mjs:119`'s
  inline `f.severity === 'blocker' || f.severity === 'high'` is already a
  third statement of `HALTING_SEVERITIES` and this phase resolves it -
  otherwise criterion 1's test ships green over a tree that already holds a
  second spelling of the severity half. Evidence:
  `cadence-core/bin/lib/adjudication-record.mjs:85` and
  `cadence-core/bin/lib/filing-decision.mjs:48` each declare the constant,
  and `cadence-core/bin/adjudication-record.test.mjs:583-590` explains why
  those two are deliberately separate (an import back would be a cycle) and
  asserts they agree; the inline literal is watched by nothing.
- D-12 (the archive arm does not help): neither consumer glob reaches
  `.planning/_archive-<label>/`, so `--mode archive` does not accidentally
  preserve reachability. Evidence:
  `cadence-core/bin/land-cleanup.mjs:36-40` and
  `skills/cad-land/SKILL.md:126-127` name exactly
  `.planning/phases/*/REVIEW-risk_surface*.md` and
  `.planning/REVIEW-risk_surface-*.md`;
  `cadence-core/bin/planning/milestone-prune.mjs:249-260` writes to
  `_archive-<label>/<N>`, a sibling of `phases/`. A design resting on the
  archive arm is blind on exactly the `--mode delete` release closes
  `/cad-land` chains.
- D-13 (the four names are a no-change requirement):
  `stdin-unreadable`, `stdin-empty`, `malformed-json` and
  `not-a-findings-payload` keep their names and their one home in
  `cadence-core/bin/lib/close-decision.mjs:93-101`, mirrored by
  `cadence-core/bin/land-cleanup.mjs:97-109` and pinned by
  `cadence-core/bin/close-decision.test.mjs:123-141`'s `UNREADABLE` loop.
  The fifth state of D-03 is added beside them, never by folding one.
- D-14 (the fixture is recoverable): the v3.7.7 close reproduces from this
  repository's own history at `220f99d3` -
  `.planning/phases/2/REVIEW-risk_surface-plan-1.md` carries the `high` at
  `cadence-core/bin/lib/adjudication-record.mjs:460`, and
  `.planning/phases/2/ADJUDICATION-risk_surface-plan-1-r2.json` rules it
  `survived` with `fix_commit` `3341ffb0` (in `v3.7.6..v3.7.7`).
  `.planning/config.json` sets `git.auto_close: true`, so this repo is on the
  halting arm. Phase 2 has NO round-1 record, only `-r2.json`, so the fixture
  carries that shape and a synthesized one would not.
- D-15 (the prose that moves): four files state the union and all move with
  the code, with `cadence-core/bin/weight-budgets.json` re-pinned in the SAME
  commit - `skills/cad-land/SKILL.md:122-138`,
  `cadence-core/workflows/milestone.md:106-115` and `:242-244`,
  `cadence-core/references/risk-surface.md:169-190`,
  `cadence-core/references/triage-gate.md:339-348`. Budgets are pinned at
  `weight-budgets.json:43,45,51,72,100`. Phase 3's D-07 is the precedent: a
  one-byte addition without the re-pin turns `self-verify` red with a
  `budget-overrun`.
- D-16 (the contract comment): `cadence-core/bin/land-cleanup.mjs:34-40` is
  the comment criterion 2 names, and it is the only statement in code of
  where the gate's input comes from (a grep over `bin/` returns only this
  file and test fixtures). It is rewritten to state the adjudicated input.
- D-17 (line-pinned linters):
  `cadence-core/bin/citation-census.test.mjs:207-209` filters to
  `planning.mjs` / `planning/`, so the workflow and skill rows this phase
  edits are NOT line-pinned - but a carry implemented inside
  `cadence-core/bin/planning/milestone-prune.mjs` or a new `planning/` module
  shifts one of the four pinned rows at `:217-247`. That is the break phase
  1's SUMMARY recorded for `planning/trace.mjs`.
- D-18 (a new flag costs a row): if the carry or the gate gains a flag, it
  needs a `cadence-core/bin/lib/arg-contract.mjs` row and moves the
  `arg-contract-flag-entries` census
  (`cadence-core/bin/lib/census-registry.mjs:132-138`). Reading it
  positionally is the defect `helper-census.test.mjs`'s first row exists to
  catch.

## Acceptance criteria

- [ ] AC1: The v3.7.7 close is reproduced as a fixture from `220f99d3`. Fed
      the phase-2 REVIEW plus `ADJUDICATION-risk_surface-plan-1-r2.json`,
      `land-cleanup.mjs gate` under `auto_close` does not halt on the
      already-fixed `high` (`adjudication-record.mjs:460`, `fix_commit`
      `3341ffb0`); the same entry with `fix_commit` removed returns
      `action: "halt"`.
- [ ] AC2: `cadence-core/bin/helper-census.test.mjs` carries a row whose
      body-idiom regex over every `.mjs` under `cadence-core/bin/` matches
      exactly one definition of the genuinely-unfixed test, and pasting a
      second copy of that body into any file reddens it.
      `cadence-core/bin/lib/close-decision.mjs`'s inline
      `'blocker' || 'high'` literal no longer appears.
- [ ] AC3: A `REVIEW-risk_surface-*.md` with no sibling
      `ADJUDICATION-*.json` produces a fifth state reported by name in the
      gate's output, and `action: "halt"` under `auto_close`.
- [ ] AC4: `stdin-unreadable`, `stdin-empty`, `malformed-json` and
      `not-a-findings-payload` are unchanged and each still halts under
      `auto_close` - `cadence-core/bin/close-decision.test.mjs`'s
      `UNREADABLE` list passes with no edit to it.
- [ ] AC5: An entry with `overridden: true` and no `fix_commit` appears by
      name on the gate envelope with `action` unchanged; an entry carrying
      both `overridden: true` and a `fix_commit` appears nowhere in that
      surfacing and does not halt.
- [ ] AC6: Running `milestone-prune.mjs --mode delete` over a fixture leaves
      the carried `ADJUDICATION-*.json` readable at the carry destination,
      and `gate` returns the identical halt decision before and after the
      prune. `cadence-core/bin/land-cleanup.mjs:34-40` states what the gate
      reads and where it comes from.
- [ ] AC7: `node cadence-core/bin/test.mjs` is green and
      `node cadence-core/bin/self-verify.mjs` reports `ok:true`, with
      `cadence-core/bin/weight-budgets.json` re-pinned in the same commit for
      every prose file whose byte count changed.

## Flagged assumptions

- The `(file, line)` join D-02 rejects would in fact have been unambiguous on
  today's corpus (6/6, zero collisions) - D-02 rests on the RISK of two
  voices citing one line, not on a measured collision - Likely; if wrong,
  the entries-only union is more conservative than it needed to be, which
  costs nothing but forecloses a cheaper carry.
- The carry destination for the records is `/cad-land`'s existing carried-copy
  location rather than a new one - Likely
  (`cadence-core/bin/land-cleanup.mjs:36-40` names
  `.planning/REVIEW-risk_surface-*.md` as the carried form); if wrong, the
  planner picks the destination and AC6's "carry destination" resolves there
  instead.
- A body-idiom regex can express the four-field genuinely-unfixed test
  tightly enough to match one definition and no near-miss - Likely
  (`helper-census.test.mjs:53-140` shows six rows doing this for smaller
  idioms); if wrong, AC2 falls back to the two-face agreement test at
  `cadence-core/bin/adjudication-record.test.mjs:459-524` plus a
  `census-registry.mjs` row, and criterion 1's proof is weaker.
