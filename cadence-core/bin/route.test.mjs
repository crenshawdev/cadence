// Zero-dep tests for route.mjs. Run: node --test 'cadence-core/bin/*.test.mjs'
// Uses only node: builtins (no framework), matching the repo's zero-dep ethos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync, mkdirSync, chmodSync, readFileSync, existsSync } from 'node:fs';
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
  { stakes: 'shipped', role: 'cad-reviewer', model: 'opus', effort: 'high', retry: 'xhigh', agent: 'cad-reviewer', retryAgent: 'cad-reviewer-xhigh' },
  { stakes: 'shipped', role: 'cad-executor', model: 'opus', effort: 'high', retry: 'xhigh', agent: 'cad-executor', retryAgent: 'cad-executor-xhigh' },
  { stakes: 'shipped', role: 'cad-plan-checker', model: 'sonnet', effort: 'medium', retry: 'high', agent: 'cad-plan-checker-medium', retryAgent: 'cad-plan-checker-high' },

  { stakes: 'critical', role: 'cad-planner', model: 'opus', effort: 'xhigh', retry: 'max', agent: 'cad-planner-xhigh', retryAgent: 'cad-planner-max' },
  { stakes: 'critical', role: 'cad-assumptions-analyzer', model: 'opus', effort: 'xhigh', retry: 'xhigh', agent: 'cad-assumptions-analyzer', retryAgent: 'cad-assumptions-analyzer' },
  { stakes: 'critical', role: 'cad-verifier', model: 'opus', effort: 'xhigh', retry: 'max', agent: 'cad-verifier-xhigh', retryAgent: 'cad-verifier-max' },
  { stakes: 'critical', role: 'cad-reviewer', model: 'opus', effort: 'xhigh', retry: 'max', agent: 'cad-reviewer-xhigh', retryAgent: 'cad-reviewer-max' },
  { stakes: 'critical', role: 'cad-executor', model: 'opus', effort: 'xhigh', retry: 'xhigh', agent: 'cad-executor-xhigh', retryAgent: 'cad-executor-xhigh' },
  { stakes: 'critical', role: 'cad-plan-checker', model: 'opus', effort: 'high', retry: 'xhigh', agent: 'cad-plan-checker-high', retryAgent: 'cad-plan-checker-xhigh' },
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

test('the two held retries say the rung was held, not that it escalated', () => {
  const file = cfg({ stakes: 'critical' }, 'cell-critical.json');
  for (const role of ['cad-assumptions-analyzer', 'cad-executor']) {
    const r = resolve(role, file, ['--attempt', '2']);
    assert.equal(r.escalated, false, role);
    assert.match(r.reason.join(' '), /rung held at xhigh/, role);
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
    phase_diff: 'off', pre_ship: 'adjudicated',
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
  const expected = { solo: 'cad-plan-checker-high', shipped: 'cad-plan-checker-high', critical: 'cad-plan-checker-xhigh' };
  for (const [stakes, agent] of Object.entries(expected)) {
    const r = resolve('cad-plan-checker', cfg({ stakes }), ['--attempt', '2']);
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
      'stakes_order', 'surfaces', 'verify']);
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
  assert.equal(r.agent, 'cad-plan-checker-high');
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

// --- the computed risk floor (STK-03) ----------------------------------------

// Every floor fixture gets its OWN mkdtempSync directory, with its config
// written INSIDE it. The planning root is dirname(--file), so a fixture dropping
// a STATE.md or a phases/<N>/PLAN.md into the shared `dir` above would put every
// other row in this file - including all 18 `cell <stakes>/<role>` cases -
// behind a cursor pointing at an auth-declaring PLAN, resolving them `critical`
// and failing assertions that have nothing to do with this phase.
//
// Every row also passes CADENCE_GLOBAL_CONFIG at the NO_GLOBAL path (via the
// resolve() helper): this machine's real user-global layer sets
// review.triggers.phase_diff.gate, so a non-hermetic row's warning-count
// assertion would read a correct tree as a failure.

/** A PLAN.md whose frontmatter `files:` declares exactly these paths. */
const planText = (files) =>
  `---\nphase: 9\nplan: 1\nrequirements:\n  - STK-03\nfiles:\n${
    files.map((f) => `  - ${f}\n`).join('')}---\n\n# Plan\n`;

/**
 * A fresh planning root per call: `<root>/config.json` (the --file), an optional
 * `<root>/phases/<phase>/PLAN.md` declaring `files`, and an optional
 * `<root>/STATE.md` cursor. Returns the config path.
 * @param {string[]|null} files null = create no PLAN file at all
 */
function planningRoot(files, { phase = 9, cursor = null, config = { stakes: 'solo' },
  emptyDir = false, text = null } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'cad-route-floor-'));
  if (files || emptyDir) {
    const pdir = join(root, 'phases', String(phase));
    mkdirSync(pdir, { recursive: true });
    if (files) writeFileSync(join(pdir, 'PLAN.md'), text ?? planText(files));
  }
  if (cursor !== null) {
    writeFileSync(join(root, 'STATE.md'), renderCursor({
      phase: cursor, total: 9, name: 'fixture', status: 'planned',
      next: '/cad-execute', updated: '2026-07-29',
    }));
  }
  writeFileSync(join(root, 'config.json'), JSON.stringify(config));
  return join(root, 'config.json');
}

