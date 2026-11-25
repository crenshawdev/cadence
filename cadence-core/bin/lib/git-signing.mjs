// @ts-check
// git-signing.mjs - would a signed commit go through in this folder? The key, its format and the program that signs are
// git's own settings, so git is the one asked: it signs an empty commit into a folder of its own and the project gains nothing
'use strict';

import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** Long enough to type a passphrase or touch a key. A commit nobody is there to answer for would hang right here too. */
const SIGN_TIMEOUT_S = 60;

/**
 * Why a signed commit would fail here, in git's own words, or null when it wouldn't and when commits aren't signed.
 * @param {string} root @returns {string | null}
 */
export function signingProblem(root) {
  const git = (/** @type {string[]} */ args, /** @type {Record<string, string>} */ env = {}) => spawnSync('git', args, {
    cwd: root, env: { ...process.env, ...env }, encoding: 'utf8', timeout: SIGN_TIMEOUT_S * 1000, killSignal: 'SIGKILL',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const signed = git(['config', '--type=bool', '--get', 'commit.gpgsign']);
  if (signed.status !== 0 || signed.stdout.trim() !== 'true') return null;
  const scratch = mkdtempSync(join(tmpdir(), 'cad-sign-'));
  try {
    const repo = join(scratch, 'repo');
    git(['init', '-q', '--bare', '--template=', repo]);
    // TMPDIR because git leaves its signing buffer there when a signer that hangs gets it killed
    const env = { GIT_OBJECT_DIRECTORY: join(repo, 'objects'), GIT_INDEX_FILE: join(scratch, 'index'), TMPDIR: scratch,
      // before `git init` there's no repository here to sign in, so the user's own settings decide
      ...(git(['rev-parse', '--git-dir']).status === 0 ? {} : { GIT_DIR: repo }) };
    const tree = git(['write-tree'], env);
    const tried = tree.status === 0 ? git(['commit-tree', '-S', '-m', 'signing check', tree.stdout.trim()], env) : tree;
    if (tried.status === 0) return null;
    if (tried.signal === 'SIGKILL') return `it didn't come back in ${SIGN_TIMEOUT_S} seconds`;
    return (tried.stderr || '').split('\n').map((l) => l.trim()).filter(Boolean).join('; ') || 'git gave no reason';
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}
