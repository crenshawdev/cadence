// Zero-dep tests for issue-check.mjs (the /cad-land tracker-report seam,
// LND-01). Run: node --test cadence-core/bin/issue-check.test.mjs.
//
// Harness: a REAL temp git repo per case (origin URL + commits referencing
// issues), plus stub `gh` / `glab` / `tea` executables in a temp dir prepended
// to the CHILD's PATH. PATH injection is what lets the gitlab arm be proved
// with no `glab` installed on this machine, and it exercises the PRODUCTION
// resolver rather than a test-only branch beside it. The env-injection style is
// land-cleanup.test.mjs's (CADENCE_GLOBAL_CONFIG), extended by one variable.
//
// Every stub also appends its own name to $CAD_SPAWN_MARKER, so "no forge CLI
// ran" is an assertion about the filesystem rather than about an empty list.
//
// `stub` is EXPORTED for that second reason: git-publish.test.mjs proves its
// GitLab authorization arm reaches an answer with NO forge CLI spawned, and the
// only honest way to assert that is the same stub-on-PATH + marker-file
// convention this file already owns. A copy of the harness there would be a
// second thing to keep in step with the seam's resolver. Importing a test file
// also REGISTERS its arms in the importing process, so `test` is bound to a
// no-op unless this module IS the entry file - the discipline
// config-seams.test.mjs states at length, for the same reason.
import { test as nodeTest } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, chmodSync, existsSync, statSync, symlinkSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

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

const SEAM = join(dirname(fileURLToPath(import.meta.url)), 'issue-check.mjs');
const NO_GLOBAL = join(mkdtempSync(join(tmpdir(), 'cad-ic-')), 'no-global.json');

const GH_BODY = '[{"number":42,"state":"OPEN"},{"number":47,"state":"CLOSED"},{"number":99,"state":"OPEN"}]';
const GLAB_BODY = '[{"id":1,"iid":42,"state":"opened"},{"id":2,"iid":47,"state":"closed"},{"id":3,"iid":99,"state":"opened"}]';
const TEA_BODY = '[{"index":"42","state":"open"},{"index":"47","state":"closed"},{"index":"99","state":"open"}]';
const TEA_LOGINS = '[{"name":"forge.example.com","url":"https://forge.example.com","ssh_host":"forge.example.com","user":"t"}]';

/** A shell stub on PATH: records its argv, then prints `body` and exits `code`.
 *  `sleep` seconds before printing proves the call bound. `login` is the body
 *  the `tea login list` probe gets, so ONE `tea` stub answers every argv shape
 *  the seam sends it. `issue` is the OPTIONAL third shape - a `{number: body}`
 *  map answering `tea issues <index>`, where a number the map does not hold
 *  exits 1 with no output, which is what tea does for an issue that is not
 *  there. Both extras default to null, so the existing callers (including
 *  git-publish.test.mjs, which imports this) are untouched. */
