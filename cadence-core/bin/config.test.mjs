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

// Run config.mjs with a controlled global-config path; returns parsed JSON line.
function run(args, globalPath) {
  const env = { ...process.env };
  if (globalPath) env.CADENCE_GLOBAL_CONFIG = globalPath;
  return JSON.parse(execFileSync('node', [CONFIG, ...args], { encoding: 'utf8', env }));
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
