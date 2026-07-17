// Zero-dep tests for lib/release-decision.mjs (the pure release-bump core).
// Run: node --test 'cadence-core/bin/*.test.mjs'. Only node: builtins, and the
// functions are pure, so this needs no subprocess or live git. Mirrors
// close-decision.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  deriveTargetVersion, decideManifestBump, prependChangelogEntry,
} from './lib/release-decision.mjs';

// --- deriveTargetVersion ----------------------------------------------------

test('derive: strips a single leading v from an explicit argVersion', () => {
  assert.equal(deriveTargetVersion({ argVersion: 'v1.1.0-rc.2' }), '1.1.0-rc.2');
  assert.equal(deriveTargetVersion({ argVersion: '1.1.0-rc.2' }), '1.1.0-rc.2');
});

test('derive: precedence argVersion > ### Active > ROADMAP title', () => {
  const project = '### Active\n\n`v2.0.0` - next\n\n### Out of Scope\n';
  const roadmap = '# Roadmap: Cadence v3.0.0\n';
  // argVersion wins over both prose surfaces.
  assert.equal(deriveTargetVersion({ argVersion: 'v9.9.9', projectText: project, roadmapText: roadmap }), '9.9.9');
  // no argVersion: ### Active wins over the ROADMAP title.
  assert.equal(deriveTargetVersion({ projectText: project, roadmapText: roadmap }), '2.0.0');
  // no argVersion, no Active version: fall back to the ROADMAP title.
  assert.equal(deriveTargetVersion({ projectText: '### Active\n\nno version\n', roadmapText: roadmap }), '3.0.0');
});

test('derive: null when nothing carries a version (never invent one)', () => {
  assert.equal(deriveTargetVersion({ projectText: '### Active\n\nnothing\n', roadmapText: '# Roadmap\n' }), null);
  assert.equal(deriveTargetVersion({}), null);
  assert.equal(deriveTargetVersion(), null);
});

// --- decideManifestBump -----------------------------------------------------

test('bump: current differs from target -> bump with from/to', () => {
  const r = decideManifestBump('1.0.0', '1.1.0-rc.2');
  assert.equal(r.action, 'bump');
  assert.equal(r.bumped, true);
  assert.equal(r.from, '1.0.0');
  assert.equal(r.to, '1.1.0-rc.2');
});

test('bump: current equals target -> noop (idempotency, no double-bump)', () => {
  const r = decideManifestBump('1.1.0-rc.2', '1.1.0-rc.2');
  assert.equal(r.action, 'noop');
  assert.equal(r.bumped, false);
});

test('bump: no version field on the manifest -> skip (D-03 sibling guard)', () => {
  const r = decideManifestBump(undefined, '1.1.0-rc.2');
  assert.equal(r.action, 'skip');
  assert.equal(r.bumped, false);
  assert.equal(r.reason, 'no-version-field: manifest carries no version, leave it untouched');
  assert.equal(decideManifestBump(null, '1.1.0-rc.2').action, 'skip');
});

test('bump: no target version -> error, never write a null', () => {
  const r = decideManifestBump('1.0.0', null);
  assert.equal(r.action, 'error');
  assert.equal(r.bumped, false);
  assert.match(r.reason, /no-target-version/);
  assert.equal(decideManifestBump('1.0.0', undefined).action, 'error');
  assert.equal(decideManifestBump('1.0.0', '').action, 'error');
});

// --- prependChangelogEntry --------------------------------------------------

