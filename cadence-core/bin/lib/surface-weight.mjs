// @ts-check
// surface-weight.mjs - the ONE measurement of the plugin's own prose-surface
// weight, imported by both weight.mjs (the CLI seam that reports it) and
// self-verify.mjs (the budget check that enforces it), so reported and
// enforced weight cannot diverge. Pure lib: no emit, no exit, no Date, no
// randomness, no process I/O beyond reading the surface files it measures.
//
// Measured surfaces are exactly the agent/skill/workflow prose - narrower
// than self-verify's mdFiles (which also walks references/templates/README):
//   agents/*.md                        (top-level)
//   skills/**/SKILL.md                 (recursive)
//   cadence-core/workflows/*.md        (top-level)
//
// An entry this walker cannot stat or read (a dangling symlink, a symlink
// cycle, a permission error) is skipped SILENTLY here - weight.mjs emits
// this return verbatim, and an absent directory is already empty data
// (see below), so one unreadable file just means one fewer surface. That is
// deliberately the OTHER half of a split contract: self-verify.mjs reports
// the very same entry LOUDLY as an `unreadable-surface` problem. Do not
// "fix" this silence into a throw - the loudness lives one layer up (D-05).
'use strict';

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/** @param {string} f @returns {boolean} */
function isFile(f) {
  try {
    return statSync(f).isFile();
  } catch {
    return false;
  }
}

/** @param {string} dir @param {{ encoding: 'utf8', recursive?: boolean }} opts @returns {string[]} */
function entries(dir, opts) {
  try {
    return readdirSync(dir, opts);
  } catch {
    return [];
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
    for (const e of entries(agents, { encoding: 'utf8' })) {
      const f = join(agents, e);
      if (f.endsWith('.md') && isFile(f)) yield f;
    }
  }
  // skills/**/SKILL.md - recursive, only files named SKILL.md.
  const skills = join(root, 'skills');
  if (existsSync(skills)) {
    for (const e of entries(skills, { recursive: true, encoding: 'utf8' })) {
      const f = join(skills, String(e));
      if (f.endsWith(`${sep}SKILL.md`) || String(e) === 'SKILL.md') {
        if (isFile(f)) yield f;
      }
    }
  }
  // cadence-core/workflows/*.md - top-level only.
  const workflows = join(root, 'cadence-core', 'workflows');
  if (existsSync(workflows)) {
    for (const e of entries(workflows, { encoding: 'utf8' })) {
      const f = join(workflows, e);
      if (f.endsWith('.md') && isFile(f)) yield f;
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
