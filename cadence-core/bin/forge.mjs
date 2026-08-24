#!/usr/bin/env node
// @ts-check
// forge.mjs - the workflow-facing seam over lib/forge-decision.mjs. It tells
// the setup step in workflows/new-project.md and workflows/adopt.md which of
// three things to do about the forge (FRG-01): nothing, because this repository
// already answered; ask, naming the forge CLIs that actually resolve here; or
// refuse, because a forge is a PRECONDITION (FRG-02) and none is installed.
// One JSON line on stdout. `detect` is the only subcommand and it READS: it
// never writes a config, never creates a repository and never prompts.
//
// THE SEAM DETECTS, VALIDATES AND ANSWERS - IT NEVER PROMPTS (CONTEXT D-12).
// The question is asked in workflow prose through the ask-user seam, because a
// seam blocking on stdin inside a Bash tool call would hang the workflow that
// ran it. The answers come back through the EXISTING `config.mjs set` against
// `.planning/config.json` (CONTEXT D-09) - there is no writer here, which is
// what keeps `checkPairs`, `retiredKeyError` and the `repo_only` write-time
// refusal on the path that persists this phase's answers rather than beside it.
//
// NO SUBPROCESS RUNS DURING DETECTION (CONTEXT D-06, AC1). "Installed" means
// the bare name resolves as an executable on the CHILD's PATH through
// `lib/on-path.mjs`, which is pure fs. No `--version` call, no `tea login list`,
// no auth check: this phase resolves WHERE issue writes will go, and whether
// the user is logged in is a question land time already has its own named line
// for. That module reads no Cadence environment override, which is what makes a
// PATH-injected stub exercise the PRODUCTION resolver rather than a test-only
// branch beside it - the discipline issue-check.mjs's header states at length.
//
// NO THIRD-PARTY OUTPUT REACHES THE ENVELOPE (CONTEXT D-16). Nothing on this
// path spawns a forge CLI at all, so there are no third-party bytes to leak,
// and `detail` is null on every arm to keep that true by construction rather
// than by the current absence of a spawn. The refusal names the binaries it
// looked for and nothing it read.
//
// ONE SUBPROCESS, AND IT IS `git`. The `ask` arm reads `git remote get-url
// origin` to offer the repository slug as a default the user CONFIRMS rather
// than retypes. That read is bounded, discards the child's stderr and never
// throws, so a directory that is not a repository and a missing `origin` are
// both simply "no default to offer" - a default is an offer, not a reading,
// and there is nothing there to degrade. Its OUTPUT never reaches the envelope
// raw either: it goes through `classifyOrigin` and then through this phase's
// own slug grammar, and a value failing that grammar yields no default rather
// than passing repository content into the shell line that persists it.
//
// Subcommand (one, printing one JSON line):
//   detect [--dir <path>]
//     --dir is the planning root AND the repository the answer is about.
//     ABSENT means the process cwd; an EMPTY or valueless --dir REFUSES
//     (`missing-flag-value`, exit 1) before anything is read, spelled exactly
//     as issue-check.mjs's is - the two seams are read by the same prose and a
//     flag that refuses in one and defaults in the other is how a caller learns
//     the wrong rule.
'use strict';

import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { mergeLayers } from './lib/config-merge.mjs';
import { emit } from './lib/seam-io.mjs';
import { CONTRACTS, requireFlag } from './lib/arg-contract.mjs';
import { redactUrl } from './lib/redact-url.mjs';
import { onPath } from './lib/on-path.mjs';
import { classifyOrigin } from './lib/issue-decision.mjs';
import { decideForge, installedProviders, originDefaults } from './lib/forge-decision.mjs';

/** The bound on the ONE `git` read this seam makes. `git remote get-url` is a
 * local config read that cannot hang on a network, so this is a guard against a
 * wedged filesystem rather than a latency budget - and it is a constant rather
 * than a flag because there is no caller that would ever want a different one.
 * issue-check.mjs's own constant is the same figure for the same reason. */
const GIT_TIMEOUT_MS = 10000;

