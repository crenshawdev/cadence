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
//                        call (references/git-publish.md rail 3); the user decides at
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
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { mergeLayers, GLOBAL_CONFIG } from './lib/config-merge.mjs';
import { gitInvocations, planningRoot } from './lib/git-segments.mjs';
import { resolveProtectedBranches } from './lib/protected-branches.mjs';
// The current-branch reader lives in lib/ because three seams ask this same
// question. It degrades to '' rather than throwing, which matters most HERE:
// main()'s catch swallows everything, so a throwing reader would make this hook
// stop guarding in silence.
import { readCurrentBranch } from './lib/git-head.mjs';

function decide(decision, reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: decision,
      permissionDecisionReason: reason,
    },
  }) + '\n');
}

// What a command IS, is read by lib/git-segments.mjs: a segment counts only
// when its command word is `git`, and the verb is its first non-flag word.
// Both rails read that one function, so they always agree on what a command IS
// (D-07). The anchor is also what retired the old deny gate: detection used to
// be any-position and refusal was then narrowed back to command-position with
// a second rule, because a wide reader saw `rg -t sh "git commit"` too. Reading
// only the command word makes those silent up front, so there is one rule
// instead of two and `denyable` has nothing left to express. What the reader
// declines to see is listed in references/git-publish.md rail 3 as the accepted cost of
// deleting the tokenizer.


// The protected-branch decision for a `git commit`, or null when there is
// nothing to say (on_protected: allow, no branch, branch not protected). It
// returns rather than writes so main() can order the rails.
/**
 * @param {string} root Cadence project root (holds .planning/)
 * @param {string} cwd
 * @returns {{decision: string, reason: string} | null}
 */
function commitDecision(root, cwd) {
  const repoLayer = join(root, '.planning', 'config.json');
  // mergeLayers warnings[]: taken off the call and ACTED ON below, not dropped.
  // A layer that failed to parse is exactly the layer whose protected_branches
  // and on_protected this function was about to decide with.
  const { config, warnings } = mergeLayers(repoLayer);
  const git = config.git || {};

  // Keyed on a config layer having failed to parse (D-17) and NOT on a
  // protected-branch hit: keying it to the hit would fire only when the user
  // happens to be on `main`, and never in the case actually worth catching -
  // where their own custom protected_branches list is the thing that was lost.
  //
  // EITHER LAYER, not the repo layer alone. `protected_branches` and
  // `on_protected` are read from the merged config, so the user-global layer
  // decides this rail exactly as often as the repo layer does - and it is the
  // likelier place for a machine-wide list to live. Matching only the repo path
  // meant a torn ~/.claude/cadence/config.json reverted the rails to DEFAULTS in
  // silence, which is the silence this whole arm exists to end. The sibling rail
  // already refuses on ANY layer's warning (references/git-publish.md, rail 3;
  // git-publish.mjs:116-118), so before this the two rails disagreed about one
  // diagnostic.
  //
  // THE TRADE, stated because it is a real cost and not a one-line patch: while
  // a user's global config is torn, EVERY `git commit` in EVERY Cadence project
  // on that machine returns `ask`. Accepted, on four grounds - the torn layer is
  // the one carrying the settings this rail decides with; the alternative is the
  // silent revert to defaults; the prompt names the ONE file to fix, so the cost
  // is self-limiting rather than open-ended; and a warning still never produces a
  // `deny` (the fail-open contract above stands). REJECTED alternative: gating
  // the global arm on "would the global layer have decided anything here" - that
  // is unprovable by construction, since the layer could not be read.
  //
  // ANCHORED on both ends, never a bare `includes(<path>)`. A mergeLayers
  // warning is a FLAT STRING with no layer field, shaped `config layer <path>
  // failed to parse...` or `config layer <path> top-level is not an object...`
  // (lib/config-merge.mjs:55, :162), so a bare containment reads a GLOBAL-layer
  // warning as a torn repo layer whenever the global path has the repo path as
  // a prefix (`CADENCE_GLOBAL_CONFIG=<root>/.planning/config.json.global`) or as
  // a suffix (`<elsewhere>/<root>/.planning/config.json`). Both layers ask now,
  // so that conflation no longer changes the decision - but it would still put
  // the WRONG path in the prompt, sending the user to fix a file that parsed
  // fine. The path must be followed by the space that delimits it from the
  // diagnosis. An empty GLOBAL_CONFIG contributes no prefix at all: `homedir()`
  // throws where the uid has no passwd entry and config-merge degrades it to
  // `''` (lib/config-merge.mjs:22-26), and `config layer  ` must never match a
  // real path.
  const tornPrefixes = [`config layer ${repoLayer} `];
  if (GLOBAL_CONFIG) tornPrefixes.push(`config layer ${GLOBAL_CONFIG} `);
  const torn = (warnings || []).filter(
    (w) => typeof w === 'string' && tornPrefixes.some((p) => w.startsWith(p)));
  // One coercion for all four readers (lib/protected-branches.mjs), which
  // carries the #38 lone-string reasoning this callsite used to state inline.
  const protectedBranches = resolveProtectedBranches(git);

  // git commit: enforce the protected-branch guard from config. "deny" is
  // the decision word the harness uses, so accept it as an alias of refuse
  // instead of silently degrading the intended hard block to a soft ask (#38).
  const raw = git.on_protected === 'deny' ? 'refuse' : git.on_protected;
  const onProtected = raw || 'ask';
  const branch = readCurrentBranch(cwd);

  // The ordinary protected-branch decision, computed BEFORE the torn-layer arm
  // below rather than after it. The torn arm returns `ask`, so returning it
  // first would turn a configured `deny` into an `ask` whenever the repo layer
  // was the torn one and the GLOBAL layer carried on_protected=refuse - a torn
  // file silently weakening a hard block, which is worse than the silence this
  // diagnostic replaces.
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
    // A parse warning never PRODUCES a deny, and never CANCELS one either: an
    // existing hard block keeps its decision and gains the reason.
    if (branchDecision && branchDecision.decision === 'deny') {
      return { decision: 'deny', reason: `${note} ${branchDecision.reason}` };
    }
    return { decision: 'ask', reason: `${note} Fix the file, or approve to commit under the defaults.` };
  }
  return branchDecision;
}

