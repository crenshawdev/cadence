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

// Write a config with the given model block and return its path. A counter
// guarantees uniqueness - deriving names from the config's content collided
// when two distinct configs shared a length/profile/ceiling.
let cfgN = 0;
function cfg(model, name) {
  const p = join(dir, name || `c-${++cfgN}.json`);
  writeFileSync(p, JSON.stringify({ model }));
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

test('fixed profiles resolve the matrix per role tier', () => {
  const fast = cfg({ profile: 'fast' });
  // One full-shape assertion pins the whole resolution contract...
  const planner = resolve('cad-planner', fast);
  assert.equal(planner.ok, true);
  assert.equal(planner.model, 'sonnet');          // heavy@fast
  assert.equal(planner.tier, 'heavy');
  assert.equal(planner.effort, 'high');           // role base_effort
  assert.equal(planner.agent, 'cad-planner');     // no variant swap
  assert.equal(planner.profile, 'fast');
  // ...then the rest of the matrix: model + tier + effort per role.
  const exec = resolve('cad-executor', fast);
  assert.deepEqual([exec.model, exec.tier, exec.effort], ['haiku', 'standard', 'high']);
  const checker = resolve('cad-plan-checker', fast);
  assert.deepEqual([checker.model, checker.tier, checker.effort, checker.agent],
    ['haiku', 'light', 'low', 'cad-plan-checker']);

  const quality = cfg({ profile: 'quality' });
  assert.equal(resolve('cad-planner', quality).model, 'opus');
  assert.equal(resolve('cad-executor', quality).model, 'opus');
  const cq = resolve('cad-plan-checker', quality);
  assert.deepEqual([cq.ok, cq.model, cq.tier], [true, 'sonnet', 'light']);
});

test('fixed profile never escalates even at attempt 3 (explicit pick wins)', () => {
  const balanced = cfg({ profile: 'balanced' });
  const r = resolve('cad-planner', balanced, ['--attempt', '3']);
  assert.equal(r.escalated, false);
  assert.equal(r.profile, 'balanced');
});

test('auto: clean run uses base profile, no escalation', () => {
  const a = cfg({ profile: 'auto', auto: { ceiling: 'quality', escalate_on_failure: true, max_escalations: 1 } });
  const r = resolve('cad-planner', a);
  assert.equal(r.escalated, false);
  assert.equal(r.profile, 'balanced');
  assert.equal(r.model, 'opus'); // heavy@balanced
});

test('auto: difficulty signal bumps tier (standard -> heavy)', () => {
  const a = cfg({ profile: 'auto', auto: { ceiling: 'quality', escalate_on_failure: true, max_escalations: 1 } });
  const r = resolve('cad-executor', a, ['--files', '30']);
  assert.equal(r.tier, 'heavy');
  assert.equal(r.model, 'opus'); // heavy@balanced
  assert.equal(r.escalated, true);
});

test('auto: failure escalates profile toward ceiling and swaps the rung', () => {
  const a = cfg({ profile: 'auto', auto: { ceiling: 'quality', escalate_on_failure: true, max_escalations: 1 } });
  const r = resolve('cad-plan-checker', a, ['--attempt', '2']);
  assert.equal(r.profile, 'quality');
  assert.equal(r.agent, 'cad-plan-checker-high'); // rung swap
  assert.equal(r.model, 'sonnet'); // light@quality
});

test('auto: max_escalations caps the profile step', () => {
  const a = cfg({ profile: 'auto', auto: { ceiling: 'quality', escalate_on_failure: true, max_escalations: 1 } });
  // attempt 3 would be 2 steps, but max is 1 -> still one step from balanced
  const r = resolve('cad-planner', a, ['--attempt', '3']);
  assert.equal(r.profile, 'quality'); // balanced -> quality is one step; capped there
});

test('auto: escalate_on_failure=false disables failure escalation', () => {
  const a = cfg({ profile: 'auto', auto: { ceiling: 'quality', escalate_on_failure: false, max_escalations: 3 } });
  const r = resolve('cad-planner', a, ['--attempt', '3']);
  assert.equal(r.escalated, false);
  assert.equal(r.profile, 'balanced');
});

test('auto: ceiling at/below base disables escalation - a retry is never demoted', () => {
  const a = cfg({ profile: 'auto', auto: { ceiling: 'fast', escalate_on_failure: true, max_escalations: 3 } });
  const r = resolve('cad-planner', a, ['--attempt', '2']);
  assert.equal(r.profile, 'balanced'); // held at base, NOT dropped to fast
  assert.equal(r.model, 'opus');       // heavy@balanced
  assert.equal(r.escalated, false);    // nothing actually changed for this role
  assert.match(r.reason.join(' '), /never demotes/);
});

test('auto: held profile still swaps the rung on failure', () => {
  // Ceiling blocks the profile raise, but the failure signal still climbs the
  // rung ladder for roles whose escalate_to leaves their base rung (same model
  // spend, harder reasoning).
  const a = cfg({ profile: 'auto', auto: { ceiling: 'balanced', escalate_on_failure: true, max_escalations: 1 } });
  const r = resolve('cad-plan-checker', a, ['--attempt', '2']);
  assert.equal(r.profile, 'balanced');            // held at base
  assert.equal(r.agent, 'cad-plan-checker-high'); // rung swap still happens
  assert.equal(r.effort, 'high');
  assert.equal(r.escalated, true);                // the rung swap IS a change
});

test('auto: ambiguity signal bumps tier; below threshold does not', () => {
  const a = cfg({ profile: 'auto', auto: { ceiling: 'quality', escalate_on_failure: true, max_escalations: 1 } });
  const bumped = resolve('cad-executor', a, ['--ambiguity', '0.8']);
  assert.deepEqual([bumped.tier, bumped.model, bumped.escalated], ['heavy', 'opus', true]);
  const calm = resolve('cad-executor', a, ['--ambiguity', '0.5']); // threshold is 0.6
  assert.deepEqual([calm.tier, calm.model, calm.escalated], ['standard', 'sonnet', false]);
});

test('auto: two difficulty signals still bump only max_tier_bump (one) tier', () => {
  const a = cfg({ profile: 'auto', auto: { ceiling: 'quality', escalate_on_failure: true, max_escalations: 1 } });
  const r = resolve('cad-plan-checker', a, ['--files', '30', '--ambiguity', '0.9']);
  assert.equal(r.tier, 'standard'); // light +1, NOT +2 to heavy
  assert.equal(r.model, 'sonnet');  // standard@balanced
});

test('auto: a heavy role clamps at the tier top under a difficulty bump', () => {
  const a = cfg({ profile: 'auto', auto: { ceiling: 'quality', escalate_on_failure: true, max_escalations: 1 } });
  const r = resolve('cad-planner', a, ['--files', '30']);
  assert.equal(r.tier, 'heavy'); // already at the top - no overshoot
  assert.equal(r.model, 'opus'); // heavy@balanced
});

test('bad enum string in config degrades to unresolved, never crashes', () => {
  const r = resolve('cad-planner', cfg({ profile: 'ludicrous' }));
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'unresolved');
  assert.equal(r.profile, 'ludicrous'); // names the value that failed to resolve
});