export function stub(dir, name, { body = '', login = null, issue = null, code = 0, sleep = 0, stderr = '' } = {}) {
  // `echo`, never a `cat` heredoc: under `bare: true` the child's PATH holds
  // git and nothing else, and /bin/sh has no `cat` builtin - a heredoc stub
  // silently printed nothing there and every bare case degraded for the wrong
  // reason (caught 2026-08-15 by the reason-uniqueness assertion below).
  const heredoc = (text) => `echo '${String(text).replace(/'/g, `'\\''`)}'`;
  const script = ['#!/bin/sh',
    '[ -n "$CAD_SPAWN_MARKER" ] && echo "' + name + '" >> "$CAD_SPAWN_MARKER"',
    '[ -n "$CAD_ARGV_LOG" ] && echo "' + name + ' $*" >> "$CAD_ARGV_LOG"',
    login === null ? '' : `if [ "$1" = "login" ]; then\n${heredoc(login)}\nexit 0\nfi`,
    issue === null ? '' : [
      'if [ "$1" = "issues" ] && [ "$2" != "list" ]; then',
      'case "$2" in',
      ...Object.entries(issue).map(([n, b]) => `${n}) ${heredoc(b)}; exit 0 ;;`),
      '*) exit 1 ;;',
      'esac',
      'fi',
    ].join('\n'),
    sleep ? `sleep ${sleep}` : '',
    stderr ? `printf '%s' ${JSON.stringify(stderr)} >&2` : '',
    body ? heredoc(body) : '',
    `exit ${code}`,
  ].join('\n');
  const file = join(dir, name);
  writeFileSync(file, script);
  chmodSync(file, 0o755);
}

/** A temp git repo: `.planning/config.json` from `gitConfig`, an `origin`
 *  pointing at `originUrl`, and one commit per message in `commits` on a branch
 *  off `main`. */
function repo({ originUrl, commits = [], gitConfig = {} }) {
  const dir = mkdtempSync(join(tmpdir(), 'cad-ic-repo-'));
  mkdirSync(join(dir, '.planning'), { recursive: true });
  writeFileSync(join(dir, '.planning', 'config.json'), JSON.stringify({ git: gitConfig }));
  const g = (...a) => execFileSync('git', ['-C', dir, ...a], {
    stdio: 'ignore',
    env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' },
  });
  g('init', '-q');
  g('config', 'user.email', 'test@example.com');
  g('config', 'user.name', 'test');
  g('config', 'commit.gpgsign', 'false');
  writeFileSync(join(dir, 'seed.txt'), 'seed');
  g('add', '-A');
  g('commit', '-q', '-m', 'init');
  g('branch', '-M', 'main');
  if (originUrl) g('remote', 'add', 'origin', originUrl);
  g('checkout', '-q', '-b', 'work');
  commits.forEach((msg, i) => {
    writeFileSync(join(dir, `w${i}.txt`), String(i));
    g('add', '-A');
    g('commit', '-q', '-m', msg);
  });
  return dir;
}

/** A directory holding ONLY a symlink to the real `git`. A case about an
 *  ABSENT forge CLI cannot inherit the dev box's PATH - `gh` and `tea` are
 *  installed at /usr/bin here - so `bare: true` builds the child's PATH out of
 *  the stub dir plus this one, and nothing else resolves. */
const GIT_ONLY = (() => {
  const dir = mkdtempSync(join(tmpdir(), 'cad-ic-git-'));
  for (const d of (process.env.PATH || '').split(':')) {
    if (!d) continue;
    try { statSync(join(d, 'git')); symlinkSync(join(d, 'git'), join(dir, 'git')); return dir; }
    catch { /* next */ }
  }
  throw new Error('no git on PATH to link');
})();

/** Run the seam and keep the EXIT STATUS: the degradation matrix asserts
 *  status 0 on every path, because a nonzero exit is a failed land rather than
 *  a degraded report. `stubs` are built into a fresh dir prepended to the
 *  child's PATH; `cwd` defaults to a directory that is NOT the repo, so nothing
 *  can pass by inferring the repository from the process cwd. */
function seamRun(args, { stubs = {}, cwd = tmpdir(), marker = null, argvLog = null, bare = false } = {}) {
  const stubDir = mkdtempSync(join(tmpdir(), 'cad-ic-bin-'));
  for (const [name, opts] of Object.entries(stubs)) stub(stubDir, name, opts);
  const env = {
    ...process.env,
    CADENCE_GLOBAL_CONFIG: NO_GLOBAL,
    PATH: stubDir + ':' + (bare ? GIT_ONLY : process.env.PATH),
  };
  if (marker) env.CAD_SPAWN_MARKER = marker;
  if (argvLog) env.CAD_ARGV_LOG = argvLog;
  // process.execPath, not 'node': under `bare` the child PATH has no node on it.
  try {
    return { status: 0, envelope: JSON.parse(execFileSync(process.execPath, [SEAM, ...args], { encoding: 'utf8', env, cwd })) };
  } catch (e) {
    return { status: e.status, envelope: JSON.parse(e.stdout) };
  }
}

/** seamRun's envelope alone, for the cases that do not assert the status. */
function seam(args, opts) { return seamRun(args, opts).envelope; }

const COMMITS = ['feat: first cut (#42)', 'fix: closes #47', 'docs: mention #42 again', 'chore: fixes #99'];

// --- the three hosts report referenced numbers WITH their states ------------

const HOSTS = [
  ['github', 'https://github.com/org/repo.git', 'github.com', { gh: { body: GH_BODY } }],
  ['gitlab', 'git@gitlab.com:org/repo.git', 'gitlab.com', { glab: { body: GLAB_BODY } }],
  // The scp-shaped and ported URL forms ride here too, and the forgejo arm's
  // ONE `tea` stub answers the login probe and the issue list from one file.
  ['forgejo', 'ssh://git@forge.example.com:2222/org/repo.git', 'forge.example.com',
    { tea: { body: TEA_BODY, login: TEA_LOGINS } }],
];

for (const [name, originUrl, host, stubs] of HOSTS) {
  test(`${name}: the report names each referenced issue with its state, plus the open list`, () => {
    const dir = repo({ originUrl, commits: COMMITS });
    const r = seam(['check', '--dir', dir, '--base', 'main'], { stubs });
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.equal(r.action, 'report', JSON.stringify(r));
    assert.equal(r.host, host);
    assert.equal(r.repo, 'org/repo');
    assert.deepEqual(r.referenced, [
      { number: 42, state: 'open' }, { number: 47, state: 'closed' }, { number: 99, state: 'open' },
    ], JSON.stringify(r));
    assert.deepEqual(r.open, [42, 99]);
    assert.deepEqual(r.warnings, []);
  });
}

// --- the SSH endpoint that is not the web host ------------------------------
//
// This repository's own shape (TRK-01, D-12): origin
// `ssh://git@ssh.jcrenshaw.dev:2222/...` while `tea login list` names
// `git.jcrenshaw.dev` in all three of its host fields, so nothing matches by
// host equality and every land skips. The HOSTS table above cannot cover it -
// all three of its forgejo login fields EQUAL the origin host - which is why
// the suite stayed green while the repository the seam was built in skipped.
// A separate SSH endpoint on a non-standard port is a normal deployment shape.

