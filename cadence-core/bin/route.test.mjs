// Zero-dep tests for route.mjs. Run: node --test 'cadence-core/bin/*.test.mjs'
// Uses only node: builtins (no framework), matching the repo's zero-dep ethos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync, mkdirSync, chmodSync, readFileSync, existsSync,
  symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rungFile } from './lib/rung-agent.mjs';
import { renderCursor } from './lib/planning-files.mjs';

const ROUTE = join(dirname(fileURLToPath(import.meta.url)), 'route.mjs');
const dir = mkdtempSync(join(tmpdir(), 'cad-route-'));

// A global-config path that does not exist, so tests are hermetic by default
// (never read the dev's real ~/.claude/cadence/config.json).
const NO_GLOBAL = join(dir, 'no-global.json');

// Write a config in the shape route.mjs now reads and return its path: bare
// top-level `stakes`, everything else under `model`. A counter guarantees
// uniqueness - deriving names from the config's content collided when two
// distinct configs shared a length/value.
let cfgN = 0;
function cfg(keys, name) {
  const p = join(dir, name || `c-${++cfgN}.json`);
  const { stakes, ...model } = keys || {};
  const body = {};
  if (stakes !== undefined) body.stakes = stakes;
  if (Object.keys(model).length) body.model = model;
  writeFileSync(p, JSON.stringify(body));
  return p;
}

// A config written verbatim, for fixtures whose whole point is a shape the
// helper above deliberately cannot express (a key v2.0.0 retired).
function rawCfg(body, name) {
  const p = join(dir, name || `raw-${++cfgN}.json`);
  writeFileSync(p, JSON.stringify(body));
  return p;
}

// resolve() defaults to an isolated (missing) global layer; pass opts.global to
// point CADENCE_GLOBAL_CONFIG at a real global file for merge tests,
// opts.table to inject a route table through CADENCE_ROUTE_TABLE, and
// opts.schema to inject a config schema through CADENCE_CONFIG_SCHEMA. Both
// injections are gated: route.mjs reads either variable only when
// CADENCE_TEST_SEAM is exactly `1`, so every fixture that sets a path sets the
// sentinel beside it (lib/test-seam.mjs).
function resolve(role, file, extra = [], opts = {}) {
  const args = ['resolve', '--role', role, ...(file ? ['--file', file] : []), ...extra];
  const env = { ...process.env, CADENCE_GLOBAL_CONFIG: opts.global || NO_GLOBAL };
  if (opts.table) { env.CADENCE_ROUTE_TABLE = opts.table; env.CADENCE_TEST_SEAM = '1'; }
  if (opts.schema) { env.CADENCE_CONFIG_SCHEMA = opts.schema; env.CADENCE_TEST_SEAM = '1'; }
  try {
    return JSON.parse(execFileSync('node', [ROUTE, ...args], { encoding: 'utf8', env }));
  } catch (e) {
    // Degraded results exit 1 (seam convention); the JSON line is on stdout.
    return JSON.parse(e.stdout);
  }
}

/** The shipped config schema, parsed fresh so a mutation stays local. */
const shippedSchema = () => JSON.parse(
  readFileSync(join(dirname(ROUTE), '..', 'config.schema.json'), 'utf8'));

/** A mutated schema on disk, for the injection door above. */
function writeSchema(schema, name) {
  const path = join(dir, name);
  writeFileSync(path, JSON.stringify(schema));
  return path;
}

test('a resolve returns the whole bundle off one cell, and no tier', () => {
  // The full-shape row: every field of the contract in one place. The 18 cells
  // themselves are pinned one test case per cell below.
  const planner = resolve('cad-planner', cfg({ stakes: 'solo' }));
  assert.equal(planner.ok, true);
  assert.equal(planner.model, 'sonnet');       // the solo/cad-planner cell
  assert.equal(planner.effort, 'high');        // ...its starting rung
  assert.equal(planner.agent, 'cad-planner');  // ...and that rung's file
  assert.equal(planner.stakes, 'solo');
  assert.equal(planner.escalated, false);      // a clean run never escalates
  assert.equal(planner.verify, 'off');
  assert.equal(planner.review.plan, 'advisory');
  // `tier` is gone: the model comes from the role's own cell, not from a
  // column named after something else (D-03).
  assert.equal('tier' in planner, false);
  // ...and the envelope SAYS the cell is where it came from, always present so
  // a caller never has to infer it from `pinned` plus an absence.
  assert.equal(planner.model_source, 'cell');
});

// --- the 18 cells, pinned literally (D-11) -----------------------------------

// HAND-WRITTEN DATA, typed out from .planning/phases/3/CONTEXT.md's grid. It is
// never read, derived or spread from cadence-core/route-table.json: that file is
// the subject under test, and a fixture that derives its expectations from its
// subject cannot fail. Phase 2's SUMMARY records two mutation-proved losses of
// exactly this shape (config.test.mjs:41, route.test.mjs:208).
const CELLS = [
  { stakes: 'solo', role: 'cad-planner', model: 'sonnet', effort: 'high', retry: 'xhigh', agent: 'cad-planner', retryAgent: 'cad-planner-xhigh' },
  { stakes: 'solo', role: 'cad-assumptions-analyzer', model: 'sonnet', effort: 'high', retry: 'xhigh', agent: 'cad-assumptions-analyzer-high', retryAgent: 'cad-assumptions-analyzer' },
  { stakes: 'solo', role: 'cad-verifier', model: 'sonnet', effort: 'high', retry: 'xhigh', agent: 'cad-verifier', retryAgent: 'cad-verifier-xhigh' },
  { stakes: 'solo', role: 'cad-reviewer', model: 'sonnet', effort: 'medium', retry: 'high', agent: 'cad-reviewer-medium', retryAgent: 'cad-reviewer' },
  { stakes: 'solo', role: 'cad-executor', model: 'sonnet', effort: 'high', retry: 'xhigh', agent: 'cad-executor', retryAgent: 'cad-executor-xhigh' },
  { stakes: 'solo', role: 'cad-plan-checker', model: 'sonnet', effort: 'low', retry: 'high', agent: 'cad-plan-checker', retryAgent: 'cad-plan-checker-high' },

  { stakes: 'shipped', role: 'cad-planner', model: 'opus', effort: 'high', retry: 'xhigh', agent: 'cad-planner', retryAgent: 'cad-planner-xhigh' },
  { stakes: 'shipped', role: 'cad-assumptions-analyzer', model: 'opus', effort: 'high', retry: 'xhigh', agent: 'cad-assumptions-analyzer-high', retryAgent: 'cad-assumptions-analyzer' },
  { stakes: 'shipped', role: 'cad-verifier', model: 'opus', effort: 'medium', retry: 'high', agent: 'cad-verifier-medium', retryAgent: 'cad-verifier' },
  { stakes: 'shipped', role: 'cad-reviewer', model: 'opus', effort: 'high', retry: 'xhigh', agent: 'cad-reviewer', retryAgent: 'cad-reviewer-xhigh' },
  { stakes: 'shipped', role: 'cad-executor', model: 'opus', effort: 'high', retry: 'xhigh', agent: 'cad-executor', retryAgent: 'cad-executor-xhigh' },
  { stakes: 'shipped', role: 'cad-plan-checker', model: 'sonnet', effort: 'medium', retry: 'high', agent: 'cad-plan-checker-medium', retryAgent: 'cad-plan-checker-high' },

  { stakes: 'critical', role: 'cad-planner', model: 'opus', effort: 'xhigh', retry: 'max', agent: 'cad-planner-xhigh', retryAgent: 'cad-planner-max' },
  { stakes: 'critical', role: 'cad-assumptions-analyzer', model: 'opus', effort: 'xhigh', retry: 'xhigh', agent: 'cad-assumptions-analyzer', retryAgent: 'cad-assumptions-analyzer' },
  { stakes: 'critical', role: 'cad-verifier', model: 'opus', effort: 'xhigh', retry: 'max', agent: 'cad-verifier-xhigh', retryAgent: 'cad-verifier-max' },
  { stakes: 'critical', role: 'cad-reviewer', model: 'opus', effort: 'xhigh', retry: 'max', agent: 'cad-reviewer-xhigh', retryAgent: 'cad-reviewer-max' },
  { stakes: 'critical', role: 'cad-executor', model: 'opus', effort: 'xhigh', retry: 'xhigh', agent: 'cad-executor-xhigh', retryAgent: 'cad-executor-xhigh' },
  { stakes: 'critical', role: 'cad-plan-checker', model: 'opus', effort: 'xhigh', retry: 'xhigh', agent: 'cad-plan-checker-xhigh', retryAgent: 'cad-plan-checker-xhigh' },
];

// ONE test case per cell, never one case walking all 18: node:test aborts a
// case at its first throwing assertion, so a single case would report one
// failure and skip every later row - and the per-cell discrimination this
// section exists to guarantee would go unproven.
for (const c of CELLS) {
  test(`cell ${c.stakes}/${c.role}`, () => {
    // escalate_on_failure defaults false now; the retry half of every cell is
    // still pinned here, so the fixture turns the mechanism on explicitly.
    const file = cfg({ stakes: c.stakes, escalate_on_failure: true }, `cell-${c.stakes}.json`);
    const first = resolve(c.role, file);
    assert.equal(first.ok, true);
    assert.equal(first.model, c.model, 'model');
    assert.equal(first.effort, c.effort, 'effort');
    assert.equal(first.agent, c.agent, 'agent');

    const retry = resolve(c.role, file, ['--attempt', '2']);
    assert.equal(retry.ok, true);
    assert.equal(retry.effort, c.retry, 'retry effort');
    assert.equal(retry.agent, c.retryAgent, 'retry agent');
    assert.equal(retry.model, c.model, 'the rung climbs, the model holds');
  });
}

// --- the stakes-only fallback, per cell (ROL-01, D-08) -----------------------
//
// The roles block answers where a layer set it; where it is ABSENT every one of
// the eighteen cells must resolve exactly what it resolved before the block
// existed. Held against the same hand-written CELLS rows above and never
// against cadence-core/route-table.json, for the reason stated at :81-85.
//
// The no-roles assertion is on the FIXTURE FILE's own parsed contents, not on
// the helper's intent: a roles block that happened to agree with the cell would
// satisfy every other assertion here and prove nothing about the fallback.
//
// ONE case per cell for the reason the loop above states: node:test aborts a
// case at its first throwing assertion, so a single case walking all eighteen
// would report one failure and skip every later row.
for (const c of CELLS) {
  test(`stakes-only fallback ${c.stakes}/${c.role}`, () => {
    const file = cfg({ stakes: c.stakes }, `fallback-${c.stakes}.json`);
    const written = JSON.parse(readFileSync(file, 'utf8'));
    assert.equal('roles' in written, false, 'the fallback fixture must carry no roles block');

    const r = resolve(c.role, file);
    assert.equal(r.ok, true);
    assert.equal(r.model, c.model, 'model');
    assert.equal(r.effort, c.effort, 'effort');
    assert.equal(r.agent, c.agent, 'agent');
    assert.equal(r.model_source, 'cell', 'the cell decided, and nothing else did');
  });
}

test('the three held retries say the rung was held, not that it escalated', () => {
  // A (stakes, role) pair list, not one config: the held cells all sit at
  // critical, where xhigh START rungs leave the retry nothing to climb to.
  // (shipped/cad-reviewer left this list when its start dropped to high -
  // an every-fire reviewer starting at the top rung was the cost, not the
  // safety.)
  const held = [
    ['critical', 'cad-assumptions-analyzer'],
    ['critical', 'cad-executor'],
    ['critical', 'cad-plan-checker'],
  ];
  for (const [stakes, role] of held) {
    const file = cfg({ stakes, escalate_on_failure: true }, `cell-${stakes}.json`);
    const r = resolve(role, file, ['--attempt', '2']);
    assert.equal(r.escalated, false, `${stakes}/${role}`);
    assert.match(r.reason.join(' '), /rung held at xhigh/, `${stakes}/${role}`);
  }
});

test('no cell at any level holds fable or haiku - the routed vocabulary is sonnet and opus', () => {
  // Walked over the shipped table rather than the literal rows above: this row
  // is about what the DATA can reach, and CELLS is what it should reach (D-12).
  const env = { ...process.env, CADENCE_GLOBAL_CONFIG: NO_GLOBAL };
  const t = JSON.parse(execFileSync('node', [ROUTE, 'table'], { encoding: 'utf8', env })).table;
  const routed = Object.values(t.cells).flatMap((row) => Object.values(row).map((c) => c.model));
  assert.equal(routed.includes('fable'), false);
  assert.equal(routed.includes('haiku'), false);
  assert.deepEqual([...new Set(routed)].sort(), ['opus', 'sonnet']);
  // ...and both stay reachable by an explicit pin, which is a user assertion
  // about their own org rather than a rung on this ladder.
  for (const alias of ['opus', 'sonnet', 'haiku', 'fable']) {
    assert.ok(t.model_aliases.includes(alias), alias);
  }
});

test('a pin replaces the cell model at every level and never touches its effort', () => {
  for (const c of CELLS.filter((x) => x.role === 'cad-executor')) {
    const file = rawCfg({ stakes: c.stakes, model: { overrides: { 'cad-executor': 'fable' } } },
      `pin-exec-${c.stakes}.json`);
    const r = resolve('cad-executor', file);
    assert.equal(r.model, 'fable', c.stakes);
    assert.equal(r.pinned, true, c.stakes);
    assert.equal(r.effort, c.effort, `${c.stakes} effort`); // frontmatter, untouched
    assert.equal(r.agent, c.agent, `${c.stakes} agent`);
  }
});

// --- the review map and the verify switch, both off the schema (D-01) -------

test('the review map is the schema defaults, and the level moves none of them', () => {
  // Literal expectations, never derived from config.schema.json: a fixture that
  // reads its own subject cannot fail (D-11). The grids that keyed on the level
  // are gone - these four values are what every level answers now.
  const want = { plan: 'advisory', diff: 'off', risk_surface: 'blocking', phase_diff: 'off' };
  for (const stakes of ['solo', 'shipped', 'critical']) {
    assert.deepEqual(resolve('cad-planner', cfg({ stakes })).review, want, stakes);
  }
});

test('verify is off wherever no floor raised, at every level', () => {
  // The deep pass is what a raised floor turns on and the only thing that does.
  // With no phase in hand there is no floor at all, so it is off however high
  // the configured level is - the state a project that had "always on" through
  // `stakes: shipped` now reaches through `--deep` or a risk hit alone.
  for (const stakes of ['solo', 'shipped', 'critical']) {
    assert.equal(resolve('cad-planner', cfg({ stakes })).verify, 'off', stakes);
  }
});

test('risk_surface is blocking with nothing configured - a match is never waved through', () => {
  for (const stakes of ['solo', 'shipped', 'critical']) {
    assert.equal(resolve('cad-planner', cfg({ stakes })).review.risk_surface, 'blocking', stakes);
  }
});

test('a config gate that AGREES with the schema default is taken silently', () => {
  const c = rawCfg({ stakes: 'shipped', review: { triggers: { phase_diff: { gate: 'off' } } } },
    'gate-agrees.json');
  const r = resolve('cad-planner', c);
  assert.equal(r.review.phase_diff, 'off');
  assert.equal(r.warnings, undefined); // agreement is not news
});

test('a config gate that DISAGREES wins, and the reason names both values (D-04)', () => {
  // The `diff` gate defaults to `off`; the user asked for blocking. The key the
  // user set decides - a resolved-then-dropped gate is the defect class this
  // milestone closes - and which source answered is spoken, not swallowed.
  //
  // A `reason` and not a `warning`: a schema default is not a second authority
  // a user needs telling they overrode, it is what every other defaulted key
  // does. The warning existed because a level-keyed grid was the other side of
  // the disagreement, and that grid is gone.
  const c = rawCfg({ stakes: 'solo', review: { triggers: { diff: { gate: 'blocking' } } } },
    'gate-disagrees.json');
  const r = resolve('cad-planner', c);
  assert.equal(r.review.diff, 'blocking');
  assert.equal(r.warnings, undefined, JSON.stringify(r.warnings));
  const said = r.reason.find((x) => x.startsWith('review.triggers.diff.gate='));
  assert.ok(said, JSON.stringify(r.reason));
  assert.match(said, /"blocking"/);   // the config value
  assert.match(said, /"off"/);        // ...and the default it beat
  // every other trigger still answers its own default
  assert.equal(r.review.plan, 'advisory');
  assert.equal(r.review.risk_surface, 'blocking');
});

test('an unset gate says the schema default answered it', () => {
  // The other half of "reason says which": a bundle a reader cannot trace back
  // to a source is the thing this vocabulary exists to prevent.
  const r = resolve('cad-planner', cfg({ stakes: 'shipped' }));
  assert.ok(r.reason.some((x) => x === 'review.triggers.plan.gate: schema default "advisory"'),
    JSON.stringify(r.reason));
});

