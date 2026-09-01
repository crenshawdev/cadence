// Zero-dep tests for one subject: prose that COPIES a machine-readable fact
// must still match that fact. Every check here reads a live document and the
// artifact it copies from - a route table, a resolver's own output, a measured
// byte count - and fails when the two have drifted apart.
//
// Why here and not in self-verify.mjs. Two of these subjects are cells of the
// Wiring table in cadence-core/references/review-triggers.md, and
// self-verify.mjs:927 records a standing decision NOT to parse that table:
// it has no stated grammar, so a check built on its shape goes red on a
// reformat that changed no fact (the failure mode lib/deferred-reads.mjs
// documents). These tests parse one NAMED ROW each instead of the table's
// shape, and they live in a test file rather than in the linter so the
// decision stays intact.
//
// Run: node --test 'cadence-core/bin/*.test.mjs' - CI's own glob, which is why
// this is a top-level file and not one under lib/. tsconfig.ci.json excludes
// *.test.mjs, so nothing here carries an @ts-check burden.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, writeFileSync, mkdtempSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { activeVersion } from './lib/branch-decision.mjs';
import { weighAll } from './lib/surface-weight.mjs';
import { DEFERRED_READS, regionLabels } from './lib/deferred-reads.mjs';
import { CATEGORIES, scanTree, interviewOptions } from './lib/surface-scan.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const ROUTE = join(HERE, 'route.mjs');

/** A repo file as text. */
const doc = (...parts) => readFileSync(join(REPO, ...parts), 'utf8');

/**
 * The row of a pipe table whose FIRST cell names `label`, as trimmed cells.
 * One named row, never the table's shape: self-verify.mjs:927's standing
 * decision is that this table has no stated grammar, so a check that asserted
 * column counts or ordering would go red on a reformat that changed no fact.
 */
