// Zero-dep tests for config.mjs. Run: node --test 'cadence-core/bin/*.test.mjs'
// Only node: builtins, matching the repo's zero-dep ethos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, writeFileSync, mkdtempSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readLayer, GLOBAL_CONFIG } from './lib/config-merge.mjs';
import { RUNG_FILES } from './lib/rung-agent.mjs';

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
  const r = run(['set', '--global', 'stakes=critical'], gpath);
  assert.equal(r.ok, true);
  assert.equal(r.file, gpath);
  assert.deepEqual(r.changed, [{ key: 'stakes', value: 'critical' }]); // the receipt
  const written = JSON.parse(readFileSync(gpath, 'utf8'));
  assert.equal(written.stakes, 'critical');
});

test('set --global merges into an existing global file, not clobber', () => {
  const gpath = join(dir, 'existing.json');
  writeFileSync(gpath, JSON.stringify({ stakes: 'solo', granularity: 'coarse' }));
  // a DOTTED key, so the row still covers writing through a parent container
  const r = run(['set', '--global', 'model.escalate_on_failure=false'], gpath);
  assert.equal(r.ok, true);
  const written = JSON.parse(readFileSync(gpath, 'utf8'));
  assert.equal(written.stakes, 'solo');            // preserved
  assert.equal(written.granularity, 'coarse');     // preserved
  assert.equal(written.model.escalate_on_failure, false); // added
});

test('set --global still validates: a bad value is rejected, nothing written', () => {
  const gpath = join(dir, 'reject.json');
  const r = run(['set', '--global', 'stakes=nonsense'], gpath);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'invalid');
  assert.equal(r.detail[0].key, 'stakes'); // detail names the offender
  assert.match(r.detail[0].error, /must be one of/);
  assert.equal(existsSync(gpath), false); // atomic: no partial write
});

test('set on a missing repo file refuses (only --global auto-creates)', () => {
  const r = run(['set', '--file', join(dir, 'no-such-repo.json'), 'model.escalate_on_failure=false'],
    join(dir, 'no-global-set.json'));
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'read');
});

test('validate --global reads the global file and reports the payload', () => {
  const gpath = join(dir, 'valid.json');
  writeFileSync(gpath, JSON.stringify({ stakes: 'shipped', granularity: 'fine' }));
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

test('set: an array top-level config is rejected, nothing written (write face)', () => {
  const file = join(dir, 'w-arr.json');
  const bytes = '[1,2,3]';
  writeFileSync(file, bytes);
  const r = run(['set', '--file', file, 'granularity=fine'], join(dir, 'no-global-w-arr.json'));
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'invalid');
  assert.equal(r.detail[0].key, '(root)');
  assert.match(r.detail[0].error, /must be a JSON object/);
  assert.equal(readFileSync(file, 'utf8'), bytes); // byte-identical: nothing written
});

test('set: a scalar top-level config is rejected as invalid, never reason:internal', () => {
  const file = join(dir, 'w-scalar.json');
  const bytes = '42';
  writeFileSync(file, bytes);
  const r = run(['set', '--file', file, 'granularity=fine'], join(dir, 'no-global-w-scalar.json'));
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'invalid');
  assert.notEqual(r.reason, 'internal');
  assert.equal(r.detail[0].key, '(root)');
  assert.equal(readFileSync(file, 'utf8'), bytes); // byte-identical: nothing written

  // the happy path still holds for a well-formed object config.
  const sibling = join(dir, 'w-sibling.json');
  writeFileSync(sibling, JSON.stringify({ granularity: 'coarse' }));
  const rs = run(['set', '--file', sibling, 'model.escalate_on_failure=false'],
    join(dir, 'no-global-w-sibling.json'));
  assert.equal(rs.ok, true);
  const written = JSON.parse(readFileSync(sibling, 'utf8'));
  assert.equal(written.granularity, 'coarse');
  assert.equal(written.model.escalate_on_failure, false);
});

