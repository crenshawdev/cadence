// @ts-check
// release-decision.mjs - the pure, testable core of the release-bump seam
// (Phase 3, REL-01/REL-02). Zero-dep (node builtins only, and it uses none):
// three TOTAL functions that decide, from prose + manifest state, the target
// version a distributed-plugin release should carry, whether the manifest
// needs a bump, and how a version-stamped CHANGELOG entry is scaffolded. It
// never does I/O - the release-bump.mjs seam reads the files and writes them;
// this only decides and rewrites text in memory. Mirrors close-decision.mjs's
// discipline: bad/missing inputs never throw, and a version-less project yields
// null rather than an invented version (the Phase-1 null-version lesson).

import { activeVersion, titleVersion } from './branch-decision.mjs';

/**
 * Derive the bare-semver target version for the release, honoring the same
 * precedence branch derivation uses: an explicit `$ARGUMENTS` version first,
 * then `PROJECT.md ### Active`, then the `ROADMAP.md` title. A single leading
 * `v` is stripped so the manifest carries bare semver (`1.1.0-rc.2`, not
 * `v1.1.0-rc.2`, matching plugin.json's field). Returns null when no version is
 * derivable - never invent one (Phase-1 null lesson); the seam turns null into
 * an explicit `no-target-version` signal rather than a corrupt write.
 *
 * @param {{ argVersion?: string|null, projectText?: string, roadmapText?: string }} args
 * @returns {string | null}
 */
export function deriveTargetVersion({ argVersion, projectText, roadmapText } = {}) {
  const raw = (typeof argVersion === 'string' && argVersion.trim())
    || activeVersion(projectText || '')
    || titleVersion(roadmapText || '');
  if (!raw) return null;
  return String(raw).trim().replace(/^v/, '');
}

/**
 * Decide whether a manifest's `version` needs to change. Total: any input shape
 * yields a verdict, never a throw.
 *
 * - falsy `targetVersion` (nothing derivable) -> `error`, reason
 *   `no-target-version`, bumped:false - the seam must not write a `null` target.
 * - `currentVersion` undefined/absent (the manifest carries no `version` field,
 *   e.g. marketplace.json) -> `skip`, reason `no-version-field`, bumped:false
 *   (D-03: write `version` only where it already exists).
 * - `currentVersion === targetVersion` -> `noop`, bumped:false (idempotency: a
 *   second close never double-bumps).
 * - otherwise -> `bump`, bumped:true, from/to set.
 *
 * @param {string|null|undefined} currentVersion
 * @param {string|null|undefined} targetVersion
 * @returns {{ action:'bump'|'noop'|'skip'|'error', bumped:boolean, from:string|null, to:string|null, reason:string }}
 */
export function decideManifestBump(currentVersion, targetVersion) {
  const to = (typeof targetVersion === 'string' && targetVersion) ? targetVersion : null;
  if (!to) {
    return { action: 'error', bumped: false, from: null, to: null,
      reason: 'no-target-version: nothing derivable, refuse to write' };
  }
  if (currentVersion === undefined || currentVersion === null) {
    return { action: 'skip', bumped: false, from: null, to,
      reason: 'no-version-field: manifest carries no version, leave it untouched' };
  }
  const from = String(currentVersion);
  if (from === to) {
    return { action: 'noop', bumped: false, from, to,
      reason: 'already at target: idempotent, no double-bump' };
  }
  return { action: 'bump', bumped: true, from, to,
    reason: `bump ${from} -> ${to}` };
}

/**
 * Prepend a version-stamped CHANGELOG entry: a pure text rewrite returning
 * `{ text, changed, reason }`. Idempotent - a no-op (`changed:false`) when a
 * `## [<version>]` heading already exists, so a re-run never stacks a second
 * entry. Otherwise it inserts, without altering any existing entry or link
 * reference:
 * - `## [<version>] - <date>\n\n` immediately before the first `^## \[` version
 *   heading (or, if none exists, before the first `## ` heading / at end);
 * - `[<version>]: <url>\n` immediately before the first `^\[...\]:` link
 *   reference (or appended at the end when none exists).
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
  const linkRef = `[${version}]: ${url}\n`;
  const lines = text.split('\n');

  // Insert the heading immediately before the first existing version heading;
  // fall back to the first `## ` heading, else append after the file body.
  let headingAt = lines.findIndex((l) => /^## \[/.test(l));
  if (headingAt < 0) headingAt = lines.findIndex((l) => /^## /.test(l));
  if (headingAt < 0) {
    // No heading anchor at all: append the heading block at the end.
    const base = text.endsWith('\n') || text === '' ? text : text + '\n';
    let out = base + (base.endsWith('\n\n') || base === '' ? '' : '\n') + heading;
    out += linkRef;
    return { text: out, changed: true, reason: 'appended: no heading anchor, entry added at end' };
  }
  lines.splice(headingAt, 0, heading.replace(/\n$/, ''));

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

/** Escape a version string for safe use inside a RegExp. @param {string} s */
function escapeRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
