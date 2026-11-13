#!/usr/bin/env node
// @ts-check
// release-bump.mjs - the workflow-facing I/O seam over lib/release-decision.mjs. At a plugin milestone close (before
// the tag) it bumps `.claude-plugin/plugin.json`'s `version` and scaffolds a dated CHANGELOG entry, so a release stops
// shipping a stale manifest version. Unlike land-cleanup.mjs it writes, so it has its own CONTRACTS row and test.
// It fires only when plugin.json exists: a non-plugin project gets action:"skip" and nothing written.
//   bump [--dir <path>] [--version <v>] [--date <YYYY-MM-DD>]
//     --dir      absent is cwd; empty or valueless refuses (`missing-flag-value`, nothing written).
//     --version  required: the number the milestone workflow already confirmed. Absent refuses (`no-target-version`).
//     --date     the CHANGELOG date (test hook), today UTC when absent. A present one must be YYYY-MM-DD and is checked
//                at dispatch, before anything is read or written: `''`, `2026-13-45`, `2026-8-1` and a newline all
//                refuse with `bad-date`. Absent and empty are different calls, and so is a bare trailing `--date`.
// `version` is written only where the field exists: marketplace.json has none, so it yields `skip` and stays untouched.
// Refusal envelope, one shape for every cause: ok:false, action:"refuse", a machine `reason` code, the sentence in
// `detail`, exit 1, nothing written.
// The other ok:false shape is action:"partial", reason:"partial-bump": a transition threw part way and files did land.
// `manifest.bumped`, each `siblings[]` row's `bumped` and `changelog.changed` say which, so ok:false means "do not
// ship", not "nothing written".
// A sibling that parses but isn't upgradeable (downgrade, non-upgrade, unparseable version) leaves top-level ok true
// with a `siblings[]` entry of action:"refuse", which milestone.md halts on too. A sibling that can't be read refuses
// the whole run, because the write set is decided before the first write.
// One verdict is re-classified: a primary plugin.json with no `version` field becomes ok:false, action:"refuse",
// reason:"no-version-field", because ok:true/skip let the close ship unbumped. Siblings keep skipping on it.
// Two code vocabularies, one owner each. The seam's own, owned here:
//   no-plugin-manifest          - no plugin.json: not a plugin project, an ok:true skip.
//   unreadable-manifest         - plugin.json present but not parseable JSON.
//   unreadable-sibling-manifest - a declared sibling (marketplace.json) not parseable; own code so the halt names it.
//   unreadable-changelog        - CHANGELOG.md present but unreadable (a directory, a permission wall).
//   partial-bump                - the write set began and a step threw: ok:false, action:"partial".
//   bad-date                    - a present --date that isn't YYYY-MM-DD or has a newline, refused at dispatch even on
//                                 a non-plugin project; never `usage` or a verdict code.
//   missing-flag-value          - a --dir or --version spelling its declared row refuses; --date has `bad-date`.
//   usage | internal            - bad subcommand / an unexpected throw.
// The verdict codes (`no-target-version`, `unparseable-version`, `no-version-field`, `already-at-target`, `downgrade`,
// `not-an-upgrade`, `bump`) are owned by release-decision.mjs's JSDoc and emitted verbatim as `reason`.
'use strict';

import { readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { emit, emitCaught } from './lib/seam-io.mjs';
import { atomicWrite } from './lib/planning-store.mjs';
// runs an ordered step list and records which steps completed
import { runTransition } from './lib/file-transition.mjs';
import {
  normalizeTargetVersion, decideManifestBump, prependChangelogEntry, promoteUnreleased,
} from './lib/release-decision.mjs';
// no `readText` here, on purpose: its ''-on-failure would read an unreadable manifest or CHANGELOG as an empty one
// no flag rule here, the declared rows own it; `requireFlag` raises, `evaluateFlag` returns (for --date)
import { CONTRACTS, evaluateFlag, rowReader } from './lib/arg-contract.mjs';

/**
 * The release-tag URL a CHANGELOG link points at, from the manifest's `homepage` or `repository`:
 * `<base>/releases/tag/v<version>`. Falls back to `<base>/releases` with no version, and "" with no base at all.
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
 * Read a JSON manifest as a three-state result, because "absent" and "present but unparseable" are different facts.
 * Absent is a non-plugin project (skip, ok:true); a mangled one read as absent would say "nothing to bump" about a
 * manifest it can't see, so it refuses instead. A parsed non-object (`null`, a number) is unreadable too.
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

/**
 * The write set, as repo-relative paths. Each is also its transition step key, so envelope and step list can't drift.
 * The siblings are a declared list, never a discovery scan, so the seam never refuses over a file nobody declared.
 */
const PRIMARY_MANIFEST = '.claude-plugin/plugin.json';
const SIBLING_MANIFESTS = ['.claude-plugin/marketplace.json'];
const CHANGELOG_FILE = 'CHANGELOG.md';

/**
 * Read the CHANGELOG as a three-state result: present, readable and a regular file, never a content grammar check.
 * Absent is a real state, a project with no changelog still bumps its manifest. Unreadable is the one this exists for:
 * reading it as `''` scaffolded a fresh changelog over a history the seam can't see, after the manifest was bumped.
 * @param {string} file
 * @returns {{ state:'absent'|'unreadable'|'ok', text: string|null }}
 */
function readChangelog(file) {
  if (!existsSync(file)) return { state: 'absent', text: null };
  // `existsSync` accepts a FIFO, and `readFileSync` then blocks forever on one nobody writes to
  try { if (!statSync(file).isFile()) return { state: 'unreadable', text: null }; }
  catch { return { state: 'unreadable', text: null }; }
  try { return { state: 'ok', text: readFileSync(file, 'utf8') }; }
  catch { return { state: 'unreadable', text: null }; }
}

/** The remedy per verdict code, since each has a different fix; the fallback covers later codes. */
const VERSION_HINTS = Object.freeze({
  'no-target-version': 'pass --version with the version this release ships, then re-run the bump',
  'unparseable-version': 'give both --version and the manifest a plain MAJOR.MINOR.PATCH number - the detail quotes the one that is not - then re-run',
  downgrade: 'this seam only moves a version forward: pass a --version above the one the manifest already carries, or leave the release where it is',
  'not-an-upgrade': 'pass a --version that differs in MAJOR, MINOR or PATCH - build metadata alone is not a new release',
});

/** @param {string} code */
const versionHint = (code) => VERSION_HINTS[code]
  || 'the reason names what this seam decided about the target version - give --version a value it accepts, then re-run';

/**
 * The target is the explicit --version and nothing else; normalized before the manifest read so a refusal can name it.
 * Keeps the raw argument when normalization empties it: `--version v` refused as `no-target-version`, which is false,
 * a version was given. The raw value reaches `unparseable-version`, which quotes it.
 * normalizeTargetVersion stays as it is because the audit's `version_drift` uses it too.
 * @param {any} versionArg
 */
function targetOf(versionArg) {
  const target = normalizeTargetVersion(versionArg);
  const rawVersion = typeof versionArg === 'string' ? versionArg.trim() : '';
  return !target && rawVersion ? rawVersion : target;
}

/**
 * The nothing-written tail every refusal carries; `state` is the changelog's, `not-examined` when it never got that far.
 * @param {any} target @param {any} from @param {any} to @param {string} [state]
 */
function untouched(target, from, to, state = 'not-examined') {
  return { target, manifest: { from, to, bumped: false }, siblings: [], changelog: { changed: false, state } };
}

/**
 * The primary manifest and its verdict, or `null` after emitting the skip or refusal that ends the run: no plugin
 * manifest, an unreadable one, a refusal verdict, or no `version` field.
 * @param {string} dir @param {any} target
 */
function readPrimary(dir, target) {
  // auto-detect gate: no plugin manifest means skip and write nothing
  const read = readManifest(join(dir, PRIMARY_MANIFEST));
  if (read.state === 'absent') {
    emit({ ok: true, action: 'skip', reason: 'no-plugin-manifest',
      detail: 'no .claude-plugin/plugin.json: non-plugin project, nothing to bump' });
    return null;
  }
  if (read.state === 'unreadable') {
    emit({ ok: false, action: 'refuse', reason: 'unreadable-manifest', ...untouched(target, null, target),
      detail: '.claude-plugin/plugin.json is present but not parseable JSON: refusing to bump a manifest this seam cannot read, wrote nothing',
      hint: 'repair that file\'s JSON and re-run the bump - the tree is exactly as it was' });
    return null;
  }
  const manifest = read.manifest;

  // any refusal verdict: one envelope, ok:false, exit 1, nothing written (never a `## [null]` CHANGELOG heading)
  const primary = decideManifestBump(manifest.version, target);
  if (primary.action === 'refuse') {
    emit({ ok: false, action: 'refuse', reason: primary.code, ...untouched(target, primary.from, primary.to),
      detail: primary.reason, hint: versionHint(primary.code) });
    return null;
  }

  // the one primary verdict re-classified: a `skip` here let the close ship over a manifest nobody bumped
  if (primary.code === 'no-version-field') {
    emit({ ok: false, action: 'refuse', reason: 'no-version-field', ...untouched(target, primary.from, primary.to),
      detail: `the primary manifest ${PRIMARY_MANIFEST} carries no \`version\` field, so this release would ship unbumped: repair the manifest or close without a version bump. Wrote nothing.`,
      hint: `add a "version" field to ${PRIMARY_MANIFEST} naming the version this release ships from, then re-run the bump` });
    return null;
  }
  return { manifest, primary };
}

/**
 * Sibling manifests: write `version` only where it exists; marketplace.json has none, so it skips and stays untouched.
 * Answers the envelope rows and the writes they planned, or `null` after emitting the refusal for an unreadable one.
 * @param {string} dir @param {any} target @param {any} primary
 */
function planSiblings(dir, target, primary) {
  const siblings = [];
  /** @type {Array<{ rel: string, path: string, manifest: Record<string, any> }>} */
  const siblingWrites = [];
  for (const rel of SIBLING_MANIFESTS) {
    const siblingPath = join(dir, rel);
    const siblingRead = readManifest(siblingPath);
    if (siblingRead.state === 'unreadable') {
      // an unreadable sibling refuses the run before anything is written, so no half-landed primary
      emit({ ok: false, action: 'refuse', reason: 'unreadable-sibling-manifest', ...untouched(target, primary.from, primary.to),
        detail: `${rel} is present but not parseable JSON: refusing to ship a release whose sibling manifest this seam cannot read, wrote nothing. Repair ${rel} and re-run the bump.`,
        hint: `repair that sibling's JSON and re-run - the primary manifest was deliberately left at its old version, so the tree is consistent` });
      return null;
    }
    if (siblingRead.state !== 'ok') continue;
    const sibling = siblingRead.manifest;
    const d = decideManifestBump(sibling.version, target);
    if (d.action === 'bump') {
      sibling.version = target;
      siblingWrites.push({ rel, path: siblingPath, manifest: sibling });
    }
    // a sibling gets the same guard; its refusal is recorded, not raised, and milestone.md halts the close on it
    siblings.push(d.action === 'refuse'
      ? { file: rel, action: 'refuse', bumped: false, reason: d.code }
      : { file: rel, action: d.action, bumped: d.bumped });
  }
  return { siblings, siblingWrites };
}

/**
 * Changelog: scaffold the dated heading, then promote whatever is staged under `## [Unreleased]`
 * composed once, since two writes would expose an intermediate state on disk.
 * Gated on the primary verdict being `bump` or `noop`: dating a heading for a manifest nobody bumped claims a release
 * that never happened, and a new verdict action has to be added to this whitelist to reach the changelog.
 * `changelog.state` is set on every path that emits a `changelog`, or a project with none read like a clean one;
 * its vocabulary is readChangelog's plus `not-examined` for refusals that returned early.
 * Answers the envelope row and the composed bytes (`null` when nothing changed), or `null` after emitting the refusal
 * for an unreadable CHANGELOG.
 * @param {string} dir @param {Record<string, any>} manifest @param {any} target @param {string} date @param {any} primary
 */
function planChangelog(dir, manifest, target, date, primary) {
  let changelog = { changed: false, state: 'not-examined' };
  /** @type {string|null} the composed bytes to write, null when nothing changed */
  let changelogText = null;
  if (target && (primary.action === 'bump' || primary.action === 'noop')) {
    // validated only when it's in this run's write set, so a run that never touches the changelog isn't refused over it
    const clRead = readChangelog(join(dir, CHANGELOG_FILE));
    if (clRead.state === 'unreadable') {
      emit({ ok: false, action: 'refuse', reason: 'unreadable-changelog', ...untouched(target, primary.from, primary.to, 'unreadable'),
        detail: `${CHANGELOG_FILE} is present but cannot be read: refusing to scaffold a fresh changelog over a release history this seam cannot see, wrote nothing. Repair ${CHANGELOG_FILE} and re-run the bump.`,
        hint: `make ${CHANGELOG_FILE} readable and re-run - moving it aside would lose the release history this seam refuses to write over` });
      return null;
    }
    // absent means no changelog step, changed:false, ok:true, and says so with state:"absent"
    changelog = { changed: false, state: clRead.state };
    if (clRead.state === 'ok') {
      const url = changelogUrl(manifest, target);
      const scaffold = prependChangelogEntry(clRead.text, { version: target, date, url });
      const promo = promoteUnreleased(scaffold.text, target);
      const changed = scaffold.changed || promo.changed;
      if (changed) changelogText = promo.text;
      // section_empty: the dated section has no body, which milestone.md turns into "author the notes first"
      changelog = { changed, promoted: promo.changed, section_empty: promo.sectionEmpty, state: 'ok' };
    }
  }
  return { changelog, changelogText };
}

/**
 * The write half, and the envelope for what landed.
 * One transition, stop-at-first-failure: a half-applied release tree makes every later step's plan wrong.
 * Each step is keyed by its repo-relative path, so a failure can report which files landed.
 * @param {string} dir @param {any} target @param {Record<string, any>} manifest @param {any} primary
 * @param {{siblings: any[], siblingWrites: Array<{rel: string, path: string, manifest: Record<string, any>}>}} siblingPlan
 * @param {{changelog: any, changelogText: string|null}} changelogPlan
 */
function writeBump(dir, target, manifest, primary, siblingPlan, changelogPlan) {
  const { siblings, siblingWrites } = siblingPlan;
  const { changelog, changelogText } = changelogPlan;
  /** @type {Array<[string, () => void]>} */
  const steps = [];
  if (primary.action === 'bump') {
    const pluginPath = join(dir, PRIMARY_MANIFEST);
    steps.push([PRIMARY_MANIFEST,
      () => atomicWrite(pluginPath, JSON.stringify(manifest, null, 2) + '\n')]);
  }
  for (const { rel, path, manifest: sibling } of siblingWrites) {
    steps.push([rel, () => atomicWrite(path, JSON.stringify(sibling, null, 2) + '\n')]);
  }
  if (changelogText !== null) {
    const text = changelogText;
    const clPath = join(dir, CHANGELOG_FILE);
    steps.push([CHANGELOG_FILE, () => atomicWrite(clPath, text)]);
  }

  const applied = runTransition({ steps, discipline: 'stop-at-first-failure' });
  if (!applied.ok) {
    // a step threw anyway, on what no pre-flight sees: EACCES, ENOSPC, a symlink planted at atomicWrite's temp path
    // the dispatch's catch would flatten that to "internal" and hide whether the tree was bumped, so the fields come
    // from what the transition completed, not what was decided
    const landed = (key) => applied.completed.includes(key);
    const { error } = applied.failures[0];
    emit({ ok: false, action: 'partial', reason: 'partial-bump', target,
      manifest: { from: primary.from, to: primary.to, bumped: landed(PRIMARY_MANIFEST) },
      siblings: siblings.map((s) => ({ ...s, bumped: landed(s.file) })),
      changelog: { ...changelog, changed: landed(CHANGELOG_FILE) },
      detail: error && error.message ? error.message : String(error),
      // deliberately not "re-run": a retry here compounds the damage, so the hint sends them to read the tree first
      hint: 'read the `bumped` and `changed` flags in this envelope - they name which files landed and which did not - and reconcile the tree by hand BEFORE any re-run, because a second bump over a half-written tree moves the ones that already landed again' });
    return;
  }

  const action = primary.action === 'bump' ? 'bumped' : primary.action; // bump|noop
  emit({ ok: true, action, target, reason: primary.code, detail: primary.reason,
    manifest: { from: primary.from, to: primary.to, bumped: primary.bumped },
    siblings, changelog });
}

function bump(dir, versionArg, dateArg) {
  const date = dateArg || new Date().toISOString().slice(0, 10);
  const target = targetOf(versionArg);

  const head = readPrimary(dir, target);
  if (head === null) return;
  const { manifest, primary } = head;

  // --- read and decide (nothing below this line touches disk) ---------------
  // the whole write set is read and planned before the first write lands, or an unwritable CHANGELOG.md emitted
  // "internal" while plugin.json already had the new version: a half-bumped tree with no `manifest` in the envelope

  // primary manifest: a real bump mutates the in-memory manifest here, and the bytes reach disk in the write half below
  if (primary.action === 'bump') manifest.version = target;

  const siblingPlan = planSiblings(dir, target, primary);
  if (siblingPlan === null) return;
  const changelogPlan = planChangelog(dir, manifest, target, date, primary);
  if (changelogPlan === null) return;

  writeBump(dir, target, manifest, primary, siblingPlan, changelogPlan);
}

/** The `--date` grammar: anchored, month and day ranges spelled out. Not a calendar check, so `2026-02-31` matches. */
const DATE_RE = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/;

/**
 * The refusal sentence for a present `--date`, or null when it's well-formed.
 * The newline arm comes first with its own sentence: `--date $'2026-08-18\n## [9.9.9] - forged'` wrote a forged second
 * heading into CHANGELOG.md, since the date is interpolated straight into the heading.
 * Neither arm echoes the value back, or a newline in it would land on a line the closing workflow prints.
 *
 * @param {string} value @returns {string|null}
 */
function badDateDetail(value) {
  if (/[\r\n]/.test(value)) {
    return '--date cannot contain a newline: the value is interpolated into the'
      + ' `## [<version>] - <date>` heading, so a newline forges a second release'
      + ' section. Pass one YYYY-MM-DD line, or omit --date to date today.';
  }
  if (!DATE_RE.test(value)) {
    return '--date must be YYYY-MM-DD (zero-padded month 01-12 and day 01-31),'
      + ' the format this seam writes into the CHANGELOG heading. An EMPTY or'
      + ' VALUELESS --date refuses here rather than dating today: omit the flag'
      + ' to do that.';
  }
  return null;
}

// --- dispatch ----------------------------------------------------------------

const argv = process.argv.slice(2);
const cmd = argv[0];
/** This script's declared rows; a subcommand's row wins over the `'*'` row for flags every arm allows. */
const ROWS = CONTRACTS['release-bump.mjs'];
/** One flag read through its declared row in the raising form, for flags that refuse as `missing-flag-value`. */
const arg = rowReader(argv, ROWS);

try {
  if (cmd === 'bump') {
    // `--dir` refuses on both axes: absent falls to cwd, while empty, valueless and flag-shaped ones raise the refusal
    // `--version` falls back, so a spelling with no usable value reads as absent and never swallows a neighbouring flag
    const dir = arg('bump', '--dir') || process.cwd();
    // absent and present-with-nothing-usable are different calls, or a trailing valueless `--date` dated today
    // read in the returning form so a caller branching on `reason` can tell a bad date from a bad `--dir`
    const dateRead = evaluateFlag(argv, '--date', ROWS.bump['--date']);
    const dateArg = dateRead.ok ? dateRead.value : undefined;
    const badDate = dateRead.ok
      ? (dateArg === undefined ? null : badDateDetail(dateArg))
      : badDateDetail('');
    // validated before bump() runs, so the refusal needs no manifest read; hence no `manifest` in this envelope
    if (badDate) {
      emit({ ok: false, action: 'refuse', reason: 'bad-date', detail: badDate,
        hint: 'pass --date one YYYY-MM-DD value, or drop the flag entirely to date today, then re-run' });
    } else {
      bump(dir, arg('bump', '--version'), dateArg);
    }
  } else {
    emit({ ok: false, reason: 'usage',
      detail: 'subcommand: bump [--dir <path>] [--version <v>] [--date <YYYY-MM-DD>]' });
  }
} catch (e) {
  emitCaught(e);
}
