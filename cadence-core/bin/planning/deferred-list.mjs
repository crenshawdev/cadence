// @ts-check
// planning/deferred-list.mjs - `deferred list`: what is still queued, the one derivation every reader of it runs
'use strict';

import { existsSync } from 'node:fs';
import { fail, ok, phaseGuard, readQueue } from './core.mjs';
import { emit } from '../lib/seam-io.mjs';

// membership is a `DEFERRED-<trigger>-<discriminator>[-r<round>].json` with no ADJUDICATION sibling beside it
// a missing record alone isn't enough: every advisory fire also leaves a REVIEW file with none
function cmdDeferredList(dir, opts) {
  let wantPhase = null;
  if ('phase' in opts) {
    // wantPhase is a directory component: with both spellings on disk the answer would be about the other phase
    const parsed = phaseGuard('deferred list', dir, opts.phase, 'deferred list --phase needs a phase number (N or N.M)',
      'send a plain phase number, or drop --phase to list every finding still queued across the'
      + ' milestone',
      're-run the list with one of the two spellings the detail names - nothing was read');
    if (!parsed) return;
    // the caller's own spelling: a directory component before arithmetic, and String(Number('08')) is another phase
    wantPhase = parsed.raw;
  }
  if (!existsSync(dir)) return fail('no-planning-dir', `${dir} not found`, '/cad-new-project');

  // two homes and no third: phases/<N>/ is where a fire writes and deferred/<N>/ is where `deferred carry` moves it
  // not the archive tree: it holds already-carried copies, and counting them would refuse every land
  const q = readQueue(dir, wantPhase);
  // no finding bodies cross this seam, only counts and identities, so the land refusal can print the answer directly
  const answer = {
    ...(wantPhase !== null ? { phase: wantPhase } : {}),
    members: q.members,
    findings: q.findings,
    unreadable: q.unreadable,
  };
  if (q.unreadable.length) {
    // an unprovable queue isn't an empty one: "nothing deferred" about unreadable input is a fail-open arm, so ok:false
    // the counts ride along so the operator sees what was provable
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
