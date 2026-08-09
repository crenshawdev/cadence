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
//   recall "<query>"                BM25 over .planning artifacts (SUMMARY/
//                                   CAPTURE/UAT/CONTEXT); memory.backend-gated.
//                                   Bare words after `recall` are joined into
//                                   one query, so an unquoted multi-word call
//                                   searches all of it, not just the first word
//   lease-check --phase N --plan k  every staged path against that plan's own
//                                   declared files: list (the executor's
//                                   commit-step gate)
//   detect-commands [--root <path>]  the project's own lint/typecheck commands,
//                                   read from its manifests (NOT --dir: --root
//                                   is the PROJECT root, one level deep only)
//   trace append --phase N --family <f> --event <e> [--plan k] [--sha s]
//               [--detail "<text>"]  one line onto .planning/trace.jsonl
//   trace render [--phase N]        the four families, the derived id, and
//                                   every worker dispatch paired to its
//                                   return/checkpoint/escalation
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
import { renameSync, rmSync } from 'node:fs';
import {
  CURSOR_STATUSES, parseCursor, renderCursor, parseRoadmapPhases,
  classifyPhaseList, CLOSED_CYCLE_NAME,
  parseRequirements, parseUat, renderUat, uatComplete, atomicWrite,
  setPhaseBox, setReqStatus, parsePlanRequirements, parsePlanFiles,
  shiftPhaseTokens, findProsePhaseRefs, cutPhaseDetail,
  parseSummarySnippets, parseCaptureSnippets, parseContextDecisions,
  parseActiveIds, classifyActiveSection, isRequirementId, insertReqRows,
  classifyAcceptanceCriteria, UAT_ORIGINS, UAT_SOURCES, UAT_FIELDS_VERSION,
} from './lib/planning-files.mjs';
import { mergeLayers } from './lib/config-merge.mjs';
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
import { buildIndex, search } from './lib/bm25.mjs';
import { emit } from './lib/seam-io.mjs';
import { requireCursorNumber, requireInt, requirePhaseArg } from './lib/require-int.mjs';

const ok = (o) => emit({ ok: true, ...o });
const fail = (reason, detail, hint) =>
  emit({ ok: false, reason, ...(detail ? { detail } : {}), ...(hint ? { hint } : {}) });

/** Read a file or return null - absence is data here, never a crash. */
function read(file) {
  try { return readFileSync(file, 'utf8'); } catch { return null; }
}

