// Zero-dep tests for self-verify.mjs (the prose<->code drift linter). Run:
// node --test 'cadence-core/bin/*.test.mjs'
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const VERIFY = join(HERE, 'self-verify.mjs');
const REPO = join(HERE, '..', '..');

function run(args = []) {
  try {
    return JSON.parse(execFileSync('node', [VERIFY, ...args], { encoding: 'utf8' }));
  } catch (e) {
    return JSON.parse(e.stdout); // problems found -> exit 1, JSON still on stdout
  }
}

/** A minimal fixture repo: real schema, one prose file of the given text. */
function fixture(proseText) {
  const root = mkdtempSync(join(tmpdir(), 'cad-selfverify-'));
  for (const d of ['cadence-core/workflows', 'cadence-core/references',
    'cadence-core/templates', 'skills', 'agents']) {
    mkdirSync(join(root, d), { recursive: true });
  }
  cpSync(join(REPO, 'cadence-core', 'config.schema.json'),
    join(root, 'cadence-core', 'config.schema.json'));
  writeFileSync(join(root, 'cadence-core', 'workflows', 'x.md'), proseText);
  return root;
}

// The load-bearing assertion: the shipped repo itself is drift-free. This is
// the CI gate - a prose edit that invents a key, flag, or path fails here.
test('the repo itself passes self-verification', () => {
  const r = run();
  assert.equal(r.ok, true);
  assert.deepEqual(r.problems, []);
});

test('an invented config key is flagged', () => {
  const root = fixture('Read `workflow.nonexistent_key` and `granularity`.\n');
  const kinds = run(['--root', root]).problems.map((p) => p.kind);
  assert.ok(kinds.includes('unknown-config-key'));
});

test('a phantom flag on a real subcommand is flagged (the --items regression)', () => {
  const root = fixture(
    'node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" uat refresh --phase 1 --items -\n');
  const p = run(['--root', root]).problems;
  assert.ok(p.some((x) => x.kind === 'unknown-flag' && /--items/.test(x.detail)));
});

test('an unknown subcommand and a missing path are flagged', () => {
  const root = fixture(
    'node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" frobnicate\n' +
    'See ${CLAUDE_PLUGIN_ROOT}/cadence-core/missing-file.md too.\n');
  const kinds = run(['--root', root]).problems.map((p) => p.kind);
  assert.ok(kinds.includes('unknown-subcommand'));
  assert.ok(kinds.includes('missing-path'));
});

test('placeholder keys expand: <t> prose covers every trigger key', () => {
  // A fixture referencing every family generically must not report the
  // trigger keys as inert - <t> expands to all triggers.
  const root = fixture(
    '`review.triggers.<t>.gate` `review.triggers.<t>.tier` `review.triggers.<t>.effort`\n' +
    '`review.providers.<name>.tiers` `review.mode` `review.reviewers` `review.key_file`\n' +
    '`review.consult.enabled` `review.consult.tier` `review.consult.effort`\n' +
    '`review.consult.attempt_threshold` `model.profile` `model.auto.ceiling`\n' +
    '`model.auto.escalate_on_failure` `model.auto.max_escalations` `granularity`\n' +
    '`workflow.research` `workflow.plan_check` `workflow.verifier` `workflow.skip_discuss`\n' +
    '`workflow.subagent_timeout` `workflow.inline_plan_threshold` `workflow.test_command`\n' +
    '`parallelization.enabled` `parallelization.max_concurrent_agents`\n' +
    '`parallelization.min_plans_for_parallel` `parallelization.use_worktrees`\n' +
    '`git.protected_branches` `git.on_protected` `git.base_branch` `git.create_tag`\n' +
    '`planning.commit_docs` `memory.backend`\n');
  const r = run(['--root', root]);
  assert.equal(r.ok, true, JSON.stringify(r.problems));
});
