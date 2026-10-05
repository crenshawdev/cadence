// Zero-dep tests for `planning.mjs detect-commands`. Run:
// node --test 'cadence-core/bin/*.test.mjs'
//
// Split out of planning.test.mjs in phase 4, verbatim: the arms, their fixture
// builders and their comments are unchanged, only their home is. The shared
// harness stays in planning.test.mjs and is imported, never copied - two copies
// of `makeTree` is how two fixtures drift apart.
//
// The `test` binding below is a no-op unless this module IS the entry file, so
// a sibling that imports a fixture from here registers nothing twice.
import { test as nodeTest } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PLANNING, run } from './planning.test.mjs';

/** True iff this module is what node was told to run; realpath on both sides so
 * a symlinked checkout still matches (config-seams.test.mjs D-19). */
function isEntryFile() {
  const argv1 = process.argv[1];
  if (typeof argv1 !== 'string' || argv1 === '') return false;
  try {
    return pathToFileURL(realpathSync(argv1)).href === pathToFileURL(realpathSync(fileURLToPath(import.meta.url))).href;
  } catch { return false; }
}

/** `node:test`'s `test` when run directly, a no-op when imported (see header). */
const test = isEntryFile() ? nodeTest : () => {};

// --- detect-commands: the unconfigured static-analysis path (QW-01) ----------

/** A project root holding exactly the named files, one directory deep. */
function projectTree(files) {
  const root = mkdtempSync(join(tmpdir(), 'cad-detect-'));
  for (const [name, body] of Object.entries(files)) {
    writeFileSync(join(root, name), typeof body === 'string' ? body : JSON.stringify(body));
  }
  return root;
}

/** Executable stubs at `<root>/node_modules/.bin`, where a project installs
 *  eslint and tsc. Bytes in the fixture's own tree, so the local arm is pinned
 *  without any machine's install. */