const SPLIT_ORIGIN = 'ssh://git@ssh.example.com:2222/org/repo.git';

test('forgejo: an SSH host that differs from the login host still reports', () => {
  const dir = repo({ originUrl: SPLIT_ORIGIN, commits: COMMITS });
  const r = seam(['check', '--dir', dir, '--base', 'main'],
    { stubs: { tea: { body: TEA_BODY, login: TEA_LOGINS } }, bare: true });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.action, 'report', JSON.stringify(r));
  // The envelope names the ORIGIN's own host, never the login's: it is what the
  // user configured, and it is what a degradation line would have had to name.
  assert.equal(r.host, 'ssh.example.com');
  assert.equal(r.repo, 'org/repo');
  assert.deepEqual(r.referenced, [
    { number: 42, state: 'open' }, { number: 47, state: 'closed' }, { number: 99, state: 'open' },
  ], JSON.stringify(r));
  assert.deepEqual(r.open, [42, 99]);
  assert.deepEqual(r.warnings, []);
});

test('a branch referencing NO issue still reports the open list as the fallback', () => {
  const dir = repo({ originUrl: 'https://github.com/org/repo.git', commits: ['chore: no refs here'] });
  const r = seam(['check', '--dir', dir, '--base', 'main'], { stubs: { gh: { body: GH_BODY } } });
  assert.equal(r.action, 'report');
  assert.deepEqual(r.referenced, []);
  assert.deepEqual(r.open, [42, 99]);
});

// --- the call is bound to the repository --dir names ------------------------

test('the forge call names the --dir repo, not the one the process cwd sits in', () => {
  // A cwd-only implementation passes an assertion about the emitted numbers,
  // because a PATH stub ignores its cwd. So the selector is asserted directly
  // against the argv the stub recorded.
  const target = repo({ originUrl: 'https://github.com/target-org/target-repo.git', commits: COMMITS });
  const elsewhere = repo({ originUrl: 'https://github.com/other-org/other-repo.git', commits: ['chore: x'] });
  const argvLog = join(mkdtempSync(join(tmpdir(), 'cad-ic-argv-')), 'argv.log');
  const r = seam(['check', '--dir', target, '--base', 'main'],
    { stubs: { gh: { body: GH_BODY } }, cwd: elsewhere, argvLog });
  assert.equal(r.action, 'report');
  assert.equal(r.repo, 'target-org/target-repo');
  const recorded = readFileSync(argvLog, 'utf8');
  assert.match(recorded, /--repo target-org\/target-repo/, recorded);
  assert.ok(!recorded.includes('other-org'), recorded);
  // The paging flag rides the real call, not just the table's unit test.
  assert.match(recorded, /--limit 200/, recorded);
});

