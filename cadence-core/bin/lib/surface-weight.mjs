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
'use strict';

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/**
 * Yield the absolute paths of every measured surface file under `root`, in
 * deterministic (readdir order is NOT sorted; weighAll sorts the final list).
 * An absent directory is empty data, never a throw.
 * @param {string} root
 * @returns {Generator<string>}
 */
export function* surfaces(root) {
  // agents/*.md - top-level only.
  const agents = join(root, 'agents');
  if (existsSync(agents)) {
    for (const e of readdirSync(agents, { encoding: 'utf8' })) {
      const f = join(agents, e);
      if (f.endsWith('.md') && statSync(f).isFile()) yield f;
    }
  }
  // skills/**/SKILL.md - recursive, only files named SKILL.md.
  const skills = join(root, 'skills');
  if (existsSync(skills)) {
    for (const e of readdirSync(skills, { recursive: true, encoding: 'utf8' })) {
      const f = join(skills, String(e));
      if (f.endsWith(`${sep}SKILL.md`) || String(e) === 'SKILL.md') {
        if (statSync(f).isFile()) yield f;
      }
    }
  }
  // cadence-core/workflows/*.md - top-level only.
  const workflows = join(root, 'cadence-core', 'workflows');
  if (existsSync(workflows)) {
    for (const e of readdirSync(workflows, { encoding: 'utf8' })) {
      const f = join(workflows, e);
      if (f.endsWith('.md') && statSync(f).isFile()) yield f;
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
    out.push({ surface, ...measure(readFileSync(f, 'utf8')) });
  }
  out.sort((a, b) => (a.surface < b.surface ? -1 : a.surface > b.surface ? 1 : 0));
  return out;
}
