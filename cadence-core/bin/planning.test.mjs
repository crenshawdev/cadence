// Zero-dep tests for planning.mjs. Run: node --test 'cadence-core/bin/*.test.mjs'
// The JSON shapes asserted here ARE the interface contract - there is no
// spec file beyond them. Only node: builtins, per the repo ethos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync } from 'node:fs';
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
    const details = spec.roadmap.map((p) =>
      `### Phase ${p.n}: ${p.name}\n**Goal:** goal ${p.n}\n**Depends on:** ${p.n === 1 ? 'Nothing' : `Phase ${p.n - 1}`}\n`);
    writeFileSync(join(dir, 'ROADMAP.md'),
      `# Roadmap: Fixture\n\n## Overview\n\nx\n\n## Phases\n\n${lines.join('\n')}\n\n## Phase Details\n\n${details.join('\n')}`);
  }

  for (const [n, ph] of Object.entries(spec.phases || {})) {
    const pdir = join(dir, 'phases', n);
    mkdirSync(pdir, { recursive: true });
    const plans = ph.plan === true ? ['PLAN.md'] : (ph.plan || []);
    for (const f of plans) {
      const reqs = ph.planReqs ? `---\nphase: ${n}\nrequirements: [${ph.planReqs.join(', ')}]\nfiles: []\n---\n` : '';
      writeFileSync(join(pdir, f), `${reqs}# Plan ${n}\n`);
    }
    // SUMMARY: frontmatter-only when `summary` is set; with real `##
    // Deviations` / `## Open items` bullets when `summaryBody` (a
    // {deviations?, openItems?} object) is given - the recall corpus needs
    // item-level bodies to rank against.
    if (ph.summary || ph.summaryBody) {
      let body = `---\nphase: ${n}\nstatus: complete\n---\n`;
      if (ph.summaryBody) {
        const devs = (ph.summaryBody.deviations || []).map((d) => `- ${d}`).join('\n') || '- None.';
        const opens = (ph.summaryBody.openItems || []).map((o) => `- ${o}`).join('\n') || '- None.';
        body += `\n## Deviations\n\n${devs}\n\n## Open items\n\n${opens}\n`;
      }
      writeFileSync(join(pdir, 'SUMMARY.md'), body);
    }
    // CONTEXT: a `## Durable decisions` section (from `durableDecisions`) and/or
    // a `## Decisions` section (from `contextDecisions`), both `- D-NN (area):
    // text` lines with one continuous D-NN sequence across both when given
    // together. Omitting `durableDecisions` entirely writes no durable heading
    // at all (the legacy shape); `durableDecisions: []` writes a present-but-
    // empty `## Durable decisions` heading (the v1.2 all-phase-local shape).
    if (ph.contextDecisions || ph.durableDecisions) {
      let k = 0;
      const next = () => `D-${String(++k).padStart(2, '0')}`;
      const parts = [`# Phase ${n} Context\n`];
      if (ph.durableDecisions !== undefined) {
        const lines = ph.durableDecisions.map((d) => `- ${next()} (area): ${d}`).join('\n');
        parts.push(`## Durable decisions\n\n${lines}\n`);
      }
      if (ph.contextDecisions) {
        const lines = ph.contextDecisions.map((d) => `- ${next()} (area): ${d}`).join('\n');
        parts.push(`## Decisions\n\n${lines}\n`);
      }
      writeFileSync(join(pdir, 'CONTEXT.md'), parts.join('\n'));
    }
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

  // CAPTURE.md: a top-level `[{section:'Todos'|'Seeds'|'Notes', text, phase?}]`
  // list, each bullet under its named heading (todos carry a `(phase N)` tag
  // when phase is given, matching /cad-capture's real format).
  if (spec.capture) {
    const bySection = { Todos: [], Seeds: [], Notes: [] };
    for (const c of spec.capture) {
      const tag = c.phase !== undefined ? `(phase ${c.phase}) ` : '';
      const box = c.section === 'Todos' ? '[ ] ' : '';
      bySection[c.section].push(`- ${box}${tag}${c.text}`);
    }
    writeFileSync(join(dir, 'CAPTURE.md'),
      `## Todos\n\n${bySection.Todos.join('\n')}\n\n## Seeds\n\n${bySection.Seeds.join('\n')}\n\n` +
      `## Notes\n\n${bySection.Notes.join('\n')}\n`);
  }

  // config.json written verbatim from `spec.config` (the backend-off test pins
  // memory.backend here).
  if (spec.config) writeFileSync(join(dir, 'config.json'), JSON.stringify(spec.config));

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

// Computed per-assertion (never at module load): a run that straddles
// midnight sees the stamp land on either side, and both are correct.
const today = () => new Date().toISOString().slice(0, 10);

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

test('status: decimal insertion phases sort and derive like integers', () => {
  const dir = makeTree({
    roadmap: [{ n: 1, name: 'One', checked: true }, { n: 2.1, name: 'Hotfix' }, { n: 3, name: 'Three' }],
    phases: {
      1: { plan: true, summary: true, uat: [{ status: 'pass' }] },
      '2.1': { plan: true },
    },
  });
  const r = run(['status'], dir);
  assert.equal(r.ok, true);
  assert.deepEqual(r.phases.map((p) => p.n), [1, 2.1, 3]); // numeric sort, 2.1 between
  assert.deepEqual(r.phases.map((p) => p.status), ['complete', 'planned', 'unplanned']);
  assert.equal(r.current, 2.1); // lowest non-complete, decimals included
  assert.equal(r.total, 3);
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

test('cursor get: malformed STATE.md degrades to unparseable-cursor', () => {
  const dir = makeTree({});
  writeFileSync(join(dir, 'STATE.md'), '# State\n\nWorking on stuff, back soon\n');
  const r = run(['cursor', 'get'], dir);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'unparseable-cursor');
  assert.equal(r._exit, 1);
});

test('cursor set: falls back to the existing cursor when ROADMAP is absent', () => {
  const dir = makeTree({
    cursor: { phase: 1, total: 3, name: 'Solo', status: 'planned', next: 'x', updated: '2026-01-01' },
  });
  const r = run(['cursor', 'set', '--phase', '1', '--status', 'executed', '--next', '/cad-verify 1'], dir);
  assert.equal(r.ok, true);
  assert.equal(r.cursor.name, 'Solo');   // from the prior cursor (same phase)
  assert.equal(r.cursor.total, 3);       // prior total carried forward
  assert.equal(r.cursor.status, 'executed');
});

test('cursor set: derives name/total from ROADMAP, stamps today, writes 4 lines', () => {
  const dir = makeTree({ roadmap: [{ n: 1, name: 'Foundation' }, { n: 2, name: 'Auth' }] });
  const before = today();
  const r = run(['cursor', 'set', '--phase', '2', '--status', 'planned', '--next', '/cad-execute 2'], dir);
  const after = today();
  assert.equal(r.ok, true);
  // Midnight-robust: the stamp must be the subprocess's run date, which is
  // one of the two dates observed around the call (usually the same one).
  assert.ok([before, after].includes(r.cursor.updated),
    `updated ${r.cursor.updated} not in [${before}, ${after}]`);
  assert.deepEqual(r.cursor, {
    phase: 2, total: 2, name: 'Auth', status: 'planned', next: '/cad-execute 2',
    updated: r.cursor.updated,
  });
  const text = readFileSync(join(dir, 'STATE.md'), 'utf8');
  assert.equal(text,
    `# State\n\nPhase: 2 of 2 (Auth)\nStatus: planned\nNext: /cad-execute 2\nUpdated: ${r.cursor.updated}\n`);
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

test('phase-done: decimal phase flips its own box and rows only', () => {
  const dir = makeTree({
    roadmap: [{ n: 1, name: 'One' }, { n: 2.1, name: 'Hotfix' }],
    reqs: [['REQ-1', 2.1, 'Pending'], ['REQ-2', 1, 'Pending']],
  });
  const r = run(['phase-done', '--n', '2.1'], dir);
  assert.equal(r.ok, true);
  assert.deepEqual(r.reqs, ['REQ-1']);
  const roadmap = readFileSync(join(dir, 'ROADMAP.md'), 'utf8');
  assert.match(roadmap, /- \[x\] \*\*Phase 2\.1: Hotfix\*\*/);
  assert.match(roadmap, /- \[ \] \*\*Phase 1: One\*\*/);
  const reqs = readFileSync(join(dir, 'REQUIREMENTS.md'), 'utf8');
  assert.match(reqs, /REQ-1 \| Phase 2\.1 \| Complete /);
  assert.match(reqs, /REQ-2 \| Phase 1 \| Pending /);
});

test('phase-done --reqs: explicit ids override the phase filter (even Deferred)', () => {
  const dir = makeTree({
    roadmap: [{ n: 1, name: 'One' }, { n: 2, name: 'Two' }],
    reqs: [['REQ-1', 1, 'Pending'], ['REQ-2', 1, 'Deferred'], ['REQ-3', 2, 'Pending']],
  });
  const r = run(['phase-done', '--n', '1', '--reqs', 'REQ-2, REQ-3'], dir);
  assert.equal(r.ok, true);
  assert.deepEqual(r.reqs, ['REQ-2', 'REQ-3']); // exactly the named rows
  const reqs = readFileSync(join(dir, 'REQUIREMENTS.md'), 'utf8');
  assert.match(reqs, /REQ-1 \| Phase 1 \| Pending /);   // phase row NOT auto-flipped
  assert.match(reqs, /REQ-2 \| Phase 1 \| Complete /);  // Deferred flipped when named
  assert.match(reqs, /REQ-3 \| Phase 2 \| Complete /);
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

test('uat init: refuses a malformed payload, writes nothing', () => {
  const dir = makeTree({ roadmap: [{ n: 1, name: 'Only' }], phases: { 1: { plan: true } } });
  assert.equal(run(['uat', 'init', '--phase', '1'], dir, 'not json {').reason, 'bad-payload');
  assert.equal(run(['uat', 'init', '--phase', '1'], dir, '{"name":"not an array"}').reason, 'bad-payload');
  assert.equal(run(['uat', 'init', '--phase', '1'], dir,
    JSON.stringify([{ name: 'expected missing' }])).reason, 'bad-payload');
  assert.equal(existsSync(join(dir, 'phases', '1', 'UAT.md')), false); // nothing written
});

test('uat record: unknown item and bad result refuse without writing', () => {
  const dir = uatTree();
  assert.equal(run(['uat', 'record', '--phase', '1', '--item', '9', '--result', 'pass'], dir)
    .reason, 'unknown-item');
  const r = run(['uat', 'record', '--phase', '1', '--item', '1', '--result', 'maybe'], dir);
  assert.equal(r.reason, 'bad-result');
  assert.match(r.detail, /pass \| fail \| skipped \| blocked \| pending/);
  const text = readFileSync(join(dir, 'phases', '1', 'UAT.md'), 'utf8');
  assert.match(text, /### 1\. Login works\nexpected: user lands on dashboard\nstatus: pending/);
});

test('uat merge: matches by k, and a verifier pass never rewrites first_pass', () => {
  const dir = uatTree();
  // Item 1 fails, the fix lands, it resets to pending - first_pass is fail.
  run(['uat', 'record', '--phase', '1', '--item', '1', '--result', 'fail', '--reported', 'broken'], dir);
  run(['uat', 'record', '--phase', '1', '--item', '1', '--result', 'pending', '--fix', 'abc1234'], dir);
  const r = run(['uat', 'merge', '--phase', '1'], dir, JSON.stringify({
    passes: [{ k: 1, evidence: 'redirect asserted' }],  // by k, not name
    gaps: [{ k: 2, reason: 'session not cleared' }],    // matches pending item 2
  }));
  assert.equal(r.auto_passed, 1);
  assert.equal(r.gaps, 1);
  assert.equal(r.added, 0); // both matched existing items - nothing appended
  const text = readFileSync(join(dir, 'phases', '1', 'UAT.md'), 'utf8');
  // set-once invariant: the verifier pass keeps the original fail verdict
  assert.match(text, /### 1\. Login works\nexpected: [^\n]*\nstatus: pass\nfirst_pass: fail/);
  // matched-gap branch: fail + default severity, first_pass set on first verdict
  assert.match(text, /### 2\. Logout works\nexpected: [^\n]*\nstatus: fail\nfirst_pass: fail/);
  assert.match(text, /reported: session not cleared/);
  assert.match(text, /severity: major/);
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

test('uat record: fixed failure resets to pending, first_pass survives', () => {
  const dir = uatTree();
  run(['uat', 'record', '--phase', '1', '--item', '1', '--result', 'fail',
    '--reported', 'broken'], dir);
  const r = run(['uat', 'record', '--phase', '1', '--item', '1', '--result', 'pending',
    '--fix', 'abc1234, retest'], dir);
  assert.equal(r.ok, true);
  assert.equal(r.counts.pending, 2); // back in the walk
  const text = readFileSync(join(dir, 'phases', '1', 'UAT.md'), 'utf8');
  assert.match(text, /first_pass: fail/);
  assert.match(text, /fix: abc1234, retest/);
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

// --- audit ---------------------------------------------------------------------

test('audit: traces every break kind, orphans, and deferred', () => {
  const dir = makeTree({
    roadmap: [{ n: 1, name: 'Done', checked: true }, { n: 2, name: 'Open' }],
    phases: {
      1: { plan: true, planReqs: ['REQ-1', 'REQ-6', 'REQ-99'] }, // REQ-99 unknown -> orphan
      2: { plan: true, planReqs: ['REQ-2'] },
    },
    reqs: [
      ['REQ-1', 1, 'Complete'],   // traced: plan + Complete + box checked
      ['REQ-2', 2, 'Pending'],    // not-verified (phase open) - expected state
      ['REQ-3', 2, 'Complete'],   // no plan carries it -> no-plan
      ['REQ-4', null, 'Pending'], // no phase assigned -> no-phase
      ['REQ-5', 7, 'Pending'],    // phase not in roadmap -> phase-missing
      ['REQ-6', 1, 'Pending'],    // box checked but row Pending -> drift
      ['REQ-9', 2, 'Deferred'],   // deferred: listed, never counted broken
    ],
  });
  const r = run(['audit'], dir);
  assert.equal(r.ok, true);
  const byId = Object.fromEntries(r.requirements.map((q) => [q.id, q]));
  assert.equal(byId['REQ-1'].break, undefined);
  assert.equal(byId['REQ-1'].plan, 'phases/1/PLAN.md');
  assert.equal(byId['REQ-2'].break, 'not-verified');
  assert.equal(byId['REQ-3'].break, 'no-plan');
  assert.equal(byId['REQ-4'].break, 'no-phase');
  assert.equal(byId['REQ-5'].break, 'phase-missing');
  assert.equal(byId['REQ-6'].break, 'drift');
  assert.deepEqual(r.deferred, ['REQ-9']);
  assert.deepEqual(r.orphans.plan_ids, [{ file: 'phases/1/PLAN.md', ids: ['REQ-99'] }]);
  assert.deepEqual(r.counts, { total: 7, traced: 1, broken: 5, deferred: 1 });
});

test('audit: missing REQUIREMENTS or ROADMAP degrades with named reasons', () => {
  const noReqs = makeTree({ roadmap: [{ n: 1, name: 'Only' }] });
  assert.equal(run(['audit'], noReqs).reason, 'no-requirements');
  const noRoadmap = makeTree({ reqs: [['REQ-1', 1, 'Pending']] });
  assert.equal(run(['audit'], noRoadmap).reason, 'no-roadmap');
});

// --- renumber ------------------------------------------------------------------

function renumberTree() {
  return makeTree({
    roadmap: [{ n: 1, name: 'One' }, { n: 2, name: 'Two' }, { n: 3, name: 'Three' }],
    phases: { 1: { plan: true }, 2: { plan: true }, 3: { plan: true } },
    reqs: [['REQ-1', 1, 'Pending'], ['REQ-2', 2, 'Pending'], ['REQ-3', 3, 'Pending']],
    cursor: { phase: 2, total: 3, name: 'Two', status: 'planned', next: '/cad-execute 2', updated: '2026-01-01' },
  });
}

test('renumber insert --dry-run: full op plan, nothing touched', () => {
  const dir = renumberTree();
  const before = readFileSync(join(dir, 'ROADMAP.md'), 'utf8');
  const r = run(['renumber', 'insert', '--at', '2', '--dry-run'], dir);
  assert.equal(r.ok, true);
  assert.equal(r.dry_run, true);
  // dirs 3 then 2 move up, high-to-low (collision-safe)
  assert.deepEqual(r.ops[0], { git_mv: ['phases/3', 'phases/4'] });
  assert.deepEqual(r.ops[1], { git_mv: ['phases/2', 'phases/3'] });
  assert.match(r.slot, /Phase 2/);
  assert.equal(readFileSync(join(dir, 'ROADMAP.md'), 'utf8'), before);
  assert.ok(readdirSync(join(dir, 'phases')).includes('2'));
});

test('renumber insert: shifts dirs, tokens, traceability, and cursor', () => {
  const dir = renumberTree();
  const r = run(['renumber', 'insert', '--at', '2'], dir);
  assert.equal(r.ok, true);
  assert.deepEqual(readdirSync(join(dir, 'phases')).sort(), ['1', '3', '4']); // 2 is the open slot
  const roadmap = readFileSync(join(dir, 'ROADMAP.md'), 'utf8');
  assert.match(roadmap, /- \[ \] \*\*Phase 3: Two\*\*/);
  assert.match(roadmap, /- \[ \] \*\*Phase 4: Three\*\*/);
  assert.match(roadmap, /### Phase 4: Three/);
  assert.match(roadmap, /\*\*Depends on:\*\* Phase 3/); // Three's dependency followed the shift
  const reqs = readFileSync(join(dir, 'REQUIREMENTS.md'), 'utf8');
  assert.match(reqs, /REQ-2 \| Phase 3 \|/);
  assert.match(reqs, /REQ-1 \| Phase 1 \|/); // below the insertion point - untouched
  const cursor = run(['cursor', 'get'], dir);
  assert.equal(cursor.phase, 3); // was 2, shifted with its phase
  assert.equal(cursor.total, 4);
});

test('renumber remove: cuts line + detail, orphans reqs, shifts down, reports prose refs', () => {
  const dir = renumberTree();
  const r = run(['renumber', 'remove', '--n', '2'], dir);
  assert.equal(r.ok, true);
  assert.deepEqual(r.orphaned_reqs, ['REQ-2']);
  assert.deepEqual(readdirSync(join(dir, 'phases')).sort(), ['1', '2']); // 3 became 2
  const roadmap = readFileSync(join(dir, 'ROADMAP.md'), 'utf8');
  assert.doesNotMatch(roadmap, /Phase \d+: Two/); // list line and detail section gone
  assert.match(roadmap, /- \[ \] \*\*Phase 2: Three\*\*/);
  const reqs = readFileSync(join(dir, 'REQUIREMENTS.md'), 'utf8');
  assert.match(reqs, /REQ-2 \|  \|/);            // orphaned: phase cell blanked
  assert.match(reqs, /REQ-3 \| Phase 2 \|/);      // shifted down
  const cursor = run(['cursor', 'get'], dir);
  assert.equal(cursor.total, 2);
  assert.ok(r.warn && /removed phase 2/.test(r.warn)); // cursor pointed at the removed phase
});

test('renumber insert at total+1 appends: nothing shifts, only the slot opens', () => {
  const dir = renumberTree();
  const r = run(['renumber', 'insert', '--at', '4'], dir);
  assert.equal(r.ok, true);
  assert.equal(r.ops.some((o) => o.git_mv), false); // no dir ever moves
  assert.match(r.slot, /Phase 4/);
  assert.deepEqual(readdirSync(join(dir, 'phases')).sort(), ['1', '2', '3']);
  assert.match(readFileSync(join(dir, 'ROADMAP.md'), 'utf8'), /- \[ \] \*\*Phase 3: Three\*\*/);
  const cursor = run(['cursor', 'get'], dir);
  assert.equal(cursor.phase, 2); // below the insertion point - untouched
  assert.equal(cursor.total, 4); // but the denominator grew
});

test('renumber remove: dirs shift DOWN low-to-high (collision-safe order)', () => {
  const dir = renumberTree();
  const plan = run(['renumber', 'remove', '--n', '1', '--dry-run'], dir);
  assert.deepEqual(plan.ops[0], { git_mv: ['phases/2', 'phases/1'] }); // 2 first,
  assert.deepEqual(plan.ops[1], { git_mv: ['phases/3', 'phases/2'] }); // then 3
  assert.deepEqual(plan.ops[2], { rm: 'phases/1' });
  const r = run(['renumber', 'remove', '--n', '1'], dir);
  assert.equal(r.ok, true);
  assert.deepEqual(readdirSync(join(dir, 'phases')).sort(), ['1', '2']);
  // the surviving dirs really are the MOVED ones, not stale copies
  assert.match(readFileSync(join(dir, 'phases', '1', 'PLAN.md'), 'utf8'), /# Plan 2/);
  assert.match(readFileSync(join(dir, 'phases', '2', 'PLAN.md'), 'utf8'), /# Plan 3/);
});

test('renumber remove of the LAST phase cuts the final detail section cleanly', () => {
  const dir = renumberTree();
  const r = run(['renumber', 'remove', '--n', '3'], dir);
  assert.equal(r.ok, true);
  assert.equal(r.total, 2);
  const roadmap = readFileSync(join(dir, 'ROADMAP.md'), 'utf8');
  assert.doesNotMatch(roadmap, /Phase 3/);
  assert.doesNotMatch(roadmap, /Three/);
  assert.match(roadmap, /### Phase 2: Two/); // the preceding detail survives intact
  assert.deepEqual(readdirSync(join(dir, 'phases')).sort(), ['1', '2']);
});

test('renumber remove: a detail heading as the last line (no trailing newline) still cuts', () => {
  const dir = makeTree({});
  writeFileSync(join(dir, 'ROADMAP.md'),
    '# Roadmap\n\n## Phases\n\n- [ ] **Phase 1: One** - a\n- [ ] **Phase 2: Two** - b\n\n' +
    '## Phase Details\n\n### Phase 1: One\n**Goal:** g1\n\n### Phase 2: Two');
  const r = run(['renumber', 'remove', '--n', '2'], dir);
  assert.equal(r.ok, true);
  assert.equal(r.total, 1);
  const roadmap = readFileSync(join(dir, 'ROADMAP.md'), 'utf8');
  assert.doesNotMatch(roadmap, /Phase 2/);
  assert.match(roadmap, /### Phase 1: One/);
});

test('renumber: prose phase refs are reported, never rewritten; key absent when none', () => {
  // The structured-only fixture has no lowercase refs -> no in_text_refs key.
  const clean = run(['renumber', 'remove', '--n', '2', '--dry-run'], renumberTree());
  assert.equal(clean.in_text_refs, undefined);

  const dir = renumberTree();
  writeFileSync(join(dir, 'ROADMAP.md'),
    readFileSync(join(dir, 'ROADMAP.md'), 'utf8') + '\nSee phase 3 for the follow-up work.\n');
  const r = run(['renumber', 'remove', '--n', '2'], dir);
  assert.equal(r.ok, true);
  assert.equal(r.in_text_refs.length, 1);
  assert.equal(r.in_text_refs[0].file, 'ROADMAP.md');
  assert.match(r.in_text_refs[0].text, /phase 3/);
  // The prose line itself is untouched - repairing it needs judgment.
  assert.match(readFileSync(join(dir, 'ROADMAP.md'), 'utf8'), /See phase 3 for the follow-up/);
});

test('renumber: out-of-range and unknown phase refuse', () => {
  const dir = renumberTree();
  assert.equal(run(['renumber', 'insert', '--at', '9'], dir).reason, 'out-of-range');
  assert.equal(run(['renumber', 'remove', '--n', '9'], dir).reason, 'unknown-phase');
});

// --- plan-overlap: the parallel-safety gate ------------------------------------

/** A two-plan phase whose PLAN files declare the given file lists. */
function overlapTree(filesA, filesB, taskLineB) {
  const dir = makeTree({
    roadmap: [{ n: 1, name: 'One' }],
    phases: { 1: { plan: ['PLAN-1.md', 'PLAN-2.md'] } },
  });
  const pdir = join(dir, 'phases', '1');
  writeFileSync(join(pdir, 'PLAN-1.md'),
    `---\nphase: 1\nplan: 1\nrequirements: [REQ-1]\nfiles: [${filesA.join(', ')}]\n---\n# Plan 1\n`);
  writeFileSync(join(pdir, 'PLAN-2.md'),
    `---\nphase: 1\nplan: 2\nrequirements: [REQ-2]\nfiles: [${filesB.join(', ')}]\n---\n# Plan 2\n` +
    (taskLineB ? `\n### Task 1: t\n\n- **Files:** ${taskLineB}\n- **Action:** x\n- **Verify:** y\n` : ''));
  return dir;
}

test('plan-overlap: disjoint declared lists come back clean', () => {
  const r = run(['plan-overlap', '--phase', '1'],
    overlapTree(['src/a.rs', 'src/b.rs'], ['src/c.rs']));
  assert.equal(r.ok, true);
  assert.deepEqual(r.overlaps, []);
  assert.deepEqual(r.plans, [{ plan: 'PLAN-1.md', files: 2 }, { plan: 'PLAN-2.md', files: 1 }]);
  assert.equal(r.undeclared, undefined);
});

test('plan-overlap: a shared file is reported with both plan names', () => {
  const r = run(['plan-overlap', '--phase', '1'],
    overlapTree(['src/a.rs', 'src/shared.rs'], ['src/shared.rs', 'src/c.rs']));
  assert.equal(r.ok, true);
  assert.deepEqual(r.overlaps, [{ plans: ['PLAN-1.md', 'PLAN-2.md'], files: ['src/shared.rs'] }]);
});

test('plan-overlap: task **Files:** lines count even when frontmatter omits them', () => {
  // PLAN-2 frontmatter declares nothing, but its task line touches src/a.rs.
  const r = run(['plan-overlap', '--phase', '1'],
    overlapTree(['src/a.rs'], [], 'src/a.rs (edit), src/d.rs'));
  assert.equal(r.overlaps.length, 1);
  assert.deepEqual(r.overlaps[0].files, ['src/a.rs']);
});

test('plan-overlap: a plan with no declared files is flagged undeclared', () => {
  const r = run(['plan-overlap', '--phase', '1'], overlapTree(['src/a.rs'], []));
  assert.deepEqual(r.overlaps, []);
  assert.deepEqual(r.undeclared, ['PLAN-2.md']);
});

test('plan-overlap: single plan and missing phase degrade predictably', () => {
  const single = makeTree({ roadmap: [{ n: 1, name: 'One' }], phases: { 1: { plan: true } } });
  const r = run(['plan-overlap', '--phase', '1'], single);
  assert.equal(r.ok, true);
  assert.deepEqual(r.overlaps, []);
  assert.match(r.note, /fewer than two/);
  assert.equal(run(['plan-overlap', '--phase', '9'], single).reason, 'no-phase-dir');
  assert.equal(run(['plan-overlap'], single).reason, 'bad-args');
});

// --- decimal phases under renumber (the desync fix) ----------------------------

test('renumber: decimal phase tokens are never shifted, and are reported', () => {
  const dir = makeTree({
    roadmap: [{ n: 1, name: 'One' }, { n: 2, name: 'Two' }, { n: 3, name: 'Three' }],
    phases: { 1: { plan: true } },
  });
  // Add a decimal insertion between 2 and 3, with a token and a path ref.
  const roadmap = readFileSync(join(dir, 'ROADMAP.md'), 'utf8').replace(
    '- [ ] **Phase 3: Three**',
    '- [ ] **Phase 2.1: TwoPointOne** - see phases/2.1/ notes\n- [ ] **Phase 3: Three**');
  writeFileSync(join(dir, 'ROADMAP.md'), roadmap);

  const r = run(['renumber', 'insert', '--at', '2'], dir);
  assert.equal(r.ok, true);
  assert.deepEqual(r.decimal_phases, [2.1]); // surfaced for hand re-placement
  const after = readFileSync(join(dir, 'ROADMAP.md'), 'utf8');
  assert.match(after, /\*\*Phase 2\.1: TwoPointOne\*\*/); // token untouched...
  assert.match(after, /phases\/2\.1\//);                   // ...and path untouched
  assert.match(after, /\*\*Phase 4: Three\*\*/);           // integers shifted
});

test('renumber: refuses to operate ON a decimal phase', () => {
  const dir = makeTree({ roadmap: [{ n: 1, name: 'One' }, { n: 2, name: 'Two' }] });
  assert.equal(run(['renumber', 'remove', '--n', '1.5'], dir).reason, 'bad-args');
  assert.equal(run(['renumber', 'insert', '--at', '1.5'], dir).reason, 'bad-args');
});

test('phase-done: a decimal phase flips its own line, dot not a wildcard', () => {
  // Phase 291 must NOT be flipped by --n 2.1 (the unescaped-regex bug).
  const dir = makeTree({
    roadmap: [{ n: 2.1, name: 'Insert' }, { n: 291, name: 'Big' }],
  });
  const r = run(['phase-done', '--n', '2.1'], dir);
  assert.equal(r.ok, true);
  const after = readFileSync(join(dir, 'ROADMAP.md'), 'utf8');
  assert.match(after, /- \[x\] \*\*Phase 2\.1: Insert\*\*/);
  assert.match(after, /- \[ \] \*\*Phase 291: Big\*\*/); // untouched
});

// --- recall: BM25 over the .planning corpus ------------------------------------

// A dedicated runner: recall takes a positional query, and its backend read
// goes through the config layers, so the global layer must be pinned off a
// nonexistent path (D-10) or a developer's real ~/.claude/cadence/config.json
// would flip results locally while CI stayed green. Returns the parsed JSON
// AND the raw stdout (the determinism test byte-compares the raw string).
function recall(query, dir) {
  let raw;
  let code = 0;
  try {
    raw = execFileSync('node', [PLANNING, 'recall', query, '--dir', dir], {
      encoding: 'utf8',
      env: { ...process.env, CADENCE_GLOBAL_CONFIG: join(tmpdir(), 'cad-no-such-global.json') },
    });
  } catch (e) { raw = e.stdout; code = e.status; }
  return { json: JSON.parse(raw), raw, _exit: code };
}

test('recall: a matching SUMMARY deviation ranks first, with source and phase', () => {
  const dir = makeTree({
    roadmap: [{ n: 1, name: 'Recall' }, { n: 2, name: 'Later' }],
    phases: {
      1: { summaryBody: { deviations: ['tokenkiller saturation race fixed in the guard'] } },
      2: { summaryBody: { deviations: ['unrelated documentation wording tweak'] } },
    },
  });
  const r = recall('tokenkiller saturation', dir);
  assert.equal(r.json.ok, true);
  assert.equal(r._exit, 0);
  assert.ok(r.json.results.length >= 1);
  assert.equal(r.json.results[0].source, 'phases/1/SUMMARY.md');
  assert.equal(r.json.results[0].phase, 1);
  assert.match(r.json.results[0].snippet, /tokenkiller/);
});

test('recall: empty and absent corpus both return ok:true with no results', () => {
  // Absent .planning entirely.
  const gone = recall('anything', join(tmpdir(), 'cad-recall-nonexistent'));
  assert.equal(gone.json.ok, true);
  assert.deepEqual(gone.json.results, []);
  assert.equal(gone._exit, 0);
  // .planning exists (roadmap only) but no SUMMARY/CAPTURE/UAT/CONTEXT corpus.
  const empty = recall('anything', makeTree({ roadmap: [{ n: 1, name: 'One' }] }));
  assert.equal(empty.json.ok, true);
  assert.deepEqual(empty.json.results, []);
  assert.equal(empty._exit, 0);
});

test('recall: two runs on the same corpus are byte-identical', () => {
  const dir = makeTree({
    phases: {
      1: { summaryBody: { deviations: ['alpha beta gamma', 'delta epsilon'] },
        contextDecisions: ['use beta for the gamma path'] },
    },
    capture: [{ section: 'Todos', text: 'wire the beta recall path', phase: 1 },
      { section: 'Seeds', text: 'gamma indexing idea' }],
  });
  const a = recall('beta gamma', dir);
  const b = recall('beta gamma', dir);
  assert.equal(a.raw, b.raw);
  assert.ok(a.json.results.length >= 2);
});

test('recall: durable decisions resurface; phase-local ## Decisions do not', () => {
  const dir = makeTree({
    phases: {
      1: { durableDecisions: ['use foobar approach'], contextDecisions: ['phase-local baz detail'] },
    },
  });
  const durable = recall('foobar', dir);
  assert.ok(durable.json.results.some((r) => r.source === 'phases/1/CONTEXT.md'));
  const local = recall('baz', dir);
  assert.ok(!local.json.results.some((r) => r.source === 'phases/1/CONTEXT.md'));
});

test('recall: legacy CONTEXT.md with only ## Decisions (no durable heading) still resurfaces', () => {
  const dir = makeTree({
    phases: { 1: { contextDecisions: ['legacy qux decision'] } },
  });
  const r = recall('qux', dir);
  assert.ok(r.json.results.some((r) => r.source === 'phases/1/CONTEXT.md'));
});

test('recall: a present-but-empty ## Durable decisions does NOT fall back to ## Decisions', () => {
  // Constructed directly (not via makeTree's default Durable-first ordering):
  // `sectionBody` only returns the literal empty string "" - as opposed to a
  // truthy whitespace-only "\n" - when the heading is the LAST thing in the
  // file, so this is the shape that actually distinguishes a `durable ===
  // null` / `??` fallback from a naive `!durable` / `durable || ...` one; the
  // latter treats "" as falsy and wrongly falls through to `## Decisions`.
  const dir = makeTree({ roadmap: [{ n: 1, name: 'Only' }], phases: { 1: {} } });
  writeFileSync(join(dir, 'phases', '1', 'CONTEXT.md'),
    '# Phase 1 Context\n\n## Decisions\n\n- D-01 (area): phase-local baz detail\n\n' +
    '## Durable decisions\n');
  const r = recall('baz', dir);
  assert.ok(!r.json.results.some((r) => r.source === 'phases/1/CONTEXT.md'));
});

test('recall: two runs over a corpus with ## Durable decisions are byte-identical', () => {
  const dir = makeTree({
    phases: {
      1: { durableDecisions: ['alpha beta gamma durable'], contextDecisions: ['delta epsilon local'] },
    },
  });
  const a = recall('beta gamma', dir);
  const b = recall('beta gamma', dir);
  assert.equal(a.raw, b.raw);
  assert.ok(a.json.results.length >= 1);
});

test('recall: memory.backend none reports off with empty results, exit 0', () => {
  const dir = makeTree({
    phases: { 1: { summaryBody: { deviations: ['findable term here'] } } },
    config: { memory: { backend: 'none' } },
  });
  const r = recall('findable', dir);
  assert.equal(r.json.ok, true);
  assert.equal(r.json.backend, 'none');
  assert.deepEqual(r.json.results, []);
  assert.equal(r._exit, 0);
});
