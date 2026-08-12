// @ts-check
// Zero-dep tests for lib/trace-suggest.mjs - the suggestion rules as pure
// functions over a trace render. Run:
//   node --test cadence-core/bin/trace-suggest.test.mjs
// Only node: builtins, per the repo's zero-dep ethos.
//
// The fixtures here are event lists in the exact shape renderTrace() emits
// into `events[]` (parsed trace lines), because that is the one boundary the
// rules read. The CLI arm is covered by the seam test at the bottom, which
// writes a real trace through appendEvent and reads `trace suggest` end to
// end - the same one-real-pass discipline trace.test.mjs uses.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  suggestFromRender, parseAdjudication,
  MIN_FIRES_FOR_GATE_SUGGESTION, MIN_DISPATCHES_FOR_RUNG_INFO,
  MIN_ESCALATIONS_FOR_RUNG_SUGGESTION, MIN_CHECKPOINTS_FOR_SIZE_SUGGESTION,
} from './lib/trace-suggest.mjs';

const BIN = join(dirname(fileURLToPath(import.meta.url)), 'planning.mjs');

/** @param {any[]} events @param {Record<string, any>} [roles] */
const render = (events, roles = {}) => ({ counts: {}, roles, events });

const adjudication = (detail) => ({ family: 'outcome', event: 'adjudication', detail });
const rearm = (detail) => ({ family: 'outcome', event: 'rearm', detail });
const resolve = (role, extra = {}) => ({ family: 'routing', event: 'resolve', role, ...extra });
const checkpoint = (role) => ({ family: 'lifecycle', event: 'checkpoint', role });

test('parseAdjudication: the step-5 detail shape parses, others contribute nothing', () => {
  assert.deepEqual(parseAdjudication('plan: 3 survivors; voices claude-subagent'),
    { trigger: 'plan', survivors: 3 });
  assert.deepEqual(parseAdjudication('pre_ship: 1 survivor; voices claude-subagent, openai'),
    { trigger: 'pre_ship', survivors: 1 });
  assert.equal(parseAdjudication('freeform note'), null);
  assert.equal(parseAdjudication(undefined), null);
  assert.equal(parseAdjudication(42), null);
});

test('R1: an adjudicated trigger at the fires floor with zero survivors suggests its gate key', () => {
  const events = Array.from({ length: MIN_FIRES_FOR_GATE_SUGGESTION },
    () => adjudication('plan: 0 survivors; voices claude-subagent'));
  const out = suggestFromRender(render(events));
  const s = out.find((x) => x.action === 'review.triggers.plan.gate');
  assert.ok(s, `expected a plan gate suggestion, got ${JSON.stringify(out)}`);
  assert.equal(s.kind, 'suggest');
  assert.match(s.evidence, /0 survivors/);
});

test('R1: one fire below the floor stays silent - one event is a guess, not evidence', () => {
  const out = suggestFromRender(render([adjudication('plan: 0 survivors; voices claude-subagent')]));
  assert.equal(out.find((x) => x.action === 'review.triggers.plan.gate'), undefined);
});

test('R1: any survivor, or a rearm on the same trigger, vetoes the gate suggestion', () => {
  const survived = suggestFromRender(render([
    adjudication('plan: 0 survivors; voices claude-subagent'),
    adjudication('plan: 2 survivors; voices claude-subagent'),
  ]));
  assert.equal(survived.find((x) => x.action === 'review.triggers.plan.gate'), undefined);

  const rearmedOut = suggestFromRender(render([
    adjudication('risk_surface: 0 survivors; voices claude-subagent'),
    adjudication('risk_surface: 0 survivors; voices claude-subagent'),
    rearm('risk_surface'),
  ]));
  assert.equal(rearmedOut.find((x) => x.action === 'review.triggers.risk_surface.gate'), undefined,
    'a gate that forced a fix round has paid for itself, whatever its adjudications said');
});

test('R2: a rearm becomes a keep-the-gate receipt, not a config suggestion', () => {
  const out = suggestFromRender(render([rearm('risk_surface')]));
  const s = out.find((x) => x.subject === 'risk_surface');
  assert.ok(s);
  assert.equal(s.kind, 'info');
  assert.equal(s.action, null);
  assert.match(s.evidence, /caught real work/);
});

test('R3: escalation pressure at the floor suggests the role effort key; either climb spelling counts', () => {
  const events = [
    resolve('cad-planner', { escalated: true }),
    resolve('cad-planner', { attempt: 2 }),
    resolve('cad-planner', {}),
  ];
  assert.equal(MIN_ESCALATIONS_FOR_RUNG_SUGGESTION, 2, 'fixture is built against the floor');
  const out = suggestFromRender(render(events));
  const s = out.find((x) => x.action === 'model.effort.cad-planner');
  assert.ok(s, `expected an effort suggestion, got ${JSON.stringify(out)}`);
  assert.match(s.evidence, /2 of 3 resolves/);
});

