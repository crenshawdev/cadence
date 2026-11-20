// @ts-check
// planning/design-read.mjs - `design-read`: a Seldon design folder read and mapped onto phases, or refused with every problem at once
// it writes nothing, accepted or refused, so planning.mjs runs it without the state step, which would convert the project
// only --add reads the project under --dir: its state, REQUIREMENTS.md and ROADMAP.md; without it nothing there is read
'use strict';

import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { dirFlag, fail, intFlag, ok } from './core.mjs';
import { emit } from '../lib/seam-io.mjs';
import { parseActiveIds, sectionSpan } from '../lib/planning-files.mjs';
import { readState, statePath } from '../lib/project-state.mjs';
import { DESIGN_FILES, readDesign } from '../lib/seldon-design.mjs';
import { unreadable } from './phase-entry.mjs';
import { invalidHint } from './state-import.mjs';

// a stand-in for the other value, so the judge's verdict on one value is about that value alone
const PLAIN = 'plain';

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

/**
 * The read-back check phase-entry add runs, on every phase's name and description, here and not in lib/ so lib never
 * imports planning/. The judge passes a balanced `**Bold**`, which reads back unchanged, so `**` is refused beside it.
 * At most one issue per value.
 * @param {import('../lib/seldon-design.mjs').Phase[]} phases @param {import('../lib/seldon-design.mjs').Issue[]} issues
 */
function judgePhases(phases, issues) {
  for (const p of phases) {
    const entry = { n: p.number, name: p.name, description: p.description, status: 'unplanned', plans: [] };
    const whole = unreadable(entry) !== null;
    const name = p.name.includes('**') || (whole && unreadable({ ...entry, description: PLAIN }) !== null);
    const outcome = p.description.includes('**') || (whole && unreadable({ ...entry, name: PLAIN }) !== null);
    if (name || (whole && !outcome)) {
      issues.push({ file: 'epics.md', id: p.epic, section: 'heading',
        problem: `the name ${JSON.stringify(p.name)} would not read back from the phase list line as written - take out the ** and any other list markup` });
    }
    if (outcome) {
      issues.push({ file: 'epics.md', id: p.epic, field: 'Outcome',
        problem: `${JSON.stringify(p.description)} would not read back from the phase list line as written - take out the ** and any other list markup` });
    }
  }
}

/**
 * Does `id` stand as a whole token in `text`? Seldon's PROJECT_ID boundaries: no letter, digit, `_` or `-` right
 * before it, no letter, digit or `_` right after. Exact strings, so CAT-4 is not CAT-04.
 * Not planning-files' REQ_ID_TOKEN, which needs a leading letter where isRequirementId admits a digit.
 * @param {string} text @param {string} id
 */
function holdsToken(text, id) {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![A-Za-z0-9_-])${escaped}(?![A-Za-z0-9_])`).test(text);
}

/**
 * The project a design joins, read and never written: the first new phase number and REQUIREMENTS.md's text,
 * or null once the refusal is out. Each file the add writes into is checked here, so a missing heading can't
 * surface only after the phases went in.
 * @param {string} dir @returns {{first: number, requirements: string} | null}
 */
function readProject(dir) {
  const got = readState(dir);
  if (got.kind === 'invalid') {
    fail('invalid-state', `${statePath(dir)}: ${got.reason} - ${got.detail}`, invalidHint(got.reason));
    return null;
  }
  if (got.kind === 'absent') {
    fail('no-state', `${statePath(dir)} does not exist`,
      'this project has no state file yet - any Cadence command that reads the project, such as `planning.mjs status`,'
      + ' gives it one; run one, then re-run. Nothing was written');
    return null;
  }
  // the highest number, never the count: a deferred close keeps unfinished phases, and 2.1 still leads to 3
  const first = got.state.phases.reduce((top, p) => Math.max(top, Math.floor(p.n)), 0) + 1;

  const reqFile = join(dir, 'REQUIREMENTS.md');
  const req = readDocument(reqFile);
  if (req.text === null) {
    fail('no-requirements', `${reqFile}: ${req.problem}`,
      'point --dir at the .planning/ directory that holds REQUIREMENTS.md, or run /cad-new-project to write one;'
      + ' nothing was written');
    return null;
  }
  if (parseActiveIds(req.text) === null) {
    fail('no-active-heading', `${reqFile} has no "## Active" heading outside a code fence to add the requirements under`,
      'add a `## Active` heading to REQUIREMENTS.md, then re-run - the add never invents one; nothing was written');
    return null;
  }
  const roadmapFile = join(dir, 'ROADMAP.md');
  const roadmap = readDocument(roadmapFile);
  if (roadmap.text === null) {
    fail('no-roadmap', `${roadmapFile}: ${roadmap.problem}`,
      'point --dir at the .planning/ directory that holds ROADMAP.md, or run /cad-new-project to write one;'
      + ' nothing was written');
    return null;
  }
  if (sectionSpan(roadmap.text.split('\n'), '## Phase Details').start === -1) {
    fail('no-phase-details-heading', `${roadmapFile} has no "## Phase Details" heading outside a code fence to add the phase sections under`,
      'add a `## Phase Details` heading to ROADMAP.md, then re-run - the add never invents one; nothing was written');
    return null;
  }
  return { first, requirements: req.text };
}

