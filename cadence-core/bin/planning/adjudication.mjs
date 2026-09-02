// @ts-check
// planning/adjudication.mjs - `adjudication`: the record a blocking or
// adjudicated gate fire leaves beside its sibling REVIEW file.
//
// `groundCitations` is this handler's alone (D-05): it asks, once per fire,
// which cited files do not exist at the resolved head.
'use strict';

import { execFileSync } from 'node:child_process';
import { lstatSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fail, fireHome, fireIdentity, ok, readJsonPayload, resolveRange } from './core.mjs';
import { buildEntries, recordName } from '../lib/adjudication-record.mjs';
import { atomicWrite } from '../lib/planning-files.mjs';
import { redactUrl } from '../lib/redact-url.mjs';
import { emit } from '../lib/seam-io.mjs';

// ---------------------------------------------------------------------------
// adjudication - the record a blocking or adjudicated gate fire leaves beside
// its sibling REVIEW-<trigger>-<discriminator>.md.
//
// THE DEFECT IT CLOSES. A gate settled its findings and then summarized itself:
// the trace kept `<n> survivors of <m> raised`, the finding BODIES were never
// written anywhere, and a refutation - the ruling that DELETES a finding -
// could not be checked against the code it claimed to refute, because the claim
// was gone by the time anyone asked. This seam writes one entry per finding
// RAISED per raising voice, carrying the reviewer's own words, so the auditor
// path `git checkout <head_id>` then open `file:line` is mechanical.
//
// THE GRAMMAR IS lib/adjudication-record.mjs's; THE I/O IS THIS FUNCTION'S.
// The module classifies a composed payload and derives the counts, and every
// decision it cannot make without touching the world - reading the payload
// file, resolving the range, choosing the path, refusing to overwrite - is made
// here. That split is why the module can be tested without a repository.
//
// THE PAYLOAD IS A FILE, never inline JSON (D-03), read through
// `readJsonPayload` - the reader `uat merge` already uses, whose
// `no-payload`/`bad-payload` split is exactly what a truncated or never-written
// file looks like. The record's whole content is verbatim reviewer text with
// arbitrary quoting, so one unescaped quote in a heredoc would make the payload
// unparseable after the adjudication was already done and could not be redone.
//
// THE IDS ARE RESOLVED HERE AND THE CALLER'S SPELLING IS NOT TRUSTED (D-08):
// measured on this repository, 44 of the 52 outcome receipts carrying a `base`
// spell it 7-char, and `workflows/execute.md` passes the literal `HEAD`, which
// is not a commit id at all. An unresolvable range is a REFUSAL rather than a
// record with null ids - a record whose head cannot be checked out is not the
// artifact this subcommand exists to produce.
// ---------------------------------------------------------------------------

/**
 * Which of these entries cite a `file` that does not EXIST at `headId` (D-09,
 * AC5) - and whether the question could be asked at all.
 *
 * WHY IT IS ASKED. The auditor path this record exists to buy is `git checkout
 * <head_id>` then open `file:line`, and NOTHING upstream checks either field:
 * review-provider.mjs's `FINDING_SCHEMA` bounds `file` only as a non-empty
 * string of at most 1024 characters, and skills/cad-reviewer-contract/SKILL.md
 * calls `line` best-effort in as many words. So the citation is checked here,
 * once, while the head is already resolved - which buys the auditor path
 * instead of demonstrating it.
 *
 * A MARKED ENTRY IS STILL STORED, NEVER DROPPED. The mark is the auditor's
 * warning that the citation cannot be opened; dropping the entry would delete
 * the very finding whose grounding is in question, which is the summarizing
 * this whole record exists to end.
 *
 * THE PROBE FIRST, and this is the load-bearing part. `git cat-file -e
 * <sha>:<path>` exits 128 both for a path absent at that commit and for "this
 * is not a repository" (measured - it is NOT the documented exit 1 on this
 * git), so the two are indistinguishable per entry. The probe asks one question
 * whose answer cannot be about any path - can this repository read the head
 * commit object - and only once it says yes is a later nonzero exit
 * attributable to the citation. A check that could not run AT ALL is reported
 * ONCE by the caller and marks NOTHING: an unprovable citation set is not a bad
 * one, and marking every entry there is the collapsed-stdin defect
 * `land-cleanup.mjs` already cost this project once, rewritten.
 *
 * `-C top` - the repository top `resolveRange` returned - the way
 * `cmdRiskCheckRun` reads its diff, so the answer is the repository's and not
 * the process cwd's.
 *
 * @param {string} top the repository top
 * @param {string} headId the resolved 40-character head id
 * @param {any[]} entries
 * @returns {{checked: boolean, missing: Set<number>, reason: string}}
 *   `checked: false` carries an EMPTY `missing` by construction, so a caller
 *   cannot mark entries against a check that never ran.
 */
