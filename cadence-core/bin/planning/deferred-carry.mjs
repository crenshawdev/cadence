// @ts-check
// planning/deferred-carry.mjs - `deferred carry`: moves the queue out of the phase directory a close is about to delete, so the refusal it feeds still has something to read
'use strict';

import { existsSync, lstatSync, mkdirSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { fail, ok, phaseSpellingCollision, readQueue } from './core.mjs';
import { queueName } from '../lib/deferred-queue.mjs';
import { requirePhaseArg } from '../lib/require-int.mjs';
import { emit } from '../lib/seam-io.mjs';

// a seam and not a prose step: this moves committed artifacts in a close that runs unattended, and a prose step that half-ran would leave the only thing stopping that land in a directory milestone-prune is about to remove
function cmdDeferredCarry(dir, opts) {
  const parsed = requirePhaseArg(opts.phase);
  if (!parsed.ok) {
    return fail('bad-args', 'deferred carry needs --phase <N>',
      'pass --phase <N> for the phase whose queue is being carried out, then re-run - this runs'
      + ' BEFORE milestone-prune, which deletes the directory the members sit in');
  }
  // the collision check goes before anything moves, so a spelling that names one phase in the envelope and another on disk is refused; phases/1.10/ stays carryable on a tree with no phases/1.1/
  const collision = phaseSpellingCollision(dir, parsed);
  if (collision) {
    return fail('bad-args', `deferred carry ${collision}`,
      're-run the carry with one of the two spellings the detail names - nothing was moved');
  }
  const n = parsed.raw;
  if (!existsSync(dir)) return fail('no-planning-dir', `${dir} not found`, '/cad-new-project');

  // the destination goes first, before any member is read: renameSync follows a symlink or file squatting it and would deposit committed artifacts wherever it points
  const carryRoot = join(dir, 'deferred');
  // every component this creates gets checked, not only the last: lstat follows everything before the final one, so a check on deferred/<N> alone says "absent" while deferred/ is already a link out of the tree
  const rootStat = lstatSync(carryRoot, { throwIfNoEntry: false });
  if (rootStat && !rootStat.isDirectory()) {
    return fail('carry-dest-unusable',
      'deferred/ exists and is not a real directory'
      + `${rootStat.isSymbolicLink() ? ' (it is a symlink, which renameSync would follow out of the planning root)' : ''}`
      + ' - move or remove it, then re-run',
      'clear that path and re-run BEFORE milestone-prune - nothing has moved yet, and the members'
      + ' are still in the phase directory the prune deletes');
  }

  // the phase stays a directory level and never goes into the filename: two phases routinely defer the same trigger on the same plan-<k>, and a flat carry would let one member silently replace another
  const dest = join(dir, 'deferred', n);
  const destStat = lstatSync(dest, { throwIfNoEntry: false });
  if (destStat && !destStat.isDirectory()) {
    return fail('carry-dest-unusable',
      `deferred/${n} exists and is not a real directory`
      + `${destStat.isSymbolicLink() ? ' (it is a symlink, which renameSync would follow out of the planning root)' : ''}`
      + ' - move or remove it, then re-run',
      'clear that path and re-run BEFORE milestone-prune - nothing has moved yet, and the members'
      + ' are still in the phase directory the prune deletes');
  }

  const q = readQueue(dir, n);
  // this is the last call before milestone-prune deletes the directory, so carrying what was provable and staying quiet about the rest would destroy exactly the members it couldn't read
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
  // a settled member is left behind to be pruned with its phase: its ADJUDICATION sibling means it's not in the queue, and carrying it would put a cleared finding in front of every later land
  const src = join(dir, 'phases', n);
  const moving = q.members.filter((m) => m.path.startsWith(`phases/${n}/`));
  if (!moving.length) {
    return ok({ phase: n, moved: [], carried: 0, findings: 0 });
  }

  // every destination is checked before the first rename so a collision refuses the whole carry, and nothing is overwritten: a name already there is another fire's only copy
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
    // a move and not a copy, since a copy in the archived phase directory would count one fire twice; the basename stays so `deferred list` reads it like a fresh member
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
