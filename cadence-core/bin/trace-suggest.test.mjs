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
import { READS_ROTATION, ROTATED_READS_FILE } from './lib/read-trace.mjs';

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
      // SGT-01, and read as the ONE-ARGUMENT degradation: this call passes no
      // resolution, so the reviewer set resolves to nothing and the record
      // carries no `routing/resolve` event to name a level with. The direction
      // is the rule's own and is here whatever the caller passed.
      direction: 'raise',
      current: 'unset: no config layer pins this, so the stakes level decides it',
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

// --- SGT-01: the direction, the current value and the target ------------------
//
// The rules above say WHICH key; these say which way to move it and what it
// holds now. The resolution is the caller's second argument - `planning.mjs`
// reads the merged config, the gate ladder and the stakes level, this file
// stays pure - and every case below passes one by hand, which is what keeps the
// pure-render discipline intact.

/** The resolution shape `planning.mjs`'s suggest arm passes in. */
const GATES = ['off', 'advisory', 'deferred', 'blocking', 'adjudicated'];
const RUNGS = ['low', 'medium', 'high', 'xhigh', 'max'];
const twoEmptyFires = (trigger, extra = {}) => Array.from(
  { length: MIN_FIRES_FOR_GATE_SUGGESTION },
  () => adjudication(`${trigger}: 0 survivors; voices openai`, extra),
);

test('SGT-01: R1s gate arm moves DOWN, prints the value a layer set, and proposes one step below it', () => {
  const out = suggestFromRender(render(twoEmptyFires('plan')), {
    values: { 'review.triggers.plan.gate': 'blocking' },
    gates: GATES,
    stakes: 'shipped',
  });
  const s = out.find((x) => x.action === 'review.triggers.plan.gate');
  assert.ok(s, JSON.stringify(out));
  assert.equal(s.direction, 'lower');
  assert.equal(s.current, 'blocking');
  assert.equal(s.proposed, 'deferred', 'the target is one step down the ladder the caller passed');
});

test('SGT-01: an unset gate names the level that decides it and carries NO proposed', () => {
  const out = suggestFromRender(render(twoEmptyFires('plan')), { gates: GATES, stakes: 'shipped' });
  const s = out.find((x) => x.action === 'review.triggers.plan.gate');
  assert.ok(s, JSON.stringify(out));
  assert.equal(s.direction, 'lower');
  assert.match(s.current, /unset/);
  assert.match(s.current, /shipped/);
  assert.ok(!/advisory|blocking|adjudicated/.test(String(s.current)),
    'D-06: an unset gate names the DECIDER, never the value that level would fire');
  // Key presence, never a null comparison: `proposed: null` would satisfy an
  // equality check and is exactly what D-12 forbids.
  assert.equal('proposed' in s, false, 'an unset gate has no rung on the ladder to step down from');
});

test('SGT-01: a record carrying no stakes level says unset without naming one', () => {
  const out = suggestFromRender(render(twoEmptyFires('plan')), { gates: GATES });
  const s = out.find((x) => x.action === 'review.triggers.plan.gate');
  assert.ok(s);
  assert.match(s.current, /unset/);
  assert.match(s.current, /the stakes level decides it$/);
});

test('SGT-01: R1s reviewer arm moves UP - strengthen the set - and proposes nothing', () => {
  const out = suggestFromRender(render(twoEmptyFires('diff', { raised: 9 })), {
    values: { 'review.reviewers': ['openai'] },
    gates: GATES,
    stakes: 'shipped',
  });
  const s = out.find((x) => x.action === 'review.reviewers');
  assert.ok(s, JSON.stringify(out));
  assert.equal(s.direction, 'raise', 'lower would name the opposite move on a gate that caught work');
  assert.deepEqual(s.current, ['openai']);
  assert.equal('proposed' in s, false, 'which backend to add is not a thing the record names');
});

test('SGT-01: R3 proposes the rung the escalated resolves actually landed on', () => {
  const out = suggestFromRender(render([
    resolve('cad-planner', { escalated: true, effort: 'xhigh', stakes: 'shipped' }),
    resolve('cad-planner', { escalated: true, effort: 'xhigh', stakes: 'shipped' }),
    resolve('cad-planner', { effort: 'high', stakes: 'shipped' }),
  ]), { gates: GATES, stakes: 'shipped' });
  const s = out.find((x) => x.action === 'model.effort.cad-planner');
  assert.ok(s, JSON.stringify(out));
  assert.equal(s.direction, 'raise');
  assert.match(s.current, /unset/);
  assert.match(s.current, /shipped/);
  assert.equal(s.proposed, 'xhigh');
});

test('SGT-01: R3 omits a target that names no raise against the rung in force', () => {
  const climbed = [
    resolve('cad-planner', { escalated: true, effort: 'xhigh', stakes: 'shipped' }),
    resolve('cad-planner', { escalated: true, effort: 'xhigh', stakes: 'shipped' }),
  ];
  const at = (rung) => suggestFromRender(render(climbed), {
    values: { 'model.effort.cad-planner': rung },
    gates: GATES,
    rungs: RUNGS,
    stakes: 'shipped',
  }).find((x) => x.action === 'model.effort.cad-planner');

  const same = at('xhigh');
  assert.ok(same, 'the suggestion still stands - it is the TARGET that cannot be named');
  assert.equal(same.direction, 'raise');
  assert.equal(same.current, 'xhigh');
  assert.equal('proposed' in same, false,
    'a target equal to the rung in force is a retune that changes nothing');

  const above = at('max');
  assert.ok(above, JSON.stringify(above));
  assert.equal(above.current, 'max');
  assert.equal('proposed' in above, false,
    'a target UNDER the rung in force would contradict the raise it ships beside');

  const below = at('high');
  assert.ok(below, JSON.stringify(below));
  assert.equal(below.proposed, 'xhigh', 'a real raise still prices its target');
});

