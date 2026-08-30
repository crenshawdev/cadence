// Zero-dep tests for lib/read-trace.mjs - the per-tool-call read recorder as a
// pure rule plus its guarded append. Run:
//   node --test cadence-core/bin/read-trace.test.mjs
// Only node: builtins, per the repo's zero-dep ethos.
//
// This file owns two things the hook itself cannot be trusted to prove: the
// REDACTION contract (a Bash command line and a Grep pattern must never reach
// the file, because /cad-report reads it back into a model's context) and the
// guarded-append posture copied from lib/trace.mjs (symlink refused, cap
// enforced before the write, a reason returned and never thrown).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync, mkdirSync, writeFileSync, readFileSync, symlinkSync, existsSync, statSync,
  appendFileSync, readdirSync, linkSync, utimesSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  recordFromHook, appendRead, programOf, readsPath, filesOf,
  RECORDED_TOOLS, MAX_READS_BYTES, MAX_FILES_PER_CALL,
  rotatedReadsPath, readsClaimPath, isReadsRotationMarker, rotateReads,
  READS_MARKER_BYTES,
} from './lib/read-trace.mjs';

const TS = '2026-08-14T00:00:00.000Z';
const tmp = () => mkdtempSync(join(tmpdir(), 'cad-reads-'));

test('a tool outside the recorded set is not a read', () => {
  for (const t of ['Edit', 'Write', 'Task', 'WebFetch', undefined]) {
    assert.equal(recordFromHook({ tool_name: t, tool_input: {} }, TS), null);
  }
  assert.equal(recordFromHook(null, TS), null);
  assert.equal(recordFromHook('nope', TS), null);
});

test('every recorded tool produces a record', () => {
  for (const t of RECORDED_TOOLS) {
    const r = recordFromHook({ tool_name: t, tool_input: {} }, TS);
    assert.ok(r, `${t} produced no record`);
    assert.equal(r.tool, t);
    assert.equal(r.ts, TS);
  }
});

test('Read carries its path and window', () => {
  const r = recordFromHook({
    tool_name: 'Read',
    tool_input: { file_path: '/x/y.md', offset: 100, limit: 50 },
  }, TS);
  assert.equal(r.target, '/x/y.md');
  assert.equal(r.offset, 100);
  assert.equal(r.limit, 50);
});

test('a main-thread call bills the coordinator; a subagent call bills its type', () => {
  const main = recordFromHook({ tool_name: 'Read', tool_input: {} }, TS);
  assert.equal(main.agent, 'coordinator');
  assert.equal(main.agent_id, undefined);

  const worker = recordFromHook({
    tool_name: 'Read', tool_input: {}, agent_type: 'cad-executor', agent_id: 'abc',
  }, TS);
  assert.equal(worker.agent, 'cad-executor');
  assert.equal(worker.agent_id, 'abc');
});

test('an agent_id with no agent_type is still not the coordinator', () => {
  const r = recordFromHook({ tool_name: 'Read', tool_input: {}, agent_id: 'x' }, TS);
  assert.equal(r.agent, 'unknown-agent');
});

// --- the redaction contract -------------------------------------------------

test('Bash records the program and NEVER the command line', () => {
  const r = recordFromHook({
    tool_name: 'Bash',
    tool_input: { command: 'curl -H "Authorization: Bearer sk-live-XXXX" https://api.example.com' },
  }, TS);
  assert.equal(r.target, 'curl');
  const s = JSON.stringify(r);
  assert.ok(!s.includes('sk-live'), 'a token reached the record');
  assert.ok(!s.includes('Bearer'), 'a header reached the record');
});

test('an inline env assignment is stripped, so an inline secret is never the token', () => {
  assert.equal(programOf('API_KEY=sk-live-XXXX node app.mjs'), 'node');
  assert.equal(programOf('FOO=1 BAR=2 git status'), 'git');
  assert.equal(programOf('/usr/local/bin/rg --files'), 'rg');
  assert.equal(programOf('   '), null);
  assert.equal(programOf(undefined), null);
});

test('Grep records its SCOPE and never its pattern', () => {
  const r = recordFromHook({
    tool_name: 'Grep',
    tool_input: { pattern: 'JWT_SECRET=(\\S+)', path: 'cadence-core', output_mode: 'content' },
  }, TS);
  assert.equal(r.target, 'cadence-core');
  assert.equal(r.mode, 'content');
  assert.ok(!JSON.stringify(r).includes('JWT_SECRET'), 'a grep pattern reached the record');
});

// --- opportunistic byte capture --------------------------------------------

test('tool_response sizes the record when present, and is absent otherwise', () => {
  const withResp = recordFromHook({
    tool_name: 'Read', tool_input: {}, tool_response: 'x'.repeat(1234),
  }, TS);
  assert.equal(withResp.bytes, 1234);

  const without = recordFromHook({ tool_name: 'Read', tool_input: {} }, TS);
  assert.equal('bytes' in without, false, 'an absent response must not invent a figure');
});

test('an unserializable response leaves bytes absent rather than throwing', () => {
  const circular = {};
  circular.self = circular;
  const r = recordFromHook({ tool_name: 'Read', tool_input: {}, tool_response: circular }, TS);
  assert.ok(r);
  assert.equal('bytes' in r, false);
});

// --- the guarded append -----------------------------------------------------

test('the first write creates the file and round-trips', () => {
  const d = tmp();
  const res = appendRead(d, { ts: TS, tool: 'Read', agent: 'coordinator', target: '/a' });
  assert.equal(res.written, true);
  const lines = readFileSync(readsPath(d), 'utf8').trim().split('\n');
  assert.equal(lines.length, 1);
  assert.equal(JSON.parse(lines[0]).target, '/a');
});

test('appends accumulate rather than replacing', () => {
  const d = tmp();
  for (let i = 0; i < 3; i++) appendRead(d, { ts: TS, tool: 'Read', target: `/f${i}` });
  const lines = readFileSync(readsPath(d), 'utf8').trim().split('\n');
  assert.equal(lines.length, 3);
});

test('a symlinked reads file is refused, appending nothing', () => {
  const d = tmp();
  const decoy = join(d, 'elsewhere.jsonl');
  writeFileSync(decoy, '');
  symlinkSync(decoy, readsPath(d));
  const res = appendRead(d, { ts: TS, tool: 'Read', target: '/a' });
  assert.equal(res.written, false);
  assert.equal(res.reason, 'symlinked-reads');
  assert.equal(readFileSync(decoy, 'utf8'), '', 'the link target was written through');
});

/**
 * Pad the reads record to ONE BYTE UNDER `MAX_READS_BYTES`, so the next append
 * is what carries it to the bound and the trigger under test is "this line
 * would reach it" rather than "the file already did".
 * @param {string} d
 */
function padToReadsBound(d) {
  let at = 0;
  try { at = statSync(readsPath(d)).size; } catch { at = 0; }
  appendFileSync(readsPath(d), `${'x'.repeat(MAX_READS_BYTES - at - 2)}\n`);
  assert.equal(statSync(readsPath(d)).size, MAX_READS_BYTES - 1);
}

/** Every line of the live record, parsed. @param {string} d */
const liveLines = (d) => readFileSync(readsPath(d), 'utf8').trim().split('\n');

