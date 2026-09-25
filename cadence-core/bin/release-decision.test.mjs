// Pure version comparison tests for the surviving branch/audit consumers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTargetVersion, compareVersions } from './lib/release-decision.mjs';

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