// --- the call bound ---------------------------------------------------------

test('a forge CLI that never returns is killed at the bound and the land continues', () => {
  const dir = repo({ originUrl: 'https://github.com/org/repo.git', commits: COMMITS });
  const started = Date.now();
  const r = seam(['check', '--dir', dir, '--base', 'main', '--timeout-ms', '500'],
    { stubs: { gh: { body: GH_BODY, sleep: 30 } } });
  const elapsed = Date.now() - started;
  assert.equal(r.ok, true);
  assert.equal(r.action, 'skip');
  assert.deepEqual(r.referenced, []);
  assert.deepEqual(r.open, []);
  assert.match(r.reason, /call bound/);
  assert.ok(elapsed < 5000, `the whole invocation must finish well inside the land: ${elapsed}ms`);
});

test('unknown subcommand: usage', () => {
  const r = seam(['frobnicate']);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'usage');
});

// --- the degradation matrix -------------------------------------------------
//
// Every path the requirement names, fault-injected, each asserting what the
// CALLER sees: exit status 0, ok:true, a reason unique across the matrix, and
// NOTHING claimed about issues. The uniqueness is the point - cad-land prints
// `reason` verbatim, so two paths sharing a line is a user who cannot tell a
// missing login from a missing CLI.

const ALL_STUBS = { gh: { body: GH_BODY }, glab: { body: GLAB_BODY }, tea: { body: TEA_BODY, login: TEA_LOGINS } };
const GH_REPO = 'https://github.com/org/repo.git';
const FORGE_REPO = 'https://forge.example.com/org/repo.git';
/** 50 rows is exactly tea's page, so the response FILLS it (see the limits in
 *  lib/issue-decision.mjs's header, measured against a live Gitea 2026-08-15). */
const TEA_FULL_PAGE = JSON.stringify(
  Array.from({ length: 50 }, (_, i) => ({ index: String(i + 1), state: 'open' })));

// [name, reason pattern, build, expected action]. Every path is a `skip`
// except the key set to false, which is `off`: the user's own switch is not a
// degradation, and cad-land prints nothing for it.
const DEGRADATIONS = [
  ['the key is off', /issue_check is off/, () => ({
    args: ['check', '--dir', repo({ originUrl: GH_REPO, commits: COMMITS, gitConfig: { issue_check: false } }), '--base', 'main'],
    opts: { stubs: ALL_STUBS },
  }), 'off'],
  ['no origin remote', /no origin remote/, () => ({
    args: ['check', '--dir', repo({ originUrl: null, commits: COMMITS }), '--base', 'main'],
    opts: { stubs: ALL_STUBS },
  })],
  // Neither github nor gitlab, and no tea reading exists to recognize it.
  ['unrecognized host', /neither github nor gitlab/, () => ({
    args: ['check', '--dir', repo({ originUrl: FORGE_REPO, commits: COMMITS }), '--base', 'main'],
    opts: { bare: true },
  })],
  // The SAME host, with tea present and answering - no login for it is its own
  // reason, because the fix is a login rather than a different remote.
  ['no tea login', /tea holds no login/, () => ({
    args: ['check', '--dir', repo({ originUrl: FORGE_REPO, commits: COMMITS }), '--base', 'main'],
    opts: { stubs: { tea: { body: TEA_BODY, login: '[]' } }, bare: true },
  })],
  ['the resolved binary is absent', /gh CLI is not on PATH/, () => ({
    args: ['check', '--dir', repo({ originUrl: GH_REPO, commits: COMMITS }), '--base', 'main'],
    opts: { bare: true },
  })],
  ['the CLI exits nonzero', /exited nonzero/, () => ({
    args: ['check', '--dir', repo({ originUrl: GH_REPO, commits: COMMITS }), '--base', 'main'],
    opts: { stubs: { gh: { code: 1, stderr: 'gh: could not authenticate' } } },
  })],
  // Exit ZERO, and a response that filled its page: a truncated read and an
  // empty tracker carry the same records, so this may not reach the partition.
  ['a response truncated at the page limit', /filled the 50-row page/, () => ({
    args: ['check', '--dir', repo({ originUrl: FORGE_REPO, commits: COMMITS }), '--base', 'main'],
    opts: { stubs: { tea: { body: TEA_FULL_PAGE, login: TEA_LOGINS } }, bare: true },
  })],
  ['a response with a renamed field', /no readable number\/state/, () => ({
    args: ['check', '--dir', repo({ originUrl: GH_REPO, commits: COMMITS }), '--base', 'main'],
    opts: { stubs: { gh: { body: '[{"id":42,"status":"OPEN"}]' } } },
  })],
  // The ref scan itself: a --base this repo does not have.
  ['the ref scan fails', /could not be read/, () => ({
    args: ['check', '--dir', repo({ originUrl: GH_REPO, commits: COMMITS }), '--base', 'no-such-ref'],
    opts: { stubs: ALL_STUBS },
  })],
];

