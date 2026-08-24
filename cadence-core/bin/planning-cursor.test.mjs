// Zero-dep tests for `planning.mjs cursor get / cursor set`. Run:
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
import { writeFileSync, readFileSync, readdirSync, existsSync, chmodSync, accessSync, constants, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { makeTree, run, today } from './planning.test.mjs';

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

// --- cursor get / set --------------------------------------------------------

test('cursor get: parses the canonical schema; missing file is no-cursor', () => {
  const dir = makeTree({
    roadmap: [{ n: 1, name: 'Only' }],
    cursor: { phase: 1, total: 1, name: 'Only', status: 'planned', next: '/cad-execute 1', updated: '2026-01-01' },
  });
  const r = run(['cursor', 'get'], dir);
  assert.equal(r.ok, true);
  assert.equal(r.phase, 1);
  assert.equal(r.name, 'Only');

  const none = run(['cursor', 'get'], makeTree({}));
  assert.equal(none.reason, 'no-cursor');
});

test('cursor get: malformed STATE.md degrades to unparseable-cursor', () => {
  const dir = makeTree({});
  writeFileSync(join(dir, 'STATE.md'), '# State\n\nWorking on stuff, back soon\n');
  const r = run(['cursor', 'get'], dir);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'unparseable-cursor');
  assert.equal(r._exit, 1);
});

test('cursor set: falls back to the existing cursor when ROADMAP is absent', () => {
  const dir = makeTree({
    cursor: { phase: 1, total: 3, name: 'Solo', status: 'planned', next: 'x', updated: '2026-01-01' },
  });
  const r = run(['cursor', 'set', '--phase', '1', '--status', 'executed', '--next', '/cad-verify 1'], dir);
  assert.equal(r.ok, true);
  assert.equal(r.cursor.name, 'Solo');   // from the prior cursor (same phase)
  assert.equal(r.cursor.total, 3);       // prior total carried forward
  assert.equal(r.cursor.status, 'executed');
});

test('cursor set: a --phase spelling that cannot round-trip is refused, STATE.md untouched (D-07)', () => {
  const dir = makeTree({
    roadmap: [{ n: 1, name: 'One' }, { n: 2, name: 'Two' }, { n: '2.1', name: 'Hotfix' }],
    cursor: { phase: 1, total: 3, name: 'One', status: 'planned', next: '/cad-plan 1', updated: '2026-01-01' },
  });
  const before = readFileSync(join(dir, 'STATE.md'), 'utf8');
  for (const bad of ['1.10', '1.0', '01']) {
    const r = run(['cursor', 'set', '--phase', bad, '--status', 'planned', '--next', '/cad-plan 1'], dir);
    assert.equal(r.ok, false, bad);
    assert.equal(r.reason, 'bad-args', bad);
    assert.equal(r._exit, 1, bad);
    assert.ok(r.detail.includes(`"${bad}"`), `${bad}: detail quotes what was sent`);
    assert.ok(r.detail.includes(`"${String(Number(bad))}"`), `${bad}: detail quotes what is accepted`);
  }
  assert.equal(readFileSync(join(dir, 'STATE.md'), 'utf8'), before, 'nothing written');

  for (const good of ['2', '2.1']) {
    const r = run(['cursor', 'set', '--phase', good, '--status', 'planned', '--next', `/cad-execute ${good}`], dir);
    assert.equal(r.ok, true, good);
    assert.equal(r.cursor.phase, Number(good), good);
  }
});

test('cursor set: derives name/total from ROADMAP, stamps today, writes 4 lines', () => {
  const dir = makeTree({ roadmap: [{ n: 1, name: 'Foundation' }, { n: 2, name: 'Auth' }] });
  const before = today();
  const r = run(['cursor', 'set', '--phase', '2', '--status', 'planned', '--next', '/cad-execute 2'], dir);
  const after = today();
  assert.equal(r.ok, true);
  // Midnight-robust: the stamp must be the subprocess's run date, which is
  // one of the two dates observed around the call (usually the same one).
  assert.ok([before, after].includes(r.cursor.updated),
    `updated ${r.cursor.updated} not in [${before}, ${after}]`);
  assert.deepEqual(r.cursor, {
    phase: 2, total: 2, name: 'Auth', status: 'planned', next: '/cad-execute 2',
    updated: r.cursor.updated,
  });
  const text = readFileSync(join(dir, 'STATE.md'), 'utf8');
  assert.equal(text,
    `# State\n\nPhase: 2 of 2 (Auth)\nStatus: planned\nNext: /cad-execute 2\nUpdated: ${r.cursor.updated}\n`);
  // atomic: no temp file left behind
  assert.ok(!readdirSync(dir).some((f) => f.endsWith('.tmp')));
});

