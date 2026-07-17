#!/usr/bin/env node
// @ts-check
// release-bump.mjs - the workflow-facing I/O seam over lib/release-decision.mjs.
// At a distributed-plugin milestone close (milestone.md step 2, before the tag),
// it bumps `.claude-plugin/plugin.json`'s `version` to the shipping release and
// scaffolds a dated CHANGELOG entry, so a plugin release stops shipping with a
// stale manifest version (REL-01/REL-02). Unlike land-cleanup.mjs (advisory,
// never mutates), this seam WRITES - like git-publish.mjs it gets its own file,
// CONTRACTS row, and test; all the tested logic lives in the pure
// lib/release-decision.mjs, this is the thin config + file I/O around it.
//
// Auto-detect gating (D-04): the bump fires only when `.claude-plugin/plugin.json`
// is present; a non-plugin project has none, so the seam returns action:"skip"
// and writes nothing. No new config key - the manifest's presence is the switch.
//
// Subcommand (prints one JSON line, seam convention lib/seam-io.mjs; never
// process.exit() after emit):
//   bump [--dir <path>] [--version <v>] [--date <YYYY-MM-DD>]
//     --dir      repo/planning root (default cwd).
//     --version  override the derived target ($ARGUMENTS pass-through).
//     --date     the CHANGELOG entry date (test hook; default today, UTC).
// The bump writes `version` only where the field already exists: plugin.json is
// rewritten, marketplace.json (which carries none) yields `skip` and is left
// byte-untouched (D-03). A null-derivable target yields action:"error",
// reason:"no-target-version" and writes NOTHING - never a `## [null]` CHANGELOG
// heading (the Phase-1/Phase-2 null-value lesson).
'use strict';

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { emit } from './lib/seam-io.mjs';
import { atomicWrite } from './lib/planning-files.mjs';
import {
  deriveTargetVersion, decideManifestBump, prependChangelogEntry,
} from './lib/release-decision.mjs';

/** Read a file, or "" if missing/unreadable (a missing surface is not fatal). */
function readText(file) {
  try { return readFileSync(file, 'utf8'); }
  catch { return ''; }
}

/**
 * Build the release-tag URL a CHANGELOG link reference points at, from the
 * manifest's `homepage` (or `repository` with a trailing `.git` stripped):
 * `<base>/releases/tag/v<version>`. Falls back to `<base>/releases` when a base
 * exists but no version, and to "" when the manifest names no base at all.
 * @param {Record<string, any>} manifest @param {string} version
 */
function changelogUrl(manifest, version) {
  let base = '';
  if (typeof manifest.homepage === 'string' && manifest.homepage) base = manifest.homepage;
  else if (typeof manifest.repository === 'string' && manifest.repository) base = manifest.repository.replace(/\.git$/, '');
  base = base.replace(/\/$/, '');
  if (!base) return '';
  return version ? `${base}/releases/tag/v${version}` : `${base}/releases`;
}

/**
 * Parse a JSON manifest at `file`, or null when it is absent/unreadable/invalid
 * - a caller distinguishes "no manifest" (skip) from a parsed object.
 * @param {string} file
 */
function readManifest(file) {
  if (!existsSync(file)) return null;
  try { return JSON.parse(readFileSync(file, 'utf8')); }
  catch { return null; }
}

function bump(dir, versionArg, dateArg) {
  const date = dateArg || new Date().toISOString().slice(0, 10);
  const pluginPath = join(dir, '.claude-plugin', 'plugin.json');

  // Auto-detect gating (D-04): no plugin manifest -> skip, write nothing.
  const manifest = readManifest(pluginPath);
  if (manifest === null) {
    emit({ ok: true, action: 'skip', reason: 'no-plugin-manifest',
      detail: 'no .claude-plugin/plugin.json: non-plugin project, nothing to bump' });
    return;
  }

  // Derive the shipping target: --version overrides, else ### Active / ROADMAP.
  const target = deriveTargetVersion({
    argVersion: versionArg,
    projectText: readText(join(dir, '.planning', 'PROJECT.md')),
    roadmapText: readText(join(dir, '.planning', 'ROADMAP.md')),
  });

  // Null target: refuse to write anything (never a `## [null]` heading).
  const primary = decideManifestBump(manifest.version, target);
  if (primary.action === 'error') {
    emit({ ok: true, action: 'error', reason: 'no-target-version', target: null,
      manifest: { from: null, to: null, bumped: false }, siblings: [], changelog: { changed: false },
      detail: 'no derivable version: plugin.json present but nothing to bump, wrote nothing' });
    return;
  }

  // Primary manifest: write only on a real bump (preserve field order).
  if (primary.action === 'bump') {
    manifest.version = target;
    atomicWrite(pluginPath, JSON.stringify(manifest, null, 2) + '\n');
  }

  // Sibling manifests: write `version` only where it exists. marketplace.json
  // carries none, so decideManifestBump returns skip and it is left untouched.
  const siblings = [];
  const siblingPath = join(dir, '.claude-plugin', 'marketplace.json');
  const sibling = readManifest(siblingPath);
  if (sibling !== null) {
    const d = decideManifestBump(sibling.version, target);
    if (d.action === 'bump') {
      sibling.version = target;
      atomicWrite(siblingPath, JSON.stringify(sibling, null, 2) + '\n');
    }
    siblings.push({ file: '.claude-plugin/marketplace.json', action: d.action, bumped: d.bumped });
  }

  // Changelog: only with a non-null target (guarded above via the error return).
  let changelog = { changed: false };
  const clPath = join(dir, 'CHANGELOG.md');
  if (existsSync(clPath) && target) {
    const url = changelogUrl(manifest, target);
    const res = prependChangelogEntry(readText(clPath), { version: target, date, url });
    if (res.changed) atomicWrite(clPath, res.text);
    changelog = { changed: res.changed };
  }

  const action = primary.action === 'bump' ? 'bumped' : primary.action; // bump|noop|skip
  emit({ ok: true, action, target, reason: primary.reason,
    manifest: { from: primary.from, to: primary.to, bumped: primary.bumped },
    siblings, changelog });
}

// --- dispatch ----------------------------------------------------------------

const argv = process.argv.slice(2);
const cmd = argv[0];
/** Value after a `--flag`, or undefined if the flag is absent. */
function flag(name) {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

try {
  if (cmd === 'bump') {
    bump(flag('--dir') || process.cwd(), flag('--version'), flag('--date'));
  } else {
    emit({ ok: false, reason: 'usage',
      detail: 'subcommand: bump [--dir <path>] [--version <v>] [--date <YYYY-MM-DD>]' });
  }
} catch (e) {
  emit({ ok: false, reason: 'internal', detail: e && e.message ? e.message : String(e) });
}
