---
phase: 1
plan: 1
requirements: [RCL-01, RCL-02, RCL-03, RCL-05]
files: [cadence-core/config.schema.json, cadence-core/templates/config.json, .planning/config.json, cadence-core/bin/lib/planning-files.mjs, cadence-core/bin/lib/bm25.mjs, cadence-core/bin/bm25.test.mjs, cadence-core/bin/planning.mjs, cadence-core/bin/self-verify.mjs, cadence-core/bin/planning.test.mjs, cadence-core/workflows/config.md, skills/cad-capture/SKILL.md, README.md]
---

# Phase 1: Recall engine - Plan

## Goal

Project memory becomes queryable: a zero-dep, deterministic BM25 `recall`
subcommand on `planning.mjs` ranks item-level snippets from `.planning/`
artifacts, honors `memory.backend`, and is drift-linted and tested like every
other seam. After this phase a human can query project memory from the CLI,
though no skill consumes it yet (that is phase 2).

## Must be true when done

- `node cadence-core/bin/planning.mjs recall "<term>"` over a populated
  `.planning/` prints exactly one JSON line, `ok:true`, with the snippet
  containing that term ranked first, carrying its source file and (when the
  snippet is phase-attributed) its phase.
- Two identical recall runs on the same corpus print byte-identical stdout.
- recall over an absent or empty `.planning/` corpus prints
  `{"ok":true,"results":[]}` and exits 0 (never an error).
- With effective `memory.backend: none`, recall prints an explicit
  backend-off field and no results, exit 0.
- `config.schema.json` lists `memory.backend` values `["none","builtin"]`
  with default `builtin`; the engine template and this repo's
  `.planning/config.json` both read `builtin`.
- `node --test 'cadence-core/bin/*.test.mjs'` passes (new BM25 and recall
  tests included) and `node cadence-core/bin/self-verify.mjs` exits 0 with a
  `recall` CONTRACTS entry; the config.md, cad-capture, and README surfaces no
  longer claim only `none` is wired.

## Context

Locked decisions from CONTEXT.md bind this plan: recall joins the
planning.mjs COMMANDS dispatch, positional query, `--dir` honored, one JSON
line via seam-io, exit 0 on `ok:true` (D-01); empty/absent corpus is a
success with `results:[]`, NOT cmdStatus's `no-planning-dir` failure (D-02);
`memory.backend: none` returns `ok:true` with an explicit backend-off field,
mirroring cmdPlanOverlap's "successful check, negative answer" (D-03); the
drift-lint obligation is the CONTRACTS entry alone and `recall` stays out of
`TWO_WORD` (D-04); the indexed corpus is exactly `phases/*/SUMMARY.md`,
`.planning/CAPTURE.md`, `phases/*/UAT.md`, and the Decisions section of
`phases/*/CONTEXT.md` (D-05); documents are item-level snippets, one per
SUMMARY deviation/open-item bullet, CAPTURE line, UAT item, or D-NN decision
line (D-06); phase attribution comes from the `phases/<N>/` segment and
`(phase N)` CAPTURE tags, omitted when phaseless (D-07); new corpus parsers
live in `lib/planning-files.mjs` and UAT reuses `parseUat` (D-08); the schema
enum/default flip touches `config.schema.json`, `templates/config.json`, and
this repo's `.planning/config.json` (D-09); recall reads the effective backend
via `mergeLayers`, tests pin `CADENCE_GLOBAL_CONFIG` (D-10); `builtin` is
read-side only, CAPTURE.md stays the write path, and the three prose surfaces
lose the "only none wired" claim (D-11); determinism comes from sorted
traversal and a total result order (score desc, then corpus position asc over
the sorted-traversal corpus) with no timestamps (D-12); recall tests live in planning.test.mjs with an extended
makeTree fixture (D-13); BM25 uses textbook k1=1.2, b=0.75, lowercase
alphanumeric tokenization, a small fixed English stopword list, no stemming
(D-14).

Out of scope this phase: consumer injection (cad-context/planner/debug) is
phase 2; external backends are v2; no write-path change to CAPTURE.md.

