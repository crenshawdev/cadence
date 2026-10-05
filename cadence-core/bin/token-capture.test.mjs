// @ts-check
// Zero-dep tests for lib/token-capture.mjs and the Cadence module's use of it:
// a subagent's own `trace close` gains its agent id (D-11).
// Run: node --test cadence-core/bin/token-capture.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { closePhase, withAgentId } from './lib/token-capture.mjs';
import { register } from '../../hooks/cadence-mod.mjs';
import { STEP_WINDOW, stepWindow, stepWindowArgv } from './lib/token-capture.mjs';
import { closeArgs } from './lib/token-capture.mjs';

const BIN = dirname(fileURLToPath(import.meta.url));
const PLANNING = join(BIN, 'planning.mjs');
const ID = 'a88756e808e7cab7b';
/** The advisory persistence tail's close, as review-triggers.md has it written. */
const TAIL = 'node "/abs/cadence-core/bin/planning.mjs" trace close --phase 3 --plan cad-reviewer --role cad-reviewer --reviewer claude-subagent';

// --- the pure rewrite ---------------------------------------------------------

test('the advisory tail\'s close gains --agent-id, and its phase reads as 3', () => {
  assert.equal(withAgentId(TAIL, ID), `${TAIL} --agent-id ${ID}`);
  assert.equal(closePhase(TAIL), '3');
});

test('commands the rewrite must leave alone answer nothing', () => {
  for (const [why, command, id] of [
    ['a close already carrying --agent-id', `${TAIL} --agent-id other`, ID],
    ['trace append', TAIL.replace('trace close', 'trace append'), ID],
    ['the close followed by && echo ok', `${TAIL} && echo ok`, ID],
    ['the close followed by ; echo ok', `${TAIL}; echo ok`, ID],
    ['the close piped', `${TAIL} | cat`, ID],
    ['a command substitution', `${TAIL} --detail "$(cat x)"`, ID],
    ['a backtick', `${TAIL} --detail \`cat x\``, ID],
    ['a second line', `${TAIL}\necho ok`, ID],
    ['a comment', `${TAIL} # note`, ID],
    ['a trailing line continuation', `${TAIL} \\`, ID],
    ['a git push', 'git push origin main', ID],
    ['a close named in an echo', `echo ${TAIL}`, ID],
    ['an id holding a space', TAIL, 'a1 b2'],
    ['an id holding ;', TAIL, 'a1;rm'],
    ['an empty id', TAIL, ''],
    ['no agentId at all', TAIL, undefined],
  ]) {
    assert.equal(withAgentId(command, id), null, why);
  }
  assert.equal(withAgentId(42, ID), null);
  assert.equal(closePhase(`${TAIL} && echo ok`), null);
  assert.equal(closePhase('git push'), null);
});

test('the rewritten close, run in a project, closes a bracket carrying that agent id', () => {
  const project = mkdtempSync(join(tmpdir(), 'cad-token-capture-'));
  try {
    mkdirSync(join(project, '.planning'));
    const seam = (/** @type {string[]} */ args) => JSON.parse(execFileSync('node', [PLANNING, ...args],
      { cwd: project, encoding: 'utf8' }));
    seam(['trace', 'append', '--phase', '3', '--family', 'lifecycle', '--event', 'dispatch',
      '--plan', 'cad-reviewer', '--role', 'cad-reviewer', '--reviewer', 'claude-subagent']);
    const rewritten = withAgentId(TAIL.replace('/abs/cadence-core/bin/planning.mjs', PLANNING), ID);
    assert.ok(rewritten);
    execFileSync('sh', ['-c', rewritten], { cwd: project, encoding: 'utf8' });
    const r = seam(['trace', 'render', '--phase', '3']);
    assert.equal(r.brackets.length, 1);
    assert.equal(r.brackets[0].agent_id, ID);
    assert.deepEqual(r.unpaired, []);
  } finally {
    rmSync(project, { recursive: true, force: true });
  }
});

// --- the handler, through the adapter ----------------------------------------

/** The module's `tool.call` handler, as a recording `on` collects it. */
function toolCall() {
  /** @type {Function[]} */
  const found = [];
  register((/** @type {string} */ pattern, /** @type {any} */ a, /** @type {any} */ b) => {
    if (pattern === 'tool.call') found.push(b === undefined ? a : b);
  });
  assert.equal(found.length, 1);
  return found[0];
}

/** A `next` that records every event it receives. */
function recording() {
  /** @type {any[]} */
  const seen = [];
  const next = async (/** @type {any} */ e) => { seen.push(e); return { result: 'ok' }; };
  return { next, seen };
}

