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