const HERE = dirname(fileURLToPath(import.meta.url));
// The one path this script resolves outside `--dir`. Read relative to the
// SCRIPT, not the cwd, so it names the plugin actually executing - the whole
// point, given the skew this reports on. CADENCE_PLUGIN_MANIFEST overrides it
// (hermetic test injection only; production always uses the shipped file), the
// same precedent as CADENCE_CONFIG_SCHEMA and CADENCE_ROUTE_TABLE.
const MANIFEST_PATH = process.env.CADENCE_PLUGIN_MANIFEST
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
  // The shared reader, for the refusal WORDING - and it keeps writing the
  // numeric value on purpose. `parseCursor` returns a Number that `renumber`'s
  // shift arithmetic, `cmdStatus`'s `parsed.phase === current` agreement test
  // and `phase-plans.mjs`' `cursorPhase` all consume, so a raw-spelled cursor
  // is a wider change than the `--phase` directory fix, and a half-raw cursor
  // would be worse than a numeric one. Stated cost: a cursor set at
  // `--phase 1.10` still renders `Phase: 1.1`.
  const parsedPhase = requirePhaseArg(opts.phase);
  if (!parsedPhase.ok) {
    return fail('bad-args', 'cursor set --phase needs a non-negative phase number (N or N.M)');
  }
  const phase = parsedPhase.value;
  if (!opts.status || !opts.next) return fail('bad-args', 'cursor set needs --status and --next');
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
    phase, total, name, status: opts.status, next: opts.next,
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
  const n = Number(opts.n);
  if (!opts.n || Number.isNaN(n)) return fail('bad-args', 'phase-done needs --n <phase>');
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
    const k = Number(opts.item);
    const item = uat.items.find((i) => Number(i.k) === k);
    if (!item) return fail('unknown-item', `no item ${opts.item} in UAT.md`);
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
      if (opts[flag] !== undefined) item[field] = opts[flag];
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
  const publishedAs = docVersion
    ? tagCarrying(readTags(dir), normalizeTargetVersion(docVersion)) : null;
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
  const settled = (p) => p.status === 'complete'
    || (p.uat !== null && p.uat.items.length > 0 && p.uat.items.every((i) =>
      i.status === 'pass' || i.status === 'blocked'
      || (i.status === 'skipped' && i.reason)));
  const cycleOpen = publishedAs !== null
    && derivePhases(dir, [...roadmap.values()]).some((p) => !settled(p));

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
// in it can be traced in either direction). A `legacy` entry is `{phase,
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
    const contextText = read(join(pdir, 'CONTEXT.md'));
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
  const overlaps = [];
  for (let i = 0; i < declared.length; i++) {
    for (let j = i + 1; j < declared.length; j++) {
      const shared = declared[i].files.filter((x) => declared[j].files.includes(x));
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
  const n = parsedPhase.value;
  // The caller's own spelling, for the directory and for every diagnostic that
  // names one (D-02). The Traceability rows and the echoed `phase` below stay
  // NUMERIC, and that is a KNOWN identity collision rather than an oversight:
  // `parseRequirements` and `audit` compare that cell against ROADMAP phase
  // NUMBERS, so `seed-reqs --phase 1.10` reads `phases/1.10` and writes
  // `| <id> | Phase 1.1 | Pending |`, merging the two sub-phases in the audit.
  // Closing it means carrying the raw spelling through `parseCursor`,
  // `renumber` and `audit` - wider than this fix - and it is queued in
  // `.planning/CAPTURE.md` naming both surviving sites.
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
  if (backend === 'none') return ok({ backend: 'none', results: [], ...warn });

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

  if (!corpus.length) return ok({ results: [], ...warn });

  // search() returns [{i, score}] in (score desc, corpus position asc) order -
  // already total because the corpus is in sorted traversal order, so do NOT
  // re-sort. Round the score so stdout is byte-stable across the Node matrix.
  const index = buildIndex(corpus.map((c) => c.text));
  const results = search(index, query).map(({ i, score }) => {
    const c = corpus[i];
    return {
      score: Math.round(score * 1e4) / 1e4,
      source: c.source,
      ...(c.phase !== undefined ? { phase: c.phase } : {}),
      snippet: c.text,
    };
  });
  ok({ results, ...warn });
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
// The reader is `parsePlanFiles`, the SAME one cmdPlanOverlap uses, so a path
// the pre-flight overlap gate admitted cannot be refused here and vice versa.
// `declaredPhaseFiles` is the wrong reader: it unions across the PHASE, which
// would let plan 2 stage a file only plan 1 declared.
//
// An unprovable lease is never a pass: a missing plan and an unreadable staged
// set are both ok:false.
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
      `could not read the staged set: ${e && e.message ? e.message : String(e)}`);
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

  // A declared path ending in `/` is a directory lease and matches by prefix;
  // everything else matches exactly. Substring matching would let `src/auth`
  // license `src/authority.rs`.
  const exact = new Set(declared.filter((f) => !f.endsWith('/')));
  const prefixes = declared.filter((f) => f.endsWith('/'));
  const undeclared = staged.filter((p) => p !== reportFile
    && !exact.has(p) && !prefixes.some((d) => p.startsWith(d)));

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
  // `tsconfig.json` and that name ONLY. A non-default `tsconfig*.json` is
  // deliberately not matched: `npx tsc --noEmit` ignores a config it is not
  // pointed at, and guessing `-p` across several candidates would name a
  // CI-only or editor-only project file as the project's typecheck. This repo
  // is exactly that case - its only TS config is tsconfig.ci.json.
  else if (has('tsconfig.json')) { typecheck = 'npx tsc --noEmit'; typecheckSource = 'tsconfig.json'; }
  else if (has('Cargo.toml')) { typecheck = 'cargo check --all-targets'; typecheckSource = 'Cargo.toml'; }
  else if (pyTable('[tool.mypy')) { typecheck = 'mypy .'; typecheckSource = 'pyproject.toml'; }
  else if (has('go.mod')) { typecheck = 'go build ./...'; typecheckSource = 'go.mod'; }

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
    out = execFileSync('git', ['-C', root, 'check-ignore', '-v', '--', TRACE_IGNORE_LINE],
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

function cmdTrace(dir, sub, opts) {
  if (sub === 'ignore') {
    // `--root` is the PROJECT root, deliberately not `--dir`: `.gitignore` lives
    // there while the line it carries is `.planning/trace.jsonl`. A `--root`
    // present with nothing usable after it is REFUSED rather than falling
    // through to the cwd, which would edit a different tree than the caller
    // named (the `#42/#45` rail).
    if ('root' in opts && (typeof opts.root !== 'string' || opts.root.trim() === '')) {
      return fail('bad-args', 'trace ignore --root needs a path after it: --root <project root>');
    }
    return cmdTraceIgnore(typeof opts.root === 'string' ? opts.root : process.cwd(), opts);
  }
  if (sub === 'append') {
    const parsedPhase = requirePhaseArg(opts.phase);
    if (!parsedPhase.ok) return fail('bad-args', 'trace append needs --phase <N>');
    const family = typeof opts.family === 'string' ? opts.family : '';
    if (!FAMILIES.includes(family)) {
      return fail('bad-args', `trace append --family must be one of ${FAMILIES.join(' | ')}`);
    }
    const event = typeof opts.event === 'string' && opts.event ? opts.event : '';
    if (!event) return fail('bad-args', 'trace append needs --event <name>');
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
      ...(typeof opts.plan === 'string' && opts.plan ? { plan: opts.plan } : {}),
      ...(typeof opts.sha === 'string' && opts.sha ? { sha: opts.sha } : {}),
      ...(typeof opts.detail === 'string' && opts.detail ? { detail: opts.detail } : {}),
    });
    return ok({
      written: res.written,
      ...(res.corr ? { corr: res.corr } : {}),
      ...(res.reason ? { reason: res.reason } : {}),
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
    return ok({
      file: r.file,
      corr: r.corr,
      capped: r.capped,
      counts: r.counts,
      ...(r.malformed ? { malformed: r.malformed } : {}),
      events: r.events,
      unpaired: r.unpaired,
    });
  }
  return fail('usage', 'trace <append|render|ignore>');
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
 * Outside a git repo the call fails and this returns [] - correctly, since
 * nothing is tracked there, the `rmSync` fallback removes the directory
 * whole, and no residue can survive to be nested into.
 * `relPath` is relative to `cwd`, so this works whether the caller's `--dir`
 * is absolute or relative.
 * @param {string} cwd @param {string} relPath @returns {string[]}
 */
function uncommittedUnder(cwd, relPath) {
  try {
    const out = execFileSync('git', ['status', '--porcelain', '--ignored', '--', relPath],
      { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return out.split('\n').filter((l) => l.trim()).map((l) => l.slice(3).trim());
  } catch {
    return [];
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

  const at = Number(sub === 'insert' ? opts.at : opts.n);
  if (Number.isNaN(at)) return fail('bad-args', `renumber ${sub} needs --${sub === 'insert' ? 'at' : 'n'} <N>`);
  // Renumbering is integer arithmetic; a decimal insertion (2.1) neither
  // displaces integers nor is displaced by them, so it is never shifted -
  // operating ON one would only produce a half-shifted tree.
  if (!Number.isInteger(at)) return fail('bad-args', 'renumber operates on integer phases; re-place decimal phases by hand');
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
    if (dirty.length) {
      return fail('uncommitted-work',
        `phases/${at} holds ${dirty.length} file(s) with uncommitted state (e.g. ${dirty[0]}) - commit or discard them first; removing the phase would destroy work git cannot recover`,
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
      try { execFileSync('git', ['rm', '-r', '-q', join(dir, 'phases', String(at))], { stdio: 'pipe' }); }
      catch { rmSync(join(dir, 'phases', String(at)), { recursive: true }); }
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
// Dispatch. Adding a subcommand = one entry here + its tests.
// ---------------------------------------------------------------------------
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
  audit: (dir, _sub, _opts) => cmdAudit(dir),
  'criteria-coverage': (dir, _sub, _opts) => cmdCriteriaCoverage(dir),
  'plan-overlap': (dir, _sub, opts) => cmdPlanOverlap(dir, opts),
  'seed-reqs': (dir, _sub, opts) => cmdSeedReqs(dir, opts),
  // Bare words are JOINED, never rejected: every workflow caller quotes, so
  // rejecting extras would turn a today-degraded interactive call into a hard
  // failure. tokenize() splits on non-alphanumerics, so the separator is
  // immaterial; `[].join(' ')` is '', which still trips the bad-args guard.
  recall: (dir, _sub, opts, rest) => cmdRecall(dir, rest.join(' '), opts),
  'lease-check': (dir, _sub, opts) => cmdLeaseCheck(dir, opts),
  // --root, never --dir: this one names the PROJECT root. A `--root` with
  // nothing usable after it is refused rather than silently answered about the
  // cwd, which would report a different tree than the caller named (#42/#45).
  'detect-commands': (_dir, _sub, opts) => (opts.root !== undefined && typeof opts.root !== 'string'
    ? fail('bad-args', 'detect-commands --root needs a path after it: --root <project root>')
    : cmdDetectCommands(opts.root || process.cwd())),
  trace: (dir, sub, opts) => cmdTrace(dir, sub, opts),
  renumber: (dir, sub, opts) => cmdRenumber(dir, sub, opts),
};

try {
  const { words, opts } = parseArgs(process.argv.slice(2));
  const [cmd, sub] = words;
  const dir = opts.dir || '.planning';
  const handler = COMMANDS[cmd];
  if (!handler) fail('usage', `subcommand: ${Object.keys(COMMANDS).join(' | ')} (got: ${cmd || 'none'})`);
  else handler(dir, sub, opts, words.slice(1));
} catch (e) {
  fail('internal', e && e.message ? e.message : String(e));
}
