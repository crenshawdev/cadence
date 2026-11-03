// @ts-check
// planning/test-policy.mjs - `test-policy render`: the committed form of the
// project's accepted testing policy.
//
// WHY A FILE. The policy lives in `.planning/config.json`, which a project may
// keep out of its repository, and GitHub Actions can only read what is
// committed. `render` writes `.github/cadence/coverage-policy.json` from the
// config so CI and the config can be compared (`check`, below it) and a lowered
// threshold can be named against a ref.
//
// THE SHAPE is the `testing` section's own (scope, coverage, strong_areas,
// required_jobs), keys in config.schema.json's order, two-space JSON and a
// trailing newline: a re-render of the same config is byte-identical, and a
// reader of the file finds the names the config uses. Unset keys take the
// schema's default; the schema is located the way config.mjs and route.mjs
// locate it and its defaults are never restated here.
//
// `--root` is the PROJECT root, deliberately NOT `--dir`, which this script
// defines as the planning directory.
'use strict';

import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readTestingPolicy } from '../lib/config-merge.mjs';
import { atomicWrite } from '../lib/planning-files.mjs';
import { testSeamOpen } from '../lib/test-seam.mjs';
import { fail, ok } from './core.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
// The exact shape config.mjs's SCHEMA_PATH has: the same file, the same
// CADENCE_CONFIG_SCHEMA override, the same gate.
const SCHEMA_PATH = (testSeamOpen() && process.env.CADENCE_CONFIG_SCHEMA)
  || join(HERE, '..', '..', 'config.schema.json');

/** Where the committed policy lives, relative to the project root. */
export const POLICY_FILE = join('.github', 'cadence', 'coverage-policy.json');

/**
 * The accepted policy with defaults filled, in the schema's key order - or null
 * when the project accepted none.
 * @param {string} root
 */
function effectivePolicy(root) {
  const { testing, accepted } = readTestingPolicy(join(root, '.planning', 'config.json'));
  if (!accepted) return null;
  const keys = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8')).keys;
  /** @type {Record<string, any>} */
  const policy = {};
  for (const [name, spec] of Object.entries(keys)) {
    if (!name.startsWith('testing.')) continue;
    const path = name.split('.').slice(1);
    let have = testing;
    for (const p of path) have = have && typeof have === 'object' ? have[p] : undefined;
    let at = policy;
    for (const p of path.slice(0, -1)) at = at[p] ||= {};
    at[path[path.length - 1]] = have === undefined ? spec.default : have;
  }
  return policy;
}

const NO_POLICY_HINT = 'run /cad-config --testing to accept a testing policy first - until then the project behaves as it did before the policy existed';

/**
 * @param {string} root
 */
function cmdRender(root) {
  const policy = effectivePolicy(root);
  if (!policy) {
    return fail('no-policy', 'testing.scope is unset, so no policy was accepted and there is nothing to render', NO_POLICY_HINT);
  }
  const file = join(root, POLICY_FILE);
  mkdirSync(dirname(file), { recursive: true });
  atomicWrite(file, `${JSON.stringify(policy, null, 2)}\n`);
  return ok({ file: POLICY_FILE, policy });
}

/**
 * @param {string} _dir
 * @param {string|undefined} sub
 * @param {Record<string, any>} opts
 */
export function cmdTestPolicy(_dir, sub, opts) {
  const root = typeof opts.root === 'string' ? opts.root : process.cwd();
  if (sub === 'render') return cmdRender(root);
  return fail('usage', 'test-policy render | check');
}