test('a record at the bound ROTATES and the append lands, rather than reporting a cap', () => {
  const d = tmp();
  appendRead(d, { ts: TS, tool: 'Read', target: '/before-the-cut' });
  padToReadsBound(d);

  const res = appendRead(d, { ts: TS, tool: 'Read', target: '/after-the-cut' });
  assert.equal(res.written, true, `the append at the bound was refused: ${res.reason}`);
  assert.ok(statSync(readsPath(d)).size < MAX_READS_BYTES,
    'the live record is still at or over the bound after a rotation');

  const lines = liveLines(d);
  assert.ok(isReadsRotationMarker(JSON.parse(lines[0])),
    'the fresh record does not start with the rotation marker');
  assert.equal(JSON.parse(lines[lines.length - 1]).target, '/after-the-cut',
    'the record that triggered the rotation is not in the live file');

  assert.equal(existsSync(rotatedReadsPath(d)), true, 'no sibling generation was left');
  assert.ok(readFileSync(rotatedReadsPath(d), 'utf8').includes('/before-the-cut'),
    'the pre-rotation bytes are not in the sibling');
  // NOTHING crosses the cut (D-02): the whole live file became the sibling.
  assert.equal(readFileSync(readsPath(d), 'utf8').includes('/before-the-cut'), false,
    'a pre-rotation record was carried into the fresh file');
});

/** Every file in the planning root named after the reads record. @param {string} d */
const readsSiblings = (d) => readdirSync(d).filter((f) => f.startsWith('reads')).sort();

test('the marker SEALS the generation it carried away, in bytes', () => {
  // `carried_bytes` is how much of the generation this cut accounted for. The
  // eviction of a leftover generation is its only consumer: everything past
  // that offset arrived after the cut stopped accounting and is the tail no
  // rotation ever carried.
  const d = tmp();
  appendRead(d, { ts: TS, tool: 'Read', target: '/before-the-cut' });
  padToReadsBound(d);
  assert.equal(appendRead(d, { ts: TS, tool: 'Read', target: '/after-the-cut' }).written, true);

  const marker = JSON.parse(liveLines(d)[0]);
  assert.ok(isReadsRotationMarker(marker), 'the new field stopped the marker reading as one');
  assert.equal(typeof marker.carried_bytes, 'number');
  assert.equal(marker.carried_bytes, statSync(rotatedReadsPath(d)).size,
    'the seal is not the size of the generation this cut carried away');
  // The marker is still the whole fresh record: nothing crosses the cut.
  assert.deepEqual(Object.keys(marker), ['ts', 'event', 'file', 'carried_bytes']);
});

test('the SECOND rotation evicts the generation the first one left', () => {
  const d = tmp();
  appendRead(d, { ts: TS, tool: 'Read', target: '/gen-one' });
  padToReadsBound(d);
  assert.equal(appendRead(d, { ts: TS, tool: 'Read', target: '/gen-two' }).written, true);
  padToReadsBound(d);
  assert.equal(appendRead(d, { ts: TS, tool: 'Read', target: '/gen-three' }).written, true);

  // Exactly one prior generation is the WHOLE retention policy: no dated
  // generation, no keep-N, no leaked private temp. The `.claim` sidecar a
  // COMPLETED rotation leaves is inert and deliberate.
  assert.deepEqual(readsSiblings(d), ['reads.1.jsonl', 'reads.1.jsonl.claim', 'reads.jsonl']);

  const live = readFileSync(readsPath(d), 'utf8');
  const sibling = readFileSync(rotatedReadsPath(d), 'utf8');
  assert.ok(live.includes('/gen-three'), 'the live record lost the second rotation\'s append');
  assert.ok(sibling.includes('/gen-two'), 'the sibling is not the generation between the cuts');
  assert.equal(live.includes('/gen-one'), false, 'the first generation survived in the live record');
  assert.equal(sibling.includes('/gen-one'), false, 'the first generation survived in the sibling');
});

test('a record that only reached the generation SURVIVES the second rotation (AC1)', () => {
  // The two-step loss D-05 names. This record has no carry-back, so a writer
  // that appended during a claim window is only in the sibling - the bar the
  // race row accepts. The SECOND rotation evicts that sibling and unlinks it,
  // and the record is in neither file with nothing said. The writer about to
  // destroy the generation finishes the carry the first cut never made.
  const d = tmp();
  appendRead(d, { ts: TS, tool: 'Read', target: '/gen-one' });
  padToReadsBound(d);
  assert.equal(appendRead(d, { ts: TS, tool: 'Read', target: '/gen-two' }).written, true);

  // A racing writer's record, landing in the OLD inode after the cut sealed it.
  // Hand-planted rather than raced: forcing the interleaving deterministically
  // is what makes this a reproduction rather than a 1-in-60 flake (D-10).
  const racer = `${JSON.stringify({ ts: TS, tool: 'Read', agent: 'coordinator', target: '/raced-the-cut' })}\n`;
  appendFileSync(rotatedReadsPath(d), racer);

  padToReadsBound(d);
  assert.equal(appendRead(d, { ts: TS, tool: 'Read', target: '/gen-three' }).written, true);

  const live = readFileSync(readsPath(d), 'utf8');
  const sibling = readFileSync(rotatedReadsPath(d), 'utf8');
  const hits = (t) => t.split('\n').filter((l) => l.includes('/raced-the-cut')).length;
  assert.equal(hits(live) + hits(sibling), 1,
    hits(live) + hits(sibling) === 0
      ? "the racing writer's record is in NEITHER file"
      : "the racing writer's record was carried twice");
  // It is in the LIVE record, because that is the only file that outlives the
  // eviction - and it parses, so a reader gets the record and not a torn line.
  assert.equal(hits(live), 1);
  assert.ok(live.split('\n').some((l) => l && JSON.parse(l).target === '/raced-the-cut'));
});

test('a rescue that cannot READ states the bytes it did not carry, rather than nothing', () => {
  // The goal is a tail that is complete OR a shortfall that is stated. A rescue
  // that fails before it reads a byte still knows the size past the seal, so
  // that is what it reports - and the rotation still rotated.
  const d = tmp();
  const marker = { ts: TS, event: 'record_rotated', file: 'reads.1.jsonl', carried_bytes: 0 };
  writeFileSync(readsPath(d), `${JSON.stringify(marker)}\n`);
  padToReadsBound(d);
  // A generation nothing can read past its own offset: `statSync` answers with
  // a size, `readSync` refuses. The seal is 0, so every one of those bytes is
  // beyond it.
  mkdirSync(rotatedReadsPath(d));
  const unreadable = statSync(rotatedReadsPath(d)).size;
  assert.ok(unreadable > 0, 'fixture: the unreadable generation has no bytes past the seal');

  const res = rotateReads(d, 200);
  assert.equal(res.rotated, true, `the rotation itself failed: ${res.reason}`);
  assert.equal(res.reason, undefined, 'a failed rescue was reported as a failed rotation');
  assert.equal(res.shortfall, unreadable, 'the cut tail was not stated in bytes');
});

test('a leftover sibling beside a record UNDER the bound is left exactly where it is', () => {
  const d = tmp();
  // The interleaving this refuses: another writer rotated while this one was
  // still holding the stat that decided to rotate. Carrying the fresh record
  // away would destroy the generation that writer just made.
  writeFileSync(readsPath(d), `${JSON.stringify({ ts: TS, tool: 'Read', target: '/fresh' })}\n`);
  writeFileSync(rotatedReadsPath(d), 'a generation an earlier rotation left\n');
  const before = readFileSync(rotatedReadsPath(d), 'utf8');

  const res = rotateReads(d, 200);
  assert.equal(res.rotated, false);
  assert.equal(res.reason, undefined, 'a refused claim is not a failed rotation');
  assert.equal(readFileSync(rotatedReadsPath(d), 'utf8'), before, 'the leftover generation was evicted');
  assert.deepEqual(readsSiblings(d), ['reads.1.jsonl', 'reads.jsonl']);
});

