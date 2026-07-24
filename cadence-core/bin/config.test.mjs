// Zero-dep tests for config.mjs. Run: node --test 'cadence-core/bin/*.test.mjs'
// Only node: builtins, matching the repo's zero-dep ethos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const CONFIG = join(dirname(fileURLToPath(import.meta.url)), 'config.mjs');
const dir = mkdtempSync(join(tmpdir(), 'cad-config-'));

// Run config.mjs with a controlled global-config path; returns parsed JSON
// line. Degraded results exit 1 (seam convention), so catch and parse stdout.
function run(args, globalPath) {
  const env = { ...process.env };
  if (globalPath) env.CADENCE_GLOBAL_CONFIG = globalPath;
  try {
    return JSON.parse(execFileSync('node', [CONFIG, ...args], { encoding: 'utf8', env }));
  } catch (e) {
    return JSON.parse(e.stdout);
  }
}

test('set --global auto-creates the global file (and parent dir) from empty', () => {
  const gpath = join(dir, 'nested', 'cadence', 'config.json'); // parent dirs absent
  assert.equal(existsSync(gpath), false);
  const r = run(['set', '--global', 'model.profile=quality'], gpath);
  assert.equal(r.ok, true);
  assert.equal(r.file, gpath);
  assert.deepEqual(r.changed, [{ key: 'model.profile', value: 'quality' }]); // the receipt
  const written = JSON.parse(readFileSync(gpath, 'utf8'));
  assert.equal(written.model.profile, 'quality');
});

test('set --global merges into an existing global file, not clobber', () => {
  const gpath = join(dir, 'existing.json');
  writeFileSync(gpath, JSON.stringify({ model: { profile: 'fast' }, granularity: 'coarse' }));
  const r = run(['set', '--global', 'model.auto.ceiling=quality'], gpath);
  assert.equal(r.ok, true);
  const written = JSON.parse(readFileSync(gpath, 'utf8'));
  assert.equal(written.model.profile, 'fast');     // preserved
  assert.equal(written.granularity, 'coarse');     // preserved
  assert.equal(written.model.auto.ceiling, 'quality'); // added
});

test('set --global still validates: a bad value is rejected, nothing written', () => {
  const gpath = join(dir, 'reject.json');
  const r = run(['set', '--global', 'model.profile=nonsense'], gpath);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'invalid');
  assert.equal(r.detail[0].key, 'model.profile'); // detail names the offender
  assert.match(r.detail[0].error, /must be one of/);
  assert.equal(existsSync(gpath), false); // atomic: no partial write
});

test('set on a missing repo file refuses (only --global auto-creates)', () => {
  const r = run(['set', '--file', join(dir, 'no-such-repo.json'), 'model.profile=fast'],
    join(dir, 'no-global-set.json'));
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'read');
});

test('validate --global reads the global file and reports the payload', () => {
  const gpath = join(dir, 'valid.json');
  writeFileSync(gpath, JSON.stringify({ model: { profile: 'balanced' }, granularity: 'fine' }));
  const r = run(['validate', '--global'], gpath);
  assert.equal(r.ok, true);
  assert.equal(r.file, gpath);
  assert.equal(r.checked, 2);        // both leaves were actually examined
  assert.deepEqual(r.errors, []);
});

test('validate: unknown key and bad value both land in errors, one entry each', () => {
  const file = join(dir, 'bad-config.json');
  // `mode` was pruned from the schema - a stale config must surface it.
  writeFileSync(file, JSON.stringify({ mode: 'interactive', workflow: { plan_check: 'yes' } }));
  const r = run(['validate', '--file', file], join(dir, 'no-global-v.json'));
  assert.equal(r.ok, false);
  assert.equal(r.checked, 2);
  const byKey = Object.fromEntries(r.errors.map((e) => [e.key, e]));
  assert.equal(byKey['mode'].error, 'unknown key');
  assert.match(byKey['workflow.plan_check'].error, /true or false/);
  assert.equal(byKey['workflow.plan_check'].value, 'yes');
});

test('validate: underscore-prefixed keys are annotations, never validated', () => {
  const file = join(dir, 'meta-config.json');
  writeFileSync(file, JSON.stringify({ _meta: { note: 'hand-edited' }, granularity: 'coarse' }));
  const r = run(['validate', '--file', file], join(dir, 'no-global-m.json'));
  assert.equal(r.ok, true);
  assert.equal(r.checked, 1); // only granularity; _meta.* skipped
});

test('validate: corrupt JSON degrades to read, names the file', () => {
  const file = join(dir, 'corrupt.json');
  writeFileSync(file, '{ not json');
  const r = run(['validate', '--file', file], join(dir, 'no-global-c.json'));
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'read');
  assert.match(r.detail, /corrupt\.json/);
});

