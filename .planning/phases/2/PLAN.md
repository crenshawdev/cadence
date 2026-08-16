---
phase: 2
plan: 1
requirements: [LSE-01]
files:
  - cadence-core/bin/lib/lease-grammar.mjs
  - cadence-core/bin/lease-grammar.test.mjs
  - cadence-core/bin/lib/planning-files.mjs
  - cadence-core/bin/planning.mjs
  - cadence-core/bin/planning.test.mjs
  - cadence-core/bin/helper-census.test.mjs
  - cadence-core/references/plan-frontmatter.md
  - cadence-core/bin/weight-budgets.json
---

# Phase 2: One reader for the lease grammar - Plan

## Goal

`plan-overlap` and `lease-check` answer questions about the same declared path
through one module, so the pre-flight gate cannot admit a plan pair whose files
the enforcement would then refuse to separate.

## Must be true when done

- On a two-plan phase where plan 1 declares `files: [src/]` and plan 2 declares
  `files: [src/auth.js]`, `plan-overlap --phase <N>` returns a non-empty
  `overlaps`, and that entry's `files` carries `src/` and `src/auth.js` as two
  separate strings. The same holds for `src/` against `src/auth/`.
- `plan-overlap` and `lease-check` both reach containment through one
  `cadence-core/bin/lib/` module's exported predicate; neither carries a local
  `.includes(`- or `.startsWith(`-based comparison over declared paths, and a
  census test reddens when that body idiom is pasted anywhere under
  `cadence-core/bin/`, test files included.
- A plan declaring `./a.txt` or `src//a.txt` is refused with a named diagnostic
  through BOTH doors - the frontmatter `files:` list and a `- **Files:**` task
  line - the diagnostic reaches `plan-overlap`'s `frontmatter_issues`, and the
  spelling reaches neither reader.
- For declarations that were already unambiguous, `lease-check` returns the same
  verdict and the same `staged` and `declared` counts as before the phase, and a
  plan declaring no files is still refused.
- `cadence-core/references/plan-frontmatter.md` states the trailing-slash
  directory-prefix form, that `src/auth` does not license `src/authority.js`,
  and the cases the resolver deliberately does not normalize with their reasons;
  `node cadence-core/bin/self-verify.mjs` reports no budget problem for it.
- There is a commit on this branch where the two failing-capable tests exist and
  the fix does not, at which `node --test cadence-core/bin/planning.test.mjs`
  fails on exactly those two cases and no others.
- At the last commit, `node --test 'cadence-core/bin/*.test.mjs'` and
  `node cadence-core/bin/self-verify.mjs` both exit 0.

## Context

Locked: D-01 (the trailing-slash directory-prefix form IS the grammar, is
documented, and keeps its deliberate non-substring arm), D-02 (`./` and
redundant separators are REFUSED with a named diagnostic on BOTH arms of the
declared-files union, never normalized), D-03 (the module answers TWO questions
over one grammar - `covers(declaration, path)` and the derived
`intersects(a, b) = covers(a, b) || covers(b, a)`), D-04 (a NEW module under
`cadence-core/bin/lib/`, not an addition to `lib/planning-files.mjs`, and no
`CONTRACTS` row is owed because `self-verify.mjs` check 14 is top-level-only),
D-05 (resolution happens at the lease layer, never by rewriting the list
`parsePlanFiles` returns), D-06 (a prefix/exact collision puts BOTH spellings
into `overlaps[].files` as separate strings; the flat string-list shape
survives), D-07 (criterion 1 is enforced by a census test in the
`helper-census.test.mjs` shape, not a new `self-verify.mjs` check), D-08 (only
the DECLARED side is resolved; the staged side already arrives canonical through
`repoRel`), D-09 (the resolver accepts non-path strings without throwing and
without calling them directory leases), D-10 (`plans[].files` and `declared`
keep counting declarations as PARSED), D-11 (the watched FAIL is a RUN RECORD at
an intermediate SHA, not a permanent assertion that the tree is broken), D-12
(the `weight-budgets.json` re-pin rides the same lease as the prose).
The fixtures to build on already exist: `overlapTree` and `leaseRepo` in
`cadence-core/bin/planning.test.mjs`.
Out of scope: symlink resolution, case folding, `..` traversal; widening what a
plan may lease; changing `lease-check`'s verdict for already-unambiguous
declarations; normalizing the staged side; rewriting `parsePlanFiles`' returned
list; a new `self-verify.mjs` check; the `plans[].files` and `declared` count
semantics; phase 1's transport surfaces.

