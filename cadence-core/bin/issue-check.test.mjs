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
 *  the `tea login list` probe gets, so ONE `tea` stub answers both argv shapes
 *  the seam sends it. */
export function stub(dir, name, { body = '', login = null, code = 0, sleep = 0, stderr = '' } = {}) {
  // `echo`, never a `cat` heredoc: under `bare: true` the child's PATH holds
  // git and nothing else, and /bin/sh has no `cat` builtin - a heredoc stub
  // silently printed nothing there and every bare case degraded for the wrong
  // reason (caught 2026-08-15 by the reason-uniqueness assertion below).
  const heredoc = (text) => `echo '${String(text).replace(/'/g, `'\\''`)}'`;
  const script = ['#!/bin/sh',
    '[ -n "$CAD_SPAWN_MARKER" ] && echo "' + name + '" >> "$CAD_SPAWN_MARKER"',
    '[ -n "$CAD_ARGV_LOG" ] && echo "' + name + ' $*" >> "$CAD_ARGV_LOG"',
    login === null ? '' : `if [ "$1" = "login" ]; then\n${heredoc(login)}\nexit 0\nfi`,
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
