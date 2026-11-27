#!/usr/bin/env node
// @ts-check
// PreToolUse hook: the inviolable git rails, enforced by the harness instead of prose, for Bash tool calls
// acts only inside a Cadence project (a .planning/ dir in the cwd or above) and stays silent elsewhere
// the push rail's walk climbs past a .git file (linked worktree, submodule), so a push from one under the project counts
// git push asks when it can reach a protected branch or the rail can't rule that out; cad-land's publish is never seen
// a pull or merge request opened or merged with gh, glab or tea always asks; cad-land's own go through that seam too
// git commit or git merge on a protected branch follows git.on_protected: ask (default), refuse (alias "deny") or allow
// git.guard_bypass true in both config layers turns the push and commit rails off; the request and merge rails stay
// an internal error exits 0, so a broken guard can't block work
'use strict';

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { forgeRequests, gitInvocations, planningRoot, segments } from './lib/git-segments.mjs';

// the rails' modules load only when the command pushes, commits or merges, since this hook runs on every Bash call
let mergeLayers, bothLayers, resolveProtectedBranches, readCurrentBranch, readPushConfig;

// push options taking a separate argument, skipped with it so the remote and the refspecs read right
const PUSH_OPT_WITH_ARG = new Set(['-o', '--push-option', '--receive-pack', '--exec', '--repo']);
// git takes any unambiguous prefix of a long option, so --mirr is --mirror
const EVERY_BRANCH = ['--all', '--branches', '--mirror'];
// a word no quoting, expansion or globbing can change, so what the rail reads is what git gets
const PLAIN_WORD = /^[A-Za-z0-9._/:+=@,-]+$/;
// git verbs that can run before a push in one command without moving its branch, its repository or its config
const SAFE_BEFORE = new Set(['add', 'commit', 'status', 'diff', 'log', 'show', 'tag', 'fetch', 'pull']);
// the commit and merge rails' list: these stage or read, so a commit or merge after one lands where it would have
const STAGES_OR_READS = new Set(['add', 'rm', 'mv', 'restore', 'status', 'diff', 'log', 'show', 'tag', 'fetch', 'pull']);

/**
 * What a push can reach, read off its own plain words. Wrong costs a prompt, never a bypass, so what it can't read
 * asks. `fromConfig` is whether git config picks a destination: no refspec, or one with no `:dst`.
 * @param {string[]} args the words after `push`
 * @param {string} branch the branch checked out where the push runs
 * @param {string[]} protectedBranches
 * @returns {{reach: string | null, fromConfig: boolean}} reach says what protected ref it can land on, or null
 */
