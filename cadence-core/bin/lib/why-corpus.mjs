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
 *   present?: boolean,
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
  // A MERGED index carries ordered TIERS and is asked in order, taking the
  // first tier that answers at all (`mergeCommitIndexes` states why). A
  // single-tier index is its own only tier, so this is one code path.
  const tiers = /** @type {any} */ (index).tiers || [index];
  for (const tier of tiers) {
    const matches = tier.rows.filter((/** @type {IndexRow} */ r) => shaMatches(r.commit, sha));
    if (!matches.length) continue;
    const distinct = new Set(matches.map((/** @type {IndexRow} */ r) => `${r.dir.label}\x1f${r.plan}\x1f${r.task}`));
    if (distinct.size > 1) return { state: 'ambiguous', row: null, matches };
    return { state: 'resolved', row: matches[0], matches };
  }
  return { state: 'unresolved', row: null, matches: [] };
}

/**
 * One named artifact out of a phase directory, wherever that directory lives.
 *
 * TWO SOURCES, ONE SET OF READERS. A disk directory opens the file; a RECOVERED
 * directory - whose `path` is null because the close deleted it - shows the
 * same name out of the prune commit's parent tree. Both hand back plain text to
 * the SAME pure readers in `lib/why-record.mjs`, which is the whole reason this
 * tier costs a different SOURCE and not a second parser: a `## Deviations`
 * section means the same thing whether its bytes came from `open(2)` or from a
 * tree object.
 *
 * Absent is silent on both, and for the same reason `buildCommitIndex` gives.
 * The git side cannot tell an absent path from an unreadable one - both are a
 * non-zero exit with the message on stderr, which never reaches this seam's
 * stdout - so it takes the absent reading, which is what the corpus actually
 * holds: a phase with no adjudication record and a phase with no CONTEXT.md are
 * both ordinary.
 *
 * The git argument is `<40-hex parent>:<tree>/<name>`. It opens with a
 * hexadecimal sha, so it can never be read by git as an option, and `<tree>`
 * came out of a pathspec-limited `--name-only` under `.planning/phases/`.
 *
 * @param {any} dir @param {string|undefined} repoDir @param {string[]} warnings
 * @returns {(name: string) => string}
 */