const floorEntries = (r) => (r.reason || []).filter((x) => /^risk floor:/.test(x));

test('a solo phase whose PLAN declares an auth path resolves at the critical cell', () => {
  const file = planningRoot(['README.md', 'src/auth/session.rs']);
  const r = resolve('cad-executor', file, ['--phase', '9']);
  assert.equal(r.ok, true);
  assert.equal(r.stakes, 'critical');   // raised off a solo baseline
  assert.equal(r.model, 'opus');        // ...and every knob comes from that row
  assert.equal(r.effort, 'xhigh');
  assert.equal(r.agent, 'cad-executor-xhigh');
  assert.equal(r.verify, 'on');
  assert.equal(r.review.diff, 'blocking');
  const floor = floorEntries(r);
  assert.equal(floor.length, 1, JSON.stringify(r.reason));
  assert.match(floor[0], /auth/);            // the surface
  assert.match(floor[0], /session\.rs/);     // the path that matched
  assert.match(floor[0], /pattern "auth"/);  // the pattern that matched
  assert.match(floor[0], /solo -> critical/); // the baseline is still visible
});

test('the cursor fallback returns a bundle deep-equal to the --phase one (AC1)', () => {
  const files = ['README.md', 'src/auth/session.rs'];
  const explicit = resolve('cad-executor', planningRoot(files), ['--phase', '9']);
  const viaCursor = resolve('cad-executor', planningRoot(files, { cursor: 9 }));
  assert.equal(viaCursor.stakes, 'critical');
  assert.deepEqual(viaCursor, explicit); // nothing names HOW the phase was found
});

test('a PLAN matching no surface row resolves at the baseline with no floor entry', () => {
  const r = resolve('cad-executor', planningRoot(['README.md', 'src/main.rs']), ['--phase', '9']);
  assert.equal(r.ok, true);
  assert.equal(r.stakes, 'solo');
  assert.deepEqual(floorEntries(r), []);
  assert.equal(r.warnings, undefined);
});

test('a phase directory with no PLAN file is the baseline, ok:true, and silent', () => {
  const r = resolve('cad-executor', planningRoot(null, { emptyDir: true }), ['--phase', '9']);
  assert.equal(r.ok, true);
  assert.equal(r.stakes, 'solo');
  assert.deepEqual(floorEntries(r), []);
  assert.equal(r.warnings, undefined); // the pre-plan state is not news
});

