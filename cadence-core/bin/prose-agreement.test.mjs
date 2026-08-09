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
import { residentWeight } from './lib/resident-weight.mjs';

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

// --- the measured byte count, wherever prose copies it -----------------------

/** `NN,NNN` as prose writes a byte count. */
const commas = (n) => n.toLocaleString('en-US');

test('every site copying a measured byte count states the measured number', () => {
  // The drift class that had no check at all. `references/seams.md:240-242` now
  // requires every future deferral to quote its reference's measured bytes
  // inline, and those inline figures were checked against nothing - which is how
  // `review-triggers.md` came to be published at 17,733 B in four places at once.
  // Measured through weighAll, the SAME lib self-verify enforces with and
  // weight.mjs reports from, so the check cannot diverge from the enforced
  // number.
  const measured = new Map(weighAll(REPO).map((s) => [s.surface, s]));

  const REF = 'cadence-core/references/review-triggers.md';
  const ref = measured.get(REF);
  assert.ok(ref, `${REF} is not a measured surface`);

  const budgets = JSON.parse(doc('cadence-core', 'bin', 'weight-budgets.json')).budgets;
  assert.equal(budgets[REF], ref.bytes, 'weight-budgets.json entry');

  for (const skill of ['cad-land', 'cad-plan-review']) {
    const text = doc('skills', skill, 'SKILL.md');
    assert.ok(text.includes(`${commas(ref.bytes)} B`),
      `skills/${skill}/SKILL.md does not state ${commas(ref.bytes)} B for ${REF}`);
  }
});

test('docs/EVIDENCE.md: every twelve-largest row states measured bytes AND est tokens', () => {
  // Every row, not just review-triggers.md's: checking one of twelve leaves the
  // other eleven and the whole est-token column free to stale in silence, which
  // is the drift this check exists to close. Est tokens come from the seam's own
  // measurement, never a recomputation of bytes/4 - `estTokens` counts
  // CHARACTERS, which is why 17,714 B reads 4,429 rather than 4,428.
  const measured = new Map(weighAll(REPO).map((s) => [s.surface, s]));
  const evidence = doc('docs', 'EVIDENCE.md');

  // Scoped to the table under its own heading sentence, so the per-directory
  // table above it - same three-column shape, `cadence-core/<dir>/` in cell one
  // - cannot be swept in and read as a surface.
  const section = evidence.split('The twelve largest individual surfaces:')[1];
  assert.ok(section, 'the twelve-largest table lost its heading sentence');
  const rows = section.split('\n')
    .map((l) => l.match(/^\| `([^`]+[^/])` \| ([\d,]+) \| ([\d,]+) \|$/))
    .filter(Boolean);
  assert.equal(rows.length, 12, 'the twelve-largest table no longer has twelve parsed rows');

  const num = (s) => Number(s.replace(/,/g, ''));
  for (const [, surface, bytes, est] of rows) {
    const m = measured.get(surface);
    assert.ok(m, `EVIDENCE names ${surface}, which is not a measured surface`);
    assert.equal(num(bytes), m.bytes, `${surface} bytes`);
    assert.equal(num(est), m.estTokens, `${surface} est tokens`);
  }

  // And the table really is the twelve largest, so a row cannot quietly leave it.
  const largest = [...measured.values()].sort((a, b) => b.bytes - a.bytes)
    .slice(0, 12).map((s) => s.surface);
  assert.deepEqual(rows.map((r) => r[1]), largest);
});

test('docs/EVIDENCE.md: the per-directory subtotals and grand total are the measured sums', () => {
  // The stale half this check was written for: `cadence-core/workflows/` and the
  // grand total were 159 B light before this phase touched anything - exactly
  // 716fb60's task.md growth, committed after f8f22cf last re-measured them.
  const all = weighAll(REPO);
  const evidence = doc('docs', 'EVIDENCE.md');
  const num = (s) => Number(s.replace(/,/g, ''));

  const prefixes = ['agents/', 'cadence-core/references/', 'cadence-core/templates/',
    'cadence-core/workflows/', 'skills/'];
  let seen = 0;
  for (const prefix of prefixes) {
    const under = all.filter((s) => s.surface.startsWith(prefix));
    const row = evidence.split('\n').find((l) => l.startsWith(`| \`${prefix}\` |`));
    assert.ok(row, `no per-directory row for ${prefix}`);
    const [, count, bytes] = row.split('|').slice(1, -1).map((c) => c.trim());
    assert.equal(num(count), under.length, `${prefix} surface count`);
    assert.equal(num(bytes), under.reduce((t, s) => t + s.bytes, 0), `${prefix} bytes`);
    seen += under.length;
  }
  assert.equal(seen, all.length, 'a measured surface falls under none of the five prefixes');

  const total = evidence.split('\n').find((l) => l.startsWith('| **total** |'));
  assert.ok(total, 'no grand-total row');
  const [, count, bytes] = total.split('|').slice(1, -1).map((c) => c.trim().replace(/\*/g, ''));
  assert.equal(num(count), all.length, 'grand-total surface count');
  assert.equal(num(bytes), all.reduce((t, s) => t + s.bytes, 0), 'grand-total bytes');
});

