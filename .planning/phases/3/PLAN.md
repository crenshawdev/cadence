---
phase: 3
plan: 1
requirements:
  - RSK-06
files:
  - cadence-core/bin/planning/risk-check.mjs
  - cadence-core/bin/risk-diff.test.mjs
  - cadence-core/references/risk-surface.md
  - cadence-core/bin/weight-budgets.json
  - cadence-core/bin/self-verify.test.mjs
  - cadence-core/bin/trace.test.mjs
  - cadence-core/bin/planning-lease-check.test.mjs
  - cadence-core/bin/phase-spelling.test.mjs
---

# Phase 3: Stop the risk detector tripping on the review record - Plan

## Goal

`ADJUDICATION-*.json` holds verbatim `failure_scenario` strings by design, so
any phase that adjudicates a finding quoting `rm -rf` or `DROP TABLE` re-trips
the destructive category on the docs commit that lands the record. A user
reviewing their own work should not have to override a gate to file what the
gate found.

## Must be true when done

- `risk-check run` over a range whose only destructive text sits inside a
  `.planning/phases/<N>/` adjudication record, review file, `FINDINGS.json` or
  `verifier-findings.json` answers `matches: []`, `checked: true` and
  `empty: false` when the range also changed a file outside that set.
- The same destructive text in a `.mjs` file in that same range still trips the
  destructive category, and the `signal` string names the construct on the
  `.mjs` line rather than the one inside the withheld record.
- A `.planning/phases/<N>/PLAN.md` carrying a destructive command still trips
  the destructive category: the withholding covers the four record artifacts and
  nothing else under `.planning/`.
- The four withheld path shapes are one exported constant in
  `cadence-core/bin/planning/risk-check.mjs`, and the suite exercises whatever
  that constant holds - a fifth entry added there is covered without editing a
  list inside the test.
- `risk-check run --base f70a0443 --head cf2571b8 --surfaces destructive`, the
  range this repository actually settled with an override, reports
  `matches: []` with `checked: true` and `empty: false`.
- `cadence-core/references/risk-surface.md` states which artifacts the seam's
  range read withholds and why a plan file is not among them.
- `node cadence-core/bin/test.mjs` is green and
  `node cadence-core/bin/self-verify.mjs` reports `ok:true`, with
  `weight-budgets.json` re-pinned to `risk-surface.md`'s new size.

## Context

CONTEXT.md's decisions bind this plan and are implemented exactly. D-01: the
exclusion is a git PATHSPEC at the `git diff` call site in
`cmdRiskCheckRun` (`cadence-core/bin/planning/risk-check.mjs:215`), and
`cadence-core/bin/lib/risk-diff.mjs` is NOT touched - that file states three
times (`:424-433`, `:464-470`, `:500-505`) that its exemptions are scoped to
`scanDeclared` and deliberately not to `scanDiff`, whose rule is "the fix is at
the MENTION, never a path or filename exemption". D-02: all FOUR artifacts, not
`ADJUDICATION-*.json` alone as ROADMAP criterion 1 names. D-03: the exclusion is
by PATH only, so every signal table and every code path is untouched. D-04: the
four pathspecs live in ONE named constant the test reads, never a second
spelling. Out of scope by the same file: widening to all of `.planning/`, and
any change to how adjudication records store reviewer text.

Two facts read out of the tree bind the tasks. The argv at
`risk-check.mjs:215` already ends in `'--'` for a stated reason (a ref that also
names a path cannot become a pathspec), so the exclusions append after it and
nothing before it moves. And `cadence-core/references/risk-surface.md` is 9785
bytes against a `weight-budgets.json` entry of 9785 - a ceiling with zero
headroom, so the task that adds a sentence to it re-pins that entry or
self-verify's `budget-overrun` arm fails.

Three measurements taken during planning, each of which a task depends on.
`.planning/phases/1/ADJUDICATION-risk_surface-plan-1.json` is the ONLY source of
a destructive match in `f70a0443..cf2571b8`; feeding that range's diff to
`scanDiff` with the four pathspecs applied returns
`{checked:true, matches:[], inconclusive:false, empty:false}`. `signalIn`
(`lib/risk-diff.mjs`) iterates a category's patterns OUTER and its lines inner,
and the destructive list runs `rm -rf` first and `git reset --hard` fifth, so a
range where the withheld record carries the first and a `.mjs` carries the fifth
reports a DIFFERENT `signal` string before and after this phase. And destructive
has no entry in `SEGMENT_SIGNALS`, `FILE_SIGNALS` or `EXT_SIGNALS`, so a fixture
path can never contribute a destructive match - only its changed lines can.

