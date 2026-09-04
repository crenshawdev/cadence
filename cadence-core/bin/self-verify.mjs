#!/usr/bin/env node
// @ts-check
// self-verify.mjs - the prose<->code drift linter, run in CI. The 2026-07-16
// sweep found that nearly every defect in this repo was prose describing a
// flag, key, or path the code did not have; this script makes that whole
// class mechanical. Checks run over the LIVE prose surfaces (workflows,
// references, skills, agents, templates, docs/, plus README, INTERNALS and
// METHOD - deliberately not the historical docs DESIGN/LINEAGE/CHANGELOG,
// which may name cut keys while explaining the cut):
//
//   1. config keys   every dotted config token in prose must exist in
//                    config.schema.json (placeholders <t>/<name> expanded),
//                    and every schema key must be referenced somewhere -
//                    an unreferenced key is inert and gets pruned, not kept.
//   2. invocations   every `<script>.mjs <subcommand> --flag` in prose must
//                    match the real subcommand/flag contract table, which is
//                    lib/arg-contract.mjs's `CONTRACTS` - the SAME table the
//                    seam CLIs refuse against, imported here rather than
//                    restated (D-06). This side reads its flag NAMES through
//                    `flagNames`; the scripts' own tests keep it honest.
//   3. paths         every ${CLAUDE_PLUGIN_ROOT}/<path> must exist in-repo.
//   3b. internals    every backticked repo path cited in INTERNALS.md (the
//                    deep-dive "Read the code" pointers) must exist in-repo.
//   6. agent skills  every skill an agent preloads via `skills:` frontmatter
//                    must resolve on disk and be model-invocable. The host
//                    skips a missing or disabled one SILENTLY, so this check
//                    is what keeps a preloaded contract from vanishing.
//   7. agent body    an agent that preloads a contract (`skills:`) must carry
//                    NO contract section tag in its own body. A rung file is
//                    a pointer at one single-sourced contract; the moment one
//                    grows behaviour, the ladder is N divergent variants
//                    instead of one contract at N efforts.
//   8. routing cells the five grids in route-table.json, cell by cell (every
//                    problem NAMES the cell), the shared vocabulary arrays
//                    against the schema's own enums,
//                    plus the grids -> agents/ direction: every rung a cell
//                    names must have an agent file. route.mjs returns an agent
//                    name it never checks exists, so an unbuilt rung would
//                    surface as a failed spawn instead of in CI. Coming back
//                    the other way, only the STALE half: a rung-suffixed agent
//                    file lib/rung-agent.mjs maps to nothing is refused, while
//                    a mapped rung no cell reaches is legal - a rung file
//                    ships before the cell that names it.
//   9. config reach  references/config-reach.md must carry one reach row per
//                    config.schema.json key, name no key the schema lacks, and
//                    every reach narrower than `universal` must appear in that
//                    key's own `purpose` - where a user setting the value reads
//                    it. This is what makes "no key is resolved and then
//                    silently dropped" re-runnable rather than a one-time sweep.
//  10. dispatch      prose under cadence-core/workflows or references that
//      phrasing      claims concurrency for a set of dispatches must issue them
//                    in ONE message, and every sentence in such a block that
//                    ISSUES the set - a bare dispatch verb opening a clause, or
//                    the colon that introduces the list below it - is reported
//                    when it hands the set out one at a time ("one dispatch per
//                    message"), hedges on the host ("where the host allows"),
//                    or dispatches the set concurrently without saying so
//                    (#88). Per sentence, because one compliant sentence must
//                    not excuse its neighbour - which is how the first-shipped
//                    rule missed the very sentence it was written to prevent
//                    returning. Only an imperative one, because a rationale, a
//                    negation and a catalog row carry the same vocabulary in
//                    another mood and issue nothing. Without this check the
//                    prose repair is UAT-walk-only.
//  12. merge         every `mergeLayers(` callsite under cadence-core/bin must
//      warnings      either bind the `warnings[]` it gets back or sit in a file
//                    whose header says why its envelope is the surfacing. The
//                    one diagnostic that says a config layer was TORN was
//                    dropped on the floor at eight of ten callsites, so branch
//                    rails, cleanup rails and recall decided from defaults in
//                    silence. The rule is lib/merge-warnings.mjs; this is the
//                    only check that walks .mjs SOURCE rather than prose.
//  13. deferred      a reference a command skill deliberately stopped
//      reads         `@`-including must still be Read by name at the step that
//                    needs it. De-preloading is the cheapest context cut there
//                    is and the easiest to break: delete one sentence and the
//                    reference is unreachable, with nothing failing. The
//                    register of removals and the sentence-level rule live in
//                    lib/deferred-reads.mjs; this side only calls it.
//  14. script        every top-level script under cadence-core/bin must have a
//      contracts     row in lib/arg-contract.mjs's `CONTRACTS`. Check 2 SKIPS
//                    a script it finds no row for - it has to, since prose
//                    names third-party scripts too - so deleting a row was a
//                    silent opt-out of the flag lint rather than a problem, and
//                    the table's completeness could not be checked from the
//                    prose side at all. It is checked from the tree side here.
//                    TOP-LEVEL only: a `lib/*.mjs` module is not invoked from
//                    prose and takes no row, which is true of the table's own
//                    home as much as of any other module there.
//  15. NUL bytes     no file under cadence-core/bin may contain a literal
//                    U+0000. One makes GNU `grep -rn` print nothing at all for
//                    that file without `-a` and `rg` skip it silently, so the
//                    file drops out of every search while looking present.
//                    `git grep` still matches (its binary heuristic reads only
//                    the head of the blob), which is why the defect survived.
//                    The walk here is extension-blind and exclusion-free -
//                    tests and JSON data files go dark the same way sources do.
//  16. include        every `@`-include of a cadence-core/references/* or
//      consumers      cadence-core/templates/* surface must be NAMED somewhere
//                    in the including command's own eager prose. An include
//                    claims a consumer; this checks the claim. Same species as
//                    check 3 (an included path exists) and check 6 (an agent's
//                    `skills:` resolve), and the opposite direction from check
//                    13, which watches a reference a skill still NAMES but no
//                    longer includes. A `cadence-core/workflows/*` include is
//                    exempt - the workflow IS the command's process, so naming
//                    it would be a command citing its own body. The rule, its
//                    branch exemption and its waiver register - which ships
//                    EMPTY - live in lib/include-consumers.mjs; this side decides
//                    that it applies to the whole root. It takes no CONTRACTS
//                    row, for the reason check 14 states: `lib/*.mjs` are
//                    modules prose never invokes.
//  17. global-only   the keys lib/global-only-keys.mjs strips out of the repo
//      key scope     layer and the config.schema.json keys marked
//                    `src: "global"`, against each other in BOTH directions -
//                    the same pair check 8 keeps between the routing cells and
//                    agents/. A key the merge enforces without the marker is a
//                    scope no rendered surface shows the user setting it; a
//                    marked key the merge does not enforce is a promise nothing
//                    keeps. The set is hand-maintained precisely so it is not a
//                    runtime read of the schema (CADENCE_CONFIG_SCHEMA would
//                    otherwise un-mark every protected key), which is what makes
//                    this cross-check the thing keeping the two honest.
//  18. gate          every config.schema.json `review.triggers.<t>.gate` row
//      agreement     against route-table.json's `review` grid, in both of the
//                    ways that row describes a gate: its `default`, which
//                    `config.mjs get` answers verbatim for an unset key, and
//                    its `purpose`, which must state a `<gate> at <level>`
//                    clause for solo, shipped and critical. Three surfaces
//                    described these gates and nothing made them agree - a
//                    `phase_diff` default of `advisory` outlived the v3.2.0
//                    move of that cell to `off` at `shipped` with every check
//                    green, and workflows/execute.md carried a paragraph
//                    telling callers to route around the seam because of it.
//                    The grid is the AUTHORITY, so every issue is filed against
//                    config.schema.json, the side that moves. The rule is
//                    lib/gate-agreement.mjs; it takes no CONTRACTS row, for the
//                    reason check 14 states about `lib/*.mjs`.
//  19. text          a prose site that hands a seam a value derived from agent
//      transport     output or repository content must hand it a PATH: a
//                    double-quoted shell word carrying `$(...)` or a backtick
//                    executes before Node starts. That reasoning was conceded
//                    for one flag and re-derived nowhere, so sixteen other
//                    sites still prescribed the unsafe form. The register of
//                    every examined site, its classification and the reason on
//                    every out-of-scope row live in lib/text-transport.mjs, and
//                    a site the register does not classify is REPORTED - the
//                    check cannot be a whitelist that goes quiet on the
//                    seventeenth site. It is deliberately NOT built on check
//                    2's invocation parser: thirty of the qualifying mentions
//                    sit in prose fragments with no `<script>.mjs <word>`
//                    prefix, which that parser skips.
//  20. bulk output   a prose site that PRESCRIBES a tool call whose measured
//                    response is bulk must redirect that output to a scratch
//                    file and hand the transcript a digest: a response sitting
//                    in the transcript is re-paid on every later turn at the
//                    cache-read rate. The lesson v3.5.2 learned for
//                    caller-derived INPUT was never applied to bulk OUTPUT, so
//                    the largest response any Cadence prose prescribes - a
//                    68,044 B `trace render` - was read whole into a model's
//                    context at three sites. The register of every examined
//                    site, its measured byte figure and the reason on every row
//                    owing no redirect live in lib/bulk-output.mjs, and a site
//                    the register does not classify is REPORTED, for the reason
//                    check 19 states about its own seventeenth site. It takes
//                    no CONTRACTS row, for the reason check 14 states about
//                    `lib/*.mjs`.
//  21. per-run       the scratch file a converted bulk-output site writes must
//      scratch       belong to THIS RUN, and the read-back reading it must
//                    REFUSE rather than answer from a file it could not read.
//                    Check 20 holds neither half: it asserts a redirect EXISTS
//                    and never sees what it points AT, so a fixed shared name
//                    and `> /dev/stdout` pass it identically. That blind spot is
//                    what let six sites share five fixed names under one
//                    world-writable directory, where a concurrent run in another
//                    repository could answer this run's blocking `risk_surface`
//                    re-arm cap, and where a read-back defaulting a missing array
//                    to `[]` reported that gate as unspent. The three line-local
//                    rules and the gap they accept live in lib/scratch-path.mjs;
//                    this side only decides that they apply to every prose
//                    surface, for the reason check 19 states about its own scope.
//                    It takes no CONTRACTS row, for the reason check 14 states
//                    about `lib/*.mjs`.
//  22. refusal      every refusal a user can READ must name the next step. A
//      hints         site is in scope when it EMITS an `ok:false` envelope -
//                    `emit`, `out` or `fail` - never when it merely contains a
//                    field called `reason`, which is the rule that goes green
//                    while the largest refusal surface in the plugin stays
//                    untouched: keyed on the `reason:` object key alone it
//                    never sees `planning.mjs`'s 150-odd hintless `fail()`
//                    calls. Measured across cadence-core/bin on 2026-08-23,
//                    tests excluded, 186 sites set a literal `reason` and 13
//                    set a literal `hint` - 130 against 10 when #238 was filed
//                    - and every one of those hints sits in `planning.mjs` or
//                    `skim.mjs`. Writing the missing hints is a one-time sweep;
//                    the sweep going stale the next time a seam ships a refusal
//                    is what this check exists to stop. The rule, the balanced-
//                    span scan it classifies calls with, its exclusion register
//                    and the one-line reason on every row of it live in
//                    lib/refusal-hints.mjs; this side decides only that it
//                    applies to the whole root. It takes no CONTRACTS row, for
//                    the reason check 14 states about `lib/*.mjs`.
//  23. capture      a prose surface may issue a `.planning/CAPTURE.md` write
//      writers       only where a register row settles it, and the row has to
//                    say why that write cannot ACCUMULATE. CAPTURE holds the
//                    phase in flight; the defect this closes is
//                    `workflows/execute.md`'s phase close filing every open
//                    item into it, one call per item, which a prose edit alone
//                    leaves reachable by the next person to write a close step
//                    - it survived two plans' leases. A shell redirect at that
//                    path is its own kind, because it bypasses
//                    lib/capture-file.mjs, the one owner of the format. The
//                    register, the discriminator and the cost it accepts live
//                    in lib/capture-writers.mjs; this side only decides that it
//                    applies to every prose surface, for the reason check 19
//                    states about its own scope. It takes no CONTRACTS row, for
//                    the reason check 14 states about `lib/*.mjs`.
//  24. reference     a reference COLD-SPLIT behind a router stays reachable
//      routers       from it: the cold file is on disk, the router still
//                    carries a ${CLAUDE_PLUGIN_ROOT} Read of it, and a
//                    references/*.md path a registered router names outside
//                    every fenced block has a register row. A cold branch is
//                    reachable from PROSE and from nowhere else, so a deleted
//                    Read line leaves a green tree and an unreachable rule -
//                    which for `references/triage-gate.md` is the ONE-round cap
//                    on a blocking re-arm. The register, the three arms and the
//                    fenced-block exclusion live in lib/reference-routers.mjs;
//                    this side only decides that it applies to the whole root.
//                    It takes no CONTRACTS row, for the reason check 14 states
//                    about `lib/*.mjs`.
//  25. hook events  every event name `hooks/hooks.json` registers has a row in
//                    lib/hook-events.mjs saying what that event is for. A hook
//                    is the one surface the HOST names rather than Cadence, and
//                    a name it does not know registers NOTHING - no error, no
//                    refusal, no empty result, just a hook that never fires
//                    again. For `SubagentStop` that is the trace bracket's
//                    close half going quiet and the record filling with
//                    `unpaired` rows. Nothing else here can see it: the file is
//                    JSON, so the markdown walk never opens it, and check 3
//                    proves only that the SCRIPT exists, which it does either
//                    way. The register, the one-line reason on every row and
//                    the deliberate single direction - a REMOVED registration
//                    is an ordinary edit and is not reported - live in
//                    lib/hook-events.mjs; this side only decides that it
//                    applies to the whole root. It takes no CONTRACTS row, for
//                    the reason check 14 states about `lib/*.mjs`.
//
// Seam convention: one JSON line on stdout, exit 0 clean / 1 problems found.
// Usage: self-verify.mjs [--root <repo root>]
'use strict';