// --- the claim, when two writers race (D-05, D-07) --------------------------

import { spawn } from 'node:child_process';

const READS_LIB = new URL('./lib/read-trace.mjs', import.meta.url).href;

/**
 * One child PROCESS appending one uniquely named record through the real
 * `appendRead`. A process rather than a promise because that is the concurrency
 * this record actually has: `hooks/hooks.json:17` matches five tools and the
 * host runs one OS process per tool call, so parallel subagents ARE concurrent
 * `appendRead` processes.
 * @param {string} dir @param {string} name
 */
function readsWriter(dir, name) {
  const code = 'const { appendRead } = await import(process.env.CAD_LIB);'
    + " const r = appendRead(process.env.CAD_DIR, { ts: new Date().toISOString(),"
    + " tool: 'Read', agent: 'coordinator', target: process.env.CAD_W });"
    + ' if (!r.written) { console.error(r.reason); process.exit(1); }';
  return new Promise((res, rej) => {
    const p = spawn(process.execPath, ['--input-type=module', '-e', code], {
      stdio: ['ignore', 'ignore', 'pipe'],
      env: { ...process.env, CAD_LIB: READS_LIB, CAD_DIR: dir, CAD_W: name },
    });
    let err = '';
    p.stderr.on('data', (d) => { err += d; });
    p.on('error', rej);
    p.on('exit', (c) => (c === 0 ? res(name) : rej(new Error(`${name}: ${err.trim()}`))));
  });
}

test('writers racing at the bound leave ONE generation, no claim and no record lost', async () => {
  const d = tmp();
  appendRead(d, { ts: TS, tool: 'Read', target: '/before-the-race' });
  padToReadsBound(d);
  const names = ['w0', 'w1', 'w2', 'w3', 'w4', 'w5'];
  await Promise.all(names.map((n) => readsWriter(d, n)));

  // (a) EVERY writer's record is present ACROSS THE PAIR. This record has no
  // carry-back, so a loser that appended during the claim window is in the
  // SIBLING and that satisfies the bar - unlike the trace, whose racing writers
  // must all land in the live record because it copies those bytes back.
  const live = readFileSync(readsPath(d), 'utf8');
  const sibling = readFileSync(rotatedReadsPath(d), 'utf8');
  for (const n of names) {
    assert.ok(live.includes(`"${n}"`) || sibling.includes(`"${n}"`), `${n} is in neither file`);
  }

  // (b) The sibling is a separate FILE, not a second name for the live record:
  // a claim left held reads as a rotation in flight forever.
  const a = statSync(readsPath(d));
  const b = statSync(rotatedReadsPath(d));
  assert.notEqual(`${a.dev}:${a.ino}`, `${b.dev}:${b.ino}`, 'the claim was never released');

  // (c) Exactly one generation, and no private stamp or temp left behind - the
  // inert `.claim` sidecar of the writer that won is not one.
  assert.deepEqual(readsSiblings(d), ['reads.1.jsonl', 'reads.1.jsonl.claim', 'reads.jsonl']);
});

// --- the abandoned claim ----------------------------------------------------

/**
 * A planning root at the bound whose rotation claim was taken and never
 * released - the state a claimant killed or timed out mid-rotation leaves.
 *
 * Constructed DIRECTLY: no kill, no signal, no child process. A `linkSync` and
 * a dated sidecar reproduce the whole state a SIGKILL produces, and a spawned
 * holder is reserved for the race the `readsWriter` helper already runs.
 *
 * @param {string} d
 * @param {number|null} agoMs how long ago the claim was dated, or `null` for a
 *   claim carrying NO sidecar at all - the shape every claim taken before this
 *   rotation shipped has.
 */
function killedReadsClaim(d, agoMs) {
  appendRead(d, { ts: TS, tool: 'Read', target: '/before-the-kill' });
  padToReadsBound(d);
  linkSync(readsPath(d), rotatedReadsPath(d));
  if (agoMs === null) return;
  writeFileSync(readsClaimPath(d), 'held\n');
  const at = (Date.now() - agoMs) / 1000;
  utimesSync(readsClaimPath(d), at, at);
}

/** @param {string} f */
const idOf = (f) => { const st = statSync(f); return `${st.dev}:${st.ino}`; };

test('an ABANDONED claim is reclaimed rather than disabling rotation forever', () => {
  const d = tmp();
  // Twice the 30 s staleness budget the rotation states.
  killedReadsClaim(d, 60_000);

  const res = appendRead(d, { ts: TS, tool: 'Read', target: '/after-the-reclaim' });
  assert.equal(res.written, true, `the append was refused: ${res.reason}`);
  assert.ok(statSync(readsPath(d)).size < MAX_READS_BYTES, 'the record never rotated');
  assert.notEqual(idOf(readsPath(d)), idOf(rotatedReadsPath(d)), 'the claim is still held');
  assert.ok(readFileSync(rotatedReadsPath(d), 'utf8').includes('/before-the-kill'),
    'the sibling is not the prior generation');
  assert.ok(readFileSync(readsPath(d), 'utf8').includes('/after-the-reclaim'));
});

test('a LIVE claim is left standing, at the cost of one deferred rotation', () => {
  const d = tmp();
  killedReadsClaim(d, 0);
  const stamped = statSync(readsClaimPath(d)).mtimeMs;

  const res = appendRead(d, { ts: TS, tool: 'Read', target: '/deferred' });
  assert.equal(res.written, true, 'a deferred rotation must not cost the append');
  assert.equal(idOf(readsPath(d)), idOf(rotatedReadsPath(d)), 'a live claim was broken');
  // A writer that LOSES the link must not refresh a claim it does not own: that
  // is what would restart the staleness clock on every append and stop an
  // abandoned claim ever ageing into a reclaim.
  assert.equal(statSync(readsClaimPath(d)).mtimeMs, stamped, 'a loser refreshed the claim');
});

test('a claim carrying NO sidecar at all reads as live, the same way', () => {
  const d = tmp();
  killedReadsClaim(d, null);
  const res = appendRead(d, { ts: TS, tool: 'Read', target: '/no-sidecar' });
  assert.equal(res.written, true);
  assert.equal(idOf(readsPath(d)), idOf(rotatedReadsPath(d)),
    'an unknowable claim age broke a claim rather than failing live');
  assert.equal(existsSync(readsClaimPath(d)), false, 'a loser published a stamp it does not own');
});

test('an eviction that cannot CONFIRM its claim puts the generation back (AC3)', () => {
  // The leftover-generation arm used to skip the confirm on the grounds that
  // its own discriminator answered - but that discriminator is read BEFORE the
  // eviction rename, so a writer that linked in between has a live claim
  // renamed away with nothing to put it back, and the cost is the whole record
  // rather than one deferred rotation (D-02).
  const d = tmp();
  appendRead(d, { ts: TS, tool: 'Read', target: '/before-the-eviction' });
  padToReadsBound(d);
  // A leftover generation an earlier rotation left...
  writeFileSync(rotatedReadsPath(d), 'a generation an earlier rotation left\n');
  const generation = readFileSync(rotatedReadsPath(d), 'utf8');
  // ...and a sidecar path `publish` cannot date, so the claim is unconfirmable
  // and `mine` is still null when the confirm asks.
  mkdirSync(readsClaimPath(d));

  const res = appendRead(d, { ts: TS, tool: 'Read', target: '/after-the-eviction' });
  assert.equal(res.written, true, `an unconfirmable eviction cost the append: ${res.reason}`);
  assert.equal(readFileSync(rotatedReadsPath(d), 'utf8'), generation,
    'the generation was destroyed by an eviction that could not confirm its claim');
  assert.deepEqual(readsSiblings(d).filter((f) => f.includes('.evict')), [],
    'the evicted generation was left at its private path');
  assert.ok(readFileSync(readsPath(d), 'utf8').includes('/after-the-eviction'),
    "the writer's own record is not in the live record");
});

