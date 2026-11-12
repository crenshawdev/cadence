// @ts-check
// planning/uat.mjs - `uat`: the per-phase UAT checklist and its five subcommands
// (init | refresh | record | merge | status).
// The reader, writer and pending picker live here because nothing outside this handler calls them.
'use strict';

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fail, intFlag, phaseGuard, ok, read, readJsonPayload } from './core.mjs';
import {
  UAT_FIELDS_VERSION, UAT_ORIGINS, UAT_SOURCES, parseUat, renderUat, uatComplete,
} from '../lib/planning-files.mjs';
import { atomicWrite, ensurePhaseRecordsDir } from '../lib/planning-store.mjs';
import { resolveTextFlag } from '../lib/text-flag-file.mjs';

function uatFile(dir, n) { return join(dir, 'phases', String(n), 'UAT.md'); }

function loadUat(dir, n) {
  const text = read(uatFile(dir, n));
  if (text === null) {
    fail('no-uat', `${uatFile(dir, n)} not found`,
      'create this phase\'s checklist first with `uat init --phase <N>`, which /cad-verify runs as'
      + ' its own first step');
    return null;
  }
  return parseUat(text);
}

function nextPending(items) {
  const it = items.find((i) => i.status === 'pending');
  return it ? { k: it.k, name: it.name, expected: it.expected } : null;
}

function writeUat(dir, n, uat) {
  uat.fm.updated = new Date().toISOString().slice(0, 10);
  atomicWrite(uatFile(dir, n), renderUat(uat));
}

// `pending` is legal on a re-record: a fixed failure goes back to pending so the walk retests it
const UAT_RESULTS = ['pass', 'fail', 'skipped', 'blocked', 'pending', 'pending_ci'];

// the only fields `--fields-file` may carry; the rest have their own guards and this would route around them
const UAT_TEXT_FIELDS = ['reason', 'reported', 'cause', 'fix', 'evidence', 'job', 'commit'];

