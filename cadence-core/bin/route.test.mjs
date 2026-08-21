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
import { RUNG_FILES, rungFile, rungFiles } from './lib/rung-agent.mjs';
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
// point CADENCE_GLOBAL_CONFIG at a real global file for merge tests, and
// opts.table to inject a route table through CADENCE_ROUTE_TABLE. That
// injection is gated: route.mjs reads CADENCE_ROUTE_TABLE only when
// CADENCE_TEST_SEAM is exactly `1`, so every fixture that sets the path sets
// the sentinel beside it (lib/test-seam.mjs).
function resolve(role, file, extra = [], opts = {}) {
  const args = ['resolve', '--role', role, ...(file ? ['--file', file] : []), ...extra];
  const env = { ...process.env, CADENCE_GLOBAL_CONFIG: opts.global || NO_GLOBAL };
  if (opts.table) { env.CADENCE_ROUTE_TABLE = opts.table; env.CADENCE_TEST_SEAM = '1'; }
  try {
    return JSON.parse(execFileSync('node', [ROUTE, ...args], { encoding: 'utf8', env }));
  } catch (e) {
    // Degraded results exit 1 (seam convention); the JSON line is on stdout.
    return JSON.parse(e.stdout);
  }
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

// --- the review and verify grids (D-01) --------------------------------------

test('each level resolves its whole review map and its verify value, literally', () => {
  // Literal expectations, never derived from route-table.json: a fixture that
  // reads its own subject cannot fail (D-11).
  const solo = resolve('cad-planner', cfg({ stakes: 'solo' }));
  assert.deepEqual(solo.review, {
    plan: 'advisory', diff: 'off', risk_surface: 'blocking',
    phase_diff: 'off',
  });
  assert.equal(solo.verify, 'off');

  const shipped = resolve('cad-planner', cfg({ stakes: 'shipped' }));
  assert.deepEqual(shipped.review, {
    plan: 'blocking', diff: 'off', risk_surface: 'blocking',
    phase_diff: 'off',
  });
  assert.equal(shipped.verify, 'on');

  const critical = resolve('cad-planner', cfg({ stakes: 'critical' }));
  assert.deepEqual(critical.review, {
    plan: 'adjudicated', diff: 'blocking', risk_surface: 'blocking',
    phase_diff: 'adjudicated',
  });
  assert.equal(critical.verify, 'on');
});

test('risk_surface is blocking at every level - a detection match is never waved through', () => {
  for (const stakes of ['solo', 'shipped', 'critical']) {
    assert.equal(resolve('cad-planner', cfg({ stakes })).review.risk_surface, 'blocking', stakes);
  }
});

test('a config gate that AGREES with the level is taken silently', () => {
  const c = rawCfg({ stakes: 'shipped', review: { triggers: { phase_diff: { gate: 'off' } } } },
    'gate-agrees.json');
  const r = resolve('cad-planner', c);
  assert.equal(r.review.phase_diff, 'off');
  assert.equal(r.warnings, undefined); // agreement is not news
});

test('a config gate that DISAGREES wins, and says so exactly once (D-04)', () => {
  // solo's `diff` gate is `off`; the user asked for blocking. The key the user
  // set decides - a resolved-then-dropped gate is the defect class this
  // milestone closes - and the disagreement is spoken, not swallowed.
  const c = rawCfg({ stakes: 'solo', review: { triggers: { diff: { gate: 'blocking' } } } },
    'gate-disagrees.json');
  const r = resolve('cad-planner', c);
  assert.equal(r.review.diff, 'blocking');
  assert.equal(r.warnings.length, 1);
  assert.match(r.warnings[0], /review\.triggers\.diff\.gate/); // names the trigger
  assert.match(r.warnings[0], /"blocking"/);                   // ...the config value
  assert.match(r.warnings[0], /"off"/);                        // ...and the level's
  // every other trigger still comes from the level
  assert.equal(r.review.plan, 'advisory');
  assert.equal(r.review.risk_surface, 'blocking');
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
  assert.match(plan, /openai/);                                  // the provider dropped
  assert.match(plan, /"balanced"/);                              // ...the tier it needed
  assert.match(plan, /review\.providers\.openai\.tiers\.balanced/); // ...the key that answers it
  assert.match(plan, /claude-subagent/);                         // ...and the fallback
  // The tier is per trigger AND per level, so the answer is too: at `shipped`
  // `diff` resolves at the `cheap` row, not at plan's `balanced`, and the
  // warning names the level's row it came from (RVW-03).
  assert.match(r.warnings.find((w) => w.startsWith('diff:')), /"cheap"/);
  assert.match(plan, /tiers row for shipped/);
});

test('a provider WITH a model id at that tier is the resolved reviewer', () => {
  // `shipped` resolves `plan` and `risk_surface` at `balanced` since RVW-03,
  // so that is the tier this provider has to be configured at to be placed.
  const c = rawCfg({
    stakes: 'shipped',
    review: { reviewers: ['openai'], providers: { openai: { tiers: { balanced: 'gpt-5' } } } },
  }, 'reviewers-available.json');
  const r = resolve('cad-reviewer', c);
  assert.deepEqual(r.reviewers.plan, ['openai']);
  assert.deepEqual(r.reviewers.risk_surface, ['openai']); // balanced too
  // `diff` resolves at `cheap` here, which this config leaves unassigned.
  assert.deepEqual(r.reviewers.diff, ['claude-subagent']);
});

test('a config-set tier wins over the table row for the availability test (D-04)', () => {
  // The tier a LAYER set is a user assertion; the table's row is the fallback.
  // Reading config.schema.json's default here instead would make the schema's
  // answer indistinguishable from the user's.
  const c = rawCfg({
    stakes: 'shipped',
    review: {
      reviewers: ['openai'],
      providers: { openai: { tiers: { cheap: 'gpt-5-mini' } } },
      triggers: { plan: { tier: 'cheap' } },
    },
  }, 'reviewers-tier-set.json');
  const r = resolve('cad-reviewer', c);
  assert.deepEqual(r.reviewers.plan, ['openai']);
  assert.deepEqual(r.reviewers.phase_diff, ['claude-subagent']); // still flagship, unassigned
  assert.match(r.warnings.find((w) => w.startsWith('phase_diff:')), /tiers row/);
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
    plan: 'adjudicated', diff: 'blocking', risk_surface: 'blocking',
    phase_diff: 'adjudicated',
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
    plan: 'adjudicated', diff: 'blocking', risk_surface: 'blocking',
    phase_diff: 'adjudicated',
  });
  assert.deepEqual(Object.keys(r.review), Object.keys(r.reviewers));
  assert.deepEqual(r.surfaces, ['secrets']);
});