function nodeModulesBin(root, tools) {
  const dir = join(root, 'node_modules', '.bin');
  mkdirSync(dir, { recursive: true });
  for (const t of tools) writeFileSync(join(dir, t), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
  return root;
}

/** A directory of executable stubs to prepend to the child's PATH, the way
 *  issue-check.test.mjs injects forge CLIs: the PATH arm is proven by the
 *  production resolver against bytes the fixture wrote. */
function pathStubs(tools) {
  const dir = mkdtempSync(join(tmpdir(), 'cad-detect-path-'));
  for (const t of tools) writeFileSync(join(dir, t), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
  return dir;
}

/**
 * Every tool this block's fixtures name. Passed as the reachable set by
 * default, so a row asserting WHICH command an arm produces is not also an
 * assertion about what is installed on the machine running the suite (RCH-01,
 * D-11): with the reachability rule live and no override, the `ruff`, `mypy`
 * and two `go` rows fail on a dev box without those tools, and the eslint
 * and tsc rows fail on any box without them on PATH. A name in the set reads
 * as on PATH, so every row under it answers with the bare name. A row that is
 * ABOUT reachability passes its own narrower set.
 */
const EVERY_TOOL = 'npm,cargo,ruff,mypy,go,eslint,tsc';

/**
 * detect-commands takes --root (the PROJECT root), never --dir.
 *
 * `reachable` is the set the seam reads in place of its own probe, behind the
 * `CADENCE_TEST_SEAM` sentinel; `null` runs the real probe, and `seam: false`
 * sets the variable with NO sentinel, which must be ignored. A row that needs
 * the LIVE probe stays hermetic by putting its binaries in the fixture's own
 * `node_modules/.bin` (see nodeModulesBin), or in a `pathDir` prepended to
 * the child's PATH (see pathStubs), rather than relying on the machine.
 */
function detect(root, { extra = [], reachable = EVERY_TOOL, seam = true, pathDir = null } = {}) {
  const env = { ...process.env };
  delete env.CADENCE_TEST_SEAM;
  delete env.CADENCE_DETECT_REACHABLE;
  if (seam) env.CADENCE_TEST_SEAM = '1';
  if (reachable !== null) env.CADENCE_DETECT_REACHABLE = reachable;
  if (pathDir !== null) env.PATH = pathDir + delimiter + (env.PATH || '');
  try {
    return JSON.parse(execFileSync('node', [PLANNING, 'detect-commands', '--root', root, ...extra],
      { encoding: 'utf8', env }));
  } catch (e) {
    return JSON.parse(e.stdout);
  }
}

test('detect-commands: a package.json lint script is the command', () => {
  const r = detect(projectTree({ 'package.json': { scripts: { lint: 'eslint .' } } }));
  assert.equal(r.ok, true);
  assert.equal(r.lint, 'npm run lint');
  assert.equal(r.typecheck, null);
  assert.equal(r.source.lint, 'package.json');
  assert.equal(r.source.typecheck, null);
});

test('detect-commands: both package.json typecheck spellings', () => {
  assert.equal(detect(projectTree({ 'package.json': { scripts: { typecheck: 'tsc' } } })).typecheck,
    'npm run typecheck');
  assert.equal(detect(projectTree({ 'package.json': { scripts: { 'type-check': 'tsc' } } })).typecheck,
    'npm run type-check');
});

test('detect-commands: Cargo.toml answers both slots', () => {
  const r = detect(projectTree({ 'Cargo.toml': '[package]\nname = "x"\n' }));
  assert.equal(r.lint, 'cargo clippy --all-targets -- -D warnings');
  assert.equal(r.typecheck, 'cargo check --all-targets');
  assert.equal(r.source.lint, 'Cargo.toml');
});

test('detect-commands: pyproject.toml answers per TABLE, not per file', () => {
  const ruff = detect(projectTree({ 'pyproject.toml': '[tool.ruff]\nline-length = 100\n' }));
  assert.equal(ruff.lint, 'ruff check .');
  assert.equal(ruff.typecheck, null);          // no [tool.mypy table
  const mypy = detect(projectTree({ 'pyproject.toml': '[tool.mypy]\nstrict = true\n' }));
  assert.equal(mypy.lint, null);
  assert.equal(mypy.typecheck, 'mypy .');
  // A pyproject with neither table names neither command.
  const bare = detect(projectTree({ 'pyproject.toml': '[project]\nname = "x"\n' }));
  assert.equal(bare.lint, null);
  assert.equal(bare.typecheck, null);
});

test('detect-commands: go.mod answers both slots', () => {
  const r = detect(projectTree({ 'go.mod': 'module example.com/x\n' }));
  assert.equal(r.lint, 'go vet ./...');
  assert.equal(r.typecheck, 'go build ./...');
});

test('detect-commands: an eslint config, flat or legacy, is the last lint arm', () => {
  assert.equal(detect(projectTree({ 'eslint.config.mjs': 'export default [];\n' })).lint,
    'eslint .');
  const legacy = detect(projectTree({ '.eslintrc.json': '{}' }));
  assert.equal(legacy.lint, 'eslint .');
  assert.equal(legacy.source.lint, '.eslintrc.json');
});

test('detect-commands: the project\'s own script beats a tool config in the same tree', () => {
  const r = detect(projectTree({
    'package.json': { scripts: { lint: 'biome check .', typecheck: 'tsc -p .' } },
    'eslint.config.js': 'module.exports = [];\n',
    'tsconfig.json': '{}',
  }));
  assert.equal(r.lint, 'npm run lint');
  assert.equal(r.typecheck, 'npm run typecheck');
  assert.equal(r.source.lint, 'package.json');
  assert.equal(r.source.typecheck, 'package.json');
});

test('detect-commands: two EXACT tsconfig names, each with the form that points at it', () => {
  const plain = detect(projectTree({ 'tsconfig.json': '{}' }));
  assert.equal(plain.typecheck, 'tsc --noEmit');
  assert.equal(plain.source.typecheck, 'tsconfig.json');

  // `tsc --noEmit` ignores a config it is not pointed at, so the CI name
  // brings the `-p` form that does point at it - a fixed literal, never a
  // command built out of the matched file name.
  const ci = detect(projectTree({ 'tsconfig.ci.json': '{}' }));
  assert.equal(ci.typecheck, 'tsc -p tsconfig.ci.json');
  assert.equal(ci.source.typecheck, 'tsconfig.ci.json');
});

test('detect-commands: a tree carrying BOTH tsconfigs answers with the project\'s own', () => {
  // Order, not coincidence: `tsconfig.json` is the project's own typecheck and
  // the CI file is the narrower one, so the second arm must never shadow the
  // first.
  const both = detect(projectTree({ 'tsconfig.json': '{}', 'tsconfig.ci.json': '{}' }));
  assert.equal(both.typecheck, 'tsc --noEmit');
  assert.equal(both.source.typecheck, 'tsconfig.json');
});

test('detect-commands: a NEAR-miss tsconfig name still matches nothing', () => {
  // The glob this pair still refuses. `tsconfig.build.json` is an ordinary
  // third spelling and names no command, which is what keeps "two exact names"
  // a rule rather than a description of today's tree.
  const other = detect(projectTree({ 'tsconfig.build.json': '{}' }));
  assert.equal(other.typecheck, null);
  assert.equal(other.source.typecheck, null);
});

test('detect-commands: nothing detected is ok:true with both null', () => {
  const r = detect(projectTree({ 'README.md': '# x\n' }));
  assert.equal(r.ok, true);
  assert.equal(r.lint, null);
  assert.equal(r.typecheck, null);
  assert.deepEqual(r.source, { lint: null, typecheck: null });
  assert.equal('warnings' in r, false);
});

test('detect-commands: a malformed package.json warns and contributes nothing', () => {
  const r = detect(projectTree({ 'package.json': '{ "scripts": ' }));
  assert.equal(r.ok, true);
  assert.equal(r.lint, null);
  assert.equal(r.typecheck, null);
  assert.equal(r.warnings.length, 1, JSON.stringify(r.warnings));
  assert.match(r.warnings[0], /package\.json failed to parse/);
});

test('detect-commands: a malformed package.json does not block a later arm', () => {
  const r = detect(projectTree({ 'package.json': 'not json', 'go.mod': 'module x\n' }));
  assert.equal(r.lint, 'go vet ./...');
  assert.equal(r.warnings.length, 1);
});

test('detect-commands: a scripts block that is not an object is not read as one', () => {
  const r = detect(projectTree({ 'package.json': { scripts: ['lint'] } }));
  assert.equal(r.lint, null);
  assert.equal(r.typecheck, null);
});

test('detect-commands: the root is read one directory deep, never recursively', () => {
  const root = projectTree({ 'README.md': '# x\n' });
  mkdirSync(join(root, 'sub'));
  writeFileSync(join(root, 'sub', 'package.json'), JSON.stringify({ scripts: { lint: 'x' } }));
  const r = detect(root);
  assert.equal(r.lint, null);
});

test('detect-commands: an unlistable root is ok:false, never a silent nothing', () => {
  const r = detect(join(tmpdir(), 'cad-detect-does-not-exist'));
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'no-root');
});

// --- detect-commands: a command is named only when it can be RUN (RCH-01) ----

test('detect-commands: an unreachable winning arm nulls its slot and never falls through', () => {
  // The measured shape D-05 refuses: `[tool.ruff]` names the lint arm, `go.mod`
  // sits below it, and ruff is absent. Falling through would tell this project
  // to run `go vet ./...` - a linter its maintainers did not choose, over a
  // language the change may not touch.
  const r = detect(projectTree({
    'pyproject.toml': '[tool.ruff]\nline-length = 100\n',
    'go.mod': 'module example.com/x\n',
  }), { reachable: 'go' });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.lint, null);
  assert.equal(r.source.lint, null, 'a nulled slot claims no provenance');
  assert.notEqual(r.lint, 'go vet ./...');
  assert.equal(r.warnings.filter((w) => w.includes('ruff')).length, 1, JSON.stringify(r.warnings));
  assert.match(r.warnings.find((w) => w.includes('ruff')), /pyproject\.toml/);
  // The lower arm is still available to its OWN slot: `go` is reachable here,
  // so the typecheck answer is unaffected. Nulling is per slot, not per tree.
  assert.equal(r.typecheck, 'go build ./...');
  assert.equal(r.source.typecheck, 'go.mod');
});

