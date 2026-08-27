// Zero-dep tests for forge.mjs (the setup-time forge seam, FRG-01).
// Run: node --test cadence-core/bin/forge.test.mjs.
//
// Harness: a temp directory holding a `.planning/config.json`, plus stub
// executables in a temp dir prepended to the CHILD's PATH. PATH injection is
// what exercises the PRODUCTION resolver (lib/on-path.mjs reads no Cadence
// override, deliberately) rather than a test-only branch beside it.
//
// `stub` is IMPORTED from issue-check.test.mjs rather than copied: that file
// exports it for exactly this reuse, and every stub it writes appends its own
// name to $CAD_SPAWN_MARKER, which is what turns "no forge CLI was spawned"
// (AC1) into an assertion about the filesystem instead of about an empty list.
// Importing a test file REGISTERS its arms in the importing process, which is
// why that file binds `test` to a no-op unless it is itself the entry file.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, statSync, symlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stub } from './issue-check.test.mjs';

const SEAM = join(dirname(fileURLToPath(import.meta.url)), 'forge.mjs');
/** A user-global layer that does not exist, so a developer's own
 *  ~/.claude/cadence/config.json can never answer one of these cases. */
const NO_GLOBAL = join(mkdtempSync(join(tmpdir(), 'cad-fg-')), 'no-global.json');

/** A planning root carrying `git` config and nothing else. No git repo: this
 *  seam reads a config and PATH, and a repository is not among its inputs. */
function planningRoot(gitConfig = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'cad-fg-root-'));
  mkdirSync(join(dir, '.planning'), { recursive: true });
  writeFileSync(join(dir, '.planning', 'config.json'), JSON.stringify({ git: gitConfig }));
  return dir;
}

/** `planningRoot` plus a real git repository whose `origin` is `originUrl` -
 *  the only shape that exercises the origin-derived defaults, since the seam
 *  reads them through `git remote get-url origin` and not from a fixture. */
function repoWithOrigin(originUrl, gitConfig = {}) {
  const dir = planningRoot(gitConfig);
  const g = (...a) => execFileSync('git', ['-C', dir, ...a], {
    stdio: 'ignore',
    env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' },
  });
  g('init', '-q');
  if (originUrl) g('remote', 'add', 'origin', originUrl);
  return dir;
}

/** A directory holding ONLY a symlink to the real `git`. The child's PATH is
 *  built out of the stub dir plus this one and nothing else, because `gh` and
 *  `tea` are installed at /usr/bin on this dev box and inheriting the real PATH
 *  would make "none installed" unprovable - while a PATH with no `git` at all
 *  would make the origin-derived defaults unprovable in the other direction.
 *  issue-check.test.mjs builds the same directory for the same reason. */
const GIT_ONLY = (() => {
  const dir = mkdtempSync(join(tmpdir(), 'cad-fg-git-'));
  for (const d of (process.env.PATH || '').split(':')) {
    if (!d) continue;
    try { statSync(join(d, 'git')); symlinkSync(join(d, 'git'), join(dir, 'git')); return dir; }
    catch { /* next */ }
  }
  throw new Error('no git on PATH to link');
})();

/** A PATH holding the stubs named in `stubs`, the real `git`, and NOTHING else
 *  that resolves. `node` is invoked by absolute path for the same reason. */
function run(args, { stubs = [], gitConfig = null, dir = null, marker = null,
  argvLog = null, stubOpts = {} } = {}) {
  const stubDir = mkdtempSync(join(tmpdir(), 'cad-fg-bin-'));
  for (const name of stubs) stub(stubDir, name, { body: 'stub', ...(stubOpts[name] || {}) });
  const env = { ...process.env, CADENCE_GLOBAL_CONFIG: NO_GLOBAL, PATH: stubDir + ':' + GIT_ONLY };
  if (marker) env.CAD_SPAWN_MARKER = marker;
  // Every stub written by issue-check.test.mjs's `stub` appends `<name> $*` here,
  // so what the seam ACTUALLY called is a file on disk rather than a claim.
  if (argvLog) env.CAD_ARGV_LOG = argvLog;
  const root = dir || planningRoot(gitConfig || {});
  try {
    return {
      status: 0, root,
      envelope: JSON.parse(execFileSync(process.execPath, [SEAM, ...args], {
        encoding: 'utf8', env, cwd: tmpdir(),
      })),
    };
  } catch (e) {
    return { status: e.status, root, envelope: JSON.parse(e.stdout) };
  }
}

/** The marker file's contents, or '' when nothing was ever spawned. */
function spawned(marker) {
  return existsSync(marker) ? readFileSync(marker, 'utf8').trim() : '';
}

const marker = () => join(mkdtempSync(join(tmpdir(), 'cad-fg-mk-')), 'spawned');

// --- detection: which of the three resolve ----------------------------------

test('detect: two stubs on PATH is `ask`, naming exactly those two', () => {
  const mk = marker();
  const root = planningRoot();
  const { status, envelope } = run(['detect', '--dir', root], { stubs: ['gh', 'tea'], dir: root, marker: mk });
  assert.equal(status, 0);
  assert.equal(envelope.ok, true);
  assert.equal(envelope.action, 'ask');
  // PROVIDER_TABLE order, not PATH order: the menu is the same on every machine.
  assert.deepEqual(envelope.installed, [
    { provider: 'forgejo', bin: 'tea' },
    { provider: 'github', bin: 'gh' },
  ]);
  assert.equal(envelope.detail, null);
  assert.deepEqual(envelope.warnings, []);
  // AC1: detection resolves names on the filesystem and spawns nothing.
  assert.equal(spawned(mk), '');
});

test('detect: all three on PATH is `ask` naming all three', () => {
  const mk = marker();
  const root = planningRoot();
  const { envelope } = run(['detect', '--dir', root], { stubs: ['gh', 'tea', 'glab'], dir: root, marker: mk });
  assert.equal(envelope.action, 'ask');
  assert.deepEqual(envelope.installed.map((e) => e.bin), ['tea', 'gh', 'glab']);
  assert.equal(spawned(mk), '');
});

