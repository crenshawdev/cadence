// @ts-check
// planning/recall.mjs - `recall`: BM25 retrieval over the .planning/ artifacts
// Cadence writes and never read back.
'use strict';

import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PHASE_DIR_NAME, fail, memoryBackend, ok, read } from './core.mjs';
import { buildIndex, search } from '../lib/bm25.mjs';
import {
  parseArchiveRows, parseCaptureSnippets, parseContextDecisions, parseFiledRows,
  parseSummarySnippets, parseTaskRecordSnippets, parseUat,
} from '../lib/planning-files.mjs';
import { requireInt } from '../lib/require-int.mjs';
import { taskRecordsIn } from '../lib/task-record.mjs';

// deterministic (sorted traversal, total result order, no timestamps); an empty corpus is ok:true with results:[] because recall never blocks the spine
function cmdRecall(dir, query, opts) {
  if (!query) {
    return fail('bad-args', 'recall needs a query',
      'put the search words after the subcommand: `recall "<what you are looking for>"`');
  }

  // --top bounds the returned set, default 5: unbounded forced a second round trip when the host spooled the response; total shows when it's truncated
  let top = 5;
  if (opts.top !== undefined) {
    const parsed = requireInt(opts.top);
    if (!parsed.ok || parsed.value < 1) {
      return fail('bad-args', '--top must be a positive integer',
        'send --top as a whole number of 1 or more, or drop it to take the default 5 results');
    }
    top = parsed.value;
  }

  // the off switch, via the one reader in core: a successful check with a negative answer, like plan-overlap
  // warnings only when non-empty so output stays byte-stable: a torn layer reads memory.backend as absent, so a project set to none would start recalling again
  const { backend, warnings } = memoryBackend(dir);
  const warn = warnings.length ? { warnings } : {};
  if (backend === 'none') return ok({ backend: 'none', results: [], total: 0, ...warn });

  // fixed corpus order: phases ascending (decimal-aware), each SUMMARY, UAT, CONTEXT, then CAPTURE; the listing is guarded since an ENOENT would become fail('internal') and break the empty-corpus contract
  const corpus = [];
  const phasesDir = join(dir, 'phases');
  if (existsSync(phasesDir)) {
    // the grammar, not a looser numeric shape, or phases/08/ gets indexed as `phase: 8`; the name breaks the tie since Number('1.1') === Number('1.10')
    const entries = readdirSync(phasesDir)
      .filter((e) => PHASE_DIR_NAME.test(e))
      .sort((a, b) => (Number(a) - Number(b)) || (a < b ? -1 : a > b ? 1 : 0));
    for (const n of entries) {
      const pdir = join(phasesDir, n);
      // phase is the number the name parses to and source carries the name, since 1.1 and 1.10 share a number
      const phase = Number(n);
      const summary = read(join(pdir, 'SUMMARY.md'));
      if (summary) for (const text of parseSummarySnippets(summary)) {
        corpus.push({ text, source: `phases/${n}/SUMMARY.md`, phase });
      }
      const uatText = read(join(pdir, 'UAT.md'));
      if (uatText) for (const it of parseUat(uatText).items) {
        const text = `${it.name || ''} ${it.expected || ''}`.trim();
        if (text) corpus.push({ text, source: `phases/${n}/UAT.md`, phase });
      }
      const context = read(join(pdir, 'CONTEXT.md'));
      if (context) for (const text of parseContextDecisions(context)) {
        corpus.push({ text, source: `phases/${n}/CONTEXT.md`, phase });
      }
    }
  }
  const capture = read(join(dir, 'CAPTURE.md'));
  if (capture) for (const item of parseCaptureSnippets(capture)) {
    corpus.push({ text: item.text, source: 'CAPTURE.md',
      ...(item.phase !== undefined ? { phase: item.phase } : {}) });
  }
  // ARCHIVE.md goes last so appending leaves every corpus index alone: search orders by score then position, and a tree without it emits the same bytes as before
  // one flat ranking with the live rows, no recency term or cap; archived rows do crowd live hits, the accepted cost since each source names its milestone
  const archive = read(join(dir, 'ARCHIVE.md'));
  if (archive) for (const row of parseArchiveRows(archive)) corpus.push(row);

  // the tasks tier: /cad-task is where most real work goes, and it left the corpus a hole exactly there; last for the same position reason as ARCHIVE.md
  // no phase key: a task sits outside the phase spine, and recall.md forbids substituting an inferred one (a phase of 0 would collide with phases/0/)
  // taskRecordsIn is guarded and contained: an absent root or tasks/ is an empty list, and a slug or RECORD.md resolving outside the planning root is skipped
  for (const { slug, path } of taskRecordsIn(dir)) {
    const record = read(path);
    if (!record) continue;
    for (const text of parseTaskRecordSnippets(record)) {
      corpus.push({ text, source: `tasks/${slug}/RECORD.md` });
    }
  }

  // the filed tier keeps a finding routed to the tracker reachable: rows are pointers to accepted issues with no finding body, and a declined finding is never here; last for the same reason as above
  // no phase key, as with tasks: a filed issue sits outside the phase spine
  const filed = read(join(dir, 'FILED.md'));
  if (filed) for (const row of parseFiledRows(filed)) {
    corpus.push({ text: row.text, source: row.source });
  }

  if (!corpus.length) return ok({ results: [], total: 0, ...warn });

  // search() is already in total order since the corpus is in sorted order, so don't re-sort; round the score so stdout is byte-stable across the Node matrix
  const index = buildIndex(corpus.map((c) => c.text));
  const matched = search(index, query);
  const results = matched.slice(0, top).map(({ i, score }) => {
    const c = corpus[i];
    return {
      score: Math.round(score * 1e4) / 1e4,
      source: c.source,
      ...(c.phase !== undefined ? { phase: c.phase } : {}),
      snippet: c.text,
    };
  });
  ok({ results, total: matched.length, ...warn });
}

export { cmdRecall };