// Rewritten per CONTEXT D-04 (Phase-1 D-05 lineage): the previous version of
// this test asserted ok:true AND that the key persisted, which can only hold if
// the parent container is thrown away. Neither half of "lose the change, keep
// the data" / "lose the data, keep the change" is the contract - refusing is.
test('set: a non-object parent container is refused, not overwritten', () => {
  for (const [label, parent] of [['array', ['main', 'master']], ['scalar', 0], ['string', 'x']]) {
    const file = join(dir, `w-${label}-parent.json`);
    const bytes = JSON.stringify({ git: parent });
    writeFileSync(file, bytes);
    const r = run(['set', '--file', file, 'git.on_protected=allow'], join(dir, `no-global-w-${label}-parent.json`));
    assert.equal(r.ok, false, label);
    assert.equal(r.reason, 'invalid', label);
    assert.notEqual(r.reason, 'internal', label);
    assert.equal(r.detail[0].key, 'git.on_protected', label);
    assert.match(r.detail[0].error, /cannot set through "git"/, label);
    // the container survives byte-for-byte: no reported-but-destructive write
    assert.equal(readFileSync(file, 'utf8'), bytes, label);
  }
});

test('set: an absent or null parent is still auto-created', () => {
  const file = join(dir, 'w-vivify-parent.json');
  writeFileSync(file, JSON.stringify({ granularity: 'coarse', model: null }));
  const r = run(['set', '--file', file, 'git.on_protected=allow', 'model.escalate_on_failure=false'],
    join(dir, 'no-global-w-vivify.json'));
  assert.equal(r.ok, true);
  const written = JSON.parse(readFileSync(file, 'utf8'));
  assert.equal(written.git.on_protected, 'allow');        // absent parent
  assert.equal(written.model.escalate_on_failure, false); // null parent holds no data
  assert.equal(written.granularity, 'coarse');
});

test('set: one bad path refuses the whole multi-pair write (all-or-nothing)', () => {
  const file = join(dir, 'w-mixed-pairs.json');
  const bytes = JSON.stringify({ git: ['main'] });
  writeFileSync(file, bytes);
  const r = run(['set', '--file', file, 'granularity=fine', 'git.on_protected=allow'],
    join(dir, 'no-global-w-mixed.json'));
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'invalid');
  // the valid pair must not have landed either - checkPaths runs before setInto
  assert.equal(readFileSync(file, 'utf8'), bytes);
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

test('check: speaks the same {ok,reason,detail} failure contract set does', () => {
  const good = run(['check', 'workflow.plan_check=false', 'granularity=fine']);
  assert.equal(good.ok, true);
  const bad = run(['check', 'workflow.plan_check=false', 'not-a-pair', 'no.such.key=1']);
  assert.equal(bad.ok, false);
  assert.equal(bad.reason, 'invalid');
  assert.deepEqual(bad.detail.map((e) => e.error), ['not a key=value pair', 'unknown key']);
});

// --- retired keys: refused at the write face, named at the read face ----------

test('check: a retired KEY names its replacement, not the generic unknown key', () => {
  const r = run(['check', 'model.profile=balanced']);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'invalid');
  assert.equal(r.detail[0].key, 'model.profile');
  assert.doesNotMatch(r.detail[0].error, /^unknown key$/);
  assert.match(r.detail[0].error, /stakes/);
  for (const value of ['solo', 'shipped', 'critical']) {
    assert.match(r.detail[0].error, new RegExp(value)); // the remediation needs no lookup
  }
});

test('check: a retired VALUE on the LIVE key still reads as a value error', () => {
  // The two failures must stay distinguishable: a bad value names the enum,
  // a retired key names its replacement.
  const r = run(['check', 'stakes=quality']);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'invalid');
  assert.match(r.detail[0].error, /must be one of: solo, shipped, critical/);
});

test('set: a removed key is refused before anything is written', () => {
  const gpath = join(dir, 'retired-write.json');
  const r = run(['set', '--global', 'model.auto.ceiling=quality'], gpath);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'invalid');
  assert.equal(r.detail[0].key, 'model.auto.ceiling');
  assert.match(r.detail[0].error, /retired in v2\.0\.0/);
  assert.doesNotMatch(r.detail[0].error, /^unknown key$/);
  assert.equal(existsSync(gpath), false); // atomic: nothing written
});

