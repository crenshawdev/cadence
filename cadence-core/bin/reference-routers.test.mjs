// Zero-dep tests for lib/reference-routers.mjs - the cold-branch register and
// its three arms as a pure function. Run:
//   node --test cadence-core/bin/reference-routers.test.mjs
// Only node: builtins, per the repo's zero-dep ethos.
//
// self-verify.test.mjs owns the LIVE tree - that the shipped routers really do
// carry every registered branch's Read - the same split deferred-reads.test.mjs
// and self-verify.test.mjs already keep for check 13. This file owns the RULE:
// what counts as a Read, what counts as a branch, and the falsifiers proving
// each arm fires on the tree it exists to catch and stays quiet on the tree it
// does not.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { referenceRouterIssues, ROUTERS, CODES } from './lib/reference-routers.mjs';

/** A temp root carrying `cadence-core/references/`, so the rule engages. */
function fixtureRoot() {
  const root = mkdtempSync(join(tmpdir(), 'cad-routers-'));
  mkdirSync(join(root, 'cadence-core', 'references'), { recursive: true });
  return root;
}

/** Write a file at a root-relative POSIX path. */
function put(root, rel, text) {
  const file = join(root, ...rel.split('/'));
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
  return file;
}

/** A Read line in the shape a branch index entry has to take. */
const readLine = (rel) => `Read \`\${CLAUDE_PLUGIN_ROOT}/${rel}\`.`;

const ROUTER = 'cadence-core/references/router.md';
const COLD = 'cadence-core/references/cold.md';
/** One synthetic row, so no test asserts the shipped register against itself. */
const ROW = [{ router: ROUTER, branch: 'the branch', cold: COLD }];

const kinds = (issues) => issues.map((i) => i.kind).sort();

// --- the register itself ------------------------------------------------------

// CADENCE-CENSUS: reference-router-branches | asserts: the register is 7 rows over 2 routers
test('the register pins its row count and its router count', () => {
  // Two numbers, not one. The row count alone passes a register whose four rows
  // all landed on one router, which is the shape a copy-paste produces; the
  // router count is what says these are two independent cold splits. Both move
  // in the commit that makes the cut and never on their own.
  assert.equal(ROUTERS.length, 7);
  assert.equal(new Set(ROUTERS.map((r) => r.router)).size, 2);
});

test('the register is frozen, rows and all', () => {
  assert.ok(Object.isFrozen(ROUTERS));
  for (const row of ROUTERS) assert.ok(Object.isFrozen(row), `${row.cold} row is not frozen`);
});

test('every row states a router, a branch and a cold path, all root-relative POSIX', () => {
  for (const row of ROUTERS) {
    for (const field of ['router', 'branch', 'cold']) {
      assert.equal(typeof row[field], 'string', `a row's ${field} is not a string`);
      assert.ok(row[field].length, `a row's ${field} is empty`);
    }
    for (const field of ['router', 'cold']) {
      assert.doesNotMatch(row[field], /\\|^\/|^\.\//,
        `${row[field]} is not a root-relative POSIX path`);
    }
    assert.notEqual(row.router, row.cold, `${row.router} is registered as its own cold branch`);
  }
});

// --- arm 1: the cold file is on disk ------------------------------------------

test('a cold file the tree does not have is reported against the COLD path', () => {
  const root = fixtureRoot();
  put(root, ROUTER, `# router\n\n${readLine(COLD)}\n`);
  const issues = referenceRouterIssues(root, ROW);
  assert.deepEqual(kinds(issues), [CODES.missingCold]);
  // Against the cold path, because that is the file a reader has to restore.
  assert.equal(issues[0].file, COLD);
  assert.match(issues[0].detail, /the branch/);
});

