---
phase: 1
plan: 1
requirements: [WHY-02, WHY-03, WHY-04]
files:
  - .planning/phases/1/CONTEXT.md
  - cadence-core/bin/lib/why-corpus.mjs
  - cadence-core/bin/lib/why-query.mjs
  - cadence-core/bin/lib/why-render.mjs
  - cadence-core/bin/why.mjs
  - cadence-core/bin/why-corpus.test.mjs
  - cadence-core/bin/why-query.test.mjs
  - cadence-core/bin/why-record.test.mjs
  - cadence-core/bin/why-render.test.mjs
  - cadence-core/bin/why.test.mjs
  - cadence-core/bin/fixtures/why.adjudication-v3.6.0-1-1.json
  - cadence-core/bin/fixtures/why.chain-worst.json
---

# Phase 1: The chain reaches what it claims - Plan

## Goal

`/cad-why`'s three stated gaps close, so the command's reachability, its entry
cap and its ordering are what the code claims rather than what a comment claims.

## Must be true when done

- Running `/cad-why cadence-core/bin/lib/release-decision.mjs` prints a chain
  that names, in words, the commits `git log --full-history` reports for that
  path and the chain does not - `b86fc25c`, `051f0df1`, `9237a539` - and says
  what dropped them, rather than being silently 7-of-10.
- A path with nothing excluded prints no such note at all, so the statement is
  about a real gap and never a line every chain carries.
- `.planning/phases/1/CONTEXT.md` exists and its numbered reachability decision
  names what the choice costs on a path with a busy merge history, with the
  figures it was measured on.
- Rendering the worst measured path at the default entry cap prints under the
  10,000-byte line `cadence-core/references/conventions.md` states, and
  `lib/why-render.mjs`'s comment states that measurement and its date.
- `why-render.test.mjs` reddens if `DEFAULT_TOP` moves without the comment's
  claim moving with it.
- A commit whose `%cI` string sorts on the wrong side of a close attaches to the
  close it actually belongs to, and an unparseable date returns a stated absence
  rather than throwing.
- `node cadence-core/bin/test.mjs` reports 0 failures and
  `node cadence-core/bin/self-verify.mjs --root .` returns `ok:true` with
  `problems: []`.

## Context

No CONTEXT.md existed for this phase; task 1 writes one, and the five decisions
it records are stated in the Notes below with the measurements behind them.
`lib/why-query.mjs`'s D-15/D-17 header, `lib/why-render.mjs`'s D-13 header and
`lib/why-corpus.mjs`'s `--full-history` header are this codebase's design record
for the three surfaces being changed - read them before editing, they name why
each flag is pinned. Out of scope: the read-back gate, `cite-count`, the line
arm's own simplification, and every carried-in open item in `PROJECT.md`.

## Tasks

### Task 1: Record the phase's five decisions as CONTEXT.md

- **Files:** .planning/phases/1/CONTEXT.md
- **Action:** Write the file to `cadence-core/templates/CONTEXT.md`'s five
  sections, dated today, `Plan shape: one plan`. Record D-01 through D-05 with
  the substance and the evidence the Notes section of this plan states, carrying
  every measured figure and the date it was measured - the point of D-01 is that
  a later reader can see what the reachability choice cost and on which paths, so
  a decision line with no numbers under it fails its own purpose. D-01 must also
  carry the correction the Notes record: the ROADMAP's and PROJECT's account of
  which three commits are missing on `release-decision.mjs` is measurably wrong,
  and a decision that inherited it would be reasoning from a false premise.
  Acceptance criteria AC1 through AC6 mirror the ROADMAP's six Success Criteria
  for this phase in substance, one each, phrased as observable behaviour. Do not
  invent a sixth decision or a seventh criterion: the count is what
  `criteria-size` bounds and what `/cad-audit` traces both ways.
- **Verify:** `node cadence-core/bin/planning.mjs criteria-size --dir .planning`
  reports `context_found: true` and `context_criteria: 6` for phase 1 with an
  empty `over` list, and `grep -c '^- D-0' .planning/phases/1/CONTEXT.md` prints
  5.

### Task 2: Repair the six `/cad-why` tests the v3.6.0 close reddened