## Tasks

### Task 1: The two defective pairs, as failing-capable cases, committed alone

- **Files:** cadence-core/bin/planning.test.mjs (the `plan-overlap` section,
  beside `overlapTree`)
- **Action:** Add exactly two `node --test` cases against the existing
  `overlapTree` fixture: one where plan 1 declares `src/` and plan 2 declares
  `src/auth.js`, one where plan 1 declares `src/` and plan 2 declares
  `src/auth/`. Each asserts `ok:true`, a non-empty `overlaps` naming
  `['PLAN-1.md', 'PLAN-2.md']`, and that the entry's `files` contains BOTH
  spellings as two separate strings (D-06) - assert containment of each string
  and the length, not a `deepEqual` against an ordering this task has not fixed;
  the ordering is task 2's to settle and pinning it here would make this case
  fail for a second, unrelated reason. Give each case a name naming the pair it
  covers, because the SUMMARY has to record those names. Change NOTHING under
  `cadence-core/bin/planning.mjs` or `cadence-core/bin/lib/` in this task: the
  point of the commit is a tree where the tests exist and the fix does not
  (D-11). Commit this task ALONE and keep the full `node --test` output - that
  run is the phase's watched-FAIL evidence, and the SUMMARY records the SHA plus
  the two case names (AC6).
- **Verify:** At this task's commit, `node --test
  cadence-core/bin/planning.test.mjs` exits non-zero and its TAP summary reports
  `# fail 2`, the two failures being exactly the two cases added here by name.
  `git show --stat HEAD` lists `cadence-core/bin/planning.test.mjs` and nothing
  else.

### Task 2: The lease-grammar module, with `plan-overlap` reading through it

- **Files:** cadence-core/bin/lib/lease-grammar.mjs,
  cadence-core/bin/lease-grammar.test.mjs, cadence-core/bin/planning.mjs
  (`cmdPlanOverlap`)
- **Action:** Add a pure, zero-dependency module at
  `cadence-core/bin/lib/lease-grammar.mjs` (the name is the planner's choice;
  D-04 fixes only the directory) exporting `covers(declaration, path)` and the
  derived `intersects(a, b) = covers(a, b) || covers(b, a)` (D-03). `covers` is
  the one statement of the grammar: a declaration ending in `/` covers any path
  beginning with it, and every other declaration covers only the byte-identical
  path. The non-substring arm is deliberate and load-bearing - `src/auth` must
  never license `src/authority.js`, which `cadence-core/bin/planning.test.mjs`
  already pins in its `lease-check: a declared directory ends in / and matches
  by PREFIX` case. Per D-09 a non-path string (`src/a.rs (edit)`, the annotated
  form the task-line arm unions in) is accepted without throwing and is never
  treated as a directory lease. The module touches no filesystem: symlinks, case
  folding and `..` traversal are OUT of scope and the module header states each
  with its reason - symlink resolution needs filesystem access at gate time
  while `plan-overlap` runs against declarations naming files that may not exist
  yet; case folding's answer depends on the filesystem, so identical
  declarations would resolve differently on two machines; a `..` declaration is
  an out-of-repo-lease defect rather than a spelling disagreement between two
  readers. Follow the module-plus-header convention `lib/require-int.mjs` and
  `lib/deferred-reads.mjs` use - the reasoning lives in the header, not restated
  at each call site. Then replace `cmdPlanOverlap`'s exact-equality intersection
  (`declared[i].files.filter((x) => declared[j].files.includes(x))`) with a
  pairwise walk through `intersects`, collecting into `overlaps[].files` every
  declaration on either side that took part in a match, deduplicated so an
  equality match still contributes ONE string - the shipped single-file
  assertions at `cadence-core/bin/planning.test.mjs` (`src/shared.rs` in three
  places, `shared.txt` in the `--phase 1.10` case) are `deepEqual` against a
  one-element array and several belong to earlier phases' acceptance criteria.
  Keep the flat string-list shape (D-06): no `containments` sibling field, no
  object elements, so `.planning/DOCS-CLAIMS.md` EXECUTE-13 and
  `cadence-core/workflows/execute.md`'s gate step need no edit. Fix the emission
  ORDER: plan i's declarations in declaration order, then plan j's, so the
  output is deterministic across runs. `plans[].files` still counts the parsed
  declarations and `undeclared` still keys off an empty parsed list (D-10). Do
  not touch `parsePlanFiles` here (D-05).
