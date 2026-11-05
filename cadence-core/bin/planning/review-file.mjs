// @ts-check
// planning/review-file.mjs - `review-file`: the adjudicated gate's Markdown review file, six headings per survivor
// the JSON gates (blocking, deferred, advisory) keep their own file; this seam is the adjudicated arm's alone
'use strict';

import { lstatSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fail, fireHome, fireIdentity, ok, readJsonPayload } from './core.mjs';
import { buildReviewFile, reviewFileName } from '../lib/review-file.mjs';
import { atomicWrite } from '../lib/planning-files.mjs';

function cmdReviewFile(dir, opts) {
  const id = fireIdentity('review-file', dir, opts);
  if (!id) return;
  const { n, trigger, discriminator, round, base, head, task } = id;

  // a file, as for the record: the six bodies carry reviewer quoting that one stray quote in a heredoc would break
  if (opts.payload === undefined) {
    return fail('bad-args',
      'review-file needs --payload <file> - the survivors are a FILE, never inline JSON and never stdin',
      'write the survivors to a file in the run\'s scratch directory and pass --payload <path>');
  }
  const payload = readJsonPayload(opts.payload);
  if (!payload.ok) return;
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
  // refused, never overwritten, like the record: lstat, since a symlink at the target is already something there
  let existing = null;
  try { existing = lstatSync(file); } catch { /* the ordinary case */ }
  if (existing) {
    return fail('review-exists',
      `${rel} already exists and holds round ${round}'s survivors - this seam never overwrites a review file`,
      `a re-arm is a SECOND fire of the same trigger on the same plan: pass --round ${round + 1} so it lands`
      + ` beside round ${round} instead of replacing it`);
  }
  atomicWrite(file, built.text);
  return ok({ phase: n, trigger, discriminator, round, review: rel, raised: built.raised, survivors: built.survivors });
}

export { cmdReviewFile };