- **Files:** cadence-core/bin/why-corpus.test.mjs, cadence-core/bin/why-record.test.mjs, cadence-core/bin/fixtures/why.adjudication-v3.6.0-1-1.json
- **Action:** The suite is red before this phase starts: 6 of 2,907 tests fail,
  every one of them a `/cad-why` test pinned to a live-corpus figure the v3.6.0
  close moved. Repair each so a LATER close cannot redden it again - a hand-bumped
  constant is the defect, not the number it currently holds. The two in
  `why-corpus.test.mjs` at the `resolveCommit`/`buildCommitIndex` cases assert a
  live `phases/1` is in the walk and that some directory carries the group
  `phases`; between milestones this repository has no live phase directory at all,
  so move the both-tiers-are-walked half onto a built root through the file's own
  `planningRoot` helper (which already builds two archive groups in the case below
  it) and leave the live-corpus half asserting only the discrimination it exists
  for. The three prune-search cases pin `prunes.length`, the `--full-history`
  count and the labelled-close count at 25, 25 and 7; today they are 26, 26 and 8,
  and each grows by one at every close - assert a monotone lower bound carrying
  today's measured figure and its date, keep the named shas (`72940906`,
  `a34b0c8a`, `8d9bbac9`) and keep `without < withFlag`, which is the assertion
  that actually stops the flag being dropped. In `why-record.test.mjs` the
  non-survived-entry case reads
  `.planning/phases/1/ADJUDICATION-risk_surface-plan-1.json`, which the close
  deleted; recover that record from git history and commit it verbatim as the
  fixture named above, then read the fixture - a copied real record is still a
  real record, which is what that test's own comment asks for, and the
  `fixtures/verbatim.trace.jsonl` precedent is the same move. Do not delete a
  failing case and do not weaken one to `assert.ok(true)`-shaped coverage.
- **Verify:** `node cadence-core/bin/test.mjs` reports `fail 0` where it reports
  `fail 6` before this task, and `node --test cadence-core/bin/why-corpus.test.mjs
  cadence-core/bin/why-record.test.mjs` passes.

### Task 3: `closeOver` orders by parsed instants and guards an unparseable date

- **Files:** cadence-core/bin/lib/why-corpus.mjs, cadence-core/bin/why-corpus.test.mjs
- **Action:** `closeOver` compares `p.date >= when` as strings, and ISO-8601
  values under different UTC offsets do not string-sort chronologically, so an
  unresolved commit can attach to a close that happened before it. Compare parsed
  instants on both sides, and select the close with the SMALLEST instant at or
  after the commit's rather than relying on `prunes` arriving newest-first: the
  incoming order is `findPruneCommits`'s and this function should not silently
  depend on it. An unparseable commit date answers null - the same stated absence
  the empty-date arm already gives - and a prune whose own date will not parse is
  skipped rather than allowed to decide, never a throw, because this runs inside
  the gap pass over an already-answered chain and a throw there loses a query git
  had already answered. Update the function's doc comment: the "prunes is
  newest-first, so the LAST one still at or after the date" sentence stops being
  true once the selection is order-independent. Add the regression case to
  `why-corpus.test.mjs` beside the existing earliest-close-at-or-after case: a
  pair of prunes and one commit date, all spelled with DIFFERENT UTC offsets,
  arranged so the commit falls between the two closes as instants while its
  `%cI` string sorts on the far side of the earlier one. Leave the existing case
  untouched - it is the proof that the order-independent selection did not change
  the ordinary answer.
- **Verify:** `node --test cadence-core/bin/why-corpus.test.mjs` passes; and with
  the comparison temporarily reverted to the `p.date >= when` string form the new
  case FAILS - run it once that way to prove the test can go red, then restore.
  `closeOver` called with a garbage date string returns null instead of throwing.

### Task 4: The seam measures what history simplification excluded

