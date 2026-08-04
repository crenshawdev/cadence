// Zero-dep tests for release-bump.mjs (the release-bump I/O seam). Run:
// node --test 'cadence-core/bin/*.test.mjs'. Fixture style mirrors
// land-cleanup.test.mjs: a temp repo root with a .claude-plugin manifest set, a
// root CHANGELOG.md, and a .planning fixture, driven through the seam with an
// explicit --date so no clock or live git is needed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
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
 * (kept deliberately: it is the EVIDENCE that prose no longer supplies the
 * shipping number, not scaffolding); `opts.changelog`/`marketplace` default to
 * the fixtures above, null omits, and an object replaces (the sibling arm needs
 * a marketplace.json carrying a `version`, which the shipped one does not).
 */
function fixture(opts = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'cad-rb-repo-'));
  mkdirSync(join(dir, '.claude-plugin'), { recursive: true });
  mkdirSync(join(dir, '.planning'), { recursive: true });
  const plugin = 'plugin' in opts ? opts.plugin : PLUGIN_1_0_0;
  if (plugin !== null) {
    writeFileSync(join(dir, '.claude-plugin', 'plugin.json'), JSON.stringify(plugin, null, 2) + '\n');
  }
  const market = 'marketplace' in opts ? opts.marketplace : MARKETPLACE;
  if (market !== null) {
    writeFileSync(join(dir, '.claude-plugin', 'marketplace.json'), JSON.stringify(market, null, 2) + '\n');
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

/**
 * Same run, but keeping the EXIT STATUS: `seam()` catches the throw and parses
 * `e.stdout`, which discards the status the refusal envelope's whole contract
 * rests on (ok:false must mirror into exit 1).
 */
function seamStatus(args) {
  const env = { ...process.env, CADENCE_GLOBAL_CONFIG: NO_GLOBAL };
  const r = spawnSync('node', [SEAM, ...args], { encoding: 'utf8', env });
  return { json: JSON.parse(r.stdout), status: r.status };
}

const readJson = (f) => JSON.parse(readFileSync(f, 'utf8'));
const readRaw = (f) => readFileSync(f, 'utf8');

// --- bump -------------------------------------------------------------------

test('bump: rewrites only version, preserves every other field, scaffolds changelog', () => {
  const dir = fixture();
  const marketBefore = readRaw(join(dir, '.claude-plugin', 'marketplace.json'));
  const r = seam(['bump', '--dir', dir, '--version', '1.1.0-rc.2', '--date', '2026-07-17']);
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
  seam(['bump', '--dir', dir, '--version', '1.1.0-rc.2', '--date', '2026-07-17']);
  const pluginAfterFirst = readRaw(join(dir, '.claude-plugin', 'plugin.json'));
  const clAfterFirst = readRaw(join(dir, 'CHANGELOG.md'));

  const r = seam(['bump', '--dir', dir, '--version', '1.1.0-rc.2', '--date', '2026-07-17']);
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

test('bump: no --version refuses even while PROJECT.md ### Active names one - the prose arm is gone', () => {
  // The fixture's `### Active` names `v1.1.0-rc.2`. Against HEAD-before-REL-03
  // that prose supplied the target and the seam bumped; now nothing but the
  // explicit --version can name the shipping number, so this refuses.
  const dir = fixture();
  assert.match(readRaw(join(dir, '.planning', 'PROJECT.md')), /v1\.1\.0-rc\.2/,
    'the fixture really does carry a version in ### Active - that is the evidence, not scaffolding');
  const pluginBefore = readRaw(join(dir, '.claude-plugin', 'plugin.json'));
  const clBefore = readRaw(join(dir, 'CHANGELOG.md'));

  const { json: r, status } = seamStatus(['bump', '--dir', dir, '--date', '2026-07-17']);
  assert.equal(r.ok, false, 'a refusal is never ok:true - a scripted caller must not read it as success');
  assert.equal(r.action, 'refuse');
  assert.equal(r.reason, 'no-target-version');
  assert.equal(status, 1, 'ok:false mirrors into exit 1');
  // Both files byte-unchanged; no `## [null]` heading ever scaffolded.
  assert.equal(readRaw(join(dir, '.claude-plugin', 'plugin.json')), pluginBefore);
  assert.equal(readRaw(join(dir, 'CHANGELOG.md')), clBefore);
  assert.ok(!readRaw(join(dir, 'CHANGELOG.md')).includes('[null]'));
});

test('bump: a present-but-unparseable plugin.json refuses, never reads as "not a plugin project"', () => {
  const dir = fixture();
  // A trailing comma: the shape a truncated or hand-edited half-write leaves.
  const mangled = '{\n  "name": "cadence",\n  "version": "1.0.0",\n}\n';
  writeFileSync(join(dir, '.claude-plugin', 'plugin.json'), mangled);
  const clBefore = readRaw(join(dir, 'CHANGELOG.md'));

  const { json: r, status } = seamStatus(['bump', '--dir', dir, '--version', '2.0.0', '--date', '2026-07-17']);
  assert.equal(r.ok, false);
  assert.equal(r.action, 'refuse');
  assert.equal(r.reason, 'unreadable-manifest');
  assert.equal(status, 1);
  assert.equal(readRaw(join(dir, '.claude-plugin', 'plugin.json')), mangled, 'the mangled manifest is left byte-unchanged');
  assert.equal(readRaw(join(dir, 'CHANGELOG.md')), clBefore);
});

test('bump: a success envelope carries a machine reason code plus the human detail', () => {
  const dir = fixture();
  const r = seam(['bump', '--dir', dir, '--version', '1.1.0-rc.2', '--date', '2026-07-17']);
  assert.equal(r.ok, true);
  assert.equal(r.reason, 'bump', 'reason is a machine token on EVERY path, not a sentence on the ok:true one');
  assert.match(r.detail, /1\.0\.0 -> 1\.1\.0-rc\.2/);
});

test('bump: --version IS the shipping number, and a leading v is stripped', () => {
  const dir = fixture({ activeVersion: null });
  const r = seam(['bump', '--dir', dir, '--version', 'v2.0.0', '--date', '2026-07-17']);
  assert.equal(r.action, 'bumped');
  assert.equal(r.target, '2.0.0');
  assert.equal(readJson(join(dir, '.claude-plugin', 'plugin.json')).version, '2.0.0');
});

test('bump: a target BELOW the manifest version refuses, exit 1, nothing written', () => {
  const dir = fixture({ plugin: { ...PLUGIN_1_0_0, version: '2.0.0' } });
  const pluginBefore = readRaw(join(dir, '.claude-plugin', 'plugin.json'));
  const clBefore = readRaw(join(dir, 'CHANGELOG.md'));

  const { json: r, status } = seamStatus(['bump', '--dir', dir, '--version', '1.0.0', '--date', '2026-07-17']);
  assert.equal(r.ok, false);
  assert.equal(r.action, 'refuse');
  assert.equal(r.reason, 'downgrade');
  assert.equal(status, 1);
  assert.equal(readRaw(join(dir, '.claude-plugin', 'plugin.json')), pluginBefore);
  assert.equal(readRaw(join(dir, 'CHANGELOG.md')), clBefore);
});

test('bump: an unparseable --version refuses, exit 1, nothing written', () => {
  const dir = fixture();
  const pluginBefore = readRaw(join(dir, '.claude-plugin', 'plugin.json'));
  const clBefore = readRaw(join(dir, 'CHANGELOG.md'));

  const { json: r, status } = seamStatus(['bump', '--dir', dir, '--version', 'latest', '--date', '2026-07-17']);
  assert.equal(r.ok, false);
  assert.equal(r.action, 'refuse');
  assert.equal(r.reason, 'unparseable-version');
  assert.equal(status, 1);
  assert.equal(readRaw(join(dir, '.claude-plugin', 'plugin.json')), pluginBefore);
  assert.equal(readRaw(join(dir, 'CHANGELOG.md')), clBefore);
});

test('bump: an unparseable version IN THE MANIFEST refuses, exit 1, nothing written', () => {
  const dir = fixture({ plugin: { ...PLUGIN_1_0_0, version: '1.0' } });
  const pluginBefore = readRaw(join(dir, '.claude-plugin', 'plugin.json'));
  const clBefore = readRaw(join(dir, 'CHANGELOG.md'));

  const { json: r, status } = seamStatus(['bump', '--dir', dir, '--version', '2.0.0', '--date', '2026-07-17']);
  assert.equal(r.ok, false);
  assert.equal(r.action, 'refuse');
  assert.equal(r.reason, 'unparseable-version');
  assert.equal(status, 1);
  assert.equal(readRaw(join(dir, '.claude-plugin', 'plugin.json')), pluginBefore);
  assert.equal(readRaw(join(dir, 'CHANGELOG.md')), clBefore);
});

test('bump: a SIBLING that would downgrade is recorded as a refusal, not silently written (D-08)', () => {
  // The shipped marketplace.json carries no version, so this arm needs a
  // fixture that adds one; a sibling ahead of the target must not be walked
  // backwards, and the primary write has already landed so it records.
  const dir = fixture({ marketplace: { ...MARKETPLACE, version: '2.0.0' } });
  const marketBefore = readRaw(join(dir, '.claude-plugin', 'marketplace.json'));

  const r = seam(['bump', '--dir', dir, '--version', '1.1.0', '--date', '2026-07-17']);
  assert.equal(r.ok, true, 'the primary write landed, so the run itself is not a refusal (D-08)');
  assert.equal(r.action, 'bumped');
  assert.equal(readJson(join(dir, '.claude-plugin', 'plugin.json')).version, '1.1.0');
  assert.deepEqual(r.siblings, [{
    file: '.claude-plugin/marketplace.json', action: 'refuse', bumped: false, reason: 'downgrade',
  }], 'the refusal is visible in siblings[] for the milestone workflow to halt on');
  assert.equal(readRaw(join(dir, '.claude-plugin', 'marketplace.json')), marketBefore,
    'the sibling manifest is byte-unchanged');
});

// --- promotion through the seam ---------------------------------------------

const STAGED_CHANGELOG = [
  '# Changelog',
  '',
  '## [Unreleased]',
  '',
  '### Removed',
  '- the rail-3 evasion grammar',
  '',
  '## [1.0.0] - 2026-07-16',
  '',
  'First public release.',
  '',
  '[1.0.0]: https://github.com/crenshawdev/cadence/releases',
  '',
].join('\n');

test('bump: one run puts the staged Unreleased body INSIDE the dated section', () => {
  const dir = fixture({ changelog: STAGED_CHANGELOG });
  const r = seam(['bump', '--dir', dir, '--version', '2.0.0', '--date', '2026-08-03']);
  assert.equal(r.ok, true);
  assert.equal(r.changelog.changed, true);
  assert.equal(r.changelog.promoted, true);
  assert.equal(r.changelog.section_empty, false, 'the dated section has a body, so nothing to author from scratch');

  const cl = readRaw(join(dir, 'CHANGELOG.md'));
  const iUnrel = cl.indexOf('## [Unreleased]');
  const iNew = cl.indexOf('## [2.0.0] - 2026-08-03');
  const iBullet = cl.indexOf('- the rail-3 evasion grammar');
  assert.ok(iUnrel < iNew && iNew < iBullet && iBullet < cl.indexOf('## [1.0.0]'));
  // Nothing but blank lines between the Unreleased stub and the dated heading.
  assert.match(cl.slice(iUnrel, iNew), /^## \[Unreleased\]\n\s*\n$/);
});

test('bump: a second identical run leaves plugin.json and CHANGELOG byte-identical', () => {
  const dir = fixture({ changelog: STAGED_CHANGELOG });
  seam(['bump', '--dir', dir, '--version', '2.0.0', '--date', '2026-08-03']);
  const pluginAfterFirst = readRaw(join(dir, '.claude-plugin', 'plugin.json'));
  const clAfterFirst = readRaw(join(dir, 'CHANGELOG.md'));

  const r = seam(['bump', '--dir', dir, '--version', '2.0.0', '--date', '2026-08-03']);
  assert.equal(r.action, 'noop');
  assert.equal(r.changelog.changed, false);
  assert.equal(readRaw(join(dir, '.claude-plugin', 'plugin.json')), pluginAfterFirst);
  assert.equal(readRaw(join(dir, 'CHANGELOG.md')), clAfterFirst);
});

test('bump: a third run after new content is staged promotes that too', () => {
  const dir = fixture({ changelog: STAGED_CHANGELOG });
  seam(['bump', '--dir', dir, '--version', '2.0.0', '--date', '2026-08-03']);
  const staged = readRaw(join(dir, 'CHANGELOG.md')).replace('## [Unreleased]\n', '## [Unreleased]\n\n- a late fix\n');
  writeFileSync(join(dir, 'CHANGELOG.md'), staged);

  const r = seam(['bump', '--dir', dir, '--version', '2.0.0', '--date', '2026-08-03']);
  assert.equal(r.changelog.changed, true);
  assert.equal(r.changelog.promoted, true);
  const cl = readRaw(join(dir, 'CHANGELOG.md'));
  const iLate = cl.indexOf('- a late fix');
  assert.ok(iLate > cl.indexOf('## [2.0.0] - 2026-08-03') && iLate < cl.indexOf('## [1.0.0]'),
    'the late bullet lands inside the dated section, not stranded under Unreleased');
});

test('bump: an empty Unreleased body reports section_empty so the close authors the notes', () => {
  const dir = fixture();  // the default CHANGELOG has no Unreleased content
  const r = seam(['bump', '--dir', dir, '--version', '2.0.0', '--date', '2026-08-03']);
  assert.equal(r.changelog.changed, true, 'the heading was still scaffolded');
  assert.equal(r.changelog.promoted, false);
  assert.equal(r.changelog.section_empty, true);
});

test('bump: a version-less manifest skips - no dated heading for a release that never happened', () => {
  const { version, ...noVersion } = PLUGIN_1_0_0;
  assert.equal(version, '1.0.0'); // the field really was there to remove
  const dir = fixture({ plugin: noVersion, changelog: STAGED_CHANGELOG });
  const clBefore = readRaw(join(dir, 'CHANGELOG.md'));

  const r = seam(['bump', '--dir', dir, '--version', '2.2.0', '--date', '2026-08-03']);
  assert.equal(r.ok, true);
  assert.equal(r.action, 'skip');
  assert.equal(r.changelog.changed, false);
  assert.equal(readRaw(join(dir, 'CHANGELOG.md')), clBefore,
    'no ## [2.2.0] heading over a manifest that bumped nothing');
});

test('unknown subcommand: usage, ok false', () => {
  const r = seam(['frobnicate']);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'usage');
});
