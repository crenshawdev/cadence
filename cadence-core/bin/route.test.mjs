// Zero-dep tests for route.mjs. Run: node --test 'cadence-core/bin/*.test.mjs'
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

// A global-config path that does not exist, so tests are hermetic by default
// (never read the dev's real ~/.claude/cadence/config.json).
const NO_GLOBAL = join(dir, 'no-global.json');

// Write a config with the given model block and return its path.
function cfg(model, name) {
  const p = join(dir, name || `c-${Math.abs(JSON.stringify(model).length)}-${model.profile}-${(model.auto && model.auto.ceiling) || 'x'}.json`);
  writeFileSync(p, JSON.stringify({ model }));
  return p;
}

// resolve() defaults to an isolated (missing) global layer; pass opts.global to
// point CADENCE_GLOBAL_CONFIG at a real global file for merge tests.
function resolve(role, file, extra = [], opts = {}) {
  const args = ['resolve', '--role', role, ...(file ? ['--file', file] : []), ...extra];
  const env = { ...process.env, CADENCE_GLOBAL_CONFIG: opts.global || NO_GLOBAL };
  try {
    return JSON.parse(execFileSync('node', [ROUTE, ...args], { encoding: 'utf8', env }));
  } catch (e) {
    // Degraded results exit 1 (seam convention); the JSON line is on stdout.
    return JSON.parse(e.stdout);
  }
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

// --- global config layer -----------------------------------------------------

test('global layer applies when no repo config is present', () => {
  const g = cfg({ profile: 'quality' }, 'g-quality.json');
  const r = resolve('cad-planner', join(dir, 'no-repo.json'), [], { global: g });
  assert.equal(r.profile, 'quality');
  assert.equal(r.model, 'opus'); // heavy@quality
  assert.match(r.reason.join(' '), /config:global/);
});

test('repo config overrides the global layer (repo wins)', () => {
  const g = cfg({ profile: 'quality' }, 'g-quality2.json');
  const repo = cfg({ profile: 'fast' }, 'repo-fast.json');
  const r = resolve('cad-planner', repo, [], { global: g });
  assert.equal(r.profile, 'fast'); // repo wins over global
  assert.equal(r.model, 'sonnet'); // heavy@fast
  assert.match(r.reason.join(' '), /config:global\+repo/);
});

test('layers deep-merge: global auto block + repo profile combine', () => {
  const g = cfg({ profile: 'balanced', auto: { ceiling: 'quality', escalate_on_failure: true, max_escalations: 1 } }, 'g-auto.json');
  const repo = cfg({ profile: 'auto' }, 'repo-auto.json'); // only overrides profile
  // repo sets auto profile; global supplies the auto.* sub-keys -> escalation works
  const r = resolve('cad-plan-checker', repo, ['--attempt', '2'], { global: g });
  assert.equal(r.profile, 'quality'); // escalated using global's ceiling
  assert.equal(r.agent, 'cad-plan-checker-high');
});
