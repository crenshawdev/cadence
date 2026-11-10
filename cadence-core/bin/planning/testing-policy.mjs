// @ts-check
// `test-policy render`: the committed form of the accepted testing policy
// named testing-policy, not test-policy, or node's default coverage exclusion skips it
// a file because GitHub Actions can only read what's committed
// check compares text and never runs an accepted command: a config from a clone mustn't choose what runs
// check --base <ref> reports what the config weakens against that ref, but doesn't fail it
// ci-status runs from the main session, never the verifier subagent; no run, no gh or another forge reads pending
// --root is the project root, not --dir, which here is the planning directory
'use strict';

import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boundedRun } from '../lib/bounded-run.mjs';
import { readTestingPolicy } from '../lib/config-merge.mjs';
import { isForgeSlug } from '../lib/forge-decision.mjs';
import { onPath } from '../lib/on-path.mjs';
import { atomicWrite, parseUat, renderUat } from '../lib/planning-files.mjs';
import { localGitEnv, publishAuthorized } from '../lib/publish-authorization.mjs';
import { requirePhaseArg } from '../lib/require-int.mjs';
import { emit } from '../lib/seam-io.mjs';
import { schemaPath } from '../lib/test-seam.mjs';
import { sleep } from '../lib/text-util.mjs';
import { fail, intFlag, ok, phaseSpellingCollision, read } from './core.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
// the same file and the same CADENCE_CONFIG_SCHEMA override as config.mjs, resolved by the one schemaPath
const SCHEMA_PATH = schemaPath(join(HERE, '..', '..', 'config.schema.json'));

/** Where the committed policy lives, relative to the project root. */
export const POLICY_FILE = '.github/cadence/coverage-policy.json';

/** The schema's `testing.*` keys as [dotted path under testing, default], in schema order. */
function schemaKeys() {
  const keys = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8')).keys;
  return Object.entries(keys).filter(([name]) => name.startsWith('testing.'))
    .map(([name, spec]) => /** @type {[string[], any]} */ ([name.split('.').slice(1), spec.default]));
}

/** The value at `path` under `from`, or undefined. */
function at(from, path) {
  let have = from;
  for (const p of path) have = have && typeof have === 'object' ? have[p] : undefined;
  return have;
}

/**
 * The policy in the `testing` section's own nested shape, keys in the schema's
 * order, every unset key at the schema's default. Applied to the config and to
 * the committed file alike, so a key one side omits does not read as a change.
 * @param {any} testing
 */
function fill(testing) {
  /** @type {Record<string, any>} */
  const policy = {};
  for (const [path, dflt] of schemaKeys()) {
    let into = policy;
    for (const p of path.slice(0, -1)) into = into[p] ||= {};
    const have = at(testing, path);
    into[path[path.length - 1]] = have === undefined ? dflt : have;
  }
  return policy;
}

/**
 * Why the config can't say whether a policy was accepted, or null. A torn layer
 * and a scope outside the enum must not read as "none was".
 * @param {{warnings: string[], tornLayers: string[], invalidScope: unknown}} config
 */
function unusableConfig({ warnings, tornLayers, invalidScope }) {
  if (tornLayers.length > 0) return { reason: 'config-unreadable', detail: warnings.join('; ') };
  if (invalidScope === null) return null;
  return { reason: 'invalid-scope', detail: `testing.scope is ${JSON.stringify(invalidScope)}, which is not focused, integrated or thorough, so no policy is accepted` };
}

const UNUSABLE_HINT = 'repair the config file the detail names, or run /cad-config --testing to set testing.scope, then re-run';

/**
 * The accepted policy with defaults filled - or null when the project accepted
 * none - the forge the project names, and why the config is unusable, if it is.
 * @param {string} root
 */
function effectivePolicy(root) {
  const config = readTestingPolicy(join(root, '.planning', 'config.json'));
  return { policy: config.accepted ? fill(config.testing) : null, forgeProvider: config.forgeProvider, unusable: unusableConfig(config) };
}