test('neither --phase nor a cursor is the baseline, ok:true, and silent', () => {
  const r = resolve('cad-executor', planningRoot(['src/auth/session.rs']));
  assert.equal(r.ok, true);
  assert.equal(r.stakes, 'solo');
  assert.deepEqual(floorEntries(r), []);
  assert.equal(r.warnings, undefined);
});

test('an unreadable PLAN is the baseline plus exactly one warning naming the file', {
  skip: typeof process.getuid === 'function' && process.getuid() === 0
    ? 'root bypasses mode bits' : false,
}, () => {
  const file = planningRoot(['src/auth/session.rs']);
  const plan = join(dirname(file), 'phases', '9', 'PLAN.md');
  chmodSync(plan, 0o000);
  try {
    const r = resolve('cad-executor', file, ['--phase', '9']);
    assert.equal(r.ok, true);          // never {ok:false}: that routes LOWER
    assert.equal(r.stakes, 'solo');
    assert.deepEqual(floorEntries(r), []);
    assert.equal(r.warnings.length, 1, JSON.stringify(r.warnings));
    assert.match(r.warnings[0], /PLAN\.md/);
  } finally {
    chmodSync(plan, 0o644);
  }
});

test('a --phase that is not a phase number does NOT fall through to the cursor', () => {
  // The row that pins the no-fallthrough rule: answering a typo with a floor
  // computed from a DIFFERENT phase is worse than the value the user typed.
  const file = planningRoot(['src/auth/session.rs'], { cursor: 9 });
  const r = resolve('cad-executor', file, ['--phase', 'notanumber']);
  assert.equal(r.ok, true);
  assert.equal(r.stakes, 'solo');
  assert.deepEqual(floorEntries(r), []);
  assert.equal(r.warnings.length, 1, JSON.stringify(r.warnings));
  assert.match(r.warnings[0], /notanumber/);
  // ...and the same fixture DOES floor when the phase is named correctly.
  assert.equal(resolve('cad-executor', file, ['--phase', '9']).stakes, 'critical');
});

test('D-09: cad-planner and cad-assumptions-analyzer resolve at the baseline', () => {
  // Passing --phase explicitly, so the row proves the ROLE arm rather than an
  // absent phase: the cursor lags /cad-context, so "no PLAN yet" alone would
  // floor the analyzer off the PREVIOUS phase's file list.
  const file = planningRoot(['src/auth/session.rs']);
  for (const role of ['cad-planner', 'cad-assumptions-analyzer']) {
    const r = resolve(role, file, ['--phase', '9']);
    assert.equal(r.ok, true, role);
    assert.equal(r.stakes, 'solo', role);
    assert.deepEqual(floorEntries(r), [], role);
  }
  // the same fixture floors cad-executor, so the row is failing-capable
  assert.equal(resolve('cad-executor', file, ['--phase', '9']).stakes, 'critical');
});

test('a floor BELOW the baseline raises nothing and caps nothing (AC3)', () => {
  // The only way to exercise raiseTo's cap-never branch: every shipped row
  // floors to the top rung (D-03), so the sub-top floor is injected.
  const t = JSON.parse(JSON.stringify(SHIPPED_TABLE));
  t.surfaces.auth.floor = 'shipped';
  const tablePath = join(dir, 'floor-shipped-table.json');
  writeFileSync(tablePath, JSON.stringify(t));
  const file = planningRoot(['src/auth/session.rs'], { config: { stakes: 'critical' } });
  const r = resolve('cad-executor', file, ['--phase', '9'], { table: tablePath });
  assert.equal(r.ok, true);
  assert.equal(r.stakes, 'critical');   // held, never capped down to shipped
  assert.equal(r.model, 'opus');
  assert.equal(r.effort, 'xhigh');
  assert.equal(r.verify, 'on');
  assert.equal(r.review.phase_diff, 'adjudicated');
  const floor = floorEntries(r);
  assert.equal(floor.length, 1, JSON.stringify(r.reason));
  assert.match(floor[0], /already at or above it/);
});

