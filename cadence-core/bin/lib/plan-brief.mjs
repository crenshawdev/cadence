// @ts-check
// plan-brief.mjs - a plan's brief: the parts an executor reads, composed from the texts it is handed
// pure, no I/O and no clock: planning/brief.mjs reads the files and writes the result, so the same texts give the same bytes
// the plan's sections go in word for word, because a paraphrase is a second statement of what "done" means
'use strict';

import { normalize, sectionSpan } from './planning-files.mjs';

// the plan sections an executor builds from, in the order the plan template writes them; `## Notes` stays out
const SECTIONS = ['## Goal', '## Must be true when done', '## Context', '## Tasks'];

/** One section as the plan wrote it, heading line included, trailing blank lines dropped; null when absent. */
function sectionText(/** @type {string[]} */ lines, /** @type {string} */ heading) {
  const { start, end } = sectionSpan(lines, heading);
  if (start < 0) return null;
  let stop = end;
  while (stop > start + 1 && lines[stop - 1].trim() === '') stop -= 1;
  return lines.slice(start, stop).join('\n');
}

/** One section's lines, heading included; empty when the heading is absent. */
function sectionSpanLines(/** @type {string[]} */ lines, /** @type {string} */ heading) {
  const { start, end } = sectionSpan(lines, heading);
  return start < 0 ? [] : lines.slice(start, end);
}

/** The plan's frontmatter lines and the rest after them; no frontmatter leaves the whole text as the rest. */
function splitFrontmatter(/** @type {string} */ text) {
  const m = /^---\n([\s\S]*?)\n---[ \t]*(?:\n|$)/.exec(text);
  return m ? { fm: m[1].split('\n'), rest: text.slice(m[0].length) } : { fm: [], rest: text };
}

/** The `files:` key line and the lines under it as the plan writes them, or null when the plan has no such key. */
function filesBlock(/** @type {string[]} */ fm) {
  const at = fm.findIndex((l) => /^files\s*:/.test(l));
  if (at < 0) return null;
  let stop = at + 1;
  while (stop < fm.length && !/^[A-Za-z_][\w-]*\s*:/.test(fm[stop])) stop += 1;
  while (stop > at + 1 && fm[stop - 1].trim() === '') stop -= 1;
  return fm.slice(at, stop).join('\n');
}

const DECISION_ID = /^D-\d+(?:\.\d+)?$/;

/** The bullet lines of both decision sections in a CONTEXT.md, by id; the first line for an id wins. */
function contextDecisions(/** @type {string|null} */ contextText) {
  /** @type {Map<string, string>} */
  const byId = new Map();
  if (contextText === null) return byId;
  const lines = normalize(contextText).split('\n');
  for (const heading of ['## Durable decisions', '## Decisions']) {
    const { start, end } = sectionSpan(lines, heading);
    if (start < 0) continue;
    for (const line of lines.slice(start + 1, end)) {
      const id = /^- (D-\d+(?:\.\d+)?)/.exec(line)?.[1];
      if (id !== undefined && !byId.has(id)) byId.set(id, line);
    }
  }
  return byId;
}

/**
 * The entries of every task's `**Decisions:**` field, with the task they sit under. The value may wrap onto following
 * indented lines, since the template wraps fields; the next column-0 field or a blank line ends it.
 * @param {string[]} tasks the `## Tasks` section's lines
 * @returns {{task: string, entry: string}[]}
 */
function namedDecisions(tasks) {
  /** @type {{task: string, entry: string}[]} */
  const out = [];
  let task = '';
  for (let i = 0; i < tasks.length; i += 1) {
    const heading = /^### Task\s+([\d.]+)/.exec(tasks[i]);
    if (heading) { task = heading[1]; continue; }
    const field = /^(?:- )?\*\*Decisions:\*\*(.*)$/.exec(tasks[i]);
    if (!field || task === '') continue;
    let value = field[1];
    while (i + 1 < tasks.length && /^\s+\S/.test(tasks[i + 1])) { i += 1; value += ` ${tasks[i].trim()}`; }
    for (const piece of value.split(',')) {
      if (piece.trim() !== '') out.push({ task, entry: piece.trim() });
    }
  }
  return out;
}

/**
 * @param {object} p
 * @param {string} p.planFile the plan's file name, as the phase directory holds it
 * @param {string} p.planRel the plan's path from the repository root, in the caller's phase spelling
 * @param {string} p.planText
 * @param {string|null} p.projectText PROJECT.md, or null when the project has none
 * @param {string|null} p.contextText the phase's own CONTEXT.md, or null when it has none
 * @returns {{ok: true, text: string, bytes: number} | {ok: false, detail: string, hint: string}}
 */
export function composeBrief({ planFile, planRel, planText, projectText, contextText }) {
  const { fm, rest } = splitFrontmatter(normalize(planText));
  const lines = rest.split('\n');
  if (sectionText(lines, '## Tasks') === null) {
    return { ok: false, detail: `${planFile} has no ## Tasks section, so there is nothing to brief`,
      hint: `write ${planFile}'s tasks under a ## Tasks heading, then re-run` };
  }
  const decisions = contextDecisions(contextText);
  const phaseDir = planRel.slice(0, planRel.lastIndexOf('/'));
  const contextRel = `${phaseDir}/CONTEXT.md`;
  const named = namedDecisions(sectionSpanLines(lines, '## Tasks'));
  const bad = named.filter((n) => !DECISION_ID.test(n.entry) || !decisions.has(n.entry));
  if (bad.length) {
    const why = (/** @type {{entry: string}} */ n) => (DECISION_ID.test(n.entry)
      ? `is not in ${contextRel}` : 'is not a decision id');
    return { ok: false,
      detail: bad.map((n) => `${planFile} Task ${n.task} names ${n.entry}, which ${why(n)}`).join('; '),
      hint: `fix each Decisions entry in ${planFile} to a D-NN id from ${contextRel}, or drop the entry, then re-run` };
  }
  const h1 = lines.find((l) => l.startsWith('# ')) ?? `# ${planFile}`;

  /** @type {string[]} */
  const out = [h1, ''];
  out.push(`This brief stands in for \`${planRel}\`, \`.planning/PROJECT.md\` and \`${contextRel}\`. All three are still there to open when the brief doesn't settle something.`);
  out.push(`Where your contract speaks of the plan file your dispatch names, \`${planRel}\` is the one meant: derive \`<plandir>\` and \`k\` from it.`);
  if (named.length === 0 && decisions.size > 0) {
    out.push(`No decision was carried: no task names one. \`${contextRel}\` holds this phase's decisions, so read it for any that bind the work.`);
  }
  out.push('');

  const files = filesBlock(fm);
  if (files !== null) {
    out.push("The plan's lease, its `files:` list as the plan writes it:", '', files, '');
  }
  for (const heading of SECTIONS) {
    const s = sectionText(lines, heading);
    if (s !== null) out.push(s, '');
  }
  if (named.length) {
    // each id's line once, in the order first named
    const once = [...new Set(named.map((n) => /** @type {string} */ (decisions.get(n.entry))))];
    out.push('## Decisions the tasks name', '', ...once, '');
  }
  if (projectText !== null) {
    const c = sectionText(normalize(projectText).split('\n'), '## Constraints');
    if (c !== null) out.push(c, '');
  }
  const text = out.join('\n').replace(/\n+$/, '\n');
  return { ok: true, text, bytes: Buffer.byteLength(text) };
}
