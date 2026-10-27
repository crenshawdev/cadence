// Zero-dep test for the ORDER of skills/cad-land/SKILL.md: no git command gets
// the base before the land-cleanup seam answered (phase 1 D-01).
// Run: node --test cadence-core/bin/land-order.test.mjs
//
// `land-cleanup.mjs cleanup` refuses a flag-shaped or unresolvable base with
// `action:"skip"`, `returnToBase:false`. That refusal only protects anything if
// the prose asks the seam BEFORE it hands the base to `git checkout`, so this
// reads the skill as text and pins the order, not the seam's answer (the seam's
// own tests pin that). The ask is made at step 1 for the whole skill - step 1's
// commits-ahead count is a `git log <base>..HEAD` - and again at step 4 before
// the checkout. Only node: builtins.
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

// Across the WHOLE skill, not step 4 alone: the first thing that hands the base
// to git is step 1's commits-ahead count, which the model spells as a range read
// (`git log <base>..HEAD` writes a file named by a `--output=` base).
test('cad-land: the first land-cleanup ask precedes every git use of the base, skill-wide', () => {
  const ask = text.indexOf('land-cleanup.mjs" cleanup');
  assert.ok(ask >= 0, 'the skill asks land-cleanup cleanup');
  const uses = [
    ['the commits-ahead count', text.indexOf('commits ahead of base')],
    ['the tracker call (issue-check reads git log <base>..HEAD)', text.indexOf('issue-check.mjs" check')],
    ['git checkout', text.indexOf('git checkout')],
    // any backticked git command that spells the base itself
    ...[...text.matchAll(/`git [^`\n]*<base>[^`\n]*`/g)].map((m) => [m[0], m.index]),
  ];
  for (const [what, at] of uses) {
    assert.ok(at >= 0, `${what} is present`);
    assert.ok(ask < at, `the seam is asked before ${what}`);
  }
});

test('cad-land step 1: a refused base withholds the git commands and the tracker call', () => {
  const from = text.indexOf('1. **Report git state');
  const to = text.indexOf('2. **Uncommitted changes');
  assert.ok(from >= 0 && to > from, 'step 1 is found in the skill');
  const s = text.slice(from, to).replace(/\s+/g, ' ');
  assert.ok(s.indexOf('land-cleanup.mjs" cleanup --base') >= 0, 'step 1 asks the seam with --base');
  assert.match(s, /baseRefused:true/, 'step 1 branches on the refusal field');
  assert.match(s, /run NO git command that takes it/, 'a refusal runs no git command on the base');
  assert.match(s, /skip the commits-ahead count and the tracker call/, 'a refusal skips the count and the tracker call');
});
