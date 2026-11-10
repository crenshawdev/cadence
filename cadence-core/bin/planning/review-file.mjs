// @ts-check
// planning/review-file.mjs - `review-file`: the adjudicated gate's Markdown review file, six headings per survivor
// the JSON gates (blocking, deferred, advisory) keep their own file; this seam is the adjudicated arm's alone
'use strict';

import { lstatSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fail, fireHome, fireIdentity, firePayload, fireTargetTaken, intFlag, ok } from './core.mjs';
import { buildReviewFile, markSurvivor, reviewFileName } from '../lib/review-file.mjs';
import { atomicWrite } from '../lib/planning-files.mjs';

// the one change a written file takes: --mark <n> puts a re-ruling ahead of survivor n's headings, from the payload
function markFile(dir, opts, id, payload) {
  const { n, trigger, discriminator, round, task } = id;
  const number = intFlag(opts.mark, 1, 'review-file --mark needs the survivor\'s number after it, a whole number of at least 1',
    'pass --mark <n> with the number the review file gives the survivor');
  if (!number.ok) return;
  const pdir = fireHome(dir, n, 'review file', task);
  if (!pdir) return;
  const file = join(pdir, reviewFileName(trigger, discriminator, round));
  let st = null;
  try { st = lstatSync(file); } catch { /* absent is the answer */ }
  if (!st || !st.isFile()) {
    return fail('no-review-file', `${relative(dir, file)} is not a file - there is nothing to mark`,
      'check --trigger, --discriminator and --round against the file the fire wrote; a mark never creates one');
  }
  const marked = markSurvivor(readFileSync(file, 'utf8'), number.value, payload);
  if (!marked.ok) {
    return fail('bad-mark', marked.detail, 'nothing was changed; repair the payload or the number, then re-run');
  }
  atomicWrite(file, marked.text);
  return ok({ phase: n, trigger, discriminator, round, review: relative(dir, file), marked: number.value,
    ruling: payload.ruling, survivors: marked.survivors });
}

function cmdReviewFile(dir, opts) {
  const id = fireIdentity('review-file', dir, opts);
  if (!id) return;
  const { n, trigger, discriminator, round, base, head, task } = id;

  // a file, as for the record: the six bodies carry reviewer quoting that one stray quote in a heredoc would break
  const payload = firePayload(opts,
    'review-file needs --payload <file> - the survivors are a FILE, never inline JSON and never stdin',
    'write the survivors to a file in the run\'s scratch directory and pass --payload <path>');
  if (!payload.ok) return;
  if ('mark' in opts) return markFile(dir, opts, id, payload.value);
  const built = buildReviewFile(payload.value, { trigger, discriminator, round, base, head });
  if (!built.ok) {
    return fail('bad-payload', built.detail,
      'repair the payload file at the point the detail names, then re-run - nothing was written, so the'
      + ' fire still has no review file');
  }

  const pdir = fireHome(dir, n, 'review file', task);
  if (!pdir) return;
  const file = join(pdir, reviewFileName(trigger, discriminator, round));
  const rel = relative(dir, file);
  // refused, never overwritten, like the record
  if (fireTargetTaken(dir, file, round, 'review')) return;
  atomicWrite(file, built.text);
  return ok({ phase: n, trigger, discriminator, round, review: rel, raised: built.raised, survivors: built.survivors });
}

export { cmdReviewFile };