const SEEN_REASONS = new Map();

for (const [name, pattern, build, action = 'skip'] of DEGRADATIONS) {
  test(`degrades in ONE line: ${name}`, () => {
    const { args, opts } = build();
    const { status, envelope } = seamRun(args, opts);
    assert.equal(status, 0, `${name} must not fail the land`);
    assert.equal(envelope.ok, true, JSON.stringify(envelope));
    assert.equal(envelope.action, action, JSON.stringify(envelope));
    assert.match(envelope.reason, pattern, envelope.reason);
    assert.ok(!envelope.reason.includes('\n'), `one line, not several: ${envelope.reason}`);
    // A seam never returns an affirmative answer about input it could not read
    // (GAT-01, decideGateHalt's JSDoc).
    assert.deepEqual(envelope.referenced, [], name);
    assert.deepEqual(envelope.open, [], name);
    // No third-party bytes ride along beside the line: neither git's stderr on
    // the ref-scan arm nor the forge CLI's on the nonzero one.
    assert.equal(envelope.detail, null, `${name} carried a detail: ${envelope.detail}`);
    assert.ok(!SEEN_REASONS.has(envelope.reason),
      `${name} reuses the line ${SEEN_REASONS.get(envelope.reason)} prints`);
    SEEN_REASONS.set(envelope.reason, name);
  });
}

// Beside the matrix rather than inside it: the matrix keeps ONE row per
// degradation class (AC5), and this is the same `no-login` class asserted from
// the other side - what the seam must NOT do once host equality stops being the
// test. tea's `--repo` fallback is config-FILE-ORDER, not repo-aware (D-07), so
// an unguarded call resolves to whichever login sits first in the user's config
// and can return another project's issues as this one's, exit 0 and all.
test('an origin sharing no registrable domain with any login skips, and queries nothing', () => {
  const dir = repo({ originUrl: 'https://git.stranger.org/org/repo.git', commits: COMMITS });
  const marker = join(mkdtempSync(join(tmpdir(), 'cad-ic-mark-')), 'spawned.log');
  const argvLog = join(mkdtempSync(join(tmpdir(), 'cad-ic-argv-')), 'argv.log');
  const { status, envelope } = seamRun(['check', '--dir', dir, '--base', 'main'],
    { stubs: { tea: { body: TEA_BODY, login: TEA_LOGINS } }, bare: true, marker, argvLog });
  assert.equal(status, 0, 'a stranger host must not fail the land');
  assert.equal(envelope.ok, true, JSON.stringify(envelope));
  assert.equal(envelope.action, 'skip', JSON.stringify(envelope));
  assert.equal(envelope.reason, 'tea holds no login for git.stranger.org: no tracker report');
  assert.deepEqual(envelope.referenced, []);
  assert.deepEqual(envelope.open, []);
  // One tea spawn, and its argv is the login probe alone - no issue query went
  // out against a forge that shares nothing with this remote.
  assert.deepEqual(readFileSync(marker, 'utf8').trim().split('\n'), ['tea']);
  assert.deepEqual(readFileSync(argvLog, 'utf8').trim().split('\n'),
    ['tea login list --output json'], readFileSync(argvLog, 'utf8'));
});

// --- the open list plus a bounded per-issue resolve (the forgejo row alone) --
//
// The list call names only OPEN issues: the server clamps a `--state all` page
// at 50 rows whatever `--limit` asks for, so on a real tracker the read was
// honestly incomplete and the whole report degraded (D-08). What that costs is
// that a referenced number missing from the list is closed OR absent, and one
// bounded `tea issues <index>` per unanswered number tells those apart.

