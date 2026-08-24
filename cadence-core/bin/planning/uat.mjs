// @ts-check
// planning/uat.mjs - `uat`: the per-phase UAT checklist, its five subcommands
// (init | refresh | record | merge | status) and the file they all address.
//
// The checklist reader, writer and pending-item picker (`uatFile`, `loadUat`,
// `writeUat`, `nextPending`) and the two value vocabularies (`UAT_RESULTS`,
// `UAT_TEXT_FIELDS`) are reached from nowhere else, so under phase 4's D-05
// partition they live beside the handler rather than in planning/core.mjs.
'use strict';

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fail, ok, read, readJsonPayload } from './core.mjs';
import {
  UAT_FIELDS_VERSION, UAT_ORIGINS, UAT_SOURCES, atomicWrite, parseUat, renderUat,
  uatComplete,
} from '../lib/planning-files.mjs';
import { requireInt, requirePhaseArg } from '../lib/require-int.mjs';
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

// `pending` is legal for a user re-record: a fixed failure goes back to
// pending (with fix: "<hash>, retest") so the walk retests it. first_pass is
// untouched by that reset - it only ever records the first pass/fail verdict.
const UAT_RESULTS = ['pass', 'fail', 'skipped', 'blocked', 'pending'];

// The FREE-TEXT half of `uat record`'s fields, and exactly what `--fields-file`
// may carry. Every other field the subcommand takes is validated against a
// closed enum, an `AC<N>` shape or an integer grammar at its own guard, so it is
// not caller-derived prose and gains nothing from a path transport - and
// admitting one here would route it around the guard that validates it.
const UAT_TEXT_FIELDS = ['reason', 'reported', 'cause', 'fix', 'evidence'];

