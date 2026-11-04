// @ts-check
// release-decision.mjs - the pure core of the release-bump seam. Five total functions that take the shipping version as
// given: it's the `--version` the milestone workflow confirmed with the user, and this module derives none of its own.
//   normalizeTargetVersion  - the explicit version, trimmed and v-stripped
//   compareVersions         - semver §11 precedence, or null when unreadable
//   decideManifestBump      - bump / noop / skip / refuse, with a named code
//   prependChangelogEntry   - scaffold the dated heading + link reference
//   promoteUnreleased       - move staged content into that dated section
// No I/O: the release-bump.mjs seam reads and writes the files, this only decides and rewrites text in memory. Bad or
// missing input never throws, and an absent version yields null rather than an invented one.

import { escapeRe } from './text-util.mjs';

/**
 * Fence-state scanner: an opening fence is three or more backticks or tildes with up to three leading spaces, a closing
 * one is the same character at least as long with no info string, and the delimiter line itself is never a heading.
 * Mirrors the private `fenceScanner` in lib/planning-files.mjs; not imported, since that module does fs and this one no I/O.
 * @returns {(line: string) => boolean}
 */
function fenceScanner() {
  /** @type {{char: string, len: number}|null} */
  let fence = null;
  return (/** @type {string} */ line) => {
    const f = line.match(/^ {0,3}(`{3,}|~{3,})\s*(.*)$/);
    if (!f) return fence !== null;
    const char = f[1][0], len = f[1].length;
    if (fence === null) fence = { char, len };
    else if (char === fence.char && len >= fence.len && !f[2].trim()) fence = null;
    return true;
  };
}

/**
 * Per-line fence state for a whole document, fed in order so each index has the state a reader of the whole document would
 * have. `true` means the line is a delimiter or inside a fenced block, so never a heading for any `^## ` scan here.
 * @param {string[]} lines
 * @returns {boolean[]}
 */
function fenceMask(lines) {
  const fenced = fenceScanner();
  return lines.map((l) => fenced(l));
}

/**
 * Normalize the explicit shipping version into bare semver. Total: a non-string, empty or whitespace-only value returns
 * null, never an invented version; the seam turns null into a `no-target-version` refusal rather than a corrupt write. One
 * leading `v` is stripped so the manifest carries bare semver (`1.1.0-rc.2`, not `v1.1.0-rc.2`).
 * There's deliberately no prose derivation: the number ships from the `--version` the user confirmed, because no path keeps
 * a milestone section or roadmap title current between cycles and the project template carries no version token, so a fresh
 * project could never satisfy it. Branch naming keeps its own derivation (lib/branch-decision.mjs); only the release one went.
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

// the anchored full-semver grammar (semver.org §2, §9, §10), with one home: `parseVersion` is module-private so no second
// reader can drift. MAJOR/MINOR/PATCH are `0` or a non-zero-leading digit run; the optional `-` prerelease is dot-separated
// identifiers (numeric without leading zeros, or alphanumeric-with-hyphen); `+` build metadata is dot-separated
// alphanumeric-hyphen identifiers. So `1.0`, `latest`, `01.2.3` and `''` fail. A leading `v` isn't accepted here:
// normalizeTargetVersion strips it upstream, and accepting it in two places is how the two drift.
const NUM_ID = '0|[1-9]\\d*';
const ALNUM_ID = '\\d*[A-Za-z-][0-9A-Za-z-]*';
const PRE_ID = `(?:${NUM_ID}|${ALNUM_ID})`;
const BUILD_ID = '[0-9A-Za-z-]+';
const SEMVER_RE = new RegExp(
  `^(${NUM_ID})\\.(${NUM_ID})\\.(${NUM_ID})(?:-(${PRE_ID}(?:\\.${PRE_ID})*))?(?:\\+(?:${BUILD_ID}(?:\\.${BUILD_ID})*))?$`,
);

/**
 * Parse a version into its precedence-bearing parts, or null when out of grammar. The numeric parts stay strings, compared
 * as digit runs and not as JS numbers (see compareNumericIds). Build metadata is dropped here: §11 excludes it from precedence.
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
 * Compare two canonical (no-leading-zero) digit runs numerically: length first, then lexicographically. That equals numeric
 * order at any magnitude, and can't collapse two distinct versions into "equal" above MAX_SAFE_INTEGER like a Number compare.
 * @param {string} a @param {string} b @returns {-1|0|1}
 */
function compareNumericIds(a, b) {
  if (a.length !== b.length) return a.length < b.length ? -1 : 1;
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/**
 * Compare two prerelease identifiers (§11): numeric ones numerically, alphanumeric ones by ASCII order, and a numeric
 * identifier always ranks below an alphanumeric one.
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
 * Semver §11 precedence: -1 when `a` sorts below `b`, 1 above, 0 equal, and null when either side is out of grammar. Null is
 * "I cannot tell", never a guessed order, and the caller refuses on it. Total: any input yields one of those four.
 * Major, minor and patch compare numerically; a prerelease sorts below the same version without one; prerelease identifiers
 * compare left to right and the longer list wins when every shared one ties. Build metadata is ignored, so `1.0.0+a`,
 * `1.0.0+b` and `1.0.0` are equal in precedence.
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

/**
 * Decide whether a manifest's `version` needs to change. Total: any input yields a verdict, never a throw.
 * Every verdict carries a `code`, a stable token the seam emits as `reason`; the human sentence in `reason` becomes its
 * `detail`. The codes are a closed set owned here (the seam's own disjoint set is in release-bump.mjs's header):
 *
 *   no-target-version | unparseable-version | no-version-field |
 *   already-at-target | downgrade | not-an-upgrade | bump
 *
 * Arms are first-match-wins in this order. Both target checks come before the manifest checks on purpose: the target is
 * the same for every manifest in a run, so a bad number refuses them all alike and never writes one file then refuses the next.
 *
 *   1. falsy `targetVersion` -> `refuse` `no-target-version`; the seam must not write a `null` target.
 *   2. target out of grammar -> `refuse` `unparseable-version`, naming the side and value. No fallback to an any-difference
 *      bump, since the manifests that most need the guard carry a version nothing can read.
 *   3. `currentVersion` absent (no `version` field, e.g. marketplace.json) -> `skip` `no-version-field`.
 *   4. current out of grammar -> `refuse` `unparseable-version`.
 *   5. `currentVersion === targetVersion` -> `noop` `already-at-target`, so a second close never double-bumps.
 *   6. target below current -> `refuse` `downgrade`, naming both. No override flag: one no caller passes is dead reach.
 *   7. equal in precedence but textually different (build metadata only) -> `refuse` `not-an-upgrade`.
 *   8. otherwise -> `bump`, bumped:true, from/to set.
 *
 * @param {string|null|undefined} currentVersion
 * @param {string|null|undefined} targetVersion
 * @returns {{ action:'bump'|'noop'|'skip'|'refuse', code:string, bumped:boolean, from:string|null, to:string|null, reason:string }}
 */
export function decideManifestBump(currentVersion, targetVersion) {
  const to = (typeof targetVersion === 'string' && targetVersion) ? targetVersion : null;
  if (!to) {
    return { action: 'refuse', code: 'no-target-version', bumped: false, from: null, to: null,
      reason: 'no-target-version: no target version given, refuse to write' };
  }
  if (parseVersion(to) === null) {
    return { action: 'refuse', code: 'unparseable-version', bumped: false, from: null, to,
      reason: `unparseable-version: the target version "${to}" is not semver, refuse to write` };
  }
  if (currentVersion === undefined || currentVersion === null) {
    return { action: 'skip', code: 'no-version-field', bumped: false, from: null, to,
      reason: 'no-version-field: manifest carries no version, leave it untouched' };
  }
  const from = String(currentVersion);
  if (parseVersion(from) === null) {
    return { action: 'refuse', code: 'unparseable-version', bumped: false, from, to,
      reason: `unparseable-version: the current manifest version "${from}" is not semver, refuse to write over it` };
  }
  if (from === to) {
    return { action: 'noop', code: 'already-at-target', bumped: false, from, to,
      reason: 'already at target: idempotent, no double-bump' };
  }
  const order = compareVersions(to, from);
  if (order < 0) {
    return { action: 'refuse', code: 'downgrade', bumped: false, from, to,
      reason: `downgrade: the target ${to} sorts below the current ${from}, refuse to move the release backwards` };
  }
  if (order === 0) {
    return { action: 'refuse', code: 'not-an-upgrade', bumped: false, from, to,
      reason: `not-an-upgrade: ${to} and ${from} are equal in precedence (build metadata is not a release), refuse to write` };
  }
  return { action: 'bump', code: 'bump', bumped: true, from, to,
    reason: `bump ${from} -> ${to}` };
}

/**
 * Prepend a version-stamped CHANGELOG entry: a pure text rewrite returning `{ text, changed, reason }`. Idempotent: a no-op
 * when a `## [<version>]` heading exists, so a re-run never stacks a second entry. Otherwise it inserts, leaving entries alone:
 * - `## [<version>] - <date>\n\n` immediately before the first released version heading, skipping a leading `## [Unreleased]`
 *   (or, with no released heading, after Unreleased / before the first `## ` heading / at end);
 * - `[<version>]: <url>\n` immediately before the first `^\[...\]:` link reference (or at the end), omitted when `url` is empty.
 * The bullet prose is left for the model to author; this scaffold owns the heading and link reference only.
 *
 * @param {string} changelogText
 * @param {{ version:string, date:string, url:string }} entry
 * @returns {{ text:string, changed:boolean, reason:string }}
 */
export function prependChangelogEntry(changelogText, { version, date, url } = /** @type {any} */ ({})) {
  const text = typeof changelogText === 'string' ? changelogText : '';
  if (!version) {
    return { text, changed: false, reason: 'no-version: nothing to scaffold' };
  }
  const headingRe = new RegExp(`^## \\[${escapeRe(version)}\\]`, 'm');
  if (headingRe.test(text)) {
    return { text, changed: false, reason: 'already-present: entry heading exists, idempotent no-op' };
  }

  const heading = `## [${version}] - ${date}\n\n`;
  // no link reference when no URL is derivable: an empty `[version]: ` line is a malformed markdown reference, worse than none
  const linkRef = url ? `[${version}]: ${url}\n` : '';
  const lines = text.split('\n');

  // pick the heading anchor: before the first released version heading, skipping a leading `## [Unreleased]` (Keep a Changelog
  // pins it at the top, so a release lands below it). Fall back to just after Unreleased, then the first `## `, else append.
  // A `## ` inside a fenced code block isn't a heading; the mask is computed once, before any splice, on the real structure.
  const fenced = fenceMask(lines);
  const isReleased = (l) => /^## \[/.test(l) && !/^## \[unreleased\]/i.test(l);
  let headingAt = lines.findIndex((l, i) => !fenced[i] && isReleased(l));
  if (headingAt < 0) {
    const unreleasedAt = lines.findIndex((l, i) => !fenced[i] && /^## \[unreleased\]/i.test(l));
    if (unreleasedAt >= 0) {
      // insert before the next `## ` heading after Unreleased (the end of its section); -1 (Unreleased is last) falls to append
      headingAt = lines.findIndex((l, i) => i > unreleasedAt && !fenced[i] && /^## /.test(l));
    } else {
      headingAt = lines.findIndex((l, i) => !fenced[i] && /^## /.test(l));
    }
  }
  if (headingAt < 0) {
    const base = text.endsWith('\n') || text === '' ? text : text + '\n';
    let out = base + (base.endsWith('\n\n') || base === '' ? '' : '\n') + heading;
    out += linkRef;
    return { text: out, changed: true, reason: 'appended: no heading anchor, entry added at end' };
  }
  lines.splice(headingAt, 0, heading.replace(/\n$/, ''));

  // no URL: the link reference is omitted and the heading placement is the whole change
  if (!linkRef) {
    return { text: lines.join('\n'), changed: true, reason: 'inserted: heading placed, no url so link reference omitted' };
  }

  // the link reference goes before the first existing one, or at the end when none exists; re-find on the mutated lines
  let linkAt = lines.findIndex((l) => /^\[[^\]]+\]:\s/.test(l));
  if (linkAt < 0) {
    const body = lines.join('\n');
    const out = (body.endsWith('\n') ? body : body + '\n') + linkRef;
    return { text: out, changed: true, reason: 'inserted: heading placed, link reference appended at end' };
  }
  lines.splice(linkAt, 0, linkRef.replace(/\n$/, ''));
  return { text: lines.join('\n'), changed: true, reason: 'inserted: heading and link reference placed above the newest existing entry' };
}

/**
 * Promote everything staged under `## [Unreleased]` into the dated `## [<version>]` section, so a release ships the notes
 * written for it instead of a dated heading over an empty section. A pure text rewrite returning `{ text, changed, reason,
 * sectionEmpty }`; an unchanged result returns the input byte-for-byte.
 * Deliberately not folded into prependChangelogEntry, whose heading-exists early return stays: the two have different
 * idempotency conditions (heading insertion on the dated heading existing, promotion on the Unreleased body being empty). So
 * promotion runs on every run whose Unreleased body is non-empty, and a re-run that staged new content promotes that too.
 * `## [Unreleased]` survives as an empty stub: Keep a Changelog pins it at the top and the next cycle stages into it.
 * `sectionEmpty` describes the returned text: true when nothing sits under `## [<version>]` (nothing promoted, nothing
 * already there, or no such heading). The seam surfaces it so a close authors the notes before the bump commit.
 *
 * @param {string} changelogText
 * @param {string} version
 * @returns {{ text:string, changed:boolean, reason:string, sectionEmpty:boolean }}
 */
export function promoteUnreleased(changelogText, version) {
  const text = typeof changelogText === 'string' ? changelogText : '';
  /** @param {string} t @param {boolean} changed @param {string} reason */
  const done = (t, changed, reason) => ({ text: t, changed, reason, sectionEmpty: releaseSectionEmpty(t, version) });
  if (!version) return done(text, false, 'no-version: no target section to promote into');

  const lines = text.split('\n');
  const fenced = fenceMask(lines);
  const unrelAt = lines.findIndex((l, i) => !fenced[i] && /^## \[unreleased\]/i.test(l));
  if (unrelAt < 0) return done(text, false, 'no-unreleased-section: nothing staged to promote');

  // bound the body, then trim its blank edges; the trailing link-reference block is never inside it, but a definition
  // between bullets is, so it travels with the content that cites it
  const bodyEnd = sectionEnd(lines, unrelAt);
  let start = unrelAt + 1;
  let end = bodyEnd;
  while (start < end && lines[start].trim() === '') start++;
  while (end > start && lines[end - 1].trim() === '') end--;
  if (start >= end) return done(text, false, 'empty-unreleased: nothing staged, a re-run changes no byte');

  const headingRe = new RegExp(`^## \\[${escapeRe(version)}\\]`);
  if (!lines.some((l, i) => !fenced[i] && headingRe.test(l))) {
    return done(text, false, `no-release-heading: no ## [${version}] section exists to promote into`);
  }

  const body = lines.slice(start, end);
  const out = lines.slice();
  // splice the whole staged span out, leaving one blank line so the Unreleased heading survives as a stub
  out.splice(unrelAt + 1, bodyEnd - (unrelAt + 1), '');
  // re-find the release heading on the mutated array rather than do arithmetic on a stale index, and re-mask: the splice
  // shifted every line below it
  const outFenced = fenceMask(out);
  const relAt = out.findIndex((l, i) => !outFenced[i] && headingRe.test(l));
  let at = relAt + 1;
  if (!/\n\s*$/.test(out[relAt])) {
    if (out[at] !== undefined && out[at].trim() === '') at++;
    else out.splice(at++, 0, '');
  }
  const following = out[at];
  const tail = (following === undefined || following.trim() === '') ? [] : [''];
  out.splice(at, 0, ...body, ...tail);
  return done(out.join('\n'), true, `promoted: ${body.length} staged line(s) moved into ## [${version}]`);
}

/**
 * Where the `## ` section starting at `from` ends (exclusive): the next `## ` heading, or for the last section the start of
 * the trailing link-reference block, so those definitions are never swept up as section content.
 * @param {string[]} lines @param {number} from
 */
function sectionEnd(lines, from) {
  const fenced = fenceMask(lines);
  const next = lines.findIndex((l, i) => i > from && !fenced[i] && /^## /.test(l));
  if (next >= 0) return next;
  let end = lines.length;
  while (end > 0 && lines[end - 1].trim() === '') end--;
  // the trailing link-reference block is the run of `[key]: url` definitions at EOF whose keys name an existing `## [key]`
  // heading. Walking up from the last non-blank line, it ends at the first definition naming no such heading; that one and
  // everything above it down to `from` is body content that promotes with its section. Accepted cost: a file-final definition
  // naming no heading pulls the whole run at EOF into the body, even a ref above it that does name one. That's the rule's edge.
  let refs = end;
  while (refs > from + 1) {
    const m = lines[refs - 1].match(/^\[([^\]]+)\]:\s/);
    if (!m) break;
    const headingRe = new RegExp(`^## \\[${escapeRe(m[1])}\\]`);
    if (!lines.some((l, i) => !fenced[i] && headingRe.test(l))) break;
    refs--;
  }
  return refs < end ? refs : lines.length;
}

/**
 * Does the `## [<version>]` section hold nothing but blank lines and `###`/`####` subheadings? An absent heading (or no
 * version) counts as empty: nothing sits in a section that doesn't exist. Any other non-blank line is content, prose
 * paragraphs included, since every released section in this repo's CHANGELOG.md opens with prose before any bullet and a
 * bullet-only rule would call real sections empty and fire the close's halt on every close.
 * @param {string} text @param {string} version
 */
function releaseSectionEmpty(text, version) {
  if (!version) return true;
  const lines = String(text).split('\n');
  const headingRe = new RegExp(`^## \\[${escapeRe(version)}\\]`);
  const fenced = fenceMask(lines);
  const at = lines.findIndex((l, i) => !fenced[i] && headingRe.test(l));
  if (at < 0) return true;
  const stop = sectionEnd(lines, at);
  for (let i = at + 1; i < stop; i++) {
    const l = lines[i];
    if (l.trim() === '') continue;
    if (/^#{3,4}\s/.test(l)) continue;
    return false;
  }
  return true;
}
