// Zero-dep tests for release-bump.mjs (the release-bump I/O seam). Run:
// node --test 'cadence-core/bin/*.test.mjs'. Fixture style mirrors
// land-cleanup.test.mjs: a temp repo root with a .claude-plugin manifest set, a
// root CHANGELOG.md, and a .planning fixture, driven through the seam with an
// explicit --date so no clock or live git is needed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SEAM = join(dirname(fileURLToPath(import.meta.url)), 'release-bump.mjs');
// Hermetic global config (never read the dev's real ~/.claude one).
const NO_GLOBAL = join(mkdtempSync(join(tmpdir(), 'cad-rb-')), 'no-global.json');

const PLUGIN_1_0_0 = {
  name: 'cadence',
  description: 'a plugin',
  version: '1.0.0',
  author: { name: 'John Crenshaw' },
  homepage: 'https://github.com/crenshawdev/cadence',
  repository: 'https://github.com/crenshawdev/cadence.git',
  license: 'MIT',
  keywords: ['planning', 'git'],
};

const MARKETPLACE = {
  name: 'cadence',
  owner: { name: 'John Crenshaw' },
  plugins: [{ name: 'cadence', source: './', description: 'a plugin' }],
};

const CHANGELOG = [
  '# Changelog',
  '',
  'All notable changes are recorded here.',
  '',
  '## [1.0.0] - 2026-07-16',
  '',
  'First public release.',
  '',
  '[1.0.0]: https://github.com/crenshawdev/cadence/releases',
  '',
].join('\n');

/**
 * A repo-root fixture. `opts.plugin` (default the 1.0.0 manifest) may be null to
 * omit plugin.json; `opts.activeVersion` sets the PROJECT.md `### Active` token
 * (null omits any version so nothing is derivable); `opts.changelog`/`marketplace`
 * default to the fixtures above.
 */
function fixture(opts = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'cad-rb-repo-'));
  mkdirSync(join(dir, '.claude-plugin'), { recursive: true });
  mkdirSync(join(dir, '.planning'), { recursive: true });
  const plugin = 'plugin' in opts ? opts.plugin : PLUGIN_1_0_0;
  if (plugin !== null) {
    writeFileSync(join(dir, '.claude-plugin', 'plugin.json'), JSON.stringify(plugin, null, 2) + '\n');
  }
  if (opts.marketplace !== null) {
    writeFileSync(join(dir, '.claude-plugin', 'marketplace.json'), JSON.stringify(MARKETPLACE, null, 2) + '\n');
  }
  if (opts.changelog !== null) {
    writeFileSync(join(dir, 'CHANGELOG.md'), opts.changelog || CHANGELOG);
  }
  const active = 'activeVersion' in opts ? opts.activeVersion : 'v1.1.0-rc.2';
  const activeBody = active ? `\`${active}\` - the round\n` : 'no version this cycle\n';
  writeFileSync(join(dir, '.planning', 'PROJECT.md'),
    `## Requirements\n### Active\n\n${activeBody}\n### Out of Scope\n`);
  return dir;
}

/** Run the release-bump seam against a fixture. */
function seam(args) {
  const env = { ...process.env, CADENCE_GLOBAL_CONFIG: NO_GLOBAL };
  try {
    return JSON.parse(execFileSync('node', [SEAM, ...args], { encoding: 'utf8', env }));
  } catch (e) {
    return JSON.parse(e.stdout);
  }
}

const readJson = (f) => JSON.parse(readFileSync(f, 'utf8'));
const readRaw = (f) => readFileSync(f, 'utf8');

// --- bump -------------------------------------------------------------------