const SET_FORGE = 'run /cad-config --testing, or name the forge with config.mjs set git.forge_provider=<provider>';

const NO_POLICY_HINT = 'run /cad-config --testing to accept a testing policy first - until then the project behaves as it did before the policy existed';

/**
 * @param {string} root
 */
function cmdRender(root) {
  const { policy, unusable } = effectivePolicy(root);
  if (unusable) return fail(unusable.reason, unusable.detail, UNUSABLE_HINT);
  if (!policy) {
    return fail('no-policy', 'testing.scope is unset, so no policy was accepted and there is nothing to render', NO_POLICY_HINT);
  }
  const file = join(root, POLICY_FILE);
  mkdirSync(dirname(file), { recursive: true });
  atomicWrite(file, `${JSON.stringify(policy, null, 2)}\n`);
  return ok({ file: POLICY_FILE, policy });
}

/**
 * Text as a workflow comparison sees it: full-line YAML comments dropped, `\`
 * line continuations joined, whitespace runs collapsed to one space. Applied to
 * both sides, so a folded or continued command matches and a commented-out one
 * does not.
 * @param {string} text
 */
const normalize = (text) => text.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n')
  .replace(/\\[ \t]*\r?\n/g, ' ').replace(/\s+/g, ' ').trim();

/** Every file directly under `<root>/.github/workflows/`, normalized. */
function workflowTexts(root) {
  const dir = join(root, '.github', 'workflows');
  try {
    return readdirSync(dir).filter((f) => /\.ya?ml$/.test(f)).sort()
      .map((f) => normalize(readFileSync(join(dir, f), 'utf8')));
  } catch { return []; }
}

/** Whether git tracks a file matching `glob`, asked of git so no glob parser is written here. */
function tracksMatch(root, glob) {
  // the exit status answers, stdout is dropped: a listing past the 1 MiB read buffer threw and read as "no match"
  try {
    execFileSync('git', ['-C', root, 'ls-files', '--error-unmatch', '--', `:(glob)${glob}`],
      { env: localGitEnv(), stdio: 'ignore' });
    return true;
  } catch { return false; }
}

/** Elements of `a` that `b` does not hold, as changes of `kind`. */
const only = (kind, a, b) => a.filter((/** @type {string} */ x) => !b.includes(x)).map((/** @type {string} */ name) => ({ kind, name }));

/**
 * What the current policy weakens or changes against the committed file at
 * `ref`, or null when git cannot resolve the ref. The ref goes after
 * `--end-of-options`, so it can never read as an option; the file is then read
 * at the commit it resolved to.
 * @param {string} root
 * @param {string} ref
 * @param {Record<string, any>} now
 */
function againstRef(root, ref, now) {
  const git = (/** @type {string[]} */ args) => execFileSync('git', ['-C', root, ...args],
    { encoding: 'utf8', env: localGitEnv(), stdio: ['ignore', 'pipe', 'ignore'] });
  let sha;
  try { sha = git(['rev-parse', '--verify', '--quiet', '--end-of-options', `${ref}^{commit}`]).trim(); } catch { return null; }
  let held = null;
  try { held = JSON.parse(git(['show', `${sha}:${POLICY_FILE}`])); } catch { /* none at that ref */ }
  if (!held || typeof held !== 'object') {
    return { ref, found: false, changes: [], note: `${POLICY_FILE} is absent or unreadable at ${ref}, so nothing is named` };
  }
  const was = fill(held);
  const changes = [];
  for (const metric of ['lines', 'branches', 'statements']) {
    const [from, to] = [was.coverage[metric], now.coverage[metric]];
    if (from > 0 && to === 0) changes.push({ kind: 'disabled', name: metric, from, to });
    else if (to > 0 && to < from) changes.push({ kind: 'lowered', name: metric, from, to });
  }
  changes.push(...only('exclude_added', now.coverage.exclude, was.coverage.exclude),
    ...only('include_removed', was.coverage.include, now.coverage.include),
    ...only('job_removed', was.required_jobs, now.required_jobs),
    ...only('command_added', now.coverage.commands, was.coverage.commands),
    ...only('command_removed', was.coverage.commands, now.coverage.commands));
  return { ref, found: true, changes };
}

