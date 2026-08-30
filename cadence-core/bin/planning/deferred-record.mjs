// @ts-check
// planning/deferred-record.mjs - `deferred record`: the queue member a gate
// resolved `deferred` leaves behind.
'use strict';

import { lstatSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fail, fireHome, fireIdentity, ok, readJsonPayload, resolveRange } from './core.mjs';
import { buildQueue, queueName } from '../lib/deferred-queue.mjs';
import { atomicWrite } from '../lib/planning-files.mjs';
import { emit } from '../lib/seam-io.mjs';

// ---------------------------------------------------------------------------
// deferred record - the QUEUE MEMBER a gate resolved `deferred` leaves behind.
//
// The sibling of the record above, and its opposite: that file says a fire was
// judged, this one says it was not yet. A `deferred` gate runs its reviewer,
// persists what came back and lets the run continue, so the finding stops the
// LAND rather than the RUN - and the only thing that makes that true is this
// artifact still being there, in the tree, at land time.
//
// COMMITTED, unlike the REVIEW file it sits beside (CONTEXT D-01).
// `.planning/trace.jsonl` is gitignored and `renderTrace` drops a phase's
// events at its `uat_verdict complete`, so a trace-resident queue evaporates on
// a fresh clone and again at sign-off while every in-session test stays green.
// Membership is this file EXISTING with no superseding `ADJUDICATION-*.json`
// beside it, never absence-of-record alone: every advisory fire also leaves a
// REVIEW file with no record.
//
// THE FINDINGS ARE STORED VERBATIM, not counted (lib/deferred-queue.mjs states
// why): `/cad-milestone` deletes the sibling REVIEW file, and a queue member
// whose bodies lived only there names a number nobody can triage.
//
// IT WRITES NO ADJUDICATION RECORD AND ADDS NO FOURTH RULING (D-09). `RULINGS`
// is frozen at three and a finding with no ruling is a refusal, so a record at
// fire time is impossible by construction rather than by convention.
// ---------------------------------------------------------------------------
function cmdDeferredRecord(dir, opts) {
  const id = fireIdentity('deferred record', dir, opts);
  if (!id) return;
  const { n, trigger, discriminator, round, base, head } = id;

  // The payload is a FILE for the reason the adjudication record's is: it is
  // verbatim reviewer text with arbitrary quoting, and one unescaped quote in a
  // heredoc makes it unparseable after the fire is over. It is the SAME file
  // the fire wrote to the sibling REVIEW-<trigger>-<discriminator>.md.
  if (opts.payload === undefined) {
    return fail('bad-args',
      'deferred record needs --payload <file> - the reviewer\'s returned object is a '
      + 'FILE, never inline JSON and never stdin',
      'pass --payload <path> naming the file the fire already wrote - the same object that went'
      + ' into the sibling REVIEW-<trigger>-<discriminator>.md');
  }
  const payload = readJsonPayload(opts.payload);
  if (!payload.ok) return;
  const queued = buildQueue(payload.value);
  if (!queued.ok) {
    return fail('bad-payload', queued.detail,
      'repair the payload file at the point the detail names, then re-run - nothing was queued, and'
      + ' an unqueued finding is one /cad-land will never see');
  }

  // RESOLVED, never the caller's spelling (D-08): a queue member is read at
  // land time, in another session, and `HEAD` will name a different commit by
  // then. An unresolvable range is a refusal rather than a member with null
  // ids - a queue entry whose head cannot be checked out cannot be triaged.
  const range = resolveRange(base, head);
  if (!range.ok) {
    return emit({
      ok: false,
      reason: 'unresolved-range',
      phase: n,
      base,
      head,
      detail: range.error,
      hint: 'name a --base and --head this repository can resolve, then re-run this record',
    });
  }

  const pdir = fireHome(dir, n, 'queue member');
  if (!pdir) return;

  const name = queueName(trigger, discriminator, round);
  const file = join(pdir, name);
  // Same derivation as the record's, and the same reason: a capped re-arm's
  // round-2 member is written into whichever home the round-1 member is in.
  const rel = relative(dir, file);
  // REFUSED, never overwritten, exactly as the record beside it is: a caller
  // that forgot `--round` on a re-arm would otherwise drop the round the land
  // refusal is still holding, silently, with ok:true. `lstatSync` - a symlink
  // at the target is something already there, whatever it points at.
  let existing = null;
  try { existing = lstatSync(file); } catch { /* the ordinary case */ }
  if (existing) {
    return fail('record-exists',
      `${rel} already exists and holds round ${round}'s deferred findings - this seam `
      + 'never overwrites a queue member',
      'a re-arm is a SECOND fire of the same trigger on the same plan: pass --round '
      + `${round + 1} so it lands beside round ${round} instead of replacing it`);
  }

  const record = {
    phase: n,
    trigger,
    discriminator,
    round,
    // Both spellings AND both ids, the shape the adjudication record and
    // `risk-check run` both use: the spelling is what the caller recognises,
    // the id is the range's identity.
    base,
    head,
    base_id: range.base,
    head_id: range.head,
    // VERBATIM, and no count beside them: a stored count is a second place for
    // the member to disagree with itself, and every reader of this file
    // recounts the array the way `deriveCounts` recounts an entry list.
    findings: queued.findings,
  };
  atomicWrite(file, `${JSON.stringify(record, null, 2)}\n`);

  return ok({
    phase: n,
    trigger,
    discriminator,
    round,
    record: rel,
    base,
    head,
    base_id: range.base,
    head_id: range.head,
    findings: queued.findings.length,
  });
}

export { cmdDeferredRecord };
