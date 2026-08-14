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
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { mergeLayers, GLOBAL_CONFIG } from './lib/config-merge.mjs';
import { gitVerbs } from './lib/git-segments.mjs';
import { resolveProtectedBranches } from './lib/protected-branches.mjs';

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

// The current branch name, or '' on any failure (not a repo / no commits).
function currentBranch(cwd) {
  try {
    return execFileSync('git', ['-C', cwd, 'rev-parse', '--abbrev-ref', 'HEAD'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch { return ''; }
}

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
  const branch = currentBranch(cwd);

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

// No process.exit() anywhere below: the decision JSON is written to stdout,
// and exiting right after a write can truncate it on a pipe (the same rule
// lib/seam-io.mjs pins for the seam scripts). Plain returns let the stream
// drain; the process exits 0 naturally, which is the hook contract.
function main() {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  const command = String(input?.tool_input?.command || '');
  const cwd = input?.cwd || process.cwd();

  // Only police Cadence projects (walk-up, see planningRoot).
  const root = planningRoot(cwd);
  if (!root) return;
  const verbs = gitVerbs(command);

  // A push needs no config: EVERY Bash `git push` asks unconditionally - no
  // exemption of any kind lives here (rail 3). cad-land's sanctioned unattended
  // publish runs through the git-publish seam as a subprocess argv push, which
  // is not a Bash tool call, so this hook never sees it.
  if (verbs.includes('push')) {
    decide('ask', 'Cadence rail: workflows never push - publishing is /cad-land\'s ' +
      'call (references/git-publish.md rail 3). Approve only if you are deliberately publishing.');
    return;
  }

  if (verbs.includes('commit')) {
    const d = commitDecision(root, cwd);
    if (d) { decide(d.decision, d.reason); return; }
  }
}

try { main(); } catch { /* never block on a guard failure */ }