const $ = { ui: { invalidate: () => {} } };

test('a subagent\'s close reaches next once, rewritten', async () => {
  const { next, seen } = recording();
  const e = Object.freeze({ tool: 'Bash', tool_use_id: 't1', agentId: ID, command: TAIL, description: 'close' });
  assert.deepEqual(await toolCall()($, e, next), { result: 'ok' });
  assert.equal(seen.length, 1);
  assert.notEqual(seen[0], e);
  assert.deepEqual(seen[0], { ...e, command: `${TAIL} --agent-id ${ID}` });
});

test('a main-loop close and a subagent\'s git push reach next once, as the event passed in', async () => {
  for (const e of [
    { tool: 'Bash', tool_use_id: 't2', command: TAIL },
    { tool: 'Bash', tool_use_id: 't3', agentId: ID, command: 'git push' },
  ]) {
    const { next, seen } = recording();
    await toolCall()($, e, next);
    assert.equal(seen.length, 1);
    assert.equal(seen[0], e);
  }
});

test('an event whose command throws when read reaches next once, as that event', async () => {
  const e = {
    tool: 'Bash', tool_use_id: 't4', agentId: ID,
    get command() { throw new Error('unreadable'); },
  };
  const { next, seen } = recording();
  assert.deepEqual(await toolCall()($, e, next), { result: 'ok' });
  assert.equal(seen.length, 1);
  assert.equal(seen[0], e);
});

// --- the step window and the fact (D-10) -------------------------------------

/** Two steps shaped like the spike's (criterion 5): outputs 82 and 3, cache creation 17019 and 4920. */
const STEP_1 = { input_tokens: 3, cache_read_input_tokens: 0, cache_creation_input_tokens: 17019, output_tokens: 82, model: 'm' };
const STEP_2 = { input_tokens: 2, cache_read_input_tokens: 17019, cache_creation_input_tokens: 4920, output_tokens: 3, model: 'm' };
const STATE = 'Phase: 1 of 2 (Fixture)\nStatus: planned\nNext: /cad-execute 1\nUpdated: 2026-10-04\n';

test('one step\'s window sums its four fields', () => {
  assert.equal(stepWindow(STEP_1), 3 + 0 + 17019 + 82);
  assert.equal(stepWindow(STEP_2), 2 + 17019 + 4920 + 3);
});

test('null usage, or a field that is not a finite non-negative number, answers nothing', () => {
  assert.equal(stepWindow(null), null);
  assert.equal(stepWindow(undefined), null);
  for (const bad of [NaN, Infinity, -1, '5', undefined]) {
    assert.equal(stepWindow({ ...STEP_1, output_tokens: bad }), null, String(bad));
  }
});

test('the fact\'s argv runs the plugin\'s own trace append', () => {
  assert.deepEqual(stepWindowArgv('/plug', '3', 'a1', 21944), ['node', '/plug/cadence-core/bin/planning.mjs',
    'trace', 'append', '--phase', '3', '--family', 'lifecycle', '--event', STEP_WINDOW,
    '--agent-id', 'a1', '--tokens', '21944']);
  assert.equal(stepWindowArgv('/plug/', '3', 'a1', 1)[1], '/plug/cadence-core/bin/planning.mjs');
});

/** Every handler of one `register`, by pattern, so they share the module's state. */
function module() {
  /** @type {Map<string, Function>} */
  const by = new Map();
  register((/** @type {string} */ pattern, /** @type {any} */ a, /** @type {any} */ b) => {
    by.set(pattern, b === undefined ? a : b);
  });
  return by;
}

/** Drive a streaming hook to its end: the chunks it yielded and what it returned. */
async function drain(/** @type {AsyncGenerator<any, any>} */ gen) {
  const chunks = [];
  for (;;) {
    const { value, done } = await gen.next();
    if (done) return { chunks, result: value };
    chunks.push(value);
  }
}

/** A `turn.step` `next` that streams one chunk and returns a result carrying `usage`. */
function stepNext(/** @type {any} */ usage) {
  const next = (/** @type {any} */ e) => {
    next.calls.push(e);
    return (async function* () { yield { kind: 'text', text: 'x' }; return next.result; })();
  };
  next.calls = /** @type {any[]} */ ([]);
  next.result = { turnId: 't', index: 0, answer: '', toolUses: [], stopReason: 'end_turn', usage };
  return next;
}

