// @ts-check
// why-corpus.mjs - the DISK half of `/cad-why`'s join (WHY-01, phase 1 plan 2).
// Guarded I/O against `.planning/`, failing OPEN with warnings rather than
// throwing - the split `lib/phase-plans.mjs` already keeps against
// `lib/risk-diff.mjs`, and the mirror of `lib/why-record.mjs`, which is pure
// and never touches a filesystem.
//
// WHAT IT BUILDS: the commit-to-phase index, over the two storage tiers a
// milestone close can leave on disk (CONTEXT D-03) -
//
//   - the LIVE `phases/<N>/` of the milestone currently open, and
//   - the `_archive-v<ver>/<N>/` trees the `--mode archive` closes wrote (9
//     archive groups, 27 complete phase directories in this repository).
//
// The `--mode delete` closes left neither, and recovering those out of git
// history is plan 3's job, not this module's.
//
// ONE ENUMERATOR, `phaseDirsIn` FROM `lib/phase-plans.mjs`. It already walks
// `phases` plus every `_archive-`-prefixed group, already CONTAINS that walk
// against a symlinked directory escaping the planning root, already fails open
// on an unreadable directory, and already returns `{label, path}` sorted by
// label so two runs see one order. A second enumerator beside it is the
// split-brain `CAPTURE_WALK_SECTIONS` records the cost of in full: the reader
// and the writer disagreeing about which directories are the walk lost five
// filed bullets, and it can only recur while the fact has two homes.
//
// THE INDEX IS WHAT MAKES THE PHASE A READ FACT RATHER THAN A GUESS (D-06).
// The conventional-commit scope `<type>(<phase>-<plan>)` is CORROBORATION and a
// named fallback only, never the key, because phase numbers reset every
// milestone: `feat(1-1)` exists in seven cycles, both candidate directories
// legitimately exist on disk, and so a scope-keyed read fails INVISIBLY - it
// returns a phase 1, just somebody else's. Every phase number this command
// prints is read off a resolved directory's own name.
//
// AMBIGUITY IS AN ANSWER, NOT A TIE TO BREAK. Two summaries whose abbreviations
// both prefix one full sha are REPORTED as ambiguous, naming both, rather than
// resolved by picking the first, the newest or the longest match. Picking would
// reintroduce exactly the invisible failure the index exists to remove.
// Measured over this repository on 2026-08-23: 256 rows across 28 directories,
// zero prefix pairs and zero cross-directory duplicates - so the ambiguous arm
// is a guard against a corpus that grows into it, and its proof is a built
// fixture.
//
// EVERY READ IS GUARDED AND EVERY FAILURE IS A WARNING. An ABSENT SUMMARY.md is
// silent: a phase directory with plans and no summary is the ordinary
// mid-phase state, and warning there would fire on every run of the milestone
// currently open. A summary that EXISTS and cannot be read is a warning and
// contributes no rows, and a path that is not a regular file is refused BEFORE
// it is opened - `readFileSync` follows a FIFO and blocks the process forever
// waiting for a writer, which is the same defect a `risk_surface` reviewer
// raised against `readChangelog` and the same one still open against
// `planning.mjs`'s `read(reqFile)`. So is a path that RESOLVES outside the
// directory it was joined onto: `phaseDirsIn` contains the walk per DIRECTORY,
// and a symlinked NAME under a contained directory is how that containment came
// back one level down (`readArtifact`'s `EESCAPE`). A warning carries the artifact's label and
// an errno CODE, never the raw error text: a filesystem error message is
// third-party bytes, and this seam's stdout is the place EXP-01 was about.
'use strict';

import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { dirname, join, sep } from 'node:path';

import { recordName } from './adjudication-record.mjs';
import { phaseDirsIn } from './phase-plans.mjs';
import { parseAdjudication, parseCommitRows, shaMatches } from './why-record.mjs';

/** The three states `resolveCommit` answers in, and deliberately no fourth. */
export const RESOLUTIONS = Object.freeze(['resolved', 'ambiguous', 'unresolved']);