test('detect-commands: no arm emits npx (audit W12)', () => {
  // `npx <tool>` with no local install fetches the package from the registry,
  // and this answer is run before every commit. Every arm, under the override
  // and under the live probe, names the tool itself.
  const tree = { 'eslint.config.js': 'module.exports = [];\n', 'tsconfig.json': '{}' };
  const viaOverride = detect(projectTree(tree));
  const live = detect(nodeModulesBin(projectTree(tree), ['eslint', 'tsc']), { reachable: null });
  for (const r of [viaOverride, live]) {
    assert.equal(JSON.stringify(r).includes('npx'), false, JSON.stringify(r));
  }
});

test('detect-commands: eslint and tsc in node_modules/.bin are named by that path', () => {
  // The LIVE probe, out of stubs the fixture wrote: the shape of a JS project
  // with its linter and compiler installed as dependencies and neither on PATH.
  // The path is relative, because every other arm already assumes the executor
  // runs from the project root and an absolute one would carry this machine
  // into the envelope.
  const root = nodeModulesBin(projectTree({
    'eslint.config.js': 'module.exports = [];\n',
    'tsconfig.json': '{}',
  }), ['eslint', 'tsc']);
  const r = detect(root, { reachable: null });
  assert.equal(r.lint, 'node_modules/.bin/eslint .', JSON.stringify(r));
  assert.equal(r.typecheck, 'node_modules/.bin/tsc --noEmit', JSON.stringify(r));
  assert.deepEqual(r.source, { lint: 'eslint.config.js', typecheck: 'tsconfig.json' });
  assert.equal('warnings' in r, false, JSON.stringify(r.warnings));

  // The CI-file arm keeps its own arguments behind the same path.
  const ci = detect(nodeModulesBin(projectTree({ 'tsconfig.ci.json': '{}' }), ['tsc']),
    { reachable: null });
  assert.equal(ci.typecheck, 'node_modules/.bin/tsc -p tsconfig.ci.json', JSON.stringify(ci));
  assert.equal(ci.source.typecheck, 'tsconfig.ci.json');
  // Only the POSITIVE half is asserted against the live probe, deliberately. A
  // fixture can guarantee a binary is PRESENT (it wrote it), and nothing on the
  // machine can take it away; it cannot guarantee one is ABSENT. The
  // unreachable half is pinned below, through the override, where the set is
  // stated rather than discovered.
});