test('a COMPLETED rotation leaves its sidecar behind, inert, and does not rotate again', () => {
  const d = tmp();
  appendRead(d, { ts: TS, tool: 'Read', target: '/gen-one' });
  padToReadsBound(d);
  assert.equal(appendRead(d, { ts: TS, tool: 'Read', target: '/gen-two' }).written, true);
  assert.deepEqual(readsSiblings(d), ['reads.1.jsonl', 'reads.1.jsonl.claim', 'reads.jsonl']);

  const generation = readFileSync(rotatedReadsPath(d), 'utf8');
  assert.equal(appendRead(d, { ts: TS, tool: 'Read', target: '/gen-three' }).written, true);
  assert.equal(readFileSync(rotatedReadsPath(d), 'utf8'), generation,
    'the inert sidecar was read as a claim and the record rotated again');
  assert.deepEqual(liveLines(d).length, 3, 'the live record is not marker + two appends');
});

test('a single record that reaches the bound by itself is refused, never rotated', () => {
  const d = tmp();
  appendRead(d, { ts: TS, tool: 'Read', target: '/a' });
  const before = statSync(readsPath(d)).size;

  const res = appendRead(d, { ts: TS, tool: 'Read', target: 'x'.repeat(MAX_READS_BYTES) });
  assert.equal(res.written, false);
  assert.equal(res.reason, 'oversized-record');
  assert.equal(statSync(readsPath(d)).size, before, 'the oversized record was appended anyway');
  assert.equal(existsSync(rotatedReadsPath(d)), false,
    'the record was thrown away to make room for a line that still would not fit');
});

/**
 * Append one record whose serialized line is exactly `bytes` long.
 * @param {string} d @param {number} bytes
 */
function sizedRead(d, bytes) {
  const skeleton = `${JSON.stringify({ ts: TS, tool: 'Read', agent: 'coordinator', target: '' })}\n`;
  const n = bytes - Buffer.byteLength(skeleton);
  assert.ok(n >= 0, 'fixture: the skeleton is already longer than the requested line');
  return appendRead(d, { ts: TS, tool: 'Read', agent: 'coordinator', target: 'y'.repeat(n) });
}

test('a record with no room BESIDE the marker is refused, not rotated for (AC2)', () => {
  // The rotation always writes its marker into the fresh record too, so a
  // record that fits under the bound alone but not beside the marker used to
  // rotate and then land a file over its bound on the first write (measured
  // 2026-08-30: 74 B over). It is refused now - the deliberate band D-09 names.
  const d = tmp();
  appendRead(d, { ts: TS, tool: 'Read', target: '/before' });
  padToReadsBound(d);
  const before = readFileSync(readsPath(d), 'utf8');

  const res = sizedRead(d, MAX_READS_BYTES - 8);
  assert.deepEqual(res, { written: false, reason: 'oversized-record' });
  assert.equal(readFileSync(readsPath(d), 'utf8'), before,
    'the record it would have rotated is not byte-identical');
  assert.deepEqual(readsSiblings(d), ['reads.jsonl'], 'nothing was rotated');
});

test('a record that DOES fit beside the marker rotates under the bound (AC2)', () => {
  // ONE BYTE inside the reserve, which is the tightest admission there is. The
  // reserve is an upper BOUND rather than a measurement, so a real marker is
  // narrower than it by the digits `carried_bytes` does not use - which is why
  // the row binds to the constant and not to a marker it measured.
  assert.ok(READS_MARKER_BYTES > Buffer.byteLength(
    `${JSON.stringify({ ts: TS, event: 'record_rotated', file: 'reads.1.jsonl', carried_bytes: MAX_READS_BYTES })}\n`,
  ), 'the reserve is narrower than a real marker at the bound');

  const d = tmp();
  appendRead(d, { ts: TS, tool: 'Read', target: '/before' });
  padToReadsBound(d);
  assert.equal(sizedRead(d, MAX_READS_BYTES - READS_MARKER_BYTES - 1).written, true,
    'the reserve is wider than the marker the rotation writes');
  assert.ok(existsSync(rotatedReadsPath(d)), 'it still rotated');
  assert.ok(statSync(readsPath(d)).size <= MAX_READS_BYTES,
    `the rotation's FIRST write left the record ${statSync(readsPath(d)).size - MAX_READS_BYTES} B over its bound`);
});

test('a bad record is refused by reason, never thrown', () => {
  const d = tmp();
  for (const bad of [null, undefined, 'str', 42, []]) {
    const res = appendRead(d, bad);
    assert.equal(res.written, false);
    assert.equal(res.reason, 'bad-record');
  }
  assert.equal(existsSync(readsPath(d)), false, 'a refused record created the file');
});

test('an unwritable root returns a reason rather than throwing', () => {
  const res = appendRead('/proc/nonexistent-cadence-root', { ts: TS, tool: 'Read' });
  assert.equal(res.written, false);
  assert.ok(res.reason, 'no reason given');
});

// --- the summary ------------------------------------------------------------

import { summarizeReads } from './lib/read-trace.mjs';

const rec = (agent, tool, target, bytes) => {
  const r = { ts: TS, agent, tool };
  if (target !== undefined) r.target = target;
  if (bytes !== undefined) r.bytes = bytes;
  return r;
};

test('redundancy is calls-over-distinct, the figure the ledger asks for', () => {
  const s = summarizeReads([
    rec('cad-executor', 'Read', '/a'),
    rec('cad-executor', 'Read', '/a'),
    rec('cad-executor', 'Read', '/a'),
    rec('cad-executor', 'Read', '/b'),
  ]);
  assert.equal(s.calls, 4);
  assert.equal(s.distinct, 2);
  assert.equal(s.redundancy, 2);
});

test('an untargeted call counts as a call but cannot count as a repeat', () => {
  const s = summarizeReads([rec('coordinator', 'Bash', undefined), rec('coordinator', 'Read', '/a')]);
  assert.equal(s.calls, 2);
  assert.equal(s.distinct, 1);
  assert.equal(s.redundancy, 1, 'the untargeted call inflated the ratio');
});

test('no targets at all yields no redundancy rather than infinity', () => {
  const s = summarizeReads([rec('coordinator', 'Bash', undefined)]);
  assert.equal(s.redundancy, null);
  assert.equal(summarizeReads([]).redundancy, null);
});

test('coordinator and worker reading are split apart', () => {
  const s = summarizeReads([
    rec('coordinator', 'Read', '/a'),
    rec('cad-executor', 'Read', '/b'),
    rec('cad-executor', 'Grep', '/c'),
  ]);
  assert.deepEqual(s.byAgent, [['cad-executor', 2], ['coordinator', 1]]);
  assert.deepEqual(s.byTool, [['Read', 2], ['Grep', 1]]);
});