test('validate: a scalar top-level config fails, never ok:true checked:0 (#45.3)', () => {
  const file = join(dir, 'scalar-config.json');
  writeFileSync(file, '42');
  const r = run(['validate', '--file', file], join(dir, 'no-global-scalar.json'));
  assert.equal(r.ok, false);
  assert.equal(r.checked, 0);
  assert.equal(r.errors.length, 1);
  assert.equal(r.errors[0].key, '(root)');
  assert.match(r.errors[0].error, /must be a JSON object/);

  // a normal object config still validates ok:true.
  const normal = join(dir, 'normal-config.json');
  writeFileSync(normal, JSON.stringify({ granularity: 'coarse' }));
  const rn = run(['validate', '--file', normal], join(dir, 'no-global-scalar2.json'));
  assert.equal(rn.ok, true);
});

test('check: reports per-pair errors and ok mirrors them', () => {
  const good = run(['check', 'workflow.plan_check=false', 'granularity=fine']);
  assert.equal(good.ok, true);
  assert.deepEqual(good.errors, []);
  const bad = run(['check', 'workflow.plan_check=false', 'not-a-pair', 'no.such.key=1']);
  assert.equal(bad.ok, false);
  assert.deepEqual(bad.errors.map((e) => e.error), ['not a key=value pair', 'unknown key']);
});

test('keys: dumps the live schema - pruned keys are really gone', () => {
  const r = run(['keys']);
  assert.equal(r.ok, true);
  assert.deepEqual(r.keys['model.profile'].values, ['fast', 'balanced', 'quality', 'auto']);
  assert.ok(r.keys['review.consult.attempt_threshold']);   // added this cycle
  assert.ok(r.keys['review.triggers.phase_diff.gate']);    // added this cycle
  assert.deepEqual(r.keys['git.integration_branch'].values, ['milestone', 'trunk']); // added this round
  assert.deepEqual(r.keys['git.auto_branch'].values, ['ask', 'auto', 'off']);        // added this round
  for (const gone of ['mode', 'context_window', 'workflow.auto_advance',
    'workflow.discuss_mode', 'workflow.human_verify_mode', 'workflow.build_command',
    'git.auto_push']) {
    assert.equal(r.keys[gone], undefined, `${gone} should be pruned`);
  }
  assert.equal(Object.keys(r.keys).some((k) => k.startsWith('search.')), false);
});

// --- get: the layered effective read ------------------------------------------

test('get: repo > global > schema defaults, with source named', () => {
  const gpath = join(dir, 'get-global.json');
  writeFileSync(gpath, JSON.stringify({ model: { profile: 'quality' }, workflow: { research: true } }));
  const repo = join(dir, 'get-repo.json');
  writeFileSync(repo, JSON.stringify({ model: { profile: 'fast' } }));
  const r = run(['get', '--file', repo, 'model.profile', 'workflow.research', 'workflow.plan_check'], gpath);
  assert.equal(r.ok, true);
  assert.equal(r.values['model.profile'], 'fast');        // repo wins
  assert.equal(r.values['workflow.research'], true);      // global fills
  assert.equal(r.values['workflow.plan_check'], true);    // schema default
  assert.equal(r.source, 'global+repo');
});

test('get: no layers at all falls back to schema defaults for every key', () => {
  const r = run(['get', '--file', join(dir, 'absent.json')], join(dir, 'also-absent.json'));
  assert.equal(r.ok, true);
  assert.equal(r.source, 'defaults');
  assert.equal(r.values['git.on_protected'], 'ask');
  assert.deepEqual(r.values['git.protected_branches'], ['main', 'master']);
});

test('git.integration_branch / git.auto_branch: defaults and enum enforcement', () => {
  const r = run(['get', '--file', join(dir, 'absent.json'),
    'git.integration_branch', 'git.auto_branch'], join(dir, 'also-absent.json'));
  assert.equal(r.ok, true);
  assert.equal(r.values['git.integration_branch'], 'milestone');
  assert.equal(r.values['git.auto_branch'], 'ask');
  const badMode = run(['check', 'git.integration_branch=mainline']);
  assert.equal(badMode.ok, false);
  assert.match(badMode.errors[0].error, /must be one of: milestone, trunk/);
  const badAuto = run(['check', 'git.auto_branch=sometimes']);
  assert.equal(badAuto.ok, false);
  assert.match(badAuto.errors[0].error, /must be one of: ask, auto, off/);
});

test('get: unknown key is rejected, exit code mirrors ok', () => {
  const r = run(['get', '--file', join(dir, 'absent.json'), 'no.such.key'], join(dir, 'no-g.json'));
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'unknown-key');
});

test('get: arrays replace wholesale across layers, never concatenate', () => {
  const gpath = join(dir, 'arr-global.json');
  writeFileSync(gpath, JSON.stringify({ git: { protected_branches: ['release', 'main'] } }));
  const repo = join(dir, 'arr-repo.json');
  writeFileSync(repo, JSON.stringify({ git: { protected_branches: ['trunk'] } }));
  const r = run(['get', '--file', repo, 'git.protected_branches'], gpath);
  assert.deepEqual(r.values['git.protected_branches'], ['trunk']); // repo's list, whole
});