/** A stand-in `$` over a fixture tree, recording each `$.process.run`. */
function host({ files = { '/proj/.planning': '', '/proj/.planning/STATE.md': STATE }, run } = /** @type {any} */ ({})) {
  /** @type {{argv: string[], init: any}[]} */
  const runs = [];
  return {
    runs,
    plugin: { name: 'cadence', root: '/plug' },
    session: { cwd: async () => '/elsewhere', id: async () => 'session-1' },
    fs: {
      exists: async (/** @type {string} */ p) => Object.hasOwn(files, p),
      read: async (/** @type {string} */ p) => {
        if (!Object.hasOwn(files, p)) throw new Error(`ENOENT ${p}`);
        return files[p];
      },
    },
    process: { run: run || (async (/** @type {string[]} */ argv, /** @type {any} */ init) => {
      runs.push({ argv, init });
      return { exitCode: 0, stdout: '', stderr: '' };
    }) },
    ui: { invalidate: () => {} },
  };
}

const stop = (/** @type {any} */ extra) => ({ hook_event_name: 'SubagentStop', session_id: 'session-1',
  agent_id: 'a1', agent_type: 'cadence:cad-reviewer-low', cwd: '/proj/sub', ...extra });

/** Two spike-shaped steps for agent a1 through the module's `turn.step` handler. */
async function twoSteps(/** @type {Map<string, Function>} */ by, /** @type {any} */ $) {
  for (const usage of [STEP_1, STEP_2]) {
    const e = Object.freeze({ turnId: 't', index: 0, model: 'm', messageCount: 3, agentId: 'a1' });
    const next = stepNext(usage);
    const { chunks, result } = await drain(by.get('turn.step')($, e, next));
    assert.equal(next.calls.length, 1);
    assert.equal(next.calls[0], e, 'turn.step must pass e down unchanged');
    assert.equal(result, next.result);
    assert.deepEqual(chunks, [{ kind: 'text', text: 'x' }]);
  }
}

test('a Cadence subagent\'s stop writes its LAST step window under the phase its close named', async () => {
  const by = module();
  const $ = host();
  await twoSteps(by, $);
  await by.get('tool.call')($, { tool: 'Bash', tool_use_id: 'c', agentId: 'a1', command: TAIL }, async () => ({}));
  const answer = {};
  assert.equal(await by.get('classic.SubagentStop')($, stop(), async () => answer), answer);
  assert.equal($.runs.length, 1);
  assert.deepEqual($.runs[0].argv, stepWindowArgv('/plug', '3', 'a1', 21944));
  assert.notEqual($.runs[0].argv.at(-1), String(stepWindow(STEP_1) + 21944), 'turn.complete\'s denomination');
  assert.equal($.runs[0].init.cwd, '/proj');
  assert.equal(typeof $.runs[0].init.timeoutMs, 'number');

  // The agent is forgotten: a second stop writes nothing.
  await by.get('classic.SubagentStop')($, stop(), async () => answer);
  assert.equal($.runs.length, 1);
});

test('with no close seen, the stop writes nothing under the cursor\'s phase', async () => {
  const by = module();
  const $ = host();
  await twoSteps(by, $);
  await by.get('classic.SubagentStop')($, stop(), async () => ({}));
  assert.equal($.runs.length, 0);
});

test('a stop writes nothing without a Cadence type, a window, a project or a phase', async () => {
  for (const [why, files, extra, steps] of [
    ['a host agent type', undefined, { agent_type: 'general-purpose' }, true],
    ['no step window', undefined, {}, false],
    ['no .planning/ up the walk', { '/other/.planning': '' }, {}, true],
    ['no phase and no cursor', { '/proj/.planning': '' }, {}, true],
  ]) {
    const by = module();
    const $ = host({ files });
    if (steps) await twoSteps(by, $);
    const answer = {};
    assert.equal(await by.get('classic.SubagentStop')($, stop(extra), async () => answer), answer, why);
    assert.equal($.runs.length, 0, why);
  }
});

test('a failed write is silent: the stop still answers next\'s result, with next run once', async () => {
  const by = module();
  const $ = host({ run: async () => { throw new Error('spawn failed'); } });
  await twoSteps(by, $);
  let calls = 0;
  const answer = {};
  assert.equal(await by.get('classic.SubagentStop')($, stop(), async () => { calls++; return answer; }), answer);
  assert.equal(calls, 1);
  const hostile = { get agent_id() { throw new Error('unreadable'); } };
  assert.equal(await by.get('classic.SubagentStop')($, hostile, async () => answer), answer);
});

