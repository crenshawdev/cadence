// Zero-dep tests for `planning.mjs debt-harvest`. Run:
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
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, symlinkSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DEBT_TOKEN } from './lib/debt-markers.mjs';
import { PLANNING } from './planning.test.mjs';

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

// --- debt-harvest: markers in tracked code reach the queue (DBT-01) ----------
//
// The token is BUILT from the export, never typed as a literal followed by a
// colon: the harvest scans this tracked test file, and a literal marker here
// would be collected as a real one - breaking `debt-harvest --root .` over this
// repo, which must report zero.
const debtLine = (text, ceiling, trigger) => {
  const fields = [` ${text}`];
  if (ceiling) fields.push(` ceiling: ${ceiling}`);
  if (trigger) fields.push(` trigger: ${trigger}`);
  return `${DEBT_TOKEN}:${fields.join(' |')}`;
};

/** A scratch PROJECT root that is a git repo, with `.planning/` present. */
function debtRepo() {
  const root = mkdtempSync(join(tmpdir(), 'cad-debt-'));
  execFileSync('git', ['init', '-q'], { cwd: root });
  execFileSync('git', ['config', 'user.email', 't@example.com'], { cwd: root });
  execFileSync('git', ['config', 'user.name', 'T'], { cwd: root });
  mkdirSync(join(root, '.planning'), { recursive: true });
  return root;
}

/** Write a file under the root and `git add` it (optionally forced). */
function debtAdd(root, rel, body, force = false) {
  const abs = join(root, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, body);
  execFileSync('git', ['add', ...(force ? ['-f'] : []), '--', rel], { cwd: root });
}

/** `debt-harvest` against a project root; parse its one JSON line. */
function harvest(root, extra = []) {
  const args = root === null ? ['debt-harvest', ...extra]
    : ['debt-harvest', '--root', root, ...extra];
  try {
    return JSON.parse(execFileSync('node', [PLANNING, ...args], { encoding: 'utf8' }));
  } catch (e) {
    return JSON.parse(e.stdout);
  }
}

const captureOf = (root) => readFileSync(join(root, '.planning', 'CAPTURE.md'), 'utf8');

test('debt-harvest: a planted marker is collected with its ceiling and trigger', () => {
  const root = debtRepo();
  debtAdd(root, 'src/a.js', `// ${debtLine('single-tenant only', 'no tenant column', 'tenant two')}\n`);
  const r = harvest(root);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.markers, 1);
  assert.equal(r.written, true);
  const body = captureOf(root);
  assert.match(body, /## Debt markers/);
  assert.match(body, /- `src\/a\.js:1` single-tenant only - ceiling: no tenant column - trigger: tenant two/);
});

test('debt-harvest: the 19 conventional markers contribute NOTHING (AC5)', () => {
  const root = debtRepo();
  debtAdd(root, 'src/b.js', ['// TODO: fix this', '// FIXME: broken', '// XXX: careful',
    '// HACK: works for now', '// NOTE: read me', '// placeholder', '// not implemented',
    '// SHORTCUT: nope', '// DEBT: nope', '// CORNER: nope', '// TRIPWIRE: nope',
    '// CUT: nope', '// CEILING: nope', '// CAD-DEBT: nope', '// todo!()',
    '// unimplemented!()', '// WIP', '// REVIEW', '// OPTIMIZE'].join('\n'));
  const r = harvest(root);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.markers, 0);
  assert.match(captureOf(root), /## Debt markers\n\n- None\.\n/);
});

test('debt-harvest: an untracked file and an ignored node_modules contribute nothing (AC5)', () => {
  const root = debtRepo();
  debtAdd(root, 'src/a.js', `// ${debtLine('tracked cut', 'c', 't')}\n`);
  // Untracked: `git ls-files` never lists it.
  mkdirSync(join(root, 'src'), { recursive: true });
  writeFileSync(join(root, 'src', 'untracked.js'), `// ${debtLine('untracked cut', 'c', 't')}\n`);
  // Ignored AND untracked: the ordinary node_modules case.
  writeFileSync(join(root, '.gitignore'), 'node_modules/\n');
  execFileSync('git', ['add', '--', '.gitignore'], { cwd: root });
  mkdirSync(join(root, 'node_modules', 'pkg'), { recursive: true });
  writeFileSync(join(root, 'node_modules', 'pkg', 'x.js'), `// ${debtLine('vendor cut', 'c', 't')}\n`);
  const r = harvest(root);
  assert.equal(r.markers, 1, JSON.stringify(r));
  assert.match(captureOf(root), /tracked cut/);
  assert.doesNotMatch(captureOf(root), /untracked cut|vendor cut/);
});

