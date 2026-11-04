// @ts-check
// planning/milestone-prune.mjs - `milestone-prune`: the mechanical half of a milestone close, in one call
'use strict';

import { existsSync, lstatSync, mkdirSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { join, resolve as resolvePath, sep } from 'node:path';
import { fail, ok, read } from './core.mjs';
import { withPlanningFileLock } from '../lib/capture-file.mjs';
import { runTransition } from '../lib/file-transition.mjs';
import { archiveRequirements, completedPhases, pruneRoadmap } from '../lib/milestone-prune.mjs';
import {
  appendArchiveRows, atomicWrite, parseArchiveRows, parseContextDecisions,
  parseSummarySnippets, parseUat,
} from '../lib/planning-files.mjs';
import { emit } from '../lib/seam-io.mjs';
import { resolveTextFlag } from '../lib/text-flag-file.mjs';

// the prune steps of /cad-milestone were three orchestrator hand-surgeries that once left a tree failing its own audit; the text transforms live in lib/milestone-prune.mjs and this wrapper owns the I/O
// the judgment halves of the close (PROJECT.md evolution, carrying deferred requirements forward, seeding the next milestone) stay prose, since this seam touches only what's mechanical
function cmdMilestonePrune(dir, opts) {
  // --label-file is the path transport, and the label is caller-derived by construction: an untagged close takes it from PROJECT.md's milestone name, which is repository content going into a double-quoted shell word. The transport changes only how the label arrives, so both terms below still run on the resolved value, in the same order, before any read, mkdir or rename and in both modes
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
  // two independent terms, both where the label is read, before any read, mkdir or rename and in both modes: `--mode delete` builds no archive root but still writes the label into every shipped requirement row
  // not publish-decision.mjs's REMOTE_NAME shape: that regex admits no spaces, and an untagged label is the milestone name from PROJECT.md, so it would refuse this milestone's own label and block the close
  // the table term: archiveRequirements puts the label in a markdown table cell, where either character silently rewrites the row
  if (/[|\r\n]/.test(label)) {
    return fail('bad-args',
      'milestone-prune --label cannot contain "|" or a newline - it is written into a REQUIREMENTS.md table cell',
      'take those characters out of the label and re-run - nothing was pruned, and either one would'
      + ' silently rewrite the shipped requirement rows it is written into');
  }
  // the containment term: the archive directory is handed to mkdirSync and renameSync below, so `--label '../../../outside-tree'` moved the first phase clean out of the planning root and still answered ok:true. It uses resolve and not the fsIdentity compare the rest of the tree uses, since the archive root doesn't exist yet at validation time and this has to run before any mkdir. Lexical alone isn't enough, which is what the type term below closes
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
  // the type term, and why the lexical test can't stand alone: resolve is pure string arithmetic, so a pre-existing archive directory that is itself a symlink out of the tree resolves lexically inside it, mkdirSync recursive succeeds silently, and renameSync follows the link and deposits the phase directories wherever it aimed. lstatSync classifies the link and not its target, so a symlink fails isDirectory whatever it points at, which is also right for a regular file squatting the name
  // absent is the ordinary case and not an error, the loop below creates it; archive mode only, since delete builds no archive root
  if (mode === 'archive') {
    // absent is data here and not an exception, so throwIfNoEntry: false and no try/catch
    const rootStat = lstatSync(archiveRoot, { throwIfNoEntry: false });
    if (rootStat && !rootStat.isDirectory()) {
      return fail('archive-root-unusable',
        `${archiveRoot} exists and is not a real directory`
        + `${rootStat.isSymbolicLink() ? ' (it is a symlink, which renameSync would follow out of the planning root)' : ''}`
        + ' - move or remove it, then re-run',
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
  const completed = completedPhases(roadmapText);
  if (!completed.length) {
    return ok({ action: 'skip', reason: 'no completed (checked) phases to prune' });
  }
  const warnings = [];

  // REQUIREMENTS.md is optional at this seam: a project without it gets the roadmap and dirs half plus a warning, never a refusal, because the close must not stall on a doc the project never kept. It's read here and transformed below: the read has to fail before anything moves, but the transform has to run over the set the directory pass actually cleared
  const reqFile = join(dir, 'REQUIREMENTS.md');
  const reqText = read(reqFile);
  if (reqText === null) {
    warnings.push(`${reqFile} is missing or unreadable; requirements were not archived`);
  }

  // the recall residue is written here because below this point the completed phases' directories leave the live tree, and with them every SUMMARY deviation, UAT item and CONTEXT decision `recall` indexes; writing for the post-loop applied set would put the write after the removal, where an interrupt deletes the directories, writes nothing, and leaves no live artifact to recover it from
  // the rows are the same snippets the live walk indexes, from the same three parsers cmdRecall runs, in the same fixed order (phases ascending, then SUMMARY, UAT, CONTEXT within a phase), never a model-authored distillation: a prose-authored write puts the residue in the coordinator's hands, where an interrupted close writes nothing and nothing says so
  // writing ahead of the loop costs free idempotence, since a phase whose removal then fails is still live on a re-run and would be read twice. So the candidates are filtered by what this milestone's heading already contains: one containment test keyed on the label, read back through the grammar's own parser, and not inside appendArchiveRows, because "already present" is a phase-level judgment a pure text appender can't make and folding it in there would refuse a second artifact from a phase the same call already landed one for
  const archiveFile = join(dir, 'ARCHIVE.md');
  const residue = [];
  // the read, the containment test and the write are one critical section, under the same sibling lock /cad-capture takes on CAPTURE.md: unserialized, two closes with different labels read the same text, each writes only its own rows, the later atomicWrite wins, and this seam removes the phase directories right after, so the clobbered rows have no live source left. That's why ARCHIVE.md takes a lock the ROADMAP and REQUIREMENTS writes below don't: those lose an edit git still holds, this loses the only copy
  const archiveGuard = withPlanningFileLock(archiveFile, () => {
  const archiveText = read(archiveFile) ?? '';
  // two properties this test must hold, both data-loss bugs otherwise, since a suppressed write is followed by the directory removal that makes the omission permanent
  // the label matches exactly and never as a prefix of the composed source: a label is free text, and `source.startsWith(label + '/')` answers true for a row under a heading named `v1/anything` when the label is `v1`, so a section this close doesn't own could mark its phases done
  // the key is the artifact and not the phase: one row for a phase doesn't prove its other two were written, and a close whose UAT.md was absent on the first pass lands SUMMARY and CONTEXT only, so keyed on the phase a retry would skip it whole and then remove the directory, dropping the row it re-ran to land
  const alreadyArchived = new Set(parseArchiveRows(archiveText)
    .filter((r) => r.label === label)
    .map((r) => r.origin));
  for (const n of [...completed].sort((a, b) => a - b)) {
    const pdir = join(dir, 'phases', String(n));
    const summaryOrigin = `phases/${n}/SUMMARY.md`;
    const summary = alreadyArchived.has(summaryOrigin) ? null : read(join(pdir, 'SUMMARY.md'));
    if (summary) for (const text of parseSummarySnippets(summary)) {
      residue.push({ origin: summaryOrigin, text });
    }
    const uatOrigin = `phases/${n}/UAT.md`;
    const uatText = alreadyArchived.has(uatOrigin) ? null : read(join(pdir, 'UAT.md'));
    if (uatText) for (const it of parseUat(uatText).items) {
      const text = `${it.name || ''} ${it.expected || ''}`.trim();
      if (text) residue.push({ origin: uatOrigin, text });
    }
    const contextOrigin = `phases/${n}/CONTEXT.md`;
    const context = alreadyArchived.has(contextOrigin) ? null : read(join(pdir, 'CONTEXT.md'));
    if (context) for (const text of parseContextDecisions(context)) {
      residue.push({ origin: contextOrigin, text });
    }
  }
  // no readable artifacts under the completed phases means no ARCHIVE.md at all, the way the two document writes below skip on an empty set
  if (residue.length) atomicWrite(archiveFile, appendArchiveRows(archiveText, label, residue));
  }, 'archive-locked');
  // a refused lock stops the close before any directory moves: proceeding would remove the phases whose residue this run couldn't write, the permanent loss the lock exists to prevent
  if (archiveGuard.ok === false) {
    return fail(archiveGuard.reason, archiveGuard.detail,
      'nothing was pruned and no phase directory moved - let the run holding the lock finish, or'
      + ' clear a stale one the detail names, then re-run the close');
  }

  // directories first, so the documents describe only what this pass actually accomplished
  // the order this replaced was transforms, directories, writes, defended by a comment claiming a rename that throws leaves both docs untouched. It never did: the throw is caught inside this loop and collected as a warning, so the writes ran unconditionally and the envelope still answered ok:true, action "pruned". A close that couldn't move one phase still deleted its roadmap line and archived its requirement rows, and /cad-milestone, which relays warnings[] but halts on none of them, committed that disagreement
  // so the only set that reaches the transforms is the one whose directory is gone from the live tree; `missing` counts as gone (it already was, which makes a re-run idempotent) and `failed` doesn't
  const dirs = { archived: [], deleted: [], missing: [] };
  // one step per completed phase, keyed by the phase number, the value the envelope's `failed` array carries. It continues past a failure, this seam's own discipline and not renumber's: a phase whose directory won't move keeps its documents, and the phases that did clear are still pruned. lib/file-transition.mjs owns the ordering and the record; the envelope stays here
  /** @type {Array<[number, () => void]>} */
  const steps = completed.map((n) => [n, () => {
    const src = join(dir, 'phases', String(n));
    if (!existsSync(src)) { dirs.missing.push(n); return; }
    if (mode === 'delete') { rmSync(src, { recursive: true }); dirs.deleted.push(n); return; }
    mkdirSync(archiveRoot, { recursive: true });
    const dest = join(archiveRoot, String(n));
    // refuse a destination that already exists and don't let renameSync decide: onto an empty directory it silently succeeds, onto a non-empty one it throws ENOTEMPTY, and onto a symlink it follows. A pre-existing destination means a previous close half-ran, and clobbering it would destroy that evidence
    if (lstatSync(dest, { throwIfNoEntry: false })) {
      throw new Error(`${dest} already exists - a previous close left it there`);
    }
    renameSync(src, dest);
    dirs.archived.push(n);
  }]);
  const pass = runTransition({ steps, discipline: 'continue-past-failure' });
  const failed = pass.failures.map((f) => f.key);
  // appended here and not inside the thunks so the warning order is unchanged: the REQUIREMENTS.md-missing warning still comes first and the missingSections ones still follow
  for (const { key: n, error: e } of pass.failures) {
    warnings.push(`phase ${n}: directory ${mode} failed: ${e && e.message ? e.message : e}`);
  }

  // the pruned set is the completed phases whose directory is gone from the live tree. Recomputing the transforms over this and not over `completed` is the whole fix: a phase that failed keeps its roadmap line and its `## Active` requirement rows, so the tree and the documents still agree
  const applied = completed.filter((n) => !failed.includes(n));

  const pruned = pruneRoadmap(roadmapText, applied);
  for (const n of pruned.missingSections) {
    warnings.push(`phase ${n}: no "### Phase ${n}:" detail section found to remove`);
  }
  const reqResult = reqText === null ? null : archiveRequirements(reqText, applied, label);

  // nothing cleared, nothing to say: skip both writes and don't rename an identical file into place
  if (applied.length) {
    atomicWrite(roadmapFile, pruned.text);
    if (reqResult && reqResult.moved.length) atomicWrite(reqFile, reqResult.text);
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
    // always present, 0 included: absence and silence are different answers, and a close that wrote nothing has to be legible as one and not as a field the caller forgot to look for
    residue_rows: residue.length,
    ...(warnings.length ? { warnings } : {}),
  };

  // a partial application is a refusal and not a success carrying a warning: the caller has to tell "the close is done" from "half done and the rest needs a hand" without reading prose, and warnings[] already carries benign diagnostics
  if (failed.length) {
    return emit({ ok: false, reason: 'partial-prune', action: 'partial', failed, ...envelope,
      hint: `phases ${failed.join(', ')} still have directories under ${join(dir, 'phases')};`
        + ' they were left in ROADMAP.md and REQUIREMENTS.md. Fix what blocked them and re-run -'
        + ' the phases that did clear are already pruned, so a re-run only picks up the rest.' });
  }
  return ok({ action: 'pruned', ...envelope });
}

export { cmdMilestonePrune };