const has = (dir, name) => existsSync(join(dir, name));

// A `-C` argument as a path, or null when this reader cannot know it: empty, a
// variable or a substitution (`$`, a backtick), a `~`, or quoting it cannot
// strip as one matching pair around the whole word. The command text arrives
// before the shell expands it, so `-C "$S"` is the literal `"$S"` here.
function literalDir(raw) {
  let w = raw;
  if (/^(["']).*\1$/s.test(w) && w.length >= 2) w = w.slice(1, -1);
  if (!w || /[$`"'\\]/.test(w) || w.startsWith('~')) return null;
  return w;
}

// The protected-branch decision for ONE `git commit`, in the repository it
// actually lands in. With no `-C` that is the session directory, as before. A
// literal `-C` path is followed (cumulatively, as git applies them) and that
// repository is policed only if it is a Cadence project - a scratch repo under
// /tmp is not, so it stays silent. A `-C` this reader cannot resolve keeps the
// old reading of the session directory, so nothing that asked before goes
// quiet, and says which `-C` value it could not follow.
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

// No process.exit() anywhere below: the decision JSON is written to stdout,
// and exiting right after a write can truncate it on a pipe (the same rule
// lib/seam-io.mjs pins for the seam scripts). Plain returns let the stream
// drain; the process exits 0 naturally, which is the hook contract.
function main() {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  const command = String(input?.tool_input?.command || '');
  const cwd = input?.cwd || process.cwd();

  // Only police Cadence projects. The walk goes up from cwd because the hook's
  // cwd can sit BELOW the project root (a session opened in src/, say), and
  // checking only cwd would let every commit from a subdirectory slip under the
  // rails. lib/git-segments.mjs holds the walk, shared with the recorders.
  const root = planningRoot(cwd, has);
  const calls = gitInvocations(command);
  const verbs = calls.map((c) => c.verb);

  // A push needs no config: EVERY Bash `git push` asks unconditionally - no
  // exemption of any kind lives here (rail 3). cad-land's sanctioned unattended
  // publish runs through the git-publish seam as a subprocess argv push, which
  // is not a Bash tool call, so this hook never sees it.
  if (root && verbs.includes('push')) {
    decide('ask', 'Cadence rail: workflows never push - publishing is /cad-land\'s ' +
      'call (references/git-publish.md rail 3). Approve only if you are deliberately publishing.');
    return;
  }

  // Each commit is judged in its own repository; across several in one
  // command a deny beats an ask, and the first reason of the winning kind is
  // the one shown.
  let pick = null;
  for (const call of calls) {
    if (call.verb !== 'commit') continue;
    const d = commitFor(call.dirs, cwd, root);
    if (d && (!pick || (d.decision === 'deny' && pick.decision !== 'deny'))) pick = d;
  }
  if (pick) decide(pick.decision, pick.reason);
}

try { main(); } catch { /* never block on a guard failure */ }
