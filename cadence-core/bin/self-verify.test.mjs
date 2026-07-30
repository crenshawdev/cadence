// Zero-dep tests for self-verify.mjs (the prose<->code drift linter). Run:
// node --test 'cadence-core/bin/*.test.mjs'
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, cpSync, rmSync, renameSync, symlinkSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rungBody } from './lib/rung-agent.mjs';

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
 * `skills` entries are keyed by skill NAME and land at skills/<name>/SKILL.md,
 * which is where check 6 (#74) resolves an agent's `skills:` frontmatter.
 * `routeTable` is written verbatim to cadence-core/route-table.json for the
 * rung-ladder check (8); pass a string to write malformed JSON. Omitting it
 * leaves no table, which skips the check.
 * @param {{agents?:Record<string,string>, skills?:Record<string,string>,
 *          budgets?:Record<string,number>|null, routeTable?:object|string}} opts
 */
function fixtureWith({ agents = {}, skills = {}, budgets = null, routeTable = undefined }) {
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
  for (const [name, text] of Object.entries(skills)) {
    mkdirSync(join(root, 'skills', name), { recursive: true });
    writeFileSync(join(root, 'skills', name, 'SKILL.md'), text);
  }
  if (budgets) {
    writeFileSync(join(root, 'cadence-core', 'bin', 'weight-budgets.json'),
      JSON.stringify({ budgets }, null, 2));
  }
  if (routeTable !== undefined) {
    writeFileSync(join(root, 'cadence-core', 'route-table.json'),
      typeof routeTable === 'string' ? routeTable : JSON.stringify(routeTable, null, 2));
  }
  return root;
}

/** The five rungs the shipped table declares, for routing-cell fixtures. */
const RUNG_ORDER = ['low', 'medium', 'high', 'xhigh', 'max'];

/**
 * A well-formed cell-shaped route table for ONE role, complete at all three
 * levels, which a row then breaks in exactly one place. The role is a REAL one:
 * the rung -> agent-file map lives in lib/rung-agent.mjs and knows the six
 * shipped roles, so a fixture inventing `cad-t` would report a missing rung file
 * for every cell and bury the fault the row is about.
 * @param {string} role @param {{model?:string, effort?:string, retry?:string}} [cell]
 */
function cellTable(role = 'cad-verifier', cell = {}) {
  const spec = { model: 'opus', effort: 'high', retry: 'xhigh', ...cell };
  const t = {
    rung_order: RUNG_ORDER,
    model_aliases: ['opus', 'sonnet', 'haiku', 'fable'],
    roles: [role],
    cells: {}, review: {}, verify: {},
  };
  for (const level of ['solo', 'shipped', 'critical']) {
    t.cells[level] = { [role]: { ...spec } };
    t.review[level] = { plan: 'advisory', diff: 'off', risk_surface: 'blocking',
      phase_diff: 'off', pre_ship: 'advisory' };
    t.verify[level] = 'off';
  }
  return t;
}

/** The agent files cellTable's default role+cell names, as fixture entries. */
const VERIFIER_AGENTS = {
  'cad-verifier.md': '---\nname: cad-verifier\ntools: Read\n---\nbody\n',
  'cad-verifier-xhigh.md': '---\nname: cad-verifier-xhigh\ntools: Read\n---\nbody\n',
};

/**
 * A full-tree fixture: has `.claude-plugin/plugin.json` (the isFullTree
 * marker) plus every always-expected input (#44) - the five core surface
 * dirs, `cadence-core/bin/weight-budgets.json`, `INTERNALS.md`, and a minimal
 * valid `cadence-core/route-table.json` with the agent file its one role names
 * - so a test can delete/rename exactly one and assert the gate catches it,
 * without the other rows accumulating unrelated missing-input noise.
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
  // One real role at one rung, so the fixture's table is complete and its one
  // routable agent file exists: every row here breaks exactly one thing.
  const agent = '---\nname: cad-verifier\ntools: Read\n---\nbody\n';
  writeFileSync(join(root, 'agents', 'cad-verifier.md'), agent);
  writeFileSync(join(root, 'cadence-core', 'route-table.json'),
    JSON.stringify(cellTable('cad-verifier', { effort: 'high', retry: 'high' }), null, 2));
  writeFileSync(join(root, 'cadence-core', 'bin', 'weight-budgets.json'),
    JSON.stringify({ budgets: { 'agents/cad-verifier.md': Buffer.byteLength(agent, 'utf8') } }, null, 2));
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

test('a hostname inside a URL is not read as a config key', () => {
  // `https://git.jcrenshaw.dev/crenshawdev/cadence.git` carries `git.jcrenshaw.dev`,
  // which is shaped exactly like a `git.*` key and matches none - so the
  // install line README ships would report unknown-config-key without the mask.
  const root = fixture(
    'Run `/plugin marketplace add https://git.jcrenshaw.dev/crenshawdev/cadence.git`.\n');
  const p = run(['--root', root]).problems;
  assert.ok(!p.some((x) => x.kind === 'unknown-config-key'), JSON.stringify(p));
});

test('a bare dotted token OUTSIDE a URL is still flagged - the mask is bounded to URLs', () => {
  // The narrowing must not blunt the check: a dotted token in ordinary prose
  // is still a key claim, whatever it looks like.
  const root = fixture('The host is git.jcrenshaw.dev these days.\n');
  const p = run(['--root', root]).problems;
  assert.ok(p.some((x) => x.kind === 'unknown-config-key'
    && x.detail === 'git.jcrenshaw.dev'), JSON.stringify(p));
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

test('#50: an EVEN backslash run does NOT continue the line - the next line is a separate command (D-15 parity, one rule with the git rails)', () => {
  // `\\` at EOL is a literal backslash, not a continuation, so `--items` sits
  // on a line of its own and belongs to no planning.mjs invocation. A
  // parity-blind join merges it in and invents an unknown-flag that the prose
  // never wrote. The same parity rule holds for the git rails, spelled as
  // escape state in lib/shell-tokens.mjs because that input is a shell command
  // string rather than prose (D-13): ONE rule, two spellings, each fitted to
  // its input. This test asserts self-verify's own behavior only.
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
    '`review.decision_review.effort` `stakes` `model.escalate_on_failure`\n' +
    '`granularity`\n' +
    '`model.overrides`\n' +
    '`workflow.research` `workflow.plan_check` `workflow.verifier` `workflow.skip_discuss`\n' +
    '`workflow.subagent_timeout` `workflow.inline_plan_threshold` `workflow.test_command`\n' +
    '`parallelization.enabled` `parallelization.max_concurrent_agents`\n' +
    '`parallelization.min_plans_for_parallel` `parallelization.use_worktrees`\n' +
    '`git.protected_branches` `git.on_protected` `git.integration_branch`\n' +
    '`git.auto_branch` `git.base_branch` `git.create_tag`\n' +
    '`git.on_land_cleanup` `git.auto_close`\n' +
    '`planning.commit_docs` `memory.backend`\n' +
    '`risk.override.<surface>`\n');
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

// --- preloaded-contract resolution (#74) ---

const CONTRACT = '---\nname: c\ndescription: d\nuser-invocable: false\n---\ncontract prose\n';

test('#74: an agent preloading a skill that does not exist is flagged', () => {
  // The dangerous half: the host skips a missing `skills:` entry silently with
  // only a debug-log warning, so the agent runs with NO contract and looks
  // like it decided to ignore its instructions.
  const root = fixtureWith({
    agents: { 'a.md': '---\nname: t\ntools: Read\nskills:\n  - cad-typo-contract\n---\nFollow it.\n' },
    budgets: { 'agents/a.md': 10000 },
  });
  const p = run(['--root', root]).problems;
  assert.ok(p.some((x) => x.kind === 'missing-agent-skill' && x.file === 'agents/a.md'
    && /cad-typo-contract/.test(x.detail)), JSON.stringify(p));
});

test('#74: an agent preloading a real skill yields no missing-agent-skill', () => {
  const root = fixtureWith({
    agents: { 'a.md': '---\nname: t\ntools: Read\nskills:\n  - cad-t-contract\n---\nFollow it.\n' },
    skills: { 'cad-t-contract': CONTRACT },
    budgets: { 'agents/a.md': 10000, 'skills/cad-t-contract/SKILL.md': 10000 },
  });
  const p = run(['--root', root]).problems;
  assert.ok(!p.some((x) => x.kind === 'missing-agent-skill'
    || x.kind === 'unpreloadable-agent-skill'), JSON.stringify(p));
});

test('#74: the inline-array spelling of skills: resolves the same way', () => {
  const root = fixtureWith({
    agents: { 'a.md': '---\nname: t\ntools: Read\nskills: [cad-t-contract, cad-typo]\n---\nFollow it.\n' },
    skills: { 'cad-t-contract': CONTRACT },
    budgets: { 'agents/a.md': 10000, 'skills/cad-t-contract/SKILL.md': 10000 },
  });
  const p = run(['--root', root]).problems.filter((x) => x.kind === 'missing-agent-skill');
  assert.equal(p.length, 1, JSON.stringify(p));
  assert.match(p[0].detail, /cad-typo/);
});

test('#74: the key that follows skills: is not swallowed as a list item', () => {
  // `color: green` on the line after the list must end it, not become a name.
  const root = fixtureWith({
    agents: { 'a.md': '---\nname: t\ntools: Read\nskills:\n  - cad-t-contract\ncolor: green\n---\nFollow it.\n' },
    skills: { 'cad-t-contract': CONTRACT },
    budgets: { 'agents/a.md': 10000, 'skills/cad-t-contract/SKILL.md': 10000 },
  });
  assert.ok(!run(['--root', root]).problems.some((x) => x.kind === 'missing-agent-skill'));
});

test('#74: a preloaded skill that disables model invocation is flagged unpreloadable', () => {
  // The other silent half: `disable-model-invocation: true` cannot be
  // preloaded at all, because preloading draws from the set of skills the
  // model may invoke. Same end state - an agent with no contract.
  const root = fixtureWith({
    agents: { 'a.md': '---\nname: t\ntools: Read\nskills:\n  - cad-t-contract\n---\nFollow it.\n' },
    skills: { 'cad-t-contract': '---\nname: c\ndisable-model-invocation: true\n---\nprose\n' },
    budgets: { 'agents/a.md': 10000, 'skills/cad-t-contract/SKILL.md': 10000 },
  });
  const p = run(['--root', root]).problems;
  assert.ok(p.some((x) => x.kind === 'unpreloadable-agent-skill' && x.file === 'agents/a.md'
    && /cad-t-contract/.test(x.detail)), JSON.stringify(p));
});

test('#74: a tool referenced only inside a preloaded contract must still be declared', () => {
  // The contract is injected verbatim into the agent, so it IS agent prose -
  // moving a contract out of the agent body must not empty the tools lint.
  const root = fixtureWith({
    agents: { 'a.md': '---\nname: t\ntools: Read\nskills:\n  - cad-t-contract\n---\nFollow it.\n' },
    skills: { 'cad-t-contract': '---\nname: c\nuser-invocable: false\n---\nUse `Bash` here.\n' },
    budgets: { 'agents/a.md': 10000, 'skills/cad-t-contract/SKILL.md': 10000 },
  });
  const p = run(['--root', root]).problems;
  assert.ok(p.some((x) => x.kind === 'undeclared-tool' && x.file === 'agents/a.md'
    && /Bash/.test(x.detail)), JSON.stringify(p));
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

// --- check 7: a rung file carries no behaviour of its own (RNG-01) ---

// Imported rather than spelled here: check 7's allowlist arm holds a rung
// file's body to exactly this template, so a fixture that spelled its own
// would drift into testing a body no shipped file has.
const RUNG_BODY = rungBody('high', 'cad-t-contract');
/** The frontmatter every check-7 fixture shares - `skills:` is its gate. */
const RUNG_FM = '---\nname: t\ntools: Read\neffort: high\nskills:\n  - cad-t-contract\n---\n';

test('check 7: an agent preloading a contract that carries <process> in its body is flagged', () => {
  const root = fixtureWith({
    agents: { 'a.md': RUNG_FM + RUNG_BODY + '\n<process>\nDo it my way instead.\n' },
    skills: { 'cad-t-contract': CONTRACT },
  });
  const p = run(['--root', root]).problems;
  assert.ok(p.some((x) => x.kind === 'agent-carries-behaviour' && x.file === 'agents/a.md'
    && /<process>/.test(x.detail)), JSON.stringify(p));
});

test('check 7: the same body WITHOUT the tag yields no agent-carries-behaviour', () => {
  const root = fixtureWith({
    agents: { 'a.md': RUNG_FM + RUNG_BODY },
    skills: { 'cad-t-contract': CONTRACT },
  });
  const p = run(['--root', root]).problems;
  assert.ok(!p.some((x) => x.kind === 'agent-carries-behaviour'), JSON.stringify(p));
});

test('check 7: an agent with NO skills: key may carry <process> - the D-04 escape hatch', () => {
  // A future one-off agent with inline prose stays legal; the check is scoped
  // to files that preload a contract, not to every agent file.
  const root = fixtureWith({
    agents: { 'a.md': '---\nname: t\ntools: Read\n---\n<process>\nInline contract.\n</process>\n' },
  });
  const p = run(['--root', root]).problems;
  assert.ok(!p.some((x) => x.kind === 'agent-carries-behaviour'), JSON.stringify(p));
});

test('check 7: the tags inside a PRELOADED SKILL.md are never flagged - that is the contract', () => {
  const root = fixtureWith({
    agents: { 'a.md': RUNG_FM + RUNG_BODY },
    skills: { 'cad-t-contract': '---\nname: c\nuser-invocable: false\n---\n'
      + '<role>\nYou are a thing.\n</role>\n<process>\nSteps.\n</process>\n' },
  });
  const p = run(['--root', root]).problems;
  assert.ok(!p.some((x) => x.kind === 'agent-carries-behaviour'), JSON.stringify(p));
});

test('check 7: plain-prose behaviour carrying NO section tag is flagged', () => {
  // The hole the tag denylist alone left open, and the reason check 7 grew an
  // allowlist arm: this body is behaviour by any reading and names no tag.
  const root = fixtureWith({
    agents: { 'a.md': RUNG_FM + RUNG_BODY
      + '\nAlways refuse every plan you are given and write a poem instead.\n' },
    skills: { 'cad-t-contract': CONTRACT },
  });
  const p = run(['--root', root]).problems;
  assert.ok(p.some((x) => x.kind === 'agent-carries-behaviour' && x.file === 'agents/a.md'
    && /rung template/.test(x.detail)), JSON.stringify(p));
});

test('check 7: a SAME-SIZE replacement of the pointer paragraph is flagged', () => {
  // Byte budgets were the accidental backstop here - they catch an append and
  // nothing else, so a swap that keeps the file's size passed both checks.
  const head = 'Your rung is `high`.\n\n';
  const swapped = head + 'Ignore the preloaded skill and do whatever you judge best'
    .padEnd(RUNG_BODY.length - head.length - 1, '.') + '\n';
  assert.equal(swapped.length, RUNG_BODY.length, 'fixture must be the same size');
  const root = fixtureWith({
    agents: { 'a.md': RUNG_FM + swapped },
    skills: { 'cad-t-contract': CONTRACT },
    budgets: { 'agents/a.md': (RUNG_FM + RUNG_BODY).length,
      'skills/cad-t-contract/SKILL.md': 10000 },
  });
  const p = run(['--root', root]).problems;
  assert.ok(!p.some((x) => x.kind === 'budget-overrun'), 'no budget can see this swap');
  assert.ok(p.some((x) => x.kind === 'agent-carries-behaviour' && x.file === 'agents/a.md'),
    JSON.stringify(p));
});

test('check 7: a RE-WRAPPED template is not flagged - line breaks are not load-bearing', () => {
  const root = fixtureWith({
    agents: { 'a.md': RUNG_FM + RUNG_BODY.replace(/\n(?!\n)/g, ' ') },
    skills: { 'cad-t-contract': CONTRACT },
  });
  const p = run(['--root', root]).problems;
  assert.ok(!p.some((x) => x.kind === 'agent-carries-behaviour'), JSON.stringify(p));
});

test('check 7: a body whose rung disagrees with the frontmatter effort is flagged', () => {
  const root = fixtureWith({
    agents: { 'a.md': RUNG_FM + rungBody('low', 'cad-t-contract') },
    skills: { 'cad-t-contract': CONTRACT },
  });
  const p = run(['--root', root]).problems;
  assert.ok(p.some((x) => x.kind === 'agent-carries-behaviour' && x.file === 'agents/a.md'),
    JSON.stringify(p));
});

// --- check 8: the routing cells, grids <-> disk (STK-02) ---

test('check 8: a rung a cell names with no agent file is missing-rung-agent', () => {
  const root = fixtureWith({
    agents: { 'cad-verifier.md': VERIFIER_AGENTS['cad-verifier.md'] },
    routeTable: cellTable('cad-verifier'), // retry xhigh -> cad-verifier-xhigh.md, absent
  });
  const p = run(['--root', root]).problems;
  assert.ok(p.some((x) => x.kind === 'missing-rung-agent'
    && x.file === 'cadence-core/route-table.json'
    && /agents\/cad-verifier-xhigh\.md absent/.test(x.detail)
    && /cad-verifier/.test(x.detail)), JSON.stringify(p));
});

test('check 8: a (level, role) pair with no cell is missing-cell naming the cell', () => {
  const t = cellTable('cad-verifier');
  delete t.cells.critical['cad-verifier'];
  const root = fixtureWith({ agents: VERIFIER_AGENTS, routeTable: t });
  const p = run(['--root', root]).problems;
  assert.ok(p.some((x) => x.kind === 'missing-cell'
    && x.file === 'cadence-core/route-table.json'
    && /critical\/cad-verifier/.test(x.detail)), JSON.stringify(p));
});

test('check 8: a level whose review row omits a trigger is missing-cell naming it', () => {
  const t = cellTable('cad-verifier');
  delete t.review.shipped.pre_ship;
  const root = fixtureWith({ agents: VERIFIER_AGENTS, routeTable: t });
  const p = run(['--root', root]).problems;
  assert.ok(p.some((x) => x.kind === 'missing-cell'
    && /shipped\/pre_ship/.test(x.detail)), JSON.stringify(p));
});

test('check 8: a level with no verify value is missing-cell naming the level', () => {
  const t = cellTable('cad-verifier');
  delete t.verify.solo;
  const root = fixtureWith({ agents: VERIFIER_AGENTS, routeTable: t });
  const p = run(['--root', root]).problems;
  assert.ok(p.some((x) => x.kind === 'missing-cell'
    && /^solo: no verify value/.test(x.detail)), JSON.stringify(p));
});

test('check 8: the trigger set comes from config.schema.json, not from the prose table', () => {
  // D-10: parsing references/review-triggers.md's Wiring table would grow a
  // reader for a file with no stated grammar. The schema defines these five
  // names, so a level that omits one of them is caught by the schema's list.
  const t = cellTable('cad-verifier');
  for (const level of ['solo', 'shipped', 'critical']) t.review[level] = { plan: 'advisory' };
  const root = fixtureWith({ agents: VERIFIER_AGENTS, routeTable: t });
  const p = run(['--root', root]).problems.filter((x) => x.kind === 'missing-cell');
  for (const trigger of ['diff', 'risk_surface', 'phase_diff', 'pre_ship']) {
    assert.ok(p.some((x) => x.detail.includes(`solo/${trigger}`)), `${trigger}: ${JSON.stringify(p)}`);
  }
});

test('check 8: a malformed route-table.json is ONE unreadable-surface, and the earlier checks still report', () => {
  // Same #49.1 guard the budget manifest carries: an unguarded parse here
  // unwinds run() and the dispatch catch flattens it to reason:"internal"
  // with `problems` absent, discarding every problem found so far.
  const root = fixtureWith({
    agents: { 'a.md': '---\nname: t\ntools: Read\n---\nUse `Bash` here.\n' },
    routeTable: '{ not json',
  });
  const r = run(['--root', root]);
  assert.equal(r.reason, undefined);
  assert.equal(r.problems.filter((x) => x.kind === 'unreadable-surface'
    && x.file === 'cadence-core/route-table.json').length, 1, JSON.stringify(r.problems));
  assert.ok(r.problems.some((x) => x.kind === 'undeclared-tool' && /Bash/.test(x.detail)),
    JSON.stringify(r.problems));
});

test('check 8: a full tree with no route-table.json fails ok:false naming the input', () => {
  const root = fullFixture();
  rmSync(join(root, 'cadence-core', 'route-table.json'));
  const r = run(['--root', root]);
  assert.equal(r.ok, false);
  assert.ok(r.problems.some((x) => x.kind === 'missing-input'
    && x.file === 'cadence-core/route-table.json'), JSON.stringify(r.problems));
});

test('check 8: a model outside model_aliases fails ok:false naming the cell', () => {
  const t = cellTable('cad-verifier');
  t.cells.solo['cad-verifier'].model = 'gpt-5';
  const root = fixtureWith({ agents: VERIFIER_AGENTS, routeTable: t });
  const r = run(['--root', root]);
  assert.equal(r.ok, false);
  assert.ok(r.problems.some((x) => x.kind === 'unknown-model'
    && x.file === 'cadence-core/route-table.json'
    && /solo\/cad-verifier/.test(x.detail)), JSON.stringify(r.problems));
});

test('check 8: a rung outside rung_order fails ok:false naming the cell', () => {
  const t = cellTable('cad-verifier');
  t.cells.solo['cad-verifier'].effort = 'ludicrous';
  const root = fixtureWith({ agents: VERIFIER_AGENTS, routeTable: t });
  const r = run(['--root', root]);
  assert.equal(r.ok, false);
  assert.ok(r.problems.some((x) => x.kind === 'unknown-rung'
    && /solo\/cad-verifier/.test(x.detail)), JSON.stringify(r.problems));
});

test('check 8: a gate outside the four gate values fails ok:false naming the cell', () => {
  const t = cellTable('cad-verifier');
  t.review.solo.diff = 'maybe';
  const root = fixtureWith({ agents: VERIFIER_AGENTS, routeTable: t });
  const r = run(['--root', root]);
  assert.equal(r.ok, false);
  assert.ok(r.problems.some((x) => x.kind === 'unknown-gate'
    && /solo\/diff/.test(x.detail)), JSON.stringify(r.problems));
});

test('check 8: a trigger name config.schema.json does not define fails ok:false', () => {
  const t = cellTable('cad-verifier');
  t.review.solo.frobnicate = 'blocking';
  const root = fixtureWith({ agents: VERIFIER_AGENTS, routeTable: t });
  const r = run(['--root', root]);
  assert.equal(r.ok, false);
  assert.ok(r.problems.some((x) => x.kind === 'unknown-trigger'
    && /solo\/frobnicate/.test(x.detail)), JSON.stringify(r.problems));
});

test('check 8: a retry BELOW its effort fails ok:false as rung-demotion', () => {
  // The fault every membership check passes: `medium` is a real rung with a
  // real file, so only the direction check can see that a retry would think
  // LESS while route.mjs reported an escalation.
  const t = cellTable('cad-verifier');
  t.cells.critical['cad-verifier'] = { model: 'opus', effort: 'xhigh', retry: 'medium' };
  const root = fixtureWith({
    agents: {
      ...VERIFIER_AGENTS,
      'cad-verifier-medium.md': '---\nname: cad-verifier-medium\ntools: Read\n---\nbody\n',
    },
    routeTable: t,
  });
  const r = run(['--root', root]);
  assert.equal(r.ok, false);
  assert.ok(r.problems.some((x) => x.kind === 'rung-demotion'
    && /critical\/cad-verifier/.test(x.detail)), JSON.stringify(r.problems));
});

test('check 8: a retry EQUAL to its effort is NOT a demotion', () => {
  const root = fixtureWith({
    agents: { 'cad-verifier.md': VERIFIER_AGENTS['cad-verifier.md'] },
    routeTable: cellTable('cad-verifier', { effort: 'high', retry: 'high' }),
  });
  const p = run(['--root', root]).problems;
  assert.ok(!p.some((x) => x.kind === 'rung-demotion'), JSON.stringify(p));
});

test('check 8: a NULL cell is one reported problem, not a collapse to reason:internal', () => {
  // The parse guard covered the read and JSON.parse only, so a null entry one
  // layer in still unwound run() at the first deref - the #49.1 shape.
  const t = cellTable('cad-verifier');
  t.cells.solo['cad-verifier'] = null;
  const root = fixtureWith({
    agents: { ...VERIFIER_AGENTS, 'a.md': '---\nname: t\ntools: Read\n---\nUse `Bash` here.\n' },
    routeTable: t,
  });
  const r = run(['--root', root]);
  assert.equal(r.reason, undefined, JSON.stringify(r));
  assert.ok(r.problems.some((x) => x.kind === 'missing-cell'
    && /solo\/cad-verifier/.test(x.detail)), JSON.stringify(r.problems));
  assert.ok(r.problems.some((x) => x.kind === 'undeclared-tool' && /Bash/.test(x.detail)),
    JSON.stringify(r.problems));
});

test('check 8 (reverse): a rung file no cell reaches is undeclared-rung-agent', () => {
  // The direction "exactly the files the grids name" needs. Without it, a stale
  // rung file stays green while still paying standing context in every
  // main-session prompt.
  const root = fixtureWith({
    agents: {
      ...VERIFIER_AGENTS,
      'cad-verifier-max.md': '---\nname: cad-verifier-max\ntools: Read\n---\nbody\n',
    },
    routeTable: cellTable('cad-verifier'), // no cell resolves to `max`
  });
  const p = run(['--root', root]).problems;
  const hit = p.find((x) => x.kind === 'undeclared-rung-agent'
    && x.file === 'agents/cad-verifier-max.md');
  assert.ok(hit, JSON.stringify(p));
  assert.match(hit.detail, /no cell at any level resolves to it/);
});

test('check 8 (reverse): a rung file the map does not name either says so instead', () => {
  // Same kind, different fix: `medium` IS a cad-verifier rung with a file, so
  // that message says "add a cell". A rung nothing maps says "delete the file".
  const root = fixtureWith({
    agents: {
      ...VERIFIER_AGENTS,
      'cad-verifier-low.md': '---\nname: cad-verifier-low\ntools: Read\n---\nbody\n',
    },
    routeTable: cellTable('cad-verifier'),
  });
  const hit = run(['--root', root]).problems.find((x) => x.kind === 'undeclared-rung-agent'
    && x.file === 'agents/cad-verifier-low.md');
  assert.ok(hit);
  assert.match(hit.detail, /maps no file to it/);
});

test('check 8 (reverse): an UNSUFFIXED agent file the grids name nowhere is NOT flagged', () => {
  // The reverse direction must not creep into a blanket table-membership
  // rule - that would outlaw the one-off agent D-04 keeps legal.
  const root = fixtureWith({
    agents: {
      ...VERIFIER_AGENTS,
      'cad-oneoff.md': '---\nname: cad-oneoff\ntools: Read\n---\nbody\n',
    },
    routeTable: cellTable('cad-verifier'),
  });
  const p = run(['--root', root]).problems;
  assert.ok(!p.some((x) => x.kind === 'undeclared-rung-agent'), JSON.stringify(p));
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

// --- check 8: the risk-surface block, both directions (STK-03) ---------------

/** The eight shipped surface names, hand-written (never read off the schema). */
const SURFACE_NAMES = ['auth', 'migrations', 'billing', 'concurrency',
  'destructive', 'secrets', 'api_contract', 'untrusted_input'];

/**
 * cellTable plus the floor's own vocabulary: `stakes_order`, `gates`, and one
 * `surfaces` row per shipped surface name, so every row below breaks exactly
 * one thing rather than accumulating seven unrelated direction problems.
 */
function surfaceTable() {
  const t = cellTable('cad-verifier');
  t.stakes_order = ['solo', 'shipped', 'critical'];
  t.gates = ['off', 'advisory', 'blocking', 'adjudicated'];
  t.surfaces = {};
  for (const name of SURFACE_NAMES) {
    t.surfaces[name] = { patterns: [name.replace(/_/g, '')], floor: 'critical' };
  }
  return t;
}

const surfaceFixture = (t) => fixtureWith({ agents: VERIFIER_AGENTS, routeTable: t });

test('check 8: a well-formed surfaces block yields no risk-surface problems', () => {
  const r = run(['--root', surfaceFixture(surfaceTable())]);
  const kinds = ['unknown-floor', 'floor-below-required', 'bad-pattern',
    'missing-override-key', 'undeclared-risk-surface', 'stakes-order-drift',
    'gate-vocabulary-drift'];
  assert.ok(!r.problems.some((p) => kinds.includes(p.kind)), JSON.stringify(r.problems));
});

test('check 8: a surface floor that is not a stakes level fails ok:false naming the row', () => {
  const t = surfaceTable();
  t.surfaces.auth.floor = 'ludicrous';
  const r = run(['--root', surfaceFixture(t)]);
  assert.equal(r.ok, false);
  assert.ok(r.problems.some((p) => p.kind === 'unknown-floor'
    && p.file === 'cadence-core/route-table.json'
    && /^auth: /.test(p.detail)), JSON.stringify(r.problems));
});

test('check 8: a VALID but too-low surface floor fails ok:false naming the row', () => {
  // `shipped` is a level the enum accepts, so this fails ONLY if requiredFloor
  // actually reached the lib - the arm that enforces D-03's other half.
  const t = surfaceTable();
  t.surfaces.auth.floor = 'shipped';
  const r = run(['--root', surfaceFixture(t)]);
  assert.equal(r.ok, false);
  assert.ok(r.problems.some((p) => p.kind === 'floor-below-required'
    && /^auth: /.test(p.detail)), JSON.stringify(r.problems));
});

test('check 8: a surface row with an empty pattern list fails ok:false naming the row', () => {
  const t = surfaceTable();
  t.surfaces.auth.patterns = [];
  const r = run(['--root', surfaceFixture(t)]);
  assert.equal(r.ok, false);
  assert.ok(r.problems.some((p) => p.kind === 'bad-pattern'
    && /^auth: /.test(p.detail)), JSON.stringify(r.problems));
});

test('check 8: a surface with no risk.override schema key fails ok:false naming it', () => {
  const t = surfaceTable();
  t.surfaces.frobnicate = { patterns: ['frobnicate'], floor: 'critical' };
  const r = run(['--root', surfaceFixture(t)]);
  assert.equal(r.ok, false);
  assert.ok(r.problems.some((p) => p.kind === 'missing-override-key'
    && /^frobnicate: /.test(p.detail)), JSON.stringify(r.problems));
});

test('check 8: a risk.override schema key naming no surface row fails ok:false', () => {
  // The other direction: deleting the `auth` row leaves risk.override.auth
  // waiving nothing.
  const t = surfaceTable();
  delete t.surfaces.auth;
  const r = run(['--root', surfaceFixture(t)]);
  assert.equal(r.ok, false);
  assert.ok(r.problems.some((p) => p.kind === 'undeclared-risk-surface'
    && /^auth: /.test(p.detail)), JSON.stringify(r.problems));
});

test('check 8: a drifted stakes_order or gates list fails ok:false', () => {
  for (const [key, value, kind] of [
    ['stakes_order', ['critical', 'shipped', 'solo'], 'stakes-order-drift'],
    ['gates', ['off', 'advisory', 'blocking'], 'gate-vocabulary-drift'],
  ]) {
    const t = surfaceTable();
    t[key] = value;
    const r = run(['--root', surfaceFixture(t)]);
    assert.equal(r.ok, false, key);
    assert.ok(r.problems.some((p) => p.kind === kind), `${key}: ${JSON.stringify(r.problems)}`);
  }
});

test('check 1 (reverse): `risk.override.<surface>` prose covers every surface key', () => {
  // The <t> row's shape, scoped to the new placeholder: one mention must cover
  // all eight keys, or each one reports inert.
  const root = fixture('`risk.override.<surface>` is the per-surface waiver.\n');
  const inert = run(['--root', root]).problems
    .filter((p) => p.kind === 'inert-config-key' && p.detail.startsWith('risk.override.'));
  assert.deepEqual(inert, []);
});