test('a decimal phase addresses its own directory', () => {
  const file = planningRoot(['src/auth/session.rs'], { phase: '2.1' });
  assert.equal(resolve('cad-executor', file, ['--phase', '2.1']).stakes, 'critical');
});

// --- the per-surface waiver (D-05) -------------------------------------------

/** A fixture PLAN declaring two paths that match two DIFFERENT surfaces. */
const TWO_SURFACES = ['src/auth/login.rs', 'db/migrations/001.sql'];

test('two detected surfaces with no override resolve at the floor', () => {
  const r = resolve('cad-executor', planningRoot(TWO_SURFACES), ['--phase', '9']);
  assert.equal(r.stakes, 'critical');
  assert.equal(floorEntries(r).length, 2, JSON.stringify(r.reason));
});

test('waiving ONE of two detected surfaces still floors, and names both', () => {
  const file = planningRoot(TWO_SURFACES,
    { config: { stakes: 'solo', risk: { override: { auth: true } } } });
  const r = resolve('cad-executor', file, ['--phase', '9']);
  assert.equal(r.stakes, 'critical'); // migrations still stands
  const floor = floorEntries(r).join(' ');
  assert.match(floor, /risk\.override\.auth waives "auth"/);
  assert.match(floor, /surface "migrations" matched/);
  assert.equal(r.warnings, undefined);
});

test('waiving EVERY detected surface drops to the baseline, naming each waiver', () => {
  const file = planningRoot(TWO_SURFACES,
    { config: { stakes: 'solo', risk: { override: { auth: true, migrations: true } } } });
  const r = resolve('cad-executor', file, ['--phase', '9']);
  assert.equal(r.stakes, 'solo');
  assert.equal(r.model, 'sonnet'); // the solo cell, whole
  const floor = floorEntries(r);
  assert.equal(floor.length, 1, JSON.stringify(r.reason));
  assert.match(floor[0], /risk\.override\.auth/);
  assert.match(floor[0], /risk\.override\.migrations/);
  assert.doesNotMatch(floor[0], /matched/); // no raise entry survives
});

test('an override that is not strictly true does NOT waive, and says so', () => {
  for (const value of ['true', 1, {}]) {
    const file = planningRoot(['src/auth/login.rs'],
      { config: { stakes: 'solo', risk: { override: { auth: value } } } });
    const r = resolve('cad-executor', file, ['--phase', '9']);
    assert.equal(r.stakes, 'critical', JSON.stringify(value));
    assert.equal(r.warnings.length, 1, JSON.stringify(r.warnings));
    assert.match(r.warnings[0], /risk\.override\.auth/);
  }
});

test('an override set to false is the ordinary un-waived state, silently', () => {
  const file = planningRoot(['src/auth/login.rs'],
    { config: { stakes: 'solo', risk: { override: { auth: false } } } });
  const r = resolve('cad-executor', file, ['--phase', '9']);
  assert.equal(r.stakes, 'critical');
  assert.equal(r.warnings, undefined);
});

test('an override naming a surface the table does not declare warns and waives nothing', () => {
  const file = planningRoot(['src/auth/login.rs'],
    { config: { stakes: 'solo', risk: { override: { frobnicate: true } } } });
  const r = resolve('cad-executor', file, ['--phase', '9']);
  assert.equal(r.stakes, 'critical');
  assert.equal(r.warnings.length, 1, JSON.stringify(r.warnings));
  assert.match(r.warnings[0], /frobnicate/);
  assert.match(r.warnings[0], /auth/); // the accepted names
});

