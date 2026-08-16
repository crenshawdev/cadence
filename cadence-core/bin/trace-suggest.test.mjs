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
import { mkdtempSync, mkdirSync, rmSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  suggestFromRender, parseAdjudication,
  MIN_FIRES_FOR_GATE_SUGGESTION, MIN_DISPATCHES_FOR_RUNG_INFO,
  MIN_ESCALATIONS_FOR_RUNG_SUGGESTION, MIN_CHECKPOINTS_FOR_SIZE_SUGGESTION,
  MIN_RESIDUE_MS_FOR_COORDINATOR_INFO,
} from './lib/trace-suggest.mjs';

const BIN = join(dirname(fileURLToPath(import.meta.url)), 'planning.mjs');

/** @param {any[]} events @param {Record<string, any>} [roles] */
const render = (events, roles = {}) => ({ counts: {}, roles, events });

const adjudication = (detail, extra = {}) => ({ family: 'outcome', event: 'adjudication', detail, ...extra });
const rearm = (detail, extra = {}) => ({ family: 'outcome', event: 'rearm', detail, ...extra });
const resolve = (role, extra = {}) => ({ family: 'routing', event: 'resolve', role, ...extra });
const checkpoint = (role) => ({ family: 'lifecycle', event: 'checkpoint', role });

test('parseAdjudication: the step-5 detail shape parses, others contribute nothing', () => {
  assert.deepEqual(parseAdjudication('plan: 3 survivors; voices claude-subagent'),
    { trigger: 'plan', survivors: 3, raised: null, rearm: false });
  assert.deepEqual(parseAdjudication('phase_diff: 1 survivor; voices claude-subagent, openai'),
    { trigger: 'phase_diff', survivors: 1, raised: null, rearm: false });
  assert.equal(parseAdjudication('freeform note'), null);
  assert.equal(parseAdjudication(undefined), null);
  assert.equal(parseAdjudication(42), null);
});

test('parseAdjudication: the structured --raised field is the first source of the kill count', () => {
  assert.deepEqual(parseAdjudication(adjudication('plan: 0 survivors; voices openai', { raised: 9 })),
    { trigger: 'plan', survivors: 0, raised: 9, rearm: false });
  // 0 raised is a RECORDED figure, not an omission - it is the whole other
  // half of the distinction this field exists for.
  assert.deepEqual(parseAdjudication(adjudication('plan: 0 survivors; voices openai', { raised: 0 })),
    { trigger: 'plan', survivors: 0, raised: 0, rearm: false });
  // A field that is not a non-negative integer falls through to the detail
  // text rather than poisoning the count with a NaN or a negative.
  for (const bad of ['9', -1, 1.5, null, {}]) {
    assert.equal(parseAdjudication(adjudication('plan: 0 survivors', { raised: bad })).raised, null,
      JSON.stringify(bad));
  }
});

test('parseAdjudication: the hand-written `of <m>` clauses already on disk still read', () => {
  // Verbatim from this repo's own `.planning/trace.jsonl`, written before the
  // flag existed. D-03's floor: an upgrading project's history must keep
  // reporting, or MIN_FIRES_FOR_GATE_SUGGESTION is unreachable on every one.
  assert.deepEqual(parseAdjudication('plan: 3 survivors of 8; voices openai'),
    { trigger: 'plan', survivors: 3, raised: 8, rearm: false });
  assert.deepEqual(parseAdjudication('plan: 5 survivors of 10 raised; voices openai'),
    { trigger: 'plan', survivors: 5, raised: 10, rearm: false });
  // The third `of <m>` line on disk. Its trigger token carries the re-arm
  // marker, and the legacy clause is read from the same place behind it - the
  // marker moves where the token ENDS, never where the clause is looked for.
  assert.deepEqual(parseAdjudication('risk_surface re-arm: 0 survivors of 1 raised; voices openai/gpt-5.6-sol'),
    { trigger: 'risk_surface', survivors: 0, raised: 1, rearm: true });
  // The structured field WINS over a legacy clause when both are present.
  assert.equal(parseAdjudication(adjudication('plan: 3 survivors of 8; voices openai', { raised: 12 })).raised, 12);
  // An "of" further down the line is not the clause: only the one immediately
  // after the survivor count counts.
  assert.equal(parseAdjudication('plan: 9 survivors, all 9 applied; voices openai').raised, null);
  assert.equal(parseAdjudication('diff: 4 survivors (all latent, none blocking); voices openai').raised, null);
});