// --- the phase is adopted from the close, never derived -----------------------

/** A coordinator's figureless close, as the main loop writes it after the return. */
const close = (/** @type {string} */ args) =>
  `node "/plug/cadence-core/bin/planning.mjs" trace close ${args} --plan cad-assumptions-analyzer --role cad-assumptions-analyzer`;
const CURSOR_3 = { '/proj/.planning': '', '/proj/.planning/STATE.md': STATE.replace('Phase: 1 of 2', 'Phase: 3 of 5') };

test('closeArgs reads the phase, agent id, anchor and figure a close names', () => {
  assert.deepEqual(closeArgs(close('--phase 4 --agent-id a1')),
    { phase: '4', agentId: 'a1', anchor: null, priced: false });
  assert.deepEqual(closeArgs(close('--phase 0 --agent-id=a1')),
    { phase: '0', agentId: 'a1', anchor: null, priced: false });
  assert.deepEqual(closeArgs(close('--phase "2.1" --agent-id a1 --anchor abc1234 --tokens 999')),
    { phase: '2.1', agentId: 'a1', anchor: 'abc1234', priced: true });
  assert.equal(closeArgs(withAgentId(TAIL, ID))?.agentId, ID);
  for (const [why, command] of [
    ['no agent id', close('--phase 4')],
    ['no phase', close('--agent-id a1')],
    ['two phases', close('--phase 3 --phase 4 --agent-id a1')],
    ['two agent ids', close('--phase 4 --agent-id a1 --agent-id a2')],
    ['an unreadable anchor', close('--phase 4 --agent-id a1 --anchor')],
    ['an id holding a shell character', close('--phase 4 --agent-id "a1;x"')],
    ['a compound line', `${close('--phase 4 --agent-id a1')} && echo ok`],
    ['trace append', close('--phase 4 --agent-id a1').replace('trace close', 'trace append')],
    ['not a string', 42],
  ]) {
    assert.equal(closeArgs(command), null, why);
  }
});

/** A main-loop Bash call through the module, recording when `next` ran against the writes. */
async function mainLoop(/** @type {Map<string, Function>} */ by, /** @type {any} */ $, /** @type {string} */ command) {
  const e = { tool: 'Bash', tool_use_id: 'm', command };
  /** @type {any[]} */
  const seen = [];
  const writesBefore = [];
  await by.get('tool.call')($, e, async (/** @type {any} */ sent) => {
    seen.push(sent);
    writesBefore.push($.runs.length);
    return {};
  });
  assert.equal(seen.length, 1);
  assert.equal(seen[0], e);
  return writesBefore[0];
}

/** A Cadence subagent that stepped twice and stopped without closing itself, in a project whose cursor reads 3. */
async function stoppedUnclosed() {
  const by = module();
  const $ = host({ files: CURSOR_3 });
  $.session.cwd = async () => '/proj';
  await twoSteps(by, $);
  await by.get('classic.SubagentStop')($, stop({ agent_type: 'cadence:cad-assumptions-analyzer-medium' }), async () => ({}));
  assert.equal($.runs.length, 0, 'the stop alone files nothing');
  return { by, $ };
}

test('a coordinator close with --phase 4 --agent-id a1 files under 4 while the cursor reads 3', async () => {
  const { by, $ } = await stoppedUnclosed();
  assert.equal(await mainLoop(by, $, close('--phase 4 --agent-id a1')), 1, 'written before the close is passed on');
  assert.deepEqual($.runs[0].argv, stepWindowArgv('/plug', '4', 'a1', 21944));
  assert.equal($.runs[0].init.cwd, '/proj');

  // The window is spent: the same close again writes nothing.
  await mainLoop(by, $, close('--phase 4 --agent-id a1'));
  assert.equal($.runs.length, 1);
});

test('a /cad-task close files under --phase 0, and an anchored close passes its anchor on', async () => {
  let { by, $ } = await stoppedUnclosed();
  await mainLoop(by, $, close('--phase 0 --agent-id a1'));
  assert.deepEqual($.runs.map((r) => r.argv), [stepWindowArgv('/plug', '0', 'a1', 21944)]);

  ({ by, $ } = await stoppedUnclosed());
  await mainLoop(by, $, close('--phase 4 --agent-id a1 --anchor abc1234'));
  assert.deepEqual($.runs.map((r) => r.argv), [stepWindowArgv('/plug', '4', 'a1', 21944, 'abc1234')]);
});

