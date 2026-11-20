// @ts-check
// planning/spine-decisions.mjs - `spine-decisions`: one phase's spine decisions as the D-NN lines /cad-context locks
// a reader: it writes nothing, so a refusal leaves the project as it was and the session inserts `text` unchanged
'use strict';

import { join } from 'node:path';
import { fail, ok, phaseGuard, read } from './core.mjs';
import { phaseSpineDecisions } from '../lib/planning-files.mjs';

// at least two digits, numbered by roadmap order and never by S- number (D-07)
const dn = (/** @type {number} */ k) => `D-${String(k).padStart(2, '0')}`;

/**
 * One `## Durable decisions` line (D-03): the kind is the area, title then full text the statement, the S- ID and the
 * design title the evidence. Every value goes in byte for byte, an `[ASSUMPTION]` tag included (D-09).
 * @param {number} k 1-based roadmap position @param {{id: string, title: string, kind: string, text: string}} d
 * @param {string} design
 */
function durableLine(k, d, design) {
  // a title already ending a sentence takes no second full stop
  const joint = /[.?!]$/.test(d.title) ? ' ' : '. ';
  return `- ${dn(k)} (${d.kind}): ${d.title}${joint}${d.text}`
    + ` Evidence: ${d.id} of the Seldon design "${design}".\n`;
}

/** @param {string} dir @param {any} opts */
function cmdSpineDecisions(dir, opts) {
  const parsed = phaseGuard('spine-decisions', dir, opts.phase, 'spine-decisions --phase needs a phase number',
    'send a plain phase number - 3, or 3.1 for an inserted phase - then re-run; nothing was written',
    're-run with one of the two spellings the detail names - nothing was read');
  if (!parsed) return;

  const file = join(dir, 'ROADMAP.md');
  const text = read(file);
  if (text === null) {
    return fail('no-roadmap', `${file} not found`,
      'point --dir at the .planning/ directory that holds ROADMAP.md, then re-run; nothing was written');
  }

  const got = phaseSpineDecisions(text, parsed.raw);
  // any problem refuses, even beside lines that parsed: a dropped decision is never locked silently (D-05)
  if (got.problems.length) {
    const lines = got.problems.map((p) => `line ${p.line}: ${JSON.stringify(p.text)}`).join('; ');
    return fail('spine-decisions-unreadable',
      `${file}: phase ${parsed.raw}'s Spine decisions do not read - ${lines}`,
      'fix each line named to the `- **S-NN: <title>** (<kind>): <text>` shape, or restore the Goal\'s closing sentence'
      + ' `It\'s epic E-NN of the Seldon design "<title>".`, then re-run; nothing was written');
  }
  // no field answers none, never a refusal, so the workflow runs today's steps (D-14); a clean field always has a title
  return ok({
    design_title: got.title,
    count: got.decisions.length,
    decisions: got.decisions.map((d, i) => ({ id: dn(i + 1), spine_id: d.id, line: d.line })),
    text: got.decisions.map((d, i) => durableLine(i + 1, d, got.title ?? '')).join(''),
  });
}

export { cmdSpineDecisions };
