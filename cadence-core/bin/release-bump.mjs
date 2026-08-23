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
//     --dir      repo/planning root. An ABSENT --dir is the process cwd; an
//                EMPTY or valueless one REFUSES (`missing-flag-value`, exit 1,
//                nothing written) rather than bumping a manifest in a tree the
//                caller never named (phase 2 D-01).
//     --version  REQUIRED: the shipping release number, the one the milestone
//                workflow already confirmed with the user. Its absence refuses
//                (`no-target-version`) - the seam derives no number of its own.
//     --date     the CHANGELOG entry date (test hook). ABSENT dates today, UTC.
//                A PRESENT one must be `YYYY-MM-DD` and is validated at the
//                dispatch, BEFORE anything is read or written (D-06): `''`,
//                `2026-13-45`, `2026-8-1` and a newline-carrying value each
//                refuse with `bad-date`. `--date ''` REFUSES rather than
//                falling through to today (D-05) - absent and empty are two
//                different calls, and so is a BARE trailing `--date`, which
//                refuses on the same sentence. That split is DECLARED, not
//                probed: the row in lib/arg-contract.mjs refuses on both the
//                value and the bare-flag axis, which is what retired the
//                `argv.includes('--date')` probe this dispatch used to carry
//                beside the value (ARG-06).
// The bump writes `version` only where the field already exists: plugin.json is
// rewritten, marketplace.json (which carries none) yields `skip` and is left
// byte-untouched (D-03).
//
// Refusal envelope (D-01, one shape for every cause): `ok:false`,
// `action:"refuse"`, a named machine `reason` code, the human sentence in
// `detail`, exit 1 (emit mirrors `ok` into the exit code - no process.exit,
// which can truncate stdout on a pipe), and NOTHING written. That is the
// REFUSAL shape, and it is one of TWO `ok:false` shapes: a transition that
// threw part way emits `action:"partial"` with `reason:"partial-bump"`, where
// files DID land and `manifest.bumped`, each `siblings[]` row's `bumped` and
// `changelog.changed` name which ones. So `ok:false` alone means "do not
// ship", never "nothing was written" - `action` is what carries that. There is
// no `ok:true` refusal shape anywhere in this seam, so a scripted caller
// reading `ok` can never read a refusal as success. `reason` carries a machine code on
// EVERY path, refusal or not, so a caller branching on it never gets a token
// one run and a sentence the next. ONE deliberate exception (D-08, narrowed by
// phase 2 D-07): a sibling manifest that PARSES and is simply not upgradeable -
// a downgrade, a non-upgrade, an unparseable version IN the sibling - leaves
// top-level `ok` true and is recorded as a `siblings[]` entry with
// `action:"refuse"`, which milestone.md halts the close on too. A sibling that
// cannot be READ is no longer that case: it refuses the whole run under its own
// code, because the write set is now decided before the first write lands.
//
// ONE verdict is RE-CLASSIFIED rather than passed through (phase 1 D-01/D-02),
// and it is the only place this seam overrides the code vocabulary below. A
// PRIMARY .claude-plugin/plugin.json whose verdict is `skip`/`no-version-field`
// becomes a REFUSAL here - ok:false, action:"refuse", reason:"no-version-field",
// exit 1, nothing written - because a manifest with no `version` field cannot be
// bumped at all, and returning ok:true/skip over it let the close continue and
// ship the release unbumped. The verdict itself is unchanged in
// lib/release-decision.mjs and SIBLING manifests keep skipping on it (D-02):
// .claude-plugin/marketplace.json carries no `version` BY DESIGN, so refusing on
// the verdict rather than on the primary would halt Cadence's own close every
// cycle. The refusal also gets its OWN `detail` sentence rather than the
// verdict's "leave it untouched", which reads as benign on a halt.
//
// Two code vocabularies, one owner each. The SEAM-level codes, owned here:
//   no-plugin-manifest  - no .claude-plugin/plugin.json: not a plugin project,
//                         an ok:true skip rather than a refusal (D-04 gating).
//   unreadable-manifest - plugin.json present but not parseable JSON.
//   unreadable-sibling-manifest
//                       - a DECLARED sibling manifest (.claude-plugin/
//                         marketplace.json) present but not parseable JSON.
//                         Its OWN code, never the primary's
//                         `unreadable-manifest` (phase 2 D-08): milestone.md's
//                         halt list enumerates codes by name, and one token for
//                         two files leaves the operator opening both to find
//                         which one to repair.
//   unreadable-changelog
//                       - CHANGELOG.md present but not readable (a directory at
//                         that path, a permission wall). Its own code for the
//                         same operator reason. Validation is presence,
//                         readability and regular-file shape only, never a
//                         content grammar check: the transform pass over it is
//                         pure and cannot fail (D-09).
//   partial-bump        - the decided write set began and a step threw anyway:
//                         ok:false with action:"partial", and the disposition
//                         fields naming what landed. The one non-refusal
//                         ok:false code here.
//   bad-date            - a PRESENT --date that is not YYYY-MM-DD, or one
//                         carrying a newline. Refused at the dispatch, so it
//                         fires on a non-plugin project too, where the
//                         manifest gate would otherwise answer
//                         no-plugin-manifest first (D-06): a malformed value
//                         is malformed whether or not this run would write.
//                         A SEAM-level code by D-04, never `usage` (which is
//                         this seam's bad-subcommand code) and never a
//                         lib/release-decision.mjs verdict code - a caller
//                         branching on `reason` must be able to tell a bad
//                         --date from a bad subcommand.
//   missing-flag-value  - a --dir or --version spelling its declared row
//                         refuses (phase 2 D-01). --date is NOT here: its own
//                         `bad-date` is what a caller branches on, so it is
//                         read in the returning form and named below (D-07).
//   usage | internal    - bad subcommand / an unexpected throw.
// The VERDICT codes (`no-target-version`, `unparseable-version`,
// `no-version-field`, `already-at-target`, `downgrade`, `not-an-upgrade`,
// `bump`) are owned by lib/release-decision.mjs's JSDoc and emitted verbatim
// as `reason` - with the ONE exception stated above: a PRIMARY
// `no-version-field` is a `skip` verdict this seam re-classifies as an
// `ok:false` refusal, emitting the code unchanged under `action:"refuse"`
// (phase 1 D-01). This list named four of the seven for two release cycles;
// prose-agreement.test.mjs now derives the set from decideManifestBump's own
// executable `code:` literals and reddens until a new one is named BOTH here
// and in that function's JSDoc.
'use strict';

import { readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { emit } from './lib/seam-io.mjs';
import { atomicWrite } from './lib/planning-files.mjs';
// The multi-file transition primitive (JRN-01): the ONE place under
// cadence-core/bin/ where an ordered step list runs and a record is kept of
// which steps completed. Imported, never copied - helper-census.test.mjs pins
// that module's body as a single definition.
import { runTransition } from './lib/file-transition.mjs';
import {
  normalizeTargetVersion, decideManifestBump, prependChangelogEntry, promoteUnreleased,
} from './lib/release-decision.mjs';
// No lib/seam-input.mjs `readText` here any more, and that is deliberate rather
// than an omission: its ''-on-failure contract is right for a surface whose
// absence is not fatal, and wrong for every file THIS seam reads. A manifest
// read as empty is a manifest with no `version` field, and a CHANGELOG read as
// empty gets a fresh one scaffolded over a real release history. Both are read
// through `readFileSync` below in three-state readers that tell absent from
// unreadable. That is a caller-side choice; the shared helper is unchanged and
// its other callers keep the contract they depend on.
// The argument contract (ARG-06). This file states no flag rule of its own any
// more: what each flag may be, and what it costs when it is not, are DECLARED
// rows in lib/arg-contract.mjs. BOTH mechanisms are used here, picked per flag
// rather than per bin (D-08), because this seam publishes two vocabularies:
// `requireFlag` RAISES for `--dir` and `--version`, which the e.seam catch arm
// at the foot of this file renders as `missing-flag-value`, and `evaluateFlag`
// RETURNS for `--date`, whose refusal is this seam's own `bad-date` sentence
// and must not be renamed by the mechanism that carries it (D-07).
import { CONTRACTS, evaluateFlag, requireFlag } from './lib/arg-contract.mjs';

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

/**
 * The write set, as repo-relative paths. Each is also its own transition step
 * KEY, so what the envelope reports about a file and what the step list calls
 * it can never drift apart.
 *
 * The sibling set is a DECLARED list and never a discovery scan (D-10): a
 * second sibling is one more entry here, and the seam still never reads - or
 * refuses over - a file nobody declared.
 */
const PRIMARY_MANIFEST = '.claude-plugin/plugin.json';
const SIBLING_MANIFESTS = ['.claude-plugin/marketplace.json'];
const CHANGELOG_FILE = 'CHANGELOG.md';

/**
 * Read the CHANGELOG as a THREE-state result, to exactly the bar D-09 sets:
 * present, readable and a regular file - never a content grammar check, because
 * the transform pass over it (`prependChangelogEntry` then `promoteUnreleased`)
 * is pure and cannot fail on any text.
 *
 * ABSENT is a real state with real behaviour: a project that keeps no changelog
 * still bumps its manifest. UNREADABLE is the one this exists for - a directory
 * at that path, a permission wall - because reading it as `''` scaffolds a
 * fresh changelog over a release history the seam cannot see, and it did so
 * AFTER the manifest had already been bumped.
 * @param {string} file
 * @returns {{ state:'absent'|'unreadable'|'ok', text: string|null }}
 */
function readChangelog(file) {
  if (!existsSync(file)) return { state: 'absent', text: null };
  // REGULAR FILE, checked rather than assumed. `existsSync` accepts a FIFO, a
  // character device and a directory alike, and `readFileSync` does not fail on
  // the first two - it BLOCKS forever on a FIFO nobody writes to, and streams
  // without end from a device such as /dev/zero. Neither reaches the
  // `unreadable-changelog` refusal this function advertises, so the halt the
  // doc above promises never arrives and the run hangs instead. The doc says
  // the path must be a regular file; this is the line that makes that true
  // rather than a claim, which is the same defect this phase exists to remove.
  try { if (!statSync(file).isFile()) return { state: 'unreadable', text: null }; }
  catch { return { state: 'unreadable', text: null }; }
  try { return { state: 'ok', text: readFileSync(file, 'utf8') }; }
  catch { return { state: 'unreadable', text: null }; }
}

/** The next step per VERDICT CODE, keyed on what lib/release-decision.mjs
 * decided about the primary manifest. Those verdicts already carry a prose
 * `reason` naming the refusal, but a relayed reason is one the check cannot see
 * through, and the four codes have four different remedies: a table says which
 * one, where a single sentence would say none. The fallback keeps a code added
 * to the pure core later from emitting a bare `undefined`. */
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

  // The shipping target is the explicit --version and nothing else: this seam
  // reads no planning prose at all (D-03). Normalized before the manifest is
  // read so a manifest refusal can still name the number the run was asked to
  // ship; the absent-manifest gate below still emits FIRST, because a
  // non-plugin project has nothing to bump whether or not a version was given.
  let target = normalizeTargetVersion(versionArg);
  // KEEP THE RAW ARGUMENT when normalization is left with nothing usable
  // (phase 1 D-06). `--version v` trims to `v`, the leading-`v` strip empties
  // it, and the run used to refuse as `no-target-version` over `target:""` -
  // which is false (a version WAS given) and names nothing the operator can
  // fix. Handing the raw trimmed value to decideManifestBump instead reaches
  // that function's own `unparseable-version`, whose sentence already quotes
  // the offending value, so no verdict code is minted here: the code set has
  // one owner and it is lib/release-decision.mjs.
  //
  // normalizeTargetVersion is deliberately NOT changed. planning.mjs calls it
  // for v-stripping inside the audit's `version_drift` signal, so its contract
  // is not local to this seam - and a null-returning variant would still land
  // on `no-target-version`, which is the sentence that does not name `v`.
  // An ABSENT --version is untouched by this: it has no raw value, so it still
  // refuses as `no-target-version`, and a BLANK one still refuses earlier at
  // its declared lib/arg-contract.mjs row as `missing-flag-value`.
  const rawVersion = typeof versionArg === 'string' ? versionArg.trim() : '';
  if (!target && rawVersion) target = rawVersion;

  // Auto-detect gating (D-04): no plugin manifest -> skip, write nothing.
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

  // Any refusal verdict: one envelope, ok:false, exit 1, nothing written
  // (never a `## [null]` CHANGELOG heading - the Phase-1/Phase-2 null lesson).
  const primary = decideManifestBump(manifest.version, target);
  if (primary.action === 'refuse') {
    emit({ ok: false, action: 'refuse', reason: primary.code, target,
      manifest: { from: primary.from, to: primary.to, bumped: false }, siblings: [], changelog: { changed: false, state: 'not-examined' },
      detail: primary.reason, hint: versionHint(primary.code) });
    return;
  }

  // The one PRIMARY verdict this seam re-classifies (phase 1 D-01), stated in
  // the header's refusal section. `no-version-field` is a `skip` in the pure
  // core and stays one - measured 2026-08-22, this arm's absence returned
  // {"ok":true,"action":"skip"} at exit 0 over a plugin.json carrying no
  // `version`, so milestone.md read success and the close continued over a
  // manifest nobody bumped. At the SEAM it is a halt: the file that names the
  // shipping version cannot name it. Only the PRIMARY manifest reaches here;
  // the sibling loop below keeps recording the same verdict as a `skip` row
  // (D-02), because marketplace.json carries no `version` by design.
  if (primary.code === 'no-version-field') {
    emit({ ok: false, action: 'refuse', reason: 'no-version-field', target,
      manifest: { from: primary.from, to: primary.to, bumped: false }, siblings: [], changelog: { changed: false, state: 'not-examined' },
      detail: `the primary manifest ${PRIMARY_MANIFEST} carries no \`version\` field, so this release would ship unbumped: repair the manifest or close without a version bump. Wrote nothing.`,
      hint: `add a "version" field to ${PRIMARY_MANIFEST} naming the version this release ships from, then re-run the bump` });
    return;
  }

  // --- READ AND DECIDE (nothing below this line touches disk) ---------------
  //
  // The WHOLE write set - primary manifest, every declared sibling, the
  // changelog - is read and turned into a planned write before the first one
  // lands (D-06). The order this replaces is the JRN-03 defect itself: write
  // the primary, THEN read the sibling, THEN read the changelog. Measured
  // 2026-08-22 against that order, an unwritable CHANGELOG.md emitted
  // {"ok":false,"reason":"internal","detail":"EISDIR: ... rename
  // 'CHANGELOG.md.<pid>.1.tmp' -> 'CHANGELOG.md'"} while plugin.json on disk
  // already read the new version - a partially bumped tree in an envelope
  // carrying no `manifest`, `siblings` or `changelog` field at all.
  //
  // Hoisting the reads changes no result: decideManifestBump,
  // prependChangelogEntry and promoteUnreleased are pure and only compute.

  // Primary manifest: a real bump mutates the in-memory manifest here and the
  // bytes reach disk in the write half below (preserve field order).
  if (primary.action === 'bump') manifest.version = target;

  // Sibling manifests: write `version` only where it exists. marketplace.json
  // carries none, so decideManifestBump returns skip and it is left untouched.
  const siblings = [];
  /** @type {Array<{ rel: string, path: string, manifest: Record<string, any> }>} */
  const siblingWrites = [];
  for (const rel of SIBLING_MANIFESTS) {
    const siblingPath = join(dir, rel);
    const siblingRead = readManifest(siblingPath);
    if (siblingRead.state === 'unreadable') {
      // D-07: this is the half of D-08 that SPLIT rather than died. A sibling
      // this seam cannot read used to be a recorded `siblings[]` row on an
      // ok:true run, because the primary write had already landed and unwinding
      // it would have needed a transaction this seam did not have. It has one
      // now - nothing is written until the whole set is decided - so the
      // unreadable sibling refuses the run outright and the tree is left
      // untouched. The arm that KEEPS its ok:true row is the one below: a
      // sibling that parses and is simply not upgradeable.
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
    // A sibling inherits the same guard through the same function. Its refusal
    // is RECORDED, not raised: it never becomes a silent partial ship -
    // milestone.md halts the close on a `siblings[]` refusal exactly as it does
    // on a top-level one.
    siblings.push(d.action === 'refuse'
      ? { file: rel, action: 'refuse', bumped: false, reason: d.code }
      : { file: rel, action: d.action, bumped: d.bumped });
  }

  // Changelog: scaffold the dated heading, then promote whatever is staged
  // under `## [Unreleased]` into it. Composed, not branched - and written ONCE,
  // because atomicWrite renames a temp file into place and two writes would
  // expose an intermediate state on disk.
  //
  // Gated on the primary verdict being `bump` or `noop` and NEVER on `skip`: a
  // manifest with no `version` field bumped nothing, so dating a heading for
  // that release would have the changelog claim a release that never happened
  // while the emit said `skip`. The primary can no longer BE `skip` here - the
  // re-classification arm above refuses it - so the gate is a whitelist, kept
  // as one because it is what a new verdict action has to be added to before it
  // can reach the changelog.
  // `changelog.state` is set on EVERY path that emits a `changelog` object
  // (phase 1 D-10), because the three outcomes used to differ only by key
  // PRESENCE: `section_empty` was absent when CHANGELOG.md was absent and
  // false/true when it had been read, and both absent and false are falsy, so
  // milestone.md's halt read a project with NO changelog exactly as it read a
  // clean one and closed as if the notes were fine. The vocabulary is
  // readChangelog's own - `absent` | `unreadable` | `ok` - plus `not-examined`
  // for the refusals that returned before the gate below was entered. It is a
  // separate field rather than a re-used one: `section_empty` still means what
  // it always meant, and it is still what the empty-section halt reads.
  let changelog = { changed: false, state: 'not-examined' };
  /** @type {string|null} the composed bytes to write, null when nothing changed */
  let changelogText = null;
  const clPath = join(dir, CHANGELOG_FILE);
  if (target && (primary.action === 'bump' || primary.action === 'noop')) {
    // Validated only when it is a MEMBER of this run's write set: the gate
    // above is what decides that, so a run that would never touch the changelog
    // is never refused over it.
    const clRead = readChangelog(clPath);
    if (clRead.state === 'unreadable') {
      emit({ ok: false, action: 'refuse', reason: 'unreadable-changelog', target,
        manifest: { from: primary.from, to: primary.to, bumped: false },
        siblings: [], changelog: { changed: false, state: 'unreadable' },
        detail: `${CHANGELOG_FILE} is present but cannot be read: refusing to scaffold a fresh changelog over a release history this seam cannot see, wrote nothing. Repair ${CHANGELOG_FILE} and re-run the bump.`,
        hint: `make ${CHANGELOG_FILE} readable and re-run - moving it aside would lose the release history this seam refuses to write over` });
      return;
    }
    // ABSENT keeps its own behaviour: no changelog step, changed:false, ok:true
    // - and now SAYS so, `state:"absent"`, instead of being told apart from a
    // clean run by a missing key.
    changelog = { changed: false, state: clRead.state };
    if (clRead.state === 'ok') {
      const url = changelogUrl(manifest, target);
      const scaffold = prependChangelogEntry(clRead.text, { version: target, date, url });
      const promo = promoteUnreleased(scaffold.text, target);
      const changed = scaffold.changed || promo.changed;
      if (changed) changelogText = promo.text;
      // section_empty: the dated section ended up with no body at all - nothing
      // promoted and nothing already there. milestone.md turns that into
      // "author the notes before the bump commit", so no close ships an empty
      // section with nothing said.
      changelog = { changed, promoted: promo.changed, section_empty: promo.sectionEmpty, state: 'ok' };
    }
  }

  // --- WRITE ----------------------------------------------------------------
  // One transition, in the same order the writes have always run, under
  // stop-at-first-failure: a half-applied release tree makes every later step's
  // plan wrong, so the first throw ends the run. Each step is keyed by its
  // repo-relative path, which is what lets a failure report WHICH files landed.
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
    // A step threw anyway. Everything a read could have caught was caught
    // above, so what reaches here is what no pre-flight can see: an EACCES on
    // the tree, an ENOSPC, a symlink planted at atomicWrite's temp path. The
    // dispatch's catch would flatten it to {"ok":false,"reason":"internal"}
    // with no `manifest`, no `siblings` and no `changelog` field at all, which
    // leaves an operator unable to tell a bumped tree from an untouched one.
    //
    // So it gets its own shape, in the vocabulary cmdMilestonePrune already
    // uses for this state: `action:"partial"`, `reason:"partial-bump"`, and
    // every disposition field filled from what the transition COMPLETED rather
    // than from what was decided. It is the one halt where re-running is not a
    // clean retry - the operator reads these three fields, repairs the tree and
    // stops.
    const landed = (key) => applied.completed.includes(key);
    const { error } = applied.failures[0];
    emit({ ok: false, action: 'partial', reason: 'partial-bump', target,
      manifest: { from: primary.from, to: primary.to, bumped: landed(PRIMARY_MANIFEST) },
      siblings: siblings.map((s) => ({ ...s, bumped: landed(s.file) })),
      changelog: { ...changelog, changed: landed(CHANGELOG_FILE) },
      detail: error && error.message ? error.message : String(error),
      // Deliberately NOT "re-run": this is the one halt where a retry compounds
      // the damage, so the hint sends the operator to read the tree first.
      hint: 'read the `bumped` and `changed` flags in this envelope - they name which files landed and which did not - and reconcile the tree by hand BEFORE any re-run, because a second bump over a half-written tree moves the ones that already landed again' });
    return;
  }

  const action = primary.action === 'bump' ? 'bumped' : primary.action; // bump|noop
  emit({ ok: true, action, target, reason: primary.code, detail: primary.reason,
    manifest: { from: primary.from, to: primary.to, bumped: primary.bumped },
    siblings, changelog });
}