/**
 * @param {string} root
 * @param {unknown} base
 */
function cmdCheck(root, base) {
  const { policy, forgeProvider, unusable } = effectivePolicy(root);
  const publish_authorized = publishAuthorized(root);
  if (unusable) {
    return emit({ ok: false, ...unusable, hint: UNUSABLE_HINT, accepted: null, enforcement: 'unavailable', gate_found: null,
      problems: [unusable.detail], publish_authorized, note: unusable.detail });
  }
  if (!policy) {
    return ok({ accepted: false, publish_authorized,
      detail: 'testing.scope is unset, so no policy was accepted and there is nothing to check', hint: NO_POLICY_HINT });
  }
  const problems = [];
  const against = typeof base === 'string' ? againstRef(root, base, policy) : undefined;
  if (against === null) {
    return fail('bad-ref', `${JSON.stringify(base)} does not resolve to a commit in ${root}`,
      'name a branch, tag or commit that exists in the project repository - --base reads the committed policy file at that ref');
  }

  // The config against the file on disk. Whether it's really committed is git's answer, below.
  let committed = null;
  try { committed = JSON.parse(readFileSync(join(root, POLICY_FILE), 'utf8')); } catch { /* named below */ }
  if (!committed || typeof committed !== 'object') {
    problems.push(`${POLICY_FILE} is missing or unreadable`);
  } else {
    const theirs = fill(committed);
    for (const [path] of schemaKeys()) {
      const [mine, file] = [at(policy, path), at(theirs, path)];
      if (JSON.stringify(mine) !== JSON.stringify(file)) {
        problems.push(`testing.${path.join('.')} is ${JSON.stringify(mine)} in the config and ${JSON.stringify(file)} in ${POLICY_FILE}`);
      }
    }
  }

  const { coverage } = policy;
  for (const glob of coverage.include) {
    if (!tracksMatch(root, glob)) problems.push(`coverage.include "${glob}" matches no tracked file`);
  }

  // The config against the workflow files - GitHub Actions only.
  const enforcement = forgeProvider === 'github' ? 'available' : 'unavailable';
  // Null means nobody answered, which is not another forge. Nothing was compared, so it can't pass.
  const unsetForge = `git.forge_provider is unset, so the workflow files were not compared; ${SET_FORGE}`;
  if (forgeProvider === null) problems.push(unsetForge);
  /** @type {boolean|null} */
  let gate_found = null;
  if (enforcement === 'available') {
    const tracked = Boolean(committed) && tracksMatch(root, POLICY_FILE);
    if (committed && !tracked) problems.push(`${POLICY_FILE} is not tracked by git, so CI and check --base cannot read it; commit it`);
    const texts = workflowTexts(root);
    const named = (/** @type {string} */ s) => texts.some((t) => t.includes(normalize(s)));
    const missing = coverage.commands.filter((/** @type {string} */ c) => !named(
      c.split('{lines}').join(String(coverage.lines)).split('{branches}').join(String(coverage.branches))
        .split('{statements}').join(String(coverage.statements))));
    for (const c of missing) problems.push(`accepted command "${c}" is in no workflow file under .github/workflows/`);
    const absent = policy.required_jobs.filter((/** @type {string} */ j) => !named(j));
    for (const j of absent) problems.push(`required job "${j}" is named in no workflow file under .github/workflows/`);
    if (policy.required_jobs.length === 0) problems.push('no required job is configured');
    if (coverage.commands.length === 0 && ['lines', 'branches', 'statements'].some((m) => coverage[m] > 0)) {
      problems.push('testing.coverage.commands is empty while a coverage threshold is above 0, so no workflow command enforces it');
    }
    gate_found = tracked && coverage.commands.length > 0 && missing.length === 0
      && policy.required_jobs.length > 0 && absent.length === 0;
  }

  const answer = { accepted: true, enforcement, gate_found, problems, publish_authorized,
    ...(against ? { base: against } : {}),
    ...(enforcement === 'unavailable'
      ? { note: forgeProvider === null ? unsetForge : `git.forge_provider is ${JSON.stringify(forgeProvider)}: enforcement is GitHub Actions only, so the workflow files were not compared` }
      : {}) };
  if (problems.length === 0) return ok(answer);
  return emit({ ok: false, reason: 'policy-disagrees', detail: problems.join('; '),
    hint: `run planning.mjs test-policy render --root <project> to rewrite ${POLICY_FILE} from the config, or fix the workflow file the detail names`,
    ...answer });
}