test('detect: an EMPTY stub dir refuses, with a hint and no installed entries', () => {
  // AC5. The refusal is the only ok:false arm, so the exit status is 1.
  const mk = marker();
  const root = planningRoot();
  const { status, envelope } = run(['detect', '--dir', root], { stubs: [], dir: root, marker: mk });
  assert.equal(status, 1);
  assert.equal(envelope.ok, false);
  assert.equal(envelope.action, 'refuse');
  assert.deepEqual(envelope.installed, []);
  assert.equal(envelope.detail, null);
  assert.ok(envelope.hint && envelope.hint.length > 0, JSON.stringify(envelope));
  for (const bin of ['tea', 'gh', 'glab']) {
    assert.match(envelope.reason, new RegExp(`\\b${bin}\\b`), `the reason names ${bin}`);
  }
  assert.equal(spawned(mk), '');
});

// --- the persisted record is read back --------------------------------------

test('detect: a complete github record is `configured` even with NO binary', () => {
  // AC2 against AC5. Setup persists a choice; it is land time that needs the
  // CLI, so an already-answered repository is never re-asked for a binary it
  // does not need at setup time.
  const mk = marker();
  const root = planningRoot({ forge_provider: 'github', forge_repo: 'crenshawdev/cadence' });
  const { status, envelope } = run(['detect', '--dir', root], { stubs: [], dir: root, marker: mk });
  assert.equal(status, 0);
  assert.equal(envelope.ok, true);
  assert.equal(envelope.action, 'configured');
  assert.equal(envelope.provider, 'github');
  assert.equal(envelope.repo, 'crenshawdev/cadence');
  assert.equal(envelope.host, null);
  assert.deepEqual(envelope.installed, []);
  assert.equal(spawned(mk), '');
});

test('detect: a forgejo record with a NULL host is `ask`, still carrying what is answered', () => {
  // The outstanding question is the instance host alone (CONTEXT D-08), and the
  // persisted provider and slug ride the `ask` arm so the setup step asks that
  // one question rather than all three.
  const mk = marker();
  const root = planningRoot({ forge_provider: 'forgejo', forge_repo: 'crenshawdev/cadence', forge_host: null });
  const { envelope } = run(['detect', '--dir', root], { stubs: ['tea'], dir: root, marker: mk });
  assert.equal(envelope.action, 'ask');
  assert.equal(envelope.provider, 'forgejo');
  assert.equal(envelope.repo, 'crenshawdev/cadence');
  assert.equal(envelope.host, null);
  assert.equal(spawned(mk), '');
});

test('detect: a forgejo record WITH a host is `configured`', () => {
  const root = planningRoot({
    forge_provider: 'forgejo', forge_repo: 'crenshawdev/cadence', forge_host: 'git.jcrenshaw.dev',
  });
  const { envelope } = run(['detect', '--dir', root], { stubs: [], dir: root });
  assert.equal(envelope.action, 'configured');
  assert.equal(envelope.host, 'git.jcrenshaw.dev');
});

test('detect: an unasked repository with a binary present is `ask`, carrying three nulls', () => {
  const root = planningRoot({ forge_provider: null, forge_repo: null, forge_host: null });
  const { envelope } = run(['detect', '--dir', root], { stubs: ['glab'], dir: root });
  assert.equal(envelope.action, 'ask');
  assert.equal(envelope.provider, null);
  assert.equal(envelope.repo, null);
  assert.equal(envelope.host, null);
});

test('detect: the scaffolded template answers `ask` rather than defaulting a provider', () => {
  // templates/config.json ships the three keys at explicit null (CONTEXT D-10),
  // so a freshly scaffolded repository is visibly UNASKED. Read from the real
  // template, not a copy of it.
  const template = join(dirname(fileURLToPath(import.meta.url)), '..', 'templates', 'config.json');
  const dir = mkdtempSync(join(tmpdir(), 'cad-fg-tpl-'));
  mkdirSync(join(dir, '.planning'), { recursive: true });
  writeFileSync(join(dir, '.planning', 'config.json'), readFileSync(template, 'utf8'));
  const { envelope } = run(['detect', '--dir', dir], { stubs: ['gh'], dir });
  assert.equal(envelope.action, 'ask');
  assert.equal(envelope.provider, null);
});

// --- a corrupt layer is diagnosed, never silently identical to an absent one -

test('detect: an unparseable config layer surfaces a warning on the envelope', () => {
  // Arm (a) of self-verify's undocumented-merge-warnings check, proved rather
  // than asserted: `warnings` is bound at the mergeLayers callsite and rides
  // every envelope this seam emits.
  const dir = mkdtempSync(join(tmpdir(), 'cad-fg-bad-'));
  mkdirSync(join(dir, '.planning'), { recursive: true });
  writeFileSync(join(dir, '.planning', 'config.json'), '{ not json');
  const { envelope } = run(['detect', '--dir', dir], { stubs: ['gh'], dir });
  assert.equal(envelope.action, 'ask');
  assert.ok(Array.isArray(envelope.warnings) && envelope.warnings.length > 0, JSON.stringify(envelope));
});

// --- the flag grammar is the declared one, and this seam states none of it ---

test('detect: an ABSENT --dir reads the process cwd', () => {
  const root = planningRoot({ forge_provider: 'github', forge_repo: 'o/r' });
  const stubDir = mkdtempSync(join(tmpdir(), 'cad-fg-bin-'));
  const envelope = JSON.parse(execFileSync(process.execPath, [SEAM, 'detect'], {
    encoding: 'utf8', cwd: root,
    env: { ...process.env, CADENCE_GLOBAL_CONFIG: NO_GLOBAL, PATH: stubDir + ':' + GIT_ONLY },
  }));
  assert.equal(envelope.action, 'configured');
  assert.equal(envelope.repo, 'o/r');
});

test('detect: an EMPTY --dir refuses, rather than answering about ./.planning', () => {
  const { status, envelope } = run(['detect', '--dir', ''], { stubs: ['gh'] });
  assert.equal(status, 1);
  assert.equal(envelope.ok, false);
  assert.equal(envelope.reason, 'missing-flag-value');
  assert.match(envelope.detail, /--dir/);
  assert.ok(envelope.hint && envelope.hint.length > 0);
});