Planner discretion recorded: BM25 ranking math lives in a dedicated pure
module `lib/bm25.mjs` (IR math, not `.planning` grammar) with its own
`bm25.test.mjs` for reference-value checks; the recall integration tests
(ranking-through-the-seam, empty corpus, determinism, backend-off) live in
planning.test.mjs exactly as D-13 requires.

## Tasks

### Task 1: Flip `memory.backend` to a wired `builtin` default

- **Files:** cadence-core/config.schema.json, cadence-core/templates/config.json, .planning/config.json
- **Action:** In `config.schema.json`, change the `memory.backend` key so
  `values` is `["none", "builtin"]`, `default` is `"builtin"`, and its
  `purpose` reflects that `builtin` runs zero-dep BM25 recall over `.planning/`
  while `none` disables recall (keep the `"src": "repo"` marker). In both
  `cadence-core/templates/config.json` and `.planning/config.json`, set
  `"memory": { "backend": "builtin" }`. Do not touch any other key. This is
  the backend contract every consumer and the recall gate read; the repo layer
  beating the schema default is why both explicit pins flip too (D-09).
- **Verify:** `node cadence-core/bin/config.mjs validate --file .planning/config.json`
  exits 0; `node -e "const s=require('./cadence-core/config.schema.json').keys['memory.backend']; if(JSON.stringify(s.values)!=='[\"none\",\"builtin\"]'||s.default!=='builtin')process.exit(1)"`
  exits 0; `grep -c '"backend": "builtin"' cadence-core/templates/config.json .planning/config.json` shows 1 each.

### Task 2: Corpus snippet parsers in `lib/planning-files.mjs`

- **Files:** cadence-core/bin/lib/planning-files.mjs
- **Action:** Add three exported, zero-dep parsers that turn `.planning`
  artifacts into item-level snippet strings, plus reuse of `parseUat` at the
  call site. (a) `parseSummarySnippets(text)` returns the bullet lines under
  `## Deviations` and `## Open items` (strip the leading `- ` and any
  `[deviation]` tag), skipping the template placeholders that start with
  `None` / `<`. (b) `parseCaptureSnippets(text)` returns `{text, phase}` for
  every `- ` bullet under `## Todos`, `## Seeds`, `## Notes`, stripping a
  leading `[ ]` checkbox and a leading `(phase N)` tag into the numeric
  `phase` field (phase omitted when no tag; decimal phase numbers legal).
  (c) `parseContextDecisions(text)` returns the `- D-NN (...): ...` lines from
  the `## Decisions` section, matched by `/^- D-\d+(?:\.\d+)?\b/`, stripped of
  the leading `- `. Each parser scopes to its section using the existing
  `text.split(/^## Heading\s*$/m)` idiom already used by `parseRequirements`;
  all return `[]` when the section is absent (absence is data, never a throw).
  Keep these beside the other `.planning` grammar per the file's
  single-grammar-home contract (D-08).
- **Verify:** `node -e "import('./cadence-core/bin/lib/planning-files.mjs').then(m=>{const s=m.parseSummarySnippets('## Deviations\n\n- [deviation] token-killer race fixed abc123\n\n## Open items\n\n- None.\n');if(s.length!==1||!/token-killer/.test(s[0]))process.exit(1);const c=m.parseCaptureSnippets('## Todos\n\n- [ ] (phase 2) wire recall\n\n## Notes\n\n- 2026-07-16 a note\n');if(c[0].phase!==2||c[1].phase!==undefined)process.exit(1);const d=m.parseContextDecisions('## Decisions\n\n- D-03 (surface): backend none returns ok true. Evidence: x\n');if(d.length!==1||!/backend none/.test(d[0]))process.exit(1)})"`
  exits 0.

### Task 3: BM25 ranking module `lib/bm25.mjs` with reference tests

