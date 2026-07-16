#!/usr/bin/env node
// @ts-check
// git-guard.mjs - PreToolUse hook: the inviolable git rails, enforced by the
// harness instead of prose (tier 3 of the determinism ladder). Wired via
// hooks/hooks.json for Bash tool calls.
//
// Scope: acts ONLY inside a Cadence project (a .planning/ dir in the hook's
// cwd or an ancestor, up to the repo root). Everywhere else it stays silent -
// this plugin must not police unrelated repos.
//
// Rails:
//   git push          -> permissionDecision "ask" - publishing is /cad-land's
//                        call (references/git.md rail 3); the user decides at
//                        the prompt, so cad-land's user-approved push still
//                        works in one step.
//   git commit on a   -> per config git.on_protected: ask (default) | refuse
//   protected branch     ("deny") | allow (silent).
//
// Contract: stdin carries the hook JSON ({tool_input:{command}, cwd}); a
// permission decision is one JSON object on stdout, exit 0. Any internal
// error exits 0 silently - a broken guard must never block normal work.
'use strict';

import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { mergeLayers } from './lib/config-merge.mjs';

function decide(decision, reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: decision,
      permissionDecisionReason: reason,
    },
  }) + '\n');
}

// Find the Cadence project root: walk up from `start` until a directory
// holding .planning/ (a Cadence project), stopping at a repo root without
// one (.git present, .planning absent -> not ours to police) or the
// filesystem root. The walk exists because the hook's cwd can sit BELOW the
// project root (a session opened in src/, say) - checking only cwd would
// let every commit from a subdirectory slip under the rails.
function planningRoot(start) {
  let dir = start;
  for (;;) {
    if (existsSync(join(dir, '.planning'))) return dir;
    if (existsSync(join(dir, '.git'))) return null; // repo root, not Cadence
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

// The git subcommand(s) a shell command actually invokes: for each simple
// command containing a `git` word, the first word after it that is not a
// global option (or that option's argument). Quoted strings are stripped
// first, so `git log --grep "push"` or `echo "git push"` never look like a
// push, and `git stash push` resolves to `stash`, not `push`. Conservative
// by construction: an unrecognized shape yields no subcommand and the guard
// stays silent - it must never block normal work.
const GIT_OPT_WITH_ARG = new Set(['-C', '-c', '--git-dir', '--work-tree',
  '--namespace', '--exec-path', '--config-env']);

function gitSubcommands(command) {
  const stripped = String(command)
    .replace(/"(?:[^"\\]|\\.)*"/g, ' ')
    .replace(/'[^']*'/g, ' ');
  const subs = [];
  for (const segment of stripped.split(/&&|\|\||[;|\n]/)) {
    const words = segment.trim().split(/\s+/).filter(Boolean);
    const gi = words.findIndex((w) => w === 'git' || w.endsWith('/git'));
    if (gi < 0) continue;
    for (let i = gi + 1; i < words.length; i++) {
      const w = words[i];
      if (GIT_OPT_WITH_ARG.has(w)) { i++; continue; } // skip option + its arg
      if (w.startsWith('-')) continue;                // other global flags
      subs.push(w);
      break;
    }
  }
  return subs;
}

try {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  const command = String(input?.tool_input?.command || '');
  const cwd = input?.cwd || process.cwd();

  // Only police Cadence projects (walk-up, see planningRoot), and only
  // commands whose git SUBCOMMAND is push or commit.
  const root = planningRoot(cwd);
  if (!root) process.exit(0);
  const subs = gitSubcommands(command);
  const isPush = subs.includes('push');
  const isCommit = subs.includes('commit');
  if (!isPush && !isCommit) process.exit(0);

  if (isPush) {
    decide('ask', 'Cadence rail: workflows never push - publishing is /cad-land\'s ' +
      'call (references/git.md rail 3). Approve only if you are deliberately publishing.');
    process.exit(0);
  }

  // git commit: enforce the protected-branch guard from config.
  const { config } = mergeLayers(join(root, '.planning', 'config.json'));
  const git = config.git || {};
  const protectedBranches = Array.isArray(git.protected_branches)
    ? git.protected_branches : ['main', 'master'];
  const onProtected = git.on_protected || 'ask';
  if (onProtected === 'allow') process.exit(0);

  let branch = '';
  try {
    branch = execFileSync('git', ['-C', cwd, 'rev-parse', '--abbrev-ref', 'HEAD'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch { process.exit(0); /* not a repo / no commits - nothing to guard */ }

  if (protectedBranches.includes(branch)) {
    decide(onProtected === 'refuse' ? 'deny' : 'ask',
      `Cadence rail: "${branch}" is a protected branch (git.protected_branches). ` +
      (onProtected === 'refuse'
        ? 'Config git.on_protected=refuse blocks this commit - create a task branch first.'
        : 'Create a task branch first, or approve to commit here deliberately.'));
  }
  process.exit(0);
} catch {
  process.exit(0); // never block on a guard failure
}
