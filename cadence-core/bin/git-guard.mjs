#!/usr/bin/env node
// @ts-check
// PreToolUse hook: the inviolable git rails, enforced by the harness instead of prose, for Bash tool calls
// acts only inside a Cadence project (a .planning/ dir in the cwd or above) and stays silent elsewhere
// the push rail's walk climbs past a .git file (linked worktree, submodule), so a push from one under the project asks
// git push always asks: cad-land's unattended publish is a subprocess in the git-publish seam, so never seen here
// a pull or merge request opened or merged with gh, glab or tea always asks; cad-land's own go through that seam too
// git commit or git merge on a protected branch follows git.on_protected: ask (default), refuse (alias "deny") or allow
// git.guard_bypass true in both config layers turns the push and commit rails off; the request and merge rails stay
// an internal error exits 0, so a broken guard can't block work
'use strict';

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { forgeRequests, gitInvocations, planningRoot } from './lib/git-segments.mjs';

// the rails' modules load only when the command pushes, commits or merges, since this hook runs on every Bash call
let mergeLayers, bothLayers, resolveProtectedBranches, readCurrentBranch;

const BYPASS_KEY = 'git.guard_bypass';
const bypassed = (root) => bothLayers(root, [BYPASS_KEY]).keys[BYPASS_KEY].on;

// only ask and deny get written; with nothing to say it writes nothing and Claude Code's own permission flow decides
function decide(decision, reason) {
  const hookSpecificOutput = decision === 'deny'
    ? { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason }
    : { hookEventName: 'PreToolUse', permissionDecision: 'ask', permissionDecisionReason: reason };
  process.stdout.write(JSON.stringify({ hookSpecificOutput }) + '\n');
}

// the protected-branch decision for a git commit or merge, or null; it returns so main can order the rails
// the bypass reaches the commit alone: a merge onto a protected branch is what the user kept this hook for
/**
 * @param {string} root Cadence project root (holds .planning/)
 * @param {string} cwd
 * @param {'commit'|'merge'} verb
 * @returns {{decision: string, reason: string} | null}
 */
function branchDecision(root, cwd, verb) {
  if (verb === 'commit' && bypassed(root)) return null;
  const repoLayer = join(root, '.planning', 'config.json');
  // mergeLayers warnings[]: acted on below; a layer that failed to parse is what decides protected_branches here
  const { config, warnings, tornLayers } = mergeLayers(repoLayer);
  const git = config.git || {};

  // keyed on a layer failing to parse, not a protected-branch hit, or it would only fire on main and miss a lost list
  // either layer, not just the repo's: a torn user-global file used to revert the rails to defaults in silence
  // the cost: while a global config is torn, every commit in every Cadence project asks, and the prompt names the file
  // each warning is the message for one torn layer, so the first one is the one to show
  const torn = tornLayers.length ? warnings : [];
  // one coercion for all readers, with the #38 lone-string handling
  const protectedBranches = resolveProtectedBranches(git);

  // "deny" is the harness's word, so accept it as an alias of refuse and keep a hard block hard (#38)
  const raw = git.on_protected === 'deny' ? 'refuse' : git.on_protected;
  const onProtected = raw || 'ask';
  const branch = readCurrentBranch(cwd);

  // computed before the torn arm: that arm returns ask, which would turn a configured deny into an ask
  const branchDecision = (() => {
    if (onProtected === 'allow') return null;
    if (!branch) return null; // not a repo / no commits - nothing to guard
    if (!protectedBranches.includes(branch)) return null;
    const refuse = onProtected === 'refuse';
    const what = verb === 'merge'
      ? (refuse
        ? 'Config git.on_protected=refuse blocks this merge - land the work through a pull or merge request.'
        : 'Land the work through a pull or merge request, or approve to merge here deliberately.')
      : (refuse
        ? 'Config git.on_protected=refuse blocks this commit - create a task branch first.'
        : 'Create a task branch first, or approve to commit here deliberately.');
    return {
      decision: refuse ? 'deny' : 'ask',
      reason: `Cadence rail: "${branch}" is a protected branch (git.protected_branches). ${what}`,
    };
  })();

  if (torn.length) {
    const note = `Cadence rail: ${torn[0]} - the branch rails are deciding with `
      + 'DEFAULTS, not your settings.';
    // a parse warning never produces a deny and never cancels one: a hard block keeps its decision and gains the reason
    if (branchDecision && branchDecision.decision === 'deny') {
      return { decision: 'deny', reason: `${note} ${branchDecision.reason}` };
    }
    return { decision: 'ask', reason: `${note} Fix the file, or approve to ${verb} under the defaults.` };
  }
  return branchDecision;
}