- **Verify:** `node --test cadence-core/bin/lease-grammar.test.mjs
  cadence-core/bin/planning.test.mjs` exits 0, task 1's two cases now passing,
  with a unit table in the new test file covering: exact match, non-match,
  `src/` covering `src/auth.js` and `src/auth/`, `src/auth` NOT covering
  `src/authority.js`, `src/` not covered by `src/auth.js` in the other
  direction, `intersects` symmetric on both of those, and a non-path string
  (`src/a.rs (edit)`) returning a boolean rather than throwing.
  `grep -n "files.includes(x)" cadence-core/bin/planning.mjs` prints nothing.

### Task 3: `lease-check` through the same predicate

- **Files:** cadence-core/bin/planning.mjs (`cmdLeaseCheck`),
  cadence-core/bin/planning.test.mjs
- **Action:** Replace `cmdLeaseCheck`'s local `exact`/`prefixes` split and its
  `prefixes.some((d) => p.startsWith(d))` term with a single call per staged
  path through the module's `covers`, so the two seams cannot disagree about a
  declaration. The block comment above that split states the grammar in prose
  ("A declared path ending in `/` is a directory lease and matches by prefix...
  Substring matching would let `src/auth` license `src/authority.rs`") - move
  that statement into the module header and leave a citation here rather than
  keeping a second copy, which is the divergence this phase exists to close.
  Correct the header comment at the `lease-check` block that already claims "The
  reader is `parsePlanFiles`, the SAME one cmdPlanOverlap uses, so a path the
  pre-flight overlap gate admitted cannot be refused here and vice versa": that
  claim was true of the parse and false of the comparison, and this task is what
  makes it true of both. Everything else in the seam stays exactly as it is:
  the single report-file exemption, the rename's both-sides read, the
  `unrepresentable-paths` arm and the byte-level round-trip behind it (D-08 -
  the staged side arrives canonical through `repoRel` and is NOT re-normalized;
  a second transform over paths that round-tripped through that guard is
  precisely what the phase-1 non-ASCII fix closed at `1d24d9a`), and the
  `staged` and `declared` counts, which keep counting parsed declarations
  (D-10). Add seam-level cases to `planning.test.mjs` beside the existing
  `leaseRepo` ones rather than editing them.
- **Verify:** `node --test cadence-core/bin/planning.test.mjs` exits 0 with the
  shipped `lease-check` cases untouched and green (clean lease, undeclared
  staged path, report-file exemption, `PLAN-<k>.md` selection, directory prefix
  plus the `src/auth`/`src/authority.js` refusal, rename both sides, non-ASCII
  admitted, both `unrepresentable-paths` cases), plus new cases showing: a
  two-file clean lease still reporting `staged: 2, declared: 2`, and a plan
  whose `files:` list is empty still refused as `undeclared-files` with exit 1.
  `grep -n "prefixes.some" cadence-core/bin/planning.mjs` prints nothing.

### Task 4: `./` and redundant separators refused at both declaration doors

- **Files:** cadence-core/bin/lib/lease-grammar.mjs,
  cadence-core/bin/lib/planning-files.mjs (`parsePlanFiles`),
  cadence-core/bin/lease-grammar.test.mjs, cadence-core/bin/planning.test.mjs
- **Action:** Export from the lease-grammar module a pure predicate over one
  declaration string that answers whether it carries a refused spelling, and
  call it from `parsePlanFiles` on BOTH arms of the declared-files union (D-02):
  the frontmatter `files:` items and each comma element of a `- **Files:**` task
  line, including the task arm's raw un-normalized twin, so the same spelling
  cannot enter the set through the second door. The refused set is exactly: a
  declaration beginning `./`, a declaration containing a `/./` segment, and a
  declaration containing `//`. Nothing else - `..` is out of scope by the
  phase's own boundary, and widening the rule here would refuse declarations
  that name real files. A refused declaration is DROPPED from the returned set
  and records one `{line, code, text}` issue on the same `issues` array
  `parsePlanFiles` already returns, so it rides both existing envelopes:
  `plan-overlap`'s `frontmatter_issues` and `lease-check`'s. Use the code
  `redundant-path-segment` (the planner's choice; D-02 fixes only that the
  diagnostic is named) and build the issue through the file's existing
  `issueText` truncation so the shape matches every sibling code. Resolve `line`
  from the declaration's own source line - the task-line arm has the match
  offset from `text.matchAll`, and the frontmatter arm scans only the lines of
  the `files:` list itself - never the whole frontmatter block, where a
  `requirements:` value could contain the same text - advancing a cursor past
  each match so a declaration repeated in the list reports its OWN line rather
  than every diagnostic pointing at the first occurrence. D-19 guarantees the
  verbatim match exists because that arm adds its items byte for byte. Refusal, not
  normalization, is the decided shape: normalizing could only WIDEN a lease,
  which criterion 6 forbids, and 0 of 613 declared entries across 47 shipped
  plan files use either form (measured 2026-08-16). Do NOT push this rule down
  into `parseFrontmatter` or `readFrontmatterList`: those serve `requirements:`
  as well, where these characters are not path syntax, and `cmdAudit` reads
  requirement ids through the same pass.
- **Verify:** `node --test cadence-core/bin/lease-grammar.test.mjs
  cadence-core/bin/planning.test.mjs` exits 0 with: unit cases showing `./a.txt`,
  `src//a.txt`, `src/./a.txt` refused and `src/a.txt`, `src/`, `a.txt`,
  `src/a.rs (edit)` and a path whose basename merely contains a dot accepted;
  seam cases covering the FULL two-spelling-by-two-door matrix, so an
  arm-specific wiring defect cannot pass on the diagonal - `./a.txt` and
  `src//a.txt` each declared in a frontmatter `files:` list, and each declared
  only on a `- **Files:**` task line, all four showing `plan-overlap`'s
  `frontmatter_issues` carrying `redundant-path-segment` with the declaring line
  number and `plans[]` showing that declaration absent from the other plan's
  overlap; a case where `./a.txt` appears TWICE in one `files:` list, showing
  two issues on their own two line numbers; and a `lease-check` case where the sole declaration
  is `./a.txt` and staging `a.txt` is refused as `undeclared-files` with
  `frontmatter_issues` naming the code, proving the spelling reached neither
  reader.

### Task 5: The lease grammar written down, with its budget re-pinned

- **Files:** cadence-core/references/plan-frontmatter.md,
  cadence-core/bin/weight-budgets.json
- **Action:** Document the lease grammar in `plan-frontmatter.md` as its own
  section (D-01): a declared path ending in `/` is a directory lease covering
  every path beneath it, honoured identically by `plan-overlap` and
  `lease-check` through one module; a declaration without the trailing slash
  matches only the byte-identical path, so `src/auth` does not license
  `src/authority.js`; and the three cases the resolver deliberately does not
  normalize - symlinks, case folding, `..` traversal - each with the one-line
  reason from the module header, so criterion 5's out-of-scope statement is in
  the user-facing surface and not only in code. Add the `redundant-path-segment`
  row to the `## Diagnostic codes` table in the table's own shape (Code, Means,
  Payload - it DROPS the declaration - Cleared by), and amend the
  `## What is out of scope` paragraph, which today says the task-line arm is not
  part of this grammar: that stays true of parsing, and the lease-spelling
  refusal is the one rule that deliberately spans both arms, because a refusal
  on the frontmatter arm alone leaves the spelling reaching `lease-check`
  through the second door with no diagnostic. Re-pin
  `cadence-core/references/plan-frontmatter.md` in
  `cadence-core/bin/weight-budgets.json` in this SAME commit (D-12): the file
  sits at 13,954 B against a 13,954 B budget, so any addition lands self-verify
  red without the bump. Set the entry to the file's new exact byte count, the
  convention every row here follows, rather than leaving slack.
