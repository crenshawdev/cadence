// @ts-check
// planning/deferred-carry.mjs - `deferred carry`: the queue out of the phase
// directory a close is about to delete, so the refusal it feeds still has
// something to read.
'use strict';

import { existsSync, lstatSync, mkdirSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { fail, ok, phaseSpellingCollision, readQueue } from './core.mjs';
import { queueName } from '../lib/deferred-queue.mjs';
import { requirePhaseArg } from '../lib/require-int.mjs';
import { emit } from '../lib/seam-io.mjs';

// ---------------------------------------------------------------------------
// deferred carry - the queue OUT of the phase directory a close is about to
// delete, so the refusal it feeds still has something to read.
//
// WHY A SEAM AND NOT A PROSE INSTRUCTION (D-10). The `risk_surface` union
// beside it in `workflows/milestone.md` is prose because it composes a
// TRANSIENT file the same close deletes at step 7. This one MOVES committed
// artifacts during a close that runs completely unattended - `/cad-milestone`
// chains `/cad-land` after the prune - and a prose step that half-ran there
// leaves the only thing stopping that land in a directory `milestone-prune` is
// about to remove.
//
// A MOVE AND NOT A COPY. `milestone-prune --mode archive` puts the phase
// directory under `_archive-<label>/`, which no reader here walks; a COPY would
// leave a second member inside it and, if that tree were ever read, one fire
// would be counted twice. A move also means the carried member is the only
// copy, which is what makes it clear when it is adjudicated.
//
// THE PHASE STAYS A DIRECTORY LEVEL, never folded into the filename: two phases
// routinely defer the same trigger on the same `plan-<k>` discriminator, so a
// flat carry would collide, and the collision would be one queue member
// silently replacing another's.
//
// A SETTLED MEMBER IS LEFT BEHIND to be pruned with its phase. It has its
// `ADJUDICATION` sibling, so it is not in the queue at all - carrying it would
// put a cleared finding in front of every later land.
// ---------------------------------------------------------------------------
function cmdDeferredCarry(dir, opts) {
  const parsed = requirePhaseArg(opts.phase);
  if (!parsed.ok) {
    return fail('bad-args', 'deferred carry needs --phase <N>',
      'pass --phase <N> for the phase whose queue is being carried out, then re-run - this runs'
      + ' BEFORE milestone-prune, which deletes the directory the members sit in');
  }
  // The tree-aware collision check, right after the parse and BEFORE the
  // destination rail below - this seam renames committed artifacts, so a
  // spelling that names one phase in the envelope and another on disk is
  // refused before anything moves. It refuses only when the normalized
  // spelling names a directory that exists here, so `phases/1.10/` stays
  // carryable on a tree with no `phases/1.1/`.
  const collision = phaseSpellingCollision(dir, parsed);
  if (collision) {
    return fail('bad-args', `deferred carry ${collision}`,
      're-run the carry with one of the two spellings the detail names - nothing was moved');
  }
  const n = parsed.raw;
  if (!existsSync(dir)) return fail('no-planning-dir', `${dir} not found`, '/cad-new-project');

  // THE DESTINATION FIRST, before this seam has read a single member.
  // `lstatSync` and `isDirectory`, the rail `milestone-prune --mode archive`
  // states for its own archive root: a symlink or a regular file squatting the
  // destination is FOLLOWED by `renameSync`, which would deposit committed
  // artifacts wherever it points. Asked ahead of the queue read deliberately -
  // it is a fact about where things go, not about what is queued, and its
  // refusal is the actionable one. Absent is the ordinary case; the mkdir
  // below creates it.
  // EVERY component this seam creates, not only the last one. `lstatSync` does
  // not follow the FINAL component and follows every one before it, so a check
  // aimed at `deferred/<N>` alone answers "absent, go ahead" while the parent
  // is already a link out of the tree - and the `mkdirSync(recursive)` below
  // then builds `<wherever>/<N>` and `renameSync` fills it. `milestone-prune`'s
  // archive root escapes this because it sits ONE level under the planning root
  // and its single lstat therefore IS the intermediate check; this destination
  // sits two levels down, so it takes two.
  const carryRoot = join(dir, 'deferred');
  const rootStat = lstatSync(carryRoot, { throwIfNoEntry: false });
  if (rootStat && !rootStat.isDirectory()) {
    return fail('carry-dest-unusable',
      'deferred/ exists and is not a real directory'
      + `${rootStat.isSymbolicLink() ? ' (it is a symlink, which renameSync would follow out of the planning root)' : ''}`
      + ' - move or remove it, then re-run',
      'clear that path and re-run BEFORE milestone-prune - nothing has moved yet, and the members'
      + ' are still in the phase directory the prune deletes');
  }

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
  // REFUSED before anything moves, and for a sharper reason than the reader
  // has: this call is the last thing that runs before `milestone-prune`
  // DELETES the directory. Carrying what was provable and saying nothing about
  // the rest would destroy exactly the members it could not read.
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

  // Only what is still in the phase directory. A member already under
  // `deferred/<N>/` is where this face puts things, so a re-run after a partial
  // carry finishes the job instead of refusing it.
  const src = join(dir, 'phases', n);
  const moving = q.members.filter((m) => m.path.startsWith(`phases/${n}/`));
  if (!moving.length) {
    return ok({ phase: n, moved: [], carried: 0, findings: 0 });
  }

  // ALL destinations checked BEFORE the first rename, so a collision refuses
  // the whole carry rather than leaving half the queue in each home. Never
  // overwritten: a destination already holding this name is a member from an
  // earlier carry, and it is another fire's only copy.
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
    // The BASENAME is preserved so `deferred list` reads a carried member by
    // exactly the rule it reads a fresh one - the name is part of the identity.
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
