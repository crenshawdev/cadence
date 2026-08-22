// @ts-check
// release-decision.mjs - the pure, testable core of the release-bump seam
// (REL-01/REL-02, hardened by REL-03). Zero-dep (node builtins only, and it
// uses none). Five TOTAL functions, taking the shipping version as GIVEN - it
// is the `--version` the milestone workflow confirmed with the user, and this
// module derives no version of its own from anything:
//   normalizeTargetVersion  - the explicit version, trimmed and v-stripped
//   compareVersions         - semver §11 precedence, or null when unreadable
//   decideManifestBump      - bump / noop / skip / refuse, with a named code
//   prependChangelogEntry   - scaffold the dated heading + link reference
//   promoteUnreleased       - move staged content into that dated section
// It never does I/O - the release-bump.mjs seam reads the files and writes
// them; this only decides and rewrites text in memory. Mirrors
// close-decision.mjs's discipline: bad/missing inputs never throw, and an
// absent version yields null rather than an invented one (the Phase-1
// null-version lesson).

/**
 * Fence-state scanner: an opening fence is three or more backticks or tildes
 * with up to three leading spaces, a closing fence is the same character at
 * least as long carrying no info string, and the delimiter line itself is
 * never a heading. Mirrors the module-private `fenceScanner` in
 * lib/planning-files.mjs byte-for-shape; not imported from there because that
 * module carries `node:fs` and this file's header states it never does I/O.
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
 * Per-line fence state for a whole document, fed in order so the state at
 * each index is the state a reader of the whole document would have at that
 * line. `true` means the line is a fence delimiter or sits inside a fenced
 * block - never a heading, for any `^## ` scan in this module.
 * @param {string[]} lines
 * @returns {boolean[]}
 */
function fenceMask(lines) {
  const fenced = fenceScanner();
  return lines.map((l) => fenced(l));
}

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

