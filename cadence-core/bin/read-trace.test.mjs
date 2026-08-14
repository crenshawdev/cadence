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
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, symlinkSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  recordFromHook, appendRead, programOf, readsPath, filesOf,
  RECORDED_TOOLS, MAX_READS_BYTES, MAX_FILES_PER_CALL,
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

test('the cap is enforced BEFORE the write', () => {
  const d = tmp();
  writeFileSync(readsPath(d), 'x'.repeat(MAX_READS_BYTES));
  const before = readFileSync(readsPath(d), 'utf8').length;
  const res = appendRead(d, { ts: TS, tool: 'Read', target: '/a' });
  assert.equal(res.written, false);
  assert.equal(res.reason, 'size-cap');
  assert.equal(readFileSync(readsPath(d), 'utf8').length, before);
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
