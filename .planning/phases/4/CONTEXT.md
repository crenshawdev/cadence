# Phase 4: Split planning.mjs by command - Context

Gathered: 2026-08-24
Feeds: /cad-plan 4

## Scope boundary

In: The 32 `cmd*` handlers move out of `cadence-core/bin/planning.mjs` into
per-command modules in a new subdirectory under `cadence-core/bin/`, taking
their single-use helpers and their constants with them. A shared core keeps
`ok`, `fail`, `read`, `HERE` and the 14 multi-use helpers. `planning.test.mjs`
splits along the same cut lines. Every live citation that names a moved line
moves with it, pinned by a census test. The saving is measured, not asserted.

Out: Behaviour change of any kind - this phase is a move, not a rewrite. No
handler gains or loses a flag, a refusal reason or an envelope field. The other
five large files (`lib/planning-files.mjs` 131,090 chars, `prose-agreement.test.mjs`
141,037, `trace.test.mjs` 125,788, `self-verify.test.mjs` 124,382,
`route.test.mjs` 117,490) are NOT split here; whether they earn the same
treatment is a question AC6's measurement answers afterwards.

Deferred: None.

Plan shape: multiple plans, same phase - the source split and the test split are
distinct bodies of work that share files, so they sequence rather than
parallelize.

## Durable decisions

- D-01 (placement): The 32 command modules live in a SUBDIRECTORY under
  `cadence-core/bin/`, not as top-level `bin/*.mjs`. Check 14 (`script-contracts`)
  enumerates the bin directory non-recursively and `continue`s on directories, so
  a subdirectory needs zero CONTRACTS rows; 32 top-level files would each need one
  under D-17, and each row would describe a script prose never invokes. Evidence:
  `cadence-core/bin/self-verify.mjs:1198-1223`; `cadence-core/bin/lib/` already
  holds 60 such modules with no rows.
- D-02 (dispatch): Handlers are imported STATICALLY and the `COMMANDS` object
  literal keeps its shape - each arrow keeps its form and the identifier it names
  becomes an import. Handlers stay synchronous. Rejected: dynamic `import()` per
  resolved subcommand, which would make dispatch async and change the shape of the
  `fail('internal', ...)` catch-all that keeps every parse problem an `ok:false`
  envelope rather than a stack trace. Evidence:
  `cadence-core/bin/planning.mjs:7728-7853`, catch-all at `:7852`.
- D-03 (shared core): `ok` (`:246`), `fail` (`:247`), `read` (`:251`) and `HERE`
  (`:285`) are EXPORTED from one shared module and never redeclared per command
  module. `fail` is called by all 32 handlers, `ok` by 31, `read` by 24. `HERE`
  matters most: `MANIFEST_PATH` (`:296`) and `routeLadder` (`:3917`) resolve off
  it, and both would silently resolve one directory deeper if `import.meta.url`
  were re-read in a new home - degrading to `ok:true` with a wrong answer rather
  than crashing, because `pluginVersion` and `routeLadder` swallow read failures.
  Evidence: `cadence-core/bin/helper-census.test.mjs:88-96` already names this
  `read()` as a deliberate non-instance of the `readText` contract, so 24 copies is
  exactly the accumulation that census exists to stop.
- D-04 (citations): The census pins BOTH citation grammars over LIVE surfaces
  only. Grammar one is inline `planning.mjs:<line>` - 26 live occurrences across
  4 files. Grammar two is invisible to that grep: `.planning/DOCS-CLAIMS.md` carries
  4 rows whose `doc` cell is `cadence-core/bin/planning.mjs` and whose location is a
  separate line-range column (`:855`, `:867`, `:1027`, `:1028`). The 405 archived
  citations under `.planning/_archive-v*` and the 2 in `.planning/trace.jsonl` are
  NOT rewritten. Evidence: `cadence-core/bin/self-verify.mjs:232-236` sets that
  precedent directly - a tree-wide guard "would land red on a record no one may
  rewrite".

## Decisions

- D-05 (helper partition): The 27 single-use helpers travel with their handler;
  the 14 reached by two or more handlers stay in the core. The widest-shared are
  `read` (24 handlers), `listPlanFiles` (6), `riskRef` (5), `resolveRange` (5).
  Entry file ceiling is 2,000 lines; measured projection is ~970 (7,853 total,
  6,070 under handler spans, 810 under single-use helper spans).
- D-06 (constants): Constants move by USE, never by declaration position.
  `ORIGIN_EXEMPT` (`:1776`) and `LEGACY_REASON` (`:1784`) sit inside `cmdAudit`'s
  span but are used only by `cmdCriteriaCoverage`. Of 31 module constants, 25 are
  single-handler; only `DISPATCH_WINDOW_DEFAULTS` (`:3831`) and
  `RISK_DIFF_MAX_BUFFER` (`:4583`) are genuinely shared.
- D-07 (families): `trace` and `risk-check` co-locate rather than splitting into
  one file per handler. These are the ONLY two handler-to-handler call edges in the
  file: `cmdTrace` (`:4035`) calls `cmdTraceIgnore` (`:3690`), and `cmdRiskCheck`
  (`:5648`) calls `cmdRiskCheckRun` (`:4643`) and `cmdRiskCheckStatus` (`:5154`).
  The other 29 handlers are independent leaves.