test('detect: a VALUELESS --dir refuses the same way', () => {
  const { status, envelope } = run(['detect', '--dir'], { stubs: ['gh'] });
  assert.equal(status, 1);
  assert.equal(envelope.reason, 'missing-flag-value');
});

test('an unknown subcommand prints the usage line naming both it has', () => {
  const { status, envelope } = run(['frobnicate'], { stubs: ['gh'] });
  assert.equal(status, 1);
  assert.equal(envelope.reason, 'usage');
  assert.match(envelope.detail, /detect/);
  assert.match(envelope.detail, /create/);
});

test('no subcommand at all is the same usage refusal', () => {
  const { envelope } = run([], { stubs: ['gh'] });
  assert.equal(envelope.reason, 'usage');
});

// --- the two defaults the user CONFIRMS rather than retypes (AC3) -----------

test('detect: a split SSH endpoint offers the slug and NO provider', () => {
  // The shape this repository itself has. `classifyOrigin` parses the slug off
  // any origin that carries two path segments, but it recognizes a provider for
  // the github.com and gitlab.com suffixes alone (CONTEXT D-07), so a
  // self-hosted forge offers a slug to confirm and nothing marked
  // `(recommended)`.
  const dir = repoWithOrigin('ssh://git@ssh.jcrenshaw.dev:2222/crenshawdev/cadence.git');
  const { envelope } = run(['detect', '--dir', dir], { stubs: ['tea'], dir });
  assert.equal(envelope.action, 'ask');
  assert.equal(envelope.defaults.repo, 'crenshawdev/cadence');
  assert.equal(envelope.defaults.provider, null);
});

test('detect: a gitlab origin offers BOTH defaults, subgroup path intact', () => {
  const dir = repoWithOrigin('https://gitlab.com/g/sub/r.git');
  const { envelope } = run(['detect', '--dir', dir], { stubs: ['glab'], dir });
  assert.equal(envelope.defaults.provider, 'gitlab');
  assert.equal(envelope.defaults.repo, 'g/sub/r');
});

test('detect: a github origin offers both defaults', () => {
  const dir = repoWithOrigin('git@github.com:org/repo.git');
  const { envelope } = run(['detect', '--dir', dir], { stubs: ['gh'], dir });
  assert.equal(envelope.defaults.provider, 'github');
  assert.equal(envelope.defaults.repo, 'org/repo');
});

test('detect: NO host default is ever offered', () => {
  // CONTEXT D-08. The classifier holds a host on this very origin - the SSH
  // endpoint - and the envelope must not carry it as an answer to confirm.
  const dir = repoWithOrigin('ssh://git@ssh.jcrenshaw.dev:2222/crenshawdev/cadence.git');
  const { envelope } = run(['detect', '--dir', dir], { stubs: ['tea'], dir });
  assert.deepEqual(Object.keys(envelope.defaults).sort(), ['provider', 'repo']);
  assert.equal(envelope.host, null);
  assert.equal(JSON.stringify(envelope).includes('ssh.jcrenshaw.dev'), false,
    'the SSH endpoint never reaches the envelope in any field');
});

test('detect: a slug failing the grammar yields NO slug default, not raw text', () => {
  // The value comes off `.git/config` and the setup step interpolates it into
  // the shell line that persists it. A hostile origin gets no pre-filled
  // answer, and it is not repaired into one either.
  const dir = repoWithOrigin('https://github.com/org/repo;$(id)');
  const { envelope } = run(['detect', '--dir', dir], { stubs: ['gh'], dir });
  assert.equal(envelope.action, 'ask');
  assert.equal(envelope.defaults.repo, null);
  assert.equal(envelope.defaults.provider, 'github', 'the two defaults are independent');
  assert.equal(JSON.stringify(envelope).includes('$(id)'), false);
});

test('detect: a repository with NO origin offers no defaults and still asks', () => {
  const dir = repoWithOrigin(null);
  const { status, envelope } = run(['detect', '--dir', dir], { stubs: ['gh'], dir });
  assert.equal(status, 0);
  assert.equal(envelope.action, 'ask');
  assert.deepEqual(envelope.defaults, { provider: null, repo: null });
});

test('detect: a directory that is not a repository at all still asks', () => {
  // The git read never throws: a default is an offer, not a reading, so there
  // is nothing here to degrade.
  const dir = planningRoot();
  const { status, envelope } = run(['detect', '--dir', dir], { stubs: ['gh'], dir });
  assert.equal(status, 0);
  assert.equal(envelope.action, 'ask');
  assert.deepEqual(envelope.defaults, { provider: null, repo: null });
});

test('detect: the `configured` and `refuse` arms carry no defaults at all', () => {
  // There is no question to pre-fill on either, so reading the origin there
  // would be a spawn bought for an unused field.
  const done = repoWithOrigin('https://github.com/org/repo.git',
    { forge_provider: 'github', forge_repo: 'org/repo' });
  assert.equal(run(['detect', '--dir', done], { stubs: ['gh'], dir: done }).envelope.defaults, undefined);

  const bare = repoWithOrigin('https://github.com/org/repo.git');
  const refused = run(['detect', '--dir', bare], { stubs: [], dir: bare }).envelope;
  assert.equal(refused.action, 'refuse');
  assert.equal(refused.defaults, undefined);
});

test('detect: NO forge CLI is spawned while the defaults are derived (AC1)', () => {
  // The stubs are on PATH and would each append their own name to the marker.
  // `git` is not a forge CLI and writes nothing there.
  const mk = marker();
  const dir = repoWithOrigin('https://github.com/org/repo.git');
  const { envelope } = run(['detect', '--dir', dir], { stubs: ['gh', 'tea', 'glab'], dir, marker: mk });
  assert.equal(envelope.defaults.provider, 'github');
  assert.equal(spawned(mk), '');
});

// --- create: the argv is the property, and it never runs unconfirmed (AC6) --

/** The lines a stub recorded, `<name> <args...>` each, or [] when nothing ran. */
function calls(log) {
  return existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n').filter(Boolean) : [];
}