/** @param {string} dir @param {any} opts */
function cmdDesignRead(dir, opts) {
  if (opts.design === undefined) {
    return fail('bad-args', 'design-read needs --design <folder>',
      'pass --design with the Seldon design folder that holds brief.md, prd.md, spine.md and epics.md, then re-run;'
      + ' nothing was read');
  }
  const add = opts.add !== undefined;
  /** @type {number} */
  let first = 1;
  if (add && opts['first-phase'] !== undefined) {
    return fail('bad-args', 'design-read takes --add or --first-phase, never both',
      'drop --first-phase: --add numbers the new phases from the project\'s state, one past its highest phase; nothing was read');
  }
  if (!add) {
    if (opts['first-phase'] === undefined) {
      return fail('bad-args', 'design-read needs --first-phase <N>',
        'pass --first-phase with the number the first new phase takes, a whole number from 1, then re-run; nothing was read');
    }
    const given = intFlag(opts['first-phase'], 1, 'design-read --first-phase must be a whole number of at least 1',
      'pass the number the first new phase takes - one past the last phase the project holds - then re-run; nothing was read');
    if (!given.ok) return;
    first = given.value;
  }
  const design = dirFlag('design', opts.design);
  if (design.detail) {
    return fail('no-design-dir', design.detail,
      'point --design at the folder Seldon wrote the design into, then re-run; nothing was read');
  }
  const project = add ? readProject(dir) : null;
  if (add && project === null) return;
  if (project) first = project.first;

  /** @type {import('../lib/seldon-design.mjs').Issue[]} */
  const issues = [];
  /** @type {Record<string, string|null>} */
  const texts = {};
  for (const name of DESIGN_FILES) {
    const got = readDocument(join(design.abs, name));
    texts[name] = got.text;
    if (got.problem !== null) issues.push({ file: name, problem: got.problem });
  }
  const read = readDesign(texts, first);
  issues.push(...read.issues);
  judgePhases(read.design.phases, issues);
  // every section of the project's REQUIREMENTS.md counts, shipped, deferred, tables, prose and fences alike (D-02)
  const clashes = project ? read.design.requirements.filter((q) => holdsToken(project.requirements, q.id)) : [];
  for (const q of clashes) {
    issues.push({ file: 'prd.md', id: q.id, problem: 'ID is already in the project\'s REQUIREMENTS.md' });
  }
  if (issues.length) {
    const rename = 'rename each clashing ID by hand in prd.md and in every epics.md Requirements line that names it';
    const fix = 'fix each issue in the design folder, by a Seldon rerun of that document or by hand';
    const steps = !clashes.length ? fix : clashes.length === issues.length ? rename : `${fix}; ${rename}`;
    // emitted directly because fail has no channel for the issue list
    return emit({ ok: false, reason: 'design-refused',
      detail: `the design in ${design.abs} has ${issues.length} problem${issues.length === 1 ? '' : 's'} - the issues list names each`,
      issues,
      hint: `${steps}, then re-run; nothing was written` });
  }
  return ok(read.design);
}

export { cmdDesignRead };
