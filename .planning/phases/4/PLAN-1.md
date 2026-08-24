---
phase: 4
plan: 1
requirements: [LOD-02]
files:
  - cadence-core/bin/planning.mjs
  - cadence-core/bin/planning/
  - cadence-core/bin/helper-census.test.mjs
  - cadence-core/bin/prose-agreement.test.mjs
  - cadence-core/bin/planning.test.mjs
  - cadence-core/bin/trace.test.mjs
  - cadence-core/bin/self-verify.test.mjs
---

# Phase 4: Split planning.mjs by command - Plan 1 (the source split)

## Goal

No dispatch pays a whole-file read to reach one command. The 32 `cmd*` handlers
move out of `cadence-core/bin/planning.mjs` into per-command modules, leaving a
shared core, so an agent touching one command reads that command instead of
paying the read cap twice on a 104k-token file.

## Must be true when done

- Every one of the 32 `cmd*` handlers is defined in a module under
  `cadence-core/bin/planning/`, and `cadence-core/bin/planning.mjs` declares none
  of them.
- `cadence-core/bin/planning.mjs` measures under 2,000 lines and still resolves
  every subcommand through its `COMMANDS` table.
- No command's behaviour changes: `node cadence-core/bin/test.mjs` reports
  `fail 0`, `node cadence-core/bin/self-verify.mjs` reports zero problems across
  all 26 checks, and `npx tsc -p tsconfig.ci.json` exits 0. The
  `milestone-prune.test.mjs` live-corpus failure this plan was written against is
  fixed OUT of this phase, before it executes: this milestone's eight `## Active`
  bullets are written `- **ID** - text` where `lib/milestone-prune.mjs:171`
  parses `- **ID**: text`, and the bullets are what conform (D-03 keeps the
  narrow colon form on purpose, so a `- **Note**:` prose bullet stays
  unmatchable). A green suite is the baseline every Verify below compares
  against, so a second failure is visible as a failure and not as noise.
- `ok`, `fail`, `read` and `HERE` are declared exactly once, in one shared
  module, and no command module redeclares any of them - and `HERE` still names
  `cadence-core/bin`, so `criteria-coverage` reports the running plugin's real
  version rather than `null`.
- Every assertion that reads planning.mjs's SOURCE BYTES reads the file that now
  holds what it asserts about, and still asserts the same claim rather than a
  weaker one.

## Context

- D-01: the command modules live in a SUBDIRECTORY under `cadence-core/bin/`;
  check 14 (`script-contracts`) enumerates the bin directory non-recursively and
  `continue`s on directories, so a subdirectory needs zero CONTRACTS rows. The
  chosen directory is `cadence-core/bin/planning/` (planner's choice: `bin/lib/`
  is the tree-wide shared layer and a `bin/commands/` would read as a sibling of
  the repo-root `commands/`).
- D-02: handlers are imported STATICALLY, stay synchronous, and each `COMMANDS`
  arrow keeps its form with the identifier it names becoming an import. No
  dynamic `import()` - it would make dispatch async and change the shape of the
  `fail('internal', ...)` catch-all.
- D-03/D-05/D-06: `ok`, `fail`, `read`, `HERE` and the helpers reached by two or
  more handler families live in one shared module; single-use helpers and
  constants travel with their handler, by USE and never by declaration position.
- D-07: `trace` (`cmdTrace` + `cmdTraceIgnore`) and `risk-check` (`cmdRiskCheck`
  + `cmdRiskCheckRun` + `cmdRiskCheckStatus`) co-locate, one module each; the
  other 27 handlers are one module each - 29 modules plus the shared core.
- The suite baseline: `node cadence-core/bin/test.mjs` reports `tests 3071`,
  `pass 3071`, `fail 0`. It measured `pass 3070, fail 1` on 2026-08-24 when this
  plan was written; that failure was the `milestone-prune.test.mjs` live-corpus
  arm, pre-existing and outside this phase, and it is fixed BEFORE this phase
  executes (see Notes). Every Verify below asks for a clean run.
- Out of scope: any behaviour change, and the `planning.test.mjs` split, which is
  plan 2.

## Tasks

### Task 1: Extract the shared core module

- **Files:** cadence-core/bin/planning.mjs, cadence-core/bin/planning/,
  cadence-core/bin/helper-census.test.mjs
