#!/usr/bin/env node
// @ts-check
// self-verify.mjs - the prose<->code drift linter, run in CI. The 2026-07-16
// sweep found that nearly every defect in this repo was prose describing a
// flag, key, or path the code did not have; this script makes that whole
// class mechanical. Checks run over the LIVE prose surfaces (workflows,
// references, skills, agents, templates, plus README and INTERNALS -
// deliberately not the historical docs DESIGN/LINEAGE/CHANGELOG, which may
// name cut keys while explaining the cut):
//
//   1. config keys   every dotted config token in prose must exist in
//                    config.schema.json (placeholders <t>/<name> expanded),
//                    and every schema key must be referenced somewhere -
//                    an unreferenced key is inert and gets pruned, not kept.
//   2. invocations   every `<script>.mjs <subcommand> --flag` in prose must
//                    match the real subcommand/flag contract table below.
//                    The table is maintained here, beside the checks; the
//                    scripts' own tests keep the table honest.
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
//   8. routing cells the three grids in route-table.json, cell by cell (every
//                    problem NAMES the cell), the shared vocabulary arrays
//                    against the schema's own enums,
//                    plus both directions between the grids and agents/: every
//                    rung a cell names must have an agent file, and every
//                    rung-suffixed agent file must be a rung some cell reaches. route.mjs returns an agent name it
//                    never checks exists, so an unbuilt or stale rung would
//                    surface as a failed spawn instead of in CI.
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
//      contracts     row in the CONTRACTS table below. Check 2 SKIPS a script
//                    it finds no row for - it has to, since prose names
//                    third-party scripts too - so deleting a row was a silent
//                    opt-out of the flag lint rather than a problem, and the
//                    table's completeness could not be checked from the prose
//                    side at all. It is checked from the tree side here.
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
  rungBodyIssue, rungEffortIssue, rungFile, effortEnumIssues,
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
import { includeConsumerIssues } from './lib/include-consumers.mjs';
import { textTransportIssues } from './lib/text-transport.mjs';
// The throwing `--root` reader, shared with weight.mjs: ABSENT and
// PRESENT-WITH-NO-VALUE are different inputs, and a `--root` with nothing after
// it used to fall back to the plugin's own tree so this linter returned ok:true
// with problems:[] about a tree it never checked. The entry-point catch arm at
// the foot of this file is what turns its thrown seam object into a named
// refusal. Contract in lib/seam-input.mjs.
import { flagValue } from './lib/seam-input.mjs';

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

