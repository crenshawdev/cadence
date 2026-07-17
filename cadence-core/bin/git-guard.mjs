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
//                        works in one step. ONE exemption: when the REPO config
//                        sets git.auto_close, the fully explicit plain publish
//                        `git push [safe-flags] <remote-name> <current-branch>`
//                        of a non-protected branch is allowed silently
//                        (cad-land's sanctioned unattended integration-branch
//                        publish). The exemption is a strict whitelist
//                        (isPlainPush): anything it does not positively
//                        recognize - a force/delete/unknown flag, a refspec, a
//                        quoted token, a shell metacharacter, a path/URL
//                        remote, an implicit (bare) push, a protected-or-HEAD
//                        branch, or a global-only auto_close - still asks.
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

// isPlainPush is a strict WHITELIST, not a dangerous-flag blacklist: it exempts
// only the shapes it can positively recognize as a plain publish and rejects
// everything else, because a blacklist silently passes anything it forgot (git
// decomposes `-fu` into `-f -u` and force-pushes; `-d` is `--delete`;
// `--receive-pack=evil` retargets the push). These are the ONLY flags a plain
// publish may carry.
//   Long flags: exactly these, with no `=value` (a `--flag=value` can retarget).
const PUSH_SAFE_LONG = new Set(['--set-upstream', '--quiet', '--verbose',
  '--progress', '--porcelain']);
//   Short-flag letters: a `-xyz` cluster is safe ONLY if every letter is one of
//   these (u=set-upstream, q=quiet, v=verbose), so `-u`/`-q`/`-uq` pass but
//   `-fu` (force), `-f`, `-d` (delete), `-o` (push-option) are rejected.
const PUSH_SAFE_SHORT = new Set(['u', 'q', 'v']);

