// Zero-dep tests for lib/debt-markers.mjs - the CADENCE-DEBT grammar as a pure
// function. Run: node --test cadence-core/bin/debt-markers.test.mjs
// Only node: builtins, per the repo's zero-dep ethos.
//
// The token is BUILT from the export rather than typed as a literal followed by
// a colon, for the same reason conventions.md describes the fields in prose: the
// harvest scans this tracked file, and a literal marker here would be collected
// as a real one. That is the property `debt-harvest: markers 0` over this repo
// asserts, and this file must not be what breaks it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { debtMarkersIn, renderDebtSection, DEBT_TOKEN } from './lib/debt-markers.mjs';

/** A marker line, assembled so this file contains no literal marker. */
const marker = (text, ceiling, trigger) => {
  const fields = [` ${text}`];
  if (ceiling !== null) fields.push(` ceiling: ${ceiling}`);
  if (trigger !== null) fields.push(` trigger: ${trigger}`);
  return `${DEBT_TOKEN}:${fields.join(' |')}`;
};

test('debtMarkersIn: a well-formed marker parses text, ceiling and trigger', () => {
  const text = `// ${marker('single-tenant only', 'no tenant column', 'the second tenant')}\n`;
  assert.deepEqual(debtMarkersIn(text), [{
    line: 1,
    text: 'single-tenant only',
    ceiling: 'no tenant column',
    trigger: 'the second tenant',
  }]);
});

test('debtMarkersIn: the token WITHOUT a colon is not a marker', () => {
  // This is what keeps documentation about the convention out of the harvest:
  // every prose mention names the token in backticks with no colon after it.
  assert.deepEqual(debtMarkersIn(`see \`${DEBT_TOKEN}\` in conventions.md\n`), []);
  assert.deepEqual(debtMarkersIn(`the ${DEBT_TOKEN} convention\n`), []);
});

test('debtMarkersIn: a marker missing trigger keeps the entry and NAMES the gap', () => {
  const m = debtMarkersIn(`# ${marker('no retry', 'a single attempt', null)}\n`);
  assert.equal(m.length, 1, 'an incomplete marker must never be dropped');
  assert.equal(m[0].ceiling, 'a single attempt');
  assert.equal(m[0].trigger, null);
  assert.deepEqual(m[0].malformed, ['trigger']);
});

test('debtMarkersIn: a marker missing both named fields names both', () => {
  const m = debtMarkersIn(`// ${marker('just a note', null, null)}\n`);
  assert.equal(m.length, 1);
  assert.deepEqual(m[0].malformed, ['ceiling', 'trigger']);
  assert.equal(m[0].text, 'just a note');
});

test('debtMarkersIn: two markers in one file keep their own line numbers', () => {
  const text = ['const a = 1;',
    `// ${marker('first', 'c1', 't1')}`,
    '',
    `/* ${marker('second', 'c2', 't2')} */`,
    ''].join('\n');
  const m = debtMarkersIn(text);
  assert.deepEqual(m.map((e) => [e.line, e.text]), [[2, 'first'], [4, 'second']]);
  // The block-comment closer is stripped off the last field, not carried into it.
  assert.equal(m[1].trigger, 't2');
});

test('debtMarkersIn: nothing to find is an empty array, never a throw', () => {
  assert.deepEqual(debtMarkersIn(''), []);
  assert.deepEqual(debtMarkersIn('ordinary source\n'), []);
  // @ts-expect-error - a non-string is a caller bug, and it degrades rather than throws
  assert.deepEqual(debtMarkersIn(null), []);
});

test('renderDebtSection: no markers renders the placeholder, not an empty body', () => {
  assert.equal(renderDebtSection([]), '- None.\n');
  // @ts-expect-error - same degradation as above
  assert.equal(renderDebtSection(undefined), '- None.\n');
});

test('renderDebtSection: bullets are ordered by path then line', () => {
  const body = renderDebtSection([
    { path: 'src/b.js', line: 2, text: 'b2', ceiling: 'c', trigger: 't' },
    { path: 'src/a.js', line: 9, text: 'a9', ceiling: 'c', trigger: 't' },
    { path: 'src/a.js', line: 3, text: 'a3', ceiling: 'c', trigger: 't' },
  ]);
  assert.deepEqual(body.trim().split('\n').map((l) => l.match(/`([^`]+)`/)[1]),
    ['src/a.js:3', 'src/a.js:9', 'src/b.js:2']);
});

test('renderDebtSection: an unstated field is VISIBLE in the queue', () => {
  const body = renderDebtSection([
    { path: 'a.js', line: 1, text: 'cut', ceiling: null, trigger: 't', malformed: ['ceiling'] },
  ]);
  assert.equal(body, '- `a.js:1` cut - ceiling: (unstated) - trigger: t\n');
});

test('renderDebtSection: the same markers render byte-identically', () => {
  const entries = [{ path: 'a.js', line: 1, text: 'cut', ceiling: 'c', trigger: 't' }];
  assert.equal(renderDebtSection(entries), renderDebtSection(entries.slice()));
});

test('debtMarkersIn: TWO markers on one line are two entries, neither wearing the other\'s fields', () => {
  // The regression a single `indexOf` caused, and the reason it was worse than a
  // dropped bullet: the field loop ran to the end of the LINE, so the second
  // marker's `ceiling`/`trigger` overwrote the first's and one entry came back
  // reporting another cut's ceiling. A wrong ceiling in the queue is a wrong
  // answer about real code.
  const one = marker('first cut', 'c1', 't1');
  const two = marker('second cut', 'c2', 't2');
  const found = debtMarkersIn(`// ${one} ${two}\n`);
  assert.equal(found.length, 2, JSON.stringify(found));
  assert.deepEqual(found.map((m) => m.text), ['first cut', 'second cut']);
  assert.deepEqual(found.map((m) => m.ceiling), ['c1', 'c2']);
  assert.deepEqual(found.map((m) => m.trigger), ['t1', 't2']);
  // Both are on the SAME source line, and both say so.
  assert.deepEqual(found.map((m) => m.line), [1, 1]);
});

test('debtMarkersIn: a second marker on the line does not lend the first its fields', () => {
  // The narrower shape: the first marker states nothing, so under the old parse
  // it silently inherited the second's ceiling and trigger and reported COMPLETE.
  const bare = `${DEBT_TOKEN}: bare cut`;
  const full = marker('stated cut', 'c2', 't2');
  const found = debtMarkersIn(`/* ${bare} ${full} */\n`);
  assert.equal(found.length, 2, JSON.stringify(found));
  assert.equal(found[0].text, 'bare cut');
  assert.equal(found[0].ceiling, null);
  assert.equal(found[0].trigger, null);
  assert.deepEqual(found[0].malformed, ['ceiling', 'trigger']);
  assert.equal(found[1].ceiling, 'c2');
  assert.equal(found[1].trigger, 't2');
});
