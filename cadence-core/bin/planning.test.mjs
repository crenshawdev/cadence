// Zero-dep tests for planning.mjs. Run: node --test 'cadence-core/bin/*.test.mjs'
// The JSON shapes asserted here ARE the interface contract - there is no
// spec file beyond them. Only node: builtins, per the repo ethos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, symlinkSync, chmodSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyAcceptanceCriteria } from './lib/planning-files.mjs';

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

// The phase-list grammar reaches the seam here; its breadth is pinned at
// parser level in planning-files.test.mjs (each of these pays a node spawn).

test('status: a ## Phases section holding no phase token is a closed milestone, not a parse failure', () => {
  const dir = makeTree({});
  writeFileSync(join(dir, 'ROADMAP.md'), '# Roadmap\n\n## Phases\n\n(nothing)\n');
  const r = run(['status'], dir);
  assert.equal(r.ok, true);
  assert.equal(r.cycle, 'none');
  assert.equal(r.current, null);
  assert.equal(r.total, 0);
  assert.equal(r._exit, 0);
});

test('status: a non-canonical phase-shaped line is unparseable-roadmap with a per-line diagnostic', () => {
  const dir = makeTree({});
  writeFileSync(join(dir, 'ROADMAP.md'), '# Roadmap\n\n## Phases\n\n- Phase 1: Ship auth\n');
  const r = run(['status'], dir);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'unparseable-roadmap');
  assert.equal(r.issues[0].code, 'phase-bullet');
  assert.equal(r.issues[0].line, 5);
  assert.equal(r.detail, 'line 5: - Phase 1: Ship auth');
});

test('status: a wiped checkbox list whose ### Phase N: details survive is NOT a closed milestone', () => {
  const dir = makeTree({});
  writeFileSync(join(dir, 'ROADMAP.md'),
    '# Roadmap\n\n## Phases\n\n\n## Phase Details\n\n### Phase 1: Auth\n**Goal:** ship it\n');
  const r = run(['status'], dir);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'unparseable-roadmap');
  assert.equal(r.issues[0].code, 'phase-heading');
  assert.equal(r.issues[0].text, '### Phase 1: Auth');
});

test('status: no ## Phases section at all is still unparseable-roadmap', () => {
  const dir = makeTree({});
  writeFileSync(join(dir, 'ROADMAP.md'), '# Roadmap\n\n## Overview\n\nx\n');
  const r = run(['status'], dir);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'unparseable-roadmap');
  assert.equal(r.detail, 'no `## Phases` section in ROADMAP.md');
});

test('status: an interrupted close reports the closed state AND a phase-dir drift entry', () => {
  const dir = makeTree({ roadmap: [], phases: { 2: { plan: true } } });
  const r = run(['status'], dir);
  assert.equal(r.ok, true);
  assert.equal(r.cycle, 'none');
  assert.deepEqual(r.drift, [{
    kind: 'phase-dir', phase: 2,
    detail: 'phases/2/ survives the milestone close (1 plan files)',
  }]);
});

test('status: a tagged close that never ran cursor set reports cursor drift on the stale total, while still agreeing', () => {
  const dir = makeTree({
    roadmap: [],
    cursor: { phase: 5, total: 5, name: 'Old', status: 'phase complete', next: '/cad-milestone', updated: '2026-01-01' },
  });
  const r = run(['status'], dir);
  assert.equal(r.ok, true);
  assert.equal(r.cycle, 'none');
  assert.equal(r.cursor.agrees, true);
  assert.equal(r.drift.length, 1);
  assert.equal(r.drift[0].kind, 'cursor');
  assert.match(r.drift[0].detail, /cursor totals 5 phases; ROADMAP has none/);
});

test('status: a finished close (cursor of 0) reports no drift at all', () => {
  const dir = makeTree({
    roadmap: [],
    cursor: { phase: 1, total: 0, name: 'no active cycle', status: 'ready to plan', next: '/cad-phase add', updated: '2026-01-01' },
  });
  const r = run(['status'], dir);
  assert.equal(r.ok, true);
  assert.equal(r.cycle, 'none');
  assert.equal(r.cursor.agrees, true);
  assert.equal(r.drift, undefined);
});

// Against an empty phase list the cursor is the only surviving evidence, so
// the agreement mapping is what keeps drift detection alive (D-09).
const CLOSED_AGREEMENT = [
  { status: 'phase complete', agrees: true },
  { status: 'ready to plan', agrees: true },
  { status: 'paused', agrees: true },
  { status: 'planned', agrees: false },
  { status: 'executed', agrees: false },
  { status: 'context gathered', agrees: false },
];

for (const row of CLOSED_AGREEMENT) {
  test(`status: closed milestone, cursor "${row.status}" agrees=${row.agrees}`, () => {
    const dir = makeTree({
      roadmap: [],
      cursor: { phase: 1, total: 0, name: 'no active cycle', status: row.status, next: '/cad-phase add', updated: '2026-01-01' },
    });
    const r = run(['status'], dir);
    assert.equal(r.ok, true);
    assert.equal(r.cycle, 'none');
    assert.equal(r.cursor.agrees, row.agrees);
    if (row.agrees) {
      assert.equal(r.drift, undefined);
    } else {
      assert.equal(r.drift[0].kind, 'cursor');
      assert.match(r.drift[0].detail, /derived closed milestone \(no phases in ROADMAP\)/);
    }
  });
}

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

// --- cursor set: the closed-milestone derivation (D-10) ---------------------

test('cursor set: derives `of 0 (no active cycle)` from a pruned roadmap, with no --name/--total', () => {
  const dir = makeTree({ roadmap: [] });
  const r = run(['cursor', 'set', '--phase', '1', '--status', 'ready to plan',
    '--next', '/cad-phase add'], dir);
  assert.equal(r.ok, true);
  assert.equal(r.cursor.total, 0);
  assert.equal(r.cursor.name, 'no active cycle');
  const text = readFileSync(join(dir, 'STATE.md'), 'utf8');
  assert.match(text, /^Phase: 1 of 0 \(no active cycle\)$/m);
});

test('cursor set: the closed cursor it writes round-trips through cursor get, never unparseable-cursor', () => {
  const dir = makeTree({ roadmap: [] });
  assert.equal(run(['cursor', 'set', '--phase', '1', '--status', 'ready to plan',
    '--next', '/cad-phase add'], dir).ok, true);
  const g = run(['cursor', 'get'], dir);
  assert.equal(g.ok, true);
  assert.equal(g.total, 0);
  assert.equal(g.name, 'no active cycle');
  assert.equal(g.phase, 1);
});

test('cursor set: the closed arm beats the prior cursor, so a stale total is not inherited', () => {
  const dir = makeTree({
    roadmap: [],
    cursor: { phase: 5, total: 5, name: 'Old', status: 'phase complete', next: '/cad-milestone', updated: '2026-01-01' },
  });
  const r = run(['cursor', 'set', '--phase', '1', '--status', 'ready to plan',
    '--next', '/cad-phase add'], dir);
  assert.equal(r.ok, true);
  assert.equal(r.cursor.total, 0);
  assert.equal(r.cursor.name, 'no active cycle');
});

test('cursor set: --status paused preserves a non-zero prior total, so a pause cannot erase the interrupted-close evidence', () => {
  const dir = makeTree({
    roadmap: [],
    cursor: { phase: 3, total: 5, name: 'Billing', status: 'executed', next: '/cad-verify 3', updated: '2026-01-01' },
  });
  const r = run(['cursor', 'set', '--phase', '3', '--status', 'paused',
    '--next', 'mid-close, resume at /cad-milestone'], dir);
  assert.equal(r.ok, true);
  assert.equal(r.cursor.total, 5);
  assert.equal(r.cursor.name, 'Billing');
  // The stale `of 5` is what cmdStatus reads as the only surviving evidence.
  const s = run(['status'], dir);
  assert.equal(s.cycle, 'none');
  assert.ok(s.drift.some((d) => d.kind === 'cursor' && /did not finish/.test(d.detail)),
    'the stale-total cursor drift survives the pause');
});

test('cursor set: paused preserves nothing when the prior cursor names a different phase', () => {
  const dir = makeTree({
    roadmap: [],
    cursor: { phase: 5, total: 5, name: 'Old', status: 'executed', next: '/cad-verify 5', updated: '2026-01-01' },
  });
  const r = run(['cursor', 'set', '--phase', '1', '--status', 'paused', '--next', 'x'], dir);
  assert.equal(r.ok, true);
  assert.equal(r.cursor.total, 0);
  assert.equal(r.cursor.name, 'no active cycle');
});

test('cursor set: every non-paused status still derives of 0 against a stale prior cursor', () => {
  for (const status of ['ready to plan', 'phase complete', 'planned', 'executed']) {
    const dir = makeTree({
      roadmap: [],
      cursor: { phase: 2, total: 5, name: 'Billing', status: 'executed', next: 'x', updated: '2026-01-01' },
    });
    const r = run(['cursor', 'set', '--phase', '2', '--status', status, '--next', 'x'], dir);
    assert.equal(r.ok, true, status);
    assert.equal(r.cursor.total, 0, status);
    assert.equal(r.cursor.name, 'no active cycle', status);
  }
});

test('cursor set: an out-of-grammar roadmap is broken, not closed - still cannot-derive', () => {
  const dir = makeTree({});
  writeFileSync(join(dir, 'ROADMAP.md'), '# Roadmap\n\n## Phases\n\n- Phase 1: Ship auth\n');
  const r = run(['cursor', 'set', '--phase', '1', '--status', 'ready to plan',
    '--next', '/cad-phase add'], dir);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'cannot-derive');
  assert.equal(readdirSync(dir).includes('STATE.md'), false); // nothing written
});

test('cursor set: rejects a status outside the lifecycle', () => {
  const dir = makeTree({ roadmap: [{ n: 1, name: 'Only' }] });
  const r = run(['cursor', 'set', '--phase', '1', '--status', 'doing stuff', '--next', 'x'], dir);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'bad-status');
  assert.equal(readdirSync(dir).includes('STATE.md'), false); // nothing written
});

test('cursor set: a non-integer --total is bad-args and writes nothing (#42)', () => {
  const dir = makeTree({ roadmap: [{ n: 1, name: 'Foundation' }] });
  const before = readdirSync(dir).includes('STATE.md');
  const r = run(['cursor', 'set', '--phase', '1', '--status', 'planned',
    '--next', '/cad-execute 1', '--name', 'Foo', '--total', 'abc'], dir);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'bad-args');
  assert.equal(JSON.stringify(r).includes('NaN'), false);
  assert.equal(readdirSync(dir).includes('STATE.md'), before); // unchanged (still absent)

  const ok = run(['cursor', 'set', '--phase', '1', '--status', 'planned',
    '--next', '/cad-execute 1', '--name', 'Foo', '--total', '4'], dir);
  assert.equal(ok.ok, true);
  assert.equal(ok.cursor.total, 4);
});

// The integer guard is not the file contract: parseCursor reads unsigned
// decimals only, so these all used to write a STATE.md the next `cursor get`
// rejected as unparseable-cursor.
for (const [flag, value] of [
  ['--total', '-2'], ['--total', '1e21'], ['--total', '1.5'],
  ['--phase', '-1'], ['--phase', '1e21'],
]) {
  test(`cursor set: ${flag} ${value} is bad-args and leaves a readable cursor`, () => {
    const dir = makeTree({ roadmap: [{ n: 1, name: 'Foundation' }] });
    const seed = run(['cursor', 'set', '--phase', '1', '--status', 'planned',
      '--next', '/cad-execute 1', '--name', 'Foo', '--total', '4'], dir);
    assert.equal(seed.ok, true);
    const before = readFileSync(join(dir, 'STATE.md'), 'utf8');

    const args = ['cursor', 'set', '--phase', '1', '--status', 'planned',
      '--next', '/cad-execute 1', '--name', 'Foo', '--total', '4'];
    args[args.indexOf(flag) + 1] = value;
    const r = run(args, dir);
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'bad-args');
    assert.equal(readFileSync(join(dir, 'STATE.md'), 'utf8'), before);
    // The real regression: the cursor stays readable by its own parser.
    assert.equal(run(['cursor', 'get'], dir).ok, true);
  });
}

test('cursor set: a decimal phase insertion (2.1) is still accepted', () => {
  const dir = makeTree({ roadmap: [{ n: 1, name: 'Foundation' }] });
  const r = run(['cursor', 'set', '--phase', '2.1', '--status', 'planned',
    '--next', '/cad-execute 2.1', '--name', 'Insert', '--total', '4'], dir);
  assert.equal(r.ok, true);
  assert.equal(r.cursor.phase, 2.1);
  assert.equal(run(['cursor', 'get'], dir).phase, 2.1);
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

test('phase-done: valueless --reqs is bad-args, not internal (#45.1)', () => {
  const dir = makeTree({
    roadmap: [{ n: 1, name: 'Only' }],
    reqs: [['REQ-1', 1, 'Pending']],
  });
  const roadmapBefore = readFileSync(join(dir, 'ROADMAP.md'), 'utf8');
  const reqsBefore = readFileSync(join(dir, 'REQUIREMENTS.md'), 'utf8');
  const r = run(['phase-done', '--n', '1', '--reqs'], dir);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'bad-args');
  assert.notEqual(r.reason, 'internal');
  assert.equal(readFileSync(join(dir, 'ROADMAP.md'), 'utf8'), roadmapBefore);
  assert.equal(readFileSync(join(dir, 'REQUIREMENTS.md'), 'utf8'), reqsBefore);
});

// `--reqs "$IDS"` with IDS unset used to pass the shape guard and then fall
// through the truthiness test to the bulk phase-filter branch, flipping every
// non-Deferred row it was never told to touch.
for (const empty of ['', '   ', ',', ',,']) {
  test(`phase-done: --reqs "${empty}" refuses instead of flipping the phase`, () => {
    const dir = makeTree({
      roadmap: [{ n: 1, name: 'Only' }],
      reqs: [['REQ-1', 1, 'Pending'], ['REQ-2', 1, 'Pending']],
    });
    const roadmapBefore = readFileSync(join(dir, 'ROADMAP.md'), 'utf8');
    const reqsBefore = readFileSync(join(dir, 'REQUIREMENTS.md'), 'utf8');
    const r = run(['phase-done', '--n', '1', '--reqs', empty], dir);
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'bad-args');
    assert.equal(readFileSync(join(dir, 'ROADMAP.md'), 'utf8'), roadmapBefore);
    assert.equal(readFileSync(join(dir, 'REQUIREMENTS.md'), 'utf8'), reqsBefore);
  });
}