- **Files:** cadence-core/bin/lib/bm25.mjs, cadence-core/bin/bm25.test.mjs
- **Action:** Create `lib/bm25.mjs`, a pure zero-dep (`// @ts-check`, node:
  builtins only) BM25 ranker. Export `tokenize(text)` (lowercase, split on
  `/[^a-z0-9]+/`, drop empties and a small fixed English `STOPWORDS` set of
  ~30 words such as a/an/the/and/or/of/to/in/is/it/for/on/with/as/by/at/be/
  are/was/that/this/from/but/not/no; no stemming), `buildIndex(docs)` (docs =
  array of strings; precompute per-doc term frequencies, document lengths,
  average length, and document frequency per term), and
  `search(index, query, {k1=1.2, b=0.75}={})` returning
  `[{i, score}]` for every doc with score > 0, sorted score descending then
  `i` ascending (a stable, deterministic total order). Use the textbook BM25
  idf `ln(1 + (N - df + 0.5)/(df + 0.5))` and the k1/b saturation term
  verbatim (D-14). No `Date`, no randomness, no I/O. Then write
  `bm25.test.mjs` (node:test, node:assert/strict): assert a doc containing a
  query term outranks one that does not; assert stopword-only queries return
  `[]`; assert a hand-computed score on a two-doc corpus matches the BM25
  formula within a 1e-9 tolerance; assert two `search` calls on the same index
  return deep-equal arrays (determinism).
- **Verify:** `node --test cadence-core/bin/bm25.test.mjs` passes.

### Task 4: `recall` subcommand on `planning.mjs` + CONTRACTS entry

- **Files:** cadence-core/bin/planning.mjs, cadence-core/bin/self-verify.mjs
- **Action:** Add `cmdRecall(dir, opts, query)` and wire `recall:` into the
  `COMMANDS` dispatch table; keep `recall` out of `TWO_WORD` (D-04). Import
  `mergeLayers` from `./lib/config-merge.mjs`, `buildIndex`/`search` from
  `./lib/bm25.mjs`, and the three new parsers plus `parseUat` from
  planning-files. Behavior: (1) require a positional query - a missing/empty
  query returns `fail('bad-args', 'recall needs a query')`. (2) Read the
  effective backend: `mergeLayers(join(dir, 'config.json')).config?.memory?.backend ?? 'builtin'`;
  if it is `'none'`, emit `{ ok:true, backend:'none', results:[] }` (exit 0) -
  a successful check with a negative answer, matching cmdPlanOverlap (D-03).
  (3) Gather the corpus (D-05) with sorted traversal (never raw readdirSync
  order, D-12): guard the listing itself first - if `.planning/` or
  `.planning/phases/` is absent, treat the listing as empty rather than
  letting `readdirSync` throw (ENOENT would surface as `fail('internal')`,
  breaking the must-be-true `{ok:true,results:[]}` contract); then sort
  `phases/*` dir entries numerically (decimal-aware, like
  derivePhases), and for each phase dir collect `parseSummarySnippets`,
  `parseUat().items` (snippet = `name` joined with `expected`), and
  `parseContextDecisions` on CONTEXT.md, each tagged with `source`
  (`phases/<N>/SUMMARY.md`, `phases/<N>/UAT.md`, `phases/<N>/CONTEXT.md`) and
  numeric `phase` from the dir segment; then top-level `.planning/CAPTURE.md`
  via `parseCaptureSnippets` (source `CAPTURE.md`, phase from the `(phase N)`
  tag when present). Absent files yield nothing (reuse the module `read`
  helper). (4) If the corpus is empty, emit `{ ok:true, results:[] }` (D-02).
  (5) Otherwise `buildIndex` over the snippet texts, `search` the query, and
  emit `{ ok:true, results }` where each result is
  `{ score, source, ...(phase!==undefined?{phase}:{}), snippet }` with `score`
  rounded to 4 decimals; the result order is `search`'s own (score desc, then
  corpus position `i` asc, D-12) - already a total order because the corpus is
  assembled in sorted traversal order, so cmdRecall must NOT re-sort; ties
  between equal-score snippets resolve by corpus position, never by object
  insertion accident. Emit only via the
  existing `ok`/`fail` seam-io wrappers; never call `process.exit`. Then in
  `self-verify.mjs` add `recall: []` to `CONTRACTS['planning.mjs']` (the
  `--dir` global flag is already covered by `'*'`), satisfying RCL-05's
  contract-entry obligation (D-04).
- **Verify:** `printf '# Roadmap\n\n## Phases\n\n- [ ] **Phase 1: X** - d\n' > /tmp/rc/.planning/ROADMAP.md` style fixtures are exercised by Task 5; here run `node cadence-core/bin/self-verify.mjs` and confirm it exits 0 with `problems: []`, and `node cadence-core/bin/planning.mjs recall` (no query) prints `{"ok":false,"reason":"bad-args",...}` and exits 1.