test('detect-commands: a tool only on PATH is named bare', () => {
  // No node_modules at all, and a tsc stub on the child's PATH: the production
  // resolver answers from bytes the fixture wrote.
  const r = detect(projectTree({ 'tsconfig.json': '{}' }),
    { reachable: null, pathDir: pathStubs(['tsc']) });
  assert.equal(r.typecheck, 'tsc --noEmit', JSON.stringify(r));
  assert.equal(r.source.typecheck, 'tsconfig.json');
});

test('detect-commands: a tool in both places is named by its node_modules/.bin path', () => {
  // The project's pinned copy is the one its CI runs, so it beats whatever
  // version sits on PATH.
  const root = nodeModulesBin(projectTree({ 'tsconfig.json': '{}' }), ['tsc']);
  const r = detect(root, { reachable: null, pathDir: pathStubs(['tsc']) });
  assert.equal(r.typecheck, 'node_modules/.bin/tsc --noEmit', JSON.stringify(r));
});

test('detect-commands: a tool in neither place nulls its slot and names the tool', () => {
  const tree = { 'eslint.config.mjs': 'export default [];\n', 'tsconfig.json': '{}' };
  const r = detect(projectTree(tree), { reachable: 'npm' });
  assert.equal(r.lint, null);
  assert.equal(r.typecheck, null);
  assert.deepEqual(r.source, { lint: null, typecheck: null });
  assert.equal(r.warnings.filter((w) => w.startsWith('lint: eslint ')).length, 1,
    JSON.stringify(r.warnings));
  assert.equal(r.warnings.filter((w) => w.startsWith('typecheck: tsc ')).length, 1,
    JSON.stringify(r.warnings));
});