- **Action:** Create `cadence-core/bin/planning/core.mjs` and move into it,
  verbatim and comments included, each one exported: `ARGV`, `ok`, `fail`,
  `read`, `phaseSpellingRefusal`, `HERE`, `MANIFEST_PATH`, `pluginVersion`,
  `derivePhases`, `readJsonPayload`, `memoryBackend`, `listPlanFiles`,
  `readReadsRecords`, `routeLadder`, `RISK_DIFF_MAX_BUFFER`, `riskRef`,
  `resolveRange`, `planKey`, `RECORD_TOKEN`, `fireIdentity`, `fireHome`,
  `QUEUE_HOMES`, `readQueue`, `DISPATCH_WINDOW_DEFAULTS`, `FLAG_SENTENCES`,
  `flagSentence`, `decimalRefusal` and `argRefusal`; `planning.mjs` then
  imports the ones it still uses. No handler moves in this task. The list is the
  measured multi-family set (D-03, D-05, D-06) plus the four refusal composers:
  `cmdTrace` calls `argRefusal` as well as the dispatch door does, and a command
  module cannot import from `planning.mjs`, because importing that file RUNS the
  dispatch at the foot of it. Move by USE, not by declaration position - verify
  each symbol's callers over comment-stripped source (`node
  cadence-core/bin/skim.mjs`), since several of these names also appear inside
  prose comments that are not calls.
  The one hazard is `HERE`. It is `dirname(fileURLToPath(import.meta.url))`
  today and names `cadence-core/bin`; the same expression inside
  `planning/core.mjs` names one directory deeper, and BOTH consumers degrade
  silently rather than crashing - `MANIFEST_PATH` (`join(HERE, '..', '..',
  '.claude-plugin', 'plugin.json')`) feeds `pluginVersion`, which swallows the
  read failure and returns `null`, and `routeLadder` (`join(HERE, '..',
  'route-table.json')`) swallows its own and returns `undefined`, which reads as
  "no ladder declared" (D-03). Export a `HERE` that still names
  `cadence-core/bin`, and do NOT compensate by editing the `'..'` segments at the
  two consumers, which would leave two different notions of where the bin
  directory is.
  Finally, `helper-census.test.mjs`'s `readText` row carries a note naming
  "planning.mjs's read()" as a deliberate non-instance of that contract; point it
  at the file that now defines `read`, or the census explains itself with a
  function the named file no longer has (D-12 leases this file for exactly this).
- **Verify:** `node cadence-core/bin/test.mjs 2>&1 | grep -E '^ℹ (tests|pass|
  fail)'` prints `fail 0`, the green baseline this phase executes against; `node
  cadence-core/bin/self-verify.mjs` prints `"problems":[]`; `npx tsc -p
  tsconfig.ci.json` exits 0; `node cadence-core/bin/planning.mjs
  criteria-coverage --dir .planning` prints a `version.plugin` equal to the
  `version` in `.claude-plugin/plugin.json` (this is the assertion that fails if
  `HERE` slipped one level down); `grep -c '^function cmd'
  cadence-core/bin/planning.mjs` still prints 32.

### Task 2: Move status, cursor and phase-done into modules

- **Files:** cadence-core/bin/planning.mjs, cadence-core/bin/planning/
- **Action:** Create `planning/status.mjs`, `planning/cursor-get.mjs`,
  `planning/cursor-set.mjs` and `planning/phase-done.mjs`, one handler each,
  moved verbatim with their comments and exported; each imports what it needs
  from `planning/core.mjs` and from `./lib/*`. `cmdStatus`'s single-use
  companions `PHASE_DIR_NAME`, `phaseDirGrammarDrift` and `AGREE` travel with it
  (D-05). In `planning.mjs` the `COMMANDS` arrows keep their exact present form -
  including the `cursor` arm's `get`/`set` branch and its `fail('usage', 'cursor
  <get|set>')` - with the four identifiers now resolved by static import (D-02).
  This is the tracer for the other five move tasks: every seam the split
  touches - the subdirectory, the core import, the constant that travels, the
  dispatch arrow - is exercised here, so a mistake in the pattern surfaces on
  four commands rather than on twenty-nine.
- **Verify:** `node cadence-core/bin/test.mjs 2>&1 | grep -E '^ℹ (tests|pass|
  fail)'` still prints `fail 0` and no failing test appears, and `node cadence-core/bin/self-verify.mjs` prints `"problems":[]`;
  `grep -c '^function cmd' cadence-core/bin/planning.mjs` prints 28 and `grep -rc '^function cmd'
  cadence-core/bin/planning/status.mjs cadence-core/bin/planning/cursor-get.mjs
  cadence-core/bin/planning/cursor-set.mjs
  cadence-core/bin/planning/phase-done.mjs` prints 1 for each.

### Task 3: Move the plan-and-criteria readers into modules

- **Files:** cadence-core/bin/planning.mjs, cadence-core/bin/planning/
- **Action:** Create `planning/uat.mjs`, `planning/audit.mjs`,
  `planning/criteria-coverage.mjs`, `planning/criteria-size.mjs`,
  `planning/plan-size.mjs` and `planning/plan-overlap.mjs`, same pattern as task
  2. Single-use companions travel: `uatFile`, `loadUat`, `nextPending`,
  `writeUat`, `UAT_RESULTS` and `UAT_TEXT_FIELDS` with `uat`;
  `readCoverageContext` with `criteria-coverage`; `CRITERIA_CEILINGS` with
  `criteria-size`. `ORIGIN_EXEMPT` and `LEGACY_REASON` sit INSIDE `cmdAudit`'s
  span but are used only by `cmdCriteriaCoverage`, so they go to
  `criteria-coverage.mjs` - this is D-06's named example of moving a constant by
  use rather than by where it happens to be declared, and it is the one place in
  this task where following the file's layout gives the wrong answer.
- **Verify:** `node cadence-core/bin/test.mjs 2>&1 | grep -E '^ℹ (tests|pass|
  fail)'` still prints `fail 0` and no failing test appears, and `node cadence-core/bin/self-verify.mjs` prints `"problems":[]`;
  `grep -c '^function cmd' cadence-core/bin/planning.mjs` prints 22; `grep -c ORIGIN_EXEMPT
  cadence-core/bin/planning/criteria-coverage.mjs` and the same grep for
  `LEGACY_REASON` both print a non-zero count, while both greps over
  `cadence-core/bin/planning/audit.mjs` print 0.

### Task 4: Move the record-and-lease commands into modules

- **Files:** cadence-core/bin/planning.mjs, cadence-core/bin/planning/,
  cadence-core/bin/prose-agreement.test.mjs
- **Action:** Create `planning/cite-count.mjs`, `planning/seed-reqs.mjs`,
  `planning/recall.mjs`, `planning/lease-check.mjs` and
  `planning/task-record.mjs`, same pattern. Single-use companions travel:
  `CITE_POINTS` with `cite-count`; `repoRel`, `splitNul`, `quoteRawPath` and
  `parseStagedNameStatus` with `lease-check`. Keep the `recall` arm's `rest.join('
  ')` call in `COMMANDS` exactly as it is - it is the only arm reading the fourth
  positional argument.
  `prose-agreement.test.mjs`'s lockfile-lease test reads planning.mjs's source
  bytes and matches `/reason: 'undeclared-files'/` against them; that literal is
  inside `cmdLeaseCheck` and moves with it, so repoint that `doc(...)` read at
  `cadence-core/bin/planning/lease-check.mjs` in THIS task (D-10). Left alone it
  fails with a message announcing that lease-check stopped emitting the reason -
  a defect that did not happen. Keep the assertion matching the EMITTING site;
  do not weaken it to a search over the whole tree or a `.includes` on the reason
  string (AC5).
- **Verify:** `node cadence-core/bin/test.mjs 2>&1 | grep -E '^ℹ (tests|pass|
  fail)'` still prints `fail 0` and no failing test appears, and `node cadence-core/bin/self-verify.mjs` prints `"problems":[]`;
  `grep -c '^function cmd' cadence-core/bin/planning.mjs` prints 17; `node --test
  cadence-core/bin/prose-agreement.test.mjs` passes and `grep -n
  "undeclared-files" cadence-core/bin/prose-agreement.test.mjs` shows the
  assertion still matching `reason: 'undeclared-files'` against a file read of
  the lease-check module.

### Task 5: Move the project-scan and file-writing commands into modules

- **Files:** cadence-core/bin/planning.mjs, cadence-core/bin/planning/
- **Action:** Create `planning/detect-commands.mjs`,
  `planning/detect-surfaces.mjs`, `planning/reads.mjs`, `planning/capture.mjs`,
  `planning/capture-sections.mjs`, `planning/debt-harvest.mjs` and
  `planning/milestone-prune.mjs`, same pattern. Single-use companions travel:
  `ESLINT_CONFIGS` with `detect-commands`; `SCAN_SKIP_DIRS`, `SCAN_MANIFESTS` and
  `manifestDeps` with `detect-surfaces`; `DEBT_MAX_FILE_BYTES` and `DEBT_HEADING`
  with `debt-harvest`. The three `--root` arms (`detect-commands`,
  `detect-surfaces`, `debt-harvest`) keep their `typeof opts.root === 'string' ?
  opts.root : process.cwd()` expressions and their comments in `COMMANDS`: the
  refusal for a blank `--root` is the declared row's, applied at the dispatch
  door, and moving that expression into a handler would move where the answer is
  decided.
- **Verify:** `node cadence-core/bin/test.mjs 2>&1 | grep -E '^ℹ (tests|pass|
  fail)'` still prints `fail 0` and no failing test appears, and `node cadence-core/bin/self-verify.mjs` prints `"problems":[]`;
  `grep -c '^function cmd' cadence-core/bin/planning.mjs` prints 10; `node
  cadence-core/bin/planning.mjs detect-commands --root ""` still returns
  `ok:false` with a `bad-args` reason.

### Task 6: Move the trace family into one module

- **Files:** cadence-core/bin/planning.mjs, cadence-core/bin/planning/,
  cadence-core/bin/prose-agreement.test.mjs
- **Action:** Create `planning/trace.mjs` holding BOTH `cmdTrace` and
  `cmdTraceIgnore` (D-07: `cmdTrace` calls `cmdTraceIgnore`, one of only two
  handler-to-handler call edges in the file), with their single-use companions:
  `TRACE_IGNORE_LINE`, `TRACE_IGNORE_COMMENT`, `ignoreSourceTravels`,
  `gitIgnoreState`, `traceTracked`, `gitignoreCarriesLine`,
  `SUGGEST_KEY_DEFAULTS`, `gateLadder`, `rungLadder`, `checkpointPlanTasks`,
  `suggestResolution`, `TRACE_GRAMMAR`, `TRACE_STRING_FLAGS`, `recordForFire` and
  `recountReceipt`. Two constraints bind this move. First, the two `mergeLayers(`
  callsites inside `cmdTrace` must carry their own `warnings` destructuring into
  the new file, or `planning/trace.mjs`'s HEADER must carry a `mergeLayers
  warnings[]:` marker line followed by a reason sentence - `headerDocuments`
  reads only the leading comment run, so a marker beside the callsite satisfies
  nothing (D-11), and self-verify check 12 walks the subdirectory. Second,
  `prose-agreement.test.mjs`'s SGT-01 test extracts the `SUGGEST_KEY_DEFAULTS`
  literal out of planning.mjs's source bytes; repoint that read at
  `cadence-core/bin/planning/trace.mjs` in THIS task (D-10), keeping the
  extraction comparing the literal against `config.schema.json`'s `default`
  fields - not narrowed to a presence check (AC5).
- **Verify:** `node cadence-core/bin/test.mjs 2>&1 | grep -E '^ℹ (tests|pass|
  fail)'` still prints `fail 0` and no failing test appears, and `node cadence-core/bin/self-verify.mjs` prints `"problems":[]`
  (this is the check that fails if a moved `mergeLayers` callsite lost its
  `warnings` binding);
  `grep -c '^function cmd' cadence-core/bin/planning.mjs` prints 8; `node --test
  cadence-core/bin/prose-agreement.test.mjs cadence-core/bin/trace-suggest.test.mjs`
  passes, and SGT-01 still fails when a value in `SUGGEST_KEY_DEFAULTS` is edited
  away from the schema's default (try it, then revert).

### Task 7: Move the risk-check family into one module

- **Files:** cadence-core/bin/planning.mjs, cadence-core/bin/planning/
- **Action:** Create `planning/risk-check.mjs` holding all three handlers -
  `cmdRiskCheck` dispatches to `cmdRiskCheckRun` and `cmdRiskCheckStatus`, the
  second of the two handler-to-handler call edges (D-07) - with their single-use
  companions `surfaceVocabulary`, `RISK_TRIGGER` and `FIRE_RECEIPTS`. The
  `mergeLayers(` callsite inside `cmdRiskCheckRun` carries its `warnings:
  surfaceWarnings` binding across, or the new file's header carries the
  `mergeLayers warnings[]:` marker and its reason (D-11). Keep `cmdRiskCheck`'s
  `fail('usage', ...)` fall-through wording byte-identical.
- **Verify:** `node cadence-core/bin/test.mjs 2>&1 | grep -E '^ℹ (tests|pass|
  fail)'` still prints `fail 0` and no failing test appears, and `node cadence-core/bin/self-verify.mjs` prints `"problems":[]`;
  `grep -c '^function cmd' cadence-core/bin/planning.mjs` prints 5; `node cadence-core/bin/planning.mjs
  risk-check --dir .planning` still returns the same `usage` refusal it returns
  today.

### Task 8: Move the fire-record and renumber commands, and close the entry file

- **Files:** cadence-core/bin/planning.mjs, cadence-core/bin/planning/,
  cadence-core/bin/planning.test.mjs
- **Action:** Create `planning/adjudication.mjs`, `planning/deferred-record.mjs`,
  `planning/deferred-list.mjs`, `planning/deferred-carry.mjs` and
  `planning/renumber.mjs`, same pattern; `groundCitations` travels with
  `adjudication`, and `gitMv`, `gitDirAbove`, `gitDirUnder`, `uncommittedUnder`
  and `occupied` travel with `renumber`. The `deferred` arm in `COMMANDS` keeps
  its three-way branch and its `fail('usage', 'deferred record|list|carry')`
  fall-through.
  Two tests in `planning.test.mjs` read planning.mjs's SOURCE BYTES through
  `readFileSync(PLANNING, 'utf8')` and slice it - one from `function
  gitDirUnder(`, one from the renumber apply loop's `rm` step literal to the
  dir-move loop that follows it. Both subjects move into `planning/renumber.mjs`,
  so repoint both reads at that file in this task. Keep every assertion they
  carry: the `lstatSync` probe, the absence of a `.name === '.git'` comparison,
  the recursive `rmSync` fallback, and the ordering that puts `gitDirAbove(` and
  `gitDirUnder(` before the delete. A weakened or deleted arm here is a fail-open
  that deletes a phase directory whole.
  Then finish the entry file: `planning.mjs` keeps its header comment block, its
  `import`s, `parseArgs`, the `COMMANDS` table and the `try`/`catch` dispatch
  block, and nothing else.
- **Verify:** `grep -c '^function cmd' cadence-core/bin/planning.mjs` prints 0;
  `wc -l cadence-core/bin/planning.mjs` prints a number under 2,000; `ls
  cadence-core/bin/planning/*.mjs | wc -l` prints 30 (29 command modules plus
  `core.mjs`) and `grep -rc '^function cmd' cadence-core/bin/planning/*.mjs |
  awk -F: '{s+=$2} END {print s}'` prints 32; `node cadence-core/bin/test.mjs` reports
  `fail 0` with no failure; `node
  cadence-core/bin/self-verify.mjs` prints `"problems":[]`; `npx tsc -p
  tsconfig.ci.json` exits 0.

## Notes

- Plan shape follows the CONTEXT directive (multiple plans, sequential). Plan 1
  and plan 2 both declare `cadence-core/bin/planning.test.mjs`: task 8 here must
  repoint the two `source:` assertions in it when `cmdRenumber` moves, or plan 1
  ends with a red suite, and plan 2 then splits that same file by command. Run
  the plans in order - 1, then 2, then 3 - and expect `plan-overlap --phase 4` to
  report that one intersection; it is declared, not accidental.
- The 178-line header comment block in `planning.mjs` stays where it is. It
  documents the subcommand surface as a whole and is neither a handler nor a
  single-use helper, so nothing in CONTEXT moves it; splitting it per command is
  a separate question the AC6 measurement can inform.
- The suite's one failure is PRE-EXISTING and outside this phase:
  `cadence-core/bin/milestone-prune.test.mjs:557`, `corpus: pruning this
  repository's own REQUIREMENTS.md needs no hand repair`. It reads the LIVE
  `.planning/REQUIREMENTS.md`, whose `## Active` bullets this milestone wrote as
  `- **FRG-01** - text` while the seam and that test's `activeSpan` helper both
  expect `- **FRG-01**: text`, so the archived row comes out as `| FRG-01 |` with
  an empty parenthetical instead of carrying the bullet's text. Do not fix it
  here and do not let it absorb a task; it is reported for the human as an open
  item, and naming it in every Verify is what makes a SECOND failure visible.
- D-11 names two `mergeLayers(` callsites that move. There are four in the file:
  the two inside `cmdTrace`, one inside `cmdRiskCheckRun`, and one inside
  `memoryBackend`, which is a multi-family helper and therefore moves in task 1.
  The same rule applies to it - it binds `const { config, warnings }` today, so
  carrying the destructuring verbatim satisfies arm (a) with no header marker
  needed.
