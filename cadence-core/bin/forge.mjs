#!/usr/bin/env node
// @ts-check
// forge.mjs - the workflow-facing seam over lib/forge-decision.mjs. It tells
// the setup step in workflows/new-project.md and workflows/adopt.md which of
// three things to do about the forge (FRG-01): nothing, because this repository
// already answered; ask, naming the forge CLIs that actually resolve here; or
// refuse, because a forge is a PRECONDITION (FRG-02) and none is installed.
// One JSON line on stdout. `detect` READS - it never writes a config and never
// prompts - and `create` is the one face that mutates anything, behind a
// confirmation the caller has to have collected first.
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
// NO THIRD-PARTY OUTPUT REACHES THE ENVELOPE (CONTEXT D-16). `detect` spawns no
// forge CLI at all; `create` spawns exactly one and DISCARDS its stderr at the
// spawn while never reading its stdout, so neither has third-party bytes to
// leak. `detail` is null on every arm of both, which keeps that true by
// construction rather than by whichever spawns happen to exist today. A refusal
// names what was looked for and what was asked of it, never what was read
// back - the reason already says what failed, and a failing CLI's own text
// buys nothing to pay for carrying a credential out of the child's environment.
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
// `create` IS THE ONE FACE THAT MUTATES, AND IT IS AN ARGV (CONTEXT D-03). The
// repository is created by handing the selected CLI a fixed argument VECTOR
// from `CREATE_TABLE`, never as shell prose the coordinator composes. Two
// reasons, both measured: the argv-recording stub AC6 asserts against only ever
// reaches a SPAWNED CHILD, and `bin/git-guard.mjs` guards `git push` and `git
// commit` alone - so a raw Bash `gh repo create` would pass the hook unseen.
// Every value that reaches the vector went through this phase's own slug
// grammar first, so no segment can arrive reading as a flag.
//
// AND IT NEVER RUNS WITHOUT `--confirmed`. The flag is what the user's own
// answer buys: the seam cannot ask (see above), so it refuses until a caller
// says the question was put and answered. That is half the property - the seam
// proves a flag was passed, and `bin/prose-agreement.test.mjs` proves the
// workflow puts the question BEFORE it passes one.
//
// Subcommands (two, each printing one JSON line):
//   detect [--dir <path>]
//     --dir is the planning root AND the repository the answer is about.
//     ABSENT means the process cwd; an EMPTY or valueless --dir REFUSES
//     (`missing-flag-value`, exit 1) before anything is read, spelled exactly
//     as issue-check.mjs's is - the two seams are read by the same prose and a
//     flag that refuses in one and defaults in the other is how a caller learns
//     the wrong rule.
//   create --provider <p> --repo <owner/name> --confirmed [--dir <path>]
//     Creates that repository, PRIVATE, through the CLI the provider names.
//     --dir is the directory the CLI is run in. Every refusal precedes the
//     spawn, so a refused create has created nothing.
'use strict';

import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { mergeLayers } from './lib/config-merge.mjs';
import { emit } from './lib/seam-io.mjs';
import { CONTRACTS, requireFlag } from './lib/arg-contract.mjs';
import { redactUrl } from './lib/redact-url.mjs';
import { onPath } from './lib/on-path.mjs';
import { classifyOrigin } from './lib/issue-decision.mjs';
import {
  CREATE_TABLE, PROVIDER_TABLE, decideForge, installedProviders, originDefaults, splitSlug,
} from './lib/forge-decision.mjs';

/** The bound on the ONE `git` read this seam makes. `git remote get-url` is a
 * local config read that cannot hang on a network, so this is a guard against a
 * wedged filesystem rather than a latency budget - and it is a constant rather
 * than a flag because there is no caller that would ever want a different one.
 * issue-check.mjs's own constant is the same figure for the same reason. */
const GIT_TIMEOUT_MS = 10000;

/** The bound on the ONE forge-CLI call `create` makes. Larger than the git
 * read's, and for the opposite reason: this one is a NETWORK WRITE against an
 * instance that may be slow to answer, and a create that is killed halfway is
 * the one outcome with no honest report - the repository may or may not exist.
 * Bounded all the same, because a wedged CLI must not hang project setup. */