// The longest one call keeps re-reading: under the host's 600-second ceiling on
// a foreground command, with room for the final read.
const MAX_WAIT_S = 540;
const POLL_MS = 15000;
const GH_TIMEOUT_MS = 30000;

/**
 * Every check run on one commit, every page: `--paginate` with a `--jq` that
 * prints one compact object per run, so the pages never have to be stitched
 * back into one JSON document. Null when `gh` fails or prints something else.
 * @param {string} slug
 * @param {string} sha
 * @returns {Array<{name: string, status: string, conclusion: string|null}>|null}
 */
function readCheckRuns(slug, sha) {
  const r = boundedRun('gh', ['api', '--paginate', '--jq', '.check_runs[] | {name, status, conclusion}',
    `repos/${slug}/commits/${sha}/check-runs?per_page=100`], { timeout: GH_TIMEOUT_MS });
  if (!r.ok) return null;
  try {
    return r.stdout.split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
  } catch { return null; }
}

/**
 * One required job's answer from the runs that match it: a run matches on the
 * job's exact name or the name followed by ` (`, which is how a matrix job reads.
 * @param {string} job
 * @param {Array<{name: string, status: string, conclusion: string|null}>} runs
 */
function judgeJob(job, runs) {
  const matches = runs.filter((r) => typeof r.name === 'string' && (r.name === job || r.name.startsWith(`${job} (`)));
  const finished = (/** @type {{status: string}} */ r) => r.status === 'completed';
  let answer = 'pending';
  if (matches.some((r) => finished(r) && r.conclusion !== 'success')) answer = 'fail';
  else if (matches.length > 0 && matches.every((r) => finished(r) && r.conclusion === 'success')) answer = 'pass';
  return { job, answer, runs: matches.map((r) => ({ name: r.name, status: r.status, conclusion: r.conclusion })) };
}

/**
 * @param {string} dir the planning directory
 * @param {string} root
 * @param {Record<string, any>} opts
 */
