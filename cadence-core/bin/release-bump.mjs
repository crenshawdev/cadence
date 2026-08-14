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
//     --version  REQUIRED: the shipping release number, the one the milestone
//                workflow already confirmed with the user. Its absence refuses
//                (`no-target-version`) - the seam derives no number of its own.
//     --date     the CHANGELOG entry date (test hook; default today, UTC).
// The bump writes `version` only where the field already exists: plugin.json is
// rewritten, marketplace.json (which carries none) yields `skip` and is left
// byte-untouched (D-03).
//
// Refusal envelope (D-01, one shape for every cause): `ok:false`,
// `action:"refuse"`, a named machine `reason` code, the human sentence in
// `detail`, exit 1 (emit mirrors `ok` into the exit code - no process.exit,
// which can truncate stdout on a pipe), and NOTHING written. There is no
// `ok:true` refusal shape anywhere in this seam, so a scripted caller reading
// `ok` can never read a refusal as success. `reason` carries a machine code on
// EVERY path, refusal or not, so a caller branching on it never gets a token
// one run and a sentence the next. ONE deliberate exception (D-08): a SIBLING
// manifest's refusal leaves top-level `ok` true, because the primary write
// already landed - it is recorded as a `siblings[]` entry with
// `action:"refuse"`, and milestone.md halts the close on that too.
//
// Two code vocabularies, one owner each. The SEAM-level codes, owned here:
//   no-plugin-manifest  - no .claude-plugin/plugin.json: not a plugin project,
//                         an ok:true skip rather than a refusal (D-04 gating).
//   unreadable-manifest - plugin.json present but not parseable JSON.
//   usage | internal    - bad subcommand / an unexpected throw.
// The VERDICT codes (`no-target-version`, `no-version-field`,
// `already-at-target`, `bump`) are owned by lib/release-decision.mjs's JSDoc
// and emitted verbatim as `reason`.
'use strict';

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { emit } from './lib/seam-io.mjs';
import { atomicWrite } from './lib/planning-files.mjs';
import {
  normalizeTargetVersion, decideManifestBump, prependChangelogEntry, promoteUnreleased,
} from './lib/release-decision.mjs';
// The argv and file readers this file used to define for itself; both flag
// contracts and the reason there are two of them live in lib/seam-input.mjs.
// `readFileSync` stays imported above for the manifest parse below, which must
// tell an unreadable manifest from an empty one.
import { optionalFlag, readText } from './lib/seam-input.mjs';

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
 * Read a JSON manifest at `file` as a THREE-state result, because "absent" and
 * "present but unparseable" are different facts about a release: an absent
 * manifest is a non-plugin project (skip, ok:true), while a mangled one - a
 * trailing comma, a truncated half-write - read as absent would have the seam
 * report "nothing to bump" about a manifest it cannot see, exit 0 included.
 * That is the seam lying about the release, so it refuses instead. A parsed
 * non-object (`null`, a number) is unreadable too: it carries no `version`
 * field to reason about.
 * @param {string} file
 * @returns {{ state:'absent'|'unreadable'|'ok', manifest: Record<string, any>|null }}
 */
function readManifest(file) {
  if (!existsSync(file)) return { state: 'absent', manifest: null };
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { state: 'unreadable', manifest: null };
    }
    return { state: 'ok', manifest: parsed };
  } catch { return { state: 'unreadable', manifest: null }; }
}

