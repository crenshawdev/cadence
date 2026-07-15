// Zero-dep tests for planning.mjs. Run: node --test 'cadence-core/bin/*.test.mjs'
// Contract source: design-notes/planning-mjs-interface.md - the JSON shapes
// asserted here ARE the spec. Only node: builtins, per the repo ethos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PLANNING = join(dirname(fileURLToPath(import.meta.url)), 'planning.mjs');

// ---------------------------------------------------------------------------
// Fixture builder: fabricate a .planning tree from a compact spec.
//   makeTree({
//     roadmap: [{n:1, name:'Foundation', checked:true}, ...],
//     phases:  {1:{plan:true, summary:true, uat:[{status:'pass'}, ...]},
//               3:{plan:['PLAN-1.md','PLAN-2.md']}},
//     reqs:    [['REQ-1', 1, 'Complete'], ['REQ-9', 2, 'Deferred']],
//     cursor:  {phase:2, total:3, name:'Auth', status:'planned',
//               next:'/cad-execute 2', updated:'2026-01-01'},
//   }) -> absolute path of the .planning dir
// ---------------------------------------------------------------------------
function makeTree(spec) {
  const dir = join(mkdtempSync(join(tmpdir(), 'cad-planning-')), '.planning');
  mkdirSync(dir, { recursive: true });

  if (spec.roadmap) {
    const lines = spec.roadmap.map((p) =>
      `- [${p.checked ? 'x' : ' '}] **Phase ${p.n}: ${p.name}** - ${p.desc || 'desc'}`);
    writeFileSync(join(dir, 'ROADMAP.md'),
      `# Roadmap: Fixture\n\n## Overview\n\nx\n\n## Phases\n\n${lines.join('\n')}\n\n## Phase Details\n\nx\n`);
  }

  for (const [n, ph] of Object.entries(spec.phases || {})) {
    const pdir = join(dir, 'phases', n);
    mkdirSync(pdir, { recursive: true });
    const plans = ph.plan === true ? ['PLAN.md'] : (ph.plan || []);
    for (const f of plans) writeFileSync(join(pdir, f), `# Plan ${n}\n`);
    if (ph.summary) writeFileSync(join(pdir, 'SUMMARY.md'), `---\nphase: ${n}\nstatus: complete\n---\n`);
    if (ph.uat) {
      const items = ph.uat.map((it, i) => {
        let s = `### ${i + 1}. Item ${i + 1}\nexpected: behavior ${i + 1}\nstatus: ${it.status}\n`;
        if (it.reason) s += `reason: ${it.reason}\n`;
        if (it.first_pass) s += `first_pass: ${it.first_pass}\n`;
        return s;
      });
      writeFileSync(join(pdir, 'UAT.md'),
        `---\nstatus: testing\nphase: ${n}\nstarted: 2026-01-01\nupdated: 2026-01-01\n---\n\n## Items\n\n${items.join('\n')}\n## Summary\n\ntotal: ${ph.uat.length}\n`);
    }
  }

  if (spec.reqs) {
    const rows = spec.reqs.map(([id, ph, st]) =>
      `| ${id} | ${ph === null ? '' : `Phase ${ph}`} | ${st} |`);
    writeFileSync(join(dir, 'REQUIREMENTS.md'),
      `# Requirements: Fixture\n\n## Traceability\n\n| Requirement | Phase | Status |\n|---|---|---|\n${rows.join('\n')}\n`);
  }

  if (spec.cursor) {
    const c = spec.cursor;
    writeFileSync(join(dir, 'STATE.md'),
      `# State\n\nPhase: ${c.phase} of ${c.total} (${c.name})\nStatus: ${c.status}\nNext: ${c.next}\nUpdated: ${c.updated}\n`);
  }
  return dir;
}

/** Run planning.mjs against a fixture dir; parse the one JSON line. */
function run(args, dir, stdin) {
  let stdout;
  let code = 0;
  try {
    stdout = execFileSync('node', [PLANNING, ...args, '--dir', dir],
      { encoding: 'utf8', ...(stdin !== undefined ? { input: stdin } : {}) });
  } catch (e) {
    stdout = e.stdout; code = e.status;
  }
  return { ...JSON.parse(stdout), _exit: code };
}