test('a partial byte capture never reads as a total', () => {
  const s = summarizeReads([rec('a', 'Read', '/a', 100), rec('a', 'Read', '/b')]);
  assert.equal(s.bytes, 100);
  assert.equal(s.bytesCoverage, 0.5, 'coverage must show the figure covers half the calls');

  const none = summarizeReads([rec('a', 'Read', '/a')]);
  assert.equal(none.bytes, null, 'zero captured bytes must not read as zero bytes read');
});

test('junk records are skipped rather than throwing', () => {
  const s = summarizeReads([null, 'str', 42, rec('a', 'Read', '/a')]);
  assert.equal(s.calls, 1);
});

test('a command that opens with cd bills the program that did the work', () => {
  assert.equal(programOf('cd /code/cadence && rg --files'), 'rg');
  assert.equal(programOf('cd /a; git status'), 'git');
  assert.equal(programOf('cd /a && cd /b && node x.mjs'), 'node');
  assert.equal(programOf('cd /code/cadence'), null, 'a bare cd has no program to bill');
  assert.equal(programOf('git status && cd /a'), 'git', 'the first real program still wins');
});

test('a pipeline bills its first real stage, and secrets stay stripped per segment', () => {
  assert.equal(programOf('cat f | grep x'), 'cat');
  assert.equal(programOf('cd /a && TOKEN=ghp_x curl https://api'), 'curl');
  assert.ok(!String(programOf('cd /a && TOKEN=ghp_x curl https://api')).includes('ghp_'));
});

test('a heredoc body cannot reach the record', () => {
  const cmd = [
    'cd /code/cadence',
    "python3 - <<'EOF'",
    'x = "a | b && c"',
    'TOKEN=sk-live-XXXX',
    'EOF',
  ].join('\n');
  const prog = programOf(cmd);
  assert.equal(prog, 'python3');
  assert.ok(!String(prog).includes('sk-live'));
});

test('anything that is not a bare program name is refused, not recorded', () => {
  assert.equal(programOf('cd /a && "quoted thing"'), null);
  assert.equal(programOf('cd /a && `backtick`'), null);
  assert.equal(programOf('cd /a && $VAR'), null);
  assert.equal(programOf('cd /a && ...`'), null, 'the exact token the live hook billed');
});

test('ordinary commands still bill correctly after hardening', () => {
  assert.equal(programOf('git status'), 'git');
  assert.equal(programOf('cd /a && node --test x.mjs'), 'node');
  assert.equal(programOf('/usr/bin/rg --files'), 'rg');
  assert.equal(programOf('python3.14 -c pass'), 'python3.14');
});


// --- in-repo file paths out of a Bash command line -------------------------
//
// The rule that recovers what `programOf` throws away, and the redaction
// argument it rests on: a path qualifies by EXISTING inside the project, and a
// secret value does not exist as a file, so it is dropped before it is written.

// The real predicate, not a stub: confinement and the file/directory
// distinction are only worth testing against a real tree.
const isFile = (p) => { try { return statSync(p).isFile(); } catch { return false; } };

function fixture() {
  const root = tmp();
  mkdirSync(join(root, 'src'), { recursive: true });
  mkdirSync(join(root, 'docs'), { recursive: true });
  writeFileSync(join(root, 'src', 'app.mjs'), 'x');
  writeFileSync(join(root, 'src', 'util.mjs'), 'x');
  writeFileSync(join(root, 'docs', 'README.md'), 'x');
  return root;
}

test('a Bash command yields the in-repo files it names, relative to the root', () => {
  const root = fixture();
  assert.deepEqual(
    filesOf('sed -n 1,20p src/app.mjs', { root, isFile }),
    [join('src', 'app.mjs')],
  );
  assert.deepEqual(
    filesOf('cat src/app.mjs src/util.mjs docs/README.md', { root, isFile }),
    [join('src', 'app.mjs'), join('src', 'util.mjs'), join('docs', 'README.md')],
  );
});

test('a secret in the command line is not a file, so it cannot be recorded', () => {
  const root = fixture();
  const cmds = [
    'curl -H "Authorization: Bearer sk-live-XXXX" https://api.example.com',
    'export API_KEY=sk-live-XXXX && node src/app.mjs',
    'psql postgres://user:hunter2@db.internal/prod -c "select 1"',
    // The adversarial one: a token SHAPED like a path. It still is not a file.
    'deploy --key sk/live/AKIAIOSFODNN7EXAMPLE',
  ];
  for (const c of cmds) {
    const out = filesOf(c, { root, isFile });
    const s = JSON.stringify(out);
    assert.ok(!s.includes('sk-live'), `a token reached the record: ${c}`);
    assert.ok(!s.includes('hunter2'), `a password reached the record: ${c}`);
    assert.ok(!s.includes('AKIA'), `a key reached the record: ${c}`);
  }
  // The one command above that names a real file still bills it, so the filter
  // is not simply refusing everything.
  assert.deepEqual(
    filesOf('export API_KEY=sk-live-XXXX && node src/app.mjs', { root, isFile }),
    [join('src', 'app.mjs')],
  );
});

test('a path outside the project is refused however real it is', () => {
  const root = fixture();
  const outside = tmp();
  writeFileSync(join(outside, 'credentials'), 'x');
  assert.deepEqual(filesOf(`cat ${join(outside, 'credentials')}`, { root, isFile }), []);
  assert.deepEqual(filesOf('cat /etc/hostname /etc/passwd', { root, isFile }), []);
  assert.deepEqual(filesOf('cat ../../../etc/passwd', { root, isFile }), []);
});

test('a directory is not a read, and a nonexistent path is not a file', () => {
  const root = fixture();
  assert.deepEqual(filesOf('ls src', { root, isFile }), []);
  assert.deepEqual(filesOf('ls src/', { root, isFile }), []);
  assert.deepEqual(filesOf('cat src/nope.mjs', { root, isFile }), []);
});

test('quoted, expanded or globbed tokens are content and never candidates', () => {
  const root = fixture();
  assert.deepEqual(filesOf('cat "src/app.mjs"', { root, isFile }), []);
  assert.deepEqual(filesOf('cat $FILE', { root, isFile }), []);
  assert.deepEqual(filesOf('cat src/*.mjs', { root, isFile }), []);
  assert.deepEqual(filesOf('cat `which node`', { root, isFile }), []);
  assert.deepEqual(filesOf('cat $(ls src/app.mjs)', { root, isFile }), []);
});

test('a heredoc body cannot contribute a path, matching programOf', () => {
  const root = fixture();
  const cmd = 'python3 - <<EOF\nopen("src/app.mjs")\nEOF';
  assert.deepEqual(filesOf(cmd, { root, isFile }), []);
});

test('relative tokens resolve against the calls own cwd, not just the root', () => {
  const root = fixture();
  assert.deepEqual(
    filesOf('cat app.mjs', { root, cwd: join(root, 'src'), isFile }),
    [join('src', 'app.mjs')],
  );
});

test('the per-call file cap bounds a sweep', () => {
  const root = tmp();
  const names = [];
  for (let i = 0; i < MAX_FILES_PER_CALL + 5; i++) {
    names.push(`f${i}.txt`);
    writeFileSync(join(root, `f${i}.txt`), 'x');
  }
  assert.equal(filesOf(`cat ${names.join(' ')}`, { root, isFile }).length, MAX_FILES_PER_CALL);
});

