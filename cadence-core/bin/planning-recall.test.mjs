// Zero-dep tests for `planning.mjs recall`. Run:
// node --test 'cadence-core/bin/*.test.mjs'
//
// Split out of planning.test.mjs in phase 4, verbatim: the arms, their fixture
// builders and their comments are unchanged, only their home is. The shared
// harness stays in planning.test.mjs and is imported, never copied - two copies
// of `makeTree` is how two fixtures drift apart.
//
// The `test` binding below is a no-op unless this module IS the entry file, so
// a sibling that imports a fixture from here registers nothing twice.
import { test as nodeTest } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, symlinkSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PLANNING, makeTree, run } from './planning.test.mjs';
// The tasks tier is read back out of a record the task-record seam wrote, so
// its fixtures come from the arms that own that seam rather than a second
// copy of them here.
import { taskRepo, runIn, TASK_COMMITS } from './planning-task-record.test.mjs';

/** True iff this module is what node was told to run; realpath on both sides so
 * a symlinked checkout still matches (config-seams.test.mjs D-19). */
function isEntryFile() {
  const argv1 = process.argv[1];
  if (typeof argv1 !== 'string' || argv1 === '') return false;
  try {
    return pathToFileURL(realpathSync(argv1)).href === pathToFileURL(realpathSync(fileURLToPath(import.meta.url))).href;
  } catch { return false; }
}

/** `node:test`'s `test` when run directly, a no-op when imported (see header). */
const test = isEntryFile() ? nodeTest : () => {};

// --- recall: BM25 over the .planning corpus ------------------------------------

// A dedicated runner: recall takes a positional query, and its backend read
// goes through the config layers, so the global layer must be pinned off a
// nonexistent path (D-10) or a developer's real ~/.claude/cadence/config.json
// would flip results locally while CI stayed green. Returns the parsed JSON
// AND the raw stdout (the determinism test byte-compares the raw string).
// `query` may be an array to express the UNQUOTED form (bare words as
// separate argv elements) - a single string cannot say that at all.
function recall(query, dir) {
  let raw;
  let code = 0;
  const qargs = Array.isArray(query) ? query : [query];
  try {
    raw = execFileSync('node', [PLANNING, 'recall', ...qargs, '--dir', dir], {
      encoding: 'utf8',
      env: { ...process.env, CADENCE_GLOBAL_CONFIG: join(tmpdir(), 'cad-no-such-global.json') },
    });
  } catch (e) { raw = e.stdout; code = e.status; }
  return { json: JSON.parse(raw), raw, _exit: code };
}

test('recall: a matching SUMMARY deviation ranks first, with source and phase', () => {
  const dir = makeTree({
    roadmap: [{ n: 1, name: 'Recall' }, { n: 2, name: 'Later' }],
    phases: {
      1: { summaryBody: { deviations: ['tokenkiller saturation race fixed in the guard'] } },
      2: { summaryBody: { deviations: ['unrelated documentation wording tweak'] } },
    },
  });
  const r = recall('tokenkiller saturation', dir);
  assert.equal(r.json.ok, true);
  assert.equal(r._exit, 0);
  assert.ok(r.json.results.length >= 1);
  assert.equal(r.json.results[0].source, 'phases/1/SUMMARY.md');
  assert.equal(r.json.results[0].phase, 1);
  assert.match(r.json.results[0].snippet, /tokenkiller/);
});

test('recall: empty and absent corpus both return ok:true with no results', () => {
  // Absent .planning entirely.
  const gone = recall('anything', join(tmpdir(), 'cad-recall-nonexistent'));
  assert.equal(gone.json.ok, true);
  assert.deepEqual(gone.json.results, []);
  assert.equal(gone._exit, 0);
  // .planning exists (roadmap only) but no SUMMARY/CAPTURE/UAT/CONTEXT corpus.
  const empty = recall('anything', makeTree({ roadmap: [{ n: 1, name: 'One' }] }));
  assert.equal(empty.json.ok, true);
  assert.deepEqual(empty.json.results, []);
  assert.equal(empty._exit, 0);
});

test('recall: two runs on the same corpus are byte-identical', () => {
  const dir = makeTree({
    phases: {
      1: { summaryBody: { deviations: ['alpha beta gamma', 'delta epsilon'] },
        contextDecisions: ['use beta for the gamma path'] },
    },
    capture: [{ section: 'Todos', text: 'wire the beta recall path', phase: 1 },
      { section: 'Seeds', text: 'gamma indexing idea' }],
  });
  const a = recall('beta gamma', dir);
  const b = recall('beta gamma', dir);
  assert.equal(a.raw, b.raw);
  assert.ok(a.json.results.length >= 2);
});