const TODAY = new Date().toISOString().slice(0, 10);

// --- status: failure shapes --------------------------------------------------

test('status: missing .planning degrades with a recovery hint', () => {
  const r = run(['status'], join(tmpdir(), 'cad-does-not-exist'));
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'no-planning-dir');
  assert.equal(r.hint, '/cad-new-project');
  assert.equal(r._exit, 1);
});

test('status: missing ROADMAP.md is no-roadmap', () => {
  const dir = makeTree({});
  const r = run(['status'], dir);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'no-roadmap');
});

test('status: roadmap without phase lines is unparseable-roadmap', () => {
  const dir = makeTree({});
  writeFileSync(join(dir, 'ROADMAP.md'), '# Roadmap\n\n## Phases\n\n(nothing)\n');
  const r = run(['status'], dir);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'unparseable-roadmap');
});

// --- status: derivation ------------------------------------------------------

test('status: derives unplanned/planned/executed/complete from artifacts', () => {
  const dir = makeTree({
    roadmap: [
      { n: 1, name: 'Done', checked: true },
      { n: 2, name: 'Built' },
      { n: 3, name: 'Planned' },
      { n: 4, name: 'Future' },
    ],
    phases: {
      1: { plan: true, summary: true, uat: [{ status: 'pass' }, { status: 'skipped', reason: 'n/a here' }] },
      2: { plan: true, summary: true, uat: [{ status: 'pass' }, { status: 'fail' }, { status: 'pending' }] },
      3: { plan: true },
    },
  });
  const r = run(['status'], dir);
  assert.equal(r.ok, true);
  assert.deepEqual(r.phases.map((p) => p.status), ['complete', 'executed', 'planned', 'unplanned']);
  assert.equal(r.current, 2); // lowest non-complete
  assert.equal(r.total, 4);
  assert.deepEqual(r.phases[1].uat, { pass: 1, fail: 1, pending: 1, skipped: 0, blocked: 0 });
  assert.equal(r.phases[0].plans, undefined); // single PLAN.md is the default - omitted
  assert.equal(r.drift, undefined); // boxes all agree with derivation - omitted
});

test('status: SUMMARY without UAT is executed, not complete', () => {
  const dir = makeTree({
    roadmap: [{ n: 1, name: 'Only' }],
    phases: { 1: { plan: true, summary: true } },
  });
  const r = run(['status'], dir);
  assert.equal(r.phases[0].status, 'executed');
});

test('status: all complete -> current null; multi-plan files listed', () => {
  const dir = makeTree({
    roadmap: [{ n: 1, name: 'Only', checked: true }],
    phases: { 1: { plan: ['PLAN-1.md', 'PLAN-2.md'], summary: true, uat: [{ status: 'pass' }] } },
  });
  const r = run(['status'], dir);
  assert.equal(r.current, null);
  assert.deepEqual(r.phases[0].plans, ['PLAN-1.md', 'PLAN-2.md']);
});

test('status: skipped without a reason blocks completeness', () => {
  const dir = makeTree({
    roadmap: [{ n: 1, name: 'Only' }],
    phases: { 1: { plan: true, summary: true, uat: [{ status: 'pass' }, { status: 'skipped' }] } },
  });
  const r = run(['status'], dir);
  assert.equal(r.phases[0].status, 'executed');
});

// --- status: drift -----------------------------------------------------------

test('status: roadmap-box drift both directions', () => {
  const dir = makeTree({
    roadmap: [
      { n: 1, name: 'DoneUnchecked' },                 // derived complete, box open
      { n: 2, name: 'OpenChecked', checked: true },    // derived planned, box checked
    ],
    phases: {
      1: { plan: true, summary: true, uat: [{ status: 'pass' }] },
      2: { plan: true },
    },
  });
  const r = run(['status'], dir);
  const kinds = r.drift.map((d) => `${d.kind}:${d.phase}`);
  assert.ok(kinds.includes('roadmap-box:1'));
  assert.ok(kinds.includes('roadmap-box:2'));
});