/**
 * Read one artifact under the planning root, refusing anything that is not a
 * regular file BEFORE opening it.
 *
 * Three outcomes, and the caller acts on the difference: `absent` (nothing is
 * there - the ordinary state, no warning), `text` (bytes), and a `code` naming
 * why a present path could not be read.
 *
 * @param {string} file
 * @returns {{text: string|null, absent: boolean, code: string|null}}
 */
export function readArtifact(file) {
  let st;
  try {
    st = statSync(file);
  } catch (e) {
    const err = /** @type {any} */ (e);
    if (err && err.code === 'ENOENT') return { text: null, absent: true, code: null };
    return { text: null, absent: false, code: String((err && err.code) || 'ESTAT') };
  }
  // `statSync` follows symlinks, so this judges what the path RESOLVES to - a
  // symlinked SUMMARY.md inside the phase directory still reads, a symlink to a
  // FIFO does not. The check is what stops `readFileSync` blocking on a pipe.
  if (!st.isFile()) return { text: null, absent: false, code: 'ENOTREGULAR' };
  // CONTAINMENT IS PER FILE, NOT ONLY PER DIRECTORY. `phaseDirsIn` contains the
  // WALK against a symlinked directory escaping the planning root, and this
  // module's header says so - but every caller then joins a NAME onto a
  // contained directory, and `statSync` following that name's own symlink is
  // how the escape came back one level down. A `SUMMARY.md` symlinked to
  // `~/.ssh/id_rsa` passes `isFile()` and its bytes reach a seam whose stdout is
  // the place EXP-01 was about. So the RESOLVED path must stay inside the
  // resolved directory the caller joined it onto: a non-symlink resolves to
  // itself and passes trivially, a symlink pointing out is refused before it is
  // opened. Refusing rather than following also closes the check-to-use race on
  // the same line - the path a symlink names cannot be swapped for one outside
  // the directory after the check, because a symlink out never passes it.
  let real;
  let realDir;
  try {
    real = realpathSync(file);
    realDir = realpathSync(dirname(file));
  } catch (e) {
    const err = /** @type {any} */ (e);
    return { text: null, absent: false, code: String((err && err.code) || 'ERESOLVE') };
  }
  if (real !== realDir && !real.startsWith(realDir.endsWith(sep) ? realDir : realDir + sep)) {
    return { text: null, absent: false, code: 'EESCAPE' };
  }
  try {
    return { text: readFileSync(real, 'utf8'), absent: false, code: null };
  } catch (e) {
    const err = /** @type {any} */ (e);
    return { text: null, absent: false, code: String((err && err.code) || 'EREAD') };
  }
}

/**
 * @typedef {{
 *   label: string, path: string, group: string, phase: string, milestone: string,
 * }} PhaseDir
 * @typedef {{
 *   commit: string, plan: string, task: string, description: string, dir: PhaseDir,
 * }} IndexRow
 */

/**
 * Split `phaseDirsIn`'s `<group>/<name>` label into the two facts a rendered
 * entry names: WHICH milestone's record this is, and which phase number in it.
 * `phases` is the live milestone and says so in those words rather than
 * borrowing a version it does not know; `_archive-v3.4.0` reports `v3.4.0`.
 * @param {{label: string, path: string}} d @returns {PhaseDir}
 */
function describe(d) {
  const cut = d.label.indexOf('/');
  const group = cut === -1 ? d.label : d.label.slice(0, cut);
  const phase = cut === -1 ? '' : d.label.slice(cut + 1);
  const milestone = group === 'phases' ? 'the open milestone' : group.replace(/^_archive-/, '');
  return { label: d.label, path: d.path, group, phase, milestone };
}

/**
 * The commit-to-phase index over both on-disk tiers, in ONE pass.
 *
 * `rows` is in a fixed order - by directory label, then by the order the
 * summary's own table wrote them - because the resolution below reports EVERY
 * match and a reshuffled match list is a reshuffled answer.
 *
 * @param {string} planningRoot
 * @returns {{dirs: PhaseDir[], rows: IndexRow[], warnings: string[]}}
 */