test('get: a corrupt repo layer is skipped (values/source match no-repo-layer) AND warns naming the file (#39)', () => {
  const gpath = join(dir, 'no-global-for-corrupt-repo.json');
  const repo = join(dir, 'corrupt-repo.json');
  writeFileSync(repo, '{ torn mid-write');
  const r = run(['get', '--file', repo, 'model.profile'], gpath);
  const absentRepo = run(['get', '--file', join(dir, 'truly-absent-repo.json'), 'model.profile'], gpath);
  assert.equal(r.ok, true);
  assert.deepEqual(r.values, absentRepo.values); // byte-identical to the no-repo-layer result
  assert.equal(r.source, absentRepo.source);     // 'defaults' - the broken layer contributed nothing
  assert.equal(absentRepo.warnings, undefined);  // merely absent: no warning
  assert.equal(r.warnings.length, 1);
  assert.match(r.warnings[0], /corrupt-repo\.json/); // names the offending file
});

test('get: a corrupt global layer is skipped (repo still wins) AND warns naming the file (#39)', () => {
  const gpath = join(dir, 'corrupt-global.json');
  writeFileSync(gpath, '{ torn mid-write');
  const repo = join(dir, 'fine-repo.json');
  writeFileSync(repo, JSON.stringify({ model: { profile: 'fast' } }));
  const r = run(['get', '--file', repo, 'model.profile'], gpath);
  assert.equal(r.ok, true);
  assert.equal(r.values['model.profile'], 'fast');
  assert.equal(r.source, 'repo'); // the broken global layer contributed nothing
  assert.equal(r.warnings.length, 1);
  assert.match(r.warnings[0], /corrupt-global\.json/);
});

test('get: a scalar repo config falls back to defaults, never source:repo (#45.3)', () => {
  const gpath = join(dir, 'no-global-for-scalar-repo.json');
  const repo = join(dir, 'scalar-repo.json');
  writeFileSync(repo, '42');
  const r = run(['get', '--file', repo, 'model.profile'], gpath);
  const absentRepo = run(['get', '--file', join(dir, 'truly-absent-repo2.json'), 'model.profile'], gpath);
  assert.equal(r.ok, true);
  assert.notEqual(r.source, 'repo');
  assert.deepEqual(r.values, absentRepo.values); // schema default, same as no-repo-layer
  assert.equal(r.warnings.length, 1);
  assert.match(r.warnings[0], /scalar-repo\.json/);
  assert.match(r.warnings[0], /not an object/);
});

// --- cross-key warnings ---------------------------------------------------

test('check: ceiling at/below the auto base profile warns but stays valid', () => {
  for (const ceiling of ['fast', 'balanced']) {
    const r = run(['check', `model.auto.ceiling=${ceiling}`]);
    assert.equal(r.ok, true); // legal value - advisory only
    assert.equal(r.warnings.length, 1);
    assert.match(r.warnings[0].warning, /never demotes/);
  }
  const ok = run(['check', 'model.auto.ceiling=quality']);
  assert.equal(ok.ok, true);
  assert.equal(ok.warnings, undefined); // above base - no warning
});

test('set: the ceiling warning rides along with a successful write', () => {
  const gpath = join(dir, 'warn.json');
  const r = run(['set', '--global', 'model.auto.ceiling=fast'], gpath);
  assert.equal(r.ok, true);
  assert.equal(JSON.parse(readFileSync(gpath, 'utf8')).model.auto.ceiling, 'fast');
  assert.match(r.warnings[0].warning, /holds at base/);
});

// --- shipped config.schema.json absent/malformed (#40) ------------------------

function runWithSchema(args, schemaPath) {
  const env = { ...process.env, CADENCE_GLOBAL_CONFIG: join(dir, 'no-global-schema.json') };
  if (schemaPath) env.CADENCE_CONFIG_SCHEMA = schemaPath;
  try {
    return { stdout: execFileSync('node', [CONFIG, ...args], { encoding: 'utf8', env }) };
  } catch (e) {
    return { stdout: e.stdout };
  }
}

test('CADENCE_CONFIG_SCHEMA malformed degrades to ok:false, reason bad-schema, no stack', () => {
  const bad = join(dir, 'bad-schema.json');
  writeFileSync(bad, '{ not json');
  const { stdout } = runWithSchema(['keys'], bad);
  const lines = stdout.split('\n').filter(Boolean);
  assert.equal(lines.length, 1);
  const r = JSON.parse(lines[0]);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'bad-schema');
  assert.match(r.detail, /bad-schema\.json/);
});

test('CADENCE_CONFIG_SCHEMA nonexistent degrades to ok:false, reason bad-schema, no stack', () => {
  const missing = join(dir, 'does-not-exist-schema.json');
  const { stdout } = runWithSchema(['keys'], missing);
  const lines = stdout.split('\n').filter(Boolean);
  assert.equal(lines.length, 1);
  const r = JSON.parse(lines[0]);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'bad-schema');
});
