// Zero-dep tests for `planning.mjs cite-count`. Run:
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
import { writeFileSync, readFileSync, realpathSync, symlinkSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PLANNING, makeTree, run } from './planning.test.mjs';

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

// --- cite-count: the read-back count -------------------------------------------

// A dedicated runner, for the same reason `recall` has one: the backend read
// goes through the config layers, so the global layer is pinned off a
// nonexistent path (D-06) or a developer's real ~/.claude/cadence/config.json
// would flip the answer locally while CI stayed green. Returns the parsed JSON
// AND the raw stdout - the determinism case byte-compares the raw string.
function citeCount(args, dir) {
  let raw;
  let code = 0;
  try {
    raw = execFileSync('node', [PLANNING, 'cite-count', ...args, '--dir', dir], {
      encoding: 'utf8',
      env: { ...process.env, CADENCE_GLOBAL_CONFIG: join(tmpdir(), 'cad-no-such-global.json') },
    });
  } catch (e) { raw = e.stdout; code = e.status; }
  return { json: JSON.parse(raw), raw, _exit: code };
}

/**
 * The surfaced set as a FILE beside the fixture (D-03). Never inline JSON: the
 * envelope carries verbatim artifact prose with arbitrary quoting.
 */
function citePayload(dir, results, name = 'payload.json') {
  const file = join(dir, name);
  // `total` is deliberately larger than `results.length` everywhere below - the
  // count reads the BOUNDED results and never `total` (D-11).
  writeFileSync(file, JSON.stringify({ total: 441, results }));
  return file;
}

/** A plan BODY: makeTree writes `# Plan <n>`, and a citation is prose (D-09). */
function citePlanBody(dir, n, file, body) {
  writeFileSync(join(dir, 'phases', String(n), file), body);
}

/**
 * The fixture every case below shares: phase 2, one plan citing a BARE `D-03`
 * and a phase-QUALIFIED `phase 7 D-05`. Every tree is scratch; nothing here
 * reaches this repository's own .planning.
 */
function citeTree() {
  const dir = makeTree({ phases: { 2: { plan: ['PLAN-1.md'] } } });
  citePlanBody(dir, 2, 'PLAN-1.md',
    '# Plan\n\n## Context\n\nThis plan carries D-03 forward unchanged, and it holds '
    + 'the boundary phase 7 D-05 drew.\n');
  return dir;
}

