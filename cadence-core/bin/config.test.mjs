// Zero-dep tests for config.mjs. Run: node --test 'cadence-core/bin/*.test.mjs'
// Only node: builtins, matching the repo's zero-dep ethos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const CONFIG = join(dirname(fileURLToPath(import.meta.url)), 'config.mjs');
const dir = mkdtempSync(join(tmpdir(), 'cad-config-'));

// Run config.mjs with a controlled global-config path; returns parsed JSON
// line. Degraded results exit 1 (seam convention), so catch and parse stdout.
function run(args, globalPath) {
  const env = { ...process.env };
  if (globalPath) env.CADENCE_GLOBAL_CONFIG = globalPath;
  try {
    return JSON.parse(execFileSync('node', [CONFIG, ...args], { encoding: 'utf8', env }));
  } catch (e) {
    return JSON.parse(e.stdout);
  }
}

test('set --global auto-creates the global file (and parent dir) from empty', () => {
  const gpath = join(dir, 'nested', 'cadence', 'config.json'); // parent dirs absent
  assert.equal(existsSync(gpath), false);
  const r = run(['set', '--global', 'model.profile=quality'], gpath);
  assert.equal(r.ok, true);
  assert.equal(r.file, gpath);
  const written = JSON.parse(readFileSync(gpath, 'utf8'));
  assert.equal(written.model.profile, 'quality');
});

test('set --global merges into an existing global file, not clobber', () => {
  const gpath = join(dir, 'existing.json');
  writeFileSync(gpath, JSON.stringify({ model: { profile: 'fast' }, granularity: 'coarse' }));
  const r = run(['set', '--global', 'model.auto.ceiling=quality'], gpath);
  assert.equal(r.ok, true);
  const written = JSON.parse(readFileSync(gpath, 'utf8'));
  assert.equal(written.model.profile, 'fast');     // preserved
  assert.equal(written.granularity, 'coarse');     // preserved
  assert.equal(written.model.auto.ceiling, 'quality'); // added
});

test('set --global still validates: a bad value is rejected, nothing written', () => {
  const gpath = join(dir, 'reject.json');
  const r = run(['set', '--global', 'model.profile=nonsense'], gpath);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'invalid');
  assert.equal(existsSync(gpath), false); // atomic: no partial write
});

test('validate --global reads the global file', () => {
  const gpath = join(dir, 'valid.json');
  writeFileSync(gpath, JSON.stringify({ model: { profile: 'balanced' } }));
  const r = run(['validate', '--global'], gpath);
  assert.equal(r.ok, true);
  assert.equal(r.file, gpath);
});

// --- get: the layered effective read ------------------------------------------

test('get: repo > global > schema defaults, with source named', () => {
  const gpath = join(dir, 'get-global.json');
  writeFileSync(gpath, JSON.stringify({ model: { profile: 'quality' }, workflow: { research: true } }));
  const repo = join(dir, 'get-repo.json');
  writeFileSync(repo, JSON.stringify({ model: { profile: 'fast' } }));
  const r = run(['get', '--file', repo, 'model.profile', 'workflow.research', 'workflow.plan_check'], gpath);
  assert.equal(r.ok, true);
  assert.equal(r.values['model.profile'], 'fast');        // repo wins
  assert.equal(r.values['workflow.research'], true);      // global fills
  assert.equal(r.values['workflow.plan_check'], true);    // schema default
  assert.equal(r.source, 'global+repo');
});

test('get: no layers at all falls back to schema defaults for every key', () => {
  const r = run(['get', '--file', join(dir, 'absent.json')], join(dir, 'also-absent.json'));
  assert.equal(r.ok, true);
  assert.equal(r.source, 'defaults');
  assert.equal(r.values['git.on_protected'], 'ask');
  assert.deepEqual(r.values['git.protected_branches'], ['main', 'master']);
});

test('get: unknown key is rejected, exit code mirrors ok', () => {
  const r = run(['get', '--file', join(dir, 'absent.json'), 'no.such.key'], join(dir, 'no-g.json'));
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'unknown-key');
});

// --- cross-key warnings ---------------------------------------------------

test('check: ceiling at/below the auto base profile warns but stays valid', () => {
  for (const ceiling of ['fast', 'balanced']) {
    const r = run(['check', `model.auto.ceiling=${ceiling}`]);
    assert.equal(r.ok, true); // legal value - advisory only
    assert.equal(r.warnings.length, 1);
    assert.match(r.warnings[0].warning, /never demotes/);
  }
  const ok = run(['check', 'model.auto.ceiling=quality']);
  assert.equal(ok.ok, true);
  assert.equal(ok.warnings, undefined); // above base - no warning
});

test('set: the ceiling warning rides along with a successful write', () => {
  const gpath = join(dir, 'warn.json');
  const r = run(['set', '--global', 'model.auto.ceiling=fast'], gpath);
  assert.equal(r.ok, true);
  assert.equal(JSON.parse(readFileSync(gpath, 'utf8')).model.auto.ceiling, 'fast');
  assert.match(r.warnings[0].warning, /holds at base/);
});
