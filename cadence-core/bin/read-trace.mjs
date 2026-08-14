// @ts-check
// read-trace.mjs - the PostToolUse hook that records what a dispatch OPENED.
//
// The disk half of lib/read-trace.mjs: resolve the Cadence project from the
// hook's cwd, shape the payload, append one line. The rule - which tools count,
// what may be recorded, and the guarded append - lives in the lib and is tested
// there without a hook, the same split lib/deferred-reads.mjs and
// lib/merge-warnings.mjs already use.
//
// Contract: stdin carries the hook JSON; this hook emits NOTHING on any stream
// and exits 0 unconditionally. PostToolUse runs after the tool has already
// returned, so there is no decision left to influence and nothing this process
// can usefully say - but a nonzero exit or stray stdout from a hook is fed back
// to the model as feedback, so a recorder that spoke would be editing the
// conversation it exists to measure.
'use strict';

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { recordFromHook, appendRead } from './lib/read-trace.mjs';

// Walk up from the hook's cwd, stopping at the repo root: a session opened in a
// subdirectory still bills the project. Same rule as git-guard.mjs, and the
// same reason - checking only cwd would miss most calls.
function planningRoot(start) {
  let dir = start;
  for (;;) {
    if (existsSync(join(dir, '.planning'))) return join(dir, '.planning');
    if (existsSync(join(dir, '.git'))) return null; // repo root, not Cadence
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

// The existence predicate `filesOf` runs its candidates through - the whole
// safety argument for reading a Bash command's arguments at all. A regular
// FILE only: a directory is not a read, and a stat that throws is a no.
function isFile(p) {
  try { return statSync(p).isFile(); } catch { return false; }
}

try {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  const cwd = String(input?.cwd || process.cwd());
  const root = planningRoot(cwd);
  if (root) {
    // `root` is `<project>/.planning`; the tree paths are billed against is its
    // parent, and confinement to it is what keeps a path elsewhere on the
    // machine out of the record.
    const rec = recordFromHook(input, undefined, { root: dirname(root), cwd, isFile });
    if (rec) appendRead(root, rec);
  }
} catch {
  // Every failure is silent by contract: a broken recorder must never disturb
  // normal work, and there is no stream it may report on.
}
process.exit(0);