test('recall: durable decisions resurface; phase-local ## Decisions do not', () => {
  const dir = makeTree({
    phases: {
      1: { durableDecisions: ['use foobar approach'], contextDecisions: ['phase-local baz detail'] },
    },
  });
  const durable = recall('foobar', dir);
  assert.ok(durable.json.results.some((r) => r.source === 'phases/1/CONTEXT.md'));
  const local = recall('baz', dir);
  assert.ok(!local.json.results.some((r) => r.source === 'phases/1/CONTEXT.md'));
});

test('recall: legacy CONTEXT.md with only ## Decisions (no durable heading) still resurfaces', () => {
  const dir = makeTree({
    phases: { 1: { contextDecisions: ['legacy qux decision'] } },
  });
  const r = recall('qux', dir);
  assert.ok(r.json.results.some((r) => r.source === 'phases/1/CONTEXT.md'));
});

test('recall: a present-but-empty ## Durable decisions does NOT fall back to ## Decisions', () => {
  // Constructed directly (not via makeTree's default Durable-first ordering):
  // `sectionBody` only returns the literal empty string "" - as opposed to a
  // truthy whitespace-only "\n" - when the heading is the LAST thing in the
  // file, so this is the shape that actually distinguishes a `durable ===
  // null` / `??` fallback from a naive `!durable` / `durable || ...` one; the
  // latter treats "" as falsy and wrongly falls through to `## Decisions`.
  const dir = makeTree({ roadmap: [{ n: 1, name: 'Only' }], phases: { 1: {} } });
  writeFileSync(join(dir, 'phases', '1', 'CONTEXT.md'),
    '# Phase 1 Context\n\n## Decisions\n\n- D-01 (area): phase-local baz detail\n\n' +
    '## Durable decisions\n');
  const r = recall('baz', dir);
  assert.ok(!r.json.results.some((r) => r.source === 'phases/1/CONTEXT.md'));
});

test('recall: two runs over a corpus with ## Durable decisions are byte-identical', () => {
  const dir = makeTree({
    phases: {
      1: { durableDecisions: ['alpha beta gamma durable'], contextDecisions: ['delta epsilon local'] },
    },
  });
  const a = recall('beta gamma', dir);
  const b = recall('beta gamma', dir);
  assert.equal(a.raw, b.raw);
  assert.ok(a.json.results.length >= 1);
});

test('recall: bare words after the query are joined, not truncated (#47.2)', () => {
  // The corpus separates the two words, so a first-word-only search can only
  // reach phase 1 - the quoted run reaches both.
  const dir = makeTree({
    phases: {
      1: { summaryBody: { deviations: ['decimal cursor carve-out'] } },
      2: { summaryBody: { deviations: ['renumber phases desync report'] } },
    },
  });
  const bare = recall(['decimal', 'phases'], dir);
  const quoted = recall('decimal phases', dir);
  assert.equal(bare.json.ok, true);
  const sources = bare.json.results.map((x) => x.source);
  assert.ok(sources.includes('phases/1/SUMMARY.md'), `missing phase 1: ${sources}`);
  assert.ok(sources.includes('phases/2/SUMMARY.md'), `missing phase 2: ${sources}`);
  assert.equal(bare.raw, quoted.raw); // byte-identical to the quoted form
});

test('recall: a completed capture keeps its phase and gains a closed marker (#47.1)', () => {
  // makeTree's capture builder only ever writes `[ ]`, so the checked line is
  // written raw - the shape the builder cannot express.
  const dir = makeTree({ roadmap: [{ n: 1, name: 'One' }] });
  writeFileSync(join(dir, 'CAPTURE.md'),
    '## Todos\n\n- [x] (phase 3) tokenkiller carve-out closed by abc1234\n' +
    '- [ ] (phase 1) tokenkiller live item\n');
  const r = recall('tokenkiller', dir);
  assert.equal(r.json.ok, true);
  const closed = r.json.results.find((x) => /carve-out/.test(x.snippet));
  const live = r.json.results.find((x) => /live item/.test(x.snippet));
  // Pre-fix the `[x]` prefix blocked the `(phase N)` extraction entirely: no
  // phase field, and the checkbox stayed in the indexed text.
  assert.equal(closed.phase, 3);
  assert.doesNotMatch(closed.snippet, /\[x\]/);
  assert.ok(closed.snippet.startsWith('[closed] '),
    `closed snippet lacks the marker: ${closed.snippet}`);
  // An open capture is unchanged: phase extracted, no marker.
  assert.equal(live.phase, 1);
  assert.doesNotMatch(live.snippet, /\[closed\]/);
});