// --- the reviewer set beside the gate map (RVW-02) ---------------------------

test('no configured reviewers resolves every trigger to claude-subagent, silently', () => {
  // The shipped default: `review.reviewers` unset, so DEFAULTS backstops it and
  // the always-available subagent is the whole set. Nothing was dropped, so
  // there is nothing to warn about.
  const r = resolve('cad-reviewer', cfg({ stakes: 'shipped' }));
  assert.deepEqual(r.reviewers, {
    plan: ['claude-subagent'], diff: ['claude-subagent'],
    risk_surface: ['claude-subagent'], phase_diff: ['claude-subagent'],
  });
  assert.equal(r.warnings, undefined);
});

test('a provider with no model id at the trigger\'s tier falls back, naming both', () => {
  // `review.reviewers: ["openai"]` with no `review.providers.openai.tiers.*`
  // set: the provider cannot be dispatched to, so the fire would go to a
  // subagent - the 2026-08-13 substitution. The fallback and its CAUSE are in
  // the return rather than inferred from a set the caller never sees resolved.
  const c = rawCfg({ stakes: 'shipped', review: { reviewers: ['openai'] } },
    'reviewers-unavailable.json');
  const r = resolve('cad-reviewer', c);
  assert.deepEqual(r.reviewers, {
    plan: ['claude-subagent'], diff: ['claude-subagent'],
    risk_surface: ['claude-subagent'], phase_diff: ['claude-subagent'],
  });
  const plan = r.warnings.find((w) => w.startsWith('plan:'));
  assert.ok(plan, JSON.stringify(r.warnings));
  assert.match(plan, /openai/);                               // the provider dropped
  assert.match(plan, /"cheap"/);                              // ...the tier it needed
  assert.match(plan, /review\.providers\.openai\.tiers\.cheap/); // ...the key that answers it
  assert.match(plan, /claude-subagent/);                      // ...and the fallback
  // ...and WHERE the tier came from, which is now the key's own schema default
  // rather than a row of a grid keyed on a level.
  assert.match(plan, /review\.triggers\.plan\.tier's schema default/);
});

test('a provider WITH a model id at that tier is the resolved reviewer', () => {
  // Every trigger defaults to `cheap`, so that is the tier this provider has to
  // be configured at to be placed at all.
  const c = rawCfg({
    stakes: 'shipped',
    review: { reviewers: ['openai'], providers: { openai: { tiers: { cheap: 'gpt-5-mini' } } } },
  }, 'reviewers-available.json');
  const r = resolve('cad-reviewer', c);
  assert.deepEqual(r.reviewers.plan, ['openai']);
  assert.deepEqual(r.reviewers.risk_surface, ['openai']);
  assert.deepEqual(r.reviewers.diff, ['openai']);
  // The PAIRED NEGATIVE, or the row above passes on a resolver that never reads
  // the tier: the same provider configured at a tier nothing resolves at is not
  // placed anywhere.
  const wrong = rawCfg({
    stakes: 'shipped',
    review: { reviewers: ['openai'], providers: { openai: { tiers: { flagship: 'gpt-5' } } } },
  }, 'reviewers-wrong-tier.json');
  assert.deepEqual(resolve('cad-reviewer', wrong).reviewers.plan, ['claude-subagent']);
});

test('a config-set tier wins over the schema default for the availability test (D-04)', () => {
  // The tier a LAYER set is a user assertion and the schema default is the
  // fallback, so a trigger the layer moved is placed where the layer says and
  // every other trigger still answers the default.
  const c = rawCfg({
    stakes: 'shipped',
    review: {
      reviewers: ['openai'],
      providers: { openai: { tiers: { flagship: 'gpt-5' } } },
      triggers: { plan: { tier: 'flagship' } },
    },
  }, 'reviewers-tier-set.json');
  const r = resolve('cad-reviewer', c);
  assert.deepEqual(r.reviewers.plan, ['openai']);
  assert.deepEqual(r.reviewers.phase_diff, ['claude-subagent']); // still cheap, unassigned
  assert.match(r.warnings.find((w) => w.startsWith('phase_diff:')), /schema default/);
});

test('one available reviewer beside one unavailable keeps the set and names the drop', () => {
  const c = rawCfg({
    stakes: 'shipped',
    review: {
      reviewers: ['claude-subagent', 'gemini'],
      providers: { openai: { tiers: { flagship: 'gpt-5' } } },
    },
  }, 'reviewers-partial.json');
  const r = resolve('cad-reviewer', c);
  assert.deepEqual(r.reviewers.plan, ['claude-subagent']);
  const plan = r.warnings.find((w) => w.startsWith('plan:'));
  assert.match(plan, /gemini/);
  assert.match(plan, /leaving \[claude-subagent\]/);
});

test('the reviewer set is its own field - `review` gains, loses and reorders nothing', () => {
  // D-05: folding reviewers into `review` turns each gate STRING into an
  // object and breaks every reader of the wiring table at once.
  const c = rawCfg({ stakes: 'critical', review: { reviewers: ['openai'] } },
    'reviewers-beside.json');
  const r = resolve('cad-reviewer', c);
  assert.deepEqual(r.review, {
    plan: 'advisory', diff: 'off', risk_surface: 'blocking', phase_diff: 'off',
  });
  assert.deepEqual(Object.keys(r.review), Object.keys(r.reviewers));
});

// --- the risk_surface scope beside the gate map (CST-02) ---------------------

const ALL_SURFACES = ['auth', 'migrations', 'billing', 'concurrency', 'destructive',
  'secrets', 'api_contract', 'untrusted_input'];

test('the key absent from both layers resolves all eight, marked unanswered', () => {
  // D-12: absence means EVERYTHING and is a distinguishable state. Failing the
  // other way would narrow the only blocking review trigger on evidence nobody
  // supplied - and there would then be no state the one-time ask can detect.
  const r = resolve('cad-reviewer', cfg({ stakes: 'shipped' }));
  assert.deepEqual(r.surfaces, ALL_SURFACES);
  assert.equal(r.surfaces_answered, false);
  assert.equal(r.warnings, undefined);
});

test('a repo layer setting two categories resolves exactly those two, marked answered', () => {
  const c = rawCfg({ stakes: 'shipped',
    review: { triggers: { risk_surface: { surfaces: ['secrets', 'destructive'] } } } },
  'surfaces-two.json');
  const r = resolve('cad-reviewer', c);
  assert.deepEqual(r.surfaces, ['secrets', 'destructive']);
  assert.equal(r.surfaces_answered, true);
  assert.equal(r.warnings, undefined);
});

test('an entry outside the vocabulary fails SAFE and is NAMED, never narrowed to the valid subset', () => {
  // `nope` is a typo, not a decision to stop reviewing everything it isn't.
  // Accepting the valid subset would mark the question answered forever while
  // silently shrinking the only blocking gate - and the sibling test below
  // already fails safe on a scalar, so narrowing here gave one malformation
  // class two different answers.
  const c = rawCfg({ stakes: 'shipped',
    review: { triggers: { risk_surface: { surfaces: ['secrets', 'nope'] } } } },
  'surfaces-bad-entry.json');
  const r = resolve('cad-reviewer', c);
  assert.deepEqual(r.surfaces, ALL_SURFACES, 'narrowed to the valid subset');
  assert.equal(r.surfaces_answered, false, 'a typo marked the question answered');
  const w = r.warnings.find((x) => x.includes('surfaces'));
  assert.ok(w, JSON.stringify(r.warnings));
  assert.match(w, /"nope"/);
  assert.match(w, /untrusted_input/); // the accepted set, named
  assert.ok(r.warnings.some((x) => /all 8 stand/.test(x)), JSON.stringify(r.warnings));
});

test('a non-list value contributes nothing and all eight stand', () => {
  const c = rawCfg({ stakes: 'shipped',
    review: { triggers: { risk_surface: { surfaces: 'secrets' } } } },
  'surfaces-scalar.json');
  const r = resolve('cad-reviewer', c);
  assert.deepEqual(r.surfaces, ALL_SURFACES);
  assert.equal(r.surfaces_answered, false);
  assert.match(r.warnings.find((x) => x.includes('surfaces')), /is not a list/);
});

test('a list that resolves to no category reads as UNANSWERED, not as an empty scope', () => {
  // An empty scope would turn the one blocking trigger off entirely while every
  // document says it is blocking - the control-that-reports-success shape this
  // milestone is named after.
  const c = rawCfg({ stakes: 'shipped',
    review: { triggers: { risk_surface: { surfaces: [] } } } },
  'surfaces-empty.json');
  const r = resolve('cad-reviewer', c);
  assert.deepEqual(r.surfaces, ALL_SURFACES);
  assert.equal(r.surfaces_answered, false);
  assert.match(r.warnings.find((x) => x.includes('surfaces')), /unanswered/);
});

test('the surface set is its own field - `review` and `reviewers` gain nothing', () => {
  const c = rawCfg({ stakes: 'critical',
    review: { triggers: { risk_surface: { surfaces: ['secrets'] } } } },
  'surfaces-beside.json');
  const r = resolve('cad-reviewer', c);
  assert.deepEqual(r.review, {
    plan: 'advisory', diff: 'off', risk_surface: 'blocking', phase_diff: 'off',
  });
  assert.deepEqual(Object.keys(r.review), Object.keys(r.reviewers));
  assert.deepEqual(r.surfaces, ['secrets']);
});

test('a level with no CELL for the role degrades to unresolved', () => {
  // The `review` and `verify` grids no longer key on the level - the schema
  // answers both - so `cells` is the one grid a torn level is still fatal in.
  // A torn table must not emit half a bundle: two of the four knobs read as a
  // whole answer is worse than no answer.
  const t = JSON.parse(JSON.stringify(SHIPPED_TABLE));
  delete t.cells.shipped;
  const p = join(dir, 'torn-cells.json');
  writeFileSync(p, JSON.stringify(t));
  const r = resolve('cad-planner', cfg({ stakes: 'shipped' }), [], { table: p });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'unresolved');
});

// --- escalation, now unconditional -------------------------------------------

test('the shipped DEFAULT holds a retry - escalation is opt-in, and the hold is diagnosable', () => {
  // Reversed from the axis change that made escalation unconditional: both
  // retries a measured /cad-plan run paid for were NARROWER jobs than the pass
  // they followed (a minimal-edit revision, a diff-only re-check), so climbing
  // by default bought cost, not quality. With no config file and no global
  // layer, a second attempt now holds its rung and says which key holds it.
  const missing = join(dir, 'no-config-at-all.json');
  const first = resolve('cad-plan-checker', missing);
  assert.equal(first.escalated, false);            // a clean run never escalates
  assert.equal(first.agent, 'cad-plan-checker-medium');
  assert.equal(first.stakes, 'shipped');

  const retry = resolve('cad-plan-checker', missing, ['--attempt', '2']);
  assert.equal(retry.ok, true);
  assert.equal(retry.agent, 'cad-plan-checker-medium'); // held, not climbed
  assert.equal(retry.effort, 'medium');
  assert.equal(retry.escalated, false);
  assert.equal(retry.stakes, 'shipped');
  assert.match(retry.reason.join(' '), /model\.escalate_on_failure/);
});

test('escalation fires at every stakes level, not just the default', () => {
  // cad-planner, not cad-plan-checker: the retune makes critical/cad-plan-checker
  // a HELD cell, so the checker can no longer carry a per-level proof of the
  // escalation claim. The planner climbs at all three levels, which is the claim
  // this row exists for - flipping the critical assertion to `false` instead
  // would have kept the row green while it stopped proving anything.
  const expected = { solo: 'cad-planner-xhigh', shipped: 'cad-planner-xhigh', critical: 'cad-planner-max' };
  for (const [stakes, agent] of Object.entries(expected)) {
    const r = resolve('cad-planner', cfg({ stakes, escalate_on_failure: true }), ['--attempt', '2']);
    assert.equal(r.agent, agent, stakes);
    assert.equal(r.escalated, true, stakes);
  }
});

test('model.escalate_on_failure: false holds the rung and names the key in reason', () => {
  const off = cfg({ escalate_on_failure: false });
  const r = resolve('cad-plan-checker', off, ['--attempt', '3']);
  assert.equal(r.escalated, false);
  assert.equal(r.agent, 'cad-plan-checker-medium'); // the shipped cell's starting rung
  assert.equal(r.effort, 'medium');
  assert.match(r.reason.join(' '), /model\.escalate_on_failure/); // a held retry is diagnosable
});

// --- the retired key, spoken rather than silently ignored ---------------------

test('a config still holding model.profile warns and never reports a configured layer', () => {
  const stale = rawCfg({ model: { profile: 'balanced' } }, 'stale-profile.json');
  const r = resolve('cad-planner', stale);
  assert.equal(r.ok, true);                       // never blocks the spine
  assert.equal(r.stakes, 'shipped');              // resolved at the default
  assert.equal(r.warnings.length, 1);
  assert.match(r.warnings[0], /model\.profile/);  // names the key the user wrote
  assert.match(r.warnings[0], /stakes/);          // ...and the one that replaced it
  // the reason must not claim a layer supplied a value no layer carried
  assert.doesNotMatch(r.reason[0], /config:/);
  assert.match(r.reason[0], /stakes default "shipped"/);
});

test('a stakes value that IS set still reports its layer', () => {
  const r = resolve('cad-planner', cfg({ stakes: 'critical' }));
  assert.match(r.reason[0], /config:repo/);
});

test('bad enum string in config degrades to unresolved, never crashes', () => {
  const r = resolve('cad-planner', cfg({ stakes: 'ludicrous' }));
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'unresolved');
  assert.equal(r.stakes, 'ludicrous'); // names the value that failed to resolve
});

test('resolve: a non-integer --attempt is usage, not silently coerced (#45.2)', () => {
  const r = resolve('cad-planner', cfg({ stakes: 'solo' }), ['--attempt', 'abc']);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'usage');

  const ok = resolve('cad-planner', cfg({ stakes: 'solo' }), ['--attempt', '2']);
  assert.equal(ok.ok, true);
  assert.equal(ok.attempt, 2);
});

test('resolve: a valueless --file is usage, not reason:"internal" (both spellings)', () => {
  // The sibling of config.mjs's own guard, which phase 1 fixed on that seam
  // alone: `o.file` reaches dirname() on the way to the layer read, so an
  // undefined value escaped as reason:"internal" with a raw Node type error.
  // Unquoted `--file $VAR` drops the token, quoted `"$VAR"` passes an empty one.
  for (const extra of [['--file'], ['--file', '']]) {
    const r = resolve('cad-planner', null, extra);
    assert.equal(r.ok, false, extra.join(' '));
    assert.equal(r.reason, 'usage', `${extra.join(' ')}: ${JSON.stringify(r)}`);
    assert.match(r.detail, /--file/, extra.join(' '));
    assert.doesNotMatch(r.detail, /undefined/, extra.join(' '));
  }
  // The control: a real path still resolves, so the guard refuses only the gap.
  assert.equal(resolve('cad-planner', cfg({ stakes: 'solo' })).ok, true);
});