test('debt-harvest: a FORCE-ADDED node_modules file is enumerated and still skipped', () => {
  // The claim `git ls-files` does NOT support: an ignore rule does not remove an
  // already-tracked path, so `ls-files` lists a force-added node_modules file.
  // The explicit segment skip is what keeps third-party markers out, and this is
  // the fixture that fails without it.
  const root = debtRepo();
  writeFileSync(join(root, '.gitignore'), 'node_modules/\n');
  execFileSync('git', ['add', '--', '.gitignore'], { cwd: root });
  debtAdd(root, 'node_modules/pkg/y.js', `// ${debtLine('vendor cut', 'c', 't')}\n`, true);
  // The premise: git really does enumerate it.
  const listed = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' });
  assert.match(listed, /node_modules\/pkg\/y\.js/, 'fixture is wrong: git did not track it');
  const r = harvest(root);
  assert.equal(r.markers, 0, JSON.stringify(r));
});

test('debt-harvest: running twice leaves CAPTURE.md byte-identical (AC6)', () => {
  const root = debtRepo();
  debtAdd(root, 'src/a.js', `// ${debtLine('a cut', 'c', 't')}\n`);
  const first = harvest(root);
  assert.equal(first.written, true);
  const after = captureOf(root);
  const second = harvest(root);
  assert.equal(second.written, false, JSON.stringify(second));
  assert.equal(second.markers, 1);
  assert.equal(captureOf(root), after);
});

test('debt-harvest: ## Todos is never touched, and a deleted marker disappears (AC6)', () => {
  const root = debtRepo();
  const todos = '## Todos\n\n- [ ] (phase 1) a hand-written item\n\n## Seeds\n\n- a seed\n';
  writeFileSync(join(root, '.planning', 'CAPTURE.md'), todos);
  debtAdd(root, 'src/a.js', `// ${debtLine('a cut', 'c', 't')}\n`);
  harvest(root);
  assert.match(captureOf(root), /- \[ \] \(phase 1\) a hand-written item/);
  assert.match(captureOf(root), /a cut/);
  // Delete the marker from source: its bullet goes, the hand-written queue stays.
  writeFileSync(join(root, 'src', 'a.js'), '// nothing to see\n');
  const r = harvest(root);
  assert.equal(r.markers, 0, JSON.stringify(r));
  assert.doesNotMatch(captureOf(root), /a cut/);
  assert.match(captureOf(root), /- \[ \] \(phase 1\) a hand-written item/);
  assert.match(captureOf(root), /- a seed/);
  // Every pre-existing section survived the rewrite.
  assert.ok(captureOf(root).startsWith(todos.split('\n')[0]));
});

