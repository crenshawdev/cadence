// @ts-check
// planning/workflow-claim.mjs - `workflow-claim take|release`: may this workflow launch now, and freeing the claim after
// the multi-workflow setting is read here from both config layers, so a model remembering a value never decides it
// with it on nothing is held; with it off one small file under the git common directory is the claim
// the file sits outside .planning/ so no commit stages it, and executor worktrees share the common directory
'use strict';

import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fail, ok } from './core.mjs';
import { claim, MAX_LABEL, release } from '../lib/workflow-claim.mjs';
import { WORKFLOW_KEYS, workflowLayers } from '../lib/workflow-layers.mjs';

/**
 * @param {string} dir the planning directory
 * @param {string} sub take | release
 * @param {any} opts
 */
function cmdWorkflowClaim(dir, sub, opts) {
  if (sub !== 'take' && sub !== 'release') return fail('usage', 'workflow-claim <take|release> --fire <label>');
  const label = opts.fire;
  if (typeof label !== 'string' || !label.trim() || label.length > MAX_LABEL) {
    return fail('bad-args', `workflow-claim ${sub} needs --fire <label> of 1 to ${MAX_LABEL} characters`,
      'pass the fire\'s `<trigger>-<discriminator>` label, or the analyzer\'s');
  }
  const root = dirname(resolve(dir));
  if (workflowLayers(root).keys[WORKFLOW_KEYS.multi].on) {
    return ok(sub === 'take' ? { action: 'take', launch: true, held: false } : { action: 'release', released: false, held: false });
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
    return ok({ action: 'take', launch: r.launch, held: r.launch, ...(r.holder ? { holder: r.holder.label, age_seconds: r.holder.age_seconds } : {}) });
  }
  const r = release(gitDir, label);
  return ok({ action: 'release', released: r.released, held: false, ...(r.holder ? { holder: r.holder.label, age_seconds: r.holder.age_seconds } : {}) });
}

export { cmdWorkflowClaim };
