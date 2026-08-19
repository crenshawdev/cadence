// Zero-dep tests for config.mjs. Run: node --test 'cadence-core/bin/*.test.mjs'
// Only node: builtins, matching the repo's zero-dep ethos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, writeFileSync, mkdtempSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, dirname, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readLayer, GLOBAL_CONFIG } from './lib/config-merge.mjs';
import { RUNG_FILES } from './lib/rung-agent.mjs';
import { CONTRACTS } from './lib/arg-contract.mjs';

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
  assert.equal(r.keys['model.escalate_on_failure'].default, false);
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
  assert.equal(r.values['workflow.plan_check'], false);   // schema default
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

test('ARG-06: every subcommand that ACCEPTS --global declares it, and reads it off the row', () => {
  // UAT item 9. `get --global` was live and undeclared while its two siblings
  // each carried a row, so self-verify check 2 stayed green only because no
  // workflow prose spelled the pair - the moment any did, correct prose would
  // be reported `unknown-flag` against a flag this seam accepts.
  //
  // The row is now what the read NEEDS, which is what makes the class
  // unrepeatable here: `optFile` asks `CONTRACTS['config.mjs'][cmd]` for the
  // declaration, so a subcommand accepting a `--global` it does not declare is
  // no longer expressible. Deleting the row below stops `get --global`
  // answering `source: "global"` - watched failing.
  const declared = { required: false, type: 'boolean', value: 'fallback', bare: 'fallback' };
  for (const cmd of ['validate', 'set', 'get']) {
    assert.deepEqual(CONTRACTS['config.mjs'][cmd]['--global'], declared,
      `${cmd} takes --global, so ${cmd} must declare it - with the same grammar its siblings carry`);
  }
  const gpath = join(dir, 'global-declared.json');
  writeFileSync(gpath, JSON.stringify({ stakes: 'critical' }));
  const r = run(['get', '--global', 'stakes'], gpath);
  assert.equal(r.source, 'global');
  assert.equal(r.values['stakes'], 'critical');
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

test('ARG-06: a FLAG-SHAPED --file value is refused too, not read as a path', () => {
  // The third spelling, and the one `if (!tokens[i + 1])` could not see: a
  // truthy token that is a FLAG. Measured 2026-08-19, `config.mjs validate
  // --file --nonsense` returned `{"ok":false,"reason":"read","detail":"cannot
  // read/parse --nonsense: ENOENT ..."}` - an answer about a file the caller
  // never named, the same class as the two rows above one spelling further out.
  // `--file` reads through its declared row in lib/arg-contract.mjs now, so all
  // three are one rule, and the reason stays this bin's own `usage` (D-07).
  const gpath = join(dir, 'flagshaped-file-global.json');
  writeFileSync(gpath, JSON.stringify({ stakes: 'shipped' }));
  for (const args of [['set', 'stakes=solo', '--file', '--nonsense'], ['get', '--file', '--nonsense', 'stakes'],
    ['validate', '--file', '--nonsense']]) {
    const r = run(args, gpath);
    assert.equal(r.ok, false, args.join(' '));
    assert.equal(r.reason, 'usage', `${args.join(' ')}: ${JSON.stringify(r)}`);
    assert.match(r.detail, /--file/, args.join(' '));
    assert.equal(r.values, undefined, args.join(' '));
  }
  // The two mechanics that must not move: `--global` is tested FIRST and
  // short-circuits before `--file` is looked at...
  assert.equal(run(['get', '--global', 'stakes'], gpath).values.stakes, 'shipped');
  // ...and a real path still resolves, with the consumed flag and its value
  // filtered out of the key list `get` reads.
  const repo = join(dir, 'flagshaped-file-repo.json');
  writeFileSync(repo, JSON.stringify({ stakes: 'solo' }));
  assert.equal(run(['get', '--file', repo, 'stakes'], gpath).values.stakes, 'solo');
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

// config.mjs reads CADENCE_CONFIG_SCHEMA only when CADENCE_TEST_SEAM is
// exactly `1` (lib/test-seam.mjs), so an injecting fixture sets both.
function runWithSchema(args, schemaPath) {
  const env = { ...process.env, CADENCE_GLOBAL_CONFIG: join(dir, 'no-global-schema.json') };
  if (schemaPath) { env.CADENCE_CONFIG_SCHEMA = schemaPath; env.CADENCE_TEST_SEAM = '1'; }
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

// --- the injection is GATED behind CADENCE_TEST_SEAM (EXP-01) ---------------

test('CADENCE_CONFIG_SCHEMA without the sentinel is ignored; `keys` is the shipped set', () => {
  // The schema decides which keys are known and which carry the `src: global`
  // marker phase 1 made load-bearing, so an ungated override re-opens CFG-02.
  // Unset the sentinel and the variable is not read at all - silently, because
  // SCHEMA_PATH resolves at module load, before a dispatch exists to warn on.
  const hostile = join(dir, 'ungated-schema.json');
  writeFileSync(hostile, JSON.stringify({ keys: { 'not.a.real.key': { type: 'bool', default: false } } }));
  const env = { ...process.env, CADENCE_GLOBAL_CONFIG: join(dir, 'no-global-schema.json'),
    CADENCE_CONFIG_SCHEMA: hostile };
  delete env.CADENCE_TEST_SEAM; // hermetic: never inherit an open seam

  const r = JSON.parse(execFileSync('node', [CONFIG, 'keys'], { encoding: 'utf8', env }));
  assert.equal(r.ok, true);
  const shipped = JSON.parse(readFileSync(join(dirname(CONFIG), '..', 'config.schema.json'), 'utf8')).keys;
  assert.deepEqual(Object.keys(r.keys), Object.keys(shipped));
  assert.equal(Object.hasOwn(r.keys, 'not.a.real.key'), false);

  // The SAME file with the sentinel set DOES take, so the arm above is proving
  // the gate rather than a fixture path that never worked.
  const opened = JSON.parse(execFileSync('node', [CONFIG, 'keys'],
    { encoding: 'utf8', env: { ...env, CADENCE_TEST_SEAM: '1' } }));
  assert.deepEqual(Object.keys(opened.keys), ['not.a.real.key']);
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
  // The round-trip runs on the USER-GLOBAL layer, because that is the only
  // layer this key is honoured from (CFG-02). `set --file` still WRITES it into
  // a repo config - the write face is not scoped - but the merge drops it, so a
  // repo-layer round-trip through `get` would be asserting the reach this phase
  // removed. The dropped half has its own arms in the CFG-02 section below.
  const gpath = join(dir, 'lint-set-global.json');
  const w = run(['set', '--global', 'workflow.lint_command=npm run lint'], gpath);
  assert.equal(w.ok, true);
  assert.deepEqual(w.changed, [{ key: 'workflow.lint_command', value: 'npm run lint' }]);
  assert.equal(JSON.parse(readFileSync(gpath, 'utf8')).workflow.lint_command, 'npm run lint');
  const r = run(['get', 'workflow.lint_command', '--file', join(dir, 'lint-set-repo.json')], gpath);
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

// --- CFG-01: a repo layer cannot reparent the merged config ------------------
//
// The hostile input is a `.planning/config.json` that arrived with a clone. It
// is written here as TEXT, never as an object literal that gets stringified:
// `{__proto__: x}` in JS source sets the prototype instead of creating a key,
// so an object-built fixture is not the file an attacker ships.
//
// Each arm runs in a CHILD with its own CADENCE_GLOBAL_CONFIG. `mergeLayers`
// reads GLOBAL_CONFIG once at module load off the environment
// (config-merge.mjs:26), which the static import at the top of this file has
// already frozen at the developer's REAL ~/.claude/cadence/config.json - so the
// two global-layer states the two live forms fire under cannot both be driven
// in this process, and neither may be that file. The child reports FACTS rather
// than the config itself: a live object cannot cross a process boundary, and
// half the question here is prototype identity rather than value.
const MERGE_LIB = pathToFileURL(join(dirname(CONFIG), 'lib', 'config-merge.mjs')).href;
const MERGE_FACTS = `import(${JSON.stringify(MERGE_LIB)}).then((m) => {
  const c = m.mergeLayers(process.argv[1]).config;
  process.stdout.write(JSON.stringify({
    gitUndefined: c.git === undefined,
    // null means "not reachable": no fixture below sets it to null.
    onProtected: c.git && c.git.on_protected !== undefined ? c.git.on_protected : null,
    configProto: Object.getPrototypeOf(c) === Object.prototype,
    gitProto: c.git === undefined || Object.getPrototypeOf(c.git) === Object.prototype,
    plainObjectClean: ({}).on_protected === undefined,
  }));
});`;

/**
 * The merged config's facts over one two-layer fixture. `globalBytes` omitted
 * writes no global file at all - a legitimately absent layer, which is the
 * state the top-level form is live under.
 * @param {string} label @param {string} repoBytes @param {string} [globalBytes]
 */
function mergeFacts(label, repoBytes, globalBytes) {
  const repoFile = join(dir, `cfg01-${label}-repo.json`);
  writeFileSync(repoFile, repoBytes);
  const globalFile = join(dir, `cfg01-${label}-global.json`);
  if (globalBytes !== undefined) writeFileSync(globalFile, globalBytes);
  const env = { ...process.env, CADENCE_GLOBAL_CONFIG: globalFile };
  return JSON.parse(execFileSync('node', ['-e', MERGE_FACTS, repoFile], { encoding: 'utf8', env }));
}

// The payload: either half alone disarms git-guard on a protected branch.
const PAYLOAD = '{"on_protected":"allow","protected_branches":[]}';
// A global layer that defines `git` WITHOUT defining `on_protected`. The second
// half is load-bearing: a global `on_protected` puts an OWN key on the merged
// `git` object, which shadows a value installed on that object's prototype, so
// the nested arm would read the same thing before and after the repair and
// distinguish nothing.
const GLOBAL_GIT = '{"git":{"base_branch":"main"}}';

test('merge: a top-level __proto__ repo layer reparents nothing (no global layer)', () => {
  const f = mergeFacts('top', `{"__proto__":{"git":${PAYLOAD}}}`);
  assert.equal(f.gitUndefined, true, 'the hostile block is not reachable as config.git');
  assert.equal(f.onProtected, null);
  assert.equal(f.configProto, true, 'an ordinary Object.prototype, never a poisoned one (D-01)');
  assert.equal(f.plainObjectClean, true);

  // The contrast, so this is a decision rather than a constant: the identical
  // payload written as an ORDINARY key still merges through, on the same fixture
  // shape and the same absent global layer.
  const legit = mergeFacts('top-control', `{"git":${PAYLOAD}}`);
  assert.equal(legit.gitUndefined, false);
  assert.equal(legit.onProtected, 'allow');
  assert.equal(legit.configProto, true);
});

test('merge: a nested git.__proto__ repo layer reparents nothing (global layer defines git)', () => {
  // The mirror form, live under the OPPOSITE global-layer state: with no global
  // `git` the merge returns the repo object as-is and the hostile key is already
  // inert, so a repair proved only against the top-level shape leaves every
  // machine that HAS a global config exploitable (D-07).
  const f = mergeFacts('nested', `{"git":{"__proto__":${PAYLOAD}}}`, GLOBAL_GIT);
  assert.equal(f.onProtected, null, 'the payload is not reachable as config.git.on_protected');
  assert.equal(f.gitProto, true, 'the merged git object keeps Object.prototype');
  assert.equal(f.gitUndefined, false, 'the GLOBAL layer legitimately defines git');

  // The contrast: an ordinary nested key over the same global layer merges.
  const legit = mergeFacts('nested-control', '{"git":{"on_protected":"allow"}}', GLOBAL_GIT);
  assert.equal(legit.onProtected, 'allow');
  assert.equal(legit.gitProto, true);
});

test('merge: constructor and prototype repo layers stay inert (regression pins only)', () => {
  // PINS, not proof. Both spellings pass against the UNFIXED merge - deepMerge's
  // guard returns `over` when `base[k]` is a function or undefined, which makes
  // an own shadow property rather than firing a setter (D-08) - so an arm built
  // on these two distinguishes nothing about the repair and must never stand in
  // for the two arms above.
  for (const key of ['constructor', 'prototype']) {
    const alone = mergeFacts(`${key}-alone`, `{"${key}":{"git":${PAYLOAD}}}`);
    assert.equal(alone.gitUndefined, true, `${key}: nothing reaches config.git`);
    assert.equal(alone.configProto, true, key);

    // With a global layer defining `git`, `config.git` is that layer's own
    // object and is DEFINED - by the global config, not by the hostile repo
    // layer. What has to stay true in both states is that the payload is
    // unreachable, which `onProtected` is the reading of.
    const withGlobal = mergeFacts(`${key}-global`, `{"${key}":{"git":${PAYLOAD}}}`, GLOBAL_GIT);
    assert.equal(withGlobal.onProtected, null, key);
    assert.equal(withGlobal.gitProto, true, key);
  }
});

test('validate: a hostile __proto__ key is REPORTED, not skipped as an annotation', () => {
  // The read face's half of CFG-01. `flatten` skipped every `_`-prefixed key,
  // so the file the guard was already obeying inspected as
  // {"ok":true,"checked":0,"errors":[]} - clean, and with nothing checked.
  const gpath = join(dir, 'cfg01-validate-global.json');
  const hostile = join(dir, 'cfg01-validate-hostile.json');
  writeFileSync(hostile, `{"__proto__":{"git":${PAYLOAD}}}`);
  const r = run(['validate', '--file', hostile], gpath);
  assert.equal(r.ok, false);
  assert.ok(r.checked >= 1, `nothing was checked: ${JSON.stringify(r)}`);
  assert.ok(r.errors.some((e) => e.key.includes('__proto__')), JSON.stringify(r.errors));
  assert.equal(r.errors[0].error, 'unknown key');

  // The SCALAR spelling, which is the only arm the accumulator half of the
  // narrowing can go red on: an object-valued `__proto__` recurses to dotted
  // leaf paths that never touch the accumulator's own `__proto__` key, while a
  // top-level scalar leaf assigns at exactly that key and is silently lost.
  const scalar = join(dir, 'cfg01-validate-scalar.json');
  writeFileSync(scalar, '{"__proto__":"x"}');
  const s = run(['validate', '--file', scalar], gpath);
  assert.equal(s.ok, false);
  assert.ok(s.checked >= 1, `the leaf never reached the report: ${JSON.stringify(s)}`);
  assert.deepEqual(s.errors, [{ key: '__proto__', error: 'unknown key' }]);

  // The narrowing is to exactly `_meta`, never a deletion: the annotation block
  // the schema documents still validates clean, with real keys still counted.
  // (The shipped arm above pins this too; repeated here because THIS is the
  // change that could have taken it out.)
  const annotated = join(dir, 'cfg01-validate-meta.json');
  writeFileSync(annotated, JSON.stringify({ _meta: { note: 'hand-edited' }, granularity: 'coarse' }));
  const m = run(['validate', '--file', annotated], gpath);
  assert.equal(m.ok, true, JSON.stringify(m.errors));
  assert.equal(m.checked, 1);
});

test('get: the hostile file resolves git.on_protected to the value the guard acts on', () => {
  // A PIN, not the distinguishing assertion: `git.on_protected` is absent from
  // the flattened map before the narrowing (the `_` skip drops the branch) and
  // after it (the branch flattens under `__proto__.`), so it reads the schema
  // default either way. What moved is that the MERGE now reads the same thing -
  // before the repair the guard obeyed "allow" while this face said "ask".
  const gpath = join(dir, 'cfg01-get-global.json');
  const hostile = join(dir, 'cfg01-get-hostile.json');
  writeFileSync(hostile, `{"__proto__":{"git":${PAYLOAD}}}`);
  const r = run(['get', 'git.on_protected', '--file', hostile], gpath);
  assert.equal(r.ok, true);
  assert.equal(r.values['git.on_protected'], 'ask');

  // The contrast, so this is not satisfied by a constant: the same value set as
  // an ORDINARY key reads back through the same face.
  const legit = join(dir, 'cfg01-get-legit.json');
  writeFileSync(legit, `{"git":${PAYLOAD}}`);
  assert.equal(run(['get', 'git.on_protected', '--file', legit], gpath).values['git.on_protected'],
    'allow');
});

// --- CFG-02: a repo layer cannot choose what runs, or where a key is read from -
//
// The behaviour arms of lib/global-only-keys.mjs, driven through the two faces
// that share the merge. The per-row unit tests live in
// global-only-keys.test.mjs; these ask what `config.mjs get` reports.

/**
 * Write one two-layer fixture and read one key back through `get`.
 * @param {string} label @param {any} repo @param {any} [global]
 * @param {string} [key]
 */
function scoped(label, repo, global, key = 'workflow.test_command') {
  const repoFile = join(dir, `cfg02-${label}-repo.json`);
  writeFileSync(repoFile, JSON.stringify(repo));
  const globalFile = join(dir, `cfg02-${label}-global.json`);
  if (global !== undefined) writeFileSync(globalFile, JSON.stringify(global));
  return { r: run(['get', key, '--file', repoFile], globalFile), repoFile };
}

test('get: a repo layer setting workflow.test_command loses to the user-global one', () => {
  const { r, repoFile } = scoped('beaten',
    { workflow: { test_command: 'repo-cmd' } },
    { workflow: { test_command: 'global-cmd' } });
  assert.equal(r.ok, true);
  assert.equal(r.values['workflow.test_command'], 'global-cmd');
  // ...and it is named, with the file it came from, so an attack and an honest
  // mistake are equally visible.
  const named = (r.warnings || []).filter((w) => /workflow\.test_command/.test(w));
  assert.equal(named.length, 1, JSON.stringify(r.warnings));
  assert.ok(named[0].includes(repoFile), named[0]);
});

test('get: the same key in the repo layer ALONE resolves to the schema default', () => {
  // The half that shows the repo value is dropped rather than merely outranked:
  // with no global layer to win, the read still lands on null.
  const { r, repoFile } = scoped('alone', { workflow: { test_command: 'repo-cmd' } });
  assert.equal(r.ok, true);
  assert.equal(r.values['workflow.test_command'], null);
  const named = (r.warnings || []).filter((w) => /workflow\.test_command/.test(w));
  assert.equal(named.length, 1, JSON.stringify(r.warnings));
  assert.ok(named[0].includes(repoFile), named[0]);
});

test('get: all three keys at null - the shipped template shape - are silently dropped', () => {
  // The strip is value-agnostic (D-13). Leaving the null in place would let a
  // scaffolded repo's untouched template SUPPRESS the user-global command,
  // because deepMerge returns the higher layer's value for a null - reverting
  // that half turns this arm red with `null` rather than "global-cmd".
  const { r } = scoped('nulls',
    { workflow: { test_command: null, lint_command: null }, review: { key_file: null } },
    { workflow: { test_command: 'global-cmd' } });
  assert.equal(r.ok, true);
  assert.equal(r.values['workflow.test_command'], 'global-cmd');
  // ...and nothing is said: a new project's first command must not train the
  // click-through habit CFG-02 declined to build.
  assert.equal('warnings' in r, false, JSON.stringify(r.warnings));
});

test('get: all three keys are stripped, not just the first one in the set', () => {
  const repo = {
    workflow: { test_command: 'repo-t', lint_command: 'repo-l' },
    review: { key_file: '/repo/keys.env' },
  };
  const global = {
    workflow: { test_command: 'global-t', lint_command: 'global-l' },
    review: { key_file: '/global/keys.env' },
  };
  for (const [key, want] of [['workflow.test_command', 'global-t'],
    ['workflow.lint_command', 'global-l'], ['review.key_file', '/global/keys.env']]) {
    const { r } = scoped(`all-${key}`, repo, global, key);
    assert.equal(r.values[key], want, `${key}: ${JSON.stringify(r)}`);
  }
});

test('get --global: the user-global layer sets these keys, and is never stripped', () => {
  // The --global arm hands GLOBAL_CONFIG in as the file to read, collapsing it
  // into the repo slot. Stripping there would drop the user's OWN settings and
  // then warn them about it.
  const gpath = join(dir, 'cfg02-asglobal.json');
  writeFileSync(gpath, JSON.stringify({ workflow: { test_command: 'global-cmd' } }));
  const r = run(['get', '--global', 'workflow.test_command'], gpath);
  assert.equal(r.ok, true);
  assert.equal(r.values['workflow.test_command'], 'global-cmd');
  assert.equal(r.source, 'global');
  assert.equal('warnings' in r, false, JSON.stringify(r.warnings));
});

test('get: an unrelated repo key still merges - the strip is exactly three keys', () => {
  const { r } = scoped('sibling',
    { workflow: { test_command: 'repo-cmd', max_plan_tasks: 4 } }, undefined,
    'workflow.max_plan_tasks');
  assert.equal(r.values['workflow.max_plan_tasks'], 4);
});

// --- get: an unset gate reads as unset, not as a gate (GAT-02) ---------------
// The defect: `config.mjs get` answered a `review.triggers.<t>.gate` out of the
// schema default when no layer had set one, so a reader was told a gate routing
// fires at no level, and `workflows/execute.md` had to carry a paragraph
// telling callers not to pre-fetch a gate through this seam. The schema's
// sentinel does the VALUE half (`null` for every unset gate); these arms pin
// the REPORTING half - which of the two states the seam says it is in.

/** The four gate keys, walked rather than spelled per test. */
const GATE_KEYS = ['plan', 'diff', 'risk_surface', 'phase_diff']
  .map((t) => `review.triggers.${t}.gate`);

/** Gate-unset warnings in an envelope, by the seam they must point a reader at. */
const gateWarnings = (r) => (r.warnings || []).filter((w) => /route\.mjs resolve/.test(w));

test('get: every unset gate answers null plus exactly one warning naming route.mjs resolve', () => {
  const gpath = join(dir, 'gates-no-global.json');
  const repo = join(dir, 'gates-absent.json');
  for (const key of GATE_KEYS) {
    const r = run(['get', '--file', repo, key], gpath);
    assert.equal(r.ok, true);
    assert.equal(r.values[key], null, key);
    const named = gateWarnings(r);
    assert.equal(named.length, 1, `${key}: ${JSON.stringify(r.warnings)}`);
    assert.match(named[0], new RegExp(key.replace(/\./g, '\\.')));
    // D-07: the seam does not know the stakes level, so it must not answer for
    // one. A warning naming a gate would be the same defect pointed the other way.
    assert.ok(!/\b(off|advisory|blocking|adjudicated)\b/.test(named[0]), named[0]);
  }
});

test('get: a gate a layer PINNED reads back byte-identical, with no unset warning', () => {
  const gpath = join(dir, 'gates-pinned-global.json');
  const repo = join(dir, 'gates-pinned-repo.json');
  const pinned = { plan: 'off', diff: 'blocking', risk_surface: 'adjudicated', phase_diff: 'advisory' };
  writeFileSync(repo, JSON.stringify({ review: { triggers: Object.fromEntries(
    Object.entries(pinned).map(([t, gate]) => [t, { gate }])) } }));
  for (const [t, gate] of Object.entries(pinned)) {
    const key = `review.triggers.${t}.gate`;
    const r = run(['get', '--file', repo, key], gpath);
    assert.equal(r.values[key], gate, key);
    assert.deepEqual(gateWarnings(r), [], key);
  }
});

test('get: the round trip through `set` - blocking answers blocking, unwarned', () => {
  // AC3 in its literal shape: the write face, then the read face.
  const gpath = join(dir, 'gates-set-global.json');
  const repo = join(dir, 'gates-set-repo.json');
  writeFileSync(repo, '{}\n');
  const before = run(['get', '--file', repo, 'review.triggers.diff.gate'], gpath);
  assert.equal(before.values['review.triggers.diff.gate'], null);
  assert.equal(gateWarnings(before).length, 1);
  assert.equal(run(['set', '--file', repo, 'review.triggers.diff.gate=blocking'], gpath).ok, true);
  const after = run(['get', '--file', repo, 'review.triggers.diff.gate'], gpath);
  assert.equal(after.values['review.triggers.diff.gate'], 'blocking');
  assert.deepEqual(gateWarnings(after), []);
});

test('get: the KEYLESS full read carries no gate warning at all', () => {
  // D-02. A full read walks every schema key, so warning there would append one
  // line per gate to prose workflows/milestone.md and verify.md relay to the
  // user - for a caller that asked about no gate in particular.
  const r = run(['get', '--file', join(dir, 'gates-absent.json')],
    join(dir, 'gates-no-global.json'));
  assert.equal(r.ok, true);
  for (const key of GATE_KEYS) assert.equal(r.values[key], null, key);
  assert.deepEqual(gateWarnings(r), [], JSON.stringify(r.warnings));
});

// --- get: an unset tier / effort reads as unset too (RVW-03) ------------------
//
// WATCHED FAILING AT 478b1ff, the tip of this plan's unpatched tree. Observed
// there: `review.triggers.plan.tier` answered `flagship` and `.effort` answered
// `high` on a repository where no layer sets either, so the read face reported
// a value nothing resolves - the same defect GAT-02 closed for `.gate`, on the
// two fields that actually reach a cross-model reviewer.

/** The eight cross-model panel keys, walked rather than spelled per test. */
const PANEL_KEYS = ['plan', 'diff', 'risk_surface', 'phase_diff']
  .flatMap((t) => [`review.triggers.${t}.tier`, `review.triggers.${t}.effort`]);

test('get: every unset tier and effort answers null plus one warning naming route.mjs resolve', () => {
  const gpath = join(dir, 'panel-no-global.json');
  const repo = join(dir, 'panel-absent.json');
  for (const key of PANEL_KEYS) {
    const r = run(['get', '--file', repo, key], gpath);
    assert.equal(r.ok, true);
    assert.equal(r.values[key], null, key);
    const named = gateWarnings(r);
    assert.equal(named.length, 1, `${key}: ${JSON.stringify(r.warnings)}`);
    assert.match(named[0], new RegExp(key.replace(/\./g, '\\.')));
    // D-07 again: this seam does not know the stakes level, so it must not
    // answer for one. A warning naming a tier or an effort would be the same
    // defect pointed the other way.
    assert.ok(!/\b(flagship|balanced|cheap|minimal|low|medium|high)\b/.test(named[0]), named[0]);
  }
});

test('get: a tier or effort a layer PINNED reads back byte-identical, unwarned', () => {
  const gpath = join(dir, 'panel-pinned-global.json');
  const repo = join(dir, 'panel-pinned-repo.json');
  const pinned = { plan: { tier: 'cheap', effort: 'minimal' },
    risk_surface: { tier: 'flagship', effort: 'high' } };
  writeFileSync(repo, JSON.stringify({ review: { triggers: pinned } }));
  for (const [t, spec] of Object.entries(pinned)) {
    for (const [field, value] of Object.entries(spec)) {
      const key = `review.triggers.${t}.${field}`;
      const r = run(['get', '--file', repo, key], gpath);
      assert.equal(r.values[key], value, key);
      assert.deepEqual(gateWarnings(r), [], key);
    }
  }
});

test('get: the KEYLESS full read carries no panel warning either', () => {
  // D-02. RVW-03 tripled this family: warning on a full read would append
  // twelve lines to prose workflows relay straight to the user.
  const r = run(['get', '--file', join(dir, 'panel-absent.json')],
    join(dir, 'panel-no-global.json'));
  assert.equal(r.ok, true);
  for (const key of PANEL_KEYS) assert.equal(r.values[key], null, key);
  assert.deepEqual(gateWarnings(r), [], JSON.stringify(r.warnings));
});

test('check: null is still refused at the write face for a tier and an effort', () => {
  // The sentinel is the schema's way of saying "nobody set one", never
  // something a user writes - the `values` arrays did not move.
  for (const [key, names] of [['review.triggers.plan.tier', /flagship, balanced, cheap/],
    ['review.triggers.plan.effort', /minimal, low, medium, high/]]) {
    const r = run(['check', `${key}=null`]);
    assert.equal(r.ok, false, key);
    assert.equal(r.reason, 'invalid');
    assert.equal(r.detail[0].key, key);
    assert.match(r.detail[0].error, names);
  }
});

test('check: null is still refused at the write face - the sentinel is not a value', () => {
  // D-05: the `values` arrays stay four-membered, so `set` and `check` behave
  // byte-identically to before the default moved. `null` is the schema's way of
  // saying "nobody set one", never something a user writes.
  const r = run(['check', 'review.triggers.diff.gate=null']);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'invalid');
  assert.equal(r.detail[0].key, 'review.triggers.diff.gate');
  assert.match(r.detail[0].error, /must be one of: off, advisory, blocking, adjudicated/);
});

// --- ARG-05: a prototype member is an unknown key at the READ face ------------
//
// The counterpart the merge-path block above says it lacks. Those three rows
// PIN `constructor` and `prototype` on the merge path and distinguish nothing
// about a repair; these rows go red the moment either `Object.hasOwn` in `get`
// is reverted to the bare index read, because a bare `SCHEMA[k]` resolves every
// Object.prototype member truthy through the prototype chain.
//
// The set is WALKED, never hand-listed (D-13): Object.prototype carries twelve
// own names, and `__defineGetter__` and its three siblings are as much a hole
// as the obvious `constructor` / `toString` / `valueOf`. A hand-list is how the
// next member the language adds stops being covered.
const PROTO_MEMBERS = Object.getOwnPropertyNames(Object.prototype);

// `run` above discards the exit status; these rows assert it, because a
// refusal that exits 0 is the shape being repaired.
function runStatus(args, globalPath) {
  const env = { ...process.env };
  if (globalPath) env.CADENCE_GLOBAL_CONFIG = globalPath;
  try {
    return { status: 0, json: JSON.parse(execFileSync('node', [CONFIG, ...args], { encoding: 'utf8', env })) };
  } catch (e) {
    return { status: e.status, json: JSON.parse(e.stdout) };
  }
}

test('get: every Object.prototype member is refused as an unknown key at exit 1', () => {
  const gpath = join(dir, 'proto-read-no-global.json');
  assert.ok(PROTO_MEMBERS.length >= 12, JSON.stringify(PROTO_MEMBERS));
  for (const key of PROTO_MEMBERS) {
    // `--file` at an absent path, so the answer comes from the schema alone and
    // no layer can be blamed for it.
    const { status, json } = runStatus(['get', '--file', join(dir, 'proto-read-absent.json'), key], gpath);
    assert.equal(json.ok, false, `${key}: ${JSON.stringify(json)}`);
    assert.equal(json.reason, 'unknown-key', key);
    assert.deepEqual(json.detail, [key], key);
    assert.equal(status, 1, key);
    // The measured pre-repair answer, named so a reader knows what changed:
    // `{"ok":true,"values":{}}` at exit 0 for `__proto__` (the assignment ran
    // Object.prototype's setter and stored nothing) and for the rest (the
    // spec's `.default` is undefined, which JSON.stringify drops).
    assert.equal(json.values, undefined, key);
  }
});

test('get: a mix of a real key and a prototype member refuses, never answers for one', () => {
  const gpath = join(dir, 'proto-mixed-no-global.json');
  const { status, json } = runStatus(
    ['get', '--file', join(dir, 'proto-mixed-absent.json'), 'stakes', '__proto__'], gpath);
  assert.equal(json.ok, false, JSON.stringify(json));
  assert.equal(json.reason, 'unknown-key');
  assert.deepEqual(json.detail, ['__proto__']);   // names the offender, not the pair
  assert.equal(status, 1);
  // Measured before the repair: {"ok":true,"values":{"stakes":"shipped"}} at
  // exit 0 - one key of the two asked for, with nothing saying the other was
  // dropped.
  assert.equal(json.values, undefined);
});

test('get: the repair costs a live key nothing - one named and the keyless read both answer', () => {
  const gpath = join(dir, 'proto-live-no-global.json');
  const one = runStatus(['get', '--file', join(dir, 'proto-live-absent.json'), 'stakes'], gpath);
  assert.equal(one.json.ok, true, JSON.stringify(one.json));
  assert.equal(one.json.values['stakes'], 'shipped');
  assert.equal(one.status, 0);

  // The keyless arm walks Object.keys(SCHEMA), which yields own keys only, so
  // it must still return every schema key with its default resolved.
  const all = runStatus(['get', '--file', join(dir, 'proto-live-absent.json')], gpath);
  assert.equal(all.json.ok, true, JSON.stringify(all.json).slice(0, 200));
  const schemaKeys = Object.keys(run(['keys']).keys);
  assert.deepEqual(Object.keys(all.json.values), schemaKeys);
  assert.equal(all.json.values['stakes'], 'shipped');
  assert.equal(all.status, 0);
});

// --- ARG-05: the WRITE face stops fabricating a retirement --------------------

test('check: every Object.prototype member is an unknown key, never a retirement', () => {
  // Measured before the repair: `check '__proto__=1'` answered
  // `retired in v2.0.0: undefined`, and so did `constructor=1`, `toString=1` and
  // `hasOwnProperty=1`. A WRONG diagnostic rather than a missing one - it names
  // a retirement that never happened. Both bare index reads in checkPairs
  // produced it: `RETIRED_KEYS[key]` resolved to Object.prototype and won the
  // first arm, and `SCHEMA[key]` would have reached checkValue as a "spec"
  // carrying no `type`.
  for (const key of PROTO_MEMBERS) {
    const { status, json } = runStatus(['check', `${key}=1`]);
    assert.equal(json.ok, false, `${key}: ${JSON.stringify(json)}`);
    assert.equal(json.reason, 'invalid', key);
    assert.deepEqual(json.detail, [{ key, error: 'unknown key' }], key);
    assert.equal(status, 1, key);
  }
});

test('check: a genuinely retired key still reports its own milestone and remediation', () => {
  // The guard's cost, measured: none. The retirement vocabulary has to survive
  // the fix, or a real rename now reads as the generic `unknown key` and the
  // user is sent nowhere.
  const r = run(['check', 'review.triggers.pre_ship.gate=x']);
  assert.equal(r.ok, false);
  assert.equal(r.detail[0].key, 'review.triggers.pre_ship.gate');
  assert.match(r.detail[0].error, /^retired in v3\.2\.0: /);
  assert.match(r.detail[0].error, /risk_surface/);
  assert.doesNotMatch(r.detail[0].error, /undefined/);
  assert.notEqual(r.detail[0].error, 'unknown key');
});

test('set: a prototype member is refused and nothing is written', () => {
  const gpath = join(dir, 'proto-write.json');
  for (const key of ['__proto__', 'constructor', 'toString']) {
    const { status, json } = runStatus(['set', '--global', `${key}=1`], gpath);
    assert.equal(json.ok, false, key);
    assert.equal(json.reason, 'invalid', key);
    assert.deepEqual(json.detail, [{ key, error: 'unknown key' }], key);
    assert.equal(status, 1, key);
    // --global auto-creates, so an unrefused pair would have left a file here.
    assert.equal(existsSync(gpath), false, key);
  }
});