### Task 5: recall integration tests in `planning.test.mjs`

- **Files:** cadence-core/bin/planning.test.mjs
- **Action:** Extend `makeTree` (backward-compatibly - only emit new bodies
  when the new fields are present, so every existing status/uat/renumber test
  keeps passing): when `ph.summaryBody` is given write a SUMMARY.md with real
  `## Deviations` / `## Open items` bullets; add a top-level `spec.capture`
  array of `{section: 'Todos'|'Seeds'|'Notes', text, phase?}` objects, each
  written under its named heading in `.planning/CAPTURE.md` (todos with a
  `(phase N)` tag when `phase` is given); add a top-level `spec.config`
  object written verbatim to `.planning/config.json` when present (used by
  test (d)); when `ph.contextDecisions` is given write a
  `phases/<N>/CONTEXT.md` with a `## Decisions` section of `- D-NN (...): ...`
  lines. Add a `recall(query, dir)` runner alongside `run` that invokes
  `planning.mjs recall <query> --dir <dir>` with
  `env: { ...process.env, CADENCE_GLOBAL_CONFIG: <nonexistent path> }` for
  hermeticity (D-10; the plain `run` helper sets no env and cannot pin the
  global layer) and returns both the parsed JSON and the raw stdout string.
  Add tests: (a) ranking - a fixture whose phase-1 SUMMARY deviation contains
  a distinctive term returns `ok:true` with that snippet first, its result
  carrying `source: 'phases/1/SUMMARY.md'` and `phase: 1`; (b) empty/absent -
  recall on a tree with no `.planning` and on a tree with an empty corpus both
  return `{ ok:true, results:[] }` exit 0; (c) determinism - two recall runs on
  the same corpus produce byte-identical raw stdout; (d) backend-off - a
  fixture whose `.planning/config.json` sets `memory.backend: none` returns
  `ok:true` with `backend:'none'` and empty `results`, exit 0. Assert exit
  codes via the captured status as the existing helpers do.
- **Verify:** `node --test 'cadence-core/bin/*.test.mjs'` passes (all prior
  tests plus the four new recall tests).

### Task 6: Update the three prose surfaces that claim only `none` is wired

- **Files:** cadence-core/workflows/config.md, skills/cad-capture/SKILL.md, README.md
- **Action:** In `config.md`, edit the `memory.backend` catalog row: values
  `none | builtin`, default `builtin`, and a purpose describing
  `builtin`→zero-dep BM25 recall over `.planning/` and `none`→recall off (drop
  the "only value wired today" clause). In `skills/cad-capture/SKILL.md`,
  reword the process-step-3 note and the objective/description so they no
  longer say `memory.backend` "currently wires only `none`": state that
  `builtin` is the default backend, that CAPTURE.md remains the write path
  (`builtin` is read-side only - it makes captured notes recallable, it does
  not change where they are written, D-11), and keep the actual capture
  behavior unchanged. In `README.md`, edit the "Built-in minimal memory"
  bullet so `memory.backend` reads as an active `builtin` default that makes
  `.planning/` queryable via recall, with `none` the off switch and external
  backends still reserved (remove "only `none` ships today"). Introduce no new
  dotted config tokens, script invocations, or `${CLAUDE_PLUGIN_ROOT}` paths
  beyond ones that already resolve, so the drift linter stays green.
- **Verify:** `node cadence-core/bin/self-verify.mjs` exits 0 with
  `problems: []`; `grep -rn 'only.*none.*wired\|only.*none.*ships\|wires only' cadence-core/workflows/config.md skills/cad-capture/SKILL.md README.md`
  returns nothing.

## Notes

Determinism guard for the executor: recall output carries no date/timestamp
field and the result order is fully determined by (score desc, corpus
position asc over the sorted-traversal corpus - `search`'s own order, no
re-sort in cmdRecall), so the byte-identical criterion holds across runs
and across the Node 22/24 CI matrix. The `score` is rounded to 4 decimals to
keep stdout stable.
