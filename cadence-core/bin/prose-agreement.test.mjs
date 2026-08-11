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
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { weighAll } from './lib/surface-weight.mjs';
import { DEFERRED_READS, regionLabels } from './lib/deferred-reads.mjs';

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
