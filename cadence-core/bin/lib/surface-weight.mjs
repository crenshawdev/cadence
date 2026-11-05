// @ts-check
// surface-weight.mjs - the one measurement of the plugin's prose-surface weight, used by weight.mjs (reports it) and
// self-verify.mjs (enforces the budget with it), so the two can't diverge. Pure lib.
// References and templates are walked whole, so a stray JSON file isn't left uncapped.
// An entry it can't read is skipped silently, since weight.mjs emits this verbatim; self-verify.mjs reports it.
// Recursion is per entry, never a `recursive: true` readdir, which one throwing descendant would empty.
// Descent follows the dirent, so a symlinked directory met mid-walk isn't descended, but a named root is.
'use strict';

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { basename, join, relative, sep } from 'node:path';

/** @param {string} f @returns {boolean} */
function isFile(f) {
  try {
    return statSync(f).isFile();
  } catch {
    return false;
  }
}

/**
 * One directory's own children, as dirents. A directory this process can't read is empty data, never a throw, and hides
 * only its own children.
 * @param {string} dir
 * @returns {import('node:fs').Dirent[]}
 */
export function dirents(dir) {
  try {
    return readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

/**
 * Yield every descendant file path under `dir`. Descent is decided on the dirent, so a symlinked directory met during
 * the walk is yielded as a path, and the `isFile()` gate at each call site decides whether it counts.
 * @param {string} dir
 * @returns {Generator<string>}
 */
function* walk(dir) {
  for (const d of dirents(dir)) {
    const f = join(dir, d.name);
    if (d.isDirectory()) yield* walk(f);
    else yield f;
  }
}

/**
 * Yield the absolute paths of every measured surface file under `root`, in readdir order, which isn't sorted
 * (`weighAll` sorts the final list). An absent directory is empty data, and an entry it can't stat is skipped silently
 * since self-verify.mjs is the loud half.
 * @param {string} root
 * @returns {Generator<string>}
 */
export function* surfaces(root) {
  const agents = join(root, 'agents');
  if (existsSync(agents)) {
    for (const d of dirents(agents)) {
      const f = join(agents, d.name);
      if (f.endsWith('.md') && isFile(f)) yield f;
    }
  }
  const skills = join(root, 'skills');
  if (existsSync(skills)) {
    for (const f of walk(skills)) {
      if (basename(f) === 'SKILL.md' && isFile(f)) yield f;
    }
  }
  const workflows = join(root, 'cadence-core', 'workflows');
  if (existsSync(workflows)) {
    for (const d of dirents(workflows)) {
      const f = join(workflows, d.name);
      if (f.endsWith('.md') && isFile(f)) yield f;
    }
  }
  // references/ and templates/ are walked recursively, every file whatever its extension; both are flat today, and the
  // recursive walk keeps a future subdirectory from reopening the hole.
  for (const branch of ['references', 'templates']) {
    const dir = join(root, 'cadence-core', branch);
    if (!existsSync(dir)) continue;
    for (const f of walk(dir)) {
      if (isFile(f)) yield f;
    }
  }
}

/**
 * Measure one surface's text: UTF-8 byte length plus a chars/4 token estimate, deliberately not a real tokenizer so it
 * stays deterministic.
 * @param {string} text
 * @returns {{ bytes: number, estTokens: number }}
 */
export function measure(text) {
  return {
    bytes: Buffer.byteLength(text, 'utf8'),
    estTokens: Math.ceil(text.length / 4),
  };
}

/**
 * Weigh every measured surface under `root` into `{ surface, bytes, estTokens }[]`, `surface` being the forward-slash
 * path relative to `root`, sorted so two runs on one tree are byte-identical.
 * @param {string} root
 * @returns {Array<{ surface: string, bytes: number, estTokens: number }>}
 */
export function weighAll(root) {
  const out = [];
  for (const f of surfaces(root)) {
    const surface = relative(root, f).split(sep).join('/');
    // A link that passes the stat can still fail the read, a second throw site guarded the same silent way.
    let text;
    try {
      text = readFileSync(f, 'utf8');
    } catch {
      continue;
    }
    out.push({ surface, ...measure(text) });
  }
  out.sort((a, b) => (a.surface < b.surface ? -1 : a.surface > b.surface ? 1 : 0));
  return out;
}
