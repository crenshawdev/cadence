// @ts-check
// planning/detect-surfaces.mjs - `detect-surfaces`: the disk half of
// lib/surface-scan.mjs, and the evidence the one-time risk-surface question is
// asked against.
//
// `SCAN_SKIP_DIRS`, `SCAN_MANIFESTS` and `manifestDeps` are the walk's own and
// are read from nowhere else (D-05). The `--root` default is the declared row's,
// applied at the dispatch door in planning.mjs.
'use strict';

import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fail, ok, read } from './core.mjs';
import { CATEGORIES, interviewOptions, scanTree } from '../lib/surface-scan.mjs';

// ---------------------------------------------------------------------------
// detect-surfaces - the disk half of lib/surface-scan.mjs, and the evidence the
// one-time `review.triggers.risk_surface.surfaces` question is asked against.
// A seam and not model judgment for the reason detect-commands is one: a model
// reading a tree and deciding what it "looks like" is the keyword pass D-14
// measured and rejected, and nothing in CI can prove a judgment fired.
//
// `--root` is the PROJECT root, deliberately NOT `--dir`. It is read TWO
// LEVELS deep - one more than detect-commands, because that is the depth D-14's
// own measurement used and because `db/migrate` and `packages/api` are where
// the structure actually shows. Ignored trees (node_modules, .git, build
// output) are skipped: they are not the project's structure, and walking
// node_modules would declare every category on every JS project.
//
// Finding nothing is ok:true with `inconclusive:true` and all eight
// recommended - a successful check with a negative answer, like plan-overlap.
// A manifest that cannot be read or parsed contributes nothing and is NAMED in
// warnings[] rather than throwing.
// ---------------------------------------------------------------------------

/** Directory names never descended into: not the project's own structure. */
const SCAN_SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', 'out',
  'target', 'vendor', 'coverage', '.venv', 'venv', '__pycache__', '.next', '.cache']);

/** The manifests whose declared dependency names the scan reads. */
const SCAN_MANIFESTS = ['package.json', 'Cargo.toml', 'pyproject.toml',
  'go.mod', 'requirements.txt'];

/**
 * Dependency names declared by one manifest. Each arm reads the shape it can
 * read exactly and returns [] otherwise: a name this misses costs a broader
 * recommendation, and a name it invents costs a user narrowing to a category
 * they do not have.
 * @param {string} name @param {string} text @returns {string[]}
 */