- **Verify:** `node cadence-core/bin/self-verify.mjs` exits 0 with `problems:
  []` - no `budget-overrun` and no `unbudgeted-surface` for
  `cadence-core/references/plan-frontmatter.md`. `node
  cadence-core/bin/weight.mjs` reports that surface's `bytes` equal to the
  number now in `weight-budgets.json` - compare the seam's own figure, which is
  what the check reads. `grep -n "src/authority.js"
  cadence-core/references/plan-frontmatter.md` prints the non-substring
  sentence.

### Task 6: The census row that reddens on a pasted-back containment

- **Files:** cadence-core/bin/helper-census.test.mjs
- **Action:** Add a fifth entry to the `HELPERS` list whose `home` is the
  lease-grammar module and whose `re` is the BODY IDIOM of its containment
  expression, not a name and not a call site (D-07) - the file's own header
  states why: a paste-back under a new name is still a copy of the body, and a
  call-site census would redden on every legitimate use. Build the pattern from
  an escaped string, the way all four existing entries do, so this file stays
  censused by the same `everyModule` walk and needs no exemption; pick the
  substring of the module's containment body that appears nowhere else in the
  tree, and if the natural idiom is too generic to be unique, tighten the
  module's expression rather than adding an exclusion list. Keep the existing
  assertion shape - `deepEqual(found, ['<home> (x1)'])` - so a dead pattern and
  a second copy both redden, and write the `note` to tell a contributor which
  module to import from. Add the module to the named-file list in the `the
  census walks the whole bin tree` case, which already pins that the walk
  reaches `lib/`, so a moved or renamed module fails loudly instead of making
  the new arm vacuous.