test('phase-done: --reqs names exactly the rows it flips; omitting it closes the phase', () => {
  const dir = makeTree({
    roadmap: [{ n: 1, name: 'Only' }],
    reqs: [['REQ-1', 1, 'Pending'], ['REQ-2', 1, 'Pending'], ['REQ-3', 1, 'Deferred']],
  });
  const named = run(['phase-done', '--n', '1', '--reqs', 'REQ-1'], dir);
  assert.equal(named.ok, true);
  assert.deepEqual(named.reqs, ['REQ-1']);

  const all = run(['phase-done', '--n', '1'], dir);
  assert.equal(all.ok, true);
  assert.deepEqual(all.reqs, ['REQ-1', 'REQ-2']); // Deferred still exempt
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
  assert.equal(r.skipped, 1); // the `Logout works` pass conflicts with a user result
  assert.equal(r.rejected, 0);
  const text = readFileSync(join(dir, 'phases', '1', 'UAT.md'), 'utf8');
  assert.match(text, /### 3\. Rate limiting/);
  assert.match(text, /### 4\. Email renders in dark mode/);
  assert.doesNotMatch(text, /would overwrite/);
});

// --- uat: the criterion / origin carrier (registration is what makes it last)
// Registration in UAT_FIELDS is the whole mechanism: parseUat accepts any
// `field: value` line, so an UNregistered field survives init and is destroyed
// by the first record, which rewrites the whole file. Every assertion here
// reads the raw bytes rather than the envelope for that reason.

const LINKED_ITEMS = JSON.stringify([
  { name: 'Login works', expected: 'user lands on dashboard', criterion: 'AC3' },
  { name: 'Logout works', expected: 'session cleared', criterion: 'AC4' },
  { name: 'The plugin loads at all', expected: 'no error on startup', origin: 'smoke' },
]);

/** The raw bytes of a fixture's UAT.md - never the envelope. */
const uatText = (dir) => readFileSync(join(dir, 'phases', '1', 'UAT.md'), 'utf8');

function linkedTree() {
  const dir = makeTree({ roadmap: [{ n: 1, name: 'Only' }], phases: { 1: { plan: true } } });
  run(['uat', 'init', '--phase', '1'], dir, LINKED_ITEMS);
  return dir;
}

test('uat: a criterion written by init is byte-present after a refresh AND after a record', () => {
  const dir = linkedTree();
  assert.match(uatText(dir), /### 1\. Login works\nexpected: user lands on dashboard\ncriterion: AC3\nstatus: pending/);
  // The refresh payload carries a NEW item name, so the file is actually
  // rewritten (`if (fresh.length) writeUat`) - re-sending the identical payload
  // would leave it untouched and prove nothing about the refresh arm.
  const r = run(['uat', 'refresh', '--phase', '1'], dir, JSON.stringify([
    { name: 'Password reset', expected: 'email arrives', criterion: 'AC5' },
  ]));
  assert.equal(r.added, 1);
  assert.equal(uatText(dir).match(/^criterion: AC3$/gm).length, 1);
  assert.match(uatText(dir), /### 4\. Password reset\nexpected: email arrives\ncriterion: AC5\nstatus: pending/);
  run(['uat', 'record', '--phase', '1', '--item', '1', '--result', 'pass'], dir);
  assert.equal(uatText(dir).match(/^criterion: AC3$/gm).length, 1);
  assert.equal(uatText(dir).match(/^criterion: AC5$/gm).length, 1);
});

// The marker is written before any item is looked at, so it cannot be lost by
// a payload that carries no links - which is the whole point of moving the
// legacy test off the item fields and onto the file.
test('uat init: writes fields_version unconditionally, and it survives refresh and record', () => {
  const dir = linkedTree();
  assert.match(uatText(dir), /^---\nstatus: testing\nphase: 1\nfields_version: 1\n/);
  run(['uat', 'refresh', '--phase', '1'], dir, JSON.stringify([
    { name: 'Password reset', expected: 'email arrives', criterion: 'AC5' },
  ]));
  assert.equal(uatText(dir).match(/^fields_version: 1$/gm).length, 1);
  run(['uat', 'record', '--phase', '1', '--item', '1', '--result', 'pass'], dir);
  assert.equal(uatText(dir).match(/^fields_version: 1$/gm).length, 1);
});

test('uat init: a payload with no criterion and no origin still gets the marker', () => {
  const dir = makeTree({ roadmap: [{ n: 1, name: 'Only' }], phases: { 1: { plan: true } } });
  run(['uat', 'init', '--phase', '1'], dir, JSON.stringify([
    { name: 'Bare item', expected: 'something observable' },
  ]));
  assert.match(uatText(dir), /^fields_version: 1$/m);
});

test('uat: an origin written by init survives refresh and record the same way', () => {
  const dir = linkedTree();
  assert.match(uatText(dir), /### 3\. The plugin loads at all\nexpected: [^\n]*\norigin: smoke\nstatus: pending/);
  run(['uat', 'refresh', '--phase', '1'], dir, JSON.stringify([
    { name: 'A deliverable', expected: 'ships', origin: 'verifier' },
  ]));
  run(['uat', 'record', '--phase', '1', '--item', '3', '--result', 'pass'], dir);
  assert.equal(uatText(dir).match(/^origin: smoke$/gm).length, 1);
  assert.equal(uatText(dir).match(/^origin: verifier$/gm).length, 1);
});

test('uat refresh: carries source, criterion and origin onto an appended item, in lockstep with init', () => {
  const dir = linkedTree();
  run(['uat', 'refresh', '--phase', '1'], dir, JSON.stringify([
    { name: 'Deep-pass find', expected: 'observable', criterion: 'AC6', origin: 'criterion', source: 'verifier' },
  ]));
  assert.match(uatText(dir),
    /### 4\. Deep-pass find\nexpected: observable\ncriterion: AC6\norigin: criterion\nstatus: pending\nsource: verifier/);
});

test('uat record --origin: sets provenance after the fact on an existing item', () => {
  const dir = uatTree(); // no field on either item
  const r = run(['uat', 'record', '--phase', '1', '--item', '2', '--result', 'pass',
    '--origin', 'verifier'], dir);
  assert.equal(r.ok, true);
  assert.match(uatText(dir), /### 2\. Logout works\nexpected: session cleared\norigin: verifier\nstatus: pass/);
});

test('uat record: an out-of-enum --origin is refused with the file byte-unchanged', () => {
  const dir = linkedTree();
  const before = uatText(dir);
  const r = run(['uat', 'record', '--phase', '1', '--item', '1', '--result', 'pass',
    '--origin', 'verifer'], dir);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'bad-args');
  assert.match(r.detail, /criterion \| verifier \| smoke/);
  assert.equal(uatText(dir), before);
});

test('uat init: an out-of-shape criterion or origin is bad-payload, nothing written', () => {
  const dir = makeTree({ roadmap: [{ n: 1, name: 'Only' }], phases: { 1: { plan: true } } });
  const badId = run(['uat', 'init', '--phase', '1'], dir,
    JSON.stringify([{ name: 'X', expected: 'y', criterion: 'AC-01' }]));
  assert.equal(badId.reason, 'bad-payload');
  assert.match(badId.detail, /AC<N>/);
  assert.equal(existsSync(join(dir, 'phases', '1', 'UAT.md')), false);
  const badOrigin = run(['uat', 'init', '--phase', '1'], dir,
    JSON.stringify([{ name: 'X', expected: 'y', origin: 'verified' }]));
  assert.equal(badOrigin.reason, 'bad-payload');
  assert.match(badOrigin.detail, /criterion \| verifier \| smoke/);
  assert.equal(existsSync(join(dir, 'phases', '1', 'UAT.md')), false);
});

test('uat merge: both append paths write origin verifier - the item-level provenance source cannot carry', () => {
  const dir = uatTree();
  const r = run(['uat', 'merge', '--phase', '1'], dir, JSON.stringify({
    gaps: [{ name: 'Rate limiting', reason: 'no limiter found on /login' }],
    human_checks: [{ name: 'Email renders in dark mode', expected: 'readable' }],
  }));
  assert.equal(r.added, 2);
  // The gap append.
  assert.match(uatText(dir), /### 3\. Rate limiting\nexpected: [^\n]*\norigin: verifier\nstatus: fail/);
  // The human_checks append, which wrote no provenance of any kind before.
  assert.match(uatText(dir), /### 4\. Email renders in dark mode\nexpected: readable\norigin: verifier\nstatus: pending/);
});

test('uat merge: a MATCHED pending item gets source verifier and no origin - it was not verifier-added', () => {
  const dir = linkedTree();
  run(['uat', 'merge', '--phase', '1'], dir, JSON.stringify({
    passes: [{ name: 'Login works', evidence: 'src/auth.ts:42' }],
  }));
  // Item 1 keeps its criterion and gains no origin: source records where the
  // RESULT came from, origin where the ITEM came from (D-12).
  assert.match(uatText(dir), /### 1\. Login works\nexpected: [^\n]*\ncriterion: AC3\nstatus: pass\nfirst_pass: pass\nsource: verifier/);
  assert.equal(uatText(dir).match(/^origin: verifier$/gm), null);
});

test('uat merge: an entry with no usable name is rejected, never written (#46.2)', () => {
  const dir = uatTree();
  const r = run(['uat', 'merge', '--phase', '1'], dir, JSON.stringify({
    gaps: [
      { reason: 'no k, no name' },              // nothing to name a heading with
      { k: 99, reason: 'k matches nothing' },   // a k that resolves to no item
      { name: 'Rate limiting', reason: 'no limiter' }, // the one valid entry
    ],
    human_checks: [{ expected: 'nameless' }],   // appends the identical phantom
  }));
  assert.equal(r.ok, true);          // partial success: merge the rest (D-03)
  assert.equal(r.added, 1);
  assert.equal(r.rejected, 3);
  assert.equal(r.gaps, 1);           // gaps counts what was actually recorded
  const text = readFileSync(join(dir, 'phases', '1', 'UAT.md'), 'utf8');
  assert.match(text, /### 3\. Rate limiting/);
  assert.doesNotMatch(text, /undefined/); // `### N. undefined` can never be written
});

test('uat merge: an untrimmed name fills the pending item, never appends a duplicate', () => {
  const dir = uatTree();
  // A trailing space is routine in verifier output. The append path trims, so
  // matching untrimmed appended `### 3. Login works` alongside the existing
  // `### 1. Login works` - unreachable by name on every later merge, so its
  // fail status blocked uatComplete permanently.
  const r = run(['uat', 'merge', '--phase', '1'], dir, JSON.stringify({
    gaps: [{ name: 'Login works ', reason: 'no redirect' }],
    human_checks: [{ name: '  Logout works', expected: 'session cleared' }],
  }));
  assert.equal(r.ok, true);
  assert.equal(r.gaps, 1);
  assert.equal(r.added, 0);    // both matched an existing item; nothing appended
  assert.equal(r.rejected, 0);
  const text = readFileSync(join(dir, 'phases', '1', 'UAT.md'), 'utf8');
  assert.equal(text.match(/^### \d+\. Login works$/gm)?.length, 1);
  assert.equal(text.match(/^### \d+\. Logout works$/gm)?.length, 1);
});

test('uat merge: a finding conflicting with a recorded result is skipped and counted (#46.3)', () => {
  const dir = uatTree();
  run(['uat', 'record', '--phase', '1', '--item', '1', '--result', 'pass'], dir); // user result
  const r = run(['uat', 'merge', '--phase', '1'], dir, JSON.stringify({
    passes: [{ k: 1, evidence: 'x' }],
    gaps: [{ k: 1, reason: 'y' }],
  }));
  assert.equal(r.ok, true);
  assert.equal(r.skipped, 2);     // the drop stops being silent
  assert.equal(r.auto_passed, 0); // the invariant still stands
  assert.equal(r.gaps, 0);
  const text = readFileSync(join(dir, 'phases', '1', 'UAT.md'), 'utf8');
  assert.match(text, /### 1\. Login works\nexpected: [^\n]*\nstatus: pass/);
  assert.doesNotMatch(text, /reported:/);
});

test('uat merge: a newline in verifier text cannot inject a status line (#35)', () => {
  const dir = uatTree();
  const r = run(['uat', 'merge', '--phase', '1'], dir, JSON.stringify({
    gaps: [
      { k: 1, reason: 'broken', evidence: 'saw error\nstatus: pass' },
      { name: 'New gap\nstatus: pass', reason: 'multi-line name' },
    ],
  }));
  assert.equal(r.ok, true);
  const text = readFileSync(join(dir, 'phases', '1', 'UAT.md'), 'utf8');
  // the verdict survives the round-trip: item 1 is fail, evidence flattened inert
  assert.match(text, /### 1\. Login works\nexpected: [^\n]*\nstatus: fail\n/);
  assert.match(text, /evidence: saw error status: pass/);
  // the appended gap's name is one heading line, not a heading + stray field
  assert.match(text, /### 3\. New gap status: pass\n/);
  // reparse agrees: item 1 still counts as failed
  const rec = run(['uat', 'record', '--phase', '1', '--item', '2', '--result', 'pass'], dir);
  assert.equal(rec.counts.fail, 2); // item 1 + the appended gap
});

test('uat: a hand-added ### section mints no item and survives rewrites (#46.1)', () => {
  const dir = uatTree();
  const file = join(dir, 'phases', '1', 'UAT.md');
  const notes = '### Manual notes\n\n1. check the logs';
  writeFileSync(file, readFileSync(file, 'utf8').replace('## Summary', `${notes}\n\n## Summary`));

  // The numbered line inside a NON-item chunk used to mint a phantom item (a
  // second k:1, statusless) that the next write then materialized. Asserting
  // on item COUNT, not `uat status` counts: a phantom carries no `status:`,
  // so `counts` is byte-identical pre- and post-fix and cannot witness this.
  const r = run(['uat', 'refresh', '--phase', '1'], dir, '[]');
  assert.equal(r.ok, true);
  assert.equal(r.total, 2); // pre-fix 3

  run(['uat', 'record', '--phase', '1', '--item', '2', '--result', 'pass'], dir);
  const text = readFileSync(file, 'utf8');
  // Occurs-once, not a bare includes: a per-cycle re-emission bug duplicates
  // the section while still satisfying `includes`.
  assert.equal(text.split(notes).length - 1, 1);
  assert.equal(text.split('### 1. ').length - 1, 1);       // no duplicate k
  assert.doesNotMatch(text, /^### \d+\. check the logs/m); // never materialized
  assert.match(text, /total: 2/);

  // Round-trip idempotence: a second cycle neither drops nor duplicates it.
  run(['uat', 'record', '--phase', '1', '--item', '1', '--result', 'pass'], dir);
  assert.equal(readFileSync(file, 'utf8').split(notes).length - 1, 1);
});

test('uat: a `## ` inside a fenced block does not truncate a preserved section', () => {
  const dir = uatTree();
  const file = join(dir, 'phases', '1', 'UAT.md');
  // A `## ` line inside a code block used to bound the section, so the closing
  // fence and the trailing prose were destroyed. The odd fence count left the
  // regenerated `## Summary` rendering as code.
  const notes = ['### Repro notes', '', 'Steps to reproduce:', '', '```sh',
    'make build', '## build output', 'make test', '```', '',
    'Still fails on the third run.'].join('\n');
  writeFileSync(file, readFileSync(file, 'utf8').replace('## Summary', `${notes}\n\n## Summary`));

  run(['uat', 'record', '--phase', '1', '--item', '1', '--result', 'pass'], dir);
  const text = readFileSync(file, 'utf8');
  assert.equal(text.split(notes).length - 1, 1);            // verbatim, once
  assert.equal((text.match(/^```/gm) || []).length % 2, 0);  // fences still balanced
  assert.match(text, /^## Summary$/m);                       // and not inside one

  // The fenced `## build output` is content, so it must never bound the item
  // block either: fields after it still parse.
  assert.match(text, /^total: 2$/m);
  // Round-trip idempotence, same as the plain-section case.
  run(['uat', 'record', '--phase', '1', '--item', '2', '--result', 'pass'], dir);
  assert.equal(readFileSync(file, 'utf8').split(notes).length - 1, 1);
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

// The fixture builder hardcodes `|---|---|---|`, so both of these write
// REQUIREMENTS.md raw after makeTree - the shapes the builder cannot express.
const auditSpec = () => ({
  roadmap: [{ n: 1, name: 'Done', checked: true }],
  phases: { 1: { plan: true, planReqs: ['REQ-1'] } },
  reqs: [['REQ-1', 1, 'Complete']],
});

test('audit: a colon-aligned separator row is not a requirement (#41.1)', () => {
  const plain = makeTree(auditSpec());
  const aligned = makeTree(auditSpec());
  // GFM alignment cells (`:---`, `:--:`, `---:`) are a legal spelling of the
  // same delimiter row - the parse must be byte-equivalent to the plain form.
  writeFileSync(join(aligned, 'REQUIREMENTS.md'),
    readFileSync(join(aligned, 'REQUIREMENTS.md'), 'utf8')
      .replace('|---|---|---|', '|:---|:--:|---:|'));
  const a = run(['audit'], plain);
  const b = run(['audit'], aligned);
  assert.equal(b.ok, true);
  assert.deepEqual(b.counts, a.counts);
  // The phantom the alignment cells used to mint: an id made of dashes/colons.
  assert.equal(b.requirements.some((q) => /^[-:\s]+$/.test(q.id)), false);
});

test('audit: rows under a ## section AFTER Traceability are not requirements (#41.2)', () => {
  const bare = makeTree(auditSpec());
  const appended = makeTree(auditSpec());
  writeFileSync(join(appended, 'REQUIREMENTS.md'),
    `${readFileSync(join(appended, 'REQUIREMENTS.md'), 'utf8')}\n## Appendix\n\n` +
    '| Requirement | Phase | Status |\n|---|---|---|\n| GHOST-1 | Phase 1 | Complete |\n');
  const a = run(['audit'], bare);
  const r = run(['audit'], appended);
  assert.equal(r.ok, true);
  assert.equal(r.requirements.some((q) => q.id === 'GHOST-1'), false);
  assert.equal(r.counts.total, a.counts.total);
});

// A one-phase tree whose PLAN.md frontmatter is written raw, plus REQUIREMENTS
// rows for #41/#46. `frontmatter` is spliced between the --- fences.
function blockPlanTree(frontmatter, body = '') {
  const dir = makeTree({
    roadmap: [{ n: 1, name: 'One' }],
    phases: { 1: { plan: true } },
    reqs: [['#41', 1, 'Pending'], ['#46', 1, 'Pending']],
  });
  writeFileSync(join(dir, 'phases', '1', 'PLAN.md'),
    `---\nphase: 1\nplan: 1\n${frontmatter}\n---\n\n# Plan 1\n${body}`);
  return dir;
}

// Like blockPlanTree, but seeds a SINGLE requirement (#41) - Task 5's
// per-code payload table test needs every fixture and its twin to declare
// the SAME id count, or a delta in counts.broken measures the fixture's id
// count rather than the code's payload behavior. #41 is Complete against a
// CHECKED phase box, so a fixture that maps it cleanly is fully traced
// (counts.broken: 0) and a fixture that drops the mapping is `no-plan`
// (counts.broken: 1) - a Pending row against an unchecked box would be
// `not-verified` (also broken:1) whether or not the id was ever dropped,
// which would make every fixture indistinguishable from the twin.
function oneIdPlanTree(frontmatter, body = '') {
  const dir = makeTree({
    roadmap: [{ n: 1, name: 'One', checked: true }],
    phases: { 1: { plan: true } },
    reqs: [['#41', 1, 'Complete']],
  });
  writeFileSync(join(dir, 'phases', '1', 'PLAN.md'),
    `---\nphase: 1\nplan: 1\n${frontmatter}\n---\n\n# Plan 1\n${body}`);
  return dir;
}

test('audit: a block-YAML requirements list reads as ids, not zero (#48.1)', () => {
  // Under D-01 an unquoted `#41` is a comment, not an id - the block items
  // must be quoted to read as the ids `#41`/`#46`.
  const dir = blockPlanTree(
    'requirements:\n  - "#41"\n  - "#46"  # with a comment\nfiles: []',
    // A prose `requirements:` line OUTSIDE the fence must contribute nothing -
    // an unbounded key scan would swallow the bullets below it as ids.
    '\nrequirements: these prose ids:\n\n- NOT-AN-ID\n');
  const r = run(['audit'], dir);
  assert.equal(r.ok, true);
  const byId = Object.fromEntries(r.requirements.map((q) => [q.id, q]));
  assert.equal(byId['#41'].plan, 'phases/1/PLAN.md');
  assert.equal(byId['#46'].plan, 'phases/1/PLAN.md');
  // `not-verified` is the expected state for a Pending row on an open phase;
  // `no-plan` is what the block form used to produce by reading as zero.
  assert.notEqual(byId['#41'].break, 'no-plan');
  assert.notEqual(byId['#46'].break, 'no-plan');
  assert.equal(r.orphans, undefined); // the body list contributed no ids
});

test('audit: the inline requirements form with a bracketed trailing comment still reads exactly two ids', () => {
  // The comment itself contains brackets - the greedy `\[(.*)\]` defect three
  // reviewers found would pull "see [D-06]" into the payload as bogus entries.
  const dir = blockPlanTree('requirements: ["#41", "#46"]  # ids, see [D-06]\nfiles: []');
  const r = run(['audit'], dir);
  assert.equal(r.ok, true);
  assert.deepEqual(r.requirements.map((q) => q.id).sort(), ['#41', '#46']);
  const byId = Object.fromEntries(r.requirements.map((q) => [q.id, q]));
  assert.equal(byId['#41'].plan, 'phases/1/PLAN.md');
  assert.equal(byId['#46'].plan, 'phases/1/PLAN.md');
  assert.equal(r.orphans, undefined);
});

test('audit: a comment-only requirements: value falls through to a block list surviving a heading comment, a splitting comment, and a blank line', () => {
  // `^key:\s*(.*)$` eats the whitespace before the `#`, so the whitespace-preceded
  // comment strip can never fire on a remainder that is ITSELF a comment. Read as
  // a scalar (the pre-fix behaviour) this returns the comment text as a fabricated
  // id AND discards both real ids beneath it. D-04: the block SKIPS blank and
  // comment-only lines rather than stopping at the first one.
  const dir = blockPlanTree(
    'requirements:   # ids\n  # covers auth\n  - "#41"\n  # a splitting comment\n\n  - "#46"\nfiles: []');
  const r = run(['audit'], dir);
  assert.equal(r.ok, true);
  const byId = Object.fromEntries(r.requirements.map((q) => [q.id, q]));
  assert.equal(byId['#41'].plan, 'phases/1/PLAN.md');
  assert.equal(byId['#46'].plan, 'phases/1/PLAN.md');
  assert.notEqual(byId['#41'].break, 'no-plan');
  assert.notEqual(byId['#46'].break, 'no-plan');
  assert.equal(r.orphans, undefined); // the comment text minted no id
});

test('audit: a no-space `#TODO` comment on the key line still falls through to the block list', () => {
  // D-01 INVERTS the old bare-`#41`-is-an-id rule: an unquoted `#` always
  // starts a comment, with no `# ` vs `#x` discrimination, so `#TODO` (no
  // space) is a comment exactly like `# TODO` would be.
  const dir = blockPlanTree('requirements: #TODO fill this in\n  - "#41"\n  - "#46"\nfiles: []');
  const r = run(['audit'], dir);
  assert.equal(r.ok, true);
  const byId = Object.fromEntries(r.requirements.map((q) => [q.id, q]));
  assert.equal(byId['#41'].plan, 'phases/1/PLAN.md');
  assert.equal(byId['#46'].plan, 'phases/1/PLAN.md');
  assert.notEqual(byId['#41'].break, 'no-plan');
  assert.notEqual(byId['#46'].break, 'no-plan');
  assert.equal(r.orphans, undefined);
  assert.ok(!JSON.stringify(r).includes('TODO'));
});

test('audit: a quoted scalar requirements: value reads as the single id', () => {
  const dir = blockPlanTree('requirements: "#41"\nfiles: []');
  const r = run(['audit'], dir);
  assert.equal(r.ok, true);
  const byId = Object.fromEntries(r.requirements.map((q) => [q.id, q]));
  assert.equal(byId['#41'].plan, 'phases/1/PLAN.md');
  assert.notEqual(byId['#41'].break, 'no-plan');
  assert.equal(r.orphans, undefined);
});

test('plan-overlap: block-form files: lists intersect like inline ones (#48.1)', () => {
  const dir = makeTree({
    roadmap: [{ n: 1, name: 'One' }],
    phases: { 1: { plan: ['PLAN-1.md', 'PLAN-2.md'] } },
  });
  const pdir = join(dir, 'phases', '1');
  writeFileSync(join(pdir, 'PLAN-1.md'),
    '---\nphase: 1\nplan: 1\nrequirements: []\nfiles:\n  - src/a.rs\n  - src/shared.rs\n---\n# Plan 1\n');
  writeFileSync(join(pdir, 'PLAN-2.md'),
    '---\nphase: 1\nplan: 2\nrequirements: []\nfiles:\n  - src/shared.rs\n  - src/c.rs\n---\n# Plan 2\n');
  const r = run(['plan-overlap', '--phase', '1'], dir);
  assert.equal(r.ok, true);
  assert.deepEqual(r.overlaps, [{ plans: ['PLAN-1.md', 'PLAN-2.md'], files: ['src/shared.rs'] }]);
  assert.equal(r.undeclared, undefined); // both plans declared files
});

test('plan-overlap: a comment line inside each files: block list does not truncate it - both share src/shared.rs (D-04 acceptance criterion)', () => {
  const dir = makeTree({
    roadmap: [{ n: 1, name: 'One' }],
    phases: { 1: { plan: ['PLAN-1.md', 'PLAN-2.md'] } },
  });
  const pdir = join(dir, 'phases', '1');
  writeFileSync(join(pdir, 'PLAN-1.md'),
    '---\nphase: 1\nplan: 1\nrequirements: []\nfiles:\n  - src/a.rs\n  # shared with plan 2\n  - src/shared.rs\n---\n# Plan 1\n');
  writeFileSync(join(pdir, 'PLAN-2.md'),
    '---\nphase: 1\nplan: 2\nrequirements: []\nfiles:\n  # also touches plan 1\'s file\n  - src/shared.rs\n  - src/c.rs\n---\n# Plan 2\n');
  const r = run(['plan-overlap', '--phase', '1'], dir);
  assert.equal(r.ok, true);
  assert.deepEqual(r.overlaps, [{ plans: ['PLAN-1.md', 'PLAN-2.md'], files: ['src/shared.rs'] }]);
  assert.equal(r.undeclared, undefined);
});

test('audit + plan-overlap: a stray line BETWEEN two block ids is reported and skipped, not a terminator', () => {
  const withStray = blockPlanTree('requirements:\n  - "#41"\n  this line is not an item\n  - "#46"\nfiles: []');
  const clean = blockPlanTree('requirements:\n  - "#41"\n  - "#46"\nfiles: []');

  const a = run(['audit'], withStray);
  assert.equal(a.ok, true);
  const byId = Object.fromEntries(a.requirements.map((q) => [q.id, q]));
  assert.equal(byId['#41'].plan, 'phases/1/PLAN.md');
  assert.equal(byId['#46'].plan, 'phases/1/PLAN.md');
  assert.deepEqual(a.frontmatter_issues, [{
    file: 'phases/1/PLAN.md',
    issues: [{ line: 6, code: 'unknown-line', text: 'this line is not an item' }],
  }]);
  assert.deepEqual(a.counts, run(['audit'], clean).counts);

  const o = run(['plan-overlap', '--phase', '1'], withStray);
  assert.equal(o.ok, true);
  assert.deepEqual(o.frontmatter_issues, [{
    plan: 'PLAN.md',
    issues: [{ line: 6, code: 'unknown-line', text: 'this line is not an item' }],
  }]);
});

test('audit + plan-overlap: the frontmatter_issues diagnostic is not key-scoped', () => {
  // A stray line under `requirements:` (which plan-overlap never reads) must
  // still reach plan-overlap's envelope - the diagnostic is whole-pass, not
  // per-key.
  const underRequirements = blockPlanTree('requirements:\n  - "#41"\n  - "#46"\n  stray under requirements\nfiles: []');
  const o1 = run(['plan-overlap', '--phase', '1'], underRequirements);
  assert.equal(o1.ok, true);
  assert.equal(o1.frontmatter_issues[0].issues.some((i) => i.code === 'unknown-line'), true);

  // A stray line between two INLINE keys - the shipped template shape, where
  // no block scan runs at all - must reach BOTH envelopes.
  const betweenInline = blockPlanTree('requirements: ["#41", "#46"]\nstray between inline keys\nfiles: []');
  const a = run(['audit'], betweenInline);
  assert.equal(a.ok, true);
  assert.equal(a.frontmatter_issues[0].issues.some((i) => i.code === 'unknown-line'), true);
  const o2 = run(['plan-overlap', '--phase', '1'], betweenInline);
  assert.equal(o2.ok, true);
  assert.equal(o2.frontmatter_issues[0].issues.some((i) => i.code === 'unknown-line'), true);
});

// --- audit: unseeded/unpicked (D-01..D-07) and nonconforming_plans (D-13)

test('audit: an unpicked ## Active id BREAKS at zero rows - the additive shape is reversed', () => {
  const dir = makeTree({
    roadmap: [{ n: 1, name: 'One' }],
    phases: { 1: { plan: true, planReqs: ['SPN-01'] } },
  });
  writeFileSync(join(dir, 'REQUIREMENTS.md'),
    '# Requirements: Fixture\n\n## Active\n\n- **SPN-01**: desc\n\n## Traceability\n\n' +
    '| Requirement | Phase | Status |\n|---|---|---|\n\nEmpty.\n');
  const r = run(['audit'], dir);
  assert.equal(r.ok, true);
  assert.deepEqual(r.requirements, [{ id: 'SPN-01', break: 'unpicked' }]);
  // The deliberate co-occurrence: a plan declares SPN-01, no row carries it, so
  // the seed-reqs-never-wrote state reports from BOTH directions.
  assert.deepEqual(r.orphans, { plan_ids: [{ file: 'phases/1/PLAN.md', ids: ['SPN-01'] }] });
  assert.deepEqual(r.counts, { total: 1, traced: 0, broken: 1, deferred: 0 });
  assert.deepEqual(r.unseeded, { active_ids: ['SPN-01'] });
});

test('audit: unseeded reports no_active_section: true when the ## Active heading itself is absent', () => {
  const dir = makeTree({
    roadmap: [{ n: 1, name: 'One' }],
    phases: { 1: { plan: true } },
  });
  writeFileSync(join(dir, 'REQUIREMENTS.md'),
    '# Requirements: Fixture\n\n## Traceability\n\n| Requirement | Phase | Status |\n|---|---|---|\n\nEmpty.\n');
  const r = run(['audit'], dir);
  assert.equal(r.ok, true);
  assert.deepEqual(r.unseeded, { active_ids: [], no_active_section: true });
  // No heading, no declared scope, so nothing is unpicked - the null is never
  // coerced to [] (D-06), or every pre-v1.4.0 tree would be unpassable.
  assert.deepEqual(r.requirements, []);
});

test('audit: a tree with rows and no ## Active heading gains no unpicked break', () => {
  const dir = makeTree({
    roadmap: [{ n: 1, name: 'Done', checked: true }],
    phases: { 1: { plan: true, planReqs: ['REQ-1'] } },
    reqs: [['REQ-1', 1, 'Complete']],
  });
  const r = run(['audit'], dir);
  assert.equal(r.ok, true);
  assert.equal(r.unseeded, undefined);
  assert.equal(r.requirements.some((q) => q.break === 'unpicked'), false);
  assert.equal(r.counts.total, 1); // still the row count: nothing to add
});

test('audit: the partially-planned state - a row for AUD-01, none for AUD-02, so AUD-02 breaks and the verdict FAILs', () => {
  const dir = makeTree({
    roadmap: [{ n: 1, name: 'Done', checked: true }],
    phases: { 1: { plan: true, planReqs: ['AUD-01'] } },
  });
  writeFileSync(join(dir, 'REQUIREMENTS.md'),
    '# Requirements: Fixture\n\n## Active\n\n- **AUD-01**: planned\n- **AUD-02**: not picked up\n\n' +
    '## Traceability\n\n| Requirement | Phase | Status |\n|---|---|---|\n' +
    '| AUD-01 | Phase 1 | Complete |\n');
  const r = run(['audit'], dir);
  assert.equal(r.ok, true);
  const byId = Object.fromEntries(r.requirements.map((q) => [q.id, q]));
  assert.equal(byId['AUD-01'].break, undefined);
  assert.deepEqual(byId['AUD-02'], { id: 'AUD-02', break: 'unpicked' }); // no `phase` key
  assert.deepEqual(r.counts, { total: 2, traced: 1, broken: 1, deferred: 0 });
  // The arithmetic identity D-02 exists to keep true once a break can have no row.
  assert.equal(r.counts.total, r.counts.traced + r.counts.broken + r.counts.deferred);
  assert.deepEqual(r.unseeded, { active_ids: ['AUD-02'] });
});

test('audit: a ## Deferred id is excluded by SECTION PLACEMENT, and a Deferred-status row is never unpicked', () => {
  const dir = makeTree({
    roadmap: [{ n: 1, name: 'Done', checked: true }],
    phases: { 1: { plan: true, planReqs: ['AUD-01'] } },
  });
  writeFileSync(join(dir, 'REQUIREMENTS.md'),
    '# Requirements: Fixture\n\n## Active\n\n- **AUD-01**: planned\n- **AUD-02**: deferred by status\n\n' +
    '## Traceability\n\n| Requirement | Phase | Status |\n|---|---|---|\n' +
    '| AUD-01 | Phase 1 | Complete |\n| AUD-02 | Phase 1 | Deferred |\n\n' +
    '## Deferred\n\n- **RCL-06**: never in Active, never audited\n');
  const r = run(['audit'], dir);
  assert.equal(r.ok, true);
  assert.equal(r.requirements.some((q) => q.id === 'RCL-06'), false);
  assert.equal(r.unseeded, undefined);
  assert.deepEqual(r.deferred, ['AUD-02']);
  assert.deepEqual(r.counts, { total: 2, traced: 1, broken: 0, deferred: 1 });
});

test('audit: an ## Active id that is not id-shaped can never reach the arithmetic, at zero rows either', () => {
  // The same phantom in the state where `unseeded`'s payload IS the whole
  // `## Active` list: `Note` is reported, not seeded, not counted, not broken.
  const dir = makeTree({
    roadmap: [{ n: 1, name: 'One' }],
    phases: { 1: { plan: true } },
  });
  writeFileSync(join(dir, 'REQUIREMENTS.md'),
    '# Requirements: Fixture\n\n## Active\n\n- **Note**: scope frozen 2026-07-01\n\n' +
    '## Traceability\n\n| Requirement | Phase | Status |\n|---|---|---|\n\nEmpty.\n');
  const r = run(['audit'], dir);
  assert.equal(r.ok, true);
  assert.deepEqual(r.requirements, []);
  assert.deepEqual(r.unseeded, { active_ids: [] });
  assert.equal(r.active_issues[0].code, 'active-non-id-bullet');
  assert.deepEqual(r.counts, { total: 0, traced: 0, broken: 0, deferred: 0 });
});

test('audit: a v1.3.1-shaped ## Active table is reported in active_issues - and its ids stay invisible to the break', () => {
  const dir = makeTree({
    roadmap: [{ n: 1, name: 'Done', checked: true }],
    phases: { 1: { plan: true, planReqs: ['A'] } },
  });
  writeFileSync(join(dir, 'REQUIREMENTS.md'),
    '# Requirements: Fixture\n\n## Active\n\n| Requirement | Milestone |\n|---|---|\n' +
    '| TRI-01 (triage every open bug) | v1.3.1 |\n\n' +
    '## Traceability\n\n| Requirement | Phase | Status |\n|---|---|---|\n' +
    '| A | Phase 1 | Complete |\n');
  const r = run(['audit'], dir);
  assert.equal(r.ok, true);
  assert.equal(r.active_issues.length, 1);
  assert.equal(r.active_issues[0].code, 'active-table-row');
  assert.equal(r.active_issues[0].line, 7);
  // The stated blind spot, pinned so the prose claim is falsifiable: the id on
  // that line is in NO break and in no unseeded payload until it is a bullet.
  assert.equal(r.requirements.some((q) => q.id === 'TRI-01'), false);
  assert.equal(r.unseeded, undefined);
  assert.deepEqual(r.counts, { total: 1, traced: 1, broken: 0, deferred: 0 });
});

// The upgrade-regression pins. `ACTIVE_BULLET` reads ANY bold span as an id, so
// an existing project's prose bold-bullet (`- **Note**: scope frozen`) and a
// mis-punctuated id (`- **AUD-01:**`) are ids by the grammar. Neither may break
// the audit or move `counts`: the first would FAIL a correct file by a name
// that is not a requirement, the second would count one requirement twice - as
// `AUD-01` traced from its row AND `AUD-01:` broken from the bullet.
test('audit: a prose bold bullet in ## Active is REPORTED, never a break - the phantom-id upgrade pin', () => {
  const dir = makeTree({
    roadmap: [{ n: 1, name: 'Done', checked: true }],
    phases: { 1: { plan: true, planReqs: ['AUD-01'] } },
  });
  writeFileSync(join(dir, 'REQUIREMENTS.md'),
    '# Requirements: Fixture\n\n## Active\n\n- **AUD-01**: the audit gate\n' +
    '- **Note**: scope frozen 2026-07-01\n\n' +
    '## Traceability\n\n| Requirement | Phase | Status |\n|---|---|---|\n' +
    '| AUD-01 | Phase 1 | Complete |\n');
  const r = run(['audit'], dir);
  assert.equal(r.ok, true);
  assert.equal(r.requirements.some((q) => q.break), false);
  assert.equal(r.requirements.some((q) => q.id === 'Note'), false);
  assert.equal(r.unseeded, undefined);
  assert.deepEqual(r.active_issues,
    [{ line: 6, code: 'active-non-id-bullet', text: '- **Note**: scope frozen 2026-07-01' }]);
  assert.deepEqual(r.counts, { total: 1, traced: 1, broken: 0, deferred: 0 });
});

test('audit: a colon INSIDE the bold span reports, and is never normalized into the id it resembles', () => {
  const dir = makeTree({
    roadmap: [{ n: 1, name: 'Done', checked: true }],
    phases: { 1: { plan: true, planReqs: ['AUD-01'] } },
  });
  writeFileSync(join(dir, 'REQUIREMENTS.md'),
    '# Requirements: Fixture\n\n## Active\n\n- **AUD-01:** the colon belongs outside the span\n\n' +
    '## Traceability\n\n| Requirement | Phase | Status |\n|---|---|---|\n' +
    '| AUD-01 | Phase 1 | Complete |\n');
  const r = run(['audit'], dir);
  assert.equal(r.ok, true);
  assert.equal(r.requirements.some((q) => q.break), false);
  assert.equal(r.active_issues[0].code, 'active-non-id-bullet');
  // One requirement, counted once - not `AUD-01` traced plus `AUD-01:` broken.
  assert.deepEqual(r.counts, { total: 1, traced: 1, broken: 0, deferred: 0 });
});

test('seed-reqs: a v1.3.1-shaped ## Active table leaves its envelope unchanged - the delegation did not leak into the writer', () => {
  const dir = makeTree({
    roadmap: [{ n: 1, name: 'One' }],
    phases: { 1: { plan: true, planReqs: ['TRI-01'] } },
  });
  writeFileSync(join(dir, 'REQUIREMENTS.md'),
    '# Requirements: Fixture\n\n## Active\n\n| Requirement | Milestone |\n|---|---|\n' +
    '| TRI-01 (triage every open bug) | v1.3.1 |\n\n' +
    '## Traceability\n\n| Requirement | Phase | Status |\n|---|---|---|\n');
  const r = run(['seed-reqs', '--phase', '1'], dir);
  assert.equal(r.ok, true);
  assert.equal(r.active_issues, undefined);
  assert.deepEqual(r.orphan_ids, ['TRI-01']);
});

test('audit + plan-overlap: a PLAN-gaps.md is reported as nonconforming_plans; PLAN-2.md is not, overlaps unchanged', () => {
  const dir = makeTree({
    roadmap: [{ n: 1, name: 'One' }],
    phases: { 1: { plan: ['PLAN.md', 'PLAN-2.md'] } },
    reqs: [],
  });
  writeFileSync(join(dir, 'phases', '1', 'PLAN-gaps.md'),
    '---\nphase: 1\nrequirements: []\nfiles: []\n---\n# Gaps\n');
  const a = run(['audit'], dir);
  assert.equal(a.ok, true);
  assert.deepEqual(a.nonconforming_plans, ['phases/1/PLAN-gaps.md']);

  const o = run(['plan-overlap', '--phase', '1'], dir);
  assert.equal(o.ok, true);
  assert.deepEqual(o.nonconforming_plans, ['PLAN-gaps.md']);
  assert.deepEqual(o.overlaps, []);
  assert.equal(o.plans.some((p) => p.plan === 'PLAN-gaps.md'), false);
});

test('plan-overlap: a phase with no directory still returns no-phase-dir, exit 1 (regression pin across the listPlanFiles refactor)', () => {
  const dir = makeTree({ roadmap: [{ n: 1, name: 'One' }] });
  const r = run(['plan-overlap', '--phase', '99'], dir);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'no-phase-dir');
  assert.equal(r._exit, 1);
});

test('audit: a roadmap phase with no directory is still treated as unplanned, ok:true (regression pin across the listPlanFiles refactor)', () => {
  const dir = makeTree({
    roadmap: [{ n: 1, name: 'One' }],
    reqs: [['REQ-1', 1, 'Pending']],
  });
  const r = run(['audit'], dir);
  assert.equal(r.ok, true);
  assert.equal(r.requirements.find((q) => q.id === 'REQ-1').break, 'no-plan');
});

test('audit: missing REQUIREMENTS or ROADMAP degrades with named reasons', () => {
  const noReqs = makeTree({ roadmap: [{ n: 1, name: 'Only' }] });
  assert.equal(run(['audit'], noReqs).reason, 'no-requirements');
  const noRoadmap = makeTree({ reqs: [['REQ-1', 1, 'Pending']] });
  assert.equal(run(['audit'], noRoadmap).reason, 'no-roadmap');
});

// --- criteria-coverage: the CONTEXT criterion -> UAT item trace ----------------
// The direction asymmetry (D-09) is the contract these pin: `breaks` moves the
// verdict, `untraced` / `legacy` / `unknown_criterion` / `context_issues` never
// do. Deliberately independent of the UAT_FIELDS registration - `parseUat`
// accepts any `field: value` line, so these write `criterion:` by hand.

/**
 * A .planning tree carrying RAW CONTEXT/UAT text per phase:
 *   coverageTree({1: {checked: true, criteria: [[id, text], ...],
 *                     items: [{name, criterion?, origin?}]}})
 * `criteria`/`items` omitted writes no CONTEXT.md / no UAT.md at all (the
 * absent-file rule); `contextText`/`uatText` write raw text instead.
 * `checked: false` leaves the phase's roadmap box unchecked.
 */
function coverageTree(spec) {
  const roadmap = Object.entries(spec).map(([n, ph]) =>
    ({ n: Number(n), name: `Phase ${n}`, checked: ph.checked !== false }));
  const dir = makeTree({ roadmap });
  for (const [n, ph] of Object.entries(spec)) {
    const pdir = join(dir, 'phases', n);
    mkdirSync(pdir, { recursive: true });
    if (ph.contextText !== undefined) writeFileSync(join(pdir, 'CONTEXT.md'), ph.contextText);
    else if (ph.criteria) {
      const bullets = ph.criteria.map(([id, text]) => `- [ ] ${id}: ${text}`).join('\n');
      writeFileSync(join(pdir, 'CONTEXT.md'),
        `# Phase ${n} Context\n\n## Acceptance criteria\n\n${bullets}\n\n## Flagged assumptions\n\nnone\n`);
    }
    if (ph.uatText !== undefined) writeFileSync(join(pdir, 'UAT.md'), ph.uatText);
    else if (ph.items) {
      const blocks = ph.items.map((it, i) =>
        `### ${i + 1}. ${it.name}\nexpected: behavior ${i + 1}\n` +
        `${it.criterion ? `criterion: ${it.criterion}\n` : ''}` +
        `${it.origin ? `origin: ${it.origin}\n` : ''}status: pass\n`);
      writeFileSync(join(pdir, 'UAT.md'),
        `---\nstatus: testing\nphase: ${n}\n` +
        `${ph.fieldsVersion ? 'fields_version: 1\n' : ''}` +
        `started: 2026-01-01\nupdated: 2026-01-01\n---\n\n` +
        `## Items\n\n${blocks.join('\n')}\n## Summary\n\ntotal: ${ph.items.length}\n`);
    }
  }
  return dir;
}

// The synthesized fixture (D-15): this cycle's phase-1 criteria prose and its
// 14 real item names, with the AC4 and AC5 items deleted below. Real prose,
// synthetic defect - ROADMAP's earlier claim of a v1.4.0 checklist that dropped
// AC4 and AC5 was verified not to exist, so nothing is recovered from history.
const P1_CRITERIA = [
  ['AC1', '`agents/` holds exactly the 13 files the `rungs` arrays in `route-table.json` name'],
  ['AC2', 'Adding a contract-skill section tag to the body of an agent file that declares `skills:` reports `ok:false`'],
  ['AC3', 'the retired effort-variant grep returns matches only under `.planning/` and in `CHANGELOG.md`'],
  ['AC4', '`route-table.json` carries `rung_order: ["low","medium","high","xhigh","max"]`'],
  ['AC5', "`resolve('cad-plan-checker', autoCfg, ['--attempt','2'])` still returns `cad-plan-checker-high`"],
  ['AC6', '`node --test cadence-core/bin/*.test.mjs` exits 0 and `npx tsc -p tsconfig.ci.json` exits 0'],
  ['AC7', '`node cadence-core/bin/self-verify.mjs` reports `ok:true` with `agent-skills` still checked'],
];

const P1_ITEMS = [
  { name: "13 rung files exist, each carrying its own rung's effort", criterion: 'AC1' },
  { name: 'A rung file carrying behaviour fails CI', criterion: 'AC2' },
  { name: 'Retired effort-variant vocabulary is gone from live surfaces', criterion: 'AC3' },
  { name: 'rung_order is declared and out-of-ladder rungs fail with the role named', criterion: 'AC4' },
  { name: 'Escalation still resolves, now through escalate_to', criterion: 'AC5' },
  { name: 'Full test suite and typecheck are green', criterion: 'AC6' },
  { name: 'self-verify reports ok:true with the agent checks intact', criterion: 'AC7' },
  { name: 'Weight-budget manifest is exact, not a stale ceiling', origin: 'verifier' },
  { name: 'No live doc names a rung file the ladder cannot produce', origin: 'verifier' },
  { name: 'A malformed route-table role does not collapse self-verify', origin: 'verifier' },
  { name: 'A downward escalate_to is caught, not reported ok:true', origin: 'verifier' },
  { name: "Check 7's enforcement matches what the docs claim it enforces", origin: 'verifier' },
  { name: 'undeclared-rung-agent names the real fault', origin: 'verifier' },
  { name: 'LINEAGE.md agent figures and vocabulary: decided', origin: 'verifier' },
];

/** The 14 items minus the two carrying AC4 and AC5 - the synthetic defect. */
const P1_ITEMS_DROPPED = P1_ITEMS.filter((it) => it.criterion !== 'AC4' && it.criterion !== 'AC5');

test('criteria-coverage: the synthesized fixture breaks on exactly the two dropped ids', () => {
  const dir = coverageTree({ 1: { criteria: P1_CRITERIA, items: P1_ITEMS_DROPPED } });
  const r = run(['criteria-coverage'], dir);
  assert.equal(r.ok, true);
  assert.deepEqual(r.breaks, [
    { phase: 1, id: 'AC4', break: 'uncovered' },
    { phase: 1, id: 'AC5', break: 'uncovered' },
  ]);
  assert.deepEqual(r.phases, [{ phase: 1, criteria: 7, items: 12 }]);
  assert.equal(r.counts.criteria, 7);
  assert.equal(r.counts.covered, 5);
  assert.equal(r.counts.uncovered, 2);
  assert.equal(r.untraced, undefined);
  assert.equal(r.legacy, undefined);
});

test('criteria-coverage: the same fixture with all 14 items returns zero breaks', () => {
  const dir = coverageTree({ 1: { criteria: P1_CRITERIA, items: P1_ITEMS } });
  const r = run(['criteria-coverage'], dir);
  assert.equal(r.ok, true);
  assert.equal(r.breaks, undefined);
  assert.equal(r.untraced, undefined);
  assert.deepEqual(r.counts, { criteria: 7, covered: 7, uncovered: 0, untraced: 0, phases: 1 });
});

test('criteria-coverage: an item with neither criterion nor origin is untraced, never a break', () => {
  const dir = coverageTree({
    1: { criteria: P1_CRITERIA, items: [...P1_ITEMS, { name: 'A deliverable from the PLAN fallback branch' }] },
  });
  const r = run(['criteria-coverage'], dir);
  assert.deepEqual(r.untraced, [{ phase: 1, item: 15, name: 'A deliverable from the PLAN fallback branch' }]);
  assert.equal(r.breaks, undefined);
  assert.equal(r.counts.uncovered, 0);
  assert.equal(r.counts.untraced, 1);
});

test('criteria-coverage: origin verifier and smoke exempt an item from untraced entirely', () => {
  const dir = coverageTree({
    1: { criteria: P1_CRITERIA,
      items: [...P1_ITEMS, { name: 'The plugin loads at all', origin: 'smoke' }] },
  });
  const r = run(['criteria-coverage'], dir);
  assert.equal(r.untraced, undefined); // the 7 verifier items + the smoke item
  assert.equal(r.breaks, undefined);
  assert.equal(r.counts.untraced, 0);
});

test('criteria-coverage: origin criterion with no id is STILL untraced - it names nothing', () => {
  const dir = coverageTree({
    1: { criteria: [['AC1', 'one']], items: [{ name: 'Item one', origin: 'criterion' }] },
  });
  const r = run(['criteria-coverage'], dir);
  assert.deepEqual(r.untraced, [{ phase: 1, item: 1, name: 'Item one' }]);
  assert.deepEqual(r.breaks, [{ phase: 1, id: 'AC1', break: 'uncovered' }]);
});

test('criteria-coverage: a checklist carrying NO criterion and NO origin is pre-field legacy', () => {
  const dir = coverageTree({
    1: { criteria: P1_CRITERIA, items: P1_ITEMS.map((it) => ({ name: it.name })) },
  });
  const r = run(['criteria-coverage'], dir);
  assert.deepEqual(r.legacy, [1]);
  assert.equal(r.breaks, undefined);
  assert.equal(r.untraced, undefined);
  // Held out of counts, which is what keeps criteria === covered + uncovered.
  assert.deepEqual(r.counts, { criteria: 0, covered: 0, uncovered: 0, untraced: 0, phases: 1 });
});

// The dropped-link regression, closed by the frontmatter marker. The ORIGINAL
// legacy rule was the two item fields alone, on the premise that every
// post-field checklist carries at least one `origin` - and
// `.planning/phases/3/UAT.md` (7 `criterion`, 0 `origin`) falsified it inside
// the same commit. This is that file with its links dropped: it must break, not
// absolve itself. Move the test back onto the item fields and this is what fails.
test('criteria-coverage: fields_version present and NO criterion, NO origin is NOT legacy', () => {
  const dir = coverageTree({
    1: { fieldsVersion: true, criteria: P1_CRITERIA,
      items: P1_ITEMS.slice(0, 7).map((it) => ({ name: it.name })) },
  });
  const r = run(['criteria-coverage'], dir);
  assert.equal(r.legacy, undefined);
  assert.deepEqual(r.breaks.map((b) => b.id), ['AC1', 'AC2', 'AC3', 'AC4', 'AC5', 'AC6', 'AC7']);
  assert.equal(r.untraced.length, 7);
  assert.equal(r.counts.uncovered, 7);
});

test('criteria-coverage: a marked checklist whose links are intact is unaffected by the marker', () => {
  const dir = coverageTree({
    1: { fieldsVersion: true, criteria: P1_CRITERIA, items: P1_ITEMS },
  });
  const r = run(['criteria-coverage'], dir);
  assert.equal(r.legacy, undefined);
  assert.equal(r.breaks, undefined);
  assert.deepEqual(r.counts, { criteria: 7, covered: 7, uncovered: 0, untraced: 0, phases: 1 });
});

test('criteria-coverage: legacy still applies to a genuinely pre-field checklist', () => {
  const dir = coverageTree({
    1: { criteria: P1_CRITERIA, items: P1_ITEMS.map((it) => ({ name: it.name })) },
  });
  const r = run(['criteria-coverage'], dir);
  assert.deepEqual(r.legacy, [1]);
  assert.equal(r.breaks, undefined);
  assert.equal(r.untraced, undefined);
  // Held out of counts, which is what keeps criteria === covered + uncovered.
  assert.deepEqual(r.counts, { criteria: 0, covered: 0, uncovered: 0, untraced: 0, phases: 1 });
});

// The sharpest test in this file: the dropped-link regression. A checklist
// written AFTER this phase always carries at least one `origin`, so a UAT with
// some `origin` but no `criterion` is NOT an old project - it is a live
// `/cad-verify` that stopped emitting the link. Widen the legacy rule back to a
// bare no-`criterion` test and this test is what fails.
test('criteria-coverage: no criterion but at least one origin is NOT legacy - every criterion breaks', () => {
  const dir = coverageTree({
    1: { criteria: P1_CRITERIA,
      items: P1_ITEMS.map((it) => (it.origin ? it : { name: it.name })) },
  });
  const r = run(['criteria-coverage'], dir);
  assert.equal(r.legacy, undefined);
  assert.deepEqual(r.breaks.map((b) => b.id), ['AC1', 'AC2', 'AC3', 'AC4', 'AC5', 'AC6', 'AC7']);
  assert.equal(r.counts.uncovered, 7);
});

test('criteria-coverage: an EMPTY checklist is not legacy - the drop itself, every criterion breaks', () => {
  const dir = coverageTree({ 1: { criteria: P1_CRITERIA, items: [] } });
  const r = run(['criteria-coverage'], dir);
  assert.equal(r.legacy, undefined);
  assert.equal(r.breaks.length, 7);
  assert.deepEqual(r.phases, [{ phase: 1, criteria: 7, items: 0 }]);
});

test('criteria-coverage: an unchecked roadmap box counts uncovered but contributes no break', () => {
  const dir = coverageTree({
    1: { checked: false, criteria: P1_CRITERIA, items: P1_ITEMS_DROPPED },
  });
  const r = run(['criteria-coverage'], dir);
  assert.equal(r.breaks, undefined);
  assert.equal(r.counts.uncovered, 2);
  assert.deepEqual(r.phases, [{ phase: 1, criteria: 7, items: 12 }]);
});

test('criteria-coverage: an absent CONTEXT.md or UAT.md leaves the phase out of the envelope, ok:true', () => {
  const noContext = coverageTree({ 1: { items: P1_ITEMS_DROPPED } });
  const a = run(['criteria-coverage'], noContext);
  assert.equal(a.ok, true);
  assert.deepEqual(a.phases, []);
  assert.equal(a.breaks, undefined);
  assert.deepEqual(a.counts, { criteria: 0, covered: 0, uncovered: 0, untraced: 0, phases: 0 });
  const noUat = coverageTree({ 1: { criteria: P1_CRITERIA } });
  const b = run(['criteria-coverage'], noUat);
  assert.equal(b.ok, true);
  assert.deepEqual(b.phases, []);
  assert.equal(b.breaks, undefined);
});

test('criteria-coverage: a CONTEXT of bare bullets surfaces criterion-unidded, additively', () => {
  const dir = coverageTree({
    1: {
      contextText: '# Phase 1 Context\n\n## Acceptance criteria\n\n- [ ] the tests pass\n- [ ] the linter is clean\n',
      items: [{ name: 'Tests pass', origin: 'verifier' }],
    },
  });
  const r = run(['criteria-coverage'], dir);
  assert.equal(r.ok, true);
  assert.deepEqual(r.context_issues[0].issues.map((i) => i.code),
    ['criterion-unidded', 'criterion-unidded']);
  assert.equal(r.breaks, undefined);
  assert.equal(r.counts.criteria, 0);
});

test('criteria-coverage: a criterion value naming no declared id reports unknown_criterion', () => {
  const dir = coverageTree({
    1: { criteria: [['AC1', 'one']], items: [{ name: 'Item one', criterion: 'AC9' }] },
  });
  const r = run(['criteria-coverage'], dir);
  assert.deepEqual(r.unknown_criterion, [{ phase: 1, item: 1, criterion: 'AC9' }]);
  assert.deepEqual(r.breaks, [{ phase: 1, id: 'AC1', break: 'uncovered' }]);
  assert.equal(r.untraced, undefined); // it carries a criterion, wrong or not
});

test('criteria-coverage: the counts identity holds across a mixed tree', () => {
  const dir = coverageTree({
    1: { criteria: P1_CRITERIA, items: P1_ITEMS },
    2: { criteria: P1_CRITERIA, items: P1_ITEMS.map((it) => ({ name: it.name })) }, // legacy
    3: { criteria: [['AC1', 'one'], ['AC2', 'two'], ['AC3', 'three']],
      items: [{ name: 'Item one', criterion: 'AC1' }, { name: 'A gap', origin: 'verifier' }] },
    4: { items: P1_ITEMS }, // no CONTEXT: contributes nothing
  });
  const r = run(['criteria-coverage'], dir);
  assert.deepEqual(r.legacy, [2]);
  assert.deepEqual(r.breaks, [
    { phase: 3, id: 'AC2', break: 'uncovered' },
    { phase: 3, id: 'AC3', break: 'uncovered' },
  ]);
  assert.deepEqual(r.counts, { criteria: 10, covered: 8, uncovered: 2, untraced: 0, phases: 3 });
  assert.equal(r.counts.criteria, r.counts.covered + r.counts.uncovered);
});

test('criteria-coverage: an absent ROADMAP.md degrades with no-roadmap', () => {
  const dir = makeTree({ reqs: [['REQ-1', 1, 'Pending']] });
  const r = run(['criteria-coverage'], dir);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'no-roadmap');
  assert.equal(r._exit, 1);
});

// --- frontmatter grammar: normalization + the diagnostic's both envelopes ---

test('audit + plan-overlap: a CRLF-checked-out PLAN.md reads identically to its LF twin', () => {
  const build = (dir) => {
    const pdir = join(dir, 'phases', '1');
    writeFileSync(join(pdir, 'PLAN-1.md'),
      '---\nphase: 1\nplan: 1\nrequirements: ["#41", "#46"]\nfiles:\n  - src/a.rs\n  - src/shared.rs\n---\n# Plan 1\n');
    writeFileSync(join(pdir, 'PLAN-2.md'),
      '---\nphase: 1\nplan: 2\nrequirements: []\nfiles:\n  - src/shared.rs\n  - src/c.rs\n---\n# Plan 2\n');
  };
  const spec = {
    roadmap: [{ n: 1, name: 'One' }],
    phases: { 1: { plan: ['PLAN-1.md', 'PLAN-2.md'] } },
    reqs: [['#41', 1, 'Pending'], ['#46', 1, 'Pending']],
  };
  const lf = makeTree(spec);
  build(lf);
  const crlf = makeTree(spec);
  build(crlf);
  // Only PLAN-1.md is checked out CRLF - the sibling parsers stay out (D-10).
  const plan1 = join(crlf, 'phases', '1', 'PLAN-1.md');
  writeFileSync(plan1, readFileSync(plan1, 'utf8').replace(/\n/g, '\r\n'));

  const lfAudit = run(['audit'], lf);
  const crlfAudit = run(['audit'], crlf);
  assert.deepEqual(
    crlfAudit.requirements.map((r) => [r.id, r.break]).sort(),
    lfAudit.requirements.map((r) => [r.id, r.break]).sort(),
  );
  assert.equal(crlfAudit.frontmatter_issues, undefined);

  // The files path, not only the ids: plan-overlap reaches PLAN-1.md's CRLF
  // files: block list identically to the LF twin's.
  const lfOverlap = run(['plan-overlap', '--phase', '1'], lf);
  const crlfOverlap = run(['plan-overlap', '--phase', '1'], crlf);
  assert.deepEqual(crlfOverlap.overlaps, lfOverlap.overlaps);
  assert.deepEqual(crlfOverlap.overlaps, [{ plans: ['PLAN-1.md', 'PLAN-2.md'], files: ['src/shared.rs'] }]);
  assert.equal(crlfOverlap.frontmatter_issues, undefined);
});

test('audit: a BOM + leading blank line PLAN.md reads identically to its plain twin', () => {
  const plain = blockPlanTree('requirements: ["#41", "#46"]\nfiles: []');
  const bomDir = blockPlanTree('requirements: ["#41", "#46"]\nfiles: []');
  const planPath = join(bomDir, 'phases', '1', 'PLAN.md');
  // The BOM must be the file's actual first byte; the leading blank line
  // follows it.
  writeFileSync(planPath, `﻿\n${readFileSync(planPath, 'utf8')}`);
  const plainAudit = run(['audit'], plain);
  const bomAudit = run(['audit'], bomDir);
  assert.deepEqual(
    bomAudit.requirements.map((r) => [r.id, r.break]).sort(),
    plainAudit.requirements.map((r) => [r.id, r.break]).sort(),
  );
  assert.equal(bomAudit.frontmatter_issues, undefined);
});

test('audit + plan-overlap: an unterminated frontmatter fence reports on both envelopes, audit stays ok:true', () => {
  // blockPlanTree writes exactly one PLAN.md, so plan-overlap hits its
  // fewer-than-two-plans early return - deliberately, since that envelope
  // must carry the diagnostic too. Overwrite it with a fence that never
  // closes.
  const dir = blockPlanTree('requirements: ["#41", "#46"]\nfiles: []');
  writeFileSync(join(dir, 'phases', '1', 'PLAN.md'),
    '---\nphase: 1\nplan: 1\nrequirements: ["#41", "#46"]\nfiles: []\n\n# Plan 1 (fence never closes)\n');
  const a = run(['audit'], dir);
  assert.equal(a.ok, true);
  assert.deepEqual(a.frontmatter_issues,
    [{ file: 'phases/1/PLAN.md', issues: [{ line: 1, code: 'unterminated-frontmatter', text: '---' }] }]);
  const o = run(['plan-overlap', '--phase', '1'], dir);
  assert.equal(o.ok, true);
  assert.equal(o.note, 'fewer than two plans - nothing to intersect');
  assert.deepEqual(o.frontmatter_issues,
    [{ plan: 'PLAN.md', issues: [{ line: 1, code: 'unterminated-frontmatter', text: '---' }] }]);
});

// Task 5: falsify `references/plan-frontmatter.md`'s per-code Payload column
// at the audit seam - not a reading of the prose. Every fixture and the twin
// declare the SAME single id (#41) so a delta in counts.broken is
// attributable only to the code under test (see oneIdPlanTree).
test('audit: the per-code payload table is falsifiable - each dropping code moves counts.broken, each preserving code does not', () => {
  const twin = run(['audit'], oneIdPlanTree('requirements:\n  - "#41"\nfiles: []'));
  assert.equal(twin.ok, true);
  assert.equal(twin.frontmatter_issues, undefined);

  const dropping = {
    'unterminated-inline-list': 'requirements: ["#41"\nfiles: []',
    'unterminated-quote': 'requirements: ["#41]\nfiles: []',
    'malformed-key-line': 'requirements:["#41"]\nfiles: []',
    'item-without-key': 'requirements: []\n  - "#41"\nfiles: []',
  };
  for (const [code, frontmatter] of Object.entries(dropping)) {
    const r = run(['audit'], oneIdPlanTree(frontmatter));
    assert.equal(r.ok, true, code);
    assert.ok(r.frontmatter_issues[0].issues.some((i) => i.code === code), `${code}: missing from frontmatter_issues`);
    assert.ok(r.counts.broken > twin.counts.broken, `${code}: expected counts.broken > twin (payload dropped)`);
  }

  const preserving = {
    'trailing-inline-content': 'requirements: ["#41"] stray\nfiles: []',
    'trailing-value-content': 'requirements:\n  - "#41" stray\nfiles: []',
    'residual-quote': 'requirements:\n  - "#41"\nfiles: ["a\\"]',
  };
  for (const [code, frontmatter] of Object.entries(preserving)) {
    const r = run(['audit'], oneIdPlanTree(frontmatter));
    assert.equal(r.ok, true, code);
    assert.ok(r.frontmatter_issues[0].issues.some((i) => i.code === code), `${code}: missing from frontmatter_issues`);
    assert.equal(r.counts.broken, twin.counts.broken, `${code}: expected counts.broken === twin (payload preserved)`);
  }

  // commented-key-line drops nothing itself, but does not terminate the open
  // block, so the id still folds through - equal broken, and the folded
  // orphan (D-14's stated, accepted over-read) is provably present.
  const commented = run(['audit'], oneIdPlanTree('requirements:\n- "#41"\n# files:\n  - src/shared.rs'));
  assert.equal(commented.ok, true);
  assert.ok(commented.frontmatter_issues[0].issues.some((i) => i.code === 'commented-key-line'));
  assert.equal(commented.counts.broken, twin.counts.broken);
  assert.ok(commented.orphans.plan_ids.some((p) => p.ids.includes('src/shared.rs')));

  // unterminated-frontmatter drops the WHOLE block.
  const unterminatedDir = oneIdPlanTree('requirements: ["#41"]\nfiles: []');
  writeFileSync(join(unterminatedDir, 'phases', '1', 'PLAN.md'),
    '---\nphase: 1\nplan: 1\nrequirements: ["#41"]\nfiles: []\n\n# Plan 1 (fence never closes)\n');
  const unterminated = run(['audit'], unterminatedDir);
  assert.equal(unterminated.ok, true);
  assert.ok(unterminated.frontmatter_issues[0].issues.some((i) => i.code === 'unterminated-frontmatter'));
  assert.ok(unterminated.counts.broken > twin.counts.broken);

  // unknown-line is the one CONDITIONAL code (D-15) - two rows, since one
  // row of either shape would pin half the behavior and read as the whole
  // of it: a stray prose line drops nothing (equal to the twin) ...
  const strayProse = run(['audit'], oneIdPlanTree('requirements:\n  - "#41"\n  this line is not an item\nfiles: []'));
  assert.equal(strayProse.ok, true);
  assert.ok(strayProse.frontmatter_issues[0].issues.some((i) => i.code === 'unknown-line'));
  assert.equal(strayProse.counts.broken, twin.counts.broken);

  // ... but a data-carrying malformed line that falls through to unknown-line
  // (fails malformed-key-line's own `/^[A-Za-z_]/` start) drops a whole key.
  const malformedData = run(['audit'], oneIdPlanTree('1requirements: ["#41"]\nfiles: []'));
  assert.equal(malformedData.ok, true);
  assert.ok(malformedData.frontmatter_issues[0].issues.some((i) => i.code === 'unknown-line'));
  assert.ok(malformedData.counts.broken > twin.counts.broken);

  // backtick-wrapped-value is the second CONDITIONAL code, and for a different
  // reason than unknown-line: it always PRESERVES its bytes, but "preserves"
  // is a claim about bytes, not about tracing. On files: nothing traces, so
  // counts cannot move ...
  const backtickFile = run(['audit'], oneIdPlanTree('requirements:\n  - "#41"\nfiles:\n  - `src/shared.rs`'));
  assert.equal(backtickFile.ok, true);
  assert.ok(backtickFile.frontmatter_issues[0].issues.some((i) => i.code === 'backtick-wrapped-value'));
  assert.equal(backtickFile.counts.broken, twin.counts.broken);

  // ... but the same preserved bytes on requirements: are not a real id, so
  // the requirement goes untraced and counts.broken moves anyway. This row is
  // twin-shaped (same single id, same key as the twin) so it can actually
  // fail - the files: row above cannot, which is why one row alone would be
  // a test that passes by construction.
  const backtickId = run(['audit'], oneIdPlanTree('requirements:\n  - `#41`\nfiles: []'));
  assert.equal(backtickId.ok, true);
  assert.ok(backtickId.frontmatter_issues[0].issues.some((i) => i.code === 'backtick-wrapped-value'));
  assert.ok(backtickId.counts.broken > twin.counts.broken,
    'backtick-wrapped-value on requirements: must move counts.broken - a preserved `#41` is not the id #41');
});

test('plan-overlap: a trailing-annotated block item still overlaps, with the diagnostic naming which plan (UAT-9)', () => {
  const dir = makeTree({
    roadmap: [{ n: 1, name: 'One' }],
    phases: { 1: { plan: ['PLAN-1.md', 'PLAN-2.md'] } },
  });
  const pdir = join(dir, 'phases', '1');
  writeFileSync(join(pdir, 'PLAN-1.md'),
    '---\nphase: 1\nplan: 1\nrequirements: []\nfiles:\n  - "src/shared.rs" (new)\n---\n# Plan 1\n');
  writeFileSync(join(pdir, 'PLAN-2.md'),
    '---\nphase: 1\nplan: 2\nrequirements: []\nfiles:\n  - src/shared.rs\n---\n# Plan 2\n');
  const r = run(['plan-overlap', '--phase', '1'], dir);
  assert.equal(r.ok, true);
  assert.deepEqual(r.overlaps, [{ plans: ['PLAN-1.md', 'PLAN-2.md'], files: ['src/shared.rs'] }]);
  assert.deepEqual(r.frontmatter_issues, [{
    plan: 'PLAN-1.md',
    issues: [{ line: 6, code: 'trailing-value-content', text: '- "src/shared.rs" (new)' }],
  }]);
});

test('plan-overlap: a backtick-wrapped path does not silently miss a real collision (UAT-21)', () => {
  const dir = makeTree({
    roadmap: [{ n: 1, name: 'One' }],
    phases: { 1: { plan: ['PLAN-1.md', 'PLAN-2.md'] } },
  });
  const pdir = join(dir, 'phases', '1');
  writeFileSync(join(pdir, 'PLAN-1.md'),
    '---\nphase: 1\nplan: 1\nrequirements: []\nfiles:\n  - `src/shared.rs`\n---\n# Plan 1\n');
  writeFileSync(join(pdir, 'PLAN-2.md'),
    '---\nphase: 1\nplan: 2\nrequirements: []\nfiles:\n  - src/shared.rs\n---\n# Plan 2\n');
  const r = run(['plan-overlap', '--phase', '1'], dir);
  assert.equal(r.ok, true);
  // The path stays byte-exact (D-19), so the two spellings genuinely do not
  // overlap - but the diagnostic is what keeps that from being SILENT, and
  // choose_path routes a phase carrying frontmatter_issues to sequential.
  assert.deepEqual(r.overlaps, []);
  assert.deepEqual(r.frontmatter_issues, [{
    plan: 'PLAN-1.md',
    issues: [{ line: 6, code: 'backtick-wrapped-value', text: '- `src/shared.rs`' }],
  }]);
});

test('plan-overlap: a block item under an inline files: key is diagnosed and dropped on both plans, not overlapped (D-13)', () => {
  const dir = makeTree({
    roadmap: [{ n: 1, name: 'One' }],
    phases: { 1: { plan: ['PLAN-1.md', 'PLAN-2.md'] } },
  });
  const pdir = join(dir, 'phases', '1');
  writeFileSync(join(pdir, 'PLAN-1.md'),
    '---\nphase: 1\nplan: 1\nrequirements: []\nfiles: [src/a.rs]  # comment\n  - src/shared.rs\n---\n# Plan 1\n');
  writeFileSync(join(pdir, 'PLAN-2.md'),
    '---\nphase: 1\nplan: 2\nrequirements: []\nfiles: [src/b.rs]  # comment\n  - src/shared.rs\n---\n# Plan 2\n');
  const r = run(['plan-overlap', '--phase', '1'], dir);
  assert.equal(r.ok, true);
  assert.deepEqual(r.overlaps, []);
  assert.equal(r.undeclared, undefined);
  const byPlan = Object.fromEntries(r.frontmatter_issues.map((d) => [d.plan, d.issues]));
  assert.ok(byPlan['PLAN-1.md'].some((i) => i.code === 'item-without-key'));
  assert.ok(byPlan['PLAN-2.md'].some((i) => i.code === 'item-without-key'));
  // The dropped line is absent from the FILES LISTS specifically, never a
  // whole-envelope substring check (false by construction: the diagnostic
  // itself quotes the dropped line, since text: issueText(line) reaches the
  // envelope verbatim - naming the dropped line is the point of it).
  const plans = run(['plan-overlap', '--phase', '1'], dir).plans;
  assert.deepEqual(plans, [{ plan: 'PLAN-1.md', files: 1 }, { plan: 'PLAN-2.md', files: 1 }]);
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

// --- renumber vs CONTEXT acceptance-criteria ids: a NON-event ----------------
// What these pin is that NOTHING happens. cmdRenumber's computed edits are
// ROADMAP/REQUIREMENTS/STATE only, and phase dirs move whole via gitMv with
// their contents never rewritten - so `shiftPhaseTokens` never reaches a
// CONTEXT.md, and a `Phase 2` token INSIDE the fixture proves it (drop that
// token and the byte assertion passes vacuously). The only way to fail these is
// for a criterion id to embed the phase number, which is exactly what D-02
// forbids: an id that renumbers under the user is worse than no id at all.
//
// Falsification is a mutation of the CODE, not the fixture: add
// `phases/<n>/CONTEXT.md` to the files cmdRenumber shifts tokens over and both
// tests fail. "Rewrite one fixture id to P2-AC1 and watch it fail" proves
// nothing - it moves the expected and the actual bytes together.

const CRITERIA_CONTEXT = '# Phase 2: Two - Context\n\n' +
  'Gathered: 2026-01-01\nFeeds: /cad-plan 2\n\n' +
  '## Scope boundary\n\nIn: the work Phase 2 delivers\n\n' +
  '## Acceptance criteria\n\n' +
  '- [ ] AC1: the first observable behavior\n' +
  '- [ ] AC2: the second observable behavior\n' +
  '- [ ] AC3: the third observable behavior\n';

/** renumberTree plus a real criteria section (and a `Phase 2` token) in phase 2. */
function criteriaRenumberTree() {
  const dir = renumberTree();
  writeFileSync(join(dir, 'phases', '2', 'CONTEXT.md'), CRITERIA_CONTEXT);
  return dir;
}

test('renumber insert: an existing phase CONTEXT keeps its AC ids byte-identical (D-02)', () => {
  const dir = criteriaRenumberTree();
  const r = run(['renumber', 'insert', '--at', '2'], dir);
  assert.equal(r.ok, true);
  // phases/2 moved to phases/3; its bytes did not change, `Phase 2` included.
  const moved = readFileSync(join(dir, 'phases', '3', 'CONTEXT.md'), 'utf8');
  assert.equal(moved, CRITERIA_CONTEXT);
  // Hardcoded, NOT re-derived from the same file, so the assertion still fails
  // if the grammar itself is deleted.
  assert.deepEqual(classifyAcceptanceCriteria(moved).criteria.map((c) => c.id),
    ['AC1', 'AC2', 'AC3']);
});

test('renumber remove: the shift DOWN leaves an existing phase CONTEXT byte-identical too', () => {
  const dir = criteriaRenumberTree();
  const r = run(['renumber', 'remove', '--n', '1'], dir);
  assert.equal(r.ok, true);
  // phases/2 moved down to phases/1; same bytes, same ids.
  const moved = readFileSync(join(dir, 'phases', '1', 'CONTEXT.md'), 'utf8');
  assert.equal(moved, CRITERIA_CONTEXT);
  assert.deepEqual(classifyAcceptanceCriteria(moved).criteria.map((c) => c.id),
    ['AC1', 'AC2', 'AC3']);
});

test('renumber insert: integer dirs shift even when a decimal phase is highest (#36)', () => {
  const dir = makeTree({
    roadmap: [{ n: 1, name: 'One' }, { n: 2, name: 'Two' }, { n: 2.1, name: 'Patch' }],
    phases: { 1: { plan: true }, 2: { plan: true }, '2.1': { plan: true } },
  });
  const r = run(['renumber', 'insert', '--at', '1'], dir);
  assert.equal(r.ok, true);
  // integers shift up (1->2, 2->3); the decimal dir NEVER moves
  assert.deepEqual(readdirSync(join(dir, 'phases')).sort(), ['2', '2.1', '3']);
  const roadmap = readFileSync(join(dir, 'ROADMAP.md'), 'utf8');
  assert.match(roadmap, /\*\*Phase 2: One\*\*/);
  assert.match(roadmap, /\*\*Phase 3: Two\*\*/);
  assert.match(roadmap, /\*\*Phase 2\.1: Patch\*\*/); // decimal token untouched
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

test('renumber remove: a name-less `### Phase N:` detail heading still cuts (#48.2)', () => {
  const dir = makeTree({});
  writeFileSync(join(dir, 'ROADMAP.md'),
    '# Roadmap\n\n## Phases\n\n- [ ] **Phase 1: One** - a\n- [ ] **Phase 2: Two** - b\n\n' +
    // The list line carries a name (the list-line grammar is unchanged); only
    // the detail heading is bare - exactly the filed case.
    '## Phase Details\n\n### Phase 1: One\n**Goal:** g1\n\n### Phase 2:\n**Goal:** g2\n');
  const r = run(['renumber', 'remove', '--n', '2'], dir);
  assert.equal(r.ok, true);
  assert.equal(r.total, 1);
  const roadmap = readFileSync(join(dir, 'ROADMAP.md'), 'utf8');
  assert.doesNotMatch(roadmap, /### Phase 2/);
  assert.doesNotMatch(roadmap, /\*\*Goal:\*\* g2/); // the body went with it
  assert.match(roadmap, /### Phase 1: One/);        // the named section survives
  assert.match(roadmap, /\*\*Goal:\*\* g1/);
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

test('renumber: refuses a colliding destination before any write (#49.2)', () => {
  const dir = renumberTree();
  mkdirSync(join(dir, 'phases', '4'), { recursive: true });
  writeFileSync(join(dir, 'phases', '4', 'PLAN.md'), '# stray\n');
  const before = readFileSync(join(dir, 'ROADMAP.md'), 'utf8');

  const dry = run(['renumber', 'insert', '--at', '3', '--dry-run'], dir);
  assert.equal(dry.ok, false);
  assert.equal(dry.reason, 'collision');
  assert.match(dry.detail, /phases\/4/);

  const r = run(['renumber', 'insert', '--at', '3'], dir);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'collision');
  assert.match(r.detail, /phases\/4/);

  assert.equal(readFileSync(join(dir, 'ROADMAP.md'), 'utf8'), before);
  assert.deepEqual(readdirSync(join(dir, 'phases')).sort(), ['1', '2', '3', '4']);
  assert.ok(!existsSync(join(dir, 'phases', '4', '3')));
  assert.match(readFileSync(join(dir, 'phases', '4', 'PLAN.md'), 'utf8'), /# stray/);
});

test('renumber: a dangling symlink at the destination still collides (#49.2)', () => {
  const dir = renumberTree();
  const before = readFileSync(join(dir, 'ROADMAP.md'), 'utf8');
  symlinkSync('nowhere', join(dir, 'phases', '4'));

  const r = run(['renumber', 'insert', '--at', '3'], dir);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'collision');
  assert.equal(readFileSync(join(dir, 'ROADMAP.md'), 'utf8'), before);
});

test('renumber remove: a dangling symlink at phases/<at> collides instead of dying mid-apply (#49.2)', () => {
  // The remove direction of the arm above. `vacated` used to be seeded with
  // `at` on every remove, but the rm that frees that slot is gated on
  // existingDir (existsSync), which is FALSE for a dangling symlink - so the
  // pre-flight waved through the very occupant occupied()/lstatSync exists to
  // catch, and the apply then died on the first move with completed: [] and a
  // hint asserting a half-renumbered tree when nothing had been written.
  const dir = renumberTree();
  const before = readFileSync(join(dir, 'ROADMAP.md'), 'utf8');
  rmSync(join(dir, 'phases', '2'), { recursive: true });
  symlinkSync('nowhere', join(dir, 'phases', '2'));

  const r = run(['renumber', 'remove', '--n', '2'], dir);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'collision');
  assert.match(r.detail, /phases\/2/);
  assert.equal(readFileSync(join(dir, 'ROADMAP.md'), 'utf8'), before);
});

test('renumber remove: uncommitted work in phases/<at> is refused before any write', () => {
  // `git rm -r -q` exits 0 while leaving untracked/ignored files, so
  // phases/<at> SURVIVES a removal that reported success, the first move
  // nests the next phase inside it (phases/1/2/PLAN.md), and the command
  // still exits ok:true with ROADMAP naming a phase whose dir has no plan.
  // Every other renumber fixture is a bare tmpdir, where gitMv/git rm always
  // fall back to fs calls that cannot nest - so this arm needs a REAL repo.
  const dir = renumberTree();
  const repo = join(dir, '..');
  const g = (args) => execFileSync('git', args, { cwd: repo, stdio: 'pipe',
    env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' } });
  g(['init', '-q', '.']);
  g(['config', 'user.email', 't@t']);
  g(['config', 'user.name', 'T']);
  g(['add', '-A']);
  g(['commit', '-qm', 'init']);
  writeFileSync(join(dir, 'phases', '1', 'NOTES.md'), 'untracked\n');

  const before = readFileSync(join(dir, 'ROADMAP.md'), 'utf8');
  const r = run(['renumber', 'remove', '--n', '1'], dir);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'uncommitted-work');
  assert.match(r.detail, /NOTES\.md/);
  // Nothing moved, nothing nested, nothing rewritten.
  assert.equal(readFileSync(join(dir, 'ROADMAP.md'), 'utf8'), before);
  assert.deepEqual(readdirSync(join(dir, 'phases')).sort(), ['1', '2', '3']);
  assert.ok(existsSync(join(dir, 'phases', '1', 'PLAN.md')));
  assert.ok(!existsSync(join(dir, 'phases', '1', '2')));

  // A MODIFIED tracked file is the other half of the same principle, and the
  // more dangerous one: `git rm -r` REFUSES it ("file has local
  // modifications"), and the rmSync fallback then deletes the work anyway
  // with no copy in the object store. Verified live before this guard: the
  // command returned ok:true and the edit was unrecoverable.
  rmSync(join(dir, 'phases', '1', 'NOTES.md'));
  const plan1 = join(dir, 'phases', '1', 'PLAN.md');
  const edited = '# Plan 1\n\nuncommitted edit\n';
  writeFileSync(plan1, edited);
  const rMod = run(['renumber', 'remove', '--n', '1'], dir);
  assert.equal(rMod.ok, false);
  assert.equal(rMod.reason, 'uncommitted-work');
  assert.equal(readFileSync(plan1, 'utf8'), edited, 'the uncommitted edit must survive');

  // With the tree clean the same call succeeds and does NOT nest.
  g(['checkout', '--', '.']);
  const r2 = run(['renumber', 'remove', '--n', '1'], dir);
  assert.equal(r2.ok, true);
  assert.ok(!existsSync(join(dir, 'phases', '1', '2')));
  assert.match(readFileSync(join(dir, 'phases', '1', 'PLAN.md'), 'utf8'), /Plan 2/);
});

test('renumber remove: a partial apply reports which ops completed (#49.2)', {
  skip: typeof process.getuid === 'function' && process.getuid() === 0 ? 'root bypasses mode bits' : false,
}, () => {
  const dir = renumberTree();
  chmodSync(dir, 0o555); // .planning root read-only; phases/ stays writable
  let r;
  try {
    r = run(['renumber', 'remove', '--n', '1'], dir);
  } finally {
    chmodSync(dir, 0o755);
  }
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'partial-apply');
  assert.deepEqual(r.completed, [
    { rm: 'phases/1' },
    { git_mv: ['phases/2', 'phases/1'] },
    { git_mv: ['phases/3', 'phases/2'] },
  ]);
  assert.deepEqual(r.failed, { edit: 'ROADMAP.md' });
  assert.match(r.detail, /ROADMAP/);
  // The hint must never PRESCRIBE a re-run: the half-applied tree no longer
  // matches ROADMAP, so a re-run rm's phases/1 - which now holds the ORIGINAL
  // phase 2's work - and exits ok:true having destroyed it. It may mention
  // re-running, but only to warn against it.
  assert.doesNotMatch(r.hint, /by hand,\s*then re-run/);
  assert.match(r.hint, /destroy/);
});

test('renumber remove: a failure before ANY step says so, rather than claiming a half-renumbered tree', {
  skip: typeof process.getuid === 'function' && process.getuid() === 0 ? 'root bypasses mode bits' : false,
}, () => {
  // completed: [] means nothing was written and the tree still matches
  // ROADMAP - the opposite of the partial case, and safe to re-run. An
  // unconditional "the tree is partly renumbered" hint would send the caller
  // hand-reconciling a tree that was never touched.
  const dir = renumberTree();
  chmodSync(join(dir, 'phases'), 0o555); // the rm (step one) cannot unlink
  let r;
  try {
    r = run(['renumber', 'remove', '--n', '1'], dir);
  } finally {
    chmodSync(join(dir, 'phases'), 0o755);
  }
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'partial-apply');
  assert.deepEqual(r.completed, []);
  assert.match(r.hint, /nothing was written/);
  assert.doesNotMatch(r.hint, /partly renumbered/);
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

test('plan-overlap: a task **Files:** annotation still normalizes to the bare path - the frontmatter narrowing is scoped to one arm (D-19)', () => {
  // PLAN-1's frontmatter declares the bare path; PLAN-2 declares it only on
  // an annotated task line. No frontmatter twin exists for the raw
  // "src/a.rs (edit)" form, so only the normalized path overlaps.
  const r = run(['plan-overlap', '--phase', '1'],
    overlapTree(['src/a.rs'], [], 'src/a.rs (edit)'));
  assert.equal(r.ok, true);
  assert.deepEqual(r.overlaps, [{ plans: ['PLAN-1.md', 'PLAN-2.md'], files: ['src/a.rs'] }]);
});

test('plan-overlap: frontmatter-declared paths with parens or a backtick overlap byte-exact, unmangled by add() (acceptance criterion 5)', () => {
  const dir = makeTree({
    roadmap: [{ n: 1, name: 'One' }],
    phases: { 1: { plan: ['PLAN-1.md', 'PLAN-2.md'] } },
  });
  const pdir = join(dir, 'phases', '1');
  const body = (p) => `---\nphase: 1\nplan: ${p}\nrequirements: []\nfiles:\n  - src/x(1)\n  - lib/a\`b.mjs\n---\n# Plan ${p}\n`;
  writeFileSync(join(pdir, 'PLAN-1.md'), body(1));
  writeFileSync(join(pdir, 'PLAN-2.md'), body(2));
  const r = run(['plan-overlap', '--phase', '1'], dir);
  assert.equal(r.ok, true);
  assert.deepEqual(r.overlaps,
    [{ plans: ['PLAN-1.md', 'PLAN-2.md'], files: ['src/x(1)', 'lib/a`b.mjs'] }]);
  assert.equal(r.frontmatter_issues, undefined);
});

test('plan-overlap: a frontmatter path with parens overlaps its raw twin declared only on a task line (the cross-arm bridge)', () => {
  const dir = makeTree({
    roadmap: [{ n: 1, name: 'One' }],
    phases: { 1: { plan: ['PLAN-1.md', 'PLAN-2.md'] } },
  });
  const pdir = join(dir, 'phases', '1');
  writeFileSync(join(pdir, 'PLAN-1.md'),
    '---\nphase: 1\nplan: 1\nrequirements: []\nfiles:\n  - src/x(1)\n---\n# Plan 1\n');
  writeFileSync(join(pdir, 'PLAN-2.md'),
    '---\nphase: 1\nplan: 2\nrequirements: []\nfiles: []\n---\n# Plan 2\n\n' +
    '### Task 1: t\n\n- **Files:** src/x(1)\n- **Action:** x\n- **Verify:** y\n');
  const r = run(['plan-overlap', '--phase', '1'], dir);
  assert.equal(r.ok, true);
  assert.deepEqual(r.overlaps, [{ plans: ['PLAN-1.md', 'PLAN-2.md'], files: ['src/x(1)'] }]);
});

test('plan-overlap: a frontmatter backtick-bearing path overlaps its raw twin declared only on a task line (the cross-arm bridge, other direction)', () => {
  const dir = makeTree({
    roadmap: [{ n: 1, name: 'One' }],
    phases: { 1: { plan: ['PLAN-1.md', 'PLAN-2.md'] } },
  });
  const pdir = join(dir, 'phases', '1');
  writeFileSync(join(pdir, 'PLAN-1.md'),
    '---\nphase: 1\nplan: 1\nrequirements: []\nfiles: []\n---\n# Plan 1\n\n' +
    '### Task 1: t\n\n- **Files:** lib/a`b.mjs\n- **Action:** x\n- **Verify:** y\n');
  writeFileSync(join(pdir, 'PLAN-2.md'),
    '---\nphase: 1\nplan: 2\nrequirements: []\nfiles:\n  - lib/a`b.mjs\n---\n# Plan 2\n');
  const r = run(['plan-overlap', '--phase', '1'], dir);
  assert.equal(r.ok, true);
  assert.deepEqual(r.overlaps, [{ plans: ['PLAN-1.md', 'PLAN-2.md'], files: ['lib/a`b.mjs'] }]);
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

// --- seed-reqs: /cad-plan's Traceability row-insert seam ------------------------

// A .planning tree for seed-reqs tests: REQUIREMENTS.md written raw with an
// `## Active` section (bullets) plus an empty `## Traceability` table -
// `active: null` omits the heading entirely (the no_active_section case),
// makeTree's `reqs` shape cannot express either.
function seedTree({ roadmap, phases, active }) {
  const dir = makeTree({ roadmap, phases });
  const activeSection = active === null ? ''
    : `## Active\n\n${active.map((id) => `- **${id}**: desc\n`).join('')}\n`;
  writeFileSync(join(dir, 'REQUIREMENTS.md'),
    `# Requirements: Fixture\n\n${activeSection}## Traceability\n\n` +
    '| Requirement | Phase | Status |\n|---|---|---|\n\nEmpty note.\n');
  return dir;
}

test('seed-reqs: a declared id with an ## Active bullet is seeded at Pending; a second run reports it skipped, file byte-identical', () => {
  const dir = seedTree({
    roadmap: [{ n: 1, name: 'One' }],
    phases: { 1: { plan: true, planReqs: ['X'] } },
    active: ['X'],
  });
  const r1 = run(['seed-reqs', '--phase', '1'], dir);
  assert.equal(r1.ok, true);
  assert.deepEqual(r1.seeded, ['X']);
  assert.deepEqual(r1.skipped, []);
  const after1 = readFileSync(join(dir, 'REQUIREMENTS.md'), 'utf8');
  assert.match(after1, /\| X \| Phase 1 \| Pending \|/);

  const r2 = run(['seed-reqs', '--phase', '1'], dir);
  assert.equal(r2.ok, true);
  assert.deepEqual(r2.seeded, []);
  assert.deepEqual(r2.skipped, ['X']);
  assert.equal(readFileSync(join(dir, 'REQUIREMENTS.md'), 'utf8'), after1);
});

test('seed-reqs: an id with no ## Active bullet is reported under orphan_ids, no row written, and audit still lists it under orphans.plan_ids', () => {
  const dir = seedTree({
    roadmap: [{ n: 1, name: 'One' }],
    phases: { 1: { plan: true, planReqs: ['Y'] } },
    active: [],
  });
  const r = run(['seed-reqs', '--phase', '1'], dir);
  assert.equal(r.ok, true);
  assert.deepEqual(r.seeded, []);
  assert.deepEqual(r.orphan_ids, ['Y']);
  const after = readFileSync(join(dir, 'REQUIREMENTS.md'), 'utf8');
  assert.equal(after.includes('| Y |'), false);
  const audit = run(['audit'], dir);
  assert.deepEqual(audit.orphans.plan_ids, [{ file: 'phases/1/PLAN.md', ids: ['Y'] }]);
});

test('seed-reqs: a missing ## Active heading returns no_active_section: true', () => {
  const dir = seedTree({
    roadmap: [{ n: 1, name: 'One' }],
    phases: { 1: { plan: true, planReqs: ['Z'] } },
    active: null,
  });
  const r = run(['seed-reqs', '--phase', '1'], dir);
  assert.equal(r.ok, true);
  assert.equal(r.no_active_section, true);
  assert.deepEqual(r.orphan_ids, ['Z']);
});

test('seed-reqs: --phase absent/non-numeric/negative all return bad-args, nothing written', () => {
  const dir = seedTree({
    roadmap: [{ n: 1, name: 'One' }],
    phases: { 1: { plan: true, planReqs: ['X'] } },
    active: ['X'],
  });
  const before = readFileSync(join(dir, 'REQUIREMENTS.md'), 'utf8');
  for (const args of [['seed-reqs'], ['seed-reqs', '--phase', 'abc'], ['seed-reqs', '--phase', '-1']]) {
    assert.equal(run(args, dir).reason, 'bad-args');
  }
  assert.equal(readFileSync(join(dir, 'REQUIREMENTS.md'), 'utf8'), before);
});

test('seed-reqs: a malformed requirements: line surfaces frontmatter_issues', () => {
  const dir = seedTree({
    roadmap: [{ n: 1, name: 'One' }],
    phases: { 1: { plan: true } },
    active: ['X'],
  });
  writeFileSync(join(dir, 'phases', '1', 'PLAN.md'),
    '---\nphase: 1\nrequirements:["X"]\nfiles: []\n---\n# Plan 1\n');
  const r = run(['seed-reqs', '--phase', '1'], dir);
  assert.equal(r.ok, true);
  assert.deepEqual(r.frontmatter_issues, [{
    file: 'phases/1/PLAN.md',
    issues: [{ line: 3, code: 'malformed-key-line', text: 'requirements:["X"]' }],
  }]);
});

test('seed-reqs: absent REQUIREMENTS.md / absent phase dir / no conforming plan file degrade with named reasons', () => {
  const noReqs = makeTree({ roadmap: [{ n: 1, name: 'One' }], phases: { 1: { plan: true } } });
  assert.equal(run(['seed-reqs', '--phase', '1'], noReqs).reason, 'no-requirements');

  const noPhaseDir = seedTree({ roadmap: [{ n: 1, name: 'One' }], active: ['X'] });
  assert.equal(run(['seed-reqs', '--phase', '1'], noPhaseDir).reason, 'no-phase-dir');

  const noPlans = seedTree({ roadmap: [{ n: 1, name: 'One' }], active: ['X'] });
  mkdirSync(join(noPlans, 'phases', '1'), { recursive: true });
  const rNoPlans = run(['seed-reqs', '--phase', '1'], noPlans);
  assert.equal(rNoPlans.reason, 'no-plans');
  assert.equal(rNoPlans.hint, '/cad-plan 1');
});

test('seed-reqs: a seeded row survives renumber insert, reading Phase 2', () => {
  const dir = seedTree({
    roadmap: [{ n: 1, name: 'One' }],
    phases: { 1: { plan: true, planReqs: ['X'] } },
    active: ['X'],
  });
  assert.equal(run(['seed-reqs', '--phase', '1'], dir).ok, true);
  assert.equal(run(['renumber', 'insert', '--at', '1'], dir).ok, true);
  const after = readFileSync(join(dir, 'REQUIREMENTS.md'), 'utf8');
  assert.match(after, /\| X \| Phase 2 \| Pending \|/);
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

// --- line endings at the seam -----------------------------------------------
// The roadmap reads through a CRLF-ONLY normalizer and writes raw bytes split
// on `\n`. Pinning both halves at the seam, because the corruption these guard
// against is only observable end to end: a lone-CR file that PARSES reaches
// write paths that see one giant line, and `renumber remove` then reported
// ok:true while leaving two `**Phase 1:**` lines and deleting both detail
// sections. Parser-level counterparts live in planning-files.test.mjs.

const reEncode = (dir, nl) => {
  const f = join(dir, 'ROADMAP.md');
  writeFileSync(f, readFileSync(f, 'utf8').replace(/\n/g, nl));
};

test('renumber remove: a CRLF roadmap renumbers correctly and stays CRLF', () => {
  const dir = makeTree({ roadmap: [{ n: 1, name: 'One' }, { n: 2, name: 'Two' }] });
  reEncode(dir, '\r\n');

  const r = run(['renumber', 'remove', '--n', '1'], dir);
  assert.equal(r.ok, true);
  const after = readFileSync(join(dir, 'ROADMAP.md'), 'utf8');
  assert.match(after, /- \[ \] \*\*Phase 1: Two\*\*/);      // shifted down
  assert.equal(/\*\*Phase 1: One\*\*/.test(after), false);  // list line gone
  assert.equal(/### Phase 2: Two/.test(after), false);      // detail shifted too
  assert.equal(/[^\r]\n/.test(after), false);               // every LF still CRLF
});

test('renumber remove: a lone-CR roadmap is refused, not silently corrupted', () => {
  const dir = makeTree({ roadmap: [{ n: 1, name: 'One' }, { n: 2, name: 'Two' }] });
  reEncode(dir, '\r');
  const before = readFileSync(join(dir, 'ROADMAP.md'), 'utf8');

  const r = run(['renumber', 'remove', '--n', '1'], dir);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'unparseable-roadmap');
  // The whole point: the file the command refused is byte-identical after.
  assert.equal(readFileSync(join(dir, 'ROADMAP.md'), 'utf8'), before);
  assert.equal((before.match(/\*\*Phase 1: One\*\*/g) || []).length, 1);
  assert.equal((before.match(/### Phase \d/g) || []).length, 2);
});

test('status: a lone-CR roadmap refuses rather than reporting a closed milestone', () => {
  const dir = makeTree({ roadmap: [{ n: 1, name: 'One' }] });
  reEncode(dir, '\r');
  const r = run(['status'], dir);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'unparseable-roadmap');
  assert.equal(r.cycle, undefined); // never mistaken for a pruned roadmap
});

test('renumber: refuses to operate ON a decimal phase', () => {
  const dir = makeTree({ roadmap: [{ n: 1, name: 'One' }, { n: 2, name: 'Two' }] });
  assert.equal(run(['renumber', 'remove', '--n', '1.5'], dir).reason, 'bad-args');
  assert.equal(run(['renumber', 'insert', '--at', '1.5'], dir).reason, 'bad-args');
});

// A tree with an out-of-roadmap decimal Phase 2.1 and a cursor parked on it -
// mirrors the decimal test above rather than passing n:2.1 to makeTree, whose
// `**Depends on:** Phase ${p.n - 1}` line would render a float artifact.
function decimalCursorTree() {
  const dir = makeTree({
    roadmap: [{ n: 1, name: 'One' }, { n: 2, name: 'Two' }, { n: 3, name: 'Three' }],
    phases: { 1: { plan: true }, 2: { plan: true }, 3: { plan: true } },
    cursor: { phase: 2.1, total: 4, name: 'Patch', status: 'planned', next: '/cad-execute 2.1', updated: '2026-01-01' },
  });
  const roadmap = readFileSync(join(dir, 'ROADMAP.md'), 'utf8').replace(
    '- [ ] **Phase 3: Three**',
    '- [ ] **Phase 2.1: Patch** - see phases/2.1/ notes\n- [ ] **Phase 3: Three**');
  writeFileSync(join(dir, 'ROADMAP.md'), roadmap);
  mkdirSync(join(dir, 'phases', '2.1'), { recursive: true });
  return dir;
}

test('renumber: a decimal cursor is warned about, never shifted (#37)', () => {
  const dir1 = decimalCursorTree();
  const r1 = run(['renumber', 'remove', '--n', '1'], dir1);
  assert.equal(r1.ok, true);
  assert.match(r1.warn, /2\.1/);
  assert.match(r1.warn, /re-point/);
  const cursor1 = run(['cursor', 'get'], dir1);
  assert.equal(cursor1.phase, 2.1);
  assert.equal(cursor1.total, 3);
  assert.match(readFileSync(join(dir1, 'ROADMAP.md'), 'utf8'), /\*\*Phase 2\.1: Patch\*\*/);
  assert.ok(existsSync(join(dir1, 'phases', '2.1')));

  const dir2 = decimalCursorTree();
  const r2 = run(['renumber', 'insert', '--at', '2'], dir2);
  assert.equal(r2.ok, true);
  const cursor2 = run(['cursor', 'get'], dir2);
  assert.equal(cursor2.phase, 2.1);
  assert.equal(cursor2.total, 5);
  assert.ok(r2.warn);

  const dir3 = decimalCursorTree();
  const r3 = run(['renumber', 'remove', '--n', '3'], dir3);
  assert.equal(r3.ok, true);
  assert.equal(r3.warn, undefined); // shift point sits above the cursor - nothing moved (D-10)
  const cursor3 = run(['cursor', 'get'], dir3);
  assert.equal(cursor3.phase, 2.1);
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
// `query` may be an array to express the UNQUOTED form (bare words as
// separate argv elements) - a single string cannot say that at all.
function recall(query, dir) {
  let raw;
  let code = 0;
  const qargs = Array.isArray(query) ? query : [query];
  try {
    raw = execFileSync('node', [PLANNING, 'recall', ...qargs, '--dir', dir], {
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

test('recall: bare words after the query are joined, not truncated (#47.2)', () => {
  // The corpus separates the two words, so a first-word-only search can only
  // reach phase 1 - the quoted run reaches both.
  const dir = makeTree({
    phases: {
      1: { summaryBody: { deviations: ['decimal cursor carve-out'] } },
      2: { summaryBody: { deviations: ['renumber phases desync report'] } },
    },
  });
  const bare = recall(['decimal', 'phases'], dir);
  const quoted = recall('decimal phases', dir);
  assert.equal(bare.json.ok, true);
  const sources = bare.json.results.map((x) => x.source);
  assert.ok(sources.includes('phases/1/SUMMARY.md'), `missing phase 1: ${sources}`);
  assert.ok(sources.includes('phases/2/SUMMARY.md'), `missing phase 2: ${sources}`);
  assert.equal(bare.raw, quoted.raw); // byte-identical to the quoted form
});

test('recall: a completed capture keeps its phase and gains a closed marker (#47.1)', () => {
  // makeTree's capture builder only ever writes `[ ]`, so the checked line is
  // written raw - the shape the builder cannot express.
  const dir = makeTree({ roadmap: [{ n: 1, name: 'One' }] });
  writeFileSync(join(dir, 'CAPTURE.md'),
    '## Todos\n\n- [x] (phase 3) tokenkiller carve-out closed by abc1234\n' +
    '- [ ] (phase 1) tokenkiller live item\n');
  const r = recall('tokenkiller', dir);
  assert.equal(r.json.ok, true);
  const closed = r.json.results.find((x) => /carve-out/.test(x.snippet));
  const live = r.json.results.find((x) => /live item/.test(x.snippet));
  // Pre-fix the `[x]` prefix blocked the `(phase N)` extraction entirely: no
  // phase field, and the checkbox stayed in the indexed text.
  assert.equal(closed.phase, 3);
  assert.doesNotMatch(closed.snippet, /\[x\]/);
  assert.ok(closed.snippet.startsWith('[closed] '),
    `closed snippet lacks the marker: ${closed.snippet}`);
  // An open capture is unchanged: phase extracted, no marker.
  assert.equal(live.phase, 1);
  assert.doesNotMatch(live.snippet, /\[closed\]/);
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
