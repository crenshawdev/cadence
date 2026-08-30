---
phase: 4
plan: 1
requirements: [LND-02]
files:
  - cadence-core/bin/lib/filing-decision.mjs
  - cadence-core/bin/filing-decision.test.mjs
  - cadence-core/bin/issue-filing.mjs
  - cadence-core/bin/issue-filing.test.mjs
  - cadence-core/bin/helper-census.test.mjs
  - cadence-core/bin/adjudication-record.test.mjs
  - cadence-core/bin/planning-adjudication.test.mjs
  - cadence-core/bin/self-verify.test.mjs
---

# Phase 4: Land reads rulings, not raw findings - Plan 1 of 4

## Goal

`lib/filing-decision.mjs` owns the whole meaning of genuinely-unfixed - the
ruling, the raised severity, the `overridden` marker and the `fix_commit` - and
answers in one pass which entries a close must halt over, so the gate in Plan 2
can ask that question instead of restating it.

## Must be true when done

- One pass over a record's `entries[]` answers three sets, and an entry naming a
  usable fix commit is in none of them.
- An entry carrying BOTH `overridden: true` and a `fix_commit` counts as fixed:
  the fix commit wins, and that entry is not on the overridden list.
- `issue-filing.mjs` no longer filters `fix_commit` at its own call site, and
  what reaches the forge is unchanged - an already-fixed `medium` is still not
  filed.
- Pasting a second copy of the genuinely-unfixed test body into any `.mjs` under
  `cadence-core/bin/` turns `helper-census.test.mjs` red, naming both files.
- The entries face and the payload face still return the identical answer over
  one fixture, now including entries that name a fix commit.
- A reasonless settle receipt over a record whose only cleared halt ALSO names a
  fix commit is accepted, instead of being refused with a detail that says
  "STOOD with no fix commit" about an entry that did not.

## Context

Locked: D-04 (the `fix_commit` exclusion MOVES into `filing-decision.mjs`;
`issue-filing.mjs:278`'s `selected.findings.filter((e) => !e.fix_commit)`
retires), D-05 (`fix_commit` beats `overridden` on one entry), D-10 (criterion
1's proof is a `helper-census.test.mjs` row, not an import count and not the
two-face agreement test alone).

These four plans are SEQUENTIAL: Plan 1, then 2, then 3, then 4. Plan 2 binds to
the name this plan gives the third answer, Plan 3 builds the carry seam, and
Plan 4's prose describes both. Do not run them in parallel.

Names fixed here so Plan 2's caller binds to one spelling: the third answer is
`halting`.

## Tasks

### Task 1: Teach the predicate the fix commit, and give it a third answer

- **Files:** cadence-core/bin/filing-decision.test.mjs,
  cadence-core/bin/lib/filing-decision.mjs (start at `unfixedFromEntries`)
- **Action:** `unfixedFromEntries` reads a FOURTH field, `fix_commit`, and
  returns a THIRD array named `halting` beside `filing` and `haltingSurvivors` -
  the entries that STOP a close: `survived` at a `HALTING_SEVERITIES` level, not
  overridden, and naming no usable fix commit. Answer all three in the ONE
  existing loop; a second pass is a second statement of the test. An entry that
  names a usable fix commit is FIXED and belongs to none of the three - not
  `filing` (the work is committed, so there is nothing to ask a user about), not
  `haltingSurvivors`, not `halting` - and that holds even when the same entry
  also carries `overridden: true`, because the schema permits both on one entry
  (`lib/adjudication-record.mjs:472-473` refuses only when NEITHER is present)
  and leaving the precedence to filter statement order is how one entry becomes
  a permanent unfixed override at every close. "Usable" here means a non-blank
  string and nothing more: `lib/adjudication-record.mjs` already refuses a
  malformed value at composition time, and this module's stated discipline is
  that unknown input never throws, so do not re-validate the value or call
  anything to check it. Keep `filing` and `haltingSurvivors` returning what
  their names say; `haltingSurvivors` simply stops holding the entries that name
  a commit. Rewrite the docblock paragraph that currently states `fix_commit`
  "IS STILL NOT ONE OF THE FIELDS" and delegates the removal to
  `bin/issue-filing.mjs`'s face - that split is what this task ends. Say in the
  comment what `halting` actually is, because it is not obvious and a reader
  will otherwise take it for dead code: `buildEntries` REFUSES a `survived`
  blocker/high carrying neither a `fix_commit` nor the override marker
  (`lib/adjudication-record.mjs:467-470`), so a record that module accepted can
  never hold a `halting` entry - the set is non-empty only over a record
  something else wrote or a person edited, which is exactly the input the gate
  must fail closed on. Two prose constraints bind this file:
  `prose-agreement.test.mjs`'s RSK-07 row requires the phrase "confirmed and not
  fixed" to survive here, and forbids any new sentence saying a `survived`
  finding names its fix commit without naming the severity that gates it.
- **Verify:** `node --test cadence-core/bin/filing-decision.test.mjs` passes
  with six new arms over `unfixedFromEntries`: survived+blocker+fix_commit is in
  none of the three sets; survived+blocker+overridden with no commit is in
  `filing` and `haltingSurvivors` and NOT `halting`; survived+blocker with both
  markers is in none; survived+blocker with neither is in `halting` alone;
  survived+medium+fix_commit is in none; survived+medium with no commit is in
  `filing` alone. `npx tsc -p tsconfig.ci.json` exits 0.

### Task 2: Retire issue filing's own fix-commit filter

