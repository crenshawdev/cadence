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
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

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
function stub(dir, name, { body = '', login = null, code = 0, sleep = 0, stderr = '' } = {}) {
  const heredoc = (text) => `cat <<'CADEOF'\n${text}\nCADEOF`;
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

/** Run the seam. `stubs` are built into a fresh dir prepended to the child's
 *  PATH; `cwd` defaults to a directory that is NOT the repo, so nothing can
 *  pass by inferring the repository from the process cwd. */
function seam(args, { stubs = {}, cwd = tmpdir(), marker = null, argvLog = null } = {}) {
  const stubDir = mkdtempSync(join(tmpdir(), 'cad-ic-bin-'));
  for (const [name, opts] of Object.entries(stubs)) stub(stubDir, name, opts);
  const env = {
    ...process.env,
    CADENCE_GLOBAL_CONFIG: NO_GLOBAL,
    PATH: stubDir + ':' + process.env.PATH,
  };
  if (marker) env.CAD_SPAWN_MARKER = marker;
  if (argvLog) env.CAD_ARGV_LOG = argvLog;
  try {
    return JSON.parse(execFileSync('node', [SEAM, ...args], { encoding: 'utf8', env, cwd }));
  } catch (e) {
    return JSON.parse(e.stdout);
  }
}

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
