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
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
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

/** A PATH holding the stubs named in `stubs` and NOTHING else that resolves -
 *  `gh` and `tea` are installed at /usr/bin on this dev box, so inheriting the
 *  real PATH would make "none installed" unprovable. `node` is invoked by
 *  absolute path for the same reason. */
function run(args, { stubs = [], gitConfig = null, dir = null, marker = null } = {}) {
  const stubDir = mkdtempSync(join(tmpdir(), 'cad-fg-bin-'));
  for (const name of stubs) stub(stubDir, name, { body: 'stub' });
  const env = { ...process.env, CADENCE_GLOBAL_CONFIG: NO_GLOBAL, PATH: stubDir };
  if (marker) env.CAD_SPAWN_MARKER = marker;
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
    env: { ...process.env, CADENCE_GLOBAL_CONFIG: NO_GLOBAL, PATH: stubDir },
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

test('an unknown subcommand prints the usage line naming the one it has', () => {
  const { status, envelope } = run(['frobnicate'], { stubs: ['gh'] });
  assert.equal(status, 1);
  assert.equal(envelope.reason, 'usage');
  assert.match(envelope.detail, /detect/);
});

test('no subcommand at all is the same usage refusal', () => {
  const { envelope } = run([], { stubs: ['gh'] });
  assert.equal(envelope.reason, 'usage');
});
