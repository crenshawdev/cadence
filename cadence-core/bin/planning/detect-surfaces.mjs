// @ts-check
// planning/detect-surfaces.mjs - `detect-surfaces`: the disk half of lib/surface-scan.mjs (the risk-surface evidence)
// SCAN_SKIP_DIRS, SCAN_MANIFESTS and manifestDeps are the walk's own and read nowhere else
'use strict';

import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fail, ok, read } from './core.mjs';
import { CATEGORIES, interviewOptions, parseSurfaceList, scanTree } from '../lib/surface-scan.mjs';

// a seam, not model judgment: a model guessing what a tree "looks like" is the keyword pass that was rejected
// --root is the project root, not --dir, read two levels deep: `db/migrate` and `packages/api` are where structure is
// ignored trees (node_modules, .git, build output) are skipped, or every JS project would declare every category
// finding nothing is ok:true with `inconclusive:true` and all eight recommended; a bad manifest warns, never throws

/** Directory names never descended into: not the project's own structure. */
const SCAN_SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', 'out',
  'target', 'vendor', 'coverage', '.venv', 'venv', '__pycache__', '.next', '.cache']);

/** The manifests whose declared dependency names the scan reads. */
const SCAN_MANIFESTS = ['package.json', 'Cargo.toml', 'pyproject.toml',
  'go.mod', 'requirements.txt'];

/**
 * Dependency names declared by one manifest. Each arm reads the shape it can read exactly and returns [] otherwise:
 * a name this misses costs a broader recommendation, a name it invents costs a narrowing to a category they lack.
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
    // `module.path/name v1.2.3` in or out of a require block; the last path segment is what a signal table matches
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
  // Cargo.toml and pyproject.toml are read by section, so `name = "my-app"` under [package] isn't its own dependency
  /** @type {string[]} */
  const out = [];
  let inDeps = false;
  let inDepArray = false;
  for (const raw of text.split('\n')) {
    const line = raw.replace(/#.*$/, '').trim();
    const header = line.match(/^\[+([^\]]+)\]+$/);
    if (header) { inDeps = /dependencies/i.test(header[1]); inDepArray = false; continue; }
    // PEP 621 puts `dependencies = ["flask>=3", ...]` under `[project]`, which the section test never matches
    // so track the array by its key across however many lines it spans
    // the closing `]` is looked for outside the quotes: a PEP 508 extra like `"requests[socks]"` has its own bracket
    const unquoted = (s) => s.replace(/(["']).*?\1/g, '');
    if (inDepArray) {
      for (const m of line.matchAll(/["']([A-Za-z][\w.\-]*)[^"']*["']/g)) out.push(m[1]);
      if (unquoted(line).includes(']')) inDepArray = false;
      continue;
    }
    // anchored to the exact key: a tool table's `ignored-dependencies` is a setting and would evidence a false surface
    const depArray = line.match(/^["']?dependencies["']?\s*=\s*\[/i);
    if (depArray) {
      for (const m of line.matchAll(/["']([A-Za-z][\w.\-]*)[^"']*["']/g)) out.push(m[1]);
      if (!unquoted(line).includes(']')) inDepArray = true;
      continue;
    }
    if (!inDeps) continue;
    const key = line.match(/^["']?([A-Za-z][\w.\-]*)["']?\s*=/);
    if (key) out.push(key[1]);
    // a dependency table whose values are arrays, like `dev = ["pytest"]`
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
  // the already-answered set is read the way `risk-check run` reads --surfaces, by parseSurfaceList, then refused
  // it arrives as a flag, never from config, so /cad-config's re-entrant arm hands over the value it resolved
  // a token outside the eight is refused, not dropped: a mistyped set would get a list built from an answer nobody gave
  /** @type {string[]} */
  let answered = [];
  if (answeredArg !== undefined) {
    const { tokens, unknown } = parseSurfaceList(answeredArg);
    if (!tokens.length) {
      return fail('bad-args', 'detect-surfaces --answered needs a comma-separated list after it: --answered <a,b,c>',
        'list the surfaces already answered as one comma-separated value, or leave --answered off'
        + ' entirely when none have been');
    }
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
   * One directory level: entries recorded, subdirectories returned, or null when the level couldn't be listed at all.
   * Only the root treats that as a failure; a subdirectory that can't be read is one warning and a narrower scan.
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
    // every field is always present, even empty, so "the structure evidences nothing" differs from "did not look"
    manifests,
    evidenced: scan.evidenced,
    silent: scan.silent,
    unspeakable: scan.unspeakable,
    inconclusive: scan.inconclusive,
    recommended: scan.recommended,
    // the question is built here, not composed by a model at the ask site
    // an empty tree still gets its one all-eight choice; a composed list once gave the same eight twice (#206)
    options: interviewOptions(scan, answered),
    ...(warnings.length ? { warnings } : {}),
  });
}

export { cmdDetectSurfaces };
