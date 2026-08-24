// @ts-check
// planning/phase-done.mjs - `phase-done`, the two status flips verify.md owns
// (and undo reverses). Flips phase N's ROADMAP box and its traceability rows in
// one call; output names exactly what changed. Deferred rows are never touched
// unless named explicitly via --reqs.
//
// Every edit is decided before the first write (JRN-02), so a malformed sibling
// leaves the tree at its old state under ok:false rather than half-flipped.
'use strict';

import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fail, ok, read } from './core.mjs';
import { runTransition } from '../lib/file-transition.mjs';
import {
  atomicWrite, parseRequirements, setPhaseBox, setReqStatus
} from '../lib/planning-files.mjs';
import { requirePhaseArg } from '../lib/require-int.mjs';
import { emit } from '../lib/seam-io.mjs';

function cmdPhaseDone(dir, opts) {
  // `--n "$PHASE"` with the variable unset reaches parseArgs as a valueless
  // flag, which mints the boolean `true` - and `Number(true) === 1` boxed
  // phase 1 complete and flipped its traceability rows, ok:true. requirePhaseArg
  // refuses that shape (and every non-numeric one) before anything is read.
  // `.value`, not `.raw` (D-11): setPhaseBox, the `r.phase === n` row filter and
  // the unknown-phase message all take a number, and the raw spelling would
  // regress `--n 02` to unknown-phase while `--n 2.1` must keep boxing Phase 2.1.
  const parsedPhase = requirePhaseArg(opts.n);
  if (!parsedPhase.ok) {
    return fail('bad-args', 'phase-done needs --n <phase>',
      'pass --n <phase> naming the phase to close, then re-run; a `--n "$PHASE"` with the variable'
      + ' unset reaches here as a flag with no value');
  }
  const n = parsedPhase.value;
  // An explicit --reqs means "exactly these rows". An empty one is almost
  // always an unset variable (`--reqs "$IDS"`), and treating it as "flag
  // absent" would silently widen that to every non-Deferred row of the phase -
  // the opposite of the caller's intent - so it fails here instead.
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

  // REQUIREMENTS.md as a THREE-state fact - absent, present-but-unreadable,
  // present-and-read - because `read()` answers `null` for the first two alike
  // and that collapse is the defect: measured 2026-08-22, `phase-done --n 1`
  // against a tree where REQUIREMENTS.md was a DIRECTORY returned
  // `{"ok":true,...,"reqs":[]}` at exit 0 with the roadmap boxed and the
  // traceability rows silently unwritten. `read()` itself is not touched - its
  // callers throughout this file legitimately treat absence as data - and the
  // shape is `readManifest`'s in release-bump.mjs, which already separates
  // "no manifest" from "a manifest I cannot parse" for the same reason.
  //
  // ABSENT keeps today's path exactly: no REQUIREMENTS step, `reqs: []`,
  // ok:true. verify.md's phase-done step is a hard step, so a project that
  // never kept a REQUIREMENTS.md must still be able to close a phase (D-03).
  // UNREADABLE refuses the whole transition below.
  //
  // UNREADABLE is decided from the file's SHAPE, not from whether reading it
  // threw. `read()` wraps readFileSync, which does not throw on a FIFO (it
  // blocks forever with no writer) nor on a character device (/dev/null reads
  // as ''), so neither shape would ever reach the refusal the pre-flight below
  // advertises: one hangs before any envelope, the other reads '' as a genuine
  // requirements document and reports REQUIREMENTS.md as written. That is the
  // same defect the blocking review found at readChangelog, fixed there with
  // this check (`cadence-core/bin/release-bump.mjs`); the bar belongs on both
  // members of the write set, not one.
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

  // ONE ordered step list, stopped at the first failure: ROADMAP.md, then
  // REQUIREMENTS.md when there is one to write. The key on each step is the
  // DOCUMENT NAME rather than the joined path, because that key is what the
  // envelope reports and a caller reading it wants the document, not the
  // fixture's temp directory. The order is load-bearing and is the one this
  // seam has always used.
  //
  // The PRE-FLIGHT is what makes "nothing was written" true, and it is the only
  // form of that promise this seam can keep: an atomic rename protects ONE file
  // from torn bytes and cannot make two files change together, and the
  // primitive underneath is a refusal protocol with no undo (D-01), so once
  // ROADMAP.md has landed there is nothing to roll back to. The refusal
  // therefore has to happen BEFORE the first thunk runs - which is what makes
  // an unreadable REQUIREMENTS.md leave ROADMAP.md byte-identical instead of
  // boxed-and-then-reported-as-an-error. `satisfied` answers from a value
  // already in hand and performs no I/O of its own (D-12), so it cannot throw
  // past runTransition, which has no arm for that.
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
    // The shapes that reach here are the ones NO readability check can see - an
    // EACCES on `.planning` itself, a symlink planted at atomicWrite's derived
    // temp path, ENOSPC - which is why the pre-flight above deliberately does
    // not pretend to cover them: a refusal advertised for failures it cannot
    // deliver would talk callers out of checking the tree by hand.
    //
    // Emitted directly rather than through fail(), for the reason cmdRenumber
    // records for its own partial arm: fail() carries reason/detail/hint only,
    // and this arm has to carry the write record too. Letting it reach the
    // dispatch-level catch instead would flatten it to
    // `{"ok":false,"reason":"internal"}` with no record of which document moved
    // - the undifferentiated envelope this whole change exists to remove.
    const e = applied.failures[0].error;
    return emit({
      ok: false, reason: 'partial-flip', wrote: applied.completed,
      detail: e && e.message ? e.message : String(e),
      hint: applied.completed.length
        ? `${applied.completed.join(' and ')} was written and the rest was not - the phase box and its traceability rows now disagree; re-run this command once the cause is fixed, which is the repair and is safe to repeat, because both writes set the same value on a second pass`
        : 'nothing was written - the first step failed, so the tree is unchanged and safe to re-run once the cause is fixed',
    });
  }
  // `wrote` is the transition's own completed record rendered into the
  // envelope: the document names, in write order, so a caller can tell "both
  // documents moved" from "only the roadmap did" without re-deriving it from
  // `reqs`. It is a NEW field precisely so nothing existing has to carry that
  // meaning (D-04): `roadmap.{line,now}` and `reqs` keep the shape and contents
  // they have always had - `reqs` stays the ids setReqStatus reported changed
  // and never becomes `null` to mean "not written", because /cad-verify and
  // /cad-undo read it and planning.test.mjs deep-equals it across nine cases.
  ok({ roadmap: { line: boxed.line, now: undo ? '[ ]' : '[x]' }, reqs, wrote: applied.completed });
}

export { cmdPhaseDone };
