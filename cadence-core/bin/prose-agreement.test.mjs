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
