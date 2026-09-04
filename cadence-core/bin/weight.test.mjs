// Zero-dep tests for weight.mjs (the context-weight seam). Run:
// node --test 'cadence-core/bin/*.test.mjs'
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEIGHT = join(HERE, 'weight.mjs');
const REPO = join(HERE, '..', '..');

/** Run weight.mjs against a root, returning the raw stdout string. */
function raw(root) {
  return execFileSync('node', [WEIGHT, '--root', root], { encoding: 'utf8' });
}
/** Run weight.mjs against a root, returning parsed JSON. */
function run(root) {
  return JSON.parse(raw(root));
}
/**
 * Run `weight.mjs resident` against a root with extra args, returning the raw
 * stdout string even when the seam exits 1 (an `ok:false` envelope is still
 * one JSON line on stdout).
 */
function rawResident(root, ...args) {
  try {
    return execFileSync('node', [WEIGHT, 'resident', '--root', root, ...args], { encoding: 'utf8' });
  } catch (e) {
    if (typeof e.stdout === 'string' && e.stdout) return e.stdout;
    throw e;
  }
}
/** Run `weight.mjs resident`, returning parsed JSON. */
function resident(root, ...args) {
  return JSON.parse(rawResident(root, ...args));
}
/** @param {{bytes: number}[]} list */
const sumBytes = (list) => list.reduce((n, f) => n + f.bytes, 0);

test('shape: ok true, non-empty surfaces with typed fields', () => {
  const j = run(REPO);
  assert.equal(j.ok, true);
  assert.ok(Array.isArray(j.surfaces) && j.surfaces.length > 0);
  for (const s of j.surfaces) {
    assert.equal(typeof s.surface, 'string');
    assert.equal(typeof s.bytes, 'number');
    assert.equal(typeof s.estTokens, 'number');
  }
});

test('surface set is agents, skills, workflows plus references/** and templates/** (D-01)', () => {
  const paths = run(REPO).surfaces.map((s) => s.surface);
  assert.ok(paths.includes('agents/cad-planner.md'));
  assert.ok(paths.some((p) => /^skills\/.+\/SKILL\.md$/.test(p)));
  assert.ok(paths.some((p) => /^cadence-core\/workflows\/.+\.md$/.test(p)));
  // Widened by D-01: both directories are walked whole, so a reference that
  // grows fails the budget the same way a workflow does.
  assert.ok(paths.some((p) => p.startsWith('cadence-core/references/')));
  assert.ok(paths.some((p) => p.startsWith('cadence-core/templates/')));
  // And by EVERY file, not just `.md` - a JSON reference is budgeted too.
  assert.ok(paths.includes('cadence-core/references/model-hints.json'));
  // Still excluded: README is on self-verify's lint walk, not the weighed one.
  assert.ok(!paths.includes('README.md'));
});

test('determinism: two runs on the same tree are byte-identical', () => {
  assert.equal(raw(REPO), raw(REPO));
});

test('empty tree: no surface dirs yields ok true and surfaces []', () => {
  const root = mkdtempSync(join(tmpdir(), 'cad-weight-empty-'));
  const j = run(root);
  assert.equal(j.ok, true);
  assert.deepEqual(j.surfaces, []);
});

test('#49.1: a dangling symlink or symlink cycle under a measured surface is skipped, not thrown', () => {
  const root = mkdtempSync(join(tmpdir(), 'cad-weight-symlink-'));
  mkdirSync(join(root, 'agents'), { recursive: true });
  mkdirSync(join(root, 'skills', 'x'), { recursive: true });
  mkdirSync(join(root, 'skills', 'y'), { recursive: true });
  mkdirSync(join(root, 'cadence-core', 'workflows'), { recursive: true });
  // One readable control per walker branch, so a regression where the new
  // catch-all wrapper swallows an ENTIRE tree (returning [] for all of
  // skills or all of workflows) is caught - with only agents/good.md present
  // that regression would pass this test unnoticed.
  writeFileSync(join(root, 'agents', 'good.md'), 'agent body');
  writeFileSync(join(root, 'skills', 'y', 'SKILL.md'), 'skill body');
  writeFileSync(join(root, 'cadence-core', 'workflows', 'good.md'), 'workflow body');
  // One dangling/cycle symlink per stat site.
  symlinkSync('nowhere.md', join(root, 'agents', 'dangling.md'));
  symlinkSync('b.md', join(root, 'agents', 'a.md'));
  symlinkSync('a.md', join(root, 'agents', 'b.md'));
  symlinkSync('nowhere.md', join(root, 'skills', 'x', 'SKILL.md'));
  symlinkSync('nowhere.md', join(root, 'cadence-core', 'workflows', 'w.md'));

  const j = run(root);
  assert.equal(j.ok, true);
  assert.deepEqual(Object.keys(j).sort(), ['checked', 'ok', 'surfaces']);
  assert.deepEqual(j.surfaces.map((s) => s.surface).sort(), [
    'agents/good.md',
    'cadence-core/workflows/good.md',
    'skills/y/SKILL.md',
  ]);
});