/**
 * The `--date` grammar: the `YYYY-MM-DD` this seam's own header states, anchored
 * over the WHOLE string with the month and day ranges spelled out, so
 * `2026-13-45` and `2026-8-1` both fail. Deliberately NOT a calendar check -
 * `2026-02-31` matches, and a rule the header never stated is one the shared
 * argument contract would inherit unstated (D-10).
 */
const DATE_RE = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/;

/**
 * The refusal sentence for a PRESENT `--date`, or null when it is well-formed.
 *
 * The newline arm comes FIRST and has its own sentence because "not YYYY-MM-DD"
 * is the wrong diagnostic for a value that appended a release section: measured
 * 2026-08-18, `--date $'2026-08-18\n## [9.9.9] - forged'` wrote a forged second
 * `## [9.9.9] - forged` heading into CHANGELOG.md above the real one, since the
 * date is interpolated straight into the dated heading. The precedent is
 * planning.mjs's `cursor set --next` newline term (D-10). Neither arm echoes the
 * value back: the sentence names the flag and the grammar, which is what fixes
 * the call, and echoing a newline-carrying value would put it on a line the
 * closing workflow prints.
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
/** This script's declared rows. A subcommand's own row wins over the `'*'` row,
 * where the flags allowed on every arm - here `--dir` - are declared once. */