test('cite-count: the envelope names both sides per item, with the unjoinable arms marked', () => {
  const dir = citeTree();
  const payload = citePayload(dir, [
    // Cited: a bare mention scopes to the plan's own phase 2, and this archived
    // row's source phase IS 2 - the locked consequence of D-04 plus D-10.
    { score: 9, source: 'v3.5.3/phases/2/CONTEXT.md', snippet: 'D-03 (area): the archived one' },
    // Cited: `phase 7 D-05` scopes to 7 and this row's source phase is 7.
    { score: 8, source: 'phases/7/CONTEXT.md', snippet: 'D-05 (area): the qualified one' },
    // Surfaced and NOT cited - the case the whole phase exists to make visible.
    { score: 7, source: 'phases/1/CONTEXT.md', snippet: 'D-09 (area): nobody cited this' },
    { score: 6, source: 'phases/1/CAPTURE.md', snippet: 'a capture row carries no id' },
    { score: 5, source: 'phases/3/SUMMARY.md', snippet: 'a deviation carries no id either' },
    { score: 4, source: 'phases/3/UAT.md', snippet: 'a uat finding' },
  ]);
  const r = citeCount(['--phase', '2', '--payload', payload], dir);
  assert.equal(r.json.ok, true, r.raw);
  assert.equal(r._exit, 0);
  assert.equal(r.json.phase, 2);
  assert.deepEqual(r.json.plans, ['PLAN-1.md']);

  // The BOUNDED results, never `total` (D-11): six rows surfaced against a
  // payload claiming 441 matched.
  assert.equal(r.json.surfaced.count, 6);
  assert.deepEqual(r.json.surfaced.ids, [
    'v3.5.3/phases/2/CONTEXT.md#D-03',
    'phases/7/CONTEXT.md#D-05',
    'phases/1/CONTEXT.md#D-09',
  ], 'only a CONTEXT decision carries an id (D-02); the other three arms have none');

  // An explicit LIST and never a number alone (AC1), and a subset of the ids
  // above - a cited id nothing surfaced would be an answer about another tree.
  assert.deepEqual(r.json.cited.ids,
    ['v3.5.3/phases/2/CONTEXT.md#D-03', 'phases/7/CONTEXT.md#D-05']);
  assert.equal(r.json.cited.count, 2);
  for (const id of r.json.cited.ids) assert.ok(r.json.surfaced.ids.includes(id), id);

  // All four arms ALWAYS, and the three that carry no identifier read as
  // UNJOINABLE rather than as `cited: 0` - a plan that ignored them and a plan
  // nothing could tell about are different answers (D-02).
  assert.deepEqual(r.json.cited_by_kind.decision, { surfaced: 3, cited: 2 });
  assert.deepEqual(r.json.cited_by_kind.capture, { surfaced: 1, unjoinable: true });
  assert.deepEqual(r.json.cited_by_kind.deviation, { surfaced: 1, unjoinable: true });
  assert.deepEqual(r.json.cited_by_kind.uat, { surfaced: 1, unjoinable: true });
  for (const arm of ['capture', 'deviation', 'uat']) {
    assert.equal('cited' in r.json.cited_by_kind[arm], false,
      `${arm} reports unjoinable, never a zero a later gate would threshold against`);
  }

  // The arms reconcile with the headline: a row counted in `surfaced` and in no
  // arm would make the breakdown stop adding up.
  const armed = Object.values(r.json.cited_by_kind).reduce((a, k) => a + k.surfaced, 0);
  assert.equal(armed, r.json.surfaced.count);
});

test('cite-count: the queried phase\'s own rows are dropped and archived same-numbered ones are kept', () => {
  // BOTH directions on ONE payload, so a rule that dropped both or kept both
  // fails here: the plan trivially cites its own CONTEXT (D-04), and an
  // archived phase 2 is a PRIOR phase 2 that the goal is asking about.
  const dir = citeTree();
  const payload = citePayload(dir, [
    { score: 9, source: 'phases/2/CONTEXT.md', snippet: 'D-03 (area): the phase\'s own' },
    { score: 8, source: '_archive-v3.5.0/2/CONTEXT.md', snippet: 'D-03 (area): a retired cycle' },
    { score: 7, source: 'v3.5.3/phases/2/CONTEXT.md', snippet: 'D-03 (area): an ARCHIVE.md row' },
  ]);
  const r = citeCount(['--phase', '2', '--payload', payload], dir);
  assert.equal(r.json.ok, true, r.raw);
  assert.equal(r.json.surfaced.count, 2);
  assert.deepEqual(r.json.surfaced.ids, [
    '_archive-v3.5.0/2/CONTEXT.md#D-03',
    'v3.5.3/phases/2/CONTEXT.md#D-03',
  ]);
  for (const id of r.json.surfaced.ids) {
    assert.equal(id.startsWith('phases/2/'), false, id);
  }
});

test('cite-count: two runs over an unchanged plan and payload are byte-identical', () => {
  const dir = citeTree();
  const payload = citePayload(dir, [
    { score: 9, source: 'v3.5.3/phases/2/CONTEXT.md', snippet: 'D-03 (area): cited' },
    { score: 8, source: 'phases/1/CAPTURE.md', snippet: 'a capture row' },
  ]);
  const a = citeCount(['--phase', '2', '--payload', payload], dir);
  const b = citeCount(['--phase', '2', '--payload', payload], dir);
  assert.equal(a.raw, b.raw);
  assert.equal(a.json.ok, true, a.raw);
});