const TEA_OPEN_BODY = '[{"index":"42","state":"open"},{"index":"99","state":"open"}]';

// Matching a login is only half the guard. `tea` resolves an unqualified
// `--repo <owner>/<name>` in config FILE ORDER (D-07), so a seam that proved
// only that SOME login could serve this origin would send its query to
// whichever login sits first - here a deliberately unrelated one - and report
// another server's issues as this repository's, exit 0 and all.
const TWO_LOGINS = JSON.stringify([
  { name: 'evil.example.net', url: 'https://evil.example.net', ssh_host: 'evil.example.net', user: 't' },
  { name: 'forge.example.com', url: 'https://forge.example.com', ssh_host: 'forge.example.com', user: 't' },
]);

test('forgejo: every call is bound with --login to the login that matched', () => {
  const dir = repo({
    originUrl: SPLIT_ORIGIN,
    commits: [...COMMITS, 'chore: mentions #4242, which never existed'],
  });
  const argvLog = join(mkdtempSync(join(tmpdir(), 'cad-ic-argv-')), 'argv.log');
  const r = seam(['check', '--dir', dir, '--base', 'main'], {
    stubs: { tea: { body: TEA_OPEN_BODY, login: TWO_LOGINS, issue: { 47: '{"index":47,"state":"closed"}' } } },
    bare: true, argvLog,
  });
  assert.equal(r.action, 'report', JSON.stringify(r));
  assert.equal(r.host, 'ssh.example.com');
  const lines = readFileSync(argvLog, 'utf8').trim().split('\n');
  // The list call and EVERY resolve name the second login - the one that shares
  // the origin's registrable domain - never the first one in the config.
  const queries = lines.filter((l) => l.startsWith('tea issues'));
  assert.equal(queries.length, 3, lines.join('\n'));
  for (const q of queries) {
    assert.match(q, /--login forge\.example\.com(\s|$)/, q);
    assert.ok(!q.includes('evil.example.net'), q);
  }
  assert.equal(queries.filter((q) => q.startsWith('tea issues list')).length, 1, lines.join('\n'));
});

test('forgejo: a number the open list missed resolves, or is named unresolved', () => {
  const dir = repo({
    originUrl: FORGE_REPO,
    commits: [...COMMITS, 'chore: mentions #4242, which never existed'],
  });
  const argvLog = join(mkdtempSync(join(tmpdir(), 'cad-ic-argv-')), 'argv.log');
  const r = seam(['check', '--dir', dir, '--base', 'main'], {
    stubs: { tea: { body: TEA_OPEN_BODY, login: TEA_LOGINS, issue: { 47: '{"index":47,"state":"closed"}' } } },
    bare: true, argvLog,
  });
  assert.equal(r.action, 'report', JSON.stringify(r));
  assert.deepEqual(r.referenced, [
    { number: 42, state: 'open' },
    { number: 47, state: 'closed' },       // from a resolve; the list never named it
    { number: 99, state: 'open' },
    // tea exits nonzero for an absent issue AND for a failed read, and this
    // seam discards child stderr - so this may never be reported not-found.
    { number: 4242, state: 'unresolved' },
  ], JSON.stringify(r));
  assert.deepEqual(r.open, [42, 99]);
  const lines = readFileSync(argvLog, 'utf8').trim().split('\n');
  const list = lines.filter((l) => l.startsWith('tea issues list'));
  assert.equal(list.length, 1, lines.join('\n'));
  assert.match(list[0], /--state open/, list[0]);
  // Exactly one resolve per unanswered number, and none for an answered one.
  assert.deepEqual(lines.filter((l) => /^tea issues \d/.test(l)), [
    'tea issues 47 --repo org/repo --login forge.example.com --fields index,state --output json',
    'tea issues 4242 --repo org/repo --login forge.example.com --fields index,state --output json',
  ], lines.join('\n'));
});

