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
// The file reader this file used to define for itself; its ''-on-failure
// contract lives in lib/seam-input.mjs. `readFileSync` stays imported above for
// the manifest parse below, which must tell an unreadable manifest from an
// empty one.
import { readText } from './lib/seam-input.mjs';
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
      emit({ ok: false, action: 'refuse', reason: 'bad-date', detail: badDate });
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
  if (e && e.seam) emit({ ok: false, reason: e.seam, detail: e.detail });
  else emit({ ok: false, reason: 'internal', detail: e && e.message ? e.message : String(e) });
}