test('SGT-01: R3 keeps the record\'s rung when no layer pins the key, ladder or not', () => {
  const climbed = [
    resolve('cad-planner', { escalated: true, effort: 'xhigh', stakes: 'shipped' }),
    resolve('cad-planner', { escalated: true, effort: 'xhigh', stakes: 'shipped' }),
  ];
  const unset = suggestFromRender(render(climbed), { gates: GATES, rungs: RUNGS, stakes: 'shipped' })
    .find((x) => x.action === 'model.effort.cad-planner');
  assert.equal(unset.proposed, 'xhigh',
    'nothing is in force to compare against, and the rung is still a change from a default nobody stated');

  const noLadder = suggestFromRender(render(climbed), {
    values: { 'model.effort.cad-planner': 'high' },
    gates: GATES,
    stakes: 'shipped',
  }).find((x) => x.action === 'model.effort.cad-planner');
  assert.equal('proposed' in noLadder, false,
    'no ladder means no comparison, and the omission IS the report');
});

test('SGT-01: R4 moves DOWN, prints the resolved ceiling, and prices nothing', () => {
  const out = suggestFromRender(render([checkpoint('cad-executor'), checkpoint('cad-executor')]), {
    values: { 'workflow.max_plan_tasks': 8 },
    gates: GATES,
    stakes: 'shipped',
  });
  const s = out.find((x) => x.action === 'workflow.max_plan_tasks');
  assert.ok(s, JSON.stringify(out));
  assert.equal(s.direction, 'lower');
  assert.equal(s.current, 8);
  assert.equal('proposed' in s, false, 'no field in the record names a plan task count');
});

test('SGT-01: R4 goes silent when every checkpoint it counted maps to a plan under the ceiling', () => {
  const events = [checkpoint('cad-executor'), checkpoint('cad-executor')];
  const base = { values: { 'workflow.max_plan_tasks': 8 }, gates: GATES, stakes: 'shipped' };
  const ceilingOf = (out) => out.find((x) => x.action === 'workflow.max_plan_tasks');

  assert.equal(ceilingOf(suggestFromRender(render(events), { ...base, checkpointTasks: [4, 3] })),
    undefined, 'the evidence does not bind: both plans are under the ceiling it would lower');

  // D-09: one unreadable plan leaves the rule speaking. Unknown is never
  // under-ceiling, or an archived cycle silences the rule permanently.
  assert.ok(ceilingOf(suggestFromRender(render(events), { ...base, checkpointTasks: [4, null] })),
    'a checkpoint whose plan file cannot be read counts as unknown, not as under-ceiling');

  // Equal is not under.
  assert.ok(ceilingOf(suggestFromRender(render(events), { ...base, checkpointTasks: [4, 8] })),
    'a plan AT the ceiling is evidence for the ceiling, not against it');

  // D-10: the comparison is the RESOLVED ceiling, never a hardcoded 8. These
  // two counts are over 8 and under 12, so a hardcoded comparison speaks here.
  assert.equal(ceilingOf(suggestFromRender(render(events), {
    values: { 'workflow.max_plan_tasks': 12 }, stakes: 'shipped', checkpointTasks: [9, 10],
  })), undefined, 'a project that raised the ceiling is told to lower one its plans never touched');
});

