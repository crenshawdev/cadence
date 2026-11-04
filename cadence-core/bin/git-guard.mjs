#!/usr/bin/env node
// @ts-check
// git-guard.mjs - PreToolUse hook: the inviolable git rails, enforced by the harness instead of prose, wired through hooks/hooks.json for Bash tool calls
// it acts only inside a Cadence project (a .planning/ dir in the hook's cwd or an ancestor, up to the repo root) and stays silent everywhere else, because this plugin must not police unrelated repos
// the push rail's walk also passes over a .git file (a linked worktree's or a submodule's) and keeps climbing, so a push from a worktree or submodule beneath the project asks. An independent clone's .git directory still ends the walk, and a worktree made outside the project tree stays unguarded. The commit rail keeps the plain walk and doesn't judge worktree commits
// git push asks (permissionDecision "ask") every time with no exemption: publishing is /cad-land's call and the user decides at the prompt. cad-land's sanctioned unattended publish runs through the git-publish seam as a subprocess and not a Bash tool call, so this hook never sees it
// git commit on a protected branch follows git.on_protected: ask (default), refuse (alias "deny") or allow, which writes nothing so Claude Code's own permission flow decides
// stdin carries the hook JSON ({tool_input:{command}, cwd}) and a permission decision is one JSON object on stdout with exit 0. Any internal error exits 0 silently, since a broken guard must never block normal work
'use strict';