// --- the four EVIDENCE tables the byte checks above did NOT reach -----------
//
// The twelve-largest and per-directory checks above pin `weighAll`'s output.
// They leave four tables measured by `residentWeight` pinned by nothing, which
// is the same failure class EVIDENCE.md:171-177 claims to have closed: add one
// sentence to any workflow, re-pin its budget entry, and self-verify goes green
// while the turn-one, eager/reachable and dispatch figures quietly go wrong.
// The file's own promise at :6 is "check the tree out, run the command,
// compare" - so every measured figure it prints is checked here, not four of
// the six tables' worth.

/** Rows of the markdown table that starts at the first line matching `head`. */
const rowsUnder = (text, head) => {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => l.startsWith(head));
  assert.ok(start >= 0, `no table row starting ${head}`);
  let i = start;
  while (i > 0 && lines[i - 1].startsWith('|')) i -= 1;
  const out = [];
  for (; i < lines.length && lines[i].startsWith('|'); i += 1) {
    const cells = lines[i].split('|').slice(1, -1).map((c) => c.trim().replace(/\*/g, ''));
    if (cells.every((c) => /^-*:?-*$/.test(c) || c === '')) continue;
    // Drop the header: a data row always ends in a byte figure, a header never
    // does, and walking back to the table start necessarily picks the header up.
    if (!/^[\d,]+$/.test(cells[cells.length - 1])) continue;
    out.push(cells);
  }
  return out;
};

test('docs/EVIDENCE.md: every turn-one byte figure is what residentWeight measures', () => {
  const r = residentWeight(REPO);
  const evidence = doc('docs', 'EVIDENCE.md');
  const num = (s) => Number(s.replace(/,/g, ''));

  const rows = rowsUnder(evidence, '| Command | Turn-one bytes |')
    .filter((c) => c[0].startsWith('`/'));
  const byCommand = new Map(r.commands.map((c) => [c.command, c]));

  let sum = 0;
  for (const [name, bytes] of rows) {
    const command = name.replace(/[`/]/g, '');
    const measured = byCommand.get(command);
    assert.ok(measured, `EVIDENCE names ${name}, residentWeight does not measure it`);
    assert.equal(num(bytes), measured.eagerBytes, `${name} turn-one bytes`);
    sum += measured.eagerBytes;
  }
  assert.equal(rows.length, r.commands.length, 'a measured command has no turn-one row');

  const total = evidence.split('\n').find((l) => l.startsWith('| **23 user-invocable commands**'));
  assert.ok(total, 'no turn-one total row');
  assert.equal(num(total.split('|').slice(1, -1)[1].trim().replace(/\*/g, '')), sum,
    'turn-one total is not the sum of the column above it');
});

test('docs/EVIDENCE.md: every eager-vs-reachable pair is what residentWeight measures', () => {
  const r = residentWeight(REPO);
  const evidence = doc('docs', 'EVIDENCE.md');
  const num = (s) => Number(s.replace(/,/g, ''));
  const byCommand = new Map(r.commands.map((c) => [c.command, c]));

  const rows = rowsUnder(evidence, '| Command | Eager (turn one) |');
  assert.ok(rows.length >= 10, 'the eager-vs-reachable table lost rows');
  for (const [name, eager, reachable] of rows) {
    const command = name.replace(/[`/]/g, '');
    const measured = byCommand.get(command);
    assert.ok(measured, `EVIDENCE names ${name}, residentWeight does not measure it`);
    assert.equal(num(eager), measured.eagerBytes, `${name} eager bytes`);
    assert.equal(num(reachable), measured.reachableBytes, `${name} reachable bytes`);
  }
});

test('docs/EVIDENCE.md: the zero-resident surfaces and their total are measured', () => {
  const r = residentWeight(REPO);
  const evidence = doc('docs', 'EVIDENCE.md');
  const num = (s) => Number(s.replace(/,/g, ''));

  for (const s of r.zeroResident) {
    const row = evidence.split('\n').find((l) => l.startsWith(`| \`${s.surface}\` |`));
    assert.ok(row, `${s.surface} reaches no command but EVIDENCE does not list it`);
    assert.equal(num(row.split('|').slice(1, -1)[1].trim()), s.bytes, `${s.surface} bytes`);
  }
  assert.ok(evidence.includes(r.zeroResidentBytes.toLocaleString('en-US')),
    `EVIDENCE does not state the zero-resident total ${r.zeroResidentBytes}`);
});

test('docs/EVIDENCE.md: every dispatch row states the measured agent and dispatch bytes', () => {
  const r = residentWeight(REPO);
  const evidence = doc('docs', 'EVIDENCE.md');
  const num = (s) => Number(s.replace(/,/g, ''));

  const rows = rowsUnder(evidence, '| Role | Agent file |');
  assert.equal(rows.length, r.roles.length, 'a measured rung agent has no dispatch row');

  const byAgent = new Map(r.roles.map((x) => [x.agent, x]));
  for (const [role, agent, agentBytes, dispatchBytes] of rows) {
    const file = agent.replace(/`/g, '');
    const measured = byAgent.get(file);
    assert.ok(measured, `EVIDENCE names ${file}, residentWeight does not measure it`);
    assert.equal(role, measured.role, `${file} role`);
    assert.equal(num(agentBytes), measured.agentBytes, `${file} agent bytes`);
    assert.equal(num(dispatchBytes), measured.dispatchBytes, `${file} dispatch bytes`);
  }
});
