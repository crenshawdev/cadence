#!/usr/bin/env node
// Cadence installer. Installs skills/, agents/, and cadence-core/ into the
// Claude config dir (default ~/.claude, override with CLAUDE_DIR).
// Idempotent: re-run after any repo edit or git pull; it installs the current
// cad-* entries and prunes ones a prior install shipped that this version no
// longer does. The installed tree is disposable output - never edit in place.
// --dev: symlink instead of copy (local iteration convenience only; nothing
// in Cadence may depend on the install mechanism).
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const repo = path.resolve(__dirname, '..');
const target = process.env.CLAUDE_DIR || path.join(os.homedir(), '.claude');
const dev = process.argv.includes('--dev');

// Anchor the destructive path: refuse to operate on a target tree that does
// not already exist, so a mistyped CLAUDE_DIR cannot seed or delete arbitrary
// directories. The default ~/.claude exists wherever Claude Code is installed.
if (!fs.existsSync(target)) {
  console.error(`Target config dir does not exist: ${target}`);
  console.error('Point CLAUDE_DIR at your Claude config dir, or install Claude Code first.');
  process.exit(1);
}

// Ownable by this installer iff the basename is the engine dir or a cad-
// namespaced skill/agent. Every remove and write is gated on this.
function owned(dest) {
  const base = path.basename(dest);
  return base === 'cadence-core' || base.startsWith('cad-');
}

function remove(dest) {
  if (!owned(dest)) throw new Error(`refusing to remove non-Cadence target: ${dest}`);
  fs.rmSync(dest, { recursive: true, force: true });
}

function place(src, dest) {
  remove(dest);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (dev) {
    fs.symlinkSync(src, dest);
  } else {
    // dereference: copy real files, never reproduce a repo symlink into config.
    fs.cpSync(src, dest, { recursive: true, dereference: true });
  }
  console.log(`  ${dev ? 'linked' : 'copied'} ${path.relative(repo, src)} -> ${dest}`);
}

function listEntries(dir, filter) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(filter).sort();
}

// Prune cad-* entries a prior install left in the target that this version no
// longer ships, so a removed skill or agent stops resolving after an update.
function prune(subdir, keep, filter) {
  const dir = path.join(target, subdir);
  const keepSet = new Set(keep);
  for (const name of listEntries(dir, filter)) {
    if (!keepSet.has(name)) {
      remove(path.join(dir, name));
      console.log(`  pruned stale ${subdir}/${name}`);
    }
  }
}

const skillNames = listEntries(path.join(repo, 'skills'), n => n.startsWith('cad-'));
const agentNames = listEntries(path.join(repo, 'agents'), n => n.startsWith('cad-') && n.endsWith('.md'));

const jobs = [];
for (const name of skillNames) jobs.push([path.join(repo, 'skills', name), path.join(target, 'skills', name)]);
for (const name of agentNames) jobs.push([path.join(repo, 'agents', name), path.join(target, 'agents', name)]);
jobs.push([path.join(repo, 'cadence-core'), path.join(target, 'cadence-core')]);

console.log(`Installing Cadence (${dev ? 'dev symlinks' : 'copy'}) into ${target}`);
let failed = 0;
for (const [src, dest] of jobs) {
  try {
    place(src, dest);
  } catch (err) {
    failed++;
    console.error(`  FAILED ${dest}: ${err.message}`);
  }
}
prune('skills', skillNames, n => n.startsWith('cad-'));
prune('agents', agentNames, n => n.startsWith('cad-') && n.endsWith('.md'));

if (failed) {
  console.error(`Done with ${failed} failure(s); re-run to retry (the source repo is untouched).`);
  process.exit(1);
}
console.log(`Done: ${jobs.length} entries.`);