test('a missing cold file is reported ONCE, not also as an unread branch', () => {
  // The two arms would otherwise both fire on one deletion and a reader would
  // go looking for a deleted Read line that is still right there.
  const root = fixtureRoot();
  put(root, ROUTER, '# router\n\nno path here at all\n');
  assert.deepEqual(kinds(referenceRouterIssues(root, ROW)), [CODES.missingCold]);
});

// --- arm 2: the router still Reads it -----------------------------------------

test('a router carrying no plugin-root path for its cold file is an unread branch', () => {
  const root = fixtureRoot();
  put(root, COLD, '# cold\n');
  put(root, ROUTER, '# router\n\nthe branch is described and never loaded\n');
  const issues = referenceRouterIssues(root, ROW);
  assert.deepEqual(kinds(issues), [CODES.unread]);
  assert.equal(issues[0].file, ROUTER);
  assert.match(issues[0].detail, /the branch/);
});

test('a bare `references/<file>` citation is NOT a Read', () => {
  // The whole point of the plugin-root spelling: a citation tells a reader where
  // a rule lives, a `${CLAUDE_PLUGIN_ROOT}` path is what a model can open. Only
  // the second one makes a branch loadable.
  const root = fixtureRoot();
  put(root, COLD, '# cold\n');
  put(root, ROUTER, '# router\n\nThe branch lives in `references/cold.md`.\n');
  assert.deepEqual(kinds(referenceRouterIssues(root, ROW)), [CODES.unread]);
});

test('an unreadable ROUTER reports one unread branch per row, and never throws', (t) => {
  // Skipped as root, where the mode bits do not deny the read at all and the
  // fixture would silently test nothing.
  if (typeof process.getuid === 'function' && process.getuid() === 0) {
    t.skip('running as root: chmod 000 does not deny a read');
    return;
  }
  const root = fixtureRoot();
  put(root, COLD, '# cold\n');
  const second = 'cadence-core/references/cold2.md';
  put(root, second, '# cold 2\n');
  const file = put(root, ROUTER, '# router\n');
  chmodSync(file, 0o000);
  const rows = [...ROW, { router: ROUTER, branch: 'the other branch', cold: second }];
  const issues = referenceRouterIssues(root, rows);
  chmodSync(file, 0o644);
  assert.deepEqual(kinds(issues), [CODES.unread, CODES.unread]);
  assert.match(issues.map((i) => i.detail).join('\n'), /absent or unreadable/);
});

// --- arm 3: the register's own completeness -----------------------------------

test('a references path the router names that no row declares is an unregistered branch', () => {
  const root = fixtureRoot();
  put(root, COLD, '# cold\n');
  put(root, 'cadence-core/references/stowaway.md', '# stowaway\n');
  put(root, ROUTER, `# router\n\n${readLine(COLD)}\n\n${readLine('cadence-core/references/stowaway.md')}\n`);
  const issues = referenceRouterIssues(root, ROW);
  assert.deepEqual(kinds(issues), [CODES.unregistered]);
  assert.equal(issues[0].file, ROUTER);
  assert.match(issues[0].detail, /stowaway\.md/);
});

test('an unregistered branch named twice is reported once', () => {
  const root = fixtureRoot();
  put(root, COLD, '# cold\n');
  const stow = 'cadence-core/references/stowaway.md';
  put(root, ROUTER,
    `# router\n\n${readLine(COLD)}\n\n${readLine(stow)}\n\nand again: ${readLine(stow)}\n`);
  assert.equal(referenceRouterIssues(root, ROW).length, 1);
});

test('a router naming ITSELF is not an unregistered branch', () => {
  const root = fixtureRoot();
  put(root, COLD, '# cold\n');
  put(root, ROUTER, `# router\n\n${readLine(ROUTER)}\n\n${readLine(COLD)}\n`);
  assert.deepEqual(referenceRouterIssues(root, ROW), []);
});