function bump(dir, versionArg, dateArg) {
  const date = dateArg || new Date().toISOString().slice(0, 10);
  const pluginPath = join(dir, '.claude-plugin', 'plugin.json');

  // The shipping target is the explicit --version and nothing else: this seam
  // reads no planning prose at all (D-03). Normalized before the manifest is
  // read so a manifest refusal can still name the number the run was asked to
  // ship; the absent-manifest gate below still emits FIRST, because a
  // non-plugin project has nothing to bump whether or not a version was given.
  const target = normalizeTargetVersion(versionArg);

  // Auto-detect gating (D-04): no plugin manifest -> skip, write nothing.
  const read = readManifest(pluginPath);
  if (read.state === 'absent') {
    emit({ ok: true, action: 'skip', reason: 'no-plugin-manifest',
      detail: 'no .claude-plugin/plugin.json: non-plugin project, nothing to bump' });
    return;
  }
  if (read.state === 'unreadable') {
    emit({ ok: false, action: 'refuse', reason: 'unreadable-manifest', target,
      manifest: { from: null, to: target, bumped: false }, siblings: [], changelog: { changed: false },
      detail: '.claude-plugin/plugin.json is present but not parseable JSON: refusing to bump a manifest this seam cannot read, wrote nothing' });
    return;
  }
  const manifest = read.manifest;

  // Any refusal verdict: one envelope, ok:false, exit 1, nothing written
  // (never a `## [null]` CHANGELOG heading - the Phase-1/Phase-2 null lesson).
  const primary = decideManifestBump(manifest.version, target);
  if (primary.action === 'refuse') {
    emit({ ok: false, action: 'refuse', reason: primary.code, target,
      manifest: { from: primary.from, to: primary.to, bumped: false }, siblings: [], changelog: { changed: false },
      detail: primary.reason });
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
  const siblingRead = readManifest(siblingPath);
  if (siblingRead.state === 'unreadable') {
    // The primary write already landed, so this records rather than aborts
    // (D-08) - but it is recorded, never dropped: a sibling manifest this seam
    // cannot read is a sibling that ships the previous version.
    siblings.push({ file: '.claude-plugin/marketplace.json', action: 'refuse', bumped: false,
      reason: 'unreadable-manifest' });
  } else if (siblingRead.state === 'ok') {
    const sibling = siblingRead.manifest;
    const d = decideManifestBump(sibling.version, target);
    if (d.action === 'bump') {
      sibling.version = target;
      atomicWrite(siblingPath, JSON.stringify(sibling, null, 2) + '\n');
    }
    // A sibling inherits the same guard through the same function. Its refusal
    // is RECORDED, not raised: the primary write has already landed and
    // unwinding it would need a transaction this seam does not have (D-08). It
    // never becomes a silent partial ship - milestone.md halts the close on a
    // `siblings[]` refusal exactly as it does on a top-level one.
    siblings.push(d.action === 'refuse'
      ? { file: '.claude-plugin/marketplace.json', action: 'refuse', bumped: false, reason: d.code }
      : { file: '.claude-plugin/marketplace.json', action: d.action, bumped: d.bumped });
  }

  // Changelog: scaffold the dated heading, then promote whatever is staged
  // under `## [Unreleased]` into it. Composed, not branched - and written ONCE,
  // because atomicWrite renames a temp file into place and two writes would
  // expose an intermediate state on disk.
  //
  // Gated on the primary verdict being `bump` or `noop` and NEVER on `skip`: a
  // manifest with no `version` field bumped nothing, so dating a heading for
  // that release would have the changelog claim a release that never happened
  // while the emit said `skip`.
  let changelog = { changed: false };
  const clPath = join(dir, 'CHANGELOG.md');
  if (existsSync(clPath) && target && (primary.action === 'bump' || primary.action === 'noop')) {
    const url = changelogUrl(manifest, target);
    const scaffold = prependChangelogEntry(readText(clPath), { version: target, date, url });
    const promo = promoteUnreleased(scaffold.text, target);
    const changed = scaffold.changed || promo.changed;
    if (changed) atomicWrite(clPath, promo.text);
    // section_empty: the dated section ended up with no body at all - nothing
    // promoted and nothing already there. milestone.md turns that into "author
    // the notes before the bump commit", so no close ships an empty section
    // with nothing said.
    changelog = { changed, promoted: promo.changed, section_empty: promo.sectionEmpty };
  }

  const action = primary.action === 'bump' ? 'bumped' : primary.action; // bump|noop|skip
  emit({ ok: true, action, target, reason: primary.code, detail: primary.reason,
    manifest: { from: primary.from, to: primary.to, bumped: primary.bumped },
    siblings, changelog });
}

// --- dispatch ----------------------------------------------------------------

const argv = process.argv.slice(2);
const cmd = argv[0];
/** Value after a `--flag`, or undefined if the flag is absent. An adapter
 * binding over lib/seam-input.mjs's reader - this file's own argv, so every
 * call site below keeps its spelling - never a second definition of it. */
const flag = (name) => optionalFlag(argv, name);

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
