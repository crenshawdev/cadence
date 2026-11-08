// @ts-check
// planning/workflow-claim.mjs - `workflow-claim take|release`: may this workflow launch now, and freeing the claim after
// a take that wins prints the claim's id and release presents it; a label alone never frees a claim
// the multi-workflow setting is read here from both config layers, so a model remembering a value never decides it
// with it on nothing is held; with it off one small file under the git common directory is the claim
// the file sits outside .planning/ so no commit stages it, and executor worktrees share the common directory
'use strict';

import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fail, ok } from './core.mjs';
import { claim, MAX_LABEL, release } from '../lib/workflow-claim.mjs';
import { WORKFLOW_KEYS, workflowLayers } from '../lib/workflow-layers.mjs';

/** @param {{label: string|null, id: string|null, age_seconds: number}} h */
const held = (h) => ({ holder: h.label, holder_id: h.id, age_seconds: h.age_seconds });

/**
 * @param {string} dir the planning directory
 * @param {string} sub take | release
 * @param {any} opts
 */
function cmdWorkflowClaim(dir, sub, opts) {
  if (sub !== 'take' && sub !== 'release') return fail('usage', 'workflow-claim <take|release> --fire <label> [--id <claim id> | --stale]');
  const label = opts.fire;
  if (typeof label !== 'string' || !label.trim() || label.length > MAX_LABEL) {
    return fail('bad-args', `workflow-claim ${sub} needs --fire <label> of 1 to ${MAX_LABEL} characters`,
      'pass the fire\'s `<trigger>-<discriminator>` label');
  }
  const id = typeof opts.id === 'string' && opts.id.trim() ? opts.id.trim() : null;
  const stale = opts.stale === true;
  if (sub === 'release' && !id && !stale) {
    return fail('bad-args', 'workflow-claim release needs --id <the id take printed>',
      'pass the id from the winning take, or the holder id a losing take printed; --stale only for a holder with no id');
  }
  const root = dirname(resolve(dir));
  // only a take is skipped: a claim taken while the setting was off must still be freed once it is on
  if (sub === 'take' && workflowLayers(root).keys[WORKFLOW_KEYS.multi].on) {
    return ok({ action: 'take', launch: true, held: false });
  }
  let gitDir;
  try {
    gitDir = resolve(root, execFileSync('git', ['-C', root, 'rev-parse', '--git-common-dir'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim());
  } catch {
    return fail('no-git', `${root} is not inside a git repository, so there is nowhere to keep the claim`,
      'run from the project\'s repository, or pass --dir naming its .planning directory');
  }
  if (sub === 'take') {
    const r = claim(gitDir, label);
    return ok({ action: 'take', launch: r.launch, held: r.launch, ...(r.id ? { id: r.id } : {}), ...(r.holder ? held(r.holder) : {}) });
  }
  const r = release(gitDir, id, { stale });
  return ok({ action: 'release', released: r.released, held: false, ...(r.holder ? held(r.holder) : {}) });
}

export { cmdWorkflowClaim };
