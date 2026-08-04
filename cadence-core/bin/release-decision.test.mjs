// Zero-dep tests for lib/release-decision.mjs (the pure release-bump core).
// Run: node --test 'cadence-core/bin/*.test.mjs'. Only node: builtins, and the
// functions are pure, so this needs no subprocess or live git. Mirrors
// close-decision.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeTargetVersion, compareVersions, decideManifestBump, prependChangelogEntry,
  promoteUnreleased,
} from './lib/release-decision.mjs';

// --- normalizeTargetVersion -------------------------------------------------

test('normalize: strips a single leading v from the explicit version', () => {
  assert.equal(normalizeTargetVersion('v1.1.0-rc.2'), '1.1.0-rc.2');
  assert.equal(normalizeTargetVersion('1.1.0-rc.2'), '1.1.0-rc.2');
  assert.equal(normalizeTargetVersion('  v2.0.0  '), '2.0.0');
});

test('normalize: null when no explicit version is given (never invent one)', () => {
  assert.equal(normalizeTargetVersion(null), null);
  assert.equal(normalizeTargetVersion(undefined), null);
  assert.equal(normalizeTargetVersion(''), null);
  assert.equal(normalizeTargetVersion('   '), null);
  assert.equal(normalizeTargetVersion(/** @type {any} */ (42)), null);
});

// --- compareVersions --------------------------------------------------------
//
// The canonical semver §11 precedence chain, one test() per adjacent PAIR (the
// convention and its reason are at retired-keys.test.mjs:4-6): a loop of
// asserts inside one test() reports the loop's count, not the rows', so a pair
// that never ran still looks green. Each pair is asserted in both directions.
//   1.0.0-alpha < 1.0.0-alpha.1 < 1.0.0-alpha.beta < 1.0.0-beta
//     < 1.0.0-beta.2 < 1.0.0-beta.11 < 1.0.0-rc.1 < 1.0.0

/** Assert `lo` sorts strictly below `hi`, in both directions. */
function below(lo, hi) {
  assert.equal(compareVersions(lo, hi), -1, `${lo} must sort below ${hi}`);
  assert.equal(compareVersions(hi, lo), 1, `${hi} must sort above ${lo}`);
  assert.equal(compareVersions(lo, lo), 0, `${lo} must equal itself`);
}

test('compare §11: 1.0.0-alpha < 1.0.0-alpha.1 (a longer identifier list wins a tie)', () => {
  below('1.0.0-alpha', '1.0.0-alpha.1');
});

test('compare §11: 1.0.0-alpha.1 < 1.0.0-alpha.beta (numeric ranks below alphanumeric)', () => {
  below('1.0.0-alpha.1', '1.0.0-alpha.beta');
});

test('compare §11: 1.0.0-alpha.beta < 1.0.0-beta (ASCII order, left to right)', () => {
  below('1.0.0-alpha.beta', '1.0.0-beta');
});

test('compare §11: 1.0.0-beta < 1.0.0-beta.2', () => {
  below('1.0.0-beta', '1.0.0-beta.2');
});

test('compare §11: 1.0.0-beta.2 < 1.0.0-beta.11 (numeric identifiers compare numerically, not as text)', () => {
  below('1.0.0-beta.2', '1.0.0-beta.11');
});

test('compare §11: 1.0.0-beta.11 < 1.0.0-rc.1', () => {
  below('1.0.0-beta.11', '1.0.0-rc.1');
});

test('compare §11: 1.0.0-rc.1 < 1.0.0 (a prerelease sorts below its own release)', () => {
  below('1.0.0-rc.1', '1.0.0');
});

test('compare: the numeric triple dominates - 2.0.0 > 1.9.9', () => {
  below('1.9.9', '2.0.0');
});

