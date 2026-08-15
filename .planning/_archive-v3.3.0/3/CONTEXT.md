# Phase 3: The scan's correctness gaps close - Context

Gathered: 2026-08-14
Feeds: /cad-plan 3

## Scope boundary

In: `COR-01` in all four of its halves - string-form `protected_branches`
honored identically by all four readers through one shared helper; the
fence-blind `## Phases` / `## Active` section scanners guarded against the
shape the shipped templates themselves carry; `--root ""` refused by
`detect-commands` and `detect-surfaces` exactly as `debt-harvest` refuses it;
and the copied helpers (`flag`/`flagValue`/`readText`, the
`rev-parse --abbrev-ref` branch reader) stated once and pinned by a census.

Out: phase 4's seams even where they touch the same files (`trace close`, the
bounded `trace render` default, batched round-trips, the read-instrumentation
join); fence-awareness for the roadmap WRITE paths (`setPhaseBox`,
`cutPhaseDetail`, the renumber list filter) - the reader/writer divergence is
accepted this phase per D-02; widening `config.schema.json`'s `array_string`
to admit the string form the readers will honor (D-08 keeps the validator
strict); migrating the five `flag` callers to `flagValue`'s throwing contract
(D-03); `git-publish`'s `tornLayerDetail` refusal breadth (a KEPT capture item
COR-01 does not name); and phases 5-6 (docs truth and voice).

Deferred: None.

Plan shape: multiple plans, same phase - AC1 and AC4 land together (the five
git bins and the helper extraction share files); AC2 and AC3 land together
(`planning-files.mjs` scanners and the `planning.mjs` root refusal). AC5 is a
gate on both.

## Durable decisions

- D-01 (protected): The shared `protected_branches` helper is a PURE coercion
  over an already-merged `git` block (`(git) => string[]`), never a helper
  that does its own `mergeLayers` - each of the four callsites merges a
  different thing and needs a different second answer off the same merge
  (`git-publish` needs `{branches, warnings, tornLayers}`, `git-guard` keys
  its torn-layer arm on `tornPrefixes`). Evidence: `git-guard.mjs:142-147`;
  `git-publish.mjs:88-100`; `git-branch.mjs:53-57`;
  `land-cleanup.mjs:100-105`; all four already import `./lib/config-merge.mjs`.
- D-02 (fences): The roadmap WRITE paths stay fence-blind this phase -
  `setPhaseBox` matches `- [ ] **Phase N:` with no fence state and can still
  tick a checkbox inside a code block. Criterion 2 names only the two
  classifiers; the reader/writer divergence is accepted deliberately rather
  than discovered later. The bridge the planner may take: one fence-aware
  `sectionLines(text, heading)` combinator consumed by both classifiers and
  `parseRoadmapPhases`, leaving writers untouched but making the later
  write-path fix one call. Evidence: `lib/planning-files.mjs:209-219`,
  `:1350-1356`.
- D-03 (args): `flag` and `flagValue` are two DIFFERENT contracts and both
  survive as separate exports in one home. The five `flag` callers are NOT
  migrated to the throwing `flagValue`: a valueless `--dir`/`--remote` today
  defaults via `flag(...) || fallback`, and migration would turn that into
  `{"ok":false,"reason":"internal","detail":"[object Object]"}` across five
  seams the phase never named (only `self-verify.mjs:1310-1316` carries the
  `e.seam` catch arm). Evidence: five byte-identical `flag` copies
  (`git-branch.mjs:77-80`, `git-publish.mjs:211-214`,
  `land-cleanup.mjs:161-164`, `release-bump.mjs:208-211`,
  `worktree-base.mjs:141-144`); two `flagValue` copies (`weight.mjs:46-55`,
  `self-verify.mjs:1294-1303`).
