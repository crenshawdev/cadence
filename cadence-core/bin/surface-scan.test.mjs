// Grammar tests for lib/surface-scan.mjs and the `detect-surfaces` seam that
// feeds it. Run: node --test cadence-core/bin/surface-scan.test.mjs
//
// ONE test() per row, deliberately: a table asserted inside a single test()
// with a sequential loop reports the loop's count, not the rows'.
//
// The subject is one rule (D-14): the scan reports what the STRUCTURE
// evidences and what it cannot speak to, and never concludes a category is
// ABSENT. The rows below are mostly about the second half - what it declines
// to say - because that is the half a later "improvement" would take away.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanTree, CATEGORIES } from './lib/surface-scan.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PLANNING = join(HERE, 'planning.mjs');

// --- the pure lib -------------------------------------------------------------

test('a migrations/ directory and an auth dependency evidence those two categories', () => {
  const r = scanTree({ dirs: ['src', 'migrations'], dependencies: ['passport', 'lodash'] });
  assert.deepEqual(r.evidenced.map((e) => e.category).sort(), ['auth', 'migrations']);
  assert.equal(r.inconclusive, false);
  assert.match(r.evidenced.find((e) => e.category === 'migrations').signal, /migrations\//);
  assert.match(r.evidenced.find((e) => e.category === 'auth').signal, /passport/);
});

test('an empty tree is inconclusive with all eight recommended', () => {
  const r = scanTree({});
  assert.deepEqual(r.evidenced, []);
  assert.equal(r.inconclusive, true);
  assert.deepEqual(r.recommended, [...CATEGORIES]);
  assert.deepEqual(r.silent, [...CATEGORIES]);
});

test('the word `session` in a source file evidences nothing - source text is not an input', () => {
  // The 2026-08-13 false positive this design exists to prevent: a keyword pass
  // over this repo matched `session` 16 times, every one of them a Claude
  // session, and reported `auth`. The scan takes no source text at all, so the
  // only way to hand it that word is as a name - and it is not a signal name.
  const r = scanTree({
    dirs: ['skills', 'docs'],
    files: ['session.md', 'sessions.txt', 'billing-notes.md'],
    extensions: ['.md', '.mjs'],
    dependencies: [],
  });
  assert.deepEqual(r.evidenced, []);
  assert.equal(r.inconclusive, true);
});

test('a category the structure never evidences is `silent`, never absent', () => {
  const r = scanTree({ dirs: ['migrations'] });
  assert.ok(r.silent.includes('billing'));
  assert.ok(!('absent' in r), 'the scan grew an absence verdict');
  for (const e of r.evidenced) assert.ok(typeof e.signal === 'string' && e.signal);
});

test('destructive is unspeakable, so it rides every recommendation', () => {
  // No directory, manifest or file type says a project performs a bulk delete.
  assert.deepEqual(scanTree({}).unspeakable, ['destructive']);
});

test('evidence for ONE category never narrows the recommendation', () => {
  // The falsifier for the absence-from-silence rule on the evidenced path.
  // A project with a migrations/ directory and framework built-in auth emits
  // no auth dependency, so `auth` is silent - and narrowing to the evidenced
  // set would persist a scope in which a later auth diff fires no blocking
  // review at all.
  const r = scanTree({ dirs: ['migrations'] });
  assert.ok(r.evidenced.some((e) => e.category === 'migrations'));
  assert.ok(r.silent.includes('auth'));
  assert.equal(r.inconclusive, false, 'evidence was found, so it is not inconclusive');
  assert.deepEqual(r.recommended, [...CATEGORIES], 'a silent category was dropped');
});

test('a dependency matches by NAME, never as a substring', () => {
  // `oauthlib` contains `auth`; a substring match is the keyword pass again.
  assert.deepEqual(scanTree({ dependencies: ['authoring-tools', 'coauthor'] }).evidenced, []);
  // A scoped package matches on its last segment.
  assert.equal(scanTree({ dependencies: ['@grpc/grpc-js'] }).evidenced[0].category, 'api_contract');
});

test('a malformed tree description reports rather than throwing', () => {
  for (const t of [null, 'nope', 7, { dirs: 'migrations', dependencies: 3 }]) {
    assert.doesNotThrow(() => scanTree(t), JSON.stringify(t));
  }
});

// --- the disk half ------------------------------------------------------------

/** `planning.mjs detect-surfaces ...`, parsed off stdout on either exit code. */
function run(...args) {
  try {
    return JSON.parse(execFileSync('node',
      [PLANNING, 'detect-surfaces', ...args], { encoding: 'utf8' }));
  } catch (e) {
    return JSON.parse(e.stdout);
  }
}
const detect = (root) => run('--root', root);

test('detect-surfaces reads directories two levels deep and a manifest it finds', () => {
  const root = mkdtempSync(join(tmpdir(), 'cad-surfaces-'));
  mkdirSync(join(root, 'db', 'migrate'), { recursive: true });
  writeFileSync(join(root, 'package.json'),
    JSON.stringify({ dependencies: { stripe: '^1' } }));
  const r = detect(root);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(r.manifests, ['package.json']);
  const found = r.evidenced.map((e) => e.category).sort();
  assert.deepEqual(found, ['billing', 'migrations']);
  assert.equal(r.inconclusive, false);
});

test('detect-surfaces names an unparseable manifest in warnings rather than throwing', () => {
  const root = mkdtempSync(join(tmpdir(), 'cad-surfaces-'));
  writeFileSync(join(root, 'package.json'), '{not json');
  const r = detect(root);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.ok(r.warnings.some((w) => w.includes('package.json')), JSON.stringify(r.warnings));
  assert.equal(r.inconclusive, true);
});

test('detect-surfaces skips node_modules - every JS project would evidence everything', () => {
  const root = mkdtempSync(join(tmpdir(), 'cad-surfaces-'));
  mkdirSync(join(root, 'node_modules', 'express'), { recursive: true });
  writeFileSync(join(root, 'node_modules', 'package.json'),
    JSON.stringify({ dependencies: { stripe: '^1' } }));
  const r = detect(root);
  assert.deepEqual(r.evidenced, []);
  assert.deepEqual(r.manifests, []);
});

test('detect-surfaces refuses a --root with nothing usable after it', () => {
  const r = run('--root');
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'bad-args');
});

