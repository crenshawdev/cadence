#!/usr/bin/env node
// @ts-check
// planning.mjs - the .planning state-machine seam. Deterministic reads and
// writes of the planning file set, so workflow prose keeps judgment and this
// script keeps invariants. The JSON shapes asserted in planning.test.mjs ARE
// the interface contract; there is no spec file beyond them.
//
// Seam contract (shared with route/config/review-provider):
//   - exactly ONE JSON object on stdout; {ok:true,...} exit 0,
//     {ok:false, reason, detail?, hint?} exit 1 (hint = recovery command).
//   - never blocks the spine: every parse problem degrades to ok:false.
//   - --dir <path> overrides the default `.planning` (hermetic-test hook).
//   - output is deterministic (phases sorted, fixed key order) and compact
//     (empty arrays / absent optionals are omitted). Fields are additive-only.
//
// Subcommands (this file grows by dispatch-table entry, never by if-chain):
//   status                          derived phase states + cursor + drift
//   cursor get                      parse the STATE.md 4-line cursor
//   cursor set --phase N --status s --next cmd [--name s] [--total N]
//                                   canonical overwrite; derives name/total
//                                   from ROADMAP when omitted; stamps today
//   plan-overlap --phase N          pairwise intersection of the phase's
//                                   plans' declared file lists (parallel gate)
//   seed-reqs --phase N             insert Traceability rows for a phase's
//                                   plan-declared, ## Active-bounded req ids
//   criteria-coverage               every CONTEXT `## Acceptance criteria` id
//                                   against its phase's UAT items, both
//                                   directions; uncovered and
//                                   fieldless-checklist break, untraced and
//                                   legacy {phase, reason} report
//                                   (references/acceptance-criteria.md)
//   criteria-size [--phase N] [--context-min N] [--context-max N]
//                 [--roadmap-min N] [--roadmap-max N]
//                                   the criteria-count ceilings three workflows
//                                   state in prose, counted: CONTEXT's
//                                   `## Acceptance criteria` and ROADMAP's
//                                   per-phase criteria list, each against the
//                                   CALLER's literal bounds (no config keys).
//                                   --phase scopes to one; absent walks every
//                                   phase the roadmap declares. A source that
//                                   declared nothing reports *_found:false and
//                                   is never compared, so `within` is null
//                                   when nothing was compared at all
//   recall "<query>"                BM25 over .planning artifacts (SUMMARY/
//                                   CAPTURE/UAT/CONTEXT); memory.backend-gated.
//                                   Bare words after `recall` are joined into
//                                   one query, so an unquoted multi-word call
//                                   searches all of it, not just the first word
//   lease-check --phase N --plan k  every staged path against that plan's own
//                                   declared files: list (the executor's
//                                   commit-step gate)
//   detect-commands [--root <path>]  the project's own lint/typecheck commands,
//                                   read from its manifests AND offered only
//                                   when their binaries resolve - an
//                                   unreachable arm is null with the tool named
//                                   in warnings[], never a fall-through to a
//                                   lower one (NOT --dir: --root is the
//                                   PROJECT root, one level deep only)
//   detect-surfaces [--root <path>]  which of the eight risk-surface categories
//                                   the project's STRUCTURE evidences - dirs,
//                                   manifests, file types, never source text
//                                   (NOT --dir: --root is the PROJECT root,
//                                   two levels deep)
//   risk-check run --phase N --base <ref> --head <ref> [--plan k]
//                  [--surfaces <a,b,c>]
//                                   whether a COMMITTED range touched a risk
//                                   surface, recorded on the trace whatever the
//                                   answer - so "the check was skipped" stops
//                                   reading like "it ran and matched nothing".
//                                   --plan is the WORKER key, not a plan
//                                   number: `1-fix` is a key a dispatch is
//                                   bracketed under and is recorded verbatim
//   risk-check status --phase N [--plan k --base <ref> --head <ref>]
//                                   every COMPLETED executor range in that
//                                   phase against the records, refusing by plan
//                                   when one carries none; the optional triple
//                                   requires a record for THAT range, so an
//                                   earlier narrower one does not satisfy it.
//                                   --plan is the same WORKER key `run` takes,
//                                   read through the same grammar; a bracketed
//                                   key that grammar refuses is reported in
//                                   malformed[] rather than demanded in
//                                   missing[], since no run could record it
//   trace append --phase N --family <f> --event <e> [--plan k] [--base b] [--sha s]
//               [--detail "<text>"] [--role <name>] [--tokens <n>]
//               [--read "<a,b,c>"] [--step <name>]
//                                   one line onto .planning/trace.jsonl.
//                                   --role groups the per-role totals (--plan
//                                   stays the pairing key), --tokens is what
//                                   the dispatch cost as a non-negative
//                                   integer, --read is ONE comma-separated
//                                   read-set stored verbatim, --step is the
//                                   workflow step a coordinator marker names
//   trace close --phase N [--plan k] [--role <name>] [--tokens <n>]
//               [--detail "<text>"] [--reviewer <name>]
//                                   the CLOSE half of a worker bracket, in one
//                                   subcommand rather than two restated
//                                   `trace append` spellings per dispatch site.
//                                   --family is fixed to lifecycle and the arm
//                                   is inferred from --detail: present means
//                                   `checkpoint` (the worker came back empty,
//                                   unmarked or unusable), absent means
//                                   `return`. `escalation` is NOT inferred and
//                                   stays reachable through `trace append`
//   trace render [--phase N] [--events]
//                                   the four families, the derived id, every
//                                   worker dispatch paired to its
//                                   return/checkpoint/escalation, the per-role
//                                   dispatch/token totals, and - where markers
//                                   were written - the coordinator's own
//                                   per-step residue between those brackets,
//                                   scoped per RUN by `corr` so no window spans
//                                   two runs that share a phase number.
//                                   By default the response carries the paired
//                                   `brackets` rows and every `outcome` event
//                                   in place of the raw event array; --events
//                                   asks for that array instead
//   debt-harvest [--root <path>]    every CADENCE-DEBT marker in the tracked
//                                   tree, collected into .planning/CAPTURE.md's
//                                   own `## Debt markers` section (NOT --dir:
//                                   it scans source and writes into .planning)
//   milestone-prune --label <l> --mode <delete|archive>
//                                   the mechanical half of a milestone close:
//                                   checked phases leave ROADMAP (line +
//                                   detail section), their dirs delete
//                                   (tagged release) or move to
//                                   _archive-<label>/ (untagged), and their
//                                   requirements move from Active/Traceability
//                                   into ## Shipped rows carrying the label
//   trace window [--phase N]        every paired bracket's terminal `tokens`
//                                   figure against its role's
//                                   workflow.max_dispatch_tokens ceiling, as
//                                   budget-overrun problems. A REPORT about a
//                                   run that already finished - nothing on the
//                                   dispatch path reads a ceiling - plus the
//                                   rows it could not compare: roles with no
//                                   ceiling, and terminals that carried no
//                                   figure
//   trace ignore [--root <path>] [--check]
//                                   keep .planning/trace.jsonl out of git:
//                                   append-if-absent at scaffold time, or
//                                   REPORT ONLY under --check (NOT --dir:
//                                   --root is the PROJECT root, where
//                                   .gitignore lives)
'use strict';

import { readFileSync, readdirSync, existsSync, lstatSync } from 'node:fs';
import { join, dirname, isAbsolute, relative, resolve as resolvePath, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { renameSync, rmSync, mkdirSync } from 'node:fs';
import { pruneRoadmap, archiveRequirements, completedPhases } from './lib/milestone-prune.mjs';
import {
  CURSOR_STATUSES, parseCursor, renderCursor, parseRoadmapPhases,
  classifyPhaseList, CLOSED_CYCLE_NAME,
  parseRequirements, parseUat, renderUat, uatComplete, atomicWrite,
  setPhaseBox, setReqStatus, parsePlanRequirements, parsePlanFiles,
  shiftPhaseTokens, findProsePhaseRefs, cutPhaseDetail,
  parseSummarySnippets, parseCaptureSnippets, parseContextDecisions,
  parseActiveIds, classifyActiveSection, isRequirementId, insertReqRows,
  classifyAcceptanceCriteria, UAT_ORIGINS, UAT_SOURCES, UAT_FIELDS_VERSION,
  sectionBound, phaseRequirements, phaseCriteria, planTaskTitles,
  captureSections, CAPTURE_WALK_SECTIONS,
  parseArchiveRows, appendArchiveRows,
} from './lib/planning-files.mjs';
import { debtMarkersIn, renderDebtSection } from './lib/debt-markers.mjs';
import {
  appendCapture, replaceSection, withPlanningFileLock, CAPTURE_KINDS, EMPTY_CAPTURE,
} from './lib/capture-file.mjs';
import { mergeLayers, isPlainObject } from './lib/config-merge.mjs';
// The audit's version_drift signal (FRI-03) reuses the readers that already
// exist rather than growing second ones: the SAME prose version reader branch
// naming uses (`### Active` -> ROADMAP title), the SAME membership test, and the
// SAME tag reader the branch seam reads. `normalizeTargetVersion` is imported
// for its `v`-stripping alone - the version compared here is REPORTED, never
// derived into anything that ships (REL-03 stands).
import { activeVersion, titleVersion, tagCarrying } from './lib/branch-decision.mjs';
import { normalizeTargetVersion } from './lib/release-decision.mjs';
import { readTags } from './lib/git-tags.mjs';
import { appendEvent, renderTrace, FAMILIES } from './lib/trace.mjs';
import { READS_FILE, summarizeReads, joinReads } from './lib/read-trace.mjs';
import { suggestFromRender, parseAdjudication } from './lib/trace-suggest.mjs';
import { windowBudget } from './lib/window-budget.mjs';
import { buildIndex, search } from './lib/bm25.mjs';
import { emit } from './lib/seam-io.mjs';
import { requireCursorNumber, requireInt, requirePhaseArg } from './lib/require-int.mjs';
import { resolveTextFlag } from './lib/text-flag-file.mjs';
import { redactUrl } from './lib/redact-url.mjs';
import { covers, intersects } from './lib/lease-grammar.mjs';
import { testSeamOpen } from './lib/test-seam.mjs';
import { onPath, executableIn } from './lib/on-path.mjs';
import { requirePlanKey } from './lib/plan-key.mjs';
import { scanTree, CATEGORIES, answeredSurfaces } from './lib/surface-scan.mjs';
import { scanDiff } from './lib/risk-diff.mjs';
import { buildEntries, deriveCounts } from './lib/adjudication-record.mjs';
import { evaluateFlag, evaluateRow, subcommandKey, CONTRACTS } from './lib/arg-contract.mjs';

// The raw argument list, kept beside the envelope helpers because the flags
// that read through lib/arg-contract.mjs need the SPELLING and not parseArgs'
// digest of it: parseArgs mints the boolean `true` for a bare flag, so by the
// time a value reaches `opts` the three spellings a declared row separates -
// bare, empty and flag-shaped - have already collapsed into one.
const ARGV = process.argv.slice(2);

const ok = (o) => emit({ ok: true, ...o });
const fail = (reason, detail, hint) =>
  emit({ ok: false, reason, ...(detail ? { detail } : {}), ...(hint ? { hint } : {}) });

/** Read a file or return null - absence is data here, never a crash. */
function read(file) {
  try { return readFileSync(file, 'utf8'); } catch { return null; }
}

/**
 * The `--phase` spellings the two WRITE faces cannot honour, as a refusal
 * detail - or null when the spelling is one they can.
 *
 * `requirePhaseArg` deliberately returns the caller's OWN spelling beside the
 * numeric value, and most reads in this file address `phases/<raw>/` with it.
 * `cursor set` and `seed-reqs` cannot: both WRITE the numeric half - the
 * cursor's `Phase:` line, and a Traceability cell that `parseRequirements` and
 * `audit` compare against ROADMAP phase NUMBERS. So on a tree holding both
 * `phases/1.1/` and `phases/1.10/`, `--phase 1.10` wrote `Phase: 1.1 of 2
 * (One)` and `| BBB-01 | Phase 1.1 | Pending |` - the OTHER phase's name and
 * the other phase's row, silently, with ok:true (measured 2026-08-18).
 *
 * The rule is the round trip `String(value) === raw`, the same predicate the
 * CAPTURE.md and ARCHIVE.md phase readers carry (D-07), so `1.10`, `1.0` and
 * `01` are refused while `2`, `2.1` and `10` pass. STATED COST: neither face
 * can name a `phases/1.10/` directory any more, a capability
 * `lib/require-int.mjs` deliberately built. The detail carries BOTH spellings
 * because the caller's fix is exactly one of two things - retype the flag, or
 * rename the directory - and nothing else in the envelope says which.
 * @param {{raw: string, value: number}} parsed a `requirePhaseArg` success
 * @returns {string|null}
 */
function phaseSpellingRefusal(parsed) {
  const canonical = String(parsed.value);
  if (canonical === parsed.raw) return null;
  return `--phase "${parsed.raw}" is written here as phase ${canonical}, a different phase`
    + ` - send --phase "${canonical}", or rename phases/${parsed.raw}/ to phases/${canonical}/`;
}

const HERE = dirname(fileURLToPath(import.meta.url));
// The one path this script resolves outside `--dir`. Read relative to the
// SCRIPT, not the cwd, so it names the plugin actually executing - the whole
// point, given the skew this reports on. CADENCE_PLUGIN_MANIFEST overrides it
// ONLY when the `CADENCE_TEST_SEAM` sentinel holds (lib/test-seam.mjs); without
// it the variable is ignored and the shipped manifest is read, silently - this
// constant resolves at module load, before any dispatch exists to carry a
// warning. Same gate as CADENCE_CONFIG_SCHEMA and CADENCE_ROUTE_TABLE, and for
// the same reason: every version-skew answer is computed from this file, which
// is what QW-04 exists to keep honest.
const MANIFEST_PATH = (testSeamOpen() && process.env.CADENCE_PLUGIN_MANIFEST)
  || join(HERE, '..', '..', '.claude-plugin', 'plugin.json');

/**
 * The running plugin's version, or null when the manifest is unreadable,
 * malformed or version-less. Never throws: this is PROVENANCE, and a statement
 * about the run must not be able to sink the run it describes.
 * @returns {string|null}
 */
function pluginVersion() {
  try {
    const v = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')).version;
    return typeof v === 'string' ? v : null;
  } catch { return null; }
}

// ---------------------------------------------------------------------------
// Shared derivation: phase statuses from artifacts (the progress.md rules).
// no PLAN -> unplanned; PLAN w/o SUMMARY -> planned; SUMMARY w/o fully-passed
// UAT -> executed; SUMMARY + UAT complete -> complete.
// ---------------------------------------------------------------------------
function derivePhases(dir, roadmapPhases) {
  return roadmapPhases.map((p) => {
    const pdir = join(dir, 'phases', String(p.n));
    let plans = [];
    try {
      plans = readdirSync(pdir).filter((f) => /^PLAN(-\d+)?\.md$/.test(f)).sort();
    } catch { /* no dir -> unplanned */ }
    const summary = existsSync(join(pdir, 'SUMMARY.md'));
    const uatText = read(join(pdir, 'UAT.md'));
    const uat = uatText ? parseUat(uatText) : null;
    let status = 'unplanned';
    if (plans.length) status = 'planned';
    if (summary) status = (uat && uatComplete(uat)) ? 'complete' : 'executed';
    return { ...p, plans, status, uat };
  });
}

// THE phase-directory grammar (references/conventions.md): a bare phase integer
// or an `N.M` sub-phase, no zero-padding and no slug suffix. Checked here and
// resolved NOWHERE - D-01 is that Cadence states the grammar and reports what
// violates it, rather than teaching the seams to resolve `08-meteogram-legend`.
//
// Deliberately STRICTER than the two `phases/` LISTING filters (`:189` and the
// recall corpus walk), and it does not replace them: `/^\d+(\.\d+)?$/` there
// keeps a zero-padded directory out of the corpus and out of the
// surviving-dir report exactly as it does today (D-09). The leading `[1-9]` is
// what makes `08` a violation rather than a synonym for `8`.
const PHASE_DIR_NAME = /^[1-9]\d*(?:\.\d+)?$/;

/**
 * Every `phases/` entry outside `PHASE_DIR_NAME`, as one drift entry per
 * colliding group.
 *
 * ONE kind covers named, zero-padded and prefix-colliding entries (D-08). There
 * is deliberately no second "shadowing" diagnostic: every writer builds its path
 * as `join(dir, 'phases', <spelling>)`, which can never PRODUCE
 * `14-data-depth-x`, so a shadowing rule would report a hazard no code path
 * reaches. What is worth reporting instead is the collision the reader would
 * otherwise have to notice for themselves - `08` beside a legal `8` - so
 * entries sharing a leading numeric prefix are named together in one entry, and
 * the legal directory of that prefix is named in the detail.
 *
 * An absent `phases/` is data, never a throw. A stray FILE is not a phase
 * directory and is not reported: `.DS_Store` would only make the diagnostic
 * noise. Entries that are entirely legal produce NOTHING, so `drift` stays
 * absent on a clean tree and a legal name is never itself listed in `entries`.
 * @param {string} dir @returns {Array<{kind: string, entries: string[], detail: string}>}
 */
function phaseDirGrammarDrift(dir) {
  let listing = [];
  try { listing = readdirSync(join(dir, 'phases'), { withFileTypes: true }); }
  catch { return []; }
  /** @type {Map<string, {n: number|null, bad: string[], legal: string[]}>} */
  const groups = new Map();
  for (const ent of listing) {
    if (!ent.isDirectory() && !ent.isSymbolicLink()) continue;
    const lead = ent.name.match(/^\d+/);
    // The leading digit run READ AS A NUMBER, so `08`, `08-meteogram-legend` and
    // `8-foo` all group with a legal `8`. A name with no leading digits at all
    // collides with no phase and gets a group to itself.
    const n = lead ? Number(lead[0]) : null;
    const k = n === null ? `x:${ent.name}` : `n:${n}`;
    const g = groups.get(k) || { n, bad: [], legal: [] };
    (PHASE_DIR_NAME.test(ent.name) ? g.legal : g.bad).push(ent.name);
    groups.set(k, g);
  }
  const ordered = [...groups.values()].sort((a, b) => {
    if (a.n === null || b.n === null) return a.n === b.n ? 0 : (a.n === null ? 1 : -1);
    return a.n - b.n;
  });
  const out = [];
  for (const g of ordered) {
    if (!g.bad.length) continue;
    const entries = g.bad.slice().sort();
    const legal = g.legal.slice().sort();
    const verb = entries.length > 1 ? 'are not phase directory names' : 'is not a phase directory name';
    let detail = `${entries.join(', ')} ${verb}`
      + ' (bare integer or N.M, no zero-padding, no slug)';
    if (entries.length > 1 && g.n !== null) detail += `; they share numeric prefix ${g.n}`;
    if (legal.length) {
      detail += `; ${legal.map((e) => `phases/${e}`).join(', ')} is the phase they collide with`;
    }
    // NO `phase` key, the same reason `unpicked` omits one: there is no phase
    // number to report, and inventing one would make this indistinguishable from
    // the drift kinds that legitimately have one.
    out.push({ kind: 'phase-dir-grammar', entries, detail });
  }
  return out;
}

// Which cursor statuses are consistent with a derived phase status.
const AGREE = {
  unplanned: ['ready to plan', 'context gathered'],
  planned: ['planned'],
  executed: ['executed'],
};

// ---------------------------------------------------------------------------
// status
// ---------------------------------------------------------------------------
function cmdStatus(dir) {
  if (!existsSync(dir)) return fail('no-planning-dir', `${dir} not found`, '/cad-new-project');
  const roadmapText = read(join(dir, 'ROADMAP.md'));
  if (roadmapText === null) return fail('no-roadmap', `${join(dir, 'ROADMAP.md')} not found`, '/cad-new-project');
  // The phase-list grammar (references/roadmap-phases.md). An empty section is
  // a DERIVED closed milestone, not a parse failure; a phase-shaped line that
  // is not a canonical entry is reported per line with its own code.
  const classified = classifyPhaseList(roadmapText);
  if (classified.state === 'no-section') {
    return fail('unparseable-roadmap', 'no `## Phases` section in ROADMAP.md');
  }
  if (classified.state === 'out-of-grammar') {
    // Emitted directly rather than through fail(), which has no channel for
    // the issue list. The detail names the FIRST offending line, so the
    // diagnostic identifies what to fix instead of restating the grammar.
    const first = classified.issues[0];
    return emit({
      ok: false, reason: 'unparseable-roadmap',
      detail: `line ${first.line}: ${first.text}`,
      issues: classified.issues,
    });
  }
  const closed = classified.state === 'closed';
  const roadmap = classified.phases;

  const derived = derivePhases(dir, roadmap);
  const currentEntry = derived.find((p) => p.status !== 'complete') || null;
  const current = currentEntry ? currentEntry.n : null;

  const drift = [];
  for (const p of derived) {
    if (p.checked && p.status !== 'complete') {
      drift.push({ kind: 'roadmap-box', phase: p.n, detail: `box checked, derived ${p.status}` });
    } else if (!p.checked && p.status === 'complete') {
      drift.push({ kind: 'roadmap-box', phase: p.n, detail: 'derived complete, box unchecked' });
    }
  }

  // Interrupted-close corroboration: a closed milestone whose `phases/<N>/`
  // directories are still on disk. Kept OUT of the classifier on purpose - the
  // verdict is text-only and pure (D-05); this is the filesystem half, and it
  // reports the accurate PAIR (closed state AND drift) rather than letting one
  // orphan directory disprove the close.
  if (closed) {
    let entries = [];
    try { entries = readdirSync(join(dir, 'phases')); } catch { /* absence is data */ }
    const surviving = entries.filter((e) => /^\d+(\.\d+)?$/.test(e))
      .sort((a, b) => Number(a) - Number(b));
    for (const e of surviving) {
      const { plans } = listPlanFiles(join(dir, 'phases', e));
      drift.push({
        kind: 'phase-dir', phase: Number(e),
        detail: `phases/${e}/ survives the milestone close (${plans.length} plan files)`,
      });
    }
  }

  // The phase-directory grammar, checked in EVERY state and not only after a
  // close: a directory Cadence cannot address is wrong while the cycle is open,
  // which is when it can still be renamed cheaply.
  drift.push(...phaseDirGrammarDrift(dir));

  // Requirements drift (optional file; Deferred rows and unmapped rows are
  // audit's concern, not drift).
  const reqText = read(join(dir, 'REQUIREMENTS.md'));
  if (reqText !== null) {
    const byN = new Map(derived.map((p) => [p.n, p.status]));
    for (const r of parseRequirements(reqText)) {
      if (r.phase === null || r.status === 'Deferred' || !byN.has(r.phase)) continue;
      const phaseDone = byN.get(r.phase) === 'complete';
      if (phaseDone && r.status !== 'Complete') {
        drift.push({ kind: 'req-status', phase: r.phase, detail: `${r.id} still ${r.status}, phase derived complete` });
      } else if (!phaseDone && r.status === 'Complete') {
        drift.push({ kind: 'req-status', phase: r.phase, detail: `${r.id} Complete, phase derived ${byN.get(r.phase)}` });
      }
    }
  }

  // Cursor: a hint, compared against the derivation (derivation wins).
  const cursorText = read(join(dir, 'STATE.md'));
  const parsed = cursorText !== null ? parseCursor(cursorText) : null;
  let cursor;
  if (parsed) {
    let agrees;
    if (parsed.status === 'paused') agrees = true; // legal at any point
    // A closed milestone: `phase complete` and `ready to plan` both agree, so
    // `planned`/`executed`/`context gathered` stay drift - detection must NOT
    // die in the one state where the cursor is the only surviving evidence.
    // The phase NUMBER is not compared: a zero-phase roadmap gives it nothing
    // to agree with.
    else if (closed) agrees = parsed.status === 'phase complete' || parsed.status === 'ready to plan';
    else if (current === null) agrees = parsed.status === 'phase complete';
    else agrees = parsed.phase === current &&
      (AGREE[currentEntry.status] || []).includes(parsed.status);
    cursor = { phase: parsed.phase, status: parsed.status, next: parsed.next, updated: parsed.updated, agrees };
    if (!agrees) {
      drift.push({
        kind: 'cursor', phase: parsed.phase,
        detail: `cursor says phase ${parsed.phase} ${parsed.status}; derived ` +
          (closed ? 'closed milestone (no phases in ROADMAP)'
            : current === null ? 'all complete' : `phase ${current} ${currentEntry.status}`),
      });
    }
    // A stale `of <M>` against a zero-phase roadmap, reported INDEPENDENTLY of
    // `agrees` (which the mapping above governs alone - a `phase complete`
    // cursor still agrees). This is the case the phase-dir drift cannot see: a
    // tagged close deletes `phases/<N>/`, so when the prune commits and the
    // cursor rewrite never runs, the stale total is literally the only
    // surviving evidence.
    if (closed && parsed.total !== 0) {
      drift.push({
        kind: 'cursor', phase: parsed.phase,
        detail: `cursor totals ${parsed.total} phases; ROADMAP has none - ` +
          'milestone close did not finish (run cursor set)',
      });
    }
  }

  ok({
    current, total: derived.length,
    // Additive, and present ONLY in the closed state: a caller branching on
    // `current === null` alone would otherwise read a closed milestone as
    // "all phases complete" and route back to /cad-milestone.
    ...(closed ? { cycle: 'none' } : {}),
    phases: derived.map((p) => ({
      n: p.n, name: p.name, status: p.status,
      // plans listed only when they deviate from a single PLAN.md
      ...(p.plans.length > 1 || (p.plans.length === 1 && p.plans[0] !== 'PLAN.md')
        ? { plans: p.plans } : {}),
      ...(p.uat ? { uat: p.uat.counts } : {}),
    })),
    ...(cursor ? { cursor } : {}),
    ...(drift.length ? { drift } : {}),
  });
}

// ---------------------------------------------------------------------------
// cursor get / set
// ---------------------------------------------------------------------------
function cmdCursorGet(dir) {
  const text = read(join(dir, 'STATE.md'));
  if (text === null) return fail('no-cursor', `${join(dir, 'STATE.md')} not found`);
  const c = parseCursor(text);
  if (!c) return fail('unparseable-cursor', 'STATE.md does not match the 4-line schema');
  ok(c);
}

function cmdCursorSet(dir, opts) {
  if (!existsSync(dir)) return fail('no-planning-dir', `${dir} not found`, '/cad-new-project');
  if (!opts.phase) return fail('bad-args', 'cursor set needs --phase <N>');
  // The shared reader, for the refusal WORDING - and the cursor keeps holding
  // the numeric value on purpose. `parseCursor` returns a Number that
  // `renumber`'s shift arithmetic, `cmdStatus`'s `parsed.phase === current`
  // agreement test and `phase-plans.mjs`' `cursorPhase` all consume, so a
  // raw-spelled cursor is a wider change than the `--phase` directory fix, and
  // a half-raw cursor would be worse than a numeric one. What used to be the
  // stated cost of that - a cursor set at `--phase 1.10` rendering
  // `Phase: 1.1`, the OTHER phase's name - is REFUSED at the door now (D-07)
  // rather than carried. The raw spelling still addresses `phases/<raw>/` at
  // the reads in this file that are not these two write faces.
  const parsedPhase = requirePhaseArg(opts.phase);
  if (!parsedPhase.ok) {
    return fail('bad-args', 'cursor set --phase needs a non-negative phase number (N or N.M)');
  }
  const spelling = phaseSpellingRefusal(parsedPhase);
  if (spelling) return fail('bad-args', `cursor set ${spelling}`);
  const phase = parsedPhase.value;
  // `--next-file` is the path transport for a resume pointer the CALLER
  // composed - /cad-pause and `progress` build theirs from what the run was
  // doing, which is agent-derived text in a double-quoted shell word
  // (lib/text-flag-file.mjs, references/conventions.md). The seven sites that
  // pass a literal `/cad-<command> N` keep the inline form; nothing is deleted.
  const resolvedNext = resolveTextFlag(opts, 'next', 'cursor set');
  if (!resolvedNext.ok) return fail('bad-args', resolvedNext.detail);
  const next = resolvedNext.value !== undefined ? resolvedNext.value : opts.next;
  if (!opts.status || !next) return fail('bad-args', 'cursor set needs --status and --next');
  // ONE refusal the inline form never needed: `renderCursor` writes `next` into
  // the cursor's `Next:` line unflattened, and references/conventions.md states
  // the cursor is always exactly four lines - a wrapped resume pointer would
  // produce a fifth line `parseCursor` cannot read back, so the very next
  // `cursor get` would answer `unparseable-cursor`. A file is the transport
  // that can carry a newline, so this is where the structural term belongs. It
  // REFUSES rather than flattening, mirroring `milestone-prune --label`'s table
  // term: a malformed value is a malformed CALL and nothing is written.
  if (typeof next === 'string' && /[\r\n]/.test(next)) {
    return fail('bad-args',
      'cursor set --next cannot contain a newline - the cursor is exactly four lines');
  }
  if (!CURSOR_STATUSES.includes(opts.status)) {
    return fail('bad-status', `"${opts.status}" is not in the lifecycle: ${CURSOR_STATUSES.join(' | ')}`);
  }

  // name/total: explicit flag > ROADMAP derivation > existing cursor > fail.
  let name = opts.name;
  let total;
  if ('total' in opts) {
    const parsed = requireCursorNumber(opts.total);
    if (!parsed.ok) return fail('bad-args', 'cursor set --total needs a non-negative integer');
    total = parsed.value;
  }
  if (name === undefined || total === undefined) {
    // The same phase-list grammar `status` reads (references/roadmap-phases.md).
    // `closed` fills `no active cycle` / 0, so the seam succeeds against a
    // pruned roadmap BY CONSTRUCTION and /cad-milestone step 6 runs on the tree
    // its own step 3 produces. `out-of-grammar` and `no-section` deliberately
    // keep today's behavior - a roadmap holding unrecognized phase-shaped lines
    // is broken, not closed, and writing `of 0` there would erase a live
    // cycle's total.
    const { state, phases } = classifyPhaseList(read(join(dir, 'ROADMAP.md')) || '');
    const entry = phases.find((p) => p.n === phase);
    if (name === undefined && entry) name = entry.name;
    if (total === undefined && phases.length) total = phases.length;
    if (state === 'closed') {
      // Before the prior-cursor fallback below on purpose: inheriting a stale
      // total writes `Phase: 1 of 5` against a zero-phase roadmap, which reads
      // as an `of M` mismatch to /cad-health.
      //
      // `paused` is the one exception, and it is a hold rather than a
      // transition: /cad-pause calls this flaglessly, so deriving 0 here would
      // erase the stale `of <M>` that cmdStatus treats as the ONLY surviving
      // evidence of an unfinished close (a tagged close deletes `phases/<N>/`,
      // so the phase-dir drift cannot see it either). Pausing must not destroy
      // the signal that says the close never finished.
      const prior = opts.status === 'paused'
        ? parseCursor(read(join(dir, 'STATE.md')) || '') : null;
      if (prior && prior.total && prior.phase === phase) {
        if (name === undefined) name = prior.name;
        if (total === undefined) total = prior.total;
      }
      if (name === undefined) name = CLOSED_CYCLE_NAME;
      if (total === undefined) total = 0;
    }
  }
  if (name === undefined || total === undefined) {
    const prior = parseCursor(read(join(dir, 'STATE.md')) || '');
    if (prior) {
      if (name === undefined && prior.phase === phase) name = prior.name;
      if (total === undefined) total = prior.total;
    }
  }
  if (name === undefined || total === undefined) {
    return fail('cannot-derive', 'phase name/total not in flags, ROADMAP.md, or the existing cursor');
  }

  const cursor = {
    phase, total, name, status: opts.status, next,
    updated: new Date().toISOString().slice(0, 10),
  };
  atomicWrite(join(dir, 'STATE.md'), renderCursor(cursor));
  ok({ cursor });
}

// ---------------------------------------------------------------------------
// phase-done - the two status flips verify.md owns (and undo reverses).
// Flips phase N's ROADMAP box and its traceability rows in one call; output
// names exactly what changed. Deferred rows are never touched unless named
// explicitly via --reqs.
// ---------------------------------------------------------------------------
function cmdPhaseDone(dir, opts) {
  // `--n "$PHASE"` with the variable unset reaches parseArgs as a valueless
  // flag, which mints the boolean `true` - and `Number(true) === 1` boxed
  // phase 1 complete and flipped its traceability rows, ok:true. requirePhaseArg
  // refuses that shape (and every non-numeric one) before anything is read.
  // `.value`, not `.raw` (D-11): setPhaseBox, the `r.phase === n` row filter and
  // the unknown-phase message all take a number, and the raw spelling would
  // regress `--n 02` to unknown-phase while `--n 2.1` must keep boxing Phase 2.1.
  const parsedPhase = requirePhaseArg(opts.n);
  if (!parsedPhase.ok) return fail('bad-args', 'phase-done needs --n <phase>');
  const n = parsedPhase.value;
  // An explicit --reqs means "exactly these rows". An empty one is almost
  // always an unset variable (`--reqs "$IDS"`), and treating it as "flag
  // absent" would silently widen that to every non-Deferred row of the phase -
  // the opposite of the caller's intent - so it fails here instead.
  let namedReqs = null;
  if ('reqs' in opts) {
    if (typeof opts.reqs !== 'string') {
      return fail('bad-args', 'phase-done --reqs needs a comma-separated id list');
    }
    namedReqs = opts.reqs.split(',').map((s) => s.trim()).filter(Boolean);
    if (!namedReqs.length) {
      return fail('bad-args', 'phase-done --reqs is empty; omit it to close the whole phase');
    }
  }
  const undo = 'undo' in opts;
  const roadmapFile = join(dir, 'ROADMAP.md');
  const roadmapText = read(roadmapFile);
  if (roadmapText === null) return fail('no-roadmap', `${roadmapFile} not found`);
  const boxed = setPhaseBox(roadmapText, n, !undo);
  if (!boxed) return fail('unknown-phase', `no "**Phase ${n}:**" line under ## Phases`);

  const reqFile = join(dir, 'REQUIREMENTS.md');
  const reqText = read(reqFile);
  let reqs = [];
  let newReqText = null;
  if (reqText !== null) {
    const rows = parseRequirements(reqText);
    const ids = namedReqs
      ?? rows.filter((r) => r.phase === n && r.status !== 'Deferred').map((r) => r.id);
    const res = setReqStatus(reqText, ids, undo ? 'Pending' : 'Complete');
    reqs = res.changed;
    newReqText = res.text;
  }

  // Both edits validated before either write - all-or-nothing.
  atomicWrite(roadmapFile, boxed.text);
  if (newReqText !== null) atomicWrite(reqFile, newReqText);
  ok({ roadmap: { line: boxed.line, now: undo ? '[ ]' : '[x]' }, reqs });
}

// ---------------------------------------------------------------------------
// uat - checklist persistence. The script owns the invariants (first_pass
// set-once, verifier never overwrites user results, counts always recomputed,
// atomic writes); the model owns item wording and result inference.
// ---------------------------------------------------------------------------
/**
 * Read a JSON payload from `--payload <file>` when one is named, otherwise from
 * stdin, as a DISCRIMINATED result.
 *
 * The reader this replaces returned `null` for BOTH a parse failure and a
 * legitimate `null` payload, and `merge`'s `if (f === null) return;` then exited
 * 0 having printed NOTHING - from a seam whose entire contract is one JSON line
 * on stdout, so the caller saw neither a result nor a refusal. Distinguishing
 * the two is what lets a `null` payload be refused like any other non-object
 * instead of vanishing. `ok:false` here means a refusal has ALREADY been
 * emitted; the caller returns without emitting a second one.
 *
 * Empty input is `no-payload`, not `bad-payload`: "you handed me nothing" and
 * "what you handed me is not the shape" are different repairs, and the first is
 * what a truncated or never-written findings file actually looks like.
 * @param {string|boolean} [file] `opts.payload`; stdin when undefined
 * @returns {{ok: true, value: any} | {ok: false}}
 */
function readJsonPayload(file) {
  let text;
  let where = 'stdin';
  if (file !== undefined) {
    // parseArgs gives a valueless flag the boolean `true`, so `--payload` with
    // no path must be refused here rather than reaching readFileSync.
    if (typeof file !== 'string' || !file.trim()) {
      fail('no-payload', '--payload needs a file path');
      return { ok: false };
    }
    where = file;
    text = read(file);
    if (text === null) {
      fail('no-payload', `${file} not found or unreadable`);
      return { ok: false };
    }
  } else {
    try { text = readFileSync(0, 'utf8'); }
    catch (e) { fail('no-payload', `stdin: ${e.message}`); return { ok: false }; }
  }
  if (!text.trim()) {
    fail('no-payload', `${where} is empty`);
    return { ok: false };
  }
  try { return { ok: true, value: JSON.parse(text) }; }
  catch (e) { fail('bad-payload', e.message); return { ok: false }; }
}

function uatFile(dir, n) { return join(dir, 'phases', String(n), 'UAT.md'); }

function loadUat(dir, n) {
  const text = read(uatFile(dir, n));
  if (text === null) { fail('no-uat', `${uatFile(dir, n)} not found`); return null; }
  return parseUat(text);
}

function nextPending(items) {
  const it = items.find((i) => i.status === 'pending');
  return it ? { k: it.k, name: it.name, expected: it.expected } : null;
}

function writeUat(dir, n, uat) {
  uat.fm.updated = new Date().toISOString().slice(0, 10);
  atomicWrite(uatFile(dir, n), renderUat(uat));
}

// `pending` is legal for a user re-record: a fixed failure goes back to
// pending (with fix: "<hash>, retest") so the walk retests it. first_pass is
// untouched by that reset - it only ever records the first pass/fail verdict.
const UAT_RESULTS = ['pass', 'fail', 'skipped', 'blocked', 'pending'];

// The FREE-TEXT half of `uat record`'s fields, and exactly what `--fields-file`
// may carry. Every other field the subcommand takes is validated against a
// closed enum, an `AC<N>` shape or an integer grammar at its own guard, so it is
// not caller-derived prose and gains nothing from a path transport - and
// admitting one here would route it around the guard that validates it.
const UAT_TEXT_FIELDS = ['reason', 'reported', 'cause', 'fix', 'evidence'];

function cmdUat(dir, sub, opts) {
  // The shared reader, replacing a bare `Number()` + NaN test: a malformed
  // `--phase` is now refused in the same words on every seam, and `n` is the
  // caller's own SPELLING - every use of it here is a path (`uatFile`, the
  // FINDINGS.json path) or a label (`fm.phase`), never arithmetic, so
  // `--phase 1.10` reads `phases/1.10` instead of phase 1.1's checklist.
  const parsedPhase = requirePhaseArg(opts.phase);
  if (!parsedPhase.ok) return fail('bad-args', 'uat needs --phase <N>');
  const n = parsedPhase.raw;

  if (sub === 'init' || sub === 'refresh') {
    // stdin only - `--payload` is merge's flag. A literal `null` on stdin now
    // reaches the Array.isArray guard below and is refused `bad-payload`,
    // where the old sentinel-collision reader exited 0 printing nothing.
    const payload = readJsonPayload();
    if (!payload.ok) return;
    const items = payload.value;
    if (!Array.isArray(items) || items.some((i) => !i || !i.name || !i.expected)) {
      return fail('bad-payload', 'expected a JSON array of {name, expected}');
    }
    // The traceability fields are OPTIONAL but validated before any write, so a
    // typo lands as a named refusal rather than as an item whose `criterion`
    // names nothing (which `criteria-coverage` would then report as
    // `unknown_criterion` on a file already on disk).
    const badCriterion = items.find((i) => i.criterion !== undefined && !/^AC\d+$/.test(i.criterion));
    if (badCriterion) {
      return fail('bad-payload', `criterion must be AC<N> (got: ${badCriterion.criterion})`);
    }
    const badOrigin = items.find((i) => i.origin !== undefined && !UAT_ORIGINS.includes(i.origin));
    if (badOrigin) {
      return fail('bad-payload', `origin must be one of: ${UAT_ORIGINS.join(' | ')} (got: ${badOrigin.origin})`);
    }
    // Carried onto the item by BOTH arms. `origin` is never derived from the
    // presence of `criterion`: a present `criterion` is itself the
    // criterion-derived marker, and fabricating a second one would put this
    // seam's output out of step with the four backfilled checklists (D-16).
    const build = (it, k) => ({ k, name: it.name, expected: it.expected,
      ...(it.criterion ? { criterion: it.criterion } : {}),
      ...(it.origin ? { origin: it.origin } : {}),
      status: 'pending', ...(it.source ? { source: it.source } : {}) });
    if (sub === 'init') {
      if (existsSync(uatFile(dir, n))) return fail('uat-exists', 'use refresh, or remove the file deliberately');
      const today = new Date().toISOString().slice(0, 10);
      const uat = {
        // `fields_version` is written unconditionally, before any item is
        // considered: it marks the FILE as post-field, so a payload that
        // carries no `criterion` at all can never be mistaken for a checklist
        // that predates the field.
        fm: { status: 'testing', phase: String(n), fields_version: UAT_FIELDS_VERSION,
          started: today, updated: today,
          ...(opts.sources ? { sources: opts.sources } : {}) },
        items: items.map((it, i) => build(it, i + 1)),
      };
      writeUat(dir, n, uat);
      return ok({ file: uatFile(dir, n), items: uat.items.length, next: nextPending(uat.items) });
    }
    // refresh: append only items whose name matches nothing existing; never
    // touch a recorded result. It carries the same fields `init` does, in
    // LOCKSTEP with it (D-06): `verify.md` routes every re-run of a phase
    // through refresh, so an arm that dropped them would make any phase
    // verified across two sessions untraceable even with init right.
    const uat = loadUat(dir, n);
    if (!uat) return;
    const have = new Set(uat.items.map((i) => String(i.name)));
    const fresh = items.filter((i) => !have.has(i.name));
    let k = Math.max(0, ...uat.items.map((i) => Number(i.k)));
    for (const it of fresh) uat.items.push(build(it, ++k));
    if (fresh.length) writeUat(dir, n, uat);
    return ok({ added: fresh.length, total: uat.items.length, next: nextPending(uat.items) });
  }

  if (sub === 'record') {
    const uat = loadUat(dir, n);
    if (!uat) return;
    // A valueless `--item` parses as the boolean `true` and `Number(true)` is 1,
    // so `--item "$K"` with K unset recorded a result against item 1 - and the
    // set-once `first_pass` invariant then makes that verdict permanent. Refused
    // before the lookup, alongside the `--result`/`--source`/`--origin` guards
    // below rather than in place of them. A clean integer naming no item keeps
    // today's `unknown-item` answer: "you named no item" and "that item is not
    // here" are different repairs.
    const parsedItem = requireInt(opts.item);
    if (!parsedItem.ok) return fail('bad-args', 'uat record needs --item <k>');
    const k = parsedItem.value;
    const item = uat.items.find((i) => Number(i.k) === k);
    if (!item) return fail('unknown-item', `no item ${k} in UAT.md`);
    if (!UAT_RESULTS.includes(opts.result)) {
      return fail('bad-result', `--result must be one of: ${UAT_RESULTS.join(' | ')}`);
    }
    const source = opts.source || 'user';
    // Validated BEFORE any write, same shape as the `--origin` guard below:
    // `--source` used to accept any string and store nothing outside
    // `verifier`, so a walk-executed pass recorded as a user answer and
    // nothing reported the drop. An out-of-enum value must leave the file
    // byte-unchanged rather than silently discard the provenance.
    if (opts.source !== undefined && !UAT_SOURCES.includes(String(opts.source))) {
      return fail('bad-args', `--source must be one of: ${UAT_SOURCES.join(' | ')}`);
    }
    // Invariant: a verifier result only ever fills a pending item.
    //
    // Scoped to `verifier` ALONE, deliberately. A `model` result is a live
    // answer at the item the walk is standing on, and widening the guard to it
    // would refuse the retest re-record `route_failures` depends on.
    if (source === 'verifier' && item.status !== 'pending') {
      return fail('would-overwrite', `item ${k} is ${item.status}; verifier results only fill pending items`);
    }
    // Validated BEFORE any write: `--origin` is the after-the-fact repair for
    // an item whose provenance was never declared, so an out-of-enum value must
    // leave the file byte-unchanged rather than record a marker nothing reads.
    if (opts.origin !== undefined && !UAT_ORIGINS.includes(opts.origin)) {
      return fail('bad-args', `--origin must be one of: ${UAT_ORIGINS.join(' | ')}`);
    }
    // `--criterion` is the repair for a link that was never written or was lost,
    // and it is where the `fieldless-checklist` diagnostic routes users. Same
    // `^AC\d+$` test `uat init` applies at the payload face, so the two cannot
    // drift - a flag given with no value parses as boolean `true` and is refused
    // by it too. Validated BEFORE any write: a rejected value leaves the file
    // byte-unchanged rather than recording a marker nothing reads.
    //
    // The repair also needs `--result`: record has no field-only mode, so
    // re-recording the item's CURRENT status is the repair form. Without this
    // flag the diagnostic would have to route users to `--origin`, which on a
    // fieldless checklist writes `origin: criterion` - a value naming no id,
    // which disqualifies the phase from the legacy rule, converts zero breaks
    // into one per criterion, and leaves no seam able to add `criterion` back.
    if (opts.criterion !== undefined && !/^AC\d+$/.test(String(opts.criterion))) {
      return fail('bad-args', `--criterion must be AC<N> (got: ${opts.criterion})`);
    }
    // `--fields-file`: the FREE-TEXT fields through the path transport, because
    // every one of them is caller-derived - a failing item's reason, what the
    // user reported, the cause, the fix, the evidence - and the inline form puts
    // that prose inside a double-quoted shell word where `$(...)` executes
    // before Node starts (lib/text-flag-file.mjs, references/conventions.md).
    //
    // ONE flag holding a JSON OBJECT, never per-field `-file` flags (D-05):
    // verify.md passes two or three text flags on a single call, so per-field
    // files would cost up to three extra Write calls per failed item on the one
    // workflow whose per-item round-trip discipline is explicit.
    //
    // A key outside the five is REFUSED, never dropped. `severity`, `origin`,
    // `criterion`, `result` and `source` are enum-validated at their own guards
    // above, so admitting them here would either bypass those guards or
    // silently discard a field the caller believes was recorded. Every refusal
    // lands BEFORE any mutation of the item, so a rejected call leaves UAT.md
    // byte-unchanged - the standing posture at those same guards.
    const resolvedFields = resolveTextFlag(opts, 'fields', 'uat record');
    if (!resolvedFields.ok) return fail('bad-args', resolvedFields.detail);
    /** @type {Record<string, string>} */
    let fileFields = {};
    if (resolvedFields.value !== undefined) {
      let payload;
      try {
        payload = JSON.parse(resolvedFields.value);
      } catch (e) {
        return fail('bad-args',
          `uat record --fields-file is not JSON: ${e && e.message ? e.message : String(e)}`);
      }
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return fail('bad-args',
          `uat record --fields-file must hold a JSON object of ${UAT_TEXT_FIELDS.join(' | ')}`);
      }
      for (const [key, value] of Object.entries(payload)) {
        if (!UAT_TEXT_FIELDS.includes(key)) {
          return fail('bad-args', `uat record --fields-file carries "${key}", which is not one of:`
            + ` ${UAT_TEXT_FIELDS.join(' | ')}`);
        }
        if (typeof value !== 'string') {
          return fail('bad-args', `uat record --fields-file "${key}" must be a string`);
        }
        // The same refusal the reader makes for one flag's two forms, per FIELD:
        // a precedence rule would silently discard one of two values the caller
        // believes was recorded.
        if (opts[key] !== undefined) {
          return fail('bad-args',
            `uat record takes "${key}" inline or in --fields-file, never both`);
        }
      }
      fileFields = payload;
    }
    item.status = opts.result;
    // `user` stays IMPLICIT - never written onto the item - so every existing
    // checklist stays byte-identical; `verifier` and `model` are the two values
    // that render.
    if (source !== 'user') item.source = source;
    // `criterion` is already registered in UAT_FIELDS, so an accepted value
    // renders directly after `expected` and survives every later rewrite.
    for (const [flag, field] of [['reason', 'reason'], ['reported', 'reported'],
      ['severity', 'severity'], ['cause', 'cause'], ['fix', 'fix'], ['evidence', 'evidence'],
      ['origin', 'origin'], ['criterion', 'criterion']]) {
      // The file form feeds THIS loop and nothing else, so an identical value
      // through either transport writes a byte-identical UAT.md.
      const value = opts[flag] !== undefined ? opts[flag] : fileFields[flag];
      if (value !== undefined) item[field] = value;
    }
    // Invariant: first_pass is the FIRST pass/fail verdict, set once, never after.
    if (item.first_pass === undefined && (opts.result === 'pass' || opts.result === 'fail')) {
      item.first_pass = opts.result;
    }
    writeUat(dir, n, uat);
    const parsed = parseUat(read(uatFile(dir, n)) || '');
    return ok({ item: { k, status: item.status }, counts: parsed.counts, next: nextPending(uat.items) });
  }

  if (sub === 'merge') {
    // Verifier findings: {passes:[{k|name, evidence}], gaps:[{k|name, reason,
    // evidence?}], human_checks:[{name, expected}]}. Fills only pending items.
    //
    // Merge is PARTIAL-SUCCESS, deliberately unlike init/refresh (which reject
    // a whole payload on one bad element): an unusable entry is set aside and
    // counted, the rest merges. verify-deep's deep pass is an accelerator,
    // never a gate - the strict form would discard twenty good findings over
    // one nameless gap. Two counts, always present even at zero:
    //   skipped  - the finding conflicts with an already-recorded result. The
    //              invariant stands; the drop just stops being silent.
    //   rejected - the entry resolves to no usable item at all, so it can
    //              never be applied to one or appended as one.
    //
    // The ENVELOPE is all-or-nothing even though the entries inside it are
    // partial-success, and both refusals land BEFORE loadUat and before any
    // write, so a refused merge leaves UAT.md and FINDINGS.json byte-identical.
    // Without the array test below, `"hello"` and `{}` both merged as an
    // all-zero ok:true success - so a truncated findings file reported a clean
    // deep pass instead of falling through to the walk, which is the one
    // outcome the deep pass must never be able to fake.
    const payload = readJsonPayload(opts.payload);
    if (!payload.ok) return;
    const f = payload.value;
    if (f === null || typeof f !== 'object' || Array.isArray(f)) {
      return fail('bad-payload',
        'expected a JSON object carrying passes, gaps or human_checks');
    }
    if (!Array.isArray(f.passes) && !Array.isArray(f.gaps)
      && !Array.isArray(f.human_checks)) {
      return fail('bad-payload',
        'payload carries none of passes, gaps, human_checks as an array');
    }
    // ...and every list that IS present must be an array. The disjunction above
    // only proves ONE of them is, so a sibling holding a string used to reach
    // the `for..of` below and be iterated per CHARACTER: `{"passes":[],
    // "gaps":"oops"}` merged ok:true with rejected:4. No phantom item was
    // written - the usableName guard drops each character - but the deep pass
    // reported a merge instead of falling through, which is the one outcome it
    // must never be able to fake. Check presence, not truthiness: a payload may
    // legitimately omit a list, and `undefined` is not a malformed one.
    for (const key of ['passes', 'gaps', 'human_checks']) {
      if (f[key] !== undefined && !Array.isArray(f[key])) {
        return fail('bad-payload', `${key} is present but not an array`);
      }
    }
    const uat = loadUat(dir, n);
    if (!uat) return;
    // Guard the shape the CONSUMER accepts - a name that renders a heading -
    // not the reported input. Without it an entry carrying neither a matching
    // `k` nor a name was appended as `### N. undefined`, a phantom at status
    // fail/pending that blocks phase completion permanently.
    const usableName = (e) => (typeof e.name === 'string' && e.name.trim() ? e.name.trim() : null);
    // Match through the SAME normalizer the append path uses. Matching raw
    // (`i.name === ref.name`) while appending trimmed meant a ref named
    // `Login works ` missed the stored `Login works` and appended a
    // byte-identical duplicate that no later merge could reach by name - so
    // its fail/pending status blocked uatComplete permanently. That is the
    // phantom usableName exists to prevent, reached from the read side.
    // A null name matches nothing: an unnamed ref stays rejected rather than
    // colliding with the first item.
    const find = (ref) => uat.items.find((i) => {
      if (ref.k !== undefined && Number(i.k) === Number(ref.k)) return true;
      const name = usableName(i);
      return name !== null && name === usableName(ref);
    });
    let auto = 0, gaps = 0, added = 0, skipped = 0, rejected = 0;
    // The DISCARDED entries, collected as they are counted (D-06). The counters
    // alone add nothing a transcript already had - `verify-deep.md` prints them
    // - and an ACCEPTED finding is recoverable from the item it wrote. The
    // unrecoverable material is exactly this: what was counted and then dropped.
    const rejectedEntries = [];
    const skippedEntries = [];
    for (const p of f.passes || []) {
      const it = find(p);
      if (it && it.status === 'pending') {
        it.status = 'pass'; it.source = 'verifier';
        if (p.evidence) it.evidence = p.evidence;
        if (it.first_pass === undefined) it.first_pass = 'pass';
        auto++;
      } else if (it) {
        skipped++;
        skippedEntries.push({ list: 'passes', reason: 'already-recorded',
          item: Number(it.k), status: String(it.status), entry: p });
      } else {
        rejected++; // a pass matching no item can never be applied
        rejectedEntries.push({ list: 'passes', reason: 'no-matching-item', entry: p });
      }
    }
    let k = Math.max(0, ...uat.items.map((i) => Number(i.k)));
    for (const g of f.gaps || []) {
      const it = find(g);
      if (it && it.status === 'pending') {
        it.status = 'fail'; it.source = 'verifier';
        if (g.reason) it.reported = g.reason;
        if (g.evidence) it.evidence = g.evidence;
        it.severity = g.severity || 'major';
        if (it.first_pass === undefined) it.first_pass = 'fail';
        gaps++;
      } else if (it) {
        skipped++;
        skippedEntries.push({ list: 'gaps', reason: 'already-recorded',
          item: Number(it.k), status: String(it.status), entry: g });
      } else {
        const name = usableName(g);
        // `gaps` counts gaps actually recorded in the file, so a rejected
        // entry that wrote nothing must not inflate it - otherwise the
        // envelope reports three gaps found for one item written.
        if (!name) {
          rejected++;
          rejectedEntries.push({ list: 'gaps', reason: 'no-usable-name', entry: g });
          continue;
        }
        // `origin: verifier` is the item-level provenance `source: verifier` is
        // not: source records where a RESULT came from and is set identically on
        // an existing pending item above, so it cannot mark an item the verifier
        // ADDED (D-12). Without this the reverse-direction exemption would
        // swallow nearly every item in every shipped checklist.
        uat.items.push({ k: ++k, name, expected: g.expected || g.reason || '',
          origin: 'verifier',
          status: 'fail', source: 'verifier', severity: g.severity || 'major',
          ...(g.reason ? { reported: g.reason } : {}),
          ...(g.evidence ? { evidence: g.evidence } : {}), first_pass: 'fail' });
        gaps++; added++;
      }
    }
    for (const h of f.human_checks || []) {
      const match = find(h);
      if (match) {
        // The COUNTING gap here (an entry matching an existing item lands in
        // neither `skipped` nor `rejected`) is deferred to its own phase (D-14)
        // and stays open: no counter moves on this line. The ENTRY is recorded
        // anyway, with the same `already-recorded` reason, because a file whose
        // whole purpose is making a discarded finding recoverable must not be
        // the one place a discarded finding disappears. So this row is present
        // in FINDINGS.json while absent from the `skipped` count, deliberately.
        skippedEntries.push({ list: 'human_checks', reason: 'already-recorded',
          item: Number(match.k), status: String(match.status), entry: h });
        continue;
      }
      const name = usableName(h);
      if (!name) {
        rejected++; // appends the identical phantom, at pending
        rejectedEntries.push({ list: 'human_checks', reason: 'no-usable-name', entry: h });
        continue;
      }
      // This path wrote NO provenance of any kind before this phase - observable
      // at .planning/phases/1/UAT.md items 12 and 14, which carry neither
      // `source` nor an origin.
      //
      // `why_human` rides the append spread-guarded: the verifier's per-item
      // reason inspection cannot settle it, carried so the walk can tell an
      // item ALREADY judged human-only from one it must judge itself against
      // the stated bar. An omitted value writes no line and no default is
      // invented - a fabricated reason would be indistinguishable from a
      // judged one at exactly the moment the walk is trusting it.
      uat.items.push({ k: ++k, name, expected: h.expected || '',
        origin: 'verifier',
        ...(h.why_human ? { why_human: h.why_human } : {}),
        status: 'pending' });
      added++;
    }
    writeUat(dir, n, uat);
    // The findings envelope, persisted beside the phase's other artifacts
    // (D-05/D-09). A NEW file, never a UAT.md section: `parseUat`/`renderUat`
    // split on `^### ` and cut each part at `sectionBound`, so a
    // `## Verifier findings` block is silently dropped by the next `uat record`
    // - worse than not persisting, because it looks durable - and a `### `
    // extra is promised user-owned and verbatim by templates/UAT.md. Resolved
    // under the run's `--dir` exactly as `uatFile` is, never as a bare relative
    // path, or every merge on a temp tree would write into the process cwd.
    //
    // Written on EVERY successful merge, all-zero ones included, so its absence
    // means no merge ran. A second merge on the same phase overwrites it with
    // that merge's envelope: the deep pass is once per phase, and the envelope
    // is the merge's own return value, not an accumulating log.
    const findingsRel = `phases/${n}/FINDINGS.json`;
    let findingsError = null;
    try {
      atomicWrite(join(dir, 'phases', String(n), 'FINDINGS.json'),
        `${JSON.stringify({ auto_passed: auto, gaps, added, skipped, rejected,
          rejected_entries: rejectedEntries, skipped_entries: skippedEntries }, null, 2)}\n`);
    } catch (e) {
      // REPORTED, never thrown. A throw here unwinds to the dispatch catch,
      // which emits `{ok:false, reason:'internal'}` and takes the counters down
      // with it - AFTER writeUat has already rewritten UAT.md. The merge would
      // then be neither undone nor reported, and a retry would re-merge against
      // non-pending items and persist an envelope claiming every finding was a
      // conflict. Losing the counters to protect the file that exists to
      // preserve them is the wrong trade.
      findingsError = e instanceof Error ? e.message : String(e);
    }
    return ok({ auto_passed: auto, gaps, added, skipped, rejected,
      findings: findingsError === null ? findingsRel : null,
      ...(findingsError !== null ? { findings_error: findingsError } : {}),
      next: nextPending(uat.items) });
  }

  if (sub === 'status') {
    const uat = loadUat(dir, n);
    if (!uat) return;
    const complete = uatComplete(uat);
    return ok({
      status: uat.status, counts: uat.counts,
      result: complete ? 'complete' : 'partial',
      ...(nextPending(uat.items) ? { first_pending: nextPending(uat.items) } : {}),
    });
  }

  return fail('usage', 'uat <init|refresh|record|merge|status>');
}

