// @ts-check
// planning/deferred-list.mjs - `deferred list`: what is still queued, and the one derivation every reader of that question runs
'use strict';

import { existsSync } from 'node:fs';
import { fail, ok, phaseSpellingCollision, readQueue } from './core.mjs';
import { requirePhaseArg } from '../lib/require-int.mjs';
import { emit } from '../lib/seam-io.mjs';

// membership is a `DEFERRED-<trigger>-<discriminator>[-r<round>].json` existing with no ADJUDICATION sibling beside it, never absence of a record alone, since every advisory fire also leaves a REVIEW file with no record
function cmdDeferredList(dir, opts) {
  let wantPhase = null;
  if ('phase' in opts) {
    const parsed = requirePhaseArg(opts.phase);
    if (!parsed.ok) {
      return fail('bad-args', 'deferred list --phase needs a phase number (N or N.M)',
        'send a plain phase number, or drop --phase to list every finding still queued across the'
        + ' milestone');
    }
    // wantPhase is the directory component, so on a tree holding both spellings a caller asking about one phase's queue would be answered about the other's
    const collision = phaseSpellingCollision(dir, parsed);
    if (collision) {
      return fail('bad-args', `deferred list ${collision}`,
        're-run the list with one of the two spellings the detail names - nothing was read');
    }
    // the caller's own spelling, like every other phase-addressed read here: it's a directory component before it's arithmetic, and String(Number('08')) names a different phase
    wantPhase = parsed.raw;
  }
  if (!existsSync(dir)) return fail('no-planning-dir', `${dir} not found`, '/cad-new-project');

  // two homes and no third: phases/<N>/ is where a fire writes and deferred/<N>/ is where `deferred carry` moves it
  // the archive tree is out of reach on purpose, because it holds a closed milestone's copy of work already carried and counting it would refuse every land over findings no longer live
  const q = readQueue(dir, wantPhase);
  // no finding bodies cross this seam, only counts and identities, so the land refusal prints the answer directly and doesn't route bulk reviewer text through a scratch file
  const answer = {
    ...(wantPhase !== null ? { phase: wantPhase } : {}),
    members: q.members,
    findings: q.findings,
    unreadable: q.unreadable,
  };
  if (q.unreadable.length) {
    // an unprovable queue is not an empty one: "nothing deferred" about input it couldn't read is the fail-open arm decideGateHalt names, so it's ok:false, and the counts ride along so the operator sees what was provable
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