const CREATE_TIMEOUT_MS = 60000;

/**
 * Run a command, bounded, and never throw - `run` in issue-check.mjs, verbatim
 * in discipline. `killSignal: 'SIGKILL'` because a child that ignores SIGTERM
 * would otherwise outlive its own timeout, which is the whole point of a bound.
 *
 * THE CHILD'S STDERR IS DISCARDED AT THE SPAWN (CONTEXT D-16), not captured and
 * then withheld: with no `stdio` given, execFileSync passes a failing CLI's
 * stderr straight through to the terminal the workflow is printing into, which
 * is the same leak as putting it on the envelope. So a failure is a boolean and
 * nothing else, and the caller's own reason line says what failed.
 *
 * @param {string} bin @param {string[]} args
 * @param {{cwd: string, timeout: number}} opts
 * @returns {{ok: boolean, stdout: string}}
 */
function run(bin, args, { cwd, timeout }) {
  try {
    return {
      ok: true,
      stdout: execFileSync(bin, args, {
        cwd, timeout, killSignal: 'SIGKILL', encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }),
    };
  } catch { return { ok: false, stdout: '' }; }
}

/**
 * The origin URL as `git` reports it, or ''. A repository with no `origin`, a
 * directory that is not a repository at all, and a `git` that is not installed
 * are all the same answer here: no default to offer. There is nothing to
 * degrade, because a default is an offer and not a reading.
 * @param {string} dir @returns {string}
 */