test('status: req-status drift; Deferred and unmapped rows exempt', () => {
  const dir = makeTree({
    roadmap: [{ n: 1, name: 'Done', checked: true }, { n: 2, name: 'Open' }],
    phases: {
      1: { plan: true, summary: true, uat: [{ status: 'pass' }] },
      2: { plan: true },
    },
    reqs: [
      ['REQ-1', 1, 'Pending'],   // phase complete, row Pending -> drift
      ['REQ-2', 2, 'Complete'],  // phase planned, row Complete -> drift
      ['REQ-3', 2, 'Deferred'],  // exempt
      ['REQ-4', null, 'Pending'],// unmapped: audit's concern, not drift
    ],
  });
  const r = run(['status'], dir);
  const reqDrift = r.drift.filter((d) => d.kind === 'req-status');
  assert.equal(reqDrift.length, 2);
  assert.match(reqDrift[0].detail, /REQ-1/);
  assert.match(reqDrift[1].detail, /REQ-2/);
});

test('status: cursor agreement and disagreement', () => {
  const spec = {
    roadmap: [{ n: 1, name: 'Only' }],
    phases: { 1: { plan: true } },
    cursor: { phase: 1, total: 1, name: 'Only', status: 'planned', next: '/cad-execute 1', updated: '2026-01-01' },
  };
  const agree = run(['status'], makeTree(spec));
  assert.equal(agree.cursor.agrees, true);
  assert.equal(agree.drift, undefined);

  const stale = run(['status'], makeTree({
    ...spec,
    cursor: { ...spec.cursor, status: 'executed' }, // derivation says planned
  }));
  assert.equal(stale.cursor.agrees, false);
  assert.equal(stale.drift[0].kind, 'cursor');
});

test('status: paused cursor always agrees (legal at any point)', () => {
  const r = run(['status'], makeTree({
    roadmap: [{ n: 1, name: 'Only' }],
    phases: { 1: { plan: true } },
    cursor: { phase: 1, total: 1, name: 'Only', status: 'paused', next: 'resume: finish task 2', updated: '2026-01-01' },
  }));
  assert.equal(r.cursor.agrees, true);
});

// --- cursor get / set --------------------------------------------------------

test('cursor get: parses the canonical schema; missing file is no-cursor', () => {
  const dir = makeTree({
    roadmap: [{ n: 1, name: 'Only' }],
    cursor: { phase: 1, total: 1, name: 'Only', status: 'planned', next: '/cad-execute 1', updated: '2026-01-01' },
  });
  const r = run(['cursor', 'get'], dir);
  assert.equal(r.ok, true);
  assert.equal(r.phase, 1);
  assert.equal(r.name, 'Only');

  const none = run(['cursor', 'get'], makeTree({}));
  assert.equal(none.reason, 'no-cursor');
});

test('cursor set: derives name/total from ROADMAP, stamps today, writes 4 lines', () => {
  const dir = makeTree({ roadmap: [{ n: 1, name: 'Foundation' }, { n: 2, name: 'Auth' }] });
  const r = run(['cursor', 'set', '--phase', '2', '--status', 'planned', '--next', '/cad-execute 2'], dir);
  assert.equal(r.ok, true);
  assert.deepEqual(r.cursor, {
    phase: 2, total: 2, name: 'Auth', status: 'planned', next: '/cad-execute 2', updated: TODAY,
  });
  const text = readFileSync(join(dir, 'STATE.md'), 'utf8');
  assert.equal(text,
    `# State\n\nPhase: 2 of 2 (Auth)\nStatus: planned\nNext: /cad-execute 2\nUpdated: ${TODAY}\n`);
  // atomic: no temp file left behind
  assert.ok(!readdirSync(dir).some((f) => f.endsWith('.tmp')));
});

test('cursor set: rejects a status outside the lifecycle', () => {
  const dir = makeTree({ roadmap: [{ n: 1, name: 'Only' }] });
  const r = run(['cursor', 'set', '--phase', '1', '--status', 'doing stuff', '--next', 'x'], dir);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'bad-status');
  assert.equal(readdirSync(dir).includes('STATE.md'), false); // nothing written
});