/**
 * Decide whether a manifest's `version` needs to change. Total: any input shape
 * yields a verdict, never a throw.
 *
 * Every verdict carries a `code`: a stable machine token the seam emits as its
 * `reason`, while the human sentence in `reason` becomes the seam's `detail`.
 * The codes are a CLOSED set, owned HERE - the seam owns its own disjoint set
 * (`no-plugin-manifest`, `unreadable-manifest`, `usage`, `internal`) in
 * release-bump.mjs's header, so one list has one owner and the two can never
 * disagree:
 *
 *   no-target-version | unparseable-version | no-version-field |
 *   already-at-target | downgrade | not-an-upgrade | bump
 *
 * The arms are FIRST-MATCH-WINS, in this order. The two TARGET checks come
 * before the two manifest checks on purpose: the target is the same for every
 * manifest in one run, so a bad number refuses them all alike and can never
 * write one file and refuse the next.
 *
 *   1. falsy `targetVersion` -> `refuse` `no-target-version` - the seam must
 *      not write a `null` target. `refuse` is the vocabulary
 *      lib/publish-decision.mjs already uses for exactly this, and one word for
 *      one concept keeps the seam's mapping a single arm.
 *   2. target out of grammar -> `refuse` `unparseable-version`, naming the side
 *      and the offending value. It does NOT fall back to the old
 *      any-difference bump: the manifests that most need this guard are
 *      precisely the ones carrying a version nothing can read.
 *   3. `currentVersion` undefined/absent (the manifest carries no `version`
 *      field, e.g. marketplace.json) -> `skip` `no-version-field` (D-03: write
 *      `version` only where it already exists).
 *   4. current out of grammar -> `refuse` `unparseable-version`.
 *   5. `currentVersion === targetVersion` -> `noop` `already-at-target`
 *      (idempotency: a second close never double-bumps).
 *   6. target sorts BELOW current -> `refuse` `downgrade`, naming both. There
 *      is no override flag and no config key (D-07): an escape hatch no caller
 *      passes is dead reach.
 *   7. equal in precedence but textually different, i.e. a build-metadata-only
 *      difference -> `refuse` `not-an-upgrade`.
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
 * Prepend a version-stamped CHANGELOG entry: a pure text rewrite returning
 * `{ text, changed, reason }`. Idempotent - a no-op (`changed:false`) when a
 * `## [<version>]` heading already exists, so a re-run never stacks a second
 * entry. Otherwise it inserts, without altering any existing entry or link
 * reference:
 * - `## [<version>] - <date>\n\n` immediately before the first *released*
 *   version heading, skipping a leading `## [Unreleased]` section (or, when no
 *   released heading exists, after an Unreleased section / before the first
 *   `## ` heading / at end);
 * - `[<version>]: <url>\n` immediately before the first `^\[...\]:` link
 *   reference (or appended at the end when none exists), omitted entirely when
 *   `url` is empty.
 * The entry's bullet prose is left for the model to author (D-06); this scaffold
 * owns the deterministic heading + link reference only.
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
  // Omit the link reference entirely when no URL is derivable: an empty
  // `[version]: ` line is a malformed markdown reference, worse than none.
  const linkRef = url ? `[${version}]: ${url}\n` : '';
  const lines = text.split('\n');

  // Choose the heading anchor: insert immediately before the first *released*
  // version heading, skipping a leading `## [Unreleased]` section (Keep a
  // Changelog pins Unreleased at the top, so a release must land below it, not
  // above). Fall back to just after an Unreleased section, then the first `## `
  // heading, else append after the file body.
  // A `## ` line inside a fenced code block is not a heading: computed once,
  // before any splice, against the document's real structure (D-09).
  const fenced = fenceMask(lines);
  const isReleased = (l) => /^## \[/.test(l) && !/^## \[unreleased\]/i.test(l);
  let headingAt = lines.findIndex((l, i) => !fenced[i] && isReleased(l));
  if (headingAt < 0) {
    const unreleasedAt = lines.findIndex((l, i) => !fenced[i] && /^## \[unreleased\]/i.test(l));
    if (unreleasedAt >= 0) {
      // Insert before the next `## ` heading after Unreleased (the end of its
      // section); -1 (Unreleased is the last section) falls through to append.
      headingAt = lines.findIndex((l, i) => i > unreleasedAt && !fenced[i] && /^## /.test(l));
    } else {
      headingAt = lines.findIndex((l, i) => !fenced[i] && /^## /.test(l));
    }
  }
  if (headingAt < 0) {
    // No usable heading anchor: append the heading block at the end.
    const base = text.endsWith('\n') || text === '' ? text : text + '\n';
    let out = base + (base.endsWith('\n\n') || base === '' ? '' : '\n') + heading;
    out += linkRef;
    return { text: out, changed: true, reason: 'appended: no heading anchor, entry added at end' };
  }
  lines.splice(headingAt, 0, heading.replace(/\n$/, ''));

  // No URL -> the link reference is omitted; the heading placement is the whole
  // change.
  if (!linkRef) {
    return { text: lines.join('\n'), changed: true, reason: 'inserted: heading placed, no url so link reference omitted' };
  }

  // Insert the link reference immediately before the first existing link ref;
  // append at the end when none exists. Re-find on the mutated lines.
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
 * Promote everything staged under `## [Unreleased]` INTO the dated
 * `## [<version>]` section, so a release ships the notes written for it instead
 * of a dated heading over an empty section while the real content sits above
 * it. A pure text rewrite returning `{ text, changed, reason, sectionEmpty }`;
 * an unchanged result returns the input text byte-for-byte.
 *
 * Deliberately NOT folded into prependChangelogEntry, and that function's
 * heading-exists early return stays (D-04, D-09): the two have DIFFERENT
 * idempotency conditions - heading insertion is idempotent on the dated heading
 * existing, promotion is idempotent on the Unreleased body being empty - which
 * is exactly why this is a second function rather than a branch inside the
 * first. So promotion runs on EVERY run whose Unreleased body is non-empty, and
 * a re-run that staged new content promotes that too.
 *
 * `## [Unreleased]` survives as an empty stub: Keep a Changelog pins it at the
 * top, and it is what the next cycle stages into.
 *
 * `sectionEmpty` describes the RETURNED text: true when nothing sits under
 * `## [<version>]` - nothing promoted, nothing already there, or no such
 * heading at all. The seam surfaces it so a close authors the notes before the
 * bump commit rather than shipping a dated heading over silence.
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

  // Bound the body, then trim its blank edges. The trailing link-reference
  // block is never inside the body; a reference definition sitting BETWEEN
  // bullets is, so it travels with the content that cites it.
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
  // Splice the whole staged span out, leaving one blank line so the Unreleased
  // heading survives as a stub.
  out.splice(unrelAt + 1, bodyEnd - (unrelAt + 1), '');
  // RE-FIND the release heading on the mutated array rather than doing
  // arithmetic on a stale index - the same discipline the link-reference insert
  // above uses. Re-mask too: the splice shifted every line index below it.
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
 * Where the `## ` section starting at `from` ends (exclusive): the next `## `
 * heading, or - when this is the file's last section - the start of the
 * TRAILING link-reference block, so those definitions are never swept up as
 * section content.
 * @param {string[]} lines @param {number} from
 */
function sectionEnd(lines, from) {
  const fenced = fenceMask(lines);
  const next = lines.findIndex((l, i) => i > from && !fenced[i] && /^## /.test(l));
  if (next >= 0) return next;
  let end = lines.length;
  while (end > 0 && lines[end - 1].trim() === '') end--;
  // D-05: the trailing link-reference block is the run of `[key]: url`
  // definitions at EOF whose keys name an existing `## [key]` heading in the
  // document. Walking up from the last non-blank line, the block ends at the
  // first definition whose key names no such heading - that definition and
  // everything above it (down to `from`) is body content that promotes with
  // its section, not a trailing reference. Accepted cost, stated rather than
  // patched: a file-final definition naming no heading pulls the WHOLE run at
  // EOF into the body, even a ref line above it whose own key does name a
  // heading - the rule's stated edge, not a regression to repair with a
  // second exclusion.
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
 * Does the `## [<version>]` section hold nothing but blank lines and
 * `###`/`####` subheadings? An absent heading (or no version at all) counts
 * as empty - there is nothing in a section that does not exist. Any OTHER
 * non-blank line is content, including a prose paragraph with no bullets
 * (D-03): every released section in this repo's own CHANGELOG.md opens with
 * prose before any bullet, so a bullet-only rule would report real authored
 * sections as empty and fire the close's halt on every close.
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

/** Escape a version string for safe use inside a RegExp. @param {string} s */
function escapeRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
