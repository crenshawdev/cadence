// Zero-dep tests for `planning.mjs status`. Run:
// node --test 'cadence-core/bin/*.test.mjs'
//
// Split out of planning.test.mjs in phase 4, verbatim: the arms and their
// comments are unchanged, only their home is. The fixture harness stays in
// planning.test.mjs and is imported, never copied - two copies of `makeTree`
// is how two fixtures drift apart.
//
// The `test` binding below is a no-op unless this module IS the entry file,
// so a sibling that imports a fixture from here registers nothing twice.
import { test as nodeTest } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { makeTree, run } from './planning.test.mjs';

/** True iff this module is what node was told to run; realpath on both sides so
 * a symlinked checkout still matches (config-seams.test.mjs D-19). */
function isEntryFile() {
  const argv1 = process.argv[1];
  if (typeof argv1 !== 'string' || argv1 === '') return false;
  try {
    return pathToFileURL(realpathSync(argv1)).href === pathToFileURL(realpathSync(fileURLToPath(import.meta.url))).href;
  } catch { return false; }
}

/** `node:test`'s `test` when run directly, a no-op when imported (see header). */
const test = isEntryFile() ? nodeTest : () => {};

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