test('usage degradation: missing --role and unknown subcommand', () => {
  const env = { ...process.env, CADENCE_GLOBAL_CONFIG: NO_GLOBAL };
  const bare = (args) => {
    try { return JSON.parse(execFileSync('node', [ROUTE, ...args], { encoding: 'utf8', env })); }
    catch (e) { return JSON.parse(e.stdout); }
  };
  assert.equal(bare(['resolve']).reason, 'usage');
  assert.equal(bare(['nonsense']).reason, 'usage');
  // The whole SYNOPSIS, because with no role there is no call to describe and
  // the refusal is the help. A role present-but-valueless gets the specific
  // sentence instead, pinned in the row below.
  assert.match(bare(['resolve']).detail, /\[--bracket-read <csv>/);
});

test('ARG-06: a flag-shaped value is refused BY NAME, never swallowed as the value', () => {
  // The defect the declared rows in lib/arg-contract.mjs end. `parseArgs` read
  // a value as `a[++i]` with no flag-shape test, so a valueless flag ate the
  // flag after it: measured 2026-08-19, `resolve --role --attempt 2` returned
  // `{"ok":false,"reason":"unknown-role","role":"--attempt"}` - a refusal about
  // a role the caller never named, with the attempt silently reverted to 1.
  // That is the shape lib/seam-input.mjs's `flagValue` was written against, and
  // the row is the whole rule now: missing, empty and flag-shaped are one
  // refusal, naming the flag whose value went missing.
  const env = { ...process.env, CADENCE_GLOBAL_CONFIG: NO_GLOBAL };
  const raw = (args) => {
    try { return JSON.parse(execFileSync('node', [ROUTE, ...args], { encoding: 'utf8', env })); }
    catch (e) { return JSON.parse(e.stdout); }
  };
  /** @type {[string[], string][]} the call, and the flag its refusal must name */
  const cases = [
    [['resolve', '--role', '--attempt', '2'], '--role'],
    [['resolve', '--role', ''], '--role'],
    [['resolve', '--file', '--role', 'cad-planner'], '--file'],
    [['resolve', '--role', 'cad-planner', '--attempt', '--file', 'x.json'], '--attempt'],
    [['resolve', '--role', 'cad-planner', '--bracket-read', '--bracket-plan', 'p'], '--bracket-read'],
    [['resolve', '--role', 'cad-planner', '--bracket-plan'], '--bracket-plan'],
  ];
  for (const [args, flag] of cases) {
    const where = args.join(' ');
    const r = raw(args);
    assert.equal(r.ok, false, where);
    // route.mjs's OWN vocabulary, never a code the contract minted (D-07), and
    // never a domain refusal about a value the caller never wrote.
    assert.equal(r.reason, 'usage', `${where}: ${JSON.stringify(r)}`);
    assert.match(r.detail, new RegExp(flag), where);
    // An ARGUMENT-SHAPE refusal fails before any config file is named, so there
    // is no layer whose diagnostics could ride along.
    assert.equal('warnings' in r, false, where);
  }
  // The control: every one of those flags spelled with a real value still
  // resolves, so the rows refuse the gap and nothing else.
  const good = resolve('cad-planner', cfg({ stakes: 'solo' }), ['--attempt', '2']);
  assert.equal(good.ok, true, JSON.stringify(good));
  assert.equal(good.attempt, 2);
});

test('table dumps the routing table - the five grids and the declared roles', () => {
  const env = { ...process.env, CADENCE_GLOBAL_CONFIG: NO_GLOBAL };
  const r = JSON.parse(execFileSync('node', [ROUTE, 'table'], { encoding: 'utf8', env }));
  assert.equal(r.ok, true);
  assert.ok(Array.isArray(r.table.roles), 'roles is the declared ARRAY');
  assert.ok(r.table.roles.includes('cad-planner'));
  assert.ok(r.table.cells.shipped['cad-planner']);
  assert.ok(r.table.review.shipped.plan);
  assert.equal(r.table.verify.shipped, 'on');
  // The whole top-level key set, pinned: the retired blocks are GONE, not
  // merely unread, and a new one cannot appear without a reader.
  assert.ok(r.table.tiers.shipped.plan);
  assert.ok(r.table.efforts.shipped.plan);
  assert.deepEqual(Object.keys(r.table).sort(),
    ['_meta', 'cells', 'effort_names', 'efforts', 'gates', 'model_aliases', 'review',
      'risk_surface_categories', 'roles', 'rung_order', 'stakes_order', 'tier_names',
      'tiers', 'verify']);
});

// WATCHED FAILING AT 478b1ff, the tip of RVW-03's unpatched tree. Observed
// there: `resolve` carried no `reviewer_tiers` and no `reviewer_efforts` at all,
// so the two fields that reach a cross-model provider call were read at the fire
// site from a config key no layer sets.
//
// The pair used to key on the stakes LEVEL and no longer does: the twelve
// `review.triggers.<t>.{tier,effort}` rows carry real schema defaults, and a
// level moves none of them. HAND-WRITTEN DATA, typed out from this phase's
// CONTEXT.md, never read or derived from cadence-core/config.schema.json - that
// file is the subject under test.
const PANEL = {
  plan: ['cheap', 'low'],
  diff: ['cheap', 'minimal'],
  risk_surface: ['cheap', 'low'],
  phase_diff: ['cheap', 'low'],
};

// ONE case per trigger, never one case walking all four: node:test aborts a case
// at its first throwing assertion, so a single case would report one failure and
// skip the triggers below it.
for (const [trigger, [tier, effort]] of Object.entries(PANEL)) {
  test(`the cross-model panel for ${trigger}: both halves ride the envelope`, () => {
    const r = resolve('cad-reviewer', cfg({ stakes: 'shipped' }, 'panel-shipped.json'));
    assert.equal(r.ok, true);
    assert.equal(r.reviewer_tiers[trigger], tier, `${trigger} tier`);
    assert.equal(r.reviewer_efforts[trigger], effort, `${trigger} effort`);
    // Beside `reviewers`, keyed the same way, and never folded into `review`
    // (D-05) - whose values stay gate strings.
    assert.deepEqual(Object.keys(r.reviewer_tiers), Object.keys(r.reviewers));
    assert.deepEqual(Object.keys(r.reviewer_efforts), Object.keys(r.reviewers));
    assert.equal(typeof r.review[trigger], 'string');
  });
}

test('the panel does not move with the level - the grids that keyed on it are gone', () => {
  // The inverse of the assertion this section used to make. Three levels, one
  // answer: raising `stakes` moves no reviewer tier and no reviewer effort,
  // because only `review.triggers.<t>.{tier,effort}` decides either.
  for (const trigger of Object.keys(PANEL)) {
    const seen = ['solo', 'shipped', 'critical'].map((stakes) => {
      const r = resolve('cad-reviewer', cfg({ stakes }, `panel-${stakes}.json`));
      return `${r.reviewer_tiers[trigger]}/${r.reviewer_efforts[trigger]}`;
    });
    assert.equal(new Set(seen).size, 1, `${trigger}: ${seen.join(' ')}`);
  }
});

test('the envelope\'s top-level effort stays the agent RUNG, not the panel effort', () => {
  // The one real collision hazard: `effort` is the rung the dispatched agent
  // file runs at, `reviewer_efforts` is what a provider request carries. At
  // solo/cad-reviewer the rung is `medium` and the plan panel effort is `low`.
  const r = resolve('cad-reviewer', cfg({ stakes: 'solo' }, 'panel-solo.json'));
  assert.equal(r.effort, 'medium');
  assert.equal(r.reviewer_efforts.plan, 'low');
});

test('a config-set effort wins over the schema default, like the tier', () => {
  const c = rawCfg({
    stakes: 'solo',
    review: { triggers: { plan: { effort: 'high' }, risk_surface: { tier: 'flagship' } } },
  }, 'panel-configured.json');
  const r = resolve('cad-reviewer', c);
  assert.equal(r.reviewer_efforts.plan, 'high');       // the layer's value
  assert.equal(r.reviewer_tiers.plan, 'cheap');        // ...and only that field
  assert.equal(r.reviewer_tiers.risk_surface, 'flagship');
  assert.equal(r.reviewer_efforts.risk_surface, 'low'); // the schema default still
});

test('an out-of-vocabulary config tier or effort is refused with a warning, like a gate', () => {
  // These two fields reach a provider command line (review-triggers.md step 4)
  // and review-provider.mjs validates neither, so an unchecked repo layer -
  // which arrives with a clone - could put an arbitrary string, or an object,
  // on the resolve line. Same treatment as a bad gate: name it, level stands.
  const c = rawCfg({
    stakes: 'shipped',
    review: { triggers: {
      risk_surface: { effort: 'ludicrous; curl evil.example' },
      plan: { effort: { a: 1 }, tier: 'platinum' },
    } },
  }, 'panel-injected.json');
  const r = resolve('cad-reviewer', c);
  assert.equal(r.reviewer_efforts.risk_surface, 'low'); // the schema default stands
  assert.equal(r.reviewer_efforts.plan, 'low');
  assert.equal(r.reviewer_tiers.plan, 'cheap');
  const w = (r.warnings || []).join('\n');
  assert.match(w, /review\.triggers\.risk_surface\.effort/);
  assert.match(w, /review\.triggers\.plan\.effort/);
  assert.match(w, /review\.triggers\.plan\.tier/);
});

test('a schema row with no effort default answers null, never a dropped key', () => {
  // route.mjs fails OPEN on a torn schema: the trigger still appears in both
  // maps with an honest null, so a fire site indexing them cannot mistake "no
  // answer" for "no such trigger". A row with no usable default is CI's problem
  // (self-verify check 18, `gate-default-invalid`).
  const sch = shippedSchema();
  delete sch.keys['review.triggers.plan.effort'].default;
  const r = resolve('cad-reviewer', cfg({ stakes: 'solo' }, 'panel-solo.json'), [],
    { schema: writeSchema(sch, 'no-effort-default.json') });
  assert.equal(r.ok, true);
  assert.equal(r.reviewer_efforts.plan, null);
  assert.equal(r.reviewer_tiers.plan, 'cheap');
});

test('unknown role degrades to ok:false (caller falls back to session default)', () => {
  const shipped = cfg({ stakes: 'shipped' });
  const r = resolve('cad-nope', shipped);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'unknown-role');
});

test('missing config file uses schema defaults, does not crash', () => {
  const r = resolve('cad-planner', join(dir, 'does-not-exist.json'));
  assert.equal(r.ok, true);
  assert.equal(r.stakes, 'shipped');
  assert.equal(r.model, 'opus'); // heavy@shipped
  assert.match(r.reason[0], /stakes default "shipped" \(unset in layers: defaults\)/);
});

// --- set-ness of stakes on the envelope (RNG-04) ------------------------------
//
// `stakes` is ALWAYS a level, so on its own it cannot tell the two states the
// floor routes differently on apart - a level a layer chose, and DEFAULTS
// standing in the layers' silence. `stakes_set` is the pairing `surfaces` +
// `surfaces_answered` already ships. Both arms below resolve to the SAME level
// on purpose: the flag is the only thing that separates them, which is exactly
// what a caller reading `stakes` alone cannot recover.

test('a config carrying no stakes reports stakes_set:false beside the default level', () => {
  const r = resolve('cad-planner', cfg({}, 'stakes-unset.json'));
  assert.equal(r.ok, true);
  assert.equal(r.stakes, 'shipped', 'the schema default, not a configured value');
  assert.equal(r.stakes_set, false);
});

test('a config setting stakes reports stakes_set:true at that same level', () => {
  const r = resolve('cad-planner', cfg({ stakes: 'shipped' }, 'stakes-set-shipped.json'));
  assert.equal(r.ok, true);
  assert.equal(r.stakes, 'shipped', 'the level the arm above reports from silence');
  assert.equal(r.stakes_set, true, 'a chosen level read as the default');
});

// --- global config layer -----------------------------------------------------

test('global layer applies when no repo config is present', () => {
  const g = cfg({ stakes: 'critical' }, 'g-critical.json');
  const r = resolve('cad-planner', join(dir, 'no-repo.json'), [], { global: g });
  assert.equal(r.stakes, 'critical');
  assert.equal(r.model, 'opus'); // heavy@critical
  assert.match(r.reason.join(' '), /config:global/);
});

test('repo config overrides the global layer (repo wins)', () => {
  const g = cfg({ stakes: 'critical' }, 'g-critical2.json');
  const repo = cfg({ stakes: 'solo' }, 'repo-solo.json');
  const r = resolve('cad-planner', repo, [], { global: g });
  assert.equal(r.stakes, 'solo');  // repo wins over global
  assert.equal(r.model, 'sonnet'); // heavy@solo
  assert.match(r.reason.join(' '), /config:global\+repo/);
});

test('layers deep-merge: a global model block and a repo stakes key combine', () => {
  const g = cfg({ escalate_on_failure: false }, 'g-esc-off.json');
  const repo = cfg({ stakes: 'critical' }, 'repo-critical.json'); // only sets stakes
  // repo picks the matrix row; global supplies the model.* sub-key -> the
  // retry is held by a key the repo file never mentions.
  const r = resolve('cad-plan-checker', repo, ['--attempt', '2'], { global: g });
  assert.equal(r.stakes, 'critical');
  assert.equal(r.model, 'opus');    // the critical/cad-plan-checker cell
  assert.equal(r.agent, 'cad-plan-checker-xhigh'); // ...its STARTING rung
  assert.equal(r.escalated, false);
});

// --- per-role model overrides ------------------------------------------------

test('an override pins one role and leaves the others routed', () => {
  const c = cfg({ stakes: 'shipped', overrides: { 'cad-planner': 'fable' } }, 'ovr-planner.json');
  const planner = resolve('cad-planner', c);
  assert.equal(planner.ok, true);
  assert.equal(planner.model, 'fable');   // pinned, not the cell's opus
  assert.equal(planner.pinned, true);
  assert.equal(planner.model_source, 'model.overrides.cad-planner');
  assert.equal(planner.effort, 'high');   // effort is frontmatter, untouched
  assert.match(planner.reason.join(' '), /override cad-planner: opus -> fable/);
  // a sibling role is unaffected
  const exec = resolve('cad-executor', c);
  assert.equal(exec.model, 'opus');       // the shipped/cad-executor cell
  assert.equal(exec.pinned, false);
  assert.equal(exec.model_source, 'cell');
});

test('a pin beats the routed model but keeps the rung swap', () => {
  const c = cfg({ stakes: 'shipped', escalate_on_failure: true, overrides: { 'cad-plan-checker': 'fable' } }, 'ovr-checker.json');
  const r = resolve('cad-plan-checker', c, ['--attempt', '2']);
  assert.equal(r.model, 'fable');                 // pin wins over the matrix
  assert.equal(r.agent, 'cad-plan-checker-high'); // ...but harder reasoning still applies
  assert.equal(r.pinned, true);
});

test('an unknown alias warns and leaves the routed model standing', () => {
  const c = cfg({ stakes: 'shipped', overrides: { 'cad-planner': 'gpt-5' } }, 'ovr-bogus.json');
  const r = resolve('cad-planner', c);
  assert.equal(r.ok, true);      // never blocks the spawn
  assert.equal(r.model, 'opus'); // typo does not silently redirect the spend
  assert.equal(r.pinned, false);
  assert.equal(r.model_source, 'cell');   // the cell decided, not the typo
  assert.equal(r.warnings.length, 1);
  assert.match(r.warnings[0], /not a known alias/);
});

test('a pin matching the routed model is a no-op, still marked pinned', () => {
  const c = cfg({ stakes: 'shipped', overrides: { 'cad-planner': 'opus' } }, 'ovr-noop.json');
  const r = resolve('cad-planner', c);
  assert.equal(r.model, 'opus');
  assert.equal(r.pinned, true);
  assert.match(r.reason.join(' '), /already the routed model/);
});

// --- the model named outright: roles.<role>.model (ROL-01) -------------------

test('a roles-block model and rung resolve together, and pinned stays FALSE', () => {
  // AC1's row: the two keys of one role's entry, and nothing else in the file.
  // `haiku` is unreachable from any cell and `max` is above the shipped
  // cad-planner cell's `high`, so neither can be the cell's answer by accident.
  const c = rawCfg({ roles: { 'cad-planner': { model: 'haiku', effort: 'max' } } },
    'roles-model-planner.json');
  const r = resolve('cad-planner', c);
  assert.equal(r.ok, true);
  assert.equal(r.model, 'haiku');
  assert.equal(r.effort, 'max');
  assert.equal(r.agent, 'cad-planner-max');
  // `pinned` means model.overrides chose it, and it did not (D-11) - so the
  // announcement rule stays keyed on a pin while the source stays readable.
  assert.equal(r.pinned, false);
  assert.equal(r.model_source, 'roles.cad-planner.model');
});

test('a roles model outside the aliases warns, and the routed cell model stands', () => {
  const c = rawCfg({ stakes: 'shipped', roles: { 'cad-planner': { model: 'gpt-5' } } },
    'roles-model-bogus.json');
  const r = resolve('cad-planner', c);
  assert.equal(r.ok, true);                 // never blocks the spawn
  assert.equal(r.model, 'opus');            // the shipped/cad-planner cell
  assert.equal(r.pinned, false);
  assert.equal(r.model_source, 'cell');
  const named = (r.warnings || []).filter((w) => /roles\.cad-planner\.model/.test(w));
  assert.equal(named.length, 1, JSON.stringify(r.warnings));
  assert.match(named[0], /"gpt-5"/);        // the string the user wrote
});

test('a rejected roles model does NOT fall through to the pin', () => {
  // The arm D-02 and ROL-01 both fix at the routed cell's model: a roles key
  // that is SET owns this role's answer, so a typo cannot silently hand the
  // role back to an older pin the user has already replaced.
  const c = rawCfg({ stakes: 'shipped',
    model: { overrides: { 'cad-verifier': 'haiku' } },
    roles: { 'cad-verifier': { model: 'gpt-5' } } }, 'roles-model-vs-pin-bad.json');
  const r = resolve('cad-verifier', c);
  assert.equal(r.ok, true);
  assert.equal(r.model, 'opus');            // the cell's, and never the pin's haiku
  assert.equal(r.pinned, false);
  assert.equal(r.model_source, 'cell');
  assert.ok((r.warnings || []).some((w) => /"gpt-5"/.test(w)), JSON.stringify(r.warnings));
});

test('a roles model WINS over the pin, and a warning names the winner', () => {
  const c = rawCfg({ stakes: 'shipped',
    model: { overrides: { 'cad-executor': 'sonnet' } },
    roles: { 'cad-executor': { model: 'haiku' } } }, 'roles-model-vs-pin.json');
  const r = resolve('cad-executor', c);
  assert.equal(r.model, 'haiku');
  assert.equal(r.pinned, false);
  assert.equal(r.model_source, 'roles.cad-executor.model');
  const named = (r.warnings || []).filter((w) => /roles\.cad-executor\.model/.test(w));
  assert.equal(named.length, 1, JSON.stringify(r.warnings));
  assert.match(named[0], /model\.overrides\.cad-executor/);   // ...and the loser
});