- **Files:** cadence-core/bin/issue-filing.test.mjs,
  cadence-core/bin/self-verify.test.mjs,
  cadence-core/bin/issue-filing.mjs (start at `cmdUnfixed`, at `notYetFixed`)
- **Action:** delete the `selected.findings.filter((e) => !e.fix_commit)` line
  and read the set straight off `unfixedFindings`, which now answers it.
  Rewrite the comment above it, which currently states the two-face split as
  deliberate and cites the module's field rule as a property of its signature -
  after Task 1 that sentence is false, and criterion 1 forbids the meaning being
  spelled in two places. Nothing else about this face moves: the set is still
  judged before the forge is touched, since the module answers before
  `resolveForge` runs, and no envelope key changes.
  `cadence-core/bin/self-verify.test.mjs` is in the lease because it holds the
  `self-verify-merge-layers` census whose subject list names this file; leave
  its count alone unless this edit adds or removes a `mergeLayers` callsite,
  which it must not.
- **Verify:** `node --test cadence-core/bin/issue-filing.test.mjs` is green with
  no arm deleted, including the existing case where a `medium survived` naming
  commit `4a1af326` is still excluded from what is filed;
  `grep -n "fix_commit" cadence-core/bin/issue-filing.mjs` returns no filter
  expression; `node --test cadence-core/bin/self-verify.test.mjs` green.

### Task 3: Pin the one definition with a census row

- **Files:** cadence-core/bin/helper-census.test.mjs
- **Action:** add a row to `HELPERS` naming the genuinely-unfixed test, with
  `home` `lib/filing-decision.mjs`, whose `re` matches the BODY IDIOM of the
  four-field test rather than any export name - the discipline every other row
  in that file follows, and what makes a paste-back under a new name fail. Build
  the pattern from an escaped string so this file does not match its own rule,
  which the header at the top of that file states as a requirement rather than a
  style: the census walks every `.mjs` under `cadence-core/bin/`, this file
  included, and a literal here would need an exclusion list to undo. Anchor on
  the half that distinguishes this test from every other severity check in the
  tree - the ruling-plus-halting-severity conjunction reaching the override
  marker - and check by running the suite that it does NOT also match
  `lib/adjudication-record.mjs`'s composition-time presence rule, which is a
  different question over different receivers. Write the `note` so a contributor
  who trips it is told to import the module. Do NOT add a `lib/census-registry.mjs`
  row: this table's own length is never asserted (that module's header says so),
  helper-census rows are not censuses, and a row there would put the registry
  inside its own table.
- **Verify:** `node --test cadence-core/bin/helper-census.test.mjs` is green and
  the new arm reports the definition found in exactly one file. Then paste the
  matched body into a second `.mjs` under `cadence-core/bin/`, re-run, see the
  new arm fail naming both files, and revert - the redden-on-demand is the
  proof, not the green run.

### Task 4: Prove both faces still agree, and that a fixed override stops tripping the settle guard

- **Files:** cadence-core/bin/adjudication-record.test.mjs,
  cadence-core/bin/planning-adjudication.test.mjs
- **Action:** extend the existing two-face agreement test in
  `adjudication-record.test.mjs` (the one driving one fixture through
  `unfixedFromEntries` and `unfixedFindings` and asserting the sets deep-equal)
  so the fixture also carries an entry naming a fix commit and an entry carrying
  both markers, and assert the payload face's `findings` still equals the entries
  face's `filing` over it. In `planning-adjudication.test.mjs`, add one arm
  beside the existing `RSK-08: a REASONLESS receipt over a record holding a
  cleared halt is refused` test, using that file's own `survivedPayload` helper
  with BOTH `overridden: true` and a usable `fix_commit`: the reasonless
  `gate_pass` receipt is now ACCEPTED, because `overrideAccounted` reads
  `haltingSurvivors` and that entry is no longer one of them. Do not edit
  `cadence-core/bin/planning/trace.mjs`: its refusal detail already reads "STOOD
  with no fix commit", and this change makes that sentence true rather than
  false - it is the open item phase 1's SUMMARY filed against
  `filing-decision.mjs` and closes as a consequence, not as new work. The
  existing reasonless-receipt refusal over a record with NO fix commit must
  still refuse, unedited.
- **Verify:** `node --test cadence-core/bin/adjudication-record.test.mjs
  cadence-core/bin/planning-adjudication.test.mjs` green, with the pre-existing
  refusal arm still failing the commit-less record and the new arm accepting the
  fixed one; `node cadence-core/bin/test.mjs` green and
  `node cadence-core/bin/self-verify.mjs` reports `ok:true`.

## Notes

- Structural consequence worth stating once, and carried into Plan 2: because
  `buildEntries` refuses a `survived` blocker/high that names neither a fix
  commit nor the override marker, a VALID adjudication record can never contain
  a `halting` entry. Every ruled outcome now resolves to fixed, overridden,
  downgraded, refuted or below-halting. `halting` is therefore a fail-closed
  rail over input the gate never validated - a hand-edited record, a foreign
  writer, an older artifact - and not the ordinary path. The phase goal names
  exactly that set of rulings, so this is the goal being met rather than a hole,
  but it means the close's remaining real halts are the four unreadable states
  and Plan 2's fifth one.
- The third answer's name (`halting`) is the planner's choice, recorded here
  because Plan 2 binds to it. It is deliberately not `haltingSurvivors`, which
  already holds the OVERRIDDEN subset - two near-identical names for opposite
  dispositions is exactly the confusion the docblock has to prevent.
