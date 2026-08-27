---
phase: 5
plan: 1
requirements:
  - RCL-08
files:
  - cadence-core/bin/lib/bm25.mjs
  - cadence-core/bin/fixtures/recall.corpus.json
  - cadence-core/bin/fixtures/recall.queries.json
  - cadence-core/bin/planning-recall-fold.test.mjs
  - cadence-core/bin/planning-recall.test.mjs
  - cadence-core/bin/test.mjs
  - cadence-core/bin/test-groups.test.mjs
---

# Phase 5: Recall matches the word the user typed - Plan

## Goal

`recall` ranks well over the corpus it sees, but it does not fold suffixes, so a
user who types `seam` misses every document that says `seams` and a user who
types `close` misses `closes`. A deterministic suffix fold applied at the one
place both indexing and querying already pass through closes that gap, and a
committed fixture corpus with a named query set proves the ranking it was
already getting did not go backwards.

## Must be true when done

- A `recall` query for `seam` returns the documents that carry only `seams`, and
  the same holds for `close`/`closes`, `file`/`files`, `note`/`notes` and
  `type`/`types`: each pair returns the same documents whichever member is typed.
- `name`, `named` and `naming` return the same documents as each other, and so do
  `refuse`/`refused` and `plan`/`planned`.
- A query for `notes` still comes back with results, and a document saying
  `being` is still findable: the fold never deletes a term by landing it on a
  stopword.
- A fixture corpus and a fixture query set are committed under
  `cadence-core/bin/fixtures/`, and a test running inside `node
  cadence-core/bin/test.mjs planning` shows each query's named hits in its top 5.
  The only entries whose named hits changed are the ones the fixture marks as
  changed by the fold, each naming what moved.
- `recall`'s printed envelope, its default of five results and its argument row
  are exactly what they were; only `total` and the ranking move.
- GH-93's remaining two items leave this phase recorded as open items, each
  naming why it was not delivered, with all three of the item-3 obstacles stated.
- `node cadence-core/bin/test.mjs` is green, `node cadence-core/bin/self-verify.mjs`
  reports `ok:true`, and the new test file's stem runs in the `planning` group
  rather than falling into `other`.

## Context

CONTEXT.md locks the shape: the fold goes INSIDE `tokenize()` in
`cadence-core/bin/lib/bm25.mjs` and nowhere else (D-01), the rule set is Porter
step 1a plus step 1b with `es` never stripped as its own rule (D-02), the
stopword filter keeps testing the RAW token before the fold (D-03), the fixture
pins NAMED known-good hits and never a byte-identical top 5 (D-04), the fixture
corpus is BUILT under `cadence-core/bin/fixtures/` rather than this repository's
live `.planning/` (D-05), and the new test stem is registered in `test.mjs`'s
`planning` group (D-08).

Out of scope, and not to be started: GH-93 item 2 (the multi-query union), GH-93
item 3 (the failure records outside the corpus), any change to the return shape,
the `--top 5` default or the `recall` argument row, and any recency term or
per-source cap on the ranking. Items 2 and 3 are RECORDED as open items (D-06,
D-07); see Notes for the exact text the SUMMARY owes.

`cadence-core/bin/planning/recall.mjs` needs no edit: `cmdRecall` reaches the
tokenizer only through `buildIndex` and `search`, which is why one fold site
covers both.

## Tasks

### Task 1: Commit the fixture corpus, its pre-fold query baseline and the harness that runs them

- **Files:** cadence-core/bin/fixtures/recall.corpus.json,
  cadence-core/bin/fixtures/recall.queries.json,
  cadence-core/bin/planning-recall-fold.test.mjs,
  cadence-core/bin/planning-recall.test.mjs (the local `recall` runner),
  cadence-core/bin/test.mjs (`GROUPS`)
