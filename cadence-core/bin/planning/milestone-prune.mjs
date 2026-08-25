// @ts-check
// planning/milestone-prune.mjs - `milestone-prune`: the mechanical half of a
// milestone close, in one call.
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

// ---------------------------------------------------------------------------
// milestone-prune - the mechanical half of a milestone close, in one call.
// `/cad-milestone` steps 3+5 were three orchestrator hand-surgeries with a
// recorded failure mode (a close that left the tree failing its own audit);
// the text transforms live in lib/milestone-prune.mjs, this wrapper owns the
// I/O: read both docs, prune, move/delete the phase directories, write back.
// The judgment halves of the close (PROJECT.md evolution, carrying deferred
// requirements forward, seeding the next milestone) stay prose - this seam
// touches only what is mechanical.
// ---------------------------------------------------------------------------
function cmdMilestonePrune(dir, opts) {
  // `--label-file` is the path transport, and this label is caller-derived by
  // construction: an untagged close takes it from PROJECT.md's milestone NAME,
  // which is repository content going into a double-quoted shell word
  // (lib/text-flag-file.mjs, references/conventions.md). The transport changes
  // only HOW the label arrives - both terms below still run on the resolved
  // value, in the same order, before any read, mkdir or rename and in both
  // modes.
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
  // Two independent terms, both here at the point the label is read - before
  // any read, mkdir or rename, and in BOTH modes: `--mode delete` builds no
  // archive root but still writes the label into every shipped requirement row.
  //
  // NOT publish-decision.mjs's REMOTE_NAME shape (D-13): that regex admits no
  // spaces, and `workflows/milestone.md` makes an untagged label the milestone
  // NAME from PROJECT.md, so it would refuse this milestone's own label and
  // block /cad-milestone step 3.
  //
  // 1. The table term. archiveRequirements interpolates the label into a
  //    markdown table cell, where either character silently rewrites the row.
  if (/[|\r\n]/.test(label)) {
    return fail('bad-args',
      'milestone-prune --label cannot contain "|" or a newline - it is written into a REQUIREMENTS.md table cell',
      'take those characters out of the label and re-run - nothing was pruned, and either one would'
      + ' silently rewrite the shipped requirement rows it is written into');
  }
  // 2. The containment term. `_archive-<label>` is handed to mkdirSync and
  //    renameSync below, so `--label '../../../outside-tree'` moved phases/1
  //    clean out of the planning root and still answered ok:true. resolve()
  //    rather than the fsIdentity comparison the rest of this tree uses for
  //    paths: the archive root does not exist yet at validation time, and this
  //    has to run before any mkdir. Lexical alone is NOT enough, which is what
  //    the type term below closes.
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
  // 3. The TYPE term, and the reason the lexical test above cannot stand alone:
  //    `resolve()` is pure string arithmetic, so a pre-existing `_archive-<label>`
  //    that is ITSELF a symlink pointing out of the tree resolves lexically
  //    INSIDE it, `mkdirSync(recursive)` succeeds silently against it, and
  //    `renameSync` then follows the link and deposits the phase directories
  //    wherever it aimed. `lstatSync` classifies the LINK rather than its
  //    target, so a symlink fails `isDirectory()` here whatever it points at -
  //    which is also the right answer for a regular file squatting the name.
  //    Absent is the ordinary case and is not an error: the loop below creates
  //    it. Archive mode only - `delete` builds no archive root.
  if (mode === 'archive') {
    // `throwIfNoEntry: false` rather than a try/catch, the idiom `occupied`
    // above already uses: absent is data here, not an exception.
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

  // REQUIREMENTS.md is optional at this seam: a project without the file gets
  // the roadmap+dirs half and a warning, never a refusal - the close must not
  // stall on a doc the project never kept. READ here, TRANSFORMED below: the
  // read has to fail before anything is moved, but the transform has to run
  // after, over the set the directory pass actually cleared.
  const reqFile = join(dir, 'REQUIREMENTS.md');
  const reqText = read(reqFile);
  if (reqText === null) {
    warnings.push(`${reqFile} is missing or unreadable; requirements were not archived`);
  }

  // The recall residue, and the reason it is written HERE (RCL-07, D-01).
  //
  // Below this point the completed phases' directories leave the live tree, and
  // with them every SUMMARY deviation, UAT item and CONTEXT decision `recall`
  // indexes: the corpus Cadence writes in order to be remembered was reachable
  // only while the directory was. So the rows are read and APPENDED before the
  // loop, not after it. Emitting for the post-loop `applied` set would put the
  // write after the removal, where an interrupt between the two deletes the
  // directories, writes nothing, and reopens the reachability hole with no live
  // artifact left to recover it from.
  //
  // The rows are the SAME snippets the live walk indexes, from the SAME three
  // parsers `cmdRecall` runs, in the same fixed order (phases ascending, then
  // SUMMARY, UAT, CONTEXT within a phase) - never a model-authored distillation
  // (D-03). A prose-authored write puts the residue in the coordinator's hands,
  // where an interrupted close writes nothing and nothing says so.
  //
  // The cost of moving the write ahead of the loop is that idempotence stops
  // being free: a phase whose removal then FAILS is still live on a re-run and
  // would be read a second time. So the candidate set is filtered by what this
  // milestone's heading already contains - one containment test keyed on the
  // label, read back through the grammar's own parser, rather than a dedup pass
  // over the file or a written-labels sidecar. It is deliberately NOT in
  // `appendArchiveRows`: "already present" is a PHASE-level judgment this seam
  // can make and a pure text appender cannot, and folding it in there would
  // refuse a second artifact from a phase the same call already landed one for.
  const archiveFile = join(dir, 'ARCHIVE.md');
  const residue = [];
  // The read, the containment test and the write are ONE critical section, held
  // under the same sibling lock `/cad-capture` takes on CAPTURE.md. Unserialized,
  // two closes running with different labels both read the same text, each
  // writes only its own rows, and the later `atomicWrite` wins - and this seam
  // removes the phase directories immediately after, so the clobbered rows have
  // no live source left. That consequence is why ARCHIVE.md takes a lock the
  // ROADMAP and REQUIREMENTS writes below do not: those lose an edit git still
  // holds, this loses the only remaining copy.
  const archiveGuard = withPlanningFileLock(archiveFile, () => {
  const archiveText = read(archiveFile) ?? '';
  // Two properties this test must hold, both of them data-loss bugs when it
  // does not, because a suppressed write is followed by the directory removal
  // that makes the omission permanent:
  //
  // The label matches EXACTLY, never as a prefix of the composed source. A
  // milestone label is free text; `source.startsWith(label + '/')` answers true
  // for a row under a heading named `v1/anything` when the label is `v1`, so a
  // section this close does not own could mark this close's phases done.
  //
  // The key is the ARTIFACT, not the phase. One row for a phase does not prove
  // its other two were written: a close whose UAT.md was absent or unreadable
  // on the first pass lands SUMMARY and CONTEXT only, and keyed on the phase
  // number a retry - after the file is restored - skips the phase whole and
  // then removes the directory, dropping the row it re-ran to land.
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
  // Nothing to say, no file: a project with no readable artifacts under its
  // completed phases gets no ARCHIVE.md at all, the way the two document writes
  // below already skip on an empty set.
  if (residue.length) atomicWrite(archiveFile, appendArchiveRows(archiveText, label, residue));
  }, 'archive-locked');
  // A refused lock stops the close BEFORE any directory moves. Proceeding would
  // remove the phases whose residue this run could not write, which is the exact
  // permanent loss the lock exists to prevent.
  if (archiveGuard.ok === false) {
    return fail(archiveGuard.reason, archiveGuard.detail,
      'nothing was pruned and no phase directory moved - let the run holding the lock finish, or'
      + ' clear a stale one the detail names, then re-run the close');
  }

  // Directories FIRST, and the documents describe only what this pass actually
  // accomplished.
  //
  // The order this replaced was "transforms, directories, writes", defended by
  // a comment claiming "a rename that throws leaves both docs untouched on disk
  // rather than half a close". It never did: the throw is caught INSIDE this
  // loop and collected as a warning, so the writes below ran unconditionally
  // and the envelope still answered ok:true, action:"pruned". A close that
  // could not move phases/2 still deleted its roadmap line and archived its
  // requirement rows, and `/cad-milestone` - which relays warnings[] but halts
  // on none of them - committed that disagreement.
  //
  // So the ONLY set that reaches the transforms is the set whose directory is
  // gone from the live tree. `missing` counts as gone (it already was, which is
  // what makes a re-run idempotent); `failed` does not.
  const dirs = { archived: [], deleted: [], missing: [] };
  // One step per completed phase, keyed by the phase NUMBER - the value the
  // envelope's `failed` array carries. CONTINUE past a failure, which is this
  // seam's own discipline and not renumber's: a phase whose directory would not
  // move keeps its documents, and the phases that did clear are still pruned
  // (D-03). lib/file-transition.mjs owns the ordering and the record; the
  // envelope below stays here.
  /** @type {Array<[number, () => void]>} */
  const steps = completed.map((n) => [n, () => {
    const src = join(dir, 'phases', String(n));
    if (!existsSync(src)) { dirs.missing.push(n); return; }
    if (mode === 'delete') { rmSync(src, { recursive: true }); dirs.deleted.push(n); return; }
    mkdirSync(archiveRoot, { recursive: true });
    const dest = join(archiveRoot, String(n));
    // Refuse a destination that already exists rather than let renameSync
    // decide: onto an empty directory it silently succeeds, onto a
    // non-empty one it throws ENOTEMPTY, and onto a symlink it follows.
    // A pre-existing destination means a previous close half-ran, and
    // clobbering it would destroy that evidence.
    if (lstatSync(dest, { throwIfNoEntry: false })) {
      throw new Error(`${dest} already exists - a previous close left it there`);
    }
    renameSync(src, dest);
    dirs.archived.push(n);
  }]);
  const pass = runTransition({ steps, discipline: 'continue-past-failure' });
  const failed = pass.failures.map((f) => f.key);
  // Appended HERE rather than inside the thunks so warning ORDER is unchanged:
  // the REQUIREMENTS.md-missing warning still precedes them and the
  // missingSections warnings below still follow.
  for (const { key: n, error: e } of pass.failures) {
    warnings.push(`phase ${n}: directory ${mode} failed: ${e && e.message ? e.message : e}`);
  }

  // The pruned set: completed phases whose directory is no longer in the live
  // tree. Recomputing the transforms over THIS set rather than over `completed`
  // is the whole fix - a phase that failed keeps its roadmap line and its
  // `## Active` requirement rows, so the tree and the documents still agree.
  const applied = completed.filter((n) => !failed.includes(n));

  const pruned = pruneRoadmap(roadmapText, applied);
  for (const n of pruned.missingSections) {
    warnings.push(`phase ${n}: no "### Phase ${n}:" detail section found to remove`);
  }
  const reqResult = reqText === null ? null : archiveRequirements(reqText, applied, label);

  // Nothing cleared, nothing to say: skip both writes rather than rename an
  // identical file into place.
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
    // How many residue rows this invocation landed in ARCHIVE.md. Always
    // present, including as 0: absence and silence are different answers here
    // as everywhere, and a close that wrote nothing has to be legible as one
    // rather than as a field the caller forgot to look for.
    residue_rows: residue.length,
    ...(warnings.length ? { warnings } : {}),
  };

  // A partial application is a REFUSAL, not a success carrying a warning. The
  // caller has to be able to tell "the close is done" from "the close is half
  // done and the rest needs a hand" without reading prose, and `warnings[]`
  // could not carry that - it already carries benign diagnostics.
  if (failed.length) {
    return emit({ ok: false, reason: 'partial-prune', action: 'partial', failed, ...envelope,
      hint: `phases ${failed.join(', ')} still have directories under ${join(dir, 'phases')};`
        + ' they were left in ROADMAP.md and REQUIREMENTS.md. Fix what blocked them and re-run -'
        + ' the phases that did clear are already pruned, so a re-run only picks up the rest.' });
  }
  return ok({ action: 'pruned', ...envelope });
}

export { cmdMilestonePrune };
