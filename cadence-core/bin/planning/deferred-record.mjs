// @ts-check
// planning/deferred-record.mjs - `deferred record`: the queue member a gate resolved `deferred` leaves behind
'use strict';

import { join, relative } from 'node:path';
import { fail, fireHome, fireIdentity, firePayload, fireRange, fireTargetTaken, ok } from './core.mjs';
import { buildQueue, queueName } from '../lib/deferred-queue.mjs';
import { atomicWrite, makeDir } from '../lib/planning-store.mjs';

// the opposite of the adjudication record: that says a fire was judged, this says it wasn't yet
function cmdDeferredRecord(dir, opts) {
  const id = fireIdentity('deferred record', dir, opts);
  if (!id) return;
  const { n, trigger, discriminator, round, base, head } = id;

  // a file, as for the adjudication record: one stray quote in a heredoc makes verbatim reviewer text unparseable
  const payload = firePayload(opts,
    'deferred record needs --payload <file> - the reviewer\'s returned object is a '
    + 'FILE, never inline JSON and never stdin',
    'pass --payload <path> naming the file the fire already wrote - the same object that went'
    + ' into the sibling REVIEW-<trigger>-<discriminator>.md');
  if (!payload.ok) return;
  const queued = buildQueue(payload.value);
  if (!queued.ok) {
    return fail('bad-payload', queued.detail,
      'repair the payload file at the point the detail names, then re-run - nothing was queued, and'
      + ' an unqueued finding is one /cad-land will never see');
  }

  // resolved, never the caller's spelling: land time is another session, where HEAD names a different commit
  // an unresolvable range refuses, since a head that can't be checked out can't be triaged
  const range = fireRange(n, base, head);
  if (!range) return;

  const pdir = fireHome(dir, n, 'queue member');
  if (!pdir) return;

  const name = queueName(trigger, discriminator, round);
  const file = join(pdir, name);
  // derived like the record's: a capped re-arm's round-2 member goes into whichever home the round-1 member is in
  const rel = relative(dir, file);
  // refused, never overwritten, like the record beside it: forgetting --round on a re-arm would silently drop a round
  if (fireTargetTaken(dir, file, round, 'queue')) return;

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
  makeDir(pdir);
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
