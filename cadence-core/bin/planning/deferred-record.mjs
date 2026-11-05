// @ts-check
// planning/deferred-record.mjs - `deferred record`: the queue member a gate resolved `deferred` leaves behind
'use strict';

import { lstatSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fail, fireHome, fireIdentity, ok, readJsonPayload, resolveRange } from './core.mjs';
import { buildQueue, queueName } from '../lib/deferred-queue.mjs';
import { atomicWrite } from '../lib/planning-files.mjs';
import { emit } from '../lib/seam-io.mjs';

// the opposite of the adjudication record: that says a fire was judged, this says it wasn't yet
function cmdDeferredRecord(dir, opts) {
  const id = fireIdentity('deferred record', dir, opts);
  if (!id) return;
  const { n, trigger, discriminator, round, base, head } = id;

  // a file, as for the adjudication record: one stray quote in a heredoc makes verbatim reviewer text unparseable
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

  // resolved, never the caller's spelling: land time is another session, where HEAD names a different commit
  // an unresolvable range refuses, since a head that can't be checked out can't be triaged
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
  // derived like the record's: a capped re-arm's round-2 member goes into whichever home the round-1 member is in
  const rel = relative(dir, file);
  // refused, never overwritten, like the record beside it: forgetting --round on a re-arm would silently drop a round
  // lstat, since a symlink at the target is already something there
  let existing = null;
  try { existing = lstatSync(file); } catch { /* the ordinary case */ }
  if (existing) {
    return fail('record-exists',
      `${rel} already exists and holds round ${round}'s deferred findings - this seam `
      + 'never overwrites a queue member',
      'a re-arm is a SECOND fire of the same trigger on the same plan: pass --round '
      + `${round + 1} so it lands beside round ${round} instead of replacing it`);
  }

  // committed, since trace.jsonl is gitignored and dropped at uat_verdict complete, a queue there would evaporate
  const record = {
    phase: n,
    trigger,
    discriminator,
    round,
    // both spellings and both ids, like the adjudication record: spelling for the caller, id for the range's identity
    base,
    head,
    base_id: range.base,
    head_id: range.head,
    // verbatim, not counted: /cad-milestone deletes the sibling REVIEW file, so a bare count would be untriageable
    findings: queued.findings,
  };
  // no adjudication record, no fourth ruling: a finding with no ruling is a refusal, so RULINGS stays at three
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
