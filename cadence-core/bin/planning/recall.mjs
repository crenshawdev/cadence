// @ts-check
// planning/recall.mjs - `recall`: BM25 retrieval over the .planning/ artifacts
// Cadence writes and never read back.
'use strict';

import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fail, memoryBackend, ok, read } from './core.mjs';
import { buildIndex, search } from '../lib/bm25.mjs';
import {
  parseArchiveRows, parseCaptureSnippets, parseContextDecisions, parseFiledRows,
  parseSummarySnippets, parseTaskRecordSnippets, parseUat,
} from '../lib/planning-files.mjs';
import { requireInt } from '../lib/require-int.mjs';
import { taskRecordsIn } from '../lib/task-record.mjs';

// ---------------------------------------------------------------------------
// recall - BM25 retrieval over the .planning/ artifacts Cadence writes but
// never read back (SUMMARY deviations, CAPTURE items, UAT findings, CONTEXT
// decisions). Zero-dep, deterministic (sorted corpus traversal + a total
// result order, no timestamps): same corpus + same query -> byte-identical
// output. Gated by memory.backend; `none` reports off with empty results. An
// empty or absent corpus is ok:true with results:[] - recall never blocks the
// spine, so it is safe to call before any phase has produced artifacts.
// ---------------------------------------------------------------------------
function cmdRecall(dir, query, opts) {
  if (!query) {
    return fail('bad-args', 'recall needs a query',
      'put the search words after the subcommand: `recall "<what you are looking for>"`');
  }

  // --top bounds the RETURNED set, default 5. Unbounded was the original
  // shape and it is what makes this seam expensive to call: a real query on
  // this repo's corpus returned 72 results at 55.8 KB, which the host spools
  // to a file with a 2 KB preview, so the caller pays the emit AND a second
  // round trip to read back the five hits it wanted. Every call site in the
  // workflows already says "one line per TOP result"; nothing consumes the
  // tail. `total` rides the envelope so a truncated answer stays legible as
  // truncated - absence and silence are different answers here as everywhere.
  let top = 5;
  if (opts.top !== undefined) {
    const parsed = requireInt(opts.top);
    if (!parsed.ok || parsed.value < 1) {
      return fail('bad-args', '--top must be a positive integer',
        'send --top as a whole number of 1 or more, or drop it to take the default 5 results');
    }
    top = parsed.value;
  }

  // The off switch, read through the ONE reader below - a successful check
  // with a negative answer, like plan-overlap.
  //
  // warnings[] rides the envelope, present only when non-empty so the ordinary
  // byte-stable output is unchanged: a torn layer reads memory.backend as
  // absent, which defaults to `builtin`, so a project that deliberately set
  // `none` would silently start recalling again - and the reverse reading, an
  // empty result set, is indistinguishable from a corpus with no hits.
  const { backend, warnings } = memoryBackend(dir);
  const warn = warnings.length ? { warnings } : {};
  if (backend === 'none') return ok({ backend: 'none', results: [], total: 0, ...warn });

  // Corpus assembly in a fixed order: phases ascending (decimal-aware), each
  // phase's SUMMARY then UAT then CONTEXT, then the top-level CAPTURE. The
  // listing itself is guarded - an absent .planning or phases/ is empty data,
  // never an ENOENT throw (which the dispatch catch would turn into a
  // fail('internal'), breaking the empty-corpus contract).
  const corpus = [];
  const phasesDir = join(dir, 'phases');
  if (existsSync(phasesDir)) {
    const entries = readdirSync(phasesDir)
      .filter((e) => /^\d+(?:\.\d+)?$/.test(e))
      .sort((a, b) => Number(a) - Number(b));
    for (const n of entries) {
      const pdir = join(phasesDir, n);
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
  // ARCHIVE.md LAST, and the position is load-bearing: `search()` orders hits
  // by (score desc, corpus position asc), so appending here leaves every
  // existing corpus index where it was and a tree with no ARCHIVE.md emits the
  // bytes it emitted before this walk existed. Read through the same guarded
  // `read()` the CAPTURE walk uses - an absent file is empty data, never an
  // ENOENT throw, which is what the empty-corpus contract rests on.
  //
  // ONE flat ranking with the live rows (D-05): no recency term, no per-source
  // cap, archived rows competing on score alone. Measured 2026-08-16 over a
  // 265-to-986-snippet rebuild, archived rows took 2, 1, 3 and 3 of the top 5
  // on four representative queries and displaced the live CAPTURE.md hit from
  // rank 1 twice. That crowding is the accepted cost: each row names its
  // milestone in `source` so the caller discounts retired work itself, which is
  // a judgment it can make and a cap's N cannot - no measured basis exists for
  // one.
  const archive = read(join(dir, 'ARCHIVE.md'));
  if (archive) for (const row of parseArchiveRows(archive)) corpus.push(row);

  // The TASKS tier (D-09), and it is EXPLICIT: `/cad-task` is the path most real
  // work takes, and until now it left the corpus a hole exactly where the work
  // went - commits, and nothing a query could find. Measured 2026-08-23, a query
  // naming precisely what a shipped task did returned five hits over a corpus of
  // 59 and none of them from `.planning/tasks/`, against a record on disk
  // describing that work.
  //
  // LAST, on the identical argument the ARCHIVE.md walk above makes for its own
  // position: `search()` orders hits by (score desc, corpus position asc), so
  // appending leaves every existing corpus index where it was and a tree with no
  // `tasks/` emits the bytes it emitted before this walk existed.
  //
  // NO `phase` KEY. A task sits outside the phase spine; `references/recall.md`
  // states `phase` is optional and that a reader must never substitute an
  // inferred one, and `phase: 0` here would be exactly the inferred one it
  // forbids - it would also collide with the `phases/0/` directory this phase
  // deliberately did not put the record in.
  //
  // The lister is lib/task-record.mjs's, guarded and contained the way
  // `phaseDirsIn` is: an absent planning root and an unreadable `tasks/` are
  // both an empty list rather than an ENOENT the dispatch catch would turn into
  // `fail('internal')`, and a slug directory or a RECORD.md that resolves
  // OUTSIDE the planning root is skipped rather than read into the corpus - the
  // snippets below are read straight from the path it returns.
  for (const { slug, path } of taskRecordsIn(dir)) {
    const record = read(path);
    if (!record) continue;
    for (const text of parseTaskRecordSnippets(record)) {
      corpus.push({ text, source: `tasks/${slug}/RECORD.md` });
    }
  }

  // The FILED tier (CAP-01), and it is the reason a finding routed to the
  // tracker is still reachable from here. The rows are POINTERS - one title per
  // ACCEPTED filed issue, no finding body - so what this tier adds to the
  // corpus is a way back to the issue and not a copy of the thing that was
  // moved out of the run. A DECLINED finding is never in this file: its only
  // record is the decline label on the forge.
  //
  // LAST, on the identical argument the ARCHIVE.md and tasks walks above make
  // for their own positions: `search()` orders hits by (score desc, corpus
  // position asc), so appending leaves every existing corpus index where it was
  // and a tree with no `.planning/FILED.md` emits the bytes it emitted before
  // this walk existed. Read through the same guarded `read()` - an absent or
  // unreadable file is empty data, never an ENOENT the dispatch catch would
  // turn into `fail('internal')`, which is what the empty-corpus contract rests
  // on.
  //
  // NO `phase` KEY, for the reason the tasks tier states: a filed issue sits
  // outside the phase spine, and `references/recall.md` forbids substituting an
  // inferred one.
  const filed = read(join(dir, 'FILED.md'));
  if (filed) for (const row of parseFiledRows(filed)) {
    corpus.push({ text: row.text, source: row.source });
  }

  if (!corpus.length) return ok({ results: [], total: 0, ...warn });

  // search() returns [{i, score}] in (score desc, corpus position asc) order -
  // already total because the corpus is in sorted traversal order, so do NOT
  // re-sort. Round the score so stdout is byte-stable across the Node matrix.
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
