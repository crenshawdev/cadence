// Zero-dep tests for lib/git-segments.mjs (the anchored reader that replaced
// the deleted tokenizer). Run:
// node --test 'cadence-core/bin/*.test.mjs'
//
// The table below is the reader's whole stated behavior. Rows marked SILENT are
// the accepted cost of deleting the parser, not oversights: each one is a shape
// the old tokenizer saw and this one declines to guess at. references/git-publish.md
// rail 3 carries the same list in prose.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { existsSync, mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path, { join } from 'node:path';

import { gitInvocations, gitVerbs, parentDir, planningRoot, planningRootAsync } from './lib/git-segments.mjs';

// --- The anchor: a segment counts only when its command word is `git`. -------

const SEEN = [
  ['git push origin main', ['push']],
  ['git commit -m x', ['commit']],
  ['git add . && git push', ['add', 'push']],
  ['git add .; git commit -m x; git push', ['add', 'commit', 'push']],
  ['git add . & git push', ['add', 'push']],
  ['git status | grep foo', ['status']],
  ['git add .\ngit push', ['add', 'push']],
  ['/usr/bin/git push origin main', ['push']], // ends in /git, so it counts
  ['  git   push   origin  main  ', ['push']], // whitespace is not significant
  ['git stash push -m wip', ['stash']],        // the verb is stash, not push
];

test('a segment whose command word is git reports its verb', () => {
  for (const [text, want] of SEEN) {
    assert.deepEqual(gitVerbs(text), want, text);
  }
});

// --- Flags and global options. ----------------------------------------------

test('the verb is the first NON-FLAG word', () => {
  assert.deepEqual(gitVerbs('git --no-pager push origin main'), ['push']);
  assert.deepEqual(gitVerbs('git -p --literal-pathspecs commit -m x'), ['commit']);
});

test('a global option taking a separate argument is skipped WITH its argument', () => {
  // Without this the path reads as the verb and a real push goes silent.
  assert.deepEqual(gitVerbs('git -C /srv/repo push origin main'), ['push']);
  assert.deepEqual(gitVerbs('git -c user.name=t commit -m x'), ['commit']);
  assert.deepEqual(gitVerbs('git --git-dir /srv/r/.git push'), ['push']);
  assert.deepEqual(gitVerbs('git --work-tree /srv/r --git-dir /srv/r/.git push'), ['push']);
});

test('an =-glued global option needs no entry of its own - it is one flag word', () => {
  assert.deepEqual(gitVerbs('git --git-dir=/srv/r/.git push'), ['push']);
});

// --- What the anchor makes silent, and why that is the point. ---------------

const SILENT = [
  // Mentions and read-only searches. These are the rows that retired the old
  // deny gate: a wide reader saw them and a SECOND rule had to narrow refusal
  // back down. Here they never enter.
  ['rg -n "git push" .', 'a read-only search that runs no git'],
  ['rg -t sh "git commit"', 'the same, on the commit rail'],
  ['grep git commit', 'a bare mention'],
  ['command -v git commit', 'a lookup that runs nothing'],
  ['echo "git push origin main"', 'quoted text, not a command'],

  // Wrappers, substitutions and transparent prefixes. ACCEPTED COST: each of
  // these really can run git, and each is silent now. The tokenizer that saw
  // them cost 840 lines, an unbounded escape surface and a hook OOM.
  ['bash -c "git push origin main"', 'wrapper operand is not read'],
  ['sh -c \'git push origin main\'', 'the same for sh'],
  ['eval git push origin main', 'eval is not a wrapper any more'],
  ['$(git push origin main)', 'a substitution is not descended into'],
  ['`git push origin main`', 'nor a backtick region'],
  ['(git push origin main)', 'nor a subshell'],
  ['sudo git push origin main', 'a transparent prefix costs the detection'],
  ['xargs git push', 'the same'],
  ['env -S "git push origin main"', 'env -S is not walked'],
  ['ssh host "git push origin main"', 'remote execution was always out of grammar'],
];

test('a segment whose command word is not git is SILENT (the accepted cost)', () => {
  for (const [text, why] of SILENT) {
    assert.deepEqual(gitVerbs(text), [], `${text} - ${why}`);
  }
});

test('the anchor is the command word, so a git word mid-segment does not count', () => {
  assert.deepEqual(gitVerbs('echo git push'), []);
  assert.deepEqual(gitVerbs('nice -n 5 git commit -m x'), []);
});

test('only the VERB is read, so an operand naming another verb is not one', () => {
  // The commit rail must fire here and the push rail must not: the word `push`
  // is message content. Reading the first non-flag word and stopping is what
  // makes that true without inspecting quotes.
  assert.deepEqual(gitVerbs('git commit -m "fix the push rail"'), ['commit']);
  assert.deepEqual(gitVerbs('git log --oneline origin/main..HEAD'), ['log']);
});

// --- TOTAL and LINEAR. ------------------------------------------------------

test('TOTAL: any input at all returns an array and never throws', () => {
  const hostile = [
    undefined, null, 0, 1, true, false, NaN, Symbol('x'), {}, [], () => {},
    Object.create(null),
    { toString() { throw new Error('boom'); } },
    { [Symbol.toPrimitive]() { throw new Error('boom'); } },
  ];
  for (const value of hostile) {
    assert.deepEqual(gitVerbs(/** @type {any} */ (value)), [], String(value?.constructor?.name));
  }
  assert.deepEqual(gitVerbs(''), []);
});