- **Verify:** `node --test cadence-core/bin/helper-census.test.mjs` exits 0 with
  five `exactly one definition of ...` cases. Then run `cp
  cadence-core/bin/lib/lease-grammar.mjs cadence-core/bin/lib/census-probe.mjs
  && node --test cadence-core/bin/helper-census.test.mjs; rm -f
  cadence-core/bin/lib/census-probe.mjs`: the middle run exits non-zero and the
  failing assertion names both `lib/census-probe.mjs` and the module, proving
  the pattern is live. The probe file is never staged. Finally `node --test
  'cadence-core/bin/*.test.mjs'` and `node cadence-core/bin/self-verify.mjs`
  both exit 0.

## Notes

- Task ordering is load-bearing and not a preference (AC6). Task 1 commits
  ALONE, with the two failing-capable cases and no fix, and its `node --test
  cadence-core/bin/planning.test.mjs` output is the phase's watched-FAIL
  evidence; the SUMMARY records that SHA and the two case names. CI is red at
  that one SHA by design, the way phase 1's task-1 commit was; the branch tip is
  green. Nothing after task 1 may reorder ahead of it, because a fix landing
  first turns the evidence into a green run that proves nothing.
- One plan, per the CONTEXT `Plan shape` directive, and the file-independence
  test agrees rather than merely permitting it: every task after the first
  touches either `cadence-core/bin/planning.mjs`, the new module, or
  `cadence-core/bin/planning.test.mjs`, and tasks 2-4 share both. There is no
  slice here with no shared files and no cross-slice ordering.
- The module gets a sibling test file even though D-04 observes that
  `lib/frontmatter.mjs` and `lib/seam-io.mjs` ship without one. The grammar is
  now a table of declaration/path pairs, and this tree's convention for a stated
  grammar is a unit table beside the seam-level cases -
  `cadence-core/bin/planning-files.test.mjs` says so in its own header. No
  `CONTRACTS` row is owed either way: `self-verify.mjs` check 14 is
  top-level-only and non-recursive, so a `lib/` module is invisible to it.
- D-08's "do not re-normalize the staged side" is not a style preference. The
  phase-1 CAPTURE item records that `lease-check` once hard-blocked every commit
  touching a non-ASCII path, closed 2026-08-08 at `1d24d9a` by reading git's
  output as bytes with a per-path round-trip check and a third refusal reason
  that fails closed. A second transform over paths that survived that guard is
  the way to re-break it.
- `parsePlanFiles` has exactly two callers - `cmdPlanOverlap` and
  `cmdLeaseCheck` - so task 4's new diagnostic reaches those two envelopes and
  no others. `cmdAudit` reads `parsePlanRequirements`, a different selector over
  the same pass, and gains nothing here.
- Two names in this plan are the planner's choice inside a decision that fixed
  only the shape: the module file `cadence-core/bin/lib/lease-grammar.mjs`
  (D-04 fixed the directory) and the diagnostic code
  `redundant-path-segment` (D-02 fixed that it is named). An executor that picks
  differently owes a deviation note, not a re-plan, provided the census `home`,
  the reference table row and the tests move with it.
- Phase 2's own CAPTURE item notes the `--label` containment guard sits inline
  at its one call site rather than in a shared `lib/` helper, to be lifted when
  a second command takes a path-forming label. That is a different surface and
  is NOT lifted here: this phase's second reader is a second reader of the same
  declaration, which is what earns the module.
