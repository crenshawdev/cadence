# Phase 5: Recall matches the word the user typed - Context

Gathered: 2026-08-27
Feeds: /cad-plan 5

## Scope boundary

In: a deterministic suffix fold inside `tokenize()` in
`cadence-core/bin/lib/bm25.mjs`, so `recall` matches `seams` for `seam` and
`named` for `name`, plus a committed fixture corpus and fixture query set that
prove the ranking did not regress, and the test file's registration in
`cadence-core/bin/test.mjs`'s `planning` group.
Out: GH-93 item 2, the multi-query union - it changes the `recall` seam
signature, which `cadence-core/references/recall.md:16-33` pins for three
callers (`/cad-context` spend_gate, `/cad-debug` Hypothesize, `/cad-plan`
spawn_planner). Out: GH-93 item 3, the failure records outside the corpus - it
needs a scope decision this cycle did not take, and the analyzer measured three
obstacles its phrasing hides (below). Out: any change to the return shape, the
`--top 5` bound or the `recall` argument row - `cadence-core/workflows/plan.md:129`
pipes the envelope to `cite-count`, which a shape change breaks and a ranking
change does not. Out: a recency term or a per-source cap on the ranking, which
`v3.5.3` D-05 (RCL-07) settled as the caller's job.
Deferred: none - the size check returned one plan with nothing cut.
Plan shape: one plan

## Durable decisions

- D-01 (fold site): The fold is applied INSIDE `tokenize()`, so "identically at
  index time and query time" is a property of there being ONE code path rather
  than of two sites agreeing. `tokenize` is the only tokenizer, `buildIndex`
  calls it and `search` calls it, and its one other importer in the tree is its
  own test - so `cadence-core/bin/planning/recall.mjs` needs no edit. Rejected:
  a fold exported separately and applied by `buildIndex` and `search` in two
  places, which re-creates exactly the index/query drift RCL-08 exists to close
  with nothing in the suite catching a one-sided edit; and query-side expansion
  (`seam` -> `seam OR seams`), which leaves existing scores untouched but needs
  a vocabulary of the index to expand against. Evidence:
  `cadence-core/bin/lib/bm25.mjs:23-28`, `:43`, `:66`;
  `cadence-core/bin/bm25.test.mjs:5`.
- D-02 (rule set): The rule set is Porter step 1a ordering - `sses`->`ss`,
  `ies`->`i`, `ss` kept, `s`->'' - with `es` NEVER stripped as its own rule,
  plus step 1b's cleanup (restore `e` after `at`/`bl`/`iz`, undouble a final
  consonant). GH-93's literal list (`s` / `es` / `ing` / `ed` as independent
  strips in that order) is REFUTED: measured 2026-08-27 over the live corpus
  (1,100 docs, 27,987 tokens, 3,239 distinct types), an `es`-before-`s` strip
  gives `close`->`close` but `closes`->`clos`, a MISS on the roadmap's own
  worked example, and splits `file`/`files`, `note`/`notes`, `type`/`types` and
  `change`/`changes`. Step 1b is included by the user's call 2026-08-27 rather
  than deferred: without it `named`->`nam` and `naming`->`nam` match each other
  while `name`->`name` misses both, and the same holds for `plan`/`planned`,
  `run`/`running` and `refuse`/`refused`. Evidence:
  `cadence-core/bin/lib/bm25.mjs:20`; `.planning/ROADMAP.md:108`;
  `.planning/REQUIREMENTS.md:403-404`.
- D-03 (stopword order): The stopword filter keeps testing the RAW token,
  BEFORE the fold. Measured 2026-08-27 against `STOPWORDS`: folding first sends
  `being`->`be` (6 occurrences) and `noted`->`not` (1) onto stopwords under
  Porter 1a, and `notes`->`not` (11 occurrences) under the refuted `es`-first
  rule. Filtering after the fold would delete every `notes` and `being` from the
  index, so a query for `notes` returns NOTHING rather than returning less than
  it should - strictly worse than today's no-stemming behavior. Evidence:
  `cadence-core/bin/lib/bm25.mjs:12-16`, `:27`.