function pushTarget(args, branch, protectedBranches) {
  const opts = args.map((w) => w.split('=')[0]).filter((o) => o.length > 2);
  if (opts.some((o) => EVERY_BRANCH.some((e) => e.startsWith(o)))) {
    return { reach: 'can reach every branch, the protected ones included', fromConfig: false };
  }
  const operands = [];
  for (let i = 0; i < args.length; i++) {
    if (PUSH_OPT_WITH_ARG.has(args[i])) { i++; continue; }
    if (!args[i].startsWith('-')) operands.push(args[i]);
  }
  // the first operand is the remote; with no refspec git pushes the branch checked out, and --tags pushes only tags
  const refspecs = operands.slice(1);
  if (!refspecs.length) {
    if (args.includes('--tags')) return { reach: null, fromConfig: false };
    const reach = protectedBranches.includes(branch) ? `can reach protected branch "${branch}" (git.protected_branches)` : null;
    return { reach, fromConfig: true };
  }
  let fromConfig = false;
  for (const spec of refspecs) {
    const parts = spec.replace(/^\+/, '').split(':');
    // git reads heads/main and refs/heads/main as main, and @ as HEAD
    const name = (parts[1] || parts[0]).replace(/^(refs\/)?heads\//, '');
    if (parts.length > 2 || !name) {
      return { reach: `names a refspec the hook can't read (${spec}), so it may reach a protected branch`, fromConfig };
    }
    if (parts.length === 1) fromConfig = true;
    const reached = name === 'HEAD' || name === '@' ? branch : name;
    if (protectedBranches.includes(reached)) {
      return { reach: `can reach protected branch "${reached}" (git.protected_branches)`, fromConfig };
    }
  }
  return { reach: null, fromConfig };
}

/**
 * The git config that can land a push somewhere its words don't name, or null. push.default simple, current and
 * nothing keep a branch's own name; the rest, any remote.<name>.push and a remote.<name>.mirror can send it to main.
 * @param {string[] | null} lines readPushConfig's answer
 * @returns {string | null}
 */
function configRedirect(lines) {
  if (lines === null) return 'git config the rail could not read';
  let pushDefault = '';
  for (const line of lines) {
    const [key, value = ''] = line.split(/ (.*)/s);
    if (key.endsWith('.push') || key.endsWith('.mirror')) return key;
    pushDefault = value; // the last scope git lists is the one in force
  }
  return pushDefault && !['simple', 'current', 'nothing'].includes(pushDefault) ? `push.default=${pushDefault}` : null;
}

const BYPASS_KEY = 'git.guard_bypass';
const bypassed = (root) => bothLayers(root, [BYPASS_KEY]).keys[BYPASS_KEY].on;

// only ask and deny get written; with nothing to say it writes nothing and Claude Code's own permission flow decides
function decide(decision, reason) {
  const hookSpecificOutput = decision === 'deny'
    ? { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason }
    : { hookEventName: 'PreToolUse', permissionDecision: 'ask', permissionDecisionReason: reason };
  process.stdout.write(JSON.stringify({ hookSpecificOutput }) + '\n');
}

// the push and branch rails read the project's layers here, and each acts on a torn one
function readLayers(root) {
  // mergeLayers warnings[]: acted on by both callers; a layer that failed to parse is what decides protected_branches
  const { config, warnings, tornLayers } = mergeLayers(join(root, '.planning', 'config.json'));
  return { config, warnings, tornLayers };
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
  const { config, warnings, tornLayers } = readLayers(root);
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

// the push decision, in the repository a plain -C names or the session directory; the bypass turns it off
// it stays quiet only when what it read is what git will run, so the shell, an earlier command or a global option
// that could change where the push lands makes it ask
function pushFor({ dirs, opts, args, at }, calls, cwd) {
  const plainDirs = dirs.every((d) => PLAIN_WORD.test(d));
  const target = plainDirs ? dirs.reduce((dir, d) => resolve(dir, d), cwd) : cwd;
  const root = planningRoot(target, hasForPush);
  if (!root || bypassed(root)) return null;
  const { config, warnings, tornLayers } = readLayers(root);
  const publishing = 'Workflows never push - publishing is /cad-land\'s call (references/git-publish.md rail 3). '
    + 'Approve only if you are deliberately publishing.';
  // a lost protected list can't say which branch is safe, so a torn layer asks on every push
  if (tornLayers.length) {
    return { decision: 'ask', reason: `Cadence rail: ${warnings[0]} - the push rail is deciding with DEFAULTS, so it asks. ${publishing}` };
  }
  const ask = (why) => ({ decision: 'ask', reason: `Cadence rail: this push ${why}. ${publishing}` });
  const unclear = 'so it may reach a protected branch';
  if (!plainDirs) return ask(`runs in a repository the hook can't tell (-C ${dirs.find((d) => !PLAIN_WORD.test(d))}), ${unclear}`);
  const odd = [...opts, ...args].find((w) => !PLAIN_WORD.test(w));
  if (odd !== undefined) return ask(`has a word the shell can change before git sees it (${odd}), ${unclear}`);
  if (opts.length) return ask(`carries git ${opts[0]}, which can change its repository or its config, ${unclear}`);
  const before = calls.filter((c) => c.at < at);
  if (before.length !== at || before.some((c) => !SAFE_BEFORE.has(c.verb))) {
    return ask(`comes after a command that can change its branch, its repository or its config, ${unclear}`);
  }
  const { reach, fromConfig } = pushTarget(args, readCurrentBranch(target), resolveProtectedBranches(config.git || {}));
  if (reach) return ask(reach);
  if (!fromConfig) return null;
  const redirect = configRedirect(readPushConfig(target));
  return redirect && ask(`lands where ${redirect} says, ${unclear}`);
}

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

// a git switch or checkout inside (, {, a prefix or a quote: the segment's head isn't git, but the branch still moves
const switchesInside = (words) => words.some((w, i) => /(^|[^\w-])git$/.test(w)
  && words.slice(i + 1).some((v) => /^["'(]?(switch|checkout)["')]*$/.test(v)));

/**
 * Where the commands before segment `at` leave a commit or merge: the directory an absolute cd moved it to, and
 * whether one can switch its branch or repository past what the rail follows. Cadence's own commits run set, [ and
 * for first, so anything that isn't git, a forge CLI or a directory change passes.
 * @param {{words: string[], join: string}[]} segs @param {{verb: string, at: number}[]} calls @param {number} at
 * @param {string} cwd
 * @returns {{dir: string, moved: boolean}}
 */
function landsFrom(segs, calls, at, cwd) {
  let dir = cwd;
  let moved = false;
  for (let i = 0; i < at; i++) {
    const { words, join } = segs[i];
    const [head, ...rest] = words;
    const name = head.slice(head.lastIndexOf('/') + 1);
    if (head === 'cd') {
      // followed only when it surely ran here and && runs the rest after it: after || or | it may not have, ; runs on
      // past a failed cd, & or | is a subshell, and a relative path goes wherever a CDPATH the hook can't see says
      const ran = ['', ';', '\n', '&&', '&'].includes(i ? segs[i - 1].join : '');
      const path = rest.length === 1 && rest[0].startsWith('/') && PLAIN_WORD.test(rest[0]);
      if (ran && join === '&&' && path) dir = resolve(dir, rest[0]);
      else moved = true;
    } else if (head === 'pushd' || head === 'popd' || name === 'gh' || name === 'glab' || name === 'tea') {
      moved = true;
    } else if (name === 'git') {
      if (!STAGES_OR_READS.has(calls.find((c) => c.at === i)?.verb ?? '')) moved = true;
    } else if (switchesInside(words)) {
      moved = true;
    }
  }
  return { dir, moved };
}

// a commit or merge after a command the rail can't follow asks in the project it lands in, unless its rail is off there
function movedDecision(verb, dirs, dir) {
  const lits = dirs.map(literalDir);
  const root = planningRoot(lits.includes(null) ? dir : lits.reduce((t, d) => resolve(t, /** @type {string} */ (d)), dir), has);
  if (!root || (verb === 'commit' && bypassed(root))) return null;
  if (readLayers(root).config.git?.on_protected === 'allow') return null;
  return { decision: 'ask', reason: `Cadence rail: this ${verb} comes after a command that can change its branch or `
    + `its repository, so it may land on a protected branch (git.protected_branches). Approve only if it lands where you mean.` };
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
  const segs = segments(command);
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

  if (verbs.some((v) => v === 'push' || v === 'commit' || v === 'merge')) {
    ({ mergeLayers, bothLayers } = await import('./lib/config-merge.mjs'));
    ({ resolveProtectedBranches } = await import('./lib/protected-branches.mjs'));
    ({ readCurrentBranch, readPushConfig } = await import('./lib/git-head.mjs'));
    // each push, commit or merge is judged in its own repo
    for (const call of calls) {
      if (call.verb === 'push') {
        const d = pushFor(call, calls, cwd);
        if (d) picks.push(d);
        continue;
      }
      if (call.verb !== 'commit' && call.verb !== 'merge') continue;
      // --abort and --quit back a merge out and land nothing; --continue makes the merge commit, so it's judged
      if (call.verb === 'merge' && call.args.some((w) => w === '--abort' || w === '--quit')) continue;
      const { dir, moved } = landsFrom(segs, calls, call.at, cwd);
      let d = branchFor(call.verb, call.dirs, dir, dir === cwd ? root : planningRoot(dir, has));
      // the moved-branch ask only adds one: a deny the branch checked out earns stays a deny
      if (moved && d?.decision !== 'deny') d = movedDecision(call.verb, call.dirs, dir) ?? d;
      if (d) picks.push(d);
    }
  }

  // across every rail a deny beats an ask, and the first reason of that kind shows
  const pick = picks.find((p) => p.decision === 'deny') || picks[0];
  if (pick) decide(pick.decision, pick.reason);
}

main().catch(() => { /* never block on a guard failure */ });