const argvLog = () => join(mkdtempSync(join(tmpdir(), 'cad-fg-log-')), 'argv');

test('create: the github arm records the pinned argv, then wires origin itself', () => {
  // AC6, against stubs that record what they were called with - the only form
  // of this assertion that survives a change to how the seam composes the call.
  // `gh`'s pinned argv carries no `--source`, so it wires no remote and the
  // seam runs the `git remote add` after it, in that order.
  const log = argvLog();
  const dir = planningRoot();
  const url = 'https://github.com/o/r.git';
  const { status, envelope } = run(
    ['create', '--provider', 'github', '--repo', 'o/r', '--confirmed',
      '--remote-url', url, '--dir', dir],
    { stubs: ['gh', 'git'], dir, argvLog: log },
  );
  assert.equal(status, 0);
  assert.equal(envelope.ok, true);
  assert.equal(envelope.provider, 'github');
  assert.equal(envelope.owner, 'o');
  assert.equal(envelope.repo, 'o/r');
  assert.equal(envelope.visibility, 'private');
  assert.equal(envelope.remote_wired, true);
  assert.deepEqual(calls(log), [
    'gh repo create o/r --private',
    `git -C ${dir} remote add origin ${url}`,
  ]);
});

test('create: the gitlab arm records its own grammar, --remoteName and all', () => {
  const log = argvLog();
  const dir = planningRoot();
  const { envelope } = run(
    ['create', '--provider', 'gitlab', '--repo', 'g/sub/r', '--confirmed', '--dir', dir],
    { stubs: ['glab', 'git'], dir, argvLog: log },
  );
  assert.equal(envelope.ok, true);
  assert.equal(envelope.remote_wired, true);
  // The one row that wires its own: no `git` line at all, and it is never asked
  // for a --remote-url.
  assert.deepEqual(calls(log), ['glab repo create g/sub/r --private --remoteName origin']);
});

/** A `tea login list --output json` reading naming `forge.example.com`, whose
 *  authenticated account is `jc`. It is the shape tea 0.15.1 actually prints -
 *  measured against a live instance - including the `default` field arriving as
 *  the STRING 'false' rather than a boolean, which is why nothing here reads it.
 *  `stub`'s `login` arm answers it for `tea login ...` and lets the same stub
 *  answer `tea repos create` on the next line. */
const TEA_LOGINS = '[{"name":"forge.example.com","url":"https://forge.example.com",'
  + '"ssh_host":"ssh.example.com","user":"jc","default":"false"}]';

test('create: the forgejo arm asks tea who it is, then records the org grammar', () => {
  // The owner here is NOT the login user, so `--owner` is what the flag means:
  // tea resolves it as an ORGANIZATION. The login list comes first, because the
  // argv cannot be built without it, and `--login` names the same login the
  // question was answered about.
  const log = argvLog();
  const dir = planningRoot();
  const url = 'https://forge.example.com/o/r.git';
  const { envelope } = run(
    ['create', '--provider', 'forgejo', '--repo', 'o/r', '--confirmed',
      '--remote-url', url, '--dir', dir],
    { stubs: ['tea', 'git'], dir, argvLog: log, stubOpts: { tea: { login: TEA_LOGINS } } },
  );
  assert.equal(envelope.ok, true);
  assert.deepEqual(calls(log), [
    'tea login list --output json',
    'tea repos create --name r --owner o --login forge.example.com --private',
    `git -C ${dir} remote add origin ${url}`,
  ]);
});

test('create: a repository under the LOGIN USER is created with no --owner at all', () => {
  // The defect the first live AC7 run exposed, at the seam. Measured 2026-08-24
  // on tea 0.15.1 against a live Forgejo: `--owner <the login user>` exits 1
  // with `Error: GetOrgByName`, and the same create without the flag exits 0.
  // An argv-recording stub cannot fail that way - it never reaches a server -
  // so the assertion has to be about the argv the login answer produces.
  const log = argvLog();
  const dir = planningRoot();
  const url = 'https://forge.example.com/jc/r.git';
  const { envelope } = run(
    ['create', '--provider', 'forgejo', '--repo', 'jc/r', '--confirmed',
      '--remote-url', url, '--dir', dir],
    { stubs: ['tea', 'git'], dir, argvLog: log, stubOpts: { tea: { login: TEA_LOGINS } } },
  );
  assert.equal(envelope.ok, true);
  assert.equal(envelope.owner, 'jc');
  assert.deepEqual(calls(log), [
    'tea login list --output json',
    'tea repos create --name r --login forge.example.com --private',
    `git -C ${dir} remote add origin ${url}`,
  ]);
});

/** Two Forgejo instances on ONE hostname, told apart by nothing but the port
 *  inside each login's API `url` - a second instance on `:3001` beside the
 *  first on `:3000`, which is what a machine running two of them looks like.
 *  Every other field a login identifies its forge by names the same host. */
const TEA_LOGINS_TWO_PORTS = [
  { name: 'prod-3000', url: 'https://forge.example.com:3000', ssh_host: 'forge.example.com', user: 'jc' },
  { name: 'prod-3001', url: 'https://forge.example.com:3001', ssh_host: 'forge.example.com', user: 'jc' },
];

test('create: two logins on ONE hostname are told apart by the PORT the url names', () => {
  // The login pick used to be made on the hostname alone, so BOTH of these
  // records named the instance and tea's own list order decided - which meant a
  // `--remote-url` naming `:3001` could be created on `:3000` and then have
  // `origin` set to `:3001`: a repository on an instance the user never asked
  // for, and a checkout pointing somewhere else. The port is real
  // distinguishing information, so it decides; list order is asserted BOTH ways
  // so a pass cannot come from the wanted login happening to be first.
  for (const port of ['3000', '3001']) {
    for (const order of ['as printed', 'reversed']) {
      const records = order === 'reversed'
        ? TEA_LOGINS_TWO_PORTS.slice().reverse() : TEA_LOGINS_TWO_PORTS;
      const log = argvLog();
      const dir = planningRoot();
      const url = `https://forge.example.com:${port}/jc/r.git`;
      const { envelope } = run(
        ['create', '--provider', 'forgejo', '--repo', 'jc/r', '--confirmed',
          '--remote-url', url, '--dir', dir],
        { stubs: ['tea', 'git'], dir, argvLog: log, stubOpts: { tea: { login: JSON.stringify(records) } } },
      );
      assert.equal(envelope.ok, true, `${port} / ${order}`);
      assert.deepEqual(calls(log), [
        'tea login list --output json',
        `tea repos create --name r --login prod-${port} --private`,
        `git -C ${dir} remote add origin ${url}`,
      ], `${port} / ${order}`);
    }
  }
});