test('debt-harvest: a fenced ## line in someone else\'s bullet is never touched (D-12)', () => {
  // The harvest rewrites ONE section, so a `## ` line fenced inside a `## Todos`
  // bullet sits in the untouched prefix and survives whatever the bound does.
  // This row pins that the rewrite does not reach it; the row BELOW is the one
  // that proves the bound itself.
  const root = debtRepo();
  const fenced = '## Todos\n\n- [ ] keep this bullet:\n\n  ```sh\n  ## build output\n  make dist\n  ```\n\n'
    + '## Debt markers\n\n- None.\n';
  writeFileSync(join(root, '.planning', 'CAPTURE.md'), fenced);
  debtAdd(root, 'src/a.js', `// ${debtLine('a cut', 'c', 't')}\n`);
  harvest(root);
  const body = captureOf(root);
  assert.match(body, /## build output/);          // not truncated mid-fence
  assert.equal((body.match(/```/g) || []).length, 2, 'fence count must stay even');
  assert.match(body, /make dist/);
  assert.match(body, /a cut/);
});

test('debt-harvest: the section bound reads a fence, so stale debris cannot survive (D-12)', () => {
  // The fixture where the bound actually DECIDES: `## Debt markers` comes FIRST
  // and holds a stale fenced block whose content has a `## ` line. A bare
  // `/^## /` boundary test stops INSIDE that fence, so everything from
  // `## build output` down - an unclosed fence and its debris - is kept as the
  // tail and re-emitted after the new body, leaving an odd fence count and
  // rendering the rest of the queue as code. `sectionBound` skips fenced lines,
  // so the whole stale section is replaced and `## Todos` is the real boundary.
  const root = debtRepo();
  // The `## ` line must be at column 0 INSIDE the fence: `sectionBound`'s own
  // heading test is `/^## /`, so an INDENTED `  ## build output` is invisible to
  // both readers and would make this row pass either way.
  writeFileSync(join(root, '.planning', 'CAPTURE.md'),
    '## Debt markers\n\n- [ ] stale hand note:\n\n```sh\n## build output\nmake dist\n```\n\n'
    + '## Todos\n\n- [ ] a hand-written item\n');
  debtAdd(root, 'src/a.js', `// ${debtLine('a cut', 'c', 't')}\n`);
  harvest(root);
  const body = captureOf(root);
  assert.match(body, /a cut/);
  assert.match(body, /- \[ \] a hand-written item/);   // the real next section survives
  assert.doesNotMatch(body, /## build output/, 'stale fenced debris survived the rewrite');
  assert.doesNotMatch(body, /make dist/);
  assert.equal((body.match(/```/g) || []).length, 0, 'an unclosed fence was left behind');
});

test('debt-harvest: a FENCED example of the owned heading is not mistaken for it', () => {
  // The START boundary, which `sectionBound` never covered: the two rows above
  // both hand `replaceSection` a heading it finds in the right place, and a bare
  // `lines.findIndex((l) => l.trim() === heading)` passes them. Here the document
  // has NO real `## Debt markers` - only a fenced EXAMPLE of one inside a `##
  // Todos` bullet - so a fence-blind search anchors the rewrite inside that code
  // block. The scan then resumes mid-fence, reads the block's CLOSING fence as an
  // opener, finds no boundary at all, and every later section is replaced by the
  // new body: `## Seeds` and `## Notes` disappear outright. The correct answer is
  // to leave the example alone and APPEND a real section at the end.
  const root = debtRepo();
  writeFileSync(join(root, '.planning', 'CAPTURE.md'),
    '## Todos\n\n- [ ] document the marker grammar, like:\n\n```md\n## Debt markers\n'
    + '- `src/x.js:1` an example bullet\n```\n\n'
    + '## Seeds\n\n- [ ] a seed\n\n## Notes\n\n- keep me\n');
  debtAdd(root, 'src/a.js', `// ${debtLine('a cut', 'c', 't')}\n`);
  harvest(root);
  const body = captureOf(root);
  assert.match(body, /- \[ \] a seed/, '## Seeds was destroyed by a false start boundary');
  assert.match(body, /- keep me/, '## Notes was destroyed by a false start boundary');
  assert.match(body, /- \[ \] document the marker grammar/);
  assert.match(body, /an example bullet/, 'the fenced example was rewritten');
  assert.equal((body.match(/```/g) || []).length, 2, 'fence count must stay even');
  // ...and the real section landed, appended after the document rather than into
  // the example.
  assert.match(body, /a cut/);
  assert.ok(body.indexOf('- keep me') < body.lastIndexOf('## Debt markers'),
    'the real section must be appended AFTER the existing content');
});

test('debt-harvest: a TRACKED CAPTURE.md already holding a section stays idempotent', () => {
  // The self-ingestion guard: `.planning/` is skipped, so the harvest's own
  // output is never read back as a marker even where the queue is tracked.
  const root = debtRepo();
  debtAdd(root, 'src/a.js', `// ${debtLine('a cut', 'c', 't')}\n`);
  harvest(root);
  execFileSync('git', ['add', '--', '.planning/CAPTURE.md'], { cwd: root });
  const after = captureOf(root);
  const r = harvest(root);
  assert.equal(r.markers, 1, JSON.stringify(r));   // still 1, not 2
  assert.equal(r.written, false);
  assert.equal(captureOf(root), after);
});

test('debt-harvest: a malformed marker is reported, never dropped', () => {
  const root = debtRepo();
  debtAdd(root, 'src/a.js', `// ${debtLine('no trigger stated', 'a ceiling', null)}\n`);
  const r = harvest(root);
  assert.equal(r.markers, 1);
  assert.deepEqual(r.malformed, [{ path: 'src/a.js', line: 1, missing: ['trigger'] }]);
  assert.match(captureOf(root), /trigger: \(unstated\)/);
});

test('debt-harvest: a tracked SYMLINK out of the tree contributes nothing', () => {
  // `statSync`/`readFileSync` both follow a link, so the harvest read a file the
  // project does not contain and filed its marker under the in-tree path - a
  // corner-cut reported at a line that holds no marker. A tracked link's target is
  // either in the tree (enumerated on its own path) or outside it, so skipping
  // links loses nothing that belongs here.
  const root = debtRepo();
  const outside = join(mkdtempSync(join(tmpdir(), 'cad-debt-out-')), 'outside.js');
  writeFileSync(outside, `// ${debtLine('external cut', 'cx', 'tx')}\n`);
  mkdirSync(join(root, 'src'), { recursive: true });
  symlinkSync(outside, join(root, 'src', 'link.js'));
  execFileSync('git', ['add', '--', 'src/link.js'], { cwd: root });
  debtAdd(root, 'src/real.js', `// ${debtLine('in-tree cut', 'c', 't')}\n`);
  const r = harvest(root);
  assert.equal(r.markers, 1, JSON.stringify(r));
  const body = captureOf(root);
  assert.match(body, /in-tree cut/);
  assert.doesNotMatch(body, /external cut/, 'a symlink target outside the tree was read');
  assert.doesNotMatch(body, /link\.js/);
});

test('debt-harvest: a non-git root is ok:false, never a zero-marker answer', () => {
  const root = mkdtempSync(join(tmpdir(), 'cad-debt-nogit-'));
  mkdirSync(join(root, '.planning'), { recursive: true });
  const r = harvest(root);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.reason, 'no-git');
  assert.equal(existsSync(join(root, '.planning', 'CAPTURE.md')), false);
});

test('debt-harvest: a --root present with nothing usable is refused, never the cwd', () => {
  const bare = harvest(null, ['--root']);
  assert.equal(bare.ok, false, JSON.stringify(bare));
  assert.equal(bare.reason, 'bad-args');
  const empty = harvest('');
  assert.equal(empty.ok, false, JSON.stringify(empty));
  assert.equal(empty.reason, 'bad-args');
});

test('debt-harvest: an absent CAPTURE.md is created with the /cad-capture headings', () => {
  const root = debtRepo();
  debtAdd(root, 'src/a.js', `// ${debtLine('a cut', 'c', 't')}\n`);
  harvest(root);
  const body = captureOf(root);
  for (const h of ['## Todos', '## Seeds', '## Notes', '## Debt markers']) {
    assert.ok(body.includes(h), `missing ${h}: ${body}`);
  }
});

test('debt-harvest: a planning doc QUOTING a literal marker is not harvested', () => {
  // The fixture the `.planning/` skip actually needs. Removing the skip does NOT
  // redden the tracked-CAPTURE.md row above - the rendered section carries no
  // token, so the harvest cannot re-ingest its own output through it. What the
  // skip really protects is a planning DOC that writes a literal marker line
  // while describing one: a PLAN, a CONTEXT or a SUMMARY quoting the grammar
  // would otherwise land in the queue as a real corner-cut, on a phase that cut
  // nothing.
  const root = debtRepo();
  debtAdd(root, 'src/a.js', `// ${debtLine('a real cut', 'c', 't')}\n`);
  debtAdd(root, '.planning/phases/1/PLAN.md',
    `# Plan\n\nMark it like this: \`${debtLine('example only', 'nothing', 'never')}\`\n`);
  const r = harvest(root);
  assert.equal(r.markers, 1, JSON.stringify(r));
  assert.match(captureOf(root), /a real cut/);
  assert.doesNotMatch(captureOf(root), /example only/);
});
