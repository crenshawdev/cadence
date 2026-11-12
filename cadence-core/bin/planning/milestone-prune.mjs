// @ts-check
// planning/milestone-prune.mjs - `milestone-prune`: the mechanical half of a milestone close, in one call
// the phases it prunes are the ones the state holds complete; the state drops them and the list in ROADMAP.md is rendered from it
'use strict';

import { existsSync, lstatSync, readFileSync } from 'node:fs';
import { dirname, join, resolve as resolvePath, sep } from 'node:path';
import { fail, notRealDirDetail, ok, read } from './core.mjs';
import {
  archivePath, atomicWrite, ensureRecordsDir, makeDir, movePath, removeTree, withPlanningFileLock,
} from '../lib/planning-store.mjs';
import { runTransition } from '../lib/file-transition.mjs';
import { archiveRequirements, completedPhases, pruneRoadmap } from '../lib/milestone-prune.mjs';
import {
  appendArchiveRows, parseArchiveRows, phaseRecallSnippets,
} from '../lib/planning-files.mjs';
import { emit } from '../lib/seam-io.mjs';
import { changeState, loadState, withPhases } from './state-import.mjs';
import { resolveTextFlag } from '../lib/text-flag-file.mjs';

// three hand-surgeries once left a tree failing its own audit; the text transforms live in lib/milestone-prune.mjs
// the judgment halves of the close (PROJECT.md evolution, deferred carry, seeding the next milestone) stay prose
function cmdMilestonePrune(dir, opts) {
  // --label-file is a transport only: the label is repository content, so both checks below run on the resolved value
  const resolvedLabel = resolveTextFlag(opts, 'label', 'milestone-prune');
  if (!resolvedLabel.ok) {
    return fail('bad-args', resolvedLabel.detail,
      'pass --label or --label-file, never both, and point --label-file at a readable, non-empty'
      + ' file - nothing was pruned');
  }
  const raw = resolvedLabel.value !== undefined ? resolvedLabel.value : opts.label;
  const label = typeof raw === 'string' ? raw.trim() : '';
  if (!label) {
    return fail('bad-args', 'milestone-prune needs --label <version or milestone name>',
      "name the milestone this close is archiving under - the released version, or PROJECT.md's"
      + ' milestone name for an untagged close; nothing was pruned');
  }
  // two independent terms, before any read, mkdir or rename, in both modes: `--mode delete` still writes the label
  // not publish-decision.mjs's REMOTE_NAME shape: it admits no spaces and would refuse this milestone's own label
  // the table term: archiveRequirements puts the label in a markdown table cell, where either character breaks the row
  if (/[|\r\n]/.test(label)) {
    return fail('bad-args',
      'milestone-prune --label cannot contain "|" or a newline - it is written into a REQUIREMENTS.md table cell',
      'take those characters out of the label and re-run - nothing was pruned, and either one would'
      + ' silently rewrite the shipped requirement rows it is written into');
  }
  // the containment term: `--label '../../../outside-tree'` once moved a phase out of the planning root, ok:true
  // resolve and not fsIdentity: the archive root doesn't exist yet. Lexical alone isn't enough, hence the type term
  const archiveRoot = join(dir, `_archive-${label}`);
  if (!resolvePath(archiveRoot).startsWith(resolvePath(dir) + sep)) {
    return fail('bad-args',
      `milestone-prune --label must stay inside the planning root: "_archive-${label}" resolves outside ${dir}`,
      'use a plain milestone name with no path separators or `..` segments - the label names an'
      + ' archive directory inside the planning root; nothing was pruned');
  }
  const mode = opts.mode;
  if (mode !== 'delete' && mode !== 'archive') {
    return fail('bad-args', 'milestone-prune needs --mode <delete|archive> (tagged release: delete - the tag is the archive; untagged: archive)',
      'pick the mode from the evidence: --mode delete when this milestone was tagged, since the tag'
      + ' keeps the history, and --mode archive when it was not; nothing was pruned');
  }
  // the type term: resolve is string arithmetic, so an archive dir that is a symlink out of the tree resolves inside it
  // lstatSync classifies the link itself, so a symlink fails isDirectory wherever it points; absent is fine
  if (mode === 'archive') {
    // absent is data here and not an exception, so throwIfNoEntry: false and no try/catch
    const rootStat = lstatSync(archiveRoot, { throwIfNoEntry: false });
    if (rootStat && !rootStat.isDirectory()) {
      return fail('archive-root-unusable',
        notRealDirDetail(archiveRoot, rootStat, 'renameSync'),
        'clear that path first - nothing was pruned and no phase directory moved, so the tree is'
        + ' exactly as it was');
    }
  }
  const roadmapFile = join(dir, 'ROADMAP.md');
  let roadmapText;
  try { roadmapText = readFileSync(roadmapFile, 'utf8'); } catch {
    return fail('no-roadmap', `${roadmapFile} is missing or unreadable`,
      'make ROADMAP.md readable at that path and re-run - the checked phase boxes there are what'
      + ' says which phases this close may prune, and nothing was pruned');
  }
  const state = loadState(dir);
  if (!state) return;
  const completed = completedPhases(state);
  if (!completed.length) {
    return ok({ action: 'skip', reason: 'no completed (checked) phases to prune' });
  }
  const warnings = [];

  // REQUIREMENTS.md is optional: without it the close gets the roadmap and dirs half plus a warning, never a refusal
  // read here so a failure comes before anything moves, transformed below over the set the directory pass cleared
  const reqFile = join(dir, 'REQUIREMENTS.md');
  const reqText = read(reqFile);
  if (reqText === null) {
    warnings.push(`${reqFile} is missing or unreadable; requirements were not archived`);
  }

  // recall residue is written before the loop: the phase directories leave the live tree there
  // the rows come from the helper cmdRecall reads, in fixed order, never a model-authored summary
  // writing ahead costs idempotence: a phase whose removal fails is read twice, so filter by this label's heading
  // one containment test keyed on the label, outside appendArchiveRows, a pure appender that can't judge a phase
  const archiveFile = archivePath(dir);
  const residue = [];
  // read, containment test and write are one critical section under the lock /cad-capture takes on CAPTURE.md
  // unserialized, two closes clobber each other's rows and the directories are gone: this loses the only copy
  // the lock file is a sibling of the ledger, so the records folder has to be there, and real, before the lock is taken
  const records = ensureRecordsDir(dir);
  if (!records.ok) {
    return fail('records-unusable', `${dirname(archiveFile)} cannot be used (${records.reason})`,
      'make that path a real directory - a symlink there is refused because it would carry the ledgers out of the'
      + ' tree - and re-run the close; nothing was pruned and no phase directory moved');
  }
  const archiveGuard = withPlanningFileLock(archiveFile, () => {
  const archiveText = read(archiveFile) ?? '';
  // two properties this test must hold, or a suppressed write plus the directory removal loses data for good
  // the label matches exactly, never as a prefix: `v1/` would also match a heading named `v1/anything`
  // keyed on the artifact, not the phase: a retry after a missing UAT.md would skip the whole phase and drop that row
  const alreadyArchived = new Set(parseArchiveRows(archiveText)
    .filter((r) => r.label === label)
    .map((r) => r.origin));
  for (const n of [...completed].sort((a, b) => a - b)) {
    const pdir = join(dir, 'phases', String(n));
    const originOf = (/** @type {string} */ file) => `phases/${n}/${file}`;
    const rows = phaseRecallSnippets((f) => (alreadyArchived.has(originOf(f)) ? null : read(join(pdir, f))));
    for (const { file, text } of rows) residue.push({ origin: originOf(file), text });
  }
  // no readable artifacts under the completed phases means no ARCHIVE.md at all, like the two document writes below
  if (residue.length) atomicWrite(archiveFile, appendArchiveRows(archiveText, label, residue));
  }, 'archive-locked');
  // a refused lock stops the close before any directory moves: proceeding would remove residue this run couldn't write
  if (archiveGuard.ok === false) {
    return fail(archiveGuard.reason, archiveGuard.detail,
      'nothing was pruned and no phase directory moved - let the run holding the lock finish, or'
      + ' clear a stale one the detail names, then re-run the close');
  }

  // directories first, so the documents describe only what this pass actually accomplished
  // the old order wrote documents regardless: the rename throw is caught here as a warning, hiding a half-done close
  // only the set whose directory is gone reaches the transforms; `missing` counts as gone, `failed` doesn't
  const dirs = { archived: [], deleted: [], missing: [] };
  // one step per completed phase, keyed by phase number; it continues past a failure, so cleared phases still prune
  /** @type {Array<[number, () => void]>} */
  const steps = completed.map((n) => [n, () => {
    const src = join(dir, 'phases', String(n));
    if (!existsSync(src)) { dirs.missing.push(n); return; }
    if (mode === 'delete') { removeTree(src); dirs.deleted.push(n); return; }
    makeDir(archiveRoot);
    const dest = join(archiveRoot, String(n));
    // refuse an existing destination, don't let renameSync decide: it follows a symlink; a half-run close is evidence
    if (lstatSync(dest, { throwIfNoEntry: false })) {
      throw new Error(`${dest} already exists - a previous close left it there`);
    }
    movePath(src, dest);
    dirs.archived.push(n);
  }]);
  const pass = runTransition({ steps, discipline: 'continue-past-failure' });
  const failed = pass.failures.map((f) => f.key);
  // appended here, not inside the thunks, so the warning order is unchanged
  for (const { key: n, error: e } of pass.failures) {
    warnings.push(`phase ${n}: directory ${mode} failed: ${e && e.message ? e.message : e}`);
  }

  // the pruned set is the completed phases whose directory is gone; a failed phase keeps its roadmap line and rows
  const applied = completed.filter((n) => !failed.includes(n));

  const pruned = pruneRoadmap(roadmapText, applied);
  for (const n of pruned.missingSections) {
    warnings.push(`phase ${n}: no "### Phase ${n}:" detail section found to remove`);
  }
  const reqResult = reqText === null ? null : archiveRequirements(reqText, applied, label);

  // nothing cleared, nothing to say: skip the writes and don't rename an identical file into place
  // the detail sections go as text edits; the pruned phases leave the state and the list is rendered from it
  if (applied.length) {
    atomicWrite(roadmapFile, pruned.text);
    if (reqResult && reqResult.moved.length) atomicWrite(reqFile, reqResult.text);
    const gone = new Set(applied);
    const landed = changeState(dir, (s) => withPhases(s, s.phases.filter((p) => !gone.has(p.n))), ['STATE.md', 'ROADMAP.md'], {
      onFail: (res) => emit({
        ok: false, reason: 'state-write-failed', detail: `${res.reason} - ${res.detail}`,
        hint: 'the phase directories and the detail sections are already pruned but the state still lists the phases; '
          + 'fix the cause the detail names and re-run milestone-prune, which finishes the state and the list',
      }),
    });
    if (!landed) return;
  }

  const envelope = {
    label,
    mode,
    phases: applied,
    roadmap: { removed_lines: pruned.removedLines, removed_sections: pruned.removedSections },
    requirements: reqResult
      ? { moved: reqResult.moved, created_shipped: reqResult.createdSection }
      : { moved: [], created_shipped: false },
    dirs,
    // always present, 0 included: a close that wrote nothing has to be legible as one, not as a field nobody checked
    residue_rows: residue.length,
    ...(warnings.length ? { warnings } : {}),
  };

  // a partial application is a refusal, not a success with a warning: the caller can tell "done" from "half done"
  if (failed.length) {
    return emit({ ok: false, reason: 'partial-prune', action: 'partial', failed, ...envelope,
      hint: `phases ${failed.join(', ')} still have directories under ${join(dir, 'phases')};`
        + ' they were left in ROADMAP.md and REQUIREMENTS.md. Fix what blocked them and re-run -'
        + ' the phases that did clear are already pruned, so a re-run only picks up the rest.' });
  }
  return ok({ action: 'pruned', ...envelope });
}

export { cmdMilestonePrune };
