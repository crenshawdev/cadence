// Zero-dep tests for route.mjs. Run: node --test 'cadence-core/bin/*.test.mjs'
// Uses only node: builtins (no framework), matching the repo's zero-dep ethos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { agentForRung, rungAgents } from './lib/rung-agent.mjs';

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
// point CADENCE_GLOBAL_CONFIG at a real global file for merge tests.
function resolve(role, file, extra = [], opts = {}) {
  const args = ['resolve', '--role', role, ...(file ? ['--file', file] : []), ...extra];
  const env = { ...process.env, CADENCE_GLOBAL_CONFIG: opts.global || NO_GLOBAL };
  try {
    return JSON.parse(execFileSync('node', [ROUTE, ...args], { encoding: 'utf8', env }));
  } catch (e) {
    // Degraded results exit 1 (seam convention); the JSON line is on stdout.
    return JSON.parse(e.stdout);
  }
}

test('each stakes level resolves the matrix per role tier', () => {
  const solo = cfg({ stakes: 'solo' });
  // One full-shape assertion pins the whole resolution contract...
  const planner = resolve('cad-planner', solo);
  assert.equal(planner.ok, true);
  assert.equal(planner.model, 'sonnet');          // heavy@solo
  assert.equal(planner.tier, 'heavy');
  assert.equal(planner.effort, 'high');           // role base_effort
  assert.equal(planner.agent, 'cad-planner');     // no variant swap
  assert.equal(planner.stakes, 'solo');
  // ...then the rest of the matrix: model + tier + effort per role.
  const exec = resolve('cad-executor', solo);
  assert.deepEqual([exec.model, exec.tier, exec.effort], ['haiku', 'standard', 'high']);
  const checker = resolve('cad-plan-checker', solo);
  assert.deepEqual([checker.model, checker.tier, checker.effort, checker.agent],
    ['haiku', 'light', 'low', 'cad-plan-checker']);

  const critical = cfg({ stakes: 'critical' });
  assert.equal(resolve('cad-planner', critical).model, 'opus');
  assert.equal(resolve('cad-executor', critical).model, 'opus');
  const cc = resolve('cad-plan-checker', critical);
  assert.deepEqual([cc.ok, cc.model, cc.tier], [true, 'sonnet', 'light']);
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
  assert.equal(first.agent, 'cad-plan-checker');
  assert.equal(first.stakes, 'shipped');

  const retry = resolve('cad-plan-checker', missing, ['--attempt', '2']);
  assert.equal(retry.ok, true);
  assert.equal(retry.agent, 'cad-plan-checker-high');
  assert.equal(retry.effort, 'high');
  assert.equal(retry.escalated, true);
  assert.equal(retry.stakes, 'shipped');
  assert.equal(retry.model, 'haiku');              // light@shipped - the rung climbs, the model holds
});

test('escalation fires at every stakes level, not just the default', () => {
  for (const stakes of ['solo', 'shipped', 'critical']) {
    const r = resolve('cad-plan-checker', cfg({ stakes }), ['--attempt', '2']);
    assert.equal(r.agent, 'cad-plan-checker-high', stakes);
    assert.equal(r.escalated, true, stakes);
  }
});