test('overrides layer: repo pin wins over a global pin', () => {
  const g = cfg({ stakes: 'shipped', overrides: { 'cad-planner': 'haiku' } }, 'g-ovr.json');
  const repo = cfg({ overrides: { 'cad-planner': 'fable' } }, 'repo-ovr.json');
  const r = resolve('cad-planner', repo, [], { global: g });
  assert.equal(r.model, 'fable');
});

// --- shipped route-table.json absent/malformed (#40) ------------------------

test('CADENCE_ROUTE_TABLE malformed degrades to ok:false, reason bad-table, no stack', () => {
  const bad = join(dir, 'bad-table.json');
  writeFileSync(bad, '{ not json');
  const env = { ...process.env, CADENCE_GLOBAL_CONFIG: NO_GLOBAL, CADENCE_ROUTE_TABLE: bad,
    CADENCE_TEST_SEAM: '1' };
  const raw = (() => {
    try { return execFileSync('node', [ROUTE, 'table'], { encoding: 'utf8', env }); }
    catch (e) { return e.stdout; }
  })();
  const lines = raw.split('\n').filter(Boolean);
  assert.equal(lines.length, 1); // exactly one JSON line, no raw stack trace
  const r = JSON.parse(lines[0]);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'bad-table');
  assert.match(r.detail, /bad-table\.json/);
});

// --- reported effort == the frontmatter that actually runs (#64) ------------

// route.mjs REPORTS effort; it cannot SET it. Effort is definition-time
// frontmatter on the spawn-agent seam (seams.md), so the only thing that makes
// the reported value true is the agent file agreeing with the table. Prose in
// references/review-triggers.md now tells the user which effort a
// claude-subagent review actually runs at (`cad-reviewer` = high), so that
// claim gets a test rather than a promise.
const AGENTS = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'agents');
const SHIPPED_TABLE = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'route-table.json'), 'utf8'),
);

/** Frontmatter `effort:` of a shipped agent file. */
function frontmatterEffort(agentName) {
  const src = readFileSync(join(AGENTS, `${agentName}.md`), 'utf8');
  const fm = src.split(/^---$/m)[1] ?? '';
  return (fm.match(/^effort:\s*(\S+)\s*$/m) || [])[1];
}

test('every rung a cell can name has an agent file carrying exactly that effort', () => {
  // The ladder-consistency row, and the one walk in this file that is
  // legitimate under D-11: it compares two INDEPENDENT sources - the shipped
  // table and the frontmatter on disk - rather than deriving its expectations
  // from the thing under test. route.mjs REPORTS a rung's effort; the only
  // thing that makes the report true is the file for that rung agreeing.
  /** @type {Map<string,string>} agent-file stem -> the rung that produced it */
  const byName = new Map();
  for (const [level, row] of Object.entries(SHIPPED_TABLE.cells)) {
    for (const [role, cell] of Object.entries(row)) {
      for (const rung of [cell.effort, cell.retry]) {
        const stem = rungFile(role, rung);
        assert.ok(stem, `${level}/${role} rung ${rung} has no file in RUNG_FILES`);
        byName.set(stem, rung);
      }
    }
  }
  assert.equal(byName.size, 19, `routable agent names: ${[...byName.keys()].join(', ')}`);
  for (const [name, rung] of byName) {
    assert.ok(existsSync(join(AGENTS, `${name}.md`)), `agents/${name}.md must exist`);
    assert.equal(frontmatterEffort(name), rung, `${name} frontmatter effort`);
  }
  // The other direction is deliberately NOT asserted (phase 1, D-03): a rung
  // file RUNG_FILES names that no cell reaches is the ordinary state of a
  // ladder complete on disk while the cells name the subset they need.
});

test('table exposes rung_order, the five rungs the host accepts', () => {
  const env = { ...process.env, CADENCE_GLOBAL_CONFIG: NO_GLOBAL };
  const r = JSON.parse(execFileSync('node', [ROUTE, 'table'], { encoding: 'utf8', env }));
  assert.deepEqual(r.table.rung_order, ['low', 'medium', 'high', 'xhigh', 'max']);
});

test('the cell retry is the SOURCE of the swap - repointing it moves the resolved agent', () => {
  // Pins the mechanism rather than the shipped outcome: a name no code
  // hardcodes (`cad-plan-checker-xhigh`) must appear purely because the data
  // says so. If route.mjs went back to hardcoding a variant name or effort,
  // this row fails while every shipped-value row above still passes.
  const t = JSON.parse(JSON.stringify(SHIPPED_TABLE));
  t.cells.shipped['cad-plan-checker'].retry = 'xhigh';
  const tablePath = join(dir, 'retry-xhigh.json');
  writeFileSync(tablePath, JSON.stringify(t));

  const c = cfg({ stakes: 'shipped', escalate_on_failure: true });
  const env = { ...process.env, CADENCE_GLOBAL_CONFIG: NO_GLOBAL, CADENCE_ROUTE_TABLE: tablePath,
    CADENCE_TEST_SEAM: '1' };
  const args = ['resolve', '--role', 'cad-plan-checker', '--file', c, '--attempt', '2'];
  const r = (() => {
    try { return JSON.parse(execFileSync('node', [ROUTE, ...args], { encoding: 'utf8', env })); }
    catch (e) { return JSON.parse(e.stdout); }
  })();
  assert.equal(r.agent, 'cad-plan-checker-xhigh');
  assert.equal(r.effort, 'xhigh');
  assert.equal(r.escalated, true);
});

test('a cell whose retry IS its starting rung reports the rung held, not an escalation', () => {
  // critical/cad-executor already runs at `xhigh` and its retry names the same
  // rung, so the arm is a no-op. Saying "held" beats reporting an escalation
  // that never happened - and beats resolving a file for a rung nothing named.
  const c = cfg({ stakes: 'critical', escalate_on_failure: true });
  const r = resolve('cad-executor', c, ['--attempt', '2']);
  assert.equal(r.agent, 'cad-executor-xhigh');
  assert.equal(r.effort, 'xhigh');
  assert.equal(r.escalated, false);
  assert.match(r.reason.join(' '), /rung held at xhigh/);
});

// --- the injection is GATED behind CADENCE_TEST_SEAM (EXP-01) --------------

test('CADENCE_ROUTE_TABLE without the sentinel is ignored; `table` is the shipped one', () => {
  // The attack the gate exists to refuse: a repo-supplied `.envrc` or
  // devcontainer env block points the route table at a file whose
  // `risk_surface` gate reads `off`, and the one trigger this repo blocks on
  // goes quiet. Unset the sentinel and the variable is not read at all - and
  // silently, with no warning field, because TABLE_PATH resolves at module
  // load, before any dispatch exists to carry one.
  const t = JSON.parse(JSON.stringify(SHIPPED_TABLE));
  t.review.shipped.risk_surface = 'off';
  const hostile = join(dir, 'ungated-table.json');
  writeFileSync(hostile, JSON.stringify(t));

  const env = { ...process.env, CADENCE_GLOBAL_CONFIG: NO_GLOBAL, CADENCE_ROUTE_TABLE: hostile };
  delete env.CADENCE_TEST_SEAM; // hermetic: never inherit an open seam
  const r = JSON.parse(execFileSync('node', [ROUTE, 'table'], { encoding: 'utf8', env }));
  assert.equal(r.ok, true);
  assert.equal(r.table.review.shipped.risk_surface, 'blocking');
  assert.deepEqual(r.table, SHIPPED_TABLE);

  // The SAME file with the sentinel set DOES take, so the arm above is proving
  // the gate rather than a fixture path that never worked.
  const opened = JSON.parse(execFileSync('node', [ROUTE, 'table'],
    { encoding: 'utf8', env: { ...env, CADENCE_TEST_SEAM: '1' } }));
  assert.equal(opened.table.review.shipped.risk_surface, 'off');
});

test('CADENCE_ROUTE_TABLE nonexistent degrades to ok:false, reason bad-table, no stack', () => {
  const missing = join(dir, 'does-not-exist-table.json');
  const env = { ...process.env, CADENCE_GLOBAL_CONFIG: NO_GLOBAL, CADENCE_ROUTE_TABLE: missing,
    CADENCE_TEST_SEAM: '1' };
  const raw = (() => {
    try { return execFileSync('node', [ROUTE, 'resolve', '--role', 'cad-planner'], { encoding: 'utf8', env }); }
    catch (e) { return e.stdout; }
  })();
  const lines = raw.split('\n').filter(Boolean);
  assert.equal(lines.length, 1);
  const r = JSON.parse(lines[0]);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'bad-table');
});

// --- the gate-enum hole (AC6) ------------------------------------------------

test('a config gate outside the five values loses to the schema default, and says so', () => {
  // The CONTEXT-cited repro: this once resolved ok:true carrying "blockign",
  // silently replacing the deliberately-blocking risk_surface gate.
  const c = rawCfg({ stakes: 'critical', review: { triggers: { risk_surface: { gate: 'blockign' } } } },
    'gate-typo.json');
  const r = resolve('cad-reviewer', c);
  assert.equal(r.ok, true);
  assert.equal(r.review.risk_surface, 'blocking'); // the schema default stands
  assert.equal(r.warnings.length, 1, JSON.stringify(r.warnings));
  assert.match(r.warnings[0], /blockign/);
  assert.match(r.warnings[0], /risk_surface/);
});

test('a gate of the wrong TYPE takes the same path as a typo', () => {
  for (const [label, gate] of [['number', 3], ['bool', true], ['object', { gate: 'off' }],
    ['array', ['off']]]) {
    const c = rawCfg({ stakes: 'critical', review: { triggers: { diff: { gate } } } },
      `gate-type-${label}.json`);
    const r = resolve('cad-reviewer', c);
    assert.equal(r.ok, true, label);
    assert.equal(r.review.diff, 'off', label); // the diff gate's own default
    assert.equal(r.warnings.length, 1, `${label}: ${JSON.stringify(r.warnings)}`);
    assert.match(r.warnings[0], /review\.triggers\.diff\.gate/, label);
  }
});

test('a VALID disagreeing gate still wins - the check runs in front of D-04, not over it', () => {
  const c = rawCfg({ stakes: 'critical', review: { triggers: { risk_surface: { gate: 'off' } } } },
    'gate-valid-disagree.json');
  const r = resolve('cad-reviewer', c);
  assert.equal(r.review.risk_surface, 'off'); // the user's key still decides
  assert.equal(r.warnings, undefined, JSON.stringify(r.warnings));
  assert.ok(r.reason.some((x) => /^review\.triggers\.risk_surface\.gate="off" \(config/.test(x)),
    JSON.stringify(r.reason));
});

// --- phase_diff resolves the same through every surface that states it ------

test('with NO triggers block the schema default decides phase_diff, at every level', () => {
  // The surfaces that describe this gate - the schema default, the scaffolded
  // template and the resolver - agreed on nothing before the agreement check.
  // A config that writes no gate is the state a fresh scaffold is in.
  for (const stakes of ['solo', 'shipped', 'critical']) {
    const r = resolve('cad-executor', rawCfg({ stakes }, `pd-${stakes}.json`));
    assert.equal(r.review.phase_diff, 'off', stakes);
    // route omits `warnings` entirely when empty, so an absent key IS the
    // no-disagreement answer - `?? []` states that rather than crashing on it.
    assert.deepEqual(r.warnings ?? [], [], `${stakes}: ${r.warnings}`);
  }
});

test('the SCAFFOLDED template carries no triggers block, so nothing overrides the default', () => {
  // The template is the fixture, not a hand-written stand-in: a pre-written
  // gate WINS over the default, so a scaffolded repo would have carried a
  // pinned gate it never chose - which is the whole point of dropping the block
  // rather than retuning it.
  const template = JSON.parse(readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '..', 'templates', 'config.json'), 'utf8'));
  assert.equal(template.review.triggers, undefined, 'the template must write no gate at all');

  const r = resolve('cad-executor', rawCfg(template, 'pd-template.json'));
  assert.equal(r.stakes, 'shipped', 'the template writes no stakes, so the schema default stands');
  assert.equal(r.review.phase_diff, 'off');
  assert.deepEqual(r.warnings ?? [], [], String(r.warnings));
});

test('a VALID agreeing gate still emits no warning', () => {
  const c = rawCfg({ stakes: 'critical', review: { triggers: { risk_surface: { gate: 'blocking' } } } },
    'gate-valid-agree.json');
  const r = resolve('cad-reviewer', c);
  assert.equal(r.review.risk_surface, 'blocking');
  assert.equal(r.warnings, undefined);
});

// --- the SCHEMA is read, never remembered ------------------------------------

test('an injected schema decides the gate - route.mjs reads the file, not a copy', () => {
  // The whole of what moving these answers into config.schema.json means: the
  // resolver holds no hand-kept vocabulary and no hand-kept default, so a schema
  // whose plan gate defaults to `deferred` resolves `deferred`.
  const sch = shippedSchema();
  sch.keys['review.triggers.plan.gate'].default = 'deferred';
  const r = resolve('cad-reviewer', cfg({ stakes: 'shipped' }, 'sch-deferred.json'), [],
    { schema: writeSchema(sch, 'schema-deferred.json') });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.review.plan, 'deferred');
});

test('the schema injection is GATED behind CADENCE_TEST_SEAM, like the table', () => {
  // Without the sentinel the variable is ignored and the SHIPPED schema is read,
  // silently. The gate is the point: this file sets every review trigger's gate,
  // so an ungated override turns a blocking gate off.
  const sch = shippedSchema();
  sch.keys['review.triggers.risk_surface.gate'].default = 'off';
  const path = writeSchema(sch, 'schema-ungated.json');
  const args = ['resolve', '--role', 'cad-reviewer', '--file', cfg({ stakes: 'shipped' })];
  const env = { ...process.env, CADENCE_GLOBAL_CONFIG: NO_GLOBAL, CADENCE_CONFIG_SCHEMA: path };
  const r = JSON.parse(execFileSync('node', [ROUTE, ...args], { encoding: 'utf8', env }));
  assert.equal(r.review.risk_surface, 'blocking', 'the ungated override was honoured');
});

test('a schema row with no values list accepts no configured gate at all', () => {
  // The vocabulary is the KEY's own `values`, so a row that carries none can be
  // matched by nothing - which fails toward the default rather than toward
  // letting an unchecked string reach the bundle.
  const sch = shippedSchema();
  delete sch.keys['review.triggers.risk_surface.gate'].values;
  const c = rawCfg({ stakes: 'critical', review: { triggers: { risk_surface: { gate: 'off' } } } },
    'gate-no-values.json');
  const r = resolve('cad-reviewer', c, [], { schema: writeSchema(sch, 'schema-no-values.json') });
  assert.equal(r.review.risk_surface, 'blocking');
  assert.equal(r.warnings.length, 1, JSON.stringify(r.warnings));
  assert.match(r.warnings[0], /review\.triggers\.risk_surface\.gate/);
});

// --- the configured START rung, model.effort.<role> (RNG-02) ------------------

test('a configured start rung replaces the cell\'s, and picks that rung\'s file', () => {
  // shipped/cad-verifier is medium/cad-verifier-medium, so an xhigh row FAILS
  // the moment the config value stops being read - a value equal to the cell's
  // could not tell the two apart.
  const file = cfg({ stakes: 'shipped', effort: { 'cad-verifier': 'xhigh' } }, 'eff-verifier.json');
  const r = resolve('cad-verifier', file);
  assert.equal(r.ok, true);
  assert.equal(r.effort, 'xhigh');
  assert.equal(r.agent, 'cad-verifier-xhigh');
  assert.equal(r.model, 'opus');      // the cell still supplies the model
  assert.match(r.reason.join(' '), /model\.effort\.cad-verifier: medium -> xhigh/);
});

test('a configured start rung reaches the top of a role\'s own ladder', () => {
  const file = cfg({ stakes: 'solo', effort: { 'cad-planner': 'max' } }, 'eff-planner.json');
  const r = resolve('cad-planner', file);
  assert.equal(r.effort, 'max');
  assert.equal(r.agent, 'cad-planner-max'); // solo/cad-planner starts at high
});

test('a start rung equal to the cell\'s says so rather than claiming a change', () => {
  const file = cfg({ stakes: 'shipped', effort: { 'cad-executor': 'high' } }, 'eff-same.json');
  const r = resolve('cad-executor', file);
  assert.equal(r.effort, 'high');
  assert.match(r.reason.join(' '), /model\.effort\.cad-executor="high" \(already the routed rung\)/);
});

