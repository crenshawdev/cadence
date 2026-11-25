// @ts-check
// git-signing.mjs - would a signed commit go through in this folder? The key, its format and the program that signs are
// git's own settings, so git is the one asked: it signs an empty commit into a folder of its own and the project gains nothing
'use strict';

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { localGitEnv } from './publish-authorization.mjs';

/** Long enough to type a passphrase or touch a key. A commit nobody is there to answer for would hang right here too. */
const SIGN_TIMEOUT_S = 60;

/** What git said about a call that failed. @param {import('node:child_process').SpawnSyncReturns<string>} r */
function reason(r) {
  if (r.signal === 'SIGKILL') return `it didn't come back in ${SIGN_TIMEOUT_S} seconds`;
  return (r.stderr || '').split('\n').map((l) => l.trim()).filter(Boolean).join('; ') || 'git gave no reason';
}

/**
 * Why a signed commit would fail here, in git's own words, or null when it wouldn't and when commits aren't signed.
 * @param {string} root @returns {string | null}
 */
export function signingProblem(root) {
  const git = (/** @type {string[]} */ args, /** @type {NodeJS.ProcessEnv} */ env = process.env) => spawnSync('git', args, {
    cwd: root, env, encoding: 'utf8', timeout: SIGN_TIMEOUT_S * 1000, killSignal: 'SIGKILL', stdio: ['ignore', 'pipe', 'pipe'],
  });
  const signed = git(['config', '--type=bool', '--get', 'commit.gpgsign']);
  // 1 is git saying it isn't set; anything else it can't read, and the commit won't be able to either
  if (signed.status === 1) return null;
  if (signed.status !== 0) return reason(signed);
  if (signed.stdout.trim() !== 'true') return null;
  // absolute, because git runs in root and this process may not
  const scratch = mkdtempSync(resolve(tmpdir(), 'cad-sign-'));
  try {
    const objects = join(scratch, 'objects');
    mkdirSync(objects);
    // TMPDIR because git leaves its signing buffer there when a signer that hangs gets it killed
    /** @type {NodeJS.ProcessEnv} */
    const env = { ...process.env, GIT_OBJECT_DIRECTORY: objects, TMPDIR: scratch };
    if (git(['rev-parse', '--git-dir']).status !== 0) {
      // before `git init` there's no repository here to sign in, so the user's own settings decide
      const repo = join(scratch, 'repo');
      const made = git(['init', '-q', '--bare', '--template=', repo], localGitEnv());
      if (made.status !== 0) return reason(made);
      env.GIT_DIR = repo;
    }
    // hash-object, not write-tree: writing an index runs the project's hooks and can expire the shared index it depends on
    const tree = git(['hash-object', '-t', 'tree', '--stdin'], env);
    const tried = tree.status === 0 ? git(['commit-tree', '-S', '-m', 'signing check', tree.stdout.trim()], env) : tree;
    return tried.status === 0 ? null : reason(tried);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}