import { readFileSync, readdirSync, existsSync, statSync, readlinkSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { emit } from './lib/seam-io.mjs';
import { weighAll } from './lib/surface-weight.mjs';
import {
  rungBodyIssue, rungEffortIssue, rungPrefixIssues, rungFile, effortEnumIssues,
} from './lib/rung-agent.mjs';
import { cellIssues, declaredRoles, routableAgents, vocabularyIssues } from './lib/route-cells.mjs';
import { gateAgreementIssues } from './lib/gate-agreement.mjs';
import { parseReachTable, reachIssues } from './lib/config-reach.mjs';
import { globalOnlyMarkerIssues } from './lib/global-only-keys.mjs';
import { dispatchPhrasingIssues } from './lib/dispatch-phrasing.mjs';
import { relayIssues } from './lib/route-relay.mjs';
import { mergeWarningIssues } from './lib/merge-warnings.mjs';
import { parseSkillsField } from './lib/frontmatter.mjs';
import { deferredReadIssues, DEFERRED_READS } from './lib/deferred-reads.mjs';
import { referenceRouterIssues } from './lib/reference-routers.mjs';
import { includeConsumerIssues } from './lib/include-consumers.mjs';
import { refusalHintIssues } from './lib/refusal-hints.mjs';
import { textTransportIssues } from './lib/text-transport.mjs';
import { bulkOutputIssues } from './lib/bulk-output.mjs';
import { scratchPathIssues } from './lib/scratch-path.mjs';
import { captureWriterIssues } from './lib/capture-writers.mjs';
import { hookEventIssues } from './lib/hook-events.mjs';
// The subcommand/flag contract table, the accessor the prose lint reads its
// flag NAMES through, and the evaluator that applies one row's value grammar.
// All three are DEFINED in lib/arg-contract.mjs and imported here: one table,
// not two bound by a check (D-06). Check 2 below lints prose against it, check
// 14 requires a row for every shipped script, and the entry block at the foot
// of this file reads its OWN `--root` through the row it declares there rather
// than through a hand-written reader call - the rule comes from the
// declaration, not from a call this file restates.
import { CONTRACTS, flagNames, evaluateFlag, subcommandKey } from './lib/arg-contract.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * Check 13's register, overridable by PATH. It was modelled on
 * `CADENCE_ROUTE_TABLE` and `CADENCE_CONFIG_SCHEMA`, but those two are now
 * gated behind the `CADENCE_TEST_SEAM` sentinel and fall back SILENTLY to the
 * shipped file, so the shapes have diverged and this one is deliberately the
 * odd one out: ungated, and reporting an unusable override rather than falling
 * back (phase-2 D-16). What it redirects is the register a drift LINTER reads,
 * not data an enforcement answer is computed from, so the failure the gate
 * exists to prevent there - an injected path quietly changing what a gate
 * decides - has no counterpart here.
 *
 * The pure rule takes its rows as a parameter so a test can anchor a SYNTHETIC
 * row at a real workflow file without adding one to the shipped register;
 * without this seam the disk half is only ever exercised with the four shipped
 * rows, so it could load the wrong register, drop a row carrying a non-default
 * `file`, or fail to surface the issue at all, and every fixture that calls the
 * rule directly would still be green.
 *
 * A file that is unreadable or is not an array is a REPORTED problem, never a
 * silent fall back to the shipped rows: a fixture whose seam did not take must
 * fail loudly rather than pass on the wrong register.
 * @param {{kind: string, file: string, detail: string}[]} problems
 * @returns {ReadonlyArray<{skill: string, reference: string,
 *   anchors: readonly string[], read_paragraphs: number, file?: string}>}
 */
function deferredRows(problems) {
  const path = process.env.CADENCE_DEFERRED_READS;
  if (!path) return DEFERRED_READS;
  try {
    const rows = JSON.parse(readFileSync(path, 'utf8'));
    if (!Array.isArray(rows)) throw new Error('not an array of register rows');
    return rows;
  } catch (e) {
    problems.push({ kind: 'unreadable-surface', file: path,
      detail: `CADENCE_DEFERRED_READS: ${e && e.message ? e.message : String(e)}` });
    return [];
  }
}

// The reach table (check 9), root-relative and platform-separated so it can be
// compared against a `relative(root, file)` walk result.
const REACH_DOC = join('cadence-core', 'references', 'config-reach.md');

// The two surfaces check 10 applies to, same shape and same reason: compared
// against a `relative(root, file)` walk result, with the separator appended so
// a sibling directory whose name merely starts the same cannot match.
const WORKFLOWS_DIR = join('cadence-core', 'workflows') + sep;
const REFERENCES_DIR = join('cadence-core', 'references') + sep;

// The canonical Claude Code tool vocabulary the agents-only tools lint checks
// against - a FIXED set, not derived from the tree, so a single-agent fixture
// still has a full vocabulary to test with.
// `LSP` is here as well as on the two cad-executor rungs' `tools:` lines, and
// BOTH halves are required (D-14): this lint is one-directional - it flags
// referenced-but-undeclared only - so a token outside this vocabulary is scanned
// by nothing at all, and "the tools lint passes with it" would be vacuously true.
const KNOWN_TOOLS = ['Read', 'Write', 'Edit', 'MultiEdit', 'Bash', 'Grep',
  'Glob', 'Task', 'WebFetch', 'WebSearch', 'NotebookEdit', 'TodoWrite', 'LSP'];

// --- helpers -----------------------------------------------------------------

/**
 * Yield every `.md` surface this linter reads, as `{ file }`, plus a
 * `{ file, unreadable }` marker for each directory whose own listing threw.
 *
 * The walk is per ENTRY, one directory's own children at a time: a single
 * `recursive: true` read wrapped in one try returns nothing for a WHOLE
 * subtree the moment one descendant throws, and the old fallback then yielded
 * the BRANCH root as the unreadable surface - so a mode-000 `skills/private`
 * was reported as `skills` with the errno of a failed readFileSync (EISDIR),
 * never naming the directory that is actually unreadable, while every readable
 * sibling under `skills` went unlinted (#49.1, D-06). Descending only on
 * `isDirectory()` also stops this walker at symlinked DIRECTORIES, matching
 * lib/surface-weight.mjs so the reporting and enforcing halves traverse the
 * same set. A named branch root is still descended - the dirent test only ever
 * sees descendants.
 * @param {string} root
 * @returns {Generator<{ file: string, unreadable?: string }>}
 */
function* mdFiles(root) {
  const dirs = [
    join(root, 'cadence-core', 'workflows'),
    join(root, 'cadence-core', 'references'),
    join(root, 'cadence-core', 'templates'),
    join(root, 'skills'),
    join(root, 'agents'),
    // `docs/` carries the published pages the landing page hands its
    // reference material to (v3.5.5, D-05). They are as key-and-path-dense as
    // README itself, so leaving them off the walk would mean a claim stops
    // being CI-enforced at the moment it MOVES - which is exactly what the
    // two unchecked `weight.mjs` invocations in docs/EVIDENCE.md were.
    join(root, 'docs'),
  ];
  /** @param {string} dir @returns {Generator<{ file: string, unreadable?: string }>} */
  function* walk(dir) {
    let list;
    try {
      list = readdirSync(dir, { withFileTypes: true });
    } catch (e) {
      // This directory alone is the unreadable surface, named by its own
      // path and with its OWN errno - and the walk descends no further
      // into it, while its siblings stay linted.
      yield { file: dir, unreadable: e.code || e.message };
      return;
    }
    for (const d of list) {
      const f = join(dir, d.name);
      if (d.isDirectory()) {
        yield* walk(f);
        continue;
      }
      if (!f.endsWith('.md')) continue;
      // Deliberately optimistic on the throw: a symlink that fails the
      // stat (dangling, cycle) still reaches the reporter as a file,
      // rather than vanishing silently from the walk.
      let isFile;
      try {
        isFile = statSync(f).isFile();
      } catch {
        isFile = true;
      }
      if (isFile) yield { file: f };
    }
  }
  for (const d of dirs) {
    if (!existsSync(d)) continue;
    yield* walk(d);
  }
  // README, INTERNALS and METHOD name user-facing switches and live file paths -
  // they are live surfaces too, as is every page under `docs/` walked above.
  // Historical docs (DESIGN/LINEAGE/CHANGELOG) stay out: they legitimately name
  // keys that were later cut, while explaining the cut.
  for (const doc of ['README.md', 'INTERNALS.md', 'METHOD.md']) {
    const p = join(root, doc);
    if (existsSync(p)) yield { file: p };
  }
}

/**
 * Every `.mjs` SOURCE file under cadence-core/bin, for check 12. `mdFiles`
 * traverses `.md` surfaces only and cannot be reused - this is the one check
 * whose subject is code rather than prose.
 *
 * Two exclusions, both deliberate. `*.test.mjs`: a test file calls the seams it
 * tests and a fixture string may contain any shape at all, so linting them
 * would report the tests written to PIN this very rule. `lib/config-merge.mjs`:
 * it DEFINES `mergeLayers` and returns the warnings itself - there is nothing
 * upstream of it to surface them to.
 *
 * Guarded per ENTRY like `mdFiles`, for the #49.1 reason: one unreadable
 * descendant must hide only its own children, not silently unlint every
 * sibling.
 *
 * `{ every: true }` drops BOTH exclusions and the extension filter with them,
 * yielding every regular file under the directory - that arm is check 15's
 * input, not check 12's. A byte-level fault has no reason to respect the
 * boundaries a source-lint draws: a NUL typed into a `*.test.mjs`, into
 * `lib/config-merge.mjs`, or into `weight-budgets.json` makes `grep` skip that
 * file exactly as loudly as one typed into a linted seam.
 * @param {string} root
 * @param {{ every?: boolean }} [opts]
 * @returns {Generator<{ file: string, unreadable?: string }>}
 */
function* binFiles(root, opts = {}) {
  const every = opts.every === true;
  const binDir = join(root, 'cadence-core', 'bin');
  const skip = join(binDir, 'lib', 'config-merge.mjs');
  /** @param {string} dir @returns {Generator<{ file: string, unreadable?: string }>} */
  function* walk(dir) {
    let list;
    try {
      list = readdirSync(dir, { withFileTypes: true });
    } catch (e) {
      yield { file: dir, unreadable: e.code || e.message };
      return;
    }
    for (const d of list) {
      const f = join(dir, d.name);
      if (d.isDirectory()) {
        yield* walk(f);
        continue;
      }
      if (every) {
        if (!d.isFile()) continue;
        yield { file: f };
        continue;
      }
      if (!f.endsWith('.mjs') || f.endsWith('.test.mjs') || f === skip) continue;
      yield { file: f };
    }
  }
  if (!existsSync(binDir)) return;
  yield* walk(binDir);
}

/**
 * Expand <t>/<trigger>/<name>-style placeholders into every concrete key
 * they stand for (cartesian across placeholders). A single representative
 * would under-cover the reverse check: prose that says
 * `review.triggers.<t>.tier` covers ALL triggers' tier keys, not just plan's.
 * @param {string} token @param {string[]} triggers @param {string[]} providers
 */
function expand(token, triggers, providers) {
  let out = [token];
  const subst = (list, re, values) =>
    list.flatMap((t) => re.test(t) ? values.map((v) => t.replace(re, v)) : [t]);
  out = subst(out, /<t(?:rigger)?>?/g, triggers);
  out = subst(out, /<(?:name|provider)>?/g, providers);
  return out;
}

// --- checks ------------------------------------------------------------------

function run(root) {
  const problems = [];
  // The plugin manifest is the definitive marker of a real Cadence install -
  // a minimal test fixture never creates one, so fixtures stay lenient about
  // always-expected inputs (D-03) while a full tree with one missing (a core
  // surface dir, weight-budgets.json, INTERNALS.md) fails loud, not silently
  // skips-and-stays-green (#44).
  const isFullTree = existsSync(join(root, '.claude-plugin', 'plugin.json'));
  const schema = JSON.parse(
    readFileSync(join(root, 'cadence-core', 'config.schema.json'), 'utf8')).keys;
  const schemaKeys = Object.keys(schema);
  const FAMILIES = new Set(schemaKeys.map((k) => k.split('.')[0]));
  const NON_KEY_SEGMENT = new Set(['md', 'json', 'mjs', 'test', 'schema']);
  const TRIGGERS = [...new Set(schemaKeys
    .filter((k) => k.startsWith('review.triggers.')).map((k) => k.split('.')[2]))];
  const PROVIDERS = [...new Set(schemaKeys
    .filter((k) => k.startsWith('review.providers.')).map((k) => k.split('.')[2]))];
  // Keys with no dot can never match the dotted-token regex; they are covered
  // by a bare-word mention instead.
  const BARE_KEYS = schemaKeys.filter((k) => !k.includes('.'));

  const seenTokens = new Set();

  // 0. always-expected core surface dirs (#44): a full tree missing one of
  // these is a real break (a renamed/deleted dir), not a fixture omitting an
  // optional input - so it is only a hard failure when isFullTree.
  if (isFullTree) {
    for (const d of ['cadence-core/workflows', 'cadence-core/references',
      'cadence-core/templates', 'skills', 'agents']) {
      if (!existsSync(join(root, d))) {
        problems.push({ kind: 'missing-input', file: d, detail: 'core surface dir absent' });
      }
    }
  }

  for (const { file, unreadable } of mdFiles(root)) {
    const rel = relative(root, file);
    // A directory the walker could not list: report THAT path with the errno
    // its own readdirSync threw, before any read is attempted on it.
    if (unreadable) {
      problems.push({ kind: 'unreadable-surface', file: rel, detail: unreadable });
      continue;
    }
    let text;
    try {
      text = readFileSync(file, 'utf8');
    } catch (e) {
      // Name the link target when there is one - costs one line here and
      // saves the operator an `ls -l` on a rare failure. Use e.code rather
      // than the full message when a target is known, so the detail stays
      // free of machine-specific absolute paths.
      let target = null;
      try {
        target = readlinkSync(file);
      } catch { /* not a symlink, or target unreadable too */ }
      const detail = target
        ? `unreadable symlink -> ${target} (${e.code || e.message})`
        : (e.code || e.message);
      problems.push({ kind: 'unreadable-surface', file: rel, detail });
      continue;
    }

    // 1. config-key tokens: family-rooted dotted identifiers.
    // Scanned over a copy with every URL masked out, because a HOSTNAME is
    // shaped exactly like a config key: `https://git.jcrenshaw.dev/...` reads
    // as a `git.*` token under the real `git` schema family, matches no key,
    // and reports unknown-config-key the moment README carries the install
    // URL. The narrowing is bounded to URLs on purpose - a dotted token in
    // ordinary prose is still a key claim, so the check keeps its teeth
    // everywhere a key is actually written; only the span between `https://`
    // and the next whitespace, bracket or quote stops being read as prose.
    // Only this loop uses the masked copy: the BARE_KEYS loop, the invocation
    // join and the ${CLAUDE_PLUGIN_ROOT} loop below are unaffected by
    // hostnames, and masking there would cost coverage for nothing.
    const scanText = text.replace(/https?:\/\/[^\s)\]}>'"`]*/g, ' ');
    for (const m of scanText.matchAll(/\b([a-z_]+(?:\.[a-z_0-9<>]+)+)/g)) {
      // A closing placeholder bracket can trail the token (`<review.consult.effort>`).
      const raw = m[1].replace(/>+$/, '');
      const family = raw.split('.')[0];
      if (!FAMILIES.has(family)) continue;
      if (raw.split('.').some((seg) => NON_KEY_SEGMENT.has(seg))) continue;
      const expansions = expand(raw, TRIGGERS, PROVIDERS);
      // The reach table (check 9) names all 72 keys by construction, so
      // letting it feed seenTokens would make 1b's inert-config-key
      // unreachable forever - a key nothing but the table mentions would
      // read as referenced. It still feeds the FORWARD scan below: class 2
      // (unknown-reach-key) inspects the Key column only, so a dead token in
      // that file's prose or an `Honoured by` cell would otherwise be scanned
      // by nothing at all.
      if (rel !== REACH_DOC) for (const t of expansions) seenTokens.add(t);
      // A token is known when it IS a key or stops at a boundary inside one.
      // The boundary arm is not cosmetic: this tokenizer's segment class is
      // [a-z_0-9<>], so a hyphenated key like `model.overrides.cad-planner`
      // tokenizes to `model.overrides.cad` and would report unknown for the
      // correct spelling of a real key. `.` and `-` both end a token; `_`
      // does not, so `git.on` still fails against `git.on_protected` and the
      // check keeps its teeth on a truncated guess.
      const known = expansions.some((t) =>
        schemaKeys.some((k) => k === t
          || (k.startsWith(t) && !/[a-z0-9_]/.test(k.charAt(t.length)))));
      if (!known) problems.push({ kind: 'unknown-config-key', file: rel, detail: raw });
    }
    if (rel !== REACH_DOC) {
      for (const k of BARE_KEYS) {
        if (new RegExp(`\\b${k}\\b`).test(text)) seenTokens.add(k);
      }
    }

    // 2. script invocations.
    // Join backslash continuations so multi-line commands read as one. The
    // `\r?` arm exists so a CRLF-checked-out prose file joins like an LF one.
    // This join is now the only place in the plugin that reads continuations:
    // the git rails once carried the same rule as escape state in a shell
    // tokenizer, and that tokenizer is deleted (the guard reads a segment's
    // command word and nothing else, so a continued command is silent to it by
    // design). The input here is PROSE, so a regex join is the whole job. The
    // invariant is the PARITY requirement below - an even trailing run is a
    // literal backslash, not a continuation. The
    // trailing class is `[ \t]*`, not `\s*`: `\s` matches `\n`, so `\s*`
    // would swallow the newline that ends the continued line and merge the
    // NEXT line into the joined command, letting the flag-checking regex
    // below (bounded by `[^\n]*`) read words that were never on that
    // command line. Parity is the point: a trailing RUN of backslashes
    // continues the line only when
    // its length is ODD, so `\\` at EOL is a literal backslash and the newline
    // still ends the command. Joining anyway merges the next line in and
    // reports a flag that was never on this command (a false unknown-flag).
    const joined = text.replace(/(\\+)(\r?\n)[ \t]*/g, (_m, slashes, nl) => (slashes.length % 2
      ? `${slashes.slice(0, -1)} `
      : `${slashes}${nl}`));
    for (const m of joined.matchAll(/([a-z-]+\.mjs)"?\s+([a-z-]+)(?:\s+([a-z-]+))?([^\n]*)/g)) {
      const [, script, w1, w2, restRaw] = m;
      const contract = CONTRACTS[script];
      // Not one of ours - prose may name a third-party script and this lint has
      // nothing to say about it. That `continue` is why check 14 exists: a
      // Cadence script whose row is DELETED becomes indistinguishable from a
      // foreign one here, so the miss has to be caught by enumerating the bin
      // directory, never by this arm.
      if (!contract) continue;
      // A first word starting with `-` is a FLAG, not a subcommand: this is the
      // bare form. Reading it as a subcommand reported `unknown-subcommand` on
      // correct prose like `weight.mjs --root <path>`.
      const bare = w1.startsWith('-');
      const sub = subcommandKey([w1, w2]);
      if (!contract[sub]) {
        problems.push({ kind: 'unknown-subcommand', file: rel,
          detail: `${script} ${bare ? '(bare form)' : sub}` });
        continue;
      }
      const allowed = new Set([...flagNames(contract[sub]), ...flagNames(contract['*'])]);
      // The bare form's own first word IS a flag, so it must be scanned; the
      // subcommand forms consume w1 as the name and scan from w2 on.
      const rest = bare
        ? ` ${w1} ${w2 || ''}${restRaw}`
        : (sub.includes(' ') ? '' : ` ${w2 || ''}`) + restRaw;
      for (const f of rest.matchAll(/--[a-z-]+/g)) {
        if (!allowed.has(f[0])) {
          problems.push({ kind: 'unknown-flag', file: rel, detail: `${script} ${sub} ${f[0]}` });
        }
      }
    }

    // 3. plugin-root path references.
    for (const m of text.matchAll(/\$\{CLAUDE_PLUGIN_ROOT\}\/([A-Za-z0-9_\-./]+)/g)) {
      const p = m[1].replace(/[.,;:]+$/, '');
      if (p.includes('{')) continue; // templated path, not checkable
      if (!existsSync(join(root, p))) {
        problems.push({ kind: 'missing-path', file: rel, detail: p });
      }
    }

    // 10. dispatch phrasing: in a block claiming concurrency for a set, every
    // sentence that ISSUES the set - imperative mood, or a trailing colon -
    // and hands it out one member at a time, hedges on the host, or dispatches
    // it concurrently without saying it goes out in one message. The rule, its
    // masking, its imperative gate and its false-positive cost live in
    // lib/dispatch-phrasing.mjs; this side only decides WHERE it applies.
    // Scoped to these two directories because they are where dispatch
    // instructions are AUTHORED. Not because the other surfaces are
    // dispatch-free - skills/ carries
    // at least one concurrent-dispatch instruction of its own - but because
    // widening the scope to skills/ is a separate decision this check does not
    // make; self-verify.test.mjs pins the skills case as out of scope on
    // purpose.
    if (rel.startsWith(WORKFLOWS_DIR) || rel.startsWith(REFERENCES_DIR)) {
      for (const { code, detail } of dispatchPhrasingIssues(text)) {
        problems.push({ kind: code, file: rel, detail });
      }
    }

    // 11. a prose file that ISSUES a route.mjs resolve must carry the relay rule
    // for the warnings[] that resolve returns. The rule and its accepted cost
    // live in lib/route-relay.mjs; this side only decides WHERE it applies -
    // EVERY surface this walk yields, not check 10's two directories. A call
    // site in skills/ would relay nothing just as loudly, and unlike the
    // phrasing rule this one triggers on a literal invocation form rather than
    // on prose shape, so widening it costs no false positives.
    for (const { code, detail } of relayIssues(text)) {
      problems.push({ kind: code, file: rel, detail });
    }

    // 19. text transport: a prose site that hands a seam a CALLER-DERIVED value
    // must hand it a path, not a double-quoted shell word. Every surface this
    // walk yields, for the reason check 11 states about its own scope: a
    // dispatch site in skills/ interpolates the same agent output a workflow
    // does. The register of sites, the classification and the three reported
    // kinds live in lib/text-transport.mjs; this side only decides that it
    // applies to every prose surface. It takes no CONTRACTS row, for the reason
    // check 14 states about `lib/*.mjs`.
    problems.push(...textTransportIssues(rel, text));

    // 20. bulk output: a prose site that PRESCRIBES a tool call whose measured
    // response is bulk must redirect it to a scratch file and hand the
    // transcript a digest. Every surface this walk yields, for the reason
    // check 19 states about its own scope - a step in skills/ pays for a
    // 68,044 B response exactly as a workflow does. The register of sites,
    // their measured figures and the three reported kinds live in
    // lib/bulk-output.mjs; this side only decides that it applies to every
    // prose surface. It takes no CONTRACTS row, for the reason check 14 states
    // about `lib/*.mjs`.
    problems.push(...bulkOutputIssues(rel, text));

    // 21. per-run scratch: a converted bulk-output site must write into a
    // directory THIS run made, and its read-back must refuse a file it could
    // not read, parse or recognise instead of answering from it. Every surface
    // this walk yields, for the reason check 19 states about its own scope: a
    // step in skills/ pays for a collision exactly as a workflow does. Check 20
    // cannot stand in for it - it sees that a redirect is there and never what
    // it points at, so nothing in this tree held the shape in place. The three
    // rules and the gap they accept live in lib/scratch-path.mjs; this side
    // only decides where they apply. It takes no CONTRACTS row, for the reason
    // check 14 states about `lib/*.mjs`.
    problems.push(...scratchPathIssues(rel, text));

    // 23. capture writers: a prose site that ISSUES a `.planning/CAPTURE.md`
    // write must be settled by a register row stating why that write cannot
    // accumulate, and a shell redirect at that path is reported outright. Every
    // surface this walk yields, for the reason check 19 states about its own
    // scope: a close step in skills/ fills the queue exactly as a workflow
    // does. The register, the two-shape discriminator and the cost it accepts
    // live in lib/capture-writers.mjs; this side only decides that it applies
    // to every prose surface. It takes no CONTRACTS row, for the reason check
    // 14 states about `lib/*.mjs`.
    problems.push(...captureWriterIssues(rel, text));
  }

  // 3b. INTERNALS repo-path citations: every backticked repo path in
  // INTERNALS.md ("Read the code: `cadence-core/bin/route.mjs`") must exist, so
  // the deep-dive pointers cannot quietly go stale as the tree moves. Unlike
  // check 3 (which only sees ${CLAUDE_PLUGIN_ROOT} paths), these are plain
  // repo-relative paths; globs (`*-decision.mjs`) and non-path spans are skipped.
  const internals = join(root, 'INTERNALS.md');
  if (existsSync(internals)) {
    // Guarded for the same reason the walkers are (#49.1): a read that throws
    // AFTER the walk unwinds run() entirely, and the dispatch catch flattens
    // it to {ok:false,reason:"internal"} with `problems` absent - discarding
    // every problem found so far. Guarding only the walk closes half the
    // class; `chmod 000 INTERNALS.md` still collapsed the whole run.
    // No problem is pushed here: mdFiles yields INTERNALS.md too (:144), so
    // the read-guard above has already reported it and a second entry would
    // double-count one file - the same call the agents lint makes.
    let internalsText = null;
    try {
      internalsText = readFileSync(internals, 'utf8');
    } catch { /* already reported by the mdFiles read-guard */ }
    for (const m of (internalsText || '').matchAll(/`([^`]+)`/g)) {
      const tok = m[1];
      if (!/^[A-Za-z0-9_./-]+$/.test(tok) || !tok.includes('/') || tok.includes('*')) continue;
      if (!existsSync(join(root, tok))) {
        problems.push({ kind: 'missing-internals-path', file: 'INTERNALS.md', detail: tok });
      }
    }
  } else if (isFullTree) {
    problems.push({ kind: 'missing-input', file: 'INTERNALS.md', detail: 'always-expected input absent' });
  }

  // 1b. reverse: every schema key must be referenced by some prose token -
  // exactly, or via a >=2-segment prefix like `review.providers` (a bare
  // family name alone is too weak to count as a reader).
  for (const key of schemaKeys) {
    const covered = [...seenTokens].some((t) =>
      key === t || (t.split('.').length >= 2 && key.startsWith(t + '.')));
    if (!covered) problems.push({ kind: 'inert-config-key', file: 'cadence-core/config.schema.json', detail: key });
  }

  // 4. context-weight budgets: every measured prose surface (agents/skills/
  // workflows, via the SAME lib weight.mjs reports with, so enforced weight
  // cannot diverge from reported weight) must have a budget entry and EQUAL it
  // exactly - a shrink is as much a mismatch as a growth. The manifest is
  // root-relative like config.schema.json, so a --root fixture can supply its
  // own; an absent manifest skips the check.
  //
  // A CEILING, not an equality. Exactness was tried and cost more than it
  // caught: every prose cut, however obviously good, turned CI red until its
  // budget row was re-pinned in the same commit, so the check taxed shrinking
  // at exactly the rate it taxed growth. Growth is the risk a budget exists to
  // catch. A surface under its entry is a surface that got smaller, which needs
  // no gate - re-pin the row when convenient, or leave the headroom.
  const budgetPath = join(root, 'cadence-core', 'bin', 'weight-budgets.json');
  if (existsSync(budgetPath)) {
    // Same guard as INTERNALS.md above: unreadable OR malformed JSON here
    // used to sink the entire run rather than report one problem.
    let budgets = null;
    try {
      budgets = JSON.parse(readFileSync(budgetPath, 'utf8')).budgets || {};
    } catch (e) {
      problems.push({ kind: 'unreadable-surface', file: 'cadence-core/bin/weight-budgets.json',
        detail: e.code || e.message });
    }
    for (const { surface, bytes } of (budgets ? weighAll(root) : [])) {
      if (!(surface in budgets)) {
        problems.push({ kind: 'unbudgeted-surface', file: surface, detail: 'no budget entry' });
        continue;
      }
      const budget = budgets[surface];
      // CADENCE-CENSUS: weight-budgets | asserts: weight-budgets.json holds a UTF-8 byte CEILING for every budgeted prose surface
      if (bytes > budget) {
        problems.push({ kind: 'budget-overrun', file: surface,
          detail: `${bytes}B exceeds budget ${budget}B by ${bytes - budget}B` });
      }
    }
  } else if (isFullTree) {
    problems.push({ kind: 'missing-input', file: 'cadence-core/bin/weight-budgets.json', detail: 'always-expected input absent' });
  }

  // 5. agents-only tools-declaration lint, and 6. the preloaded-contract
  // resolution check - one walk of agents/, because both read the same
  // frontmatter and the second supplies the first with prose to scan.
  //
  // 5: an agent's prose may only reference tools it declares in frontmatter
  // `tools:`. Skills declare capability under `allowed-tools:` and are excluded
  // as SKILLS (D-07) - but a contract skill an agent PRELOADS is that agent's
  // own prose, injected verbatim at startup, so it is scanned here as part of
  // the agent. Without that, moving a contract out of the agent body (#74)
  // would silently empty this lint's input. Only backtick-quoted mentions or
  // "the <Tool> tool" phrasing count as references (D-06); bare-word uses
  // (`| Task |`, `Task completeness`, `Write \`None.\``) are ignored, so no
  // current prose needs editing.
  //
  // 6: every name in `skills:` must resolve to skills/<name>/SKILL.md and must
  // NOT set `disable-model-invocation: true`. Both failures are SILENT in the
  // host - a missing or disabled skill is skipped with only a debug-log
  // warning, and a skill that disables model invocation cannot be preloaded at
  // all. Either one produces an agent running with no contract, which reads
  // like an agent that decided to ignore its instructions rather than like a
  // typo. This check is what makes preloading safe to depend on (#74).
  const toolAlt = KNOWN_TOOLS.join('|');
  const backtickRe = new RegExp('`(' + toolAlt + ')`', 'g');
  const theToolRe = new RegExp('\\bthe (' + toolAlt + ') tool\\b', 'g');
  // This site runs AFTER the budget check, on the same agents/ directory
  // the filed repro (#49.1) targets - guarding only mdFiles and the shared
  // surfaces() walker (D-13) would leave the exact repro reachable here,
  // one check later. mdFiles already reported the same file as an
  // unreadable-surface problem, so this loop pushes NO problem of its own
  // for an unreadable entry - just skips it, to avoid double-counting one
  // broken link.
  const agentsDir = join(root, 'agents');
  // Hoisted: check 8's reverse direction (disk -> table) needs the same
  // listing, and reading the directory twice invites the two checks to
  // disagree about what is on disk.
  /** @type {string[]} */
  let agentFiles = [];
  // Hoisted for the same reason: check 7d below compares one role's rung
  // bodies against EACH OTHER, so it cannot run inside a per-file loop and
  // must not re-read a directory this walk already read.
  /** @type {Record<string, string>} */
  const agentBodies = {};
  if (existsSync(agentsDir)) {
    try {
      agentFiles = readdirSync(agentsDir, { encoding: 'utf8' });
    } catch {
      agentFiles = [];
    }
    for (const e of agentFiles) {
      const file = join(agentsDir, e);
      if (!e.endsWith('.md')) continue;
      let isFile;
      try {
        isFile = statSync(file).isFile();
      } catch {
        continue;
      }
      if (!isFile) continue;
      let text;
      try {
        text = readFileSync(file, 'utf8');
      } catch {
        continue;
      }
      const rel = relative(root, file);
      // Frontmatter is the block between the first `---` and the next `---`;
      // the rest is the prose body the lint scans.
      const fm = text.match(/^---\n([\s\S]*?)\n---/);
      const declared = new Set();
      if (fm) {
        const toolsLine = fm[1].match(/^tools:\s*(.+)$/m);
        if (toolsLine) {
          for (const t of toolsLine[1].split(',')) {
            const name = t.trim();
            if (name) declared.add(name);
          }
        }
      }
      // 6. resolve every preloaded contract, collecting its prose for the
      // tools lint below. An unreadable SKILL.md is NOT reported here: skills/
      // is on the mdFiles walk, so the read-guard above already named it as an
      // unreadable-surface, and a second entry would double-count one file -
      // the same convention checks 3b and 5 follow.
      const preloaded = [];
      for (const skill of (fm ? parseSkillsField(fm[1]) : [])) {
        const skillFile = join(root, 'skills', skill, 'SKILL.md');
        if (!existsSync(skillFile)) {
          problems.push({ kind: 'missing-agent-skill', file: rel,
            detail: `${skill} -> skills/${skill}/SKILL.md absent` });
          continue;
        }
        let skillText;
        try {
          skillText = readFileSync(skillFile, 'utf8');
        } catch {
          continue;
        }
        const skillFm = skillText.match(/^---\n([\s\S]*?)\n---/);
        if (skillFm && /^disable-model-invocation:[ \t]*true[ \t]*$/m.test(skillFm[1])) {
          problems.push({ kind: 'unpreloadable-agent-skill', file: rel,
            detail: `${skill} sets disable-model-invocation: true` });
          continue;
        }
        preloaded.push(skillFm ? skillText.slice(skillFm[0].length) : skillText);
      }

      const body = fm ? text.slice(fm[0].length) : text;
      // Raw, un-normalized, frontmatter already off: check 7d after this walk
      // holds one role's rung bodies against each other byte for byte, and a
      // normalized copy would forgive the exact re-wrap it exists to catch.
      agentBodies[e.slice(0, -3)] = body;

      // 7. an agent that preloads a contract carries no behaviour of its own.
      // Scanned on the BODY only, never on the preloaded contract prose - the
      // contracts legitimately use this whole vocabulary, which is the point
      // of them. Gated on the `skills:` key rather than on size: a 200-byte
      // behavioural instruction fits under any budget, so a size check would
      // miss exactly the failure this exists to catch, and gating on `skills:`
      // keeps a future one-off agent with inline prose legal (D-04).
      //
      // TWO arms, denylist first then allowlist, because the denylist alone
      // enforced less than INTERNALS.md:11 and DESIGN.md:378 claim of it. A
      // body carrying `<process>` is named by its tag, which is the more
      // actionable message; a body carrying no tag at all is then held to the
      // canonical template, which is what catches plain-prose behaviour and a
      // same-size REPLACEMENT of the pointer paragraph. Byte budgets were the
      // accidental backstop here - they catch an append and nothing else.
      if (fm && /^skills:/m.test(fm[1])) {
        const tags = [];
        for (const m of body.matchAll(
          /<(role|stance|process|returns|guardrails|success_criteria|dimensions)>/g)) {
          if (!tags.includes(m[1])) tags.push(m[1]);
        }
        if (tags.length) {
          problems.push({ kind: 'agent-carries-behaviour', file: rel,
            detail: `body carries contract section ${tags.map((t) => `<${t}>`).join(', ')} - the contract belongs in the preloaded skill` });
        } else {
          const issue = rungBodyIssue(body, parseSkillsField(fm[1]));
          if (issue) {
            problems.push({ kind: 'agent-carries-behaviour', file: rel,
              detail: `${issue.detail} - the contract belongs in the preloaded skill` });
          }
        }
      }

      // 7b. a rung file carries the effort the rung map filed it under.
      // Runs on the frontmatter of EVERY agent file, not only the ones
      // preloading a contract, because the map may name any of them. This is
      // now the ONLY rule reading a rung file's `effort:` against anything:
      // check 7 above used to hold the body against this same field, and that
      // arm went with the rung sentence (RNG-03), while check 8 below reads
      // the rung out of the FILENAME rather than out of the file. Without this
      // the one link that decides how deep the dispatch actually thinks goes
      // unchecked.
      if (fm) {
        const effortLine = fm[1].match(/^effort:[ \t]*(\S+)[ \t]*$/m);
        const mismatch = rungEffortIssue(e.slice(0, -3),
          effortLine ? effortLine[1] : undefined);
        if (mismatch) {
          problems.push({ kind: 'rung-effort-mismatch', file: rel, detail: mismatch.detail });
        }
      }

      // 7c. the verifier's narrow `Write` grant, asserted in both directions on
      // EVERY cad-verifier rung. Claude Code agent frontmatter exposes no
      // path-scoped tool permission - `tools:` and `disallowedTools:` are name
      // lists - so "one file under .planning/phases/<N>/" cannot be
      // host-enforced, and this check is the only mechanical backstop keeping
      // the milestone's one deliberate exception from widening silently in a
      // later edit. Write must be GRANTED (the verifier writes its findings
      // JSON); Edit and MultiEdit must stay DENIED and must never appear in
      // tools:. Keyed on the UNION of the two identities this agent has, never
      // one of them: the host dispatches by `name:`, while the rung map in
      // lib/rung-agent.mjs resolves the same agent by FILENAME. Checking either
      // alone leaves the other as an edit that slips a still-routed rung file
      // out of the check - rename `name:` and a filename-routed file goes
      // unchecked; rename the file and check 8 catches it, but only because
      // that map is the thing it audits. The union has no such seam.
      if (fm) {
        const nameLine = fm[1].match(/^name:[ \t]*(\S+)[ \t]*$/m);
        // YAML permits a quoted scalar, so the raw token can arrive as
        // `"cad-verifier"`. Strip one matched surrounding quote pair before
        // comparing: without it a quoted name matches neither arm below and the
        // `name:` half of the union goes silently dead. A silent skip in the
        // only mechanical backstop is the exact failure this check prevents.
        const agentName = nameLine ? nameLine[1].replace(/^(['"])([\s\S]*)\1$/, '$2') : '';
        const isVerifier = (id) => id === 'cad-verifier' || id.startsWith('cad-verifier-');
        if (isVerifier(agentName) || isVerifier(e.slice(0, -3))) {
          const denied = new Set();
          const denyLine = fm[1].match(/^disallowedTools:\s*(.+)$/m);
          if (denyLine) {
            for (const t of denyLine[1].split(',')) {
              const name = t.trim();
              if (name) denied.add(name);
            }
          }
          if (!declared.has('Write')) {
            problems.push({ kind: 'verifier-write-grant', file: rel,
              detail: 'Write not in tools: - the verifier cannot write its findings file' });
          }
          for (const tool of ['Edit', 'MultiEdit']) {
            if (!denied.has(tool)) {
              problems.push({ kind: 'verifier-write-grant', file: rel,
                detail: `${tool} not in disallowedTools:` });
            }
            if (declared.has(tool)) {
              problems.push({ kind: 'verifier-write-grant', file: rel,
                detail: `${tool} in tools: - the grant is Write only` });
            }
          }
        }
      }

      const referenced = new Set();
      for (const prose of [body, ...preloaded]) {
        for (const m of prose.matchAll(backtickRe)) referenced.add(m[1]);
        for (const m of prose.matchAll(theToolRe)) referenced.add(m[1]);
      }
      for (const tool of referenced) {
        if (!declared.has(tool)) {
          problems.push({ kind: 'undeclared-tool', file: rel, detail: `${tool} not in tools:` });
        }
      }
    }
  }

  // 7d. one role's rung files carry ONE body, byte for byte (RNG-03). A
  // cross-file rule, so it sits after the walk rather than in it: every check
  // above judges a file on its own, and a rung body that has drifted from its
  // siblings is still a perfectly legal rung file by all of them. The rule
  // itself is in lib/rung-agent.mjs beside RUNG_FILES, which is the one
  // statement of what a rung file is; this site owns only the envelope. It
  // runs unconditionally - an absent agents/ leaves `agentBodies` empty, and
  // an empty input yields nothing rather than a problem about a tree that has
  // no agents at all.
  for (const issue of rungPrefixIssues(agentBodies)) {
    problems.push({ kind: issue.code, file: `agents/${issue.stems[0]}.md`,
      detail: issue.detail });
  }

  // 8. the rung ladder, both directions. This iterates the TABLE, not a
  // directory, so it cannot live inside the agents/ walk above. Root-relative
  // like config.schema.json and weight-budgets.json, so a --root fixture can
  // supply its own; an absent table skips the check (a full tree missing it is
  // a missing-input, matching the other always-expected inputs). The read and
  // the parse are guarded the way the budget manifest's are: a malformed table
  // is ONE problem and the run continues, rather than unwinding run() into
  // {ok:false,reason:"internal"} and discarding every problem found so far
  // (the #49.1 collapse).
  const routeTablePath = join(root, 'cadence-core', 'route-table.json');
  // Hoisted out of the existsSync arm - the same hoist, for the same reason,
  // that `agentFiles` already carries above: step 8b below needs the parsed
  // table's `rung_order` when there is one and must still run when there is not.
  let table = null;
  if (existsSync(routeTablePath)) {
    try {
      table = JSON.parse(readFileSync(routeTablePath, 'utf8'));
    } catch (e) {
      problems.push({ kind: 'unreadable-surface', file: 'cadence-core/route-table.json',
        detail: e.code || e.message });
    }
    if (table && typeof table === 'object' && !Array.isArray(table)) {
      // The grids' own well-formedness, cell by cell. The vocabulary comes from
      // config.schema.json - the file that already defines these names (D-10) -
      // rather than from parsing references/review-triggers.md's Wiring table,
      // which has no stated grammar.
      const gateSpec = schema['review.triggers.plan.gate'] || {};
      const stakesSpec = schema.stakes || {};
      for (const { code, detail } of cellIssues(table, {
        levels: Array.isArray(stakesSpec.values) ? stakesSpec.values : [],
        triggers: TRIGGERS,
        gates: Array.isArray(gateSpec.values) ? gateSpec.values : [],
      })) {
        problems.push({ kind: code, file: 'cadence-core/route-table.json', detail });
      }

      // The shared vocabulary arrays against config.schema.json's own enums.
      // route.mjs compares levels by index in `stakes_order` and refuses a
      // user-set gate against `gates`, so either list drifting silently
      // reorders the ladder or refuses a gate `config.mjs set` accepts.
      const stakesValues = Array.isArray(stakesSpec.values) ? stakesSpec.values : [];
      for (const { code, detail } of vocabularyIssues(table, {
        levels: stakesValues,
        gates: Array.isArray(gateSpec.values) ? gateSpec.values : [],
      })) {
        problems.push({ kind: code, file: 'cadence-core/route-table.json', detail });
      }

      // 18. what the schema SAYS a gate is, against what the grid FIRES. Same
      // block because it is the one place both files are parsed and in hand.
      // Filed against config.schema.json rather than the table: the grid is the
      // authority and does not move, the schema is the side that reconciles to
      // it, so `file` has to name the file a maintainer edits.
      for (const { code, detail } of gateAgreementIssues(schema, table, {
        levels: stakesValues,
        gates: Array.isArray(gateSpec.values) ? gateSpec.values : [],
      })) {
        problems.push({ kind: code, file: 'cadence-core/config.schema.json', detail });
      }

      // table -> disk: every name route.mjs can return must exist. route.mjs
      // never checks the name it returns, so without this an unbuilt or
      // renamed rung fails at dispatch time instead of in CI.
      const routable = routableAgents(table);
      for (const [stem, cell] of routable) {
        if (!existsSync(join(root, 'agents', `${stem}.md`))) {
          problems.push({ kind: 'missing-rung-agent', file: 'cadence-core/route-table.json',
            detail: `${cell}: agents/${stem}.md absent` });
        }
      }
      // disk -> map: a rung-suffixed agent file lib/rung-agent.mjs files for
      // NOBODY is stale, and stays green without this while still paying
      // standing context in every main-session prompt. Matched ONLY on the
      // rung-suffixed shape: a blanket "not named by the table" rule would
      // outlaw the one-off agent with inline prose D-04 deliberately keeps
      // legal.
      //
      // This arm used to also file the reverse of the walk above - a file the
      // map DOES name that no cell reaches - and that half is gone (phase 1,
      // D-03). The two faults wanted opposite fixes, and the mapped one is the
      // ordinary state of a ladder that is complete on disk before the routing
      // cells catch up: every role carries every rung, and a cell names the
      // subset it needs. Refusing that would make the map's own shape a CI
      // failure. Reachability is still stated - route-table.json's `_meta`
      // says the reachable rungs are the ones some cell names - it is just not
      // a refusal any more.
      const order = Array.isArray(table.rung_order) ? table.rung_order : [];
      // Longest role name first, so a role that prefixes another cannot claim
      // the other's file.
      const roleNames = declaredRoles(table).sort((a, b) => b.length - a.length);
      for (const e of agentFiles) {
        if (!e.endsWith('.md')) continue;
        const stem = e.slice(0, -3);
        if (routable.has(stem)) continue;
        for (const role of roleNames) {
          if (!stem.startsWith(`${role}-`)) continue;
          const rung = stem.slice(role.length + 1);
          if (order.includes(rung) && rungFile(role, rung) !== stem) {
            // The fix is always the same one: delete the file, or file it in
            // the map. A file the map DOES name is not this arm's business.
            problems.push({ kind: 'undeclared-rung-agent', file: `agents/${stem}.md`,
              detail: `no cell names ${role} at rung ${rung}, and lib/rung-agent.mjs maps no file to it` });
          }
          break;
        }
      }
    }
  } else if (isFullTree) {
    problems.push({ kind: 'missing-input', file: 'cadence-core/route-table.json',
      detail: 'always-expected input absent' });
  }

  // 8b. the shipped `model.effort.<role>` enums against RUNG_FILES. OUTSIDE both
  // of check 8's table guards on purpose: nesting it under "the table exists AND
  // parses" would make a schema-vs-map proof conditional on a file it does not
  // read, on exactly the two trees where a drifted enum is likeliest and least
  // noticed - and would contradict effortEnumIssues's own tolerance of an absent
  // `rungOrder`, which exists so it can run without a table.
  //
  // Filed against config.schema.json, not the table: that is the file a
  // maintainer edits to fix it.
  for (const { code, detail } of effortEnumIssues(schema,
    table && Array.isArray(table.rung_order) ? table.rung_order : [])) {
    problems.push({ kind: code, file: 'cadence-core/config.schema.json', detail });
  }

  // 9. the config-key reach table, against config.schema.json in both
  // directions, plus the narrow-reach-must-be-stated rule. Root-relative like
  // route-table.json and weight-budgets.json, so a --root fixture can supply
  // its own schema AND its own table; an absent doc skips the check, and a
  // full tree missing it is a missing-input like the other always-expected
  // inputs. The read and the parse are guarded the way those two are: a
  // malformed table is problems ON THE TABLE and the run continues, rather
  // than unwinding run() into {ok:false,reason:"internal"} and discarding
  // every problem found so far (the #49.1 collapse). The read failure itself
  // pushes nothing - references/ is on the mdFiles walk, so the read-guard up
  // there already named the file, the convention checks 3b and 5 follow.
  const reachPath = join(root, REACH_DOC);
  if (existsSync(reachPath)) {
    let reachText = null;
    try {
      reachText = readFileSync(reachPath, 'utf8');
    } catch { /* already reported by the mdFiles read-guard */ }
    if (reachText !== null) {
      try {
        const { rows, issues } = parseReachTable(reachText);
        for (const { code, detail } of issues) {
          problems.push({ kind: code, file: REACH_DOC, detail });
        }
        // `rows === null` means the section heading is absent, already one
        // problem above - reporting all 72 keys missing on top of it would
        // bury the one fault under copies of another.
        if (rows) {
          for (const { code, detail } of reachIssues(schema, rows)) {
            problems.push({ kind: code, file: REACH_DOC, detail });
          }
        }
      } catch (e) {
        problems.push({ kind: 'unreadable-surface', file: REACH_DOC,
          detail: e && e.message ? e.message : String(e) });
      }
    }
  } else if (isFullTree) {
    problems.push({ kind: 'missing-input', file: REACH_DOC,
      detail: 'always-expected input absent' });
  }

  // 17. the global-only key set against the schema's `src` marker, both ways
  // (CFG-02). Reads the schema the run already loaded, so a --root fixture
  // supplies its own - like check 8b, and OUTSIDE check 9's doc guards, because
  // this proves the schema against a LIB and needs no reach table at all.
  //
  // Each direction is filed against the file a maintainer opens to fix it: an
  // unmarked enforced key is a schema edit, and a marked key nothing enforces is
  // a lib edit (or a marker to remove, which the detail names).
  const GLOBAL_ONLY_FILE = {
    'missing-global-only-marker': join('cadence-core', 'config.schema.json'),
    'undeclared-global-only-key': join('cadence-core', 'bin', 'lib', 'global-only-keys.mjs'),
  };
  for (const { code, detail } of globalOnlyMarkerIssues(schema)) {
    problems.push({ kind: code, file: GLOBAL_ONLY_FILE[code], detail });
  }

  // 12. mergeLayers callsites: bind the warnings[] or say in the file header
  // why the envelope is the surfacing (lib/merge-warnings.mjs holds the rule
  // and its accepted costs). This side decides only WHERE it applies - every
  // .mjs the bin walk yields. The read is guarded like every other walk read
  // (#49.1): an unreadable source file is one problem naming that file, never
  // an unwound run() that discards every problem found so far. Unlike the prose
  // walks there is no second reporter to defer to, so this one files it.
  for (const { file, unreadable } of binFiles(root)) {
    const rel = relative(root, file);
    if (unreadable) {
      problems.push({ kind: 'unreadable-surface', file: rel, detail: unreadable });
      continue;
    }
    let src = null;
    try {
      src = readFileSync(file, 'utf8');
    } catch (e) {
      problems.push({ kind: 'unreadable-surface', file: rel,
        detail: e && e.code ? e.code : String(e) });
      continue;
    }
    for (const { code, detail } of mergeWarningIssues(src)) {
      problems.push({ kind: code, file: rel, detail });
    }
  }

  // 13. deferred reads: every reference the register records as de-preloaded is
  // still Read by name at the step that needs it. The rule, its register and
  // the reason the unit is the SENTENCE live in lib/deferred-reads.mjs; this
  // side only decides that it applies to the whole root.
  for (const issue of deferredReadIssues(root, deferredRows(problems))) problems.push(issue);

  // 24. reference routers: a reference cold-split behind a router is still
  // reachable from it, and the router grew no branch the register does not
  // name. The rule, its hand-maintained register, the three arms and the
  // fenced-block exclusion that keeps an in-command path argument from reading
  // as a branch live in lib/reference-routers.mjs; this side only decides that
  // it applies to the whole root.
  for (const issue of referenceRouterIssues(root)) problems.push(issue);

  // 14. every shipped seam is contracted. Check 2 skips any script with no
  // CONTRACTS row (`if (!contract) continue`), which it must - prose names
  // third-party scripts too. The cost is that DELETING a row silently opts
  // that script out of the flag lint while self-verify stays ok:true, so the
  // table's own completeness cannot be checked from the prose side. It is
  // checked from the tree side instead: enumerate the top-level scripts and
  // require a row for each.
  //
  // TOP-LEVEL only, deliberately non-recursive: `lib/*.mjs` are modules that
  // prose never invokes, so a contract for them would describe nothing. This
  // is the same subject as check 12 but a different set, which is why it does
  // not reuse binFiles - that walker descends into lib/.
  const binDir = join(root, 'cadence-core', 'bin');
  let binList = null;
  try {
    binList = readdirSync(binDir, { withFileTypes: true });
  } catch (e) {
    // An ABSENT bin directory is a partial fixture, not a fault - the same
    // call this check makes on a synthetic root that only carries prose. A
    // directory that exists and cannot be READ is a fault, and reporting it
    // is what stops an unreadable bin from vacuously satisfying the check.
    if (e && e.code !== 'ENOENT') {
      problems.push({ kind: 'unreadable-surface', file: relative(root, binDir),
        detail: e.code || String(e) });
    }
  }
  for (const d of binList || []) {
    if (d.isDirectory()) continue;
    if (!d.name.endsWith('.mjs') || d.name.endsWith('.test.mjs')) continue;
    if (!CONTRACTS[d.name]) {
      problems.push({ kind: 'uncontracted-script',
        file: relative(root, join(binDir, d.name)), detail: d.name });
    }
  }

  // 15. no literal U+0000 in any file under cadence-core/bin. A NUL makes GNU
  // `grep -rn` treat the whole file as binary and print NOTHING for it without
  // `-a`, and `rg` skip it silently - two NULs inside one template literal in
  // lib/trace.mjs cost a debugging detour before anyone noticed the file was
  // absent from every search. `git grep` does NOT catch it (its binary
  // heuristic inspects only the head of the blob), so this is the check.
  //
  // The walk is `{ every: true }`: extension-blind and exclusion-free, because
  // `grep` does not care that a file is a test or a JSON data file. Scoped to
  // cadence-core/bin and nothing wider - .planning/_archive-v2.5.0/1/PLAN-2.md
  // carries the same two bytes inside an immutable phase record, and a
  // tree-wide guard would land red on a record no one may rewrite.
  for (const { file, unreadable } of binFiles(root, { every: true })) {
    const rel = relative(root, file);
    if (unreadable) {
      problems.push({ kind: 'unreadable-surface', file: rel, detail: unreadable });
      continue;
    }
    let buf = null;
    try {
      buf = readFileSync(file);
    } catch (e) {
      problems.push({ kind: 'unreadable-surface', file: rel,
        detail: e && e.code ? e.code : String(e) });
      continue;
    }
    const at = buf.indexOf(0);
    if (at < 0) continue;
    let count = 0;
    for (let i = at; i < buf.length; i++) if (buf[i] === 0) count++;
    problems.push({ kind: 'nul-byte-in-source', file: rel,
      detail: `literal U+0000 at byte offset ${at} (${count} in file) - type \\0 instead` });
  }

  // 16. include consumers: an `@`-included references/* or templates/* surface
  // must be NAMED in the including command's own eager prose. The rule, the
  // `workflows/*` branch exemption, the two scan-text exclusions that stop an
  // include naming itself, and the waiver register - which ships EMPTY, with
  // both of its bounds still wired - live in lib/include-consumers.mjs; this
  // side only decides that it applies to the whole root.
  for (const issue of includeConsumerIssues(root)) problems.push(issue);

  // 22. refusal hints: a refusal a user can READ must name the next step. The
  // population is the EMITTING call - `emit`, `out` or `fail` with an `ok:false`
  // envelope - never a field named `reason`; the balanced-span scan that
  // classifies those calls, the exclusion register and the one-line reason on
  // every row of it live in lib/refusal-hints.mjs, and this side only decides
  // that it applies to the whole root.
  for (const issue of refusalHintIssues(root)) problems.push(issue);

  // 25. hook events: every event name `hooks/hooks.json` registers has a
  // register row. The register, the full-tree leniency and the one-issue
  // handling of an unreadable or malformed file live in lib/hook-events.mjs,
  // and this side only decides that it applies to the whole root.
  for (const issue of hookEventIssues(root)) problems.push(issue);

  return problems;
}

// --- entry ---------------------------------------------------------------------

// This file's own refusal vocabulary for an unusable flag value, which is
// lib/seam-input.mjs's word (D-07: the contract mints none of its own - the
// evaluator classifies and the CALLER names the refusal). Held as a const
// rather than written inline at the throw because helper-census.test.mjs pins
// that literal throw body to lib/seam-input.mjs, and a second spelling of it
// here is exactly the copy the census exists to redden.
const MISSING_FLAG_VALUE = 'missing-flag-value';

try {
  const argv = process.argv.slice(2);
  // The tracer bullet for the whole contract: declaration -> evaluator -> CLI
  // refusal -> envelope, and the first adopter is the file the table just left.
  // The THROWING mechanism stays (D-08) because the catch arm below is already
  // written for it; a genuinely ABSENT `--root` still resolves to the plugin's
  // own tree, while the empty, valueless and flag-shaped spellings refuse -
  // each of them used to return ok:true with problems:[] about a tree the
  // caller never named.
  const rooted = evaluateFlag(argv, '--root', CONTRACTS['self-verify.mjs']['*']['--root']);
  if (!rooted.ok) throw { seam: MISSING_FLAG_VALUE, detail: rooted.detail };
  const root = rooted.value || join(HERE, '..', '..');
  const problems = run(root);
  emit({ ok: problems.length === 0, checked: 'config-keys, invocations, paths, internals-paths, budgets, tools, agent-skills, agent-behaviour, rung-effort, rung-prefix, verifier-write-grant, routing-cells, effort-enums, config-reach, dispatch-phrasing, route-relay, merge-warnings, deferred-reads, reference-routers, script-contracts, nul-bytes, include-consumers, global-only-key-scope, gate-agreement, text-transport, bulk-output, scratch-path, refusal-hints, capture-writers, hook-events', problems });
} catch (e) {
  // The seam arm lands WITH the throw above: a thrown seam object carries no
  // `message`, so without it the refusal emits detail "[object Object]".
  if (e && e.seam) emit({ ok: false, reason: e.seam, detail: e.detail,
    hint: 'the detail names the flag that refused - give it a value of the kind that flag takes and re-run the command' });
  else emit({ ok: false, reason: 'internal', detail: e && e.message ? e.message : String(e) });
}