- **Action:** Build the committed fixture corpus (D-05) and the harness that
  runs a query set over it, all green against TODAY's tokenizer - the fold does
  not exist yet, and every hit this task records is therefore a fact about the
  ranking as it currently stands. That is what makes task 2's diff of the query
  set the record of what the fold changed.
  `recall.corpus.json` is an array of objects carrying `id`, `source` and
  `text`. `id` is a short unique token that tokenizes to itself and is a
  substring of no other id (a fixed prefix plus a zero-padded number does this);
  `source` is the exact `source` string the seam must return for that document;
  `text` is the document. Use at least 24 documents spread across at least three
  distinct `source` values covering at least two corpus tiers -
  `parseSummarySnippets`, `parseContextDecisions` and `parseCaptureSnippets` in
  `cadence-core/bin/lib/planning-files.mjs` are the readers that turn a
  SUMMARY bullet, a CONTEXT decision line and a CAPTURE bullet into one corpus
  row each, and `makeTree`'s `summaryBody`, `contextDecisions` and `capture`
  spec keys are what write them. The corpus MUST hold, as SEPARATE documents,
  one document carrying only the inflected form and one carrying only the base
  form for each of seam/seams, close/closes, file/files, note/notes,
  type/types, name/named/naming, refuse/refused and plan/planned, plus a
  document containing `notes` and a document containing `being`. Everything
  else is ordinary Cadence-flavoured prose acting as distractors, so a query
  ranks rather than trivially matching the only candidate.
  `recall.queries.json` is an array of objects carrying `query` and `hits`, the
  ids that must appear in the top 5 of that query. At least 10 entries. Generate
  every `hits` list by RUNNING the seam against the built root, never by hand -
  a hand-guessed baseline is not a no-regression claim.
  The test file materializes the corpus into a temp planning root through
  `makeTree` (exported from `./planning.test.mjs`) and runs the seam through the
  `recall` runner that already lives in `./planning-recall.test.mjs`: add
  `export` to that existing function and change nothing else in that file. Do
  NOT copy the runner - that file's own header states the no-copy rule, and the
  runner pins `CADENCE_GLOBAL_CONFIG` off a nonexistent path so a developer's
  real global config cannot flip results locally while CI stays green. Assert as
  its own arm that every materialized document comes back under the `source` its
  fixture row states, so a mapping that quietly puts a document in the wrong
  tier fails here rather than silently weakening every later arm.
  Register the new stem in `GROUPS` under `planning` in
  `cadence-core/bin/test.mjs`, beside `planning-recall` and `bm25` (D-08): an
  unregistered stem bins into `other`, so the suite still passes while these
  arms run outside the cell that covers this seam.
- **Verify:** `node cadence-core/bin/test.mjs --list` prints the new stem in the
  `planning` group and not in `other`; `node cadence-core/bin/test.mjs planning`
  is green with no fold in `tokenize` yet; and editing one entry's `hits` in
  `recall.queries.json` to name a document that is not in that query's top 5
  makes `node --test cadence-core/bin/planning-recall-fold.test.mjs` fail,
  proving the arm reads the fixture rather than passing vacuously (revert the
  edit).

### Task 2: Fold suffixes inside tokenize(), and move the fixture entries the fold changes

- **Files:** cadence-core/bin/lib/bm25.mjs (`tokenize` and the module header),
  cadence-core/bin/fixtures/recall.queries.json