// --- cursor set: the closed-milestone derivation (D-10) ---------------------

test('cursor set: derives `of 0 (no active cycle)` from a pruned roadmap, with no --name/--total', () => {
  const dir = makeTree({ roadmap: [] });
  const r = run(['cursor', 'set', '--phase', '1', '--status', 'ready to plan',
    '--next', '/cad-phase add'], dir);
  assert.equal(r.ok, true);
  assert.equal(r.cursor.total, 0);
  assert.equal(r.cursor.name, 'no active cycle');
  const text = readFileSync(join(dir, 'STATE.md'), 'utf8');
  assert.match(text, /^Phase: 1 of 0 \(no active cycle\)$/m);
});

test('cursor set: the closed cursor it writes round-trips through cursor get, never unparseable-cursor', () => {
  const dir = makeTree({ roadmap: [] });
  assert.equal(run(['cursor', 'set', '--phase', '1', '--status', 'ready to plan',
    '--next', '/cad-phase add'], dir).ok, true);
  const g = run(['cursor', 'get'], dir);
  assert.equal(g.ok, true);
  assert.equal(g.total, 0);
  assert.equal(g.name, 'no active cycle');
  assert.equal(g.phase, 1);
});

test('cursor set: the closed arm beats the prior cursor, so a stale total is not inherited', () => {
  const dir = makeTree({
    roadmap: [],
    cursor: { phase: 5, total: 5, name: 'Old', status: 'phase complete', next: '/cad-milestone', updated: '2026-01-01' },
  });
  const r = run(['cursor', 'set', '--phase', '1', '--status', 'ready to plan',
    '--next', '/cad-phase add'], dir);
  assert.equal(r.ok, true);
  assert.equal(r.cursor.total, 0);
  assert.equal(r.cursor.name, 'no active cycle');
});

test('cursor set: --status paused preserves a non-zero prior total, so a pause cannot erase the interrupted-close evidence', () => {
  const dir = makeTree({
    roadmap: [],
    cursor: { phase: 3, total: 5, name: 'Billing', status: 'executed', next: '/cad-verify 3', updated: '2026-01-01' },
  });
  const r = run(['cursor', 'set', '--phase', '3', '--status', 'paused',
    '--next', 'mid-close, resume at /cad-milestone'], dir);
  assert.equal(r.ok, true);
  assert.equal(r.cursor.total, 5);
  assert.equal(r.cursor.name, 'Billing');
  // The stale `of 5` is what cmdStatus reads as the only surviving evidence.
  const s = run(['status'], dir);
  assert.equal(s.cycle, 'none');
  assert.ok(s.drift.some((d) => d.kind === 'cursor' && /did not finish/.test(d.detail)),
    'the stale-total cursor drift survives the pause');
});

test('cursor set: paused preserves nothing when the prior cursor names a different phase', () => {
  const dir = makeTree({
    roadmap: [],
    cursor: { phase: 5, total: 5, name: 'Old', status: 'executed', next: '/cad-verify 5', updated: '2026-01-01' },
  });
  const r = run(['cursor', 'set', '--phase', '1', '--status', 'paused', '--next', 'x'], dir);
  assert.equal(r.ok, true);
  assert.equal(r.cursor.total, 0);
  assert.equal(r.cursor.name, 'no active cycle');
});

test('cursor set: every non-paused status still derives of 0 against a stale prior cursor', () => {
  for (const status of ['ready to plan', 'phase complete', 'planned', 'executed']) {
    const dir = makeTree({
      roadmap: [],
      cursor: { phase: 2, total: 5, name: 'Billing', status: 'executed', next: 'x', updated: '2026-01-01' },
    });
    const r = run(['cursor', 'set', '--phase', '2', '--status', status, '--next', 'x'], dir);
    assert.equal(r.ok, true, status);
    assert.equal(r.cursor.total, 0, status);
    assert.equal(r.cursor.name, 'no active cycle', status);
  }
});