// True ONLY for the fully explicit plain publish
// `git push [safe-flags] <remote-name> <current-branch>`: the segment carries
// nothing but whitelisted flags (PUSH_SAFE_LONG / PUSH_SAFE_SHORT), no `src:dst`
// refspec, and EXACTLY TWO positionals - a bare remote NAME (letters, digits,
// `.`, `_`, `-` only: never a filesystem path or URL, which would exfiltrate
// the branch to an unvetted destination) followed by exactly `branch`. So
// `git push -u origin <branch>`, `git push origin <branch>`, and
// `git push -uq origin <branch>` qualify; bare `git push` and `git push origin`
// (no branch) do NOT - under `push.default=matching` an implicit push publishes
// ALL matching branches including protected ones, so the sanctioned shape must
// name the current branch explicitly. This is deliberately NARROWER than the
// plan's illustrative "bare git push qualifies": tightened after the blocking
// security review found the implicit forms and unvalidated remotes were
// silently-allowed dangerous-push vectors. A force/delete/unknown flag, a
// `--x=y`, a `src:dst` refspec, extra positionals, or a positional naming
// another/protected/HEAD branch all return false. ANY unrecognized shape
// returns false and the caller falls through to the existing ask.
//   Every token must also stay inside a strict safe character set
// (SAFE_TOKEN): a shell metacharacter glued to a token survives the
// whitespace split (`origin>~/.bashrc` is ONE word, yet the shell honors the
// `>` and truncates the file), and a lone `&` (background) or a separate
// `>/tmp/x` redirect token never appears in the sanctioned publish - any
// token carrying `>`, `<`, `&`, `~`, `*`, `?`, `(`, `)`, `=`, `!`, `#`, ...
// returns false. `:` stays in the set so the refspec check below still fires.
// A quoted or backslash-escaped token in the push segment makes the parsed
// shape diverge from what the shell executes (`git push origin "main"` parses
// as `git push origin`), so it also returns false - the exemption never runs
// on a token it cannot read literally.
//   The exemption fires ONLY for a SINGLE lone statement that begins with
// `git push` - the exact sanctioned unattended-publish shape. Any of these
// disqualifies it (the sanctioned publish carries none):
//   - a chained/compound statement or pipe: after splitting on `&&`, `||`, `;`,
//     `|`, and newline there must be exactly one non-empty segment, else a
//     second command smuggles past a first plain-looking push (`git push origin
//     b; git push origin b:main`, `git push origin b && rm -rf x`);
//   - command substitution or a subshell anywhere (a backtick, `$(`, or `${`) -
//     the executed shape can diverge from the parsed tokens or run code;
//   - a leading `VAR=val` env-var prefix - `git` must be the FIRST token
//     (`gi === 0`), so `GIT_SSH_COMMAND=... git push` (RCE via git's transport)
//     cannot precede it; an absolute path (`/usr/bin/git`) is still words[0].
//   And `push` must be the FIRST word after `git`, with NO global option before
// it. Any global option preceding `push` - a `-c` config injection (`-c
// remote.origin.pushurl=...` retargets the destination, `-c core.sshCommand=...`
// is RCE, `-c http.proxy=...`), a `--config-env=...`, or an alternate
// `--git-dir`/`--work-tree`/`--namespace`/`--exec-path` - could retarget the
// push or alter its ref context, and the sanctioned publish
// (`git push -u origin <branch>`) carries none of them. A `-c key=val` cannot be
// safely whitelisted per-flag (its value points anywhere), so requiring `push`
// immediately after `git` closes the whole pre-push global position at once.
//   The only characters a sanctioned-publish token may carry. `/` `.` `-` `_`
// stay in because branch names legitimately use them; `:` stays in so the
// explicit `src:dst` refspec check still fires (and rejects); everything else
// - redirects, background `&`, globs, tildes, `=`, subshell parens - is a
// shell metacharacter or an escape hatch the sanctioned publish never carries.
const SAFE_TOKEN = /^[A-Za-z0-9._/@:+-]+$/;
//   The remote positional must be a bare remote NAME - no slash, colon, or
// `@` - so a filesystem path (`/tmp/evil`, `../evil`) or URL can never stand
// in as the push destination.
const REMOTE_NAME = /^[A-Za-z0-9._-]+$/;
function isPlainPush(command, branch, protectedBranches) {
  const raw = String(command);
  // A backtick, `$(`, or `${` anywhere means command substitution or a subshell:
  // the executed shape can diverge from the parsed tokens, or arbitrary code
  // runs to build an argument. The sanctioned publish carries none - refuse.
  if (/`|\$\(|\$\{/.test(raw)) return false;
  // The sanctioned publish is a SINGLE lone statement. Split the RAW command
  // (no quote-strip: stripping quotes here would erase whole tokens - `"main"`
  // -> nothing - and let a protected-branch push look plain) on the shell
  // statement separators; there must be exactly ONE non-empty segment. Any
  // chaining (`&&`, `||`, `;`), pipe (`|`), or newline smuggles a second
  // command past a first plain-looking push (`git push origin b; git push
  // origin b:main`), so more than one statement disqualifies the exemption.
  const segments = raw.split(/&&|\|\||[;|\n]/).map((s) => s.trim()).filter(Boolean);
  if (segments.length !== 1) return false;
  const segment = segments[0];
  const words = segment.split(/\s+/).filter(Boolean);
  // `git` must be the FIRST token (gi === 0): no leading `VAR=val` env-var
  // assignment (a `GIT_SSH_COMMAND=...`/`GIT_PROXY_COMMAND=...`/`LD_PRELOAD=...`
  // prefix is code execution via git's transport) and no other command may
  // precede it. An absolute path (`/usr/bin/git`) is still words[0], so the
  // `endsWith('/git')` match keeps it qualifying.
  if (!(words[0] === 'git' || words[0].endsWith('/git'))) return false;
  // `push` must sit IMMEDIATELY after `git` (no global option between them):
  // a pre-push global flag could retarget the push destination or alter its
  // ref context (config injection, alternate git-dir/namespace/exec-path),
  // and the sanctioned unattended publish never carries one.
  const si = 1;
  if (words[si] !== 'push') return false;
  // A quote or backslash anywhere in the push segment means the parsed shape
  // can differ from the executed shape - refuse to reason about it.
  if (/["'\\]/.test(segment)) return false;
  // Every token must stay inside the safe character set: a redirect or other
  // metacharacter GLUED to a token rides through the whitespace split as one
  // word (`origin>~/.bashrc` word-splits as a single "remote", yet the shell
  // still honors the `>` and truncates the file), and a lone `&` or a
  // separate `>/tmp/x` token is never part of the sanctioned publish.
  for (const w of words) {
    if (!SAFE_TOKEN.test(w)) return false;
  }
  let positional = 0;
  for (const w of words.slice(si + 1)) {
    if (w.includes(':')) return false;                 // src:dst refspec
    if (w.startsWith('--')) {                           // long flag
      if (!PUSH_SAFE_LONG.has(w)) return false;         // unknown / any --x=y
      continue;
    }
    if (w.startsWith('-')) {                            // short-flag cluster
      const letters = w.slice(1);
      if (letters.length === 0) return false;           // bare '-'
      for (const ch of letters) {
        if (!PUSH_SAFE_SHORT.has(ch)) return false;     // e.g. -f, -d, -fu, -o
      }
      continue;
    }
    positional++;
    if (positional === 1) {                             // the remote
      if (!REMOTE_NAME.test(w)) return false;           // path/URL is not a name
      continue;
    }
    if (positional > 2) return false;                   // extra positional
    if (w !== branch || w === 'HEAD' || protectedBranches.includes(w)) {
      return false;                                     // not the current branch
    }
  }
  // EXACTLY two positionals: bare `git push` (push.default=matching publishes
  // every matching branch, protected ones included) and `git push origin`
  // (same implicit-branch hazard) never qualify - the sanctioned unattended
  // publish always names its remote and its current branch explicitly.
  return positional === 2;
}

// The current branch name, or '' on any failure (not a repo / no commits).
function currentBranch(cwd) {
  try {
    return execFileSync('git', ['-C', cwd, 'rev-parse', '--abbrev-ref', 'HEAD'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch { return ''; }
}

// git.auto_close read from the REPO config layer ONLY (never the merged/global
// value): a user-global auto_close must not silently mute the push guard in an
// unrelated Cadence project (review finding 2).
function repoAutoClose(root) {
  try {
    const repo = JSON.parse(readFileSync(join(root, '.planning', 'config.json'), 'utf8'));
    return repo?.git?.auto_close === true;
  } catch { return false; }
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

  const { config } = mergeLayers(join(root, '.planning', 'config.json'));
  const git = config.git || {};
  const protectedBranches = Array.isArray(git.protected_branches)
    ? git.protected_branches : ['main', 'master'];

  if (isPush) {
    // Exempt ONLY a plain publish push of the current non-protected branch, and
    // ONLY when the REPO config sets git.auto_close - cad-land's sanctioned
    // unattended integration-branch publish (D-07). A force/refspec/--all push,
    // a protected-branch HEAD, a global-only auto_close, and every push with
    // auto_close off all still ask (D-08 + rail 3).
    const branch = currentBranch(cwd);
    if (repoAutoClose(root) && branch && branch !== 'HEAD' &&
        !protectedBranches.includes(branch) &&
        isPlainPush(command, branch, protectedBranches)) {
      return; // silent allow: the sanctioned unattended publish
    }
    decide('ask', 'Cadence rail: workflows never push - publishing is /cad-land\'s ' +
      'call (references/git.md rail 3). Approve only if you are deliberately publishing. ' +
      '(A plain publish of the current non-protected branch under repo git.auto_close is exempt.)');
    return;
  }

  // git commit: enforce the protected-branch guard from config.
  const onProtected = git.on_protected || 'ask';
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
