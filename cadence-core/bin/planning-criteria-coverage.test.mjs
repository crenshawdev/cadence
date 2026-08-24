// Zero-dep tests for `planning.mjs` criteria-coverage. Run:
// node --test 'cadence-core/bin/*.test.mjs'
//
// Split out of planning.test.mjs in phase 4, verbatim: the arms, their fixture
// builders and their comments are unchanged, only their home is. The shared
// harness stays in planning.test.mjs and is imported, never copied - two copies
// of `makeTree` is how two fixtures drift apart.
//
// The `test` binding below is a no-op unless this module IS the entry file, so
// a sibling that imports a fixture from here registers nothing twice.
import { test as nodeTest } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, chmodSync, rmSync, realpathSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PLANNING, makeTree, run } from './planning.test.mjs';

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