- **Action:** Apply a deterministic suffix fold as the LAST step of `tokenize`,
  after the existing stopword `filter` and never before it (D-03): folding first
  sends `being` to `be` and `noted` to `not`, both members of `STOPWORDS`, which
  would delete those terms from the index and make a query for `notes` return
  nothing rather than return less than it should - strictly worse than today's
  no-fold behaviour.
  The rule set is Porter step 1a followed by step 1b (D-02). Step 1a, in this
  order: `sses` becomes `ss`, `ies` becomes `i`, a final `ss` is kept, an
  otherwise-final `s` is dropped. `es` is NEVER a rule of its own - measured
  2026-08-27 over the live corpus, an `es`-before-`s` strip gives `closes` to
  `clos` against `close` to `close`, a miss on the roadmap's own worked example,
  and it splits file/files, note/notes, type/types and change/changes. Step 1b:
  `eed` loses its `d` only when the stem before the suffix has measure greater
  than zero; otherwise a final `ed` or `ing` is stripped only when the remaining
  stem contains a vowel, and a strip that fired is followed by its cleanup - a
  stem left ending `at`, `bl` or `iz` takes back an `e`, otherwise a doubled
  final consonant that is not `l`, `s` or `z` loses one letter, otherwise a stem
  ending consonant-vowel-consonant whose last letter is not `w`, `x` or `y`
  takes back an `e`.
  MEASURED 2026-08-27, and it refines D-02: the textbook gate that restricts
  that last restoration to stems of measure exactly one must NOT be applied.
  With the gate, `refused` folds to `refus` while `refuse` stays `refuse`, which
  fails the refuse/refused pair D-02 names and AC2 pins; without it both fold to
  `refuse`, and remove/removed joins too. Every other pair D-02 names holds
  either way.
  ONE fold site (D-01). Keep the fold a module-local helper called only by
  `tokenize` - do not export it, and do not call it from `buildIndex`, from
  `search` or from `cadence-core/bin/planning/recall.mjs`. "Identical at index
  time and query time" must be a property of there being one code path, not of
  two sites agreeing, because nothing in the suite would catch a one-sided edit
  to two sites, and that drift is exactly what RCL-08 exists to close. No I/O,
  no `Date`, no randomness, no dependency: the module's determinism is what
  `recall`'s byte-stable output rests on.
  Rewrite the two prose claims the fold makes false - the module header's `no
  stemming` and the `tokenize` docstring's `No stemming - "recall" and
  "recalling" are distinct terms`. These comments are the design record: state
  the rule set, the single fold site with its reason, and the
  stopword-before-fold ordering with the measured reason above.
  In the SAME commit, edit ONLY those `recall.queries.json` entries whose named
  hits the fold actually moves out of the top 5: replace that entry's `hits`
  with the post-fold ones and add a `changed_by_fold` string naming what moved.
  A split commit would leave the tree red, and this way the file's diff IS the
  record of what the fold changed. The fixture pins named known-good hits and
  never a byte-identical top 5, because the fold changes `df`, `idf` and the
  matched set by construction (D-04). Do not mark an entry that did not move,
  and do not relax an entry's hits to make it pass - that is the weakening D-04
  exists to forbid.
- **Verify:** `node cadence-core/bin/test.mjs` is green and
  `node cadence-core/bin/self-verify.mjs` reports `ok:true`; at least 6 entries
  in `recall.queries.json` carry no `changed_by_fold` key and still name the
  exact `hits` task 1 committed, so `git diff` of that file in this commit
  touches fewer than half its entries. Measured baseline for this task: applied
  to a copy of this tree, this fold left the full suite's failure set
  byte-identical to the unfolded run, so an existing arm going red here means
  the rule set diverged from the one above rather than that the arm needed
  updating.

### Task 3: Pin the rule table at tokenizer level, including the ordering that was refuted

- **Files:** cadence-core/bin/planning-recall-fold.test.mjs
- **Action:** Add arms that call `tokenize` from `./lib/bm25.mjs` directly and
  assert one row per rule, so the rule set is pinned independently of any
  corpus and a later "simplification" fails here instead of surfacing as a
  ranking regression nobody can read. Cover step 1a's four rows, step 1b's two
  strips and its `eed` guard, and each of the three cleanup branches. Include
  the NEGATIVE that closes D-02's refuted reading: `es` is not a rule of its
  own, so `closes` folds to `close` and never to `clos`. Assert only forms you
  have run; a form outside steps 1a and 1b is deliberately left distinct and
  must not be asserted as matching.
- **Verify:** `node --test cadence-core/bin/planning-recall-fold.test.mjs` is
  green with arms showing `closes` folding to `close` (not `clos`), `classes`
  to `class`, `pass` staying `pass`, `notes` to `note`, `seams` to `seam`,
  `named` and `naming` to `name`, `refused` to `refuse`, `planned` to `plan`,
  `running` to `run`, `gated` to `gate`, `agreed` to `agree` and `freed`
  staying `freed`.

### Task 4: Prove each inflected pair returns the same documents over the fixture corpus

- **Files:** cadence-core/bin/planning-recall-fold.test.mjs
- **Action:** Add seam-level arms over the fixture root for each equivalence
  group - seam/seams, close/closes, file/files, note/notes, type/types,
  name/named/naming, refuse/refused, plan/planned. For each group, run the seam
  once per member and assert the returned `results` arrays are deep-equal across
  the group and the `total` values are equal, which settles the whole matched
  document set and not just the returned window. Assert each group's result set
  is NON-EMPTY, or the deep-equality passes vacuously on two empty arrays. Then
  the sharp arm each group exists for: the document carrying ONLY the other form
  is among the hits, located by its fixture `id` appearing in the returned
  `snippet`, so a group cannot pass by returning only documents that already
  shared a literal term.
- **Verify:** `node --test cadence-core/bin/planning-recall-fold.test.mjs` is
  green, and its output shows for `seam` a result set deep-equal to `seams`'s,
  with equal `total`, containing the id of the fixture document that carries
  `seams` and not `seam` - and the corresponding arm for each of the other seven
  groups.

### Task 5: Prove the stopword filter still tests the raw token

- **Files:** cadence-core/bin/planning-recall-fold.test.mjs
- **Action:** Add the arms that make D-03's ordering falsifiable rather than
  merely intended. Import `STOPWORDS`, `tokenize` and `buildIndex` from
  `./lib/bm25.mjs` and show that indexing a document whose only word is `being`
  puts a term in the index that is ITSELF a member of `STOPWORDS`, which can
  only be true if the filter ran before the fold. Add the same shape for
  `noted`. At the seam, show that a query for `notes` over the fixture corpus
  returns a non-empty result set and so does a query for `being`. Add the guard
  in the other direction too - a document of raw stopwords alone still
  contributes no terms - so the arms above cannot be satisfied by a filter that
  simply stopped running.
- **Verify:** `node --test cadence-core/bin/planning-recall-fold.test.mjs` is
  green with arms showing the folded form of `being` present in the index built
  from it while `STOPWORDS` also contains that form, a `notes` query and a
  `being` query each returning `total` of at least 1 over the fixture corpus,
  and a stopword-only text tokenizing to nothing; then
  `node cadence-core/bin/test.mjs` is green and
  `node cadence-core/bin/self-verify.mjs` reports `ok:true`.

## Notes

**The SUMMARY owes AC5, and no task can write it.** `.planning/phases/5/SUMMARY.md`
is written by the execute workflow's summary step, outside the task loop, so it
is recorded here instead. Its `## Open items` must carry GH-93 items 2 and 3,
each naming why it was not delivered:

- GH-93 item 2, the multi-query union, is not delivered: it changes the `recall`
  seam signature, which `cadence-core/references/recall.md` pins for three
  callers - `/cad-context` at `spend_gate`, `/cad-debug` at Hypothesize and
  `/cad-plan` at `spawn_planner`.
- GH-93 item 3, the failure records outside the corpus, is not delivered: it
  needs a scope decision this cycle did not take, and three measured obstacles
  sit under its phrasing. First, `parseSummarySnippets` returns 0 on every live
  `reports/plan-<k>.md`, so it cannot be reused for that tier. Second,
  `REVIEW-*.md` files are JSON with a markdown extension holding RAW findings,
  while the adjudicated rulings GH-93 asks for live in `ADJUDICATION-*.json`
  beside them. Third, any new tier inside `phases/<N>/` needs `milestone-prune`'s
  residue walk extended, or it goes unreachable at the next milestone close -
  the exact defect RCL-07 closed.

**One plan, matching the CONTEXT `Plan shape` directive.** Five tasks over six
files with heavy sharing - tasks 1, 3, 4 and 5 all write the same new test file
and task 2 rewrites the query fixture task 1 committed - so no independent slice
exists and a split would be a shared-file split.

**`cadence-core/bin/planning-recall.test.mjs` is declared for exactly one edit**:
adding `export` to its existing `recall` runner. Measured 2026-08-27, applying
this fold to a copy of this tree changed no existing arm's result anywhere in
the suite, so no legacy expectation needs moving. If one goes red, the fold
diverged from task 2's rule set; fix the fold, not the arm.

**Measured and deliberately not claimed**: `verify`/`verifies` do NOT fold
together (step 1a sends `verifies` to `verifi` while `verify` is untouched),
and neither do `release`/`released` or `index`/`indices`. CONTEXT's last flagged
assumption already states that forms outside steps 1a and 1b stay distinct.
Do not put any of those pairs in the fixture as a known-good equivalence.