// --- capture -> recall: the walk-membership round trip (AC1) -----------------
// The pair below is the whole point of the phase. The first row proves a bullet
// written through the seam comes back; the second is its FALSIFIER, and without
// it the first would stay green if the seam wrote to `## Archive` - which is
// exactly how five filed bullets were lost. A positive-only assertion here
// would be an inspection dressed as a test.

test('capture -> recall: a bullet written through the seam comes back, with its phase (AC1)', () => {
  const dir = makeTree({ roadmap: [{ n: 1, name: 'One' }] });
  const w = run(['capture', '--kind', 'todo', '--text', 'the zarquon fixture leaks a handle',
    '--phase', '2'], dir);
  assert.equal(w.ok, true, JSON.stringify(w));
  const r = recall('zarquon', dir);
  const hit = r.json.results.find((x) => /zarquon/.test(x.snippet));
  assert.ok(hit, `the captured bullet did not come back: ${r.raw}`);
  assert.equal(hit.source, 'CAPTURE.md');
  assert.equal(hit.phase, 2);
});

test('capture -> recall: a seed and a note come back too, unphased', () => {
  const dir = makeTree({ roadmap: [{ n: 1, name: 'One' }] });
  assert.equal(run(['capture', '--kind', 'seed', '--text', 'a zarquon scanner'], dir).ok, true);
  assert.equal(run(['capture', '--kind', 'note', '--text', 'zarquon bit us again'], dir).ok, true);
  const hits = recall('zarquon', dir).json.results.filter((x) => x.source === 'CAPTURE.md');
  assert.equal(hits.length, 2, JSON.stringify(hits));
  for (const h of hits) assert.equal(h.phase, undefined);
});