function cmdUat(dir, sub, opts) {
  // n stays the caller's spelling, never a number, so 1.10 reads `phases/1.10` and not the 1.1 checklist
  // before any read of the phase directory, so `phases/1.10/` still works on a tree with no `phases/1.1/`
  const parsedPhase = phaseGuard('uat', dir, opts.phase, 'uat needs --phase <N>',
    'pass --phase <N> naming the phase whose checklist this call touches, then re-run',
    're-run with one of the two spellings the detail names - nothing was read');
  if (!parsedPhase) return;
  const n = parsedPhase.raw;

  if (sub === 'init' || sub === 'refresh') {
    // stdin only, --payload is merge's; a literal null has to reach the Array.isArray guard below
    const payload = readJsonPayload();
    if (!payload.ok) return;
    const items = payload.value;
    if (!Array.isArray(items) || items.some((i) => !i || !i.name || !i.expected)) {
      return fail('bad-payload', 'expected a JSON array of {name, expected}',
        'send an ARRAY, and give every element both a `name` and an `expected` - fix the step that'
        + ' composed the payload and send it again');
    }
    // optional, but a typo is refused before any write, not left for criteria-coverage to find on disk
    const badCriterion = items.find((i) => i.criterion !== undefined && !/^AC\d+$/.test(i.criterion));
    if (badCriterion) {
      return fail('bad-payload', `criterion must be AC<N> (got: ${badCriterion.criterion})`,
        "spell that item's criterion as an acceptance-criterion id from this phase's CONTEXT.md"
        + ' - AC1, AC2 - or leave the field off the item; nothing was written');
    }
    const badOrigin = items.find((i) => i.origin !== undefined && !UAT_ORIGINS.includes(i.origin));
    if (badOrigin) {
      return fail('bad-payload', `origin must be one of: ${UAT_ORIGINS.join(' | ')} (got: ${badOrigin.origin})`,
        'use one of the values the detail lists, or leave `origin` off the item - it records where'
        + ' the item came from, so a guessed value misreports its provenance');
    }
    // origin is never derived from criterion: that is already a marker, and a second skews backfilled checklists
    const build = (it, k) => ({ k, name: it.name, expected: it.expected,
      ...(it.criterion ? { criterion: it.criterion } : {}),
      ...(it.origin ? { origin: it.origin } : {}),
      status: 'pending', ...(it.source ? { source: it.source } : {}) });
    if (sub === 'init') {
      if (existsSync(uatFile(dir, n))) {
        return fail('uat-exists', 'use refresh, or remove the file deliberately',
          'run `uat refresh --phase <N>` to append the new items to the checklist already on disk;'
          + ' deleting UAT.md instead throws away every result already recorded in it');
      }
      const today = new Date().toISOString().slice(0, 10);
      const uat = {
        // unconditional, so a payload with no criterion can't pass for a checklist from before the field
        fm: { status: 'testing', phase: String(n), fields_version: UAT_FIELDS_VERSION,
          started: today, updated: today,
          ...(opts.sources ? { sources: opts.sources } : {}) },
        items: items.map((it, i) => build(it, i + 1)),
      };
      writeUat(dir, n, uat);
      return ok({ file: uatFile(dir, n), items: uat.items.length, next: nextPending(uat.items) });
    }
    // append-only by name, and it carries init's fields because every verify re-run comes through here
    const uat = loadUat(dir, n);
    if (!uat) return;
    const have = new Set(uat.items.map((i) => String(i.name)));
    const fresh = items.filter((i) => !have.has(i.name));
    let k = Math.max(0, ...uat.items.map((i) => Number(i.k)));
    for (const it of fresh) uat.items.push(build(it, ++k));
    if (fresh.length) writeUat(dir, n, uat);
    return ok({ added: fresh.length, total: uat.items.length, next: nextPending(uat.items) });
  }

  if (sub === 'record') {
    const uat = loadUat(dir, n);
    if (!uat) return;
    // a valueless --item parses as true and Number(true) is 1, so an unset $K recorded against item 1 for good
    const parsedItem = intFlag(opts.item, null, 'uat record needs --item <k>',
      "pass --item <k> using the item's number from this phase's UAT.md, then re-run; a"
      + ' `--item "$K"` with the variable unset'
      + ' arrives here as a flag'
      + ' with no value');
    if (!parsedItem.ok) return;
    const k = parsedItem.value;
    const item = uat.items.find((i) => Number(i.k) === k);
    if (!item) {
      return fail('unknown-item', `no item ${k} in UAT.md`,
        "re-run with a number that appears in this phase's UAT.md; if the item you meant was never"
        + ' added, `uat refresh --phase <N>` appends it first');
    }
    if (!UAT_RESULTS.includes(opts.result)) {
      return fail('bad-result', `--result must be one of: ${UAT_RESULTS.join(' | ')}`,
        'send one of the results the detail lists; a failure you have since fixed goes back to'
        + ' `pending` so the walk retests it');
    }
    const source = opts.source || 'user';
    // before any write: an out-of-enum --source used to be dropped, recording a walk-run pass as a user answer
    if (opts.source !== undefined && !UAT_SOURCES.includes(String(opts.source))) {
      return fail('bad-args', `--source must be one of: ${UAT_SOURCES.join(' | ')}`,
        "send one of the values the detail lists, or drop --source to record this as the user's own"
        + ' answer; nothing was written');
    }
    // verifier alone on purpose, guarding a model result would refuse the retest re-record route_failures needs
    if (source === 'verifier' && item.status !== 'pending') {
      return fail('would-overwrite', `item ${k} is ${item.status}; verifier results only fill pending items`,
        'leave the recorded result standing - it is a human answer this seam will not overwrite. If'
        + ' it is genuinely wrong, re-record the item yourself without --source verifier');
    }
    // before any write, so a bad --origin leaves the file byte-unchanged instead of recording a marker nothing reads
    if (opts.origin !== undefined && !UAT_ORIGINS.includes(opts.origin)) {
      return fail('bad-args', `--origin must be one of: ${UAT_ORIGINS.join(' | ')}`,
        'send one of the values the detail lists, or drop --origin; nothing was written, so UAT.md'
        + ' is byte-unchanged');
    }
    // the repair form re-records the current status (no field-only mode); `--origin` here would write an id-less marker
    if (opts.criterion !== undefined && !/^AC\d+$/.test(String(opts.criterion))) {
      return fail('bad-args', `--criterion must be AC<N> (got: ${opts.criterion})`,
        "spell it --criterion AC<N>, matching an acceptance-criterion id in this phase's CONTEXT.md"
        + ' - a flag given with no value arrives here as `true` and is refused the same way');
    }
    // caller-derived prose goes by path, because inline it sits in a shell word where `$(...)` runs before Node starts
    const resolvedFields = resolveTextFlag(opts, 'fields', 'uat record');
    if (!resolvedFields.ok) {
      return fail('bad-args', resolvedFields.detail,
        'pass the free-text fields inline or through --fields-file <path>, never both, and point'
        + ' --fields-file at a readable, non-empty file');
    }
    // one JSON object, not a -file flag per field, so a failed item doesn't cost extra Write calls
    /** @type {Record<string, string>} */
    let fileFields = {};
    if (resolvedFields.value !== undefined) {
      let payload;
      try {
        payload = JSON.parse(resolvedFields.value);
      } catch (e) {
        return fail('bad-args',
          `uat record --fields-file is not JSON: ${e && e.message ? e.message : String(e)}`,
          'repair the JSON in that file at the position the detail names, then re-run - the file is'
          + ' the transport here, so nothing is fixed by retyping the value on the command line');
      }
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return fail('bad-args',
          `uat record --fields-file must hold a JSON object of ${UAT_TEXT_FIELDS.join(' | ')}`,
          'rewrite the file as one JSON object keyed by those field names, e.g.'
          + ' {"reason": "...", "fix": "..."}');
      }
      for (const [key, value] of Object.entries(payload)) {
        // refused, never dropped: the enum fields have their own guards, and a dropped key looks recorded
        if (!UAT_TEXT_FIELDS.includes(key)) {
          return fail('bad-args', `uat record --fields-file carries "${key}", which is not one of:`
            + ` ${UAT_TEXT_FIELDS.join(' | ')}`,
            'drop that key from the file, or pass it as its own flag - the fields the detail lists'
            + ' are the only ones this transport carries, and the rest are enum-checked at their'
            + ' own flags');
        }
        if (typeof value !== 'string') {
          return fail('bad-args', `uat record --fields-file "${key}" must be a string`,
            'quote that value as a JSON string in the file, then re-run');
        }
        // picking a winner would quietly drop a value the caller thinks was recorded
        if (opts[key] !== undefined) {
          return fail('bad-args',
            `uat record takes "${key}" inline or in --fields-file, never both`,
            'remove the key from --fields-file, or drop the inline flag - keeping both would'
            + ' silently discard one of the two values you believe was recorded');
        }
      }
      fileFields = payload;
    }
    const given = (/** @type {string} */ key) => (opts[key] !== undefined ? opts[key] : fileFields[key]);
    if (opts.result === 'pending_ci') {
      if (typeof given('job') !== 'string' || typeof given('commit') !== 'string') {
        return fail('bad-args', '--result pending_ci needs both --job <name> and --commit <sha>',
          'name the CI job that will run this check and the commit it is waiting on, inline or in'
          + ' --fields-file; nothing was written. Re-record pending_ci with a new --commit to move'
          + ' the item to a later head');
      }
    }
    item.status = opts.result;
    // user stays implicit so old checklists stay byte-identical
    if (source !== 'user') item.source = source;
    // criterion is already in UAT_FIELDS, so it renders after expected and survives rewrites
    for (const [flag, field] of [['reason', 'reason'], ['reported', 'reported'],
      ['severity', 'severity'], ['cause', 'cause'], ['fix', 'fix'], ['evidence', 'evidence'],
      ['origin', 'origin'], ['criterion', 'criterion'], ['job', 'job'], ['commit', 'commit']]) {
      // the file form feeds this loop and nothing else, so either transport writes the same bytes
      const value = opts[flag] !== undefined ? opts[flag] : fileFields[flag];
      if (value !== undefined) item[field] = value;
    }
    // first_pass is the first pass/fail verdict, set once and never again
    if (item.first_pass === undefined && (opts.result === 'pass' || opts.result === 'fail')) {
      item.first_pass = opts.result;
    }
    writeUat(dir, n, uat);
    const parsed = parseUat(read(uatFile(dir, n)) || '');
    return ok({ item: { k, status: item.status }, counts: parsed.counts, next: nextPending(uat.items) });
  }

  if (sub === 'merge') {
    // entries are partial-success on purpose, because one nameless gap shouldn't kill twenty good findings
    const payload = readJsonPayload(opts.payload);
    if (!payload.ok) return;
    const f = payload.value;
    // the envelope is all-or-nothing and refuses before any write, or "hello" merged as a clean deep pass
    if (f === null || typeof f !== 'object' || Array.isArray(f)) {
      return fail('bad-payload',
        'expected a JSON object carrying passes, gaps or human_checks',
        'send an OBJECT like {"passes": [...], "gaps": [...]}, not an array or a bare value - fix'
        + ' the findings payload and re-run; UAT.md is byte-unchanged');
    }
    if (!Array.isArray(f.passes) && !Array.isArray(f.gaps)
      && !Array.isArray(f.human_checks)) {
      return fail('bad-payload',
        'payload carries none of passes, gaps, human_checks as an array',
        'add at least one of those three to the findings payload as an array - an object with none'
        + ' of them would merge nothing while reporting a clean deep pass');
    }
    // the check above proves only one list is an array, and a string sibling got iterated per character
    for (const key of ['passes', 'gaps', 'human_checks']) {
      if (f[key] !== undefined && !Array.isArray(f[key])) {
        return fail('bad-payload', `${key} is present but not an array`,
          'make that key an array in the findings payload, or remove it - anything else there is'
          + ' iterated per character and would report a merge that never happened');
      }
    }
    const uat = loadUat(dir, n);
    if (!uat) return;
    // an entry with no usable name used to land as "### N. undefined", a phantom that blocks completion for good
    const usableName = (e) => (typeof e.name === 'string' && e.name.trim() ? e.name.trim() : null);
    // same normalizer as the append path: raw matching missed "Login works " and appended an unreachable duplicate
    const find = (ref) => uat.items.find((i) => {
      if (ref.k !== undefined && Number(i.k) === Number(ref.k)) return true;
      const name = usableName(i);
      return name !== null && name === usableName(ref);
    });
    // skipped conflicts with a recorded result, rejected resolves to no usable item
    let auto = 0, gaps = 0, added = 0, skipped = 0, rejected = 0;
    // collected as they're counted: accepted findings live on their items, these would be gone
    const rejectedEntries = [];
    const skippedEntries = [];
    for (const p of f.passes || []) {
      const it = find(p);
      if (it && it.status === 'pending') {
        it.status = 'pass'; it.source = 'verifier';
        if (p.evidence) it.evidence = p.evidence;
        if (it.first_pass === undefined) it.first_pass = 'pass';
        auto++;
      } else if (it) {
        skipped++;
        skippedEntries.push({ list: 'passes', reason: 'already-recorded',
          item: Number(it.k), status: String(it.status), entry: p });
      } else {
        rejected++; // nothing to apply it to
        rejectedEntries.push({ list: 'passes', reason: 'no-matching-item', entry: p });
      }
    }
    let k = Math.max(0, ...uat.items.map((i) => Number(i.k)));
    for (const g of f.gaps || []) {
      const it = find(g);
      if (it && it.status === 'pending') {
        it.status = 'fail'; it.source = 'verifier';
        if (g.reason) it.reported = g.reason;
        if (g.evidence) it.evidence = g.evidence;
        it.severity = g.severity || 'major';
        if (it.first_pass === undefined) it.first_pass = 'fail';
        gaps++;
      } else if (it) {
        skipped++;
        skippedEntries.push({ list: 'gaps', reason: 'already-recorded',
          item: Number(it.k), status: String(it.status), entry: g });
      } else {
        const name = usableName(g);
        // gaps counts what got written, so a rejected entry can't inflate it
        if (!name) {
          rejected++;
          rejectedEntries.push({ list: 'gaps', reason: 'no-usable-name', entry: g });
          continue;
        }
        // source is set on existing items too, so only origin: verifier marks one the verifier added
        uat.items.push({ k: ++k, name, expected: g.expected || g.reason || '',
          origin: 'verifier',
          status: 'fail', source: 'verifier', severity: g.severity || 'major',
          ...(g.reason ? { reported: g.reason } : {}),
          ...(g.evidence ? { evidence: g.evidence } : {}), first_pass: 'fail' });
        gaps++; added++;
      }
    }
    for (const h of f.human_checks || []) {
      const match = find(h);
      if (match) {
        // no counter moves, the gap stays open, but the row still goes in FINDINGS.json so nothing discarded disappears
        skippedEntries.push({ list: 'human_checks', reason: 'already-recorded',
          item: Number(match.k), status: String(match.status), entry: h });
        continue;
      }
      const name = usableName(h);
      if (!name) {
        rejected++; // would append the same phantom, at pending
        rejectedEntries.push({ list: 'human_checks', reason: 'no-usable-name', entry: h });
        continue;
      }
      // no invented why_human default, a made-up reason reads as judged right when the walk trusts it most
      uat.items.push({ k: ++k, name, expected: h.expected || '',
        origin: 'verifier',
        ...(h.why_human ? { why_human: h.why_human } : {}),
        status: 'pending' });
      added++;
    }
    writeUat(dir, n, uat);
    // own file, not a UAT.md section: the next uat record would drop a "## Verifier findings" block and look durable
    // written on every successful merge, even all-zero, so no file means no merge ran
    const findingsRel = `phases/${n}/records/FINDINGS.json`;
    let findingsError = null;
    try {
      // under --dir like uatFile, or a temp-tree merge writes into the cwd
      const records = ensurePhaseRecordsDir(join(dir, 'phases', String(n)));
      atomicWrite(join(records, 'FINDINGS.json'),
        `${JSON.stringify({ auto_passed: auto, gaps, added, skipped, rejected,
          rejected_entries: rejectedEntries, skipped_entries: skippedEntries }, null, 2)}\n`);
    } catch (e) {
      // reported, not thrown: a throw would lose the counters after writeUat already rewrote UAT.md,
      // and the retry would persist an envelope saying every finding conflicted
      findingsError = e instanceof Error ? e.message : String(e);
    }
    return ok({ auto_passed: auto, gaps, added, skipped, rejected,
      findings: findingsError === null ? findingsRel : null,
      ...(findingsError !== null ? { findings_error: findingsError } : {}),
      next: nextPending(uat.items) });
  }

  if (sub === 'status') {
    const uat = loadUat(dir, n);
    if (!uat) return;
    const complete = uatComplete(uat);
    return ok({
      status: uat.status, counts: uat.counts,
      ...(uat.fm.ci ? { ci: uat.fm.ci } : {}),
      result: complete ? 'complete' : 'partial',
      ...(nextPending(uat.items) ? { first_pending: nextPending(uat.items) } : {}),
    });
  }

  return fail('usage', 'uat <init|refresh|record|merge|status>');
}

export { cmdUat };