test('BUD-02: an unreadable sibling directory hides only itself', {
  skip:
    typeof process.getuid === 'function' && process.getuid() === 0
      ? 'root bypasses mode bits'
      : false,
}, () => {
  const root = mkdtempSync(join(tmpdir(), 'cad-weight-unreadable-'));
  mkdirSync(join(root, 'skills', 'good'), { recursive: true });
  writeFileSync(join(root, 'skills', 'good', 'SKILL.md'), 'good skill body');
  const priv = join(root, 'skills', 'private');
  mkdirSync(priv);
  chmodSync(priv, 0o000);
  try {
    const j = run(root);
    assert.equal(j.ok, true);
    assert.ok(j.surfaces.map((s) => s.surface).includes('skills/good/SKILL.md'));
  } finally {
    chmodSync(priv, 0o755);
  }
});

test('D-07: a symlinked directory is not descended, so a cycle counts one surface', () => {
  const root = mkdtempSync(join(tmpdir(), 'cad-weight-dircycle-'));
  mkdirSync(join(root, 'skills', 'a'), { recursive: true });
  writeFileSync(join(root, 'skills', 'a', 'SKILL.md'), 'x');
  symlinkSync('..', join(root, 'skills', 'a', 'loop'));
  assert.deepEqual(
    run(root).surfaces.map((s) => s.surface),
    ['skills/a/SKILL.md'],
  );
});

test('a symlinked branch ROOT is descended (the qualified half of D-07)', () => {
  const root = mkdtempSync(join(tmpdir(), 'cad-weight-linkroot-'));
  mkdirSync(join(root, 'skills-real', 'a'), { recursive: true });
  writeFileSync(join(root, 'skills-real', 'a', 'SKILL.md'), 'y');
  symlinkSync('skills-real', join(root, 'skills'));
  assert.ok(run(root).surfaces.map((s) => s.surface).includes('skills/a/SKILL.md'));
});

// --- the `resident` subcommand: what one command and one dispatch carry ------

test('resident: envelope shape, and the legacy invocation is untouched', () => {
  const j = resident(REPO);
  assert.equal(j.ok, true);
  assert.equal(j.checked, 'resident-weight');
  assert.deepEqual(Object.keys(j).sort(),
    ['checked', 'commands', 'ok', 'roles', 'zeroResident', 'zeroResidentBytes']);
  assert.ok(j.commands.length > 0 && j.roles.length > 0);
  for (const c of j.commands) {
    assert.equal(typeof c.command, 'string');
    assert.equal(typeof c.eagerBytes, 'number');
    assert.equal(typeof c.reachableBytes, 'number');
    assert.ok(Array.isArray(c.eagerFiles) && Array.isArray(c.reachableFiles));
    // Reachable is the eager set PLUS one hop, so it can never be smaller.
    assert.ok(c.reachableBytes >= c.eagerBytes, c.command);
  }
  // The no-subcommand form still emits the surface list `weight-budgets.json`
  // is regenerated from - the phase's own tooling calls it that way.
  const legacy = run(REPO);
  assert.equal(legacy.checked, 'surface-weight');
  assert.ok(Array.isArray(legacy.surfaces) && legacy.surfaces.length > 0);
});

test('resident: two runs on the same tree are byte-identical', () => {
  assert.equal(rawResident(REPO), rawResident(REPO));
});

test('resident: sorted - commands by name, roles by agent, file lists by surface', () => {
  const j = resident(REPO);
  const sorted = (a) => [...a].sort().join('\n') === a.join('\n');
  assert.ok(sorted(j.commands.map((c) => c.command)));
  assert.ok(sorted(j.roles.map((r) => r.agent)));
  assert.ok(sorted(j.zeroResident.map((z) => z.surface)));
  for (const c of j.commands) {
    assert.ok(sorted(c.eagerFiles.map((f) => f.surface)), c.command);
    assert.ok(sorted(c.reachableFiles.map((f) => f.surface)), c.command);
  }
});

test('AC1: --command eagerBytes is the sum of the files that same envelope lists', () => {
  const j = resident(REPO, '--command', 'cad-land');
  assert.equal(j.commands.length, 1);
  const c = j.commands[0];
  assert.equal(c.command, 'cad-land');
  // Asserted against the envelope's OWN file list, never a fixed count: the
  // deferral this phase makes changes which files are eager, and a hardcoded
  // expectation here would fail on the cut it exists to measure.
  assert.equal(c.eagerBytes, sumBytes(c.eagerFiles));
  assert.equal(c.reachableBytes, sumBytes(c.reachableFiles));
  assert.ok(c.eagerFiles.some((f) => f.surface === 'skills/cad-land/SKILL.md'));
});

