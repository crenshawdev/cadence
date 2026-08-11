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
// opts.table to inject a route table through CADENCE_ROUTE_TABLE.
function resolve(role, file, extra = [], opts = {}) {
  const args = ['resolve', '--role', role, ...(file ? ['--file', file] : []), ...extra];
  const env = { ...process.env, CADENCE_GLOBAL_CONFIG: opts.global || NO_GLOBAL };
  if (opts.table) env.CADENCE_ROUTE_TABLE = opts.table;
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
  { stakes: 'shipped', role: 'cad-reviewer', model: 'opus', effort: 'xhigh', retry: 'xhigh', agent: 'cad-reviewer-xhigh', retryAgent: 'cad-reviewer-xhigh' },
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
    const file = cfg({ stakes: c.stakes }, `cell-${c.stakes}.json`);
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

test('the four held retries say the rung was held, not that it escalated', () => {
  // A (stakes, role) pair list, not one config: after the retune the held cells
  // span two levels - critical/cad-plan-checker and shipped/cad-reviewer now
  // START at their retry rung, which is the whole point of the retune (winning
  // on attempt one is cheaper than a re-dispatch that rewrites the entire
  // subagent prompt at the cache-write tier).
  const held = [
    ['critical', 'cad-assumptions-analyzer'],
    ['critical', 'cad-executor'],
    ['critical', 'cad-plan-checker'],
    ['shipped', 'cad-reviewer'],
  ];
  for (const [stakes, role] of held) {
    const file = cfg({ stakes }, `cell-${stakes}.json`);
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
    phase_diff: 'off', pre_ship: 'advisory',
  });
  assert.equal(solo.verify, 'off');

  const shipped = resolve('cad-planner', cfg({ stakes: 'shipped' }));
  assert.deepEqual(shipped.review, {
    plan: 'adjudicated', diff: 'advisory', risk_surface: 'blocking',
    phase_diff: 'advisory', pre_ship: 'adjudicated',
  });
  assert.equal(shipped.verify, 'on');

  const critical = resolve('cad-planner', cfg({ stakes: 'critical' }));
  assert.deepEqual(critical.review, {
    plan: 'adjudicated', diff: 'blocking', risk_surface: 'blocking',
    phase_diff: 'adjudicated', pre_ship: 'adjudicated',
  });
  assert.equal(critical.verify, 'on');
});

test('risk_surface is blocking at every level - a detection match is never waved through', () => {
  for (const stakes of ['solo', 'shipped', 'critical']) {
    assert.equal(resolve('cad-planner', cfg({ stakes })).review.risk_surface, 'blocking', stakes);
  }
});

