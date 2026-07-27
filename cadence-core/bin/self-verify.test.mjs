// Zero-dep tests for self-verify.mjs (the prose<->code drift linter). Run:
// node --test 'cadence-core/bin/*.test.mjs'
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, cpSync, rmSync, renameSync, symlinkSync, chmodSync } from 'node:fs';
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

/**
 * A fixture with agent files and/or a weight-budgets.json manifest, for the
 * budget (CWT-02) and tools-lint (CWT-03) checks. Real schema is copied so the
 * config-key checks stay quiet about unrelated keys.
 * @param {{agents?:Record<string,string>, budgets?:Record<string,number>|null}} opts
 */
function fixtureWith({ agents = {}, budgets = null }) {
  const root = mkdtempSync(join(tmpdir(), 'cad-selfverify-'));
  for (const d of ['cadence-core/workflows', 'cadence-core/references',
    'cadence-core/templates', 'cadence-core/bin', 'skills', 'agents']) {
    mkdirSync(join(root, d), { recursive: true });
  }
  cpSync(join(REPO, 'cadence-core', 'config.schema.json'),
    join(root, 'cadence-core', 'config.schema.json'));
  for (const [name, text] of Object.entries(agents)) {
    writeFileSync(join(root, 'agents', name), text);
  }
  if (budgets) {
    writeFileSync(join(root, 'cadence-core', 'bin', 'weight-budgets.json'),
      JSON.stringify({ budgets }, null, 2));
  }
  return root;
}

/**
 * A full-tree fixture: has `.claude-plugin/plugin.json` (the isFullTree
 * marker) plus every always-expected input (#44) - the five core surface
 * dirs, `cadence-core/bin/weight-budgets.json`, and `INTERNALS.md` - so a
 * test can delete/rename exactly one and assert the gate catches it.
 */
function fullFixture() {
  const root = mkdtempSync(join(tmpdir(), 'cad-selfverify-full-'));
  mkdirSync(join(root, '.claude-plugin'), { recursive: true });
  writeFileSync(join(root, '.claude-plugin', 'plugin.json'), '{}');
  for (const d of ['cadence-core/workflows', 'cadence-core/references',
    'cadence-core/templates', 'cadence-core/bin', 'skills', 'agents']) {
    mkdirSync(join(root, d), { recursive: true });
  }
  cpSync(join(REPO, 'cadence-core', 'config.schema.json'),
    join(root, 'cadence-core', 'config.schema.json'));
  writeFileSync(join(root, 'cadence-core', 'bin', 'weight-budgets.json'),
    JSON.stringify({ budgets: {} }, null, 2));
  writeFileSync(join(root, 'INTERNALS.md'), 'Read the code: `cadence-core/config.schema.json`.\n');
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

test('#50: a CRLF backslash continuation joins like an LF one (the --items regression, CRLF spelling)', () => {
  const root = fixture(
    'node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" uat refresh --phase 1 \\\r\n  --items -\r\n');
  const p = run(['--root', root]).problems;
  assert.ok(p.some((x) => x.kind === 'unknown-flag' && /--items/.test(x.detail)));
});

test('#50: an EVEN backslash run does NOT continue the line - the next line is a separate command (D-15 parity, shared with git-guard)', () => {
  // `\\` at EOL is a literal backslash, not a continuation, so `--items` sits
  // on a line of its own and belongs to no planning.mjs invocation. A
  // parity-blind join merges it in and invents an unknown-flag that the prose
  // never wrote. git-guard.mjs carries the identical parity-aware regex - the
  // two seams stay ONE idiom (D-15), and being wrong in lockstep is not what
  // that decision asked for.
  const root = fixture(
    'node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" uat refresh --phase 1 \\\\\n--items -\n');
  const p = run(['--root', root]).problems;
  assert.ok(!p.some((x) => x.kind === 'unknown-flag' && /--items/.test(x.detail)));
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
    '`review.request_timeout_ms`\n' +
    '`review.consult.enabled` `review.consult.tier` `review.consult.effort`\n' +
    '`review.consult.attempt_threshold` `review.decision_review.tier`\n' +
    '`review.decision_review.effort` `model.profile` `model.auto.ceiling`\n' +
    '`model.auto.escalate_on_failure` `model.auto.max_escalations` `granularity`\n' +
    '`model.overrides`\n' +
    '`workflow.research` `workflow.plan_check` `workflow.verifier` `workflow.skip_discuss`\n' +
    '`workflow.subagent_timeout` `workflow.inline_plan_threshold` `workflow.test_command`\n' +
    '`parallelization.enabled` `parallelization.max_concurrent_agents`\n' +
    '`parallelization.min_plans_for_parallel` `parallelization.use_worktrees`\n' +
    '`git.protected_branches` `git.on_protected` `git.integration_branch`\n' +
    '`git.auto_branch` `git.base_branch` `git.create_tag`\n' +
    '`git.on_land_cleanup` `git.auto_close`\n' +
    '`planning.commit_docs` `memory.backend`\n');
  const r = run(['--root', root]);
  assert.equal(r.ok, true, JSON.stringify(r.problems));
});