test('get: a repo config still holding a retired key warns instead of resolving silently', () => {
  const gpath = join(dir, 'no-global-for-retired.json');
  const repo = join(dir, 'retired-repo.json');
  writeFileSync(repo, JSON.stringify({ model: { profile: 'balanced' } }));
  const r = run(['get', '--file', repo, 'stakes'], gpath);
  assert.equal(r.ok, true);                  // never blocks a workflow's read
  assert.equal(r.values['stakes'], 'shipped'); // the schema default
  assert.equal(r.warnings.length, 1);
  assert.match(r.warnings[0], /model\.profile/);
  assert.match(r.warnings[0], /stakes/);
});

test('keys: dumps the live schema - pruned keys are really gone', () => {
  const r = run(['keys']);
  assert.equal(r.ok, true);
  // The routing axis asks what a break costs, and the ladder is unconditional:
  // the spend vocabulary (and the `auto` mode that gated it) is gone, not aliased.
  assert.deepEqual(r.keys['stakes'].values, ['solo', 'shipped', 'critical']);
  assert.equal(r.keys['stakes'].default, 'shipped');
  assert.equal(r.keys['model.escalate_on_failure'].default, true);
  assert.ok(r.keys['review.consult.attempt_threshold']);   // added this cycle
  assert.ok(r.keys['review.triggers.phase_diff.gate']);    // added this cycle
  assert.deepEqual(r.keys['git.integration_branch'].values, ['milestone', 'trunk']); // added this round
  assert.deepEqual(r.keys['git.auto_branch'].values, ['ask', 'auto', 'off']);        // added this round
  for (const gone of ['mode', 'context_window', 'workflow.auto_advance',
    'workflow.discuss_mode', 'workflow.human_verify_mode', 'workflow.build_command',
    'git.auto_push', 'model.profile', 'model.auto.ceiling',
    'model.auto.escalate_on_failure', 'model.auto.max_escalations']) {
    assert.equal(r.keys[gone], undefined, `${gone} should be pruned`);
  }
  assert.equal(Object.keys(r.keys).some((k) => k.startsWith('search.')), false);
});

// --- get: the layered effective read ------------------------------------------

test('get: repo > global > schema defaults, with source named', () => {
  const gpath = join(dir, 'get-global.json');
  writeFileSync(gpath, JSON.stringify({ stakes: 'critical', workflow: { research: true } }));
  const repo = join(dir, 'get-repo.json');
  writeFileSync(repo, JSON.stringify({ stakes: 'solo' }));
  const r = run(['get', '--file', repo, 'stakes', 'workflow.research', 'workflow.plan_check'], gpath);
  assert.equal(r.ok, true);
  assert.equal(r.values['stakes'], 'solo');               // repo wins
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
  assert.match(badMode.detail[0].error, /must be one of: milestone, trunk/);
  const badAuto = run(['check', 'git.auto_branch=sometimes']);
  assert.equal(badAuto.ok, false);
  assert.match(badAuto.detail[0].error, /must be one of: ask, auto, off/);
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
  const r = run(['get', '--file', repo, 'stakes'], gpath);
  const absentRepo = run(['get', '--file', join(dir, 'truly-absent-repo.json'), 'stakes'], gpath);
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
  writeFileSync(repo, JSON.stringify({ stakes: 'solo' }));
  const r = run(['get', '--file', repo, 'stakes'], gpath);
  assert.equal(r.ok, true);
  assert.equal(r.values['stakes'], 'solo');
  assert.equal(r.source, 'repo'); // the broken global layer contributed nothing
  assert.equal(r.warnings.length, 1);
  assert.match(r.warnings[0], /corrupt-global\.json/);
});

test('get: a scalar repo config falls back to defaults, never source:repo (#45.3)', () => {
  const gpath = join(dir, 'no-global-for-scalar-repo.json');
  const repo = join(dir, 'scalar-repo.json');
  writeFileSync(repo, '42');
  const r = run(['get', '--file', repo, 'stakes'], gpath);
  const absentRepo = run(['get', '--file', join(dir, 'truly-absent-repo2.json'), 'stakes'], gpath);
  assert.equal(r.ok, true);
  assert.notEqual(r.source, 'repo');
  assert.deepEqual(r.values, absentRepo.values); // schema default, same as no-repo-layer
  assert.equal(r.warnings.length, 1);
  assert.match(r.warnings[0], /scalar-repo\.json/);
  assert.match(r.warnings[0], /not an object/);
});