- **Files:** cadence-core/bin/lib/why-query.mjs, cadence-core/bin/why.mjs, cadence-core/bin/why-query.test.mjs, cadence-core/bin/why.test.mjs
- **Action:** Give `why-query.mjs` a third exported argv builder beside
  `probeArgv`, `bareArgv` and `lineArgv`: the comparand query, carrying
  `--full-history`, an explicitly pinned `-M`, a fixed `--format` that yields the
  full sha and the commit's parent list, and the `--` separator. It must NOT
  carry `--follow`: measured on git 2.55.0 on 2026-08-23, `--follow` defeats
  `--full-history` and the pair returns exactly the `--follow` answer, so this is
  a second query and never a flag added to `bareArgv`. Add a pure function beside
  `classifyResult` that takes the chain's shas and the comparand's parsed records
  and returns the records the chain does not carry, in the comparand's own
  newest-first order, each with its parent count - so a caller can say how many
  of them are merges from evidence rather than by assertion. Both stay inside
  that module's rules: no disk, no emit, no Date, arrays never shell strings. In
  `why.mjs`, run the comparand through the existing `runGit` on the BARE arm only
  (the `-L` arm carries its own simplification and WHY-02 is scoped to the bare
  path) and only after the chain query has already succeeded, and carry the
  result on the emitted envelope. A non-zero exit from the comparand contributes
  an absent report and never fails the query, the same fail-open discipline the
  index already takes with `warnings[]`: `git log` has already told the seam what
  the commits are, and a failed comparand makes the answer thinner rather than
  wrong. Cover the new argv builder and the pure diff in `why-query.test.mjs`
  including the empty case, and prove the envelope end to end in
  `why.test.mjs` against this repository.
- **Verify:** `node cadence-core/bin/why.mjs cadence-core/bin/lib/release-decision.mjs
  --dir .` prints one JSON line naming `b86fc25c`, `051f0df1` and `9237a539` as
  excluded, and naming none of the seven shas the chain itself lists; the same
  command on a hermetic repository built by `why.test.mjs`'s own `repo()` helper
  names none; `node --test cadence-core/bin/why-query.test.mjs
  cadence-core/bin/why.test.mjs` passes.

### Task 5: The chain states that exclusion in words

- **Files:** cadence-core/bin/lib/why-render.mjs, cadence-core/bin/why.mjs, cadence-core/bin/why-render.test.mjs, cadence-core/bin/why.test.mjs
- **Action:** `renderChain` takes task 4's report and renders a stated block
  INSIDE `text`, for the reason that module's header already gives about the
  truncation note: D-02 has the skill relay `text` verbatim and print no envelope
  field, so a gap only the JSON recorded would never reach a reader. The block
  names how many commits also touched this path and are not listed, says what
  dropped them - git's default history simplification, which `--follow` requires
  and which this command keeps for rename-following - states how many of them are
  merges from the parent counts the report carries rather than claiming it, lists
  at most a few newest-first through the existing `capped` helper with the
  remainder counted, and names the `git log --full-history --` invocation a reader
  can run to see them. Keep the truncation note LAST so the `Pass --top` line
  stays the final line of a truncated chain. An absent or empty report renders
  nothing at all - a chain with nothing excluded must not grow a line stating a
  non-event, which would be bytes on every query for no information and would
  land on the cap task 6 is about. Cover the rendered block and the renders-nothing
  case in `why-render.test.mjs`, and prove the seam's own text in `why.test.mjs`.
- **Verify:** `node cadence-core/bin/why.mjs cadence-core/bin/lib/release-decision.mjs
  --dir .` prints a `text` field containing the count 3, the word merge, all three
  of `b86fc25c`, `051f0df1`, `9237a539`, and `--full-history`; the same command on
  `cadence-core/bin/lib/why-corpus.mjs` reports 1; and running it against a
  hermetic repository from `why.test.mjs`'s `repo()` helper prints a `text` with
  no such block. `node --test cadence-core/bin/why-render.test.mjs
  cadence-core/bin/why.test.mjs` passes.

### Task 6: The entry cap carries a claim measurement supports