import { existsSync, statSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { gitInvocations, planningRoot } from './lib/git-segments.mjs';

// the commit rail's modules, loaded by main only when the command commits since this hook runs on every Bash call. The current-branch reader in lib/git-head.mjs degrades to '' rather than throwing, which matters most here: main's catch swallows everything, so a throwing reader would stop this hook guarding in silence
let mergeLayers, resolveProtectedBranches, readCurrentBranch;

// the only decisions this hook writes are ask and deny. It never approves a call or rewrites its input; with nothing to say it writes nothing and Claude Code's own permission flow decides
function decide(decision, reason) {
  const hookSpecificOutput = decision === 'deny'
    ? { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason }
    : { hookEventName: 'PreToolUse', permissionDecision: 'ask', permissionDecisionReason: reason };
  process.stdout.write(JSON.stringify({ hookSpecificOutput }) + '\n');
}

// what a command is gets read by lib/git-segments.mjs: a segment counts only when its command word is git, and both rails read that one function so they always agree. That anchor also retired the old deny gate: detection used to be any-position and refusal was narrowed back to command-position by a second rule, because a wide reader saw rg -t sh "git commit" too. Reading only the command word makes those silent up front, so there's one rule and not two. What the reader declines to see is listed in references/git-publish.md rail 3 as the accepted cost of deleting the tokenizer


// the protected-branch decision for a git commit, or null when there's nothing to say (on_protected allow, no branch, branch not protected). It returns and doesn't write so main can order the rails
/**
 * @param {string} root Cadence project root (holds .planning/)
 * @param {string} cwd
 * @returns {{decision: string, reason: string} | null}
 */
function commitDecision(root, cwd) {
  const repoLayer = join(root, '.planning', 'config.json');
  // mergeLayers warnings[]: taken off the call and acted on below, not dropped; a layer that failed to parse is the one whose protected_branches and on_protected this function was about to decide with
  const { config, warnings, tornLayers } = mergeLayers(repoLayer);
  const git = config.git || {};

  // keyed on a config layer having failed to parse and not on a protected-branch hit: keying on the hit would fire only on main, never in the case worth catching, where the user's own custom protected_branches list was lost
  // either layer, not the repo layer alone: protected_branches and on_protected come from the merged config, so the user-global layer decides this rail as often as the repo one and is the likelier home of a machine-wide list. Matching only the repo path let a torn ~/.claude/cadence/config.json revert the rails to defaults in silence. The sibling rail in git-publish already refuses on any layer's warning
  // the trade, stated because it's a real cost: while a user's global config is torn, every git commit in every Cadence project on that machine asks. Accepted because the torn layer carries the settings this rail decides with, the alternative is the silent revert, the prompt names the one file to fix, and a warning still never produces a deny. Rejected: gating the global arm on whether that layer would have decided anything here, which is unprovable since it couldn't be read
  // tornLayers names the layer files that couldn't be used, and each warning is the message for one of them, so the first warning is the one to show
  const torn = tornLayers.length ? warnings : [];
  // one coercion for all four readers (lib/protected-branches.mjs), which carries the #38 lone-string handling
  const protectedBranches = resolveProtectedBranches(git);

  // "deny" is the decision word the harness uses, so accept it as an alias of refuse and don't silently degrade the intended hard block to a soft ask (#38)
  const raw = git.on_protected === 'deny' ? 'refuse' : git.on_protected;
  const onProtected = raw || 'ask';
  const branch = readCurrentBranch(cwd);

  // computed before the torn-layer arm, not after: that arm returns ask, so returning it first would turn a configured deny into an ask whenever the repo layer was torn and the global layer carried on_protected=refuse, a torn file silently weakening a hard block
  const branchDecision = (() => {
    if (onProtected === 'allow') return null;
    if (!branch) return null; // not a repo / no commits - nothing to guard
    if (!protectedBranches.includes(branch)) return null;
    const refuse = onProtected === 'refuse';
    return {
      decision: refuse ? 'deny' : 'ask',
      reason: `Cadence rail: "${branch}" is a protected branch (git.protected_branches). ` +
        (refuse
          ? 'Config git.on_protected=refuse blocks this commit - create a task branch first.'
          : 'Create a task branch first, or approve to commit here deliberately.'),
    };
  })();

  if (torn.length) {
    const note = `Cadence rail: ${torn[0]} - the branch rails are deciding with `
      + 'DEFAULTS, not your settings.';
    // a parse warning never produces a deny and never cancels one either: an existing hard block keeps its decision and gains the reason
    if (branchDecision && branchDecision.decision === 'deny') {
      return { decision: 'deny', reason: `${note} ${branchDecision.reason}` };
    }
    return { decision: 'ask', reason: `${note} Fix the file, or approve to commit under the defaults.` };
  }
  return branchDecision;
}

const has = (dir, name) => existsSync(join(dir, name));

/** The push rail's probe: .git counts as present only when it's a directory. A linked worktree's or a submodule's .git is a file, so the walk climbs on to the project that owns it; a nested clone's is a directory and ends it. */
const hasForPush = (dir, name) => {
  if (name !== '.git') return has(dir, name);
  try { return statSync(join(dir, name)).isDirectory(); } catch { return false; }
};

// a -C argument as a path, or null when this reader can't know it: empty, a variable or substitution ($ or a backtick), a ~, or quoting it can't strip as one matching pair around the whole word. The command text arrives before the shell expands it, so -C "$S" is the literal "$S" here
function literalDir(raw) {
  let w = raw;
  if (/^(["']).*\1$/s.test(w) && w.length >= 2) w = w.slice(1, -1);
  if (!w || /[$`"'\\]/.test(w) || w.startsWith('~')) return null;
  return w;
}

// the protected-branch decision for one git commit, in the repository it lands in. With no -C that's the session directory; a literal -C path is followed (cumulatively, as git applies them) and policed only if it's a Cadence project, so a scratch repo under /tmp stays silent. A -C it can't resolve keeps the old reading of the session directory, so nothing that asked before goes quiet, and says which -C value it couldn't follow
function commitFor(dirs, cwd, cwdRoot) {
  if (!dirs.length) return cwdRoot ? commitDecision(cwdRoot, cwd) : null;
  let target = cwd;
  for (const raw of dirs) {
    const dir = literalDir(raw);
    if (dir === null) {
      if (!cwdRoot) return null;
      const d = commitDecision(cwdRoot, cwd);
      return d && {
        decision: d.decision,
        reason: `Cadence rail: cannot tell which repository \`git -C ${raw || '(no path)'}\` commits in, `
          + `so this read the session directory instead. ${d.reason.replace(/^Cadence rail: /, '')}`,
      };
    }
    target = resolve(target, dir);
  }
  const root = planningRoot(target, has);
  return root ? commitDecision(root, target) : null;
}

// no process.exit anywhere below: exiting right after a stdout write can truncate it on a pipe, so plain returns let the stream drain and the process exit 0 naturally, which is the hook contract
async function main() {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  const command = String(input?.tool_input?.command || '');
  const cwd = input?.cwd || process.cwd();

  // only police Cadence projects. The walk goes up from cwd because the hook's cwd can sit below the project root (a session opened in src/), and checking only cwd would let every commit from a subdirectory slip under the rails
  const root = planningRoot(cwd, has);
  const calls = gitInvocations(command);
  const verbs = calls.map((c) => c.verb);

  // a push needs no config: every Bash git push asks with no exemption, because cad-land's unattended publish runs through the git-publish seam as a subprocess this hook never sees. It has its own lookup, hasForPush: a worktree or submodule beneath the project is the project's, while root stays the plain walk the commit rail judges by
  if (verbs.includes('push') && planningRoot(cwd, hasForPush)) {
    decide('ask', 'Cadence rail: workflows never push - publishing is /cad-land\'s ' +
      'call (references/git-publish.md rail 3). Approve only if you are deliberately publishing.');
    return;
  }

  if (!verbs.includes('commit')) return;
  ({ mergeLayers } = await import('./lib/config-merge.mjs'));
  ({ resolveProtectedBranches } = await import('./lib/protected-branches.mjs'));
  ({ readCurrentBranch } = await import('./lib/git-head.mjs'));

  // each commit is judged in its own repository; across several in one command a deny beats an ask, and the first reason of the winning kind is shown
  let pick = null;
  for (const call of calls) {
    if (call.verb !== 'commit') continue;
    const d = commitFor(call.dirs, cwd, root);
    if (d && (!pick || (d.decision === 'deny' && pick.decision !== 'deny'))) pick = d;
  }
  if (pick) decide(pick.decision, pick.reason);
}

main().catch(() => { /* never block on a guard failure */ });
