// @ts-check
// planning/design-read.mjs - `design-read`: a Seldon design folder read and mapped onto phases, or refused with every problem at once
// it writes nothing and never reads --dir or the project's state, so planning.mjs runs it without the state step
'use strict';

import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { dirFlag, fail, intFlag, ok } from './core.mjs';
import { emit } from '../lib/seam-io.mjs';
import { DESIGN_FILES, readDesign } from '../lib/seldon-design.mjs';

/**
 * One document's text, or what's wrong with it in Seldon's check's words: missing file, or cannot read and the code.
 * Exactly one of the two is null.
 * @param {string} file @returns {{text: string|null, problem: string|null}}
 */
function readDocument(file) {
  try {
    // a FIFO or a device in the folder would hold the read open forever, so only a regular file is read
    if (!statSync(file).isFile()) return { text: null, problem: 'cannot read (not a regular file)' };
    return { text: readFileSync(file, 'utf8'), problem: null };
  } catch (err) {
    const code = /** @type {any} */ (err)?.code;
    return { text: null, problem: code === 'ENOENT' ? 'missing file' : `cannot read (${code || 'no error code'})` };
  }
}

/** @param {any} opts */
function cmdDesignRead(opts) {
  if (opts.design === undefined) {
    return fail('bad-args', 'design-read needs --design <folder>',
      'pass --design with the Seldon design folder that holds brief.md, prd.md, spine.md and epics.md, then re-run;'
      + ' nothing was read');
  }
  if (opts['first-phase'] === undefined) {
    return fail('bad-args', 'design-read needs --first-phase <N>',
      'pass --first-phase with the number the first new phase takes, a whole number from 1, then re-run; nothing was read');
  }
  const first = intFlag(opts['first-phase'], 1, 'design-read --first-phase must be a whole number of at least 1',
    'pass the number the first new phase takes - one past the last phase the project holds - then re-run; nothing was read');
  if (!first.ok) return;
  const design = dirFlag('design', opts.design);
  if (design.detail) {
    return fail('no-design-dir', design.detail,
      'point --design at the folder Seldon wrote the design into, then re-run; nothing was read');
  }

  /** @type {import('../lib/seldon-design.mjs').Issue[]} */
  const issues = [];
  /** @type {Record<string, string|null>} */
  const texts = {};
  for (const name of DESIGN_FILES) {
    const got = readDocument(join(design.abs, name));
    texts[name] = got.text;
    if (got.problem !== null) issues.push({ file: name, problem: got.problem });
  }
  const read = readDesign(texts);
  issues.push(...read.issues);
  if (issues.length) {
    // emitted directly because fail has no channel for the issue list
    return emit({ ok: false, reason: 'design-refused',
      detail: `the design in ${design.abs} has ${issues.length} problem${issues.length === 1 ? '' : 's'} - the issues list names each`,
      issues,
      hint: 'fix each issue in the design folder, by a Seldon rerun of that document or by hand, then re-run; nothing was written' });
  }
  return ok(read.design);
}

export { cmdDesignRead };