// ---------------------------------------------------------------------------
// listPlanFiles - one phase directory's plan files, split into conforming
// (`PLAN.md`, `PLAN-N.md`) and non-conforming (any other `PLAN*.md`, e.g. a
// `PLAN-gaps.md` shipped by name - phase-1 D-21: invisible to status, audit,
// plan-overlap and executor dispatch alike, so its requirements and files
// were read by nothing while everything reported success).
//
// `missing: true` reports that `pdir` could not be read at all - load-bearing,
// not decoration: cmdAudit and cmdPlanOverlap have OPPOSITE absent-directory
// contracts today (audit swallows it to mean "unplanned"; plan-overlap
// returns `fail('no-phase-dir', ...)`), and a helper with no channel for that
// would turn an absent phase dir into plan-overlap's clean-pass shape, which
// `execute.md`'s choose_path (routes sequential only on `ok:false`) would then
// read as clearance to run parallel. Each caller keeps its own behavior on
// `missing`; this helper only reports it.
// ---------------------------------------------------------------------------
function listPlanFiles(pdir) {
  let entries;
  try { entries = readdirSync(pdir); }
  catch { return { plans: [], nonconforming: [], missing: true }; }
  const plans = [];
  const nonconforming = [];
  for (const f of entries) {
    if (/^PLAN(-\d+)?\.md$/.test(f)) plans.push(f);
    else if (f.startsWith('PLAN') && f.endsWith('.md')) nonconforming.push(f);
  }
  return { plans: plans.sort(), nonconforming: nonconforming.sort() };
}

// ---------------------------------------------------------------------------
// audit - the requirement -> phase -> plan -> verified trace, as data. The
// ship-blocking verdict stays the model's sentence; this makes it arithmetic.
// break codes: no-phase | phase-missing | no-plan | not-verified | drift |
// unpicked (an `## Active` id no phase picked up - it has no Traceability row
// at all, so it carries no `phase` key; see the D-01/D-04 block below).
//
// Also emits `version_drift` - milestone-scoped, present-or-absent, no break
// code and no count - when the planning docs name a version this repo has
// already TAGGED while its cycle is still open. See the block at its site.
// ---------------------------------------------------------------------------
function cmdAudit(dir) {
  const reqText = read(join(dir, 'REQUIREMENTS.md'));
  if (reqText === null) return fail('no-requirements', `${join(dir, 'REQUIREMENTS.md')} not found`);
  const roadmapText = read(join(dir, 'ROADMAP.md'));
  if (roadmapText === null) return fail('no-roadmap', `${join(dir, 'ROADMAP.md')} not found`);
  const roadmap = new Map(parseRoadmapPhases(roadmapText).map((p) => [p.n, p]));

  // requirement id -> the plan file that carries it, per phase dir.
  const planByReq = new Map();
  const planIds = new Map(); // plan file -> ids (for orphan detection)
  const frontmatterIssues = []; // [{file, issues}], plan-file order, omitted when empty
  const nonconformingPlans = []; // phases/<n>/<file>, phase order, omitted when empty
  for (const [n] of roadmap) {
    const pdir = join(dir, 'phases', String(n));
    const { plans: files, nonconforming } = listPlanFiles(pdir);
    for (const f of nonconforming) nonconformingPlans.push(`phases/${n}/${f}`);
    for (const f of files) {
      const rel = `phases/${n}/${f}`;
      const { ids, issues } = parsePlanRequirements(read(join(pdir, f)) || '');
      planIds.set(rel, ids);
      for (const id of ids) if (!planByReq.has(id)) planByReq.set(id, rel);
      if (issues.length) frontmatterIssues.push({ file: rel, issues });
    }
  }

  const rows = parseRequirements(reqText);
  // The declared milestone scope, read ONCE - no new file read, and no
  // roadmap-side source: parseRoadmapPhases carries no id mapping (D-09).
  const active = classifyActiveSection(reqText);
  const requirements = [];
  const deferred = [];
  for (const r of rows) {
    if (r.status === 'Deferred') { deferred.push(r.id); continue; }
    const entry = { id: r.id, phase: r.phase };
    if (r.phase === null) { entry.break = 'no-phase'; requirements.push(entry); continue; }
    const phase = roadmap.get(r.phase);
    if (!phase) { entry.break = 'phase-missing'; requirements.push(entry); continue; }
    const plan = planByReq.get(r.id) || null;
    entry.plan = plan;
    entry.status = r.status;
    entry.box = phase.checked;
    if (!plan) entry.break = 'no-plan';
    else if (r.status === 'Complete' && phase.checked) { /* fully traced */ }
    else if (r.status !== 'Complete' && !phase.checked) entry.break = 'not-verified';
    else entry.break = 'drift'; // the two status sources contradict
    requirements.push(entry);
  }

  const known = new Set(rows.map((r) => r.id));
  const orphanPlans = [];
  for (const [file, ids] of planIds) {
    const unknown = ids.filter((id) => !known.has(id));
    if (unknown.length) orphanPlans.push({ file, ids: unknown });
  }

  // An `## Active` id with no Traceability row BREAKS the verdict (D-01) - the
  // quiet failure a per-phase flow cannot see, and the state a milestone spends
  // most of its life in. This reverses the additive shape D-07 shipped one
  // milestone earlier: milestone.md's ship gate branches on the verdict alone,
  // so an additive field left the gate exactly as permeable as it was at the
  // v1.2.0 and v1.3.1 closes.
  //
  // The set is `## Active` minus the table's ids - NO plan-side subtraction: an
  // id a plan declares but no row carries is BOTH unpicked here and an
  // `orphans.plan_ids` entry there, which is the seed-reqs-never-wrote state and
  // must report from both directions. Never coerce `active.ids` null to []
  // (D-06): every project scaffolded before v1.4.0 has no `## Active` heading by
  // this grammar, and a coercion would read its whole scope as unpicked and make
  // its audit unpassable.
  //
  // `isRequirementId` is the ADMISSION test, and it is load-bearing: the bullet
  // grammar reads any bold span as an id (`- **Note**: scope frozen` declares
  // `Note`, `- **AUTH-01:**` declares `AUTH-01:`) and must keep doing so for
  // `seed-reqs`. Without this filter every project carrying a prose bold-bullet
  // in `## Active` would FAIL its audit on upgrade, named for a requirement that
  // does not exist - and `AUTH-01:` would break while its own row traced
  // separately, counting one requirement twice. Such a bullet is REPORTED
  // instead, as `active-non-id-bullet` in `active_issues`.
  const unpicked = (active.ids || []).filter((id) => isRequirementId(id) && !known.has(id));
  // No `phase` key on these entries, deliberately: there is no row, so there is
  // no Phase cell to report, and `phase: null` is `no-phase`'s own datum (a row
  // that names no phase). Conflating them would make two breaks whose fixes
  // differ - assign the row a phase, vs plan the requirement or defer it -
  // indistinguishable to audit.md's next-action list. Appended AFTER the
  // row-derived entries, so a fully seeded tree's `requirements` is unchanged.
  for (const id of unpicked) requirements.push({ id, break: 'unpicked' });

  // `unseeded` names the `## Active` ids with no row, at ANY row count (D-04) -
  // one question at two row counts rather than two questions. It is no longer
  // verdict-neutral: every id it names also carries an `unpicked` break above.
  // `rows.length === 0` stays a SECOND trigger on purpose - the unpicked arm
  // alone would drop the two zero-row reports references/req-traceability.md
  // documents: a present-but-empty `## Active` ({active_ids: []}) and an absent
  // heading (+ no_active_section: true). The payload carries the same admission
  // test as the break - `unseeded` names ids a `/cad-plan` run could seed a row
  // for, and a non-id-shaped bold span is not one; it reports in `active_issues`.
  let unseeded;
  if (unpicked.length || rows.length === 0) {
    unseeded = { active_ids: unpicked, ...(active.ids === null ? { no_active_section: true } : {}) };
  }

  const broken = requirements.filter((r) => r.break).length;

  // `version_drift` (FRI-03): the planning docs name a version this repo has
  // ALREADY PUBLISHED while the cycle under that number is still open - issue
  // #87, where v2.4.0 was planned, branched and worked under a number already
  // tagged. The predicate is deliberately NOT `docs != manifest`:
  //
  // - The comparand is git TAGS (D-03). `pluginVersion()` is NOT read here, and
  //   this is the whole reason: MANIFEST_PATH resolves relative to the SCRIPT
  //   and audit.md invokes the seam through ${CLAUDE_PLUGIN_ROOT}, so in any
  //   project that is not Cadence a manifest predicate would judge the user's
  //   milestone against CADENCE's release number. Tags are the publication
  //   evidence - the rule skills/cad-health/SKILL.md already states.
  // - The manifest could not even detect #87. At tag v2.4.0 this repo had docs
  //   Active `v2.4.0`, tag `v2.4.0` AND manifest `2.4.0`: byte-identical, on the
  //   manifest test, to an interrupted close. The cycle's own completeness is
  //   what separates them, and only the phase artifacts carry that.
  //
  // Two different omissions, both correct. A doc version NO tag carries is the
  // ordinary ahead-of-manifest mid-cycle state (this repo is in it now). A
  // tagged doc version with EVERY phase complete is a close interrupted between
  // milestone.md's step 2 (the tag) and step 4 (the PROJECT.md evolve) - D-01's
  // exemption, and a state the user is already finishing. Membership, not sort
  // order (D-04): a version that merely sorts below the newest tag was published
  // by nothing, and `tagCarrying` gets the WHOLE list to test against.
  //
  // Present-or-absent, top level, outside `counts` and `requirements`: this
  // signal is milestone-scoped rather than per-requirement, and `total = traced
  // + broken + deferred` is an asserted invariant. The FAIL is audit.md §4's
  // arithmetic over the key - cmdAudit computes no verdict.
  const docVersion = activeVersion(read(join(dir, 'PROJECT.md')) || '')
    || titleVersion(roadmapText);
  // `activeVersion` returns the prose token WITH its `v` (`v9.9.0`), while
  // `tagCarrying` takes a bare comparand and `compareVersions` returns null -
  // not 0 - for a `v`-prefixed operand, so the raw token would match no tag.
  //
  // The tag question is asked FROM the planning root and answered for the
  // PROJECT root above it (TAG-01/D-07): `dir` defaults to `.planning` and
  // audit.md invokes the seam with no `--dir`, and `.planning` never holds
  // `.git`, so unbounded `git -C` discovery walked past the project entirely. A
  // project sitting inside an unrelated umbrella repository was FAILed by a
  // version that repository published; now that answer is refused and the tag
  // list is empty, which is exactly the no-repo behaviour (D-08).
  const publishedAs = docVersion
    ? tagCarrying(readTags(dir, dirname(dir)), normalizeTargetVersion(docVersion)) : null;
  // Derived phase status, not the roadmap checkbox: "finish the close" means the
  // artifacts say complete. Same test cmdStatus uses to find the current phase.
  //
  // "Complete" alone is too narrow a test for the exemption, because one phase
  // shape can never reach it: `uatComplete` refuses a `blocked` item and
  // verify.md makes `blocked` TERMINAL - nothing returns an item to the walk
  // from it. A phase parked there would hold the cycle open forever and pin the
  // gate at FAIL with one of audit.md's two exits permanently unreachable. So a
  // phase also stops holding the cycle open when its checklist has nothing left
  // that can be ANSWERED: every item pass, skipped-with-reason, or blocked.
  // That is the close's own definition of finished work, minus the arm the walk
  // cannot revisit. It does not weaken #87: a cycle being worked under a
  // published number has pending or failed items, or no checklist at all.
  // The OTHER sanctioned state the artifacts cannot express is rolled-over work
  // (DRF-02/D-04). A close is allowed to carry work forward -
  // `workflows/milestone.md` names it - and such a phase is byte-identical on
  // disk to one still being worked: `derivePhases` gives it
  // unplanned/planned/executed with a possibly absent UAT either way, and the
  // "the close already ran" signals (an ARCHIVE.md heading, an `_archive-<label>`
  // directory) are written conditionally and are far too sparse to key on
  // (D-05). So neither a status derivation nor an archive probe can tell the two
  // apart, and the only surface that carries the answer is the REQUIREMENT ROWS:
  // rolling a phase forward means marking its rows `Deferred`, which the close
  // already does and this audit already excludes from breaks. A phase whose rows
  // are all `Deferred` therefore stops holding the cycle open, and one whose rows
  // are still `Pending` keeps the gate armed - which is the half of D-04 that
  // keeps this from weakening #87.
  //
  // NO rows at all is NOT exempt: an empty set satisfies "every row is Deferred"
  // vacuously, and an unplanned or unseeded phase is the ordinary mid-cycle state
  // the signal exists to catch. The exemption needs at least one row.
  //
  // Read off the `rows` parseRequirements already produced - no second read of
  // REQUIREMENTS.md, and the same row set the arithmetic above is computed from.
  const settled = (p) => p.status === 'complete'
    || (p.uat !== null && p.uat.items.length > 0 && p.uat.items.every((i) =>
      i.status === 'pass' || i.status === 'blocked'
      || (i.status === 'skipped' && i.reason)));
  const rolledOver = (p) => {
    const own = rows.filter((r) => r.phase === p.n);
    return own.length > 0 && own.every((r) => r.status === 'Deferred');
  };
  const cycleOpen = publishedAs !== null
    && derivePhases(dir, [...roadmap.values()]).some((p) => !settled(p) && !rolledOver(p));

  ok({
    requirements,
    ...(orphanPlans.length ? { orphans: { plan_ids: orphanPlans } } : {}),
    ...(frontmatterIssues.length ? { frontmatter_issues: frontmatterIssues } : {}),
    ...(nonconformingPlans.length ? { nonconforming_plans: nonconformingPlans } : {}),
    ...(deferred.length ? { deferred } : {}),
    // Additive, never a break and never a count - two populations: a line
    // OUTSIDE the `## Active` bullet grammar (it declares no id, so there is
    // nothing to count) and a line IN the grammar whose bold span is not
    // id-shaped (`active-non-id-bullet`, held out of the arithmetic above). The
    // cost is real and stated in the prose rather than implied - the id named on
    // either line is invisible to `unpicked` until the line is rewritten as a
    // bullet whose bold span is exactly the id.
    ...(active.issues.length ? { active_issues: active.issues } : {}),
    ...(unseeded ? { unseeded } : {}),
    ...(cycleOpen ? { version_drift: {
      doc_version: docVersion, published_as: publishedAs, cycle_state: 'open',
    } } : {}),
    // total counts Traceability rows PLUS unpicked ids (D-02), which is what
    // keeps `requirements.length + deferred.length === rows.length +
    // unpicked.length` - i.e. total = traced + broken + deferred - true now that
    // a break can exist without a row.
    counts: {
      total: rows.length + unpicked.length,
      traced: requirements.length - broken,
      broken,
      deferred: deferred.length,
    },
  });
}

// ---------------------------------------------------------------------------
// criteria-coverage - the CONTEXT acceptance criterion -> UAT item trace, as
// data. Proves the function is TOTAL: every criterion a phase declared reached
// that phase's checklist. `/cad-audit` folds this into its ONE verdict.
//
// A NEW subcommand rather than an extension of `audit` (D-08): audit's
// `counts` identity is pinned at :702-711 with a comment stating why, and
// audit.md section 4 filters `requirements[]` BY milestone id - a criterion
// break carries no requirement id to filter on, so an out-of-scope phase's
// break would block a ship it should not.
//
// The two directions are ASYMMETRIC (D-09): `breaks` is the only verdict-moving
// key; `untraced`, `legacy`, `unknown_criterion` and `context_issues` are
// additive. Four of four phases this cycle appended legitimate verifier gap
// items, so making the reverse direction breaking would make the gate
// unpassable.
//
// break codes: uncovered (a declared id no item covers) | missing-uat (a
// declared id on a phase carrying no checklist at all) | fieldless-checklist
// (ONE per phase, `{phase, break, file}`: the checklist carries items but none
// of the traceability fields, beside a CONTEXT that did declare ids - so nothing
// in it can be traced in either direction) | unreadable-context (ONE per phase,
// `{phase, break, code, file}`: the CONTEXT.md is there and could not be read,
// so the phase's criteria were never looked at). A `legacy` entry is `{phase,
// reason}`, never a bare phase number: an exemption that states no reason reads
// exactly like a clean pass, which is the skew D-04 wants readable.
// ---------------------------------------------------------------------------