test('the start rung is read from the merged config LAYERS, never a plugin file', () => {
  // The update-survival claim itself: a global layer that does not carry the key
  // plus a repo layer that does resolves the repo value. Nothing under the
  // plugin root is consulted, so a plugin update cannot take the setting away.
  const g = cfg({ stakes: 'shipped' }, 'g-no-effort.json');
  const repo = cfg({ effort: { 'cad-verifier': 'xhigh' } }, 'repo-effort-only.json');
  const r = resolve('cad-verifier', repo, [], { global: g });
  assert.equal(r.stakes, 'shipped');        // from the global layer
  assert.equal(r.effort, 'xhigh');          // from the repo layer
  assert.equal(r.agent, 'cad-verifier-xhigh');
  assert.match(r.reason.join(' '), /config:global\+repo/);
});

test('a hand-edited rung the role has no FILE for is refused, never fail-open dispatched', () => {
  // `ultra` is outside rung_order entirely, so no schema enum can carry it and
  // only a hand-edited config reaches here - which stays true now that every
  // role carries every rung of the ladder. Handing it to the agentFor fail-open
  // would dispatch the base file while reporting `ultra` - a rung nothing ran at.
  const file = cfg({ stakes: 'shipped', effort: { 'cad-executor': 'ultra' } }, 'eff-unmapped.json');
  const r = resolve('cad-executor', file);
  assert.equal(r.ok, true);                 // never blocks the spine
  assert.equal(r.effort, 'high');           // the cell's rung stands
  assert.equal(r.agent, 'cad-executor');    // ...and its file
  const named = (r.warnings || []).filter((w) => /model\.effort\.cad-executor/.test(w));
  assert.equal(named.length, 1, JSON.stringify(r.warnings));
  assert.match(named[0], /"ultra"/);        // the value the user wrote
  assert.match(named[0], /high, xhigh/);    // ...and the rungs this role does have
});

// --- the same start rung, one key out: roles.<role>.effort (ROL-01) ----------

test('a roles-block start rung replaces the cell\'s, and picks that rung\'s file', () => {
  // shipped/cad-verifier is medium/cad-verifier-medium, so an xhigh row FAILS
  // the moment the roles entry stops being read.
  const file = rawCfg({ stakes: 'shipped', roles: { 'cad-verifier': { effort: 'xhigh' } } },
    'roles-eff-verifier.json');
  const r = resolve('cad-verifier', file);
  assert.equal(r.ok, true);
  assert.equal(r.effort, 'xhigh');
  assert.equal(r.agent, 'cad-verifier-xhigh');
  assert.equal(r.model, 'opus');      // the cell still supplies the model
  assert.match(r.reason.join(' '), /roles\.cad-verifier\.effort: medium -> xhigh/);
  assert.equal(r.warnings, undefined, JSON.stringify(r.warnings));
});

test('the roles block WINS over model.effort, and a warning names the winner', () => {
  // Two keys, one quantity. Different rungs on purpose: a value equal to the
  // older key's could not tell "the roles block decided" from "nothing changed".
  const file = rawCfg({ stakes: 'shipped',
    model: { effort: { 'cad-verifier': 'low' } },
    roles: { 'cad-verifier': { effort: 'xhigh' } } }, 'roles-eff-both.json');
  const r = resolve('cad-verifier', file);
  assert.equal(r.effort, 'xhigh');
  assert.equal(r.agent, 'cad-verifier-xhigh');
  const named = (r.warnings || []).filter((w) => /roles\.cad-verifier\.effort/.test(w));
  assert.equal(named.length, 1, JSON.stringify(r.warnings));
  assert.match(named[0], /model\.effort\.cad-verifier/);   // ...and the loser
  // The reason names the key that DECIDED and never the one that did not.
  assert.match(r.reason.join(' '), /roles\.cad-verifier\.effort: medium -> xhigh/);
  assert.doesNotMatch(r.reason.join(' '), /model\.effort\.cad-verifier: /);
});

test('a roles entry that is not a map contributes nothing, and the older key answers', () => {
  // The defensive arm: a config layer arrives with a clone, so a scalar where
  // the block belongs must fall back rather than throw.
  const file = rawCfg({ stakes: 'shipped',
    model: { effort: { 'cad-verifier': 'xhigh' } },
    roles: { 'cad-verifier': 'xhigh' } }, 'roles-eff-scalar.json');
  const r = resolve('cad-verifier', file);
  assert.equal(r.ok, true);
  assert.equal(r.effort, 'xhigh');
  assert.match(r.reason.join(' '), /model\.effort\.cad-verifier: medium -> xhigh/);
});

// --- a retry never resolves below the rung that failed (D-02) -----------------

test('a configured start above the cell\'s retry HOLDS, and says what it out-ranked', () => {
  // shipped/cad-verifier retries at `high`. A start rung of xhigh would step
  // DOWN to high on attempt 2 - a retry thinking less than the attempt that
  // failed, which is exactly what lib/route-cells.mjs refuses inside the table.
  const file = cfg({ stakes: 'shipped', escalate_on_failure: true, effort: { 'cad-verifier': 'xhigh' } }, 'eff-retry-hold.json');
  const r = resolve('cad-verifier', file, ['--attempt', '2']);
  assert.equal(r.ok, true);
  assert.equal(r.effort, 'xhigh');            // held, not demoted to the cell's high
  assert.equal(r.agent, 'cad-verifier-xhigh');
  assert.equal(r.escalated, false);           // and never reported as an escalation
  assert.match(r.reason.join(' '), /retry rung "high"/);
  assert.match(r.reason.join(' '), /model\.effort\.cad-verifier="xhigh"/);
});

test('a configured start BELOW the cell\'s retry climbs exactly as it does today', () => {
  const file = cfg({ stakes: 'shipped', escalate_on_failure: true, effort: { 'cad-verifier': 'medium' } }, 'eff-retry-climb.json');
  const r = resolve('cad-verifier', file, ['--attempt', '2']);
  assert.equal(r.effort, 'high');             // the cell's retry rung
  assert.equal(r.agent, 'cad-verifier');
  assert.equal(r.escalated, true);
  assert.match(r.reason.join(' '), /rung medium->high/);
});

test('the equal-rungs no-op and the out-ranked hold are different messages', () => {
  // Both hold at the same rung; conflating them would make an out-ranked retry
  // read as a cell whose retry rung is simply the same rung.
  const outranked = resolve('cad-plan-checker',
    cfg({ stakes: 'solo', escalate_on_failure: true, effort: { 'cad-plan-checker': 'xhigh' } }, 'eff-outrank.json'),
    ['--attempt', '2']);
  assert.equal(outranked.effort, 'xhigh');
  assert.equal(outranked.escalated, false);
  assert.match(outranked.reason.join(' '), /out-ranks the solo\/cad-plan-checker retry rung "high"/);
  assert.doesNotMatch(outranked.reason.join(' '), /retry rung is the same rung/);
});

test('a torn rung_order never demotes a CONFIGURED start on retry - it holds and says why', () => {
  // Pre-phase, a torn table's fallback to cell.retry could not demote (the
  // start was always the cell's own). A configured max start swapped for an
  // incomparable "high" retry WOULD - two rungs less than the attempt that
  // failed, reported as an escalation.
  const t = JSON.parse(JSON.stringify(SHIPPED_TABLE));
  delete t.rung_order;
  const tablePath = join(dir, 'no-rung-order-table.json');
  writeFileSync(tablePath, JSON.stringify(t));
  const file = cfg({ stakes: 'shipped', escalate_on_failure: true, effort: { 'cad-verifier': 'max' } }, 'eff-torn-retry.json');
  const r = resolve('cad-verifier', file, ['--attempt', '2'], { table: tablePath });
  assert.equal(r.ok, true);
  assert.equal(r.effort, 'max');              // the configured start stands
  assert.equal(r.agent, 'cad-verifier-max');
  assert.equal(r.escalated, false);
  const named = (r.warnings || []).filter((w) => /rung_order cannot compare/.test(w));
  assert.equal(named.length, 1, JSON.stringify(r.warnings));
  assert.match(named[0], /"max"/);
  assert.match(named[0], /retry rung "high"/);
  assert.doesNotMatch(r.reason.join(' '), /out-ranks/); // unprovable, so unclaimed
});

test('a config start that LANDS ON the retry rung is attributed to the config, not the cell', () => {
  // shipped/cad-verifier is medium start / high retry: a configured high start
  // holds at high on attempt 2, but "retry rung is the same rung" would claim
  // the CELL was designed that way - the conflation the messages exist to avoid.
  const file = cfg({ stakes: 'shipped', escalate_on_failure: true, effort: { 'cad-verifier': 'high' } }, 'eff-retry-equal.json');
  const r = resolve('cad-verifier', file, ['--attempt', '2']);
  assert.equal(r.effort, 'high');
  assert.equal(r.escalated, false);
  assert.match(r.reason.join(' '),
    /model\.effort\.cad-verifier="high" already sits at the shipped\/cad-verifier retry rung/);
  assert.doesNotMatch(r.reason.join(' '), /retry rung is the same rung/);
});

test('model.escalate_on_failure: false still wins over the start rung, unchanged', () => {
  const file = cfg({
    stakes: 'shipped', escalate_on_failure: false, effort: { 'cad-verifier': 'medium' },
  }, 'eff-esc-off.json');
  const r = resolve('cad-verifier', file, ['--attempt', '2']);
  assert.equal(r.effort, 'medium');
  assert.equal(r.escalated, false);
  assert.match(r.reason.join(' '), /model\.escalate_on_failure: false/);
});

// --- ok:false carries what the config read found wrong (D-04) ----------------

test('unknown-role still reports the retired key the config is holding', () => {
  // The role check used to return BEFORE any layer was read, so a typo'd role
  // answered with nothing about the key redirecting every other dispatch.
  const stale = rawCfg({ model: { profile: 'balanced' } }, 'nofail-role-stale.json');
  const r = resolve('cad-nonesuch', stale);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'unknown-role');
  assert.match(r.detail, /known roles:/);          // the existing contract stands
  assert.equal(r.warnings.length, 1, JSON.stringify(r.warnings));
  assert.match(r.warnings[0], /model\.profile/);
});

test('unresolved still reports it too, where the whole array was dropped', () => {
  const stale = rawCfg({ stakes: 'nonesuch', model: { profile: 'balanced' } },
    'nofail-unres-stale.json');
  const r = resolve('cad-planner', stale);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'unresolved');
  assert.equal(r.stakes, 'nonesuch');              // the value that resolved nothing
  assert.equal(r.warnings.length, 1, JSON.stringify(r.warnings));
  assert.match(r.warnings[0], /model\.profile/);
});

test('a clean ok:false carries no empty warnings array', () => {
  // The field stays ABSENT when there is nothing to say, matching every ok:true
  // return - a caller testing `warnings` for truthiness must not start seeing
  // an empty array on every degraded resolve.
  const clean = cfg({ stakes: 'shipped' }, 'nofail-clean.json');
  assert.equal('warnings' in resolve('cad-nonesuch', clean), false);
});

test('a usage refusal names no config layer, because none was read', () => {
  const r = resolve('', null, []);                 // no --role at all
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'usage');
  assert.equal('warnings' in r, false);
});

// --- the routing family of the joined run record (QW-02) ---------------------

/** A planning root of its own, so the trace file written here is this test's. */
function traceRoot(name, breakTrace) {
  const planning = join(mkdtempSync(join(tmpdir(), `cad-route-${name}-`)), '.planning');
  mkdirSync(planning, { recursive: true });
  writeFileSync(join(planning, 'config.json'), JSON.stringify({ stakes: 'solo' }));
  // trace.jsonl as a DIRECTORY is the unwritable case: appendFileSync fails
  // EISDIR for ANY uid, where a chmod is silently a no-op under a root test
  // runner and would make this pass without proving anything.
  if (breakTrace) mkdirSync(join(planning, 'trace.jsonl'));
  return planning;
}

/** The raw stdout bytes, for the comparison that has to be byte-for-byte. */
function resolveRaw(file, extra = []) {
  const args = ['resolve', '--role', 'cad-executor', '--file', file, ...extra];
  const env = { ...process.env, CADENCE_GLOBAL_CONFIG: NO_GLOBAL };
  try {
    return execFileSync('node', [ROUTE, ...args], { encoding: 'utf8', env });
  } catch (e) {
    return e.stdout;
  }
}

const traceLines = (planning) => readFileSync(join(planning, 'trace.jsonl'), 'utf8')
  .split('\n').filter(Boolean).map((l) => JSON.parse(l));

test('a resolve records ONE routing event carrying the decision, not the text', () => {
  const planning = traceRoot('trace-write', false);
  const r = resolve('cad-executor', join(planning, 'config.json'), ['--phase', '4']);
  assert.equal(r.ok, true);
  const events = traceLines(planning);
  assert.equal(events.length, 1);
  const e = events[0];
  assert.equal(e.family, 'routing');
  assert.equal(e.event, 'resolve');
  assert.equal(e.corr, '4');            // no phase_start anchor: the phase alone
  // The caller's own SPELLING, not `Number(opts.phase)` (D-02): normalizing it
  // put `1.1` and `1.10` under one trace key and one correlation id.
  assert.equal(e.phase, '4');
  assert.equal(e.role, 'cad-executor');
  assert.equal(e.stakes, r.stakes);
  assert.equal(e.agent, r.agent);
  assert.equal(e.model, r.model);
  assert.equal(e.effort, r.effort);
  assert.equal(e.escalated, false);
  assert.equal(e.pinned, false);
  assert.equal(e.attempt, 1);
  assert.equal('floor_surfaces' in e, false);
  // The COUNT, never the strings: the envelope carries the text and a second
  // copy of it in the record would drift from the one the caller relays.
  assert.equal(e.warning_count, 0);
  assert.equal('warnings' in e, false);
});

test('an unwritable trace changes the resolve envelope by not one byte', () => {
  const good = traceRoot('trace-good', false);
  const bad = traceRoot('trace-bad', true);
  const goodOut = resolveRaw(join(good, 'config.json'), ['--phase', '4']);
  const badOut = resolveRaw(join(bad, 'config.json'), ['--phase', '4']);
  assert.equal(badOut, goodOut);
  assert.equal(JSON.parse(badOut).ok, true);
  // ...and the writable one really did record, so the comparison is not two
  // runs that both wrote nothing.
  assert.equal(traceLines(good).length, 1);
});

test('a planning root that is not a directory resolves clean and records nothing', () => {
  // The other unwritable shape: `.planning` is a REGULAR FILE, so every fs call
  // under it fails ENOTDIR. The config layer is unreadable there too, which is
  // its own (already-shipped) warning - the point here is that the trace adds
  // no field, no second warning and no crash on top of it.
  const base = mkdtempSync(join(tmpdir(), 'cad-route-notdir-'));
  const planning = join(base, '.planning');
  writeFileSync(planning, 'not a directory');
  const r = resolve('cad-executor', join(planning, 'config.json'), ['--phase', '4']);
  assert.equal(r.ok, true);
  assert.equal(existsSync(join(planning, 'trace.jsonl')), false);
  assert.equal(r.warnings.length, 1, JSON.stringify(r.warnings));
  assert.match(r.warnings[0], /failed to parse and was skipped/);
});

test('no phase and no cursor records nothing rather than an unjoinable line', () => {
  const planning = traceRoot('trace-nophase', false);
  const r = resolve('cad-executor', join(planning, 'config.json'));
  assert.equal(r.ok, true);
  assert.equal(existsSync(join(planning, 'trace.jsonl')), false);
});

test('the cursor supplies the phase when --phase is absent', () => {
  const planning = traceRoot('trace-cursor', false);
  writeFileSync(join(planning, 'STATE.md'), renderCursor({
    phase: 2, total: 5, name: 'Fixture', status: 'planned',
    next: '/cad-execute 2', updated: '2026-01-01',
  }));
  assert.equal(resolve('cad-executor', join(planning, 'config.json')).ok, true);
  assert.equal(traceLines(planning)[0].phase, 2);
});