test('get: a falsy non-object repo layer warns like a truthy one', () => {
  const gpath = join(dir, 'no-global-for-falsy-repo.json');
  for (const content of ['null', '0', 'false', '""']) {
    const repo = join(dir, `falsy-repo-${content.replace(/[^a-z0-9]/gi, '_')}.json`);
    writeFileSync(repo, content);
    const r = run(['get', '--file', repo, 'stakes'], gpath);
    const absentRepo = run(['get', '--file', join(dir, 'truly-absent-repo3.json'), 'stakes'], gpath);
    assert.equal(r.ok, true, `content ${content}`);
    assert.equal(r.warnings.length, 1, `content ${content}`);
    assert.match(r.warnings[0], new RegExp(repo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(r.warnings[0], /not an object/);
    assert.deepEqual(r.values, absentRepo.values, `content ${content}`);
    assert.equal(r.source, absentRepo.source, `content ${content}`);
  }
});

test('get: a falsy non-object global layer warns too', () => {
  const gpath = join(dir, 'falsy-global.json');
  writeFileSync(gpath, '0');
  const repo = join(dir, 'fine-repo-for-falsy-global.json');
  writeFileSync(repo, JSON.stringify({ stakes: 'solo' }));
  const r = run(['get', '--file', repo, 'stakes'], gpath);
  assert.equal(r.ok, true);
  assert.equal(r.source, 'repo'); // repo value still wins
  assert.equal(r.values['stakes'], 'solo');
  assert.equal(r.warnings.length, 1);
  assert.match(r.warnings[0], /falsy-global\.json/);
});

test('get: an absent layer stays silent and an unparseable layer warns exactly once', () => {
  const gpath = join(dir, 'no-global-for-absent-vs-corrupt.json');
  const absent = run(['get', '--file', join(dir, 'truly-absent-repo4.json'), 'stakes'], gpath);
  assert.equal(absent.warnings, undefined);

  const torn = join(dir, 'torn-mid-write.json');
  writeFileSync(torn, '{ torn mid-write');
  const rTorn = run(['get', '--file', torn, 'stakes'], gpath);
  assert.equal(rTorn.warnings.length, 1);
  assert.match(rTorn.warnings[0], /failed to parse/);
  assert.doesNotMatch(rTorn.warnings[0], /not an object/);

  const zeroByte = join(dir, 'zero-byte.json');
  writeFileSync(zeroByte, '');
  const rZero = run(['get', '--file', zeroByte, 'stakes'], gpath);
  assert.equal(rZero.warnings.length, 1);
  assert.match(rZero.warnings[0], /failed to parse/);
  assert.doesNotMatch(rZero.warnings[0], /not an object/);
});

test('check: an int key with a max rejects above it and accepts at it', () => {
  // review.request_timeout_ms is bounded because node truncates a socket
  // timeout past int32, which would leave a stalled provider hanging instead
  // of rejecting. Without a schema max, `set` accepted 999999999999 clean and
  // only the seam's clamp saved it - so `get` reported a value the seam never
  // used. The bound belongs at the write face too.
  const over = run(['check', 'review.request_timeout_ms=999999999999']);
  assert.equal(over.ok, false);
  assert.match(over.detail[0].error, /must be <= 600000/);

  const typo = run(['check', 'review.request_timeout_ms=600000000']);
  assert.equal(typo.ok, false);                       // one extra zero group

  assert.equal(run(['check', 'review.request_timeout_ms=600000']).ok, true);   // at the ceiling
  assert.equal(run(['check', 'review.request_timeout_ms=1']).ok, true);        // at the min
  assert.equal(run(['check', 'review.request_timeout_ms=0']).ok, false);       // min still holds

  // a min-only int key is unaffected by the new max branch
  assert.equal(run(['check', 'workflow.max_plan_tasks=999999999999']).ok, true);
});

test('readLayer(""): an unresolvable layer path is a SILENT absence', () => {
  // Load-bearing for config-merge's homedir() fallback: where os.homedir()
  // throws (uid with no passwd entry and HOME unset - `docker run -u 12345`),
  // GLOBAL_CONFIG becomes '' rather than crashing every importer at module
  // load. That degradation is only correct if '' behaves as "no global layer"
  // and not as a broken one, i.e. no warning and present:false.
  const r = readLayer('');
  assert.equal(r.value, null);
  assert.equal(r.warning, null);
  assert.equal(r.present, false);
  assert.equal(typeof GLOBAL_CONFIG, 'string');   // never undefined, never throws
});

test('get: one file resolving as both layers warns once, not twice', () => {
  // mergeLayers reads the global and repo layers independently, so a file that
  // IS both was reported twice - one broken file, two identical diagnostics.
  for (const [label, bytes, pattern] of [
    ['non-object', 'null', /not an object/],
    ['unparseable', '{ torn', /failed to parse/],
  ]) {
    const shared = join(dir, `shared-both-layers-${label}.json`);
    writeFileSync(shared, bytes);
    const r = run(['get', '--file', shared, 'stakes'], shared);
    assert.equal(r.ok, true, label);
    assert.equal(r.warnings.length, 1, `${label}: ${JSON.stringify(r.warnings)}`);
    assert.match(r.warnings[0], pattern, label);
  }

  // two genuinely different broken layers still get one entry each
  const g = join(dir, 'two-broken-global.json');
  const repo = join(dir, 'two-broken-repo.json');
  writeFileSync(g, '0');
  writeFileSync(repo, '[1,2]');
  const r2 = run(['get', '--file', repo, 'stakes'], g);
  assert.equal(r2.warnings.length, 2);
});

// --- one file, two layer paths: identity, not spelling (CAPTURE.md:46) --------

test('get: a SYMLINKED global layer is the same file, so one layer is reported', () => {
  // 28bd532 deduped the rendered warning strings, which closes the exact-path
  // case and nothing else: an alias renders a different string, so the same
  // file was read twice and `source` named a repo layer the user never had.
  const shared = join(dir, 'alias-shared.json');
  writeFileSync(shared, JSON.stringify({ stakes: 'solo' }));
  const link = join(dir, 'alias-shared-link.json');
  symlinkSync(shared, link);
  const r = run(['get', '--file', shared, 'stakes'], link);
  assert.equal(r.ok, true);
  assert.equal(r.values['stakes'], 'solo'); // the merge is unchanged
  assert.equal(r.source, 'repo');           // ONE layer, not 'global+repo'
  assert.equal(r.warnings, undefined);

  // the control that proves this is not a blanket collapse: a genuinely
  // different global file still layers under the repo one.
  const other = join(dir, 'alias-control-global.json');
  writeFileSync(other, JSON.stringify({ granularity: 'coarse' }));
  const r2 = run(['get', '--file', shared, 'stakes', 'granularity'], other);
  assert.equal(r2.source, 'global+repo');
  assert.equal(r2.values['granularity'], 'coarse');
});

test('get: a RELATIVE spelling of the repo file is the same file too', () => {
  const shared = join(dir, 'rel-shared.json');
  writeFileSync(shared, JSON.stringify({ stakes: 'solo' }));
  const r = run(['get', '--file', shared, 'stakes'], relative(process.cwd(), shared));
  assert.equal(r.ok, true);
  assert.equal(r.values['stakes'], 'solo');
  assert.equal(r.source, 'repo');
});

test('get: a BROKEN file reached under two spellings warns exactly once', () => {
  for (const [label, bytes, pattern] of [
    ['unparseable', '{ torn', /failed to parse/],
    ['non-object', 'null', /not an object/],
  ]) {
    const shared = join(dir, `alias-broken-${label}.json`);
    writeFileSync(shared, bytes);
    const link = join(dir, `alias-broken-${label}-link.json`);
    symlinkSync(shared, link);
    const r = run(['get', '--file', shared, 'stakes'], link);
    assert.equal(r.ok, true, label);
    assert.equal(r.warnings.length, 1, `${label}: ${JSON.stringify(r.warnings)}`);
    assert.match(r.warnings[0], pattern, label);
    assert.match(r.warnings[0], /alias-broken-/, label); // names the file, once
    assert.equal(r.source, 'defaults', label);
  }
});

test('get --global: the one file it reads by construction is the GLOBAL layer', () => {
  // config.mjs:289 hands GLOBAL_CONFIG in as the repo file, so `--global` makes
  // one file both layers on every invocation - it reported `global+repo`, i.e.
  // a repo layer that cannot exist on this path (CAPTURE.md:46 (b)).
  const gpath = join(dir, 'get-global-single.json');
  writeFileSync(gpath, JSON.stringify({ stakes: 'critical' }));
  const r = run(['get', '--global', 'stakes'], gpath);
  assert.equal(r.ok, true);
  assert.equal(r.values['stakes'], 'critical');
  assert.equal(r.source, 'global'); // the literal string, pinned

  // ...and the same file addressed as a REPO config is labelled `repo`, even
  // spelled exactly as the env carries it. On a collapse both paths ARE the
  // file, so the label follows what the caller addressed; deciding it by
  // string equality would report `global` here and `repo` for a symlinked
  // spelling of the identical situation.
  const asRepo = run(['get', '--file', gpath, 'stakes'], gpath);
  assert.equal(asRepo.source, 'repo');
  assert.equal(asRepo.values['stakes'], 'critical');
});

// --- a flag whose value is missing (.planning/CAPTURE.md:168) -----------------

test('a valueless --file is a named usage failure on every subcommand', () => {
  // `--file $CFG` on an unset variable. Measured at HEAD: `set` answered
  // reason:"internal" with a raw Node TypeError thrown outside its try,
  // `validate` said "cannot read/parse undefined",
  // and `get` answered ok:true - the user-global layer read back as if it were
  // the file the caller named.
  for (const args of [['set', 'stakes=solo', '--file'], ['get', '--file'],
    ['validate', '--file']]) {
    const r = run(args, join(dir, 'no-global-usage.json'));
    assert.equal(r.ok, false, args.join(' '));
    assert.equal(r.reason, 'usage', `${args.join(' ')}: ${JSON.stringify(r)}`);
    assert.match(r.detail, /--file/, args.join(' '));
    assert.doesNotMatch(r.detail, /undefined/, args.join(' '));
  }
});

test('a QUOTED empty --file is refused too, not answered about the global layer', () => {
  // `--file "$CFG"` on an unset variable: the quoted spelling of the row above,
  // and a distinct token - the shell drops an unquoted `$CFG` but passes an
  // empty string for a quoted one. Guarding on `=== undefined` alone left this
  // one falling through, and `get` is the dangerous arm: it answered ok:true
  // with source "global" and a real value read out of the user-global layer,
  // about a file the caller never named. Silent, unlike the loud
  // reason:"internal" the unquoted spelling used to give.
  const gpath = join(dir, 'empty-file-global.json');
  writeFileSync(gpath, JSON.stringify({ stakes: 'shipped' }));
  for (const args of [['set', 'stakes=solo', '--file', ''], ['get', '--file', '', 'stakes'],
    ['validate', '--file', '']]) {
    const r = run(args, gpath);
    assert.equal(r.ok, false, args.join(' '));
    assert.equal(r.reason, 'usage', `${args.join(' ')}: ${JSON.stringify(r)}`);
    assert.match(r.detail, /--file/, args.join(' '));
    assert.equal(r.values, undefined, args.join(' ')); // never an answer about another file
  }
});

test('a path under a missing directory is a read failure naming it, never internal', () => {
  // Measured at HEAD: `set` answered reason:"internal" with a raw Node
  // TypeError thrown outside its try. A diagnosable input must stay
  // diagnosable.
  const gpath = join(dir, 'total-identity-global.json');
  writeFileSync(gpath, JSON.stringify({ stakes: 'solo' }));
  const repo = join(dir, 'total-identity-repo.json');
  writeFileSync(repo, JSON.stringify({ stakes: 'solo' }));
  // a real repo file still takes the write...
  assert.equal(run(['set', '--file', repo, 'stakes=shipped'], gpath).ok, true);
  // ...and a path under a directory that does not exist reads as a read
  // failure naming the file, never reason:internal.
  const nested = join(dir, 'no-such-dir', 'deep', 'config.json');
  const r = run(['set', '--file', nested, 'stakes=shipped'], gpath);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'read');
  assert.match(r.detail, /no-such-dir/);
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

// --- model.effort.<role>: the per-role start rung, refused by key (RNG-02) ---

test('check: a rung the role HAS is accepted', () => {
  // `cad-verifier` carries medium/high/xhigh/max in lib/rung-agent.mjs.
  assert.deepEqual(run(['check', 'model.effort.cad-verifier=xhigh']), { ok: true });
});

test('check: a rung the role LACKS is refused by key, naming that role\'s set', () => {
  // `max` is a real rung of the ladder and a real value of OTHER roles' enums -
  // which is why one uniform rung_order enum would have accepted it here and
  // sent an unmapped rung down the dispatch path. cad-executor has two rungs.
  const r = run(['check', 'model.effort.cad-executor=max']);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'invalid');
  assert.equal(r.detail.length, 1);
  assert.equal(r.detail[0].key, 'model.effort.cad-executor'); // BY KEY
  assert.equal(r.detail[0].error, 'must be one of: high, xhigh, null');
});

test('check: null renders as the literal, not as a dangling separator', () => {
  // Every `default: null` enum ends its accepted set with null; Array#join
  // rendered it as '' and the message read "…: high, xhigh, " - a truncated
  // sentence rather than a settable value.
  const r = run(['check', 'model.effort.cad-planner=medium']);
  assert.equal(r.ok, false);
  assert.equal(r.detail[0].error, 'must be one of: high, xhigh, max, null');
  assert.ok(!/,\s*$/.test(r.detail[0].error));
  // and the literal IS accepted, so the message is not advertising a fiction
  assert.deepEqual(run(['check', 'model.effort.cad-planner=null']), { ok: true });
});

test('set: the WRITE face refuses the same value and writes nothing', () => {
  // `check` alone cannot prove `set` writes nothing - the refusal has to land
  // before the read-modify-write, which is the atomicity contract checkPairs
  // already holds for retired and surface keys.
  const repo = join(dir, 'effort-write.json');
  writeFileSync(repo, JSON.stringify({ stakes: 'shipped' }, null, 2) + '\n');
  const before = readFileSync(repo, 'utf8');
  const r = run(['set', '--file', repo, 'model.effort.cad-executor=max'],
    join(dir, 'effort-no-global.json'));
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'invalid');
  assert.equal(r.detail[0].key, 'model.effort.cad-executor');
  assert.equal(r.detail[0].error, 'must be one of: high, xhigh, null');
  assert.equal(readFileSync(repo, 'utf8'), before); // byte-identical
});

test('set: an accepted rung is written into the config layer, not the plugin', () => {
  const repo = join(dir, 'effort-write-ok.json');
  writeFileSync(repo, JSON.stringify({ stakes: 'shipped' }, null, 2) + '\n');
  const r = run(['set', '--file', repo, 'model.effort.cad-verifier=xhigh'],
    join(dir, 'effort-no-global.json'));
  assert.equal(r.ok, true);
  assert.deepEqual(JSON.parse(readFileSync(repo, 'utf8')),
    { stakes: 'shipped', model: { effort: { 'cad-verifier': 'xhigh' } } });
});

test('validate: a whole config carrying a bad start rung names the key', () => {
  const repo = join(dir, 'effort-validate.json');
  writeFileSync(repo, JSON.stringify({ model: { effort: { 'cad-plan-checker': 'max' } } }));
  const r = run(['validate', '--file', repo], join(dir, 'effort-no-global.json'));
  assert.equal(r.ok, false);
  assert.deepEqual(r.errors, [{
    key: 'model.effort.cad-plan-checker',
    error: 'must be one of: low, medium, high, xhigh, null',
    value: 'max',
  }]);
});

test('every model.effort enum is exactly that role\'s rung set from RUNG_FILES', () => {
  // The schema shipped here is the one config.mjs refuses against; if it drifts
  // from the map, the refusal starts refusing the wrong values. self-verify
  // holds the same invariant for CI - this row holds it for the write face.
  const schema = JSON.parse(readFileSync(
    join(dirname(CONFIG), '..', 'config.schema.json'), 'utf8')).keys;
  for (const [role, map] of Object.entries(RUNG_FILES)) {
    const spec = schema[`model.effort.${role}`];
    assert.ok(spec, `no model.effort.${role} key`);
    assert.deepEqual(spec.values, [...Object.keys(map), null]);
    assert.equal(spec.default, null);
  }
  assert.equal(Object.keys(schema).filter((k) => k.startsWith('model.effort.')).length,
    Object.keys(RUNG_FILES).length);
});

// --- workflow.lint_command (QW-01) -------------------------------------------

test('workflow.lint_command: get returns the schema default null', () => {
  const gpath = join(dir, 'lint-get-global.json');
  const r = run(['get', 'workflow.lint_command', '--file', join(dir, 'lint-absent.json')], gpath);
  assert.equal(r.ok, true);
  assert.equal(r.values['workflow.lint_command'], null);
});

test('workflow.lint_command: set writes a shell string and get reads it back', () => {
  const file = join(dir, 'lint-set.json');
  writeFileSync(file, '{}');
  const gpath = join(dir, 'lint-set-global.json');
  const w = run(['set', '--file', file, 'workflow.lint_command=npm run lint'], gpath);
  assert.equal(w.ok, true);
  assert.deepEqual(w.changed, [{ key: 'workflow.lint_command', value: 'npm run lint' }]);
  assert.equal(JSON.parse(readFileSync(file, 'utf8')).workflow.lint_command, 'npm run lint');
  const r = run(['get', 'workflow.lint_command', '--file', file], gpath);
  assert.equal(r.values['workflow.lint_command'], 'npm run lint');
});

test('workflow.lint_command: `=null` clears it; a bare `=` writes the empty string', () => {
  // The token is parsed as JSON where it parses and taken verbatim otherwise
  // (parseToken), so `=null` is the clearing idiom and `=` writes "". Both
  // validate, and both read as "nothing to run" at the one prose reader - this
  // row pins which is which rather than assuming the friendlier one.
  const file = join(dir, 'lint-clear.json');
  const gpath = join(dir, 'lint-clear-global.json');
  writeFileSync(file, JSON.stringify({ workflow: { lint_command: 'npm run lint' } }));
  assert.equal(run(['set', '--file', file, 'workflow.lint_command=null'], gpath).ok, true);
  assert.equal(JSON.parse(readFileSync(file, 'utf8')).workflow.lint_command, null);
  assert.equal(run(['set', '--file', file, 'workflow.lint_command='], gpath).ok, true);
  assert.equal(JSON.parse(readFileSync(file, 'utf8')).workflow.lint_command, '');
});

test('workflow.lint_command: validate accepts null and a string, refuses a number', () => {
  const gpath = join(dir, 'lint-val-global.json');
  const good = join(dir, 'lint-valid.json');
  writeFileSync(good, JSON.stringify({ workflow: { lint_command: 'cargo clippy' } }));
  assert.equal(run(['validate', '--file', good], gpath).ok, true);
  const nulled = join(dir, 'lint-null.json');
  writeFileSync(nulled, JSON.stringify({ workflow: { lint_command: null } }));
  assert.equal(run(['validate', '--file', nulled], gpath).ok, true);
  const bad = join(dir, 'lint-bad.json');
  writeFileSync(bad, JSON.stringify({ workflow: { lint_command: 7 } }));
  const r = run(['validate', '--file', bad], gpath);
  assert.equal(r.ok, false);
  assert.equal(r.errors[0].key, 'workflow.lint_command');
  assert.match(r.errors[0].error, /string or null/);
});

test('workflow.lint_command: the shipped template carries the key at null', () => {
  const tpl = JSON.parse(readFileSync(
    join(dirname(CONFIG), '..', 'templates', 'config.json'), 'utf8'));
  assert.equal('lint_command' in tpl.workflow, true);
  assert.equal(tpl.workflow.lint_command, null);
});
