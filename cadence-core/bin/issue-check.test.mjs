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
// A login whose `ssh_host` names the SSH endpoint while its name and url name
// the web host - the split-endpoint shape this repository has, and the shape
// the guard in classifyOrigin needs before it will let the call be made.
const TEA_LOGINS = '[{"name":"forge.example.com","url":"https://forge.example.com","ssh_host":"ssh.example.com","user":"t"}]';

/** A shell stub on PATH: records its argv, then prints `body` and exits `code`.
 *  `sleep` seconds before printing proves the call bound. `login` is the body
 *  the `tea login list` probe gets, so ONE `tea` stub answers every argv shape
 *  the seam sends it. `issue` is the OPTIONAL third shape - a `{number: body}`
 *  map answering `tea issues <index>`, where a number the map does not hold
 *  exits 1 with no output, which is what tea does for an issue that is not
 *  there. `issueSleep` sleeps that many seconds on THAT unmatched arm alone,
 *  which is what a slow tracker looks like to the resolve loop while the list
 *  call it follows still answers at once - `sleep` would slow both. Both extras
 *  default to null and issueSleep to 0, so the existing callers (including
 *  git-publish.test.mjs, which imports this) are untouched. */
export function stub(dir, name, { body = '', login = null, issue = null, issueSleep = 0, code = 0, sleep = 0, stderr = '' } = {}) {
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
      `*) ${issueSleep ? `sleep ${issueSleep}; ` : ''}exit 1 ;;`,
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

/** The forge record project setup would have PERSISTED for this origin, which
 *  is what the seam resolves now (phase 1 D-01) - it reads no origin URL at
 *  all. Derived here rather than hand-written at 40 call sites, and derived the
 *  same way `forge.mjs detect` derives its DEFAULTS, so a fixture cannot claim
 *  a record setup could not have produced. `forgejo` gets the origin's own
 *  hostname as its instance host; the cases that care about a browser host
 *  differing from an SSH endpoint pass `forge` explicitly.
 *  @param {string|null|undefined} originUrl */
function forgeFor(originUrl) {
  if (!originUrl) return {};
  const m = /^(?:[A-Za-z][A-Za-z0-9+.-]*:\/\/)?(?:[^@/]*@)?([^/:]+)[:/](?::\d+\/)?(.+?)(?:\.git)?$/.exec(originUrl);
  if (!m) return {};
  const host = m[1].toLowerCase();
  const slug = m[2].replace(/^\d+\//, '');
  if (host === 'github.com') return { forge_provider: 'github', forge_repo: slug };
  if (host === 'gitlab.com') return { forge_provider: 'gitlab', forge_repo: slug };
  return { forge_provider: 'forgejo', forge_repo: slug, forge_host: host };
}

/** A temp git repo: `.planning/config.json` from `gitConfig`, an `origin`
 *  pointing at `originUrl`, and one commit per message in `commits` on a branch
 *  off `main`.
 *
 *  The forge keys are DERIVED from `originUrl` unless `gitConfig` already names
 *  a provider - so a case that wants an unconfigured repository, or a record
 *  that disagrees with the remote, says so and every other case reads as it
 *  always did. `forge: null` suppresses the derivation outright. */
function repo({ originUrl, commits = [], gitConfig = {}, forge }) {
  const dir = mkdtempSync(join(tmpdir(), 'cad-ic-repo-'));
  mkdirSync(join(dir, '.planning'), { recursive: true });
  const derived = forge === null ? {} : (forge || forgeFor(originUrl));
  const git = gitConfig.forge_provider !== undefined ? gitConfig : { ...derived, ...gitConfig };
  writeFileSync(join(dir, '.planning', 'config.json'), JSON.stringify({ git }));
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

// The third cell is the envelope's `host`, which is now the PERSISTED
// `git.forge_host` and nothing else - so it is null on github and gitlab, whose
// hosts are fixed and which name no instance key. The seam reads no origin URL
// at all; the URL is here because `repo()` derives the record setup would have
// persisted from it, and because a real repository has one.
const HOSTS = [
  ['github', 'https://github.com/org/repo.git', null, { gh: { body: GH_BODY } }],
  ['gitlab', 'git@gitlab.com:org/repo.git', null, { glab: { body: GLAB_BODY } }],
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

test('a protected_branches naming NO branch still names the referenced issues (GRD-01, D-02)', () => {
  // With no --base and no git.base_branch, the base falls back to
  // resolveProtectedBranches(git)[0] and is spent on `git log <base>..HEAD`.
  // `""` used to resolve to [""], so the range became `..HEAD`, git read the
  // empty side as HEAD, the log came back empty and the report named NO issue
  // while still answering ok:true - a silently empty report, not a failure.
  // Assert the NUMBERS: the pre-fix tree also answers action "report".
  const dir = repo({
    originUrl: 'https://github.com/org/repo.git',
    commits: COMMITS,
    gitConfig: { protected_branches: '' },
  });
  const r = seam(['check', '--dir', dir], { stubs: { gh: { body: GH_BODY } } });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.action, 'report', JSON.stringify(r));
  assert.deepEqual(r.referenced, [
    { number: 42, state: 'open' }, { number: 47, state: 'closed' }, { number: 99, state: 'open' },
  ], JSON.stringify(r));
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

// The cut that gave the forgejo row `--remote origin` touched no other row, and
// this is the assertion that says so in the strongest available form: the whole
// recorded command line, byte for byte, for the two hosts whose binding did not
// change. A regression here is a flag that leaked across rows.

test('the github and gitlab argv are byte-identical to what they were', () => {
  for (const [originUrl, stubs, expected] of [
    ['https://github.com/org/repo.git', { gh: { body: GH_BODY } },
      'gh issue list --repo org/repo --state all --json number,state --limit 200'],
    ['git@gitlab.com:org/repo.git', { glab: { body: GLAB_BODY } },
      'glab issue list --repo org/repo --all --output json --per-page 100'],
  ]) {
    const dir = repo({ originUrl, commits: COMMITS });
    const argvLog = join(mkdtempSync(join(tmpdir(), 'cad-ic-argv-')), 'argv.log');
    const r = seam(['check', '--dir', dir, '--base', 'main'], { stubs, argvLog });
    assert.equal(r.action, 'report', JSON.stringify(r));
    assert.deepEqual(readFileSync(argvLog, 'utf8').trim().split('\n'), [expected]);
  }
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
  // ONE arm where there were two. `no origin remote` and `unrecognized host`
  // both said how the origin URL failed to classify, which is not a thing a
  // user acts on; this says which keys to set (phase 1 D-01). A repository
  // WITH a perfectly good origin lands here when the record is unset, which is
  // the whole point: config decides, not the remote.
  ['no forge configured', /no forge configured \(git\.forge_provider, git\.forge_repo unset/, () => ({
    args: ['check', '--dir', repo({ originUrl: GH_REPO, commits: COMMITS, forge: null }), '--base', 'main'],
    opts: { stubs: ALL_STUBS },
  })],
  // A CONFIGURED forgejo record with tea present and answering - no login for
  // the persisted instance host is its own reason, because the fix is a login.
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
// degradation class (AC5), and these two are the `no-login` class asserted from
// both sides - what the seam must do when tea holds no login at all, and what
// it must do for an origin no login names.

test('an EMPTY tea login list skips on the existing line, and queries nothing', () => {
  const dir = repo({ originUrl: FORGE_REPO, commits: COMMITS });
  const marker = join(mkdtempSync(join(tmpdir(), 'cad-ic-mark-')), 'spawned.log');
  const argvLog = join(mkdtempSync(join(tmpdir(), 'cad-ic-argv-')), 'argv.log');
  const { status, envelope } = seamRun(['check', '--dir', dir, '--base', 'main'],
    { stubs: { tea: { body: TEA_BODY, login: '[]' } }, bare: true, marker, argvLog });
  assert.equal(status, 0, 'a tea holding no login must not fail the land');
  assert.equal(envelope.ok, true, JSON.stringify(envelope));
  assert.equal(envelope.action, 'skip', JSON.stringify(envelope));
  assert.equal(envelope.reason, 'tea holds no login for forge.example.com: no tracker report');
  assert.deepEqual(envelope.referenced, []);
  assert.deepEqual(envelope.open, []);
  // One tea spawn, and its argv is the login probe alone - a tea with no login
  // has no tracker to ask about, so no issue query goes out at all.
  assert.deepEqual(readFileSync(marker, 'utf8').trim().split('\n'), ['tea']);
  assert.deepEqual(readFileSync(argvLog, 'utf8').trim().split('\n'),
    ['tea login list --output json'], readFileSync(argvLog, 'utf8'));
});

test('an origin NO login names skips, and asks tea nothing about it', () => {
  // The guard, and the reason it is not the host rule that was deleted twice.
  // `--remote origin` binds tea to the checkout's own remote ("Discover Gitea
  // login from remote"), but tea does NOT refuse when no login matches: it
  // falls back to config order, exits 0, and says so only on the stderr this
  // seam discards - so an unguarded call reports a stranger's tracker as this
  // repository's, which is the exact failure the phase goal names. The seam
  // therefore declines to ask unless some login NAMES this host. That question
  // is equality, never a shared-suffix reading, which is why it needs no
  // vendored public suffix list.
  const dir = repo({ originUrl: 'https://git.stranger.org/org/repo.git', commits: COMMITS });
  const argvLog = join(mkdtempSync(join(tmpdir(), 'cad-ic-argv-')), 'argv.log');
  const { status, envelope } = seamRun(['check', '--dir', dir, '--base', 'main'],
    { stubs: { tea: { body: TEA_BODY, login: TEA_LOGINS } }, bare: true, argvLog });
  assert.equal(status, 0, 'a stranger host must not fail the land');
  assert.equal(envelope.action, 'skip', JSON.stringify(envelope));
  assert.equal(envelope.reason, 'tea holds no login for git.stranger.org: no tracker report');
  assert.equal(envelope.host, 'git.stranger.org', 'the ORIGIN host, never a login\'s');
  assert.deepEqual(envelope.referenced, []);
  assert.deepEqual(envelope.open, []);
  // The login probe ran; no issue query did. A skip that still queried would be
  // the affirmative answer this arm exists to refuse.
  const lines = readFileSync(argvLog, 'utf8').trim().split('\n');
  assert.equal(lines.filter((l) => l.startsWith('tea issues')).length, 0, lines.join('\n'));
  assert.equal(lines.filter((l) => l.startsWith('tea login list')).length, 1, lines.join('\n'));
});

test('a persisted host a login NAMES is bound with --login <that login\'s name>', () => {
  // The other side of the guard, rebound. The persisted host here is the SSH
  // endpoint the user confirmed; the login that serves it is named
  // `forge.example.com` and carries that endpoint in `ssh_host`. `--login`
  // takes a NAME and nothing else, so the argv must carry the login's name and
  // not the host that resolved it - a distinction only an argv assertion can
  // make, and one that a `--remote origin` call could never have got wrong
  // because it named no login at all.
  const dir = repo({ originUrl: SPLIT_ORIGIN, commits: COMMITS });
  const argvLog = join(mkdtempSync(join(tmpdir(), 'cad-ic-argv-')), 'argv.log');
  const { status, envelope } = seamRun(['check', '--dir', dir, '--base', 'main'],
    { stubs: { tea: { body: TEA_BODY, login: TEA_LOGINS } }, bare: true, argvLog });
  assert.equal(status, 0);
  assert.equal(envelope.action, 'report', JSON.stringify(envelope));
  assert.equal(envelope.host, 'ssh.example.com', 'the PERSISTED host, never a login\'s name');
  const queries = readFileSync(argvLog, 'utf8').trim().split('\n').filter((l) => l.startsWith('tea issues'));
  assert.equal(queries.length, 1, queries.join('\n'));
  assert.match(queries[0], /--login forge\.example\.com(\s|$)/, queries[0]);
  assert.ok(!queries[0].includes('--remote'), queries[0]);
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
  { name: 'forge.example.com', url: 'https://forge.example.com', ssh_host: 'ssh.example.com', user: 't' },
]);

test('forgejo: every call names the login the persisted host resolves, and no other', () => {
  // Two logins configured, and the FIRST one is a stranger. tea resolves an
  // unqualified `--repo <owner>/<name>` in config FILE ORDER, so an unbound
  // query would answer from `evil.example.net` - another server's issues,
  // reported as this repository's, exit 0 and all. `--remote origin` used to
  // hand that pick to tea by way of the checkout's remote; the persisted host
  // hands it to `teaLoginNameForHost`, which is what lets the call be made with
  // no remote present at all. The seam's job is to put the flag on EVERY call
  // it makes, list and resolve alike.
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
  const queries = lines.filter((l) => l.startsWith('tea issues'));
  assert.equal(queries.length, 3, lines.join('\n'));
  for (const q of queries) {
    assert.match(q, /--login forge\.example\.com(\s|$)/, q);
    assert.ok(!q.includes('--remote'), q);
    // The stranger sitting FIRST in the config is never named.
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

// --- the resolve loop's WALL-CLOCK budget (ISS-01) ---------------------------
//
// WATCHED FAILING AT 1ca00f7, the tip of this plan's unpatched tree. Observed
// there, with `tea` sleeping 1s and exiting 1 for every resolve, eight
// referenced numbers and `--timeout-ms 2000`: FIVE resolves ran (the whole
// MAX_RESOLVES cap) and the invocation took 5.07s, two and a half times the
// bound the flag names. The old loop's only exit was `if (one.timedOut) break;`
// and `run` marks `timedOut` from `err.signal === 'SIGKILL'` alone, so a CLI
// that answers inside the per-call bound and exits nonzero was never marked
// timed out and every one of the cap's calls cost the caller its own bound.

test('the per-issue resolves share ONE wall-clock budget, not one bound each', () => {
  const refs = [301, 302, 303, 304, 305, 306, 307, 308];
  const dir = repo({ originUrl: FORGE_REPO, commits: refs.map((n) => `chore: touches #${n}`) });
  const argvLog = join(mkdtempSync(join(tmpdir(), 'cad-ic-argv-')), 'argv.log');
  const started = Date.now();
  // `issue: {}` answers no number, so every resolve is the slow nonzero exit a
  // real tracker gives for an issue that is not there. Not `bare`: the stub
  // needs /usr/bin/sleep, and prepending the stub dir already wins over any
  // real `tea`.
  const run = seamRun(['check', '--dir', dir, '--base', 'main', '--timeout-ms', '2000'], {
    stubs: { tea: { body: TEA_OPEN_BODY, login: TEA_LOGINS, issue: {}, issueSleep: 1 } },
    argvLog,
  });
  const elapsed = Date.now() - started;
  assert.equal(run.status, 0, JSON.stringify(run.envelope));
  assert.equal(run.envelope.ok, true, JSON.stringify(run.envelope));
  assert.equal(run.envelope.action, 'report', JSON.stringify(run.envelope));
  const resolves = readFileSync(argvLog, 'utf8').trim().split('\n').filter((l) => /^tea issues \d/.test(l));
  // The budget buys one full call plus whatever is left, never the cap's five.
  assert.ok(resolves.length <= 2 && resolves.length >= 1,
    `the loop must stop when its budget is spent, not at MAX_RESOLVES: ${resolves.join('\n')}`);
  // The falsifying number: five calls at ~1s each is 5.07s, and the bound the
  // caller named is 2s. Anything under two budgets plus the run's own overhead
  // can only be a loop that stopped on the budget.
  assert.ok(elapsed < 3500,
    `the whole resolve phase must fit inside the single stated budget: ${elapsed}ms`);
});

test('a FAST nonzero resolve does not stop the loop: the numbers behind it still resolve', () => {
  // D-11. The shipped cap fixture cannot prove this and neither can the
  // resolve fixture above: in both, the number the stub exits 1 for is the LAST
  // one, so a loop that broke on any nonzero exit would still pass them. Here
  // the unanswered number comes FIRST, which is the ordinary case - tea exits 1
  // for an issue that is not there, and a land may reference several of those.
  const refs = [401, 402, 403];
  const dir = repo({ originUrl: FORGE_REPO, commits: refs.map((n) => `chore: touches #${n}`) });
  const r = seam(['check', '--dir', dir, '--base', 'main'], {
    stubs: { tea: {
      body: TEA_OPEN_BODY, login: TEA_LOGINS,
      issue: { 402: '{"index":402,"state":"closed"}', 403: '{"index":403,"state":"open"}' },
    } },
    bare: true,
  });
  assert.equal(r.action, 'report', JSON.stringify(r));
  assert.deepEqual(r.referenced, [
    { number: 401, state: 'unresolved' },
    { number: 402, state: 'closed' },
    { number: 403, state: 'open' },
  ], JSON.stringify(r));
});

test('a budget spent mid-loop is still a report: real states behind it, unresolved ahead', () => {
  // D-15. The budget is a bound on the land's cost, never a failure of it: the
  // envelope is the same one every other path emits, and the numbers the loop
  // never reached carry `unresolved` - never `not-found`, which would be an
  // affirmative claim about input this seam could not read.
  const refs = [501, 502, 503, 504, 505, 506, 507, 508];
  const dir = repo({ originUrl: FORGE_REPO, commits: refs.map((n) => `chore: touches #${n}`) });
  // 501 answers at once; every later number is the slow nonzero exit, so the
  // budget runs out with real state already collected and most refs untouched.
  const run = seamRun(['check', '--dir', dir, '--base', 'main', '--timeout-ms', '2000'], {
    stubs: { tea: {
      body: TEA_OPEN_BODY, login: TEA_LOGINS,
      issue: { 501: '{"index":501,"state":"closed"}' }, issueSleep: 1,
    } },
  });
  assert.equal(run.status, 0, JSON.stringify(run.envelope));
  assert.equal(run.envelope.ok, true, JSON.stringify(run.envelope));
  assert.equal(run.envelope.action, 'report', JSON.stringify(run.envelope));
  assert.deepEqual(run.envelope.referenced,
    refs.map((n) => ({ number: n, state: n === 501 ? 'closed' : 'unresolved' })),
    JSON.stringify(run.envelope));
  assert.deepEqual(run.envelope.open, [42, 99]);
  assert.deepEqual(run.envelope.warnings, []);
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

// --- --dir refuses rather than reading the process cwd's tracker (D-01) -----

// The one shape where this seam DOES exit nonzero, and it is not a failed
// tracker read: a malformed call never reaches the `check` arm, so there is no
// degraded report to hand back. Nothing spawns - asserted through the same
// marker file the issue_check:false arm uses.
for (const [label, dirArgs] of [['an EMPTY', ['--dir', '']], ['a VALUELESS', ['--dir']]]) {
  test(`check: ${label} --dir refuses by name, exit 1, no forge CLI spawned`, () => {
    const marker = join(mkdtempSync(join(tmpdir(), 'cad-ic-mark-')), 'spawned.log');
    const { status, envelope } = seamRun(['check', ...dirArgs, '--base', 'main'],
      { stubs: ALL_STUBS, marker });
    assert.equal(envelope.ok, false);
    // The e.seam catch arm, not the generic one: the thrown refusal object
    // carries no `message`, so without it this reads internal/"[object Object]".
    assert.equal(envelope.reason, 'missing-flag-value', JSON.stringify(envelope));
    assert.equal(envelope.detail, '--dir');
    assert.equal(status, 1);
    assert.equal(envelope.action, undefined, 'no tracker verdict rides a refusal');
    assert.equal(existsSync(marker), false,
      `a malformed call must spawn nothing, but one ran: ${existsSync(marker) ? readFileSync(marker, 'utf8') : ''}`);
  });
}

test('check: a malformed --timeout-ms still runs on the default, unlike --dir', () => {
  // D-01 names --dir and nothing else. --timeout-ms keeps its stated fallback:
  // this seam may never make an unbounded call, and refusing here would fail a
  // land over a flag the caller could simply have omitted.
  const dir = repo({ originUrl: GH_REPO, commits: COMMITS });
  const { status, envelope } = seamRun(['check', '--dir', dir, '--base', 'main', '--timeout-ms', 'abc'],
    { stubs: { gh: { body: GH_BODY } } });
  assert.equal(envelope.ok, true);
  assert.equal(status, 0);
  assert.equal(envelope.action, 'report');
});

// --- AC4: the persisted record answers with NO origin remote at all ----------
//
// The failure this closes: the seam classified the origin URL, so a repository
// that lost `origin` - a fresh clone mid-setup, a worktree the remote was never
// added to, a mirror pulled by path - reported "no origin remote is configured"
// and the land got no tracker line. Config is authoritative now (phase 1 D-01),
// so the report is the same whether the remote is there or not.

/** A login whose NAME is not its host, so the `url` field is what has to match
 *  and `--login` carries something the persisted host does not spell. */
const URL_MATCHED_LOGIN = '[{"name":"work","url":"https://forge.example.com","ssh_host":"ssh.example.com","user":"t"}]';
const CONFIGURED_FORGEJO = {
  forge_provider: 'forgejo', forge_repo: 'org/repo', forge_host: 'forge.example.com',
};

test('AC4: with the forge keys set and NO origin, forgejo still reports, bound by --login', () => {
  const dir = repo({ originUrl: null, commits: COMMITS, forge: CONFIGURED_FORGEJO });
  // Belt and braces: the fixture must really have no remote, or this proves
  // nothing about a repository that lost one.
  assert.equal(execFileSync('git', ['-C', dir, 'remote'], { encoding: 'utf8' }).trim(), '');
  const argvLog = join(mkdtempSync(join(tmpdir(), 'cad-ic-argv-')), 'argv.log');
  const { status, envelope } = seamRun(['check', '--dir', dir, '--base', 'main'],
    { stubs: { tea: { body: TEA_BODY, login: URL_MATCHED_LOGIN } }, bare: true, argvLog });
  assert.equal(status, 0);
  assert.equal(envelope.action, 'report', JSON.stringify(envelope));
  assert.equal(envelope.host, 'forge.example.com');
  assert.equal(envelope.repo, 'org/repo');
  assert.deepEqual(envelope.referenced, [
    { number: 42, state: 'open' }, { number: 47, state: 'closed' }, { number: 99, state: 'open' },
  ], JSON.stringify(envelope));
  // The proof that an instance was resolved with no `origin` present: the call
  // names the LOGIN, and the login's name is not the persisted host.
  const lines = readFileSync(argvLog, 'utf8').trim().split('\n');
  const list = lines.filter((l) => l.startsWith('tea issues list'));
  assert.equal(list.length, 1, lines.join('\n'));
  assert.match(list[0], /--login work(\s|$)/, list[0]);
  assert.ok(!list[0].includes('--remote'), list[0]);
});

test('AC4: the same repository whose host NO login serves skips, and asks tea nothing', () => {
  // The guard survives the rebind: `tea` does not refuse an unqualified call,
  // it falls back to config order and answers for a repository it has never
  // heard of, exit 0, with its NOTE on the stderr this seam discards. So the
  // seam declines to ask, and the line points at the fix, which is a login.
  const dir = repo({ originUrl: null, commits: COMMITS, forge: CONFIGURED_FORGEJO });
  const argvLog = join(mkdtempSync(join(tmpdir(), 'cad-ic-argv-')), 'argv.log');
  const { status, envelope } = seamRun(['check', '--dir', dir, '--base', 'main'], {
    stubs: { tea: { body: TEA_BODY, login: '[{"name":"other","url":"https://other.example","ssh_host":"other.example"}]' } },
    bare: true, argvLog,
  });
  assert.equal(status, 0, 'a missing login must not fail the land');
  assert.equal(envelope.action, 'skip', JSON.stringify(envelope));
  assert.equal(envelope.reason, 'tea holds no login for forge.example.com: no tracker report');
  assert.deepEqual(envelope.referenced, []);
  assert.deepEqual(envelope.open, []);
  // The login probe ran; no issue query did.
  assert.deepEqual(readFileSync(argvLog, 'utf8').trim().split('\n'), ['tea login list --output json']);
});

test('AC4: a repository with a WORKING origin but no forge keys names the keys to set', () => {
  // The other direction, and the one that makes "config is authoritative" a
  // claim rather than a slogan: a perfectly classifiable github origin is not
  // consulted at all. The old seam reported this repository's tracker.
  const dir = repo({ originUrl: GH_REPO, commits: COMMITS, forge: null });
  const marker = join(mkdtempSync(join(tmpdir(), 'cad-ic-mark-')), 'spawned.log');
  const { status, envelope } = seamRun(['check', '--dir', dir, '--base', 'main'],
    { stubs: ALL_STUBS, marker });
  assert.equal(status, 0);
  assert.equal(envelope.action, 'skip', JSON.stringify(envelope));
  assert.match(envelope.reason,
    /no forge configured \(git\.forge_provider, git\.forge_repo unset/, envelope.reason);
  assert.match(envelope.reason, /: no tracker report$/);
  assert.equal(envelope.host, null);
  assert.equal(envelope.repo, null);
  // And NO forge CLI ran: the not-configured arm is decided before any spawn.
  assert.equal(existsSync(marker), false,
    `an unconfigured repository spawned: ${existsSync(marker) ? readFileSync(marker, 'utf8') : ''}`);
});

test('AC4: a github record with NO origin reports too, and never touches tea', () => {
  // `git.forge_host` is null here and that is not a gap - github's host is
  // fixed - so the record is complete and the login probe never runs.
  const dir = repo({
    originUrl: null, commits: COMMITS,
    forge: { forge_provider: 'github', forge_repo: 'org/repo' },
  });
  const argvLog = join(mkdtempSync(join(tmpdir(), 'cad-ic-argv-')), 'argv.log');
  const { envelope } = seamRun(['check', '--dir', dir, '--base', 'main'],
    { stubs: ALL_STUBS, argvLog });
  assert.equal(envelope.action, 'report', JSON.stringify(envelope));
  assert.equal(envelope.host, null);
  assert.deepEqual(readFileSync(argvLog, 'utf8').trim().split('\n'),
    ['gh issue list --repo org/repo --state all --json number,state --limit 200']);
});