test('cursor set: an out-of-grammar roadmap is broken, not closed - still cannot-derive', () => {
  const dir = makeTree({});
  writeFileSync(join(dir, 'ROADMAP.md'), '# Roadmap\n\n## Phases\n\n- Phase 1: Ship auth\n');
  const r = run(['cursor', 'set', '--phase', '1', '--status', 'ready to plan',
    '--next', '/cad-phase add'], dir);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'cannot-derive');
  assert.equal(readdirSync(dir).includes('STATE.md'), false); // nothing written
});

test('cursor set: rejects a status outside the lifecycle', () => {
  const dir = makeTree({ roadmap: [{ n: 1, name: 'Only' }] });
  const r = run(['cursor', 'set', '--phase', '1', '--status', 'doing stuff', '--next', 'x'], dir);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'bad-status');
  assert.equal(readdirSync(dir).includes('STATE.md'), false); // nothing written
});

test('cursor set: a non-integer --total is bad-args and writes nothing (#42)', () => {
  const dir = makeTree({ roadmap: [{ n: 1, name: 'Foundation' }] });
  const before = readdirSync(dir).includes('STATE.md');
  const r = run(['cursor', 'set', '--phase', '1', '--status', 'planned',
    '--next', '/cad-execute 1', '--name', 'Foo', '--total', 'abc'], dir);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'bad-args');
  assert.equal(JSON.stringify(r).includes('NaN'), false);
  assert.equal(readdirSync(dir).includes('STATE.md'), before); // unchanged (still absent)

  const ok = run(['cursor', 'set', '--phase', '1', '--status', 'planned',
    '--next', '/cad-execute 1', '--name', 'Foo', '--total', '4'], dir);
  assert.equal(ok.ok, true);
  assert.equal(ok.cursor.total, 4);
});

// The integer guard is not the file contract: parseCursor reads unsigned
// decimals only, so these all used to write a STATE.md the next `cursor get`
// rejected as unparseable-cursor.
for (const [flag, value] of [
  ['--total', '-2'], ['--total', '1e21'], ['--total', '1.5'],
  ['--phase', '-1'], ['--phase', '1e21'],
]) {
  test(`cursor set: ${flag} ${value} is bad-args and leaves a readable cursor`, () => {
    const dir = makeTree({ roadmap: [{ n: 1, name: 'Foundation' }] });
    const seed = run(['cursor', 'set', '--phase', '1', '--status', 'planned',
      '--next', '/cad-execute 1', '--name', 'Foo', '--total', '4'], dir);
    assert.equal(seed.ok, true);
    const before = readFileSync(join(dir, 'STATE.md'), 'utf8');

    const args = ['cursor', 'set', '--phase', '1', '--status', 'planned',
      '--next', '/cad-execute 1', '--name', 'Foo', '--total', '4'];
    args[args.indexOf(flag) + 1] = value;
    const r = run(args, dir);
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'bad-args');
    assert.equal(readFileSync(join(dir, 'STATE.md'), 'utf8'), before);
    // The real regression: the cursor stays readable by its own parser.
    assert.equal(run(['cursor', 'get'], dir).ok, true);
  });
}

test('cursor set: a decimal phase insertion (2.1) is still accepted', () => {
  const dir = makeTree({ roadmap: [{ n: 1, name: 'Foundation' }] });
  const r = run(['cursor', 'set', '--phase', '2.1', '--status', 'planned',
    '--next', '/cad-execute 2.1', '--name', 'Insert', '--total', '4'], dir);
  assert.equal(r.ok, true);
  assert.equal(r.cursor.phase, 2.1);
  assert.equal(run(['cursor', 'get'], dir).phase, 2.1);
});

test('cursor set: no ROADMAP and no flags cannot derive', () => {
  const dir = makeTree({});
  const r = run(['cursor', 'set', '--phase', '1', '--status', 'planned', '--next', 'x'], dir);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'cannot-derive');
});

// --- cursor set --next-file: the path transport for a COMPOSED resume pointer
//
// /cad-pause and `progress` build their pointer from what the run was doing,
// which is agent-derived text; the seven sites passing a literal
// `/cad-<command> N` keep the inline form, which is why nothing is deleted.

