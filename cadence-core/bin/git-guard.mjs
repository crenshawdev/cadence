#!/usr/bin/env node
// @ts-check
// git-guard.mjs - PreToolUse hook: the inviolable git rails, enforced by the
// harness instead of prose (tier 3 of the determinism ladder). Wired via
// hooks/hooks.json for Bash tool calls.
//
// Scope: acts ONLY inside a Cadence project (a .planning/ dir in the hook's
// cwd). Everywhere else it stays silent - this plugin must not police
// unrelated repos.
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
import { join } from 'node:path';
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

try {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  const command = String(input?.tool_input?.command || '');
  const cwd = input?.cwd || process.cwd();

  // Only police Cadence projects, and only git commands.
  if (!existsSync(join(cwd, '.planning'))) process.exit(0);
  const isPush = /\bgit\b(?:\s+\S+)*?\s+push\b/.test(command);
  const isCommit = /\bgit\b(?:\s+\S+)*?\s+commit\b/.test(command);
  if (!isPush && !isCommit) process.exit(0);

  if (isPush) {
    decide('ask', 'Cadence rail: workflows never push - publishing is /cad-land\'s ' +
      'call (references/git.md rail 3). Approve only if you are deliberately publishing.');
    process.exit(0);
  }

  // git commit: enforce the protected-branch guard from config.
  const { config } = mergeLayers(join(cwd, '.planning', 'config.json'));
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