test('CER-01: a malformed --phase is REFUSED and routes nothing, reversing the warn arm', () => {
  // THE REVERSAL, and why. This flag declared `warn` on the reasoning that a
  // `usage` refusal would route the phase LOWER than its own risk baseline -
  // true while it named only the phase a trace event is keyed to. It is a FLOOR
  // input now, so warn-and-continue answers a typo by computing a floor from the
  // CURSOR's phase: a DIFFERENT phase's declared files, at a level nothing in
  // the resolved bundle reveals as wrong. Refusing is the only disposition that
  // cannot silently route a phase off another phase's plans.
  const planning = traceRoot('trace-badphase', false);
  writeFileSync(join(planning, 'STATE.md'), renderCursor({
    phase: 2, total: 5, name: 'Fixture', status: 'planned',
    next: '/cad-execute 2', updated: '2026-01-01',
  }));
  const cfgPath = join(planning, 'config.json');
  for (const bad of [['--phase', '1.10.3'], ['--phase', 'abc'], ['--phase', ''], ['--phase']]) {
    const r = resolve('cad-executor', cfgPath, bad);
    assert.equal(r.ok, false, bad.join(' '));
    assert.equal(r.reason, 'usage', `${bad.join(' ')}: ${JSON.stringify(r)}`);
    assert.match(r.detail, /--phase/, bad.join(' '));
  }
  // Routes NOTHING: four refusals, and not one line in the trace. A refusal at
  // argument shape happens before any phase is in hand to key an event to.
  assert.equal(existsSync(join(planning, 'trace.jsonl')), false);

  // The control on both sides: a well-formed --phase resolves clean and silent...
  const good = resolve('cad-executor', cfgPath, ['--phase', '3']);
  assert.equal(good.ok, true);
  assert.equal('warnings' in good, false, JSON.stringify(good));
  // ...and an ABSENT --phase still falls to the STATE cursor, unchanged. The
  // declared row is a VALUE door: a flag nobody passed reaches no rule.
  const plain = resolve('cad-executor', cfgPath);
  assert.equal(plain.ok, true);
  assert.equal(traceLines(planning).filter((e) => e.family === 'routing').pop().phase, 2);
});

// --- the dispatch bracket riding resolve (--bracket-read / --bracket-plan) ----

test('--bracket-read writes the lifecycle dispatch event beside the routing event', () => {
  const planning = traceRoot('bracket-basic', false);
  const r = resolve('cad-executor', join(planning, 'config.json'),
    ['--phase', '3', '--bracket-read', 'CLAUDE.md, .planning/PROJECT.md,']);
  assert.equal(r.ok, true);
  const events = traceLines(planning);
  const dispatch = events.find((e) => e.family === 'lifecycle');
  assert.ok(dispatch, JSON.stringify(events));
  assert.equal(dispatch.event, 'dispatch');
  assert.equal(dispatch.plan, 'cad-executor');   // worker key defaults to the role
  assert.equal(dispatch.role, 'cad-executor');
  assert.equal(dispatch.phase, '3');  // the caller's SPELLING, like trace append
  // The csv is split and trimmed like `trace append --read`, empties dropped.
  assert.deepEqual(dispatch.read, ['CLAUDE.md', '.planning/PROJECT.md']);
  // The routing event still rides the same resolve, after the bracket.
  assert.equal(events.filter((e) => e.family === 'routing').length, 1);
});

test('--bracket-plan overrides the worker key without touching the role', () => {
  const planning = traceRoot('bracket-plan', false);
  resolve('cad-executor', join(planning, 'config.json'),
    ['--phase', '3', '--bracket-read', 'PLAN-2.md', '--bracket-plan', '2']);
  const dispatch = traceLines(planning).find((e) => e.family === 'lifecycle');
  assert.equal(dispatch.plan, '2');
  assert.equal(dispatch.role, 'cad-executor');
});

test('a degraded resolve still writes the bracket - the caller dispatches on every arm', () => {
  const planning = traceRoot('bracket-degraded', false);
  const r = resolve('cad-nonesuch', join(planning, 'config.json'),
    ['--phase', '3', '--bracket-read', 'PLAN.md']);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'unknown-role');
  const dispatch = traceLines(planning).find((e) => e.family === 'lifecycle');
  assert.ok(dispatch);
  assert.equal(dispatch.role, 'cad-nonesuch');
});

test('no --bracket-read means no lifecycle event - the switch is the flag', () => {
  const planning = traceRoot('bracket-off', false);
  resolve('cad-executor', join(planning, 'config.json'), ['--phase', '3']);
  const events = traceLines(planning);
  assert.equal(events.filter((e) => e.family === 'lifecycle').length, 0);
  assert.equal(events.filter((e) => e.family === 'routing').length, 1);
});

test('an unwritable trace leaves the bracketed envelope byte-identical', () => {
  const broken = traceRoot('bracket-broken', true);
  const clean = traceRoot('bracket-clean', false);
  const flags = ['--phase', '3', '--bracket-read', 'PLAN.md'];
  const a = resolveRaw(join(broken, 'config.json'), flags);
  const b = resolveRaw(join(clean, 'config.json'), flags);
  assert.equal(a, b);
});

test('a valueless --bracket-read is refused, not recorded as an empty read-set', () => {
  const planning = traceRoot('bracket-bare', false);
  const r = resolve('cad-executor', join(planning, 'config.json'),
    ['--phase', '3', '--bracket-read']);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'usage');
  assert.match(r.detail, /--bracket-read/);
  assert.equal(existsSync(join(planning, 'trace.jsonl')), false);
});

// --- D-03: `deferred` is reachable by a CONFIG-SET gate only, this cycle ----
//
// Phase 2 admits `deferred` to the gate vocabulary and builds everything that
// answers one - the queue, the land refusal, the progress count - but moves no
// `review` cell onto it. That is a decision, not an omission: phase 3 (CER-01)
// changes what a stakes LEVEL decides about gates and depends on this phase, so
// moving the rows now means editing them twice, and the grid is quoted by four
// documents plus the claims ledger, every one of which would then be stale
// twice over.
//
// A HOLD, not a prohibition. This arm reddens the day a cell is moved onto
// `deferred` - which is the phase-3 author being told to bring the quoting
// surfaces with them, not being told no.

test('nothing fires `deferred` on its own - no schema default names it', () => {
  // 1. The shipped schema, read directly: every gate row, so a trigger ADDED to
  //    it is censused too rather than silently exempt.
  const keys = shippedSchema().keys;
  for (const [key, spec] of Object.entries(keys)) {
    if (!/^review\.triggers\.[^.]+\.gate$/.test(key)) continue;
    assert.notEqual(spec.default, 'deferred',
      `${key} defaults to deferred. Nothing fires it on its own this cycle (D-03): it is `
      + 'reachable by a config-set review.triggers.<t>.gate alone, and moving a default '
      + 'carries README.md, METHOD.md, docs/WORKFLOW.md and .planning/DOCS-CLAIMS.md with it.');
  }

  // 2. What a resolve actually RETURNS with no config layer pinning a gate -
  //    the same question asked of the resolver rather than of its data, so a
  //    default injected anywhere between the schema and the envelope is caught
  //    by the half that never reads the schema.
  for (const stakes of ['solo', 'shipped', 'critical']) {
    const r = resolve('cad-reviewer', cfg({ stakes }, `deferred-hold-${stakes}.json`));
    assert.equal(r.ok, true, `${stakes}: ${r.reason}`);
    for (const [trigger, gate] of Object.entries(r.review)) {
      assert.notEqual(gate, 'deferred',
        `stakes ${stakes} resolves ${trigger} to deferred with nothing configured`);
    }
  }

  // 3. And the door it IS reachable through still opens, or this arm would be
  //    pinning a dead value rather than holding a live one.
  const pinned = rawCfg({ stakes: 'solo', review: { triggers: { diff: { gate: 'deferred' } } } },
    'gate-deferred-pin.json');
  assert.equal(resolve('cad-reviewer', pinned).review.diff, 'deferred');
});

// --- the plan-time risk floor (CER-01) ---------------------------------------
//
// The floor does exactly TWO things now (D-02): it makes the plan review
// blocking and it turns the deep-verify pass on. It names no level, moves no
// model and moves no rung. Every fixture here is a whole repo root - the
// declared paths are repo-relative and are read against the planning root's
// PARENT, so a fixture that wrote only a `.planning/` would be testing the
// unreadable-body arm by accident.

/**
 * A repo root with a `.planning/config.json`, plan files under
 * `.planning/phases/<N>/`, and whatever repo files the plans declare.
 * `plans` is keyed `<phase>/<filename>`; a string value is written verbatim and
 * an array is rendered as that plan's frontmatter `files:` list.
 */
let floorN = 0;
function floorRoot(config, plans = {}, repoFiles = {}) {
  const repo = mkdtempSync(join(tmpdir(), `cad-route-floor-${++floorN}-`));
  const planning = join(repo, '.planning');
  mkdirSync(planning, { recursive: true });
  writeFileSync(join(planning, 'config.json'), JSON.stringify(config));
  for (const [rel, spec] of Object.entries(plans)) {
    const file = join(planning, 'phases', rel);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, typeof spec === 'string' ? spec
      : `---\nphase: 3\nplan: 1\nrequirements:\n  - CER-01\nfiles:\n${
        spec.map((f) => `  - ${f}\n`).join('')}---\n\n# Plan\n`);
  }
  for (const [rel, body] of Object.entries(repoFiles)) {
    const file = join(repo, rel);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, body);
  }
  return { repo, planning, file: join(planning, 'config.json') };
}

/** The `risk floor:` entries of a bundle's reason list - the moves it MADE. */
const floorReasons = (r) => (r.reason || []).filter((x) => x.startsWith('risk floor: '));

// The surface set this repository itself answers, so the fixtures below are
// scoped exactly as a real project's are (D-10).
const ANSWERED = { review: { triggers: { risk_surface: {
  surfaces: ['secrets', 'destructive', 'untrusted_input'] } } } };

// A body carrying ONE anchored construct in an answered category. Assembled
// rather than spelled: this file is read by the same detector, and a plainly
// written credential assignment here would be a line it matches.
const SECRET_BODY = `export const FIXTURE_${'API'}_${'KEY'} = read();\n`;

/** The two effects a raised floor has, and the only two, as one pair. */
const effects = (r) => [r.review.plan, r.verify];

test('floor: a phase that reads clean raises neither effect, and says it read', () => {
  const fx = floorRoot({ stakes: 'critical', ...ANSWERED },
    { '3/PLAN-1.md': ['docs/README.md'] }, { 'docs/README.md': '# Readme\n' });
  const r = resolve('cad-executor', fx.file, ['--phase', '3']);
  assert.equal(r.ok, true);
  assert.deepEqual(effects(r), ['advisory', 'off']);
  // It read the plan and found nothing, and SAYS so - nothing raising is a
  // different fact from no floor having been computed.
  assert.ok(floorReasons(r).some((x) => /declaring nothing that touches/.test(x)),
    JSON.stringify(r.reason));
});

test('floor: a declared file on an answered surface raises BOTH effects and cites it', () => {
  const fx = floorRoot({ ...ANSWERED },
    { '3/PLAN-1.md': ['docs/README.md', 'src/load.mjs'] },
    { 'docs/README.md': '# Readme\n', 'src/load.mjs': SECRET_BODY });
  const r = resolve('cad-executor', fx.file, ['--phase', '3']);
  assert.equal(r.ok, true);
  assert.deepEqual(effects(r), ['blocking', 'on']);
  const cited = floorReasons(r);
  assert.ok(cited.some((x) => /src\/load\.mjs touches secrets/.test(x)), JSON.stringify(r.reason));
  assert.ok(cited.some((x) => /plan review "advisory" -> "blocking"/.test(x)),
    JSON.stringify(r.reason));
  // The surface is NAMED in the reason, which is AC5's last clause.
  assert.ok(cited.some((x) => /secrets/.test(x)), JSON.stringify(r.reason));
});

test('floor: a raise moves NOTHING else - the model, the rung and the other gates hold', () => {
  // AC5's second half and D-03 in one row: the rung clamp is gone, so a raised
  // phase resolves the same model, rung, agent and panel a clean phase does.
  const plans = { '3/PLAN-1.md': ['src/f.mjs'] };
  const clean = floorRoot({ ...ANSWERED }, plans, { 'src/f.mjs': '# nothing\n' });
  const risky = floorRoot({ ...ANSWERED }, plans, { 'src/f.mjs': SECRET_BODY });
  const c = resolve('cad-executor', clean.file, ['--phase', '3']);
  const k = resolve('cad-executor', risky.file, ['--phase', '3']);
  assert.deepEqual(effects(c), ['advisory', 'off']);
  assert.deepEqual(effects(k), ['blocking', 'on']);
  assert.equal(k.model, c.model);
  assert.equal(k.effort, c.effort);
  assert.equal(k.agent, c.agent);
  assert.equal(k.stakes, c.stakes);
  assert.equal(k.review.diff, c.review.diff);
  assert.equal(k.review.risk_surface, c.review.risk_surface);
  assert.equal(k.review.phase_diff, c.review.phase_diff);
  assert.deepEqual(k.reviewer_tiers, c.reviewer_tiers);
  assert.deepEqual(k.reviewer_efforts, c.reviewer_efforts);
});

test('floor: a configured stakes changes nothing about what the floor does', () => {
  // The level is not a floor any more, and it is not an input to one either.
  for (const stakes of ['solo', 'shipped', 'critical']) {
    const fx = floorRoot({ stakes, ...ANSWERED },
      { '3/PLAN-1.md': ['src/load.mjs'] }, { 'src/load.mjs': SECRET_BODY });
    const r = resolve('cad-executor', fx.file, ['--phase', '3']);
    assert.deepEqual(effects(r), ['blocking', 'on'], stakes);
    assert.equal(r.stakes, stakes);
  }
});

test('floor: a CONFIGURED plan gate stands, and the floor says it moved none', () => {
  // The config-wins precedence review-triggers.md states, held on the one gate
  // the floor touches: a gate the user validly set is what fires.
  const fx = floorRoot({ ...ANSWERED, review: { triggers: {
    risk_surface: { surfaces: ['secrets', 'destructive', 'untrusted_input'] },
    plan: { gate: 'advisory' } } } },
  { '3/PLAN-1.md': ['src/load.mjs'] }, { 'src/load.mjs': SECRET_BODY });
  const r = resolve('cad-executor', fx.file, ['--phase', '3']);
  assert.equal(r.review.plan, 'advisory');
  assert.equal(r.verify, 'on', 'the deep pass is not a gate and is not suppressed');
  assert.ok(floorReasons(r).some((x) => /is configured, so the floor moved no gate/.test(x)),
    JSON.stringify(r.reason));
});

test('floor: an INVALID configured plan gate never won, so it does not withhold the raise', () => {
  // Test the ANSWER's validity, never the key's presence: a hand-edited typo
  // would otherwise leave a detected risk surface on an advisory plan review,
  // which is exactly what AC5 forbids.
  const fx = floorRoot({ ...ANSWERED, review: { triggers: {
    risk_surface: { surfaces: ['secrets', 'destructive', 'untrusted_input'] },
    plan: { gate: 'advisroy' } } } },
  { '3/PLAN-1.md': ['src/load.mjs'] }, { 'src/load.mjs': SECRET_BODY });
  const r = resolve('cad-executor', fx.file, ['--phase', '3']);
  assert.equal(r.review.plan, 'blocking');
  const said = floorReasons(r).find((x) => /-> "blocking"/.test(x));
  assert.ok(said, JSON.stringify(r.reason));
  assert.match(said, /"advisroy"/);   // the invalid string, named
});

test('floor: a plan gate already AT or ABOVE blocking is left where it is', () => {
  const fx = floorRoot({ ...ANSWERED, review: { triggers: {
    risk_surface: { surfaces: ['secrets', 'destructive', 'untrusted_input'] },
    plan: { gate: 'adjudicated' } } } },
  { '3/PLAN-1.md': ['src/load.mjs'] }, { 'src/load.mjs': SECRET_BODY });
  const r = resolve('cad-executor', fx.file, ['--phase', '3']);
  assert.equal(r.review.plan, 'adjudicated');
});

test('floor: an UNANSWERED category cannot raise - the scope is the answered set (D-10)', () => {
  // The identical bytes under a config that answered only `destructive`: the
  // secrets construct is not looked for, so it is not reported and not raised.
  const fx = floorRoot(
    { review: { triggers: { risk_surface: { surfaces: ['destructive'] } } } },
    { '3/PLAN-1.md': ['src/load.mjs'] }, { 'src/load.mjs': SECRET_BODY });
  const r = resolve('cad-executor', fx.file, ['--phase', '3']);
  assert.deepEqual(effects(r), ['advisory', 'off']);
  assert.deepEqual(r.surfaces, ['destructive']);
});

test('floor: a declared file that does not exist yet still evidences by PATH', () => {
  // The create-a-file plan: no body to read, and the path is still a
  // declaration. `src/auth/session.rs` is written by nothing here.
  const fx = floorRoot({ review: { triggers: { risk_surface: { surfaces: ['auth'] } } } },
    { '3/PLAN-1.md': ['src/auth/session.rs'] });
  const r = resolve('cad-executor', fx.file, ['--phase', '3']);
  assert.deepEqual(effects(r), ['blocking', 'on']);
  assert.match(floorReasons(r)[0], /src\/auth\/session\.rs touches auth \(path segment auth\)/);
});

// --- the discount is a claim the scope was READ (risk_surface round 1) --------
//
// Both tests below pin findings a cross-model `risk_surface` review raised
// against this phase's own first commit range and adjudication confirmed. The
// shared defect: `read` measured PLAN readability only, so a plan that parsed
// perfectly while declaring a source file nobody could open discounted the
// whole scope on evidence that was never gathered.

