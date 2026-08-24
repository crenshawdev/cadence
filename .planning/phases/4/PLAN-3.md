---
phase: 4
plan: 3
requirements: [LOD-02]
files:
  - cadence-core/bin/citation-census.test.mjs
  - .planning/REQUIREMENTS.md
  - skills/cad-verifier-contract/SKILL.md
  - .planning/DOCS-CLAIMS.md
  - .planning/phases/4/READ-COST.md
---

# Phase 4: Split planning.mjs by command - Plan 3 (citations and the measurement)

## Goal

Every citation that instructs someone points at the code it names after the
split, pinned by a census so a stale one fails the suite naming it, and the read
cost the split bought is measured rather than asserted.

## Must be true when done

- A reader following any `planning.mjs:<line>` citation on an instruction
  surface lands on the code that citation describes.
- A new or edited citation on those surfaces that names the wrong place fails
  `node cadence-core/bin/test.mjs`, and the failure message names the file and
  the citation.
- The four `.planning/DOCS-CLAIMS.md` rows whose `doc` cell is
  `cadence-core/bin/planning.mjs` name the file and the range that now carry
  their claim.
- `.planning/_archive-v*` and `.planning/trace.jsonl` are byte-unchanged.
- The phase can state, from `wc -c` output rather than from a claim, what
  reaching a median handler and the worst-case handler cost before the split and
  what it costs after.

## Context

- D-04: the census pins BOTH citation grammars over LIVE surfaces only - inline
  `planning.mjs:<line>`, and `.planning/DOCS-CLAIMS.md`'s separate line-range
  column. The archived citations under `.planning/_archive-v*` and the two in
  `.planning/trace.jsonl` are not rewritten; `self-verify.mjs`'s check 15 states
  the precedent - "a tree-wide guard would land red on a record no one may
  rewrite".
- Three counts are in play and they do NOT contradict each other; the census
  ENUMERATES rather than trusting any of them. D-04 records 26 live inline
  occurrences across 4 files, counted over all four of AC3's original roots. The
  planner re-measured that same set on 2026-08-24 and found 20 across 5 files,
  so the D-04 figure is already stale as a count. AC3 was then amended after the
  plan review to guard only the surfaces that INSTRUCT, which is where the 3 this
  task repoints comes from. If the walk finds a number other than 3, that is the
  finding - update the table and say so in the SUMMARY; do not force the count.
- Applying that same test to the rest of `.planning/` (planner's reading,
  recorded in Notes): the guarded set is the surfaces that INSTRUCT - `skills/`,
  `cadence-core/workflows/`, `cadence-core/references/`, `REQUIREMENTS.md`'s
  `## Active` section and `DOCS-CLAIMS.md`. `ROADMAP.md`, `ARCHIVE.md`,
  `REQUIREMENTS.md`'s `## Shipped` rows and the `phases/*/` records are records,
  not instructions, and one of them - `ROADMAP.md` - the executor contract
  forbids writing at all.
- D-13: the measurement records the MEDIAN handler and the WORST case, both.
  Measuring only a 16-line handler would report a cut no real dispatch
  experiences, which is the self-claim defect `seam-calls.test.mjs:11-16` names.
- Runs after plans 1 and 2, and shares no file with either.

## Tasks

### Task 1: Pin and repoint the inline citations

- **Files:** cadence-core/bin/citation-census.test.mjs,
  .planning/REQUIREMENTS.md, skills/cad-verifier-contract/SKILL.md
- **Action:** Create `cadence-core/bin/citation-census.test.mjs`, a new stem that
  walks the guarded instruction surfaces - `skills/`,
  `cadence-core/workflows/`, `cadence-core/references/`, and the `## Active`
  section of `.planning/REQUIREMENTS.md` bounded by the existing `sectionBound`
  helper from `lib/planning-files.mjs` - extracts every citation of the form
  `<path>planning.mjs:<line>` or `<path>planning/<module>.mjs:<line>` (a bare
  range `123-456` included), and checks each against a table declared in the test
  file: the surface it appears in, the citation as written, and the SYMBOL the
  cited line or range must carry. The check is to open the cited file, take the
  cited line or the first line of the cited range, and assert the text there
  names that symbol - a citation that merely lands inside the file proves
  nothing, since planning.mjs still has a line 343. Assert the extracted set and
  the declared table have the same members, so a citation added to a guarded
  surface without a row fails as unpinned and a row whose citation was deleted
  fails as dead. State the guarded set and its two exclusion reasons in the
  file's header comment.
  Then repoint the three live citations the walk finds, so the table describes
  the tree: `skills/cad-verifier-contract/SKILL.md`'s
  `cadence-core/bin/planning.mjs:670-675`, and in `REQUIREMENTS.md`'s `## Active`
  section, SPL-01's `cadence-core/bin/planning.mjs:343` for `PHASE_DIR_NAME` and
  SPL-02's `planning.mjs:278` for `phaseSpellingRefusal`. SPL-02's sentence also
  carries two SHORTHAND line references in the same breath - `cursor set`
  (`:612`) and `seed-reqs` (`:2586`) - which the two declared grammars do not
  match; rewrite them anyway, in the same edit, or phase 3 reads its own
  requirement and goes to two addresses that no longer hold what it is told to
  wire. Leave the byte and line MEASUREMENTS in LOD-02 alone: they describe the
  file the requirement was written against and are the evidence for the split,
  not a pointer into today's tree.
  Do not add this stem to `cadence-core/bin/test.mjs`'s `GROUPS`: an undeclared
  stem lands in `other`, which the default run and the CI matrix both execute
  (D-08), and `test.mjs` is plan 2's file.