- D-04 (what "no regression" means): The fixture pins NAMED known-good hits,
  never a byte-identical top 5. The fold changes `df`, `idf` and the matched set
  by construction. Measured 2026-08-27 over ten representative queries: totals
  move (`seam` 45 -> 58, `seams` 17 -> 58, `trace rotation claim` 116 -> 137),
  top-5 membership holds 5/5 on six queries, 3/5 on `seam`, 2/5 on
  `capture bullet lost` and 0/5 on `seams` - that last being the fix landing -
  and four of the ten change top-5 ORDER even where membership holds. A
  golden-output comparison would go red the first time the fold correctly
  promotes a document and get weakened at the first executor task. Evidence:
  `cadence-core/bin/planning/recall.mjs:186-200`, which rounds scores to 1e-4
  for byte-stability and so pins the FORMAT and not the ranking.

## Decisions

- D-05 (fixture corpus): The committed fixture corpus is a BUILT one under
  `cadence-core/bin/fixtures/`, not this repository's live `.planning/`. The
  live corpus grew by every SUMMARY, UAT and CONTEXT this cycle wrote, and
  `cadence-core/bin/why-corpus.test.mjs:95-98` states the counter-case's own
  reason: pinning the live tier "reddens at every close for a reason that is not
  about the walk". Precedent for built fixtures:
  `cadence-core/bin/fixtures/join.trace.jsonl` and `why.chain-worst.json`,
  consumed by `trace.test.mjs:2802` and `why-record.test.mjs:359`; all 30
  existing cases in `cadence-core/bin/planning-recall.test.mjs` build temp roots.
- D-06 (the two undelivered items): GH-93 items 2 and 3 are RECORDED as open
  items naming why, not delivered. The reasons are already written down rather
  than this phase's to invent. Evidence: `.planning/REQUIREMENTS.md:403-411`
  carries the split verbatim; `:42-43` scopes the cycle to RCL-08 alone;
  `.planning/ROADMAP.md:104` lists RCL-08 as the phase's only requirement.
- D-07 (seam contract untouched): The return shape
  `{ok, results:[{score, source, phase?, snippet}], total}`, the `--top 5`
  bound and the `recall` argument row are unchanged; only `total` and the
  ranking move. Evidence: `cadence-core/references/recall.md:16-33`;
  `cadence-core/bin/lib/arg-contract.mjs:650-652`;
  `cadence-core/bin/planning.mjs:275`; `cadence-core/workflows/plan.md:129`,
  `:137-139`.
- D-08 (test registration): The new test file's stem is registered in
  `cadence-core/bin/test.mjs`'s `GROUPS` under `planning`, beside `bm25` and
  `planning-recall`. An unregistered stem bins into `other`, so the suite still
  passes while the new arms run outside the cell that covers the seam. Evidence:
  `cadence-core/bin/test.mjs:43-76`, `:52-59`, `:85-88`.

## Acceptance criteria

- [ ] AC1: Over the committed fixture corpus, `planning.mjs recall` returns the
      same document set for each of `seam`/`seams`, `close`/`closes`,
      `file`/`files`, `note`/`notes` and `type`/`types`.
- [ ] AC2: Over that same corpus, `name`, `named` and `naming` return the same
      document set, and so do `refuse`/`refused` and `plan`/`planned`.
- [ ] AC3: A query for `notes` returns a non-empty result set and the term
      `notes` is present in the built index; `being` likewise. The stopword
      filter still tests the raw token, so the fold cannot delete a term by
      landing it on a stopword.
- [ ] AC4: A committed fixture query set names its known-good top hits and runs
      under `node cadence-core/bin/test.mjs`. Each query's named hits appear in
      its top 5, except the queries the fixture explicitly marks as changed by
      the fold.
