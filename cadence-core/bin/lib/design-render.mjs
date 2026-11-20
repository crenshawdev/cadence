// @ts-check
// design-render.mjs - a read design as the exact `## Active` bullets, `### Phase N:` sections and a new project's PROJECT.md
// pure: values in, text out, no fs and no process; the session inserts the text unchanged, so every value goes in as given
'use strict';

/**
 * The `## Active` text: a `### <category>` heading wherever the category changes from the requirement before, so PRD
 * order holds exactly, laid out as the REQUIREMENTS template lays it out. It's appended whole, never merged.
 * @param {import('./seldon-design.mjs').Requirement[]} requirements @returns {string}
 */
export function renderActive(requirements) {
  /** @type {string[]} */
  const lines = [];
  /** @type {string|null} */
  let category = null;
  for (const q of requirements) {
    if (q.category !== category) {
      if (category !== null) lines.push('');
      lines.push(`### ${q.category}`, '');
      category = q.category;
    }
    lines.push(`- [ ] **${q.id}**: ${q.text}`);
  }
  return lines.map((l) => `${l}\n`).join('');
}

/**
 * One `### Phase N:` section per phase, a blank line between sections and none inside one, as the live ROADMAP has them.
 * An epic with no spine decisions gets no `**Spine decisions:**` line at all.
 * @param {import('./seldon-design.mjs').Phase[]} phases @returns {string}
 */
export function renderSections(phases) {
  return phases.map((p) => [
    `### Phase ${p.number}: ${p.name}`,
    `**Goal:** ${p.goal}`,
    `**Depends on:** ${p.depends_on}`,
    `**Requirements:** ${p.requirements.join(', ')}`,
    '**Success Criteria:**',
    ...p.success_criteria.map((c, i) => `${i + 1}. ${c}`),
    ...(p.spine_decisions.length ? ['**Spine decisions:**'] : []),
    ...p.spine_decisions.map((d) => `- **${d.id}: ${d.title}** (${d.kind}): ${d.text}`),
  ].map((l) => `${l}\n`).join('')).join('\n');
}

/**
 * The PROJECT.md text a design's new project starts from, laid out as templates/PROJECT.md lays it out. The session
 * inserts it unchanged and writes only the Core Value line, the one bracketed line here (D-08, D-09).
 * Constraints holds each distinct stack or hosting spine decision once, in first-appearance order (D-18).
 * @param {string} title @param {Record<string, string>} brief
 * @param {import('./seldon-design.mjs').Phase[]} phases @param {string} date YYYY-MM-DD @returns {string}
 */
export function renderProject(title, brief, phases, date) {
  /** @type {Set<string>} */
  const seen = new Set();
  /** @type {string[]} */
  const constraints = [];
  for (const p of phases) {
    for (const d of p.spine_decisions) {
      if ((d.kind !== 'stack' && d.kind !== 'hosting') || seen.has(d.id)) continue;
      seen.add(d.id);
      constraints.push(`- **${d.kind}**: ${d.title} - ${d.text}`);
    }
  }
  /** @param {string} name */
  const section = (name) => [`### ${name}`, brief[name]];
  const blocks = [
    `# ${title}`,
    '## What This Is',
    ...section('Problem'), ...section('Solution'), ...section('Who it serves'), ...section("What's different"),
    '## Core Value',
    '[The one thing that must work, in one sentence taken from the brief - the session writes it here.]',
    '## Requirements',
    '### Validated',
    '(None yet - ship to validate)',
    '### Active',
    `The requirements of the Seldon design "${title}" are in REQUIREMENTS.md's \`## Active\`.`,
    '### Out of Scope',
    brief['What it refuses'],
    '## Context',
    ...section('Success criteria'), ...section('Scope'), ...section('Vision'),
    '## Constraints',
    ...(constraints.length ? [constraints.join('\n')] : []),
    '## Key Decisions',
    '| Decision | Rationale | Outcome |\n|----------|-----------|---------|',
    '---',
  ];
  // the footer sits right under the rule, as the template has it
  const footer = `*Last updated: ${date} after starting the project from the Seldon design "${title}"*`;
  return `${blocks.map((b) => `${b}\n`).join('\n')}${footer}\n`;
}