test('bump: rewrites only version, preserves every other field, scaffolds changelog', () => {
  const dir = fixture();
  const marketBefore = readRaw(join(dir, '.claude-plugin', 'marketplace.json'));
  const r = seam(['bump', '--dir', dir, '--date', '2026-07-17']);
  assert.equal(r.ok, true);
  assert.equal(r.action, 'bumped');
  assert.equal(r.target, '1.1.0-rc.2');
  assert.equal(r.manifest.bumped, true);
  assert.equal(r.changelog.changed, true);

  // Manifest: version bumped, every other field byte-equal to the original.
  const after = readJson(join(dir, '.claude-plugin', 'plugin.json'));
  assert.equal(after.version, '1.1.0-rc.2');
  assert.deepEqual({ ...after, version: '1.0.0' }, PLUGIN_1_0_0);

  // marketplace.json carries no version: left byte-unchanged (D-03).
  assert.equal(readRaw(join(dir, '.claude-plugin', 'marketplace.json')), marketBefore);

  // CHANGELOG: new heading + link reference above the [1.0.0] entry, which is
  // left unaltered.
  const cl = readRaw(join(dir, 'CHANGELOG.md'));
  assert.match(cl, /## \[1\.1\.0-rc\.2\] - 2026-07-17/);
  assert.ok(cl.indexOf('## [1.1.0-rc.2]') < cl.indexOf('## [1.0.0]'));
  assert.match(cl, /^\[1\.1\.0-rc\.2\]: https:\/\/github\.com\/crenshawdev\/cadence\/releases\/tag\/v1\.1\.0-rc\.2$/m);
  assert.ok(cl.indexOf('[1.1.0-rc.2]:') < cl.indexOf('[1.0.0]:'));
  assert.ok(cl.includes('## [1.0.0] - 2026-07-16'));
  assert.ok(cl.includes('[1.0.0]: https://github.com/crenshawdev/cadence/releases\n'));
});

test('bump: a second run is a noop, plugin.json and CHANGELOG byte-identical (no double-bump)', () => {
  const dir = fixture();
  seam(['bump', '--dir', dir, '--date', '2026-07-17']);
  const pluginAfterFirst = readRaw(join(dir, '.claude-plugin', 'plugin.json'));
  const clAfterFirst = readRaw(join(dir, 'CHANGELOG.md'));

  const r = seam(['bump', '--dir', dir, '--date', '2026-07-17']);
  assert.equal(r.action, 'noop');
  assert.equal(r.manifest.bumped, false);
  assert.equal(r.changelog.changed, false);
  assert.equal(readRaw(join(dir, '.claude-plugin', 'plugin.json')), pluginAfterFirst);
  assert.equal(readRaw(join(dir, 'CHANGELOG.md')), clAfterFirst);
});

test('bump: no plugin.json -> skip, nothing written', () => {
  const dir = fixture({ plugin: null });
  const r = seam(['bump', '--dir', dir, '--date', '2026-07-17']);
  assert.equal(r.ok, true);
  assert.equal(r.action, 'skip');
  assert.equal(r.reason, 'no-plugin-manifest');
});

test('bump: plugin.json present but no derivable version -> error, no [null] heading, nothing written', () => {
  // ### Active names no version, no ROADMAP.md, no --version: target is null.
  const dir = fixture({ activeVersion: null });
  const pluginBefore = readRaw(join(dir, '.claude-plugin', 'plugin.json'));
  const clBefore = readRaw(join(dir, 'CHANGELOG.md'));

  const r = seam(['bump', '--dir', dir, '--date', '2026-07-17']);
  assert.equal(r.action, 'error');
  assert.equal(r.reason, 'no-target-version');
  // Both files byte-unchanged; no `## [null]` heading ever scaffolded.
  assert.equal(readRaw(join(dir, '.claude-plugin', 'plugin.json')), pluginBefore);
  assert.equal(readRaw(join(dir, 'CHANGELOG.md')), clBefore);
  assert.ok(!readRaw(join(dir, 'CHANGELOG.md')).includes('[null]'));
});

test('bump: --version overrides the derived target and strips a leading v', () => {
  const dir = fixture({ activeVersion: null });
  const r = seam(['bump', '--dir', dir, '--version', 'v2.0.0', '--date', '2026-07-17']);
  assert.equal(r.action, 'bumped');
  assert.equal(r.target, '2.0.0');
  assert.equal(readJson(join(dir, '.claude-plugin', 'plugin.json')).version, '2.0.0');
});

test('unknown subcommand: usage, ok false', () => {
  const r = seam(['frobnicate']);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'usage');
});