test('floor: an OVERSIZED declared body withholds the discount rather than reading as clean', () => {
  // 513 KiB clears MAX_BODY_BYTES, so the body is skipped - and the construct
  // inside it is therefore never seen. Before the fix that returned a bare
  // path, indistinguishable from a file the plan had yet to write, and the
  // scope discounted to solo on a file nobody had opened.
  const body = `const x = ${'JSON'}.${'parse'}(input);\n` + 'y\n'.repeat(300 * 1024);
  const fx = floorRoot({ ...ANSWERED },
    { '3/PLAN-1.md': ['src/big.mjs'] }, { 'src/big.mjs': body });
  const r = resolve('cad-executor', fx.file, ['--phase', '3']);
  assert.equal(r.ok, true);
  // RAISED, not passed as clean: nothing was proved, so the floor fails closed.
  assert.deepEqual(effects(r), ['blocking', 'on']);
  assert.ok((r.warnings || []).some((w) => /^risk floor: phase 3 declares src\/big\.mjs, unread \(body over \d+ bytes\)/.test(w)),
    JSON.stringify(r.warnings));
  assert.ok(floorReasons(r).some((x) => /1 declared file in phase 3 went unread/.test(x)),
    JSON.stringify(r.reason));
});

test('floor: a declared path that is not a REGULAR file is refused unopened and terminates', () => {
  // The bounded-I/O escape: `statSync` follows a symlink, and a link to a
  // character device reports size 0, so the byte bound passed and the read ran
  // on a stream with no EOF. `lstatSync` + isFile() is the check on what the
  // path RESOLVES to, which the lexical absolute/`..` check cannot make.
  if (!existsSync('/dev/zero')) return; // not a Linux/BSD host
  const fx = floorRoot({ ...ANSWERED }, { '3/PLAN-1.md': ['src/link.mjs'] });
  mkdirSync(join(fx.repo, 'src'), { recursive: true });
  symlinkSync('/dev/zero', join(fx.repo, 'src/link.mjs'));
  // Reaching this assertion AT ALL is half the test: before the fix the
  // resolve read /dev/zero to an EOF that never comes.
  const r = resolve('cad-executor', fx.file, ['--phase', '3']);
  assert.equal(r.ok, true);
  assert.deepEqual(effects(r), ['blocking', 'on']);
  assert.ok((r.warnings || []).some((w) => /^risk floor: phase 3 declares src\/link\.mjs, unread \(not a regular file\)/.test(w)),
    JSON.stringify(r.warnings));
});

test('floor: a declared path through a symlinked PARENT is refused at the repository boundary', () => {
  // `lstatSync` declines to follow only the FINAL component, so a symlinked
  // DIRECTORY put the read in another tree while the declared spelling stayed
  // repo-relative and clean - and this function's own claim, that a `--file`
  // pointed elsewhere cannot read this tree's files, was untrue for any
  // repository whose layout carries such a link.
  const outside = mkdtempSync(join(tmpdir(), 'cad-route-outside-'));
  // Given a body on an ANSWERED surface on purpose: if these bytes were read,
  // the resolve would raise and cite them, so the silence below is a proof.
  writeFileSync(join(outside, 'load.mjs'), SECRET_BODY);
  const fx = floorRoot({ ...ANSWERED }, { '3/PLAN-1.md': ['vendor/linked/load.mjs'] });
  mkdirSync(join(fx.repo, 'vendor'), { recursive: true });
  symlinkSync(outside, join(fx.repo, 'vendor', 'linked'));
  const r = resolve('cad-executor', fx.file, ['--phase', '3']);
  assert.equal(r.ok, true);
  assert.deepEqual(effects(r), ['blocking', 'on'], 'a body outside the tree passed as read');
  assert.ok((r.warnings || []).some((w) =>
    /^risk floor: phase 3 declares vendor\/linked\/load\.mjs, unread \(path resolves outside the repository\)/.test(w)),
  JSON.stringify(r.warnings));
  assert.ok(floorReasons(r).some((x) => /1 declared file in phase 3 went unread/.test(x)),
    JSON.stringify(r.reason));
  // Nothing was raised from the outside file's contents - the body never
  // reached the content pass at all.
  assert.deepEqual(floorReasons(r).filter((x) => /touches \w+ \(/.test(x)), []);
});

test('floor: an ordinary NESTED path is still read and still raises', () => {
  // The paired positive. Without it the boundary check above is satisfied by one
  // that refuses every declared body in the tree.
  const fx = floorRoot({ ...ANSWERED }, { '3/PLAN-1.md': ['src/deep/nest/load.mjs'] },
    { 'src/deep/nest/load.mjs': SECRET_BODY });
  const r = resolve('cad-executor', fx.file, ['--phase', '3']);
  assert.equal(r.ok, true);
  assert.deepEqual(effects(r), ['blocking', 'on']);
  assert.match(floorReasons(r)[0], /src\/deep\/nest\/load\.mjs touches secrets/);
  assert.equal('warnings' in r, false, JSON.stringify(r.warnings));
});

test('floor: the two pre-plan roles are exempt and say they were not computed', () => {
  const fx = floorRoot({ ...ANSWERED },
    { '3/PLAN-1.md': ['src/load.mjs'] }, { 'src/load.mjs': SECRET_BODY });
  // The same phase raises both effects for an executor...
  assert.deepEqual(effects(resolve('cad-executor', fx.file, ['--phase', '3'])),
    ['blocking', 'on']);
  // ...and reaches neither role dispatched before a plan exists (D-16). The
  // cursor lags at both their call sites, so a floor computed for them is
  // computed off another phase's file list.
  for (const role of ['cad-planner', 'cad-assumptions-analyzer']) {
    const r = resolve(role, fx.file, ['--phase', '3']);
    assert.equal(r.ok, true, role);
    assert.deepEqual(effects(r), ['advisory', 'off'], role);
    assert.deepEqual(floorReasons(r), [], `${role}: ${JSON.stringify(r.reason)}`);
    assert.ok(r.reason.some((x) => x.startsWith(`no risk-floor computation: ${role}`)),
      `${role}: ${JSON.stringify(r.reason)}`);
  }
});

test('floor: a --file pointed at ANOTHER tree reads that tree\'s files, not this one\'s', () => {
  // The repo root is the planning root's PARENT, which is the whole of what
  // scopes the content pass. The fixture declares a path this repository really
  // does carry on a risk surface; under the fixture's own root it does not
  // exist, so nothing is read and nothing raises.
  const fx = floorRoot({ ...ANSWERED }, { '3/PLAN-1.md': ['cadence-core/bin/lib/config-merge.mjs'] });
  const r = resolve('cad-executor', fx.file, ['--phase', '3']);
  assert.deepEqual(effects(r), ['advisory', 'off']);
  assert.deepEqual(floorReasons(r).filter((x) => /touches \w+ \(/.test(x)), []);
});

// --- the floor fails CLOSED (AC5) --------------------------------------------
//
// Every row here asserts ok:true and BOTH effects raised. The direction is the
// whole point: `ok:false` drops the caller to the base agent at the host session
// default with no review at all, so a plan this cannot read may never refuse -
// and it may never pass as clean either, which is what raising means here.
// "Held at the configured level" was the old wording and has no meaning left.

/** A surfaceless plan, and the repo file it declares. */
const CLEAN_PLAN = ['docs/README.md'];
const CLEAN_FILES = { 'docs/README.md': '# Readme\n' };

test('fail-closed: an absent phase directory raises both effects', () => {
  const fx = floorRoot({ ...ANSWERED }, {}, CLEAN_FILES);
  const r = resolve('cad-executor', fx.file, ['--phase', '3']);
  assert.equal(r.ok, true);
  assert.deepEqual(effects(r), ['blocking', 'on']);
  assert.ok(floorReasons(r).some((x) => /holds no plan file this could read/.test(x)),
    JSON.stringify(r.reason));
  assert.ok(floorReasons(r).some((x) => /no surface could be computed/.test(x)),
    JSON.stringify(r.reason));
  // An absent phase directory is the ordinary pre-plan state, so it is said in
  // `reason` and NOT warned about - warning would fire on every dispatch of
  // every project that has not planned its next phase yet.
  assert.equal('warnings' in r, false, JSON.stringify(r.warnings));
});

test('fail-closed: a phase directory with no PLAN file is the same arm', () => {
  const fx = floorRoot({ ...ANSWERED }, { '3/CONTEXT.md': '# Context\n' }, CLEAN_FILES);
  const r = resolve('cad-executor', fx.file, ['--phase', '3']);
  assert.equal(r.ok, true);
  assert.deepEqual(effects(r), ['blocking', 'on']);
  assert.ok(floorReasons(r).some((x) => /holds no plan file this could read/.test(x)),
    JSON.stringify(r.reason));
});

test('fail-closed: a PLAN whose frontmatter is out of grammar holds the configured stakes', () => {
  const fx = floorRoot({ ...ANSWERED },
    { '3/PLAN-1.md': '---\nphase: 3\nplan: 1\nfiles:\n  - docs/README.md\n  not a key line\n---\n\n# Plan\n' },
    CLEAN_FILES);
  const r = resolve('cad-executor', fx.file, ['--phase', '3']);
  assert.equal(r.ok, true);
  assert.deepEqual(effects(r), ['blocking', 'on']);
  // The `files:` list PARSES here - the grammar rejects the plan, and the paths
  // it did read are dropped with it rather than half-trusted.
  assert.ok((r.warnings || []).some((w) => /^risk floor: .*out of grammar/.test(w)),
    JSON.stringify(r.warnings));
  assert.ok(floorReasons(r).some((x) => /1 of 1 plan in phase 3 could not be read/.test(x)),
    JSON.stringify(r.reason));
});

test('fail-closed: a PLAN whose file mode makes it unreadable holds the configured stakes', () => {
  // A DIRECTORY at the plan's own name: `readFileSync` fails EISDIR for any uid,
  // where a chmod is silently a no-op under a root test runner and would let this
  // pass without proving anything (traceRoot's `breakTrace` states the same rule).
  const fx = floorRoot({ ...ANSWERED }, {}, CLEAN_FILES);
  mkdirSync(join(fx.planning, 'phases', '3', 'PLAN-1.md'), { recursive: true });
  const r = resolve('cad-executor', fx.file, ['--phase', '3']);
  assert.equal(r.ok, true);
  assert.deepEqual(effects(r), ['blocking', 'on']);
  // EITHER spelling, because the CONTRACT is the arm and not the errno: the
  // pre-read `lstatSync` guard refuses a directory as a non-regular entry before
  // `readFileSync` ever reaches EISDIR. Both land the same plan on the same
  // unread arm, which is what holds the configured stakes.
  assert.ok((r.warnings || []).some(
    (w) => /^risk floor: cannot read .*PLAN-1\.md \((EISDIR|not a regular file)\)/.test(w)),
  JSON.stringify(r.warnings));
});

test('fail-closed: ONE unreadable plan holds a whole two-plan scope up (the aggregation rule)', () => {
  // The mixed phase, which is what the rule exists for: the clean plan touches
  // nothing, and its silence is not evidence about the sibling nobody could read.
  const fx = floorRoot({ ...ANSWERED }, { '3/PLAN-1.md': CLEAN_PLAN }, CLEAN_FILES);
  mkdirSync(join(fx.planning, 'phases', '3', 'PLAN-2.md'), { recursive: true });
  const r = resolve('cad-executor', fx.file, ['--phase', '3']);
  assert.equal(r.ok, true);
  assert.deepEqual(effects(r), ['blocking', 'on']);
  assert.ok(floorReasons(r).some((x) => /1 of 2 plans in phase 3 could not be read/.test(x)),
    JSON.stringify(r.reason));
});

test('fail-closed: the paired POSITIVE - both plans clean and surfaceless raises nothing', () => {
  // Without this row the five above are satisfied by a floor that raises on
  // everything it is ever handed.
  const fx = floorRoot({ ...ANSWERED },
    { '3/PLAN-1.md': CLEAN_PLAN, '3/PLAN-2.md': ['docs/GUIDE.md'] },
    { ...CLEAN_FILES, 'docs/GUIDE.md': '# Guide\n' });
  const r = resolve('cad-executor', fx.file, ['--phase', '3']);
  assert.equal(r.ok, true);
  assert.deepEqual(effects(r), ['advisory', 'off']);
  assert.ok(floorReasons(r).some((x) => /2 plans read clean/.test(x)), JSON.stringify(r.reason));
  assert.equal('warnings' in r, false, JSON.stringify(r.warnings));
});

// --- what a TEMPLATE-INITIALISED project actually resolves to (RNG-04) -------
//
// Every fixture above hands `floorRoot` a hand-written config, which proves the
// resolver's arithmetic and says nothing about the file `/cad-new-project` and
// `/cad-adopt` copy onto disk. This row closes that gap by making the shipped
// template ITSELF the fixture config, so it reddens if the template ever pins
// `stakes` again rather than leaving the level to the resolver.

test('template-initialised: a repo scaffolded from the SHIPPED template reaches both arms', () => {
  const template = JSON.parse(readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '..', 'templates', 'config.json'), 'utf8'));
  // No ANSWERED overlay: the template writes no `review.triggers` block, so a
  // template-initialised project carries all eight categories at
  // `surfaces_answered: false`. Overlaying an answered set would test a project
  // this template does not produce.

  // Arm one - every plan in the phase read clean and declared a file touching
  // no surface, so nothing is raised.
  const clean = floorRoot(template, { '3/PLAN-1.md': CLEAN_PLAN }, CLEAN_FILES);
  const rc = resolve('cad-executor', clean.file, ['--phase', '3']);
  assert.equal(rc.ok, true);
  assert.deepEqual(effects(rc), ['advisory', 'off'], JSON.stringify(rc.reason));

  // Arm two - the same phase with one plan nobody can read, as a DIRECTORY at
  // the plan's own name for the reason the file-mode row above states. The
  // warning naming that plan is expected here and is part of what fail-closed
  // means, so this arm asserts the effects and never an empty `warnings`.
  const broken = floorRoot(template, { '3/PLAN-1.md': CLEAN_PLAN }, CLEAN_FILES);
  mkdirSync(join(broken.planning, 'phases', '3', 'PLAN-2.md'), { recursive: true });
  const rb = resolve('cad-executor', broken.file, ['--phase', '3']);
  assert.equal(rb.ok, true, JSON.stringify(rb));
  assert.deepEqual(effects(rb), ['blocking', 'on'], JSON.stringify(rb.reason));
});

// --- a scope that declared NOTHING proves nothing (UAT item 11) --------------
//
// The same argument as the rows above, one step further in: `found` and `clean`
// are satisfied by a plan that parsed perfectly and named no file at all, so the
// floor scanned zero bytes and reported it as a clean read. Absence of evidence
// reported as absence of surface.

test('declared-nothing: a plan with an EMPTY files: list does not pass as clean', () => {
  const fx = floorRoot({ ...ANSWERED }, { '3/PLAN-1.md': [] }, CLEAN_FILES);
  const r = resolve('cad-executor', fx.file, ['--phase', '3']);
  assert.equal(r.ok, true);
  assert.deepEqual(effects(r), ['blocking', 'on']);
  // The warning names the plan file, on the `risk floor: ` vocabulary route.mjs
  // relays verbatim, so a reader can see WHICH plan declared nothing.
  assert.ok((r.warnings || []).some((w) => /^risk floor: phase 3: .*PLAN-1\.md declares no files at all/.test(w)),
    JSON.stringify(r.warnings));
  // ...and the reason says which of the two sentences this is. "Declaring
  // nothing that touches [...]" is the CLEAN sentence and would claim a scope
  // nobody looked at had been read.
  const said = floorReasons(r);
  assert.ok(said.some((x) => /1 of 1 plan in phase 3 declared no files at all/.test(x)),
    JSON.stringify(r.reason));
  assert.equal(said.some((x) => /declaring nothing that touches/.test(x)), false,
    JSON.stringify(r.reason));
});

test('declared-nothing: a plan with NO files: key at all takes the same arm', () => {
  const fx = floorRoot({ ...ANSWERED },
    { '3/PLAN-1.md': '---\nphase: 3\nplan: 1\n---\n\n# Plan\n' }, CLEAN_FILES);
  const r = resolve('cad-executor', fx.file, ['--phase', '3']);
  assert.deepEqual(effects(r), ['blocking', 'on']);
  assert.ok(floorReasons(r).some((x) => /declared no files at all/.test(x)),
    JSON.stringify(r.reason));
});

test('declared-nothing: the UAT probe verbatim - the SHIPPED template plus a task Files: line', () => {
  // Reproduced from the template this project actually ships, read here rather
  // than retyped: `files:` arrives with no items, and D-05 keeps the task prose
  // out of the floor, so the probe scans nothing while LOOKING fully declared.
  // It returned verify off and the plan gate down to advisory on a plan whose
  // one task names a secrets file.
  const template = readFileSync(join(dirname(ROUTE), '..', 'templates', 'PLAN.md'), 'utf8');
  const body = `${template}\n### Task 1\n\n- **Files:** src/load.mjs\n`;
  const fx = floorRoot({ ...ANSWERED }, { '3/PLAN-1.md': body },
    { 'src/load.mjs': SECRET_BODY });
  const r = resolve('cad-executor', fx.file, ['--phase', '3']);
  assert.equal(r.ok, true);
  assert.deepEqual(effects(r), ['blocking', 'on']);
  assert.equal(floorReasons(r).some((x) => /read clean, declaring nothing/.test(x)), false,
    JSON.stringify(r.reason));
});