function artifactReader(dir, repoDir, warnings) {
  if (dir.path === null) {
    const at = dir.recovered;
    if (!at || !repoDir) return () => '';
    return (name) => {
      const out = git(repoDir, ['show', `${at.parent}:${at.tree}/${name}`]);
      return out.ok ? out.stdout : '';
    };
  }
  return (name) => {
    const { text, absent, code } = readArtifact(join(dir.path, name));
    if (text !== null) return text;
    if (!absent) warnings.push(`${dir.label}/${name} could not be read (${code}); it did not reach the join`);
    return '';
  };
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
 * @param {any} dir @param {string} [planCell] @param {string} [repoDir]
 * @returns {{context: string, summary: string, plan: string,
 *   planFile: string|null, warnings: string[]}}
 */
export function readPhaseRecords(dir, planCell, repoDir) {
  /** @type {string[]} */
  const warnings = [];
  if (!dir) return { context: '', summary: '', plan: '', planFile: null, warnings };
  const pull = artifactReader(dir, repoDir, warnings);

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
 * @param {any} dir @param {string} [repoDir]
 * @returns {{records: any[], warnings: string[]}}
 */
export function readAdjudications(dir, repoDir) {
  /** @type {string[]} */
  const warnings = [];
  /** @type {any[]} */
  const records = [];
  if (!dir) return { records, warnings };
  const pull = artifactReader(dir, repoDir, warnings);
  for (const name of listRecordNames(dir, repoDir)) {
    // The name came from a listing, so the entry IS there; an empty read means
    // the reader already said why, and its warning is the whole answer.
    const before = warnings.length;
    const text = pull(name);
    if (warnings.length > before) continue;
    const parsed = parseAdjudication(text);
    for (const issue of parsed.issues) warnings.push(`${dir.label}/${name}: ${issue}`);
    records.push({ ...parsed, name });
  }
  return { records, warnings };
}

/**
 * The adjudication record names in one phase directory, sorted, from whichever
 * source holds it. The recovered side LISTS the tree rather than guessing
 * filenames: `ADJUDICATION-<trigger>-<discriminator>[-rN].json` carries a
 * discriminator no caller can predict, so the only way to find the records is
 * to ask what is there.
 * @param {any} dir @param {string|undefined} repoDir @returns {string[]}
 */
function listRecordNames(dir, repoDir) {
  /** @type {string[]} */
  let names = [];
  if (dir.path === null) {
    const at = dir.recovered;
    if (!at || !repoDir) return [];
    const out = git(repoDir, ['ls-tree', '--name-only', `${at.parent}:${at.tree}`]);
    if (!out.ok) return [];
    names = out.stdout.split('\n').map((n) => n.trim()).filter(Boolean);
  } else {
    try {
      names = readdirSync(dir.path, { encoding: 'utf8' });
    } catch {
      return [];
    }
  }
  return names.filter((n) => n.startsWith(ADJ_PREFIX) && n.endsWith(ADJ_SUFFIX)).sort();
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

// ---------------------------------------------------------------------------
// THE GIT-HISTORY TIER (D-03's third, D-05) - plan 3.
//
// A `--mode delete` close leaves NEITHER a live `phases/<N>/` nor an
// `_archive-v<ver>/<N>/`, so for 16 of this repository's 25 closes the record
// exists only in git history. This half finds those closes and binds each to
// the milestone label it carried; the map itself is built on top of it.
//
// `--full-history` IS LOAD-BEARING, NOT DECORATIVE. Measured against this
// repository on 2026-08-22 and again on 2026-08-23: the same search WITHOUT it
// returns 4 prune commits, and WITH it returns 25. Git's default history
// simplification drops commits a pathspec makes "uninteresting", so the plain
// form silently loses 21 of 25 closes and would report the gap on milestones
// the record can actually answer. `PRUNE_ARGV` is exported and its control -
// the same argv with the flag filtered out, returning strictly fewer - is
// asserted in why-corpus.test.mjs, so the flag cannot be dropped without a red
// test.
//
// `-M` IS PINNED EXPLICITLY (D-17) rather than inherited from whatever
// `diff.renames` the reading machine happens to configure. It changes nothing
// here - all three of `-M`, `--no-renames` and the default answer 25 - because
// the pathspec limits the diff BEFORE rename detection runs, so the archive
// copy a `--mode archive` close adds is never a rename candidate for the phase
// copy it deletes. Pinning it is what keeps that true on someone else's clone.
//
// ONE PASS, NOT ONE `git show` PER ENTRY. D-05 rejects the lazy per-commit
// form, which reruns the prune search for every chain entry. `--name-only`
// rides the same invocation so the deleted paths come back with the commits,
// and the labels come back in ONE further call over exactly the commits the
// first pass found.
//
// THE LABEL COMES FROM THE CLOSE'S OWN WRITE, NEVER FROM ITS SUBJECT LINE. A
// prune appends `.planning/ARCHIVE.md`'s `## <label>` heading in the SAME
// commit that removes the directories (measured: `72940906` appends
// `## v3.5.9`), so the binding is a diff of one file at one commit rather than
// a regex over a commit message. It is available for 7 of this repository's 25
// closes and no more, because `.planning/ARCHIVE.md` did not exist before
// v3.5.3 - an absent label is therefore the ORDINARY state of an old close and
// is reported as absent rather than guessed. Exactly one added heading binds;
// zero binds nothing, and two or more bind nothing either, because a close that
// wrote two headings does not say which one owns the deleted phases.
//
// A MERGE-SHAPED PRUNE COMMIT IS REPORTED, NOT RESOLVED. Every recovery below
// reads `<prune>^`, and on a commit with two parents `^` names the first one
// arbitrarily - so a merge would silently answer out of whichever side git
// listed first. All 25 in this repository are single-parent today, which is
// what makes refusing cheap rather than a lost answer.
//
// AND THE REFUSAL IS NOT REACHABLE THROUGH `PRUNE_ARGV` AS SHIPPED. Measured on
// git 2.55.0 on 2026-08-23 against two built fixtures - an ordinary merge of a
// branch that deleted the summary, and an "evil" merge whose own tree performs
// the deletion - `--diff-filter=D` selects NEITHER, because a merge produces no
// diff under the default `--diff-merges=off` and so matches no diff filter.
// Adding `--diff-merges=first-parent` to the same argv makes the evil merge
// come back with its two parents, which is why the guard stays and why the
// parse is a separate exported function: `parsePruneRecords` is where the
// two-parent record is proved refused, over stdout git itself produced.
// ---------------------------------------------------------------------------

/** The pathspec a milestone close deletes when it prunes a phase directory. */
export const PRUNED_SUMMARY = '.planning/phases/*/SUMMARY.md';

/** The record separator that lets `--name-only`'s path lines be told apart
 * from the next commit's header - `\x01`, matching `LOG_FORMAT`'s use of
 * `\x1f` for the same reason: a byte no path and no date can contain. */
const PRUNE_FORMAT = '%x01%H%x1f%cI%x1f%P';

/** The prune search, exported so its control can be built from it. */
export const PRUNE_ARGV = Object.freeze([
  'log', '--full-history', '-M', '--diff-filter=D', '--name-only',
  `--format=${PRUNE_FORMAT}`, '--', PRUNED_SUMMARY,
]);

/** The heading a close appends to ARCHIVE.md, as a diff line. */
const ADDED_SECTION = /^\+## (.+?)\s*$/;

/** `.planning/phases/<N>/SUMMARY.md`, with the phase number captured. It is
 * READ from the deleted path, which is a recovered artifact, never guessed. */
const PRUNED_PATH = /^\.planning\/phases\/([^/]+)\/SUMMARY\.md$/;

/**
 * Run git in `repoDir`, never throwing. A non-zero exit or a spawn failure is
 * `{ok: false}` with whatever stdout arrived, which every caller here treats as
 * "this tier contributes nothing" rather than as a failed query.
 * @param {string} repoDir @param {readonly string[]} args
 * @returns {{ok: boolean, stdout: string}}
 */
function git(repoDir, args) {
  try {
    return { ok: true, stdout: execFileSync('git', ['-C', repoDir, ...args],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] }) };
  } catch (e) {
    const err = /** @type {any} */ (e);
    return { ok: false, stdout: typeof err.stdout === 'string' ? err.stdout : '' };
  }
}

/**
 * @typedef {{
 *   commit: string, date: string, parents: string[], parent: string|null,
 *   label: string|null, phases: Array<{phase: string, path: string}>,
 *   refused: string|null,
 * }} PruneCommit
 */

/**
 * The milestone label each of `commits` bound, read off the `## <label>`
 * heading that commit added to `.planning/ARCHIVE.md`. ONE git call for the
 * whole set.
 * @param {string} repoDir @param {string[]} commits
 * @returns {Map<string, string|null>}
 */
function pruneLabels(repoDir, commits) {
  /** @type {Map<string, string[]>} */
  const added = new Map();
  for (const c of commits) added.set(c, []);
  if (!commits.length) return new Map();

  const out = git(repoDir, ['show', '-U0', '-M', '--format=%x01%H', ...commits, '--', '.planning/ARCHIVE.md']);
  let current = null;
  for (const line of out.stdout.split('\n')) {
    if (line.startsWith('\x01')) { current = line.slice(1).trim(); continue; }
    if (current === null || !added.has(current)) continue;
    const m = line.match(ADDED_SECTION);
    if (m) added.get(current).push(m[1]);
  }
  /** @type {Map<string, string|null>} */
  const labels = new Map();
  // EXACTLY ONE added heading binds. Zero is the ordinary state of a close
  // older than ARCHIVE.md itself; two or more does not say which heading owns
  // the deleted phases, so it binds nothing rather than picking.
  for (const [commit, headings] of added) labels.set(commit, headings.length === 1 ? headings[0] : null);
  return labels;
}

/**
 * Every commit that DELETED a phase SUMMARY, newest first, each bound to the
 * milestone label its close carried and carrying the phase paths it removed.
 *
 * Order is explicit (D-17): commit date descending, then full 40-character sha
 * descending, never git's own emission order.
 *
 * @param {string} repoDir
 * @returns {{prunes: PruneCommit[], warnings: string[]}}
 */
export function findPruneCommits(repoDir) {
  const out = git(repoDir, PRUNE_ARGV);
  if (!out.ok && !out.stdout) return { prunes: [], warnings: [] };
  const prunes = parsePruneRecords(out.stdout);

  const labels = pruneLabels(repoDir, prunes.map((p) => p.commit));
  for (const p of prunes) p.label = labels.get(p.commit) ?? null;

  return { prunes, warnings: prunes.filter((p) => p.refused).map((p) => p.refused) };
}

/**
 * Turn `PRUNE_ARGV`'s stdout into prune records, sorted by the explicit key.
 *
 * Pure and exported for the reason the module header gives: the merge-shaped
 * record the guard refuses cannot be produced by `PRUNE_ARGV` as shipped, so
 * the only way to prove the refusal over bytes GIT wrote rather than bytes a
 * test invented is to run the same log with `--diff-merges=first-parent` and
 * feed its stdout here.
 *
 * @param {string} stdout @returns {PruneCommit[]}
 */
export function parsePruneRecords(stdout) {
  /** @type {PruneCommit[]} */
  const prunes = [];
  for (const record of String(stdout || '').split('\x01')) {
    if (!record.trim()) continue;
    const lines = record.split('\n');
    const [commit, date, parentField] = String(lines[0] || '').split('\x1f');
    if (!commit) continue;
    const parents = String(parentField || '').split(' ').map((p) => p.trim()).filter(Boolean);
    /** @type {Array<{phase: string, path: string}>} */
    const phases = [];
    for (const raw of lines.slice(1)) {
      const path = raw.trim();
      const m = path.match(PRUNED_PATH);
      if (m) phases.push({ phase: m[1], path });
    }
    phases.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
    prunes.push({
      commit,
      date: String(date || ''),
      parents,
      parent: parents.length === 1 ? parents[0] : null,
      label: null,
      phases,
      refused: parents.length > 1
        ? `the close at ${commit.slice(0, 8)} is a merge with ${parents.length} parents, `
          + 'so the tree its phases were deleted from cannot be named without picking one arbitrarily'
        : parents.length === 0
          ? `the close at ${commit.slice(0, 8)} is a root commit, so there is no parent tree to recover from`
          : null,
    });
  }

  prunes.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    if (a.commit === b.commit) return 0;
    return a.commit > b.commit ? -1 : 1;
  });
  return prunes;
}

