// @ts-check
// planning/adjudication.mjs - `adjudication`: the record a gate fire leaves beside its REVIEW file
// groundCitations is this handler's alone: once per fire it asks which cited files don't exist at the resolved head
'use strict';

import { execFileSync } from 'node:child_process';
import { lstatSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fail, fireHome, fireIdentity, ok, readJsonPayload, resolveRange } from './core.mjs';
import { buildEntries, recordName } from '../lib/adjudication-record.mjs';
import { atomicWrite } from '../lib/planning-files.mjs';
import { redactUrl } from '../lib/redact-url.mjs';
import { emit } from '../lib/seam-io.mjs';

// a gate used to summarize itself and the finding bodies went nowhere, so a refutation couldn't be checked against code
// one entry per finding per raising voice in the reviewer's own words: `git checkout <head_id>` then open file:line
// lib/adjudication-record.mjs holds the grammar and what touches the world lives here, so it tests without a repo
// the payload is a file: it's verbatim reviewer quoting, and one stray quote in a heredoc leaves it unparseable
// the caller's id spelling isn't trusted (receipts carry 7 chars, execute.md passes `HEAD`): unresolvable refuses

/**
 * Which entries cite a `file` that doesn't exist at `headId`, and whether the question could be asked at all.
 * Nothing upstream checks `file`. A marked entry is still stored: dropping it would delete the finding in question.
 * The probe goes first: `git cat-file -e <sha>:<path>` exits 128 for a missing path and for "not a repository" alike,
 * so check the head commit is readable before reading a nonzero exit as being about the citation.
 * A check that couldn't run marks nothing; marking every entry there is what land-cleanup got wrong.
 *
 * @param {string} top the repository top
 * @param {string} headId the resolved 40-character head id
 * @param {any[]} entries
 * @returns {{checked: boolean, missing: Set<number>, reason: string}}
 */
function groundCitations(top, headId, entries) {
  const git = (/** @type {string} */ arg) => execFileSync('git',
    ['-C', top, 'cat-file', '-e', arg], { stdio: ['ignore', 'ignore', 'pipe'] });
  try {
    git(`${headId}^{commit}`);
  } catch (e) {
    // redactUrl first: a git failure detail can carry a remote URL with credentials in it
    return { checked: false, missing: new Set(),
      reason: redactUrl(e && e.message ? e.message : String(e)) };
  }
  /** @type {Set<number>} */
  const missing = new Set();
  for (let i = 0; i < entries.length; i += 1) {
    // the path is half of one `<sha>:<path>` argument, so a citation opening with `-` can't be read as an option
    try { git(`${headId}:${entries[i].file}`); } catch { missing.add(i); }
  }
  return { checked: true, missing, reason: '' };
}

function cmdAdjudication(dir, opts) {
  const id = fireIdentity('adjudication', dir, opts);
  if (!id) return;
  const { n, trigger, discriminator, round, base, head, task } = id;

  // an absent --payload is refused, not fed to stdin: evaluateRow checks values and not presence, and readJsonPayload
  // with no argument would sit reading a stdin no gate site opens
  if (opts.payload === undefined) {
    return fail('bad-args',
      'adjudication needs --payload <file> - the composed payload is a FILE, never '
      + 'inline JSON and never stdin',
      'write the composed rulings to a file and pass --payload <path> - reviewer text carries'
      + ' arbitrary quoting, which is why it never rides the command line');
  }
  const payload = readJsonPayload(opts.payload);
  if (!payload.ok) return;
  const built = buildEntries(payload.value);
  if (!built.ok) {
    return fail('bad-payload', built.detail,
      'repair the payload file at the point the detail names, then re-run - nothing was written,'
      + ' so the fire is still unrecorded');
  }

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

  const pdir = fireHome(dir, n, 'record', task);
  if (!pdir) return;

  // one filename rule, shared with the receipt recount in cmdTrace: two spellings would make it read the wrong fire
  const name = recordName(trigger, discriminator, round);
  const file = join(pdir, name);
  // derived from the home that was chosen, never a literal phases/<N>/: a carried fire is adjudicated in deferred/<N>/
  const rel = relative(dir, file);
  // refused, never overwritten: forgetting --round on a re-arm would silently lose the first round's rulings. lstat,
  // since a symlink at the target is already something there
  let existing = null;
  try { existing = lstatSync(file); } catch { /* the ordinary case */ }
  if (existing) {
    return fail('record-exists',
      `${rel} already exists and holds round ${round}'s rulings - this seam never `
      + 'overwrites a record',
      'a re-arm is a SECOND fire of the same trigger on the same plan: pass --round '
      + `${round + 1} so it lands beside round ${round} instead of replacing it`);
  }

  // after every refusal above, so a refused call does no git work
  const cites = groundCitations(range.top, range.head, built.entries);

  // each entry carries the resolved pair too: an entry is what gets quoted, so it says which head it was judged at
  const record = {
    phase: n,
    // the slug rides the record only on a task's fire: without it the directory path is all that says what was settled
    // absent, not empty, on a phase fire, so a phase record keeps the key set it always had
    ...(task === undefined ? {} : { task }),
    trigger,
    discriminator,
    round,
    // both spellings and both ids, like risk-check run records: spelling for the caller, id for the range's identity
    base,
    head,
    base_id: range.base,
    head_id: range.head,
    // the voices that ran, which entries can't carry: a fire where every voice returned nothing has no entries
    voices: built.voices,
    // no citation_missing mark means "checked and found" only if this says the check ran. A reader recounts the marks
    citations: cites.checked ? { checked: true } : { checked: false, reason: cites.reason },
    entries: built.entries.map((e, i) => ({
      ...e,
      // marked and never dropped: the finding whose grounding is in question is the last one a record may lose
      ...(cites.missing.has(i) ? { citation_missing: true } : {}),
      base_id: range.base,
      head_id: range.head,
    })),
  };
  atomicWrite(file, `${JSON.stringify(record, null, 2)}\n`);

  // counts ride the envelope, not the record: a stored count is a second place for the record to disagree with itself
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
    voices: built.voices.length,
    counts: built.counts,
    // the count lives here and not on the record, where every figure is derived
    citations: cites.checked
      ? { checked: true, missing: cites.missing.size }
      : { checked: false, reason: cites.reason },
  });
}

export { cmdAdjudication };