test('create: the scheme default port is the SAME endpoint, never a mismatch', () => {
  // `https://forge.example.com` and `https://forge.example.com:443` are one
  // instance written two ways. A rule that read the unspelled one as "no port"
  // would refuse the login that spells it - or take the `:3000` neighbour
  // sitting first in the list, which is the same defect wearing a default.
  const records = [
    { name: 'other-3000', url: 'https://forge.example.com:3000', ssh_host: 'forge.example.com', user: 'jc' },
    { name: 'web', url: 'https://forge.example.com:443', ssh_host: 'forge.example.com', user: 'jc' },
  ];
  const log = argvLog();
  const dir = planningRoot();
  const url = 'https://forge.example.com/jc/r.git';
  const { envelope } = run(
    ['create', '--provider', 'forgejo', '--repo', 'jc/r', '--confirmed',
      '--remote-url', url, '--dir', dir],
    { stubs: ['tea', 'git'], dir, argvLog: log, stubOpts: { tea: { login: JSON.stringify(records) } } },
  );
  assert.equal(envelope.ok, true);
  assert.deepEqual(calls(log), [
    'tea login list --output json',
    'tea repos create --name r --login web --private',
    `git -C ${dir} remote add origin ${url}`,
  ]);
});

test('create: an SSH remote still resolves its login - its port is not an API port', () => {
  // The split endpoint this repository itself has: the login's `ssh_host` is
  // the SSH hostname and its `url` is the web one. `:2222` is an SSH port and
  // has nothing to be compared against on the login record, so the hostname
  // decides alone exactly as it did before ports were carried at all - reading
  // 2222 as a mismatch against the API's 443 would refuse the shape that works.
  const log = argvLog();
  const dir = planningRoot();
  const url = 'ssh://git@ssh.example.com:2222/jc/r.git';
  const { envelope } = run(
    ['create', '--provider', 'forgejo', '--repo', 'jc/r', '--confirmed',
      '--remote-url', url, '--dir', dir],
    { stubs: ['tea', 'git'], dir, argvLog: log, stubOpts: { tea: { login: TEA_LOGINS } } },
  );
  assert.equal(envelope.ok, true);
  assert.deepEqual(calls(log), [
    'tea login list --output json',
    'tea repos create --name r --login forge.example.com --private',
    `git -C ${dir} remote add origin ${url}`,
  ]);
});

test('create: no tea login for the instance refuses, and creates NOTHING', () => {
  // The login is what the argv depends on, so an unresolvable one is a refusal
  // rather than a fallback - the fallback is the argv that already failed live.
  // The probe DID run; the create did not, which is what the log proves.
  const log = argvLog();
  const dir = planningRoot();
  const elsewhere = '[{"name":"other.example.com","url":"https://other.example.com",'
    + '"ssh_host":"other.example.com","user":"jc"}]';
  const { status, envelope } = run(
    ['create', '--provider', 'forgejo', '--repo', 'jc/r', '--confirmed',
      '--remote-url', 'https://forge.example.com/jc/r.git', '--dir', dir],
    { stubs: ['tea', 'git'], dir, argvLog: log, stubOpts: { tea: { login: elsewhere } } },
  );
  assert.equal(status, 1);
  assert.equal(envelope.ok, false);
  assert.equal(envelope.detail, null);
  assert.ok(envelope.hint && envelope.hint.length > 0);
  assert.match(envelope.reason, /forge\.example\.com/);
  assert.deepEqual(calls(log), ['tea login list --output json']);
});

test('create: an UNREADABLE login list refuses the same way, leaking none of it', () => {
  // CONTEXT D-16 over the one stdout this seam reads: the reading is parsed
  // into a decision and never carried out. A login list that is not JSON at all
  // is the same answer as one naming another host - there is no login to build
  // an argv from - and neither the bytes nor a credential inside them reach the
  // envelope.
  const log = argvLog();
  const dir = planningRoot();
  const secret = 'ghp_DEADBEEFCAFE01234567';
  const bodies = [
    `not json at all - token: ${secret}`,
    `[{"name":"forge.example.com","user":"","token":"${secret}"}]`,
  ];
  for (const body of bodies) {
    const { status, envelope } = run(
      ['create', '--provider', 'forgejo', '--repo', 'jc/r', '--confirmed',
        '--remote-url', 'https://forge.example.com/jc/r.git', '--dir', dir],
      { stubs: ['tea', 'git'], dir, argvLog: log, stubOpts: { tea: { login: body } } },
    );
    assert.equal(status, 1, body);
    assert.equal(envelope.ok, false, body);
    assert.equal(envelope.detail, null, body);
    const serialized = JSON.stringify(envelope);
    for (const token of [secret, 'token']) {
      assert.equal(serialized.includes(token), false, `the login list reached the envelope: ${token}`);
    }
  }
});

test('create: a login NAME that would read as a flag is skipped, not sanitized', () => {
  // These are bytes a CLI printed at us, and a value opening on `-` is the one
  // way an untrusted string changes what an argument vector means. No login is
  // usable here, so the refusal fires and the create never runs.
  const log = argvLog();
  const dir = planningRoot();
  const hostile = '[{"name":"--config=/tmp/x","url":"https://forge.example.com","user":"jc"}]';
  const { envelope } = run(
    ['create', '--provider', 'forgejo', '--repo', 'jc/r', '--confirmed',
      '--remote-url', 'https://forge.example.com/jc/r.git', '--dir', dir],
    { stubs: ['tea', 'git'], dir, argvLog: log, stubOpts: { tea: { login: hostile } } },
  );
  assert.equal(envelope.ok, false);
  assert.deepEqual(calls(log), ['tea login list --output json']);
});