test('SGT-01: a one-argument call still answers - a direction and an honest unset, never a throw', () => {
  // Every pure-render test above calls the function this way; degrading to a
  // throw or to a missing direction would take all of them with it.
  const out = suggestFromRender(render([
    ...twoEmptyFires('plan'),
    resolve('cad-planner', { escalated: true }), resolve('cad-planner', { escalated: true }),
    checkpoint('cad-executor'), checkpoint('cad-executor'),
  ]));
  const keyed = out.filter((x) => x.action !== null);
  assert.ok(keyed.length >= 3, JSON.stringify(out));
  for (const s of keyed) {
    assert.ok(s.direction === 'raise' || s.direction === 'lower', `${s.action} has no direction`);
    assert.match(String(s.current), /unset/);
    assert.equal('proposed' in s, false, `${s.action} priced a target off no resolution at all`);
  }
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

test('D-12: an info receipt gains NONE of the three new keys, under every rule that emits one', () => {
  // The silence is the proof the change is invisible where nothing was
  // computed - and it is checked by key PRESENCE, never against null: a
  // `direction: null` would satisfy an equality check and is exactly what D-12
  // forbids. The resolution passed here is a FULL one, so the guard holds on
  // the path where the caller resolved every value there is.
  const full = {
    values: {
      'review.triggers.risk_surface.gate': 'blocking',
      'review.reviewers': ['openai'],
      'model.effort.cad-executor': 'xhigh',
      'workflow.max_plan_tasks': 8,
    },
    gates: GATES,
    stakes: 'shipped',
  };
  const outs = [
    // R2's re-arm receipt, R3's held-rung receipt and R5's spend receipt.
    suggestFromRender({
      counts: {},
      roles: { 'cad-executor': { dispatches: 4, tokens: 300000 }, 'cad-planner': { dispatches: 1, tokens: 100000 } },
      events: [
        rearm('risk_surface'),
        ...Array.from({ length: MIN_DISPATCHES_FOR_RUNG_INFO }, () => resolve('cad-executor', {})),
      ],
    }, full),
    // R6's coordinator receipt.
    suggestFromRender(coordRender(
      MIN_RESIDUE_MS_FOR_COORDINATOR_INFO * 2,
      [{ phase: 1, step: 'analyze', ts: 'a', residue_ms: MIN_RESIDUE_MS_FOR_COORDINATOR_INFO * 2 }],
    ), full),
  ];
  const infos = outs.flat().filter((x) => x.kind === 'info');
  assert.equal(infos.length, 4,
    `expected R2, R3's receipt, R5 and R6 - got ${JSON.stringify(infos.map((x) => x.subject))}`);
  for (const e of infos) {
    for (const key of ['direction', 'current', 'proposed']) {
      assert.equal(key in e, false,
        `an info receipt carries \`${key}\` - it asks for nothing, so there is nothing to move: `
        + JSON.stringify(e));
    }
    assert.deepEqual(Object.keys(e).sort(), ['action', 'evidence', 'kind', 'subject'],
      `an info receipt's shape moved off {kind, subject, evidence, action}: ${JSON.stringify(e)}`);
    assert.equal(e.action, null);
  }
});

test('D-12: a suggest entry that cannot be priced omits `proposed` by key, never as a null', () => {
  // Both unpriceable arms at once: R1's reviewer arm (which backend to add is
  // not a thing the record names) and R4 (no field in the record names a plan's
  // task count).
  const out = suggestFromRender(render([
    ...twoEmptyFires('diff', { raised: 9 }),
    checkpoint('cad-executor'), checkpoint('cad-executor'),
  ]), {
    values: { 'review.reviewers': ['openai'], 'workflow.max_plan_tasks': 8 },
    gates: GATES,
    stakes: 'shipped',
  });
  const priced = out.filter((x) => x.kind === 'suggest');
  assert.equal(priced.length, 2, JSON.stringify(out));
  for (const e of priced) {
    assert.equal('proposed' in e, false,
      `${e.action} carries a target nothing computed: ${JSON.stringify(e)}`);
    assert.ok(e.direction && e.current !== undefined, JSON.stringify(e));
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
    // The record the suggestions were argued off, which this envelope did not
    // name at all until TRC-08 - and no rotation key, because this record never
    // rotated.
    assert.equal(out.file, join('.planning', 'trace.jsonl'));
    assert.equal('rotated' in out, false);
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

// --- MSR-02: the shipped shape of the spend receipt's evidence string --------
//
// WATCHED FAILING AT 4b1d659, the tip of this plan's unpatched tree. Observed
// there, with this file copied into that checkout's `cadence-core/bin/`:
//
//   $ node --test cadence-core/bin/trace-suggest.test.mjs
//   x MSR-02: the spend receipt names all three excluded sources, from the one exported list
//     AssertionError [ERR_ASSERTION]: the spend receipt does not name `the
//     orchestrator's own turns` - a /cad-suggest reader is told a worker-return
//     token sum is the run's cost. Got: largest recorded spend: 300,000 of
//     400,000 recorded tokens (75%)
//   i pass 23
//   i fail 2
//
// The recipe uses the GUARDED-READ arm, not the copy-the-export arm, and the
// distinction is the whole watch: copying this phase's `lib/trace-suggest.mjs`
// into the old checkout would carry the fixed evidence string in with it and
// the check would go GREEN there, proving nothing. So only this file is copied,
// the old seam emits the old string, and the fallback list below supplies the
// three names the absent export would have.
//
// The second failure in that run is the committed-fixture deepEqual, which is
// the same fact read from the other end - the old seam's literal string against
// this phase's re-pinned one - and it is expected there.
//
// To re-watch: `git worktree add --detach <tmp> 4b1d659`, copy this file into
// `<tmp>/cadence-core/bin/`, run `node --test cadence-core/bin/trace-suggest.test.mjs`
// from `<tmp>`, then `git worktree remove <tmp>`.
//
// The subject is the RULE, not the committed fixture: the assertion runs over a
// render built by this file's own `render()` helper, so a fixture re-pin can
// never carry this check green. And the three names are READ from the frozen
// export rather than copied here - a test holding its own copy of the list goes
// green on the day the seam and `workflows/report.md` stop agreeing about what
// the figure excludes, which is the one failure this check exists to catch.
//
// The read is GUARDED, and that guard is what makes the re-watch above possible
// at all. A named `import { SPEND_EXCLUDES }` would die at module LINK against
// an unpatched checkout, and a recorded FAIL that only proves a new export does
// not exist yet says nothing about whether unpatched `/cad-suggest` makes the
// wrong cost claim. A namespace import never fails on an absent name, so the
// old tree reaches the assertion and fails on the CLAIM.
import * as traceSuggestModule from './lib/trace-suggest.mjs';

const SPEND_EXCLUDES_READ = Array.isArray(traceSuggestModule.SPEND_EXCLUDES)
  ? traceSuggestModule.SPEND_EXCLUDES
  : ["the orchestrator's own turns", 'cross-model provider calls', 'figureless returns'];

// --- SGT-01: the whole path returns a retune, not a description -------------
//
// WATCHED FAILING AT 01b2ca1, the tip of this plan's unpatched tree. Observed
// there, with this file copied into that checkout's `cadence-core/bin/`:
//
//   $ node --test cadence-core/bin/trace-suggest.test.mjs
//   x SGT-01: `trace suggest` returns a direction, a current, and a proposed
//     where the record prices one
//     AssertionError [ERR_ASSERTION]: `model.effort.cad-planner` came back with
//     no direction - /cad-suggest names a key and leaves the user to work out
//     which way to move it. Got: {"kind":"suggest","subject":"cad-planner",
//     "evidence":"2 of 2 resolves climbed to the retry rung","action":
//     "model.effort.cad-planner"}
//   i pass 25
//   i fail 11
//
// and that run exits 1. The other ten failures are this plan's own new
// assertions read against the old seam - the direction/current cases, the
// binding check and the receipt-silence guards - which is the same fact from
// every other end; this one is the check the requirement is written on.
//
// To re-watch: `git worktree add --detach <tmp> 01b2ca1`, copy this file into
// `<tmp>/cadence-core/bin/`, run `node --test cadence-core/bin/trace-suggest.test.mjs`
// from `<tmp>`, then `git worktree remove <tmp>`.
//
// The subject is the whole PATH rather than the pure function: the values a
// direction and a target are read from live on disk, so a check over
// `suggestFromRender` alone would pass on a seam that resolved none of them and
// passed nothing in. So the record is written through `appendEvent`, the config
// layer is a real file, and the CLI is run end to end - what is asserted is the
// RETURN a `/cad-suggest` reader gets.

test('SGT-01: `trace suggest` returns a direction, a current, and a proposed where the record prices one', async () => {
  const { appendEvent } = await import('./lib/trace.mjs');
  const { writeFileSync } = await import('node:fs');
  const dir = mkdtempSync(join(tmpdir(), 'cad-suggest-sgt-'));
  try {
    const planning = join(dir, '.planning');
    mkdirSync(planning, { recursive: true });
    // A repo layer, so both currents are the layer's own whatever a global
    // layer on the running machine holds - the repo wins at the merge.
    writeFileSync(join(planning, 'config.json'), JSON.stringify({
      review: { triggers: { plan: { gate: 'blocking' } } },
      model: { effort: { 'cad-planner': 'high' } },
    }));
    for (let i = 0; i < MIN_FIRES_FOR_GATE_SUGGESTION; i++) {
      appendEvent(planning, {
        phase: '1', family: 'outcome', event: 'adjudication',
        detail: 'plan: 0 survivors; voices openai',
      });
    }
    for (let i = 0; i < MIN_ESCALATIONS_FOR_RUNG_SUGGESTION; i++) {
      appendEvent(planning, {
        phase: '1', family: 'routing', event: 'resolve',
        role: 'cad-planner', escalated: true, effort: 'xhigh', stakes: 'shipped',
      });
    }

    const res = JSON.parse(execFileSync('node', [BIN, 'trace', 'suggest', '--phase', '1'],
      { cwd: dir, encoding: 'utf8' }).trim().split('\n').pop() || '{}');
    assert.equal(res.ok, true);
    const keyed = res.suggestions.filter((s) => s.action !== null);
    assert.equal(keyed.length, 2, `expected the gate and the effort key: ${JSON.stringify(res.suggestions)}`);
    for (const s of keyed) {
      assert.ok(s.direction === 'raise' || s.direction === 'lower',
        `\`${s.action}\` came back with no direction - /cad-suggest names a key and leaves the`
        + ` user to work out which way to move it. Got: ${JSON.stringify(s)}`);
      assert.ok(s.current !== undefined && s.current !== null,
        `\`${s.action}\` came back with no current value - the retune describes the run instead`
        + ` of advising a change. Got: ${JSON.stringify(s)}`);
    }

    const gate = keyed.find((s) => s.action === 'review.triggers.plan.gate');
    assert.ok(gate, JSON.stringify(keyed));
    assert.equal(gate.direction, 'lower');
    assert.equal(gate.current, 'blocking');
    // `deferred`, not `advisory`: this arm reads the SHIPPED ladder in
    // route-table.json, so it is the row that reddens if the gate this phase
    // inserted is moved. Its position is the decision - a `blocking` gate whose
    // fires keep coming back empty is proposed down to a mode that still stops
    // the LAND, never to `advisory`, which stops nothing.
    assert.equal(gate.proposed, 'deferred',
      'the gate arm prices its target one step down the ladder route-table.json states');

    const effort = keyed.find((s) => s.action === 'model.effort.cad-planner');
    assert.ok(effort, JSON.stringify(keyed));
    assert.equal(effort.direction, 'raise');
    assert.equal(effort.current, 'high');
    assert.equal(effort.proposed, 'xhigh',
      'the rung the record shows this role\'s escalated resolves landing on is the target');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('MSR-02: the spend receipt names all three excluded sources, from the one exported list', () => {
  const out = suggestFromRender(render([], {
    'cad-executor': { dispatches: 2, tokens: 300000 },
    'cad-planner': { dispatches: 1, tokens: 100000 },
  }));
  const s = out.find((x) => x.evidence.includes('largest recorded spend'));
  assert.ok(s, 'the spend receipt no longer fires on a render carrying token figures');

  assert.equal(SPEND_EXCLUDES_READ.length, 3,
    'the exclusion list is no longer the three sources the caveat is written about');
  for (const name of SPEND_EXCLUDES_READ) {
    assert.ok(s.evidence.includes(name),
      `the spend receipt does not name \`${name}\` - a /cad-suggest reader is told a`
      + ` worker-return token sum is the run's cost. Got: ${s.evidence}`);
  }

  // Still a receipt, not a suggestion: D-11 forbids the /cad-suggest half
  // growing a flag, an envelope key or anything to act on.
  assert.equal(s.kind, 'info');
  assert.equal(s.action, null);
});

// --- R7: in-dispatch re-reading, per role (RDX-01) ---------------------------
//
// The figure `.planning/reads.jsonl` has carried for four cycles, reaching a
// consumer that acts on it. Two things this section pins that no other rule
// needs: the gate is the ROLE MAP rather than the number, and the entry's
// `action` is null BY DECISION - no key in `config.schema.json` governs
// in-dispatch re-reading, so the entry names a discipline remedy instead of
// pointing at an unrelated key.

import { IN_DISPATCH_FLOORS } from './lib/trace-suggest.mjs';

/** The fold shape `lib/read-trace.mjs`'s `inDispatchReads` returns. */
const inDispatch = (roles, extra = {}) => ({
  roles, joined: 10114, fileCarrying: 6423, coverage: 0.63, coordinatorFiles: 4395, ...extra,
});
/** One per-role row, defaulting to the spike's measured `cad-executor` figures. */
const roleRow = (role, ratio, extra = {}) => ({
  role, brackets: 78, touches: 4985, distinct: 1371, ratio,
  worst: { path: 'cadence-core/bin/planning.mjs', count: 29, phase: '4', plan: '1' },
  ...extra,
});

test('R7: cad-executor at 3.64 emits one entry carrying the worst file, the direction, the coverage and the scope', () => {
  const out = suggestFromRender(render([]), undefined,
    inDispatch([roleRow('cad-executor', 3.64)]));
  assert.equal(out.length, 1, JSON.stringify(out));
  const e = out[0];
  assert.equal(e.kind, 'info');
  assert.equal(e.subject, 'cad-executor');
  // Four assertions over the ONE string, separately, so dropping any single
  // element reddens on its own rather than hiding behind the other three.
  assert.ok(e.evidence.includes('3.64'), `the ratio is missing: ${e.evidence}`);
  assert.ok(e.evidence.includes('read `cadence-core/bin/planning.mjs` 29 times'),
    `the named target is missing - a role-wide ratio is not actionable: ${e.evidence}`);
  assert.match(e.evidence, /\bDOWN\b/,
    `the direction is missing - SC1 asks which way the figure should move: ${e.evidence}`);
  assert.ok(e.evidence.includes('63%'),
    `the coverage share is missing - the figure reads as a total: ${e.evidence}`);
  assert.ok(e.evidence.includes('nothing prunes `.planning/reads.jsonl` at a milestone close'),
    `the scope is missing - a reader cannot tell which milestones it spans: ${e.evidence}`);
  // TRC-10: the close still prunes nothing, but the record IS cut at its size
  // bound now, so the scope clause carries both halves and points at the
  // envelope key that says whether this run's record was one of the cut ones.
  assert.ok(e.evidence.includes('the cut at its size bound'),
    `the scope names no cut - the record shortens and the entry does not say so: ${e.evidence}`);
  assert.ok(e.evidence.includes('still in the LIVE record'),
    `the scope does not scope itself to the live record: ${e.evidence}`);
  assert.ok(e.evidence.includes('`reads.rotated` on this envelope'),
    `the scope points at no key for whether this run was cut: ${e.evidence}`);
  // The OLD conclusion, gone rather than qualified: "every milestone still in
  // that file" was true only while nothing shortened the record.
  assert.equal(e.evidence.includes('reaches every milestone still in that file'), false,
    `the pre-rotation conclusion survived: ${e.evidence}`);
  // The exclusion and its reason, which no prose surface can supply for a
  // reader running the seam directly.
  assert.ok(e.evidence.includes('4,395 coordinator read(s) carrying files'), e.evidence);
  assert.ok(e.evidence.includes('no dispatch bracket'), e.evidence);
  // The dispatch that held the worst case.
  assert.ok(e.evidence.includes('(phase 4, plan 1)'), e.evidence);
});

test('SC7 pin: the in-dispatch entry names NO config key - `action` is null and it says so in words', () => {
  // A later edit pointing this entry at `workflow.max_plan_tasks` or
  // `workflow.max_dispatch_tokens.<role>` reddens HERE. Neither governs
  // in-dispatch re-reading: the first counts tasks and lowering it moves the
  // same opens into more dispatches, the second is report-only by its own
  // purpose text.
  const [e] = suggestFromRender(render([]), undefined,
    inDispatch([roleRow('cad-executor', 3.64)]));
  assert.equal(e.action, null);
  assert.ok(e.evidence.includes('No key in `config.schema.json` governs in-dispatch re-reading'),
    `the entry does not state that no key governs this: ${e.evidence}`);
  assert.ok(e.evidence.includes('the remedy is discipline, not configuration'),
    `the entry states no remedy, leaving a reader with a ratio: ${e.evidence}`);
  // The `Suggestion` vocabulary stays closed - `suggest.md`'s ask step builds
  // `/cad-config <key>=<value>` out of `action` plus `proposed`.
  for (const key of ['direction', 'current', 'proposed']) {
    assert.equal(key in e, false, `an info receipt carries \`${key}\`: ${JSON.stringify(e)}`);
  }
});

test('R7: the MAP is the gate, not the number - an unnamed role stays silent at any ratio', () => {
  assert.deepEqual(Object.keys(IN_DISPATCH_FLOORS).sort(), ['cad-executor', 'cad-verifier']);
  for (const role of ['cad-planner', 'cad-assumptions-analyzer', 'cad-reviewer']) {
    // Its measured band, and then a ratio far above every floor in the map.
    for (const ratio of [1.88, 5.0]) {
      assert.deepEqual(
        suggestFromRender(render([]), undefined, inDispatch([roleRow(role, ratio)])), [],
        `${role} at ${ratio} spoke - the noise band fires on the number rather than the map`);
    }
  }
});

test('R7: a role exactly AT its floor emits; a hair under it does not', () => {
  const at = suggestFromRender(render([]), undefined,
    inDispatch([roleRow('cad-verifier', IN_DISPATCH_FLOORS['cad-verifier'])]));
  assert.equal(at.length, 1, JSON.stringify(at));
  assert.equal(at[0].subject, 'cad-verifier');
  const under = suggestFromRender(render([]), undefined,
    inDispatch([roleRow('cad-verifier', 1.99)]));
  assert.deepEqual(under, []);
});

test('R7: a null ratio emits NOTHING, and no evidence anywhere renders it as a zero', () => {
  // Every record written before the `files` field existed folds to this shape.
  const nulled = roleRow('cad-executor', null,
    { brackets: 0, touches: 0, distinct: 0, worst: null });
  assert.deepEqual(
    suggestFromRender(render([]), undefined, inDispatch([nulled], { coverage: 0, fileCarrying: 0 })),
    []);
  // ...and with a firing role beside it, the null one still contributes no
  // sentence: a `0` here is the reading that says each file was opened once.
  const mixed = suggestFromRender(render([]), undefined,
    inDispatch([nulled, roleRow('cad-verifier', 2.05)]));
  assert.equal(mixed.length, 1);
  assert.equal(mixed[0].subject, 'cad-verifier');
  assert.ok(!JSON.stringify(mixed).includes('0 opens per distinct file'),
    `a null ratio was rendered as a zero: ${JSON.stringify(mixed)}`);
});

test('R7: a one- and two-argument call return exactly what they returned before', () => {
  const events = [
    ...twoEmptyFires('plan'),
    rearm('risk_surface'),
    ...Array.from({ length: MIN_ESCALATIONS_FOR_RUNG_SUGGESTION }, () => resolve('cad-planner', { escalated: true })),
    checkpoint('cad-executor'), checkpoint('cad-executor'),
  ];
  const r = render(events, { 'cad-executor': { dispatches: 4, tokens: 300000 } });
  const res = { values: { 'workflow.max_plan_tasks': 8 }, gates: GATES, stakes: 'shipped' };
  const one = suggestFromRender(r);
  const two = suggestFromRender(r, res);
  // An absent third argument is silent - not an entry saying nothing.
  assert.deepEqual(two, suggestFromRender(r, res, undefined));
  assert.deepEqual(one, suggestFromRender(r, undefined, undefined));
  for (const s of [...one, ...two]) {
    assert.ok(!s.evidence.includes('in-dispatch'),
      `an in-dispatch entry rode a call that passed no reads: ${JSON.stringify(s)}`);
  }
  // A malformed third argument is the same silence, never a throw.
  for (const bad of [null, {}, { roles: null }, { roles: [null, 'x'] }]) {
    assert.deepEqual(suggestFromRender(r, res, /** @type {any} */ (bad)), two);
  }
});

// --- R7 through the seam, on COMMITTED fixtures (RDX-01) ---------------------
//
// A pair of its own rather than an extension of `fixtures/join.*`: those are
// fixed exactly by `read-trace.test.mjs`'s partition assertion over 8 calls,
// none of their reads carries a `files` array, and their two `cad-executor`
// brackets deliberately OVERLAP so a read between them is ambiguous rather than
// joined. This pair needs the opposite of all three.
//
// What the pair fixes, arithmetic first so a re-pin has to carry it:
//   - `cad-executor` plan 1 (09:01-09:30) touches `planning.mjs` 7 times and
//     `lib/trace.mjs` once: 8 touches over 2 distinct.
//   - `cad-executor` plan 2 (09:40-09:50), non-overlapping, touches
//     `planning.mjs` twice: 2 touches over 1 distinct.
//   - Per role that is 10 touches over 3 summed distinct = 3.33, clear of the
//     3.00 floor, with `planning.mjs` at 7 inside plan 1 as the worst pair.
//   - `cad-planner` (10:00-10:10) touches `PROJECT.md` 4 times and `ROADMAP.md`
//     twice: 6 over 2 = 3.00. Higher than `cad-executor`'s floor and it still
//     says nothing, because the MAP is the gate.
//   - One `coordinator` read carries two files and reaches no role.

import { writeFileSync, readFileSync, chmodSync, accessSync, constants } from 'node:fs';

const REREAD = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

/**
 * A planning root holding the reread pair, optionally with `files` stripped.
 *
 * `rotated` prepends the line `rotateReads` writes into a fresh record - the
 * exact shape, built from `READS_ROTATION` and `ROTATED_READS_FILE` rather than
 * from copied strings, so a change to either spelling reddens here instead of
 * leaving the fixture asserting a marker the writer no longer produces.
 */
function rereadRoot({ stripFiles = false, noReads = false, rotated = false } = {}) {
  const dir = join(mkdtempSync(join(tmpdir(), 'cad-reread-')), '.planning');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'trace.jsonl'), readFileSync(join(REREAD, 'reread.trace.jsonl'), 'utf8'));
  if (noReads) return dir;
  let reads = readFileSync(join(REREAD, 'reread.reads.jsonl'), 'utf8');
  if (stripFiles) {
    reads = reads.split('\n').filter(Boolean)
      .map((l) => { const r = JSON.parse(l); delete r.files; return JSON.stringify(r); })
      .join('\n') + '\n';
  }
  if (rotated) reads = `${JSON.stringify(ROTATION_MARKER)}\n${reads}`;
  writeFileSync(join(dir, 'reads.jsonl'), reads);
  return dir;
}

/** The first line of a record `rotateReads` has just cut. */
const ROTATION_MARKER = {
  ts: '2026-08-21T08:59:00.000Z',
  event: READS_ROTATION,
  file: ROTATED_READS_FILE,
};

/** Run the seam and parse its one JSON line, `ok:false` included. */
function rereadSeam(dir, args) {
  try {
    return JSON.parse(execFileSync('node', [BIN, '--dir', dir, ...args], { encoding: 'utf8' }));
  } catch (e) {
    return JSON.parse(e.stdout);
  }
}

/** The in-dispatch entry, or undefined. */
const inDispatchEntry = (out) => (out.suggestions || [])
  .find((s) => typeof s.evidence === 'string' && s.evidence.includes('in-dispatch re-reading'));

test('seam: `trace suggest` opens reads.jsonl and names the fixture worst file, with no config key', () => {
  const out = rereadSeam(rereadRoot(), ['trace', 'suggest']);
  assert.equal(out.ok, true);
  const e = inDispatchEntry(out);
  assert.ok(e, `no in-dispatch entry: ${JSON.stringify(out.suggestions)}`);
  assert.equal(e.subject, 'cad-executor');
  assert.equal(e.action, null);
  assert.ok(e.evidence.includes('3.33'), e.evidence);
  assert.ok(e.evidence.includes('read `cadence-core/bin/planning.mjs` 7 times (phase 4, plan 1)'), e.evidence);
  assert.ok(e.evidence.includes('Excludes 1 coordinator read(s)'), e.evidence);
  // The noise-band role clears `cad-executor`'s floor at 3.00 and still says
  // nothing: it is not in `IN_DISPATCH_FLOORS`.
  assert.ok(!out.suggestions.some((s) => s.subject === 'cad-planner'
    && s.evidence.includes('in-dispatch re-reading')),
    `cad-planner spoke: ${JSON.stringify(out.suggestions)}`);
  assert.equal('warnings' in out, false, JSON.stringify(out.warnings));
});

test('seam: reads carrying no `files`, and no reads file at all, both yield NO entry and no error', () => {
  // The same 17 records with `files` removed - the shape every record written
  // before that field existed has - and then the file absent outright.
  for (const dir of [rereadRoot({ stripFiles: true }), rereadRoot({ noReads: true })]) {
    const out = rereadSeam(dir, ['trace', 'suggest']);
    assert.equal(out.ok, true);
    assert.equal(inDispatchEntry(out), undefined, JSON.stringify(out.suggestions));
    // Never a zero, and never a warning: an absent record is a project that has
    // not run since the hook was installed, not a fault.
    assert.ok(!JSON.stringify(out).includes('0 opens per distinct file'), JSON.stringify(out));
    assert.equal('warnings' in out, false, JSON.stringify(out.warnings));
  }
});

test('seam: an UNREADABLE reads.jsonl fails `reads --join` and WARNS on `trace suggest` - both faces, one test', () => {
  // The whole risk of lifting the parse into one helper is that these two
  // diverge: a permissions error loud on one face and invisible on the other.
  // Neither face had a test before this one.
  const dir = rereadRoot();
  const file = join(dir, 'reads.jsonl');
  chmodSync(file, 0o000);
  try {
    // Running as root defeats the mode bits, so the row would assert nothing.
    try { accessSync(file, constants.R_OK); return; } catch { /* genuinely unreadable */ }
    const reads = rereadSeam(dir, ['reads', '--join']);
    assert.equal(reads.ok, false, JSON.stringify(reads));
    assert.equal(reads.reason, 'read-failed');
    assert.ok(String(reads.detail || '').includes('reads.jsonl'), JSON.stringify(reads));

    const out = rereadSeam(dir, ['trace', 'suggest']);
    assert.equal(out.ok, true, 'trace suggest must still answer about the trace it CAN read');
    assert.equal(inDispatchEntry(out), undefined, JSON.stringify(out.suggestions));
    assert.ok(Array.isArray(out.warnings), `no warnings channel: ${JSON.stringify(out)}`);
    assert.ok(out.warnings.some((w) => String(w).includes('reads.jsonl')),
      `the unreadable file is not named: ${JSON.stringify(out.warnings)}`);
  } finally {
    chmodSync(file, 0o600);
  }
});

test('seam: the rotation marker is DROPPED at the parse and billed to nothing', () => {
  // D-09: `summarizeReads` bills every object it is handed into `calls` and
  // `byAgent`, so an unfiltered marker is a phantom read `/cad-report` prints
  // in its Reading line as a real tool call. The filter lives in
  // `readReadsRecords` - the one parse both readers cross.
  const out = rereadSeam(rereadRoot({ rotated: true }), ['reads']);
  assert.equal(out.ok, true, JSON.stringify(out));
  // The 17 fixture records and not one more. Delete the filter and this is 18.
  assert.equal(out.calls, 17, JSON.stringify(out.byAgent));
  // The marker carries no `agent`, so an unfiltered one bills a SECOND
  // coordinator call on top of the fixture's single `cat` read.
  assert.deepEqual(out.byAgent.find(([a]) => a === 'coordinator'), ['coordinator', 1],
    JSON.stringify(out.byAgent));
  // Nothing anywhere in the figures names the sibling.
  const marker = JSON.stringify({
    byTool: out.byTool, topTargets: out.topTargets, topFiles: out.topFiles,
  });
  assert.equal(marker.includes(ROTATED_READS_FILE), false, marker);
  assert.equal(marker.includes(READS_ROTATION), false, marker);
  // The whole point, stated once: the figures are EXACTLY what they would be if
  // the marker were not on disk. `reads` is the one key that differs, and it is
  // the report OF the cut rather than a figure counting it.
  const { reads: _cut, ...cutFigures } = out;
  const { reads: _whole, ...wholeFigures } = rereadSeam(rereadRoot(), ['reads']);
  assert.deepEqual(cutFigures, wholeFigures);
});

test('seam: BOTH faces name the reads record and report its cut, on a key that is not the trace\'s', () => {
  // One root, two commands, the same shape - the risk of a per-face key is that
  // the two diverge and a reader has to learn which envelope spells it how.
  // The trace here never rotated, so a top-level `rotated` on `trace suggest`
  // could only be the READS record's cut leaking onto the trace's key.
  const dir = rereadRoot({ rotated: true });
  const readsFile = join(dir, 'reads.jsonl');

  const reads = rereadSeam(dir, ['reads', '--join']);
  assert.equal(reads.ok, true, JSON.stringify(reads));
  assert.deepEqual(reads.reads, {
    file: readsFile,
    rotated: { file: ROTATED_READS_FILE, ts: ROTATION_MARKER.ts },
  });
  // The marker reached NEITHER side of the join's own split: `joinReads` pushes
  // `unresolved` for any record with no `agent`, and bills an `agent` of
  // `coordinator` to the main thread. The fixture's one `cat` read is the only
  // real coordinator call.
  assert.equal(reads.unresolved, 0, JSON.stringify(reads));
  assert.equal(reads.coordinator, 1, JSON.stringify(reads));

  const suggest = rereadSeam(dir, ['trace', 'suggest']);
  assert.equal(suggest.ok, true, JSON.stringify(suggest));
  assert.deepEqual(suggest.reads, reads.reads);
  // `file` still names the TRACE, and the trace's own cut key is ABSENT - the
  // two records' rotations are not the same field.
  assert.equal(suggest.file, join(dir, 'trace.jsonl'));
  assert.equal('rotated' in suggest, false, JSON.stringify(suggest));
});

test('seam: a project with no reads record still names the path it looked for', () => {
  const dir = rereadRoot({ noReads: true });
  const out = rereadSeam(dir, ['reads']);
  assert.equal(out.ok, true, JSON.stringify(out));
  assert.equal(out.note, 'no reads recorded yet');
  // Named, with NO rotation on it: the command was asked which record it read,
  // and a record that is not there yet is still a named path.
  assert.deepEqual(out.reads, { file: join(dir, 'reads.jsonl') });
  // The `trace suggest` face agrees about the same absent record.
  assert.deepEqual(rereadSeam(dir, ['trace', 'suggest']).reads, out.reads);
});

// --- R8: the worker's own wall clock, and only when there is one (MSR-05) ----

/** A render whose brackets carry whatever wall clocks a case needs. */
const workerRender = (durations) => ({
  counts: {},
  roles: {},
  events: [],
  brackets: durations.map((d, i) => ({
    role: 'cad-executor', plan: String(i), event: 'return', ms: 900000, tokens: 1000,
    ...(d === null ? {} : { duration_ms: d }),
  })),
});

/** The one entry R8 emits, or null when it stayed silent. */
const workerReceipt = (render) =>
  suggestFromRender(render).find((x) => x.subject === 'workers') || null;

test('R8: the receipt sums the worker clock and COUNTS the dispatches without one', () => {
  // Two brackets reported a wall clock and one did not. The one that did not is
  // counted beside the sum as unrecorded rather than folded in as a zero (D-04):
  // a zero would claim a worker that took no time, which nobody measured.
  const r = workerRender([600000, 300000, null]);
  const out = suggestFromRender(r);
  assert.equal(out.length, 1, `expected exactly one entry: ${JSON.stringify(out)}`);
  const [e] = out;
  assert.equal(e.kind, 'info');
  assert.equal(e.subject, 'workers');
  assert.match(e.evidence, /15 min across 2 dispatch\(es\)/);
  assert.match(e.evidence, /1 more whose close carried none - unrecorded, never counted as zero/);
  // The two clocks are NAMED APART, the way the `TraceRender` typedef names
  // them: a reader handed one figure and no name for it prices a worker with
  // the step's clock.
  assert.match(e.evidence, /WORKER's own run time and not the dispatch-to-close `ms`/);
  // The closed `Suggestion` vocabulary (D-12), which `suggest.md`'s ask step
  // depends on: it builds `/cad-config <key>=<value>` out of `action` plus
  // `proposed`, so an info entry that grew either would offer a key to set.
  assert.deepEqual(Object.keys(e).sort(), ['action', 'evidence', 'kind', 'subject']);
  assert.equal(e.action, null);

  // With every bracket priced there is no unrecorded clause at all.
  const all = workerReceipt(workerRender([60000, 60000]));
  assert.match(all.evidence, /2 min across 2 dispatch\(es\)\./);
  assert.equal(/unrecorded/.test(all.evidence), false, all.evidence);
});

test('R8: a scope where NO bracket carries a wall clock says nothing at all', () => {
  // Not a run that took no worker time - a scope with no figure to denominate a
  // receipt in, which is R6's posture for a render with no coordinator block.
  // Measured 2026-08-26: 6 of 386 live brackets carry a `duration_ms`, so this
  // is the ordinary case and an entry here would say nothing on every run.
  for (const [why, r] of Object.entries({
    'brackets that all reported none': workerRender([null, null]),
    'no brackets at all': workerRender([]),
    'no brackets key on the render': { counts: {}, roles: {}, events: [] },
    'a brackets key that is not an array': { counts: {}, roles: {}, events: [], brackets: 'nope' },
    'rows that are not objects': { counts: {}, roles: {}, events: [], brackets: [null, 42] },
    'a non-numeric wall clock': {
      counts: {}, roles: {}, events: [], brackets: [{ duration_ms: '1m 23s' }],
    },
  })) {
    assert.equal(workerReceipt(/** @type {any} */ (r)), null, why);
  }
});