// --- the contract table: script -> subcommand -> allowed flags --------------
// Global flags allowed everywhere on that script are listed under '*'.
//
// The '' key is the BARE form - the script invoked with flags and no
// subcommand, e.g. `weight.mjs --root <path>`. Without it check 2 reads the
// first flag AS the subcommand and reports `unknown-subcommand` on correct
// prose, so every script with a no-subcommand form must declare one.
//
// Every top-level script under cadence-core/bin must appear here: check 14
// enforces it, because check 2 skips a script it finds no row for. A missing
// row is therefore a silent opt-out of the flag lint, not a script that
// happens to be unlinted - which is exactly how `weight.mjs`'s own row could
// be deleted with self-verify still returning ok:true.
const CONTRACTS = {
  'planning.mjs': {
    '*': ['--dir'],
    status: [],
    'cursor get': [],
    // `--next-file` is `--next`'s path transport, for the two sites that COMPOSE
    // a resume pointer (/cad-pause, `progress`) rather than authoring a literal
    // `/cad-<command> N`. The seven literal sites keep the inline form.
    'cursor set': ['--phase', '--status', '--next', '--next-file', '--name', '--total'],
    'phase-done': ['--n', '--reqs', '--undo'],
    'uat init': ['--phase', '--sources'],
    'uat refresh': ['--phase'],
    // `--fields-file` is the path transport for the five FREE-TEXT fields
    // (`reason`, `reported`, `cause`, `fix`, `evidence`) as ONE JSON object -
    // one file per failing item rather than three, on the workflow whose
    // per-item round-trip discipline is explicit. The enum-validated flags gain
    // no file form: a value that must survive `UAT_RESULTS.includes()` or an
    // `AC<N>` test is not caller-derived prose.
    'uat record': ['--phase', '--item', '--result', '--reason', '--reported',
      '--severity', '--cause', '--fix', '--evidence', '--fields-file', '--source',
      '--origin', '--criterion'],
    'uat merge': ['--phase', '--payload'],
    'uat status': ['--phase'],
    audit: [],
    'criteria-coverage': [],
    // The criteria-count ceilings, as the CALLER's literal numbers. Four bounds
    // rather than two because the two grammars have different ones - CONTEXT's
    // acceptance criteria 3-7, ROADMAP's per-phase criteria 2-5 - and folding
    // them onto one pair would make a workflow state a bound it does not hold.
    // No config keys: D-04, the rule `plan-size`'s row above already follows.
    'criteria-size': ['--phase', '--context-min', '--context-max',
      '--roadmap-min', '--roadmap-max'],
    'plan-overlap': ['--phase'],
    'plan-size': ['--phase', '--max-reqs', '--max-tasks'],
    // `--label-file` is `--label`'s path transport: an untagged close takes the
    // label from PROJECT.md's milestone NAME, which is repository content. The
    // table term (`|` or a newline) and the containment term run on the
    // resolved value either way - the transport changes how it arrives, never
    // what it must satisfy.
    'milestone-prune': ['--label', '--label-file', '--mode'],
    'seed-reqs': ['--phase'],
    'lease-check': ['--phase', '--plan'],
    'detect-commands': ['--root'],
    'detect-surfaces': ['--root'],
    recall: ['--top'],
    // `--join` ties each record to the `trace.jsonl` dispatch bracket that
    // caused it, by role normalization and timestamp containment. Off by
    // default so the envelope every existing reader parses is unchanged, and
    // whole-record by construction: `reads.jsonl` carries no phase scoping, so
    // the brackets it joins to must span every phase.
    reads: ['--join'],
    // `--read` is ONE comma-separated value, never a repeated flag (parseArgs
    // keeps only the last). Its grammar is deliberately heterogeneous: an
    // element is any verbatim string naming something the site caused the
    // worker to read - a path, a glob, or a non-path reference (a
    // `<base>..<head>` ref range) the worker resolves for itself.
    // `--step` names the workflow step a COORDINATOR marker marks. It rides the
    // same event-agnostic seam as every other flag here; what keeps it off a
    // worker bracket is the prose and the census, not this table.
    // `--raised` is the ADJUDICATED arm's kill count - how many findings the
    // reviewers raised before adjudication, structured so a 0-of-0 fire and a
    // 0-of-9 one stop reading alike. It lives here rather than in `--detail`
    // because this row is what makes the flag the only structured route.
    // `--reviewer` names the reviewer that ACTUALLY ran a fire (RVW-02), so two
    // fires of one trigger - one cross-model, one subagent - are distinguishable
    // in the record. Nothing refuses a dispatch to a reviewer outside the
    // resolved set, so this mark is the whole enforcement.
    // The detection the blocking `risk_surface` gate fires on, and the record
    // that proves it ran. `--base` and `--head` are both REQUIRED - a defaulted
    // head is a range the caller never stated - and `--surfaces` narrows the
    // scope to the project's resolved set, refusing any token outside the
    // eight rather than answering about a narrower one.
    'risk-check run': ['--phase', '--plan', '--base', '--head', '--surfaces'],
    // The completion gate. `--phase` alone keeps plan-level matching; the
    // optional `--plan --base --head` triple requires a record for THAT range,
    // so a record left by an earlier, narrower range of the same plan does not
    // satisfy a later one.
    'risk-check status': ['--phase', '--plan', '--base', '--head'],
    // `--detail-file` is `--detail`'s path transport, for a detail the CALLER
    // derived: the inline form puts that text in a double-quoted shell word,
    // where `$(...)` and a backtick execute before Node starts. Additive - the
    // inline form stays for a human typing at a shell (lib/text-flag-file.mjs).
    // `--read-file` is `--read`'s path transport, split by the same comma
    // grammar. It is NOT on the close row below: `--read` is not either, and
    // the transport never widens what a subcommand accepts.
    'trace append': ['--phase', '--family', '--event', '--plan', '--sha', '--detail',
      '--detail-file', '--role', '--tokens', '--raised', '--read', '--read-file',
      '--step', '--reviewer'],
    // The CLOSE half of a worker bracket. No `--family` and no `--event`: the
    // family is fixed to `lifecycle` in the seam and the arm is inferred from
    // `--detail` (present -> `checkpoint`, absent -> `return`), so a close site
    // states what it closes and nothing about how the record spells it. A row
    // that listed them would let the restated spelling back in through the lint.
    // The inference reads the RESOLVED detail, so `--detail-file` selects the
    // checkpoint arm exactly as the inline form does.
    'trace close': ['--phase', '--plan', '--role', '--tokens', '--detail',
      '--detail-file', '--reviewer'],
    // `--events` asks for the RAW event array. The default response carries the
    // paired `brackets` rows plus every `outcome` event instead, which is what
    // the two shipped readers (triage-gate's `rearm` lookup, report.md's
    // dispatch table) actually consume - and one to three of the bytes.
    'trace render': ['--phase', '--events'],
    'trace suggest': ['--phase'],
    'trace ignore': ['--root', '--check'],
    // `--file` overrides `<dir>/CAPTURE.md`, for `/cad-capture --cadence`'s
    // global queue alone - there is no `--section`, and that absence is the
    // point: a caller that could name a heading is how five filed bullets
    // landed outside the recall walk.
    capture: ['--kind', '--text', '--text-file', '--phase', '--file'],
    // The read side of the same file, and the same `--file` override. No
    // `--section` and no allowlist flag either: the census is unconditional
    // (D-06), and a flag that could hide a section is what would have hidden
    // the five lost bullets.
    'capture-sections': ['--file'],
    'debt-harvest': ['--root'],
    'renumber insert': ['--at', '--dry-run'],
    'renumber remove': ['--n', '--dry-run'],
  },
  'config.mjs': {
    '*': [],
    validate: ['--file', '--global'],
    check: [],
    set: ['--file', '--global'],
    get: ['--file'],
    keys: [],
  },
  'git-branch.mjs': {
    '*': ['--dir'],
    decide: ['--branch'],
  },
  'git-publish.mjs': {
    '*': ['--dir'],
    publish: ['--remote'],
    reap: ['--branch'],
    authorized: [],
  },
  'land-cleanup.mjs': {
    '*': ['--dir'],
    cleanup: ['--branch', '--base', '--merged'],
    gate: [],
  },
  'issue-check.mjs': {
    '*': ['--dir'],
    check: ['--base', '--timeout-ms'],
  },
  'release-bump.mjs': {
    '*': ['--dir'],
    bump: ['--version', '--date'],
  },
  'route.mjs': {
    '*': [],
    resolve: ['--role', '--attempt', '--file', '--phase', '--bracket-read', '--bracket-plan'],
    table: [],
  },
  'worktree-base.mjs': {
    '*': ['--dir'],
    resolve: [],
  },
  'review-provider.mjs': {
    '*': ['--key-file'],
    // `--trigger` names the review trigger the call was fired for; it rides the
    // provider trace event so a cross-model fire JOINS to its trigger through
    // the correlation id, which is what makes it distinguishable from the
    // subagent fire of the same trigger (RVW-02). Optional and review-only: a
    // consult has no trigger.
    review: ['--provider', '--model', '--effort', '--payload', '--trigger'],
    consult: ['--provider', '--model', '--effort', '--payload'],
    'detect-models': ['--provider'],
  },
  'weight.mjs': {
    '*': ['--root'],
    '': [],
    resident: ['--command', '--role'],
  },
  // Two scripts with no subcommand at all. They carry rows because check 14
  // requires one, and the rows have teeth: the bare form's flag list is what
  // check 2 lints `self-verify.mjs --root <path>` against.
  'self-verify.mjs': {
    '*': ['--root'],
    '': [],
  },
  // git-guard.mjs is the commit hook - it reads its input on stdin and takes
  // no flags, so the bare form allows none.
  'git-guard.mjs': {
    '*': [],
    '': [],
  },

  // read-trace.mjs is the PostToolUse recorder - like git-guard.mjs it reads
  // its input on stdin and takes no flags and no subcommand at all.
  'read-trace.mjs': {
    '*': [],
    '': [],
  },
  // skim.mjs takes a FILE as its positional argument, never a subcommand, so
  // the bare row carries the whole flag set.
  'skim.mjs': {
    '*': [],
    '': ['--stats', '--no-numbers'],
  },
  // test.mjs takes GROUP NAMES as positional arguments, never subcommands, so
  // the bare form is the only form and `--list` is its one flag.
  'test.mjs': {
    '*': ['--list'],
    '': ['--list'],
  },
};