## Tasks

### Task 1: Withhold the four stored-reviewer-text artifacts from the range the gate reads

- **Files:** cadence-core/bin/planning/risk-check.mjs (module scope beside
  `surfaceVocabulary`, and the `execFileSync('git', ...)` read inside
  `cmdRiskCheckRun`)
- **Action:** Add one frozen, EXPORTED module-scope constant holding four git
  pathspecs, and append it to the argv of the `git diff` read that already ends
  with `'--'`. Nothing before that `'--'` moves: `-C range.top`, the resolved
  `baseId`/`headId`, `--no-ext-diff` and `--no-textconv` all stay exactly as
  they are, and the pathspecs go AFTER the separator so the rule that comment
  states - a ref that also names a path cannot turn into a pathspec - still
  holds for the new arguments too.
  The four entries, each carrying `:(top,exclude)` magic:
  `.planning/phases/*/ADJUDICATION-*.json`,
  `.planning/phases/*/REVIEW-*.md`,
  `.planning/phases/*/FINDINGS.json`,
  `.planning/phases/*/verifier-findings.json`. All four are D-02, which
  deliberately widens ROADMAP criterion 1's `ADJUDICATION-*.json`: each holds
  verbatim reviewer prose by design and trips for the identical reason, so
  excluding one leaves the same gate firing on the other three the next time a
  reviewer quotes a destructive command. The `top` half of the magic is not
  decoration - it anchors the pathspec to the working tree root rather than to
  the process cwd, and it was verified from a subdirectory during planning. The
  `:!` shorthand is available and is not used, because the long form says which
  two magics are in play at the site a reader will be deciding whether to widen.
  The constant is exported so the test can drive itself off the same list the
  code uses (D-04) - a second spelling of the four at the call site or in the
  test is how the list and its test drift apart. Name it for what it holds; this
  plan refers to it as `REVIEWER_TEXT_PATHSPECS` and task 3 imports whatever
  name this task chooses. `planning/risk-check.mjs`'s own header states the
  organizing rule this follows (D-05): a constant this family reads and nothing
  else travels with the family rather than moving to `planning/core.mjs`.
  Comment the constant with the three things a later reader will otherwise
  re-derive. First, WHY this is a pathspec and not an exemption inside
  `scanDiff`: `lib/risk-diff.mjs:424-433`, `:464-470` and `:500-505` each state
  that the `scanDeclared` exemptions are scoped to that face and deliberately
  not to `scanDiff`, because `scanDiff` reads a HUNK where a match is a line
  someone actually added, and its rule is that the fix is at the MENTION and
  never a path or filename exemption. Withholding the file from the DIFF honours
  that rule instead of bending it: `scanDiff` never receives the hunk, so its
  face is unchanged and no signal leaves the table (D-03). Second, WHY the scope
  stops at these four filename shapes under `.planning/phases/` rather than
  covering `.planning/`: a destructive command written into a PLAN.md Action is
  the text an executor is handed to run, so a plan file stays scanned. Third,
  what the exclusion does to `empty`. A range whose only changed files are all
  withheld now reads `empty: true` - the scanned range held nothing, rather than
  the range itself being empty - and that answer still clears as a COMPLETED
  check, which is the arm `risk-check status` already treats as recorded. Do NOT
  take a second unexcluded `git diff` to keep `empty` meaning what it meant
  before: that doubles the read on every gate fire to make one boolean narrower,
  and no decision in CONTEXT.md asks for it.
  Avoid touching `cadence-core/bin/lib/risk-diff.mjs` at all - D-01 makes that
  file's face the thing this phase must not move - and avoid deriving the
  pathspecs from the seam's `dir` argument: D-02 names paths under
  `.planning/phases/`, and a `.planning` directory that is not at the repository
  root is a case no decision here covers.
