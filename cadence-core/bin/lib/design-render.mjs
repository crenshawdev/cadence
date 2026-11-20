// @ts-check
// design-render.mjs - a read design's requirements and phases as the exact `## Active` bullets and `### Phase N:` sections
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