test('a waiver and a model pin coexist - two fields, not one', () => {
  // The row that guards the readConfig field split: folding riskOverrides into
  // `overrides` makes every model.overrides.<role> pin resolve undefined.
  const file = planningRoot(['src/auth/login.rs'], {
    config: {
      stakes: 'solo',
      risk: { override: { auth: true } },
      model: { overrides: { 'cad-executor': 'haiku' } },
    },
  });
  const r = resolve('cad-executor', file, ['--phase', '9']);
  assert.equal(r.pinned, true);
  assert.equal(r.model, 'haiku');
  assert.equal(r.stakes, 'solo'); // the waiver applied
  assert.match(floorEntries(r).join(' '), /waived by risk\.override\.auth/);
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

// --- the risk waiver is repo-scoped in BOTH directions (CFG-01, D-06) --------

// `risk.override.<surface>` is `src: repo` in config.schema.json. Read off the
// MERGED config, one line in one user-global file disabled the risk floor in
// every repository on the machine - the write face refused `--global` while
// the resolver honoured whatever got there anyway. The repo layer is the only
// one that waives now, and an ignored global waiver is named rather than
// dropped silently.

test('a waiver in the GLOBAL layer alone waives nothing and names itself', () => {
  const g = rawCfg({ risk: { override: { auth: true } } }, 'g-waive-auth.json');
  const file = planningRoot(['src/auth/login.rs'], { config: { stakes: 'solo' } });
  const r = resolve('cad-executor', file, ['--phase', '9'], { global: g });
  assert.equal(r.stakes, 'critical'); // the floor stands
  assert.equal(r.warnings.length, 1, JSON.stringify(r.warnings));
  assert.match(r.warnings[0], /risk\.override\.auth/);
  assert.match(r.warnings[0], /src: repo/);            // the rule that ignored it
  assert.match(r.warnings[0], /\.planning\/config\.json/); // and where it belongs
  assert.deepEqual(floorEntries(r).filter((x) => /waive/.test(x)), []);
});

test('the SAME waiver in the repo file still waives - the regression guard', () => {
  const file = planningRoot(['src/auth/login.rs'],
    { config: { stakes: 'solo', risk: { override: { auth: true } } } });
  const r = resolve('cad-executor', file, ['--phase', '9']);
  assert.equal(r.stakes, 'solo');
  assert.equal(r.warnings, undefined);
  assert.match(floorEntries(r).join(' '), /waived by risk\.override\.auth/);
});

test('both layers naming it: the repo value waives, the global one is still named', () => {
  const g = rawCfg({ risk: { override: { auth: true } } }, 'g-waive-auth2.json');
  const file = planningRoot(['src/auth/login.rs'],
    { config: { stakes: 'solo', risk: { override: { auth: true } } } });
  const r = resolve('cad-executor', file, ['--phase', '9'], { global: g });
  assert.equal(r.stakes, 'solo'); // waived, by the repo layer's own value
  assert.equal(r.warnings.length, 1, JSON.stringify(r.warnings));
  assert.match(r.warnings[0], /risk\.override\.auth/);
});

test('a global `risk.override` set to false warns about nothing', () => {
  // A waiver the global layer only NAMES is not one it makes: warning here
  // would put a "move your waiver" line on every dispatch in every repo.
  const g = rawCfg({ risk: { override: { auth: false } } }, 'g-waive-false.json');
  const file = planningRoot(['src/auth/login.rs'], { config: { stakes: 'solo' } });
  const r = resolve('cad-executor', file, ['--phase', '9'], { global: g });
  assert.equal(r.stakes, 'critical');
  assert.equal(r.warnings, undefined);
});

test('a global layer carrying only `stakes` merges exactly as before', () => {
  // The additive `layers` field must change nothing about the ordinary merge.
  const g = cfg({ stakes: 'critical' }, 'g-only-stakes.json');
  const file = planningRoot(null, { config: {} });
  const r = resolve('cad-executor', file, ['--phase', '9'], { global: g });
  assert.equal(r.stakes, 'critical');
  assert.equal(r.model, 'opus');
  assert.match(r.reason.join(' '), /config:global\+repo/);
  assert.equal(r.warnings, undefined);
});
