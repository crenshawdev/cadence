// @ts-check
// agile-render.mjs - a read Seldon design as the agile path's files; every word comes from the design, none from a model
// pure: values in, text out, no fs and no process
'use strict';

import { sectionSpan } from './planning-files.mjs';

/** @typedef {import('./seldon-design.mjs').Phase} Epic */

/** @param {string[]} blocks one per paragraph, list or heading @returns {string} */
const page = (blocks) => `${blocks.join('\n\n')}\n`;

/** @typedef {import('./seldon-design.mjs').Decision} Decision */

/** @param {Decision} d */
const decisionLine = (d) => `- **${d.id}: ${d.title}** (${d.kind}): ${d.text}`;

/** The decisions that limit the whole project. @param {Decision[]} decisions */
export const limits = (decisions) => decisions.filter((d) => d.kind === 'stack' || d.kind === 'hosting');

/**
 * Every spine decision has a home: stack and hosting here as constraints, the ones an epic names in that epic's file, and
 * any that no epic names here as key decisions.
 * @param {string} title @param {Record<string, string>} brief @param {Epic[]} epics @param {Decision[]} decisions
 * @returns {string}
 */
export function renderProjectFile(title, brief, epics, decisions) {
  const section = (/** @type {string} */ name) => [`### ${name}`, brief[name]];
  const named = new Set(epics.flatMap((e) => e.spine_decisions).map((d) => d.id));
  const limited = limits(decisions);
  const key = decisions.filter((d) => !limited.includes(d) && !named.has(d.id));
  return page([
    `# ${title}`,
    '## What it is',
    ...section('Problem'), ...section('Solution'), ...section('Who it serves'), ...section("What's different"),
    ...section('Success criteria'), ...section('Scope'), ...section('Vision'),
    '## Out of scope',
    brief['What it refuses'],
    '## Constraints',
    limited.map(decisionLine).join('\n') || 'None.',
    '## Key decisions',
    key.map(decisionLine).join('\n') || 'None yet.',
  ]);
}

/**
 * The release's requirements in Seldon's own bullet, under their PRD categories, with nothing deferred yet.
 * @param {string} title @param {import('./seldon-design.mjs').Requirement[]} requirements @returns {string}
 */
export function renderRequirementsFile(title, requirements) {
  /** @type {string[]} */
  const blocks = [];
  /** @type {string | null} */
  let category = null;
  for (const q of requirements) {
    const bullet = `- **${q.id}**: ${q.text}`;
    if (q.category !== category) blocks.push(`### ${q.category}`, bullet);
    else blocks[blocks.length - 1] += `\n${bullet}`;
    category = q.category;
  }
  return page([`# Requirements: ${title}`, '## Requirements', ...blocks, '## Deferred', 'None.']);
}

/**
 * @param {string} title @param {Record<string, string>} brief @param {Epic[]} epics @returns {string}
 */
export function renderReleaseFile(title, brief, epics) {
  return page([
    `# Release: ${title}`,
    '## Goal',
    brief['Success criteria'],
    '## Epics',
    epics.map((e) => `- ${e.epic}: ${e.name}`).join('\n'),
  ]);
}

/** @param {Epic} e @returns {string} */
export function renderEpicFile(e) {
  return page([
    ['---', `epic: ${e.epic}`, `title: ${e.name}`, 'status: backlog',
      `builds_on: ${e.builds_on.join(', ') || 'None'}`, `requirements: ${e.requirements.join(', ')}`, '---'].join('\n'),
    `# ${e.epic}: ${e.name}`,
    '## Outcome',
    e.description,
    '## Boundaries',
    e.boundaries,
    '## Done when',
    e.success_criteria.map((c) => `- ${c}`).join('\n'),
    '## Spine decisions',
    e.spine_decisions.map(decisionLine).join('\n') || 'None.',
    '## Decisions',
    'None yet.',
  ]);
}

/** @typedef {import('./agile-read.mjs').Story} Story */

/** An S is built without a written plan, so it has no section for one. @param {Story} s @returns {string} */
export function renderStoryFile(s) {
  return page([
    ['---', `story: ${s.id}`, `title: ${s.title}`, `size: ${s.size}`, `status: ${s.status}`,
      `builds_on: ${s.builds_on.join(', ') || 'None'}`, `requirements: ${s.requirements.join(', ')}`, '---'].join('\n'),
    `# ${s.id}: ${s.title}`,
    '## Delivers',
    s.delivers,
    '## Accepted when',
    s.accepted_when.map((c) => `- ${c}`).join('\n'),
    ...(s.size === 'S' ? [] : ['## Plan', 'None yet.']),
    '## Result',
    'None yet.',
  ]);
}

/**
 * An epic's file with its Decisions changed and every other line as it was.
 * @param {string} text an epic file `readEpicFile` reads @param {(held: string[]) => string[]} change @returns {string}
 */
function withDecisions(text, change) {
  // split as the readers do, or a Windows line ending hides the section from this one alone
  const lines = text.split(/\r?\n/);
  const { start, end } = sectionSpan(lines, '## Decisions');
  const held = lines.slice(start + 1, end).join('\n').trim();
  const out = page([lines.slice(0, start).join('\n').trimEnd(), '## Decisions',
    change(held === '' || held === 'None yet.' ? [] : held.split('\n')).join('\n') || 'None yet.',
    ...(end < lines.length ? [lines.slice(end).join('\n').trimEnd()] : [])]);
  return text.includes('\r\n') ? out.replaceAll('\n', '\r\n') : out;
}

/** The user's answers, each under its question, over any earlier answer to it. @param {string} text @param {{question: string, answer: string}[]} answers */
export function renderAnswers(text, answers) {
  return withDecisions(text, (held) => {
    const lines = [...held];
    for (const { question, answer } of answers) {
      const at = lines.findIndex((l) => l.startsWith(`- **${question}** `));
      lines.splice(at < 0 ? lines.length : at, at < 0 ? 0 : 1, `- **${question}** ${answer}`);
    }
    return lines;
  });
}

/**
 * An epic's file once its stories are approved: in progress, with the decisions under any it already holds.
 * @param {string} text @param {string[]} decisions @returns {string}
 */
export function renderRefinedEpic(text, decisions) {
  return withDecisions(text.replace(/^status:.*/m, 'status: in-progress'), (held) => [...held, ...decisions.map((d) => `- ${d}`)]);
}