function cmdUat(dir, sub, opts) {
  // The shared reader, replacing a bare `Number()` + NaN test: a malformed
  // `--phase` is now refused in the same words on every seam, and `n` is the
  // caller's own SPELLING - every use of it here is a path (`uatFile`, the
  // FINDINGS.json path) or a label (`fm.phase`), never arithmetic, so
  // `--phase 1.10` reads `phases/1.10` instead of phase 1.1's checklist.
  const parsedPhase = requirePhaseArg(opts.phase);
  if (!parsedPhase.ok) {
    return fail('bad-args', 'uat needs --phase <N>',
      'pass --phase <N> naming the phase whose checklist this call touches, then re-run');
  }
  const n = parsedPhase.raw;

  if (sub === 'init' || sub === 'refresh') {
    // stdin only - `--payload` is merge's flag. A literal `null` on stdin now
    // reaches the Array.isArray guard below and is refused `bad-payload`,
    // where the old sentinel-collision reader exited 0 printing nothing.
    const payload = readJsonPayload();
    if (!payload.ok) return;
    const items = payload.value;
    if (!Array.isArray(items) || items.some((i) => !i || !i.name || !i.expected)) {
      return fail('bad-payload', 'expected a JSON array of {name, expected}',
        'send an ARRAY, and give every element both a `name` and an `expected` - fix the step that'
        + ' composed the payload and send it again');
    }
    // The traceability fields are OPTIONAL but validated before any write, so a
    // typo lands as a named refusal rather than as an item whose `criterion`
    // names nothing (which `criteria-coverage` would then report as
    // `unknown_criterion` on a file already on disk).
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
    // Carried onto the item by BOTH arms. `origin` is never derived from the
    // presence of `criterion`: a present `criterion` is itself the
    // criterion-derived marker, and fabricating a second one would put this
    // seam's output out of step with the four backfilled checklists (D-16).
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
        // `fields_version` is written unconditionally, before any item is
        // considered: it marks the FILE as post-field, so a payload that
        // carries no `criterion` at all can never be mistaken for a checklist
        // that predates the field.
        fm: { status: 'testing', phase: String(n), fields_version: UAT_FIELDS_VERSION,
          started: today, updated: today,
          ...(opts.sources ? { sources: opts.sources } : {}) },
        items: items.map((it, i) => build(it, i + 1)),
      };
      writeUat(dir, n, uat);
      return ok({ file: uatFile(dir, n), items: uat.items.length, next: nextPending(uat.items) });
    }
    // refresh: append only items whose name matches nothing existing; never
    // touch a recorded result. It carries the same fields `init` does, in
    // LOCKSTEP with it (D-06): `verify.md` routes every re-run of a phase
    // through refresh, so an arm that dropped them would make any phase
    // verified across two sessions untraceable even with init right.
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
    // A valueless `--item` parses as the boolean `true` and `Number(true)` is 1,
    // so `--item "$K"` with K unset recorded a result against item 1 - and the
    // set-once `first_pass` invariant then makes that verdict permanent. Refused
    // before the lookup, alongside the `--result`/`--source`/`--origin` guards
    // below rather than in place of them. A clean integer naming no item keeps
    // today's `unknown-item` answer: "you named no item" and "that item is not
    // here" are different repairs.
    const parsedItem = requireInt(opts.item);
    if (!parsedItem.ok) {
      return fail('bad-args', 'uat record needs --item <k>',
        "pass --item <k> using the item's number from this phase's UAT.md, then re-run; a"
        + ' `--item "$K"` with the variable unset arrives here as a flag with no value');
    }
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
    // Validated BEFORE any write, same shape as the `--origin` guard below:
    // `--source` used to accept any string and store nothing outside
    // `verifier`, so a walk-executed pass recorded as a user answer and
    // nothing reported the drop. An out-of-enum value must leave the file
    // byte-unchanged rather than silently discard the provenance.
    if (opts.source !== undefined && !UAT_SOURCES.includes(String(opts.source))) {
      return fail('bad-args', `--source must be one of: ${UAT_SOURCES.join(' | ')}`,
        "send one of the values the detail lists, or drop --source to record this as the user's own"
        + ' answer; nothing was written');
    }
    // Invariant: a verifier result only ever fills a pending item.
    //
    // Scoped to `verifier` ALONE, deliberately. A `model` result is a live
    // answer at the item the walk is standing on, and widening the guard to it
    // would refuse the retest re-record `route_failures` depends on.
    if (source === 'verifier' && item.status !== 'pending') {
      return fail('would-overwrite', `item ${k} is ${item.status}; verifier results only fill pending items`,
        'leave the recorded result standing - it is a human answer this seam will not overwrite. If'
        + ' it is genuinely wrong, re-record the item yourself without --source verifier');
    }
    // Validated BEFORE any write: `--origin` is the after-the-fact repair for
    // an item whose provenance was never declared, so an out-of-enum value must
    // leave the file byte-unchanged rather than record a marker nothing reads.
    if (opts.origin !== undefined && !UAT_ORIGINS.includes(opts.origin)) {
      return fail('bad-args', `--origin must be one of: ${UAT_ORIGINS.join(' | ')}`,
        'send one of the values the detail lists, or drop --origin; nothing was written, so UAT.md'
        + ' is byte-unchanged');
    }
    // `--criterion` is the repair for a link that was never written or was lost,
    // and it is where the `fieldless-checklist` diagnostic routes users. Same
    // `^AC\d+$` test `uat init` applies at the payload face, so the two cannot
    // drift - a flag given with no value parses as boolean `true` and is refused
    // by it too. Validated BEFORE any write: a rejected value leaves the file
    // byte-unchanged rather than recording a marker nothing reads.
    //
    // The repair also needs `--result`: record has no field-only mode, so
    // re-recording the item's CURRENT status is the repair form. Without this
    // flag the diagnostic would have to route users to `--origin`, which on a
    // fieldless checklist writes `origin: criterion` - a value naming no id,
    // which disqualifies the phase from the legacy rule, converts zero breaks
    // into one per criterion, and leaves no seam able to add `criterion` back.
    if (opts.criterion !== undefined && !/^AC\d+$/.test(String(opts.criterion))) {
      return fail('bad-args', `--criterion must be AC<N> (got: ${opts.criterion})`,
        "spell it --criterion AC<N>, matching an acceptance-criterion id in this phase's CONTEXT.md"
        + ' - a flag given with no value arrives here as `true` and is refused the same way');
    }
    // `--fields-file`: the FREE-TEXT fields through the path transport, because
    // every one of them is caller-derived - a failing item's reason, what the
    // user reported, the cause, the fix, the evidence - and the inline form puts
    // that prose inside a double-quoted shell word where `$(...)` executes
    // before Node starts (lib/text-flag-file.mjs, references/conventions.md).
    //
    // ONE flag holding a JSON OBJECT, never per-field `-file` flags (D-05):
    // verify.md passes two or three text flags on a single call, so per-field
    // files would cost up to three extra Write calls per failed item on the one
    // workflow whose per-item round-trip discipline is explicit.
    //
    // A key outside the five is REFUSED, never dropped. `severity`, `origin`,
    // `criterion`, `result` and `source` are enum-validated at their own guards
    // above, so admitting them here would either bypass those guards or
    // silently discard a field the caller believes was recorded. Every refusal
    // lands BEFORE any mutation of the item, so a rejected call leaves UAT.md
    // byte-unchanged - the standing posture at those same guards.
    const resolvedFields = resolveTextFlag(opts, 'fields', 'uat record');
    if (!resolvedFields.ok) {
      return fail('bad-args', resolvedFields.detail,
        'pass the free-text fields inline or through --fields-file <path>, never both, and point'
        + ' --fields-file at a readable, non-empty file');
    }
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
        // The same refusal the reader makes for one flag's two forms, per FIELD:
        // a precedence rule would silently discard one of two values the caller
        // believes was recorded.
        if (opts[key] !== undefined) {
          return fail('bad-args',
            `uat record takes "${key}" inline or in --fields-file, never both`,
            'remove the key from --fields-file, or drop the inline flag - keeping both would'
            + ' silently discard one of the two values you believe was recorded');
        }
      }
      fileFields = payload;
    }
    item.status = opts.result;
    // `user` stays IMPLICIT - never written onto the item - so every existing
    // checklist stays byte-identical; `verifier` and `model` are the two values
    // that render.
    if (source !== 'user') item.source = source;
    // `criterion` is already registered in UAT_FIELDS, so an accepted value
    // renders directly after `expected` and survives every later rewrite.
    for (const [flag, field] of [['reason', 'reason'], ['reported', 'reported'],
      ['severity', 'severity'], ['cause', 'cause'], ['fix', 'fix'], ['evidence', 'evidence'],
      ['origin', 'origin'], ['criterion', 'criterion']]) {
      // The file form feeds THIS loop and nothing else, so an identical value
      // through either transport writes a byte-identical UAT.md.
      const value = opts[flag] !== undefined ? opts[flag] : fileFields[flag];
      if (value !== undefined) item[field] = value;
    }
    // Invariant: first_pass is the FIRST pass/fail verdict, set once, never after.
    if (item.first_pass === undefined && (opts.result === 'pass' || opts.result === 'fail')) {
      item.first_pass = opts.result;
    }
    writeUat(dir, n, uat);
    const parsed = parseUat(read(uatFile(dir, n)) || '');
    return ok({ item: { k, status: item.status }, counts: parsed.counts, next: nextPending(uat.items) });
  }

  if (sub === 'merge') {
    // Verifier findings: {passes:[{k|name, evidence}], gaps:[{k|name, reason,
    // evidence?}], human_checks:[{name, expected}]}. Fills only pending items.
    //
    // Merge is PARTIAL-SUCCESS, deliberately unlike init/refresh (which reject
    // a whole payload on one bad element): an unusable entry is set aside and
    // counted, the rest merges. verify-deep's deep pass is an accelerator,
    // never a gate - the strict form would discard twenty good findings over
    // one nameless gap. Two counts, always present even at zero:
    //   skipped  - the finding conflicts with an already-recorded result. The
    //              invariant stands; the drop just stops being silent.
    //   rejected - the entry resolves to no usable item at all, so it can
    //              never be applied to one or appended as one.
    //
    // The ENVELOPE is all-or-nothing even though the entries inside it are
    // partial-success, and both refusals land BEFORE loadUat and before any
    // write, so a refused merge leaves UAT.md and FINDINGS.json byte-identical.
    // Without the array test below, `"hello"` and `{}` both merged as an
    // all-zero ok:true success - so a truncated findings file reported a clean
    // deep pass instead of falling through to the walk, which is the one
    // outcome the deep pass must never be able to fake.
    const payload = readJsonPayload(opts.payload);
    if (!payload.ok) return;
    const f = payload.value;
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
    // ...and every list that IS present must be an array. The disjunction above
    // only proves ONE of them is, so a sibling holding a string used to reach
    // the `for..of` below and be iterated per CHARACTER: `{"passes":[],
    // "gaps":"oops"}` merged ok:true with rejected:4. No phantom item was
    // written - the usableName guard drops each character - but the deep pass
    // reported a merge instead of falling through, which is the one outcome it
    // must never be able to fake. Check presence, not truthiness: a payload may
    // legitimately omit a list, and `undefined` is not a malformed one.
    for (const key of ['passes', 'gaps', 'human_checks']) {
      if (f[key] !== undefined && !Array.isArray(f[key])) {
        return fail('bad-payload', `${key} is present but not an array`,
          'make that key an array in the findings payload, or remove it - anything else there is'
          + ' iterated per character and would report a merge that never happened');
      }
    }
    const uat = loadUat(dir, n);
    if (!uat) return;
    // Guard the shape the CONSUMER accepts - a name that renders a heading -
    // not the reported input. Without it an entry carrying neither a matching
    // `k` nor a name was appended as `### N. undefined`, a phantom at status
    // fail/pending that blocks phase completion permanently.
    const usableName = (e) => (typeof e.name === 'string' && e.name.trim() ? e.name.trim() : null);
    // Match through the SAME normalizer the append path uses. Matching raw
    // (`i.name === ref.name`) while appending trimmed meant a ref named
    // `Login works ` missed the stored `Login works` and appended a
    // byte-identical duplicate that no later merge could reach by name - so
    // its fail/pending status blocked uatComplete permanently. That is the
    // phantom usableName exists to prevent, reached from the read side.
    // A null name matches nothing: an unnamed ref stays rejected rather than
    // colliding with the first item.
    const find = (ref) => uat.items.find((i) => {
      if (ref.k !== undefined && Number(i.k) === Number(ref.k)) return true;
      const name = usableName(i);
      return name !== null && name === usableName(ref);
    });
    let auto = 0, gaps = 0, added = 0, skipped = 0, rejected = 0;
    // The DISCARDED entries, collected as they are counted (D-06). The counters
    // alone add nothing a transcript already had - `verify-deep.md` prints them
    // - and an ACCEPTED finding is recoverable from the item it wrote. The
    // unrecoverable material is exactly this: what was counted and then dropped.
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
        rejected++; // a pass matching no item can never be applied
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
        // `gaps` counts gaps actually recorded in the file, so a rejected
        // entry that wrote nothing must not inflate it - otherwise the
        // envelope reports three gaps found for one item written.
        if (!name) {
          rejected++;
          rejectedEntries.push({ list: 'gaps', reason: 'no-usable-name', entry: g });
          continue;
        }
        // `origin: verifier` is the item-level provenance `source: verifier` is
        // not: source records where a RESULT came from and is set identically on
        // an existing pending item above, so it cannot mark an item the verifier
        // ADDED (D-12). Without this the reverse-direction exemption would
        // swallow nearly every item in every shipped checklist.
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
        // The COUNTING gap here (an entry matching an existing item lands in
        // neither `skipped` nor `rejected`) is deferred to its own phase (D-14)
        // and stays open: no counter moves on this line. The ENTRY is recorded
        // anyway, with the same `already-recorded` reason, because a file whose
        // whole purpose is making a discarded finding recoverable must not be
        // the one place a discarded finding disappears. So this row is present
        // in FINDINGS.json while absent from the `skipped` count, deliberately.
        skippedEntries.push({ list: 'human_checks', reason: 'already-recorded',
          item: Number(match.k), status: String(match.status), entry: h });
        continue;
      }
      const name = usableName(h);
      if (!name) {
        rejected++; // appends the identical phantom, at pending
        rejectedEntries.push({ list: 'human_checks', reason: 'no-usable-name', entry: h });
        continue;
      }
      // This path wrote NO provenance of any kind before this phase - observable
      // at .planning/phases/1/UAT.md items 12 and 14, which carry neither
      // `source` nor an origin.
      //
      // `why_human` rides the append spread-guarded: the verifier's per-item
      // reason inspection cannot settle it, carried so the walk can tell an
      // item ALREADY judged human-only from one it must judge itself against
      // the stated bar. An omitted value writes no line and no default is
      // invented - a fabricated reason would be indistinguishable from a
      // judged one at exactly the moment the walk is trusting it.
      uat.items.push({ k: ++k, name, expected: h.expected || '',
        origin: 'verifier',
        ...(h.why_human ? { why_human: h.why_human } : {}),
        status: 'pending' });
      added++;
    }
    writeUat(dir, n, uat);
    // The findings envelope, persisted beside the phase's other artifacts
    // (D-05/D-09). A NEW file, never a UAT.md section: `parseUat`/`renderUat`
    // split on `^### ` and cut each part at `sectionBound`, so a
    // `## Verifier findings` block is silently dropped by the next `uat record`
    // - worse than not persisting, because it looks durable - and a `### `
    // extra is promised user-owned and verbatim by templates/UAT.md. Resolved
    // under the run's `--dir` exactly as `uatFile` is, never as a bare relative
    // path, or every merge on a temp tree would write into the process cwd.
    //
    // Written on EVERY successful merge, all-zero ones included, so its absence
    // means no merge ran. A second merge on the same phase overwrites it with
    // that merge's envelope: the deep pass is once per phase, and the envelope
    // is the merge's own return value, not an accumulating log.
    const findingsRel = `phases/${n}/FINDINGS.json`;
    let findingsError = null;
    try {
      atomicWrite(join(dir, 'phases', String(n), 'FINDINGS.json'),
        `${JSON.stringify({ auto_passed: auto, gaps, added, skipped, rejected,
          rejected_entries: rejectedEntries, skipped_entries: skippedEntries }, null, 2)}\n`);
    } catch (e) {
      // REPORTED, never thrown. A throw here unwinds to the dispatch catch,
      // which emits `{ok:false, reason:'internal'}` and takes the counters down
      // with it - AFTER writeUat has already rewritten UAT.md. The merge would
      // then be neither undone nor reported, and a retry would re-merge against
      // non-pending items and persist an envelope claiming every finding was a
      // conflict. Losing the counters to protect the file that exists to
      // preserve them is the wrong trade.
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
      result: complete ? 'complete' : 'partial',
      ...(nextPending(uat.items) ? { first_pending: nextPending(uat.items) } : {}),
    });
  }

  return fail('usage', 'uat <init|refresh|record|merge|status>');
}

export { cmdUat };
