// Zero-dep test for the ORDER of skills/cad-land/SKILL.md step 4 (phase 1 D-01).
// Run: node --test cadence-core/bin/land-order.test.mjs
//
// `land-cleanup.mjs cleanup` refuses a flag-shaped or unresolvable base with
// `action:"skip"`, `returnToBase:false`. That refusal only protects anything if
// the prose asks the seam BEFORE it hands the base to `git checkout`, so this
// reads the skill as text and pins the order, not the seam's answer (the seam's
// own tests pin that). Only node: builtins.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SKILL = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'skills', 'cad-land', 'SKILL.md');
const text = readFileSync(SKILL, 'utf8');

/** Step 4's text: from its numbered heading to the closing </process>. */
function step4() {
  const from = text.indexOf('4. **Terminal cleanup');
  const to = text.indexOf('</process>', from);
  assert.ok(from >= 0 && to > from, 'step 4 is found in the skill');
  return text.slice(from, to);
}

test('cad-land step 4: the base goes to land-cleanup before git checkout', () => {
  const s = step4();
  const cleanup = s.indexOf('land-cleanup.mjs" cleanup');
  const checkout = s.indexOf('git checkout');
  assert.ok(cleanup >= 0, 'step 4 calls land-cleanup cleanup');
  assert.ok(checkout >= 0, 'step 4 runs git checkout');
  assert.ok(cleanup < checkout, 'the first cleanup call precedes the first git checkout');
});

test('cad-land step 4: every cleanup call carries --base', () => {
  const calls = [...step4().matchAll(/land-cleanup\.mjs" cleanup([^`]*)`/g)];
  assert.ok(calls.length >= 2, 'a call before the checkout and the post-pull reap call');
  for (const [, flags] of calls) assert.match(flags, /--base\b/, `call "cleanup${flags}" carries --base`);
});

test('cad-land step 4: a skip or returnToBase:false runs no checkout', () => {
  const s = step4();
  assert.ok(s.includes('action:"skip"'), 'names the action:"skip" arm');
  assert.ok(s.includes('returnToBase:false'), 'names the returnToBase:false arm');
  assert.match(s.replace(/\s+/g, ' '), /no checkout, no pull, no tag and no reap/, 'states what a refused base runs');
});