// ---------------------------------------------------------------------------
// THE REVERSE COMMIT-TO-PHASE MAP (D-05), AND THE MERGE WITH THE DISK TIERS.
//
// THE KEY IS THE COMMIT THE RECORD NAMES. Not the directory name, not the
// commit message scope. That is the whole reason a RENUMBERED phase resolves
// unchanged: `/cad-phase renumber` moves the directory and leaves the summary's
// `## Commits` rows exactly where they were, so a map keyed on the row's commit
// cell answers the same thing before and after the move, while a map keyed on
// `phases/<N>` answers a different phase or nothing at all.
//
// MATCHING IS `shaMatches` AND NOTHING ELSE - case-insensitive, a prefix test in
// either direction, against the full 40-character shas the chain carries
// (D-17). That is what admits the 7-character abbreviations every on-disk
// archive uses AND the 8-character ones v3.5.9's record carries, without a
// fixed-width slice that would be wrong for one era or the other.
//
// A SHA THE MAP NAMES THAT THIS CLONE DOES NOT HAVE IS A STATED ABSENCE, NOT A
// DROPPED ROW. Measured here on 2026-08-23, 248 of 248 shas extracted from the
// archived tables resolve; a shallow clone is the case that does not, and there
// the honest answer is "the record names a commit this clone cannot show you",
// never a silently shorter map. The presence probe is ONE `git cat-file
// --batch-check` over every recovered row, reading shas on STDIN - so a commit
// cell can never be read by git as an option, whatever a summary's table says.
//
// THE DISK TIER WINS, ALWAYS. A `--mode archive` close both DELETED
// `phases/<N>/SUMMARY.md` and ADDED `_archive-v<ver>/<N>/SUMMARY.md` in one
// commit, so every archived phase is ALSO recoverable out of that commit's
// parent - the same rows under two labels. Merging the two tiers flat would
// make every one of them `ambiguous`, which is the index reporting a conflict
// with itself. So the merged index carries ORDERED TIERS and the resolution
// asks them in order, taking the first tier that answers at all: the on-disk
// record is the one a reader can open, and the recovered tier exists for the
// commits no on-disk summary claims. Ambiguity WITHIN a tier is still an
// answer, and still stops the walk.
// ---------------------------------------------------------------------------

