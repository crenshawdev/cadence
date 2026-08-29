// @ts-check
// planning/reads.mjs - `reads`: the in-dispatch companion to `trace render`.
'use strict';

import { fail, ok, readReadsRecords } from './core.mjs';
import { inDispatchReads, joinReads, summarizeReads } from '../lib/read-trace.mjs';
import { renderTrace } from '../lib/trace.mjs';

// reads - the in-dispatch companion to `trace render`. `trace.jsonl` records
// what a dispatch was HANDED; `reads.jsonl` records what it went and opened
// afterwards, which measured ~88% of a run's tokens on this repo and had no
// reader at all. Absent file is ok:true with zeroes - a project that has not
// run since the hook was installed has nothing to report, and that is not an
// error.
function cmdReads(dir, opts) {
  const { status, records, file, rotated } = readReadsRecords(dir);
  // WHICH record these figures came off, and whether it was CUT. One nested
  // key spelled the same on both faces `readReadsRecords` serves, so a reader
  // has no per-envelope special case to learn - and nested rather than two top
  // level keys because `trace suggest`'s envelope already spends `file` on the
  // TRACE path and `rotated` on the trace's own size-bound cut (D-04). A second
  // top-level `rotated` would make one key mean two records and silently
  // falsify `workflows/suggest.md`'s sentence about it.
  //
  // Not `warnings[]`: that channel means a partial or failed read that degraded
  // the answer, and a rotation degraded nothing. It is a fact about the span of
  // the record these figures cover, and `/cad-report` would otherwise present a
  // routine cut as a warning.
  const reads = { file, ...(rotated ? { rotated } : {}) };
  // It rides the ABSENT arm too: the command was asked which record it read,
  // and a record that is not there yet is still a named path.
  if (status === 'absent') return ok({ calls: 0, distinct: 0, redundancy: null, fileCalls: 0, distinctFiles: 0, fileTouches: 0, fileRedundancy: null, byAgent: [], byTool: [], topTargets: [], topFiles: [], note: 'no reads recorded yet', reads });
  // UNREADABLE stays a failure, unchanged. This is the single production site
  // of that arm: swallowing an EACCES here would change `reads`'s contract with
  // nothing red, and `/cad-report`'s Reading line would go quiet as though the
  // project had opened no files at all.
  if (status === 'unreadable') {
    return fail('read-failed', `cannot read ${file}`,
      'make that file readable, or move it aside if it is corrupt - until then this seam has no'
      + ' figures at all, and it is not reporting that the project opened no files');
  }
  const summary = summarizeReads(records);
  // Without `--join` the envelope is what it has always been, including the
  // `no reads recorded yet` arm above, which returns before this line: a
  // reader that never asked for the join must not have to parse around it.
  //
  // WHOLE record, no phase scoping. `reads.jsonl` has none - it is one file
  // per project - and the brackets it joins to therefore have to span every
  // phase, or a read caused by phase 3 would report unjoined while phase 3's
  // bracket sat one scope away.
  if (!('join' in opts)) return ok({ ...summary, reads });
  const j = joinReads(records, renderTrace(dir).brackets);
  // SIX figures, not one ratio. `joined` and `unjoined` are the join working
  // and not working; `ambiguous` is it declining to guess between overlapping
  // same-role brackets; `floor` is the permanent limit (`fork` and
  // `general-purpose` are HOST agent types with no dispatch event, ever);
  // `coordinator` is the main thread, which has no worker bracket by
  // construction; `unresolved` is a record whose `agent` field was absent or
  // named no role. Collapsing any of them into `unjoined` reports a limit as
  // a failure, which is exactly the distinction the join exists to make.
  return ok({
    ...summary,
    reads,
    joined: j.joined,
    ambiguous: j.ambiguous,
    unjoined: j.unjoined,
    floor: j.floor,
    coordinator: j.coordinator,
    unresolved: j.unresolved,
    // The per-role IN-DISPATCH figures, off the same fold `trace suggest`
    // calls, so `/cad-report` and `/cad-suggest` price re-reading off ONE
    // implementation and neither recomputes it in prose (RDX-01).
    //
    // Its own key rather than folded into `topFiles`: that one is whole-corpus
    // and per-file, these are per-dispatch and per-role, and pooling two
    // different denominators under one heading is the category error
    // `summarizeReads`'s own header warns about for `redundancy` versus
    // `fileRedundancy`.
    inDispatch: inDispatchReads(j.rows),
  });
}

export { cmdReads };
