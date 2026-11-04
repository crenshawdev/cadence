// @ts-check
// Disk half of /cad-why's join: guarded I/O against `.planning/` that fails open with warnings instead of throwing. It mirrors why-record.mjs, which is pure and never touches a filesystem.
// It builds the commit-to-phase index over the two tiers a milestone close can leave on disk: the live `phases/<N>/` and the archived trees from `--mode archive` closes. `--mode delete` closes leave neither, and buildRecoveredIndex gets those out of git history. The off-roadmap `tasks/<slug>/RECORD.md` a /cad-task run leaves is a tier of its own (buildTaskIndex says why).
// One enumerator per tier and never a second opinion about either: `phaseDirsIn` (lib/phase-plans.mjs) for the phase tiers, `taskRecordsIn` (lib/task-record.mjs) for tasks. They already contain the walk against a symlinked directory escaping the planning root, fail open on an unreadable directory and sort by label. A second enumerator over one tier is the split-brain CAPTURE_WALK_SECTIONS records, where reader and writer disagreed about the walk and five filed bullets were lost.
// The index makes the phase a read fact. The commit scope `<type>(<phase>-<plan>)` is corroboration only, never the key, because phase numbers reset every milestone: `feat(1-1)` exists in seven cycles, both directories exist, and a scope-keyed read fails invisibly by returning somebody else's first phase. Every phase number printed is read off a resolved directory's name.
// Ambiguity is an answer, not a tie to break. Two summaries whose abbreviations both prefix one full sha are reported as ambiguous, naming both, instead of picking the first, the newest or the longest, which would bring back the invisible failure the index exists to remove.
// Every read is guarded and every failure is a warning. An absent SUMMARY.md is silent, since a phase with plans and no summary is the ordinary mid-phase state. A summary that exists and can't be read warns and contributes no rows. A path that isn't a regular file is refused before opening, because readFileSync on a FIFO blocks forever waiting for a writer, and so is one that resolves outside the directory it was joined onto (a symlinked name under a contained directory is how the walk's containment came back one level down).
// Warnings carry the artifact's label and an errno code, never raw error text: a filesystem error message is third-party bytes, and this seam's stdout is where those must not land.
'use strict';

import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { within } from './contained.mjs';

import { recordName } from './adjudication-record.mjs';
import { phaseDirsIn } from './phase-plans.mjs';
import { parseArchiveRows } from './planning-files.mjs';
import { RECORD_FILE, TASKS_DIR, taskRecordsIn } from './task-record.mjs';
import { parseAdjudication, parseCommitRows, shaMatches } from './why-record.mjs';