test('a config gate that AGREES with the level is taken silently', () => {
  const c = rawCfg({ stakes: 'shipped', review: { triggers: { diff: { gate: 'advisory' } } } },
    'gate-agrees.json');
  const r = resolve('cad-planner', c);
  assert.equal(r.review.diff, 'advisory');
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

test('a level with no review row or no verify value degrades to unresolved', () => {
  // A torn table must not emit half a bundle: two of the four knobs read as a
  // whole answer is worse than no answer.
  for (const drop of ['review', 'verify']) {
    const t = JSON.parse(JSON.stringify(SHIPPED_TABLE));
    delete t[drop].shipped;
    const p = join(dir, `torn-${drop}.json`);
    writeFileSync(p, JSON.stringify(t));
    const env = { ...process.env, CADENCE_GLOBAL_CONFIG: NO_GLOBAL, CADENCE_ROUTE_TABLE: p };
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

test('escalation fires at the shipped DEFAULT, with no stakes key set anywhere', () => {
  // The whole point of the axis change: phase 1's rung ladder was unreachable
  // out of the box because escalation was gated behind a routing mode nobody
  // had set. With no config file and no global layer, a second attempt must
  // climb.
  const missing = join(dir, 'no-config-at-all.json');
  const first = resolve('cad-plan-checker', missing);
  assert.equal(first.escalated, false);            // a clean run never escalates
  assert.equal(first.agent, 'cad-plan-checker-medium');
  assert.equal(first.stakes, 'shipped');

  const retry = resolve('cad-plan-checker', missing, ['--attempt', '2']);
  assert.equal(retry.ok, true);
  assert.equal(retry.agent, 'cad-plan-checker-high');
  assert.equal(retry.effort, 'high');
  assert.equal(retry.escalated, true);
  assert.equal(retry.stakes, 'shipped');
  assert.equal(retry.model, 'sonnet');             // the rung climbs, the model holds
});

test('escalation fires at every stakes level, not just the default', () => {
  // cad-planner, not cad-plan-checker: the retune makes critical/cad-plan-checker
  // a HELD cell, so the checker can no longer carry a per-level proof of the
  // escalation claim. The planner climbs at all three levels, which is the claim
  // this row exists for - flipping the critical assertion to `false` instead
  // would have kept the row green while it stopped proving anything.
  const expected = { solo: 'cad-planner-xhigh', shipped: 'cad-planner-xhigh', critical: 'cad-planner-max' };
  for (const [stakes, agent] of Object.entries(expected)) {
    const r = resolve('cad-planner', cfg({ stakes }), ['--attempt', '2']);
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
});

test('table dumps the routing table - the three grids and the declared roles', () => {
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
  assert.deepEqual(Object.keys(r.table).sort(),
    ['_meta', 'cells', 'gates', 'model_aliases', 'review', 'roles', 'rung_order',
      'stakes_order', 'verify']);
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
  const c = cfg({ stakes: 'shipped', overrides: { 'cad-plan-checker': 'fable' } }, 'ovr-checker.json');
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
  const env = { ...process.env, CADENCE_GLOBAL_CONFIG: NO_GLOBAL, CADENCE_ROUTE_TABLE: bad };
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

  const c = cfg({ stakes: 'shipped' });
  const env = { ...process.env, CADENCE_GLOBAL_CONFIG: NO_GLOBAL, CADENCE_ROUTE_TABLE: tablePath };
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
  const c = cfg({ stakes: 'critical' });
  const r = resolve('cad-executor', c, ['--attempt', '2']);
  assert.equal(r.agent, 'cad-executor-xhigh');
  assert.equal(r.effort, 'xhigh');
  assert.equal(r.escalated, false);
  assert.match(r.reason.join(' '), /rung held at xhigh/);
});

test('CADENCE_ROUTE_TABLE nonexistent degrades to ok:false, reason bad-table, no stack', () => {
  const missing = join(dir, 'does-not-exist-table.json');
  const env = { ...process.env, CADENCE_GLOBAL_CONFIG: NO_GLOBAL, CADENCE_ROUTE_TABLE: missing };
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
  assert.equal(rs.review.phase_diff, 'advisory');
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
  assert.equal(rs.review.phase_diff, 'advisory');
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
  const file = cfg({ stakes: 'shipped', effort: { 'cad-verifier': 'xhigh' } }, 'eff-retry-hold.json');
  const r = resolve('cad-verifier', file, ['--attempt', '2']);
  assert.equal(r.ok, true);
  assert.equal(r.effort, 'xhigh');            // held, not demoted to the cell's high
  assert.equal(r.agent, 'cad-verifier-xhigh');
  assert.equal(r.escalated, false);           // and never reported as an escalation
  assert.match(r.reason.join(' '), /retry rung "high"/);
  assert.match(r.reason.join(' '), /model\.effort\.cad-verifier="xhigh"/);
});

test('a configured start BELOW the cell\'s retry climbs exactly as it does today', () => {
  const file = cfg({ stakes: 'shipped', effort: { 'cad-verifier': 'medium' } }, 'eff-retry-climb.json');
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
    cfg({ stakes: 'solo', effort: { 'cad-plan-checker': 'xhigh' } }, 'eff-outrank.json'),
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
  const file = cfg({ stakes: 'shipped', effort: { 'cad-verifier': 'max' } }, 'eff-torn-retry.json');
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
  const file = cfg({ stakes: 'shipped', effort: { 'cad-verifier': 'high' } }, 'eff-retry-equal.json');
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
