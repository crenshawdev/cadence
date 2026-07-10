#!/usr/bin/env node
// Cadence installer. Copies skills/, agents/, and cadence-core/ into the
// Claude config dir (default ~/.claude, override with CLAUDE_DIR).
// Idempotent: re-run after any repo edit or git pull. The installed tree is
// disposable output - never edit it in place.
// --dev: symlink instead of copy (local iteration convenience only; nothing
// in Cadence may depend on the install mechanism).
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const repo = path.resolve(__dirname, '..');
const target = process.env.CLAUDE_DIR || path.join(os.homedir(), '.claude');
const dev = process.argv.includes('--dev');

function listEntries(dir, filter) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(filter).sort();
}

function install(src, dest) {
  // Safety rail: only ever remove targets in the cad namespace.
  if (!path.basename(dest).startsWith('cad')) {
    throw new Error(`refusing to touch non-cad target: ${dest}`);
  }
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (dev) {
    fs.symlinkSync(src, dest);
  } else {
    fs.cpSync(src, dest, { recursive: true });
  }
  console.log(`  ${dev ? 'linked' : 'copied'} ${path.relative(repo, src)} -> ${dest}`);
}

const jobs = [];
for (const name of listEntries(path.join(repo, 'skills'), n => n.startsWith('cad-'))) {
  jobs.push([path.join(repo, 'skills', name), path.join(target, 'skills', name)]);
}
for (const name of listEntries(path.join(repo, 'agents'), n => n.startsWith('cad-') && n.endsWith('.md'))) {
  jobs.push([path.join(repo, 'agents', name), path.join(target, 'agents', name)]);
}
jobs.push([path.join(repo, 'cadence-core'), path.join(target, 'cadence-core')]);

console.log(`Installing Cadence (${dev ? 'dev symlinks' : 'copy'}) into ${target}`);
for (const [src, dest] of jobs) install(src, dest);
console.log(`Done: ${jobs.length} entries.`);
