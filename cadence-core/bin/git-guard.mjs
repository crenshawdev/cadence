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
//                        the prompt. No exemption lives here: EVERY Bash `git
//                        push` this hook sees asks unconditionally. cad-land's
//                        sanctioned unattended publish runs through the
//                        git-publish seam as a subprocess (execFileSync argv),
//                        not a Bash tool call, so this hook never sees it.
//   git commit on a   -> per config git.on_protected: ask (default) | refuse
//   protected branch     (alias: "deny") | allow (silent).
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
// global option (or that option's argument). Backslash line-continuations
// are joined FIRST (parity-aware - see below), ahead of quote-stripping -
// order is load-bearing: the
// double-quote pattern's `\\.` arm cannot match a backslash-newline, so a
// quoted string split across a continuation would survive the strip intact
// and its embedded `\n` would then be cut into a bare trailing command by
// the segment split below, manufacturing a phantom subcommand out of quoted
// text (D-08). Joining first collapses the continued line so the strip
// removes a continued quoted string whole. A wrapped `git push` therefore
// reaches the push rail as the push it is, and - deliberately, since the two
// rails must agree on what a wrapped command IS - a wrapped `git commit` on
// a protected branch starts prompting too (D-07). Quoted strings are then
// stripped, so `git log --grep "push"` or `echo "git push"` never look like
// a push, and `git stash push` resolves to `stash`, not `push`. Conservative
// by construction: an unrecognized shape yields no subcommand and the guard
// stays silent - it must never block normal work.
const GIT_OPT_WITH_ARG = new Set(['-C', '-c', '--git-dir', '--work-tree',
  '--namespace', '--exec-path', '--config-env']);

function gitSubcommands(command) {
  const stripped = String(command)
    // Join continuations, but only where the backslash is actually one: a
    // trailing RUN of backslashes continues the line only when its length is
    // ODD (`\\` at EOL is a literal backslash argument and the newline still
    // ends the command). Joining on an even run splices two independent
    // commands into one segment, and the scan below reads only the first
    // git word per segment - so `git add -A \\` + newline + `git push` would
    // resolve to `add` alone and a real push would go unprompted.
    .replace(/(\\+)(\r?\n)[ \t]*/g, (_m, slashes, nl) => (slashes.length % 2
      ? `${slashes.slice(0, -1)} `   // odd: last one continues the line
      : `${slashes}${nl}`))          // even: literal, keep the separator
    // ONE left-to-right pass over both quote forms, never two sequential
    // passes: a `"` inside a single-quoted word (`awk -F'"'`) is not a
    // delimiter, and stripping double quotes first pairs it with the next
    // `"` on the line, deleting everything between - including a real
    // `; git push origin main ;`. The alternation makes whichever quote
    // opens FIRST win, which is what the shell does.
    .replace(/'[^']*'|"(?:[^"\\]|\\.)*"/g, ' ');
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

// The current branch name, or '' on any failure (not a repo / no commits).
function currentBranch(cwd) {
  try {
    return execFileSync('git', ['-C', cwd, 'rev-parse', '--abbrev-ref', 'HEAD'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch { return ''; }
}

// No process.exit() anywhere below: the decision JSON is written to stdout,
// and exiting right after a write can truncate it on a pipe (the same rule
// lib/seam-io.mjs pins for the seam scripts). Plain returns let the stream
// drain; the process exits 0 naturally, which is the hook contract.
function main() {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  const command = String(input?.tool_input?.command || '');
  const cwd = input?.cwd || process.cwd();

  // Only police Cadence projects (walk-up, see planningRoot), and only
  // commands whose git SUBCOMMAND is push or commit.
  const root = planningRoot(cwd);
  if (!root) return;
  const subs = gitSubcommands(command);
  const isPush = subs.includes('push');
  const isCommit = subs.includes('commit');
  if (!isPush && !isCommit) return;

  // A push needs no config: EVERY Bash `git push` asks unconditionally - no
  // exemption of any kind lives here (rail 3). cad-land's sanctioned unattended
  // publish runs through the git-publish seam as a subprocess argv push, which
  // is not a Bash tool call, so this hook never sees it.
  if (isPush) {
    decide('ask', 'Cadence rail: workflows never push - publishing is /cad-land\'s ' +
      'call (references/git.md rail 3). Approve only if you are deliberately publishing.');
    return;
  }

  const { config } = mergeLayers(join(root, '.planning', 'config.json'));
  const git = config.git || {};
  // A lone string is an easy hand-edit; honor it rather than silently
  // reverting to the default list and unprotecting the branch the user
  // named (#38). Other non-array shapes still fall to the default.
  const protectedBranches = Array.isArray(git.protected_branches)
    ? git.protected_branches
    : typeof git.protected_branches === 'string'
      ? [git.protected_branches]
      : ['main', 'master'];

  // git commit: enforce the protected-branch guard from config. "deny" is
  // the decision word the harness uses, so accept it as an alias of refuse
  // instead of silently degrading the intended hard block to a soft ask (#38).
  const raw = git.on_protected === 'deny' ? 'refuse' : git.on_protected;
  const onProtected = raw || 'ask';
  if (onProtected === 'allow') return;

  const branch = currentBranch(cwd);
  if (!branch) return; // not a repo / no commits - nothing to guard

  if (protectedBranches.includes(branch)) {
    decide(onProtected === 'refuse' ? 'deny' : 'ask',
      `Cadence rail: "${branch}" is a protected branch (git.protected_branches). ` +
      (onProtected === 'refuse'
        ? 'Config git.on_protected=refuse blocks this commit - create a task branch first.'
        : 'Create a task branch first, or approve to commit here deliberately.'));
  }
}

try { main(); } catch { /* never block on a guard failure */ }
