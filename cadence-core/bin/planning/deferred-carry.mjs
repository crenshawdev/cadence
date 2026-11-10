// @ts-check
// planning/deferred-carry.mjs - `deferred carry`: moves the queue out of the phase directory a close is about to delete
'use strict';

import { existsSync, lstatSync, mkdirSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { fail, notRealDirDetail, ok, phaseGuard, readQueue } from './core.mjs';
import { queueName } from '../lib/deferred-queue.mjs';
import { emit } from '../lib/seam-io.mjs';

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
  const carryRoot = join(dir, 'deferred');
  // check every component: lstat follows all but the last, so deferred/ itself could be a link out of the tree
  const rootStat = lstatSync(carryRoot, { throwIfNoEntry: false });
  if (rootStat && !rootStat.isDirectory()) {
    return fail('carry-dest-unusable',
      notRealDirDetail('deferred/', rootStat, 'renameSync'),
      'clear that path and re-run BEFORE milestone-prune - nothing has moved yet, and the members'
      + ' are still in the phase directory the prune deletes');
  }

  // the phase is a directory level, not in the filename: two phases routinely defer the same trigger on one plan-<k>
  const dest = join(dir, 'deferred', n);
  const destStat = lstatSync(dest, { throwIfNoEntry: false });
  if (destStat && !destStat.isDirectory()) {
    return fail('carry-dest-unusable',
      notRealDirDetail(`deferred/${n}`, destStat, 'renameSync'),
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

  // a member already under deferred/<N>/ is where this puts things, so a re-run after a partial carry finishes the job
  // a settled member (ADJUDICATION sibling) stays to be pruned, or a cleared finding would face every later land
  const src = join(dir, 'phases', n);
  const moving = q.members.filter((m) => m.path.startsWith(`phases/${n}/`));
  if (!moving.length) {
    return ok({ phase: n, moved: [], carried: 0, findings: 0 });
  }

  // check every destination before the first rename: a name already there is another fire's only copy
  for (const m of moving) {
    const name = queueName(m.trigger, m.discriminator, m.round);
    if (lstatSync(join(dest, name), { throwIfNoEntry: false })) {
      return fail('carry-exists',
        `deferred/${n}/${name} already exists - this seam never overwrites a carried queue member`,
        'adjudicate or move it first; it is another fire\'s only copy of what was deferred');
    }
  }

  mkdirSync(dest, { recursive: true });
  const moved = [];
  for (const m of moving) {
    const name = queueName(m.trigger, m.discriminator, m.round);
    // a move, not a copy: the archived phase directory would count one fire twice. Basename stays for `deferred list`
    renameSync(join(src, name), join(dest, name));
    moved.push({
      trigger: m.trigger,
      discriminator: m.discriminator,
      round: m.round,
      from: m.path,
      to: `deferred/${n}/${name}`,
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