test('resolve: a non-integer --attempt is usage, not silently coerced (#45.2)', () => {
  const r = resolve('cad-planner', cfg({ profile: 'fast' }), ['--attempt', 'abc']);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'usage');

  const ok = resolve('cad-planner', cfg({ profile: 'fast' }), ['--attempt', '2']);
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
  assert.ok(r.table.profiles.balanced);
});

test('unknown role degrades to ok:false (caller falls back to session default)', () => {
  const balanced = cfg({ profile: 'balanced' });
  const r = resolve('cad-nope', balanced);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'unknown-role');
});

test('missing config file uses schema defaults, does not crash', () => {
  const r = resolve('cad-planner', join(dir, 'does-not-exist.json'));
  assert.equal(r.ok, true);
  assert.equal(r.profile, 'balanced');
  assert.match(r.reason.join(' '), /config:defaults/);
});

// --- global config layer -----------------------------------------------------

test('global layer applies when no repo config is present', () => {
  const g = cfg({ profile: 'quality' }, 'g-quality.json');
  const r = resolve('cad-planner', join(dir, 'no-repo.json'), [], { global: g });
  assert.equal(r.profile, 'quality');
  assert.equal(r.model, 'opus'); // heavy@quality
  assert.match(r.reason.join(' '), /config:global/);
});

test('repo config overrides the global layer (repo wins)', () => {
  const g = cfg({ profile: 'quality' }, 'g-quality2.json');
  const repo = cfg({ profile: 'fast' }, 'repo-fast.json');
  const r = resolve('cad-planner', repo, [], { global: g });
  assert.equal(r.profile, 'fast'); // repo wins over global
  assert.equal(r.model, 'sonnet'); // heavy@fast
  assert.match(r.reason.join(' '), /config:global\+repo/);
});