/**
 * One recovered phase directory - the same shape `describe` returns for a disk
 * directory, with `path: null` (there is nothing to open) and a `recovered`
 * anchor naming the tree its artifacts live in.
 * @param {PruneCommit} prune @param {string} phase @param {string} path
 * @returns {PhaseDir}
 */
function recoveredDir(prune, phase, path) {
  const tree = path.slice(0, path.lastIndexOf('/'));
  return /** @type {any} */ ({
    label: `${prune.parent.slice(0, 8)}:${tree}`,
    path: null,
    group: 'recovered',
    phase,
    // The label the close bound, or a statement that it bound none. Never the
    // close's subject line, and never a version inferred from the date.
    milestone: prune.label || `an unlabelled close (${prune.commit.slice(0, 8)})`,
    recovered: { prune: prune.commit, parent: prune.parent, tree },
  });
}

/**
 * Mark every row's commit cell as present in this clone or not, in ONE call.
 * Shas ride STDIN, so no cell is ever argv.
 * @param {string} repoDir @param {IndexRow[]} rows @returns {void}
 */
function markPresence(repoDir, rows) {
  if (!rows.length) return;
  const ids = [...new Set(rows.map((r) => r.commit))];
  let out = { ok: false, stdout: '' };
  try {
    out = { ok: true, stdout: execFileSync('git', ['-C', repoDir, 'cat-file', '--batch-check'],
      { encoding: 'utf8', input: `${ids.join('\n')}\n`, stdio: ['pipe', 'pipe', 'ignore'] }) };
  } catch { /* an unreadable probe leaves every row stated absent below */ }
  /** @type {Map<string, boolean>} */
  const present = new Map();
  const lines = out.stdout.split('\n').filter((l) => l !== '');
  ids.forEach((id, i) => {
    const answer = lines[i] || '';
    present.set(id, / commit \d+$/.test(answer));
  });
  for (const row of rows) row.present = present.get(row.commit) === true;
}