test('create: the two arms that need no login never ask for one', () => {
  // `needsLogin` is a fact of the row's own argv: `gh` and `glab` take the slug
  // as a positional and have no owner flag to get wrong, so no probe is bought
  // on either. The absence of a `login list` line is the assertion.
  for (const [provider, bin, extra] of [
    ['github', 'gh', ['--remote-url', 'https://github.com/o/r.git']],
    ['gitlab', 'glab', []],
  ]) {
    const log = argvLog();
    const dir = planningRoot();
    const { envelope } = run(
      ['create', '--provider', provider, '--repo', 'o/r', '--confirmed', '--dir', dir, ...extra],
      { stubs: [bin, 'git'], dir, argvLog: log, stubOpts: { [bin]: { login: TEA_LOGINS } } },
    );
    assert.equal(envelope.ok, true, provider);
    assert.equal(calls(log).some((c) => c.includes('login list')), false, provider);
  }
});

test('create: WITHOUT --confirmed nothing is spawned at all', () => {
  // The property AC6 states: no creation argv is recorded without a prior
  // confirmation. The seam cannot see the question, so it refuses the flag's
  // absence - and it refuses BEFORE the spawn, which is what the empty log
  // proves.
  const log = argvLog();
  const mk = marker();
  const dir = planningRoot();
  const { status, envelope } = run(
    ['create', '--provider', 'github', '--repo', 'o/r', '--dir', dir],
    { stubs: ['gh'], dir, argvLog: log, marker: mk },
  );
  assert.equal(status, 1);
  assert.equal(envelope.ok, false);
  assert.ok(envelope.hint && envelope.hint.length > 0, JSON.stringify(envelope));
  assert.equal(envelope.detail, null);
  assert.deepEqual(calls(log), []);
  assert.equal(spawned(mk), '');
});

test('create: a CLI that fails leaks none of its own text and nulls detail', () => {
  // CONTEXT D-16. The stub prints a credential-shaped line on stderr and exits
  // nonzero; the envelope says what failed and carries not one byte of it.
  const secret = 'fatal: Authorization: Bearer glpat-DEADBEEFCAFE';
  const dir = planningRoot();
  const { status, envelope } = run(
    ['create', '--provider', 'github', '--repo', 'o/r', '--confirmed',
      '--remote-url', 'https://github.com/o/r.git', '--dir', dir],
    { stubs: ['gh', 'git'], dir, stubOpts: { gh: { code: 1, stderr: secret, body: '' } } },
  );
  assert.equal(status, 1);
  assert.equal(envelope.ok, false);
  assert.equal(envelope.detail, null);
  assert.ok(envelope.hint && envelope.hint.length > 0);
  const serialized = JSON.stringify(envelope);
  for (const token of ['Bearer', 'glpat-DEADBEEFCAFE', 'fatal']) {
    assert.equal(serialized.includes(token), false, `the child's stderr reached the envelope: ${token}`);
  }
  assert.match(envelope.reason, /o\/r/);
});

test('create: a provider whose CLI is absent refuses, naming the install', () => {
  const log = argvLog();
  const dir = planningRoot();
  const { status, envelope } = run(
    ['create', '--provider', 'forgejo', '--repo', 'o/r', '--confirmed',
      '--remote-url', 'https://forge.example.com/o/r.git', '--dir', dir],
    { stubs: ['gh'], dir, argvLog: log },
  );
  assert.equal(status, 1);
  assert.equal(envelope.ok, false);
  assert.match(envelope.reason, /\btea\b/);
  assert.match(envelope.hint, /install tea/);
  assert.deepEqual(calls(log), []);
});

test('create: a provider outside the table refuses before any lookup', () => {
  const log = argvLog();
  const dir = planningRoot();
  const { status, envelope } = run(
    ['create', '--provider', 'bitbucket', '--repo', 'o/r', '--confirmed', '--dir', dir],
    { stubs: ['gh', 'tea', 'glab'], dir, argvLog: log },
  );
  assert.equal(status, 1);
  assert.equal(envelope.ok, false);
  assert.equal(envelope.detail, null);
  for (const p of ['forgejo', 'github', 'gitlab']) assert.match(envelope.hint, new RegExp(p));
  assert.deepEqual(calls(log), []);
});

test('create: a --repo failing the slug grammar refuses rather than reaching an argv', () => {
  // The selector is caller-derived text that lands in an argument VECTOR. A
  // segment reading as a flag, a traversal segment and a single bare name are
  // all refused by the one grammar the setup defaults already use.
  const log = argvLog();
  const dir = planningRoot();
  for (const bad of ['repo', '-x/repo', 'o/../etc', 'o/r; id']) {
    const { status, envelope } = run(
      ['create', '--provider', 'github', '--repo', bad, '--confirmed', '--dir', dir],
      { stubs: ['gh'], dir, argvLog: log },
    );
    assert.equal(status, 1, bad);
    assert.equal(envelope.ok, false, bad);
    assert.ok(envelope.hint && envelope.hint.length > 0, bad);
  }
  assert.deepEqual(calls(log), []);
});

test('create: --provider and --repo refuse a valueless spelling, before anything runs', () => {
  const log = argvLog();
  const dir = planningRoot();
  for (const args of [
    ['create', '--provider', '--repo', 'o/r', '--confirmed', '--dir', dir],
    ['create', '--provider', 'github', '--repo', '', '--confirmed', '--dir', dir],
  ]) {
    const { status, envelope } = run(args, { stubs: ['gh'], dir, argvLog: log });
    assert.equal(status, 1);
    assert.equal(envelope.reason, 'missing-flag-value');
  }
  assert.deepEqual(calls(log), []);
});