- D-04 (home): The helper home is a NEW args/fs lib module beside
  `lib/config-merge.mjs`, not an extension of `lib/seam-io.mjs`, whose header
  states an output-only boundary ("the ONE implementation of the seam OUTPUT
  convention"). User-decided over extending seam-io (the scan record's own
  routing) and over leaving `readText` unshared. `readText` has TWO contracts
  in-tree: the `''`-on-failure form shared by three bins moves into the new
  module; `lib/include-consumers.mjs:123-130`'s null-returning
  `isFile()`-guarded reader is a distinct contract and stays where it is,
  named by the census. Evidence: `lib/seam-io.mjs` header;
  `git-branch.mjs:33-36`, `land-cleanup.mjs:46-49`, `release-bump.mjs:59-62`;
  `self-verify.mjs:102-104` (lib modules take no CONTRACTS row).
- D-05 (branch reader): The `rev-parse --abbrev-ref` reader gets its own
  `lib/` module in the `lib/git-tags.mjs` mold - degrades to `''` on any
  failure and takes the CALLER's cwd - because `git-guard.mjs` is a hook
  whose final line swallows every throw (`try { main(); } catch {}`), so a
  helper that throws makes the guard silently stop guarding. Three sites, not
  four: `land-cleanup.mjs` has no rev-parse reader. Evidence:
  `git-guard.mjs:73-79` (called with the hook's cwd at `:151`);
  `git-publish.mjs:49-54`; `git-branch.mjs:38-44`; precedent
  `lib/git-tags.mjs:1-13`.
- D-06 (census): The occurrence census is TREE-WIDE over `cadence-core/bin/**`
  asserting each helper's DEFINITION occurs exactly once - a deliberate
  deviation from the per-file `redactUrl` precedent the roadmap cites, because
  a re-copy into a sixth file is invisible to any file-scoped count. Measured
  2026-08-14: 9 files carry 12 definitions of the three names. Evidence:
  per-file precedent `git-publish.test.mjs:362-378`,
  `planning.test.mjs:4579-4598`; tree-walk precedent `lib/merge-warnings.mjs`
  with `self-verify.mjs` checks 12 and 15.

## Decisions

- D-07 (protected): Widening `land-cleanup` changes behavior beyond its
  protected test and this is accepted: `base` falls back to
  `protectedBranches[0]`, so `protected_branches: "release"` starts resolving
  base to `release` and `git branch --merged release` becomes the reap query.
  Evidence: `land-cleanup.mjs:16-17`, `:103-106`;
  `config-seams.test.mjs:405-407`. (The CAPTURE.md item citing `:78-79` is
  stale; the gap now lives at `:103`.)
- D-08 (protected): `config.mjs validate` stays strict on
  `git.protected_branches` (`array_string`) this phase - after the fix all
  four readers honor a value the validator still calls an error. Widening the
  schema (or downgrading to a warning) is a follow-up decision, not this
  phase's. Evidence: `config.schema.json:40`; `config.mjs:74-76`.
- D-09 (protected): The helper's fallback fires only on non-array/non-string
  values - `protected_branches: []` keeps meaning "nothing is protected" and
  never falls through to `['main','master']`. Evidence:
  `config-seams.test.mjs:197` (the hostile-config arm's stated meaning).
- D-10 (fences): The fix must reach `parseRoadmapPhases`, which
  `classifyPhaseList:130` delegates to and which takes the FIRST `## Phases`
  occurrence - a fence-aware heading loop over a fence-blind parser still
  reads the template's example block. Measured 2026-08-14 by calling the real
  functions: against `templates/ROADMAP.md` the classifier returns `live`
  with two phantom phases; with a fenced example above a real section, the
  real phases are invisible, not merely joined. Evidence:
  `lib/planning-files.mjs:67-77`, `:122-131`; consumers `planning.mjs:273`,
  `:449`, `:1030`, `:1290`, `:2830`, `:3054`, `lib/milestone-prune.mjs:213`.
- D-11 (fences): `## Active` gets the same fix and `parseActiveIds` inherits
  it for free - it is a one-line delegate to `classifyActiveSection(text).ids`.
  Measured: `templates/REQUIREMENTS.md` (fence at `:9`, heading at `:15`)
  returns the example ids today. Evidence: `lib/planning-files.mjs:533-535`;
  consumer `planning.mjs:1690`.
- D-12 (fences): A fenced heading is IGNORED silently - the walk continues to
  the next unfenced occurrence - never reported as a new issue code, matching
  `classifyAcceptanceCriteria`'s stated precedent. A new issue code would make
  every project whose ROADMAP carries a formatting example report a problem it
  does not have. Evidence: `lib/planning-files.mjs:995-1009` with the
  rationale at `:1030-1037`; `sectionSpan:1201-1213`.
- D-13 (root): `detect-commands`/`detect-surfaces` adopt `debt-harvest`'s
  EXACT predicate - `'root' in opts && (typeof opts.root !== 'string' ||
  opts.root.trim() === '')` - which also refuses whitespace-only values.
  Measured 2026-08-14: both commands answer `ok:true` from cwd on `--root ""`
  today; `--root "   "` answers `no-root` in one vocabulary and would answer
  `bad-args` in the other without the trim clause. Evidence:
  `planning.mjs:3454-3458` against `:3436-3443`.
- D-14 (root): The refusal is a `fail('bad-args', ...)`, never the
  `missing-flag-value` throw `weight.mjs`/`self-verify.mjs` use -
  `planning.mjs` has one refusal vocabulary and three cross-referencing sites
  already state it. Evidence: `planning.mjs:3454-3457`, `:2569-2572`,
  `:3120-3123`.
- D-15 (root): No registry change - `self-verify`'s CONTRACTS table already
  declares `--root` for both subcommands; the fix is confined to the two
  dispatch rows. Evidence: `self-verify.mjs:224-225`, `:259`.
- D-16 (census): The census matches DEFINITIONS (`function flag(` and
  siblings), never call sites - the five bins keep calling `flag('--dir')`
  after importing it, and a call-site census would redden on every legitimate
  use. Evidence: the lexical-rule discipline at `lib/merge-warnings.mjs:56-62`.

## Acceptance criteria

- [ ] AC1: All four readers (`git-guard`, `git-publish`, `git-branch`,
      `land-cleanup`) resolve `protected_branches: "release"` to
      `["release"]` through one shared pure helper - a string-form test per
      consumer - and a test pins that `protected_branches: []` still means
      nothing is protected (no fallback to `['main','master']`).
- [ ] AC2: `classifyPhaseList` and `classifyActiveSection` run against the
      shipped `templates/ROADMAP.md` / `templates/REQUIREMENTS.md` return the
      real section, not the fenced example - proved by a regression test per
      scanner that reddens on the pre-fix code, including the
      fenced-example-above-real-section shape that currently makes the real
      phases invisible.
- [ ] AC3: `planning.mjs detect-commands --root ""` and
      `detect-surfaces --root ""` - and whitespace-only values - return
      `{"ok":false,"reason":"bad-args"}` exactly as `debt-harvest` does, one
      test row per command per shape.
- [ ] AC4: `flag`, `flagValue`, the shared `''`-returning `readText`, and the
      `rev-parse --abbrev-ref` branch reader are each defined exactly once
      under `cadence-core/bin/`, pinned by a tree-wide definition census that
      reddens when a copy is added in any `.mjs` file.
- [ ] AC5: `node --test cadence-core/bin/*.test.mjs` passes and
      `node cadence-core/bin/self-verify.mjs` reports no
      `unbudgeted-surface` and no `budget-overrun`.

## Flagged assumptions

- The new module's NAME (and whether the branch reader shares it, extends
  `lib/git-tags.mjs`, or stands alone as `lib/git-read.mjs`) is the planner's
  call - D-04/D-05 fix the contracts and the lib home, not the filenames.
- Whether the tree-wide census lives as a test-file census or as a
  `self-verify` check beside checks 12/15 is the planner's call with the
  trade-off stated: a test reddens in `node --test` (AC5's first gate); a
  self-verify check reports as a CI problem and gets a pure rule in `lib/`.
- Prose surfaces this phase grows carry their `weight-budgets.json` row change
  in the same work (phase 1 D-10 carries forward); expected to be nil - this
  phase should touch no skill prose.