/**
 * The reverse commit-to-phase map, recovered from git history alone.
 *
 * ONE pass for the closes (`findPruneCommits`), then one `git show
 * <prune>^:<path>` per deleted phase summary - 79 of them in this repository,
 * measured at 76 ms total on 2026-08-23, which is what makes the eager form
 * D-05 chose cheaper than the lazy one it rejected.
 *
 * @param {string} repoDir
 * @returns {{dirs: PhaseDir[], rows: IndexRow[], warnings: string[]}}
 */
export function buildRecoveredIndex(repoDir) {
  const { prunes, warnings } = findPruneCommits(repoDir);
  /** @type {PhaseDir[]} */
  const dirs = [];
  /** @type {IndexRow[]} */
  const rows = [];
  for (const prune of prunes) {
    if (!prune.parent) continue; // already named in `warnings` by the refusal
    for (const { phase, path } of prune.phases) {
      const dir = recoveredDir(prune, phase, path);
      const out = git(repoDir, ['show', `${prune.parent}:${path}`]);
      if (!out.ok) {
        warnings.push(`${path} could not be recovered from ${prune.parent.slice(0, 8)}; its commits are not indexed`);
        continue;
      }
      dirs.push(dir);
      for (const row of parseCommitRows(out.stdout)) rows.push({ ...row, dir });
    }
  }
  markPresence(repoDir, rows);
  return { dirs, rows, warnings };
}

/**
 * The one index a caller asks, over ordered tiers: the on-disk record first,
 * the git-recovered record second (see the header).
 * @param {{dirs: PhaseDir[], rows: IndexRow[], warnings: string[]}} disk
 * @param {{dirs: PhaseDir[], rows: IndexRow[], warnings: string[]}} recovered
 * @returns {any}
 */
export function mergeCommitIndexes(disk, recovered) {
  return {
    dirs: [...disk.dirs, ...recovered.dirs],
    rows: [...disk.rows, ...recovered.rows],
    tiers: [disk, recovered],
    warnings: [...disk.warnings, ...recovered.warnings],
  };
}
