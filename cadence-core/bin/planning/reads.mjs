// @ts-check
// planning/reads.mjs - `reads`: the in-dispatch companion to `trace render`.
'use strict';

import { fail, ok, readReadsRecords } from './core.mjs';
import { inDispatchReads, joinReads, summarizeReads } from '../lib/read-trace.mjs';
import { renderTrace } from '../lib/trace.mjs';

// reads.jsonl is what a dispatch opened after being handed its work, most of a run's tokens; an absent file is ok:true with zeroes, not an error
function cmdReads(dir, opts) {
  const { status, records, file, rotated } = readReadsRecords(dir);
  // nested under reads, not top-level: trace suggest already uses file and rotated for the trace, and one key can't mean two records
  // not warnings[]: a rotation degrades nothing, and /cad-report would show a routine cut as a warning
  const reads = { file, ...(rotated ? { rotated } : {}) };
  // the absent arm names the record too, even one that isn't there yet
  if (status === 'absent') return ok({ calls: 0, distinct: 0, redundancy: null, fileCalls: 0, distinctFiles: 0, fileTouches: 0, fileRedundancy: null, byAgent: [], byTool: [], topTargets: [], topFiles: [], note: 'no reads recorded yet', reads });
  // unreadable stays a failure: swallowing an EACCES here would change the contract with nothing red and make /cad-report's Reading line go quiet
  if (status === 'unreadable') {
    return fail('read-failed', `cannot read ${file}`,
      'make that file readable, or move it aside if it is corrupt - until then this seam has no'
      + ' figures at all, and it is not reporting that the project opened no files');
  }
  const summary = summarizeReads(records);
  // without --join the envelope is what it always was, absent arm included
  // whole record, no phase scoping: reads.jsonl is one file per project, so the brackets it joins to must span every phase
  if (!('join' in opts)) return ok({ ...summary, reads });
  const j = joinReads(records, renderTrace(dir).brackets);
  // six figures, not one ratio: floor (fork and general-purpose have no dispatch event, ever), coordinator and ambiguous are limits, and collapsing them into unjoined would report a limit as a failure
  return ok({
    ...summary,
    reads,
    joined: j.joined,
    ambiguous: j.ambiguous,
    unjoined: j.unjoined,
    floor: j.floor,
    coordinator: j.coordinator,
    unresolved: j.unresolved,
    // per-role in-dispatch figures, from the fold trace suggest calls; its own key because topFiles has a different denominator
    inDispatch: inDispatchReads(j.rows),
  });
}

export { cmdReads };