test('a path inside a FENCED block is an argument, not a branch', () => {
  // `references/review-triggers.md` really does pass
  // `${CLAUDE_PLUGIN_ROOT}/cadence-core/references/reviewer-brief.md` to a
  // `node -e` composer. That is a path handed to a subprocess, not a file the
  // router loads, and counting it would force a register row for a branch that
  // does not exist.
  const root = fixtureRoot();
  put(root, COLD, '# cold\n');
  const body = `# router\n\n${readLine(COLD)}\n\n`
    + '```\n'
    + 'node -e \'...\' "${CLAUDE_PLUGIN_ROOT}/cadence-core/references/reviewer-brief.md"\n'
    + '```\n';
  put(root, ROUTER, body);
  assert.deepEqual(referenceRouterIssues(root, ROW), []);
});

test('an INDENTED fence still hides its contents', () => {
  // review-triggers.md's composer block is indented under a bullet. A
  // column-0-only fence matcher reads that whole block as prose, which is the
  // exact tree this exclusion exists for.
  const root = fixtureRoot();
  put(root, COLD, '# cold\n');
  put(root, ROUTER, `# router\n\n${readLine(COLD)}\n\n`
    + '  ```\n'
    + '  node -e \'...\' "${CLAUDE_PLUGIN_ROOT}/cadence-core/references/reviewer-brief.md"\n'
    + '  ```\n');
  assert.deepEqual(referenceRouterIssues(root, ROW), []);
});

test('a path AFTER a fence closes is prose again', () => {
  // The falsifier for the exclusion above: a fence that swallowed the rest of
  // the file would make arm 3 vacuous from its first code block on.
  const root = fixtureRoot();
  put(root, COLD, '# cold\n');
  put(root, ROUTER, `# router\n\n${readLine(COLD)}\n\n`
    + '```\n'
    + 'echo hello\n'
    + '```\n\n'
    + `${readLine('cadence-core/references/stowaway.md')}\n`);
  assert.deepEqual(kinds(referenceRouterIssues(root, ROW)), [CODES.unregistered]);
});

test('a path outside cadence-core/references is not a branch', () => {
  // Workflows, templates and scripts are named by routers all the time; only a
  // reference can be a cold branch of one.
  const root = fixtureRoot();
  put(root, COLD, '# cold\n');
  put(root, ROUTER, `# router\n\n${readLine(COLD)}\n\n`
    + `${readLine('cadence-core/workflows/verify-deep.md')}\n`
    + '`${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/route.mjs` resolve\n');
  assert.deepEqual(referenceRouterIssues(root, ROW), []);
});

test('arm 3 reads the ROUTER a row names, never every router at once', () => {
  // Two routers, each declaring its own cold file. Neither may be reported for
  // the other's branch, or splitting a second reference would redden the first.
  const root = fixtureRoot();
  const routerB = 'cadence-core/references/router-b.md';
  const coldB = 'cadence-core/references/cold-b.md';
  put(root, COLD, '# cold\n');
  put(root, coldB, '# cold b\n');
  put(root, ROUTER, `# router\n\n${readLine(COLD)}\n`);
  put(root, routerB, `# router b\n\n${readLine(coldB)}\n`);
  assert.deepEqual(referenceRouterIssues(root, [
    ...ROW,
    { router: routerB, branch: 'b', cold: coldB },
  ]), []);
});

// --- scope --------------------------------------------------------------------

test('a root with no cadence-core/references contributes nothing', () => {
  // A `--root` fixture supplying its own tiny surface set is not an install
  // with a deleted reference, the same degradation deferredReadIssues makes on
  // an absent skills/.
  const root = mkdtempSync(join(tmpdir(), 'cad-routers-bare-'));
  assert.deepEqual(referenceRouterIssues(root, ROW), []);
});

test('a clean fixture reports nothing', () => {
  const root = fixtureRoot();
  put(root, COLD, '# cold\n');
  put(root, ROUTER, `# router\n\n${readLine(COLD)}\n`);
  assert.deepEqual(referenceRouterIssues(root, ROW), []);
});
