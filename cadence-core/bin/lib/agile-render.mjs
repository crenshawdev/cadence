// @ts-check
// agile-render.mjs - a read Seldon design as the agile path's files; every word comes from the design, none from a model
// pure: values in, text out, no fs and no process
'use strict';

/** @typedef {import('./seldon-design.mjs').Phase} Epic */

/** @param {string[]} blocks one per paragraph, list or heading @returns {string} */
const page = (blocks) => `${blocks.join('\n\n')}\n`;

/**
 * Each distinct stack or hosting decision once, in the order the epics name them.
 * @param {Epic[]} epics @returns {string[]}
 */
function constraints(epics) {
  /** @type {Map<string, string>} */
  const seen = new Map();
  for (const d of epics.flatMap((e) => e.spine_decisions)) {
    if (d.kind !== 'stack' && d.kind !== 'hosting') continue;
    if (!seen.has(d.id)) seen.set(d.id, `- **${d.kind}**: ${d.title} - ${d.text}`);
  }
  return [...seen.values()];
}

/**
 * @param {string} title @param {Record<string, string>} brief @param {Epic[]} epics @returns {string}
 */
export function renderProjectFile(title, brief, epics) {
  const section = (/** @type {string} */ name) => [`### ${name}`, brief[name]];
  const limits = constraints(epics);
  return page([
    `# ${title}`,
    '## What it is',
    ...section('Problem'), ...section('Solution'), ...section('Who it serves'), ...section("What's different"),
    ...section('Success criteria'), ...section('Scope'), ...section('Vision'),
    '## Out of scope',
    brief['What it refuses'],
    '## Constraints',
    limits.length ? limits.join('\n') : 'None.',
    '## Key decisions',
    'None yet.',
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
    e.spine_decisions.map((d) => `- **${d.id}: ${d.title}** (${d.kind}): ${d.text}`).join('\n') || 'None.',
    '## Decisions',
    'None yet.',
  ]);
}