function groundCitations(top, headId, entries) {
  const git = (/** @type {string} */ arg) => execFileSync('git',
    ['-C', top, 'cat-file', '-e', arg], { stdio: ['ignore', 'ignore', 'pipe'] });
  try {
    git(`${headId}^{commit}`);
  } catch (e) {
    // redactUrl first, the EXP-01 rail cmdLeaseCheck's `no-staged-set` applies:
    // a git failure detail can carry a remote URL with credentials in it.
    return { checked: false, missing: new Set(),
      reason: redactUrl(e && e.message ? e.message : String(e)) };
  }
  /** @type {Set<number>} */
  const missing = new Set();
  for (let i = 0; i < entries.length; i += 1) {
    // The path is the SECOND half of one `<sha>:<path>` argument, so a citation
    // opening with `-` can never be read by git as an option.
    try { git(`${headId}:${entries[i].file}`); } catch { missing.add(i); }
  }
  return { checked: true, missing, reason: '' };
}

function cmdAdjudication(dir, opts) {
  const id = fireIdentity('adjudication', dir, opts);
  if (!id) return;
  const { n, trigger, discriminator, round, base, head, task } = id;

  // Absent `--payload` is refused rather than fed to stdin: the declared row
  // says required, `evaluateRow` is a VALUE door and not a presence one, and
  // `readJsonPayload()` with no argument would sit reading a stdin no gate site
  // opens.
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

  // The ONE filename rule, shared with the receipt recount in `cmdTrace`: two
  // spellings of it is two files, and the recount would read the wrong fire.
  const name = recordName(trigger, discriminator, round);
  const file = join(pdir, name);
  // DERIVED from the home that was chosen, never the literal `phases/<N>/`: a
  // carried fire is adjudicated in `deferred/<N>/`, and an envelope naming a
  // path the record is not at is a path an auditor cannot open.
  const rel = relative(dir, file);
  // REFUSED, never overwritten. A caller that forgot `--round` on a re-arm is
  // the failure the flag exists FOR, and replacing the file there lands in
  // exactly the state it was added to prevent: the first round's rulings gone,
  // silently, with ok:true. `lstatSync` again - a symlink at the target is
  // something already there, whatever it points at.
  let existing = null;
  try { existing = lstatSync(file); } catch { /* the ordinary case */ }
  if (existing) {
    return fail('record-exists',
      `${rel} already exists and holds round ${round}'s rulings - this seam never `
      + 'overwrites a record',
      'a re-arm is a SECOND fire of the same trigger on the same plan: pass --round '
      + `${round + 1} so it lands beside round ${round} instead of replacing it`);
  }

  // EVERY CITATION GROUNDED AT THE HEAD (D-09, AC5), before the record is
  // written and after every refusal above, so a refused call does no git work.
  const cites = groundCitations(range.top, range.head, built.entries);

  // ONE COPY OF THE RESOLVED PAIR PER ENTRY, deliberately, on top of the pair
  // on the record's own header: an entry is what gets quoted, copied into a
  // report and argued about, and an entry that cannot say which head it was
  // judged at sends the auditor back to the file it came from to find out.
  const record = {
    phase: n,
    // THE SLUG ON THE RECORD, present only on a task's fire (D-07). Without it
    // the body states `"phase": "0"` and nothing else, leaving the directory
    // path as the record's only statement of what was settled - and a path is
    // not something a reader holding the parsed JSON still has. `phase` itself
    // stays the caller's own spelling: the hand-written file it replaces wrote
    // `"phase": "0 (task: <slug>)"`, a string a reader has to parse back apart,
    // which is the substitution the structured `--trigger` flag already exists
    // to refuse. Absent, never empty, on a phase fire - the
    // present-only-when-real convention `redactions` and `config_warnings`
    // already take, so a phase record's key set is the shape it always was.
    ...(task === undefined ? {} : { task }),
    trigger,
    discriminator,
    round,
    // Both spellings AND both ids, the shape `risk-check run` records: the
    // spelling is what the caller recognises, the id is the range's identity.
    base,
    head,
    base_id: range.base,
    head_id: range.head,
    // The ROSTER of voices that ran, which the entries alone cannot carry: a
    // fire where every voice returned nothing has no entries at all, and a
    // record that cannot say which voices ran is not evidence that any did.
    voices: built.voices,
    // WHETHER THE GROUNDING RAN, on the record itself: the absence of a
    // `citation_missing` mark below means "checked and found" only when this
    // says the check happened, and means nothing at all when it did not. No
    // COUNT rides it - the record stores none of its own, and a reader recounts
    // the marks the same way it recounts the rulings.
    citations: cites.checked ? { checked: true } : { checked: false, reason: cites.reason },
    entries: built.entries.map((e, i) => ({
      ...e,
      // MARKED, never dropped: the mark is the auditor's warning that this
      // citation cannot be opened at `head_id`, and the finding whose grounding
      // is in question is the last one a record may lose.
      ...(cites.missing.has(i) ? { citation_missing: true } : {}),
      base_id: range.base,
      head_id: range.head,
    })),
  };
  atomicWrite(file, `${JSON.stringify(record, null, 2)}\n`);

  // The counts ride the ENVELOPE and never the record (the record stores no
  // count of its own): a stored count is a second place for the record to
  // disagree with itself, and the cross-check that matters is between the
  // record and the trace receipt. `deriveCounts` recomputes these from the
  // stored entries for any later reader.
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
    // The count lives HERE and not on the record, where every figure is derived.
    citations: cites.checked
      ? { checked: true, missing: cites.missing.size }
      : { checked: false, reason: cites.reason },
  });
}

export { cmdAdjudication };