test('with no opts the record is byte-identical to what it was before files existed', () => {
  const input = { tool_name: 'Bash', tool_input: { command: 'sed -n 1,20p src/app.mjs' } };
  const before = recordFromHook(input, TS);
  assert.equal(before.target, 'sed');
  assert.equal(before.files, undefined);
  assert.ok(!Object.prototype.hasOwnProperty.call(before, 'files'));
});

test('recordFromHook carries the files through when the caller supplies a root', () => {
  const root = fixture();
  const r = recordFromHook({
    tool_name: 'Bash',
    cwd: root,
    tool_input: { command: 'grep -n export src/app.mjs src/util.mjs' },
  }, TS, { root, isFile });
  assert.equal(r.target, 'grep');
  assert.deepEqual(r.files, [join('src', 'app.mjs'), join('src', 'util.mjs')]);
});

test('a Bash call naming no in-repo file carries no files field at all', () => {
  const root = fixture();
  const r = recordFromHook({
    tool_name: 'Bash', cwd: root, tool_input: { command: 'git status --short' },
  }, TS, { root, isFile });
  assert.equal(r.target, 'git');
  assert.ok(!Object.prototype.hasOwnProperty.call(r, 'files'));
});

// --- the two redundancies stay unpooled ------------------------------------

test('file redundancy is path-touches over distinct files, apart from target redundancy', () => {
  const s = summarizeReads([
    { tool: 'Bash', target: 'sed', files: ['a.mjs'] },
    { tool: 'Bash', target: 'sed', files: ['a.mjs'] },
    { tool: 'Bash', target: 'grep', files: ['a.mjs', 'b.mjs'] },
    { tool: 'Bash', target: 'node' },
  ]);
  // The old figure still measures shell verbs: 4 target-touches over 3 verbs.
  assert.equal(s.distinct, 3);
  assert.equal(s.redundancy, 1.33);
  // The new one measures files: 4 touches over 2 distinct.
  assert.equal(s.distinctFiles, 2);
  assert.equal(s.fileTouches, 4);
  assert.equal(s.fileRedundancy, 2);
  // And how much of the corpus the file half covers, so a legacy corpus never
  // reads as a total.
  assert.equal(s.fileCalls, 3);
  assert.equal(s.calls, 4);
  assert.deepEqual(s.topFiles, [['a.mjs', 3], ['b.mjs', 1]]);
});

test('a corpus recorded before files existed yields no file measurement rather than zero', () => {
  const s = summarizeReads([
    { tool: 'Bash', target: 'sed' },
    { tool: 'Bash', target: 'grep' },
  ]);
  assert.equal(s.fileCalls, 0);
  assert.equal(s.distinctFiles, 0);
  assert.equal(s.fileRedundancy, null);
  assert.deepEqual(s.topFiles, []);
});

// --- the join: a read record back to the bracket that caused it (D-10, D-11) -
//
// Read-time inference, never a corr stamped at hook time: a hook-time stamp
// gives a read running inside a subagent the coordinator's current corr, which
// is confidently wrong rather than honestly absent. Pure by injection, so the
// caller supplies the bracket rows and this needs no trace file.

import { joinReads, HOST_AGENT_TYPES, roleOfAgent } from './lib/read-trace.mjs';

/** One paired bracket row, the shape `renderTrace(...).brackets` returns. */
const span = (role, plan, from, to) => ({
  corr: '4-abc1234', phase: '4', plan, role, event: 'return',
  ts: from, end: to, ms: Date.parse(to) - Date.parse(from), tokens: 100,
});
/** One reads.jsonl record. */
const read = (agent, ts, extra) => ({ ts, tool: 'Read', target: '/x', ...(agent === undefined ? {} : { agent }), ...extra });

const T = (m) => new Date(Date.UTC(2026, 7, 14, 12, m, 0)).toISOString();

test('join: a rung-suffixed agent normalizes to its role and joins its bracket', () => {
  // `cadence:cad-verifier-medium` is a FILE stem; the dispatch event names the
  // ROLE. lib/rung-agent.mjs is the one statement of that mapping.
  const brackets = [span('cad-verifier', 'cad-verifier', T(0), T(10))];
  const j = joinReads([read('cadence:cad-verifier-medium', T(5))], brackets);
  assert.equal(j.joined, 1);
  assert.equal(j.rows[0].role, 'cad-verifier');
  assert.equal(j.rows[0].status, 'joined');
  assert.equal(j.rows[0].bracket.plan, 'cad-verifier');
});

test('join: the same record outside every bracket of its role is unjoined', () => {
  const brackets = [span('cad-verifier', 'cad-verifier', T(0), T(10))];
  const j = joinReads([read('cadence:cad-verifier-medium', T(20))], brackets);
  assert.equal(j.unjoined, 1);
  assert.equal(j.joined, 0);
  assert.equal(j.rows[0].bracket, null);
  // ...and a bracket of a DIFFERENT role containing the same instant does not
  // catch it either: the role is half the key, not decoration.
  const other = joinReads([read('cadence:cad-verifier-medium', T(5))],
    [span('cad-executor', '1', T(0), T(10))]);
  assert.equal(other.unjoined, 1);
});

test('join: a record inside two overlapping same-role brackets is AMBIGUOUS, joined to neither', () => {
  // The measured case: phase 4 plans 1 and 2 open a second apart, both
  // `cad-executor`. Picking one would be wrong exactly on the largest subagent
  // share of the corpus (440 records), so the join reports and picks none.
  const brackets = [
    span('cad-executor', '1', T(0), T(30)),
    span('cad-executor', '2', T(1), T(31)),
  ];
  const j = joinReads([read('cadence:cad-executor', T(10))], brackets);
  assert.equal(j.ambiguous, 1);
  assert.equal(j.joined, 0);
  assert.equal(j.rows[0].status, 'ambiguous');
  assert.equal(j.rows[0].bracket, null);
  // A read inside only ONE of the two still joins - ambiguity is per record,
  // never a property of the overlapping pair.
  assert.equal(joinReads([read('cadence:cad-executor', T(31))], brackets).joined, 1);
});

test('join: the host agent types are a stated FLOOR, never a failed join', () => {
  const brackets = [span('cad-executor', '1', T(0), T(30))];
  const j = joinReads(HOST_AGENT_TYPES.map((a) => read(a, T(10))), brackets);
  assert.deepEqual(HOST_AGENT_TYPES, ['fork', 'general-purpose']);
  assert.equal(j.floor, 2);
  assert.equal(j.joined, 0);
  assert.equal(j.unjoined, 0);
  // They fall inside a bracket in wall-clock terms and STILL do not join:
  // nothing in this plugin opens a bracket for a host type, so a containment
  // hit there would be an invented attribution.
  for (const row of j.rows) assert.equal(row.status, 'floor');
});

test('the role mapping is EXPORTED, so the stop hook reads it rather than copying it', () => {
  // `lib/subagent-trace.mjs`'s self-filter asks the same question of the same
  // `<plugin>:<agent-file-stem>` spelling. It imports this function; a second
  // copy of the map is how two readers of one record start disagreeing about
  // which bracket closed.
  assert.equal(typeof roleOfAgent, 'function');
  assert.equal(roleOfAgent('cadence:cad-executor-xhigh'), 'cad-executor');
  assert.equal(roleOfAgent('cad-verifier-medium'), 'cad-verifier');
  // Null for the host's own types, for `coordinator`, and for a non-string.
  for (const a of [...HOST_AGENT_TYPES, 'Explore', 'claude-code-guide', 'coordinator', '', 7, null]) {
    assert.equal(roleOfAgent(a), null, `${String(a)} resolved to a role`);
  }
});