test('AC1: --role returns EVERY agent under that role, each summed on its own', () => {
  const j = resident(REPO, '--role', 'cad-executor');
  // Every rung file preloads the one contract skill, so the role has one
  // dispatch weight per rung and no single role-wide figure exists to assert.
  assert.deepEqual(j.roles.map((r) => r.agent).sort(),
    ['agents/cad-executor-low.md', 'agents/cad-executor-max.md',
      'agents/cad-executor-medium.md', 'agents/cad-executor-xhigh.md',
      'agents/cad-executor.md']);
  for (const r of j.roles) {
    assert.equal(r.role, 'cad-executor');
    assert.equal(r.dispatchBytes, r.agentBytes + sumBytes(r.contracts));
    assert.deepEqual(r.contracts.map((c) => c.surface),
      ['skills/cad-executor-contract/SKILL.md']);
  }
});

test('resident: a filter narrows only its own array - zeroResident is unmoved', () => {
  const all = resident(REPO);
  const one = resident(REPO, '--command', 'cad-land');
  assert.deepEqual(one.zeroResident, all.zeroResident);
  assert.equal(one.zeroResidentBytes, all.zeroResidentBytes);
});

test('resident: an unknown --command or --role is ok:false, naming the name', () => {
  const c = resident(REPO, '--command', 'cad-nope');
  assert.equal(c.ok, false);
  assert.equal(c.reason, 'unknown-command');
  assert.equal(c.detail, 'cad-nope');
  const r = resident(REPO, '--role', 'cad-nope');
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'unknown-role');
  assert.equal(r.detail, 'cad-nope');
});

test('resident: a missing @-include contributes 0 rather than throwing', () => {
  const root = mkdtempSync(join(tmpdir(), 'cad-resident-missing-'));
  mkdirSync(join(root, 'skills', 'cad-x'), { recursive: true });
  const body = '---\nname: cad-x\n---\n\n@${CLAUDE_PLUGIN_ROOT}/cadence-core/workflows/gone.md\n';
  writeFileSync(join(root, 'skills', 'cad-x', 'SKILL.md'), body);
  const j = resident(root);
  assert.equal(j.ok, true);
  assert.equal(j.commands.length, 1);
  assert.equal(j.commands[0].eagerBytes, Buffer.byteLength(body, 'utf8'));
  assert.deepEqual(j.commands[0].eagerFiles.map((f) => f.surface), ['skills/cad-x/SKILL.md']);
});

test('resident: a *-contract skill is a role, never a command (D-05)', () => {
  const root = mkdtempSync(join(tmpdir(), 'cad-resident-contract-'));
  mkdirSync(join(root, 'skills', 'cad-x-contract'), { recursive: true });
  mkdirSync(join(root, 'skills', 'cad-x'), { recursive: true });
  mkdirSync(join(root, 'agents'), { recursive: true });
  const contract = '---\nname: cad-x-contract\nuser-invocable: false\n---\n\ncontract prose\n';
  writeFileSync(join(root, 'skills', 'cad-x-contract', 'SKILL.md'), contract);
  writeFileSync(join(root, 'skills', 'cad-x', 'SKILL.md'), '---\nname: cad-x\n---\n\nx\n');
  const agent = '---\nname: cad-x\nskills:\n  - cad-x-contract\n---\n\npointer\n';
  writeFileSync(join(root, 'agents', 'cad-x.md'), agent);
  const j = resident(root);
  assert.deepEqual(j.commands.map((c) => c.command), ['cad-x']);
  assert.equal(j.roles.length, 1);
  assert.equal(j.roles[0].role, 'cad-x');
  assert.equal(j.roles[0].agentBytes, Buffer.byteLength(agent, 'utf8'));
  assert.equal(j.roles[0].dispatchBytes,
    Buffer.byteLength(agent, 'utf8') + Buffer.byteLength(contract, 'utf8'));
});

test('resident: an agent preloading no contract is its own role', () => {
  const root = mkdtempSync(join(tmpdir(), 'cad-resident-norole-'));
  mkdirSync(join(root, 'agents'), { recursive: true });
  writeFileSync(join(root, 'agents', 'loner.md'), '---\nname: loner\n---\n\nbody\n');
  const j = resident(root);
  assert.deepEqual(j.roles.map((r) => r.role), ['loner']);
  assert.deepEqual(j.roles[0].contracts, []);
  assert.equal(j.roles[0].dispatchBytes, j.roles[0].agentBytes);
});