test('R3: a held start rung at the dispatch floor is an info receipt; below it, silence', () => {
  const held = Array.from({ length: MIN_DISPATCHES_FOR_RUNG_INFO }, () => resolve('cad-executor', {}));
  const out = suggestFromRender(render(held));
  const s = out.find((x) => x.subject === 'cad-executor' && x.kind === 'info');
  assert.ok(s);
  assert.equal(s.action, null);

  const few = suggestFromRender(render(held.slice(0, MIN_DISPATCHES_FOR_RUNG_INFO - 1)));
  assert.equal(few.find((x) => x.subject === 'cad-executor'), undefined);
});

test('R4: executor checkpoints at the floor suggest workflow.max_plan_tasks; other roles do not', () => {
  const out = suggestFromRender(render([
    checkpoint('cad-executor'), checkpoint('cad-executor'),
    checkpoint('cad-reviewer'), checkpoint('cad-reviewer'),
  ]));
  const s = out.find((x) => x.action === 'workflow.max_plan_tasks');
  assert.ok(s);
  assert.equal(s.subject, 'cad-executor');
  assert.equal(out.filter((x) => x.action === 'workflow.max_plan_tasks').length, 1,
    'reviewer checkpoints are closes of failed reviews, not plan-size evidence');
});

test('R5: the spend receipt names the top role, its share, and asks for nothing', () => {
  const out = suggestFromRender(render([], {
    'cad-executor': { dispatches: 2, tokens: 300000 },
    'cad-planner': { dispatches: 1, tokens: 100000 },
  }));
  const s = out.find((x) => x.evidence.includes('largest recorded spend'));
  assert.ok(s);
  assert.equal(s.subject, 'cad-executor');
  assert.equal(s.action, null);
  assert.match(s.evidence, /75%/);
});

test('suggestions order suggest-first, then stable by subject; an empty render is an empty list', () => {
  assert.deepEqual(suggestFromRender(render([])), []);
  const out = suggestFromRender(render([
    rearm('risk_surface'),
    adjudication('plan: 0 survivors; voices claude-subagent'),
    adjudication('plan: 0 survivors; voices claude-subagent'),
  ]));
  assert.equal(out[0].kind, 'suggest');
  assert.equal(out[out.length - 1].kind, 'info');
});

test('config keys named in actions exist in config.schema.json - the suggestion never names a phantom key', async () => {
  const { readFileSync } = await import('node:fs');
  const schema = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'config.schema.json'), 'utf8'));
  // `keys` is a FLAT map of dotted key names, not a nested tree.
  /** @param {string} path */
  const schemaHas = (path) => Object.prototype.hasOwnProperty.call(schema.keys, path);
  const out = suggestFromRender(render([
    adjudication('plan: 0 survivors; voices x'), adjudication('plan: 0 survivors; voices x'),
    resolve('cad-planner', { escalated: true }), resolve('cad-planner', { escalated: true }),
    checkpoint('cad-executor'), checkpoint('cad-executor'),
  ]));
  for (const s of out) {
    if (s.action !== null) assert.ok(schemaHas(s.action), `action names a phantom key: ${s.action}`);
  }
  assert.ok(out.some((s) => s.action !== null), 'fixture must produce at least one keyed action');
});

test('seam: a real trace written through appendEvent reads back through `trace suggest`', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cad-suggest-'));
  try {
    mkdirSync(join(dir, '.planning'), { recursive: true });
    const planning = join(dir, '.planning');
    const append = (args) => execFileSync('node', [BIN, 'trace', 'append', '--phase', '1', ...args],
      { cwd: dir, encoding: 'utf8', env: { ...process.env, CADENCE_PLANNING_DIR: planning } });
    // Use the CLI itself so the fixture exercises the same writer prose uses.
    const run = (args) => JSON.parse(execFileSync('node', [BIN, ...args],
      { cwd: dir, encoding: 'utf8' }).trim().split('\n').pop() || '{}');

    execFileSync('node', [BIN, 'trace', 'append', '--phase', '1', '--family', 'outcome',
      '--event', 'adjudication', '--detail', 'plan: 0 survivors; voices claude-subagent'], { cwd: dir });
    execFileSync('node', [BIN, 'trace', 'append', '--phase', '1', '--family', 'outcome',
      '--event', 'adjudication', '--detail', 'plan: 0 survivors; voices claude-subagent'], { cwd: dir });
    execFileSync('node', [BIN, 'trace', 'append', '--phase', '1', '--family', 'outcome',
      '--event', 'rearm', '--detail', 'risk_surface'], { cwd: dir });

    const out = run(['trace', 'suggest']);
    assert.equal(out.ok, true);
    assert.equal(out.scope, 'all');
    assert.equal(out.events_read, 3);
    assert.ok(out.suggestions.some((s) => s.action === 'review.triggers.plan.gate'));
    assert.ok(out.suggestions.some((s) => s.subject === 'risk_surface' && s.kind === 'info'));

    const scoped = run(['trace', 'suggest', '--phase', '2']);
    assert.equal(scoped.ok, true);
    assert.equal(scoped.events_read, 0);
    assert.deepEqual(scoped.suggestions, []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