test('a level with no review row or no verify value degrades to unresolved', () => {
  // A torn table must not emit half a bundle: two of the four knobs read as a
  // whole answer is worse than no answer.
  for (const drop of ['review', 'verify']) {
    const t = JSON.parse(JSON.stringify(SHIPPED_TABLE));
    delete t[drop].shipped;
    const p = join(dir, `torn-${drop}.json`);
    writeFileSync(p, JSON.stringify(t));
    const env = { ...process.env, CADENCE_GLOBAL_CONFIG: NO_GLOBAL, CADENCE_ROUTE_TABLE: p,
      CADENCE_TEST_SEAM: '1' };
    const args = ['resolve', '--role', 'cad-planner', '--file', cfg({ stakes: 'shipped' })];
    const r = (() => {
      try { return JSON.parse(execFileSync('node', [ROUTE, ...args], { encoding: 'utf8', env })); }
      catch (e) { return JSON.parse(e.stdout); }
    })();
    assert.equal(r.ok, false, drop);
    assert.equal(r.reason, 'unresolved', drop);
  }
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

// WATCHED FAILING AT 478b1ff, the tip of this plan's unpatched tree. Observed
// there: `resolve` carried no `reviewer_tiers` and no `reviewer_efforts` at
// all, and the one `tiers` row it did read was keyed on the trigger alone, so
// every level answered `flagship` for `plan` and `risk_surface` - the
// cross-model half of a panel that never moved when `stakes` did (RVW-03).
//
// HAND-WRITTEN DATA, typed out from .planning/phases/3/CONTEXT.md and this
// plan's own ladder, never read or derived from cadence-core/route-table.json:
// that file is the subject under test.
const PANEL = [
  { stakes: 'solo', plan: ['cheap', 'low'], risk_surface: ['cheap', 'low'] },
  { stakes: 'shipped', plan: ['balanced', 'medium'], risk_surface: ['balanced', 'medium'] },
  { stakes: 'critical', plan: ['flagship', 'high'], risk_surface: ['flagship', 'high'] },
];

// ONE case per level, never one case walking all three: node:test aborts a case
// at its first throwing assertion, so a single case would report one failure and
// skip the levels below it.
for (const row of PANEL) {
  test(`the cross-model panel at ${row.stakes}: both halves ride the envelope`, () => {
    const r = resolve('cad-reviewer', cfg({ stakes: row.stakes }, `panel-${row.stakes}.json`));
    assert.equal(r.ok, true);
    assert.equal(r.reviewer_tiers.plan, row.plan[0], 'plan tier');
    assert.equal(r.reviewer_efforts.plan, row.plan[1], 'plan effort');
    assert.equal(r.reviewer_tiers.risk_surface, row.risk_surface[0], 'risk_surface tier');
    assert.equal(r.reviewer_efforts.risk_surface, row.risk_surface[1], 'risk_surface effort');
    // Beside `reviewers`, keyed the same way, and never folded into `review`
    // (D-05) - whose values stay gate strings.
    assert.deepEqual(Object.keys(r.reviewer_tiers), Object.keys(r.reviewers));
    assert.deepEqual(Object.keys(r.reviewer_efforts), Object.keys(r.reviewers));
    assert.equal(typeof r.review.plan, 'string');
  });
}

test('the three levels are pairwise distinct on BOTH halves of the panel', () => {
  // The requirement in one assertion: raising `stakes` has to move the tier AND
  // the effort, so no two levels may answer the same pair for these triggers.
  for (const trigger of ['plan', 'risk_surface']) {
    const seen = PANEL.map((row) => {
      const r = resolve('cad-reviewer', cfg({ stakes: row.stakes }, `panel-${row.stakes}.json`));
      return `${r.reviewer_tiers[trigger]}/${r.reviewer_efforts[trigger]}`;
    });
    assert.equal(new Set(seen).size, 3, `${trigger}: ${seen.join(' ')}`);
  }
});

test('the envelope\'s top-level effort stays the agent RUNG, not the panel effort', () => {
  // The one real collision hazard: `effort` is the rung the dispatched agent
  // file runs at, `reviewer_efforts` is what a provider request carries. At
  // solo/cad-reviewer the rung is `medium` and the panel effort is `low`.
  const r = resolve('cad-reviewer', cfg({ stakes: 'solo' }, 'panel-solo.json'));
  assert.equal(r.effort, 'medium');
  assert.equal(r.reviewer_efforts.plan, 'low');
});

test('a config-set effort wins over the level\'s efforts row, like the tier', () => {
  const c = rawCfg({
    stakes: 'solo',
    review: { triggers: { plan: { effort: 'high' }, risk_surface: { tier: 'flagship' } } },
  }, 'panel-configured.json');
  const r = resolve('cad-reviewer', c);
  assert.equal(r.reviewer_efforts.plan, 'high');       // the layer's value
  assert.equal(r.reviewer_tiers.plan, 'cheap');        // ...and only that field
  assert.equal(r.reviewer_tiers.risk_surface, 'flagship');
  assert.equal(r.reviewer_efforts.risk_surface, 'low'); // the solo row still
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
  assert.equal(r.reviewer_efforts.risk_surface, 'medium'); // shipped row stands
  assert.equal(r.reviewer_efforts.plan, 'medium');
  assert.equal(r.reviewer_tiers.plan, 'balanced');
  const w = (r.warnings || []).join('\n');
  assert.match(w, /review\.triggers\.risk_surface\.effort/);
  assert.match(w, /review\.triggers\.plan\.effort/);
  assert.match(w, /review\.triggers\.plan\.tier/);
});

test('a table with no efforts row for the level answers null, never a dropped key', () => {
  // route.mjs fails OPEN on a torn table: the trigger still appears in both
  // maps with an honest null, so a fire site indexing them cannot mistake "no
  // answer" for "no such trigger". A missing row is CI's problem (check 8).
  const t = join(dir, 'no-efforts-row.json');
  const shipped = JSON.parse(readFileSync(join(dirname(ROUTE), '..', 'route-table.json'), 'utf8'));
  delete shipped.efforts.solo;
  writeFileSync(t, JSON.stringify(shipped));
  const r = resolve('cad-reviewer', cfg({ stakes: 'solo' }, 'panel-solo.json'), [], { table: t });
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
  assert.equal(planner.effort, 'high');   // effort is frontmatter, untouched
  assert.match(planner.reason.join(' '), /override cad-planner: opus -> fable/);
  // a sibling role is unaffected
  const exec = resolve('cad-executor', c);
  assert.equal(exec.model, 'opus');       // the shipped/cad-executor cell
  assert.equal(exec.pinned, false);
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
  // ...and the other direction: a rung file RUNG_FILES names that no cell can
  // reach is standing context nothing dispatches.
  const named = new Set([...byName.keys()]);
  for (const role of Object.keys(RUNG_FILES)) {
    for (const stem of rungFiles(role)) {
      assert.ok(named.has(stem), `agents/${stem}.md is named by no cell`);
    }
  }
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

test('a config gate outside the four values loses to the level gate, and says so', () => {
  // The CONTEXT-cited repro: today this resolved ok:true carrying "blockign",
  // silently replacing critical's deliberately-blocking risk_surface gate.
  const c = rawCfg({ stakes: 'critical', review: { triggers: { risk_surface: { gate: 'blockign' } } } },
    'gate-typo.json');
  const r = resolve('cad-reviewer', c);
  assert.equal(r.ok, true);
  assert.equal(r.review.risk_surface, 'blocking'); // the LEVEL's gate stands
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
    assert.equal(r.review.diff, 'blocking', label); // critical's own diff gate
    assert.equal(r.warnings.length, 1, `${label}: ${JSON.stringify(r.warnings)}`);
    assert.match(r.warnings[0], /review\.triggers\.diff\.gate/, label);
  }
});

test('a VALID disagreeing gate still wins - the check runs in front of D-04, not over it', () => {
  const c = rawCfg({ stakes: 'critical', review: { triggers: { risk_surface: { gate: 'off' } } } },
    'gate-valid-disagree.json');
  const r = resolve('cad-reviewer', c);
  assert.equal(r.review.risk_surface, 'off'); // the user's key still decides
  assert.equal(r.warnings.length, 1);
  assert.match(r.warnings[0], /wins over the critical level gate/);
});

// --- phase_diff resolves the same through all three surfaces -----------------

test('with NO triggers block the level decides phase_diff, and nothing disagrees', () => {
  // The three surfaces that decide this gate - the route table, the schema
  // default and the scaffolded template - agreed on nothing before this. A
  // config that writes no gate is the state a fresh scaffold is now in.
  const shipped = rawCfg({ stakes: 'shipped' }, 'pd-shipped.json');
  const rs = resolve('cad-executor', shipped);
  assert.equal(rs.review.phase_diff, 'off');
  // route omits `warnings` entirely when empty, so an absent key IS the
  // no-disagreement answer - `?? []` states that rather than crashing on it.
  assert.deepEqual(rs.warnings ?? [], [], String(rs.warnings));

  const critical = rawCfg({ stakes: 'critical' }, 'pd-critical.json');
  const rc = resolve('cad-executor', critical);
  assert.equal(rc.review.phase_diff, 'adjudicated');
  assert.deepEqual(rc.warnings ?? [], [], String(rc.warnings));

  const solo = rawCfg({ stakes: 'solo' }, 'pd-solo.json');
  assert.equal(resolve('cad-executor', solo).review.phase_diff, 'off');
});

test('the SCAFFOLDED template carries no triggers block, so nothing overrides the level', () => {
  // The template is the fixture, not a hand-written stand-in: a pre-written
  // gate WINS over the level's and warns, so a scaffolded repo later switched
  // to `stakes: critical` would have kept `advisory` beating `adjudicated` -
  // which is the whole point of dropping the block rather than retuning it.
  const template = JSON.parse(readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '..', 'templates', 'config.json'), 'utf8'));
  assert.equal(template.review.triggers, undefined, 'the template must write no gate at all');

  const asShipped = rawCfg(template, 'pd-template-shipped.json');
  const rs = resolve('cad-executor', asShipped);
  assert.equal(rs.stakes, 'shipped', 'the template ships at shipped');
  assert.equal(rs.review.phase_diff, 'off');
  assert.deepEqual(rs.warnings ?? [], [], String(rs.warnings));

  const asCritical = rawCfg({ ...template, stakes: 'critical' }, 'pd-template-critical.json');
  const rc = resolve('cad-executor', asCritical);
  assert.equal(rc.review.phase_diff, 'adjudicated', 'the level decides after the switch');
  assert.deepEqual(rc.warnings ?? [], [], String(rc.warnings));
});

test('a VALID agreeing gate still emits no warning', () => {
  const c = rawCfg({ stakes: 'critical', review: { triggers: { risk_surface: { gate: 'blocking' } } } },
    'gate-valid-agree.json');
  const r = resolve('cad-reviewer', c);
  assert.equal(r.review.risk_surface, 'blocking');
  assert.equal(r.warnings, undefined);
});

test('the gate check FALLS BACK rather than skipping when the table declares no gates', () => {
  // The row that proves the fallback rather than the skip: an older or
  // hand-edited table carries no `gates` array, and that is exactly the input
  // shape on which a typo must not reach the bundle.
  const t = JSON.parse(JSON.stringify(SHIPPED_TABLE));
  delete t.gates;
  const tablePath = join(dir, 'no-gates-table.json');
  writeFileSync(tablePath, JSON.stringify(t));
  const c = rawCfg({ stakes: 'critical', review: { triggers: { risk_surface: { gate: 'blockign' } } } },
    'gate-typo-no-gates.json');
  const r = resolve('cad-reviewer', c, [], { table: tablePath });
  assert.equal(r.review.risk_surface, 'blocking');
  assert.equal(r.warnings.length, 1, JSON.stringify(r.warnings));
  assert.match(r.warnings[0], /blockign/);
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
  // `max` passes no schema enum for cad-executor, so only a hand-edited config
  // reaches here. Handing it to the agentFor fail-open would dispatch the base
  // file while reporting `max` - a rung nothing ran at.
  const file = cfg({ stakes: 'shipped', effort: { 'cad-executor': 'max' } }, 'eff-unmapped.json');
  const r = resolve('cad-executor', file);
  assert.equal(r.ok, true);                 // never blocks the spine
  assert.equal(r.effort, 'high');           // the cell's rung stands
  assert.equal(r.agent, 'cad-executor');    // ...and its file
  const named = (r.warnings || []).filter((w) => /model\.effort\.cad-executor/.test(w));
  assert.equal(named.length, 1, JSON.stringify(r.warnings));
  assert.match(named[0], /"max"/);          // the value the user wrote
  assert.match(named[0], /high, xhigh/);    // ...and the rungs this role does have
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

test('no stakes level fires `deferred` - the review grid holds it in no cell', () => {
  // 1. The shipped table, read directly: every cell of the grid, so a level or
  //    a trigger ADDED to it is censused too rather than silently exempt.
  for (const [level, row] of Object.entries(SHIPPED_TABLE.review)) {
    for (const [trigger, gate] of Object.entries(row)) {
      assert.notEqual(gate, 'deferred',
        `route-table.json's review grid fires deferred at ${level}/${trigger}. No level `
        + 'fires it this cycle (D-03): it is reachable by a config-set '
        + 'review.triggers.<t>.gate alone. Moving a cell is phase 3\'s work and carries '
        + 'README.md, METHOD.md, docs/WORKFLOW.md and .planning/DOCS-CLAIMS.md with it.');
    }
  }

  // 2. What a resolve actually RETURNS with no config layer pinning a gate -
  //    the same question asked of the resolver rather than of its data, so a
  //    default injected anywhere between the table and the envelope is caught
  //    by the half that never reads the table.
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
// `stakes` is the MINIMUM a project accepts, and the phase's own declared
// `files:` are what raise it. Every fixture here is a whole repo root - the
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

test('floor: an explicit stakes=critical is never resolved below (AC1)', () => {
  const fx = floorRoot({ stakes: 'critical', ...ANSWERED },
    { '3/PLAN-1.md': ['docs/README.md'] }, { 'docs/README.md': '# Readme\n' });
  const r = resolve('cad-executor', fx.file, ['--phase', '3']);
  assert.equal(r.ok, true);
  assert.equal(r.stakes, 'critical');
  assert.equal(r.model, 'opus');
  // It read the plan and found nothing, and SAYS so - the configured level
  // standing because nothing raised it is a different fact from no floor.
  assert.ok(floorReasons(r).some((x) => /declaring nothing that touches/.test(x)),
    JSON.stringify(r.reason));
});

test('floor: with stakes UNSET a surfaceless phase resolves solo, where today it is shipped (AC2)', () => {
  const plans = { '3/PLAN-1.md': ['docs/README.md'] };
  const files = { 'docs/README.md': '# Readme\n' };
  const computed = floorRoot({ ...ANSWERED }, plans, files);
  const r = resolve('cad-executor', computed.file, ['--phase', '3']);
  assert.equal(r.ok, true);
  assert.equal(r.stakes, 'solo');
  assert.equal(r.model, 'sonnet');
  assert.ok(floorReasons(r).some((x) => /floors at "solo"/.test(x)), JSON.stringify(r.reason));
  // The BOTH-OUTPUTS half of the criterion: the same config with no phase in
  // hand at all is the pre-CER-01 answer, and it is the schema default.
  const today = resolve('cad-executor', computed.file);
  assert.equal(today.stakes, 'shipped');
  assert.equal(today.model, 'opus');
});

test('floor: a declared file on an answered surface raises to shipped and cites it', () => {
  const fx = floorRoot({ ...ANSWERED },
    { '3/PLAN-1.md': ['docs/README.md', 'src/load.mjs'] },
    { 'docs/README.md': '# Readme\n', 'src/load.mjs': SECRET_BODY });
  const r = resolve('cad-executor', fx.file, ['--phase', '3']);
  assert.equal(r.ok, true);
  assert.equal(r.stakes, 'shipped');
  const cited = floorReasons(r);
  assert.equal(cited.length, 1, JSON.stringify(r.reason));
  assert.match(cited[0], /src\/load\.mjs touches secrets/);
  assert.match(cited[0], /level solo -> shipped/);
});

test('floor: stakes=solo is a FLOOR, so the same phase still raises to shipped', () => {
  const fx = floorRoot({ stakes: 'solo', ...ANSWERED },
    { '3/PLAN-1.md': ['src/load.mjs'] }, { 'src/load.mjs': SECRET_BODY });
  const r = resolve('cad-executor', fx.file, ['--phase', '3']);
  assert.equal(r.stakes, 'shipped');
  assert.match(floorReasons(r)[0], /level solo -> shipped/);
});

test('floor: an UNANSWERED category cannot raise - the scope is the answered set (D-10)', () => {
  // The identical bytes under a config that answered only `destructive`: the
  // secrets construct is not looked for, so it is not reported and not raised.
  const fx = floorRoot(
    { review: { triggers: { risk_surface: { surfaces: ['destructive'] } } } },
    { '3/PLAN-1.md': ['src/load.mjs'] }, { 'src/load.mjs': SECRET_BODY });
  const r = resolve('cad-executor', fx.file, ['--phase', '3']);
  assert.equal(r.stakes, 'solo');
  assert.deepEqual(r.surfaces, ['destructive']);
});

test('floor: a declared file that does not exist yet still evidences by PATH', () => {
  // The create-a-file plan: no body to read, and the path is still a
  // declaration. `src/auth/session.rs` is written by nothing here.
  const fx = floorRoot({ review: { triggers: { risk_surface: { surfaces: ['auth'] } } } },
    { '3/PLAN-1.md': ['src/auth/session.rs'] });
  const r = resolve('cad-executor', fx.file, ['--phase', '3']);
  assert.equal(r.stakes, 'shipped');
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
  // NOT solo: the unset default stands because nothing was proved.
  assert.equal(r.stakes, 'shipped');
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
  assert.equal(r.stakes, 'shipped');
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
  assert.equal(r.stakes, 'shipped', 'the discount was taken on a body outside the tree');
  assert.equal(r.model, 'opus');
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
  assert.equal(r.stakes, 'shipped');
  assert.match(floorReasons(r)[0], /src\/deep\/nest\/load\.mjs touches secrets/);
  assert.equal('warnings' in r, false, JSON.stringify(r.warnings));
});

test('floor: the two pre-plan roles are exempt and say they were not computed', () => {
  const fx = floorRoot({ ...ANSWERED },
    { '3/PLAN-1.md': ['src/load.mjs'] }, { 'src/load.mjs': SECRET_BODY });
  // The same phase raises an executor to shipped...
  assert.equal(resolve('cad-executor', fx.file, ['--phase', '3']).stakes, 'shipped');
  // ...and moves neither role dispatched before a plan exists. The cursor lags
  // at both their call sites, so a floor computed for them is computed off
  // another phase's file list.
  for (const role of ['cad-planner', 'cad-assumptions-analyzer']) {
    const r = resolve(role, fx.file, ['--phase', '3']);
    assert.equal(r.ok, true, role);
    assert.equal(r.stakes, 'shipped', role);
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
  assert.equal(r.stakes, 'solo');
  assert.deepEqual(floorReasons(r).filter((x) => /touches \w+ \(/.test(x)), []);
});

test('floor: a stakes_order that cannot place the levels keeps the baseline and warns', () => {
  // A reason claiming a baseline is "already at or above" a floor nothing could
  // compare is a flatly false sentence this seam has emitted before.
  const t = join(dir, 'torn-stakes-order.json');
  const shipped = JSON.parse(readFileSync(join(dirname(ROUTE), '..', 'route-table.json'), 'utf8'));
  shipped.stakes_order = ['low', 'high'];
  writeFileSync(t, JSON.stringify(shipped));
  const fx = floorRoot({ ...ANSWERED },
    { '3/PLAN-1.md': ['src/load.mjs'] }, { 'src/load.mjs': SECRET_BODY });
  const r = resolve('cad-executor', fx.file, ['--phase', '3'], { table: t });
  assert.equal(r.ok, true);
  assert.equal(r.stakes, 'shipped', 'the configured baseline, not a level nothing could compare');
  assert.ok((r.warnings || []).some((w) => /stakes_order cannot place/.test(w)),
    JSON.stringify(r.warnings));
  assert.deepEqual(floorReasons(r).filter((x) => /already at or above/.test(x)), []);
});

// --- the floor fails CLOSED (AC5) --------------------------------------------
//
// Every row here has `stakes` UNSET and asserts ok:true at the schema default.
// The direction is the whole point: `ok:false` drops the caller to the base
// agent at the host session default with no model override, which is BELOW every
// floor - so a plan this cannot read may never refuse, and may never discount.

/** A surfaceless plan, and the repo file it declares. */
const CLEAN_PLAN = ['docs/README.md'];
const CLEAN_FILES = { 'docs/README.md': '# Readme\n' };

test('fail-closed: an absent phase directory holds the configured stakes', () => {
  const fx = floorRoot({ ...ANSWERED }, {}, CLEAN_FILES);
  const r = resolve('cad-executor', fx.file, ['--phase', '3']);
  assert.equal(r.ok, true);
  assert.equal(r.stakes, 'shipped');
  assert.ok(floorReasons(r).some((x) => /holds no plan file this could read/.test(x)),
    JSON.stringify(r.reason));
  assert.ok(floorReasons(r).some((x) => /discount below the "shipped" default is withheld/.test(x)));
  // An absent phase directory is the ordinary pre-plan state, so it is said in
  // `reason` and NOT warned about - warning would fire on every dispatch of
  // every project that has not planned its next phase yet.
  assert.equal('warnings' in r, false, JSON.stringify(r.warnings));
});

test('fail-closed: a phase directory with no PLAN file is the same arm', () => {
  const fx = floorRoot({ ...ANSWERED }, { '3/CONTEXT.md': '# Context\n' }, CLEAN_FILES);
  const r = resolve('cad-executor', fx.file, ['--phase', '3']);
  assert.equal(r.ok, true);
  assert.equal(r.stakes, 'shipped');
  assert.ok(floorReasons(r).some((x) => /holds no plan file this could read/.test(x)),
    JSON.stringify(r.reason));
});

test('fail-closed: a PLAN whose frontmatter is out of grammar holds the configured stakes', () => {
  const fx = floorRoot({ ...ANSWERED },
    { '3/PLAN-1.md': '---\nphase: 3\nplan: 1\nfiles:\n  - docs/README.md\n  not a key line\n---\n\n# Plan\n' },
    CLEAN_FILES);
  const r = resolve('cad-executor', fx.file, ['--phase', '3']);
  assert.equal(r.ok, true);
  assert.equal(r.stakes, 'shipped');
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
  assert.equal(r.stakes, 'shipped');
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
  assert.equal(r.stakes, 'shipped');
  assert.equal(r.model, 'opus');
  assert.ok(floorReasons(r).some((x) => /1 of 2 plans in phase 3 could not be read/.test(x)),
    JSON.stringify(r.reason));
});

test('fail-closed: the paired POSITIVE - both plans clean and surfaceless resolves solo', () => {
  // Without this row the five above are satisfied by a floor that never
  // discounts anything at all.
  const fx = floorRoot({ ...ANSWERED },
    { '3/PLAN-1.md': CLEAN_PLAN, '3/PLAN-2.md': ['docs/GUIDE.md'] },
    { ...CLEAN_FILES, 'docs/GUIDE.md': '# Guide\n' });
  const r = resolve('cad-executor', fx.file, ['--phase', '3']);
  assert.equal(r.ok, true);
  assert.equal(r.stakes, 'solo');
  assert.equal(r.model, 'sonnet');
  assert.ok(floorReasons(r).some((x) => /2 plans read clean/.test(x)), JSON.stringify(r.reason));
  assert.equal('warnings' in r, false, JSON.stringify(r.warnings));
});

// --- a scope that declared NOTHING proves nothing (UAT item 11) --------------
//
// The same argument as the rows above, one step further in: `found` and `clean`
// are satisfied by a plan that parsed perfectly and named no file at all, so the
// floor scanned zero bytes and reported it as a clean read. Absence of evidence
// reported as absence of surface.

test('declared-nothing: a plan with an EMPTY files: list is not discounted', () => {
  const fx = floorRoot({ ...ANSWERED }, { '3/PLAN-1.md': [] }, CLEAN_FILES);
  const r = resolve('cad-executor', fx.file, ['--phase', '3']);
  assert.equal(r.ok, true);
  assert.equal(r.stakes, 'shipped');
  assert.equal(r.model, 'opus');
  // The warning names the plan file, on the `risk floor: ` vocabulary route.mjs
  // relays verbatim, so a reader can see WHICH plan declared nothing.
  assert.ok((r.warnings || []).some((w) => /^risk floor: phase 3: .*PLAN-1\.md declares no files at all/.test(w)),
    JSON.stringify(r.warnings));
  // ...and the reason says which of the two sentences this is. "Declaring
  // nothing that touches [...]" is the DISCOUNT's sentence and would claim a
  // scope nobody looked at had been found clean.
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
  assert.equal(r.stakes, 'shipped');
  assert.ok(floorReasons(r).some((x) => /declared no files at all/.test(x)),
    JSON.stringify(r.reason));
});

test('declared-nothing: the UAT probe verbatim - the SHIPPED template plus a task Files: line', () => {
  // Reproduced from the template this project actually ships, read here rather
  // than retyped: `files:` arrives with no items, and D-05 keeps the task prose
  // out of the floor, so the probe scans nothing while LOOKING fully declared.
  // It returned solo/sonnet - verify off, the plan gate down to advisory - on a
  // plan whose one task names a secrets file.
  const template = readFileSync(join(dirname(ROUTE), '..', 'templates', 'PLAN.md'), 'utf8');
  const body = `${template}\n### Task 1\n\n- **Files:** src/load.mjs\n`;
  const fx = floorRoot({ ...ANSWERED }, { '3/PLAN-1.md': body },
    { 'src/load.mjs': SECRET_BODY });
  const r = resolve('cad-executor', fx.file, ['--phase', '3']);
  assert.equal(r.ok, true);
  assert.equal(r.stakes, 'shipped');
  assert.equal(r.model, 'opus');
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
  assert.equal(r.stakes, 'shipped');
  assert.ok(floorReasons(r).some((x) => /1 of 2 plans in phase 3 declared no files at all/.test(x)),
    JSON.stringify(r.reason));
});

test('declared-nothing: an EXPLICIT stakes is untouched - this arm withholds a discount', () => {
  // It never raises anything: `critical` stays `critical` and `solo` stays
  // `solo`, because the configured level is a floor and this arm only refuses to
  // go below it.
  for (const [stakes, model] of [['critical', 'opus'], ['solo', 'sonnet']]) {
    const fx = floorRoot({ stakes, ...ANSWERED }, { '3/PLAN-1.md': [] }, CLEAN_FILES);
    const r = resolve('cad-executor', fx.file, ['--phase', '3']);
    assert.equal(r.stakes, stakes, JSON.stringify(r.reason));
    assert.equal(r.model, model);
  }
});

// --- --plan: an executor floors on the plan it was handed (D-06) -------------

/** A mixed phase: PLAN-1 surfaceless, PLAN-2 on an answered surface. */
const mixedPhase = () => floorRoot({ ...ANSWERED },
  { '3/PLAN-1.md': ['docs/README.md'], '3/PLAN-2.md': ['src/load.mjs'] },
  { 'docs/README.md': '# Readme\n', 'src/load.mjs': SECRET_BODY });

test('--plan: a clean plan in a mixed phase routes BELOW its risky sibling', () => {
  const fx = mixedPhase();
  const clean = resolve('cad-executor', fx.file, ['--phase', '3', '--plan', '1']);
  assert.equal(clean.ok, true);
  assert.equal(clean.stakes, 'solo');
  assert.equal(clean.model, 'sonnet');
  assert.ok(floorReasons(clean).some((x) => /phase 3 plan 1 read clean/.test(x)),
    JSON.stringify(clean.reason));
});

test('--plan: the risky plan of the same phase, and the phase UNION, both raise', () => {
  const fx = mixedPhase();
  const risky = resolve('cad-executor', fx.file, ['--phase', '3', '--plan', '2']);
  assert.equal(risky.stakes, 'shipped');
  assert.match(floorReasons(risky)[0], /^risk floor: phase 3 plan 2: src\/load\.mjs touches secrets/);
  // No --plan is the PHASE union, which is what a phase-scoped role resolves on:
  // one risky member raises the whole phase.
  const union = resolve('cad-executor', fx.file, ['--phase', '3']);
  assert.equal(union.stakes, 'shipped');
  assert.match(floorReasons(union)[0], /^risk floor: phase 3: src\/load\.mjs touches secrets/);
});

test('--plan: a key naming no plan file fails CLOSED, never widening to the union', () => {
  // The wrong answer here is the WIDE one: silently answering about six plans a
  // caller did not ask about. It holds the configured stakes and says so.
  const fx = mixedPhase();
  const r = resolve('cad-executor', fx.file, ['--phase', '3', '--plan', '9']);
  assert.equal(r.ok, true);
  assert.equal(r.stakes, 'shipped');
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
  assert.equal(r.stakes, 'shipped');
  const dispatch = traceLines(fx.planning).find((e) => e.family === 'lifecycle');
  assert.equal(dispatch.plan, '1');
});

// --- replay: what the floor does to a project's own phases (AC3) -------------
//
// The whole point is that AC3 is PRINTABLE rather than asserted, so these pin
// the row shape a reader acts on - and that the computed column comes off the
// same `levelFor` a resolve routes on rather than off a second arithmetic.

/** `route.mjs replay`, on the same isolated-global rail `resolve` uses. */
function replay(file, extra = [], opts = {}) {
  const args = ['replay', ...(file ? ['--file', file] : []), ...extra];
  const env = { ...process.env, CADENCE_GLOBAL_CONFIG: opts.global || NO_GLOBAL };
  try {
    return JSON.parse(execFileSync('node', [ROUTE, ...args], { encoding: 'utf8', env }));
  } catch (e) {
    return JSON.parse(e.stdout);
  }
}

/** An archived phase directory - where `milestone-prune --mode archive` puts a
 * closed milestone's phases, and where 27 of this repository's 30 live. */
function archivePhase(planning, label, name, files) {
  const dir = join(planning, `_archive-${label}`, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'PLAN.md'), `---\nphase: 1\nplan: 1\nfiles:\n${
    files.map((f) => `  - ${f}\n`).join('')}---\n\n# Plan\n`);
}

test('replay: one row per phase, and the RAISE carries the evidence even at today\'s level', () => {
  const fx = floorRoot({ ...ANSWERED }, {
    '3/PLAN-1.md': ['docs/README.md'],
    '4/PLAN-1.md': ['src/load.mjs'],
  }, { 'docs/README.md': '# Readme\n', 'src/load.mjs': SECRET_BODY });
  const r = replay(fx.file);
  assert.equal(r.ok, true);
  assert.equal(r.stakes, 'shipped', 'today IS the configured stakes - the schema default here');
  assert.deepEqual(r.rows.map((x) => x.label), ['phases/3', 'phases/4']);

  const [clean, risky] = r.rows;
  assert.equal(clean.today, 'shipped');
  assert.equal(clean.computed, 'solo', 'the surfaceless phase computes BELOW today');
  assert.equal(clean.raised, false);
  assert.equal('surface' in clean, false, 'a row that did not raise cites nothing');
  assert.equal(clean.plans_found, 1);
  assert.equal(clean.plans_clean, 1);

  // The raise that does not move the column, which is why evidence keys off the
  // RAISE and never off the diff: `RAISE_TARGET` and the default are both
  // `shipped`, so a diff-triggered evidence column would be blank for exactly
  // the rows whose surface a reader needs.
  assert.equal(risky.computed, 'shipped');
  assert.equal(risky.computed, risky.today);
  assert.equal(risky.raised, true);
  assert.equal(risky.surface, 'secrets');
  assert.equal(risky.file, 'src/load.mjs');
  assert.ok(risky.signal, JSON.stringify(risky));
  assert.deepEqual(r.regressions, [], 'always present, empty on a healthy tree');
});

test('replay: an ARCHIVED phase directory is measured in the same run', () => {
  // 27 of this repository's own 30 phases are archived; a locator that joined
  // `phases/<N>` and nothing else would answer AC3 off a tenth of the evidence.
  const fx = floorRoot({ ...ANSWERED }, { '3/PLAN-1.md': ['docs/README.md'] },
    { 'docs/README.md': '# Readme\n', 'src/load.mjs': SECRET_BODY });
  archivePhase(fx.planning, 'v1.0.0', '1', ['src/load.mjs']);
  const r = replay(fx.file);
  assert.deepEqual(r.rows.map((x) => x.label), ['_archive-v1.0.0/1', 'phases/3']);
  assert.equal(r.rows[0].raised, true);
  assert.equal(r.rows[0].surface, 'secrets');
  assert.equal(r.rows[1].computed, 'solo');
  assert.deepEqual(r.regressions, []);
});

test('replay: a phase whose plan cannot be read prints today\'s level and says so', () => {
  const fx = floorRoot({ ...ANSWERED }, {
    '3/PLAN-1.md': '---\nphase: 3\nplan: 1\nfiles:\n  - src/a.mjs\n  not a key line\n---\n\n# Plan\n',
  });
  const r = replay(fx.file);
  assert.equal(r.ok, true);
  const [row] = r.rows;
  assert.equal(row.computed, 'shipped', 'today\'s level, never the discount');
  assert.equal(row.computed, row.today);
  assert.equal(row.raised, false);
  assert.equal(row.plans_found, 1);
  assert.equal(row.plans_clean, 0);
  assert.ok(row.reason.some((x) => /withheld/.test(x)), JSON.stringify(row.reason));
  assert.ok((row.warnings || []).some((w) => /out of grammar/.test(w)), JSON.stringify(row));
});

test('replay: a planning root with no phase directory is an empty row list, not a refusal', () => {
  const fx = floorRoot({ ...ANSWERED });
  const r = replay(fx.file);
  assert.equal(r.ok, true);
  assert.deepEqual(r.rows, []);
  assert.deepEqual(r.regressions, [], 'written whether or not anything matched');
});

test('replay: a bare --file is REFUSED, exactly as resolve\'s is', () => {
  const r = replay(null, ['--file']);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'usage');
  assert.match(r.detail, /--file/);
});
