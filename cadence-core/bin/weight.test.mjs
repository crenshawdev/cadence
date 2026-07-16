// Zero-dep tests for weight.mjs (the context-weight seam). Run:
// node --test 'cadence-core/bin/*.test.mjs'
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
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

test('surface set is exactly agents/skills/workflows (D-02 narrowing)', () => {
  const paths = run(REPO).surfaces.map((s) => s.surface);
  assert.ok(paths.includes('agents/cad-planner.md'));
  assert.ok(paths.some((p) => /^skills\/.+\/SKILL\.md$/.test(p)));
  assert.ok(paths.some((p) => /^cadence-core\/workflows\/.+\.md$/.test(p)));
  // Excluded: self-verify's wider surface (references/templates/README).
  assert.ok(!paths.some((p) => p.startsWith('cadence-core/references/')));
  assert.ok(!paths.some((p) => p.startsWith('cadence-core/templates/')));
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