test('join: a record with no agent field names the field absent rather than defaulting', () => {
  const j = joinReads([read(undefined, T(5)), read('unknown-agent', T(5))],
    [span('cad-executor', '1', T(0), T(30))]);
  assert.equal(j.unresolved, 2);
  assert.equal(j.coordinator, 0);
  assert.equal(j.rows[0].agent, null);
  assert.equal(j.rows[0].role, null);
  assert.equal(j.rows[0].agent_id, null);
  // `unknown-agent` is the writer's mark for a call that carried an `agent_id`
  // and no `agent_type`: a subagent read whose role is not knowable, which is
  // not the same claim as "no bracket contained it".
  assert.equal(j.rows[1].agent, 'unknown-agent');
  assert.equal(j.rows[1].status, 'unresolved');
});

test('join: a coordinator read is its own bucket, never an unjoined worker read', () => {
  // 1,006 of 2,725 records are the main thread's. Folding them into `unjoined`
  // would report a thousand failed joins for reads that have no worker bracket
  // by construction.
  const j = joinReads([read('coordinator', T(5))], [span('cad-executor', '1', T(0), T(30))]);
  assert.equal(j.coordinator, 1);
  assert.equal(j.unjoined, 0);
});

test('join: an unreadable timestamp on either side is refused, never widened', () => {
  const brackets = [span('cad-executor', '1', T(0), T(30))];
  // The RECORD's ts: unparseable means it cannot be placed, not that it lands
  // outside every bracket.
  assert.equal(joinReads([read('cadence:cad-executor', 'not-a-time')], brackets).unresolved, 1);
  // The BRACKET's: a half-open row is dropped rather than swallowing every read
  // of its role.
  const broken = [{ ...span('cad-executor', '1', T(0), T(30)), end: null }];
  assert.equal(joinReads([read('cadence:cad-executor', T(5))], broken).unjoined, 1);
});

test('join: no bracket rows at all is every subagent read unjoined, never an error', () => {
  const j = joinReads([read('cadence:cad-planner', T(5))], []);
  assert.equal(j.unjoined, 1);
  assert.deepEqual(joinReads([], []).rows, []);
  assert.equal(joinReads(null, null).joined, 0);
});

// --- the join through the seam, on COMMITTED fixtures (D-22) ------------------
//
// `.planning/trace.jsonl` and `.planning/reads.jsonl` are both gitignored, so
// the live corpus cannot be a regression input - and it would leave the
// overlapping same-role case untested anyway, since it holds exactly two such
// pairs among a hundred brackets. The fixtures carry one ordinary role bracket,
// the overlapping pair, and reads that land inside one, inside both, outside
// all, under the two HOST agent types and on the coordinator.

import { execFileSync } from 'node:child_process';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, 'fixtures');
const PLANNING = join(HERE, 'planning.mjs');

/** A planning root holding both committed fixtures under their real names. */
function joinRoot() {
  const dir = join(tmp(), '.planning');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'trace.jsonl'), readFileSync(join(FIXTURES, 'join.trace.jsonl'), 'utf8'));
  writeFileSync(join(dir, 'reads.jsonl'), readFileSync(join(FIXTURES, 'join.reads.jsonl'), 'utf8'));
  return dir;
}

/** Run the seam and parse its one JSON line, ok:false included. */
function seam(dir, args) {
  try {
    return JSON.parse(execFileSync('node', [PLANNING, '--dir', dir, ...args], { encoding: 'utf8' }));
  } catch (e) {
    return JSON.parse(e.stdout);
  }
}

test('seam: `reads --join` reports four figures the fixtures fix exactly', () => {
  const r = seam(joinRoot(), ['reads', '--join']);
  assert.equal(r.ok, true);
  assert.equal(r.calls, 8);
  // Two reads land inside exactly one bracket of their role: the verifier's at
  // 12:05, and the executor's at 12:41 - past plan 1's close, inside plan 2's.
  assert.equal(r.joined, 2);
  // ONE lands inside both overlapping `cad-executor` brackets and is refused
  // rather than guessed at.
  assert.equal(r.ambiguous, 1);
  // Two land outside every bracket of their role: the planner (no planner
  // bracket at all) and the executor read at 13:00.
  assert.equal(r.unjoined, 2);
  // The permanent floor: one `fork`, one `general-purpose`.
  assert.equal(r.floor, 2);
  assert.equal(r.coordinator, 1);
  assert.equal(r.unresolved, 0);
  // Every record is in exactly one bucket, so the four figures a report prints
  // are a partition and not a sample.
  assert.equal(r.joined + r.ambiguous + r.unjoined + r.floor + r.coordinator + r.unresolved, r.calls);
});

test('seam: `reads` WITHOUT the flag returns the envelope it always returned', () => {
  const dir = joinRoot();
  const plain = seam(dir, ['reads']);
  for (const k of ['joined', 'ambiguous', 'unjoined', 'floor', 'coordinator', 'unresolved']) {
    assert.ok(!(k in plain), `${k} rode an unasked-for envelope`);
  }
  // ...and the shared half is byte-identical between the two calls.
  const joined = seam(dir, ['reads', '--join']);
  for (const k of Object.keys(plain)) {
    assert.deepEqual(joined[k], plain[k], k);
  }
});

test('seam: an empty record still says `no reads recorded yet` under the flag', () => {
  const dir = join(tmp(), '.planning');
  mkdirSync(dir, { recursive: true });
  const r = seam(dir, ['reads', '--join']);
  assert.equal(r.ok, true);
  assert.equal(r.note, 'no reads recorded yet');
  // The absent-file arm returns before the join, so a project that has not run
  // since the hook was installed reports nothing rather than six zeroes that
  // would read as a join that found nothing.
  assert.ok(!('joined' in r));
});

// --- the in-dispatch fold: per role, WITHIN one bracket (RDX-01) -------------
//
// The distinction this section exists to pin is the one
// `.planning/spikes/read-set-redundancy/SPIKE.md` records its first pass
// getting wrong: distinct summed PER BRACKET measures re-reading inside one
// dispatch, while one distinct count over a role's whole corpus measures the
// opposite thing and cannot tell "20 times in one dispatch" from "once in each
// of 20 dispatches".

import { inDispatchReads } from './lib/read-trace.mjs';

/** One file-carrying read by `agent` at `ts`. */
const fileRead = (agent, ts, ...files) => read(agent, ts, { files });

test('in-dispatch: distinct is summed PER BRACKET, so the ratio is in-dispatch and not corpus-wide', () => {
  const b1 = span('cad-executor', '1', T(0), T(10));
  const b2 = span('cad-executor', '2', T(20), T(30));
  const exec = 'cadence:cad-executor';
  const j = joinReads([
    // Bracket 1: `a.mjs` six times, `b.mjs` once.
    fileRead(exec, T(1), 'a.mjs'), fileRead(exec, T(2), 'a.mjs'), fileRead(exec, T(3), 'a.mjs'),
    fileRead(exec, T(4), 'a.mjs'), fileRead(exec, T(5), 'a.mjs'), fileRead(exec, T(6), 'a.mjs'),
    fileRead(exec, T(7), 'b.mjs'),
    // Bracket 2: `a.mjs` five times.
    fileRead(exec, T(21), 'a.mjs'), fileRead(exec, T(22), 'a.mjs'), fileRead(exec, T(23), 'a.mjs'),
    fileRead(exec, T(24), 'a.mjs'), fileRead(exec, T(25), 'a.mjs'),
  ], [b1, b2]);
  const d = inDispatchReads(j.rows);
  assert.equal(d.roles.length, 1);
  const row = d.roles[0];
  assert.equal(row.role, 'cad-executor');
  assert.equal(row.brackets, 2);
  assert.equal(row.touches, 12);
  // 2 distinct inside bracket 1 plus 1 inside bracket 2. A corpus-wide distinct
  // count would be 2 here and report 6.0 - the number that cannot be acted on.
  assert.equal(row.distinct, 3);
  assert.equal(row.ratio, 4);
  // The named target, and the dispatch that held it: a per-file count is what a
  // reader can act on where a role-wide ratio is not.
  assert.deepEqual(row.worst, { path: 'a.mjs', count: 6, phase: '4', plan: '1' });
  assert.equal(d.joined, 12);
  assert.equal(d.fileCarrying, 12);
  assert.equal(d.coverage, 1);
  assert.equal(d.coordinatorFiles, 0);
});

