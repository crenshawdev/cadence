// @ts-check
// PostToolUse hook that records what a dispatch opened.
// The rules live in lib/read-trace.mjs; this half finds the project and appends.
// It prints nothing and always exits 0: a hook that talks or fails gets fed back to the model.
'use strict';

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { planningRoot } from './lib/git-segments.mjs';

// regular files only, so a Bash argument that isn't one never counts as a read
function isFile(p) {
  try { return statSync(p).isFile(); } catch { return false; }
}

try {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  const cwd = String(input?.cwd || process.cwd());
  // walk up from cwd so a session opened in a subdirectory still bills the project
  const project = planningRoot(cwd, (dir, name) => existsSync(join(dir, name)));
  const root = project === null ? null : join(project, '.planning');
  if (root) {
    // lazy, because this hook fires on every tool call in every session
    const { recordFromHook, appendRead } = await import('./lib/read-trace.mjs');
    // paths are confined to the project, so nothing elsewhere on the machine lands in the record
    // pluginRoot comes from this file's location, not an env var, to tell a plugin file from any other outside path
    const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
    const rec = recordFromHook(input, undefined, { root: dirname(root), cwd, isFile, pluginRoot });
    if (rec) appendRead(root, rec);
  }
} catch {
  // a broken recorder must never disturb the session, so swallow everything
}
process.exit(0);
