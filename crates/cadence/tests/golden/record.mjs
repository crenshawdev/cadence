// Record the frozen reference in isolated fixture copies. No runtime imports
// from cadence-core: the subprocess boundary is the behavior being measured.
import { spawnSync } from 'node:child_process';
import { accessSync, constants, cpSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = realpathSync(resolve(here, '../../../..'));
const identifier = /^[a-z0-9][a-z0-9-]*$/;

function contained(root, path) {
  const rel = relative(root, path);
  if (rel === '..' || rel.startsWith(`..${sep}`)) throw new Error(`path escapes ${root}`);
  return path;
}

function executable(name) {
  for (const dir of (process.env.PATH || '').split(delimiter).filter(Boolean)) {
    const path = resolve(dir, name);
    try { accessSync(path, constants.X_OK); return realpathSync(path); } catch { /* next PATH entry */ }
  }
  throw new Error(`required executable unavailable: ${name}`);
}

function main() {
  const only = new Set();
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] !== '--only' || !identifier.test(args[i + 1] || '')) {
      throw new Error('usage: record.mjs [--only <invocation>]...');
    }
    only.add(args[++i]);
  }
  const manifest = JSON.parse(readFileSync(join(here, 'operations.json'), 'utf8'));
  const ids = new Set();
  for (const entry of manifest) {
    if (!identifier.test(entry.invocation) || ids.has(entry.invocation)
      || !identifier.test(entry.bundle) || typeof entry.operation !== 'string'
      || typeof entry.git !== 'boolean' || !Array.isArray(entry.argv)
      || !entry.argv.every(arg => typeof arg === 'string')
      || (entry.stdin !== undefined && typeof entry.stdin !== 'string')
      || typeof entry.script !== 'string' || !entry.script.startsWith('cadence-core/bin/')) {
      throw new Error(`invalid invocation: ${entry.invocation}`);
    }
    contained(join(repo, 'cadence-core/bin'), realpathSync(resolve(repo, entry.script)));
    ids.add(entry.invocation);
  }
  for (const id of only) if (!ids.has(id)) throw new Error(`unknown invocation: ${id}`);
  const selected = manifest.filter(entry => !only.size || only.has(entry.invocation));
  // Preflight the whole selection: unsupported git setup must never leave a
  // partially updated recording set. Plan 2 replaces this guard with setup.
  for (const entry of selected) {
    if (entry.git) throw new Error(`${entry.invocation}: git fixture setup requires plan 2`);
  }
  const git = executable('git');
  const output = join(here, 'recordings');
  mkdirSync(output, { recursive: true });
  if (lstatSync(output).isSymbolicLink()) throw new Error('symlinked recordings directory');
  for (const entry of selected) {
    const source = contained(join(here, 'fixtures'), realpathSync(join(here, 'fixtures', entry.bundle)));
    const scratch = realpathSync(mkdtempSync(join(tmpdir(), 'cadence-golden-')));
    try {
      // Reject fixture symlinks rather than copying a write escape into scratch.
      cpSync(source, scratch, { recursive: true, filter(path) {
        if (lstatSync(path).isSymbolicLink()) throw new Error(`symlinked fixture: ${path}`);
        return true;
      } });
      const support = join(scratch, '.golden-env');
      mkdirSync(support);
      mkdirSync(join(support, 'bin'));
      mkdirSync(join(support, 'home'));
      symlinkSync(process.execPath, join(support, 'bin/node'));
      symlinkSync(git, join(support, 'bin/git'));
      const empty = join(support, 'empty.json');
      writeFileSync(empty, '{}\n');
      const global = entry.global_config === undefined ? empty
        : contained(scratch, realpathSync(resolve(scratch, entry.global_config)));
      const env = {
        PATH: join(support, 'bin'), HOME: join(support, 'home'),
        TZ: 'UTC', LC_ALL: 'C.UTF-8', LANG: 'C.UTF-8',
        CADENCE_GLOBAL_CONFIG: global,
        CADENCE_MANAGED_SETTINGS: empty,
        CADENCE_USER_SETTINGS: empty,
      };
      const substitute = text => text.replaceAll('<FIXTURE>', scratch);
      const restore = text => text.replaceAll(scratch, '<FIXTURE>').replaceAll(repo, '<REPO>');
      const argv = entry.argv.map(substitute);
      const stdin = entry.stdin === undefined ? null : substitute(entry.stdin);
      const child = spawnSync(process.execPath, [resolve(repo, entry.script), ...argv], {
        cwd: scratch, env, encoding: 'utf8', timeout: 60_000,
        maxBuffer: 32 * 1024 * 1024,
        stdio: [stdin === null ? 'ignore' : 'pipe', 'pipe', 'pipe'],
        ...(stdin === null ? {} : { input: stdin }),
      });
      if (child.error || child.signal || child.status === null) {
        throw new Error(`${entry.invocation}: ${child.error?.message || child.signal || 'no exit status'}`);
      }
      const stdout = child.stdout.trim() ? JSON.parse(child.stdout) : null;
      if (stdout !== null && (typeof stdout !== 'object' || Array.isArray(stdout))) {
        throw new Error(`${entry.invocation}: stdout must be one JSON object`);
      }
      const recording = {
        invocation: entry.invocation, operation: entry.operation,
        bundle: entry.bundle, script: entry.script, argv, stdin, env,
        node: process.versions.node.split('.')[0], exit: child.status,
        stdout, stderr: child.stderr, files: {}, deleted: [],
      };
      const destination = join(output, `${entry.invocation}.json`);
      // Opening without following symlinks protects an existing recording too.
      writeFileSync(destination, restore(JSON.stringify(recording, null, 2)) + '\n',
        { flag: constants.O_WRONLY | constants.O_CREAT | constants.O_TRUNC | constants.O_NOFOLLOW });
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  }
}

try { main(); }
catch (error) { console.error(error.message); process.exitCode = 1; }