const ROWS = CONTRACTS['release-bump.mjs'];
/** One flag of `sub`, read through its DECLARED row in the RAISING form, for
 * the flags whose refusal this seam publishes as `missing-flag-value`. The row
 * owns the rule and this binding owns nothing. */
const arg = (sub, name) => requireFlag(argv, name, ROWS[sub][name] || ROWS['*'][name]);

try {
  if (cmd === 'bump') {
    // `--dir` declares `refuse` on both axes: a genuinely ABSENT one still
    // reads as undefined and the cwd default is unchanged, while the empty,
    // valueless and flag-shaped spellings raise the refusal the e.seam arm
    // names. `--version` declares `fallback` on the bare axis (D-12), so a
    // spelling carrying no usable value reads as ABSENT and the verdict is
    // `no-target-version` - never a swallowed neighbouring flag read as a
    // target version.
    const dir = arg('bump', '--dir') || process.cwd();
    // ABSENT and PRESENT-WITH-NOTHING-USABLE are two different calls, and the
    // DECLARATION is what tells them apart now. This dispatch used to probe the
    // flag's own appearance in argv beside its value, because the permissive
    // reader answered `undefined` for a TRAILING valueless `--date` exactly as
    // it did for an absent one - reading presence off the VALUE let that one
    // spelling date today, the absent-vs-empty collapse D-05 refuses arriving
    // by the other door. The row refuses on both axes instead, so `''`, a
    // blank, a flag-shaped value and a trailing bare `--date` all classify as
    // present-with-nothing-usable and the probe is gone.
    //
    // Read in the RETURNING form (D-08) so this file names the refusal in its
    // own vocabulary (D-07): a caller branching on `reason` must be able to
    // tell a malformed date from a malformed `--dir`, and the raising form
    // would render both as `missing-flag-value`.
    const dateRead = evaluateFlag(argv, '--date', ROWS.bump['--date']);
    const dateArg = dateRead.ok ? dateRead.value : undefined;
    const badDate = dateRead.ok
      ? (dateArg === undefined ? null : badDateDetail(dateArg))
      : badDateDetail('');
    // Validated HERE, beside --version and before bump() is entered (D-06), so
    // the refusal does not depend on a manifest this path never read. That is
    // why the envelope carries no `manifest`, `siblings` or `changelog` - the
    // in-bump() refusals fill those from a manifest read; filling them here
    // would fabricate them.
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
  // The seam arm is what a `refuse` row read in the RAISING form costs its bin
  // (D-08/D-09): the raised refusal object carries no `message`, so without it
  // a valueless --dir emits detail "[object Object]". One JSON line on stdout
  // like every other verdict (D-02).
  if (e && e.seam) emit({ ok: false, reason: e.seam, detail: e.detail,
    hint: 'the detail names the flag that refused - give it a value of the kind that flag takes and re-run the command' });
  else emit({ ok: false, reason: 'internal', detail: e && e.message ? e.message : String(e) });
}