test('compare: build metadata is ignored entirely - 1.0.0+a, 1.0.0+b and 1.0.0 are all equal', () => {
  assert.equal(compareVersions('1.0.0+a', '1.0.0+b'), 0);
  assert.equal(compareVersions('1.0.0+a', '1.0.0'), 0);
  assert.equal(compareVersions('1.0.0', '1.0.0+b'), 0);
});

test('compare: an out-of-grammar version is null, never a guessed order', () => {
  assert.equal(compareVersions('1.0', '1.0.0'), null, 'a two-part version is not semver');
  assert.equal(compareVersions('latest', '1.0.0'), null, 'a channel name is not a version');
  assert.equal(compareVersions('01.2.3', '1.2.3'), null, 'a leading zero is out of grammar');
  assert.equal(compareVersions('', '1.0.0'), null);
  assert.equal(compareVersions('1.0.0', /** @type {any} */ (null)), null);
});

test('compare: a leading v is out of grammar here (normalizeTargetVersion strips it upstream)', () => {
  // Accepting `v` in two places is how the two drift apart.
  assert.equal(compareVersions('v1.0.0', '1.0.0'), null);
});

test('compare: majors above Number.MAX_SAFE_INTEGER still order correctly', () => {
  // 9007199254740993 and ...92 are indistinguishable as JS numbers; the
  // length-then-lexicographic digit compare keeps them apart.
  below('9007199254740992.0.0', '9007199254740993.0.0');
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

test('bump: no target version -> refuse, never write a null', () => {
  const r = decideManifestBump('1.0.0', null);
  assert.equal(r.action, 'refuse');
  assert.equal(r.code, 'no-target-version');
  assert.equal(r.bumped, false);
  assert.match(r.reason, /no-target-version/);
  assert.equal(decideManifestBump('1.0.0', undefined).action, 'refuse');
  assert.equal(decideManifestBump('1.0.0', '').action, 'refuse');
});

test('bump: every verdict carries a machine code from the closed set', () => {
  assert.equal(decideManifestBump('1.0.0', '1.1.0').code, 'bump');
  assert.equal(decideManifestBump('1.1.0', '1.1.0').code, 'already-at-target');
  assert.equal(decideManifestBump(undefined, '1.1.0').code, 'no-version-field');
  assert.equal(decideManifestBump('1.0.0', null).code, 'no-target-version');
});

test('bump: a target BELOW the manifest version refuses downgrade (never any-difference)', () => {
  const r = decideManifestBump('2.0.0', '1.9.9');
  assert.equal(r.action, 'refuse');
  assert.equal(r.code, 'downgrade');
  assert.equal(r.bumped, false);
  assert.match(r.reason, /2\.0\.0/);
  assert.match(r.reason, /1\.9\.9/);
});

test('bump: 1.1.0-rc.2 -> 1.1.0 is still an upgrade (a release outranks its prerelease)', () => {
  const r = decideManifestBump('1.1.0-rc.2', '1.1.0');
  assert.equal(r.action, 'bump');
  assert.equal(r.code, 'bump');
  assert.equal(r.bumped, true);
});

test('bump: 1.1.0 -> 1.1.0-rc.2 refuses downgrade (going back to a prerelease)', () => {
  const r = decideManifestBump('1.1.0', '1.1.0-rc.2');
  assert.equal(r.action, 'refuse');
  assert.equal(r.code, 'downgrade');
});

test('bump: an unparseable TARGET refuses by name, naming the side and the value', () => {
  const r = decideManifestBump('1.0.0', 'latest');
  assert.equal(r.action, 'refuse');
  assert.equal(r.code, 'unparseable-version');
  assert.match(r.reason, /target/);
  assert.match(r.reason, /latest/);
});

test('bump: an unparseable MANIFEST version refuses by name, naming the side and the value', () => {
  const r = decideManifestBump('1.0', '2.0.0');
  assert.equal(r.action, 'refuse');
  assert.equal(r.code, 'unparseable-version');
  assert.match(r.reason, /current/);
  assert.match(r.reason, /1\.0/);
});

test('bump: the TARGET is checked before the manifest - one bad number refuses every manifest alike', () => {
  // A version-less manifest would otherwise `skip`; the bad target must win, so
  // a run can never write one manifest and refuse the next on the same number.
  const r = decideManifestBump(undefined, 'latest');
  assert.equal(r.action, 'refuse');
  assert.equal(r.code, 'unparseable-version');
});

test('bump: a build-metadata-only difference is not an upgrade', () => {
  const r = decideManifestBump('1.0.0', '1.0.0+build');
  assert.equal(r.action, 'refuse');
  assert.equal(r.code, 'not-an-upgrade');
  assert.equal(r.bumped, false);
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

// --- promoteUnreleased ------------------------------------------------------

const STAGED_FIXTURE = [
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
  '[1.0.0]: https://x/releases',
  '',
].join('\n');

/** Scaffold the dated heading, then promote - the order the seam composes in. */
function scaffoldThenPromote(text, version, date = '2026-08-03') {
  const scaffold = prependChangelogEntry(text, { version, date, url: `https://x/releases/tag/v${version}` });
  return promoteUnreleased(scaffold.text, version);
}

test('promote: staged content ends up INSIDE the dated section, not stranded above it', () => {
  const r = scaffoldThenPromote(STAGED_FIXTURE, '2.0.0');
  assert.equal(r.changed, true);
  const iUnrel = r.text.indexOf('## [Unreleased]');
  const iNew = r.text.indexOf('## [2.0.0]');
  const iBullet = r.text.indexOf('- the rail-3 evasion grammar');
  const iOld = r.text.indexOf('## [1.0.0]');
  assert.ok(iUnrel < iNew, 'Unreleased still leads the file');
  assert.ok(iNew < iBullet, 'the staged bullet sits BELOW the dated heading, which is the whole point');
  assert.ok(iBullet < iOld, 'and above the previous release');
  assert.ok(r.text.includes('### Removed'), 'the sub-heading travels with its bullets');
});

test('promote: [Unreleased] survives as an empty stub with nothing stranded under it', () => {
  const r = scaffoldThenPromote(STAGED_FIXTURE, '2.0.0');
  const lines = r.text.split('\n');
  const at = lines.findIndex((l) => /^## \[Unreleased\]/.test(l));
  const next = lines.findIndex((l, i) => i > at && /^## /.test(l));
  assert.ok(at >= 0, 'the Unreleased heading is still there - the next cycle stages into it');
  assert.ok(next > at, 'a following section exists');
  for (let i = at + 1; i < next; i++) {
    assert.equal(lines[i].trim(), '', `line ${i} between Unreleased and the next heading must be blank`);
  }
});

test('promote: a second call is a no-op and byte-identical (idempotent on an empty body)', () => {
  const once = scaffoldThenPromote(STAGED_FIXTURE, '2.0.0');
  const twice = promoteUnreleased(once.text, '2.0.0');
  assert.equal(twice.changed, false);
  assert.equal(twice.reason.startsWith('empty-unreleased'), true);
  assert.equal(twice.text, once.text);
});

test('promote: a re-run that staged NEW content promotes that too (not first-run-only)', () => {
  const once = scaffoldThenPromote(STAGED_FIXTURE, '2.0.0');
  const restaged = once.text.replace('## [Unreleased]\n', '## [Unreleased]\n\n- a late fix\n');
  const again = promoteUnreleased(restaged, '2.0.0');
  assert.equal(again.changed, true);
  const iNew = again.text.indexOf('## [2.0.0]');
  const iLate = again.text.indexOf('- a late fix');
  const iOld = again.text.indexOf('## [1.0.0]');
  assert.ok(iNew < iLate && iLate < iOld, 'the late bullet lands inside the same dated section');
  assert.ok(again.text.indexOf('- the rail-3 evasion grammar') > iNew, 'the first promotion is left in place');
});

test('promote: no [Unreleased] section -> no-op, nothing invented', () => {
  const r = promoteUnreleased('# Changelog\n\n## [2.0.0] - 2026-08-03\n\n- something\n', '2.0.0');
  assert.equal(r.changed, false);
  assert.equal(r.reason.startsWith('no-unreleased-section'), true);
});

test('promote: no dated heading for the target -> no-op, content stays staged', () => {
  const r = promoteUnreleased(STAGED_FIXTURE, '2.0.0');
  assert.equal(r.changed, false);
  assert.equal(r.reason.startsWith('no-release-heading'), true);
  assert.equal(r.text, STAGED_FIXTURE, 'the staged content is left exactly where it was');
});

test('promote: trailing link references stay put when [Unreleased] is the last section', () => {
  const unreleasedLast = [
    '# Changelog',
    '',
    '## [2.0.0] - 2026-08-03',
    '',
    '## [Unreleased]',
    '',
    '- staged work',
    '',
    '[2.0.0]: https://x/releases/tag/v2.0.0',
    '[1.0.0]: https://x/releases',
    '',
  ].join('\n');
  const r = promoteUnreleased(unreleasedLast, '2.0.0');
  assert.equal(r.changed, true);
  const lines = r.text.split('\n');
  // The two reference definitions are still the file's trailing block, in order.
  const refs = lines.filter((l) => /^\[[^\]]+\]:\s/.test(l));
  assert.deepEqual(refs, ['[2.0.0]: https://x/releases/tag/v2.0.0', '[1.0.0]: https://x/releases']);
  const iBullet = r.text.indexOf('- staged work');
  assert.ok(iBullet < r.text.indexOf('[2.0.0]: '), 'the promoted bullet is above the reference block');
  assert.ok(iBullet > r.text.indexOf('## [2.0.0] - 2026-08-03'), 'and inside the dated section');
});

test('promote: a reference definition INSIDE the body travels with the content that cites it', () => {
  const withInnerRef = [
    '# Changelog',
    '',
    '## [Unreleased]',
    '',
    '- closes [#87]',
    '[#87]: https://git.example/issues/87',
    '',
    '- and a second bullet below the definition',
    '',
    '## [2.0.0] - 2026-08-03',
    '',
    '## [1.0.0] - 2026-07-16',
    '',
    '[1.0.0]: https://x/releases',
    '',
  ].join('\n');
  const r = promoteUnreleased(withInnerRef, '2.0.0');
  assert.equal(r.changed, true);
  const iNew = r.text.indexOf('## [2.0.0]');
  const iOld = r.text.indexOf('## [1.0.0] - 2026-07-16');
  for (const needle of ['- closes [#87]', '[#87]: https://git.example/issues/87', '- and a second bullet below the definition']) {
    const at = r.text.indexOf(needle);
    assert.ok(at > iNew && at < iOld, `"${needle}" promoted into the dated section, not truncated at the definition`);
  }
});

test('promote: sectionEmpty is false once content landed, true when the section stays bare', () => {
  assert.equal(scaffoldThenPromote(STAGED_FIXTURE, '2.0.0').sectionEmpty, false);
  const nothingStaged = STAGED_FIXTURE.replace('### Removed\n- the rail-3 evasion grammar\n', '');
  assert.equal(scaffoldThenPromote(nothingStaged, '2.0.0').sectionEmpty, true);
});

test('promote: total on junk input - a non-string text and a falsy version never throw', () => {
  const r = promoteUnreleased(/** @type {any} */ (null), '2.0.0');
  assert.equal(r.changed, false);
  assert.equal(r.text, '');
  const noVersion = promoteUnreleased(STAGED_FIXTURE, /** @type {any} */ (''));
  assert.equal(noVersion.changed, false);
  assert.equal(noVersion.text, STAGED_FIXTURE);
});