test('cursor set: --next-file writes the STATE.md the inline value writes', () => {
  const inlineDir = makeTree({ roadmap: [{ n: 1, name: 'Foundation' }] });
  const fileDir = makeTree({ roadmap: [{ n: 1, name: 'Foundation' }] });
  const pointer = '/cad-execute 1 - resume at task 3, the reader is half-wired';
  const src = join(fileDir, 'next.txt');
  writeFileSync(src, `${pointer}\n`);
  const a = run(['cursor', 'set', '--phase', '1', '--status', 'planned',
    '--next', pointer, '--total', '4'], inlineDir);
  const b = run(['cursor', 'set', '--phase', '1', '--status', 'planned',
    '--next-file', src, '--total', '4'], fileDir);
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  assert.equal(readFileSync(join(fileDir, 'STATE.md'), 'utf8'),
    readFileSync(join(inlineDir, 'STATE.md'), 'utf8'));
  assert.equal(run(['cursor', 'get'], fileDir).next, pointer);
});

test('cursor set: a --next-file value no shell could expand lands verbatim', () => {
  const dir = makeTree({ roadmap: [{ n: 1, name: 'Foundation' }] });
  const pointer = '/cad-execute 1 after $(touch /tmp/cad-cursor-should-not-exist) and `id`';
  const src = join(dir, 'next.txt');
  writeFileSync(src, pointer);
  const r = run(['cursor', 'set', '--phase', '1', '--status', 'planned',
    '--next-file', src, '--total', '4'], dir);
  assert.equal(r.ok, true);
  assert.equal(run(['cursor', 'get'], dir).next, pointer);
  assert.equal(existsSync('/tmp/cad-cursor-should-not-exist'), false, 'the payload executed');
});

test('cursor set: a TWO-LINE --next-file is bad-args - the cursor is four lines', () => {
  const dir = makeTree({ roadmap: [{ n: 1, name: 'Foundation' }] });
  const seed = run(['cursor', 'set', '--phase', '1', '--status', 'planned',
    '--next', '/cad-execute 1', '--total', '4'], dir);
  assert.equal(seed.ok, true);
  const before = readFileSync(join(dir, 'STATE.md'), 'utf8');
  const src = join(dir, 'next.txt');
  writeFileSync(src, 'resume at task 3\nand mind the reader');
  const r = run(['cursor', 'set', '--phase', '1', '--status', 'planned',
    '--next-file', src, '--total', '4'], dir);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'bad-args');
  assert.match(r.detail, /newline/);
  assert.equal(readFileSync(join(dir, 'STATE.md'), 'utf8'), before);
  // The regression this refusal exists against: a fifth line the parser cannot
  // read back, which would make the very next `cursor get` unparseable.
  assert.equal(run(['cursor', 'get'], dir).ok, true);
});

test('cursor set: every --next-file refusal is bad-args, STATE.md byte-unchanged', () => {
  const dir = makeTree({ roadmap: [{ n: 1, name: 'Foundation' }] });
  run(['cursor', 'set', '--phase', '1', '--status', 'planned',
    '--next', '/cad-execute 1', '--total', '4'], dir);
  const before = readFileSync(join(dir, 'STATE.md'), 'utf8');
  const write = (name, body) => {
    const f = join(dir, name);
    writeFileSync(f, body);
    return f;
  };
  const good = write('next.txt', '/cad-execute 1');
  const cases = [
    { name: 'valueless', args: ['--next-file'] },
    { name: 'missing path', args: ['--next-file', join(dir, 'absent.txt')] },
    { name: 'empty file', args: ['--next-file', write('blank.txt', '\n \n')] },
    { name: 'both forms', args: ['--next', '/cad-execute 1', '--next-file', good] },
  ];
  const locked = write('locked.txt', '/cad-execute 1');
  chmodSync(locked, 0o000);
  try {
    try { accessSync(locked, constants.R_OK); } catch {
      cases.push({ name: 'unreadable path', args: ['--next-file', locked] });
    }
    for (const c of cases) {
      const r = run(['cursor', 'set', '--phase', '1', '--status', 'planned',
        ...c.args, '--total', '4'], dir);
      assert.equal(r.ok, false, c.name);
      assert.equal(r.reason, 'bad-args', c.name);
      assert.equal(readFileSync(join(dir, 'STATE.md'), 'utf8'), before, `${c.name} wrote`);
    }
  } finally {
    chmodSync(locked, 0o600);
  }
});

test('usage: unknown subcommand degrades, never crashes', () => {
  const r = run(['nonsense'], makeTree({}));
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'usage');
});