test('model.escalate_on_failure: false holds the rung and names the key in reason', () => {
  const off = cfg({ escalate_on_failure: false });
  const r = resolve('cad-plan-checker', off, ['--attempt', '3']);
  assert.equal(r.escalated, false);
  assert.equal(r.agent, 'cad-plan-checker');
  assert.equal(r.effort, 'low');
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

test('table dumps the routing table (roles + matrix present)', () => {
  const env = { ...process.env, CADENCE_GLOBAL_CONFIG: NO_GLOBAL };
  const r = JSON.parse(execFileSync('node', [ROUTE, 'table'], { encoding: 'utf8', env }));
  assert.equal(r.ok, true);
  assert.deepEqual(r.table.tier_order, ['light', 'standard', 'heavy']);
  assert.ok(r.table.roles['cad-planner']);
  assert.ok(r.table.stakes.shipped);
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
  assert.equal(r.model, 'sonnet');  // light@critical
  assert.equal(r.agent, 'cad-plan-checker');
  assert.equal(r.escalated, false);
});

// --- per-role model overrides ------------------------------------------------

test('an override pins one role and leaves the others routed', () => {
  const c = cfg({ stakes: 'shipped', overrides: { 'cad-planner': 'fable' } }, 'ovr-planner.json');
  const planner = resolve('cad-planner', c);
  assert.equal(planner.ok, true);
  assert.equal(planner.model, 'fable');   // pinned, not heavy@shipped (opus)
  assert.equal(planner.pinned, true);
  assert.equal(planner.tier, 'heavy');    // tier still reported honestly
  assert.equal(planner.effort, 'high');   // effort is frontmatter, untouched
  assert.match(planner.reason.join(' '), /override cad-planner: opus -> fable/);
  // a sibling role is unaffected
  const exec = resolve('cad-executor', c);
  assert.equal(exec.model, 'sonnet');     // standard@shipped
  assert.equal(exec.pinned, false);
});

test('fable is reachable only by pin, never by the stakes matrix', () => {
  const env = { ...process.env, CADENCE_GLOBAL_CONFIG: NO_GLOBAL };
  const t = JSON.parse(execFileSync('node', [ROUTE, 'table'], { encoding: 'utf8', env })).table;
  assert.ok(t.model_aliases.includes('fable'));
  // `rungs` now names the effort ladder, so this local is the matrix's models.
  const matrixModels = Object.values(t.stakes).flatMap((row) => Object.values(row));
  assert.equal(matrixModels.includes('fable'), false);
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

test('every role base_effort matches the agent file frontmatter that runs it', () => {
  for (const [role, spec] of Object.entries(SHIPPED_TABLE.roles)) {
    assert.equal(frontmatterEffort(role), spec.base_effort, `${role} base_effort`);
  }
  // cad-reviewer is the one the review subsystem documents by value: the
  // per-trigger `effort` config key cannot reach it, so the docs name what it
  // does run at. Pin that literal.
  assert.equal(frontmatterEffort('cad-reviewer'), 'high');
});

test('every rung the table can name has an agent file carrying exactly that effort', () => {
  // The ladder-consistency row. route.mjs REPORTS a rung's effort; the only
  // thing that makes the report true is the file for that rung agreeing. This
  // walks the WHOLE table rather than the single escalation the pre-ladder
  // row covered, so a rung added to the data with no file (or with the wrong
  // frontmatter) fails here, not at spawn time.
  /** @type {Map<string,string>} rung agent name -> the rung that produced it */
  const byName = new Map();
  for (const [role, spec] of Object.entries(SHIPPED_TABLE.roles)) {
    for (const rung of [spec.base_effort, ...spec.rungs, spec.escalate_to]) {
      byName.set(agentForRung(role, spec, rung), rung);
    }
    // rungAgents is the shared statement of the same mapping; the two must
    // agree, or route.mjs and self-verify.mjs are looking at different sets.
    assert.deepEqual(
      [...new Set(rungAgents(role, spec))].sort(),
      [...new Set([spec.base_effort, ...spec.rungs, spec.escalate_to]
        .map((r) => agentForRung(role, spec, r)))].sort(),
      `${role} rungAgents`,
    );
  }
  assert.equal(byName.size, 13, `routable agent names: ${[...byName.keys()].join(', ')}`);
  for (const [name, rung] of byName) {
    assert.ok(existsSync(join(AGENTS, `${name}.md`)), `agents/${name}.md must exist`);
    assert.equal(frontmatterEffort(name), rung, `${name} frontmatter effort`);
  }
});

test('table exposes rung_order, the five rungs the host accepts', () => {
  const env = { ...process.env, CADENCE_GLOBAL_CONFIG: NO_GLOBAL };
  const r = JSON.parse(execFileSync('node', [ROUTE, 'table'], { encoding: 'utf8', env }));
  assert.deepEqual(r.table.rung_order, ['low', 'medium', 'high', 'xhigh', 'max']);
});

test('escalate_to is the SOURCE of the swap - repointing it moves the resolved agent', () => {
  // Pins the mechanism rather than the shipped outcome: a name no code
  // hardcodes (`cad-plan-checker-xhigh`) must appear purely because the data
  // says so. If route.mjs went back to hardcoding a variant name or effort,
  // this row fails while every shipped-value row above still passes.
  const t = JSON.parse(JSON.stringify(SHIPPED_TABLE));
  t.roles['cad-plan-checker'].rungs = ['low', 'high', 'xhigh'];
  t.roles['cad-plan-checker'].escalate_to = 'xhigh';
  const tablePath = join(dir, 'escalate-to-xhigh.json');
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

test('a role whose escalate_to IS its base rung keeps the base agent on failure', () => {
  // cad-planner escalates to `high`, which is already its base_effort, so the
  // rung arm is a no-op and must report itself as held rather than resolving
  // `cad-planner-high` - a file that deliberately does not exist.
  const c = cfg({ stakes: 'shipped' });
  const r = resolve('cad-planner', c, ['--attempt', '2']);
  assert.equal(r.agent, 'cad-planner');
  assert.equal(r.effort, 'high');
  assert.match(r.reason.join(' '), /rung held at high/);
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