test('cite-count: the run records no lifecycle/dispatch - it is a reader, not a subagent', () => {
  const dir = citeTree();
  const payload = citePayload(dir, [
    { score: 9, source: 'phases/1/CONTEXT.md', snippet: 'D-01 (area): uncited' },
  ]);
  // Seeded with an unrelated event so an EMPTY file cannot pass this vacuously.
  const trace = join(dir, 'trace.jsonl');
  writeFileSync(trace,
    '{"corr":"2-abc","phase":2,"family":"lifecycle","event":"phase_start"}\n');
  const r = citeCount(['--phase', '2', '--payload', payload], dir);
  assert.equal(r.json.ok, true, r.raw);
  const events = readFileSync(trace, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  assert.ok(events.length >= 1, 'the seeded anchor is still there');
  assert.deepEqual(events.filter((e) => e.family === 'lifecycle' && e.event === 'dispatch'), [],
    'the count is a deterministic read; a dispatch here would mean a model was asked');
});

test('cite-count: memory.backend none is a third state, and needs no payload', () => {
  // The off arm has to be CONSTRUCTED (D-06): this repository sets no
  // memory.backend and runs the `builtin` default, so nothing dogfoods it.
  const off = makeTree({ phases: { 2: { plan: ['PLAN-1.md'] } }, config: { memory: { backend: 'none' } } });
  const r = citeCount(['--phase', '2'], off);
  assert.equal(r.json.ok, true, r.raw);
  assert.equal(r._exit, 0);
  assert.equal(r.json.backend, 'none');
  assert.equal(r.json.surfaced.count, 0);

  // State two: a live backend that surfaced nothing. Separable from the above
  // by the ABSENT `backend` field alone, which is why it is omitted rather than
  // spelled `builtin`.
  const live = citeTree();
  const empty = citeCount(['--phase', '2', '--payload', citePayload(live, [])], live);
  assert.equal(empty.json.ok, true, empty.raw);
  assert.equal(empty.json.backend, undefined);
  assert.equal(empty.json.surfaced.count, 0);

  // And on a live backend the payload is REQUIRED, not defaulted to empty -
  // otherwise state two would swallow a caller that simply forgot the file.
  const missing = citeCount(['--phase', '2'], live);
  assert.equal(missing.json.ok, false);
  assert.equal(missing.json.reason, 'bad-args');
  assert.match(missing.json.detail, /--payload/);
  assert.equal(missing._exit, 1);
});

test('cite-count: the count records itself, under the phase\'s own correlation id', () => {
  // The seam appends its own `outcome` event rather than leaving /cad-plan to
  // issue a `trace append` and retype both figures onto flags (D-08), so the
  // legitimate-zero rate is readable across phases and not only in the session
  // that produced it. Anchored first: `correlationId` derives `<phase>-<sha>`
  // from the newest lifecycle/phase_start for that phase, so without an anchor
  // the id would take the phase-only form and prove nothing about joining.
  const dir = citeTree();
  const trace = join(dir, 'trace.jsonl');
  writeFileSync(trace,
    '{"corr":"2-deadbee","phase":2,"ts":"2026-08-23T00:00:00.000Z",'
    + '"family":"lifecycle","event":"phase_start","sha":"deadbee"}\n');
  const payload = citePayload(dir, [
    { score: 9, source: 'v3.5.3/phases/2/CONTEXT.md', snippet: 'D-03 (area): cited' },
    { score: 8, source: 'phases/1/CONTEXT.md', snippet: 'D-09 (area): uncited' },
    { score: 7, source: 'phases/1/CAPTURE.md', snippet: 'a capture row' },
  ]);
  const r = citeCount(['--phase', '2', '--point', 'planned', '--payload', payload], dir);
  assert.equal(r.json.ok, true, r.raw);
  assert.deepEqual(r.json.trace, { written: true }, 'no reason where the append succeeded');

  const lines = readFileSync(trace, 'utf8').split('\n').filter(Boolean);
  assert.equal(lines.length, 2, 'the anchor plus exactly one appended event');
  const e = JSON.parse(lines[1]);
  assert.equal(e.family, 'outcome', 'outcome is one of FAMILIES, so renderTrace counts it');
  assert.equal(e.event, 'cite_count');
  assert.equal(e.corr, '2-deadbee', 'joined to the phase, not minted');
  assert.equal(e.phase, '2', "the caller's OWN spelling, verbatim");
  assert.equal(e.point, 'planned');

  // BOTH figures with their id lists and the breakdown, so the record answers
  // the same question the envelope does with no join back to a session.
  assert.deepEqual(e.surfaced, r.json.surfaced);
  assert.deepEqual(e.cited, r.json.cited);
  assert.deepEqual(e.cited_by_kind, r.json.cited_by_kind);
  assert.equal(e.surfaced.count, 3);
  assert.equal(e.cited.count, 1);

  // It opens no bracket and bills no worker: a `role` or a `tokens` here would
  // render a nameless worker and claim a cost this seam never paid.
  assert.equal('role' in e, false);
  assert.equal('tokens' in e, false);
  assert.equal('turns' in e, false);
});

test('cite-count: a record that refuses the write moves no figure', () => {
  // D-15: the envelope's `trace` field is the only place a caller could learn
  // the figures were dropped. A record of a decision may not change the
  // decision, so every other field must be byte-identical to the same run
  // whose record landed.
  //
  // The refused arm is the SYMLINKED trace, and it is deliberately no longer
  // the size bound: at `MAX_TRACE_BYTES` the record now ROTATES and the append
  // lands (TRC-08), so a full record is not a way for a write to fail. This
  // test's subject is unchanged - what a caller sees when the write does not
  // happen - only the reachable arm behind it is.
  const capped = citeTree();
  const clean = citeTree();
  const rows = [
    { score: 9, source: 'v3.5.3/phases/2/CONTEXT.md', snippet: 'D-03 (area): cited' },
    { score: 8, source: 'phases/1/CAPTURE.md', snippet: 'a capture row' },
  ];
  const outside = join(mkdtempSync(join(tmpdir(), 'cad-cite-outside-')), 'elsewhere.jsonl');
  writeFileSync(outside, '');
  symlinkSync(outside, join(capped, 'trace.jsonl'));

  const a = citeCount(['--phase', '2', '--payload', citePayload(capped, rows)], capped);
  const b = citeCount(['--phase', '2', '--payload', citePayload(clean, rows)], clean);
  assert.deepEqual(a.json.trace, { written: false, reason: 'symlinked-trace' });
  assert.deepEqual(b.json.trace, { written: true });
  assert.equal(a._exit, 0, 'a dropped record is not a refusal');

  const strip = (j) => { const { trace, ...rest } = j; return rest; };
  assert.deepEqual(strip(a.json), strip(b.json),
    'the verdict and both figures are identical whether or not the record landed');

  // And nothing was appended: the refusal is in FRONT of the write, so the
  // append never followed the link out of the tree.
  assert.equal(readFileSync(outside, 'utf8'), '');
});

test('cite-count: three runs are told apart by their records alone', () => {
  // The whole point of D-06 in ONE test. Two of these three states count ZERO
  // surfaced rows, so a reader with only a count in front of them cannot tell
  // a memory backend that was switched off from a search that found nothing -
  // and the legitimate-zero rate this seam exists to produce is measured
  // against exactly that difference. All three are CONSTRUCTED here rather
  // than sampled: this repository sets no `memory.backend` and runs the
  // `builtin` default, so its own dogfooding never reaches the off arm.
  //
  // The assertion reads the RECORD - the appended trace.jsonl line - and not
  // the envelope alone, because "measurable across phases" is a claim about
  // the record, and the separation has to hold for a reader who was not in the
  // session that produced it.
  const record = (dir) => {
    const lines = readFileSync(join(dir, 'trace.jsonl'), 'utf8').split('\n').filter(Boolean);
    assert.equal(lines.length, 1, 'exactly one cite_count event was appended');
    // `corr` and `ts` are the two fields that differ between any two runs
    // whatever their state, so they are dropped: leaving them in would make
    // every pair below trivially distinct and the check would prove nothing.
    const { corr, ts, ...state } = JSON.parse(lines[0]);
    return state;
  };

  // State one: the backend is off. No payload is passed, because on that path
  // `workflows/plan.md` never makes the call that would produce one.
  const offTree = makeTree({
    phases: { 2: { plan: ['PLAN-1.md'] } },
    config: { memory: { backend: 'none' } },
  });
  const offRun = citeCount(['--phase', '2', '--point', 'planned'], offTree);
  assert.equal(offRun.json.ok, true, offRun.raw);

  // State two: a live backend that surfaced nothing.
  const emptyTree = citeTree();
  const emptyRun = citeCount(
    ['--phase', '2', '--point', 'planned', '--payload', citePayload(emptyTree, [])], emptyTree);
  assert.equal(emptyRun.json.ok, true, emptyRun.raw);

  // State three: a live backend that surfaced rows the plan cites none of.
  // citeTree's plan cites a bare `D-03` and a qualified `phase 7 D-05`, so
  // neither row below can match.
  const zeroTree = citeTree();
  const zeroRun = citeCount(['--phase', '2', '--point', 'planned', '--payload', citePayload(zeroTree, [
    { score: 9, source: 'phases/1/CONTEXT.md', snippet: 'D-09 (area): nobody cited this' },
    { score: 8, source: 'phases/1/CAPTURE.md', snippet: 'a capture row carries no id' },
  ])], zeroTree);
  assert.equal(zeroRun.json.ok, true, zeroRun.raw);

  const off = record(offTree);
  const empty = record(emptyTree);
  const zero = record(zeroTree);

  // The premise, asserted rather than assumed: the first two records carry the
  // SAME count, so whatever separates them is not the number.
  assert.equal(off.surfaced.count, empty.surfaced.count,
    'both states count zero surfaced rows - a count alone cannot be what tells them apart');

  // PAIRWISE, and first: a change that collapsed any one state into another
  // has to fail HERE, naming the two that merged, rather than passing three
  // single-run assertions that each look at one record and never compare them.
  const states = [
    ['backend-off', off],
    ['surfaced-nothing', empty],
    ['surfaced-some-cited-none', zero],
  ];
  for (let i = 0; i < states.length; i++) {
    for (let j = i + 1; j < states.length; j++) {
      assert.notDeepStrictEqual(states[i][1], states[j][1],
        `the ${states[i][0]} run and the ${states[j][0]} run are INDISTINGUISHABLE on the `
        + 'record: their appended events carry the same combination of fields, so a reader '
        + 'who was not in the session cannot tell which of the two states produced it');
    }
  }

  // And what each record says, so the pairwise result above is three known
  // states and not three arbitrary ones. No field exists here that the three
  // do not already differ by - a fourth marker would give one fact a second
  // source, and the two would disagree the first time one of them moved.
  assert.equal(off.backend, 'none');
  assert.equal(off.cited.count, 0);
  assert.equal('backend' in empty, false,
    'an ABSENT backend field is what says the count ran against a live one');
  assert.equal(empty.surfaced.count, 0);
  assert.equal('backend' in zero, false);
  assert.equal(zero.surfaced.count, 2);
  assert.deepEqual(zero.cited, { count: 0, ids: [] },
    'the case the phase exists to make visible: surfaced rows, cited by nothing');
});