export function buildCommitIndex(planningRoot) {
  const dirs = phaseDirsIn(planningRoot).map(describe);
  /** @type {IndexRow[]} */
  const rows = [];
  /** @type {string[]} */
  const warnings = [];
  for (const dir of dirs) {
    const { text, absent, code } = readArtifact(join(dir.path, 'SUMMARY.md'));
    // Absent is the ordinary mid-phase state and is deliberately silent.
    if (absent) continue;
    if (text === null) {
      warnings.push(`${dir.label}/SUMMARY.md could not be read (${code}); its commits are not indexed`);
      continue;
    }
    for (const row of parseCommitRows(text)) rows.push({ ...row, dir });
  }
  return { dirs, rows, warnings };
}

/**
 * Resolve one full 40-character sha against the index.
 *
 * `matches` is every row whose commit cell prefix-matches, in index order.
 * Rows that agree on the directory, plan and task are one answer however many
 * summaries wrote them; rows that disagree are AMBIGUOUS and both are named.
 *
 * @param {{rows: IndexRow[]}} index @param {string} sha
 * @returns {{state: 'resolved'|'ambiguous'|'unresolved', row: IndexRow|null, matches: IndexRow[]}}
 */
export function resolveCommit(index, sha) {
  const matches = index.rows.filter((r) => shaMatches(r.commit, sha));
  if (!matches.length) return { state: 'unresolved', row: null, matches };
  const distinct = new Set(matches.map((r) => `${r.dir.label}\x1f${r.plan}\x1f${r.task}`));
  if (distinct.size > 1) return { state: 'ambiguous', row: null, matches };
  return { state: 'resolved', row: matches[0], matches };
}

/**
 * The artifacts a resolved phase directory joins THROUGH: its CONTEXT.md, its
 * SUMMARY.md, and the ONE plan file the commits table's Plan cell names.
 *
 * The plan file is looked up by the two spellings `declaredFilesIn` already
 * states as equivalent - `PLAN-<key>.md`, and `PLAN.md` for plan 1 spelled
 * bare - by NAME rather than by listing the directory and matching a plan-file
 * grammar. The grammar lives in `lib/phase-plans.mjs`; a second copy of it here
 * is what would drift. A Plan cell that is empty (the three-column era, before
 * plans were numbered) means `PLAN.md` and nothing else.
 *
 * Absent is silent on both, for the reason `buildCommitIndex` gives: a phase
 * with no CONTEXT.md is a real and ordinary state, and a warning there would
 * fire on every run.
 *
 * @param {{label: string, path: string}} dir @param {string} [planCell]
 * @returns {{context: string, summary: string, plan: string,
 *   planFile: string|null, warnings: string[]}}
 */
export function readPhaseRecords(dir, planCell) {
  /** @type {string[]} */
  const warnings = [];
  const pull = (/** @type {string} */ name) => {
    const { text, absent, code } = readArtifact(join(dir.path, name));
    if (text !== null) return text;
    if (!absent) warnings.push(`${dir.label}/${name} could not be read (${code}); it did not reach the join`);
    return '';
  };

  const key = String(planCell || '').trim();
  const names = key && key !== '1' ? [`PLAN-${key}.md`] : [`PLAN-${key || '1'}.md`, 'PLAN.md'];
  let plan = '';
  /** @type {string|null} */
  let planFile = null;
  for (const name of names) {
    const text = pull(name);
    if (text) { plan = text; planFile = name; break; }
  }
  return { context: pull('CONTEXT.md'), summary: pull('SUMMARY.md'), plan, planFile, warnings };
}