test('detect-commands: only eslint and tsc are taken from node_modules/.bin', () => {
  // A cloned repo can commit its own node_modules. A `node_modules/.bin/cargo`
  // must not stand in for the user's cargo: the answer is the PATH one, or
  // null, and never the fixture's path.
  const root = nodeModulesBin(projectTree({ 'Cargo.toml': '[package]\nname = "x"\n' }), ['cargo']);
  const r = detect(root, { reachable: null });
  for (const slot of [r.lint, r.typecheck]) {
    assert.equal(String(slot).startsWith('node_modules/'), false, JSON.stringify(r));
  }
});

test('detect-commands: an EMPTY reachable set means nothing is reachable', () => {
  // The `||` hazard, pinned: an empty override is falsy, so a seam that read it
  // through `|| probe` would silently run the live probe and answer about the
  // machine. The fixture's own node_modules/.bin would otherwise resolve tsc,
  // which is exactly what makes this row discriminating.
  const root = nodeModulesBin(projectTree({ 'tsconfig.ci.json': '{}' }), ['tsc']);
  const r = detect(root, { reachable: '' });
  assert.equal(r.typecheck, null, JSON.stringify(r));
  assert.equal(r.source.typecheck, null);
});

test('detect-commands: the reachable set WITHOUT the sentinel is ignored', () => {
  // The gate EXP-01 asks for: this variable decides which static-analysis
  // command an executor is told to run, so a repo-supplied .envrc setting it
  // must change nothing. Same fixture and same empty value as the row above,
  // which answered `null` there and answers the live probe here.
  const root = nodeModulesBin(projectTree({ 'tsconfig.ci.json': '{}' }), ['tsc']);
  const r = detect(root, { reachable: '', seam: false });
  assert.equal(r.typecheck, 'node_modules/.bin/tsc -p tsconfig.ci.json', JSON.stringify(r));
});

// --- a blank --root is refused by BOTH --root subcommands (COR-01) ----------
// `detect-surfaces` is tested here rather than beside its scanner for the same
// reason `trace ignore` is: this is the `--root` refusal, and the two rows sit
// two lines apart in the dispatch table. Measured before the fix: `--root ""`
// answered `ok:true` about the CWD from both commands - the silent substitution
// #42/#45 closed for the valueless spelling and missed for the empty one - and
// `--root "   "` answered `no-root`, a second vocabulary for one refusal. All
// three shapes now take `debt-harvest`'s predicate, trim clause included.

/** Any planning.mjs argv, parsed off stdout on either exit code. */
function runPlanning(...args) {
  try {
    return JSON.parse(execFileSync('node', [PLANNING, ...args], { encoding: 'utf8' }));
  } catch (e) { return JSON.parse(e.stdout); }
}

const BLANK_ROOTS = [
  { name: '--root with nothing after it', args: ['--root'] },
  { name: 'an empty --root ""', args: ['--root', ''] },
  { name: 'a whitespace-only --root', args: ['--root', '   '] },
];

for (const cmd of ['detect-commands', 'detect-surfaces']) {
  for (const row of BLANK_ROOTS) {
    test(`${cmd}: ${row.name} is bad-args, not answered about cwd`, () => {
      const r = runPlanning(cmd, ...row.args);
      assert.equal(r.ok, false, JSON.stringify(r));
      assert.equal(r.reason, 'bad-args', JSON.stringify(r));
    });
  }
}

test('detect-commands: a real --root still answers about THAT tree', () => {
  // Through `detect` rather than `runPlanning` - the argv is the same, and the
  // helper pins the reachable set so this row asserts WHICH tree was read
  // rather than whether the machine running the suite has npm (RCH-01, D-11).
  const root = projectTree({ 'package.json': { scripts: { lint: 'eslint .' } } });
  const r = detect(root);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.root, root);
  assert.equal(r.lint, 'npm run lint');
});

test('detect-surfaces: a real --root still answers about THAT tree', () => {
  const root = projectTree({ 'package.json': { dependencies: { stripe: '^1' } } });
  const r = runPlanning('detect-surfaces', '--root', root);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.root, root);
  assert.deepEqual(r.evidenced.map((e) => e.category), ['billing']);
});
