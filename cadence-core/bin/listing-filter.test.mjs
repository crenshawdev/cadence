// @ts-check
// Tests for lib/listing-filter.mjs, run on listings captured from 2.1.289
// (fixtures/listing.*.json). Each expected answer is the fixture's lines with
// named line indexes taken out, never a second copy of the rule.
'use strict';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { filterListing, LISTING_TYPES, AGENT_LISTING, SKILL_LISTING } from './lib/listing-filter.mjs';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

/** A captured listing fixture: its `type` and `text`. */
const fixture = (/** @type {string} */ name) =>
  /** @type {{type: string, text: string}} */ (JSON.parse(readFileSync(join(FIXTURES, name), 'utf8')));

const AGENTS = fixture('listing.agent_listing_delta.json');
const SKILLS = fixture('listing.skill_listing.json');
const AGENTS_MULTI = fixture('listing.agent_listing_delta.multiline.json');
const SKILLS_MULTI = fixture('listing.skill_listing.multiline.json');

/** The indexes of `lines` that `pick` selects. */
const indexes = (/** @type {string[]} */ lines, /** @type {(l: string) => boolean} */ pick) =>
  lines.flatMap((l, i) => (pick(l) ? [i] : []));

/** `lines` without the indexes in `drop`, joined back. */
const without = (/** @type {string[]} */ lines, /** @type {number[]} */ drop) =>
  lines.filter((_, i) => !drop.includes(i)).join('\n');

const isContractHead = (/** @type {string} */ l) => /^- cadence:[^:]*-contract(: |$)/.test(l);

test('the fixtures are the shapes the tests below rely on', () => {
  assert.equal(AGENTS.type, AGENT_LISTING);
  assert.equal(SKILLS.type, SKILL_LISTING);
  const a = AGENTS.text.split('\n');
  assert.equal(indexes(a, (l) => l.startsWith('- cadence:')).length, 30);
  assert.equal(indexes(a, (l) => l.startsWith('- ') && !l.startsWith('- cadence:')).length, 5);
  assert.equal(indexes(SKILLS.text.split('\n'), isContractHead).length, 6);
});

test('real agent listing: exactly the 30 cadence: entries go', () => {
  const lines = AGENTS.text.split('\n');
  const drop = indexes(lines, (l) => l.startsWith('- cadence:'));
  const got = filterListing(AGENT_LISTING, AGENTS.text);
  assert.equal(got, without(lines, drop));
  const kept = got.split('\n');
  assert.equal(kept[0], lines[0]);
  assert.deepEqual(kept.slice(1, 6), lines.filter((l) => l.startsWith('- ') && !l.startsWith('- cadence:')));
  assert.deepEqual(kept.slice(-2), lines.slice(-2), 'the empty line and the trailer');
  assert.equal(kept.at(-2), '');
});

test('real skill listing: exactly the six contract heads go, the 28 commands and claude-api stay', () => {
  const lines = SKILLS.text.split('\n');
  const drop = indexes(lines, isContractHead);
  const got = filterListing(SKILL_LISTING, SKILLS.text);
  assert.equal(got, without(lines, drop));
  const kept = got.split('\n');
  assert.equal(kept.filter((l) => l.startsWith('- cadence:')).length, 28);
  const api = lines.indexOf('- claude-api: redacted host description');
  assert.ok(api > 0);
  const apiLines = lines.slice(api, api + 3);
  assert.equal(apiLines[1], 'redacted host description');
  const at = kept.indexOf(apiLines[0]);
  assert.deepEqual(kept.slice(at, at + 3), apiLines);
});

test('multi-line agent: the two-line target goes whole, every other line stays', () => {
  const lines = AGENTS_MULTI.text.split('\n');
  const head = lines.findIndex((l) => l.startsWith('- cadence:cad-reviewer-low: '));
  assert.ok(!lines[head + 1].startsWith('- ') && lines[head + 1] !== '', 'the fixture holds a continuation line');
  const drop = [...indexes(lines, (l) => l.startsWith('- cadence:')), head + 1];
  assert.equal(filterListing(AGENT_LISTING, AGENTS_MULTI.text), without(lines, drop));
});

test('multi-line skill: the two-line contract goes whole, the other five go, every other line stays', () => {
  const lines = SKILLS_MULTI.text.split('\n');
  const head = lines.findIndex((l) => l.startsWith('- cadence:cad-reviewer-contract: '));
  assert.ok(!lines[head + 1].startsWith('- ') && lines[head + 1] !== '', 'the fixture holds a continuation line');
  const drop = [...indexes(lines, isContractHead), head + 1];
  assert.equal(drop.length, 7);
  assert.equal(filterListing(SKILL_LISTING, SKILLS_MULTI.text), without(lines, drop));
});

test('a cadence: entry just before the empty line still leaves the empty line and trailer', () => {
  const lines = AGENTS.text.split('\n');
  const moved = lines[1];
  assert.ok(moved.startsWith('- cadence:'));
  const empty = lines.indexOf('');
  const derived = [...lines.slice(0, 1), ...lines.slice(2, empty), moved, ...lines.slice(empty)];
  const got = filterListing(AGENT_LISTING, derived.join('\n'));
  assert.equal(got, without(derived, indexes(derived, (l) => l.startsWith('- cadence:'))));
  assert.deepEqual(got.split('\n').slice(-2), lines.slice(-2));
});

test('a name-only entry is judged by its name: bare contracts go, a bare command stays', () => {
  const lines = SKILLS.text.split('\n');
  const bare = (/** @type {string} */ l) => l.slice(0, l.indexOf(': '));
  const derived = lines.map((l) => (isContractHead(l) || l.startsWith('- cadence:cad-plan: ') ? bare(l) : l));
  const contracts = indexes(derived, (l) => /^- cadence:[^:]*-contract$/.test(l));
  assert.equal(contracts.length, 6);
  assert.ok(derived.includes('- cadence:cad-plan'));
  const got = filterListing(SKILL_LISTING, derived.join('\n'));
  assert.equal(got, without(derived, contracts));
  assert.ok(got.split('\n').includes('- cadence:cad-plan'));

  const agents = AGENTS.text.split('\n');
  const cut = agents.map((l, i) => (i === 3 ? bare(l) : l));
  assert.ok(/^- cadence:[^ ]+$/.test(cut[3]));
  assert.equal(filterListing(AGENT_LISTING, cut.join('\n')), without(cut, indexes(cut, (l) => l.startsWith('- cadence:'))));
});

test('any other attachment type comes back strictly equal', () => {
  const text = 'context:\n- cadence:cad-reviewer-low: x\n- cadence:cad-reviewer-contract: y\n';
  for (const type of ['hook_additional_context', 'environment', 'a_type_nobody_sent']) {
    assert.equal(filterListing(type, text), text);
  }
});

test('it exports exactly the two type names, and the same input answers the same text', () => {
  assert.deepEqual([...LISTING_TYPES], ['agent_listing_delta', 'skill_listing']);
  assert.ok(Object.isFrozen(LISTING_TYPES));
  for (const f of [AGENTS, SKILLS, AGENTS_MULTI, SKILLS_MULTI]) {
    assert.equal(filterListing(f.type, f.text), filterListing(f.type, f.text));
  }
});