test('declared-nothing: ONE silent plan holds a two-plan scope up, like an unreadable one', () => {
  // The mixed phase again. PLAN-1 declares a real surfaceless file and PLAN-2
  // declares none, and the scope is not discountable - a plan that named nothing
  // is not evidence about the phase, exactly as an unreadable one is not.
  const fx = floorRoot({ ...ANSWERED },
    { '3/PLAN-1.md': CLEAN_PLAN, '3/PLAN-2.md': [] }, CLEAN_FILES);
  const r = resolve('cad-executor', fx.file, ['--phase', '3']);
  assert.deepEqual(effects(r), ['blocking', 'on']);
  assert.ok(floorReasons(r).some((x) => /1 of 2 plans in phase 3 declared no files at all/.test(x)),
    JSON.stringify(r.reason));
});

test('declared-nothing: the model and the rung are untouched - this arm raises two things', () => {
  // The configured level and the role's model are not what this arm moves:
  // `critical` stays `critical` and `solo` stays `solo`, and the cells row each
  // names is what still supplies the model.
  for (const [stakes, model] of [['critical', 'opus'], ['solo', 'sonnet']]) {
    const fx = floorRoot({ stakes, ...ANSWERED }, { '3/PLAN-1.md': [] }, CLEAN_FILES);
    const r = resolve('cad-executor', fx.file, ['--phase', '3']);
    assert.equal(r.stakes, stakes, JSON.stringify(r.reason));
    assert.equal(r.model, model);
    assert.deepEqual(effects(r), ['blocking', 'on']);
  }
});

// --- --plan: an executor floors on the plan it was handed (D-06) -------------

/** A mixed phase: PLAN-1 surfaceless, PLAN-2 on an answered surface. */
const mixedPhase = () => floorRoot({ ...ANSWERED },
  { '3/PLAN-1.md': ['docs/README.md'], '3/PLAN-2.md': ['src/load.mjs'] },
  { 'docs/README.md': '# Readme\n', 'src/load.mjs': SECRET_BODY });

test('--plan: a clean plan in a mixed phase is NOT raised by its risky sibling', () => {
  const fx = mixedPhase();
  const clean = resolve('cad-executor', fx.file, ['--phase', '3', '--plan', '1']);
  assert.equal(clean.ok, true);
  assert.deepEqual(effects(clean), ['advisory', 'off']);
  assert.ok(floorReasons(clean).some((x) => /phase 3 plan 1 read clean/.test(x)),
    JSON.stringify(clean.reason));
});

test('--plan: the risky plan of the same phase, and the phase UNION, both raise', () => {
  const fx = mixedPhase();
  const risky = resolve('cad-executor', fx.file, ['--phase', '3', '--plan', '2']);
  assert.deepEqual(effects(risky), ['blocking', 'on']);
  assert.match(floorReasons(risky)[0], /^risk floor: phase 3 plan 2: src\/load\.mjs touches secrets/);
  // No --plan is the PHASE union, which is what a phase-scoped role resolves on:
  // one risky member raises the whole phase.
  const union = resolve('cad-executor', fx.file, ['--phase', '3']);
  assert.deepEqual(effects(union), ['blocking', 'on']);
  assert.match(floorReasons(union)[0], /^risk floor: phase 3: src\/load\.mjs touches secrets/);
});

test('--plan: a key naming no plan file fails CLOSED, never widening to the union', () => {
  // The wrong answer here is the WIDE one: silently answering about six plans a
  // caller did not ask about. It holds the configured stakes and says so.
  const fx = mixedPhase();
  const r = resolve('cad-executor', fx.file, ['--phase', '3', '--plan', '9']);
  assert.equal(r.ok, true);
  assert.deepEqual(effects(r), ['blocking', 'on']);
  assert.ok(floorReasons(r).some((x) => /phase 3 plan 9 names no plan file/.test(x)),
    JSON.stringify(r.reason));
  assert.ok((r.warnings || []).some((w) => /^risk floor: plan 9 names no plan file/.test(w)),
    JSON.stringify(r.warnings));
});

test('--plan: a bare flag and a bad value are both REFUSED', () => {
  // A valueless plan flag reading as absent would silently take the phase UNION
  // for a caller that asked about one plan - the wrong arm, and a wider one.
  const fx = mixedPhase();
  for (const extra of [['--phase', '3', '--plan'], ['--plan'],
    ['--phase', '3', '--plan', ''], ['--phase', '3', '--plan', ' 1']]) {
    const r = resolve('cad-executor', fx.file, extra);
    assert.equal(r.ok, false, extra.join(' '));
    assert.equal(r.reason, 'usage', `${extra.join(' ')}: ${JSON.stringify(r)}`);
    assert.match(r.detail, /--plan/);
  }
});

test('--plan: it is NOT --bracket-plan, which still keys the trace alone', () => {
  // `--bracket-plan` is the trace WORKER key and is the ROLE NAME for every
  // non-executor dispatch, so reading it as a floor key would make a
  // phase-scoped role indistinguishable from a plan key naming no file.
  const fx = mixedPhase();
  const r = resolve('cad-executor', fx.file,
    ['--phase', '3', '--bracket-read', 'PLAN-1.md', '--bracket-plan', '1']);
  // The floor still took the phase UNION, so the risky sibling raised it.
  assert.deepEqual(effects(r), ['blocking', 'on']);
  const dispatch = traceLines(fx.planning).find((e) => e.family === 'lifecycle');
  assert.equal(dispatch.plan, '1');
});

// --- lowering below the computed floor takes a named waiver (AC4) ------------
//
// The ONE way to route below the floor, and it is a NEW key inside
// `review.triggers.risk_surface` (D-03) - the eight `risk.override.<surface>`
// keys v2.0.0 retired stay retired, pinned byte-for-byte by
// retired-keys.test.mjs. It waives a LEVEL and never a REVIEW.

const WAIVER_KEY = 'review.triggers.risk_surface.waive_routing_floor';

/** The answered set, plus a waiver value written verbatim beside it. */
const waiving = (value) => ({ review: { triggers: { risk_surface: {
  surfaces: ['secrets', 'destructive', 'untrusted_input'],
  waive_routing_floor: value } } } });

// A destructive construct, assembled for the reason SECRET_BODY is: this file
// is read by the same detector.
const DESTRUCTIVE_BODY = `${'rm'} -${'rf'} ./build\n`;

/** A repo whose phase 3 declares one file carrying the given body. */
const waiverFx = (config, body = SECRET_BODY) => floorRoot(config,
  { '3/PLAN-1.md': ['src/load.mjs'] }, { 'src/load.mjs': body });

test('waiver: a waived surface raises neither effect', () => {
  // A scope that matched a surface it waived is not a scope that matched
  // nothing - the reason SAYS which key withheld the raise, because a silent
  // waiver is the shape every other arm of this seam exists to refuse.
  const fx = waiverFx(waiving(['secrets']));
  const r = resolve('cad-executor', fx.file, ['--phase', '3']);
  assert.equal(r.ok, true);
  assert.deepEqual(effects(r), ['advisory', 'off']);
  const said = floorReasons(r);
  assert.ok(said.some((x) => x.includes(WAIVER_KEY) && /secrets/.test(x)
    && /src\/load\.mjs/.test(x)), JSON.stringify(r.reason));
  assert.ok(said.some((x) => /every matched surface is waived/.test(x)),
    JSON.stringify(r.reason));
});

test('waiver: the same phase without the key raises both, and names the surface', () => {
  // The paired arm, and AC5's second sentence. Never an ok:false - that drops
  // the caller to the host session default with no review at all.
  const fx = waiverFx({ ...ANSWERED });
  const r = resolve('cad-executor', fx.file, ['--phase', '3']);
  assert.equal(r.ok, true);
  assert.deepEqual(effects(r), ['blocking', 'on']);
  assert.ok(floorReasons(r).some((x) => /touches secrets/.test(x)), JSON.stringify(r.reason));
});

test('waiver: the destructive surface, raised and then withheld by the key (AC5)', () => {
  // AC5 in its literal shape, on one fixture read twice: the phase's one plan
  // declares a file whose BODY matches `destructive`, so the raise rests on
  // content rather than on a path segment.
  const answered = ['secrets', 'destructive', 'untrusted_input'];
  const plans = { '3/PLAN-1.md': ['src/clean.sh'] };
  const files = { 'src/clean.sh': DESTRUCTIVE_BODY };
  const raised = floorRoot({ review: { triggers: { risk_surface: { surfaces: answered } } } },
    plans, files);
  const r = resolve('cad-executor', raised.file, ['--phase', '3']);
  assert.equal(r.ok, true);
  assert.deepEqual(effects(r), ['blocking', 'on']);
  assert.ok(r.reason.some((x) => /destructive/.test(x)), JSON.stringify(r.reason));

  // ...and the SAME role on a clean phase, which is what "model and effort do
  // not move" is measured against rather than against a literal typed here.
  const cleanFx = floorRoot({ review: { triggers: { risk_surface: { surfaces: answered } } } },
    plans, { 'src/clean.sh': '# nothing\n' });
  const c = resolve('cad-executor', cleanFx.file, ['--phase', '3']);
  assert.deepEqual(effects(c), ['advisory', 'off']);
  assert.equal(r.model, c.model);
  assert.equal(r.effort, c.effort);

  // Naming that surface in the waiver withholds BOTH effects.
  const waived = floorRoot({ review: { triggers: { risk_surface: {
    surfaces: answered, waive_routing_floor: ['destructive'] } } } }, plans, files);
  const w = resolve('cad-executor', waived.file, ['--phase', '3']);
  assert.equal(w.ok, true);
  assert.deepEqual(effects(w), ['advisory', 'off']);
  assert.ok(floorReasons(w).some((x) => x.includes(WAIVER_KEY) && /destructive/.test(x)),
    JSON.stringify(w.reason));
});

test('waiver: it withholds the raise and NOT the review - the gate key is untouched', () => {
  // The key waives a ROUTING floor and never a review, which is why the name
  // says `routing`: the blocking commit-time risk_surface gate still fires.
  const fx = waiverFx(waiving(['secrets']));
  const r = resolve('cad-executor', fx.file, ['--phase', '3']);
  assert.equal(r.review.risk_surface, 'blocking');
});

test('waiver: naming a DIFFERENT surface than the one matched waives nothing', () => {
  const fx = waiverFx({ stakes: 'solo', ...waiving(['destructive']) });
  const r = resolve('cad-executor', fx.file, ['--phase', '3']);
  assert.deepEqual(effects(r), ['blocking', 'on']);
  assert.match(floorReasons(r)[0], /touches secrets/);
});

test('waiver: when the top match is waived, the next UNWAIVED match still raises', () => {
  const fx = waiverFx({ stakes: 'solo', ...waiving(['secrets']) },
    SECRET_BODY + DESTRUCTIVE_BODY);
  const r = resolve('cad-executor', fx.file, ['--phase', '3']);
  assert.deepEqual(effects(r), ['blocking', 'on'], 'waiving one surface is not waiving the floor');
  const said = floorReasons(r);
  assert.ok(said.some((x) => /secrets/.test(x) && x.includes(WAIVER_KEY)),
    JSON.stringify(r.reason));
  assert.ok(said.some((x) => /touches destructive/.test(x)
    && /raised to blocking/.test(x)), JSON.stringify(r.reason));
});

test('waiver: a value outside the eight categories rides warnings and waives nothing', () => {
  const bad = waiverFx({ stakes: 'solo', ...waiving(['not_a_surface']) });
  const r = resolve('cad-executor', bad.file, ['--phase', '3']);
  assert.deepEqual(effects(r), ['blocking', 'on']);
  assert.ok((r.warnings || []).some((w) => w.includes(WAIVER_KEY) && /not_a_surface/.test(w)),
    JSON.stringify(r.warnings));
  // ...and a value that is not a list at all takes the same arm.
  const scalar = waiverFx({ stakes: 'solo', ...waiving('secrets') });
  const sc = resolve('cad-executor', scalar.file, ['--phase', '3']);
  assert.deepEqual(effects(sc), ['blocking', 'on']);
  assert.ok((sc.warnings || []).some((w) => w.includes(WAIVER_KEY) && /is not a list/.test(w)),
    JSON.stringify(sc.warnings));
});

test('waiver: a waived scope that ALSO failed to read still raises - the fail-closed arm wins', () => {
  // The waiver speaks about a surface that was PROVED. A scope nobody could
  // read proved nothing, so there is nothing for the key to waive.
  const fx = floorRoot(waiving(['secrets']), { '3/PLAN-1.md': [] }, {});
  const r = resolve('cad-executor', fx.file, ['--phase', '3']);
  assert.deepEqual(effects(r), ['blocking', 'on']);
});

// --- the floor moves NO rung and NO model (D-03) -----------------------------
//
// The clamp this section used to hold - a raised level flooring a configured
// rung up to the raised cell's - retires with the level. There is no raised ROW
// for a rung to be clamped against, so the arm became unreachable rather than
// merely unused, and these rows are the paired assertion that it is gone: a
// user's dial survives a detected surface.

/** A repo whose phase 3 declares a secrets-carrying file, plus a pinned rung. */
const clampFx = (extra, plan = ['src/load.mjs']) => floorRoot(
  { model: { effort: { 'cad-plan-checker': 'low' } }, ...ANSWERED, ...extra },
  { '3/PLAN-1.md': plan },
  { 'src/load.mjs': SECRET_BODY, 'docs/README.md': '# Readme\n' });

test('no clamp: a raised floor leaves the configured rung exactly where it was', () => {
  const fx = clampFx({});
  const r = resolve('cad-plan-checker', fx.file, ['--phase', '3']);
  assert.deepEqual(effects(r), ['blocking', 'on']);
  assert.equal(r.effort, 'low', 'the configured rung, not the cell\'s');
  assert.equal(r.agent, 'cad-plan-checker');
  assert.deepEqual(r.reason.filter((x) => /does not apply/.test(x)), []);
});

test('no clamp: the same rung on a surfaceless phase - the two are indistinguishable', () => {
  // The paired negative: if the row above passed because the rung happened to
  // match, this one would disagree with it.
  const raised = resolve('cad-plan-checker', clampFx({}).file, ['--phase', '3']);
  const clean = resolve('cad-plan-checker', clampFx({}, ['docs/README.md']).file, ['--phase', '3']);
  assert.deepEqual(effects(clean), ['advisory', 'off']);
  assert.equal(raised.effort, clean.effort);
  assert.equal(raised.agent, clean.agent);
  assert.equal(raised.model, clean.model);
});

test('no clamp: a ROLES-block rung survives a raised floor too', () => {
  const fx = floorRoot(
    { roles: { 'cad-plan-checker': { effort: 'low' } }, ...ANSWERED },
    { '3/PLAN-1.md': ['src/load.mjs'] },
    { 'src/load.mjs': SECRET_BODY, 'docs/README.md': '# Readme\n' });
  const r = resolve('cad-plan-checker', fx.file, ['--phase', '3']);
  assert.deepEqual(effects(r), ['blocking', 'on']);
  assert.equal(r.effort, 'low');
  assert.match(r.reason.join(' '), /roles\.cad-plan-checker\.effort: medium -> low/);
});

test('no clamp: a pre-plan role is untouched, floor or no floor', () => {
  const fx = floorRoot(
    { stakes: 'critical', model: { effort: { 'cad-planner': 'high' } }, ...ANSWERED },
    { '3/PLAN-1.md': ['src/load.mjs'] }, { 'src/load.mjs': SECRET_BODY });
  const r = resolve('cad-planner', fx.file, ['--phase', '3']);
  assert.equal(r.stakes, 'critical');
  assert.equal(r.effort, 'high');
  assert.deepEqual(effects(r), ['advisory', 'off']);
});

// --- `replay` is gone --------------------------------------------------------

test('replay: the subcommand is refused as usage, and the synopsis names it no more', () => {
  // D-14: it had no prose caller and orphaned no shared helper. The refusal is
  // the ordinary unknown-subcommand one, so a caller still holding the spelling
  // is told what the tool does take rather than crashing.
  const env = { ...process.env, CADENCE_GLOBAL_CONFIG: NO_GLOBAL };
  const r = (() => {
    try { return JSON.parse(execFileSync('node', [ROUTE, 'replay'], { encoding: 'utf8', env })); }
    catch (e) { return JSON.parse(e.stdout); }
  })();
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'usage');
  assert.equal(/replay/.test(r.detail), false, r.detail);
});
