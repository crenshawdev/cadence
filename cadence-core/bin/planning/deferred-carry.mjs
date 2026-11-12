// @ts-check
// planning/deferred-carry.mjs - `deferred carry`: moves the queue out of the phase directory a close is about to delete
'use strict';

import { existsSync, lstatSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fail, notRealDirDetail, ok, phaseGuard, readQueue } from './core.mjs';
import { queueName } from '../lib/deferred-queue.mjs';
import { emit } from '../lib/seam-io.mjs';
import { deferredDir, ensureRecordsDir, makeDir, movePath, phaseRecordsDir, recordsDir } from '../lib/planning-store.mjs';

/** Where the carry lands, relative to the planning directory, as every message and answer here names it. */
const CARRY_REL = relative('.', deferredDir('.')).split(sep).join('/');
/** The folder that holds it, checked on its own because a link there carries the members out of the tree. */
const RECORDS_REL = relative('.', recordsDir('.')).split(sep).join('/');

// a seam, not prose: a half-run step would leave what stops the land in a directory milestone-prune is about to remove
function cmdDeferredCarry(dir, opts) {
  // collision check before anything moves, so a spelling that means different phases in envelope and on disk is refused
  const parsed = phaseGuard('deferred carry', dir, opts.phase, 'deferred carry needs --phase <N>',
    'pass --phase <N> for the phase whose queue is being carried out, then re-run - this runs'
    + ' BEFORE milestone-prune, which deletes the directory the members sit in',
    're-run the carry with one of the two spellings the detail names - nothing was moved');
  if (!parsed) return;
  const n = parsed.raw;
  if (!existsSync(dir)) return fail('no-planning-dir', `${dir} not found`, '/cad-new-project');

  // destination first: renameSync follows a symlink squatting it and would deposit artifacts wherever it points
  const carryRoot = deferredDir(dir);
  // check every component: lstat follows all but the last, so either folder could be a link out of the tree
  for (const [path, label] of [[recordsDir(dir), `${RECORDS_REL}/`], [carryRoot, `${CARRY_REL}/`]]) {
    const rootStat = lstatSync(path, { throwIfNoEntry: false });
    if (rootStat && !rootStat.isDirectory()) {
      return fail('carry-dest-unusable',
        notRealDirDetail(label, rootStat, 'renameSync'),
        'clear that path and re-run BEFORE milestone-prune - nothing has moved yet, and the members'
        + ' are still in the phase directory the prune deletes');
    }
  }

  // the phase is a directory level, not in the filename: two phases routinely defer the same trigger on one plan-<k>
  const dest = join(carryRoot, n);
  const destStat = lstatSync(dest, { throwIfNoEntry: false });
  if (destStat && !destStat.isDirectory()) {
    return fail('carry-dest-unusable',
      notRealDirDetail(`${CARRY_REL}/${n}`, destStat, 'renameSync'),
      'clear that path and re-run BEFORE milestone-prune - nothing has moved yet, and the members'
      + ' are still in the phase directory the prune deletes');
  }

  const q = readQueue(dir, n);
  // last call before milestone-prune deletes the directory, so carrying only what was provable would destroy the rest
  if (q.unreadable.length) {
    return emit({
      ok: false,
      reason: 'unprovable-queue',
      phase: n,
      moved: [],
      unreadable: q.unreadable,
      detail: `${q.unreadable.length} path(s) under ${dir} could not be read, so this carry `
        + `cannot prove what phase ${n} has queued: ${q.unreadable.map((u) => u.path).join(', ')}`,
      hint: 'make them readable and re-run BEFORE milestone-prune, which deletes the directory',
    });
  }

  // a member already under the carry folder's <N>/ is where this puts things, so a re-run after a partial carry finishes the job
  // a settled member (ADJUDICATION sibling) stays to be pruned, or a cleared finding would face every later land
  const src = phaseRecordsDir(join(dir, 'phases', n));
  const moving = q.members.filter((m) => m.path.startsWith(`phases/${n}/records/`));
  if (!moving.length) {
    return ok({ phase: n, moved: [], carried: 0, findings: 0 });
  }

  // check every destination before the first rename: a name already there is another fire's only copy
  for (const m of moving) {
    const name = queueName(m.trigger, m.discriminator, m.round);
    if (lstatSync(join(dest, name), { throwIfNoEntry: false })) {
      return fail('carry-exists',
        `${CARRY_REL}/${n}/${name} already exists - this seam never overwrites a carried queue member`,
        'adjudicate or move it first; it is another fire\'s only copy of what was deferred');
    }
  }

  const records = ensureRecordsDir(dir);
  if (!records.ok) {
    return fail('carry-dest-unusable', `${RECORDS_REL}/ cannot be used (${records.reason})`,
      'clear that path and re-run BEFORE milestone-prune - nothing has moved yet, and the members'
      + ' are still in the phase directory the prune deletes');
  }
  makeDir(dest);
  const moved = [];
  for (const m of moving) {
    const name = queueName(m.trigger, m.discriminator, m.round);
    // a move, not a copy: the archived phase directory would count one fire twice. Basename stays for `deferred list`
    movePath(join(src, name), join(dest, name));
    moved.push({
      trigger: m.trigger,
      discriminator: m.discriminator,
      round: m.round,
      from: m.path,
      to: `${CARRY_REL}/${n}/${name}`,
      findings: m.findings,
    });
  }
  return ok({
    phase: n,
    moved,
    carried: moved.length,
    findings: moved.reduce((t, m) => t + m.findings, 0),
  });
}

export { cmdDeferredCarry };