- D-08 (test discovery): Split test files stay at `cadence-core/bin/*.test.mjs`.
  `test.mjs` discovers stems with a non-recursive `readdirSync(HERE)`, so a
  subdirectory would look organised and never run. New stems fall into the `other`
  group and do run, but do not join the `planning` group's timing balance unless
  declared. Evidence: `cadence-core/bin/test.mjs:53-57`, `:44-46`, `:59-62`;
  `.github/workflows/test.yml:33`.
- D-09 (test cut lines): `planning.test.mjs` splits along its 53 existing
  `// --- <command>: ... ---` banner comments, which already partition its 8,458
  lines by subcommand. It is black-box - it spawns `planning.mjs` through
  `execFileSync`/`spawnSync` and imports zero handlers - so the source split does
  not force a test change; the test split is its own choice, taken for the same
  read-cost reason.
- D-10 (source-byte assertions): Three assertions in OTHER test files read
  `planning.mjs`'s SOURCE BYTES rather than its output, and are leased and updated
  in the same task that moves what they read. `prose-agreement.test.mjs:1684-1695`
  extracts the `SUGGEST_KEY_DEFAULTS` literal (declared `:3858`, single-use for
  `cmdTrace`) out of the file text; `:367-370` matches `/reason: 'undeclared-files'/`
  (at `:3126`, inside `cmdLeaseCheck`). Left alone they fail with messages naming a
  defect that did not happen, which is worse than a plain failure.
- D-11 (merge warnings): The two `mergeLayers(` callsites that move - in
  `cmdTrace` (`:4035`) and `cmdRiskCheckRun` (`:4643`) - carry their `warnings[]`
  binding into the new module, or the new file's HEADER carries the
  `mergeLayers warnings[]:` marker plus a reason sentence. `headerDocuments` reads
  only the leading comment run, so a marker beside the callsite does not satisfy it.
  Evidence: `cadence-core/bin/lib/merge-warnings.mjs:4-36`, `:103-118`.
- D-12 (lease): The plan leases the new directories by DIRECTORY PREFIX - `covers`
  treats a trailing `/` as a prefix, so one declaration covers everything created
  under it (`cadence-core/bin/lib/lease-grammar.mjs:63-67`). The files invalidated
  BY CONSTRUCTION are leased explicitly, because they are exactly what a mechanical
  mover forgets: `prose-agreement.test.mjs`, `helper-census.test.mjs`,
  `.planning/DOCS-CLAIMS.md` and `.planning/REQUIREMENTS.md`. Phase 1 committed two
  `lease-check` refusals rather than halting, and structurally checkpointed once on
  this same class.
- D-13 (measurement): AC6 records the MEDIAN handler and the WORST case, both.
  Measuring only `cmdCursorGet` (16 lines) would report a ~99% cut that no real
  dispatch experiences - the self-claim defect class
  `cadence-core/bin/seam-calls.test.mjs:11-16` calls out. Worst case is `cmdTrace`
  (556 lines) or `cmdRiskCheckStatus` (494).

## Acceptance criteria

- [ ] AC1: `cadence-core/bin/planning.mjs` measures under 2,000 lines, all 32
      `cmd*` handlers live in modules under the new subdirectory, and every
      subcommand still resolves through the `COMMANDS` table.
- [ ] AC2: No behaviour change - `node cadence-core/bin/test.mjs` is green,
      `node cadence-core/bin/self-verify.mjs` reports zero problems across all 26
      checks, and `npx tsc -p tsconfig.ci.json` exits 0.
- [ ] AC3: A census test pins live `planning.mjs:<line>` citations in BOTH
      grammars - inline, and the `DOCS-CLAIMS.md` line-range column - and fails
      naming any stale one. `.planning/_archive-v*` and `.planning/trace.jsonl` are
      byte-unchanged.
- [ ] AC4: `planning.test.mjs` is split along its command banners into files at
      `cadence-core/bin/*.test.mjs`, and `node cadence-core/bin/test.mjs` runs every
      new stem - proven by the reported test count matching the pre-split total, not
      by the files existing.
- [ ] AC5: The three source-byte assertions in `prose-agreement.test.mjs` still
      pass AND still assert the same thing: `SUGGEST_KEY_DEFAULTS` compared against
      `config.schema.json`, and `undeclared-files` matched at its emitting site. A
      diff shows neither narrowed to a weaker claim.
- [ ] AC6: The SUMMARY records before-and-after read cost for reaching a MEDIAN
      handler and the WORST-CASE handler, both by `wc -c`, so the saving is measured
      rather than asserted.

## Flagged assumptions

- The residual entry file lands near 970 lines rather than the roadmap's ~1,600 -
  Confident; if wrong: only the projection was optimistic, AC1's 2,000-line ceiling
  still holds.
- New test stems joining the `other` group rather than `planning` leaves the CI
  group timing unbalanced - Likely; if wrong: nothing breaks, one group simply runs
  longer than its stated budget until the groups are re-declared.