/**
 * Read one artifact under the planning root, refusing anything that isn't a regular file before opening it.
 * Three outcomes: `absent` (the ordinary state, no warning), `text`, and a `code` saying why a present path couldn't be read.
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
  // statSync follows symlinks, so this judges what the path resolves to: a symlinked SUMMARY.md in the phase directory still reads, a symlink to a FIFO doesn't, and that's what stops readFileSync blocking on a pipe
  if (!st.isFile()) return { text: null, absent: false, code: 'ENOTREGULAR' };
  // containment is per file, not only per directory. phaseDirsIn contains the walk, but every caller joins a name onto a contained
  // directory, and statSync following that name's own symlink brings the escape back: a SUMMARY.md symlinked to `~/.ssh/id_rsa`
  // passes isFile() and its bytes would reach a seam whose stdout mustn't carry them. So the resolved path has to stay inside the
  // resolved directory. A non-symlink passes trivially and a symlink pointing out is refused before it's opened, which also
  // closes the check-to-use race, since a symlink out never passes.
  let real;
  let realDir;
  try {
    real = realpathSync(file);
    realDir = realpathSync(dirname(file));
  } catch (e) {
    const err = /** @type {any} */ (e);
    return { text: null, absent: false, code: String((err && err.code) || 'ERESOLVE') };
  }
  if (!within(real, realDir)) {
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
 * Split phaseDirsIn's `<group>/<name>` label into the milestone this record belongs to and the phase number in it.
 * `phases` is the open milestone and says so instead of borrowing a version it doesn't know; an archived group reports its bare version, v3.4.0 for instance.
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
 * The commit-to-phase index over both on-disk tiers, in one pass.
 * `rows` has a fixed order, by directory label then the summary table's own order, because resolution reports every match and a reshuffled match list is a reshuffled answer.
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
    // absent is the ordinary mid-phase state, so it's silent
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
 * A task directory's descriptor: describe()'s five keys plus the `slug` marker a consumer tells a task directory from a phase one by. `phase` and `milestone` are null because /cad-task is off-roadmap, and a placeholder would eventually be printed as a number.
 * @typedef {{
 *   label: string, path: string, group: string, phase: null, milestone: null,
 *   slug: string,
 * }} TaskDir
 */

/**
 * The commit-to-task index, the same `{dirs, rows, warnings}` shape as buildCommitIndex, so resolveCommit needs no change and this is an added tier, not a second resolution path.
 * Not phaseDirsIn, deliberately: it only admits a directory holding a conforming PLAN file, and /cad-task's inline arm writes none. Widening it would hand every task directory to every other caller and make describe() render `tasks phase <slug>`, a wrong join instead of a missing one, which is what /cad-why exists to prevent.
 * Where a record lives comes from taskRecordsIn in lib/task-record.mjs, which the writer and the recall walk use too, and never from a second walk of `tasks/` here (the header says what that costs).
 * The bytes go through readArtifact and parseCommitRows unchanged: the record carries its own `## Commits` table so no second table grammar is needed.
 * A `tasks/<slug>` label can't collide with a phase or archive label, so the merged index's per-label lookups stay unambiguous.
 *
 * @param {string} planningRoot
 * @returns {{dirs: TaskDir[], rows: IndexRow[], warnings: string[]}}
 */
export function buildTaskIndex(planningRoot) {
  /** @type {TaskDir[]} */
  const dirs = [];
  /** @type {IndexRow[]} */
  const rows = [];
  /** @type {string[]} */
  const warnings = [];
  for (const { slug, path } of taskRecordsIn(planningRoot)) {
    /** @type {TaskDir} */
    const dir = {
      label: `${TASKS_DIR}/${slug}`,
      path: dirname(path),
      group: TASKS_DIR,
      phase: null,
      milestone: null,
      slug,
    };
    dirs.push(dir);
    const { text, absent, code } = readArtifact(path);
    // absent only through a race, since the lister stat'd this path as a regular file; taken silently like buildCommitIndex because a record deleted between the walk and the read isn't a corpus defect
    if (absent) continue;
    if (text === null) {
      warnings.push(`${dir.label}/${RECORD_FILE} could not be read (${code}); its commits are not indexed`);
      continue;
    }
    for (const row of parseCommitRows(text)) rows.push({ ...row, dir });
  }
  return { dirs, rows, warnings };
}

/**
 * Resolve one full 40-character sha against the index.
 * `matches` is every row whose commit cell prefix-matches, in index order. Rows agreeing on directory, plan and task are one answer however many summaries wrote them; rows that disagree are ambiguous and both are named.
 *
 * @param {{rows: IndexRow[]}} index @param {string} sha
 * @returns {{state: 'resolved'|'ambiguous'|'unresolved', row: IndexRow|null, matches: IndexRow[]}}
 */
export function resolveCommit(index, sha) {
  // a merged index carries ordered tiers and is asked in order, taking the first tier that answers at all; a single-tier index is its own only tier, so there's one code path
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
 * A disk directory opens the file; a recovered directory (path null, since the close deleted it) reads the same name out of the prune commit's parent tree. Both hand plain text to the same pure readers in why-record.mjs, so this tier costs a different source and not a second parser.
 * Absent is silent on both, for the reason buildCommitIndex gives. git can't tell an absent path from an unreadable one (both exit non-zero with the message on stderr, which never reaches stdout), so it takes the absent reading, which is what the corpus holds: a phase with no adjudication record or no context file is ordinary.
 * The git argument is `<40-hex parent>:<tree>/<name>`. It opens with a hexadecimal sha so git can never read it as an option, and `<tree>` came out of a pathspec-limited `--name-only` under `.planning/phases/`.
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
 * The artifacts a resolved phase directory joins through: its context file, its summary, and the one plan file the commits table's Plan cell names.
 * The plan file is looked up by name in the two spellings declaredFilesIn treats as equivalent, `PLAN-<key>.md` and a bare `PLAN.md` for the first plan, instead of listing the directory against a plan-file grammar, because a second copy of that grammar (it lives in lib/phase-plans.mjs) is what would drift. An empty Plan cell (the three-column era) means `PLAN.md` and nothing else.
 * A task directory declares in its RECORD.md, which is tried first: it carries the `- **Files:**` line so taskDeclaredFiles, and through it declaringTasks and the `declared by:` edge, can reach it. Otherwise the edge would read the task's PLAN.md when the planned path wrote one, which says what the run set out to touch instead of what it did, and nothing at all on the inline path.
 * The context and summary are read as they are: a task directory has neither, absent is silent, and the decision and deviation edges state their own absence, which is the true answer.
 * Absent is silent on both, for the reason buildCommitIndex gives: a phase with no context file is ordinary and a warning would fire on every run.
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
  const spellings = key && key !== '1' ? [`PLAN-${key}.md`] : [`PLAN-${key || '1'}.md`, 'PLAN.md'];
  // the slug marker again, never a label prefix; a task directory may hold a PLAN.md too (the planned /cad-task arm writes one), so the RECORD is tried ahead of it, not only as a fallback
  const names = dir.slug ? [RECORD_FILE, ...spellings] : spellings;
  let plan = '';
  /** @type {string|null} */
  let planFile = null;
  for (const name of names) {
    const text = pull(name);
    if (text) { plan = text; planFile = name; break; }
  }
  return { context: pull('CONTEXT.md'), summary: pull('SUMMARY.md'), plan, planFile, warnings };
}

// The review edge's disk and git half.
// Filenames are derived from recordName, never re-spelled: it's the one rule for what a gate fire's record is called, and the writer, the receipt recount and the deferred queue all resolve by it. A fourth reader with its own filename regex would be a fourth place to fix when the name moves, so the fixed affixes are read out of recordName by probing it with sentinel parts. If it ever stops producing a fixed prefix and extension the probe stops matching and the tests redden, which is the point.
// Range membership is one `git rev-list` per distinct range, never one per entry. An id this clone doesn't have (a shallow clone, a dropped commit) answers unresolvable instead of "not in range", since those are different facts and only one is knowable here.
// git runs through an argv array with `-C <dir>`, never a shell string. The ids come out of a JSON file this process didn't write, so they're validated as hexadecimal before they reach the argv: a `base_id` like `--upload-pack=...` would otherwise be read by git as an option.

/** A probe of the one filename rule, used to derive its fixed affixes. */
const NAME_PROBE = recordName('TRIGGER', 'DISCRIMINATOR', 1);
/** Everything `recordName` puts before the trigger. */
const ADJ_PREFIX = NAME_PROBE.slice(0, NAME_PROBE.indexOf('TRIGGER'));
/** Everything it puts after the discriminator. */
const ADJ_SUFFIX = NAME_PROBE.slice(NAME_PROBE.indexOf('DISCRIMINATOR') + 'DISCRIMINATOR'.length);

/** A commit id as git may safely be handed one: hexadecimal, nothing else. */
const COMMIT_ID = /^[0-9a-fA-F]{4,40}$/;

/**
 * The adjudication records in one phase directory, sorted by filename so two runs read them in one order, each parsed through parseAdjudication.
 * An absent directory or one with no record is `[]` and silent, since most phases have none. A record that won't parse contributes a warning naming the file and the issue code the pure reader returned, and no findings.
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
    // the name came from a listing so the entry is there; an empty read means the reader already said why, and its warning is the whole answer
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
 * The adjudication record names in one phase directory, sorted, from whichever source holds it. The recovered side lists the tree instead of guessing filenames, since the discriminator in `ADJUDICATION-<trigger>-<discriminator>[-rN].json` can't be predicted.
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
 * The commits in `base..head`, or null when either id doesn't resolve in this repository, which is a stated unresolvable join, not an empty one.
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

// The git-history tier. A `--mode delete` close leaves neither a live `phases/<N>/` nor an archived tree, so most of this repository's closes exist only in git history. This half finds those closes and binds each to the milestone label it carried; the map is built on top.
// `--full-history` is load-bearing: git's default history simplification drops commits a pathspec makes uninteresting, so without it the search silently loses most closes and reports a gap on milestones the record can answer. PRUNE_ARGV is exported and why-corpus.test.mjs asserts its control (the same argv minus the flag) returns strictly fewer, so the flag can't be dropped without a red test.
// `-M` is pinned rather than inherited from the reading machine's diff.renames. It changes nothing today because the pathspec limits the diff before rename detection, so the archive copy an archive close adds is never a rename candidate for the phase copy it deletes; pinning keeps that true on someone else's clone.
// One pass, not one `git show` per entry: `--name-only` rides the same invocation so deleted paths come back with the commits, and the labels come back in one further call over exactly the commits found.
// The label comes from the close's own write, never its subject line: a prune appends `.planning/ARCHIVE.md`'s `## <label>` heading in the same commit that removes the directories, so the binding is a diff of one file at one commit. It exists only for closes after ARCHIVE.md did, and an absent label is the ordinary state of an old close, reported as absent and never guessed. Exactly one added heading binds; zero or several bind nothing, since several don't say which owns the deleted phases.
// A merge-shaped prune commit is reported, not resolved: every recovery reads `<prune>^`, and on a two-parent commit that names the first parent arbitrarily, so a merge would silently answer from whichever side git listed first.
// That refusal isn't reachable through PRUNE_ARGV as shipped: `--diff-filter=D` selects no merge, because a merge produces no diff under the default `--diff-merges=off`. Adding `--diff-merges=first-parent` makes an evil merge (one whose own tree does the deletion) come back with its two parents, which is why the guard stays and why parsePruneRecords is a separate export, provable over stdout git itself produced.

/** The pathspec a milestone close deletes when it prunes a phase directory. */
const PRUNED_SUMMARY = '.planning/phases/*/SUMMARY.md';

/** A record separator (`\x01`, like LOG_FORMAT's `\x1f`) so `--name-only`'s path lines can be told from the next commit's header: a byte no path and no date can contain. */
const PRUNE_FORMAT = '%x01%H%x1f%cI%x1f%P';

/** The prune search, exported so its control can be built from it. */
export const PRUNE_ARGV = Object.freeze([
  'log', '--full-history', '-M', '--diff-filter=D', '--name-only',
  `--format=${PRUNE_FORMAT}`, '--', PRUNED_SUMMARY,
]);

/** The heading a close appends to ARCHIVE.md, as a diff line. */
const ADDED_SECTION = /^\+## (.+?)\s*$/;

/** `.planning/phases/<N>/SUMMARY.md` with the phase number captured. It's read off the deleted path, a recovered artifact, never guessed. */
const PRUNED_PATH = /^\.planning\/phases\/([^/]+)\/SUMMARY\.md$/;

/**
 * Run git in `repoDir` without throwing. A non-zero exit or spawn failure is `{ok: false}` with whatever stdout arrived, which every caller treats as "this tier contributes nothing" and not as a failed query.
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
 * The milestone label each of `commits` bound, read off the `## <label>` heading that commit added to ARCHIVE.md, in one git call for the whole set.
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
  // exactly one added heading binds: zero is the ordinary state of a close older than ARCHIVE.md, and two or more don't say which owns the deleted phases, so they bind nothing instead of picking
  for (const [commit, headings] of added) labels.set(commit, headings.length === 1 ? headings[0] : null);
  return labels;
}

/**
 * Every commit that deleted a phase SUMMARY, newest first, each bound to the milestone label its close carried and carrying the phase paths it removed.
 * Order is explicit, commit date descending then full sha descending, never git's own emission order.
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
 * Turn PRUNE_ARGV's stdout into prune records, sorted by the explicit key.
 * Pure and exported because the merge-shaped record the guard refuses can't be produced by PRUNE_ARGV as shipped. Proving the refusal over bytes git wrote means running the same log with `--diff-merges=first-parent` and feeding its stdout here.
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

// The reverse commit-to-phase map, and its merge with the disk tiers.
// The key is the commit the record names, not the directory name or the commit scope. That's why a renumbered phase resolves unchanged: `/cad-phase renumber` moves the directory and leaves the summary's `## Commits` rows where they were, so a map keyed on the row's commit cell answers the same before and after, while one keyed on `phases/<N>` answers a different phase or nothing.
// Matching is shaMatches and nothing else, case-insensitive and a prefix test either way against the full 40-character shas the chain carries. That admits the 7-character abbreviations the archives use and the 8-character ones an older record carries, without a fixed-width slice that would be wrong for one era.
// A sha the map names that this clone doesn't have is a stated absence, not a dropped row. A shallow clone is the case, and the honest answer there is "the record names a commit this clone cannot show you", never a silently shorter map. The presence probe is one `git cat-file --batch-check` reading shas on stdin, so a commit cell can never be read by git as an option.
// The disk tier wins, always. An archive close both deleted `phases/<N>/SUMMARY.md` and added the archived copy in one commit, so every archived phase is also recoverable from that commit's parent: the same rows under two labels. Merging flat would make each of them ambiguous, the index reporting a conflict with itself. So the merged index carries ordered tiers and resolution takes the first tier that answers at all: the on-disk record is the one a reader can open, and the recovered tier exists for commits no on-disk summary claims. Ambiguity within a tier is still an answer and still stops the walk.

/**
 * One recovered phase directory: the same shape describe returns for a disk directory, with `path` null (nothing to open) and a `recovered` anchor naming the tree its artifacts live in.
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
    // the label the close bound, or a statement that it bound none; never the close's subject line, never a version inferred from the date
    milestone: prune.label || `an unlabelled close (${prune.commit.slice(0, 8)})`,
    recovered: { prune: prune.commit, parent: prune.parent, tree },
  });
}

/**
 * Mark every row's commit cell as present in this clone or not, in one call. Shas ride stdin, so no cell is ever argv.
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
 * Many `<rev>:<path>` blobs read in one `git cat-file --batch` process, in the order asked: each answer is the blob's text, or null where git reports the spec missing or the batch can't run. The framing is `<oid> <type> <size>` then exactly size bytes and a newline, so content is cut by byte count and never by searching for the next header.
 * @param {string} repoDir @param {string[]} specs @returns {(string|null)[]}
 */
function catBlobs(repoDir, specs) {
  if (!specs.length) return [];
  let buf;
  try {
    buf = execFileSync('git', ['-C', repoDir, 'cat-file', '--batch'],
      { input: `${specs.join('\n')}\n`, maxBuffer: 256 * 1024 * 1024, stdio: ['pipe', 'pipe', 'ignore'] });
  } catch {
    return specs.map(() => null);
  }
  /** @type {(string|null)[]} */
  const out = [];
  let at = 0;
  for (let i = 0; i < specs.length; i++) {
    const nl = buf.indexOf(0x0a, at);
    if (nl < 0) { out.push(null); continue; }
    const header = buf.subarray(at, nl).toString('utf8');
    at = nl + 1;
    const m = /^[0-9a-f]+ [a-z]+ (\d+)$/.exec(header);
    if (!m) { out.push(null); continue; } // `<spec> missing` carries no body
    const size = Number(m[1]);
    out.push(buf.subarray(at, at + size).toString('utf8'));
    at += size + 1;
  }
  return out;
}

/**
 * The reverse commit-to-phase map, recovered from git history alone: one pass for the closes (findPruneCommits), then every deleted phase summary read back in one `git cat-file --batch` (catBlobs), because a `git show` per summary was most of a /cad-why run.
 *
 * @param {string} repoDir
 * @returns {{dirs: PhaseDir[], rows: IndexRow[], warnings: string[], prunes: PruneCommit[]}}
 */
export function buildRecoveredIndex(repoDir) {
  const { prunes, warnings } = findPruneCommits(repoDir);
  /** @type {PhaseDir[]} */
  const dirs = [];
  /** @type {IndexRow[]} */
  const rows = [];
  const wanted = [];
  for (const prune of prunes) {
    if (!prune.parent) continue; // already named in `warnings` by the refusal
    for (const { phase, path } of prune.phases) wanted.push({ prune, phase, path });
  }
  const texts = catBlobs(repoDir, wanted.map(({ prune, path }) => `${prune.parent}:${path}`));
  wanted.forEach(({ prune, phase, path }, i) => {
    const text = texts[i];
    if (text === null) {
      warnings.push(`${path} could not be recovered from ${prune.parent.slice(0, 8)}; its commits are not indexed`);
      return;
    }
    const dir = recoveredDir(prune, phase, path);
    dirs.push(dir);
    for (const row of parseCommitRows(text)) rows.push({ ...row, dir });
  });
  markPresence(repoDir, rows);
  // prunes rides the index because the named gap reads the same closes, and searching twice would cost a second pass
  return { dirs, rows, warnings, prunes };
}

/**
 * The one index a caller asks, over ordered tiers: the on-disk phase record, then the off-roadmap task record, then the git-recovered record.
 * The phase spine is the authority when a commit is named by both: resolveCommit takes the first tier that answers at all, and the roadmap is where that work was planned, reviewed and verified.
 * The tasks tier goes ahead of the recovered one on the same argument: a task record and a phase directory can both be opened, while the recovered tier reconstructs a directory that no longer exists.
 * `prunes` comes from the recovered argument alone; it's the close history the named-gap block reads, and neither on-disk tier produces one.
 *
 * @param {{dirs: PhaseDir[], rows: IndexRow[], warnings: string[]}} disk
 * @param {{dirs: TaskDir[], rows: IndexRow[], warnings: string[]}} tasks
 * @param {any} recovered
 * @returns {any}
 */
export function mergeCommitIndexes(disk, tasks, recovered) {
  return {
    dirs: [...disk.dirs, ...tasks.dirs, ...recovered.dirs],
    rows: [...disk.rows, ...tasks.rows, ...recovered.rows],
    tiers: [disk, tasks, recovered],
    prunes: /** @type {any} */ (recovered).prunes || [],
    warnings: [...disk.warnings, ...tasks.warnings, ...recovered.warnings],
  };
}

// The named gap. When no tier resolves a commit the answer is a stated gap plus everything the record does carry, never a guessed phase number. Three contributions, each honest about what it is:
//   - what git carries for that commit: the paths it touched, fetched for the whole unresolved set in one `git show --name-only`
//   - which close the gap sits under, from the prune commits already found: the earliest close at or after the commit's date. It says when, never which phase, and it's absent when the commit is newer than every close
//   - ARCHIVE.md's residue for that milestone and nothing else: ARCHIVE.md carries no commit-to-phase edge (its rows are an origin path plus free text, almost none hold a hex token and those are incidental prose, and the `## Commits` table is never archived), so its rows are printed as the milestone's residue, joined to a label and never to a commit
// Rows come through parseArchiveRows, which already carries the label/origin split and the phase-number round-trip guard. Label and origin ride alongside the composed `source` because a label containing a `/` makes the composed field ambiguous, so nothing here re-splits `source`.

/**
 * The paths each of `shas` touched, in one `git show`. A merge reports none under git's default, which is an absent list rather than a failure.
 * @param {string} repoDir @param {string[]} shas @returns {Map<string, string[]>}
 */
export function touchedPaths(repoDir, shas) {
  /** @type {Map<string, string[]>} */
  const out = new Map();
  const ids = [...new Set(shas)].filter((s) => COMMIT_ID.test(String(s || '')));
  if (!ids.length) return out;
  const res = git(repoDir, ['show', '--name-only', '-M', '--format=%x01%H', ...ids]);
  let current = null;
  for (const line of res.stdout.split('\n')) {
    if (line.startsWith('\x01')) {
      current = line.slice(1).trim();
      if (!out.has(current)) out.set(current, []);
      continue;
    }
    const path = line.trim();
    if (current && path) out.get(current).push(path);
  }
  for (const list of out.values()) list.sort();
  return out;
}

/**
 * Which close a commit's date falls under, or null when no close is later than it, the ordinary state of a commit in the open milestone.
 * Instants are parsed on both sides, never the `%cI` strings: ISO-8601 values under different UTC offsets don't string-sort chronologically (`2026-05-01T20:00:00+09:00` sorts after `2026-05-01T07:00:00-05:00` and happens an hour before it), so a string compare attaches a commit to a close that happened before it.
 * The selection is order-independent: it scans for the smallest instant at or after the commit's instead of trusting `prunes` to arrive newest-first, which is findPruneCommits's ordering and not a contract this should silently depend on. Two closes at one instant tie-break on the full sha.
 * An unparseable date is a stated absence, never a throw: a commit date that won't parse answers null, and a prune whose own date won't parse is skipped. This runs inside the gap pass over a chain git already answered, so a throw would lose a resolved query.
 * @param {PruneCommit[]} prunes @param {string} date an ISO commit date
 * @returns {{commit: string, label: string|null, date: string}|null}
 */
export function closeOver(prunes, date) {
  const when = Date.parse(String(date || ''));
  if (!Number.isFinite(when)) return null;
  let found = null;
  let foundAt = Infinity;
  for (const p of prunes || []) {
    const at = Date.parse(String((p && p.date) || ''));
    if (!Number.isFinite(at) || at < when) continue;
    if (at < foundAt || (at === foundAt && found && String(p.commit) < String(found.commit))) {
      found = p;
      foundAt = at;
    }
  }
  return found ? { commit: found.commit, label: found.label, date: found.date } : null;
}

/**
 * ARCHIVE.md's rows grouped by milestone label, in the file's own order. Absent is an empty map and is silent, since most repositories have none.
 * @param {string} planningRoot
 * @returns {Map<string, Array<{origin: string, text: string}>>}
 */
export function archiveSections(planningRoot) {
  /** @type {Map<string, Array<{origin: string, text: string}>>} */
  const out = new Map();
  const { text } = readArtifact(join(planningRoot, 'ARCHIVE.md'));
  if (text === null) return out;
  for (const row of parseArchiveRows(text)) {
    if (!out.has(row.label)) out.set(row.label, []);
    out.get(row.label).push({ origin: row.origin, text: row.text });
  }
  return out;
}
