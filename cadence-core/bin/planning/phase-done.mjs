// @ts-check
// planning/phase-done.mjs - `phase-done`, the two status flips verify.md owns (and undo reverses)
// it flips phase N's ROADMAP box and its traceability rows in one call and names exactly what changed
// deferred rows are never touched unless --reqs names them
// every edit is decided before the first write, so a malformed sibling leaves the tree at its old state under ok:false and not half-flipped
'use strict';

import { existsSync, statSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fail, ok, read } from './core.mjs';
import { captureHealth } from '../lib/capture-health.mjs';
import { runTransition } from '../lib/file-transition.mjs';
import {
  atomicWrite, parseRequirements, setPhaseBox, setReqStatus,
} from '../lib/planning-files.mjs';
import { requirePhaseArg } from '../lib/require-int.mjs';
import { emit } from '../lib/seam-io.mjs';

function cmdPhaseDone(dir, opts) {
  // `--n "$PHASE"` with the variable unset reaches parseArgs as a valueless flag, which mints the boolean true, and Number(true) === 1 boxed the first phase complete with ok:true
  // requirePhaseArg refuses that and every other non-numeric shape before anything is read
  // .value and not .raw: setPhaseBox, the r.phase === n filter and the unknown-phase message all take a number, and the raw spelling would regress `--n 02` to unknown-phase while `--n 2.1` has to keep boxing the 2.1 phase
  const parsedPhase = requirePhaseArg(opts.n);
  if (!parsedPhase.ok) {
    return fail('bad-args', 'phase-done needs --n <phase>',
      'pass --n <phase> naming the phase to close, then re-run; a `--n "$PHASE"` with the variable'
      + ' unset reaches here as a flag with no value');
  }
  const n = parsedPhase.value;
  // an explicit --reqs means exactly these rows. An empty one is almost always an unset variable, and treating it as absent would silently widen to every non-Deferred row of the phase, so it fails
  let namedReqs = null;
  if ('reqs' in opts) {
    if (typeof opts.reqs !== 'string') {
      return fail('bad-args', 'phase-done --reqs needs a comma-separated id list',
        'spell it --reqs "ABC-01,ABC-02", or drop the flag to close every non-Deferred row of'
        + ' this phase');
    }
    namedReqs = opts.reqs.split(',').map((s) => s.trim()).filter(Boolean);
    if (!namedReqs.length) {
      return fail('bad-args', 'phase-done --reqs is empty; omit it to close the whole phase',
        'name the ids you mean, or drop --reqs entirely - an empty value here is almost always an'
        + ' unset shell variable, and guessing which you meant would flip rows you never named');
    }
  }
  const undo = 'undo' in opts;
  const roadmapFile = join(dir, 'ROADMAP.md');
  const roadmapText = read(roadmapFile);
  if (roadmapText === null) {
    return fail('no-roadmap', `${roadmapFile} not found`,
      'point --dir at the .planning/ directory that holds ROADMAP.md, or run /cad-new-project if'
      + ' this project has no roadmap yet');
  }
  const boxed = setPhaseBox(roadmapText, n, !undo);
  if (!boxed) {
    return fail('unknown-phase', `no "**Phase ${n}:**" line under ## Phases`,
      "re-run with a phase number that appears in ROADMAP.md's `## Phases` list, or add the phase"
      + ' there first');
  }

  // REQUIREMENTS.md is a three-state fact (absent, present but unreadable, read) because read() answers null for the first two alike
  // with REQUIREMENTS.md as a directory this used to return ok:true at exit 0, roadmap boxed and the traceability rows silently unwritten
  // absent keeps the old path: no REQUIREMENTS step and reqs: [], since a project that never kept one must still be able to close a phase. Unreadable refuses the whole transition below
  // unreadable is decided from the file's shape and not from whether reading threw: readFileSync blocks forever on a FIFO and reads /dev/null as '', so neither would reach the refusal. release-bump's readChangelog had the same bug
  const reqFile = join(dir, 'REQUIREMENTS.md');
  const reqPresent = existsSync(reqFile);
  let reqRegular = false;
  if (reqPresent) {
    try { reqRegular = statSync(reqFile).isFile(); } catch { reqRegular = false; }
  }
  const reqText = reqRegular ? read(reqFile) : null;
  const reqUnreadable = reqPresent && reqText === null;
  let reqs = [];
  let newReqText = null;
  if (reqText !== null) {
    const rows = parseRequirements(reqText);
    const ids = namedReqs
      ?? rows.filter((r) => r.phase === n && r.status !== 'Deferred').map((r) => r.id);
    const res = setReqStatus(reqText, ids, undo ? 'Pending' : 'Complete');
    reqs = res.changed;
    newReqText = res.text;
  }

  // the close asserts the capture queue is empty and doesn't empty it: an item leaves at the gate that declined to fix it
  // so this reports what's left, and a non-empty queue is a named problem and never a refusal, since a phase's completion is a fact about the work and not about this file
  // read before the transition runs so the result can't depend on which documents are already written. An absent queue is empty and an unopenable one is `unread` and closes anyway; capture-check is where it gets a reason
  const capture = undo ? null : readQueue(join(dir, 'CAPTURE.md'));

  // one ordered step list, stopped at the first failure: ROADMAP.md, then REQUIREMENTS.md when there's one to write
  // keyed by document name and not the joined path, because that's what the envelope reports
  // the preflight is what makes "nothing was written" true: an atomic rename protects one file and can't make two change together, and the transition has no undo, so once ROADMAP.md lands there's nothing to roll back to
  // satisfied answers from a value already in hand and does no I/O, so it can't throw past runTransition, which has no arm for that
  /** @type {Array<[string, () => void]>} */
  const steps = [['ROADMAP.md', () => atomicWrite(roadmapFile, boxed.text)]];
  if (newReqText !== null) steps.push(['REQUIREMENTS.md', () => atomicWrite(reqFile, newReqText)]);
  const applied = runTransition({
    steps,
    discipline: 'stop-at-first-failure',
    preflight: [{
      condition: `${reqFile} must be a readable file, or absent`,
      satisfied: () => !reqUnreadable,
    }],
  });
  if (applied.refused !== null) {
    return fail('unreadable-requirements', applied.refused,
      'make REQUIREMENTS.md a readable regular file and re-run - nothing was written, so ROADMAP.md'
      + ' is byte-identical and the close starts over cleanly');
  }
  if (!applied.ok) {
    // these are the shapes no readability check can see (EACCES on .planning, a symlink planted at atomicWrite's temp path, ENOSPC), so the preflight doesn't pretend to cover them
    // emitted directly and not through fail(), like cmdRenumber's partial arm: fail carries reason/detail/hint only and this arm needs the write record too
    // the dispatch-level catch would flatten it to {"ok":false,"reason":"internal"} with no record of which document moved
    const e = applied.failures[0].error;
    return emit({
      ok: false, reason: 'partial-flip', wrote: applied.completed,
      detail: e && e.message ? e.message : String(e),
      hint: applied.completed.length
        ? `${applied.completed.join(' and ')} was written and the rest was not - the phase box and its traceability rows now disagree; re-run this command once the cause is fixed, which is the repair and is safe to repeat, because both writes set the same value on a second pass`
        : 'nothing was written - the first step failed, so the tree is unchanged and safe to re-run once the cause is fixed',
    });
  }
  // wrote is the transition's completed record: document names in write order, so a caller can tell "both moved" from "only the roadmap did" without re-deriving it from reqs
  // it's a new field so nothing existing changes meaning, and reqs stays the ids setReqStatus changed and never becomes null, because /cad-verify and /cad-undo read it
  // capture is new too and rides the close arm only: reopening a phase says nothing about the queue, so --undo omits it
  ok({ roadmap: { line: boxed.line, now: undo ? '[ ]' : '[x]' }, reqs, wrote: applied.completed,
    ...(capture ? { capture } : {}) });
}

/**
 * The capture queue at close: `{substantive, items}` when it could be read or is absent, `{unread: true}` when it is present and couldn't be.
 *
 * The unread arm carries no fs message on purpose: the close only needs to know, and `capture-check` refuses that file with a detail and a hint.
 * @param {string} file
 * @returns {{substantive: number, items: Array<{section: string, line: number, text: string}>}
 *   | {unread: true}}
 */
function readQueue(file) {
  /** @type {string} */
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch (e) {
    // absence is data, as everywhere in this seam: no CAPTURE.md means an empty queue
    if (e && /** @type {any} */ (e).code === 'ENOENT') return { substantive: 0, items: [] };
    return { unread: true };
  }
  const health = captureHealth(text);
  return { substantive: health.substantive, items: health.items };
}

export { cmdPhaseDone };
