// @ts-check
// disk half of /cad-why's join: guarded I/O that fails open with warnings. why-record.mjs is the pure half.
// the index covers live `phases/<N>/` and archived trees; delete-mode closes leave neither, so git history fills in
// phaseDirsIn and taskRecordsIn are the only walks: a second enumerator is the split-brain that lost five filed bullets
// the phase comes from a resolved directory name, never the commit scope: `feat(1-1)` exists in seven cycles
// warnings carry a label and an errno code, never raw error text, which is third-party bytes
'use strict';

import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { dirname, join, sep } from 'node:path';
import { within } from './contained.mjs';

import { recordName } from './adjudication-record.mjs';
import { phaseDirsIn } from './phase-plans.mjs';
import { parseArchiveRows } from './planning-files.mjs';
import { archivePath } from './planning-store.mjs';
import { RECORD_FILE, TASKS_DIR, taskRecordsIn } from './task-record.mjs';
import { parseAdjudication, parseCommitRows, shaMatches } from './why-record.mjs';

/**
 * Read one artifact under the planning root, refusing anything that isn't a regular file before opening it.
 * Three outcomes: `absent` (ordinary, no warning), `text`, and a `code` saying why a present path couldn't be read.
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
  // statSync follows symlinks, so a symlink to a FIFO fails this check, which is what stops readFileSync blocking
  if (!st.isFile()) return { text: null, absent: false, code: 'ENOTREGULAR' };
  // containment is per file too: a SUMMARY.md symlinked to `~/.ssh/id_rsa` passes isFile() and would leak its bytes,
  // so the resolved path must stay inside the resolved directory; a symlink out is refused before it's opened
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
 * `phases` is the open milestone, named as such; an archived group reports its bare version, like v3.4.0.
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
 * `rows` keep a fixed order, directory label then the table's own: a reshuffled match list is a reshuffled answer.
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
 * A task directory's descriptor: describe()'s five keys plus a `slug` marker, which tells it from a phase directory.
 * `phase` and `milestone` are null because /cad-task is off-roadmap, and a placeholder would get printed as a number.
 * @typedef {{
 *   label: string, path: string, group: string, phase: null, milestone: null,
 *   slug: string,
 * }} TaskDir
 */

/**
 * The commit-to-task index, same `{dirs, rows, warnings}` shape as buildCommitIndex, so resolveCommit needs no change.
 * Not phaseDirsIn: it only admits a directory with a conforming PLAN file, and /cad-task's inline arm writes none.
 * Widening it would make describe() render `tasks phase <slug>`, a wrong join instead of a missing one.
 * Records come from taskRecordsIn, which the writer and the recall walk share; never walk `tasks/` a second time here.
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
    // absent only through a race with the walk, which isn't a corpus defect, so it's silent
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
 * `matches` is every row whose commit cell prefix-matches, in index order. Rows agreeing on directory, plan and task
 * are one answer; rows that disagree are ambiguous and all are named.
 *
 * @param {{rows: IndexRow[]}} index @param {string} sha
 * @returns {{state: 'resolved'|'ambiguous'|'unresolved', row: IndexRow|null, matches: IndexRow[]}}
 */
