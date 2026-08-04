---
phase: 2
plan: 2
requirements:
  - REV-03
files:
  - cadence-core/bin/lib/dispatch-phrasing.mjs
  - cadence-core/bin/dispatch-phrasing.test.mjs
  - cadence-core/bin/self-verify.mjs
  - cadence-core/bin/self-verify.test.mjs
  - METHOD.md
---

# Phase 2: Findings are a list, not a work order - Gaps Plan

## Goal

The mechanical guard behind the phase's one-message rule names an unbatched
concurrent dispatch wherever a workflow or reference file states one, so the
prose repair this phase shipped cannot be undone by the next edit. Today the
guard is narrower than the rule it enforces: it fires only when a concurrency
claim is accompanied by a loop head or a host hedge, and it lets one compliant
sentence excuse the rest of its block.

## Must be true when done

- Running the shipped lib on `Dispatch each reviewer concurrently.` returns
  exactly one `unbatched-dispatch` (it returns `[]` today), and running it on the
  `execute_parallel` item 1 text this phase replaced returns exactly one whose
  detail BEGINS at the "one dispatch per message, in the background" sentence
  and quotes that phrase - named for its own serialization phrasing rather than
  because a neighbouring sentence happens to say "for every executor", which is
  the only reason the shipped rule catches it.
- A compliant sentence no longer excuses a non-compliant one in the same block:
  `- Dispatch the reviewer set in one message. Then dispatch a verifier per doc,
  in parallel where the host allows.` produces exactly one problem, whose detail
  quotes the SECOND sentence and names the source line that sentence starts on.
- The widening costs no legitimate surface: `node cadence-core/bin/self-verify.mjs`
  reports no `unbatched-dispatch` over the 33 markdown files under
  `cadence-core/workflows/` and `cadence-core/references/`, including
  `execute.md`'s batched `execute_parallel` item 1, `seams.md`'s Concurrent
  dispatch binding, the `config-reach.md` and `review-triggers.md` tables, and
  the "Cadence issues no ... per dispatch" descriptions in `git.md` and
  `seams.md`.
- Every shipped description of the check states the rule that actually runs -
  the lib's doc comment, `self-verify.mjs`'s numbered header entry and its
  inline comment (whose stated reason for the two-directory scope is true), and
  METHOD.md's "The tool checks its own prose" paragraph.
- CI pins the check in both directions and in BOTH scoped directories: a
  `cadence-core/workflows/` fixture and a `cadence-core/references/` fixture each
  produce an `unbatched-dispatch` problem, the batch-shaped rewrite produces
  none, and the same sentence under `skills/` still produces none.
- `node --test cadence-core/bin/*.test.mjs` exits 0, `npx tsc -p
  tsconfig.ci.json` exits 0, and `node cadence-core/bin/self-verify.mjs` reports
  `ok:true` with `problems: []` and no `budget-overrun`.

## Context