test('create: an ABSENT selector is answered by the seam, not by the argument door', () => {
  // The one row in the table with TWO required flags. The door is a VALUE door
  // (review-provider.mjs's rule), so a caller who omitted a flag is told what
  // create needs rather than which flag the door read first.
  const log = argvLog();
  const dir = planningRoot();
  for (const [args, flag] of [
    [['create', '--repo', 'o/r', '--confirmed', '--dir', dir], '--provider'],
    [['create', '--provider', 'github', '--confirmed', '--dir', dir], '--repo'],
  ]) {
    const { status, envelope } = run(args, { stubs: ['gh'], dir, argvLog: log });
    assert.equal(status, 1);
    assert.equal(envelope.ok, false);
    assert.equal(envelope.detail, null);
    assert.match(envelope.reason, new RegExp(`create needs ${flag}`));
    assert.ok(envelope.hint && envelope.hint.length > 0);
  }
  assert.deepEqual(calls(log), []);
});

// --- the arms whose argv wires no remote wire origin themselves --------------

test('create: no --remote-url on an arm that wires none creates NOTHING', () => {
  // The refusal has to precede the spawn: refusing afterwards would leave a
  // real repository on the instance with no way to reach it. The empty argv log
  // is what proves the ordering rather than the wording.
  const dir = planningRoot();
  for (const [provider, bin] of [['forgejo', 'tea'], ['github', 'gh']]) {
    const log = argvLog();
    const mk = marker();
    const { status, envelope } = run(
      ['create', '--provider', provider, '--repo', 'o/r', '--confirmed', '--dir', dir],
      { stubs: [bin, 'git'], dir, argvLog: log, marker: mk },
    );
    assert.equal(status, 1, provider);
    assert.equal(envelope.ok, false, provider);
    assert.equal(envelope.detail, null, provider);
    assert.match(envelope.hint, /--remote-url/, provider);
    assert.deepEqual(calls(log), [], provider);
    assert.equal(spawned(mk), '', provider);
  }
});

test('create: a --remote-url the origin grammar cannot read refuses before the spawn', () => {
  // ONE grammar decides what a remote URL may be, here and at setup: a value
  // classifyOrigin cannot resolve to a host AND a slug is not a repository URL.
  // A value opening on `-` is refused outright - it would read as a FLAG the
  // moment it sat in the `git remote add` vector.
  const dir = planningRoot();
  for (const bad of ['not a url', 'https://forge.example.com/onlyowner', '',
    '--upload-pack=id', '-o/r']) {
    const log = argvLog();
    const { status, envelope } = run(
      ['create', '--provider', 'github', '--repo', 'o/r', '--confirmed',
        '--remote-url', bad, '--dir', dir],
      { stubs: ['gh', 'git'], dir, argvLog: log },
    );
    assert.equal(status, 1, bad);
    assert.equal(envelope.ok, false, bad);
    assert.ok(envelope.hint && envelope.hint.length > 0, bad);
    assert.deepEqual(calls(log), [], bad);
  }
});

test('create: a VALUELESS --remote-url refuses at the declared row', () => {
  const dir = planningRoot();
  const { status, envelope } = run(
    ['create', '--provider', 'github', '--repo', 'o/r', '--confirmed',
      '--dir', dir, '--remote-url'],
    { stubs: ['gh', 'git'], dir },
  );
  assert.equal(status, 1);
  assert.equal(envelope.reason, 'missing-flag-value');
  assert.match(envelope.detail, /--remote-url/);
});

test('create: a failed `git remote add` says the repository EXISTS', () => {
  // A caller told "created" that finds no origin has been told the wrong thing,
  // and re-running the create would be the wrong repair - the reason and the
  // hint both have to say the repository is already there.
  const log = argvLog();
  const dir = planningRoot();
  const url = 'https://forge.example.com/o/r.git';
  const { status, envelope } = run(
    ['create', '--provider', 'forgejo', '--repo', 'o/r', '--confirmed',
      '--remote-url', url, '--dir', dir],
    { stubs: ['tea', 'git'], dir, argvLog: log,
      stubOpts: { tea: { login: TEA_LOGINS },
        git: { code: 1, stderr: 'fatal: remote origin already exists.', body: '' } } },
  );
  assert.equal(status, 1);
  assert.equal(envelope.ok, false);
  assert.equal(envelope.created, true);
  assert.equal(envelope.remote_wired, false);
  assert.equal(envelope.detail, null);
  assert.ok(envelope.hint && envelope.hint.length > 0);
  assert.equal(JSON.stringify(envelope).includes('fatal'), false,
    "git's own text reached the envelope");
  // The create DID happen, which is exactly why the reason may not read as one
  // that did not. Three calls on this arm: the login probe, the create, the
  // failed `git remote add`.
  assert.equal(calls(log).length, 3);
});

test('create: the gitlab arm is never asked for a --remote-url', () => {
  // Its row wires its own, so the flag is not required there and passing none
  // reaches a successful create.
  const log = argvLog();
  const dir = planningRoot();
  const { envelope } = run(
    ['create', '--provider', 'gitlab', '--repo', 'o/r', '--confirmed', '--dir', dir],
    { stubs: ['glab', 'git'], dir, argvLog: log },
  );
  assert.equal(envelope.ok, true);
  assert.deepEqual(calls(log), ['glab repo create o/r --private --remoteName origin']);
});

// --- create: the URL must name the port the configured instance serves ------

/** A planning root whose persisted record names a PORTED Forgejo instance -
 *  the shape `git.forge_host` could not even state before FRG-04. */
const portedRoot = () => planningRoot({
  forge_provider: 'forgejo', forge_repo: 'o/r', forge_host: 'forge.example.com:3001',
});

test('create: an http(s) --remote-url on the WRONG port refuses, naming both', () => {
  // GH-103: `create` took the URL's correctness on the caller's word, so an
  // `origin` that answers nothing was wired in silence. `https://h` means 443
  // here - the scheme's default is a port, not an absence.
  const log = argvLog();
  const mk = marker();
  const dir = portedRoot();
  const { status, envelope } = run(
    ['create', '--provider', 'forgejo', '--repo', 'o/r', '--confirmed',
      '--remote-url', 'https://forge.example.com/o/r.git', '--dir', dir],
    { stubs: ['tea', 'git'], dir, argvLog: log, marker: mk, stubOpts: { tea: { login: TEA_LOGINS } } },
  );
  assert.equal(status, 1);
  assert.equal(envelope.ok, false);
  assert.match(envelope.reason, /3001/);
  assert.match(envelope.reason, /443/);
  // Nothing at all ran: not the login probe, not the create, not git.
  assert.deepEqual(calls(log), []);
  assert.equal(spawned(mk), '');
});

