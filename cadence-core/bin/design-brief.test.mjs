// Structural tests over the committed design-brief fixture.
// Run: node --test cadence-core/bin/design-brief.test.mjs
// Only node: builtins, per the repo's zero-dep ethos.
//
// `fixtures/verbatim.design-brief.md` is verbatim's own design brief, copied
// byte-for-byte out of a project that arrived at Cadence with a freeform
// discovery conversation already behind it, on the precedent
// `fixtures/verbatim.trace.jsonl` set. It is the ground under `--brief`'s
// suppression rule: that rule keys off what a brief SAYS, never off a marker
// convention, and this fixture is the measurement that argument rests on.
//
// What is asserted here is STRUCTURE ONLY (D-09): the open-item table, and the
// two `OPEN` occurrences. NOTHING about the question set a `--brief` run asks -
// a test over questions goes red on rewording rather than on behaviour, and the
// walked judgment is where that belongs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(HERE, 'fixtures', 'verbatim.design-brief.md');
const BRIEF = readFileSync(FIXTURE, 'utf8');

const HEADING = '## 17. Open items';

/** The lines under `## 17. Open items`, stopping at the next `## ` heading. */
function openItemsSection() {
  const lines = BRIEF.split('\n');
  const start = lines.findIndex((l) => l.trim() === HEADING);
  assert.notEqual(start, -1, `the fixture no longer carries a \`${HEADING}\` heading`);
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => l.startsWith('## '));
  return end === -1 ? rest : rest.slice(0, end);
}

/** `{item, status}` per data row of the first pipe table in those lines. */
function openItemRows() {
  return openItemsSection()
    .filter((l) => l.trim().startsWith('|'))
    // The header row and its `|---|---|` separator are not data.
    .filter((l) => !/^\|[\s:|-]+\|$/.test(l.trim()))
    .slice(1)
    .map((l) => {
      const cells = l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|');
      return { item: cells[0].trim(), status: (cells[1] ?? '').trim() };
    });
}

test('fixture: the brief carries a `## 17. Open items` heading', () => {
  assert.ok(BRIEF.includes(`\n${HEADING}\n`),
    `the fixture must carry \`${HEADING}\` on a line of its own`);
});

test('fixture: the open-items table has exactly five data rows', () => {
  assert.equal(openItemRows().length, 5);
});

test('fixture: the five open items are the ones the suppression rule was measured against', () => {
  const items = openItemRows().map((r) => r.item);
  // Substring anchors, not whole-cell equality: the cells carry backticks, an
  // em-dash and a size in parentheses, and re-punctuating one of those is not
  // the regression this guards.
  const expected = [
    'Auto-tuner',
    'UserPromptSubmit',
    '/data/verbatim-legacy',
    'Other harnesses',
    'Multi-machine sync',
  ];
  for (const [i, needle] of expected.entries()) {
    assert.ok(items[i]?.includes(needle),
      `open item ${i + 1} should name ${needle}; got ${JSON.stringify(items[i])}`);
  }
});

test('fixture: every open item states its status in PROSE, never as an `OPEN` marker', () => {
  // This is the row-level half of D-08. If these statuses were markers, keying
  // suppression off a marker convention would be defensible; they are prose, so
  // a reader that looked for `**OPEN**` would see this table as fully settled.
  for (const { item, status } of openItemRows()) {
    assert.ok(status.length > 0, `open item ${JSON.stringify(item)} has an empty Status cell`);
    assert.ok(!status.includes('OPEN'),
      `open item ${JSON.stringify(item)} states its status as a marker, not prose: ${status}`);
  }
});

test('fixture: the whole brief contains exactly two `OPEN` occurrences', () => {
  // The measurement D-08's rule rests on: one convention statement near the top
  // and one inline marker, against five table rows and four background items
  // the brief leaves open WITHOUT marking. Suppression keyed on this token would
  // read the brief as settled everywhere it is silent - BRF-01 inverted.
  const occurrences = BRIEF.match(/OPEN/g) ?? [];
  assert.equal(occurrences.length, 2);

  const marked = BRIEF.split('\n')
    .map((line, i) => ({ line, n: i + 1 }))
    .filter(({ line }) => line.includes('OPEN'));
  assert.equal(marked.length, 2, 'both occurrences are expected on lines of their own');
  assert.ok(marked[0].line.includes('settled unless marked'),
    'the first occurrence should be the convention statement');
  assert.ok(marked[1].line.startsWith('**OPEN'),
    'the second occurrence should be an inline marker opening its paragraph');
});