// --- context-weight budget check (CWT-02) ---

test('a surface over its declared budget is flagged with the overage', () => {
  const root = fixtureWith({
    agents: { 'big.md': 'x'.repeat(500) },
    budgets: { 'agents/big.md': 10 },
  });
  const p = run(['--root', root]).problems;
  assert.ok(p.some((x) => x.kind === 'budget-overrun'
    && x.file === 'agents/big.md' && /exceeds budget 10B/.test(x.detail)));
});

test('a surface at or under its budget yields no overrun', () => {
  const body = 'hello';
  const root = fixtureWith({
    agents: { 'ok.md': body },
    budgets: { 'agents/ok.md': Buffer.byteLength(body, 'utf8') + 100 },
  });
  assert.ok(!run(['--root', root]).problems.some((x) => x.kind === 'budget-overrun'));
});

test('a measured surface missing from the manifest is flagged unbudgeted', () => {
  const root = fixtureWith({
    agents: { 'a.md': '---\nname: t\ntools: Read\n---\nbody\n' },
    budgets: { 'agents/other.md': 100 },
  });
  const p = run(['--root', root]).problems;
  assert.ok(p.some((x) => x.kind === 'unbudgeted-surface' && x.file === 'agents/a.md'));
});

// --- agents-only tools-declaration lint (CWT-03) ---

test('a backtick/the-X-tool reference absent from tools: is flagged', () => {
  const root = fixtureWith({
    agents: { 'a.md': '---\nname: t\ntools: Read\n---\nUse `Bash` and the Grep tool.\n' },
    budgets: { 'agents/a.md': 10000 },
  });
  const p = run(['--root', root]).problems;
  assert.ok(p.some((x) => x.kind === 'undeclared-tool'
    && x.file === 'agents/a.md' && /Bash/.test(x.detail)));
});

test('a tool referenced and declared yields no undeclared-tool', () => {
  const root = fixtureWith({
    agents: { 'a.md': '---\nname: t\ntools: Read, Bash\n---\nUse `Bash` here.\n' },
    budgets: { 'agents/a.md': 10000 },
  });
  assert.ok(!run(['--root', root]).problems.some((x) => x.kind === 'undeclared-tool'));
});

test('bare-word tool names (D-06 collisions) are not false positives', () => {
  const root = fixtureWith({
    agents: { 'a.md': '---\nname: t\ntools: Read\n---\n'
      + '| Task | Commit |\nWrite `None.` when empty.\nTask completeness matters.\n' },
    budgets: { 'agents/a.md': 10000 },
  });
  assert.ok(!run(['--root', root]).problems.some((x) => x.kind === 'undeclared-tool'));
});

// --- unreadable-surface resilience (#49.1) ---

test('#49.1: a dangling symlink under agents/ is reported loudly, not collapsed to internal', () => {
  const root = fixtureWith({
    agents: { 'a.md': '---\nname: t\ntools: Read\n---\nUse `Bash` here.\n' },
    budgets: { 'agents/a.md': 10000 },
  });
  symlinkSync('nowhere.md', join(root, 'agents', 'dangling.md'));
  const r = run(['--root', root]);
  assert.equal(r.ok, false);
  assert.equal(r.reason, undefined);
  assert.ok(r.problems.some((p) =>
    p.kind === 'unreadable-surface' && p.file === 'agents/dangling.md'));
  // Proof the LAST check (the agents tools-declaration lint, D-13's third
  // site) still ran after the unreadable entry.
  assert.ok(r.problems.some((p) =>
    p.kind === 'undeclared-tool' && /Bash/.test(p.detail)));
  // Proof the lib stayed silent (D-05): no unbudgeted-surface for the link.
  assert.ok(!r.problems.some((p) =>
    p.kind === 'unbudgeted-surface' && p.file === 'agents/dangling.md'));
});

test('#49.1: a symlink cycle under agents/ is reported loudly too', () => {
  const root = fixtureWith({
    agents: { 'a.md': '---\nname: t\ntools: Read\n---\nUse `Bash` here.\n' },
    budgets: { 'agents/a.md': 10000 },
  });
  rmSync(join(root, 'agents', 'a.md'));
  symlinkSync('b.md', join(root, 'agents', 'a.md'));
  symlinkSync('a.md', join(root, 'agents', 'b.md'));
  const r = run(['--root', root]);
  assert.equal(r.reason, undefined);
  assert.ok(r.problems.some((p) =>
    p.kind === 'unreadable-surface' && p.file === 'agents/a.md'));
});

