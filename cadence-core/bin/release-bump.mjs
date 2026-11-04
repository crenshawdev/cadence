#!/usr/bin/env node
// @ts-check
// release-bump.mjs - the workflow-facing I/O seam over lib/release-decision.mjs. At a plugin milestone close (milestone.md
// step 2, before the tag) it bumps `.claude-plugin/plugin.json`'s `version` to the shipping release and scaffolds a dated
// CHANGELOG entry, so a release stops shipping a stale manifest version. Unlike land-cleanup.mjs it writes, so it has
// its own CONTRACTS row and test; the tested logic is in the pure release-decision.mjs. It fires only when plugin.json
// exists: a non-plugin project gets action:"skip" and nothing written, so there's no config key for it.
//   bump [--dir <path>] [--version <v>] [--date <YYYY-MM-DD>]
//     --dir      absent is cwd; empty or valueless refuses (`missing-flag-value`, nothing written), not bump a tree nobody named.
//     --version  required: the number the milestone workflow already confirmed. Absent refuses (`no-target-version`).
//     --date     the CHANGELOG date (test hook), today UTC when absent. A present one must be YYYY-MM-DD and is checked at
//                dispatch, before anything is read or written: `''`, `2026-13-45`, `2026-8-1` and a newline all refuse
//                with `bad-date`. Absent and empty are different calls, and so is a bare trailing `--date`.
// `version` is written only where the field exists: marketplace.json has none, so it yields `skip` and stays byte-untouched.
// Refusal envelope, one shape for every cause: ok:false, action:"refuse", a machine `reason` code, the sentence in
// `detail`, exit 1, nothing written (emit mirrors ok into the exit code; no process.exit, it can truncate stdout on a pipe).
// The other ok:false shape is action:"partial" with reason:"partial-bump": a transition threw part way, files DID land, and
// `manifest.bumped`, each `siblings[]` row's `bumped` and `changelog.changed` say which. So ok:false means "do not ship",
// not "nothing written". `reason` is a machine code on every path. One exception: a sibling manifest that parses but isn't
// upgradeable (downgrade, non-upgrade, unparseable version) leaves top-level ok true with a `siblings[]` entry of
// action:"refuse", which milestone.md halts on too. A sibling that can't be read refuses the whole run, because the write
// set is decided before the first write.
// One verdict is re-classified: a PRIMARY plugin.json with verdict skip/no-version-field becomes ok:false, action:"refuse",
// reason:"no-version-field", exit 1, because a manifest with no `version` can't be bumped and ok:true/skip let the close
// ship unbumped. SIBLINGS keep skipping on it (marketplace.json has no `version` by design; refusing would halt every close).
// Two code vocabularies, one owner each. The seam's own, owned here:
//   no-plugin-manifest          - no plugin.json: not a plugin project, an ok:true skip.
//   unreadable-manifest         - plugin.json present but not parseable JSON.
//   unreadable-sibling-manifest - a declared sibling (marketplace.json) not parseable; own code so the halt names the file.
//   unreadable-changelog        - CHANGELOG.md present but unreadable (a directory, a permission wall); no grammar check.
//   partial-bump                - the write set began and a step threw: ok:false, action:"partial". The one non-refusal
//                                 ok:false code.
//   bad-date                    - a present --date that isn't YYYY-MM-DD or has a newline. Refused at dispatch, so it fires on
//                                 a non-plugin project too; never `usage` or a verdict code, so callers can tell them apart.
//   missing-flag-value          - a --dir or --version spelling its declared row refuses; --date has `bad-date` instead.
//   usage | internal            - bad subcommand / an unexpected throw.
// The verdict codes (`no-target-version`, `unparseable-version`, `no-version-field`, `already-at-target`, `downgrade`,
// `not-an-upgrade`, `bump`) are owned by release-decision.mjs's JSDoc and emitted verbatim as `reason`, bar the primary
// `no-version-field` re-classification above. prose-agreement.test.mjs reddens until a new verdict is named here and there.
'use strict';

import { readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { emit } from './lib/seam-io.mjs';
import { atomicWrite } from './lib/planning-files.mjs';
// the multi-file transition primitive: the one place that runs an ordered step list and records which steps completed
import { runTransition } from './lib/file-transition.mjs';
import {
  normalizeTargetVersion, decideManifestBump, prependChangelogEntry, promoteUnreleased,
} from './lib/release-decision.mjs';
// no `readText` here, on purpose: its ''-on-failure contract would read an unreadable manifest or CHANGELOG as an empty one
// no flag rule here, the declared rows own it; `requireFlag` raises for --dir/--version, `evaluateFlag` returns for --date
import { CONTRACTS, evaluateFlag, requireFlag } from './lib/arg-contract.mjs';

/**
 * The release-tag URL a CHANGELOG link points at, from the manifest's `homepage` (or `repository` minus a trailing `.git`):
 * `<base>/releases/tag/v<version>`. Falls back to `<base>/releases` with a base but no version, and "" with no base at all.
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
 * Read a JSON manifest as a three-state result, because "absent" and "present but unparseable" are different facts about a
 * release. Absent is a non-plugin project (skip, ok:true); a mangled one (trailing comma, truncated half-write) read as absent
 * would report "nothing to bump" about a manifest it can't see, exit 0 included, so it refuses instead. A parsed non-object
 * (`null`, a number) is unreadable too: no `version` field to reason about.
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
 * The write set, as repo-relative paths. Each is also its transition step key, so what the envelope says about a file and
 * what the step list calls it can't drift. The siblings are a declared list, never a discovery scan: a second one is one
 * more entry here, and the seam never reads or refuses over a file nobody declared.
 */
const PRIMARY_MANIFEST = '.claude-plugin/plugin.json';
const SIBLING_MANIFESTS = ['.claude-plugin/marketplace.json'];
const CHANGELOG_FILE = 'CHANGELOG.md';

/**
 * Read the CHANGELOG as a three-state result: present, readable and a regular file, never a content grammar check, since the
 * transform over it (`prependChangelogEntry` then `promoteUnreleased`) is pure and can't fail on any text.
 * Absent is a real state, a project with no changelog still bumps its manifest. Unreadable is the one this exists for (a
 * directory, a permission wall): reading it as `''` scaffolded a fresh changelog over a history the seam can't see, and it did
 * so after the manifest was already bumped.
 * @param {string} file
 * @returns {{ state:'absent'|'unreadable'|'ok', text: string|null }}
 */
function readChangelog(file) {
  if (!existsSync(file)) return { state: 'absent', text: null };
  // regular file, checked: `existsSync` accepts a FIFO, and `readFileSync` then blocks forever on one nobody writes to
  try { if (!statSync(file).isFile()) return { state: 'unreadable', text: null }; }
  catch { return { state: 'unreadable', text: null }; }
  try { return { state: 'ok', text: readFileSync(file, 'utf8') }; }
  catch { return { state: 'unreadable', text: null }; }
}

/** The remedy per verdict code, since the four have four different fixes; the fallback covers later codes. */
const VERSION_HINTS = Object.freeze({
  'no-target-version': 'pass --version with the version this release ships, then re-run the bump',
  'unparseable-version': 'give both --version and the manifest a plain MAJOR.MINOR.PATCH number - the detail quotes the one that is not - then re-run',
  downgrade: 'this seam only moves a version forward: pass a --version above the one the manifest already carries, or leave the release where it is',
  'not-an-upgrade': 'pass a --version that differs in MAJOR, MINOR or PATCH - build metadata alone is not a new release',
});

/** @param {string} code */
const versionHint = (code) => VERSION_HINTS[code]
  || 'the reason names what this seam decided about the target version - give --version a value it accepts, then re-run';

function bump(dir, versionArg, dateArg) {
  const date = dateArg || new Date().toISOString().slice(0, 10);
  const pluginPath = join(dir, PRIMARY_MANIFEST);

  // the target is the explicit --version and nothing else; it's normalized before the manifest read so a refusal can name it
  let target = normalizeTargetVersion(versionArg);
  // keep the raw argument when normalization leaves nothing usable: `--version v` trims to `v`, the leading-v strip empties it,
  // and the run refused as `no-target-version` over `target:""`, which is false (a version WAS given). Handing the raw value
  // on reaches decideManifestBump's `unparseable-version`, which quotes it, so no verdict code is minted here.
  // normalizeTargetVersion isn't changed: planning.mjs uses it for the audit's `version_drift` signal. An absent --version
  // still refuses as `no-target-version`, and a blank one refuses earlier at its declared row as `missing-flag-value`.
  const rawVersion = typeof versionArg === 'string' ? versionArg.trim() : '';
  if (!target && rawVersion) target = rawVersion;

  // auto-detect gate: no plugin manifest means skip and write nothing
  const read = readManifest(pluginPath);
  if (read.state === 'absent') {
    emit({ ok: true, action: 'skip', reason: 'no-plugin-manifest',
      detail: 'no .claude-plugin/plugin.json: non-plugin project, nothing to bump' });
    return;
  }
  if (read.state === 'unreadable') {
    emit({ ok: false, action: 'refuse', reason: 'unreadable-manifest', target,
      manifest: { from: null, to: target, bumped: false }, siblings: [], changelog: { changed: false, state: 'not-examined' },
      detail: '.claude-plugin/plugin.json is present but not parseable JSON: refusing to bump a manifest this seam cannot read, wrote nothing',
      hint: 'repair that file\'s JSON and re-run the bump - the tree is exactly as it was' });
    return;
  }
  const manifest = read.manifest;

  // any refusal verdict: one envelope, ok:false, exit 1, nothing written (never a `## [null]` CHANGELOG heading)
  const primary = decideManifestBump(manifest.version, target);
  if (primary.action === 'refuse') {
    emit({ ok: false, action: 'refuse', reason: primary.code, target,
      manifest: { from: primary.from, to: primary.to, bumped: false }, siblings: [], changelog: { changed: false, state: 'not-examined' },
      detail: primary.reason, hint: versionHint(primary.code) });
    return;
  }

  // the one primary verdict re-classified: a `skip` here let the close ship over a manifest nobody bumped (measured 2026-08-22)
  if (primary.code === 'no-version-field') {
    emit({ ok: false, action: 'refuse', reason: 'no-version-field', target,
      manifest: { from: primary.from, to: primary.to, bumped: false }, siblings: [], changelog: { changed: false, state: 'not-examined' },
      detail: `the primary manifest ${PRIMARY_MANIFEST} carries no \`version\` field, so this release would ship unbumped: repair the manifest or close without a version bump. Wrote nothing.`,
      hint: `add a "version" field to ${PRIMARY_MANIFEST} naming the version this release ships from, then re-run the bump` });
    return;
  }

  // --- read and decide (nothing below this line touches disk) ---------------
  // the whole write set (primary, every sibling, the changelog) is read and planned before the first write lands. The old
  // order wrote the primary, then read the sibling, then the changelog, so an unwritable CHANGELOG.md emitted "internal"
  // (EISDIR) while plugin.json already read the new version: a half-bumped tree in an envelope with no `manifest`,
  // `siblings` or `changelog`. Hoisting the reads changes no result, since the three deciders are pure.

  // primary manifest: a real bump mutates the in-memory manifest here, and the bytes reach disk in the write half below
  if (primary.action === 'bump') manifest.version = target;

  // sibling manifests: write `version` only where it exists; marketplace.json has none, so it skips and stays untouched
  const siblings = [];
  /** @type {Array<{ rel: string, path: string, manifest: Record<string, any> }>} */
  const siblingWrites = [];
  for (const rel of SIBLING_MANIFESTS) {
    const siblingPath = join(dir, rel);
    const siblingRead = readManifest(siblingPath);
    if (siblingRead.state === 'unreadable') {
      // an unreadable sibling refuses the run: nothing is written until the whole set is decided, so no half-landed primary
      emit({ ok: false, action: 'refuse', reason: 'unreadable-sibling-manifest', target,
        manifest: { from: primary.from, to: primary.to, bumped: false },
        siblings: [], changelog: { changed: false, state: 'not-examined' },
        detail: `${rel} is present but not parseable JSON: refusing to ship a release whose sibling manifest this seam cannot read, wrote nothing. Repair ${rel} and re-run the bump.`,
        hint: `repair that sibling's JSON and re-run - the primary manifest was deliberately left at its old version, so the tree is consistent` });
      return;
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

  // changelog: scaffold the dated heading, then promote whatever is staged under `## [Unreleased]` into it. Composed and
  // written once, since atomicWrite renames a temp file into place and two writes would expose an intermediate state on disk.
  // Gated on the primary verdict being `bump` or `noop`, never `skip`: a manifest with no `version` bumped nothing, so dating
  // a heading would claim a release that never happened. The primary can't be `skip` here (the re-classification above
  // refuses it), so the gate is a whitelist because that's what a new verdict action must be added to to reach the changelog.
  // `changelog.state` is set on every path that emits a `changelog` object: the outcomes used to differ only by key presence,
  // so a project with NO changelog read exactly like a clean one and milestone.md closed as if the notes were fine. The
  // vocabulary is readChangelog's (`absent`, `unreadable`, `ok`) plus `not-examined` for refusals that returned before the gate.
  // It stays separate from `section_empty`, which still means what it did and still drives the empty-section halt.
  let changelog = { changed: false, state: 'not-examined' };
  /** @type {string|null} the composed bytes to write, null when nothing changed */
  let changelogText = null;
  const clPath = join(dir, CHANGELOG_FILE);
  if (target && (primary.action === 'bump' || primary.action === 'noop')) {
    // validated only when it's in this run's write set, so a run that never touches the changelog is never refused over it
    const clRead = readChangelog(clPath);
    if (clRead.state === 'unreadable') {
      emit({ ok: false, action: 'refuse', reason: 'unreadable-changelog', target,
        manifest: { from: primary.from, to: primary.to, bumped: false },
        siblings: [], changelog: { changed: false, state: 'unreadable' },
        detail: `${CHANGELOG_FILE} is present but cannot be read: refusing to scaffold a fresh changelog over a release history this seam cannot see, wrote nothing. Repair ${CHANGELOG_FILE} and re-run the bump.`,
        hint: `make ${CHANGELOG_FILE} readable and re-run - moving it aside would lose the release history this seam refuses to write over` });
      return;
    }
    // absent keeps its own behaviour (no changelog step, changed:false, ok:true) but now says so with state:"absent"
    changelog = { changed: false, state: clRead.state };
    if (clRead.state === 'ok') {
      const url = changelogUrl(manifest, target);
      const scaffold = prependChangelogEntry(clRead.text, { version: target, date, url });
      const promo = promoteUnreleased(scaffold.text, target);
      const changed = scaffold.changed || promo.changed;
      if (changed) changelogText = promo.text;
      // section_empty: the dated section has no body at all, which milestone.md turns into "author the notes first"
      changelog = { changed, promoted: promo.changed, section_empty: promo.sectionEmpty, state: 'ok' };
    }
  }

  // --- write ----------------------------------------------------------------
  // one transition, stop-at-first-failure: a half-applied release tree makes every later step's plan wrong. Each step is
  // keyed by its repo-relative path, so a failure can report which files landed.
  /** @type {Array<[string, () => void]>} */
  const steps = [];
  if (primary.action === 'bump') {
    steps.push([PRIMARY_MANIFEST,
      () => atomicWrite(pluginPath, JSON.stringify(manifest, null, 2) + '\n')]);
  }
  for (const { rel, path, manifest: sibling } of siblingWrites) {
    steps.push([rel, () => atomicWrite(path, JSON.stringify(sibling, null, 2) + '\n')]);
  }
  if (changelogText !== null) {
    const text = changelogText;
    steps.push([CHANGELOG_FILE, () => atomicWrite(clPath, text)]);
  }

  const applied = runTransition({ steps, discipline: 'stop-at-first-failure' });
  if (!applied.ok) {
    // a step threw anyway. Everything a read could catch was caught above, so this is what no pre-flight sees: EACCES, ENOSPC,
    // a symlink planted at atomicWrite's temp path. The dispatch's catch would flatten it to "internal" with no `manifest`,
    // `siblings` or `changelog`, and the operator couldn't tell a bumped tree from an untouched one. So it gets
    // `action:"partial"`, `reason:"partial-bump"` and the disposition fields filled from what the transition completed, not
    // what was decided. It's the one halt where re-running isn't a clean retry.
    const landed = (key) => applied.completed.includes(key);
    const { error } = applied.failures[0];
    emit({ ok: false, action: 'partial', reason: 'partial-bump', target,
      manifest: { from: primary.from, to: primary.to, bumped: landed(PRIMARY_MANIFEST) },
      siblings: siblings.map((s) => ({ ...s, bumped: landed(s.file) })),
      changelog: { ...changelog, changed: landed(CHANGELOG_FILE) },
      detail: error && error.message ? error.message : String(error),
      // deliberately not "re-run": a retry here compounds the damage, so the hint sends the operator to read the tree first
      hint: 'read the `bumped` and `changed` flags in this envelope - they name which files landed and which did not - and reconcile the tree by hand BEFORE any re-run, because a second bump over a half-written tree moves the ones that already landed again' });
    return;
  }

  const action = primary.action === 'bump' ? 'bumped' : primary.action; // bump|noop
  emit({ ok: true, action, target, reason: primary.code, detail: primary.reason,
    manifest: { from: primary.from, to: primary.to, bumped: primary.bumped },
    siblings, changelog });
}

/** The `--date` grammar: anchored, month and day ranges spelled out. Not a calendar check, so `2026-02-31` matches. */
const DATE_RE = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/;

/**
 * The refusal sentence for a present `--date`, or null when it's well-formed.
 * The newline arm comes first with its own sentence, because "not YYYY-MM-DD" is the wrong diagnostic for a value that
 * appended a release section: `--date $'2026-08-18\n## [9.9.9] - forged'` wrote a forged second heading into CHANGELOG.md
 * above the real one (measured 2026-08-18), since the date is interpolated straight into the heading. Neither arm echoes
 * the value back; echoing a newline-carrying one would put it on a line the closing workflow prints.
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
/** This script's declared rows; a subcommand's row wins over the `'*'` row, where flags allowed on every arm are declared. */
const ROWS = CONTRACTS['release-bump.mjs'];
/** One flag read through its declared row in the raising form, for flags that refuse as `missing-flag-value`. */
const arg = (sub, name) => requireFlag(argv, name, ROWS[sub][name] || ROWS['*'][name]);

try {
  if (cmd === 'bump') {
    // `--dir` refuses on both axes: an absent one stays undefined and falls to cwd, while empty, valueless and flag-shaped
    // spellings raise the refusal the e.seam arm names. `--version` falls back on the bare axis, so a spelling with no usable
    // value reads as absent and the verdict is `no-target-version`, never a neighbouring flag swallowed as the target.
    const dir = arg('bump', '--dir') || process.cwd();
    // absent and present-with-nothing-usable are different calls, and the declaration tells them apart. The old dispatch probed
    // argv for the flag beside its value because the permissive reader answered `undefined` for a trailing valueless `--date`
    // as for an absent one, so that one spelling dated today. The row refuses on both axes now, so `''`, a blank, a flag-shaped
    // value and a bare `--date` all count as present-with-nothing-usable, and the probe is gone.
    // Read in the returning form so this file names the refusal in its own vocabulary: a caller branching on `reason` must tell
    // a malformed date from a malformed `--dir`, and the raising form would render both as `missing-flag-value`.
    const dateRead = evaluateFlag(argv, '--date', ROWS.bump['--date']);
    const dateArg = dateRead.ok ? dateRead.value : undefined;
    const badDate = dateRead.ok
      ? (dateArg === undefined ? null : badDateDetail(dateArg))
      : badDateDetail('');
    // validated before bump() runs, so the refusal needs no manifest read; hence no `manifest`, `siblings` or `changelog` here
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
  // the raised refusal has no `message`, so without this arm a valueless --dir emits detail "[object Object]"
  if (e && e.seam) emit({ ok: false, reason: e.seam, detail: e.detail,
    hint: 'the detail names the flag that refused - give it a value of the kind that flag takes and re-run the command' });
  else emit({ ok: false, reason: 'internal', detail: e && e.message ? e.message : String(e) });
}