- [ ] AC5: The phase's SUMMARY records GH-93 items 2 and 3 as open items, each
      naming why it was not delivered, and states all three item-3 obstacles:
      `parseSummarySnippets` returning 0 on live `reports/plan-<k>.md`,
      `REVIEW-*.md` being JSON whose adjudicated rulings live in
      `ADJUDICATION-*.json`, and `milestone-prune`'s residue walk needing
      extension for any new tier.
- [ ] AC6: `node cadence-core/bin/test.mjs` is green,
      `node cadence-core/bin/self-verify.mjs` reports `ok:true`, and the new
      test file's stem is registered in `test.mjs`'s `planning` group rather
      than falling into `other`.

## Flagged assumptions

- If GH-93 item 3 is ever delivered, `parseSummarySnippets` CANNOT be reused for
  `reports/plan-<k>.md`: measured 2026-08-27 over all four live reports
  (1,971-7,171 bytes), it returns 0 on every one. The reports write a bare
  `Deviations:` label, never the `## Deviations` heading
  `cadence-core/bin/lib/planning-files.mjs:808` splits on, and phase 4's
  deviations are `[deviation]`-prefixed with no leading `- ` bullet, which
  `:812` requires. Confident; if wrong: an implementation that "adds the reports
  tier" by pointing the existing parser at a new path adds a walk that indexes
  nothing and passes a test written against a hand-built SUMMARY-shaped fixture.
- `REVIEW-*.md` files are JSON with a markdown extension holding the reviewer's
  RAW findings; the ADJUDICATED rulings GH-93 asks for live in
  `ADJUDICATION-*.json` beside them. Measured 2026-08-27 across all 18
  `REVIEW-*.md` under `.planning/`: 17 parse as JSON, exactly one
  (`_archive-v2.2.0/1/REVIEW-diff-plan-1.md`) is prose, and the four live ones
  hold 1 finding total against ten in the seven `ADJUDICATION-*.json`.
  Confident; if wrong: a scope decision written from GH-93's phrasing indexes a
  JSON blob as prose and reaches one finding while the record holding ten sits
  unindexed. Evidence: `cadence-core/bin/lib/adjudication-record.mjs:1-58`.
- Any NEW corpus tier inside `phases/<N>/` also needs `milestone-prune`'s
  residue walk extended, or it becomes unreachable at the next milestone close -
  the exact defect RCL-07 closed. `cadence-core/bin/planning/milestone-prune.mjs:134-200`
  reads SUMMARY, UAT and CONTEXT only before deleting the directories, and
  `cmdRecall` walks `dir/phases` alone, never `_archive-v*/`, so the 36 archived
  reports and 14 archived reviews on disk are out of reach regardless.
  Confident; if wrong: a tier ships, works for one cycle, and goes silently
  empty at the close, reproducing #203 with a new artifact. Evidence:
  `.planning/REQUIREMENTS.md:244`.
- New corpus sources would degrade cleanly through `cite-count` rather than
  crashing it, but they DO grow its `unkinded` list and contradict a comment and
  a test asserting the corpus has exactly four artifacts. Not triggered by this
  phase, which adds no tier. Confident; if wrong: `cite-count`'s per-arm
  breakdown stops reconciling with its headline for any plan whose recall pass
  surfaced a new row. Evidence: `cadence-core/bin/lib/cite-surfaced.mjs:73-82`,
  `:139`; `cadence-core/bin/cite-surfaced.test.mjs:157`.
- Porter step 1b's cleanup unifies the `-e` verb class but is not a complete
  stemmer: forms outside steps 1a and 1b (`-ly`, `-tion`, `-ness`, irregular
  plurals like `indices`) stay distinct terms. Likely; if wrong: a user typing
  `verification` still misses `verify`, which no acceptance criterion here
  claims to close.