test('resident: reachable is ONE hop from the eager set, not a closure', () => {
  const root = mkdtempSync(join(tmpdir(), 'cad-resident-onehop-'));
  mkdirSync(join(root, 'skills', 'cad-x'), { recursive: true });
  mkdirSync(join(root, 'cadence-core', 'references'), { recursive: true });
  mkdirSync(join(root, 'cadence-core', 'workflows'), { recursive: true });
  // SKILL.md eagerly includes the workflow; the workflow cites hop1; hop1
  // cites hop2. Only hop1 is reachable - hop2 is two hops out.
  writeFileSync(join(root, 'skills', 'cad-x', 'SKILL.md'),
    '---\nname: cad-x\n---\n\n@${CLAUDE_PLUGIN_ROOT}/cadence-core/workflows/w.md\n');
  writeFileSync(join(root, 'cadence-core', 'workflows', 'w.md'), 'see references/hop1.md\n');
  writeFileSync(join(root, 'cadence-core', 'references', 'hop1.md'), 'see references/hop2.md\n');
  writeFileSync(join(root, 'cadence-core', 'references', 'hop2.md'), 'leaf\n');
  const j = resident(root);
  const c = j.commands[0];
  assert.deepEqual(c.reachableFiles.map((f) => f.surface), [
    'cadence-core/references/hop1.md',
    'cadence-core/workflows/w.md',
    'skills/cad-x/SKILL.md',
  ]);
  // hop2 is reached by nothing, so it is where the zero-resident derivation
  // lands it - derived, never hardcoded (D-09).
  assert.deepEqual(j.zeroResident.map((z) => z.surface), ['cadence-core/references/hop2.md']);
  assert.equal(j.zeroResidentBytes, Buffer.byteLength('leaf\n', 'utf8'));
});

test('chars/4: estTokens and bytes match the measurement proxy', () => {
  const root = mkdtempSync(join(tmpdir(), 'cad-weight-chars-'));
  mkdirSync(join(root, 'cadence-core', 'workflows'), { recursive: true });
  const body = 'abcdefghij'; // length 10 -> ceil(10/4) = 3
  writeFileSync(join(root, 'cadence-core', 'workflows', 'w.md'), body);
  const s = run(root).surfaces;
  assert.equal(s.length, 1);
  assert.equal(s[0].surface, 'cadence-core/workflows/w.md');
  assert.equal(s[0].estTokens, Math.ceil(body.length / 4));
  assert.equal(s[0].bytes, Buffer.byteLength(body, 'utf8'));
});

// --- flag values: absent is not the same as present-with-no-value -----------
// The regression these pin: a caller passing an unset `$TREE` produced
// `--root` with nothing after it, which read as ABSENT and fell back to the
// plugin's own tree, so the envelope came back ok:true carrying the Cadence
// repo's numbers for a tree the caller never named. A wrong number that looks
// right is worse than an error, so the valueless form fails loudly.

/** Run weight.mjs with raw argv, returning the JSON envelope even on exit 1. */
function rawArgs(...args) {
  try {
    return JSON.parse(execFileSync('node', [WEIGHT, ...args], { encoding: 'utf8' }));
  } catch (e) {
    if (typeof e.stdout === 'string' && e.stdout) return JSON.parse(e.stdout);
    throw e;
  }
}

test('flags: a valueless --root fails rather than measuring the plugin tree', () => {
  const j = rawArgs('--root');
  assert.equal(j.ok, false);
  assert.equal(j.reason, 'missing-flag-value');
  assert.equal(j.detail, '--root');
});

test('flags: an empty --root fails rather than measuring the plugin tree', () => {
  const j = rawArgs('--root', '');
  assert.equal(j.ok, false);
  assert.equal(j.reason, 'missing-flag-value');
});

test('flags: --root swallowing the NEXT flag fails rather than measuring it', () => {
  // `--root --command x` is the same bug wearing a value: without the
  // startsWith('--') test, `--command` becomes the root path.
  const j = rawArgs('resident', '--root', '--command', 'cad-land');
  assert.equal(j.ok, false);
  assert.equal(j.reason, 'missing-flag-value');
  assert.equal(j.detail, '--root');
});

test('flags: a valueless --command fails rather than silently meaning ALL', () => {
  const j = rawArgs('resident', '--root', REPO, '--command');
  assert.equal(j.ok, false);
  assert.equal(j.reason, 'missing-flag-value');
  assert.equal(j.detail, '--command');
});

test('flags: an ABSENT --root still defaults to the plugin tree', () => {
  // The other half of the distinction: only the PRESENT-with-no-value form
  // errors. Omitting the flag entirely keeps the documented default.
  const j = rawArgs();
  assert.equal(j.ok, true);
  assert.equal(j.checked, 'surface-weight');
  assert.ok(j.surfaces.length > 0);
});