function readOrigin(dir) {
  return run('git', ['-C', dir, 'remote', 'get-url', 'origin'],
    { cwd: dir, timeout: GIT_TIMEOUT_MS }).stdout.trim();
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

/**
 * Create the repository the caller named, through the CLI its provider names.
 *
 * EVERY REFUSAL PRECEDES THE SPAWN. That ordering is the property, not a
 * tidiness: a check made after the create would report a failure about a
 * repository that now exists on somebody's instance, and there is no undo for
 * that from here. So the confirmation, the provider, the selector and the
 * binary are all settled before anything is run.
 *
 * WHAT `--confirmed` MEANS, and why the seam takes a flag for it. This module
 * cannot ask - a seam blocking on stdin inside a Bash tool call would hang the
 * workflow (CONTEXT D-12) - so the flag is the caller's assertion that it put
 * the question and got an answer. It proves only that a flag was passed; that
 * the flag FOLLOWS a real question is `bin/prose-agreement.test.mjs`'s half,
 * asserted against the workflow's own text. Neither half is sufficient alone.
 *
 * VISIBILITY IS NOT A PARAMETER (CONTEXT D-04). `CREATE_TABLE` pins `--private`
 * on every row and takes no visibility argument, so there is nothing here to
 * pass and nothing for a caller to get wrong.
 *
 * @param {string} dir the directory the CLI is run in
 * @param {{provider: string, repo: string, confirmed: boolean}} args
 */
function create(dir, { provider, repo, confirmed }) {
  if (!confirmed) {
    emit({ ok: false, reason: 'this create was not confirmed: no repository is created without the user answering the question first',
      detail: null,
      hint: 'put the confirmation to the user - naming the provider, the owner, the repository name and that it will be PRIVATE - and pass --confirmed only once they have said yes' });
    return;
  }
  // PRESENCE, worded here rather than at the argument door (see `value` below):
  // a caller who named neither flag is told what `create` needs, not which flag
  // the door happened to read first.
  for (const [flag, what, hint] of [
    ['--provider', 'no forge was named to create it on',
      `pass --provider as one of ${Object.keys(CREATE_TABLE).join(', ')}`],
    ['--repo', 'no repository was named to create',
      'pass --repo as owner/name - the same selector the setup step persists as git.forge_repo'],
  ]) {
    if ((flag === '--provider' ? provider : repo) === undefined) {
      emit({ ok: false, reason: `create needs ${flag}: ${what}`, detail: null, hint });
      return;
    }
  }
  // A provider outside the table has no argv to run and no binary to look for,
  // so it is refused before either is consulted. The list in the hint is the
  // table's own keys, so the sentence a user reads cannot name a provider the
  // lookup would then miss.
  const row = Object.prototype.hasOwnProperty.call(CREATE_TABLE, provider)
    ? CREATE_TABLE[provider] : null;
  if (!row) {
    emit({ ok: false, reason: `no forge provider is spelled "${provider}": there is no way to create a repository through it`,
      detail: null,
      hint: `pass --provider as one of ${Object.keys(CREATE_TABLE).join(', ')}` });
    return;
  }
  // ONE grammar decides what a repository reference may be, here and at setup:
  // `splitSlug` runs this phase's own slug rule before it splits. That is what
  // stops a segment reading as a FLAG once it sits in the argument vector.
  const parts = splitSlug(repo);
  if (!parts) {
    emit({ ok: false, reason: 'the repository selector is not an owner/name a forge serves',
      detail: null,
      hint: 'pass --repo as owner/name - letters, digits, dot, underscore and dash, no leading dash on any segment, and a nested GitLab subgroup path is allowed' });
    return;
  }
  const bin = PROVIDER_TABLE[provider];
  if (!onPath(bin)) {
    emit({ ok: false, reason: `${provider} was selected but ${bin} does not resolve on PATH, so there is nothing to create the repository with`,
      detail: null,
      hint: `install ${bin} and re-run this step, or re-run setup and pick a provider whose CLI is installed` });
    return;
  }

  const { owner, name } = parts;
  if (!run(bin, row.argv(owner, name), { cwd: dir, timeout: CREATE_TIMEOUT_MS }).ok) {
    // The child's own text is NOT carried (CONTEXT D-16): the reason already
    // names the provider and the operation, and a forge CLI's stderr is exactly
    // where a token or an authenticated URL turns up.
    emit({ ok: false, reason: `${bin} could not create ${owner}/${name}: the create command failed`,
      detail: null,
      hint: `run ${bin} yourself in this directory to see why - a missing login and a name already taken are the two common answers - then re-run this step` });
    return;
  }

  emit({ ok: true, provider, owner, repo: `${owner}/${name}`,
    visibility: 'private', remote_wired: row.wiresRemote, detail: null });
}

const argv = process.argv.slice(2);
const cmd = argv[0];

const ROWS = CONTRACTS['forge.mjs'];

/** One flag read, resolved against the declared row - this seam states no flag
 * rule of its own (CONTEXT D-17). */
const arg = (sub, name) => requireFlag(argv, name, ROWS[sub][name] || ROWS['*'][name]);

/**
 * The same read, as a VALUE DOOR ONLY: a flag PRESENT with a missing, empty or
 * malformed value is refused here by name, and a flag genuinely ABSENT reads as
 * `undefined` even where its row says `required: true`.
 *
 * That split is `review-provider.mjs`'s, stated in its own header and adopted
 * here for the same reason: `create` is the one row in this table with TWO
 * required flags, so a door that answered presence would refuse a caller who
 * omitted `--provider` by naming `--provider` while the caller's real question
 * was about `--repo`. PRESENCE belongs to `create` below, which words it as
 * what the caller has to go and do. The declared row is still what judges the
 * value - `required` is the one field this view sets aside.
 * @param {string} name
 */
const value = (name) => requireFlag(argv, name, { ...ROWS.create[name], required: false });

try {
  if (cmd === 'detect') {
    detect(arg('detect', '--dir') || process.cwd());
  } else if (cmd === 'create') {
    create(arg('create', '--dir') || process.cwd(), {
      provider: value('--provider'),
      repo: value('--repo'),
      confirmed: value('--confirmed'),
    });
  } else {
    emit({ ok: false, reason: 'usage',
      detail: 'subcommands: detect [--dir <path>] | create --provider <p> '
        + '--repo <owner/name> --confirmed [--dir <path>]' });
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