const has = (dir, name) => existsSync(join(dir, name));

/** The push rail's probe: .git counts only as a directory; a worktree's or submodule's is a file, so climb on. */
const hasForPush = (dir, name) => {
  if (name !== '.git') return has(dir, name);
  try { return statSync(join(dir, name)).isDirectory(); } catch { return false; }
};

// a -C argument as a path, or null when it can't be known: empty, $ or backtick, ~, or quoting that isn't one pair.
// the command text arrives before the shell expands it, so -C "$S" is the literal "$S" here
function literalDir(raw) {
  let w = raw;
  if (/^(["']).*\1$/s.test(w) && w.length >= 2) w = w.slice(1, -1);
  if (!w || /[$`"'\\]/.test(w) || w.startsWith('~')) return null;
  return w;
}

// the protected-branch decision for one git commit or merge, in the repository it lands in
// no -C means the session directory; a literal -C is followed cumulatively and policed only if it's a Cadence project
// a -C it can't resolve falls back to the session directory and says which value it couldn't follow
function branchFor(verb, dirs, cwd, cwdRoot) {
  if (!dirs.length) return cwdRoot ? branchDecision(cwdRoot, cwd, verb) : null;
  let target = cwd;
  for (const raw of dirs) {
    const dir = literalDir(raw);
    if (dir === null) {
      if (!cwdRoot) return null;
      const d = branchDecision(cwdRoot, cwd, verb);
      return d && {
        decision: d.decision,
        reason: `Cadence rail: cannot tell which repository \`git -C ${raw || '(no path)'}\` ${verb}s in, `
          + `so this read the session directory instead. ${d.reason.replace(/^Cadence rail: /, '')}`,
      };
    }
    target = resolve(target, dir);
  }
  const root = planningRoot(target, has);
  return root ? branchDecision(root, target, verb) : null;
}

// no process.exit below: exiting right after a stdout write can truncate it on a pipe
async function main() {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  const command = String(input?.tool_input?.command || '');
  const cwd = input?.cwd || process.cwd();

  // walk up from cwd, since the hook can run below the root (a session in src/)
  const root = planningRoot(cwd, has);
  const calls = gitInvocations(command);
  const verbs = calls.map((c) => c.verb);

  /** @type {{decision: string, reason: string}[]} */
  const picks = [];

  // a request opened or merged asks, bypass or not; hasForPush's lookup so a worktree counts as the project's
  const requests = forgeRequests(command);
  if (requests.length && planningRoot(cwd, hasForPush)) {
    const merges = requests.some((r) => r.verb === 'merge');
    picks.push({ decision: 'ask', reason: `Cadence rail: this ${merges ? 'merges' : 'opens'} a pull or merge request `
      + `(${requests[0].cli}). /cad-land does that through git-publish.mjs, which never asks here. `
      + `Approve only if you mean to ${merges ? 'merge' : 'open'} it yourself now.` });
  }

  // a push asks unless the bypass is on
  const pushRoot = verbs.includes('push') ? planningRoot(cwd, hasForPush) : null;
  if (pushRoot) {
    ({ bothLayers } = await import('./lib/config-merge.mjs'));
    if (!bypassed(pushRoot)) {
      picks.push({ decision: 'ask', reason: 'Cadence rail: workflows never push - publishing is /cad-land\'s '
        + 'call (references/git-publish.md rail 3). Approve only if you are deliberately publishing.' });
    }
  }

  if (verbs.includes('commit') || verbs.includes('merge')) {
    ({ mergeLayers, bothLayers } = await import('./lib/config-merge.mjs'));
    ({ resolveProtectedBranches } = await import('./lib/protected-branches.mjs'));
    ({ readCurrentBranch } = await import('./lib/git-head.mjs'));
    // each commit or merge is judged in its own repo
    for (const call of calls) {
      if (call.verb !== 'commit' && call.verb !== 'merge') continue;
      // --abort and --quit back a merge out and land nothing; --continue makes the merge commit, so it's judged
      if (call.verb === 'merge' && call.args.some((w) => w === '--abort' || w === '--quit')) continue;
      const d = branchFor(call.verb, call.dirs, cwd, root);
      if (d) picks.push(d);
    }
  }

  // across every rail a deny beats an ask, and the first reason of that kind shows
  const pick = picks.find((p) => p.decision === 'deny') || picks[0];
  if (pick) decide(pick.decision, pick.reason);
}

main().catch(() => { /* never block on a guard failure */ });