test('parseAdjudication: both on-disk re-arm spellings read as the base trigger; nothing else with a space does', () => {
  // D-04. Both spellings live in this repo's own record, written by hand
  // months apart: corr `3-d558479` writes `rearm:`, corr `1-7502567` writes
  // `re-arm:`. Each reads as the BASE trigger carrying a marker - a
  // `risk_surface rearm` trigger of its own would mint the phantom config key
  // `review.triggers.risk_surface rearm.gate`, which the schema test below
  // refuses.
  assert.deepEqual(parseAdjudication('risk_surface rearm: 2 survivors of 2 raised; voices openai'),
    { trigger: 'risk_surface', survivors: 2, raised: 2, rearm: true });
  assert.deepEqual(parseAdjudication('risk_surface re-arm: 0 survivors of 1 raised; voices openai/gpt-5.6-sol'),
    { trigger: 'risk_surface', survivors: 0, raised: 1, rearm: true });
  // Those two spellings are the only embedded space admitted...
  assert.equal(parseAdjudication('risk_surface second pass: 0 survivors; voices openai'), null);
  // ...and the one line on disk that never adjudicated at all is still no
  // fire: counting it would feed R1 evidence it does not have.
  assert.equal(parseAdjudication('plan: 6 raised, unadjudicated (advisory gate); voices openai/gpt-5.6-sol'), null);
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

test('R1: a fire with survivors, and the fire a re-arm came back to, both leave the empty count', () => {
  const survived = suggestFromRender(render([
    adjudication('plan: 0 survivors; voices claude-subagent'),
    adjudication('plan: 2 survivors; voices claude-subagent'),
  ]));
  assert.equal(survived.find((x) => x.action === 'review.triggers.plan.gate'), undefined);

  // Two empty fires under ONE corr with a re-arm on that trigger: the re-arm
  // takes one of them, and the one left is below the floor.
  const rearmedOut = suggestFromRender(render([
    adjudication('risk_surface: 0 survivors; voices claude-subagent'),
    adjudication('risk_surface: 0 survivors; voices claude-subagent'),
    rearm('risk_surface'),
  ]));
  assert.equal(rearmedOut.find((x) => x.action === 'review.triggers.risk_surface.gate'), undefined,
    'a gate that forced a fix round has paid for itself on the fire that forced it');
});

test('R1: the re-arm veto is scoped to the FIRE it belongs to, not the trigger\'s lifetime', () => {
  // The same three events as above, spread across two corrs, plus the re-arm
  // ROUND's own adjudication. A lifetime veto silences risk_surface here for
  // as long as the file lives; the fire-scoped one mutes the single fire that
  // forced the round (D-03).
  const out = suggestFromRender(render([
    adjudication('risk_surface: 0 survivors; voices openai', { corr: '1-aaa' }),
    rearm('risk_surface', { corr: '1-aaa' }),
    // The second round's RESULT, not a fire that forced anything - so the veto
    // above must not have landed here.
    adjudication('risk_surface rearm: 0 survivors; voices openai', { corr: '1-aaa' }),
    adjudication('risk_surface: 0 survivors; voices openai', { corr: '2-bbb' }),
  ]));
  const s = out.find((x) => x.action === 'review.triggers.risk_surface.gate');
  assert.ok(s, `expected a fire-scoped gate suggestion, got ${JSON.stringify(out)}`);
  assert.match(s.evidence, /2 of 3 adjudicated fire/);
});

test('R1: a re-arm vetoes the fire that FORCED it - the nearest one before it, not the oldest', () => {
  // Under corr `1-aaa`: an empty fire, then a fire with three survivors, then
  // the re-arm. The re-arm belongs to the three-survivor fire. The corr
  // `2-bbb` fire is only here to make the difference observable - with one
  // corr alone both veto orders land below the floor and say nothing.
  const out = suggestFromRender(render([
    adjudication('risk_surface: 0 survivors; voices openai', { corr: '1-aaa' }),
    adjudication('risk_surface: 3 survivors; voices openai', { corr: '1-aaa' }),
    rearm('risk_surface', { corr: '1-aaa' }),
    adjudication('risk_surface: 0 survivors; voices openai', { corr: '2-bbb' }),
  ]));
  const s = out.find((x) => x.action === 'review.triggers.risk_surface.gate');
  assert.ok(s, `an oldest-first veto eats the empty fire and says nothing: ${JSON.stringify(out)}`);
  assert.match(s.evidence, /2 of 3 adjudicated fire/);
});

test('R1: the live record this repo has been writing for four cycles emits a suggestion', () => {
  // The demonstration recorded in `.planning/phases/2/R1-DEMO.md`, run
  // 2026-08-14: every `outcome` line naming `risk_surface` in this repo's own
  // `.planning/trace.jsonl`, verbatim. They are STRING LITERALS on purpose -
  // that file is gitignored and absent in CI, so a test that read it would go
  // green by reading nothing (D-09). This is the regression guard behind the
  // demonstration: the arithmetic below is the file's, not a fixture's.
  const LIVE = [
    '{"corr":"2-b3748a4","phase":"2","ts":"2026-08-10T18:44:28.643Z","family":"outcome","event":"adjudication","detail":"risk_surface: 0 survivors; voices openai/gpt-5.6-terra"}',
    '{"corr":"1-7502567","phase":"1","ts":"2026-08-13T17:36:33.000Z","family":"outcome","event":"adjudication","detail":"risk_surface: 0 survivors; voices openai/gpt-5.6-terra"}',
    '{"corr":"1-7502567","phase":"1","ts":"2026-08-13T17:56:37.028Z","family":"outcome","event":"rearm","detail":"risk_surface"}',
    '{"corr":"1-7502567","phase":"1","ts":"2026-08-13T19:08:23.371Z","family":"outcome","event":"adjudication","detail":"risk_surface re-arm: 0 survivors of 1 raised; voices openai/gpt-5.6-sol"}',
    '{"corr":"3-d558479","phase":"3","ts":"2026-08-14T03:43:42.447Z","family":"outcome","event":"adjudication","detail":"risk_surface: 3 survivors of 4 raised; voices openai"}',
    '{"corr":"3-d558479","phase":"3","ts":"2026-08-14T03:47:22.001Z","family":"outcome","event":"rearm","detail":"risk_surface"}',
    '{"corr":"3-d558479","phase":"3","ts":"2026-08-14T03:49:29.886Z","family":"outcome","event":"adjudication","detail":"risk_surface rearm: 2 survivors of 2 raised; voices openai"}',
    '{"corr":"3-d558479","phase":"3","ts":"2026-08-14T13:39:29.459Z","family":"outcome","event":"adjudication","detail":"risk_surface: 2 survivors; voices openai/gpt-5.6-sol","raised":3}',
    '{"corr":"2-eebba7d","phase":"2","ts":"2026-08-14T21:16:27.190Z","family":"outcome","event":"adjudication","detail":"risk_surface: 1 survivors; voices openai","raised":2}',
    '{"corr":"2-eebba7d","phase":"2","ts":"2026-08-14T21:18:40.635Z","family":"outcome","event":"rearm","detail":"risk_surface"}',
  ].map((l) => JSON.parse(l));
  const out = suggestFromRender(render(LIVE));
  // 7 fires. The re-arm under `1-7502567` mutes the empty fire before it, the
  // one under `3-d558479` mutes the three-survivor fire before it, and the one
  // under `2-eebba7d` mutes the one-survivor fire before it. Left unvetoed and
  // empty: `2-b3748a4` (raised unrecorded, so 0) and the `re-arm:` round under
  // `1-7502567` (1 raised) - exactly the floor, and 1 raised puts it on the
  // reviewers arm.
  assert.deepEqual(out.filter((x) => /risk_surface/.test(x.subject)), [
    {
      kind: 'suggest',
      subject: 'risk_surface reviewers',
      evidence: '2 of 7 adjudicated fire(s), 0 survivors of 1 raised'
        + ' - the gate caught work; the reviewer set is what looks miscalibrated',
      action: 'review.reviewers',
    },
    {
      kind: 'info',
      subject: 'risk_surface',
      evidence: 'a fire FAILed and re-armed on its own fix - the gate caught real work; keep it',
      action: null,
    },
  ]);
});

test('R1: 0-of-0 and 0-of-9 are opposite evidence and stop proposing one action', () => {
  const empty = suggestFromRender(render(Array.from(
    { length: MIN_FIRES_FOR_GATE_SUGGESTION },
    () => adjudication('plan: 0 survivors; voices openai', { raised: 0 }),
  )));
  const killed = suggestFromRender(render(Array.from(
    { length: MIN_FIRES_FOR_GATE_SUGGESTION },
    () => adjudication('plan: 0 survivors; voices openai', { raised: 9 }),
  )));
  const a = empty.find((x) => x.kind === 'suggest');
  const b = killed.find((x) => x.kind === 'suggest');
  assert.ok(a && b, `${JSON.stringify(empty)} / ${JSON.stringify(killed)}`);
  // The whole point of the split: a gate that found nothing and a reviewer
  // whose every finding was refuted are the same ROW today.
  assert.notEqual(a.subject, b.subject);
  assert.notEqual(a.action, b.action);
  assert.equal(a.action, 'review.triggers.plan.gate');
  assert.equal(b.action, 'review.reviewers');
  assert.match(b.subject, /plan/);
  assert.match(b.evidence, /0 survivors of 18 raised/);
  // ...and nothing proposes turning the gate off on the 0-of-m side.
  assert.equal(killed.find((x) => x.action === 'review.triggers.plan.gate'), undefined);
});

test('R1: a corpus with NO raised counts recorded keeps the gate arm it has today', () => {
  // UNKNOWN is not zero at the reader, but it contributes zero to the total
  // here, which is what leaves every pre-`--raised` trace behaving as it does.
  const out = suggestFromRender(render(Array.from(
    { length: MIN_FIRES_FOR_GATE_SUGGESTION },
    () => adjudication('plan: 0 survivors; voices openai'),
  )));
  assert.ok(out.find((x) => x.action === 'review.triggers.plan.gate'));
  assert.equal(out.find((x) => x.action === 'review.reviewers'), undefined);
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

// --- R6: the coordinator receipt ---------------------------------------------
//
// The render's own `coordinator` block is the input, not events: lib/trace.mjs
// computes the residue once so this rule and `/cad-report` cannot disagree, and
// the test helper deliberately builds a render WITHOUT the block, so every case
// above doubles as proof that the rule tolerates its absence.

/** A render carrying a coordinator block. */
const coordRender = (residue_ms, steps, wall_ms = residue_ms) =>
  ({ counts: {}, roles: {}, events: [], coordinator: { wall_ms, bracket_ms: wall_ms - residue_ms, residue_ms, steps } });

test('R6: a residue above the floor names the total, its share and the top step', () => {
  const out = suggestFromRender(coordRender(
    MIN_RESIDUE_MS_FOR_COORDINATOR_INFO * 4,
    [
      { phase: 1, step: 'analyze', ts: 'a', residue_ms: MIN_RESIDUE_MS_FOR_COORDINATOR_INFO * 3 },
      { phase: 1, step: 'size_check', ts: 'b', residue_ms: MIN_RESIDUE_MS_FOR_COORDINATOR_INFO },
    ],
    MIN_RESIDUE_MS_FOR_COORDINATOR_INFO * 8,
  ));
  const hits = out.filter((x) => x.subject === 'coordinator');
  assert.equal(hits.length, 1, `expected exactly one coordinator entry, got ${JSON.stringify(out)}`);
  assert.equal(hits[0].kind, 'info');
  assert.equal(hits[0].action, null, 'no config key governs coordinator spend');
  assert.match(hits[0].evidence, /40 min/);
  assert.match(hits[0].evidence, /50% of wall time/);
  assert.match(hits[0].evidence, /`analyze`/);
});

test('R6: a residue below the floor stays silent - a minute between steps is an artefact', () => {
  const out = suggestFromRender(coordRender(
    MIN_RESIDUE_MS_FOR_COORDINATOR_INFO - 1,
    [{ phase: 1, step: 'analyze', ts: 'a', residue_ms: MIN_RESIDUE_MS_FOR_COORDINATOR_INFO - 1 }],
  ));
  assert.deepEqual(out, []);
});

test('R6: a render with no coordinator block says NOTHING about the coordinator (D-06)', () => {
  // Not "absent coordinator record", not a zero - silence. Every trace written
  // before the marker existed reads this path.
  for (const out of [
    suggestFromRender(render([])),
    suggestFromRender(render([rearm('risk_surface')])),
    suggestFromRender(render([], { 'cad-executor': { dispatches: 2, tokens: 300000 } })),
  ]) {
    assert.equal(out.find((x) => x.subject === 'coordinator'), undefined);
    assert.equal(out.find((x) => /coordinator/i.test(x.evidence)), undefined);
  }
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
    // Both R1 arms, so the split's new action is held to the same rule.
    adjudication('diff: 0 survivors; voices x', { raised: 9 }),
    adjudication('diff: 0 survivors; voices x', { raised: 9 }),
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

// --- the committed fixture: the suggestion list TODAY ------------------------
//
// The other half of AC1's guard (the render half lives in trace.test.mjs):
// verbatim's own run record, read through the REAL renderer rather than a
// hand-built `render()` helper, so this test sees exactly what `trace suggest`
// sees. The list is a literal, measured before the coordinator work - a list
// recomputed from the fixture would agree with itself no matter what the rules
// did. Any new rule that speaks on a trace carrying no coordinator markers
// fails here, which is D-06 made falsifiable.
//
// RE-PINNED ONCE, in the MSR-02 commit that made R5 name what its total is not.
// The arithmetic did NOT move and that is the point of recording it here: the
// receipt still reads `423,846 of 968,705 recorded tokens (44%)`, the same
// three figures this literal has carried since it was measured, because the
// change appends `SPEND_EXCLUDES` to the evidence and computes nothing new -
// no ratio and no second total. Only the trailing `; excludes ...`
// clause is new, and it is a `join(', ')` over the frozen array in
// `lib/trace-suggest.mjs`, so this literal moves again only when that array
// does. D-12: a necessary re-pin carries its arithmetic rather than being
// quietly edited until it agrees.

const FIXTURE = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'verbatim.trace.jsonl');

test('fixture: the committed verbatim trace suggests exactly what it did before this phase', async () => {
  const { renderTrace, tracePath } = await import('./lib/trace.mjs');
  const dir = mkdtempSync(join(tmpdir(), 'cad-suggest-fx-'));
  try {
    const planning = join(dir, '.planning');
    mkdirSync(planning, { recursive: true });
    copyFileSync(FIXTURE, tracePath(planning));
    assert.deepEqual(suggestFromRender(renderTrace(planning, '1')), [
      {
        kind: 'info',
        subject: 'cad-executor',
        evidence: 'largest recorded spend: 423,846 of 968,705 recorded tokens (44%)'
          + '; excludes the orchestrator\'s own turns, cross-model provider calls, figureless returns',
        action: null,
      },
      {
        kind: 'info',
        subject: 'risk_surface',
        evidence: 'a fire FAILed and re-armed on its own fix - the gate caught real work; keep it',
        action: null,
      },
    ]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