test('create: an scp --remote-url refuses naming the 22 it implies', () => {
  // The scp form's colon separates host from PATH: it has no port syntax, so it
  // can never name the instance the user configured. The refusal is ESCAPABLE -
  // the hint names the two explicit spellings that pass.
  const log = argvLog();
  const mk = marker();
  const dir = portedRoot();
  const { status, envelope } = run(
    ['create', '--provider', 'forgejo', '--repo', 'o/r', '--confirmed',
      '--remote-url', 'git@forge.example.com:o/r.git', '--dir', dir],
    { stubs: ['tea', 'git'], dir, argvLog: log, marker: mk, stubOpts: { tea: { login: TEA_LOGINS } } },
  );
  assert.equal(status, 1);
  assert.equal(envelope.ok, false);
  assert.match(envelope.reason, /3001/);
  assert.match(envelope.reason, /22/);
  assert.match(envelope.hint, /ssh:\/\//);
  assert.match(envelope.hint, /https:\/\//);
  assert.deepEqual(calls(log), []);
  assert.equal(spawned(mk), '');
});

test('create: a URL naming the configured port reaches the create', () => {
  const log = argvLog();
  const dir = portedRoot();
  const url = 'https://forge.example.com:3001/o/r.git';
  const records = [{ name: 'ported', url: 'https://forge.example.com:3001', ssh_host: 'forge.example.com', user: 'jc' }];
  const { envelope } = run(
    ['create', '--provider', 'forgejo', '--repo', 'o/r', '--confirmed', '--remote-url', url, '--dir', dir],
    { stubs: ['tea', 'git'], dir, argvLog: log, stubOpts: { tea: { login: JSON.stringify(records) } } },
  );
  assert.equal(envelope.ok, true);
  assert.deepEqual(calls(log), [
    'tea login list --output json',
    'tea repos create --name r --owner o --login ported --private',
    `git -C ${dir} remote add origin ${url}`,
  ]);
  // A torn config layer during the one face that MUTATES must not be silent.
  assert.ok(Array.isArray(envelope.warnings));
});

test('create: an SSH port over a non-http scheme is ACCEPTED, never compared', () => {
  // An SSH port and a web port are different endpoints of ONE instance, which
  // is the mistake httpPortOf's header exists to record.
  const log = argvLog();
  const dir = portedRoot();
  const url = 'ssh://git@forge.example.com:2222/o/r.git';
  const records = [{ name: 'ported', url: 'https://forge.example.com:3001', ssh_host: 'forge.example.com', user: 'jc' }];
  const { envelope } = run(
    ['create', '--provider', 'forgejo', '--repo', 'o/r', '--confirmed', '--remote-url', url, '--dir', dir],
    { stubs: ['tea', 'git'], dir, argvLog: log, stubOpts: { tea: { login: JSON.stringify(records) } } },
  );
  assert.equal(envelope.ok, true);
  assert.deepEqual(calls(log), [
    'tea login list --output json',
    'tea repos create --name r --owner o --login ported --private',
    `git -C ${dir} remote add origin ${url}`,
  ]);
});

test('create: a --remote-url on a DIFFERENT host is not compared at all', () => {
  // The split-endpoint deployment this repository itself has. Refusing it would
  // refuse a shape that works.
  const log = argvLog();
  const dir = portedRoot();
  const url = 'https://ssh.example.com/o/r.git';
  const records = [{ name: 'ported', url: 'https://ssh.example.com', ssh_host: 'ssh.example.com', user: 'jc' }];
  const { envelope } = run(
    ['create', '--provider', 'forgejo', '--repo', 'o/r', '--confirmed', '--remote-url', url, '--dir', dir],
    { stubs: ['tea', 'git'], dir, argvLog: log, stubOpts: { tea: { login: JSON.stringify(records) } } },
  );
  assert.equal(envelope.ok, true);
  assert.equal(calls(log).length, 3);
});

test('create: a PORTLESS or null git.forge_host fires nothing at all', () => {
  // What keeps github and gitlab out of this entirely - their host key is null
  // by contract - and what keeps every existing create arm byte for byte.
  for (const forge_host of [null, 'forge.example.com']) {
    const log = argvLog();
    const dir = planningRoot({ forge_provider: 'forgejo', forge_repo: 'o/r', forge_host });
    const url = 'git@forge.example.com:o/r.git';
    const { envelope } = run(
      ['create', '--provider', 'forgejo', '--repo', 'o/r', '--confirmed', '--remote-url', url, '--dir', dir],
      { stubs: ['tea', 'git'], dir, argvLog: log, stubOpts: { tea: { login: TEA_LOGINS } } },
    );
    assert.equal(envelope.ok, true, String(forge_host));
    assert.deepEqual(calls(log), [
      'tea login list --output json',
      'tea repos create --name r --owner o --login forge.example.com --private',
      `git -C ${dir} remote add origin ${url}`,
    ], String(forge_host));
  }
});

// --- create: a row that wires its own remote refuses a URL (GH-105) ---------

test('create: the gitlab arm REFUSES a --remote-url, naming the conflict', () => {
  // Its pinned create argv carries `--remoteName origin`, so a URL passed here
  // would be read by nothing and origin would be whatever glab chose. Silence
  // was the defect; the refusal names the conflict rather than declining a flag.
  const log = argvLog();
  const mk = marker();
  const dir = planningRoot();
  const { status, envelope } = run(
    ['create', '--provider', 'gitlab', '--repo', 'o/r', '--confirmed',
      '--remote-url', 'https://gitlab.com/o/r.git', '--dir', dir],
    { stubs: ['glab', 'git'], dir, argvLog: log, marker: mk },
  );
  assert.equal(status, 1);
  assert.equal(envelope.ok, false);
  assert.match(envelope.reason, /--remoteName origin/);
  assert.match(envelope.hint, /drop --remote-url/);
  assert.deepEqual(calls(log), []);
  assert.equal(spawned(mk), '');
});