// ---------------------------------------------------------------------------
// THE REVIEW EDGE'S DISK AND GIT HALF (D-11).
//
// FILENAMES ARE DERIVED FROM `recordName`, NEVER RE-SPELLED. That function in
// `lib/adjudication-record.mjs` is the ONE rule for what a gate fire's record
// is called, and the writer, the receipt recount and the deferred queue's
// supersession test all resolve by it. A fourth reader with its own
// `/^ADJUDICATION-.*\.json$/` would be the fourth place to fix when the name
// moves, so the fixed affixes below are read OUT of `recordName` by probing it
// with sentinel parts. If that rule ever stops producing a fixed prefix and a
// fixed extension, the probe stops matching and the tests redden, which is the
// point.
//
// RANGE MEMBERSHIP IS ONE `git rev-list` PER DISTINCT RANGE, never one per
// entry: a phase with four records over one range asks git once. `base..head`
// is git's own reading - the commits reachable from `head` and not from `base`
// - and an id this clone does not have (a shallow clone, a dropped commit)
// answers UNRESOLVABLE rather than "not in range", because those are different
// facts and only one of them is knowable here.
//
// GIT RUNS THROUGH AN ARGV ARRAY WITH `-C <dir>`, never a shell string, and the
// two ids are passed as ONE `<base>..<head>` argument after `--`-free
// positional placement that git parses as a revision range. They come out of a
// JSON file this process did not write, so they are validated as hexadecimal
// BEFORE they reach the argv: a value like `--upload-pack=...` in a `base_id`
// field would otherwise be read by git as an option rather than as a revision.
// ---------------------------------------------------------------------------

/** A probe of the one filename rule, used to derive its fixed affixes. */
const NAME_PROBE = recordName('TRIGGER', 'DISCRIMINATOR', 1);
/** Everything `recordName` puts before the trigger. */
const ADJ_PREFIX = NAME_PROBE.slice(0, NAME_PROBE.indexOf('TRIGGER'));
/** Everything it puts after the discriminator. */
const ADJ_SUFFIX = NAME_PROBE.slice(NAME_PROBE.indexOf('DISCRIMINATOR') + 'DISCRIMINATOR'.length);

/** A commit id as git may safely be handed one: hexadecimal, nothing else. */
const COMMIT_ID = /^[0-9a-fA-F]{4,40}$/;

/**
 * The adjudication records in one phase directory, sorted by filename so two
 * runs read them in one order, each parsed through `parseAdjudication`.
 *
 * An absent directory or a directory with no record is `[]` and silent - most
 * phases have none. A record that will not parse contributes a warning naming
 * the file and the issue CODE the pure reader returned, and no findings.
 *
 * @param {{label: string, path: string}} dir
 * @returns {{records: any[], warnings: string[]}}
 */
export function readAdjudications(dir) {
  /** @type {string[]} */
  const warnings = [];
  /** @type {any[]} */
  const records = [];
  let names;
  try {
    names = readdirSync(dir.path, { encoding: 'utf8' });
  } catch {
    return { records, warnings };
  }
  for (const name of names.filter((n) => n.startsWith(ADJ_PREFIX) && n.endsWith(ADJ_SUFFIX)).sort()) {
    const { text, absent, code } = readArtifact(join(dir.path, name));
    if (absent) continue;
    if (text === null) {
      warnings.push(`${dir.label}/${name} could not be read (${code}); its findings did not reach the join`);
      continue;
    }
    const parsed = parseAdjudication(text);
    for (const issue of parsed.issues) warnings.push(`${dir.label}/${name}: ${issue}`);
    records.push({ ...parsed, name });
  }
  return { records, warnings };
}

/**
 * The commits in `base..head`, or null when either id does not resolve in this
 * repository - which is a STATED unresolvable join, not an empty one.
 * @param {string} repoDir @param {string} base @param {string} head
 * @returns {Set<string>|null}
 */
export function rangeMembers(repoDir, base, head) {
  if (!COMMIT_ID.test(String(base || '')) || !COMMIT_ID.test(String(head || ''))) return null;
  try {
    const out = execFileSync('git', ['-C', repoDir, 'rev-list', `${base}..${head}`],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return new Set(out.split('\n').map((l) => l.trim()).filter(Boolean));
  } catch {
    return null;
  }
}