test('cursor set: no ROADMAP and no flags cannot derive', () => {
  const dir = makeTree({});
  const r = run(['cursor', 'set', '--phase', '1', '--status', 'planned', '--next', 'x'], dir);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'cannot-derive');
});

test('usage: unknown subcommand degrades, never crashes', () => {
  const r = run(['nonsense'], makeTree({}));
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'usage');
});

// --- phase-done ----------------------------------------------------------------

test('phase-done: flips the box and the phase rows; Deferred untouched; --undo reverses', () => {
  const spec = {
    roadmap: [{ n: 1, name: 'Done' }, { n: 2, name: 'Open' }],
    reqs: [['REQ-1', 1, 'Pending'], ['REQ-2', 1, 'Deferred'], ['REQ-3', 2, 'Pending']],
  };
  const dir = makeTree(spec);
  const r = run(['phase-done', '--n', '1'], dir);
  assert.equal(r.ok, true);
  assert.equal(r.roadmap.now, '[x]');
  assert.deepEqual(r.reqs, ['REQ-1']); // Deferred and other-phase rows untouched

  const roadmap = readFileSync(join(dir, 'ROADMAP.md'), 'utf8');
  assert.match(roadmap, /- \[x\] \*\*Phase 1: Done\*\*/);
  assert.match(roadmap, /- \[ \] \*\*Phase 2: Open\*\*/);
  const reqs = readFileSync(join(dir, 'REQUIREMENTS.md'), 'utf8');
  assert.match(reqs, /REQ-1 \| Phase 1 \| Complete /);
  assert.match(reqs, /REQ-2 \| Phase 1 \| Deferred /);
  assert.match(reqs, /REQ-3 \| Phase 2 \| Pending /);

  const u = run(['phase-done', '--n', '1', '--undo'], dir);
  assert.equal(u.roadmap.now, '[ ]');
  assert.deepEqual(u.reqs, ['REQ-1']);
  assert.match(readFileSync(join(dir, 'ROADMAP.md'), 'utf8'), /- \[ \] \*\*Phase 1: Done\*\*/);
  assert.match(readFileSync(join(dir, 'REQUIREMENTS.md'), 'utf8'), /REQ-1 \| Phase 1 \| Pending /);
});

test('phase-done: unknown phase refuses; nothing written', () => {
  const dir = makeTree({ roadmap: [{ n: 1, name: 'Only' }] });
  const before = readFileSync(join(dir, 'ROADMAP.md'), 'utf8');
  const r = run(['phase-done', '--n', '9'], dir);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'unknown-phase');
  assert.equal(readFileSync(join(dir, 'ROADMAP.md'), 'utf8'), before);
});

// --- uat -----------------------------------------------------------------------

const UAT_ITEMS = JSON.stringify([
  { name: 'Login works', expected: 'user lands on dashboard' },
  { name: 'Logout works', expected: 'session cleared' },
]);

function uatTree() {
  const dir = makeTree({ roadmap: [{ n: 1, name: 'Only' }], phases: { 1: { plan: true, summary: true } } });
  run(['uat', 'init', '--phase', '1'], dir, UAT_ITEMS);
  return dir;
}