/**
 * The origin URL as `git` reports it, or '' - NEVER a throw and never a byte of
 * the child's stderr, the way `run` in issue-check.mjs works. A repository with
 * no `origin`, a directory that is not a repository at all, and a `git` that is
 * not installed are all the same answer here: no default to offer. There is
 * nothing to degrade, because a default is an offer and not a reading.
 * @param {string} dir @returns {string}
 */
function readOrigin(dir) {
  try {
    return execFileSync('git', ['-C', dir, 'remote', 'get-url', 'origin'], {
      cwd: dir, timeout: GIT_TIMEOUT_MS, killSignal: 'SIGKILL', encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch { return ''; }
}

/**
 * The one reading, and the one answer.
 *
 * The persisted record is read through `mergeLayers`, not `readFileSync`: the
 * provider and the instance host are settable in EITHER layer (CONTEXT D-02),
 * so a user with one self-hosted Forgejo sets the host once globally and every
 * repository that names ITSELF inherits it. Reading the repo file alone would
 * ask that user the same question in every checkout. `warnings` is BOUND here
 * and rides every envelope below - a corrupt layer is diagnosable at the step
 * that read it rather than silently identical to an absent one.
 *
 * @param {string} dir the planning root and the repository this is about
 */
function detect(dir) {
  const { config, warnings } = mergeLayers(join(dir, '.planning', 'config.json'));
  const git = config.git || {};
  const provider = git.forge_provider ?? null;
  const repo = git.forge_repo ?? null;
  const host = git.forge_host ?? null;

  const installed = installedProviders(onPath);
  const decision = decideForge({ provider, repo, host, installed });

  // The refusal is the ONE ok:false arm, and it carries no installed entries
  // because reaching it means none resolved. The three persisted values ride it
  // anyway, at whatever they are: the envelope shape is uniform across the
  // three actions on purpose, so prose reading `.provider` does not have to
  // know which arm it is on first.
  if (decision.action === 'refuse') {
    emit({
      ok: false, action: 'refuse', reason: decision.reason,
      installed: [], provider, repo, host,
      detail: null, hint: decision.hint, warnings,
    });
    return;
  }

  // `configured` and `ask` both carry the persisted values, and the `ask` arm
  // needs them most: a partly answered record - a forgejo provider and a slug
  // with no instance host yet - must leave the setup step asking only the
  // missing question rather than re-asking the two that are already settled.
  //
  // DEFAULTS RIDE THE `ask` ARM ALONE, and so does the `git` read that produces
  // them. There is no question to pre-fill on either of the other two, so
  // reading the origin there would be a spawn bought for an unused field - and
  // AC1's assertion is about forge CLIs, which `git` is not and which nothing
  // on this path runs. `classifyOrigin` takes the URL and nothing else - this
  // phase probes no login (CONTEXT D-06), and that is why the provider default
  // is available for `github` and `gitlab` alone (CONTEXT D-07): those are the
  // two the hostname identifies without asking anybody.
  const defaults = decision.action === 'ask'
    ? originDefaults(classifyOrigin(readOrigin(dir)))
    : null;

  emit({
    ok: true, action: decision.action, reason: decision.reason,
    installed, provider, repo, host,
    ...(defaults ? { defaults } : {}),
    detail: null, warnings,
  });
}

const argv = process.argv.slice(2);
const cmd = argv[0];

const ROWS = CONTRACTS['forge.mjs'];

/** One flag read, resolved against the declared row - this seam states no flag
 * rule of its own (CONTEXT D-17). */
const arg = (sub, name) => requireFlag(argv, name, ROWS[sub][name] || ROWS['*'][name]);

try {
  if (cmd === 'detect') {
    detect(arg('detect', '--dir') || process.cwd());
  } else {
    emit({ ok: false, reason: 'usage', detail: 'subcommand: detect [--dir <path>]' });
  }
} catch (e) {
  // The refusal `requireFlag` raises carries the flag that refused on `.seam`
  // and `.detail`; anything else is this seam's own fault and says so, with the
  // message through `redactUrl` so a credential in a path never rides it out.
  if (e && e.seam) {
    emit({ ok: false, reason: e.seam, detail: e.detail,
      hint: 'the detail names the flag that refused - give it a value of the kind that flag takes and re-run the command' });
  } else {
    emit({ ok: false, reason: 'internal', detail: redactUrl(e && e.message ? e.message : String(e)) });
  }
}