- **Verify:** Three checks, and the first two must have opposite answers before
  and after this task.
  (a) In a scratch git repository outside this tree, commit one
  `.planning/phases/1/ADJUDICATION-x.json` whose body quotes a recursive delete
  and one unrelated text file in the same commit, then run
  `node cadence-core/bin/planning.mjs --dir <scratch>/.planning risk-check run --phase 1 --plan 1 --base <base> --head <head> --surfaces destructive`
  from inside that repository: the JSON line reads `"matches":[]` with
  `"checked":true` and `"empty":false`. Before this task the same command
  reports a destructive match.
  (b) From `/code/cadence`, with `<scratch>` a directory outside this
  repository so no record lands in this project's trace:
  `node cadence-core/bin/planning.mjs --dir <scratch> risk-check run --phase 3 --plan 1 --base f70a0443 --head cf2571b8 --surfaces destructive`
  prints `"matches":[]`, `"checked":true`, `"inconclusive":false`,
  `"empty":false`. That is the range `.planning/trace.jsonl` records as the one
  settled with an override on 2026-08-24; before this task the same command
  reports `{"category":"destructive","signal":"changed line: an \`rm -rf\`"}`.
  (c) The same command with `--head 7a8a449a` STILL reports a destructive match,
  and
  `git diff --no-ext-diff --no-textconv f70a0443 7a8a449a -- | awk '/^diff --git/{f=$3} /^\+/ && /rm -rf/ {print f}'`
  names `.planning/ROADMAP.md` and `cadence-core/references/risk-surface.md` and
  no record artifact. Paste that output into the task's report: it is the
  evidence that CONTEXT.md's AC4 head is the wrong commit, not that the fix is
  incomplete. See Notes.

### Task 2: Redden the pre-fix tree with the clear and with detection surviving it

- **Files:** cadence-core/bin/risk-diff.test.mjs (the `risk-check run` seam
  section, beside the `diff DRIVER` row that already uses `DESTRUCTIVE_LINE`)
- **Action:** Add exactly two `test()` rows, one concern each, in this file's
  one-row-per-test style - a table asserted inside a single `test()` with a
  sequential loop reports the loop's count and not the rows', which is the
  hazard that rule exists for. Both rows use the existing `riskRepo`,
  `commitFile`, `riskCheck` and `riskRecords` helpers and the existing
  `DESTRUCTIVE_LINE` constant.
  ASSEMBLE every destructive construct the fixtures carry, the way
  `DESTRUCTIVE_LINE` and `JWT_CALL` already are. This file is its own detector's
  corpus: the census row near the bottom feeds a whole-file add of it to
  `scanDiff` and asserts zero matches under both scopes, so a destructive
  command spelled plainly anywhere in this file reddens that row instead.
  Row one, the clear (AC1). A range that commits a
  `.planning/phases/1/ADJUDICATION-<something>.json` whose stored reviewer text
  quotes `DESTRUCTIVE_LINE`, AND a second file outside the withheld set that
  carries nothing risky, answers `ok:true`, `checked:true`, `matches:[]`,
  `inconclusive:false` and `empty:false`. Assert `empty` explicitly and say in
  the row's comment why: the second file is what makes the answer a completed
  clear rather than a read of an empty range, and a fixture that committed the
  record alone would assert a different thing. Assert the RECORD as well as the
  envelope through `riskRecords`, the way the `diff DRIVER` row does - exactly
  one `risk_check` line, its `matches` empty and its `empty` false - because
  that record is what `risk-check status` and every later reader join on.
  Row two, detection unweakened (AC2, D-03). The SAME range shape, with a
  `.mjs` file added to it whose changed line carries a DIFFERENT destructive
  construct from the one inside the record: the record keeps `DESTRUCTIVE_LINE`
  (the `rm -rf` pattern, first in the destructive list) and the `.mjs` line
  carries a destructive git command (the `git reset --hard` shape, fifth in that
  list). Assert `matches` is exactly one entry, category `destructive`, and that
  its `signal` names the destructive git command. That is what makes this row
  fail against the pre-fix tree rather than merely pass after it:
  `signalIn` tries a category's patterns in order and returns on the first that
  any changed line matches, so before this phase the withheld record's `rm -rf`
  line answers first and the `signal` reads `an \`rm -rf\``. State that
  mechanism in the row's comment - without it the row looks like an arbitrary
  assertion about a string, and the next editor loosens it to a category check
  and silently gives up the pre-fix failure.