// An `origin` value that declares an item legitimately built from no criterion.
// Mirrors UAT_ORIGINS in lib/planning-files.mjs minus `criterion`, which names
// no id by itself and therefore exempts nothing.
const ORIGIN_EXEMPT = new Set(['verifier', 'smoke']);

// The one sentence every `legacy` entry carries. Fixed rather than computed
// per phase: all of the terms hold identically for every phase the exemption
// reaches, so a per-phase string would differ only in wording while costing the
// reader a comparison. Naming the conditions is the point - the exemption is a
// modern seam reporting green over an old file, and a bare phase number gives a
// reviewer nothing to check it against.
const LEGACY_REASON = 'pre-field checklist: no `fields_version` frontmatter '
  + 'marker, no `criterion` or `origin` on any item, and its CONTEXT declares '
  + 'no AC<N> ids';

/**
 * `criteria-coverage`'s OWN CONTEXT.md reader (D-12).
 *
 * `read()` collapses every errno to `null`, so the D-10 exemption below could
 * not tell a phase whose CONTEXT was pruned away from one at `chmod 000` or
 * replaced by a directory - and the second answered `{"ok":true,"phases":[]}`
 * over criteria it had never looked at, which is precisely the shape of "the
 * gate passed a phase it never checked".
 *
 * Scoped to this ONE call site deliberately: `read()`'s 38 other callers sit
 * behind `|| ''` fallbacks, and widening the errno set there would turn a
 * permission problem into a break across `status`, `audit`, `plan-overlap`,
 * `plan-size` and `seed-reqs` all at once.
 * `code` is the refusal: null when the file was read AND when it is genuinely
 * absent (ENOENT alone keeps the exemption - absent really is nothing to
 * prove), the errno otherwise, with `text` null on both of those arms.
 * @param {string} file
 * @returns {{text: string|null, code: string|null}}
 */
function readCoverageContext(file) {
  try { return { text: readFileSync(file, 'utf8'), code: null }; }
  catch (e) {
    const errno = e && /** @type {any} */ (e).code ? String(/** @type {any} */ (e).code) : 'UNKNOWN';
    return { text: null, code: errno === 'ENOENT' ? null : errno };
  }
}

function cmdCriteriaCoverage(dir) {
  const roadmapText = read(join(dir, 'ROADMAP.md'));
  if (roadmapText === null) return fail('no-roadmap', `${join(dir, 'ROADMAP.md')} not found`);
  // The same phase list `cmdAudit` walks - no new source of truth for which
  // phases exist. `milestone.md` step 3 prunes completed phases out of the live
  // `## Phases` list, so this only ever holds the current cycle's phases.
  const roadmap = parseRoadmapPhases(roadmapText);

  const phases = [];
  const breaks = [];
  const untraced = [];
  const legacy = [];
  const unknownCriterion = [];
  const contextIssues = [];
  let nCriteria = 0, nCovered = 0, nUncovered = 0;

  for (const p of roadmap) {
    const pdir = join(dir, 'phases', String(p.n));
    const context = readCoverageContext(join(pdir, 'CONTEXT.md'));
    // A CONTEXT that EXISTS and could not be read is a break, never D-10's
    // exemption below: the phase's criteria were not proven absent, they were
    // never read. `breaks` is the only verdict-moving key in this envelope, the
    // same reasoning the `fieldless-checklist` break states - and like it (and
    // unlike `uncovered`) it fires whatever the roadmap checkbox says, because
    // an unreadable file is never a transient state of work in flight.
    if (context.code !== null) {
      breaks.push({ phase: p.n, break: 'unreadable-context', code: context.code,
        file: `phases/${p.n}/CONTEXT.md` });
      continue;
    }
    const contextText = context.text;
    const uatText = read(join(pdir, 'UAT.md'));
    // An absent CONTEXT.md is nothing to prove (D-10): CONTEXT is a documented
    // optional artifact, and `milestone.md` runs this gate at step 1 while the
    // prune that DELETES phase dirs runs at step 3, so a prior milestone's
    // pruned phase must never make the gate unpassable. The prune removes the
    // whole directory, so it always takes CONTEXT with it - which is why this
    // arm, and not the UAT one below, is where D-10's exemption belongs.
    if (contextText === null) continue;

    const classified = classifyAcceptanceCriteria(contextText);
    // `criteria: null` is an absent heading - "nothing declared", not a
    // problem. Coerced to [] here because the phase's CONTEXT exists, so it
    // still reports its `phases[]` entry and its items still trace (to nothing,
    // which is `untraced`'s additive job).
    const criteria = classified.criteria || [];
    if (classified.issues.length) contextIssues.push({ phase: p.n, issues: classified.issues });

    // CONTEXT present, UAT.md absent. Exempting this the way a pruned phase is
    // exempted left the gate's one load-bearing direction with an unnamed hole:
    // a checked phase that declared criteria and never got a checklist is the
    // total drop this subcommand exists to catch, and it reported nothing at
    // all. Every declared criterion counts uncovered, and on a CHECKED box each
    // one breaks as `missing-uat` - the same unchecked-box rule as below, so a
    // phase still in flight is counted and never breaks.
    if (uatText === null) {
      phases.push({ phase: p.n, criteria: criteria.length, items: 0 });
      nCriteria += criteria.length;
      for (const c of criteria) {
        nUncovered++;
        if (p.checked) breaks.push({ phase: p.n, id: c.id, break: 'missing-uat' });
      }
      continue;
    }

    const uat = parseUat(uatText);
    const items = uat.items;
    phases.push({ phase: p.n, criteria: criteria.length, items: items.length });

    const withCriterion = items.filter((it) => it.criterion !== undefined);
    const withOrigin = items.filter((it) => it.origin !== undefined);
    // `fieldless` is the FILE-shaped half of the old legacy test (D-16): a
    // non-empty checklist carrying no `fields_version` marker and no traceability
    // field on any item. An EMPTY checklist is not fieldless - an empty checklist
    // is the drop itself, so its criteria all break below.
    //
    // The marker is what this tests, not the item fields. The original
    // conjunction (no `criterion` AND no `origin`) reasoned that every post-field
    // checklist carries at least one `origin`, and that premise was false the day
    // it shipped: `.planning/phases/3/UAT.md` carries 7 `criterion` lines and 0
    // `origin` lines, so a `/cad-verify` that silently stopped emitting
    // `criterion` on a phase-3-shaped checklist read as "an old project" and the
    // gate stayed green forever - exactly the regression this subcommand exists
    // to catch.
    const fieldless = items.length > 0 && uat.fm.fields_version === undefined
      && withCriterion.length === 0 && withOrigin.length === 0;
    if (fieldless) {
      // Legacy is now FIVE terms, the fifth being D-01's: the phase's CONTEXT
      // declares no `AC<N>` ids. The AC-id grammar (`5a3327a`) and
      // `fields_version` (`fd31c04`) both shipped after `v1.5.0`, so no CONTEXT
      // carrying AC ids can predate the fields - which makes a fieldless
      // checklist beside declared ids a DROPPED LINK, not an old file. `uat init`
      // writes `fields_version` unconditionally, so a file this seam produced
      // can never present as legacy however few links its items carry.
      //
      // This is the ONLY statement of that reasoning in the tree (v2.6.2):
      // `workflows/verify.md` states just the additive consequence - a CONTEXT
      // with no `AC<N>` ids yields no `criterion` values and those items report
      // `untraced` - and defers the not-legacy argument here, to the code that
      // decides it.
      //
      // DECLARED, not parsed - the fifth term asks the classifier
      // (`declaresIds`), never `criteria.length`. Those two are not the same
      // question, and reading the second as the first is what let this gate
      // pass a phase it never checked: `- [ ] AC1 the feature works`,
      // `- [ ] **AC1**: x`, `- AC1: x`, `* [ ] AC1: x`, `### AC1: x`,
      // `1. AC1: x` and an indented bullet each parse to ZERO criteria while
      // `context_issues` names the id in the same envelope, so a fieldless
      // checklist beside any of them collected an exemption whose stated reason
      // asserted the phase declared nothing. An id this grammar REFUSED is
      // still an id the author declared, and `'unknown'` (a near-miss heading,
      // whose section is never walked) is not `'none'` either. Only a provable
      // `'none'` may exempt. Widening the grammar to ADMIT those shapes is a
      // separate, still-deferred item; this only stops the exemption inheriting
      // the gap.
      if (classified.declaresIds === 'none') {
        legacy.push({ phase: p.n, reason: LEGACY_REASON });
        continue;
      }
      // ONE break for the phase (D-02), naming the file to repair. Nine
      // per-criterion `uncovered` breaks plus seventeen `untraced` entries are
      // all symptoms of one missing marker, so both are suppressed here and the
      // phase's criteria are restored to `counts` instead of exempted out of
      // them. It has to be a BREAK: `breaks` is the only verdict-moving key, so
      // an additive-only report would leave the gate exactly as permeable as the
      // exemption it replaces.
      //
      // It fires REGARDLESS of the roadmap checkbox, deliberately unlike
      // `uncovered` and `missing-uat`. Those two are box-gated because work in
      // flight legitimately passes through them; this one is not, because `uat
      // init` writes `fields_version` before it looks at a single item. No phase
      // is ever transiently fieldless, and finishing the work does not repair it.
      breaks.push({ phase: p.n, break: 'fieldless-checklist', file: `phases/${p.n}/UAT.md` });
      nCriteria += criteria.length;
      nUncovered += criteria.length;
      continue;
    }

    const declared = new Set(criteria.map((c) => c.id));
    const covered = new Set();
    for (const it of items) {
      if (it.criterion !== undefined) {
        const id = String(it.criterion);
        // An item COVERS the id in its `criterion` field.
        if (declared.has(id)) covered.add(id);
        else unknownCriterion.push({ phase: p.n, item: Number(it.k), criterion: id });
        continue;
      }
      // Untraced: no `criterion`, and no `origin` that declares the item has
      // none. `origin: criterion` with no id is still untraced - it names
      // nothing, so it proves nothing.
      if (!ORIGIN_EXEMPT.has(String(it.origin))) {
        untraced.push({ phase: p.n, item: Number(it.k), name: String(it.name) });
      }
    }
    nCriteria += criteria.length;
    nCovered += covered.size;
    for (const c of criteria) {
      if (covered.has(c.id)) continue;
      nUncovered++;
      // An UNCHECKED roadmap box means the phase has not reached verification
      // yet, so its uncovered criteria are counted but never break: a gate run
      // mid-cycle must not FAIL on work still in flight.
      if (p.checked) breaks.push({ phase: p.n, id: c.id, break: 'uncovered' });
    }
  }

  ok({
    // FIRST key, and always present: a statement about the run, not an optional
    // finding. BOTH halves are reported (D-03) because neither is sufficient
    // alone - mid-cycle the manifest names the last RELEASED version (`2.0.0`
    // today, on a tree running v2.1.0-dev code), so `uat_fields` is the half
    // that does not lag, while `plugin` is the half that names what a user
    // actually has installed.
    //
    // The skew this exists for is a MODERN seam reporting green over an old
    // file (D-04). The opposite skew already fails loudly: `v1.5.0`'s
    // planning.mjs has no `criteria-coverage` subcommand at all, so an old seam
    // returns `ok:false, reason:"usage"` rather than a quiet pass. What had no
    // signal was a stale `${CLAUDE_PLUGIN_ROOT}`-resolved cache silently
    // downgrading this gate, which is the unclosed half of phase 5's human
    // verify: record the plugin version the check runs against.
    version: { plugin: pluginVersion(), uat_fields: UAT_FIELDS_VERSION },
    phases,
    ...(breaks.length ? { breaks } : {}),
    ...(untraced.length ? { untraced } : {}),
    ...(legacy.length ? { legacy } : {}),
    ...(unknownCriterion.length ? { unknown_criterion: unknownCriterion } : {}),
    ...(contextIssues.length ? { context_issues: contextIssues } : {}),
    // `criteria === covered + uncovered` holds by construction, and it is what
    // legacy phases are held OUT of these counts to preserve - the same pinned
    // identity `audit`'s `total = traced + broken + deferred` carries above.
    // `uncovered` is the count; `breaks` is the subset of it whose phase box is
    // checked, which is why the two can differ mid-cycle.
    counts: {
      criteria: nCriteria,
      covered: nCovered,
      uncovered: nUncovered,
      untraced: untraced.length,
      phases: phases.length,
    },
  });
}

// ---------------------------------------------------------------------------
// plan-overlap - the parallel-safety invariant as arithmetic. Intersects the
// declared file lists of a phase's plans pairwise; cad-execute's choose_path
// requires empty overlaps before dispatching plans concurrently. Overlaps
// found is still ok:true - a successful check with a negative answer; the
// caller branches on overlaps.length, like drift in status.
// ---------------------------------------------------------------------------
// The two size facts a phase carries, both COUNTS against integers, because
// both were soft until v2.7.0 and both were ignored. Measured case: a phase
// naming 25 of a project's 46 requirements was planned as 8 tasks against a
// configured ceiling of 4, by a planner told the ceiling and a checker told to
// flag the overrun. Two model-judgment gates missed a comparison a grep makes.
//
// Deliberately ONE subcommand for two questions, because they are asked at the
// same moment and the answer to the first predicts the second: an oversized
// phase is why a plan overruns its task ceiling, so reporting them apart would
// hand the caller two verdicts to reconcile.
//
// `--max-reqs` and `--max-tasks` are the CALLER's resolved values; this seam
// reads no config for them. workflows/plan.md already batches a config read at
// its parse step, so a second reader here would be a second place for the
// resolved ceiling to disagree with the one the planner was handed.
function cmdPlanSize(dir, opts) {
  const parsedPhase = requirePhaseArg(opts.phase);
  if (!parsedPhase.ok) return fail('bad-args', 'plan-size needs --phase <N>');
  const n = parsedPhase.value;

  // Resolved to plain numbers at the boundary, never carried as the
  // requireInt envelope: a `{ok:false}` arm surviving into the comparisons
  // below is the shape @ts-check refuses, and rightly.
  let maxTasks = null;
  if (opts['max-tasks'] !== undefined) {
    const parsed = requireInt(opts['max-tasks']);
    if (!parsed.ok) return fail('bad-args', '--max-tasks must be an integer');
    maxTasks = parsed.value;
  }
  let maxReqs = null;
  if (opts['max-reqs'] !== undefined) {
    const parsed = requireInt(opts['max-reqs']);
    if (!parsed.ok) return fail('bad-args', '--max-reqs must be an integer');
    maxReqs = parsed.value;
  }

  const roadmap = read(join(dir, 'ROADMAP.md')) || '';
  const phase = phaseRequirements(roadmap, parsedPhase.raw);

  // The DIRECTORY is the caller's spelling; only the echoed `phase` is the
  // number (D-02).
  const pdir = join(dir, 'phases', parsedPhase.raw);
  const { plans: planFiles } = listPlanFiles(pdir);
  const plans = planFiles.map((f) => ({ plan: f, tasks: planTaskTitles(read(join(pdir, f)) || '').length }));
  const tasks = plans.reduce((a, p) => a + p.tasks, 0);

  const over = [];
  // Both ceilings are CONDITIONAL, so a verdict has to say whether anything
  // was compared at all. `compared` names the ceilings that actually ran; an
  // empty one makes `within` null below, because `within: true` beside
  // `requirements_found: false` reported a comparison that never happened.
  const reqsCompared = maxReqs !== null && phase.found;
  const tasksCompared = maxTasks !== null && plans.length > 0;
  const compared = [];
  if (reqsCompared) compared.push('max_reqs');
  if (tasksCompared) compared.push('max_tasks');

  // Absence is not zero (D-05): a roadmap with no detail block for this phase
  // reports found:false and is never compared, because a phase nobody wrote
  // down is not a small one.
  if (reqsCompared && phase.ids.length > maxReqs) {
    over.push({ kind: 'phase-too-big', measured: phase.ids.length, ceiling: maxReqs,
      detail: `phase ${n} names ${phase.ids.length} requirements, ceiling ${maxReqs}` });
  }
  // PER PLAN, not per phase, and the ambiguity was real: the key is named
  // `max_plan_tasks` while workflows/plan.md said "delivering this PHASE needs
  // more than that many tasks". Measured, a tree read it both ways - one phase
  // shipped 8 tasks in one plan, the next shipped 4+4+4 across three. Per-plan
  // is the reading that makes the remedy obvious: a plan over its ceiling
  // splits into more plans inside the same phase, which is a move the phase
  // already supports sequentially.
  //
  // Only once a plan EXISTS. An unwritten plan has zero tasks, and zero is
  // under every ceiling, so comparing before the planner runs would report a
  // clean phase for a plan nobody has written.
  if (tasksCompared) {
    for (const p of plans) {
      if (p.tasks <= maxTasks) continue;
      over.push({ kind: 'plan-too-many-tasks', plan: p.plan, measured: p.tasks,
        ceiling: maxTasks,
        detail: `phase ${n} ${p.plan} carries ${p.tasks} tasks, ceiling ${maxTasks}` });
    }
  }

  ok({
    phase: n,
    requirements: phase.ids.length,
    requirements_found: phase.found,
    ...(phase.ids.length ? { requirement_ids: phase.ids } : {}),
    plans,
    tasks,
    ...(maxReqs !== null ? { max_reqs: maxReqs } : {}),
    ...(maxTasks !== null ? { max_tasks: maxTasks } : {}),
    over,
    compared,
    within: compared.length ? over.length === 0 : null,
  });
}

// ---------------------------------------------------------------------------
// criteria-size - the criteria-count ceilings three workflows state in PROSE,
// as arithmetic. `context.md:281` says 3-7 acceptance criteria, `new-project.md`
// and `adopt.md` say 2-5 success criteria per roadmap phase, and nothing has
// ever counted either: the whole measured lesson of this phase is that a prose
// rule a model is asked to follow fails silently while a count does not.
//
// TWO grammars in one call, because the ceilings live in two files and only one
// of them had a reader (D-01): CONTEXT's `## Acceptance criteria` through
// `classifyAcceptanceCriteria` (already the reader `criteria-coverage` counts
// per phase) and ROADMAP's per-phase criteria list through `phaseCriteria`. A
// single-parser design would report not-found for every roadmap phase and ship
// the new-project/adopt half with no enforcement at all - the exact silent
// no-op this seam exists to remove.
//
// The four ceilings are the CALLER's literal numbers, arriving as flags, and
// are NOT config keys (D-04) - the same rule `plan-size` states above, for the
// same reason: two keys would each need a config.schema.json entry, a
// config-catalog row and a config-reach row to express a shape rule about
// planning documents rather than a per-project preference.
//
// A REPORT, never a gate: `over` names the phase, its measured count and the
// bound it broke, and the workflow decides - exactly as `plan-size`'s
// `phase-too-big` is presented and acted on by prose.
const CRITERIA_CEILINGS = [
  { flag: 'context-min', name: 'context_min', source: 'context', bound: 'min' },
  { flag: 'context-max', name: 'context_max', source: 'context', bound: 'max' },
  { flag: 'roadmap-min', name: 'roadmap_min', source: 'roadmap', bound: 'min' },
  { flag: 'roadmap-max', name: 'roadmap_max', source: 'roadmap', bound: 'max' },
];

function cmdCriteriaSize(dir, opts) {
  // Resolved to plain numbers at the boundary, never carried as the requireInt
  // envelope - the same shape rule cmdPlanSize states.
  /** @type {Record<string, number|null>} */
  const ceiling = {};
  for (const c of CRITERIA_CEILINGS) {
    ceiling[c.name] = null;
    if (opts[c.flag] === undefined) continue;
    const parsed = requireInt(opts[c.flag]);
    if (!parsed.ok) return fail('bad-args', `--${c.flag} must be an integer`);
    ceiling[c.name] = parsed.value;
  }

  const roadmapText = read(join(dir, 'ROADMAP.md'));
  if (roadmapText === null) return fail('no-roadmap', `${join(dir, 'ROADMAP.md')} not found`);

  // `--phase` present scopes to one phase, in the CALLER's spelling (D-02);
  // absent walks every phase the roadmap declares, through the same
  // `parseRoadmapPhases` list `cmdCriteriaCoverage` walks - so a caller that
  // just wrote a whole roadmap checks all of it in ONE call, which is what
  // new-project and adopt need at their approval gate.
  let targets;
  if (opts.phase !== undefined) {
    const parsedPhase = requirePhaseArg(opts.phase);
    if (!parsedPhase.ok) return fail('bad-args', 'criteria-size --phase needs a phase number');
    targets = [{ n: parsedPhase.value, raw: parsedPhase.raw }];
  } else {
    targets = parseRoadmapPhases(roadmapText).map((p) => ({ n: p.n, raw: String(p.n) }));
  }

  const phases = [];
  const over = [];
  const comparedNames = new Set();

  for (const t of targets) {
    const roadmap = phaseCriteria(roadmapText, t.raw);
    const contextText = read(join(dir, 'phases', t.raw, 'CONTEXT.md'));
    // `criteria: null` is BOTH an absent `## Acceptance criteria` heading and a
    // near-miss one, and neither is zero: the second means this reader never
    // walked the section, so what the phase declares is not known here.
    const classified = contextText === null ? null : classifyAcceptanceCriteria(contextText);
    const contextCriteria = classified && classified.criteria ? classified.criteria : null;

    phases.push({
      phase: t.n,
      context_criteria: contextCriteria ? contextCriteria.length : 0,
      context_found: contextCriteria !== null,
      roadmap_criteria: roadmap.count,
      roadmap_found: roadmap.found,
    });

    for (const c of CRITERIA_CEILINGS) {
      const limit = ceiling[c.name];
      if (limit === null) continue;
      // Absence is not zero (D-03): a source that declared nothing is never
      // compared, because zero criteria under a floor of 3 would report every
      // unwritten CONTEXT.md as a defect in the document nobody has written.
      const found = c.source === 'context' ? contextCriteria !== null : roadmap.found;
      if (!found) continue;
      comparedNames.add(c.name);
      const measured = c.source === 'context' ? contextCriteria.length : roadmap.count;
      if (c.bound === 'min' ? measured >= limit : measured <= limit) continue;
      over.push({
        kind: `${c.source}-criteria-too-${c.bound === 'min' ? 'few' : 'many'}`,
        phase: t.n,
        measured,
        ceiling: limit,
        detail: `phase ${t.n} declares ${measured} ${c.source} criteria, `
          + `${c.bound === 'min' ? 'floor' : 'ceiling'} ${limit}`,
      });
    }
  }

  // The conditional-comparison envelope, not a bare boolean (D-03). `compared`
  // names the ceilings that ACTUALLY ran against a source that was found; an
  // empty one makes `within` null, because `ok:true, within:true` having
  // compared nothing reproduces inside this seam the very defect it was built
  // to report.
  const compared = CRITERIA_CEILINGS.filter((c) => comparedNames.has(c.name)).map((c) => c.name);
  ok({
    ...(opts.phase !== undefined ? { phase: targets[0].n } : {}),
    phases,
    ...Object.fromEntries(CRITERIA_CEILINGS
      .filter((c) => ceiling[c.name] !== null).map((c) => [c.name, ceiling[c.name]])),
    over,
    compared,
    within: compared.length ? over.length === 0 : null,
  });
}

function cmdPlanOverlap(dir, opts) {
  const parsedPhase = requirePhaseArg(opts.phase);
  if (!parsedPhase.ok) return fail('bad-args', 'plan-overlap needs --phase <N>');
  const n = parsedPhase.value;
  // The DIRECTORY is the caller's spelling; only the echoed `phase` below is
  // the number (D-02).
  const pdir = join(dir, 'phases', parsedPhase.raw);
  const { plans: planFiles, nonconforming, missing } = listPlanFiles(pdir);
  if (missing) return fail('no-phase-dir', `${pdir} not found`);

  // Parsed BEFORE the fewer-than-two-plans early return, so a one-plan
  // phase's grammar diagnostic still reaches this envelope instead of being
  // skipped along with the intersection this early return has nothing to do.
  const declared = planFiles.map((f) => {
    const { files, issues } = parsePlanFiles(read(join(pdir, f)) || '');
    return { plan: f, files, issues };
  });
  const frontmatterIssues = declared
    .filter((d) => d.issues.length)
    .map((d) => ({ plan: d.plan, issues: d.issues }));

  if (planFiles.length < 2) {
    return ok({
      phase: n, plans: [], overlaps: [],
      note: 'fewer than two plans - nothing to intersect',
      ...(nonconforming.length ? { nonconforming_plans: nonconforming } : {}),
      ...(frontmatterIssues.length ? { frontmatter_issues: frontmatterIssues } : {}),
    });
  }
  // Containment is `lib/lease-grammar.mjs`'s to answer, never this function's:
  // exact string equality here is what let a phase declaring `src/` in one plan
  // and `src/auth.js` in another report an EMPTY overlap, pass this gate, and
  // then be refused plan by plan at `lease-check`, which reads the trailing
  // slash as a directory prefix. Two readers of one declaration, one module.
  //
  // BOTH spellings of a collision ride `files` as separate strings (D-06): the
  // covering declaration and the covered one are different strings and the
  // caller needs to see the pair it must resolve. An exact match contributes
  // ONE string, because `seen` is shared across the two passes.
  //
  // The emission ORDER is plan i's declarations in declaration order, then plan
  // j's, so the reported list is the same on every run.
  const collect = (from, against, into, seen) => {
    for (const f of from) {
      if (!against.some((g) => intersects(f, g))) continue;
      if (seen.has(f)) continue;
      seen.add(f);
      into.push(f);
    }
  };
  const overlaps = [];
  for (let i = 0; i < declared.length; i++) {
    for (let j = i + 1; j < declared.length; j++) {
      const shared = [];
      const seen = new Set();
      collect(declared[i].files, declared[j].files, shared, seen);
      collect(declared[j].files, declared[i].files, shared, seen);
      if (shared.length) overlaps.push({ plans: [declared[i].plan, declared[j].plan], files: shared });
    }
  }
  const undeclared = declared.filter((d) => !d.files.length).map((d) => d.plan);
  ok({
    phase: n,
    plans: declared.map((d) => ({ plan: d.plan, files: d.files.length })),
    overlaps,
    // A plan declaring no files cannot be proven independent - the check is
    // only as strong as the declarations. The caller treats these as unsafe.
    ...(undeclared.length ? { undeclared } : {}),
    ...(nonconforming.length ? { nonconforming_plans: nonconforming } : {}),
    ...(frontmatterIssues.length ? { frontmatter_issues: frontmatterIssues } : {}),
  });
}

// ---------------------------------------------------------------------------
// seed-reqs - insert Traceability rows for the requirement ids a phase's
// plan(s) declare, bounded by ## Active (D-02/D-04/D-05/D-06). Called by
// /cad-plan right where the plan is written - the write path this table
// never had (git log -S Traceability shows status-flip-only since c34ec8a).
// ---------------------------------------------------------------------------
function cmdSeedReqs(dir, opts) {
  const parsedPhase = requirePhaseArg(opts.phase);
  if (!parsedPhase.ok) return fail('bad-args', 'seed-reqs needs --phase <N>');
  // Before any read and before any write: the two halves of the phase argument
  // must agree here, because this face uses BOTH.
  const spelling = phaseSpellingRefusal(parsedPhase);
  if (spelling) return fail('bad-args', `seed-reqs ${spelling}`);
  const n = parsedPhase.value;
  // The caller's own spelling, for the directory and for every diagnostic that
  // names one (D-02). The Traceability rows and the echoed `phase` below stay
  // NUMERIC because `parseRequirements` and `audit` compare that cell against
  // ROADMAP phase NUMBERS. What used to be a KNOWN identity collision carried
  // here as a cost - `seed-reqs --phase 1.10` reading `phases/1.10` and writing
  // `| <id> | Phase 1.1 | Pending |`, merging the two sub-phases in the audit -
  // is refused above instead (D-07), so the spelling that reaches `pname` is
  // the one the numeric half names.
  const pname = parsedPhase.raw;

  // #42/#45 rail: the flag is validated before any read.
  const reqFile = join(dir, 'REQUIREMENTS.md');
  const reqText = read(reqFile);
  if (reqText === null) return fail('no-requirements', `${reqFile} not found`);

  const pdir = join(dir, 'phases', pname);
  let planFiles = [];
  try { planFiles = readdirSync(pdir).filter((f) => /^PLAN(-\d+)?\.md$/.test(f)).sort(); }
  catch { return fail('no-phase-dir', `${pdir} not found`); }
  if (!planFiles.length) return fail('no-plans', `no PLAN(-N).md under ${pdir}`, `/cad-plan ${pname}`);

  // Ids in plan-file order, union first-occurrence-wins across the phase's
  // plan(s); frontmatter issues carried in the same {file, issues} shape
  // cmdAudit emits, so a malformed requirements: line is loud at the moment
  // its ids are being written, not only at the next audit.
  const ids = [];
  const seenIds = new Set();
  const frontmatterIssues = [];
  for (const f of planFiles) {
    const { ids: fileIds, issues } = parsePlanRequirements(read(join(pdir, f)) || '');
    for (const id of fileIds) if (!seenIds.has(id)) { seenIds.add(id); ids.push(id); }
    if (issues.length) frontmatterIssues.push({ file: `phases/${pname}/${f}`, issues });
  }

  // Bound by ## Active (D-06): an id with no bullet there is scope creep or
  // a typo and stays an orphans.plan_ids entry on purpose, never seeded.
  const activeIds = parseActiveIds(reqText);
  const noActiveSection = activeIds === null;
  const activeSet = new Set(activeIds || []);
  const rows = [];
  const orphanIds = [];
  for (const id of ids) {
    if (activeSet.has(id)) rows.push({ id, phase: n });
    else orphanIds.push(id);
  }

  const res = insertReqRows(reqText, rows);
  if (res.error) return fail('no-traceability-table', `${reqFile} has no "## Traceability" table with a header separator`);
  if (res.inserted.length) atomicWrite(reqFile, res.text);

  // seeded/skipped are ALWAYS present, even empty - contrary to the
  // envelope's omit-empty convention and deliberately so (uat merge's
  // always-present counts precedent): a bookkeeping step that has now
  // failed twice by writing nothing must report writing nothing.
  ok({
    phase: n,
    seeded: res.inserted,
    skipped: res.skipped,
    ...(res.mismatched.length ? { mismatched: res.mismatched } : {}),
    ...(orphanIds.length ? { orphan_ids: orphanIds } : {}),
    ...(frontmatterIssues.length ? { frontmatter_issues: frontmatterIssues } : {}),
    ...(noActiveSection ? { no_active_section: true } : {}),
  });
}

// ---------------------------------------------------------------------------
// recall - BM25 retrieval over the .planning/ artifacts Cadence writes but
// never read back (SUMMARY deviations, CAPTURE items, UAT findings, CONTEXT
// decisions). Zero-dep, deterministic (sorted corpus traversal + a total
// result order, no timestamps): same corpus + same query -> byte-identical
// output. Gated by memory.backend; `none` reports off with empty results. An
// empty or absent corpus is ok:true with results:[] - recall never blocks the
// spine, so it is safe to call before any phase has produced artifacts.
// ---------------------------------------------------------------------------
function cmdRecall(dir, query, opts) {
  if (!query) return fail('bad-args', 'recall needs a query');

  // --top bounds the RETURNED set, default 5. Unbounded was the original
  // shape and it is what makes this seam expensive to call: a real query on
  // this repo's corpus returned 72 results at 55.8 KB, which the host spools
  // to a file with a 2 KB preview, so the caller pays the emit AND a second
  // round trip to read back the five hits it wanted. Every call site in the
  // workflows already says "one line per TOP result"; nothing consumes the
  // tail. `total` rides the envelope so a truncated answer stays legible as
  // truncated - absence and silence are different answers here as everywhere.
  let top = 5;
  if (opts.top !== undefined) {
    const parsed = requireInt(opts.top);
    if (!parsed.ok || parsed.value < 1) {
      return fail('bad-args', '--top must be a positive integer');
    }
    top = parsed.value;
  }

  // memory.backend, effective across the config layers (repo > global);
  // schema default is builtin, so an unset key recalls. `none` is the off
  // switch - a successful check with a negative answer, like plan-overlap.
  //
  // warnings[] rides the envelope, present only when non-empty so the ordinary
  // byte-stable output is unchanged: a torn layer reads memory.backend as
  // absent, which defaults to `builtin`, so a project that deliberately set
  // `none` would silently start recalling again - and the reverse reading, an
  // empty result set, is indistinguishable from a corpus with no hits.
  const { config: recallConfig, warnings } = mergeLayers(join(dir, 'config.json'));
  const warn = warnings.length ? { warnings } : {};
  const backend = recallConfig?.memory?.backend ?? 'builtin';
  if (backend === 'none') return ok({ backend: 'none', results: [], total: 0, ...warn });

  // Corpus assembly in a fixed order: phases ascending (decimal-aware), each
  // phase's SUMMARY then UAT then CONTEXT, then the top-level CAPTURE. The
  // listing itself is guarded - an absent .planning or phases/ is empty data,
  // never an ENOENT throw (which the dispatch catch would turn into a
  // fail('internal'), breaking the empty-corpus contract).
  const corpus = [];
  const phasesDir = join(dir, 'phases');
  if (existsSync(phasesDir)) {
    const entries = readdirSync(phasesDir)
      .filter((e) => /^\d+(?:\.\d+)?$/.test(e))
      .sort((a, b) => Number(a) - Number(b));
    for (const n of entries) {
      const pdir = join(phasesDir, n);
      const phase = Number(n);
      const summary = read(join(pdir, 'SUMMARY.md'));
      if (summary) for (const text of parseSummarySnippets(summary)) {
        corpus.push({ text, source: `phases/${n}/SUMMARY.md`, phase });
      }
      const uatText = read(join(pdir, 'UAT.md'));
      if (uatText) for (const it of parseUat(uatText).items) {
        const text = `${it.name || ''} ${it.expected || ''}`.trim();
        if (text) corpus.push({ text, source: `phases/${n}/UAT.md`, phase });
      }
      const context = read(join(pdir, 'CONTEXT.md'));
      if (context) for (const text of parseContextDecisions(context)) {
        corpus.push({ text, source: `phases/${n}/CONTEXT.md`, phase });
      }
    }
  }
  const capture = read(join(dir, 'CAPTURE.md'));
  if (capture) for (const item of parseCaptureSnippets(capture)) {
    corpus.push({ text: item.text, source: 'CAPTURE.md',
      ...(item.phase !== undefined ? { phase: item.phase } : {}) });
  }
  // ARCHIVE.md LAST, and the position is load-bearing: `search()` orders hits
  // by (score desc, corpus position asc), so appending here leaves every
  // existing corpus index where it was and a tree with no ARCHIVE.md emits the
  // bytes it emitted before this walk existed. Read through the same guarded
  // `read()` the CAPTURE walk uses - an absent file is empty data, never an
  // ENOENT throw, which is what the empty-corpus contract rests on.
  //
  // ONE flat ranking with the live rows (D-05): no recency term, no per-source
  // cap, archived rows competing on score alone. Measured 2026-08-16 over a
  // 265-to-986-snippet rebuild, archived rows took 2, 1, 3 and 3 of the top 5
  // on four representative queries and displaced the live CAPTURE.md hit from
  // rank 1 twice. That crowding is the accepted cost: each row names its
  // milestone in `source` so the caller discounts retired work itself, which is
  // a judgment it can make and a cap's N cannot - no measured basis exists for
  // one.
  const archive = read(join(dir, 'ARCHIVE.md'));
  if (archive) for (const row of parseArchiveRows(archive)) corpus.push(row);

  if (!corpus.length) return ok({ results: [], total: 0, ...warn });

  // search() returns [{i, score}] in (score desc, corpus position asc) order -
  // already total because the corpus is in sorted traversal order, so do NOT
  // re-sort. Round the score so stdout is byte-stable across the Node matrix.
  const index = buildIndex(corpus.map((c) => c.text));
  const matched = search(index, query);
  const results = matched.slice(0, top).map(({ i, score }) => {
    const c = corpus[i];
    return {
      score: Math.round(score * 1e4) / 1e4,
      source: c.source,
      ...(c.phase !== undefined ? { phase: c.phase } : {}),
      snippet: c.text,
    };
  });
  ok({ results, total: matched.length, ...warn });
}