test('forgejo: the resolve stops at its cap, and the remainder are unresolved', () => {
  const refs = [201, 202, 203, 204, 205, 206, 207, 208];
  // The stub would answer `closed` for ALL eight, so the cap is the only thing
  // that can make the last three unresolved.
  const issue = Object.fromEntries(refs.map((n) => [n, `{"index":${n},"state":"closed"}`]));
  const dir = repo({ originUrl: FORGE_REPO, commits: refs.map((n) => `chore: touches #${n}`) });
  const argvLog = join(mkdtempSync(join(tmpdir(), 'cad-ic-argv-')), 'argv.log');
  const r = seam(['check', '--dir', dir, '--base', 'main'], {
    stubs: { tea: { body: '[{"index":"42","state":"open"}]', login: TEA_LOGINS, issue } },
    bare: true, argvLog,
  });
  assert.equal(r.action, 'report', JSON.stringify(r));
  assert.deepEqual(r.referenced,
    refs.map((n, i) => ({ number: n, state: i < 5 ? 'closed' : 'unresolved' })), JSON.stringify(r));
  const resolves = readFileSync(argvLog, 'utf8').trim().split('\n').filter((l) => /^tea issues \d/.test(l));
  assert.equal(resolves.length, 5, resolves.join('\n'));
});

test('the key-off arm spawns NO forge CLI at all, not merely an empty report', () => {
  // A test reading only the reason and the empty list also passes an
  // implementation that probed `tea login list` before consulting the key. So
  // every stub on PATH appends its name to a marker file, and the assertion is
  // that the file was never created.
  const dir = repo({ originUrl: FORGE_REPO, commits: COMMITS, gitConfig: { issue_check: false } });
  const marker = join(mkdtempSync(join(tmpdir(), 'cad-ic-mark-')), 'spawned.log');
  const r = seam(['check', '--dir', dir, '--base', 'main'], { stubs: ALL_STUBS, marker });
  // `off`, never `skip`: SKILL.md step 1 prints every skip reason verbatim, so
  // an off switch answering `skip` would print a tracker line on every land -
  // which is exactly what the key is set to false to stop.
  assert.equal(r.action, 'off', JSON.stringify(r));
  assert.match(r.reason, /issue_check is off/);
  assert.equal(existsSync(marker), false,
    `no forge CLI may run under issue_check:false, but one wrote: ${existsSync(marker) ? readFileSync(marker, 'utf8') : ''}`);

  // The control: the same repo with the key ON does reach a stub, so the
  // assertion above is about the key and not about a marker that never works.
  const on = repo({ originUrl: FORGE_REPO, commits: COMMITS });
  const marker2 = join(mkdtempSync(join(tmpdir(), 'cad-ic-mark-')), 'spawned.log');
  seam(['check', '--dir', on, '--base', 'main'], { stubs: ALL_STUBS, marker: marker2 });
  assert.equal(existsSync(marker2), true);
  assert.match(readFileSync(marker2, 'utf8'), /tea/);
});

test('a token-carrying CLI stderr never reaches the envelope, in ANY shape', () => {
  // EXP-01, tightened: redactUrl covers a credential in URL POSITION, so the
  // three shapes below would have travelled through it untouched. The seam
  // therefore carries NO third-party stderr at all - the reason line already
  // names the degradation - and this asserts that over the whole envelope
  // rather than over the `detail` field alone.
  const SECRETS = [
    'ghs_notarealtoken',            // inside a credentialed URL: redactUrl's own case
    'ghp_alsonotarealtoken',        // a bare env-var assignment
    'glpat-stillnotarealtoken',     // a bare forge token
    'notarealbearertokenvalue',     // an Authorization header
  ];
  const dir = repo({ originUrl: GH_REPO, commits: COMMITS });
  const r = seam(['check', '--dir', dir, '--base', 'main'], {
    stubs: { gh: { code: 1, stderr: [
      'fatal: https://x-access-token:ghs_notarealtoken@github.com/org/repo.git rejected',
      'GITHUB_TOKEN=ghp_alsonotarealtoken',
      'GLAB_TOKEN=glpat-stillnotarealtoken',
      'Authorization: Bearer notarealbearertokenvalue',
    ].join('\n') } },
  });
  assert.equal(r.ok, true);
  assert.equal(r.action, 'skip');
  assert.match(r.reason, /exited nonzero/);
  assert.equal(r.detail, null, JSON.stringify(r));
  const wire = JSON.stringify(r);
  for (const secret of SECRETS) assert.ok(!wire.includes(secret), `${secret} reached the envelope: ${wire}`);
});
