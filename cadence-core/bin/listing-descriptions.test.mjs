// listing-descriptions.test.mjs - self-verify check 26's rule: a Cadence agent
// or contract-skill `description` or `when_to_use` that spans more than one
// line. Every case builds its own temp root; the live-tree expectations are
// read from the tree, never typed.
'use strict';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listingDescriptionIssues, MULTILINE_LISTING_TEXT } from './lib/listing-descriptions.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** A temp root holding exactly `files`, keyed by root-relative path. */
function root(files = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'cad-listing-desc-'));
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, rel)), { recursive: true });
    writeFileSync(join(dir, rel), text);
  }
  return dir;
}

/** Frontmatter holding `lines`, then a body. */
const fm = (...lines) => `---\n${lines.join('\n')}\n---\nbody\n`;

const AGENT = 'agents/cad-reviewer-low.md';
const CONTRACT = 'skills/cad-reviewer-contract/SKILL.md';

test('a one-line agent, a one-line quoted contract and an agent with no description are clean', () => {
  const dir = root({
    [AGENT]: fm('name: cad-reviewer-low', 'description: The `low` rung; route picks it.', 'tools: Read'),
    [CONTRACT]: fm('name: cad-reviewer-contract', 'description: "Internal role contract. Not a user command."', 'user-invocable: false'),
    'agents/cad-planner-low.md': fm('name: cad-planner-low', 'tools: Read'),
  });
  assert.deepEqual(listingDescriptionIssues(dir), []);
});

/** Each shape that spans more than one line, as the description's frontmatter lines. */
const SPANNING = {
  'literal block': ['description: |', '  line one', '  line two'],
  'folded block': ['description: >-', '  line one', '  line two'],
  'plain value continued': ['description: line one', '  line two'],
  'double quote closed on the next line': ['description: "line one', '  line two"'],
  'escaped line break': ['description: "line one\\nline two"'],
  'hex-escaped line break \\x0a': ['description: "line one\\x0aline two"'],
  'hex-escaped line break \\u000a': ['description: "line one\\u000aline two"'],
  'hex-escaped line break \\U0000000a': ['description: "line one\\U0000000aline two"'],
};

for (const [shape, lines] of Object.entries(SPANNING)) {
  for (const file of [AGENT, CONTRACT]) {
    test(`${shape} in ${file} is one issue naming the file`, () => {
      const dir = root({ [file]: fm('name: x', ...lines, 'tools: Read') });
      const issues = listingDescriptionIssues(dir);
      assert.equal(issues.length, 1, JSON.stringify(issues));
      assert.equal(issues[0].kind, MULTILINE_LISTING_TEXT);
      assert.equal(issues[0].file, file);
      assert.match(issues[0].detail, /`description`/);
    });
  }
}

test('a two-line when_to_use on a contract skill is one issue naming when_to_use', () => {
  const dir = root({
    [CONTRACT]: fm('name: cad-reviewer-contract', 'description: "One line."',
      'when_to_use: |', '  first', '  second', 'user-invocable: false'),
  });
  const issues = listingDescriptionIssues(dir);
  assert.equal(issues.length, 1, JSON.stringify(issues));
  assert.equal(issues[0].file, CONTRACT);
  assert.match(issues[0].detail, /`when_to_use`/);
});

test('a one-line when_to_use beside a one-line description is clean', () => {
  const dir = root({
    [CONTRACT]: fm('name: cad-reviewer-contract', 'description: "One line."',
      'when_to_use: when a rung agent starts', 'user-invocable: false'),
  });
  assert.deepEqual(listingDescriptionIssues(dir), []);
});

test('a one-line description followed by a comment line is clean', () => {
  // A comment line ends a plain scalar in YAML; it is not the value continued.
  const dir = root({
    [AGENT]: fm('name: cad-reviewer-low', 'description: one line', '# comment', 'tools: Read'),
    [CONTRACT]: fm('name: cad-reviewer-contract', 'description: one line', '  # comment',
      'user-invocable: false'),
  });
  assert.deepEqual(listingDescriptionIssues(dir), []);
});

test('a skill not ending -contract stays listed and is out of scope', () => {
  const dir = root({ 'skills/cad-plan/SKILL.md': fm('name: cad-plan', 'description: |', '  one', '  two') });
  assert.deepEqual(listingDescriptionIssues(dir), []);
});

test('a root with neither agents/ nor skills/ is clean', () => {
  assert.deepEqual(listingDescriptionIssues(root()), []);
});

test("the checkout's own reviewer agent and contract are clean, and each breaks on a two-line block", () => {
  const agent = readFileSync(join(REPO, AGENT), 'utf8');
  const contract = readFileSync(join(REPO, CONTRACT), 'utf8');
  assert.deepEqual(listingDescriptionIssues(root({ [AGENT]: agent, [CONTRACT]: contract })), []);

  const twoLines = (text) => {
    const out = text.replace(/^description: .*$/m, 'description: |\n  line one\n  line two');
    assert.notEqual(out, text, 'the copied file carries a one-line description to rewrite');
    return out;
  };
  for (const [file, text] of [[AGENT, agent], [CONTRACT, contract]]) {
    const issues = listingDescriptionIssues(root({ [file]: twoLines(text) }));
    assert.equal(issues.length, 1, JSON.stringify(issues));
    assert.equal(issues[0].file, file);
  }
});

test('the checkout itself is clean', () => {
  assert.deepEqual(listingDescriptionIssues(REPO), []);
});