This closes UAT item 5 (AC5, `fail`, minor) and nothing else in phase 2; items
1-4 and 6-8 all pass at HEAD. UAT named the tension: the shipped rule matches
what PLAN.md task 6 specified, and AC5's wording is broader. The resolution is
to WIDEN the check, not to narrow the criterion, because AC5 is a restatement of
locked decision D-06 ("self-verify gains a check ... that FAILS when a
multi-dispatch instruction lacks the mandated one-message phrasing") and a
CONTEXT decision is not editable from a gaps plan. The code settles it too: the
shipped rule returns `[]` on the exact sentence this phase DELETED from
`workflows/execute.md` when that sentence is read on its own (measured at
planning time) - a guard against a regression that cannot see the regression it
exists to prevent. D-06's accepted cost stands: this is a heuristic over prose,
and the remedy for a false positive is to narrow the pattern in the lib, never
to bend a correct surface around it.

Out of scope: the directory scope stays the two AC5 names (no skills/, agents/,
templates/); the problem code stays `unbatched-dispatch`; no prose surface under
`cadence-core/` is edited by this plan - the widened rule is measured green on
the repo at HEAD, so any red here is a defect in the rule, not in the prose. No
`weight-budgets.json` change: nothing this plan touches is on the weighed walk.

## Tasks

### Task 1: Widen `dispatchPhrasingIssues` to the rule D-06 and AC5 state

- **Files:** cadence-core/bin/lib/dispatch-phrasing.mjs,
  cadence-core/bin/dispatch-phrasing.test.mjs
- **Action:** Rewrite the rule inside the existing module, keeping its exported
  surface exactly as it is (`CODE` and `dispatchPhrasingIssues(text)` returning
  `{code, detail}[]`, non-string input still returning `[]`, still `// @ts-check`,
  still no fs/emit/process/Date). Five changes, each with the measurement that
  justifies it - every count quoted below was taken by running that candidate
  rule over the 33 markdown files under `cadence-core/workflows/` and
  `cadence-core/references/` at planning time, so the executor's job is to
  reproduce a zero, not to discover one.
  (1) SEGMENTATION - in `blocks()`, add a line whose first non-space character is
  a pipe to the set that starts its own block, beside the existing list-marker
  and ATX-heading starters. A markdown table today collapses into ONE block, and
  with its backticked cells masked to spaces the remaining cell labels read as a
  single sentence; measured, the widened rule without this fires twice on
  catalog rows that instruct nothing - `references/config-reach.md:81` (the
  `parallelization.*` reach rows gluing to unrelated "Honoured by" cells) and
  `references/review-triggers.md:162` (the wiring table, whose `phase_diff` row
  says "parallel path only"). One row per block also keeps a genuine one-row
  instruction checkable, which dropping table lines entirely would not.
  (2) SENTENCES - after a block is whitespace-collapsed, split it on a period or
  semicolon followed by whitespace and evaluate the rule per SENTENCE. Splitting
  on those two only, and only when whitespace follows, is what keeps `seams.md`
  and `review-triggers.md` from splitting mid-citation; do NOT split on a colon,
  which severs a batch statement from the list it introduces. Carry a line map
  alongside the collapsed text - record, per source line contributing to the
  block, the offset at which its text begins - and report each issue at the
  source line the OFFENDING SENTENCE starts on rather than the line the block
  starts on. The current detail comment promises the line "points at the sentence
  to rewrite"; once the unit is the sentence, only the map keeps that true.
  (3) THE FLAG RULE - a sentence S inside block B is a problem when B carries a
  concurrency claim, S does NOT carry the mandated phrasing, and S carries at
  least one of: a serial shape, a host hedge, or (a concurrency claim of its own
  AND a dispatch verb AND a distributive marker). The concurrency claim is
  BLOCK-scoped because the sentence this phase deleted carries its claim in the
  neighbouring sentence of the same list item, so a sentence-scoped claim leaves
  it unnamed - measured. The third arm is the one that must ALSO see the claim in
  its own sentence: with that arm block-scoped, two descriptive sentences false-
  positive (`references/git.md:78` and `references/seams.md:59`, both "Cadence
  issues no `git worktree add` ... so it pins no fork point per dispatch", sitting
  in blocks that mention the parallel path), which is exactly the too-eager rule
  that blocks CI on correct prose.
  (4) VOCABULARY - keep `CONCURRENCY` and `HOST_HEDGE` byte-identical. Rename
  `LOOP_HEAD` to `SERIAL_SHAPE` and extend it to `for each`, `for every`, `one at
  a time`, `one by one`, `in turn`, `per reviewer`, `per message`, and `one
  (dispatch|call|request|agent|reviewer|executor|verifier) per` - the rename is
  the point, since "one dispatch per message" is a serialization instruction and
  not a loop head, and its absence is why the deleted `execute.md` sentence went
  unnamed. Add `DISPATCH_VERB` (`dispatch`/`dispatches`/`dispatched`/
  `dispatching`, `issue`/`issues`/`issued`/`issuing`, `fire`/`fires`/`fired`/
  `firing`, `spawn`, `launch`, `send`, with their inflections) and `DISTRIBUTIVE`
  (`each`, `every`, `all`, `both`, `them`, `the set`, `the whole set`, and `per`
  followed by one lowercase word). Extend `BATCHED` from `in one (message|batch)`
  to also accept `as one (message|batch)`, `in the batch`, `across the batch` and
  `the whole batch`: a compliant list item states the batch once and then
  ELABORATES, and `workflows/execute.md:188-191` ("reuse it for every executor in
  the batch ... so re-resolving per dispatch is wasted (seams.md concurrent
  dispatch)", the second sentence of the item whose first says "the whole batch
  issued in ONE message") is the measured false positive that a batch-affirming
  vocabulary costs one alternation to avoid. All matching stays case-insensitive and
  word-bounded. While in `maskCode`, treat a `~~~` fence like a triple-backtick
  fence, tracking which marker opened the fence so a nested example cannot close
  it early: the widening raises what an unmasked fence costs, since a doc showing
  the WRONG phrasing as an example is now flaggable prose (CAPTURE.md:180, latent
  - no `~~~` fence exists under either directory today).
  (5) DETAIL LENGTH - raise the module's `QUOTE` constant from 100 to 200. This
  is a consequence of change (2), not a preference: with the unit now the
  sentence, the detail is expected to quote the phrasing that FAILED, and in the
  pre-phase `execute.md` item 1 the offending phrase `one dispatch per message`
  begins at character 131 of a 175-character sentence, so at `QUOTE = 100` the
  detail truncates before reaching it and the test row below cannot assert what
  it exists to assert. Widening only lengthens details: all eight existing lib
  rows and every existing `self-verify.test.mjs` row assert on a `detail` prefix
  or a substring inside the first 100 characters, so none changes. Rewrite the module's
  doc comment so its three-step MASK / BLOCK / FLAG contract states the rule
  above, including why the concurrency claim scopes from the block while the
  dispatch-verb arm does not, and keep the two paragraphs that record why
  descriptive prose ("parallel dispatch without isolation is not supported") and
  deliberate serialization ("For each plan in order: dispatch ONE cad-executor
  ... and wait") stay legal. In `dispatch-phrasing.test.mjs` keep all eight
  existing rows byte-unchanged - each one still holds under the widened rule,
  verified at planning time, and a row that needs rewriting means the rule
  drifted - and add seven, one `test()` each, titled by the arm it pins: the UAT
  reproduction `Dispatch each reviewer concurrently.` yields exactly one issue;
  the pre-phase `execute.md` item 1 text (recoverable with `git show
  58ab673^:cadence-core/workflows/execute.md`, lines 185-192) yields exactly one
  issue whose detail starts `line 185:`, contains `one dispatch per message`,
  and does NOT contain `Resolve the route ONCE` - i.e. the detail begins at the
  offending sentence rather than at the compliant one that precedes it in the
  same item, which is the property change (2) delivers and change (5) makes
  assertable; the two-sentence
  whitewash `- Dispatch the reviewer set in one message. Then dispatch a verifier
  per doc, in parallel where the host allows.` yields exactly one issue whose
  detail quotes the second sentence and not the first; the SHIPPED `execute.md`
  item 1 text (`execute.md:185-192` at HEAD, the same block with "the whole batch
  issued in ONE message") yields none, which is the row that pins the
  batch-affirming vocabulary; a three-line block
  whose offender is on the third line reports line 3, not line 1; a two-row
  markdown table, one row saying "parallel path only" and the next saying
  "dispatch each reviewer", yields none (it yields one without change (1)); and
  a `~~~`-fenced example containing `For each reviewer in the set, in parallel
  where the host allows` with a nested triple-backtick fence inside it yields
  none, which is the only row that exercises change (4)'s fence-marker tracking
  - without it a mis-implemented tracker ships green in both directions, since
  no `~~~` fence exists under either scoped directory to catch it.
- **Verify:** `node --test cadence-core/bin/dispatch-phrasing.test.mjs
  cadence-core/bin/self-verify.test.mjs` exits 0 with 0 fail and names all
  fifteen lib rows (8 existing + 7 added); `node cadence-core/bin/self-verify.mjs` reports `ok:true`
  with `problems: []`, which is the zero-false-positive assertion over both
  scoped directories; `npx tsc -p tsconfig.ci.json` exits 0; and both UAT
  reproductions flip from `[]` to one issue without touching a tracked file -
  run `node -e "import('./cadence-core/bin/lib/dispatch-phrasing.mjs').then(m =>
  console.log(JSON.stringify(m.dispatchPhrasingIssues('Dispatch each reviewer
  concurrently.'))))"` and the same call on `'- Dispatch the reviewer set in one
  message. Then dispatch a verifier per doc, in parallel where the host
  allows.'`, each printing exactly one `unbatched-dispatch` where both print `[]`
  at HEAD. The non-firing side AC5 also asks for is the same call on `'Issue the
  resolved set in ONE message (seams.md Concurrent dispatch); serialize only
  when one dispatch consumes another\'s output, which a reviewer set never
  does.'`, which prints `[]` before and after.

### Task 2: The seam, its tests and METHOD.md state the rule that runs

- **Files:** cadence-core/bin/self-verify.mjs, cadence-core/bin/self-verify.test.mjs,
  METHOD.md
- **Action:** No behaviour changes in `self-verify.mjs` - the call site, the
  directory scope, the `kind`, and the `checked` string are all correct and stay
  byte-identical; what is false after task 1 is what the file SAYS. Rewrite the
  numbered header entry (`:45-50`), whose "A loop-shaped head ... or a host hedge
  ... produces the serial behaviour" is now one of three arms, to state the rule
  as it stands: prose under those two directories that claims concurrency for a
  set of dispatches must issue them in ONE message, and EVERY SENTENCE in such a
  block that hands the set out one at a time, hedges on the host, or dispatches a
  set concurrently without saying so is reported. Use that phrase literally - the
  per-sentence granularity is the half of this repair a reworded version of the
  old rule would lose, and the Verify greps for it. Rewrite the inline comment
  (`:409-416`) the same way, and correct its scope rationale, which is
  inaccurate as shipped: `skills/cad-capture/SKILL.md:34` IS a concurrent-dispatch
  instruction (CAPTURE.md:182), so the true reason is that these two directories
  are where dispatch instructions are AUTHORED and `references/` is reached by no
  other check at all (`lib/surface-weight.mjs` does not weigh it), while widening
  the scope to `skills/` is a separate decision this check does not make - AC5
  names two directories and `self-verify.test.mjs` pins the skills case as out of
  scope on purpose. Do not change the scope itself. In `self-verify.test.mjs`
  keep the three existing check-10 rows unchanged and add three: `Dispatch each
  reviewer concurrently.` through `fixture()` produces exactly one
  `unbatched-dispatch` on `cadence-core/workflows/x.md` with a detail starting
  `line 1:` (this row returns 0 problems on unmodified HEAD, which is what makes
  it failing-capable); the same sentence written into
  `cadence-core/references/y.md` (build the root with `fixture()` for a
  dispatch-free workflows file, then `writeFileSync(join(root, 'cadence-core',
  'references', 'y.md'), ...)`, both already imported) produces one problem naming
  that file, closing the fact that no test has ever pinned the `references/` half
  of AC5's scope; and the two-sentence whitewash list item produces exactly one
  problem whose detail quotes the second sentence. Filter by `kind ===
  'unbatched-dispatch'` as the existing rows do, and keep every fixture free of
  dotted config-shaped tokens so no row also trips check 1. In METHOD.md's "The
  tool checks its own prose" section, replace the sentence at `:564-566` ("So does
  an instruction that claims a set of dispatches runs concurrently while handing
  them out one at a time, or hedging on what the host allows") with one that
  states the widened rule in the same voice and no more than two sentences: a
  block that claims a set of dispatches is concurrent has to issue that set in
  one message, and every sentence in it that serializes, hedges on the host, or
  dispatches the set concurrently without saying "in one message" fails the
  build. METHOD.md is on self-verify's `mdFiles` walk (checks 1-3 apply to it,
  check 10 does not - it is outside both scoped directory prefixes), so invent no
  config key, flag or plugin-root path in the new prose. METHOD.md is not on the
  weighed walk, so no `weight-budgets.json` change.
- **Verify:** `node --test cadence-core/bin/*.test.mjs` exits 0 with 0 fail
  (AC7), `npx tsc -p tsconfig.ci.json` exits 0 (AC7), and `node
  cadence-core/bin/self-verify.mjs` reports `ok:true` with `problems: []`, its
  `checked` string still containing `dispatch-phrasing` and no `budget-overrun`
  (AC7). Then three greps whose HEAD baselines were measured at planning time, so
  none of them can certify this task done with a file untouched: `grep -c
  "skills/agents/templates carry no" cadence-core/bin/self-verify.mjs` returns 0
  (1 at HEAD - use THIS contiguous fragment, not the full sentence, which wraps
  across `:415-416` and so returns 0 at HEAD and proves nothing); `grep -c "every
  sentence" cadence-core/bin/self-verify.mjs METHOD.md` returns a nonzero count
  for EACH file (0 in both at HEAD), which is what pins the per-sentence
  granularity in both descriptions rather than a reworded version of the old
  rule; and `grep -c "unbatched-dispatch" cadence-core/bin/self-verify.test.mjs`
  returns at least 7, up from 4 at HEAD. `git diff --name-only` lists exactly
  `cadence-core/bin/self-verify.mjs`, `cadence-core/bin/self-verify.test.mjs` and
  `METHOD.md` for this task.

## Notes

- Requirements frontmatter carries REV-03 only. AC5 is D-06's mechanical guard,
  which is REV-03's #88-AC3 half; TRI-02's tasks are in PLAN.md (plan 1) and all
  five of its UAT items pass. Listing TRI-02 here would claim a task this plan
  does not contain.
- Plan shape matches the CONTEXT directive: one plan. The two tasks share no
  file, but task 2's test rows and comments assert task 1's rule, so they are an
  ordering dependency and not a parallel slice.
- Filename deviation, recorded rather than silent: the dispatch asked for
  `PLAN-GAPS.md`; this file is `PLAN-2.md`, the next free plan number.
  `listPlanFiles` (`cadence-core/bin/planning.mjs:729`) accepts only `PLAN.md` or
  `PLAN-<N>.md`, and `references/req-traceability.md:164-168` and
  `workflows/audit.md:36` name `PLAN-gaps.md` as THE example of a nonconforming
  filename "no seam and no executor dispatch reads, so its requirements and files
  are silently invisible everywhere while the phase still reports success".
  Verified both ways: `planning.mjs plan-overlap --phase 2` reported
  `nonconforming_plans: ["PLAN-GAPS.md"]` under the asked-for name and reads this
  file's five paths cleanly under `PLAN-2.md`. The overlap it now reports against
  PLAN.md is expected - plan 1 is already executed, and the shared files route
  `/cad-execute` sequential, which is what a closure plan wants.
- Execution scope, because the filename fix has a cost: `planning.mjs status`
  now reports phase 2 with `plans: ["PLAN-2.md","PLAN.md"]`, and
  `workflows/execute.md`'s `locate` step takes that list as the plans to run -
  its "never silently re-run" guidance is scoped to a partial/checkpoint/timeout
  return WITHIN one plan, not to a plan completed in a prior session. This
  closure executes `PLAN-2.md` ONLY. PLAN.md is `status: complete` in
  `.planning/phases/2/SUMMARY.md` with its commits on the branch, so the
  coordinator dispatches ONE executor, for this file. Re-dispatching PLAN.md
  would re-run 8 already-committed tasks.
- The two medium CAPTURE items this closure covers (`CAPTURE.md:176` - the loop
  head/hedge conjunction; `:177` - `BATCHED` tested per block) are the same
  defect as UAT item 5 seen from the diff review, and both are closed by task 1's
  changes (3) and (2) respectively. `CAPTURE.md:182` (self-verify's inaccurate
  scope reason) is closed by task 2. `CAPTURE.md:180` (`~~~` fences unmasked) is
  closed by task 1's `maskCode` clause, folded in because the widening is what
  makes it reachable: nothing else in this plan depends on it, and it changes
  nothing on the repo at HEAD, where no `~~~` fence exists under either
  directory.
- Every measurement quoted in task 1 was taken at planning time by running the
  candidate rule over all 33 markdown files under the two scoped directories, and
  the final rule scores zero problems there. The variants and their costs, so a
  reviewer can re-derive rather than trust: no table-row block boundary -> 2 false
  positives (`config-reach.md:81`, `review-triggers.md:162`); shipped `BATCHED`
  vocabulary with per-sentence evaluation -> 1 (`execute.md:188`); the dispatch-
  verb arm scoped to the block instead of the sentence -> 2 (`git.md:78`,
  `seams.md:59`); the concurrency claim scoped to the sentence instead of the
  block -> 0 false positives but the deleted `execute.md` sentence goes unnamed,
  which is the whole point of the check.
- The shipped rule's blind spot was confirmed directly, not inferred: the current
  lib returns `[]` for the pre-phase `execute.md` sentence in isolation and one
  issue for the full list item, so the sentence was caught only because a
  neighbour said "for every executor".
- No CONTEXT decision is amended and no acceptance criterion is reworded. AC5
  stands as written; this plan makes the implementation meet it.
