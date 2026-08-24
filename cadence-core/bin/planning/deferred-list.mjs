// @ts-check
// planning/deferred-list.mjs - `deferred list`: what is still queued, and the
// one derivation every reader of that question runs.
'use strict';

import { existsSync } from 'node:fs';
import { fail, ok, readQueue } from './core.mjs';
import { requirePhaseArg } from '../lib/require-int.mjs';
import { emit } from '../lib/seam-io.mjs';

// ---------------------------------------------------------------------------
// deferred list - WHAT IS STILL QUEUED, and the one derivation every reader of
// that question runs.
//
// MEMBERSHIP IS A FILE EXISTING (CONTEXT D-01), never absence-of-record: a
// `DEFERRED-<trigger>-<discriminator>[-r<round>].json` whose `ADJUDICATION`
// sibling - the name `recordName` resolves for the SAME trigger, discriminator
// and round - is not beside it. Absence alone cannot be the test because every
// advisory fire also leaves a REVIEW file with no record beside it, so "no
// record here" describes the whole advisory arm as well as the queue.
//
// TWO HOMES AND NO THIRD. `.planning/phases/<N>/` is where a fire writes, and
// `.planning/deferred/<N>/` is where `deferred carry` moves what a milestone
// close is about to prune. An `_archive-<label>/` tree is deliberately out of
// reach: `milestone-prune --mode archive` puts it at the planning ROOT rather
// than under either home, and what it holds is a closed milestone's copy of
// work that was already carried - counting it would refuse every land after a
// close over findings that are no longer in the live tree.
//
// AN UNPROVABLE QUEUE IS NOT AN EMPTY ONE. A directory this cannot read, a
// member whose bytes do not parse, a symlink wearing a member's name: each
// lands on `unreadable` and the envelope answers `ok:false`, because the one
// caller that matters is a REFUSAL and reporting "nothing deferred" about input
// it could not read is the fail-open arm `decideGateHalt` already names for an
// unreadable findings payload. The counts still ride the refusal, so the
// operator sees what WAS provable beside what was not.
//
// NO FINDING BODIES CROSS THIS SEAM, only counts and identities - so the land
// refusal and the progress line print the answer directly instead of routing
// bulk reviewer text through a scratch file (RES-03). A triage reads the bodies
// out of the member file itself, whose path this names.
// ---------------------------------------------------------------------------

function cmdDeferredList(dir, opts) {
  let wantPhase = null;
  if ('phase' in opts) {
    const parsed = requirePhaseArg(opts.phase);
    if (!parsed.ok) {
      return fail('bad-args', 'deferred list --phase needs a phase number (N or N.M)',
        'send a plain phase number, or drop --phase to list every finding still queued across the'
        + ' milestone');
    }
    // The caller's OWN spelling, the way every other phase-addressed read in
    // this file works: the value is a directory component before it is
    // anything arithmetic, and `String(Number('08'))` names a different phase.
    wantPhase = parsed.raw;
  }
  if (!existsSync(dir)) return fail('no-planning-dir', `${dir} not found`, '/cad-new-project');

  const q = readQueue(dir, wantPhase);
  const answer = {
    ...(wantPhase !== null ? { phase: wantPhase } : {}),
    members: q.members,
    findings: q.findings,
    unreadable: q.unreadable,
  };
  if (q.unreadable.length) {
    // ok:false, carrying the counts anyway. The question this seam answers is
    // "is anything still queued", and it could not answer it - so it says so
    // rather than handing a refusal surface a number that is only a floor.
    return emit({
      ok: false,
      reason: 'unprovable-queue',
      detail: `${q.unreadable.length} path(s) under ${dir} could not be read, so the queue `
        + `cannot be proven empty: ${q.unreadable.map((u) => u.path).join(', ')}`,
      hint: 'make them readable and re-run - an unreadable queue refuses a land exactly as a member does',
      ...answer,
    });
  }
  return ok(answer);
}

export { cmdDeferredList };