const CHANGELOG_FIXTURE = [
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

test('changelog: inserts heading + link reference above the [1.0.0] entry, unaltered', () => {
  const r = prependChangelogEntry(CHANGELOG_FIXTURE, {
    version: '1.1.0-rc.2', date: '2026-07-17',
    url: 'https://github.com/crenshawdev/cadence/releases/tag/v1.1.0-rc.2',
  });
  assert.equal(r.changed, true);
  // New heading precedes the old one.
  assert.match(r.text, /## \[1\.1\.0-rc\.2\] - 2026-07-17/);
  assert.ok(r.text.indexOf('## [1.1.0-rc.2]') < r.text.indexOf('## [1.0.0]'),
    'the new heading comes before the [1.0.0] heading');
  // New link reference precedes the old one.
  assert.match(r.text, /^\[1\.1\.0-rc\.2\]: https:\/\/github\.com\/crenshawdev\/cadence\/releases\/tag\/v1\.1\.0-rc\.2$/m);
  assert.ok(r.text.indexOf('[1.1.0-rc.2]:') < r.text.indexOf('[1.0.0]:'),
    'the new link reference comes before the [1.0.0] link reference');
  // The [1.0.0] heading line and its link reference are byte-unaltered.
  assert.ok(r.text.includes('## [1.0.0] - 2026-07-16'));
  assert.ok(r.text.includes('[1.0.0]: https://github.com/crenshawdev/cadence/releases'));
  // No bullet prose is scaffolded - that is the model's job (D-06).
  assert.ok(!/## \[1\.1\.0-rc\.2\] - 2026-07-17\n[^\n]*- /.test(r.text));
});

test('changelog: idempotent - a second call for the same version is a no-op', () => {
  const once = prependChangelogEntry(CHANGELOG_FIXTURE, {
    version: '1.1.0-rc.2', date: '2026-07-17',
    url: 'https://example/releases/tag/v1.1.0-rc.2',
  });
  const twice = prependChangelogEntry(once.text, {
    version: '1.1.0-rc.2', date: '2026-07-17',
    url: 'https://example/releases/tag/v1.1.0-rc.2',
  });
  assert.equal(twice.changed, false);
  assert.equal(twice.text, once.text);
});

test('changelog: total on empty/missing input, no throw', () => {
  const r = prependChangelogEntry('', { version: '1.1.0-rc.2', date: '2026-07-17', url: 'https://x/releases' });
  assert.equal(r.changed, true);
  assert.match(r.text, /## \[1\.1\.0-rc\.2\]/);
  assert.equal(prependChangelogEntry(CHANGELOG_FIXTURE, /** @type {any} */ ({})).changed, false);
});

const UNRELEASED_FIXTURE = [
  '# Changelog',
  '',
  '## [Unreleased]',
  '',
  '### Added',
  '- something not yet released',
  '',
  '## [1.0.0] - 2026-07-16',
  '',
  'First public release.',
  '',
  '[1.0.0]: https://x/releases',
  '',
].join('\n');

test('changelog: a released entry lands BELOW a leading [Unreleased] section, not above it', () => {
  const r = prependChangelogEntry(UNRELEASED_FIXTURE, {
    version: '1.1.0', date: '2026-07-17', url: 'https://x/releases/tag/v1.1.0',
  });
  assert.equal(r.changed, true);
  // Order: Unreleased, then the new 1.1.0, then 1.0.0.
  assert.ok(r.text.indexOf('## [Unreleased]') < r.text.indexOf('## [1.1.0]'),
    'the new release heading comes after Unreleased');
  assert.ok(r.text.indexOf('## [1.1.0]') < r.text.indexOf('## [1.0.0]'),
    'the new release heading comes before the older 1.0.0');
  // The Unreleased content is untouched.
  assert.ok(r.text.includes('- something not yet released'));
});

test('changelog: Unreleased-only file (no released heading) appends the release after it', () => {
  const onlyUnreleased = '# Changelog\n\n## [Unreleased]\n\n### Added\n- wip\n';
  const r = prependChangelogEntry(onlyUnreleased, { version: '1.0.0', date: '2026-07-17', url: 'https://x/releases/tag/v1.0.0' });
  assert.equal(r.changed, true);
  assert.ok(r.text.indexOf('## [Unreleased]') < r.text.indexOf('## [1.0.0]'),
    'the release heading follows the Unreleased section');
});

test('changelog: empty url omits the link reference line entirely (no malformed [ver]: )', () => {
  const r = prependChangelogEntry(CHANGELOG_FIXTURE, { version: '1.1.0-rc.2', date: '2026-07-17', url: '' });
  assert.equal(r.changed, true);
  assert.match(r.text, /## \[1\.1\.0-rc\.2\] - 2026-07-17/); // heading still placed
  assert.ok(!/^\[1\.1\.0-rc\.2\]:\s*$/m.test(r.text), 'no empty link reference line is written');
  assert.ok(!r.text.includes('[1.1.0-rc.2]: \n'), 'no trailing-empty link reference');
  // The pre-existing [1.0.0] link reference is left intact.
  assert.ok(r.text.includes('[1.0.0]: https://github.com/crenshawdev/cadence/releases'));
});
