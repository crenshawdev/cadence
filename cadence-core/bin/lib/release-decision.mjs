// @ts-check
// Pure version normalization and comparison shared by branch decisions and audit.

/**
 * Normalize the EXPLICIT shipping version into bare semver. One argument,
 * total: a non-string, empty or whitespace-only value returns null - never
 * invent a version (the Phase-1 null lesson); the seam turns null into an
 * explicit `no-target-version` refusal rather than a corrupt write. A single
 * leading `v` is stripped so the manifest carries bare semver (`1.1.0-rc.2`,
 * not `v1.1.0-rc.2`, matching plugin.json's field).
 *
 * There is deliberately NO prose derivation here (D-03, REL-03). The number
 * ships from the `--version` the milestone workflow already confirmed with the
 * user, never from planning prose: no path keeps a milestone section or a
 * roadmap title current between cycles, and the shipped project template
 * carries no version token at all, so a fresh project could never satisfy that
 * arm. Branch naming keeps its own prose derivation (lib/branch-decision.mjs
 * documents why, D-11); only the release one went.
 *
 * @param {string|null|undefined} argVersion
 * @returns {string | null}
 */
export function normalizeTargetVersion(argVersion) {
  if (typeof argVersion !== 'string') return null;
  const raw = argVersion.trim();
  if (!raw) return null;
  return raw.replace(/^v/, '');
}

// The anchored full-semver grammar (semver.org §2, §9, §10), with exactly ONE
// home: `parseVersion` below is module-private so no second reader can drift
// from it. MAJOR/MINOR/PATCH are each `0` or a non-zero-leading digit run; the
// optional `-` prerelease is dot-separated identifiers (numeric without leading
// zeros, or alphanumeric-with-hyphen); the optional `+` build metadata is
// dot-separated alphanumeric-hyphen identifiers. Anything else is unparseable,
// so `1.0`, `latest`, `01.2.3` and `''` all fail. A leading `v` is NOT accepted
// here - normalizeTargetVersion strips it upstream, and accepting it in two
// places is how the two drift.
const NUM_ID = '0|[1-9]\\d*';
const ALNUM_ID = '\\d*[A-Za-z-][0-9A-Za-z-]*';
const PRE_ID = `(?:${NUM_ID}|${ALNUM_ID})`;
const BUILD_ID = '[0-9A-Za-z-]+';
const SEMVER_RE = new RegExp(
  `^(${NUM_ID})\\.(${NUM_ID})\\.(${NUM_ID})(?:-(${PRE_ID}(?:\\.${PRE_ID})*))?(?:\\+(?:${BUILD_ID}(?:\\.${BUILD_ID})*))?$`,
);

/**
 * Parse a version into its precedence-bearing parts, or null when it is out of
 * grammar. The numeric parts stay STRINGS: they are compared as digit runs, not
 * as JS numbers (see compareNumericIds). Build metadata is dropped at the parse,
 * because §11 excludes it from precedence entirely.
 * @param {string|null|undefined} v
 * @returns {{ major:string, minor:string, patch:string, pre:string[] } | null}
 */
function parseVersion(v) {
  if (typeof v !== 'string') return null;
  const m = SEMVER_RE.exec(v);
  if (!m) return null;
  return { major: m[1], minor: m[2], patch: m[3], pre: m[4] ? m[4].split('.') : [] };
}

/**
 * Compare two canonical (no-leading-zero) digit runs numerically: LENGTH first,
 * then lexicographically. That equals numeric order at any magnitude and cannot
 * collapse two distinct versions into "equal" above Number.MAX_SAFE_INTEGER the
 * way a parse-to-Number compare does.
 * @param {string} a @param {string} b @returns {-1|0|1}
 */
function compareNumericIds(a, b) {
  if (a.length !== b.length) return a.length < b.length ? -1 : 1;
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/**
 * Compare two prerelease identifiers (§11): numeric ones compare numerically,
 * alphanumeric ones by ASCII order, and a numeric identifier always ranks BELOW
 * an alphanumeric one.
 * @param {string} a @param {string} b @returns {-1|0|1}
 */
function comparePreIds(a, b) {
  const aNum = /^\d+$/.test(a);
  const bNum = /^\d+$/.test(b);
  if (aNum && bNum) return compareNumericIds(a, b);
  if (aNum) return -1;
  if (bNum) return 1;
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/**
 * Semver §11 precedence: -1 when `a` sorts below `b`, 1 when above, 0 when they
 * are equal in precedence, and null when EITHER side is out of grammar - null
 * is "I cannot tell", never a guessed order, and the caller refuses on it.
 * Total: any input shape yields one of those four, never a throw.
 *
 * Major, minor and patch compare numerically; a version WITH a prerelease sorts
 * below the same version without one; prerelease identifiers then compare left
 * to right, and when every shared identifier ties the LONGER list wins. Build
 * metadata is ignored entirely, so `1.0.0+a`, `1.0.0+b` and `1.0.0` are all
 * equal in precedence.
 *
 * @param {string|null|undefined} a @param {string|null|undefined} b
 * @returns {-1|0|1|null}
 */
export function compareVersions(a, b) {
  const x = parseVersion(a);
  const y = parseVersion(b);
  if (!x || !y) return null;

  let c = compareNumericIds(x.major, y.major);
  if (c === 0) c = compareNumericIds(x.minor, y.minor);
  if (c === 0) c = compareNumericIds(x.patch, y.patch);
  if (c !== 0) return c;

  // A prerelease sorts below its own release (1.0.0-rc.1 < 1.0.0).
  if (x.pre.length === 0 && y.pre.length === 0) return 0;
  if (x.pre.length === 0) return 1;
  if (y.pre.length === 0) return -1;

  const shared = Math.min(x.pre.length, y.pre.length);
  for (let i = 0; i < shared; i++) {
    const p = comparePreIds(x.pre[i], y.pre[i]);
    if (p !== 0) return p;
  }
  if (x.pre.length === y.pre.length) return 0;
  return x.pre.length < y.pre.length ? -1 : 1;
}
