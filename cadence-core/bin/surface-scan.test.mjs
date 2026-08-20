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
import { scanTree, CATEGORIES, interviewOptions, OPTION_CAP } from './lib/surface-scan.mjs';

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

// --- the interview's option list (#206) ---------------------------------------
//
// The defect these rows exist for: the option list used to be composed by a
// model from three prose bullets, the last of which said "fill the remaining
// slots with ... the evidenced categories alone, and all eight" - so slot 1 and
// the last slot were the same eight categories, and no test could see it
// because there was no list to read. Distinctness is now a property of a value.

/** The sets a choice list offers, as joined keys. */
const sets = (options) => options.map((o) => o.surfaces.join(','));
const ALL_EIGHT = [...CATEGORIES].join(',');

test('an inconclusive scan and an evidenced one both lead with all eight', () => {
  // D-14 on the option list itself: `inconclusive` changes the REASON beside
  // the recommendation, never its set. Narrowing the first choice on a scan
  // that found nothing is the absence-from-silence conclusion again.
  const blind = interviewOptions(scanTree({}));
  const seen = interviewOptions(scanTree({ dirs: ['migrations'] }));
  assert.equal(sets(blind)[0], ALL_EIGHT);
  assert.equal(sets(seen)[0], ALL_EIGHT);
  assert.notEqual(blind[0].reason, seen[0].reason,
    'the two scan arms state the same reason, so the evidence is not being reported');
  assert.match(seen[0].reason, /migrations\//, 'the evidenced arm drops the scan signal');
});

test('the evidenced-only choice is absent when nothing was evidenced', () => {
  // An empty set is not an option: offering "review nothing" is not a narrower
  // scope, it is turning the only blocking trigger off by accident.
  const blind = interviewOptions(scanTree({}));
  assert.deepEqual(sets(blind), [ALL_EIGHT], JSON.stringify(blind));
  const seen = interviewOptions(scanTree({ dirs: ['migrations'] }));
  assert.deepEqual(sets(seen), [ALL_EIGHT, 'migrations'], JSON.stringify(seen));
});

test('an answered set gains the newly evidenced category as the SECOND choice', () => {
  // The whole reason the arm is re-enterable: a project answered `secrets` and
  // added Stripe six months later. The recommendation is still all eight, and
  // the union sits where a user who wants the minimum change will find it.
  const options = interviewOptions(scanTree({ dependencies: ['stripe'] }), ['secrets']);
  assert.equal(sets(options)[0], ALL_EIGHT);
  assert.deepEqual(options[1].surfaces, ['billing', 'secrets']);
  assert.match(options[1].reason, /stripe/, 'the union choice does not name what it added');
});

test('with nothing answered the evidenced choice states the EVIDENCE, not a phantom answer', () => {
  // The first-fire path, and so the sentence most users ever read. The union
  // choice and the evidenced-only choice carry the same set when `held` is
  // empty, and the dedup keeps whichever came first - so the guard has to drop
  // the union choice, or the six evidenced categories get presented as "the
  // answered set plus what the scan now evidences beyond it" to a project that
  // has answered nothing.
  const options = interviewOptions(scanTree({
    dirs: ['auth', 'migrations', 'api', 'workers'],
    dependencies: ['stripe', 'express'],
  }));
  assert.equal(sets(options)[0], ALL_EIGHT);
  assert.deepEqual(options[1].surfaces,
    ['auth', 'migrations', 'billing', 'concurrency', 'api_contract', 'untrusted_input']);
  assert.match(options[1].reason, /^only what the structure evidences: /,
    `the evidenced choice reads as an answered set that does not exist: ${options[1].reason}`);
  assert.doesNotMatch(options[1].reason, /answered set/,
    `nothing was answered, yet the choice names an answered set: ${options[1].reason}`);
});

test('an answered set equal to all eight still leads with all eight and repeats nothing', () => {
  const options = interviewOptions(scanTree({ dependencies: ['stripe'] }), [...CATEGORIES]);
  assert.equal(sets(options)[0], ALL_EIGHT);
  assert.equal(new Set(sets(options)).size, options.length,
    `two choices carry the same set: ${JSON.stringify(sets(options))}`);
});

test('no call returns more than the ask-user seam option cap', () => {
  for (const [tree, answered] of [
    [{}, undefined],
    [{ dirs: ['migrations'] }, undefined],
    [{ dependencies: ['stripe'] }, ['secrets']],
    [{ dirs: ['auth', 'migrations', 'api', 'workers'], dependencies: ['stripe', 'dotenv'] }, ['secrets']],
    [{ dirs: ['migrations'] }, [...CATEGORIES]],
  ]) {
    const options = interviewOptions(scanTree(tree), answered);
    assert.ok(options.length <= OPTION_CAP, JSON.stringify(sets(options)));
    assert.equal(new Set(sets(options)).size, options.length, JSON.stringify(sets(options)));
    for (const o of options) assert.ok(o.reason, 'a choice arrived with no reason');
  }
});

test('a malformed scan or answered set reports rather than throwing', () => {
  for (const bad of [null, 'nope', 7, { evidenced: 'migrations', recommended: 3 }]) {
    assert.doesNotThrow(() => interviewOptions(bad), JSON.stringify(bad));
  }
  // An unrecognised answered token is dropped, never written into a choice:
  // `answeredSurfaces` already reads such a list as UNANSWERED, and offering a
  // typo back as a set would persist it.
  const options = interviewOptions(scanTree({}), ['secret', 'secrets']);
  for (const o of options) assert.ok(!o.surfaces.includes('secret'), JSON.stringify(o));
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

/**
 * The #206 demo tree: the project the duplicate-option report was filed from.
 * Express + Stripe + Prisma + Passport, with the four category directories, a
 * `.sql` file and an `openapi.yaml` - six of the eight evidenced, `destructive`
 * and `secrets` silent.
 */
function demoTree() {
  const root = mkdtempSync(join(tmpdir(), 'cad-206-'));
  for (const d of ['auth', 'migrations', 'api', 'workers']) mkdirSync(join(root, d));
  writeFileSync(join(root, 'package.json'), JSON.stringify({
    dependencies: { express: '^4', stripe: '^14', prisma: '^5', passport: '^0.7' },
  }));
  writeFileSync(join(root, 'migrations', '001_init.sql'), 'select 1;\n');
  writeFileSync(join(root, 'openapi.yaml'), 'openapi: 3.0.0\n');
  return root;
}

const EVIDENCED_SIX = ['api_contract', 'auth', 'billing', 'concurrency',
  'migrations', 'untrusted_input'];

test('the #206 demo tree evidences six categories and offers two distinct options', () => {
  // The defect itself: this question used to arrive with all eight in slot 1
  // and all eight again in the last slot, because the prose told a model to
  // "fill the remaining slots with ... the evidenced categories alone, and all
  // eight". Two options, two different sets.
  const r = run('--root', demoTree());
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(r.evidenced.map((e) => e.category).sort(), EVIDENCED_SIX,
    JSON.stringify(r.evidenced));
  const sets = r.options.map((o) => o.surfaces.join(','));
  assert.equal(new Set(sets).size, sets.length, `a repeated option set: ${JSON.stringify(sets)}`);
  assert.deepEqual(r.options[0].surfaces, [...CATEGORIES]);
  assert.deepEqual([...r.options[1].surfaces].sort(), EVIDENCED_SIX, JSON.stringify(sets));
});

test('--answered on the demo tree keeps all eight first and puts the union second', () => {
  // A project that answered `secrets` and then added the rest. The
  // recommendation does not narrow (D-14); the union is the second choice, and
  // it is NOT all eight - `destructive` is evidenced by nothing and was never
  // answered, so it is absent from it.
  const r = run('--root', demoTree(), '--answered', 'secrets');
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(r.options[0].surfaces, [...CATEGORIES]);
  assert.deepEqual([...r.options[1].surfaces].sort(), [...EVIDENCED_SIX, 'secrets'].sort(),
    JSON.stringify(r.options[1]));
  assert.ok(!r.options[1].surfaces.includes('destructive'), JSON.stringify(r.options[1]));
});

test('detect-surfaces refuses an --answered with nothing usable after it', () => {
  const r = run('--root', demoTree(), '--answered');
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.reason, 'bad-args');
  assert.match(r.detail, /--answered/);
});

test('detect-surfaces refuses an --answered token outside the eight', () => {
  // Narrowing to the tokens that parsed would build an option list from an
  // answer nobody gave, which is how `["auth","secret"]` stops reviewing
  // secrets forever.
  const r = run('--root', demoTree(), '--answered', 'nope');
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.reason, 'bad-args');
  assert.match(r.detail, /nope/);
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
