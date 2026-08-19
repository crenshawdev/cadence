// Zero-dep tests for planning.mjs. Run: node --test 'cadence-core/bin/*.test.mjs'
// The JSON shapes asserted here ARE the interface contract - there is no
// spec file beyond them. Only node: builtins, per the repo ethos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, symlinkSync, chmodSync, rmSync, renameSync, accessSync, constants } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyAcceptanceCriteria } from './lib/planning-files.mjs';
import { DEBT_TOKEN } from './lib/debt-markers.mjs';

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

  // CAPTURE.md: a top-level `[{section, text, phase?}]` list, each bullet under
  // its named heading (todos carry a `(phase N)` tag when phase is given,
  // matching /cad-capture's real format).
  //
  // The three walked headings are always written, in order, whether or not a
  // row names them. A section OUTSIDE that set - `Archive`, `Debt markers` - is
  // written after them, which is how a row asserts what the recall walk does
  // NOT reach: the falsifier for the walk-membership claim needs a bullet that
  // exists in the file and must never come back.
  if (spec.capture) {
    const bySection = { Todos: [], Seeds: [], Notes: [] };
    for (const c of spec.capture) {
      const tag = c.phase !== undefined ? `(phase ${c.phase}) ` : '';
      const box = c.section === 'Todos' ? '[ ] ' : '';
      (bySection[c.section] ||= []).push(`- ${box}${tag}${c.text}`);
    }
    writeFileSync(join(dir, 'CAPTURE.md'),
      Object.entries(bySection).map(([h, ls]) => `## ${h}\n\n${ls.join('\n')}\n`).join('\n'));
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
/**
 * `env` (optional) is merged OVER process.env, so a row can pin a path the
 * script resolves relative to itself without any other row changing.
 */
function run(args, dir, stdin, env) {
  let stdout;
  let code = 0;
  try {
    stdout = execFileSync('node', [PLANNING, ...args, '--dir', dir],
      { encoding: 'utf8',
        ...(stdin !== undefined ? { input: stdin } : {}),
        ...(env ? { env: { ...process.env, ...env } } : {}) });
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

test('cursor set: a --phase spelling that cannot round-trip is refused, STATE.md untouched (D-07)', () => {
  const dir = makeTree({
    roadmap: [{ n: 1, name: 'One' }, { n: 2, name: 'Two' }, { n: '2.1', name: 'Hotfix' }],
    cursor: { phase: 1, total: 3, name: 'One', status: 'planned', next: '/cad-plan 1', updated: '2026-01-01' },
  });
  const before = readFileSync(join(dir, 'STATE.md'), 'utf8');
  for (const bad of ['1.10', '1.0', '01']) {
    const r = run(['cursor', 'set', '--phase', bad, '--status', 'planned', '--next', '/cad-plan 1'], dir);
    assert.equal(r.ok, false, bad);
    assert.equal(r.reason, 'bad-args', bad);
    assert.equal(r._exit, 1, bad);
    assert.ok(r.detail.includes(`"${bad}"`), `${bad}: detail quotes what was sent`);
    assert.ok(r.detail.includes(`"${String(Number(bad))}"`), `${bad}: detail quotes what is accepted`);
  }
  assert.equal(readFileSync(join(dir, 'STATE.md'), 'utf8'), before, 'nothing written');

  for (const good of ['2', '2.1']) {
    const r = run(['cursor', 'set', '--phase', good, '--status', 'planned', '--next', `/cad-execute ${good}`], dir);
    assert.equal(r.ok, true, good);
    assert.equal(r.cursor.phase, Number(good), good);
  }
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

// --- cursor set --next-file: the path transport for a COMPOSED resume pointer
//
// /cad-pause and `progress` build their pointer from what the run was doing,
// which is agent-derived text; the seven sites passing a literal
// `/cad-<command> N` keep the inline form, which is why nothing is deleted.

test('cursor set: --next-file writes the STATE.md the inline value writes', () => {
  const inlineDir = makeTree({ roadmap: [{ n: 1, name: 'Foundation' }] });
  const fileDir = makeTree({ roadmap: [{ n: 1, name: 'Foundation' }] });
  const pointer = '/cad-execute 1 - resume at task 3, the reader is half-wired';
  const src = join(fileDir, 'next.txt');
  writeFileSync(src, `${pointer}\n`);
  const a = run(['cursor', 'set', '--phase', '1', '--status', 'planned',
    '--next', pointer, '--total', '4'], inlineDir);
  const b = run(['cursor', 'set', '--phase', '1', '--status', 'planned',
    '--next-file', src, '--total', '4'], fileDir);
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  assert.equal(readFileSync(join(fileDir, 'STATE.md'), 'utf8'),
    readFileSync(join(inlineDir, 'STATE.md'), 'utf8'));
  assert.equal(run(['cursor', 'get'], fileDir).next, pointer);
});

test('cursor set: a --next-file value no shell could expand lands verbatim', () => {
  const dir = makeTree({ roadmap: [{ n: 1, name: 'Foundation' }] });
  const pointer = '/cad-execute 1 after $(touch /tmp/cad-cursor-should-not-exist) and `id`';
  const src = join(dir, 'next.txt');
  writeFileSync(src, pointer);
  const r = run(['cursor', 'set', '--phase', '1', '--status', 'planned',
    '--next-file', src, '--total', '4'], dir);
  assert.equal(r.ok, true);
  assert.equal(run(['cursor', 'get'], dir).next, pointer);
  assert.equal(existsSync('/tmp/cad-cursor-should-not-exist'), false, 'the payload executed');
});

test('cursor set: a TWO-LINE --next-file is bad-args - the cursor is four lines', () => {
  const dir = makeTree({ roadmap: [{ n: 1, name: 'Foundation' }] });
  const seed = run(['cursor', 'set', '--phase', '1', '--status', 'planned',
    '--next', '/cad-execute 1', '--total', '4'], dir);
  assert.equal(seed.ok, true);
  const before = readFileSync(join(dir, 'STATE.md'), 'utf8');
  const src = join(dir, 'next.txt');
  writeFileSync(src, 'resume at task 3\nand mind the reader');
  const r = run(['cursor', 'set', '--phase', '1', '--status', 'planned',
    '--next-file', src, '--total', '4'], dir);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'bad-args');
  assert.match(r.detail, /newline/);
  assert.equal(readFileSync(join(dir, 'STATE.md'), 'utf8'), before);
  // The regression this refusal exists against: a fifth line the parser cannot
  // read back, which would make the very next `cursor get` unparseable.
  assert.equal(run(['cursor', 'get'], dir).ok, true);
});

test('cursor set: every --next-file refusal is bad-args, STATE.md byte-unchanged', () => {
  const dir = makeTree({ roadmap: [{ n: 1, name: 'Foundation' }] });
  run(['cursor', 'set', '--phase', '1', '--status', 'planned',
    '--next', '/cad-execute 1', '--total', '4'], dir);
  const before = readFileSync(join(dir, 'STATE.md'), 'utf8');
  const write = (name, body) => {
    const f = join(dir, name);
    writeFileSync(f, body);
    return f;
  };
  const good = write('next.txt', '/cad-execute 1');
  const cases = [
    { name: 'valueless', args: ['--next-file'] },
    { name: 'missing path', args: ['--next-file', join(dir, 'absent.txt')] },
    { name: 'empty file', args: ['--next-file', write('blank.txt', '\n \n')] },
    { name: 'both forms', args: ['--next', '/cad-execute 1', '--next-file', good] },
  ];
  const locked = write('locked.txt', '/cad-execute 1');
  chmodSync(locked, 0o000);
  try {
    try { accessSync(locked, constants.R_OK); } catch {
      cases.push({ name: 'unreadable path', args: ['--next-file', locked] });
    }
    for (const c of cases) {
      const r = run(['cursor', 'set', '--phase', '1', '--status', 'planned',
        ...c.args, '--total', '4'], dir);
      assert.equal(r.ok, false, c.name);
      assert.equal(r.reason, 'bad-args', c.name);
      assert.equal(readFileSync(join(dir, 'STATE.md'), 'utf8'), before, `${c.name} wrote`);
    }
  } finally {
    chmodSync(locked, 0o600);
  }
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

// `--n "$PHASE"` with PHASE unset: parseArgs mints `true`, `Number(true)` is 1,
// and phase 1 was boxed complete with its rows flipped, ok:true.
for (const [name, arg] of [['valueless', null], ['abc', 'abc'], ['empty string', '']]) {
  test(`phase-done: a ${name} --n refuses; neither doc is written`, () => {
    const dir = makeTree({
      roadmap: [{ n: 1, name: 'One' }, { n: 2, name: 'Two' }],
      reqs: [['REQ-1', 1, 'Pending']],
    });
    const roadmapBefore = readFileSync(join(dir, 'ROADMAP.md'), 'utf8');
    const reqsBefore = readFileSync(join(dir, 'REQUIREMENTS.md'), 'utf8');
    const r = run(['phase-done', ...(arg === null ? ['--n'] : ['--n', arg])], dir);
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'bad-args');
    assert.match(r.detail, /--n/);
    assert.equal(readFileSync(join(dir, 'ROADMAP.md'), 'utf8'), roadmapBefore);
    assert.equal(readFileSync(join(dir, 'REQUIREMENTS.md'), 'utf8'), reqsBefore);
  });
}

// The guard reads `.value`, not `.raw` (D-11): a zero-padded phase must stay
// the phase it names rather than regressing to unknown-phase.
test('phase-done: --n 02 still boxes phase 2', () => {
  const dir = makeTree({
    roadmap: [{ n: 1, name: 'One' }, { n: 2, name: 'Two' }],
    reqs: [['REQ-2', 2, 'Pending']],
  });
  const r = run(['phase-done', '--n', '02'], dir);
  assert.equal(r.ok, true);
  assert.deepEqual(r.reqs, ['REQ-2']);
  const roadmap = readFileSync(join(dir, 'ROADMAP.md'), 'utf8');
  assert.match(roadmap, /- \[x\] \*\*Phase 2: Two\*\*/);
  assert.match(roadmap, /- \[ \] \*\*Phase 1: One\*\*/);
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

// `--item "$K"` with K unset: parseArgs mints `true`, `Number(true)` is 1, and
// item 1 was recorded pass - permanently, once first_pass is set.
for (const [name, arg] of [['valueless', null], ['abc', 'abc'], ['empty string', '']]) {
  test(`uat record: a ${name} --item refuses; UAT.md is byte-unchanged`, () => {
    const dir = uatTree();
    const before = readFileSync(join(dir, 'phases', '1', 'UAT.md'), 'utf8');
    const r = run(['uat', 'record', '--phase', '1',
      ...(arg === null ? ['--item'] : ['--item', arg]), '--result', 'pass'], dir);
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'bad-args');
    assert.match(r.detail, /--item/);
    assert.equal(readFileSync(join(dir, 'phases', '1', 'UAT.md'), 'utf8'), before);
  });
}

test('uat record: a clean integer naming no item still answers unknown-item', () => {
  const dir = uatTree();
  const r = run(['uat', 'record', '--phase', '1', '--item', '99', '--result', 'pass'], dir);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'unknown-item');
});

test('uat record: a normal --item still records, with counts and first_pass', () => {
  const dir = uatTree();
  const r = run(['uat', 'record', '--phase', '1', '--item', '1', '--result', 'pass'], dir);
  assert.equal(r.ok, true);
  assert.deepEqual(r.item, { k: 1, status: 'pass' });
  assert.equal(r.counts.pass, 1);
  assert.match(readFileSync(join(dir, 'phases', '1', 'UAT.md'), 'utf8'), /first_pass: pass/);
});

// --- uat record --fields-file: the free-text fields through the path transport
//
// Every one of the five is caller-derived - a failing item's reason, what the
// user reported, the cause, the fix, the evidence - so the inline form puts
// that prose in a double-quoted shell word where `$(...)` executes before Node
// starts. ONE flag holding a JSON object, never per-field files (D-05).

/** The five free-text fields, as one object and as inline flag pairs. */
const FIVE_FIELDS = {
  reason: 'the redirect never fires',
  reported: 'user sees a blank page',
  cause: 'the session cookie is dropped',
  fix: 'abc1234, retest',
  evidence: '.planning/phases/1/FINDINGS.json',
};
const FIVE_INLINE = Object.entries(FIVE_FIELDS).flatMap(([k, v]) => [`--${k}`, v]);
const uatBytes = (dir) => readFileSync(join(dir, 'phases', '1', 'UAT.md'), 'utf8');

test('uat record: --fields-file writes the SAME UAT.md the five inline flags write', () => {
  const inlineDir = uatTree();
  const fileDir = uatTree();
  const a = run(['uat', 'record', '--phase', '1', '--item', '1', '--result', 'fail',
    ...FIVE_INLINE], inlineDir);
  const src = join(fileDir, 'fields.json');
  writeFileSync(src, JSON.stringify(FIVE_FIELDS));
  const b = run(['uat', 'record', '--phase', '1', '--item', '1', '--result', 'fail',
    '--fields-file', src], fileDir);
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  // Byte-identical, so a field the reader silently dropped fails this row
  // rather than passing it.
  assert.equal(uatBytes(fileDir), uatBytes(inlineDir));
  for (const value of Object.values(FIVE_FIELDS)) {
    assert.ok(uatBytes(fileDir).includes(value), `"${value}" never reached the file`);
  }
});

test('uat record: a --fields-file value no shell could expand lands verbatim', () => {
  const dir = uatTree();
  const src = join(dir, 'fields.json');
  const reason = 'it printed $(touch /tmp/cad-uat-should-not-exist) and `id`';
  writeFileSync(src, JSON.stringify({ reason }));
  const r = run(['uat', 'record', '--phase', '1', '--item', '1', '--result', 'fail',
    '--fields-file', src], dir);
  assert.equal(r.ok, true);
  assert.ok(uatBytes(dir).includes(reason), 'the reason did not land verbatim');
  assert.equal(existsSync('/tmp/cad-uat-should-not-exist'), false, 'the payload executed');
});

test('uat record: every --fields-file refusal is bad-args, UAT.md byte-unchanged', () => {
  const dir = uatTree();
  const before = uatBytes(dir);
  const write = (name, body) => {
    const f = join(dir, name);
    writeFileSync(f, body);
    return f;
  };
  const good = write('good.json', JSON.stringify({ reason: 'from the file' }));
  const cases = [
    { name: 'valueless', args: ['--fields-file'] },
    { name: 'missing path', args: ['--fields-file', join(dir, 'absent.json')] },
    { name: 'empty file', args: ['--fields-file', write('blank.json', '\n \n')] },
    { name: 'not JSON', args: ['--fields-file', write('bad.json', 'reason: x')] },
    // A JSON ARRAY parses, and `typeof [] === 'object'` - the arm that catches it.
    { name: 'a JSON array', args: ['--fields-file', write('arr.json', '[{"reason":"x"}]')] },
    { name: 'a non-string value', args: ['--fields-file', write('num.json', '{"reason":3}')] },
    // Refused rather than dropped: `severity` is enum-validated at its own
    // guard, so admitting it here would route it around that guard.
    { name: 'an out-of-set key', args: ['--fields-file', write('sev.json', '{"severity":"high"}')] },
    { name: 'a field given both ways', args: ['--reason', 'from the flag', '--fields-file', good] },
  ];
  // The unreadable arm, unless the suite runs as root (mode bits assert nothing).
  const locked = write('locked.json', JSON.stringify({ reason: 'x' }));
  chmodSync(locked, 0o000);
  try {
    try { accessSync(locked, constants.R_OK); } catch {
      cases.push({ name: 'unreadable path', args: ['--fields-file', locked] });
    }
    for (const c of cases) {
      const r = run(['uat', 'record', '--phase', '1', '--item', '1', '--result', 'fail',
        ...c.args], dir);
      assert.equal(r.ok, false, c.name);
      assert.equal(r.reason, 'bad-args', c.name);
      assert.equal(uatBytes(dir), before, `${c.name} wrote to UAT.md`);
    }
  } finally {
    chmodSync(locked, 0o600);
  }
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

// The walk's own provenance. `source` accepted any string and stored nothing
// outside `verifier`, so a check the MODEL ran and cited was written to disk as
// a user answer with nothing reporting the drop - registration is what makes
// the value survive, not merely writing it.
test('uat record --source model: stores the provenance and it survives a later record', () => {
  const dir = uatTree();
  const r = run(['uat', 'record', '--phase', '1', '--item', '1', '--result', 'pass',
    '--evidence', 'node --test x.test.mjs -> 12 pass 0 fail', '--source', 'model'], dir);
  assert.equal(r.ok, true);
  const text = readFileSync(join(dir, 'phases', '1', 'UAT.md'), 'utf8');
  assert.match(text, /### 1\. Login works\nexpected: [^\n]*\nstatus: pass\nfirst_pass: pass\nsource: model/);
  // ...and the whole-file rewrite a record on a DIFFERENT item performs keeps it
  run(['uat', 'record', '--phase', '1', '--item', '2', '--result', 'pass'], dir);
  const after = readFileSync(join(dir, 'phases', '1', 'UAT.md'), 'utf8');
  assert.match(after, /source: model/);
  assert.equal(after.match(/source:/g).length, 1); // item 2's user answer wrote none
});

test('uat record: an out-of-enum --source is refused with the file byte-unchanged', () => {
  const dir = uatTree();
  const before = readFileSync(join(dir, 'phases', '1', 'UAT.md'), 'utf8');
  const r = run(['uat', 'record', '--phase', '1', '--item', '1', '--result', 'pass',
    '--source', 'bogus'], dir);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'bad-args');
  assert.match(r.detail, /user \| verifier \| model/);
  assert.equal(readFileSync(join(dir, 'phases', '1', 'UAT.md'), 'utf8'), before);
});

test('uat record --source user: writes no source line - user stays implicit', () => {
  const dir = uatTree();
  const r = run(['uat', 'record', '--phase', '1', '--item', '1', '--result', 'pass',
    '--source', 'user'], dir);
  assert.equal(r.ok, true);
  const text = readFileSync(join(dir, 'phases', '1', 'UAT.md'), 'utf8');
  assert.equal(/source:/.test(text), false);
});

// `why_human` is the verifier's per-item reason the walk reads as already
// judged. It reached UAT.md through no path at all before: `merge` appended the
// human check without it, so the walk had to re-judge every item the deep pass
// had already ruled on.
test('uat merge: a human_checks why_human is carried onto the appended item and survives', () => {
  const dir = uatTree();
  const r = run(['uat', 'merge', '--phase', '1'], dir, JSON.stringify({
    human_checks: [
      { name: 'Card charges', expected: 'receipt emailed', why_human: 'moves real money' },
      { name: 'Prints on the label printer', expected: 'label ejects' }, // no reason given
    ],
  }));
  assert.equal(r.ok, true);
  assert.equal(r.added, 2);
  const text = readFileSync(join(dir, 'phases', '1', 'UAT.md'), 'utf8');
  assert.match(text, /### 3\. Card charges\nexpected: receipt emailed\norigin: verifier\nwhy_human: moves real money\nstatus: pending/);
  // no default is invented for the entry that carried none
  assert.match(text, /### 4\. Prints on the label printer\nexpected: label ejects\norigin: verifier\nstatus: pending/);
  // ...and the first `record` rewrite preserves it - registration, not luck
  run(['uat', 'record', '--phase', '1', '--item', '3', '--result', 'pass'], dir);
  const after = readFileSync(join(dir, 'phases', '1', 'UAT.md'), 'utf8');
  assert.match(after, /why_human: moves real money/);
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

// The repair the `fieldless-checklist` diagnostic routes users to. `--origin` is
// not a substitute: on a fieldless checklist it writes `origin: criterion`,
// which names no id, disqualifies the phase from the legacy rule and converts
// zero breaks into one per criterion with no seam able to add the link back.
test('uat record --criterion: restores a dropped link in the registered field position', () => {
  const dir = uatTree(); // no criterion on either item
  const r = run(['uat', 'record', '--phase', '1', '--item', '1', '--result', 'pass',
    '--criterion', 'AC9'], dir);
  assert.equal(r.ok, true);
  assert.match(uatText(dir),
    /### 1\. Login works\nexpected: user lands on dashboard\ncriterion: AC9\nstatus: pass/);
  assert.equal(uatText(dir).match(/^criterion: AC9$/gm).length, 1); // no duplicate line
});

test('uat record: an out-of-shape --criterion is refused by name, file byte-unchanged', () => {
  const dir = linkedTree();
  for (const bad of ['AC-1', 'ac1']) {
    const before = uatText(dir);
    const r = run(['uat', 'record', '--phase', '1', '--item', '1', '--result', 'pass',
      '--criterion', bad], dir);
    assert.equal(r.ok, false, bad);
    assert.equal(r.reason, 'bad-args', bad);
    assert.match(r.detail, /AC<N>/);
    assert.ok(r.detail.includes(bad), `detail names the received value ${bad}`);
    assert.equal(uatText(dir), before, bad);
  }
  // A flag given with no value parses as boolean `true`, and the same test
  // refuses it - the value never reaches the file as the string "true".
  const before = uatText(dir);
  const bare = run(['uat', 'record', '--phase', '1', '--item', '1', '--result', 'pass',
    '--criterion'], dir);
  assert.equal(bare.ok, false);
  assert.equal(bare.reason, 'bad-args');
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

// --- FINDINGS.json: the discarded half of the merge, made recoverable --------
// The verifier is contractually read-only and its dispatch ends with its
// report, so the envelope has to be persisted by the seam that computed it
// (D-09) or it is gone. A NEW file, not a UAT.md section: a `## ` block is cut
// by the next `uat record` and a `### ` extra is promised user-owned (D-05).

const findingsFile = (dir) => join(dir, 'phases', '1', 'FINDINGS.json');
const readFindings = (dir) => JSON.parse(readFileSync(findingsFile(dir), 'utf8'));

test('uat merge: FINDINGS.json holds the five counters plus every discarded entry', () => {
  const dir = uatTree();
  run(['uat', 'record', '--phase', '1', '--item', '1', '--result', 'pass'], dir);
  const r = run(['uat', 'merge', '--phase', '1'], dir, JSON.stringify({
    passes: [{ k: 1, evidence: 'x' }],          // conflicts with the user result
    gaps: [{ reason: 'no k, no name' }],        // nothing to name a heading with
    human_checks: [{ expected: 'nameless' }],   // the identical phantom
  }));
  assert.equal(r.ok, true);
  assert.equal(r.findings, 'phases/1/FINDINGS.json'); // observable in the transcript
  const found = readFindings(dir);
  assert.deepEqual(Object.keys(found), ['auto_passed', 'gaps', 'added', 'skipped',
    'rejected', 'rejected_entries', 'skipped_entries']);
  assert.deepEqual(found, {
    auto_passed: 0, gaps: 0, added: 0, skipped: 1, rejected: 2,
    rejected_entries: [
      { list: 'gaps', reason: 'no-usable-name', entry: { reason: 'no k, no name' } },
      { list: 'human_checks', reason: 'no-usable-name', entry: { expected: 'nameless' } },
    ],
    // the matched item's k and its status AT THE TIME OF THE CONFLICT
    skipped_entries: [
      { list: 'passes', reason: 'already-recorded', item: 1, status: 'pass',
        entry: { k: 1, evidence: 'x' } },
    ],
  });
  // Diffable by a reviewer: pretty-printed, one trailing newline.
  assert.match(readFileSync(findingsFile(dir), 'utf8'), /\n {2}"auto_passed": 0,\n/);
  assert.match(readFileSync(findingsFile(dir), 'utf8'), /}\n$/);
});

// The counting gap at the bare `continue` is deferred (D-14), so no counter
// moves - but the ENTRY still lands, or the file whose purpose is making a
// discarded finding recoverable would be the one place one disappears.
test('uat merge: a human_check matching an existing item is recorded while its counter stays deferred', () => {
  const dir = uatTree();
  const r = run(['uat', 'merge', '--phase', '1'], dir, JSON.stringify({
    human_checks: [{ name: 'Login works', expected: 'user lands on dashboard' }],
  }));
  assert.equal(r.ok, true);
  assert.equal(r.skipped, 0);   // still deferred, deliberately
  assert.equal(r.rejected, 0);
  assert.equal(r.added, 0);
  const found = readFindings(dir);
  assert.equal(found.skipped, 0);
  assert.deepEqual(found.skipped_entries, [
    { list: 'human_checks', reason: 'already-recorded', item: 1, status: 'pending',
      entry: { name: 'Login works', expected: 'user lands on dashboard' } },
  ]);
});

// Written on EVERY successful merge, so its ABSENCE means no merge ran.
test('uat merge: a clean payload still writes FINDINGS.json, both arrays empty', () => {
  const dir = uatTree();
  const r = run(['uat', 'merge', '--phase', '1'], dir,
    JSON.stringify({ passes: [{ k: 1, evidence: 'ok' }] }));
  assert.equal(r.ok, true);
  assert.equal(r.auto_passed, 1);
  assert.deepEqual(readFindings(dir), {
    auto_passed: 1, gaps: 0, added: 0, skipped: 0, rejected: 0,
    rejected_entries: [], skipped_entries: [],
  });
});

// The failure mode a `## Verifier findings` section would have had: looks
// durable, silently cut by the next rewrite. Raw bytes, not a reparse.
test('uat merge: a later uat record leaves FINDINGS.json byte-identical', () => {
  const dir = uatTree();
  run(['uat', 'merge', '--phase', '1'], dir,
    JSON.stringify({ gaps: [{ reason: 'nameless' }] }));
  const before = readFileSync(findingsFile(dir));
  run(['uat', 'record', '--phase', '1', '--item', '1', '--result', 'pass'], dir);
  assert.deepEqual(readFileSync(findingsFile(dir)), before);
});

test('uat merge: a second merge replaces the file with the second merge envelope', () => {
  const dir = uatTree();
  run(['uat', 'merge', '--phase', '1'], dir,
    JSON.stringify({ gaps: [{ reason: 'nameless' }, { reason: 'also nameless' }] }));
  assert.equal(readFindings(dir).rejected, 2);
  run(['uat', 'merge', '--phase', '1'], dir,
    JSON.stringify({ passes: [{ k: 1, evidence: 'ok' }] }));
  const found = readFindings(dir);
  assert.equal(found.rejected, 0);       // replaced, never accumulated
  assert.equal(found.auto_passed, 1);
  assert.deepEqual(found.rejected_entries, []);
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

// --- uat merge --payload <file>: the envelope refusals (D-07) -----------------
//
// One test() per row (the convention and its reason are at
// retired-keys.test.mjs:4-6). Every failing row asserts ok:false, the exact
// reason, exit 1, and a byte-identical UAT.md - a refusal that still rewrote
// the checklist would be worse than the hole it closes.

/** Write `text` to a scratch payload file inside the fixture and return it. */
function payloadFile(dir, text) {
  const p = join(dir, 'payload.json');
  writeFileSync(p, text);
  return p;
}

/** Run a merge expected to refuse, asserting UAT.md never moved. */
function refusedMerge(dir, args) {
  const file = join(dir, 'phases', '1', 'UAT.md');
  const before = readFileSync(file);
  const r = run(['uat', 'merge', '--phase', '1', ...args], dir);
  assert.deepEqual(readFileSync(file), before, 'UAT.md must be byte-identical');
  return r;
}

test('uat merge: a --payload path that does not exist is no-payload', () => {
  const dir = uatTree();
  const r = refusedMerge(dir, ['--payload', join(dir, 'nope.json')]);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'no-payload');
  assert.equal(r._exit, 1);
});

test('uat merge: an empty --payload file is no-payload', () => {
  const dir = uatTree();
  const r = refusedMerge(dir, ['--payload', payloadFile(dir, '')]);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'no-payload');
  assert.equal(r._exit, 1);
});

test('uat merge: a whitespace-only --payload file is no-payload', () => {
  const dir = uatTree();
  const r = refusedMerge(dir, ['--payload', payloadFile(dir, '  \n\t\n')]);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'no-payload');
  assert.equal(r._exit, 1);
});

// The sentinel collision, from the outside: this exact input used to exit 0
// printing NOTHING at all, which `run()` cannot even parse.
test('uat merge: a --payload file holding null is bad-payload, not silence', () => {
  const dir = uatTree();
  const r = refusedMerge(dir, ['--payload', payloadFile(dir, 'null')]);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'bad-payload');
  assert.equal(r._exit, 1);
});

test('uat merge: a --payload file holding a bare string is bad-payload', () => {
  const dir = uatTree();
  const r = refusedMerge(dir, ['--payload', payloadFile(dir, '"hello"')]);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'bad-payload');
  assert.equal(r._exit, 1);
});

// The all-zero ok:true hole: a truncated findings file reporting a clean pass.
test('uat merge: a --payload file holding {} is bad-payload, not an all-zero success', () => {
  const dir = uatTree();
  const r = refusedMerge(dir, ['--payload', payloadFile(dir, '{}')]);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'bad-payload');
  assert.equal(r._exit, 1);
});

test('uat merge: a --payload file holding a JSON array is bad-payload', () => {
  const dir = uatTree();
  const r = refusedMerge(dir, ['--payload', payloadFile(dir, '[{"k":1}]')]);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'bad-payload');
  assert.equal(r._exit, 1);
});

// A sibling list that is present but not an array. The disjunction proves only
// that ONE of the three is an array, so before this each of these merged
// ok:true while the string was iterated per character.
for (const [key, body] of [
  ['gaps', '{"passes":[],"gaps":"oops","human_checks":[]}'],
  ['passes', '{"passes":"oops","gaps":[]}'],
  ['human_checks', '{"gaps":[],"human_checks":42}'],
]) {
  test(`uat merge: ${key} present but not an array is bad-payload`, () => {
    // refusedMerge asserts UAT.md is byte-identical across the call.
    const dir = uatTree();
    const r = refusedMerge(dir, ['--payload', payloadFile(dir, body)]);
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'bad-payload');
    assert.equal(r.detail, `${key} is present but not an array`);
    assert.equal(r._exit, 1);
  });
}

test('uat merge: an omitted list is not a malformed one', () => {
  // Presence, not truthiness - `{"gaps":[...]}` alone stays legal.
  const dir = uatTree();
  const r = run(['uat', 'merge', '--phase', '1', '--payload',
    payloadFile(dir, '{"gaps":[{"name":"only gaps","reason":"r","evidence":"e"}]}')], dir);
  assert.equal(r.ok, true);
  assert.equal(r.added, 1);
});

test('uat merge: --payload with no path refuses, never a read of fd 1', () => {
  // The invariant is that a valueless `--payload` never falls through to a read
  // of fd 1. It is answered EARLIER now, and by a different vocabulary: the
  // declared row refuses the bare spelling at the dispatch door, which names
  // `bad-args` because this file has one refusal vocabulary (D-07). The
  // `no-payload` arm is still what answers a path that is missing, unreadable
  // or empty - the spellings a declaration cannot judge - and the code reaches
  // no prose surface, so nothing branches on which of the two fires here.
  const dir = uatTree();
  const r = refusedMerge(dir, ['--payload']);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'bad-args');
  assert.match(r.detail, /--payload/);
  assert.equal(r._exit, 1);
});

// The positive row: the flag is a TRANSPORT change and nothing else.
test('uat merge: --payload <file> and stdin merge identically', () => {
  const findings = JSON.stringify({
    passes: [{ k: 1, evidence: 'cli run' }],
    gaps: [{ name: 'New gap', reason: 'unwired', severity: 'major' }],
    human_checks: [{ name: 'looks right', expected: 'green' }],
  });
  const viaStdin = uatTree();
  const a = run(['uat', 'merge', '--phase', '1'], viaStdin, findings);
  const viaFile = uatTree();
  const b = run(['uat', 'merge', '--phase', '1',
    '--payload', payloadFile(viaFile, findings)], viaFile);

  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  for (const key of ['auto_passed', 'gaps', 'added', 'skipped', 'rejected']) {
    assert.equal(b[key], a[key], key);
  }
  assert.equal(readFileSync(join(viaFile, 'phases', '1', 'UAT.md'), 'utf8'),
    readFileSync(join(viaStdin, 'phases', '1', 'UAT.md'), 'utf8'));
});

// The envelope rule is a DISJUNCTION - ANY ONE of the three arrays is a
// legitimate payload - and nothing above pins that. Every refusal row carries
// no array at all and the transport row carries all three, so mutating the
// `&&` chain in planning.mjs to `||` passes the entire suite while wrongly
// refusing the ordinary findings file of a verifier that found only passes,
// only gaps, or only human checks. One row per array closes that.

test('uat merge: a payload carrying ONLY passes merges', () => {
  const dir = uatTree();
  const r = run(['uat', 'merge', '--phase', '1', '--payload',
    payloadFile(dir, JSON.stringify({ passes: [{ k: 1, evidence: 'cli run' }] }))], dir);
  assert.equal(r.ok, true);
  assert.equal(r.auto_passed, 1);
  assert.equal(r.added, 0);
  assert.match(readFileSync(join(dir, 'phases', '1', 'UAT.md'), 'utf8'), /cli run/);
});

test('uat merge: a payload carrying ONLY gaps merges', () => {
  const dir = uatTree();
  const r = run(['uat', 'merge', '--phase', '1', '--payload',
    payloadFile(dir, JSON.stringify({
      gaps: [{ name: 'New gap', reason: 'unwired', severity: 'major' }],
    }))], dir);
  assert.equal(r.ok, true);
  assert.equal(r.gaps, 1);
  assert.equal(r.added, 1);
  assert.equal(r.auto_passed, 0);
});

test('uat merge: a payload carrying ONLY human_checks merges', () => {
  const dir = uatTree();
  const r = run(['uat', 'merge', '--phase', '1', '--payload',
    payloadFile(dir, JSON.stringify({
      human_checks: [{ name: 'looks right', expected: 'green' }],
    }))], dir);
  assert.equal(r.ok, true);
  assert.equal(r.added, 1);
  assert.equal(r.gaps, 0);
});

// init/refresh share the reader, so the sentinel fix must not have left them
// exiting 0 in silence on the same input.
test('uat init: a literal null on stdin is bad-payload, not silence', () => {
  const dir = makeTree({ roadmap: [{ n: 1, name: 'Only' }], phases: { 1: { plan: true } } });
  const r = run(['uat', 'init', '--phase', '1'], dir, 'null');
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'bad-payload');
  assert.equal(r._exit, 1);
});

test('uat refresh: a literal null on stdin is bad-payload, not silence', () => {
  const dir = uatTree();
  const r = run(['uat', 'refresh', '--phase', '1'], dir, 'null');
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'bad-payload');
  assert.equal(r._exit, 1);
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

// --- plan-size: the two counts that were soft until v2.7.0 --------------------

/** A phase whose ROADMAP detail block names `ids`, plus `plans` of N tasks. */
function sizeTree(ids, plans) {
  const dir = makeTree({ roadmap: [{ n: 1, name: 'One' }] });
  if (ids) {
    const rm = readFileSync(join(dir, 'ROADMAP.md'), 'utf8')
      .replace('**Goal:** goal 1\n', `**Goal:** goal 1\n**Requirements:** ${ids.join(', ')}\n`);
    writeFileSync(join(dir, 'ROADMAP.md'), rm);
  }
  const pdir = join(dir, 'phases', '1');
  mkdirSync(pdir, { recursive: true });
  for (const [file, n] of Object.entries(plans || {})) {
    const tasks = Array.from({ length: n }, (_, i) =>
      `### Task ${i + 1}: do ${i + 1}\n\n- **Files:** src/a.rs\n`).join('\n');
    writeFileSync(join(pdir, file), `# Plan\n\n## Tasks\n\n${tasks}`);
  }
  return dir;
}

test('plan-size: counts the requirements a ROADMAP detail block names, deduped', () => {
  const dir = sizeTree(['STOR-01', 'STOR-02', 'STOR-02', 'IDENT-01'], {});
  const r = run(['plan-size', '--phase', '1'], dir);
  assert.equal(r.ok, true);
  assert.equal(r.requirements_found, true);
  assert.equal(r.requirements, 3, JSON.stringify(r.requirement_ids));
});

test('plan-size: a phase over --max-reqs is phase-too-big, naming both numbers', () => {
  const dir = sizeTree(['STOR-01', 'STOR-02', 'STOR-03', 'STOR-04'], {});
  const r = run(['plan-size', '--phase', '1', '--max-reqs', '3'], dir);
  assert.equal(r.within, false);
  const hit = r.over.find((o) => o.kind === 'phase-too-big');
  assert.ok(hit, JSON.stringify(r.over));
  assert.equal(hit.measured, 4);
  assert.equal(hit.ceiling, 3);
});

test('plan-size: NO detail block is unmeasured, never zero - it is not compared', () => {
  // The whole point of `requirements_found`. A count of 0 is under every
  // ceiling, so an unwritten roadmap would otherwise read as a small phase.
  const dir = sizeTree(null, {});
  const r = run(['plan-size', '--phase', '1', '--max-reqs', '3'], dir);
  assert.equal(r.requirements_found, false);
  assert.equal(r.requirements, 0);
  assert.deepEqual(r.over, []);
  // No ceiling ran, so there is no verdict to report: `within: true` here was
  // a clean bill of health for a comparison that never happened.
  assert.deepEqual(r.compared, []);
  assert.equal(r.within, null);
});

test('plan-size: the task ceiling is PER PLAN - 4+4+4 against a ceiling of 4 is within', () => {
  // The ambiguity this seam settled: `max_plan_tasks` is named per plan while
  // the workflow said "delivering this phase". A phase splitting into three
  // conforming plans is the move the ceiling is meant to produce.
  const dir = sizeTree(['STOR-01'], { 'PLAN-1.md': 4, 'PLAN-2.md': 4, 'PLAN-3.md': 4 });
  const r = run(['plan-size', '--phase', '1', '--max-tasks', '4'], dir);
  assert.equal(r.tasks, 12);
  assert.deepEqual(r.over, []);
  assert.equal(r.within, true);
});

test('plan-size: ONE plan over the ceiling is flagged, naming the plan file', () => {
  const dir = sizeTree(['STOR-01'], { 'PLAN-1.md': 3, 'PLAN-2.md': 8 });
  const r = run(['plan-size', '--phase', '1', '--max-tasks', '4'], dir);
  const hit = r.over.find((o) => o.kind === 'plan-too-many-tasks');
  assert.ok(hit, JSON.stringify(r.over));
  assert.equal(hit.plan, 'PLAN-2.md');
  assert.equal(hit.measured, 8);
  assert.equal(r.over.filter((o) => o.kind === 'plan-too-many-tasks').length, 1);
});

test('plan-size: an unwritten plan is never over its ceiling', () => {
  const dir = sizeTree(['STOR-01'], {});
  const r = run(['plan-size', '--phase', '1', '--max-tasks', '1'], dir);
  assert.equal(r.tasks, 0);
  assert.deepEqual(r.plans, []);
  assert.deepEqual(r.over, []);
});

test('plan-size: no ceiling flags nothing but still reports the counts', () => {
  const dir = sizeTree(['STOR-01', 'STOR-02'], { 'PLAN.md': 9 });
  const r = run(['plan-size', '--phase', '1'], dir);
  assert.equal(r.requirements, 2);
  assert.equal(r.tasks, 9);
  assert.deepEqual(r.over, []);
  assert.equal(r.max_tasks, undefined);
});

test('plan-size: a missing --phase is bad-args, never the cursor', () => {
  const dir = sizeTree(['STOR-01'], {});
  assert.equal(run(['plan-size'], dir).reason, 'bad-args');
  assert.equal(run(['plan-size', '--phase', 'x'], dir).reason, 'bad-args');
});

// --- criteria-size: the criteria ceilings three workflows only stated --------
// The prose said 3-7 and 2-5 and nothing counted either. Both grammars are
// asserted here, including the two live roadmap heading spellings, because a
// parser anchored to the template alone would report "declared nothing" for
// every phase of this repo's own roadmap - and, absence not being zero, would
// say so in silence.

/**
 * A roadmap whose phase `i+1` declares `roadmapCounts[i]` criteria under
 * `spelling`, plus a CONTEXT.md carrying `contexts[n]` acceptance criteria for
 * each phase named there (a phase absent from `contexts` gets no CONTEXT.md).
 */
function criteriaTree(roadmapCounts, spelling, contexts = {}) {
  const dir = makeTree({
    roadmap: roadmapCounts.map((_, i) => ({ n: i + 1, name: `P${i + 1}` })),
  });
  let rm = readFileSync(join(dir, 'ROADMAP.md'), 'utf8');
  roadmapCounts.forEach((count, i) => {
    const list = Array.from({ length: count }, (_, k) => `${k + 1}. criterion ${k + 1}`).join('\n');
    rm = rm.replace(`### Phase ${i + 1}: P${i + 1}\n`,
      `### Phase ${i + 1}: P${i + 1}\n${spelling}\n${list}\n`);
  });
  writeFileSync(join(dir, 'ROADMAP.md'), rm);
  for (const [n, count] of Object.entries(contexts)) {
    const pdir = join(dir, 'phases', n);
    mkdirSync(pdir, { recursive: true });
    const items = Array.from({ length: count }, (_, k) => `- [ ] AC${k + 1}: does thing ${k + 1}`);
    writeFileSync(join(pdir, 'CONTEXT.md'),
      `# Phase ${n} Context\n\n## Acceptance criteria\n\n${items.join('\n')}\n`);
  }
  return dir;
}

const BOTH_SPELLINGS = ['**Success Criteria:**', 'Success criteria:'];

for (const spelling of BOTH_SPELLINGS) {
  test(`criteria-size: under the floor and over the ceiling are both named, heading \`${spelling}\``, () => {
    // No --phase: every phase the roadmap declares, in one call - what
    // new-project and adopt need at their approval gate.
    const dir = criteriaTree([1, 6, 3], spelling);
    const r = run(['criteria-size', '--roadmap-min', '2', '--roadmap-max', '5'], dir);
    assert.equal(r.ok, true);
    assert.equal(r.within, false);
    assert.deepEqual(r.compared, ['roadmap_min', 'roadmap_max']);
    assert.deepEqual(r.over.map((o) => [o.phase, o.kind, o.measured, o.ceiling]), [
      [1, 'roadmap-criteria-too-few', 1, 2],
      [2, 'roadmap-criteria-too-many', 6, 5],
    ]);
    assert.deepEqual(r.phases.map((p) => [p.phase, p.roadmap_criteria, p.roadmap_found]),
      [[1, 1, true], [2, 6, true], [3, 3, true]]);
  });
}

test('criteria-size: an absent CONTEXT.md is not-found, never compared, and never a pass', () => {
  // The absence-is-not-zero arm on the CONTEXT half: 0 criteria is under every
  // floor, so an unwritten CONTEXT would otherwise read as a phase that failed
  // the ceiling it was never measured against.
  const dir = criteriaTree([3], 'Success criteria:');
  const r = run(['criteria-size', '--phase', '1', '--context-min', '3', '--context-max', '7'], dir);
  assert.equal(r.phases[0].context_found, false);
  assert.equal(r.phases[0].context_criteria, 0);
  assert.deepEqual(r.over, []);
  assert.deepEqual(r.compared, []);
  assert.equal(r.within, null);
});

test('criteria-size: a CONTEXT that declared its criteria IS compared, both bounds', () => {
  const dir = criteriaTree([3, 3], 'Success criteria:', { 1: 2, 2: 5 });
  const r = run(['criteria-size', '--context-min', '3', '--context-max', '7'], dir);
  assert.deepEqual(r.compared, ['context_min', 'context_max']);
  assert.deepEqual(r.over.map((o) => [o.phase, o.kind, o.measured]),
    [[1, 'context-criteria-too-few', 2]]);
  assert.equal(r.within, false);
  assert.equal(r.phases[1].context_criteria, 5);
});

test('criteria-size: no ceiling flags compares nothing and reports within: null', () => {
  const dir = criteriaTree([1, 9], 'Success criteria:', { 1: 1 });
  const r = run(['criteria-size'], dir);
  assert.equal(r.ok, true);
  assert.deepEqual(r.compared, []);
  assert.equal(r.within, null);
  assert.deepEqual(r.over, []);
  // The counts are still reported - a caller that supplied no bound still
  // learns what is there, exactly as plan-size does.
  assert.deepEqual(r.phases.map((p) => p.roadmap_criteria), [1, 9]);
  assert.equal(r.roadmap_min, undefined);
});

test('criteria-size: a phase with no criteria heading is not-found, and a floor never fires on it', () => {
  const dir = makeTree({ roadmap: [{ n: 1, name: 'P1' }] });
  const r = run(['criteria-size', '--roadmap-min', '2'], dir);
  assert.equal(r.phases[0].roadmap_found, false);
  assert.equal(r.phases[0].roadmap_criteria, 0);
  assert.deepEqual(r.over, []);
  assert.equal(r.within, null);
});

test('criteria-size: a non-integer bound is bad-args, never a coerced comparison', () => {
  const dir = criteriaTree([3], 'Success criteria:');
  assert.equal(run(['criteria-size', '--roadmap-min', 'x'], dir).reason, 'bad-args');
  assert.equal(run(['criteria-size', '--phase', 'x'], dir).reason, 'bad-args');
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

test('audit: a digit-leading category with a letter in it reaches the arithmetic (PRS-02)', () => {
  // `2FA-01` is how a real project spells this, and the head-anchored admission
  // test held it out of `unpicked`, out of `unseeded.active_ids` and out of
  // `counts` entirely - an `## Active` requirement no phase picked up, silently
  // absolving the traceability gate.
  const dir = makeTree({
    roadmap: [{ n: 1, name: 'One' }],
    phases: { 1: { plan: true } },
  });
  writeFileSync(join(dir, 'REQUIREMENTS.md'),
    '# Requirements: Fixture\n\n## Active\n\n- **2FA-01**: two-factor auth\n\n' +
    '## Traceability\n\n| Requirement | Phase | Status |\n|---|---|---|\n\nEmpty.\n');
  const r = run(['audit'], dir);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(r.requirements, [{ id: '2FA-01', break: 'unpicked' }]);
  assert.deepEqual(r.unseeded, { active_ids: ['2FA-01'] });
  assert.deepEqual(r.counts, { total: 1, traced: 0, broken: 1, deferred: 0 });
  assert.equal(r.counts.total, r.counts.traced + r.counts.broken + r.counts.deferred);
  // ...and it is a DECLARATION, so nothing reports it as a non-id bullet.
  assert.equal((r.active_issues || []).length, 0, JSON.stringify(r.active_issues));
});

test('audit: a category with NO letter at all is still a phantom, reported and never counted', () => {
  // The same fixture spelled `2026-08`: a bolded date must not become an admitted
  // requirement id feeding the counts - the phantom `orphans.plan_ids` break this
  // project already paid for once.
  const dir = makeTree({
    roadmap: [{ n: 1, name: 'One' }],
    phases: { 1: { plan: true } },
  });
  writeFileSync(join(dir, 'REQUIREMENTS.md'),
    '# Requirements: Fixture\n\n## Active\n\n- **2026-08**: the August slice\n\n' +
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

// --- audit: version_drift (FRI-03) -------------------------------------------
// The predicate is "the planning docs name a version this repo has ALREADY
// TAGGED, while the cycle under that number is still open". Not `docs !=
// manifest`: no manifest is read at all (D-03), and at tag v2.4.0 this repo's
// manifest agreed with its docs, so a manifest test was silent on issue #87.

/**
 * `makeTree`'s output made a REAL git repo carrying `tags`, with a PROJECT.md
 * whose `### Active` names `version`. Modelled on git-branch.test.mjs's
 * `taggedFixture` and NOT on `leaseRepo`: identity and BOTH config scopes are
 * neutralized in the env, so `git tag` cannot die with `fatal: no tag message?`
 * on a machine carrying a global `tag.gpgsign` / `commit.gpgsign` - this one
 * does. `dir` is the `.planning` dir, so the repo root is one level up.
 * @param {any} spec @param {{version?: string|null, tags?: string[],
 *   roadmapTitle?: string}} opts
 */
const GIT_FIXTURE_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: 'cad', GIT_AUTHOR_EMAIL: 'cad@example.invalid',
  GIT_COMMITTER_NAME: 'cad', GIT_COMMITTER_EMAIL: 'cad@example.invalid',
  GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null',
};

function taggedTree(spec, { version = 'v9.9.0', tags = [], roadmapTitle } = {}) {
  const dir = makeTree(spec);
  if (version !== null) {
    writeFileSync(join(dir, 'PROJECT.md'),
      `# Fixture\n\n## Requirements\n\n### Active\n\n\`${version}\` - the open cycle\n\n### Out of Scope\n`);
  } else {
    writeFileSync(join(dir, 'PROJECT.md'), '# Fixture\n\n## Requirements\n\n### Active\n\nNo version token here.\n\n### Out of Scope\n');
  }
  if (roadmapTitle !== undefined) {
    const text = readFileSync(join(dir, 'ROADMAP.md'), 'utf8');
    writeFileSync(join(dir, 'ROADMAP.md'), text.replace(/^# .*$/m, roadmapTitle));
  }
  const root = dirname(dir);
  const git = (...args) => execFileSync('git', ['-C', root, ...args],
    { stdio: 'ignore', env: GIT_FIXTURE_ENV });
  git('init', '-q');
  git('commit', '--allow-empty', '-q', '-m', 'root');
  for (const t of tags) git('tag', t);
  return dir;
}

/**
 * One roadmap phase; `done` decides whether its artifacts read as complete.
 * Both arms are a CLEAN audit - the plan declares the requirement, so the row
 * traces either way - which is what makes `version_drift` the only key that
 * varies between these fixtures.
 */
const cycleSpec = (done) => ({
  roadmap: [{ n: 1, name: 'One', checked: done }],
  phases: { 1: { plan: true, planReqs: ['AUD-01'], summary: done,
    uat: [{ status: done ? 'pass' : 'pending' }] } },
  reqs: [['AUD-01', 1, done ? 'Complete' : 'Pending']],
});

test('audit: a doc version a tag already carries, with the cycle still open, emits version_drift', () => {
  const dir = taggedTree(cycleSpec(false), { version: 'v9.9.0', tags: ['v9.9.0'] });
  const r = run(['audit'], dir);
  assert.equal(r.ok, true);
  assert.deepEqual(r.version_drift,
    { doc_version: 'v9.9.0', published_as: 'v9.9.0', cycle_state: 'open' });
});

test('audit: the SAME tagged version with every phase complete is the interrupted close, not drift', () => {
  // D-01's exemption: milestone.md tags at step 2 and evolves PROJECT.md at
  // step 4, so a close interrupted between them leaves exactly this on disk.
  // This case is what a tag-only predicate would get wrong.
  const dir = taggedTree(cycleSpec(true), { version: 'v9.9.0', tags: ['v9.9.0'] });
  const r = run(['audit'], dir);
  assert.equal(r.ok, true);
  assert.equal(r.version_drift, undefined);
});

test('audit: a phase whose checklist holds only a blocked item does not hold the cycle open', () => {
  // `blocked` is TERMINAL (verify.md) and `uatComplete` refuses it, so this
  // phase can never derive complete. Under a complete-only exemption the gate
  // would FAIL forever with "complete the close" unreachable as a remedy.
  const dir = taggedTree({
    roadmap: [{ n: 1, name: 'One', checked: true }],
    phases: { 1: { plan: true, planReqs: ['AUD-01'], summary: true,
      uat: [{ status: 'pass' }, { status: 'blocked', reason: 'needs the device' }] } },
    reqs: [['AUD-01', 1, 'Complete']],
  }, { version: 'v9.9.0', tags: ['v9.9.0'] });
  const r = run(['audit'], dir);
  assert.equal(r.ok, true);
  assert.equal(r.version_drift, undefined);
});

test('audit: one still-answerable item beside a blocked one keeps the cycle open', () => {
  // The complement of the case above: `pending` is what "still being worked
  // under a published number" looks like, and the blocked item beside it
  // changes nothing.
  const dir = taggedTree({
    roadmap: [{ n: 1, name: 'One', checked: false }],
    phases: { 1: { plan: true, planReqs: ['AUD-01'], summary: true,
      uat: [{ status: 'pending' }, { status: 'blocked', reason: 'needs the device' }] } },
    reqs: [['AUD-01', 1, 'Pending']],
  }, { version: 'v9.9.0', tags: ['v9.9.0'] });
  const r = run(['audit'], dir);
  assert.equal(r.ok, true);
  assert.deepEqual(r.version_drift,
    { doc_version: 'v9.9.0', published_as: 'v9.9.0', cycle_state: 'open' });
});

test('audit: a doc version that merely SORTS BELOW the newest tag is not drift - membership, not order', () => {
  // D-04: `v9.9.0` published by nothing while `v9.9.1` exists is a legitimate
  // maintenance milestone, and the retired scalar comparand refused exactly it.
  const dir = taggedTree(cycleSpec(false), { version: 'v9.9.0', tags: ['v9.9.1'] });
  const r = run(['audit'], dir);
  assert.equal(r.ok, true);
  assert.equal(r.version_drift, undefined);
});

test('audit: no git repo at all leaves the envelope unchanged - no tags is no evidence, never a failure', () => {
  const dir = makeTree(cycleSpec(false));
  writeFileSync(join(dir, 'PROJECT.md'),
    '# Fixture\n\n## Requirements\n\n### Active\n\n`v9.9.0` - the open cycle\n\n### Out of Scope\n');
  const r = run(['audit'], dir);
  assert.equal(r.ok, true);
  assert.equal(r.version_drift, undefined);
  // The ordinary open-cycle arithmetic still runs: an incomplete phase's row is
  // `not-verified`, exactly as it is with a repo present. The absent repo costs
  // the audit nothing but the tag question.
  assert.equal(r.requirements[0].break, 'not-verified');
  assert.deepEqual(r.counts, { total: 1, traced: 0, broken: 1, deferred: 0 });
});

test('audit: with no ### Active version, the ROADMAP title supplies the comparand', () => {
  // The same `### Active` -> ROADMAP-title precedence branch naming uses - one
  // prose reader, shared, so the two cannot disagree about the milestone.
  const dir = taggedTree(cycleSpec(false),
    { version: null, tags: ['v9.9.0'], roadmapTitle: '# Roadmap: Fixture v9.9.0' });
  const r = run(['audit'], dir);
  assert.equal(r.ok, true);
  assert.deepEqual(r.version_drift,
    { doc_version: 'v9.9.0', published_as: 'v9.9.0', cycle_state: 'open' });
});

test('audit: the v2.4.0 state of this repo (issue #87) fires - the regression pin FRI-03 exists for', () => {
  // Docs Active v2.4.0, tag v2.4.0 present, phases still open. The manifest
  // ALSO read 2.4.0 at that moment, which is why a manifest predicate would
  // have been silent here and the tag-plus-open-cycle one is not.
  const dir = taggedTree(cycleSpec(false), { version: 'v2.4.0', tags: ['v2.3.0', 'v2.4.0'] });
  const r = run(['audit'], dir);
  assert.equal(r.ok, true);
  assert.deepEqual(r.version_drift,
    { doc_version: 'v2.4.0', published_as: 'v2.4.0', cycle_state: 'open' });
});

// --- DRF-02: the sanctioned rolled-over phase ---------------------------------
//
// WATCHED FAILING AT caf3a23, the branch tip before this fix. Observed there,
// with this file copied into that checkout's `cadence-core/bin/`:
//
//   $ node --test cadence-core/bin/planning.test.mjs
//   x audit: a phase rolled forward - every row Deferred - does not hold the cycle open
//     AssertionError [ERR_ASSERTION]: rolling work forward is a sanctioned close,
//     not an open cycle under a published number
//     + actual - expected
//     + { cycle_state: 'open', doc_version: 'v9.9.0', published_as: 'v9.9.0' }
//     - undefined
//   i pass 394
//   i fail 1
//
// Only THIS file is copied: `planning.mjs` stays as that tree shipped it, so
// the artifact-only `settled` predicate answers and the watch means something.
// The `Pending` twin passes there and is expected to - it is the half of D-04
// that keeps the gate armed, and it must pass on BOTH trees.
//
// To re-watch: `git worktree add --detach <tmp> caf3a23`, copy this file into
// `<tmp>/cadence-core/bin/`, run `node --test cadence-core/bin/planning.test.mjs`
// from `<tmp>`, then `git worktree remove <tmp>`.

/**
 * One unsettled phase - a pending UAT item, so no artifact can call it complete
 * - whose sole requirement row carries `status`. The two calls differ in that
 * one cell and nowhere else.
 */
const rolledSpec = (status) => ({
  roadmap: [{ n: 1, name: 'One', checked: false }],
  phases: { 1: { plan: true, planReqs: ['AUD-01'], summary: true,
    uat: [{ status: 'pending' }] } },
  reqs: [['AUD-01', 1, status]],
});

test('audit: a phase rolled forward - every row Deferred - does not hold the cycle open', () => {
  // A close is sanctioned to carry work forward (milestone.md), and such a
  // phase looks byte-identical on disk to one still being worked. The rows are
  // the only surface that says which it is: `Deferred` is what rolling forward
  // writes, and the close's remedy - "complete the close so no phase is left
  // open" - is not reachable for a phase deliberately left open.
  const dir = taggedTree(rolledSpec('Deferred'), { version: 'v9.9.0', tags: ['v9.9.0'] });
  const r = run(['audit'], dir);
  assert.equal(r.ok, true);
  assert.equal(r.version_drift, undefined,
    'rolling work forward is a sanctioned close, not an open cycle under a published number');
  // The row still reports as deferred - the exemption reads that datum, it does
  // not change it.
  assert.deepEqual(r.deferred, ['AUD-01']);
});

test('audit: the same phase with its rows still Pending keeps the gate armed', () => {
  // D-04's other half, and what keeps the exemption from re-opening #87: a
  // cycle being WORKED under a published number has rows that are not deferred.
  const dir = taggedTree(rolledSpec('Pending'), { version: 'v9.9.0', tags: ['v9.9.0'] });
  const r = run(['audit'], dir);
  assert.equal(r.ok, true);
  assert.deepEqual(r.version_drift,
    { doc_version: 'v9.9.0', published_as: 'v9.9.0', cycle_state: 'open' });
});

// --- TAG-01: the tag list has to belong to THIS project ----------------------
//
// WATCHED FAILING AT 487e150, the branch tip before this fix. Observed there,
// with this file copied into that checkout's `cadence-core/bin/`:
//
//   $ node --test cadence-core/bin/planning.test.mjs
//   x audit: an enclosing repository's tags are not this project's (TAG-01)
//     AssertionError [ERR_ASSERTION]: an unrelated umbrella repo's v9.9.0 is not
//     a publication of this project
//     + actual - expected
//     + { cycle_state: 'open', doc_version: 'v9.9.0', published_as: 'v9.9.0' }
//     - undefined
//   i pass 392
//   i fail 1
//
// `git-branch.test.mjs`'s TAG-01 fixture - the other caller - reddens in the
// same tree and the same way (`create` expected, `ask` observed).
//
// Only THIS file is copied: `lib/git-tags.mjs` stays as that tree shipped it,
// so the unbounded `git -C` discovery answers and the watch means something.
// The linked-worktree fixture below passes there and is expected to - it pins
// what the bound must NOT cost (this repository runs its own executors in
// worktrees, cd5aed6), not the defect itself.
//
// To re-watch: `git worktree add --detach <tmp> 487e150`, copy this file into
// `<tmp>/cadence-core/bin/`, run `node --test cadence-core/bin/planning.test.mjs`
// from `<tmp>`, then `git worktree remove <tmp>`.

test('audit: an enclosing repository\'s tags are not this project\'s (TAG-01)', () => {
  // `git -C` discovers the repository UPWARD, and the audit asks the tag
  // question from `.planning` - which never holds `.git` - so a project that is
  // not itself a repository inherited the tags of whatever repository contained
  // it, and could be FAILed by a version an unrelated umbrella repo published.
  const inner = makeTree(cycleSpec(false));
  writeFileSync(join(inner, 'PROJECT.md'),
    '# Fixture\n\n## Requirements\n\n### Active\n\n`v9.9.0` - the open cycle\n\n### Out of Scope\n');
  const umbrella = mkdtempSync(join(tmpdir(), 'cad-umbrella-'));
  const git = (...args) => execFileSync('git', ['-C', umbrella, ...args],
    { stdio: 'ignore', env: GIT_FIXTURE_ENV });
  git('init', '-q');
  git('commit', '--allow-empty', '-q', '-m', 'root');
  git('tag', 'v9.9.0');
  // The project moves INSIDE the umbrella's working tree, still carrying no
  // `.git` of its own - a vendored copy, a monorepo sibling, a checkout under
  // somebody else's repo.
  renameSync(dirname(inner), join(umbrella, 'project'));

  const r = run(['audit'], join(umbrella, 'project', '.planning'));
  assert.equal(r.ok, true);
  assert.equal(r.version_drift, undefined,
    'an unrelated umbrella repo\'s v9.9.0 is not a publication of this project');
  // Permissive at `[]` (D-08), so the rest of the envelope is exactly the
  // no-repo one: the refusal costs the audit nothing but the tag question.
  assert.equal(r.requirements[0].break, 'not-verified');
  assert.deepEqual(r.counts, { total: 1, traced: 0, broken: 1, deferred: 0 });
});

test('audit: a LINKED WORKTREE still reads its own repository\'s tags (TAG-01)', () => {
  // The bound must not simply disable the reader. `--show-toplevel` inside a
  // linked worktree returns the WORKTREE root - which is the root the caller
  // derived - and the tags are shared with the main repository, so the drift
  // signal still fires where it should.
  const dir = taggedTree(cycleSpec(false), { version: 'v9.9.0', tags: ['v9.9.0'] });
  const root = dirname(dir);
  const git = (...args) => execFileSync('git', ['-C', root, ...args],
    { stdio: 'ignore', env: GIT_FIXTURE_ENV });
  git('add', '-A');
  git('commit', '-q', '-m', 'planning');
  const linked = join(mkdtempSync(join(tmpdir(), 'cad-linked-')), 'wt');
  git('worktree', 'add', '--detach', linked, 'HEAD');

  const r = run(['audit'], join(linked, '.planning'));
  assert.equal(r.ok, true);
  assert.deepEqual(r.version_drift,
    { doc_version: 'v9.9.0', published_as: 'v9.9.0', cycle_state: 'open' });
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

// The SHIPPED counterexample, not a synthetic one: this repo's own v2.0.0 phase
// 6, whose CONTEXT declared AC1-AC9 while its checklist shipped 17 items with
// zero `criterion`, zero `origin` and no `fields_version`. The four-term legacy
// rule exempted it, which is how the closing audit counted 36 criteria against
// 45 declared and still passed. Recover the originals with
// `git show v2.0.0:.planning/phases/6/CONTEXT.md` and
// `git show v2.0.0:.planning/phases/6/UAT.md`; the criterion prose is
// abbreviated to one line each per the P1_CRITERIA precedent, the item names are
// verbatim.
const P6_CRITERIA = [
  ['AC1', '`config.mjs keys` shows a `purpose` naming the cross-model backend as the only reach for all six tier keys'],
  ['AC2', 'self-verify reports `ok:false` naming the offending key for each of three reach-table defect classes'],
  ['AC3', 'self-verify is `ok:true` on the unmodified tree with the new check named in its `checked` string'],
  ['AC4', 'the per-trigger tier/effort overclaims are gone from decision-review.md and both review skills'],
  ['AC5', 'a global-layer `risk.override.<surface>` no longer waives, and the write face refuses it by scope'],
  ['AC6', '`README.md` and `plugin.json` name git.jcrenshaw.dev, with no `github.com/crenshawdev` left'],
  ['AC7', 'a live `/plugin marketplace add` then `/plugin install cadence@cadence` succeeds (human-verify)'],
  ['AC8', 'the `[2.0.0]` CHANGELOG entry states the home moved and the exact action an existing user takes'],
  ['AC9', '`node --test cadence-core/bin/*.test.mjs`, `npx tsc -p tsconfig.ci.json` and self-verify are green'],
];

const P6_ITEMS = [
  { name: 'Reach stated at the point of setting' },
  { name: 'New reach check catches all three defect classes' },
  { name: 'Reach check is green on the unmodified tree' },
  { name: 'Per-trigger knob overclaims removed' },
  { name: 'Global-layer risk waiver no longer waives, write face refuses by identity' },
  { name: 'Documented plugin home moved to git.jcrenshaw.dev' },
  { name: 'Live install from the new remote (human-verify)' },
  { name: 'CHANGELOG records the move and the reframe' },
  { name: 'CI gates clean' },
  { name: 'risk.override.* reach rows still say universal, and check 9 is blind to it' },
  { name: 'config.mjs get and route.mjs resolve disagree about a global-layer risk waiver, with nothing said' },
  { name: 'A duplicate reach row is dropped with no issue emitted' },
  { name: 'The URL mask covers https only, so SSH clone forms of the new remote still tokenize as git.* keys' },
  { name: "fsIdentity's last fallback throws outside the try, degrading a diagnosable failure to reason:internal" },
  { name: 'normalize does not case-fold the Reach cell, so an out-of-vocabulary reach gives the wrong remediation' },
  { name: 'The global-waiver warning fires wrongly, and gives wrong remediation, in two configurations' },
  { name: 'Self-hosted test badge renders "Not found" - accept or fix' },
];

test('criteria-coverage: phase 6 shipped fieldless beside declared ids - ONE break, no exemption', () => {
  const dir = coverageTree({ 6: { criteria: P6_CRITERIA, items: P6_ITEMS } });
  const r = run(['criteria-coverage'], dir);
  assert.equal(r.ok, true);
  assert.deepEqual(r.breaks,
    [{ phase: 6, break: 'fieldless-checklist', file: 'phases/6/UAT.md' }]);
  assert.equal(r.legacy, undefined);
  // One missing marker, one report: seventeen `untraced` entries and nine
  // per-criterion `uncovered` breaks are all symptoms of it (D-02).
  assert.equal(r.untraced, undefined);
  assert.deepEqual(r.phases, [{ phase: 6, criteria: 9, items: 17 }]);
  // The nine criteria are back IN the counts - the exemption used to hold them
  // out, which is what let the closing audit report a total it never checked.
  assert.deepEqual(r.counts, { criteria: 9, covered: 0, uncovered: 9, untraced: 0, phases: 1 });
});

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

test('criteria-coverage: a fieldless checklist beside declared ids breaks, it does not exempt', () => {
  const dir = coverageTree({
    1: { criteria: P1_CRITERIA, items: P1_ITEMS.map((it) => ({ name: it.name })) },
  });
  const r = run(['criteria-coverage'], dir);
  assert.deepEqual(r.breaks,
    [{ phase: 1, break: 'fieldless-checklist', file: 'phases/1/UAT.md' }]);
  assert.equal(r.legacy, undefined);
  assert.equal(r.untraced, undefined);
  // IN the counts, not held out of them: the identity still holds, and it now
  // holds over criteria the gate actually checked.
  assert.deepEqual(r.counts, { criteria: 7, covered: 0, uncovered: 7, untraced: 0, phases: 1 });
});

test('criteria-coverage: an UNCHECKED box does not suppress the fieldless-checklist break', () => {
  const dir = coverageTree({
    1: { checked: false, criteria: P1_CRITERIA,
      items: P1_ITEMS.map((it) => ({ name: it.name })) },
  });
  const r = run(['criteria-coverage'], dir);
  // `uncovered` and `missing-uat` are box-gated because work in flight passes
  // through them. This one is not: `uat init` writes `fields_version` before it
  // looks at an item, so no phase is ever transiently fieldless.
  assert.deepEqual(r.breaks,
    [{ phase: 1, break: 'fieldless-checklist', file: 'phases/1/UAT.md' }]);
  assert.equal(r.counts.uncovered, 7);
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

// The phase-3 shape, the file that falsified the original two-field premise: a
// marker, 7 `criterion` lines and 0 `origin` lines. It is fully traced, so
// neither arm of the fieldless split may touch it.
test('criteria-coverage: the phase-3 shape (marker, 7 criterion, 0 origin) is not legacy and does not break', () => {
  const dir = coverageTree({
    1: { fieldsVersion: true, criteria: P1_CRITERIA, items: P1_ITEMS.slice(0, 7) },
  });
  const r = run(['criteria-coverage'], dir);
  assert.equal(r.legacy, undefined);
  assert.equal(r.breaks, undefined);
  assert.equal(r.untraced, undefined);
  assert.deepEqual(r.counts, { criteria: 7, covered: 7, uncovered: 0, untraced: 0, phases: 1 });
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

// The fifth term (D-01), and the only shape that still earns the exemption: a
// fieldless checklist beside a CONTEXT that declares no `AC<N>` ids at all. Both
// halves genuinely predate the fields, because the AC-id grammar shipped after
// them - so there is no link here that could have been dropped.
test('criteria-coverage: legacy still applies when the CONTEXT declares no AC ids', () => {
  const dir = coverageTree({
    1: {
      contextText: '# Phase 1 Context\n\n## Acceptance criteria\n\n'
        + '- [ ] the tests pass\n- [ ] the linter is clean\n',
      items: P1_ITEMS.map((it) => ({ name: it.name })),
    },
  });
  const r = run(['criteria-coverage'], dir);
  assert.equal(r.legacy.length, 1);
  assert.deepEqual(Object.keys(r.legacy[0]), ['phase', 'reason']);
  assert.equal(r.legacy[0].phase, 1);
  // The exemption states its reason rather than appearing as a bare phase
  // number: all three conditions named, so a reviewer can check it (D-04).
  for (const term of ['fields_version', 'criterion', 'origin', 'AC<N>']) {
    assert.ok(r.legacy[0].reason.includes(term), `reason names ${term}`);
  }
  assert.equal(r.breaks, undefined);
  assert.equal(r.untraced, undefined);
  // The unidded bullets are still reported, additively - the exemption does not
  // silence the diagnostic that says why the phase declared no ids.
  assert.deepEqual(r.context_issues[0].issues.map((i) => i.code),
    ['criterion-unidded', 'criterion-unidded']);
  // Held out of counts, which is what keeps criteria === covered + uncovered.
  assert.deepEqual(r.counts, { criteria: 0, covered: 0, uncovered: 0, untraced: 0, phases: 1 });
});

// The largest real population of the exemption: a CONTEXT written before the
// `## Acceptance criteria` section existed at all.
test('criteria-coverage: legacy applies with no acceptance-criteria heading at all', () => {
  const dir = coverageTree({
    1: {
      contextText: '# Phase 1 Context\n\n## Scope boundary\n\nIn: everything.\n',
      items: P1_ITEMS.map((it) => ({ name: it.name })),
    },
  });
  const r = run(['criteria-coverage'], dir);
  assert.equal(r.legacy.length, 1);
  assert.equal(r.legacy[0].phase, 1);
  assert.equal(r.breaks, undefined);
  assert.equal(r.context_issues, undefined);
  assert.deepEqual(r.counts, { criteria: 0, covered: 0, uncovered: 0, untraced: 0, phases: 1 });
});

// An UNREADABLE declaration is not an absent one. A capital-C heading returns
// `criteria: null` with a `criteria-heading-near-miss` issue, which coerces to
// zero ids - so without the near-miss gate a typo would collect the exemption
// and emit a reason string asserting the phase declared nothing. It declared
// something this seam could not read, which is the opposite claim.
test('criteria-coverage: a near-miss criteria heading takes the break arm, not the exemption', () => {
  const dir = coverageTree({
    1: {
      contextText: '# Phase 1 Context\n\n## Acceptance Criteria\n\n- [ ] AC1: the tests pass\n',
      items: [{ name: 'Tests pass' }, { name: 'Linter is clean' }],
    },
  });
  const r = run(['criteria-coverage'], dir);
  assert.deepEqual(r.breaks,
    [{ phase: 1, break: 'fieldless-checklist', file: 'phases/1/UAT.md' }]);
  assert.equal(r.legacy, undefined);
  assert.deepEqual(r.context_issues[0].issues.map((i) => i.code),
    ['criteria-heading-near-miss']);
  assert.equal(r.counts.criteria, 0);
});

// The same hole one level down, and the one this family closes: the HEADING was
// exact, the CRITERION LINE was refused. Each shape below parses to zero
// criteria while `context_issues` names the id in the SAME envelope - so an
// exemption keyed on `criteria.length` stated "its CONTEXT declares no AC<N>
// ids" over a phase whose id was sitting right there, and the gate went green on
// a phase it never checked. The fifth term asks the classifier what the CONTEXT
// DECLARED (`declaresIds`), not what this grammar managed to parse.
//
// The grammar itself is deliberately unchanged - admitting these shapes is a
// separate deferred item. What changed is what an empty `criteria` may prove.
const REFUSED_ID_SHAPES = [
  ['a missing colon', '- [ ] AC1 the feature works', 'criterion-malformed-id'],
  ['emphasis around the id', '- [ ] **AC1**: bolded', 'criterion-malformed-id'],
  ['an indented criterion bullet', '  - [ ] AC1: indented', 'criterion-indented-bullet'],
  ['an unboxed bullet', '- AC1: unboxed', 'criterion-unboxed-bullet'],
  ['a non-dash marker', '* [ ] AC1: nondash', 'criterion-nondash-bullet'],
  ['a criterion written as a heading', '### AC1: heading', 'criterion-heading'],
  ['an ordered list item', '1. AC1: ordered', 'criterion-ordered-item'],
];

for (const [arm, line, code] of REFUSED_ID_SHAPES) {
  test(`criteria-coverage: ${arm} is a DECLARED id - the fieldless checklist beside it breaks, it does not exempt`, () => {
    const dir = coverageTree({
      1: {
        contextText: `# Phase 1 Context\n\n## Acceptance criteria\n\n${line}\n`,
        items: [{ name: 'Tests pass' }, { name: 'Linter is clean' }],
      },
    });
    const r = run(['criteria-coverage'], dir);
    assert.deepEqual(r.breaks,
      [{ phase: 1, break: 'fieldless-checklist', file: 'phases/1/UAT.md' }]);
    assert.equal(r.legacy, undefined);
    // The envelope named the id all along - in the same object as the exemption
    // that asserted there was none.
    assert.deepEqual(r.context_issues[0].issues.map((i) => i.code), [code]);
  });
}

// The boundary of the term above, and the reason it asks about DECLARATION
// POSITION rather than "the line names an id somewhere": a bullet whose prose
// mentions an id declares none (`criterion-unidded`, per the grammar's own
// stated rule), so this phase is genuinely pre-id and keeps the exemption.
test('criteria-coverage: a bullet whose PROSE names an id declares nothing - still legacy', () => {
  const dir = coverageTree({
    1: {
      contextText: '# Phase 1 Context\n\n## Acceptance criteria\n\n'
        + '- [ ] the AC3 pin still holds\n',
      items: [{ name: 'Tests pass' }, { name: 'Linter is clean' }],
    },
  });
  const r = run(['criteria-coverage'], dir);
  assert.equal(r.breaks, undefined);
  assert.equal(r.legacy.length, 1);
  assert.equal(r.legacy[0].phase, 1);
  // The stated reason has to be TRUE of every phase that collects it, and this
  // is the arm where the last clause is easiest to get wrong.
  assert.ok(r.legacy[0].reason.includes('declares no AC<N> ids'), 'reason names the fifth term');
  assert.deepEqual(r.context_issues[0].issues.map((i) => i.code), ['criterion-unidded']);
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

// D-10's exemption is the PRUNED phase, and the prune deletes the whole
// directory - so it always takes CONTEXT.md with it. That is why absence of
// CONTEXT is the exemption and absence of UAT is not.
test('criteria-coverage: an absent CONTEXT.md leaves the phase out of the envelope, ok:true', () => {
  const noContext = coverageTree({ 1: { items: P1_ITEMS_DROPPED } });
  const a = run(['criteria-coverage'], noContext);
  assert.equal(a.ok, true);
  assert.deepEqual(a.phases, []);
  assert.equal(a.breaks, undefined);
  assert.deepEqual(a.counts, { criteria: 0, covered: 0, uncovered: 0, untraced: 0, phases: 0 });
});

// The hole this closes: a checked phase that declared seven criteria and never
// got a checklist at all - the total drop - used to report nothing whatsoever.
test('criteria-coverage: a CHECKED phase with criteria and no UAT.md breaks as missing-uat', () => {
  const dir = coverageTree({ 1: { criteria: P1_CRITERIA } });
  const r = run(['criteria-coverage'], dir);
  assert.equal(r.ok, true);
  assert.deepEqual(r.phases, [{ phase: 1, criteria: 7, items: 0 }]);
  assert.deepEqual(r.breaks.map((b) => b.break), Array(7).fill('missing-uat'));
  assert.deepEqual(r.breaks.map((b) => b.id), ['AC1', 'AC2', 'AC3', 'AC4', 'AC5', 'AC6', 'AC7']);
  assert.deepEqual(r.counts, { criteria: 7, covered: 0, uncovered: 7, untraced: 0, phases: 1 });
});

test('criteria-coverage: an UNCHECKED phase with no UAT.md counts uncovered but never breaks', () => {
  const dir = coverageTree({ 1: { checked: false, criteria: P1_CRITERIA } });
  const r = run(['criteria-coverage'], dir);
  assert.equal(r.breaks, undefined);
  assert.equal(r.counts.uncovered, 7);
  assert.deepEqual(r.phases, [{ phase: 1, criteria: 7, items: 0 }]);
});

test('criteria-coverage: a phase with no CONTEXT and no UAT is still exempt - the pruned case', () => {
  const dir = coverageTree({ 1: {} });
  const r = run(['criteria-coverage'], dir);
  assert.equal(r.ok, true);
  assert.deepEqual(r.phases, []);
  assert.equal(r.breaks, undefined);
});

// `read()` collapsed ENOENT with EACCES/EISDIR, so a CONTEXT.md the gate could
// not open collected D-10's absent-file exemption: two declared criteria, and
// `{"ok":true,"phases":[]}` over a file nothing ever looked at.
test('criteria-coverage: a CONTEXT.md at chmod 000 breaks instead of being exempted', {
  skip: process.getuid && process.getuid() === 0 ? 'root reads a 000 file anyway' : false,
}, () => {
  const dir = coverageTree({ 1: { criteria: [['AC1', 'a thing works'], ['AC2', 'another does']] } });
  const ctx = join(dir, 'phases', '1', 'CONTEXT.md');
  chmodSync(ctx, 0o000);
  try {
    const r = run(['criteria-coverage'], dir);
    assert.notDeepEqual(r.phases, undefined);
    assert.equal(r.breaks.length, 1);
    assert.deepEqual(r.breaks[0], {
      phase: 1, break: 'unreadable-context', code: 'EACCES', file: 'phases/1/CONTEXT.md',
    });
  } finally { chmodSync(ctx, 0o644); }
});

test('criteria-coverage: a CONTEXT.md that is a DIRECTORY takes the same break', () => {
  const dir = coverageTree({ 1: { criteria: [['AC1', 'a thing works']] } });
  const ctx = join(dir, 'phases', '1', 'CONTEXT.md');
  rmSync(ctx);
  mkdirSync(ctx);
  const r = run(['criteria-coverage'], dir);
  assert.equal(r.breaks.length, 1);
  assert.equal(r.breaks[0].break, 'unreadable-context');
  assert.equal(r.breaks[0].code, 'EISDIR');
  assert.equal(r.breaks[0].file, 'phases/1/CONTEXT.md');
});

// The break fires on the checkbox state too - like fieldless-checklist and
// unlike uncovered, since an unreadable file is never work in flight.
test('criteria-coverage: an UNCHECKED phase with an unreadable CONTEXT still breaks', () => {
  const dir = coverageTree({ 1: { checked: false, criteria: [['AC1', 'a thing works']] } });
  const ctx = join(dir, 'phases', '1', 'CONTEXT.md');
  rmSync(ctx);
  mkdirSync(ctx);
  const r = run(['criteria-coverage'], dir);
  assert.equal(r.breaks.length, 1);
  assert.equal(r.breaks[0].break, 'unreadable-context');
});

// A typo'd heading used to leave no trace at all: criteria: null, issues: [],
// so the phase reported zero criteria and the items pointing at AC1 landed in
// the additive unknown_criterion with the gate green. Now the heading itself is
// named, which is what makes the drop findable.
test('criteria-coverage: a near-miss criteria heading is reported, not silent', () => {
  const dir = coverageTree({
    1: {
      contextText: '# Phase 1 Context\n\n## Acceptance Criteria\n\n- [ ] AC1: the tests pass\n',
      items: [{ name: 'Tests pass', criterion: 'AC1' }],
    },
  });
  const r = run(['criteria-coverage'], dir);
  assert.deepEqual(r.context_issues[0].issues.map((i) => i.code), ['criteria-heading-near-miss']);
  assert.equal(r.context_issues[0].issues[0].line, 3);
  assert.deepEqual(r.unknown_criterion, [{ phase: 1, item: 1, criterion: 'AC1' }]);
  assert.equal(r.counts.criteria, 0);
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
    // true legacy: fieldless AND its CONTEXT declares no ids
    2: {
      contextText: '# Phase 2 Context\n\n## Acceptance criteria\n\n- [ ] the tests pass\n',
      items: P1_ITEMS.map((it) => ({ name: it.name })),
    },
    3: { criteria: [['AC1', 'one'], ['AC2', 'two'], ['AC3', 'three']],
      items: [{ name: 'Item one', criterion: 'AC1' }, { name: 'A gap', origin: 'verifier' }] },
    4: { items: P1_ITEMS }, // no CONTEXT: contributes nothing
    // fieldless WITH declared ids: one break, its criteria back in the counts
    5: { criteria: [['AC1', 'one'], ['AC2', 'two']],
      items: [{ name: 'Item one' }, { name: 'Item two' }] },
  });
  const r = run(['criteria-coverage'], dir);
  assert.equal(r.legacy.length, 1);
  assert.equal(r.legacy[0].phase, 2);
  assert.deepEqual(r.breaks, [
    { phase: 3, id: 'AC2', break: 'uncovered' },
    { phase: 3, id: 'AC3', break: 'uncovered' },
    { phase: 5, break: 'fieldless-checklist', file: 'phases/5/UAT.md' },
  ]);
  assert.deepEqual(r.counts, { criteria: 12, covered: 8, uncovered: 4, untraced: 0, phases: 4 });
  assert.equal(r.counts.criteria, r.counts.covered + r.counts.uncovered);
});

// The version statement (D-03/D-04). Read from the manifest rather than pinned
// as a literal: a literal would break at every release bump, which is the kind
// of maintenance that gets a check deleted.
const REPO_MANIFEST = join(dirname(PLANNING), '..', '..', '.claude-plugin', 'plugin.json');

test('criteria-coverage: every run states the plugin version and the UAT fields version', () => {
  const dir = coverageTree({ 1: { criteria: P1_CRITERIA, items: P1_ITEMS } });
  const r = run(['criteria-coverage'], dir);
  assert.equal(r.ok, true);
  // First key of the payload: a statement about the run, never an optional
  // finding conditioned on something being wrong.
  assert.deepEqual(Object.keys(r).slice(0, 2), ['ok', 'version']);
  assert.deepEqual(r.version, {
    plugin: JSON.parse(readFileSync(REPO_MANIFEST, 'utf8')).version,
    uat_fields: '1',
  });
});

test('criteria-coverage: CADENCE_PLUGIN_MANIFEST pins the version the run reports', () => {
  const dir = coverageTree({ 1: { criteria: P1_CRITERIA, items: P1_ITEMS } });
  const manifest = join(dir, 'fixture-plugin.json');
  writeFileSync(manifest, JSON.stringify({ name: 'cadence', version: '9.9.9-fixture' }));
  const r = run(['criteria-coverage'], dir, undefined,
    { CADENCE_PLUGIN_MANIFEST: manifest, CADENCE_TEST_SEAM: '1' });
  assert.equal(r.ok, true);
  assert.equal(r.version.plugin, '9.9.9-fixture');
  assert.equal(r.version.uat_fields, '1');
});

test('criteria-coverage: an unreadable manifest reports version.plugin null, never a throw', () => {
  const dir = coverageTree({ 1: { criteria: P1_CRITERIA, items: P1_ITEMS } });
  const r = run(['criteria-coverage'], dir, undefined,
    { CADENCE_PLUGIN_MANIFEST: join(dir, 'no-such-manifest.json'), CADENCE_TEST_SEAM: '1' });
  // Provenance must not sink a working gate: the coverage answer is unchanged.
  assert.equal(r.ok, true);
  assert.equal(r._exit, 0);
  assert.equal(r.version.plugin, null);
  assert.equal(r.version.uat_fields, '1');
  assert.deepEqual(r.counts, { criteria: 7, covered: 7, uncovered: 0, untraced: 0, phases: 1 });
});

test('criteria-coverage: CADENCE_PLUGIN_MANIFEST without the sentinel is ignored', () => {
  // The manifest is what every version-skew answer is computed from (QW-04), so
  // it is read from the injected path only when CADENCE_TEST_SEAM is exactly
  // `1`. Unset the sentinel and the run reports the SHIPPED manifest's version
  // - silently, because MANIFEST_PATH resolves at module load, before a
  // dispatch exists to carry a warning.
  const dir = coverageTree({ 1: { criteria: P1_CRITERIA, items: P1_ITEMS } });
  const manifest = join(dir, 'ungated-plugin.json');
  writeFileSync(manifest, JSON.stringify({ name: 'cadence', version: '9.9.9-fixture' }));
  const env = { ...process.env, CADENCE_PLUGIN_MANIFEST: manifest };
  delete env.CADENCE_TEST_SEAM; // hermetic: never inherit an open seam
  const r = JSON.parse(execFileSync('node',
    [PLANNING, 'criteria-coverage', '--dir', dir], { encoding: 'utf8', env }));
  assert.equal(r.ok, true);
  assert.equal(r.version.plugin, JSON.parse(readFileSync(REPO_MANIFEST, 'utf8')).version);
  assert.notEqual(r.version.plugin, '9.9.9-fixture');

  // The SAME file with the sentinel set DOES take.
  const opened = JSON.parse(execFileSync('node',
    [PLANNING, 'criteria-coverage', '--dir', dir],
    { encoding: 'utf8', env: { ...env, CADENCE_TEST_SEAM: '1' } }));
  assert.equal(opened.version.plugin, '9.9.9-fixture');
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

// WATCHED FAILING AT ae73dd6, the tip of this plan's unpatched tree. Observed
// there, with this file copied into that checkout:
//
//   $ node --test --test-name-pattern='PHS-01' cadence-core/bin/planning.test.mjs
//   AssertionError [ERR_ASSERTION]: phases/3 must survive a git state that
//   could not be read - apply returned {"ok":true,"ops":[{"rm":"phases/3"},
//   {"edit":"ROADMAP.md","changes":1},{"edit":"REQUIREMENTS.md","changes":1},
//   {"edit":"STATE.md","changes":1}],"orphaned_reqs":["REQ-3"],"total":2,
//   "_exit":0}
//     + actual - expected
//     + false
//     - true
//   (exit 1)
//
// Which is the defect exactly: the repository's `.git` was at mode 000, so
// `git status --porcelain --ignored` exited 128 and `uncommittedUnder`'s bare
// `catch { return []; }` reported NO uncommitted work - the same answer it
// gives for a directory with no repository at all. `remove` read that as clean,
// ran, reported `ok:true` with `{"rm":"phases/3"}` among its ops, and phases/3
// and its PLAN.md were gone. The exit code is 0: nothing in the output says a
// check was skipped, which is the whole shape - a gate that clears itself
// wrong.
//
// Driven through the CLI with `execFileSync` and importing nothing this plan
// added, so against the unpatched tree it fails on an ASSERTION rather than on
// a missing export. To re-watch it:
// `git worktree add --detach <tmp> ae73dd6`, copy THIS FILE alone into that
// checkout's `cadence-core/bin/`, run it there with
// `--test-name-pattern='PHS-01'` - the scope matters, since the source row
// below (`source: the renumber rm fallback's ...`) also reddens at that sha and
// is a different claim - then `git worktree remove` it.

test('PHS-01: an unreadable git state refuses the remove, a non-repo still removes', {
  skip: typeof process.getuid === 'function' && process.getuid() === 0 ? 'root bypasses mode bits' : false,
}, () => {
  const dir = renumberTree();
  const repo = join(dir, '..');
  const g = (args) => execFileSync('git', args, { cwd: repo, stdio: 'pipe',
    env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' } });
  g(['init', '-q', '.']);
  g(['config', 'user.email', 't@t']);
  g(['config', 'user.name', 'T']);
  g(['add', '-A']);
  g(['commit', '-qm', 'init']);

  // Mode 000 on `.git` is the whole fixture: git then exits 128 with
  // `fatal: not a git repository` - the SAME bytes it prints for a directory
  // that has no repository above it at all. That collision is why the
  // classifier probes the filesystem instead of reading git's answer, and it
  // is why the two arms below have to be asserted together: any rule derived
  // from git's own output either refuses both or permits both.
  const gitDir = join(repo, '.git');
  const before = readFileSync(join(dir, 'ROADMAP.md'), 'utf8');
  let rDry, rApply;
  chmodSync(gitDir, 0o000);
  try {
    rDry = run(['renumber', 'remove', '--n', '3', '--dry-run'], dir);
    rApply = run(['renumber', 'remove', '--n', '3'], dir);
  } finally {
    // Restored before any assertion, so a red row cannot leave a tmpdir
    // nothing can descend into - the shipped partial-apply fixture's
    // discipline, for the same reason.
    chmodSync(gitDir, 0o755);
  }

  // The destroyed thing first, and the envelope in the message: what a wrong
  // answer costs here is a phase directory and everything under it, so that is
  // the assertion the watch is meant to show failing.
  assert.ok(existsSync(join(dir, 'phases', '3', 'PLAN.md')),
    `phases/3 must survive a git state that could not be read - apply returned ${JSON.stringify(rApply)}`);
  assert.deepEqual(readdirSync(join(dir, 'phases')).sort(), ['1', '2', '3']);
  assert.equal(readFileSync(join(dir, 'ROADMAP.md'), 'utf8'), before);

  // Both arms refuse, and neither sends the caller to a remedy git cannot
  // perform. `--dry-run` matters as much as apply: it is what the workflow's
  // confirmation gate prints, so a clean plan there is what talks a caller
  // into the apply.
  for (const [arm, r] of [['--dry-run', rDry], ['apply', rApply]]) {
    assert.equal(r.ok, false, `${arm} must refuse an unreadable git state, got ${JSON.stringify(r)}`);
    assert.notEqual(r.reason, 'uncommitted-work',
      `${arm} reported uncommitted work for a git that could not answer`);
    assert.doesNotMatch(`${r.detail || ''} ${r.hint || ''}`, /commit or discard/,
      `${arm} prescribes committing or discarding, which an unreadable repository cannot do`);
  }

  // The permissive arm of the same classifier (AC5), asserted in the same
  // family because it is the cost of getting the first arm wrong: no `.git`
  // anywhere above means nothing is tracked, nothing can be lost to the
  // object store, and the remove must still happen. Eleven shipped renumber
  // fixtures run on exactly this tree.
  const bare = renumberTree();
  const rBare = run(['renumber', 'remove', '--n', '3'], bare);
  assert.equal(rBare.ok, true, `a tree with no repository must still remove, got ${JSON.stringify(rBare)}`);
  assert.ok(!existsSync(join(bare, 'phases', '3')));
  assert.deepEqual(readdirSync(join(bare, 'phases')).sort(), ['1', '2']);
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

// WATCHED FAILING AT ae73dd6, the same unpatched tip the falsifier above was
// watched at. These two came out of the blocking `risk_surface` round rather
// than a plan task, which is why the header lands here after the fact; the
// watch it records was re-run in full before this comment was written.
// Observed there, with THIS FILE alone copied into that checkout:
//
//   $ node --test --test-name-pattern='PHS-01' cadence-core/bin/planning.test.mjs
//   AssertionError [ERR_ASSERTION]: the nested repository must stop the delete
//   - got {"ok":true,"ops":[{"rm":"phases/3"},{"edit":"ROADMAP.md",
//   "changes":1},{"edit":"REQUIREMENTS.md","changes":1},{"edit":"STATE.md",
//   "changes":1}],"orphaned_reqs":["REQ-3"],"total":2,"_exit":0}
//   true !== false
//   AssertionError [ERR_ASSERTION]: phases/3 must survive an unreadable GIT_DIR
//   repository - got {"ok":true,"ops":[{"rm":"phases/3"}, ... ,"_exit":0}
//   (exit 1)
//
// Both are the SAME shape as the falsifier above and a different reach: there
// the repository sat at the planning root with its state unreadable, here it is
// invisible to a walk that only goes UP (rooted inside the target) or that only
// reads the filesystem (selected by `GIT_DIR`). In both the classifier answered
// ABSENT, which is the permissive arm, and the permissive arm ends in the
// recursive delete - `ok:true`, `{"rm":"phases/3"}`, exit 0, nothing in the
// output saying a check was skipped.
//
// Both are driven through the CLI with `execFileSync` and import nothing this
// phase added, so they fail on an ASSERTION at the unpatched sha rather than on
// a missing export. To re-watch: `git worktree add --detach <tmp> ae73dd6`,
// copy THIS FILE alone into that checkout's `cadence-core/bin/`, run it there
// with `--test-name-pattern='PHS-01'` - the scope matters for the same reason
// it does above - then `git worktree remove` it.

test('PHS-01: a repository rooted INSIDE phases/<at> is not deleted out from under itself', () => {
  // The classifier walks UP from the planning root, so a repository rooted in
  // the very directory the fallback is about to delete is invisible to it: the
  // tree answers "no repository" and `rmSync` takes the nested object store
  // along with the phase. Nothing else in the run reads that repository, so its
  // commits have no second copy anywhere.
  const dir = renumberTree();
  const nested = join(dir, 'phases', '3');
  execFileSync('git', ['init', '-q', '.'], { cwd: nested, stdio: 'pipe',
    env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' } });

  const before = readFileSync(join(dir, 'ROADMAP.md'), 'utf8');
  const r = run(['renumber', 'remove', '--n', '3'], dir);

  assert.equal(r.ok, false, `the nested repository must stop the delete - got ${JSON.stringify(r)}`);
  assert.ok(existsSync(join(nested, '.git')), 'the nested object store must survive');
  assert.ok(existsSync(join(nested, 'PLAN.md')));
  // The rm is the FIRST apply step, so a refusal there leaves the tree whole.
  assert.equal(readFileSync(join(dir, 'ROADMAP.md'), 'utf8'), before);
  assert.deepEqual(readdirSync(join(dir, 'phases')).sort(), ['1', '2', '3']);
});

test('PHS-01: a GIT_DIR-selected repository counts as present when its state cannot be read', {
  skip: typeof process.getuid === 'function' && process.getuid() === 0 ? 'root bypasses mode bits' : false,
}, () => {
  // `GIT_DIR`/`GIT_WORK_TREE` select a repository with no lexical `.git`
  // anywhere above the work tree. The filesystem probe finds nothing, so an
  // unreadable external repository classified as ABSENT - the permissive arm,
  // which ends in the recursive delete. Presence is what the environment says
  // here, not what the walk can see.
  const dir = renumberTree();
  const work = join(dir, '..');
  const meta = join(work, 'meta.git');
  const env = { GIT_DIR: meta, GIT_WORK_TREE: work,
    GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' };
  const g = (args) => execFileSync('git', args, { cwd: work, stdio: 'pipe', env: { ...process.env, ...env } });
  g(['init', '-q']);
  g(['config', 'user.email', 't@t']);
  g(['config', 'user.name', 'T']);
  g(['add', '-A']);
  g(['commit', '-qm', 'init']);
  assert.ok(!existsSync(join(work, '.git')), 'the fixture is only meaningful with no lexical .git');

  const before = readFileSync(join(dir, 'ROADMAP.md'), 'utf8');
  let r;
  chmodSync(meta, 0o000);
  try { r = run(['renumber', 'remove', '--n', '3'], dir, undefined, env); }
  finally { chmodSync(meta, 0o755); }

  assert.ok(existsSync(join(dir, 'phases', '3', 'PLAN.md')),
    `phases/3 must survive an unreadable GIT_DIR repository - got ${JSON.stringify(r)}`);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'unreadable-git-state');
  assert.equal(readFileSync(join(dir, 'ROADMAP.md'), 'utf8'), before);
});

test('source: the nested-repository probe reads the filesystem, not entry names', () => {
  // A source row because the state it guards needs a case-INSENSITIVE
  // filesystem, which the suite cannot conjure on Linux. What it pins is the
  // mechanism: `e.name === '.git'` over a readdir is a case-sensitive test, so
  // an admin directory stored as `.GIT` on APFS or NTFS still resolves for git
  // and gets scanned past, while `gitDirAbove` - which has always probed with
  // lstat - matches it. One guard, two halves, and only one of them open.
  const src = readFileSync(PLANNING, 'utf8');
  const start = src.indexOf('function gitDirUnder(');
  assert.ok(start > 0, 'the nested-repository probe is no longer under this name');
  const body = src.slice(start, src.indexOf('\n}', start));
  assert.match(body, /lstatSync\(join\([^)]*'\.git'\)/,
    'the nested probe no longer asks the filesystem whether .git is there');
  assert.doesNotMatch(body, /\.name === '\.git'/,
    'the nested probe is back to a case-sensitive name comparison');
});

test('source: the renumber rm fallback\'s recursive delete is gated by the .git probe', () => {
  // A source row rather than a behavioural one because the state it guards is
  // unreachable from a test: it needs `git rm` to fail while `.git` exists,
  // which the pre-flight already refuses ahead of the apply. The arm is still
  // load-bearing - it is the SECOND, independent fail-open, covering a git
  // state that turned unreadable between the pre-flight and the apply, and any
  // `git rm` failure the pre-flight did not predict at all. What the row pins
  // is that the guard cannot be dropped back to the shipped one-liner
  // `catch { rmSync(..., { recursive: true }) }`, which read an unreadable git
  // state as a clean one and deleted the phase directory whole.
  const src = readFileSync(PLANNING, 'utf8');
  // Sliced from the rm step's own op literal to the move loop that follows it,
  // so this reads the ONE fallback that deletes a phase directory and not the
  // unrelated recursive rmSync in milestone-prune's delete mode.
  const start = src.indexOf('steps.push([{ rm: `phases/${at}` }');
  assert.ok(start > 0, 'the renumber apply loop\'s rm step is no longer under this shape');
  const end = src.indexOf('for (const [f, t] of dirMoves)', start);
  assert.ok(end > start, 'the rm step is no longer followed by the dir-move loop');
  const step = src.slice(start, end);
  assert.match(step, /rmSync\([\s\S]*?recursive: true/, 'the recursive fallback this row guards is gone');
  // Guarded, and guarded BEFORE the delete - a probe after the rmSync would
  // pass a substring check while deleting exactly as it did.
  const probe = step.indexOf('gitDirAbove(');
  const del = step.search(/rmSync\(/);
  assert.ok(probe > 0 && probe < del,
    'the recursive delete runs without the .git probe deciding first');
  // The probe looks UP from the planning root, so it cannot see a repository
  // rooted in the directory being deleted. That half is a separate call and
  // it must also decide before the delete, or the nested object store goes
  // with the phase dir - the same fail-open reached from the other side.
  const under = step.indexOf('gitDirUnder(');
  assert.ok(under > 0 && under < del,
    'the recursive delete runs without the nested-repository probe deciding first');
  assert.doesNotMatch(step, /catch \{ rmSync/, 'the unguarded one-line fallback is back');
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

// The two defective pairs the lease grammar's two readers disagree about: the
// pre-flight gate compares declarations by exact string equality, while
// `lease-check` reads a trailing slash as a directory prefix. A phase declaring
// `src/` in one plan and `src/auth.js` in another therefore passes the
// parallel-safety gate and is then refused, plan by plan, at the commit step.
// Both spellings ride `overlaps[].files` as separate strings (D-06); the ORDER
// is not pinned here, because it is not this pair's subject.

test('plan-overlap: a directory lease src/ overlaps the file src/auth.js the other plan declares', () => {
  const r = run(['plan-overlap', '--phase', '1'], overlapTree(['src/'], ['src/auth.js']));
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.overlaps.length, 1, JSON.stringify(r));
  assert.deepEqual(r.overlaps[0].plans, ['PLAN-1.md', 'PLAN-2.md']);
  assert.ok(r.overlaps[0].files.includes('src/'), JSON.stringify(r.overlaps[0]));
  assert.ok(r.overlaps[0].files.includes('src/auth.js'), JSON.stringify(r.overlaps[0]));
  assert.equal(r.overlaps[0].files.length, 2, JSON.stringify(r.overlaps[0]));
});

test('plan-overlap: a directory lease src/ overlaps the nested directory lease src/auth/', () => {
  const r = run(['plan-overlap', '--phase', '1'], overlapTree(['src/'], ['src/auth/']));
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.overlaps.length, 1, JSON.stringify(r));
  assert.deepEqual(r.overlaps[0].plans, ['PLAN-1.md', 'PLAN-2.md']);
  assert.ok(r.overlaps[0].files.includes('src/'), JSON.stringify(r.overlaps[0]));
  assert.ok(r.overlaps[0].files.includes('src/auth/'), JSON.stringify(r.overlaps[0]));
  assert.equal(r.overlaps[0].files.length, 2, JSON.stringify(r.overlaps[0]));
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

// --- the refused lease spellings, through BOTH declaration doors -------------
//
// `./a.txt` and `src//a.txt` name the same file as their plain spelling, which
// lib/lease-grammar.mjs reads as a different file. They are refused at
// declaration time and never reach either reader. The matrix below is FULL -
// two spellings by two doors - because a wiring defect on one arm passes
// happily on the diagonal: refusing on the frontmatter arm alone leaves the
// spelling reaching `lease-check` through the task line with no diagnostic.

/**
 * A two-plan phase where PLAN-1 declares `bad` through ONE door plus a plain
 * `keep.txt`, and PLAN-2 declares `plain` - the same file, spelled legally -
 * plus `keep.txt`. So the legitimate overlap survives while the refused
 * declaration is absent from it. Returns the tree and the line `bad` is
 * declared on.
 */
function refusalTree(bad, plain, door) {
  const dir = makeTree({
    roadmap: [{ n: 1, name: 'One' }],
    phases: { 1: { plan: ['PLAN-1.md', 'PLAN-2.md'] } },
  });
  const pdir = join(dir, 'phases', '1');
  const one = door === 'frontmatter'
    ? `---\nphase: 1\nplan: 1\nrequirements: []\nfiles:\n  - ${bad}\n  - keep.txt\n---\n# Plan 1\n`
    : `---\nphase: 1\nplan: 1\nrequirements: []\nfiles:\n  - keep.txt\n---\n# Plan 1\n\n`
      + `### Task 1: t\n\n- **Files:** ${bad}\n- **Action:** x\n- **Verify:** y\n`;
  writeFileSync(join(pdir, 'PLAN-1.md'), one);
  writeFileSync(join(pdir, 'PLAN-2.md'),
    `---\nphase: 1\nplan: 2\nrequirements: []\nfiles:\n  - ${plain}\n  - keep.txt\n---\n# Plan 2\n`);
  return { dir, line: one.split('\n').findIndex((l) => l.includes(bad)) + 1 };
}

for (const [bad, plain] of [['./a.txt', 'a.txt'], ['src//a.txt', 'src/a.txt']]) {
  for (const door of ['frontmatter', 'task line']) {
    test(`plan-overlap: ${bad} declared on the ${door} is refused as redundant-path-segment and reaches neither reader`, () => {
      const { dir, line } = refusalTree(bad, plain, door);
      const r = run(['plan-overlap', '--phase', '1'], dir);
      assert.equal(r.ok, true, JSON.stringify(r));
      assert.deepEqual(r.frontmatter_issues,
        [{ plan: 'PLAN-1.md', issues: [{ line, code: 'redundant-path-segment', text: r.frontmatter_issues[0].issues[0].text }] }],
        JSON.stringify(r.frontmatter_issues));
      assert.ok(r.frontmatter_issues[0].issues[0].text.includes(bad),
        r.frontmatter_issues[0].issues[0].text);
      // The refused declaration is absent from the overlap; the legitimate one
      // is still there, so this is a DROP and not a dead gate.
      assert.deepEqual(r.overlaps, [{ plans: ['PLAN-1.md', 'PLAN-2.md'], files: ['keep.txt'] }]);
      assert.equal(r.undeclared, undefined);
    });
  }
}

test('plan-overlap: the same refused spelling twice in one files: list reports two issues on their OWN lines', () => {
  // A cursor advances past each match, so the second diagnostic does not point
  // back at the first occurrence's line.
  const dir = makeTree({
    roadmap: [{ n: 1, name: 'One' }],
    phases: { 1: { plan: ['PLAN-1.md', 'PLAN-2.md'] } },
  });
  const pdir = join(dir, 'phases', '1');
  writeFileSync(join(pdir, 'PLAN-1.md'),
    '---\nphase: 1\nplan: 1\nrequirements: ["#41"]\nfiles:\n  - ./a.txt\n  - keep.txt\n  - ./a.txt\n---\n# Plan 1\n');
  writeFileSync(join(pdir, 'PLAN-2.md'),
    '---\nphase: 1\nplan: 2\nrequirements: []\nfiles:\n  - keep.txt\n---\n# Plan 2\n');
  const r = run(['plan-overlap', '--phase', '1'], dir);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(r.frontmatter_issues[0].issues.map((i) => [i.line, i.code]),
    [[6, 'redundant-path-segment'], [8, 'redundant-path-segment']],
    JSON.stringify(r.frontmatter_issues));
  assert.deepEqual(r.overlaps, [{ plans: ['PLAN-1.md', 'PLAN-2.md'], files: ['keep.txt'] }]);
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

test('seed-reqs: a --phase spelling that cannot round-trip is refused before any read (D-07)', () => {
  // The fixture holds BOTH sub-phases, which is what makes the old answer
  // wrong rather than merely odd: `--phase 1.10` used to seed `| B | Phase 1.1
  // | Pending |` - the OTHER phase's row - with ok:true.
  const dir = seedTree({
    roadmap: [{ n: 1, name: 'One' }],
    phases: {
      '1.1': { plan: true, planReqs: ['A'] },
      '1.10': { plan: true, planReqs: ['B'] },
      2: { plan: true, planReqs: ['C'] },
      '2.1': { plan: true, planReqs: ['D'] },
    },
    active: ['A', 'B', 'C', 'D'],
  });
  const before = readFileSync(join(dir, 'REQUIREMENTS.md'), 'utf8');
  for (const bad of ['1.10', '1.0', '01']) {
    const r = run(['seed-reqs', '--phase', bad], dir);
    assert.equal(r.ok, false, bad);
    assert.equal(r.reason, 'bad-args', bad);
    assert.equal(r._exit, 1, bad);
    // Both spellings: the caller's fix is retype the flag OR rename the dir.
    assert.ok(r.detail.includes(`"${bad}"`), `${bad}: detail quotes what was sent`);
    assert.ok(r.detail.includes(`"${String(Number(bad))}"`), `${bad}: detail quotes what is accepted`);
  }
  assert.equal(readFileSync(join(dir, 'REQUIREMENTS.md'), 'utf8'), before, 'nothing written');

  // The spellings that DO round-trip are untouched, sub-phases included.
  for (const [good, id] of [['1.1', 'A'], ['2', 'C'], ['2.1', 'D']]) {
    const r = run(['seed-reqs', '--phase', good], dir);
    assert.equal(r.ok, true, good);
    assert.deepEqual(r.seeded, [id], good);
  }
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

// The decimal answer and the missing-value answer are different repairs, so
// the decimal one keeps its own wording rather than collapsing into requireInt's.
test('renumber: the decimal refusal names decimals, not a missing flag', () => {
  const dir = makeTree({ roadmap: [{ n: 1, name: 'One' }, { n: 2, name: 'Two' }] });
  assert.match(run(['renumber', 'remove', '--n', '2.1'], dir).detail, /re-place decimal phases by hand/);
  assert.match(run(['renumber', 'insert', '--at', '2.1'], dir).detail, /re-place decimal phases by hand/);
});

// `renumber remove --n` with no value used to pass the NaN screen as 1 and
// delete phase 1 - its roadmap line, its detail section and its directory.
for (const [sub, flag] of [['remove', 'n'], ['insert', 'at']]) {
  test(`renumber ${sub}: a valueless --${flag} refuses; roadmap and dirs untouched`, () => {
    const dir = renumberTree();
    const before = readFileSync(join(dir, 'ROADMAP.md'), 'utf8');
    const dirsBefore = readdirSync(join(dir, 'phases')).sort();
    const r = run(['renumber', sub, `--${flag}`], dir);
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'bad-args');
    assert.match(r.detail, new RegExp(`--${flag}`));
    assert.equal(readFileSync(join(dir, 'ROADMAP.md'), 'utf8'), before);
    assert.deepEqual(readdirSync(join(dir, 'phases')).sort(), dirsBefore);
  });

  test(`renumber ${sub}: a non-numeric --${flag} refuses the same way`, () => {
    const dir = renumberTree();
    const before = readFileSync(join(dir, 'ROADMAP.md'), 'utf8');
    const r = run(['renumber', sub, `--${flag}`, 'abc'], dir);
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'bad-args');
    assert.equal(readFileSync(join(dir, 'ROADMAP.md'), 'utf8'), before);
  });
}

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

// --- capture -> recall: the walk-membership round trip (AC1) -----------------
// The pair below is the whole point of the phase. The first row proves a bullet
// written through the seam comes back; the second is its FALSIFIER, and without
// it the first would stay green if the seam wrote to `## Archive` - which is
// exactly how five filed bullets were lost. A positive-only assertion here
// would be an inspection dressed as a test.

test('capture -> recall: a bullet written through the seam comes back, with its phase (AC1)', () => {
  const dir = makeTree({ roadmap: [{ n: 1, name: 'One' }] });
  const w = run(['capture', '--kind', 'todo', '--text', 'the zarquon fixture leaks a handle',
    '--phase', '2'], dir);
  assert.equal(w.ok, true, JSON.stringify(w));
  const r = recall('zarquon', dir);
  const hit = r.json.results.find((x) => /zarquon/.test(x.snippet));
  assert.ok(hit, `the captured bullet did not come back: ${r.raw}`);
  assert.equal(hit.source, 'CAPTURE.md');
  assert.equal(hit.phase, 2);
});

test('capture -> recall: a seed and a note come back too, unphased', () => {
  const dir = makeTree({ roadmap: [{ n: 1, name: 'One' }] });
  assert.equal(run(['capture', '--kind', 'seed', '--text', 'a zarquon scanner'], dir).ok, true);
  assert.equal(run(['capture', '--kind', 'note', '--text', 'zarquon bit us again'], dir).ok, true);
  const hits = recall('zarquon', dir).json.results.filter((x) => x.source === 'CAPTURE.md');
  assert.equal(hits.length, 2, JSON.stringify(hits));
  for (const h of hits) assert.equal(h.phase, undefined);
});

test('capture -> recall: a bullet under ## Archive is NOT returned (the falsifier)', () => {
  // Same distinctive term, one bullet through the seam and one written straight
  // into a section the walk does not visit. Only the seam's comes back - so a
  // seam that ever wrote to `## Archive` reddens the row above rather than
  // passing on a bullet nobody can recall. `## Archive` stays out of the walk on
  // purpose (D-03): widening it would re-admit 185 retired bullets.
  const dir = makeTree({
    roadmap: [{ n: 1, name: 'One' }],
    capture: [{ section: 'Archive', text: 'zarquon retired long ago' }],
  });
  assert.match(readFileSync(join(dir, 'CAPTURE.md'), 'utf8'), /## Archive\n\n- zarquon retired long ago/);
  assert.deepEqual(recall('zarquon', dir).json.results, []);
  assert.equal(run(['capture', '--kind', 'todo', '--text', 'zarquon is live again', '--phase', '1'], dir).ok, true);
  const back = recall('zarquon', dir).json.results;
  assert.equal(back.length, 1, JSON.stringify(back));
  assert.match(back[0].snippet, /zarquon is live again/);
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

// --- recall: the archived corpus a closed milestone leaves behind (RCL-07) ----
// The residue file is read beside CAPTURE.md, LAST in the corpus, so a tree
// with no ARCHIVE.md emits exactly the bytes it emitted before this walk
// existed - that byte-identity is the first assertion below, not a remark.

/** Write an ARCHIVE.md into a fixture tree; `rows` are raw grammar lines. */
function archive(dir, label, rows) {
  writeFileSync(join(dir, 'ARCHIVE.md'),
    `# Archive\n\n## ${label}\n\n${rows.map((r) => `- ${r}`).join('\n')}\n`);
  return dir;
}

test('recall: an archived row comes back with its milestone label and its origin', () => {
  const dir = makeTree({ phases: { 1: { summaryBody: { deviations: ['a live deviation'] } } } });
  archive(dir, 'v3.5.2', [
    '`phases/2/SUMMARY.md`: the zarquon guard fired on a range it did not own',
    '`phases/2.1/UAT.md`: walk the zarquon install from a cold clone',
    '`phases/2/CONTEXT.md`: D-04 (RCL-07): each zarquon row names its origin',
  ]);
  const r = recall('zarquon', dir);
  assert.equal(r.json.ok, true);
  assert.equal(r._exit, 0);
  const hits = r.json.results;
  assert.equal(hits.length, 3, JSON.stringify(hits));
  // Distinguishable from each other AND from a live row: the label leads, the
  // origin artifact follows, and `phase` keeps the meaning a live row gives it.
  assert.deepEqual(new Set(hits.map((h) => h.source)), new Set([
    'v3.5.2/phases/2/SUMMARY.md',
    'v3.5.2/phases/2.1/UAT.md',
    'v3.5.2/phases/2/CONTEXT.md',
  ]));
  const uat = hits.find((h) => h.source.endsWith('UAT.md'));
  assert.equal(uat.phase, 2.1, 'a decimal phase survives the round trip');
  assert.deepEqual(Object.keys(uat).sort(), ['phase', 'score', 'snippet', 'source'],
    'the result contract stays exactly four fields wide');
});

test('recall: a tree with no ARCHIVE.md answers byte-identically to one that never had it', () => {
  const spec = {
    phases: { 1: { summaryBody: { deviations: ['alpha beta gamma'] } } },
    capture: [{ section: 'Todos', text: 'wire the beta recall path', phase: 1 }],
  };
  const bare = recall('beta gamma', makeTree(spec));
  const empty = recall('beta gamma', archive(makeTree(spec), 'v3.5.2', []));
  assert.equal(bare.raw, empty.raw, 'an ARCHIVE.md with no rows changes no byte');
  // And the archived rows land AFTER the live ones, so no existing corpus INDEX
  // moved: the live hits come back in the same order, the same rows.
  //
  // Their SCORES do move, and deliberately not asserted: BM25 is corpus-
  // relative, so any new document shifts N, avgdl and every idf term. Pinning
  // the numbers here would make an unrelated row added to a project's residue
  // redden this file. What the position guarantees is the tie-break - equal
  // scores resolve by corpus position - which is why the append goes last.
  const withRows = recall('beta gamma', archive(makeTree(spec), 'v3.5.2',
    ['`phases/9/SUMMARY.md`: an unrelated retired note']));
  assert.deepEqual(withRows.json.results.map((r) => [r.source, r.snippet]),
    bare.json.results.map((r) => [r.source, r.snippet]));
});

test('recall: two runs over a corpus holding live AND archived rows are byte-identical', () => {
  const dir = makeTree({
    phases: { 1: { summaryBody: { deviations: ['alpha beta gamma'] } } },
    capture: [{ section: 'Seeds', text: 'gamma indexing idea' }],
  });
  archive(dir, 'v3.5.2', [
    '`phases/1/SUMMARY.md`: beta gamma from the closed milestone',
    '`phases/1/CONTEXT.md`: D-01 (REC-01): gamma stays flat-ranked',
  ]);
  const a = recall('beta gamma', dir);
  const b = recall('beta gamma', dir);
  assert.equal(a.raw, b.raw);
  assert.ok(a.json.results.length >= 3, JSON.stringify(a.json.results));
});

test('recall: memory.backend none reads no ARCHIVE.md either', () => {
  const dir = makeTree({
    phases: { 1: { summaryBody: { deviations: ['a live deviation'] } } },
    config: { memory: { backend: 'none' } },
  });
  archive(dir, 'v3.5.2', ['`phases/2/SUMMARY.md`: the zarquon guard, retired']);
  const r = recall('zarquon', dir);
  assert.equal(r.json.backend, 'none');
  assert.deepEqual(r.json.results, []);
  assert.equal(r.json.total, 0);
  assert.equal(r._exit, 0);
});

// --- detect-commands: the unconfigured static-analysis path (QW-01) ----------

/** A project root holding exactly the named files, one directory deep. */
function projectTree(files) {
  const root = mkdtempSync(join(tmpdir(), 'cad-detect-'));
  for (const [name, body] of Object.entries(files)) {
    writeFileSync(join(root, name), typeof body === 'string' ? body : JSON.stringify(body));
  }
  return root;
}

/** Executable stubs at `<root>/node_modules/.bin`, which is where `npx`
 *  resolves a delegated tool. Bytes in the fixture's own tree, so the
 *  npx-delegated arm is pinned without any machine's install. */
function nodeModulesBin(root, tools) {
  const dir = join(root, 'node_modules', '.bin');
  mkdirSync(dir, { recursive: true });
  for (const t of tools) writeFileSync(join(dir, t), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
  return root;
}

/**
 * Every tool this block's fixtures name. Passed as the reachable set by
 * default, so a row asserting WHICH command an arm produces is not also an
 * assertion about what is installed on the machine running the suite (RCH-01,
 * D-11): with the reachability rule live and no override, the `ruff`, `mypy`
 * and two `go` rows fail on a dev box without those tools, and the
 * `npx eslint`/`npx tsc` rows fail in every mkdtemp tree, which has no
 * `node_modules`. A row that is ABOUT reachability passes its own narrower set.
 */
const EVERY_TOOL = 'npm,npx,cargo,ruff,mypy,go,eslint,tsc';

/**
 * detect-commands takes --root (the PROJECT root), never --dir.
 *
 * `reachable` is the set the seam reads in place of its own probe, behind the
 * `CADENCE_TEST_SEAM` sentinel; `null` runs the real probe, and `seam: false`
 * sets the variable with NO sentinel, which must be ignored. A row that needs
 * the LIVE probe stays hermetic by putting its binaries in the fixture's own
 * `node_modules/.bin` (see nodeModulesBin) rather than relying on the machine.
 */
function detect(root, { extra = [], reachable = EVERY_TOOL, seam = true } = {}) {
  const env = { ...process.env };
  delete env.CADENCE_TEST_SEAM;
  delete env.CADENCE_DETECT_REACHABLE;
  if (seam) env.CADENCE_TEST_SEAM = '1';
  if (reachable !== null) env.CADENCE_DETECT_REACHABLE = reachable;
  try {
    return JSON.parse(execFileSync('node', [PLANNING, 'detect-commands', '--root', root, ...extra],
      { encoding: 'utf8', env }));
  } catch (e) {
    return JSON.parse(e.stdout);
  }
}

test('detect-commands: a package.json lint script is the command', () => {
  const r = detect(projectTree({ 'package.json': { scripts: { lint: 'eslint .' } } }));
  assert.equal(r.ok, true);
  assert.equal(r.lint, 'npm run lint');
  assert.equal(r.typecheck, null);
  assert.equal(r.source.lint, 'package.json');
  assert.equal(r.source.typecheck, null);
});

test('detect-commands: both package.json typecheck spellings', () => {
  assert.equal(detect(projectTree({ 'package.json': { scripts: { typecheck: 'tsc' } } })).typecheck,
    'npm run typecheck');
  assert.equal(detect(projectTree({ 'package.json': { scripts: { 'type-check': 'tsc' } } })).typecheck,
    'npm run type-check');
});

test('detect-commands: Cargo.toml answers both slots', () => {
  const r = detect(projectTree({ 'Cargo.toml': '[package]\nname = "x"\n' }));
  assert.equal(r.lint, 'cargo clippy --all-targets -- -D warnings');
  assert.equal(r.typecheck, 'cargo check --all-targets');
  assert.equal(r.source.lint, 'Cargo.toml');
});

test('detect-commands: pyproject.toml answers per TABLE, not per file', () => {
  const ruff = detect(projectTree({ 'pyproject.toml': '[tool.ruff]\nline-length = 100\n' }));
  assert.equal(ruff.lint, 'ruff check .');
  assert.equal(ruff.typecheck, null);          // no [tool.mypy table
  const mypy = detect(projectTree({ 'pyproject.toml': '[tool.mypy]\nstrict = true\n' }));
  assert.equal(mypy.lint, null);
  assert.equal(mypy.typecheck, 'mypy .');
  // A pyproject with neither table names neither command.
  const bare = detect(projectTree({ 'pyproject.toml': '[project]\nname = "x"\n' }));
  assert.equal(bare.lint, null);
  assert.equal(bare.typecheck, null);
});

test('detect-commands: go.mod answers both slots', () => {
  const r = detect(projectTree({ 'go.mod': 'module example.com/x\n' }));
  assert.equal(r.lint, 'go vet ./...');
  assert.equal(r.typecheck, 'go build ./...');
});

test('detect-commands: an eslint config, flat or legacy, is the last lint arm', () => {
  assert.equal(detect(projectTree({ 'eslint.config.mjs': 'export default [];\n' })).lint,
    'npx eslint .');
  const legacy = detect(projectTree({ '.eslintrc.json': '{}' }));
  assert.equal(legacy.lint, 'npx eslint .');
  assert.equal(legacy.source.lint, '.eslintrc.json');
});

test('detect-commands: the project\'s own script beats a tool config in the same tree', () => {
  const r = detect(projectTree({
    'package.json': { scripts: { lint: 'biome check .', typecheck: 'tsc -p .' } },
    'eslint.config.js': 'module.exports = [];\n',
    'tsconfig.json': '{}',
  }));
  assert.equal(r.lint, 'npm run lint');
  assert.equal(r.typecheck, 'npm run typecheck');
  assert.equal(r.source.lint, 'package.json');
  assert.equal(r.source.typecheck, 'package.json');
});

test('detect-commands: two EXACT tsconfig names, each with the form that points at it', () => {
  const plain = detect(projectTree({ 'tsconfig.json': '{}' }));
  assert.equal(plain.typecheck, 'npx tsc --noEmit');
  assert.equal(plain.source.typecheck, 'tsconfig.json');

  // `npx tsc --noEmit` ignores a config it is not pointed at, so the CI name
  // brings the `-p` form that does point at it - a fixed literal, never a
  // command built out of the matched file name.
  const ci = detect(projectTree({ 'tsconfig.ci.json': '{}' }));
  assert.equal(ci.typecheck, 'npx tsc -p tsconfig.ci.json');
  assert.equal(ci.source.typecheck, 'tsconfig.ci.json');
});

test('detect-commands: a tree carrying BOTH tsconfigs answers with the project\'s own', () => {
  // Order, not coincidence: `tsconfig.json` is the project's own typecheck and
  // the CI file is the narrower one, so the second arm must never shadow the
  // first.
  const both = detect(projectTree({ 'tsconfig.json': '{}', 'tsconfig.ci.json': '{}' }));
  assert.equal(both.typecheck, 'npx tsc --noEmit');
  assert.equal(both.source.typecheck, 'tsconfig.json');
});

test('detect-commands: a NEAR-miss tsconfig name still matches nothing', () => {
  // The glob this pair still refuses. `tsconfig.build.json` is an ordinary
  // third spelling and names no command, which is what keeps "two exact names"
  // a rule rather than a description of today's tree.
  const other = detect(projectTree({ 'tsconfig.build.json': '{}' }));
  assert.equal(other.typecheck, null);
  assert.equal(other.source.typecheck, null);
});

test('detect-commands: nothing detected is ok:true with both null', () => {
  const r = detect(projectTree({ 'README.md': '# x\n' }));
  assert.equal(r.ok, true);
  assert.equal(r.lint, null);
  assert.equal(r.typecheck, null);
  assert.deepEqual(r.source, { lint: null, typecheck: null });
  assert.equal('warnings' in r, false);
});

test('detect-commands: a malformed package.json warns and contributes nothing', () => {
  const r = detect(projectTree({ 'package.json': '{ "scripts": ' }));
  assert.equal(r.ok, true);
  assert.equal(r.lint, null);
  assert.equal(r.typecheck, null);
  assert.equal(r.warnings.length, 1, JSON.stringify(r.warnings));
  assert.match(r.warnings[0], /package\.json failed to parse/);
});

test('detect-commands: a malformed package.json does not block a later arm', () => {
  const r = detect(projectTree({ 'package.json': 'not json', 'go.mod': 'module x\n' }));
  assert.equal(r.lint, 'go vet ./...');
  assert.equal(r.warnings.length, 1);
});

test('detect-commands: a scripts block that is not an object is not read as one', () => {
  const r = detect(projectTree({ 'package.json': { scripts: ['lint'] } }));
  assert.equal(r.lint, null);
  assert.equal(r.typecheck, null);
});

test('detect-commands: the root is read one directory deep, never recursively', () => {
  const root = projectTree({ 'README.md': '# x\n' });
  mkdirSync(join(root, 'sub'));
  writeFileSync(join(root, 'sub', 'package.json'), JSON.stringify({ scripts: { lint: 'x' } }));
  const r = detect(root);
  assert.equal(r.lint, null);
});

test('detect-commands: an unlistable root is ok:false, never a silent nothing', () => {
  const r = detect(join(tmpdir(), 'cad-detect-does-not-exist'));
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'no-root');
});

// --- detect-commands: a command is named only when it can be RUN (RCH-01) ----

test('detect-commands: an unreachable winning arm nulls its slot and never falls through', () => {
  // The measured shape D-05 refuses: `[tool.ruff]` names the lint arm, `go.mod`
  // sits below it, and ruff is absent. Falling through would tell this project
  // to run `go vet ./...` - a linter its maintainers did not choose, over a
  // language the change may not touch.
  const r = detect(projectTree({
    'pyproject.toml': '[tool.ruff]\nline-length = 100\n',
    'go.mod': 'module example.com/x\n',
  }), { reachable: 'go' });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.lint, null);
  assert.equal(r.source.lint, null, 'a nulled slot claims no provenance');
  assert.notEqual(r.lint, 'go vet ./...');
  assert.equal(r.warnings.filter((w) => w.includes('ruff')).length, 1, JSON.stringify(r.warnings));
  assert.match(r.warnings.find((w) => w.includes('ruff')), /pyproject\.toml/);
  // The lower arm is still available to its OWN slot: `go` is reachable here,
  // so the typecheck answer is unaffected. Nulling is per slot, not per tree.
  assert.equal(r.typecheck, 'go build ./...');
  assert.equal(r.source.typecheck, 'go.mod');
});

test('detect-commands: an npx arm probes the DELEGATED tool, not the driver alone', () => {
  // `npx` is on PATH almost everywhere, so a driver-only rule would leave
  // `npx eslint .` naming an eslint nobody has (D-04).
  const tree = { 'eslint.config.mjs': 'export default [];\n' };
  const without = detect(projectTree(tree), { reachable: 'npx' });
  assert.equal(without.lint, null);
  assert.equal(without.source.lint, null);
  assert.equal(without.warnings.filter((w) => w.includes('eslint')).length, 1,
    JSON.stringify(without.warnings));
  const with_ = detect(projectTree(tree), { reachable: 'npx,eslint' });
  assert.equal(with_.lint, 'npx eslint .');
  assert.equal(with_.source.lint, 'eslint.config.mjs');
});

test('detect-commands: the LIVE probe resolves a delegated tool out of node_modules/.bin', () => {
  // Where `npx` itself looks, and the half a PATH-only rule would drop: this is
  // the shape of a TypeScript repo whose only static-analysis command is the
  // one CI runs, with `tsc` installed as a dependency and absent from PATH.
  // Both binaries live in the FIXTURE's node_modules/.bin, so the row proves
  // the production probe without depending on what this machine has installed.
  const root = nodeModulesBin(projectTree({ 'tsconfig.ci.json': '{}' }), ['npx', 'tsc']);
  const r = detect(root, { reachable: null });
  assert.equal(r.typecheck, 'npx tsc -p tsconfig.ci.json', JSON.stringify(r));
  assert.equal(r.source.typecheck, 'tsconfig.ci.json');
  assert.equal('warnings' in r, false, JSON.stringify(r.warnings));
  // Only the POSITIVE half is asserted against the live probe, deliberately. A
  // fixture can guarantee a binary is PRESENT (it wrote it), and nothing on the
  // machine can take it away; it cannot guarantee one is ABSENT, because a box
  // with tsc installed answers `true` correctly and the row would fail for
  // being right. The unreachable-delegated-tool half is pinned above, through
  // the override, where the set is stated rather than discovered.
});

test('detect-commands: an EMPTY reachable set means nothing is reachable', () => {
  // The `||` hazard, pinned: an empty override is falsy, so a seam that read it
  // through `|| probe` would silently run the live probe and answer about the
  // machine. The fixture's own node_modules/.bin would otherwise resolve both
  // binaries, which is exactly what makes this row discriminating.
  const root = nodeModulesBin(projectTree({ 'tsconfig.ci.json': '{}' }), ['npx', 'tsc']);
  const r = detect(root, { reachable: '' });
  assert.equal(r.typecheck, null, JSON.stringify(r));
  assert.equal(r.source.typecheck, null);
});

test('detect-commands: the reachable set WITHOUT the sentinel is ignored', () => {
  // The gate EXP-01 asks for: this variable decides which static-analysis
  // command an executor is told to run, so a repo-supplied .envrc setting it
  // must change nothing. Same fixture and same empty value as the row above,
  // which answered `null` there and answers the live probe here.
  const root = nodeModulesBin(projectTree({ 'tsconfig.ci.json': '{}' }), ['npx', 'tsc']);
  const r = detect(root, { reachable: '', seam: false });
  assert.equal(r.typecheck, 'npx tsc -p tsconfig.ci.json', JSON.stringify(r));
});

// --- a blank --root is refused by BOTH --root subcommands (COR-01) ----------
// `detect-surfaces` is tested here rather than beside its scanner for the same
// reason `trace ignore` is: this is the `--root` refusal, and the two rows sit
// two lines apart in the dispatch table. Measured before the fix: `--root ""`
// answered `ok:true` about the CWD from both commands - the silent substitution
// #42/#45 closed for the valueless spelling and missed for the empty one - and
// `--root "   "` answered `no-root`, a second vocabulary for one refusal. All
// three shapes now take `debt-harvest`'s predicate, trim clause included.

/** Any planning.mjs argv, parsed off stdout on either exit code. */
function runPlanning(...args) {
  try {
    return JSON.parse(execFileSync('node', [PLANNING, ...args], { encoding: 'utf8' }));
  } catch (e) { return JSON.parse(e.stdout); }
}

const BLANK_ROOTS = [
  { name: '--root with nothing after it', args: ['--root'] },
  { name: 'an empty --root ""', args: ['--root', ''] },
  { name: 'a whitespace-only --root', args: ['--root', '   '] },
];

for (const cmd of ['detect-commands', 'detect-surfaces']) {
  for (const row of BLANK_ROOTS) {
    test(`${cmd}: ${row.name} is bad-args, not answered about cwd`, () => {
      const r = runPlanning(cmd, ...row.args);
      assert.equal(r.ok, false, JSON.stringify(r));
      assert.equal(r.reason, 'bad-args', JSON.stringify(r));
    });
  }
}

test('detect-commands: a real --root still answers about THAT tree', () => {
  // Through `detect` rather than `runPlanning` - the argv is the same, and the
  // helper pins the reachable set so this row asserts WHICH tree was read
  // rather than whether the machine running the suite has npm (RCH-01, D-11).
  const root = projectTree({ 'package.json': { scripts: { lint: 'eslint .' } } });
  const r = detect(root);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.root, root);
  assert.equal(r.lint, 'npm run lint');
});

test('detect-surfaces: a real --root still answers about THAT tree', () => {
  const root = projectTree({ 'package.json': { dependencies: { stripe: '^1' } } });
  const r = runPlanning('detect-surfaces', '--root', root);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.root, root);
  assert.deepEqual(r.evidenced.map((e) => e.category), ['billing']);
});

// --- the GLOBAL --dir refuses the empty, bare and flag-shaped spellings ------
// Phase 2 closed this at the six `--dir` seams and left planning.mjs's own door
// open, where the defect was worse than the gap recorded: measured 2026-08-19,
// `status --dir ''` answered `{"ok":true,"current":4,"total":5,...}` about
// `./.planning` - this repository's own tree, which the caller never named -
// and a BARE `--dir` minted the boolean `true`, reached `existsSync(true)` and
// printed a `DEP0187` deprecation warning on STDERR beside the answer. stdout
// is the single channel the seam layer parses and that deprecation is scheduled
// to become a throw, so the STDERR BYTE COUNT is part of the assertion rather
// than decoration - it is what would redden if the boolean reached fs again.
// The flag now reads through its declared row in lib/arg-contract.mjs, whose
// `--dir` grammar refuses on both axes.
const BLANK_DIRS = [
  { name: '--dir with nothing after it', args: ['--dir'] },
  { name: 'an empty --dir ""', args: ['--dir', ''] },
  { name: 'a whitespace-only --dir', args: ['--dir', '   '] },
  { name: 'a flag-shaped --dir value', args: ['--dir', '--undo'] },
];

for (const row of BLANK_DIRS) {
  test(`status: ${row.name} is bad-args naming the flag, and stderr stays empty`, () => {
    const r = spawnSync('node', [PLANNING, 'status', ...row.args], { encoding: 'utf8' });
    const body = JSON.parse(r.stdout);
    assert.equal(body.ok, false, r.stdout);
    assert.equal(body.reason, 'bad-args', r.stdout);
    assert.match(body.detail, /--dir/);
    assert.equal(r.status, 1);
    assert.equal(r.stderr, '', `stderr: ${r.stderr}`);
  });
}

test('status: a genuinely ABSENT --dir still defaults to ./.planning', () => {
  // The other half of the refusal: absent and present-with-nothing-usable are
  // different inputs, and only the second one refuses.
  const dir = makeTree({ roadmap: [{ n: 1, name: 'One', checked: false }] });
  const r = spawnSync('node', [PLANNING, 'status'], { encoding: 'utf8', cwd: dirname(dir) });
  const body = JSON.parse(r.stdout);
  assert.equal(body.ok, true, r.stdout);
  assert.equal(body.total, 1, r.stdout);
  assert.equal(r.status, 0);
});

// --- lease-check: the declared file lease, enforced (QW-03) ------------------

/**
 * A scratch GIT repo whose `.planning/phases/<n>/` holds one plan declaring
 * `files`. Returns {repo, dir} - the seam is run with cwd inside the repo,
 * because it resolves the staged set from `git rev-parse --show-toplevel`.
 */
function leaseRepo({ phase = 1, plan = 'PLAN.md', files = ['a.txt'], body = '' } = {}) {
  const repo = mkdtempSync(join(tmpdir(), 'cad-lease-'));
  execFileSync('git', ['init', '-q'], { cwd: repo });
  execFileSync('git', ['config', 'user.email', 't@example.com'], { cwd: repo });
  execFileSync('git', ['config', 'user.name', 'T'], { cwd: repo });
  const dir = join(repo, '.planning');
  const pdir = join(dir, 'phases', String(phase));
  mkdirSync(pdir, { recursive: true });
  const fm = files === null ? '' : `---\nphase: ${phase}\nfiles:\n${files.map((f) => `  - ${f}\n`).join('')}---\n`;
  writeFileSync(join(pdir, plan), `${fm}# Plan\n${body}`);
  return { repo, dir, pdir };
}

/** Run the seam inside a repo; parse its one JSON line and its exit code.
 * `env` is merged over the inherited environment, which is how the AC8 arm
 * below points the seam's own `git rev-parse` at an unreadable GIT_DIR. */
function leaseCheck(repo, dir, args, env) {
  let stdout;
  let code = 0;
  try {
    stdout = execFileSync('node', [PLANNING, '--dir', dir, 'lease-check', ...args],
      { encoding: 'utf8', cwd: repo, ...(env ? { env: { ...process.env, ...env } } : {}) });
  } catch (e) { stdout = e.stdout; code = e.status; }
  return { ...JSON.parse(stdout), _exit: code };
}

const stage = (repo, name, body = 'x') => {
  const file = join(repo, name);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, body);
  execFileSync('git', ['add', '--', name], { cwd: repo });
};

test('lease-check: a clean lease is ok:true', () => {
  const { repo, dir } = leaseRepo({ files: ['a.txt', 'src/b.js'] });
  stage(repo, 'a.txt');
  stage(repo, 'src/b.js');
  const r = leaseCheck(repo, dir, ['--phase', '1', '--plan', '1']);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.staged, 2);
  assert.equal(r.declared, 2);
  assert.equal(r._exit, 0);
});

test('lease-check: an undeclared staged path is refused and NAMED', () => {
  const { repo, dir } = leaseRepo({ files: ['a.txt'] });
  stage(repo, 'a.txt');
  stage(repo, 'b.txt');
  const r = leaseCheck(repo, dir, ['--phase', '1', '--plan', '1']);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'undeclared-files');
  assert.deepEqual(r.undeclared, ['b.txt']);
  assert.match(r.hint, /files: list/);
  assert.equal(r._exit, 1);
});

test('lease-check: the plan\'s OWN report file is the one exemption', () => {
  const { repo, dir } = leaseRepo({ files: ['a.txt'] });
  stage(repo, '.planning/phases/1/reports/plan-1.md');
  assert.equal(leaseCheck(repo, dir, ['--phase', '1', '--plan', '1']).ok, true);
  // ...and nothing else under reports/ is: another plan's report is undeclared.
  stage(repo, '.planning/phases/1/reports/plan-2.md');
  const r = leaseCheck(repo, dir, ['--phase', '1', '--plan', '1']);
  assert.equal(r.ok, false);
  assert.deepEqual(r.undeclared, ['.planning/phases/1/reports/plan-2.md']);
});

test('lease-check: a declared directory ends in / and matches by PREFIX', () => {
  const { repo, dir } = leaseRepo({ files: ['src/auth/'] });
  stage(repo, 'src/auth/session.js');
  assert.equal(leaseCheck(repo, dir, ['--phase', '1', '--plan', '1']).ok, true);
  // A non-slashed declaration never licenses a sibling by substring.
  const b = leaseRepo({ files: ['src/auth'] });
  stage(b.repo, 'src/authority.js');
  assert.equal(leaseCheck(b.repo, b.dir, ['--phase', '1', '--plan', '1']).ok, false);
});

// Both readers now reach containment through lib/lease-grammar.mjs. These two
// pin the half that must NOT have moved: for a declaration that was already
// unambiguous, the verdict and both counts are what they were before the
// shared predicate existed, and an empty lease still licenses nothing.

test('lease-check: a two-file clean lease still reports staged: 2, declared: 2 through the shared predicate', () => {
  const { repo, dir } = leaseRepo({ files: ['a.txt', 'src/b.js'] });
  stage(repo, 'a.txt');
  stage(repo, 'src/b.js');
  const r = leaseCheck(repo, dir, ['--phase', '1', '--plan', '1']);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.staged, 2);
  assert.equal(r.declared, 2);
  assert.equal(r.undeclared, undefined);
  assert.equal(r._exit, 0);
});

test('lease-check: a plan whose files: list is empty is still refused as undeclared-files, exit 1', () => {
  const { repo, dir } = leaseRepo({ files: [] });
  stage(repo, 'a.txt');
  const r = leaseCheck(repo, dir, ['--phase', '1', '--plan', '1']);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.reason, 'undeclared-files');
  assert.deepEqual(r.undeclared, ['a.txt']);
  assert.equal(r.declared, 0);
  assert.equal(r._exit, 1);
});

test('lease-check: PLAN-<k>.md is selected by --plan', () => {
  const { repo, dir, pdir } = leaseRepo({ plan: 'PLAN-1.md', files: ['a.txt'] });
  writeFileSync(join(pdir, 'PLAN-2.md'), '---\nphase: 1\nfiles:\n  - b.txt\n---\n# Plan 2\n');
  stage(repo, 'b.txt');
  assert.equal(leaseCheck(repo, dir, ['--phase', '1', '--plan', '2']).ok, true);
  const one = leaseCheck(repo, dir, ['--phase', '1', '--plan', '1']);
  assert.equal(one.ok, false);
  assert.deepEqual(one.undeclared, ['b.txt']);
});

test('lease-check: a sole declaration of ./a.txt licenses nothing - the spelling reached neither reader', () => {
  // The other half of the two-door refusal, at the enforcement end: the
  // declaration is dropped before this seam sees it, so staging the file it
  // MEANT is undeclared, and the named diagnostic rides the same envelope that
  // tells the author why.
  const { repo, dir } = leaseRepo({ files: ['./a.txt'] });
  stage(repo, 'a.txt');
  const r = leaseCheck(repo, dir, ['--phase', '1', '--plan', '1']);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.reason, 'undeclared-files');
  assert.deepEqual(r.undeclared, ['a.txt']);
  assert.equal(r.declared, 0);
  assert.deepEqual(r.frontmatter_issues.map((i) => [i.line, i.code]),
    [[4, 'redundant-path-segment']], JSON.stringify(r.frontmatter_issues));
  assert.equal(r._exit, 1);
});

test('lease-check: a missing plan is ok:false, never an empty-lease pass', () => {
  const { repo, dir } = leaseRepo({ files: ['a.txt'] });
  stage(repo, 'a.txt');
  const r = leaseCheck(repo, dir, ['--phase', '9', '--plan', '1']);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'no-plan');
  assert.equal(r._exit, 1);
});

test('lease-check: an unreadable staged set is ok:false, never a pass', () => {
  // Outside any git repo `rev-parse --show-toplevel` fails, and an unprovable
  // lease must refuse rather than report a clean one.
  const outside = mkdtempSync(join(tmpdir(), 'cad-lease-nogit-'));
  const dir = join(outside, '.planning');
  mkdirSync(join(dir, 'phases', '1'), { recursive: true });
  writeFileSync(join(dir, 'phases', '1', 'PLAN.md'), '---\nphase: 1\nfiles:\n  - a.txt\n---\n');
  const r = leaseCheck(outside, dir, ['--phase', '1', '--plan', '1']);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'no-staged-set');
});

test('lease-check: the no-staged-set detail names the failure without a credential', () => {
  // The fourth emit site EXP-01 covers, end to end rather than by source read:
  // `GIT_DIR` at an unreadable path makes the seam's own `git rev-parse
  // --show-toplevel` fail with `fatal: not a git repository: '<path>'`, and git
  // quotes the path back verbatim - so a path carrying userinfo puts a
  // credential straight into `detail`. Measured 2026-08-13 on git 2.55.0. No
  // network: the path does not exist and `.invalid` is reserved.
  const outside = mkdtempSync(join(tmpdir(), 'cad-lease-leak-'));
  const dir = join(outside, '.planning');
  mkdirSync(join(dir, 'phases', '1'), { recursive: true });
  writeFileSync(join(dir, 'phases', '1', 'PLAN.md'), '---\nphase: 1\nfiles:\n  - a.txt\n---\n');
  const r = leaseCheck(outside, dir, ['--phase', '1', '--plan', '1'],
    { GIT_DIR: '/nonexistent/cad:s3cr3t-tok@host.invalid/g' });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'no-staged-set');
  assert.ok(r.detail && r.detail.length > 0, JSON.stringify(r));
  assert.equal(r.detail.includes('s3cr3t-tok'), false, r.detail);
  assert.equal(r.detail.includes('cad:'), false, r.detail);
  // The rest of the message survives, or the redaction has traded one useless
  // envelope for another: the host, the path, and the seam's own wording.
  assert.ok(r.detail.includes('could not read the staged set'), r.detail);
  assert.ok(r.detail.includes('host.invalid'), r.detail);
  assert.ok(r.detail.includes('/nonexistent/'), r.detail);
});

test('source: planning.mjs\'s no-staged-set detail goes through redactUrl', () => {
  // The census, so a site added later fails here rather than shipping a
  // credential. planning.mjs carries FIVE other caught-error details this
  // requirement does not cover - partial-apply, write-failed, the
  // dispatch-level internal catch, `capture --text-file`'s read failure,
  // `capture-sections`' unreadable-capture and `uat record --fields-file`'s
  // JSON parse failure - so the pin is by COUNT: nine uses of the idiom,
  // exactly three of them wrapped. Adding a site moves the first number whether
  // or not the author remembered the helper.
  //
  // The three wrapped sites, all git failures on the same EXP-01 rail:
  // `cmdLeaseCheck`'s `no-staged-set` detail; `resolveRange`, where a failing
  // `git rev-parse` quotes back a remote URL that can carry credentials in its
  // userinfo, and whose redacted error is the detail BOTH `risk-check run`
  // (`no-diff`) and `risk-check status` (`unresolved-range`) emit; and
  // `risk-check run`'s own `git diff` catch. A git failure detail is exactly
  // the string EXP-01 covers, so a git call added to this file arrives wrapped
  // or this row goes red.
  //
  // Why `capture --text-file` and `capture-sections` are NOT wrapped: each
  // detail is an `fs` error over a path the CALLER just named, so the only
  // string it can echo is one the caller already holds. `redactUrl` targets a
  // credential arriving from a remote the user never typed, which a local path
  // read cannot be. `uat record --fields-file`'s parse failure is the same
  // class one step further in: a JSON syntax error over the caller's own file.
  // The `-file` transports' READ failures are not counted here at all - they
  // live in lib/text-flag-file.mjs, which this file-scoped census does not
  // walk, and they are the same caller-named-path class.
  const IDIOM = /e && e\.message \? e\.message : String\(e\)/g;
  const WRAPPED = /redactUrl\(e && e\.message \? e\.message : String\(e\)\)/g;
  const src = readFileSync(PLANNING, 'utf8');
  assert.equal((src.match(IDIOM) || []).length, 9, 'planning.mjs gained or lost a detail site');
  assert.equal((src.match(WRAPPED) || []).length, 3,
    'a git-failure detail (no-staged-set, resolveRange, or risk-check run\'s diff catch) is unredacted');
  assert.match(src, /could not read the staged set: \$\{redactUrl\(/);
});

test('lease-check: nothing staged is a clean lease, not a refusal', () => {
  const { repo, dir } = leaseRepo({ files: ['a.txt'] });
  const r = leaseCheck(repo, dir, ['--phase', '1', '--plan', '1']);
  assert.equal(r.ok, true);
  assert.equal(r.staged, 0);
});

test('lease-check: a plan declaring nothing licenses nothing', () => {
  const { repo, dir } = leaseRepo({ files: [] });
  stage(repo, 'a.txt');
  const r = leaseCheck(repo, dir, ['--phase', '1', '--plan', '1']);
  assert.equal(r.ok, false);
  assert.deepEqual(r.undeclared, ['a.txt']);
});

test('lease-check: bad flags are refused before any read', () => {
  const { repo, dir } = leaseRepo({});
  assert.equal(leaseCheck(repo, dir, ['--plan', '1']).reason, 'bad-args');
  assert.equal(leaseCheck(repo, dir, ['--phase', '1']).reason, 'bad-args');
  assert.equal(leaseCheck(repo, dir, ['--phase', '1', '--plan', 'x']).reason, 'bad-args');
});

/**
 * A git call inside a scratch lease repo with the user's own global/system
 * config neutralized - `commit.gpgsign` in a developer's global config would
 * otherwise make the seed commit prompt for a passphrase in CI.
 */
const leaseGit = (repo, args) => execFileSync('git', args, {
  cwd: repo,
  stdio: 'pipe',
  env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' },
});

test('lease-check: a rename is checked on BOTH sides, so another plan\'s file is not renamed away', () => {
  // src/other.js belongs to some OTHER plan: committed, and NOT declared here.
  // Renaming it onto this plan's declared `a.txt` destroys it, and a
  // destination-only read reports a clean lease.
  const { repo, dir } = leaseRepo({ files: ['a.txt'] });
  const src = join(repo, 'src', 'other.js');
  mkdirSync(dirname(src), { recursive: true });
  writeFileSync(src, 'module.exports = 1;\n');
  leaseGit(repo, ['add', '--', 'src/other.js']);
  leaseGit(repo, ['commit', '-qm', 'seed']);
  leaseGit(repo, ['mv', 'src/other.js', 'a.txt']);

  const r = leaseCheck(repo, dir, ['--phase', '1', '--plan', '1']);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.reason, 'undeclared-files');
  assert.ok(r.undeclared.includes('src/other.js'),
    `the rename SOURCE must be named: ${JSON.stringify(r)}`);
});

test('lease-check: a declared non-ASCII path is admitted, not refused for its bytes', () => {
  // At default `core.quotePath` git returns `"src/caf\303\251.js"` - quoted and
  // octal-escaped - and the lease refuses a path it was itself handed.
  const { repo, dir } = leaseRepo({ files: ['src/café.js'] });
  stage(repo, 'src/café.js');
  const r = leaseCheck(repo, dir, ['--phase', '1', '--plan', '1']);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.staged, 1);
});

/**
 * An absolute path under `repo` whose basename carries ONE byte that is not
 * valid UTF-8 (`src/caf<byte>.js`). Two different such bytes produce two
 * DIFFERENT paths that a utf8 decode renders identically as `src/caf<U+FFFD>.js`
 * - which is the whole point of the two cases below.
 */
const rawLeasePath = (repo, byte) => Buffer.concat([
  Buffer.from(`${repo}/src/caf`), Buffer.from([byte]), Buffer.from('.js'),
]);

/** A plan file written BYTE-EXACTLY, so `files:` can name a non-UTF-8 path. */
const rawPlan = (pdir, byte) => writeFileSync(join(pdir, 'PLAN.md'), Buffer.concat([
  Buffer.from('---\nphase: 1\nfiles:\n  - src/caf'), Buffer.from([byte]),
  Buffer.from('.js\n---\n# Plan\n'),
]));

test('lease-check: a rename between two un-decodable paths is never a clean lease', () => {
  // `git mv src/caf<0xE9>.js src/caf<0xFF>.js` with only the DESTINATION
  // declared destroys another plan's file. git reports it correctly
  // (`R100\0src/caf\351.js\0src/caf\377.js\0`), but reading that stream as a
  // utf8 STRING maps both invalid bytes to U+FFFD, the two paths collapse to
  // one, and the source is licensed by the destination's declaration.
  const { repo, dir, pdir } = leaseRepo({ files: [] });
  rawPlan(pdir, 0xFF);
  const src = rawLeasePath(repo, 0xE9);
  const dst = rawLeasePath(repo, 0xFF);
  mkdirSync(join(repo, 'src'), { recursive: true });
  writeFileSync(src, 'module.exports = 1;\n');
  leaseGit(repo, ['add', '-A']);
  leaseGit(repo, ['commit', '-qm', 'seed']);
  renameSync(src, dst);
  leaseGit(repo, ['add', '-A']);

  const r = leaseCheck(repo, dir, ['--phase', '1', '--plan', '1']);
  assert.notEqual(r.ok, true,
    `a rename destroying an undeclared file must not pass: ${JSON.stringify(r)}`);
  assert.equal(r.reason, 'unrepresentable-paths', JSON.stringify(r));
  assert.deepEqual(r.unrepresentable, ['"src/caf\\351.js"', '"src/caf\\377.js"']);
});

test('lease-check: a staged path that is not valid UTF-8 is refused BY NAME, never guessed at', () => {
  // The declared side is read from a utf8 plan file, so it cannot represent
  // this path either. Neither side of the comparison can be honest about it and
  // the gate says so, rather than matching two replacement characters and
  // licensing every sibling that differs only in its invalid bytes.
  const { repo, dir, pdir } = leaseRepo({ files: [] });
  rawPlan(pdir, 0xE9);
  leaseGit(repo, ['add', '-A']);
  leaseGit(repo, ['commit', '-qm', 'seed']);
  mkdirSync(join(repo, 'src'), { recursive: true });
  writeFileSync(rawLeasePath(repo, 0xE9), 'x');
  leaseGit(repo, ['add', '-A']);

  const r = leaseCheck(repo, dir, ['--phase', '1', '--plan', '1']);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.reason, 'unrepresentable-paths');
  assert.deepEqual(r.unrepresentable, ['"src/caf\\351.js"']);
  assert.equal(r._exit, 1);
});

// --- --phase carries the caller's spelling, at every shape site (D-02) -------
//
// `String(Number('1.10'))` is `'1.1'`, so every seam that built a phase
// directory from the NUMBER read a different phase's files and said ok:true
// about it. These rows are the falsifying fixtures: a tree where both
// spellings exist as separate directories, and a tree where the padded one
// does not exist at all.

test('lease-check: --phase 1.10 leases against phases/1.10, not phases/1.1', () => {
  const { repo, dir } = leaseRepo({ phase: '1.1', files: ['one-one.txt'] });
  const pdir = join(dir, 'phases', '1.10');
  mkdirSync(pdir, { recursive: true });
  writeFileSync(join(pdir, 'PLAN.md'), '---\nphase: 1.10\nfiles:\n  - one-ten.txt\n---\n# Plan\n');
  stage(repo, 'one-ten.txt');
  const r = leaseCheck(repo, dir, ['--phase', '1.10', '--plan', '1']);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.plan_file, '.planning/phases/1.10/PLAN.md');
  // ...and phase 1.1's own lease does NOT license 1.10's file.
  const other = leaseCheck(repo, dir, ['--phase', '1.1', '--plan', '1']);
  assert.equal(other.ok, false);
  assert.equal(other.plan_file, '.planning/phases/1.1/PLAN.md');
  assert.deepEqual(other.undeclared, ['one-ten.txt']);
});

test('lease-check: --phase 08 names phases/08, never answering about phases/8', () => {
  const { repo, dir } = leaseRepo({ phase: 8, files: ['a.txt'] });
  stage(repo, 'a.txt');
  const r = leaseCheck(repo, dir, ['--phase', '08', '--plan', '1']);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.reason, 'no-plan');
  assert.match(r.detail, /phases[/\\]08$/);
  assert.equal(r.hint, '/cad-plan 08');
});

test('plan-overlap: --phase 08 reports no-phase-dir naming phases/08', () => {
  const dir = makeTree({ roadmap: [{ n: 8, name: 'Eight' }], phases: { 8: { plan: true } } });
  const r = run(['plan-overlap', '--phase', '08'], dir);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.reason, 'no-phase-dir');
  assert.match(r.detail, /phases[/\\]08 not found$/);
  // ...and the legal spelling still answers.
  assert.equal(run(['plan-overlap', '--phase', '8'], dir).ok, true);
});

test('plan-overlap: --phase 1.10 intersects phases/1.10\'s plans', () => {
  const dir = makeTree({ roadmap: [{ n: 1, name: 'One' }] });
  // phases/1.1 holds a SINGLE plan; phases/1.10 holds two that overlap. A
  // normalizing reader answers "fewer than two plans - nothing to intersect".
  const one = join(dir, 'phases', '1.1');
  mkdirSync(one, { recursive: true });
  writeFileSync(join(one, 'PLAN.md'), '---\nphase: 1.1\nfiles:\n  - a.txt\n---\n# Plan\n');
  const ten = join(dir, 'phases', '1.10');
  mkdirSync(ten, { recursive: true });
  writeFileSync(join(ten, 'PLAN-1.md'), '---\nphase: 1.10\nfiles:\n  - shared.txt\n---\n# Plan 1\n');
  writeFileSync(join(ten, 'PLAN-2.md'), '---\nphase: 1.10\nfiles:\n  - shared.txt\n---\n# Plan 2\n');
  const r = run(['plan-overlap', '--phase', '1.10'], dir);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.note, undefined);
  assert.deepEqual(r.overlaps, [{ plans: ['PLAN-1.md', 'PLAN-2.md'], files: ['shared.txt'] }]);
  // The echoed phase stays the NUMBER - arithmetic and comparisons keep it.
  assert.equal(r.phase, 1.1);
});

test('uat: --phase 1.10 reads phases/1.10/UAT.md, never phase 1.1\'s checklist', () => {
  const dir = makeTree({ roadmap: [{ n: 1, name: 'One' }], phases: { '1.1': { uat: [{ status: 'pass' }] } } });
  const r = run(['uat', 'status', '--phase', '1.10'], dir);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.reason, 'no-uat');
  assert.match(r.detail, /phases[/\\]1\.10[/\\]UAT\.md not found$/);
  // ...and `uat init` on 1.10 writes ITS OWN file, leaving 1.1's untouched.
  const before = readFileSync(join(dir, 'phases', '1.1', 'UAT.md'), 'utf8');
  mkdirSync(join(dir, 'phases', '1.10'), { recursive: true });
  const init = run(['uat', 'init', '--phase', '1.10'], dir,
    JSON.stringify([{ name: 'ten', expected: 'ten' }]));
  assert.equal(init.ok, true, JSON.stringify(init));
  assert.match(init.file, /phases[/\\]1\.10[/\\]UAT\.md$/);
  assert.equal(readFileSync(join(dir, 'phases', '1.1', 'UAT.md'), 'utf8'), before);
  // The frontmatter LABEL is the caller's spelling too.
  assert.match(readFileSync(join(dir, 'phases', '1.10', 'UAT.md'), 'utf8'), /^phase: 1\.10$/m);
});

test('uat: a malformed --phase is refused in the shared wording, before any read', () => {
  const dir = makeTree({ roadmap: [{ n: 1, name: 'One' }], phases: { 1: { uat: [{ status: 'pass' }] } } });
  for (const bad of ['-1', '1e21', 'abc']) {
    const r = run(['uat', 'status', '--phase', bad], dir);
    assert.equal(r.ok, false, bad);
    assert.equal(r.reason, 'bad-args', bad);
  }
});

test('seed-reqs: --phase 08 is refused outright, never answering about phases/8', () => {
  // The claim this row has always made is that `08` never becomes `8` at this
  // face. It used to hold that by reading `phases/08` and reporting
  // `no-phase-dir`; since D-07 the spelling is refused at the door instead,
  // because this face WRITES the numeric half into a Traceability cell. The
  // sibling `plan-overlap --phase 08` row above still gets `no-phase-dir`,
  // which is what shows the refusal is scoped to the two write faces.
  const dir = makeTree({
    roadmap: [{ n: 8, name: 'Eight' }],
    phases: { 8: { plan: true, planReqs: ['FLD-01'] } },
    reqs: [],
  });
  writeFileSync(join(dir, 'REQUIREMENTS.md'),
    '# Requirements\n\n## Active\n\n- **FLD-01**: x\n\n## Traceability\n\n'
    + '| Requirement | Phase | Status |\n|---|---|---|\n');
  const r = run(['seed-reqs', '--phase', '08'], dir);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.reason, 'bad-args');
  assert.ok(r.detail.includes('"08"') && r.detail.includes('"8"'), r.detail);
  assert.equal(r._exit, 1);
  // ...and the legal spelling seeds.
  assert.deepEqual(run(['seed-reqs', '--phase', '8'], dir).seeded, ['FLD-01']);
});

// --- status: the phase-directory grammar, reported and never resolved --------
//
// D-01: Cadence states numeric-only as the grammar and REPORTS what violates it.
// It does not learn to resolve `08-meteogram-legend`, ship a `<N>-<slug>` second
// form, or migrate anything - so these rows assert a diagnostic, never a lookup.

/** `phases/<name>/` directories on a tree, created empty. */
function phaseDirs(dir, names) {
  for (const name of names) mkdirSync(join(dir, 'phases', name), { recursive: true });
  return dir;
}

const grammarDrift = (r) => (r.drift || []).filter((d) => d.kind === 'phase-dir-grammar');

test('status: named and zero-padded phase dirs are reported, grouped by prefix', () => {
  const dir = makeTree({ roadmap: [{ n: 1, name: 'One' }], phases: { 1: { plan: true } } });
  phaseDirs(dir, ['08-meteogram-legend', '08', '14-data-depth-x', '14-shared-derivation']);
  const r = run(['status'], dir);
  assert.equal(r.ok, true, JSON.stringify(r));
  const g = grammarDrift(r);
  assert.equal(g.length, 2, JSON.stringify(g));
  assert.deepEqual(g[0].entries, ['08', '08-meteogram-legend']);
  assert.match(g[0].detail, /share numeric prefix 8/);
  assert.deepEqual(g[1].entries, ['14-data-depth-x', '14-shared-derivation']);
  assert.match(g[1].detail, /share numeric prefix 14/);
  // The legal directory is never itself an entry, and the kind carries no
  // `phase` key - there is no phase number to report.
  assert.equal(g.some((d) => d.entries.includes('1')), false);
  assert.equal('phase' in g[0], false);
});

test('status: a tree of legal phase dirs reports no drift at all', () => {
  const dir = makeTree({
    roadmap: [{ n: 1, name: 'One' }, { n: 2, name: 'Two' }, { n: 10, name: 'Ten' }],
    phases: { 1: { plan: true }, 2: { plan: true }, 10: { plan: true } },
  });
  phaseDirs(dir, ['2.1']);
  const r = run(['status'], dir);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.drift, undefined, JSON.stringify(r.drift));
});

test('status: a stray FILE under phases/ is not a phase directory and is not reported', () => {
  const dir = makeTree({ roadmap: [{ n: 1, name: 'One' }], phases: { 1: { plan: true } } });
  writeFileSync(join(dir, 'phases', '.DS_Store'), 'junk');
  writeFileSync(join(dir, 'phases', 'notes.md'), '# scratch\n');
  const r = run(['status'], dir);
  assert.equal(r.ok, true);
  assert.deepEqual(grammarDrift(r), []);
});

test('status: 08 beside a legal 8 names the phase it collides with', () => {
  const dir = makeTree({ roadmap: [{ n: 8, name: 'Eight' }], phases: { 8: { plan: true } } });
  phaseDirs(dir, ['08']);
  const r = run(['status'], dir);
  const g = grammarDrift(r);
  assert.equal(g.length, 1, JSON.stringify(g));
  assert.deepEqual(g[0].entries, ['08']);   // exactly the illegal one
  assert.match(g[0].detail, /phases[/\\]?8 is the phase they collide with/);
  assert.match(g[0].detail, /is not a phase directory name/);
});

// --- trace ignore: the run record stays out of git by itself (FLD-02) --------
//
// The other `--root` subcommand, tested beside detect-commands for that reason.
// `--root` is the PROJECT root here (that is where `.gitignore` lives), and the
// write arm is scaffold-time only: `--check` is what /cad-health runs, and it
// may not edit a file it did not create (D-03).

/** A scratch PROJECT root, a git repo unless `git:false`. */
function ignoreRoot({ git = true, gitignore = null, planning = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'cad-ignore-'));
  if (git) {
    execFileSync('git', ['init', '-q'], { cwd: root });
    execFileSync('git', ['config', 'user.email', 't@example.com'], { cwd: root });
    execFileSync('git', ['config', 'user.name', 'T'], { cwd: root });
  }
  if (planning) mkdirSync(join(root, '.planning'), { recursive: true });
  if (gitignore !== null) writeFileSync(join(root, '.gitignore'), gitignore);
  return root;
}

/** `trace ignore` against a project root; parse its one JSON line. */
function traceIgnore(root, extra = []) {
  const args = root === null ? ['trace', 'ignore', ...extra]
    : ['trace', 'ignore', '--root', root, ...extra];
  try {
    return JSON.parse(execFileSync('node', [PLANNING, ...args], { encoding: 'utf8' }));
  } catch (e) {
    return JSON.parse(e.stdout);
  }
}

const gitignoreOf = (root) => readFileSync(join(root, '.gitignore'), 'utf8');

test('trace ignore: a fresh repo with no .gitignore gets the line written', () => {
  const root = ignoreRoot();
  const r = traceIgnore(root);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.written, true);
  assert.equal(r.ignored, false);         // the state as FOUND
  assert.equal(r.tracked, false);
  assert.equal(r.line, '.planning/trace.jsonl');
  assert.match(gitignoreOf(root), /^\.planning\/trace\.jsonl$/m);
});

test('trace ignore: a re-run adds no second line and touches no byte', () => {
  const root = ignoreRoot();
  assert.equal(traceIgnore(root).written, true);
  const after = gitignoreOf(root);
  const again = traceIgnore(root);
  assert.equal(again.written, false);
  assert.equal(again.reason, 'already-ignored');
  assert.equal(again.ignored, true);
  assert.equal(gitignoreOf(root), after);
});

test('trace ignore: a brownfield .gitignore keeps every line it had', () => {
  // No trailing newline, deliberately: the shape that would otherwise glue the
  // new line onto the last existing one.
  const root = ignoreRoot({ gitignore: 'node_modules/\ndist/\n*.log' });
  const r = traceIgnore(root);
  assert.equal(r.written, true, JSON.stringify(r));
  const lines = gitignoreOf(root).split('\n');
  for (const kept of ['node_modules/', 'dist/', '*.log']) {
    assert.ok(lines.includes(kept), `lost ${kept}: ${JSON.stringify(lines)}`);
  }
  assert.ok(lines.includes('.planning/trace.jsonl'), JSON.stringify(lines));
});

test('trace ignore: a project ignoring .planning/ wholesale is already correct', () => {
  const root = ignoreRoot({ gitignore: '.planning/\n' });
  const r = traceIgnore(root, ['--check']);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.ignored, true);
  assert.equal(r.method, 'git');          // only git can see a directory rule
  assert.equal(r.written, false);
  // ...and --check never writes, so the file is exactly what it was.
  assert.equal(gitignoreOf(root), '.planning/\n');
  // The write arm agrees: nothing to add.
  assert.equal(traceIgnore(root).written, false);
  assert.equal(gitignoreOf(root), '.planning/\n');
});

test('trace ignore: a non-git root falls back to the literal scan and still writes', () => {
  const root = ignoreRoot({ git: false });
  const r = traceIgnore(root);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.method, 'file');
  assert.equal(r.written, true);
  assert.equal(r.tracked, false);
  assert.match(gitignoreOf(root), /^\.planning\/trace\.jsonl$/m);
  // ...and the literal scan reads its own write back on the next run.
  assert.equal(traceIgnore(root).reason, 'already-ignored');
});

test('trace ignore: a tracked run record is REPORTED, never quietly ignored', () => {
  const root = ignoreRoot();
  writeFileSync(join(root, '.planning', 'trace.jsonl'), '{"phase":1}\n');
  execFileSync('git', ['add', '--', '.planning/trace.jsonl'], { cwd: root });
  const r = traceIgnore(root, ['--check']);
  assert.equal(r.tracked, true, JSON.stringify(r));
  assert.equal(r.ignored, false);
});

test('trace ignore: a TRACKED record whose line is present reports ignored and writes nothing', () => {
  // The regression the `--no-index` flag closes. `check-ignore` answers "would
  // this path be ignored if it were untracked", so a path in the INDEX matched
  // nothing at all: `ignored` came back false with the rule sitting right there
  // in `.gitignore`, and the write arm - which keys off that value - appended the
  // comment and the line again on EVERY run. Two runs left three copies.
  const root = ignoreRoot({ gitignore: '.planning/trace.jsonl\n' });
  writeFileSync(join(root, '.planning', 'trace.jsonl'), '{"phase":1}\n');
  execFileSync('git', ['add', '-f', '--', '.planning/trace.jsonl'], { cwd: root });
  const check = traceIgnore(root, ['--check']);
  assert.equal(check.ignored, true, JSON.stringify(check));
  assert.equal(check.tracked, true, JSON.stringify(check));
  assert.equal(check.method, 'git');
  assert.match(check.source, /\.gitignore$/);
  // Both facts survive together: the rule is there AND the file is still indexed,
  // which is the state whose remedy is `git rm --cached` and not another line.
  const before = gitignoreOf(root);
  assert.equal(traceIgnore(root).written, false);
  assert.equal(traceIgnore(root).written, false);
  assert.equal(gitignoreOf(root), before);
  assert.equal(gitignoreOf(root).match(/^\.planning\/trace\.jsonl$/gm).length, 1);
});

test('trace ignore: a .git/info/exclude match does NOT satisfy the line', () => {
  // The reason `-v` is used instead of `-q`: neither `.git/info/exclude` nor
  // core.excludesFile is cloned, so a machine-local exclusion would report
  // ignored:true and leave the project with no line of its own - and the
  // collaborator who clones it commits the run record.
  const root = ignoreRoot();
  writeFileSync(join(root, '.git', 'info', 'exclude'), '.planning/trace.jsonl\n');
  const check = traceIgnore(root, ['--check']);
  assert.equal(check.ignored, false, JSON.stringify(check));
  assert.equal(check.method, 'git');
  assert.match(check.source, /exclude$/);
  const r = traceIgnore(root);
  assert.equal(r.written, true, JSON.stringify(r));
  assert.match(gitignoreOf(root), /^\.planning\/trace\.jsonl$/m);
});

test('trace ignore: a --root present with nothing usable is refused, never the cwd', () => {
  const root = ignoreRoot();
  // A valueless flag: parseArgs renders it as boolean true.
  const bare = traceIgnore(null, ['--root']);
  assert.equal(bare.ok, false, JSON.stringify(bare));
  assert.equal(bare.reason, 'bad-args');
  assert.match(bare.detail, /--root/);
  const empty = traceIgnore('');
  assert.equal(empty.ok, false, JSON.stringify(empty));
  assert.equal(empty.reason, 'bad-args');
  // ...and the usable form still works, so the guard is not refusing everything.
  assert.equal(traceIgnore(root).ok, true);
});

// --- debt-harvest: markers in tracked code reach the queue (DBT-01) ----------
//
// The token is BUILT from the export, never typed as a literal followed by a
// colon: the harvest scans this tracked test file, and a literal marker here
// would be collected as a real one - breaking `debt-harvest --root .` over this
// repo, which must report zero.
const debtLine = (text, ceiling, trigger) => {
  const fields = [` ${text}`];
  if (ceiling) fields.push(` ceiling: ${ceiling}`);
  if (trigger) fields.push(` trigger: ${trigger}`);
  return `${DEBT_TOKEN}:${fields.join(' |')}`;
};

/** A scratch PROJECT root that is a git repo, with `.planning/` present. */
function debtRepo() {
  const root = mkdtempSync(join(tmpdir(), 'cad-debt-'));
  execFileSync('git', ['init', '-q'], { cwd: root });
  execFileSync('git', ['config', 'user.email', 't@example.com'], { cwd: root });
  execFileSync('git', ['config', 'user.name', 'T'], { cwd: root });
  mkdirSync(join(root, '.planning'), { recursive: true });
  return root;
}

/** Write a file under the root and `git add` it (optionally forced). */
function debtAdd(root, rel, body, force = false) {
  const abs = join(root, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, body);
  execFileSync('git', ['add', ...(force ? ['-f'] : []), '--', rel], { cwd: root });
}

/** `debt-harvest` against a project root; parse its one JSON line. */
function harvest(root, extra = []) {
  const args = root === null ? ['debt-harvest', ...extra]
    : ['debt-harvest', '--root', root, ...extra];
  try {
    return JSON.parse(execFileSync('node', [PLANNING, ...args], { encoding: 'utf8' }));
  } catch (e) {
    return JSON.parse(e.stdout);
  }
}

const captureOf = (root) => readFileSync(join(root, '.planning', 'CAPTURE.md'), 'utf8');

test('debt-harvest: a planted marker is collected with its ceiling and trigger', () => {
  const root = debtRepo();
  debtAdd(root, 'src/a.js', `// ${debtLine('single-tenant only', 'no tenant column', 'tenant two')}\n`);
  const r = harvest(root);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.markers, 1);
  assert.equal(r.written, true);
  const body = captureOf(root);
  assert.match(body, /## Debt markers/);
  assert.match(body, /- `src\/a\.js:1` single-tenant only - ceiling: no tenant column - trigger: tenant two/);
});

test('debt-harvest: the 19 conventional markers contribute NOTHING (AC5)', () => {
  const root = debtRepo();
  debtAdd(root, 'src/b.js', ['// TODO: fix this', '// FIXME: broken', '// XXX: careful',
    '// HACK: works for now', '// NOTE: read me', '// placeholder', '// not implemented',
    '// SHORTCUT: nope', '// DEBT: nope', '// CORNER: nope', '// TRIPWIRE: nope',
    '// CUT: nope', '// CEILING: nope', '// CAD-DEBT: nope', '// todo!()',
    '// unimplemented!()', '// WIP', '// REVIEW', '// OPTIMIZE'].join('\n'));
  const r = harvest(root);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.markers, 0);
  assert.match(captureOf(root), /## Debt markers\n\n- None\.\n/);
});

test('debt-harvest: an untracked file and an ignored node_modules contribute nothing (AC5)', () => {
  const root = debtRepo();
  debtAdd(root, 'src/a.js', `// ${debtLine('tracked cut', 'c', 't')}\n`);
  // Untracked: `git ls-files` never lists it.
  mkdirSync(join(root, 'src'), { recursive: true });
  writeFileSync(join(root, 'src', 'untracked.js'), `// ${debtLine('untracked cut', 'c', 't')}\n`);
  // Ignored AND untracked: the ordinary node_modules case.
  writeFileSync(join(root, '.gitignore'), 'node_modules/\n');
  execFileSync('git', ['add', '--', '.gitignore'], { cwd: root });
  mkdirSync(join(root, 'node_modules', 'pkg'), { recursive: true });
  writeFileSync(join(root, 'node_modules', 'pkg', 'x.js'), `// ${debtLine('vendor cut', 'c', 't')}\n`);
  const r = harvest(root);
  assert.equal(r.markers, 1, JSON.stringify(r));
  assert.match(captureOf(root), /tracked cut/);
  assert.doesNotMatch(captureOf(root), /untracked cut|vendor cut/);
});

test('debt-harvest: a FORCE-ADDED node_modules file is enumerated and still skipped', () => {
  // The claim `git ls-files` does NOT support: an ignore rule does not remove an
  // already-tracked path, so `ls-files` lists a force-added node_modules file.
  // The explicit segment skip is what keeps third-party markers out, and this is
  // the fixture that fails without it.
  const root = debtRepo();
  writeFileSync(join(root, '.gitignore'), 'node_modules/\n');
  execFileSync('git', ['add', '--', '.gitignore'], { cwd: root });
  debtAdd(root, 'node_modules/pkg/y.js', `// ${debtLine('vendor cut', 'c', 't')}\n`, true);
  // The premise: git really does enumerate it.
  const listed = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' });
  assert.match(listed, /node_modules\/pkg\/y\.js/, 'fixture is wrong: git did not track it');
  const r = harvest(root);
  assert.equal(r.markers, 0, JSON.stringify(r));
});

test('debt-harvest: running twice leaves CAPTURE.md byte-identical (AC6)', () => {
  const root = debtRepo();
  debtAdd(root, 'src/a.js', `// ${debtLine('a cut', 'c', 't')}\n`);
  const first = harvest(root);
  assert.equal(first.written, true);
  const after = captureOf(root);
  const second = harvest(root);
  assert.equal(second.written, false, JSON.stringify(second));
  assert.equal(second.markers, 1);
  assert.equal(captureOf(root), after);
});

test('debt-harvest: ## Todos is never touched, and a deleted marker disappears (AC6)', () => {
  const root = debtRepo();
  const todos = '## Todos\n\n- [ ] (phase 1) a hand-written item\n\n## Seeds\n\n- a seed\n';
  writeFileSync(join(root, '.planning', 'CAPTURE.md'), todos);
  debtAdd(root, 'src/a.js', `// ${debtLine('a cut', 'c', 't')}\n`);
  harvest(root);
  assert.match(captureOf(root), /- \[ \] \(phase 1\) a hand-written item/);
  assert.match(captureOf(root), /a cut/);
  // Delete the marker from source: its bullet goes, the hand-written queue stays.
  writeFileSync(join(root, 'src', 'a.js'), '// nothing to see\n');
  const r = harvest(root);
  assert.equal(r.markers, 0, JSON.stringify(r));
  assert.doesNotMatch(captureOf(root), /a cut/);
  assert.match(captureOf(root), /- \[ \] \(phase 1\) a hand-written item/);
  assert.match(captureOf(root), /- a seed/);
  // Every pre-existing section survived the rewrite.
  assert.ok(captureOf(root).startsWith(todos.split('\n')[0]));
});

test('debt-harvest: a fenced ## line in someone else\'s bullet is never touched (D-12)', () => {
  // The harvest rewrites ONE section, so a `## ` line fenced inside a `## Todos`
  // bullet sits in the untouched prefix and survives whatever the bound does.
  // This row pins that the rewrite does not reach it; the row BELOW is the one
  // that proves the bound itself.
  const root = debtRepo();
  const fenced = '## Todos\n\n- [ ] keep this bullet:\n\n  ```sh\n  ## build output\n  make dist\n  ```\n\n'
    + '## Debt markers\n\n- None.\n';
  writeFileSync(join(root, '.planning', 'CAPTURE.md'), fenced);
  debtAdd(root, 'src/a.js', `// ${debtLine('a cut', 'c', 't')}\n`);
  harvest(root);
  const body = captureOf(root);
  assert.match(body, /## build output/);          // not truncated mid-fence
  assert.equal((body.match(/```/g) || []).length, 2, 'fence count must stay even');
  assert.match(body, /make dist/);
  assert.match(body, /a cut/);
});

test('debt-harvest: the section bound reads a fence, so stale debris cannot survive (D-12)', () => {
  // The fixture where the bound actually DECIDES: `## Debt markers` comes FIRST
  // and holds a stale fenced block whose content has a `## ` line. A bare
  // `/^## /` boundary test stops INSIDE that fence, so everything from
  // `## build output` down - an unclosed fence and its debris - is kept as the
  // tail and re-emitted after the new body, leaving an odd fence count and
  // rendering the rest of the queue as code. `sectionBound` skips fenced lines,
  // so the whole stale section is replaced and `## Todos` is the real boundary.
  const root = debtRepo();
  // The `## ` line must be at column 0 INSIDE the fence: `sectionBound`'s own
  // heading test is `/^## /`, so an INDENTED `  ## build output` is invisible to
  // both readers and would make this row pass either way.
  writeFileSync(join(root, '.planning', 'CAPTURE.md'),
    '## Debt markers\n\n- [ ] stale hand note:\n\n```sh\n## build output\nmake dist\n```\n\n'
    + '## Todos\n\n- [ ] a hand-written item\n');
  debtAdd(root, 'src/a.js', `// ${debtLine('a cut', 'c', 't')}\n`);
  harvest(root);
  const body = captureOf(root);
  assert.match(body, /a cut/);
  assert.match(body, /- \[ \] a hand-written item/);   // the real next section survives
  assert.doesNotMatch(body, /## build output/, 'stale fenced debris survived the rewrite');
  assert.doesNotMatch(body, /make dist/);
  assert.equal((body.match(/```/g) || []).length, 0, 'an unclosed fence was left behind');
});

test('debt-harvest: a FENCED example of the owned heading is not mistaken for it', () => {
  // The START boundary, which `sectionBound` never covered: the two rows above
  // both hand `replaceSection` a heading it finds in the right place, and a bare
  // `lines.findIndex((l) => l.trim() === heading)` passes them. Here the document
  // has NO real `## Debt markers` - only a fenced EXAMPLE of one inside a `##
  // Todos` bullet - so a fence-blind search anchors the rewrite inside that code
  // block. The scan then resumes mid-fence, reads the block's CLOSING fence as an
  // opener, finds no boundary at all, and every later section is replaced by the
  // new body: `## Seeds` and `## Notes` disappear outright. The correct answer is
  // to leave the example alone and APPEND a real section at the end.
  const root = debtRepo();
  writeFileSync(join(root, '.planning', 'CAPTURE.md'),
    '## Todos\n\n- [ ] document the marker grammar, like:\n\n```md\n## Debt markers\n'
    + '- `src/x.js:1` an example bullet\n```\n\n'
    + '## Seeds\n\n- [ ] a seed\n\n## Notes\n\n- keep me\n');
  debtAdd(root, 'src/a.js', `// ${debtLine('a cut', 'c', 't')}\n`);
  harvest(root);
  const body = captureOf(root);
  assert.match(body, /- \[ \] a seed/, '## Seeds was destroyed by a false start boundary');
  assert.match(body, /- keep me/, '## Notes was destroyed by a false start boundary');
  assert.match(body, /- \[ \] document the marker grammar/);
  assert.match(body, /an example bullet/, 'the fenced example was rewritten');
  assert.equal((body.match(/```/g) || []).length, 2, 'fence count must stay even');
  // ...and the real section landed, appended after the document rather than into
  // the example.
  assert.match(body, /a cut/);
  assert.ok(body.indexOf('- keep me') < body.lastIndexOf('## Debt markers'),
    'the real section must be appended AFTER the existing content');
});

test('debt-harvest: a TRACKED CAPTURE.md already holding a section stays idempotent', () => {
  // The self-ingestion guard: `.planning/` is skipped, so the harvest's own
  // output is never read back as a marker even where the queue is tracked.
  const root = debtRepo();
  debtAdd(root, 'src/a.js', `// ${debtLine('a cut', 'c', 't')}\n`);
  harvest(root);
  execFileSync('git', ['add', '--', '.planning/CAPTURE.md'], { cwd: root });
  const after = captureOf(root);
  const r = harvest(root);
  assert.equal(r.markers, 1, JSON.stringify(r));   // still 1, not 2
  assert.equal(r.written, false);
  assert.equal(captureOf(root), after);
});

test('debt-harvest: a malformed marker is reported, never dropped', () => {
  const root = debtRepo();
  debtAdd(root, 'src/a.js', `// ${debtLine('no trigger stated', 'a ceiling', null)}\n`);
  const r = harvest(root);
  assert.equal(r.markers, 1);
  assert.deepEqual(r.malformed, [{ path: 'src/a.js', line: 1, missing: ['trigger'] }]);
  assert.match(captureOf(root), /trigger: \(unstated\)/);
});

test('debt-harvest: a tracked SYMLINK out of the tree contributes nothing', () => {
  // `statSync`/`readFileSync` both follow a link, so the harvest read a file the
  // project does not contain and filed its marker under the in-tree path - a
  // corner-cut reported at a line that holds no marker. A tracked link's target is
  // either in the tree (enumerated on its own path) or outside it, so skipping
  // links loses nothing that belongs here.
  const root = debtRepo();
  const outside = join(mkdtempSync(join(tmpdir(), 'cad-debt-out-')), 'outside.js');
  writeFileSync(outside, `// ${debtLine('external cut', 'cx', 'tx')}\n`);
  mkdirSync(join(root, 'src'), { recursive: true });
  symlinkSync(outside, join(root, 'src', 'link.js'));
  execFileSync('git', ['add', '--', 'src/link.js'], { cwd: root });
  debtAdd(root, 'src/real.js', `// ${debtLine('in-tree cut', 'c', 't')}\n`);
  const r = harvest(root);
  assert.equal(r.markers, 1, JSON.stringify(r));
  const body = captureOf(root);
  assert.match(body, /in-tree cut/);
  assert.doesNotMatch(body, /external cut/, 'a symlink target outside the tree was read');
  assert.doesNotMatch(body, /link\.js/);
});

test('debt-harvest: a non-git root is ok:false, never a zero-marker answer', () => {
  const root = mkdtempSync(join(tmpdir(), 'cad-debt-nogit-'));
  mkdirSync(join(root, '.planning'), { recursive: true });
  const r = harvest(root);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.reason, 'no-git');
  assert.equal(existsSync(join(root, '.planning', 'CAPTURE.md')), false);
});

test('debt-harvest: a --root present with nothing usable is refused, never the cwd', () => {
  const bare = harvest(null, ['--root']);
  assert.equal(bare.ok, false, JSON.stringify(bare));
  assert.equal(bare.reason, 'bad-args');
  const empty = harvest('');
  assert.equal(empty.ok, false, JSON.stringify(empty));
  assert.equal(empty.reason, 'bad-args');
});

test('debt-harvest: an absent CAPTURE.md is created with the /cad-capture headings', () => {
  const root = debtRepo();
  debtAdd(root, 'src/a.js', `// ${debtLine('a cut', 'c', 't')}\n`);
  harvest(root);
  const body = captureOf(root);
  for (const h of ['## Todos', '## Seeds', '## Notes', '## Debt markers']) {
    assert.ok(body.includes(h), `missing ${h}: ${body}`);
  }
});

test('debt-harvest: a planning doc QUOTING a literal marker is not harvested', () => {
  // The fixture the `.planning/` skip actually needs. Removing the skip does NOT
  // redden the tracked-CAPTURE.md row above - the rendered section carries no
  // token, so the harvest cannot re-ingest its own output through it. What the
  // skip really protects is a planning DOC that writes a literal marker line
  // while describing one: a PLAN, a CONTEXT or a SUMMARY quoting the grammar
  // would otherwise land in the queue as a real corner-cut, on a phase that cut
  // nothing.
  const root = debtRepo();
  debtAdd(root, 'src/a.js', `// ${debtLine('a real cut', 'c', 't')}\n`);
  debtAdd(root, '.planning/phases/1/PLAN.md',
    `# Plan\n\nMark it like this: \`${debtLine('example only', 'nothing', 'never')}\`\n`);
  const r = harvest(root);
  assert.equal(r.markers, 1, JSON.stringify(r));
  assert.match(captureOf(root), /a real cut/);
  assert.doesNotMatch(captureOf(root), /example only/);
});

// --- milestone-prune: the --label guard -----------------------------------------
// The seam's transforms and its happy paths live in milestone-prune.test.mjs;
// what is here is the argument face, which is planning.mjs's own.
//
// Reproduced 2026-08-13: `--label '../../../outside-tree'` moved phases/1 clean
// out of the planning root and answered {"ok":true,"action":"pruned"}.

function pruneTree() {
  return makeTree({
    roadmap: [{ n: 1, name: 'One', checked: true }, { n: 2, name: 'Two' }],
    phases: { 1: { plan: true }, 2: { plan: true } },
    reqs: [['REQ-1', 1, 'Complete']],
  });
}

for (const mode of ['archive', 'delete']) {
  test(`milestone-prune --mode ${mode}: a --label escaping the tree is refused before any mkdir or rename`, () => {
    const dir = pruneTree();
    const escapee = resolve(dir, '_archive-../../../outside-tree');
    const roadmapBefore = readFileSync(join(dir, 'ROADMAP.md'), 'utf8');
    const r = run(['milestone-prune', '--label', '../../../outside-tree', '--mode', mode], dir);
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'bad-args');
    assert.match(r.detail, /inside the planning root/);
    assert.deepEqual(readdirSync(join(dir, 'phases')).sort(), ['1', '2']);
    assert.equal(existsSync(escapee), false, `created ${escapee} outside the planning root`);
    assert.equal(readFileSync(join(dir, 'ROADMAP.md'), 'utf8'), roadmapBefore);
  });
}

// archiveRequirements writes the label into a markdown table cell, where either
// character silently rewrites the row it lands in.
for (const [name, label] of [['a pipe', 'v2|Complete|'], ['a newline', 'v2\nrogue row'],
  ['a carriage return', 'v2\rrogue row']]) {
  test(`milestone-prune: a --label containing ${name} is refused`, () => {
    const dir = pruneTree();
    const r = run(['milestone-prune', '--label', label, '--mode', 'archive'], dir);
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'bad-args');
    assert.match(r.detail, /"\|" or a newline/);
    assert.deepEqual(readdirSync(join(dir, 'phases')).sort(), ['1', '2']);
  });
}

// The guard is NOT publish-decision.mjs's REMOTE_NAME shape (D-13): an untagged
// close labels the archive with the milestone NAME from PROJECT.md, spaces and
// all, so a no-spaces regex would refuse this very milestone.
test('milestone-prune: a spaced milestone-name label still prunes normally', () => {
  const dir = pruneTree();
  const label = 'the controls that reported success';
  const r = run(['milestone-prune', '--label', label, '--mode', 'archive'], dir);
  assert.equal(r.ok, true);
  assert.equal(r.action, 'pruned');
  assert.deepEqual(r.phases, [1]);
  assert.equal(existsSync(join(dir, `_archive-${label}`, '1', 'PLAN.md')), true);
  assert.deepEqual(readdirSync(join(dir, 'phases')).sort(), ['2']);
  assert.match(readFileSync(join(dir, 'REQUIREMENTS.md'), 'utf8'), new RegExp(label));
});

// --- capture-sections: the out-of-walk census (AC4) --------------------------
// D-07: a STANDALONE subcommand, not a drift kind inside `status`, whose early
// returns would starve exactly the trees most likely to hold a mangled
// CAPTURE.md. D-06: unconditional, no allowlist - an `Archive` + `Debt markers`
// exemption would have reported nothing on the incident this exists for.

/** A queue with both walked and out-of-walk sections, written by hand. */
const QUEUE = '# Capture\n\n## Todos\n\n- [ ] (phase 1) live one\n- [ ] live two\n\n'
  + '## Seeds\n\n- a seed\n\n## Notes\n\n- None.\n\n'
  + '## Archive\n\n- retired a\n- retired b\n\n## Debt markers\n\n- a marker\n';

test('capture-sections: every section is named with its count and its walk membership', () => {
  const dir = makeTree({ roadmap: [{ n: 1, name: 'One' }] });
  writeFileSync(join(dir, 'CAPTURE.md'), QUEUE);
  const r = run(['capture-sections'], dir);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.exists, true);
  assert.deepEqual(r.walk, ['Todos', 'Seeds', 'Notes']);
  assert.deepEqual(r.sections, [
    { heading: 'Todos', bullets: 2, in_walk: true },
    { heading: 'Seeds', bullets: 1, in_walk: true },
    { heading: 'Notes', bullets: 1, in_walk: true },
    { heading: 'Archive', bullets: 2, in_walk: false },
    { heading: 'Debt markers', bullets: 1, in_walk: false },
  ]);
});

test('capture-sections: a bullet appended to an out-of-walk section raises THAT count and no other (AC4)', () => {
  const dir = makeTree({ roadmap: [{ n: 1, name: 'One' }] });
  const file = join(dir, 'CAPTURE.md');
  writeFileSync(file, QUEUE);
  const before = run(['capture-sections'], dir).sections;
  writeFileSync(file, readFileSync(file, 'utf8')
    .replace('- retired b\n', '- retired b\n- retired c\n'));
  const after = run(['capture-sections'], dir).sections;
  assert.equal(after.length, before.length);
  for (let i = 0; i < before.length; i++) {
    assert.equal(after[i].heading, before[i].heading);
    assert.equal(after[i].in_walk, before[i].in_walk);
    assert.equal(after[i].bullets, before[i].bullets + (before[i].heading === 'Archive' ? 1 : 0),
      `${before[i].heading} moved unexpectedly`);
  }
});

test('capture-sections: an absent CAPTURE.md is ok:true with no sections, never a failure', () => {
  const dir = makeTree({ roadmap: [{ n: 1, name: 'One' }] });
  const r = run(['capture-sections'], dir);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.exists, false);
  assert.deepEqual(r.sections, []);
  assert.equal(r._exit, 0);
});

test('capture-sections: a VALUELESS --file is bad-args, never silently the --dir default', () => {
  const dir = makeTree({ roadmap: [{ n: 1, name: 'One' }] });
  writeFileSync(join(dir, 'CAPTURE.md'), QUEUE);
  const r = run(['capture-sections', '--file'], dir);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'bad-args');
});