export function resolveCommit(index, sha) {
  // a merged index is asked tier by tier, first answer wins; a single-tier index is its own tier, so one code path
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
 * One named artifact out of a phase directory, wherever it lives.
 * A disk directory opens the file; a recovered one (path null) reads the prune commit's parent tree.
 * Absent is silent on both. git can't tell absent from unreadable (stderr never reaches stdout), so it reads as absent.
 * The git argument opens with a hex sha so git can't read it as an option; `<tree>` came from a pathspec-limited log.
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
 * A resolved phase directory's context file, its summary, and the one plan file the commits table's Plan cell names.
 * The plan file is found by name, `PLAN-<key>.md` or bare `PLAN.md` for the first plan, not by a second copy of the
 * plan-file grammar, which would drift. An empty Plan cell (the three-column era) means `PLAN.md` and nothing else.
 * A task directory's RECORD.md is tried first: it carries the `- **Files:**` line the `declared by:` edge needs.
 * Its PLAN.md would say what was planned, not what was done. Absent is silent here too, as in buildCommitIndex.
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
  // the slug marker, never a label prefix; the planned /cad-task arm writes a PLAN.md too, so RECORD goes first
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

// the review edge's disk and git half.
// filenames come from recordName, never re-spelled: probing it with sentinel parts yields the fixed affixes,
// and if it stops producing them the probe stops matching and the tests redden, on purpose
// range membership is one `git rev-list` per distinct range; an id this clone lacks is unresolvable, not "not in range"
// git runs from an argv array, never a shell string, and ids from a JSON file we didn't write are hex-checked first:
// a `base_id` like `--upload-pack=...` would otherwise be read as an option

/** A probe of the one filename rule, used to derive its fixed affixes. */
const NAME_PROBE = recordName('TRIGGER', 'DISCRIMINATOR', 1);
/** Everything `recordName` puts before the trigger. */
const ADJ_PREFIX = NAME_PROBE.slice(0, NAME_PROBE.indexOf('TRIGGER'));
/** Everything it puts after the discriminator. */
const ADJ_SUFFIX = NAME_PROBE.slice(NAME_PROBE.indexOf('DISCRIMINATOR') + 'DISCRIMINATOR'.length);

/** A commit id as git may safely be handed one: hexadecimal, nothing else. */
const COMMIT_ID = /^[0-9a-fA-F]{4,40}$/;

/**
 * The adjudication records in one phase directory, sorted by filename, each parsed through parseAdjudication.
 * None is `[]` and silent. A record that won't parse warns with its file and issue code, and yields no findings.
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
    // the name came from a listing; an empty read means the reader already warned, and that's the whole answer
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
 * The adjudication record names in one phase directory, sorted, from whichever source holds it. The recovered
 * side lists the tree, since the `ADJUDICATION-<trigger>-<discriminator>[-rN].json` discriminator can't be guessed.
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
 * The commits in `base..head`, or null when either id doesn't resolve here: an unresolvable join, not an empty one.
 * @param {string} repoDir @param {string} base @param {string} head
 * @returns {Set<string>|null}
 */
export function rangeMembers(repoDir, base, head) {
  if (!COMMIT_ID.test(String(base || '')) || !COMMIT_ID.test(String(head || ''))) return null;
  const r = git(repoDir, ['rev-list', `${base}..${head}`]);
  return r.ok ? new Set(r.stdout.split('\n').map((l) => l.trim()).filter(Boolean)) : null;
}

// git-history tier: a delete-mode close leaves no directory, so those closes live only in git history
// `--full-history` is load-bearing: without it git's simplification silently drops most closes
// `-M` is pinned rather than inherited from the reading machine's diff.renames
// the label is the `## <label>` heading the close added to ARCHIVE.md, not the subject; exactly one binds, else absent
// a merge-shaped prune is reported, not resolved: `<prune>^` would pick a parent arbitrarily
// PRUNE_ARGV can't produce one today; parsePruneRecords is exported to prove the guard

/** The pathspec a milestone close deletes when it prunes a phase directory. */
const PRUNED_SUMMARY = '.planning/phases/*/SUMMARY.md';

/** `\x01` separates records, so path lines can be told from the next header: no path or date contains it. */
const PRUNE_FORMAT = '%x01%H%x1f%cI%x1f%P';

/** The prune search, exported so its control can be built from it. */
export const PRUNE_ARGV = Object.freeze([
  'log', '--full-history', '-M', '--diff-filter=D', '--name-only',
  `--format=${PRUNE_FORMAT}`, '--', PRUNED_SUMMARY,
]);

/**
 * Where a close added its heading, newest layout first. A close committed before the ledgers moved under the records
 * folder added it to `.planning/ARCHIVE.md`, so history is asked about both.
 */
const ARCHIVE_PATHSPECS = Object.freeze([archivePath('.planning').split(sep).join('/'), '.planning/ARCHIVE.md']);

/** The heading a close appends to ARCHIVE.md, as a diff line. */
const ADDED_SECTION = /^\+## (.+?)\s*$/;

/** `.planning/phases/<N>/SUMMARY.md` with the phase number captured, read off the deleted path and never guessed. */
const PRUNED_PATH = /^\.planning\/phases\/([^/]+)\/SUMMARY\.md$/;

/**
 * Run git in `repoDir` without throwing: a failure is `{ok: false}`, read as "this tier contributes nothing".
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
 * The milestone label each of `commits` bound, from the `## <label>` heading it added to ARCHIVE.md, in one git call.
 * @param {string} repoDir @param {string[]} commits
 * @returns {Map<string, string|null>}
 */
function pruneLabels(repoDir, commits) {
  /** @type {Map<string, string[]>} */
  const added = new Map();
  for (const c of commits) added.set(c, []);
  if (!commits.length) return new Map();

  const out = git(repoDir, ['show', '-U0', '-M', '--format=%x01%H', ...commits, '--', ...ARCHIVE_PATHSPECS]);
  let current = null;
  for (const line of out.stdout.split('\n')) {
    if (line.startsWith('\x01')) { current = line.slice(1).trim(); continue; }
    if (current === null || !added.has(current)) continue;
    const m = line.match(ADDED_SECTION);
    if (m) added.get(current).push(m[1]);
  }
  /** @type {Map<string, string|null>} */
  const labels = new Map();
  // exactly one heading binds: zero is an old close, and two or more don't say which owns the deleted phases
  for (const [commit, headings] of added) labels.set(commit, headings.length === 1 ? headings[0] : null);
  return labels;
}

/**
 * Every commit that deleted a phase SUMMARY, newest first, with its milestone label and the phase paths it removed.
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
 * Pure and exported so the merge refusal can be proven: feed it the log run with `--diff-merges=first-parent`.
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

// keyed on the commit the record names, not the directory name, so a renumbered phase resolves unchanged
// matching is shaMatches alone, a prefix test, so 7 and 8 character abbreviations both work
// a sha this clone lacks is a stated absence, not a dropped row; the probe takes shas on stdin, never argv
// the disk tier wins: an archive close leaves every archived phase recoverable from its parent too, so merging flat
// would make the same rows ambiguous under two labels. Ambiguity within a tier is still an answer

/**
 * One recovered phase directory: describe's shape with `path` null and a `recovered` anchor naming its tree.
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
    // the close's bound label, or a stated absence; never the subject line or a version guessed from the date
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
 * Many `<rev>:<path>` blobs through one `git cat-file --batch`, in order asked: each is the blob's text, or null if
 * missing or the batch fails. Content is cut by the size in the header, never by searching for the next header.
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
 * The reverse commit-to-phase map from git history alone: the closes in one pass (findPruneCommits), then every deleted
 * summary in one batch (catBlobs), because a `git show` per summary was most of a /cad-why run.
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
  // prunes rides the index so the named gap doesn't search the same closes twice
  return { dirs, rows, warnings, prunes };
}

/**
 * The one index a caller asks, over ordered tiers: on-disk phases, then task records, then git-recovered.
 * The phase spine wins when both name a commit: that's where the work was planned, reviewed and verified.
 * Tasks beat recovered because both can be opened, while recovered reconstructs a directory that no longer exists.
 * `prunes` comes from the recovered argument alone, since neither on-disk tier produces close history.
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

// the named gap: when no tier resolves a commit, say so and add what the record does carry, never a guessed phase
//   - the paths git says the commit touched, fetched for the whole unresolved set in one `git show --name-only`
//   - the earliest close at or after the commit's date: when, never which phase; absent if every close is older
//   - that milestone's ARCHIVE.md rows, joined to a label and never a commit, since ARCHIVE.md has no commit edge
// label and origin ride beside the composed `source`, since a `/` in a label makes it ambiguous to re-split

/**
 * The paths each of `shas` touched, in one `git show`. A merge reports none by default: an absent list, not a failure.
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
 * Which close a commit's date falls under, or null when none is later (the ordinary state in the open milestone).
 * Instants are parsed, never the `%cI` strings: ISO-8601 under mixed UTC offsets doesn't string-sort chronologically.
 * Order-independent: the smallest instant at or after the commit's, rather than trust `prunes` to be newest-first.
 * Two closes at one instant tie-break on the full sha.
 * An unparseable date answers null, and a prune with a bad date is skipped: a throw would lose a resolved query.
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
 * ARCHIVE.md's rows grouped by milestone label, in file order. Absent is an empty map and silent; most repos have none.
 * @param {string} planningRoot
 * @returns {Map<string, Array<{origin: string, text: string}>>}
 */
export function archiveSections(planningRoot) {
  /** @type {Map<string, Array<{origin: string, text: string}>>} */
  const out = new Map();
  const { text } = readArtifact(archivePath(planningRoot));
  if (text === null) return out;
  for (const row of parseArchiveRows(text)) {
    if (!out.has(row.label)) out.set(row.label, []);
    out.get(row.label).push({ origin: row.origin, text: row.text });
  }
  return out;
}