test('a close with --tokens writes nothing, and spends the window', async () => {
  const { by, $ } = await stoppedUnclosed();
  await mainLoop(by, $, close('--phase 4 --agent-id a1 --tokens 999'));
  await mainLoop(by, $, close('--phase 4 --agent-id a1'));
  assert.equal($.runs.length, 0);
});

test('a close for an unknown id writes nothing', async () => {
  const { by, $ } = await stoppedUnclosed();
  await mainLoop(by, $, close('--phase 4 --agent-id a2'));
  await mainLoop(by, $, close('--phase 4'));
  assert.equal($.runs.length, 0);
});

test('a subagent\'s own close before its last step files that LAST step at its stop', async () => {
  const by = module();
  const $ = host({ files: CURSOR_3 });
  const step = async (/** @type {any} */ usage) => drain(by.get('turn.step')($,
    Object.freeze({ turnId: 't', index: 0, model: 'm', messageCount: 3, agentId: 'a1' }), stepNext(usage)));
  await step(STEP_1);
  const own = TAIL.replace('/abs/', '/plug/');
  await by.get('tool.call')($, { tool: 'Bash', tool_use_id: 'c', agentId: 'a1', command: own }, async () => ({}));
  assert.equal($.runs.length, 0, 'nothing written at the subagent\'s own close');
  await step(STEP_2);
  await by.get('classic.SubagentStop')($, stop(), async () => ({}));
  assert.deepEqual($.runs.map((r) => r.argv), [stepWindowArgv('/plug', '3', 'a1', 21944)]);
});

test('a failed write at a close still passes the close on once', async () => {
  const by = module();
  const $ = host({ files: CURSOR_3, run: async () => { throw new Error('spawn failed'); } });
  $.session.cwd = async () => '/proj';
  await twoSteps(by, $);
  await by.get('classic.SubagentStop')($, stop(), async () => ({}));
  const e = { tool: 'Bash', tool_use_id: 'm', command: close('--phase 4 --agent-id a1') };
  let calls = 0;
  const answer = {};
  assert.equal(await by.get('tool.call')($, e, async (/** @type {any} */ sent) => {
    calls++;
    assert.equal(sent, e);
    return answer;
  }), answer);
  assert.equal(calls, 1);
});

// --- the held windows are bounded (PNL-07) ------------------------------------

/** hooks/cadence-mod.mjs's HELD_MAX. Both arms below fail if the two disagree. */
const HELD_MAX = 64;

/** Agent `id` steps once and stops as a Cadence subagent that never closed itself. */
async function stepAndStop(/** @type {Map<string, Function>} */ by, /** @type {any} */ $, /** @type {string} */ id) {
  const e = Object.freeze({ turnId: 't', index: 0, model: 'm', messageCount: 3, agentId: id });
  await drain(by.get('turn.step')($, e, stepNext(STEP_2)));
  await by.get('classic.SubagentStop')($, stop({ agent_id: id }), async () => ({}));
}

/** A module and a host whose cursor reads 3, with `/proj` as the session cwd. */
function boundedHost() {
  const by = module();
  const $ = host({ files: CURSOR_3 });
  $.session.cwd = async () => '/proj';
  return { by, $ };
}

test('stops no close ever names hold at most HELD_MAX windows, the oldest evicted', async () => {
  // Every held window turns into exactly one write when its close comes, so
  // closing them all counts the map.
  const { by, $ } = boundedHost();
  const ids = Array.from({ length: HELD_MAX + 5 }, (_, i) => `a${i}`);
  for (const id of ids) await stepAndStop(by, $, id);
  assert.equal($.runs.length, 0, 'a stop with no close wrote something');
  for (const id of ids) await mainLoop(by, $, close(`--phase 4 --agent-id ${id}`));
  assert.equal($.runs.length, HELD_MAX);
  assert.deepEqual($.runs.map((r) => r.argv),
    ids.slice(5).map((id) => stepWindowArgv('/plug', '4', id, stepWindow(STEP_2))),
    'the windows kept are not the newest HELD_MAX');
});

test('a close after its own stop, with HELD_MAX - 1 stops in between, still writes that window', async () => {
  const { by, $ } = boundedHost();
  await stepAndStop(by, $, 'a1');
  for (let i = 0; i < HELD_MAX - 1; i++) await stepAndStop(by, $, `b${i}`);
  await mainLoop(by, $, close('--phase 4 --agent-id a1'));
  assert.deepEqual($.runs.map((r) => r.argv), [stepWindowArgv('/plug', '4', 'a1', stepWindow(STEP_2))]);
});