function cmdCiStatus(dir, root, opts) {
  const sha = typeof opts.commit === 'string' ? opts.commit : '';
  if (!/^[0-9a-fA-F]{7,40}$/.test(sha)) {
    return fail('bad-args', '--commit must be 7 to 40 hexadecimal characters',
      'pass --commit <sha> naming the commit whose required jobs to read, as git rev-parse prints it');
  }
  let wait = 0;
  if (opts.wait !== undefined) {
    const w = intFlag(opts.wait, 0, '--wait must be a whole number of seconds, 0 or more',
      `pass --wait <seconds>, at most ${MAX_WAIT_S} (larger values are held to that), or drop it to read once`);
    if (!w.ok) return;
    wait = Math.min(w.value, MAX_WAIT_S);
  }
  /** @type {{raw: string}|null} */
  let phase = null;
  if (opts.phase !== undefined) {
    const parsed = requirePhaseArg(opts.phase);
    if (!parsed.ok) {
      return fail('bad-args', 'ci-status --phase needs a phase number',
        'pass --phase <N> naming the phase whose UAT.md should record the commit, or drop it');
    }
    const collision = phaseSpellingCollision(dir, parsed);
    if (collision) {
      return fail('bad-args', `ci-status ${collision}`,
        're-run with one of the two spellings the detail names - nothing was read');
    }
    phase = parsed;
  }

  const config = readTestingPolicy(join(root, '.planning', 'config.json'));
  const { testing, accepted, forgeProvider, forgeRepo } = config;
  const unusable = unusableConfig(config);
  if (unusable) return fail(unusable.reason, unusable.detail, UNUSABLE_HINT);
  if (!accepted) return fail('no-policy', 'testing.scope is unset, so no policy was accepted and there are no required jobs to read', NO_POLICY_HINT);
  const required = Array.isArray(testing.required_jobs) ? testing.required_jobs : [];
  const answer = (/** @type {string} */ a, /** @type {Record<string, any>} */ more) => ({ commit: sha.toLowerCase(), answer: a, jobs: [], ...more });

  if (forgeProvider === null) {
    return ok(answer('pending', { reason: `git.forge_provider is unset, so no CI result was read; ${SET_FORGE}` }));
  }
  if (forgeProvider !== 'github') {
    return ok(answer('pending', { reason: `git.forge_provider is ${JSON.stringify(forgeProvider)}: CI results are read from GitHub only, so this stays pending until the checks run some other automated way` }));
  }
  if (required.length === 0) {
    return ok(answer('pending', { reason: 'testing.required_jobs is empty, so there is no job whose success could be read' }));
  }
  if (!isForgeSlug(forgeRepo)) {
    return fail('bad-forge-repo', `git.forge_repo ${JSON.stringify(forgeRepo)} is not an owner/repo name`,
      'set git.forge_repo to the GitHub repository as owner/repo with /cad-config, then re-run');
  }
  if (!onPath('gh')) {
    return ok(answer('pending', { reason: 'gh is not on PATH, so the check runs cannot be read; install and sign in to the GitHub CLI' }));
  }

  const deadline = Date.now() + wait * 1000;
  let judged = null;
  for (;;) {
    const runs = readCheckRuns(String(forgeRepo), sha);
    judged = runs === null ? null : required.map((/** @type {string} */ j) => judgeJob(j, runs));
    const overall = judged === null ? 'pending'
      : judged.some((j) => j.answer === 'fail') ? 'fail'
        : judged.every((j) => j.answer === 'pass') ? 'pass' : 'pending';
    const left = deadline - Date.now();
    if (overall !== 'pending' || left <= 0) {
      const result = answer(overall, { jobs: judged || [],
        ...(judged === null ? { reason: 'gh api failed or timed out, so no check run could be read' } : {}) });
      if (overall !== 'pass' || phase === null) return ok(result);
      const file = join(dir, 'phases', phase.raw, 'UAT.md');
      const text = read(file);
      if (text === null) {
        return emit({ ok: false, reason: 'no-uat', detail: `${file} not found, so the passing commit was not recorded`,
          hint: 'create the phase checklist with `uat init --phase <N>` first, then re-run ci-status', ...result });
      }
      const uat = parseUat(text);
      uat.fm.ci = sha.toLowerCase();
      atomicWrite(file, renderUat(uat));
      return ok({ ...result, recorded: true });
    }
    sleep(Math.min(POLL_MS, left));
  }
}

/**
 * @param {string} dir the planning directory
 * @param {string|undefined} sub
 * @param {Record<string, any>} opts
 */
export function cmdTestPolicy(dir, sub, opts) {
  const root = typeof opts.root === 'string' ? opts.root : process.cwd();
  if (sub === 'render') return cmdRender(root);
  if (sub === 'check') return cmdCheck(root, opts.base);
  if (sub === 'ci-status') return cmdCiStatus(dir, root, opts);
  return fail('usage', 'test-policy render | check | ci-status');
}