test('in-dispatch: a role whose joined reads carry no `files` reports a NULL ratio, never 0', () => {
  // Every record written before the `files` field existed is exactly this
  // shape, so a zero here would tell a reader the worker opened each file once.
  const j = joinReads([read('cadence:cad-verifier-medium', T(5))],
    [span('cad-verifier', 'cad-verifier', T(0), T(10))]);
  const d = inDispatchReads(j.rows);
  assert.equal(d.roles.length, 1);
  assert.deepEqual(d.roles[0],
    { role: 'cad-verifier', brackets: 0, touches: 0, distinct: 0, worst: null, ratio: null });
  assert.equal(d.joined, 1);
  assert.equal(d.fileCarrying, 0);
  // Coverage is a share of the joined reads, so it reads 0 here honestly - the
  // reads happened and carried nothing - while the RATIO stays absent.
  assert.equal(d.coverage, 0);
  // Nothing joined at all is no coverage measurement rather than a coverage of
  // nothing, the same posture the ratio takes.
  assert.equal(inDispatchReads([]).coverage, null);
  assert.deepEqual(inDispatchReads(null).roles, []);
});

test('in-dispatch: a coordinator read carrying files is EXCLUDED and counted, never attributed', () => {
  // The main thread has no dispatch bracket by construction, so its re-reading
  // is outside anything this figure can measure. Stated as a count rather than
  // silently dropped.
  const j = joinReads([
    read('coordinator', T(5), { files: ['a.mjs', 'b.mjs'] }),
    read('coordinator', T(6), { files: ['a.mjs'] }),
    read('coordinator', T(7)),
    fileRead('cadence:cad-executor', T(5), 'a.mjs'),
  ], [span('cad-executor', '1', T(0), T(10))]);
  const d = inDispatchReads(j.rows);
  assert.equal(d.coordinatorFiles, 2);
  assert.equal(d.roles.length, 1);
  // The coordinator's three touches of `a.mjs`/`b.mjs` reach no role's figures.
  assert.equal(d.roles[0].touches, 1);
  assert.equal(d.roles[0].distinct, 1);
  assert.equal(d.joined, 1);
});

test('in-dispatch: a read joined to no bracket contributes to nothing at all', () => {
  const brackets = [span('cad-executor', '1', T(0), T(10)), span('cad-executor', '2', T(1), T(11))];
  const j = joinReads([
    fileRead('cadence:cad-executor', T(5), 'a.mjs'),   // ambiguous: inside both
    fileRead('cadence:cad-executor', T(50), 'a.mjs'),  // unjoined: inside neither
    fileRead('fork', T(5), 'a.mjs'),                   // floor: a host agent type
    fileRead('unknown-agent', T(5), 'a.mjs'),          // unresolved: no role
  ], brackets);
  assert.equal(j.joined, 0);
  const d = inDispatchReads(j.rows);
  assert.deepEqual(d.roles, []);
  assert.equal(d.joined, 0);
  assert.equal(d.fileCarrying, 0);
  assert.equal(d.coverage, null);
  assert.equal(d.coordinatorFiles, 0);
});

// --- the in-dispatch figures through the seam (RDX-01) -----------------------
//
// `reads --join` carries the same fold `trace suggest` reads, so `/cad-report`
// and `/cad-suggest` price re-reading off one implementation and neither
// recomputes it in prose.

/** A planning root holding the committed reread pair under their real names. */
function rereadRoot() {
  const dir = join(tmp(), '.planning');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'trace.jsonl'), readFileSync(join(FIXTURES, 'reread.trace.jsonl'), 'utf8'));
  writeFileSync(join(dir, 'reads.jsonl'), readFileSync(join(FIXTURES, 'reread.reads.jsonl'), 'utf8'));
  return dir;
}

test('seam: `reads --join` carries the per-role in-dispatch rows the fixtures fix exactly', () => {
  const r = seam(rereadRoot(), ['reads', '--join']);
  assert.equal(r.ok, true);
  assert.equal(r.calls, 17);
  // 10 touches over 3 summed distinct across two non-overlapping brackets.
  const exec = r.inDispatch.roles.find((x) => x.role === 'cad-executor');
  assert.ok(exec, JSON.stringify(r.inDispatch));
  assert.equal(exec.brackets, 2);
  assert.equal(exec.touches, 10);
  assert.equal(exec.distinct, 3);
  assert.equal(exec.ratio, 3.33);
  assert.deepEqual(exec.worst,
    { path: 'cadence-core/bin/planning.mjs', count: 7, phase: '4', plan: '1' });
  // The noise-band role is REPORTED here even though R7 will not speak on it:
  // this face is a measurement, and the floor lives in the rule.
  const planner = r.inDispatch.roles.find((x) => x.role === 'cad-planner');
  assert.equal(planner.ratio, 3);
  assert.deepEqual(planner.worst,
    { path: '.planning/PROJECT.md', count: 4, phase: '4', plan: 'cad-planner' });
  // The two limits the prose faces have to STATE rather than assume.
  assert.equal(r.inDispatch.coverage, 1);
  assert.equal(r.inDispatch.joined, 16);
  assert.equal(r.inDispatch.fileCarrying, 16);
  assert.equal(r.inDispatch.coordinatorFiles, 1);
});

test('seam: the join fixtures carry no `files`, so the new key holds NO measurement, never a zero', () => {
  const r = seam(joinRoot(), ['reads', '--join']);
  assert.equal(r.ok, true);
  for (const row of r.inDispatch.roles) {
    assert.equal(row.ratio, null, `a ratio was invented for ${row.role}: ${JSON.stringify(row)}`);
    assert.equal(row.worst, null, JSON.stringify(row));
    assert.equal(row.brackets, 0);
  }
  assert.ok(!JSON.stringify(r.inDispatch).includes('"ratio":0'),
    `a null ratio was rendered as 0: ${JSON.stringify(r.inDispatch)}`);
  assert.equal(r.inDispatch.fileCarrying, 0);
});

test('seam: `reads` WITHOUT the flag still carries no in-dispatch key at all', () => {
  const plain = seam(rereadRoot(), ['reads']);
  assert.equal('inDispatch' in plain, false, 'the in-dispatch fold rode an unasked-for envelope');
  // ...and the absent-file arm returns before the join, as it always has.
  const empty = join(tmp(), '.planning');
  mkdirSync(empty, { recursive: true });
  const none = seam(empty, ['reads', '--join']);
  assert.equal(none.note, 'no reads recorded yet');
  assert.equal('inDispatch' in none, false);
});