// ---------------------------------------------------------------------------
// lease-check - the file lease Cadence already DECLARES, enforced. A plan's
// `files:` list is what the parallel-safety gate proves independence from, and
// until now nothing stopped an executor staging a path its own plan never
// named - which silently invalidates that proof for every OTHER plan in the
// phase.
//
// A seam and NOT a PreToolUse hook on Write/Edit (D-01): the hook fires on
// every write in every project the plugin is installed in, and it cannot
// reliably resolve WHICH plan is writing - the branch name is the only signal
// and it is absent on the sequential path and on orchestrator writes. A rail
// that fires wrong gets deleted, not tuned. The seam form covers the sequential
// path too, which the criterion does not require but gets free.
//
// The reader is `parsePlanFiles`, the SAME one cmdPlanOverlap uses, and
// containment is `lib/lease-grammar.mjs`, the same module it asks - so a path
// the pre-flight overlap gate admitted cannot be refused here and vice versa.
// That claim used to be made of the READER alone, and it was false of the
// comparison: the gate intersected two declared lists by exact string equality
// while this step read a trailing slash as a directory prefix, so a phase
// declaring `src/` in one plan and `src/auth.js` in another passed the
// parallel-safety gate and was then refused right here. One module makes it
// true of both halves.
// `declaredPhaseFiles` is the wrong reader: it unions across the PHASE, which
// would let plan 2 stage a file only plan 1 declared.
//
// An unprovable lease is never a pass: a missing plan and an unreadable staged
// set are both ok:false.
//
// Why the CLEAN-STARTING-INDEX check is not here either (moved out of
// `workflows/execute.md`'s git_guard step, v2.6.2): the orchestrator is the only
// actor that can see a clean starting index, because it runs once before
// anything stages anything. This seam reads the whole staged index and has no
// provenance signal - it cannot tell a path the user staged before the run from
// a path this executor staged and did not declare - so a gate placed here could
// only refuse the user's work (halting the phase on files no plan touched) or
// excuse an unknown path (which is no gate). Start the index clean and both
// readings collapse into one: every later `undeclared-files` refusal is provably
// the executor's own doing.
//
// The staged set is read with `--name-status -z -M`, and each of those three is
// load-bearing:
//   -z          git emits paths VERBATIM and unquoted. Without it, at git's
//               default `core.quotePath` a declared `src/café.js` comes back as
//               `"src/caf\303\251.js"` and the lease refuses a path it was
//               itself handed. No `core.quotePath` override is needed, and none
//               should be added.
//   --name-status  a rename carries BOTH sides. `--name-only` reports only the
//               destination, so `git mv src/other.js a.txt` reads as a clean
//               lease while destroying a file some OTHER plan declared.
//   -M          explicit, because `diff.renames` is user-settable config and a
//               gate whose coverage depends on the caller's git config is not a
//               gate.
//
// That stream is read as BYTES and split on 0x00 at the byte level, because
// `execFileSync(..., {encoding:'utf8'})` maps every invalid UTF-8 byte to
// U+FFFD and undoes `-z` one layer below it: `git mv src/caf<0xE9>.js
// src/caf<0xFF>.js` is emitted correctly and paired correctly, then both sides
// decode to the SAME `src/caf<U+FFFD>.js`, collapse in the dedup, and the
// rename source - another plan's file, being destroyed - is licensed by the
// destination's declaration.
//
// So every path must ROUND-TRIP (`Buffer.from(s,'utf8').equals(raw)`), and a
// staged path that does not is a REFUSAL of its own naming that path, not a
// guess. The declared side is read from a utf8 plan file and cannot represent
// such a path either, so neither side of the comparison can be honest about it;
// admitting it on the U+FFFD spelling would silently license every sibling
// differing only in its invalid bytes. Making the DECLARED side byte-aware was
// rejected: the frontmatter reader is shared with the overlap gate, and a lease
// that reads what a plan file cannot write is a wider change than this gate.
// ---------------------------------------------------------------------------

/** A path made repo-relative and separator-normalized, for comparison with git. */
function repoRel(top, p) {
  return relative(top, resolvePath(p)).split(sep).join('/');
}

/**
 * Split a NUL-separated stream into its raw field buffers, byte-exactly.
 *
 * @param {Buffer} buf
 * @returns {Buffer[]}
 */
function splitNul(buf) {
  /** @type {Buffer[]} */
  const fields = [];
  for (let start = 0; ;) {
    const i = buf.indexOf(0, start);
    if (i === -1) { fields.push(buf.subarray(start)); break; }
    fields.push(buf.subarray(start, i));
    start = i + 1;
  }
  return fields;
}

/**
 * The one honest way to NAME a path whose bytes no JSON string can carry:
 * C-style double quotes with every byte outside printable ASCII written as a
 * three-digit octal escape, the same spelling git's own `core.quotePath` uses
 * for high bytes - so `src/caf<0xE9>.js` reads back as `"src/caf\351.js"`.
 *
 * @param {Buffer} raw
 * @returns {string}
 */
function quoteRawPath(raw) {
  let s = '';
  for (const b of raw) {
    if (b === 0x22 || b === 0x5c) s += `\\${String.fromCharCode(b)}`;
    else if (b >= 0x20 && b < 0x7f) s += String.fromCharCode(b);
    else s += `\\${b.toString(8).padStart(3, '0')}`;
  }
  return `"${s}"`;
}

/**
 * Parse a `git diff --cached --name-status -z -M` stream into staged entries.
 *
 * Records are NUL-separated fields, not NUL-separated LINES: a status token
 * starting with `R` (rename) or `C` (copy) consumes TWO following paths, source
 * then destination; every other status consumes one.
 *
 * The input is a BUFFER and the split is on the 0x00 BYTE: decoding first would
 * fold every invalid UTF-8 byte onto U+FFFD and make two different paths read
 * as one. Each path is decoded and checked to round-trip back to the same
 * bytes; the ones that do not are returned under `unrepresentable`, already in
 * their `quoteRawPath` spelling, for the caller to refuse by name.
 *
 * Returns null on a truncated or otherwise unparseable stream, which the caller
 * turns into `no-staged-set` - an unprovable lease is never a pass.
 *
 * @param {Buffer} out
 * @returns {{
 *   entries: {path: string, status: string, source: string|null}[],
 *   unrepresentable: string[],
 * } | null}
 */
function parseStagedNameStatus(out) {
  const fields = splitNul(out);
  // A -z stream terminates every field with a NUL, so the tail split is empty.
  if (fields.length && fields[fields.length - 1].length === 0) fields.pop();
  /** @type {{path: string, status: string, source: string|null}[]} */
  const entries = [];
  /** @type {string[]} */
  const unrepresentable = [];
  /** A path decoded, or null when its bytes are not valid UTF-8. */
  const decodePath = (/** @type {Buffer} */ raw) => {
    const s = raw.toString('utf8');
    if (!Buffer.from(s, 'utf8').equals(raw)) {
      unrepresentable.push(quoteRawPath(raw));
      return null;
    }
    return s;
  };
  for (let i = 0; i < fields.length;) {
    const status = fields[i++].toString('utf8');
    if (!status) return null;
    const paired = status[0] === 'R' || status[0] === 'C';
    if (i + (paired ? 2 : 1) > fields.length) return null;
    const rawSource = paired ? fields[i++] : null;
    const rawPath = fields[i++];
    if (rawPath.length === 0 || (rawSource !== null && rawSource.length === 0)) return null;
    const source = rawSource === null ? null : decodePath(rawSource);
    const path = decodePath(rawPath);
    // A path that did not round-trip is already recorded under
    // `unrepresentable`; keeping a U+FFFD spelling in `entries` beside it is
    // exactly the guess this refuses to make.
    if (path === null || (rawSource !== null && source === null)) continue;
    entries.push({ path, status, source });
  }
  return { entries, unrepresentable };
}