// Subcommands whose first word takes a second word (sub-subcommand).
const TWO_WORD = new Set(['cursor', 'uat', 'renumber', 'trace', 'risk-check']);

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
  // they are live surfaces too. Historical docs (DESIGN/LINEAGE/CHANGELOG) stay
  // out: they legitimately name keys that were later cut, while explaining the cut.
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
      const sub = bare ? '' : (TWO_WORD.has(w1) && w2 ? `${w1} ${w2}` : w1);
      if (!contract[sub]) {
        problems.push({ kind: 'unknown-subcommand', file: rel,
          detail: `${script} ${bare ? '(bare form)' : sub}` });
        continue;
      }
      const allowed = new Set([...contract[sub], ...contract['*']]);
      // The bare form's own first word IS a flag, so it must be scanned; the
      // subcommand forms consume w1 as the name and scan from w2 on.
      const rest = bare
        ? ` ${w1} ${w2 || ''}${restRaw}`
        : (TWO_WORD.has(w1) && w2 ? '' : ` ${w2 || ''}`) + restRaw;
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
          const effortLine = fm[1].match(/^effort:[ \t]*(\S+)[ \t]*$/m);
          const issue = rungBodyIssue(body, effortLine ? effortLine[1] : undefined,
            parseSkillsField(fm[1]));
          if (issue) {
            problems.push({ kind: 'agent-carries-behaviour', file: rel,
              detail: `${issue.detail} - the contract belongs in the preloaded skill` });
          }
        }
      }

      // 7b. a rung file carries the effort the rung map filed it under.
      // Runs on the frontmatter of EVERY agent file, not only the ones
      // preloading a contract, because the map may name any of them. Check 7
      // above holds the body against this same field and check 8 below reads
      // the rung out of the filename, so without this the one link that
      // decides how deep the dispatch actually thinks goes unchecked.
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
      // disk -> table, which "exactly the files the grids name" needs and the
      // walk above does not give. Matched ONLY on the rung-suffixed shape: a
      // blanket "not named by the table" rule would outlaw the one-off agent
      // with inline prose D-04 deliberately keeps legal. Without this
      // direction, a stale rung file - one no cell reaches - stays green while
      // still paying standing context in every main-session prompt.
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
          if (order.includes(rung)) {
            // Two faults reach here and want opposite fixes. A file the rung
            // map names is a cell that went missing (add the cell); a file it
            // does not name is a stale rung file (delete it).
            const mapped = rungFile(role, rung) === stem;
            problems.push({ kind: 'undeclared-rung-agent', file: `agents/${stem}.md`,
              detail: mapped
                ? `${rung} is ${role}'s rung in lib/rung-agent.mjs, but no cell at any level resolves to it`
                : `no cell names ${role} at rung ${rung}, and lib/rung-agent.mjs maps no file to it` });
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

  return problems;
}

// --- entry ---------------------------------------------------------------------

try {
  const argv = process.argv.slice(2);
  const root = flagValue(argv, '--root') || join(HERE, '..', '..');
  const problems = run(root);
  emit({ ok: problems.length === 0, checked: 'config-keys, invocations, paths, internals-paths, budgets, tools, agent-skills, agent-behaviour, rung-effort, verifier-write-grant, routing-cells, effort-enums, config-reach, dispatch-phrasing, route-relay, merge-warnings, deferred-reads, script-contracts, nul-bytes, include-consumers, global-only-key-scope, gate-agreement, text-transport', problems });
} catch (e) {
  // The seam arm lands WITH flagValue: a thrown seam object carries no
  // `message`, so without it the refusal emits detail "[object Object]".
  if (e && e.seam) emit({ ok: false, reason: e.seam, detail: e.detail });
  else emit({ ok: false, reason: 'internal', detail: e && e.message ? e.message : String(e) });
}