function tableRow(text, label) {
  const line = text.split('\n').find((l) =>
    l.startsWith('|') && l.split('|')[1] !== undefined
    && l.split('|')[1].trim().replace(/`/g, '') === label);
  assert.ok(line, `no table row for ${label}`);
  return line.split('|').slice(1, -1).map((c) => c.trim());
}

/**
 * Count words the prose may spell a dimension total with. A table rather than
 * a regex over digits: these documents write the number in WORDS, and a lookup
 * that silently returns 0 for an unlisted word would turn a renamed count into
 * a passing check instead of a loud one.
 */
const WORD_TO_NUMBER = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  seven: 7, eight: 8, nine: 9, ten: 10,
};

/** The number a count word stands for, asserting the word is one we know. */
function countWord(word, where) {
  const n = WORD_TO_NUMBER[String(word).toLowerCase()];
  assert.ok(n !== undefined, `${where}: unrecognised count word ${JSON.stringify(word)}`);
  return n;
}

// --- DFC-03: the plan checker's dimension count agrees with itself -----------

test('cad-plan-checker-contract states one dimension count in all three places', () => {
  // The defect: <dimensions> said "Check six dimensions" and listed six, while
  // <success_criteria> said "All five dimensions checked" - so a checker could
  // report success having skipped Proportionality, the dimension that bounds
  // plan size, and be within its own contract for doing it.
  const src = doc('skills', 'cad-plan-checker-contract', 'SKILL.md');

  const block = src.match(/<dimensions>([\s\S]*?)<\/dimensions>/);
  assert.ok(block, 'no <dimensions> block in the contract');

  const declared = block[1].match(/\bCheck\s+(\w+)\s+dimensions\b/);
  assert.ok(declared, '<dimensions> does not open with "Check <n> dimensions"');
  const declaredCount = countWord(declared[1], '<dimensions>');

  const criteria = src.match(/<success_criteria>([\s\S]*?)<\/success_criteria>/);
  assert.ok(criteria, 'no <success_criteria> block in the contract');
  const claimed = criteria[1].match(/\bAll\s+(\w+)\s+dimensions checked\b/);
  assert.ok(claimed, '<success_criteria> does not state "All <n> dimensions checked"');
  const claimedCount = countWord(claimed[1], '<success_criteria>');

  const enumerated = (block[1].match(/^\d+\. \*\*/gm) || []).length;

  assert.equal(declaredCount, enumerated,
    `<dimensions> says ${declaredCount} but enumerates ${enumerated}`);
  assert.equal(claimedCount, enumerated,
    `<success_criteria> says ${claimedCount} but <dimensions> enumerates ${enumerated}`);
});

// --- RNG-04: the README's adaptive-routing claim, held against a real resolve -
//
// "leaving `stakes` unset is what lets a phase touching none of them route
// below the old default" was FALSE of every project Cadence initialised until
// the template stopped writing the key: the resolver's discount shipped in
// v3.5.7, but no new project could ever reach it. So the sentence is held
// against a resolve over a repo built from the SHIPPED TEMPLATE, not against a
// hand-written config - a check that only grepped the README for the sentence
// would pass on exactly the broken tree this closes.

/** The README sentence the arm below measures, located by a stable substring. */
const UNSET_CLAIM = 'leaving `stakes` unset is what lets a phase touching none '
  + 'of them route below the old default';

/**
 * `route.mjs resolve` over a repo INITIALISED FROM THE SHIPPED TEMPLATE: the
 * template copied to `.planning/config.json` exactly as both init workflows
 * copy it, one phase holding one plan, and the one repo file that plan declares
 * touching no risk surface. Beside `resolvedReview` rather than folded into it
 * - that helper writes a bare config carrying one `stakes` value and asserts
 * the resolve came back AT it, which is the opposite of the case here, and it
 * builds no repo tree, no phase directory and no declared file.
 *
 * The global layer is pointed at a path that does not exist, so a dev machine
 * whose user-global config pins `stakes` cannot answer for the template.
 */
function resolvedFromTemplate(phase = 3) {
  const repo = mkdtempSync(join(tmpdir(), 'cad-prose-template-'));
  const planning = join(repo, '.planning');
  mkdirSync(join(planning, 'phases', String(phase)), { recursive: true });
  writeFileSync(join(planning, 'config.json'),
    doc('cadence-core', 'templates', 'config.json'));
  writeFileSync(join(planning, 'phases', String(phase), 'PLAN-1.md'),
    `---\nphase: ${phase}\nplan: 1\nfiles:\n  - docs/README.md\n---\n\n# Plan\n`);
  mkdirSync(join(repo, 'docs'), { recursive: true });
  writeFileSync(join(repo, 'docs', 'README.md'), '# Readme\n');
  const line = execFileSync('node',
    [ROUTE, 'resolve', '--role', 'cad-executor', '--phase', String(phase),
      '--file', join(planning, 'config.json')],
    { encoding: 'utf8', env: { ...process.env,
      CADENCE_GLOBAL_CONFIG: join(repo, 'no-global.json') } });
  const r = JSON.parse(line);
  assert.equal(r.ok, true, line);
  return r;
}

test('README: a template-initialised phase touching no surface really does route BELOW the default', () => {
  const readme = doc('README.md');
  assert.ok(readme.includes(UNSET_CLAIM),
    `README no longer makes the claim this arm measures: ${UNSET_CLAIM}`);

  // "below" and "the old default" both come off the artifacts, never off this
  // file: the order is route-table.json's own `stakes_order` and the default is
  // config.schema.json's `keys.stakes.default`, so a change to either is read
  // here rather than silently disagreed with.
  const order = JSON.parse(doc('cadence-core', 'route-table.json')).stakes_order;
  const dflt = JSON.parse(doc('cadence-core', 'config.schema.json')).keys.stakes.default;
  const r = resolvedFromTemplate();
  assert.ok(order.indexOf(r.stakes) > -1 && order.indexOf(dflt) > -1,
    `stakes_order ${JSON.stringify(order)} does not place ${r.stakes} and ${dflt}`);
  // FIRST, and deliberately: on a tree whose template pins a level again this
  // is the assertion that must speak, because its message carries the two
  // figures a reader needs - what the resolve returned and what it is measured
  // against. The `stakes_set` pin below is the same fact said upstream, and
  // asserting it first would answer a level question with a set-ness message.
  assert.ok(order.indexOf(r.stakes) < order.indexOf(dflt),
    `the README says a surfaceless phase routes below the default, but a `
    + `template-initialised repo resolved ${r.stakes} against the default ${dflt}`);
  assert.equal(r.stakes_set, false, 'the shipped template pins a stakes level');
});

// --- DFC-02: both statements of phase_diff's gates match the RESOLVER --------

const LEVELS = ['solo', 'shipped', 'critical'];

/**
 * `review` as `route.mjs resolve` returns it for `cad-reviewer` at each stakes
 * level, keyed by level. Driven through the per-repo `--file` layer because
 * `resolve` takes no level flag, and read off the RESOLVER rather than off
 * route-table.json: the prose copies what a run actually gets, so level
 * mapping, schema defaults and role selection have to be inside the check or
 * they stay free to diverge from the two documents that quote them.
 */
function resolvedReview() {
  const dir = mkdtempSync(join(tmpdir(), 'cad-prose-'));
  /** @type {Record<string, Record<string, string>>} */
  const out = {};
  for (const level of LEVELS) {
    const cfg = join(dir, `${level}.json`);
    writeFileSync(cfg, JSON.stringify({ stakes: level }));
    const line = execFileSync('node',
      [ROUTE, 'resolve', '--role', 'cad-reviewer', '--file', cfg], { encoding: 'utf8' });
    const r = JSON.parse(line);
    assert.equal(r.ok, true, line);
    assert.equal(r.stakes, level, `--file did not drive stakes to ${level}: ${line}`);
    out[level] = r.review;
  }
  return out;
}

test('phase_diff gates: the wiring table and docs/WORKFLOW.md both match the resolver', () => {
  // The defect: both read `off / off / adjudicated` while the resolver returns
  // `advisory` at shipped. One wrong row in the reference was the single source
  // of four separate wrong claims across two documents.
  const resolved = resolvedReview();
  const want = LEVELS.map((l) => resolved[l].phase_diff);

  const wiring = tableRow(doc('cadence-core', 'references', 'review-triggers.md'), 'phase_diff');
  const cell = wiring[wiring.length - 1].split('/').map((s) => s.trim());
  assert.deepEqual(cell, want,
    `review-triggers.md states ${cell.join(' / ')}, the resolver returns ${want.join(' / ')}`);

  // WORKFLOW.md spells the same three values as three separate columns.
  const workflow = tableRow(doc('docs', 'WORKFLOW.md'), 'phase_diff');
  assert.deepEqual(workflow.slice(-3), want,
    `docs/WORKFLOW.md states ${workflow.slice(-3).join(' / ')}, the resolver returns ${want.join(' / ')}`);
});

// --- DFC-04: the risk_surface row admits the artifact /cad-task produces -----

test('risk_surface row: its shape (c) clause names no producer, and task.md still holds its rails', () => {
  // The defect: the row admitted "(c) the flagged-diff FILE path THE CHECKPOINT
  // RETURNED", and /cad-task's fire produces that file with no checkpoint at
  // all - its commits already exist. Correcting the workflow to match the row
  // is what produced a worse instruction than the one it replaced, so the row
  // is what moves. Section 2's own shape-(c) definition is already broad
  // enough ("a file artifact... or one the reviewer's tree cannot reach").
  const row = tableRow(doc('cadence-core', 'references', 'review-triggers.md'), 'risk_surface');

  const firedBy = row[1].split(',').map((s) => s.trim().replace(/`/g, ''));
  assert.deepEqual(firedBy, ['cad-execute', 'cad-debug', 'cad-task', 'cad-verify']);

  const payload = row[3];
  assert.match(payload, /\(c\)/, 'the row no longer offers shape (c)');
  assert.match(payload, /\(b\)/, 'the row no longer offers shape (b)');
  // The qualifier itself. Bounded to THIS cell, never a tree scan: verify.md's
  // own shape-(c) fire is a diagnosis review naming no wiring-table trigger and
  // carrying no resolved gate, and must not be dragged in here.
  const shapeC = payload.split(/,\s*or\s*\(b\)/)[0];
  assert.doesNotMatch(shapeC, /checkpoint/i,
    'shape (c) is qualified by its producer again, so a /cad-task fire is a shape the row does not admit');

  // The other half of DFC-04 is already closed in the workflow (716fb60) and
  // ROADMAP criterion 4 forbids losing it. Pinned so a future "simplification"
  // of the row cannot take these with it.
  const task = doc('cadence-core', 'workflows', 'task.md');
  assert.match(task, /\.planning\/tasks\/\{slug\}\/risk-task-\{slug\}\.diff/);
  assert.match(task, /never stage it/i);
  assert.match(task, /delete it once\s+the trigger returns/i);
});

// --- CST-02: the eight risk-surface categories, stated in three places -------

test('risk-surface categories: the schema enum, the route table and the detection list are one list', () => {
  // route.mjs may not read config.schema.json - a schema default read there
  // becomes a user assertion - so route-table.json carries a hand-maintained
  // copy of this vocabulary, and the reference names the same tokens beside the
  // prose category each one stands for. Three statements of one list, and
  // nothing but this check keeps them one list.
  const spec = JSON.parse(doc('cadence-core', 'config.schema.json'))
    .keys['review.triggers.risk_surface.surfaces'];
  assert.ok(spec, 'config.schema.json defines no review.triggers.risk_surface.surfaces');
  const table = JSON.parse(doc('cadence-core', 'route-table.json')).risk_surface_categories;

  const after = doc('cadence-core', 'references', 'risk-surface.md')
    .split('## risk_surface detection')[1];
  assert.ok(after, 'risk-surface.md has no risk_surface detection section');
  const prose = [...after.split(/\n## /)[0].matchAll(/^- `([a-z_]+)` - /gm)].map((m) => m[1]);

  assert.deepEqual(table, spec.values,
    `route-table.json states [${table}], config.schema.json states [${spec.values}]`);
  assert.deepEqual(prose, spec.values,
    `risk-surface.md's detection list states [${prose}], config.schema.json states [${spec.values}]`);

  // D-12: no default ARRAY. A default of all eight would make "the user chose
  // everything" indistinguishable from "nobody has answered", and the
  // unanswered state is the one the first fire's ask exists to detect.
  assert.equal(spec.default, null,
    'the key has a default array again, so the unanswered state is undetectable');
});

test('plan authority: Action never invents, Verify decides, in all five documents', () => {
  // The defect this pins. templates/PLAN.md and the planner contract both used
  // to require Action to carry "identifiers, signatures" for code that did not
  // exist yet. The planner cannot know those, so every guess reached the
  // executor as an instruction reality then contradicted: one archived report
  // carries 36 deviations, among them a field named `warnings` that is really
  // `warning_count` and a `run()` helper the plan routed through that is not
  // reachable. The executor contract then sorted those departures by how
  // ARCHITECTURAL they looked, which let an invented parsing pass through as
  // "trivial". Authority moved to Verify; these five documents must say so
  // together, because a planner reading one and an executor reading another is
  // exactly how the old split survived three releases.
  const template = doc('cadence-core', 'templates', 'PLAN.md');
  const planner = doc('skills', 'cad-planner-contract', 'SKILL.md');
  const executor = doc('skills', 'cad-executor-contract', 'SKILL.md');
  const checker = doc('skills', 'cad-plan-checker-contract', 'SKILL.md');
  const method = doc('METHOD.md');

  // Nothing may re-acquire the demand that produced the guesses.
  for (const [name, text] of [['templates/PLAN.md', template],
    ['cad-planner-contract', planner], ['METHOD.md', method]]) {
    assert.doesNotMatch(text, /identifiers,\s*signatures/,
      `${name} asks for identifiers and signatures again - the planner cannot know them`);
  }

  // Both authoring documents state the prohibition and the permission together:
  // inventing is out, naming what already exists is in.
  for (const [name, text] of [['templates/PLAN.md', template], ['cad-planner-contract', planner]]) {
    assert.match(text, /ALREADY EXIST/, `${name} dropped the name-what-exists permission`);
    assert.match(text, /(never|Never|NOT)\s+invent/, `${name} dropped the invent prohibition`);
  }

  // Verify is named as the authority on both sides of the dispatch, so the
  // executor's licence and the planner's obligation cannot drift apart.
  assert.match(planner, /AUTHORITY/, 'the planner contract no longer calls Verify the authority');
  assert.match(template, /AUTHORITY/, 'the template no longer calls Verify the authority');
  assert.match(executor, /[Yy]our authority is the task's `Verify:`/,
    'the executor contract no longer takes its authority from Verify');
  assert.match(checker, /whole\s+authority/,
    'the plan checker no longer weighs Verify as the task authority');

  // The taxonomy that let unplanned code through as "trivial" stays deleted.
  for (const [name, text] of [['cad-executor-contract', executor], ['METHOD.md', method]]) {
    assert.doesNotMatch(text, /\*\*Trivial\b/,
      `${name} re-grew the trivial bucket, which sorted departures by shape rather than authorization`);
    assert.doesNotMatch(text, /input validation, error handling/,
      `${name} re-licensed inline security writes - the clause unplanned parsing passes were written under`);
  }
});

test('risk_surface fires on a completed range, and both fire sites carry the transient-file rails', () => {
  // The defect: risk_surface fired per risky COMMIT, mid-plan, against a staged
  // index. Each match halted the executor and cost a fresh-context continuation
  // whose only job was writing code no task authorized - itself new risk
  // surface, and the next halt. One measured phase spent three executor
  // dispatches (198K, 492K, 337K tokens) on one plan that way. The fire moved
  // to plan completion; the executor must no longer own a risk checkpoint, and
  // cad-execute must carry the same rails cad-task already had.
  const executor = doc('skills', 'cad-executor-contract', 'SKILL.md');
  const execute = doc('cadence-core', 'workflows', 'execute.md');

  // The executor stops for structural reasons only - a risky diff is not one.
  assert.doesNotMatch(executor, /CHECKPOINT: \{[^}]*risk_surface/,
    'risk_surface is a checkpoint type again, which puts the halt back mid-plan');
  assert.doesNotMatch(executor, /git diff --cached/,
    'the executor writes a staged risk diff again');

  // It moved rather than vanished: the wiring table still names cad-execute.
  const row = tableRow(doc('cadence-core', 'references', 'review-triggers.md'), 'risk_surface');
  assert.ok(row[1].includes('cad-execute'), 'cad-execute stopped firing risk_surface entirely');
  assert.match(row[2], /never mid-plan/, 'the row no longer states the once-per-plan timing');

  // The same three rails task.md carries, so the range diff cannot be committed
  // or left behind as a stray artifact.
  assert.match(execute, /plan-<k>-risk\.diff/, 'execute.md names no range-diff file');
  assert.match(execute, /never stage it/i, 'execute.md dropped the never-stage rail');
  assert.match(execute, /delete it once the\s+trigger returns/i, 'execute.md dropped the delete rail');
});

// --- the measured byte count, wherever prose copies it -----------------------

const sentencesOf = (text) => text.split(/(?<=[.!?])\s+/);

/**
 * The `skill|reference` keys the COVERAGE arm below does not hold to the
 * inline consult-site rule. `cadence-core/references/seams.md` binds that rule
 * to any deferral made "from this point forward" and releases these three by
 * name in the same sentence: "the deferrals already in `cad-land` predate this
 * sentence and are not held to it".
 *
 * Not a convenience. The triage-gate Read at `skills/cad-land/SKILL.md:52-55`
 * states no bytes and no site count at all, so an unexempted arm is red on an
 * untouched tree; and holding the other two to a rule the reference explicitly
 * exempts them from would make this test contradict the document it enforces.
 * The SCAN arm still checks all three: seams.md releases them from HAVING to
 * state a figure, never from stating a correct one.
 */
const GRANDFATHERED = new Set([
  'cad-land|references/review-triggers.md',
  'cad-land|references/git-publish.md',
  'cad-land|references/triage-gate.md',
]);

test('every deferred-read row states its consult-site count at each anchor', () => {
  // seams.md's deferral mandate: the consult-site count rides inline at the arm
  // that performs the read, rather than anywhere in the file, because that
  // count is what the eligibility rule turns on. Byte figures are deliberately
  // NOT required - a size copied into prose goes stale on the next edit, and
  // weight.mjs reports the live number. Driven off the register
  // so it grows with it, and resolved through the register's own
  // `regionLabels`, so an anchor reads here exactly as `deferredReadIssues`
  // reads it - two different notions of "inside the anchor" would let a row
  // satisfy one check and fail the other.
  const measured = new Map(weighAll(REPO).map((s) => [s.surface, s]));
  let checked = 0;

  for (const row of DEFERRED_READS) {
    if (GRANDFATHERED.has(`${row.skill}|${row.reference}`)) continue;
    const rel = row.file || `skills/${row.skill}/SKILL.md`;
    const text = doc(...rel.split('/'));
    const surface = `cadence-core/${row.reference}`;
    assert.ok(measured.has(surface), `${rel} defers ${surface}, which is not a measured surface`);
    const full = `\${CLAUDE_PLUGIN_ROOT}/${surface}`;

    const labelOf = regionLabels(text);
    /** @type {Map<string, string[]>} */
    const byRegion = new Map();
    text.split('\n').forEach((line, i) => {
      const label = labelOf(i);
      if (label === null) return;
      const acc = byRegion.get(label);
      if (acc) acc.push(line);
      else byRegion.set(label, [line]);
    });

    for (const anchor of row.anchors) {
      const lines = byRegion.get(anchor);
      assert.ok(lines, `${rel} has no region labelled ${anchor} for ${row.reference}`);
      const naming = sentencesOf(lines.join('\n')).filter((s) => s.includes(full));
      assert.ok(naming.length,
        `${rel} region ${anchor} carries no sentence naming ${full}`);
      assert.ok(naming.some((s) => /\bsite\b/.test(s)),
        `${rel} region ${anchor} names ${row.reference} but states no consult-site count `
        + '- seams.md requires it inline at the Read');
      checked += 1;
    }
  }
  assert.ok(checked > 0, 'no register row reached the coverage arm');
});

test('the lockfile lease: both contracts name the same lockfiles and the reason lease-check emits', () => {
  // The planner declares a task's files and the checker blocks on the gap, but
  // the thing that actually halts an executor is planning.mjs's own refusal.
  // Both documents quote that seam by name and by reason code, so this pins
  // the quote to the emitter: rename the reason and the prose goes red rather
  // than telling a planner to avoid a code the seam no longer returns.
  const planner = doc('skills', 'cad-planner-contract', 'SKILL.md');
  const checker = doc('skills', 'cad-plan-checker-contract', 'SKILL.md');
  // The EMITTING site, which phase 4 moved out of planning.mjs into the command
  // module that owns the subcommand. Read the emitter and not the entry file:
  // planning.mjs now only dispatches, so matching there would have gone red
  // announcing that lease-check stopped emitting the reason - a defect that did
  // not happen - and matching anywhere under the tree would stop pinning the
  // quote to the emitter, which is the whole of this row.
  const seam = doc('cadence-core', 'bin', 'planning', 'lease-check.mjs');

  assert.match(seam, /reason: 'undeclared-files'/,
    'lease-check no longer emits undeclared-files - both contracts quote that reason');

  for (const [label, text] of [['planner', planner], ['plan-checker', checker]]) {
    assert.ok(text.includes('lease-check'),
      `cad-${label}-contract states the lockfile rule without naming the seam that enforces it`);
    assert.ok(text.includes('undeclared-files'),
      `cad-${label}-contract names lease-check but not the reason it returns`);
  }

  // The lockfile set is the half a planner acts on, so the two documents must
  // list the SAME one. A rule that names Cargo.lock in one contract and a
  // different set in the other is two rules, and the checker would block work
  // the planner was never told to declare.
  const lockfiles = (text) =>
    [...text.matchAll(/`([A-Za-z.]+\.lock|package-lock\.json|go\.sum)`/g)]
      .map((m) => m[1]).sort();
  const fromPlanner = [...new Set(lockfiles(planner))];
  const fromChecker = [...new Set(lockfiles(checker))];

  assert.ok(fromPlanner.length >= 3,
    `cad-planner-contract names too few lockfiles to be the rule: ${fromPlanner.join(', ')}`);
  assert.deepEqual(fromChecker, fromPlanner,
    'the planner and the plan-checker state different lockfile sets');
});

// --- SIZ-01: the spend gate sits ahead of the resolve it gates ---------------

/** The lines of `text` labelled `label` by the register's own region walker. */
function regionText(text, label, where) {
  const labelOf = regionLabels(text);
  const lines = text.split('\n').filter((_, i) => labelOf(i) === label);
  assert.ok(lines.length, `${where}: no region labelled ${label}`);
  return lines.join('\n');
}

test('the analyzer spend gate precedes the resolve, and four surfaces state two questions', () => {
  // The defect this pins. `analyze` folds its bracket onto a `route.mjs
  // resolve` carrying `--bracket-read`, and that resolve writes the lifecycle
  // DISPATCH half unconditionally - before any Task spawn, before any answer.
  // So "before the spawn" is not far enough: a gate anywhere below that line
  // leaves an unpaired bracket on every phase that skips the analyzer, which
  // renders as a worker that never came back and inverts the record-health
  // signal /cad-report reads. Position is the fact, and it is not visible in
  // any single sentence - only in the order of two.
  const context = doc('cadence-core', 'workflows', 'context.md');
  const skill = doc('skills', 'cad-context', 'SKILL.md');

  // The gate's step NAME is read off the deferred-read register rather than
  // hardcoded: that register anchors `references/recall.md` at the step which
  // performs the read, and the recall substep lives in the gate because BOTH
  // arms consume recalled memory. Rename the step in one place and this goes
  // red, instead of quietly passing against a step that no longer exists.
  const recallRow = DEFERRED_READS.find((r) =>
    r.skill === 'cad-context' && r.reference === 'references/recall.md');
  assert.ok(recallRow, 'no cad-context recall row in the deferred-read register');
  const gateStep = recallRow.anchors[0];
  assert.notEqual(gateStep, 'analyze',
    'the recall anchor is back inside `analyze`, so the skip arm - which never enters that '
    + 'step - reaches its gray areas with no prior-project memory at all');

  const at = (needle) => {
    const i = context.indexOf(needle);
    assert.ok(i >= 0, `context.md carries no ${needle}`);
    return i;
  };
  const gate = at(`<step name="${gateStep}">`);
  assert.ok(gate < at('<step name="analyze">'),
    `context.md opens the ${gateStep} step BELOW <step name="analyze">, so the phase is asked `
    + 'whether to buy a pass it has already entered');
  assert.ok(gate < at('--bracket-read'),
    `context.md opens the ${gateStep} step BELOW the --bracket-read resolve, which writes the `
    + 'lifecycle dispatch half unconditionally - every skipped phase would then report an '
    + 'unpaired bracket, a dispatch event with no worker');

  // The second fact: this workflow asks TWO questions now, and every surface
  // that describes the asking says so. A surface still promising "exactly one"
  // forbids, in its own words, the gate the workflow just ran.
  for (const [where, text, label] of /** @type {const} */ ([
    ['cadence-core/workflows/context.md', context, 'size_check'],
    ['cadence-core/workflows/context.md', context, 'guardrails'],
    ['cadence-core/workflows/context.md', context, 'success_criteria'],
    ['skills/cad-context/SKILL.md', skill, 'objective'],
  ])) {
    const naming = sentencesOf(regionText(text, label, where))
      .filter((s) => /size question/i.test(s));
    assert.ok(naming.length, `${where} region ${label} names no size question at all`);
    for (const sentence of naming) {
      assert.match(sentence, /spend question/i,
        `${where} region ${label} names a size question with no spend question beside it`);
    }
  }
});

// --- RVW-01: one bar, two reviewers -----------------------------------------

/** `text` with every run of whitespace collapsed, so a rewrap is not a defect. */
const flat = (text) => text.replace(/\s+/g, ' ');

/**
 * The severity vocabulary a document states, as a sorted set. Parsed from the
 * one sentence both documents spell it in, so a document that stops stating it
 * at all fails here rather than comparing empty-to-empty.
 */
function severityVocabulary(text, where) {
  const m = flat(text).match(/`severity` is exactly one of `([^`]+)`/);
  assert.ok(m, `${where} states no severity vocabulary`);
  return m[1].split('|').map((s) => s.trim()).sort();
}

test('the reviewer brief carries the same bar the reviewer contract states', () => {
  // The defect: the cross-model arm sent whatever one-line instruction the fire
  // site composed, while the stance, the severity definitions and the two rules
  // that keep findings comparable lived only in skills/cad-reviewer-contract.
  // An adjudicator merges both backends' findings blind - it cannot, if the two
  // reviewers were held to different bars. The brief is the ONE bar, restated as
  // a payload fragment; this test is what keeps the restatement from drifting.
  const brief = doc('cadence-core', 'references', 'reviewer-brief.md');
  const contract = doc('skills', 'cad-reviewer-contract', 'SKILL.md');
  const flatBrief = flat(brief);

  // 1. The stance, including the clause that makes a zero-finding pass earned.
  assert.match(flatBrief, /Assume the artifact is wrong until the evidence clears it/,
    'the brief no longer states the stance');
  assert.match(flatBrief, /only after a genuine attempt to falsify/,
    'the brief no longer conditions a zero-finding pass on a falsification attempt');

  // 2. The severity definitions - the same VOCABULARY as the contract, and the
  //    two anchors of the scale, so `blocker` cannot come to mean something
  //    else on the cross-model side of a panel.
  assert.deepEqual(severityVocabulary(brief, 'reviewer-brief.md'),
    severityVocabulary(contract, 'cad-reviewer-contract'),
    'the brief and the contract state different severity vocabularies');
  assert.match(flatBrief, /`blocker` = the goal fails or a serious defect ships; `low` = minor/,
    'the brief states the severity words without defining either end of the scale');

  // 3. and 4. The two rules an external reviewer has no other way to learn.
  assert.ok(flatBrief.includes('Approach differences are NOT findings'),
    'the brief no longer tells a reviewer that approach differences are not findings');
  assert.match(flatBrief, /Empty `findings: \[\]` when, after a real refutation attempt/,
    'the brief no longer states that an empty findings list is a valid result');
});

test('the reviewer brief costs under 1% of the default review.max_prompt_tokens', () => {
  // It rides in every cross-model payload, so its cost is paid per fire. Read
  // off the same estimator the cap itself uses (chars/4) and against the
  // schema's own default rather than a copied 120000, so a changed default
  // re-prices this check instead of leaving it asserting a stale number.
  const measured = new Map(weighAll(REPO).map((s) => [s.surface, s]));
  const brief = measured.get('cadence-core/references/reviewer-brief.md');
  assert.ok(brief, 'reviewer-brief.md is not a measured surface');

  const schema = JSON.parse(doc('cadence-core', 'config.schema.json'));
  const cap = schema.keys['review.max_prompt_tokens'].default;
  assert.ok(Number.isInteger(cap), 'review.max_prompt_tokens has no integer default');

  assert.ok(brief.estTokens < cap / 100,
    `the brief estimates ${brief.estTokens} tokens, over 1% of the ${cap} default cap`);
});

// --- CST-03: the turn bound the frontmatter sets is the one the seam states --

test('the turn bound: every rung file and the spawn-agent seam name one maxTurns value', () => {
  // The defect this pins. references/seams.md told readers the spawn-agent seam
  // "offers no bound and no cancel" while all 19 agents/*.md carried a
  // maxTurns bound in frontmatter - which is why nobody ever tuned the value.
  // Correcting the sentence puts a NUMBER in prose, and a number copied into
  // prose is exactly what drifts. Both sides are read by their NAMED anchor -
  // the `maxTurns:` key, in the frontmatter and inside the spawn-agent section
  // - never by the shape of the sentence around it, so a rewrap or a reworded
  // bullet that changed no fact stays green.
  const files = readdirSync(join(REPO, 'agents')).filter((f) => f.endsWith('.md')).sort();
  assert.ok(files.length, 'no agent files under agents/');

  /** Each rung file's frontmatter bound, as written. */
  const byFile = new Map(files.map((f) => {
    const front = doc('agents', f).split(/^---$/m)[1];
    assert.ok(front, `agents/${f} has no frontmatter block`);
    const m = front.match(/^maxTurns: (\d+)$/m);
    assert.ok(m, `agents/${f} states no maxTurns bound in its frontmatter`);
    return [f, m[1]];
  }));

  // Direction 1: a rung file whose value differs from its siblings.
  const [firstFile] = byFile.keys();
  const bound = byFile.get(firstFile);
  const drifted = [...byFile].filter(([, v]) => v !== bound).map(([f, v]) => `agents/${f}=${v}`);
  assert.deepEqual(drifted, [],
    `these rung files disagree with agents/${firstFile}=${bound}: ${drifted.join(', ')}`);

  // Direction 2: a sentence naming a value no rung file carries.
  const seam = doc('cadence-core', 'references', 'seam-spawn-agent.md')
    .split('## Seam: spawn-agent')[1];
  assert.ok(seam, 'seam-spawn-agent.md has no spawn-agent seam section');
  const stated = [...seam.split(/\n## /)[0].matchAll(/maxTurns: (\d+)/g)].map((m) => m[1]);
  assert.ok(stated.length,
    'the spawn-agent seam states no maxTurns value, so it is back to describing a seam with no bound');
  const wrong = [...new Set(stated.filter((v) => v !== bound))];
  assert.deepEqual(wrong, [],
    `references/seam-spawn-agent.md's spawn-agent bullet states maxTurns ${wrong.join('/')}, `
    + `which no rung file carries - the 19 rung files carry ${bound}`);
});

// --- WIR-01: the recovery arm's producers, and the default reviewer's bound --
//
// WATCHED FAILING AT cdf8676, the tip of this plan's unpatched tree. Observed
// there, with this file copied into that checkout:
//
//   $ node --test --test-name-pattern='WIR-01' \
//       cadence-core/bin/prose-agreement.test.mjs
//   AssertionError [ERR_ASSERTION]: execute.md labels a recovery arm "timeout
//   or no report" - the seam has no timeout to recover from
//     actual: 'timeout or no report',
//     expected: /timeout/i,
//     operator: 'doesNotMatch',
//   (exit 1)
//
// Which is the defect exactly: the arm was labelled with a control the dispatch
// path does not hold. It stops at the first assertion because on that tree the
// other two facts do not exist to extract either - neither document states a
// producer clause, and neither `references/seams.md`'s exemption sentence nor
// `references/review-triggers.md`'s `claude-subagent` bullet names a bound.
//
// Nothing this plan added is imported, so against the unpatched tree this fails
// on an ASSERTION rather than on a missing export. To re-watch it: `git worktree
// add --detach <tmp> cdf8676`, copy this file into that checkout's
// `cadence-core/bin/`, `node --test` it there, then remove the worktree.

/**
 * The sentence containing `needle`. A sentence ends at `.!?` followed by
 * WHITESPACE, so a dotted identifier (`review.max_prompt_tokens`) is not an
 * end - which matters, because the sentence this reads has one in it.
 */
const sentenceAround = (text, needle, where) => {
  const i = text.indexOf(needle);
  assert.notEqual(i, -1, `${where} no longer contains "${needle}"`);
  const before = [...text.slice(0, i).matchAll(/[.!?]\s/g)];
  const from = before.length ? before[before.length - 1].index + 1 : 0;
  const rest = text.slice(i);
  const end = rest.search(/[.!?]\s/);
  return text.slice(from, i + (end === -1 ? rest.length : end + 1)).replace(/\s+/g, ' ').trim();
};

/**
 * The clause a document introduces with a colon in its sentence about what
 * PRODUCES a state - the copied fact itself, read by its own anchor rather
 * than by the shape of the prose around it, so a rewrap stays green and a
 * reword in one document alone does not.
 */
const producerClause = (text, where) => {
  const m = text.match(/produc\w*[^.:]*:\s*([^.]+)\./);
  assert.ok(m, `${where} states no colon-introduced producer clause`);
  return m[1].replace(/\s+/g, ' ').trim();
};

/** The one `maxTurns` figure every rung file's frontmatter carries. */
const frontmatterBound = () => {
  const files = readdirSync(join(REPO, 'agents')).filter((f) => f.endsWith('.md')).sort();
  assert.ok(files.length, 'no agent files under agents/');
  const values = [...new Set(files.map((f) => {
    const m = (doc('agents', f).split(/^---$/m)[1] || '').match(/^maxTurns: (\d+)$/m);
    assert.ok(m, `agents/${f} states no maxTurns bound in its frontmatter`);
    return m[1];
  }))];
  assert.equal(values.length, 1, `the rung files disagree on maxTurns: ${values.join('/')}`);
  return values[0];
};

test('WIR-01: the recovery arm names its producers in both documents, and the default reviewer names its bound', () => {
  // The defect this pins. execute.md opened a recovery arm labelled "timeout or
  // no report" while seams.md said in as many words that the spawn-agent seam
  // has no timeout at all, and `workflow.subagent_timeout` was deleted in
  // v2.7.0 for naming a control nothing could apply - so the arm named a state
  // nothing in the dispatch path can produce. A prose fix satisfies that on the
  // day it lands and nothing after: the two documents are copies of one fact,
  // and the only failure worth catching is one of them being reworded alone.
  // So both sides are EXTRACTED and compared to each other. Asserting that some
  // expected phrase appears in each file is the weaker shape this very file has
  // shipped once before (the coverage arm that required the word `site` and
  // never parsed the count), and it passes exactly the tree this exists to
  // catch.
  const execute = doc('cadence-core', 'workflows', 'execute.md');
  // Two seam files since the LOD-06 cold split: the producer clause travels
  // with the spawn-agent seam, the `is exempt` sentence with the provider one.
  const spawnFile = doc('cadence-core', 'references', 'seam-spawn-agent.md');
  const providerFile = doc('cadence-core', 'references', 'seam-review-provider.md');
  const triggers = doc('cadence-core', 'references', 'review-triggers.md');

  // The arms of the return-handling list, read positionally: the recovery arm
  // is the last of them, whatever it now calls itself.
  const list = execute.split("Handle the executor's return:")[1];
  assert.ok(list, 'execute.md has no "Handle the executor\'s return" list');
  const arms = list.split(/\n\r?\n/)[0].split(/\n- \*\*/).slice(1);
  assert.equal(arms.length, 4, `that list has ${arms.length} arms, not the four this check reads`);
  const recovery = arms[arms.length - 1];

  // 1. No arm is labelled with a control this dispatch path does not hold.
  for (const arm of arms) {
    const label = arm.split('**')[0];
    assert.doesNotMatch(label, /timeout/i,
      `execute.md labels a recovery arm "${label}" - the seam has no timeout to recover from`);
  }

  // 2. The producer wording is one fact copied into two documents. Compare the
  //    two EXTRACTIONS, so rewording either one alone reddens this.
  const fromExecute = producerClause(recovery, 'execute.md\'s recovery arm');
  const spawnSeam = spawnFile.split('## Seam: spawn-agent')[1];
  assert.ok(spawnSeam, 'seam-spawn-agent.md has no spawn-agent seam section');
  const fromSeams = producerClause(spawnSeam.split(/\n## /)[0], 'seam-spawn-agent.md\'s spawn-agent seam');
  assert.equal(fromExecute, fromSeams,
    'execute.md and references/seam-spawn-agent.md state different producers for the state that arm recovers from:\n'
    + `  execute.md:           ${fromExecute}\n`
    + `  seam-spawn-agent.md:  ${fromSeams}`);

  // 3. The recovery itself survived the relabel: the report file on disk is
  //    still what the arm reads.
  assert.match(recovery, /reports\/plan-<k>\.md/,
    'the recovery arm no longer reads the report file the executor left on disk');

  // 4. The default reviewer states its own bound where it claims exemption,
  //    and where the trigger reference introduces it. Both against the rung
  //    files' own figure - a literal typed here goes stale the day they move.
  const bound = frontmatterBound();
  const exempt = sentenceAround(providerFile, 'is exempt', 'references/seam-review-provider.md');
  assert.match(exempt, new RegExp(`maxTurns: ${bound}\\b`),
    `seam-review-provider.md's exemption sentence names no maxTurns ${bound} bound, so \`claude-subagent\` `
    + `still reads as the unbounded path beside over-cap: ${exempt}`);
  const bullet = triggers.split(/\n- /).find((b) => b.startsWith('`claude-subagent`'));
  assert.ok(bullet, 'review-triggers.md has no `claude-subagent` backend bullet');
  assert.match(bullet, new RegExp(`maxTurns: ${bound}\\b`),
    `review-triggers.md's \`claude-subagent\` bullet names no maxTurns ${bound} bound`);
});

// --- #195: the locate step's re-run refusal, and its unconditional status call

/** The body of a named `<step>` in a workflow, read by its own anchor. */
const stepBody = (text, name, where) => {
  const m = text.match(new RegExp(`<step name="${name}">([\\s\\S]*?)</step>`));
  assert.ok(m, `${where} has no <step name="${name}">`);
  return m[1];
};

test('#195: execute.md locates unconditionally and refuses an already-executed phase', () => {
  // The defect. `/cad-execute <N>` re-dispatched a phase whose plans were
  // already committed, and the second run's first task write landed on top of
  // the first run's `reports/plan-<k>.md` - destroying the only per-task record
  // of the run being re-run. Two halves fix it (CONTEXT D-04), and each has its
  // own way of silently coming back:
  //   - the refusal itself, which a later edit can narrow to `executed` alone,
  //     leaving `complete` re-running identically one status later; and
  //   - the `status` call, which was under an `else` that `$ARGUMENTS`
  //     short-circuited, so `/cad-execute 3` reached this step with no derived
  //     status to refuse ON. Restoring that `else` turns the refusal into dead
  //     prose while every word of it is still on the page.
  // So both are read out of the step by its own anchor rather than grepped for
  // across the file, and no report-path literal is asserted anywhere here: the
  // current run's path is still `plan-<k>.md`, so a literal would be a string
  // this same commit writes and could never fail.
  const locate = stepBody(doc('cadence-core', 'workflows', 'execute.md'), 'locate', 'execute.md');

  // 1. The status call is not conditioned on the phase argument. Extracted, not
  //    grepped: the sentence that CARRIES the invocation is the one that would
  //    have to say "else" for the call to be skippable.
  const call = sentenceAround(locate, 'planning.mjs" status', "execute.md's locate step");
  assert.doesNotMatch(call, /\belse\b|\botherwise\b|\bonly (?:if|when)\b/i,
    'execute.md runs `planning.mjs status` conditionally, so a phase number on the command '
    + `line skips the derivation the refusal below reads: ${call}`);
  assert.doesNotMatch(call, /\$ARGUMENTS/,
    'execute.md\'s `planning.mjs status` call is back inside the `$ARGUMENTS` bullet, which '
    + `is the branch that short-circuited it: ${call}`);

  // 2. The refusal arm, found by the recovery path it names - a refusal that
  //    named no way forward would fail this at the anchor itself.
  const arms = locate.split(/\n- /).slice(1);
  // NOT the first arm naming /cad-undo. Since GH-179 the replay arm names it too
  // and sits ABOVE this one, because the refusal now reads that arm's
  // `dispatch_set`. A bare `find` here would grab the replay arm, whose trigger
  // clause carries neither derived status, and this test would fail describing
  // the wrong arm.
  const refusal = arms.find((a) => a.includes('/cad-undo') && !a.includes('replay-check'));
  assert.ok(refusal,
    "execute.md's locate step names no /cad-undo route, so it either refuses nothing or "
    + 'refuses without naming the supported path');
  // The TRIGGER clause only - the arm text before `-> stop:`. Asserting against
  // the whole arm passes on a trigger narrowed to `executed` alone, because the
  // rationale sentence after the stop names `complete` on its own.
  const trigger = refusal.split(/->\s*stop:/)[0];
  assert.ok(trigger && trigger !== refusal,
    "execute.md's refusal arm has no `-> stop:`, so its trigger clause cannot be "
    + `read apart from its rationale: ${refusal}`);
  for (const derived of ['executed', 'complete']) {
    assert.match(trigger, new RegExp(`\`${derived}\``),
      `that refusal does not TRIGGER on derived status \`${derived}\`, which re-runs and `
      + 'overwrites the executor reports of the run that committed the phase');
  }
  assert.match(refusal, /\/cad-undo <N>/, 'the refusal does not name `/cad-undo <N>`');
  assert.match(refusal, /\/cad-execute <N>/, 'the refusal does not name `/cad-execute <N>`');
  assert.match(refusal, /--rerun/,
    'the refusal names no deliberate way through, so an intentional re-run has no route but '
    + 'editing the workflow');
  // GH-179. The status alone is not the trigger: a phase carrying a `/cad-plan
  // --gaps` plan derives `executed` with real outstanding work, and refusing on
  // the status made every gap plan unrunnable while `--rerun`, the only
  // documented way past, widened the set back over the committed plans.
  assert.match(trigger, /dispatch_set/,
    'that refusal triggers on the derived status alone, with no empty-`dispatch_set` term, so '
    + 'it refuses a phase whose gap plans have never run');
  assert.match(trigger, /empty/i,
    'the refusal names `dispatch_set` without requiring it to be EMPTY, so the term does not '
    + 'actually narrow the refusal');

  // 3. It stops BEFORE the guard and the trace anchor, which is what makes it a
  //    refusal rather than a late apology: `locate` is the first step, and the
  //    arm is inside it.
  assert.ok(locate.indexOf('/cad-undo') > locate.indexOf('planning.mjs" status'),
    'the refusal is read before the derivation it refuses on');
});

// --- EXP-03: the locate step's replay stop, and the dispatch set it feeds ----

test('EXP-03: execute.md asks the replay seam and obeys its answer', () => {
  // The defect (GH-137). A session that dies between the last task's commit and
  // the SUMMARY write leaves the phase deriving `planned` with real commits on
  // the branch, so the arm above it never fires and the next `/cad-execute <N>`
  // re-dispatches work that is already done.
  //
  // WHAT COUNTS AS A REPLAY is not asserted here, deliberately. It lives in
  // `planning.mjs replay-check` and is pinned against real fixture directories
  // by `planning-replay-check.test.mjs` - the FIRST-LINE-exactly rule, the EVERY
  // plan quantifier, `PLAN PARTIAL`, a `PLAN COMPLETE` quoted in a report body,
  // a rotated `plan-<k>.<n>.md` sibling, and `--rerun`. This test pins the only
  // half a prose file can own: that it ASKS, that it passes the override
  // through, that it stops on the answer, and that it stops early enough.
  //
  // The split is the point. While this decision was prose, its every criterion
  // was observable only by running `/cad-execute` for real and reading
  // `trace.jsonl`, so none of them was ever checked.
  const execute = doc('cadence-core', 'workflows', 'execute.md');
  const locate = stepBody(execute, 'locate', 'execute.md');
  const arms = locate.split(/\n- /).slice(1);

  // 1. Exactly one arm asks the seam.
  const replayArms = arms.filter((a) => a.includes('replay-check'));
  assert.equal(replayArms.length, 1,
    "execute.md's locate step should carry exactly one arm calling `replay-check` - the replay "
    + `stop - and carries ${replayArms.length}`);
  const replay = replayArms[0];

  // 2. It calls the seam, and passes the override through. An arm that drops
  //    `--rerun` makes the documented way past the stop unreachable.
  assert.match(replay, /planning\.mjs" replay-check --phase <N>/,
    `the replay arm does not invoke \`replay-check --phase <N>\`: ${replay}`);
  assert.match(replay, /--rerun/,
    'the replay arm never passes `--rerun` to the seam, so the documented override cannot get '
    + `past the stop: ${replay}`);

  // 3. It branches on the seam's OWN fields rather than re-deriving them, and
  //    names the paths the seam handed back rather than rebuilding filenames.
  assert.match(replay, /`replay: true`/,
    `the replay arm does not act on the seam's \`replay\` field: ${replay}`);
  assert.match(replay, /`replay: false`/,
    'the replay arm states no not-fire case, so a genuine continuation has no written route '
    + `through: ${replay}`);
  assert.match(replay, /reports_read/,
    'the replay arm does not name the paths from `reports_read`, so its stop text rebuilds '
    + `filenames the seam already returned: ${replay}`);
  assert.doesNotMatch(replay, /plan-\*\.md/,
    'the replay arm reads a `plan-*.md` glob, which lets a rotated `plan-<k>.<n>.md` report '
    + 'from an OLDER run decide this one');

  // 4. Both remedies, so a refused user is not stuck.
  assert.match(replay, /\/cad-undo <N>/, 'the replay arm does not name `/cad-undo <N>`');

  // 5. Ordering, both halves - each regresses silently on its own.
  const refusal = arms.find((a) => a.includes('/cad-undo') && !a.includes('replay-check'));
  // INVERTED at GH-179, and the direction is the fix. The refusal reads this
  // arm's `dispatch_set`, so it has to come after it; before it, the refusal
  // fires on the derived status with no knowledge of what is left to run, which
  // is what made `/cad-plan --gaps` unreachable. The #195 test no longer depends
  // on this ordering - it excludes the replay arm by name.
  assert.ok(arms.indexOf(replay) < arms.indexOf(refusal),
    'the replay arm sits BELOW the `executed`/`complete` refusal, so that refusal cannot read '
    + 'the `dispatch_set` it must be gated on and refuses a phase whose gap plans never ran');
  assert.match(replay, /before any\s+executor dispatch/,
    'the replay arm does not say it stops before any executor dispatch, which is the whole '
    + `point of stopping: ${replay}`);
  assert.ok(execute.indexOf('<step name="locate">') < execute.indexOf('<step name="git_guard">'),
    '`locate` no longer opens before `git_guard`, so the replay stop lands after the '
    + 'protected-branch question it exists to avoid asking');
});

test('EXP-03: only the plans without a completed report reach a dispatch', () => {
  // The other half of the same defect: a phase whose plan 1 finished and whose
  // plan 2 never started must still run, with plan 1 NOT re-dispatched. WHICH
  // plans those are is `replay-check`'s `dispatch_set` and is pinned by
  // `planning-replay-check.test.mjs`; what is pinned here is that both dispatch
  // SITES honour it.
  //
  // Both sites, not just the rail. A rail stated only in `locate` with
  // `execute-parallel.md` still saying "per plan" is exactly how plan 1 gets
  // re-dispatched on a non-overlapping two-plan phase, and that file is the site
  // that ACTS on the parallel path.
  const execute = doc('cadence-core', 'workflows', 'execute.md');
  const locate = stepBody(execute, 'locate', 'execute.md');

  // 1. `locate` takes the set from the seam and names both paths.
  const i = locate.indexOf('**The dispatch set.**');
  assert.notEqual(i, -1,
    "execute.md's locate step defines no dispatch set, so the answer the replay call already "
    + 'returned is spent on one all-or-nothing decision and a part-finished phase re-runs its '
    + 'finished plans');
  const set = locate.slice(i).split('\n\n')[0];
  assert.match(set, /dispatch_set/,
    `the dispatch set is not taken from the seam's \`dispatch_set\` field: ${set}`);
  assert.match(set, /--rerun/,
    `the dispatch set does not say what \`--rerun\` does to it, so the override is ambiguous: ${set}`);
  assert.match(set, /sequential/i,
    'the dispatch set rail does not name the sequential path');
  assert.match(set, /parallel/i,
    'the dispatch set rail does not name the parallel path, which is the one with its own '
    + 'dispatch sentence in a separate file');

  // 2. The sequential dispatch sentence iterates the SET, not every plan.
  const seq = stepBody(execute, 'execute_sequential', 'execute.md');
  const seqDispatch = sentenceAround(seq, 'dispatch ONE cad-executor',
    "execute.md's execute_sequential step");
  assert.match(seqDispatch, /dispatch set/,
    'execute_sequential still dispatches every plan the phase lists rather than the dispatch '
    + `set, so a plan with a completed report is re-dispatched: ${seqDispatch}`);

  // 3. The parallel path's OWN dispatch sentence, in the file that acts on it.
  const parallel = doc('cadence-core', 'references', 'execute-parallel.md');
  const parDispatch = sentenceAround(parallel, 'cad-executor per plan',
    'execute-parallel.md step 1');
  assert.match(parDispatch, /DISPATCH SET/i,
    'execute-parallel.md step 1 still dispatches one executor per plan rather than per plan '
    + `in the dispatch set, so the rail stated in locate is contradicted where it acts: ${parDispatch}`);

  // 4. And the set does NOT reach `summary`: SUMMARY.md is the phase's record,
  //    so a skipped plan's report is still read there.
  const summary = stepBody(execute, 'summary', 'execute.md');
  assert.match(summary, /each plan's `<plandir>\/reports\/plan-<k>\.md`/,
    "execute.md's summary step no longer reads every plan's report, so a plan skipped at "
    + 'dispatch drops out of the phase record its work is part of');
});

// --- DOC-02: README counts its own skills, roles and rung files --------------

test('README\'s "Today it is N skills and M agent roles across K rung files" matches the tree', () => {
  // The defect this pins. That sentence is the only place the plugin states its
  // own size, and nothing read it against the tree: the v3.1.0 correction to the
  // skill number (README-44 in .planning/DOCS-CLAIMS.md) was found by a human
  // doc sweep, a year of cycles apart from the commit that changed the count.
  // Both sides are measured HERE, in the same run - a number typed into this
  // test would pin today's tree and report a correct future count as a defect.
  //
  // README.md ONLY (D-06). LINEAGE.md duplicates the same two counts and still
  // publishes a stale agents row, but it is a historical doc self-verify
  // already excludes and it stays a queue item. And not in self-verify.mjs
  // either: that runs against every --root fixture and any user tree it is
  // pointed at, where a `skills/` count means nothing.
  const stated = doc('README.md')
    .match(/Today it is (\d+) skills and (\d+) agent roles across (\d+) rung files/);
  assert.ok(stated, 'README.md states no "Today it is N skills and M agent roles '
    + 'across K rung files" sentence - the counts this test compares are gone');

  // Skills: the ones a USER can invoke. `user-invocable: false` marks the
  // contract skills, which are preloaded into an agent and never appear in
  // anyone's slash-command list, so counting them would overstate the surface.
  // Read from the frontmatter block rather than from anywhere in the file, so
  // prose quoting the key cannot silently drop a skill from the count.
  const skills = readdirSync(join(REPO, 'skills'), { withFileTypes: true })
    .filter((e) => e.isDirectory()).map((e) => e.name).sort()
    .filter((name) => {
      const front = doc('skills', name, 'SKILL.md').split(/^---$/m)[1];
      assert.ok(front, `skills/${name}/SKILL.md has no frontmatter block`);
      return !/^user-invocable:\s*false\s*$/m.test(front);
    });

  // Rung files: every `.md` directly under agents/. Roles: those filenames with
  // the rung suffix stripped. The suffix VOCABULARY is read off
  // route-table.json's `rung_order` rather than typed, so a new rung renames
  // agent files and this keeps deriving the same six roles instead of counting
  // the new spelling as a seventh.
  const rungs = readdirSync(join(REPO, 'agents')).filter((f) => f.endsWith('.md'));
  assert.ok(rungs.length, 'no agent files under agents/');
  const order = JSON.parse(doc('cadence-core', 'route-table.json')).rung_order;
  assert.ok(Array.isArray(order) && order.length, 'route-table.json states no rung_order');
  const suffix = new RegExp(`-(?:${order.join('|')})$`);
  // The analyzer's UNSUFFIXED file is its xhigh rung (route-table.json:4), so a
  // name carrying no suffix is already the role.
  const roles = new Set(rungs.map((f) => f.replace(/\.md$/, '').replace(suffix, '')));

  const wrong = /** @type {[string, number, number][]} */ ([
    ['skills', Number(stated[1]), skills.length],
    ['agent roles', Number(stated[2]), roles.size],
    ['rung files', Number(stated[3]), rungs.length],
  ]).filter(([, said, is]) => said !== is)
    .map(([what, said, is]) => `${what}: README says ${said}, the tree has ${is}`);

  assert.deepEqual(wrong, [],
    `README's count sentence disagrees with the tree - ${wrong.join('; ')}`);
});

// --- DOC-02: PROJECT.md declares its milestone before it mentions another ----

test('PROJECT.md\'s `### Active` declares its milestone as the section\'s first version token', () => {
  // The defect this pins, measured at 81bdb5d: the section's first version
  // token was `v3.2.0` on its opening line - correct - and activeVersion()
  // returned `v3.0.0`, a token forty lines below it that landed at the start of
  // a line only because markdown wrapped a sentence there. Nothing compares
  // those two readings, so the docs were right and every consumer of
  // activeVersion() was wrong: version_drift compares its answer against the
  // tag list, and the branch-naming seam refuses an integration branch on it.
  //
  // The property is that the two scans AGREE, not that either equals a value:
  // an assertion phrased as "the first version token" would have PASSED on the
  // broken file, and one naming a version would need re-baselining every cycle
  // open.
  //
  // THE READER NOW CARRIES THAT PROPERTY (phase 2 D-03, reversing this pin's
  // own D-07 policy). DRF-01 moved it into activeVersion(): the two scans both
  // run over the whole `### Active` body, and a line-anchored token is admitted
  // as the declaration only when it AGREES with the body's first token or its
  // line OPENS a sentence rather than continuing a wrapped one - a rejected
  // anchor contributing nothing, so the earlier correct mention answers. The
  // 81bdb5d file above now reads `v3.2.0` unchanged, which is why the sentence
  // this comment used to end on - the file is what moves when this goes red -
  // no longer describes the code and was deleted rather than left standing.
  //
  // So a red run here means something NARROWER than it did, and it is the only
  // shape left: activeVersion() admitted an anchored token through the
  // sentence-opening arm while this repository's own `### Active` names a
  // different version earlier in its prose. The wrapped-continuation defect
  // cannot reach this assertion any more - the reader ignores it and answers
  // the first token, which is agreement. What that leaves is a question about
  // the READER's admission rule (`lib/branch-decision.mjs`, with the four
  // fixtures at branch-decision.test.mjs:237-266 pinning what it may not cost),
  // not a hand-edit of the section: read which of the two versions is the
  // milestone, and if it is the one activeVersion() returned, this pin is the
  // stale reading and is re-derived from the reader's rule.
  const text = doc('.planning', 'PROJECT.md');
  const lines = text.split('\n');
  const start = lines.findIndex((l) => /^###\s+Active\b/.test(l));
  assert.ok(start >= 0, '.planning/PROJECT.md has no `### Active` section');

  // The body exactly as activeVersion's own doc comment bounds it: the heading
  // to the next level-1..3 heading.
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^#{1,3}\s/.test(lines[i])) { end = i; break; }
  }

  // The loose scan. This token shape is spelled here rather than imported
  // because branch-decision.mjs exports neither regex and this task does not
  // modify it; it is a GRAMMAR and not a version, so it never re-baselines.
  const token = /v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?/;
  let first = null;
  for (let i = start + 1; i < end; i++) {
    const m = lines[i].match(token);
    if (m) { first = { version: m[0], line: i + 1 }; break; }
  }
  assert.ok(first, '.planning/PROJECT.md\'s `### Active` body names no version at all');

  const declared = activeVersion(text);
  assert.ok(declared, 'activeVersion() reads no version from a body that names one');
  // The line it was read on: the first body line naming that token, which is
  // its anchored line whenever the section names it once.
  const at = lines.findIndex((l, i) => i > start && i < end && l.includes(declared)) + 1;

  assert.equal(declared, first.version,
    `activeVersion() reads ${declared} (line ${at}) as the milestone while the \`### Active\` `
    + `body's FIRST version token is ${first.version} (line ${first.line}). Since phase 2 `
    + 'D-03 the agreement property lives in activeVersion() itself, which admits a '
    + 'line-anchored token only on agreement or on a line that opens a sentence - so the one '
    + 'reading that still reaches here is the sentence-opening admission, and version_drift '
    + `is comparing ${declared} against the tag list. Settle which version is the milestone: `
    + 'the remedy is the READER\'s admission rule in lib/branch-decision.mjs and this pin '
    + 'derived from it, not a hand-edit of the section, which no longer has to route around '
    + 'where markdown wrapped a line.');
});

// --- AC6: the executor is told the surfaces it will be judged on -------------

test('the executor dispatch hands over the resolve\'s answered surfaces, and the contract says what to do with them', () => {
  // `route.mjs resolve` has always returned `surfaces` and `surfaces_answered`
  // on every dispatch - a `--role cad-executor` resolve on this repo returns
  // six answered surfaces - and the executor was never handed them. The worker
  // therefore met its own risk bar for the first time when the `risk_surface`
  // review fired against its committed range, which is the most expensive
  // moment to learn it.
  const execute = doc('cadence-core', 'workflows', 'execute.md');
  const start = execute.indexOf('<step name="execute_sequential">');
  const end = execute.indexOf('Do NOT restate the executor\'s standing rules', start);
  assert.ok(start >= 0 && end > start, 'execute.md has no execute_sequential dispatch prompt');
  const prompt = execute.slice(start, end);
  assert.match(prompt, /`surfaces`/,
    'the executor dispatch prompt does not hand over the resolve\'s `surfaces`');
  assert.match(prompt, /surfaces_answered/,
    'the dispatch prompt names `surfaces` but never says what an UNANSWERED resolve means - '
    + '`surfaces_answered: false` means all of the table\'s categories stand, not none');

  // The other half: the contract states what the executor DOES with them, and
  // it may not invent a category. The vocabulary is machine-readable, so this
  // is the same subject as every other check in this file.
  const values = JSON.parse(doc('cadence-core', 'config.schema.json'))
    .keys['review.triggers.risk_surface.surfaces'].values;
  const contract = doc('skills', 'cad-executor-contract', 'SKILL.md');
  const para = contract.split(/\n\s*\n/).find((p) => p.includes('surfaces'));
  assert.ok(para, 'skills/cad-executor-contract/SKILL.md never mentions the risk surfaces');
  const named = [...para.matchAll(/`([a-z][a-z_]+)`/g)].map((m) => m[1])
    .filter((t) => t !== 'surfaces' && t !== 'risk_surface');
  assert.ok(named.length > 0, 'the contract\'s surfaces paragraph names no category at all');
  for (const t of named) {
    assert.ok(values.includes(t),
      `the executor contract names surface \`${t}\`, which config.schema.json's `
      + `review.triggers.risk_surface.surfaces does not carry (${values.join(', ')})`);
  }
});

// --- RSK-01/RSK-02: detection is the seam's answer, and completion needs it ---

test('both fire sites invoke the risk-check seam rather than reading a prose list', () => {
  // The defect: detection was execute.md and task.md telling a model to check a
  // diff against the eight categories in references/review-triggers.md. A fire
  // wrote a lifecycle event and a NON-match wrote nothing, so the run record
  // could not tell "the detection step was skipped" from "it ran and matched
  // nothing". The heuristics stay heuristics; what moved is that the answer is
  // computed by something that always returns one and always records it.
  const execute = doc('cadence-core', 'workflows', 'execute.md');
  const task = doc('cadence-core', 'workflows', 'task.md');
  assert.match(execute, /risk-check run/,
    "execute.md's post-plan step no longer calls the risk-check seam");
  assert.match(task, /risk-check run/,
    "task.md's risk_check step no longer calls the risk-check seam");
  // FST-02's third shipped byte. The two below it - the transient `.diff` rails
  // and the `written: false` withholding - are already pinned (DFC-04 above,
  // ENFORCEMENT below); only the phase number was unheld.
  assert.match(task, /risk-check run --phase 0/,
    "task.md's risk_check step calls the seam without `--phase 0` - a task sits "
    + 'outside the phase spine and 0 is the one number no roadmap phase carries, '
    + "so any other value files the task's range against a real phase's records");
  // An unjudged range is not a cleared one, and widening is the only safe
  // direction on the one gate that is `blocking` at every stakes level.
  assert.match(execute, /inconclusive/,
    'execute.md dropped the rule that an inconclusive range fires the trigger');
});

test('cad-land step 3: the auto_close branch takes its value from `config.mjs get`', () => {
  // AC2's other half, at the CALL SITE. The seam-level arms in
  // config-seams.test.mjs prove the two resolutions differ and that the gate
  // reads the merged one - but they all still pass on a tree where THIS skill
  // was repointed at the raw repo value, which would leave the ask and the gate
  // reading different sources with every arm green. The pairing is: the arm
  // that switched off the human is the arm the gate covers.
  const skill = doc('skills', 'cad-land', 'SKILL.md');
  const labelOf = regionLabels(skill);

  // The ONE up-front read the whole run reuses, and the branch statement itself.
  const upfront = /Read every config key this run needs in ONE `config\.mjs get` up front[\s\S]*?\n\n/
    .exec(skill);
  assert.ok(upfront, 'cad-land no longer states its ONE up-front config.mjs get');
  assert.match(upfront[0], /git\.auto_close/,
    'git.auto_close left the up-front `config.mjs get` list, so the branch value comes from elsewhere');
  const branch = skill.split('\n').filter((l, i) => labelOf(i) === '3').join('\n');
  assert.match(branch, /branch on `git\.auto_close`/,
    'step 3 no longer states what it branches on');

  // And from NO other source. A raw repo-layer read or the `authorized` seam
  // appearing as the thing step 3 branches on is exactly the collapse 0b1c322
  // made and had reverted: the ask would skip on one value while
  // land-cleanup.mjs gate halts on another. `authorized` belongs INSIDE 3(b),
  // gating the GitLab mutation - never above the branch.
  const decides = upfront[0] + '\n' + branch;
  assert.doesNotMatch(decides, /\.planning\/config\.json/,
    'step 3 branches on a raw repo-layer read instead of the merged `config.mjs get`');
  assert.doesNotMatch(decides, /git-publish\.mjs" authorized/,
    'step 3 branches on the AUTHORIZED value; the ask and the gate must read one merged value');
});

test('cad-land 3(b): the GitLab arm consults the authorization seam BEFORE it creates', () => {
  // On GitHub and Forgejo the unattended chain has to come through
  // `git-publish.mjs publish` to get the branch onto the remote, so the
  // repo-layer refusal stops it. On GitLab `glab mr create` publishes the source
  // branch itself: no seam call happened, and an unattended merge proceeded on a
  // `git.auto_close` the repository never set. The enforcement on that host IS
  // this prose, so a seam test alone proves nothing.
  const skill = doc('skills', 'cad-land', 'SKILL.md');
  const rails = doc('cadence-core', 'references', 'git-publish.md');
  const labelOf = regionLabels(skill);
  // The 3(b) region alone, blanked elsewhere so line ORDER is preserved: the
  // same notion of "inside the anchor" the deferred-read check uses.
  const region = skill.split('\n').map((l, i) => (labelOf(i) === '3(b)' ? l : '')).join('\n');

  for (const [name, text] of [['skills/cad-land/SKILL.md', skill],
    ['cadence-core/references/git-publish.md', rails]]) {
    assert.doesNotMatch(text, /no seam call is needed/,
      `${name} states the GitLab non-gating as correct again`);
  }

  const seamAt = region.indexOf('git-publish.mjs" authorized');
  const createAt = region.indexOf('glab mr create --source-branch');
  assert.ok(createAt > -1, 'step 3(b) no longer spells the glab mr create invocation');
  assert.ok(seamAt > -1, 'step 3(b) does not call git-publish.mjs authorized on the GitLab arm');
  // ORDER, not presence. A tree that keeps the seam call but moves it after the
  // create has already published the branch by the time it asks - which is the
  // whole failure this closes.
  assert.ok(seamAt < createAt,
    'the authorization consult comes AFTER glab mr create, which publishes the branch itself');
  // The reuse arm, not the create, is the one this ordering exists for: an MR
  // already open for the branch skips the create entirely, so a consult placed
  // beside `glab mr create` never runs and `glab mr merge` lands unauthorized.
  const viewAt = region.indexOf('glab mr view <branch>');
  assert.ok(viewAt > -1, 'step 3(b) no longer spells the glab mr view reuse probe');
  assert.ok(seamAt < viewAt,
    'the authorization consult comes AFTER the glab mr view reuse probe, so an '
    + 'already-open MR reaches glab mr merge with no seam call behind it');
  assert.match(region, /ok:false/,
    'step 3(b) never says what the GitLab arm does when the seam refuses');
});

test('cad-land step 3: the deferred queue refuses ahead of BOTH publish arms', () => {
  // The falsifier for "an unadjudicated deferred finding stops the land":
  // deleting the invocation has to redden something, or the guarantee is prose
  // nobody checks. ORDER and REGION, not presence - a call that sits inside
  // 3(a) never runs on the unattended arm, which is the one path nobody
  // watches, and a call placed after either arm has already published.
  const skill = doc('skills', 'cad-land', 'SKILL.md');
  const labelOf = regionLabels(skill);
  const lines = skill.split('\n');
  const at = (needle) => lines.findIndex((l) => l.includes(needle));

  const call = at('planning.mjs" deferred list');
  assert.ok(call > -1, 'cad-land step 3 no longer asks the queue what is still deferred');
  assert.equal(labelOf(call), '3',
    'the deferred-queue refusal moved inside a publish arm; it governs both, so it '
    + 'belongs to step 3 itself');
  const armA = at('**(a) `git.auto_close` false');
  const armB = at('**(b) `git.auto_close` true');
  assert.ok(armA > -1 && armB > -1, 'step 3 no longer spells its two publish arms');
  assert.ok(call < armA && call < armB,
    'the queue is read AFTER a publish arm begins, so the land it must stop has already started');

  // It is a NEW arm, never land-cleanup.mjs gate (D-06): that gate halts only
  // under git.auto_close and reads only risk_surface survivors, so folding this
  // into it would publish straight over a deferred plan/diff/phase_diff finding
  // on the default configuration.
  const step3 = lines.filter((l, i) => labelOf(i) === '3').join('\n');
  assert.match(step3, /NOT `land-cleanup\.mjs gate`/,
    'step 3 no longer says the deferred refusal is not the auto_close survivor gate');
  assert.match(step3, /STOP the land here/, 'step 3 no longer says what a member does');
  // An unprovable queue refuses exactly as a member does - the gate never
  // reports "nothing deferred" about input it could not read.
  assert.match(step3, /unreadable/,
    'step 3 no longer states that a queue it could not read refuses too');
  assert.match(step3, /references\/triage-gate\.md/,
    'step 3 no longer routes the reader to the arm that says how to clear a member');

  const guardrails = /<guardrails>([\s\S]*?)<\/guardrails>/.exec(skill);
  assert.ok(guardrails, 'cad-land lost its guardrails block');
  assert.match(guardrails[1], /deferred finding is the one thing that stops it/,
    'the guardrails no longer name the one thing that stops a land');
});

// --- LND-02: the carry runs BEFORE the prune that deletes what it carries ----
//
// FILE POSITION, because nothing else can see it. self-verify's check 2
// resolves `risk-carry --phase` against its CONTRACTS row and a grep proves no
// raw-findings union survives, but both are blind to WHERE in step 3 the call
// sits - and a carry written below `milestone-prune` reads a directory that
// `--mode delete` already `rmSync`ed, so it copies nothing, exits `ok:true`,
// and the /cad-land chained after it reads an empty set as "nothing survived".
// That is LND-02's own defect rebuilt one paragraph out of order.

test('LND-02: milestone.md carries the rulings BEFORE the prune, and stops on ok:false', () => {
  const text = doc('cadence-core', 'workflows', 'milestone.md');
  const lines = text.split('\n');
  const at = (needle) => lines.findIndex((l) => l.includes(needle));

  const stepStart = at('## 3. Prune completed phases + cleanup');
  const stepEnd = lines.findIndex((l, i) => i > stepStart && l.startsWith('## 4.'));
  assert.ok(stepStart > -1 && stepEnd > stepStart, 'milestone.md no longer spells step 3');

  const carry = at('planning.mjs" risk-carry --phase');
  const prune = at('planning.mjs" milestone-prune');
  assert.ok(carry > -1, 'milestone.md step 3 no longer runs the risk_surface carry at all, so '
    + 'the prune below it deletes the only rulings the unattended close can halt on');
  assert.ok(prune > -1, 'milestone.md no longer runs milestone-prune');
  assert.ok(carry > stepStart && carry < stepEnd,
    'the risk_surface carry left step 3, the step that runs before the prune');
  assert.ok(carry < prune,
    'milestone.md runs the risk_surface carry AFTER milestone-prune, which removes the '
    + 'phases/<N>/ directory the carry reads its rulings out of');

  // The relay is a STOP, not a note, and it is read out of the carry's OWN
  // paragraph - the deferred carry below it states the same rule about a
  // different artifact, so an unscoped match would pass on that one alone.
  const deferred = at('planning.mjs" deferred carry');
  assert.ok(deferred > carry,
    'the deferred carry no longer follows the risk_surface carry, so the region below is unbounded');
  const region = lines.slice(carry, deferred).join(' ').replace(/\s+/g, ' ');
  assert.match(region, /ok:false[^.]{0,80}stop/i,
    'milestone.md no longer says an `ok:false` from the risk_surface carry STOPS the close. '
    + 'Continuing past one prunes exactly the rulings the carry could not copy');
  assert.match(region, /\.planning\/risk-carry\//,
    'the carry paragraph no longer names `.planning/risk-carry/`, which is the root '
    + '/cad-land globs for the records the phase dirs no longer hold');

  // And step 7 does NOT delete it, on either arm. Step 3 already pruned the
  // phase dirs, so this carry is the LAST copy of the rulings the halt rests
  // on: cleared at the close, the retried /cad-land globs two empty roots, is
  // handed {"findings":[]} and merges over the blocker the halt just refused.
  // The clear belongs to the one actor that can prove the halt was answered.
  const seven = lines.findIndex((l) => l.startsWith('## 7.'));
  const eight = lines.findIndex((l, i) => i > seven && l.startsWith('## 8.'));
  assert.ok(seven > -1 && eight > seven, 'milestone.md no longer spells step 7');
  const step7 = lines.slice(seven, eight).join(' ').replace(/\s+/g, ' ');
  assert.match(step7, /Do NOT delete `\.planning\/risk-carry\/` here, on either arm/,
    'step 7 deletes `.planning/risk-carry/` again. Step 3 pruned the phase dirs, so that is '
    + 'the last copy of the rulings the halt rests on, and the next /cad-land merges over it');
  assert.match(step7, /`\/cad-land` step 4/,
    'step 7 no longer names WHICH actor clears the carry, so it is either cleared before the '
    + 'halt is answered or never cleared at all');
  assert.match(step7, /CONFIRMED landed/,
    'step 7 no longer ties the clear to a merge that confirmed - the only event proving the '
    + 'halt was answered rather than abandoned');

  // ...and that actor has to EXIST. Deferring the delete to a step /cad-land
  // does not have leaves the carry on disk forever, which halts every later
  // close on rulings a milestone already answered - the failure the deleted
  // "BOTH arms" sentence was guarding against.
  const land = doc('skills', 'cad-land', 'SKILL.md');
  const step4 = (land.split('4. **Terminal cleanup')[1] || '').split('</process>')[0]
    .replace(/\s+/g, ' ');
  assert.match(step4, /Delete `\.planning\/risk-carry\/`/,
    "cad-land's terminal cleanup no longer deletes `.planning/risk-carry/`, so nothing clears "
    + 'the carry milestone.md step 7 now deliberately leaves behind');
  assert.match(step4, /ONLY actor that clears them/,
    'cad-land step 4 no longer claims sole ownership of the clear, which is what stops a '
    + 'second site deleting the records before any merge landed');
});

// --- LND-02: the gate's caller pipes rulings, and names what nothing ruled ---
//
// The seam cannot check its own input. `land-cleanup.mjs gate` reads stdin and
// nothing else (D-07), so WHAT the coordinator unions is decided entirely by
// this bullet: a sentence that sent it back to the REVIEW files' `findings`
// arrays would halt every close on the reviewer's raw claims - the pre-fix,
// pre-refutation, pre-downgrade text - and the seam would report that halt as
// correct. `unruled` and `overridden` are the two payload/envelope keys only
// this prose can populate or surface, so an unnamed one is a dead key.

test('LND-02: cad-land 3(b) unions the RULINGS from both roots, not the review findings', () => {
  const skill = doc('skills', 'cad-land', 'SKILL.md');
  const lines = skill.split('\n');
  const start = lines.findIndex((l) => l.includes('land-cleanup.mjs\" gate'));
  assert.ok(start > -1, 'cad-land no longer pipes anything to land-cleanup.mjs gate');
  // The bullet is the block the gate call sits in: back to its `- **` opener,
  // forward to the next one, so a neighbouring bullet cannot satisfy a row here.
  const open = lines.slice(0, start + 1).map((l, i) => [l, i])
    .filter(([l]) => /^\s*- \*\*/.test(String(l))).pop();
  assert.ok(open, 'the gate call no longer sits inside a bullet of step 3');
  const end = lines.findIndex((l, i) => i > Number(open[1]) && /^\s*- \*\*/.test(l));
  const bullet = lines.slice(Number(open[1]), end > -1 ? end : lines.length)
    .join(' ').replace(/\s+/g, ' ');

  for (const [needle, why] of [
    ['ADJUDICATION-risk_surface*.json', 'the record it reads'],
    ['.planning/phases/*/', 'the live record root'],
    ['.planning/risk-carry/*/', 'the carried record root, the only one left after a prune'],
    ['entries[]', 'the array the union is taken from'],
    ['unruled', 'the payload key that halts on a fire nothing ruled'],
    ['overridden', 'the envelope key carrying a halt a person already cleared'],
    ['{\"findings\":[]}', 'the only spelling of "nothing survived"'],
  ]) {
    assert.ok(bullet.includes(needle),
      `cad-land's gate bullet no longer names \`${needle}\` (${why})`);
  }
  assert.match(bullet, /every round/i,
    "the bullet no longer says EVERY round is unioned - round 2's record is not round 1's, "
    + 'and taking the highest alone drops what only an earlier round stated');
  assert.match(bullet, /never parsed/,
    'the bullet dropped the sentence that the gate never reports "no surviving finding" '
    + 'about input it never parsed');

  // The negative half, and it is the requirement itself: nothing here may send
  // the coordinator back to the raw review text.
  assert.doesNotMatch(bullet, /union (?:their|the) `?findings`? arrays/i,
    "cad-land unions the REVIEW files' raw `findings` arrays again, which halts the close on "
    + 'findings already fixed, refuted, downgraded or overridden - LND-02 exactly');

  // The PAIRING, which is the whole of `unruled`. REVIEW-<t>-<d>.md and
  // ADJUDICATION-<t>-<d>.json cannot share a basename by construction, so a
  // "same basename" test matches nothing, every review lands in `unruled`, and
  // every close hard-halts on a fire that was in fact ruled.
  assert.doesNotMatch(bullet, /same basename/i,
    'cad-land pairs a review to its ruling by basename again. REVIEW-<trigger>-<discriminator>'
    + '.md and ADJUDICATION-<trigger>-<discriminator>.json never share one, so every review '
    + 'reads as unruled and every close hard-halts');
  assert.match(bullet, /same trigger, same discriminator, same round/,
    'the bullet no longer states what actually pairs a review with its ruling, which leaves '
    + 'the coordinator to invent a test');
  assert.match(bullet, /round-1\s+record never rules a round-2 review/,
    'the bullet no longer forbids a round-1 record from ruling a re-arm, so an unadjudicated '
    + 'round 2 reads as settled and its survivors are never checked');
  // ...and the asymmetry the corpus forces, or a strict same-round test halts
  // the very close D-14's fixture is taken from.
  assert.match(bullet, /LATER round's record does rule an earlier review/,
    "the bullet dropped the asymmetry v3.7.7's phase 2 forces - a round-1 REVIEW whose only "
    + 'record is `-r2.json` - so a strict same-round test halts a close that was fully ruled');

  // The legacy root aggregate is a halt WITH A REMEDY, never a permanent one.
  // `.planning/REVIEW-risk_surface-<label>.md` is what a pre-`risk-carry`
  // /cad-milestone wrote - ONE union of RAW findings under no discriminator -
  // so no ADJUDICATION-*.json can ever sit beside it and it lands in `unruled`
  // at every close. Both ways of leaving it there are bugs: scanned with no
  // remedy stated it halts every unattended close forever, and dropped from the
  // scan a real leftover blocker goes invisible. The bullet has to do both.
  assert.ok(bullet.includes('.planning/REVIEW-risk_surface-*.md'),
    'cad-land stopped scanning the legacy `.planning/` root aggregate, so an interrupted '
    + 'pre-`risk-carry` close leaves a file that may carry an unfixed blocker and no close '
    + 'ever looks at it again');
  assert.match(bullet, /can ever sit beside it/,
    'the bullet no longer says the legacy aggregate can NEVER be ruled, so a coordinator '
    + 'retries the close waiting for an adjudication that cannot exist');
  assert.match(bullet, /ONCE and BY HAND/,
    'the bullet no longer states who answers the legacy halt, which is the whole difference '
    + 'between a one-time gate and a permanent one');
  assert.match(bullet, /then delete the file/,
    'the bullet no longer names the act that clears the legacy halt, so one stale '
    + 'pre-upgrade file halts every unattended close forever with no remedy');

  // The same rule, in the reference a reader consults instead of this bullet.
  const ref = doc('cadence-core', 'references', 'risk-surface.md');
  assert.doesNotMatch(ref, /no sibling record of the same basename/,
    'risk-surface.md still states the basename pairing no filename pair can satisfy, so the '
    + 'bug returns through the reference door');
  assert.match(ref, /REVIEW-risk_surface-<label>\.md/,
    'risk-surface.md says nothing about the legacy root aggregate, so the reference that '
    + 'documents this pairing disagrees with the gate bullet that halts on it');
  assert.doesNotMatch(ref, /step 7 deletes (?:it|this|the)/,
    'risk-surface.md claims milestone.md step 7 deletes a carried file again. Step 7 deletes '
    + 'nothing now, and a stale cleanup claim is how a permanent halt gets designed in');
});

test('progress.md: the deferred count is read off the envelope at both its sites', () => {
  // D-05's enforcement. The COUNT comes from `status`, never parsed back out of
  // the cursor's `Next:` free text - the substitution this repository already
  // condemned for trigger names, where one trigger was spelled four different
  // ways across 35 shipped events. A workflow that named the queue only in its
  // report would leave the figure to be derived by hand.
  const wf = doc('cadence-core', 'workflows', 'progress.md');
  const labelOf = regionLabels(wf);
  const lines = wf.split('\n');
  const region = (name) => lines.filter((l, i) => labelOf(i) === name).join('\n');

  const derive = region('derive');
  assert.match(derive, /`deferred`/,
    'the derive step no longer names the `deferred` key the one status line carries');
  assert.match(derive, /ALWAYS present/,
    'the derive step no longer says the key is always present, so an absent one reads as empty');
  assert.match(derive, /never from\s+the cursor's `Next:` text/,
    'the derive step no longer forbids taking the count off the cursor');

  const report = region('report');
  assert.match(report, /deferred\.findings/,
    'the report step no longer prints the count, or no longer takes it from the envelope');
  assert.match(report, /never taken off the\s+cursor/,
    'the report step no longer forbids taking the count off the cursor');

  // The ROUTE row, and where it sits. Every row below it ends a cycle and each
  // of those leads to a land - /cad-milestone chains /cad-land after its prune.
  const route = region('route');
  const routeLines = route.split('\n');
  const at = (needle) => routeLines.findIndex((l) => l.includes(needle));
  const queued = at('`deferred.findings` non-zero');
  assert.ok(queued > -1, 'the route table no longer has a row for a non-zero deferred count');
  assert.match(routeLines[queued], /never \/cad-land/,
    'the deferred route row no longer says a queued finding does not route to a land');
  for (const later of ['Drift kind `phase-dir`', '`cycle` is `none`', '`current` is null']) {
    assert.ok(at(later) > queued, `the deferred row sits below "${later}", which routes toward a land`);
  }
  for (const earlier of ['Paused cursor', 'Lowest **planned** phase']) {
    assert.ok(at(earlier) > -1 && at(earlier) < queued,
      `the deferred row displaced "${earlier}", which is a recovery state and takes precedence`);
  }

  // And no new cursor status value (D-05): one outside planning.mjs's AGREE map
  // is reported as `cursor` drift and rewritten by the very next /cad-progress,
  // so the cursor would stop naming the queue one command after it was written.
  assert.doesNotMatch(region('reconcile'), /deferred/,
    'the reconcile step gained a deferred status mapping; the cursor carries a POINTER, not a state');
});

test('execute.md state: a deferring run points the cursor at its queue and commits it', () => {
  // Both halves of what makes a deferred finding survive the session that
  // deferred it: a resume pointer that says the queue is there, and the member
  // itself in git. `.planning/trace.jsonl` is gitignored and the sibling REVIEW
  // file is committed by nothing, so an untracked member is gone on a fresh
  // clone - and the land it was written to stop publishes over it.
  const wf = doc('cadence-core', 'workflows', 'execute.md');
  const labelOf = regionLabels(wf);
  const state = wf.split('\n').filter((l, i) => labelOf(i) === 'state').join('\n');

  assert.match(state, /cursor set --phase <N> --status executed --next-file <path>/,
    'the deferring branch no longer takes the --next-file transport');
  assert.match(state, /DEFERRED a fire/,
    'the state step no longer branches on whether this run deferred anything');
  // The transport is the POINT: the pointer is composed from what the run did,
  // which is caller-derived text, and conventions.md binds that to a path.
  assert.match(state, /caller-derived text rides a path/,
    'the state step no longer says WHY the deferring branch uses a file');
  // And NO new cursor status (D-05): one outside planning.mjs's AGREE map is
  // reported as `cursor` drift and rewritten by the very next /cad-progress.
  assert.match(state, /Keep `--status executed` exactly as it\s+is/,
    'the state step no longer pins --status executed on the deferring branch');

  assert.match(state, /\.planning\/phases\/<N>\/DEFERRED-\*\.json/,
    'the commit list no longer stages the queue member, so it is untracked on a fresh clone');
});

test('ENFORCEMENT, execute.md: the plan is not reported done while risk-check status refuses', () => {
  // Detection without enforcement is precisely the outcome RSK-02 exists to
  // prevent, and it passes every other check in this phase. A tree carrying
  // `risk-check run` at both fire sites and NEITHER this sentence nor task.md's
  // `written: false` sentence must go RED here.
  const execute = doc('cadence-core', 'workflows', 'execute.md');
  assert.match(execute, /risk-check status/,
    'execute.md detects a risk surface but never re-reads the record before reporting done');
  assert.match(execute, /not reported done while that call refuses/i,
    'execute.md calls risk-check status without withholding done on its refusal - '
    + 'detection without enforcement is the outcome RSK-02 exists to prevent');
});

test('ENFORCEMENT, task.md: done is withheld on `written: false`', () => {
  // `ok:true, written:false` - a symlinked trace, a failed stat, a full disk,
  // the size-cap bound - is NOT a completed check. The execute path is covered
  // by its own `risk-check status` call, which re-reads the trace and finds
  // nothing; the task path has no status call, so this flag is its whole guard.
  const task = doc('cadence-core', 'workflows', 'task.md');
  assert.match(task, /`written: false`/,
    'task.md never states the written flag, so a record that never landed reports done');
  assert.match(task, /`written: false`[^.]*(do not|does not|never)\s+report\s+done/i,
    "task.md's risk_check step states the written flag but not that done is withheld on it - "
    + 'detection without enforcement is the outcome RSK-02 exists to prevent');
});

// --- ENFORCEMENT: the FAIL branch is a DISPATCH, and its guardrail ----------
//
// Two halves of one rule, asserted on TWO SLICES of execute.md so neither can
// hide behind the other: the `execute_sequential` step's blocking FAIL arm
// names a continuation `cad-executor`, and the `<guardrails>` block forbids the
// coordinator's own `Edit`/`Write` outside `.planning/`. A whole-file grep
// cannot serve - `cad-executor` appears a dozen times in this file for the
// ordinary per-plan dispatch, and it would pass with the FAIL arm deleted.
//
// What each loss COSTS is the same and is worth stating once. Lose the FAIL
// arm and the coordinator is the fix author again; lose the guardrail and it is
// permitted to be. Either way the fix is written by the one participant whose
// output nothing reviews, and by then the ONE-round re-arm cap
// (references/triage-gate.md) is already spent on the fire that failed, so
// every edit in that fix ships unreviewed BY CONSTRUCTION - not by oversight.
//
// Pinned here and not in self-verify.mjs, per phase-1 D-06: that linter's
// problem sites are surface, config, agent and route lints, with no channel for
// a workflow-semantics claim.

test('ENFORCEMENT, execute.md: the blocking FAIL arm dispatches a continuation cad-executor', () => {
  const wf = doc('cadence-core', 'workflows', 'execute.md');
  const labelOf = regionLabels(wf);
  const step = wf.split('\n')
    .filter((l, i) => String(labelOf(i) ?? '').startsWith('execute_sequential'))
    .join('\n').replace(/\s+/g, ' ');
  assert.ok(step.length > 0, 'execute.md has no execute_sequential step - the whole '
    + 'sequential path, gates included, is gone');

  // The `risk_surface` arm ALONE, bounded by two seam invocations rather than
  // by prose: `risk-check run` opens the fire and `risk-check status` closes
  // it, and a rewrap moves neither. The whole step is too WIDE to assert on -
  // the `diff`-at-`adjudicated` arm further down points at this same dispatch
  // ("by the same continuation `cad-executor` ... the FAIL arm above
  // dispatches"), so a check over the step stays green with the `risk_surface`
  // arm deleted outright. Measured, not assumed: deleting that arm's dispatch
  // sentence left a whole-step check passing.
  const from = step.indexOf('risk-check run');
  const to = step.indexOf('risk-check status');
  assert.ok(from > -1 && to > from, 'the execute_sequential step no longer runs `risk-check '
    + 'run` before `risk-check status`, so the risk_surface gate has no arm to assert on');
  const arm = step.slice(from, to);

  // Load-bearing facts only, each one a thing a rewrap cannot move.
  assert.match(arm, /continuation `cad-executor`/,
    'the execute_sequential FAIL arm no longer names a continuation `cad-executor` as the '
    + 'owner of the fix, so the COORDINATOR writes the fix again - and the one-round re-arm '
    + 'cap is already spent on the fire that failed, so that fix ships unreviewed by '
    + 'construction');
  assert.match(arm, /under worker key `<k>`/,
    'the FAIL arm no longer names the worker key `<k>` the fix is dispatched under, so the '
    + 'fix leaves no second bracket on the run record under the plan it belongs to and '
    + 'nothing can show a worker rather than the coordinator authored it');
  assert.match(arm, /\.planning\/phases\/<N>\/REVIEW-risk_surface-plan-<k>\.md/,
    'the FAIL arm no longer carries the PERSISTED findings path, so the coordinator is back '
    + 'to distilling the findings into the prompt itself - the reading step this dispatch '
    + 'exists to take off it');
});

test('ENFORCEMENT, execute.md: the guardrail still forbids a coordinator Edit/Write outside .planning/', () => {
  const wf = doc('cadence-core', 'workflows', 'execute.md');
  const labelOf = regionLabels(wf);
  const rails = wf.split('\n')
    .filter((l, i) => String(labelOf(i) ?? '').startsWith('guardrails'))
    .join('\n').replace(/\s+/g, ' ');
  assert.ok(rails.length > 0, 'execute.md carries no <guardrails> block at all');

  // Stated by PATH, never by role or artifact (phase-1 D-13): that wording is
  // what already permits the lease amendment to `PLAN-<k>.md`, the `summary`
  // write and the `state` write. ONE exception clause stands beside it, for
  // `choose_path`'s `.claude/settings.json` merge - a coordinator write to a
  // path outside `.planning/` that the same file has always required, which
  // D-13's enumeration missed and phase-1 UAT item 8 caught.
  assert.match(rails, /no `Edit` or `Write` against a path outside `\.planning\/`/,
    "execute.md's guardrails no longer forbid the coordinator's own `Edit`/`Write` outside "
    + '`.planning/`. The FAIL arm beside it can then be obeyed and bypassed in the same run: '
    + 'the coordinator edits the source itself, and the one-round re-arm cap is already '
    + 'spent, so those edits ship unreviewed by construction');
});


// --- PAR-01: the parallel branch reaches the SAME risk sequence, by pointer ---
//
// Watched FAILING at e4f95a3, this plan's unpatched baseline: `grep -c
// risk-check cadence-core/references/execute-parallel.md` returned 0 there,
// against 2 for `cadence-core/workflows/execute.md`. The one gate that is
// `blocking` at every stakes level fired on the sequential path and nowhere
// else, so all three checks below go red against that SHA - the first two on
// the two absent command names, the third on the invocation it cannot find.
//
// Three checks and not one, because they fail apart: a tree can call both
// commands while copying the sequence (1), while never withholding done on the
// refusal (2), or while naming a range that is not this plan's own (3).

test('PAR-01: the parallel path REACHES execute.md\'s risk sequence instead of copying it', () => {
  const execute = doc('cadence-core', 'workflows', 'execute.md');
  const parallel = doc('cadence-core', 'references', 'execute-parallel.md');

  assert.match(parallel, /risk-check run/,
    'the parallel path never asks the seam whether a plan\'s range touched a risk surface');
  assert.match(parallel, /risk-check status/,
    'the parallel path detects a risk surface but never re-reads the record before reporting done');

  // The POINTER, both ends. A named step that no longer exists is a pointer
  // into nothing, which is the state a copy gets pasted back in to fix.
  assert.match(parallel, /execute_sequential/,
    'the parallel path names no step of workflows/execute.md as the sequence it defers to');
  assert.match(execute, /<step name="execute_sequential">/,
    'workflows/execute.md no longer carries the step references/execute-parallel.md points at');

  // Two markers workflows/execute.md demonstrably owns today - its fire rule
  // (`inconclusive`) and its transient-file rail (`never stage it`). Markers
  // rather than whole paragraphs: this must redden on a PASTE-BACK in either
  // direction, not on a reformat that changed no fact. A second copy of one
  // rule is two statements that disagree at the next edit.
  for (const marker of [/inconclusive/, /never stage it/]) {
    assert.match(execute, marker,
      `workflows/execute.md lost ${marker}, the sequence references/execute-parallel.md defers to`);
    assert.doesNotMatch(parallel, marker,
      `references/execute-parallel.md restates ${marker}, which workflows/execute.md states - `
      + 'the parallel path points at that sequence and carries no copy of it');
  }
});

test('ENFORCEMENT, execute-parallel.md: a plan is not reported done while risk-check status refuses', () => {
  // The sibling of `ENFORCEMENT, execute.md` above, for the other branch:
  // detection without enforcement passes every other check here and is exactly
  // the outcome RSK-02 exists to prevent.
  const parallel = doc('cadence-core', 'references', 'execute-parallel.md');
  assert.match(parallel, /risk-check status/,
    'the parallel path never calls risk-check status before reporting a plan done');
  assert.match(parallel, /not reported done while that call refuses/i,
    'the parallel path calls risk-check status without withholding done on its refusal - '
    + 'detection without enforcement is the outcome RSK-02 exists to prevent');
});

test('PAR-01: both parallel risk-check calls name that plan\'s OWN merge range', () => {
  // The two checks above assert only that the command NAMES are there, and a
  // range identity is what the fire is actually about: a plan fired on
  // `{PHASE_START, HEAD}` or on the pre-plan HEAD hands its blocking gate every
  // other plan's work, and a `status` call missing the triple falls through to
  // the phase-wide arm, which compares no range and clears this plan on the
  // record an earlier, narrower one left.
  const parallel = doc('cadence-core', 'references', 'execute-parallel.md');
  /** @type {string[]} */
  const pairs = [];
  for (const sub of ['run', 'status']) {
    // The invocation is one inline code span, so the span's own backtick bounds
    // the flags read here - prose after it is never scanned as an argument.
    const m = new RegExp('risk-check ' + sub + '([^`\\n]*)').exec(parallel);
    assert.ok(m, `references/execute-parallel.md carries no \`risk-check ${sub}\` invocation`);
    for (const flag of ['--phase', '--plan', '--base', '--head']) {
      assert.ok(m[1].includes(flag),
        `the parallel \`risk-check ${sub}\` call drops ${flag}: the triple is all three or `
        + 'none, and none is the phase-wide arm that compares no range');
    }
    const range = /--base\s+(.*?)\s+--head\s+(\S.*)$/.exec(m[1]);
    assert.ok(range, `the parallel \`risk-check ${sub}\` call names no --base/--head pair`);
    const pair = `${range[1]} .. ${range[2]}`;
    assert.doesNotMatch(pair, /PHASE_START|pre-plan/i,
      `the parallel \`risk-check ${sub}\` range is ${pair}, which contains other plans' work`);
    assert.match(pair, /pre-merge[\s\S]+post-merge/,
      `the parallel \`risk-check ${sub}\` range is ${pair}, not the pre-merge/post-merge HEAD pair`);
    assert.match(pair, /step 3/,
      `the parallel \`risk-check ${sub}\` range does not say where both its ends were recorded`);
    pairs.push(pair);
  }
  assert.equal(pairs[0], pairs[1],
    'the fire and the completion gate name DIFFERENT ranges, so the gate can clear on a '
    + 'record for a range nobody fired on');
});

// --- GAT-04: the receipt a coordinator COPIES joins on the key status uses ---
//
// Watched FAILING at dd3920e, where three of the four fenced `trace append`
// blocks - `gate_pass`, `override` and `rearm` in
// cadence-core/references/triage-gate.md - carried no `--plan <k>`, against
// cadence-core/references/review-record.md's `adjudication`, which did (it sat
// in review-triggers.md step 5 until the LOD-06 cold split).
// `risk-check status` joins a receipt to a record on `rowKey(corr, plan)`, so
// a receipt appended exactly as those blocks read keys to no plan and settles
// nothing: the range stays `unfired` and the blocking gate cannot be cleared
// by following its own instructions.
//
// The rule was already stated in prose at triage-gate.md's receipt paragraph.
// This file's whole premise is that prose copying a machine-readable fact must
// still match it, and a prose RULE beside a command that disobeys it is that
// drift in its purest form - the copied line is what a coordinator runs.
//
// Nothing else pinned it: risk-diff.test.mjs's `receiptLine` helper builds its
// fixtures with a plan every time, so the seam's own tests are handed what
// these documents omit.

test('GAT-04: every fenced outcome receipt names its trigger, plan and both range ends', () => {
  const files = [
    ['cadence-core', 'references', 'triage-gate.md'],
    // The `adjudication` receipt cold-split out of `review-triggers.md` step 5
    // in LOD-06 and the row travels with the command, the way BRACKETING's
    // rows in trace.test.mjs do.
    ['cadence-core', 'references', 'review-record.md'],
  ];
  /** @type {string[]} */
  const seen = [];
  for (const parts of files) {
    const text = doc(...parts);
    const where = parts.slice(1).join('/');
    for (const line of text.split('\n')) {
      // The command LINE, not the prose: only a fenced invocation is a thing a
      // coordinator copies and runs. Prose that names one of these flags while
      // discussing it is never scanned as an argument list.
      if (!line.includes('trace append') || !line.includes('--family outcome')) continue;
      const event = /--event\s+(\S+)/.exec(line);
      assert.ok(event, `${where}: an outcome receipt command names no --event`);
      seen.push(event[1]);
      for (const flag of ['--trigger', '--plan', '--base', '--sha']) {
        assert.ok(line.includes(flag),
          `${where}: the \`${event[1]}\` receipt drops ${flag} - risk-check status joins a `
          + 'receipt on the run, the plan and BOTH ends of the range, so a receipt written as '
          + 'this line reads settles nothing and leaves a fired range reading as unfired');
      }
    }
  }
  // All five settle points, so a receipt block DELETED fails here too rather
  // than passing vacuously: adjudication (review-record.md) plus the four
  // in triage-gate.md - `gate_pass`, `override`, `rearm` and the `deferred`
  // arm's `deferral`, which settles by QUEUING rather than by ruling and needs
  // the same joinable receipt to keep `risk-check status` from reading its
  // range as unfired forever.
  assert.deepEqual(seen.sort(), ['adjudication', 'deferral', 'gate_pass', 'override', 'rearm'],
    'the five settle points no longer print one fenced receipt command each');
});

// --- RSK-07: what `survived` MEANS, stated the same way on all four surfaces -
//
// Watched FAILING as GH-159, on a real run rather than on a read. A blocking
// `plan` gate PASSED, its below-blocker/high remainder was reported and moved
// past, and the settle could not write its adjudication record at all: the
// coordinator composed the payload by following
// cadence-core/references/review-record.md, whose sentence read "a `survived`
// one names the fix commit" with no severity on it, and
// cadence-core/bin/lib/adjudication-record.mjs refused every entry that named
// none. The two ways out were both false statements - downgrade the finding, or
// invent a SHA - so the fire could not be settled without recording something
// that did not happen.
//
// The fix widened `survived` to mean "the finding STOOD, fixed or not", gated
// on the RAISED severity, and that meaning now lives on four surfaces: the
// module that WRITES the record, the module that decides what the fire will not
// fix, the reference a coordinator reads at the gate, and the reference it
// reads when composing the payload. Any one of them drifting back to the
// unconditional rule reproduces the defect at the step it was reported from,
// and the drift is silent: every test in the tree still passes, because the
// code is right and the instruction a human follows is wrong.
//
// Nothing else pins it. self-verify.mjs:927 records a standing decision against
// text scans over this reference family, and check 14 does not reach
// lib/adjudication-record.mjs at all - it takes no CONTRACTS row and no CLI
// entry point.

/** The four surfaces that state what `survived` means, and the phrase they
 * state it with. One NAMED fact, never a document's shape: a reformat that
 * changed no fact leaves this row green. */
const SURVIVED_SURFACES = [
  ['cadence-core', 'bin', 'lib', 'adjudication-record.mjs'],
  ['cadence-core', 'bin', 'lib', 'filing-decision.mjs'],
  ['cadence-core', 'references', 'triage-gate.md'],
  ['cadence-core', 'references', 'review-record.md'],
];
const SURVIVED_MEANING = 'confirmed and not fixed';

test('RSK-07: all four surfaces state the SEVERITY-GATED meaning of `survived`', () => {
  for (const parts of SURVIVED_SURFACES) {
    const where = parts.slice(1).join('/');
    // Collapsed BEFORE matching, so a wrapped comment line and a single-line
    // sentence read the same and rewrapping a paragraph is not a failure.
    const flat = doc(...parts).replace(/\s+/g, ' ');

    assert.ok(flat.toLowerCase().includes(SURVIVED_MEANING),
      `${where} no longer says a survived finding below blocker/high was "${SURVIVED_MEANING}". `
      + 'That is the half of `survived` the record can store and the coordinator has to know '
      + `about, and the four surfaces agree on this phrase rather than on a sentiment - so edit `
      + `${where} back into agreement rather than editing this row`);

    // And none of them may state the UNCONDITIONAL rule again: a `survived`
    // finding that names a fix commit with no severity qualifying it is the
    // exact sentence GH-159 was reported against.
    for (const m of flat.matchAll(/`?survived`?[^.]{0,160}?names? (?:the|its|a) fix commit/gi)) {
      assert.match(m[0], /blocker/i,
        `${where} states that a survived finding names its fix commit without saying at WHICH `
        + `severities: "${m[0]}". Followed literally that instruction makes a coordinator `
        + 'fabricate a SHA or downgrade the finding, which is GH-159 reproduced');
    }
  }
});

// --- MSR-01: the close-half turn rule is stated ONCE, in the spawn seam ------
//
// `--turns` is dead the moment its ONE statement stops naming it: nothing in
// the tree can make a coordinator read a tool-call count off a subagent return
// except this paragraph, and the checks that exist around it are all blind to
// its content. self-verify's flag lint only refuses a flag the CONTRACTS row
// does not list, the weight budget only counts bytes, and the producer census
// in trace.test.mjs reads the ten CLOSE COMMAND lines rather than the rule they
// point at - so deleting the rule while leaving the flags in place is green
// everywhere else. Read by its NAMED anchor (the paragraph's bolded opening),
// never by the shape of the sentences around it, so a rewrap that changed no
// fact stays green.

test('MSR-01: the spawn seam\'s close-half rule states the turn count, its omission and its own counter', () => {
  const text = doc('cadence-core', 'references', 'seam-spawn-agent.md');
  const start = text.indexOf('**The bracket rides the resolve.**');
  assert.ok(start >= 0, 'seam-spawn-agent.md has no `The bracket rides the resolve.` paragraph');
  // To the end of the paragraph: the ONE statement is a single block, and a
  // rule that drifted into a paragraph of its own is exactly what this refuses.
  const end = text.indexOf('\n\n', start);
  assert.ok(end > start, 'the bracket paragraph never ends');
  const para = text.slice(start, end).replace(/\s+/g, ' ');

  // 1. The count is CARRIED, with the same provenance `--tokens` has.
  assert.match(para, /`--turns <the tool-call count on that same return>`/,
    'the close-half rule no longer tells a caller to carry the tool-call count');
  // 2. ...and OMITTED when the return carries none, never sent as zero.
  assert.match(para, /OMIT `--turns`[\s\S]*?never `--turns 0`/,
    'the close-half rule no longer states that an absent turn count is omitted rather than 0');
  // 3. ...and a turn-figureless return renders under a counter of its OWN.
  assert.match(para, /`turns_unrecorded`, distinct from the token `unrecorded`/,
    'the close-half rule no longer states that turns have an unrecorded counter of their own');

  // ...and it is still ONE statement. A second paragraph restating any of the
  // three is how a rule starts disagreeing with itself across two sites.
  assert.equal((text.match(/ONE statement/g) || []).length, 1,
    'seam-spawn-agent.md now holds more than one `ONE statement` marker - the rule was copied, not extended');
});

// --- MSR-02: the report's spend line and the seam make ONE claim ------------
//
// WATCHED FAILING AT 4b1d659, the tip of this plan's unpatched tree. Observed
// there, with this file copied into that checkout's `cadence-core/bin/`:
//
//   $ node --test cadence-core/bin/prose-agreement.test.mjs
//   x MSR-02: report.md names the seam's three excluded sources where it prints the spend figure
//     AssertionError [ERR_ASSERTION]: report.md's spend line does not name `the
//     orchestrator's own turns`, so it presents a worker-return token sum as the
//     run's cost. Got: Tokens on subagent returns (the host's own per-dispatch
//     figure, not a measured cost): <total recorded; top role and its share;
//     unrecorded dispatch count>
//   i pass 25
//   i fail 1
//
// The recipe uses the GUARDED-READ arm below rather than copying this phase's
// `lib/trace-suggest.mjs` into the old checkout, and it has to: the export is
// absent there, a named import would die at module link, and the recorded FAIL
// would then prove only that a new helper does not exist yet. With the guard,
// the old tree reaches the assertion and fails on the CLAIM - the exact
// sentence unpatched `/cad-report` composes.
//
// To re-watch: `git worktree add --detach <tmp> 4b1d659`, copy this file into
// `<tmp>/cadence-core/bin/`, run `node --test cadence-core/bin/prose-agreement.test.mjs`
// from `<tmp>`, then `git worktree remove <tmp>`.
//
// This is the half of MSR-02 that lives in prose nothing executes.
// `workflows/report.md` has no executor at all - moving the caveat into the
// seam envelope was rejected for exactly that reason, because the file would
// still be relaying a sentence no check reads. So the sentence is read here,
// and the three names are IMPORTED from `lib/trace-suggest.mjs` rather than
// restated: the subject of this check is that the seam and the prose claim the
// same thing, and a literal copy in this file would assert nothing about
// agreement - it would go green on the day the two lists diverged.
//
// The import is a NAMESPACE import for the same reason the seam-half check
// uses one: a named import would die at module link against an unpatched
// checkout, and a FAIL that only proves a new export does not exist yet says
// nothing about whether unpatched `/cad-report` makes the wrong cost claim.
//
// Both sites are asserted by their NAMED anchors - the shape block's spend line
// and the `What that token line EXCLUDES` rule - never by the shape of the
// sentences around them, so a rewrap that changed no fact stays green.
import * as traceSuggestModule from './lib/trace-suggest.mjs';

const REPORT_EXCLUDES = Array.isArray(traceSuggestModule.SPEND_EXCLUDES)
  ? traceSuggestModule.SPEND_EXCLUDES
  : ["the orchestrator's own turns", 'cross-model provider calls', 'figureless returns'];

test('MSR-02: report.md names the seam\'s three excluded sources where it prints the spend figure', () => {
  const text = doc('cadence-core', 'workflows', 'report.md');
  assert.equal(REPORT_EXCLUDES.length, 3,
    'the exported exclusion list is no longer the three sources the caveat is written about');

  // 1. The shape block's own spend line - the point at which the figure is
  //    PRINTED. A caveat further down the file is a caveat a reader can compose
  //    the line without.
  const lineStart = text.indexOf('Tokens on subagent returns (');
  assert.ok(lineStart >= 0, 'report.md has no `Tokens on subagent returns (` line');
  const spendLine = text.slice(lineStart, text.indexOf('\n', lineStart));
  for (const name of REPORT_EXCLUDES) {
    assert.ok(spendLine.includes(name),
      `report.md's spend line does not name \`${name}\`, so it presents a `
      + `worker-return token sum as the run's cost. Got: ${spendLine}`);
  }

  // 2. The rule that states them, read from its named anchor to the next
  //    top-level bullet.
  const ruleStart = text.indexOf('- What that token line EXCLUDES');
  assert.ok(ruleStart >= 0, 'report.md has no `What that token line EXCLUDES` rule');
  const next = text.indexOf('\n- ', ruleStart + 1);
  const rule = text.slice(ruleStart, next > ruleStart ? next : text.length);
  for (const name of REPORT_EXCLUDES) {
    assert.ok(rule.includes(name),
      `report.md's EXCLUDES rule does not name \`${name}\` - the prose and the `
      + 'seam are claiming different things about one figure');
  }
});

// --- TRN-02: the bulk-output rule, stated once, and the sites that obey it ---
//
// WATCHED FAILING AT 86cd45d, the tip of this plan's unpatched tree. Observed
// there, with this file copied into that checkout's `cadence-core/bin/`:
//
//   $ node --test --test-name-pattern='TRN-02' \
//       cadence-core/bin/prose-agreement.test.mjs
//   x TRN-02: the bulk-output rule is stated once, and every converted site
//     performs it
//     AssertionError [ERR_ASSERTION]: references/conventions.md states no
//     bulk-output rule - the distinctive clause the rule is written with is
//     absent from it, so no converted site has a rule to cite
//       actual: false,
//       expected: true,
//       operator: '==',
//   i pass 0
//   i fail 1
//
// and `node --test cadence-core/bin/prose-agreement.test.mjs` exits 1 there.
//
// Which is the defect exactly: the rule had no home, so no site could cite one
// and all three read the whole render into the transcript. It stops at that
// first assertion because on that tree the later facts do not exist to extract
// either - no statement names a transport, no file carries the clause, and none
// of the three surfaces prescribes its call with a redirect.
//
// Nothing THIS plan added is imported - the register and the rule module live
// in `lib/bulk-output.mjs` and this test never touches them, reading the
// SHIPPED prose bytes instead - so against the unpatched tree it fails on an
// ASSERTION rather than on a module that does not exist yet.
//
// The subject is AGREEMENT, not the presence of a phrase. The transport the
// statement itself prescribes is extracted OUT of the statement, and each
// converted surface's own `trace render` invocation line is then matched
// against that extracted form: the rule and the sites cannot end up describing
// different transports, and a test that only asserted "some expected phrase
// appears somewhere" would go green on the day they diverged.
//
// To re-watch: `git worktree add --detach <tmp> 86cd45d`, copy this file into
// `<tmp>/cadence-core/bin/`, run `node --test cadence-core/bin/prose-agreement.test.mjs`
// from `<tmp>`, then `git worktree remove <tmp>`.

/**
 * The one distinctive clause the bulk-output rule is stated with, ASSEMBLED
 * from its two halves rather than written out. This test asserts that exactly
 * one file under `cadence-core/` carries that clause, and a literal here would
 * be the second - the check would then be reporting on itself. Joining the
 * halves is what keeps `grep -rn` over the tree a true statement of the rule's
 * single home, and it is why the presence assertion below carries its own
 * message rather than `sentenceAround`'s, which echoes the needle it looked for.
 */
const BULK_CLAUSE = ['rides a file', 'not the transcript'].join(', ');

/** Every file under `dir`, recursively, as absolute paths. */
function everyFileUnder(dir) {
  const out = [];
  for (const d of readdirSync(dir, { withFileTypes: true })) {
    const f = join(dir, d.name);
    if (d.isDirectory()) out.push(...everyFileUnder(f));
    else if (d.isFile()) out.push(f);
  }
  return out;
}

test('TRN-02: the bulk-output rule is stated once, and every converted site performs it', () => {
  // 1. The statement, read out of the ONE file allowed to carry it.
  const conventions = doc('cadence-core', 'references', 'conventions.md');
  assert.ok(conventions.includes(BULK_CLAUSE),
    'references/conventions.md states no bulk-output rule - the distinctive clause '
    + 'the rule is written with is absent from it, so no converted site has a rule to cite');
  const stated = sentenceAround(conventions, BULK_CLAUSE, 'references/conventions.md');

  // 2. The transport that statement prescribes, EXTRACTED from the statement
  //    rather than restated here: the scratch-path prefix comes out of the
  //    rule's own bytes and is then what every converted site is required to
  //    redirect into, so the rule and the sites cannot describe two different
  //    transports. A literal regex here would be a second copy of the fact.
  const prescribed = stated.match(/>\s*"([^"]+)"/);
  assert.ok(prescribed && prescribed[1].includes('/'),
    'the bulk-output rule states no scratch-file redirect, so it names no transport '
    + `for a converted site to perform. Got: ${stated}`);
  const target = prescribed[1];
  const dir = target.slice(0, target.lastIndexOf('/') + 1);
  const form = new RegExp(`>\\s*"${dir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^"]+"`);

  // 3. It is stated NOWHERE else in the plugin. A second copy is a second rule
  //    the moment either is edited, which is why `lib/bulk-output.mjs` carries
  //    a pointer at this file rather than the words.
  const carriers = everyFileUnder(join(REPO, 'cadence-core'))
    .filter((f) => readFileSync(f, 'utf8').includes(BULK_CLAUSE))
    .map((f) => f.slice(REPO.length + 1).split(sep).join('/'))
    .sort();
  assert.deepEqual(carriers, ['cadence-core/references/conventions.md'],
    'the bulk-output rule is stated in more than one file, or in none');

  // 4. Each converted surface prescribes its `trace render` with that same
  //    transport. The invocation line is found the way the tree's other
  //    censuses find one - a line that also names `planning.mjs` - so a
  //    sentence ABOUT what the render reports is never mistaken for a call.
  for (const surface of [
    ['cadence-core', 'references', 'triage-gate.md'],
    ['cadence-core', 'workflows', 'progress.md'],
    ['cadence-core', 'workflows', 'report.md'],
  ]) {
    const where = surface.join('/');
    const calls = doc(...surface).split('\n')
      .filter((l) => l.includes('planning.mjs') && /\btrace\s+render\b/.test(l));
    assert.equal(calls.length, 1, `${where} prescribes ${calls.length} \`trace render\` calls, not 1`);
    assert.match(calls[0], form,
      `${where} prescribes \`trace render\` with its output riding the transcript, `
      + `not the scratch file the rule states. Got: ${calls[0].trim()}`);
  }
});

// --- PLN-01: the plan-task ceiling's decision, read off both bound surfaces --
//
// WATCHED FAILING AT 617a2a1, the tip of this plan's unpatched tree. Observed
// there, with this file copied into that checkout's `cadence-core/bin/`:
//
//   $ node --test cadence-core/bin/prose-agreement.test.mjs
//   x PLN-01: the max_plan_tasks decision reads the same off the schema and the
//     catalog
//     AssertionError [ERR_ASSERTION]: config.schema.json's workflow.max_plan_tasks
//     purpose carries no landed - it states what the key means and not what its
//     value was decided against, so the ceiling is argued nowhere a check can read
//       actual: null,
//       expected: null,
//       operator: 'notStrictEqual',
//   i pass 28
//   i fail 1
//
// and `node --test cadence-core/bin/prose-agreement.test.mjs` exits 1 there.
//
// To re-watch: `git worktree add --detach <tmp> 617a2a1`, copy this file into
// `<tmp>/cadence-core/bin/`, run `node --test cadence-core/bin/prose-agreement.test.mjs`
// from `<tmp>`, then `git worktree remove <tmp>`.
//
// The defect this fails on: `workflow.max_plan_tasks` stated its MEANING on
// both surfaces and its DECISION on neither, so the one number a phase's whole
// plan count hangs off was argued nowhere a check reads. A phase SUMMARY is not
// that place - `milestone-prune` removes it at the close.
//
// The subject is AGREEMENT, never presence. Each figure is EXTRACTED out of the
// surface's own bytes and compared to the other surface's extraction, so a test
// that went green on "some expected phrase appears in each" - and would stay
// green on the day the two surfaces started stating different numbers - is not
// what is written here. The extractions are deliberately three, because three
// is what the decision is made of: what an extra plan costs cold, what the
// record says about plans outrunning a context, and where those two land.
//
// The landed value is then checked against the machine-readable defaults on
// BOTH surfaces, which is the failure mode a prose argument invites: prose that
// argues for 8 beside a `"default": 6` is worse than no prose, because a reader
// believes it.

/**
 * The three figures the `workflow.max_plan_tasks` re-decision is written with,
 * pulled OUT of one surface's own bytes. A field the surface does not carry
 * extracts `null` rather than throwing, so the comparison below can name WHICH
 * of two surfaces is missing a figure instead of dying on the first one.
 */
function ceilingDecision(text) {
  const landed = text.match(/landing on (\d+)/);
  const prefix = text.match(/([\d,]+) bytes/);
  const checkpoints = text.match(/(\d+) executor checkpoints of (\d+)/);
  return {
    landed: landed ? Number(landed[1]) : null,
    prefixBytes: prefix ? prefix[1] : null,
    execCheckpoints: checkpoints ? Number(checkpoints[1]) : null,
    allCheckpoints: checkpoints ? Number(checkpoints[2]) : null,
  };
}

test('PLN-01: the max_plan_tasks decision reads the same off the schema and the catalog', () => {
  const key = JSON.parse(doc('cadence-core', 'config.schema.json'))
    .keys['workflow.max_plan_tasks'];
  assert.ok(key, 'config.schema.json defines no workflow.max_plan_tasks');
  const schema = ceilingDecision(String(key.purpose));
  const row = tableRow(
    doc('cadence-core', 'references', 'config-catalog.md'), 'workflow.max_plan_tasks');
  const catalog = ceilingDecision(row[2]);

  // 1. The schema states the whole decision, not part of it.
  for (const [field, value] of Object.entries(schema)) {
    assert.notEqual(value, null,
      `config.schema.json's workflow.max_plan_tasks purpose carries no ${field} - `
      + 'it states what the key means and not what its value was decided against, '
      + 'so the ceiling is argued nowhere a check can read');
  }

  // 2. The catalog row states the SAME decision. Compared as extractions, so a
  //    figure changed on one surface and not the other is what fails, and the
  //    message carries both sides rather than the phrase that was looked for.
  assert.deepEqual(catalog, schema,
    'config-catalog.md and config.schema.json extract different max_plan_tasks '
    + 'decisions - one of the two surfaces was edited alone, so a reader gets a '
    + 'different argument depending on which one they opened');

  // 3. And the value the prose argues is the value the machine reads, on both
  //    surfaces. Prose arguing for one number beside a default holding another
  //    is worse than no prose: it is believed.
  assert.equal(schema.landed, key.default,
    `the schema purpose argues for ${schema.landed} and its own default is ${key.default}`);
  assert.equal(schema.landed, Number(row[4]),
    `the decision lands on ${schema.landed} and config-catalog.md's Default column says ${row[4]}`);
});

// --- SGT-01: the suggest seam's unset-layer defaults, against the schema -----
//
// `planning/trace.mjs`'s `SUGGEST_KEY_DEFAULTS` is what `/cad-suggest` prints as a
// key's `current` when no config layer holds one, and it is a hand-copied
// mirror of `config.schema.json` by decision (D-15: the schema is not parsed at
// runtime, the duplication `DISPATCH_WINDOW_DEFAULTS` and `route.mjs`'s
// `DEFAULTS` already accept). Copied numbers drift, and this drift is silent at
// the worst possible place: the user reads a `current` off `/cad-suggest`, sets
// a value against it, and `/cad-config` shows a different row.
//
// The subject is AGREEMENT, never presence: both sides are EXTRACTED - one out
// of the trace command module's own source bytes, one out of the schema's `default`
// fields - and compared, the same shape the PLN-01 arm above uses. Scoped to
// the keys the literal carries; `DISPATCH_WINDOW_DEFAULTS` is a separate map
// with its own row set and is not widened onto here.

/**
 * The `SUGGEST_KEY_DEFAULTS` literal, read out of a source file's bytes as
 * key -> value. A line the grammar does not fit is SKIPPED rather than guessed
 * at, so the comparison below fails on a missing key by name.
 */
function suggestKeyDefaults(text) {
  const block = text.match(/const SUGGEST_KEY_DEFAULTS = Object\.freeze\(\{\n([\s\S]*?)\n\}\);/);
  assert.ok(block, 'planning/trace.mjs carries no SUGGEST_KEY_DEFAULTS literal to compare');
  /** @type {Record<string, any>} */
  const out = {};
  for (const line of block[1].split('\n')) {
    const m = /^\s*'([\w.]+)':\s*(.+?),\s*$/.exec(line);
    if (m) out[m[1]] = JSON.parse(m[2].replace(/'/g, '"'));
  }
  return out;
}

test("SGT-01: the suggest seam's unset-layer defaults are config.schema.json's own", () => {
  // The literal is single-use for the `suggest` arm, so phase 4 moved it into the
  // trace command module with the handler that reads it. The extraction follows
  // the bytes: it still parses the literal out of source and still deep-equals it
  // against config.schema.json's own `default` fields, key by key.
  const literal = suggestKeyDefaults(doc('cadence-core', 'bin', 'planning', 'trace.mjs'));
  assert.ok(Object.keys(literal).length >= 2,
    `SUGGEST_KEY_DEFAULTS extracted ${Object.keys(literal).length} keys - the literal's `
    + 'shape moved out from under this extraction, so it is checking nothing');
  const keys = JSON.parse(doc('cadence-core', 'config.schema.json')).keys;
  /** @type {Record<string, any>} */
  const schema = {};
  for (const k of Object.keys(literal)) {
    assert.ok(keys[k], `SUGGEST_KEY_DEFAULTS names ${k}, which config.schema.json does not define`);
    schema[k] = keys[k].default;
  }
  assert.deepEqual(literal, schema,
    "planning/trace.mjs's SUGGEST_KEY_DEFAULTS and config.schema.json's defaults disagree - one "
    + 'was edited alone, so /cad-suggest prints a `current` for an unset key that the row '
    + '/cad-config shows contradicts');
});


// --- REL-01: the tag flag is read at one site, and its words name that site --
//
// WATCHED FAILING AT c78cbdb, the tip of this plan's unpatched tree. Observed
// there, with this file copied into that checkout's `cadence-core/bin/`:
//
//   $ node --test --test-name-pattern='REL-01' \
//       cadence-core/bin/prose-agreement.test.mjs
//   x REL-01: git.create_tag is read at one prose site, and its purpose names
//     that site
//     AssertionError [ERR_ASSERTION]: git.create_tag is read at 2 prose sites:
//     cadence-core/workflows/milestone.md, skills/cad-land/SKILL.md - the key
//     governs the tag /cad-land cuts after the merge, so every other reader is
//     a step deciding something else by it
//   i pass 0
//   i fail 1
//
// and `node --test cadence-core/bin/prose-agreement.test.mjs` exits 1 there.
//
// Which is the defect exactly: `workflows/milestone.md` step 2 read the key as
// the release-mode discriminator for a whole step, so setting it false skipped
// the manifest bump - work the key never claimed to govern - while the schema
// `purpose` said "Tag on milestone" over a tag that is cut at land, after the
// merge confirms. Both halves are false on that tree: the second assertion's
// `land` is absent from those three words and its `milestone` is all of them.
//
// The subject is AGREEMENT, never presence. The command the purpose has to name
// is DERIVED from the one site found in step 1 - `skills/cad-land/SKILL.md` ->
// `cad-land` -> `land` - so the documented words and the actual reader cannot
// end up naming two different moments, and a literal `land` written into this
// test would be a second copy of the fact rather than a check on it.
//
// Scoped to the prose READ sites, `cadence-core/workflows/` and `skills/`, and
// deliberately NOT to `config.schema.json`, `references/config-catalog.md` or
// `references/config-reach.md`: those three name every key by definition, so a
// count that included them would be red forever for the wrong reason.
//
// To re-watch: `git worktree add --detach <tmp> c78cbdb`, copy this file into
// `<tmp>/cadence-core/bin/`, run `node --test cadence-core/bin/prose-agreement.test.mjs`
// from `<tmp>`, then `git worktree remove <tmp>`.

/** A repo-relative, forward-slashed path for an absolute one under REPO. */
const repoPath = (abs) => abs.slice(REPO.length + 1).split(sep).join('/');

test('REL-01: git.create_tag is read at one prose site, and its purpose names that site', () => {
  // 1. The prose surfaces that READ the key, found rather than listed.
  const sites = [];
  for (const dir of ['cadence-core/workflows', 'skills']) {
    for (const f of everyFileUnder(join(REPO, ...dir.split('/')))) {
      if (f.endsWith('.md') && readFileSync(f, 'utf8').includes('git.create_tag')) {
        sites.push(repoPath(f));
      }
    }
  }
  sites.sort();
  assert.deepEqual(sites, ['skills/cad-land/SKILL.md'],
    `git.create_tag is read at ${sites.length} prose sites: ${sites.join(', ')} - the key `
    + 'governs the tag /cad-land cuts after the merge, so every other reader is a step '
    + 'deciding something else by it');

  // 2. The schema `purpose` names THAT site's command, and no other moment.
  //    Both sides are extracted: the command comes out of the path found above,
  //    the words out of the schema's own bytes.
  const command = dirname(join(REPO, ...sites[0].split('/'))).split(sep).pop();
  const moment = String(command).replace(/^cad-/, '');
  const key = JSON.parse(doc('cadence-core', 'config.schema.json')).keys['git.create_tag'];
  assert.ok(key, 'config.schema.json defines no git.create_tag');
  const purpose = String(key.purpose);
  assert.match(purpose, new RegExp(`\\b${moment}\\b`, 'i'),
    `${sites[0]} is the one site that reads git.create_tag, and its schema purpose - `
    + `"${purpose}" - never names ${moment}, so the key documents a moment nothing reads it at`);
  assert.doesNotMatch(purpose, /milestone/i,
    `git.create_tag's schema purpose - "${purpose}" - still names the milestone close, `
    + `which stopped reading the key: the cut is ${moment}'s, on the pulled base after the `
    + 'merge confirms');
});

// --- AC6: /cad-report's Gates line is rendered, not narrated ------------------
//
// The three clauses AC6 asks for live in ONE workflow file and nothing else can
// hold them: the Gates line is prose the model executes, so a revert of any
// clause is invisible to every other check here - self-verify's flag lint sees
// no flag, the weight budget sees only bytes, and no seam is invoked by the
// line at all. The Refuted clause is pinned in the same test because the
// decision that made this edit safe was that the two lines have different
// sources (D-10): gate findings for one, SUMMARY deviations that corrected a
// D-NN for the other, and folding the record into the second is the edit this
// row exists to catch.
//
// Read by NAMED ANCHOR - each line's own `Gates:` / `Refuted:` opening and the
// rules bullet's own subject - never by the shape of the sentences around it,
// so a rewrap that changed no fact stays green.

test('AC6: report.md renders its Gates line from the record, states the unrecorded arm, and leaves Refuted on SUMMARY', () => {
  const text = doc('cadence-core', 'workflows', 'report.md');
  const where = 'cadence-core/workflows/report.md';
  const line = (label) => {
    const found = text.split('\n').find((l) => l.startsWith(`${label}:`));
    assert.ok(found, `${where}: the composed shape no longer carries a ${label} line`);
    return found;
  };

  // 1. THE RECORD IS AN ARTIFACT THE STEP OPENS. The `REVIEW-*.md` glob beside
  //    it cannot match a `.json` sibling, so without this entry the Gates line
  //    below asks for a file the step never opened.
  assert.match(text, /\.planning\/phases\/<N>\/ADJUDICATION-\*\.json/,
    `${where}: read_record's scoped-artifact list no longer opens the adjudication record`);

  // 2. THE GATES LINE COUNTS, and compares against the event's own figures.
  const gates = line('Gates');
  assert.match(gates, /ADJUDICATION/,
    `${where}: the Gates line no longer names the record: ${gates}`);
  assert.match(gates, /COUNTED/,
    `${where}: the Gates line stopped saying the rulings are COUNTED, so it is back to `
    + `narrating a figure nothing recomputes: ${gates}`);
  for (const flag of ['survivors', 'downgraded', 'refuted']) {
    assert.ok(gates.includes(flag),
      `${where}: the Gates line no longer compares the count against the event's ${flag}: ${gates}`);
  }

  // 3. THE UNRECORDED ARM, which is what stops a phase predating the format
  //    being synthesized into a record it never had.
  assert.match(gates, /unrecorded/,
    `${where}: the Gates line no longer reads a fire with no record as unrecorded: ${gates}`);
  const rule = sentenceAround(text, 'A fire with NO record', where);
  assert.match(rule, /unrecorded/, `${where}: ${rule}`);
  assert.match(sentenceAround(text, 'Synthesize no entry', where), /recomputed|recompute/,
    `${where}: the no-synthesis rule stopped saying a count that cannot be recomputed is not `
    + 'narrated, which is the whole of what "unrecorded" buys');

  // 4. A DISAGREEMENT IS NAMED. Silently preferring one side would launder the
  //    exact defect the two-artifact comparison exists to surface.
  assert.match(sentenceAround(text, 'DISAGREEMENT', where), /NAMED/,
    `${where}: a record disagreeing with its trace event is no longer NAMED`);

  // 5. THE REFUTED LINE IS UNTOUCHED, and still sourced from SUMMARY.
  const refuted = line('Refuted');
  assert.match(refuted, /SUMMARY deviations/,
    `${where}: the Refuted line stopped reading SUMMARY deviations: ${refuted}`);
  assert.match(refuted, /D-NN/,
    `${where}: the Refuted line stopped naming the decision a deviation corrected: ${refuted}`);
  assert.doesNotMatch(refuted, /ADJUDICATION|survivors/,
    `${where}: the Refuted line acquired gate findings - it consumes SUMMARY deviations that `
    + `corrected a D-NN and nothing else (D-10): ${refuted}`);
});

// --- IVW-01: what `recommended` CONTAINS, read off the prose and off the lib --
//
// CST-02 above verifies the category LIST across three surfaces, and has never
// once verified what the scan RECOMMENDS out of that list. That is the gap
// #206 lived in: `scanTree` returned all eight while review-triggers.md still
// described a recommendation narrowed to the evidenced categories, and the
// disagreement survived a release because no check read the recommendation at
// all. This reads it, on BOTH scan arms, because the collapse is the fact -
// an inconclusive tree and one evidencing a category recommend the SAME set,
// and only the reason the option states beside it differs.
//
// The figure is read as a WORD, which is how that section spells it. Nothing
// here parses the section's bullet or table shape: self-verify.mjs:927 records
// a standing decision that this surface has no stated grammar, so a shape check
// would redden on a reformat that changed no fact.

/**
 * Assert one prose section and one set of scan arms state the same
 * `recommended`. A function OVER its inputs, not a straight-line body, so the
 * test can re-run it against doctored ones and prove it fails from either side
 * - a one-sided assertion is exactly how this drifted for a release.
 *
 * @param {string} section - the `## risk_surface detection` section's text.
 * @param {Record<string, string[]>} arms - `recommended`, keyed by scan arm.
 */
function pinRecommended(section, arms) {
  const where = 'risk-surface.md `## risk_surface detection`';
  // Flattened first: the sentence wraps, and a regex over raw lines would read
  // a rewrap as a deleted claim.
  const stated = flat(section).match(/`recommended` array, which is all (\w+) categories/);
  assert.ok(stated,
    `${where}: no sentence states what the recommended array contains`);
  const count = countWord(stated[1], where);

  const entries = Object.entries(arms);
  for (const [arm, recommended] of entries) {
    assert.equal(recommended.length, count,
      `${where} says the recommendation is all ${count} categories; the ${arm} scan `
      + `recommends ${recommended.length}: [${recommended}]`);
  }
  const [firstArm, firstSet] = entries[0];
  for (const [arm, recommended] of entries.slice(1)) {
    assert.deepEqual(recommended, firstSet,
      `the ${arm} scan recommends [${recommended}] and the ${firstArm} scan [${firstSet}] - `
      + 'the two arms differ by more than the reason, so the recommendation narrowed on '
      + 'evidence (D-14)');
  }
}

test('IVW-01: the prose and scanTree state one `recommended`, and only the reason moves', () => {
  const section = doc('cadence-core', 'references', 'risk-surface.md')
    .split('## risk_surface detection')[1];
  assert.ok(section, 'risk-surface.md has no risk_surface detection section');

  const blind = scanTree({});
  const seeing = scanTree({ dependencies: ['stripe'] });
  assert.equal(blind.inconclusive, true, 'scanTree({}) is no longer the inconclusive arm');
  assert.equal(seeing.inconclusive, false,
    'a stripe dependency no longer evidences a category, so this is not the evidenced arm');

  const arms = { inconclusive: blind.recommended, evidenced: seeing.recommended };
  pinRecommended(section, arms);

  // The same sentence claims the FIRST option carries that array, which is the
  // half a count comparison cannot see: an option builder that leads with a
  // narrower set states a narrower recommendation whatever `recommended` holds.
  for (const [arm, scan] of [['inconclusive', blind], ['evidenced', seeing]]) {
    assert.deepEqual(interviewOptions(scan)[0].surfaces, scan.recommended,
      `${arm}: the first option's set is not the scan's recommended array`);
  }

  // ...and the reason is the ONLY thing that moves between the arms.
  assert.notEqual(interviewOptions(blind)[0].reason, interviewOptions(seeing)[0].reason,
    'both arms state the same reason, so the inconclusive arm stopped saying the structure '
    + 'evidences nothing');

  // Falsified from the PROSE side.
  const doctoredWord = section.replace(/(`recommended` array, which is all\s+)(\w+)(\s+categories)/,
    '$1seven$3');
  assert.notEqual(doctoredWord, section, 'the count word could not be doctored');
  assert.throws(() => pinRecommended(doctoredWord, arms), /says the recommendation is all 7/,
    'a prose count that disagrees with the scan passes this check');

  // ...and from the CODE side, one category short of all eight.
  assert.throws(() => pinRecommended(section, { ...arms, evidenced: arms.evidenced.slice(1) }),
    /the evidenced scan recommends 7/,
    'a recommendation missing a category passes this check');
});

// --- IVW-01: the ask-user rendering contract, at BOTH interview sites ---------
//
// Nothing structural enforces how a model renders a question. The seam states
// three binding rules for a structured choice - the option cap per question,
// the recommended option first and labelled, and that the label is a display
// convention and never a pre-selection - and the two sites that ask the
// risk-surface question restate them, because a workflow that pointed at
// the ask-user seam and stopped would leave the rules a step away at the moment the
// question is put. Restatement is what makes them droppable one site at a
// time, silently, so THIS check is the enforcement.
//
// The cap is read off seam-ask-user.md rather than written here, so raising the seam's
// cap moves both sites' requirement and the builder's ceiling together instead
// of leaving three numbers to drift.

test('IVW-01: both risk-surface interview sites carry the ask-user rules, and the builder holds the cap', () => {
  const section = (text, heading, where) => {
    const after = text.split(heading)[1];
    assert.ok(after, `${where}: no ${heading} section`);
    return after.split(/\n## /)[0];
  };

  const askUser = section(doc('cadence-core', 'references', 'seam-ask-user.md'),
    '## Seam: ask-user', 'references/seam-ask-user.md');

  const CAP = /at most (\w+) options per question/;
  // Flattened: every one of these sentences wraps, and a regex over raw lines
  // would read a rewrap as a deleted rule.
  const capStated = flat(askUser).match(CAP);
  assert.ok(capStated, 'references/seam-ask-user.md `## Seam: ask-user`: no option cap per question');
  const cap = countWord(capStated[1], 'references/seam-ask-user.md `## Seam: ask-user`');

  // Each rule as the CLAIM it makes, never the sentence shape around it: these
  // are three prose surfaces with no stated grammar, and a rewrap that changed
  // no fact must stay green (self-verify.mjs:927).
  const RULES = [
    { id: 'the option cap per question', re: CAP, cap: true },
    { id: 'the recommended option FIRST and labelled `(recommended)`',
      re: /\bfirst\b[^.]*`\(recommended\)`/i },
    { id: 'the clause that the label is a display convention, never a pre-selection',
      re: /never a pre-selection/i },
    { id: 'the clause that the seam still blocks', re: /the seam still blocks/i },
  ];

  const SITES = [
    { where: 'references/seam-ask-user.md `## Seam: ask-user`', text: askUser },
    {
      where: 'references/risk-surface.md `## risk_surface detection`',
      text: section(doc('cadence-core', 'references', 'risk-surface.md'),
        '## risk_surface detection', 'references/risk-surface.md'),
    },
    {
      where: 'workflows/config.md `## Risk surfaces (`--surfaces`)`',
      text: section(doc('cadence-core', 'workflows', 'config.md'),
        '## Risk surfaces', 'workflows/config.md'),
    },
  ];

  for (const site of SITES) {
    const flatText = flat(site.text);
    for (const rule of RULES) {
      const found = flatText.match(rule.re);
      assert.ok(found, `${site.where}: dropped ${rule.id}`);
      if (rule.cap) {
        assert.equal(countWord(found[1], site.where), cap,
          `${site.where} states a cap of ${found[1]} options per question, seam-ask-user.md states ${cap}`);
      }
    }
  }

  // Scoped to the `--surfaces` arm alone, which is why it cannot join RULES
  // above: RULES runs against all three sites, and neither seam-ask-user.md nor
  // risk-surface.md states this. The arm's whole reason for existing is
  // that a project which added Stripe six months after answering has no other
  // way to see it, and nothing else holds the sentence - /code/cadence returns
  // `inconclusive: true` with `evidenced: []`, so the callout cannot fire on
  // the only tree the human check runs against.
  const surfacesSite = SITES.find((s) => s.where.startsWith('workflows/config.md'));
  assert.ok(surfacesSite, 'the `--surfaces` site left the SITES list');
  const surfaces = flat(surfacesSite.text);
  assert.match(surfaces, /call(?:s|ing)? out every evidenced category the answered set does not contain/i,
    'workflows/config.md `## Risk surfaces`: dropped the clause that every evidenced '
    + 'category the answered set does not cover is called out');

  // The code side of the same cap. A site can render at most what the builder
  // hands it, so a candidate list that grew past the cap would break the rule
  // above at a site that obeyed it word for word.
  const ALL_SIGNALS = {
    dependencies: ['express', 'stripe', 'prisma', 'passport'],
    dirs: ['auth', 'migrations', 'api', 'workers'],
    extensions: ['.sql'],
    files: ['openapi.yaml'],
  };
  const CASES = [
    ['an inconclusive scan, nobody answered', scanTree({}), []],
    ['an evidenced scan, nobody answered', scanTree(ALL_SIGNALS), []],
    ['an inconclusive scan, already answered', scanTree({}), ['secrets', 'destructive']],
    ['an evidenced scan, already answered', scanTree(ALL_SIGNALS), ['secrets', 'destructive']],
    ['an evidenced scan, everything already answered', scanTree(ALL_SIGNALS), [...CATEGORIES]],
  ];
  for (const [label, scan, answered] of CASES) {
    const options = interviewOptions(scan, answered);
    assert.ok(options.length >= 1 && options.length <= cap,
      `${label}: the builder returned ${options.length} options against the seam's cap of ${cap}`);
  }
});

// --- Two caps, two different reads, and neither one unified away ------------
//
// `references/triage-gate.md` now states the one-round re-arm cap TWICE, on
// purpose (CONTEXT D-02): the blocking arm counts `rearm` outcome events under
// the current run's `corr`, and the deferred arm reads the highest round on
// disk for the fire. They look like duplication, and the obvious tidy - one
// cap, one read - silently re-opens the loop criterion 6 forbids, because a
// deferred fire's triage runs in a session whose `corr` matches no `rearm` the
// deferring run wrote, so the corr-keyed count reads as unspent every single
// time it is asked.
//
// Nothing else notices. The weight budget counts bytes, self-verify's
// invocation lint reads flags against CONTRACTS rows, and the GAT-04 arm above
// scans only fenced `trace append` lines - the read-back is a `node -e`, so
// deleting it or re-pointing it at the queue is green everywhere. This arm is
// the one place that fails.

test('triage-gate.md: the corr-keyed re-arm read-back survives the deferred arm beside it', () => {
  const text = doc('cadence-core', 'references', 'triage-gate.md');

  // 1. The blocking cap, at the bytes that MAKE it corr-keyed AND plan-keyed:
  //    the filter is quoted whole rather than matched loosely, because every
  //    word in it is load-bearing - the event name, the trigger FIELD (never
  //    its detail text), the run's own id, and the PLAN the fire belongs to.
  //    The plan term is the one the recording append below the block has always
  //    written as `--plan <k>`; without it a `rearm` recorded for plan 1 spends
  //    plan 2's round on the same trigger, so plan 2's fix can never be
  //    reviewed (phase-1 D-04). The `??""` on both sides is what lets an
  //    OMITTED key match the fires that carry no `--plan` at all.
  const corrFilter = 'o.event==="rearm"&&o.trigger===process.argv[2]&&o.corr===r.corr'
    + '&&(o.plan??"")===(process.argv[3]??"")';
  assert.equal(text.split(corrFilter).length - 1, 1,
    'triage-gate.md no longer counts the blocking re-arm under this run\'s own corr '
    + 'AND this plan\'s key. The deferred arm reads its cap off the queue instead; that '
    + 'is a SECOND rule beside this one, never a replacement for it (D-02). Dropping the '
    + 'plan term instead spends every later plan\'s round on plan 1\'s rearm (D-04).');
  // The FENCED BLOCK, not the line: the read-back is `&&`-chained across three
  // physical lines, and the chaining is exactly what makes the count this run's
  // own - a render that failed never reaches the reader.
  const readBack = text.split('```').find((b) => b.includes(corrFilter)) || '';
  assert.match(readBack, /mktemp -d "\$\{TMPDIR:-\/tmp\}\/cad-rearm-XXXXXX"/,
    'the blocking read-back no longer renders into a directory made for this run');
  assert.match(readBack, /trace render --phase <N> > "\$D\/render\.json"/,
    'the blocking read-back no longer chains the render to that directory');

  // 2. The deferred cap, read off its own named anchor so a rewrap that
  //    changed no fact stays green. It runs to the `adjudicated` bullet.
  const anchor = '**The DEFERRED queue is triaged later, and its cap rides the QUEUE.**';
  const start = text.indexOf(anchor);
  assert.ok(start > -1, 'triage-gate.md states no deferred triage arm - a queue nothing '
    + 'says how to clear is a land that never unblocks');
  assert.ok(start > text.indexOf(corrFilter),
    'the deferred arm is stated ABOVE the blocking re-arm it defers to; it says "the '
    + 'blocking re-arm above already states", which is then false');
  const end = text.indexOf('- **adjudicated**', start);
  assert.ok(end > start, 'the deferred triage arm runs past the adjudicated bullet');
  const block = text.slice(start, end).replace(/\s+/g, ' ');

  assert.match(block, /highest round on disk for THAT fire/,
    'the deferred cap no longer says the round count is read off the queue');
  assert.match(block, /never by counting `rearm` outcome events under this run's `corr`/,
    'the deferred cap no longer refuses the corr-keyed count - the one substitution '
    + 'that makes the gate loop forever');
  assert.match(block, /SUPERSEDED/,
    'the deferred cap no longer says a settled round still counts, so a triage that '
    + 'clears round two hands the round back at the moment it spends it');
  assert.match(block, /`deferred record` call above with `--round 2`/,
    'the deferred re-arm no longer records itself as a queue member, so the next '
    + 'session reads the cap off a fire that left no trace of its second round');
  assert.match(block, /surviving round two is the terminal STOP-and-ask, never a round three/,
    'the deferred arm no longer terminates - a cap with no terminal arm is the loop '
    + 'with an extra step');
});

// --- the same read-back, RUN rather than matched (phase-1 D-04) -------------
//
// The arm above quotes the filter byte-for-byte, which is the right test for a
// line that must not silently lose a term - and it is blind to the one failure
// this phase was opened on. The filter was exactly the bytes it had always
// been and it ANSWERED THE WRONG QUESTION: a `rearm` recorded under plan 1 made
// plan 2's cap read SPENT for the same trigger, so plan 2's fix could never be
// reviewed, and every byte-level check in this file stayed green through it.
// Confirmed in production on /code/smithers, whose phase-1 plan-2 `override`
// event states the cause.
//
// So this arm EXECUTES the block the prose carries - the same one line a
// coordinator copies and runs - and asks it about two plans. The record it
// reads is written by the REAL `planning.mjs trace` seam and never by hand: a
// check against a shape the writer never emits proves nothing about the
// writer, which is the rule trace.test.mjs already states for its own
// fixtures. This file is the home because its own premise is prose that copies
// a machine-readable fact, and the copied line here is executable.

test('triage-gate.md: the re-arm read-back, RUN, answers per PLAN and not per corr alone', () => {
  const text = doc('cadence-core', 'references', 'triage-gate.md');
  const corrFilter = 'o.event==="rearm"&&o.trigger===process.argv[2]&&o.corr===r.corr'
    + '&&(o.plan??"")===(process.argv[3]??"")';
  const block = text.split('```').find((b) => b.includes(corrFilter));
  assert.ok(block, 'no fenced block in triage-gate.md carries the blocking re-arm read-back, '
    + 'so the cap the coordinator is told to read has no command behind it');

  // The record, through the seam: a `phase_start` anchor so both events derive
  // ONE `corr`, then a single `rearm` for `risk_surface` under plan 1.
  const cwd = mkdtempSync(join(tmpdir(), 'cad-rearm-run-'));
  mkdirSync(join(cwd, '.planning'), { recursive: true });
  const seam = (...args) => JSON.parse(execFileSync('node',
    [join(HERE, 'planning.mjs'), ...args], { encoding: 'utf8', cwd }));
  assert.equal(seam('trace', 'append', '--phase', '1', '--family', 'lifecycle',
    '--event', 'phase_start', '--sha', 'abc1234').written, true,
  'the fixture anchor was not written, so the two events share no corr');
  assert.equal(seam('trace', 'append', '--phase', '1', '--family', 'outcome',
    '--event', 'rearm', '--trigger', 'risk_surface', '--plan', '1',
    '--detail', 'risk_surface').written, true,
  'the fixture rearm was not written, so both answers below would read 0 for the wrong reason');

  // Only the placeholders a coordinator substitutes are substituted.
  // `${CLAUDE_PLUGIN_ROOT}` stays a shell expansion, answered from the
  // environment, so the block runs as the bytes the file actually carries.
  const ask = (plan) => execFileSync('sh', ['-c', block
    .replace('--phase <N>', '--phase 1')
    .replace('"<trigger>"', '"risk_surface"')
    .replace('"<k>"', `"${plan}"`)],
  { encoding: 'utf8', cwd, env: { ...process.env, CLAUDE_PLUGIN_ROOT: REPO } }).trim();

  assert.equal(ask('1'), '1',
    "the read-back no longer sees plan 1's own rearm, so the one round never reads as SPENT "
    + 'and the blocking gate re-arms without bound - the loop the cap exists to forbid');
  assert.equal(ask('2'), '0',
    "plan 1's rearm is spending plan 2's round on the same trigger. Plan 2's fix dispatch "
    + 'then goes straight to the terminal STOP-and-ask without ever being reviewed, which is '
    + 'this phase\'s own goal clause failing (D-04)');
});


// --- RDX-01: the in-dispatch figure, its coverage and its exclusions, in prose
//
// Modelled on MSR-02 above, which is this repo's one mechanism for pinning a
// workflow's prose to a seam: `workflows/report.md` and `workflows/suggest.md`
// have no executor, so a claim written into them is a claim no check reads
// unless a check like this one reads it.
//
// A WHOLE-FILE grep cannot serve here and is deliberately not used:
// `grep -c coordinator cadence-core/workflows/report.md` already returns 12 on
// the pre-change tree, so a file-wide search passes whether the clause below is
// ever written or not. Both sites are sliced by their NAMED anchors - the shape
// block's Reading line and the reading RULE that follows it, and suggest.md's
// `present` step - so a rewrap that changed no fact stays green while a deleted
// clause reddens.
//
// FALSIFIED IN BOTH DIRECTIONS before it shipped: each asserted clause was
// deleted from its file in turn, this test watched to fail naming that clause,
// and the clause restored and watched to pass. An arm never seen to fail is the
// same unfalsifiable check one layer up.

test('RDX-01: report.md prints the in-dispatch figure with its coverage, its exclusion and the null rule', () => {
  const text = doc('cadence-core', 'workflows', 'report.md');

  // 1. The shape block's Reading LINE - the point at which the figure is
  //    PRINTED. A rule further down is a rule a reader can compose the line
  //    without.
  const lineStart = text.indexOf('Reading (whole `.planning/reads.jsonl`');
  assert.ok(lineStart >= 0, 'report.md has no Reading line');
  const readingLine = text.slice(lineStart, text.indexOf('\n', lineStart));
  for (const token of ['inDispatch.roles', 'inDispatch.coverage', 'inDispatch.coordinatorFiles']) {
    assert.ok(readingLine.includes(token),
      `report.md's Reading line does not print \`${token}\`, so the per-role figure `
      + `either never reaches the report or reaches it without its limits. Got: ${readingLine}`);
  }

  // 2. The rule block, read from its named anchor to the next TOP-LEVEL bullet,
  //    so the sub-bullets under it are inside the slice and the next rule is
  //    not.
  const ruleStart = text.indexOf('- The reading line prices `.planning/reads.jsonl`');
  assert.ok(ruleStart >= 0, 'report.md has no reading-line rule');
  const next = text.indexOf('\n- ', ruleStart + 1);
  // Whitespace-FLATTENED before matching, so a rewrap that changed no fact
  // stays green while a deleted clause reddens - the only distinction this
  // arm exists to make.
  const rule = text.slice(ruleStart, next > ruleStart ? next : text.length).replace(/\s+/g, ' ');

  // The `coordinator` exclusion, and its REASON - the two are separate claims
  // and the reason is the half that stops it reading as an arbitrary filter.
  assert.ok(rule.includes('coordinatorFiles'),
    'the reading rule never names the coordinator reads the figure excluded');
  assert.ok(/no worker bracket by construction/.test(rule),
    'the reading rule states the coordinator exclusion without its reason, so it reads as '
    + 'an arbitrary filter rather than a limit of the measurement');
  // The COVERAGE the ratio was computed over, without which the figure reads as
  // a total over the whole record.
  assert.ok(rule.includes('inDispatch.coverage'),
    'the reading rule never names the coverage the in-dispatch ratio was computed over');
  assert.ok(/denominator the ratio was actually computed over/.test(rule),
    'the reading rule names `coverage` without saying what it is the denominator of');
  // The NULL rule, which is the live case: every record written before the
  // `files` field existed folds to a null ratio.
  assert.ok(/NULL `ratio`/.test(rule),
    'the reading rule has no disposition for a `calls > 0` return with a null in-dispatch ratio');
  assert.ok(/never narrate the null as `0`/.test(rule),
    'the reading rule does not forbid rendering a null ratio as 0 - the reading that says '
    + 'the worker opened each file exactly once');
  // TRC-10: the SPAN claim. The record is cut at its size bound now, so the
  // three figures span the live record rather than the project's whole history,
  // and the composer is told which key says a cut happened on this run.
  assert.equal(rule.includes('span every dispatch the project ever recorded'), false,
    'the reading rule still claims the three figures span every dispatch the project ever '
    + 'recorded - the size-bound cut moves the older generation to a sibling this report '
    + 'never reads');
  assert.ok(rule.includes('still in the LIVE record'),
    'the reading rule does not scope the three figures to the live record');
  assert.ok(/cut at its size bound/.test(rule),
    'the reading rule names nothing that shortens the record, so a composer reading it '
    + 'cannot tell why a figure dropped between two runs');
  assert.ok(rule.includes('`reads.rotated`'),
    'the reading rule points at no key for whether the record was cut on this run');

  // 3. The transport figure the growth of that response invalidated. It is a
  //    MEASUREMENT, so it carries the date it was taken.
  const measured = text.indexOf('`reads --join` measures');
  const transport = measured >= 0 ? text.slice(measured, measured + 120) : '(the sentence is gone)';
  assert.ok(/`reads --join` measures 2,494 B/.test(text),
    `report.md still states a stale \`reads --join\` size. Got: ${transport}`);
});

test('TRC-10: suggest.md\'s scope step names what shortens the reads record', () => {
  // The step reports the SCOPE of both records it read. It said of the reads
  // record only that no close prunes it, which read as "nothing shortens this
  // file" while nothing did - true for four cycles and false the moment the
  // size-bound cut shipped. The close clause stays (a close still prunes
  // nothing); what it can no longer do is stand alone.
  const text = doc('cadence-core', 'workflows', 'suggest.md');
  const scope = stepBody(text, 'scope', 'suggest.md').replace(/\s+/g, ' ');

  assert.ok(scope.includes('nothing prunes it at a close either'),
    'suggest.md no longer carries the reads-record scope sentence this rule corrects');
  // The un-caveated form, verbatim: the close clause running straight into the
  // phase-scoping clause with nothing about the cut between them.
  assert.equal(scope.includes('at a close either, and it carries NO phase scoping'), false,
    'suggest.md\'s scope step still presents the reads record as one nothing ever shortens');
  assert.ok(/one thing that ever shortens it is the same cut at its size bound/.test(scope),
    'suggest.md\'s scope step names no cut, so a user is told the reads figures span a '
    + 'history the record no longer holds');
  assert.ok(scope.includes('`reads.rotated` reports'),
    'suggest.md\'s scope step points at no key for whether the record was cut on this run');
});

test('RDX-01: suggest.md qualifies its no-tweak line to CONFIG KEYS and states the info exception', () => {
  const text = doc('cadence-core', 'workflows', 'suggest.md');
  const present = stepBody(text, 'present', 'suggest.md').replace(/\s+/g, ' ');

  // Heading one's no-tweak line. Without the qualifier, `/cad-suggest` prints
  // "the record supports no tweak in this scope" directly above a receipt
  // reporting a file opened 29 times inside one dispatch.
  assert.ok(present.includes('the record supports no tweak in this scope'),
    'suggest.md no longer carries the no-tweak line this rule qualifies');
  assert.ok(/no CONFIG KEY this record prices/.test(present),
    'suggest.md\'s no-tweak line makes an unqualified claim about the run rather than a '
    + 'claim about config keys, so it contradicts the receipt printed below it');
  assert.ok(/points at the receipts/.test(present),
    'suggest.md\'s no-tweak line does not send the reader to the receipts when one names '
    + 'a remedy that is not a key');

  // Heading two's stated exception to "an `info` asks for nothing".
  assert.ok(present.includes('An `info` asks for nothing'),
    'suggest.md no longer carries the info-asks-for-nothing line this exception attaches to');
  assert.ok(/ONE stated exception/.test(present),
    'suggest.md states no exception, so an in-dispatch receipt reaches the user as a ratio '
    + 'with no remedy beside it');
  assert.ok(/relay the remedy its `evidence` names/.test(present),
    'suggest.md does not tell the composer to relay the remedy the evidence names');
});

// --- REL/D-07: every verdict code the pure core can return reaches both docs -

/**
 * The `code:` string literals inside `decideManifestBump`'s BODY: the
 * EXECUTABLE set, read from the source rather than from either prose list.
 * Deriving it from one list and comparing against the other would pass while
 * both were stale together, which is exactly how `unparseable-version`,
 * `downgrade` and `not-an-upgrade` stayed unnamed in release-bump.mjs's header
 * for two release cycles. helper-census.test.mjs is this tree's precedent for
 * a test that regexes module source.
 */
function verdictCodes(src) {
  const start = src.indexOf('export function decideManifestBump(');
  assert.ok(start >= 0, 'decideManifestBump is no longer declared in lib/release-decision.mjs');
  const end = src.indexOf('\n}\n', start);
  assert.ok(end > start, 'could not find the closing brace of decideManifestBump');
  const body = src.slice(start, end);
  return [...new Set([...body.matchAll(/\bcode: '([a-z][a-z-]*)'/g)].map((m) => m[1]))];
}

/** The run of leading `//` lines of a script, past its shebang: its header. */
function headerComment(src) {
  const out = [];
  for (const line of src.split('\n')) {
    if (!out.length && line.startsWith('#!')) continue;
    if (!line.startsWith('//')) break;
    out.push(line);
  }
  return out.join('\n');
}

/** The `/** ... *\/` block immediately above `decl`. */
function jsdocAbove(src, decl) {
  const at = src.indexOf(decl);
  assert.ok(at >= 0, `${decl} is no longer declared`);
  const open = src.lastIndexOf('/**', at);
  assert.ok(open >= 0, `no JSDoc block above ${decl}`);
  const close = src.indexOf('*/', open);
  assert.ok(close > open && close < at, `the JSDoc block above ${decl} does not close before it`);
  return src.slice(open, close);
}

test('every decideManifestBump verdict code is named in BOTH documents (D-07)', () => {
  const core = doc('cadence-core', 'bin', 'lib', 'release-decision.mjs');
  const seam = doc('cadence-core', 'bin', 'release-bump.mjs');

  const codes = verdictCodes(core);
  // Non-vacuity first: a regex that matched nothing would otherwise pass green
  // over an empty loop, which is the same silence this test exists to break.
  const SHIPPED = ['no-target-version', 'unparseable-version', 'no-version-field',
    'already-at-target', 'downgrade', 'not-an-upgrade', 'bump'];
  for (const code of SHIPPED) {
    assert.ok(codes.includes(code),
      `the extraction missed \`${code}\`, a code decideManifestBump ships: ${JSON.stringify(codes)}`);
  }
  assert.ok(codes.length >= SHIPPED.length,
    `extracted fewer codes than ship today: ${JSON.stringify(codes)}`);

  const header = headerComment(seam);
  assert.ok(header.length > 500, 'release-bump.mjs\'s leading header comment block did not parse');
  const jsdoc = jsdocAbove(core, 'export function decideManifestBump(');

  // Word-boundary, so `bump` is not satisfied by `partial-bump`. `bump` IS
  // also this seam's subcommand name, so its presence in the header is not
  // distinguishing - every OTHER code has to be written down on purpose.
  const named = (text, code) => new RegExp(`(?<![\\w-])${code}(?![\\w-])`).test(text);
  for (const code of codes) {
    assert.ok(named(header, code),
      `verdict code \`${code}\` is missing from cadence-core/bin/release-bump.mjs's leading `
      + 'header comment block: the header claims to name the codes it emits verbatim as `reason`, '
      + 'so a caller reading that list cannot branch on this one');
    assert.ok(named(jsdoc, code),
      `verdict code \`${code}\` is missing from decideManifestBump's JSDoc in `
      + 'cadence-core/bin/lib/release-decision.mjs: that block declares the CLOSED set it owns');
  }
});


// --- FRM/D-12: every frontmatter grammar code reaches its reference table ----

/**
 * The frontmatter grammar's code set, read from EXECUTABLE source: every
 * kebab-case single-quoted literal between `scanValue`'s declaration and the
 * end of `parsePlanFiles`, with comments stripped first so prose naming a code
 * cannot stand in for the code being raised.
 *
 * From the SOURCE and not from a second prose list, for the reason
 * `verdictCodes` above states: a prose-to-prose comparison passes while both
 * lists are stale together. Nothing tied this module to
 * references/plan-frontmatter.md before this test.
 *
 * Bounded by SYMBOL, never by line number, and bounded at all because the same
 * module defines `active-non-id-bullet`, `criteria-heading-near-miss`,
 * `criterion-duplicate-id`, `criterion-empty-text` and
 * `criterion-indented-bullet` for OTHER grammars with their own references - an
 * unbounded scan would demand rows for them in this table.
 *
 * A whole-literal net rather than one regex per push form, because the forms
 * are not a closed set: the codes are written as a `code:` property, inside a
 * `codes:` array literal, as a `codes.push` argument, inside a ternary's array
 * branch and inside a `new Set([...])`, and a form-by-form extraction silently
 * finds a SUBSET - drafting this test three-form-wise missed
 * `trailing-inline-content` on exactly that. The cost of the wider net is a
 * false positive if a non-code kebab literal is ever added to this region,
 * whose remedy is to write the row or rename the string: the safe direction for
 * an agreement test, unlike a miss.
 */
function frontmatterCodes(src) {
  const start = src.indexOf('\nfunction scanValue(');
  assert.ok(start >= 0, 'scanValue is no longer declared in lib/planning-files.mjs');
  const last = src.indexOf('\nexport function parsePlanFiles(');
  assert.ok(last > start, 'parsePlanFiles is no longer declared below scanValue');
  const end = src.indexOf('\n}\n', last);
  assert.ok(end > last, 'could not find the closing brace of parsePlanFiles');
  const region = src.slice(start, end)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  return [...new Set([...region.matchAll(/'([a-z][a-z0-9]*(?:-[a-z0-9]+)+)'/g)].map((m) => m[1]))];
}

test('every frontmatter grammar code has a row in plan-frontmatter.md (D-12)', () => {
  const codes = frontmatterCodes(doc('cadence-core', 'bin', 'lib', 'planning-files.mjs'));

  // Non-vacuity first: an extraction that matched nothing would pass green
  // over an empty loop, which is the same silence this test exists to break.
  const SHIPPED = [
    'unterminated-quote', 'trailing-value-content', 'residual-quote',
    'backtick-wrapped-value', 'unterminated-inline-list', 'trailing-inline-content',
    'unterminated-frontmatter', 'malformed-key-line', 'unknown-line',
    'item-without-key', 'commented-key-line', 'redundant-path-segment',
    'markdown-decorated-path',
  ];
  for (const code of SHIPPED) {
    assert.ok(codes.includes(code),
      `the extraction missed \`${code}\`, a code the frontmatter grammar raises: ${JSON.stringify(codes)}`);
  }
  assert.ok(codes.length >= SHIPPED.length,
    `extracted fewer codes than ship today: ${JSON.stringify(codes)}`);

  const ref = doc('cadence-core', 'references', 'plan-frontmatter.md');
  const at = ref.indexOf('\n## Diagnostic codes\n');
  assert.ok(at >= 0, 'plan-frontmatter.md no longer carries a `## Diagnostic codes` heading');
  const after = ref.indexOf('\n## ', at + 1);
  const table = ref.slice(at, after === -1 ? ref.length : after);
  assert.ok(/^\| Code \| Means \| Payload \| Cleared by \|$/m.test(table),
    'the `## Diagnostic codes` section no longer holds the four-column code table');

  for (const code of codes) {
    assert.ok(new RegExp(`^\\| \`${code}\` \\|`, 'm').test(table),
      `grammar code \`${code}\` is raised by cadence-core/bin/lib/planning-files.mjs but has no row `
      + 'in cadence-core/references/plan-frontmatter.md\'s `## Diagnostic codes` table: that table is '
      + 'the stated grammar a plan author reads, so a code missing from it is a diagnostic with no '
      + 'documented meaning and no stated remedy');
  }
});

// --- setup: a provider question with no answer is a stop, not a fall-through -

/**
 * The forge step of one entry workflow: everything from `**Pick a forge**` on.
 * A region rather than the whole file, so an option or an arm found anywhere
 * else in the document cannot satisfy the check.
 * @param {string} text @returns {string}
 */
function forgeStep(text) {
  const at = text.indexOf('**Pick a forge**');
  return at > -1 ? text.slice(at) : '';
}

/**
 * The property: the provider question offers a none-of-these option, the file
 * states a stop arm for it carrying BOTH a reason and a hint, and that arm sits
 * at an EARLIER offset than the invocation that persists the answers.
 *
 * OFFSETS IN THE FILE'S OWN TEXT, never line numbers: an inserted paragraph
 * moves every line below it and would redden a check about ORDER that nothing
 * about the order changed. Order and not presence, for the reason the cad-land
 * 3(b) case above is: an arm that sits after the write has already persisted a
 * provider by the time it refuses, which is the failure it exists to stop.
 *
 * Exported as a function taking TEXT so the falsifier below can hand it a
 * scratch copy with the arm removed. A check that can only read the live tree
 * cannot be shown to fail.
 * @param {string} name @param {string} text
 */
function assertNoneArm(name, text) {
  const step = forgeStep(text);
  assert.ok(step, `${name}: no forge step at all`);
  assert.match(step, /\*\*None of these\*\*/,
    `${name}: the provider question offers no none-of-these option, so a user who uses `
    + 'none of the installed forges has no answer to give');

  const stopAt = step.indexOf('On "None of these" the step REFUSES and stops');
  assert.ok(stopAt > -1,
    `${name}: no arm for a declined provider question - setup would run on past a `
    + 'question it never got an answer to');
  const arm = step.slice(stopAt);
  assert.match(arm.slice(0, 1200), /REASON naming what was looked for/,
    `${name}: the none-of-these arm states no reason`);
  assert.match(arm.slice(0, 1200), /HINT naming how to set one later/,
    `${name}: the none-of-these arm states no hint`);
  assert.match(arm.slice(0, 1200), /run NO `config\.mjs set` on this arm/,
    `${name}: the none-of-these arm does not forbid a half-persisted write`);

  // The persist invocation, by the pair only that arm's own inline `config.mjs
  // set` never spells: the two-key form is what task 4's step writes.
  const persistAt = step.indexOf('git.forge_repo=<owner/name>');
  assert.ok(persistAt > -1, `${name}: the forge step no longer persists the answers`);
  assert.ok(stopAt < persistAt,
    `${name}: the none-of-these arm sits AFTER the config.mjs set that persists the `
    + 'answers, so a declined question has already written a provider');
}

test('setup: a declined provider question stops both entry points before any write', () => {
  for (const wf of ['new-project.md', 'adopt.md']) {
    assertNoneArm(wf, doc('cadence-core', 'workflows', wf));
  }
});

test('setup: the none-of-these check FAILS when the arm is deleted', () => {
  // The falsifier. Without it the case above is a check that has never been
  // shown to be able to fail - the species of green this file exists to refuse.
  // A scratch COPY in memory, not on disk: the rule reads text, so a temp file
  // would prove the same thing one syscall later.
  for (const wf of ['new-project.md', 'adopt.md']) {
    const live = doc('cadence-core', 'workflows', wf);
    const armAt = live.indexOf('On "None of these" the step REFUSES and stops');
    const persistAt = live.indexOf('Persist the answers in ONE call');
    assert.ok(armAt > -1 && persistAt > armAt, `${wf}: fixture assumption broken`);
    const without = live.slice(0, armAt) + live.slice(persistAt);
    assert.throws(() => assertNoneArm(wf, without),
      /no arm for a declined provider question/,
      `${wf}: deleting the none-of-these arm does not redden the check`);
  }
});

// --- setup: the confirmation comes BEFORE the create, not beside it ----------

/**
 * The property AC6 states about the half no seam can hold: `forge.mjs create`
 * refuses without `--confirmed`, which proves a caller passed a FLAG. Only the
 * prose can say the flag follows a question the user actually answered, and
 * only its ORDER can say it was answered FIRST.
 *
 * The invocation is spelled `forge.mjs" create` because every seam call in this
 * tree carries the plugin-root quote between the filename and the subcommand
 * (`node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/forge.mjs" create`), which is
 * the same shape self-verify's invocation check reads.
 *
 * OFFSETS IN THE FILE'S OWN TEXT, never line numbers, for the reason the
 * none-of-these case above states: an inserted paragraph moves every line below
 * it and would redden a check about ORDER that nothing about the order changed.
 *
 * Exported as a function taking TEXT so the falsifier below can hand it a
 * scratch copy with the invocation moved above the question.
 * @param {string} name @param {string} text
 */
function assertConfirmBeforeCreate(name, text) {
  const step = forgeStep(text);
  assert.ok(step, `${name}: no forge step at all`);

  const createAt = step.indexOf('forge.mjs" create');
  assert.ok(createAt > -1, `${name}: the forge step no longer invokes forge.mjs create`);
  assert.equal(step.indexOf('forge.mjs" create', createAt + 1), -1,
    `${name}: more than one forge.mjs create invocation - AC6 scopes creation to one arm, `
    + 'and a second one is a path the ordering below has not been asserted about');

  // The confirmation is the SENTENCE, not the word: four facts in the question
  // itself, because nothing else in the run states them together.
  const confirmAt = step.indexOf('Create <owner>/<name> on <provider> now?');
  assert.ok(confirmAt > -1,
    `${name}: no confirmation naming the provider, the owner and the repository name - `
    + 'AC6 requires the question itself to state what is about to be created');
  const question = step.slice(confirmAt, confirmAt + 200);
  assert.match(question, /PRIVATE/,
    `${name}: the confirmation does not state that the repository will be PRIVATE`);

  assert.ok(confirmAt < createAt,
    `${name}: the forge.mjs create invocation sits BEFORE the confirmation - the ordering `
    + 'is the property, since --confirmed proves only that a flag was passed and the prose '
    + 'is the only thing that can say a user answered first');

  // The flag itself, in the invocation's own block: an invocation that reached
  // the right ORDER without carrying --confirmed would be refused by the seam.
  assert.match(step.slice(createAt, createAt + 400), /--confirmed/,
    `${name}: the forge.mjs create invocation does not carry --confirmed`);
}

test('setup: the create confirmation is put BEFORE the create runs', () => {
  assertConfirmBeforeCreate('new-project.md', doc('cadence-core', 'workflows', 'new-project.md'));
});

test('setup: the confirmation-order check FAILS when the create is moved above it', () => {
  // The falsifier, on a scratch COPY in memory: the rule reads text, so a temp
  // file would prove the same thing one syscall later. The invocation LINE is
  // moved to sit above the question, which is exactly the tree this check
  // exists to redden and is otherwise indistinguishable from the live one.
  const live = doc('cadence-core', 'workflows', 'new-project.md');
  const confirmAt = live.indexOf('Create <owner>/<name> on <provider> now?');
  const createAt = live.indexOf('forge.mjs" create');
  assert.ok(confirmAt > -1 && createAt > confirmAt, 'fixture assumption broken');
  const line = live.slice(createAt, live.indexOf('\n', createAt) + 1);
  const moved = live.slice(0, confirmAt) + line
    + live.slice(confirmAt, createAt) + live.slice(createAt + line.length);
  assert.throws(() => assertConfirmBeforeCreate('new-project.md', moved),
    /sits BEFORE the confirmation/,
    'moving the create above the confirmation does not redden the check');
});

// --- EXP-05: one targeted run per task, one suite run per dispatch -----------

/**
 * Phase 2 of v3.7.6 moved two rules into skills/cad-executor-contract:
 * step 2 verifies a task with the run that task NAMES, and the full suite has
 * exactly one site in the whole dispatch. Both are prose an executor obeys and
 * nothing else enforces, so a reword that dropped either would cost a suite run
 * per task on every future dispatch with no red anywhere.
 *
 * OFFSETS IN THE DOCUMENT'S OWN TEXT, never line numbers, for the reason the
 * confirm-before-create case above states: an inserted paragraph moves every
 * line below it and would redden a check about ORDER that nothing about the
 * order changed.
 */
const EXECUTOR_CONTRACT = ['skills', 'cad-executor-contract', 'SKILL.md'];
const VERIFIER_CONTRACT = ['skills', 'cad-verifier-contract', 'SKILL.md'];

/** The slice between two needles, as an offset range, or a loud failure. */
function region(text, from, to, where) {
  const a = text.indexOf(from);
  assert.ok(a > -1, `executor contract: ${where} is gone - no "${from}"`);
  const b = text.indexOf(to, a + from.length);
  assert.ok(b > a, `executor contract: ${where} has no end - no "${to}" after it`);
  return text.slice(a, b);
}

/**
 * Step 2 takes its subject from the task, not from a suite and not from config.
 * @param {string} text
 */
function assertTargetedRun(text) {
  const step = flat(region(text, '2. Verify falsifiably', '\n3. Static analysis', 'step 2'));

  assert.match(step, /BEFORE running the task's `Verify:` command/,
    'step 2 no longer names the task\'s own `Verify:` as the command it predicts against');
  assert.match(step, /That command is what verifies the task/,
    'step 2 no longer says the task\'s `Verify:` command is what verifies the task - '
    + 'without it the executor is free to reach for the suite again');
  assert.match(step, /where a task names none, the test file the task's files map to, run by name/,
    'step 2 no longer states the by-name fallback for a task that names no `Verify:` run');
  assert.match(step, /Never the full test suite per task/,
    'step 2 no longer forbids the per-task suite run, which is the cost this rule exists '
    + 'to remove');

  // The key belongs to the ONE suite site below, and nowhere else in this
  // document: "`workflow.test_command` from config if set and relevant" is the
  // phrasing that let a suite run stand in for a targeted one.
  assert.ok(!step.includes('test_command'),
    'step 2 names `workflow.test_command` again - the key has exactly one site in this '
    + 'contract, at the suite run before the digest');
  assert.doesNotMatch(step, /pytest|npm test|cargo test|test\.mjs/,
    'step 2 hard-codes a suite runner - the run comes from the task, not from this contract');
}

/**
 * The suite has one site: after the last task, before the digest, once.
 * @param {string} text
 */
function assertOneSuiteSite(text) {
  const site = region(text, "After the last task's commit", '</process>', 'the suite site');
  const flatSite = flat(site);

  assert.match(flatSite, /At most one full-suite run per dispatch/,
    'the suite site no longer bounds itself to one run per dispatch');
  assert.match(flatSite, /immediately before the digest/,
    'the suite site no longer says WHERE it runs');
  assert.match(flatSite, /never as a first probe, never between tasks/,
    'the suite site no longer excludes the first probe and the between-tasks run, which '
    + 'are the two shapes that produced 5 to 27 suite runs per dispatch');
  assert.match(flatSite, /Then return the digest\./,
    'the suite site no longer ends at the digest');

  // Resolved inline, at its only consumer, in the spelling every seam call in
  // this tree carries between the filename and the subcommand.
  const invocation = 'config.mjs" get workflow.test_command';
  assert.ok(site.includes(invocation),
    `the suite site no longer resolves the command with \`${invocation}\``);
  const keyAt = text.indexOf('workflow.test_command');
  assert.equal(text.indexOf('workflow.test_command', keyAt + 1), -1,
    'the contract names `workflow.test_command` more than once - the key has exactly one '
    + 'site here, which is what makes the reach row in config-reach.md checkable');
  assert.equal(keyAt, text.indexOf(invocation) + invocation.indexOf('workflow.test_command'),
    'the contract\'s one mention of `workflow.test_command` is not the suite site\'s own '
    + 'inline invocation');
  assert.match(flatSite, /Never hand-roll a read of `\.planning\/config\.json`/,
    'the suite site no longer forbids the hand-rolled config read, which returns null on '
    + 'the one machine that set the key');
  assert.match(flatSite, /Where the key IS null, run the suite the project's own manifest names/,
    'the suite site states no null arm - the measured baseline ran with the key unset, so '
    + 'prose that binds only when it is set changes nothing');

  // Order: the site sits after the last numbered item and before the digest.
  const lastStep = text.indexOf('5. Rewrite `<plandir>/reports/plan-<k>.md`');
  assert.ok(lastStep > -1, 'the per-task loop no longer ends at the report write');
  assert.ok(lastStep < text.indexOf("After the last task's commit"),
    'the suite site sits ABOVE the last per-task step, so it would run between tasks');

  // And it is not ALSO in the commit protocol, which would put it back at one
  // run per task. Invocations, not the bare word `test`: item 3 of that block
  // lists the conventional-commit types, `test` among them.
  const protocol = region(text, '<commit_protocol>', '</commit_protocol>', 'the commit protocol');
  assert.doesNotMatch(protocol, /test_command|full[- ]suite|test suite|pytest|npm test|test\.mjs/i,
    'the commit protocol carries a test invocation - D-01 put the suite at one site per '
    + 'dispatch precisely so it could not ride the per-task commit compound');
}

test('EXP-05: the executor verifies a task with the run that task names', () => {
  assertTargetedRun(doc(...EXECUTOR_CONTRACT));
});

test('EXP-05: the targeted-run check FAILS when the sentence is deleted', () => {
  // The falsifier, on a scratch COPY in memory: the rule reads text, so a temp
  // file would prove the same thing one syscall later.
  const live = doc(...EXECUTOR_CONTRACT);
  const sentence = 'That command is what verifies the task';
  const at = live.indexOf(sentence);
  const end = live.indexOf('Never the full test suite per task', at);
  assert.ok(at > -1 && end > at, 'fixture assumption broken');
  const without = live.slice(0, at) + live.slice(end);
  assert.throws(() => assertTargetedRun(without),
    /no longer says the task's `Verify:` command is what verifies the task/,
    'deleting the targeted-run sentence does not redden the check');
});

test('EXP-05: the full suite has one site, after the last task and before the digest', () => {
  assertOneSuiteSite(doc(...EXECUTOR_CONTRACT));
});

test('EXP-05: the suite-site check FAILS when the site is deleted', () => {
  const live = doc(...EXECUTOR_CONTRACT);
  const at = live.indexOf("After the last task's commit");
  const end = live.indexOf('</process>', at);
  assert.ok(at > -1 && end > at, 'fixture assumption broken');
  const without = `${live.slice(0, at)}Then return the digest.\n\n${live.slice(end)}`;
  assert.throws(() => assertOneSuiteSite(without),
    /the suite site is gone/,
    'deleting the suite site does not redden the check');
});

test('EXP-05: the executor and the verifier state one rule in one vocabulary', () => {
  // D-05: the executor BORROWED the verifier contract's shipped wording rather
  // than inventing a synonym. Pinned as a PAIR so a reword on either side
  // reddens here instead of drifting into two rules that sound different.
  const exec = flat(doc(...EXECUTOR_CONTRACT));
  const verif = flat(doc(...VERIFIER_CONTRACT));
  for (const [where, text, per, once] of [
    ['verifier', verif, 'truth', 'verification'],
    ['executor', exec, 'task', 'dispatch'],
  ]) {
    assert.match(text, new RegExp(`full test suite per ${per}`),
      `${where} contract: "full test suite per ${per}" is gone - the two contracts state `
      + 'the same rule and this is the phrase they share');
    assert.match(text, new RegExp(`At most one full-suite run per ${once}`),
      `${where} contract: "At most one full-suite run per ${once}" is gone - the two `
      + 'contracts state the same rule and this is the phrase they share');
  }
});

// --- PHS-02: the too-big arm opens a door instead of naming a locked one -----
//
// The defect: `/cad-task`'s "Too big" arm told the user to "Route it through
// /cad-context -> /cad-plan", and `/cad-context` on a phase the roadmap does
// not carry STOPS. So the one arm that fires when Cadence has correctly
// recognised phase-sized work handed the user a command guaranteed to refuse.
// `/cad-phase add` is the only command in the plugin that appends a phase to an
// existing roadmap, so it is the first stop and everything else follows it.
//
// Asserted on ORDER and on the NAMED site, never on a tree-wide `/cad-context`
// count: the corrected arm legitimately names `/cad-context` as its SECOND
// stop, so a check forbidding the string outright would go red on exactly the
// prose this phase shipped. No line numbers either - both files are edited
// often enough that a pinned number would rot before it caught anything.

const TASK_WF = ['cadence-core', 'workflows', 'task.md'];

/**
 * The `- **Too big**` arm of task.md's `scope` step, WHOLE: from its own marker
 * to the END of the step body.
 *
 * It used to stop at the first blank line, which was the same slice while the
 * arm was one paragraph - and became a silent vacuity the moment PHS-03 gave
 * the arm a branch per `status` answer, because every assertion below would
 * then have read the first paragraph only and passed on prose it never opened.
 * The step body is the right bound: the arm is the last bullet in it.
 */
const tooBigArm = (text) => {
  const step = stepBody(text, 'scope', 'task.md');
  const at = step.indexOf('- **Too big**');
  assert.ok(at > -1, "task.md's scope step carries no `- **Too big**` bullet");
  return step.slice(at);
};

test('PHS-02 (1): the too-big arm names /cad-phase add before the commands that need a phase', () => {
  const arm = tooBigArm(doc(...TASK_WF));
  const regressed = "PHS-02: task.md's too-big arm no longer routes a phase-sized task to "
    + '/cad-phase add FIRST - the user is sent at /cad-context or /cad-plan for a phase the '
    + 'roadmap does not carry yet, which is the refusal this arm exists to avoid';
  const add = arm.indexOf('/cad-phase add');
  const context = arm.indexOf('/cad-context');
  const plan = arm.indexOf('/cad-plan');
  assert.ok(add > -1, regressed);
  assert.ok(context > -1, regressed);
  assert.ok(plan > -1, regressed);
  assert.ok(add < context && context < plan, regressed);
});

test('PHS-02 (2): the arm resolves the phase number rather than printing a placeholder', () => {
  const arm = tooBigArm(doc(...TASK_WF));
  const regressed = "PHS-02: task.md's too-big arm no longer resolves the phase number from "
    + '`planning.mjs status` and `total + 1` - it hands the user a number to substitute, '
    + 'which is the defect this cycle exists to close';
  assert.match(arm, /planning\.mjs"?\s+status/, regressed);
  assert.match(arm, /total \+ 1/, regressed);
  // The other half: the rule the prose states is one the resolver can actually
  // answer. A prose rule reading a field the envelope does not carry would
  // print nothing at all, and no amount of grepping the prose would show it.
  const out = JSON.parse(execFileSync('node', [join(HERE, 'planning.mjs'), 'status'],
    { cwd: REPO, encoding: 'utf8' }));
  assert.equal(out.ok, true, 'planning.mjs status does not answer ok:true on this repo');
  assert.ok(Number.isInteger(out.total),
    'planning.mjs status returns no integer `total`, so the arm\'s `total + 1` rule '
    + 'resolves to nothing and the printed sequence carries no phase number');
});

test('PHS-02 (3): the first stop carries the task\'s own description, and /cad-phase advertises it', () => {
  const regressed = 'PHS-02: the printed sequence no longer hands the task description to '
    + '/cad-phase add, or /cad-phase stopped advertising that `add` takes one - either way '
    + 'the user retypes what Cadence already holds';
  assert.match(tooBigArm(doc(...TASK_WF)), /\/cad-phase add \$TASK/, regressed);
  const hint = doc('skills', 'cad-phase', 'SKILL.md').match(/^argument-hint: "(.*)"$/m);
  assert.ok(hint, 'skills/cad-phase/SKILL.md carries no argument-hint field');
  const addAlternative = hint[1].split('|')[0];
  assert.match(addAlternative, /description/i, regressed);
});

test('PHS-02 (4): no /cad-task surface sends phase-sized work to /cad-context first', () => {
  const regressed = 'PHS-02: a /cad-task surface routes phase-sized work at /cad-context '
    + 'again - the mid-task guardrail or the SKILL objective that rides every session prompt, '
    + 'either of which advertises the locked door while the arm names the open one';
  assert.doesNotMatch(doc('skills', 'cad-task', 'SKILL.md'), /\/cad-context/, regressed);
  const task = doc(...TASK_WF);
  const open = task.lastIndexOf('<guardrails>');
  const close = task.lastIndexOf('</guardrails>');
  assert.ok(open > -1 && close > open, 'task.md has no <guardrails> block');
  const guardrails = task.slice(open, close);
  assert.match(guardrails, /\/cad-phase add/, regressed);
  // Absence as well as presence: a guardrail reading "re-route to /cad-context,
  // then /cad-phase add" would satisfy the match above while the mid-task path
  // still walks into the refusal.
  assert.doesNotMatch(guardrails, /\/cad-context/, regressed);
});

test('PHS-02 (5): the /cad-context off-roadmap stop names the command that creates the phase', () => {
  const context = doc('cadence-core', 'workflows', 'context.md');
  const at = context.indexOf('not in the roadmap');
  assert.ok(at > -1, "context.md's resolve_phase step no longer stops on an off-roadmap phase");
  const end = context.indexOf('\n\n', at);
  const stop = context.slice(at, end === -1 ? context.length : end);
  assert.match(stop, /\/cad-phase add/,
    "PHS-02: /cad-context's off-roadmap stop names no next action again, so a user arriving "
    + 'by a stale cursor or a typed number meets a refusal with no exit');
});

// --- PHS-03: /cad-task classifies before it guards ---------------------------
//
// The defect: `task.md`'s `git_guard` step opened directly after `parse`, so
// EVERY invocation paid the rail-1 guard - the protected-branch question, the
// base-integrity check and the integration-branch decision - including the one
// arm that then says "this is phase-sized" and stops without touching a file.
// The user answered branch questions for work Cadence had already decided it
// was not going to do.
//
// Asserted on ORDER, the same index-comparison shape `#195` uses on
// `execute.md`'s `locate` before its `git_guard`, plus a COUNT: the obvious
// wrong fix is to leave the step where it is and copy a guard sentence into
// the inline and planned arms, which ships two statements of one rail in one
// file and lets them drift.

test('PHS-03: task.md classifies before it guards, with one guard step', () => {
  const task = doc(...TASK_WF);
  const regressed = 'PHS-03: task.md no longer classifies before it guards - the rail-1 '
    + 'branch question is charged to the phase-sized arm, which says so and stops without '
    + 'ever reaching a commit';
  const scope = task.indexOf('<step name="scope">');
  const guard = task.indexOf('<step name="git_guard">');
  const bracket = task.indexOf('<step name="bracket">');
  assert.ok(scope > -1 && guard > -1 && bracket > -1, 'task.md is missing one of the three steps');
  assert.ok(scope < guard, regressed);
  // Before `bracket`, not after: the guard's `ask` arm has an Abort option, and
  // an abort taken past an open bracket strands a dispatch event with nothing
  // to close it - which is the same reason `bracket` excludes the too-big arm.
  assert.ok(guard < bracket,
    'PHS-03: task.md opens its trace bracket BEFORE the guard, so a guard abort leaves a '
    + 'dispatch event unpaired');
  assert.equal(task.indexOf('<step name="git_guard">', guard + 1), -1,
    'PHS-03: task.md carries a second git_guard step - one rail stated twice in one file '
    + 'is two statements that drift');
  // The step says WHICH arms pay it, so a later reader cannot restore the
  // every-invocation reading while the step is still in the right place.
  assert.match(stepBody(task, 'git_guard', 'task.md'), /[Ii]nline and planned/,
    'PHS-03: task.md\'s git_guard step no longer names the inline and planned arms as its '
    + 'scope, so it reads as applying to every invocation again');
});

test('PHS-03: the phase-sized arm names both doors where there is no planning tree', () => {
  const arm = tooBigArm(doc(...TASK_WF));
  const regressed = "PHS-03: task.md's phase-sized arm assumes a planning tree again - in a "
    + 'repository with no .planning/ it routes the user at the one command that appends to a '
    + 'roadmap, which is the command guaranteed to refuse where no roadmap exists';
  // These two are also the widened slice's own non-vacuity proof: neither
  // string is reachable from the arm's FIRST PARAGRAPH, so a `tooBigArm` that
  // regressed to the first-blank-line bound fails HERE instead of passing
  // silently on every assertion in this file.
  assert.match(arm, /\/cad-adopt/, regressed);
  assert.match(arm, /\/cad-new-project/, regressed);
  // The treeless branch ALONE, by its own anchors. A whole-arm absence check
  // cannot serve: the initialised branch above it names /cad-phase add and is
  // right to.
  const at = arm.indexOf('`no-planning-dir`');
  assert.ok(at > -1,
    "task.md's phase-sized arm no longer branches on the seam's `no-planning-dir` reason, so "
    + 'it computes `total + 1` over an envelope that carries no total');
  const end = arm.indexOf('On any other `ok:false`', at);
  assert.ok(end > at,
    "task.md's phase-sized arm no longer relays the remaining `ok:false` envelopes, so a "
    + 'refusal it did not anticipate is reported as a phase-sized verdict');
  const treeless = arm.slice(at, end);
  assert.match(treeless, /\/cad-adopt/, regressed);
  assert.match(treeless, /\/cad-new-project/, regressed);
  assert.doesNotMatch(treeless, /\/cad-phase add/, regressed);
});