function cmdLeaseCheck(dir, opts) {
  const parsedPhase = requirePhaseArg(opts.phase);
  if (!parsedPhase.ok) return fail('bad-args', 'lease-check needs --phase <N>');
  const parsedPlan = requireInt(opts.plan);
  if (!parsedPlan.ok) return fail('bad-args', 'lease-check needs --plan <k>');
  const n = parsedPhase.value;
  const k = parsedPlan.value;

  // `k` is the number in PLAN-<k>.md, and 1 for a bare PLAN.md - the same
  // convention the executor's report path follows.
  //
  // The phase DIRECTORY is the caller's own spelling (D-02): `--phase 1.10`
  // leased against `phases/1.1/PLAN.md` and passed a gate the wrong plan file
  // declared. `common.phase` below stays the number.
  const pdir = join(dir, 'phases', parsedPhase.raw);
  let planFile = join(pdir, `PLAN-${k}.md`);
  let text = read(planFile);
  if (text === null && k === 1) {
    planFile = join(pdir, 'PLAN.md');
    text = read(planFile);
  }
  if (text === null) {
    return fail('no-plan', `no PLAN-${k}.md or PLAN.md under ${pdir}`, `/cad-plan ${parsedPhase.raw}`);
  }
  const { files: declared, issues } = parsePlanFiles(text);

  let top;
  /** @type {Buffer} */
  let stagedOut;
  try {
    top = execFileSync('git', ['rev-parse', '--show-toplevel'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    // NO `encoding` on THIS call, deliberately: paths are bytes, and decoding
    // them here is what would undo `-z` (see the block comment above).
    stagedOut = execFileSync('git',
      ['-C', top, 'diff', '--cached', '--name-status', '-z', '-M'],
      { stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    return fail('no-staged-set',
      `could not read the staged set: ${redactUrl(e && e.message ? e.message : String(e))}`);
  }
  const parsed = parseStagedNameStatus(stagedOut);
  if (parsed === null) {
    return fail('no-staged-set',
      'the staged set could not be parsed: git --name-status -z returned a truncated record');
  }
  if (parsed.unrepresentable.length) {
    // Fail CLOSED, and name the path rather than guess at it: neither the
    // staged side nor the declared side can spell these bytes, so the gate says
    // so instead of matching two replacement characters.
    return emit({
      ok: false,
      reason: 'unrepresentable-paths',
      phase: n,
      plan: k,
      plan_file: repoRel(top, planFile),
      unrepresentable: parsed.unrepresentable,
      hint: 'these staged paths are not valid UTF-8 and no plan file can name them'
        + ' - rename or unstage them, then re-run',
    });
  }
  // BOTH sides of a rename are checked: only the destination is the executor's
  // new file, and the SOURCE is the one another plan may have declared.
  // `staged` counts the distinct paths involved, so a rename counts as two.
  const staged = [...new Set(parsed.entries.flatMap(
    (e) => (e.source === null ? [e.path] : [e.source, e.path])))];

  // Exactly ONE exemption, and nothing else: the plan's own report file, which
  // the contract requires the executor to write and which no plan declares.
  const reportFile = repoRel(top, join(pdir, 'reports', `plan-${k}.md`));

  // What a declaration covers is `lib/lease-grammar.mjs`'s answer and not this
  // function's - the same module `cmdPlanOverlap` asks, which is the whole
  // point. The grammar itself (directory lease by trailing slash, everything
  // else byte-identical, and why `src/auth` must never license
  // `src/authority.rs`) is stated in that module's header, once: a second copy
  // here is exactly how the two seams came to disagree, with the pre-flight
  // gate admitting a plan pair this step then refused to separate.
  //
  // The staged side is NOT re-normalized on its way in (D-08): it arrives
  // canonical through `repoRel`, and a second transform over paths that
  // round-tripped through the byte-level guard above is how the non-ASCII hard
  // block gets re-broken.
  const undeclared = staged.filter((p) => p !== reportFile
    && !declared.some((d) => covers(d, p)));

  const common = {
    phase: n,
    plan: k,
    plan_file: repoRel(top, planFile),
    staged: staged.length,
    declared: declared.length,
    ...(issues.length ? { frontmatter_issues: issues } : {}),
  };
  if (undeclared.length) {
    // Emitted directly: fail()'s reason/detail/hint shape has no channel for
    // the offending list, and the list is the whole point of the refusal.
    return emit({
      ok: false,
      reason: 'undeclared-files',
      ...common,
      undeclared,
      hint: `add these paths to ${common.plan_file}'s files: list, or unstage them`,
    });
  }
  ok(common);
}

// ---------------------------------------------------------------------------
// detect-commands - the static-analysis path for a repo that configured
// NOTHING. A seam and not executor judgment (D-04): the criterion asserts
// behaviour "in a repo that configured nothing", and nothing in CI can prove a
// judgment fired, where a seam is testable on fixture trees and carries a
// CONTRACTS row.
//
// `--root` is the PROJECT root, deliberately NOT `--dir`, which this script
// defines as the planning directory. The root is read ONE DIRECTORY DEEP: no
// recursive walk, no monorepo inference - a command guessed from a nested
// package is a command run in the wrong tree.
//
// Detecting nothing is ok:true with both null - a successful check with a
// negative answer, like plan-overlap. An unreadable or malformed manifest
// contributes nothing and is NAMED in warnings[] rather than throwing.
//
// A MANIFEST IS EVIDENCE OF INTENT, NOT OF A BINARY (RCH-01). A tree carrying
// `[tool.ruff]` says its maintainers chose ruff; it does not say ruff is
// installed on the machine reading it, and this seam's answer is handed to an
// executor that runs it before every commit. So a winning arm is offered only
// when the command's binaries RESOLVE - the driver, plus the delegated tool for
// an `npx` arm, which is where npx itself would look (D-04). An unreachable arm
// NULLS its slot and names the tool in warnings[]; it never falls through to a
// lower arm (D-05), because falling through tells a tree holding `[tool.ruff]`
// and a `go.mod` to run `go vet ./...` - a linter its maintainers did not
// choose, over a language the change may not touch, which is the exact ordering
// rule the ladder below states.
// ---------------------------------------------------------------------------

// The flat-config spellings, in the order they are probed. A legacy `.eslintrc*`
// of any extension is matched after them, by prefix.
const ESLINT_CONFIGS = ['eslint.config.js', 'eslint.config.mjs',
  'eslint.config.cjs', 'eslint.config.ts'];

function cmdDetectCommands(root) {
  /** @type {string[]} */
  const warnings = [];
  /** @type {string[]} */
  let entries;
  try {
    entries = readdirSync(root, { encoding: 'utf8' });
  } catch (e) {
    return fail('no-root', `${root} cannot be listed (${e.code || e.message})`);
  }
  const has = (/** @type {string} */ name) => entries.includes(name);

  // package.json, parsed ONCE for both slots: two parses could disagree about
  // one file, and the warning would then be filed twice for one fault.
  let scripts = {};
  if (has('package.json')) {
    const text = read(join(root, 'package.json'));
    if (text === null) {
      warnings.push('package.json could not be read; no command was taken from it');
    } else {
      try {
        const pkg = JSON.parse(text);
        const s = pkg && typeof pkg === 'object' && !Array.isArray(pkg) ? pkg.scripts : null;
        if (s && typeof s === 'object' && !Array.isArray(s)) scripts = s;
      } catch (e) {
        warnings.push(`package.json failed to parse and was skipped: ${e.message}`);
      }
    }
  }
  /** A script NAME when the manifest carries a usable one, else null. */
  const script = (/** @type {string} */ name) =>
    (typeof scripts[name] === 'string' && scripts[name].trim() ? name : null);

  let pyproject = null;
  if (has('pyproject.toml')) {
    pyproject = read(join(root, 'pyproject.toml'));
    if (pyproject === null) {
      warnings.push('pyproject.toml could not be read; no command was taken from it');
    }
  }
  const pyTable = (/** @type {string} */ t) => pyproject !== null && pyproject.includes(t);

  // First match wins per slot, in the declared order. A project's OWN script
  // beats a tool config in the same tree: the script is what its maintainers
  // run, and the tool config is only what a default would run.
  let lint = null;
  let lintSource = null;
  if (script('lint')) { lint = 'npm run lint'; lintSource = 'package.json'; }
  else if (has('Cargo.toml')) { lint = 'cargo clippy --all-targets -- -D warnings'; lintSource = 'Cargo.toml'; }
  else if (pyTable('[tool.ruff')) { lint = 'ruff check .'; lintSource = 'pyproject.toml'; }
  else if (has('go.mod')) { lint = 'go vet ./...'; lintSource = 'go.mod'; }
  else {
    const cfg = ESLINT_CONFIGS.find((f) => has(f))
      || entries.find((e) => e.startsWith('.eslintrc'));
    if (cfg) { lint = 'npx eslint .'; lintSource = cfg; }
  }

  let typecheck = null;
  let typecheckSource = null;
  const tsScript = script('typecheck') || script('type-check');
  if (tsScript) { typecheck = `npm run ${tsScript}`; typecheckSource = 'package.json'; }
  // TWO exact names, never a `tsconfig*.json` glob. `npx tsc --noEmit` ignores
  // a config it is not pointed at, so a matched name has to bring the `-p` form
  // that points at it - and guessing which of several candidates is THE
  // typecheck would name an editor-only or per-package project file as the
  // project's own. Both literals are fixed strings; no repo content is ever
  // interpolated into a command.
  //
  // Order is the whole reason there are two arms rather than one: a tree
  // carrying both keeps `npx tsc --noEmit` off `tsconfig.json`, because that is
  // the project's own typecheck and the CI file is the narrower one. The second
  // arm exists for the tree that has ONLY the CI file - this repository, which
  // the comment here used to name as the case it declined, and which is exactly
  // the repository whose `.planning/config.json` can no longer supply a lint
  // command from a repo layer (CFG-02).
  else if (has('tsconfig.json')) { typecheck = 'npx tsc --noEmit'; typecheckSource = 'tsconfig.json'; }
  else if (has('tsconfig.ci.json')) { typecheck = 'npx tsc -p tsconfig.ci.json'; typecheckSource = 'tsconfig.ci.json'; }
  else if (has('Cargo.toml')) { typecheck = 'cargo check --all-targets'; typecheckSource = 'Cargo.toml'; }
  else if (pyTable('[tool.mypy')) { typecheck = 'mypy .'; typecheckSource = 'pyproject.toml'; }
  else if (has('go.mod')) { typecheck = 'go build ./...'; typecheckSource = 'go.mod'; }

  // --- reachability (RCH-01) -------------------------------------------------
  //
  // THE OVERRIDE IS GATED, and gated for the reason EXP-01 states: this
  // variable decides which static-analysis command an executor is told to run,
  // and an ungated test hook that changes an enforcement answer is the shape
  // that milestone refused. It is read only when `CADENCE_TEST_SEAM` holds, and
  // read by PRESENCE rather than through `||`: an empty value means "nothing on
  // PATH", which is a set a `||` chain cannot express because it is falsy.
  //
  // Present, it stands in for the WHOLE answer - no filesystem is consulted at
  // all - rather than for the PATH half with the directory probe left live.
  // One rule is what makes the hook testable in both directions: a fixture
  // carrying its own `node_modules/.bin` proves the live probe hermetically
  // (both binaries resolve out of the fixture's own bytes), and the SAME
  // fixture under an empty override proves the variable had force, which a
  // half-replacement could never show. lib/on-path.mjs reads no Cadence
  // variable of its own (see its header); the hook lives here, at the one call
  // site that needs it.
  const reachOverride = testSeamOpen() && 'CADENCE_DETECT_REACHABLE' in process.env
    ? new Set(String(process.env.CADENCE_DETECT_REACHABLE).split(',').map((t) => t.trim()).filter(Boolean))
    : null;
  const nodeBin = join(root, 'node_modules', '.bin');
  const reachable = (/** @type {string} */ tool) => (reachOverride
    ? reachOverride.has(tool)
    : onPath(tool) || executableIn(nodeBin, tool));

  /**
   * The binaries a command needs before it can be NAMED: its driver, and - for
   * an `npx` arm - the tool npx would delegate to. Both halves are load-bearing
   * on measured facts (D-04). `npx` is on PATH almost everywhere, so a
   * driver-only rule leaves `npx eslint .` naming an eslint nobody has; and
   * `tsc` is routinely absent from PATH while present at
   * `node_modules/.bin/tsc`, so a PATH-only rule nulls the one command a
   * TypeScript repo's CI actually runs.
   *
   * Every command in the ladder above is a fixed literal, so the split is over
   * text this file wrote - no repo content is ever parsed into a binary name.
   * @param {string} cmd @returns {string[]}
   */
  const needs = (cmd) => {
    const words = cmd.split(/\s+/).filter(Boolean);
    const delegated = words[0] === 'npx' && words[1] && !words[1].startsWith('-') ? words[1] : null;
    return delegated ? [words[0], delegated] : [words[0]];
  };

  /**
   * A slot's answer once reachability has been asked. `source` follows the
   * command: a nulled slot claims no provenance, because a manifest that named
   * a command nobody can run did not supply this run's command. The WARNING
   * carries both the tool and the manifest, so the caller can still tell "found
   * nothing" from "found something unreachable" - which is the same distinction
   * the always-both-keys `source` block exists for.
   * @param {string} slot @param {string|null} cmd @param {string|null} src
   */
  const offer = (slot, cmd, src) => {
    if (cmd === null) return { command: null, source: null };
    const missing = needs(cmd).filter((t) => !reachable(t));
    if (!missing.length) return { command: cmd, source: src };
    warnings.push(`${slot}: ${missing.join(' and ')} `
      + `${missing.length > 1 ? 'are' : 'is'} not on PATH or in node_modules/.bin, so \`${cmd}\` `
      + `(from ${src}) was not offered; no lower arm was taken in its place`);
    return { command: null, source: null };
  };

  const lintOffer = offer('lint', lint, lintSource);
  lint = lintOffer.command;
  lintSource = lintOffer.source;
  const typecheckOffer = offer('typecheck', typecheck, typecheckSource);
  typecheck = typecheckOffer.command;
  typecheckSource = typecheckOffer.source;

  ok({
    root,
    lint,
    typecheck,
    // ALWAYS present, both slots, even when both are null - the same
    // always-report convention seed-reqs's counts follow. A caller has to be
    // able to tell "found nothing" from "did not look".
    source: { lint: lintSource, typecheck: typecheckSource },
    ...(warnings.length ? { warnings } : {}),
  });
}

// ---------------------------------------------------------------------------
// detect-surfaces - the disk half of lib/surface-scan.mjs, and the evidence the
// one-time `review.triggers.risk_surface.surfaces` question is asked against.
// A seam and not model judgment for the reason detect-commands is one: a model
// reading a tree and deciding what it "looks like" is the keyword pass D-14
// measured and rejected, and nothing in CI can prove a judgment fired.
//
// `--root` is the PROJECT root, deliberately NOT `--dir`. It is read TWO
// LEVELS deep - one more than detect-commands, because that is the depth D-14's
// own measurement used and because `db/migrate` and `packages/api` are where
// the structure actually shows. Ignored trees (node_modules, .git, build
// output) are skipped: they are not the project's structure, and walking
// node_modules would declare every category on every JS project.
//
// Finding nothing is ok:true with `inconclusive:true` and all eight
// recommended - a successful check with a negative answer, like plan-overlap.
// A manifest that cannot be read or parsed contributes nothing and is NAMED in
// warnings[] rather than throwing.
// ---------------------------------------------------------------------------

/** Directory names never descended into: not the project's own structure. */
const SCAN_SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', 'out',
  'target', 'vendor', 'coverage', '.venv', 'venv', '__pycache__', '.next', '.cache']);

/** The manifests whose declared dependency names the scan reads. */
const SCAN_MANIFESTS = ['package.json', 'Cargo.toml', 'pyproject.toml',
  'go.mod', 'requirements.txt'];

/**
 * Dependency names declared by one manifest. Each arm reads the shape it can
 * read exactly and returns [] otherwise: a name this misses costs a broader
 * recommendation, and a name it invents costs a user narrowing to a category
 * they do not have.
 * @param {string} name @param {string} text @returns {string[]}
 */
function manifestDeps(name, text) {
  if (name === 'package.json') {
    const pkg = JSON.parse(text);
    if (!pkg || typeof pkg !== 'object' || Array.isArray(pkg)) return [];
    return ['dependencies', 'devDependencies', 'peerDependencies']
      .flatMap((k) => (pkg[k] && typeof pkg[k] === 'object' && !Array.isArray(pkg[k])
        ? Object.keys(pkg[k]) : []));
  }
  if (name === 'go.mod') {
    // `module.path/name v1.2.3` inside or outside a require block; the LAST
    // path segment is the package name a signal table can match.
    return text.split('\n')
      .map((l) => l.replace(/\/\/.*$/, '').trim())
      .filter((l) => /^(require\s+)?[a-z0-9][\w.\-]*(\.[a-z]{2,})?\/\S+\s+v/.test(l))
      .map((l) => l.replace(/^require\s+/, '').split(/\s+/)[0]);
  }
  if (name === 'requirements.txt') {
    return text.split('\n')
      .map((l) => l.replace(/#.*$/, '').trim())
      .filter((l) => /^[A-Za-z][\w.\-]*/.test(l))
      .map((l) => (l.match(/^[A-Za-z][\w.\-]*/) || [''])[0]);
  }
  // Cargo.toml / pyproject.toml: TOML, read by SECTION rather than by line, so
  // `name = "my-app"` under [package] is not collected as a dependency of
  // itself. Only a table whose header mentions dependencies contributes.
  /** @type {string[]} */
  const out = [];
  let inDeps = false;
  let inDepArray = false;
  for (const raw of text.split('\n')) {
    const line = raw.replace(/#.*$/, '').trim();
    const header = line.match(/^\[+([^\]]+)\]+$/);
    if (header) { inDeps = /dependencies/i.test(header[1]); inDepArray = false; continue; }
    // PEP 621 puts `dependencies = ["flask>=3", ...]` under `[project]` - a
    // header the section test above never matches - so a section-scoped read
    // alone loses every pyproject-only project's evidence. Track the ARRAY by
    // its KEY instead, across however many lines it spans, which is the one
    // place a dependency list can hide under an unrelated header.
    // The closing `]` is looked for OUTSIDE the quotes: a PEP 508 extra
    // (`"requests[socks]"`) carries its own bracket, and treating that as the
    // end of the array drops every entry after it.
    const unquoted = (s) => s.replace(/(["']).*?\1/g, '');
    if (inDepArray) {
      for (const m of line.matchAll(/["']([A-Za-z][\w.\-]*)[^"']*["']/g)) out.push(m[1]);
      if (unquoted(line).includes(']')) inDepArray = false;
      continue;
    }
    // Anchored to the EXACT key: a tool table's `ignored-dependencies` is a
    // setting, not a dependency, and reading it evidences a surface the
    // project does not have.
    const depArray = line.match(/^["']?dependencies["']?\s*=\s*\[/i);
    if (depArray) {
      for (const m of line.matchAll(/["']([A-Za-z][\w.\-]*)[^"']*["']/g)) out.push(m[1]);
      if (!unquoted(line).includes(']')) inDepArray = true;
      continue;
    }
    if (!inDeps) continue;
    const key = line.match(/^["']?([A-Za-z][\w.\-]*)["']?\s*=/);
    if (key) out.push(key[1]);
    // A dependency table whose values are arrays (`dev = ["pytest"]`).
    for (const m of line.matchAll(/["']([A-Za-z][\w.\-]*)[^"']*["']/g)) out.push(m[1]);
  }
  return out;
}

function cmdDetectSurfaces(root) {
  /** @type {string[]} */
  const warnings = [];
  /** @type {string[]} */
  const dirs = [];
  /** @type {string[]} */
  const files = [];
  /** @type {Set<string>} */
  const extensions = new Set();
  /** @type {string[]} */
  const manifests = [];
  /** @type {string[]} */
  const dependencies = [];

  /** The errno the ROOT listing failed with, when it did. */
  let rootError = null;
  /**
   * One directory level: its entries recorded, its subdirectories returned -
   * or null when the level could not be listed at all, which only the ROOT
   * treats as a failure (a subdirectory that cannot be read is one warning and
   * a narrower scan, never a refusal to answer).
   * @param {string} dir @param {string} label @returns {string[] | null}
   */
  const level = (dir, label) => {
    /** @type {string[]} */
    const subdirs = [];
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true, encoding: 'utf8' });
    } catch (e) {
      if (!label) { rootError = e.code || e.message; return null; }
      warnings.push(`${label} could not be listed and was skipped (${e.code || e.message})`);
      return subdirs;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        dirs.push(entry.name);
        if (!SCAN_SKIP_DIRS.has(entry.name)) subdirs.push(entry.name);
        continue;
      }
      files.push(entry.name);
      const dot = entry.name.lastIndexOf('.');
      if (dot > 0) extensions.add(entry.name.slice(dot));
      if (!SCAN_MANIFESTS.includes(entry.name)) continue;
      const where = label ? `${label}/${entry.name}` : entry.name;
      manifests.push(where);
      const text = read(join(dir, entry.name));
      if (text === null) {
        warnings.push(`${where} could not be read; no dependency was taken from it`);
        continue;
      }
      try {
        dependencies.push(...manifestDeps(entry.name, text));
      } catch (e) {
        warnings.push(`${where} failed to parse and was skipped: ${e.message}`);
      }
    }
    return subdirs;
  };

  const roots = level(root, '');
  if (roots === null) return fail('no-root', `${root} cannot be listed (${rootError})`);
  for (const sub of roots) level(join(root, sub), sub);

  const scan = scanTree({ dirs, files, extensions: [...extensions], dependencies });
  ok({
    root,
    // ALWAYS present, every field, even when empty - the same always-report
    // convention detect-commands states for its `source` block. A caller has to
    // be able to tell "the structure evidences nothing" from "did not look".
    manifests,
    evidenced: scan.evidenced,
    silent: scan.silent,
    unspeakable: scan.unspeakable,
    inconclusive: scan.inconclusive,
    recommended: scan.recommended,
    ...(warnings.length ? { warnings } : {}),
  });
}

// ---------------------------------------------------------------------------
// trace - the joined run record (.planning/trace.jsonl). This subcommand family
// is how PROSE writes the lifecycle and outcome families: two of the four have
// no script of their own to hang a direct write on (lifecycle lives in
// workflows/execute.md, outcomes in references/review-triggers.md and
// workflows/verify.md), so the seam is the writer everything shares. The seam
// scripts that DO have code (route.mjs, review-provider.mjs) call lib/trace.mjs
// directly rather than shelling out to this.
//
// `append` is BEST EFFORT and says so in its envelope: a write that did not
// happen - the file is at its size cap, the planning root is unwritable -
// returns ok:true with `written:false` and the reason, the same
// successful-check-with-a-negative-answer shape plan-overlap uses. Only a
// malformed CALL is ok:false. The trace records what a run did; it may never be
// able to change what a run does.
// ---------------------------------------------------------------------------
// The ignore line a project needs so its run record stays out of git, and the
// comment written above it so the next reader knows what it is.
const TRACE_IGNORE_LINE = '.planning/trace.jsonl';
const TRACE_IGNORE_COMMENT = "# Cadence's joined run record - local diagnostics"
  + " only, one machine's routing/provider/worker events";

/**
 * Does a `check-ignore -v` match source TRAVEL with the repository?
 *
 * This is why `-v` is used instead of `-q`. `check-ignore` also consults
 * `core.excludesFile` and `.git/info/exclude`, and NEITHER is cloned: a machine-
 * local exclusion would answer `ignored:true` and leave the project with no
 * ignore line of its own, so the collaborator who clones it commits the run
 * record on the next `git add .planning` - exactly the failure this subcommand
 * exists to close. Only a `.gitignore` file inside the root counts.
 * @param {string|null} source the first field of `check-ignore -v` output
 * @returns {boolean}
 */
function ignoreSourceTravels(source) {
  if (!source) return false;
  if (isAbsolute(source)) return false;            // core.excludesFile
  const parts = source.split(/[/\\]/);
  if (parts.includes('..') || parts.includes('.git')) return false; // outside, or info/exclude
  return parts[parts.length - 1] === '.gitignore';
}

/**
 * Git's own answer about the ignore line, with the matching SOURCE, or
 * `method: 'file'` when git cannot answer at all (not installed, or the root is
 * not a repository). Exit 1 from `check-ignore` is DATA - nothing matched - and
 * only a harder failure falls back.
 *
 * `--no-index` is load-bearing, not a tidy-up. Without it `check-ignore` reports
 * nothing for a path that is in the INDEX, because git's own contract is "would
 * this path be ignored if it were untracked" and a tracked path is already past
 * that question. The two states then become indistinguishable: a project whose
 * `.gitignore` carries the line AND has the record force-added answered
 * `ignored:false`, so `cmdTraceIgnore` appended the line again on every run and
 * `/cad-health` reported a missing rule that was right there. `--no-index` asks
 * the question this seam actually has - does a rule cover this path - and leaves
 * TRACKED to `traceTracked`, which is the separate fact and the one that needs
 * `git rm --cached`.
 * @param {string} root
 * @returns {{method: 'git'|'file', travels: boolean, source: string|null}}
 */
function gitIgnoreState(root) {
  const noGit = { method: /** @type {'file'} */ ('file'), travels: false, source: null };
  try {
    execFileSync('git', ['-C', root, 'rev-parse', '--git-dir'], { stdio: 'pipe' });
  } catch { return noGit; }
  let out = '';
  try {
    out = execFileSync('git',
      ['-C', root, 'check-ignore', '--no-index', '-v', '--', TRACE_IGNORE_LINE],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    if (e && e.status === 1) return { method: 'git', travels: false, source: null };
    return noGit;
  }
  // `<source>:<line>:<pattern>\t<pathname>`. The source is everything before
  // the LAST two colons of the left half, so a source path containing a colon
  // is not silently truncated into a different file name.
  const left = out.split('\n')[0].split('\t')[0];
  const last = left.lastIndexOf(':');
  const prev = last > 0 ? left.lastIndexOf(':', last - 1) : -1;
  const source = prev >= 0 ? left.slice(0, prev) : null;
  return { method: 'git', travels: ignoreSourceTravels(source), source };
}

/** Is the run record TRACKED? A non-repo tracks nothing, so it is false there. */
function traceTracked(root) {
  try {
    execFileSync('git', ['-C', root, 'ls-files', '--error-unmatch', '--', TRACE_IGNORE_LINE],
      { stdio: 'pipe' });
    return true;
  } catch { return false; }
}

/**
 * The literal fallback: the line as a project would write it, in `<root>/.gitignore`.
 * Comments and blank lines are skipped. Used only when git could not answer -
 * it cannot see a `.planning/` wholesale ignore, which is why the git arm is
 * tried first and is not decoration.
 * @param {string} root
 */
function gitignoreCarriesLine(root) {
  const text = read(join(root, '.gitignore'));
  if (text === null) return false;
  return text.split('\n').some((raw) => {
    const line = raw.trim();
    if (!line || line.startsWith('#')) return false;
    return line === TRACE_IGNORE_LINE || line === `/${TRACE_IGNORE_LINE}`;
  });
}

/**
 * `trace ignore` - the scaffold-time writer of the ignore line, and the
 * read-only reporter `/cad-health` runs (D-03).
 *
 * `ignored` and `tracked` are the state AS FOUND, before any write; `written`
 * says what this call changed. `--check` writes nothing at all: /cad-health
 * reports on a project it did not create and may not edit its `.gitignore`.
 *
 * WHO calls which arm, and what the ignore buys (moved out of
 * `workflows/execute.md`, v2.6.2): `/cad-new-project` writes the line through
 * `trace ignore` at scaffold time, and `/cad-health` runs the `--check` arm, so
 * a project scaffolded before this seam existed is REPORTED rather than having
 * its `.gitignore` edited underneath it. Because `.planning/trace.jsonl` is
 * ignored, nothing a parallel worktree wrote to the run record could ride the
 * merge back into phase history - which is half of why a worktree executor
 * emits no trace events of its own; the other half is that its return is a
 * frozen five-field digest with no room for one.
 * @param {string} root @param {any} opts
 */
function cmdTraceIgnore(root, opts) {
  if (!existsSync(root)) return fail('no-root', `${root} not found`);
  const file = join(root, '.gitignore');
  const git = gitIgnoreState(root);
  const ignored = git.method === 'git' ? git.travels : gitignoreCarriesLine(root);
  const common = {
    root,
    file,
    line: TRACE_IGNORE_LINE,
    ignored,
    tracked: traceTracked(root),
    method: git.method,
    ...(git.source ? { source: git.source } : {}),
  };
  if ('check' in opts) return ok({ ...common, written: false });
  // Already covered by a line that travels: the no-op that makes a re-run safe.
  if (ignored) return ok({ ...common, written: false, reason: 'already-ignored' });

  // Every existing byte survives. The newline is added only when the current
  // contents lack a trailing one, so a brownfield `.gitignore` keeps every line
  // it had and the new line still lands on a line of its own.
  const existing = read(file);
  const next = existing === null || existing === ''
    ? `${TRACE_IGNORE_COMMENT}\n${TRACE_IGNORE_LINE}\n`
    : `${existing}${existing.endsWith('\n') ? '' : '\n'}\n${TRACE_IGNORE_COMMENT}\n${TRACE_IGNORE_LINE}\n`;
  atomicWrite(file, next);
  return ok({ ...common, written: true });
}

// reads - the in-dispatch companion to `trace render`. `trace.jsonl` records
// what a dispatch was HANDED; `reads.jsonl` records what it went and opened
// afterwards, which measured ~88% of a run's tokens on this repo and had no
// reader at all. Absent file is ok:true with zeroes - a project that has not
// run since the hook was installed has nothing to report, and that is not an
// error.
function cmdReads(dir, opts) {
  const file = join(dir, READS_FILE);
  let text = '';
  try {
    text = readFileSync(file, 'utf8');
  } catch (e) {
    if (e && e.code === 'ENOENT') return ok({ calls: 0, distinct: 0, redundancy: null, fileCalls: 0, distinctFiles: 0, fileTouches: 0, fileRedundancy: null, byAgent: [], byTool: [], topTargets: [], topFiles: [], note: 'no reads recorded yet' });
    return fail('read-failed', `cannot read ${file}`);
  }
  const records = [];
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    // A truncated final line is SKIPPED, never fatal: the file is appended to
    // by a hook that can be killed mid-write, and a partial tail must not cost
    // the caller every complete record ahead of it.
    try { records.push(JSON.parse(t)); } catch { /* partial line */ }
  }
  const summary = summarizeReads(records);
  // Without `--join` the envelope is what it has always been, including the
  // `no reads recorded yet` arm above, which returns before this line: a
  // reader that never asked for the join must not have to parse around it.
  //
  // WHOLE record, no phase scoping. `reads.jsonl` has none - it is one file
  // per project - and the brackets it joins to therefore have to span every
  // phase, or a read caused by phase 3 would report unjoined while phase 3's
  // bracket sat one scope away.
  if (!('join' in opts)) return ok(summary);
  const j = joinReads(records, renderTrace(dir).brackets);
  // SIX figures, not one ratio. `joined` and `unjoined` are the join working
  // and not working; `ambiguous` is it declining to guess between overlapping
  // same-role brackets; `floor` is the permanent limit (`fork` and
  // `general-purpose` are HOST agent types with no dispatch event, ever);
  // `coordinator` is the main thread, which has no worker bracket by
  // construction; `unresolved` is a record whose `agent` field was absent or
  // named no role. Collapsing any of them into `unjoined` reports a limit as
  // a failure, which is exactly the distinction the join exists to make.
  return ok({
    ...summary,
    joined: j.joined,
    ambiguous: j.ambiguous,
    unjoined: j.unjoined,
    floor: j.floor,
    coordinator: j.coordinator,
    unresolved: j.unresolved,
  });
}

/**
 * The per-role dispatch-window ceilings the `window` arm falls back to when no
 * config layer sets one.
 *
 * `cadence-core/config.schema.json` IS THE SOURCE OF TRUTH for these numbers -
 * its rows carry the defaults, the sample sizes behind them and the reach
 * phrase, and `cadence-core/references/seams.md` carries the argument. This map
 * is the unset-layer fallback and nothing else, the same duplication
 * `cmdRecall`'s `?? 'builtin'` already accepts: this seam reads the merged
 * config, not the schema, so an unset key has to resolve to something here.
 * A number changed in one place and not the other makes the report disagree
 * with the row a user reads before setting the key.
 */
const DISPATCH_WINDOW_DEFAULTS = Object.freeze({
  'cad-planner': 200000,
  'cad-assumptions-analyzer': 150000,
  'cad-verifier': 100000,
  'cad-reviewer': 150000,
  'cad-executor': 200000,
  'cad-plan-checker': 75000,
});

/**
 * The values the `suggest` arm falls back to for the keys its rules NAME when
 * no config layer holds one - and only for the keys whose schema default is a
 * real value. A key defaulting to `null` is not in here on purpose: `null` is
 * the schema's sentinel for "no layer pins this, the stakes level decides it",
 * and the suggestion reports that state as unset rather than inventing the
 * value the level would fire (D-06).
 *
 * `cadence-core/config.schema.json` IS THE SOURCE OF TRUTH for these values -
 * its rows carry the defaults and the argument behind them. This map is the
 * unset-layer fallback and nothing else, the same duplication
 * `DISPATCH_WINDOW_DEFAULTS` above already accepts: this seam reads the merged
 * config, not the schema, so an unset key has to resolve to something here. The
 * schema is deliberately NOT parsed at runtime (D-15) - neither this file nor
 * `lib/trace-suggest.mjs` reads it today. A value changed in one place and not
 * the other makes `/cad-suggest` print a `current` that disagrees with the row
 * `/cad-config` shows, which `prose-agreement.test.mjs` fails on.
 */
const SUGGEST_KEY_DEFAULTS = Object.freeze({
  'workflow.max_plan_tasks': 8,
  'review.reviewers': ['claude-subagent'],
});

/**
 * The gate ladder `cadence-core/route-table.json` states, resolved against THIS
 * file's own directory the way `route.mjs` resolves the same file - and without
 * honouring `CADENCE_ROUTE_TABLE`: an env-supplied ladder is the ungated
 * override class EXP-01 closed, and this one decides what a suggestion tells a
 * user to set a review gate to.
 *
 * A table that cannot be read or parsed degrades to NO ladder, which makes the
 * gate arm omit `proposed`. That omission is the report; no ladder is
 * substituted from memory here.
 * @returns {string[]|undefined}
 */
function gateLadder() {
  return routeLadder('gates');
}

/**
 * The rung ladder `route-table.json` states, on the same terms as the gate one:
 * R3 compares its target against the rung a config layer set, and an absent
 * ladder omits the target rather than substituting an order from memory.
 * @returns {string[]|undefined}
 */
function rungLadder() {
  return routeLadder('rung_order');
}

/**
 * The risk-surface vocabulary `route-table.json` states - the SAME list
 * `route.mjs` hands `answeredSurfaces`, read here so the seam that REFUSES on
 * the one-time surface question and the resolve that REPORTS it cannot
 * disagree about which tokens are a valid answer. A table naming a proper
 * subset is the case that separates them: a configured category outside it is
 * unanswered to `route.mjs`, and reading `CATEGORIES` here instead would let
 * this seam accept that same value and narrow a blocking gate's scope to a set
 * the routing authority had rejected.
 *
 * An unreadable or malformed table falls back to the eight rather than to
 * nothing: no vocabulary at all would read every configured answer as invalid
 * and refuse every call.
 * @returns {readonly string[]}
 */
function surfaceVocabulary() {
  return routeLadder('risk_surface_categories') || CATEGORIES;
}

/**
 * One ordered ladder off `route-table.json`, or `undefined` when the table is
 * unreadable, malformed, or names that ladder as anything but a non-empty array
 * of non-empty strings.
 * @param {string} key
 * @returns {string[]|undefined}
 */
function routeLadder(key) {
  try {
    const table = JSON.parse(readFileSync(join(HERE, '..', 'route-table.json'), 'utf8'));
    const ladder = table[key];
    if (Array.isArray(ladder) && ladder.length
      && ladder.every((g) => typeof g === 'string' && g)) return ladder;
  } catch { /* unreadable or malformed: no ladder, and the omission says so */ }
  return undefined;
}

/**
 * The task count of the plan a `cad-executor` checkpoint names, or `null` when
 * the checkpoint maps to no readable plan - UNKNOWN, never under-ceiling
 * (D-09). Unknown is the common case and stays so: a `plan` that is a WORKER
 * key rather than a plan number (`1-cut`, `1-fix`) names no file, an archived
 * cycle keeps its phase dirs under a different milestone dir and filename
 * shape, and a delete-mode close removes them outright.
 *
 * The `phase` is read through `requirePhaseArg`, which is the traversal guard
 * as much as the shape one: this value comes off a RECORD line rather than a
 * flag, and it is about to be a directory component. The `plan` needs no such
 * guard - it is only ever compared against `readdirSync` entries, so a `../`
 * in it matches nothing.
 * @param {string} dir the planning dir
 * @param {any} event a `lifecycle/checkpoint` event
 * @returns {number|null}
 */
function checkpointPlanTasks(dir, event) {
  const phase = requirePhaseArg(typeof event.phase === 'number' ? String(event.phase) : event.phase);
  if (!phase.ok) return null;
  const plan = typeof event.plan === 'string' || typeof event.plan === 'number'
    ? String(event.plan).trim()
    : '';
  if (!plan) return null;
  const pdir = join(dir, 'phases', phase.raw);
  const { plans } = listPlanFiles(pdir);
  // `PLAN.md` is plan 1 spelled bare - the same equivalence `listPlanFiles`'s
  // own conforming set carries.
  const file = plans.find((f) => f === `PLAN-${plan}.md`)
    || (plan === '1' ? plans.find((f) => f === 'PLAN.md') : undefined);
  if (!file) return null;
  const text = read(join(pdir, file));
  if (text === null) return null;
  return planTaskTitles(text).length;
}

/**
 * Everything the pure rules in `lib/trace-suggest.mjs` need to name a
 * direction, a current value and - where one can be READ - a target: the
 * resolved config value behind each key the record's own events reach, the gate
 * ladder, and the stakes level the record carries. Resolved HERE because that
 * file is pure and stays that way (D-05); it owns the rules, this owns the
 * reads.
 *
 * Keyed off the RECORD rather than the schema's key space: a trigger that never
 * fired and a role that never resolved are keys no rule can name, so resolving
 * them would read config nothing asked about.
 *
 * `checkpointTasks` is the FILE half of R4's binding check, here for the same
 * reason as everything else in this function: reading a plan file is I/O.
 * @param {string} dir the planning dir
 * @param {any} render
 * @param {any} config the merged config layers
 */
function suggestResolution(dir, render, config) {
  /** @type {Record<string, any>} */
  const values = {};
  // An absent or null value is NOT recorded: `lib/trace-suggest.mjs` reads a
  // missing key as unset, which is the state D-06 makes it print.
  const set = (key, value) => { if (value !== undefined && value !== null) values[key] = value; };
  const triggers = config?.review?.triggers || {};
  const effort = config?.model?.effort || {};
  const events = Array.isArray(render?.events) ? render.events : [];
  // The level the most recent `routing/resolve` event in scope carries, and
  // nothing when the scope holds none - never a level the record does not
  // carry.
  let stakes = null;
  // One entry per counted checkpoint, in record order, so the rule can tell
  // "every one of them was measured" from "some were".
  /** @type {(number|null)[]} */
  const checkpointTasks = [];
  for (const e of events) {
    if (!e || typeof e !== 'object') continue;
    if (e.family === 'outcome' && e.event === 'adjudication') {
      const parsed = parseAdjudication(e);
      if (parsed) set(`review.triggers.${parsed.trigger}.gate`, triggers?.[parsed.trigger]?.gate);
    } else if (e.family === 'routing' && e.event === 'resolve') {
      if (typeof e.role === 'string' && e.role) set(`model.effort.${e.role}`, effort?.[e.role]);
      if (typeof e.stakes === 'string' && e.stakes.trim()) stakes = e.stakes.trim();
    } else if (e.family === 'lifecycle' && e.event === 'checkpoint' && e.role === 'cad-executor') {
      checkpointTasks.push(checkpointPlanTasks(dir, e));
    }
  }
  set('review.reviewers', config?.review?.reviewers ?? SUGGEST_KEY_DEFAULTS['review.reviewers']);
  set('workflow.max_plan_tasks',
    config?.workflow?.max_plan_tasks ?? SUGGEST_KEY_DEFAULTS['workflow.max_plan_tasks']);
  const gates = gateLadder();
  const rungs = rungLadder();
  return { values, ...(gates ? { gates } : {}), ...(rungs ? { rungs } : {}), stakes, checkpointTasks };
}

// The grammar the SHARED `trace append|close` body judges its string flags by,
// read off lib/arg-contract.mjs rather than restated as seven guards below.
//
// The two rows are UNIONED because ONE body validates both subcommands. A flag
// row is a prose allowlist that never widens what a subcommand accepts, so
// `trace close` declares no `--sha`, `--base`, `--step` or `--trigger` row even
// though this body reads them for it; every key both rows do declare, they
// declare identically, so the union states no grammar either row denies.
const TRACE_GRAMMAR = {
  ...CONTRACTS['planning.mjs']['trace append'],
  ...CONTRACTS['planning.mjs']['trace close'],
};

// The flags whose whole rule is the value grammar, in the order they are read.
// The first four declare `fallback` on both axes and the last four `refuse` -
// the two dispositions this one body has always run side by side (D-05), now
// stated once in the table instead of seven times here.
const TRACE_STRING_FLAGS = ['--plan', '--sha', '--base', '--role', '--step', '--reviewer', '--trigger'];

function cmdTrace(dir, sub, opts) {
  if (sub === 'ignore') {
    // `--root` is the PROJECT root, deliberately not `--dir`: `.gitignore` lives
    // there while the line it carries is `.planning/trace.jsonl`. A `--root`
    // present with nothing usable after it is REFUSED by its declared row at
    // the dispatch door rather than falling through to the cwd, which would
    // edit a different tree than the caller named (the `#42/#45` rail).
    return cmdTraceIgnore(typeof opts.root === 'string' ? opts.root : process.cwd(), opts);
  }
  // `close` is `append` with the two fields a dispatch site used to restate
  // taken off its hands, so every flag below is validated by ONE body: a second
  // copy of the `--tokens` grammar is a second place for it to drift, and the
  // close half is exactly where the token figure lands.
  if (sub === 'append' || sub === 'close') {
    const parsedPhase = requirePhaseArg(opts.phase);
    if (!parsedPhase.ok) return fail('bad-args', `trace ${sub} needs --phase <N>`);
    // `--detail-file` is the SAFE transport for a detail the CALLER derived -
    // a reviewer's verdict, a checkpoint's reason - and the reasoning lives in
    // lib/text-flag-file.mjs and references/conventions.md, not restated here.
    // Resolved BEFORE the close arm's inference below, which reads the detail:
    // left on `opts.detail` alone, every converted checkpoint site would bill
    // as a clean `return`, the one arm the record exists to keep separate.
    const resolvedDetail = resolveTextFlag(opts, 'detail', `trace ${sub}`);
    if (!resolvedDetail.ok) return fail('bad-args', resolvedDetail.detail);
    const detail = resolvedDetail.value !== undefined ? resolvedDetail.value : opts.detail;
    let family;
    let event;
    if (sub === 'close') {
      // Fixed, never read off the caller: the whole point of the subcommand is
      // that a close site states WHAT it is closing and nothing about how the
      // record spells it.
      family = 'lifecycle';
      // The arm is inferred from `--detail` and NEVER from `--tokens` (D-06).
      // Measured across all twenty shipped close lines: 6 of the 10 checkpoint
      // sites carry `--tokens` and 4 do not, while every checkpoint carries
      // `--detail` and no return does. A token-presence classifier would
      // therefore write `return` for four shipped checkpoint sites - billing a
      // worker that came back unusable as a clean close, which is the one arm
      // the record exists to keep separate.
      //
      // `escalation` stays OUTSIDE this inference (D-13): it is a TERMINAL
      // member with zero prose producers, so a three-way inference would be
      // flexibility nothing exercises. It stays reachable through
      // `trace append --event escalation`.
      event = typeof detail === 'string' && detail.trim() ? 'checkpoint' : 'return';
    } else {
      family = typeof opts.family === 'string' ? opts.family : '';
      if (!FAMILIES.includes(family)) {
        return fail('bad-args', `trace append --family must be one of ${FAMILIES.join(' | ')}`);
      }
      event = typeof opts.event === 'string' && opts.event ? opts.event : '';
      if (!event) return fail('bad-args', 'trace append needs --event <name>');
    }

    // --tokens: what the dispatch COST, read by the orchestrator off the
    // worker's return metadata. A malformed value is a malformed CALL, not a
    // best-effort append with the field dropped: a dropped field renders the
    // role `unrecorded` while the caller believes a figure was recorded, which
    // is exactly the zero/unrecorded/recorded conflation the per-role block
    // exists to prevent. So nothing at all is appended here.
    // One exception to "malformed value, nothing appended": a COMMA-GROUPED
    // integer. This plugin prints token figures grouped (context.md's measured
    // block reads `cad-planner 146,405`) three lines from the `--tokens` order
    // that copies them, so `--tokens 146,405` is the transcription the prose
    // itself models. Refusing it drops the append, and the `dispatch` half is
    // already written, so the worker is stranded in renderTrace's unpaired[]
    // forever - escalating a recording error into loss of the bracket it was
    // recording. Grouping is stripped only in the strict 3-digit shape, so
    // `1,2,3` and `146,40` are still malformed CALLS and still refused.
    let tokens;
    if ('tokens' in opts) {
      const raw = typeof opts.tokens === 'string' && /^\d{1,3}(?:,\d{3})+$/.test(opts.tokens.trim())
        ? opts.tokens.trim().replace(/,/g, '')
        : opts.tokens;
      const parsed = requireInt(raw);
      if (!parsed.ok || parsed.value < 0) {
        return fail('bad-args', `trace ${sub} --tokens needs a non-negative integer`);
      }
      tokens = parsed.value;
    }

    // --turns: how many TOOL CALLS the dispatch made, read off the same subagent
    // return metadata `--tokens` is (lib/trace.mjs's TOKEN PROVENANCE header
    // states that provenance once, for both). Tokens alone cannot price a run -
    // the bill is turns times window - so a record carrying only the token half
    // can describe what a worker returned and never what it cost to get there.
    // Structured, and never parsed back out of `--detail`: that slot is not a
    // machine-join surface (one trigger was spelled four different ways across
    // 35 shipped `outcome/adjudication` events), so a figure recovered from it
    // is exactly as trustworthy as the substitution that condemned it.
    // Validated the way `--raised` is, and for the same reason: a malformed
    // value is a malformed CALL and NOTHING is appended, never a best-effort
    // append with the field dropped - a dropped count renders the role
    // turn-unrecorded while the caller believes a figure landed, which is the
    // zero/unrecorded/recorded conflation the per-role block exists to prevent.
    // No comma-grouping exception: that one exists because this plugin PRINTS
    // token figures grouped, and a tool-call count never is, so accepting
    // `1,234` would only widen what can be mistyped.
    let turns;
    if ('turns' in opts) {
      const parsed = requireInt(opts.turns);
      if (!parsed.ok || parsed.value < 0) {
        return fail('bad-args', `trace ${sub} --turns needs a non-negative integer`);
      }
      turns = parsed.value;
    }

    // --raised: how many findings the reviewers RAISED before adjudication, so
    // the record can tell a gate that found nothing (0 of 0) from a reviewer
    // whose every finding was refuted (0 of 9). Structured, because the
    // free-text `--detail` slot is the one already condemned for carrying the
    // voice list - a figure parsed back out of prose is exactly as trustworthy
    // as the substitution that condemned it (D-01).
    // Validated the way `--tokens` is, and for the same reason: a malformed
    // value is a malformed CALL and NOTHING is appended, never a best-effort
    // append with the field dropped, because a dropped figure reads downstream
    // as UNKNOWN while the caller believes a count was recorded.
    // No comma-grouping exception here: that one exists because this plugin
    // PRINTS token figures grouped, and a finding count never is, so accepting
    // `1,234` would only widen what can be mistyped.
    let raised;
    if ('raised' in opts) {
      const parsed = requireInt(opts.raised);
      if (!parsed.ok || parsed.value < 0) {
        return fail('bad-args', `trace ${sub} --raised needs a non-negative integer`);
      }
      raised = parsed.value;
    }

    // --survivors / --downgraded / --refuted: the SETTLED figures of a fire,
    // the other side of the `--raised` count above. `9 raised` says what the
    // reviewers found; these three say what survived being argued with, which
    // is the whole of what an adjudication decided.
    // Structured for the reason `--raised` is, and validated the same way: a
    // malformed value is a malformed CALL and NOTHING is appended, never a
    // best-effort append with the field dropped, because a dropped figure reads
    // downstream as UNKNOWN while the caller believes a count landed. No
    // comma-grouping exception, for the reason `--raised` and `--turns` both
    // give - a finding count is never PRINTED grouped, so accepting `1,234`
    // would only widen what can be mistyped.
    // Each key is OMITTED when its flag was absent and a real `--survivors 0`
    // still records a 0: a fire nobody counted and a fire that counted zero are
    // different fires, and the key is what separates them.
    const settled = {};
    for (const flag of ['survivors', 'downgraded', 'refuted']) {
      if (!(flag in opts)) continue;
      const parsed = requireInt(opts[flag]);
      if (!parsed.ok || parsed.value < 0) {
        return fail('bad-args', `trace ${sub} --${flag} needs a non-negative integer`);
      }
      settled[flag] = parsed.value;
    }

    // --round: WHICH round of a capped re-arm this event belongs to. Not
    // decoration - the record a receipt settles is written at
    // `...-<discriminator>-r<round>.json` above round 1, so a settle that names
    // no round resolves ROUND ONE's filename and would check round two's
    // figures against round one's stale rulings, passing whenever the two
    // happen to coincide. Absent means round 1 on both sides, so the write side
    // and the receipt side resolve one filename by one rule.
    let round = 1;
    if ('round' in opts) {
      const parsed = requireInt(opts.round);
      if (!parsed.ok || parsed.value < 1) {
        return fail('bad-args',
          `trace ${sub} --round needs the re-arm round after it, a whole number of at least 1`);
      }
      round = parsed.value;
    }

    // --read: the read-set the SITE caused the worker to read, as ONE
    // comma-separated value split the way `phase-done --reqs` splits its ids.
    // A repeated flag is impossible by construction rather than by choice -
    // `parseArgs` does `opts[a.slice(2)] = next`, so `--read a --read b` would
    // keep only `b` and the record would drop most of its rows while looking
    // complete. Do not "improve" this into a repeatable flag.
    //
    // GRAMMAR: an element is any VERBATIM string naming something the site
    // caused the worker to read - a path, a glob, or a non-path reference (a
    // `<base>..<head>` ref range) the worker resolves for itself. Stored with
    // no existence check, no normalization and no byte measurement, so a reader
    // converting the set to bytes must resolve each element BY KIND rather than
    // assume a plain path.
    //
    // `--read-file` is the same value through the path transport, for a site
    // whose read-set is composed from what the worker was handed rather than
    // typed by a human. It is split by the SAME grammar and refused by the SAME
    // all-blank test - one list-builder below, so the two transports cannot
    // disagree about what an element is.
    let read;
    const resolvedRead = resolveTextFlag(opts, 'read', `trace ${sub}`);
    if (!resolvedRead.ok) return fail('bad-args', resolvedRead.detail);
    if ('read' in opts || 'read-file' in opts) {
      const raw = resolvedRead.value !== undefined ? resolvedRead.value : opts.read;
      const list = typeof raw === 'string'
        ? raw.split(',').map((s) => s.trim()).filter(Boolean)
        : [];
      // A bare `--read`, an empty string, or an all-blank value is almost
      // always an unset `"$PATHS"`, and a complete-looking dispatch with no
      // read-set is the failure this refusal exists against. The file form
      // reaches this same test with a file holding only separators - a
      // whitespace-only file is already refused by the reader as empty.
      if (!list.length) {
        return fail('bad-args',
          `trace ${sub} --read${'read-file' in opts ? '-file' : ''} needs a comma-separated path list`);
      }
      read = list;
    }

    // The seven string flags, each read through its DECLARED row. One loop
    // where seven hand-written guards used to state the same two rules, and
    // the ONE place this body's two bare-flag dispositions are decided (D-05):
    // `--plan`, `--sha` and `--base` declare `fallback` and read as absent, so
    // every shipped `trace close` written without them keeps answering ok:true,
    // while `--role`, `--step`, `--reviewer` and `--trigger` REFUSE.
    //
    // `--role` MOVED to refuse, and that is the behaviour change. Measured
    // 2026-08-19, `trace append --phase 1 --family lifecycle --event dispatch
    // --role --tokens 5` returned `{"ok":true,"written":true}`, wrote a line
    // carrying no `role` key, and `trace render` then aggregated it under the
    // EMPTY STRING key - `"roles":{"":{"dispatches":2,...}}`, a
    // complete-looking dispatch whose attribution is gone. `--role ''` was
    // identical. The other direction - extending the drop arm to the three
    // refusals beside it - was the alternative, and those three are written
    // against exactly this shape.
    //
    // What each of the four refusing flags IS:
    //   --step      the workflow step a COORDINATOR marker names. A marker
    //               naming no step defeats the per-step attribution it exists
    //               for.
    //   --reviewer  WHICH reviewer actually ran this fire, so a cross-model
    //               review and a subagent review of one trigger stop being one
    //               shape in the record (RVW-02). It names the reviewer that
    //               RAN, never the one the trigger asked for - nothing refuses
    //               a dispatch to a reviewer outside the resolved set (D-07),
    //               so this mark is the whole enforcement.
    //   --trigger   WHICH review trigger this event belongs to, so an `outcome`
    //               event JOINS to the fire that produced it without reading
    //               prose; `risk-check status` demands one for a matched range
    //               (D-12). Measured across this repository's 35
    //               `outcome/adjudication` events the trigger is spelled four
    //               different ways inside the free-text `--detail`, and
    //               lib/trace-suggest.mjs discards that text entirely, so
    //               parsing it back out is the substitution this flag exists to
    //               avoid.
    //   --role      the role the per-role token block aggregates under.
    // A bare one of them parses as boolean `true` in `parseArgs`, which is why
    // the read is against ARGV: the refusal has to see the spelling.
    const flags = {};
    for (const flag of TRACE_STRING_FLAGS) {
      const parsedFlag = evaluateFlag(ARGV, flag, TRACE_GRAMMAR[flag]);
      // The wording comes from the ONE flag->sentence map the dispatch door
      // composes from, so `trace append --role` (bare) answers with the same
      // sentence whichever of the two refuses it first - the door for the flags
      // the resolved row declares, this loop for the ones only the UNION does.
      if (!parsedFlag.ok) return fail('bad-args', argRefusal(`trace ${sub}`, flag));
      flags[flag] = parsedFlag.value;
    }
    // Trimmed for the four that refuse, because a stored name is a JOIN KEY and
    // ` cad-executor ` must not read as a second role. The `fallback` three are
    // stored VERBATIM, exactly as they always were.
    const trimmed = (flag) => (flags[flag] === undefined ? undefined : String(flags[flag]).trim());
    const step = trimmed('--step');
    const reviewer = trimmed('--reviewer');
    const trigger = trimmed('--trigger');

    // THE CROSS-ARTIFACT CHECK (AC4). The three settled figures are DERIVED by
    // the `adjudication` seam from the record's own rulings and copied onto
    // this line by hand, so this is where a mistyped one is still cheap: the
    // record for this fire is recounted and a figure that disagrees is a
    // malformed CALL, refused with NOTHING appended. Left to a later test, the
    // wrong count has already shipped on the fire's own receipt.
    //
    // ABSENT RECORD OMITS THE CHECK and stores the flags as given - a fire
    // predating the format, or an advisory arm that wrote none. This is a
    // cross-check between two artifacts, never a requirement that one exist:
    // making a receipt depend on a record would make an unrecordable fire
    // unrecordable in the trace as well.
    const recount = recountReceipt(dir, parsedPhase.raw, {
      trigger, plan: flags['--plan'], sha: flags['--sha'], round, settled,
    });
    if (!recount.ok) return fail(recount.reason, recount.detail, recount.hint);

    // No flag below is coupled to an event NAME: the seam stays event-agnostic
    // exactly as it is today, which is what makes `return`, `checkpoint` and
    // `escalation` store tokens identically. `--step` does not change that: the
    // rule that a coordinator marker carries no `--role` and no `--tokens` is
    // held by the prose that writes it and by the census assertion in
    // trace.test.mjs, never by a runtime refusal keyed to an event name.
    const res = appendEvent(dir, {
      // The caller's SPELLING, which is what separates `1.10` from `1.1`:
      // normalized, both phases shared one trace key and one correlation id, so
      // the record joined two phases into one story. `lib/trace.mjs`'s `key()`
      // stringifies both sides of every comparison, so the derived id, the
      // render filter and the dispatch/terminal pairing all keep working
      // against traces written before this change and lib/trace.mjs needs no
      // edit.
      phase: parsedPhase.raw,
      family,
      event,
      // The four below carry no guard of their own any more: the loop above
      // already applied each flag's declared disposition, so an absent flag and
      // a `fallback` one both arrive here as `undefined` and omit their key.
      ...(flags['--plan'] === undefined ? {} : { plan: flags['--plan'] }),
      ...(flags['--sha'] === undefined ? {} : { sha: flags['--sha'] }),
      // `--base` beside `--sha`: a fire RECEIPT names both ends of the range it
      // settled, because two ranges can share a head and differ at the base and
      // are then different diffs over different surfaces.
      ...(flags['--base'] === undefined ? {} : { base: flags['--base'] }),
      ...(typeof detail === 'string' && detail ? { detail } : {}),
      ...(trimmed('--role') === undefined ? {} : { role: trimmed('--role') }),
      ...(tokens === undefined ? {} : { tokens }),
      // OMITTED when the return carried no count, never sent as `0`: a zero
      // claims a dispatch that used no tools, while an absent key is readable
      // as "this host reported none". A real `--turns 0` still records a 0,
      // exactly as `--tokens 0` already does.
      ...(turns === undefined ? {} : { turns }),
      ...(raised === undefined ? {} : { raised }),
      // The settled figures, each key present only when its flag was: a fire
      // nobody counted stays distinguishable from one that counted zero.
      ...settled,
      // The round, only when the caller named one: an ordinary fire is round 1
      // by omission on both sides, and writing a `round: 1` onto every event
      // would put a re-arm field on the thousands that never re-armed.
      ...('round' in opts ? { round } : {}),
      ...(read === undefined ? {} : { read }),
      ...(step === undefined ? {} : { step }),
      ...(reviewer === undefined ? {} : { reviewer }),
      ...(trigger === undefined ? {} : { trigger }),
    });
    return ok({
      written: res.written,
      ...(res.corr ? { corr: res.corr } : {}),
      ...(res.reason ? { reason: res.reason } : {}),
    });
  }
  if (sub === 'suggest') {
    // Evidence-backed config suggestions off the record - the pure rules live
    // in lib/trace-suggest.mjs, this arm owns only scope and envelope. No
    // `--phase` means the WHOLE record on purpose: the caller is the milestone
    // close, and a milestone's evidence spans every phase it shipped.
    let phase;
    if (opts.phase !== undefined) {
      const parsedPhase = requirePhaseArg(opts.phase);
      if (!parsedPhase.ok) return fail('bad-args', 'trace suggest --phase must be a phase number');
      phase = parsedPhase.raw;
    }
    const r = renderTrace(dir, phase);
    // warnings[] BOUND and ridden on the envelope when non-empty, the rule
    // lib/merge-warnings.mjs holds every mergeLayers callsite to (D-13): a torn
    // layer reads every key as unset, so every suggestion would report an unset
    // `current` and a project that deliberately pinned one would be told to
    // move a value the read never saw.
    const { config: suggestConfig, warnings } = mergeLayers(join(dir, 'config.json'));
    const suggestions = suggestFromRender(r, suggestResolution(dir, r, suggestConfig));
    return ok({
      scope: phase === undefined ? 'all' : String(phase),
      events_read: r.events.length,
      ...(r.capped ? { capped: true } : {}),
      ...(r.malformed ? { malformed: r.malformed } : {}),
      suggestions,
      ...(warnings.length ? { warnings } : {}),
    });
  }
  if (sub === 'render') {
    let phase;
    if (opts.phase !== undefined) {
      const parsedPhase = requirePhaseArg(opts.phase);
      if (!parsedPhase.ok) return fail('bad-args', 'trace render --phase must be a phase number');
      phase = parsedPhase.raw;
    }
    const r = renderTrace(dir, phase);
    // The BOUND, and it lives here rather than in `renderTrace` (D-08). Two
    // in-process consumers read the full array off the function - `trace
    // suggest` above reads `r.events.length`, and lib/trace-suggest.mjs reads
    // `render.events` directly - so bounding the function would make every
    // evidence-backed retune suggestion price a fraction of the run. What is
    // oversized is the CLI RESPONSE, which is read into a model's context:
    // 36,916 B for `--phase 3` on this repo's own record, nearly all of it the
    // raw event array.
    //
    // What replaces it is NOT a tail-N of `events`. It is the per-bracket rows
    // plus EVERY `outcome` event, because references/triage-gate.md reads this
    // response to find a prior `rearm` outcome under the current `corr` before
    // firing the narrowed round - a truncated payload makes that lookup miss,
    // and the one-re-arm cap on the only BLOCKING trigger fails open. The
    // second reader, workflows/report.md, needs one row per dispatch/return
    // pair and one line per review fire, which is the same shape.
    // PRESENCE, the `--undo` precedent at `phase-done`: the flag says "hand me
    // the raw array" and has no value to get wrong.
    const full = 'events' in opts;
    return ok({
      file: r.file,
      corr: r.corr,
      capped: r.capped,
      counts: r.counts,
      ...(Object.keys(r.roles).length ? { roles: r.roles } : {}),
      // Emitted the way `roles` is: only when there is something to say. A
      // trace carrying no coordinator marker has no residue to report, and a
      // zeroed block would read as a coordinator that spent nothing.
      ...(r.coordinator ? { coordinator: r.coordinator } : {}),
      ...(r.malformed ? { malformed: r.malformed } : {}),
      ...(full
        ? { events: r.events }
        : { brackets: r.brackets, outcomes: r.events.filter((e) => e.family === 'outcome') }),
      unpaired: r.unpaired,
      // Emitted the way `roles` and `coordinator` are - only when there is
      // something to say, so a clean trace's envelope is byte-identical to the
      // one every reader already parses. A bracket closed under a role its
      // dispatch did not name is a prose defect at one of the two sites; it is
      // reported here and billed nowhere (the dispatch stays the authority).
      ...(r.mismatched.length ? { mismatched: r.mismatched } : {}),
    });
  }
  if (sub === 'window') {
    // Scope exactly as `render` and `suggest` take it: no `--phase` is the
    // WHOLE record, because a window ceiling is argued off a milestone's worth
    // of dispatches rather than one phase's.
    let phase;
    if (opts.phase !== undefined) {
      const parsedPhase = requirePhaseArg(opts.phase);
      if (!parsedPhase.ok) return fail('bad-args', 'trace window --phase must be a phase number');
      phase = parsedPhase.raw;
    }
    const r = renderTrace(dir, phase);
    // warnings[] BOUND and ridden on the envelope when non-empty, the rule
    // lib/merge-warnings.mjs holds every mergeLayers callsite to: a torn layer
    // reads every ceiling as unset, so the report silently falls back to the
    // defaults below and a project that deliberately raised one would see its
    // crossings come back with nothing said.
    const { config: windowConfig, warnings } = mergeLayers(join(dir, 'config.json'));
    const set = windowConfig?.workflow?.max_dispatch_tokens;
    /** @type {Record<string, number>} */
    const ceilings = {};
    for (const [role, fallback] of Object.entries(DISPATCH_WINDOW_DEFAULTS)) {
      const v = set?.[role];
      ceilings[role] = v === undefined || v === null ? fallback : v;
    }
    const w = windowBudget(r.file, r.brackets, ceilings);
    return ok({
      checked: 'dispatch-window',
      scope: phase === undefined ? 'all' : String(phase),
      // The record the crossings were read from, which is also the `file` on
      // every problem: a finding that cannot name its source is a number.
      file: r.file,
      ceilings,
      problems: w.problems,
      // Stated at zero rather than omitted, unlike `render`'s conditional keys.
      // This subcommand has no byte-stable envelope to preserve, and the whole
      // point of the two counters is that a reader can tell how much of the
      // record was actually compared - an absent count would read as none.
      compared: w.compared,
      unbudgeted: w.unbudgeted,
      unrecorded: w.unrecorded,
      ...(warnings.length ? { warnings } : {}),
    });
  }
  return fail('usage', 'trace <append|close|render|suggest|window|ignore>');
}

// ---------------------------------------------------------------------------
// risk-check - the detection the blocking `risk_surface` gate fires on, and the
// record that proves it ran (RSK-01/RSK-02).
//
// The defect it closes: detection was `workflows/execute.md` telling a model to
// check a diff against the eight-category prose list in
// references/review-triggers.md. A fire wrote a lifecycle event and a NON-match
// wrote nothing, so the run record could not tell "the detection step was
// skipped" from "it ran and matched nothing", and an omitted check was
// indistinguishable from a clean one.
//
// What changed is not the heuristics - those stay heuristics, in lib/
// risk-diff.mjs - it is that the answer is computed by something that always
// returns one and always appends it. `run` records on EVERY invocation that got
// past argument validation, including the no-match path and the git-failure
// path; `status` refuses a phase holding a completed executor range with no
// record.
// ---------------------------------------------------------------------------

/** The `git diff` body this will read, at most. An oversized range is a
 * REPORTED state (`checked:false`, with the reason on the envelope), never a
 * throw that leaves the caller with no answer at all. */
const RISK_DIFF_MAX_BUFFER = 32 * 1024 * 1024;

/**
 * A ref the caller stated, or null. Refused when it opens with `-`: git would
 * read it as a FLAG, and a gate whose range can be turned into an option by its
 * own argument is a gate that can be told to look at something else.
 * @param {any} raw
 */
function riskRef(raw) {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  if (!t || t.startsWith('-')) return null;
  return t;
}

/**
 * The repository, and the COMMIT IDS a caller's two refs name.
 *
 * RANGE IDENTITY IS THE COMMIT PAIR, never the ref SPELLING.
 * `workflows/execute.md` documents `--head HEAD` for both the `run` call and
 * the `status` call, so a string compare of spellings lets the record left
 * under one value of `HEAD` satisfy a later, wider `HEAD`: a gate fix, a
 * continuation commit or a concurrent write landing between the two calls was
 * never scanned, and the gate still reports `recorded`. The caller's spelling
 * stays on the record for the READER; the id is what is compared. A ref that
 * cannot be resolved is a refusal at both call sites, never a match.
 *
 * `--verify` with a `^{commit}` suffix, so a tag resolves to the commit it
 * names and a ref naming no commit at all is an ERROR rather than some other
 * object's id. `riskRef` has already refused a `-`-leading spelling, so nothing
 * reaching git here can be read as an option.
 * ONE shape on both paths rather than an `ok`-discriminated union: this repo's
 * CI typecheck runs `strict: false`, where narrowing a JSDoc union by its
 * boolean literal does not happen, so the union costs every caller a cast. A
 * failed resolve reads `{ok: false, base: '', head: '', error: <the redacted
 * git message>}`.
 * @param {string} base @param {string} head
 * @returns {{ok: boolean, top: string, base: string, head: string, error: string}}
 */
function resolveRange(base, head) {
  try {
    const top = execFileSync('git', ['rev-parse', '--show-toplevel'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    const id = (/** @type {string} */ ref) => execFileSync('git',
      ['-C', top, 'rev-parse', '--verify', `${ref}^{commit}`],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    return { ok: true, top, base: id(base), head: id(head), error: '' };
  } catch (e) {
    // redactUrl first, the EXP-01 rail cmdLeaseCheck's `no-staged-set` applies:
    // a git failure detail can carry a remote URL with credentials in it.
    return {
      ok: false,
      top: '',
      base: '',
      head: '',
      error: redactUrl(e && e.message ? e.message : String(e)),
    };
  }
}

function cmdRiskCheckRun(dir, opts) {
  const parsedPhase = requirePhaseArg(opts.phase);
  if (!parsedPhase.ok) return fail('bad-args', 'risk-check run needs --phase <N>');
  const n = parsedPhase.value;

  // THE WORKER KEY, through the one grammar both faces read (RSK-03, D-02).
  // Not `requireInt`: `status` derives what it demands from the lifecycle
  // brackets, where `references/seams.md` permits a non-numeric worker key, so
  // a fix pass bracketed `1-fix` used to leave a blocking gate no argv could
  // satisfy - `run --plan 1-fix` answered `bad-args`. The VAL-01 rail
  // `requireInt` was standing for survives inside the predicate: a VALUELESS
  // flag arrives as the boolean `true`, `Number(true)` is `1`, and a non-string
  // is refused first.
  let plan;
  if ('plan' in opts) {
    const parsedPlan = requirePlanKey(opts.plan);
    if (!parsedPlan.ok) {
      return fail('bad-args', 'risk-check run --plan needs the worker key after it - a plan number '
        + 'or the key the dispatch was bracketed under (`1-fix`): --plan <k>');
    }
    plan = parsedPlan.key;
  }

  // BOTH required, and neither defaulted: a defaulted head is a range the
  // caller never stated, and this record is the evidence of what was checked.
  const base = riskRef(opts.base);
  const head = riskRef(opts.head);
  if (!base || !head) {
    return fail('bad-args', 'risk-check run needs --base <ref> and --head <ref>, neither opening with `-`');
  }

  // The scope of the check, narrowed only by what the caller named. A token
  // outside the eight is a malformed CALL - refused, with NOTHING appended, the
  // rule `trace append --tokens` already states - because a caller who mistyped
  // the scope of a blocking gate must see a refusal rather than a narrowed
  // clean answer.
  // THE ONE-TIME SURFACE QUESTION, read BEFORE the `--surfaces` branch so both
  // arms see the same two facts.
  //
  // mergeLayers warnings[]: a layer that did not PARSE is refused here whatever
  // the caller passed - this envelope is the surfacing, and the detail names
  // what tore. It sits ahead of the branch deliberately: a torn layer that only
  // an unflagged call noticed would be a fail-closed rule an explicit flag
  // could step around, which is not a rule.
  const { config: surfaceConfig, warnings: surfaceWarnings } = mergeLayers(join(dir, 'config.json'));
  if (surfaceWarnings.length) {
    return fail('surfaces-unanswered',
      `a config layer did not parse, so the surface question cannot be read as answered: ${surfaceWarnings.join('; ')}`);
  }
  const surfaceTriggers = isPlainObject(surfaceConfig.review)
    && isPlainObject(surfaceConfig.review.triggers) ? surfaceConfig.review.triggers : {};
  const wrote = isPlainObject(surfaceTriggers.risk_surface)
    ? surfaceTriggers.risk_surface.surfaces : undefined;

  let categories = [...CATEGORIES];
  if ('surfaces' in opts) {
    const raw = typeof opts.surfaces === 'string' ? opts.surfaces : '';
    const tokens = raw.split(',').map((t) => t.trim()).filter(Boolean);
    if (!tokens.length) {
      return fail('bad-args', 'risk-check run --surfaces needs a comma-separated list after it: --surfaces <a,b,c>');
    }
    const unknown = tokens.filter((t) => !CATEGORIES.includes(t));
    if (unknown.length) {
      return fail('bad-args',
        `risk-check run --surfaces names ${unknown.join(', ')}, which is not one of ${CATEGORIES.join(', ')}`);
    }
    categories = [...new Set(tokens)];
  } else {
    // THE TEETH ON THE ONE-TIME SURFACE QUESTION.
    // `references/review-triggers.md` states that a `risk_surface` fire whose
    // resolve reports `surfaces_answered: false` "does not proceed to detection
    // until the project has answered". Detection is THIS subcommand, and until
    // now that sentence was enforced by nothing: `route.mjs` emitted the flag,
    // every consumer read the surfaces array beside it, and an unanswered
    // project was byte-identical to an answered one at every point after the
    // resolve. Measured on a sibling project 2026-08-19: seven blocking
    // `risk_surface` fires across three phases, the question never put to the
    // user, found only because the user asked why no scan had happened.
    //
    // A caller that NAMED `--surfaces` has already resolved the scope and is
    // untouched by this arm - the refusal is precisely for the caller that
    // let the default stand, because that default is the all-eight set nobody
    // chose. `detail` names the two commands that settle it rather than only
    // reporting the state, since the ask lives on this path alone
    // (`detect-surfaces` has no other caller in the tree).
    const decided = answeredSurfaces(wrote, surfaceVocabulary());
    if (!decided.answered) {
      return fail('surfaces-unanswered',
        'no config layer answered review.triggers.risk_surface.surfaces, so detection would run '
        + `on the ${CATEGORIES.length} categories nobody chose. Run \`detect-surfaces --root .\` `
        + 'and put the choice to the user (references/review-triggers.md), or pass '
        + '--surfaces <a,b,c> to state this run\'s scope explicitly');
    }
    categories = [...new Set(decided.surfaces)];
  }

  let body = null;
  let diffError = null;
  // The IDS the caller's refs name, resolved before anything is read: they are
  // this record's range identity, and `risk-check status` compares them rather
  // than the spellings (see resolveRange). Null when the refs did not resolve,
  // in which case nothing was read either and the record says so.
  let baseId = null;
  let headId = null;
  const range = resolveRange(base, head);
  if (!range.ok) {
    diffError = range.error;
  } else {
    baseId = range.base;
    headId = range.head;
    try {
      // `-C top`, the way cmdLeaseCheck reads its staged set, so the range is
      // the repository's and not the cwd's, and the resolved IDS rather than
      // the spellings, so the body read is exactly the range recorded. The
      // trailing `--` ends the revision list: a ref that also names a path
      // cannot turn into a pathspec here.
      body = execFileSync('git', ['-C', range.top, 'diff', baseId, headId, '--'],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: RISK_DIFF_MAX_BUFFER });
    } catch (e) {
      // redactUrl first, the EXP-01 rail cmdLeaseCheck's `no-staged-set`
      // applies: a git failure detail can carry a remote URL with credentials.
      diffError = redactUrl(e && e.message ? e.message : String(e));
    }
  }

  const scan = scanDiff(body, categories);

  // Appended BEFORE the envelope is emitted, and on every path past argument
  // validation - the no-match path and the git-failure path included - so even
  // a refusal leaves the record saying the check was ATTEMPTED. `appendEvent`
  // never throws and never speaks; its `{written, reason}` rides the envelope
  // so a trace that could not be written is reported rather than silently
  // dropped, and it may NOT change the verdict.
  //
  // `plan` is the caller's OWN spelling, verbatim, exactly as a prose
  // `trace append --plan` stores it - the two must be one string or the receipt
  // settles nothing (D-01's stated cost). `risk-check status` stringifies both
  // sides before comparing, the way lib/trace.mjs's own `key()` does, so a
  // record written `1` and a bracket written `"1"` still join.
  const res = appendEvent(dir, {
    phase: parsedPhase.raw,
    family: 'outcome',
    event: 'risk_check',
    ...(plan === undefined ? {} : { plan }),
    // Both spellings AND both ids, always: the spelling is what the reader
    // recognises, the id is the range's identity. Written even when null, so a
    // record from a run that resolved nothing is visibly unidentifiable rather
    // than silently absent a field.
    base,
    head,
    base_id: baseId,
    head_id: headId,
    checked: scan.checked,
    categories: scan.categories,
    // TOKENS on the record, the `{category, signal}` pairs on the envelope: the
    // record is joined and counted, the envelope is read by the fire site that
    // has to state a reason.
    matches: scan.matches.map((m) => m.category),
    inconclusive: scan.inconclusive,
  });

  const envelope = {
    phase: n,
    ...(plan === undefined ? {} : { plan }),
    base,
    head,
    base_id: baseId,
    head_id: headId,
    checked: scan.checked,
    categories: scan.categories,
    matches: scan.matches,
    inconclusive: scan.inconclusive,
    trace: { written: res.written, ...(res.reason ? { reason: res.reason } : {}) },
  };

  // A range that could not be READ is never ok: a caller must not be able to
  // take "git refused" for "clean".
  if (diffError !== null) {
    return emit({ ok: false, reason: 'no-diff', detail: diffError, ...envelope });
  }
  return ok(envelope);
}

/**
 * A plan identity as ONE spelling. `trace append --plan` stores the caller's
 * string and `risk-check run` stores the parsed number, so both sides of every
 * comparison are stringified - the rule lib/trace.mjs's own `key()` follows for
 * the same reason. A row with no plan at all keys to '' and is still carried:
 * an unidentified completed range is not an exempt one. The correlation id is
 * compared through this too - one normalization for both identity fields, so a
 * `corr` that arrived as a non-string cannot compare unequal to its own value.
 * @param {any} v
 */
const planKey = (v) => (v === undefined || v === null ? '' : String(v));

/** The trigger a risk RECEIPT has to name. One constant, because the detector
 * that writes the record and the gate that fires on it are the same trigger,
 * and a second spelling is how the two halves start clearing each other. */
const RISK_TRIGGER = 'risk_surface';

/**
 * The four `outcome` event names a blocking `risk_surface` fire can settle at,
 * and the whole vocabulary `risk-check status` accepts as proof the fire
 * HAPPENED (GAT-04):
 *   - `adjudication` - the adjudicated arm reported its survivors
 *   - `rearm`        - the one-round re-arm fired a narrowed second round
 *   - `gate_pass`    - the fire came back with nothing blocker/high
 *   - `override`     - the user cleared a FAIL deliberately, reason on file
 * `gate_pass` is here because the roadmap's stated acceptance set has no arm
 * for a clean pass and a blocking PASS wrote nothing: without it, every matched
 * range whose fire found no blocker would be permanently unclearable, and this
 * tree has already stated its verdict on that shape - an unclearable gate is
 * one that gets bypassed. A FIFTH name would be a state nothing produces; the
 * producers are references/triage-gate.md and references/review-triggers.md.
 */
const FIRE_RECEIPTS = ['adjudication', 'rearm', 'gate_pass', 'override'];

function cmdRiskCheckStatus(dir, opts) {
  const parsedPhase = requirePhaseArg(opts.phase);
  if (!parsedPhase.ok) return fail('bad-args', 'risk-check status needs --phase <N>');
  const n = parsedPhase.value;

  // The triple is all three or none. A plan number alone is NOT a range
  // identity, and two of the three would let a caller ask about a range it only
  // half named - which reads as the phase-wide arm and passes on a record left
  // by some other range.
  const given = ['plan', 'base', 'head'].filter((f) => f in opts);
  /** @type {{plan: string, base: string, head: string, base_id: string, head_id: string} | null} */
  let wanted = null;
  if (given.length) {
    if (given.length !== 3) {
      return fail('bad-args',
        'risk-check status takes --plan <k> --base <ref> --head <ref> together, or none of the three');
    }
    // The SAME predicate `risk-check run` reads (D-02). One consultation each,
    // so the face that enforces the question and the face that reports it
    // cannot disagree about which spellings are keys at all.
    const parsedPlan = requirePlanKey(opts.plan);
    if (!parsedPlan.ok) {
      return fail('bad-args', 'risk-check status --plan needs the worker key after it - a plan '
        + 'number or the key the dispatch was bracketed under (`1-fix`): --plan <k>');
    }
    const base = riskRef(opts.base);
    const head = riskRef(opts.head);
    if (!base || !head) {
      return fail('bad-args', 'risk-check status needs --base <ref> and --head <ref>, neither opening with `-`');
    }
    // The COMMIT PAIR is the identity, not the spelling (see resolveRange), so
    // the asked range is resolved here and compared as ids below. A ref that
    // cannot be resolved is a REFUSAL and never a match: a gate that shrugged
    // at an unresolvable range would answer about a range nobody can point at,
    // and the only safe answer to "which commits are these" is the one git
    // gives.
    const resolved = resolveRange(base, head);
    if (!resolved.ok) {
      return emit({
        ok: false,
        reason: 'unresolved-range',
        phase: n,
        plan: parsedPlan.key,
        base,
        head,
        detail: resolved.error,
        hint: 'name a --base and --head this repository can resolve, then re-run this check',
      });
    }
    wanted = { plan: parsedPlan.key, base, head, base_id: resolved.base, head_id: resolved.head };
  }

  // ONE reader of the record, through renderTrace and nothing else: a second
  // reader is how two readers of one record start disagreeing about what
  // closed, which is the reason renderTrace exposes its paired `brackets` at
  // all.
  const r = renderTrace(dir, parsedPhase.raw);

  /**
   * THIS RUN, not every cycle that ever used this phase number.
   *
   * `.planning/trace.jsonl` is append-only across the whole project and phase
   * numbers restart every milestone, so `--phase 1` reaches every previous
   * cycle's phase 1 - on this repository, seven prior runs' executor brackets,
   * two of them for a plan 2 that predates this seam. Scanning all of them
   * demanded a risk record for ranges committed under a v3.4.x cycle and made
   * the gate unsatisfiable on any project with more than one milestone of
   * history: the check built to stop "not run" passing as "ran clean" never
   * passed at all.
   *
   * The scope is `renderTrace`'s own `corr` - the id derived from the phase's
   * NEWEST anchor - which is the same identity the ONE-round re-arm cap in
   * references/triage-gate.md keys on ("a `rearm` outcome for this trigger
   * already recorded under that same id"), and the same id `appendEvent`
   * stamped on the record `risk-check run` wrote moments earlier. Both scans
   * take it, for one reason: a record left under a previous cycle's id must not
   * satisfy this cycle's range either, or scoping the brackets alone would
   * trade an unsatisfiable gate for a forgeable one.
   *
   * A trace with no readable id to scope by (`corr` null or empty, which
   * `requirePhaseArg` should already have made impossible) keeps the unscoped
   * behaviour: requiring MORE is the safe direction here, and silently matching
   * nothing would turn the whole gate into a blanket pass.
   */
  /**
   * THIS CYCLE, bounded by the phase's own last sign-off - not the newest
   * anchor alone.
   *
   * Scoping to `renderTrace`'s `corr` alone was too narrow in the other
   * direction. `workflows/execute.md` anchors each invocation at
   * `git rev-parse --short HEAD`, so a phase run across more than one
   * /cad-execute - a resumed session, a continuation after a checkpoint - takes
   * a DIFFERENT id the moment its first commits land, and every range the
   * earlier invocation completed fell outside the filter. That is the same
   * silence this gate exists to break, arriving as an exemption rather than an
   * absence.
   *
   * The bound is the phase's own `uat_verdict` `complete` outcome, which
   * `workflows/verify.md` appends when the phase passes: everything after the
   * newest one is the cycle in hand, everything at or before it belongs to a
   * cycle that was already signed off. `partial` is deliberately not a bound -
   * a partial UAT session is the middle of a cycle, and cutting there would
   * exempt the work that preceded it. A phase with no sign-off at all has
   * never completed, so its whole history IS the current cycle and nothing is
   * dropped.
   */
  // EPOCH MILLISECONDS, never the raw string. A lexicographic compare over
  // whatever `ts` happens to hold is a gate that opens on a typo: a sign-off
  // stamped `"zzzz"` sorts above every real ISO timestamp, so every completed
  // range in the file falls before the bound and the phase reports clean with
  // no rows at all. An unparseable timestamp is not a later one.
  const stamp = (/** @type {any} */ v) => {
    if (typeof v !== 'string') return null;
    const ms = Date.parse(v);
    return Number.isFinite(ms) ? ms : null;
  };

  let signoff = null;
  for (const e of r.events) {
    if (e.family !== 'outcome' || e.event !== 'uat_verdict' || e.detail !== 'complete') continue;
    // An unreadable sign-off is NOT a bound. It cannot say when the cycle
    // closed, and the only safe reading of "I do not know" here is that no
    // cycle closed - which requires more, never less.
    const ts = stamp(e.ts);
    if (ts === null) continue;
    if (signoff === null || ts > signoff) signoff = ts;
  }
  /**
   * Everything is in the cycle unless it can be PROVED to sit at or before a
   * readable sign-off. The direction is the whole point: an event carrying no
   * `ts`, an unparseable one, or one written by a clock that moved backwards
   * stays REQUIRED rather than silently exempt, because a completed range this
   * gate cannot place is exactly the range it must not clear. `>=`, not `>`,
   * for the same reason - an event sharing the sign-off's own instant is
   * ambiguous, and ambiguity resolves toward requiring the record.
   */
  const inCycle = (/** @type {{ts?: any}} */ e) => {
    if (signoff === null) return true;
    const ts = stamp(e.ts);
    return ts === null || ts >= signoff;
  };

  /** A row identity is the RUN and the plan together. Pairing a bracket with a
   * record under its own `corr` is what makes a multi-invocation phase answer
   * per invocation: the ranges invocation 1 completed need invocation 1's
   * records, and invocation 2 cannot clear them by checking its own. */
  const rowKey = (/** @type {any} */ corr, /** @type {any} */ plan) =>
    `${planKey(corr)}\u0000${planKey(plan)}`;

  /** Completed ranges, keyed by plan. A COMPLETED range is an executor bracket
   * whose terminal is a `return`; a `checkpoint` closed a dispatch that came
   * back unfinished and requires nothing. Grouping by plan is what makes a
   * checkpoint-then-return continuation count once rather than twice. */
  /** @type {Map<string, {run: string|null, plan: string|null, completed: number}>} */
  const completed = new Map();
  const planRow = (/** @type {any} */ corr, /** @type {any} */ plan) => {
    const k = rowKey(corr, plan);
    let row = completed.get(k);
    if (!row) {
      row = {
        run: planKey(corr) === '' ? null : planKey(corr),
        plan: planKey(plan) === '' ? null : planKey(plan),
        completed: 0,
      };
      completed.set(k, row);
    }
    return row;
  };
  /**
   * A bracket carrying a key the worker-key grammar REFUSES (RSK-03).
   *
   * The ONE bounded exception to "status does not narrow" (D-01), and it is the
   * opposite of the exclusion arm that decision rejected. A key `lib/plan-key.mjs`
   * refuses is not a legal worker key at all, so `risk-check run --plan <it>`
   * can never write the record this gate would demand: requiring one leaves a
   * gate that is blocking at every stakes level permanently unsatisfiable, with
   * no exit but an `override`. So it is REPORTED, on its own `malformed` list,
   * rather than silently dropped - which is exactly what made the excluded-key
   * arm fail-open. A key the predicate ACCEPTS is never dropped.
   *
   * An ABSENT plan is NOT malformed and keeps its row: `risk-check run` with no
   * `--plan` writes a record that keys to '' and joins it, so an unidentified
   * completed range stays required, exactly as the row comment above says.
   * Nothing in the tree mints a refused key today - `workflows/execute.md` now
   * states the continuation key - so this guards the write face D-03 leaves
   * open on purpose, where `trace append --plan` still stores any non-empty
   * string.
   * @type {Set<string>}
   */
  const malformed = new Set();
  for (const b of r.brackets) {
    if (!inCycle(b)) continue;
    if (b.role !== 'cad-executor' || b.event !== 'return') continue;
    const spelled = planKey(b.plan);
    if (spelled !== '' && !requirePlanKey(b.plan).ok) { malformed.add(spelled); continue; }
    planRow(b.corr, b.plan).completed++;
  }
  // A named range is required whether or not its return has landed yet: the
  // caller states the range it just committed, and a bracket that never paired
  // must not turn the gate off. It rides THIS invocation's id, which is the
  // one the caller is reporting for.
  if (wanted) planRow(r.corr, wanted.plan);

  /**
   * Every record the phase holds, keyed by plan, carrying its VERDICT fields
   * beside its refs - because a record is not the same thing as a check.
   * `risk-check run` appends on every path past argument validation, the
   * git-failure path included, so a `checked:false` line means the check was
   * ATTEMPTED and read no diff at all. Matching a ref pair off one of those and
   * reporting `recorded` is the exact state RSK-02 exists to refuse: completion
   * would pass on a check that never saw the range.
   *
   * `inconclusive` is the OPPOSITE call, deliberately. A `checked:true,
   * inconclusive:true` record IS a completed check - the seam read the range
   * and honestly reported that part of it cannot be judged - so it satisfies
   * this gate and rides the row with the flag visible rather than collapsed.
   * "An unjudged range is not a cleared one" is enforced at the FIRE site,
   * which is where a response to it exists: `workflows/execute.md` fires
   * `risk_surface` on `inconclusive: true` exactly as it does on a match.
   * Refusing here instead would make a range holding a binary file or a
   * submodule bump permanently unclearable - the caller cannot make git render
   * it - and an unclearable gate is one that gets bypassed.
   * @type {Map<string, {base: any, head: any, base_id: string|null, head_id: string|null,
   *   checked: boolean, inconclusive: boolean}[]>}
   */
  const records = new Map();
  /** The same records keyed by PLAN alone, for the named-range arm. That arm
   * identifies a range by its resolved commit pair, which is a stronger
   * identity than the invocation that wrote it, so a record for exactly those
   * two commits satisfies it wherever in the cycle it was written.
   * @type {Map<string, any[]>} */
  const byPlan = new Map();
  for (const e of r.events) {
    if (!inCycle(e)) continue;
    if (e.family !== 'outcome' || e.event !== 'risk_check') continue;
    const k = rowKey(e.corr, e.plan);
    if (!records.has(k)) records.set(k, []);
    const p = planKey(e.plan);
    if (!byPlan.has(p)) byPlan.set(p, []);
    const rec = {
      base: e.base === undefined ? null : e.base,
      head: e.head === undefined ? null : e.head,
      // The resolved ids the range is IDENTIFIED by, null when the record does
      // not carry them - a record written before `run` resolved its refs, or by
      // a run whose refs did not resolve. Null never matches, so such a record
      // reports `stale` and the range is re-run: the safe direction, and the
      // only one available, since the spelling it does carry cannot say which
      // commits it meant.
      base_id: typeof e.base_id === 'string' && e.base_id ? e.base_id : null,
      head_id: typeof e.head_id === 'string' && e.head_id ? e.head_id : null,
      // `=== true`, never truthiness: a record written by an older seam carries
      // neither field, and an absent verdict is not a passing one.
      checked: e.checked === true,
      inconclusive: e.inconclusive === true,
      // The category TOKENS `cmdRiskCheckRun` writes onto every record and this
      // reader used to drop. They are what makes a range FIRED: a record
      // carrying one is a range workflows/execute.md was obliged to fire the
      // blocking `risk_surface` gate on. A non-array (an older seam, a
      // hand-edited line) reads as no tokens, never as a match nobody can name.
      matches: Array.isArray(e.matches) ? e.matches.filter((m) => typeof m === 'string') : [],
      // A non-empty `matches` whose elements are not strings is a range the
      // detector MATCHED and this reader cannot name. Filtering it to `[]`
      // silently turned a fired range into a clean one, so the two cases are
      // separated: `matches` stays the tokens that can be reported, and this
      // flag carries "something matched" independently. Widening is the only
      // safe direction on the one gate that is blocking at every stakes level,
      // which is the same rule `inconclusive` already encodes.
      matched_unnamed: Array.isArray(e.matches) && e.matches.length > 0
        && e.matches.filter((m) => typeof m === 'string').length === 0,
    };
    records.get(k).push(rec);
    byPlan.get(p).push(rec);
  }

  /**
   * THE FIRE'S OWN RECEIPTS, keyed the same way the records are (GAT-04).
   *
   * The defect: `risk-check status` proved a range was READ and RECORDED, and
   * stopped there. A coordinator could run the detector, watch it match
   * `secrets`, skip the blocking `risk_surface` fire entirely and still be told
   * `ok:true` - the gate reporting success for the one thing it exists to make
   * unskippable. "The detector ran" and "the fire happened" are two different
   * claims, so they are two different receipts and this reader demands both.
   *
   * Four event names, because those are the four outcomes a blocking fire can
   * reach: the adjudicated arm's `adjudication`, the capped re-arm's `rearm`,
   * and references/triage-gate.md's two settle points - `gate_pass` when
   * nothing blocker/high survived, `override` when the user cleared a FAIL
   * deliberately. A fifth name would be a state nothing produces.
   *
   * The trigger is read off the STRUCTURED `trigger` field and never parsed out
   * of `detail` (D-12): measured on this repository's 35 `outcome/adjudication`
   * events the trigger is spelled four different ways in that free text, so a
   * reader that parsed it would clear a range on a spelling and refuse an
   * identical one on another.
   * Each receipt carries the row identity it was written under plus the RANGE
   * it settled, so a later matched range cannot ride in on an earlier fire.
   * @type {{key: string, sha: string|null, base: string|null}[]}
   */
  const receipts = [];
  for (const e of r.events) {
    if (!inCycle(e)) continue;
    if (e.family !== 'outcome' || !FIRE_RECEIPTS.includes(e.event)) continue;
    if (e.trigger !== RISK_TRIGGER) continue;
    // An `override` is the one receipt a coordinator writes on its OWN say-so
    // rather than as the settled outcome of a review, so it is the one that has
    // to carry a reason. Without this, `trace append --family outcome --event
    // override --trigger risk_surface --plan k` with no detail at all mints a
    // clear for a fire nobody made - the same manufactured-receipt shape the
    // structured `--trigger` field exists to refuse (D-12).
    if (e.event === 'override') {
      const why = typeof e.detail === 'string' ? e.detail.trim() : '';
      if (!why) continue;
    }
    receipts.push({ key: rowKey(e.corr, e.plan), sha: typeof e.sha === 'string' ? e.sha : null, base: typeof e.base === 'string' ? e.base : null });
  }

  /**
   * Does a receipt settle THIS range?
   *
   * The join used to be `rowKey(corr, plan)` alone, and that cleared every later
   * matched range for the plan on the strength of one earlier fire: run the
   * detector, fire once, fix something, re-run the detector on the widened
   * range, skip the second fire - and status still answered `ok:true`. That is
   * the defect GAT-04 exists to close, one level up inside the control itself.
   *
   * So a receipt names the range it settles, with `trace append --sha <head>`.
   * Short and full spellings both resolve to the same commit, so the comparison
   * is prefix-wise in whichever direction is shorter, exactly as a caller who
   * passed `git rev-parse --short HEAD` would expect.
   *
   * A receipt carrying NO sha settles nothing. That is the transition cost,
   * stated rather than hidden: a receipt that cannot say which range it judged
   * is the ambiguity this fix removes, and accepting it as a wildcard would
   * leave the hole open under a different name.
   */
  const shaMatches = (/** @type {string|null} */ a, /** @type {string|null} */ b) => {
    if (!a || !b) return false;
    const [x, y] = a.length <= b.length ? [a, b] : [b, a];
    return x.length >= 7 && y.startsWith(x);
  };
  /**
   * Does a receipt settle THIS ONE record?
   *
   * Both ends of the range, not the head alone: two records can share a head
   * and differ at the base, and they are then different diffs over different
   * risk surfaces. A receipt for `B..C` must not settle `A..C`.
   *
   * A record that carries no resolved ids has no range identity to bind to - it
   * predates those fields, or its refs did not resolve - so the join falls back
   * to the run and the plan for THAT record alone. The alternative is a range
   * no receipt can ever settle, and an unclearable gate is one that gets
   * bypassed. Every record `risk-check run` writes today carries the ids, so
   * this is the legacy arm, exactly as wide as the records that lack them.
   */
  const settledBy = (/** @type {any} */ rc, /** @type {any} */ f) => (
    f.head_id === null && f.base_id === null
      ? true
      // Both ends REQUIRED, never "matched if supplied". Letting a receipt with
      // no `--base` pass on the head alone reopened the widened-range bypass
      // under a different name: a fire over `B..C` would settle `A..C`, which
      // is a different diff over a different surface.
      : shaMatches(rc.sha, f.head_id) && shaMatches(rc.base, f.base_id));
  /**
   * EVERY fired record this row answers for needs its own receipt.
   *
   * `.some()` here was the blocker's second half: on the phase-wide arm
   * `satisfying` is every usable record for the plan, so one receipted range
   * cleared a later unreceipted one - the same defect the range binding closed
   * on the named arm, still open one branch over.
   */
  const settles = (/** @type {string} */ k, /** @type {any[]} */ satisfying) =>
    satisfying
      .filter((f) => f.matches.length > 0 || f.inconclusive || f.matched_unnamed)
      .every((f) => receipts.some((rc) => rc.key === k && settledBy(rc, f)));

  const rows = [...completed.entries()].map(([k, row]) => {
    const asked0 = wanted && planKey(wanted.plan) === planKey(row.plan)
      && row.run === (planKey(r.corr) === '' ? null : planKey(r.corr));
    const found = asked0 ? (byPlan.get(planKey(row.plan)) || []) : (records.get(k) || []);
    // Only a record whose read SUCCEEDED can satisfy the gate; the rest are
    // reported so the reader sees an attempt rather than an absence.
    const usable = found.filter((f) => f.checked);
    const asked = asked0
      ? { base: wanted.base, head: wanted.head, base_id: wanted.base_id, head_id: wanted.head_id }
      : null;
    // COMMIT IDS on both sides. Comparing the spellings is what let a record
    // left under `--head HEAD` satisfy a later, wider `--head HEAD` - the very
    // spelling workflows/execute.md documents for both calls.
    const sameRange = (/** @type {{base_id: string|null, head_id: string|null}} */ f) =>
      f.base_id !== null && f.head_id !== null
      && f.base_id === asked.base_id && f.head_id === asked.head_id;
    // STALE, not satisfied: a plan re-dispatched over a widened range
    // (execute.md's "re-dispatch the remainder" arm) is exactly the case that
    // would otherwise pass on the record its earlier, narrower range left. Both
    // ref pairs are named so the reader can see which one it has. UNCHECKED is
    // the third state: the range was named and attempted, and nothing was read.
    //
    // The records that actually SATISFY the row, which is a narrower set than
    // `usable` on the named-range arm: only a record for the asked commit pair
    // answers there. Both the state below and the fire receipt read this same
    // set, so the row cannot be `recorded` on one record and judged fired on
    // another.
    const satisfying = asked ? usable.filter(sameRange) : usable;
    // A FIRED range: the detector read it and came back with category tokens or
    // with `inconclusive: true`, which is the pair of conditions
    // workflows/execute.md fires the blocking `risk_surface` gate on. Anything
    // else is a range the gate had no reason to fire on, and demanding a
    // receipt for it would refuse a clean phase.
    const fired = satisfying.some((f) => f.matches.length > 0 || f.inconclusive || f.matched_unnamed);
    // UNFIRED is the fifth state, and it sits ON TOP of the four above rather
    // than in place of any of them: a record that never read its range is still
    // `unchecked`, a stale one is still `stale`. This one is reached only where
    // the range WAS read and recorded, matched, and no receipt says the fire
    // that had to follow ever happened. The join is the row's own identity -
    // `rowKey(corr, plan)`, which for the asked row is the
    // `planRow(r.corr, wanted.plan)` this invocation registered.
    const state = asked
      ? (usable.some(sameRange) ? (fired && !settles(k, satisfying) ? 'unfired' : 'recorded')
        : found.some(sameRange) ? 'unchecked'
          : found.length ? 'stale' : 'missing')
      : (usable.length ? (fired && !settles(k, satisfying) ? 'unfired' : 'recorded')
        : (found.length ? 'unchecked' : 'missing'));
    // `matched_unnamed` is this reader's own conservative flag, not part of the
    // record a caller wrote, so it stays out of the reported shape - the rows
    // report what the trace holds.
    const pub = found.map(({ matched_unnamed: _u, ...rest }) => rest);
    return { ...row, state, records: pub, ...(asked ? { wanted: asked } : {}) };
  });

  const offending = rows.filter((row) => row.state !== 'recorded');
  if (offending.length) {
    // The hint names the step that is actually MISSING. Every offending row in
    // the `unfired` state has its record already: telling that caller to re-run
    // the detector would send it to re-do the half it did, and leave the gate
    // refusing for the same reason a second time. Where the offending set is
    // mixed, the record hint leads - the fire cannot be recorded for a range
    // nothing has read.
    const unfiredOnly = offending.every((row) => row.state === 'unfired');
    // Emitted directly rather than through fail(): its reason/detail/hint shape
    // has no channel for the list, and the list is the whole point of the
    // refusal - exactly as cmdLeaseCheck's `undeclared-files` arm reasons.
    return emit({
      ok: false,
      reason: unfiredOnly ? 'risk-fire-missing' : 'risk-record-missing',
      phase: n,
      plans: rows,
      missing: offending.map((row) => row.plan),
      // Never folded into `missing`: these are not ranges awaiting a record,
      // they are keys no record can be written for, and a caller sent to
      // `risk-check run --plan <one of them>` would be sent to a refusal.
      ...(malformed.size ? { malformed: [...malformed] } : {}),
      hint: unfiredOnly
        ? `fire the blocking ${RISK_TRIGGER} review for each plan listed and record its outcome`
          + ` (one of ${FIRE_RECEIPTS.join(', ')}) under this phase's correlation id and that plan,`
          + ' then re-run this check'
        : `run risk-check run --phase ${parsedPhase.raw} --plan <k> --base <ref> --head <ref>`
          + ' for each plan listed, then re-run this check',
    });
  }
  // Nothing to require is not a failure: a phase with no completed executor
  // range at all is ok:true with an empty list, or a gate here would block the
  // first plan of every phase. A malformed key rides the PASS too, for the
  // reason it exists: the reader has to be able to see that a bracket was
  // skipped rather than judged, and a pass that said nothing about it would be
  // the silent exclusion D-01 refused.
  ok({ phase: n, plans: rows, ...(malformed.size ? { malformed: [...malformed] } : {}) });
}

function cmdRiskCheck(dir, sub, opts) {
  if (sub === 'run') return cmdRiskCheckRun(dir, opts);
  if (sub === 'status') return cmdRiskCheckStatus(dir, opts);
  return fail('usage', 'risk-check <run|status>');
}

// ---------------------------------------------------------------------------
// adjudication - the record a blocking or adjudicated gate fire leaves beside
// its sibling REVIEW-<trigger>-<discriminator>.md.
//
// THE DEFECT IT CLOSES. A gate settled its findings and then summarized itself:
// the trace kept `<n> survivors of <m> raised`, the finding BODIES were never
// written anywhere, and a refutation - the ruling that DELETES a finding -
// could not be checked against the code it claimed to refute, because the claim
// was gone by the time anyone asked. This seam writes one entry per finding
// RAISED per raising voice, carrying the reviewer's own words, so the auditor
// path `git checkout <head_id>` then open `file:line` is mechanical.
//
// THE GRAMMAR IS lib/adjudication-record.mjs's; THE I/O IS THIS FUNCTION'S.
// The module classifies a composed payload and derives the counts, and every
// decision it cannot make without touching the world - reading the payload
// file, resolving the range, choosing the path, refusing to overwrite - is made
// here. That split is why the module can be tested without a repository.
//
// THE PAYLOAD IS A FILE, never inline JSON (D-03), read through
// `readJsonPayload` - the reader `uat merge` already uses, whose
// `no-payload`/`bad-payload` split is exactly what a truncated or never-written
// file looks like. The record's whole content is verbatim reviewer text with
// arbitrary quoting, so one unescaped quote in a heredoc would make the payload
// unparseable after the adjudication was already done and could not be redone.
//
// THE IDS ARE RESOLVED HERE AND THE CALLER'S SPELLING IS NOT TRUSTED (D-08):
// measured on this repository, 44 of the 52 outcome receipts carrying a `base`
// spell it 7-char, and `workflows/execute.md` passes the literal `HEAD`, which
// is not a commit id at all. An unresolvable range is a REFUSAL rather than a
// record with null ids - a record whose head cannot be checked out is not the
// artifact this subcommand exists to produce.
// ---------------------------------------------------------------------------

/**
 * The spelling `--trigger` and `--discriminator` may carry: the character set
 * the `REVIEW-<trigger>-<discriminator>.md` filenames already on disk use.
 *
 * VALIDATED AND REFUSED, never sanitized, because both reach a FILENAME.
 * `milestone-prune --label` was only TRIMMED before `join(dir, '_archive-' +
 * label)` and a label read out of PROJECT.md escaped the tree (VAL-01);
 * sanitizing silently writes a record under a name the caller did not choose,
 * which is the same class of answer about something nobody asked for. No path
 * separator, no `.` - which takes `..` with it and keeps the `.json` suffix
 * this seam's own - and no leading `-`, so the name can never be read as an
 * option by whatever later walks the directory.
 */
const RECORD_TOKEN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

/**
 * The record's filename, as ONE rule both sides resolve by.
 *
 * The writer below and the receipt recount in `cmdTrace` have to name the same
 * file or the cross-check reads a different fire's rulings than the one being
 * settled - and the failure of that is SILENT, since a recount against round
 * one's record passes whenever the two rounds' counts happen to coincide. Round
 * 1 keeps the sibling `REVIEW-<trigger>-<discriminator>.md`'s exact name; every
 * round above it carries its round, so a re-arm lands beside round one rather
 * than on top of it.
 *
 * @param {string} trigger @param {string} discriminator @param {number} round
 */
const recordName = (trigger, discriminator, round) =>
  `ADJUDICATION-${trigger}-${discriminator}${round > 1 ? `-r${round}` : ''}.json`;

/**
 * The record a receipt SETTLES, as an absolute path, or '' when this fire has
 * none that can be resolved.
 *
 * A receipt names its fire with `--trigger`, `--sha` and - on a per-plan fire -
 * `--plan <k>`, which is the D-06 discriminator grammar minus the spelling: a
 * per-plan fire's discriminator IS `plan-<k>`, and every other fire's is
 * `<command>-<short head sha>`, whose command half no receipt carries. So the
 * per-plan arm resolves ONE name and the other arm matches the directory on the
 * trigger, the round and the head the discriminator ends with, taking a single
 * unambiguous hit and nothing else. Two candidates answer '' rather than a
 * guess: a check that might be reading another fire's rulings is worse than no
 * check, because it refuses a correct receipt.
 *
 * EVERY ARM ANSWERS '' RATHER THAN THROWING. This resolves a cross-check, and
 * an unresolvable one omits the check - it never fails the append.
 *
 * `trigger` is validated against `RECORD_TOKEN` before it reaches `join`, the
 * same rail the writer applies for the same reason (VAL-01): it reaches a
 * FILENAME, and a `--trigger ../../etc` that resolved anything at all would be
 * reading outside the phase directory.
 *
 * @param {string} dir @param {string|number} phaseRaw
 * @param {string|undefined} trigger @param {any} plan @param {any} sha
 * @param {number} round
 * @returns {string}
 */
function recordForFire(dir, phaseRaw, trigger, plan, sha, round) {
  if (typeof trigger !== 'string' || !RECORD_TOKEN.test(trigger)) return '';
  const pdir = join(dir, 'phases', String(phaseRaw));
  /** A regular FILE at `name` under the phase directory, or ''. A symlink is
   * not a record: it is followed out of the tree by every reader after it. */
  const regular = (name) => {
    const file = join(pdir, name);
    try { return lstatSync(file).isFile() ? file : ''; } catch { return ''; }
  };

  const planKey = plan === undefined || plan === null ? '' : String(plan).trim();
  if (planKey) {
    const discriminator = `plan-${planKey}`;
    // Refused here for the reason the writer refuses it: a discriminator
    // outside this grammar names no record the writer could ever have written.
    if (!RECORD_TOKEN.test(discriminator)) return '';
    return regular(recordName(trigger, discriminator, round));
  }

  const head = typeof sha === 'string' ? sha.trim().toLowerCase() : '';
  if (!/^[0-9a-f]{7,40}$/.test(head)) return '';
  const prefix = `ADJUDICATION-${trigger}-`;
  const suffix = round > 1 ? `-r${round}.json` : '.json';
  /** @type {string[]} */
  let names = [];
  try { names = readdirSync(pdir); } catch { return ''; }
  const hits = names.filter((name) => {
    if (!name.startsWith(prefix) || !name.endsWith(suffix)) return false;
    const discriminator = name.slice(prefix.length, name.length - suffix.length);
    // At round 1 the suffix is bare `.json`, which every higher round's file
    // also ends with - so a `-r<n>` tail is another round's record, not this
    // fire's discriminator.
    if (round === 1 && /-r\d+$/.test(discriminator)) return false;
    // The discriminator's last segment is the short head sha. Compared as a
    // PREFIX in whichever direction is shorter, because the receipt may spell
    // the head 7-char or full while the filename is abbreviated.
    const tail = discriminator.slice(discriminator.lastIndexOf('-') + 1).toLowerCase();
    return tail.length >= 7 && (head.startsWith(tail) || tail.startsWith(head));
  });
  return hits.length === 1 ? join(pdir, hits[0]) : '';
}

/**
 * Do this receipt's settled figures agree with the rulings in its fire's own
 * record (AC4/D-01)?
 *
 * WHY IT IS ASKED HERE. The three figures are DERIVED by the `adjudication`
 * seam and copied onto the receipt line by hand, so the receipt is where a
 * mistyped one enters the record - and once appended, the trace and the record
 * disagree forever with nothing saying which is right. Recounting at write time
 * is what makes the survivor count recomputable rather than asserted.
 *
 * ONLY WHEN ALL THREE ARE PRESENT: a partial set cannot be checked against a
 * recount that answers all three, and refusing on one of them would refuse a
 * receipt shape nothing writes.
 *
 * An ABSENT record omits the check - a fire predating the format, or an
 * advisory arm that wrote none. The trace is gitignored, so it is the local
 * cross-check and the committed record is the custody artifact; a receipt that
 * could not be cross-checked is not thereby wrong.
 *
 * @param {string} dir @param {string|number} phaseRaw
 * @param {{trigger: string|undefined, plan: any, sha: any, round: number,
 *   settled: Record<string, number>}} fire
 * @returns {{ok: boolean, reason: string, detail: string, hint: string}}
 */
function recountReceipt(dir, phaseRaw, fire) {
  const keys = ['survivors', 'downgraded', 'refuted'];
  const pass = { ok: true, reason: '', detail: '', hint: '' };
  if (!keys.every((k) => k in fire.settled)) return pass;
  const file = recordForFire(dir, phaseRaw, fire.trigger, fire.plan, fire.sha, fire.round);
  if (!file) return pass;
  const rel = relative(dir, file);

  let record;
  try { record = JSON.parse(readFileSync(file, 'utf8')); } catch {
    // REFUSED, not skipped. This file exists and was written by the seam as
    // one atomic JSON object, so unparseable means truncated or edited - which
    // is precisely the tampering the cross-check exists to surface, and
    // appending a figure nothing can check against it would bury it.
    // The parse error itself is deliberately NOT quoted back: the detail names
    // the file, which is the whole of what a caller acts on here, and echoing a
    // caught message is the idiom planning.test.mjs's redaction census counts.
    return { ok: false, reason: 'bad-record',
      detail: `${rel} exists but is not readable as JSON, so this receipt's counts cannot be `
        + 'checked against its rulings and nothing was appended',
      hint: 'restore or re-write the record for this fire, then append the receipt' };
  }
  const counts = deriveCounts(record && record.entries);
  for (const [flag, counted] of [['survivors', counts.survived],
    ['downgraded', counts.downgraded], ['refuted', counts.refuted]]) {
    if (fire.settled[flag] !== counted) {
      return { ok: false, reason: 'count-disagreement',
        detail: `--${flag} says ${fire.settled[flag]}, but counting the rulings in ${rel} gives `
          + `${counted} - the count is DERIVED from the record, never typed beside it, so `
          + 'nothing was appended',
        hint: `pass the figures the adjudication seam returned for this fire (round ${fire.round})`
          + ', or fix the record if the receipt is the one that is right' };
    }
  }
  return pass;
}

/**
 * Which of these entries cite a `file` that does not EXIST at `headId` (D-09,
 * AC5) - and whether the question could be asked at all.
 *
 * WHY IT IS ASKED. The auditor path this record exists to buy is `git checkout
 * <head_id>` then open `file:line`, and NOTHING upstream checks either field:
 * review-provider.mjs's `FINDING_SCHEMA` bounds `file` only as a non-empty
 * string of at most 1024 characters, and skills/cad-reviewer-contract/SKILL.md
 * calls `line` best-effort in as many words. So the citation is checked here,
 * once, while the head is already resolved - which buys the auditor path
 * instead of demonstrating it.
 *
 * A MARKED ENTRY IS STILL STORED, NEVER DROPPED. The mark is the auditor's
 * warning that the citation cannot be opened; dropping the entry would delete
 * the very finding whose grounding is in question, which is the summarizing
 * this whole record exists to end.
 *
 * THE PROBE FIRST, and this is the load-bearing part. `git cat-file -e
 * <sha>:<path>` exits 128 both for a path absent at that commit and for "this
 * is not a repository" (measured - it is NOT the documented exit 1 on this
 * git), so the two are indistinguishable per entry. The probe asks one question
 * whose answer cannot be about any path - can this repository read the head
 * commit object - and only once it says yes is a later nonzero exit
 * attributable to the citation. A check that could not run AT ALL is reported
 * ONCE by the caller and marks NOTHING: an unprovable citation set is not a bad
 * one, and marking every entry there is the collapsed-stdin defect
 * `land-cleanup.mjs` already cost this project once, rewritten.
 *
 * `-C top` - the repository top `resolveRange` returned - the way
 * `cmdRiskCheckRun` reads its diff, so the answer is the repository's and not
 * the process cwd's.
 *
 * @param {string} top the repository top
 * @param {string} headId the resolved 40-character head id
 * @param {any[]} entries
 * @returns {{checked: boolean, missing: Set<number>, reason: string}}
 *   `checked: false` carries an EMPTY `missing` by construction, so a caller
 *   cannot mark entries against a check that never ran.
 */
function groundCitations(top, headId, entries) {
  const git = (/** @type {string} */ arg) => execFileSync('git',
    ['-C', top, 'cat-file', '-e', arg], { stdio: ['ignore', 'ignore', 'pipe'] });
  try {
    git(`${headId}^{commit}`);
  } catch (e) {
    // redactUrl first, the EXP-01 rail cmdLeaseCheck's `no-staged-set` applies:
    // a git failure detail can carry a remote URL with credentials in it.
    return { checked: false, missing: new Set(),
      reason: redactUrl(e && e.message ? e.message : String(e)) };
  }
  /** @type {Set<number>} */
  const missing = new Set();
  for (let i = 0; i < entries.length; i += 1) {
    // The path is the SECOND half of one `<sha>:<path>` argument, so a citation
    // opening with `-` can never be read by git as an option.
    try { git(`${headId}:${entries[i].file}`); } catch { missing.add(i); }
  }
  return { checked: true, missing, reason: '' };
}

function cmdAdjudication(dir, opts) {
  const parsedPhase = requirePhaseArg(opts.phase);
  if (!parsedPhase.ok) return fail('bad-args', 'adjudication needs --phase <N>');
  // The caller's OWN spelling, the way `uatFile` addresses a phase: every use
  // of it here is a path or a label, never arithmetic.
  const n = parsedPhase.raw;

  const trigger = opts.trigger;
  const discriminator = opts.discriminator;
  for (const [flag, raw] of [['--trigger', trigger], ['--discriminator', discriminator]]) {
    if (typeof raw !== 'string' || !RECORD_TOKEN.test(raw)) {
      return fail('bad-args',
        `adjudication ${flag} reaches a FILENAME, so it takes letters, digits, _ and - `
        + 'only, opening with a letter or a digit and at most 64 characters - got '
        + `${typeof raw === 'string' ? JSON.stringify(raw) : 'nothing'}`);
    }
  }

  // THE RE-ARM'S ROUND. A blocking re-arm (references/triage-gate.md caps it at
  // ONE) is a SECOND fire of the same trigger on the same plan, so it resolves
  // to the same discriminator: without this flag round two's record would
  // replace round one's rulings, and round one is exactly the record an auditor
  // reads to see the finding a fix was claimed to close.
  let round = 1;
  if ('round' in opts) {
    const parsedRound = requireInt(opts.round);
    if (!parsedRound.ok || parsedRound.value < 1) {
      return fail('bad-args',
        'adjudication --round needs the re-arm round after it, a whole number of at '
        + 'least 1: --round 2');
    }
    round = parsedRound.value;
  }

  // BOTH required and neither defaulted, the rule `risk-check run` already
  // states: a defaulted head is a range the caller never stated, and this
  // record IS the evidence of what was judged.
  const base = riskRef(opts.base);
  const head = riskRef(opts.head);
  if (!base || !head) {
    return fail('bad-args',
      'adjudication needs --base <ref> and --head <ref>, neither opening with `-`');
  }

  // Absent `--payload` is refused rather than fed to stdin: the declared row
  // says required, `evaluateRow` is a VALUE door and not a presence one, and
  // `readJsonPayload()` with no argument would sit reading a stdin no gate site
  // opens.
  if (opts.payload === undefined) {
    return fail('bad-args',
      'adjudication needs --payload <file> - the composed payload is a FILE, never '
      + 'inline JSON and never stdin');
  }
  const payload = readJsonPayload(opts.payload);
  if (!payload.ok) return;
  const built = buildEntries(payload.value);
  if (!built.ok) return fail('bad-payload', built.detail);

  const range = resolveRange(base, head);
  if (!range.ok) {
    return emit({
      ok: false,
      reason: 'unresolved-range',
      phase: n,
      base,
      head,
      detail: range.error,
      hint: 'name a --base and --head this repository can resolve, then re-run this record',
    });
  }

  // BESIDE THE SIBLING REVIEW FILE (D-06), and never inside `<plandir>/
  // reports/`: `cmdLeaseCheck` exempts exactly one path under that directory by
  // byte equality, so anything else staged from there answers `undeclared-files`.
  // The phase directory has to already exist - this seam records a fire that
  // happened, and minting `phases/<N>/` for a mistyped flag would leave a
  // directory nothing else in the tree accounts for. `lstatSync`, so a SYMLINK
  // sitting where the phase directory should be is refused rather than followed
  // out of the tree, the disposition the read side of this file already takes.
  const pdir = join(dir, 'phases', String(n));
  let pdirStat = null;
  try { pdirStat = lstatSync(pdir); } catch { /* absent is the answer, never a throw */ }
  if (!pdirStat || !pdirStat.isDirectory()) {
    return fail('no-phase-dir',
      `phases/${n}/ is not a directory under ${dir} - the record is written BESIDE the `
      + 'sibling REVIEW file, so the phase directory of the fire has to exist already');
  }

  // The ONE filename rule, shared with the receipt recount in `cmdTrace`: two
  // spellings of it is two files, and the recount would read the wrong fire.
  const name = recordName(trigger, discriminator, round);
  const rel = `phases/${n}/${name}`;
  const file = join(pdir, name);
  // REFUSED, never overwritten. A caller that forgot `--round` on a re-arm is
  // the failure the flag exists FOR, and replacing the file there lands in
  // exactly the state it was added to prevent: the first round's rulings gone,
  // silently, with ok:true. `lstatSync` again - a symlink at the target is
  // something already there, whatever it points at.
  let existing = null;
  try { existing = lstatSync(file); } catch { /* the ordinary case */ }
  if (existing) {
    return fail('record-exists',
      `${rel} already exists and holds round ${round}'s rulings - this seam never `
      + 'overwrites a record',
      'a re-arm is a SECOND fire of the same trigger on the same plan: pass --round '
      + `${round + 1} so it lands beside round ${round} instead of replacing it`);
  }

  // EVERY CITATION GROUNDED AT THE HEAD (D-09, AC5), before the record is
  // written and after every refusal above, so a refused call does no git work.
  const cites = groundCitations(range.top, range.head, built.entries);

  // ONE COPY OF THE RESOLVED PAIR PER ENTRY, deliberately, on top of the pair
  // on the record's own header: an entry is what gets quoted, copied into a
  // report and argued about, and an entry that cannot say which head it was
  // judged at sends the auditor back to the file it came from to find out.
  const record = {
    phase: n,
    trigger,
    discriminator,
    round,
    // Both spellings AND both ids, the shape `risk-check run` records: the
    // spelling is what the caller recognises, the id is the range's identity.
    base,
    head,
    base_id: range.base,
    head_id: range.head,
    // The ROSTER of voices that ran, which the entries alone cannot carry: a
    // fire where every voice returned nothing has no entries at all, and a
    // record that cannot say which voices ran is not evidence that any did.
    voices: built.voices,
    // WHETHER THE GROUNDING RAN, on the record itself: the absence of a
    // `citation_missing` mark below means "checked and found" only when this
    // says the check happened, and means nothing at all when it did not. No
    // COUNT rides it - the record stores none of its own, and a reader recounts
    // the marks the same way it recounts the rulings.
    citations: cites.checked ? { checked: true } : { checked: false, reason: cites.reason },
    entries: built.entries.map((e, i) => ({
      ...e,
      // MARKED, never dropped: the mark is the auditor's warning that this
      // citation cannot be opened at `head_id`, and the finding whose grounding
      // is in question is the last one a record may lose.
      ...(cites.missing.has(i) ? { citation_missing: true } : {}),
      base_id: range.base,
      head_id: range.head,
    })),
  };
  atomicWrite(file, `${JSON.stringify(record, null, 2)}\n`);

  // The counts ride the ENVELOPE and never the record (the record stores no
  // count of its own): a stored count is a second place for the record to
  // disagree with itself, and the cross-check that matters is between the
  // record and the trace receipt. `deriveCounts` recomputes these from the
  // stored entries for any later reader.
  return ok({
    phase: n,
    trigger,
    discriminator,
    round,
    record: rel,
    base,
    head,
    base_id: range.base,
    head_id: range.head,
    voices: built.voices.length,
    counts: built.counts,
    // The count lives HERE and not on the record, where every figure is derived.
    citations: cites.checked
      ? { checked: true, missing: cites.missing.size }
      : { checked: false, reason: cites.reason },
  });
}

// ---------------------------------------------------------------------------
// renumber - phase insert/remove mechanics. Structured edits (Phase tokens,
// phases/K/ paths, dirs, cursor) are automated; lowercase prose refs are
// reported for the model to repair with judgment. --dry-run computes the full
// operation plan and touches nothing - it is what the confirmation gate shows.
// ---------------------------------------------------------------------------
function gitMv(from, to) {
  try { execFileSync('git', ['mv', from, to], { stdio: 'pipe' }); return 'git'; }
  catch { renameSync(from, to); return 'fs'; }
}

/**
 * Is there a `.git` entry at `from` or at any ancestor? A FILESYSTEM answer,
 * and deliberately not git's own: a `.git` at mode 000 makes `git status` and
 * `git rev-parse` alike exit 128 with `fatal: not a git repository`, byte-
 * identical to a directory that genuinely has no repository above it. So git's
 * exit code and its stderr cannot separate "unreadable" from "absent" at all,
 * and reading the message to try would be a parser over free text - the thing
 * `review-provider.mjs`'s "a diagnostic string never decides control flow" ban
 * exists to stop. The precedent for probing rather than parsing is
 * `gitIgnoreState` above.
 *
 * `lstatSync`, never `existsSync`: a dangling or unreadable symlink named
 * `.git` is still a repository this process could not read, and must count as
 * PRESENT. `existsSync` follows the link, finds nothing, and answers with the
 * permissive arm - the same failure mode `occupied` below was written for.
 *
 * Two states this walk cannot see on its own, both of which would otherwise
 * report ABSENT for a repository that is present:
 *   - `GIT_DIR`/`GIT_WORK_TREE` in the environment select a repository with no
 *     lexical `.git` anywhere above the work tree. The walk finds nothing while
 *     an object store holding the only copy of the work is very much there.
 *   - a probe that ERRORS - EACCES on an ancestor we may not stat, EIO, ESTALE -
 *     is a repository we could not rule OUT, never one we ruled out.
 * Both answer PRESENT. This gate's permissive arm ends in `rmSync`, so
 * "could not tell" and "definitely none" must not share it: the whole point of
 * the check is that an unread git state never reads as a clean one.
 * @param {string} from @returns {boolean}
 */
function gitDirAbove(from) {
  if (process.env.GIT_DIR || process.env.GIT_WORK_TREE) return true;
  try {
    let cur = resolvePath(from);
    for (;;) {
      if (lstatSync(join(cur, '.git'), { throwIfNoEntry: false })) return true;
      const up = dirname(cur);
      if (up === cur) return false;
      cur = up;
    }
  } catch { return true; }
}

/**
 * Is there a `.git` entry anywhere INSIDE `target`? The companion to
 * `gitDirAbove`, which starts at the planning root and looks UP - so a
 * repository rooted inside `phases/<N>` is invisible to it, an otherwise
 * non-repository tree answers ABSENT, and `rmSync` takes that nested object
 * store along with the directory. It is the same failure the caller's refusal
 * exists to stop, reached from the other side.
 *
 * Bounded by the phase directory's own size - a handful of markdown files and
 * a reports dir. A subtree we cannot read answers PRESENT for `gitDirAbove`'s
 * reason; a target that is not there at all answers ABSENT, since there is
 * nothing under it to protect. That is an errno test and not a message parse:
 * `review-provider.mjs`'s ban is on a diagnostic STRING deciding control flow.
 *
 * `lstatSync` per directory, never `e.name === '.git'` over the readdir: a
 * name comparison is case-SENSITIVE while the filesystem underneath may not be,
 * so an admin directory stored as `.GIT` on APFS or NTFS still resolves for git
 * and would be scanned straight past. Probing inherits the filesystem's own
 * case semantics, which is what `gitDirAbove` has always done - a guard whose
 * two halves disagree about what `.git` matches is one half open.
 *
 * Directory recursion is by `isDirectory()`, which is lstat-shaped, so a
 * symlink is never followed and the scan cannot leave the phase directory.
 * @param {string} target @returns {boolean}
 */
function gitDirUnder(target) {
  let entries;
  try {
    if (lstatSync(join(target, '.git'), { throwIfNoEntry: false })) return true;
    entries = readdirSync(target, { withFileTypes: true });
  } catch (e) { return !(e && e.code === 'ENOENT'); }
  for (const e of entries) {
    if (e.isDirectory() && gitDirUnder(join(target, e.name))) return true;
  }
  return false;
}

/**
 * Every path under `relPath` carrying uncommitted state - untracked (`??`),
 * ignored (`!!`), modified, staged, or deleted. All of them make a `remove`
 * unsafe, for two different reasons:
 *   - `??`/`!!`: `git rm -r` exits 0 and LEAVES them, so the directory
 *     survives a removal that reported success and the next move nests into
 *     it.
 *   - modified/staged: `git rm -r` REFUSES ("file has local modifications")
 *     and the caller's `rmSync` fallback then deletes the work anyway, with
 *     no copy in the object store to recover from.
 * Refusing on any porcelain output covers both, and leaves git's own
 * safety check intact instead of overriding it.
 *
 * Return shape: `{paths, unreadable}`, because a failed `git status` is TWO
 * states and answering `[]` for both is a fail-open that deletes. Outside a git
 * repo the call fails and `paths` is empty with `unreadable:false` - correctly,
 * since nothing is tracked there, the `rmSync` fallback removes the directory
 * whole, and no residue can survive to be nested into. But when `gitDirAbove`
 * finds a `.git` the call still failed against, the state is UNREADABLE: the
 * directory may hold tracked work whose only copy is in an object store this
 * process cannot open, and `[]` would classify it as clean and delete it.
 * `unreadable:true` is that third answer, and the caller refuses on it.
 * A record rather than a bare array costs nothing: this has exactly one caller.
 * `relPath` is relative to `cwd`, so this works whether the caller's `--dir`
 * is absolute or relative.
 * @param {string} cwd @param {string} relPath
 * @returns {{paths: string[], unreadable: boolean}}
 */
function uncommittedUnder(cwd, relPath) {
  try {
    const out = execFileSync('git', ['status', '--porcelain', '--ignored', '--', relPath],
      { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return {
      paths: out.split('\n').filter((l) => l.trim()).map((l) => l.slice(3).trim()),
      unreadable: false,
    };
  } catch {
    return { paths: [], unreadable: gitDirAbove(cwd) };
  }
}

// `existsSync` alone follows a symlink and reads a DANGLING one as free -
// the pre-flight would then pass and the apply dies mid-flight (renameSync
// onto a dangling symlink throws ENOTDIR). `lstatSync` catches the link
// itself even when its target is gone.
function occupied(p) { return existsSync(p) || !!lstatSync(p, { throwIfNoEntry: false }); }

function cmdRenumber(dir, sub, opts) {
  if (sub !== 'insert' && sub !== 'remove') return fail('usage', 'renumber <insert --at N | remove --n N> [--dry-run]');
  const roadmapFile = join(dir, 'ROADMAP.md');
  const roadmapText = read(roadmapFile);
  if (roadmapText === null) return fail('no-roadmap', `${roadmapFile} not found`);
  const phases = parseRoadmapPhases(roadmapText);
  if (!phases.length) return fail('unparseable-roadmap', 'no phase lines under ## Phases');
  const total = phases.length;
  // Dir-move ceiling: integer phases only. Decimals are never shifted (see
  // below), and a decimal ceiling would walk fractional ks (2.1, 1.1, ...)
  // past every integer dir - moving nothing it should and the one dir it
  // must not (#36).
  const maxN = Math.max(...phases.filter((p) => Number.isInteger(p.n)).map((p) => p.n));

  const flag = sub === 'insert' ? 'at' : 'n';
  const rawAt = sub === 'insert' ? opts.at : opts.n;
  // A valueless flag parses as the boolean `true` and `Number(true)` is 1, so
  // `renumber remove --n` with no value cut phase 1's line, its detail section
  // and shifted its directory away - ok:true, and only the NaN screen stood
  // between the flag and the apply. requireInt refuses that shape and every
  // non-numeric one.
  //
  // The decimal answer stays a SEPARATE diagnostic (renumbering is integer
  // arithmetic; a decimal insertion like 2.1 neither displaces integers nor is
  // displaced by them, so operating ON one would only half-shift the tree).
  // requireInt refuses `2.1` and `--n` alike, and those are different repairs,
  // so a well-formed decimal is re-tested here and keeps its own wording.
  const parsedAt = requireInt(rawAt);
  // ABSENT only: a PRESENT `--at`/`--n` was already judged by its declared row
  // at the dispatch door, decimal wording included (see `decimalRefusal`), so
  // the well-formed-decimal re-test that used to sit here can no longer be
  // reached and is not left behind as a second home for that sentence.
  if (!parsedAt.ok) return fail('bad-args', `renumber ${sub} needs --${flag} <N>`);
  const at = parsedAt.value;
  if (sub === 'insert' && (at < 1 || at > total + 1)) return fail('out-of-range', `--at must be 1..${total + 1}`);
  if (sub === 'remove' && !phases.some((p) => p.n === at)) return fail('unknown-phase', `phase ${at} is not in ROADMAP.md`);

  const delta = sub === 'insert' ? 1 : -1;
  const shiftFrom = sub === 'insert' ? at : at + 1;

  // Directory moves, in collision-safe order.
  const dirMoves = [];
  const existingDir = (k) => existsSync(join(dir, 'phases', String(k)));
  if (sub === 'insert') {
    for (let k = maxN; k >= at; k--) if (existingDir(k)) dirMoves.push([k, k + 1]);
  } else {
    for (let k = at + 1; k <= maxN; k++) if (existingDir(k)) dirMoves.push([k, k - 1]);
  }

  // Pre-flight: refuse before any write if a move's destination is occupied
  // by something this renumber does not itself vacate (D-04). `vacated`
  // tracks numbers freed by moves already checked (plus `at` on a remove,
  // freed by the rm before any move runs) - without it, an ordinary insert's
  // OWN chain of destinations (e.g. 3->4 then 2->3, where phases/3 exists at
  // check time as move 1's still-unmoved source) would refuse itself. This
  // must run before the `git rm` below: on a remove, the rm destroys a phase
  // directory before the first move, so a check placed after it would report
  // the collision only once the data is already gone.
  // Seeded only when the rm will actually RUN: `existingDir` is existsSync,
  // which is false for a dangling symlink at phases/<at>, so seeding
  // unconditionally waved through exactly the occupant `occupied()`/lstatSync
  // was added to catch - the apply then died on the first move and reported a
  // half-renumbered tree when nothing had been written at all.
  const vacated = new Set(sub === 'remove' && existingDir(at) ? [String(at)] : []);
  for (const [f, t] of dirMoves) {
    const dest = join(dir, 'phases', String(t));
    if (occupied(dest) && !vacated.has(String(t))) {
      return fail('collision',
        `phases/${t} already exists and is not a phase this renumber vacates - move or delete it first`,
        'ls .planning/phases');
    }
    vacated.add(String(f));
  }

  // The `vacated` seeding above assumes the rm actually FREES phases/<at>.
  // `git rm -r -q` breaks that assumption silently: it exits 0 while leaving
  // untracked and ignored files behind, so the directory survives, the first
  // move NESTS the next phase inside it (phases/1/2/PLAN.md), and the command
  // still exits ok:true with ROADMAP naming a phase whose dir has no plan -
  // the exact D-04 nesting hazard, reached through the rm rather than a stray
  // dir. Verified live. Refuse before any write instead of deleting the
  // residue: it is the caller's uncommitted work, and `remove` is not a
  // licence to discard it.
  if (sub === 'remove' && existingDir(at)) {
    const dirty = uncommittedUnder(dir, join('phases', String(at)));
    // A git that could not ANSWER is its own refusal, never `uncommitted-work`:
    // that reason's remedy is "commit or discard them first", which is the one
    // thing a caller whose repository is unreadable cannot do. This sits above
    // the dry-run return below, so both arms refuse - the dry-run is what the
    // workflow's confirmation gate shows, and a gate that displays a clean plan
    // is what talks the caller into the apply.
    if (dirty.unreadable) {
      return fail('unreadable-git-state',
        `phases/${at} sits under a git repository whose state could not be read, so whether it holds uncommitted work is unknown - removing it could destroy work only git can recover`,
        `restore read access to the repository's git directory (ls -ld .git), then re-run; the removal stays refused until git can answer for .planning/phases/${at}`);
    }
    if (dirty.paths.length) {
      return fail('uncommitted-work',
        `phases/${at} holds ${dirty.paths.length} file(s) with uncommitted state (e.g. ${dirty.paths[0]}) - commit or discard them first; removing the phase would destroy work git cannot recover`,
        `git status --porcelain --ignored -- .planning/phases/${at}`);
    }
  }

  // File edits, computed up front.
  let newRoadmap = roadmapText;
  if (sub === 'remove') {
    newRoadmap = newRoadmap.split('\n')
      .filter((l) => !new RegExp(`^- \\[( |x)\\] \\*\\*Phase ${at}: `).test(l)).join('\n');
    newRoadmap = cutPhaseDetail(newRoadmap, at);
  }
  const roadmapShift = shiftPhaseTokens(newRoadmap, shiftFrom, delta);
  newRoadmap = roadmapShift.text;

  const reqFile = join(dir, 'REQUIREMENTS.md');
  const reqText = read(reqFile);
  const orphanedReqs = [];
  let newReqText = null;
  if (reqText !== null) {
    let t = reqText;
    if (sub === 'remove') {
      for (const r of parseRequirements(t)) if (r.phase === at) orphanedReqs.push(r.id);
      // Blank the orphaned rows' Phase cell so they surface as no-phase in
      // audit rather than silently pointing at the shifted neighbor.
      t = t.split('\n').map((line) => {
        const cells = line.match(/^(\|[^|]*\|)([^|]*)(\|[^|]*\|.*)$/);
        if (cells && new RegExp(`\\bPhase ${at}\\b`).test(cells[2])) return `${cells[1]}  ${cells[3]}`;
        return line;
      }).join('\n');
    }
    newReqText = shiftPhaseTokens(t, shiftFrom, delta).text;
  }

  const stateFile = join(dir, 'STATE.md');
  const cursor = parseCursor(read(stateFile) || '');
  let newCursor = null;
  let warn;
  if (cursor) {
    newCursor = { ...cursor, total: total + delta };
    // The phase NUMBER only ever shifts for an integer cursor. A decimal
    // cursor's own ROADMAP token and phases/<phase>/ dir are never shifted
    // either (see decimalPhases below), so moving just the cursor's number
    // would desync it from the phase it actually names - shifting nowhere
    // else is exactly why the number stays put here too. total still moves:
    // the roadmap genuinely gained or lost a phase, so the denominator is
    // still true even while the numerator is left for the caller to re-point.
    if (cursor.phase >= shiftFrom) {
      if (Number.isInteger(cursor.phase)) {
        newCursor.phase = cursor.phase + delta;
      } else {
        warn = `cursor sits on decimal phase ${cursor.phase}, which renumber ` +
          `never shifts (its ROADMAP token and phases/${cursor.phase}/ did not ` +
          `move either); total is now ${total + delta} - re-point it (cursor set)`;
      }
    }
    if (sub === 'remove' && cursor.phase === at) {
      warn = `cursor points at removed phase ${at}; number left as-is - re-point it (cursor set)`;
    }
  }

  // Prose refs the shift leaves alone - the model repairs these with judgment.
  const inTextRefs = [];
  for (const f of ['ROADMAP.md', 'REQUIREMENTS.md', 'STATE.md', 'PROJECT.md']) {
    const t = read(join(dir, f));
    if (t === null) continue;
    for (const ref of findProsePhaseRefs(t, shiftFrom)) inTextRefs.push({ file: f, ...ref });
  }

  // Decimal phases are never shifted (see shiftPhaseTokens) - report them so
  // the caller re-places them deliberately instead of discovering the gap.
  const decimalPhases = phases.filter((p) => !Number.isInteger(p.n)).map((p) => p.n);

  const ops = [
    ...dirMoves.map(([f, t]) => ({ git_mv: [`phases/${f}`, `phases/${t}`] })),
    ...(sub === 'remove' && existingDir(at) ? [{ rm: `phases/${at}` }] : []),
    { edit: 'ROADMAP.md', changes: roadmapShift.count + (sub === 'remove' ? 1 : 0) },
    ...(newReqText !== null ? [{ edit: 'REQUIREMENTS.md', changes: orphanedReqs.length ? orphanedReqs.length : undefined }] : []),
    ...(newCursor ? [{ edit: 'STATE.md', changes: 1 }] : []),
  ];

  const result = {
    ops,
    ...(inTextRefs.length ? { in_text_refs: inTextRefs } : {}),
    ...(orphanedReqs.length ? { orphaned_reqs: orphanedReqs } : {}),
    ...(decimalPhases.length ? { decimal_phases: decimalPhases } : {}),
    ...(warn ? { warn } : {}),
    ...(sub === 'insert' ? { slot: `add the new "- [ ] **Phase ${at}: ...**" line and its detail section` } : {}),
  };
  if ('dry-run' in opts) return ok({ dry_run: true, ...result });

  // Apply: an ordered step list, run under one guard. NOTE the order is the
  // rm first, then the moves - which is NOT the order `ops` above displays
  // (it lists moves first, and a shipped test pins that). `ops` is the plan
  // shown at the dry-run gate; `completed` below is the record of what
  // actually ran, and it is the authority when the two disagree. Replaying
  // the printed `ops` order by hand on a remove would `git mv` onto a
  // still-present directory and NEST it (the D-04 hazard). This is a
  // partial-state REPORT, not a rollback - `remove` destroys phases/<at>
  // before the first move runs, so step one can never be undone. Advertising
  // a rollback the code lacks would be worse than a generic failure, because
  // the caller would stop checking the tree by hand (D-03).
  /** @type {Array<[Record<string, any>, () => void]>} */
  const steps = [];
  if (sub === 'remove' && existingDir(at)) {
    steps.push([{ rm: `phases/${at}` }, () => {
      // `cwd: dir`, matching the pre-flight's own `git status` call. Without it
      // git discovers the repository from the CALLER's cwd, which for any
      // `--dir` outside it is a different repository or none - git answers
      // `'<path>' is outside repository` and every remove fell through to the
      // `rmSync` below, tracked work and all. The pre-flight has always read
      // the right repo; this step did not, so the two disagreed about which
      // repository the phase belongs to.
      try { execFileSync('git', ['rm', '-r', '-q', join(dir, 'phases', String(at))], { cwd: dir, stdio: 'pipe' }); }
      catch {
        // The recursive delete is the destructive act this whole command is
        // built around, so it gets its OWN gate rather than trusting the
        // pre-flight's. The guard is repeated here deliberately: the pre-flight
        // ran before the roadmap was even computed, and a git state can become
        // unreadable between the two - and this arm also fires on a `git rm`
        // failure the pre-flight did not predict at all, which inside a
        // repository means git disagrees with the clean answer the pre-flight
        // got. Either way the object store is the only copy of what is about to
        // go, and `rmSync` is a delete with nothing behind it. With no
        // repository at, above OR inside the target there is no object store to
        // consult and no residue that could survive to be nested into, so the
        // fallback stays the only remover - the bare-tree path every renumber
        // fixture runs on. `gitDirUnder` carries the "inside" half: looking up
        // from the planning root cannot see a repository rooted in the very
        // directory this is about to delete recursively.
        const target = join(dir, 'phases', String(at));
        if (gitDirAbove(dir) || gitDirUnder(target)) {
          // Worded to what is actually known. `git rm` failing does not prove
          // the repository is unreadable - it proves the git state this delete
          // depends on went UNREAD, which covers both a `.git` we cannot open
          // and an answer we did not predict. Claiming the stronger fact would
          // be this milestone's own defect: a verdict the check did not earn.
          throw new Error(`git rm -r failed for phases/${at} and a git repository sits at, above or inside it, so the git state this delete depends on is unread - refusing the recursive fallback, since the object store may hold the only copy; run \`git rm -r -- .planning/phases/${at}\` from the repository to see git's own answer`);
        }
        rmSync(target, { recursive: true });
      }
    }]);
  }
  for (const [f, t] of dirMoves) {
    steps.push([{ git_mv: [`phases/${f}`, `phases/${t}`] },
      () => gitMv(join(dir, 'phases', String(f)), join(dir, 'phases', String(t)))]);
  }
  steps.push([{ edit: 'ROADMAP.md' }, () => atomicWrite(roadmapFile, newRoadmap)]);
  if (newReqText !== null) steps.push([{ edit: 'REQUIREMENTS.md' }, () => atomicWrite(reqFile, newReqText)]);
  if (newCursor) steps.push([{ edit: 'STATE.md' }, () => atomicWrite(stateFile, renderCursor(newCursor))]);

  const completed = [];
  for (const [op, runStep] of steps) {
    try { runStep(); }
    catch (e) {
      // Bypasses the dispatch-level catch (which flattens to `internal`) and
      // fail()'s reason/detail/hint-only shape - a completed-ops list needs
      // its own emit (D-11).
      return emit({
        ok: false, reason: 'partial-apply', completed, failed: op,
        detail: e && e.message ? e.message : String(e),
        // Deliberately does NOT say "re-run". The half-applied tree no longer
        // matches ROADMAP, and a re-run recomputes its plan FROM ROADMAP: on
        // a remove it would rm phases/<at>, which now holds the NEXT phase's
        // work, and exit ok:true having destroyed it. Verified live.
        hint: completed.length
          ? 'the tree is partly renumbered and no longer matches ROADMAP - reconcile the completed ops by hand before any further renumber; re-running this command against the half-applied tree can destroy a phase directory'
          : 'nothing was written - the first step failed, so the tree is unchanged and safe to re-run once the cause is fixed',
      });
    }
    completed.push(op);
  }

  // Sanity recount: every ROADMAP phase maps to at most one dir, none stray.
  const after = parseRoadmapPhases(read(roadmapFile) || '');
  ok({ ...result, total: after.length });
}

// ---------------------------------------------------------------------------
// capture - one bullet into `.planning/CAPTURE.md`, under the heading its kind
// owns. The whole point is that the heading is NOT an argument: the append used
// to be `/cad-capture` prose holding `Write`/`Edit`, and five filed bullets were
// lost to a heading the recall walk does not visit. The format, the section and
// the file I/O live in lib/capture-file.mjs; this owns the flag contract and the
// envelope.
// ---------------------------------------------------------------------------
function cmdCapture(dir, opts) {
  const kind = typeof opts.kind === 'string' ? opts.kind.trim() : '';
  if (!CAPTURE_KINDS.includes(kind)) {
    return fail('bad-args', `capture --kind must be one of ${CAPTURE_KINDS.join(' | ')}`
      + ` (got: ${kind || 'none'})`);
  }
  // `--text-file` is the SAFE transport and the one the workflows prescribe.
  // `--text "<item>"` puts caller-derived prose inside a double-quoted shell
  // word, so an item carrying `$(...)` or a backtick executes before Node
  // starts. A path cannot: the caller writes the sentence with a file tool and
  // names the file here. `--text` stays for a human typing at a shell, where
  // the text is the user's own.
  if ('text-file' in opts && (typeof opts['text-file'] !== 'string' || opts['text-file'].trim() === '')) {
    return fail('bad-args', 'capture --text-file needs a path after it: --text-file <path>');
  }
  if ('text' in opts && 'text-file' in opts) {
    return fail('bad-args', 'capture takes --text or --text-file, never both');
  }
  let text;
  if (typeof opts['text-file'] === 'string') {
    try {
      text = readFileSync(opts['text-file'].trim(), 'utf8').trim();
    } catch (e) {
      return fail('bad-args',
        `capture --text-file could not be read: ${e && e.message ? e.message : String(e)}`);
    }
    if (!text) return fail('bad-args', 'capture --text-file names an empty file');
  } else {
    // parseArgs hands a VALUELESS flag the boolean `true`, so a bare `--text`
    // has to be refused here - written through, it captures the literal word
    // "true" and the user's sentence is gone with an ok:true envelope (#42/#45).
    text = typeof opts.text === 'string' ? opts.text.trim() : '';
    if (!text) {
      return fail('bad-args',
        'capture needs the sentence: --text-file <path> (workflows) or --text "<text>" (typed by hand)');
    }
  }
  /** @type {string|undefined} */
  let phase;
  if ('phase' in opts) {
    // Admitted with `todo` ALONE. A seed or a note carrying `--phase` would be
    // written with no tag, leaving the caller believing it tagged something -
    // so the flag is refused rather than dropped.
    if (kind !== 'todo') {
      return fail('bad-args', 'capture --phase is admitted only with --kind todo'
        + ' - a seed and a note carry no phase tag');
    }
    const parsed = requirePhaseArg(opts.phase);
    if (!parsed.ok) return fail('bad-args', 'capture --phase needs a phase number: --phase <N>');
    // The caller's OWN spelling, so `--phase 1.10` tags `(phase 1.10)`.
    phase = parsed.raw;
  }
  // Same present-but-unusable refusal `debt-harvest --root` carries: a flag with
  // nothing usable after it is never silently answered about the default path,
  // which would write a different file than the caller named (#42/#45).
  if ('file' in opts && (typeof opts.file !== 'string' || opts.file.trim() === '')) {
    return fail('bad-args', 'capture --file needs a path after it: --file <path to CAPTURE.md>');
  }
  const file = typeof opts.file === 'string' ? opts.file : join(dir, 'CAPTURE.md');
  const res = appendCapture(file, kind, text, phase);
  if (res.ok === false) return fail(res.reason, res.detail);
  ok({ file, kind, bullet: res.bullet, heading: res.heading, created: res.created });
}

// ---------------------------------------------------------------------------
// capture-sections - every `## ` section of CAPTURE.md with its bullet count
// and whether the recall walk visits it, so a bullet filed outside the walk is
// REPORTED rather than silent. `/cad-health` prints the out-of-walk rows.
//
// STANDALONE, beside `status`, never a drift kind inside it (D-07). `cmdStatus`
// returns `no-planning-dir` / `no-roadmap` / `unparseable-roadmap` before any
// drift is computed, so folding this in would hand no capture report at all to
// exactly the trees most likely to hold a mangled CAPTURE.md.
// ---------------------------------------------------------------------------
function cmdCaptureSections(dir, opts) {
  // Same present-but-unusable refusal `capture` and `debt-harvest` carry: a
  // flag with nothing usable after it is never silently answered about the
  // default path, which would report on a different file than the caller named.
  if ('file' in opts && (typeof opts.file !== 'string' || opts.file.trim() === '')) {
    return fail('bad-args', 'capture-sections --file needs a path after it: --file <path to CAPTURE.md>');
  }
  const file = typeof opts.file === 'string' ? opts.file : join(dir, 'CAPTURE.md');
  /** @type {string} */
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch (e) {
    // ENOENT alone is the absent arm, and absence is DATA here as everywhere in
    // this seam - a project with no queue has no out-of-walk sections. Not the
    // module-level `read`, which flattens every error to null: an unreadable
    // but PRESENT queue reported as "no sections" is a check announcing all
    // clear about a file it could not open.
    if (e && /** @type {any} */ (e).code === 'ENOENT') {
      return ok({ file, exists: false, walk: CAPTURE_WALK_SECTIONS, sections: [] });
    }
    return fail('unreadable-capture', `${file}: ${e && e.message ? e.message : String(e)}`);
  }
  ok({
    file,
    exists: true,
    walk: CAPTURE_WALK_SECTIONS,
    sections: captureSections(text)
      .map((s) => ({ heading: s.heading, bullets: s.bullets, in_walk: s.inWalk })),
  });
}

// ---------------------------------------------------------------------------
// debt-harvest - every `CADENCE-DEBT` marker in the tracked tree, collected into
// `.planning/CAPTURE.md`'s own section. The grammar and the rendering live in
// lib/debt-markers.mjs (pure); this owns the walk, the reads and the write.
//
// `--root` is the PROJECT root, not `--dir`: this scans SOURCE and writes into
// `.planning`, the same reason `detect-commands` states for its own flag.
// ---------------------------------------------------------------------------

/** Files larger than this are skipped silently - a marker lives on one line. */
const DEBT_MAX_FILE_BYTES = 1048576;

/** The heading the harvest owns and rewrites wholesale. */
const DEBT_HEADING = '## Debt markers';

function cmdDebtHarvest(root) {
  if (!existsSync(root)) return fail('no-root', `${root} not found`);
  /** @type {string} */
  let listing;
  try {
    listing = execFileSync('git', ['-C', root, 'ls-files', '-z'],
      { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 }).toString('utf8');
  } catch (e) {
    // An UNENUMERABLE tree must never report zero markers: `markers: 0` is the
    // answer a caller acts on, and it has to mean "none planted", never "the
    // walk did not happen".
    return fail('no-git', `${root} could not be enumerated with git ls-files`
      + ` (${e && e.message ? e.message.split('\n')[0] : String(e)})`);
  }

  const entries = [];
  let files = 0;
  for (const rel of listing.split('\0')) {
    if (!rel) continue;
    const segs = rel.split('/');
    // `.planning/` holds the harvest's OWN OUTPUT, which is TRACKED in some
    // projects (hindsight, assistant) even though it is gitignored here - so
    // scanning it would make the harvest ingest itself and destroy the
    // idempotence the whole design rests on. It also holds every planning doc
    // that quotes the convention.
    if (segs.includes('.planning')) continue;
    // `git ls-files` omits UNTRACKED files, which is what keeps an ignored
    // `node_modules/` out in the ordinary case. It is NOT "every ignored file
    // for free": an ignore rule does not remove an ALREADY TRACKED path from
    // `ls-files`, so a force-added (`git add -f`) or historically tracked
    // `node_modules/pkg/x.js` is still enumerated and would contribute
    // third-party markers. Hence the explicit skip, here beside the other one.
    if (segs.includes('node_modules')) continue;
    const abs = join(root, rel);
    let buf;
    try {
      // `lstatSync`, so a SYMLINK is classified as a link rather than as whatever
      // it points at. `statSync` followed it and the read followed it too, so a
      // tracked `src/link.js -> /tmp/outside.js` put the external file's marker in
      // the queue under the in-tree path - the harvest reporting a corner-cut at a
      // line that does not contain one, sourced from a file the project does not
      // contain. A tracked symlink's TARGET is either in the tree (enumerated on
      // its own path, and reported there) or outside it, so skipping links loses
      // no marker that belongs here.
      const st = lstatSync(abs);
      if (st.isSymbolicLink()) continue;
      if (st.size > DEBT_MAX_FILE_BYTES) continue;
      buf = readFileSync(abs);
    } catch { continue; } // deleted since ls-files, or unreadable
    if (buf.includes(0)) continue; // binary
    files++;
    for (const m of debtMarkersIn(buf.toString('utf8'))) entries.push({ ...m, path: rel });
  }

  const captureFile = join(root, '.planning', 'CAPTURE.md');
  const body = renderDebtSection(entries);
  /** @type {{ok: true, value: boolean} | {ok: false, reason: string, detail: string}} */
  let guarded;
  try {
    // The whole read-modify-write is inside the SAME guard `/cad-capture`'s
    // append takes (D-02), and the read is inside it with the write: a harvest
    // and a capture running at the same moment would otherwise each read the
    // same bytes and the second rename would erase the first one's work. That
    // is the whole point of naming all three writers.
    guarded = withPlanningFileLock(captureFile, () => {
      const existing = read(captureFile);
      const next = existing === null
        // Created with the same three headings /cad-capture creates - the same
        // constant, not a second copy of them - so a harvest on a project with
        // no queue yet leaves the file /cad-capture expects.
        ? `${EMPTY_CAPTURE}\n${DEBT_HEADING}\n\n${body}`
        : replaceSection(existing, DEBT_HEADING, body);
      // Written ONLY when it differs, so a second run reports written:false and
      // leaves the file byte-identical - the idempotence AC6 asks for.
      if (next === existing) return false;
      atomicWrite(captureFile, next);
      return true;
    });
  } catch (e) {
    return fail('write-failed', `${captureFile}: ${e && e.message ? e.message : String(e)}`);
  }
  // A refused lock is reported through the EXISTING failure path, not a new
  // one: every caller of this seam already branches on `write-failed`.
  if (guarded.ok === false) return fail('write-failed', `${captureFile}: ${guarded.detail}`);
  const written = guarded.value;
  const malformed = entries.filter((e) => e.malformed)
    .map((e) => ({ path: e.path, line: e.line, missing: e.malformed }));
  ok({
    root,
    file: captureFile,
    markers: entries.length,
    files,
    written,
    ...(malformed.length ? { malformed } : {}),
  });
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// milestone-prune - the mechanical half of a milestone close, in one call.
// `/cad-milestone` steps 3+5 were three orchestrator hand-surgeries with a
// recorded failure mode (a close that left the tree failing its own audit);
// the text transforms live in lib/milestone-prune.mjs, this wrapper owns the
// I/O: read both docs, prune, move/delete the phase directories, write back.
// The judgment halves of the close (PROJECT.md evolution, carrying deferred
// requirements forward, seeding the next milestone) stay prose - this seam
// touches only what is mechanical.
// ---------------------------------------------------------------------------
function cmdMilestonePrune(dir, opts) {
  // `--label-file` is the path transport, and this label is caller-derived by
  // construction: an untagged close takes it from PROJECT.md's milestone NAME,
  // which is repository content going into a double-quoted shell word
  // (lib/text-flag-file.mjs, references/conventions.md). The transport changes
  // only HOW the label arrives - both terms below still run on the resolved
  // value, in the same order, before any read, mkdir or rename and in both
  // modes.
  const resolvedLabel = resolveTextFlag(opts, 'label', 'milestone-prune');
  if (!resolvedLabel.ok) return fail('bad-args', resolvedLabel.detail);
  const raw = resolvedLabel.value !== undefined ? resolvedLabel.value : opts.label;
  const label = typeof raw === 'string' ? raw.trim() : '';
  if (!label) return fail('bad-args', 'milestone-prune needs --label <version or milestone name>');
  // Two independent terms, both here at the point the label is read - before
  // any read, mkdir or rename, and in BOTH modes: `--mode delete` builds no
  // archive root but still writes the label into every shipped requirement row.
  //
  // NOT publish-decision.mjs's REMOTE_NAME shape (D-13): that regex admits no
  // spaces, and `workflows/milestone.md` makes an untagged label the milestone
  // NAME from PROJECT.md, so it would refuse this milestone's own label and
  // block /cad-milestone step 3.
  //
  // 1. The table term. archiveRequirements interpolates the label into a
  //    markdown table cell, where either character silently rewrites the row.
  if (/[|\r\n]/.test(label)) {
    return fail('bad-args',
      'milestone-prune --label cannot contain "|" or a newline - it is written into a REQUIREMENTS.md table cell');
  }
  // 2. The containment term. `_archive-<label>` is handed to mkdirSync and
  //    renameSync below, so `--label '../../../outside-tree'` moved phases/1
  //    clean out of the planning root and still answered ok:true. resolve()
  //    rather than the fsIdentity comparison the rest of this tree uses for
  //    paths: the archive root does not exist yet at validation time, and this
  //    has to run before any mkdir. Lexical alone is NOT enough, which is what
  //    the type term below closes.
  const archiveRoot = join(dir, `_archive-${label}`);
  if (!resolvePath(archiveRoot).startsWith(resolvePath(dir) + sep)) {
    return fail('bad-args',
      `milestone-prune --label must stay inside the planning root: "_archive-${label}" resolves outside ${dir}`);
  }
  const mode = opts.mode;
  if (mode !== 'delete' && mode !== 'archive') {
    return fail('bad-args', 'milestone-prune needs --mode <delete|archive> (tagged release: delete - the tag is the archive; untagged: archive)');
  }
  // 3. The TYPE term, and the reason the lexical test above cannot stand alone:
  //    `resolve()` is pure string arithmetic, so a pre-existing `_archive-<label>`
  //    that is ITSELF a symlink pointing out of the tree resolves lexically
  //    INSIDE it, `mkdirSync(recursive)` succeeds silently against it, and
  //    `renameSync` then follows the link and deposits the phase directories
  //    wherever it aimed. `lstatSync` classifies the LINK rather than its
  //    target, so a symlink fails `isDirectory()` here whatever it points at -
  //    which is also the right answer for a regular file squatting the name.
  //    Absent is the ordinary case and is not an error: the loop below creates
  //    it. Archive mode only - `delete` builds no archive root.
  if (mode === 'archive') {
    // `throwIfNoEntry: false` rather than a try/catch, the idiom `occupied`
    // above already uses: absent is data here, not an exception.
    const rootStat = lstatSync(archiveRoot, { throwIfNoEntry: false });
    if (rootStat && !rootStat.isDirectory()) {
      return fail('archive-root-unusable',
        `${archiveRoot} exists and is not a real directory`
        + `${rootStat.isSymbolicLink() ? ' (it is a symlink, which renameSync would follow out of the planning root)' : ''}`
        + ' - move or remove it, then re-run');
    }
  }
  const roadmapFile = join(dir, 'ROADMAP.md');
  let roadmapText;
  try { roadmapText = readFileSync(roadmapFile, 'utf8'); } catch {
    return fail('no-roadmap', `${roadmapFile} is missing or unreadable`);
  }
  const completed = completedPhases(roadmapText);
  if (!completed.length) {
    return ok({ action: 'skip', reason: 'no completed (checked) phases to prune' });
  }
  const warnings = [];

  // REQUIREMENTS.md is optional at this seam: a project without the file gets
  // the roadmap+dirs half and a warning, never a refusal - the close must not
  // stall on a doc the project never kept. READ here, TRANSFORMED below: the
  // read has to fail before anything is moved, but the transform has to run
  // after, over the set the directory pass actually cleared.
  const reqFile = join(dir, 'REQUIREMENTS.md');
  const reqText = read(reqFile);
  if (reqText === null) {
    warnings.push(`${reqFile} is missing or unreadable; requirements were not archived`);
  }

  // The recall residue, and the reason it is written HERE (RCL-07, D-01).
  //
  // Below this point the completed phases' directories leave the live tree, and
  // with them every SUMMARY deviation, UAT item and CONTEXT decision `recall`
  // indexes: the corpus Cadence writes in order to be remembered was reachable
  // only while the directory was. So the rows are read and APPENDED before the
  // loop, not after it. Emitting for the post-loop `applied` set would put the
  // write after the removal, where an interrupt between the two deletes the
  // directories, writes nothing, and reopens the reachability hole with no live
  // artifact left to recover it from.
  //
  // The rows are the SAME snippets the live walk indexes, from the SAME three
  // parsers `cmdRecall` runs, in the same fixed order (phases ascending, then
  // SUMMARY, UAT, CONTEXT within a phase) - never a model-authored distillation
  // (D-03). A prose-authored write puts the residue in the coordinator's hands,
  // where an interrupted close writes nothing and nothing says so.
  //
  // The cost of moving the write ahead of the loop is that idempotence stops
  // being free: a phase whose removal then FAILS is still live on a re-run and
  // would be read a second time. So the candidate set is filtered by what this
  // milestone's heading already contains - one containment test keyed on the
  // label, read back through the grammar's own parser, rather than a dedup pass
  // over the file or a written-labels sidecar. It is deliberately NOT in
  // `appendArchiveRows`: "already present" is a PHASE-level judgment this seam
  // can make and a pure text appender cannot, and folding it in there would
  // refuse a second artifact from a phase the same call already landed one for.
  const archiveFile = join(dir, 'ARCHIVE.md');
  const residue = [];
  // The read, the containment test and the write are ONE critical section, held
  // under the same sibling lock `/cad-capture` takes on CAPTURE.md. Unserialized,
  // two closes running with different labels both read the same text, each
  // writes only its own rows, and the later `atomicWrite` wins - and this seam
  // removes the phase directories immediately after, so the clobbered rows have
  // no live source left. That consequence is why ARCHIVE.md takes a lock the
  // ROADMAP and REQUIREMENTS writes below do not: those lose an edit git still
  // holds, this loses the only remaining copy.
  const archiveGuard = withPlanningFileLock(archiveFile, () => {
  const archiveText = read(archiveFile) ?? '';
  // Two properties this test must hold, both of them data-loss bugs when it
  // does not, because a suppressed write is followed by the directory removal
  // that makes the omission permanent:
  //
  // The label matches EXACTLY, never as a prefix of the composed source. A
  // milestone label is free text; `source.startsWith(label + '/')` answers true
  // for a row under a heading named `v1/anything` when the label is `v1`, so a
  // section this close does not own could mark this close's phases done.
  //
  // The key is the ARTIFACT, not the phase. One row for a phase does not prove
  // its other two were written: a close whose UAT.md was absent or unreadable
  // on the first pass lands SUMMARY and CONTEXT only, and keyed on the phase
  // number a retry - after the file is restored - skips the phase whole and
  // then removes the directory, dropping the row it re-ran to land.
  const alreadyArchived = new Set(parseArchiveRows(archiveText)
    .filter((r) => r.label === label)
    .map((r) => r.origin));
  for (const n of [...completed].sort((a, b) => a - b)) {
    const pdir = join(dir, 'phases', String(n));
    const summaryOrigin = `phases/${n}/SUMMARY.md`;
    const summary = alreadyArchived.has(summaryOrigin) ? null : read(join(pdir, 'SUMMARY.md'));
    if (summary) for (const text of parseSummarySnippets(summary)) {
      residue.push({ origin: summaryOrigin, text });
    }
    const uatOrigin = `phases/${n}/UAT.md`;
    const uatText = alreadyArchived.has(uatOrigin) ? null : read(join(pdir, 'UAT.md'));
    if (uatText) for (const it of parseUat(uatText).items) {
      const text = `${it.name || ''} ${it.expected || ''}`.trim();
      if (text) residue.push({ origin: uatOrigin, text });
    }
    const contextOrigin = `phases/${n}/CONTEXT.md`;
    const context = alreadyArchived.has(contextOrigin) ? null : read(join(pdir, 'CONTEXT.md'));
    if (context) for (const text of parseContextDecisions(context)) {
      residue.push({ origin: contextOrigin, text });
    }
  }
  // Nothing to say, no file: a project with no readable artifacts under its
  // completed phases gets no ARCHIVE.md at all, the way the two document writes
  // below already skip on an empty set.
  if (residue.length) atomicWrite(archiveFile, appendArchiveRows(archiveText, label, residue));
  }, 'archive-locked');
  // A refused lock stops the close BEFORE any directory moves. Proceeding would
  // remove the phases whose residue this run could not write, which is the exact
  // permanent loss the lock exists to prevent.
  if (archiveGuard.ok === false) return fail(archiveGuard.reason, archiveGuard.detail);

  // Directories FIRST, and the documents describe only what this pass actually
  // accomplished.
  //
  // The order this replaced was "transforms, directories, writes", defended by
  // a comment claiming "a rename that throws leaves both docs untouched on disk
  // rather than half a close". It never did: the throw is caught INSIDE this
  // loop and collected as a warning, so the writes below ran unconditionally
  // and the envelope still answered ok:true, action:"pruned". A close that
  // could not move phases/2 still deleted its roadmap line and archived its
  // requirement rows, and `/cad-milestone` - which relays warnings[] but halts
  // on none of them - committed that disagreement.
  //
  // So the ONLY set that reaches the transforms is the set whose directory is
  // gone from the live tree. `missing` counts as gone (it already was, which is
  // what makes a re-run idempotent); `failed` does not.
  const dirs = { archived: [], deleted: [], missing: [] };
  const failed = [];
  for (const n of completed) {
    const src = join(dir, 'phases', String(n));
    if (!existsSync(src)) { dirs.missing.push(n); continue; }
    try {
      if (mode === 'delete') { rmSync(src, { recursive: true }); dirs.deleted.push(n); }
      else {
        mkdirSync(archiveRoot, { recursive: true });
        const dest = join(archiveRoot, String(n));
        // Refuse a destination that already exists rather than let renameSync
        // decide: onto an empty directory it silently succeeds, onto a
        // non-empty one it throws ENOTEMPTY, and onto a symlink it follows.
        // A pre-existing destination means a previous close half-ran, and
        // clobbering it would destroy that evidence.
        if (lstatSync(dest, { throwIfNoEntry: false })) {
          throw new Error(`${dest} already exists - a previous close left it there`);
        }
        renameSync(src, dest);
        dirs.archived.push(n);
      }
    } catch (e) {
      failed.push(n);
      warnings.push(`phase ${n}: directory ${mode} failed: ${e && e.message ? e.message : e}`);
    }
  }

  // The pruned set: completed phases whose directory is no longer in the live
  // tree. Recomputing the transforms over THIS set rather than over `completed`
  // is the whole fix - a phase that failed keeps its roadmap line and its
  // `## Active` requirement rows, so the tree and the documents still agree.
  const applied = completed.filter((n) => !failed.includes(n));

  const pruned = pruneRoadmap(roadmapText, applied);
  for (const n of pruned.missingSections) {
    warnings.push(`phase ${n}: no "### Phase ${n}:" detail section found to remove`);
  }
  const reqResult = reqText === null ? null : archiveRequirements(reqText, applied, label);

  // Nothing cleared, nothing to say: skip both writes rather than rename an
  // identical file into place.
  if (applied.length) {
    atomicWrite(roadmapFile, pruned.text);
    if (reqResult && reqResult.moved.length) atomicWrite(reqFile, reqResult.text);
  }

  const envelope = {
    label,
    mode,
    phases: applied,
    roadmap: { removed_lines: pruned.removedLines, removed_sections: pruned.removedSections },
    requirements: reqResult
      ? { moved: reqResult.moved, created_shipped: reqResult.createdSection }
      : { moved: [], created_shipped: false },
    dirs,
    // How many residue rows this invocation landed in ARCHIVE.md. Always
    // present, including as 0: absence and silence are different answers here
    // as everywhere, and a close that wrote nothing has to be legible as one
    // rather than as a field the caller forgot to look for.
    residue_rows: residue.length,
    ...(warnings.length ? { warnings } : {}),
  };

  // A partial application is a REFUSAL, not a success carrying a warning. The
  // caller has to be able to tell "the close is done" from "the close is half
  // done and the rest needs a hand" without reading prose, and `warnings[]`
  // could not carry that - it already carries benign diagnostics.
  if (failed.length) {
    return emit({ ok: false, reason: 'partial-prune', action: 'partial', failed, ...envelope,
      hint: `phases ${failed.join(', ')} still have directories under ${join(dir, 'phases')};`
        + ' they were left in ROADMAP.md and REQUIREMENTS.md. Fix what blocked them and re-run -'
        + ' the phases that did clear are already pruned, so a re-run only picks up the rest.' });
  }
  return ok({ action: 'pruned', ...envelope });
}

// Dispatch. Adding a subcommand = one entry here + its tests.
// ---------------------------------------------------------------------------
// The refusal SENTENCE for a flag this script's rows declare, and the ONE home
// for that wording. lib/arg-contract.mjs names the FLAG and nothing else
// (D-07): this file owns its refusal vocabulary - `bad-args`, never the
// `missing-flag-value` throw, which has no `e.seam` catch arm here to render it
// as anything but `internal`.
//
// Only the spellings that already SHIP are listed. Everything else COMPOSES
// from the flag's own name and its declared type, so a row added to the table
// tomorrow refuses with a sentence naming its flag rather than with an entry
// somebody has to remember to write here - which is the second table this
// requirement exists to prevent, one wording over.
const FLAG_SENTENCES = {
  '--dir': 'needs a path after it: --dir <planning dir>',
  '--root': 'needs a path after it: --root <project root>',
  '--role': 'needs a role name after it: --role <name>',
  '--step': 'needs a step name after it: --step <name>',
  '--reviewer': 'needs a reviewer name after it: --reviewer <name>',
  '--trigger': 'needs a trigger name after it: --trigger <name>',
};

/**
 * The sentence a refused flag carries, without its subcommand prefix.
 *
 * The `-file` arm composes lib/text-flag-file.mjs's own wording character for
 * character, because the door refuses a bare `--<field>-file` BEFORE that
 * module is reached and its callers must see no change. The `int`/`cursor` arm
 * is the sentence the four hand-written integer guards in this file already
 * publish.
 *
 * `spec` may be ABSENT, and that is not a missing row: the shared `trace
 * append|close` body validates flags the `trace close` row deliberately does
 * not declare, because a flag row is a prose allowlist that never widens what
 * a subcommand accepts. Such a flag is named by `FLAG_SENTENCES` and needs no
 * type at all; the `string` default is what keeps the arm total.
 * @param {string} flag @param {{type: string}|undefined} spec @returns {string}
 */
function flagSentence(flag, spec) {
  const type = spec ? spec.type : 'string';
  if (FLAG_SENTENCES[flag]) return FLAG_SENTENCES[flag];
  if (flag.endsWith('-file')) return `needs a path after it: ${flag} <path>`;
  if (type === 'int' || type === 'cursor') return 'needs a non-negative integer';
  if (type === 'phase') return `needs a phase number: ${flag} <N>`;
  return `needs a value after it: ${flag} <value>`;
}

/**
 * The one refusal in this script whose wording depends on the VALUE rather than
 * on the flag, and which a declaration therefore cannot state at all.
 *
 * `renumber` is integer arithmetic - a decimal insertion like 2.1 neither
 * displaces integers nor is displaced by them - so a WELL-FORMED decimal is a
 * different repair from a missing or non-numeric value, and cmdRenumber
 * re-tested the value to say so. The declared `int` row refuses both spellings
 * at the door before that re-test can run, so the wording moved HERE rather
 * than being lost: without it a caller whose real problem is that 2.1 has to be
 * re-placed by hand is told "needs a non-negative integer". It is the same
 * species as the PRESENCE carve-out - a diagnostic no row can express stays
 * with the bin that owns the wording - and it reads a raw token the door
 * itself judged.
 *
 * The DECIMAL test is explicit rather than implied by `requirePhaseArg`, which
 * accepts a plain integer as readily as `2.1`. Implied, this sentence fired on
 * a well-formed `--at 1`, telling a caller to re-place a decimal they never
 * typed - reachable the moment the door began judging every occurrence of a
 * flag rather than its first, since `--at 1 --at` is a refusal whose first
 * token is an integer.
 * @param {string} key @param {string|undefined} raw @returns {string}
 */
function decimalRefusal(key, raw) {
  return key.startsWith('renumber ') && typeof raw === 'string'
    && raw.includes('.') && requirePhaseArg(raw).ok
    ? 'renumber operates on integer phases; re-place decimal phases by hand'
    : '';
}

/**
 * Compose the whole refusal detail for the flag the door refused.
 *
 * A flag on the script-global `'*'` row carries NO subcommand prefix - `--dir
 * needs a path after it` is the line every caller of every subcommand sees -
 * while a flag on a subcommand's own row is prefixed with that subcommand, the
 * way `detect-commands --root ...` and `trace append --role ...` already read.
 * @param {string} key the subcommand key the words resolved to
 * @param {string} flag @returns {string}
 */
function argRefusal(key, flag) {
  const table = CONTRACTS['planning.mjs'];
  const global = table['*'][flag];
  const spec = global || (table[key] || {})[flag];
  // EVERY occurrence is offered to the domain wording, because `evaluateRow`
  // names only the flag (D-07) and now judges every occurrence: the decimal a
  // caller has to re-place by hand is not always the first one they typed.
  let domain = '';
  for (let i = 0; i < ARGV.length && !domain; i++) {
    if (ARGV[i] === flag) domain = decimalRefusal(key, ARGV[i + 1]);
  }
  if (domain) return domain;
  return `${global ? '' : `${key} `}${flag} ${flagSentence(flag, spec)}`;
}

function parseArgs(argv) {
  const words = [];
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      // A flag followed by another flag (or nothing) is boolean, e.g. --undo.
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) { opts[a.slice(2)] = true; }
      else { opts[a.slice(2)] = next; i++; }
    } else words.push(a);
  }
  return { words, opts };
}

// Handlers take the trailing positional words as a 4th argument; only
// `recall` needs it (its query is free text, not a fixed subcommand), and
// widening the signature beats special-casing one command in the dispatcher.
/** @type {Record<string, (dir: string, sub: string, opts: any, rest: string[]) => void>} */
const COMMANDS = {
  status: (dir, _sub, _opts) => cmdStatus(dir),
  cursor: (dir, sub, opts) => {
    if (sub === 'get') return cmdCursorGet(dir);
    if (sub === 'set') return cmdCursorSet(dir, opts);
    return fail('usage', 'cursor <get|set>');
  },
  'phase-done': (dir, _sub, opts) => cmdPhaseDone(dir, opts),
  uat: (dir, sub, opts) => cmdUat(dir, sub, opts),
  reads: (dir, _sub, opts) => cmdReads(dir, opts),
  audit: (dir, _sub, _opts) => cmdAudit(dir),
  'criteria-coverage': (dir, _sub, _opts) => cmdCriteriaCoverage(dir),
  'criteria-size': (dir, _sub, opts) => cmdCriteriaSize(dir, opts),
  'plan-overlap': (dir, _sub, opts) => cmdPlanOverlap(dir, opts),
  'plan-size': (dir, _sub, opts) => cmdPlanSize(dir, opts),
  'seed-reqs': (dir, _sub, opts) => cmdSeedReqs(dir, opts),
  // Bare words are JOINED, never rejected: every workflow caller quotes, so
  // rejecting extras would turn a today-degraded interactive call into a hard
  // failure. tokenize() splits on non-alphanumerics, so the separator is
  // immaterial; `[].join(' ')` is '', which still trips the bad-args guard.
  recall: (dir, _sub, opts, rest) => cmdRecall(dir, rest.join(' '), opts),
  'lease-check': (dir, _sub, opts) => cmdLeaseCheck(dir, opts),
  // --root, never --dir: this one names the PROJECT root. A `--root` with
  // nothing usable after it is refused rather than silently answered about the
  // cwd, which would report a different tree than the caller named (#42/#45) -
  // and the refusal is the DECLARED row's now, applied at the dispatch door
  // below, rather than a predicate this arm restates. The row says the same
  // thing the predicate did, trim clause included: `--root ""` answered
  // `ok:true` about the cwd and `--root "   "` fell through to a `no-root`
  // ENOENT, one refusal vocabulary answering in two.
  'detect-commands': (_dir, _sub, opts) =>
    cmdDetectCommands(typeof opts.root === 'string' ? opts.root : process.cwd()),
  // Same --root row, same refusal, same door.
  'detect-surfaces': (_dir, _sub, opts) =>
    cmdDetectSurfaces(typeof opts.root === 'string' ? opts.root : process.cwd()),
  trace: (dir, sub, opts) => cmdTrace(dir, sub, opts),
  'risk-check': (dir, sub, opts) => cmdRiskCheck(dir, sub, opts),
  // The gate fire's per-finding rulings, beside the sibling REVIEW file. ONE
  // word, never a two-word spelling: `subcommandKey` consumes a second word only
  // for the `TWO_WORD` families, and one operation does not earn widening it.
  adjudication: (dir, _sub, opts) => cmdAdjudication(dir, opts),
  // `--file` overrides `<dir>/CAPTURE.md` for `/cad-capture --cadence`'s global
  // queue, which sits beside the global config layer and not in any `.planning`.
  capture: (dir, _sub, opts) => cmdCapture(dir, opts),
  // Same `--file` override, and STANDALONE beside `status` rather than a
  // drift kind inside it (D-07) - see cmdCaptureSections.
  'capture-sections': (dir, _sub, opts) => cmdCaptureSections(dir, opts),
  // --root, never --dir, for the reason stated above cmdDebtHarvest: it scans
  // SOURCE and writes into `.planning`. Same declared row, same door.
  'debt-harvest': (_dir, _sub, opts) =>
    cmdDebtHarvest(typeof opts.root === 'string' ? opts.root : process.cwd()),
  renumber: (dir, sub, opts) => cmdRenumber(dir, sub, opts),
  'milestone-prune': (dir, _sub, opts) => cmdMilestonePrune(dir, opts),
};

try {
  const { words, opts } = parseArgs(ARGV);
  const [cmd, sub] = words;
  // EVERY flag the resolved row declares is judged here, at the door, before
  // any handler runs - not just `--dir`, and not at the two sites this file
  // used to consult its own table from. 98 of the table's entries are this
  // script's, and while only two of them were read, a row could say `refuse`
  // while the CLI wrote the value through: `cursor set --name` (bare) answered
  // ok:true and wrote `Phase: 1 of 5 (true)` into STATE.md.
  //
  // It is read from raw ARGV on purpose: parseArgs mints the boolean `true` for
  // a bare flag, so by the time a value reaches `opts` the three spellings a
  // declared row separates - bare, empty and flag-shaped - have collapsed into
  // one. A bare `--dir` reached `existsSync(true)` that way and printed a
  // DEP0187 deprecation warning on STDERR beside the answer, and stdout is the
  // single channel the seam layer parses.
  //
  // The door judges PRESENCE-free: an absent flag is left to the handler that
  // owns its wording, so `cursor set` with no `--phase` still answers `cursor
  // set needs --phase <N>` and `capture` with no `--kind` still names its three
  // kinds. The `'*'` row is evaluated first, which keeps `--dir`'s refusal the
  // one that answers ahead of an unknown subcommand exactly as it did.
  //
  // `opts` is deliberately NOT mutated. The handlers pass their own values to
  // `requireInt`, `requirePhaseArg` and `resolveTextFlag`, and overwriting or
  // deleting a key here would change what `resolveTextFlag` sees and silently
  // drop its "takes --x or --x-file, never both" refusal.
  //
  // The refusal is `fail('bad-args', ...)` and never the `missing-flag-value`
  // throw the seam-input readers raise (D-07): this file has ONE refusal
  // vocabulary and no `e.seam` catch arm to render that throw as anything but
  // `internal`.
  const args = evaluateRow(ARGV, CONTRACTS['planning.mjs'], subcommandKey(words));
  const handler = COMMANDS[cmd];
  if (!args.ok) fail('bad-args', argRefusal(subcommandKey(words), args.detail));
  else if (!handler) fail('usage', `subcommand: ${Object.keys(COMMANDS).join(' | ')} (got: ${cmd || 'none'})`);
  else handler(args.values['--dir'] || '.planning', sub, opts, words.slice(1));
} catch (e) {
  fail('internal', e && e.message ? e.message : String(e));
}
