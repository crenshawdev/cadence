#!/usr/bin/env node
// @ts-check
// forge.mjs - detect which forge CLI this repo can use, or create the repo on it. One JSON line on stdout.
// It never prompts: a stdin read in a Bash call hangs the workflow, so the questions live in workflow prose.
// No forge CLI output reaches an envelope, so a credential in an instance URL stays out of the transcript.
//   detect [--dir <path>]   --dir is the planning root and the repo
//   create --provider <p> --repo <owner/name> --confirmed [--remote-url <url>] [--dir <path>]
//     Makes a PRIVATE repo. --remote-url is required where create wires no remote (forgejo, github), refused on gitlab.
'use strict';

import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { mergeLayers } from './lib/config-merge.mjs';
import { emit } from './lib/seam-io.mjs';
import { CONTRACTS, requireFlag } from './lib/arg-contract.mjs';
import { redactUrl } from './lib/redact-url.mjs';
import { onPath } from './lib/on-path.mjs';
import { classifyOrigin, loginNamesHost } from './lib/issue-decision.mjs';
import {
  CREATE_TABLE, PROVIDER_TABLE, decideForge, installedProviders, originDefaults,
  splitForgeHost, splitSlug,
} from './lib/forge-decision.mjs';

/** Bounds the one `git` read: a local config read, so this guards a wedged filesystem rather than latency. */
const GIT_TIMEOUT_MS = 10000;

/** A network write to a maybe-slow instance, so longer, but still bounded: a wedged CLI mustn't hang setup. */
const CREATE_TIMEOUT_MS = 60000;

/** `tea login list` only reads tea's own config, so it gets the git read's bound, as its own constant. */
const LOGIN_TIMEOUT_MS = 10000;

/**
 * Run a command, bounded, and never throw. SIGKILL because a child that ignores SIGTERM outlives its own timeout.
 * Stderr is dropped at the spawn, since the default passes a failing CLI's stderr to the terminal and leaks it.
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
 * The origin URL as `git` reports it, or ''. No origin, not a repo and no git all mean the same: no default to offer.
 * @param {string} dir @returns {string}
 */
function readOrigin(dir) {
  return run('git', ['-C', dir, 'remote', 'get-url', 'origin'],
    { cwd: dir, timeout: GIT_TIMEOUT_MS }).stdout.trim();
}

/**
 * The login serving `host` as `{name, user}`, or null when none does.
 * Not an auth check: the forgejo argv needs to know if the owner is the user's account or an org.
 * Guessing it already failed live, so null refuses upstream.
 * Matching goes through `loginNamesHost`, so this never grows a host rule that could disagree with land time.
 * The port rides with the host: two Forgejo instances on one machine differ only by port.
 * A name that is empty or starts with `-` would read as a flag, so it's skipped, not sanitized into a plausible one.
 *
 * @param {string} bin @param {string} dir @param {string} host
 * @param {string|null} httpPort the classification's port, or null
 * @returns {{name: string, user: string}|null}
 */
function teaLoginFor(bin, dir, host, httpPort) {
  const probe = run(bin, ['login', 'list', '--output', 'json'],
    { cwd: dir, timeout: LOGIN_TIMEOUT_MS });
  if (!probe.ok) return null;
  let records;
  try { records = JSON.parse(probe.stdout); } catch { return null; }
  if (!Array.isArray(records)) return null;
  for (const rec of records) {
    if (!loginNamesHost(rec, host, httpPort)) continue;
    const name = typeof rec.name === 'string' ? rec.name.trim() : '';
    const user = typeof rec.user === 'string' ? rec.user.trim() : '';
    if (name === '' || user === '' || name.startsWith('-')) continue;
    return { name, user };
  }
  return null;
}

/**
 * The record goes through `mergeLayers`, not a file read, because provider and host can sit in either layer.
 * `warnings` rides every envelope so a corrupt layer shows up here instead of looking like an absent one.
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

  // the refusal is the only ok:false arm; the envelope keeps one shape on all three so prose can read `.provider` first
  if (decision.action === 'refuse') {
    emit({
      ok: false, action: 'refuse', reason: decision.reason,
      installed: [], provider, repo, host,
      detail: null, hint: decision.hint, warnings,
    });
    return;
  }

  // defaults ride `ask` alone, and so does the git read behind them: nothing else has a question to pre-fill
  // `classifyOrigin` takes the URL alone, so only github and gitlab get a provider default
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
 * Every refusal comes before the create: a check after it would report on a repo that already exists, with no undo.
 * The login probe is the one command ahead of that line, and it only reads.
 * `--confirmed` is the caller's word that it asked the user, since the seam can't ask without hanging on stdin.
 * Visibility isn't a parameter: `CREATE_TABLE` pins `--private` on every row.
 *
 * @param {string} dir the directory the CLI is run in, and the planning root
 *   whose persisted `git.forge_host` names the instance to check the URL against
 * @param {{provider: string, repo: string, confirmed: boolean,
 *   remoteUrl: string|undefined}} args
 */
