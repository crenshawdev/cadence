// Zero-dep tests for weight.mjs (the context-weight seam). Run:
// node --test 'cadence-core/bin/*.test.mjs'
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEIGHT = join(HERE, 'weight.mjs');
const REPO = join(HERE, '..', '..');

/** Run weight.mjs against a root, returning the raw stdout string. */
function raw(root) {
  return execFileSync('node', [WEIGHT, '--root', root], { encoding: 'utf8' });
}
/** Run weight.mjs against a root, returning parsed JSON. */
function run(root) {
  return JSON.parse(raw(root));
}

test('shape: ok true, non-empty surfaces with typed fields', () => {
  const j = run(REPO);
  assert.equal(j.ok, true);
  assert.ok(Array.isArray(j.surfaces) && j.surfaces.length > 0);
  for (const s of j.surfaces) {
    assert.equal(typeof s.surface, 'string');
    assert.equal(typeof s.bytes, 'number');
    assert.equal(typeof s.estTokens, 'number');
  }
});

test('surface set is agents, skills, workflows plus references/** and templates/** (D-01)', () => {
  const paths = run(REPO).surfaces.map((s) => s.surface);
  assert.ok(paths.includes('agents/cad-planner.md'));
  assert.ok(paths.some((p) => /^skills\/.+\/SKILL\.md$/.test(p)));
  assert.ok(paths.some((p) => /^cadence-core\/workflows\/.+\.md$/.test(p)));
  // Widened by D-01: both directories are walked whole, so a reference that
  // grows fails the budget the same way a workflow does.
  assert.ok(paths.some((p) => p.startsWith('cadence-core/references/')));
  assert.ok(paths.some((p) => p.startsWith('cadence-core/templates/')));
  // And by EVERY file, not just `.md` - a JSON reference is budgeted too.
  assert.ok(paths.includes('cadence-core/references/model-hints.json'));
  // Still excluded: README is on self-verify's lint walk, not the weighed one.
  assert.ok(!paths.includes('README.md'));
});

test('determinism: two runs on the same tree are byte-identical', () => {
  assert.equal(raw(REPO), raw(REPO));
});

test('empty tree: no surface dirs yields ok true and surfaces []', () => {
  const root = mkdtempSync(join(tmpdir(), 'cad-weight-empty-'));
  const j = run(root);
  assert.equal(j.ok, true);
  assert.deepEqual(j.surfaces, []);
});

test('#49.1: a dangling symlink or symlink cycle under a measured surface is skipped, not thrown', () => {
  const root = mkdtempSync(join(tmpdir(), 'cad-weight-symlink-'));
  mkdirSync(join(root, 'agents'), { recursive: true });
  mkdirSync(join(root, 'skills', 'x'), { recursive: true });
  mkdirSync(join(root, 'skills', 'y'), { recursive: true });
  mkdirSync(join(root, 'cadence-core', 'workflows'), { recursive: true });
  // One readable control per walker branch, so a regression where the new
  // catch-all wrapper swallows an ENTIRE tree (returning [] for all of
  // skills or all of workflows) is caught - with only agents/good.md present
  // that regression would pass this test unnoticed.
  writeFileSync(join(root, 'agents', 'good.md'), 'agent body');
  writeFileSync(join(root, 'skills', 'y', 'SKILL.md'), 'skill body');
  writeFileSync(join(root, 'cadence-core', 'workflows', 'good.md'), 'workflow body');
  // One dangling/cycle symlink per stat site.
  symlinkSync('nowhere.md', join(root, 'agents', 'dangling.md'));
  symlinkSync('b.md', join(root, 'agents', 'a.md'));
  symlinkSync('a.md', join(root, 'agents', 'b.md'));
  symlinkSync('nowhere.md', join(root, 'skills', 'x', 'SKILL.md'));
  symlinkSync('nowhere.md', join(root, 'cadence-core', 'workflows', 'w.md'));

  const j = run(root);
  assert.equal(j.ok, true);
  assert.deepEqual(Object.keys(j).sort(), ['checked', 'ok', 'surfaces']);
  assert.deepEqual(j.surfaces.map((s) => s.surface).sort(), [
    'agents/good.md',
    'cadence-core/workflows/good.md',
    'skills/y/SKILL.md',
  ]);
});

test('BUD-02: an unreadable sibling directory hides only itself', {
  skip:
    typeof process.getuid === 'function' && process.getuid() === 0
      ? 'root bypasses mode bits'
      : false,
}, () => {
  const root = mkdtempSync(join(tmpdir(), 'cad-weight-unreadable-'));
  mkdirSync(join(root, 'skills', 'good'), { recursive: true });
  writeFileSync(join(root, 'skills', 'good', 'SKILL.md'), 'good skill body');
  const priv = join(root, 'skills', 'private');
  mkdirSync(priv);
  chmodSync(priv, 0o000);
  try {
    const j = run(root);
    assert.equal(j.ok, true);
    assert.ok(j.surfaces.map((s) => s.surface).includes('skills/good/SKILL.md'));
  } finally {
    chmodSync(priv, 0o755);
  }
});

test('D-07: a symlinked directory is not descended, so a cycle counts one surface', () => {
  const root = mkdtempSync(join(tmpdir(), 'cad-weight-dircycle-'));
  mkdirSync(join(root, 'skills', 'a'), { recursive: true });
  writeFileSync(join(root, 'skills', 'a', 'SKILL.md'), 'x');
  symlinkSync('..', join(root, 'skills', 'a', 'loop'));
  assert.deepEqual(
    run(root).surfaces.map((s) => s.surface),
    ['skills/a/SKILL.md'],
  );
});

test('a symlinked branch ROOT is descended (the qualified half of D-07)', () => {
  const root = mkdtempSync(join(tmpdir(), 'cad-weight-linkroot-'));
  mkdirSync(join(root, 'skills-real', 'a'), { recursive: true });
  writeFileSync(join(root, 'skills-real', 'a', 'SKILL.md'), 'y');
  symlinkSync('skills-real', join(root, 'skills'));
  assert.ok(run(root).surfaces.map((s) => s.surface).includes('skills/a/SKILL.md'));
});

test('chars/4: estTokens and bytes match the measurement proxy', () => {
  const root = mkdtempSync(join(tmpdir(), 'cad-weight-chars-'));
  mkdirSync(join(root, 'cadence-core', 'workflows'), { recursive: true });
  const body = 'abcdefghij'; // length 10 -> ceil(10/4) = 3
  writeFileSync(join(root, 'cadence-core', 'workflows', 'w.md'), body);
  const s = run(root).surfaces;
  assert.equal(s.length, 1);
  assert.equal(s[0].surface, 'cadence-core/workflows/w.md');
  assert.equal(s[0].estTokens, Math.ceil(body.length / 4));
  assert.equal(s[0].bytes, Buffer.byteLength(body, 'utf8'));
});