test('layers deep-merge: global auto block + repo profile combine', () => {
  const g = cfg({ profile: 'balanced', auto: { ceiling: 'quality', escalate_on_failure: true, max_escalations: 1 } }, 'g-auto.json');
  const repo = cfg({ profile: 'auto' }, 'repo-auto.json'); // only overrides profile
  // repo sets auto profile; global supplies the auto.* sub-keys -> escalation works
  const r = resolve('cad-plan-checker', repo, ['--attempt', '2'], { global: g });
  assert.equal(r.profile, 'quality'); // escalated using global's ceiling
  assert.equal(r.agent, 'cad-plan-checker-high');
});

// --- per-role model overrides ------------------------------------------------

test('an override pins one role and leaves the others routed', () => {
  const c = cfg({ profile: 'balanced', overrides: { 'cad-planner': 'fable' } }, 'ovr-planner.json');
  const planner = resolve('cad-planner', c);
  assert.equal(planner.ok, true);
  assert.equal(planner.model, 'fable');   // pinned, not heavy@balanced (opus)
  assert.equal(planner.pinned, true);
  assert.equal(planner.tier, 'heavy');    // tier still reported honestly
  assert.equal(planner.effort, 'high');   // effort is frontmatter, untouched
  assert.match(planner.reason.join(' '), /override cad-planner: opus -> fable/);
  // a sibling role is unaffected
  const exec = resolve('cad-executor', c);
  assert.equal(exec.model, 'sonnet');     // standard@balanced
  assert.equal(exec.pinned, false);
});

test('fable is reachable only by pin, never by the profile matrix', () => {
  const env = { ...process.env, CADENCE_GLOBAL_CONFIG: NO_GLOBAL };
  const t = JSON.parse(execFileSync('node', [ROUTE, 'table'], { encoding: 'utf8', env })).table;
  assert.ok(t.model_aliases.includes('fable'));
  // `rungs` now names the effort ladder, so this local is the matrix's models.
  const matrixModels = Object.values(t.profiles).flatMap((p) => Object.values(p));
  assert.equal(matrixModels.includes('fable'), false);
});

test('a pin beats auto escalation but keeps the rung swap', () => {
  const c = cfg(
    { profile: 'auto', auto: { ceiling: 'quality', escalate_on_failure: true, max_escalations: 1 },
      overrides: { 'cad-plan-checker': 'fable' } },
    'ovr-checker.json',
  );
  const r = resolve('cad-plan-checker', c, ['--attempt', '2']);
  assert.equal(r.model, 'fable');                 // pin wins over the escalated profile
  assert.equal(r.agent, 'cad-plan-checker-high'); // ...but harder reasoning still applies
  assert.equal(r.pinned, true);
});

test('an unknown alias warns and leaves the routed model standing', () => {
  const c = cfg({ profile: 'balanced', overrides: { 'cad-planner': 'gpt-5' } }, 'ovr-bogus.json');
  const r = resolve('cad-planner', c);
  assert.equal(r.ok, true);      // never blocks the spawn
  assert.equal(r.model, 'opus'); // typo does not silently redirect the spend
  assert.equal(r.pinned, false);
  assert.match(r.warning, /not a known alias/);
});

test('a pin matching the routed model is a no-op, still marked pinned', () => {
  const c = cfg({ profile: 'balanced', overrides: { 'cad-planner': 'opus' } }, 'ovr-noop.json');
  const r = resolve('cad-planner', c);
  assert.equal(r.model, 'opus');
  assert.equal(r.pinned, true);
  assert.match(r.reason.join(' '), /already the routed model/);
});

test('overrides layer: repo pin wins over a global pin', () => {
  const g = cfg({ profile: 'balanced', overrides: { 'cad-planner': 'haiku' } }, 'g-ovr.json');
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

  const a = cfg({ profile: 'auto', auto: { ceiling: 'quality', escalate_on_failure: true, max_escalations: 1 } });
  const env = { ...process.env, CADENCE_GLOBAL_CONFIG: NO_GLOBAL, CADENCE_ROUTE_TABLE: tablePath };
  const args = ['resolve', '--role', 'cad-plan-checker', '--file', a, '--attempt', '2'];
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
  const a = cfg({ profile: 'auto', auto: { ceiling: 'quality', escalate_on_failure: true, max_escalations: 1 } });
  const r = resolve('cad-planner', a, ['--attempt', '2']);
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