- **Verify:** `node --test cadence-core/bin/risk-diff.test.mjs` passes, the
  census row included. Then `git stash` task 1's change to
  `planning/risk-check.mjs` (or revert the pathspec argument by hand) and re-run
  that file: BOTH new rows FAIL, row one on `matches` and row two on `signal`.
  Restore task 1's change and re-run: green. A row that passes in both states is
  not this task's row and must be rewritten before the commit.

### Task 3: Cover every withheld shape, and prove a plan file is not one

- **Files:** cadence-core/bin/risk-diff.test.mjs (immediately after task 2's
  rows)
- **Action:** Add the coverage rows that make AC3 checkable, importing the
  constant task 1 exported from `./planning/risk-check.mjs` rather than
  re-spelling its contents anywhere in this file (D-04). This is the first
  import of a `planning/` command module into a test in this tree; it is an ESM
  module of definitions with no top-level side effects, and only
  `cadence-core/bin/planning.mjs` imports it today.
  Four rows, one per artifact shape, each using a REAL filename of that shape
  taken from this repository's own tree so the row proves the glob matches what
  the workflows actually write, not just what the glob was written against:
  `ADJUDICATION-risk_surface-plan-1.json`, `REVIEW-risk_surface-plan-1.md`,
  `FINDINGS.json` and `verifier-findings.json`, each committed under
  `.planning/phases/1/` with an assembled destructive construct in its body and
  one unrelated non-risky file beside it in the same commit. Each row asserts
  `matches:[]` with `checked:true` and `empty:false`.
  One row for the boundary: a `.planning/phases/1/PLAN.md` committed in the same
  shape, carrying the same assembled destructive construct, DOES trip - `matches`
  is one entry of category `destructive`. Say in that row's comment why the
  boundary is where it is: a destructive command written into a plan's Action is
  the text an executor is handed to run, so a plan file is scanned and the
  withholding is not "documentation under `.planning/`".
  One row that closes the drift door: iterate the imported constant, derive a
  concrete path from each entry by stripping the `:(top,exclude)` prefix and
  substituting a literal for each `*`, commit that file with an assembled
  destructive construct plus one unrelated file, and assert each range answers
  `matches:[]`. Count the iterations and assert the count equals the constant's
  own length - a DERIVED comparison, both sides read from the tree at run time,
  so it is a measurement and not a hand-written census and it takes no
  `census-registry.mjs` row. Do NOT write a literal `4` anywhere: a typed count
  the code must keep true is a census by `lib/census-registry.mjs`'s own
  definition and would owe a marker and a registry row, and the derived form
  buys the same protection for nothing. What this row is FOR: a fifth artifact
  added to the constant later is exercised by the suite without anyone
  remembering to add a row here.
  Keep every fixture construct assembled, for the census reason task 2 states.
- **Verify:** `node --test cadence-core/bin/risk-diff.test.mjs` passes, the
  census row (`the census: neither this file nor the detector matches the
  detector`) included. Appending a fifth throwaway pathspec to the exported
  constant makes the iterating row run one more time and still pass, and
  DELETING one of the four entries makes the row for that artifact FAIL naming
  it; both edits are reverted before the commit. `node cadence-core/bin/test.mjs`
  is green.

### Task 4: State in the trigger contract what the range read withholds