function create(dir, { provider, repo, confirmed, remoteUrl }) {
  if (!confirmed) {
    emit({ ok: false, reason: 'this create was not confirmed: no repository is created without the user answering the question first',
      detail: null,
      hint: 'put the confirmation to the user - naming the provider, the owner, the repository name and that it will be PRIVATE - and pass --confirmed only once they have said yes' });
    return;
  }
  // presence is worded here, not at the argument door, so a caller who named neither flag hears what create needs
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
  // a provider outside the table has no argv and no binary; the hint lists the table's own keys
  const row = Object.prototype.hasOwnProperty.call(CREATE_TABLE, provider)
    ? CREATE_TABLE[provider] : null;
  if (!row) {
    emit({ ok: false, reason: `no forge provider is spelled "${provider}": there is no way to create a repository through it`,
      detail: null,
      hint: `pass --provider as one of ${Object.keys(CREATE_TABLE).join(', ')}` });
    return;
  }
  // one slug grammar here and at setup, so no segment can read as a flag once it's in the argv
  const parts = splitSlug(repo);
  if (!parts) {
    emit({ ok: false, reason: 'the repository selector is not an owner/name a forge serves',
      detail: null,
      hint: 'pass --repo as owner/name - letters, digits, dot, underscore and dash, no leading dash on any segment, and a nested GitLab subgroup path is allowed' });
    return;
  }
  // whether a URL is needed comes off `wiresRemote`, and it's settled before the spawn: no place for origin, no create
  // a URL opening on `-` is refused outright: it would read as a flag in `git remote add`
  const classified = classifyOrigin(remoteUrl);
  if (!row.wiresRemote) {
    const usable = typeof remoteUrl === 'string' && !remoteUrl.startsWith('-')
      && classified.host !== null && classified.slug !== null;
    if (!usable) {
      emit({ ok: false, reason: `${provider} does not wire a git remote when it creates a repository, and no usable --remote-url was given to wire one with`,
        detail: null,
        hint: 'pass --remote-url as the URL this repository will be reached at - https://<host>/<owner>/<name>.git or git@<host>:<owner>/<name>.git - so origin can be set once the repository exists' });
      return;
    }
  } else if (remoteUrl !== undefined) {
    // a row that wires its own remote never reads `--remote-url`, so a caller who passed one got silence. GH-105
    // keyed on `wiresRemote`, not "gitlab", so a new such row inherits the refusal
    emit({ ok: false, reason: `${provider}'s create wires origin itself, through the --remoteName origin pinned in its own create argv, so a --remote-url passed here would be read by nothing and origin would be whatever ${PROVIDER_TABLE[provider]} chose`,
      detail: null,
      hint: `drop --remote-url on ${provider} - the create sets origin, and there is no second URL for it to take` });
    return;
  }

  // does this URL name the configured instance? Before the PATH check and login probe, so a refusal spawns nothing
  // keyed on the persisted port, never a provider name: github and gitlab carry a null host
  const { config, warnings } = mergeLayers(join(dir, '.planning', 'config.json'));
  const instance = splitForgeHost((config.git || {}).forge_host ?? null);
  // fold case here: `splitForgeHost` keeps what was typed, so an exact match skipped `Forge.Example.COM:3001`
  if (instance && instance.port !== null
    && classified.host === instance.hostname.toLowerCase()) {
    // a different host isn't compared: an ssh host differing from the web host is a working shape
    // (a) http(s) is comparable with its port spelled or defaulted, so a persisted :3001 mismatches `https://h`
    // (b) no port and not http(s) is scp form, which implies 22; the hint names the two spellings that pass
    // (c) a port over a non-http(s) scheme is accepted: an ssh port and a web port are different endpoints
    const urlPort = classified.httpPort !== null ? classified.httpPort
      : (classified.portSpelled ? null : '22');
    if (urlPort !== null && urlPort !== instance.port) {
      emit({
        ok: false,
        reason: `this repository's forge instance is ${instance.hostname} on port ${instance.port}, but --remote-url names port ${urlPort} on that same host: an origin wired to it would answer nothing`,
        detail: null, warnings,
        hint: `pass --remote-url naming the configured port - https://${instance.hostname}:${instance.port}/<owner>/<name>.git, or ssh://git@${instance.hostname}:<ssh-port>/<owner>/<name>.git when the SSH endpoint is on a different port - or change git.forge_host if the instance really moved`,
      });
      return;
    }
  }

  const bin = PROVIDER_TABLE[provider];
  if (!onPath(bin)) {
    emit({ ok: false, reason: `${provider} was selected but ${bin} does not resolve on PATH, so there is nothing to create the repository with`,
      detail: null, warnings,
      hint: `install ${bin} and re-run this step, or re-run setup and pick a provider whose CLI is installed` });
    return;
  }

  // `tea repos create --owner` looks the name up as an org and fails for a personal repo, so ask who's logged in
  // it refuses rather than fall back to the argv that already failed; host and port come off `--remote-url`
  const { owner, name } = parts;
  let login = null;
  if (row.needsLogin) {
    login = classified.host === null
      ? null : teaLoginFor(bin, dir, classified.host, classified.httpPort);
    if (!login) {
      emit({ ok: false, reason: `no ${bin} login serves ${classified.host ?? 'that instance'}, so there is no way to tell whether ${owner} is your own account or an organization there`,
        detail: null, warnings,
        hint: `run \`${bin} login add\` for that instance and re-run this step - ${bin} needs a login on it before a repository can be created with the right owner` });
      return;
    }
  }

  if (!run(bin, row.argv(owner, name, login), { cwd: dir, timeout: CREATE_TIMEOUT_MS }).ok) {
    // the child's own text isn't carried: a forge CLI's stderr is exactly where a token or authenticated URL turns up
    emit({ ok: false, reason: `${bin} could not create ${owner}/${name}: the create command failed`,
      detail: null, warnings,
      hint: `run ${bin} yourself in this directory to see why - a missing login and a name already taken are the two common answers - then re-run this step` });
    return;
  }

  // the repository exists from here, so a failure says so; glab runs no git command at all
  if (!row.wiresRemote) {
    if (!run('git', ['-C', dir, 'remote', 'add', 'origin', remoteUrl],
      { cwd: dir, timeout: GIT_TIMEOUT_MS }).ok) {
      emit({ ok: false, reason: `${owner}/${name} was created on ${provider}, but git remote add origin failed: the repository exists and this checkout cannot reach it`,
        detail: null, warnings, created: true, remote_wired: false,
        hint: 'add the remote yourself - `git remote add origin <url>` in this directory - the repository is already there and must not be created again' });
      return;
    }
  }

  emit({ ok: true, provider, owner, repo: `${owner}/${name}`,
    visibility: 'private', remote_wired: true, detail: null, warnings });
}

const argv = process.argv.slice(2);
const cmd = argv[0];

const ROWS = CONTRACTS['forge.mjs'];

/** One flag read, resolved against the declared row; this seam states no flag rule of its own. */
const arg = (sub, name) => requireFlag(argv, name, ROWS[sub][name] || ROWS['*'][name]);

/**
 * The same read as a value door only: a bad value refuses by name, and an absent flag reads as `undefined`.
 * Otherwise a missing `--repo` would blame `--provider`, so `create` words presence itself.
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
      remoteUrl: value('--remote-url'),
    });
  } else {
    emit({ ok: false, reason: 'usage',
      detail: 'subcommands: detect [--dir <path>] | create --provider <p> '
        + '--repo <owner/name> --confirmed [--dir <path>]' });
  }
} catch (e) {
  // `requireFlag` puts the refusing flag on `.seam` and `.detail`; anything else is ours, so `redactUrl` the message
  if (e && e.seam) {
    emit({ ok: false, reason: e.seam, detail: e.detail,
      hint: 'the detail names the flag that refused - give it a value of the kind that flag takes and re-run the command' });
  } else {
    emit({ ok: false, reason: 'internal', detail: redactUrl(e && e.message ? e.message : String(e)) });
  }
}
