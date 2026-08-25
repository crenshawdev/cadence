// Zero-dep tests for `planning.mjs audit` - the traceability gate, its
// unseeded/unpicked and nonconforming_plans arms, version_drift, the
// sanctioned rolled-over phase (DRF-02) and the tag-ownership rail (TAG-01).
// Run: node --test 'cadence-core/bin/*.test.mjs'
//
// Split out of planning.test.mjs in phase 4, verbatim: the arms, their fixture
// builders and their comments are unchanged, only their home is. The shared
// harness stays in planning.test.mjs and is imported, never copied - two copies
// of `makeTree` is how two fixtures drift apart. `blockPlanTree` comes from
// planning-plans.test.mjs for the same reason.
//
// The `test` binding below is a no-op unless this module IS the entry file, so
// a sibling that imports a fixture from here registers nothing twice.
import { test as nodeTest } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, renameSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { makeTree, run } from './planning.test.mjs';
import { blockPlanTree } from './planning-plans.test.mjs';

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
export const GIT_FIXTURE_ENV = {
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