test('a bare PEP 621 pyproject evidences its dependencies, not an empty manifest', () => {
  // PEP 621 declares `dependencies` as an ARRAY under `[project]`, a header
  // that says nothing about dependencies. A section-scoped read finds the
  // manifest and nothing in it, so the project reads inconclusive and the
  // scan recommends all eight - expensive, and the evidence was right there.
  const root = mkdtempSync(join(tmpdir(), 'cad-surfaces-'));
  writeFileSync(join(root, 'pyproject.toml'),
    '[project]\nname = "my-app"\nversion = "0.1.0"\ndependencies = [\n  "flask>=3",\n  "alembic",\n]\n');
  const r = detect(root);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(r.manifests, ['pyproject.toml']);
  const found = r.evidenced.map((e) => e.category).sort();
  assert.deepEqual(found, ['migrations', 'untrusted_input'], JSON.stringify(r.evidenced));
  assert.equal(r.inconclusive, false);
  // `name` and `version` sit under the same header and are NOT dependencies.
  assert.ok(!r.evidenced.some((e) => /my-app/.test(e.signal)), JSON.stringify(r.evidenced));
});

test('a single-line PEP 621 dependencies array closes on its own line', () => {
  const root = mkdtempSync(join(tmpdir(), 'cad-surfaces-'));
  writeFileSync(join(root, 'pyproject.toml'),
    '[project]\ndependencies = ["flask>=3"]\nname = "passport-themed-name"\n');
  const r = detect(root);
  assert.deepEqual(r.evidenced.map((e) => e.category), ['untrusted_input'], JSON.stringify(r.evidenced));
});

test('a PEP 508 extra does not end the dependencies array early', () => {
  // `"requests[socks]"` carries a `]` of its own. Reading that as the close
  // drops every entry after it, and the surface those entries evidence.
  const root = mkdtempSync(join(tmpdir(), 'cad-surfaces-'));
  writeFileSync(join(root, 'pyproject.toml'),
    '[project]\ndependencies = [\n  "requests[socks]",\n  "alembic",\n]\n');
  const r = detect(root);
  assert.ok(r.evidenced.some((e) => e.category === 'migrations'), JSON.stringify(r.evidenced));
});

test('a tool table`s ignored-dependencies is a setting, not a dependency', () => {
  const root = mkdtempSync(join(tmpdir(), 'cad-surfaces-'));
  writeFileSync(join(root, 'pyproject.toml'),
    '[project]\nname = "x"\n\n[tool.some_linter]\nignored-dependencies = ["flask"]\n');
  const r = detect(root);
  assert.deepEqual(r.evidenced, [], JSON.stringify(r.evidenced));
  assert.equal(r.inconclusive, true);
});