test('LINEAR: the input size that OOMed the deleted reader is answered instantly', () => {
  // The deleted reader was O(K x N) in memory: 224KB measured at 3115MB, with a
  // V8 OOM (SIGABRT, no stdout) at 280KB. This hook runs on EVERY Bash call and
  // fails OPEN, so that abort let a real push through unprompted. 336KB here,
  // past that point, in one pass.
  const big = 'git clean -fd '.repeat(24000);
  assert.ok(big.length > 280_000, 'fixture must exceed the measured OOM point');
  const started = process.hrtime.bigint();
  assert.deepEqual(gitVerbs(big), ['clean']);
  const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
  assert.ok(elapsedMs < 2000, `took ${elapsedMs}ms`);
});

test('LINEAR: many separated invocations are all reported, in order', () => {
  const many = 'git push origin main; '.repeat(10000);
  const got = gitVerbs(many);
  assert.equal(got.length, 10000);
  assert.equal(got.every((v) => v === 'push'), true);
});

test('a separator run does not manufacture a verb', () => {
  assert.deepEqual(gitVerbs(';;;&&&|||'), []);
  assert.deepEqual(gitVerbs('git'), []);       // a git word with no verb
  assert.deepEqual(gitVerbs('git --no-pager'), []); // flags only
});

// --- The scope rule: the `.planning/` walk the hooks and the module share. ---

// Four trees, one per answer the walk can give. The probe answers only inside
// the fixture, so a stray `.planning` or `.git` above the temp dir on some
// machine cannot change an answer, and the last case still walks to the root.
function walkFixture() {
  const base = mkdtempSync(join(tmpdir(), 'cad-walk-'));
  const make = (...parts) => {
    const d = join(base, ...parts);
    mkdirSync(d, { recursive: true });
    return d;
  };
  const here = make('here');
  make('here', '.planning');
  const above = make('above');
  make('above', '.planning');
  make('outer', '.planning'); // above the repo: only the .git stop keeps it out
  make('outer', 'repo', '.git');
  const probed = [];
  const has = (dir, name) => {
    probed.push(dir);
    return (dir === base || dir.startsWith(base + path.sep)) && existsSync(join(dir, name));
  };
  const cases = [
    ['.planning in the start directory', here, here],
    ['.planning in an ancestor', make('above', 'src', 'deep'), above],
    ['a .git before any .planning', make('outer', 'repo', 'src'), null],
    ['neither marker up to the root', make('bare', 'a', 'b'), null],
  ];
  return { has, probed, cases };
}

test('planningRoot answers the four shapes through a sync probe', () => {
  const { has, probed, cases } = walkFixture();
  for (const [name, start, want] of cases) {
    probed.length = 0;
    assert.equal(planningRoot(start, has), want, name);
  }
  // The last case ran last: its walk ended at the filesystem root.
  assert.equal(probed.at(-1), path.parse(cases[3][1]).root);
});

test('planningRootAsync gives the same four answers through an async probe', async () => {
  const { has, cases } = walkFixture();
  for (const [name, start, want] of cases) {
    assert.equal(await planningRootAsync(start, async (dir, n) => has(dir, n)), want, name);
  }
});

test('the walk checks .planning before .git in the same directory', () => {
  const base = mkdtempSync(join(tmpdir(), 'cad-walk-'));
  mkdirSync(join(base, '.planning'));
  mkdirSync(join(base, '.git'));
  assert.equal(planningRoot(base, (d, n) => existsSync(join(d, n))), base);
});

// The module cannot import node:path, so parentDir is a port of it. Every step
// from each shape down to its root must match node's own dirname for that kind
// of path: posix for a `/`-leading path, win32 for a drive or UNC path.
const POSIX_SHAPES = ['/', '//', '/a', '/a/b', '/a/b/', '/a//b', '/a/b//', '//a', '/home/me/proj/src'];
const WIN32_SHAPES = [
  'C:\\', 'C:/', 'C:', 'C:\\a', 'C:\\a\\b', 'C:\\a\\b\\', 'C:/a/b/', 'c:\\a\\\\b',
  '\\\\srv\\share', '\\\\srv\\share\\', '\\\\srv\\share\\d\\e', '\\\\?\\C:\\a\\b',
];

test('parentDir steps exactly as path.posix.dirname and path.win32.dirname do', () => {
  const chase = (shapes, dirname) => {
    for (const shape of shapes) {
      let dir = shape;
      for (let i = 0; i < 20; i++) {
        const want = dirname(dir);
        assert.equal(parentDir(dir), want, `parentDir(${JSON.stringify(dir)})`);
        if (want === dir) break;
        dir = want;
      }
    }
  };
  chase(POSIX_SHAPES, path.posix.dirname);
  chase(WIN32_SHAPES, path.win32.dirname);
});

// --- gitInvocations: the same scan, keeping each segment's -C arguments. ----

test('gitInvocations keeps -C arguments in order, raw, and gitVerbs is its verb list', () => {
  assert.deepEqual(gitInvocations('git -C /tmp/x commit -m y'), [{ verb: 'commit', dirs: ['/tmp/x'] }]);
  assert.deepEqual(gitInvocations('git -C a -c k=v -C "$S" commit && git push'),
    [{ verb: 'commit', dirs: ['a', '"$S"'] }, { verb: 'push', dirs: [] }]);
  assert.deepEqual(gitInvocations('git -C'), []);
  assert.deepEqual(gitInvocations(42), []);
  for (const [cmd, verbs] of SEEN) {
    assert.deepEqual(gitInvocations(cmd).map((g) => g.verb), verbs, cmd);
    assert.deepEqual(gitVerbs(cmd), verbs, cmd);
  }
});