test('#49.1: a malformed weight-budgets.json reports one problem instead of collapsing the run', () => {
  // The walkers were guarded, but the reads that run AFTER the walk were not.
  // An unreadable or malformed weight-budgets.json / INTERNALS.md unwound
  // run() and the dispatch catch flattened it to {ok:false,reason:'internal'}
  // with `problems` absent - the same #49.1 collapse, one check later.
  const root = fullFixture();
  writeFileSync(join(root, 'cadence-core', 'bin', 'weight-budgets.json'), '{ not json');
  const r = run(['--root', root]);
  assert.equal(r.reason, undefined);
  assert.equal(r.problems.filter((p) => p.kind === 'unreadable-surface'
    && p.file === 'cadence-core/bin/weight-budgets.json').length, 1);
});

test('#49.1: an unreadable INTERNALS.md is reported exactly once, not twice', {
  skip: typeof process.getuid === 'function' && process.getuid() === 0
    ? 'root bypasses mode bits' : false,
}, () => {
  const root = fullFixture();
  const internals = join(root, 'INTERNALS.md');
  chmodSync(internals, 0o000);
  try {
    const r = run(['--root', root]);
    assert.equal(r.reason, undefined);
    // mdFiles yields INTERNALS.md too, so the 3b read-guard must NOT push a
    // second entry - one broken file, one problem.
    assert.equal(r.problems.filter((p) => p.kind === 'unreadable-surface'
      && p.file === 'INTERNALS.md').length, 1);
  } finally {
    chmodSync(internals, 0o644);
  }
});

test('INTERNALS.md: a backticked repo path that does not exist is flagged; a real one and a glob are not', () => {
  const root = mkdtempSync(join(tmpdir(), 'cad-selfverify-'));
  for (const d of ['cadence-core/workflows', 'cadence-core/references',
    'cadence-core/templates', 'skills', 'agents']) {
    mkdirSync(join(root, d), { recursive: true });
  }
  cpSync(join(REPO, 'cadence-core', 'config.schema.json'),
    join(root, 'cadence-core', 'config.schema.json'));
  // config.schema.json exists in the fixture; a bogus path and a glob do not.
  writeFileSync(join(root, 'INTERNALS.md'),
    'Read the code: `cadence-core/config.schema.json`, the `*-decision.mjs` cores, '
    + 'and `cadence-core/bin/does-not-exist.mjs`.\n');
  const p = run(['--root', root]).problems;
  const internals = p.filter((x) => x.kind === 'missing-internals-path');
  assert.equal(internals.length, 1, 'exactly the one bogus path is flagged');
  assert.equal(internals[0].detail, 'cadence-core/bin/does-not-exist.mjs');
});

// --- always-expected inputs gate (#44) ---

test('a full tree missing weight-budgets.json fails ok:false naming the input', () => {
  const root = fullFixture();
  rmSync(join(root, 'cadence-core', 'bin', 'weight-budgets.json'));
  const r = run(['--root', root]);
  assert.equal(r.ok, false);
  const hit = r.problems.find((p) => p.kind === 'missing-input'
    && p.file === 'cadence-core/bin/weight-budgets.json');
  assert.ok(hit, JSON.stringify(r.problems));
});

test('a full tree with a core surface dir renamed away fails ok:false naming it', () => {
  const root = fullFixture();
  renameSync(join(root, 'cadence-core', 'workflows'), join(root, 'cadence-core', 'workflows-renamed'));
  const r = run(['--root', root]);
  assert.equal(r.ok, false);
  const hit = r.problems.find((p) => p.kind === 'missing-input' && p.file === 'cadence-core/workflows');
  assert.ok(hit, JSON.stringify(r.problems));
});

test('a full tree missing INTERNALS.md fails ok:false naming it', () => {
  const root = fullFixture();
  rmSync(join(root, 'INTERNALS.md'));
  const r = run(['--root', root]);
  assert.equal(r.ok, false);
  const hit = r.problems.find((p) => p.kind === 'missing-input' && p.file === 'INTERNALS.md');
  assert.ok(hit, JSON.stringify(r.problems));
});

test('a minimal (non-full-tree) fixture omitting optional inputs stays free of missing-input problems', () => {
  // The plain fixture() helper never creates .claude-plugin/plugin.json and
  // never creates weight-budgets.json/INTERNALS.md - it must NOT be treated
  // as a broken full tree; that is what distinguishes a real install from a
  // minimal test fixture (D-03).
  const root = fixture('nothing special here\n');
  const r = run(['--root', root]);
  assert.ok(!r.problems.some((p) => p.kind === 'missing-input'), JSON.stringify(r.problems));
});
