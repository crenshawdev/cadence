// @ts-check
// planning/deferred-record.mjs - `deferred record`: the queue member a gate resolved `deferred` leaves behind
'use strict';

import { lstatSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fail, fireHome, fireIdentity, ok, readJsonPayload, resolveRange } from './core.mjs';
import { buildQueue, queueName } from '../lib/deferred-queue.mjs';
import { atomicWrite } from '../lib/planning-files.mjs';
import { emit } from '../lib/seam-io.mjs';

// the opposite of the adjudication record: that says a fire was judged and this says it wasn't yet, so the finding stops the land and not the run
function cmdDeferredRecord(dir, opts) {
  const id = fireIdentity('deferred record', dir, opts);
  if (!id) return;
  const { n, trigger, discriminator, round, base, head } = id;

  // a file for the adjudication record's reason (one unescaped quote in a heredoc makes verbatim reviewer text unparseable), and it's the same file the fire wrote to the sibling REVIEW file
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

  // resolved and never the caller's spelling, since a member is read at land time in another session when HEAD names a different commit; an unresolvable range is a refusal because a head that can't be checked out can't be triaged
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
  // derived like the record's, for the same reason: a capped re-arm's round-2 member is written into whichever home the round-1 member is in
  const rel = relative(dir, file);
  // refused and never overwritten, like the record beside it: a caller that forgot --round on a re-arm would silently drop the round the land refusal is still holding, with ok:true. lstat, since a symlink at the target is already something there
  let existing = null;
  try { existing = lstatSync(file); } catch { /* the ordinary case */ }
  if (existing) {
    return fail('record-exists',
      `${rel} already exists and holds round ${round}'s deferred findings - this seam `
      + 'never overwrites a queue member',
      'a re-arm is a SECOND fire of the same trigger on the same plan: pass --round '
      + `${round + 1} so it lands beside round ${round} instead of replacing it`);
  }

  // committed, unlike the REVIEW file beside it: trace.jsonl is gitignored and renderTrace drops a phase's events at its uat_verdict complete, so a queue living there would evaporate on a fresh clone and at sign-off while every in-session test stays green
  const record = {
    phase: n,
    trigger,
    discriminator,
    round,
    // both spellings and both ids, like the adjudication record and risk-check run: the spelling is what the caller recognises and the id is the range's identity
    base,
    head,
    base_id: range.base,
    head_id: range.head,
    // verbatim and not counted: /cad-milestone deletes the sibling REVIEW file, so bodies living only there would leave a number nobody can triage, and a stored count is a second place to disagree
    findings: queued.findings,
  };
  // no adjudication record is written and no fourth ruling added: RULINGS is frozen at three and a finding with no ruling is a refusal, so a record at fire time is impossible by construction
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