function manifestDeps(name, text) {
  if (name === 'package.json') {
    const pkg = JSON.parse(text);
    if (!pkg || typeof pkg !== 'object' || Array.isArray(pkg)) return [];
    return ['dependencies', 'devDependencies', 'peerDependencies']
      .flatMap((k) => (pkg[k] && typeof pkg[k] === 'object' && !Array.isArray(pkg[k])
        ? Object.keys(pkg[k]) : []));
  }
  if (name === 'go.mod') {
    // `module.path/name v1.2.3` inside or outside a require block; the LAST
    // path segment is the package name a signal table can match.
    return text.split('\n')
      .map((l) => l.replace(/\/\/.*$/, '').trim())
      .filter((l) => /^(require\s+)?[a-z0-9][\w.\-]*(\.[a-z]{2,})?\/\S+\s+v/.test(l))
      .map((l) => l.replace(/^require\s+/, '').split(/\s+/)[0]);
  }
  if (name === 'requirements.txt') {
    return text.split('\n')
      .map((l) => l.replace(/#.*$/, '').trim())
      .filter((l) => /^[A-Za-z][\w.\-]*/.test(l))
      .map((l) => (l.match(/^[A-Za-z][\w.\-]*/) || [''])[0]);
  }
  // Cargo.toml / pyproject.toml: TOML, read by SECTION rather than by line, so
  // `name = "my-app"` under [package] is not collected as a dependency of
  // itself. Only a table whose header mentions dependencies contributes.
  /** @type {string[]} */
  const out = [];
  let inDeps = false;
  let inDepArray = false;
  for (const raw of text.split('\n')) {
    const line = raw.replace(/#.*$/, '').trim();
    const header = line.match(/^\[+([^\]]+)\]+$/);
    if (header) { inDeps = /dependencies/i.test(header[1]); inDepArray = false; continue; }
    // PEP 621 puts `dependencies = ["flask>=3", ...]` under `[project]` - a
    // header the section test above never matches - so a section-scoped read
    // alone loses every pyproject-only project's evidence. Track the ARRAY by
    // its KEY instead, across however many lines it spans, which is the one
    // place a dependency list can hide under an unrelated header.
    // The closing `]` is looked for OUTSIDE the quotes: a PEP 508 extra
    // (`"requests[socks]"`) carries its own bracket, and treating that as the
    // end of the array drops every entry after it.
    const unquoted = (s) => s.replace(/(["']).*?\1/g, '');
    if (inDepArray) {
      for (const m of line.matchAll(/["']([A-Za-z][\w.\-]*)[^"']*["']/g)) out.push(m[1]);
      if (unquoted(line).includes(']')) inDepArray = false;
      continue;
    }
    // Anchored to the EXACT key: a tool table's `ignored-dependencies` is a
    // setting, not a dependency, and reading it evidences a surface the
    // project does not have.
    const depArray = line.match(/^["']?dependencies["']?\s*=\s*\[/i);
    if (depArray) {
      for (const m of line.matchAll(/["']([A-Za-z][\w.\-]*)[^"']*["']/g)) out.push(m[1]);
      if (!unquoted(line).includes(']')) inDepArray = true;
      continue;
    }
    if (!inDeps) continue;
    const key = line.match(/^["']?([A-Za-z][\w.\-]*)["']?\s*=/);
    if (key) out.push(key[1]);
    // A dependency table whose values are arrays (`dev = ["pytest"]`).
    for (const m of line.matchAll(/["']([A-Za-z][\w.\-]*)[^"']*["']/g)) out.push(m[1]);
  }
  return out;
}

/**
 * @param {string} root
 * @param {string | true | undefined} answeredArg the `--answered` value: the
 *   set a config layer already holds, comma-separated, or absent when nobody
 *   has answered
 */
function cmdDetectSurfaces(root, answeredArg) {
  // The ALREADY-ANSWERED set, read exactly the way `risk-check run` reads
  // `--surfaces`: split, trim, drop empties, then refuse. It arrives as a flag
  // and is never read from config HERE, so `/cad-config`'s re-entrant arm hands
  // over the effective value it already resolved through the read face and this
  // seam stays the pure map from a tree to an answer. A token outside the eight
  // is a malformed CALL - refused rather than dropped, because a caller who
  // mistyped the set they hold would otherwise be offered a narrower option
  // list built from an answer nobody gave.
  /** @type {string[]} */
  let answered = [];
  if (answeredArg !== undefined) {
    const raw = typeof answeredArg === 'string' ? answeredArg : '';
    const tokens = raw.split(',').map((t) => t.trim()).filter(Boolean);
    if (!tokens.length) {
      return fail('bad-args', 'detect-surfaces --answered needs a comma-separated list after it: --answered <a,b,c>',
        'list the surfaces already answered as one comma-separated value, or leave --answered off'
        + ' entirely when none have been');
    }
    const unknown = tokens.filter((t) => !CATEGORIES.includes(t));
    if (unknown.length) {
      return fail('bad-args',
        `detect-surfaces --answered names ${unknown.join(', ')}, which is not one of ${CATEGORIES.join(', ')}`,
        'correct the token(s) the detail names against the list beside them, then re-run - dropping'
        + ' one instead would offer a narrower option list built from an answer nobody gave');
    }
    answered = tokens;
  }

  /** @type {string[]} */
  const warnings = [];
  /** @type {string[]} */
  const dirs = [];
  /** @type {string[]} */
  const files = [];
  /** @type {Set<string>} */
  const extensions = new Set();
  /** @type {string[]} */
  const manifests = [];
  /** @type {string[]} */
  const dependencies = [];

  /** The errno the ROOT listing failed with, when it did. */
  let rootError = null;
  /**
   * One directory level: its entries recorded, its subdirectories returned -
   * or null when the level could not be listed at all, which only the ROOT
   * treats as a failure (a subdirectory that cannot be read is one warning and
   * a narrower scan, never a refusal to answer).
   * @param {string} dir @param {string} label @returns {string[] | null}
   */
  const level = (dir, label) => {
    /** @type {string[]} */
    const subdirs = [];
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true, encoding: 'utf8' });
    } catch (e) {
      if (!label) { rootError = e.code || e.message; return null; }
      warnings.push(`${label} could not be listed and was skipped (${e.code || e.message})`);
      return subdirs;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        dirs.push(entry.name);
        if (!SCAN_SKIP_DIRS.has(entry.name)) subdirs.push(entry.name);
        continue;
      }
      files.push(entry.name);
      const dot = entry.name.lastIndexOf('.');
      if (dot > 0) extensions.add(entry.name.slice(dot));
      if (!SCAN_MANIFESTS.includes(entry.name)) continue;
      const where = label ? `${label}/${entry.name}` : entry.name;
      manifests.push(where);
      const text = read(join(dir, entry.name));
      if (text === null) {
        warnings.push(`${where} could not be read; no dependency was taken from it`);
        continue;
      }
      try {
        dependencies.push(...manifestDeps(entry.name, text));
      } catch (e) {
        warnings.push(`${where} failed to parse and was skipped: ${e.message}`);
      }
    }
    return subdirs;
  };

  const roots = level(root, '');
  if (roots === null) {
    return fail('no-root', `${root} cannot be listed (${rootError})`,
      'point --root at a directory this process can list - the surface scan walks the tree down'
      + ' from there');
  }
  for (const sub of roots) level(join(root, sub), sub);

  const scan = scanTree({ dirs, files, extensions: [...extensions], dependencies });
  ok({
    root,
    // ALWAYS present, every field, even when empty - the same always-report
    // convention detect-commands states for its `source` block. A caller has to
    // be able to tell "the structure evidences nothing" from "did not look".
    manifests,
    evidenced: scan.evidenced,
    silent: scan.silent,
    unspeakable: scan.unspeakable,
    inconclusive: scan.inconclusive,
    recommended: scan.recommended,
    // The QUESTION itself, built here rather than composed by a model at the
    // ask site. Always present, like every field above it: an empty tree still
    // gets its one all-eight choice, so "the structure evidences nothing" and
    // "nobody built a list" stay distinguishable. #206 is what a composed list
    // cost - the same eight categories in slot 1 and in the last slot, with no
    // value for any check to read.
    options: interviewOptions(scan, answered),
    ...(warnings.length ? { warnings } : {}),
  });
}

export { cmdDetectSurfaces };
