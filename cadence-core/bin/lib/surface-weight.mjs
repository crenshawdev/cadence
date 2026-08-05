// @ts-check
// surface-weight.mjs - the ONE measurement of the plugin's own prose-surface
// weight, imported by both weight.mjs (the CLI seam that reports it) and
// self-verify.mjs (the budget check that enforces it), so reported and
// enforced weight cannot diverge. Pure lib: no emit, no exit, no Date, no
// randomness, no process I/O beyond reading the surface files it measures.
//
// Measured surfaces are five branches:
//   agents/*.md                        (top-level)
//   skills/**/SKILL.md                 (recursive)
//   cadence-core/workflows/*.md        (top-level)
//   cadence-core/references/**         (recursive, EVERY file)
//   cadence-core/templates/**          (recursive, EVERY file)
// The last two are walked whole-directory rather than by extension (D-01):
// an extension filter would leave `references/model-hints.json` and
// `templates/config.json` inside budgeted directories capped by nothing,
// which is the hole BUD-02 exists against in miniature. The accepted cost is
// that a model-hints.json edit now trips a prose ratchet. Only README.md,
// INTERNALS.md and METHOD.md remain on self-verify's mdFiles walk but off
// this one.
//
// An entry this walker cannot stat or read (a dangling symlink, a symlink
// cycle, a permission error) is skipped SILENTLY here - weight.mjs emits
// this return verbatim, and an absent directory is already empty data
// (see below), so one unreadable file just means one fewer surface. That is
// deliberately the OTHER half of a split contract: self-verify.mjs reports
// the very same entry LOUDLY as an `unreadable-surface` problem. Do not
// "fix" this silence into a throw - the loudness lives one layer up (D-05).
//
// The recursion is per ENTRY, never one `recursive: true` readdir per branch:
// a single wrapped recursive read returns [] for a WHOLE subtree the moment
// one descendant throws, so one mode-000 directory could hide every readable
// sibling under it (BUD-02). Descent is decided on the DIRENT, so a symlinked
// directory encountered DURING a walk is not descended - an explicitly named
// branch root IS (`skills`, `cadence-core/references`,
// `cadence-core/templates` and the `--root` argument reach readdirSync
// before any parent dirent exists to test them, and a caller naming a root
// means to walk it). Files are still gated on a stat that follows links, so a
// dangling FILE symlink stays skipped and a valid one stays weighed.
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
 * One directory's own children, as dirents. A directory this process cannot
 * read is empty data, never a throw - and hides only its OWN children.
 * @param {string} dir
 * @returns {import('node:fs').Dirent[]}
 */
function dirents(dir) {
  try {
    return readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

/**
 * Yield every descendant file path under `dir`, recursing one directory at a
 * time. Descent is decided on the dirent, so a symlinked directory met during
 * the walk is yielded as a path rather than descended (the `isFile()` gate at
 * each call site then decides whether it counts).
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
 * Yield the absolute paths of every measured surface file under `root`, in
 * deterministic (readdir order is NOT sorted; weighAll sorts the final list).
 * An absent directory is empty data, never a throw. A dangling symlink, a
 * symlink cycle, or any other entry this walker cannot stat is silently
 * skipped, not thrown (D-05, D-06) - self-verify.mjs is the loud half.
 * @param {string} root
 * @returns {Generator<string>}
 */
export function* surfaces(root) {
  // agents/*.md - top-level only.
  const agents = join(root, 'agents');
  if (existsSync(agents)) {
    for (const d of dirents(agents)) {
      const f = join(agents, d.name);
      if (f.endsWith('.md') && isFile(f)) yield f;
    }
  }
  // skills/**/SKILL.md - recursive, only files named SKILL.md.
  const skills = join(root, 'skills');
  if (existsSync(skills)) {
    for (const f of walk(skills)) {
      if (basename(f) === 'SKILL.md' && isFile(f)) yield f;
    }
  }
  // cadence-core/workflows/*.md - top-level only.
  const workflows = join(root, 'cadence-core', 'workflows');
  if (existsSync(workflows)) {
    for (const d of dirents(workflows)) {
      const f = join(workflows, d.name);
      if (f.endsWith('.md') && isFile(f)) yield f;
    }
  }
  // cadence-core/references/** and cadence-core/templates/** - recursive,
  // EVERY file whatever its extension (D-01). Both are flat today; the
  // recursive walk is what keeps a future subdirectory from reopening the hole.
  for (const branch of ['references', 'templates']) {
    const dir = join(root, 'cadence-core', branch);
    if (!existsSync(dir)) continue;
    for (const f of walk(dir)) {
      if (isFile(f)) yield f;
    }
  }
}

/**
 * Measure one surface's text: UTF-8 byte length, plus a chars/4 estimated
 * token proxy (deliberately NOT a real tokenizer - a deterministic estimate).
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
 * Weigh every measured surface under `root`. Returns
 * `{ surface, bytes, estTokens }[]` where `surface` is the forward-slash path
 * relative to `root`, sorted ascending by `surface` so two runs on the same
 * tree are byte-identical.
 * @param {string} root
 * @returns {Array<{ surface: string, bytes: number, estTokens: number }>}
 */
export function weighAll(root) {
  const out = [];
  for (const f of surfaces(root)) {
    const surface = relative(root, f).split(sep).join('/');
    // A link that passes the stat can still fail the read (D-06) - a second
    // throw site, guarded the same silent way as the walker above.
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