test('capture -> recall: a bullet under ## Archive is NOT returned (the falsifier)', () => {
  // Same distinctive term, one bullet through the seam and one written straight
  // into a section the walk does not visit. Only the seam's comes back - so a
  // seam that ever wrote to `## Archive` reddens the row above rather than
  // passing on a bullet nobody can recall. `## Archive` stays out of the walk on
  // purpose (D-03): widening it would re-admit 185 retired bullets.
  const dir = makeTree({
    roadmap: [{ n: 1, name: 'One' }],
    capture: [{ section: 'Archive', text: 'zarquon retired long ago' }],
  });
  assert.match(readFileSync(join(dir, 'CAPTURE.md'), 'utf8'), /## Archive\n\n- zarquon retired long ago/);
  assert.deepEqual(recall('zarquon', dir).json.results, []);
  assert.equal(run(['capture', '--kind', 'todo', '--text', 'zarquon is live again', '--phase', '1'], dir).ok, true);
  const back = recall('zarquon', dir).json.results;
  assert.equal(back.length, 1, JSON.stringify(back));
  assert.match(back[0].snippet, /zarquon is live again/);
});

test('recall: memory.backend none reports off with empty results, exit 0', () => {
  const dir = makeTree({
    phases: { 1: { summaryBody: { deviations: ['findable term here'] } } },
    config: { memory: { backend: 'none' } },
  });
  const r = recall('findable', dir);
  assert.equal(r.json.ok, true);
  assert.equal(r.json.backend, 'none');
  assert.deepEqual(r.json.results, []);
  assert.equal(r._exit, 0);
});

// --- recall: the archived corpus a closed milestone leaves behind (RCL-07) ----
// The residue file is read beside CAPTURE.md, LAST in the corpus, so a tree
// with no ARCHIVE.md emits exactly the bytes it emitted before this walk
// existed - that byte-identity is the first assertion below, not a remark.

/** Write an ARCHIVE.md into a fixture tree; `rows` are raw grammar lines. */
export function archive(dir, label, rows) {
  writeFileSync(join(dir, 'ARCHIVE.md'),
    `# Archive\n\n## ${label}\n\n${rows.map((r) => `- ${r}`).join('\n')}\n`);
  return dir;
}

test('recall: an archived row comes back with its milestone label and its origin', () => {
  const dir = makeTree({ phases: { 1: { summaryBody: { deviations: ['a live deviation'] } } } });
  archive(dir, 'v3.5.2', [
    '`phases/2/SUMMARY.md`: the zarquon guard fired on a range it did not own',
    '`phases/2.1/UAT.md`: walk the zarquon install from a cold clone',
    '`phases/2/CONTEXT.md`: D-04 (RCL-07): each zarquon row names its origin',
  ]);
  const r = recall('zarquon', dir);
  assert.equal(r.json.ok, true);
  assert.equal(r._exit, 0);
  const hits = r.json.results;
  assert.equal(hits.length, 3, JSON.stringify(hits));
  // Distinguishable from each other AND from a live row: the label leads, the
  // origin artifact follows, and `phase` keeps the meaning a live row gives it.
  assert.deepEqual(new Set(hits.map((h) => h.source)), new Set([
    'v3.5.2/phases/2/SUMMARY.md',
    'v3.5.2/phases/2.1/UAT.md',
    'v3.5.2/phases/2/CONTEXT.md',
  ]));
  const uat = hits.find((h) => h.source.endsWith('UAT.md'));
  assert.equal(uat.phase, 2.1, 'a decimal phase survives the round trip');
  assert.deepEqual(Object.keys(uat).sort(), ['phase', 'score', 'snippet', 'source'],
    'the result contract stays exactly four fields wide');
});

test('recall: a tree with no ARCHIVE.md answers byte-identically to one that never had it', () => {
  const spec = {
    phases: { 1: { summaryBody: { deviations: ['alpha beta gamma'] } } },
    capture: [{ section: 'Todos', text: 'wire the beta recall path', phase: 1 }],
  };
  const bare = recall('beta gamma', makeTree(spec));
  const empty = recall('beta gamma', archive(makeTree(spec), 'v3.5.2', []));
  assert.equal(bare.raw, empty.raw, 'an ARCHIVE.md with no rows changes no byte');
  // And the archived rows land AFTER the live ones, so no existing corpus INDEX
  // moved: the live hits come back in the same order, the same rows.
  //
  // Their SCORES do move, and deliberately not asserted: BM25 is corpus-
  // relative, so any new document shifts N, avgdl and every idf term. Pinning
  // the numbers here would make an unrelated row added to a project's residue
  // redden this file. What the position guarantees is the tie-break - equal
  // scores resolve by corpus position - which is why the append goes last.
  const withRows = recall('beta gamma', archive(makeTree(spec), 'v3.5.2',
    ['`phases/9/SUMMARY.md`: an unrelated retired note']));
  assert.deepEqual(withRows.json.results.map((r) => [r.source, r.snippet]),
    bare.json.results.map((r) => [r.source, r.snippet]));
});

test('recall: two runs over a corpus holding live AND archived rows are byte-identical', () => {
  const dir = makeTree({
    phases: { 1: { summaryBody: { deviations: ['alpha beta gamma'] } } },
    capture: [{ section: 'Seeds', text: 'gamma indexing idea' }],
  });
  archive(dir, 'v3.5.2', [
    '`phases/1/SUMMARY.md`: beta gamma from the closed milestone',
    '`phases/1/CONTEXT.md`: D-01 (REC-01): gamma stays flat-ranked',
  ]);
  const a = recall('beta gamma', dir);
  const b = recall('beta gamma', dir);
  assert.equal(a.raw, b.raw);
  assert.ok(a.json.results.length >= 3, JSON.stringify(a.json.results));
});

test('recall: memory.backend none reads no ARCHIVE.md either', () => {
  const dir = makeTree({
    phases: { 1: { summaryBody: { deviations: ['a live deviation'] } } },
    config: { memory: { backend: 'none' } },
  });
  archive(dir, 'v3.5.2', ['`phases/2/SUMMARY.md`: the zarquon guard, retired']);
  const r = recall('zarquon', dir);
  assert.equal(r.json.backend, 'none');
  assert.deepEqual(r.json.results, []);
  assert.equal(r.json.total, 0);
  assert.equal(r._exit, 0);
});

// --- recall: the tasks tier (D-09) -------------------------------------------
//
// The hole this closes was MEASURED, not supposed: a query naming exactly what a
// shipped `/cad-task` run did returned five hits over a 59-snippet corpus and
// none of them from `.planning/tasks/`, against a record on disk describing that
// work.

/** Plant `<dir>/tasks/<slug>/RECORD.md` holding `shipped` as its bullets. */
function taskRecordIn(dir, slug, shipped) {
  const tdir = join(dir, 'tasks', slug);
  mkdirSync(tdir, { recursive: true });
  writeFileSync(join(tdir, 'RECORD.md'),
    `# Task: ${slug}\n\n## What shipped\n\n${shipped.map((s) => `- ${s}`).join('\n')}\n\n`
    + '## Commits\n\n| Task | Commit | Description |\n| --- | --- | --- |\n\n'
    + `## Files\n\n### Task 1: ${slug}\n\n- **Files:** a.txt\n`);
  return dir;
}

const TASK_TIER_SPEC = {
  phases: { 1: { summaryBody: { deviations: ['alpha beta gamma'] } } },
  capture: [{ section: 'Todos', text: 'wire the beta recall path', phase: 1 }],
};

test('recall: a task record comes back, sourced by slug and with NO phase field', () => {
  const dir = taskRecordIn(makeTree(TASK_TIER_SPEC), 'bound-plan-size',
    ['a plan-size ceiling nothing enforced', 'the beta gamma path this task took']);
  const r = recall('beta gamma', dir);
  assert.equal(r.json.ok, true);
  const hit = r.json.results.find((x) => x.source === 'tasks/bound-plan-size/RECORD.md');
  assert.ok(hit, JSON.stringify(r.json.results));
  assert.equal(hit.snippet, 'the beta gamma path this task took');
  // NO inferred phase: a task sits outside the phase spine, and `phase: 0` here
  // would be the substitution references/recall.md forbids.
  assert.equal('phase' in hit, false,
    'a task record carries no phase, and an inferred one is worse than none');
});

test('recall: a tree with no tasks/ answers byte-identically to one with an empty tasks/', () => {
  const bare = recall('beta gamma', makeTree(TASK_TIER_SPEC));
  const emptyDir = makeTree(TASK_TIER_SPEC);
  mkdirSync(join(emptyDir, 'tasks'), { recursive: true });
  const empty = recall('beta gamma', emptyDir);
  assert.equal(bare.raw, empty.raw, 'the tasks walk contributes nothing when it finds nothing');

  // And the task rows land AFTER every existing one, so no corpus INDEX moved:
  // the live hits come back in the same order, the same rows. Their SCORES do
  // move and are deliberately not asserted - BM25 is corpus-relative, the
  // reasoning the ARCHIVE.md row above states in full.
  const withRecord = recall('beta gamma',
    taskRecordIn(makeTree(TASK_TIER_SPEC), 'later', ['an unrelated task note']));
  assert.deepEqual(withRecord.json.results.map((x) => [x.source, x.snippet]),
    bare.json.results.map((x) => [x.source, x.snippet]));
});

test('recall: two runs over a corpus holding a task record are byte-identical', () => {
  const dir = taskRecordIn(makeTree(TASK_TIER_SPEC), 'bound-plan-size',
    ['a plan-size ceiling nothing enforced', 'the beta gamma path this task took']);
  taskRecordIn(dir, 'another-task', ['a second beta record, sorted after the first']);
  const a = recall('beta gamma', dir);
  const b = recall('beta gamma', dir);
  assert.equal(a.raw, b.raw);
  assert.ok(a.json.results.length >= 3, JSON.stringify(a.json.results));
});

test('recall: a RECORD.md symlinked OUT of the planning root is never indexed', () => {
  // The lister contains the walk one level past `phaseDirsIn`: the recall tier
  // reads snippets straight from the path it returns, so a cloned repository
  // carrying such a link would otherwise surface an arbitrary readable file.
  const outside = mkdtempSync(join(tmpdir(), 'cad-recall-outside-'));
  const secret = join(outside, 'RECORD.md');
  writeFileSync(secret, '# Task: stolen\n\n## What shipped\n\n- beta gamma secret bytes\n');
  const dir = makeTree(TASK_TIER_SPEC);
  mkdirSync(join(dir, 'tasks', 'leaky'), { recursive: true });
  symlinkSync(secret, join(dir, 'tasks', 'leaky', 'RECORD.md'));
  const r = recall('beta gamma', dir);
  assert.equal(r.json.results.some((x) => x.snippet.includes('secret bytes')), false);
  assert.equal(r.json.results.some((x) => x.source.startsWith('tasks/')), false);
});

test('task-record -> recall: a record written by the seam is found by what it says', () => {
  // The round trip both halves of D-09 exist for: the writer's `## What shipped`
  // heading and the walk's reader are one fact, and this is where they meet.
  const { root, dir, shas } = taskRepo(TASK_COMMITS);
  runIn(root, ['task-record', '--slug', 'bound-plan-size', '--base', `${shas[0]}^`,
    '--head', shas[1], '--text', 'A ceiling on plan size, enforced at the gate.'], dir);
  const r = recall('ceiling plan size gate', dir);
  assert.equal(r.json.ok, true);
  assert.deepEqual(r.json.results.map((x) => x.source), ['tasks/bound-plan-size/RECORD.md']);
});

// --- recall: the FILED pointer a routed finding leaves behind (CAP-01) --------
// A finding a gate declined to fix now leaves the run for the tracker, so it
// leaves the corpus too - and "a bullet /cad-capture writes is reachable by
// /cad-plan's recall" is the SHIPPED CAP-01 guarantee. One pointer row per
// ACCEPTED filed issue is what holds it. Read LAST, beside ARCHIVE.md and the
// tasks tier, so a tree with no FILED.md emits exactly the bytes it emitted
// before this walk existed - that byte-identity is the first assertion below.

/** Write a FILED.md into a fixture tree; `rows` are raw grammar lines. */
function filed(dir, rows) {
  writeFileSync(join(dir, 'FILED.md'),
    `# Filed\n\n${rows.map((r) => `- ${r}`).join('\n')}\n`);
  return dir;
}

test('recall: a filed issue comes back by its title, sourced FILED.md', () => {
  const dir = makeTree({ phases: { 1: { summaryBody: { deviations: ['a live deviation'] } } } });
  filed(dir, [
    '2026-08-25 forgejo acme/widget 0123456789abcdef: [cadence 0123456789abcdef] '
      + 'the redaction window clips a credential before its at sign',
  ]);
  const r = recall('redaction credential window', dir);
  const hit = r.json.results.find((x) => x.source === 'FILED.md');
  assert.ok(hit, JSON.stringify(r.json.results));
  assert.match(hit.snippet, /clips a credential before its at sign/);
  // A pointer, not the finding: no phase field, the way a task record has none.
  assert.equal(hit.phase, undefined);
});

test('recall: a tree with no FILED.md answers byte-identically to one that never had it', () => {
  const spec = {
    phases: { 1: { summaryBody: { deviations: ['alpha beta gamma'] } } },
    capture: [{ section: 'Todos', text: 'wire the beta recall path', phase: 1 }],
  };
  const bare = recall('beta gamma', makeTree(spec));
  const empty = recall('beta gamma', filed(makeTree(spec), []));
  assert.equal(bare.raw, empty.raw, 'a FILED.md with no rows changes no byte');
  // And the filed rows land AFTER the live ones, so no existing corpus INDEX
  // moved: the live hits come back in the same order, the same rows. Their
  // SCORES do move and are deliberately not asserted, for the reason the
  // ARCHIVE.md arm above states.
  const withRows = recall('beta gamma', filed(makeTree(spec),
    ['2026-08-25 github acme/widget 00112233445566aa: [cadence 00112233445566aa] an unrelated filed note']));
  assert.deepEqual(withRows.json.results.map((r) => [r.source, r.snippet]),
    bare.json.results.map((r) => [r.source, r.snippet]));
});

test('recall: a note in FILED.md that is not a row mints no corpus entry', () => {
  const dir = makeTree({ phases: { 1: { summaryBody: { deviations: ['a live deviation'] } } } });
  writeFileSync(join(dir, 'FILED.md'),
    '# Filed\n\nsomeone wrote a paragraph about zebrafish here.\n\n- not a row either\n');
  const r = recall('zebrafish', dir);
  assert.deepEqual(r.json.results.filter((x) => x.source === 'FILED.md'), []);
});

test('recall: two runs over a corpus holding a filed row are byte-identical', () => {
  const dir = makeTree({ phases: { 1: { summaryBody: { deviations: ['alpha beta gamma'] } } } });
  filed(dir, ['2026-08-25 gitlab acme/widget aabbccddeeff0011: [cadence aabbccddeeff0011] beta gamma pointer']);
  assert.equal(recall('beta gamma', dir).raw, recall('beta gamma', dir).raw);
});