- **Files:** cadence-core/bin/lib/why-render.mjs, cadence-core/bin/why.mjs
- **Action:** Set `DEFAULT_TOP` to 6 and replace both the D-13 paragraph and the
  "THAT LAST SENTENCE IS NOW MEASURED FALSE" paragraph above it with one that
  states the measurement: the paths measured, their rendered byte counts at the
  new cap, the date, and the claim that 6 is the LARGEST cap under which the worst
  of those paths stays under the 10,000-byte line
  `cadence-core/references/conventions.md` states. Re-measure after task 5 rather
  than trusting the Notes figures below - the exclusion block adds bytes to every
  chain that has one, and the whole defect being closed is a number justified by a
  measurement nobody re-ran. If the re-measurement puts the largest satisfying cap
  somewhere other than 6, set it there and say so; the decided value is 6 and a
  different measured answer is a deviation to log, not a silent edit. Do not take
  the roadmap's alternative arm of keeping 10 and re-justifying it on some other
  ground: bounding the response is the only job this constant has, and there is no
  second reason available for it. Correct `why.mjs`'s usage line, which states the
  default as 10.
- **Verify:** `node cadence-core/bin/why.mjs <path> --dir .` for each of
  `cadence-core/bin/lib/capture-file.mjs`, `cadence-core/bin/lib/issue-decision.mjs`
  and `cadence-core/bin/planning.mjs` prints a `text` whose UTF-8 byte length is
  under 10,000; re-running the same three with `--top 7` puts at least one of them
  over 10,000, which is what makes the stated cap maximal rather than merely safe.
  `grep -n 'DEFAULT_TOP\|default 10' cadence-core/bin/lib/why-render.mjs
  cadence-core/bin/why.mjs` shows no surviving claim of 10.

### Task 7: The pin that reddens when the number and its reason disagree

- **Files:** cadence-core/bin/fixtures/why.chain-worst.json, cadence-core/bin/why-render.test.mjs
- **Action:** Capture the worst measured path's render INPUT from a real seam run
  with the cap lifted - the chain entries and task 4's simplification report,
  exactly as the seam handed them to `renderChain`, and not the rendered text,
  which the test re-renders - and commit it as the fixture named above. It is a
  frozen worst case on purpose: its job is to pin the cap against a shape that was
  really measured, not to track whatever that path's history does next, and the
  header should say so. In `why-render.test.mjs`, hold the 10,000-byte threshold
  as one named constant carrying the `references/conventions.md` citation, then
  assert both halves of the comment's claim: rendering the fixture at the default
  is under the threshold, and rendering it at one above the default is not. The
  pair is what makes the pin fail when the number and its stated reason disagree
  again - the under-assertion alone would let the cap be lowered while the comment
  went on claiming maximality. The fixture must carry more entries than the default
  so the cap is genuinely exercised. Move the existing `a 25-entry chain renders
  exactly 10 entries` case's numbers onto the new default rather than leaving a
  second, contradicting claim in the same file.
- **Verify:** `node --test cadence-core/bin/why-render.test.mjs` passes; editing
  `DEFAULT_TOP` to one higher makes it fail and restoring it makes it pass again -
  run that once. Then `node cadence-core/bin/test.mjs` reports 0 failures and
  `node cadence-core/bin/self-verify.mjs --root .` returns `ok:true` with
  `problems: []`.

## Notes

**The five decisions task 1 records, and what each was measured on.** Every
figure below was taken on this repository on 2026-08-23, git 2.55.0.

**D-01 (reachability, WHY-02) - the bare-path arm KEEPS `--follow` and REPORTS
what git's default history simplification excluded, rather than trading
`--follow` away for `--full-history`.** The two flags do not compose: `git log
-M --follow --full-history -- cadence-core/bin/lib/release-decision.mjs` returns
the same 7 commits `--follow` alone does, while `--full-history` without
`--follow` returns 10 - so this is a choice between rename-following and full
history, never a flag that can simply be added. `--follow` is measured-justified
already (`lib/why-query.mjs`'s D-17: 173 rename records in the last 400 commits
of the surface this command reads). What `--full-history` would buy is merges
and only merges: 39 of 39 on `planning.mjs` (152 against 191), 28 of 28 on
`README.md` (68 against 96), 5 of 5 on `lib/issue-decision.mjs` (12 against 17),
3 of 3 on `lib/release-decision.mjs`, and the `--follow` set is a subset every
time. Each of those merges resolves to NOTHING in the corpus index - the three
on `release-decision.mjs` (`b86fc25c`, `051f0df1`, `9237a539`) all come back
`unresolved` from `resolveCommit` against the merged four-tier index - so
admitting them spends entry-cap slots on gap blocks that name no phase.
**The cost, on a path with a busy merge history:** one extra `git log
--full-history` per bare query, 6 ms on the 191-commit `planning.mjs`, plus a
capped note of a few hundred bytes; against the alternative's cost of 39
unresolvable entries competing for a cap of 6 on that same path, and the loss of
rename-following on all of them.

