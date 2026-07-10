// Zero-dep tests for route.mjs. Run: node --test cadence-core/bin/
// Uses only node: builtins (no framework), matching the repo's zero-dep ethos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROUTE = join(dirname(fileURLToPath(import.meta.url)), 'route.mjs');
const dir = mkdtempSync(join(tmpdir(), 'cad-route-'));

// Write a config with the given model block and return its path.
function cfg(model) {
  const p = join(dir, `c-${Math.abs(JSON.stringify(model).length)}-${model.profile}-${(model.auto && model.auto.ceiling) || 'x'}.json`);
  writeFileSync(p, JSON.stringify({ model }));
  return p;
}

function resolve(role, file, extra = []) {
  const args = ['resolve', '--role', role, ...(file ? ['--file', file] : []), ...extra];
  return JSON.parse(execFileSync('node', [ROUTE, ...args], { encoding: 'utf8' }));
}

test('fixed profiles resolve the matrix per role tier', () => {
  const fast = cfg({ profile: 'fast' });
  assert.equal(resolve('cad-planner', fast).model, 'sonnet');   // heavy@fast
  assert.equal(resolve('cad-executor', fast).model, 'haiku');   // standard@fast
  assert.equal(resolve('cad-plan-checker', fast).model, 'haiku'); // light@fast

  const quality = cfg({ profile: 'quality' });
  assert.equal(resolve('cad-planner', quality).model, 'opus');
  assert.equal(resolve('cad-executor', quality).model, 'opus');
  assert.equal(resolve('cad-plan-checker', quality).model, 'sonnet');
});

test('fixed profile never escalates even at attempt 3 (explicit pick wins)', () => {
  const balanced = cfg({ profile: 'balanced' });
  const r = resolve('cad-planner', balanced, ['--attempt', '3']);
  assert.equal(r.escalated, false);
  assert.equal(r.profile, 'balanced');
});

test('auto: clean run uses base profile, no escalation', () => {
  const a = cfg({ profile: 'auto', auto: { ceiling: 'quality', escalate_on_failure: true, max_escalations: 1 } });
  const r = resolve('cad-planner', a);
  assert.equal(r.escalated, false);
  assert.equal(r.profile, 'balanced');
  assert.equal(r.model, 'opus'); // heavy@balanced
});

test('auto: difficulty signal bumps tier (standard -> heavy)', () => {
  const a = cfg({ profile: 'auto', auto: { ceiling: 'quality', escalate_on_failure: true, max_escalations: 1 } });
  const r = resolve('cad-executor', a, ['--files', '30']);
  assert.equal(r.tier, 'heavy');
  assert.equal(r.model, 'opus'); // heavy@balanced
  assert.equal(r.escalated, true);
});

test('auto: failure escalates profile toward ceiling and swaps effort-variant', () => {
  const a = cfg({ profile: 'auto', auto: { ceiling: 'quality', escalate_on_failure: true, max_escalations: 1 } });
  const r = resolve('cad-plan-checker', a, ['--attempt', '2']);
  assert.equal(r.profile, 'quality');
  assert.equal(r.agent, 'cad-plan-checker-high'); // effort-variant swap
  assert.equal(r.model, 'sonnet'); // light@quality
});

test('auto: max_escalations caps the profile step', () => {
  const a = cfg({ profile: 'auto', auto: { ceiling: 'quality', escalate_on_failure: true, max_escalations: 1 } });
  // attempt 3 would be 2 steps, but max is 1 -> still one step from balanced
  const r = resolve('cad-planner', a, ['--attempt', '3']);
  assert.equal(r.profile, 'quality'); // balanced -> quality is one step; capped there
});

test('auto: escalate_on_failure=false disables failure escalation', () => {
  const a = cfg({ profile: 'auto', auto: { ceiling: 'quality', escalate_on_failure: false, max_escalations: 3 } });
  const r = resolve('cad-planner', a, ['--attempt', '3']);
  assert.equal(r.escalated, false);
  assert.equal(r.profile, 'balanced');
});

test('auto: ceiling below base clamps down, never above ceiling', () => {
  const a = cfg({ profile: 'auto', auto: { ceiling: 'fast', escalate_on_failure: true, max_escalations: 3 } });
  const r = resolve('cad-planner', a, ['--attempt', '2']);
  assert.equal(r.profile, 'fast'); // clamped to ceiling
  assert.equal(r.model, 'sonnet'); // heavy@fast
});

test('unknown role degrades to ok:false (caller falls back to session default)', () => {
  const balanced = cfg({ profile: 'balanced' });
  const r = resolve('cad-nope', balanced);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'unknown-role');
});

test('missing config file uses schema defaults, does not crash', () => {
  const r = resolve('cad-planner', join(dir, 'does-not-exist.json'));
  assert.equal(r.ok, true);
  assert.equal(r.profile, 'balanced');
  assert.match(r.reason.join(' '), /config:defaults/);
});
