#!/usr/bin/env node
// @ts-check
// planning.mjs - the .planning state-machine seam. Deterministic reads and
// writes of the planning file set, so workflow prose keeps judgment and this
// script keeps invariants (design-notes/planning-mjs-interface.md).
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
'use strict';

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  CURSOR_STATUSES, parseCursor, renderCursor, parseRoadmapPhases,
  parseRequirements, parseUat, renderUat, uatComplete, atomicWrite,
  setPhaseBox, setReqStatus,
} from './lib/planning-files.mjs';

const out = (o) => { process.stdout.write(JSON.stringify(o) + '\n'); };
const ok = (o) => { out({ ok: true, ...o }); process.exitCode = 0; };
const fail = (reason, detail, hint) => {
  out({ ok: false, reason, ...(detail ? { detail } : {}), ...(hint ? { hint } : {}) });
  process.exitCode = 1;
};

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
  const roadmap = parseRoadmapPhases(roadmapText);
  if (!roadmap.length) return fail('unparseable-roadmap', 'no `- [ ] **Phase N: ...**` lines under ## Phases');

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
    else if (current === null) agrees = parsed.status === 'phase complete';
    else agrees = parsed.phase === current &&
      (AGREE[currentEntry.status] || []).includes(parsed.status);
    cursor = { phase: parsed.phase, status: parsed.status, next: parsed.next, updated: parsed.updated, agrees };
    if (!agrees) {
      drift.push({
        kind: 'cursor', phase: parsed.phase,
        detail: `cursor says phase ${parsed.phase} ${parsed.status}; derived ` +
          (current === null ? 'all complete' : `phase ${current} ${currentEntry.status}`),
      });
    }
  }

  ok({
    current, total: derived.length,
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
  const phase = Number(opts.phase);
  if (!opts.phase || Number.isNaN(phase)) return fail('bad-args', 'cursor set needs --phase <N>');
  if (!opts.status || !opts.next) return fail('bad-args', 'cursor set needs --status and --next');
  if (!CURSOR_STATUSES.includes(opts.status)) {
    return fail('bad-status', `"${opts.status}" is not in the lifecycle: ${CURSOR_STATUSES.join(' | ')}`);
  }

  // name/total: explicit flag > ROADMAP derivation > existing cursor > fail.
  let name = opts.name;
  let total = opts.total ? Number(opts.total) : undefined;
  if (name === undefined || total === undefined) {
    const phases = parseRoadmapPhases(read(join(dir, 'ROADMAP.md')) || '');
    const entry = phases.find((p) => p.n === phase);
    if (name === undefined && entry) name = entry.name;
    if (total === undefined && phases.length) total = phases.length;
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
    const ids = opts.reqs
      ? opts.reqs.split(',').map((s) => s.trim())
      : rows.filter((r) => r.phase === n && r.status !== 'Deferred').map((r) => r.id);
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

const UAT_RESULTS = ['pass', 'fail', 'skipped', 'blocked'];

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
    const f = readStdinJson();
    if (f === null) return;
    const uat = loadUat(dir, n);
    if (!uat) return;
    const find = (ref) => uat.items.find((i) =>
      (ref.k !== undefined && Number(i.k) === Number(ref.k)) || i.name === ref.name);
    let auto = 0, gaps = 0, added = 0;
    for (const p of f.passes || []) {
      const it = find(p);
      if (it && it.status === 'pending') {
        it.status = 'pass'; it.source = 'verifier';
        if (p.evidence) it.evidence = p.evidence;
        if (it.first_pass === undefined) it.first_pass = 'pass';
        auto++;
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
      } else if (!it) {
        uat.items.push({ k: ++k, name: g.name, expected: g.expected || g.reason || '',
          status: 'fail', source: 'verifier', severity: g.severity || 'major',
          ...(g.reason ? { reported: g.reason } : {}),
          ...(g.evidence ? { evidence: g.evidence } : {}), first_pass: 'fail' });
        gaps++; added++;
      }
    }
    for (const h of f.human_checks || []) {
      if (!find(h)) {
        uat.items.push({ k: ++k, name: h.name, expected: h.expected || '', status: 'pending' });
        added++;
      }
    }
    writeUat(dir, n, uat);
    return ok({ auto_passed: auto, gaps, added, next: nextPending(uat.items) });
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

const COMMANDS = {
  status: (dir, _sub, _opts) => cmdStatus(dir),
  cursor: (dir, sub, opts) => {
    if (sub === 'get') return cmdCursorGet(dir);
    if (sub === 'set') return cmdCursorSet(dir, opts);
    return fail('usage', 'cursor <get|set>');
  },
  'phase-done': (dir, _sub, opts) => cmdPhaseDone(dir, opts),
  uat: (dir, sub, opts) => cmdUat(dir, sub, opts),
};

try {
  const { words, opts } = parseArgs(process.argv.slice(2));
  const [cmd, sub] = words;
  const dir = opts.dir || '.planning';
  const handler = COMMANDS[cmd];
  if (!handler) fail('usage', `subcommand: ${Object.keys(COMMANDS).join(' | ')} (got: ${cmd || 'none'})`);
  else handler(dir, sub, opts);
} catch (e) {
  fail('internal', e && e.message ? e.message : String(e));
}