**D-01's correction.** ROADMAP.md lines 51-56 and PROJECT.md's `### Active` both
say the three commits missing on `release-decision.mjs` are `_archive-v2.2.0/3`
phase commits collapsed into merge `0bf62847`. Measured, that is false in both
halves: `0bf62847` is single-parent and is already one of the 7 the chain
carries, and the five commits `_archive-v2.2.0/3/SUMMARY.md` records
(`2c3c2cb`, `1dd5ad5`, `86929d4`, `67f0379`, `c253a3b`) exist as objects but are
not ancestors of HEAD, so no `git log` flag reaches them and no reachability
change recovers that phase. The three `--full-history` adds are merges. Recorded
here rather than quietly worked around, because a decision reasoning from the
roadmap's version would be choosing between two options on a false premise.

**D-02 (entry cap, WHY-03) - `DEFAULT_TOP` becomes 6, and the comment's claim
becomes the maximality statement measurement supports.** Full-chain renders
today at the shipped cap of 10: `lib/capture-file.mjs` 11,211 B over 8 entries,
`lib/issue-decision.mjs` 12,481 B over 10 of 12, `planning.mjs` 14,626 B over 10
of 152, `lib/release-decision.mjs` 8,274 B over 7. Cumulative rendered bytes at
six entries: 8,702 / 7,675 / 8,048. At seven: 9,926 / 9,001 / 9,296, which the
truncation note (~60 B) and D-01's exclusion block (~250-350 B) push past 10,000
on `capture-file.mjs`. Six is therefore the largest cap that holds, with roughly
1,000 B of headroom on the worst of them.

**D-03 (the pin, Success Criterion 4) - the pin measures a real captured
worst case, not a synthetic entry shape, and asserts BOTH directions.** A
synthetic per-entry size drifts from what the seam actually renders, which is
exactly how the shipped comment came to claim a figure nothing measured.

**D-04 (ordering, WHY-04) - `closeOver` selects on parsed instants and the
selection is order-independent; an unparseable date is a stated absence, never a
throw.** Order-independence is the wider fix: the string comparison is the
reported defect, but the function also silently depends on `prunes` arriving
newest-first, and a caller change would break it just as quietly.

**D-05 (the reddened suite, Success Criterion 6) - the six `/cad-why` tests the
v3.6.0 close broke are repaired to assertions a later close cannot redden.**
Discovered at plan time, not carried in from the roadmap: `node
cadence-core/bin/test.mjs` reports 2,907 tests, 2,900 pass, **6 fail** on a clean
tree before this phase begins. Five are in `why-corpus.test.mjs` (the live
`phases/1` walk, twice; the prune count 25 now 26; the `--full-history` control's
25 now 26; the labelled-close count 7 now 8) and one is in `why-record.test.mjs`,
which reads `.planning/phases/1/ADJUDICATION-risk_surface-plan-1.json`, deleted
by the v3.6.0 prune commit `d8173830` and recoverable from its parent (3,913
bytes, two entries, both `downgraded`). Success Criterion 6 cannot pass without
this, and re-pinning the constants at today's numbers would only move the same
breakage to the next close.

**Plan shape.** One plan, against the dispatch's "not specified". A split was
tested and rejected: the natural slices (WHY-02 + WHY-03 against WHY-04 + the
suite repair) share `.planning/phases/1/CONTEXT.md`, since D-01 through D-05 are
one record binding both halves, and the entry-cap measurement in task 6 must be
taken after task 5's block lands. Cross-slice ordering on both counts, so the
independence test says one plan.

**Sequencing.** Task 2 comes before every measurement task on purpose: a suite
that is red before the phase starts makes every later "the tests pass" check
unreadable.