- **Files:** cadence-core/references/risk-surface.md (the
  `## risk_surface detection` section, the paragraph beginning "maps the range's
  changed PATHS"), cadence-core/bin/weight-budgets.json
- **Action:** That paragraph today says the seam maps the range's changed PATHS
  and its ADDED and REMOVED lines to `{checked, categories, matches,
  inconclusive}`, with no qualification. After task 1 that sentence is false for
  four filename shapes, and this file is the trigger's contract - the place a
  reader goes to find out what the gate reads. Add a short paragraph directly
  after it, in this file's existing voice: reason first, no restatement of the
  seam's arguments, no fenced block.
  It must carry four things. WHICH shapes are withheld, named as the four
  filename patterns under `.planning/phases/` and not as a prose category. WHY:
  those four store reviewer text VERBATIM by design - `references/review-record.md`
  requires a stored restatement to match the reviewer's returned text byte for
  byte - so a docs commit landing a finding that quotes a destructive command
  re-tripped the same gate that found it, and the user had to override a gate to
  file what the gate found. WHERE the boundary is and why: a `PLAN.md` under the
  same directory is NOT withheld, because a destructive command in a plan's
  Action is the text an executor is handed to run, and no file outside
  `.planning/phases/` is withheld at all. And that detection itself is unchanged
  - the withholding is by path, so every category and every signal fires exactly
  as it did, and a range whose only changed files are all withheld reads
  `empty: true` and still clears as a completed check.
  Then re-pin the `cadence-core/references/risk-surface.md` entry in
  `cadence-core/bin/weight-budgets.json` to the byte count
  `node cadence-core/bin/weight.mjs` reports for that surface after the edit. The
  entry is currently 9785 against a file of exactly 9785 bytes, so any added
  sentence overruns it.
- **Verify:** `node cadence-core/bin/self-verify.mjs` reports `ok:true` with no
  `budget-overrun` problem for `cadence-core/references/risk-surface.md`.
  `grep -n 'ADJUDICATION' cadence-core/references/risk-surface.md` shows the new
  paragraph inside the `## risk_surface detection` section, and
  `grep -n 'PLAN.md' cadence-core/references/risk-surface.md` shows the boundary
  stated there rather than left to inference. `node cadence-core/bin/test.mjs`
  is green, the `prose` group included.

## Notes

**AC4's head was amended at the `plan` gate, and this plan already binds the
amended range.** As first written, AC4 asked that `risk-check run` over the FIXED
range `f70a0443..7a8a449a` report no destructive match. Measured during planning, that
range's added `rm -rf` lines are in `.planning/ROADMAP.md:85` - this cycle's own
phase 3 goal, quoting the command it is about - and in
`cadence-core/references/risk-surface.md:131`. Neither is a record artifact and
neither is under `.planning/phases/`, so no exclusion D-02 permits can clear that
range, and widening to reach them would be scope invention against the same
decision. Feeding that range's diff to `scanDiff` with all four pathspecs applied
still returns a destructive match.

The range that was actually overridden is `f70a0443..cf2571b8`, recorded in
`.planning/trace.jsonl` at 2026-08-24T20:13:47Z as
`{"base":"f70a0443","head":"HEAD","head_id":"cf2571b8...","matches":["destructive"]}`.
Its ONLY destructive line is inside
`.planning/phases/1/ADJUDICATION-risk_surface-plan-1.json` - a
`failure_scenario` reading "entering a host such as `forge.example; rm -rf
.planning`" - which is precisely the defect this phase exists to close. With the
four pathspecs applied that range returns
`{checked:true, matches:[], inconclusive:false, empty:false}`. Task 1's Verify
binds that range, which is ROADMAP criterion 3's substance ("the range phase 1 of
an earlier cycle settled with an override no longer needs one") and is AC1's
shape on real history rather than on a fixture. `7a8a449a`, chosen three days
later, sweeps in two unrelated cycles of work. The `plan` gate raised this as a
blocker, adjudication confirmed the measurement, and the user amended
CONTEXT.md's AC4 to name `cf2571b8`; task 1's Verify needs no change, and it
still records what `7a8a449a` reports so the UAT sees both numbers.

**A fifth artifact of the same kind exists and is NOT in scope here.**
`DEFERRED-<trigger>-<discriminator>.json`, written by
`cadence-core/bin/planning/deferred-record.mjs`, stores `findings:
queued.findings` and its own header at line 44 describes that payload as
"verbatim reviewer text with arbitrary quoting". It sits beside the other four in
`.planning/phases/<N>/` and will trip the destructive category for the identical
reason the moment a deferred fire queues a finding that quotes one. D-02 names
four and CONTEXT.md's own flagged assumption anticipates exactly this case, so it
is left out rather than folded in. Adding it later is one entry in the constant
task 1 creates, and task 3's iterating row covers it with no test edit.

**Prior art carried into the tasks.** A v3.5.6 phase 3 UAT item records that a
diff driver cannot present a risky range as empty, because the seam reads with
`--no-ext-diff --no-textconv`; task 1 leaves both flags and the whole prefix of
that argv untouched, and task 2's rows sit beside the row that pins them. The
same UAT records that an empty range answers `checked:true, inconclusive:false,
matches:[], empty:true` and that a failed read answers `checked:false,
inconclusive:true` - all three are still reachable after this change, which is
why task 1 comments the one meaning that shifts (`empty` now describes the
scanned range) rather than adding a field.

**Plan shape:** one plan, as CONTEXT directs. Tasks 2 and 3 share
`cadence-core/bin/risk-diff.test.mjs` and both depend on task 1's export, so no
split was available in any case.