test('uat init: writes all-pending checklist and returns the first item', () => {
  const dir = makeTree({ roadmap: [{ n: 1, name: 'Only' }], phases: { 1: { plan: true } } });
  const r = run(['uat', 'init', '--phase', '1'], dir, UAT_ITEMS);
  assert.equal(r.ok, true);
  assert.equal(r.items, 2);
  assert.deepEqual(r.next, { k: 1, name: 'Login works', expected: 'user lands on dashboard' });
  const text = readFileSync(join(dir, '.'.replace('.', ''), 'phases', '1', 'UAT.md'), 'utf8');
  assert.match(text, /status: testing/);
  assert.match(text, /### 1\. Login works/);
  // init refuses to clobber an existing checklist
  const again = run(['uat', 'init', '--phase', '1'], dir, UAT_ITEMS);
  assert.equal(again.reason, 'uat-exists');
});

test('uat record: sets status, first_pass once, returns next pending (zero re-reads)', () => {
  const dir = uatTree();
  const r = run(['uat', 'record', '--phase', '1', '--item', '1', '--result', 'fail',
    '--reported', 'error on submit', '--severity', 'major'], dir);
  assert.equal(r.ok, true);
  assert.deepEqual(r.counts, { pass: 0, fail: 1, pending: 1, skipped: 0, blocked: 0 });
  assert.equal(r.next.k, 2); // the walk continues without re-reading UAT.md

  // fix lands, retest passes - status flips but first_pass stays fail
  run(['uat', 'record', '--phase', '1', '--item', '1', '--result', 'pass'], dir);
  const text = readFileSync(join(dir, 'phases', '1', 'UAT.md'), 'utf8');
  assert.match(text, /first_pass: fail/);
  assert.match(text, /reworked: 1/);
  const done = run(['uat', 'record', '--phase', '1', '--item', '2', '--result', 'pass'], dir);
  assert.equal(done.next, null); // nothing pending left
});

test('uat record: verifier source cannot overwrite a recorded result', () => {
  const dir = uatTree();
  run(['uat', 'record', '--phase', '1', '--item', '1', '--result', 'pass'], dir);
  const r = run(['uat', 'record', '--phase', '1', '--item', '1', '--result', 'fail',
    '--source', 'verifier'], dir);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'would-overwrite');
});

test('uat refresh: appends only new names, never touches recorded results', () => {
  const dir = uatTree();
  run(['uat', 'record', '--phase', '1', '--item', '1', '--result', 'pass'], dir);
  const r = run(['uat', 'refresh', '--phase', '1'], dir, JSON.stringify([
    { name: 'Login works', expected: 'reworded criterion' },  // name exists - skipped
    { name: 'Password reset', expected: 'email arrives' },     // new - appended
  ]));
  assert.equal(r.added, 1);
  assert.equal(r.total, 3);
  const text = readFileSync(join(dir, 'phases', '1', 'UAT.md'), 'utf8');
  assert.match(text, /### 3\. Password reset/);
  assert.match(text, /expected: user lands on dashboard/); // original wording kept
});

test('uat merge: fills pending only, appends unmatched gaps and human checks', () => {
  const dir = uatTree();
  run(['uat', 'record', '--phase', '1', '--item', '2', '--result', 'pass'], dir); // user result
  const r = run(['uat', 'merge', '--phase', '1'], dir, JSON.stringify({
    passes: [{ name: 'Login works', evidence: 'src/auth.ts:42 asserts redirect' },
             { name: 'Logout works', evidence: 'would overwrite - must be ignored' }],
    gaps: [{ name: 'Rate limiting', reason: 'no limiter found on /login' }],
    human_checks: [{ name: 'Email renders in dark mode', expected: 'readable' }],
  }));
  assert.equal(r.ok, true);
  assert.equal(r.auto_passed, 1); // only the pending item; user result untouched
  assert.equal(r.gaps, 1);
  assert.equal(r.added, 2); // the gap + the human check
  const text = readFileSync(join(dir, 'phases', '1', 'UAT.md'), 'utf8');
  assert.match(text, /### 3\. Rate limiting/);
  assert.match(text, /### 4\. Email renders in dark mode/);
  assert.doesNotMatch(text, /would overwrite/);
});

test('uat status: complete only when every item passes or is skipped-with-reason', () => {
  const dir = uatTree();
  run(['uat', 'record', '--phase', '1', '--item', '1', '--result', 'pass'], dir);
  const partial = run(['uat', 'status', '--phase', '1'], dir);
  assert.equal(partial.result, 'partial');
  assert.equal(partial.first_pending.k, 2);

  run(['uat', 'record', '--phase', '1', '--item', '2', '--result', 'skipped',
    '--reason', 'needs a physical device'], dir);
  const complete = run(['uat', 'status', '--phase', '1'], dir);
  assert.equal(complete.result, 'complete');
  assert.equal(complete.first_pending, undefined);
});

test('uat: missing checklist degrades to no-uat', () => {
  const dir = makeTree({ roadmap: [{ n: 1, name: 'Only' }] });
  const r = run(['uat', 'status', '--phase', '1'], dir);
  assert.equal(r.reason, 'no-uat');
});
