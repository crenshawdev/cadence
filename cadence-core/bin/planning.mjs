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
//                                   directions; uncovered breaks, untraced
//                                   reports (references/acceptance-criteria.md)
//   recall "<query>"                BM25 over .planning artifacts (SUMMARY/
//                                   CAPTURE/UAT/CONTEXT); memory.backend-gated.
//                                   Bare words after `recall` are joined into
//                                   one query, so an unquoted multi-word call
//                                   searches all of it, not just the first word
'use strict';

import { readFileSync, readdirSync, existsSync, lstatSync } from 'node:fs';
import { join } from 'node:path';
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
  classifyAcceptanceCriteria,
} from './lib/planning-files.mjs';
import { mergeLayers } from './lib/config-merge.mjs';
import { buildIndex, search } from './lib/bm25.mjs';
import { emit } from './lib/seam-io.mjs';
import { requireCursorNumber } from './lib/require-int.mjs';

const ok = (o) => emit({ ok: true, ...o });
const fail = (reason, detail, hint) =>
  emit({ ok: false, reason, ...(detail ? { detail } : {}), ...(hint ? { hint } : {}) });

/** Read a file or return null - absence is data here, never a crash. */
function read(file) {
  try { return readFileSync(file, 'utf8'); } catch { return null; }
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
  const parsedPhase = requireCursorNumber(opts.phase, { decimal: true });
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
function readStdinJson() {
  try { return JSON.parse(readFileSync(0, 'utf8')); }
  catch (e) { fail('bad-payload', e.message); return null; }
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
  const n = Number(opts.phase);
  if (!opts.phase || Number.isNaN(n)) return fail('bad-args', 'uat needs --phase <N>');

  if (sub === 'init' || sub === 'refresh') {
    const items = readStdinJson();
    if (items === null) return;
    if (!Array.isArray(items) || items.some((i) => !i.name || !i.expected)) {
      return fail('bad-payload', 'expected a JSON array of {name, expected}');
    }
    if (sub === 'init') {
      if (existsSync(uatFile(dir, n))) return fail('uat-exists', 'use refresh, or remove the file deliberately');
      const today = new Date().toISOString().slice(0, 10);
      const uat = {
        fm: { status: 'testing', phase: String(n), started: today, updated: today,
          ...(opts.sources ? { sources: opts.sources } : {}) },
        items: items.map((it, i) => ({ k: i + 1, name: it.name, expected: it.expected,
          status: 'pending', ...(it.source ? { source: it.source } : {}) })),
      };
      writeUat(dir, n, uat);
      return ok({ file: uatFile(dir, n), items: uat.items.length, next: nextPending(uat.items) });
    }
    // refresh: append only items whose name matches nothing existing; never
    // touch a recorded result.
    const uat = loadUat(dir, n);
    if (!uat) return;
    const have = new Set(uat.items.map((i) => String(i.name)));
    const fresh = items.filter((i) => !have.has(i.name));
    let k = Math.max(0, ...uat.items.map((i) => Number(i.k)));
    for (const it of fresh) {
      uat.items.push({ k: ++k, name: it.name, expected: it.expected, status: 'pending' });
    }
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
    // Invariant: a verifier result only ever fills a pending item.
    if (source === 'verifier' && item.status !== 'pending') {
      return fail('would-overwrite', `item ${k} is ${item.status}; verifier results only fill pending items`);
    }
    item.status = opts.result;
    if (source === 'verifier') item.source = 'verifier';
    for (const [flag, field] of [['reason', 'reason'], ['reported', 'reported'],
      ['severity', 'severity'], ['cause', 'cause'], ['fix', 'fix'], ['evidence', 'evidence']]) {
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
    const f = readStdinJson();
    if (f === null) return;
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
    for (const p of f.passes || []) {
      const it = find(p);
      if (it && it.status === 'pending') {
        it.status = 'pass'; it.source = 'verifier';
        if (p.evidence) it.evidence = p.evidence;
        if (it.first_pass === undefined) it.first_pass = 'pass';
        auto++;
      } else if (it) skipped++;
      else rejected++; // a pass matching no item can never be applied
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
      } else if (it) skipped++;
      else {
        const name = usableName(g);
        // `gaps` counts gaps actually recorded in the file, so a rejected
        // entry that wrote nothing must not inflate it - otherwise the
        // envelope reports three gaps found for one item written.
        if (!name) { rejected++; continue; }
        uat.items.push({ k: ++k, name, expected: g.expected || g.reason || '',
          status: 'fail', source: 'verifier', severity: g.severity || 'major',
          ...(g.reason ? { reported: g.reason } : {}),
          ...(g.evidence ? { evidence: g.evidence } : {}), first_pass: 'fail' });
        gaps++; added++;
      }
    }
    for (const h of f.human_checks || []) {
      if (find(h)) continue;
      const name = usableName(h);
      if (!name) { rejected++; continue; } // appends the identical phantom, at pending
      uat.items.push({ k: ++k, name, expected: h.expected || '', status: 'pending' });
      added++;
    }
    writeUat(dir, n, uat);
    return ok({ auto_passed: auto, gaps, added, skipped, rejected, next: nextPending(uat.items) });
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
// ---------------------------------------------------------------------------

// An `origin` value that declares an item legitimately built from no criterion.
// Mirrors UAT_ORIGINS in lib/planning-files.mjs minus `criterion`, which names
// no id by itself and therefore exempts nothing.
const ORIGIN_EXEMPT = new Set(['verifier', 'smoke']);

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
    // EITHER file absent -> the phase contributes nothing at all: no break, no
    // `phases[]` entry (D-10). CONTEXT is a documented optional artifact, and
    // `milestone.md` runs this gate at step 1 while the prune that DELETES
    // phase dirs runs at step 3 - so a prior milestone's pruned phase must
    // never make the gate unpassable.
    if (contextText === null || uatText === null) continue;

    const classified = classifyAcceptanceCriteria(contextText);
    // `criteria: null` is an absent heading - "nothing declared", not a
    // problem. Coerced to [] here because the phase's files both exist, so it
    // still reports its `phases[]` entry and its items still trace (to nothing,
    // which is `untraced`'s additive job).
    const criteria = classified.criteria || [];
    const items = parseUat(uatText).items;
    if (classified.issues.length) contextIssues.push({ phase: p.n, issues: classified.issues });
    phases.push({ phase: p.n, criteria: criteria.length, items: items.length });

    const withCriterion = items.filter((it) => it.criterion !== undefined);
    const withOrigin = items.filter((it) => it.origin !== undefined);
    // Pre-field legacy (D-16): a checklist written before either field existed.
    // The `origin` half of the test is LOAD-BEARING. Every checklist written
    // after this phase carries at least one `origin` - the cold-start smoke item
    // is emitted with `origin: smoke` and every appended gap item gets
    // `origin: verifier` - so a UAT carrying some `origin` but not one
    // `criterion` is NOT an old project: it is a post-field checklist whose
    // links were dropped, and its criteria break normally. Widen this back to a
    // bare no-`criterion` test and the exemption absolves exactly the
    // regression this subcommand exists to catch: a `/cad-verify` that silently
    // stops emitting `criterion` reads as "an old project" and the gate stays
    // green forever. An EMPTY checklist is not legacy - an empty checklist is
    // the drop itself, so its criteria all break.
    if (items.length && withCriterion.length === 0 && withOrigin.length === 0) {
      legacy.push(p.n);
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
  const n = Number(opts.phase);
  if (!opts.phase || Number.isNaN(n)) return fail('bad-args', 'plan-overlap needs --phase <N>');
  const pdir = join(dir, 'phases', String(n));
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
  const parsedPhase = requireCursorNumber(opts.phase, { decimal: true });
  if (!parsedPhase.ok) return fail('bad-args', 'seed-reqs needs --phase <N>');
  const n = parsedPhase.value;

  // #42/#45 rail: the flag is validated before any read.
  const reqFile = join(dir, 'REQUIREMENTS.md');
  const reqText = read(reqFile);
  if (reqText === null) return fail('no-requirements', `${reqFile} not found`);

  const pdir = join(dir, 'phases', String(n));
  let planFiles = [];
  try { planFiles = readdirSync(pdir).filter((f) => /^PLAN(-\d+)?\.md$/.test(f)).sort(); }
  catch { return fail('no-phase-dir', `${pdir} not found`); }
  if (!planFiles.length) return fail('no-plans', `no PLAN(-N).md under ${pdir}`, `/cad-plan ${n}`);

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
    if (issues.length) frontmatterIssues.push({ file: `phases/${n}/${f}`, issues });
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
  const backend = mergeLayers(join(dir, 'config.json')).config?.memory?.backend ?? 'builtin';
  if (backend === 'none') return ok({ backend: 'none', results: [] });

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

  if (!corpus.length) return ok({ results: [] });

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
  ok({ results });
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