- **Verify:** `node --test cadence-core/bin/citation-census.test.mjs` passes;
  editing any one cited line number by hand makes it fail with a message naming
  that file and citation, and reverting makes it pass again; `node
  cadence-core/bin/test.mjs 2>&1 | grep -E '^ℹ (tests|pass|fail)'` reports the
  new stem's arms added to the total with `fail 0`; `git status --porcelain
  .planning/_archive-v* .planning/trace.jsonl` prints nothing.

### Task 2: Pin and repoint the DOCS-CLAIMS line-range column

- **Files:** cadence-core/bin/citation-census.test.mjs,
  .planning/DOCS-CLAIMS.md
- **Action:** Add the second grammar to the census: parse `DOCS-CLAIMS.md`'s
  claim table, take every row whose `doc` cell is a path under
  `cadence-core/bin/` naming this seam, read that row's own line-range cell, and
  hold it to the same rule as grammar one - the cited range must carry the symbol
  the row's declared anchor names. This grammar is invisible to a
  `planning.mjs:<line>` grep, which is why it needs its own arm rather than a
  wider regex (D-04).
  Then repoint the four rows. Each names a claim, and the claim's subject moved:
  `EXECUTE-10` is `lease-check`'s whole-index read and its `undeclared-files`
  refusal, `EXECUTE-22` is `trace ignore` writing the gitignore line,
  `VERIFY-11` is `uat init` writing `fields_version` before it looks at an item,
  and `VERIFY-12` is the legacy fieldless-checklist rule that `LEGACY_REASON`
  states. Their present ranges were accurate at the v2.6.0 sweep and address a
  file that has moved under them twice since, so re-derive each range from the
  code that carries the claim TODAY rather than by shifting the old numbers. Do
  not touch the verdict cells - the ledger records what a past sweep found, and
  only the location is being corrected.
- **Verify:** `node --test cadence-core/bin/citation-census.test.mjs` passes with
  both grammars exercised, and the test prints how many citations each grammar
  checked (a census whose arm silently matched nothing is a census that can be
  emptied); changing one of the four rows' ranges by hand fails the suite naming
  that row id; `git diff .planning/DOCS-CLAIMS.md` shows only location cells
  changed, no verdict cell.

### Task 3: Measure the read cost the split bought

- **Files:** .planning/phases/4/READ-COST.md
- **Action:** Record the before-and-after cost of reaching one handler, by `wc
  -c`, the same method LOD-02 was measured with. BEFORE is `git show
  22eca08a:cadence-core/bin/planning.mjs | wc -c` - 417,009 bytes, the commit
  this phase branched from - because reaching any single handler in that file
  meant reading the file. AFTER is, for one handler, `wc -c` of the module that
  now holds it PLUS `cadence-core/bin/planning/core.mjs`, because a handler
  cannot be read without the envelope and helpers it calls, and reporting the
  module alone would be the self-claim the measurement exists to avoid.
  Record TWO handlers, not one (D-13): the MEDIAN module by `wc -c` across the 29
  command modules, derived by sorting them and naming the middle one rather than
  chosen, and the WORST case, the largest module by `wc -c`. Name both modules
  and both figures, give the exact commands, and state the ratio for each.
  Add one line on the test surface as it now stands, from the same method:
  `planning.test.mjs` was 418,298 bytes at `22eca08a`, and the file that now
  holds a given command's tests is what a verifier reads instead. This is the
  measurement AC6 asks the SUMMARY to carry, so write it as prose the phase
  SUMMARY can quote verbatim, and keep every figure reproducible by re-running
  the commands beside it.
- **Verify:** Re-running each command written in `.planning/phases/4/READ-COST.md`
  reproduces the figure printed beside it, including `git show
  22eca08a:cadence-core/bin/planning.mjs | wc -c` printing 417009; the file names
  a median module and a worst-case module, and the median one is genuinely the
  middle entry of `wc -c cadence-core/bin/planning/*.mjs | sort -n`.

## Notes

- Two live citation sets are deliberately NOT rewritten and are reported for the
  human instead. `.planning/ROADMAP.md`'s phase 3 entry cites `planning.mjs:278`,
  `:612` and `:2586`, and the executor contract forbids writing `ROADMAP.md`;
  phase 3 will read those numbers, so they want a hand edit before that phase is
  planned. `.planning/ARCHIVE.md`, `REQUIREMENTS.md`'s `## Shipped` rows,
  `.planning/phases/*/` records and `design-notes/sweep-*.md` cite line numbers
  inside quotes of what was true when they were written; rewriting those would
  make a record say something it did not.
- Two `planning.mjs:<line>` citations sit in code comments rather than on an
  instruction surface - `cadence-core/bin/lib/milestone-prune.mjs` and
  `cadence-core/bin/config-seams.test.mjs`. AC3 scopes the census to `skills/`,
  the two `cadence-core/` doc directories and `.planning/`, so they are out of
  this plan; they are named here so the omission is a decision on the record
  rather than a miss.
- The suite carries one pre-existing failure unrelated to this phase
  (`milestone-prune.test.mjs:557`, the live-corpus arm); plan 2's Notes state it
  in full.
